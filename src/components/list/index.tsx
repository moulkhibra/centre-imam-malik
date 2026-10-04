'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { ariaSortFor, listHref, nextSort, type PageInfo, type SortDirection } from '@/lib/lists';
import { usePendingFilters } from './use-pending-filters';

/**
 * Shared list-screen building blocks: toolbar, sortable header, pagination.
 *
 * Every control here is a link to the same page with different search params.
 * Nothing fetches, so the whole view is server-rendered, the back button works,
 * and a filtered list can be bookmarked. The only client behaviour is the
 * search box, which navigates on submit rather than filtering the DOM.
 */

export type SortState = { sort: string; dir: SortDirection };

export type ToolbarFilter = {
  name: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
};

// --- Toolbar ----------------------------------------------------------------

export function ListToolbar({
  basePath,
  q,
  query,
  filters = [],
  searchLabel,
  searchPlaceholder,
  searchAction,
  resetLabel,
  children,
}: {
  basePath: string;
  q: string;
  query: { sort: string; dir: SortDirection; pageSize: number; filter?: Record<string, unknown> };
  filters?: ToolbarFilter[];
  /** Accessible name of the search field. */
  searchLabel: string;
  /** Visible hint inside the field. Different from `searchLabel` on purpose. */
  searchPlaceholder: string;
  /** Label of the submit button. Must not repeat `searchLabel`. */
  searchAction: string;
  resetLabel: string;
  children?: ReactNode;
}) {
  const router = useRouter();

  const { values: activeFilters, change } = usePendingFilters(
    Object.fromEntries(filters.map((filter) => [filter.name, filter.value || 'ALL'])),
  );

  const hasFilters = Object.values(activeFilters).some((value) => value && value !== 'ALL');

  /**
   * Applies a filter change: keeps the search term and the other filters,
   * replaces only the one that changed, and returns to page 1 - otherwise a
   * filter that shrinks the result set can leave the user stranded on an empty
   * page 4.
   *
   * `change` returns the whole set to navigate to, composed from the edits the
   * user has just made rather than from the last server render, which is what
   * keeps two changes in a row from cancelling each other out.
   */
  const applyFilter = (name: string, value: string) => {
    const next = change(name, value || 'ALL');

    const params = new URLSearchParams();
    for (const [key, active] of Object.entries(next)) {
      if (active && active !== 'ALL') params.set(key, String(active));
    }
    if (q) params.set('q', q);
    params.set('sort', query.sort);
    params.set('dir', query.dir);
    params.set('pageSize', String(query.pageSize));

    const search = params.toString();
    router.push(search ? `${basePath}?${search}` : basePath);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <form action={basePath} method="get" className="flex flex-1 items-center gap-2">
          {/* Carries the sort and filters through a new search so typing does
              not silently drop the active view. */}
          <input type="hidden" name="sort" value={query.sort} />
          <input type="hidden" name="dir" value={query.dir} />
          <input type="hidden" name="pageSize" value={query.pageSize} />
          {Object.entries(activeFilters).map(([name, value]) =>
            value && value !== 'ALL' ? <input key={name} type="hidden" name={name} value={value} /> : null,
          )}

          <label className="sr-only" htmlFor="list-search">
            {searchLabel}
          </label>
          <div className="relative flex-1">
            <input
              id="list-search"
              type="search"
              name="q"
              defaultValue={q}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-ink-200 bg-white py-2 pe-9 ps-9 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-ink-400"
            >
              <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="11" cy="11" r="6.5" />
                <path d="M20 20l-4-4" strokeLinecap="round" />
              </svg>
            </span>
          </div>
          <button
            type="submit"
            className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            {searchAction}
          </button>
        </form>

        {children}
      </div>

      {filters.length > 0 ? (
        <div className="flex flex-wrap items-end gap-2">
          {filters.map((filter) => (
            <div key={filter.name} className="flex flex-col gap-1">
              <label htmlFor={`filter-${filter.name}`} className="text-xs font-medium text-ink-500">
                {filter.label}
              </label>
              <select
                id={`filter-${filter.name}`}
                value={activeFilters[filter.name] || 'ALL'}
                onChange={(event) => applyFilter(filter.name, event.target.value)}
                className="rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm text-ink-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              >
                <option value="ALL">—</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}

          {hasFilters ? (
            <Link
              href={basePath}
              className="rounded-lg px-2 py-1.5 text-sm text-ink-600 underline hover:text-ink-900"
            >
              {resetLabel}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// --- Table ------------------------------------------------------------------

export type Column<T> = {
  key: string;
  header: string;
  /** Renders the cell. Returning null renders an em dash. */
  cell: (row: T) => ReactNode;
  /** When set, the header becomes a sort link. */
  sortKey?: string;
  className?: string;
  headerClassName?: string;
};

export function SortableHeader<T>({
  basePath,
  column,
  current,
  q,
  filter,
  pageSize,
}: {
  basePath: string;
  column: Column<T>;
  current: SortState;
  q: string;
  filter?: Record<string, unknown>;
  pageSize: number;
}) {
  if (!column.sortKey) {
    return <th scope="col" className={cn('px-3 py-2.5 text-start font-semibold', column.headerClassName)}>{column.header}</th>;
  }

  const next = nextSort(current, column.sortKey);
  const href = listHref(basePath, {
    q,
    sort: next.field,
    dir: next.direction,
    pageSize,
    filter,
  });

  return (
    <th
      scope="col"
      aria-sort={ariaSortFor(current, column.sortKey)}
      className={cn('px-3 py-2.5 text-start font-semibold', column.headerClassName)}
    >
      <Link href={href} className="inline-flex items-center gap-1 hover:text-brand-700">
        {column.header}
        <span aria-hidden="true" className="text-[10px] text-ink-400">
          {current.sort === column.sortKey ? (current.dir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </Link>
    </th>
  );
}

export function DataTable<T extends { id: string }>({
  basePath,
  columns,
  rows,
  current,
  q,
  filter,
  caption,
  emptyState,
}: {
  basePath: string;
  columns: Array<Column<T>>;
  rows: T[];
  current: SortState & { pageSize: number };
  q: string;
  filter?: Record<string, unknown>;
  caption: string;
  emptyState: ReactNode;
}) {
  if (rows.length === 0) return <>{emptyState}</>;

  return (
    <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-ink-200 bg-ink-50 text-ink-600">
          <tr>
            {columns.map((column) => (
              <SortableHeader
                key={column.key}
                basePath={basePath}
                column={column}
                current={current}
                q={q}
                filter={filter}
                pageSize={current.pageSize}
              />
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-ink-50/60">
              {columns.map((column) => (
                <td key={column.key} className={cn('px-3 py-2.5 text-ink-800', column.className)}>
                  {column.cell(row) ?? <span className="text-ink-400">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Pagination -------------------------------------------------------------

/**
 * Fills `{from}` / `{to}` / `{total}` in a translated sentence.
 *
 * The count is substituted here, in the Client Component, rather than by
 * `t(path, vars)` on the server: the template crosses the boundary already
 * resolved, and the client never imports the dictionaries. Interpolating keeps
 * the sentence whole, which is what lets Arabic put the numbers where the
 * language wants them instead of concatenating them onto the end.
 */
function interpolate(template: string, vars: Record<string, number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

export function Pagination({
  basePath,
  pagination,
  current,
  q,
  filter,
  labels,
}: {
  basePath: string;
  pagination: PageInfo;
  current: { sort: string; dir: SortDirection; pageSize: number };
  q: string;
  filter?: Record<string, unknown>;
  labels: { previous: string; next: string; page: string; of: string; showing: string };
}) {
  const href = (page: number) =>
    listHref(basePath, { page, q, sort: current.sort, dir: current.dir, pageSize: current.pageSize, filter });

  const disabled = 'pointer-events-none rounded-lg border border-ink-200 px-3 py-1.5 text-sm text-ink-300';
  const enabled = 'rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50';

  return (
    <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
      <p className="text-xs text-ink-500">
        {interpolate(labels.showing, {
          from: pagination.from,
          to: pagination.to,
          total: pagination.total,
        })}
      </p>
      <nav aria-label={labels.page} className="flex items-center gap-2">
        {pagination.page <= 1 ? (
          <span className={disabled} aria-disabled="true">
            {labels.previous}
          </span>
        ) : (
          <Link href={href(pagination.page - 1)} className={enabled} rel="prev">
            {labels.previous}
          </Link>
        )}
        <span className="text-sm text-ink-600">
          {labels.page} {pagination.page} {labels.of} {pagination.totalPages}
        </span>
        {pagination.page >= pagination.totalPages ? (
          <span className={disabled} aria-disabled="true">
            {labels.next}
          </span>
        ) : (
          <Link href={href(pagination.page + 1)} className={enabled} rel="next">
            {labels.next}
          </Link>
        )}
      </nav>
    </div>
  );
}
