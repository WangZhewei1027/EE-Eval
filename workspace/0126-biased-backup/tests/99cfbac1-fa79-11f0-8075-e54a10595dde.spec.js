import { test, expect } from '@playwright/test';

// Test file for Application ID: 99cfbac1-fa79-11f0-8075-e54a10595dde
// URL served at:
// http://127.0.0.1:5500/workspace/0126-biased/html/99cfbac1-fa79-11f0-8075-e54a10595dde.html
//
// This test suite validates the FSM states and transitions described in the prompt:
// - S0_Idle (initial render)
// - S1_OperationExecuted (execute button updates #result)
// - S2_Reset (reset clears state and input)
//
// It also observes console messages and page errors (capturing runtime errors if any).
// Tests are written in ES module syntax, use async/await, and follow Playwright best practices.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cfbac1-fa79-11f0-8075-e54a10595dde.html';

// Page Object representing the Amortized Analysis Demo page.
class AmortizedPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.operation = page.locator('#operation');
    this.sizeInput = page.locator('#size');
    this.executeBtn = page.locator('#execute');
    this.resetBtn = page.locator('#reset');
    this.result = page.locator('#result');
    this.header = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getHeaderText() {
    return this.header.innerText();
  }

  async selectOperation(opValue) {
    await this.operation.selectOption(opValue);
  }

  async setSize(value) {
    // clear and fill to ensure deterministic input
    await this.sizeInput.fill(String(value));
  }

  async clickExecute() {
    await Promise.all([
      this.page.waitForResponse(resp => resp.status() === 404).catch(() => null), // harmless, just to allow parallelism
      this.executeBtn.click()
    ]);
    // Wait for #result to have some content - it's synchronous JS but we wait for locator to update
    await expect(this.result).toBeVisible();
  }

  async clickExecuteAndWaitForResult() {
    // Click and wait for the result text to change - capture previous text to ensure change.
    const prev = await this.result.innerText().catch(() => '');
    await this.executeBtn.click();
    await this.page.waitForFunction(
      (selector, previous) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        return el.innerText.trim() !== previous.trim();
      },
      this.result.selector,
      prev
    );
  }

  async clickReset() {
    await this.resetBtn.click();
    // After reset, result should be empty string
    await this.page.waitForFunction(selector => {
      const el = document.querySelector(selector);
      return el && el.innerHTML === '';
    }, this.result.selector);
  }

  async getResultText() {
    return this.result.innerText();
  }

  async getSizeValue() {
    return this.sizeInput.inputValue();
  }
}

test.describe('Amortized Analysis Interactive Demo - FSM validation', () => {
  // Capture console errors and page errors for each test to ensure no unexpected runtime exceptions.
  test.beforeEach(async ({ page }) => {
    // attach empty arrays to the test Info via page to gather errors per test
    page._consoleErrors = [];
    page._pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        page._consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    page.on('pageerror', err => {
      page._pageErrors.push({
        message: err.message,
        stack: err.stack
      });
    });
  });

  test.afterEach(async ({ page }) => {
    // Assert that no console errors or page errors occurred during the test.
    // If there are errors, include them in the assertion message for easier debugging.
    const consoleErrors = page._consoleErrors || [];
    const pageErrors = page._pageErrors || [];

    const combined = [...consoleErrors.map(e => `CONSOLE_ERROR: ${e.text}`), ...pageErrors.map(e => `PAGE_ERROR: ${e.message}`)];
    expect(combined, `Unexpected console/page errors:\n${combined.join('\n')}`).toEqual([]);
  });

  test('S0_Idle: Page renders correctly with header, controls, and empty result', async ({ page }) => {
    // Validate initial Idle state rendering and default values.
    const app = new AmortizedPage(page);
    await app.goto();

    // Verify header exists and matches expected title from FSM evidence.
    await expect(app.header).toHaveText('Amortized Analysis Interactive Demo');

    // Verify controls exist and default values are correct.
    await expect(app.operation).toBeVisible();
    await expect(app.sizeInput).toHaveValue('0'); // default input value is "0"
    await expect(app.executeBtn).toBeVisible();
    await expect(app.resetBtn).toBeVisible();

    // Result should be empty in Idle state.
    await expect(app.result).toBeVisible();
    const resultText = await app.getResultText();
    expect(resultText.trim(), 'Result should be empty on initial load').toBe('');
  });

  test('S1_OperationExecuted: Execute "insert" with size 0 updates result with expected costs', async ({ page }) => {
    // This test triggers ExecuteOperation transition from Idle -> Operation Executed.
    // It validates that the result.innerHTML is updated and contents reflect the expected values.
    const app = new AmortizedPage(page);
    await app.goto();

    // Ensure operation = insert and size = 0
    await app.selectOperation('insert');
    await app.setSize(0);

    // Execute and wait for result update
    await app.clickExecuteAndWaitForResult();

    // Validate result content includes expected lines.
    const text = await app.getResultText();
    expect(text).toContain('Operation: insert');
    // currentSize increments from 0 to 1 internally
    expect(text).toContain('Current Size: 1');
    // current cost should be 1 (insert basic cost) since sizeInput was 0
    expect(text).toContain('Current Cost: 1');
    // total cost should be 1 and amortized = 1.00
    expect(text).toContain('Total Cost: 1');
    expect(text).toContain('Amortized Cost: 1.00');
  });

  test('S1_OperationExecuted: Execute "insert" with size >= 1 adds extra cost', async ({ page }) => {
    // Validate insert when input size >= 1 triggers extra increment to cost.
    const app = new AmortizedPage(page);
    await app.goto();

    // Set size input to 2 to simulate array growth scenario
    await app.selectOperation('insert');
    await app.setSize(2);

    await app.clickExecuteAndWaitForResult();

    const text = await app.getResultText();
    expect(text).toContain('Operation: insert');
    // current cost should be 2 (1 base + 1 for growing)
    expect(text).toContain('Current Cost: 2');
    expect(text).toContain('Total Cost: 2');
    expect(text).toContain('Amortized Cost: 2.00');
    // currentSize should still reflect +1 from initial internal 0 -> 1
    expect(text).toContain('Current Size: 1');
  });

  test('S1_OperationExecuted: Execute "delete" with size 0 produces zero cost and does not decrement below 0', async ({ page }) => {
    // Edge case: deleting when nothing to delete should have 0 cost.
    const app = new AmortizedPage(page);
    await app.goto();

    await app.selectOperation('delete');
    await app.setSize(0);

    await app.clickExecuteAndWaitForResult();

    const text = await app.getResultText();
    expect(text).toContain('Operation: delete');
    expect(text).toContain('Current Cost: 0');
    // total cost is 0, amortized 0.00
    expect(text).toContain('Total Cost: 0');
    expect(text).toContain('Amortized Cost: 0.00');
    // Current Size should remain 0 internally
    expect(text).toContain('Current Size: 0');
  });

  test('S1_OperationExecuted: Execute "get" returns cost 1 and does not change size', async ({ page }) => {
    // get operation should always cost 1 and not change currentSize.
    const app = new AmortizedPage(page);
    await app.goto();

    await app.selectOperation('get');
    // set size to some value; input value does not affect get cost
    await app.setSize(5);

    await app.clickExecuteAndWaitForResult();

    const text = await app.getResultText();
    expect(text).toContain('Operation: get');
    expect(text).toContain('Current Cost: 1');
    expect(text).toContain('Total Cost: 1');
    expect(text).toContain('Amortized Cost: 1.00');
    // currentSize remains as internal increment logic for get does not exist (currentSize should be 0)
    // The implementation sets currentSize initially 0 and get does not modify it; so expect Current Size: 0
    expect(text).toContain('Current Size: 0');
  });

  test('S1_OperationExecuted -> S1_OperationExecuted: Multiple operations compute amortized cost correctly across operations', async ({ page }) => {
    // Perform a sequence: insert (size 0), get, insert (size 1) and validate amortized cost calculation.
    const app = new AmortizedPage(page);
    await app.goto();

    // 1) insert with size input 0 -> currentCost 1
    await app.selectOperation('insert');
    await app.setSize(0);
    await app.clickExecuteAndWaitForResult();
    let text = await app.getResultText();
    expect(text).toContain('Current Cost: 1');
    expect(text).toContain('Total Cost: 1');
    expect(text).toContain('Amortized Cost: 1.00');

    // 2) get -> cost 1; total cost 2; amortized 1.00
    await app.selectOperation('get');
    // leave size input as-is
    await app.clickExecuteAndWaitForResult();
    text = await app.getResultText();
    expect(text).toContain('Current Cost: 1');
    expect(text).toContain('Total Cost: 2');
    expect(text).toContain('Amortized Cost: 1.00');

    // 3) insert with size input >=1 (set size input to 1 to trigger extra cost)
    await app.selectOperation('insert');
    await app.setSize(1);
    await app.clickExecuteAndWaitForResult();
    text = await app.getResultText();
    // For this third operation currentCost should be 2 (1 base + 1 grow)
    expect(text).toContain('Current Cost: 2');
    // Total cost should be 4 (1 + 1 + 2)
    expect(text).toContain('Total Cost: 4');
    // Amortized cost = 4 / 3 = 1.33 (toFixed(2) => 1.33)
    expect(text).toContain('Amortized Cost: 1.33');
  });

  test('S1_OperationExecuted -> S2_Reset -> S0_Idle: Reset clears result and input and restarts internal accounting', async ({ page }) => {
    // Validate Reset transition clears UI and resets internal state as indicated by behavior (fresh calculations after reset).
    const app = new AmortizedPage(page);
    await app.goto();

    // Do an operation to populate result and internal state.
    await app.selectOperation('insert');
    await app.setSize(0);
    await app.clickExecuteAndWaitForResult();
    let text = await app.getResultText();
    expect(text).toContain('Operation: insert');
    expect(text).not.toBe('');

    // Now click Reset to transition to S2_Reset
    await app.clickReset();

    // After reset, the size input should be set back to "0" and result cleared.
    const sizeVal = await app.getSizeValue();
    expect(sizeVal).toBe('0');
    const afterResetResult = await app.getResultText();
    expect(afterResetResult.trim(), 'Result should be cleared after reset').toBe('');

    // Verify that after reset a fresh operation computes as if starting from zero internal state.
    await app.selectOperation('get');
    await app.setSize(10); // arbitrary
    await app.clickExecuteAndWaitForResult();

    text = await app.getResultText();
    // Since this is the first operation after reset, total cost should equal current cost (1) and amortized 1.00
    expect(text).toContain('Current Cost: 1');
    expect(text).toContain('Total Cost: 1');
    expect(text).toContain('Amortized Cost: 1.00');
  });

  test('Edge case: Rapid sequence of operations and reset does not throw runtime errors (observed via console/pageerror)', async ({ page }) => {
    // This test rapidly exercises the UI while verifying no page/runtime errors occur.
    const app = new AmortizedPage(page);
    await app.goto();

    // Rapid sequence: multiple executes and resets
    for (let i = 0; i < 5; i++) {
      await app.selectOperation(i % 3 === 0 ? 'insert' : i % 3 === 1 ? 'delete' : 'get');
      await app.setSize(i); // different inputs
      await app.clickExecuteAndWaitForResult();
      // Occasionally reset
      if (i % 2 === 1) {
        await app.clickReset();
      }
    }

    // After rapid activity, ensure page did not report any console errors or page errors.
    // The afterEach hook asserts there are no errors; add an immediate check here as well for clarity.
    const consoleErrors = page._consoleErrors || [];
    const pageErrors = page._pageErrors || [];
    expect(consoleErrors.length + pageErrors.length).toBe(0);
  });

  test('Sanity: clicking execute without changing inputs uses default size 0 and updates result', async ({ page }) => {
    // Ensure default interactions (no user input changes) still produce valid updates.
    const app = new AmortizedPage(page);
    await app.goto();

    // By default operation select is 'insert' and size input is 0 per HTML.
    // Clicking execute should perform an insert with sizeInput == 0.
    await app.clickExecuteAndWaitForResult();

    const text = await app.getResultText();
    expect(text).toContain('Operation: insert');
    expect(text).toContain('Current Cost: 1');
    expect(text).toContain('Total Cost: 1');
    expect(text).toContain('Amortized Cost: 1.00');
  });
});