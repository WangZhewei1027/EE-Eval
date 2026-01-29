import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b3f6a2-fa7c-11f0-9fa6-d1bbe297d459.html';

/**
 * Page Object Model for the HTTP demo page.
 * Encapsulates common queries and actions to keep tests readable and maintainable.
 */
class HttpDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demo-button');
    this.output = page.locator('#demo-output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickSimulate() {
    await this.button.click();
  }

  async isOutputVisible() {
    // Use evaluate to read computed style to confirm display property
    return await this.page.evaluate(() => {
      const el = document.getElementById('demo-output');
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return style && style.display !== 'none' && style.display !== '';
    });
  }

  async getOutputInnerHTML() {
    return await this.page.evaluate(() => {
      const el = document.getElementById('demo-output');
      return el ? el.innerHTML : null;
    });
  }

  async getOutputTextContent() {
    return await this.page.evaluate(() => {
      const el = document.getElementById('demo-output');
      return el ? el.textContent : null;
    });
  }

  async countOccurrencesOfHeading() {
    return await this.page.evaluate(() => {
      const el = document.getElementById('demo-output');
      if (!el) return 0;
      return (el.innerHTML.match(/<h3>Simulated HTTP Request<\/h3>/g) || []).length;
    });
  }
}

test.describe('FSM: Comprehensive Guide to HTTP - states and transitions', () => {
  // We'll collect console errors and page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error-level messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : null,
        });
      }
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', (err) => {
      pageErrors.push({
        message: err.message,
        stack: err.stack,
      });
    });
  });

  test.afterEach(async () => {
    // Basic sanity: tests should not leave lingering errors in the page listeners
    // (Detailed assertions happen inside tests themselves.)
  });

  test.describe('State S0_Idle (Initial Render)', () => {
    test('Idle state: page renders and shows the demo button; output is hidden by default', async ({ page }) => {
      const p = new HttpDemoPage(page);

      // Navigate to the page (this corresponds to the S0 entry action: renderPage())
      await p.goto();

      // Validate the demo button exists and is visible with expected text
      await expect(p.button).toBeVisible({ timeout: 2000 });
      await expect(p.button).toHaveText('Simulate HTTP Request');

      // Validate the output container exists in the DOM
      await expect(p.output).toHaveCount(1);

      // Verify that output is hidden initially (display: none via CSS)
      const isVisible = await p.isOutputVisible();
      expect(isVisible).toBe(false);

      // Inner HTML should be empty (or only whitespace)
      const inner = await p.getOutputInnerHTML();
      expect(inner === '' || inner === null || inner.trim() === '').toBe(true);

      // Observe console and page errors for this initial render: expect none
      // We assert there are no console errors or page errors on initial render.
      expect(consoleErrors.length, 'No console.error messages should be emitted on initial render').toBe(0);
      expect(pageErrors.length, 'No uncaught page errors should occur on initial render').toBe(0);
    });
  });

  test.describe('Event: SimulateHttpRequest (click #demo-button) and Transition S0 -> S1', () => {
    test('Clicking the Simulate HTTP Request button displays simulated request and response (transition to Request Simulated)', async ({ page }) => {
      const p = new HttpDemoPage(page);
      await p.goto();

      // Pre-check: output hidden
      expect(await p.isOutputVisible()).toBe(false);

      // Click the button to trigger the event (SimulateHttpRequest)
      await p.clickSimulate();

      // After clicking, the output should be visible
      // Use locator wait to ensure DOM update occurred
      await expect(p.output).toBeVisible({ timeout: 2000 });
      expect(await p.isOutputVisible()).toBe(true);

      // Validate that the output contains the expected pieces of the simulated request and response
      const outputText = await p.getOutputTextContent();

      // It should contain the heading and both request and response snippets
      expect(outputText).toContain('Simulated HTTP Request');
      expect(outputText).toContain('GET /demo HTTP/1.1');
      expect(outputText).toContain('Host: example.com');
      expect(outputText).toContain('HTTP/1.1 200 OK');
      expect(outputText).toContain('Server: Demo Server');
      expect(outputText).toContain('Hello from the demo server');

      // There should be exactly one simulated heading; clicking once must render a single block (no duplicates)
      const headingCount = await p.countOccurrencesOfHeading();
      expect(headingCount).toBe(1);

      // Confirm there were no runtime console errors or page errors as a result of the click and rendering
      expect(consoleErrors.length, 'No console.error messages should be emitted after clicking').toBe(0);
      expect(pageErrors.length, 'No uncaught page errors should occur after clicking').toBe(0);
    });

    test('Idempotency: multiple clicks update the output (date/time should change) but do not append duplicate blocks', async ({ page }) => {
      const p = new HttpDemoPage(page);
      await p.goto();

      // Click once and capture innerHTML
      await p.clickSimulate();
      await expect(p.output).toBeVisible({ timeout: 2000 });
      const firstInner = await p.getOutputInnerHTML();
      expect(firstInner).toBeTruthy();

      // Wait a short time to ensure date/time would differ on second click
      await page.waitForTimeout(25);

      // Click again
      await p.clickSimulate();
      await expect(p.output).toBeVisible();

      const secondInner = await p.getOutputInnerHTML();
      expect(secondInner).toBeTruthy();

      // The inner HTML should be replaced (date is dynamically generated)
      // It's acceptable for some parts to match, but overall content should not be identical
      // (especially the Date line which includes new Date().toUTCString()).
      expect(firstInner === secondInner).toBe(false);

      // There must still be exactly one simulated heading (no appended duplicates)
      const headingCount = await p.countOccurrencesOfHeading();
      expect(headingCount).toBe(1);

      // No console errors or page errors should be observed as a result of multiple clicks
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Clicking the button rapidly multiple times does not create multiple heading blocks nor throw errors', async ({ page }) => {
      const p = new HttpDemoPage(page);
      await p.goto();

      // Rapidly click the button multiple times
      for (let i = 0; i < 5; i++) {
        await p.button.click();
      }

      // Output should be visible
      await expect(p.output).toBeVisible();

      // Only one simulated heading should be present (the script replaces innerHTML rather than appending)
      const headingCount = await p.countOccurrencesOfHeading();
      expect(headingCount).toBe(1);

      // Confirm the output contains expected snippets
      const text = await p.getOutputTextContent();
      expect(text).toContain('GET /demo HTTP/1.1');
      expect(text).toContain('HTTP/1.1 200 OK');

      // No console errors or page errors should have been recorded
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Verify that there are no ReferenceError / SyntaxError / TypeError observed in console or page errors', async ({ page }) => {
      // This test focuses on ensuring that the page did not produce common JS runtime errors.
      // We intentionally only LOAD the page (no user interaction) to observe natural failures if present.
      const p = new HttpDemoPage(page);
      await p.goto();

      // If any pageErrors exist, assert their names are not ReferenceError/SyntaxError/TypeError.
      // Prefer explicit fail if such critical errors are found.
      for (const err of pageErrors) {
        const message = err.message || '';
        // If the message contains one of the error names, fail.
        const hasCritical = /ReferenceError|SyntaxError|TypeError/.test(message);
        expect(hasCritical, `Page error should not be a ReferenceError/SyntaxError/TypeError: ${message}`).toBe(false);
      }

      // Also inspect consoleErrors messages
      for (const ce of consoleErrors) {
        const text = ce.text || '';
        const hasCritical = /ReferenceError|SyntaxError|TypeError/.test(text);
        expect(hasCritical, `Console error should not be a ReferenceError/SyntaxError/TypeError: ${text}`).toBe(false);
      }
    });

    test('Behavior when expected DOM elements are present/absent - ensure robust queries', async ({ page }) => {
      // This test confirms the selectors used in the FSM exist and are queryable.
      // It also tries to query a non-existent element to ensure our code doesn't throw.
      const p = new HttpDemoPage(page);
      await p.goto();

      // Expected selectors from FSM
      await expect(page.locator('#demo-button')).toHaveCount(1);
      await expect(page.locator('#demo-output')).toHaveCount(1);

      // Query a non-existent element - should not throw but return zero count
      const nonExistent = page.locator('#this-id-does-not-exist');
      await expect(nonExistent).toHaveCount(0);

      // No runtime errors should have occurred merely from safe querying
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });
});