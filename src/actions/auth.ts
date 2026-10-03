'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/client';
import {
  createSession,
  destroySession,
  isLockedOut,
  lockoutRemainingMs,
  readSessionToken,
  registerFailedAttempt,
} from '@/lib/auth/session';
import { hashPassword, verifyPassword, writeAuditLog } from '@/lib/auth/password';
import { getCurrentUser } from '@/lib/auth/permissions';
import { AppError, handleError, ok, type ActionResult } from '@/lib/utils/errors';
import { z } from 'zod';
import { emailSchema, passwordSchema } from '@/lib/validation/common';
import { ekey, vmsg, type ErrorMessage } from '@/lib/validation/messages';
import { getActiveCenter } from '@/lib/settings/center';

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, vmsg('passwordRequired')).max(128, vmsg('passwordRequired')),
});

/**
 * `errorKey` is what the banner shows; `error` is the French sentence kept for
 * the server log. See `src/lib/utils/errors.ts`.
 */
export type LoginState = {
  error?: string;
  errorKey?: ErrorMessage;
  fieldErrors?: Record<string, string[]>;
};

async function requestMeta() {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  return {
    ip: forwarded ? forwarded.split(',')[0]?.trim() ?? null : h.get('x-real-ip'),
    ua: h.get('user-agent'),
  };
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '_form');
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { error: 'Données invalides', errorKey: ekey('validation'), fieldErrors };
  }

  const { email, password } = parsed.data;
  const meta = await requestMeta();
  const center = await getActiveCenter();

  const user = await prisma.user.findUnique({ where: { email } });

  // Generic message for every failure mode: never reveal which part was wrong.
  const GENERIC = { error: 'E-mail ou mot de passe incorrect', errorKey: ekey('invalidCredentials') };

  if (!user || !center) {
    if (center) {
      await writeAuditLog({
        centerId: center.id,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        metadata: { email, reason: 'unknown_account' },
        ipAddress: meta.ip,
        userAgent: meta.ua,
      });
    }
    return GENERIC;
  }

  if (isLockedOut(user)) {
    const remainingMinutes = Math.ceil(lockoutRemainingMs(user) / 60000);
    await writeAuditLog({
      centerId: user.centerId,
      userId: user.id,
      action: 'LOGIN_FAILED',
      entityType: 'User',
      entityId: user.id,
      metadata: { reason: 'locked' },
      ipAddress: meta.ip,
      userAgent: meta.ua,
    });
    return { error: `Compte verrouillé. Réessayez dans ${remainingMinutes} minute(s).` };
  }

  if (!user.isActive || user.deletedAt) {
    await writeAuditLog({
      centerId: user.centerId,
      userId: user.id,
      action: 'LOGIN_FAILED',
      entityType: 'User',
      entityId: user.id,
      metadata: { reason: 'inactive' },
      ipAddress: meta.ip,
      userAgent: meta.ua,
    });
    return { error: 'Ce compte est désactivé. Contactez l\'administrateur.', errorKey: ekey('accountDisabled') };
  }

  const valid = await verifyPassword(password, user.passwordHash);

  if (!valid) {
    const { lockUntil } = registerFailedAttempt(user.id, user.failedLoginAttempts);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: user.failedLoginAttempts + 1,
        ...(lockUntil ? { lockedUntil: lockUntil } : {}),
      },
    });
    await writeAuditLog({
      centerId: user.centerId,
      userId: user.id,
      action: 'LOGIN_FAILED',
      entityType: 'User',
      entityId: user.id,
      metadata: { reason: 'bad_password', attempt: user.failedLoginAttempts + 1 },
      ipAddress: meta.ip,
      userAgent: meta.ua,
    });
    return GENERIC;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await createSession(user.id, meta);
  await writeAuditLog({
    centerId: user.centerId,
    userId: user.id,
    action: 'LOGIN',
    entityType: 'User',
    entityId: user.id,
    ipAddress: meta.ip,
    userAgent: meta.ua,
  });

  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  const meta = await requestMeta();
  await destroySession();
  if (user) {
    await writeAuditLog({
      centerId: user.centerId,
      userId: user.id,
      action: 'LOGOUT',
      entityType: 'User',
      entityId: user.id,
      ipAddress: meta.ip,
      userAgent: meta.ua,
    });
  }
  redirect('/login');
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, vmsg('currentPasswordRequired')),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, vmsg('confirmPasswordRequired')),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: vmsg('passwordMismatch'),
    path: ['confirmPassword'],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: vmsg('passwordMustDiffer'),
    path: ['newPassword'],
  });

export async function changePasswordAction(
  _prev: LoginState,
  formData: FormData,
): Promise<ActionResult<{ mustChangePassword: boolean }>> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError('UNAUTHENTICATED', 'Session expirée');

    const parsed = changePasswordSchema.safeParse({
      currentPassword: String(formData.get('currentPassword') ?? ''),
      newPassword: String(formData.get('newPassword') ?? ''),
      confirmPassword: String(formData.get('confirmPassword') ?? ''),
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? '_form');
        (fieldErrors[key] ??= []).push(issue.message);
      }
      return { ok: false, error: 'Données invalides', errorKey: ekey('validation'), code: 'VALIDATION', fieldErrors };
    }

    const record = await prisma.user.findUnique({ where: { id: user.id } });
    if (!record) throw new AppError('NOT_FOUND', 'Utilisateur introuvable');

    const valid = await verifyPassword(parsed.data.currentPassword, record.passwordHash);
    if (!valid) {
      return {
        ok: false,
        error: 'Mot de passe actuel incorrect',
        errorKey: ekey('currentPasswordWrong'),
        code: 'VALIDATION',
        fieldErrors: { currentPassword: [ekey('currentPasswordWrong')] },
      };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(parsed.data.newPassword),
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    await writeAuditLog({
      centerId: user.centerId,
      userId: user.id,
      action: 'PASSWORD_CHANGE',
      entityType: 'User',
      entityId: user.id,
    });

    revalidatePath('/', 'layout');
    return ok({ mustChangePassword: false });
  } catch (error) {
    return handleError(error, 'changePassword');
  }
}

export async function getSessionTokenForTest(): Promise<string | null> {
  if (process.env.NODE_ENV === 'production') return null;
  return readSessionToken();
}
