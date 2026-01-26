import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04436d85-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page Object for the Thread page to encapsulate interactions and error collection
class ThreadPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.pageErrors = []; // captures pageerror events (uncaught exceptions)
    this.consoleErrors = []; // captures console.error messages
    this._pageErrorListener = (err) => {
      try {
        // pageerror gives Error object; capture message and stack
        const msg = err && err.message ? err.message : String(err);
        this.pageErrors.push({ message: msg, stack: err.stack || '' });
      } catch (e) {
        this.pageErrors.push({ message: String(err) });
      }
    };
    this._consoleListener = (msg) => {
      try {
        if (msg.type() === 'error') {
          // Join args for better information
          const text = msg.text();
          this.consoleErrors.push({ text, location: msg.location() });
        }
      } catch (e) {
        // ignore listener errors
      }
    };

    this.page.on('pageerror', this._pageErrorListener);
    this.page.on('console', this._consoleListener);
  }

  async dispose() {
    // remove listeners to avoid leaks
    try {
      this.page.removeListener('pageerror', this._pageErrorListener);
      this.page.removeListener('console', this._consoleListener);
    } catch (e) {
      // ignore
    }
  }

  // Navigate to the app URL
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Count visible .thread elements in the DOM
  async countThreads() {
    return await this.page.$$eval('.thread', (els) => els.length);
  }

  // Click the Add Thread button
  async clickAddThread() {
    await this.page.click('#add-thread-btn');
  }

  // Click the Delete Thread button
  async clickDeleteThread() {
    await this.page.click('#delete-thread-btn');
  }

  // Returns array of captured page error messages
  getPageErrorMessages() {
    return this.pageErrors.map((e) => e.message || e.text || '');
  }

  // Returns array of captured console error texts
  getConsoleErrorTexts() {
    return this.consoleErrors.map((c) => c.text || '');
  }

  // Utility to wait for an error (pageerror or console.error) that contains a substring.
  // Polls the captured arrays for up to timeoutMs milliseconds.
  async waitForErrorContaining(substring, timeoutMs = 2000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      // Check page errors
      for (const e of this.pageErrors) {
        if (String(e.message).includes(substring)) {
          return { type: 'pageerror', message: e.message };
        }
      }
      // Check console errors
      for (const c of this.consoleErrors) {
        if (String(c.text).includes(substring)) {
          return { type: 'console', message: c.text };
        }
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return null;
  }

  // Wait for any error to be captured (pageerror or console.error). Useful when we just expect some error.
  async waitForAnyError(timeoutMs = 2000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.pageErrors.length > 0 || this.consoleErrors.length > 0) {
        return {
          pageErrors: this.getPageErrorMessages(),
          consoleErrors: this.getConsoleErrorTexts(),
        };
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return null;
  }
}

test.describe.describe = 'Thread FSM - Add/Delete Thread interactions and runtime errors';

// Group: State verification
test.describe('Idle State and UI presence', () => {
  let threadPage;

  test.beforeEach(async ({ page }) => {
    threadPage = new ThreadPage(page);
    await threadPage.goto();
  });

  test.afterEach(async () => {
    await threadPage.dispose();
  });

  test('Initial Idle state: Add and Delete buttons exist and initial thread present', async () => {
    // Validate the page loaded and the expected Idle state's evidence is present
    // This test ensures the initial DOM contains the Add and Delete buttons and at least one thread
    const addButton = await threadPage.page.$('#add-thread-btn');
    const deleteButton = await threadPage.page.$('#delete-thread-btn');

    expect(addButton).not.toBeNull();
    expect(deleteButton).not.toBeNull();

    // Check button text content
    const addText = await threadPage.page.$eval('#add-thread-btn', (el) => el.textContent?.trim());
    const deleteText = await threadPage.page.$eval('#delete-thread-btn', (el) => el.textContent?.trim());
    expect(addText).toBe('Add Thread');
    expect(deleteText).toBe('Delete Thread');

    // There should be at least one .thread element as the FSM's Idle state evidence
    const initialThreads = await threadPage.countThreads();
    expect(initialThreads).toBeGreaterThanOrEqual(1);
  });
});

// Group: Events and transitions
test.describe('Events/Transitions: AddThread and DeleteThread', () => {
  let threadPage;

  test.beforeEach(async ({ page }) => {
    threadPage = new ThreadPage(page);
    await threadPage.goto();
  });

  test.afterEach(async () => {
    await threadPage.dispose();
  });

  test('AddThread event: clicking Add Thread triggers addThread() (or causes runtime error) and updates DOM accordingly', async () => {
    // Capture state before the action
    const beforeCount = await threadPage.countThreads();

    // Click the Add Thread button
    await threadPage.clickAddThread();

    // Observe errors: per instructions we must observe and assert that errors occur naturally.
    // Wait for an error containing 'addThread' in either pageerror or console.error
    const detected = await threadPage.waitForErrorContaining('addThread', 2000);

    // Assert that an error mentioning addThread occurred. This follows the requirement to let ReferenceError/TypeError happen naturally and assert it.
    expect(detected, 'Expected a runtime error referencing addThread() to occur on click').not.toBeNull();
    expect(detected.message).toContain('addThread');

    // Additionally verify DOM transition behavior: since a runtime error occurred, the DOM likely did not change.
    const afterCount = await threadPage.countThreads();
    // When the handler is missing and invoked, it's common for the action to fail before mutating DOM.
    // Therefore we assert that the thread count did not increase.
    expect(afterCount).toBe(beforeCount);
  });

  test('DeleteThread event: clicking Delete Thread triggers deleteThread() (or causes runtime error) and updates DOM accordingly', async () => {
    // Ensure at least one thread exists prior to delete
    const beforeCount = await threadPage.countThreads();
    expect(beforeCount).toBeGreaterThanOrEqual(1);

    // Click the Delete Thread button
    await threadPage.clickDeleteThread();

    // Wait for an error mentioning deleteThread to appear
    const detected = await threadPage.waitForErrorContaining('deleteThread', 2000);

    // Assert that an error mentioning deleteThread occurred
    expect(detected, 'Expected a runtime error referencing deleteThread() to occur on click').not.toBeNull();
    expect(detected.message).toContain('deleteThread');

    // After the failed handler, the DOM should remain unchanged (no deletion)
    const afterCount = await threadPage.countThreads();
    expect(afterCount).toBe(beforeCount);
  });

  test('Edge case: double-click Add Thread rapidly should still surface runtime errors for addThread()', async () => {
    // Rapidly click Add twice
    const beforeCount = await threadPage.countThreads();

    await Promise.all([
      threadPage.page.click('#add-thread-btn'),
      threadPage.page.click('#add-thread-btn'),
    ]);

    // Wait for any error referencing addThread
    const detected = await threadPage.waitForErrorContaining('addThread', 2000);
    expect(detected, 'Expected at least one runtime error referencing addThread() after rapid clicks').not.toBeNull();
    expect(detected.message).toContain('addThread');

    // Ensure no unexpected DOM growth (since handler failed)
    const afterCount = await threadPage.countThreads();
    expect(afterCount).toBe(beforeCount);
  });

  test('Edge case: delete until nothing left and observe behavior / errors', async () => {
    // Keep attempting to delete threads until none left OR until we observe expected errors.
    // This test validates behavior when deleting multiple times and checks for runtime errors.
    let currentCount = await threadPage.countThreads();
    // Try up to 3 deletions to be safe
    for (let i = 0; i < 3; i++) {
      await threadPage.clickDeleteThread();
      // Wait briefly for any errors to surface
      const anyError = await threadPage.waitForAnyError(500);
      // If we captured any error, ensure it references deleteThread
      if (anyError) {
        const combined = (anyError.pageErrors || []).concat(anyError.consoleErrors || []);
        const joined = combined.join(' ');
        expect(joined.toLowerCase()).toContain('deletethread');
        // After an error, DOM should remain stable
        const newCount = await threadPage.countThreads();
        expect(newCount).toBe(currentCount);
        return;
      }
      // If no errors captured, re-evaluate count; if deletion occurred, decrement expectation
      const newCount = await threadPage.countThreads();
      if (newCount < currentCount) {
        // deletion succeeded; update currentCount and continue
        currentCount = newCount;
      } else {
        // no change and no error - unexpected given FSM expects deleteThread(); record but continue
        // break to avoid infinite loop
        break;
      }
    }

    // If we reach here, either deletes occurred successfully (no runtime errors),
    // or no errors occurred and DOM unchanged. The FSM expects deleteThread action; however,
    // per instruction we must assert observed runtime errors. So explicitly check collected errors exist.
    const errors = threadPage.getPageErrorMessages().concat(threadPage.getConsoleErrorTexts());
    expect(errors.length).toBeGreaterThan(0);
    // At least one of the errors should reference deleteThread
    const hasDeleteRef = errors.some((e) => String(e).includes('deleteThread'));
    expect(hasDeleteRef).toBe(true);
  });
});

// Group: Runtime error observation on load (script loading/runtime errors)
test.describe('Runtime errors and console observations', () => {
  let threadPage;

  test.beforeEach(async ({ page }) => {
    threadPage = new ThreadPage(page);
    await threadPage.goto();
  });

  test.afterEach(async () => {
    await threadPage.dispose();
  });

  test('Page load may emit runtime errors (missing script or syntax errors) - capture them', async () => {
    // Some implementations might fail at load (e.g., missing script.js leads to console error).
    // We wait briefly for any load-time errors and assert that we capture them.
    const anyError = await threadPage.waitForAnyError(1500);
    // Based on instructions, we should assert that errors occur naturally.
    // So we expect there to be at least one error (either console or pageerror) captured.
    expect(anyError, 'Expected at least one console or page error during initial load').not.toBeNull();

    // Ensure captured errors provide diagnostic information
    const errors = threadPage.getPageErrorMessages().concat(threadPage.getConsoleErrorTexts());
    expect(errors.length).toBeGreaterThan(0);

    // Log the first captured error to the test output (helps debugging when tests fail)
    // (No console.log here per instructions, but we do assert that messages are non-empty)
    const first = errors[0];
    expect(first && first.length).toBeGreaterThanOrEqual(1);
  });
});