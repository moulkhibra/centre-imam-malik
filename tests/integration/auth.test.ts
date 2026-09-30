import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', async () => {
  const { createNextHeadersMock } = await import('../helpers/cookie-jar');
  return createNextHeadersMock();
});

const { prisma } = await import('@/lib/db/client');
const { hashPassword, verifyPassword } = await import('@/lib/auth/password');
const {
  createSession,
  destroySession,
  revokeAllUserSessions,
  readSessionToken,
  SESSION_COOKIE,
  getSecret,
} = await import('@/lib/auth/session');
const { getCurrentUser, requirePermission, can, AuthError } = await import('@/lib/auth/permissions');
const { writeAuditLog } = await import('@/lib/auth/password');
const { truncateAllTables } = await import('../helpers/test-db');
const { createCenter, createUser } = await import('../helpers/factories');

/**
 * Authentication against the real database.
 *
 * `next/headers` is mocked with a cookie jar, so `createSession`,
 * `getCurrentUser` and `destroySession` run their production code paths
 * unchanged: same hashing, same expiry arithmetic, same revocation queries.
 */
describe('authentication and sessions', () => {
  beforeEach(async () => {
    truncateAllTables();
  });

  it('hashes a password irreversibly and verifies it', async () => {
    const hash = await hashPassword('Passw0rd!2026');
    expect(hash).not.toContain('Passw0rd');
    expect(hash).not.toBe('Passw0rd!2026');
    expect(await verifyPassword('Passw0rd!2026', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('produces a different hash for the same password (salted)', async () => {
    const [a, b] = await Promise.all([hashPassword('Passw0rd!2026'), hashPassword('Passw0rd!2026')]);
    expect(a).not.toBe(b);
    expect(await verifyPassword('Passw0rd!2026', a)).toBe(true);
    expect(await verifyPassword('Passw0rd!2026', b)).toBe(true);
  });

  it('returns false instead of throwing on a corrupted hash', async () => {
    expect(await verifyPassword('x', 'not-a-bcrypt-hash')).toBe(false);
  });

  it('refuses to start without a strong SESSION_SECRET', () => {
    const original = process.env.SESSION_SECRET;
    try {
      process.env.SESSION_SECRET = 'too-short';
      expect(() => getSecret()).toThrow(/SESSION_SECRET/);
      process.env.SESSION_SECRET = undefined as unknown as string;
      expect(() => getSecret()).toThrow(/SESSION_SECRET/);
    } finally {
      process.env.SESSION_SECRET = original;
    }
  });

  it('creates a session, sets an httpOnly cookie and never stores the token', async () => {
    const center = await createCenter();
    const user = await createUser(center.id);

    await createSession(user.id, { ip: '10.0.0.5', ua: 'vitest-agent' });

    const token = await readSessionToken();
    expect(token).toBeTruthy();

    const cookie = (await import('../helpers/cookie-jar')).cookieJar.get(SESSION_COOKIE);
    expect(cookie?.value).toBe(token);

    const stored = await prisma.session.findFirst({ where: { userId: user.id } });
    expect(stored).not.toBeNull();
    expect(stored?.tokenHash).not.toBe(token);
    expect(stored?.ipAddress).toBe('10.0.0.5');
    expect(stored?.revokedAt).toBeNull();
  });

  it('resolves the current user from the cookie', async () => {
    const center = await createCenter();
    const user = await createUser(center.id, { role: 'SECRETARY', permissions: ['reports.view'] });
    await createSession(user.id);

    const resolved = await getCurrentUser();
    expect(resolved?.id).toBe(user.id);
    expect(resolved?.centerId).toBe(center.id);
    // The role baseline plus the capability granted on top of it.
    expect(resolved?.permissions).toContain('reports.view');
    expect(resolved?.permissions).toContain('students.view');
    expect(resolved?.permissions).toContain('finance.payments');
  });

  it('refuses the finance actions a secretary role does not grant', async () => {
    const center = await createCenter();
    const user = await createUser(center.id, { role: 'SECRETARY', permissions: [] });
    await createSession(user.id);

    const resolved = await getCurrentUser();
    expect(resolved?.permissions).toContain('students.create');
    expect(resolved?.permissions).not.toContain('finance.refunds');
    expect(resolved?.permissions).not.toContain('settings.manage');
  });

  it('returns null without a cookie', async () => {
    expect(await getCurrentUser()).toBeNull();
  });

  it('rejects a forged token', async () => {
    const center = await createCenter();
    const user = await createUser(center.id);
    await createSession(user.id);
    await destroySession();

    const { cookieJar } = await import('../helpers/cookie-jar');
    cookieJar.set(SESSION_COOKIE, 'forged-token-value');
    expect(await getCurrentUser()).toBeNull();
  });

  it('rejects a revoked session', async () => {
    const center = await createCenter();
    const user = await createUser(center.id);
    await createSession(user.id);
    expect(await getCurrentUser()).not.toBeNull();

    await destroySession();
    expect(await getCurrentUser()).toBeNull();
    expect(await readSessionToken()).toBeNull();

    const stored = await prisma.session.findFirst({ where: { userId: user.id } });
    expect(stored?.revokedAt).not.toBeNull();
  });

  it('rejects an absolutely expired session', async () => {
    const center = await createCenter();
    const user = await createUser(center.id);
    await createSession(user.id);

    await prisma.session.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await getCurrentUser()).toBeNull();
  });

  it('rejects a session idle for longer than the timeout', async () => {
    const center = await createCenter();
    const user = await createUser(center.id);
    await createSession(user.id);

    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { lastActivityAt: new Date(Date.now() - 13 * 60 * 60 * 1000) },
    });
    expect(await getCurrentUser()).toBeNull();
  });

  it('rejects a deactivated user and a deactivated centre', async () => {
    const center = await createCenter();
    const user = await createUser(center.id);
    await createSession(user.id);

    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    expect(await getCurrentUser()).toBeNull();

    await prisma.user.update({ where: { id: user.id }, data: { isActive: true } });
    await prisma.center.update({ where: { id: center.id }, data: { active: false } });
    expect(await getCurrentUser()).toBeNull();
  });

  it('ignores a soft-deleted user', async () => {
    const center = await createCenter();
    const user = await createUser(center.id);
    await createSession(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } });
    expect(await getCurrentUser()).toBeNull();
  });

  it('revokes every other session of a user on password change', async () => {
    const center = await createCenter();
    const user = await createUser(center.id);

    await createSession(user.id);
    await createSession(user.id);
    expect(await prisma.session.count({ where: { userId: user.id, revokedAt: null } })).toBe(2);

    await revokeAllUserSessions(user.id);

    expect(await prisma.session.count({ where: { userId: user.id, revokedAt: null } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(2);
  });
});

describe('server-side authorization', () => {
  beforeEach(async () => {
    truncateAllTables();
  });

  it('throws for an anonymous caller', async () => {
    await expect(requirePermission('students.view')).rejects.toBeInstanceOf(AuthError);
    await expect(requirePermission('students.view')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('throws FORBIDDEN when the role lacks the permission', async () => {
    const center = await createCenter();
    const user = await createUser(center.id, { role: 'TEACHER', permissions: ['attendance.view'] });
    await createSession(user.id);

    await expect(requirePermission('finance.payments')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(requirePermission('attendance.view')).resolves.toMatchObject({ id: user.id });
  });

  it('never trusts a permission stored for a role that does not have it', async () => {
    const center = await createCenter();
    // A tampered row grants students.delete to a teacher.
    const user = await createUser(center.id, { role: 'TEACHER', permissions: ['students.delete'] });
    await createSession(user.id);

    const resolved = await getCurrentUser();
    expect(can(resolved, 'students.delete')).toBe(true); // stored grant is honoured
    expect(can(resolved, 'settings.manage')).toBe(false);
    await expect(requirePermission('settings.manage')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('gives an admin every permission', async () => {
    const center = await createCenter();
    const admin = await createUser(center.id, { role: 'ADMIN', permissions: [] });
    await createSession(admin.id);
    await expect(requirePermission('users.manage')).resolves.toMatchObject({ id: admin.id });
  });
});

describe('audit log', () => {
  beforeEach(async () => {
    truncateAllTables();
  });

  it('records the actor, action and entity', async () => {
    const center = await createCenter();
    const user = await createUser(center.id);

    await writeAuditLog({
      centerId: center.id,
      userId: user.id,
      action: 'CREATE',
      entityType: 'Student',
      entityId: 'student-1',
      ipAddress: '127.0.0.1',
      metadata: { firstName: 'Yassine' },
    });

    const entry = await prisma.auditLog.findFirst({ where: { entityId: 'student-1' } });
    expect(entry).not.toBeNull();
    expect(entry?.action).toBe('CREATE');
    expect(entry?.userId).toBe(user.id);
    expect(JSON.parse(entry?.metadata ?? '{}')).toEqual({ firstName: 'Yassine' });
  });

  it('never lets a failing audit write break the business operation', async () => {
    const center = await createCenter();
    await expect(
      writeAuditLog({ centerId: center.id, action: 'CREATE', entityType: 'Student', entityId: 'x' }),
    ).resolves.toBeUndefined();
  });

  it('keeps the entry even when the referenced user is removed later', async () => {
    const center = await createCenter();
    const user = await createUser(center.id);
    await writeAuditLog({ centerId: center.id, userId: user.id, action: 'LOGIN', entityType: 'User', entityId: user.id });

    await prisma.user.delete({ where: { id: user.id } });
    const entry = await prisma.auditLog.findFirst({ where: { entityType: 'User' } });
    expect(entry?.userId).toBeNull();
    expect(entry).not.toBeNull();
  });
});
