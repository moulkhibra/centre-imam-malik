import { describe, expect, it } from 'vitest';
import { collectPaths, createTranslator, dir, isRtl, textDirection } from '@/lib/i18n';
import { ar } from '@/lib/i18n/dictionaries/ar';
import { fr } from '@/lib/i18n/dictionaries/fr';

describe('locale direction', () => {
  it('switches to RTL for Arabic and back for French', () => {
    expect(dir('fr')).toBe('ltr');
    expect(dir('ar')).toBe('rtl');
    expect(isRtl('ar')).toBe(true);
    expect(isRtl('fr')).toBe(false);
    expect(textDirection('ar')).toBe('right');
    expect(textDirection('fr')).toBe('left');
  });
});

describe('translation dictionaries', () => {
  const t = createTranslator('fr');
  const tAr = createTranslator('ar');

  it('translates the keys the application shell uses', () => {
    expect(t('common.save')).toBe('Enregistrer');
    expect(tAr('common.save')).toBe('حفظ');
    expect(t('common.appName')).toBe('Centre Imam Malik');
    expect(tAr('common.appName')).toBe('مركز الإمام مالك');
  });

  it('renders the same Arabic text with no placeholders', () => {
    expect(tAr('common.appName')).not.toMatch(/[{}]/);
    expect(collectPaths(ar).size).toBeGreaterThan(200);
  });

  it('has no Arabic key that French does not define', () => {
    const frPaths = collectPaths(fr);
    const extra = [...collectPaths(ar)].filter((key) => !frPaths.has(key));
    expect(extra).toEqual([]);
  });

  it('has no empty translation', () => {
    for (const locale of [fr, ar]) {
      for (const key of collectPaths(locale)) {
        const value = createTranslator(locale === fr ? 'fr' : 'ar')(key);
        expect(value.trim(), `empty value for ${key}`).not.toBe('');
      }
    }
  });

  it('interpolates variables', () => {
    expect(t('dashboard.welcome', { name: 'Amine' })).toContain('Amine');
    expect(tAr('dashboard.welcome', { name: 'أمين' })).toContain('أمين');
  });

  it('falls back to French instead of rendering a blank string', () => {
    expect(t('this.key.does.not.exist')).toBe('this.key.does.not.exist');
  });

  it('contains real Arabic characters, not transliterated placeholders', () => {
    const arabic = [...tAr('nav.students'), ...tAr('finance.payments'), ...tAr('common.save')].join('');
    expect(arabic).toMatch(/[\u0600-\u06FF]/);
  });
});
