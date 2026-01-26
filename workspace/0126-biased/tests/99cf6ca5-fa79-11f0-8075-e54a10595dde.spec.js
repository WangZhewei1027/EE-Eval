import { test, expect } from '@playwright/test';

// Test file: 99cf6ca5-fa79-11f0-8075-e54a10595dde.spec.js
// Application URL (served by the test environment)
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cf6ca5-fa79-11f0-8075-e54a10595dde.html';

// Page Object Model for the Big-O Notation Explorer
class BigONotationPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Element handles / selectors
  algorithmSelector() { return this.page.locator('#algorithm'); }
  sizeInput() { return this.page.locator('#size'); }
  runButton() { return this.page.locator('#run'); }
  resetButton() { return this.page.locator('#reset'); }
  complexityDisplay() { return this.page.locator('#complexity'); }
  executionTimeDisplay() { return this.page.locator('#execution_time'); }
  operationsDisplay() { return this.page.locator('#operations'); }

  // Actions
  async selectAlgorithm(value) {
    await this.algorithmSelector().selectOption(value);
    // selection triggers 'change' event which calls getAlgorithmComplexity()
  }

  async setSize(value) {
    // Use fill so input event is triggered
    await this.sizeInput().fill(String(value));
    // The input listener will call getAlgorithmComplexity()
  }

  async clickRun() {
    await this.runButton().click();
  }

  async clickReset() {
    await this.resetButton().click();
  }

  // Getters for texts/values
  async getComplexityText() {
    return (await this.complexityDisplay().textContent()) ?? '';
  }

  async getExecutionTimeText() {
    return (await this.executionTimeDisplay().textContent()) ?? '';
  }

  async getOperationsText() {
    return (await this.operationsDisplay().textContent()) ?? '';
  }

  async getSelectedAlgorithmValue() {
    return await this.algorithmSelector().inputValue();
  }

  async getSizeValue() {
    return await this.sizeInput().inputValue();
  }
}

test.describe('Big-O Notation Explorer - FSM validation (Application ID: 99cf6ca5-fa79-11f0-8075-e54a10595dde)', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console events
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', (err) => {
      // err is an Error object
      pageErrors.push(String(err));
    });
  });

  // Validate S0_Idle entry action (getAlgorithmComplexity called on load)
  test('S0_Idle: On load the page should call getAlgorithmComplexity and populate complexity and operations', async ({ page }) => {
    const obj = new BigONotationPage(page);
    // Navigate to the app (this should run initialization code in the page)
    await obj.goto();

    // Verify complexity display (entry action should set complexity to selectedAlgorithm.toUpperCase())
    const complexity = await obj.getComplexityText();
    expect(complexity).toBe('CONSTANT'); // default select value is 'constant'

    // Verify operations display (constant algorithm returns 1 regardless of n)
    const operations = await obj.getOperationsText();
    expect(operations).toBe('Operation Count: 1');

    // Execution time should be empty on initial load
    const execTime = await obj.getExecutionTimeText();
    expect(execTime).toBe('');

    // Ensure no uncaught page errors or console errors occurred during initialization
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Transition S0 -> S1 (AlgorithmChange)
  test('S0 -> S1 (AlgorithmChange): Changing algorithm updates complexity and operations display', async ({ page }) => {
    const obj = new BigONotationPage(page);
    await obj.goto();

    // Change to 'linear' algorithm
    await obj.selectAlgorithm('linear');

    // complexityDisplay should be set to selectedAlgorithm.toUpperCase()
    const complexity = await obj.getComplexityText();
    expect(complexity).toBe('LINEAR');

    // Default input size is 10 so operations should reflect linear: 10
    const operations = await obj.getOperationsText();
    expect(operations).toBe('Operation Count: 10');

    // No page errors or console errors are expected
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Transition S1 -> S1 (InputSizeChange)
  test('S1 -> S1 (InputSizeChange): Changing input size updates operation counts without leaving Algorithm Selected state', async ({ page }) => {
    const obj = new BigONotationPage(page);
    await obj.goto();

    // Select quadratic algorithm
    await obj.selectAlgorithm('quadratic');
    // Set size to 5, should trigger input event and update operations
    await obj.setSize(5);

    // Complexity should remain QUADRATIC
    const complexity = await obj.getComplexityText();
    expect(complexity).toBe('QUADRATIC');

    // Quadratic operations: 5 * 5 = 25
    const operations = await obj.getOperationsText();
    expect(operations).toBe('Operation Count: 25');

    // Confirm no uncaught runtime errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Transition S1 -> S2 (RunAlgorithmClick)
  test('S1 -> S2 (RunAlgorithmClick): Running algorithm should compute and display simulated execution time', async ({ page }) => {
    const obj = new BigONotationPage(page);
    await obj.goto();

    // Choose logarithmic and set n = 8 (log2(8) = 3)
    await obj.selectAlgorithm('logarithmic');
    await obj.setSize(8);

    // Ensure operations updated
    const operations = await obj.getOperationsText();
    expect(operations).toBe('Operation Count: 3');

    // Click Run Algorithm -> runAlgorithm should be invoked and execution time displayed
    await obj.clickRun();

    // Execution time is operationsCount / 1000 + " ms" -> 3/1000 = 0.003 ms
    const execTime = await obj.getExecutionTimeText();
    expect(execTime).toBe('0.003 ms');

    // No uncaught page errors or console errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Transition S0 -> S3 (ResetClick)
  test('S0 -> S3 (ResetClick): Reset should restore default inputs and clear displays', async ({ page }) => {
    const obj = new BigONotationPage(page);
    await obj.goto();

    // Change algorithm and size to non-default values first
    await obj.selectAlgorithm('exponential');
    await obj.setSize(6); // 2^6 = 64 operations

    // Sanity check before reset
    expect(await obj.getSelectedAlgorithmValue()).toBe('exponential');
    expect(await obj.getSizeValue()).toBe('6');
    expect(await obj.getOperationsText()).toContain('64');

    // Now click reset (should call reset())
    await obj.clickReset();

    // After reset, input size should be 10 and algorithm value 'constant' per implementation
    expect(await obj.getSizeValue()).toBe('10');
    expect(await obj.getSelectedAlgorithmValue()).toBe('constant');

    // Displays should be cleared by reset implementation
    expect(await obj.getComplexityText()).toBe('');
    expect(await obj.getExecutionTimeText()).toBe('');
    expect(await obj.getOperationsText()).toBe('');

    // No uncaught page errors or console errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: Non-numeric input should lead to NaN in operations and execution time (verify graceful handling)
  test('Edge case: Non-numeric size input results in NaN displays (verify behavior for invalid input)', async ({ page }) => {
    const obj = new BigONotationPage(page);
    await obj.goto();

    // Select linear algorithm then input a non-numeric value into the number input
    await obj.selectAlgorithm('linear');
    // Fill with letters (this empties the field when browser enforces numeric, but Playwright fill will set value)
    await obj.sizeInput().fill('abc');

    // The page's input listener uses parseInt and will produce NaN -> operations display should show 'Operation Count: NaN'
    const operations = await obj.getOperationsText();
    expect(operations).toBe('Operation Count: NaN');

    // Running algorithm should produce 'NaN ms' in execution time
    await obj.clickRun();
    const execTime = await obj.getExecutionTimeText();
    expect(execTime).toBe('NaN ms');

    // This input scenario should not throw uncaught errors in the page runtime (just produce NaN results)
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: Large exponential computation to ensure numeric handling is correct
  test('Edge case: Exponential algorithm with larger n computes large operation counts and simulated time', async ({ page }) => {
    const obj = new BigONotationPage(page);
    await obj.goto();

    // Choose exponential and set n to 20 (2^20 = 1,048,576)
    await obj.selectAlgorithm('exponential');
    await obj.setSize(20);

    // Verify operations text
    const operations = await obj.getOperationsText();
    expect(operations).toBe('Operation Count: 1048576');

    // Run algorithm and verify execution_time display: 1048576 / 1000 = 1048.576 ms
    await obj.clickRun();
    const execTime = await obj.getExecutionTimeText();
    expect(execTime).toBe('1048.576 ms');

    // No page runtime errors expected here
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Final sanity check: listen to console and page errors across a sequence of interactions
  test('Sanity: Sequence of interactions should not produce uncaught page errors or console.error messages', async ({ page }) => {
    const obj = new BigONotationPage(page);
    await obj.goto();

    // Perform a series of interactions
    await obj.selectAlgorithm('linear');
    await obj.setSize(12);
    await obj.clickRun();

    await obj.selectAlgorithm('quadratic');
    await obj.setSize(3);
    await obj.clickRun();

    // Reset and perform another run
    await obj.clickReset();
    await obj.selectAlgorithm('logarithmic');
    await obj.setSize(16);
    await obj.clickRun();

    // Ensure no uncaught page errors or console.error were emitted across the sequence
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // For completeness, also ensure consoleMessages array captured messages (expected none in this app)
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });
});