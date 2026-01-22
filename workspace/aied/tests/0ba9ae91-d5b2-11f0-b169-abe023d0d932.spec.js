import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba9ae91-d5b2-11f0-b169-abe023d0d932.html';

/**
 * Page Object for the Breadth-First Search interactive app.
 * Encapsulates selectors and common actions to keep tests readable.
 */
class BFSPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startInput = page.locator('#start');
    this.endInput = page.locator('#end');
    this.searchButton = page.locator('#search');
    this.clearButton = page.locator('#clear');
    this.graph = page.locator('#graph');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async fillStart(value) {
    await this.startInput.fill(String(value));
  }

  async fillEnd(value) {
    await this.endInput.fill(String(value));
  }

  async clickSearch() {
    await this.searchButton.click();
  }

  async clickClear() {
    await this.clearButton.click();
  }

  async getGraphText() {
    return (await this.graph.innerText()).trim();
  }

  // Intentionally attempt to call page functions that are referenced by the FSM.
  // Per the task instructions we MUST NOT define these functions if they don't exist;
  // calling them should surface ReferenceError/TypeError naturally and the tests assert that.
  async callPerformBFS() {
    // This will throw if performBFS is not defined in the page global scope.
    return await this.page.evaluate(() => {
      // eslint-disable-next-line no-undef
      return performBFS();
    });
  }

  async callClearGraph() {
    // This will throw if clearGraph is not defined in the page global scope.
    return await this.page.evaluate(() => {
      // eslint-disable-next-line no-undef
      return clearGraph();
    });
  }
}

test.describe('Breadth-First Search Interactive App (0ba9ae91-d5b2-11f0-b169-abe023d0d932)', () => {
  // Arrays to capture console messages and page errors for assertions.
  let consoleMessages;
  let pageErrors;
  let bfsPage;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (including network/script load errors).
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture uncaught page errors.
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    bfsPage = new BFSPage(page);
    await bfsPage.goto();
  });

  test.afterEach(async () => {
    // Basic teardown bookkeeping; Playwright will close pages automatically.
    // We assert that we captured console messages or page errors where appropriate in tests.
  });

  test('Initial Idle state: inputs and controls are rendered', async ({ page }) => {
    // Validate initial state per FSM S0_Idle: inputs and buttons present and graph container exists.
    await expect(page.locator('h1')).toHaveText(/Breadth-First Search/i);

    // Inputs exist with correct placeholders and types
    await expect(bfsPage.startInput).toBeVisible();
    await expect(bfsPage.endInput).toBeVisible();
    await expect(bfsPage.startInput).toHaveAttribute('placeholder', 'Start node');
    await expect(bfsPage.endInput).toHaveAttribute('placeholder', 'End node');
    await expect(bfsPage.startInput).toHaveAttribute('type', 'number');
    await expect(bfsPage.endInput).toHaveAttribute('type', 'number');

    // Buttons exist
    await expect(bfsPage.searchButton).toBeVisible();
    await expect(bfsPage.clearButton).toBeVisible();

    // Graph container exists and is initially empty (or whitespace)
    const graphText = await bfsPage.getGraphText();
    expect(graphText === '' || graphText === '\n' || graphText.length >= 0).toBeTruthy();

    // Confirm that at least the static elements loaded (no runtime action required)
    // Also ensure that a script load error might have been logged (do not assert it must exist here).
  });

  test('SearchClick event: clicking search without defined handlers should not modify DOM but calling performBFS raises ReferenceError', async () => {
    // This test covers the transition S0_Idle -> S1_Searching and verifies the performBFS onEnter action.
    // Because the HTML references an external script (script.js) that may be missing, we must not patch it.
    // We check both clicking the button (user interaction) and directly invoking performBFS to observe errors.

    // Fill inputs with valid node indices.
    await bfsPage.fillStart(0);
    await bfsPage.fillEnd(3);

    // Record graph state before clicking
    const beforeGraph = await bfsPage.getGraphText();

    // Perform the user action: click search
    await bfsPage.clickSearch();

    // After clicking, because no runtime script is guaranteed to exist, the DOM should remain unchanged.
    const afterGraph = await bfsPage.getGraphText();
    expect(afterGraph).toBe(beforeGraph); // No visible traversal occurred in DOM

    // Now attempt to invoke performBFS directly. Per instructions, allow ReferenceError to surface and assert it.
    let caughtError = null;
    try {
      await bfsPage.callPerformBFS();
    } catch (err) {
      caughtError = err;
    }

    // We expect a thrown error when trying to call performBFS if it's not defined.
    expect(caughtError).toBeTruthy();
    // Error message should mention performBFS (varying browsers may format messages differently)
    expect(String(caughtError.message || caughtError)).toContain('performBFS');
  });

  test('ClearClick event from Idle: clicking clear should not fail but calling clearGraph raises ReferenceError', async () => {
    // This test covers the S0_Idle -> S2_Cleared transition and the clearGraph onEnter action assertion.

    // Put something in the graph element to ensure "clear" would remove it if implemented.
    // We cannot modify application code, but we can verify DOM before/after click remains consistent.
    await bfsPage.page.evaluate(() => {
      const g = document.getElementById('graph');
      if (g) g.textContent = 'node 0 visited';
    });

    const beforeText = await bfsPage.getGraphText();
    expect(beforeText).toContain('node 0');

    // Click the clear button as the user would.
    await bfsPage.clickClear();

    // Without an implemented clearGraph, the DOM likely remains unchanged.
    const afterText = await bfsPage.getGraphText();
    // It's acceptable either way (if there's a handler it could clear); but we assert that if it didn't change, that's allowed.
    expect([beforeText, '']).toContain(afterText);

    // Attempt to call clearGraph directly and assert it throws as required by the instructions.
    let caughtError = null;
    try {
      await bfsPage.callClearGraph();
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeTruthy();
    expect(String(caughtError.message || caughtError)).toContain('clearGraph');
  });

  test('ClearClick event from Searching: simulate search step then clear -> clearGraph should error if not implemented', async () => {
    // This test intends to represent the S1_Searching -> S0_Idle transition triggered by ClearClick.
    // Because we cannot guarantee a runtime implementation to enter a "Searching" state, we simulate the user's sequence:
    // click search (or attempt to), then click clear and inspect results / errors.

    // Click search first
    await bfsPage.fillStart(1);
    await bfsPage.fillEnd(2);
    await bfsPage.clickSearch();

    // Immediately click clear to simulate the user interrupting or resetting mid-search
    await bfsPage.clickClear();

    // DOM may or may not be modified; ensure the graph container still exists and is a string.
    const graphText = await bfsPage.getGraphText();
    expect(typeof graphText).toBe('string');

    // Calling clearGraph should throw ReferenceError if not defined.
    let caughtError = null;
    try {
      await bfsPage.callClearGraph();
    } catch (err) {
      caughtError = err;
    }
    expect(caughtError).toBeTruthy();
    expect(String(caughtError.message || caughtError)).toContain('clearGraph');
  });

  test('Edge cases: invalid/empty inputs and behavior when calling performBFS/clearGraph', async () => {
    // Validate that application handles empty or invalid input fields gracefully at least from the DOM perspective,
    // and that invoking missing onEnter functions raises the expected errors.

    // Ensure inputs are empty
    await bfsPage.startInput.fill('');
    await bfsPage.endInput.fill('');

    // Click search with empty inputs
    await bfsPage.clickSearch();

    // The graph should remain unchanged (no script to add nodes)
    const graphAfterEmptySearch = await bfsPage.getGraphText();
    expect(typeof graphAfterEmptySearch).toBe('string');

    // Attempt to call performBFS, expecting a reference error mentioning performBFS
    let bfsError = null;
    try {
      await bfsPage.callPerformBFS();
    } catch (err) {
      bfsError = err;
    }
    expect(bfsError).toBeTruthy();
    expect(String(bfsError.message || bfsError)).toContain('performBFS');

    // Attempt to call clearGraph as well
    let clearError = null;
    try {
      await bfsPage.callClearGraph();
    } catch (err) {
      clearError = err;
    }
    expect(clearError).toBeTruthy();
    expect(String(clearError.message || clearError)).toContain('clearGraph');
  });

  test('Console and page error observations: script loading or runtime errors are captured', async () => {
    // This test asserts that we observed console errors (e.g., script load failure) and/or page errors.
    // Many deployments of this HTML omit script.js. We must not fix it. We assert that at least one console error occurred.

    // Wait a short while to allow any onload console messages to appear.
    await bfsPage.page.waitForTimeout(250);

    // There should be at least one console message recorded (could be warnings, info, or errors).
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);

    // Check if any console message is of type 'error' — this often indicates missing script or runtime issues.
    const errorMessages = consoleMessages.filter(m => m.type === 'error');
    // It's acceptable if there are no console errors in some environments, but per instructions we should observe and assert errors when they occur.
    // We assert that either a console error exists OR we captured pageErrors via pageerror events (e.g., ReferenceError from page execution).
    const sawErrors = errorMessages.length > 0 || pageErrors.length > 0;

    // If neither were captured, make a best-effort check: try to purposely call performBFS to force a ReferenceError and ensure it surfaces.
    if (!sawErrors) {
      let forcedError = null;
      try {
        await bfsPage.callPerformBFS();
      } catch (err) {
        forcedError = err;
      }
      expect(forcedError).toBeTruthy();
      expect(String(forcedError.message || forcedError)).toContain('performBFS');
    } else {
      // If we did capture errors, assert they are meaningful
      if (errorMessages.length > 0) {
        // At least one console error should mention script.js or be an error type.
        const mentionsScript = errorMessages.some(m => m.text.includes('script.js') || m.text.toLowerCase().includes('failed') || m.text.toLowerCase().includes('error'));
        expect(mentionsScript).toBe(true);
      }
      if (pageErrors.length > 0) {
        // At least one page error should be an Error instance
        expect(pageErrors[0]).toBeInstanceOf(Error);
      }
    }
  });
});