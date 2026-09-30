'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { visibleNavSections, type NavSection } from '@/lib/navigation';
import type { Permission } from '@/lib/constants';
import { IconBell, IconGlobe, IconMenu } from '@/components/ui';

export type SidebarLabels = Record<string, string>;

export function Sidebar({
  labels,
  permissions,
  open,
  onClose,
  centerName,
}: {
  labels: SidebarLabels;
  permissions: readonly Permission[];
  open: boolean;
  onClose: () => void;
  centerName: string;
}) {
  const pathname = usePathname();
  const allowed = new Set<string>(permissions);

  return (
    <>
      {open ? <div className="fixed inset-0 z-30 bg-ink-900/40 lg:hidden" onClick={onClose} aria-hidden="true" /> : null}

      <aside
        className={cn(
          'fixed inset-y-0 start-0 z-40 flex w-64 flex-col border-e border-ink-200 bg-white',
          'transition-transform lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full',
        )}
        aria-label="Navigation principale"
      >
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-ink-200 px-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
            IM
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-900" title={centerName}>
              {centerName}
            </p>
            <p className="truncate text-[11px] text-ink-500">Gestion du centre</p>
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

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Ouvrir le menu"
      className="rounded-lg p-2 text-ink-700 hover:bg-ink-100 lg:hidden"
    >
      <IconMenu className="size-5" />
    </button>
  );
}

export { IconBell, IconGlobe };
