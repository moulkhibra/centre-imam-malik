import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  E2E_BASE_URL,
  E2E_PHASE2_ADMIN,
  E2E_PHASE2B_DIRECTEUR,
  E2E_STAFF,
} from '../playwright.config';

/**
 * Phase 2B end-to-end coverage: accounts (`/admin/users`) and centre settings
 * (`/settings`).
 *
 * These are the first two screens of the application that are read *and* write
 * on the same form, so they carry two failure modes the unit and integration
 * suites cannot see:
 *
 *  - a value that validates but does not survive the round trip - the form
 *    reports a save, and the reload shows the old value. The settings tests
 *    therefore reload rather than trusting the confirmation.
 *  - a permission difference that only exists in the interface. `canManage` is
 *    computed on the server, so the read-only assertions are on the rendered
 *    controls (disabled inputs, no save button), not on a query.
 *
 * The colour test goes further and reads the `--brand-primary` custom property
 * off `<html>`: the centre's colour is written by the root layout, not by the
 * settings route, so a save that updates the row but not the layout is a real
 * defect and invisible everywhere else.
 *
 * Data is created through the UI, and each test owns its records through a
 * unique suffix, so the suite runs in any order.
 */

/**
 * A per-test marker, letters and digits only.
 *
 * Lowercase on purpose: `userCreateSchema` normalises the address, so a marker
 * carrying a capital would be stored folded and every `hasText` filter written
 * with the raw marker would miss the row it just created.
 */
function unique(): string {
  return `p2b${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

/**
 * A password that satisfies `passwordSchema`: eight characters, a letter and a
 * digit. The digits are in the middle so `unique()` can be embedded.
 */
function temporaryPassword(): string {
  return `Aa1${unique()}zZ9`;
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  // `/login` redirects an authenticated reader straight to the dashboard, so a
  // second sign-in inside an existing session would never show the form.
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByLabel(/adresse e-mail/i).fill(email);
  await page.getByLabel(/^mot de passe/i).fill(password);
  await page.getByRole('button', { name: /se connecter/i }).click();
  // Waits for the session to exist. Without it, a `goto` issued right after the
  // click interrupts the submission and the next page loads signed out.
  await page.waitForURL(/\/(dashboard|account\/password)/);
}

async function signInAsAdmin(page: Page): Promise<void> {
  await signIn(page, E2E_PHASE2_ADMIN.email, E2E_PHASE2_ADMIN.password);
  await expect(page).toHaveURL(/\/dashboard/);
}

/**
 * Saves the settings form and waits for the confirmation.
 *
 * The confirmation is a `role="status"` live region, not a navigation: the route
 * refreshes in place so the root layout picks up the new colour.
 */
async function save(page: Page): Promise<void> {
  await page.getByRole('button', { name: /enregistrer/i }).click();
  await expect(page.getByRole('status').filter({ hasText: /paramètres enregistrés/i })).toBeVisible();
}

/** The row of the accounts table holding one address. */
function rowFor(page: Page, email: string): Locator {
  return page.getByRole('row').filter({ hasText: email });
}

/**
 * Creates one account through the interface and returns its address.
 *
 * Every test that mutates accounts creates its own, so the suite never depends
 * on a row another test may have deactivated.
 */
async function createAccount(
  page: Page,
  { role = 'SECRETARY' }: { role?: string } = {},
): Promise<string> {
  const email = `p2b.${unique()}@example.test`;
  const password = temporaryPassword();

  await page.getByRole('button', { name: /nouvel utilisateur/i }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('#user-email').fill(email);
  await dialog.locator('#user-firstName').fill('Amine');
  await dialog.locator('#user-lastName').fill('Alaoui');
  await dialog.locator('#user-role').selectOption(role);
  await dialog.locator('#user-password').fill(password);
  await dialog.getByRole('button', { name: /^(créer|enregistrer)/i }).click();

  return email;
}

test.describe('accounts (/admin/users)', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto('/admin/users');
  });

  test('lists the accounts of the centre', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /utilisateurs/i })).toBeVisible();
    // The seeded administrator, so the query is reading accounts rather than an
    // empty table that would render the same shape.
    await expect(rowFor(page, E2E_PHASE2_ADMIN.email)).toBeVisible();

    // And the navigation now offers the screen, since it is no longer deferred.
    await expect(page.getByRole('link', { name: /utilisateurs/i }).first()).toBeVisible();
  });

  test('creates an account and shows it in the table', async ({ page }) => {
    const email = await createAccount(page);

    const row = rowFor(page, email);
    await expect(row).toBeVisible();
    await expect(row).toContainText(email);
    await expect(row).toContainText('Alaoui');

    // An account created with an administrator-chosen password says so, and has
    // never logged in: the two states that are only visible on the account list.
    await expect(row).toContainText(/mot de passe temporaire/i);
    await expect(row).toContainText(/jamais connecté/i);
  });

  test('reports the temporary password policy under the field, not in a banner', async ({ page }) => {
    await page.getByRole('button', { name: /nouvel utilisateur/i }).click();
    const dialog = page.getByRole('dialog');

    // The hint explains that the owner chooses their own password at first
    // login. It is the reason the field is required, so it has to be on screen.
    await expect(dialog.getByText(/choisir son propre mot de passe/i)).toBeVisible();

    await dialog.locator('#user-email').fill(`p2b.${unique()}@example.test`);
    await dialog.locator('#user-firstName').fill('Amine');
    await dialog.locator('#user-lastName').fill('Alaoui');
    await dialog.locator('#user-password').fill('Aa1zZ9');
    await dialog.getByRole('button', { name: /^(créer|enregistrer)/i }).click();

    // Six characters: one message, on the field that has to change.
    await expect(dialog.locator('#user-password ~ p.text-danger-600')).toHaveCount(1);
    await expect(dialog.locator('#user-password ~ p.text-danger-600')).toContainText(
      /au moins 8 caractères/i,
    );
  });

  test('refuses a second account on the same address', async ({ page }) => {
    const email = await createAccount(page);
    await expect(rowFor(page, email)).toBeVisible();

    await page.getByRole('button', { name: /nouvel utilisateur/i }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('#user-email').fill(email);
    await dialog.locator('#user-firstName').fill('Amine');
    await dialog.locator('#user-lastName').fill('Alaoui');
    await dialog.locator('#user-password').fill(temporaryPassword());
    await dialog.getByRole('button', { name: /^(créer|enregistrer)/i }).click();

    // The address is unique in the database, so this reaches the action and comes
    // back as `errors.duplicate` - the banner an Arabic reader used to get in
    // French.
    const banner = page.locator('main [role="alert"]').filter({ hasText: /\S/ });
    await expect(banner).toContainText(/existe déjà/i);
    // The dialog stays open with the address still filled in: a refusal must not
    // cost the secretary the whole form. React empties an uncontrolled form when
    // its action returns, so the form has to put the submission back itself.
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('#user-email')).toHaveValue(email);
    await expect(dialog.locator('#user-firstName')).toHaveValue('Amine');
  });

  test('search that matches nothing says so instead of listing everyone', async ({ page }) => {
    await page.locator('#list-search').fill(`zz-${unique()}`);
    await page.locator('#list-search').press('Enter');

    await expect(page.getByText(/aucun compte ne correspond/i)).toBeVisible();
    // And no row: the empty state must not sit above a full table.
    await expect(rowFor(page, E2E_PHASE2_ADMIN.email)).toHaveCount(0);
  });

  test('deactivation is reversible and never offered on the reader\'s own row', async ({ page }) => {
    const email = await createAccount(page);
    const row = rowFor(page, email);
    await expect(row).toBeVisible();

    // The reader's own row carries no deactivation button: the server refuses it,
    // so the toolbar does not offer it.
    const ownRow = rowFor(page, E2E_PHASE2_ADMIN.email);
    await expect(ownRow.getByRole('button', { name: /désactiver le compte/i })).toHaveCount(0);

    await row.getByRole('button', { name: /désactiver le compte/i }).click();
    const confirm = page.getByRole('dialog');
    await expect(confirm).toContainText(/désactiver ce compte/i);
    // The confirmation states what is kept, because nothing is deleted.
    await expect(confirm).toContainText(/conservés/i);
    await confirm.getByRole('button', { name: /confirmer/i }).click();

    await expect(page.getByRole('status').filter({ hasText: /compte désactivé/i })).toBeVisible();
    await expect(rowFor(page, email)).toContainText(/désactivé/i);

    // And back: the same control, renamed, and the account is usable again.
    await rowFor(page, email).getByRole('button', { name: /activer le compte/i }).click();
    const reactivate = page.getByRole('dialog');
    await expect(reactivate).toContainText(/activer ce compte/i);
    await reactivate.getByRole('button', { name: /confirmer/i }).click();

    await expect(page.getByRole('status').filter({ hasText: /compte réactivé/i })).toBeVisible();
    await expect(rowFor(page, email)).toContainText(/actif/i);
  });

  test('edits an account, and the change survives a reload', async ({ page }) => {
    const email = await createAccount(page);
    await expect(rowFor(page, email)).toBeVisible();

    await rowFor(page, email).getByRole('button', { name: /modifier le compte/i }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('#user-firstName').fill('Mohamed');
    await dialog.locator('#user-phone').fill('0612345678');
    await dialog.getByRole('button', { name: /^(créer|enregistrer)/i }).click();

    await expect(page.getByRole('status').filter({ hasText: /compte modifié/i })).toBeVisible();

    // A confirmation is not evidence: the row is read back off the screen after a
    // full reload, so nothing can pass on a flash message alone.
    await page.reload();
    const row = rowFor(page, email);
    await expect(row).toContainText('Mohamed');

    // The address has no column of its own, so it is read through the form: the
    // value the operator typed is the value the server stored.
    await row.getByRole('button', { name: /modifier le compte/i }).click();
    await expect(page.getByRole('dialog').locator('#user-phone')).toHaveValue('0612345678');
  });

  /**
   * The reader may correct their own details but not their own access level.
   *
   * The guard returns early when neither the role nor the activation changed,
   * which is what lets this first update through; the second one changes the
   * role and is refused. Both halves are asserted, because the first half is the
   * one that regressed when the guard rejected every self-update.
   */
  test("corrects its own details but cannot change its own role", async ({ page }) => {
    const phone = `06${Math.floor(10000000 + Math.random() * 89999999)}`;

    await rowFor(page, E2E_PHASE2_ADMIN.email)
      .getByRole('button', { name: /modifier le compte/i })
      .click();
    let dialog = page.getByRole('dialog');
    await dialog.locator('#user-phone').fill(phone);
    await dialog.getByRole('button', { name: /^(créer|enregistrer)/i }).click();
    await expect(page.getByRole('status').filter({ hasText: /compte modifié/i })).toBeVisible();

    await rowFor(page, E2E_PHASE2_ADMIN.email)
      .getByRole('button', { name: /modifier le compte/i })
      .click();
    dialog = page.getByRole('dialog');
    await dialog.locator('#user-role').selectOption('SECRETARY');
    await dialog.getByRole('button', { name: /^(créer|enregistrer)/i }).click();

    const banner = page.locator('main [role="alert"]').filter({ hasText: /\S/ });
    await expect(banner).toContainText(/votre propre rôle/i);

    // The role is still ADMIN: the refusal was the server's, not a UI fiction.
    await expect(rowFor(page, E2E_PHASE2_ADMIN.email)).toContainText(/administrateur/i);
  });

  test('resets a password, and refuses two different ones', async ({ page }) => {
    const email = await createAccount(page);
    await expect(rowFor(page, email)).toBeVisible();

    const openReset = () =>
      rowFor(page, email).getByRole('button', { name: /réinitialiser le mot de passe/i }).click();

    openReset();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(/sessions ouvertes seront fermées/i);

    const password = temporaryPassword();
    await dialog.locator('#user-reset-password').fill(password);
    await dialog.locator('#user-reset-password-confirm').fill(`${password}x`);
    await dialog.getByRole('button', { name: /^(réinitialiser|confirmer)/i }).click();

    // Reported on the confirmation, which is the field that has to change.
    await expect(
      dialog.locator('#user-reset-password-confirm ~ p.text-danger-600'),
    ).toHaveCount(1);

    // The password boxes come back empty on purpose - a refused password is not
    // echoed into the page - so the correction retypes both.
    await expect(dialog.locator('#user-reset-password')).toHaveValue('');
    await dialog.locator('#user-reset-password').fill(password);
    await dialog.locator('#user-reset-password-confirm').fill(password);
    await dialog.getByRole('button', { name: /^(réinitialiser|confirmer)/i }).click();
    await expect(page.getByRole('status').filter({ hasText: /mot de passe réinitialisé/i })).toBeVisible();
  });

  /**
   * A reset that leaves the old sessions alive protects nobody: whoever prompted
   * it keeps access, and the account owner cannot tell the reset happened.
   *
   * The second browser context is kept open across the reset on purpose. Signing
   * in again would prove nothing - it would mint a fresh session - so the
   * assertion is made with the cookie the reset was supposed to revoke.
   */
  test('a reset closes the sessions it revokes', async ({ page, context }) => {
    const email = `p2b.${unique()}@example.test`;
    const password = temporaryPassword();

    // Created as the administrator.
    await page.getByRole('button', { name: /nouvel utilisateur/i }).click();
    let dialog = page.getByRole('dialog');
    await dialog.locator('#user-email').fill(email);
    await dialog.locator('#user-firstName').fill('Amine');
    await dialog.locator('#user-lastName').fill('Alaoui');
    await dialog.locator('#user-password').fill(password);
    await dialog.getByRole('button', { name: /^(créer|enregistrer)/i }).click();
    await expect(rowFor(page, email)).toBeVisible();

    // A second context, signed in as that account. Its own first-login password
    // change is a side effect of signing in and not what is under test.
    const other = await context.browser()!.newContext();
    const otherPage = await other.newPage();
    await signIn(otherPage, email, password);
    await expect(otherPage).toHaveURL(/account\/password/);
    const revokedToken = (await other.cookies()).find((cookie) => cookie.name === 'cim_session');
    expect(revokedToken, 'no session cookie to revoke').toBeTruthy();

    // The administrator resets it.
    await rowFor(page, email)
      .getByRole('button', { name: /réinitialiser le mot de passe/i })
      .click();
    dialog = page.getByRole('dialog');
    const fresh = temporaryPassword();
    await dialog.locator('#user-reset-password').fill(fresh);
    await dialog.locator('#user-reset-password-confirm').fill(fresh);
    await dialog.getByRole('button', { name: /^(réinitialiser|confirmer)/i }).click();
    await expect(page.getByRole('status').filter({ hasText: /mot de passe réinitialisé/i })).toBeVisible();

    // The still-open session cookie no longer opens a page: `getCurrentUser`
    // returns null for a revoked session, so the shell redirects to the login
    // form instead of rendering the account screen.
    await otherPage.goto('/account/password');
    await expect(otherPage).toHaveURL(/\/login/);
    await other.close();
  });
});

test.describe('accounts in Arabic', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto('/admin/users');
    await page.getByRole('button', { name: /langue/i }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('answers a rejected account in Arabic, never in French', async ({ page }) => {
    await page.getByRole('button', { name: /مستخدم جديد/ }).click();
    const dialog = page.getByRole('dialog');

    // Located by id: an id is the same in both languages, and this test is about
    // the answers, not the labels.
    await dialog.locator('#user-email').fill('pas-une-adresse');
    await dialog.locator('#user-firstName').fill('Amine');
    await dialog.locator('#user-lastName').fill('Alaoui');
    await dialog.locator('#user-password').fill('Aa1zZ9');
    await dialog.getByRole('button', { name: /^(إنشاء|حفظ)/ }).click();

    const errors = dialog.locator('p.text-danger-600');
    await expect(errors.first()).toBeVisible();

    const texts = (await errors.allTextContents()).map((text) => text.trim());
    expect(texts.length).toBeGreaterThan(0);
    for (const text of texts) {
      expect(text, `not Arabic script: ${text}`).toMatch(/[\u0600-\u06FF]/);
      expect(text, `Latin text survived: ${text}`).not.toMatch(/[A-Za-z]/);
      expect(text).not.toMatch(/^validation\./);
    }
  });

  test('creates an account from the Arabic form', async ({ page }) => {
    const email = `p2b.ar.${unique()}@example.test`;

    await page.getByRole('button', { name: /مستخدم جديد/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/^البريد الإلكتروني/).fill(email);
    await dialog.getByLabel(/^الاسم الشخصي/).fill('أمين');
    await dialog.getByLabel(/^الاسم العائلي/).fill('العلوي');
    await dialog.locator('#user-password').fill(temporaryPassword());
    await dialog.getByRole('button', { name: /^(إنشاء|حفظ)/ }).click();

    await expect(rowFor(page, email)).toBeVisible();
    // The account carries no Arabic name fields - it has a locale, not a name -
    // so the row shows the Latin ones. What matters here is that the row the
    // Arabic form created is readable on the Arabic screen.
    await expect(rowFor(page, email)).toContainText(/كلمة مرور مؤقتة/);
  });

  test('the list toolbar is Arabic too, and says what its button does', async ({ page }) => {
    // The toolbar is shared with every other list screen, so a French string
    // left in it would show up in Arabic on the whole application.
    await expect(page.getByRole('searchbox', { name: /^بحث/ })).toBeVisible();
    await expect(page.getByPlaceholder(/^بحث/)).toBeVisible();

    const apply = page.getByRole('button', { name: /^تصفية$/ });
    await expect(apply).toBeVisible();
    // One word for the field, another for the button: the toolbar used to
    // repeat "Rechercher" on both, which in Arabic read as "بحث" twice.
    await expect(page.getByRole('button', { name: /^بحث/ })).toHaveCount(0);

    // And it still searches: the row content is what proves it.
    await page.locator('#list-search').fill(`zz-${unique()}`);
    await apply.click();
    await expect(page.getByText(/لا يوجد حساب مطابق/)).toBeVisible();
  });
});

test.describe('centre settings (/settings)', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto('/settings');
  });

  test('saves the centre name and keeps it after a reload', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /paramètres/i })).toBeVisible();

    // The suite is serial against one database and the login screen shows this
    // name, so the test puts back what it changed.
    const seeded = await page.locator('#center-nameFr').inputValue();

    const name = `Centre ${unique()}`;
    await page.locator('#center-nameFr').fill(name);
    await save(page);

    // Reloaded, because a confirmation only proves the action returned.
    await page.reload();
    await expect(page.locator('#center-nameFr')).toHaveValue(name);

    await page.locator('#center-nameFr').fill(seeded);
    await save(page);
    await page.reload();
    await expect(page.locator('#center-nameFr')).toHaveValue(seeded);
  });

  /**
   * The colour is read by the root layout, so a save that updates the row but
   * not `<html>` is a defect nothing else in the suite would catch.
   */
  test('the centre colour reaches the root layout', async ({ page }) => {
    const seeded = await page.locator('#center-primaryColor').inputValue();

    await page.locator('#center-primaryColor').fill('#7C3AED');
    await save(page);

    // `--brand-primary` is set on <html> by `src/app/layout.tsx`, so the whole
    // application repaints from the settings route.
    await expect(page.locator('html')).toHaveAttribute('style', /--brand-primary:\s*#7c3aed/i);

    // Restored, so the colour a later test finds is the one the installer set.
    await page.locator('#center-primaryColor').fill(seeded);
    await save(page);
    await expect(page.locator('html')).toHaveAttribute('style', new RegExp(`--brand-primary:\\s*${seeded}`, 'i'));
  });

  test('reports a logo outside public/ on the field', async ({ page }) => {
    const seededName = await page.locator('#center-nameFr').inputValue();

    await page.locator('#center-logoPath').fill('../secrets/id_rsa.png');
    await page.getByRole('button', { name: /enregistrer/i }).click();
    await expect(page.getByRole('status')).toHaveCount(0);

    // The field is marked invalid for a screen reader, not only tinted red, and
    // the message says what a valid value looks like.
    await expect(page.locator('#center-logoPath')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText(/chemin de logo invalide/i)).toBeVisible();

    // The rest of the form was not saved: one transaction, nothing half-written.
    await expect(page.getByRole('status').filter({ hasText: /paramètres enregistrés/i })).toHaveCount(0);

    // And what was typed is still there to be corrected, on the twenty fields
    // that were fine.
    await expect(page.locator('#center-nameFr')).toHaveValue(seededName);
  });

  test('an optional field left empty is stored as empty, not as a broken value', async ({ page }) => {
    // Fills a value, saves, empties it, saves again: the value the operator
    // removed has to be gone rather than kept.
    await page.locator('#center-website').fill('https://example.test');
    await save(page);

    await page.locator('#center-website').fill('');
    await save(page);

    await page.reload();
    await expect(page.locator('#center-website')).toHaveValue('');
  });

  test('a role without settings.manage sees the screen read-only', async ({ page }) => {
    await signIn(page, E2E_PHASE2B_DIRECTEUR.email, E2E_PHASE2B_DIRECTEUR.password);
    await page.goto('/settings');

    // The reason is on screen, not just implied by grey inputs.
    await expect(page.getByText(/consultation seule/i)).toBeVisible();

    // Every control is disabled, and there is no way to submit.
    await expect(page.locator('#center-nameFr')).toBeDisabled();
    await expect(page.locator('#center-primaryColor')).toBeDisabled();
    await expect(page.getByRole('button', { name: /enregistrer/i })).toHaveCount(0);
  });

  test('a role without users.manage sees the accounts read-only', async ({ page }) => {
    await signIn(page, E2E_PHASE2B_DIRECTEUR.email, E2E_PHASE2B_DIRECTEUR.password);
    await page.goto('/admin/users');

    // DIRECTEUR holds `users.view` and not `users.manage`: the screen renders, and
    // nothing on it can be pressed. The editor checks `canManage` once, so both
    // the create button and the per-row actions disappear together.
    await expect(page.getByRole('heading', { name: /utilisateurs/i })).toBeVisible();
    await expect(rowFor(page, E2E_PHASE2_ADMIN.email)).toBeVisible();
    await expect(page.getByRole('button', { name: /nouvel utilisateur/i })).toHaveCount(0);
    await expect(rowFor(page, E2E_PHASE2_ADMIN.email).getByRole('button')).toHaveCount(0);
  });

  test('answers a rejected value in Arabic, never in French', async ({ page }) => {
    await page.getByRole('button', { name: /langue/i }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    await page.locator('#center-logoPath').fill('logo.png');
    await page.getByRole('button', { name: /حفظ/ }).click();

    // The message quotes the path it wants (`/logo.png`), so it is not free of
    // Latin - what must not appear is the French sentence it replaced.
    const errors = page.locator('main p.text-danger-600');
    await expect(errors.first()).toBeVisible();
    const texts = (await errors.allTextContents()).map((text) => text.trim());
    expect(texts.length).toBeGreaterThan(0);
    for (const text of texts) {
      expect(text, `no Arabic script: ${text}`).toMatch(/[\u0600-\u06FF]/);
      expect(text, `French sentence survived: ${text}`).not.toMatch(
        /chemin| invalide|fichier image|par exemple/i,
      );
      expect(text).not.toMatch(/^validation\./);
    }
  });
});

/**
 * A role that holds neither permission must not see the screens at all.
 *
 * SECRETARY has neither `users.view` nor `settings.view`, so both routes answer
 * the forbidden state instead of rendering an empty table. The navigation hides
 * the links, but the URL is what anyone can type.
 */
test.describe('accounts without the permission', () => {
  test('a secretary is refused on both routes', async ({ page }) => {
    await signIn(page, E2E_STAFF.email, E2E_STAFF.password);
    await expect(page).toHaveURL(/\/dashboard/);

    for (const route of ['/admin/users', '/settings']) {
      await page.goto(route);
      await expect(page.getByText(/accès refusé/i)).toBeVisible();
    }

    // And the links are absent, so the refusal is not a dead end the operator
    // keeps rediscovering.
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: /utilisateurs/i })).toHaveCount(0);
  });

  test('the login page is Arabic for an Arabic reader', async ({ page }) => {
    // Pinned here because the two screens above set the cookie and the switcher
    // is only on signed-in pages.
    await page.context().addCookies([{ name: 'cim_locale', value: 'ar', url: E2E_BASE_URL }]);
    await page.goto('/login');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('button', { name: 'دخول' })).toBeVisible();
  });
});