'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { visibleNavSections, type NavSection } from '@/lib/navigation';
import type { Permission } from '@/lib/constants';
import { IconBell, IconGlobe } from '@/components/ui';

export type SidebarLabels = Record<string, string>;

export function Sidebar({
  labels,
  permissions,
  open,
  onClose,
  centerName,
  centerLogoUrl,
  shellLabels,
}: {
  labels: SidebarLabels;
  permissions: readonly Permission[];
  open: boolean;
  onClose: () => void;
  /** Short name, already resolved by the layout. */
  centerName: string;
  centerLogoUrl: string | null;
  /** UI chrome strings that must follow the interface language. */
  shellLabels: SidebarLabels;
}) {
  const pathname = usePathname();
  const allowed = new Set<string>(permissions);

  // Initials of the centre name, so the badge follows what the centre typed
  // instead of two hardcoded letters that only suited the seed name.
  const initials = centerName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');

  return (
    <>
      {open ? <div className="fixed inset-0 z-30 bg-ink-900/40 lg:hidden" onClick={onClose} aria-hidden="true" /> : null}

      <aside
        className={cn(
          'fixed inset-y-0 start-0 z-40 flex w-64 flex-col border-e border-ink-200 bg-white',
          'transition-transform motion-reduce:transition-none',
          // The drawer transform must exist ONLY below `lg`.
          //
          // It used to be written as `-translate-x-full rtl:translate-x-full`
          // with `lg:translate-x-0` to pin the sidebar on desktop. That does not
          // work: Tailwind emits the `rtl:` variant AFTER responsive variants,
          // so in Arabic `rtl:translate-x-full` beat `lg:translate-x-0` at every
          // width. The sidebar was pushed off-screen while the shell kept its
          // `lg:ps-64`, leaving a blank band the width of the sidebar.
          //
          // Scoping the closed state to `max-lg:` removes the conflict instead of
          // trying to out-order it: above `lg` no transform class applies at all,
          // so the sidebar simply renders in place. Below `lg` the direction
          // variant is free to pick the side it slides out towards.
          open ? 'translate-x-0' : 'max-lg:-translate-x-full max-lg:rtl:translate-x-full',
        )}
        aria-label={shellLabels.mainNavigation ?? 'Navigation principale'}
      >
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-ink-200 px-4">
          {centerLogoUrl ? (
            // `alt=""`: the centre name sits right next to it, so announcing the
            // image too would read the name twice.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={centerLogoUrl} alt="" className="size-8 shrink-0 rounded-lg object-contain" />
          ) : (
            <div
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white"
            >
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-900" title={centerName}>
              {centerName}
            </p>
            <p className="truncate text-[11px] text-ink-500">
              {shellLabels.centreManagement ?? 'Gestion du centre'}
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {visibleNavSections().map((section: NavSection) => {
            const items = section.items.filter((item) => item.permission === null || allowed.has(item.permission));
            if (items.length === 0) return null;

            return (
              <div key={section.key} className="mb-4 last:mb-0">
                {section.labelKey ? (
                  <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                    {labels[section.labelKey] ?? section.labelKey}
                  </p>
                ) : null}
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const Icon = item.icon;
                    return (
                      <li key={item.key}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                            active
                              ? 'bg-brand-50 font-semibold text-brand-700'
                              : 'text-ink-700 hover:bg-ink-100',
                          )}
                        >
                          <Icon className={cn('size-[18px] shrink-0', active ? 'text-brand-600' : 'text-ink-500')} />
                          <span className="truncate">{labels[item.labelKey] ?? item.labelKey}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

export { IconBell, IconGlobe };
