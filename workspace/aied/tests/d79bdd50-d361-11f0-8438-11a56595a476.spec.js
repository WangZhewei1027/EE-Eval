import { test, expect } from '@playwright/test';

//
// d79bdd50-d361-11f0-8438-11a56595a476.spec.js
//
// Comprehensive Playwright tests for the "JavaScript Set Demo" interactive app.
//
// Tests validate the FSM states and transitions described in the specification:
// - S0_Empty (initial): output shows "(Set is empty)"
// - S1_NonEmpty: output shows "Set size: X" with Contents
// Events:
// - AddItems (click #addBtn)
// - ClearSet (click #clearBtn)
//
// The tests also capture console messages and page errors, observe dialogs (alerts),
// and include edge cases (empty input, duplicates, extraneous commas).
//

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79bdd50-d361-11f0-8438-11a56595a476.html';

// Page object for the Set demo page
class SetDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#itemInput');
    this.addBtn = page.locator('#addBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async addItems(text) {
    // Type into input then click add
    await this.input.fill(text);
    await this.addBtn.click();
  }

  async clickAdd() {
    await this.addBtn.click();
  }

  async clickClear() {
    await this.clearBtn.click();
  }

  async getOutputText() {
    // Use textContent to preserve the pre-wrap newline formatting
    const txt = await this.page.textContent('#output');
    return txt ?? '';
  }

  async getInputValue() {
    return (await this.input.inputValue()).toString();
  }
}

test.describe('JavaScript Set Demo - FSM and interactions', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Attach listeners for console and pageerror before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // Capture console messages (type, text)
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Capture page errors (unhandled exceptions e.g., ReferenceError)
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test we assert there were no uncaught page errors (ReferenceError/SyntaxError/TypeError).
    // This ensures runtime errors didn't occur silently during the test.
    expect(pageErrors.length, `Expected no uncaught page errors, but found: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
  });

  test('Initial state: S0_Empty - output shows "(Set is empty)" on load', async ({ page }) => {
    // Validate the initial entry action (updateOutput) produced the empty-set output
    const demo = new SetDemoPage(page);
    await demo.goto();

    // Check DOM shows the expected initial message
    const out = await demo.getOutputText();
    expect(out.trim()).toBe('(Set is empty)');

    // Ensure input is present and empty
    const inputVal = await demo.getInputValue();
    expect(inputVal).toBe('');

    // Ensure no console errors were emitted
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
  });

  test('AddItems transition: from empty to non-empty (S0_Empty -> S1_NonEmpty)', async ({ page }) => {
    // Add items and verify output reflects Set size and contents
    const demo = new SetDemoPage(page);
    await demo.goto();

    // Add 'apple, banana, apple' - note duplicate 'apple' should be ignored by the Set
    await demo.addItems('apple, banana, apple');

    const out = await demo.getOutputText();

    // Expect Set size: 2 and contents to include JSON-stringified "apple" and "banana"
    expect(out).toContain('Set size: 2');
    expect(out).toContain('"apple"');
    expect(out).toContain('"banana"');

    // Input should be cleared after adding
    const inputVal = await demo.getInputValue();
    expect(inputVal).toBe('');

    // No console errors
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
  });

  test('AddItems transition: adding additional unique item keeps S1_NonEmpty and updates size', async ({ page }) => {
    // Add initial items then add another one and verify size increases
    const demo = new SetDemoPage(page);
    await demo.goto();

    // Start with initial entries
    await demo.addItems('apple, banana');

    let out = await demo.getOutputText();
    expect(out).toContain('Set size: 2');

    // Add 'orange' which should increase size to 3
    await demo.addItems('orange');

    out = await demo.getOutputText();
    expect(out).toContain('Set size: 3');
    expect(out).toContain('"orange"');

    // No console errors
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
  });

  test('ClearSet transition: S1_NonEmpty -> S0_Empty resets to "(Set is empty)"', async ({ page }) => {
    // Populate set then clear and confirm the empty state is restored
    const demo = new SetDemoPage(page);
    await demo.goto();

    await demo.addItems('apple, banana');
    let out = await demo.getOutputText();
    expect(out).toContain('Set size: 2');

    // Click clear button
    await demo.clickClear();

    out = await demo.getOutputText();
    expect(out.trim()).toBe('(Set is empty)');

    // No console errors
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
  });

  test('Edge case: clicking Add with empty input triggers an alert dialog', async ({ page }) => {
    // The app uses alert('Please enter at least one item.') when input is blank.
    const demo = new SetDemoPage(page);
    await demo.goto();

    // Ensure input is empty
    await demo.input.fill('');
    // Listen for the dialog and assert the message
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      demo.clickAdd(), // action that triggers the dialog
    ]);
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toBe('Please enter at least one item.');
    await dialog.accept();

    // After dismissing, still in empty state
    const out = await demo.getOutputText();
    expect(out.trim()).toBe('(Set is empty)');

    // No page errors
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
  });

  test('Edge case: adding entries with extra commas and whitespace filters empty entries', async ({ page }) => {
    // Input like " , , apple, , banana , " should add only apple and banana
    const demo = new SetDemoPage(page);
    await demo.goto();

    await demo.addItems('  , , apple , , banana ,  ,');

    const out = await demo.getOutputText();
    expect(out).toContain('Set size: 2');
    expect(out).toContain('"apple"');
    expect(out).toContain('"banana"');
  });

  test('Edge case: adding duplicate-only entries does not increase size', async ({ page }) => {
    // Start empty, add 'kiwi, kiwi' -> size 1
    const demo = new SetDemoPage(page);
    await demo.goto();

    await demo.addItems('kiwi, kiwi');

    const out = await demo.getOutputText();
    expect(out).toContain('Set size: 1');
    // Ensure "kiwi" present once in the contents (we check size; textual duplication beyond that is not strictly necessary)
    expect(out).toContain('"kiwi"');
  });

  test('Console and runtime validation: capture console messages and ensure no unhandled exceptions', async ({ page }) => {
    // This test intentionally loads the app and inspects console messages captured in beforeEach.
    const demo = new SetDemoPage(page);
    await demo.goto();

    // Simple interactions to produce console activity (if any)
    await demo.addItems('alpha');
    await demo.addItems('beta');
    await demo.clickClear();

    // Assert that we captured console messages array (may be empty) and that none are errors
    const errorMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorMsgs.length).toBe(0, `Found console.error messages: ${JSON.stringify(errorMsgs)}`);

    // Also ensure there were no unhandled page errors collected in afterEach (that assertion runs then).
    // But we explicitly assert pageErrors is an empty array here as well to provide earlier diagnostics if needed.
    expect(pageErrors.length).toBe(0);
  });
});