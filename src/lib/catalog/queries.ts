import '@/lib/utils/server-only';
import { prisma } from '@/lib/db/client';
import type { Prisma } from '@/generated/prisma/client';
import { listQuery, pageInfo, type PageInfo } from '@/lib/lists';
import { catalogFilterSchema } from '@/lib/validation/people';

/**
 * Read side of the Phase 2 reference screens: levels, subjects (languages are
 * subjects flagged `isLanguage`), services and rooms.
 *
 * These are small catalogues - tens of rows - but they still paginate and sort
 * server-side so the behaviour is identical to the people screens and does not
 * regress when a centre grows. There is deliberately no separate `Language`
 * table: a language in this domain is a subject taught as a language, which is
 * exactly what `Subject.isLanguage` records.
 */

export const levelList = listQuery({
  sortFields: ['sortOrder', 'nameFr', 'code', 'createdAt', 'stage'] as const,
  defaultSort: 'sortOrder' as const,
  filters: catalogFilterSchema,
});

export const subjectList = listQuery({
  sortFields: ['nameFr', 'code', 'createdAt'] as const,
  defaultSort: 'nameFr' as const,
  filters: catalogFilterSchema,
});

export const serviceList = listQuery({
  sortFields: ['nameFr', 'code', 'defaultPriceCents', 'createdAt'] as const,
  defaultSort: 'nameFr' as const,
  filters: catalogFilterSchema,
});

export const roomList = listQuery({
  sortFields: ['name', 'capacity', 'status', 'createdAt'] as const,
  defaultSort: 'name' as const,
  filters: catalogFilterSchema,
});

export type LevelListRow = {
  id: string;
  code: string;
  stage: string;
  nameFr: string;
  nameAr: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
  _count: { students: number; groups: number };
};

export type SubjectListRow = {
  id: string;
  code: string;
  nameFr: string;
  nameAr: string | null;
  description: string | null;
  isLanguage: boolean;
  active: boolean;
  createdAt: Date;
  category: { id: string; nameFr: string; nameAr: string | null } | null;
  _count: { groups: number; teachingAssignments: number };
};

export type ServiceListRow = {
  id: string;
  code: string;
  nameFr: string;
  nameAr: string | null;
  description: string | null;
  defaultPriceCents: number;
  defaultDurationMinutes: number;
  active: boolean;
  createdAt: Date;
};

export type RoomListRow = {
  id: string;
  name: string;
  capacity: number;
  location: string | null;
  equipment: string | null;
  status: string;
  notes: string | null;
  active: boolean;
  createdAt: Date;
  _count: { groups: number; schedules: number };
};

type CatalogFilters = ReturnType<typeof levelList.parse>['filter'];

/**
 * Applies the "active / inactive / all" filter.
 *
 * `ALL` leaves the field unset, which is what makes the default view show
 * inactive rows too - a deactivated level stays visible so the secretary can
 * reactivate it instead of wondering where it went.
 */
function activeFrom(filters: CatalogFilters): boolean | undefined {
  if (filters.active === 'true') return true;
  if (filters.active === 'false') return false;
  return undefined;
}

/**
 * Makes a search term safe to hand to Prisma's `contains`.
 *
 * `contains` compiles to `LIKE '%' || ? || '%'` with no `ESCAPE '\'` clause, so
 * backslash-escaping made a search for `a_b` match only a literal backslash.
 * Dropping the wildcard characters keeps the term a plain substring.
 */
function stripLikeWildcards(q: string): string {
  return q.replace(/[%_\\]/g, '');
}

/**
 * "Matches nothing", for a search term that was nothing but wildcards.
 *
 * `contains: ''` matches every row, so a bare `%` in the search box would list
 * the whole catalogue; an empty `in` list is Prisma's way of saying "no row",
 * which is the honest answer for a term with no literal characters in it.
 */
const MATCHES_NOTHING = { id: { in: [] as string[] } };

async function paginate<T>(
  countPromise: Prisma.PrismaPromise<number>,
  rowsPromise: Prisma.PrismaPromise<T[]>,
  page: number,
  pageSize: number,
): Promise<{ rows: T[]; pagination: PageInfo }> {
  const [total, items] = await prisma.$transaction([countPromise, rowsPromise]);
  return { rows: items, pagination: pageInfo(page, pageSize, total) };
}

export type CatalogResult<T, Q> = { rows: T[]; pagination: PageInfo; query: Q };

export async function listLevels(centerId: string, raw: unknown): Promise<CatalogResult<LevelListRow, ReturnType<typeof levelList.parse>>> {
  const query = levelList.parse(raw);
  const where: Prisma.AcademicLevelWhereInput = { centerId, active: activeFrom(query.filter) };
  if (query.filter.stage) where.stage = query.filter.stage;
  if (query.q) {
    const term = stripLikeWildcards(query.q);
    where.OR = term
      ? [{ nameFr: { contains: term } }, { nameAr: { contains: term } }, { code: { contains: term } }]
      : [MATCHES_NOTHING];
  }

  const { rows, pagination } = await paginate(
    prisma.academicLevel.count({ where }),
    prisma.academicLevel.findMany({
      where,
      orderBy: { [query.sort]: query.dir },
      skip: query.skip,
      take: query.take,
      select: {
        id: true,
        code: true,
        stage: true,
        nameFr: true,
        nameAr: true,
        sortOrder: true,
        active: true,
        createdAt: true,
        _count: { select: { students: true, groups: true } },
      },
    }),
    query.page,
    query.pageSize,
  );

  return { rows, pagination, query };
}

export async function listSubjects(
  centerId: string,
  raw: unknown,
  options: { languagesOnly?: boolean } = {},
): Promise<CatalogResult<SubjectListRow, ReturnType<typeof subjectList.parse>>> {
  const query = subjectList.parse(raw);
  const where: Prisma.SubjectWhereInput = { centerId, active: activeFrom(query.filter) };
  if (options.languagesOnly) where.isLanguage = true;
  if (query.q) {
    const term = stripLikeWildcards(query.q);
    where.OR = term
      ? [{ nameFr: { contains: term } }, { nameAr: { contains: term } }, { code: { contains: term } }]
      : [MATCHES_NOTHING];
  }

  const { rows, pagination } = await paginate(
    prisma.subject.count({ where }),
    prisma.subject.findMany({
      where,
      orderBy: { [query.sort]: query.dir },
      skip: query.skip,
      take: query.take,
      select: {
        id: true,
        code: true,
        nameFr: true,
        nameAr: true,
        description: true,
        isLanguage: true,
        active: true,
        createdAt: true,
        category: { select: { id: true, nameFr: true, nameAr: true } },
        _count: { select: { groups: true, teachingAssignments: true } },
      },
    }),
    query.page,
    query.pageSize,
  );

  return { rows, pagination, query };
}

export async function listServices(centerId: string, raw: unknown): Promise<CatalogResult<ServiceListRow, ReturnType<typeof serviceList.parse>>> {
  const query = serviceList.parse(raw);
  const where: Prisma.ServiceWhereInput = { centerId, active: activeFrom(query.filter) };
  if (query.q) {
    const term = stripLikeWildcards(query.q);
    where.OR = term
      ? [{ nameFr: { contains: term } }, { nameAr: { contains: term } }, { code: { contains: term } }]
      : [MATCHES_NOTHING];
  }

  const { rows, pagination } = await paginate(
    prisma.service.count({ where }),
    prisma.service.findMany({
      where,
      orderBy: { [query.sort]: query.dir },
      skip: query.skip,
      take: query.take,
      select: {
        id: true,
        code: true,
        nameFr: true,
        nameAr: true,
        description: true,
        defaultPriceCents: true,
        defaultDurationMinutes: true,
        active: true,
        createdAt: true,
      },
    }),
    query.page,
    query.pageSize,
  );

  return { rows, pagination, query };
}

export async function listRooms(centerId: string, raw: unknown): Promise<CatalogResult<RoomListRow, ReturnType<typeof roomList.parse>>> {
  const query = roomList.parse(raw);
  const where: Prisma.RoomWhereInput = { centerId, active: activeFrom(query.filter) };
  if (query.q) {
    const term = stripLikeWildcards(query.q);
    where.OR = term
      ? [
          { name: { contains: term } },
          { location: { contains: term } },
          { equipment: { contains: term } },
        ]
      : [MATCHES_NOTHING];
  }

  const { rows, pagination } = await paginate(
    prisma.room.count({ where }),
    prisma.room.findMany({
      where,
      orderBy: { [query.sort]: query.dir },
      skip: query.skip,
      take: query.take,
      select: {
        id: true,
        name: true,
        capacity: true,
        location: true,
        equipment: true,
        status: true,
        notes: true,
        active: true,
        createdAt: true,
        _count: { select: { groups: true, schedules: true } },
      },
    }),
    query.page,
    query.pageSize,
  );

  return { rows, pagination, query };
}

export async function getLevel(centerId: string, id: string) {
  return prisma.academicLevel.findFirst({ where: { id, centerId } });
}

export async function getSubject(centerId: string, id: string) {
  return prisma.subject.findFirst({
    where: { id, centerId },
    include: { category: { select: { id: true, nameFr: true, nameAr: true } } },
  });
}

export async function getService(centerId: string, id: string) {
  return prisma.service.findFirst({ where: { id, centerId } });
}

export async function getRoom(centerId: string, id: string) {
  return prisma.room.findFirst({ where: { id, centerId } });
}

/** Subject categories for the subject form's select. */
export async function listSubjectCategories(centerId: string) {
  return prisma.subjectCategory.findMany({
    where: { centerId },
    orderBy: { nameFr: 'asc' },
    select: { id: true, nameFr: true, nameAr: true },
  });
}
