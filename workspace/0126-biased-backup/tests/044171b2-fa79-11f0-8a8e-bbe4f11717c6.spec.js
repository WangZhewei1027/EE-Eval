import { test, expect } from '@playwright/test';

// Test file for Application ID: 044171b2-fa79-11f0-8a8e-bbe4f11717c6
// URL: http://127.0.0.1:5500/workspace/0126-biased/html/044171b2-fa79-11f0-8a8e-bbe4f11717c6.html
// This suite validates the FSM states and transitions for the Hash Table interactive application.
// Important: The application contains invalid CSS selectors in its inline script which will raise runtime errors.
// Per instructions, we do NOT patch the application; we observe and assert those errors naturally.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/044171b2-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page Object for interacting with the Hash Table page.
class HashTablePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.table = page.locator('.hash-table');
    this.header = page.locator('.hash-table-header');
    this.cells = page.locator('.hash-table-cell');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async countCells() {
    return await this.cells.count();
  }

  async getHeaderText() {
    return await this.header.textContent();
  }

  async getCellText(indexZeroBased) {
    return await this.cells.nth(indexZeroBased).textContent();
  }

  async clickCell(indexZeroBased) {
    await this.cells.nth(indexZeroBased).click();
  }
}

test.describe('Hash Table FSM - Application 044171b2-fa79-11f0-8a8e-bbe4f11717c6', () => {
  // Arrays to collect page errors and console messages for assertions.
  let pageErrors = [];
  let consoleMessages = [];

  // Handlers saved so we can remove them during teardown.
  let pageErrorHandler = null;
  let consoleHandler = null;

  // Set up listeners before each test and navigate to the page.
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect uncaught exceptions from the page (e.g., DOMException from invalid selectors).
    pageErrorHandler = (err) => {
      // The err is typically an Error object with a message property.
      pageErrors.push(err);
    };
    page.on('pageerror', pageErrorHandler);

    // Collect console messages (info, log, error, etc.)
    consoleHandler = (msg) => {
      // Record both text and type for better diagnostics in assertions.
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    };
    page.on('console', consoleHandler);

    // Navigate to the application. We register listeners before navigation
    // to ensure we capture any errors during initial script execution.
    const ht = new HashTablePage(page);
    await ht.goto();
  });

  // Remove listeners after each test to avoid cross-test contamination.
  test.afterEach(async ({ page }) => {
    if (pageErrorHandler) page.off('pageerror', pageErrorHandler);
    if (consoleHandler) page.off('console', consoleHandler);
    pageErrors = [];
    consoleMessages = [];
  });

  test('S0_Idle: Page renders the Hash Table (renderPage entry action)', async ({ page }) => {
    // This test validates the Idle state: page DOM elements are present as evidence of renderPage().
    // It also asserts that a runtime page error occurred due to invalid selectors in the inline script.
    const ht = new HashTablePage(page);

    // Verify the hash-table container exists and header text is correct.
    await expect(ht.table).toBeVisible();
    const headerText = (await ht.getHeaderText())?.trim();
    expect(headerText).toBe('Hash Table');

    // Verify there are 10 hash table cell elements rendered in the DOM.
    const count = await ht.countCells();
    expect(count).toBe(10);

    // Verify each cell's text matches the expected labels "Cell 1" .. "Cell 10".
    for (let i = 0; i < 10; i++) {
      const text = (await ht.getCellText(i))?.trim();
      expect(text).toBe(`Cell ${i + 1}`);
    }

    // The inline script contains invalid CSS selectors (e.g., ':second-child'), which should produce a page error.
    // Assert that at least one page error was captured.
    expect(pageErrors.length).toBeGreaterThan(0);

    // The error message should mention the invalid selector or DOMException; check for key substrings to be robust.
    const joinedMessages = pageErrors.map(e => String(e && e.message)).join(' | ');
    const containsInvalidSelector = joinedMessages.includes('second-child') ||
      joinedMessages.includes('not a valid selector') ||
      joinedMessages.includes('Failed to execute') ||
      joinedMessages.includes('DOMException');
    expect(containsInvalidSelector).toBeTruthy();

    // Ensure no "Cell X clicked!" console logs exist at initial render (no click handlers should have run at load).
    const clickLogs = consoleMessages.filter(m => /Cell \d+ clicked!/.test(m.text));
    expect(clickLogs.length).toBe(0);
  });

  test.describe('Cell click transitions (S1..S10) - attempt to trigger click handlers', () => {
    // For each cell we will attempt to click it and assert behavior.
    test('Attempt clicks on all cells and assert expected console logs and error behavior', async ({ page }) => {
      // This test iterates through all 10 cells, triggers click events, and asserts whether the expected
      // console log (e.g., "Cell 1 clicked!") appears. Because the page script contains invalid selectors
      // that throw during initial execution, the event handlers are likely not attached. We assert that
      // the absence of those console logs is correlated with the observed page error.
      const ht = new HashTablePage(page);

      // Confirm baseline: page error existed during load.
      expect(pageErrors.length).toBeGreaterThan(0);

      // Clear any console messages captured during navigation; we want to observe logs produced by clicks only.
      consoleMessages = [];

      const cellCount = await ht.countCells();
      expect(cellCount).toBe(10);

      for (let i = 0; i < cellCount; i++) {
        // Click the cell.
        await ht.clickCell(i);

        // Small delay to allow any potential console messages to be emitted.
        await page.waitForTimeout(50);

        // Capture console messages that mention this specific cell click.
        const expectedLog = `Cell ${i + 1} clicked!`;
        const found = consoleMessages.some(m => m.text === expectedLog);

        // Because the inline script likely failed before attaching handlers, the expected console output
        // will not be present. We assert that the expected log is NOT found and provide diagnostics if it is.
        expect(found).toBeFalsy();

        // Verify the DOM remains intact after the click (cells still present and labeled correctly).
        const textAfterClick = (await ht.getCellText(i))?.trim();
        expect(textAfterClick).toBe(`Cell ${i + 1}`);
      }

      // Finally, assert that no "Cell X clicked!" console messages were produced for any cell.
      const anyClickLogs = consoleMessages.filter(m => /Cell \d+ clicked!/.test(m.text));
      expect(anyClickLogs.length).toBe(0);
    });

    test('Edge case: clicking multiple times on a single cell does not produce logs when handlers are missing', async ({ page }) => {
      // This test validates clicking repeatedly does not magically attach handlers or produce logs.
      const ht = new HashTablePage(page);

      // Choose the third cell (index 2) for repeated clicks.
      const index = 2;
      consoleMessages = [];

      // Click several times.
      for (let i = 0; i < 5; i++) {
        await ht.clickCell(index);
        await page.waitForTimeout(30);
      }

      // No "Cell 3 clicked!" logs should appear due to the earlier script error preventing handler attachment.
      const found = consoleMessages.some(m => m.text === 'Cell 3 clicked!');
      expect(found).toBeFalsy();

      // Confirm the element text remains unchanged after repeated clicks.
      const text = (await ht.getCellText(index))?.trim();
      expect(text).toBe('Cell 3');
    });
  });

  test('Error scenario assertions: detailed diagnostics about the runtime error(s)', async ({ page }) => {
    // This test collects and asserts specifics about the thrown runtime errors to satisfy "observe console logs and page errors".
    // We assert that the page error references the invalid CSS pseudo-class syntax and that it prevented further script execution.
    // We also confirm that console messages do not contain any of the expected transition logs.

    // At least one page error should exist.
    expect(pageErrors.length).toBeGreaterThan(0);

    // Build a summary string of page error messages for easier assertions.
    const messages = pageErrors.map(e => (e && e.message) || String(e)).join('\n---\n');

    // Check for the presence of the invalid pseudo-class names mentioned in the implementation.
    // The inline script uses pseudo-classes like ":second-child", ":third-child", etc.
    const invalidPseudoDetected = [':second-child', ':third-child', ':fourth-child', ':fifth-child', ':sixth-child', ':seventh-child', ':eighth-child', ':ninth-child', ':tenth-child']
      .some(pseudo => messages.includes(pseudo));

    // Some browsers include a specific "not a valid selector" message; check for that as well.
    const notValidSelectorDetected = messages.includes('not a valid selector') || messages.includes('Failed to execute');

    expect(invalidPseudoDetected || notValidSelectorDetected).toBeTruthy();

    // Ensure that, because of the above errors, the console did not log any of the expected "Cell X clicked!" messages.
    const clickConsoleEntry = consoleMessages.find(m => /Cell \d+ clicked!/.test(m.text));
    expect(clickConsoleEntry).toBeUndefined();

    // Provide an additional sanity check: DOM still present and usable.
    const ht = new HashTablePage(page);
    await expect(ht.table).toBeVisible();
    expect(await ht.countCells()).toBe(10);
  });
});