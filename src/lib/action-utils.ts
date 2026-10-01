import '@/lib/utils/server-only';
import { z } from 'zod';
import { AppError } from '@/lib/utils/errors';

/**
 * Helpers shared by every Phase 2 Server Action.
 *
 * Lives outside the `'use server'` modules on purpose: a module marked
 * `'use server'` may only export async functions, so shared code cannot live
 * inside one.
 */

/**
 * Parses a `<form>` submission with the entity's Zod schema.
 *
 * `Object.fromEntries` keeps only the last value of a repeated field, so a
 * crafted payload with two `email` entries cannot make the server see a
 * different value than the one the schema validated.
 *
 * A failure throws the `ZodError`, which `handleError` converts into per-field
 * messages: the caller catches it and the form highlights the offending input.
 */
export function parseForm<TSchema extends z.ZodType>(
  schema: TSchema,
  formData: FormData,
): z.infer<TSchema> {
  const result = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!result.success) throw result.error;
  return result.data;
}

/**
 * Generates the next free code in a series, e.g. `ELE-0007`.
 *
 * Codes are optional in the UI but every list sorts and searches on them, so a
 * generated one is more useful than a blank. The highest existing code is
 * scanned rather than assumed gapless, because deleting row 3 must not cause
 * row 4 to be handed out again.
 */
export async function nextCode(
  highestExisting: Array<string | null>,
  prefix: string,
  width = 4,
): Promise<string> {
  let highest = 0;
  for (const code of highestExisting) {
    if (!code || !code.startsWith(prefix)) continue;
    const parsed = Number.parseInt(code.slice(prefix.length), 10);
    if (Number.isFinite(parsed) && parsed > highest) highest = parsed;
  }
  return `${prefix}${String(highest + 1).padStart(width, '0')}`;
}

/** `new Date('2026-03-01')` without the UTC/local ambiguity of `new Date(string)`. */
export function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  return new Date(year, month - 1, day);
}

/**
 * Enforces the "type the code to confirm" step of a destructive dialog.
 *
 * The dialog shows the record's code and asks the user to retype it, so the
 * server has to compare it. Checking only that the field is non-empty made the
 * whole step decorative: any character, including a single space, deleted the
 * record. Comparison is case-insensitive and ignores surrounding whitespace
 * because the code is displayed to the secretary before they type it.
 *
 * A record with no code (one created before codes were auto-assigned) cannot be
 * confirmed this way; only a non-empty answer is accepted, which is the most the
 * UI can ask for in that case.
 */
export function requireConfirmation(record: { code: string | null }, typed: string): void {
  const answer = typed.trim();
  if (!answer) {
    throw new AppError('VALIDATION', 'Confirmation requise', {
      confirmCode: ['Saisissez le code pour confirmer'],
    });
  }
  if (record.code && answer.toLowerCase() !== record.code.trim().toLowerCase()) {
    throw new AppError('VALIDATION', 'Confirmation incorrecte', {
      confirmCode: ['Le code saisi ne correspond pas'],
    });
  }
}
