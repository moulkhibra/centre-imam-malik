import { z } from 'zod';
import { LOCALES, ROLES } from '@/lib/constants';
import { vmsg } from '@/lib/validation/messages';
import {
  emailSchema,
  optionalCuidSchema,
  optionalPhoneSchema,
  passwordSchema,
  roleSchema,
  trimmed,
} from '@/lib/validation/common';
import { allOr, familyName, givenName } from '@/lib/validation/people';

/**
 * Validation for the application accounts (Phase 2B).
 *
 * Same contract as the people schemas: the client form imports these to fail
 * fast, and the Server Action parses the identical schema again, because the
 * copy that runs on the server is the one that protects the table.
 */

/**
 * An account is identified by its e-mail and its name; the phone is optional.
 *
 * `emailSchema` lowercases, which matters because the login lookup is by exact
 * e-mail: an account created as `Admin@Centre.tld` and one typed as
 * `admin@centre.tld` at the login screen have to be the same row.
 */
export const userCreateSchema = trimmed(
  z.object({
    email: emailSchema,
    firstName: givenName(),
    lastName: familyName(),
    phone: optionalPhoneSchema,
    role: roleSchema.default('SECRETARY'),
    /**
     * The catalogue teacher this account belongs to. Only meaningful for a
     * TEACHER account; the action checks the teacher is in the same centre and
     * is not already claimed by another account.
     */
    teacherId: optionalCuidSchema,
    /** Language of the interface for this user, as opposed to the cookie. */
    locale: z.enum(LOCALES, { error: vmsg('invalidOption') }).default('fr'),
    /**
     * The initial password. The action always creates the account with
     * `mustChangePassword`, whatever this says: the administrator who types it
     * chose it in front of the user, and it cannot be the user's long-term
     * secret. The field exists so the account is usable the first time.
     */
    password: passwordSchema,
  }),
);

export type UserCreateInput = z.infer<typeof userCreateSchema>;

/**
 * Update.
 *
 * `password` is deliberately absent: changing a password is its own guarded
 * operation (it revokes the open sessions and writes a PASSWORD_RESET entry),
 * not a field of the identity form. `isActive` is absent for the same reason -
 * deactivation is a confirmed action with its own guard on the last
 * administrator.
 */
export const userUpdateSchema = trimmed(
  z.object({
    email: emailSchema,
    firstName: givenName(),
    lastName: familyName(),
    phone: optionalPhoneSchema,
    role: roleSchema,
    teacherId: optionalCuidSchema,
    locale: z.enum(LOCALES, { error: vmsg('invalidOption') }),
  }),
);

export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

/**
 * Administrator-initiated password reset.
 *
 * The confirmation field is compared here rather than in the action: two
 * different fields that must hold the same value is a rule about the submission
 * as a whole, and the message belongs to the input the user has to fix.
 */
export const passwordResetSchema = trimmed(
  z.object({
    password: passwordSchema,
    confirmPassword: z.string({ error: vmsg('passwordRequired') }).min(1, vmsg('passwordRequired')).max(128, vmsg('passwordMaxLength')),
  }),
).refine((value) => value.password === value.confirmPassword, {
  message: vmsg('passwordMismatch'),
  path: ['confirmPassword'],
});

export type PasswordResetInput = z.infer<typeof passwordResetSchema>;

/**
 * A role change is one field, validated on its own so the confirm dialog posts
 * the same schema as the edit form and cannot post a value the enum refuses.
 */
export const roleChangeSchema = trimmed(
  z.object({ role: roleSchema }),
);

export type RoleChangeInput = z.infer<typeof roleChangeSchema>;

// --- List filters ------------------------------------------------------------

export const userFilterSchema = z.object({
  role: allOr(ROLES),
  /** `ACTIVE` / `INACTIVE` mirror the account state, `ALL` is the neutral one. */
  status: allOr(['ACTIVE', 'INACTIVE'] as const),
  /** `PENDING` keeps the accounts still holding their temporary password. */
  password: allOr(['PENDING'] as const),
});

export type UserFilters = z.infer<typeof userFilterSchema>;