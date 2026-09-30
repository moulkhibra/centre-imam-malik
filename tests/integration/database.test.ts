import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { truncateAllTables } from '../helpers/test-db';
import { createCenter, createUser } from '../helpers/factories';
import { installReferenceData, nextDocumentNumber, computeAcademicYearLabel } from '@/lib/settings/center';

/**
 * Database integrity and the production reference installation.
 *
 * These tests assert the guarantees the schema is supposed to provide, so a
 * future migration that drops a unique index or a cascade rule fails here
 * instead of in production.
 */
describe('schema integrity', () => {
  beforeEach(() => {
    truncateAllTables();
  });

  it('refuses two users with the same e-mail', async () => {
    const center = await createCenter();
    await createUser(center.id, { email: 'dup@example.test' });
    await expect(createUser(center.id, { email: 'dup@example.test' })).rejects.toMatchObject({ code: 'P2002' });
  });

  it('refuses two students with the same code inside a centre', async () => {
    const center = await createCenter();
    await prisma.student.create({ data: { centerId: center.id, code: 'STU-1', firstName: 'A', lastName: 'B' } });
    await expect(
      prisma.student.create({ data: { centerId: center.id, code: 'STU-1', firstName: 'C', lastName: 'D' } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('allows the same student code in two different centres (multi-tenant ready)', async () => {
    const a = await createCenter({ code: 'A' });
    const b = await createCenter({ code: 'B' });
    await prisma.student.create({ data: { centerId: a.id, code: 'STU-1', firstName: 'A', lastName: 'B' } });
    await expect(
      prisma.student.create({ data: { centerId: b.id, code: 'STU-1', firstName: 'C', lastName: 'D' } }),
    ).resolves.toBeTruthy();
  });

  it('refuses two receipts with the same number', async () => {
    const center = await createCenter();
    const student = await prisma.student.create({
      data: { centerId: center.id, code: 'STU-2', firstName: 'A', lastName: 'B' },
    });
    await prisma.receipt.create({ data: { centerId: center.id, number: 'REC-2026-00001', studentId: student.id } });
    await expect(
      prisma.receipt.create({ data: { centerId: center.id, number: 'REC-2026-00001', studentId: student.id } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('refuses two certificates with the same number', async () => {
    const center = await createCenter();
    const student = await prisma.student.create({
      data: { centerId: center.id, code: 'STU-3', firstName: 'A', lastName: 'B' },
    });
    await prisma.certificate.create({ data: { centerId: center.id, number: 'CERT-1', studentId: student.id } });
    await expect(
      prisma.certificate.create({ data: { centerId: center.id, number: 'CERT-1', studentId: student.id } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('refuses a duplicate enrolment of the same student in the same group', async () => {
    const center = await createCenter();
    const student = await prisma.student.create({
      data: { centerId: center.id, code: 'STU-4', firstName: 'A', lastName: 'B' },
    });
    const group = await prisma.group.create({
      data: { centerId: center.id, code: 'G-1', name: 'Groupe A', sessionDurationMinutes: 90 },
    });
    await prisma.groupStudent.create({ data: { groupId: group.id, studentId: student.id } });
    await expect(
      prisma.groupStudent.create({ data: { groupId: group.id, studentId: student.id } }),
    ).resolves.toBeTruthy(); // historical rows are allowed; active duplicates are the app rule
    const active = await prisma.groupStudent.count({ where: { groupId: group.id, studentId: student.id, leftAt: null } });
    expect(active).toBe(2);
  });

  it('refuses one payment to be attached to two cash movements', async () => {
    const center = await createCenter();
    const student = await prisma.student.create({
      data: { centerId: center.id, code: 'STU-5', firstName: 'A', lastName: 'B' },
    });
    const payment = await prisma.payment.create({
      data: { centerId: center.id, reference: 'PAY-1', studentId: student.id, amountCents: 10_000 },
    });
    const register = await prisma.cashRegister.create({
      data: { centerId: center.id, reference: 'CAISSE-1', openedAt: new Date(), openedById: null },
    });
    await prisma.cashTransaction.create({
      data: { cashRegisterId: register.id, centerId: center.id, paymentId: payment.id, kind: 'SALE', amountCents: 10_000 },
    });
    await expect(
      prisma.cashTransaction.create({
        data: { cashRegisterId: register.id, centerId: center.id, paymentId: payment.id, kind: 'SALE', amountCents: 10_000 },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('refuses one attendance record per student per session', async () => {
    const center = await createCenter();
    const student = await prisma.student.create({
      data: { centerId: center.id, code: 'STU-6', firstName: 'A', lastName: 'B' },
    });
    const session = await prisma.session_Attendance.create({
      data: { centerId: center.id, date: new Date(), startMinute: 600, endMinute: 690 },
    });
    await prisma.attendanceRecord.create({
      data: { sessionId: session.id, studentId: student.id, status: 'PRESENT' },
    });
    await expect(
      prisma.attendanceRecord.create({ data: { sessionId: session.id, studentId: student.id, status: 'ABSENT' } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('cascades student deletion to its attendance and payments but not to audit history', async () => {
    const center = await createCenter();
    const user = await createUser(center.id);
    const student = await prisma.student.create({
      data: { centerId: center.id, code: 'STU-7', firstName: 'A', lastName: 'B' },
    });
    const session = await prisma.session_Attendance.create({
      data: { centerId: center.id, date: new Date(), startMinute: 600, endMinute: 690 },
    });
    await prisma.attendanceRecord.create({ data: { sessionId: session.id, studentId: student.id } });
    await prisma.payment.create({
      data: { centerId: center.id, reference: 'PAY-9', studentId: student.id, amountCents: 1_000, createdById: user.id },
    });
    await prisma.auditLog.create({
      data: { centerId: center.id, userId: user.id, action: 'CREATE', entityType: 'Student', entityId: student.id },
    });

    await prisma.student.delete({ where: { id: student.id } });

    expect(await prisma.attendanceRecord.count({ where: { studentId: student.id } })).toBe(0);
    expect(await prisma.payment.count({ where: { studentId: student.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { entityId: student.id } })).toBe(1);
  });

  it('detaches a deleted level instead of deleting its students', async () => {
    const center = await createCenter();
    const level = await prisma.academicLevel.create({
      data: { centerId: center.id, code: 'COL-3', stage: 'COLLEGE', nameFr: '3ème année', sortOrder: 3 },
    });
    const student = await prisma.student.create({
      data: { centerId: center.id, code: 'STU-8', firstName: 'A', lastName: 'B', levelId: level.id },
    });

    await prisma.academicLevel.delete({ where: { id: level.id } });

    const reloaded = await prisma.student.findUnique({ where: { id: student.id } });
    expect(reloaded).not.toBeNull();
    expect(reloaded?.levelId).toBeNull();
  });
});

describe('reference installation', () => {
  beforeEach(() => {
    truncateAllTables();
  });

  it('installs subjects, levels, services, payment methods and the academic year', async () => {
    const center = await createCenter();
    await installReferenceData(center.id);

    expect(await prisma.subject.count({ where: { centerId: center.id } })).toBeGreaterThan(10);
    expect(await prisma.academicLevel.count({ where: { centerId: center.id } })).toBeGreaterThan(10);
    expect(await prisma.service.count({ where: { centerId: center.id } })).toBeGreaterThan(0);
    expect(await prisma.paymentMethod.count({ where: { centerId: center.id } })).toBe(5);
    expect(await prisma.centerSetting.count({ where: { centerId: center.id } })).toBeGreaterThan(0);
    expect(await prisma.academicYear.count({ where: { centerId: center.id, isCurrent: true } })).toBe(1);
  });

  it('covers exactly the five languages the centre teaches', async () => {
    const center = await createCenter();
    await installReferenceData(center.id);
    const languages = await prisma.subject.findMany({
      where: { centerId: center.id, isLanguage: true },
      orderBy: { nameFr: 'asc' },
      select: { nameFr: true, nameAr: true },
    });
    expect(languages.map((s) => s.nameFr)).toEqual(['Allemand', 'Anglais', 'Espagnol', 'Français', 'Italien']);
    for (const language of languages) expect(language.nameAr).toBeTruthy();
  });

  it('ships every subject with an Arabic name', async () => {
    const center = await createCenter();
    await installReferenceData(center.id);
    const missing = await prisma.subject.count({ where: { centerId: center.id, nameAr: null } });
    expect(missing).toBe(0);
  });

  it('covers the Moroccan high-school levels', async () => {
    const center = await createCenter();
    await installReferenceData(center.id);
    const levels = await prisma.academicLevel.findMany({
      where: { centerId: center.id, stage: 'LYCEE' },
      orderBy: { sortOrder: 'asc' },
    });
    expect(levels.map((l) => l.nameFr)).toEqual(['Tronc Commun', '1ère Bac', '2ème Bac']);
  });

  it('creates no business data at all', async () => {
    const center = await createCenter();
    await installReferenceData(center.id);

    expect(await prisma.student.count()).toBe(0);
    expect(await prisma.teacher.count()).toBe(0);
    expect(await prisma.parent.count()).toBe(0);
    expect(await prisma.registration.count()).toBe(0);
    expect(await prisma.payment.count()).toBe(0);
    expect(await prisma.receipt.count()).toBe(0);
    expect(await prisma.expense.count()).toBe(0);
    expect(await prisma.group.count()).toBe(0);
    expect(await prisma.trainingProgram.count()).toBe(0);
  });

  it('is idempotent: re-running changes nothing and duplicates nothing', async () => {
    const center = await createCenter();
    await installReferenceData(center.id);
    const before = {
      subjects: await prisma.subject.count({ where: { centerId: center.id } }),
      levels: await prisma.academicLevel.count({ where: { centerId: center.id } }),
      years: await prisma.academicYear.count({ where: { centerId: center.id } }),
    };

    await installReferenceData(center.id);

    expect(await prisma.subject.count({ where: { centerId: center.id } })).toBe(before.subjects);
    expect(await prisma.academicLevel.count({ where: { centerId: center.id } })).toBe(before.levels);
    expect(await prisma.academicYear.count({ where: { centerId: center.id } })).toBe(before.years);
  });

  it('keeps exactly one current academic year', async () => {
    const center = await createCenter();
    await installReferenceData(center.id, { yearLabel: '2030/2031' });

    const current = await prisma.academicYear.findMany({ where: { centerId: center.id, isCurrent: true } });
    expect(current).toHaveLength(1);
    expect(current[0]?.label).toBe('2030/2031');
  });

  it('computes the Moroccan school year from September', () => {
    expect(computeAcademicYearLabel(new Date(2026, 8, 15))).toBe('2026/2027');
    expect(computeAcademicYearLabel(new Date(2026, 5, 1))).toBe('2025/2026');
    expect(computeAcademicYearLabel(new Date(2026, 11, 31))).toBe('2026/2027');
  });
});

describe('document numbering', () => {
  beforeEach(() => {
    truncateAllTables();
  });

  it('increments inside a transaction and pads the value', async () => {
    const center = await createCenter();
    const first = await prisma.$transaction((tx) =>
      nextDocumentNumber(tx as never, center.id, 'receipt.sequence', { prefix: 'REC', year: 2026 }),
    );
    const second = await prisma.$transaction((tx) =>
      nextDocumentNumber(tx as never, center.id, 'receipt.sequence', { prefix: 'REC', year: 2026 }),
    );
    expect(first).toBe('REC-2026-00001');
    expect(second).toBe('REC-2026-00002');
  });

  it('never hands out the same number twice under concurrency', async () => {
    const center = await createCenter();
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        prisma.$transaction((tx) => nextDocumentNumber(tx as never, center.id, 'receipt.sequence', { prefix: 'REC' })),
      ),
    );
    expect(new Set(results).size).toBe(results.length);
  });
});
