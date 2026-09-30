import '@/lib/utils/server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/client';
import { hashToken, readSessionToken, SESSION_ABSOLUTE_TIMEOUT_MS, SESSION_IDLE_TIMEOUT_MS } from '@/lib/auth/session';
import { DEFAULT_LOCALE, PERMISSIONS, ROLE_PERMISSIONS, type Permission, type Role } from '@/lib/constants';

export type AuthUser = {
  id: string;
  centerId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  permissions: Permission[];
  locale: string;
  mustChangePassword: boolean;
  sessionId: string;
};

/**
 * Resolves the current user from the session cookie.
 *
 * Enforces both an idle timeout and an absolute timeout, and rolls the
 * `lastActivityAt` window forward. Wrapped in React `cache()` so that many
 * server components in one render share a single database round-trip.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const token = await readSessionToken();
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { center: true } } },
  });

  if (!session || session.revokedAt) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() <= now) return null;
  if (now - session.lastActivityAt.getTime() > SESSION_IDLE_TIMEOUT_MS) {
    await prisma.session
      .update({ where: { id: session.id }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
    return null;
  }

  const user = session.user;
  if (!user.isActive || user.deletedAt) return null;
  if (!user.center?.active) return null;

  // Slide the idle window forward (cheap write, at most once per minute).
  if (now - session.lastActivityAt.getTime() > 60_000) {
    await prisma.session
      .update({ where: { id: session.id }, data: { lastActivityAt: new Date() } })
      .catch(() => undefined);
  }

  return {
    id: user.id,
    centerId: user.centerId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role as Role,
    permissions: parsePermissions(user.permissions, user.role as Role),
    locale: user.locale || DEFAULT_LOCALE,
    mustChangePassword: user.mustChangePassword,
    sessionId: session.id,
  };
});

/**
 * Resolves the effective permission set of a user.
 *
 * The role is the baseline (ROLE_PERMISSIONS) and the JSON column holds the
 * *additional* capabilities an administrator granted on top of it. Anything in
 * the column that is not part of the declared catalogue is discarded rather
 * than trusted, so a corrupted or hand-edited row can never widen access.
 * ADMIN always resolves to the full permission set, regardless of storage.
 */
export function parsePermissions(raw: string, role: Role): Permission[] {
  if (role === 'ADMIN') return [...PERMISSIONS];

  let stored: string[] = [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      stored = parsed.filter((p): p is string => typeof p === 'string');
    }
  } catch {
    stored = [];
  }

  const valid = new Set<string>(PERMISSIONS);
  const granted = stored.filter((p): p is Permission => valid.has(p));
  return [...new Set<Permission>([...ROLE_PERMISSIONS[role], ...granted])];
}

/** Server-side authorization check. Always call this before mutating data. */
export function can(user: AuthUser | null, permission: Permission): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  return user.permissions.includes(permission);
}

export function canAny(user: AuthUser | null, permissions: readonly Permission[]): boolean {
  return permissions.some((p) => can(user, p));
}

export function canAll(user: AuthUser | null, permissions: readonly Permission[]): boolean {
  return permissions.every((p) => can(user, p));
}

/**
 * Returns the user or redirects to the login page.
 * Use in Server Components / layouts that cannot render anonymously.
 */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/**
 * Returns the user or throws a typed authorization error.
 * Use in Server Actions and route handlers so errors are handled centrally.
 */
export async function requirePermission(permission: Permission): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError('UNAUTHENTICATED');
  if (!can(user, permission)) throw new AuthError('FORBIDDEN', permission);
  return user;
}

export class AuthError extends Error {
  readonly code: 'UNAUTHENTICATED' | 'FORBIDDEN';
  readonly permission?: Permission;

  constructor(code: 'UNAUTHENTICATED' | 'FORBIDDEN', permission?: Permission) {
    super(code === 'UNAUTHENTICATED' ? 'Authentication required' : `Missing permission: ${permission ?? 'unknown'}`);
    this.name = 'AuthError';
    this.code = code;
    this.permission = permission;
  }
}

/** A teacher may only see the groups they are assigned to. */
export function assertTeacherGroupAccess(user: AuthUser, teacherId: string | null): void {
  if (user.role === 'ADMIN' || user.role === 'DIRECTEUR') return;
  if (user.role === 'SECRETARY') return;
  if (user.role === 'TEACHER' && teacherId) return;
  throw new AuthError('FORBIDDEN', 'groups.view');
}

export { SESSION_ABSOLUTE_TIMEOUT_MS };
