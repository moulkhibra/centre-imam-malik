import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CURRENT_PHASE, NAV_SECTIONS, isRouteAvailable, visibleNavItems, visibleNavSections } from '@/lib/navigation';
import { PERMISSIONS } from '@/lib/constants';

const APP_DIR = path.join(process.cwd(), 'src', 'app');

const IS_GROUP = (segment: string) => segment.startsWith('(') && segment.endsWith(')');

/**
 * Builds the URL of every page in the App Router, ignoring route groups.
 * Dynamic segments (`[id]`) are collected as `:param`.
 */
function collectRoutes(dir: string, prefix: string[] = []): string[] {
  const routes: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('@')) continue;
      routes.push(...collectRoutes(full, IS_GROUP(entry.name) ? prefix : [...prefix, entry.name]));
    } else if (entry.name === 'page.tsx') {
      routes.push(`/${prefix.join('/')}`);
    }
  }
  return routes;
}

/** `null` when the route does not exist, `'dynamic'` when it takes a param. */
function findPage(routes: string[], href: string): 'exact' | 'dynamic' | null {
  if (routes.includes(href)) return 'exact';
  const pattern = new RegExp(`^${href.replace(/:[^/]+/g, '[^/]+')}$`);
  return routes.some((route) => pattern.test(route)) ? 'dynamic' : null;
}

const ROUTES = collectRoutes(APP_DIR);

describe('navigation manifest', () => {
  it('only shows links whose screen exists in the current build', () => {
    const missing = visibleNavItems()
      .filter((item) => findPage(ROUTES, item.href) === null)
      .map((item) => `${item.key} -> ${item.href}`);
    expect(missing).toEqual([]);
  });

  it('points every visible link at a real page file', () => {
    for (const item of visibleNavItems()) {
      expect(findPage(ROUTES, item.href), `${item.key} -> ${item.href}`).not.toBeNull();
    }
  });

  it('defers every link that has no screen yet to a later phase', () => {
    for (const section of NAV_SECTIONS) {
      for (const item of section.items) {
        if (findPage(ROUTES, item.href) === null) {
          expect(item.phase, `${item.key} has no page and must declare a future phase`).toBeGreaterThan(CURRENT_PHASE);
        }
      }
    }
  });

  it('uses unique keys and hrefs', () => {
    const keys = NAV_SECTIONS.flatMap((section) => section.items.map((item) => item.key));
    const hrefs = NAV_SECTIONS.flatMap((section) => section.items.map((item) => item.href));
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('never uses a permission outside the declared vocabulary', () => {
    for (const section of NAV_SECTIONS) {
      for (const item of section.items) {
        expect(item.permission === null || PERMISSIONS.includes(item.permission)).toBe(true);
      }
    }
  });

  it('drops sections that have no visible item', () => {
    for (const section of visibleNavSections()) {
      expect(section.items.length).toBeGreaterThan(0);
    }
  });
});

/**
 * Phase 2 scope.
 *
 * These assertions pin down exactly what the phase delivered, and are meant to
 * be edited deliberately when the next phase starts: they fail loudly if a
 * screen is shipped without being wired into the sidebar, or if a deferred
 * screen becomes visible before its page exists.
 */
describe('phase 2 delivery', () => {
  const SHIPPED = [
    '/students',
    '/parents',
    '/teachers',
    '/settings/academics',
    '/settings/services',
    '/settings/rooms',
    // Phase 2B
    '/admin/users',
    '/settings',
  ];

  /** Deferred to the administration block: declared, but no screen yet. */
  const DEFERRED = ['/admin/audit', '/admin/backup'];

  it('marks phase 2 as implemented', () => {
    expect(CURRENT_PHASE).toBe(2);
  });

  it('exposes every Phase 2 screen in the sidebar', () => {
    const visible = visibleNavItems().map((item) => item.href);
    for (const href of SHIPPED) expect(visible, `${href} must be reachable`).toContain(href);
  });

  it('keeps the deferred administration screens out', () => {
    // The audit log and the backup screen are declared but have no page; they stay
    // invisible until one does, which the route-existence tests above enforce.
    const visible = visibleNavItems().map((item) => item.href);
    for (const href of DEFERRED) expect(visible, `${href} has no page yet`).not.toContain(href);
  });

  it('never shows a Phase 3+ screen', () => {
    for (const item of visibleNavItems()) {
      expect(item.phase, `${item.key} is a future phase`).toBeLessThanOrEqual(CURRENT_PHASE);
    }
  });

  it('reports the shipped screens as available to the dashboard', () => {
    for (const href of SHIPPED) expect(isRouteAvailable(href)).toBe(true);
    for (const href of DEFERRED) expect(isRouteAvailable(href)).toBe(false);
  });

  it('does not report an undeclared path under a visible route as available', () => {
    // `/settings` is both a screen of its own and the parent of the three
    // catalogue screens. The catalogue entries answer for themselves, and nothing
    // else under `/settings` may be reported as shipped.
    expect(isRouteAvailable('/settings/academics')).toBe(true);
    expect(isRouteAvailable('/settings/unknown')).toBe(false);
    expect(isRouteAvailable('/admin/users/unknown')).toBe(false);
    expect(isRouteAvailable('/admin/audit')).toBe(false);
  });

  it('groups the catalogue under one section', () => {
    const catalog = visibleNavSections().find((section) => section.key === 'catalog');
    expect(catalog?.items.map((item) => item.href)).toEqual([
      '/settings/academics',
      '/settings/services',
      '/settings/rooms',
    ]);
  });
});
