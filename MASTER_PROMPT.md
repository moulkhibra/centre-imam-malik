# MASTER PROMPT: CENTRE IMAM MALIK MANAGEMENT SYSTEM

## ROLE

You are a senior full-stack software architect, developer, database engineer, UI/UX designer, QA engineer, security engineer and DevOps engineer.

Your mission is to BUILD A REAL PRODUCTION-READY MANAGEMENT SOFTWARE for a Moroccan educational support, language and training center. This software will be delivered to a real client.

DO NOT build a demo.
DO NOT build fake screens.
DO NOT use fake statistics in the final application.
DO NOT leave unfinished pages.
DO NOT create buttons that do nothing.
DO NOT leave TODO / FIXME / "coming soon" in delivered code.

---

## 1. REAL CLIENT CONTEXT

Center name (Arabic): مركز الإمام مالك للدعم والتكوين واللغات
Center name (French): Centre Imam Malik de Soutien, Formation et Langues
Phone: 06 37 06 52 18
Address: فوق مكتبة الإمام مالك، بجانب مقهى زاكورة

Services:
- Soutien scolaire
- Accompagnement scolaire
- Encadrement
- Orientation scolaire
- Préparation aux examens
- Préparation aux examens certificatifs
- Formation
- Cours de langues

Languages taught: Français, Anglais, Allemand, Espagnol, Italien

Academic levels: Primaire / أساسي, Collège / إعدادي, Lycée / ثانوي, Universitaire / جامعي

Moroccan high-school levels: Tronc Commun, 1ère Bac, 2ème Bac

Exam preparation: examens scolaires, examens certificatifs (Collège, Lycée, Université)

Training categories: Formation pédagogique, artistique, professionnelle, religieuse

The system must also support: seasonal promotions, preferential prices, offers, discounts, group pricing, individual pricing.

---

## 2. BUSINESS OBJECTIVE

The software manages the daily operations of the center: students, parents, teachers, subjects, languages, levels, groups, rooms, schedules, registrations, attendance, payments, expenses, cash register, training, exams, grades, certificates, reports, documents, notifications, users, permissions, settings, backups.

It must be easy enough for non-technical employees.

---

## 3. TECHNOLOGY DEFAULT

Frontend: Next.js, React, TypeScript, Tailwind CSS, shadcn/ui or equivalent.
Backend: Next.js server/API unless an existing project already has a suitable backend.
Database DEFAULT: SQLite. ORM: Prisma.
Validation: Zod. Forms: React Hook Form. Charts: Recharts or equivalent.
PDF: a reliable solution with proper Arabic support (see section 4).

SQLite is the default because the application must be easy to install on a normal Windows PC and work offline. PostgreSQL must remain possible as an optional production/LAN database. Do not force PostgreSQL for the default installation.

---

## 4. ARABIC PDF REQUIREMENT (CRITICAL)

Arabic text in PDFs must:
- render correctly and in RTL
- not appear reversed or disconnected
- support Arabic diacritics where applicable

Use an embedded Arabic-compatible font such as Cairo, Noto Sans Arabic or Noto Naskh Arabic. Font files must be included and configured correctly.

PDF IMPLEMENTATION (MANDATORY DECISION):

Use @react-pdf/renderer as the default PDF library.

Arabic font: use Cairo or Noto Sans Arabic, embedded directly in the PDF.

Before considering PDF support complete, create and execute a real PDF rendering test containing:
- Arabic
- French
- mixed Arabic/French
- numbers
- dates
- DH amounts
- Arabic diacritics

Verify:
- RTL direction
- Arabic shaping
- Arabic letter joining
- correct alignment
- correct font embedding
- correct printing

If @react-pdf/renderer fails any Arabic rendering requirement, STOP the phase, document the exact failure, and only then evaluate pdfmake as the fallback.

Do not silently switch libraries.

Do not assume Arabic support works. PDF support is not complete until the generated test PDF has been verified.

---

## 5. TARGET ENVIRONMENT

Primary target: Windows PC. Must work offline, without internet, on a normal office computer.
Optional: LAN access from other PCs.

The application must NOT depend on external APIs for normal daily operation. Internet is only needed for optional integrations (WhatsApp/SMS/email) if configured.

---

## 6. INSTALLATION EXPERIENCE

The client is NOT a developer.

Primary target: Windows 10/11.
Target runtime: Node.js 22 LTS.
This project must be developed, tested and documented against Node.js 22 LTS.
install.bat must reject unsupported Node.js versions and clearly require Node.js 22 LTS.

Create simple scripts: install.bat, start.bat, stop.bat, backup.bat (and uninstall.bat if technically appropriate).

install.bat must:
1. Check that Node.js 22 LTS is installed.
2. If Node.js is missing or is not version 22, show a clear human-readable message explaining that Node.js 22 LTS must be installed.
3. Check required dependencies.
4. Install project dependencies.
5. Create/configure the local SQLite database.
6. Run Prisma migrations.
7. Create the initial production admin account securely: ask the installer for the admin email and a temporary password (or generate a random one and display it once). Never use a hardcoded default password in production. The admin must change it at first login.
8. Generate a random SESSION_SECRET if one does not already exist.
9. Never ship a hardcoded/default production SESSION_SECRET.
10. Configure required environment variables.
11. Verify that the application can start.

The client should be able to install/start the application with minimal technical knowledge. Document exactly what must be installed.

---

## 7. AUTO START

Provide a documented way to start the application automatically when Windows starts. Prefer a simple reliable approach (Startup folder, Task Scheduler, or a Windows service only if justified). Do not make it mandatory if it adds unnecessary complexity.

---

## 8. OFFLINE-FIRST ARCHITECTURE

The core application must work without internet: students, groups, attendance, payments, expenses, reports, schedules, exams, grades, receipts, certificates. Only optional integrations may need internet.

---

## 9. ROLES

Default roles: ADMIN, DIRECTEUR, SECRETARY, TEACHER. Implement RBAC.

- ADMIN: full access.
- DIRECTEUR: management and reporting access.
- SECRETARY: students, parents, registrations, attendance, payments, receipts, schedules.
- TEACHER: assigned groups, students, schedules, attendance, grades.

Do not rely only on frontend permissions. Every protected API/action must verify authorization on the backend.

---

## 10. MULTI-CENTER / WHITE LABEL ARCHITECTURE

The software must be reusable for other centers later. Do not hardcode center name, logo, phone, address or colors. Create configurable center settings. Prepare the data model for `centerId`, even if the first installation uses one center.

Goal: ONE SOFTWARE CORE + MULTIPLE CENTER CONFIGURATIONS.

---

## 11. LANGUAGES

Support French (default) and Arabic. Arabic must use real RTL layout: sidebar, forms, tables, dialogs, navigation, breadcrumbs, icons, alignment and PDFs all switch correctly. Use translation dictionaries. Do not fake localization.

Currency: MAD / DH. Date format: DD/MM/YYYY.

---

## 12. BRANDING

Admin can configure: center name, Arabic center name, logo, address, phone, email, Facebook, Instagram, WhatsApp, website, primary color, secondary color, receipt footer, certificate footer.

---

## 13. DASHBOARD

Real dashboard using database data only.

Cards: total students, active students, new registrations, teachers, groups, today's classes, today's attendance, absences, unpaid balances, today's revenue, monthly revenue, active training programs.

Charts: monthly revenue, registrations, attendance, students by level, students by subject, payment methods.

---

## 14. STUDENTS

Fields: ID, first name, last name, Arabic name, date of birth, gender, CIN, phone, WhatsApp, email, address, city, school, academic level, parent/guardian, parent phone, emergency contact, photo, notes, status, registration date, academic year.

Statuses: ACTIVE, INACTIVE, SUSPENDED, GRADUATED, LEFT.

Profile shows: information, parents, registrations, groups, subjects, attendance, payments, unpaid balance, exams, grades, certificates, documents, activity history.

Features: search, filters, pagination, import, export, print, student card.

---

## 15. EXCEL IMPORT

The center may already have student lists in Excel. Implement Excel import with column mapping (Nom, Prénom, Téléphone, Niveau, École, Parent, Téléphone parent), preview before import, row validation, and a report of imported / skipped / invalid / duplicates. Never silently import bad data. Provide an example Excel template.

---

## 16. PARENTS

Fields: name, phone, WhatsApp, email, address, relation. One parent may have multiple students.
Profile: children, registrations, attendance, payments, unpaid balances, notifications.

---

## 17. TEACHERS

Fields: name, Arabic name, phone, WhatsApp, email, CIN, specialization, subjects, availability, status, notes, photo.
Profile: groups, students, timetable, attendance sessions, grades, hours.

---

## 18. LEVELS

Configurable levels. Defaults:
- Primaire: 1ère à 6ème année
- Collège: 1ère, 2ème, 3ème année
- Lycée: Tronc Commun, 1ère Bac, 2ème Bac
- Université: configurable
- Préparation examens certificatifs

Admin can create/edit levels.

---

## 19. SUBJECTS AND LANGUAGES

Examples: Mathématiques, Physique, Chimie, Français, Arabe, Anglais, Allemand, Espagnol, Italien, Philosophie, SVT, Informatique. Fully configurable.
Fields: name, Arabic name, code, category, level, description, active.

---

## 20. SERVICES

Do NOT treat every center service as a school subject. Create separate services: Orientation scolaire, Encadrement, Accompagnement, Préparation examens, Préparation examens certificatifs.
Fields: name, description, price, duration, active status.

---

## 21. GROUPS

Groups are central. Example: 3ème Collège, Mathématiques, Groupe A.
Fields: name, level, subject/service, teacher, room, capacity, schedule, price, status, academic year.
Rules: no duplicate active enrollment, no capacity overflow, no teacher conflict, no room conflict.

---

## 22. REGISTRATIONS

A student can register for: one or multiple subjects, one or multiple groups, a language course, a training program, a service.
Fields: student, program/group/service, academic year, start date, end date, base price, discount, promotion, final price, payment plan, status (ACTIVE, PENDING, COMPLETED, CANCELLED).

---

## 23. PROMOTIONS / OFFERS

Examples: rentrée scolaire, early registration, family discount, multi-subject discount, seasonal offer.
Fields: name, code, type (FIXED or PERCENTAGE), value, start date, end date, eligibility rules, active.
Final price must be calculated correctly.

---

## 24. TRAINING

Categories: pédagogique, artistique, professionnelle, religieuse.
Fields: title, Arabic title, category, description, trainer, duration, start date, end date, capacity, price, room, schedule, status.
Participants: registration, payment, attendance, evaluation, certificate.

---

## 25. ROOMS

Fields: name, capacity, location, equipment, status. Prevent schedule conflicts. Show each room's current schedule.

---

## 26. TIMETABLE

Views: daily, weekly, monthly.
Fields: day, start time, end time, group, teacher, room, subject.
Prevent teacher, room and group conflicts. Printable timetable (PDF).

---

## 27. ATTENDANCE

Statuses: PRESENT, ABSENT, LATE, EXCUSED.
Track: student, group, session, date, status, note, recorded by.
Attendance belongs to a real scheduled/group session.
Statistics: attendance rate, absence rate, repeated absences.

---

## 28. PAYMENTS

Currency MAD/DH. Date DD/MM/YYYY.
Fields: student, registration, amount, date, payment method, reference, note, user.
Methods: CASH, BANK_TRANSFER, CHEQUE, CARD, OTHER.
Support: full payment, partial payment, advance, remaining balance, unpaid.
Example: Price 500 DH, Paid 300 DH, Remaining 200 DH.
All calculations must be server-side and consistent. A payment cannot exceed the allowed amount unless explicitly configured as advance/credit.

---

## 29. MONTHLY FEES

Support monthly subscriptions (September, October, November, ...). Each month shows PAID, PARTIAL, UNPAID or OVERDUE.

---

## 30. CASH REGISTER

Track: opening balance, revenue, refunds, expenses, closing balance.
Formula: Opening + Revenue - Refunds - Expenses = Closing.
All operations auditable.

---

## 31. EXPENSES

Fields: category (configurable), amount, date, description, payment method, reference, created by.

---

## 32. RECEIPTS

Include: logo, center name, address, phone, receipt number, date, student, reason, amount, payment method, paid, remaining, cashier, footer.
Formats: A4 PDF (preview, print, PDF). Optional: 80mm thermal receipt.
Receipt numbers must be unique.

---

## 33. EXAMS

Fields: title, subject, group, date, teacher, coefficient, max score.

---

## 34. GRADES

Fields: student, exam, score, max score, coefficient, comment.
Calculate: average, weighted average, subject average. Do not hardcode formulas unnecessarily.

---

## 35. REPORT CARDS

PDF with: student, level, group, subjects, grades, averages, attendance, teacher comments, center information.

---

## 36. CERTIFICATES

Types: Attestation de participation, Attestation de formation, Attestation de réussite.
Include: student, program, duration, date, certificate number (unique), trainer/director, logo, signature.
Arabic and French must render correctly.

---

## 37. DOCUMENTS

Attach documents to students, teachers, registrations, training participants (CIN, certificates, contracts, school documents).
Validate file size, extension and MIME type.

---

## 38. NOTIFICATIONS

Internal notification system. Types: payment reminder, absence, schedule change, registration, announcement.
Prepare optional integrations (WhatsApp, SMS, Email) with configuration placeholders and setup documentation. Never fake external sending.

---

## 39. REPORTS

Reports: students, attendance, payments, expenses, cash register, teachers, groups, training, exams, grades.
Export: PDF, CSV, Excel where appropriate.

---

## 40. AUDIT LOG

Track: login, logout, create, update, delete, payment, refund, permission changes, settings changes.
Store: user, action, entity, entity ID, timestamp, metadata.
Deleted financial records must never disappear without history.

---

## 41. AUTHENTICATION

Implement: login, logout, password hashing (bcrypt/argon2), change password, session management, session expiration, protected routes.

AUTHENTICATION SECURITY:
- Generate a cryptographically secure random SESSION_SECRET during installation when one does not already exist.
- Never ship a default production SESSION_SECRET.
- Never expose SESSION_SECRET or other secrets to the frontend.
- Force the administrator to change the initial password on first login.
- Passwords must never be stored in plaintext.

---

## 42. BACKUP (CRITICAL)

The application uses SQLite by default.

DO NOT perform a simple file copy of the SQLite database while the application may be writing to it. Use SQLite's safe backup mechanisms (SQLite .backup or VACUUM INTO), choosing the method appropriate for the implemented architecture.

Automatic local backups: default daily. Destination must be configurable (local folder, external USB, external disk). Example: D:\CentreImamMalik\Backups

The system must:
- create backups safely
- timestamp backups
- keep multiple versions
- allow manual backup
- document the restore process
- verify that each generated backup is valid
- verify that a backup can be opened/restored successfully

Never automatically delete the only valid backup. Implement a configurable retention policy. The backup process must not corrupt the active database. Document how to restore a backup safely.

---

## 43. SETTINGS

Center information, logo, language, academic year, users, roles, permissions, subjects, levels, rooms, payment methods, promotions, receipt settings, certificate settings, backup settings, notification settings.

Academic years (e.g. 2026/2027): create, activate, archive. Do not mix students and registrations from different academic years.

---

## 44. SEARCH / FILTERS

Global search across students, parents, teachers, groups, payments, receipts, training, certificates, using proper database queries.
Major tables support search, filtering, sorting, and server-side pagination.

---

## 45. DATABASE

Prisma, SQLite default, PostgreSQL compatibility prepared.

Entities: Center, User, Role, Permission, Student, Parent, StudentParent, Teacher, AcademicYear, AcademicLevel, Subject, Service, Group, GroupStudent, TrainingProgram, TrainingParticipant, Room, Schedule, Registration, Promotion, Attendance, AttendanceRecord, Payment, Invoice, InvoiceItem, Receipt, Expense, CashRegister, CashTransaction, Exam, Grade, Certificate, Document, Notification, AuditLog, Settings.

Use foreign keys, indexes, unique constraints, timestamps, appropriate cascading rules, soft deletion where appropriate.

---

## 46. DATABASE INTEGRITY

1. No duplicate active enrollment.
2. No group capacity overflow.
3. No teacher schedule conflict.
4. No room schedule conflict.
5. Payment calculations consistent.
6. Receipt numbers unique.
7. Certificate numbers unique.
8. Financial records auditable.
9. Unauthorized users cannot modify financial records.
10. Data must not disappear accidentally.

---

## 47. PRODUCTION DATA POLICY

Seed/demo data must ONLY be used in development/testing and must be clearly marked as demo.

A production installation must NOT contain fake students, teachers, payments or financial records. A fresh production installation contains only: required system configuration, default academic configuration (levels, subjects), required roles/permissions, and the initial administrator account.

Development seed data must be clearly separated from the production installation. Document development credentials for development only.

---

## 48. UI

Professional modern administration software. Desktop-first, responsive for laptop, tablet, mobile.
Layout: sidebar, topbar, breadcrumbs, dashboard cards, tables, forms, dialogs, notifications, confirmation dialogs for destructive actions.
Every page needs loading, empty and error states. Avoid excessive animations and gradients. Prioritize speed, readability, usability.

---

## 49. WINDOWS DELIVERY

Provide install.bat, start.bat, stop.bat, backup.bat. Document installation, startup, backup, restore, update. If appropriate, create a Windows launcher and a desktop shortcut. The final user should not need to understand programming.

---

## 50. LAN

Optional LAN mode. The main computer acts as local server; other PCs access `http://ADMIN-PC-IP:PORT`. Document IP configuration, firewall, port, startup. Do not expose the application publicly by default. Do not bind only to localhost when LAN mode is enabled.

---

## 51. SECURITY

Protect against SQL injection, XSS, CSRF where relevant, IDOR, privilege escalation, insecure uploads, unauthorized API access. Validate all inputs. Authorize all protected operations. Never trust client-side permissions. Do not expose secrets or stack traces to the frontend.

---

## 52. TESTING

Tests for: authentication, permissions, student creation, registration, payment calculation, discount calculation, remaining balance, attendance, grades, certificate generation, backup.
Critical workflows need integration/E2E tests where practical.

---

## 53. QUALITY RULE

After every phase run: typecheck, lint, tests, build. Fix all errors before continuing. Do not accumulate errors. Do not claim completion if build/tests fail. Actually run the commands; never say "it should work".

Avoid N+1 queries, loading entire tables in the browser, huge client bundles. Use pagination and database indexes.

---

## 54. DEVELOPMENT PHASES

VERY IMPORTANT: DO NOT BUILD EVERYTHING IN ONE STEP. Work in phases. After ONE phase: run checks, report exactly what was completed, report errors if any, STOP, and wait for the user to say CONTINUE.

### PHASE 1: Foundation
- inspect repository (create the project if empty)
- architecture, Prisma, SQLite
- database schema foundation, migrations, seed
- authentication, RBAC
- Vitest setup for unit/integration testing
- Playwright setup for E2E testing
- basic test configuration and test database strategy
- basic layout, FR/AR localization, RTL foundation
- center settings, basic dashboard shell

Run: typecheck, lint, unit/integration tests, Playwright smoke/E2E test, build. STOP.

### PHASE 2: Core people management
Students, parents, teachers, levels, subjects, languages, services, rooms. With search, filters, pagination, CRUD, validation. Run checks. STOP.

### PHASE 3: Academic management
Groups, registrations, group members, schedules, timetable, conflict detection. Run checks. STOP.

### PHASE 4: Attendance
Sessions, attendance, absence, late, excused, attendance reports. Run checks. STOP.

### PHASE 5: Finance
Registration pricing, promotions, discounts, payments, monthly fees, balances, receipts, expenses, cash register.

Monthly fee tracking screen ("Who paid this month?"):
- Choose a month (and academic year); list every actively enrolled student with the amount due, amount paid, remaining balance and status (PAID, PARTIAL, UNPAID, OVERDUE).
- Filter by status, group, level, subject, teacher; search by student or parent name/phone.
- Totals at the top: expected, collected, remaining, number of students per status.
- Quick action: record a payment directly from the row, and print/export the list (PDF/Excel), including a printable "unpaid students" list.
- Per student: month-by-month payment history for the whole academic year.
- Dashboard card "Unpaid this month" linking to this screen.
- Parent phone/WhatsApp shown on each row for reminders.
- Backend RBAC (SECRETARY and above; TEACHER has no access to finance). Server-side calculation only.

Run checks. STOP.

### PHASE 6: Training
Training programs, categories, participants, attendance, payments, evaluations, certificates. Run checks. STOP.

### PHASE 7: Academic evaluation
Exams, grades, averages, report cards, PDF generation. Run checks. STOP.

### PHASE 8: Documents
Document uploads, student documents, certificates, PDF templates, Arabic PDF, French PDF, A4 printing, optional 80mm receipt. Run checks. STOP.

### PHASE 9: Reports
Students, attendance, finance, teachers, training, exams, exports. Run checks. STOP.

### PHASE 10: Notifications
Internal notifications, payment reminders, absence alerts, schedule changes. Prepare WhatsApp/SMS/Email without fake integrations. Run checks. STOP.

### PHASE 11: Import / Export
Excel student import, CSV import/export, Excel export, validation, duplicate detection, templates. Run checks. STOP.

### PHASE 12: Backup / Windows delivery
Backup, restore documentation, install.bat, start.bat, stop.bat, backup.bat, Windows startup documentation, LAN documentation. Run checks. STOP.

### PHASE 13: Security and audit
Audit logs, permission review, security review, input validation, authorization review, file upload security. Run checks. STOP.

### PHASE 14: FINAL QA
Run typecheck, lint, unit tests, integration tests, E2E tests, production build, smoke tests.
Test: login, student creation, parent, teacher, group, registration, schedule, attendance, promotion, payment, receipt, expense, cash register, training, exam, grade, certificate, report, backup, restore.
Fix all discovered problems.

---

## 55. FINAL DOCUMENTATION

Create: README.md, INSTALLATION.md, USER_MANUAL.md, BACKUP.md, DEPLOYMENT.md, EXCEL_IMPORT.md, LAN_SETUP.md. Explain everything for a non-technical client.

---

## 56. EMPTY REPOSITORY RULE

If there is NO existing application: create it from scratch.
If there IS an existing application: inspect it first (framework, database, routes, components, migrations, tests, package.json, environment variables), reuse working parts, and do not destroy working functionality unnecessarily.

---

## 57. CODE QUALITY

Clean architecture, reusable components, typed APIs, reusable validation, consistent error handling, secure database access, maintainable code, no unnecessary duplication. Do not create giant files when logic can be modularized.

---

## 58. GIT CHECKPOINTS

The project must use Git. At the end of every successfully completed phase:
1. Run typecheck.
2. Run lint.
3. Run tests.
4. Run build.
5. Review changed files.
6. Create a Git commit.

Commit names: phase-01-foundation, phase-02-core-management, phase-03-academic-management, phase-04-attendance, phase-05-finance, phase-06-training, phase-07-evaluation, phase-08-documents, phase-09-reports, phase-10-notifications, phase-11-import-export, phase-12-backup-windows, phase-13-security, phase-14-final-qa.

Do not create a commit if the phase has failing tests or a failing production build. Never delete Git history.

---

## 59. IMPORTANT STOP RULE

NEVER continue automatically from one phase to another. Complete the current phase, run typecheck, lint, tests, build, then report:

PHASE X COMPLETE
- implemented features
- files/modules changed
- database changes
- tests
- build result
- known issues

Then STOP and wait for the user to say: CONTINUE

---

## 60. START NOW

First inspect the existing repository. If empty, initialize the project. Then execute PHASE 1 only. Do not implement PHASE 2 yet.

---
END MASTER PROMPT
