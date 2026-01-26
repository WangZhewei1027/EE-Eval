import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3b3d64-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object representing the app UI controls and helpful interactions
class BPlusTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.keyInput = page.locator('input#keyInput');
    this.orderInput = page.locator('input#orderInput');
    this.treeContainer = page.locator('#treeContainer');

    this.insertButton = page.locator('button', { hasText: 'Insert' });
    this.deleteButton = page.locator('button', { hasText: 'Delete' });
    this.searchButton = page.locator('button', { hasText: 'Search' });
    this.randomButton = page.locator('button', { hasText: 'Random Tree' });
    this.clearButton = page.locator('button', { hasText: 'Clear' });
  }

  // Sets the key input value (as a string or number)
  async setKey(value) {
    await this.keyInput.fill(String(value));
  }

  // Reads visible text inside the tree container
  async treeHtml() {
    return this.treeContainer.innerHTML();
  }

  // Convenience click helpers
  async clickInsert() { await this.insertButton.click(); }
  async clickDelete() { await this.deleteButton.click(); }
  async clickSearch() { await this.searchButton.click(); }
  async clickRandom() { await this.randomButton.click(); }
  async clickClear() { await this.clearButton.click(); }
}

test.describe('B+ Tree Visualization - FSM and UI surface tests', () => {
  let page;
  let app;
  let capturedPageErrors;
  let capturedConsoleErrors;

  // Utility to normalize an "error event" from either pageerror (Error) or console (ConsoleMessage)
  function extractErrorMessage(ev) {
    if (!ev) return '';
    // Playwright's pageerror provides an Error-like object
    if (ev instanceof Error || typeof ev.message === 'string') {
      return (ev.message || String(ev)).toString();
    }
    // ConsoleMessage
    if (typeof ev.text === 'function') {
      return ev.text();
    }
    return String(ev);
  }

  // Setup a fresh page and capture console/page errors for each test
  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();

    capturedPageErrors = [];
    capturedConsoleErrors = [];

    // Capture runtime errors and console error messages (do this before navigation so load-time errors are captured)
    page.on('pageerror', (err) => {
      capturedPageErrors.push(err);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        capturedConsoleErrors.push(msg);
      }
    });

    // Navigate to the app (do not attempt to patch or change the page)
    await page.goto(APP_URL, { waitUntil: 'load' });

    app = new BPlusTreePage(page);
  });

  test.afterEach(async () => {
    if (page) {
      await page.context().close();
    }
  });

  // Helper that clicks a selector and awaits an error event (pageerror or console error).
  // It starts waiters first, then performs the click, and waits for the first error to occur.
  async function clickAndAwaitError(clickFn) {
    // Start listeners for the next error events
    const pageErrorPromise = page.waitForEvent('pageerror', { timeout: 3000 }).catch(() => null);
    const consoleErrorPromise = page.waitForEvent('console', {
      predicate: (m) => m.type() === 'error',
      timeout: 3000
    }).catch(() => null);

    // Perform the click action that should trigger an event
    await clickFn();

    // Wait for whichever error appears first
    const ev = await Promise.race([pageErrorPromise, consoleErrorPromise]);
    return ev;
  }

  test('Initial load: page renders Idle state elements and load-time errors are captured', async () => {
    // This verifies the S0_Idle evidence: the title should be present
    const title = await page.locator('h1').innerText();
    expect(title).toContain('B+ Tree Visualization');

    // The order input should be present and default to "4"
    await expect(app.orderInput).toHaveValue('4');

    // The tree container should exist in the DOM (even if empty)
    const treeHtml = await app.treeHtml();
    expect(treeHtml).toBeDefined();

    // Assert that the page captured at least one error (script appears truncated in provided HTML)
    const totalErrors = capturedPageErrors.length + capturedConsoleErrors.length;
    expect(totalErrors).toBeGreaterThan(0);

    // Check that among captured errors there is a SyntaxError/ReferenceError/TypeError
    const combinedTexts = [
      ...capturedPageErrors.map((e) => extractErrorMessage(e)),
      ...capturedConsoleErrors.map((m) => extractErrorMessage(m))
    ].join('\n');

    const hasExpectedError = /(SyntaxError|ReferenceError|TypeError)/i.test(combinedTexts);
    expect(hasExpectedError).toBeTruthy();
  });

  // Tests for FSM transitions: Insert, Delete, Search, RandomTree, Clear
  test.describe('FSM event handlers produce expected (error) behaviours when invoked', () => {
    test('InsertKey event: clicking Insert should attempt to call insertKey() and produce an error', async () => {
      // Prepare a valid key
      await app.setKey(42);

      // Record pre-click error counts
      const beforeCount = capturedPageErrors.length + capturedConsoleErrors.length;

      // Click Insert and await an error event
      const ev = await clickAndAwaitError(async () => await app.clickInsert());
      expect(ev).not.toBeNull();

      // Validate that the error message indicates a runtime problem (e.g., ReferenceError)
      const text = extractErrorMessage(ev);
      const matches = /(ReferenceError|TypeError|SyntaxError|insertKey)/i.test(text);
      expect(matches).toBeTruthy();

      // Confirm that we recorded at least one new error after the click
      const afterCount = capturedPageErrors.length + capturedConsoleErrors.length;
      expect(afterCount).toBeGreaterThanOrEqual(beforeCount + 1);
    });

    test('DeleteKey event: clicking Delete should attempt to call deleteKey() and produce an error', async () => {
      // Set a key to delete (may be unused in this broken runtime)
      await app.setKey(42);

      const beforeCount = capturedPageErrors.length + capturedConsoleErrors.length;
      const ev = await clickAndAwaitError(async () => await app.clickDelete());
      expect(ev).not.toBeNull();

      const text = extractErrorMessage(ev);
      const matches = /(ReferenceError|TypeError|SyntaxError|deleteKey)/i.test(text);
      expect(matches).toBeTruthy();

      const afterCount = capturedPageErrors.length + capturedConsoleErrors.length;
      expect(afterCount).toBeGreaterThanOrEqual(beforeCount + 1);
    });

    test('SearchKey event: clicking Search should attempt to call searchKey() and produce an error', async () => {
      await app.setKey(7);

      const beforeCount = capturedPageErrors.length + capturedConsoleErrors.length;
      const ev = await clickAndAwaitError(async () => await app.clickSearch());
      expect(ev).not.toBeNull();

      const text = extractErrorMessage(ev);
      const matches = /(ReferenceError|TypeError|SyntaxError|searchKey)/i.test(text);
      expect(matches).toBeTruthy();

      const afterCount = capturedPageErrors.length + capturedConsoleErrors.length;
      expect(afterCount).toBeGreaterThanOrEqual(beforeCount + 1);
    });

    test('RandomTree event: clicking Random Tree should attempt to call randomTree() and produce an error', async () => {
      const beforeCount = capturedPageErrors.length + capturedConsoleErrors.length;
      const ev = await clickAndAwaitError(async () => await app.clickRandom());
      expect(ev).not.toBeNull();

      const text = extractErrorMessage(ev);
      const matches = /(ReferenceError|TypeError|SyntaxError|randomTree)/i.test(text);
      expect(matches).toBeTruthy();

      const afterCount = capturedPageErrors.length + capturedConsoleErrors.length;
      expect(afterCount).toBeGreaterThanOrEqual(beforeCount + 1);
    });

    test('ClearTree event: clicking Clear should attempt to call clearTree() and produce an error', async () => {
      // Simulate moving to S1_TreeUpdated by attempting an update first (which itself may error)
      // This is an exploration of the S1 -> S0 transition.
      // Attempt to trigger a tree update (randomTree), ignore its error here (we assert afterwards).
      const moveEv = await clickAndAwaitError(async () => await app.clickRandom());
      expect(moveEv).not.toBeNull();

      // Now click Clear and expect an error as well (clearTree likely undefined)
      const beforeClear = capturedPageErrors.length + capturedConsoleErrors.length;
      const ev = await clickAndAwaitError(async () => await app.clickClear());
      expect(ev).not.toBeNull();

      const text = extractErrorMessage(ev);
      const matches = /(ReferenceError|TypeError|SyntaxError|clearTree)/i.test(text);
      expect(matches).toBeTruthy();

      const afterCount = capturedPageErrors.length + capturedConsoleErrors.length;
      expect(afterCount).toBeGreaterThanOrEqual(beforeClear + 1);
    });
  });

  test.describe('Edge cases and negative inputs', () => {
    test('Inserting an empty key: clicking Insert with empty input should still be handled (likely error)', async () => {
      // Ensure key input is empty
      await app.setKey('');
      const before = capturedPageErrors.length + capturedConsoleErrors.length;
      const ev = await clickAndAwaitError(async () => await app.clickInsert());
      expect(ev).not.toBeNull();

      const text = extractErrorMessage(ev);
      // Expect either a JS runtime error or something indicating the missing input handler
      expect(/(ReferenceError|TypeError|SyntaxError|insertKey)/i.test(text)).toBeTruthy();

      const after = capturedPageErrors.length + capturedConsoleErrors.length;
      expect(after).toBeGreaterThanOrEqual(before + 1);
    });

    test('Inserting a negative key value (violates min): the UI allows setting it; clicking Insert should attempt insertion and produce an error', async () => {
      // Even though input min=0, programmatic set is allowed
      await app.setKey(-5);
      const before = capturedPageErrors.length + capturedConsoleErrors.length;
      const ev = await clickAndAwaitError(async () => await app.clickInsert());
      expect(ev).not.toBeNull();

      const text = extractErrorMessage(ev);
      expect(/(ReferenceError|TypeError|SyntaxError|insertKey)/i.test(text)).toBeTruthy();

      const after = capturedPageErrors.length + capturedConsoleErrors.length;
      expect(after).toBeGreaterThanOrEqual(before + 1);
    });
  });

  test('DOM sanity checks: control elements exist and have the expected attributes', async () => {
    // Confirm presence of key input and that it is numeric-type
    const keyType = await page.getAttribute('input#keyInput', 'type');
    expect(keyType).toBe('number');

    // Confirm order input min/max attributes
    const min = await page.getAttribute('input#orderInput', 'min');
    const max = await page.getAttribute('input#orderInput', 'max');
    expect(min).toBe('3');
    expect(max).toBe('7');

    // Buttons should exist
    await expect(app.insertButton).toBeVisible();
    await expect(app.deleteButton).toBeVisible();
    await expect(app.searchButton).toBeVisible();
    await expect(app.randomButton).toBeVisible();
    await expect(app.clearButton).toBeVisible();
  });
});