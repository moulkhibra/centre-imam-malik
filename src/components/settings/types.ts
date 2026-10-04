import type { Locale } from '@/lib/constants';
import type { CenterSettingsFormValues } from '@/lib/settings/center';
import type { FieldErrorMap } from '@/components/admin/types';

/**
 * Shapes exchanged between the settings Server Component and its form.
 *
 * The form receives values, not a record: `null` becomes `''` before it reaches
 * the Server Component so a controlled input never receives `null`. The labels
 * are resolved once, on the server, where the reader's locale is known.
 */

export type SettingsFormValues = CenterSettingsFormValues;

/** One section of the form: a title, an optional hint and its fields. */
export type SettingsSection = {
  id: string;
  title: string;
  hint?: string;
};

export type SettingsViewLabels = {
  save: string;
  cancel: string;
  error: string;
  loading: string;
  optional: string;
  logoPreviewAlt: string;
  colors: {
    primary: string;
    secondary: string;
  };
  sections: {
    identity: SettingsSection;
    contact: SettingsSection;
    appearance: SettingsSection;
    documents: SettingsSection;
  };
  fields: {
    code: string;
    nameFr: string;
    nameAr: string;
    shortNameFr: string;
    shortNameAr: string;
    legalName: string;
    address: string;
    city: string;
    phone: string;
    whatsapp: string;
    email: string;
    facebook: string;
    instagram: string;
    website: string;
    logoPath: string;
    logoPathHint: string;
    timezone: string;
    locale: string;
    primaryColor: string;
    secondaryColor: string;
    receiptFooterFr: string;
    receiptFooterAr: string;
    certificateFooterFr: string;
    certificateFooterAr: string;
    directorNameFr: string;
    directorNameAr: string;
  };
  localeLabels: Record<Locale, string>;
  saved: string;
  readOnly: string;
};

export type SettingsFieldErrors = FieldErrorMap;