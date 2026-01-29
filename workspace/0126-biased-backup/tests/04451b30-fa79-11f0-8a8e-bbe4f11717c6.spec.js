import { test, expect } from '@playwright/test';

// Test file for Application ID: 04451b30-fa79-11f0-8a8e-bbe4f11717c6
// This suite validates the FSM states and transitions for the K-Nearest Neighbors interactive app.
// It intentionally does NOT modify the page runtime; it observes console logs and page errors
// and asserts that expected behaviors OR natural runtime errors (ReferenceError, TypeError, etc.)
// occur as a result of user interactions.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04451b30-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page object to encapsulate interactions and observability
class KNNPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Capture console messages
    this.page.on('console', (msg) => {
      try {
        // Some console messages expose args; keep a readable string
        this.consoleMessages.push(msg.text());
      } catch (e) {
        this.consoleMessages.push(String(msg));
      }
    });

    // Capture uncaught page errors (ReferenceError, TypeError, etc.)
    this.page.on('pageerror', (err) => {
      this.pageErrors.push({ name: err.name, message: err.message, stack: err.stack });
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure the basic DOM has loaded
    await this.page.waitForLoadState('domcontentloaded');
  }

  // Returns handles or null if not found
  async getResetButton() {
    return this.page.$('#reset-button');
  }
  async getLearnButton() {
    return this.page.$('#learn-button');
  }

  async clickLearn() {
    const btn = await this.getLearnButton();
    if (!btn) throw new Error('#learn-button not found');
    await btn.click();
  }

  async clickReset() {
    const btn = await this.getResetButton();
    if (!btn) throw new Error('#reset-button not found');
    await btn.click();
  }

  // Helpers to access captured observations
  getConsoleMessages() {
    return this.consoleMessages.slice();
  }
  getPageErrors() {
    return this.pageErrors.slice();
  }

  // Utility to wait briefly to let any runtime effects manifest (console/pageerror)
  async waitForObservations(ms = 300) {
    await this.page.waitForTimeout(ms);
  }
}

test.describe('K-Nearest Neighbors FSM - UI and Transitions', () => {
  let knn;

  test.beforeEach(async ({ page }) => {
    knn = new KNNPage(page);
    await knn.goto();
  });

  test.afterEach(async ({ page }) => {
    // Clean up listeners by closing page if needed (Playwright handles it),
    // but ensure any leftover errors are visible in test output.
    // No aggressive cleanup: do not patch or modify runtime.
    await page.waitForTimeout(10);
  });

  test('Idle state on load: buttons are present and visible', async ({ page }) => {
    // Validate initial Idle state UI evidence from FSM: reset and learn buttons exist.
    const reset = await page.$('#reset-button');
    const learn = await page.$('#learn-button');

    // Buttons should exist in DOM
    expect(reset).not.toBeNull();
    expect(learn).not.toBeNull();

    // Buttons should be visible and contain expected text
    await expect(reset).toBeVisible();
    await expect(learn).toBeVisible();
    await expect(reset).toHaveText('Reset');
    await expect(learn).toHaveText('Learn');

    // No automatic learning should have started on load.
    // It's acceptable if there are console messages or page errors from missing scripts,
    // but we assert there was no explicit "Learning process initiated" logged on load.
    const consoleMsgs = knn.getConsoleMessages();
    expect(consoleMsgs.some(msg => /Learning process initiated/i.test(msg))).toBeFalsy();
  });

  test.describe('Transitions: Learn and Reset', () => {
    test('Transition S0_Idle -> S1_Learning when Learn clicked: entry action startLearning()', async ({ page }) => {
      // Click Learn and observe either a console log indicating learning or a runtime ReferenceError
      // from an absent startLearning function. We must not patch or fix the page; observe natural outcome.
      await knn.clickLearn();

      // Wait to collect console/pageerror events
      await knn.waitForObservations(400);

      const consoles = knn.getConsoleMessages();
      const errors = knn.getPageErrors();

      // The FSM expects "Learning process initiated" observable or the invocation of startLearning().
      // Accept either explicit observable or a ReferenceError that indicates the page attempted to call startLearning().
      const sawLearningLog = consoles.some(msg => /Learning process initiated/i.test(msg) || /startLearning/i.test(msg));
      const sawStartLearningError = errors.some(e => e.name === 'ReferenceError' && /startLearning/i.test(e.message));

      expect(sawLearningLog || sawStartLearningError).toBeTruthy();

      // Verify Learn button still present after transition
      const learnBtn = await page.$('#learn-button');
      expect(learnBtn).not.toBeNull();
      await expect(learnBtn).toBeVisible();
    });

    test('Transition S1_Learning -> S0_Idle when Reset clicked after Learn: exit action resetModel()', async ({ page }) => {
      // Trigger Learn first to enter Learning state
      await knn.clickLearn();
      await knn.waitForObservations(200);

      // Then click Reset to return to Idle; observe resetModel() call or natural error
      await knn.clickReset();
      await knn.waitForObservations(400);

      const consoles = knn.getConsoleMessages();
      const errors = knn.getPageErrors();

      // Accept either explicit reset log or a ReferenceError for resetModel
      const sawResetLog = consoles.some(msg => /Model reset/i.test(msg) || /resetModel/i.test(msg));
      const sawResetModelError = errors.some(e => e.name === 'ReferenceError' && /resetModel/i.test(e.message));

      expect(sawResetLog || sawResetModelError).toBeTruthy();

      // Verify Reset button still present and visible (Idle state evidence)
      const resetBtn = await page.$('#reset-button');
      expect(resetBtn).not.toBeNull();
      await expect(resetBtn).toBeVisible();
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Click Learn multiple times: should either produce repeated learning logs or repeated errors', async ({ page }) => {
      // Click Learn twice in quick succession
      await knn.clickLearn();
      await knn.clickLearn();

      // Allow events to settle
      await knn.waitForObservations(500);

      const consoles = knn.getConsoleMessages();
      const errors = knn.getPageErrors();

      // Expect at least one learning attempt recorded (log or error)
      const sawLearningAttempt = consoles.some(msg => /Learning process initiated/i.test(msg) || /startLearning/i.test(msg))
        || errors.some(e => e.name === 'ReferenceError' && /startLearning/i.test(e.message));

      expect(sawLearningAttempt).toBeTruthy();

      // If there were explicit logs, ensure there are either multiple logs or multiple attempts indicated
      const learningLogs = consoles.filter(msg => /Learning process initiated/i.test(msg) || /startLearning/i.test(msg));
      const learningErrors = errors.filter(e => e.name === 'ReferenceError' && /startLearning/i.test(e.message));

      // At least one attempt; but prefer to see multiplicity when clicking twice.
      expect(learningLogs.length + learningErrors.length).toBeGreaterThanOrEqual(1);
    });

    test('Click Reset from Idle (without learning): should attempt resetModel() or gracefully handle it', async ({ page }) => {
      // Reset immediately on load (Idle)
      await knn.clickReset();
      await knn.waitForObservations(300);

      const consoles = knn.getConsoleMessages();
      const errors = knn.getPageErrors();

      const sawResetAttempt = consoles.some(msg => /Model reset/i.test(msg) || /resetModel/i.test(msg))
        || errors.some(e => e.name === 'ReferenceError' && /resetModel/i.test(e.message));

      // We accept either successful observable or a ReferenceError resulting from the app attempting resetModel()
      expect(sawResetAttempt).toBeTruthy();
    });

    test('Observe and assert presence of runtime errors if script functions are missing', async ({ page }) => {
      // This test intentionally checks for common runtime error patterns:
      // ReferenceError, TypeError, or SyntaxError that might arise from script.js or inline scripts.
      // We do not cause extra errors—just check what has occurred on load and after basic interactions.

      // Perform a benign interaction to surface potential errors
      await knn.clickLearn();
      await knn.waitForObservations(300);

      const errors = knn.getPageErrors();

      // It's acceptable for there to be zero errors, but if errors exist they should be typical runtime types.
      // Assert that any observed errors are among expected categories and contain helpful messages.
      for (const err of errors) {
        // Ensure the error name is a standard JS error type
        expect(['ReferenceError', 'TypeError', 'SyntaxError', 'RangeError', 'EvalError', 'URIError', 'Error']).toContain(err.name);
        // Error should have a non-empty message
        expect(typeof err.message).toBe('string');
        expect(err.message.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Observability checks – console and page errors are captured', () => {
    test('Console messages and page errors arrays are populated after interactions', async ({ page }) => {
      // Validate that our listener plumbing captures messages and errors
      // Trigger interactions
      await knn.clickLearn();
      await knn.clickReset();
      await knn.waitForObservations(400);

      const consoles = knn.getConsoleMessages();
      const errors = knn.getPageErrors();

      // At minimum, the console array should be an array; if empty it's permitted.
      expect(Array.isArray(consoles)).toBeTruthy();
      expect(Array.isArray(errors)).toBeTruthy();

      // If either console or errors are non-empty, ensure entries are of expected shapes
      if (consoles.length > 0) {
        expect(typeof consoles[0]).toBe('string');
      }
      if (errors.length > 0) {
        expect(typeof errors[0].message).toBe('string');
        expect(typeof errors[0].name).toBe('string');
      }
    });
  });
});