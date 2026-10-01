import { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';

/**
 * Centralised error handling for Server Actions and route handlers.
 *
 * Rules enforced here:
 *  - Zod issues are converted to a stable, translatable field map.
 *  - Known domain errors keep their code.
 *  - Prisma unique-constraint violations (P2002) become DUPLICATE errors.
 *  - Everything else is logged server-side and returned as a generic message.
 *    Stack traces and SQL never reach the client.
 */

export type FieldErrors = Record<string, string[]>;

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: ErrorCode; fieldErrors?: FieldErrors };

export type ErrorCode =
  | 'VALIDATION'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'DUPLICATE'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: FieldErrors;

  constructor(code: ErrorCode, message: string, fieldErrors?: FieldErrors) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export function validationError(issues: z.ZodError): AppError {
  const fieldErrors: FieldErrors = {};
  for (const issue of issues.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_form';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return new AppError('VALIDATION', 'Données invalides', fieldErrors);
}

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string, code: ErrorCode = 'INTERNAL', fieldErrors?: FieldErrors): ActionResult<never> {
  return { ok: false, error, code, ...(fieldErrors ? { fieldErrors } : {}) };
}

const DOMAIN_MESSAGE_BY_CODE: Record<ErrorCode, string> = {
  VALIDATION: 'Données invalides',
  UNAUTHENTICATED: 'Session expirée, veuillez vous reconnecter',
  FORBIDDEN: 'Accès refusé',
  NOT_FOUND: 'Ressource introuvable',
  DUPLICATE: 'Cette valeur existe déjà',
  CONFLICT: 'Conflit détecté',
  RATE_LIMITED: 'Trop de tentatives, réessayez plus tard',
  INTERNAL: 'Une erreur interne est survenue',
};

function isPrismaKnownError(error: unknown): error is { code: string; meta?: Record<string, unknown> } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  );
}

/**
 * Recognises an authorization failure without importing `@/lib/auth/permissions`.
 *
 * That module pulls Prisma and the session helpers into the graph, and this one
 * is imported from places that must stay free of both. `AuthError` is identified
 * by its own name and by a `code` drawn from `ErrorCode`, which is also why it
 * has to be tested *before* `isPrismaKnownError`: it carries a string `code`, so
 * the Prisma sniff would otherwise claim it and report a permission failure as
 * "Une erreur interne est survenue".
 */
function isAuthorizationError(
  error: unknown,
): error is { code: 'UNAUTHENTICATED' | 'FORBIDDEN' } {
  if (!(error instanceof Error) || error.name !== 'AuthError') return false;
  const code = (error as { code?: unknown }).code;
  return code === 'UNAUTHENTICATED' || code === 'FORBIDDEN';
}

/**
 * Converts any thrown value into a safe `ActionResult`.
 * Must be used at the boundary of every Server Action / route handler.
 */
export function handleError(error: unknown, context?: string): ActionResult<never> {
  if (error instanceof AppError) {
    return fail(error.message, error.code, error.fieldErrors);
  }

  if (error instanceof z.ZodError) {
    const appError = validationError(error);
    return fail(appError.message, appError.code, appError.fieldErrors);
  }

  // An authorization failure is an expected outcome, not a bug: the user is
  // signed in but lacks the permission, so it gets the matching domain message
  // and is never logged as a server error.
  if (isAuthorizationError(error)) {
    return fail(DOMAIN_MESSAGE_BY_CODE[error.code], error.code);
  }

  if (isPrismaKnownError(error)) {
    if (error.code === 'P2002') {
      const target = (error.meta?.['target'] as string[] | string | undefined) ?? [];
      const fields = Array.isArray(target) ? target : [target];
      return fail(
        'Cette valeur existe déjà',
        'DUPLICATE',
        fields.length > 0 ? { [fields.join('.')]: ['Valeur déjà utilisée'] } : undefined,
      );
    }
    if (error.code === 'P2025') {
      return fail('Ressource introuvable', 'NOT_FOUND');
    }
    if (error.code === 'P2003') {
      return fail('Référence invalide : élément lié introuvable', 'VALIDATION');
    }
  }

  // Anything not explicitly handled is a bug: log it, never leak it.
  console.error(`[error]${context ? ` (${context})` : ''}`, error);
  return fail(DOMAIN_MESSAGE_BY_CODE.INTERNAL, 'INTERNAL');
}

export { Prisma };
