import { z } from 'zod';
import { decimalToCents } from '@/lib/utils/format';
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
  .string()
  .trim()
  .min(6, 'Numéro de téléphone trop court')
  .max(25, 'Numéro de téléphone trop long')
  .regex(/^[0-9+().\-\s]+$/, 'Numéro de téléphone invalide');

export const optionalPhoneSchema = z
  .union([z.literal(''), phoneSchema])
  .optional()
  .transform((v) => (v ? v : null));

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, 'E-mail trop court')
  .max(160, 'E-mail trop long')
  .email('E-mail invalide');

export const optionalEmailSchema = z
  .union([z.literal(''), emailSchema])
  .optional()
  .transform((v) => (v ? v : null));

export const cinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{1,2}\d{1,6}$/, 'CIN invalide (ex: AB123456)');

export const optionalCinSchema = z
  .union([z.literal(''), cinSchema])
  .optional()
  .transform((v) => (v ? v : null));

export const cuidSchema = z.string().trim().min(1, 'Identifiant requis').max(64);

/**
 * Date input from HTML <input type="date"> is always "YYYY-MM-DD".
 *
 * The calendar check is explicit rather than `new Date(v)`: JavaScript rolls
 * "2026-02-31" forward to 3 March instead of rejecting it, which would store a
 * date the secretary never entered.
 */
export const isoDateSchema = z
  .string()
  .trim()
  .regex(/^(\d{4})-(\d{2})-(\d{2})$/, 'Date attendue au format AAAA-MM-JJ')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number) as [number, number, number];
    if (month < 1 || month > 12 || day < 1) return false;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return day <= lastDay;
  }, 'Date invalide');

export const optionalIsoDateSchema = z
  .union([z.literal(''), isoDateSchema])
  .optional()
  .transform((v) => (v || null));

export const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur attendue au format #RRGGBB');

export const localeSchema = z.enum(LOCALES);
export const roleSchema = z.enum(ROLES);
export const genderSchema = z.enum(GENDERS);
export const academicStageSchema = z.enum(ACADEMIC_STAGES);
export const studentStatusSchema = z.enum(STUDENT_STATUSES);
export const paymentMethodCodeSchema = z.enum(PAYMENT_METHOD_CODES);
export const promotionTypeSchema = z.enum(PROMOTION_TYPES);
export const billingTypeSchema = z.enum(BILLING_TYPES);
export const registrationStatusSchema = z.enum(REGISTRATION_STATUSES);
export const attendanceStatusSchema = z.enum(ATTENDANCE_STATUSES);
export const trainingCategorySchema = z.enum(TRAINING_CATEGORIES);
export const trainingStatusSchema = z.enum(TRAINING_STATUSES);
export const examTypeSchema = z.enum(EXAM_TYPES);
export const certificateTypeSchema = z.enum(CERTIFICATE_TYPES);
export const roomStatusSchema = z.enum(ROOM_STATUSES);
export const documentCategorySchema = z.enum(DOCUMENT_CATEGORIES);
export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export const notificationSeveritySchema = z.enum(NOTIFICATION_SEVERITIES);

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
      ctx.addIssue({ code: 'custom', message: 'Montant obligatoire' });
      return z.NEVER;
    }
    if (!/^-?\d*\.?\d*$/.test(normalised)) {
      ctx.addIssue({ code: 'custom', message: 'Montant invalide' });
      return z.NEVER;
    }
    const cents = decimalToCents(normalised);
    if (cents < 0) {
      ctx.addIssue({ code: 'custom', message: 'Le montant ne peut pas être négatif' });
      return z.NEVER;
    }
    if (cents > 100_000_000) {
      ctx.addIssue({ code: 'custom', message: 'Montant trop élevé' });
      return z.NEVER;
    }
    return cents;
  });

export const nonNegativeIntSchema = z.coerce.number().int().min(0).max(100_000);
export const positiveIntSchema = z.coerce.number().int().min(1).max(100_000);
export const scoreSchema = z.coerce.number().min(0).max(1000);
export const coefficientSchema = z.coerce.number().min(0).max(100);

export const passwordSchema = z
  .string()
  .min(8, 'Au moins 8 caractères')
  .max(128, 'Maximum 128 caractères')
  .refine((v) => /[A-Za-z؀-ۿ]/.test(v), 'Au moins une lettre')
  .refine((v) => /\d/.test(v), 'Au moins un chiffre');

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
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(5).max(200).default(25),
});

export type Pagination = z.infer<typeof paginationSchema>;

export const sortOrderSchema = z.enum(['asc', 'desc']).default('asc');
