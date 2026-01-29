import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3c27c3-fa74-11f0-a1b6-4b9b8151441a.html';

/**
 * Page object for the Topological Sort visualization page.
 * Collects console messages and page errors so tests can assert on them.
 */
class TopoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Collect console messages (info, warning, error, etc.)
    this.page.on('console', (msg) => {
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Collect unhandled exceptions from the page (pageerror)
    this.page.on('pageerror', (err) => {
      // store the full message string for flexible assertions
      this.pageErrors.push(String(err && err.message ? err.message : err));
    });
  }

  // Navigate to the application URL and wait for load
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Locator helpers
  sortButton() {
    return this.page.locator('#sort-btn');
  }

  graphDisplay() {
    return this.page.locator('#graph-display');
  }

  resultDisplay() {
    return this.page.locator('#result');
  }

  // Convenience: innerHTML of graph-display
  async graphInnerHTML() {
    return await this.graphDisplay().innerHTML();
  }

  // Convenience: visible text of result
  async resultText() {
    return await this.resultDisplay().innerText();
  }

  // Click the sort button
  async clickSort() {
    await this.sortButton().click();
  }

  // Return a snapshot of console messages texts
  consoleTexts() {
    return this.consoleMessages.map((m) => m.text);
  }

  // Check whether console contains an error message matching regex
  consoleHasErrorMatching(regex) {
    return this.consoleMessages.some(m => m.type === 'error' && regex.test(m.text));
  }

  // Check whether any page error message matches regex
  pageErrorsMatch(regex) {
    return this.pageErrors.some(msg => regex.test(msg));
  }
}

test.describe('Topological Sort Visualization - FSM states and transitions', () => {

  // Validate initial page load, presence of expected DOM components, and entry action behavior
  test('S0_Idle: initial Idle state - UI elements present and displayGraph entry behavior', async ({ page }) => {
    // Setup PO and listeners before navigation
    const topo = new TopoPage(page);

    // Load the page
    await topo.goto();

    // 1) Verify UI components required by the FSM are present in the DOM
    // - The button that triggers the topological sort
    await expect(topo.sortButton()).toBeVisible();
    await expect(topo.sortButton()).toHaveText('Perform Topological Sort');

    // - The graph display container should exist
    await expect(topo.graphDisplay()).toBeVisible();

    // - The result container exists and has the expected class
    await expect(topo.resultDisplay()).toBeVisible();
    const classAttr = await topo.resultDisplay().getAttribute('class');
    expect(classAttr).toContain('topo-order');

    // 2) Because the supplied HTML/JS is truncated, the script may not have executed its entry action (displayGraph).
    // We assert that graph-display is empty (no rendered nodes) which indicates displayGraph did not run successfully.
    // This checks the application's reaction when the defined entry action cannot complete.
    const graphHTML = await topo.graphInnerHTML();
    // It's expected to be empty string when displayGraph didn't run, but be lenient: assert that it does not contain any node markup.
    expect(graphHTML).toBeTruthy(); // ensure we received a string
    expect(/class="node"|class=.?node.?|>A<\/div>|>B<\/div>/.test(graphHTML)).toBe(false);

    // 3) Observe console and page errors produced during parsing/execution.
    // The provided JS is truncated mid-function; different browsers may surface this as a SyntaxError or as console error text.
    // Assert that either console 'error' messages or pageErrors contain indications of a syntax/runtime problem.
    const syntaxRegex = /SyntaxError|Unexpected end of input|Unexpected token|Unexpected end|Uncaught/i;
    const consoleHasSyntax = topo.consoleHasErrorMatching(syntaxRegex);
    const pageHasSyntax = topo.pageErrorsMatch(syntaxRegex);

    // At least one mechanism should report the parsing/runtime problem
    expect(consoleHasSyntax || pageHasSyntax).toBe(true);

    // Additionally assert that the function topologicalSort was not successfully bound to the button's onclick property.
    // If the inline script failed to parse entirely, onclick should be null.
    const onclickIsNull = await page.evaluate(() => {
      const btn = document.getElementById('sort-btn');
      return btn && btn.onclick === null;
    });
    expect(onclickIsNull).toBe(true);
  });

  // Validate the user event: clicking the sort button (PerformTopologicalSort event)
  test('PerformTopologicalSort event: clicking the button attempts transition to Sorting (S1) but runtime error occurs', async ({ page }) => {
    const topo = new TopoPage(page);
    await topo.goto();

    // Capture current counts of errors so we can detect new errors produced by the click
    const initialConsoleCount = topo.consoleMessages.length;
    const initialPageErrorCount = topo.pageErrors.length;

    // Click the sort button: in a healthy app this would trigger topologicalSort() and transition to S1_Sorting
    await topo.clickSort();

    // Wait briefly to allow any JS handlers to run and errors to surface
    await page.waitForTimeout(200);

    // After click, check whether additional console errors or page errors were added
    const newConsoleErrors = topo.consoleMessages.slice(initialConsoleCount).filter(m => m.type === 'error');
    const newPageErrors = topo.pageErrors.slice(initialPageErrorCount);

    // Because the script is broken/partial, clicking should not produce a valid sort.
    // Assert that either new console errors or page errors exist (indicating the attempted transition failed).
    const clickProducedError = newConsoleErrors.length > 0 || newPageErrors.length > 0;
    expect(clickProducedError).toBe(true);

    // Also verify that the result area did not get populated with a topological ordering
    const resultText = await topo.resultText();
    // In a working app, resultText would be a comma-separated list. Here, it should remain empty.
    expect(resultText.trim()).toBe('');

    // Check that calling topologicalSort directly from the page context results in a ReferenceError,
    // which demonstrates the function isn't available due to the script parse failing.
    const callTopSortResult = await page.evaluate(() => {
      try {
        // Attempt to call the function directly
        // If it's not defined, this will throw a ReferenceError
        // We catch and return the error's name for assertion by the test
        // Note: we do not modify globals; we just exercise the existing environment.
        // eslint-disable-next-line no-undef
        topologicalSort();
        return 'called';
      } catch (e) {
        return (e && e.name) ? `${e.name}: ${e.message}` : `error: ${String(e)}`;
      }
    });

    // Assert we got a ReferenceError or similar indicating the function is not present
    expect(/ReferenceError|TypeError|is not defined|topologicalSort/.test(callTopSortResult)).toBe(true);
  });

  // Validate final state S2_Sorted expectations and check source evidence strings are present in the HTML
  test('S1_Sorting -> S2_Sorted transition expected behavior and source verification', async ({ page }) => {
    const topo = new TopoPage(page);
    await topo.goto();

    // 1) The #result element should exist; in a healthy run it would show the topological ordering when sorting completes.
    await expect(topo.resultDisplay()).toBeVisible();

    // 2) Because the implementation is truncated, we expect the result to remain empty.
    const resultBefore = await topo.resultText();
    expect(resultBefore.trim()).toBe('');

    // 3) Verify that the served HTML contains the code evidence strings from the FSM extraction.
    // These are present in the static HTML source even if the script failed at runtime.
    const content = await page.content();
    expect(content).toContain('function topologicalSort()'); // evidence: function exists in source text
    expect(content).toContain('const queue = [];'); // evidence: queue initialization exists
    expect(content).toContain('<div id="result" class="topo-order"></div'.slice(0, 30).trim() || '<div id="result"'); // ensure result div exists in markup

    // 4) Ensure that because the sorting couldn't complete, there's no displayed topological order in the result area.
    // In working scenarios, innerText would be a sequence like 'C, A, B, ...'; here it should be empty.
    const finalResultText = await topo.resultText();
    expect(finalResultText.trim()).toBe('');

    // 5) Assert that the page error/console error observed earlier still indicates parsing/runtime problems.
    const syntaxRegex = /SyntaxError|Unexpected end of input|Unexpected token|Unexpected end|Uncaught/i;
    const consoleHasSyntax = topo.consoleHasErrorMatching(syntaxRegex);
    const pageHasSyntax = topo.pageErrorsMatch(syntaxRegex);
    expect(consoleHasSyntax || pageHasSyntax).toBe(true);
  });

  // Edge case: attempt to interact with the graph-display nodes - ensure no nodes exist when script didn't execute
  test('Edge case: graph nodes are absent when displayGraph could not execute', async ({ page }) => {
    const topo = new TopoPage(page);
    await topo.goto();

    // Query for any elements with class 'node' inside graph-display
    const nodeCount = await page.locator('#graph-display .node').count();

    // Since displayGraph likely didn't run due to parse error, expect zero nodes rendered
    expect(nodeCount).toBe(0);
  });

  // Extra assertion: assert that the application surface still loads (HTTP) even if JS is broken,
  // and that the core static content (explanation section) is present and intact.
  test('Robustness: static content is available even when runtime script fails', async ({ page }) => {
    const topo = new TopoPage(page);
    await topo.goto();

    // Static explanatory heading should be present
    await expect(page.locator('h1')).toHaveText('Topological Sort');

    // The explanation section should contain text describing topological sort
    const explanation = await page.locator('.explanation').innerText();
    expect(explanation).toContain('What is Topological Sort?');
    expect(explanation).toContain('Topological sort is an ordering of vertices');
  });
});