import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324dd4f1-fa73-11f0-a9d0-d7a1991987c6.html';

class BellmanFordPage {
  /**
   * Page object for the Bellman-Ford visualization.
   * Encapsulates common interactions and queries used by the tests.
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = '.button';
    this.graphEdgesSelector = '#graphEdges';
    this.resultTableSelector = '#result';
    this.resultBodySelector = '#resultBody';
    // Containers for console and page error observations
    this.consoleMessages = [];
    this.consoleErrors = [];
    this.consoleWarnings = [];
    this.pageErrors = [];
  }

  async goto() {
    // Attach listeners before navigation to capture any page initialization logs/errors
    this.page.on('console', (msg) => {
      const text = msg.text();
      const type = msg.type(); // 'log', 'error', 'warning', etc.
      this.consoleMessages.push({ type, text });
      if (type === 'error') this.consoleErrors.push(text);
      if (type === 'warning') this.consoleWarnings.push(text);
    });
    this.page.on('pageerror', (err) => {
      // Collect page errors (uncaught exceptions)
      this.pageErrors.push(err);
    });
    await this.page.goto(APP_URL);
    // Wait for the main UI elements to be available
    await Promise.all([
      this.page.waitForSelector(this.buttonSelector),
      this.page.waitForSelector(this.graphEdgesSelector),
      this.page.waitForSelector(this.resultTableSelector),
    ]);
  }

  async clickRun() {
    await this.page.click(this.buttonSelector);
  }

  async isResultVisible() {
    const el = await this.page.$(this.resultTableSelector);
    if (!el) return false;
    return await el.evaluate((node) => {
      // return computed style display or inline style, depending on implementation
      const inline = node.style && node.style.display;
      if (inline) return inline !== 'none';
      return window.getComputedStyle(node).display !== 'none';
    });
  }

  async getGraphEdgesText() {
    return this.page.textContent(this.graphEdgesSelector);
  }

  async getResultRows() {
    return this.page.$$(this.resultBodySelector + ' tr');
  }

  async getResultAsArray() {
    // returns array of { vertex: string, distance: string } for each row
    const rows = await this.getResultRows();
    const out = [];
    for (const row of rows) {
      const cols = await row.$$('td');
      const vertex = await cols[0].textContent();
      const distance = await cols[1].textContent();
      out.push({ vertex: vertex?.trim(), distance: distance?.trim() });
    }
    return out;
  }

  getConsoleMessages() {
    return this.consoleMessages;
  }

  getConsoleErrors() {
    return this.consoleErrors;
  }

  getConsoleWarnings() {
    return this.consoleWarnings;
  }

  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('Bellman-Ford Algorithm Visualization - FSM tests', () => {
  // Shared fixture-level variables
  let bfPage;

  test.beforeEach(async ({ page }) => {
    bfPage = new BellmanFordPage(page);
    await bfPage.goto();
  });

  test.afterEach(async () => {
    // nothing to teardown explicitly; listeners are bound to page and cleared with page lifecycle
  });

  test('S0_Idle: Initial Idle state is rendered correctly', async () => {
    // Verify initial Idle state: button exists, graphEdges prefilled, result table hidden
    // This test validates the "onEnter" renderPage() effect by checking the DOM after load.

    // Button presence and label
    const button = await bfPage.page.$(bfPage.buttonSelector);
    expect(button).not.toBeNull();
    const label = (await button?.textContent())?.trim();
    expect(label).toBe('Run Bellman-Ford Algorithm');

    // Graph edges pre element contains expected textual representation
    const edgesText = await bfPage.getGraphEdgesText();
    expect(edgesText).toBeTruthy();
    // Expect the edges string to contain some known edge representations from the HTML implementation
    expect(edgesText).toContain('(0 -> 1, weight: -1)');
    expect(edgesText).toContain('(4 -> 3, weight: -3)');

    // Result table should be hidden initially
    const visible = await bfPage.isResultVisible();
    expect(visible).toBe(false);

    // Ensure no page errors occurred during initial rendering
    const pageErrors = bfPage.getPageErrors();
    expect(pageErrors.length).toBe(0);

    // There should be no console.error messages on load
    const consoleErrors = bfPage.getConsoleErrors();
    expect(consoleErrors.length).toBe(0);
  });

  test('S0 -> S1 transition: Clicking Run triggers algorithm execution and S1_AlgorithmRunning observable behavior', async () => {
    // This test validates the transition from Idle to AlgorithmRunning by clicking the button.
    // We cannot directly peek into an internal "running" flag; instead we assert that after clicking, results eventually appear
    // and that no uncaught exceptions were thrown during execution.

    // Rapidly click the run button once to start algorithm
    await bfPage.clickRun();

    // Wait for result table to become visible
    await bfPage.page.waitForFunction(
      (selector) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        const inline = el.style && el.style.display;
        if (inline) return inline !== 'none';
        return window.getComputedStyle(el).display !== 'none';
      },
      bfPage.resultTableSelector,
      { timeout: 2000 }
    );

    // Verify result table is visible
    expect(await bfPage.isResultVisible()).toBe(true);

    // No page errors should have been thrown during algorithm run
    const pageErrors = bfPage.getPageErrors();
    expect(pageErrors.length).toBe(0);

    // Also assert no console.error messages
    expect(bfPage.getConsoleErrors().length).toBe(0);

    // The algorithm should not warn about a negative-weight cycle for the provided graph.
    // If such a warning appears, that indicates different behavior; we assert that no relevant warnings exist.
    const warnings = bfPage.getConsoleWarnings();
    // If a negative-cycle warning is logged, it's typically text including 'negative-weight cycle'
    const negCycleWarnings = warnings.filter((w) => w.includes('negative-weight cycle'));
    expect(negCycleWarnings.length).toBe(0);
  });

  test('S2_ResultsDisplayed: Results table displays correct distances after algorithm completes', async () => {
    // This test validates the final state: displayResults(distances) was called and table populated correctly.

    // Click run and wait for completion
    await bfPage.clickRun();
    await bfPage.page.waitForFunction(
      (selector) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        const inline = el.style && el.style.display;
        if (inline) return inline !== 'none';
        return window.getComputedStyle(el).display !== 'none';
      },
      bfPage.resultTableSelector,
      { timeout: 2000 }
    );

    // Extract table rows as an array of {vertex, distance}
    const results = await bfPage.getResultAsArray();

    // The implementation sets V = 5, so expect 5 rows
    expect(results.length).toBe(5);

    // Verify the expected distances computed by Bellman-Ford for the given graph:
    // Known expected result: distances [0, -1, 2, -2, 1]
    const expected = [
      { vertex: '0', distance: '0' },
      { vertex: '1', distance: '-1' },
      { vertex: '2', distance: '2' },
      { vertex: '3', distance: '-2' },
      { vertex: '4', distance: '1' },
    ];

    expect(results).toEqual(expected);
  });

  test('Idempotency and repeated runs: Clicking Run multiple times yields consistent results and no errors', async () => {
    // This test validates that running the algorithm multiple times does not accumulate stale DOM or throw errors,
    // and the displayed results remain stable.

    // Run the algorithm twice in succession
    await bfPage.clickRun();
    await bfPage.page.waitForFunction(
      (selector) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        const inline = el.style && el.style.display;
        if (inline) return inline !== 'none';
        return window.getComputedStyle(el).display !== 'none';
      },
      bfPage.resultTableSelector,
      { timeout: 2000 }
    );

    const firstRun = await bfPage.getResultAsArray();

    // Run again
    await bfPage.clickRun();

    // Wait briefly for second run to finish (displayResults is synchronous in this implementation)
    await bfPage.page.waitForTimeout(200);

    const secondRun = await bfPage.getResultAsArray();

    // They should be identical
    expect(secondRun).toEqual(firstRun);

    // And no page errors or console errors were introduced
    expect(bfPage.getPageErrors().length).toBe(0);
    expect(bfPage.getConsoleErrors().length).toBe(0);
  });

  test('Edge case: Rapid repeated clicks do not cause unhandled exceptions', async () => {
    // Simulate a user clicking the run button rapidly several times and ensure no unhandled exceptions occur.
    // This validates robustness in handling repeated events.

    // Rapid clicks
    for (let i = 0; i < 6; i++) {
      // Do not await between clicks to simulate quick user clicks
      bfPage.page.click(bfPage.buttonSelector).catch(() => {});
    }

    // Allow short time for processing
    await bfPage.page.waitForTimeout(500);

    // The result table must be visible and populated with the expected number of rows
    expect(await bfPage.isResultVisible()).toBe(true);
    const rows = await bfPage.getResultRows();
    expect(rows.length).toBe(5);

    // No uncaught exceptions captured by pageerror
    expect(bfPage.getPageErrors().length).toBe(0);

    // No console.error messages
    expect(bfPage.getConsoleErrors().length).toBe(0);
  });

  test('Observability: Capture and report any console messages and page errors (diagnostic)', async () => {
    // This test does not fail if there are console.log messages; it asserts no console.error or pageerror exist.
    // It also demonstrates how we observe console output and page errors for debugging.

    // Trigger one run to create typical logs/warnings (if any)
    await bfPage.clickRun();
    await bfPage.page.waitForFunction(
      (selector) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        const inline = el.style && el.style.display;
        if (inline) return inline !== 'none';
        return window.getComputedStyle(el).display !== 'none';
      },
      bfPage.resultTableSelector,
      { timeout: 2000 }
    );

    // Gather observations
    const consoleMessages = bfPage.getConsoleMessages();
    const consoleErrors = bfPage.getConsoleErrors();
    const consoleWarnings = bfPage.getConsoleWarnings();
    const pageErrors = bfPage.getPageErrors();

    // Provide assertions per requirement:
    // - No console.error messages expected
    expect(consoleErrors.length).toBe(0);

    // - No uncaught page errors expected
    expect(pageErrors.length).toBe(0);

    // For diagnostic purposes (non-failing), ensure we at least captured console messages array (could be empty)
    expect(Array.isArray(consoleMessages)).toBe(true);

    // If any console warnings exist, they should be inspectable; ensure they don't include unexpected runtime errors text
    const unexpectedWarnings = consoleWarnings.filter((w) =>
      /ReferenceError|TypeError|SyntaxError/.test(w)
    );
    expect(unexpectedWarnings.length).toBe(0);
  });
});