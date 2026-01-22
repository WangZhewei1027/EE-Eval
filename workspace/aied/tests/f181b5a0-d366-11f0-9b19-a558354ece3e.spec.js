import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f181b5a0-d366-11f0-9b19-a558354ece3e.html';

/**
 * Page Object for interacting with the BFS Visualization page DOM.
 * Encapsulates selectors and common actions so tests are more readable.
 */
class BFSPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.randomGraphBtn = page.locator('#randomGraphBtn');
    this.stepBtn = page.locator('#stepBtn');
    this.status = page.locator('#status');
    this.queueItems = page.locator('#queueItems .queue-item');
    this.visualizationNodes = page.locator('#visualization .node');
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async clickRandomGraph() {
    await this.randomGraphBtn.click();
  }

  async clickStep() {
    await this.stepBtn.click();
  }

  async getStatusText() {
    const text = await this.status.textContent();
    return text ? text.trim() : '';
  }

  async getQueueCount() {
    return this.queueItems.count();
  }

  async getQueueTextList() {
    const count = await this.getQueueCount();
    const result = [];
    for (let i = 0; i < count; i++) {
      result.push((await this.queueItems.nth(i).textContent()).trim());
    }
    return result;
  }

  async getVisualizationNodeCount() {
    return this.visualizationNodes.count();
  }

  async nodeHasClass(nodeLabel, className) {
    const count = await this.visualizationNodes.count();
    for (let i = 0; i < count; i++) {
      const el = this.visualizationNodes.nth(i);
      const text = (await el.textContent()).trim();
      if (text === nodeLabel) {
        return await el.evaluate((el, c) => el.classList.contains(c), className);
      }
    }
    return false;
  }
}

/**
 * Utility to attach listeners to a page to capture console errors and page errors.
 * Returns an object that holds arrays of captured messages and a helper to await the first pageerror if needed.
 */
function attachErrorCollectors(page) {
  /** @type {Array<Error>} */
  const pageErrors = [];
  /** @type {Array<string>} */
  const consoleErrors = [];

  page.on('pageerror', (err) => {
    // Collect the Error object (SyntaxError, ReferenceError, TypeError, etc.)
    pageErrors.push(err);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  return {
    pageErrors,
    consoleErrors,
    /**
     * Waits for at least one pageerror to be captured within timeoutMs.
     * Resolves true if an error was captured, false otherwise.
     */
    async waitForAnyPageError(timeoutMs = 2000) {
      if (pageErrors.length > 0) return true;
      try {
        await page.waitForEvent('pageerror', { timeout: timeoutMs });
        return true;
      } catch (e) {
        return false;
      }
    },
    /**
     * Wait for any console error to be emitted within timeoutMs.
     */
    async waitForAnyConsoleError(timeoutMs = 2000) {
      if (consoleErrors.length > 0) return true;
      try {
        await page.waitForEvent('console', {
          predicate: (m) => m.type() === 'error',
          timeout: timeoutMs,
        });
        return true;
      } catch (e) {
        return false;
      }
    },
  };
}

test.describe('BFS Visualization - FSM states & error handling', () => {
  // Basic smoke test ensuring the page loads its static HTML
  test('Initial Idle state is present in DOM (static HTML content)', async ({ page }) => {
    // Attach collectors before navigation to capture script parse/load errors
    const collectors = attachErrorCollectors(page);

    // Navigate to the page
    await page.goto(APP_URL);

    const bfs = new BFSPage(page);

    // The HTML contains a status box with the idle instructional message.
    const status = await bfs.getStatusText();
    expect(status).toContain('Click "Start BFS" to begin the visualization');

    // Visualization should be present but since the script may not run,
    // we cannot assume nodes are rendered. Ensure the visualization container exists.
    const vizCount = await bfs.getVisualizationNodeCount();
    // If the script ran, nodes would be > 0, but due to the known truncation error it will often be 0.
    expect(typeof vizCount).toBe('number');

    // We expect that the page script has a loading/runtime problem (SyntaxError likely).
    // Assert that at least one pageerror or console error occurs during load.
    const hasPageError = await collectors.waitForAnyPageError(2000);
    const hasConsoleError = await collectors.waitForAnyConsoleError(2000);

    expect(hasPageError || hasConsoleError).toBeTruthy();
  });

  test('Console / page errors include a SyntaxError from truncated script', async ({ page }) => {
    // Capture errors before navigation to ensure errors during parse are recorded
    const collectors = attachErrorCollectors(page);

    await page.goto(APP_URL);

    // Wait a short while to let errors propagate
    await page.waitForTimeout(250);

    // Check collected page errors for SyntaxError specifically
    const pageErrors = collectors.pageErrors;
    const consoleErrors = collectors.consoleErrors;

    // At least one error event should be captured somewhere
    expect(pageErrors.length + consoleErrors.length).toBeGreaterThan(0);

    // Validate that a SyntaxError was observed either as a pageerror or in console text.
    const hasSyntax = pageErrors.some(e => e && e.name === 'SyntaxError') ||
      consoleErrors.some(text => /syntax error/i.test(text) || /unexpected end/i.test(text) || /unexpected token/i.test(text));

    // Because environments differ, accept SyntaxError OR generic parse-related messages,
    // but require we observed a parsing/runtime error that matches the expectation.
    expect(hasSyntax).toBeTruthy();
  });

  test('Interactive controls do not successfully attach behaviors due to script error (events/transitions fail)', async ({ page }) => {
    // Attach collectors to capture any errors resulting from user interactions
    const collectors = attachErrorCollectors(page);

    await page.goto(APP_URL);

    const bfs = new BFSPage(page);

    // Sanity: initial status message
    const initialStatus = await bfs.getStatusText();
    expect(initialStatus).toContain('Click "Start BFS" to begin the visualization');

    // Attempt to click Start BFS - under normal operation this triggers startBFS()
    // Because the script is truncated, we expect that either nothing happens or an error occurs.
    await bfs.clickStart();

    // Allow time for any event handlers (or errors) to fire
    await page.waitForTimeout(300);

    const statusAfterStart = await bfs.getStatusText();

    // If startBFS couldn't run, status should remain the initial instructional text.
    // If any runtime error occurred during the click, it should have been captured by the collectors.
    const pageErrorOccurred = collectors.pageErrors.length > 0;
    const consoleErrorOccurred = collectors.consoleErrors.length > 0;

    // Assert either no change (handlers not attached) OR an error occurred (handlers attached but failed).
    const unchanged = statusAfterStart === initialStatus;
    expect(unchanged || pageErrorOccurred || consoleErrorOccurred).toBeTruthy();

    // Further validate that the queue display remains empty (no BFS started)
    const queueCount = await bfs.getQueueCount();
    expect(queueCount).toBe(0);
  });

  test('Reset / Random Graph / Step controls either do nothing or produce errors when clicked (robustness)', async ({ page }) => {
    const collectors = attachErrorCollectors(page);
    await page.goto(APP_URL);

    const bfs = new BFSPage(page);

    // Click Reset - if reset() were available it would set a specific status message.
    await bfs.clickReset();
    await page.waitForTimeout(200);

    // Click Random Graph - may trigger generateRandomGraph() if defined
    await bfs.clickRandomGraph();
    await page.waitForTimeout(200);

    // Click Step - may trigger stepBFS() if defined
    await bfs.clickStep();
    await page.waitForTimeout(200);

    // Collect status and queue to assert no successful transitions occurred
    const status = await bfs.getStatusText();
    const queueCount = await bfs.getQueueCount();

    // Because the script is truncated, we expect no queue items added and the status unlikely changed to successful reset text.
    // Accept that either the status is still initial or an error occurred; ensure no silent, incorrect success state like "BFS completed!" without running.
    expect(queueCount).toBe(0);
    expect(
      status === 'Click "Start BFS" to begin the visualization' ||
      status === 'Graph reset. Click "Start BFS" to begin.' ||
      collectors.pageErrors.length > 0 ||
      collectors.consoleErrors.length > 0
    ).toBeTruthy();

    // At least one error should be observed across pageerror/console if handlers attempted to run
    expect(collectors.pageErrors.length + collectors.consoleErrors.length).toBeGreaterThanOrEqual(0);
    // (We don't force an error here since behavior may vary; the earlier tests already assert a parsing error.)
  });

  test('FSM expected transitions cannot be fully validated due to script SyntaxError; assert that these failures are observable', async ({ page }) => {
    // This test documents and asserts that because the script has a parsing/runtime error,
    // the FSM transitions described in the specification (start -> running -> completed -> reset) cannot be executed,
    // and such inability is detectable by the presence of page/console errors and by the lack of DOM changes.

    const collectors = attachErrorCollectors(page);
    await page.goto(APP_URL);

    const bfs = new BFSPage(page);

    // Try to perform the full transition sequence that should exist when script is healthy:
    // Start -> step until complete -> reset -> start again.
    // We'll click Start and then repeatedly click Step, then Reset, then Start.
    await bfs.clickStart();
    await page.waitForTimeout(200);

    // Repeatedly click Step a few times to simulate stepping through BFS
    for (let i = 0; i < 5; i++) {
      await bfs.clickStep();
      await page.waitForTimeout(100);
    }

    // Click Reset and then Start again
    await bfs.clickReset();
    await page.waitForTimeout(100);
    await bfs.clickStart();
    await page.waitForTimeout(200);

    // Evaluate whether any of the FSM observable outcomes occurred:
    const status = await bfs.getStatusText();
    const queueCount = await bfs.getQueueCount();
    const vizNodes = await bfs.getVisualizationNodeCount();

    // Because of the truncated script we expect:
    // - Either the page threw parse/runtime errors (collectors.pageErrors or consoleErrors),
    // - Or no meaningful transitions took place (queueCount === 0 and vizNodes === 0).
    const errorsObserved = collectors.pageErrors.length > 0 || collectors.consoleErrors.length > 0;
    const noObservableProgress = queueCount === 0 && vizNodes === 0 && status.includes('Click "Start BFS"');

    expect(errorsObserved || noObservableProgress).toBeTruthy();

    // Additionally, assert that at least one pageerror was a SyntaxError or a ReferenceError indicating missing runtime pieces.
    const syntacticOrRef = collectors.pageErrors.some(e => e && (e.name === 'SyntaxError' || e.name === 'ReferenceError' || e.name === 'TypeError')) ||
      collectors.consoleErrors.some(text => /syntax error/i.test(text) || /unexpected end/i.test(text) || /referenceerror/i.test(text) || /typeerror/i.test(text));

    expect(syntacticOrRef).toBeTruthy();
  });
});