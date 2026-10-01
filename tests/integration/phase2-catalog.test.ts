import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', async () => {
  const { createNextHeadersMock } = await import('../helpers/cookie-jar');
  return createNextHeadersMock();
});

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { prisma } = await import('@/lib/db/client');
const { listLevels, listSubjects, listServices, listRooms } = await import('@/lib/catalog/queries');
const { createLevelAction, deleteLevelAction } = await import('@/actions/levels');
const { deleteRoomAction } = await import('@/actions/rooms');
const { createSession } = await import('@/lib/auth/session');
const { truncateAllTables } = await import('../helpers/test-db');
const { createCenter, createUser } = await import('../helpers/factories');

/**
 * The catalogue screens against the real schema.
 *
 * The catalogue differs from the people tables in one important way: rows are
 * *deactivated* (`active`), never deleted, because a level or a service stays
 * referenced by historic registrations. These tests pin that distinction down,
 * along with the tenancy rule that keeps one centre's catalogue out of another's.
 */
describe('catalogue list queries', () => {
  let centerId: string;
  let otherCenterId: string;

  beforeEach(async () => {
    await truncateAllTables(prisma);
    centerId = (await createCenter()).id;
    otherCenterId = (await createCenter()).id;
  });

  async function seedLevel(center: string, overrides: Record<string, unknown> = {}) {
    return prisma.academicLevel.create({
      data: {
        centerId: center,
        code: (overrides.code as string) ?? 'PR-1',
        stage: (overrides.stage as string) ?? 'PRIMAIRE',
        nameFr: (overrides.nameFr as string) ?? '1ère année',
        nameAr: overrides.nameAr as string,
        sortOrder: (overrides.sortOrder as number) ?? 0,
        active: (overrides.active as boolean) ?? true,
      },
    });
  }

  it('never returns another centre\'s levels', async () => {
    await seedLevel(centerId, { code: 'PR-1', nameFr: 'Alpha' });
    await seedLevel(otherCenterId, { code: 'PR-1', nameFr: 'Beta' });

    const { rows } = await listLevels(centerId, {});
    expect(rows.map((r) => r.nameFr)).toEqual(['Alpha']);
  });

  it('shows a deactivated level by default and filters it out on request', async () => {
    // The secretary must still see the row to reactivate it; hiding it silently
    // is what makes a deactivated level look deleted.
    await seedLevel(centerId, { code: 'PR-1', nameFr: 'Active', active: true });
    await seedLevel(centerId, { code: 'PR-2', nameFr: 'Desactive', active: false });

    expect((await listLevels(centerId, {})).rows).toHaveLength(2);
    expect((await listLevels(centerId, { filter: { active: 'true' } })).rows.map((r) => r.nameFr)).toEqual(['Active']);
    expect((await listLevels(centerId, { filter: { active: 'false' } })).rows.map((r) => r.nameFr)).toEqual(['Desactive']);
  });

  it('filters levels by stage', async () => {
    await seedLevel(centerId, { code: 'PR-1', stage: 'PRIMAIRE', nameFr: 'Primaire' });
    await seedLevel(centerId, { code: 'L1', stage: 'LYCEE', nameFr: 'Lycee' });

    expect((await listLevels(centerId, { filter: { stage: 'LYCEE' } })).rows.map((r) => r.nameFr)).toEqual(['Lycee']);
  });

  it('searches the Arabic name of a level', async () => {
    await seedLevel(centerId, { code: 'PR-1', nameFr: 'Premiere', nameAr: 'السنة الأولى' });
    expect((await listLevels(centerId, { q: 'الأولى' })).rows).toHaveLength(1);
  });

  it('does not let a wildcard search term match every row', async () => {
    await seedLevel(centerId, { code: 'PR-1', nameFr: 'Alpha' });
    await seedLevel(centerId, { code: 'PR-2', nameFr: 'Beta' });

    expect((await listLevels(centerId, { q: '%' })).rows).toEqual([]);
    expect((await listLevels(centerId, { q: 'alph' })).rows).toHaveLength(1);
  });

  it('orders levels by their display order, not by insertion', async () => {
    await seedLevel(centerId, { code: 'PR-3', nameFr: 'Troisieme', sortOrder: 3 });
    await seedLevel(centerId, { code: 'PR-1', nameFr: 'Premiere', sortOrder: 1 });
    await seedLevel(centerId, { code: 'PR-2', nameFr: 'Deuxieme', sortOrder: 2 });

    const { rows } = await listLevels(centerId, { sort: 'sortOrder', dir: 'asc' });
    expect(rows.map((r) => r.nameFr)).toEqual(['Premiere', 'Deuxieme', 'Troisieme']);
  });

  it('restricts subjects to the language flag when asked', async () => {
    await prisma.subject.create({ data: { centerId, code: 'ARAB', nameFr: 'Arabe', isLanguage: true } });
    await prisma.subject.create({ data: { centerId, code: 'MATH', nameFr: 'Maths', isLanguage: false } });

    const all = await listSubjects(centerId, {});
    const languages = await listSubjects(centerId, {}, { languagesOnly: true });
    expect(all.rows).toHaveLength(2);
    expect(languages.rows.map((r) => r.code)).toEqual(['ARAB']);
  });

  it('includes the category of a subject, and null when it has none', async () => {
    const category = await prisma.subjectCategory.create({
      data: { centerId, slug: 'sciences', nameFr: 'Sciences' },
    });
    await prisma.subject.create({ data: { centerId, code: 'MATH', nameFr: 'Maths', categoryId: category.id } });
    await prisma.subject.create({ data: { centerId, code: 'EPS', nameFr: 'EPS' } });

    const { rows } = await listSubjects(centerId, {});
    expect(rows.find((r) => r.code === 'MATH')?.category?.nameFr).toBe('Sciences');
    expect(rows.find((r) => r.code === 'EPS')?.category).toBeNull();
  });

  it('stores prices in cents, never in decimals', async () => {
    await prisma.service.create({
      data: { centerId, code: 'S-1', nameFr: 'Soutien', defaultPriceCents: 15000, defaultDurationMinutes: 60 },
    });

    const { rows } = await listServices(centerId, {});
    expect(rows[0]?.defaultPriceCents).toBe(15000);
    expect(rows[0]?.defaultDurationMinutes).toBe(60);
  });

  it('searches a room by name, location and equipment', async () => {
    await prisma.room.create({ data: { centerId, name: 'Salle A', location: 'Rez-de-chaussee' } });
    await prisma.room.create({ data: { centerId, name: 'Salle B', location: 'Etage', equipment: 'Vidéoprojecteur' } });

    expect((await listRooms(centerId, { q: 'Salle A' })).rows).toHaveLength(1);
    expect((await listRooms(centerId, { q: 'Etage' })).rows.map((r) => r.name)).toEqual(['Salle B']);
    expect((await listRooms(centerId, { q: 'Vidéo' })).rows.map((r) => r.name)).toEqual(['Salle B']);
    // SQLite's LIKE is ASCII-case-insensitive only, so an accented letter still
    // has to be typed with its accent. Asserted so the limitation is a decision
    // on record rather than a surprise for a secretary typing without a keyboard
    // layout that offers the accent.
    expect((await listRooms(centerId, { q: 'video' })).rows).toEqual([]);
  });

  it('keeps rooms centre-scoped', async () => {
    await prisma.room.create({ data: { centerId, name: 'Salle A' } });
    await prisma.room.create({ data: { centerId: otherCenterId, name: 'Salle Z' } });

    expect((await listRooms(centerId, {})).rows.map((r) => r.name)).toEqual(['Salle A']);
  });
});

describe('catalogue actions', () => {
  let center: { id: string };
  let admin: { id: string };

  beforeEach(async () => {
    await truncateAllTables(prisma);
    center = await createCenter();
    admin = await createUser(center.id, { role: 'ADMIN' });
    await createSession(admin.id);
  });

  function form(values: Record<string, string>): FormData {
    const data = new FormData();
    for (const [key, value] of Object.entries(values)) data.append(key, value);
    return data;
  }

  it('creates a level and reads the paired checkbox as a boolean', async () => {
    const result = await createLevelAction(
      form({ code: 'PR-1', stage: 'PRIMAIRE', nameFr: '1ère année', active: 'true' }),
    );
    expect(result.ok).toBe(true);

    const level = await prisma.academicLevel.findUniqueOrThrow({ where: { id: (result as { data: { id: string } }).data.id } });
    expect(level.active).toBe(true);
    expect(level.sortOrder).toBe(0);
  });

  it('rejects a level with an unknown stage', async () => {
    expect(await createLevelAction(form({ code: 'X', stage: 'KINDERGARTEN', nameFr: 'Petite section' }))).toMatchObject({
      ok: false,
      code: 'VALIDATION',
    });
    expect(await prisma.academicLevel.count()).toBe(0);
  });

  it('deactivates a level that is still referenced instead of deleting it', async () => {
    const level = await prisma.academicLevel.create({
      data: { centerId: center.id, code: 'PR-1', stage: 'PRIMAIRE', nameFr: '1ère année' },
    });
    const student = await prisma.student.create({
      data: { centerId: center.id, code: 'ELE-0001', firstName: 'Amine', lastName: 'El Amrani', levelId: level.id },
    });

    const result = await deleteLevelAction(level.id);
    expect(result).toMatchObject({ ok: true, data: { deactivated: true } });

    // The row survives with its students attached - a hard delete would have
    // orphaned them or cascaded the loss.
    const after = await prisma.academicLevel.findUniqueOrThrow({ where: { id: level.id } });
    expect(after.active).toBe(false);
    const kept = await prisma.student.findUniqueOrThrow({ where: { id: student.id } });
    expect(kept.levelId).toBe(level.id);
  });

  it('deactivates a scheduled room but keeps its sessions attached', async () => {
    // Deliberately different from deleting a teacher: a room is put out of use
    // far more often than a teacher leaves, and `Schedule.roomId` is a plain
    // foreign key, so nothing is lost by deactivating. The session survives and
    // keeps pointing at the room, which is what the secretary needs to see when
    // rebooking.
    const room = await prisma.room.create({ data: { centerId: center.id, name: 'Salle 1' } });
    const teacher = await prisma.teacher.create({
      data: { centerId: center.id, code: 'ENS-0001', firstName: 'Youssef', lastName: 'Idrissi' },
    });
    const schedule = await prisma.schedule.create({
      data: { centerId: center.id, roomId: room.id, teacherId: teacher.id, dayOfWeek: 2, startMinute: 600, endMinute: 660 },
    });

    expect(await deleteRoomAction(room.id)).toMatchObject({ ok: true, data: { deactivated: true } });
    expect((await prisma.room.findUniqueOrThrow({ where: { id: room.id } })).active).toBe(false);

    const kept = await prisma.schedule.findUniqueOrThrow({ where: { id: schedule.id } });
    expect(kept.roomId).toBe(room.id);
  });

  it('deactivates an unreferenced room', async () => {
    const room = await prisma.room.create({ data: { centerId: center.id, name: 'Salle 1' } });
    expect(await deleteRoomAction(room.id)).toMatchObject({ ok: true });
    expect((await prisma.room.findUniqueOrThrow({ where: { id: room.id } })).active).toBe(false);
  });

  it('requires the academics permission', async () => {
    const secretary = await createUser(center.id, { role: 'SECRETARY' });
    await createSession(secretary.id);
    expect(await createLevelAction(form({ code: 'PR-1', stage: 'PRIMAIRE', nameFr: 'X' }))).toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });
  });
});