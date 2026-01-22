import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79e0030-d361-11f0-8438-11a56595a476.html';

// Page object for interacting with the Two Pointers demo
class TwoPointersPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#arrayInput');
    this.targetInput = page.locator('#targetInput');
    this.runBtn = page.locator('#runBtn');
    this.resultText = page.locator('#resultText');
    this.visualOutput = page.locator('#visualOutput');
    this.header = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getHeaderText() {
    return this.header.textContent();
  }

  async getArrayValue() {
    return this.arrayInput.inputValue();
  }

  async getTargetValue() {
    return this.targetInput.inputValue();
  }

  async setArray(value) {
    await this.arrayInput.fill('');
    await this.arrayInput.fill(value);
  }

  // Use evaluate to set .value for numeric input in case of non-numeric strings
  async setTarget(value) {
    await this.page.evaluate(
      ({ selector, val }) => (document.querySelector(selector).value = val),
      { selector: '#targetInput', val: value }
    );
  }

  async clickRun() {
    await this.runBtn.click();
  }

  async getResultText() {
    return this.resultText.textContent();
  }

  async getVisualText() {
    return this.visualOutput.textContent();
  }

  // Wait until resultText contains the expected substring (with timeout)
  async waitForResultContains(substring, timeout = 15000) {
    await this.page.waitForFunction(
      (sel, substr) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.includes(substr);
      },
      '#resultText',
      substring,
      { timeout }
    );
  }

  // Wait until visualOutput contains substring
  async waitForVisualContains(substring, timeout = 15000) {
    await this.page.waitForFunction(
      (sel, substr) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.includes(substr);
      },
      '#visualOutput',
      substring,
      { timeout }
    );
  }
}

test.describe('Two Pointers Technique Demo - FSM state & transitions validation', () => {
  // Collect console errors and page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', (err) => {
      // Uncaught exceptions bubble here
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // No global teardown needed beyond Playwright's automatic cleanup
  });

  test('S0_Idle: Page renders correctly with initial UI present', async ({ page }) => {
    // Validate initial idle state: header, default inputs, empty results
    const tp = new TwoPointersPage(page);
    await tp.goto();

    // Header present and matches expected title
    await expect(tp.header).toHaveText('Two Pointers Technique Demo');

    // Default input values as described in implementation
    const arrVal = await tp.getArrayValue();
    expect(arrVal.trim()).toBe('1,2,3,4,5,6,7,8,9,10');

    const targetVal = await tp.getTargetValue();
    // numeric input returns '15' by default per HTML
    expect(targetVal.trim()).toBe('15');

    // Results area should be empty initially
    const resultInitial = await tp.getResultText();
    expect(resultInitial).toBeTruthy(); // textContent returns '' or null -> ensure exists
    expect(resultInitial.trim()).toBe(''); // empty at idle

    const visualInitial = await tp.getVisualText();
    expect(visualInitial).toBeTruthy();
    expect(visualInitial.trim()).toBe('');

    // Assert no console or page errors on initial load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Valid input processing and final states', () => {
    test('S4_PairFound: Finds a pair for default array and target=15 and displays visualization', async ({ page }) => {
      // This test validates the transition S0_Idle -> S2_ValidInput -> S4_PairFound
      const tp = new TwoPointersPage(page);
      await tp.goto();

      // Collect any console/page errors during this test
      const localConsoleErrors = [];
      const localPageErrors = [];
      page.on('console', (msg) => { if (msg.type() === 'error') localConsoleErrors.push(msg.text()); });
      page.on('pageerror', (err) => { localPageErrors.push(err); });

      // Click run - default inputs should find a pair (5 + 10 = 15)
      await tp.clickRun();

      // Wait for the result to indicate a pair found (animation may take several secs)
      await tp.waitForResultContains('Pair found:', 15000);

      const result = await tp.getResultText();
      expect(result).toContain('Pair found:');

      // Expect the pair to be the indices for values 5 and 10 (arr[4] = 5, arr[9] = 10)
      expect(result).toContain('arr[4] = 5');
      expect(result).toContain('arr[9] = 10');
      expect(result).toContain('sum = 15');

      // Visualization should show pointers for the found pair (L/R or X)
      const vis = await tp.getVisualText();
      // Should include either L or R or X markers in visual representation
      expect(vis.length).toBeGreaterThan(0);
      expect(/L|R|X/.test(vis)).toBe(true);

      // The visual output should also include a numeric sum display at some point in animation lines
      // e.g. "1 + 10 = 11" style content appears during steps
      expect(vis.includes('+') || vis.includes('=')).toBe(true);

      // Assert no JS runtime errors occurred during this successful flow
      expect(localConsoleErrors.length).toBe(0);
      expect(localPageErrors.length).toBe(0);
    });

    test('S3_NoPairFound: When no two elements sum to target, show "No pair found" final state', async ({ page }) => {
      // Validate S0 -> S2 -> S3 transition
      const tp = new TwoPointersPage(page);
      await tp.goto();

      // Use a target that cannot be formed by any pair in the array
      await tp.setArray('1,2,3,4,5');
      await tp.setTarget('100'); // big target
      await tp.clickRun();

      // Wait for result to display "No pair found" (animation has to finish)
      await tp.waitForResultContains('No pair found that sums to 100.', 10000);

      const result = await tp.getResultText();
      expect(result).toContain('No pair found that sums to 100.');

      // Visual output should be cleared for final no-pair scenario
      const vis = await tp.getVisualText();
      expect(vis.trim()).toBe('');

      // No uncaught exceptions expected
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Error and edge-case handling', () => {
    test('S1_Error: Parsing error for unsorted array triggers error message', async ({ page }) => {
      // This exercise ensures S2_ValidInput -> S1_Error guard is triggered
      const tp = new TwoPointersPage(page);
      await tp.goto();

      // Provide an unsorted array which should cause parseArray to throw
      await tp.setArray('5,3,1');
      // Keep a valid numeric target
      await tp.setTarget('10');

      // Click run and expect immediate error message (no animation)
      await tp.clickRun();

      // Since parseArray throws synchronously, resultText should be set right away
      await tp.page.waitForFunction(
        () => document.querySelector('#resultText') && document.querySelector('#resultText').textContent.length > 0,
        null,
        { timeout: 2000 }
      );

      const result = await tp.getResultText();
      expect(result).toContain('Error parsing array:');
      expect(result).toContain('Array must be sorted in non-decreasing order.');

      // Ensure no uncaught JS runtime errors resulted
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('S1_Error: Parsing error for non-integer token in array', async ({ page }) => {
      const tp = new TwoPointersPage(page);
      await tp.goto();

      // Invalid token 'a' should cause parseArray to throw a descriptive error
      await tp.setArray('1,2,a,4');
      await tp.setTarget('7');
      await tp.clickRun();

      await tp.page.waitForFunction(
        () => document.querySelector('#resultText') && document.querySelector('#resultText').textContent.length > 0,
        null,
        { timeout: 2000 }
      );

      const result = await tp.getResultText();
      expect(result).toContain('Error parsing array:');
      expect(result).toContain('"a" is not a valid integer.');

      // No uncaught runtime errors expected
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Edge case: Array with less than two elements shows validation message', async ({ page }) => {
      // Validate the "Array must have at least two elements." branch
      const tp = new TwoPointersPage(page);
      await tp.goto();

      await tp.setArray('42'); // single element
      await tp.setTarget('42');
      await tp.clickRun();

      // Immediate validation message expected
      await tp.page.waitForFunction(
        () => document.querySelector('#resultText') && document.querySelector('#resultText').textContent.length > 0,
        null,
        { timeout: 2000 }
      );

      const result = await tp.getResultText();
      expect(result).toContain('Array must have at least two elements.');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Edge case: Invalid target value displays "Invalid target value."', async ({ page }) => {
      // Provide a valid array but an invalid (non-numeric) target value
      const tp = new TwoPointersPage(page);
      await tp.goto();

      await tp.setArray('1,2,3,4');
      // Use evaluate to set the value property to a non-numeric string, bypassing number input restrictions
      await tp.setTarget('not-a-number');
      await tp.clickRun();

      // Should immediately show invalid target message
      await tp.page.waitForFunction(
        () => document.querySelector('#resultText') && document.querySelector('#resultText').textContent.includes('Invalid target value.'),
        null,
        { timeout: 2000 }
      );

      const result = await tp.getResultText();
      expect(result).toContain('Invalid target value.');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test('Comprehensive: multiple interactions and verification of console/page errors', async ({ page }) => {
    // This test runs several interactions in sequence to ensure transitions are robust
    const tp = new TwoPointersPage(page);
    await tp.goto();

    const localConsoleErrors = [];
    const localPageErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') localConsoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => { localPageErrors.push(err); });

    // 1) Valid run (pair found)
    await tp.setArray('1,2,3,4,5,6');
    await tp.setTarget('7'); // 1+6, etc -> pair exists
    await tp.clickRun();
    await tp.waitForResultContains('Pair found:', 10000);
    expect((await tp.getResultText()).includes('Pair found:')).toBe(true);

    // 2) Invalid target
    await tp.setTarget('');
    await tp.clickRun();
    await tp.page.waitForFunction(
      () => document.querySelector('#resultText') && document.querySelector('#resultText').textContent.length > 0,
      null,
      { timeout: 2000 }
    );
    expect((await tp.getResultText()).includes('Invalid target value.')).toBe(true);

    // 3) Unsorted array error
    await tp.setArray('3,1,2');
    await tp.setTarget('4');
    await tp.clickRun();
    await tp.page.waitForFunction(
      () => document.querySelector('#resultText') && document.querySelector('#resultText').textContent.includes('Error parsing array:'),
      null,
      { timeout: 2000 }
    );
    expect((await tp.getResultText()).includes('Error parsing array:')).toBe(true);

    // 4) No pair found case
    await tp.setArray('1,2,3');
    await tp.setTarget('1000');
    await tp.clickRun();
    await tp.waitForResultContains('No pair found that sums to 1000.', 10000);
    expect((await tp.getResultText()).includes('No pair found that sums to 1000.')).toBe(true);

    // Assert that no uncaught console/page errors happened during the sequence
    expect(localConsoleErrors.length).toBe(0);
    expect(localPageErrors.length).toBe(0);
  });
});