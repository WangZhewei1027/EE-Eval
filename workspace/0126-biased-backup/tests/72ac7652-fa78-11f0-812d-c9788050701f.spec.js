import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ac7652-fa78-11f0-812d-c9788050701f.html';

// Page Object for the Cosmic Routing app
class CosmicRoutingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.locators = {
      particles: page.locator('#particles'),
      container: page.locator('.container'),
      animateBtn: page.locator('#animateBtn'),
      resetBtn: page.locator('#resetBtn'),
      navLinks: page.locator('.nav-link'),
      routeCenter: page.locator('#route-center'),
      routeAbout: page.locator('#route-about'),
      routeServices: page.locator('#route-services'),
      routeContact: page.locator('#route-contact'),
      routeDashboard: page.locator('#route-dashboard'),
      lines: [
        page.locator('#line1'),
        page.locator('#line2'),
        page.locator('#line3'),
        page.locator('#line4'),
      ],
      allRoutes: page.locator('.route'),
      allLines: page.locator('.connection-line'),
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async clickAnimate() {
    await this.locators.animateBtn.click();
  }

  async clickReset() {
    await this.locators.resetBtn.click();
  }

  // Click a nav link by its data-route attribute, e.g., 'about', 'services', 'contact', 'home', 'dashboard'
  async clickNavRoute(routeName) {
    // find the nav link with matching data-route
    const link = this.page.locator(`.nav-link[data-route="${routeName}"]`);
    await link.click();
  }

  // Helpers to check active classes with polling
  async waitForRouteActive(routeLocator, timeout = 3000) {
    await this.page.waitForFunction(
      (el) => el && el.classList && el.classList.contains('active'),
      routeLocator,
      { timeout }
    );
  }

  async waitForRouteInactive(routeLocator, timeout = 2000) {
    await this.page.waitForFunction(
      (el) => el && el.classList && !el.classList.contains('active'),
      routeLocator,
      { timeout }
    );
  }

  async isRouteActive(routeLocator) {
    return await routeLocator.evaluate((el) => el.classList.contains('active'));
  }

  async isLineActive(lineLocator) {
    return await lineLocator.evaluate((el) => el.classList.contains('active'));
  }

  async lineStyleWidth(lineLocator) {
    return await lineLocator.evaluate((el) => el.style.width);
  }

  async activeRoutesCount() {
    return await this.locators.allRoutes.evaluate((els) => {
      return Array.from(els).filter((el) => el.classList.contains('active')).length;
    });
  }

  async activeLinesCount() {
    return await this.locators.allLines.evaluate((els) => {
      return Array.from(els).filter((el) => el.classList.contains('active')).length;
    });
  }
}

// Tests
test.describe('Cosmic Routing - FSM test suite (72ac7652-fa78-11f0-812d-c9788050701f)', () => {
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for assertions later
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // capture runtime errors thrown in the page context
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test.describe('Initialization & Idle State (S0_Idle)', () => {
    test('renders initial elements and starts in Idle (no active routes immediately)', async ({ page }) => {
      const app = new CosmicRoutingPage(page);
      // Load the page and validate DOM elements required by S0_Idle evidence
      await app.goto();

      // Verify particles and container exist
      await expect(app.locators.particles).toBeVisible();
      await expect(app.locators.container).toBeVisible();

      // Immediately after DOMContentLoaded and before the auto animation (which runs at ~1s),
      // ensure routes are not active (Idle state expectation)
      // We check central route should NOT have .active initially (we check quickly to avoid waiting for auto animation)
      const centerActive = await app.isRouteActive(app.locators.routeCenter);
      expect(centerActive).toBe(false);

      // Ensure no uncaught runtime errors happened during load so far
      expect(pageErrors.length).toBe(0);

      // Record that console had some messages (fonts/loading etc) but we don't require any specific message
      expect(Array.isArray(consoleMessages)).toBe(true);
    });

    test('initial automatic animation triggers (onEnter animateRoutes via setTimeout)', async ({ page }) => {
      const app = new CosmicRoutingPage(page);
      await app.goto();

      // The page schedules an automatic animateRoutes() call after ~1000ms.
      // Wait long enough to let the animation timeouts run and observe central route activation.
      await page.waitForTimeout(1400);

      // Central route should become active as part of the automatic animation
      await expect(app.locators.routeCenter).toHaveClass(/active/, { timeout: 1000 });

      // Eventually (for global animation) multiple routes and lines should become active.
      // Because the automatic call uses animateRoutes() (no routeName), expect multiple routes to be active soon.
      await page.waitForTimeout(700); // allow the rest of the staggered activation
      const activeRoutes = await app.activeRoutesCount();
      const activeLines = await app.activeLinesCount();

      // After the full automatic animation we expect at least center + others (thus more than or equal to 1)
      expect(activeRoutes).toBeGreaterThanOrEqual(1);
      // lines may take additional time; ensure at least some lines have widths set (positioning applied)
      const lineWidth = await app.lineStyleWidth(app.locators.lines[0]);
      expect(lineWidth).toBeTruthy();

      // Ensure no uncaught errors were thrown during automatic animation
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Animating Routes (S1_Animating) & Global Animate Button (ANIMATE_BUTTON_CLICK)', () => {
    test('clicking the Animate Routes button activates central route then all routes and lines', async ({ page }) => {
      const app = new CosmicRoutingPage(page);
      await app.goto();

      // Click the animate button to trigger animateRoutes()
      await app.clickAnimate();

      // Central route should be activated first (200ms in animateRoutes)
      await app.waitForRouteActive(app.locators.routeCenter, 800);
      expect(await app.isRouteActive(app.locators.routeCenter)).toBe(true);

      // After the full animateRoutes call (400ms then adding all routes + 500ms for lines), expect all routes and lines active
      await page.waitForTimeout(1000);
      const activeRoutes = await app.activeRoutesCount();
      const activeLines = await app.activeLinesCount();

      // All 5 route elements should be active for the global animation
      expect(activeRoutes).toBeGreaterThanOrEqual(5);

      // All 4 connection lines should become active (opacity toggles after delays)
      expect(activeLines).toBeGreaterThanOrEqual(4);

      // No uncaught runtime errors occurred
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Route-specific Animations (S2..S5 via NAV_LINK_CLICK)', () => {
    // Helper to test a route-specific nav click sequence
    async function testRouteNavigation(page, routeName, routeLocator, expectedLineLocatorIndex) {
      const app = new CosmicRoutingPage(page);
      await app.goto();

      // Ensure initial state is not active to start fresh (avoid interference with automatic animation)
      // Wait a tiny bit to avoid racing with the page's initial animation; the app auto-animates after ~1s
      await page.waitForTimeout(100);

      // Click Animate first to mimic entering S1_Animating (the FSM describes nav clicks from Animating state)
      await app.clickAnimate();
      await app.waitForRouteActive(app.locators.routeCenter, 1000);

      // Now click the nav link for the specific route
      await app.clickNavRoute(routeName);

      // route-specific animateRoutes(routeName) activates the central route quickly and the specific route after 400ms,
      // the corresponding line is activated after an additional 800ms within that branch.
      await app.waitForRouteActive(routeLocator, 1200);

      expect(await app.isRouteActive(routeLocator)).toBe(true);

      // Wait for the corresponding connection line to be activated
      const expectedLineLocator = app.locators.lines[expectedLineLocatorIndex];
      await page.waitForTimeout(900); // allow inner timeouts to run
      await app.page.waitForFunction(
        (el) => el && el.classList && el.classList.contains('active'),
        expectedLineLocator,
        { timeout: 1500 }
      );

      expect(await app.isLineActive(expectedLineLocator)).toBe(true);

      // Ensure no uncaught runtime errors for valid routes
      expect(pageErrors.length).toBe(0);
    }

    test('About route (S2_Route_About) activates route-about and line1 after clicking About nav link', async ({ page }) => {
      await testRouteNavigation(page, 'about', new CosmicRoutingPage(page).locators.routeAbout, 0);
    });

    test('Services route (S3_Route_Services) activates route-services and line2 after clicking Services nav link', async ({ page }) => {
      await testRouteNavigation(page, 'services', new CosmicRoutingPage(page).locators.routeServices, 1);
    });

    test('Contact route (S4_Route_Contact) activates route-contact and line3 after clicking Contact nav link', async ({ page }) => {
      await testRouteNavigation(page, 'contact', new CosmicRoutingPage(page).locators.routeContact, 2);
    });

    test('Dashboard route (S5_Route_Dashboard) activates route-dashboard and line4 after clicking Dashboard nav link', async ({ page }) => {
      await testRouteNavigation(page, 'dashboard', new CosmicRoutingPage(page).locators.routeDashboard, 3);
    });
  });

  test.describe('Reset behavior (RESET_BUTTON_CLICK) and onExit actions', () => {
    test('clicking Reset removes all active classes from routes and lines (S1_Animating -> S0_Idle)', async ({ page }) => {
      const app = new CosmicRoutingPage(page);
      await app.goto();

      // Trigger global animation first to ensure classes are added
      await app.clickAnimate();
      await app.waitForRouteActive(app.locators.routeCenter, 1000);
      await page.waitForTimeout(800); // allow other routes/lines to become active

      // Sanity: ensure there is at least one active route and potentially lines
      const beforeActiveRoutes = await app.activeRoutesCount();
      expect(beforeActiveRoutes).toBeGreaterThanOrEqual(1);

      // Click reset
      await app.clickReset();

      // Reset handler removes classes synchronously; check that routes and lines no longer have 'active'
      // Use small timeout to allow DOM changes to settle
      await page.waitForTimeout(100);
      const afterActiveRoutes = await app.activeRoutesCount();
      const afterActiveLines = await app.activeLinesCount();

      expect(afterActiveRoutes).toBe(0);
      expect(afterActiveLines).toBe(0);

      // No runtime errors should be thrown by reset handler (it only manipulates classList)
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases & error scenarios', () => {
    test('clicking Home nav link (data-route="home") triggers a runtime TypeError because route-home does not exist', async ({ page }) => {
      const app = new CosmicRoutingPage(page);
      await app.goto();

      // Clear any page errors recorded during load
      pageErrors = [];

      // Click Animate to be consistent with FSM where nav clicks happen from Animating state
      await app.clickAnimate();
      await app.waitForRouteActive(app.locators.routeCenter, 1000);

      // Click the Home nav link; the implementation attempts document.getElementById("route-home")
      // which does not exist -> subsequent .classList.add will throw a TypeError in page context.
      // We assert that a pageerror occurs and it is a TypeError.
      // Set up a promise that resolves when a pageerror is observed
      let observedError = null;
      const errorPromise = new Promise((resolve) => {
        page.on('pageerror', (err) => {
          observedError = err;
          resolve(err);
        });
      });

      await app.clickNavRoute('home');

      // Wait for the pageerror to be emitted (give reasonable timeout)
      await Promise.race([
        errorPromise,
        new Promise((r) => setTimeout(r, 2000)),
      ]);

      // We expect at least one page error and that it is a TypeError related to accessing classList of null
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
      const lastError = pageErrors[pageErrors.length - 1];

      // Validate error name (TypeError) and message contains hints about null/classList (message may vary by engine)
      expect(lastError.name).toBe('TypeError');
      expect(String(lastError.message).toLowerCase()).toContain('null');
    });

    test('connection lines positioning applied on initialization (setLinePosition runs without throwing)', async ({ page }) => {
      const app = new CosmicRoutingPage(page);
      await app.goto();

      // The script schedules an updateConnectionLines run after ~100ms.
      // Wait and then assert that at least one line has a non-empty width style.
      await page.waitForTimeout(250);
      const width0 = await app.lineStyleWidth(app.locators.lines[0]);
      const width1 = await app.lineStyleWidth(app.locators.lines[1]);
      // At least one line should have a computed width value applied via setLinePosition
      const hasWidth = (w) => typeof w === 'string' && w !== '' && w !== '0px';
      expect(hasWidth(width0) || hasWidth(width1)).toBeTruthy();

      // No runtime errors should be present from the positioning function
      expect(pageErrors.length).toBe(0);
    });
  });

  test.afterEach(async ({ page }) => {
    // As a final sanity check in each test, log counts (helps debugging if failures happen)
    // Do not mutate page; only observe
    // Ensure no unexpected global uncaught errors besides those we explicitly asserted in relevant tests
    // (We allow pageErrors in tests that expect them, otherwise tests already assert pageErrors length)
  });
});