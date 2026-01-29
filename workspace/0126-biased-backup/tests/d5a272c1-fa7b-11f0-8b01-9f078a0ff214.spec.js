import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a272c1-fa7b-11f0-8b01-9f078a0ff214.html';

/**
 * Page object for the demo page to encapsulate selectors and common actions.
 */
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.toggleButton = "button[onclick='toggleDemo()']";
    this.demoSelector = '#demo';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async clickToggle() {
    await this.page.click(this.toggleButton);
  }

  async getDemoInlineDisplay() {
    return this.page.$eval(this.demoSelector, el => el.style.display);
  }

  async getDemoComputedDisplay() {
    return this.page.$eval(this.demoSelector, el => getComputedStyle(el).display);
  }

  async toggleViaFunction() {
    // Call the existing toggleDemo() function in page context
    return this.page.evaluate(() => {
      // Call the function (it exists in the provided HTML)
      toggleDemo();
    });
  }

  async hasToggleOnclickAttribute() {
    return this.page.$eval(this.toggleButton, btn => btn.getAttribute('onclick'));
  }

  async getButtonText() {
    return this.page.$eval(this.toggleButton, btn => btn.textContent.trim());
  }
}

test.describe('Understanding Transactions - FSM and UI integration tests', () => {
  let consoleMessages = [];
  let pageErrors = [];

  // Register listeners for console messages and page errors for each test.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Capture uncaught exceptions from the page context
      pageErrors.push(err);
    });
  });

  test.describe('Initial Load and S0_Idle state', () => {
    // Validate initial rendering, presence of components, and S0 expectations.
    test('S0_Idle: Page loads, button exists, demo is initially hidden, and renderPage is not defined', async ({ page }) => {
      const demoPage = new DemoPage(page);

      // Navigate to the application page
      await demoPage.goto();

      // Basic sanity checks
      await expect(page).toHaveTitle(/Understanding Transactions/);

      // Button exists and has the expected text and onclick attribute per FSM/component evidence
      await expect(page.locator(demoPage.toggleButton)).toBeVisible();
      const btnText = await demoPage.getButtonText();
      expect(btnText).toBe('Click for Simple Transaction Demonstration');

      const onclickAttr = await demoPage.hasToggleOnclickAttribute();
      expect(onclickAttr).toBe('toggleDemo()');

      // The .demo element exists
      const demoHandle = page.locator(demoPage.demoSelector);
      await expect(demoHandle).toBeVisible(); // element exists in DOM

      // Validate S0 Idle: demo should be hidden initially (computed style)
      const computedDisplay = await demoPage.getDemoComputedDisplay();
      expect(computedDisplay).toBe('none');

      // The inline style may be empty initially - ensure inline style is '' or 'none'
      const inlineDisplay = await demoPage.getDemoInlineDisplay();
      // Inline style is likely empty because the CSS sets it; accept '' or 'none'
      expect(['', 'none']).toContain(inlineDisplay);

      // FSM mentioned renderPage() as an entry action for S0. Verify it is NOT defined in the page context.
      const renderPageType = await page.evaluate(() => (typeof window.renderPage));
      expect(renderPageType).toBe('undefined');

      // Ensure no page-level uncaught errors happened during load
      expect(pageErrors.length).toBe(0);

      // Ensure there are no console.error messages recorded during initial load
      const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMsgs.length).toBe(0);
    });
  });

  test.describe('ToggleDemo transitions: S0 -> S1 -> S2 -> S1', () => {
    test('S0 -> S1: Clicking the toggle button shows the demo (entry to Demo Visible)', async ({ page }) => {
      const demoPage = new DemoPage(page);
      await demoPage.goto();

      // Precondition: demo is hidden
      expect(await demoPage.getDemoComputedDisplay()).toBe('none');

      // Click the toggle button (FSM event: ToggleDemo)
      await demoPage.clickToggle();

      // After clicking, the JS sets inline style to 'block' -> computed display should be 'block'
      const inlineAfterFirstClick = await demoPage.getDemoInlineDisplay();
      expect(inlineAfterFirstClick).toBe('block');

      const computedAfterFirstClick = await demoPage.getDemoComputedDisplay();
      expect(computedAfterFirstClick).toBe('block');

      // Verify that toggleDemo exists as a function (entry/exit action reliance)
      const toggleType = await page.evaluate(() => typeof window.toggleDemo);
      expect(toggleType).toBe('function');

      // Ensure no uncaught page errors produced by performing the click
      expect(pageErrors.length).toBe(0);

      // Ensure no console.error messages resulted from the interaction
      const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMsgs.length).toBe(0);
    });

    test('S1 -> S2: Clicking the toggle button again hides the demo (transition to Demo Hidden)', async ({ page }) => {
      const demoPage = new DemoPage(page);
      await demoPage.goto();

      // Make it visible first
      await demoPage.clickToggle();
      expect(await demoPage.getDemoComputedDisplay()).toBe('block');

      // Click again to hide
      await demoPage.clickToggle();

      // After second click, inline style should be 'none' and computed display 'none'
      const inlineAfterSecondClick = await demoPage.getDemoInlineDisplay();
      expect(inlineAfterSecondClick).toBe('none');

      const computedAfterSecondClick = await demoPage.getDemoComputedDisplay();
      expect(computedAfterSecondClick).toBe('none');

      // No uncaught errors should be present
      expect(pageErrors.length).toBe(0);

      // No console.error messages should have been logged for this interaction
      const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMsgs.length).toBe(0);
    });

    test('S2 -> S1: A third click returns to Demo Visible (toggle back to shown)', async ({ page }) => {
      const demoPage = new DemoPage(page);
      await demoPage.goto();

      // Click thrice: show -> hide -> show
      await demoPage.clickToggle(); // show
      expect(await demoPage.getDemoComputedDisplay()).toBe('block');

      await demoPage.clickToggle(); // hide
      expect(await demoPage.getDemoComputedDisplay()).toBe('none');

      await demoPage.clickToggle(); // show again
      expect(await demoPage.getDemoComputedDisplay()).toBe('block');

      // Confirm inline style is 'block'
      expect(await demoPage.getDemoInlineDisplay()).toBe('block');

      // No page errors and no console errors produced
      expect(pageErrors.length).toBe(0);
      const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMsgs.length).toBe(0);
    });

    test('Direct function call toggleDemo() toggles visibility identically to clicking', async ({ page }) => {
      const demoPage = new DemoPage(page);
      await demoPage.goto();

      // Use the page-provided function to toggle
      await demoPage.toggleViaFunction();
      expect(await demoPage.getDemoComputedDisplay()).toBe('block');

      // Toggle again via function
      await demoPage.toggleViaFunction();
      expect(await demoPage.getDemoComputedDisplay()).toBe('none');

      // No uncaught errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Entry/Exit action verification and error scenarios', () => {
    test('Calling a non-existent renderPage() should throw a ReferenceError when invoked and not be defined', async ({ page }) => {
      const demoPage = new DemoPage(page);
      await demoPage.goto();

      // Confirm renderPage is not defined
      const renderPageType = await page.evaluate(() => (typeof window.renderPage));
      expect(renderPageType).toBe('undefined');

      // Attempt to call renderPage directly in page context - this should result in a rejection from evaluate
      let thrownError = null;
      try {
        // This will throw in the browser context and reject the evaluate promise.
        await page.evaluate(() => {
          // Call the function that does not exist to allow the natural ReferenceError to occur.
          // We intentionally do NOT wrap this call in try/catch here so the error propagates to node.
          renderPage();
        });
      } catch (err) {
        thrownError = err;
      }

      // Ensure an error was thrown and that it's a ReferenceError or indicates the identifier is not defined.
      expect(thrownError).not.toBeNull();
      // Many environments present different message text; check name or message substring.
      // In Playwright, the error thrown by page.evaluate usually contains "ReferenceError" in the message.
      const msg = String(thrownError.message || thrownError);
      expect(msg.toLowerCase()).toContain('referenceerror' || 'is not defined' );
    });

    test('Edge case: Rapid repeated toggles do not cause uncaught exceptions', async ({ page }) => {
      const demoPage = new DemoPage(page);
      await demoPage.goto();

      // Rapidly toggle 10 times
      for (let i = 0; i < 10; i++) {
        await demoPage.clickToggle();
      }

      // After even number of toggles (10), the demo should return to initial hidden state
      const computed = await demoPage.getDemoComputedDisplay();
      expect(computed).toBe('none');

      // Confirm no uncaught page errors occurred
      expect(pageErrors.length).toBe(0);

      // And no console.error messages
      const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMsgs.length).toBe(0);
    });
  });

  test.describe('Observability: console messages and page errors monitoring', () => {
    test('No unexpected console.error or uncaught exceptions during typical usage', async ({ page }) => {
      const demoPage = new DemoPage(page);
      await demoPage.goto();

      // Perform typical user interactions
      await demoPage.clickToggle(); // show
      await demoPage.clickToggle(); // hide

      // Wait a short while to allow any asynchronous console/page errors to surface
      await page.waitForTimeout(100);

      // Validate that no uncaught page errors were emitted
      expect(pageErrors.length).toBe(0);

      // Validate that no console.error messages were emitted
      const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleEntries.length).toBe(0);
    });

    test('Capture and expose any console messages for diagnostic purposes (non-failing)', async ({ page }) => {
      const demoPage = new DemoPage(page);
      await demoPage.goto();

      // Trigger interactions
      await demoPage.clickToggle();
      await demoPage.clickToggle();

      // Provide a diagnostic assertion that logs were captured (this test is not intended to fail if messages exist)
      // The test ensures we can read console messages; it doesn't assert zero messages here.
      expect(Array.isArray(consoleMessages)).toBe(true);
    });
  });
});