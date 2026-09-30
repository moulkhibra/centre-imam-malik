import { describe, expect, it } from 'vitest';
import { checkPasswordPolicy, generateTemporaryPassword } from '@/lib/auth/password';
import {
  constantTimeEquals,
  generateSessionToken,
  hashToken,
  isLockedOut,
  lockoutRemainingMs,
  registerFailedAttempt,
  LOCK_DURATION_MS,
  MAX_FAILED_ATTEMPTS,
} from '@/lib/auth/session';
import { parsePermissions, can, canAny, canAll, type AuthUser } from '@/lib/auth/permissions';
import { PERMISSIONS, ROLE_PERMISSIONS, ROLES, type Permission } from '@/lib/constants';

describe('password policy', () => {
  it('requires length, a letter and a digit', () => {
    expect(checkPasswordPolicy('Passw0rd!2026').ok).toBe(true);
    expect(checkPasswordPolicy('short1').ok).toBe(false);
    expect(checkPasswordPolicy('12345678').ok).toBe(false);
    expect(checkPasswordPolicy('abcdefgh').ok).toBe(false);
  });

  it('accepts an Arabic letter as the required letter', () => {
    expect(checkPasswordPolicy('كلمة1234').ok).toBe(true);
  });

  it('returns a human-readable reason for each failure', () => {
    const result = checkPasswordPolicy('abc');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/8 caractères/);
  });
});

describe('temporary password generator', () => {
  it('always produces a password that satisfies the policy', () => {
    for (let i = 0; i < 200; i += 1) {
      const password = generateTemporaryPassword();
      expect(password).toHaveLength(16);
      expect(checkPasswordPolicy(password).ok).toBe(true);
    }
  });

  it('does not repeat the same value', () => {
    const values = new Set(Array.from({ length: 50 }, () => generateTemporaryPassword()));
    expect(values.size).toBe(50);
  });
});

describe('session tokens', () => {
  it('stores only a hash of the token', () => {
    const token = generateSessionToken();
    expect(hashToken(token)).not.toBe(token);
    expect(hashToken(token)).toHaveLength(64);
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(generateSessionToken())).not.toBe(hashToken(token));
  });

  it('generates unguessable tokens', () => {
    const tokens = new Set(Array.from({ length: 500 }, () => generateSessionToken()));
    expect(tokens.size).toBe(500);
    for (const token of tokens) expect(token.length).toBeGreaterThanOrEqual(43);
  });

  it('compares secrets in constant time without throwing on length mismatch', () => {
    expect(constantTimeEquals('abc', 'abc')).toBe(true);
    expect(constantTimeEquals('abc', 'abd')).toBe(false);
    expect(constantTimeEquals('abc', 'abcd')).toBe(false);
  });
});

describe('brute-force lockout', () => {
  it('locks the account only on the final failed attempt', () => {
    // registerFailedAttempt(userId, currentAttempts) is called with the value
    // already stored on the account, so the Nth call carries N-1.
    for (let stored = 0; stored < MAX_FAILED_ATTEMPTS - 2; stored += 1) {
      expect(registerFailedAttempt('u1', stored).lockUntil).toBeNull();
    }
    expect(registerFailedAttempt('u1', MAX_FAILED_ATTEMPTS - 2).lockUntil).toBeNull();
    expect(registerFailedAttempt('u1', MAX_FAILED_ATTEMPTS - 1).lockUntil).not.toBeNull();
  });

  it('recognises an active lockout and reports the remaining time', () => {
    const { lockUntil } = registerFailedAttempt('u1', MAX_FAILED_ATTEMPTS - 1);
    expect(lockUntil).not.toBeNull();
    expect(isLockedOut({ lockedUntil: lockUntil, failedLoginAttempts: MAX_FAILED_ATTEMPTS })).toBe(true);
    expect(lockoutRemainingMs({ lockedUntil: lockUntil })).toBeGreaterThan(0);
    expect(lockoutRemainingMs({ lockedUntil: lockUntil })).toBeLessThanOrEqual(LOCK_DURATION_MS);
  });

  it('ignores an expired lockout', () => {
    const past = new Date(Date.now() - 1000);
    expect(isLockedOut({ lockedUntil: past, failedLoginAttempts: 9 })).toBe(false);
    expect(lockoutRemainingMs({ lockedUntil: past })).toBe(0);
  });
});

describe('RBAC', () => {
  const baseUser = {
    id: 'u1',
    centerId: 'c1',
    email: 'a@b.c',
    firstName: 'A',
    lastName: 'B',
    locale: 'fr',
    mustChangePassword: false,
    sessionId: 's1',
  } satisfies Omit<AuthUser, 'role' | 'permissions'>;

  const asUser = (role: string, permissions: readonly Permission[] = []): AuthUser =>
    ({ ...baseUser, role: role as AuthUser['role'], permissions: [...permissions] }) as AuthUser;

  it('gives ADMIN every permission regardless of what is stored', () => {
    const admin = asUser('ADMIN', []);
    expect(can(admin, 'students.delete')).toBe(true);
    expect(can(admin, 'audit.view')).toBe(true);
    expect(PERMISSIONS.every((p) => can(admin, p))).toBe(true);
  });

  it('grants only the listed permissions to other roles', () => {
    const secretary = asUser('SECRETARY', ROLE_PERMISSIONS.SECRETARY);
    expect(can(secretary, 'students.create')).toBe(true);
    expect(can(secretary, 'students.delete')).toBe(false);
    expect(can(secretary, 'settings.manage')).toBe(false);
    expect(can(secretary, 'finance.payments')).toBe(true);
    expect(can(secretary, 'finance.refunds')).toBe(false);
  });

  it('never treats an anonymous visitor as authorised', () => {
    expect(can(null, 'dashboard.view')).toBe(false);
    expect(canAny(null, PERMISSIONS)).toBe(false);
    expect(canAll(null, PERMISSIONS)).toBe(false);
  });

  it('supports canAny / canAll', () => {
    const teacher = asUser('TEACHER', ROLE_PERMISSIONS.TEACHER);
    expect(canAny(teacher, ['finance.payments', 'attendance.record'])).toBe(true);
    expect(canAll(teacher, ['attendance.view', 'attendance.record'])).toBe(true);
    expect(canAll(teacher, ['attendance.view', 'finance.payments'])).toBe(false);
  });

  it('drops stored permissions that are not in the catalogue', () => {
    const parsed = parsePermissions('["made.up","finance.payments",123]', 'SECRETARY');
    expect(parsed).toContain('finance.payments');
    expect(parsed).not.toContain('made.up');
  });

  it('starts from the permissions the role declares', () => {
    const parsed = parsePermissions('[]', 'SECRETARY');
    expect(parsed).toEqual([...ROLE_PERMISSIONS.SECRETARY]);
  });

  it('adds the capabilities an administrator granted on top of the role', () => {
    const parsed = parsePermissions('["reports.view"]', 'TEACHER');
    expect(parsed).toEqual([...new Set([...ROLE_PERMISSIONS.TEACHER, 'reports.view'])]);
  });

  it('never duplicates a permission', () => {
    const parsed = parsePermissions('["students.view"]', 'SECRETARY');
    expect(new Set(parsed).size).toBe(parsed.length);
  });

  it('gives an administrator every permission whatever the column holds', () => {
    expect(parsePermissions('[]', 'ADMIN')).toEqual([...PERMISSIONS]);
    expect(parsePermissions('garbage', 'ADMIN')).toEqual([...PERMISSIONS]);
  });

  it('survives corrupted permission JSON and falls back to the role', () => {
    for (const raw of ['not json', '{"role":"ADMIN"}', 'null', '[1,2,3]']) {
      expect(parsePermissions(raw, 'SECRETARY')).toEqual([...ROLE_PERMISSIONS.SECRETARY]);
    }
  });

  it('declares a role matrix that only uses real permissions and roles', () => {
    for (const role of ROLES) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(PERMISSIONS).toContain(permission);
      }
    }
    expect(ROLE_PERMISSIONS.ADMIN).toEqual(PERMISSIONS);
  });

  it('never lets a non-admin role manage users, settings or backups', () => {
    for (const role of ROLES) {
      if (role === 'ADMIN') continue;
      expect(ROLE_PERMISSIONS[role]).not.toContain('users.manage');
      expect(ROLE_PERMISSIONS[role]).not.toContain('settings.manage');
      expect(ROLE_PERMISSIONS[role]).not.toContain('backups.manage');
    }
  });
});
