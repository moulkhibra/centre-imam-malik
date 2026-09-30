import '@/lib/utils/server-only';
import { prisma } from '@/lib/db/client';
import { DEFAULT_LOCALE, ATTENDANCE_STATUSES } from '@/lib/constants';

export type DashboardStats = {
  totalStudents: number;
  activeStudents: number;
  newRegistrationsThisMonth: number;
  teachers: number;
  activeGroups: number;
  todayClasses: number;
  todayPresent: number;
  todayAbsent: number;
  todayLate: number;
  todayExcused: number;
  todayTotalRecords: number;
  unpaidBalanceCents: number;
  todayRevenueCents: number;
  monthRevenueCents: number;
  activeTrainings: number;
};

export type RevenuePoint = { month: number; year: number; totalCents: number };
export type RegistrationPoint = { month: number; year: number; count: number };
export type LevelCount = { label: string; count: number };
export type SubjectCount = { label: string; count: number };
export type MethodCount = { label: string; totalCents: number };
export type AttendancePoint = { month: number; year: number; rate: number };

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function monthKeys(count: number, now: Date): { month: number; year: number }[] {
  const out: { month: number; year: number }[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ month: d.getMonth() + 1, year: d.getFullYear() });
  }
  return out;
}

/**
 * Aggregated dashboard metrics.
 *
 * Every figure is computed from a SQL aggregate on the live database. When a
 * production install has no data yet the counters are simply zero - no sample
 * or placeholder numbers are ever returned.
 */
export async function getDashboardStats(centerId: string, now = new Date()): Promise<DashboardStats> {
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [
    totalStudents,
    activeStudents,
    newRegistrationsThisMonth,
    teachers,
    activeGroups,
    todaySessions,
    todayAttendanceGroups,
    unpaidAgg,
    todayRevenueAgg,
    monthRevenueAgg,
    activeTrainings,
  ] = await Promise.all([
    prisma.student.count({ where: { centerId, deletedAt: null } }),
    prisma.student.count({ where: { centerId, deletedAt: null, status: 'ACTIVE' } }),
    prisma.registration.count({
      where: { centerId, deletedAt: null, startDate: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.teacher.count({ where: { centerId, deletedAt: null, status: 'ACTIVE' } }),
    prisma.group.count({ where: { centerId, deletedAt: null, status: 'ACTIVE' } }),
    prisma.session_Attendance.count({
      where: { centerId, date: { gte: dayStart, lte: dayEnd }, status: { not: 'CANCELLED' } },
    }),
    prisma.attendanceRecord.groupBy({
      by: ['status'],
      where: {
        session: { centerId, date: { gte: dayStart, lte: dayEnd } },
      },
      _count: { _all: true },
    }),
    // Unpaid balance = sum over active registrations of (final price - paid).
    prisma.$queryRaw<{ total: number | null }[]>`
      SELECT SUM(remaining) AS total FROM (
        SELECT
          r.id,
          r."finalPriceCents"
            - COALESCE((
                SELECT SUM(p."amountCents")
                FROM "Payment" p
                WHERE p."registrationId" = r.id
                  AND p.kind = 'PAYMENT'
                  AND p."reversedAt" IS NULL
                  AND p."deletedAt" IS NULL
              ), 0) AS remaining
        FROM "Registration" r
        WHERE r."centerId" = ${centerId}
          AND r."deletedAt" IS NULL
          AND r.status IN ('ACTIVE', 'PENDING')
      ) WHERE remaining > 0
    `,
    prisma.payment.aggregate({
      where: {
        centerId,
        kind: 'PAYMENT',
        reversedAt: null,
        deletedAt: null,
        paidAt: { gte: dayStart, lte: dayEnd },
      },
      _sum: { amountCents: true },
    }),
    prisma.payment.aggregate({
      where: {
        centerId,
        kind: 'PAYMENT',
        reversedAt: null,
        deletedAt: null,
        paidAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amountCents: true },
    }),
    prisma.trainingProgram.count({
      where: { centerId, deletedAt: null, status: { in: ['PLANNED', 'ONGOING'] } },
    }),
  ]);

  const attendanceMap = new Map<string, number>(
    todayAttendanceGroups.map((g) => [g.status, g._count._all]),
  );
  const count = (status: string) => attendanceMap.get(status) ?? 0;

  return {
    totalStudents,
    activeStudents,
    newRegistrationsThisMonth,
    teachers,
    activeGroups,
    todayClasses: todaySessions,
    todayPresent: count('PRESENT'),
    todayAbsent: count('ABSENT'),
    todayLate: count('LATE'),
    todayExcused: count('EXCUSED'),
    todayTotalRecords: [...attendanceMap.values()].reduce((a, b) => a + b, 0),
    unpaidBalanceCents: Math.max(0, Number(unpaidAgg[0]?.total ?? 0)),
    todayRevenueCents: todayRevenueAgg._sum.amountCents ?? 0,
    monthRevenueCents: monthRevenueAgg._sum.amountCents ?? 0,
    activeTrainings,
  };
}

export async function getRevenueSeries(centerId: string, months = 12, now = new Date()): Promise<RevenuePoint[]> {
  const keys = monthKeys(months, now);
  const from = new Date(keys[0]!.year, keys[0]!.month - 1, 1);

  const rows = await prisma.payment.findMany({
    where: {
      centerId,
      kind: 'PAYMENT',
      reversedAt: null,
      deletedAt: null,
      paidAt: { gte: from },
    },
    select: { amountCents: true, paidAt: true },
  });

  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.paidAt.getFullYear()}-${row.paidAt.getMonth() + 1}`;
    totals.set(key, (totals.get(key) ?? 0) + row.amountCents);
  }

  return keys.map(({ month, year }) => ({
    month,
    year,
    totalCents: totals.get(`${year}-${month}`) ?? 0,
  }));
}

export async function getRegistrationSeries(centerId: string, months = 12, now = new Date()): Promise<RegistrationPoint[]> {
  const keys = monthKeys(months, now);
  const from = new Date(keys[0]!.year, keys[0]!.month - 1, 1);

  const rows = await prisma.registration.findMany({
    where: { centerId, deletedAt: null, startDate: { gte: from } },
    select: { startDate: true },
  });

  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.startDate.getFullYear()}-${row.startDate.getMonth() + 1}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return keys.map(({ month, year }) => ({ month, year, count: counts.get(`${year}-${month}`) ?? 0 }));
}

export async function getAttendanceSeries(centerId: string, months = 6, now = new Date()): Promise<AttendancePoint[]> {
  const keys = monthKeys(months, now);

  // Only status + date are read, so the series costs a single narrow scan
  // instead of grouping and then re-reading the same rows.
  const detailed = await prisma.attendanceRecord.findMany({
    where: { session: { centerId }, status: { in: [...ATTENDANCE_STATUSES] } },
    select: { status: true, session: { select: { date: true } } },
  });

  const totals = new Map<string, { present: number; total: number }>();
  for (const row of detailed) {
    const date = row.session.date;
    const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
    const entry = totals.get(key) ?? { present: 0, total: 0 };
    entry.total += 1;
    if (row.status === 'PRESENT' || row.status === 'LATE') entry.present += 1;
    totals.set(key, entry);
  }

  return keys.map(({ month, year }) => {
    const entry = totals.get(`${year}-${month}`);
    return {
      month,
      year,
      rate: entry && entry.total > 0 ? Math.round((entry.present / entry.total) * 1000) / 10 : 0,
    };
  });
}

export async function getStudentsByLevel(centerId: string, limit = 8): Promise<LevelCount[]> {
  const rows = await prisma.academicLevel.findMany({
    where: { centerId, active: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: {
        select: {
          students: { where: { deletedAt: null } },
        },
      },
    },
  });

  return rows
    .map((level) => ({ label: level.nameFr, count: level._count.students }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function getStudentsBySubject(centerId: string, limit = 8): Promise<SubjectCount[]> {
  const rows = await prisma.group.findMany({
    where: { centerId, deletedAt: null, status: 'ACTIVE', subjectId: { not: null } },
    select: {
      subjectId: true,
      _count: { select: { students: { where: { status: 'ACTIVE' } } } },
    },
  });

  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!row.subjectId) continue;
    totals.set(row.subjectId, (totals.get(row.subjectId) ?? 0) + row._count.students);
  }

  if (totals.size === 0) return [];

  const subjects = await prisma.subject.findMany({
    where: { id: { in: [...totals.keys()] } },
    select: { id: true, nameFr: true },
  });
  const nameById = new Map(subjects.map((s) => [s.id, s.nameFr]));

  return [...totals.entries()]
    .map(([id, count]) => ({ label: nameById.get(id) ?? id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function getRevenueByMethod(centerId: string, now = new Date()): Promise<MethodCount[]> {
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const rows = await prisma.payment.findMany({
    where: {
      centerId,
      kind: 'PAYMENT',
      reversedAt: null,
      deletedAt: null,
      paidAt: { gte: from },
    },
    select: { methodId: true, amountCents: true },
  });

  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = row.methodId ?? 'UNKNOWN';
    totals.set(key, (totals.get(key) ?? 0) + row.amountCents);
  }
  if (totals.size === 0) return [];

  const methods = await prisma.paymentMethod.findMany({
    where: { centerId, id: { in: [...totals.keys()] } },
    select: { id: true, nameFr: true },
  });
  const nameById = new Map(methods.map((m) => [m.id, m.nameFr]));

  return [...totals.entries()]
    .map(([id, totalCents]) => ({ label: nameById.get(id) ?? '—', totalCents }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

export async function getRecentNotifications(centerId: string, limit = 6) {
  return prisma.notification.findMany({
    where: { centerId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, titleFr: true, titleAr: true, severity: true, createdAt: true, link: true },
  });
}

export { DEFAULT_LOCALE };
