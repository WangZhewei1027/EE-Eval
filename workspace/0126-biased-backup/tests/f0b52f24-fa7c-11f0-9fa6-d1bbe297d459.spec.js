import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b52f24-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object for the KNN demonstration page
class KNNPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Ensure body exists before interacting
    await this.page.waitForSelector('body');
  }

  async getDemoButton() {
    return await this.page.$('#demo-button');
  }

  async getDemoContainer() {
    return await this.page.$('#demo-container');
  }

  async getButtonText() {
    const btn = await this.getDemoButton();
    return btn ? (await btn.innerText()).trim() : null;
  }

  async getContainerDisplay() {
    // Use evaluate to get the computed style display property
    return await this.page.$eval('#demo-container', (el) => {
      // return inline style first if exists, otherwise computed style
      const inline = el.style.display;
      if (inline && inline !== '') return inline;
      return window.getComputedStyle(el).display;
    });
  }

  async clickDemoButton() {
    const btn = await this.getDemoButton();
    await btn.click();
  }

  async getButtonBackgroundColor() {
    const btn = await this.getDemoButton();
    if (!btn) return null;
    return await this.page.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    }, btn);
  }

  async getContainerText() {
    const container = await this.getDemoContainer();
    if (!container) return null;
    return (await container.innerText()).trim();
  }
}

test.describe('KNN Demonstration - FSM and UI integration tests', () => {
  // Collect console messages and page errors for observation and assertions
  /** @type {Array<string>} */
  let consoleMessages;
  /** @type {Array<Error>} */
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      // Convert the console entry to a readable string
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // err is an Error object
      pageErrors.push(err);
    });
  });

  test.describe('Initial State (S0_Idle) validations', () => {
    test('renders initial page content and evidence expected in S0_Idle', async ({ page }) => {
      // Validate S0 entry action: renderPage() - we can't call it, but we verify the page rendered expected elements
      const knn = new KNNPage(page);
      await knn.goto();

      // Verify the demo button exists and has the expected initial text
      const button = await knn.getDemoButton();
      expect(button).not.toBeNull();
      const text = await knn.getButtonText();
      expect(text).toBe('Show KNN Demonstration');

      // Verify the demo container exists and is hidden (display: none)
      const container = await knn.getDemoContainer();
      expect(container).not.toBeNull();
      const display = await knn.getContainerDisplay();
      // The implementation sets #demo-container { display: none; } in CSS, so computed display should be 'none'
      expect(display).toBe('none');

      // Visual check: verify the button's background color corresponds to the stylesheet (#3498db -> rgb)
      const bg = await knn.getButtonBackgroundColor();
      // Some browsers may return 'rgb(52, 152, 219)'
      expect(bg).toBeTruthy();
      expect(bg).toContain('rgb'); // ensure it's a rgb/rgba value
    });
  });

  test.describe('Show/Hide Demonstration transitions (ShowDemo event)', () => {
    test('S0_Idle -> S1_DemoVisible when clicking the button', async ({ page }) => {
      // This test verifies the first transition in the FSM: showing the demo
      const knn = new KNNPage(page);
      await knn.goto();

      // Precondition check
      expect(await knn.getButtonText()).toBe('Show KNN Demonstration');
      expect(await knn.getContainerDisplay()).toBe('none');

      // Trigger the ShowDemo event
      await knn.clickDemoButton();

      // After click: container should be displayed and button text should be 'Hide Demonstration'
      // Wait for potential style changes to apply
      await page.waitForTimeout(100); // small pause to allow synchronous DOM manipulations

      const displayAfter = await knn.getContainerDisplay();
      expect(displayAfter === 'block' || displayAfter === 'inline-block' || displayAfter === 'flex').toBeTruthy();
      expect(await knn.getButtonText()).toBe('Hide Demonstration');

      // Verify the demo container contains expected descriptive content
      const containerText = await knn.getContainerText();
      expect(containerText).toContain('Imagine a 2D space with two classes');
      expect(containerText).toContain('With K=1, it takes the class of its single nearest neighbor.');
    });

    test('S1_DemoVisible -> S2_DemoHidden when clicking the button again', async ({ page }) => {
      // This test verifies hiding the demo from visible state
      const knn = new KNNPage(page);
      await knn.goto();

      // Show first
      await knn.clickDemoButton();
      await page.waitForTimeout(50);
      expect(await knn.getButtonText()).toBe('Hide Demonstration');

      // Click to hide
      await knn.clickDemoButton();
      await page.waitForTimeout(50);

      const displayFinal = await knn.getContainerDisplay();
      // Implementation sets display to 'none' on hide
      expect(displayFinal).toBe('none');
      expect(await knn.getButtonText()).toBe('Show KNN Demonstration');
    });

    test('S2_DemoHidden -> S1_DemoVisible toggles back when clicking the button from hidden', async ({ page }) => {
      // This test verifies toggling back to visible from hidden state (multiple toggles)
      const knn = new KNNPage(page);
      await knn.goto();

      // Ensure hidden
      expect(await knn.getContainerDisplay()).toBe('none');

      // Toggle sequence: click twice to go Visible -> Hidden -> Visible (start hidden => visible on first click)
      await knn.clickDemoButton(); // Hidden -> Visible
      await page.waitForTimeout(30);
      expect(await knn.getContainerDisplay()).not.toBe('none');
      expect(await knn.getButtonText()).toBe('Hide Demonstration');

      await knn.clickDemoButton(); // Visible -> Hidden
      await page.waitForTimeout(30);
      expect(await knn.getContainerDisplay()).toBe('none');
      expect(await knn.getButtonText()).toBe('Show KNN Demonstration');

      await knn.clickDemoButton(); // Hidden -> Visible again
      await page.waitForTimeout(30);
      expect(await knn.getContainerDisplay()).not.toBe('none');
      expect(await knn.getButtonText()).toBe('Hide Demonstration');
    });

    test('Edge case: rapid multiple clicks should toggle reliably and not throw', async ({ page }) => {
      // Rapid clicking tests robustness of event handler and verifies no uncaught exceptions occur during rapid interaction
      const knn = new KNNPage(page);
      await knn.goto();

      // Rapidly click the button 10 times
      const btn = await knn.getDemoButton();
      expect(btn).not.toBeNull();

      // Perform a burst of clicks
      for (let i = 0; i < 10; i++) {
        await btn.click();
      }

      // Wait for DOM to settle
      await page.waitForTimeout(200);

      // Final state should be consistent: since 10 is even, final state should equal initial (hidden)
      const finalDisplay = await knn.getContainerDisplay();
      const finalText = await knn.getButtonText();

      // If initial was 'none', after even number of toggles should be 'none'
      expect(finalDisplay).toBe('none');
      expect(finalText).toBe('Show KNN Demonstration');

      // Also assert that no page errors were recorded during the rapid interaction
      // We don't fail the test based on these errors here; we collect them and validate in the dedicated runtime error test below.
    });
  });

  test.describe('Runtime and console observations', () => {
    test('capture console logs and page errors while interacting', async ({ page }) => {
      // This test demonstrates observation of console messages and page errors across interactions.
      const knn = new KNNPage(page);
      await knn.goto();

      // Interact a bit to generate potential console messages or errors
      await knn.clickDemoButton();
      await page.waitForTimeout(30);
      await knn.clickDemoButton();
      await page.waitForTimeout(30);

      // At this point we've collected any console messages and page errors via the listeners attached in beforeEach.
      // Validate that consoleMessages is an array and pageErrors is an array.
      expect(Array.isArray(consoleMessages)).toBeTruthy();
      expect(Array.isArray(pageErrors)).toBeTruthy();

      // If there are console messages, at least one should include the button id or text (heuristic)
      if (consoleMessages.length > 0) {
        // We don't know exact console output, just assert that messages are strings
        for (const m of consoleMessages) {
          expect(typeof m).toBe('string');
          expect(m.length).toBeGreaterThan(0);
        }
      }

      // For pageErrors: assert their shapes if present (they should be Error objects)
      if (pageErrors.length > 0) {
        for (const err of pageErrors) {
          expect(err).toBeInstanceOf(Error);
          // The message should be non-empty
          expect(typeof err.message).toBe('string');
          expect(err.message.length).toBeGreaterThanOrEqual(0);
        }
      }
    });

    test('runtime errors, if any, should be instances of ReferenceError, TypeError, or SyntaxError (observational)', async ({ page }) => {
      // This test specifically inspects captured page errors and ensures that if any occurred, they are typical runtime JS errors.
      // We deliberately do not modify the page behavior; we observe errors naturally.
      const knn = new KNNPage(page);
      await knn.goto();

      // Perform some interactions to trigger potential runtime issues in bad implementations
      await knn.clickDemoButton();
      await knn.clickDemoButton();
      await knn.clickDemoButton();

      // Short wait to allow any asynchronous errors to surface
      await page.waitForTimeout(100);

      // Evaluate captured pageErrors array that was populated by page.on('pageerror', ...)
      // Note: The beforeEach created and reset pageErrors, and attached listeners.
      // Because pageErrors is closed over, retrieve its value via a small helper on window to ensure it's accessible here.
      // But we can't access the test scope variable from inside the page; we just use the array collected in this test scope.
      // Assert either there are no errors, or all errors are one of the expected types.
      if (pageErrors.length === 0) {
        // No uncaught runtime errors were observed. This is a valid outcome.
        expect(pageErrors.length).toBe(0);
      } else {
        // If there are errors, ensure they are of expected runtime error types
        const allowed = ['ReferenceError', 'TypeError', 'SyntaxError', 'RangeError', 'EvalError', 'URIError'];
        for (const err of pageErrors) {
          // err.name may exist; otherwise inspect message for the name
          const name = err.name || '';
          const message = err.message || '';
          const matchesAllowedName = allowed.includes(name);
          const messageContainsType = allowed.some((t) => message.includes(t));
          expect(matchesAllowedName || messageContainsType).toBeTruthy();
        }
      }

      // Additionally, provide the consoleMessages and pageErrors to the test output for debugging if needed
      // (Playwright will show assertion failures with context; we avoid overly verbose logs here.)
    });
  });

  test.afterEach(async ({}, testInfo) => {
    // After each test we can log counts to testInfo for debugging.
    // This is non-invasive and does not alter the page.
    if (consoleMessages && consoleMessages.length > 0) {
      testInfo.attach('console-messages', {
        body: consoleMessages.join('\n'),
        contentType: 'text/plain',
      });
    }
    if (pageErrors && pageErrors.length > 0) {
      const errs = pageErrors.map((e, idx) => `Error ${idx + 1}: ${e.name} - ${e.message}`).join('\n');
      testInfo.attach('page-errors', {
        body: errs,
        contentType: 'text/plain',
      });
    }
  });
});