import { z } from 'zod';

/**
 * Shared list-screen plumbing: search, filters, sorting and pagination.
 *
 * This module is imported by Client Components (toolbars, table headers) and
 * by Server Components (queries), so it must stay free of database, session and
 * filesystem imports.
 *
 * Every list screen is driven entirely by the URL query string. That is what
 * makes "server-side pagination" real: nothing is fetched by the browser, a
 * page reload restores the exact view, and a filtered list can be bookmarked
 * and shared.
 *
 * Parsing never throws. A hand-edited or truncated URL must render a usable
 * page, not a 500, so invalid values fall back to defaults.
 */

export const LIST_PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export type SortDirection = 'asc' | 'desc';
export type SortToggle = { field: string; direction: SortDirection };

const directionSchema = z
  .union([z.literal('asc'), z.literal('desc')])
  .catch('asc')
  .default('asc');

/** Trimmed, length-capped free-text search term. */
const searchSchema = z
  .string()
  .trim()
  .max(120)
  .catch('')
  .default('');

const pageSchema = z
  .coerce
  .number()
  .int()
  .catch(1)
  .default(1)
  // A URL like ?page=99999999 must not be trusted for the OFFSET.
  .refine((value) => value >= 1 && value <= 100_000, { message: 'Page hors limites' })
  .catch(1);

const pageSizeSchema = z
  .coerce
  .number()
  .int()
  .catch(DEFAULT_PAGE_SIZE)
  .default(DEFAULT_PAGE_SIZE)
  .refine((value) => value >= 5 && value <= MAX_PAGE_SIZE, { message: 'Taille de page invalide' })
  .catch(DEFAULT_PAGE_SIZE);

/**
 * The filter keys a schema declares, or `[]` when it is not a plain object.
 *
 * `config.filters` is typed as an opaque `z.ZodTypeAny`, so the keys are read
 * off `.shape` at runtime rather than from a generic parameter.
 */
function declaredFilterKeys(filters: z.ZodTypeAny): string[] {
  const shape = (filters as unknown as { shape?: unknown }).shape;
  return shape && typeof shape === 'object' ? Object.keys(shape) : [];
}

/**
 * Builds the parser for one list screen.
 *
 * `sortFields` doubles as the whitelist: a sort key that is not declared here
 * is dropped, so the value can never reach Prisma as an arbitrary column name.
 */
export function listQuery<TSort extends string, TFilters extends z.ZodTypeAny>(config: {
  sortFields: readonly TSort[];
  defaultSort: TSort;
  filters: TFilters;
}) {
  const schema = z.object({
    page: pageSchema,
    pageSize: pageSizeSchema,
    q: searchSchema,
    // Validated against `sortFields` below rather than by z.enum: the field list
    // is a generic tuple, which TypeScript cannot turn into a ZodEnum.
    sort: z.string().trim().max(40).catch('').default(''),
    dir: directionSchema,
    filter: config.filters.catch({} as never),
  });

  const filterKeys = declaredFilterKeys(config.filters);
  type Filters = z.infer<TFilters>;

  /** Shape the parser guarantees, whatever Zod infers for the generic filter. */
  type Parsed = {
    page: number;
    pageSize: number;
    q: string;
    sort: string;
    dir: SortDirection;
    filter: Filters;
  };

  return {
    schema,

    /** Parses raw URL search params. Unknown keys are dropped, never rejected. */
    parse(input: unknown): Parsed & { take: number; skip: number } {
      const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;

      // `listHref` writes the filters flat into the query string, and Next.js
      // hands the page the same flat `searchParams`, so that is where a filter
      // has to be read from. Lifting the declared keys back under `filter` here
      // is what keeps the write and the read symmetric; leaving it to the caller
      // to nest them is what silently dropped every filter in the application.
      // A caller that already nests them still works: the two are merged, with
      // the flat URL winning because the URL is the source of truth.
      const nested = (typeof raw.filter === 'object' && raw.filter !== null ? raw.filter : {}) as Record<string, unknown>;
      const lifted: Record<string, unknown> = { ...nested };
      for (const key of filterKeys) {
        if (raw[key] !== undefined) lifted[key] = raw[key];
      }

      const parsed = schema.safeParse({ ...raw, filter: lifted });
      const value = (parsed.success ? parsed.data : schema.parse({})) as Parsed;

      const sort = config.sortFields.includes(value.sort as TSort)
        ? (value.sort as TSort)
        : config.defaultSort;

      return {
        page: value.page,
        pageSize: value.pageSize,
        q: value.q,
        sort,
        dir: value.dir,
        filter: value.filter,
        take: value.pageSize,
        skip: (value.page - 1) * value.pageSize,
      };
    },
  };
}

export type ListQuery<TSort extends string, TFilters extends z.ZodTypeAny> = ReturnType<
  typeof listQuery<TSort, TFilters>
>['parse'];

/** Next sort state for a header click: same column toggles, new column resets to asc. */
export function nextSort(current: { sort: string; dir: SortDirection }, field: string): SortToggle {
  if (current.sort === field) {
    return { field, direction: current.dir === 'asc' ? 'desc' : 'asc' };
  }
  return { field, direction: 'asc' };
}

/** `aria-sort` value for a column header. */
export function ariaSortFor(current: { sort: string; dir: SortDirection }, field: string): 'ascending' | 'descending' | 'none' {
  if (current.sort !== field) return 'none';
  return current.dir === 'asc' ? 'ascending' : 'descending';
}

/**
 * Builds the query string of a list screen.
 *
 * Every argument is optional: passing only `page` preserves the active search,
 * filters and sort. This is what makes the toolbar and the pagination controls
 * pure URL builders.
 */
export function listHref(
  base: string,
  current: {
    page?: number;
    pageSize?: number;
    q?: string;
    sort?: string;
    dir?: SortDirection;
    filter?: Record<string, unknown>;
  } = {},
): string {
  const params = new URLSearchParams();

  const put = (key: string, value: unknown) => {
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  };

  put('q', current.q);
  put('sort', current.sort);
  put('dir', current.dir);
  if (current.pageSize !== undefined) put('pageSize', current.pageSize);
  if (current.page && current.page > 1) put('page', current.page);

  for (const [key, value] of Object.entries(current.filter ?? {})) {
    if (value === undefined || value === null || value === '' || value === 'ALL') continue;
    params.set(key, String(value));
  }

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export type PageInfo = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  from: number;
  to: number;
};

/**
 * Builds pagination metadata from a row count.
 *
 * `totalPages` is at least 1 so the UI can always render "page 1 of 1" instead
 * of a divide-by-zero, and `from`/`to` are clamped for the empty case.
 */
export function pageInfo(page: number, pageSize: number, total: number): PageInfo {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return {
    page: safePage,
    pageSize,
    total,
    totalPages,
    from: total === 0 ? 0 : (safePage - 1) * pageSize + 1,
    to: total === 0 ? 0 : Math.min(safePage * pageSize, total),
  };
}
