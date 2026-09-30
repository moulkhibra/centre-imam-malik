import type { Permission } from '@/lib/constants';
import type { ComponentType } from 'react';
import {
  IconAward,
  IconBell,
  IconBook,
  IconCalendar,
  IconCash,
  IconChart,
  IconCheck,
  IconClipboard,
  IconDashboard,
  IconDatabase,
  IconFolder,
  IconLayers,
  IconReceipt,
  IconSettings,
  IconShield,
  IconTeacher,
  IconUser,
  IconUsers,
  IconWallet,
} from '@/components/ui';

/**
 * Navigation manifest.
 *
 * Every entry carries the delivery phase that introduces its screen. The
 * sidebar only renders items whose phase is already shipped, so the application
 * never shows a link that leads to a "page not found".
 *
 * tests/unit/navigation.test.ts enforces the other direction of the contract:
 * an item that is visible must have a real page in the App Router.
 */
export type NavItem = {
  key: string;
  href: string;
  labelKey: string;
  icon: ComponentType<{ className?: string }>;
  /** null = visible to any authenticated user */
  permission: Permission | null;
  /** delivery phase that introduces this screen */
  phase: number;
};

export type NavSection = {
  key: string;
  labelKey: string | null;
  items: NavItem[];
};

/** Highest delivery phase currently implemented. Bumped by each phase. */
export const CURRENT_PHASE = 1;

export const NAV_SECTIONS: NavSection[] = [
  {
    key: 'main',
    labelKey: null,
    items: [
      { key: 'dashboard', href: '/dashboard', labelKey: 'nav.dashboard', icon: IconDashboard, permission: 'dashboard.view', phase: 1 },
    ],
  },
  {
    key: 'people',
    labelKey: 'nav.people',
    items: [
      { key: 'students', href: '/students', labelKey: 'nav.students', icon: IconUsers, permission: 'students.view', phase: 2 },
      { key: 'parents', href: '/parents', labelKey: 'nav.parents', icon: IconUser, permission: 'parents.view', phase: 2 },
      { key: 'teachers', href: '/teachers', labelKey: 'nav.teachers', icon: IconTeacher, permission: 'teachers.view', phase: 2 },
    ],
  },
  {
    key: 'academic',
    labelKey: 'nav.academic',
    items: [
      { key: 'groups', href: '/groups', labelKey: 'nav.groups', icon: IconLayers, permission: 'groups.view', phase: 3 },
      { key: 'registrations', href: '/registrations', labelKey: 'nav.registrations', icon: IconClipboard, permission: 'registrations.view', phase: 3 },
      { key: 'schedule', href: '/schedule', labelKey: 'nav.schedule', icon: IconCalendar, permission: 'schedules.view', phase: 3 },
      { key: 'attendance', href: '/attendance', labelKey: 'nav.attendance', icon: IconCheck, permission: 'attendance.view', phase: 4 },
      { key: 'academics', href: '/settings/academics', labelKey: 'nav.subjects', icon: IconBook, permission: 'academics.view', phase: 2 },
    ],
  },
  {
    key: 'finance',
    labelKey: 'nav.finance',
    items: [
      { key: 'payments', href: '/finance/payments', labelKey: 'nav.payments', icon: IconWallet, permission: 'finance.view', phase: 5 },
      { key: 'expenses', href: '/finance/expenses', labelKey: 'nav.expenses', icon: IconReceipt, permission: 'finance.view', phase: 5 },
      { key: 'cash', href: '/finance/cash-register', labelKey: 'nav.cashRegister', icon: IconCash, permission: 'finance.view', phase: 5 },
    ],
  },
  {
    key: 'education',
    labelKey: 'nav.evaluation',
    items: [
      { key: 'training', href: '/training', labelKey: 'nav.training', icon: IconAward, permission: 'training.view', phase: 6 },
      { key: 'exams', href: '/evaluation/exams', labelKey: 'nav.exams', icon: IconClipboard, permission: 'evaluation.view', phase: 7 },
      { key: 'certificates', href: '/certificates', labelKey: 'nav.certificates', icon: IconShield, permission: 'evaluation.view', phase: 8 },
      { key: 'documents', href: '/documents', labelKey: 'nav.documents', icon: IconFolder, permission: 'documents.view', phase: 8 },
      { key: 'reports', href: '/reports', labelKey: 'nav.reports', icon: IconChart, permission: 'reports.view', phase: 9 },
    ],
  },
  {
    key: 'admin',
    labelKey: 'nav.administration',
    items: [
      { key: 'notifications', href: '/notifications', labelKey: 'notifications.title', icon: IconBell, permission: 'notifications.view', phase: 10 },
      { key: 'users', href: '/admin/users', labelKey: 'nav.users', icon: IconUsers, permission: 'users.view', phase: 2 },
      { key: 'audit', href: '/admin/audit', labelKey: 'nav.auditLog', icon: IconDatabase, permission: 'audit.view', phase: 13 },
      { key: 'backup', href: '/admin/backup', labelKey: 'nav.backup', icon: IconDatabase, permission: 'backups.view', phase: 12 },
      { key: 'settings', href: '/settings', labelKey: 'nav.centerSettings', icon: IconSettings, permission: 'settings.view', phase: 2 },
    ],
  },
];

/** Sections and items that exist in the current build. */
export function visibleNavSections(phase: number = CURRENT_PHASE): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.phase <= phase),
  })).filter((section) => section.items.length > 0);
}

export function visibleNavItems(phase: number = CURRENT_PHASE): NavItem[] {
  return visibleNavSections(phase).flatMap((section) => section.items);
}

/**
 * True when the target screen ships in this build.
 *
 * Screens outside the navigation (for example a dashboard card linking to a
 * module list) use this to decide between rendering the link and rendering
 * plain text, so the interface never offers a dead end.
 */
export function isRouteAvailable(href: string, phase: number = CURRENT_PHASE): boolean {
  const path = href.split('?')[0] ?? href;
  return visibleNavItems(phase).some(
    (item) => path === item.href || path.startsWith(`${item.href}/`),
  );
}
