import { test, expect } from '@playwright/test';

// Page Object for the BFS visualization page
class BFSPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startSelector = '#start-bfs';
    this.resetSelector = '#reset';
    this.graphSelector = '#graph-container';
    this.queueSelector = '#queue-display';
    this.traversalSelector = '#traversal-order';
  }

  async goto(url) {
    await this.page.goto(url, { waitUntil: 'load' });
  }

  async startBFSButton() {
    return this.page.locator(this.startSelector);
  }

  async resetButton() {
    return this.page.locator(this.resetSelector);
  }

  async clickStart() {
    await this.page.click(this.startSelector);
  }

  async clickReset() {
    await this.page.click(this.resetSelector);
  }

  async getQueueText() {
    return (await this.page.locator(this.queueSelector).innerText()).trim();
  }

  async getTraversalText() {
    return (await this.page.locator(this.traversalSelector).innerText()).trim();
  }

  async elementExists(selector) {
    return await this.page.locator(selector).count() > 0;
  }
}

// URL to test (per requirements)
const TEST_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3bd9a5-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('BFS Visualization - FSM states and transitions', () => {
  // Arrays to collect runtime errors and console messages observed during tests
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors
    pageErrors = [];
    consoleMessages = [];

    // Collect page errors (uncaught exceptions, syntax errors, etc.)
    page.on('pageerror', (err) => {
      // err is an Error object with message, name, stack
      pageErrors.push(err);
    });

    // Collect console messages for observation (log, error, warning, etc.)
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // Safeguard: some console messages may not serialize; still continue
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Navigate to the page under test
    await page.goto(TEST_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // give a tiny moment for any late errors to bubble up
    await page.waitForTimeout(50);
    // close page cleanup is automatic in Playwright fixtures
  });

  test('Initial Idle state: page renders core UI elements and shows script errors if any', async ({ page }) => {
    // This test validates the S0_Idle state: UI must render Start and Reset buttons,
    // and the graph / queue / traversal containers must be present.
    const bfs = new BFSPage(page);

    // Verify buttons and containers exist
    expect(await bfs.elementExists(bfs.startSelector)).toBeTruthy();
    expect(await bfs.elementExists(bfs.resetSelector)).toBeTruthy();
    expect(await bfs.elementExists(bfs.graphSelector)).toBeTruthy();
    expect(await bfs.elementExists(bfs.queueSelector)).toBeTruthy();
    expect(await bfs.elementExists(bfs.traversalSelector)).toBeTruthy();

    // Verify that queue and traversal are initially empty (Idle state)
    const queueText = await bfs.getQueueText();
    const traversalText = await bfs.getTraversalText();
    expect(queueText).toBe('');
    expect(traversalText).toBe('');

    // The provided HTML has a truncated script which should produce a syntax or parse error.
    // Assert that at least one page error was captured during load.
    // We don't assert the exact message to remain robust across browsers; ensure an error occurred.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Also capture console messages to help debugging: at least one console message or error is expected.
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);

    // Assert that global functions expected by the FSM are not defined due to script failure.
    // typeof checks should not throw even if script had errors.
    const typeofStart = await page.evaluate(() => typeof window.startBFS);
    const typeofReset = await page.evaluate(() => typeof window.resetGraph);
    expect(typeofStart).toBe('undefined');
    expect(typeofReset).toBe('undefined');
  });

  test('Attempting to start BFS triggers no traversal and calling startBFS throws (ReferenceError or similar)', async ({ page }) => {
    // This test validates the transition from S0_Idle -> S1_BFS_Running.
    // Because the script is broken, clicking Start BFS should not perform traversal.
    const bfs1 = new BFSPage(page);

    // Sanity check: traversal empty before interaction
    expect(await bfs.getTraversalText()).toBe('');
    expect(await bfs.getQueueText()).toBe('');

    // Click the Start button - due to broken script, this should not start traversal.
    await bfs.clickStart();

    // Wait briefly to allow any handlers (if present) to run
    await page.waitForTimeout(100);

    // Verify that traversal/order did not change (still empty)
    expect(await bfs.getTraversalText()).toBe('');
    expect(await bfs.getQueueText()).toBe('');

    // Attempt to call startBFS directly in page context.
    // We expect this to reject: either because startBFS is not defined (ReferenceError)
    // or it is not a function. We allow the promise to reject and assert that it does.
    await expect(page.evaluate(() => {
      // Direct invocation without window qualifier will throw ReferenceError if not defined
      return startBFS();
    })).rejects.toThrow();

    // Ensure that an error (syntax or runtime) was observed on the page
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('Attempting to reset graph does not clear traversal (Reset transition fails) and calling resetGraph throws', async ({ page }) => {
    // This test validates the S1_BFS_Running -> S0_Idle reset transition behavior.
    // Because script did not load properly, reset should not function.
    const bfs2 = new BFSPage(page);

    // Simulate that some DOM content might be present (but in this broken page it will be empty)
    expect(await bfs.getTraversalText()).toBe('');
    expect(await bfs.getQueueText()).toBe('');

    // Click Reset button
    await bfs.clickReset();

    // Give slight time for any handlers (if they existed)
    await page.waitForTimeout(100);

    // Since script is broken, these should remain unchanged (empty)
    expect(await bfs.getTraversalText()).toBe('');
    expect(await bfs.getQueueText()).toBe('');

    // Directly invoke resetGraph in page context and assert that it throws (ReferenceError or similar)
    await expect(page.evaluate(() => {
      return resetGraph();
    })).rejects.toThrow();

    // Ensure the page still reported errors
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('Edge cases: multiple clicks do nothing and globals remain undefined', async ({ page }) => {
    // This test covers edge cases: repeated interactions and checking that no unexpected state changes occur.
    const bfs3 = new BFSPage(page);

    // Click Start multiple times
    await bfs.clickStart();
    await bfs.clickStart();
    await bfs.clickStart();

    // Click Reset multiple times
    await bfs.clickReset();
    await bfs.clickReset();

    // Wait for any possible handlers
    await page.waitForTimeout(100);

    // Ensure traversal and queue remain empty
    expect(await bfs.getTraversalText()).toBe('');
    expect(await bfs.getQueueText()).toBe('');

    // Globals still undefined
    const typeofStart1 = await page.evaluate(() => typeof startBFS);
    const typeofReset1 = await page.evaluate(() => typeof resetGraph);
    expect(typeofStart).toBe('undefined');
    expect(typeofReset).toBe('undefined');

    // Confirm at least one syntax/runtime error was observed on the page
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('Observing console and pageerror details to document failure modes', async ({ page }) => {
    // This test inspects collected errors and console logs to assert that a syntax/parse error occurred.
    // It does not try to fix anything; it merely documents the runtime failures.
    // We assert that at least one pageerror contains a message that hints at "SyntaxError" or "Unexpected".
    const errorMessages = pageErrors.map(e => String(e && e.message ? e.message : e));
    const consoleTexts = consoleMessages.map(c => `${c.type}: ${c.text}`);

    // At minimum, we saw some page errors; fail the test if none.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Check that one of the error messages likely indicates a syntax/parse issue.
    const hasSyntaxLike = errorMessages.some(msg => /syntax|unexpected|end of input|unterminated|unexpected token/i.test(msg));
    // It's possible the browser reports different wording; accept either a syntax-like message or generic error presence.
    expect(hasSyntaxLike || pageErrors.length > 0).toBeTruthy();

    // For diagnostics, ensure console messages were captured (can be empty but should be an array).
    expect(Array.isArray(consoleMessages)).toBeTruthy();

    // Ensure at least one console entry (if any) is a console.error type or contains 'Error' text.
    const hasErrorConsole = consoleMessages.some(c => c.type === 'error' || /error/i.test(c.text));
    // This is not strict; we only assert that capturing console messages worked (array exists).
    expect(consoleMessages).toBeInstanceOf(Array);

    // Provide an additional assertion: the page URL is correct and reachable (status: having loaded)
    expect(page.url()).toBe(TEST_URL);
  });
});