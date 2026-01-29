import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3c4ed5-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object Model for the TSP demo page
class TSPPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.solveBtn = page.locator('#solveBtn');
    this.result = page.locator('#result');
    this.steps = page.locator('#steps');
    this.solution = page.locator('#solution');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickSolve() {
    await this.solveBtn.click();
  }

  async waitForResultVisible() {
    await this.page.waitForSelector('#result', { state: 'visible' });
  }

  async stepsCount() {
    return await this.steps.evaluate((el) => el.children.length);
  }

  async getSolutionText() {
    return await this.solution.innerText();
  }

  async getResultDisplayStyle() {
    return await this.page.$eval('#result', (el) => getComputedStyle(el).display);
  }
}

test.describe('Branch and Bound TSP Interactive App - FSM Validation', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // reset collectors
    pageErrors = [];
    consoleMessages = [];

    // collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // collect console messages with their types
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test.afterEach(async () => {
    // Sanity: ensure we didn't accidentally swallow or create unexpected errors.
    // Tests below may assert on these arrays explicitly.
  });

  test('S0_Idle: Initial Idle state renders page with Solve button and hidden result', async ({ page }) => {
    // This test validates the initial "Idle" state per FSM S0_Idle:
    // - renderPage() expected entry action (not implemented explicitly) but page should show the solve button
    // - The result panel should be hidden at start
    const tsp = new TSPPage(page);
    await tsp.goto();

    // Elements present
    await expect(tsp.solveBtn).toBeVisible({ timeout: 2000 });
    await expect(tsp.solveBtn).toHaveText('Solve with Branch and Bound');

    // Result should be hidden initially (display)
    const display = await tsp.getResultDisplayStyle();
    expect(display === 'none' || display === 'hidden' || display === '').toBeTruthy();

    // Steps and solution empty
    const stepsCount = await tsp.stepsCount();
    expect(stepsCount).toBe(0);

    const solutionText = await tsp.getSolutionText();
    // solution area is empty initially
    expect(solutionText.trim()).toBe('');

    // Ensure no unexpected page errors or console errors at initial load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('S1_Solving -> S2_Completed: Clicking Solve executes algorithm and shows result', async ({ page }) => {
    // This test validates the transition from Idle -> Solving -> Completed:
    // - Clicking solveBtn triggers solveTSP (S1 entry action)
    // - The algorithm populates steps and then shows #result (S2 evidence)
    const tsp1 = new TSPPage(page);
    await tsp.goto();

    // Click Solve to start algorithm
    await tsp.clickSolve();

    // Wait for result to become visible (transition to Completed)
    await tsp.waitForResultVisible();

    // Result should be visible (S2_Completed evidence)
    await expect(tsp.result).toBeVisible();

    // Steps container should have nodes appended (evidence of solving process)
    const stepsCount1 = await tsp.stepsCount1();
    expect(stepsCount).toBeGreaterThan(0);

    // Solution should contain Optimal Path and Minimum Cost, and cost should be 80 (expected optimal)
    const solutionText1 = await tsp.getSolutionText();
    expect(solutionText).toContain('Optimal Path');
    expect(solutionText).toContain('Minimum Cost');

    // Extract numeric minimum cost from the solution text to assert correctness
    const minCostMatch = solutionText.match(/Minimum Cost:\s*([0-9]+)/);
    expect(minCostMatch).not.toBeNull();
    const minCost = Number(minCostMatch[1]);
    expect(minCost).toBe(80);

    // The path should be one of the known optimal tours A → B → D → C → A or A → C → D → B → A.
    // We check that the path string contains 'A' at start and ends with 'A' and has arrows; remaining order can be one of the two.
    const pathMatch = solutionText.match(/Optimal Path:\s*([A-Z\s→]+)/);
    expect(pathMatch).not.toBeNull();
    const pathStr = pathMatch[1].trim();
    expect(pathStr.startsWith('A')).toBeTruthy();
    expect(pathStr.endsWith('A')).toBeTruthy();
    // Accept either of the two optimal permutations (normalized whitespace)
    const normalizedPath = pathStr.replace(/\s+/g, ' ');
    const allowed1 = 'A → B → D → C → A';
    const allowed2 = 'A → C → D → B → A';
    expect(normalizedPath === allowed1 || normalizedPath === allowed2).toBeTruthy();

    // Inspect console and page errors: ensure no uncaught errors were thrown during solving
    const consoleErrors1 = consoleMessages.filter(m => m.type === 'error');
    // If any page errors occurred, surface them in assertion message for easier debugging
    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      // Fail with helpful diagnostics
      const diagnostics = {
        pageErrors: pageErrors.map(e => (e && e.stack) ? e.stack : String(e)),
        consoleErrors,
      };
      throw new Error('Unexpected page/console errors detected during solve: ' + JSON.stringify(diagnostics, null, 2));
    }

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: Multiple rapid clicks do not cause uncaught errors and produce valid solution each time', async ({ page }) => {
    // This test exercises error scenarios and edge cases:
    // - Clicking the Solve button multiple times quickly should not crash the page
    // - Each run should produce a visible result and a minimum cost of 80
    // - No uncaught page errors or console errors should occur
    const tsp2 = new TSPPage(page);
    await tsp.goto();

    // Rapid clicks: click 3 times in quick succession
    await Promise.all([
      tsp.solveBtn.click(),
      tsp.solveBtn.click(),
      tsp.solveBtn.click()
    ]);

    // Wait for result visible (after algorithm finishes)
    await tsp.waitForResultVisible();
    await expect(tsp.result).toBeVisible();

    // Steps should be present
    const stepsCountAfter = await tsp.stepsCount();
    expect(stepsCountAfter).toBeGreaterThan(0);

    // Validate solution min cost remains 80
    const solutionText2 = await tsp.getSolutionText();
    const minCostMatch1 = solutionText.match(/Minimum Cost:\s*([0-9]+)/);
    expect(minCostMatch).not.toBeNull();
    expect(Number(minCostMatch[1])).toBe(80);

    // Ensure no page-level errors or console errors occurred during rapid runs
    const consoleErrors2 = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Utility functions firstMin and secondMin behave as expected for row A', async ({ page }) => {
    // This test directly calls the page-defined utility functions to validate internal computations:
    // - firstMin(matrix, 0) should be 10 for node A
    // - secondMin(matrix, 0) should be 15 for node A
    const tsp3 = new TSPPage(page);
    await tsp.goto();

    // Evaluate the functions in page context and assert results
    const results = await page.evaluate(() => {
      // adjacencyMatrix is not a global variable, but we can reconstruct it locally as in the page script
      const adjacencyMatrix = [
        [0, 10, 15, 20],
        [10, 0, 35, 25],
        [15, 35, 0, 30],
        [20, 25, 30, 0]
      ];
      // functions are defined globally in the page script; call them directly if available
      // If they are not present, return a sentinel to ensure the test fails rather than throwing.
      if (typeof firstMin !== 'function' || typeof secondMin !== 'function') {
        return { first: null, second: null, present: false };
      }
      const first = firstMin(adjacencyMatrix, 0);
      const second = secondMin(adjacencyMatrix, 0);
      return { first, second, present: true };
    });

    expect(results.present).toBeTruthy();
    expect(results.first).toBe(10);
    expect(results.second).toBe(15);

    // Ensure no uncaught errors due to evaluation
    const consoleErrors3 = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition evidence: clicking Solve triggers DOM changes consistent with FSM transitions', async ({ page }) => {
    // This test verifies the explicit pieces of evidence extracted from the FSM:
    // - There is an event listener linking #solveBtn to solveTSP (inferred by click behavior)
    // - After clicking, #result.style.display becomes 'block'
    const tsp4 = new TSPPage(page);
    await tsp.goto();

    // Precondition check: result hidden
    const beforeDisplay = await tsp.getResultDisplayStyle();
    expect(beforeDisplay === 'none' || beforeDisplay === '' || beforeDisplay === 'hidden').toBeTruthy();

    // Click to trigger transition
    await tsp.clickSolve();

    // Wait until #result display computed style becomes 'block' or element visible
    await tsp.waitForResultVisible();

    const afterDisplay = await tsp.getResultDisplayStyle();
    expect(afterDisplay).toBe('block');

    // Additionally assert that steps container has appended evidence of branching or pruning (node elements)
    const stepsHtml = await page.$eval('#steps', el => el.innerHTML);
    expect(stepsHtml).toContain('Branching on Node');
    // Or at least some indication of "Starting Branch and Bound"
    expect(stepsHtml).toContain('Starting Branch and Bound');

    // No errors on console or page
    const consoleErrors4 = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});