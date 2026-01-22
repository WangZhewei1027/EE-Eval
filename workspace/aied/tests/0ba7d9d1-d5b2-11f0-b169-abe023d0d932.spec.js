import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba7d9d1-d5b2-11f0-b169-abe023d0d932.html';

// Page Object for the Stack application
class StackPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.inputSelector = 'input[type="text"]#input';
    this.addButtonSelector = 'button[onclick="addNumber()"]';
    this.outputSelector = 'p#output';
  }

  async goto() {
    await this.page.goto(BASE_URL);
  }

  async fillInput(value) {
    await this.page.fill(this.inputSelector, value);
  }

  async clickAdd() {
    await this.page.click(this.addButtonSelector);
  }

  async getOutputText() {
    return (await this.page.textContent(this.outputSelector)) || '';
  }

  async getInputValue() {
    return this.page.evaluate((sel) => document.querySelector(sel).value, this.inputSelector);
  }

  // Access the in-page stack variable for deeper assertions
  async getStackContents() {
    return this.page.evaluate(() => {
      // Return a shallow copy of stack if exists, otherwise null
      if (typeof stack !== 'undefined') return Array.isArray(stack) ? [...stack] : stack;
      return null;
    });
  }
}

test.describe('Stack App - FSM validation (Application ID: 0ba7d9d1-d5b2-11f0-b169-abe023d0d932)', () => {
  // Collect page errors and console messages per test
  test.beforeEach(async ({ page }) => {
    // Ensure a fresh listener set for each test
    page.context().clearCookies?.();
  });

  // Helper to attach listeners and return collected messages
  const attachCollectors = (page) => {
    const pageErrors = [];
    const consoleMessages = [];

    page.on('pageerror', (err) => {
      // capture the Error object/stack
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    return { pageErrors, consoleMessages };
  };

  test.describe('Initial State (S0_Idle)', () => {
    test('renders input, Add button and empty output on load; initial stack exists and is empty', async ({ page }) => {
      // Comment: Validate initial rendering and S0_Idle evidence
      const collectors = attachCollectors(page);
      const stackPage = new StackPage(page);
      await stackPage.goto();

      // Verify input exists with correct placeholder
      const placeholder = await page.getAttribute(stackPage.inputSelector, 'placeholder');
      expect(placeholder).toBe('Enter a number');

      // Verify Add button exists and has expected text
      const buttonText = await page.textContent(stackPage.addButtonSelector);
      expect(buttonText?.trim()).toBe('Add');

      // Verify output is initially empty
      const output = await stackPage.getOutputText();
      expect(output.trim()).toBe('');

      // Verify the 'stack' global exists and is an empty array on load
      const stackContents = await stackPage.getStackContents();
      expect(Array.isArray(stackContents)).toBeTruthy();
      expect(stackContents.length).toBe(0);

      // Assert no uncaught page errors (ReferenceError, SyntaxError, TypeError, etc.) happened on load
      // If there are page errors, fail with their messages for debugging
      if (collectors.pageErrors.length > 0) {
        // Build readable error summary
        const summaries = collectors.pageErrors.map((e) => `${e.name}: ${e.message}`).join('; ');
        // Fail the test showing the errors
        throw new Error(`Unexpected page errors on load: ${summaries}`);
      }

      // Assert no console error-level messages
      const errorConsoles = collectors.consoleMessages.filter((c) => c.type === 'error');
      expect(errorConsoles.length).toBe(0);
    });
  });

  test.describe('Transitions and Events (AddNumber)', () => {
    test('clicking Add with a non-numeric input pushes value to stack and updates output (S0_Idle -> S1_NumberAdded)', async ({ page }) => {
      // Comment: This test validates FSM transition for non-number input where guard "input is not a number" is true.
      const collectors = attachCollectors(page);
      const stackPage = new StackPage(page);
      await stackPage.goto();

      // Enter a non-numeric value and trigger Add
      await stackPage.fillInput('abc');
      await stackPage.clickAdd();

      // Output should reflect the pushed value
      const output = await stackPage.getOutputText();
      expect(output.trim()).toBe('Stack: abc');

      // Input should be cleared after successful push
      const inputValue = await stackPage.getInputValue();
      expect(inputValue).toBe('');

      // The in-page stack should contain the pushed value
      const stackContents = await stackPage.getStackContents();
      expect(Array.isArray(stackContents)).toBeTruthy();
      expect(stackContents.join(' ')).toBe('abc');

      // Validate no uncaught exceptions occurred during the transition
      const pageErrorTypes = collectors.pageErrors.map((e) => e.name);
      expect(pageErrorTypes).not.toContain('ReferenceError');
      expect(pageErrorTypes).not.toContain('SyntaxError');
      expect(pageErrorTypes).not.toContain('TypeError');

      // No console error messages expected
      const consoleErrors = collectors.consoleMessages.filter((c) => c.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('adding multiple non-numeric values accumulates in stack and output shows all (S1_NumberAdded continued behavior)', async ({ page }) => {
      // Comment: Validate that repeated Add actions append to stack and the output reflects the full stack contents
      const collectors = attachCollectors(page);
      const stackPage = new StackPage(page);
      await stackPage.goto();

      // Add multiple non-numeric strings
      await stackPage.fillInput('one');
      await stackPage.clickAdd();
      await stackPage.fillInput('two');
      await stackPage.clickAdd();
      await stackPage.fillInput('three');
      await stackPage.clickAdd();

      // Expect output to list all values separated by spaces in insertion order
      const output = await stackPage.getOutputText();
      expect(output.trim()).toBe('Stack: one two three');

      // Validate internal stack array matches
      const stackContents = await stackPage.getStackContents();
      expect(stackContents).toEqual(['one', 'two', 'three']);

      // Ensure no page errors occurred
      expect(collectors.pageErrors.length).toBe(0);
    });

    test('clicking Add with numeric input triggers alert and does not modify stack (edge case)', async ({ page }) => {
      // Comment: The implementation treats numeric inputs as invalid — an alert should appear and stack should remain unchanged.
      const collectors = attachCollectors(page);
      const stackPage = new StackPage(page);
      await stackPage.goto();

      // Precondition: push a sentinel to detect no change after numeric attempt
      await stackPage.fillInput('sentinel');
      await stackPage.clickAdd();
      const beforeStack = await stackPage.getStackContents();
      expect(beforeStack.join(' ')).toContain('sentinel');

      // Now enter a numeric value that should trigger the alert
      await stackPage.fillInput('123');

      // Listen for the dialog and capture message
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        stackPage.clickAdd(),
      ]);

      // Verify the alert text matches expected message from implementation
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe('Invalid input. Please enter a number.');

      // Accept the dialog to continue
      await dialog.accept();

      // Ensure stack did not change because numeric input should be rejected
      const afterStack = await stackPage.getStackContents();
      expect(afterStack).toEqual(beforeStack);

      // Output should remain showing previously pushed sentinel (no change)
      const output = await stackPage.getOutputText();
      expect(output.trim()).toContain('sentinel');

      // No uncaught page errors expected
      expect(collectors.pageErrors.length).toBe(0);
    });

    test('empty string input triggers alert (treated as numeric) and stack remains unchanged (edge case)', async ({ page }) => {
      // Comment: isNaN('') is false, so the implementation treats empty input as numeric and alerts.
      const collectors = attachCollectors(page);
      const stackPage = new StackPage(page);
      await stackPage.goto();

      // Ensure stack initial snapshot
      const beforeStack = await stackPage.getStackContents();
      expect(Array.isArray(beforeStack)).toBeTruthy();

      // Fill input with empty string explicitly and click Add
      await stackPage.fillInput('');
      const dialogPromise = page.waitForEvent('dialog');
      await stackPage.clickAdd();
      const dialog = await dialogPromise;

      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe('Invalid input. Please enter a number.');
      await dialog.accept();

      // Stack should remain unchanged
      const afterStack = await stackPage.getStackContents();
      expect(afterStack).toEqual(beforeStack);

      // No page errors
      expect(collectors.pageErrors.length).toBe(0);
    });
  });

  test.describe('Observability: Console and Page Errors', () => {
    test('captures console messages and asserts no uncaught runtime errors (observability check)', async ({ page }) => {
      // Comment: This test solely validates that the page does not produce runtime exceptions or console errors during normal usage
      const collectors = attachCollectors(page);
      const stackPage = new StackPage(page);
      await stackPage.goto();

      // Perform a few interactions to potentially trigger runtime issues
      await stackPage.fillInput('alpha');
      await stackPage.clickAdd();
      await stackPage.fillInput('42'); // numeric -> alert
      const dialogPromise = page.waitForEvent('dialog');
      await stackPage.clickAdd();
      const dialog = await dialogPromise;
      await dialog.accept();

      // After interactions, assert that pageErrors does not contain critical JS error types
      const errorTypes = collectors.pageErrors.map((e) => e.name);
      // We expect no ReferenceError, SyntaxError, TypeError to have occurred
      expect(errorTypes).not.toContain('ReferenceError');
      expect(errorTypes).not.toContain('SyntaxError');
      expect(errorTypes).not.toContain('TypeError');

      // Also assert there are no console messages with type 'error'
      const consoleErrorMessages = collectors.consoleMessages.filter((c) => c.type === 'error');
      expect(consoleErrorMessages.length).toBe(0);

      // For debugging visibility: ensure we have seen at least some console messages (info/log) during interactions or none is acceptable
      // This assertion is permissive: we simply check that collectors exist as arrays
      expect(Array.isArray(collectors.consoleMessages)).toBe(true);
      expect(Array.isArray(collectors.pageErrors)).toBe(true);
    });
  });

  test.describe('FSM entry/exit action verification where possible', () => {
    test('verifies that the FSM-declared S0 entry action renderPage() did not cause an uncaught ReferenceError (if missing)', async ({ page }) => {
      // Comment: FSM mentions renderPage() as an S0 entry action, but implementation does not define it.
      // We verify that loading the page did NOT generate a ReferenceError named for renderPage.
      const collectors = attachCollectors(page);
      const stackPage = new StackPage(page);
      await stackPage.goto();

      // Allow a small idle time to capture any synchronous errors that might occur on load
      await page.waitForTimeout(50);

      // Search for any ReferenceError mentioning renderPage in captured page errors
      const refErrors = collectors.pageErrors.filter((e) => e.name === 'ReferenceError' && e.message.includes('renderPage'));
      // The implementation doesn't call renderPage(), so such ReferenceError should not exist
      expect(refErrors.length).toBe(0);

      // Also ensure no general ReferenceError occurred
      const anyRefError = collectors.pageErrors.some((e) => e.name === 'ReferenceError');
      expect(anyRefError).toBe(false);
    });
  });
});