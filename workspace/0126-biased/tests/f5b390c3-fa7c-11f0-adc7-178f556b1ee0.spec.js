import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b390c3-fa7c-11f0-adc7-178f556b1ee0.html';

/**
 * Page Object for the Garbage Collection example page.
 * Captures console messages and page errors for assertions.
 */
class GarbageCollectionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    /** @type {{type: string, text: string}[]} */
    this.consoleMessages = [];
    /** @type {Error[]} */
    this.pageErrors = [];

    // Attach listeners to capture console logs and page errors.
    this.page.on('console', (msg) => {
      // Normalize console output capture
      try {
        this.consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // If reading msg.text() throws, capture minimal info
        this.consoleMessages.push({ type: msg.type(), text: String(msg) });
      }
    });

    this.page.on('pageerror', (err) => {
      // Capture the actual Error object for detailed assertions
      this.pageErrors.push(err);
    });
  }

  // Navigate to the application page and wait for load
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Click the Run Garbage Collection button
  async clickRunButton() {
    await this.page.click('#garbage-collection-button');
  }

  // Helper to wait for a console message that includes the provided substring
  async waitForConsoleMessage(substring, { timeout = 2000 } = {}) {
    const pollInterval = 50;
    const maxTime = Date.now() + timeout;
    while (Date.now() < maxTime) {
      if (this.consoleMessages.some((m) => m.text.includes(substring))) {
        return;
      }
      // small sleep
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, pollInterval));
    }
    throw new Error(`Timed out waiting for console message including: "${substring}"`);
  }

  // Helper to count console messages containing a substring
  countConsoleMessagesContaining(substring) {
    return this.consoleMessages.filter((m) => m.text.includes(substring)).length;
  }
}

// Group related tests
test.describe('Garbage Collection Application (f5b390c3-fa7c-11f0-adc7-178f556b1ee0)', () => {
  // Increase timeout for slow environments
  test.setTimeout(15000);

  // Basic setup/teardown per test: new page is provided by Playwright fixture
  test.beforeEach(async ({ page }) => {
    // No-op here; each test will construct its own page object and navigate
    // kept for clarity and possible extension
  });

  // Test the Idle state (S0_Idle)
  test.describe('Initial State - S0_Idle', () => {
    test('button exists with correct label and page structure is present', async ({ page }) => {
      // Arrange
      const app = new GarbageCollectionPage(page);

      // Act
      await app.goto();

      // Assert - button exists and visible
      const button = page.locator('#garbage-collection-button');
      await expect(button).toBeVisible();
      await expect(button).toHaveText('Run Garbage Collection');

      // Assert - check some static content on the page to ensure UIs loads
      await expect(page.locator('h1')).toHaveText('Garbage Collection');
      await expect(page.locator('h2')).toContainText('Garbage Collection Algorithm');

      // Assert - initial console logs from inline script executed on load include expected messages
      // The inline script logs x and s values; expect to see '10' and 'Hello, World!'
      // Wait briefly to ensure console events are flushed
      await app.waitForConsoleMessage('10');
      await app.waitForConsoleMessage('Hello, World!');

      expect(app.consoleMessages.some((m) => m.text.includes('10'))).toBeTruthy();
      expect(app.consoleMessages.some((m) => m.text.includes('Hello, World!'))).toBeTruthy();
    });

    test('FSM "Page loaded" entry action is NOT present in the implementation (assert absence)', async ({ page }) => {
      // This validates that the FSM expected "Page loaded" console.log on entry
      // is not present in the actual HTML/JS (we must not modify the page)
      const app = new GarbageCollectionPage(page);
      await app.goto();

      // Wait a moment to capture any console logs
      await new Promise((r) => setTimeout(r, 200));

      // Assert that there is no console message "Page loaded"
      const found = app.consoleMessages.some((m) => m.text.includes('Page loaded'));
      expect(found).toBeFalsy();
    });
  });

  // Test transitions and the Garbage Collection process (S1)
  test.describe('Transitions and Events - RunGarbageCollection', () => {
    test('click triggers "Garbage collection started..." and "Garbage collection completed."', async ({ page }) => {
      // This validates the S0 -> S1 transition and S1 exit action that logs completion.
      const app = new GarbageCollectionPage(page);
      await app.goto();

      // Sanity check: ensure initial logs present
      await app.waitForConsoleMessage('10');
      await app.waitForConsoleMessage('Hello, World!');

      // Click the Run Garbage Collection button
      await app.clickRunButton();

      // Wait for both expected logs
      await app.waitForConsoleMessage('Garbage collection started...');
      await app.waitForConsoleMessage('Garbage collection completed.');

      // Verify order: 'started' should appear before 'completed' in captured console messages
      const startedIndex = app.consoleMessages.findIndex((m) => m.text.includes('Garbage collection started...'));
      const completedIndex = app.consoleMessages.findIndex((m) => m.text.includes('Garbage collection completed.'));
      expect(startedIndex).toBeGreaterThanOrEqual(0);
      expect(completedIndex).toBeGreaterThanOrEqual(0);
      expect(startedIndex).toBeLessThan(completedIndex);
    });

    test('multiple clicks produce repeated start and completed logs', async ({ page }) => {
      // Edge case: clicking multiple times should produce repeated logs for start and completion
      const app = new GarbageCollectionPage(page);
      await app.goto();

      // Click twice with small delay
      await app.clickRunButton();
      await app.waitForConsoleMessage('Garbage collection started...');
      await app.waitForConsoleMessage('Garbage collection completed.');

      // Click again
      await app.clickRunButton();

      // Wait for second round of logs
      await app.waitForConsoleMessage('Garbage collection started...');
      await app.waitForConsoleMessage('Garbage collection completed.');

      // Count occurrences; expect at least 2 of each
      const starts = app.countConsoleMessagesContaining('Garbage collection started...');
      const completeds = app.countConsoleMessagesContaining('Garbage collection completed.');
      expect(starts).toBeGreaterThanOrEqual(2);
      expect(completeds).toBeGreaterThanOrEqual(2);
    });
  });

  // Edge cases and error scenarios
  test.describe('Edge Cases and Runtime Errors', () => {
    test('no uncaught page errors during load and interaction', async ({ page }) => {
      // This test observes page errors that might surface as ReferenceError/SyntaxError/TypeError, etc.
      // Per instructions we must let them happen naturally and assert their presence/absence.
      const app = new GarbageCollectionPage(page);
      await app.goto();

      // Interact with the page to exercise runtime logic
      await app.clickRunButton();

      // Wait briefly for any asynchronous runtime exceptions to appear
      await new Promise((r) => setTimeout(r, 200));

      // Assert that there are no uncaught page errors.
      // If errors do exist, fail the test and print them for debugging.
      if (app.pageErrors.length > 0) {
        // Compose a helpful message with error details
        const details = app.pageErrors.map((e, i) => `Error[${i}]: ${e.toString()}\n${e.stack || ''}`).join('\n---\n');
        // Fail with details
        throw new Error(`Unexpected page errors were captured:\n${details}`);
      }

      expect(app.pageErrors.length).toBe(0);
    });

    test('validate behavior if button is clicked without page scripts (sanity edge check)', async ({ page }) => {
      // This test intentionally does not modify the runtime environment but attempts to click the button
      // and verifies that the page behaves consistently. It's an edge-case sanity check.
      const app = new GarbageCollectionPage(page);
      await app.goto();

      // Ensure button exists
      await expect(page.locator('#garbage-collection-button')).toBeVisible();

      // Click the button repeatedly under a short interval to ensure event handler is robust
      for (let i = 0; i < 3; i += 1) {
        await app.clickRunButton();
      }

      // Wait for expected logs at least once
      await app.waitForConsoleMessage('Garbage collection started...');
      await app.waitForConsoleMessage('Garbage collection completed.');

      // If there were errors, they would have been captured in pageErrors
      expect(app.pageErrors.length).toBe(0);
    });
  });

  // Final test summarizing captured console content and demonstrating traceability
  test('console trace contains expected sequence of logs from load and interactions', async ({ page }) => {
    // This test collects logs and asserts that the sequence includes load-time logs and click-time logs.
    const app = new GarbageCollectionPage(page);
    await app.goto();

    // Wait for initial logs
    await app.waitForConsoleMessage('10');
    await app.waitForConsoleMessage('Hello, World!');

    // Click once
    await app.clickRunButton();

    // Wait for GC logs
    await app.waitForConsoleMessage('Garbage collection started...');
    await app.waitForConsoleMessage('Garbage collection completed.');

    // Build a join of console texts for a human-readable assertion
    const joined = app.consoleMessages.map((m) => m.text).join(' | ');

    // Assert that the joined log contains the expected fragments in order (not necessarily contiguous)
    const has10 = joined.includes('10');
    const hasHello = joined.includes('Hello, World!');
    const hasStarted = joined.includes('Garbage collection started...');
    const hasCompleted = joined.includes('Garbage collection completed.');

    expect(has10).toBeTruthy();
    expect(hasHello).toBeTruthy();
    expect(hasStarted).toBeTruthy();
    expect(hasCompleted).toBeTruthy();

    // Also assert ordering: first occurrence of '10' should be before first 'Garbage collection started...'
    const first10 = app.consoleMessages.findIndex((m) => m.text.includes('10'));
    const firstStarted = app.consoleMessages.findIndex((m) => m.text.includes('Garbage collection started...'));
    expect(first10).toBeGreaterThanOrEqual(0);
    expect(firstStarted).toBeGreaterThanOrEqual(0);
    expect(first10).toBeLessThan(firstStarted);
  });
});