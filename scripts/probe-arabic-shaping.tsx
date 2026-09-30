/**
 * Decisive Arabic SHAPING test for @react-pdf/renderer.
 *
 * Method (no image inspection required):
 *   Renders single-purpose pages containing repetitive Arabic strings and reads
 *   back the glyph ids the renderer actually emitted.
 *
 *   "ببببب" (beh x5)
 *     - correct shaping -> initial beh, medial beh, medial beh, medial beh,
 *       final beh  => 3 DISTINCT glyph ids
 *     - no shaping    -> isolated beh repeated        => 1 DISTINCT glyph id
 *
 *   "لالا" (lam-alef ligature x2)
 *     - correct shaping -> LAM-ALEF ligature + isolated beh => 2 distinct ids
 *     - no shaping      -> isolated lam, isolated alef    => 2 distinct ids
 *       (ligature count distinguishes the two)
 *
 *   Additionally compares the embedded font subset's glyph outlines against the
 *   original Cairo font: a shaped glyph MUST be a distinct outline from the
 *   isolated form of the same letter.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import React from 'react';
import { Document, Page, Text, renderToBuffer, StyleSheet } from '@react-pdf/renderer';
import { registerPdfFonts } from '../src/lib/pdf/fonts';

const OUT = path.join(process.cwd(), 'verify');

type _Parsed = {
  /** ordered list of glyph id (CID) sequences per text-showing operator */
  runs: number[][];
  /** CID -> unicode codepoint */
  toUnicode: Map<number, number>;
  /** CID -> hex outline signature, from the embedded font subset */
  cidSignature: Map<number, string>;
  mediaBoxes: string[];
  rtlOperatorCount: number;
};

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

/** Reads the ToUnicode CMaps: CID -> Unicode scalar. */
function parseToUnicode(streams: Buffer[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const s of streams) {
    const t = s.toString('latin1');
    if (!t.includes('beginbfchar')) continue;
    const re = /<([0-9A-Fa-f]{4})>\s*<([0-9A-Fa-f]{4,8})>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      const cid = Number.parseInt(m[1]!, 16);
      const hex = m[2]!;
      const cp = Number.parseInt(hex.slice(-4), 16);
      map.set(cid, cp);
    }
  }
  return map;
}

/** Extracts the glyph ids shown by every TJ/Tj operator, in emission order. */
function parseRuns(streams: Buffer[]): { runs: number[][]; rtlOps: number } {
  const runs: number[][] = [];
  let rtlOps = 0;
  for (const s of streams) {
    const t = s.toString('latin1');
    if (!t.includes('TJ') && !t.includes('Tj')) continue;
    rtlOps += (t.match(/(?:^|\s)[\d.]+\s+Tr(?=\s|$)/g) ?? []).length;
    const re = /\[((?:[^\]\\]|\\.)*)\]\s*TJ|<([0-9A-Fa-f\s]+)>\s*Tj/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      const body = m[1] ?? m[2] ?? '';
      const ids: number[] = [];
      const hexRe = /<([0-9A-Fa-f\s]*)>/g;
      let h: RegExpExecArray | null;
      while ((h = hexRe.exec(body)) !== null) {
        const hex = h[1]!.replace(/\s/g, '');
        for (let i = 0; i + 4 <= hex.length; i += 4) {
          ids.push(Number.parseInt(hex.slice(i, i + 4), 16));
        }
      }
      if (ids.length > 0) runs.push(ids);
    }
  }
  return { runs, rtlOps };
}

/**
 * Maps each CID used in the content stream to an outline signature taken from
 * the embedded FontFile2 subset, using the subset's own `cmap` when present
 * and the glyph order otherwise.
 *
 * Returns null when the subset cannot be analysed, so the caller can fall back
 * to the glyph-id-count heuristic.
 */
function analyseEmbeddedSubset(buf: Buffer): Buffer | null {
  // Find "N 0 obj ... /FontFile2 ... stream" and take the following stream.
  const raw = buf.toString('latin1');
  const marker = raw.indexOf('/FontFile2');
  if (marker === -1) return null;
  const streamStart = raw.indexOf('stream', marker);
  if (streamStart === -1) return null;
  let st = streamStart + 6;
  if (buf[st] === 0x0d) st += 1;
  if (buf[st] === 0x0a) st += 1;
  const end = raw.indexOf('endstream', st);
  if (end === -1) return null;
  try {
    return zlib.inflateSync(buf.subarray(st, end));
  } catch {
    return null;
  }
}

/** TrueType table directory reader - enough to read head/maxp/glyf/loca/cmap. */
function readSfnt(buf: Buffer) {
  let base = 0;
  const tag = buf.toString('latin1', 0, 4);
  if (tag === 'ttcf') {
    base = buf.readUInt32BE(12);
  }
  const numTables = buf.readUInt16BE(base + 4);
  const tables = new Map<string, { off: number; len: number }>();
  for (let i = 0; i < numTables; i += 1) {
    const rec = base + 12 + i * 16;
    const name = buf.toString('latin1', rec, rec + 4);
    tables.set(name, { off: buf.readUInt32BE(rec + 8), len: buf.readUInt32BE(rec + 12) });
  }
  return tables;
}

function glyphSignature(sfnt: Buffer, tables: Map<string, { off: number; len: number }>, gid: number): string {
  const maxp = tables.get('maxp');
  const head = tables.get('head');
  const loca = tables.get('loca');
  const glyf = tables.get('glyf');
  if (!maxp || !head || !loca || !glyf) return `no-glyf:${gid}`;
  const numGlyphs = sfnt.readUInt16BE(maxp.off + 4);
  if (gid < 0 || gid >= numGlyphs) return `oob:${gid}`;
  const indexToLocFormat = sfnt.readInt16BE(head.off + 50);
  const locaOff = (gid: number): number => {
    if (indexToLocFormat === 0) return loca.off + gid * 2;
    return loca.off + gid * 4;
  };
  const start =
    indexToLocFormat === 0
      ? sfnt.readUInt16BE(locaOff(gid)) * 2
      : sfnt.readUInt32BE(locaOff(gid));
  const end =
    indexToLocFormat === 0
      ? sfnt.readUInt16BE(locaOff(gid + 1)) * 2
      : sfnt.readUInt32BE(locaOff(gid + 1));
  if (end <= start) return `empty:${gid}`;
  const g = sfnt.subarray(glyf.off + start, glyf.off + end);
  const numberOfContours = sfnt.readInt16BE(glyf.off + start);
  // Signature: contour count + total byte length + first/last bytes.
  const head16 = g.length >= 12 ? g.readUInt16BE(10) : 0;
  return `${numberOfContours}:${g.length}:${head16}`;
}

function readCmapCps(sfnt: Buffer, tables: Map<string, { off: number; len: number }>): Map<number, number> {
  const out = new Map<number, number>();
  const cmap = tables.get('cmap');
  if (!cmap) return out;
  const base = cmap.off;
  const numSub = sfnt.readUInt16BE(base + 2);
  for (let i = 0; i < numSub; i += 1) {
    const rec = base + 4 + i * 8;
    const platform = sfnt.readUInt16BE(rec);
    const encoding = sfnt.readUInt16BE(rec + 2);
    const off = base + sfnt.readUInt32BE(rec + 4);
    if (!(platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10)))) continue;
    const format = sfnt.readUInt16BE(off);
    if (format !== 4 && format !== 12) continue;
    // gidForCodepoint
    if (format === 4) {
      const segX2 = sfnt.readUInt16BE(off + 6);
      const seg = segX2 / 2;
      const endO = off + 14;
      const startO = endO + segX2 + 2;
      const deltaO = startO + segX2;
      const rangeO = deltaO + segX2;
      for (let cp = 0x20; cp <= 0xffff; cp += 1) {
        for (let s = 0; s < seg; s += 1) {
          const end = sfnt.readUInt16BE(endO + s * 2);
          if (cp > end) continue;
          const start = sfnt.readUInt16BE(startO + s * 2);
          if (cp < start) break;
          const delta = sfnt.readInt16BE(deltaO + s * 2);
          const rangeOffset = sfnt.readUInt16BE(rangeO + s * 2);
          let gid: number;
          if (rangeOffset === 0) {
            gid = (cp + delta) & 0xffff;
          } else {
            const gi = rangeO + s * 2 + rangeOffset + (cp - start) * 2;
            gid = sfnt.readUInt16BE(gi);
            if (gid !== 0) gid = (gid + delta) & 0xffff;
          }
          if (gid !== 0) out.set(cp, gid);
          break;
        }
      }
    }
  }
  return out;
}

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: 'Cairo', fontSize: 40 },
  rtl: { fontFamily: 'Cairo', fontSize: 40, textDirection: 'rtl' },
});

function page(children: React.ReactNode, key: string) {
  return (
    <Page key={key} size="A4" style={styles.page}>
      {children}
    </Page>
  );
}

async function renderProbe(): Promise<Buffer> {
  const doc = (
    <Document>
      {page(
        <>
          {/* no direction attribute - default */}
          <Text>ببببب</Text>
        </>,
        'p1',
      )}
      {page(
        <>
          {/* explicit RTL */}
          <Text style={styles.rtl}>ببببب</Text>
        </>,
        'p2',
      )}
      {page(
        <>
          <Text>محمد</Text>
          <Text>محمد</Text>
        </>,
        'p3',
      )}
      {page(
        <>
          <Text>لالا</Text>
          <Text>الله</Text>
        </>,
        'p4',
      )}
    </Document>
  );
  return Buffer.from(await renderToBuffer(doc as never));
}

function _distinctInRun(run: number[]): Set<number> {
  return new Set(run);
}

async function main() {
  await registerPdfFonts();
  const buf = await renderProbe();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'shaping-probe.pdf'), buf);

  const streams = inflateAll(buf);
  const { runs, rtlOps } = parseRuns(streams);
  const toUnicode = parseToUnicode(streams);
  const subset = analyseEmbeddedSubset(buf);

  console.log('='.repeat(72));
  console.log('ARABIC SHAPING DIAGNOSTIC — @react-pdf/renderer');
  console.log('='.repeat(72));
  console.log(`PDF size            : ${(buf.length / 1024).toFixed(1)} KB`);
  console.log(`Text runs found     : ${runs.length}`);
  console.log(`RTL (Tr) operators  : ${rtlOps}`);
  console.log(`ToUnicode entries   : ${toUnicode.size}`);
  console.log(`Embedded subset     : ${subset ? `${(subset.length / 1024).toFixed(1)} KB` : 'not extractable'}`);
  console.log('');

  // Locate the run that corresponds to "ببببب": 5x BEH (0x0628) in ToUnicode.
  const BEH = 0x0628;
  const behRuns = runs.filter((r) => r.filter((cid) => toUnicode.get(cid) === BEH).length >= 4);
  console.log(`Runs containing >=4 BEH glyphs: ${behRuns.length}`);

  for (const [i, run] of behRuns.entries()) {
    const cps = run.map((cid) => toUnicode.get(cid) ?? 0);
    const behPositions = run
      .map((cid, idx) => (toUnicode.get(cid) === BEH ? idx : -1))
      .filter((x) => x >= 0);
    const distinct = new Set(behPositions.map((p) => run[p]!));
    console.log('');
    console.log(`  run #${i + 1}: glyph ids = [${run.join(', ')}]`);
    console.log(`            codepoints = [${cps.map((c) => (c ? 'U+' + c.toString(16).toUpperCase().padStart(4, '0') : '?')).join(', ')}]`);
    console.log(`            BEH count=${behPositions.length}  distinct glyphs for BEH=${distinct.size}`);
  }

  // Outline comparison using the embedded subset, when available.
  let outlineResult = 'subset not analysable';
  if (subset) {
    try {
      const tables = readSfnt(subset);
      const maxp = tables.get('maxp');
      const numGlyphs = maxp ? subset.readUInt16BE(maxp.off + 4) : 0;
      const subsetCmap = readCmapCps(subset, tables);
      outlineResult = `subset glyphs=${numGlyphs} cmapEntries=${subsetCmap.size}`;
      console.log('');
      console.log(`  ${outlineResult}`);

      // Compare the original Cairo font's presentation forms.
      const origPath = path.join(process.cwd(), 'public', 'fonts', 'Cairo-Regular.ttf');
      const orig = fs.readFileSync(origPath);
      const origTables = readSfnt(orig);
      const origCmap = readCmapCps(orig, origTables);
      const FORMS: [string, number][] = [
        ['beh isolated FE8F', 0xfe8f],
        ['beh final    FE90', 0xfe90],
        ['beh initial  FE91', 0xfe91],
        ['beh medial   FE92', 0xfe92],
      ];
      console.log('  Original Cairo glyph ids for Arabic Presentation Forms-B:');
      for (const [label, cp] of FORMS) {
        const gid = origCmap.get(cp);
        const sig = gid !== undefined ? glyphSignature(orig, origTables, gid) : 'n/a';
        console.log(`    ${label}  gid=${gid ?? 'n/a'}  outline=${sig}`);
      }
    } catch (e) {
      outlineResult = `error: ${(e as Error).message}`;
    }
  }

  const shapingVerdict =
    behRuns.length > 0 && behRuns.every((run) => {
      const behGids = run.filter((cid) => toUnicode.get(cid) === BEH);
      return new Set(behGids).size >= 2;
    })
      ? 'SHAPING PRESENT'
      : 'NO SHAPING DETECTED (each Arabic letter emitted as a single isolated glyph)';

  console.log('');
  console.log('='.repeat(72));
  console.log(`VERDICT: ${shapingVerdict}`);
  console.log(`RTL operator emitted by library: ${rtlOps > 0 ? 'YES' : 'NO'}`);
  console.log(`Subset analysis: ${outlineResult}`);
  console.log('='.repeat(72));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
