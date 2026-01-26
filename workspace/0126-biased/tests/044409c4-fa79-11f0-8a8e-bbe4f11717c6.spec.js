import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/044409c4-fa79-11f0-8a8e-bbe4f11717c6.html';

/**
 * Page Object for the HTTPS Demo page.
 * Encapsulates selectors and actions to keep tests readable and maintainable.
 */
class HttpsDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.container = page.locator('.container');
    this.header = page.locator('.header');
    this.logoImg = page.locator('.logo img');
    this.mainContent = page.locator('.main-content');
    this.footer = page.locator('.footer');
    this.socialLinks = page.locator('.social-link');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickLogo() {
    await this.logoImg.click();
  }

  async clickSocialLinkAt(index) {
    await this.socialLinks.nth(index).click();
  }

  async socialLinksCount() {
    return this.socialLinks.count();
  }

  async logoSrc() {
    return this.logoImg.getAttribute('src');
  }

  async logoAlt() {
    return this.logoImg.getAttribute('alt');
  }
}

test.describe('HTTPS Demo (FSM validation) - Application ID 044409c4-fa79-11f0-8a8e-bbe4f11717c6', () => {
  // Arrays to capture console messages and page errors for each test run.
  let consoleMessages = [];
  let pageErrors = [];

  // Setup before each test: navigate to the page and attach listeners to record console and errors.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture all console events emitted by the page
    page.on('console', (msg) => {
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
        });
      } catch (e) {
        // If any unexpected issues reading the console message occur, store raw info
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture page errors (unhandled exceptions in the page)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app under test
    await page.goto(APP_URL);
  });

  // Teardown after each test: no special teardown needed because the Playwright test runner handles pages.
  test.afterEach(async ({ page }) => {
    // Intentionally left blank; listeners are tied to the page fixture and will be cleaned up by Playwright.
  });

  test.describe('State: S0_Idle (Initial rendering)', () => {
    test('renders container, header and main content and exposes expected DOM structure (Idle state)', async ({ page }) => {
      // This test validates the Idle state: page should render key sections as per FSM evidence.
      const demo = new HttpsDemoPage(page);

      // Ensure the main structural elements are visible
      await expect(demo.container).toBeVisible();
      await expect(demo.header).toBeVisible();
      await expect(demo.mainContent).toBeVisible();

      // The FSM entry action mentions renderPage(). Verify that renderPage is not defined on window.
      // We must not inject or define anything; simply observe the environment.
      const renderPageType = await page.evaluate(() => typeof window.renderPage);
      // If renderPage is not implemented in the HTML, it should be "undefined".
      expect(renderPageType).toBe('undefined');

      // Verify that no unexpected page errors occurred on initial load
      expect(pageErrors.length).toBe(0);

      // No console messages should be emitted on load by the provided implementation aside from possibly harmless browser logs.
      // We make a relaxed assertion: ensure there is not an obvious "Logo clicked!" or error logged at load.
      const hasLogoClickedAtLoad = consoleMessages.some(m => m.text === 'Logo clicked!');
      expect(hasLogoClickedAtLoad).toBe(false);
    });
  });

  test.describe('Event: LogoClick -> Transition to S1_LogoClicked', () => {
    test('clicking the logo emits console.log("Logo clicked!") and does not throw page errors', async ({ page }) => {
      // This test validates the transition from Idle to LogoClicked by clicking the logo and observing the console message.
      const demo = new HttpsDemoPage(page);

      // Sanity: logo should be visible and have expected attributes
      await expect(demo.logoImg).toBeVisible();
      const src = await demo.logoSrc();
      const alt = await demo.logoAlt();
      expect(src).toContain('example.com/logo.png');
      expect(alt).toBe('Logo');

      // Capture the console event that should be produced by the click.
      // We use Promise.all to ensure we wait for the console message triggered by the click.
      const [consoleEvent] = await Promise.all([
        page.waitForEvent('console'),
        demo.clickLogo()
      ]);
      // The page's script does console.log("Logo clicked!"); so we expect that exact text.
      expect(consoleEvent.text()).toBe('Logo clicked!');

      // Confirm that the page did not produce any uncaught exceptions as a result of the click.
      expect(pageErrors.length).toBe(0);

      // Ensure the URL did not change (clicking the logo should not navigate)
      expect(page.url()).toBe(APP_URL);
    });

    test('multiple logo clicks produce multiple console logs (idempotent transition observation)', async ({ page }) => {
      // Validate repeated interaction: each click should produce a console.log.
      const demo = new HttpsDemoPage(page);

      // Number of repeated clicks to test
      const clicks = 3;
      const captured = [];

      for (let i = 0; i < clicks; i++) {
        const [consoleEvent] = await Promise.all([
          page.waitForEvent('console'),
          demo.clickLogo()
        ]);
        captured.push(consoleEvent.text());
      }

      // All captured console messages should equal the expected text
      expect(captured.length).toBe(clicks);
      for (const text of captured) {
        expect(text).toBe('Logo clicked!');
      }

      // No page errors should have been introduced by repeated clicks
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Components and edge cases', () => {
    test('social links exist and clicking them does not trigger logo click console message or page errors', async ({ page }) => {
      // FSM lists social-link components but no handlers. This test ensures they exist and are safe to interact with.
      const demo = new HttpsDemoPage(page);

      const count = await demo.socialLinksCount();
      expect(count).toBeGreaterThanOrEqual(3); // Facebook, Twitter, Instagram per FSM

      // Clear any console messages captured during navigation to isolate this test's events.
      // Since we can't remove the listener, we'll snapshot current messages and filter them out later.
      const initialConsoleSnapshot = consoleMessages.slice();

      // Click each social link and ensure no "Logo clicked!" messages are emitted as a result.
      for (let i = 0; i < Math.min(5, count); i++) {
        // Social links are simple anchors. Clicking may produce navigation to '#', but should not cause console logs.
        await demo.clickSocialLinkAt(i);
      }

      // Find newly produced console messages after initial snapshot
      const newMessages = consoleMessages.slice(initialConsoleSnapshot.length);

      // Ensure none of the new console messages indicate the logo was clicked.
      const logoClickFromSocial = newMessages.some(m => m.text === 'Logo clicked!');
      expect(logoClickFromSocial).toBe(false);

      // No page errors should have occurred from clicking social links
      expect(pageErrors.length).toBe(0);
    });

    test('DOM integrity after interactions: header, main content and footer remain present', async ({ page }) => {
      // Perform interactions and then verify the main DOM sections remain.
      const demo = new HttpsDemoPage(page);

      // Interact with multiple elements
      await demo.clickLogo();
      // Click the first social link if present
      const socialCount = await demo.socialLinksCount();
      if (socialCount > 0) {
        await demo.clickSocialLinkAt(0);
      }

      // After interactions, verify the core DOM elements still exist and are visible
      await expect(demo.header).toBeVisible();
      await expect(demo.mainContent).toBeVisible();
      await expect(demo.footer).toBeVisible();

      // No unexpected page errors during interactions
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Error observation and assertions', () => {
    test('no ReferenceError, SyntaxError, or TypeError occurred during page lifecycle', async ({ page }) => {
      // This test explicitly inspects captured page errors for the common types.
      // Note: We do not patch or modify the page; we only observe and assert the runtime behavior.
      // If the page legitimately throws any of these, the test will fail (which is desired).
      const forbiddenErrorTypes = ['ReferenceError', 'SyntaxError', 'TypeError'];

      // Inspect each captured page error and ensure it isn't one of the forbidden types.
      for (const err of pageErrors) {
        const name = err && err.name ? err.name : String(err);
        expect(forbiddenErrorTypes.includes(name)).toBe(false);
      }

      // Additionally assert that total pageErrors is zero as a strong guarantee of no runtime exceptions.
      expect(pageErrors.length).toBe(0);
    });
  });
});