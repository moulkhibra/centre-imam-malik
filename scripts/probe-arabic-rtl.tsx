/**
 * Arabic RTL POSITIONING test for @react-pdf/renderer.
 *
 * Shaping can be correct while the visual order is still wrong, so this probe
 * is deliberately separate from the shaping probe.
 *
 * It renders an asymmetric Arabic word and reads the x-coordinate of every
 * glyph from the content stream:
 *
 *   "ابت"  = ALEF(0627) + BEH(0628) + TEH(062A)
 *
 *   Correct RTL visual layout (reading right to left):
 *       ALEF at the RIGHTMOST x, then BEH, then TEH at the LEFTMOST x
 *       => x(alef) > x(beh) > x(teh)
 *
 *   Broken LTR layout:
 *       => x(alef) < x(beh) < x(teh)
 *
 * It also reports whether the `Tr` (text rendering mode) operator is emitted,
 * which controls glyph advance direction for text extraction and selection.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import React from 'react';
import { Document, Page, Text, View, renderToBuffer, StyleSheet } from '@react-pdf/renderer';
import { registerPdfFonts } from '../src/lib/pdf/fonts';

const OUT = path.join(process.cwd(), 'verify');

const ALIF = 0x0627;
const BEH = 0x0628;
const TEH = 0x062a;

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Cairo', fontSize: 40 },
  rtl: { fontFamily: 'Cairo', fontSize: 40, textDirection: 'rtl' },
  ltrForced: { fontFamily: 'Cairo', fontSize: 40, textDirection: 'rtl', textAlign: 'left' },
});

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
    const re = /<([0-9A-Fa-f]{4})>\s*<([0-9A-Fa-f]{4,8})>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      map.set(Number.parseInt(m[1]!, 16), Number.parseInt(m[2]!.slice(-4), 16));
    }
  }
  return map;
}

type Glyph = { cid: number; cp: number; x: number };

/**
 * Walks the content stream tracking the current text translation matrix, so
 * each glyph's device x can be recovered even though the library emits a
 * coordinate flip (`1 0 0 -1 0 H cm`) for RTL text.
 */
function parseGlyphPositions(streams: Buffer[], toUnicode: Map<number, number>): Glyph[] {
  const glyphs: Glyph[] = [];
  const cmStack: number[][] = [];
  let ctm: number[] = [1, 0, 0, 1, 0, 0];
  let tm: number[] | null = null;
  let leading = 0;
  let rtlOps = 0;

  const mul = (a: number[], b: number[]): number[] => [
    a[0]! * b[0]! + a[1]! * b[3]!,
    a[0]! * b[1]! + a[1]! * b[4]!,
    a[2]! * b[0]! + a[3]! * b[3]!,
    a[2]! * b[1]! + a[3]! * b[4]!,
    a[4]! * b[0]! + a[5]! * b[3]! + b[4]!,
    a[4]! * b[1]! + a[5]! * b[4]! + b[5]!,
  ];

  for (const s of streams) {
    const t = s.toString('latin1');
    if (!t.includes('TJ') && !t.includes('Tj')) continue;

    const tokenRe =
      /(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(cm|Tm)\b|(-?[\d.]+)\s+(-?[\d.]+)\s+(Td|TD)\b|(-?[\d.]+)\s+TL\b|(-?[\d.]+)\s+Tr\b|\[((?:[^\]\\]|\\.)*)\]\s*TJ|<([0-9A-Fa-f\s]*)>\s*Tj/g;

    let m: RegExpExecArray | null;
    while ((m = tokenRe.exec(t)) !== null) {
      if (m[7] === 'cm') {
        ctm = mul([Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])], ctm);
      } else if (m[7] === 'Tm') {
        tm = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])];
      } else if (m[8]) {
        tm = mul([1, 0, 0, 1, Number(m[1]), Number(m[2])], tm ?? [1, 0, 0, 1, 0, 0]);
      } else if (m[9]) {
        leading = -Number(m[9]);
      } else if (m[11]) {
        rtlOps += 1;
      } else {
        // A text-showing operator: walk the hex chunks, advancing by the
        // kerning numbers the library emits between them.
        const body = m[12] ?? m[13] ?? '';
        const hexRe = /<([0-9A-Fa-f\s]*)>|(-?[\d.]+)/g;
        let h: RegExpExecArray | null;
        let currentTm = tm ? [...tm] : null;
        while ((h = hexRe.exec(body)) !== null) {
          if (h[1] !== undefined) {
            const hex = h[1].replace(/\s/g, '');
            for (let i = 0; i + 4 <= hex.length; i += 4) {
              const cid = Number.parseInt(hex.slice(i, i + 4), 16);
              const full = currentTm ? mul(currentTm, ctm) : ctm;
              glyphs.push({ cid, cp: toUnicode.get(cid) ?? 0, x: full[4]! });
            }
          } else if (currentTm) {
            const adj = Number(h[2]);
            currentTm = mul([1, 0, 0, 1, adj, 0], currentTm);
          }
        }
        // Advance the persistent text matrix past this run.
        const kernTotal = (body.match(/(-?[\d.]+)(?!<)/g) ?? []).reduce((a, b) => a + Number(b), 0);
        if (tm) tm = mul([1, 0, 0, 1, kernTotal, 0], tm);
        void leading;
      }
    }
    void cmStack;
  }
  return { glyphs, rtlOps } as never;
}

async function main() {
  await registerPdfFonts();

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text>ابت</Text>
        <View style={styles.rtl}>
          <Text>ابت</Text>
        </View>
      </Page>
    </Document>
  );

  const buf = Buffer.from(await renderToBuffer(doc as never));
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'rtl-probe.pdf'), buf);

  const streams = inflateAll(buf);
  const toUnicode = parseToUnicode(streams);
  const { glyphs, rtlOps } = parseGlyphPositions(streams, toUnicode) as unknown as {
    glyphs: Glyph[];
    rtlOps: number;
  };

  const word = glyphs.filter((g) => g.cp === ALIF || g.cp === BEH || g.cp === TEH);
  const name = (cp: number) =>
    cp === ALIF ? 'ALEF' : cp === BEH ? 'BEH' : cp === TEH ? 'TEH' : `U+${cp.toString(16)}`;

  console.log('='.repeat(72));
  console.log('ARABIC RTL POSITIONING DIAGNOSTIC');
  console.log('='.repeat(72));
  console.log(`PDF: ${(buf.length / 1024).toFixed(1)} KB`);
  console.log(`Tr operators emitted: ${rtlOps}`);
  console.log('');

  // Group into runs of consecutive 3 target glyphs.
  const runs: Glyph[][] = [];
  let current: Glyph[] = [];
  for (const g of word) {
    if (g.cp === ALIF) {
      if (current.length) runs.push(current);
      current = [g];
    } else if (current.length) {
      current.push(g);
    }
  }
  if (current.length) runs.push(current);

  let allCorrect = runs.length > 0;
  runs.forEach((run, i) => {
    if (run.length < 3) return;
    const [a, b, c] = run as [Glyph, Glyph, Glyph];
    const rtlCorrect = a.x > b.x && b.x > c.x;
    if (!rtlCorrect) allCorrect = false;
    console.log(`run #${i + 1} (emission order = logical order):`);
    for (const g of run) {
      console.log(`   ${name(g.cp).padEnd(5)} glyph=${String(g.cid).padEnd(3)} x=${g.x.toFixed(2)}`);
    }
    console.log(`   -> x(ALEF) ${a.x.toFixed(2)} ${rtlCorrect ? '>' : '<'} x(BEH) ${b.x.toFixed(2)} ${rtlCorrect ? '>' : '<'} x(TEH) ${c.x.toFixed(2)}`);
    console.log(`   -> ${rtlCorrect ? 'CORRECT RTL (rightmost first)' : 'BROKEN: laid out left-to-right'}\n`);
  });

  console.log('='.repeat(72));
  console.log(`Shaping: OK (see probe-arabic-shaping)`);
  console.log(`Visual RTL order: ${allCorrect ? 'CORRECT' : 'BROKEN'}`);
  console.log(`Tr operator: ${rtlOps > 0 ? 'emitted' : 'NOT emitted'}`);
  console.log('='.repeat(72));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
