import '@/lib/utils/server-only';
import { prisma } from '@/lib/db/client';
import type { Prisma } from '@/generated/prisma/client';
import { listQuery, pageInfo, searchLiteral, type PageInfo } from '@/lib/lists';
import { userFilterSchema } from '@/lib/validation/users';

/**
 * Read side of the accounts screen (Phase 2B).
 *
 * The three rules of the Phase 2 people queries apply unchanged, and the first
 * one matters more here than anywhere else: **every** query is scoped to
 * `centerId`. An account is a login, so leaking one row leaks a credential's
 * identity, its e-mail and its role - and a role decides what the reader can
 * then reach. A guessed id must therefore never be enough.
 *
 * Password hashes are never selected. `select` is explicit on every query here
 * for the same reason: adding a field to the model must not silently start
 * sending it to a Client Component.
 */

export const userList = listQuery({
  sortFields: ['lastName', 'firstName', 'email', 'role', 'createdAt', 'lastLoginAt'] as const,
  defaultSort: 'lastName' as const,
  filters: userFilterSchema,
});

export type UserListRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: string;
  locale: string;
  /** Extra permissions granted on top of the role, as stored. Never the hash. */
  permissions: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  teacherId: string | null;
  teacher: {
    id: string;
    code: string;
    firstName: string;
    lastName: string;
    firstNameAr: string | null;
    lastNameAr: string | null;
  } | null;
};

const ACCOUNT_SEARCH_FIELDS = ['email', 'firstName', 'lastName', 'phone'] as const;

/**
 * The search predicate for a term.
 *
 * Same wildcard rule as the people searches, and the same consequence for a term
 * made only of wildcards: `searchLiteral` returns an empty string, and an empty
 * predicate would silently drop the filter and list every account of the centre -
 * including the e-mail and role of every one of them. An account list is the most
 * sensitive list in the application, so a term that cannot match anything returns
 * an impossible predicate instead.
 */
function searchTerm(q: string): Prisma.UserWhereInput[] {
  const term = searchLiteral(q);
  if (!term) return [{ id: { in: [] } }];
  return ACCOUNT_SEARCH_FIELDS.map((field) => ({ [field]: { contains: term } }));
}

function accountWhere(
  centerId: string,
  q: string,
  filter: ReturnType<typeof userList.parse>['filter'],
): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = { centerId, deletedAt: null };

  if (filter.role && filter.role !== 'ALL') where.role = filter.role;
  if (filter.status === 'ACTIVE') where.isActive = true;
  if (filter.status === 'INACTIVE') where.isActive = false;
  if (filter.password === 'PENDING') where.mustChangePassword = true;

  if (q) where.OR = searchTerm(q);

  return where;
}

/**
 * Accounts of one centre, paged.
 *
 * Count and rows are read in one transaction so the total and the page on screen
 * come from the same snapshot.
 */
export async function listUsers(
  centerId: string,
  raw: unknown,
): Promise<{
  rows: UserListRow[];
  pagination: PageInfo;
  query: ReturnType<typeof userList.parse>;
}> {
  const query = userList.parse(raw);
  const where = accountWhere(centerId, query.q, query.filter);

  const [total, rows] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { [query.sort]: query.dir },
      skip: query.skip,
      take: query.take,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        // The edit form shows the account's own language, not the reader's, and
        // the permissions column shows the effective set, so both are read here.
        locale: true,
        permissions: true,
        isActive: true,
        mustChangePassword: true,
        lastLoginAt: true,
        createdAt: true,
        teacherId: true,
        teacher: {
          select: {
            id: true,
            code: true,
            firstName: true,
            lastName: true,
            firstNameAr: true,
            lastNameAr: true,
          },
        },
      },
    }),
  ]);

  return { rows, pagination: pageInfo(query.page, query.pageSize, total), query };
}

/** One account, centre-scoped. Returns null for another centre's id. */
export async function getUser(centerId: string, id: string) {
  return prisma.user.findFirst({
    where: { id, centerId, deletedAt: null },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      locale: true,
      permissions: true,
      isActive: true,
      mustChangePassword: true,
      lastLoginAt: true,
      createdAt: true,
      teacherId: true,
    },
  });
}

/**
 * How many administrators can still sign in.
 *
 * `excludeUserId` drops one account from the count, which is what makes the
 * "last administrator" guard answer the real question: not "are there two
 * admins" but "will there still be one *after* this change".
 */
export async function countActiveAdmins(centerId: string, excludeUserId?: string): Promise<number> {
  return prisma.user.count({
    where: {
      centerId,
      role: 'ADMIN',
      isActive: true,
      deletedAt: null,
      ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
    },
  });
}

/**
 * Catalogue teachers an account can be linked to.
 *
 * A teacher already claimed by another account is returned with its owner so
 * the form can refuse the duplicate with a sentence that names the conflict,
 * rather than hiding the row and leaving the administrator to wonder.
 */
export async function listTeacherAccountOptions(centerId: string) {
  const rows = await prisma.teacher.findMany({
    where: { centerId, deletedAt: null },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    select: {
      id: true,
      code: true,
      firstName: true,
      lastName: true,
      firstNameAr: true,
      lastNameAr: true,
      account: { select: { id: true, email: true } },
    },
  });
  return rows;
}