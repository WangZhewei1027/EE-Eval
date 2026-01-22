import { test, expect } from '@playwright/test';

// Test file for Application ID: f1822ad2-d366-11f0-9b19-a558354ece3e
// URL: http://127.0.0.1:5500/workspace/batch-1207/html/f1822ad2-d366-11f0-9b19-a558354ece3e.html
// This suite validates the FSM states and transitions for the Recursion Visualization page.
// It checks DOM rendering, interactions (calculate/reset), edge cases (invalid input alerts),
// visual feedback (result text and recursion steps), and ensures no uncaught page errors happen.

// Page Object for the Recursion Visualization page
class RecursionPage {
  constructor(page) {
    this.page = page;
    // Fibonacci selectors
    this.fibInput = page.locator('#fib-input');
    this.calculateFibBtn = page.locator('#calculate-fib');
    this.resetFibBtn = page.locator('#reset-fib');
    this.fibResult = page.locator('#fib-result');
    this.fibTree = page.locator('#fib-tree');

    // Factorial selectors
    this.factorialInput = page.locator('#factorial-input');
    this.calculateFactorialBtn = page.locator('#calculate-factorial');
    this.resetFactorialBtn = page.locator('#reset-factorial');
    this.factorialResult = page.locator('#factorial-result');
    this.factorialTree = page.locator('#factorial-tree');

    // General
    this.headerTitle = page.locator('h1');
  }

  // Navigation
  async goto(url) {
    await this.page.goto(url);
  }

  // Fibonacci helpers
  async setFibInput(value) {
    await this.fibInput.fill(String(value));
  }
  async clickCalculateFib() {
    await this.calculateFibBtn.click();
  }
  async clickResetFib() {
    await this.resetFibBtn.click();
  }
  async getFibResultText() {
    return this.fibResult.textContent();
  }
  async getFibTreeStepCount() {
    return this.fibTree.locator('.recursive-step').count();
  }
  async getFibTreeFirstStepText() {
    const first = this.fibTree.locator('.recursive-step').first();
    return first.textContent();
  }

  // Factorial helpers
  async setFactorialInput(value) {
    await this.factorialInput.fill(String(value));
  }
  async clickCalculateFactorial() {
    await this.calculateFactorialBtn.click();
  }
  async clickResetFactorial() {
    await this.resetFactorialBtn.click();
  }
  async getFactorialResultText() {
    return this.factorialResult.textContent();
  }
  async getFactorialTreeStepCount() {
    return this.factorialTree.locator('.recursive-step').count();
  }
  async getFactorialTreeFirstStepText() {
    const first = this.factorialTree.locator('.recursive-step').first();
    return first.textContent();
  }
}

test.describe('Recursion Visualization - FSM validation', () => {
  // URL under test
  const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f1822ad2-d366-11f0-9b19-a558354ece3e.html';

  // Containers for console and page errors collected during each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages of error severity
    page.on('console', (msg) => {
      // Capture console.error messages to fail the test if any unexpected errors occur
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });

    // Navigate to the app
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Ensure there were no uncaught page exceptions or console.error messages during the test
    // These assertions validate that the page JS executed without runtime errors
    expect(pageErrors, 'No uncaught page errors should occur').toHaveLength(0);
    expect(consoleErrors, 'No console.error messages should be emitted').toHaveLength(0);
  });

  test('Initial render (S0_Idle): page elements and default state are present', async ({ page }) => {
    // Validate initial render - this corresponds to the S0_Idle entry action renderPage()
    const p = new RecursionPage(page);

    // Header and descriptions are visible
    await expect(p.headerTitle).toHaveText('Understanding Recursion');

    // Fibonacci controls present with default values
    await expect(p.fibInput).toHaveAttribute('min', '0');
    await expect(p.fibInput).toHaveAttribute('max', '20');
    await expect(p.fibInput).toHaveValue('5');
    await expect(p.calculateFibBtn).toBeVisible();
    await expect(p.resetFibBtn).toBeVisible();

    // Fibonacci default result placeholder
    await expect(p.fibResult).toHaveText(/Result will appear here/);

    // Factorial controls present with default values
    await expect(p.factorialInput).toHaveAttribute('min', '0');
    await expect(p.factorialInput).toHaveAttribute('max', '10');
    await expect(p.factorialInput).toHaveValue('5');
    await expect(p.calculateFactorialBtn).toBeVisible();
    await expect(p.resetFactorialBtn).toBeVisible();

    // Factorial default result placeholder
    await expect(p.factorialResult).toHaveText(/Result will appear here/);
  });

  test.describe('Fibonacci interactions (S0_Idle -> S1_Fibonacci_Calculated -> S0_Idle)', () => {
    test('Calculate Fibonacci updates result and visualization (transition to S1_Fibonacci_Calculated)', async ({ page }) => {
      // This test verifies the "CalculateFibonacci" event and the resulting state S1_Fibonacci_Calculated
      const p = new RecursionPage(page);

      // Set a known input and calculate: fibonacci(6) = 8
      await p.setFibInput(6);
      await p.clickCalculateFib();

      // Result display should be updated accordingly
      await expect(p.fibResult).toHaveText('Fibonacci(6) = 8');

      // Visualization container should be populated with recursive steps
      const stepCount = await p.getFibTreeStepCount();
      expect(stepCount).toBeGreaterThan(0);

      // The first step should indicate the initial call
      const firstStepText = await p.getFibTreeFirstStepText();
      expect(firstStepText).toContain('fibonacci(6) called at depth 0');
    });

    test('Reset Fibonacci returns UI to S0_Idle defaults (transition back to S0_Idle)', async ({ page }) => {
      // This test validates the "ResetFibonacci" event and the exit action resetting inputs and results
      const p = new RecursionPage(page);

      // Perform a calculation first to ensure reset actually changes things
      await p.setFibInput(4);
      await p.clickCalculateFib();
      await expect(p.fibResult).not.toHaveText('Result will appear here');
      const beforeResetSteps = await p.getFibTreeStepCount();
      expect(beforeResetSteps).toBeGreaterThan(0);

      // Click reset
      await p.clickResetFib();

      // Input should be reset to default '5'
      await expect(p.fibInput).toHaveValue('5');

      // Result should return to placeholder text
      await expect(p.fibResult).toHaveText('Result will appear here');

      // Tree should be restored to placeholder content (contains the placeholder paragraph)
      await expect(p.fibTree).toContainText('Recursion visualization will appear here');
    });

    test('Fibonacci edge cases: invalid inputs produce alerts (error scenario handling)', async ({ page }) => {
      // Validate alerts are shown for invalid inputs as described in the implementation
      const p = new RecursionPage(page);

      // Helper to capture a dialog and assert its message
      const expectAlertWithMessage = async (action, expectedMessage) => {
        const dialogPromise = page.waitForEvent('dialog');
        await action();
        const dialog = await dialogPromise;
        expect(dialog.type()).toBe('alert');
        expect(dialog.message()).toBe(expectedMessage);
        await dialog.accept();
      };

      // Negative number triggers alert
      await p.setFibInput(-1);
      await expectAlertWithMessage(async () => {
        await p.clickCalculateFib();
      }, 'Please enter a valid number between 0 and 20');

      // Too large number triggers alert
      await p.setFibInput(25);
      await expectAlertWithMessage(async () => {
        await p.clickCalculateFib();
      }, 'Please enter a valid number between 0 and 20');

      // Empty input (NaN) triggers alert
      await p.setFibInput(''); // clears input -> NaN on parseInt
      await expectAlertWithMessage(async () => {
        await p.clickCalculateFib();
      }, 'Please enter a valid number between 0 and 20');
    });
  });

  test.describe('Factorial interactions (S0_Idle -> S2_Factorial_Calculated -> S0_Idle)', () => {
    test('Calculate Factorial updates result and visualization (transition to S2_Factorial_Calculated)', async ({ page }) => {
      // Validate the "CalculateFactorial" event and S2_Factorial_Calculated state
      const p = new RecursionPage(page);

      // Set factorial input and compute: 4! = 24
      await p.setFactorialInput(4);
      await p.clickCalculateFactorial();

      // Result display should be updated accordingly
      await expect(p.factorialResult).toHaveText('4! = 24');

      // Visualization should be populated
      const stepCount = await p.getFactorialTreeStepCount();
      expect(stepCount).toBeGreaterThan(0);

      // First step should indicate the initial call
      const firstStepText = await p.getFactorialTreeFirstStepText();
      expect(firstStepText).toContain('factorial(4) called at depth 0');
    });

    test('Reset Factorial returns UI to S0_Idle defaults (transition back to S0_Idle)', async ({ page }) => {
      // Validate the "ResetFactorial" event behavior
      const p = new RecursionPage(page);

      // Perform a calculation first
      await p.setFactorialInput(3);
      await p.clickCalculateFactorial();
      await expect(p.factorialResult).not.toHaveText('Result will appear here');

      // Click reset
      await p.clickResetFactorial();

      // Input should be reset to default '5'
      await expect(p.factorialInput).toHaveValue('5');

      // Result should be placeholder again
      await expect(p.factorialResult).toHaveText('Result will appear here');

      // Tree should be restored to placeholder
      await expect(p.factorialTree).toContainText('Recursion visualization will appear here');
    });

    test('Factorial edge cases: invalid inputs produce alerts (error scenario handling)', async ({ page }) => {
      const p = new RecursionPage(page);

      const expectAlertWithMessage = async (action, expectedMessage) => {
        const dialogPromise = page.waitForEvent('dialog');
        await action();
        const dialog = await dialogPromise;
        expect(dialog.type()).toBe('alert');
        expect(dialog.message()).toBe(expectedMessage);
        await dialog.accept();
      };

      // Negative number triggers alert
      await p.setFactorialInput(-2);
      await expectAlertWithMessage(async () => {
        await p.clickCalculateFactorial();
      }, 'Please enter a valid number between 0 and 10');

      // Too large number triggers alert
      await p.setFactorialInput(11);
      await expectAlertWithMessage(async () => {
        await p.clickCalculateFactorial();
      }, 'Please enter a valid number between 0 and 10');

      // Empty input triggers alert
      await p.setFactorialInput('');
      await expectAlertWithMessage(async () => {
        await p.clickCalculateFactorial();
      }, 'Please enter a valid number between 0 and 10');
    });
  });

  test('Additional validation: base cases for Fibonacci and Factorial produce expected results', async ({ page }) => {
    // Validate base cases (transition to calculated states but with base-case behavior)
    const p = new RecursionPage(page);

    // Fibonacci base cases
    await p.setFibInput(0);
    await p.clickCalculateFib();
    await expect(p.fibResult).toHaveText('Fibonacci(0) = 0');

    await p.setFibInput(1);
    await p.clickCalculateFib();
    await expect(p.fibResult).toHaveText('Fibonacci(1) = 1');

    // Factorial base cases
    await p.setFactorialInput(0);
    await p.clickCalculateFactorial();
    await expect(p.factorialResult).toHaveText('0! = 1');

    await p.setFactorialInput(1);
    await p.clickCalculateFactorial();
    await expect(p.factorialResult).toHaveText('1! = 1');
  });

  test('Sequential interactions: multiple calculations and resets maintain correct behavior', async ({ page }) => {
    // Ensure repeated use of the controls does not produce stale state or errors
    const p = new RecursionPage(page);

    // Compute Fibonacci several times
    await p.setFibInput(5);
    await p.clickCalculateFib();
    await expect(p.fibResult).toHaveText('Fibonacci(5) = 5');

    await p.setFibInput(7);
    await p.clickCalculateFib();
    await expect(p.fibResult).toHaveText('Fibonacci(7) = 13');

    // Reset then compute again
    await p.clickResetFib();
    await expect(p.fibInput).toHaveValue('5');
    await p.setFibInput(3);
    await p.clickCalculateFib();
    await expect(p.fibResult).toHaveText('Fibonacci(3) = 2');

    // Compute Factorial several times
    await p.setFactorialInput(5);
    await p.clickCalculateFactorial();
    await expect(p.factorialResult).toHaveText('5! = 120');

    await p.setFactorialInput(2);
    await p.clickCalculateFactorial();
    await expect(p.factorialResult).toHaveText('2! = 2');

    // Reset then compute again
    await p.clickResetFactorial();
    await expect(p.factorialInput).toHaveValue('5');
    await p.setFactorialInput(6);
    await p.clickCalculateFactorial();
    await expect(p.factorialResult).toHaveText('6! = 720');
  });
});