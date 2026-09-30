import { describe, expect, it } from 'vitest';
import {
  clampCents,
  formatDate,
  formatDateTime,
  formatMad,
  formatMadSigned,
  fullName,
  initials,
  madToCents,
  monthLabel,
  normalizePhone,
  parseMadToCents,
  percentOfCents,
} from '@/lib/utils/format';

/**
 * Money is stored in integer centimes. These tests pin the conversion rules
 * that every financial calculation depends on.
 */
describe('money conversion', () => {
  it('parses the formats an employee actually types', () => {
    expect(parseMadToCents('500')).toBe(50_000);
    expect(parseMadToCents('500,50')).toBe(50_050);
    expect(parseMadToCents('500.50')).toBe(50_050);
    expect(parseMadToCents(' 1 250,00 ')).toBe(125_000);
    expect(parseMadToCents('0')).toBe(0);
  });

  it('never throws on junk input, it returns 0', () => {
    expect(parseMadToCents('')).toBe(0);
    expect(parseMadToCents('abc')).toBe(0);
    expect(parseMadToCents(Number.NaN)).toBe(0);
    expect(parseMadToCents(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('rounds to the nearest centime without floating point drift', () => {
    // 0.1 + 0.2 style drift would show up here if we used plain floats.
    expect(madToCents(0.1)).toBe(10);
    expect(madToCents(0.2)).toBe(20);
    expect(madToCents(1.005)).toBe(101);
    expect(madToCents(1234.567)).toBe(123_457);
  });

  it('computes the classic remaining balance example', () => {
    const price = parseMadToCents('500');
    const paid = parseMadToCents('300');
    expect(price - paid).toBe(20_000);
    expect(clampCents(price - paid, 0, price)).toBe(20_000);
  });

  it('never lets a negative balance escape clampCents', () => {
    expect(clampCents(-5_000, 0, 50_000)).toBe(0);
    expect(clampCents(80_000, 0, 50_000)).toBe(50_000);
  });

  it('computes percentage discounts on integer cents', () => {
    expect(percentOfCents(50_000, 10)).toBe(5_000);
    expect(percentOfCents(50_000, 7.5)).toBe(3_750);
    expect(percentOfCents(0, 50)).toBe(0);
    expect(percentOfCents(50_000, 0)).toBe(0);
  });
});

describe('currency formatting', () => {
  it('always uses two decimals and the DH suffix', () => {
    expect(formatMad(50_000, 'fr')).toBe('500,00 DH');
    expect(formatMad(125_000, 'fr')).toBe('1 250,00 DH');
    expect(formatMad(1, 'fr')).toBe('0,01 DH');
  });

  it('uses the Arabic currency label for the Arabic locale', () => {
    expect(formatMad(50_000, 'ar')).toContain('د.م.');
  });

  it('can omit the currency symbol', () => {
    expect(formatMad(50_000, 'fr', { withSymbol: false })).toBe('500,00');
  });

  it('signs amounts for cash-register reports', () => {
    expect(formatMadSigned(50_000, 'fr')).toBe('+500,00 DH');
    expect(formatMadSigned(-50_000, 'fr')).toBe('-500,00 DH');
    expect(formatMadSigned(0, 'fr')).toBe('0,00 DH');
  });
});

describe('date formatting', () => {
  it('uses DD/MM/YYYY as required by the client', () => {
    expect(formatDate(new Date(2026, 2, 31))).toBe('31/03/2026');
    expect(formatDate(new Date(2026, 0, 5))).toBe('05/01/2026');
    expect(formatDate('2026-03-31T10:00:00')).toBe('31/03/2026');
  });

  it('returns an empty string instead of "Invalid Date"', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
    expect(formatDate('')).toBe('');
    expect(formatDate('not-a-date')).toBe('');
  });

  it('formats date and time together', () => {
    expect(formatDateTime(new Date(2026, 2, 31, 14, 5))).toBe('31/03/2026 14:05');
    expect(formatDateTime(null)).toBe('');
  });

  it('labels months in both languages', () => {
    expect(monthLabel(9, 'fr')).toBe('Septembre');
    expect(monthLabel(9, 'ar')).toBe('شتنبر');
    expect(monthLabel(0, 'fr')).toBe('Janvier'); // clamped to January
    expect(monthLabel(13, 'fr')).toBe('Décembre'); // clamped to December
  });
});

describe('text helpers', () => {
  it('builds initials from first and last name', () => {
    expect(initials('mohamed', 'amine')).toBe('MA');
    expect(initials('  sara ', 'b')).toBe('SB');
  });

  it('joins names without leaving a trailing space', () => {
    expect(fullName('Yassine', 'Amrani')).toBe('Yassine Amrani');
    expect(fullName('Yassine', '')).toBe('Yassine');
  });

  it('normalises Moroccan phone numbers for comparison', () => {
    expect(normalizePhone('06 37 06 52 18')).toBe('0637065218');
    expect(normalizePhone('+212 (637) 06-52-18')).toBe('+212637065218');
    expect(normalizePhone(null)).toBe('');
  });
});
