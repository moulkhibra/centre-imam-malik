'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/client';
import { requirePermission } from '@/lib/auth/permissions';
import { hashPassword } from '@/lib/auth/password';
import { recordChange, diffFields } from '@/lib/audit';
import { AppError, handleError, ok, type ActionResult } from '@/lib/utils/errors';
import { ekey } from '@/lib/validation/messages';
import {
  passwordResetSchema,
  roleChangeSchema,
  userCreateSchema,
  userUpdateSchema,
  type UserCreateInput,
} from '@/lib/validation/users';
import { parseForm } from '@/lib/action-utils';
import { countActiveAdmins, getUser } from '@/lib/users/queries';

/**
 * Account mutations (Phase 2B).
 *
 * Every action re-checks `users.manage` on the server. The buttons that call
 * them are hidden for anyone without it, but hiding a control is presentation:
 * the check that matters is the one here.
 *
 * Three invariants are enforced here and nowhere else, because they are about
 * *consequences* rather than about the field values:
 *
 *  1. An administrator cannot strand the centre: the last active ADMIN cannot be
 *     deactivated or demoted. Locking every administrator out of the only
 *     installation that can unlock them is unrecoverable without a shell.
 *  2. An administrator cannot lock themselves out: nobody may deactivate or
 *     re-role their own account - but they may correct their own details.
 *  3. A password reset closes the open sessions, or a stolen session outlives
 *     the password it was opened with.
 */

function revalidateAccountViews() {
  revalidatePath('/admin/users');
  revalidatePath('/dashboard');
}

/**
 * The two access-level rules, enforced together because they share one question:
 * does this write change who can sign in, and with what rights?
 *
 * Neither rule is about the field values, which is why both live here and not in
 * the schema:
 *
 *  - Nobody changes their own role or their own activation. Signing yourself out,
 *    or handing yourself a different role, is not a maintenance task and there is
 *    no legitimate case for it.
 *  - The last active administrator cannot be deactivated or demoted. The
 *    administrator count excludes the target, so the question answered is the one
 *    actually being asked: after this change, is anybody left to undo it?
 *
 * An edit that changes neither the role nor the activation - a corrected name, a
 * new phone number, a different interface language - is *not* an access-level
 * change and is allowed on one's own account. Refusing it would make the screen
 * impossible to use for the person most likely to be looking at it, so the guard
 * returns before either rule applies.
 */
async function assertAccessLevelChangeAllowed(params: {
  centerId: string;
  actorId: string;
  targetId: string;
  /** The role and state the target holds now. */
  targetRole: string;
  targetIsActive: boolean;
  /** The role and state the target is being moved to. */
  becomesRole: string;
  becomesActive: boolean;
}): Promise<void> {
  const roleChanges = params.becomesRole !== params.targetRole;
  const activeChanges = params.becomesActive !== params.targetIsActive;
  if (!roleChanges && !activeChanges) return;

  if (params.actorId === params.targetId) {
    throw new AppError(
      'CONFLICT',
      'Vous ne pouvez pas modifier votre propre rôle ni votre propre activation.',
      undefined,
      ekey('selfAccessChange'),
    );
  }

  const staysActiveAdmin = params.becomesRole === 'ADMIN' && params.becomesActive;
  const losesAdmin = params.targetRole === 'ADMIN' && params.targetIsActive && !staysActiveAdmin;
  if (!losesAdmin) return;

  const remaining = await countActiveAdmins(params.centerId, params.targetId);
  if (remaining === 0) {
    throw new AppError(
      'CONFLICT',
      "Impossible : c'est le dernier administrateur actif du centre. Créez ou réactivez un autre administrateur d'abord.",
      undefined,
      ekey('lastAdmin'),
    );
  }
}

/**
 * Validates a teacher link.
 *
 * The three ways it can be wrong are all refused with a message the form can
 * show: the id may be from another centre (or not exist at all), it may belong
 * to a soft-deleted teacher, or another account may already claim it - the
 * column is unique, so the last one would otherwise surface as a raw
 * constraint error.
 */
async function assertTeacherLinkable(
  centerId: string,
  teacherId: string | null,
  accountId: string | null,
): Promise<void> {
  if (!teacherId) return;

  const teacher = await prisma.teacher.findFirst({
    where: { id: teacherId, centerId, deletedAt: null },
    select: { id: true, account: { select: { id: true } } },
  });
  if (!teacher) {
    throw new AppError(
      'VALIDATION',
      'Enseignant introuvable dans ce centre.',
      { teacherId: ['Enseignant introuvable dans ce centre'] },
      ekey('teacherNotFound'),
    );
  }

  if (teacher.account && teacher.account.id !== accountId) {
    throw new AppError(
      'VALIDATION',
      'Cet enseignant est déjà relié à un autre compte.',
      { teacherId: ['Cet enseignant est déjà relié à un autre compte'] },
      ekey('teacherAlreadyLinked'),
    );
  }
}

export async function createUserAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requirePermission('users.manage');
    const input: UserCreateInput = parseForm(userCreateSchema, formData);

    await assertTeacherLinkable(actor.centerId, input.teacherId ?? null, null);

    const created = await prisma.user.create({
      data: {
        centerId: actor.centerId,
        email: input.email,
        passwordHash: await hashPassword(input.password),
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        role: input.role,
        teacherId: input.teacherId ?? null,
        locale: input.locale,
        permissions: '[]',
        isActive: true,
        // The administrator chose this password in front of the user; it cannot be
        // the user's own, so the first login has to replace it.
        mustChangePassword: true,
        passwordChangedAt: new Date(),
      },
      select: { id: true },
    });

    await recordChange({
      user: actor,
      action: 'CREATE',
      entity: 'User',
      entityId: created.id,
      metadata: {
        email: input.email,
        role: input.role,
        teacherId: input.teacherId ?? null,
        mustChangePassword: true,
      },
    });

    revalidateAccountViews();
    return ok({ id: created.id });
  } catch (error) {
    return handleError(error, 'createUser');
  }
}

export async function updateUserAction(id: string, formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requirePermission('users.manage');

    const existing = await getUser(actor.centerId, id);
    if (!existing) throw new AppError('NOT_FOUND', 'Utilisateur introuvable', undefined, ekey('userNotFound'));

    const input = parseForm(userUpdateSchema, formData);

    // A role change is a permission change; it goes through the same guard as the
    // dedicated action rather than slipping in with the identity fields. An edit
    // that leaves the role alone is not an access-level change, so the guard
    // passes and an administrator can correct their own details.
    await assertAccessLevelChangeAllowed({
      centerId: actor.centerId,
      actorId: actor.id,
      targetId: existing.id,
      targetRole: existing.role,
      targetIsActive: existing.isActive,
      becomesRole: input.role,
      becomesActive: existing.isActive,
    });

    await assertTeacherLinkable(actor.centerId, input.teacherId ?? null, existing.id);

    await prisma.user.update({
      where: { id: existing.id },
      data: {
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        role: input.role,
        teacherId: input.teacherId ?? null,
        locale: input.locale,
      },
    });

    const roleChanged = existing.role !== input.role;
    await recordChange({
      user: actor,
      action: roleChanged ? 'PERMISSION_CHANGE' : 'UPDATE',
      entity: 'User',
      entityId: existing.id,
      metadata: {
        email: input.email,
        changes: diffFields(existing as unknown as Record<string, unknown>, {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
          role: input.role,
          locale: input.locale,
          teacherId: input.teacherId ?? null,
        }),
      },
    });

    revalidateAccountViews();
    return ok({ id: existing.id });
  } catch (error) {
    return handleError(error, 'updateUser');
  }
}

/**
 * Role change on its own, for the confirm dialog in the list.
 *
 * Same schema, same guard and same audit entry as the role carried by the edit
 * form: two entry points must not mean two rules.
 */
export async function changeUserRoleAction(id: string, formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requirePermission('users.manage');

    const existing = await getUser(actor.centerId, id);
    if (!existing) throw new AppError('NOT_FOUND', 'Utilisateur introuvable', undefined, ekey('userNotFound'));

    const input = parseForm(roleChangeSchema, formData);

    await assertAccessLevelChangeAllowed({
      centerId: actor.centerId,
      actorId: actor.id,
      targetId: existing.id,
      targetRole: existing.role,
      targetIsActive: existing.isActive,
      becomesRole: input.role,
      becomesActive: existing.isActive,
    });

    if (existing.role !== input.role) {
      await prisma.user.update({ where: { id: existing.id }, data: { role: input.role } });
    }

    await recordChange({
      user: actor,
      action: 'PERMISSION_CHANGE',
      entity: 'User',
      entityId: existing.id,
      metadata: {
        email: existing.email,
        changes: { role: { from: existing.role, to: input.role } },
      },
    });

    revalidateAccountViews();
    return ok({ id: existing.id });
  } catch (error) {
    return handleError(error, 'changeUserRole');
  }
}

/**
 * Deactivates or reactivates an account.
 *
 * Deactivation is reversible and never destructive: the row stays, the audit
 * trail and everything the user created are untouched, and only the login is
 * refused (`getCurrentUser` returns null for an inactive account). Sessions are
 * revoked on the way out, otherwise an open tab would keep working.
 */
export async function setUserActiveAction(id: string, isActive: boolean): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requirePermission('users.manage');

    const existing = await getUser(actor.centerId, id);
    if (!existing) throw new AppError('NOT_FOUND', 'Utilisateur introuvable', undefined, ekey('userNotFound'));

    await assertAccessLevelChangeAllowed({
      centerId: actor.centerId,
      actorId: actor.id,
      targetId: existing.id,
      targetRole: existing.role,
      targetIsActive: existing.isActive,
      becomesRole: existing.role,
      becomesActive: isActive,
    });

    if (existing.isActive !== isActive) {
      await prisma.$transaction([
        prisma.user.update({ where: { id: existing.id }, data: { isActive } }),
        ...(isActive ? [] : [prisma.session.updateMany({ where: { userId: existing.id, revokedAt: null }, data: { revokedAt: new Date() } })]),
      ]);
    }

    await recordChange({
      user: actor,
      action: isActive ? 'UPDATE' : 'DELETE',
      entity: 'User',
      entityId: existing.id,
      metadata: { email: existing.email, isActive, reversible: true },
    });

    revalidateAccountViews();
    return ok({ id: existing.id });
  } catch (error) {
    return handleError(error, 'setUserActive');
  }
}

/**
 * Administrator-initiated password reset.
 *
 * The account is forced to change the password on its next login, the lockout
 * counter is cleared (an administrator resetting a password is telling the user
 * "start again") and every open session is revoked. Revoking is the part that
 * is easy to forget: without it, whoever prompted the reset keeps a working
 * cookie and the reset protects nobody.
 */
export async function resetUserPasswordAction(id: string, formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requirePermission('users.manage');

    const existing = await getUser(actor.centerId, id);
    if (!existing) throw new AppError('NOT_FOUND', 'Utilisateur introuvable', undefined, ekey('userNotFound'));

    const input = parseForm(passwordResetSchema, formData);

    const now = new Date();
    await prisma.$transaction([
      prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash: await hashPassword(input.password),
          mustChangePassword: true,
          passwordChangedAt: now,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      prisma.session.updateMany({
        where: { userId: existing.id, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);

    // Never the hash, never the typed password: the journal records that a reset
    // happened, never the secret that was used.
    await recordChange({
      user: actor,
      action: 'PASSWORD_RESET',
      entity: 'User',
      entityId: existing.id,
      metadata: {
        email: existing.email,
        by: actor.email,
        mustChangePassword: true,
        sessionsRevoked: true,
      },
    });

    revalidateAccountViews();
    return ok({ id: existing.id });
  } catch (error) {
    return handleError(error, 'resetUserPassword');
  }
}