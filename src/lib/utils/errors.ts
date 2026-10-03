import { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';
import { ekey, type ErrorMessage } from '@/lib/validation/messages';

/**
 * Centralised error handling for Server Actions and route handlers.
 *
 * Rules enforced here:
 *  - Zod issues are converted to a stable, translatable field map.
 *  - Known domain errors keep their code.
 *  - Prisma unique-constraint violations (P2002) become DUPLICATE errors.
 *  - Everything else is logged server-side and returned as a generic message.
 *    Stack traces and SQL never reach the client.
 *
 * Every result also carries an `errors.*` key next to its French `error`
 * sentence, and that is what the interface shows. A Server Action cannot know
 * whether it is answering a French or an Arabic user - the payload is built
 * outside any request-time locale - so returning a bare sentence meant the
 * banner was French on every screen. The sentence is kept because it is what the
 * server logs and what the integration suite asserts on;
 * `tests/unit/error-messages.test.ts` checks the two cannot drift apart.
 */

export type FieldErrors = Record<string, string[]>;

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; errorKey: ErrorMessage; code: ErrorCode; fieldErrors?: FieldErrors };

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
  /** The translated banner this error maps to; see `DOMAIN_KEY_BY_CODE`. */
  readonly errorKey: ErrorMessage;

  constructor(
    code: ErrorCode,
    message: string,
    fieldErrors?: FieldErrors,
    errorKey?: ErrorMessage,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.errorKey = errorKey ?? DOMAIN_KEY_BY_CODE[code];
  }
}

export function validationError(issues: z.ZodError): AppError {
  const fieldErrors: FieldErrors = {};
  for (const issue of issues.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_form';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return new AppError('VALIDATION', 'Données invalides', fieldErrors, ekey('validation'));
}

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(
  error: string,
  code: ErrorCode = 'INTERNAL',
  fieldErrors?: FieldErrors,
  errorKey: ErrorMessage = DOMAIN_KEY_BY_CODE[code],
): ActionResult<never> {
  return { ok: false, error, errorKey, code, ...(fieldErrors ? { fieldErrors } : {}) };
}

/**
 * Which banner each code shows, as a dictionary key.
 *
 * Entity-specific sentences ('Élève introuvable') stay on the `AppError` for the
 * log and collapse to the generic key here: a key per entity would mean
 * inventing a dozen translations for a message nobody reads on screen.
 */
const DOMAIN_KEY_BY_CODE: Record<ErrorCode, ErrorMessage> = {
  VALIDATION: ekey('validation'),
  UNAUTHENTICATED: ekey('sessionExpired'),
  FORBIDDEN: ekey('forbidden'),
  NOT_FOUND: ekey('notFound'),
  DUPLICATE: ekey('duplicate'),
  CONFLICT: ekey('conflict'),
  RATE_LIMITED: ekey('rateLimited'),
  INTERNAL: ekey('serverError'),
};

/** Kept verbatim from Phase 2, and asserted against `fr.errors` by the tests. */
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
/**
 * Which form field a unique-constraint violation belongs to.
 *
 * Two traps, both found by reading the real error rather than the docs:
 *
 * 1. Since Prisma 7 with a driver adapter (`@prisma/adapter-better-sqlite3`)
 *    there is **no** `meta.target`. The columns arrive as
 *    `meta.driverAdapterError.cause.constraint.fields`. Reading only `target`
 *    silently produced *no* field error at all, so a duplicate showed a banner
 *    and nothing next to the input the user had to change.
 * 2. Every tenant-scoped code is declared `@@unique([centerId, code])`, so both
 *    columns come back. `centerId` is never a form field and `centerId.code` is
 *    not a field any form renders, so the joined name is dropped in favour of
 *    the one column the user typed. A genuinely composite rule over two user
 *    fields would still join - no form reads that yet, which is a Phase 3
 *    concern rather than a silent regression here.
 */
function duplicateFieldErrors(meta: Record<string, unknown> | undefined): FieldErrors | undefined {
  const target = meta?.['target'];
  const adapterConstraint = (meta?.['driverAdapterError'] as { cause?: { constraint?: { fields?: unknown } } } | undefined)
    ?.cause?.constraint?.fields;
  const raw = adapterConstraint ?? (Array.isArray(target) ? target : [target]);
  const fields = (Array.isArray(raw) ? raw : [raw]).filter(
    (field): field is string => typeof field === 'string' && field !== 'centerId',
  );
  if (fields.length === 0) return undefined;
  return { [fields.length === 1 ? fields[0]! : fields.join('.')]: [ekey('valueAlreadyUsed')] };
}

export function handleError(error: unknown, context?: string): ActionResult<never> {
  if (error instanceof AppError) {
    return fail(error.message, error.code, error.fieldErrors, error.errorKey);
  }

  if (error instanceof z.ZodError) {
    const appError = validationError(error);
    return fail(appError.message, appError.code, appError.fieldErrors, appError.errorKey);
  }

  // An authorization failure is an expected outcome, not a bug: the user is
  // signed in but lacks the permission, so it gets the matching domain message
  // and is never logged as a server error.
  if (isAuthorizationError(error)) {
    return fail(DOMAIN_MESSAGE_BY_CODE[error.code], error.code, undefined, DOMAIN_KEY_BY_CODE[error.code]);
  }

  if (isPrismaKnownError(error)) {
    if (error.code === 'P2002') {
      return fail(
        'Cette valeur existe déjà',
        'DUPLICATE',
        duplicateFieldErrors(error.meta),
        ekey('duplicate'),
      );
    }
    if (error.code === 'P2025') {
      return fail('Ressource introuvable', 'NOT_FOUND', undefined, ekey('notFound'));
    }
    if (error.code === 'P2003') {
      return fail('Référence invalide : élément lié introuvable', 'VALIDATION', undefined, ekey('invalidReference'));
    }
  }

  // Anything not explicitly handled is a bug: log it, never leak it.
  console.error(`[error]${context ? ` (${context})` : ''}`, error);
  return fail(DOMAIN_MESSAGE_BY_CODE.INTERNAL, 'INTERNAL', undefined, DOMAIN_KEY_BY_CODE.INTERNAL);
}

export { Prisma };
