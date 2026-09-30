import { compare, hash } from 'bcryptjs';
import { prisma } from '@/lib/db/client';
import { AUDIT_ACTIONS } from '@/lib/constants';

/**
 * Password hashing.
 *
 * bcryptjs (pure JavaScript) is used deliberately: the application must
 * install and run offline on a normal Windows PC without a native build
 * toolchain. Cost 12 is the accepted baseline for 2026 hardware.
 */
const BCRYPT_COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
  try {
    return await compare(plain, passwordHash);
  } catch {
    return false;
  }
}

export type PasswordPolicyResult = { ok: true } | { ok: false; message: string };

/** Enforced on every user, including the initial administrator account. */
export function checkPasswordPolicy(password: string): PasswordPolicyResult {
  if (password.length < 8) {
    return { ok: false, message: 'Le mot de passe doit contenir au moins 8 caractères.' };
  }
  if (!/[A-Za-z؀-ۿ]/.test(password)) {
    return { ok: false, message: 'Le mot de passe doit contenir au moins une lettre.' };
  }
  if (!/\d/.test(password)) {
    return { ok: false, message: 'Le mot de passe doit contenir au moins un chiffre.' };
  }
  return { ok: true };
}

/**
 * Generates a readable but strong temporary password for the installer.
 * Uses a guaranteed digit + letter mix so it always satisfies the policy.
 */
export function generateTemporaryPassword(length = 16): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*?';
  const all = upper + lower + digits + symbols;

  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  const chars: string[] = [
    upper[bytes[0]! % upper.length]!,
    lower[bytes[1]! % lower.length]!,
    digits[bytes[2]! % digits.length]!,
    symbols[bytes[3]! % symbols.length]!,
  ];
  for (let i = 4; i < length; i += 1) {
    chars.push(all[bytes[i]! % all.length]!);
  }

  // Fisher-Yates shuffle so the guaranteed classes are not positionally fixed
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = bytes[i % bytes.length]! % (i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}

// --- Audit trail ------------------------------------------------------------

export type AuditInput = {
  centerId: string;
  userId?: string | null;
  action: (typeof AUDIT_ACTIONS)[number];
  entityType: string;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Writes an audit entry. Never throws: an audit failure must not break the
 * business operation that triggered it, but it is logged to stderr.
 */
export async function writeAuditLog(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        centerId: input.centerId,
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent?.slice(0, 500) ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  } catch (error) {
    console.error('[audit] failed to write audit log', error);
  }
}
