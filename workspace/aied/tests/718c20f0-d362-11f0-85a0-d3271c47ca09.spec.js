import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/718c20f0-d362-11f0-85a0-d3271c47ca09.html';

// Page Object for the Recursion app
class RecursionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.consoleErrors = [];
    this.pageErrors = [];
    // attach listeners to capture runtime information for assertions
    this.page.on('console', (msg) => {
      // store both text and type for richer assertions
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') {
        this.consoleErrors.push(msg.text());
      }
    });
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getHeadingText() {
    return this.page.textContent('h1');
  }

  async getParagraphText() {
    return this.page.textContent('p');
  }

  async getButton() {
    return this.page.$("button[onclick='recursiveCall()']");
  }

  async getButtonText() {
    const btn = await this.getButton();
    if (!btn) return null;
    return btn.textContent();
  }

  async getButtonOnclickAttribute() {
    const btn = await this.getButton();
    if (!btn) return null;
    return btn.getAttribute('onclick');
  }

  async clickRecursive() {
    const btn = await this.getButton();
    if (!btn) throw new Error('Recursive Call button not found');
    await btn.click();
  }

  // Utility to wait a small amount for logs/errors to propagate
  async waitForActivity(ms = 200) {
    await this.page.waitForTimeout(ms);
  }

  // Helpers to expose captured logs/errors
  getConsoleTexts() {
    return this.consoleMessages.map((m) => m.text);
  }

  getConsoleLogsOnly() {
    return this.consoleMessages.filter((m) => m.type === 'log').map((m) => m.text);
  }

  getConsoleErrorTexts() {
    return this.consoleErrors.slice();
  }

  getPageErrors() {
    return this.pageErrors.slice();
  }
}

test.describe('Recursion Interactive Application - FSM tests', () => {
  // Setup/teardown handled by Playwright fixtures; each test gets a fresh page
  test('Initial Idle State: page loads and Idle evidence is present', async ({ page }) => {
    // This test validates the initial "Idle" state (S0_Idle) per FSM:
    // - page loads
    // - button with onclick="recursiveCall()" is present (evidence for Idle)
    // - no uncaught page errors occurred during load
    const app = new RecursionPage(page);
    await app.goto();

    // Basic sanity checks
    const heading = await app.getHeadingText();
    expect(heading).toBeTruthy();
    expect(heading.trim()).toBe('Recursion');

    const paragraph = await app.getParagraphText();
    expect(paragraph).toContain('This is an example of recursion');

    // Verify the button exists and its onclick attribute matches the FSM evidence
    const btnText = await app.getButtonText();
    expect(btnText.trim()).toBe('Recursive Call');

    const onclickAttr = await app.getButtonOnclickAttribute();
    expect(onclickAttr).toBe('recursiveCall()');

    // Wait briefly to ensure any synchronous page errors are captured
    await app.waitForActivity(100);

    // Assert that no uncaught page errors occurred on initial load
    const pageErrors = app.getPageErrors();
    expect(pageErrors.length).toBe(0);
  });

  test('Transition: clicking Recursive Call executes recursiveCall() and logs base values', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_RecursiveCall:
    // - clicking the button triggers recursiveCall()
    // - console.log(base) is invoked multiple times with expected values (1 then zeros)
    // - no uncaught ReferenceError/SyntaxError/TypeError occurred as a result
    const app = new RecursionPage(page);
    await app.goto();

    // Click the Recursive Call button once
    await app.clickRecursive();

    // Wait to allow console logs to be emitted
    await app.waitForActivity(300);

    const logs = app.getConsoleLogsOnly();
    // Expect 10 console.log calls per the implementation: i from 0..9
    expect(logs.length).toBeGreaterThanOrEqual(1);
    // The first logged value should be '1' (base initial value)
    expect(logs[0]).toBe('1');

    // After first iteration, base becomes 0, so subsequent logs should be '0'
    const subsequent = logs.slice(1);
    // There should be at least 9 further logs; check they are '0' where present.
    for (const msg of subsequent) {
      expect(msg).toBe('0');
    }

    // Ensure no uncaught runtime errors were recorded on the page object
    const pageErrors = app.getPageErrors();
    // If there are any page errors, surface them in the test failure with details
    expect(pageErrors.length).toBe(0);
  });

  test('FSM observable: console.log(base) is used as evidence of state entry', async ({ page }) => {
    // This test specifically asserts that the expected observable "console.log(base);"
    // occurs when transitioning to S1_RecursiveCall.
    const app = new RecursionPage(page);
    await app.goto();

    await app.clickRecursive();
    await app.waitForActivity(200);

    const logs = app.getConsoleLogsOnly();
    // Confirm at least one console log exists and is numeric (string form)
    expect(logs.length).toBeGreaterThan(0);
    for (const text of logs) {
      // console.log used numeric values in the implementation; ensure parsable
      expect(text.trim()).toMatch(/^\d+$/);
    }
  });

  test('Edge case: multiple clicks should accumulate logs and remain stable', async ({ page }) => {
    // This test checks idempotency/stability when the user triggers the event repeatedly.
    const app = new RecursionPage(page);
    await app.goto();

    // Click twice in quick succession
    await app.clickRecursive();
    await app.clickRecursive();

    // Wait a bit for asynchronous console propagation
    await app.waitForActivity(400);

    const logs = app.getConsoleLogsOnly();
    // Each click produces ~10 logs. After two clicks we expect at least 20 logs.
    expect(logs.length).toBeGreaterThanOrEqual(20);

    // Check pattern: every sequence of 10 logs should start with '1' then zeros
    // We'll verify the first two sequences' first log is '1'
    expect(logs[0]).toBe('1');
    expect(logs[10]).toBe('1');
  });

  test('Error monitoring: detect any ReferenceError, SyntaxError, or TypeError during interactions', async ({ page }) => {
    // This test intentionally monitors for common JS error types.
    // Per instructions we must observe errors naturally and assert their presence/absence.
    // The application as provided is expected to run without such exceptions; assert none occurred.
    const app = new RecursionPage(page);
    await app.goto();

    // Interact with the app
    await app.clickRecursive();
    await app.waitForActivity(200);

    const pageErrors = app.getPageErrors();
    // If any page error exists, ensure it's not a ReferenceError/SyntaxError/TypeError.
    // We fail if we see any of these specific error types.
    for (const err of pageErrors) {
      const name = err.name || '';
      expect(['ReferenceError', 'SyntaxError', 'TypeError']).not.toContain(name);
    }

    // Also check console.error outputs for those names
    const consoleErrorTexts = app.getConsoleErrorTexts();
    for (const txt of consoleErrorTexts) {
      // If an error stack or message contains these keywords, fail the test
      expect(txt).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
    }

    // Final assertion: application should not have thrown any such runtime errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrorTexts.length).toBe(0);
  });

  test('Sanity: button styling and accessibility checks (visual/DOM validations)', async ({ page }) => {
    // This test validates the visual/DOM aspects related to the component evidence:
    // - button exists and has reasonable dimensions/styles applied (CSS is present in page)
    const app = new RecursionPage(page);
    await app.goto();

    const btn = await app.getButton();
    expect(btn).toBeTruthy();

    // Assert computed width is present and greater than zero (visual rendering check)
    const box = await btn.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThan(0);
      expect(box.height).toBeGreaterThan(0);
    }

    // Ensure the button is visible and enabled
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
  });
});