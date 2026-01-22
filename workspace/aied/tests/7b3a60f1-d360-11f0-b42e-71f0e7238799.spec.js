import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3a60f1-d360-11f0-b42e-71f0e7238799.html';

class SetPage {
  /**
   * Page object encapsulating interactions with the Set Demonstration app.
   */
  constructor(page) {
    this.page = page;
    this.numberInput = page.locator('#numberInput');
    this.addButton = page.locator('#addButton');
    this.clearButton = page.locator('#clearButton');
    this.setContent = page.locator('#setContent');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // ensure main elements are present
    await Promise.all([
      this.numberInput.waitFor({ state: 'visible' }),
      this.addButton.waitFor({ state: 'visible' }),
      this.clearButton.waitFor({ state: 'visible' }),
      this.setContent.waitFor({ state: 'visible' })
    ]);
  }

  async addNumber(value) {
    await this.numberInput.fill(String(value));
    await this.addButton.click();
  }

  async clearSet() {
    await this.clearButton.click();
  }

  async getSetText() {
    return (await this.setContent.textContent()).trim();
  }

  async getInputValue() {
    return (await this.numberInput.inputValue());
  }

  async placeholder() {
    return await this.numberInput.getAttribute('placeholder');
  }
}

test.describe('Set Demonstration (FSM validation) - Application ID: 7b3a60f1-d360-11f0-b42e-71f0e7238799', () => {
  let consoleMessages;
  let pageErrors;

  // Attach console and pageerror listeners before each test so we capture any runtime issues.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // capture all console messages for inspection
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // capture unhandled exceptions
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // In each test ensure no unexpected runtime errors occurred.
    // These assertions are repeated per test to make failures easier to diagnose.
    // There should be no page errors (uncaught exceptions).
    expect(pageErrors.length, `Expected no page errors, but found: ${pageErrors.map(e => String(e)).join(' ; ')}`).toBe(0);

    // There should be no console messages of type 'error' indicating runtime issues.
    const errorConsoles = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoles.length, `Expected no console.error messages, but found: ${JSON.stringify(errorConsoles)}`).toBe(0);
  });

  test('Initial Idle state renders correctly (S0_Idle) and shows empty set', async ({ page }) => {
    // Validate initial rendering and default values representing the Idle state.
    const app = new SetPage(page);
    await app.goto();

    // Input should be present and have the correct placeholder
    await expect(app.numberInput).toBeVisible();
    expect(await app.placeholder()).toBe('Enter a number');

    // Buttons should be visible
    await expect(app.addButton).toBeVisible();
    await expect(app.clearButton).toBeVisible();

    // Set content should display the empty array [] at start
    const initialSetText = await app.getSetText();
    expect(initialSetText).toBe('[]');

    // No input value initially
    expect(await app.getInputValue()).toBe('');

    // No runtime errors during initial load
    // (afterEach will also assert no errors)
  });

  test('AddToSet event adds values and updates display (S0_Idle -> S1_SetUpdated -> S0_Idle)', async ({ page }) => {
    // This test verifies:
    // - Adding a valid number updates setContent (transition to Set Updated)
    // - Input is cleared after adding (exit action: numberInput.value = '')
    // - Duplicates are ignored by the Set
    const app = new SetPage(page);
    await app.goto();

    // Add 5
    await app.addNumber('5');
    await expect(app.setContent).toHaveText('[5]');
    // Input should be cleared after add (transition S1 -> S0)
    expect(await app.getInputValue()).toBe('');

    // Add 7
    await app.addNumber('7');
    // Order in a Set preserves insertion order: [5,7]
    await expect(app.setContent).toHaveText('[5,7]');
    expect(await app.getInputValue()).toBe('');

    // Attempt to add duplicate 5; set should not change
    await app.addNumber('5');
    await expect(app.setContent).toHaveText('[5,7]');
    expect(await app.getInputValue()).toBe('');

    // Also verify adding numeric-like input with spaces works (trim behavior)
    await app.addNumber(' 42 ');
    await expect(app.setContent).toHaveText('[5,7,42]');

    // No runtime errors recorded
  });

  test('ClearSet event clears the set (S0_Idle -> S2_SetCleared)', async ({ page }) => {
    // This test verifies:
    // - Clear button empties the set and updates display to []
    const app = new SetPage(page);
    await app.goto();

    // Seed with a couple of values
    await app.addNumber('1');
    await app.addNumber('2');
    await expect(app.setContent).toHaveText('[1,2]');

    // Click clear
    await app.clearSet();
    // After clearing, set should be empty array
    await expect(app.setContent).toHaveText('[]');

    // Input should remain empty (not required by FSM but logical)
    expect(await app.getInputValue()).toBe('');
  });

  test('Edge cases: invalid input triggers alert and does not modify the set', async ({ page }) => {
    // This test covers error scenarios:
    // - Non-numeric input should trigger an alert and should not change the set
    const app = new SetPage(page);
    await app.goto();

    // Ensure set starts empty
    await expect(app.setContent).toHaveText('[]');

    // Listen for dialog and capture message
    let dialogMessage = null;
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.accept(); // dismiss the alert to keep the test moving
    });

    // Attempt to add invalid input
    await app.addNumber('abc');

    // The application should have shown an alert with 'Please enter a valid number.'
    expect(dialogMessage).toBe('Please enter a valid number.');

    // The set should remain unchanged
    await expect(app.setContent).toHaveText('[]');

    // Also test empty input (just click Add with empty string)
    // The page will show an alert as well. Capture it.
    dialogMessage = null;
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });
    // Make sure input is empty
    await app.numberInput.fill('');
    await app.addButton.click();
    expect(dialogMessage).toBe('Please enter a valid number.');

    // No runtime errors recorded
  });

  test('Visual feedback and DOM integrity checks after sequence of operations', async ({ page }) => {
    // This test performs a longer sequence and validates DOM remains consistent:
    // add multiple numbers, clear, add again, ensure setContent text is always valid JSON array.
    const app = new SetPage(page);
    await app.goto();

    // Add numbers
    await app.addNumber('10');
    await app.addNumber('20');
    await app.addNumber('30');
    let text = await app.getSetText();
    expect(text).toBe('[10,20,30]');

    // Clear
    await app.clearSet();
    text = await app.getSetText();
    expect(text).toBe('[]');

    // Add after clear
    await app.addNumber('99');
    text = await app.getSetText();
    expect(text).toBe('[99]');

    // Verify that setContent contains valid JSON that parses to an array of numbers
    const parsed = JSON.parse(await app.getSetText());
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toEqual([99]);

    // Validate that the #output container still exists and contains the label text
    await expect(app.output).toContainText('Current Set:');
  });

});