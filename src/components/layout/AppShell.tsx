'use client';

import { useState, type ReactNode } from 'react';
import { Sidebar, type SidebarLabels } from './Sidebar';
import { Topbar, type TopbarLabels } from './Topbar';
import type { Permission, Locale } from '@/lib/constants';

export type AppShellLabels = {
  nav: SidebarLabels;
  topbar: TopbarLabels;
};

export function AppShell({
  children,
  labels,
  user,
  locale,
  permissions,
  centerName,
  unreadNotifications,
  notificationsReady,
  logoutAction,
}: {
  children: ReactNode;
  labels: AppShellLabels;
  user: { firstName: string; lastName: string; email: string; roleLabel: string };
  locale: Locale;
  permissions: readonly Permission[];
  centerName: string;
  unreadNotifications: number;
  notificationsReady: boolean;
  logoutAction: () => Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar
        labels={labels.nav}
        permissions={permissions}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        centerName={centerName}
      />

      <div className="lg:ps-64">
        <Topbar
          user={user}
          locale={locale}
          labels={labels.topbar}
          centerName={centerName}
          unreadNotifications={unreadNotifications}
          notificationsReady={notificationsReady}
          logoutAction={logoutAction}
          onMenuClick={() => setMenuOpen(true)}
        />
        <main className="px-4 py-5 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
