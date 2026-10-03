import type { Locale } from '@/lib/constants';
import { ar } from '@/lib/i18n/dictionaries/ar';
import { fr } from '@/lib/i18n/dictionaries/fr';

/**
 * Validation messages travel as keys, not as text.
 *
 * Zod schemas are shared by the client form and the Server Action, and both run
 * outside any request-time locale: a schema cannot know whether it is validating
 * for a French or an Arabic user, so it must not carry a literal sentence. Each
 * rule therefore stores a `validation.*` key, and the key is turned into text at
 * the moment it is displayed (see `resolveValidationMessage`).
 *
 * That inversion is what fixes the Phase 2 defect where an Arabic form showed
 * `Prénom invalide`: the message was baked into the schema, and no amount of
 * dictionary work could reach it.
 */

/** Prefix every validation message key carries, so they are recognisable. */
export const VALIDATION_PREFIX = 'validation.';

/**
 * The keys are derived from the French dictionary, which is the reference one:
 * adding a key here without adding it to `fr.validation` is a type error, and
 * `tests/unit/validation-messages.test.ts` checks the Arabic side separately.
 */
export type ValidationKey = keyof typeof fr.validation;

export type ValidationMessage = `${typeof VALIDATION_PREFIX}${ValidationKey}`;

export type ValidationMessages = Record<ValidationKey, string>;

const KEYS = Object.keys(fr.validation) as ValidationKey[];

/**
 * Writes a message key into a Zod rule.
 *
 * Typed on purpose: a typo, or a key removed from the dictionaries, fails
 * `tsc` here rather than surfacing as a raw key in the interface.
 */
export function vmsg(key: ValidationKey): ValidationMessage {
  return `${VALIDATION_PREFIX}${key}`;
}

/** Builds the full message table for one locale. */
export function validationMessages(locale: Locale): ValidationMessages {
  const source = locale === 'ar' ? ar.validation : fr.validation;
  const messages = {} as ValidationMessages;
  for (const key of KEYS) messages[key] = source[key];
  return messages;
}

export function isValidationMessage(value: string): value is ValidationMessage {
  return value.startsWith(VALIDATION_PREFIX) && KEYS.includes(value.slice(VALIDATION_PREFIX.length) as ValidationKey);
}

/**
 * Turns a stored message into display text.
 *
 * A value that is not a validation key is returned untouched. Server Actions
 * also push their own sentences into the same field-error map (`Données
 * invalides`, `Cette valeur existe déjà`, ...), and rewriting those here would
 * mean inventing translations for strings this module does not own. Leaving
 * them alone keeps the change honest: every *rule* is translated, and anything
 * else still renders as it always did.
 */
export function resolveValidationMessage(value: string, messages: ValidationMessages): string {
  if (!isValidationMessage(value)) return value;
  return messages[value.slice(VALIDATION_PREFIX.length) as ValidationKey] ?? value;
}