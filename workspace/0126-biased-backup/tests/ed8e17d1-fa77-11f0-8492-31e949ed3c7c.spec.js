import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8e17d1-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object for the application to encapsulate interactions and queries
class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startButton = page.locator('#startButton');
    this.grid = page.locator('#grid');
    this.cells = this.grid.locator('.cell');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for main UI to be ready: the start button should be visible
    await expect(this.startButton).toBeVisible();
  }

  async clickStart() {
    await this.startButton.click();
  }

  async getCellCount() {
    return await this.cells.count();
  }

  async getCellValues() {
    // returns array of strings of textContent of each cell in document order
    return await this.cells.allTextContents();
  }

  async isGridEmpty() {
    const count = await this.getCellCount();
    return count === 0;
  }

  async getStartButtonText() {
    return await this.startButton.innerText();
  }
}

test.describe('Dynamic Programming Visualization - FSM tests', () => {
  let page;
  let app;
  // Arrays to collect console messages and page errors during tests
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    // Create a fresh context/page for each test to avoid state leakage
    const context = await browser.newContext();
    page = await context.newPage();

    // initialize collectors
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Listen to console events
    page.on('console', (msg) => {
      // Capture all console messages and separately track errors
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // Listen to page runtime errors
    page.on('pageerror', (err) => {
      // err is an Error object with message and stack
      pageErrors.push(err);
    });

    app = new AppPage(page);
    await app.goto();
  });

  test.afterEach(async () => {
    // close page context to free resources
    await page.context().close();
  });

  test('S0_Idle: initial render shows Start Visualization button and empty grid', async () => {
    // Validate the initial (Idle) state as described in FSM S0_Idle

    // The start button should exist and have the correct label
    await expect(app.startButton).toBeVisible();
    const btnText = await app.getStartButtonText();
    expect(btnText).toBe('Start Visualization');

    // The grid should be present and initially empty (no .cell children)
    const empty = await app.isGridEmpty();
    expect(empty).toBe(true);

    // Ensure initial DOM evidence elements exist per FSM extraction
    // (#startButton and #grid existence already implied by locators)
    await expect(page.locator('#grid')).toBeVisible();

    // Assert that there were no runtime errors during initial page load
    // This verifies that entry actions (renderPage() in FSM) did not produce errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('S1_Visualizing: clicking Start Visualization triggers fibonacci(10) and renders expected cells', async () => {
    // This test validates the transition from Idle to Visualizing when the user clicks the start button.

    // Click the start button to trigger transition
    await app.clickStart();

    // As fibonacci(10) appends cells for i = 2..10 inclusive, expect 9 cells
    await expect(app.cells).toHaveCount(9, { timeout: 2000 });

    // Validate the sequence of Fibonacci numbers rendered in order
    const values = await app.getCellValues();
    // Expected sequence for fib[2]..fib[10] given fib[0]=0, fib[1]=1
    const expected = ['1', '2', '3', '5', '8', '13', '21', '34', '55'];
    expect(values).toEqual(expected);

    // Ensure that clicking again clears the previous grid and re-renders (no accumulation)
    await app.clickStart();
    // Immediately check that the count is still exactly 9 (grid cleared then re-populated)
    await expect(app.cells).toHaveCount(9, { timeout: 2000 });
    const values2 = await app.getCellValues();
    expect(values2).toEqual(expected);

    // Confirm that no page errors or console errors were emitted during this interaction
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: rapid consecutive clicks do not accumulate cells and always result in expected visualization', async () => {
    // This test simulates pressing the Start button multiple times quickly to ensure idempotent behavior.

    // click the start button rapidly three times
    await Promise.all([
      app.startButton.click(),
      app.startButton.click(),
      app.startButton.click()
    ]);

    // The implementation clears grid and then calls fibonacci(10) on each click.
    // After rapid clicks, the final state should still be exactly 9 cells (the last invocation's result).
    await expect(app.cells).toHaveCount(9, { timeout: 3000 });
    const values = await app.getCellValues();
    const expected = ['1', '2', '3', '5', '8', '13', '21', '34', '55'];
    expect(values).toEqual(expected);

    // Verify no runtime page errors were recorded
    expect(pageErrors.length).toBe(0);

    // Optionally assert that console did not receive error-level logs
    expect(consoleErrors.length).toBe(0);
  });

  test('Behavioral and observational checks: DOM updates and animations exist for appended cells', async () => {
    // Validate DOM-level changes and presence of animation on cells (where possible).
    // We cannot introspect the animation objects directly via the page's variable scope here,
    // but we can assert that appended elements have the expected class and computed styles exist.

    // Start the visualization
    await app.clickStart();

    // Ensure cells exist
    await expect(app.cells).toHaveCount(9, { timeout: 2000 });

    // Inspect the first cell element for expected class and non-empty text
    const firstCell = app.cells.nth(0);
    await expect(firstCell).toHaveClass(/cell/);
    const firstText = await firstCell.innerText();
    expect(firstText).toBe('1');

    // Check some computed style properties to ensure the cell is visible and styled
    const background = await firstCell.evaluate((el) => {
      return window.getComputedStyle(el).getPropertyValue('background-color');
    });
    // background-color should be present (the exact value may differ across browsers), so assert it's non-empty
    expect(background).not.toBe('');

    // Also ensure that the element is attached to the document
    const isConnected = await firstCell.evaluate((el) => el.isConnected);
    expect(isConnected).toBe(true);

    // No runtime errors expected
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Monitoring console and page errors across interactions (observability tests)', async () => {
    // This test focuses on collecting console messages and page errors while interacting with the app
    // and asserting expected observability outcomes.

    // Perform normal operations
    await app.clickStart();
    await expect(app.cells).toHaveCount(9, { timeout: 2000 });

    // Interact again
    await app.clickStart();
    await expect(app.cells).toHaveCount(9, { timeout: 2000 });

    // At this point, collect the captured console messages and page errors
    // Ensure there are no unexpected runtime errors emitted by the page
    // If the implementation had bugs (ReferenceError, TypeError, SyntaxError), they would be present in pageErrors or consoleErrors
    expect(pageErrors.length).toBe(0, `Unexpected page runtime errors: ${pageErrors.map(e => e && e.message).join('; ')}`);
    expect(consoleErrors.length).toBe(0, `Unexpected console errors: ${consoleErrors.join('; ')}`);

    // For debugging and transparency (but not required), assert that console messages (if any) are non-error types
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleEntries.length).toBe(0);

    // And assert that there is at least one informational or debug log or no logs at all (non-failing)
    // This is permissive because the app does not necessarily log to console.
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});