import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cb6221-fa7c-11f0-ba20-415c525382ea.html';

/**
 * Page Object for the Big-Omega demonstration page.
 * Encapsulates selectors and common actions so tests remain readable.
 */
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.showDemoBtn = page.locator('#showDemo');
    this.demoArea = page.locator('#demo');
  }

  // Navigate to the page and wait for initial load
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Click the Show Demo button (simulating a user click)
  async clickShowDemo() {
    await this.showDemoBtn.click();
  }

  // Return boolean whether demo area is visible (computed)
  async isDemoVisible() {
    return await this.demoArea.isVisible();
  }

  // Return boolean whether show button is disabled
  async isButtonDisabled() {
    return await this.showDemoBtn.isDisabled();
  }

  // Get the text content of the demo area
  async getDemoText() {
    return await this.demoArea.textContent();
  }

  // Get the value of aria-live attribute on the demo area
  async getAriaLive() {
    return await this.demoArea.getAttribute('aria-live');
  }

  // Get the inline style display value of demo area
  async getDemoDisplayStyle() {
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.style.display : null;
    }, '#demo');
  }
}

test.describe('FSM: Understanding Big-Omega (Ω) Notation - Interactive Demo', () => {
  // Use a fresh DemoPage for each test
  test.beforeEach(async ({ page }) => {
    // Nothing to do globally here; individual tests will instantiate DemoPage and navigate.
  });

  test.afterEach(async ({ page }) => {
    // Ensure any residual errors are surfaced in test logs; no cleanup modifications to the page are performed.
    // (We intentionally do not modify global state of the app.)
  });

  test.describe('S0_Idle (Initial State) validations', () => {
    test('Initial Idle state: showDemo button exists and demo area is hidden with correct attributes', async ({ page }) => {
      // This test validates S0_Idle as described in the FSM:
      // - renderPage() entry action should have run (page rendered),
      // - evidence: button #showDemo exists
      // - demo area should be hidden (style display:none) and have aria-live=polite
      const demoPage = new DemoPage(page);
      await demoPage.goto();

      // The Show Demo button should be present, visible and enabled in the idle state.
      await expect(demoPage.showDemoBtn).toBeVisible();
      await expect(demoPage.showDemoBtn).toBeEnabled();

      // The demo area should be present in the DOM but hidden (display: none per implementation).
      await expect(demoPage.demoArea).toBeHidden();
      const displayStyle = await demoPage.getDemoDisplayStyle();
      expect(displayStyle === 'none' || displayStyle === '').toBeTruthy();

      // Check aria-live attribute exists and is set to polite (per component definition)
      const ariaLive = await demoPage.getAriaLive();
      expect(ariaLive).toBe('polite');

      // The demo area's initial text content should be empty string or null.
      const initialText = await demoPage.getDemoText();
      // Accept both empty string and null (depending on how textContent is returned).
      expect(initialText === '' || initialText === null).toBeTruthy();
    });
  });

  test.describe('S0_Idle -> S1_DemoVisible transition tests', () => {
    test('Clicking "Show Big-Omega Demonstration" reveals demo area, populates text, and disables button', async ({ page }) => {
      // This test validates the transition triggered by ShowDemoClick:
      // - demoArea.textContent is populated with the demonstration output
      // - demoArea.style.display becomes "block"
      // - demoBtn.disabled becomes true
      // Also capture console messages and page errors while interacting with the page.
      const demoPage = new DemoPage(page);

      // Arrays to capture console messages and page errors
      const consoleMessages = [];
      const consoleErrors = [];
      const pageErrors = [];

      // Attach listeners before navigation to ensure we capture any early/runtime errors
      page.on('console', (msg) => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      page.on('pageerror', (err) => {
        pageErrors.push(err);
      });

      // Navigate to the app
      await demoPage.goto();

      // Click the demo button to trigger the transition
      await demoPage.clickShowDemo();

      // The demo area should become visible per transition action demoArea.style.display = "block";
      await expect(demoPage.demoArea).toBeVisible();
      const displayStyle = await demoPage.getDemoDisplayStyle();
      expect(displayStyle).toBe('block');

      // The button should be disabled after click
      expect(await demoPage.isButtonDisabled()).toBe(true);

      // The demo area should contain key lines that indicate the demonstration executed.
      const demoText = await demoPage.getDemoText();
      expect(demoText).toBeTruthy();

      // Check for a handful of expected strings that were pushed into the demo output
      expect(demoText).toContain('Big-Omega Demonstration for f(n) = 2n + 3 and g(n) = n');
      expect(demoText).toContain('Using c = 1.5');
      expect(demoText).toContain('f(n) >= c*g(n)?');
      expect(demoText).toContain('According to Big-Omega definition');
      // Verify the computed n0 is present and matches expected value (n0 === 1 for this demo)
      expect(demoText).toMatch(/n ?≥ ?1/);

      // Assert that no uncaught page errors were reported during navigation or clicking.
      // Per instructions we observe and assert natural errors; this app is expected to run without runtime errors.
      expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => String(e)).join('\n')}`).toBe(0);

      // Assert that there are no console.error messages produced by the page during the interaction.
      expect(consoleErrors.length, `Console errors were emitted: ${consoleErrors.join('\n')}`).toBe(0);

      // For debugging traceability, attach the entire console log (non-failing)
      // We do not assert on console message count beyond error absence because informational logs
      // are implementation details and may vary across environments.
    });

    test('Edge case: subsequent click after disabled should not change demo content or re-enable button', async ({ page }) => {
      // Validate that once the transition has occurred, the button remains disabled and
      // further user attempts do not alter the produced content. This guards against
      // accidental double-trigger behavior.
      const demoPage = new DemoPage(page);
      await demoPage.goto();

      // First click to trigger primary transition
      await demoPage.clickShowDemo();

      // Capture the demo content after first click
      const textAfterFirstClick = await demoPage.getDemoText();
      expect(textAfterFirstClick).toBeTruthy();

      // Attempt to click the disabled button a second time (simulating a user trying again).
      // Note: user clicks on a disabled button should have no effect. Playwright's click will
      // still dispatch a click, but the DOM should not run the handler because the button has the disabled attribute.
      // We don't alter any functions or internals; we literally attempt a user click.
      await demoPage.showDemoBtn.click();

      // Capture the demo content again and compare to ensure it has not changed.
      const textAfterSecondClick = await demoPage.getDemoText();
      expect(textAfterSecondClick).toBe(textAfterFirstClick);

      // The button should remain disabled
      expect(await demoPage.isButtonDisabled()).toBe(true);
    });
  });

  test.describe('Observability & Error Monitoring', () => {
    test('No runtime ReferenceError/SyntaxError/TypeError should be thrown during normal use', async ({ page }) => {
      // This test explicitly observes console and pageerror events for ReferenceError, SyntaxError, TypeError.
      // Per the constraints we will not patch the page; we only observe and assert that none of these errors occur.
      const demoPage = new DemoPage(page);
      const pageErrors = [];
      const consoleErrors = [];

      page.on('pageerror', (err) => {
        pageErrors.push(err);
      });

      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await demoPage.goto();

      // Interact with the page as a typical user would
      await demoPage.clickShowDemo();

      // Wait a short moment to allow any asynchronous errors to surface
      await page.waitForTimeout(100);

      // Assert no page-level uncaught exceptions occurred
      expect(pageErrors.length, `Uncaught page errors were detected: ${pageErrors.map(String).join('\n')}`).toBe(0);

      // Assert no console.error messages were emitted
      // If any console errors are present, include them in the failure message for easier debugging.
      expect(consoleErrors.length, `Console.error messages were emitted: ${consoleErrors.join('\n')}`).toBe(0);
    });
  });
});