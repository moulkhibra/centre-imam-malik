# AGENTS.md: Centre Imam Malik

Management software for a Moroccan support/training center (students, groups,
attendance, payments, training, exams). Offline-first, Windows PC, FR/AR (RTL).

Read MASTER_PROMPT.md (full spec) and PHASE_PROMPTS.md (phase by phase prompts).
Work ONLY on the phase the user names. Never start the next phase. Never merge
to master. Never push unless asked.

## Stack and conventions
- Next.js, React, TypeScript, Tailwind v4, Prisma 7 + SQLite (better-sqlite3), Zod.
- Node.js 22 LTS only. PDF: @react-pdf/renderer with embedded Cairo font.
- Ports: dev uses PORT from .env (3010). E2E uses 3210. NEVER use 3000
  (another project on this machine). reuseExistingServer stays false.
- Layout: logical Tailwind classes only (start/end, ms/me, ps/pe), no
  left/right. Every page has loading, empty and error states, in FR and AR.
- Every Server Action: authenticate, authorize (RBAC), validate (Zod), scope by
  centerId, audit entry, soft delete. Return errorKey (errors.*), never
  French sentences. Add FR + AR for every new string.
- List filters travel flat in the URL; reuse src/lib/lists.ts.
- Money is calculated on the server only, with the existing money convention.
- Operating model: one secretary with full ADMIN rights plus an emergency
  ADMIN; teachers have no accounts by default (see PHASE_PROMPTS.md).

## Testing rules
- A new test must fail on the bug it covers: revert, run, confirm red, restore.
- Never loosen an assertion, delete a test, or raise retries to get green.
  Retries only for proven timing flakes.
- Filters, sorting and pagination are asserted by changed row content.
- Read real error objects instead of trusting docs.

## Speed policy (keep iterations fast)
- While building: run only the relevant checks (typecheck, lint, the specific
  vitest files, one Playwright spec). Do not run the whole gate every step.
- Full gate once at the end of the phase: typecheck, lint, unit, integration,
  build, full E2E. Repeat E2E three times only if a flaky test was touched or
  it is Phase 14.
- Do not rebuild or re-run a step that already passed and did not change.
- Make a WIP commit after each passing step (power cuts have happened).
- Do not read or dump huge files or logs; use grep, head and line ranges.

## Reporting
Be honest: separate "verified by running" from "written but not run".
Final report: implemented, files changed, database changes, exact test numbers
per step, bugs found, deferred items and why, known issues. Then STOP and wait
for CONTINUE.
