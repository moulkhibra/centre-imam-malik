import '@/lib/utils/server-only';
import { z } from 'zod';

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
