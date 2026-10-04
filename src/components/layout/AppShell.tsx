'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Sidebar, type SidebarLabels } from './Sidebar';
import { Topbar, type TopbarLabels } from './Topbar';
import type { Permission, Locale } from '@/lib/constants';

export type AppShellLabels = {
  nav: SidebarLabels;
  topbar: TopbarLabels;
  /** Interface chrome (navigation landmarks, menu button) in the active language. */
  shell: SidebarLabels;
};

export function AppShell({
  children,
  labels,
  user,
  locale,
  permissions,
  centerName,
  centerShortName,
  centerLogoUrl,
  unreadNotifications,
  notificationsReady,
  logoutAction,
}: {
  children: ReactNode;
  labels: AppShellLabels;
  user: { firstName: string; lastName: string; email: string; roleLabel: string };
  locale: Locale;
  permissions: readonly Permission[];
  /** Full name: documents, page titles, anything with room for it. */
  centerName: string;
  /** Short name for the sidebar, falling back to `centerName`. */
  centerShortName: string;
  /** Public path of the centre logo, or null when none is configured. */
  centerLogoUrl: string | null;
  unreadNotifications: number;
  notificationsReady: boolean;
  logoutAction: () => Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  // The drawer covers the content, so Escape has to dismiss it: without this a
  // keyboard user can open the menu and then cannot close it.
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar
        labels={labels.nav}
        permissions={permissions}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        centerName={centerShortName}
        centerLogoUrl={centerLogoUrl}
        shellLabels={labels.shell}
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
