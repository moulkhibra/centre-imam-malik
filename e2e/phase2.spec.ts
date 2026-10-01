import { expect, test, type Locator, type Page } from '@playwright/test';
import { E2E_PHASE2_ADMIN } from '../playwright.config';

/**
 * Phase 2 end-to-end coverage.
 *
 * These tests drive a real production build: they fill the forms a secretary
 * fills, submit them, and read the resulting table back off the screen. That is
 * the only layer where a missing translation key, a wrong `name` attribute or an
 * RTL regression shows up - none of them are visible to the unit or integration
 * suites, all of which call the query and action layers directly.
 *
 * Data is created through the UI on purpose. Seeding the database directly and
 * then asserting the table would prove the query works, not that the form
 * produces a row the query can read.
 *
 * The suite runs serially (`workers: 1`), and each test creates its own records
 * with a unique suffix, so order does not matter and no test can see another's.
 *
 * A note on `getByLabel` and the required-field marker: `Label`
 * (`src/components/ui/index.tsx`) renders a required field as
 * `<label>Prénom<span aria-hidden="true">*</span></label>`. The `aria-hidden`
 * keeps the star out of the *accessible name*, so the input is announced as
 * "Prénom", but `getByLabel` matches the label's text content, which still
 * carries it. Anchored label regexes therefore allow one optional trailing
 * star (`/^prénom\s*\*?$/i`). The anchors stay: without them the pattern would
 * also match "Prénom (arabe)", which is a different field.
 */

/** FR and AR headings for the same screen. */
const SCREENS = [
  { path: '/students', fr: /Élèves/, ar: /التلاميذ/ },
  { path: '/parents', fr: /Parents/, ar: /الآباء/ },
  { path: '/teachers', fr: /Enseignants/, ar: /الأساتذة/ },
  { path: '/settings/academics', fr: /Structure pédagogique/, ar: /البنية التربوية/ },
  // These two pages take their heading from `nav.services` / `group.room`, not
  // from their own namespace - pinned here so a rename is caught.
  { path: '/settings/services', fr: /^Services?$/, ar: /^الخدمات$/ },
  { path: '/settings/rooms', fr: /^Salle$/, ar: /^القاعة$/ },
] as const;

function errorAlert(page: Page): Locator {
  return page.locator('main [role="alert"]');
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/adresse e-mail/i).fill(email);
  await page.getByLabel(/^mot de passe/i).fill(password);
  await page.getByRole('button', { name: /se connecter/i }).click();
}

/**
 * The Phase 2 administrator.
 *
 * Phase 2 needs write permission everywhere and only ADMIN holds
 * `academics.manage`, so the read-only staff account cannot drive these tests.
 * It is a dedicated account rather than the seeded one: the seeded admin must
 * change its password on first login, and that change is permanent, which would
 * leave every test after the first unable to sign in.
 */
async function signInAsAdmin(page: Page): Promise<void> {
  await signIn(page, E2E_PHASE2_ADMIN.email, E2E_PHASE2_ADMIN.password);
  await expect(page).toHaveURL(/\/dashboard/);
}

/** A per-test marker so records from different runs and tests stay distinct. */
function unique(): string {
  return `E2E${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

/**
 * A letters-only marker, for the fields validated as a person's name.
 *
 * `unique()` carries digits, and `LATIN_NAME` in `src/lib/validation/people.ts`
 * admits only letters, spaces and punctuation - so a first or last name built
 * from `unique()` is rejected by the very validation this suite is here to
 * exercise, and no row ever appears. Codes take `unique()` unchanged; the
 * Arabic names take it too, because `firstNameAr` is free text.
 */
function nameTag(): string {
  return unique().replace(/[^a-z]/gi, '');
}

async function search(page: Page, term: string): Promise<void> {
  await page.getByPlaceholder(/rechercher/i).fill(term);
  await page.getByRole('button', { name: /rechercher/i }).click();
}

test.describe('Phase 2 screens', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test('every Phase 2 screen loads, is linked from the sidebar, and exists', async ({ page }) => {
    for (const screen of SCREENS) {
      const response = await page.goto(screen.path);
      expect(response?.status(), `${screen.path} must exist`).toBeLessThan(400);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(screen.fr);
    }

    // And the sidebar actually offers them: a screen reachable only by typing
    // the URL is not shipped.
    await page.goto('/dashboard');
    const hrefs = await page.locator('aside nav a').evaluateAll((links) =>
      links.map((link) => link.getAttribute('href')),
    );
    for (const screen of SCREENS) {
      expect(hrefs, `${screen.path} must be in the sidebar`).toContain(screen.path);
    }
  });

  test('shows the empty state on a fresh install, not a broken table', async ({ page }) => {
    // Levels, subjects, services and rooms are empty on a new install; the page
    // must say so rather than rendering an empty <tbody>.
    await page.goto('/settings/rooms');
    await expect(page.getByText(/aucune salle|aucune donnée/i).first()).toBeVisible();
    await expect(page.locator('main table')).toHaveCount(0);
  });

  test('does not link to the deferred administration screens', async ({ page }) => {
    // /admin/users and /settings have no page yet; they must stay out of the
    // navigation rather than 404 on click.
    const hrefs = await page.locator('aside nav a').evaluateAll((links) =>
      links.map((link) => link.getAttribute('href')),
    );
    expect(hrefs).not.toContain('/admin/users');
    expect(hrefs).not.toContain('/settings');
  });
});

test.describe('student registration through the UI', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test('creates a student, sees them in the table, then soft-deletes them', async ({ page }) => {
    const tag = unique();
    const name = nameTag();
    const code = `ELE-${tag}`;

    await page.goto('/students');
    await page.getByRole('button', { name: /nouvel élève/i }).click();
    await page.getByLabel(/^code élève/i).fill(code);
    await page.getByLabel(/^prénom\s*\*?$/i).fill(`Amine${name}`);
    // Anchored, so it cannot land on "Téléphone (Contact d'urgence)".
    await page.getByLabel(/^téléphone\s*\*?$/i).fill('06 37 06 52 18');
    await page.getByLabel(/^nom\s*\*?$/i).fill(`El Amrani${name}`);
    await page.getByLabel(/cin/i).fill('AB123456');
    await page.getByRole('button', { name: /^(créer|enregistrer)/i }).click();

    // The dialog closes and the row is on screen: the round trip through the
    // action, the revalidation and the query all worked.
    const row = page.getByRole('row').filter({ hasText: code });
    await expect(row).toBeVisible();
    await expect(row).toContainText(`Amine${name}`);

    // Searching finds exactly that row, which also proves the term reaches the
    // query as a substring rather than being dropped by the form.
    await search(page, code);
    await expect(page.getByRole('row').filter({ hasText: code })).toHaveCount(1);

    // Deletion asks for the code back and refuses a wrong one.
    await row.getByRole('button', { name: /supprimer/i }).first().click();
    await page.getByLabel(/^code/i).last().fill('WRONG-CODE');
    await page.getByRole('button', { name: /confirmer/i }).click();
    await expect(errorAlert(page)).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: code })).toBeVisible();

    // The right code removes it from the list.
    await page.getByLabel(/^code/i).last().fill(code);
    await page.getByRole('button', { name: /confirmer/i }).click();
    await expect(page.getByText(/aucun élève ne correspond/i)).toBeVisible();
  });

  test('rejects an incomplete form without writing anything', async ({ page }) => {
    await page.goto('/students');
    await page.getByRole('button', { name: /nouvel élève/i }).click();
    await page.getByLabel(/^code élève/i).fill(`ELE-${unique()}`);
    // Names deliberately left blank.
    await page.getByRole('button', { name: /^(créer|enregistrer)/i }).click();

    await expect(errorAlert(page)).toBeVisible();
    // Still on the form: the dialog must not close over a rejected submission.
    await expect(page.getByLabel(/^prénom\s*\*?$/i)).toBeVisible();
  });

  test('keeps the form usable in Arabic and submits from RTL', async ({ page }) => {
    const tag = unique();
    const code = `ELE-${tag}`;

    await page.goto('/students');
    await page.getByRole('button', { name: /langue/i }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    // The Arabic dialog is reachable and its labels are Arabic, not keys.
    await page.getByRole('button', { name: 'تلميذ جديد' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('رمز التلميذ').fill(code);
    // Anchored, and tolerant of the required marker, like the French labels
    // above: `exact: true` against the bare word would miss "الاسم الشخصي*".
    await page.getByLabel(/^الاسم الشخصي\s*\*?$/).fill(`أمين${tag}`);
    await page.getByLabel('الاسم العائلي').fill(`الامراني${tag}`);
    await page.getByRole('button', { name: /^(إنشاء|حفظ)/ }).click();

    // The row appears, and the Arabic name is what the table shows.
    const row = page.getByRole('row').filter({ hasText: code });
    await expect(row).toBeVisible();
    await expect(row).toContainText('الامراني');
  });
});

test.describe('catalogue through the UI', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test('adds a level, then a subject, then finds both on their tabs', async ({ page }) => {
    const tag = unique();
    const levelCode = `NIV-${tag}`;

    await page.goto('/settings/academics');

    // Levels tab.
    await page.getByRole('button', { name: /nouveau niveau/i }).click();
    // Scoped to the dialog: the toolbar carries its own "Cycle" filter, so an
    // unscoped `getByLabel(/cycle/i)` matches the filter and the form at once.
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/^code/i).fill(levelCode);
    await dialog.getByLabel(/^cycle/i).selectOption('PRIMAIRE');
    await dialog.getByLabel(/nom \(français\)/i).fill(`Niveau ${tag}`);
    await page.getByRole('button', { name: /^(créer|enregistrer)/i }).click();
    await expect(page.getByRole('row').filter({ hasText: levelCode })).toBeVisible();

    // Subjects tab: the same screen, a different tab, so the level must not
    // have leaked into this list.
    await page.locator('main nav').getByRole('link', { name: 'Matières', exact: true }).click();
    const subjectCode = `MAT-${tag}`;
    await page.getByRole('button', { name: /nouvelle matière/i }).click();
    await page.getByRole('dialog').getByLabel(/^code/i).fill(subjectCode);
    await page.getByRole('dialog').getByLabel(/nom \(français\)/i).fill(`Matière ${tag}`);
    await page.getByRole('button', { name: /^(créer|enregistrer)/i }).click();
    await expect(page.getByRole('row').filter({ hasText: subjectCode })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: levelCode })).toHaveCount(0);

    // Back to the levels tab, the row is still there.
    await page.locator('main nav').getByRole('link', { name: 'Niveaux', exact: true }).click();
    await expect(page.getByRole('row').filter({ hasText: levelCode })).toBeVisible();
  });

  test('adds a service and a room, then deactivates the room', async ({ page }) => {
    const tag = unique();

    await page.goto('/settings/services');
    const serviceCode = `SRV-${tag}`;
    await page.getByRole('button', { name: /nouveau service/i }).click();
    await page.getByRole('dialog').getByLabel(/^code/i).fill(serviceCode);
    await page.getByRole('dialog').getByLabel(/nom \(français\)/i).fill(`Service ${tag}`);
    await page.getByRole('button', { name: /^(créer|enregistrer)/i }).click();
    await expect(page.getByRole('row').filter({ hasText: serviceCode })).toBeVisible();

    await page.goto('/settings/rooms');
    const roomName = `Salle ${tag}`;
    await page.getByRole('button', { name: /nouvelle salle/i }).click();
    await page.getByRole('dialog').getByLabel(/nom de la salle/i).fill(roomName);
    await page.getByRole('dialog').getByLabel(/capacité/i).fill('30');
    await page.getByRole('button', { name: /^(créer|enregistrer)/i }).click();
    const roomRow = page.getByRole('row').filter({ hasText: roomName });
    await expect(roomRow).toBeVisible();

    // Deactivating keeps the row on screen: the catalogue never hides a row the
    // secretary may still need to reactivate.
    await roomRow.getByRole('button', { name: /supprimer/i }).first().click();
    await page.getByRole('button', { name: /^(confirmer|supprimer)/i }).last().click();
    await expect(page.getByText(/désactiv/i).first()).toBeVisible();
  });

  test('filters the levels by cycle', async ({ page }) => {
    const tag = unique();
    await page.goto('/settings/academics');
    await page.getByRole('button', { name: /nouveau niveau/i }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/^code/i).fill(`NIV-${tag}`);
    await dialog.getByLabel(/^cycle/i).selectOption('LYCEE');
    await dialog.getByLabel(/nom \(français\)/i).fill(`Lycee ${tag}`);
    await page.getByRole('button', { name: /^(créer|enregistrer)/i }).click();

    const code = `NIV-${tag}`;
    await page.goto(`/settings/academics?stage=LYCEE`);
    await expect(page.getByRole('row').filter({ hasText: code })).toHaveCount(1);

    // A different cycle excludes it, which proves the filter reached the query.
    await page.goto(`/settings/academics?stage=PRIMAIRE`);
    await expect(page.getByRole('row').filter({ hasText: code })).toHaveCount(0);
  });
});

test.describe('list behaviour through the UI', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test('shows the empty search state and recovers from it', async ({ page }) => {
    await page.goto('/students');
    await search(page, `zzz${unique()}`);
    await expect(page.getByText(/aucun élève ne correspond/i)).toBeVisible();

    // Clearing the search brings the real list back; the URL alone cannot, since
    // it carries the term.
    await search(page, '');
    await expect(page.getByText(/aucun élève ne correspond/i)).toHaveCount(0);
  });

  test('sorts by a column header and keeps the sort through a search', async ({ page }) => {
    const tag = unique();
    // The names sort by letter, so they cannot carry `tag`'s digits: `LATIN_NAME`
    // would reject them and the rows would never be created. The shared suffix
    // keeps the three rows adjacent under the same search.
    const name = nameTag();
    for (const first of ['Zeta', 'Alpha', 'Mid'] as const) {
      await page.goto('/students');
      await page.getByRole('button', { name: /nouvel élève/i }).click();
      await page.getByLabel(/^code élève/i).fill(`ELE-${tag}-${first}`);
      await page.getByLabel(/^prénom\s*\*?$/i).fill(`${first}${name}`);
      await page.getByLabel(/^nom\s*\*?$/i).fill(`${first}${name}`);
      await page.getByRole('button', { name: /^(créer|enregistrer)/i }).click();
      await expect(page.getByRole('row').filter({ hasText: `ELE-${tag}-${first}` })).toBeVisible();
    }

    await page.goto(`/students?q=${tag}`);
    await page.getByRole('link', { name: /^nom/i }).click();
    await expect(page).toHaveURL(/dir=asc|dir=desc/);

    const firstName = await page.locator('tbody tr td').nth(1).innerText();
    expect(firstName).toContain('Alpha');
  });

  test('survives a hand-edited URL', async ({ page }) => {
    // A user bookmarking or a stale link must never produce a 500: the parser
    // falls back to the defaults.
    for (const query of ['?page=99999', '?pageSize=99999', '?sort=nonexistent', '?dir=sideways', '?q=%']) {
      const response = await page.goto(`/students${query}`);
      expect(response?.status(), `${query} must not error`).toBeLessThan(400);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
  });
});

test.describe('Phase 2 in Arabic RTL', () => {
  test('keeps every Phase 2 screen translated and right-to-left', async ({ page }) => {
    await signInAsAdmin(page);
    await page.getByRole('button', { name: /langue/i }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    for (const screen of SCREENS) {
      const response = await page.goto(screen.path);
      expect(response?.status(), `${screen.path} must exist in Arabic`).toBeLessThan(400);

      // No untranslated key may leak onto the screen: `t()` returns the path
      // itself when a key is missing, so a dotted path in the body is the
      // visible symptom of a missing translation.
      const body = (await page.locator('main').innerText()).trim();
      expect(body, `${screen.path} rendered no key`).not.toHaveLength(0);
      expect(body, `${screen.path} leaked a translation key`).not.toMatch(/\b[a-z]+\.[a-z]+\.[a-z]+\b/);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(screen.ar);
    }
  });

  test('mirrors the sidebar and the table in Arabic', async ({ page }) => {
    await signInAsAdmin(page);
    await page.getByRole('button', { name: /langue/i }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    // The sidebar sits on the right on a wide screen.
    await page.setViewportSize({ width: 1280, height: 800 });
    const box = await page.locator('aside').first().boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeGreaterThan(1280 / 2);

    // A data table mirrors its column order: the first column is the rightmost
    // one. The table's own box cannot prove this - it is `w-full`, so it starts
    // at the container's left edge in both directions. Only the cells mirror.
    await page.goto('/settings/academics');
    const headers = page.locator('main table thead th');
    if (await headers.count()) {
      const firstHeader = (await headers.first().boundingBox())!;
      const lastHeader = (await headers.last().boundingBox())!;
      expect(firstHeader.x, 'the first column must be the rightmost in RTL').toBeGreaterThan(lastHeader.x);
      // The header must align to the *logical* start, not a hardcoded left, so
      // the alignment follows the writing direction in both languages. Asserting
      // `start` rather than `right` is the stronger check: it also fails on a
      // `text-left` that would look correct in French.
      await expect(headers.first()).toHaveCSS('text-align', 'start');
    }
  });
});