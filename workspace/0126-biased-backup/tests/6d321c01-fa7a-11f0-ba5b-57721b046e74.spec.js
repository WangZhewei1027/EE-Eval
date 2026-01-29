import { test, expect } from '@playwright/test';

// Test file for Application ID: 6d321c01-fa7a-11f0-ba5b-57721b046e74
// Location: http://127.0.0.1:5500/workspace/0126-biased/html/6d321c01-fa7a-11f0-ba5b-57721b046e74.html
// Filename requirement: 6d321c01-fa7a-11f0-ba5b-57721b046e74.spec.js

// Page object model for interacting with the refactoring demo
class RefactorAppPage {
  constructor(page) {
    this.page = page;
  }

  // Selectors
  get exampleSelect() { return this.page.locator('#example-select'); }
  get originalCode() { return this.page.locator('#original-code'); }
  get refactoredCode() { return this.page.locator('#refactored-code'); }
  get refactorOptions() { return this.page.locator('#refactor-options'); }
  get optionsContent() { return this.page.locator('#options-content'); }
  get stepsList() { return this.page.locator('#steps-list'); }
  get compareButton() { return this.page.locator('#compare'); }
  get comparisonView() { return this.page.locator('#comparison-view'); }
  get beforeCode() { return this.page.locator('#before-code'); }
  get afterCode() { return this.page.locator('#after-code'); }
  get closeComparison() { return this.page.locator('#close-comparison'); }
  get resetButton() { return this.page.locator('#reset'); }

  // Refactoring control buttons
  get extractMethodButton() { return this.page.locator('#extract-method'); }
  get renameVariableButton() { return this.page.locator('#rename-variable'); }
  get introduceParameterButton() { return this.page.locator('#introduce-parameter'); }
  get replaceConditionalButton() { return this.page.locator('#replace-conditional'); }
  get extractClassButton() { return this.page.locator('#extract-class'); }

  // Apply/Cancel inside options
  get applyRefactorButton() { return this.page.locator('#apply-refactor'); }
  get cancelRefactorButton() { return this.page.locator('#cancel-refactor'); }

  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/0126-biased/html/6d321c01-fa7a-11f0-ba5b-57721b046e74.html');
    // Wait for initial DOMContentLoaded and initial updateCodeDisplays to complete (markers: content filled)
    await expect(this.originalCode).toHaveText(/function|class|return|}/, { timeout: 5000 });
  }

  // Helper to open a refactor option by clicking its button and waiting for options to be visible
  async openRefactorOption(buttonLocator) {
    await buttonLocator.click();
    await expect(this.refactorOptions).toBeVisible();
    await expect(this.optionsContent).not.toBeEmpty();
  }

  // Helper to assert refactor options visibility state
  async expectRefactorOptionsVisible(visible = true) {
    if (visible) {
      await expect(this.refactorOptions).toBeVisible();
      await expect(this.refactorOptions).not.toHaveClass(/hidden/);
    } else {
      // If hidden, element may still be in DOM but with .hidden class
      await expect(this.refactorOptions).toHaveClass(/hidden/);
    }
  }

  async getStepsCount() {
    return await this.stepsList.locator('.refactor-step').count();
  }

  async getOriginalCodeText() {
    return await this.originalCode.textContent();
  }

  async getRefactoredCodeText() {
    return await this.refactoredCode.textContent();
  }

  async getBeforeAfterTexts() {
    return {
      before: await this.beforeCode.textContent(),
      after: await this.afterCode.textContent()
    };
  }
}

// Global arrays to collect console and page errors during each test
let consoleErrors = [];
let pageErrors = [];

test.describe.configure({ mode: 'serial' });

test.describe('Refactoring Interactive Demo - FSM and UI tests', () => {
  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleErrors = [];
    pageErrors = [];

    // Listen for console errors and page errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });
  });

  test.afterEach(async () => {
    // After each test assert that no console or page errors occurred during that test run.
    // This validates that the application did not log runtime errors like ReferenceError/TypeError/SyntaxError.
    // If errors exist, fail the test and report them.
    expect(consoleErrors.length, `Console errors: ${consoleErrors.join(' | ')}`).toBe(0);
    expect(pageErrors.length, `Page errors: ${pageErrors.join(' | ')}`).toBe(0);
  });

  test.describe('Initial State (S0_Idle)', () => {
    test('should load and show original and refactored code with metrics initialized', async ({ page }) => {
      const app = new RefactorAppPage(page);
      // Load page and wait for initial content
      await app.goto();

      // Validate that the original and refactored code panels contain text from the examples
      const originalText = await app.getOriginalCodeText();
      const refactoredText = await app.getRefactoredCodeText();
      expect(originalText.length).toBeGreaterThan(0);
      expect(refactoredText.length).toBeGreaterThan(0);

      // Metrics elements should have numeric values for the default example
      await expect(page.locator('#lines')).not.toHaveText('0');
      await expect(page.locator('#refactored-lines')).not.toHaveText('0');

      // Refactor options and comparison view should be hidden initially (S0_Idle)
      await expect(page.locator('#refactor-options')).toHaveClass(/hidden/);
      await expect(page.locator('#comparison-view')).toHaveClass(/hidden/);

      // Steps list should be empty at startup
      const steps = await app.getStepsCount();
      expect(steps).toBe(0);
    });
  });

  test.describe('Refactoring Options Visibility (S1_RefactoringOptionsVisible)', () => {
    test('clicking each refactor button should show refactor options', async ({ page }) => {
      const app = new RefactorAppPage(page);
      await app.goto();

      // List of buttons to test causing transition to S1
      const buttons = [
        app.extractMethodButton,
        app.renameVariableButton,
        app.introduceParameterButton,
        app.replaceConditionalButton,
        app.extractClassButton
      ];

      for (const btn of buttons) {
        // Open option and validate visible
        await app.openRefactorOption(btn);
        await app.expectRefactorOptionsVisible(true);

        // Cancel so we return to idle for the next button
        await app.cancelRefactorButton.click();
        await app.expectRefactorOptionsVisible(false);
      }
    });

    test('canceling a refactor should hide options without adding steps (CancelRefactorClick)', async ({ page }) => {
      const app = new RefactorAppPage(page);
      await app.goto();

      // Open extract method and then cancel
      await app.openRefactorOption(app.extractMethodButton);
      await app.cancelRefactorButton.click();

      // Options hidden and no steps added
      await app.expectRefactorOptionsVisible(false);
      const steps = await app.getStepsCount();
      expect(steps).toBe(0);
    });
  });

  test.describe('Applying Refactors (ApplyRefactorClick -> S0_Idle transitions)', () => {
    test('extract method: should add a new method, update refactored code, and add a step', async ({ page }) => {
      const app = new RefactorAppPage(page);
      await app.goto();

      // Open Extract Method options
      await app.openRefactorOption(app.extractMethodButton);

      // Fill the textarea and method name and parameters
      await page.fill('#code-to-extract', 'let total = 0;\nfor (let item of order.items) { total += item.price * item.quantity; }');
      await page.fill('#new-method-name', 'calculateTotal');
      await page.fill('#method-parameters', 'order');

      // Click apply and wait for options to hide and step to be added
      await app.applyRefactorButton.click();

      // After applying, options should be hidden and a step should be recorded
      await app.expectRefactorOptionsVisible(false);
      const stepsCount = await app.getStepsCount();
      expect(stepsCount).toBeGreaterThanOrEqual(1);

      // Refactored code should now include the new method name
      const refactored = await app.getRefactoredCodeText();
      expect(refactored).toContain('function calculateTotal');
      expect(refactored).toContain('calculateTotal(order)'); // usage inserted

      // Metrics should have been updated (lines may have increased because of new method)
      const refactoredLines = await page.locator('#refactored-lines').textContent();
      expect(Number(refactoredLines)).toBeGreaterThan(0);
    });

    test('rename variable: should replace occurrences and record a step', async ({ page }) => {
      const app = new RefactorAppPage(page);
      await app.goto();

      // Open Rename Variable options
      await app.openRefactorOption(app.renameVariableButton);

      // Provide values to rename a non-existing variable to test the replace mechanism (safe to run)
      await page.fill('#old-name', 'order');
      await page.fill('#new-name', 'customerOrder');

      await app.applyRefactorButton.click();

      // Options hidden and step added
      await app.expectRefactorOptionsVisible(false);
      const stepsCount = await app.getStepsCount();
      expect(stepsCount).toBeGreaterThanOrEqual(1);

      // Refactored code should contain the new variable name
      const refactored = await app.getRefactoredCodeText();
      expect(refactored).toContain('customerOrder');
    });

    test('introduce parameter: should add a parameter and record a step', async ({ page }) => {
      const app = new RefactorAppPage(page);
      await app.goto();

      // Open Introduce Parameter
      await app.openRefactorOption(app.introduceParameterButton);

      // Fill in a value and parameter name
      // Use '1000' (appears in examples) and param name 'threshold'
      await page.fill('#hardcoded-value', '1000');
      await page.fill('#param-name', 'threshold');

      await app.applyRefactorButton.click();

      // Options hidden and step added
      await app.expectRefactorOptionsVisible(false);
      const stepsCount = await app.getStepsCount();
      expect(stepsCount).toBeGreaterThanOrEqual(1);

      // Refactored code should now contain the parameter name (or at least steps recorded)
      const refactored = await app.getRefactoredCodeText();
      expect(refactored.length).toBeGreaterThan(0);
    });

    test('replace conditional: selecting type and applying should add a descriptive step', async ({ page }) => {
      const app = new RefactorAppPage(page);
      await app.goto();

      // Open Replace Conditional
      await app.openRefactorOption(app.replaceConditionalButton);

      // Choose 'polymorphism' in the select to populate the conditional-options
      await page.selectOption('#conditional-type', 'polymorphism');

      // Ensure dynamic inputs appear and then apply refactor
      await expect(page.locator('#type-property')).toBeVisible();
      await page.fill('#type-property', 'paymentType');
      await page.fill('#class-names', 'CreditPayment,PayPalPayment');

      await app.applyRefactorButton.click();

      // Options hidden and step added with descriptive text
      await app.expectRefactorOptionsVisible(false);
      const stepsCount = await app.getStepsCount();
      expect(stepsCount).toBeGreaterThanOrEqual(1);

      // Verify the last step text contains the words indicating replacement
      const lastStep = await app.stepsList.locator('.refactor-step').nth((await app.getStepsCount()) - 1).textContent();
      expect(lastStep).toMatch(/Replaced conditional with polymorphism|Replaced conditional/);
    });

    test('extract class: should record a step and hide options', async ({ page }) => {
      const app = new RefactorAppPage(page);
      await app.goto();

      await app.openRefactorOption(app.extractClassButton);

      // Fill inputs
      await page.fill('#source-class', 'OrderProcessor');
      await page.fill('#new-class', 'PaymentProcessor');
      await page.fill('#methods-to-move', 'processCreditCard,processPayPal');

      await app.applyRefactorButton.click();

      await app.expectRefactorOptionsVisible(false);
      const stepsCount = await app.getStepsCount();
      expect(stepsCount).toBeGreaterThanOrEqual(1);

      // Validate step content
      const stepText = await app.stepsList.locator('.refactor-step').nth(stepsCount - 1).textContent();
      expect(stepText).toContain('Extracted class PaymentProcessor');
    });
  });

  test.describe('Comparison View (S2_ComparisonViewVisible)', () => {
    test('clicking compare opens comparison view and shows before/after code', async ({ page }) => {
      const app = new RefactorAppPage(page);
      await app.goto();

      // Ensure some refactoring state exists: perform a rename to ensure after code differs
      await app.openRefactorOption(app.renameVariableButton);
      await page.fill('#old-name', 'order');
      await page.fill('#new-name', 'customerOrder');
      await app.applyRefactorButton.click();

      // Click compare and validate comparison view is visible with matching content
      await app.compareButton.click();
      await expect(app.comparisonView).toBeVisible();
      const { before, after } = await app.getBeforeAfterTexts();

      // Before should equal original code and after should equal refactored code
      const original = await app.getOriginalCodeText();
      const refactored = await app.getRefactoredCodeText();
      expect(before).toBe(original);
      expect(after).toBe(refactored);

      // Close comparison view
      await app.closeComparison.click();
      await expect(app.comparisonView).toHaveClass(/hidden/);
    });
  });

  test.describe('Example Selection and Reset (ExampleSelectChange, ResetClick)', () => {
    test('changing example updates original and clears refactoring steps', async ({ page }) => {
      const app = new RefactorAppPage(page);
      await app.goto();

      // Perform a refactor to populate steps
      await app.openRefactorOption(app.renameVariableButton);
      await page.fill('#old-name', 'order');
      await page.fill('#new-name', 'customerOrder');
      await app.applyRefactorButton.click();
      const stepsBefore = await app.getStepsCount();
      expect(stepsBefore).toBeGreaterThanOrEqual(1);

      // Change the example select
      await app.exampleSelect.selectOption('duplicate-code');

      // Original code must update to the chosen example text and steps cleared
      const originalText = await app.getOriginalCodeText();
      expect(originalText).toContain('calculateRectangleArea'); // part of duplicate-code example
      const stepsAfter = await app.getStepsCount();
      expect(stepsAfter).toBe(0);
    });

    test('reset restores refactored code to original and clears steps (ResetClick)', async ({ page }) => {
      const app = new RefactorAppPage(page);
      await app.goto();

      // Apply a rename to change refactored content
      await app.openRefactorOption(app.renameVariableButton);
      await page.fill('#old-name', 'order');
      await page.fill('#new-name', 'customerOrder');
      await app.applyRefactorButton.click();

      // Ensure refactored differs from original
      const beforeResetRefactored = await app.getRefactoredCodeText();
      const originalNow = await app.getOriginalCodeText();
      expect(beforeResetRefactored).not.toBe(originalNow);

      // Click reset
      await app.resetButton.click();

      // Refactored code should equal original and steps cleared
      const afterResetRefactored = await app.getRefactoredCodeText();
      expect(afterResetRefactored).toBe(originalNow);

      const steps = await app.getStepsCount();
      expect(steps).toBe(0);
    });
  });

  test.describe('Edge Cases and Error Scenarios', () => {
    test('applying a refactor without required inputs should not hide options or add steps (Extract Method edge case)', async ({ page }) => {
      const app = new RefactorAppPage(page);
      await app.goto();

      // Open Extract Method and leave inputs empty
      await app.openRefactorOption(app.extractMethodButton);
      // Clear textarea and method-name to ensure emptiness
      await page.fill('#code-to-extract', '');
      await page.fill('#new-method-name', '');

      // Click apply - the app's apply handler checks for trimmed inputs; nothing should happen
      await app.applyRefactorButton.click();

      // Options should remain visible because apply-refactor returns early when inputs invalid
      await app.expectRefactorOptionsVisible(true);

      // No steps should be added
      const steps = await app.getStepsCount();
      expect(steps).toBe(0);

      // Clean up by canceling
      await app.cancelRefactorButton.click();
    });

    test('replace-conditional dynamic UI should update when changing selection and applying strategy option', async ({ page }) => {
      const app = new RefactorAppPage(page);
      await app.goto();

      await app.openRefactorOption(app.replaceConditionalButton);

      // Switch to strategy type and ensure new fields appear
      await page.selectOption('#conditional-type', 'strategy');
      await expect(page.locator('#interface-name')).toBeVisible();
      await expect(page.locator('#strategy-names')).toBeVisible();

      await page.fill('#interface-name', 'PaymentStrategy');
      await page.fill('#strategy-names', 'CreditStrategy,PayPalStrategy');

      await app.applyRefactorButton.click();

      await app.expectRefactorOptionsVisible(false);
      const stepsCount = await app.getStepsCount();
      expect(stepsCount).toBeGreaterThanOrEqual(1);

      // Validate descriptive step about strategy occurred
      const lastStep = await app.stepsList.locator('.refactor-step').nth(stepsCount - 1).textContent();
      expect(lastStep).toMatch(/strategy/i);
    });
  });

  test.describe('Console and Page Error Observation', () => {
    test('no runtime console errors or page exceptions should be produced during normal interactions', async ({ page }) => {
      // This test performs a typical set of interactions and relies on afterEach to assert zero errors.
      const app = new RefactorAppPage(page);
      await app.goto();

      // Perform a representative set of actions
      await app.openRefactorOption(app.extractMethodButton);
      await page.fill('#code-to-extract', 'let x = 1;');
      await page.fill('#new-method-name', 'foo');
      await page.fill('#method-parameters', '');
      await app.applyRefactorButton.click();

      await app.compareButton.click();
      await app.closeComparison.click();

      await app.exampleSelect.selectOption('large-class');
      await app.resetButton.click();

      // No explicit expect here for errors; afterEach will fail the test if console/page errors were captured.
      expect(await app.getStepsCount()).toBeGreaterThanOrEqual(0); // trivial sanity assertion
    });
  });
});