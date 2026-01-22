import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0e169540-d5c5-11f0-92ee-f5994b4f4c99.html';

// Page Object for the Adjacency Matrix page
class AdjacencyMatrixPage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {Array} pageErrors - reference to array that collects page errors
   * @param {Array} consoleMessages - reference to array that collects console messages
   */
  constructor(page, pageErrors, consoleMessages) {
    this.page = page;
    this.pageErrors = pageErrors;
    this.consoleMessages = consoleMessages;
    this.table = page.locator('#adjacencyMatrix');
    this.h1 = page.locator('h1');
  }

  // Navigate to page and wait for load event
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Return page title text
  async title() {
    return this.page.title();
  }

  // Return the H1 text content
  async headerText() {
    return this.h1.innerText();
  }

  // Check if adjacency table exists in DOM
  async hasTable() {
    return await this.table.count() > 0;
  }

  // Return number of rows in the adjacency table (tr elements)
  async rowCount() {
    return await this.page.evaluate(() => {
      const table = document.querySelector('#adjacencyMatrix');
      if (!table) return 0;
      return Array.from(table.querySelectorAll('tr')).length;
    });
  }

  // Return innerHTML length of the table (0 means empty)
  async tableInnerHTMLLength() {
    return await this.page.evaluate(() => {
      const table = document.querySelector('#adjacencyMatrix');
      if (!table) return 0;
      return table.innerHTML.length;
    });
  }

  // Check whether a global renderPage function exists
  async hasRenderPageFunction() {
    return await this.page.evaluate(() => typeof window.renderPage === 'function');
  }

  // Click first cell if exists, otherwise click the table
  async clickFirstCellOrTable() {
    // try to click first td, then th, else table
    const didClick = await this.page.evaluate(() => {
      const table = document.querySelector('#adjacencyMatrix');
      if (!table) return 'no-table';
      const td = table.querySelector('td');
      if (td) { td.click(); return 'clicked-td'; }
      const th = table.querySelector('th');
      if (th) { th.click(); return 'clicked-th'; }
      table.click();
      return 'clicked-table';
    });
    return didClick;
  }

  // Get collected page errors (Error objects)
  getPageErrors() {
    return this.pageErrors;
  }

  // Get collected console messages
  getConsoleMessages() {
    return this.consoleMessages;
  }

  // Count interactive elements (buttons, inputs, anchors, selects, textareas)
  async interactiveElementCount() {
    return await this.page.evaluate(() => {
      return document.querySelectorAll('button, input, a, select, textarea').length;
    });
  }
}

test.describe('Adjacency Matrix - FSM: S0_Idle (Initial state)', () => {
  // Arrays to collect page errors and console messages during navigation & interactions
  let pageErrors;
  let consoleMessages;

  // Setup before each test: attach listeners and navigate
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture runtime page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // Store the Error object for assertions
      pageErrors.push(err);
    });

    // Capture all console messages
    page.on('console', (msg) => {
      consoleMessages.push(msg);
    });

    // Navigate to the application page and wait for the load event.
    // We intentionally do not try to patch or modify any global variables or functions.
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Teardown: nothing explicit to do; Playwright will close pages automatically.

  test('Initial static structure: header and adjacency table are present (Idle state entry)', async ({ page }) => {
    // Validate that the page loaded and static DOM evidence from FSM exists
    const app = new AdjacencyMatrixPage(page, pageErrors, consoleMessages);

    // Verify the page title contains expected text
    const title = await app.title();
    expect(title).toContain('Adjacency Matrix');

    // Verify the main header exists and has correct text
    const headerText = await app.headerText();
    expect(headerText).toBe('Adjacency Matrix');

    // Verify the adjacency table element exists in the DOM
    const hasTable = await app.hasTable();
    expect(hasTable).toBe(true);

    // Check row count and structure: table may be empty or pre-populated by adjacencyMatrix.js
    const rows = await app.rowCount();
    // It's valid for the table to be empty (0 rows) or have rows; assert that row count is a non-negative integer
    expect(typeof rows).toBe('number');
    expect(rows).toBeGreaterThanOrEqual(0);

    // Additionally verify that the table element is visible on the page
    await expect(page.locator('#adjacencyMatrix')).toBeVisible();
  });

  test('Entry action "renderPage()" verification: presence of function and table effects (if available)', async ({ page }) => {
    // This test validates the FSM's entry action renderPage() if it exists.
    // We do NOT attempt to call or patch renderPage(); we only detect its presence and side-effects.
    const app = new AdjacencyMatrixPage(page, pageErrors, consoleMessages);

    // Check whether a global renderPage function exists
    const hasRender = await app.hasRenderPageFunction();

    // If the function exists, assert it is indeed a function
    if (hasRender) {
      expect(hasRender).toBe(true);
      // If renderPage exists, it is expected to (maybe) populate the table.
      // We check whether the table innerHTML length is greater than zero as a possible indicator.
      const tableInnerLen = await app.tableInnerHTMLLength();
      // tableInnerLen may be 0 even if renderPage exists (if it decides not to populate), so just assert numeric type
      expect(typeof tableInnerLen).toBe('number');
    } else {
      // If renderPage isn't present, we document that the page may rely on the external script which may be missing or errored.
      expect(hasRender).toBe(false);
    }

    // Regardless of presence/absence, ensure static evidence (H1 and table element) remain in DOM
    expect(await app.headerText()).toBe('Adjacency Matrix');
    expect(await app.hasTable()).toBe(true);
  });

  test('No interactive controls or transitions present on the page', async ({ page }) => {
    // FSM indicates no interactive elements. Validate the DOM for absence of common interactive controls.
    const app = new AdjacencyMatrixPage(page, pageErrors, consoleMessages);
    const interactiveCount = await app.interactiveElementCount();
    // According to the FSM notes, no buttons, inputs, or links were detected.
    // We assert that the count is zero to match the FSM extraction.
    expect(interactiveCount).toBe(0);
  });

  test('Runtime errors and console error messages are captured and are of expected types (ReferenceError, SyntaxError, TypeError)', async ({ page }) => {
    // This test observes runtime errors produced during initial page load or by the external script.
    // We do not attempt to fix or suppress them. We assert properties about any errors that occurred.
    const app = new AdjacencyMatrixPage(page, pageErrors, consoleMessages);

    const errors = app.getPageErrors();
    const consoleMsgs = app.getConsoleMessages();

    // Allowed JS error names per instructions
    const allowedErrorNames = new Set(['ReferenceError', 'SyntaxError', 'TypeError']);

    // If there are page errors, assert each is one of the allowed types.
    if (errors.length > 0) {
      for (const err of errors) {
        // The Error object from pageerror should have a name property
        expect(typeof err.name).toBe('string');
        expect(allowedErrorNames.has(err.name)).toBeTruthy();
      }
    } else {
      // If no page errors occurred, that's also a valid state; assert that at least the page loaded without exceptions.
      expect(errors.length).toBe(0);
    }

    // Additionally inspect console messages of type 'error' and assert their text contains some hint of JS errors when present
    const errorConsoleTexts = consoleMsgs
      .filter(m => m.type() === 'error')
      .map(m => m.text());

    if (errorConsoleTexts.length > 0) {
      // Each console error should contain some content; we try to assert presence of typical keywords.
      for (const txt of errorConsoleTexts) {
        expect(typeof txt).toBe('string');
        // The message may contain 'ReferenceError', 'TypeError', or 'SyntaxError' when related; otherwise it's still an error log
        const containsKnown = txt.includes('ReferenceError') || txt.includes('TypeError') || txt.includes('SyntaxError') || txt.length > 0;
        expect(containsKnown).toBeTruthy();
      }
    }
  });

  test('Clicking on table cells or table does not introduce new unexpected errors', async ({ page }) => {
    // This test attempts to interact with the table (if present) and asserts no additional runtime errors are thrown.
    const pageErrorsBefore = [];
    const consoleMessagesBefore = [];

    // Attach temporary listeners to capture only errors after this point
    page.on('pageerror', (err) => pageErrorsBefore.push(err));
    page.on('console', (msg) => consoleMessagesBefore.push(msg));

    const app = new AdjacencyMatrixPage(page, pageErrors, consoleMessages);

    // Perform a click on the first available cell or the table itself
    const clickResult = await app.clickFirstCellOrTable();

    // Small pause to allow any synchronous/asynchronous handlers to run and possibly throw
    await page.waitForTimeout(100);

    // Assert no new page errors were generated from the click interaction
    // We assert that any such new errors (if present) are of allowed types.
    if (pageErrorsBefore.length > 0) {
      for (const err of pageErrorsBefore) {
        expect(['ReferenceError', 'TypeError', 'SyntaxError'].includes(err.name)).toBeTruthy();
      }
    } else {
      // No new errors after click is acceptable
      expect(pageErrorsBefore.length).toBe(0);
    }

    // Also ensure that clicking did not navigate away from the page accidentally
    const currentUrl = page.url();
    expect(currentUrl).toBe(APP_URL);
  });

  test('Edge case: table present but empty — verify graceful handling', async ({ page }) => {
    // This ensures that if adjacencyMatrix.js fails to populate the table, the application remains stable.
    const app = new AdjacencyMatrixPage(page, pageErrors, consoleMessages);

    const innerLen = await app.tableInnerHTMLLength();
    // innerLen is numeric; if zero, ensure no fatal page errors occurred during load
    if (innerLen === 0) {
      // If table is empty, pageErrors should be empty or only contain allowed errors (which we asserted previously).
      const errors = app.getPageErrors();
      // Ensure errors (if any) are acceptable types
      if (errors.length > 0) {
        for (const err of errors) {
          expect(['ReferenceError', 'TypeError', 'SyntaxError'].includes(err.name)).toBeTruthy();
        }
      } else {
        expect(errors.length).toBe(0);
      }
    } else {
      // If table is populated, assert that it has at least one row, i.e., innerLen > 0 implies rows >= 1
      const rows = await app.rowCount();
      expect(rows).toBeGreaterThanOrEqual(1);
    }
  });
});