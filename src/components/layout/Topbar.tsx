'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTransition } from 'react';
import { LOCALE_COOKIE, type Locale } from '@/lib/i18n';
import { IconBell, IconGlobe, IconLogout, Spinner } from '@/components/ui';
import { initials } from '@/lib/utils/format';

export type TopbarLabels = {
  search: string;
  notifications: string;
  language: string;
  logout: string;
  account: string;
  switchTo: string;
  menu: string;
};

function setLocaleCookie(locale: Locale) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${maxAge}; samesite=lax`;
}

function LocaleSwitcher({ locale, labels }: { locale: Locale; labels: TopbarLabels }) {
  const [pending, startTransition] = useTransition();
  const pathname = usePathname();
  const next: Locale = locale === 'fr' ? 'ar' : 'fr';

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setLocaleCookie(next);
        startTransition(() => {
          window.location.href = pathname;
        });
      }}
      title={`${labels.switchTo}: ${next === 'fr' ? 'Français' : 'العربية'}`}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink-300 px-2.5 text-xs font-medium text-ink-700 hover:bg-ink-100 disabled:opacity-60"
    >
      {pending ? <Spinner className="size-3.5" /> : <IconGlobe className="size-4" />}
      <span className="uppercase">{next}</span>
      <span className="sr-only">{labels.language}</span>
    </button>
  );
}

export function Topbar({
  user,
  locale,
  labels,
  centerName,
  unreadNotifications,
  notificationsReady,
  logoutAction,
  onMenuClick,
}: {
  user: { firstName: string; lastName: string; email: string; roleLabel: string };
  locale: Locale;
  labels: TopbarLabels;
  centerName: string;
  unreadNotifications: number;
  /** false while the notifications screen is not part of the build */
  notificationsReady: boolean;
  logoutAction: () => Promise<void>;
  onMenuClick: () => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-ink-200 bg-white/95 px-4 backdrop-blur">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label={labels.menu ?? 'Menu'}
        className="rounded-lg p-2 text-ink-700 hover:bg-ink-100 lg:hidden"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <Link href="/dashboard" className="text-sm font-semibold text-ink-900 hover:underline lg:hidden">
        {centerName}
      </Link>

      <div className="flex-1" />

      <LocaleSwitcher locale={locale} labels={labels} />

      {/* Until the notifications screen ships, the bell reports the count but
          does not pretend to be a link. */}
      {notificationsReady ? (
        <Link
          href="/notifications"
          className="relative inline-flex size-9 items-center justify-center rounded-lg text-ink-700 hover:bg-ink-100"
          aria-label={labels.notifications}
        >
          <IconBell className="size-[18px]" />
          {unreadNotifications > 0 ? (
            <span className="absolute -top-0.5 end-0.5 flex min-w-4 items-center justify-center rounded-full bg-danger-600 px-1 text-[10px] font-bold text-white">
              {unreadNotifications > 99 ? '99+' : unreadNotifications}
            </span>
          ) : null}
        </Link>
      ) : (
        <span
          className="relative inline-flex size-9 items-center justify-center rounded-lg text-ink-400"
          title={labels.notifications}
          aria-label={`${labels.notifications}${unreadNotifications > 0 ? ` (${unreadNotifications})` : ''}`}
        >
          <IconBell className="size-[18px]" />
          {unreadNotifications > 0 ? (
            <span className="absolute -top-0.5 end-0.5 flex min-w-4 items-center justify-center rounded-full bg-danger-600 px-1 text-[10px] font-bold text-white">
              {unreadNotifications > 99 ? '99+' : unreadNotifications}
            </span>
          ) : null}
        </span>
      )}

      <Link
        href="/account/password"
        className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-ink-100"
        title={labels.account}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-semibold text-white">
          {initials(user.firstName, user.lastName)}
        </span>
        <span className="hidden min-w-0 text-start sm:block">
          <span className="block truncate text-xs font-medium text-ink-900">
            {user.firstName} {user.lastName}
          </span>
          <span className="block truncate text-[11px] text-ink-500">{user.roleLabel}</span>
        </span>
      </Link>

      <form
        action={() => {
          startTransition(async () => {
            await logoutAction();
          });
        }}
      >
        <button
          type="submit"
          disabled={pending}
          className="inline-flex size-9 items-center justify-center rounded-lg text-ink-700 hover:bg-ink-100 disabled:opacity-60"
          aria-label={labels.logout}
          title={labels.logout}
        >
          {pending ? <Spinner className="size-4" /> : <IconLogout className="size-[18px]" />}
        </button>
      </form>
    </header>
  );
}
