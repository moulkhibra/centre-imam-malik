import '@/lib/utils/server-only';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Arabic-capable font registration for PDF generation.
 *
 * The Cairo static instances ship inside the repository under public/fonts, so
 * PDF generation works fully offline. The font is registered once per process
 * with @react-pdf/renderer and cached.
 *
 * Cairo covers: Arabic (including all presentation forms used by the shaper),
 * Arabic diacritics, Latin, digits and punctuation - one font family for both
 * French and Arabic documents, which keeps line metrics consistent.
 */

export type PdfFontFamily = 'Cairo' | 'CairoBold' | 'CairoSemiBold';

export type FontRegistration = {
  family: 'Cairo';
  fonts: { src: string; fontWeight: number; fontStyle: 'normal' }[];
};

export const FONT_DIR = path.join(process.cwd(), 'public', 'fonts');

const FONT_FILES: { weight: number; file: string }[] = [
  { weight: 400, file: 'Cairo-Regular.ttf' },
  { weight: 600, file: 'Cairo-SemiBold.ttf' },
  { weight: 700, file: 'Cairo-Bold.ttf' },
];

let registered: FontRegistration | null = null;
let registeredFor: FontRegistration | null = null;

/**
 * Returns absolute paths to the bundled Cairo weights.
 * Throws loudly if a file is missing: a silently degraded font would produce
 * PDFs with broken Arabic, which is worse than a visible failure.
 */
export function getFontPaths(): { weight: number; path: string }[] {
  return FONT_FILES.map(({ weight, file }) => {
    const full = path.join(FONT_DIR, file);
    if (!fs.existsSync(full)) {
      throw new Error(
        `Police introuvable : ${full}. Le fichier ${file} doit exister dans public/fonts.`,
      );
    }
    return { weight, path: full };
  });
}

export async function registerPdfFonts(): Promise<FontRegistration> {
  if (registered && registeredFor) return registeredFor;

  const { Font } = await import('@react-pdf/renderer');
  const fonts = getFontPaths();

  Font.register({
    family: 'Cairo',
    fonts: fonts.map(({ path: src, weight }) => ({
      src,
      fontWeight: weight,
      fontStyle: 'normal' as const,
    })),
  });

  registeredFor = { family: 'Cairo', fonts: fonts.map(({ path: src, weight }) => ({ src, fontWeight: weight, fontStyle: 'normal' as const })) };
  registered = registeredFor;
  return registeredFor;
}

/** Style helper: one place to control Arabic PDF typography. */
export const pdfFont = {
  family: 'Cairo',
  regular: { fontFamily: 'Cairo', fontWeight: 400 },
  medium: { fontFamily: 'Cairo', fontWeight: 600 },
  bold: { fontFamily: 'Cairo', fontWeight: 700 },
} as const;
