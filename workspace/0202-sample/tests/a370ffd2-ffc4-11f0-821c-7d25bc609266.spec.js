import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a370ffd2-ffc4-11f0-821c-7d25bc609266.html';

// Simple Page Object for the DFS demo page
class DfsDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButtonSelector = '#runDfsBtn';
    this.outputSelector = '#demoOutput';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getRunButton() {
    return this.page.locator(this.runButtonSelector);
  }

  async getOutput() {
    return this.page.locator(this.outputSelector);
  }

  async clickRun() {
    await this.page.click(this.runButtonSelector);
  }

  // Returns the raw textContent of the output region
  async getOutputText() {
    return this.page.locator(this.outputSelector).textContent();
  }
}

test.describe('DFS Interactive Application - a370ffd2-ffc4-11f0-821c-7d25bc609266', () => {
  // Arrays to collect console messages and page errors during each test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  // Attach listeners before each test and navigate to the page
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages (info, log, warn, error, etc.)
    page.on('console', (msg) => {
      const payload = {
        type: msg.type(),
        text: msg.text()
      };
      consoleMessages.push(payload);
      if (msg.type() === 'error') {
        consoleErrors.push(payload);
      }
    });

    // Collect uncaught exceptions in the page context (pageerror)
    page.on('pageerror', (err) => {
      // err is an Error object with name and message
      pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack
      });
    });

    // Navigate to the application page exactly as-is
    await page.goto(APP_URL);
  });

  // Tear down: no special teardown needed, but assert general invariants if desired
  test.afterEach(async ({ page }) => {
    // Nothing to patch on the page; ensure we haven't left listeners leaking (they are per-page)
    // This is a good place to verify overall console error absence for tests that didn't expect errors,
    // but we do per-test assertions so keep this light.
    // Intentionally left blank to avoid modifying the tested environment.
  });

  test('S0_Idle: Page renders Idle state correctly (button and empty output)', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) entry actions and evidence:
    // - The Run DFS Demo button exists with expected attributes
    // - The output region exists, has appropriate ARIA attributes, and is initially empty

    const dfsPage = new DfsDemoPage(page);

    // Verify run button presence and attributes
    const runBtn = await dfsPage.getRunButton();
    await expect(runBtn).toBeVisible();
    await expect(runBtn).toHaveAttribute('aria-label', 'Run DFS demonstration');
    await expect(runBtn).toHaveClass(/btn-demo/);
    await expect(runBtn).toHaveText('Run DFS Demo');

    // Verify output region presence and ARIA attributes
    const output = await dfsPage.getOutput();
    await expect(output).toBeVisible();
    await expect(output).toHaveAttribute('aria-live', 'polite');
    await expect(output).toHaveAttribute('aria-atomic', 'true');
    await expect(output).toHaveAttribute('role', 'region');

    // Output should be empty initially (Idle state)
    const initialText = await dfsPage.getOutputText();
    // Some browsers may expose null for empty textContent; normalize to empty string
    expect(initialText ? initialText.trim() : '').toBe('');

    // Ensure no console errors and no uncaught page errors in the idle state
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S1_RunningDFS: Clicking Run DFS Demo transitions to Running state and displays traversal', async ({ page }) => {
    // This test validates the transition from S0_Idle -> S1_RunningDFS when the user clicks the Run button.
    // It asserts that the onEnter actions (render output text and call dfs) update the DOM accordingly.

    const dfsPage = new DfsDemoPage(page);

    // Click the run button to trigger the DFS demonstration
    await dfsPage.clickRun();

    // After clicking, the output region should contain the performing message and the traversal order
    const expectedStart = 'Performing DFS starting from node 0...';
    const expectedTraversal = 'Traversal order: 0 → 1 → 3 → 4 → 5 → 2';

    // Wait for the expected traversal text to appear in the output
    await expect(dfsPage.getOutput()).toContainText('Traversal order:');

    // Read the full output and verify exact segments. Normalizing whitespace to be robust.
    const outputText = (await dfsPage.getOutputText()) || '';
    expect(outputText).toContain(expectedStart);
    expect(outputText).toContain(expectedTraversal);

    // The traversal order should exactly match the expected order in sequence
    // (we check that the exact substring appears)
    expect(outputText.replace(/\s+/g, ' ').trim()).toContain('Traversal order: 0 → 1 → 3 → 4 → 5 → 2');

    // Ensure no uncaught page errors or console errors occurred during a normal run
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('dfs(start, graph) returns correct traversal order when invoked directly in page context', async ({ page }) => {
    // This test invokes the dfs function directly inside the page context to verify the algorithmic result
    // matches the FSM's expected observable: [0, 1, 3, 4, 5, 2]

    // Evaluate dfs(0, graph) inside the page and return the traversal array
    const traversal = await page.evaluate(() => {
      // Call the dfs function that is defined in the page script
      // This must not modify any globals — only calling the existing implementation.
      return window.dfs(0, window.graph);
    });

    // Validate the returned traversal order exactly matches expected sequence
    expect(traversal).toEqual([0, 1, 3, 4, 5, 2]);

    // No uncaught errors should have been emitted by simply evaluating the function
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Running the demo multiple times resets and re-runs producing consistent output', async ({ page }) => {
    // This test clicks the Run button multiple times to ensure the UI resets the output and the traversal is consistent.

    const dfsPage = new DfsDemoPage(page);

    // First run
    await dfsPage.clickRun();
    await expect(dfsPage.getOutput()).toContainText('Traversal order:');

    const outputAfterFirst = (await dfsPage.getOutputText()) || '';

    // Second run - should reset and produce the same content (the code sets textContent before computing)
    await dfsPage.clickRun();
    await expect(dfsPage.getOutput()).toContainText('Traversal order:');

    const outputAfterSecond = (await dfsPage.getOutputText()) || '';

    // Normalize whitespace and compare equality (should be identical content)
    const normalize = (s) => s.replace(/\s+/g, ' ').trim();
    expect(normalize(outputAfterSecond)).toBe(normalize(outputAfterFirst));

    // Double-check the traversal order is correct
    expect(outputAfterSecond).toContain('Traversal order: 0 → 1 → 3 → 4 → 5 → 2');

    // Ensure no uncaught page errors were produced by repeated runs
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: invoking dfs with an invalid start index triggers an in-page TypeError (observed as pageerror)', async ({ page }) => {
    // This test intentionally triggers an error by invoking the dfs function asynchronously
    // with a start node that does not exist in the graph. The page's dfs implementation
    // attempts to iterate over graph[node], which will be undefined and should cause a TypeError.
    //
    // We intentionally schedule the call inside setTimeout so the exception will be uncaught
    // in the page context and will surface as a "pageerror" event that Playwright can observe.
    //
    // This validates the requirement to let runtime errors happen naturally and assert they occur.

    // Trigger the asynchronous error inside the page
    await page.evaluate(() => {
      // Schedule invocation asynchronously so the exception becomes an uncaught page error
      setTimeout(() => {
        // This call is expected to throw (TypeError) because graph[99] is undefined
        // and the implementation tries to iterate over it.
        dfs(99, graph);
      }, 0);
    });

    // Wait for the pageerror event (timeout after 2s if it doesn't occur)
    const err = await page.waitForEvent('pageerror', { timeout: 2000 });

    // The error should be a TypeError (attempting to iterate over undefined)
    expect(err).toBeTruthy();
    // Some engines report name as 'TypeError'
    expect(err.name).toBe('TypeError');

    // The message should mention undefined / not iterable in some form.
    // Be permissive in matching to tolerate engine differences.
    expect(err.message).toMatch(/(undefined|not iterable|cannot|of undefined)/i);

    // Confirm that our pageErrors listener also captured the event
    expect(pageErrors.length).toBeGreaterThan(0);
    expect(pageErrors[0].name).toBe('TypeError');

    // Also ensure that console errors were not silently added beyond the pageerror (we accept pageerror)
    // It's okay if consoleErrors contains items, but ensure that we did observe a pageerror which is the key assertion
  });

  test('No unexpected console error messages during normal interactions', async ({ page }) => {
    // This test exercises common interactions and then asserts that no console.error messages were logged.

    const dfsPage = new DfsDemoPage(page);

    // Perform normal interactions: view page, click run
    await dfsPage.clickRun();

    // Give the page a moment to process and emit any console messages
    await page.waitForTimeout(200);

    // Collect console error messages
    const errorConsoleEntries = consoleMessages.filter((m) => m.type === 'error');

    // For a healthy run, there should be zero console.error messages
    expect(errorConsoleEntries.length).toBe(0);

    // And no uncaught page errors either
    expect(pageErrors.length).toBe(0);
  });
});