import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cf93b4-fa79-11f0-8075-e54a10595dde.html';

// Page object encapsulating interactions with the NP-Completeness demo page
class ProblemPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.select = page.locator('#problem-selector');
    this.knapsackControls = page.locator('#knapsack-controls');
    this.vertexControls = page.locator('#vertex-cover-controls');
    this.subsetControls = page.locator('#subset-sum-controls');

    // Knapsack elements
    this.knapsackWeights = page.locator('#knapsack-weights');
    this.knapsackValues = page.locator('#knapsack-values');
    this.knapsackCapacity = page.locator('#knapsack-capacity');
    this.knapsackSolve = page.locator('button', { hasText: 'Solve Knapsack' });
    this.knapsackOutput = page.locator('#knapsack-output');

    // Vertex Cover elements
    this.vertexEdges = page.locator('#vertex-cover-edges');
    this.vertexVertices = page.locator('#vertex-cover-vertices');
    this.vertexSolve = page.locator('button', { hasText: 'Solve Vertex Cover' });
    this.vertexOutput = page.locator('#vertex-cover-output');

    // Subset Sum elements
    this.subsetNumbers = page.locator('#subset-sum-numbers');
    this.subsetTarget = page.locator('#subset-sum-target');
    this.subsetSolve = page.locator('button', { hasText: 'Solve Subset Sum' });
    this.subsetOutput = page.locator('#subset-sum-output');
  }

  // Selects a problem from the dropdown. To ensure a 'change' event is fired even if
  // the desired value equals the current value, we optionally toggle to a different
  // value first then select the target.
  async selectProblem(value) {
    const current = await this.select.inputValue();
    if (current === value) {
      // toggle to a different option first to ensure change event fires
      const toggle = value === 'knapsack' ? 'vertex_cover' : 'knapsack';
      await this.select.selectOption(toggle);
      // small wait to allow DOM handlers to run
      await this.page.waitForTimeout(50);
    }
    await this.select.selectOption(value);
    // wait for DOM updates triggered by the change handler
    await this.page.waitForTimeout(50);
  }

  // Visibility helpers
  async isKnapsackVisible() {
    return this.knapsackControls.isVisible();
  }
  async isVertexVisible() {
    return this.vertexControls.isVisible();
  }
  async isSubsetVisible() {
    return this.subsetControls.isVisible();
  }

  // Knapsack interactions
  async fillKnapsack(weights, values, capacity) {
    await this.knapsackWeights.fill(weights);
    await this.knapsackValues.fill(values);
    await this.knapsackCapacity.fill(String(capacity));
  }
  async clickSolveKnapsack() {
    await this.knapsackSolve.click();
  }
  async getKnapsackOutput() {
    return this.knapsackOutput.textContent();
  }

  // Vertex Cover interactions
  async fillVertexCover(edges, vertices) {
    await this.vertexEdges.fill(edges);
    await this.vertexVertices.fill(String(vertices));
  }
  async clickSolveVertexCover() {
    await this.vertexSolve.click();
  }
  async getVertexOutput() {
    return this.vertexOutput.textContent();
  }

  // Subset Sum interactions
  async fillSubsetSum(numbers, target) {
    await this.subsetNumbers.fill(numbers);
    await this.subsetTarget.fill(String(target));
  }
  async clickSolveSubsetSum() {
    await this.subsetSolve.click();
  }
  async getSubsetOutput() {
    return this.subsetOutput.textContent();
  }
}

test.describe('NP-Completeness Interactive Demonstration - FSM and UI tests', () => {
  let consoleMessages = [];
  let pageErrors = [];

  // Set up listeners for console messages and uncaught page errors before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // capture all console messages for assertions
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    page.on('pageerror', error => {
      // store uncaught exceptions from the page
      pageErrors.push(error);
    });

    await page.goto(APP_URL);
  });

  // Basic smoke test: initial load / Idle state (S0_Idle)
  test('Initial load shows Idle state with problem selector and no controls visible', async ({ page }) => {
    const p = new ProblemPage(page);

    // Validate that the problem selector exists and is visible
    await expect(p.select).toBeVisible();

    // On initial load, all problem-specific control panels should be hidden (Idle state)
    await expect(p.knapsackControls).toBeHidden();
    await expect(p.vertexControls).toBeHidden();
    await expect(p.subsetControls).toBeHidden();

    // No runtime errors or console.error messages should have occurred during load
    expect(pageErrors.length).toBe(0);
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test.describe('Problem selection transitions (ProblemSelected event)', () => {
    // Validate transitions from Idle to each specific problem state show the correct controls
    test('Selecting Knapsack displays knapsack controls and hides others (S0 -> S1)', async ({ page }) => {
      const p = new ProblemPage(page);

      // Ensure a change event will occur: toggle then select knapsack
      await p.selectProblem('knapsack');

      // Knapsack controls should be visible; others hidden
      await expect(p.knapsackControls).toBeVisible();
      await expect(p.vertexControls).toBeHidden();
      await expect(p.subsetControls).toBeHidden();

      // No uncaught page errors and no console.error
      expect(pageErrors.length).toBe(0);
      expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
    });

    test('Selecting Vertex Cover displays vertex cover controls and hides others (S0 -> S2)', async ({ page }) => {
      const p = new ProblemPage(page);

      await p.selectProblem('vertex_cover');

      await expect(p.vertexControls).toBeVisible();
      await expect(p.knapsackControls).toBeHidden();
      await expect(p.subsetControls).toBeHidden();

      expect(pageErrors.length).toBe(0);
      expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
    });

    test('Selecting Subset Sum displays subset sum controls and hides others (S0 -> S3)', async ({ page }) => {
      const p = new ProblemPage(page);

      await p.selectProblem('subset_sum');

      await expect(p.subsetControls).toBeVisible();
      await expect(p.knapsackControls).toBeHidden();
      await expect(p.vertexControls).toBeHidden();

      expect(pageErrors.length).toBe(0);
      expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
    });

    test('Switching between problems triggers onExit/onEnter (controls hide/show)', async ({ page }) => {
      const p = new ProblemPage(page);

      // Select knapsack then vertex and assert hide/show behavior
      await p.selectProblem('knapsack');
      await expect(p.knapsackControls).toBeVisible();
      await p.selectProblem('vertex_cover');
      await expect(p.knapsackControls).toBeHidden(); // onExit of knapsack -> hideKnapsackControls()
      await expect(p.vertexControls).toBeVisible(); // onEnter vertex -> showVertexCoverControls()

      // Switch back to subset_sum
      await p.selectProblem('subset_sum');
      await expect(p.vertexControls).toBeHidden();
      await expect(p.subsetControls).toBeVisible();

      // No uncaught exceptions expected in normal transitions
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Solve actions and expected outputs (SolveKnapsack, SolveVertexCover, SolveSubsetSum)', () => {
    test('Solve Knapsack computes correct maximum value and updates DOM (S1_Knapsack SolveKnapsack)', async ({ page }) => {
      const p = new ProblemPage(page);

      // Ensure knapsack is selected
      await p.selectProblem('knapsack');

      // Provide a small test case: weights [1,2], values [10,15], capacity 3 -> best = 25
      await p.fillKnapsack('1,2', '10,15', 3);
      await p.clickSolveKnapsack();

      // Validate DOM output contains expected result
      await expect(p.knapsackOutput).toHaveText('Maximum value in knapsack: 25');

      // No uncaught exceptions and no console.error messages
      expect(pageErrors.length).toBe(0);
      expect(consoleMessages.some(m => m.type === 'error')).toBe(false);
    });

    test('Solve Vertex Cover returns a possible cover and updates DOM (S2_VertexCover SolveVertexCover)', async ({ page }) => {
      const p = new ProblemPage(page);

      await p.selectProblem('vertex_cover');

      // Graph edges: 1-2,2-3; vertices 3 -> algorithm picks [1,2]
      await p.fillVertexCover('1-2,2-3', 3);
      await p.clickSolveVertexCover();

      // Verify expected output text (note spacing: join with ", ")
      await expect(p.vertexOutput).toHaveText('A possible vertex cover is: 1, 2');

      expect(pageErrors.length).toBe(0);
      expect(consoleMessages.some(m => m.type === 'error')).toBe(false);
    });

    test('Solve Subset Sum detects existing subset and updates DOM (S3_SubsetSum SolveSubsetSum)', async ({ page }) => {
      const p = new ProblemPage(page);

      await p.selectProblem('subset_sum');

      // classic test: numbers include 4 and 5 -> target 9 is achievable
      await p.fillSubsetSum('3,34,4,12,5,2', 9);
      await p.clickSolveSubsetSum();

      await expect(p.subsetOutput).toHaveText('A subset with the target sum exists.');

      expect(pageErrors.length).toBe(0);
      expect(consoleMessages.some(m => m.type === 'error')).toBe(false);
    });
  });

  test.describe('Edge cases and error scenarios (ensure errors surface naturally)', () => {
    test('Knapsack with drastically negative capacity should cause runtime error (invalid array length)', async ({ page }) => {
      const p = new ProblemPage(page);

      await p.selectProblem('knapsack');

      // Provide inputs but set capacity to a very negative number to provoke Array(...) invalid length
      await p.fillKnapsack('1,2,3', '4,5,6', -9999);

      // We expect the click to cause an uncaught exception on the page.
      const [error] = await Promise.all([
        // wait for pageerror event
        page.waitForEvent('pageerror'),
        // trigger the action that will throw
        p.clickSolveKnapsack()
      ]);

      // Basic assertions that an exception occurred and mentions invalid array length or range error
      expect(error).toBeTruthy();
      const msg = String(error.message || error);
      // Accept several possible runtime error messages from JS engines
      const possibleIndicators = ['Invalid array length', 'RangeError', 'invalid array length'];
      expect(possibleIndicators.some(ind => msg.includes(ind))).toBe(true);
    });

    test('Subset Sum with negative target should cause runtime error (invalid array length)', async ({ page }) => {
      const p = new ProblemPage(page);

      await p.selectProblem('subset_sum');

      await p.fillSubsetSum('1,2,3', -42);

      // Expect an uncaught page error when code tries to create dp array of negative length
      const [error] = await Promise.all([
        page.waitForEvent('pageerror'),
        p.clickSolveSubsetSum()
      ]);

      expect(error).toBeTruthy();
      const msg = String(error.message || error);
      const possibleIndicators = ['Invalid array length', 'RangeError', 'invalid array length'];
      expect(possibleIndicators.some(ind => msg.includes(ind))).toBe(true);
    });

    test('Vertex Cover malformed edges input should not crash but may produce unexpected output (graceful handling)', async ({ page }) => {
      const p = new ProblemPage(page);

      await p.selectProblem('vertex_cover');

      // Provide malformed edges (non-numeric) to exercise robustness
      await p.fillVertexCover('a-b,foo-bar', 3);

      // Click solve and expect the function to attempt processing; we assert it does not throw an uncaught exception
      await p.clickSolveVertexCover();

      // If no uncaught exceptions, pageErrors array remains empty
      expect(pageErrors.length).toBe(0);

      // The output may contain "NaN" or empty entries depending on parsing; just check that the DOM was updated
      const out = await p.getVertexOutput();
      expect(typeof out).toBe('string');
    });
  });

  test.describe('Console monitoring and developer feedback', () => {
    test('No console.error messages appear during normal solve flows', async ({ page }) => {
      const p = new ProblemPage(page);

      // Run the three solves in sequence to get console coverage
      await p.selectProblem('knapsack');
      await p.fillKnapsack('1,2', '10,15', 3);
      await p.clickSolveKnapsack();

      await p.selectProblem('vertex_cover');
      await p.fillVertexCover('1-2,2-3', 3);
      await p.clickSolveVertexCover();

      await p.selectProblem('subset_sum');
      await p.fillSubsetSum('3,4,5', 9);
      await p.clickSolveSubsetSum();

      // Ensure no uncaught page errors
      expect(pageErrors.length).toBe(0);

      // Ensure console did not emit any error messages during the flows
      const errorMessages = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
      expect(errorMessages.length).toBe(0);
    });

    test('Capture console messages for diagnostics (non-failing capture)', async ({ page }) => {
      const p = new ProblemPage(page);

      // Perform a simple action to produce potential console output
      await p.selectProblem('knapsack');
      await p.fillKnapsack('2,3', '5,6', 4);
      await p.clickSolveKnapsack();

      // We assert that console messages array was collected (may be empty), and at least we recorded the activity
      expect(Array.isArray(consoleMessages)).toBe(true);
    });
  });
});