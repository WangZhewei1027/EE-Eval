import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b0f8b2-fa7c-11f0-adc7-178f556b1ee0.html';

/**
 * Page Object for the Interpolation Search demo page.
 * Encapsulates interactions and collects console / page errors for assertions.
 */
class InterpolationApp {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Bind handlers so they can be removed if necessary
    this._consoleHandler = (msg) => {
      // store type and text for later assertions
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    };
    this._pageErrorHandler = (err) => {
      // store Error objects for later assertions
      this.pageErrors.push(err);
    };
  }

  async init() {
    // Attach listeners before navigation to catch errors during load as well
    this.page.on('console', this._consoleHandler);
    this.page.on('pageerror', this._pageErrorHandler);
  }

  async dispose() {
    // Remove listeners to avoid cross-test leakage
    this.page.off('console', this._consoleHandler);
    this.page.off('pageerror', this._pageErrorHandler);
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getDemoButton() {
    return this.page.locator('#interpolation-search-demo');
  }

  async clickDemoAndWaitForPageError() {
    // Wait for a pageerror event that is expected because the inline script
    // calls interpolationSearch which is not defined in the runtime.
    const pageErrorPromise = this.page.waitForEvent('pageerror');
    await this.page.click('#interpolation-search-demo');
    const err = await pageErrorPromise;
    return err;
  }

  // Return all captured console messages (text strings)
  getConsoleTexts() {
    return this.consoleMessages.map(m => m.text);
  }

  getPageErrors() {
    return this.pageErrors.slice();
  }
}

test.describe('Interpolation Search App FSM - f5b0f8b2-fa7c-11f0-adc7-178f556b1ee0', () => {
  test.describe.configure({ mode: 'parallel' });

  // Setup and teardown for each test to ensure a fresh page and listeners.
  test.beforeEach(async ({ page }) => {
    // nothing here; each test creates its own Page Object and navigates
  });

  test.afterEach(async ({ page }) => {
    // Ensure any uncaught errors don't leak into other tests.
    // Playwright will automatically close pages between tests in most configs.
  });

  test.describe('Idle State (S0_Idle)', () => {
    test('renders page content and exposes the Demonstrate button (evidence for S0_Idle)', async ({ page }) => {
      // Arrange: create app object and initialize listeners
      const app = new InterpolationApp(page);
      await app.init();

      // Act: navigate to the page
      await app.goto();

      // Assert: page contains the main title and descriptive text
      const title = await page.locator('h2').first().textContent();
      expect(title).toBeTruthy();
      expect(title.trim()).toContain('Interpolation Search');

      // Assert: the demonstration button exists and has correct text per FSM component evidence
      const demoBtn = await app.getDemoButton();
      await expect(demoBtn).toBeVisible();
      await expect(demoBtn).toHaveText('Demonstrate Interpolation Search');

      // Assert: the implementation example is present in the <pre> as static text (not executed)
      const preText = await page.locator('pre').textContent();
      expect(preText).toBeTruthy();
      expect(preText).toContain('function interpolationSearch(arr, target)');

      // Assert: inline script that attaches click handler is present in page content (FSM evidence)
      const pageHtml = await page.content();
      expect(pageHtml).toContain('addEventListener("click", function()');

      // Clean up listeners
      await app.dispose();
    });

    test('initial state has no runtime console logs related to demonstration before interaction', async ({ page }) => {
      const app = new InterpolationApp(page);
      await app.init();
      await app.goto();

      // There should be no console logs saying target found or not found before any interaction
      const consoleTexts = app.getConsoleTexts();
      expect(consoleTexts.some(t => t.includes('Target value found at index'))).toBe(false);
      expect(consoleTexts.some(t => t.includes('Target value not found in array'))).toBe(false);

      await app.dispose();
    });
  });

  test.describe('Demonstrating State (S1_Demonstrating) and transitions', () => {
    test('clicking the Demonstrate button triggers attempt to call interpolationSearch and results in a ReferenceError (matches S1 entry action expectations)', async ({ page }) => {
      const app = new InterpolationApp(page);
      await app.init();
      await app.goto();

      // Pre-check: button must exist
      const demoBtn = await app.getDemoButton();
      await expect(demoBtn).toBeVisible();

      // Act: click the demo button and wait for the pageerror event that is expected
      const pageError = await app.clickDemoAndWaitForPageError();

      // Assert: a runtime error occurred and mentions the missing function name from FSM transition
      // We expect the environment to throw because interpolationSearch is referenced but not defined.
      expect(pageError).toBeTruthy();
      // The message should indicate interpolationSearch is not defined or similar
      expect(String(pageError.message)).toContain('interpolationSearch');

      // The error type/name is generally ReferenceError in browsers for undefined identifiers.
      // Check either name or message contains ReferenceError (some engines include it in message string).
      const messageLower = String(pageError.message).toLowerCase();
      expect(messageLower.includes('reference') || messageLower.includes('not defined') || messageLower.includes('interpolationsearch')).toBeTruthy();

      // Assert: there are no console logs indicating success paths ("Target value found at index" or "Target value not found in array")
      const consoleTexts = app.getConsoleTexts();
      expect(consoleTexts.some(t => t.includes('Target value found at index'))).toBe(false);
      expect(consoleTexts.some(t => t.includes('Target value not found in array'))).toBe(false);

      // Assert: DOM remains intact after the failed demonstration (button still visible)
      await expect(demoBtn).toBeVisible();

      await app.dispose();
    });

    test('clicking the Demonstrate button multiple times produces multiple page errors (edge case: repeated transitions)', async ({ page }) => {
      const app = new InterpolationApp(page);
      await app.init();
      await app.goto();

      // Click twice, awaiting two pageerror events sequentially
      const firstErrorPromise = page.waitForEvent('pageerror');
      await page.click('#interpolation-search-demo');
      const firstError = await firstErrorPromise;
      expect(String(firstError.message)).toContain('interpolationSearch');

      const secondErrorPromise = page.waitForEvent('pageerror');
      await page.click('#interpolation-search-demo');
      const secondError = await secondErrorPromise;
      expect(String(secondError.message)).toContain('interpolationSearch');

      // Both errors should be captured by our page object handler as well
      // Wait a tick for handlers to populate arrays
      await page.waitForTimeout(50);
      const collectedErrors = app.getPageErrors();
      // At least two errors recorded in collectedErrors (could be more depending on engine)
      expect(collectedErrors.length).toBeGreaterThanOrEqual(2);
      expect(String(collectedErrors[0].message)).toContain('interpolationSearch');

      await app.dispose();
    });

    test('assert that expected console success messages from FSM do NOT occur due to missing implementation (negative assertion)', async ({ page }) => {
      const app = new InterpolationApp(page);
      await app.init();
      await app.goto();

      // Click once and wait for the pageerror (the success paths in the FSM would log to console,
      // but because the function is missing they should not appear).
      await app.clickDemoAndWaitForPageError();

      // Allow any console messages to be collected
      await page.waitForTimeout(50);
      const consoleTexts = app.getConsoleTexts();

      // FSM expected observables include two possible console logs; assert neither occurred
      expect(consoleTexts.some(t => t.includes('Target value found at index'))).toBe(false);
      expect(consoleTexts.some(t => t.includes('Target value not found in array'))).toBe(false);

      // Also assert that there was at least one console-level error message indicating the failure (engine dependent)
      const hasErrorTypeConsole = app.consoleMessages.some(m => m.type === 'error' || m.text.toLowerCase().includes('referenceerror'));
      expect(hasErrorTypeConsole || app.getPageErrors().length > 0).toBeTruthy();

      await app.dispose();
    });
  });

  test.describe('Additional assertions for FSM evidence and robustness', () => {
    test('verify documentation text and algorithm description are present (renderPage entry action evidence)', async ({ page }) => {
      const app = new InterpolationApp(page);
      await app.init();
      await app.goto();

      // The page should include multiple headings and algorithm description paragraphs per the HTML
      const headings = await page.locator('h2').allTextContents();
      expect(headings.length).toBeGreaterThanOrEqual(3);
      expect(headings.some(h => h.includes('Implementation') || h.includes('Algorithm') || h.includes('Demonstration'))).toBeTruthy();

      // The algorithm description mentions steps and formula; check for some tokens from the static content
      const bodyText = await page.locator('body').innerText();
      expect(bodyText).toContain('Choose a value k such that it is within the range');
      expect(bodyText).toContain('Calculate the estimated position of the target value');

      await app.dispose();
    });

    test('ensure page includes inline script that wires click handler (FSM event handler evidence)', async ({ page }) => {
      const app = new InterpolationApp(page);
      await app.init();
      await app.goto();

      // The inline script attaches a click handler; ensure the literal string is present in page source.
      const content = await page.content();
      expect(content).toContain('document.getElementById("interpolation-search-demo").addEventListener("click"');

      await app.dispose();
    });
  });
});