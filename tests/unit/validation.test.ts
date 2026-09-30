import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  cinSchema,
  emailSchema,
  hexColorSchema,
  isoDateSchema,
  moneySchema,
  optionalPhoneSchema,
  paginationSchema,
  passwordSchema,
  phoneSchema,
  trimmed,
  roleSchema,
} from '@/lib/validation/common';
import { AppError, fail, handleError, ok, validationError } from '@/lib/utils/errors';

describe('contact validation', () => {
  it('accepts Moroccan mobile numbers and rejects junk', () => {
    expect(phoneSchema.safeParse('06 37 06 52 18').success).toBe(true);
    expect(phoneSchema.safeParse('+212 637 065 218').success).toBe(true);
    expect(phoneSchema.safeParse('06.37.06.52.18').success).toBe(true);
    expect(phoneSchema.safeParse('abc').success).toBe(false);
    expect(phoneSchema.safeParse('06<script>').success).toBe(false);
    expect(phoneSchema.safeParse('123').success).toBe(false);
  });

  it('turns an empty optional phone into null', () => {
    expect(optionalPhoneSchema.parse('')).toBeNull();
    expect(optionalPhoneSchema.parse(undefined)).toBeNull();
    expect(optionalPhoneSchema.parse('06 00 00 00 00')).toBe('06 00 00 00 00');
  });

  it('normalises e-mail to lowercase', () => {
    expect(emailSchema.parse('  Admin@Example.TEST ')).toBe('admin@example.test');
    expect(emailSchema.safeParse('nope').success).toBe(false);
    expect(emailSchema.safeParse('').success).toBe(false);
  });

  it('validates the Moroccan CIN shape', () => {
    expect(cinSchema.parse('ab123456')).toBe('AB123456');
    expect(cinSchema.safeParse('A123456').success).toBe(true);
    expect(cinSchema.safeParse('ABC123456').success).toBe(false);
    expect(cinSchema.safeParse('123456').success).toBe(false);
  });
});

describe('date validation', () => {
  it('accepts only the HTML date format', () => {
    expect(isoDateSchema.parse('2026-09-30')).toBe('2026-09-30');
    expect(isoDateSchema.safeParse('30/09/2026').success).toBe(false);
    expect(isoDateSchema.safeParse('2026-13-01').success).toBe(false);
    expect(isoDateSchema.safeParse('2026-02-31').success).toBe(false);
  });
});

describe('branding validation', () => {
  it('accepts only #RRGGBB so a colour can never inject CSS', () => {
    expect(hexColorSchema.safeParse('#0F766E').success).toBe(true);
    expect(hexColorSchema.safeParse('red').success).toBe(false);
    expect(hexColorSchema.safeParse('#0F766E; background:url(x)').success).toBe(false);
  });
});

describe('money schema', () => {
  it('converts valid input to integer centimes', () => {
    expect(moneySchema.parse('500')).toBe(50_000);
    expect(moneySchema.parse('1 250,50')).toBe(125_050);
    expect(moneySchema.parse(300)).toBe(30_000);
  });

  it('rejects empty, negative, non-numeric and absurd amounts', () => {
    expect(moneySchema.safeParse('').success).toBe(false);
    expect(moneySchema.safeParse('-1').success).toBe(false);
    expect(moneySchema.safeParse('abc').success).toBe(false);
    expect(moneySchema.safeParse('99999999').success).toBe(false);
  });
});

describe('enums', () => {
  it('only accepts known roles', () => {
    expect(roleSchema.parse('DIRECTEUR')).toBe('DIRECTEUR');
    expect(roleSchema.safeParse('ROOT').success).toBe(false);
  });
});

describe('password schema', () => {
  it('mirrors the runtime password policy', () => {
    expect(passwordSchema.safeParse('Passw0rd!2026').success).toBe(true);
    expect(passwordSchema.safeParse('short1').success).toBe(false);
    expect(passwordSchema.safeParse('alllettersonly').success).toBe(false);
    expect(passwordSchema.safeParse('1234567890').success).toBe(false);
    expect(passwordSchema.safeParse('x'.repeat(129)).success).toBe(false);
  });
});

describe('pagination', () => {
  it('applies safe defaults and clamps hostile input', () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, pageSize: 25 });
    expect(paginationSchema.parse({ page: '3', pageSize: '50' })).toEqual({ page: 3, pageSize: 50 });
    expect(paginationSchema.safeParse({ page: 0 }).success).toBe(false);
    expect(paginationSchema.safeParse({ pageSize: 10_000 }).success).toBe(false);
  });
});

describe('trimmed()', () => {
  const schema = trimmed(z.object({ name: z.string().min(1), city: z.string().optional() }));

  it('trims strings and drops unknown keys', () => {
    const result = schema.parse({ name: '  Yassine  ', injected: 'x' });
    expect(result).toEqual({ name: 'Yassine' });
  });

  it('passes non-objects through so the schema reports the real problem', () => {
    expect(schema.safeParse('nope').success).toBe(false);
  });
});

describe('error handling', () => {
  it('maps Zod issues to a field error map', () => {
    const parsed = z.object({ email: emailSchema, phone: phoneSchema }).safeParse({ email: 'x', phone: '' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const error = validationError(parsed.error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('VALIDATION');
    expect(error.fieldErrors?.email).toBeDefined();
  });

  it('never leaks an unknown error to the client', () => {
    const result = handleError(new Error('connection string: postgres://user:hunter2@db/x'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('INTERNAL');
    expect(result.error).not.toContain('hunter2');
  });

  it('translates a Prisma unique-constraint violation into DUPLICATE', () => {
    const result = handleError({ code: 'P2002', meta: { target: ['email'] } });
    expect(result).toMatchObject({ ok: false, code: 'DUPLICATE' });
    if (result.ok) return;
    expect(result.fieldErrors?.email).toBeDefined();
  });

  it('keeps an AppError message and code', () => {
    const result = handleError(new AppError('FORBIDDEN', 'Accès refusé'));
    expect(result).toEqual({ ok: false, error: 'Accès refusé', code: 'FORBIDDEN' });
  });

  it('wraps successful payloads', () => {
    expect(ok({ id: '1' })).toEqual({ ok: true, data: { id: '1' } });
    expect(fail('x', 'NOT_FOUND')).toEqual({ ok: false, error: 'x', code: 'NOT_FOUND' });
  });
});
