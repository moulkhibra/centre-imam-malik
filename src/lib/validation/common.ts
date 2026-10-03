import { z } from 'zod';
import { decimalToCents } from '@/lib/utils/format';
import { vmsg } from '@/lib/validation/messages';
import {
  ATTENDANCE_STATUSES,
  GENDERS,
  LOCALES,
  NOTIFICATION_SEVERITIES,
  NOTIFICATION_TYPES,
  PAYMENT_METHOD_CODES,
  PROMOTION_TYPES,
  ROLES,
  STUDENT_STATUSES,
  BILLING_TYPES,
  REGISTRATION_STATUSES,
  TRAINING_CATEGORIES,
  TRAINING_STATUSES,
  EXAM_TYPES,
  CERTIFICATE_TYPES,
  ROOM_STATUSES,
  ACADEMIC_STAGES,
  DOCUMENT_CATEGORIES,
} from '@/lib/constants';

/**
 * Shared validation primitives.
 *
 * Moroccan phone numbers are 10 digits starting with 05/06/07, but centres also
 * receive landlines and international formats, so validation is permissive on
 * shape and normalised downstream.
 */
export const phoneSchema = z
  .string({ error: vmsg('fieldRequired') })
  .trim()
  .min(6, vmsg('phoneTooShort'))
  .max(25, vmsg('phoneTooLong'))
  .regex(/^[0-9+().\-\s]+$/, vmsg('phoneInvalid'));

export const optionalPhoneSchema = z
  .union([z.literal(''), phoneSchema])
  .optional()
  .transform((v) => (v ? v : null));

export const emailSchema = z
  .string({ error: vmsg('fieldRequired') })
  .trim()
  .toLowerCase()
  .min(5, vmsg('emailTooShort'))
  .max(160, vmsg('emailTooLong'))
  .email(vmsg('emailInvalid'));

export const optionalEmailSchema = z
  .union([z.literal(''), emailSchema])
  .optional()
  .transform((v) => (v ? v : null));

export const cinSchema = z
  .string({ error: vmsg('fieldRequired') })
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{1,2}\d{1,6}$/, vmsg('cinInvalid'));

export const optionalCinSchema = z
  .union([z.literal(''), cinSchema])
  .optional()
  .transform((v) => (v ? v : null));

export const cuidSchema = z.string({ error: vmsg('fieldRequired') }).trim().min(1, vmsg('idRequired')).max(64, vmsg('idRequired'));

/**
 * Date input from HTML <input type="date"> is always "YYYY-MM-DD".
 *
 * The calendar check is explicit rather than `new Date(v)`: JavaScript rolls
 * "2026-02-31" forward to 3 March instead of rejecting it, which would store a
 * date the secretary never entered.
 */
export const isoDateSchema = z
  .string({ error: vmsg('fieldRequired') })
  .trim()
  .regex(/^(\d{4})-(\d{2})-(\d{2})$/, vmsg('dateFormat'))
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number) as [number, number, number];
    if (month < 1 || month > 12 || day < 1) return false;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return day <= lastDay;
  }, vmsg('dateInvalid'));

export const optionalIsoDateSchema = z
  .union([z.literal(''), isoDateSchema])
  .optional()
  .transform((v) => (v || null));

export const hexColorSchema = z
  .string({ error: vmsg('fieldRequired') })
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, vmsg('colorFormat'));

export const localeSchema = z.enum(LOCALES, { error: vmsg('invalidOption') });
export const roleSchema = z.enum(ROLES, { error: vmsg('invalidOption') });
export const genderSchema = z.enum(GENDERS, { error: vmsg('invalidOption') });
export const academicStageSchema = z.enum(ACADEMIC_STAGES, { error: vmsg('invalidOption') });
export const studentStatusSchema = z.enum(STUDENT_STATUSES, { error: vmsg('invalidOption') });
export const paymentMethodCodeSchema = z.enum(PAYMENT_METHOD_CODES, { error: vmsg('invalidOption') });
export const promotionTypeSchema = z.enum(PROMOTION_TYPES, { error: vmsg('invalidOption') });
export const billingTypeSchema = z.enum(BILLING_TYPES, { error: vmsg('invalidOption') });
export const registrationStatusSchema = z.enum(REGISTRATION_STATUSES, { error: vmsg('invalidOption') });
export const attendanceStatusSchema = z.enum(ATTENDANCE_STATUSES, { error: vmsg('invalidOption') });
export const trainingCategorySchema = z.enum(TRAINING_CATEGORIES, { error: vmsg('invalidOption') });
export const trainingStatusSchema = z.enum(TRAINING_STATUSES, { error: vmsg('invalidOption') });
export const examTypeSchema = z.enum(EXAM_TYPES, { error: vmsg('invalidOption') });
export const certificateTypeSchema = z.enum(CERTIFICATE_TYPES, { error: vmsg('invalidOption') });
export const roomStatusSchema = z.enum(ROOM_STATUSES, { error: vmsg('invalidOption') });
export const documentCategorySchema = z.enum(DOCUMENT_CATEGORIES, { error: vmsg('invalidOption') });
export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES, { error: vmsg('invalidOption') });
export const notificationSeveritySchema = z.enum(NOTIFICATION_SEVERITIES, { error: vmsg('invalidOption') });

/**
 * Money input as a decimal string, converted to integer cents.
 *
 * Conversion goes through `decimalToCents` so 1.005 DH becomes 101 centimes
 * instead of 100 (which is what `Math.round(1.005 * 100)` returns in IEEE-754).
 */
export const moneySchema = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    const normalised = typeof v === 'number' ? String(v) : v.trim().replace(/\s/g, '').replace(',', '.');
    if (normalised === '') {
      ctx.addIssue({ code: 'custom', message: vmsg('amountRequired') });
      return z.NEVER;
    }
    if (!/^-?\d*\.?\d*$/.test(normalised)) {
      ctx.addIssue({ code: 'custom', message: vmsg('amountInvalid') });
      return z.NEVER;
    }
    const cents = decimalToCents(normalised);
    if (cents < 0) {
      ctx.addIssue({ code: 'custom', message: vmsg('amountNegative') });
      return z.NEVER;
    }
    if (cents > 100_000_000) {
      ctx.addIssue({ code: 'custom', message: vmsg('amountTooHigh') });
      return z.NEVER;
    }
    return cents;
  });

/**
 * Error map for the coerced numbers below.
 *
 * `z.coerce.number()` is the only way a form's text input can become a number,
 * and on failure it falls back to Zod's own English sentence
 * ("Invalid input: expected number, received NaN"). This replaces it with a key
 * so an Arabic form never shows it.
 */
const intMessages = () => ({ error: vmsg('numberInvalid') }) as const;

export const nonNegativeIntSchema = z.coerce.number(intMessages()).int(vmsg('numberNotInteger')).min(0, vmsg('numberTooSmall')).max(100_000, vmsg('numberTooLarge'));
export const positiveIntSchema = z.coerce.number(intMessages()).int(vmsg('numberNotInteger')).min(1, vmsg('numberTooSmall')).max(100_000, vmsg('numberTooLarge'));
export const scoreSchema = z.coerce.number(intMessages()).min(0, vmsg('numberTooSmall')).max(1000, vmsg('numberTooLarge'));
export const coefficientSchema = z.coerce.number(intMessages()).min(0, vmsg('numberTooSmall')).max(100, vmsg('numberTooLarge'));

export const passwordSchema = z
  .string({ error: vmsg('fieldRequired') })
  .min(8, vmsg('passwordMinLength'))
  .max(128, vmsg('passwordMaxLength'))
  .refine((v) => /[A-Za-z؀-ۿ]/.test(v), vmsg('passwordNeedsLetter'))
  .refine((v) => /\d/.test(v), vmsg('passwordNeedsDigit'));

/** Strips unknown keys and trims every string value. */
export function trimmed<T extends z.ZodType>(schema: T) {
  return z.preprocess((input) => {
    if (typeof input !== 'object' || input === null) return input;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      out[key] = typeof value === 'string' ? value.trim() : value;
    }
    return out;
  }, schema);
}

export const paginationSchema = z.object({
  page: z.coerce.number(intMessages()).int(vmsg('numberNotInteger')).min(1, vmsg('numberTooSmall')).max(100_000, vmsg('numberTooLarge')).default(1),
  pageSize: z.coerce.number(intMessages()).int(vmsg('numberNotInteger')).min(5, vmsg('numberTooSmall')).max(200, vmsg('numberTooLarge')).default(25),
});

export type Pagination = z.infer<typeof paginationSchema>;

export const sortOrderSchema = z.enum(['asc', 'desc'], { error: vmsg('invalidOption') }).default('asc');
