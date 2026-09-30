import { CURRENCY_SUFFIX, type Locale } from '@/lib/constants';

/**
 * All monetary amounts in this application are integers in minor units
 * (centimes / halalas). 500.00 DH is stored as 50000.
 *
 * Never use floating point arithmetic for money. These helpers are the only
 * sanctioned way to convert between storage and display.
 */

export function centsToMad(cents: number): number {
  return cents / 100;
}

export function madToCents(mad: number): number {
  if (!Number.isFinite(mad)) return 0;
  return decimalToCents(String(mad));
}

/**
 * Converts a decimal string to integer centimes by reading the digits, never
 * by multiplying a float.
 *
 * `Math.round(1.005 * 100)` returns 100 in IEEE-754 because 1.005 is stored as
 * 1.00499999999999989... Parsing the decimal part directly makes the rounding
 * exact, which matters because every invoice total is derived from these values.
 */
export function decimalToCents(input: string): number {
  const normalised = input.trim().replace(/\s/g, '').replace(/,/g, '.');
  const match = /^(-?)(\d*)(?:\.(\d*))?$/.exec(normalised);
  if (!match) return 0;

  const [, sign, whole = '', fraction = ''] = match;
  if (whole === '' && fraction === '') return 0;

  const cents = Number(whole || '0') * 100 + Number((fraction + '00').slice(0, 2));
  const thirdDigit = fraction.charCodeAt(2);
  const rounded = thirdDigit >= 53 /* '5' */ && thirdDigit <= 57 /* '9' */ ? cents + 1 : cents;
  return sign === '-' ? -rounded : rounded;
}

/** Parses user input like "500", "500.5", "500,50" into cents. */
export function parseMadToCents(input: string | number): number {
  if (typeof input === 'number') return madToCents(input);
  if (/^-?[\d\s]*([.,][\d\s]*)?$/.test(input.trim()) === false) return 0;
  return decimalToCents(input);
}

const LOCALE_TAG: Record<Locale, string> = { fr: 'fr-MA', ar: 'ar-MA' };

/** Inserts a space every three digits of the integer part. */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Formats cents as a currency string.
 *
 * Grouping and the decimal separator are applied by this module rather than by
 * `Intl` grouping: `fr-MA` returns "1.250,00" in some ICU builds and
 * "1 250,00" in others, and a printed receipt must not depend on the ICU data
 * shipped with the Node build. Both locales use Western digits so amounts stay
 * unambiguous in spreadsheets and PDFs.
 */
export function formatMad(
  cents: number,
  locale: Locale = 'fr',
  options: { withSymbol?: boolean; compact?: boolean } = {},
): string {
  const { withSymbol = true, compact = false } = options;

  if (compact) {
    const compactFormatted = new Intl.NumberFormat(LOCALE_TAG[locale], {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(centsToMad(cents));
    return withSymbol ? `${compactFormatted} ${CURRENCY_SUFFIX[locale]}` : compactFormatted;
  }

  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(Math.trunc(cents));
  const integerPart = groupThousands(String(Math.trunc(absolute / 100)));
  const decimalPart = String(absolute % 100).padStart(2, '0');
  const formatted = `${sign}${integerPart},${decimalPart}`;

  if (!withSymbol) return formatted;
  return `${formatted} ${CURRENCY_SUFFIX[locale]}`;
}

/** Signed amount, useful in cash-register and finance reports. */
export function formatMadSigned(cents: number, locale: Locale = 'fr'): string {
  const sign = cents > 0 ? '+' : '';
  return `${sign}${formatMad(cents, locale)}`;
}

// --- Percentages ------------------------------------------------------------

/**
 * Calculates a percentage of an amount, rounding half-up to the nearest cent.
 * Used by promotions and by weighted grade averages.
 */
export function percentOfCents(baseCents: number, percent: number): number {
  return Math.round((baseCents * percent) / 100);
}

export function clampCents(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// --- Dates ------------------------------------------------------------------

/** All dates are handled in Africa/Casablanca local time for display. */
export const APP_TIMEZONE = 'Africa/Casablanca';

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/** DD/MM/YYYY - the client's required format. */
export function formatDate(value: Date | string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

/** DD/MM/YYYY HH:mm */
export function formatDateTime(value: Date | string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '';
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${formatDate(date)} ${hh}:${mi}`;
}

/** Month name for charts and reports. */
export function formatMonth(month: number, year: number, locale: Locale = 'fr'): string {
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], { month: 'short', year: '2-digit' }).format(date);
}

export const MONTH_LABELS_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
] as const;

export const MONTH_LABELS_AR = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'ماي',
  'يونيو',
  'يوليوز',
  'غشت',
  'شتنبر',
  'أكتوبر',
  'نونبر',
  'دجنبر',
] as const;

export function monthLabel(month: number, locale: Locale = 'fr'): string {
  const index = Math.min(Math.max(month, 1), 12) - 1;
  return locale === 'ar' ? MONTH_LABELS_AR[index]! : MONTH_LABELS_FR[index]!;
}

// --- Text -------------------------------------------------------------------

export function initials(firstName: string, lastName: string): string {
  const a = firstName.trim().charAt(0);
  const b = lastName.trim().charAt(0);
  return `${a}${b}`.toUpperCase();
}

export function fullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

/** "3ème Collège" -> "3e C." used in compact table cells. */
export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export function normalizePhone(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/[\s.\-()]/g, '');
}
