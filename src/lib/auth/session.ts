import { cookies } from 'next/headers';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/db/client';

export const SESSION_COOKIE = 'cim_session';

/** Sessions are valid for 12 hours of inactivity, 7 days absolute. */
export const SESSION_IDLE_TIMEOUT_MS = 12 * 60 * 60 * 1000;
export const SESSION_ABSOLUTE_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000;

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

/**
 * Only the SHA-256 hash of the session token is stored. If the database is
 * leaked, an attacker cannot use the stored values to authenticate.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.trim().length < 32) {
    throw new Error(
      'SESSION_SECRET is missing or too short. Run install.bat (or scripts/setup.mjs) to generate a secure secret.',
    );
  }
  return secret;
}

export function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export type SessionRecord = {
  sessionId: string;
  userId: string;
  expiresAt: Date;
  idleExpiresAt: Date;
};

/**
 * Creates a persisted session and sets the httpOnly cookie.
 * Called from Server Actions only.
 */
export async function createSession(userId: string, meta: { ip?: string | null; ua?: string | null } = {}): Promise<void> {
  const token = generateSessionToken();
  const now = Date.now();

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      ipAddress: meta.ip ?? null,
      userAgent: meta.ua?.slice(0, 500) ?? null,
      expiresAt: new Date(now + SESSION_ABSOLUTE_TIMEOUT_MS),
      lastActivityAt: new Date(now),
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && process.env.APP_URL?.startsWith('https'),
    path: '/',
    maxAge: Math.floor(SESSION_ABSOLUTE_TIMEOUT_MS / 1000),
  });
}

export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function destroySession(): Promise<void> {
  const token = await readSessionToken();
  if (token) {
    await prisma.session
      .updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
  }
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Revokes every active session of a user (used on password change). */
export async function revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
  await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
}

// --- Brute force protection --------------------------------------------------

export function isLockedOut(user: { lockedUntil: Date | null; failedLoginAttempts: number }): boolean {
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) return true;
  return false;
}

export function lockoutRemainingMs(user: { lockedUntil: Date | null }): number {
  if (!user.lockedUntil) return 0;
  return Math.max(0, user.lockedUntil.getTime() - Date.now());
}

export function registerFailedAttempt(userId: string, currentAttempts: number): { lockUntil: Date | null } {
  const attempts = currentAttempts + 1;
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    return { lockUntil: new Date(Date.now() + LOCK_DURATION_MS) };
  }
  return { lockUntil: null };
}

export { MAX_FAILED_ATTEMPTS, LOCK_DURATION_MS };
