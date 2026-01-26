import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b33350-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object Model for the demonstration page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoButton = page.locator('#demo-button');
    this.demoOutput = page.locator('#demo-output');
    this.h1 = page.locator('h1');
  }

  // Navigate to the app page
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Click the demonstration button
  async clickDemoButton() {
    await this.demoButton.click();
  }

  // Return whether the demo output is visible (computed from CSS display)
  async isOutputVisible() {
    // evaluate computed style to reflect actual rendered visibility
    return await this.page.evaluate(() => {
      const el = document.getElementById('demo-output');
      if (!el) return false;
      // Use getComputedStyle to consider CSS
      const cs = window.getComputedStyle(el);
      return cs && cs.display !== 'none' && cs.visibility !== 'hidden' && el.offsetParent !== null;
    });
  }

  // Get the demo output innerHTML
  async getOutputHTML() {
    return await this.page.evaluate(() => {
      const el = document.getElementById('demo-output');
      return el ? el.innerHTML : null;
    });
  }

  // Count example rows in the inserted table (excluding header row)
  async countExampleRows() {
    return await this.page.evaluate(() => {
      const table = document.querySelector('#demo-output table.comparison-table');
      if (!table) return 0;
      // count data rows (skip header)
      return Math.max(0, table.querySelectorAll('tr').length - 1);
    });
  }

  // Get H1 text content
  async getTitleText() {
    return await this.h1.textContent();
  }
}

// Helper to attach console and pageerror listeners and collect them
function attachErrorCollectors(page) {
  const consoleMessages = [];
  const consoleErrors = [];
  const pageErrors = [];

  const consoleListener = msg => {
    const payload = {
      type: msg.type(),
      text: msg.text(),
      location: msg.location ? msg.location() : undefined,
    };
    consoleMessages.push(payload);
    if (msg.type() === 'error') {
      consoleErrors.push(payload);
    }
  };

  const pageErrorListener = err => {
    // err is Error object
    pageErrors.push({
      name: err.name,
      message: err.message,
      stack: err.stack,
    });
  };

  page.on('console', consoleListener);
  page.on('pageerror', pageErrorListener);

  return {
    getConsoleMessages: () => consoleMessages,
    getConsoleErrors: () => consoleErrors,
    getPageErrors: () => pageErrors,
    detach: () => {
      page.off('console', consoleListener);
      page.off('pageerror', pageErrorListener);
    },
  };
}

test.describe('FSM: Big-Omega Demonstration (f0b33350-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  // Validate the two states and the single transition defined in the FSM.
  test.describe('States and Transitions', () => {
    test('S0_Idle: On load the page should render Idle state evidence (demo button present, demo output hidden)', async ({ page }) => {
      // Attach collectors for runtime errors and console issues
      const collectors = attachErrorCollectors(page);

      const demo = new DemoPage(page);
      await demo.goto();

      // Validate that the entry action evidence for S0_Idle (renderPage) resulted in expected DOM
      // We cannot call renderPage(), we only assert the evidence that should be present on entry.
      await expect(demo.demoButton).toBeVisible({ timeout: 2000 });
      const buttonText = await demo.demoButton.textContent();
      expect(buttonText && buttonText.trim()).toBe('Show Demonstration');

      // demo-output should be present in DOM but hidden by default (display: none;)
      const isVisible = await demo.isOutputVisible();
      expect(isVisible).toBe(false);

      // Verify the element exists and has the expected inline style or computed display none
      const hasDemoOutputElement = await page.$('#demo-output') !== null;
      expect(hasDemoOutputElement).toBe(true);

      // Validate high-level page rendering (title exists) as indirect evidence of renderPage having run
      const title = await demo.getTitleText();
      expect(title && title.trim()).toContain('Big-Omega Notation');

      // Assert no runtime page errors or console errors were observed during load
      const pageErrors = collectors.getPageErrors();
      const consoleErrors = collectors.getConsoleErrors();

      // Provide diagnostic messages if any errors are present
      expect(pageErrors.length, `Expected no page errors on load but found: ${JSON.stringify(pageErrors, null, 2)}`).toBe(0);
      expect(consoleErrors.length, `Expected no console.error messages on load but found: ${JSON.stringify(consoleErrors, null, 2)}`).toBe(0);

      collectors.detach();
    });

    test('Transition ShowDemonstration: clicking #demo-button should display #demo-output with expected content (S0_Idle -> S1_DemoVisible)', async ({ page }) => {
      const collectors = attachErrorCollectors(page);

      const demo = new DemoPage(page);
      await demo.goto();

      // Ensure starting state: output hidden
      expect(await demo.isOutputVisible()).toBe(false);

      // Perform the event: click the demo button
      await demo.clickDemoButton();

      // After click, expected observable: #demo-output is displayed
      await expect(page.locator('#demo-output')).toBeVisible({ timeout: 2000 });
      const visible = await demo.isOutputVisible();
      expect(visible).toBe(true);

      // The content should include the "Big-Omega Examples" header and a table with example rows
      const outputHTML = await demo.getOutputHTML();
      expect(outputHTML).toBeTruthy();
      expect(outputHTML).toContain('Big-Omega Examples');
      expect(outputHTML).toContain('<table');
      // Count example rows: FSM's demonstration inserts 4 example rows (excluding header)
      const rowCount = await demo.countExampleRows();
      expect(rowCount).toBeGreaterThanOrEqual(4);

      // Validate some of the expected example strings exist
      expect(outputHTML).toContain('5n³ + 2n + 7');
      expect(outputHTML).toContain('Ω(n³)');
      expect(outputHTML).toContain('1000');
      expect(outputHTML).toContain('Ω(1)');

      // Assert no runtime page errors or console errors were observed after clicking
      const pageErrors = collectors.getPageErrors();
      const consoleErrors = collectors.getConsoleErrors();

      expect(pageErrors.length, `Expected no page errors after clicking button but found: ${JSON.stringify(pageErrors, null, 2)}`).toBe(0);
      expect(consoleErrors.length, `Expected no console.error messages after clicking button but found: ${JSON.stringify(consoleErrors, null, 2)}`).toBe(0);

      collectors.detach();
    });

    test('Edge case: clicking the demo button multiple times should keep the output visible and not duplicate content unexpectedly', async ({ page }) => {
      const collectors = attachErrorCollectors(page);

      const demo = new DemoPage(page);
      await demo.goto();

      // Click once and capture HTML
      await demo.clickDemoButton();
      await expect(demo.demoOutput).toBeVisible();
      const htmlAfterFirstClick = await demo.getOutputHTML();

      // Click again and capture HTML
      await demo.clickDemoButton();
      await expect(demo.demoOutput).toBeVisible();
      const htmlAfterSecondClick = await demo.getOutputHTML();

      // Clicking multiple times should not replace content with something unexpected.
      // We assert that content remains non-empty and stable (not removed or drastically changed).
      expect(htmlAfterFirstClick).toBeTruthy();
      expect(htmlAfterSecondClick).toBeTruthy();
      expect(htmlAfterSecondClick).toBe(htmlAfterFirstClick);

      // Validate the number of example rows did not grow unexpectedly
      const rowCount = await demo.countExampleRows();
      // Expecting the same 4 example rows (or at least not zero)
      expect(rowCount).toBeGreaterThanOrEqual(4);

      // Verify again no runtime errors appeared due to repeated interaction
      const pageErrors = collectors.getPageErrors();
      const consoleErrors = collectors.getConsoleErrors();

      expect(pageErrors.length, `Expected no page errors after repeated clicks but found: ${JSON.stringify(pageErrors, null, 2)}`).toBe(0);
      expect(consoleErrors.length, `Expected no console.error messages after repeated clicks but found: ${JSON.stringify(consoleErrors, null, 2)}`).toBe(0);

      collectors.detach();
    });
  });

  test.describe('Error observation and robustness checks', () => {
    test('Observe console messages and page errors during full user flow and assert absence of critical runtime errors', async ({ page }) => {
      // This test's sole responsibility is to observe console and page errors during normal usage.
      const collectors = attachErrorCollectors(page);
      const demo = new DemoPage(page);
      await demo.goto();

      // simulate user flow: load -> click -> click again
      await demo.clickDemoButton();
      await demo.clickDemoButton();

      // Give some time for any asynchronous runtime errors to surface
      await page.waitForTimeout(200);

      const pageErrors = collectors.getPageErrors();
      const consoleMessages = collectors.getConsoleMessages();
      const consoleErrors = collectors.getConsoleErrors();

      // Log some diagnostics as part of failure messages if expectations are not met.
      expect(pageErrors.length, `Expected zero page errors during user flow. Found: ${pageErrors.length}. Details: ${JSON.stringify(pageErrors, null, 2)}`).toBe(0);

      // Ensure there were no console.error() messages emitted by the app
      expect(consoleErrors.length, `Expected zero console.error messages during user flow. Found: ${consoleErrors.length}. Details: ${JSON.stringify(consoleErrors, null, 2)}`).toBe(0);

      // Additionally, assert that no critical error names like ReferenceError, SyntaxError, TypeError occurred
      const criticalNames = ['ReferenceError', 'SyntaxError', 'TypeError'];
      const criticalErrors = pageErrors.filter(e => criticalNames.includes(e.name));
      expect(criticalErrors.length, `Expected no critical JS errors (${criticalNames.join(', ')}) but found: ${JSON.stringify(criticalErrors, null, 2)}`).toBe(0);

      // Optionally check console message variety (info/debug/warn). We don't require specific logs, but capture them.
      // At minimum, ensure console messages were captured as an array (could be empty).
      expect(Array.isArray(consoleMessages)).toBe(true);

      collectors.detach();
    });

    test('Negative scenario: verify that missing elements would surface errors (observe but do not modify DOM)', async ({ page }) => {
      // This test observes what happens if the app were to throw when looking up elements.
      // We will not mutate the page. Instead we assert that the current implementation does not produce page errors.
      const collectors = attachErrorCollectors(page);
      const demo = new DemoPage(page);
      await demo.goto();

      // Perform an action that relies on elements existing (click the demo button).
      // If elements were missing, this could lead to runtime exceptions; we assert none occurred.
      await demo.clickDemoButton();

      // Wait briefly for any errors to appear
      await page.waitForTimeout(100);

      const pageErrors = collectors.getPageErrors();
      // Expect no page errors; if there were, they are captured above and will fail the assertion.
      expect(pageErrors.length, `Expected no page errors in negative scenario check but found: ${JSON.stringify(pageErrors, null, 2)}`).toBe(0);

      collectors.detach();
    });
  });
});