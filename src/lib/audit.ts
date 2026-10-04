import '@/lib/utils/server-only';
import { headers } from 'next/headers';
import { writeAuditLog } from '@/lib/auth/password';
import type { AuthUser } from '@/lib/auth/permissions';

/**
 * Audit trail for data mutations.
 *
 * Every create / update / delete in Phase 2 goes through `recordChange`, so the
 * journal is written next to the write it describes. Auditing inside the
 * Server Action rather than in the UI is deliberate: a caller without a browser
 * (a script, a future API route) is audited exactly like the secretary.
 *
 * Failures never propagate — `writeAuditLog` swallows its own errors — because
 * losing the journal must not roll back a registration the secretary just
 * completed. This is a known trade-off, recorded in the Phase 2 report.
 */

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'RESTORE'
  /**
   * An account's role or extra permissions changed. Not an `UPDATE`: the journal
   * has to answer "who gained what, and when" without reading metadata, and a
   * role change is the one edit that decides what somebody can reach.
   */
  | 'PERMISSION_CHANGE'
  /** A password was imposed by an administrator rather than chosen by its owner. */
  | 'PASSWORD_RESET'
  /** Centre identity, contact details or appearance. */
  | 'SETTINGS_CHANGE';

export type AuditEntity =
  | 'Student'
  | 'Parent'
  | 'Teacher'
  | 'AcademicLevel'
  | 'Subject'
  | 'Service'
  | 'Room'
  | 'User'
  | 'Center';

async function requestMeta(): Promise<{ ip: string | null; ua: string | null }> {
  try {
    const h = await headers();
    const forwarded = h.get('x-forwarded-for');
    const ip = forwarded ? (forwarded.split(',')[0]?.trim() ?? null) : h.get('x-real-ip');
    return { ip, ua: h.get('user-agent') };
  } catch {
    // Called outside a request scope (script, test): audit without metadata.
    return { ip: null, ua: null };
  }
}

export async function recordChange(input: {
  user: AuthUser;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { ip, ua } = await requestMeta();
  await writeAuditLog({
    centerId: input.user.centerId,
    userId: input.user.id,
    action: input.action,
    entityType: input.entity,
    entityId: input.entityId ?? null,
    ipAddress: ip,
    userAgent: ua,
    metadata: input.metadata,
  });
}

/**
 * The fields that actually changed, for the journal's `metadata` column.
 *
 * Only the keys present in `next` and different from `previous` are kept, so
 * the journal records the difference rather than the whole record. Values are
 * limited to primitives because the column is a JSON string.
 */
export function diffFields<T extends Record<string, unknown>>(
  previous: T,
  next: Partial<T>,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, to] of Object.entries(next)) {
    if (to === undefined) continue;
    const from = previous[key];
    const same = from === to || (from === null && to === '') || (from === undefined && to === null);
    if (same) continue;
    changes[key] = {
      from: from instanceof Date ? from.toISOString() : from,
      to: to instanceof Date ? to.toISOString() : to,
    };
  }
  return changes;
}
