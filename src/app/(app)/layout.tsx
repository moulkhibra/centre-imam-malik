import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/permissions';
import { prisma } from '@/lib/db/client';
import { createTranslator, getLocaleFromCookies } from '@/lib/i18n';
import { getActiveCenter } from '@/lib/settings/center';
import { ROLE_LABELS, type Role } from '@/lib/constants';
import { isRouteAvailable, visibleNavSections } from '@/lib/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { logoutAction } from '@/actions/auth';

export const dynamic = 'force-dynamic';

/**
 * Authenticated application shell.
 *
 * Authorization is enforced here AND on every Server Action / route handler;
 * this layout is a convenience boundary, not the security boundary.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  // A user flagged mustChangePassword cannot use the application until the
  // installer-provided password has been replaced.
  if (user.mustChangePassword) {
    redirect('/account/password');
  }

  const [locale, center] = await Promise.all([getLocaleFromCookies(), getActiveCenter()]);
  const t = createTranslator(locale);

  // Resolve every navigation label the sidebar needs in one pass.
  const nav: Record<string, string> = {};
  for (const section of visibleNavSections()) {
    if (section.labelKey) nav[section.labelKey] = t(section.labelKey);
    for (const item of section.items) nav[item.labelKey] = t(item.labelKey);
  }

  const unreadNotifications = await prisma.notification.count({
    where: { centerId: user.centerId, userId: user.id, readAt: null },
  });

  return (
    <AppShell
      labels={{
        nav,
        topbar: {
          search: t('common.search'),
          notifications: t('notifications.title'),
          language: t('common.language'),
          logout: t('common.logout'),
          account: t('common.profile'),
          switchTo: t('common.language'),
          menu: t('common.menu'),
        },
        shell: {
          mainNavigation: t('common.mainNavigation'),
          openMenu: t('common.openMenu'),
          centreManagement: t('common.centreManagement'),
        },
      }}
      user={{
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        roleLabel: ROLE_LABELS[user.role as Role][locale],
      }}
      locale={locale}
      permissions={user.permissions}
      centerName={(locale === 'ar' ? center?.nameAr : center?.nameFr) ?? center?.nameFr ?? 'Centre Imam Malik'}
      unreadNotifications={unreadNotifications}
      notificationsReady={isRouteAvailable('/notifications')}
      logoutAction={logoutAction}
    >
      {children}
    </AppShell>
  );
}
