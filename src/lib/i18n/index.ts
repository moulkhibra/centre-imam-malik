import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/constants';

export { isLocale };
export type { Locale };

/**
 * Minimal, dependency-free i18n.
 *
 * Dictionaries are plain nested objects with `fr` and `ar` variants. Keys are
 * resolved by dot path. Because the whole UI is server-rendered or hydrated
 * from a single provider, the chosen locale is carried by a cookie so that both
 * server and client agree on direction and language.
 */

export const LOCALE_COOKIE = 'cim_locale';
export const RTL_LOCALES: readonly Locale[] = ['ar'];

export function isRtl(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale);
}

export function dir(locale: Locale): 'ltr' | 'rtl' {
  return isRtl(locale) ? 'rtl' : 'ltr';
}

export function textDirection(locale: Locale): 'left' | 'right' {
  return isRtl(locale) ? 'right' : 'left';
}

// --- Cookie access (server side) -------------------------------------------

export async function getLocaleFromCookies(): Promise<Locale> {
  const { cookies } = await import('next/headers');
  const store = await cookies();
  const raw = store.get(LOCALE_COOKIE)?.value;
  return raw && isLocale(raw) ? raw : DEFAULT_LOCALE;
}

// --- Dictionaries -----------------------------------------------------------

import { fr } from '@/lib/i18n/dictionaries/fr';
import { ar } from '@/lib/i18n/dictionaries/ar';

export type Dictionary = typeof fr;

/**
 * Same shape as `Dictionary` but with `string` leaves.
 *
 * The French dictionary is written with `as const`, so its values are literal
 * types ("Save" is the type `"Save"`). Assigning the Arabic dictionary - whose
 * literals differ - to that type would fail even though the structure matches.
 * Widening the leaves keeps full key checking while allowing translated values.
 */
type StringTree<T> = { [K in keyof T]: T[K] extends string ? string : StringTree<T[K]> };

/**
 * Assignability here fails at compile time if the Arabic dictionary is missing
 * any key present in the French one. Extra Arabic keys are reported at runtime
 * by `assertDictionaryParity` (development only).
 */
const DICTIONARIES: Record<Locale, StringTree<Dictionary>> = { fr, ar };

type Leaf = string;

function resolve(dict: unknown, path: string): Leaf | undefined {
  const segments = path.split('.');
  let current: unknown = dict;
  for (const segment of segments) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === 'string' ? current : undefined;
}

/**
 * Builds a translator bound to one locale.
 * Missing keys return a visible sentinel in development so gaps are caught,
 * and the key itself in production so the UI never renders empty.
 */
export function createTranslator(locale: Locale) {
  const dict = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];

  function t(path: string, vars?: Record<string, string | number>): string {
    const value = resolve(dict, path) ?? resolve(DICTIONARIES[DEFAULT_LOCALE], path);
    if (value === undefined) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[i18n] missing translation key: ${path}`);
      }
      return path;
    }
    if (!vars) return value;
    return value.replace(/\{(\w+)\}/g, (match, key: string) =>
      key in vars ? String(vars[key]) : match,
    );
  }

  return t;
}

export type Translator = ReturnType<typeof createTranslator>;

/** Every dotted leaf path of a dictionary object. */
function collectPaths(node: unknown, prefix = ''): Set<string> {
  const paths = new Set<string>();
  if (node === null || typeof node !== 'object') {
    if (prefix) paths.add(prefix);
    return paths;
  }
  for (const [key, value] of Object.entries(node)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (value === null || typeof value !== 'object') paths.add(next);
    else for (const child of collectPaths(value, next)) paths.add(child);
  }
  return paths;
}

/**
 * Development-only guard against dictionary drift: reports Arabic keys that do
 * not exist in French. The reverse direction (a French key missing from
 * Arabic) is already a compile error.
 */
export function assertDictionaryParity(): void {
  if (process.env.NODE_ENV === 'production') return;
  const frPaths = collectPaths(DICTIONARIES.fr);
  for (const [locale, dict] of Object.entries(DICTIONARIES)) {
    if (locale === DEFAULT_LOCALE) continue;
    const extra = [...collectPaths(dict)].filter((p) => !frPaths.has(p));
    if (extra.length > 0) {
      console.warn(`[i18n] ${extra.length} key(s) not present in ${DEFAULT_LOCALE}: ${extra.join(', ')}`);
    }
  }
}

export { collectPaths };
