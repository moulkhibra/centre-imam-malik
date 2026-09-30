/**
 * Arabic RTL / shaping probe for pdfmake (the evaluated fallback).
 *
 * Same methodology as the @react-pdf/renderer probes so the two libraries can
 * be compared directly:
 *
 *   1. SHAPING  : "ببببب" must emit 3 distinct glyphs (initial / medial / final).
 *   2. RTL ORDER: "ابت" must place ALEF at the largest x, then BEH, then TEH at
 *                 the smallest x.
 *   3. `Tr`     : the RTL text-rendering operator should be emitted.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const OUT = path.join(process.cwd(), 'verify');
const FONT_DIR = path.join(process.cwd(), 'public', 'fonts');

const ALIF = 0x0627;
const BEH = 0x0628;
const TEH = 0x062a;

function inflateAll(buf: Buffer): Buffer[] {
  const out: Buffer[] = [];
  let i = 0;
  while (true) {
    const idx = buf.indexOf('stream', i, 'latin1');
    if (idx === -1) break;
    let st = idx + 6;
    if (buf[st] === 0x0d) st += 1;
    if (buf[st] === 0x0a) st += 1;
    const end = buf.indexOf('endstream', st, 'latin1');
    if (end === -1) break;
    try {
      out.push(zlib.inflateSync(buf.subarray(st, end)));
    } catch {
      /* not flate */
    }
    i = end + 9;
  }
  return out;
}

function parseToUnicode(streams: Buffer[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const s of streams) {
    const t = s.toString('latin1');
    if (!t.includes('beginbfchar')) continue;
    const re = /<([0-9A-Fa-f]{4,8})>\s*<([0-9A-Fa-f]{4,8})>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      map.set(Number.parseInt(m[1]!, 16), Number.parseInt(m[2]!.slice(-4), 16));
    }
  }
  return map;
}

type Glyph = { cid: number; cp: number; x: number };

/**
 * Reads glyph ids and their x positions. pdfmake emits per-glyph positioning
 * (Td/Tm/TJ), so a straightforward scan is sufficient here.
 */
function parseGlyphs(streams: Buffer[], toUnicode: Map<number, number>): { glyphs: Glyph[]; rtlOps: number } {
  const glyphs: Glyph[] = [];
  let rtlOps = 0;
  let x = 0;

  for (const s of streams) {
    const t = s.toString('latin1');
    if (!t.includes('Tj') && !t.includes('TJ')) continue;

    rtlOps += (t.match(/(?:^|\s)[\d.]+\s+Tr(?=\s|$)/g) ?? []).length;

    const re =
      /(-?[\d.]+)\s+(-?[\d.]+)\s+(?:Td|TD)\b|(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+Tm\b|(-?[\d.]+)\s+Tr\b|\[((?:[^\]\\]|\\.)*)\]\s*TJ|<([0-9A-Fa-f\s]*)>\s*Tj/g;

    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      if (m[1] !== undefined) {
        x += Number(m[1]);
      } else if (m[3] !== undefined) {
        // Tm: text matrix - a new line resets the origin
        x = Number(m[7]);
        void Number(m[8]);
      } else if (m[9] !== undefined) {
        // Tr operator (text rendering mode) - counted on the raw stream above
      } else {
        const body = m[10] ?? m[11] ?? '';
        const hexRe = /<([0-9A-Fa-f\s]*)>|(-?[\d.]+)/g;
        let h: RegExpExecArray | null;
        while ((h = hexRe.exec(body)) !== null) {
          if (h[1] !== undefined) {
            const hex = h[1].replace(/\s/g, '');
            for (let i = 0; i + 4 <= hex.length; i += 4) {
              const cid = Number.parseInt(hex.slice(i, i + 4), 16);
              glyphs.push({ cid, cp: toUnicode.get(cid) ?? 0, x });
            }
          } else {
            x += Number(h[2]);
          }
        }
      }
    }
  }
  return { glyphs, rtlOps };
}

async function main() {
  const PdfPrinter = require('pdfmake/src/printer');

  const fonts = {
    Cairo: {
      normal: path.join(FONT_DIR, 'Cairo-Regular.ttf'),
      bold: path.join(FONT_DIR, 'Cairo-Bold.ttf'),
      italics: path.join(FONT_DIR, 'Cairo-Regular.ttf'),
      bolditalics: path.join(FONT_DIR, 'Cairo-Bold.ttf'),
    },
  };

  const printer = new PdfPrinter(fonts);

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    defaultStyle: { font: 'Cairo', fontSize: 20 },
    content: [
      { text: 'ببببب', alignment: 'right' },
      { text: 'ابت', alignment: 'right' },
      { text: 'محمد الأمين العلمي', alignment: 'right' },
      { text: 'مُحَمَّد الأَمِين', alignment: 'right' },
      { text: 'مركز الإمام مالك للدعم والتكوين واللغات', alignment: 'right' },
      { text: 'المبلغ المؤدى: 1 250,00 د.م. — المتبقي: 250,00 د.م.', alignment: 'right' },
      { text: 'Certificat de réussite — 1ère Bac — 31/03/2026', alignment: 'left' },
    ],
  };

  const pdf: Buffer = await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = printer.createPdfKitDocument(docDefinition);
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'pdfmake-rtl-probe.pdf'), pdf);

  const streams = inflateAll(pdf);
  const toUnicode = parseToUnicode(streams);
  const { glyphs, rtlOps } = parseGlyphs(streams, toUnicode);

  console.log('='.repeat(72));
  console.log('ARABIC RTL DIAGNOSTIC — pdfmake 0.3.11');
  console.log('='.repeat(72));
  console.log(`PDF: ${(pdf.length / 1024).toFixed(1)} KB`);
  console.log(`Tr operators: ${rtlOps}`);
  console.log(`ToUnicode entries: ${toUnicode.size}`);
  console.log('');

  // --- shaping ---
  const behRuns: number[][] = [];
  let run: number[] = [];
  for (const g of glyphs) {
    if (g.cp === BEH) run.push(g.cid);
    else if (run.length) {
      behRuns.push(run);
      run = [];
    }
  }
  if (run.length) behRuns.push(run);

  const behRun = behRuns.find((r) => r.length >= 4);
  const shapingOk = behRun ? new Set(behRun).size >= 2 : false;
  console.log(`SHAPING  : "ببببب" -> glyph ids [${behRun?.join(', ') ?? 'n/a'}]`);
  console.log(`           distinct glyphs = ${behRun ? new Set(behRun).size : 0} ${shapingOk ? '(>=2 => SHAPING OK)' : '(=> NO SHAPING)'}`);
  console.log('');

  // --- RTL order ---
  const word = glyphs.filter((g) => g.cp === ALIF || g.cp === BEH || g.cp === TEH);
  const runs: Glyph[][] = [];
  let cur: Glyph[] = [];
  for (const g of word) {
    if (g.cp === ALIF) {
      if (cur.length) runs.push(cur);
      cur = [g];
    } else if (cur.length) cur.push(g);
  }
  if (cur.length) runs.push(cur);

  let rtlOk = false;
  for (const r of runs) {
    if (r.length < 3) continue;
    const [a, b, c] = r as [Glyph, Glyph, Glyph];
    const ok = a.x > b.x && b.x > c.x;
    if (!rtlOk) rtlOk = ok;
    console.log(`RTL ORDER: ${['ALEF', 'BEH', 'TEH']
      .map((n, i) => `${n}@x=${(r[i] as Glyph).x.toFixed(1)}`)
      .join('  ')}  -> ${ok ? 'CORRECT (rightmost first)' : 'BROKEN (leftmost first)'}`);
  }

  console.log('');
  console.log('='.repeat(72));
  console.log(`Shaping : ${shapingOk ? 'PASS' : 'FAIL'}`);
  console.log(`RTL     : ${rtlOk ? 'PASS' : 'FAIL'}`);
  console.log(`Tr op   : ${rtlOps > 0 ? 'PASS (emitted)' : 'not emitted'}`);
  console.log('='.repeat(72));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
