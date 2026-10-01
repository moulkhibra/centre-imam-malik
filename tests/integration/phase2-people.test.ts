import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', async () => {
  const { createNextHeadersMock } = await import('../helpers/cookie-jar');
  return createNextHeadersMock();
});

// `revalidatePath` throws outside a Next request scope. The actions call it after
// every successful write, so it has to be stubbed; the revalidation itself is
// Next's job and is not what these tests are about.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { prisma } = await import('@/lib/db/client');
const { listStudents, listParents, listTeachers } = await import('@/lib/people/queries');
const { createStudentAction, deleteStudentAction, updateStudentAction } = await import('@/actions/students');
const { deleteTeacherAction } = await import('@/actions/teachers');
const { createSession } = await import('@/lib/auth/session');
const { truncateAllTables } = await import('../helpers/test-db');
const { createCenter, createUser } = await import('../helpers/factories');

/**
 * The people screens against the real schema.
 *
 * The query layer is where a data leak or a lost row would actually happen, so
 * these tests use real SQLite rather than a stub: a missing `centerId` in a
 * `where` clause cannot hide behind a mock, and soft-deleted rows are checked
 * against the real `active` column.
 */
const DELETED = new Date('2026-01-01T00:00:00.000Z');

describe('people list queries', () => {
  let centerId: string;
  let otherCenterId: string;

  beforeEach(async () => {
    await truncateAllTables(prisma);
    centerId = (await createCenter()).id;
    otherCenterId = (await createCenter()).id;
  });

  async function seedStudent(center: string, overrides: Record<string, unknown> = {}) {
    return prisma.student.create({
      data: {
        centerId: center,
        code: overrides.code as string,
        firstName: (overrides.firstName as string) ?? 'Amine',
        lastName: (overrides.lastName as string) ?? 'El Amrani',
        status: (overrides.status as string) ?? 'ACTIVE',
        gender: overrides.gender as string,
        phone: overrides.phone as string,
        city: overrides.city as string,
        deletedAt: (overrides.deletedAt as Date | undefined) ?? null,
      },
    });
  }

  it('never returns another centre\'s students', async () => {
    await seedStudent(centerId, { code: 'ELE-1', lastName: 'Alpha' });
    await seedStudent(otherCenterId, { code: 'ELE-2', lastName: 'Beta' });

    const { rows, pagination } = await listStudents(centerId, {});
    expect(rows.map((r) => r.lastName)).toEqual(['Alpha']);
    expect(pagination.total).toBe(1);
  });

  it('hides a soft-deleted student but still counts it out of the list', async () => {
    await seedStudent(centerId, { code: 'ELE-1', lastName: 'Visible' });
    await seedStudent(centerId, { code: 'ELE-2', lastName: 'Supprime', deletedAt: DELETED });

    const { rows, pagination } = await listStudents(centerId, {});
    expect(rows.map((r) => r.lastName)).toEqual(['Visible']);
    expect(pagination.total).toBe(1);
  });

  it('searches the Latin and the Arabic name, and the code', async () => {
    await seedStudent(centerId, { code: 'ELE-1', lastName: 'El Amrani' });
    await seedStudent(centerId, { code: 'ELE-2', lastName: 'Bennani', firstName: 'أمين' });

    expect((await listStudents(centerId, { q: 'Amrani' })).rows).toHaveLength(1);
    expect((await listStudents(centerId, { q: 'أمين' })).rows).toHaveLength(1);
    expect((await listStudents(centerId, { q: 'ELE-2' })).rows).toHaveLength(1);
    expect((await listStudents(centerId, { q: 'zzz' })).rows).toHaveLength(0);
  });

  it('treats a search term containing % as a literal, not a wildcard', async () => {
    await seedStudent(centerId, { code: 'ELE-1', lastName: '100% Rachid' });
    await seedStudent(centerId, { code: 'ELE-2', lastName: 'Ordinaire' });

    // A bare `%` has no literal characters, so it matches nothing rather than
    // everything: pasting it must not dump the whole centre's list.
    expect((await listStudents(centerId, { q: '%' })).rows).toEqual([]);
    expect((await listStudents(centerId, { q: '100%' })).rows.map((r) => r.code)).toEqual(['ELE-1']);
    // `a_b` is a literal substring, not "a, any character, b".
    expect((await listStudents(centerId, { q: 'a_b' })).rows).toEqual([]);
  });

  it('never lets a wildcard character widen the match', async () => {
    // Prisma cannot add `ESCAPE '\\'` to `contains`, so `_` and `%` are stripped
    // rather than escaped. The trade-off is deliberate: the term can never match
    // MORE than the user asked for (no `axxb` found by searching `a_b`), at the
    // cost of a row whose name literally contains `_` not being findable by
    // typing that `_`. A false positive in a pupil list is worse.
    await seedStudent(centerId, { code: 'ELE-1', lastName: 'axxb' });
    await seedStudent(centerId, { code: 'ELE-2', lastName: 'Ordinaire' });

    expect((await listStudents(centerId, { q: 'a_b' })).rows.map((r) => r.code)).toEqual([]);
  });

  it('filters by status and by gender, and ALL means no filter', async () => {
    await seedStudent(centerId, { code: 'ELE-1', status: 'ACTIVE', gender: 'M' });
    await seedStudent(centerId, { code: 'ELE-2', status: 'SUSPENDED', gender: 'F' });

    expect((await listStudents(centerId, { filter: { status: 'SUSPENDED' } })).rows.map((r) => r.code)).toEqual(['ELE-2']);
    expect((await listStudents(centerId, { filter: { gender: 'M' } })).rows.map((r) => r.code)).toEqual(['ELE-1']);
    expect((await listStudents(centerId, { filter: { status: 'ALL' } })).rows).toHaveLength(2);
  });

  it('filters by level through the relation', async () => {
    const level = await prisma.academicLevel.create({
      data: { centerId, code: 'PR-1', stage: 'PRIMAIRE', nameFr: '1ère année' },
    });
    const other = await prisma.academicLevel.create({
      data: { centerId, code: 'PR-2', stage: 'PRIMAIRE', nameFr: '2ème année' },
    });
    await prisma.student.create({
      data: { centerId, code: 'ELE-1', firstName: 'A', lastName: 'B', levelId: level.id },
    });
    await prisma.student.create({
      data: { centerId, code: 'ELE-2', firstName: 'C', lastName: 'D', levelId: other.id },
    });

    const { rows } = await listStudents(centerId, { filter: { level: level.id } });
    expect(rows.map((r) => r.code)).toEqual(['ELE-1']);
  });

  it('pages without repeating or dropping a row', async () => {
    for (let i = 0; i < 7; i += 1) {
      await seedStudent(centerId, { code: `ELE-${i}`, lastName: `Nom ${String(i).padStart(2, '0')}` });
    }

    const first = await listStudents(centerId, { page: '1', pageSize: '5', sort: 'code', dir: 'asc' });
    const second = await listStudents(centerId, { page: '2', pageSize: '5', sort: 'code', dir: 'asc' });

    expect(first.rows).toHaveLength(5);
    expect(second.rows).toHaveLength(2);
    expect(first.pagination).toMatchObject({ total: 7, totalPages: 2, from: 1, to: 5 });
    expect(second.pagination).toMatchObject({ from: 6, to: 7 });
    expect(new Set([...first.rows, ...second.rows].map((r) => r.id)).size).toBe(7);
  });

  it('orders descending on request', async () => {
    await seedStudent(centerId, { code: 'ELE-1', lastName: 'Alpha' });
    await seedStudent(centerId, { code: 'ELE-2', lastName: 'Zeta' });

    const { rows } = await listStudents(centerId, { sort: 'lastName', dir: 'desc' });
    expect(rows.map((r) => r.lastName)).toEqual(['Zeta', 'Alpha']);
  });

  it('counts a student\'s parents for the table badge', async () => {
    const student = await seedStudent(centerId, { code: 'ELE-1' });
    const parent = await prisma.parent.create({
      data: { centerId, code: 'PAR-1', firstName: 'Nadia', lastName: 'Bennani' },
    });
    await prisma.studentParent.create({ data: { studentId: student.id, parentId: parent.id } });

    const { rows } = await listStudents(centerId, {});
    expect(rows[0]?._count.parents).toBe(1);
  });

  it('keeps parents and teachers centre-scoped too', async () => {
    await prisma.parent.create({ data: { centerId, code: 'PAR-1', firstName: 'Nadia', lastName: 'Bennani' } });
    await prisma.parent.create({ data: { centerId: otherCenterId, code: 'PAR-2', firstName: 'Ali', lastName: 'Alaoui' } });
    await prisma.teacher.create({ data: { centerId, code: 'ENS-1', firstName: 'Youssef', lastName: 'Idrissi' } });
    await prisma.teacher.create({ data: { centerId: otherCenterId, code: 'ENS-2', firstName: 'Salma', lastName: 'Cherkaoui' } });

    expect((await listParents(centerId, {})).rows.map((r) => r.code)).toEqual(['PAR-1']);
    expect((await listTeachers(centerId, {})).rows.map((r) => r.code)).toEqual(['ENS-1']);
  });
});

describe('people actions', () => {
  let center: { id: string };
  let admin: { id: string };

  beforeEach(async () => {
    await truncateAllTables(prisma);
    center = await createCenter();
    admin = await createUser(center.id, { role: 'ADMIN' });
  });

  /** Puts a real session in the cookie jar so `requirePermission` resolves. */
  async function signIn(userId: string) {
    await createSession(userId);
  }

  function form(values: Record<string, string>): FormData {
    const data = new FormData();
    for (const [key, value] of Object.entries(values)) data.append(key, value);
    return data;
  }

  it('creates a student and leaves an audit trail', async () => {
    await signIn(admin.id);
    const result = await createStudentAction(form({ firstName: 'Amine', lastName: 'El Amrani' }));

    expect(result.ok).toBe(true);
    const student = await prisma.student.findUniqueOrThrow({ where: { id: (result as { data: { id: string } }).data.id } });
    expect(student.status).toBe('ACTIVE');
    expect(await prisma.auditLog.count({ where: { entityType: 'Student' } })).toBeGreaterThan(0);
  });

  it('rejects a blank form instead of writing an empty student', async () => {
    await signIn(admin.id);
    const result = await createStudentAction(form({ firstName: '', lastName: '' }));

    expect(result).toMatchObject({ ok: false, code: 'VALIDATION' });
    expect(await prisma.student.count()).toBe(0);
  });

  it('reports a duplicate code without writing a second row', async () => {
    await signIn(admin.id);
    // The code is the only per-centre unique column on a student (the schema has
    // no unique index on CIN), so the duplicate case is exercised there.
    await createStudentAction(form({ firstName: 'Amine', lastName: 'El Amrani', code: 'ELE-0001' }));
    const duplicate = await createStudentAction(form({ firstName: 'Chaimae', lastName: 'Berrada', code: 'ELE-0001' }));

    expect(duplicate).toMatchObject({ ok: false, code: 'DUPLICATE' });
    if (duplicate.ok) return;
    // Known limitation, asserted so it is not forgotten: the SQLite connector
    // reports P2002 without `meta.target`, so no field can be pinpointed and the
    // form shows the banner rather than marking the code input. The duplicate is
    // still refused, which is the part that protects the data.
    expect(duplicate.error).toBeTruthy();
    expect(await prisma.student.count()).toBe(1);
  });

  it('refuses a delete for a user without the permission', async () => {
    const secretary = await createUser(center.id, { role: 'SECRETARY' });
    await signIn(secretary.id);
    const student = await prisma.student.create({
      data: { centerId: center.id, code: 'ELE-1', firstName: 'Amine', lastName: 'El Amrani' },
    });

    // The button is hidden in the UI; this proves the server refuses too.
    const result = await deleteStudentAction(student.id, 'ELE-1');
    expect(result).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(await prisma.student.count({ where: { id: student.id, deletedAt: null } })).toBe(1);
  });

  it('refuses a teacher deletion while a schedule still references them', async () => {
    await signIn(admin.id);
    const teacher = await prisma.teacher.create({
      data: { centerId: center.id, code: 'ENS-1', firstName: 'Youssef', lastName: 'Idrissi' },
    });
    const room = await prisma.room.create({ data: { centerId: center.id, name: 'Salle 1' } });

    // With nothing referencing them, the delete succeeds.
    expect(await deleteTeacherAction(teacher.id, 'ENS-1')).toMatchObject({ ok: true });
    const softDeleted = await prisma.teacher.findUniqueOrThrow({ where: { id: teacher.id } });
    expect(softDeleted.deletedAt).not.toBeNull();

    // Restore the teacher and give them a scheduled slot: `Schedule.teacherId`
    // is ON DELETE SET NULL, so deleting would silently blank every session.
    await prisma.teacher.update({ where: { id: teacher.id }, data: { deletedAt: null } });
    await prisma.schedule.create({
      data: {
        centerId: center.id,
        teacherId: teacher.id,
        roomId: room.id,
        dayOfWeek: 1,
        startMinute: 8 * 60,
        endMinute: 9 * 60,
      },
    });
    expect(await deleteTeacherAction(teacher.id, 'ENS-1')).toMatchObject({ ok: false, code: 'CONFLICT' });
    expect((await prisma.teacher.findUniqueOrThrow({ where: { id: teacher.id } })).deletedAt).toBeNull();

    await prisma.schedule.deleteMany({ where: { teacherId: teacher.id } });
    expect(await deleteTeacherAction(teacher.id, 'ENS-1')).toMatchObject({ ok: true });
    expect((await prisma.teacher.findUniqueOrThrow({ where: { id: teacher.id } })).deletedAt).not.toBeNull();
  });

  it('requires the confirmation code to match before deleting', async () => {
    await signIn(admin.id);
    const student = await prisma.student.create({
      data: { centerId: center.id, code: 'ELE-1', firstName: 'Amine', lastName: 'El Amrani' },
    });

    const wrong = await deleteStudentAction(student.id, 'ELE-9');
    expect(wrong).toMatchObject({ ok: false });
    expect((await prisma.student.findUniqueOrThrow({ where: { id: student.id } })).deletedAt).toBeNull();

    expect(await deleteStudentAction(student.id, 'ELE-1')).toMatchObject({ ok: true });
  });

  it('updates a record and records what changed', async () => {
    await signIn(admin.id);
    const student = await prisma.student.create({
      data: { centerId: center.id, code: 'ELE-1', firstName: 'Amine', lastName: 'El Amrani', phone: null },
    });

    const result = await updateStudentAction(student.id, form({ firstName: 'Yassine', lastName: 'Benali', phone: '' }));
    expect(result.ok).toBe(true);

    const updated = await prisma.student.findUniqueOrThrow({ where: { id: student.id } });
    expect(updated.firstName).toBe('Yassine');
    // An emptied phone must be stored as NULL, not as an empty string.
    expect(updated.phone).toBeNull();

    // The journal records the before/after of each changed field, so an update
    // can be reconstructed - this is what the audit screen reads.
    const audit = await prisma.auditLog.findFirst({ where: { entityType: 'Student', entityId: student.id, action: 'UPDATE' } });
    expect(audit).not.toBeNull();
    expect(audit?.metadata).toContain('Yassine');
    expect(audit?.metadata).toContain('El Amrani');
  });
});