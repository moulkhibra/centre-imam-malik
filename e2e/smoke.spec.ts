import { expect, test, type Page } from '@playwright/test';
import { E2E_ADMIN, E2E_LOCKOUT, E2E_STAFF } from '../playwright.config';

/**
 * Phase 1 end-to-end coverage: install, sign in, forced password change,
 * dashboard, localisation and sign out - the whole path an employee takes on
 * day one.
 *
 * Every test owns its account. Nothing here depends on the execution order or
 * on the state another test leaves behind.
 */

/**
 * The form-level error message.
 *
 * Scoped to `main`: Next.js renders a hidden live region outside the page for
 * route announcements, and it also carries `role="alert"`.
 */
function errorAlert(page: Page) {
  return page.locator('main [role="alert"]');
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/adresse e-mail/i).fill(email);
  await page.getByLabel(/^mot de passe/i).fill(password);
  await page.getByRole('button', { name: /se connecter/i }).click();
}

async function signInAsStaff(page: Page): Promise<void> {
  await signIn(page, E2E_STAFF.email, E2E_STAFF.password);
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe('authentication', () => {
  test('sends an anonymous visitor to the login page', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('shows the configured centre name, not a hardcoded one', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Centre Imam Malik de Soutien, Formation et Langues' })).toBeVisible();
  });

  test('rejects an unknown account', async ({ page }) => {
    await signIn(page, 'nobody@example.test', 'Wrong!Password123');
    await expect(errorAlert(page)).toContainText(/incorrect/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test('rejects a wrong password', async ({ page }) => {
    await signIn(page, E2E_STAFF.email, 'Wrong!Password123');
    await expect(errorAlert(page)).toContainText(/incorrect/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test('blocks SQL injection in the login form', async ({ page }) => {
    await signIn(page, "' OR '1'='1", 'anything1');
    await expect(errorAlert(page)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('locks an account after repeated failures', async ({ page }) => {
    // Five deliberate failures on an account no other test uses. The message
    // stays generic until the account is actually locked, so the lockout is
    // never announced in advance.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await signIn(page, E2E_LOCKOUT.email, 'Wrong!Password123');
      await expect(errorAlert(page)).toContainText(/incorrect/i);
    }

    // The next attempt reports the lockout...
    await signIn(page, E2E_LOCKOUT.email, 'Wrong!Password123');
    await expect(errorAlert(page)).toContainText(/verrouill/i);

    // ...and the correct password is refused too.
    await signIn(page, E2E_LOCKOUT.email, E2E_LOCKOUT.password);
    await expect(errorAlert(page)).toContainText(/verrouill/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test('signs in and forces the installer password to be changed', async ({ page }) => {
    await signIn(page, E2E_ADMIN.email, E2E_ADMIN.password);
    await expect(page).toHaveURL(/\/account\/password/);
    await expect(page.getByLabel(/mot de passe actuel/i)).toBeVisible();
  });

  test('completes the first-login password change and reaches the dashboard', async ({ page }) => {
    await signIn(page, E2E_ADMIN.email, E2E_ADMIN.password);
    await expect(page).toHaveURL(/\/account\/password/);

    await page.getByLabel(/mot de passe actuel/i).fill(E2E_ADMIN.password);
    await page.getByLabel(/nouveau mot de passe/i).fill(E2E_ADMIN.newPassword);
    await page.getByLabel(/confirmer le mot de passe/i).fill(E2E_ADMIN.newPassword);
    await page.getByRole('button', { name: /changer/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('refuses to reuse the current password', async ({ page }) => {
    // Uses the stable read-only account so the assertion does not depend on
    // which other tests already ran.
    await signInAsStaff(page);
    await page.goto('/account/password');

    await page.getByLabel(/mot de passe actuel/i).fill(E2E_STAFF.password);
    await page.getByLabel(/nouveau mot de passe/i).fill(E2E_STAFF.password);
    await page.getByLabel(/confirmer le mot de passe/i).fill(E2E_STAFF.password);
    await page.getByRole('button', { name: /changer/i }).click();

    await expect(page).toHaveURL(/\/account\/password/);
    await expect(errorAlert(page)).toBeVisible();
    // The account itself is untouched: "signs out and blocks the protected
    // page again" signs in with this same password after this test.
  });

  test('enforces the password policy', async ({ page }) => {
    await signInAsStaff(page);
    await page.goto('/account/password');

    await page.getByLabel(/mot de passe actuel/i).fill(E2E_STAFF.password);
    await page.getByLabel(/nouveau mot de passe/i).fill('weak');
    await page.getByLabel(/confirmer le mot de passe/i).fill('weak');
    await page.getByRole('button', { name: /changer/i }).click();

    await expect(errorAlert(page)).toBeVisible();
  });

  test('signs out and blocks the protected page again', async ({ page }) => {
    await signInAsStaff(page);

    await page.getByRole('button', { name: /déconnexion/i }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsStaff(page);
  });

  test('shows real zeroed counters on a fresh install', async ({ page }) => {
    // The empty-install notice replaces fabricated statistics.
    await expect(page.getByText(/aucun élève|aucune donnée|no student/i).first()).toBeVisible();
    await expect(page.locator('body')).toContainText('0,00 DH');
  });

  test('offers only navigation entries whose screens exist', async ({ page }) => {
    // The sidebar must never link to a 404: unfinished modules stay hidden.
    const links = page.locator('aside nav a');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      const href = (await links.nth(index).getAttribute('href')) ?? '/';
      const response = await page.request.get(new URL(href, page.url()).pathname);
      expect(response.status(), `${href} must not 404`).toBeLessThan(400);
    }
  });

  test('marks the active entry for assistive technology', async ({ page }) => {
    await expect(page.locator('aside nav a[aria-current="page"]')).toHaveText(/tableau de bord/i);
  });
});

test.describe('RTL layout', () => {
  const sidebar = (page: Page) => page.locator('aside');

  type SidebarBox = {
    left: number;
    right: number;
    width: number;
    translate: string;
    viewport: number;
  };

  /**
   * Geometry measured inside the page.
   *
   * Playwright's own `toBeVisible()` cannot be used for this drawer: it only
   * checks that an element has a non-empty box, and a drawer parked off-canvas
   * with `translate` still has one. So these tests measure the box and assert
   * where it actually is, which is the property the user reported.
   */
  async function sidebarBox(page: Page): Promise<SidebarBox> {
    // The shell renders client-side after the server navigation, so measure
    // only once the element is actually in the document.
    await sidebar(page).first().waitFor({ state: 'attached', timeout: 15_000 });
    return page.evaluate(() => {
      const aside = document.querySelector('aside');
      if (!aside) throw new Error('no <aside> rendered');
      const rect = aside.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width,
        translate: getComputedStyle(aside).translate,
        viewport: window.innerWidth,
      };
    });
  }

  /** Fully inside the viewport and actually drawn there. */
  function isOnScreen({ left, right, width, viewport }: SidebarBox): boolean {
    return width > 0 && left >= 0 && right <= viewport;
  }

  /** Parked entirely outside the viewport: closed on the start side. */
  function isOffScreen({ right, left, viewport }: SidebarBox): boolean {
    return right <= 0 || left >= viewport;
  }

  /** Hugs the right edge, i.e. pinned to the logical end of an RTL page. */
  function isPinnedToRight({ right, viewport }: SidebarBox): boolean {
    return Math.abs(right - viewport) <= 1;
  }

  /**
   * `translate` serialises as `none`, `0px` or `0px 0px` depending on the
   * browser, and all three mean "not translated".
   */
  function isNotTranslated(value: string): boolean {
    const trimmed = value.trim();
    return trimmed === 'none' || /^(-?0(px)?[ ,]*)+$/.test(trimmed);
  }

  /**
   * Waits for the sidebar to settle into `predicate`, then returns that box.
   * Polling matters because the drawer is animated: a single read can catch it
   * mid-slide and assert the wrong thing.
   */
  async function settledBox(
    page: Page,
    predicate: (box: SidebarBox) => boolean,
    description: string,
  ): Promise<SidebarBox> {
    let settled: SidebarBox | undefined;
    await expect
      .poll(
        async () => {
          settled = await sidebarBox(page);
          return predicate(settled);
        },
        { message: description, timeout: 10_000 },
      )
      .toBe(true);
    return settled!;
  }

  const expectRetreated = (page: Page, predicate: (box: SidebarBox) => boolean, description: string) =>
    settledBox(page, predicate, description);

  test('shows the sidebar on the left in French on a wide screen', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await signInAsStaff(page);

    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

    const box = await settledBox(page, isOnScreen, 'FR sidebar never settled on screen');
    expect(box.left).toBeLessThan(box.viewport / 2);
    expect(isNotTranslated(box.translate)).toBe(true);
  });

  test('shows the sidebar on the RIGHT in Arabic on a wide screen', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await signInAsStaff(page);

    await page.getByRole('button', { name: /langue/i }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    // The regression: `rtl:translate-x-full` used to beat `lg:translate-x-0`,
    // which parked the whole sidebar outside a 1280px viewport.
    const box = await settledBox(page, isOnScreen, 'AR sidebar never settled on screen');
    expect(isPinnedToRight(box)).toBe(true);
    expect(box.left).toBeGreaterThan(box.viewport / 2);
    expect(isNotTranslated(box.translate)).toBe(true);

    // And it actually carries navigation, translated into Arabic.
    const links = sidebar(page).locator('nav a');
    await expect(links.first()).toBeVisible();
    await expect(links.first()).toHaveText(/لوحة التحكم/);
  });

  test('keeps the navigation translated and reachable in Arabic', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await signInAsStaff(page);
    await page.getByRole('button', { name: /langue/i }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    // Chrome strings around the navigation must follow the language too.
    await expect(sidebar(page)).toHaveAttribute('aria-label', /التنقل الرئيسي/);
    await expect(page.locator('aside p').last()).toHaveText(/تدبير المركز/);

    // The first entry is the active route and is clickable.
    const first = sidebar(page).locator('nav a').first();
    await expect(first).toHaveAttribute('aria-current', 'page');
    await first.click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test.describe('mobile drawer', () => {
    const mobile = { width: 390, height: 780 };

    test('opens on the left in French', async ({ page }) => {
      await page.setViewportSize(mobile);
      await signInAsStaff(page);

      await expectRetreated(page, isOffScreen, 'drawer never reached its expected position');

      await page.getByRole('button', { name: /menu/i }).click();
      const opened = await settledBox(page, isOnScreen, 'FR drawer never opened');
      expect(opened.left).toBeLessThan(mobile.width / 2);
      await expect(sidebar(page).locator('nav a').first()).toBeVisible();

      // Escape has to dismiss it again, otherwise a keyboard user is stuck.
      await page.keyboard.press('Escape');
      await expectRetreated(page, isOffScreen, 'drawer never reached its expected position');
    });

    test('opens on the RIGHT in Arabic', async ({ page }) => {
      await page.setViewportSize(mobile);
      await signInAsStaff(page);

      await page.getByRole('button', { name: /langue/i }).click();
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expectRetreated(page, isOffScreen, 'drawer never reached its expected position');

      await page.getByRole('button', { name: /القائمة/i }).click();
      const opened = await settledBox(page, isOnScreen, 'AR drawer never opened');
      expect(isPinnedToRight(opened)).toBe(true);
      await expect(sidebar(page).locator('nav a').first()).toBeVisible();

      await page.keyboard.press('Escape');
      await expectRetreated(page, isOffScreen, 'drawer never reached its expected position');
    });

    test('retreats towards its own side, never the wrong one', async ({ page }) => {
      await page.setViewportSize(mobile);

      await signInAsStaff(page);
      const fr = await settledBox(page, isOffScreen, 'FR drawer never parked off-screen');
      expect(fr.right).toBeLessThanOrEqual(0); // parked past the left edge

      await page.getByRole('button', { name: /langue/i }).click();
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      const ar = await settledBox(page, isOffScreen, 'AR drawer never parked off-screen');
      expect(ar.left).toBeGreaterThanOrEqual(ar.viewport); // parked past the right edge
    });
  });
});

test.describe('localisation', () => {
  test('switches the whole interface to Arabic RTL and back', async ({ page }) => {
    await signInAsStaff(page);

    // The switcher announces itself as "Langue" (FR) / "اللغة" (AR) and shows
    // the language it switches *to*.
    await page.getByRole('button', { name: /langue/i }).click();
    const rtl = page.locator('html');
    await expect(rtl).toHaveAttribute('dir', 'rtl');
    await expect(rtl).toHaveAttribute('lang', 'ar');

    await page.getByRole('button', { name: /اللغة/i }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  });
});