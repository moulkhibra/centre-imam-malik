import { z } from 'zod';
import {
  ACADEMIC_STAGES,
  GENDERS,
  ROOM_STATUSES,
  STUDENT_STATUSES,
} from '@/lib/constants';
import { vmsg } from '@/lib/validation/messages';
import {
  cuidSchema,
  isoDateSchema,
  nonNegativeIntSchema,
  optionalCinSchema,
  optionalEmailSchema,
  optionalPhoneSchema,
  trimmed,
} from '@/lib/validation/common';

/**
 * Validation for the people records introduced in Phase 2.
 *
 * These schemas are the single source of truth for both sides of the wire:
 * the client forms import them to validate before submitting, and the server
 * actions parse the very same schema again. Client-side validation is a
 * convenience, never a guarantee — the server copy is the one that protects
 * the database.
 */

/**
 * Accepts any Unicode letter, so a Moroccan name written with a diacritic or a
 * second Latin script is not rejected at the door.
 */
const LATIN_NAME = /^[\p{L}\s'’\-.,]{2,80}$/u;

/**
 * The two name rules, identical for a student, a parent and a teacher.
 *
 * They were copy-pasted into all three schemas, which is how the wording ended
 * up translated three times; one helper keeps the three screens in step.
 */
const givenName = () =>
  z.string({ error: vmsg('fieldRequired') }).trim().min(2, vmsg('firstNameTooShort')).max(80, vmsg('firstNameTooLong')).regex(LATIN_NAME, vmsg('firstNameInvalid'));

const familyName = () =>
  z.string({ error: vmsg('fieldRequired') }).trim().min(2, vmsg('lastNameTooShort')).max(80, vmsg('lastNameTooLong')).regex(LATIN_NAME, vmsg('lastNameInvalid'));

/** Optional free-text field: empty string is normalised to NULL, not ''. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, vmsg('textTooLong'))
    .optional()
    .transform((value) => (value ? value : null));

const optionalShortText = (max: number) =>
  z
    .union([z.literal(''), z.string().trim().max(max, vmsg('textTooLong'))])
    .optional()
    .transform((value) => (value ? value : null));

/**
 * `z.string().date()` accepts any calendar date but also requires the canonical
 * `YYYY-MM-DD` shape, whereas a form submits an empty string for "unset".
 */
const optionalDate = z
  .union([z.literal(''), isoDateSchema])
  .optional()
  .transform((value) => (value ? value : null));

const birthDateSchema = z
  .string()
  .trim()
  .regex(/^(\d{4})-(\d{2})-(\d{2})$/, vmsg('birthDateFormat'))
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number) as [number, number, number];
    if (month < 1 || month > 12 || day < 1) return false;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (day > lastDay) return false;
    // A centre cannot enrol a newborn or a centenarian.
    const yearNow = new Date().getUTCFullYear();
    return year >= yearNow - 90 && year <= yearNow;
  }, vmsg('birthDateInvalid'));

const optionalBirthDate = z
  .union([z.literal(''), birthDateSchema])
  .optional()
  .transform((value) => (value ? value : null));

/** Centre-assigned code: uppercase, no spaces, so it is readable in a report. */
const codeSchema = z
  .string({ error: vmsg('fieldRequired') })
  .trim()
  .toUpperCase()
  .min(1, vmsg('codeRequired'))
  .max(20, vmsg('codeTooLong'))
  .regex(/^[A-Z0-9][A-Z0-9\-_]*$/, vmsg('codeInvalid'));

const optionalCodeSchema = z
  .union([z.literal(''), codeSchema])
  .optional()
  .transform((value) => (value || null));

// --- Student ----------------------------------------------------------------

export const studentCreateSchema = trimmed(
  z.object({
    code: optionalCodeSchema,
    firstName: givenName(),
    lastName: familyName(),
    firstNameAr: optionalShortText(80),
    lastNameAr: optionalShortText(80),
    birthDate: optionalBirthDate,
    gender: z.enum(GENDERS, { error: vmsg('invalidOption') }).optional(),
    cin: optionalCinSchema,
    phone: optionalPhoneSchema,
    whatsapp: optionalPhoneSchema,
    email: optionalEmailSchema,
    address: optionalText(200),
    city: optionalText(80),
    school: optionalText(120),
    levelId: cuidSchema.optional().nullable(),
    emergencyContactName: optionalText(120),
    emergencyContactPhone: optionalPhoneSchema,
    notes: optionalText(1000),
    status: z.enum(STUDENT_STATUSES, { error: vmsg('invalidOption') }).default('ACTIVE'),
  }),
);

export type StudentInput = z.infer<typeof studentCreateSchema>;

/**
 * Update accepts exactly the same fields; the action re-checks ownership.
 *
 * `firstName` / `lastName` stay mandatory here on purpose: an update that
 * submitted neither would otherwise be able to blank both columns, so the schema
 * itself is what refuses an all-blank form rather than a separate guard.
 */
export const studentUpdateSchema = studentCreateSchema;

// --- Parent -----------------------------------------------------------------

export const parentCreateSchema = trimmed(
  z.object({
    code: optionalCodeSchema,
    firstName: givenName(),
    lastName: familyName(),
    cin: optionalCinSchema,
    phone: optionalPhoneSchema,
    whatsapp: optionalPhoneSchema,
    email: optionalEmailSchema,
    address: optionalText(200),
    city: optionalText(80),
    relation: optionalText(60),
    notes: optionalText(1000),
  }),
);

export type ParentInput = z.infer<typeof parentCreateSchema>;
export const parentUpdateSchema = parentCreateSchema;

// --- Teacher ----------------------------------------------------------------

export const teacherCreateSchema = trimmed(
  z.object({
    code: optionalCodeSchema,
    firstName: givenName(),
    lastName: familyName(),
    firstNameAr: optionalShortText(80),
    lastNameAr: optionalShortText(80),
    phone: optionalPhoneSchema,
    whatsapp: optionalPhoneSchema,
    email: optionalEmailSchema,
    cin: optionalCinSchema,
    specialization: optionalText(120),
    bio: optionalText(1000),
    hiredAt: optionalDate,
    status: z.enum(STUDENT_STATUSES, { error: vmsg('invalidOption') }).default('ACTIVE'),
    notes: optionalText(1000),
  }),
);

export type TeacherInput = z.infer<typeof teacherCreateSchema>;
export const teacherUpdateSchema = teacherCreateSchema;

// --- Academic level ---------------------------------------------------------

export const levelCreateSchema = trimmed(
  z.object({
    code: codeSchema,
    stage: z.enum(ACADEMIC_STAGES, { error: vmsg('invalidOption') }),
    nameFr: z.string({ error: vmsg('fieldRequired') }).trim().min(2, vmsg('lastNameTooShort')).max(80, vmsg('lastNameTooLong')),
    nameAr: optionalShortText(80),
    sortOrder: nonNegativeIntSchema.default(0),
    active: z.coerce.boolean().default(true),
  }),
);

export type LevelInput = z.infer<typeof levelCreateSchema>;
export const levelUpdateSchema = levelCreateSchema;

// --- Subject (and languages, which are subjects flagged `isLanguage`) -------

export const subjectCreateSchema = trimmed(
  z.object({
    code: codeSchema,
    nameFr: z.string({ error: vmsg('fieldRequired') }).trim().min(2, vmsg('lastNameTooShort')).max(80, vmsg('lastNameTooLong')),
    nameAr: optionalShortText(80),
    categoryId: cuidSchema.optional().nullable(),
    description: optionalText(500),
    isLanguage: z.coerce.boolean().default(false),
    active: z.coerce.boolean().default(true),
  }),
);

export type SubjectInput = z.infer<typeof subjectCreateSchema>;
export const subjectUpdateSchema = subjectCreateSchema;

// --- Service ----------------------------------------------------------------

export const serviceCreateSchema = trimmed(
  z.object({
    code: codeSchema,
    nameFr: z.string({ error: vmsg('fieldRequired') }).trim().min(2, vmsg('lastNameTooShort')).max(80, vmsg('lastNameTooLong')),
    nameAr: optionalShortText(80),
    description: optionalText(500),
    defaultPriceCents: nonNegativeIntSchema.default(0),
    defaultDurationMinutes: nonNegativeIntSchema.default(0),
    active: z.coerce.boolean().default(true),
  }),
);

export type ServiceInput = z.infer<typeof serviceCreateSchema>;
export const serviceUpdateSchema = serviceCreateSchema;

// --- Room -------------------------------------------------------------------

export const roomCreateSchema = trimmed(
  z.object({
    name: z.string({ error: vmsg('fieldRequired') }).trim().min(1, vmsg('nameRequired')).max(80, vmsg('lastNameTooLong')),
    capacity: nonNegativeIntSchema.default(0),
    location: optionalText(120),
    equipment: optionalText(300),
    status: z.enum(ROOM_STATUSES, { error: vmsg('invalidOption') }).default('AVAILABLE'),
    notes: optionalText(500),
    active: z.coerce.boolean().default(true),
  }),
);

export type RoomInput = z.infer<typeof roomCreateSchema>;
export const roomUpdateSchema = roomCreateSchema;

// --- List filters ------------------------------------------------------------

/**
 * List filters.
 *
 * `ALL` is the neutral value and is stripped from the URL by `listHref`, so a
 * default view has no query string at all.
 */
const allOr = <T extends readonly [string, ...string[]]>(values: T) =>
  z.union([z.literal('ALL'), z.enum(values)]).catch('ALL' as never).default('ALL' as never);

export const studentFilterSchema = z.object({
  status: allOr(STUDENT_STATUSES),
  gender: allOr(GENDERS),
  level: z.string().trim().catch('').default(''),
});

export const parentFilterSchema = z.object({});

export const teacherFilterSchema = z.object({
  status: allOr(STUDENT_STATUSES),
});

export const catalogFilterSchema = z.object({
  active: z.union([z.literal('ALL'), z.literal('true'), z.literal('false')])
    .catch('ALL' as never)
    .default('ALL' as never),
  stage: z.string().trim().catch('').default(''),
});

export type StudentFilters = z.infer<typeof studentFilterSchema>;
export type TeacherFilters = z.infer<typeof teacherFilterSchema>;
export type CatalogFilters = z.infer<typeof catalogFilterSchema>;
