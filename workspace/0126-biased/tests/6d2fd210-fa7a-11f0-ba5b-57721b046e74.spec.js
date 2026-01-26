import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2fd210-fa7a-11f0-ba5b-57721b046e74.html';

// Page object encapsulating interactions and common assertions
class TimeComplexityPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.algorithmSelect = page.locator('#algorithm-select');
    this.inputSize = page.locator('#input-size');
    this.runButton = page.locator('#run-algorithm');
    this.stepButton = page.locator('#step-algorithm');
    this.resetButton = page.locator('#reset-algorithm');
    this.algorithmResults = page.locator('#algorithm-results');
    this.algorithmVisualization = page.locator('#algorithm-visualization');

    this.sizeRange = page.locator('#size-range');
    this.sizeValue = page.locator('#size-value');
    this.compareButton = page.locator('#compare-button');
    this.comparisonResults = page.locator('#comparison-results');
    this.complexityChart = page.locator('#complexity-chart');

    this.showExamples = page.locator('#show-examples');
    this.codeExamples = page.locator('#code-examples');

    this.complexityType = page.locator('#complexity-type');
    this.calcInputSize = page.locator('#calc-input-size');
    this.calculateButton = page.locator('#calculate-button');
    this.calculationResults = page.locator('#calculation-results');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the main heading to ensure page loaded
    await this.page.locator('h1', { hasText: 'Time Complexity Explorer' }).waitFor();
  }

  // Helpers to set range input with proper input event dispatch
  async setRangeValueAndDispatch(value) {
    await this.page.$eval('#size-range', (el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }

  async setCalcInputSizeAndDispatch(value) {
    await this.page.fill('#calc-input-size', String(value));
  }

  // Select complexity type by value (option values from HTML)
  async selectComplexityType(value) {
    await this.page.selectOption('#complexity-type', value);
  }

  // Select algorithm by value
  async selectAlgorithm(value) {
    await this.page.selectOption('#algorithm-select', value);
  }

  // Fill input size
  async setInputSize(value) {
    await this.page.fill('#input-size', String(value));
  }
}

test.describe('Time Complexity Explorer - FSM behavior and UI tests', () => {
  let page;
  let tcp;
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Capture console errors and page errors for assertions regarding runtime exceptions
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // Record console.error messages for later assertions
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text() });
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    tcp = new TimeComplexityPage(page);
    await tcp.goto();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.describe('Initial Idle State (S0_Idle)', () => {
    test('Page loads in Idle state and shows initial instructions (S0_Idle)', async () => {
      // Verify initial algorithm results show the idle message
      await expect(tcp.algorithmResults).toHaveText(/Select an algorithm and input size to begin\./);
      // Size range default value is displayed
      await expect(tcp.sizeValue).toHaveText('100');
      // No console or page errors on initial load expected
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Algorithm Simulator states and transitions', () => {
    test('Run algorithm transitions to Algorithm Running (S1_AlgorithmRunning) and displays results', async () => {
      // Use default algorithm (linear) and default input size (10)
      await tcp.selectAlgorithm('linear');
      await tcp.setInputSize(10);

      // Click Run Algorithm -> should display algorithm summary and visualization
      await tcp.runButton.click();

      // Assert algorithm results contain expected pieces
      await expect(tcp.algorithmResults).toContainText('Algorithm: Linear Search');
      await expect(tcp.algorithmResults).toContainText('Input Size: 10');
      await expect(tcp.algorithmResults).toContainText('Time Complexity: O(n)');

      // Visualization should have at least one child (final state visualization)
      const vizChildren = await tcp.algorithmVisualization.locator('div').count();
      expect(vizChildren).toBeGreaterThan(0);
    });

    test('Step through algorithm transitions to Algorithm Stepping (S2_AlgorithmStepping) and increments steps', async () => {
      // Start stepping through the algorithm (without running first) to exercise the branch where steps are initialized in step handler
      await tcp.selectAlgorithm('linear');
      await tcp.setInputSize(5);

      // Click Step Through -> should initialize steps and show step 1
      await tcp.stepButton.click();

      await expect(tcp.algorithmResults).toContainText('Step 1 of');
      await expect(tcp.algorithmResults).toContainText('Current operation:');

      // Click Step Through repeatedly to ensure S2 -> S2 transition occurs
      // We'll click more times than size to trigger completed branch
      for (let i = 0; i < 6; i++) {
        await tcp.stepButton.click();
      }

      // After exhausting steps, result should indicate completion
      await expect(tcp.algorithmResults).toHaveText('Algorithm completed!').catch(async () => {
        // Some implementations may write additional whitespace; use contains check as fallback
        await expect(tcp.algorithmResults).toContainText('Algorithm completed!');
      });
    });

    test('While stepping, clicking Run Algorithm returns to Algorithm Running (S2 -> S1)', async () => {
      await tcp.selectAlgorithm('linear');
      await tcp.setInputSize(6);

      // Step once to enter stepping state
      await tcp.stepButton.click();
      await expect(tcp.algorithmResults).toContainText('Step 1 of');

      // Now click Run Algorithm which should show running summary again
      await tcp.runButton.click();
      await expect(tcp.algorithmResults).toContainText('Algorithm: Linear Search');
      await expect(tcp.algorithmResults).toContainText('Operations:');
    });

    test('Reset algorithm transitions to Algorithm Reset (S3_AlgorithmReset) and clears visualization', async () => {
      // Run an algorithm to have content
      await tcp.selectAlgorithm('linear');
      await tcp.setInputSize(5);
      await tcp.runButton.click();
      const beforeChildren = await tcp.algorithmVisualization.locator('div').count();
      expect(beforeChildren).toBeGreaterThan(0);

      // Click Reset
      await tcp.resetButton.click();

      // Expect reset message and cleared visualization
      await expect(tcp.algorithmResults).toHaveText('Algorithm reset.');
      await expect(tcp.algorithmVisualization).toHaveText('', { timeout: 2000 });
    });

    test('From reset (S3) running again returns to Idle -> Running (S3 -> S0 -> S1)', async () => {
      // Reset first to ensure in S3
      await tcp.resetButton.click();
      await expect(tcp.algorithmResults).toHaveText('Algorithm reset.');

      // Now click run to start again
      await tcp.selectAlgorithm('binary');
      await tcp.setInputSize(8);
      await tcp.runButton.click();

      await expect(tcp.algorithmResults).toContainText('Algorithm: Binary Search');
      await expect(tcp.algorithmResults).toContainText('Time Complexity: O(log n)');
    });
  });

  test.describe('Code Examples visibility (S4 <-> S5)', () => {
    test('Show code examples toggles visibility: S0 -> S4 (visible) then S5 (hidden) then S4 again', async () => {
      // Initially hidden
      await expect(tcp.codeExamples).toBeHidden();
      await expect(tcp.showExamples).toHaveText('Show Code Examples');

      // Click to show -> S4
      await tcp.showExamples.click();
      await expect(tcp.codeExamples).toBeVisible();
      await expect(tcp.showExamples).toHaveText('Hide Code Examples');

      // Click to hide -> S5
      await tcp.showExamples.click();
      await expect(tcp.codeExamples).toBeHidden();
      await expect(tcp.showExamples).toHaveText('Show Code Examples');

      // Click to show again -> S4
      await tcp.showExamples.click();
      await expect(tcp.codeExamples).toBeVisible();
      await expect(tcp.showExamples).toHaveText('Hide Code Examples');
    });
  });

  test.describe('Complexity Comparison (S7_ComplexityComparison)', () => {
    test('Changing the size range updates displayed value and compare shows results', async () => {
      // Set the range to a new value and dispatch input event
      await tcp.setRangeValueAndDispatch(250);
      await expect(tcp.sizeValue).toHaveText('250');

      // Click compare to generate comparison results and draw the chart
      await tcp.compareButton.click();
      await expect(tcp.comparisonResults).toHaveText(/Comparing time complexities up to input size 250/);

      // Canvas should exist; ensure drawing code executed (no errors)
      const ctxAvailable = await page.$eval('#complexity-chart', (canvas) => !!canvas.getContext);
      expect(ctxAvailable).toBe(true);
    });
  });

  test.describe('Complexity Calculator (S6_ComplexityCalculated) and edge cases', () => {
    test('Calculate operations for O(n) complexity returns expected estimated operations', async () => {
      // Choose O(n)
      await tcp.selectComplexityType('n');
      // Set input size to 50
      await tcp.setCalcInputSizeAndDispatch(50);
      // Click calculate
      await tcp.calculateButton.click();

      // Should display calculation results with Complexity O(n) and estimated operations 50.00
      await expect(tcp.calculationResults).toContainText('For input size 50:');
      await expect(tcp.calculationResults).toContainText('Complexity: O(n)');
      await expect(tcp.calculationResults).toContainText('Estimated operations: 50.00');
    });

    test('Calculate operations for O(log n) uses Math.log2 and shows fractional result', async () => {
      await tcp.selectComplexityType('logn');
      await tcp.setCalcInputSizeAndDispatch(8); // log2(8) == 3
      await tcp.calculateButton.click();

      await expect(tcp.calculationResults).toContainText('For input size 8:');
      await expect(tcp.calculationResults).toContainText('Complexity: O(log n)');
      await expect(tcp.calculationResults).toContainText('Estimated operations: 3.00');
    });

    test('Calculate operations for factorial uses recursive function and displays a numeric result for small n', async () => {
      // Use factorial with a modest size to avoid huge numbers
      await tcp.selectComplexityType('nfact');
      await tcp.setCalcInputSizeAndDispatch(8); // 8! = 40320
      await tcp.calculateButton.click();

      await expect(tcp.calculationResults).toContainText('For input size 8:');
      await expect(tcp.calculationResults).toContainText('Complexity: O(n!)');
      // Estimated operations should be a number with two decimals (40320.00)
      await expect(tcp.calculationResults).toContainText('Estimated operations: 40320.00');
    });

    test('Edge case: extremely large exponential calculation may produce runtime error (intentional observation)', async () => {
      // Reset captured error arrays for this test specifically
      consoleErrors = [];
      pageErrors = [];
      // Choose exponential growth 2^n
      await tcp.selectComplexityType('2n');
      // Set a very large input size that will produce Infinity for Math.pow(2, n)
      await tcp.setCalcInputSizeAndDispatch(10000);
      // Click calculate - this may cause operations to be Infinity and then operations.toFixed will throw
      await tcp.calculateButton.click();

      // Wait briefly for any pageerror event to fire
      await page.waitForTimeout(500);

      // We expect at least one pageerror or console error to have occurred due to toFixed on a non-finite number
      // The test framework must not patch the page; we just assert the runtime naturally produced an error
      expect(pageErrors.length + consoleErrors.length).toBeGreaterThan(0);
    });
  });

  test.describe('Cross-state interactions and robustness', () => {
    test('Full interaction flow exercising multiple transitions', async () => {
      // Idle -> Run (S0 -> S1)
      await tcp.selectAlgorithm('bubble');
      await tcp.setInputSize(4);
      await tcp.runButton.click();
      await expect(tcp.algorithmResults).toContainText('Algorithm: Bubble Sort');
      await expect(tcp.algorithmResults).toContainText('Time Complexity: O(n²)');

      // S1 -> S2 via Step
      await tcp.stepButton.click();
      await expect(tcp.algorithmResults).toContainText('Step');

      // S2 -> S2 via additional Step
      await tcp.stepButton.click();
      await expect(tcp.algorithmResults).toContainText('Step');

      // S2 -> S1 by clicking Run again
      await tcp.runButton.click();
      await expect(tcp.algorithmResults).toContainText('Algorithm: Bubble Sort');

      // S1 -> S3 via Reset
      await tcp.resetButton.click();
      await expect(tcp.algorithmResults).toHaveText('Algorithm reset.');

      // S3 -> S0 via Run (run after reset)
      await tcp.selectAlgorithm('merge');
      await tcp.setInputSize(6);
      await tcp.runButton.click();
      await expect(tcp.algorithmResults).toContainText('Algorithm: Merge Sort');
      await expect(tcp.algorithmResults).toContainText('Time Complexity: O(n log n)');
    });

    test('Size range input updates UI reliably (SizeRangeInput event)', async () => {
      // Set to multiple values and ensure displayed value updates
      for (const val of [10, 500, 999]) {
        await tcp.setRangeValueAndDispatch(val);
        await expect(tcp.sizeValue).toHaveText(String(val));
      }
    });
  });

  test.describe('Observability: ensure we capture console and page errors during normal operations', () => {
    test('No unexpected errors during standard interactions', async () => {
      // Reset captured error arrays
      consoleErrors = [];
      pageErrors = [];

      // Perform a set of normal operations unlikely to error
      await tcp.selectAlgorithm('linear');
      await tcp.setInputSize(20);
      await tcp.runButton.click();

      await tcp.stepButton.click();
      await tcp.stepButton.click();

      await tcp.resetButton.click();

      await tcp.selectComplexityType('n');
      await tcp.setCalcInputSizeAndDispatch(100);
      await tcp.calculateButton.click();

      // Small wait to let any errors bubble up
      await page.waitForTimeout(250);

      // For these normal operations we expect no page errors or console error messages
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });
});