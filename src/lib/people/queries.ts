import '@/lib/utils/server-only';
import { prisma } from '@/lib/db/client';
import type { Prisma } from '@/generated/prisma/client';
import { listQuery, pageInfo, type PageInfo } from '@/lib/lists';
import {
  parentFilterSchema,
  studentFilterSchema,
  teacherFilterSchema,
} from '@/lib/validation/people';
import type { Locale } from '@/lib/constants';

/**
 * Read side of the Phase 2 people screens.
 *
 * Three rules are enforced here rather than trusted from the caller:
 *
 *  1. Every query is scoped to one centre (`centerId`). A record id alone is
 *     never enough to read a row, so a guessed id cannot cross tenants.
 *  2. `deletedAt` is filtered in the query, so a soft-deleted record disappears
 *     from lists and counts without any per-row filtering in the UI.
 *  3. Sort keys come from a fixed list. The URL is user input and is never
 *     forwarded to `orderBy` as a column name.
 *
 * SQLite has no case-insensitive LIKE in Prisma (`mode: 'insensitive'` is
 * rejected by the connector), but its `LIKE` is already ASCII-case-insensitive,
 * which is what matters for names and codes here.
 */

// --- Query definitions ------------------------------------------------------

export const studentList = listQuery({
  sortFields: ['lastName', 'firstName', 'code', 'createdAt', 'status', 'birthDate'] as const,
  defaultSort: 'lastName' as const,
  filters: studentFilterSchema,
});

export const parentList = listQuery({
  sortFields: ['lastName', 'firstName', 'code', 'createdAt'] as const,
  defaultSort: 'lastName' as const,
  filters: parentFilterSchema,
});

export const teacherList = listQuery({
  sortFields: ['lastName', 'firstName', 'code', 'createdAt', 'status'] as const,
  defaultSort: 'lastName' as const,
  filters: teacherFilterSchema,
});

export type StudentListRow = {
  id: string;
  code: string | null;
  firstName: string;
  lastName: string;
  firstNameAr: string | null;
  lastNameAr: string | null;
  cin: string | null;
  phone: string | null;
  city: string | null;
  status: string;
  birthDate: Date | null;
  createdAt: Date;
  level: { id: string; nameFr: string; nameAr: string | null } | null;
  _count: { parents: number };
};

export type ParentListRow = {
  id: string;
  code: string | null;
  firstName: string;
  lastName: string;
  cin: string | null;
  phone: string | null;
  city: string | null;
  createdAt: Date;
  _count: { students: number };
};

export type TeacherListRow = {
  id: string;
  code: string | null;
  firstName: string;
  lastName: string;
  firstNameAr: string | null;
  lastNameAr: string | null;
  phone: string | null;
  email: string | null;
  specialization: string | null;
  status: string;
  createdAt: Date;
  _count: { groups: number; subjects: number };
};

// --- Where builders ---------------------------------------------------------

/**
 * Makes a search term safe to hand to Prisma's `contains`.
 *
 * `contains` compiles to `LIKE '%' || ? || '%'` and Prisma emits no
 * `ESCAPE '\'` clause, so a backslash escape would be read as a literal
 * backslash: escaping `a_b` to `a\_b` produced a pattern that matched only a
 * row containing a real backslash. Wildcards are dropped instead, which keeps
 * the term a plain substring and stops a stray `%` from matching every row.
 */
function stripLikeWildcards(q: string): string {
  return q.replace(/[%_\\]/g, '');
}

/**
 * The search predicate for a term, or `undefined` when the term cannot match.
 *
 * A term made only of wildcards (`q = '%'`) strips down to the empty string,
 * and `contains: ''` matches every row - so pasting a stray `%` into the search
 * box would dump the whole centre's students on screen. An empty `in` list is
 * Prisma's way of expressing "nothing", which is the honest answer.
 */
/** The six columns a person is searched on. */
const PERSON_SEARCH_FIELDS = ['firstName', 'lastName', 'code', 'cin', 'phone', 'email'] as const;

/**
 * The search predicate for a term.
 *
 * Typed against the shape the three person models share rather than against
 * `StudentWhereInput`, because the same predicate is assigned to a `Parent` or
 * `Teacher` query as well; the field names are identical on all three.
 */
type SearchPredicate = Array<Record<string, Record<string, unknown>>>;

function searchTerm(q: string): SearchPredicate {
  const term = stripLikeWildcards(q);
  if (!term) return [{ id: { in: [] } }];
  return PERSON_SEARCH_FIELDS.map((field) => ({ [field]: { contains: term } }));
}

function studentWhere(
  centerId: string,
  q: string,
  filter: ReturnType<typeof studentList.parse>['filter'],
): Prisma.StudentWhereInput {
  const where: Prisma.StudentWhereInput = { centerId, deletedAt: null };

  if (filter.status && filter.status !== 'ALL') where.status = filter.status;
  if (filter.gender && filter.gender !== 'ALL') where.gender = filter.gender;
  if (filter.level) where.levelId = filter.level;

  if (q) where.OR = searchTerm(q);

  return where;
}

function parentWhere(centerId: string, q: string): Prisma.ParentWhereInput {
  const where: Prisma.ParentWhereInput = { centerId, deletedAt: null };

  if (q) where.OR = searchTerm(q);

  return where;
}

function teacherWhere(
  centerId: string,
  q: string,
  filter: ReturnType<typeof teacherList.parse>['filter'],
): Prisma.TeacherWhereInput {
  const where: Prisma.TeacherWhereInput = { centerId, deletedAt: null };

  if (filter.status && filter.status !== 'ALL') where.status = filter.status;

  if (q) where.OR = searchTerm(q);

  return where;
}

// --- Queries ----------------------------------------------------------------

export type ListResult<T, Q = unknown> = {
  rows: T[];
  pagination: PageInfo;
  query: Q;
};

/**
 * Count and page in one transaction, so the total and the rows on screen come
 * from the same snapshot. Without it a concurrent insert can produce
 * "row 26 of 25".
 */
async function paginate<T>(
  countPromise: Prisma.PrismaPromise<number>,
  rowsPromise: Prisma.PrismaPromise<T[]>,
  page: number,
  pageSize: number,
): Promise<{ rows: T[]; pagination: PageInfo }> {
  const [total, items] = await prisma.$transaction([countPromise, rowsPromise]);
  return { rows: items, pagination: pageInfo(page, pageSize, total) };
}

export async function listStudents(
  centerId: string,
  raw: unknown,
): Promise<ListResult<StudentListRow, ReturnType<typeof studentList.parse>>> {
  const query = studentList.parse(raw);
  const where = studentWhere(centerId, query.q, query.filter);

  const { rows, pagination } = await paginate(
    prisma.student.count({ where }),
    prisma.student.findMany({
        where,
        orderBy: { [query.sort]: query.dir },
        skip: query.skip,
        take: query.take,
        select: {
          id: true,
          code: true,
          firstName: true,
          lastName: true,
          firstNameAr: true,
          lastNameAr: true,
          cin: true,
          phone: true,
          city: true,
          status: true,
          birthDate: true,
          createdAt: true,
          level: { select: { id: true, nameFr: true, nameAr: true } },
      _count: { select: { parents: true } },
    },
  }),
    query.page,
    query.pageSize,
  );

  return { rows, pagination, query };
}

export async function listParents(
  centerId: string,
  raw: unknown,
): Promise<ListResult<ParentListRow, ReturnType<typeof parentList.parse>>> {
  const query = parentList.parse(raw);
  const where = parentWhere(centerId, query.q);

  const { rows, pagination } = await paginate(
    prisma.parent.count({ where }),
    prisma.parent.findMany({
        where,
        orderBy: { [query.sort]: query.dir },
        skip: query.skip,
        take: query.take,
        select: {
          id: true,
          code: true,
          firstName: true,
          lastName: true,
          cin: true,
          phone: true,
          city: true,
          createdAt: true,
      _count: { select: { students: true } },
    },
  }),
    query.page,
    query.pageSize,
  );

  return { rows, pagination, query };
}

export async function listTeachers(
  centerId: string,
  raw: unknown,
): Promise<ListResult<TeacherListRow, ReturnType<typeof teacherList.parse>>> {
  const query = teacherList.parse(raw);
  const where = teacherWhere(centerId, query.q, query.filter);

  const { rows, pagination } = await paginate(
    prisma.teacher.count({ where }),
    prisma.teacher.findMany({
        where,
        orderBy: { [query.sort]: query.dir },
        skip: query.skip,
        take: query.take,
        select: {
          id: true,
          code: true,
          firstName: true,
          lastName: true,
          firstNameAr: true,
          lastNameAr: true,
          phone: true,
          email: true,
          specialization: true,
          status: true,
          createdAt: true,
      _count: { select: { groups: true, subjects: true } },
    },
  }),
    query.page,
    query.pageSize,
  );

  return { rows, pagination, query };
}

// --- Single records ---------------------------------------------------------

export async function getStudent(centerId: string, id: string) {
  return prisma.student.findFirst({
    where: { id, centerId, deletedAt: null },
    include: { level: { select: { id: true, nameFr: true, nameAr: true } } },
  });
}

export async function getParent(centerId: string, id: string) {
  return prisma.parent.findFirst({ where: { id, centerId, deletedAt: null } });
}

export async function getTeacher(centerId: string, id: string) {
  return prisma.teacher.findFirst({ where: { id, centerId, deletedAt: null } });
}

// --- Select options ---------------------------------------------------------

/**
 * Options for the filter and form selects.
 *
 * Only active rows are offered, and each carries both names so a form rendered
 * in Arabic shows Arabic without a second round-trip.
 */
export async function listLevelOptions(centerId: string) {
  const rows = await prisma.academicLevel.findMany({
    where: { centerId, active: true },
    orderBy: [{ sortOrder: 'asc' }, { nameFr: 'asc' }],
    select: { id: true, nameFr: true, nameAr: true, stage: true },
  });
  return rows;
}

export async function listSubjectOptions(centerId: string) {
  const rows = await prisma.subject.findMany({
    where: { centerId, active: true },
    orderBy: { nameFr: 'asc' },
    select: { id: true, nameFr: true, nameAr: true, isLanguage: true },
  });
  return rows;
}

/** Picks the name in the reader's language, falling back to French. */
export function localisedName(
  row: { nameFr: string; nameAr: string | null },
  locale: Locale,
): string {
  if (locale === 'ar') return row.nameAr?.trim() || row.nameFr;
  return row.nameFr;
}
