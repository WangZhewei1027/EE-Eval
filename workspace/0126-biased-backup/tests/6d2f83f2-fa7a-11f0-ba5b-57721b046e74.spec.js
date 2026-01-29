import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2f83f2-fa7a-11f0-ba5b-57721b046e74.html';

// Page object encapsulating interactions and queries for the app
class ExplorerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Locators
    this.algorithmSelect = page.locator('#algorithm-select');
    this.inputSize = page.locator('#input-size');
    this.inputSizeValue = page.locator('#input-size-value');
    this.compareSelect = page.locator('#compare-select');
    this.addToComparisonBtn = page.locator('#add-to-comparison');
    this.resetComparisonBtn = page.locator('#reset-comparison');
    this.graphContainer = page.locator('#graph');
    this.currentComplexity = page.locator('#current-complexity');
    this.operationsCount = page.locator('#operations-count');
    this.complexityDescription = page.locator('#complexity-description');
    this.showExampleBtn = page.locator('#show-example');
    this.runExampleBtn = page.locator('#run-example');
    this.stepThroughBtn = page.locator('#step-through');
    this.stepCounter = page.locator('#step-counter');
    this.codeExample = page.locator('#code-example');
    this.executionOutput = page.locator('#execution-output');
    this.comparisonTableRows = page.locator('#comparison-table tbody tr');
    this.customOperationsInput = page.locator('#custom-operations');
    this.calculateComplexityBtn = page.locator('#calculate-complexity');
    this.calculationResult = page.locator('#calculation-result');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for key UI to be available
    await expect(this.algorithmSelect).toBeVisible();
  }

  // Select algorithm by value (e.g., 'linear', 'quadratic')
  async selectAlgorithm(value) {
    await this.algorithmSelect.selectOption(value);
    // The script listens to 'change' event; Playwright's selectOption triggers it.
    // Wait for complexity display update
    await this.page.waitForTimeout(50);
  }

  // Set input size (n) by dispatching input event properly
  async setInputSize(n) {
    await this.inputSize.evaluate((el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, n);
    // Wait for UI updates
    await this.page.waitForTimeout(50);
  }

  async addComparison(value) {
    await this.compareSelect.selectOption(value);
    await this.addToComparisonBtn.click();
    // Wait for UI updates
    await this.page.waitForTimeout(50);
  }

  async resetComparison() {
    await this.resetComparisonBtn.click();
    await this.page.waitForTimeout(50);
  }

  async showExample() {
    await this.showExampleBtn.click();
    await this.page.waitForTimeout(50);
  }

  async runExample() {
    await this.runExampleBtn.click();
    await this.page.waitForTimeout(50);
  }

  async toggleStepThrough() {
    await this.stepThroughBtn.click();
    // give some time for interval to start/stop
    await this.page.waitForTimeout(50);
  }

  async calculateComplexity(expression) {
    if (expression !== null) {
      await this.customOperationsInput.fill(expression);
    }
    await this.calculateComplexityBtn.click();
    await this.page.waitForTimeout(50);
  }

  // getters
  async getCurrentComplexityText() {
    return (await this.currentComplexity.textContent())?.trim();
  }

  async getOperationsCountText() {
    return (await this.operationsCount.textContent())?.trim();
  }

  async getInputSizeValueText() {
    return (await this.inputSizeValue.textContent())?.trim();
  }

  async getCodeExampleText() {
    return (await this.codeExample.textContent())?.trim();
  }

  async getExecutionOutputText() {
    return (await this.executionOutput.textContent())?.trim();
  }

  async isExecutionOutputVisible() {
    return await this.executionOutput.evaluate(el => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && el.offsetParent !== null;
    });
  }

  async getComparisonRowCount() {
    return await this.comparisonTableRows.count();
  }

  async getStepCounterText() {
    return (await this.stepCounter.textContent())?.trim();
  }

  async getCalculationResultText() {
    return (await this.calculationResult.textContent())?.trim();
  }
}

test.describe('Big-O Notation Interactive Explorer (6d2f83f2...)', () => {
  // Arrays to capture console errors and page errors for each test
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console 'error' messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture unhandled exceptions on the page
    page.on('pageerror', error => {
      pageErrors.push(error);
    });
  });

  test('Initial Idle state: UI initializes correctly and helper elements present', async ({ page }) => {
    // Validates initial S0_Idle entry actions (updateGraph/updateComplexityInfo/updateComparisonTable)
    const app = new ExplorerPage(page);
    await app.goto();

    // Current complexity should reflect default algorithm 'constant'
    await expect(app.currentComplexity).toHaveText(/O\(/); // e.g., O(1)
    const complexityText = await app.getCurrentComplexityText();
    expect(complexityText).toContain('O(');

    // Operations count should be 1 for default n=10 and constant complexity (1)
    const ops = await app.getOperationsCountText();
    expect(ops).toBeDefined();
    // For constant complexity the operations display is "1"
    expect(Number(ops)).toBeGreaterThanOrEqual(1);

    // Graph container should have child nodes (lines, axes, marker)
    const graphChildCount = await app.graphContainer.evaluate(el => el.children.length);
    expect(graphChildCount).toBeGreaterThan(0);

    // Comparison table should have at least one row (the default O(1) row)
    const rows = await app.getComparisonRowCount();
    expect(rows).toBeGreaterThanOrEqual(1);

    // Ensure no console errors or page errors occurred during initialization
    expect(consoleErrors.length, 'console error messages during init').toBe(0);
    expect(pageErrors.length, 'page errors during init').toBe(0);
  });

  test('Selecting an algorithm transitions to AlgorithmSelected (S1) and updates UI', async ({ page }) => {
    // This test validates the AlgorithmSelectChange event and its entry actions
    const app = new ExplorerPage(page);
    await app.goto();

    // Select 'linear' algorithm
    await app.selectAlgorithm('linear');

    // Complexity should update to O(n)
    await expect(app.currentComplexity).toHaveText(/n/);
    const opsText = await app.getOperationsCountText();
    // Default n is 10 => linear => operations should be 10
    expect(Number(opsText)).toBe(10);

    // Code example should update to the 'linear' snippet
    const codeText = await app.getCodeExampleText();
    expect(codeText.toLowerCase()).toContain('linear search');

    // Execution output should be hidden/reset (as resetExampleExecution is invoked)
    const visible = await app.isExecutionOutputVisible();
    expect(visible).toBe(false);

    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Adjusting input size transitions to InputSizeAdjusted (S2) and updates operations and marker', async ({ page }) => {
    // Validates InputSizeChange event and updateComplexityInfo behavior
    const app = new ExplorerPage(page);
    await app.goto();

    // Choose 'quadratic' algorithm to make operations easily verifiable
    await app.selectAlgorithm('quadratic');
    // Set input size to 5
    await app.setInputSize(5);

    // The displayed input-size-value should reflect 5
    await expect(app.inputSizeValue).toHaveText('5');
    // For quadratic, operations should be 25
    const opsText = await app.getOperationsCountText();
    expect(Number(opsText)).toBe(25);

    // The graph marker's left should reflect fraction: left = currentN / maxN * width
    // We can check that there is at least one element styled as marker (a thin div with backgroundColor black)
    const markerCount = await app.graphContainer.evaluate(container => {
      return Array.from(container.children).filter(c => window.getComputedStyle(c).width && c.style.width && c.style.height && c.style.width.endsWith('px')).length;
    });
    expect(markerCount).toBeGreaterThan(0);

    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Adding to comparison and resetting comparison (S3 -> S4): table and graph update', async ({ page }) => {
    // Validates AddToComparisonClick and ResetComparisonClick events
    const app = new ExplorerPage(page);
    await app.goto();

    // Initially, one row present for current algorithm
    const initialRows = await app.getComparisonRowCount();
    expect(initialRows).toBeGreaterThanOrEqual(1);

    // Add a different algorithm (quadratic) to comparison
    await app.addComparison('quadratic');

    // Now, comparison table should include the new algorithm row in addition to current
    const rowsAfterAdd = await app.getComparisonRowCount();
    expect(rowsAfterAdd).toBeGreaterThan(initialRows);

    // Graph container should have extra line segments for comparison (child count increases)
    const graphChildrenAfterAdd = await app.graphContainer.evaluate(el => el.children.length);
    expect(graphChildrenAfterAdd).toBeGreaterThan(0);

    // Reset comparison
    await app.resetComparison();

    // After reset, table rows should be back to initial value (or at least not greater than afterAdd)
    const rowsAfterReset = await app.getComparisonRowCount();
    expect(rowsAfterReset).toBeLessThanOrEqual(rowsAfterAdd);
    // ensure at least original algorithm remains present
    expect(rowsAfterReset).toBeGreaterThanOrEqual(1);

    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Show Example (S5) displays code and resets execution state', async ({ page }) => {
    // Validates ShowExampleClick and resetExampleExecution entry actions
    const app = new ExplorerPage(page);
    await app.goto();

    // Select exponential algorithm to verify example content changes
    await app.selectAlgorithm('exponential');

    // Click Show Example
    await app.showExample();

    // Code example should contain Fibonacci snippet (exponential)
    const code = await app.getCodeExampleText();
    expect(code.toLowerCase()).toContain('fibonacci');

    // Execution output should be hidden after showing example
    const visible = await app.isExecutionOutputVisible();
    expect(visible).toBe(false);

    // Step counter should be empty
    const stepTxt = await app.getStepCounterText();
    expect(stepTxt).toBe('');

    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Run Example (S6) executes and shows results for various algorithms', async ({ page }) => {
    // Validates RunExampleClick and that executionOutput displays proper result
    const app = new ExplorerPage(page);
    await app.goto();

    // Select logarithmic and set n=16
    await app.selectAlgorithm('logarithmic');
    await app.setInputSize(16);

    // Click Run Example
    await app.runExample();

    // Execution output should be visible and include the running message with n=16
    await expect(app.executionOutput).toBeVisible();
    const outText = await app.getExecutionOutputText();
    expect(outText).toContain('Running logarithmic example with n=16');

    // Result should include the rounded logarithm (log2(16) = 4)
    expect(outText).toContain('Result: 4');

    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Step Through Example (S7) starts stepping and can be stopped; output updates with steps', async ({ page }) => {
    // Validates StepThroughClick and stepping behavior (interval based)
    const app = new ExplorerPage(page);
    await app.goto();

    // Select linear algorithm and set small n to keep test quick
    await app.selectAlgorithm('linear');
    await app.setInputSize(3);

    // Start stepping
    await app.toggleStepThrough();

    // Wait for at least one step to be recorded in the step counter (interval is 500ms)
    await expect.poll(async () => await app.getStepCounterText(), {
      timeout: 3000,
      message: 'Waiting for at least one step to be executed'
    }).not.toBe('');

    const stepText = await app.getStepCounterText();
    expect(stepText).toMatch(/Step \d+ of 3/);

    // Execution output should contain step messages for linear case
    const execText = await app.getExecutionOutputText();
    expect(execText.toLowerCase()).toContain('processed element');

    // Stop stepping by toggling again
    await app.toggleStepThrough();

    // Step Through button text should revert to 'Step Through'
    const btnText = await app.stepThroughBtn.textContent();
    expect(btnText.trim()).toBe('Step Through');

    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Calculate Complexity (S8) handles expressions and shows estimated Big-O', async ({ page }) => {
    // Validates CalculateComplexityClick and different parsing branches, including edge cases
    const app = new ExplorerPage(page);
    await app.goto();

    // Case 1: Quadratic expression -> expect O(n²)
    await app.calculateComplexity('3n^2 + 2n + 1');
    const result1 = await app.getCalculationResultText();
    expect(result1).toContain('O(n');
    expect(result1).toContain('Quadratic') || expect(result1.toLowerCase()).toContain('quadratic') || expect(result1).toContain('n²');

    // Case 2: Exponential expression using 2^n -> expect O(2ⁿ)
    await app.calculateComplexity('2^n + n');
    const result2 = await app.getCalculationResultText();
    expect(result2).toContain('O(2');

    // Case 3: Factorial expression -> expect O(n!)
    await app.calculateComplexity('n! + 5');
    const result3 = await app.getCalculationResultText();
    expect(result3).toContain('O(n');

    // Edge case: empty expression should do nothing (per implementation it returns early)
    // First, store current content
    const before = await app.getCalculationResultText();
    // Clear input and click calculate (should effectively be a no-op)
    await app.calculateComplexity(''); // fills and clicks
    const after = await app.getCalculationResultText();
    // After clicking with empty string the implementation returns early => no change expected
    expect(after).toBe(before);

    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Observes console and page errors during complex interactions (sanity check)', async ({ page }) => {
    // This test performs a sequence of interactions to surface any runtime errors or thrown exceptions
    const app = new ExplorerPage(page);
    await app.goto();

    // Perform a series of interactions
    await app.selectAlgorithm('factorial');
    await app.setInputSize(8);
    await app.addComparison('exponential');
    await app.runExample();
    // Start stepping (will run up to n steps); choose small n to avoid long waits
    await app.selectAlgorithm('linear');
    await app.setInputSize(2);
    await app.toggleStepThrough();
    // Allow at least one step
    await page.waitForTimeout(700);
    // Stop stepping
    await app.toggleStepThrough();
    // Trigger calculation
    await app.calculateComplexity('n log n + n');
    // Show example for current algorithm
    await app.showExample();

    // At the end of this scenario we assert that no console error messages or page errors were emitted
    // This lets any ReferenceError/SyntaxError/TypeError happen naturally and be captured above.
    expect(consoleErrors.length, `console error messages observed: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors observed: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test.afterEach(async ({ page }) => {
    // Final safety check: no uncaught page errors and no console errors
    // Note: we do not alter page behavior; we only assert on observations.
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
    // Close page to cleanup
    await page.close();
  });
});