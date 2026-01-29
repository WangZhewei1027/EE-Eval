import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d0f341-fa79-11f0-8075-e54a10595dde.html';

/**
 * Page Object representing the Type System Demo page.
 * Encapsulates common interactions and lookups to keep tests readable.
 */
class TypeSystemPage {
  constructor(page) {
    this.page = page;
    this.dataType = page.locator('#dataType');
    this.inputValue = page.locator('#inputValue');
    this.submitBtn = page.locator('#submitBtn');
    this.outputDiv = page.locator('#output');
    this.increaseBtn = page.locator('#increaseBtn');
    this.decreaseBtn = page.locator('#decreaseBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.currentValue = page.locator('#currentValue');
    this.booleanToggle = page.locator('#booleanToggle');
    this.booleanOutput = page.locator('#booleanOutput');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async selectType(value) {
    await this.dataType.selectOption(value);
  }

  async enterValue(value) {
    await this.inputValue.fill(''); // ensure clean
    await this.inputValue.type(value);
  }

  async clickSubmit() {
    await this.submitBtn.click();
  }

  async getOutputText() {
    return (await this.outputDiv.innerText()).trim();
  }

  async increase() {
    await this.increaseBtn.click();
  }

  async decrease() {
    await this.decreaseBtn.click();
  }

  async reset() {
    await this.resetBtn.click();
  }

  async getCurrentValueText() {
    return (await this.currentValue.innerText()).trim();
  }

  async toggleBoolean(check) {
    // Accepts boolean: true -> check, false -> uncheck
    const isChecked = await this.booleanToggle.isChecked();
    if (check && !isChecked) {
      await this.booleanToggle.check();
    } else if (!check && isChecked) {
      await this.booleanToggle.uncheck();
    }
  }

  async getBooleanOutputText() {
    return (await this.booleanOutput.innerText()).trim();
  }

  async clearInput() {
    await this.inputValue.fill('');
  }
}

// Run tests serially to avoid shared mutable state with console/pageerror listeners.
test.describe.serial('Type System Demo - FSM and UI Validation (99d0f341-fa79-11f0-8075-e54a10595dde)', () => {
  // We'll capture console messages and page errors for each test to validate runtime health.
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture uncaught page errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages for inspection (info, warn, error, debug)
    page.on('console', (msg) => {
      // store the message type and text
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // After each test assert that there were no uncaught page errors.
    // This ensures the page ran without unexpected runtime exceptions.
    expect(pageErrors.map(e => e.message)).toEqual([]);
  });

  test('Initial render: S0_Idle evidence present (header, select, input)', async ({ page }) => {
    // Validate the S0_Idle state's expected DOM elements are present on initial render.
    const p = new TypeSystemPage(page);

    // Check title H1
    await expect(page.locator('h1')).toHaveText('Type System Demo');

    // Ensure select and input exist and have expected default values
    await expect(p.dataType).toBeVisible();
    await expect(p.inputValue).toBeVisible();
    await expect(p.dataType).toHaveValue('string'); // default option
    await expect(p.inputValue).toHaveValue('');

    // No output initially
    await expect(p.outputDiv).toBeEmpty();

    // Ensure no runtime errors occurred during initial load
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Submit and type handling (S1, S2, S3, S4, S5)', () => {
    test('String submission -> S1_StringEntered', async ({ page }) => {
      // This validates entering a string and submitting transitions to S1_StringEntered
      const p = new TypeSystemPage(page);
      await p.selectType('string');
      await p.enterValue('hello world');
      await p.clickSubmit();

      const out = await p.getOutputText();
      expect(out).toBe('You entered a string: hello world');

      // Edge: submitting empty string should still be accepted as string
      await p.enterValue('');
      await p.clickSubmit();
      expect(await p.getOutputText()).toBe('You entered a string: ');
    });

    test('Valid number submission -> S2_NumberEntered', async ({ page }) => {
      // Valid integer
      const p = new TypeSystemPage(page);
      await p.selectType('number');
      await p.enterValue('42');
      await p.clickSubmit();
      expect(await p.getOutputText()).toBe('You entered a number: 42');

      // Valid float
      await p.enterValue('3.1415');
      await p.clickSubmit();
      expect(await p.getOutputText()).toBe('You entered a number: 3.1415');
    });

    test('Invalid number submission -> S3_InvalidNumber', async ({ page }) => {
      // Non-numeric input should show "Invalid number!"
      const p = new TypeSystemPage(page);
      await p.selectType('number');
      await p.enterValue('not a number');
      await p.clickSubmit();
      expect(await p.getOutputText()).toBe('Invalid number!');

      // Empty input -> parseFloat('') is NaN -> invalid
      await p.enterValue('');
      await p.clickSubmit();
      expect(await p.getOutputText()).toBe('Invalid number!');
    });

    test('Boolean submission true/false -> S4_BooleanEntered and valid false', async ({ page }) => {
      const p = new TypeSystemPage(page);
      await p.selectType('boolean');

      // true (case-insensitive)
      await p.enterValue('true');
      await p.clickSubmit();
      expect(await p.getOutputText()).toBe('You entered a boolean: true');

      // mixed-case true
      await p.enterValue('TrUe');
      await p.clickSubmit();
      expect(await p.getOutputText()).toBe('You entered a boolean: true');

      // false
      await p.enterValue('false');
      await p.clickSubmit();
      expect(await p.getOutputText()).toBe('You entered a boolean: false');

      // mixed-case false
      await p.enterValue('FaLsE');
      await p.clickSubmit();
      expect(await p.getOutputText()).toBe('You entered a boolean: false');
    });

    test('Invalid boolean submission -> S5_InvalidBoolean', async ({ page }) => {
      const p = new TypeSystemPage(page);
      await p.selectType('boolean');
      await p.enterValue('not boolean');
      await p.clickSubmit();
      expect(await p.getOutputText()).toBe('Invalid boolean!');

      // empty input is invalid boolean
      await p.enterValue('');
      await p.clickSubmit();
      expect(await p.getOutputText()).toBe('Invalid boolean!');
    });

    test('Changing data type clears input and output (DataTypeChange event)', async ({ page }) => {
      // This validates the 'change' handler on #dataType which should clear inputValue and output
      const p = new TypeSystemPage(page);
      await p.selectType('string');
      await p.enterValue('will be cleared');
      await p.selectType('number'); // change event triggers clearing
      // input and output should be cleared
      await expect(p.inputValue).toHaveValue('');
      await expect(p.outputDiv).toBeEmpty();
    });
  });

  test.describe('Number manipulation controls (S6_NumberManipulated)', () => {
    test('Increase, decrease, reset update #currentValue as expected', async ({ page }) => {
      // Validates transitions in the number manipulation part of the FSM.
      const p = new TypeSystemPage(page);

      // Initial value
      expect(await p.getCurrentValueText()).toBe('0');

      // Increase
      await p.increase();
      expect(await p.getCurrentValueText()).toBe('1');

      // Increase again
      await p.increase();
      expect(await p.getCurrentValueText()).toBe('2');

      // Decrease
      await p.decrease();
      expect(await p.getCurrentValueText()).toBe('1');

      // Decrease below zero
      await p.decrease();
      await p.decrease();
      expect(await p.getCurrentValueText()).toBe('-1');

      // Reset should bring back to zero
      await p.reset();
      expect(await p.getCurrentValueText()).toBe('0');
    });
  });

  test.describe('Boolean toggle behavior (S7_BooleanToggled)', () => {
    test('Toggling checkbox updates boolean output text', async ({ page }) => {
      // Validates the change handler for #booleanToggle, ensuring output text matches toggle state.
      const p = new TypeSystemPage(page);

      // Initial state
      expect(await p.getBooleanOutputText()).toBe('Boolean is OFF');

      // Toggle ON
      await p.toggleBoolean(true);
      expect(await p.getBooleanOutputText()).toBe('Boolean is ON');

      // Toggle OFF
      await p.toggleBoolean(false);
      expect(await p.getBooleanOutputText()).toBe('Boolean is OFF');
    });
  });

  test.describe('Edge cases and combined interactions', () => {
    test('Submit string after number manipulation and ensure independent states', async ({ page }) => {
      // Ensure the number manipulation controls and submission logic operate independently.
      const p = new TypeSystemPage(page);

      // Manipulate number
      await p.increase();
      await p.increase();
      expect(await p.getCurrentValueText()).toBe('2');

      // Now submit a string - should not affect currentValue
      await p.selectType('string');
      await p.enterValue('independent');
      await p.clickSubmit();
      expect(await p.getOutputText()).toBe('You entered a string: independent');
      expect(await p.getCurrentValueText()).toBe('2'); // unchanged
    });

    test('Multiple sequential submits with different types produce expected outputs', async ({ page }) => {
      const p = new TypeSystemPage(page);

      // String
      await p.selectType('string');
      await p.enterValue('first');
      await p.clickSubmit();
      expect(await p.getOutputText()).toBe('You entered a string: first');

      // Number
      await p.selectType('number');
      await p.enterValue('100');
      await p.clickSubmit();
      expect(await p.getOutputText()).toBe('You entered a number: 100');

      // Boolean
      await p.selectType('boolean');
      await p.enterValue('false');
      await p.clickSubmit();
      expect(await p.getOutputText()).toBe('You entered a boolean: false');
    });
  });

  test('Runtime instrumentation: inspect console messages and ensure no unexpected runtime errors', async ({ page }) => {
    // This test explicitly inspects collected console messages and page errors.
    // It ensures there are no console.error messages and no uncaught exceptions (pageerror).
    const p = new TypeSystemPage(page);

    // perform some interactions to potentially produce console output
    await p.selectType('string');
    await p.enterValue('check-console');
    await p.clickSubmit();

    await p.selectType('number');
    await p.enterValue('999');
    await p.clickSubmit();

    // Allow any asynchronous logs to flush briefly
    await page.waitForTimeout(50);

    // Inspect collected console messages for errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.text));
    // We expect there to be no console.error or text indicating error
    expect(consoleErrors).toEqual([]);

    // Ensure there were no uncaught page errors
    expect(pageErrors.length).toBe(0);
  });
});