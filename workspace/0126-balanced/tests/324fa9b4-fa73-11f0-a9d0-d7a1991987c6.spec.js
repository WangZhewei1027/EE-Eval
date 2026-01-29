import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324fa9b4-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object for the Type System Demonstration page
class TypeSystemPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.select = page.locator('#typeSelector');
    this.input = page.locator('#inputValue');
    this.button = page.locator('#checkTypeButton');
    this.output = page.locator('#output');
  }

  // Navigate to the page
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Select a type by its value attribute (e.g., 'string', 'number', ...)
  async selectType(value) {
    await this.select.selectOption({ value });
  }

  // Fill the input value
  async fillValue(value) {
    await this.input.fill(value);
  }

  // Click the check button. If expecting a dialog, capture and return its message.
  // Returns an object { dialogMessage?: string, outputText?: string }
  async clickCheck(expectDialog = false) {
    let dialogMessage = undefined;

    if (expectDialog) {
      const dialogPromise = this.page.waitForEvent('dialog', { timeout: 2000 });
      await this.button.click();
      const dialog = await dialogPromise;
      dialogMessage = dialog.message();
      await dialog.accept();
      // No output update expected in this case (the function returns early in the implementation)
      return { dialogMessage, outputText: await this.getOutputText() };
    } else {
      // Capture current output text then wait until it changes to avoid race conditions
      const previous = await this.getOutputText();
      await this.button.click();
      // Wait for output to change or stay the same if code leaves it unchanged
      await this.page.waitForFunction(
        (selector, prev) => document.querySelector(selector).innerText !== prev,
        this.output.selector(),
        previous
      ).catch(() => {
        // timeout or no change; continue to read whatever output is present
      });
      return { outputText: await this.getOutputText() };
    }
  }

  // Read output text
  async getOutputText() {
    return (await this.output.innerText()).trim();
  }
}

test.describe('Type System Demonstration - FSM validation', () => {
  // Arrays to collect console errors and page errors per test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console.error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Collect unhandled page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err.toString());
    });
  });

  test.afterEach(async ({ page }) => {
    // Asserting no unexpected console errors or page errors happened during the test.
    // This helps surface runtime ReferenceError, TypeError, SyntaxError, etc., if they occur.
    expect(consoleErrors, `Unexpected console.error messages: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
    expect(pageErrors, `Unexpected page errors: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
  });

  test.describe('Initial state (S0_Idle)', () => {
    test('renders all required components on load', async ({ page }) => {
      // This test validates the initial Idle state: elements exist as per FSM evidence.
      const app = new TypeSystemPage(page);
      await app.goto();

      // Check that the select, input, button, and output div are present
      await expect(page.locator('#typeSelector')).toBeVisible();
      await expect(page.locator('#inputValue')).toBeVisible();
      await expect(page.locator('#checkTypeButton')).toBeVisible();
      await expect(page.locator('#output')).toBeVisible();

      // Verify initial output is empty
      const initialOutput = await app.getOutputText();
      expect(initialOutput).toBe('');
    });
  });

  test.describe('Type checks and transition (S0_Idle -> S1_TypeChecked)', () => {
    // Test cases for each type with values that should be valid
    const validCases = [
      { type: 'string', value: 'hello', expectedValid: true, description: 'any input is a string (inputValue is always a string)' },
      { type: 'number', value: '123', expectedValid: true, description: 'numeric string is a number' },
      { type: 'number', value: '  42  ', expectedValid: true, description: 'numeric string with whitespace' },
      { type: 'boolean', value: 'true', expectedValid: true, description: 'boolean true (lowercase)' },
      { type: 'boolean', value: 'FALSE', expectedValid: true, description: 'boolean false (uppercase)' },
      { type: 'object', value: '{"a":1}', expectedValid: true, description: 'valid JSON object' },
      { type: 'array', value: '[1,2,3]', expectedValid: true, description: 'valid JSON array' },
      { type: 'function', value: 'function() { return 1; }', expectedValid: true, description: 'string contains "function"' }
    ];

    for (const c of validCases) {
      test(`valid case: ${c.type} -> "${c.value}" (${c.description})`, async ({ page }) => {
        // Validate that clicking Check Type transitions to Type Checked state and output matches expected valid message
        const app1 = new TypeSystemPage(page);
        await app.goto();

        await app.selectType(c.type);
        await app.fillValue(c.value);
        const { outputText } = await app.clickCheck(false);

        const expectedMessage = `The value "${c.value}" is a valid ${c.type}.`;
        expect(outputText).toBe(expectedMessage);
      });
    }

    // Test cases for invalid inputs per type
    const invalidCases = [
      { type: 'number', value: '12ab', expectedValid: false, description: 'non-numeric string' },
      { type: 'number', value: '', expectedValid: false, description: 'empty string is not a number' },
      { type: 'boolean', value: 'yes', expectedValid: false, description: 'non-boolean string' },
      { type: 'object', value: '{invalid:}', expectedValid: false, description: 'malformed JSON object' },
      { type: 'array', value: '{"not":"array"}', expectedValid: false, description: 'JSON object is not array' },
      { type: 'function', value: '() => {}', expectedValid: false, description: 'arrow function without literal "function" not matched' }
    ];

    for (const c of invalidCases) {
      test(`invalid case: ${c.type} -> "${c.value}" (${c.description})`, async ({ page }) => {
        // Validate invalid cases produce the NOT valid message in output
        const app2 = new TypeSystemPage(page);
        await app.goto();

        await app.selectType(c.type);
        await app.fillValue(c.value);
        const { outputText } = await app.clickCheck(false);

        const expectedMessage1 = `The value "${c.value}" is NOT a valid ${c.type}.`;
        expect(outputText).toBe(expectedMessage);
      });
    }

    test('string type treats empty string as valid (edge case due to typeof check)', async ({ page }) => {
      // The implementation uses typeof inputValue === 'string', so even empty string should be valid.
      const app3 = new TypeSystemPage(page);
      await app.goto();

      await app.selectType('string');
      await app.fillValue('');
      const { outputText } = await app.clickCheck(false);

      const expectedMessage2 = `The value "" is a valid string.`;
      expect(outputText).toBe(expectedMessage);
    });
  });

  test.describe('Edge cases, dialogs and error scenarios', () => {
    test('clicking Check Type without selecting a type triggers an alert dialog', async ({ page }) => {
      // Validate that when no type is selected (value == ''), the page shows an alert and returns early
      const app4 = new TypeSystemPage(page);
      await app.goto();

      // Ensure no type is selected
      await app.selectType(''); // selects the default "Choose a type"
      await app.fillValue('anything');

      // Expect a dialog with the specific message and that output remains unchanged (empty)
      const result = await app.clickCheck(true);
      expect(result.dialogMessage).toBe('Please select a type to check.');

      // Output should be empty because function returns early without modifying output
      const outputText = await app.getOutputText();
      expect(outputText).toBe('');
    });

    test('object and array parsing errors do not throw runtime exceptions (are caught internally)', async ({ page }) => {
      // Provide malformed JSON inputs and ensure the app sets isValid false and updates output instead of throwing
      const app5 = new TypeSystemPage(page);
      await app.goto();

      // Malformed object
      await app.selectType('object');
      await app.fillValue('{a:}');
      const resultObj = await app.clickCheck(false);
      expect(resultObj.outputText).toBe('The value "{a:}" is NOT a valid object.');

      // Malformed array
      await app.selectType('array');
      await app.fillValue('[1,2,');

      const resultArr = await app.clickCheck(false);
      expect(resultArr.outputText).toBe('The value "[1,2," is NOT a valid array.');
    });
  });
});