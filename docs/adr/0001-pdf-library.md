# ADR-001 — PDF library for Arabic receipts, attestations and invoices

**Status:** accepted · **Date:** 2026-09-30 · **Applies to:** Phase 1 onward

## Context

Every printed document of the centre (payment receipt, attendance attestation,
exam certificate, invoice) must contain the centre name, the student name, the
amount and the date in **Arabic and French, on the same page**. Arabic requires
contextual letter shaping (initial / medial / final forms, lam-alef ligatures,
optional diacritics) and right-to-left layout. A PDF library that stores Arabic
as raw codepoints produces reversed, unjoined and unreadable output.

The specification requires the failure of any candidate library to be documented
with its exact output before a fallback is evaluated.

## Decision

Use **`@react-pdf/renderer` v4 with the bundled Cairo font** (SIL Open Font
License, weights 400/600/700 in `public/fonts/`), driven from server-only
modules under `src/lib/pdf/`.

`pdfmake` was evaluated as the fallback and is **not** adopted; its probe
(`scripts/probe-pdfmake-rtl.ts`) is kept for reference.

## What was verified

`npm run verify:pdf` renders a real PDF and inspects the produced bytes. The
report is written to `verify/arabic-pdf-report.json`; the current run is
**13/13 checks passed**:

| Check | Result |
| --- | --- |
| Valid PDF header / EOF | pass |
| Font embedded as CIDFontType2 with FontFile2 | pass |
| Embedded font is Cairo | pass |
| Identity-H Unicode CID mapping | pass |
| Arabic runs shaped and stored in visual order | pass |
| Glyph-selection (`gs`) operators present | pass (84) |
| Font `cmap` covers Arabic, diacritics, Latin, `é`, `€` | pass (14 codepoints) |
| Arabic not stored in reversed order | pass |
| Text-showing operators emitted | pass (128 `TJ`) |
| All three weights embedded | pass (3 `FontFile2`) |
| A4 page geometry | pass (`595.280029 × 841.890015` pt) |
| Independent reader (`pdftotext`) recovers readable Arabic | pass |
| Same reader recovers the French text verbatim | pass |

## The two checks that initially failed — and why they were wrong

The first run of the verification reported 9/11 with two failures. **Neither was
a defect of the PDF; both were defects of the verification script**, and both
are worth recording because they are easy to mistake for real bugs.

### 1. "RTL text direction operators (Tr) present = false"

This check looked for the `Tr` operator in the content streams. `Tr` is the PDF
**text rendering mode** operator (fill, stroke, invisible, …). It has nothing to
do with direction: **PDF has no text-direction operator at all.**

Direction is carried by emitting *shaped glyphs in visual order*, which is
exactly what `@react-pdf/renderer` + fontkit do. The proof is in the other
checks: `Identity-H` maps glyphs back to Arabic codepoints, `gs` operators show
shaping ran, and no reversed Arabic appears in any stream. A `/Direction /R2L`
marker would only appear in a *tagged* PDF, which this producer does not emit.

The check was replaced by **"Arabic runs are shaped and stored in visual
order"**, which asserts the three signals that actually guarantee correct
rendering, and reports the (expected to be zero) count of `R2L` markers.

### 2. "A4 page size = false"

The check matched the literal string `595.28 841.89`. The real page box is
written at full float precision as `595.280029 841.890015`, so the regex never
matched. The check now parses the four numbers and compares them with a 0.5 pt
tolerance.

## Known limitation: text extraction from RTL PDFs

`pdftotext` recovers every Arabic character of the test document, but it does
**not** reproduce reading order faithfully: it does not insert spaces at Unicode
bidi boundaries and it re-orders embedded digit runs (`2026-00042` can come back
as `00042-2026`). This is a property of PDF text extraction, not of this
generator, and it does not affect what a human sees when printing the document.

Consequence for the product: **a PDF is a document to read, never a data
source.** Financial totals must always be readable from the database and the
UI; a PDF that is only ever read visually is fine, but any workflow that tries
to parse Arabic back out of a generated PDF would be unreliable.

## Consequences

- `src/lib/pdf/fonts.ts` registers the three Cairo weights once per process.
- Every PDF is generated server-side; the browser never renders documents.
- `npm run verify:pdf` is part of the release checklist. A change to the font,
  the producer version or the layout must keep it at 13/13.
