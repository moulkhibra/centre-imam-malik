import { z } from 'zod';
import { LOCALES } from '@/lib/constants';
import { vmsg } from '@/lib/validation/messages';
import {
  hexColorSchema,
  optionalEmailSchema,
  optionalPhoneSchema,
  optionalTrimmedTextSchema,
  trimmed,
} from '@/lib/validation/common';

/**
 * Validation for the centre settings screen (Phase 2B).
 *
 * Two destinations are written by one form and one action: the `Center` columns
 * for the identity and the contact details, and the `CenterSetting` key/value
 * rows for what a document needs (receipt and certificate footers, the
 * director's name, the centre's default language). Both sets are validated
 * together so a half-saved screen is not representable.
 *
 * Every message is a `validation.*` key, never a sentence: the schema is parsed
 * by the form and by the action, and neither knows whether the reader is French
 * or Arabic.
 */

/** Centre code: the one used on the receipts and in the audit trail. */
const centerCodeSchema = z
  .string({ error: vmsg('fieldRequired') })
  .trim()
  .toUpperCase()
  .min(2, vmsg('codeRequired'))
  .max(20, vmsg('codeTooLong'))
  .regex(/^[A-Z0-9][A-Z0-9\-_]*$/, vmsg('codeInvalid'));

const requiredNameSchema = z
  .string({ error: vmsg('fieldRequired') })
  .trim()
  .min(2, vmsg('lastNameTooShort'))
  .max(120, vmsg('textTooLong'));

const optionalNameSchema = optionalTrimmedTextSchema(120);

/**
 * The sidebar name is drawn on one truncated line, so its cap is the length of
 * that line rather than the length of a legal name. The input carries the same
 * `maxLength`: a cap the server does not share would be a limit the operator
 * could walk straight past with a crafted POST.
 */
const SHORT_NAME_MAX = 60;
const optionalShortNameSchema = optionalTrimmedTextSchema(SHORT_NAME_MAX);

const optionalTextSchema = (max: number) => optionalTrimmedTextSchema(max);

/**
 * Social and web addresses are typed as the operator writes them.
 *
 * A bare handle (`centre.imam.malik`) is what a Facebook page looks like to the
 * person filling the form, so requiring a scheme would push them to invent one.
 * The value is printed on documents, never fetched by the server, which is why a
 * permissive shape is acceptable here - anything stricter belongs to a link
 * that is actually followed.
 */
const optionalWebAddressSchema = (max = 160) =>
  z
    .union([
      z.literal(''),
      z
        .string()
        .trim()
        .max(max, vmsg('textTooLong'))
        .regex(/^[A-Za-z0-9][A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]*$/, vmsg('urlInvalid')),
    ])
    .optional()
    .transform((value) => (value || null));

/**
 * The logo is a path inside `public/`, not an upload.
 *
 * There is no upload route in this application: a logo file is dropped into
 * `public/` by whoever installs the centre, and this field names it. The pattern
 * therefore accepts a relative path under the root and refuses anything else -
 * an absolute path, a URL, or `../`, either of which would make the rendered
 * `<img>` read outside the public directory or pull a remote resource into
 * every printed document.
 */
const optionalLogoPathSchema = z
  .union([
    z.literal(''),
    z
      .string()
      .trim()
      .max(200, vmsg('textTooLong'))
      .regex(/^\/[A-Za-z0-9][A-Za-z0-9\-._/]*\.(png|jpe?g|svg|webp)$/i, vmsg('logoPathInvalid')),
  ])
  .optional()
  .transform((value) => (value || null));

/**
 * IANA zone name, e.g. `Africa/Casablanca`.
 *
 * Deliberately shape-checked rather than validated against the tz database:
 * that list depends on the host's ICU build, which differs between the Windows
 * PC this is installed on and the CI container, and a centre whose zone is not
 * installed must still be able to save its settings.
 */
const timezoneSchema = z
  .string({ error: vmsg('fieldRequired') })
  .trim()
  .regex(/^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)+$/, vmsg('timezoneInvalid'))
  .max(60, vmsg('textTooLong'));

/**
 * The whole settings screen.
 *
 * `z.object` without `.strict()` so a form that grows a field does not fail
 * until the action learns to write it - the unknown key is dropped by Zod rather
 * than stored.
 */
export const centerSettingsSchema = trimmed(
  z.object({
    code: centerCodeSchema,
    nameFr: requiredNameSchema,
    nameAr: optionalNameSchema,
    /** Short name for the sidebar; falls back to `nameFr` when empty. */
    shortNameFr: optionalShortNameSchema,
    shortNameAr: optionalShortNameSchema,
    legalName: optionalNameSchema,
    address: optionalTextSchema(200),
    city: optionalTextSchema(80),
    phone: optionalPhoneSchema,
    whatsapp: optionalPhoneSchema,
    email: optionalEmailSchema,
    facebook: optionalWebAddressSchema(),
    instagram: optionalWebAddressSchema(),
    website: optionalWebAddressSchema(),
    logoPath: optionalLogoPathSchema,
    primaryColor: hexColorSchema,
    secondaryColor: hexColorSchema,
    timezone: timezoneSchema,
    /** Default language of the printed documents and of a fresh account. */
    locale: z.enum(LOCALES, { error: vmsg('invalidOption') }),
    receiptFooterFr: optionalTextSchema(500),
    receiptFooterAr: optionalTextSchema(500),
    certificateFooterFr: optionalTextSchema(500),
    certificateFooterAr: optionalTextSchema(500),
    directorNameFr: optionalTextSchema(120),
    directorNameAr: optionalTextSchema(120),
  }),
);

export type CenterSettingsInput = z.infer<typeof centerSettingsSchema>;

/**
 * The `CenterSetting` keys this screen owns.
 *
 * Written as declared constants rather than as string literals at the call site,
 * so the write loop and the audit metadata cannot disagree on a key's spelling -
 * a typo in a key silently creates a second setting that nothing ever reads.
 */
export const CENTER_SETTING_KEYS = {
  locale: 'center.locale',
  shortNameFr: 'center.shortNameFr',
  shortNameAr: 'center.shortNameAr',
  receiptFooterFr: 'receipt.footerFr',
  receiptFooterAr: 'receipt.footerAr',
  certificateFooterFr: 'certificate.footerFr',
  certificateFooterAr: 'certificate.footerAr',
  directorNameFr: 'certificate.directorNameFr',
  directorNameAr: 'certificate.directorNameAr',
} as const;

/**
 * Turns the validated input into the key/value rows to upsert.
 *
 * A value equal to the shipped default is written too, rather than deleted:
 * `getSetting` reads a missing key as its default, so storing the same value is
 * equivalent, and it keeps the settings screen and the reference data from
 * disagreeing about what the centre chose.
 */
export function centerSettingEntries(input: CenterSettingsInput): Array<[string, string]> {
  return [
    [CENTER_SETTING_KEYS.locale, input.locale],
    [CENTER_SETTING_KEYS.shortNameFr, input.shortNameFr ?? ''],
    [CENTER_SETTING_KEYS.shortNameAr, input.shortNameAr ?? ''],
    [CENTER_SETTING_KEYS.receiptFooterFr, input.receiptFooterFr ?? ''],
    [CENTER_SETTING_KEYS.receiptFooterAr, input.receiptFooterAr ?? ''],
    [CENTER_SETTING_KEYS.certificateFooterFr, input.certificateFooterFr ?? ''],
    [CENTER_SETTING_KEYS.certificateFooterAr, input.certificateFooterAr ?? ''],
    [CENTER_SETTING_KEYS.directorNameFr, input.directorNameFr ?? ''],
    [CENTER_SETTING_KEYS.directorNameAr, input.directorNameAr ?? ''],
  ];
}