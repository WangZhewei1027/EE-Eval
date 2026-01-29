import { test, expect } from '@playwright/test';

// Test file for Application ID: 324c4e50-fa73-11f0-a9d0-d7a1991987c6
// NOTE: This test loads the page as-is, observes console logs and page errors,
// and does not modify the application code or environment.

// URL where the HTML is served
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324c4e50-fa73-11f0-a9d0-d7a1991987c6.html';

// Simple Page Object Model for the Dynamic Array page
class DynamicArrayPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#element-input');
    this.addButton = page.locator('#add-button');
    this.removeButton = page.locator('#remove-button');
    this.output = page.locator('#array-output');
  }

  // Add an element via UI
  async addElement(value) {
    await this.input.fill(value);
    await this.addButton.click();
  }

  // Click remove
  async removeLastElement() {
    await this.removeButton.click();
  }

  // Read output text
  async getOutputText() {
    return (await this.output.textContent())?.trim();
  }

  // Ensure input value (useful to check clearing behavior)
  async getInputValue() {
    return await this.input.inputValue();
  }
}

// Group tests for states and transitions
test.describe('Dynamic Array Demo - FSM state & transition tests', () => {
  // Arrays to collect console errors and uncaught page errors per test
  let consoleErrors;
  let pageErrors;

  // Create page object in beforeEach for each test
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages of type 'error'
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Collect uncaught exceptions (pageerror)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Nothing to teardown here; listeners are tied to the page instance and will be cleaned up by Playwright.
  });

  test('Initial state (S0_Idle) - UI elements present and output is empty array', async ({ page }) => {
    // Validate S0_Idle: all elements exist and initial output shows an empty array.
    const app = new DynamicArrayPage(page);

    // Check presence of elements
    await expect(app.input).toBeVisible();
    await expect(app.addButton).toBeVisible();
    await expect(app.removeButton).toBeVisible();
    await expect(app.output).toBeVisible();

    // Initial output should be exactly "Dynamic Array: []"
    const outputText = await app.getOutputText();
    expect(outputText).toBe('Dynamic Array: []');

    // Input should be empty
    const inputValue = await app.getInputValue();
    expect(inputValue).toBe('');

    // Assert that no console errors or uncaught page errors occurred during load
    expect(consoleErrors, `Console errors found: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
    expect(pageErrors, `Page errors found: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
  });

  test('AddElement event - adding a single element transitions to Element Added (S1_ElementAdded) and onEnter updateOutput invoked', async ({ page }) => {
    // This test validates:
    // - Clicking Add Element with valid input adds the element to the dynamic array
    // - The displayed output updates accordingly (updateOutput run on entry)
    // - The input is cleared after adding
    const app1 = new DynamicArrayPage(page);

    // Add 'foo' and assert DOM updates
    await app.addElement('foo');

    // Output should reflect the added element
    await expect(app.output).toHaveText('Dynamic Array: [foo]');

    // Input should be cleared per implementation
    const inputValueAfter = await app.getInputValue();
    expect(inputValueAfter).toBe('');

    // No console or page errors expected
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('AddElement event - adding empty input triggers alert and stays in Idle (error scenario)', async ({ page }) => {
    // This test validates the edge case described in the FSM:
    // - If Add is clicked with empty input, an alert with specific text is shown
    // - The array output remains unchanged
    const app2 = new DynamicArrayPage(page);

    // Ensure input is empty
    await app.input.fill('');
    // Listen for dialog and assert message
    page.once('dialog', async (dialog) => {
      try {
        expect(dialog.type()).toBe('alert');
        expect(dialog.message()).toBe('Please enter a valid element.');
      } finally {
        await dialog.accept();
      }
    });

    // Click add with empty input
    await app.addButton.click();

    // Output should still be empty array
    await expect(app.output).toHaveText('Dynamic Array: []');

    // No unexpected console/page errors during this flow
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('Multiple AddElement events - transitions S1 -> S0 (adding when array non-empty) and array accumulates values', async ({ page }) => {
    // Validate adding multiple elements in sequence updates the array appropriately.
    const app3 = new DynamicArrayPage(page);

    // Add first element
    await app.addElement('alpha');
    await expect(app.output).toHaveText('Dynamic Array: [alpha]');

    // Add second element (array non-empty) - still allowed; FSM indicates a transition
    await app.addElement('beta');
    await expect(app.output).toHaveText('Dynamic Array: [alpha, beta]');

    // Add third element
    await app.addElement('gamma');
    await expect(app.output).toHaveText('Dynamic Array: [alpha, beta, gamma]');

    // Confirm no console/page errors
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('RemoveElement event - removing last element transitions to Element Removed (S2_ElementRemoved) and updates output', async ({ page }) => {
    // This test validates:
    // - Removing when there are elements pops the last
    // - updateOutput is called and DOM updated
    const app4 = new DynamicArrayPage(page);

    // Prepare by adding two elements
    await app.addElement('one');
    await app.addElement('two');
    await expect(app.output).toHaveText('Dynamic Array: [one, two]');

    // Remove last (should remove 'two')
    await app.removeLastElement();
    await expect(app.output).toHaveText('Dynamic Array: [one]');

    // Remove last again (should remove 'one' -> back to empty array)
    await app.removeLastElement();
    await expect(app.output).toHaveText('Dynamic Array: []');

    // No console/page errors expected
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('RemoveElement event - removing when empty triggers alert (edge case)', async ({ page }) => {
    // Validate the FSM's edge case: removing when dynamicArray.length === 0 shows an alert
    const app5 = new DynamicArrayPage(page);

    // Ensure array is empty at start
    await expect(app.output).toHaveText('Dynamic Array: []');

    // Expect an alert that says 'No elements to remove.'
    page.once('dialog', async (dialog) => {
      try {
        expect(dialog.type()).toBe('alert');
        expect(dialog.message()).toBe('No elements to remove.');
      } finally {
        await dialog.accept();
      }
    });

    // Click remove when empty
    await app.removeButton.click();

    // Output remains unchanged
    await expect(app.output).toHaveText('Dynamic Array: []');

    // No console/page errors expected
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('Sequence test: Add and Remove repeatedly to exercise all transitions', async ({ page }) => {
    // This comprehensive test performs a sequence of operations to exercise FSM transitions:
    // S0 (idle) -> S1 (add) -> S0 -> S1 -> S0 -> S2 (remove) -> S0 etc.
    const app6 = new DynamicArrayPage(page);

    // Start idle
    await expect(app.output).toHaveText('Dynamic Array: []');

    // Add A
    await app.addElement('A');
    await expect(app.output).toHaveText('Dynamic Array: [A]');

    // Add B
    await app.addElement('B');
    await expect(app.output).toHaveText('Dynamic Array: [A, B]');

    // Remove (should remove B)
    await app.removeLastElement();
    await expect(app.output).toHaveText('Dynamic Array: [A]');

    // Add C
    await app.addElement('C');
    await expect(app.output).toHaveText('Dynamic Array: [A, C]');

    // Remove twice to empty
    await app.removeLastElement();
    await expect(app.output).toHaveText('Dynamic Array: [A]');
    await app.removeLastElement();
    await expect(app.output).toHaveText('Dynamic Array: []');

    // Now attempt remove on empty -> expect alert
    page.once('dialog', async (dialog) => {
      try {
        expect(dialog.message()).toBe('No elements to remove.');
      } finally {
        await dialog.accept();
      }
    });
    await app.removeLastElement();

    // Final assertions: no unexpected console/page errors
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('DOM integrity and updateOutput behavior verification (indirect onEnter assertions)', async ({ page }) => {
    // This test indirectly verifies the entry action updateOutput() by asserting
    // that after each modifying event the #array-output content is consistent with the internal operations.
    const app7 = new DynamicArrayPage(page);

    // Add different types of values (numbers, text)
    await app.addElement('123');
    await expect(app.output).toHaveText('Dynamic Array: [123]');

    await app.addElement('hello');
    await expect(app.output).toHaveText('Dynamic Array: [123, hello]');

    // Remove one
    await app.removeLastElement();
    await expect(app.output).toHaveText('Dynamic Array: [123]');

    // Ensure input is cleared after adds
    const inputVal = await app.getInputValue();
    expect(inputVal).toBe('');

    // Ensure the output DOM node exists and has expected formatting
    const outputText1 = await app.getOutputText();
    expect(outputText.startsWith('Dynamic Array: [')).toBeTruthy();

    // No console/page errors expected
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });
});