import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError, handleError, ok, validationError } from '@/lib/utils/errors';

/**
 * The error boundary every Server Action returns through.
 *
 * The contract that matters: a failure the user caused (bad input, missing
 * permission, duplicate) comes back as a readable message with the right code,
 * and only a genuine bug is reported as INTERNAL.
 */
describe('handleError', () => {
  it('keeps a domain error code and its per-field messages', () => {
    const result = handleError(new AppError('VALIDATION', 'Données invalides', { cin: ['CIN déjà utilisé'] }));
    expect(result).toMatchObject({ ok: false, code: 'VALIDATION', error: 'Données invalides' });
    expect(result.ok === false && result.fieldErrors?.cin).toEqual(['CIN déjà utilisé']);
  });

  it('turns Zod issues into a field map keyed by field name', () => {
    const parsed = z.object({ code: z.string().min(3, 'Trop court') }).safeParse({ code: 'A' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const result = handleError(parsed.error);
    expect(result).toMatchObject({ ok: false, code: 'VALIDATION' });
    expect(result.ok === false && result.fieldErrors?.code).toEqual(['Trop court']);
  });

  it('reports a unique-constraint violation as a duplicate on the offending field', () => {
    // P2002 is the single most common failure on these screens: two people
    // saving the same code, or two rooms with the same name.
    // `@@unique([centerId, name])` reports both columns; the message belongs to
    // `name`, the field the user filled in. `centerId.name` was never read by
    // any form, so the duplicate silently had no message next to the input.
    const result = handleError({ code: 'P2002', meta: { target: ['centerId', 'name'] } });
    expect(result).toMatchObject({ ok: false, code: 'DUPLICATE' });
    expect(result.ok === false && result.fieldErrors?.['name']).toBeTruthy();
    expect(result.ok === false && result.fieldErrors?.['centerId.name']).toBeUndefined();
  });

  it('maps a missing row and a broken foreign key', () => {
    expect(handleError({ code: 'P2025' })).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(handleError({ code: 'P2003' })).toMatchObject({ ok: false, code: 'VALIDATION' });
  });

  it('reports a missing permission as FORBIDDEN, not as a server fault', () => {
    // `AuthError` carries a string `code`, so it used to be swallowed by the
    // Prisma sniff and reported to the secretary as "Une erreur interne est
    // survenue" the moment they used a button their role does not allow.
    class AuthError extends Error {
      readonly code: string;
      constructor(code: string) {
        super(`Missing permission: students.delete`);
        this.name = 'AuthError';
        this.code = code;
      }
    }

    const forbidden = handleError(new AuthError('FORBIDDEN'));
    expect(forbidden).toMatchObject({ ok: false, code: 'FORBIDDEN', error: 'Accès refusé' });

    const unauthenticated = handleError(new AuthError('UNAUTHENTICATED'));
    expect(unauthenticated).toMatchObject({ ok: false, code: 'UNAUTHENTICATED' });
  });

  it('never leaks a stack trace or a SQL string to the client', () => {
    const result = handleError(new Error('connect ECONNREFUSED 10.0.0.5:5432 password=hunter2'));
    expect(result).toMatchObject({ ok: false, code: 'INTERNAL' });
    const serialised = JSON.stringify(result);
    expect(serialised).not.toContain('hunter2');
    expect(serialised).not.toContain('ECONNREFUSED');
  });

  it('returns ok() untouched', () => {
    expect(ok({ id: 'abc' })).toEqual({ ok: true, data: { id: 'abc' } });
  });
});

describe('validationError', () => {
  it('files a form-level issue under _form rather than dropping it', () => {
    const error = validationError(new z.ZodError([{ code: 'custom', path: [], message: 'Formulaire incomplet' }]));
    expect(error.fieldErrors?._form).toEqual(['Formulaire incomplet']);
  });
});
