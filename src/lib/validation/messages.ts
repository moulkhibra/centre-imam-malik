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
 * Turns a stored rule message into display text.
 *
 * A value that is not a validation key is returned untouched. The `errors.*`
 * namespace below shares the same convention and is resolved by
 * `resolveMessage`; a sentence that is neither key (a log line, a test fixture)
 * still renders as it always did.
 */
export function resolveValidationMessage(value: string, messages: ValidationMessages): string {
  if (!isValidationMessage(value)) return value;
  return messages[value.slice(VALIDATION_PREFIX.length) as ValidationKey] ?? value;
}

// --- Banner messages ---------------------------------------------------------

/**
 * Banner messages work the same way, for the same reason.
 *
 * A Server Action runs outside any request-time locale - the payload it returns
 * is built by code that cannot tell a French user from an Arabic one - so the
 * message it pushes to the client cannot be a sentence either. It carries an
 * `errors.*` key, and the banner turns it into text where the locale *is* known.
 *
 * Before this, `handleError` returned French literals ('Données invalides',
 * 'Cette valeur existe déjà') that the interface showed verbatim: an Arabic user
 * who duplicated a code was told so in French, at the top of the form.
 */

/** Prefix every banner message key carries, so they are recognisable. */
export const ERROR_PREFIX = 'errors.';

/**
 * Derived from the French dictionary, the reference one: a key used here without
 * existing in `fr.errors` is a type error.
 */
export type ErrorKey = keyof typeof fr.errors;

export type ErrorMessage = `${typeof ERROR_PREFIX}${ErrorKey}`;

export type ErrorMessages = Record<ErrorKey, string>;

const ERROR_KEYS = Object.keys(fr.errors) as ErrorKey[];

/**
 * Writes a banner message key into an error result.
 *
 * Typed like `vmsg`: a typo fails `tsc` rather than reaching the interface as a
 * raw `errors.something`.
 */
export function ekey(key: ErrorKey): ErrorMessage {
  return `${ERROR_PREFIX}${key}`;
}

export function errorMessages(locale: Locale): ErrorMessages {
  const source = locale === 'ar' ? ar.errors : fr.errors;
  const messages = {} as ErrorMessages;
  for (const key of ERROR_KEYS) messages[key] = source[key];
  return messages;
}

export function isErrorMessage(value: string): value is ErrorMessage {
  return value.startsWith(ERROR_PREFIX) && ERROR_KEYS.includes(value.slice(ERROR_PREFIX.length) as ErrorKey);
}

/** Turns a stored banner message into display text, passing anything else through. */
export function resolveErrorMessage(value: string, messages: ErrorMessages): string {
  if (!isErrorMessage(value)) return value;
  return messages[value.slice(ERROR_PREFIX.length) as ErrorKey] ?? value;
}

/**
 * Resolves either namespace, for the components that render both: a `Field` can
 * hold a rule key from the schema *and* an `errors.*` key pushed by a Server
 * Action for a duplicate, and an unrecognised value is left alone.
 */
export function resolveMessage(
  value: string,
  validation: ValidationMessages,
  errors: ErrorMessages,
): string {
  if (isValidationMessage(value)) return resolveValidationMessage(value, validation);
  if (isErrorMessage(value)) return resolveErrorMessage(value, errors);
  return value;
}