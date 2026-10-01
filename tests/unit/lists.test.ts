import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ariaSortFor, listHref, listQuery, nextSort, pageInfo } from '@/lib/lists';

/**
 * List plumbing shared by every Phase 2 screen.
 *
 * Two properties are load-bearing and easy to break:
 *  - a hand-edited URL never throws (the screens must render, not 500);
 *  - `listHref` is the single place that rebuilds a list URL, so a lost
 *    parameter silently drops the state a user had chosen.
 */
describe('listQuery', () => {
  const list = listQuery({
    sortFields: ['code', 'lastName'] as const,
    defaultSort: 'lastName',
    filters: z.object({ active: z.string().default('ALL') }),
  });

  it('falls back to the defaults on an empty or hostile query', () => {
    expect(list.parse({})).toMatchObject({ page: 1, pageSize: 25, q: '', sort: 'lastName', dir: 'asc' });
    expect(list.parse(undefined)).toMatchObject({ page: 1, sort: 'lastName' });
    expect(list.parse({ page: 'abc', pageSize: 'many', dir: 'sideways' })).toMatchObject({
      page: 1,
      pageSize: 25,
      dir: 'asc',
    });
  });

  it('drops a sort key that is not whitelisted instead of passing it to Prisma', () => {
    // An unknown column reaching `orderBy` would be an injection vector, not a
    // cosmetic bug: this is the reason the whitelist exists.
    expect(list.parse({ sort: 'firstName); DROP TABLE Student;--' }).sort).toBe('lastName');
    expect(list.parse({ sort: 'code' }).sort).toBe('code');
  });

  it('clamps an out-of-range page and never trusts it for the OFFSET', () => {
    expect(list.parse({ page: '99999999' }).page).toBe(1);
    expect(list.parse({ page: '3', pageSize: '10' })).toMatchObject({ skip: 20, take: 10 });
  });

  it('caps a long search term rather than passing it to SQLite', () => {
    expect(list.parse({ q: 'a'.repeat(500) }).q.length).toBeLessThanOrEqual(120);
  });
});

describe('listHref', () => {
  it('produces a bare path for a default view', () => {
    expect(listHref('/students')).toBe('/students');
    expect(listHref('/students', {})).toBe('/students');
  });

  it('preserves the search, sort and filters when only the page changes', () => {
    const href = listHref('/students', { page: 2, q: 'amine', sort: 'code', dir: 'asc', pageSize: 25, filter: { status: 'ACTIVE' } });
    const params = new URLSearchParams(href.split('?')[1]);
    expect(params.get('q')).toBe('amine');
    expect(params.get('sort')).toBe('code');
    expect(params.get('status')).toBe('ACTIVE');
    expect(params.get('page')).toBe('2');
  });

  it('omits page 1, empty values and the neutral ALL', () => {
    const href = listHref('/students', { page: 1, q: '', filter: { status: 'ALL', gender: '', level: 'x' } });
    const params = new URLSearchParams(href.split('?')[1]);
    expect(params.get('page')).toBeNull();
    expect(params.get('q')).toBeNull();
    expect(params.get('status')).toBeNull();
    expect(params.get('gender')).toBeNull();
    expect(params.get('level')).toBe('x');
  });

  it('round-trips through the parser', () => {
    const list = listQuery({ sortFields: ['code'] as const, defaultSort: 'code', filters: z.object({}) });
    const href = listHref('/students', { page: 2, q: 'ali', sort: 'code', dir: 'desc', pageSize: 10 });
    const parsed = list.parse(Object.fromEntries(new URLSearchParams(href.split('?')[1])));
    expect(parsed).toMatchObject({ page: 2, q: 'ali', sort: 'code', dir: 'desc', take: 10, skip: 10 });
  });
});

describe('sort state', () => {
  it('toggles the direction on the same column and resets on a new one', () => {
    expect(nextSort({ sort: 'code', dir: 'asc' }, 'code')).toEqual({ field: 'code', direction: 'desc' });
    expect(nextSort({ sort: 'code', dir: 'desc' }, 'code')).toEqual({ field: 'code', direction: 'asc' });
    expect(nextSort({ sort: 'code', dir: 'desc' }, 'lastName')).toEqual({ field: 'lastName', direction: 'asc' });
  });

  it('exposes aria-sort only for the active column', () => {
    expect(ariaSortFor({ sort: 'code', dir: 'asc' }, 'code')).toBe('ascending');
    expect(ariaSortFor({ sort: 'code', dir: 'desc' }, 'code')).toBe('descending');
    expect(ariaSortFor({ sort: 'code', dir: 'asc' }, 'lastName')).toBe('none');
  });
});

describe('pageInfo', () => {
  it('reports a full single page', () => {
    expect(pageInfo(1, 25, 25)).toEqual({ page: 1, pageSize: 25, total: 25, totalPages: 1, from: 1, to: 25 });
  });

  it('clamps a page beyond the end instead of showing an empty one', () => {
    // The list always renders "page N of M"; a stray ?page=99 must not produce
    // an empty table on a page the user cannot get back from.
    expect(pageInfo(99, 25, 30)).toMatchObject({ page: 2, from: 26, to: 30 });
  });

  it('keeps a zero total renderable', () => {
    expect(pageInfo(1, 25, 0)).toEqual({ page: 1, pageSize: 25, total: 0, totalPages: 1, from: 0, to: 0 });
  });

  it('rounds the last page up', () => {
    expect(pageInfo(2, 25, 26)).toMatchObject({ totalPages: 2, from: 26, to: 26 });
  });
});
