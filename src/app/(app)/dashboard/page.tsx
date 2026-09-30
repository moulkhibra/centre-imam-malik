import Link from 'next/link';
import { requireUser } from '@/lib/auth/permissions';
import { createTranslator, getLocaleFromCookies } from '@/lib/i18n';
import { getActiveCenter } from '@/lib/settings/center';
import { formatDate, formatMad } from '@/lib/utils/format';
import { ATTENDANCE_STATUSES } from '@/lib/constants';
import {
  getAttendanceSeries,
  getDashboardStats,
  getRecentNotifications,
  getRegistrationSeries,
  getRevenueByMethod,
  getRevenueSeries,
  getStudentsByLevel,
  getStudentsBySubject,
} from '@/lib/dashboard/queries';
import { Card, CardHeader, PageHeader, Badge, EmptyState } from '@/components/ui';
import {
  AttendanceLineChart,
  DistributionPieChart,
  RegistrationsLineChart,
  RevenueBarChart,
  StatCard,
} from '@/components/dashboard/Charts';
import {
  IconAward,
  IconCash,
  IconCheck,
  IconClipboard,
  IconLayers,
  IconTeacher,
  IconUsers,
  IconWallet,
} from '@/components/ui';
import { NOTIFICATION_TONE } from '@/lib/notifications/tones';
import { isRouteAvailable } from '@/lib/navigation';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await requireUser();
  const [locale, center] = await Promise.all([getLocaleFromCookies(), getActiveCenter()]);
  const t = createTranslator(locale);

  // A card only becomes a link once its target screen ships: the interface must
  // never offer a dead end.
  const link = (href: string): string | undefined => (isRouteAvailable(href) ? href : undefined);
  const studentsReady = isRouteAvailable('/students');

  const centerId = user.centerId;
  const now = new Date();

  const [stats, revenue, registrations, attendance, byLevel, bySubject, byMethod, recent] = await Promise.all([
    getDashboardStats(centerId, now),
    getRevenueSeries(centerId, 12, now),
    getRegistrationSeries(centerId, 12, now),
    getAttendanceSeries(centerId, 6, now),
    getStudentsByLevel(centerId),
    getStudentsBySubject(centerId),
    getRevenueByMethod(centerId, now),
    getRecentNotifications(centerId, 5),
  ]);

  const attendanceRate =
    stats.todayTotalRecords > 0
      ? Math.round(((stats.todayPresent + stats.todayLate) / stats.todayTotalRecords) * 1000) / 10
      : 0;

  const levelChart = byLevel.map((r) => ({ label: r.label, value: r.count }));
  const subjectChart = bySubject.map((r) => ({ label: r.label, value: r.count }));
  const methodChart = byMethod.map((r) => ({ label: r.label, value: Math.round(r.totalCents / 100) }));

  const isEmptyInstall =
    stats.totalStudents === 0 && stats.teachers === 0 && stats.activeGroups === 0 && stats.monthRevenueCents === 0;

  return (
    <>
      <PageHeader
        title={t('dashboard.title')}
        description={t('dashboard.welcome', { name: `${user.firstName} ${user.lastName}` })}
        actions={
          center?.currentAcademicYearLabel ? (
            <Badge tone="brand">{center.currentAcademicYearLabel}</Badge>
          ) : undefined
        }
      />

      {isEmptyInstall ? (
        <Card className="mb-4 border-brand-600/30 bg-brand-50/40">
          <div className="p-4">
            <p className="text-sm font-semibold text-brand-700">{t('dashboard.noActivity')}</p>
            <p className="mt-1 text-sm text-ink-700">
              {locale === 'ar'
                ? 'لم يتم تسجيل أي طالب أو أستاذ أو عملية مالية بعد. ابدأ بإضافة أول تلميذ أو استورد ملف إكسل.'
                : 'Aucun élève, enseignant ou mouvement financier n\'a encore été enregistré. Commencez par ajouter un élève ou importer un fichier Excel.'}
            </p>
            {studentsReady ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/students"
                  className="inline-flex h-9 items-center rounded-lg bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700"
                >
                  {t('student.new')}
                </Link>
                <Link
                  href="/students/import"
                  className="inline-flex h-9 items-center rounded-lg border border-ink-300 bg-white px-3 text-sm font-medium text-ink-700 hover:bg-ink-100"
                >
                  {t('student.importExcel')}
                </Link>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard label={t('dashboard.totalStudents')} value={String(stats.totalStudents)} icon={<IconUsers className="size-4" />} href={link("/students")} />
        <StatCard label={t('dashboard.activeStudents')} value={String(stats.activeStudents)} tone="success" icon={<IconCheck className="size-4" />} href={link("/students?status=ACTIVE")} />
        <StatCard label={t('dashboard.newRegistrations')} value={String(stats.newRegistrationsThisMonth)} tone="info" icon={<IconClipboard className="size-4" />} href={link("/registrations")} />
        <StatCard label={t('dashboard.teachers')} value={String(stats.teachers)} icon={<IconTeacher className="size-4" />} href={link("/teachers")} />
        <StatCard label={t('dashboard.groups')} value={String(stats.activeGroups)} icon={<IconLayers className="size-4" />} href={link("/groups")} />
        <StatCard label={t('dashboard.activeTrainings')} value={String(stats.activeTrainings)} icon={<IconAward className="size-4" />} href={link("/training")} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label={t('dashboard.todayClasses')} value={String(stats.todayClasses)} icon={<IconClipboard className="size-4" />} href={link("/schedule?view=day")} />
        <StatCard label={t('dashboard.todayAttendance')} value={`${attendanceRate}%`} tone={attendanceRate >= 75 ? 'success' : 'warning'} sublabel={`${t('dashboard.absences')}: ${stats.todayAbsent}`} />
        <StatCard label={t('dashboard.absences')} value={String(stats.todayAbsent)} tone="danger" sublabel={`${t('attendance.late')}: ${stats.todayLate}`} />
        <StatCard label={t('dashboard.unpaidBalance')} value={formatMad(stats.unpaidBalanceCents, locale)} tone="warning" href={link("/finance/payments?filter=unpaid")} />
        <StatCard label={t('dashboard.todayRevenue')} value={formatMad(stats.todayRevenueCents, locale)} tone="success" icon={<IconWallet className="size-4" />} href={link("/finance/payments")} />
        <StatCard label={t('dashboard.monthlyRevenue')} value={formatMad(stats.monthRevenueCents, locale)} tone="brand" icon={<IconCash className="size-4" />} href={link("/finance/payments")} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('dashboard.revenueByMonth')} description={locale === 'ar' ? 'آخر 12 شهرا' : '12 derniers mois'} />
          <div className="p-3">
            <RevenueBarChart data={revenue} locale={locale} empty={t('common.noData')} />
          </div>
        </Card>

        <Card>
          <CardHeader title={t('dashboard.registrationsTrend')} description={locale === 'ar' ? 'آخر 12 شهرا' : '12 derniers mois'} />
          <div className="p-3">
            <RegistrationsLineChart data={registrations} locale={locale} empty={t('common.noData')} />
          </div>
        </Card>

        <Card>
          <CardHeader title={t('dashboard.attendanceRate')} description={locale === 'ar' ? 'آخر 6 أشهر' : '6 derniers mois'} />
          <div className="p-3">
            <AttendanceLineChart data={attendance} locale={locale} empty={t('common.noData')} />
          </div>
        </Card>

        <Card>
          <CardHeader
            title={t('dashboard.paymentMethods')}
            description={locale === 'ar' ? 'الشهر الجاري' : 'Mois en cours'}
            actions={<Badge tone="info">{methodChart.length}</Badge>}
          />
          <div className="p-3">
            {methodChart.length > 0 ? (
              <DistributionPieChart data={methodChart} empty={t('common.noData')} centerLabel="DH" />
            ) : (
              <EmptyState title={t('common.noData')} />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title={t('dashboard.studentsByLevel')} />
          <div className="p-3">
            {levelChart.length > 0 ? (
              <DistributionPieChart data={levelChart} empty={t('common.noData')} centerLabel={t('student.title')} />
            ) : (
              <EmptyState title={t('common.noData')} />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title={t('dashboard.studentsBySubject')} />
          <div className="p-3">
            {subjectChart.length > 0 ? (
              <DistributionPieChart data={subjectChart} empty={t('common.noData')} centerLabel={t('student.title')} />
            ) : (
              <EmptyState title={t('common.noData')} />
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={t('notifications.title')}
            actions={
              link('/notifications') ? (
                <Link href="/notifications" className="text-xs font-medium text-brand-700 hover:underline">
                  {t('common.view')}
                </Link>
              ) : undefined
            }
          />
          {recent.length === 0 ? (
            <EmptyState title={t('common.noData')} />
          ) : (
            <ul className="divide-y divide-ink-100">
              {recent.map((n) => (
                <li key={n.id} className="flex items-start gap-3 px-4 py-2.5">
                  <Badge tone={NOTIFICATION_TONE[n.severity as keyof typeof NOTIFICATION_TONE] ?? 'info'}>
                    {n.severity}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <Link href={n.link ?? '/notifications'} className="block truncate text-sm text-ink-900 hover:underline">
                      {locale === 'ar' ? (n.titleAr ?? n.titleFr) : n.titleFr}
                    </Link>
                    <p className="text-[11px] text-ink-500">{formatDate(n.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title={t('dashboard.todayAttendance')} />
          {stats.todayTotalRecords === 0 ? (
            <EmptyState title={t('common.noData')} description={t('schedule.noClasses')} />
          ) : (
            <ul className="divide-y divide-ink-100">
              {ATTENDANCE_STATUSES.map((status) => {
                const counts: Record<string, number> = {
                  PRESENT: stats.todayPresent,
                  ABSENT: stats.todayAbsent,
                  LATE: stats.todayLate,
                  EXCUSED: stats.todayExcused,
                };
                const value = counts[status] ?? 0;
                const pct = stats.todayTotalRecords > 0 ? Math.round((value / stats.todayTotalRecords) * 100) : 0;
                return (
                  <li key={status} className="px-4 py-2.5">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-ink-700">{t(`attendance.${status.toLowerCase()}`)}</span>
                      <span className="num font-medium text-ink-900">
                        {value} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                      <div
                        className="h-full rounded-full bg-brand-600"
                        style={{ width: `${pct}%` }}
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
