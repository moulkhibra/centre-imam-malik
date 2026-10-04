# PHASE PROMPTS: Centre Imam Malik (Phase 2B to Phase 14)

Put this file in the project root next to MASTER_PROMPT.md.

## How to use (for you)

For every phase:
1. `git switch master && git pull` then `git switch -c wip/phase-XX`
2. Open OpenCode and paste: the COMMON RULES block + the phase block.
3. While it works: do not run build/e2e yourself, keep the charger plugged in.
4. When it reports and STOPS: read the report, do the "MANUAL CHECK" of the phase, then merge:
   `git switch master && git merge --ff-only wip/phase-XX && git tag <commit-name> && git push && git push --tags`
5. Only then start the next phase.

Recommended order (first usable delivery for the center first):

| Order | Phase | Why |
|---|---|---|
| 1 | 2B Users + center settings | the center can create its own accounts |
| 2 | 3 Groups, registrations, timetable | needed by attendance and finance |
| 3 | 5 Finance | used every day by the secretary |
| 4 | 4 Attendance | daily teacher work |
| 5 | 11 Excel import/export | load the existing students |
| 6 | 12 Backup + USB installer for Windows | installable at the center, USB removed after install |
| ---- | **first delivery to the center (pilot week)** | |
| 7 | 6 Training | |
| 8 | 7 Exams, grades, report cards | |
| 9 | 8 Documents + all PDFs | |
| 10 | 9 Reports | |
| 11 | 10 Notifications | |
| 12 | 13 Security + audit | |
| 13 | 14 Final QA | |

The master prompt numbers still apply (commit names, stop rule). If you change the order, tell OpenCode: "Do PHASE X now" and it must not follow the numeric order.

---

## CENTER OPERATING MODEL (applies to every phase)

```text
The center runs the system with ONE daily operator: the secretary, who
has FULL administrator rights (decision of the center owner).
Teachers do NOT use the system and have no accounts by default.
- Accounts: the secretary's account has the ADMIN role (everything:
  daily work, users, settings, backups, restore, corrections of old
  financial records). Plus one EMERGENCY ADMIN account, created at
  install, whose password is kept by the center owner (sealed, not used
  day to day). The "last active ADMIN cannot be deactivated or demoted"
  rule stays. TEACHER, DIRECTEUR and SECRETARY roles stay in the code
  as optional roles for later.
- A Teacher record (profile, groups, hours) does not require a user.
- Attendance is taken on printed sheets by teachers and entered by the
  secretary: the app must print a clear sheet per group/session and make
  entering it fast (a keyboard/phone-friendly grid, "all present").
- Safety net for a single powerful operator (not restrictions):
  every financial correction (void, refund, edit of an old payment)
  needs a mandatory reason and a confirmation, is a reversing entry
  (never a silent edit), and is audited with old and new values.
  Deletions are soft. Daily automatic backup. A short daily summary
  (collected, voided, corrected) and an audit viewer so the owner can
  review activity.
- Home screen for the secretary (build it as each phase lands): quick
  actions (new student, new payment, take attendance, print a receipt),
  today's sessions, unpaid this month, recent receipts.
- Few clicks, big buttons, clear French/Arabic wording, forgiving forms
  (keep input on error, undo where possible), fast search by student
  name, phone or parent phone.
```

---

## COMMON RULES (paste with EVERY phase)

```text
Read MASTER_PROMPT.md and PHASE_PROMPTS.md. Execute ONLY the phase below.
Do NOT start the next phase. Do NOT merge to master.

Lessons from earlier phases (mandatory):
1. Tests must fail on the bug they claim to cover. For every bug fix and
   every new rule, prove the new test fails on the broken code (revert,
   run, confirm red, restore). Never loosen an assertion, delete a test,
   or raise retries to get green. Retries only for proven timing flakes.
2. Unit tests are not enough. Every user-visible flow needs an E2E test
   that clicks through the real UI in FR and AR. Filters, sorting and
   pagination must be asserted by changed row content, not by URL.
3. No French text on Arabic screens: server actions return errorKey
   (errors.*), never sentences. Add FR + AR for every new string. Add a
   test that no Latin/French message appears in Arabic error banners.
4. Read the real error object instead of trusting library docs
   (Prisma 7 + better-sqlite3 puts unique-constraint columns in
   meta.driverAdapterError.cause.constraint.fields, not meta.target).
5. List filters travel flat in the URL (?stage=X). Reuse the shared list
   infrastructure (src/lib/lists.ts) and its tests; do not re-implement.
6. Every Server Action: authenticate, authorize (RBAC), validate (Zod),
   scope by centerId, write an audit entry, soft delete where needed.
   Add an authorization test for each role on each new action.
7. RTL: use logical Tailwind classes (start/end, ms/me, ps/pe). Check
   every new page at desktop and mobile width in FR and AR.
8. Every page has loading, empty and error states, translated.
9. Money: follow the existing money convention, server-side calculation
   only, never trust amounts from the client.
10. Ports: dev server on PORT from .env (3010); E2E uses 3210. Never use
    3000 (another project uses it). reuseExistingServer stays false.
11. Make a WIP commit after each passing step so a power cut costs
    nothing. Final commit only after the full gate passes.
12. Be honest in the report: separate "verified by running" from
    "written but not run". Do not claim anything works unless you ran it.

Final gate with EXACT numbers per step: typecheck, lint, unit,
integration, build, E2E (3 consecutive green runs), and verify:pdf when
PDFs are touched. Update README test counts and phase status.
Report with: implemented, files changed, database changes, test numbers,
bugs found, deferred items and why, known issues. Then STOP and wait for
CONTINUE.
```

---

## PHASE 2B: Users and center settings (commit: phase-02b-users-settings)

```text
PHASE 2B (deferred from Phase 2).

1. User management (/admin/users): list, create, edit, deactivate users;
   assign a role (ADMIN, DIRECTEUR, SECRETARY, TEACHER); link a TEACHER user to a Teacher record (optional: teachers
   do not need accounts); reset a password (forces a change at next
   login); show the permissions of each role. The last active ADMIN
   cannot be deactivated or demoted. Only ADMIN can create ADMIN users.
   Audit entry for every change.
2. `npm run admin:reset`: asks for email and a new temporary password,
   forces change at next login, clears any lockout, writes an audit
   entry. Document it in README.
3. Center settings (/settings): center name (FR/AR), SHORT name for the
   sidebar, logo upload (validate type, size and magic bytes; store
   outside the public web root and serve through an authorized route),
   address, phone, email, website, Facebook, Instagram, WhatsApp,
   primary/secondary colors, receipt footer, certificate footer. The
   layout must use these values (sidebar name, logo, colors) instead of
   hardcoded text. Validate colors (hex) and contrast.
4. Show the nav entries for both screens (update CURRENT_PHASE and the
   navigation test).
5. Arabic fixes: replace every remaining "الأستاذة" with "الأساتذة" and
   add a unit test that it never appears in ar.ts; use "الأولياء"
   instead of "الآباء" for Parents; translate the hardcoded Spinner
   aria-label.
6. Fix the duplicated "Rechercher" button in list toolbars.
Commit: phase-02b-users-settings.
```

**MANUAL CHECK:** أنشئ مستخدم SECRETARY ومستخدم TEACHER، دخل بكل واحد وشوف شنو كيبان ليه. جرب تحيد آخر ADMIN (خاص يرفض). بدل اسم المركز واللوغو وشوف الـ sidebar. جرب `npm run admin:reset`.

---

## PHASE 3: Groups, registrations, timetable (commit: phase-03-academic-management)

```text
PHASE 3.

1. Groups: CRUD with name, level, subject OR service, teacher, room,
   capacity, price, status, academic year, description. List with
   search, filters (level, subject, teacher, status, year), sorting,
   server-side pagination. Group detail page: students, schedule, teacher.
2. Schedule slots per group: day, start time, end time. Several slots per
   group. Validate end > start.
3. Conflict detection, enforced on the SERVER inside a transaction, with
   a clear translated error:
   - teacher overlap, room overlap, group overlap.
   - back-to-back sessions (end == next start) are allowed.
   - editing a slot must ignore itself in the conflict check.
   Unit-test every overlap edge case (partial overlap, containment,
   identical, adjacent, different days).
4. Registrations (inscriptions): a student registers in a group, a
   service or later a training. Fields: student, group/service, academic
   year, start date, end date, base price, discount (fixed amount for
   now; promotions come in Phase 5), final price, payment plan
   (MONTHLY, PER_SESSION, PER_PROGRAM), status (ACTIVE, PENDING,
   COMPLETED, CANCELLED). Final price never negative.
5. Rules enforced server-side and concurrency-safe (transaction):
   - no duplicate ACTIVE registration for the same student and group.
   - group capacity can never be exceeded (test two parallel requests).
   - a student can join several groups; a registration can be cancelled
     (soft) without losing history.
   - registrations belong to one academic year; do not mix years.
6. Student profile: "Registrations / Groups" tab. Group page: add and
   remove students, show seats left.
7. Timetable: daily, weekly and monthly views; filter by teacher, room,
   group, level. Printable A4 timetable and PDF export (reuse the
   verified Arabic PDF setup; run verify:pdf). Drag and drop is optional,
   skip it unless it is simple and tested.
8. TEACHER role sees only their own groups and timetable (test it).
9. Nav entries, CURRENT_PHASE, translations FR/AR, RTL for the timetable
   grid (days order and alignment).
Commit: phase-03-academic-management.
```

**MANUAL CHECK:** أنشئ مجموعة، سجل 2 تلاميذ، جرب تتجاوز السعة. جرب حصتين لنفس الأستاذ فنفس الوقت، ونفس القاعة. شوف الجدول الأسبوعي بالعربية (الأيام من اليمين). اطبع الجدول PDF وشوف العربية.

---

## PHASE 5: Finance (commit: phase-05-finance)

```text
PHASE 5 (do it right after Phase 3; Phase 4 comes after).

1. Promotions: name, code, type FIXED or PERCENTAGE, value, start/end
   date, eligibility (new registration, family/sibling, multi-subject,
   early registration), active flag, stacking rule configurable.
   Applying a promotion to a registration recalculates final price on
   the server; never below 0; percentage 0..100.
2. Payments: types (REGISTRATION, MONTHLY, TRAINING, COURSE, EXAM,
   OTHER), methods (CASH, BANK_TRANSFER, CHEQUE, CARD, OTHER), amount,
   date, reference, note, user. Full, partial and advance payments.
   Overpayment only when explicitly allowed as credit. Remaining
   balance and status always derived on the server.
3. Monthly fees: generate the monthly dues of a MONTHLY registration for
   each month of its period; statuses PAID, PARTIAL, UNPAID, OVERDUE
   (due day configurable in settings). A payment is allocated to the
   oldest due first (documented rule, unit-tested).
4. Screen "Who paid this month?": pick month and academic year; every
   actively enrolled student with due, paid, remaining and status.
   Filters (status, group, level, subject, teacher), search by student
   or parent name/phone, totals on top (expected, collected, remaining,
   count per status), record a payment from the row, print/export the
   unpaid list (PDF and Excel), per-student month-by-month history,
   parent phone/WhatsApp visible, and a "WhatsApp reminder" button on each
   unpaid row that opens a wa.me click-to-chat link with an editable
   FR/AR template (student, amount, month, center name, phone normalized
   to +212). No credentials, no API; the secretary presses send in
   WhatsApp herself. Record "reminder prepared" with date and user, show
   the last reminder date and warn before a second reminder within 3
   days. Respect a per-parent "do not contact" flag. Dashboard card "Unpaid this month"
   links here.
5. Receipts: unique number per center and year (format R-2026-000123),
   generated in a transaction so two simultaneous payments never share a
   number (test it). A4 PDF with logo, center name, address, phone,
   student, reason, amount, method, paid, remaining, cashier, footer.
   Optional 80mm thermal layout. Arabic and French render correctly
   (run verify:pdf). Print and PDF buttons.
6. Corrections: payments are never deleted. Use VOID or REFUND with a
   reason, creating reversing entries and an audit entry. Voids, refunds and
   corrections of any age: ADMIN (the secretary account) and DIRECTEUR,
   always with a mandatory reason, confirmation and reversing entries;
   TEACHER has no finance access. Test every role.
7. Expenses: configurable categories, amount, date, description,
   method, reference, created by. Cash register: daily open/close with
   opening balance, revenue, refunds, expenses, closing balance
   (Opening + Revenue - Refunds - Expenses = Closing), difference
   recorded when the counted cash differs. Everything traceable.
8. Optional invoices with configurable tax (do not invent tax rules).
9. Dashboard cards and charts (today/monthly revenue, unpaid, payment
   methods) now read real data; keep the empty states.
10. Tests: unit (discounts, allocation, balances, rounding, overdue),
    integration (RBAC, void/refund, receipt numbering under
    concurrency, cash register totals), E2E (register + pay + receipt
    in FR and AR, the "who paid" screen filters).
Commit: phase-05-finance.
```

**MANUAL CHECK:** سجل تلميذ بـ 500 DH، أدي 300 وشوف الباقي 200. اطبع الـ reçu وافتح PDF (العربية متصلة؟). جرب بحساب SECRETARY: ما خاصو يقدر يلغي أداء. شوف شاشة "شكون أدى" وفلتر بالحالة. سد الـ caisse آخر النهار.

---

## PHASE 4: Attendance (commit: phase-04-attendance)

```text
PHASE 4.

1. Sessions: a session is a real occurrence of a group slot on a date.
   Generate sessions from the schedule for a date range; allow adding an
   extra session, cancelling a session (holiday, teacher absent) with a
   reason, and a make-up session. Attendance can only be recorded on a
   real session.
1b. Teacher presence per session, recorded by the secretary: PRESENT,
   LATE, ABSENT, REPLACED (store the substitute teacher), with an optional
   note. A session where the teacher is ABSENT and not replaced can be
   cancelled with a reason and offered a make-up date. Substitute teachers
   must pass the same teacher conflict checks. Held hours of a teacher =
   sessions actually held (PRESENT, LATE, or taught as substitute), never
   the planned ones. Unrecorded past sessions are listed on the secretary
   home screen as "teacher presence not confirmed".
2. Take attendance: choose group and date, list the registered students,
   mark PRESENT, ABSENT, LATE, EXCUSED, optional note, "mark all
   present" shortcut. Store recorded by and timestamp. Fast and usable
   on a phone (teachers).
3b. Phone-first attendance screen (portrait phone, one hand): pick the
   group and session, one big row per student with four large buttons
   (present, absent, late, excused) plus "all present", a sticky save
   bar with a counter (marked / total), search by name. Save per
   student as soon as it is tapped (optimistic UI with a visible saved
   state) and retry on failure. If the connection drops, keep the
   unsaved marks on screen with a clear "not saved" warning and a
   retry button; never lose input silently and never fake a saved
   state. Works over the center Wi-Fi only (no offline mode, no
   service worker). Test at 360x740 in FR and AR with Playwright,
   including a simulated network failure and recovery.
3a. Default flow: the SECRETARY enters attendance from the printed
   sheet (see CENTER OPERATING MODEL). Make this fast: one screen per
   session, keyboard and phone friendly, "all present" then exceptions.
3. Rules (if teacher accounts are enabled): TEACHER can record only for their own groups and only within a
   configurable window (default 7 days); ADMIN/DIRECTEUR/SECRETARY can
   correct any time; every correction is audited with old and new value.
4. Students who joined or left mid-period must appear only on sessions
   within their registration dates.
5. Statistics: attendance rate, absence rate, repeated absences
   (configurable threshold, default 3 consecutive or 3 in a month).
   Student profile shows attendance history; group and monthly reports;
   printable blank attendance sheet (paper backup) and filled sheet.
6. Dashboard cards (today's classes, today's attendance, absences,
   lates) read real data.
7. Tests: unit (rates, thresholds, date windows), integration (RBAC per
   role, teacher scope, audit on correction), E2E (take attendance in FR
   and AR on desktop and mobile width).
Commit: phase-04-attendance.
```

**MANUAL CHECK:** دخل بحساب أستاذ، سجل الحضور لمجموعتو، وجرب مجموعة ماشي ديالو (خاص يرفض). صحح غياب بحساب الإدارة وشوف أنه كيتسجل فالـ audit.

---

## PHASE 11: Excel import/export (commit: phase-11-import-export)

```text
PHASE 11.

1. Student import from Excel (.xlsx) and CSV: upload, column mapping
   screen (Nom, Prénom, Arabic name, Téléphone, WhatsApp, Niveau,
   École, Parent, Téléphone parent, CIN, date of birth, ...), PREVIEW
   before import, row-by-row validation, then import.
2. Report: imported, skipped, invalid, duplicates, with a downloadable
   error file. Never silently import bad data. Duplicate detection by
   CIN, then by name + phone. Choice per run: skip duplicates or update.
3. Everything in ONE transaction per batch (all or nothing option) and
   an audit entry with the file name and counts.
4. Moroccan data handling: normalize phones (06/07 -> +212), trim and
   normalize Arabic and French names, accept dates DD/MM/YYYY and
   Excel serial dates, handle UTF-8 BOM and Windows-1256 CSV, map level
   labels to configured levels with a manual mapping for unknown ones.
5. Optional parent linking: create or reuse parents by phone.
6. Limits: file size, row count, formula/macro content ignored. Reject
   non-spreadsheet files by content, not only extension.
7. Provide a downloadable example template (xlsx) with FR/AR headers.
8. Exports (CSV and Excel) for students, parents, teachers, payments and
   groups. Neutralize formula injection (cells starting with = + - @).
9. Teachers and levels/subjects import is optional; do students and
   parents first.
10. Tests: unit for parsing, normalization and duplicates; integration
    for transactions and RBAC; E2E import with a deliberately dirty
    file (bad phones, duplicates, empty rows, Arabic names).
Commit: phase-11-import-export.
```

**MANUAL CHECK:** حضر Excel بـ 20 تلميذ فيه أخطاء قصدا (هاتف ناقص، CIN مكرر، سطر فارغ) وشوف التقرير. استعمل لائحة حقيقية صغيرة من المركز.

---

## PHASE 12: Backup and USB installer for Windows (commit: phase-12-backup-windows)

Delivery model: a USB drive is only the CARRIER. The installer copies the
app to the center's PC, then the USB is removed and taken away. The app
and its data live on the PC's disk, never on the USB. The center PC must
NOT need Node.js, PostgreSQL, npm or internet.

```text
PHASE 12. Operator scripts already exist from Phase 1: audit and
harden them, do not rewrite blindly.

A. Portable installer package
1. `npm run build:installer` produces a folder to copy onto a USB:
   Centre-Imam-Malik-Setup/
     install.bat, update.bat, uninstall.bat, README.txt
     app/      (Next.js standalone production build + prisma migrations)
     runtime/  (Node.js 22 LTS for Windows x64, bundled)
   The package must not contain node_modules dev dependencies, tests,
   .git, .env, secrets, demo data or a database.
2. Native modules: better-sqlite3 (and any other native dependency) must
   be the win32-x64 build matching the bundled Node 22 ABI. Verify
   this in the build script and fail loudly if the binary is missing or
   for the wrong platform. Document how the package is built for
   Windows (build on Windows or fetch prebuilt binaries).
3. All paths come from environment/config (APP_DIR, DATA_DIR,
   BACKUP_DIR). No hardcoded /home/... or C:\... in code or scripts.

B. install.bat (double-click, no technical knowledge)
4. Default install folder C:\CentreImamMalik (no spaces, not OneDrive);
   the user can choose another folder. Folder layout:
   C:\CentreImamMalik\
     app\  runtime\  data\centre.db  uploads\  backups\  logs\
     start.bat  stop.bat  backup.bat  update.bat
5. Copies app/ and runtime/, creates data/uploads/backups/logs, writes
   a fresh .env with a random SESSION_SECRET, runs Prisma migrations,
   asks for the center name, then creates TWO ADMIN accounts: the
   secretary account (her email and a temporary password) and an
   EMERGENCY ADMIN (random password shown once on screen and in a
   printable sheet for the owner), both forced to change at first login, seeds only production defaults
   (roles, levels, subjects, no demo data).
6. Picks a free port (default 3000, then the next free one), tests that
   the app starts, then creates a desktop shortcut that starts the app
   and opens the browser. Optional start with Windows (Startup folder),
   asked as a yes/no question.
7. Safe to run again: if C:\CentreImamMalik already has data, it must
   NOT overwrite it (switch to update mode and say so).
8. Clear human messages in French (and Arabic where practical), logs in
   logs\install.log. No bash-only syntax, paths with spaces handled,
   CRLF line endings.
9. After install, the USB can be removed; nothing may depend on it.

C. update.bat
10. Run from the USB with a newer package: stops the app, makes a safety
    backup, replaces app/ and runtime/ only, applies new migrations,
    verifies startup, rolls back app/ (and restores the safety backup)
    if the migration or startup fails. data/, uploads/, backups/ and
    .env are never touched. Show old and new version.

D. uninstall.bat
11. Removes the app and the shortcut but keeps data/, uploads/ and
    backups/ unless the user explicitly types a confirmation word.

E. Backup and restore
12. Backup screen (/admin/backup, ADMIN only): manual backup, history
    (date, size, status, verified), configurable destination folder
    (a second disk or an external USB owned by the center), retention
    (keep last N daily and M weekly), never delete the last valid
    backup. Warn clearly when BACKUP_DIR is on the same disk as the
    database (a disk failure would lose both).
13. Safe SQLite backup only (VACUUM INTO or the .backup API), never a
    plain file copy. Every backup is verified (integrity_check and
    opened read-only). Daily automatic backup that works on Windows
    (in-app scheduler or Task Scheduler) and is documented.
14. Restore script: refuses to run while the app runs, saves the current
    DB first, verifies the backup, restores. Test a real round trip:
    backup, change data, restore, check a marker row.
15. A "copy backups to USB" command (backup-to-usb.bat) for the
    technician: copies the backups folder to a chosen drive.

F. Auto-start, LAN, docs
16. Opt-in LAN mode: listen on 0.0.0.0, show the PC LAN IP and URL, add
    the firewall rule through an explicit, explained step, never expose
    publicly by default; cookies and base URL must work from another PC.
16a. One-click launcher (the center's staff must never see a console):
    - A desktop icon named after the center, using the center logo as a
      multi-size .ico (16, 32, 48, 256) generated from the logo file
      (fallback icon if no logo yet).
    - Clicking it: if the server is not running, start it hidden (no
      console window), wait until the health check answers (show a small
      "Starting..." page, timeout with a clear error and the log path),
      then open the default browser on the app URL. If it is already
      running, just open the browser.
    - Optional start with Windows: starts the server hidden at logon, so
      the icon only opens the browser. Asked as a yes/no in install.bat,
      switchable later from a script.
    - A second shortcut "Arreter" that stops the server cleanly (same
      effect as stop.bat), and a log file for startup problems.
    - Handles being clicked twice, a port conflict, a crashed server
      (stale PID) and a PC that was shut down abruptly.
16b. Friendly address: the desktop shortcut is named after the center
    (center short name from settings) with the center logo as icon and
    opens the app URL, so users never see an IP. Optional setting
    "friendly host name" (default centre-imam-malik.local): the installer
    can add it to the local hosts file (explicit, explained admin step)
    and the start screen shows the friendly URL and the LAN IP URL.
    Support PORT=80 when free (detect conflicts with IIS/XAMPP and fall
    back with a clear message). Keep APP_URL and cookie settings
    consistent with the chosen name. Document the three LAN options:
    rename the Windows PC, hosts file on each client PC, router DNS;
    and recommend a DHCP reservation or static IP for the server PC.
    Do not use a real internet domain name.
16c. Phone and tablet access over the center Wi-Fi: the app must be fully
    usable in a mobile browser (login, attendance, student search,
    payment lookup). Add a web app manifest and icons generated from the
    center logo so "Add to Home Screen" shows the logo and opens the app
    full screen. No service worker or offline mode for phones (it needs
    HTTPS and the server is on the PC). Show, on the LAN settings screen,
    the URL to type on a phone and a QR code of it. Document: phone and PC
    on the same Wi-Fi, use the IP (not the .local name) on phones, DHCP
    reservation for the server PC, AP isolation / guest Wi-Fi blocking
    access, strong WPA2/WPA3 password, and that there is no HTTPS inside
    the LAN. No remote access from outside the center by default; never
    open router ports.
17. Docs for a non-technical person (describe steps in words):
    INSTALLATION.md, BACKUP.md, LAN_SETUP.md, DEPLOYMENT.md, plus a
    one-page README.txt inside the package. Explain Windows SmartScreen
    / Defender warnings and "Run anyway".

G. Tests and honesty
18. Tests: unit/integration for backup, verification, retention, restore,
    update rollback logic, path handling (spaces, non-ASCII), package
    content check (no secrets, no dev files, correct native binary).
19. List explicitly everything that could NOT be tested on Windows from
    this machine, as a checklist for the human to run on a real Windows
    PC (clean machine without Node installed).
Commit: phase-12-backup-windows.
```

**MANUAL CHECK (ضروري):** على PC Windows نقي ما فيه Node: انسخ المجلد من USB، دوّب `install.bat`، دخل بالحساب، نزع USB وتأكد بلي البرنامج كيخدم. دير backup، مسح تلميذ، رجّع backup. جرب `update.bat` بنسخة جديدة وتأكد بلي الداتا ما تبدلات. وجرب مرة وPC مطفي فنص الكتابة، ورجع شغلو.

---

## PHASE 6: Training (commit: phase-06-training)

```text
PHASE 6.

1. Training programs: title FR/AR, category (pédagogique, artistique,
   professionnelle, religieuse), description, trainer, duration, start
   and end date, capacity, price, room, schedule, status. CRUD with
   list, filters (category, status, trainer, dates), search, sorting,
   server-side pagination.
2. Participants: register students or external participants (name,
   phone, optional CIN) with capacity check (concurrency-safe), price,
   discount, status. External participants are not students.
3. Attendance per training session (reuse the Phase 4 session logic
   without duplicating it).
4. Payments reuse the Phase 5 finance module: registration price,
   partial payments, balance, receipts. Do not create a second payment
   system.
5. Evaluations: simple score or pass/fail per participant, comments.
6. Certificates (Attestation de participation, de formation, de
   réussite): participant, program, duration, dates, trainer/director
   name, signature image, logo, unique certificate number
   (A-2026-000045, concurrency-safe), A4 PDF in FR and AR. Eligibility
   rule configurable (minimum attendance, evaluation passed). Verify
   real PDF rendering of Arabic names with verify:pdf. Reprinting
   keeps the same number; revoking is audited.
7. Room and trainer conflicts apply to training sessions too.
8. Dashboard card "Active trainings" reads real data.
9. Tests: capacity, certificate numbering under concurrency, eligibility
   rules, RBAC; E2E: create training, register participants, pay, mark
   attendance, issue certificate in FR and AR.
Commit: phase-06-training.
```

**MANUAL CHECK:** اصدر attestation باسم عربي مركب، وافتح PDF: واش الحروف متصلة والرقم فريد؟

---

## PHASE 7: Exams, grades, report cards (commit: phase-07-evaluation)

```text
PHASE 7.

1. Exams: title, subject, group, date, teacher, coefficient, max score,
   type (devoir, examen, concours blanc, préparation certificative).
2. Grades entry: grid per exam for the registered students; absent or
   excused marker (not a zero); validation 0..max score; comment.
   TEACHER can grade only their own groups; corrections are audited.
3. Grading configuration (settings): default scale /20 (Moroccan),
   rounding rule and decimals documented, pass mark (default 10),
   mention thresholds. No formulas hardcoded in components; one
   tested calculation module.
4. Calculations: average per exam, weighted average (coefficients),
   subject average, overall average, optional ranking in the group.
   Unit-test edge cases (no grades, only absents, different max
   scores, coefficient 0, rounding).
5. Report cards (bulletins): student info, group, subjects, grades,
   averages, rank (optional), attendance summary (Phase 4), teacher
   comments, center info and signature. A4 PDF in FR and AR; verify
   real rendering with verify:pdf (long Arabic names, mixed text).
6. Student profile shows exams and grades; group page shows results.
7. Tests: calculation module, RBAC (teacher scope), E2E enter grades
   and generate a report card in FR and AR.
Commit: phase-07-evaluation.
```

**MANUAL CHECK:** دخل نقط (واحد غائب)، شوف المعدلات بيدك بحساب بسيط، واطبع bulletin.

---

## PHASE 8: Documents and all printable PDFs (commit: phase-08-documents)

```text
PHASE 8.

1. Document attachments for students, teachers, registrations and
   training participants (CIN, school documents, certificates,
   contracts). Validate extension, MIME type AND magic bytes, size
   limit (configurable), random stored filenames, storage outside the
   public web root, download only through an authorized route (check
   the user can access the owner record, IDOR test), preview for
   images/PDF, soft delete with audit.
2. Printable documents with consistent A4 layouts using center
   branding from settings: student card (with photo and QR/ID),
   registration form (fiche d'inscription), attendance sheets,
   timetables, receipts (A4 and optional 80mm), invoices, report cards,
   certificates. Reuse existing generators; fix inconsistencies.
3. Arabic and French PDFs: add a visual regression-style check (render
   to image or compare structural checks) for each template with long
   Arabic names, mixed AR/FR, numbers, dates and DH amounts. Extend
   verify:pdf to cover all templates.
4. Print CSS for on-screen print pages (A4, margins, RTL).
5. Tests: upload security (wrong extension, spoofed MIME, oversized,
   path traversal filename), authorization on download, PDF checks.
Commit: phase-08-documents.
```

**MANUAL CHECK:** حمل ملف PDF مزور (صورة بامتداد pdf) وشوف أنه كيترفض. اطبع كل قالب على ورق حقيقي وشوف الهوامش والعربية.

---

## PHASE 9: Reports (commit: phase-09-reports)

```text
PHASE 9.

Reports module with filters (period, academic year, group, level,
teacher, status) and exports to PDF, CSV and Excel (neutralize formula
injection):
- Students: active, new registrations, by level, by subject, by group.
- Attendance: daily, weekly, monthly, by student, by group, by teacher.
- Finance: daily and monthly revenue, unpaid balances, payment methods,
  expenses, net revenue, cash register history.
- Teachers: groups, students, hours actually held (from sessions
  held, including substitutions, with planned vs held and absences),
  ready for pay calculation.
- Training: participants, revenue, attendance, certificates.
- Exams: averages per group and subject, pass rates.
Rules: aggregation in the database (no loading entire tables), indexes
for the report queries, pagination for long lists, totals must equal
the sum of the visible rows (test it). RBAC: finance reports for ADMIN,
DIRECTEUR and SECRETARY (read), teachers only see their own groups.
Dashboard charts reuse the same query functions (single source of
truth). Tests: calculation correctness against a seeded dataset
(integration), export content (CSV/Excel opens and totals match),
E2E for two reports in FR and AR.
Commit: phase-09-reports.
```

**MANUAL CHECK:** قارن مجموع تقرير الأداءات مع جمع الـ reçus بيدك.

---

## PHASE 10: Notifications (commit: phase-10-notifications)

```text
PHASE 10.

1. Internal notification center: payment reminder, absence, schedule
   change, registration, announcement. Read/unread, per user and per
   role, translated.
2. Reminder generation: from the unpaid list create reminder messages
   per parent with an editable FR/AR template (placeholders: student,
   amount, month, center). Moroccan phone normalization (+212).
3. WhatsApp without credentials: generate a wa.me click-to-chat link
   with the prefilled message, opened by the secretary. Mark the
   message as PREPARED, never as SENT. Only a real provider
   confirmation may set SENT. Provide a distinct status SENT_MANUALLY that
   the secretary sets herself after sending from WhatsApp, a
   "do not contact" flag per parent, a last-reminder date, a warning
   against duplicate reminders, and a batch screen that walks through
   the unpaid/absent list one parent at a time (open chat, mark sent,
   next). Absence notices to parents use the same mechanism and
   templates (FR/AR). The official WhatsApp Business API stays an
   optional provider behind the interface; do NOT use unofficial
   WhatsApp libraries.
4. Provider architecture for SMS, WhatsApp API and Email behind one
   interface, configuration placeholders in settings and .env.example,
   clear setup documentation. Do not fake external sending. If no
   provider is configured, the UI says so.
4b. Cancelled or moved session (teacher absent, holiday, schedule
   change): prepare a notice for ALL parents of the group's registered
   students, with date, time, reason and make-up date if any, in FR/AR,
   using the same wa.me flow and statuses; one screen walks through the
   parents, with "do not contact" respected.
5. Absence alerts (after threshold) and schedule-change notices create
   notifications automatically; announcements by ADMIN/DIRECTEUR.
6. Log every message prepared/sent with status and the user.
7. Tests: template rendering in FR/AR, phone normalization, no SENT
   status without provider, RBAC; E2E for creating reminders from the
   unpaid list.
Commit: phase-10-notifications.
```

---

## PHASE 13: Security and audit (commit: phase-13-security)

```text
PHASE 13.

1. Audit viewer (/admin/audit, ADMIN and DIRECTEUR): filters by user,
   action, entity, date; metadata with old/new values; export CSV;
   pagination. Audit records cannot be edited or deleted from the UI.
2. Authorization matrix test: automatically iterate EVERY server action
   and route against EVERY role and unauthenticated access, comparing
   with a declared permission matrix. A new action without a declared
   permission must fail the test.
3. IDOR review: every read/update/delete by id checks centerId and the
   user's scope (teacher groups, parent data). Add tests.
4. Login hardening: rate limit and lockout verified, generic error
   messages, session expiry, logout invalidates the session, password
   policy (length, common passwords), forced change tested.
5. HTTP security: security headers and CSP, secure cookie flags,
   CSRF protection of server actions verified, no stack traces in
   production responses.
6. Input and output: Zod on every input, output escaping, file upload
   re-check, SQL via Prisma only (list any raw queries and justify).
7. Secrets: no secrets in Git or logs, .env.example complete,
   SESSION_SECRET rotation documented.
8. Dependencies: npm audit, remove unused packages, lockfile committed.
9. Produce SECURITY_REVIEW.md: checklist with PASS/FAIL, what was
   fixed, residual risks.
Commit: phase-13-security.
```

---

## PHASE 14: Final QA and delivery (commit: phase-14-final-qa)

```text
PHASE 14.

1. Full regression: typecheck, lint, unit, integration, E2E, production
   build, verify:pdf, smoke tests on the production build.
2. End-to-end business scenarios in FR and AR: create users, student +
   parent, teacher, group, registration, schedule, attendance,
   promotion, payment, receipt, expense, cash register close,
   training + certificate, exam + grades + report card, report,
   Excel import, backup, restore.
3. Performance with a generated dataset (about 2000 students, 50000
   payments, 100000 attendance rows): list pages, reports and
   dashboard must stay fast; fix N+1 queries and missing indexes.
   Dataset generator must NOT ship in the production package.
4. Accessibility and usability pass: keyboard navigation, focus, labels,
   contrast, tablet and phone widths, every screen reviewed in Arabic
   (wording, alignment, icons, numbers, dates).
5. Production data policy: a fresh install must contain NO demo data,
   only configuration, roles, default levels/subjects and the initial
   admin. Test a clean install from zero.
6. Final documentation: README, INSTALLATION, USER_MANUAL (task-based:
   register a student, record a payment, take attendance, print a
   receipt, backup), BACKUP, DEPLOYMENT, EXCEL_IMPORT, LAN_SETUP,
   SECURITY_REVIEW, CHANGELOG, known limitations.
7. Delivery package: a ZIP/installer folder without dev files, tests,
   .git, secrets or demo data; version tag v1.0.0.
8. Final audit table of every module (AUTH, RBAC, DATABASE, STUDENTS,
   PARENTS, TEACHERS, GROUPS, SCHEDULE, ATTENDANCE, PAYMENTS, RECEIPTS,
   EXPENSES, CASH, TRAINING, EXAMS, CERTIFICATES, REPORTS,
   NOTIFICATIONS, DOCUMENTS, SETTINGS, BACKUP, SECURITY, RTL,
   RESPONSIVE, PRINTING, PERFORMANCE) with PASS/FAIL and evidence.
Commit: phase-14-final-qa.
```

**MANUAL CHECK:** pilot week فالمركز: السكرتيرة كتستعمل النظام بدل الدفتر، وكتكتب كل مشكل. دير نسخة احتياطية يومية على USB.

---

## Things only you can do (outside the code)

- Make the GitHub repository private.
- Provide the real logo (clear image), price list, groups and teachers.
- Test install.bat on a real Windows PC.
- Train the secretary (30 minutes) and keep the paper notebook during the pilot week.
- Keep a backup copy of the database on a USB drive outside the PC.
