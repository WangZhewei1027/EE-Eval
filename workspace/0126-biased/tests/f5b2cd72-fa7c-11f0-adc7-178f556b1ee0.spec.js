import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b2cd72-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object for the TCP/IP demo page
class TcpIpPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoButton = page.locator('#demo-button');
    this.paragraphs = page.locator('body p');
  }

  // Navigate to the application page
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Return the demo button locator
  getDemoButton() {
    return this.demoButton;
  }

  // Click the demo button (one click)
  async clickDemoButton() {
    await this.demoButton.click();
  }

  // Count all paragraph elements on the page
  async countParagraphs() {
    return await this.paragraphs.count();
  }

  // Get the text content of the last paragraph on the page
  async getLastParagraphText() {
    const count = await this.countParagraphs();
    if (count === 0) return null;
    return await this.paragraphs.nth(count - 1).textContent();
  }

  // Wait for paragraph count to increase to expectedCount
  async waitForParagraphCount(expectedCount, timeout = 2000) {
    await this.page.waitForFunction(
      (sel, expected) => document.querySelectorAll(sel).length === expected,
      {},
      'body p',
      expectedCount
    );
  }
}

test.describe('Understanding TCP/IP - FSM and UI tests', () => {
  // Arrays to capture console messages and page errors during the test run
  let consoleMessages;
  let pageErrors;

  // Register listeners before each test and navigate to the page
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages emitted by the page
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app under test
    await page.goto(APP_URL);
  });

  // Cleanup listeners after each test to avoid leaks between tests
  test.afterEach(async ({ page }) => {
    // Remove listeners if possible to keep a clean slate
    // (Playwright pages reuse the event emitter; removing all listeners is safe here)
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test.describe('FSM State: S0_Idle (Initial state)', () => {
    test('Initial Idle state: demo button is present and visible', async ({ page }) => {
      // This test validates the S0_Idle evidence: the demo button must be rendered on page load.
      const app = new TcpIpPage(page);

      // Ensure the page loaded and the button exists
      await expect(app.getDemoButton()).toBeVisible();

      // Verify the button text matches the FSM/component definition
      await expect(app.getDemoButton()).toHaveText('View TCP/IP Demonstration');

      // Assert there were no runtime page errors during initial render (e.g., SyntaxError/ReferenceError/TypeError)
      // We observe pageErrors that may have been captured during navigation; expect none
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Event: ViewDemo and transition S0_Idle -> S1_DemoDisplayed', () => {
    test('Clicking the demo button appends a new paragraph with TCP/IP demonstration text', async ({ page }) => {
      // This test validates the transition triggered by the "ViewDemo" event.
      // It checks that a new paragraph is appended to the page and contains the expected demonstration text.
      const app = new TcpIpPage(page);

      // Count paragraphs before the click (the page contains many <p> elements already)
      const beforeCount = await app.countParagraphs();

      // Perform the event (user clicks the demo button)
      await app.clickDemoButton();

      // After clicking, a new paragraph should be appended. Wait for the count to increase by 1.
      const expectedCount = beforeCount + 1;
      // Wait for the DOM change that appends a new paragraph
      await page.waitForFunction(
        (sel, expected) => document.querySelectorAll(sel).length === expected,
        {},
        'body p',
        expectedCount
      );

      // Verify the new paragraph was added and contains the TCP/IP demo text
      const lastText = await app.getLastParagraphText();
      expect(typeof lastText).toBe('string');
      expect(lastText).toMatch(/TCP\/IP Model/i);
      expect(lastText).toMatch(/Network Layer/i);

      // Ensure the button still exists and is interactive after transition
      await expect(app.getDemoButton()).toBeVisible();

      // Ensure no page errors of types ReferenceError/SyntaxError/TypeError were thrown during the click handling
      const criticalErrors = pageErrors.filter(err =>
        ['ReferenceError', 'TypeError', 'SyntaxError'].includes(err.name)
      );
      expect(criticalErrors.length).toBe(0);
    });

    test('Clicking the demo button multiple times appends multiple paragraphs (idempotent behavior)', async ({ page }) => {
      // This test checks edge-case behavior: multiple clicks should append multiple paragraphs,
      // demonstrating the transition action executes on every event trigger.
      const app = new TcpIpPage(page);

      const beforeCount = await app.countParagraphs();

      // Click the button three times rapidly to simulate repeated user actions
      await Promise.all([
        app.clickDemoButton(),
        app.clickDemoButton(),
        app.clickDemoButton()
      ]);

      // Expect 3 new paragraphs appended
      const expectedCount = beforeCount + 3;
      await page.waitForFunction(
        (sel, expected) => document.querySelectorAll(sel).length === expected,
        {},
        'body p',
        expectedCount
      );

      const finalCount = await app.countParagraphs();
      expect(finalCount).toBe(expectedCount);

      // Validate last appended paragraph contains the demo text
      const lastText = await app.getLastParagraphText();
      expect(lastText).toMatch(/TCP\/IP Model/i);

      // Assert that no page errors were recorded during the rapid interactions
      const criticalErrors = pageErrors.filter(err =>
        ['ReferenceError', 'TypeError', 'SyntaxError'].includes(err.name)
      );
      expect(criticalErrors.length).toBe(0);
    });
  });

  test.describe('Visual and DOM verification for S1_DemoDisplayed', () => {
    test('After transition, verify the new paragraph is appended to the end of the body and accessible', async ({ page }) => {
      // This test verifies the expected observable from the transition: "A new paragraph ... is added to the page."
      const app = new TcpIpPage(page);

      const beforeCount = await app.countParagraphs();

      // Trigger the display
      await app.clickDemoButton();

      const expectedCount = beforeCount + 1;
      await page.waitForFunction(
        (sel, expected) => document.querySelectorAll(sel).length === expected,
        {},
        'body p',
        expectedCount
      );

      // The appended paragraph should be the last <p> in the body
      const lastParagraphLocator = page.locator('body p').nth(expectedCount - 1);
      await expect(lastParagraphLocator).toBeVisible();

      const lastText = await lastParagraphLocator.textContent();
      expect(lastText).toContain('The TCP/IP model is a conceptual framework');

      // Confirm that the DOM operation that appends the element (document.body.appendChild) effectively placed it in the DOM
      const lastIsLastChild = await page.evaluate(() => {
        const ps = document.querySelectorAll('body p');
        if (ps.length === 0) return false;
        const last = ps[ps.length - 1];
        return document.body.lastElementChild === last;
      });
      expect(lastIsLastChild).toBe(true);
    });
  });

  test.describe('Error and console observation (observability tests)', () => {
    test('No unexpected console.error messages or page runtime exceptions should have occurred', async ({ page }) => {
      // This test observes console messages and page errors captured during navigation and interactions.
      // It asserts there were no console.error messages and no critical runtime errors.

      const app = new TcpIpPage(page);

      // Trigger an interaction to exercise event handlers
      await app.clickDemoButton();

      // Short wait to ensure all async console messages emitted are captured
      await page.waitForTimeout(200);

      // Filter console messages for errors
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');

      // Assert there are no console.error messages
      expect(consoleErrors.length).toBe(0);

      // Assert there were no page errors (unhandled exceptions)
      const criticalErrors = pageErrors.filter(err =>
        ['ReferenceError', 'TypeError', 'SyntaxError'].includes(err.name)
      );
      expect(criticalErrors.length).toBe(0);

      // If any console messages exist, ensure they are not errors and log them within the test output for debugging
      const nonErrorConsoleMessages = consoleMessages.filter((m) => m.type !== 'error');
      // We assert that any non-error messages are allowed; at minimum, assert that the console capture worked
      expect(consoleMessages).toBeInstanceOf(Array);
      // Optionally ensure no surprising message types (there could be warnings); we allow them but the capture must exist
      expect(nonErrorConsoleMessages.length + consoleErrors.length).toEqual(consoleMessages.length);
    });

    test('Report any captured page errors as part of assertions (if present)', async ({ page }) => {
      // This test will explicitly fail if any captured page errors exist, providing their stack and message.
      // It ensures the test suite remains aware of runtime exceptions thrown by the application.
      const app = new TcpIpPage(page);
      await app.clickDemoButton();
      await page.waitForTimeout(100);

      if (pageErrors.length > 0) {
        // Fail the test with a descriptive message including error names and messages
        const summaries = pageErrors.map((e, i) => `${i + 1}) ${e.name}: ${e.message}`).join('\n');
        // Use expect.fail via throwing an Error to include details
        throw new Error(`Page errors were captured during the test:\n${summaries}`);
      }

      // If no errors, explicitly assert zero
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('Rapid sequential clicks do not cause uncaught exceptions and always append paragraphs', async ({ page }) => {
      // This test simulates a user rapidly clicking the button many times and verifies consistent behavior.
      const app = new TcpIpPage(page);

      const beforeCount = await app.countParagraphs();

      // Rapidly click the button 10 times sequentially
      for (let i = 0; i < 10; i++) {
        await app.clickDemoButton();
      }

      const expectedCount = beforeCount + 10;
      // Wait until all 10 appended paragraphs appear (allow slightly longer timeout)
      await page.waitForFunction(
        (sel, expected) => document.querySelectorAll(sel).length === expected,
        { timeout: 5000 },
        'body p',
        expectedCount
      );

      const finalCount = await app.countParagraphs();
      expect(finalCount).toBe(expectedCount);

      // Assert no page errors of critical types occurred
      const criticalErrors = pageErrors.filter(err =>
        ['ReferenceError', 'TypeError', 'SyntaxError'].includes(err.name)
      );
      expect(criticalErrors.length).toBe(0);
    });

    test('Button remains functional after many appends and the page remains responsive', async ({ page }) => {
      // This test ensures the button continues to work after many appended paragraphs.
      const app = new TcpIpPage(page);

      // Append some paragraphs first
      const initial = await app.countParagraphs();
      for (let i = 0; i < 5; i++) {
        await app.clickDemoButton();
      }

      const afterMany = await app.countParagraphs();
      expect(afterMany).toBe(initial + 5);

      // Now click once more and validate one more paragraph appears
      await app.clickDemoButton();
      const expected = afterMany + 1;
      await page.waitForFunction(
        (sel, expected) => document.querySelectorAll(sel).length === expected,
        {},
        'body p',
        expected
      );

      expect(await app.countParagraphs()).toBe(expected);
      await expect(app.getDemoButton()).toBeVisible();

      // Ensure there are no critical runtime errors
      const criticalErrors = pageErrors.filter(err =>
        ['ReferenceError', 'TypeError', 'SyntaxError'].includes(err.name)
      );
      expect(criticalErrors.length).toBe(0);
    });
  });
});