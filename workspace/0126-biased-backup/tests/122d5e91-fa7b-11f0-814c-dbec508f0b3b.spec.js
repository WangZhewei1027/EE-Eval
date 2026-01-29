import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122d5e91-fa7b-11f0-814c-dbec508f0b3b.html';

/**
 * Page Object representing the controls in the Routing Demo app.
 * Encapsulates common interactions so tests are clearer and DRY.
 */
class ControlsPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.submit = page.locator('#submit');
    this.num1 = page.locator('#num1');
    this.num2 = page.locator('#num2');
    this.text = page.locator('#text');
    this.chk1 = page.locator('#chk1');
    this.chk2 = page.locator('#chk2');
    this.btn1 = page.locator('#btn1');
    this.btn2 = page.locator('#btn2');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getInitialValues() {
    return {
      num1: await this.num1.inputValue(),
      num2: await this.num2.inputValue(),
      text: await this.text.inputValue(),
      chk1: await this.chk1.isChecked(),
      chk2: await this.chk2.isChecked(),
    };
  }

  async fillNum1(value) {
    // Use fill to avoid per-character input events; the app listens to 'input' and reacts once.
    await this.num1.fill(String(value));
  }

  async fillNum2(value) {
    await this.num2.fill(String(value));
  }

  async fillText(value) {
    await this.text.fill(String(value));
  }

  async toggleChk1() {
    await this.chk1.click();
  }

  async clickChk2() {
    await this.chk2.click();
  }

  async clickBtn1() {
    await this.btn1.click();
  }

  async clickBtn2() {
    await this.btn2.click();
  }

  async clickSubmit() {
    await this.submit.click();
  }

  async getTextValue() {
    return await this.text.inputValue();
  }
}

test.describe('Routing Demo - FSM tests (Application ID: 122d5e91-fa7b-11f0-814c-dbec508f0b3b)', () => {
  // Arrays to collect runtime issues observed during each test
  let pageErrors = [];
  let consoleErrors = [];
  let consoleHandler;
  let pageErrorHandler;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Collect console errors
    consoleHandler = (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : undefined,
        });
      }
    };
    page.on('console', consoleHandler);

    // Collect uncaught page errors
    pageErrorHandler = (err) => {
      // err is an Error object
      pageErrors.push({
        message: err.message,
        stack: err.stack,
        name: err.name,
      });
    };
    page.on('pageerror', pageErrorHandler);

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Remove listeners to avoid cross-test leakage
    page.removeListener('console', consoleHandler);
    page.removeListener('pageerror', pageErrorHandler);

    // Assert there were no unexpected page errors during the test run.
    // This validates that loading and interacting with the page did not produce runtime exceptions.
    expect(pageErrors, 'No uncaught page errors should have occurred').toEqual([]);
    expect(consoleErrors, 'No console.error messages should have been logged').toEqual([]);
  });

  test('Initial render: verifies all expected controls are present (S0_Idle entry)', async ({ page }) => {
    // This test validates the FSM initial state S0_Idle entry action renderPage() by checking presence of expected DOM elements.
    const controls = new ControlsPage(page);

    await expect(controls.submit).toBeVisible();
    await expect(controls.num1).toBeVisible();
    await expect(controls.num2).toBeVisible();
    await expect(controls.text).toBeVisible();
    await expect(controls.chk1).toBeVisible();
    await expect(controls.chk2).toBeVisible();
    await expect(controls.btn1).toBeVisible();
    await expect(controls.btn2).toBeVisible();

    const vals = await controls.getInitialValues();
    // Verify defaults from HTML: num1=10, num2=20, text empty, both unchecked
    expect(vals.num1).toBe('10');
    expect(vals.num2).toBe('20');
    expect(vals.text).toBe('');
    expect(vals.chk1).toBe(false);
    expect(vals.chk2).toBe(false);
  });

  test.describe('Input-driven transitions (Num1Input, Num2Input, TextInput)', () => {
    test('Num1 input updates text.value to reflect Number 1 (Num1Input transition)', async ({ page }) => {
      // This validates the num1 'input' listener that sets text.value = `Number 1: ${num1.value}`
      const controls = new ControlsPage(page);

      // Prepare to ensure no unexpected dialogs interrupt the flow; the listeners for num1/num2 do not create alerts.
      await controls.fillNum1('42');

      // Expect text.value to update to the expected template
      const textVal = await controls.getTextValue();
      expect(textVal).toBe('Number 1: 42');
    });

    test('Num2 input updates text.value to reflect Number 2 (Num2Input transition)', async ({ page }) => {
      // This validates the num2 'input' listener that sets text.value = `Number 2: ${num2.value}`
      const controls = new ControlsPage(page);

      await controls.fillNum2('99');

      const textVal = await controls.getTextValue();
      expect(textVal).toBe('Number 2: 99');
    });

    test('Text input triggers an alert with text value (TextInput transition)', async ({ page }) => {
      // This validates the text 'input' listener that calls alert(`Text: ${text.value}`)
      const controls = new ControlsPage(page);

      // Prepare to capture the alert dialog that should result from the input event.
      const dialogPromise = page.waitForEvent('dialog');

      // Use fill to avoid multiple per-character input alerts; the app will still emit a single 'input' event.
      await controls.fillText('Hello World');

      const dialog = await dialogPromise;
      try {
        expect(dialog.message()).toBe('Text: Hello World');
      } finally {
        await dialog.accept();
      }

      // Ensure the text input holds the expected value
      expect(await controls.getTextValue()).toBe('Hello World');
    });
  });

  test.describe('Checkbox and radio interactions (Chk1Change, Chk2Change)', () => {
    test('Check and uncheck chk1 triggers appropriate alerts for change events', async ({ page }) => {
      // This validates chk1 change handler which alerts different messages depending on checked state.
      const controls = new ControlsPage(page);

      // Click to check -> expect "Check 1 is checked"
      const dialogPromise1 = page.waitForEvent('dialog');
      await controls.toggleChk1();
      const dialog1 = await dialogPromise1;
      try {
        expect(dialog1.message()).toBe('Check 1 is checked');
      } finally {
        await dialog1.accept();
      }

      // Click to uncheck -> expect "Check 1 is not checked"
      const dialogPromise2 = page.waitForEvent('dialog');
      await controls.toggleChk1(); // toggle again to uncheck
      const dialog2 = await dialogPromise2;
      try {
        expect(dialog2.message()).toBe('Check 1 is not checked');
      } finally {
        await dialog2.accept();
      }

      // Final checkbox state should be unchecked
      expect(await controls.chk1.isChecked()).toBe(false);
    });

    test('Clicking radio chk2 triggers change alert (Chk2Change)', async ({ page }) => {
      // This validates chk2 radio change handler which alerts 'Check 2 is checked' when selected.
      const controls = new ControlsPage(page);

      // Click radio (select) -> expect alert
      const dialogPromise = page.waitForEvent('dialog');
      await controls.clickChk2();
      const dialog = await dialogPromise;
      try {
        expect(dialog.message()).toBe('Check 2 is checked');
      } finally {
        await dialog.accept();
      }

      // Radio should now be checked
      expect(await controls.chk2.isChecked()).toBe(true);
    });
  });

  test.describe('Button clicks and Submit aggregation (Btn1Click, Btn2Click, SubmitClick)', () => {
    test('Button 1 click triggers its alert (Btn1Click)', async ({ page }) => {
      // Validate btn1 click triggers alert "Button 1 clicked"
      const controls = new ControlsPage(page);
      const dialogPromise = page.waitForEvent('dialog');

      await controls.clickBtn1();

      const dialog = await dialogPromise;
      try {
        expect(dialog.message()).toBe('Button 1 clicked');
      } finally {
        await dialog.accept();
      }
    });

    test('Button 2 click triggers its alert (Btn2Click)', async ({ page }) => {
      // Validate btn2 click triggers alert "Button 2 clicked"
      const controls = new ControlsPage(page);
      const dialogPromise = page.waitForEvent('dialog');

      await controls.clickBtn2();

      const dialog = await dialogPromise;
      try {
        expect(dialog.message()).toBe('Button 2 clicked');
      } finally {
        await dialog.accept();
      }
    });

    test('Submit click aggregates values into an alert (SubmitClick transition)', async ({ page }) => {
      // This test sets a combination of values and verifies the submit alert reflects them
      const controls = new ControlsPage(page);

      // Set values:
      await controls.fillNum1('5');
      await controls.fillNum2('7');

      // Fill text (this will trigger a Text alert due to text 'input' listener).
      // Capture and accept that alert before proceeding.
      const textDialogPromise = page.waitForEvent('dialog');
      await controls.fillText('submit-me');
      const textDialog = await textDialogPromise;
      try {
        expect(textDialog.message()).toBe('Text: submit-me');
      } finally {
        await textDialog.accept();
      }

      // Check chk1
      const chk1DialogPromise = page.waitForEvent('dialog');
      await controls.toggleChk1(); // check it
      const chk1Dialog = await chk1DialogPromise;
      try {
        expect(chk1Dialog.message()).toBe('Check 1 is checked');
      } finally {
        await chk1Dialog.accept();
      }

      // Ensure chk2 radio is unchecked for this scenario. If it is checked, unselecting radio via script is not possible via UI;
      // since radios can't be unchecked by clicking again, ensure its state; default is unchecked per initial test.
      expect(await controls.chk2.isChecked()).toBe(false);

      // Now click Submit and validate aggregated alert
      const submitDialogPromise = page.waitForEvent('dialog');
      await controls.clickSubmit();
      const submitDialog = await submitDialogPromise;
      try {
        const expected = 'Number 1: 5, Number 2: 7, Text: submit-me, Check 1: true, Check 2: false';
        expect(submitDialog.message()).toBe(expected);
      } finally {
        await submitDialog.accept();
      }
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Entering extreme numeric values updates text.value correctly and does not throw errors', async ({ page }) => {
      // Edge case: very large, negative, decimal values
      const controls = new ControlsPage(page);

      await controls.fillNum1('-12345678901234567890'); // very large negative-ish string
      expect(await controls.getTextValue()).toBe('Number 1: -12345678901234567890');

      await controls.fillNum2('3.14159');
      expect(await controls.getTextValue()).toBe('Number 2: 3.14159');

      // No alerts expected from number inputs; ensure no page errors logged during these operations.
    });

    test('Clearing number inputs updates text.value to template with empty string', async ({ page }) => {
      // Edge case: emptying the number input should still update the text.value with empty string placeholder
      const controls = new ControlsPage(page);

      await controls.fillNum1(''); // clear
      expect(await controls.getTextValue()).toBe('Number 1: ');

      await controls.fillNum2(''); // clear
      expect(await controls.getTextValue()).toBe('Number 2: ');
    });

    test('Rapid toggling of chk1 produces consistent alerts and does not crash', async ({ page }) => {
      // Rapid interactions could reveal race conditions; toggle twice quickly and accept dialogs in order
      const controls = new ControlsPage(page);

      // First toggle -> checked
      const d1 = page.waitForEvent('dialog');
      await controls.toggleChk1();
      const dialog1 = await d1;
      try {
        expect(dialog1.message()).toBe('Check 1 is checked');
      } finally {
        await dialog1.accept();
      }

      // Second toggle -> unchecked
      const d2 = page.waitForEvent('dialog');
      await controls.toggleChk1();
      const dialog2 = await d2;
      try {
        expect(dialog2.message()).toBe('Check 1 is not checked');
      } finally {
        await dialog2.accept();
      }
    });

    test('Typing into text input using .type (character-by-character) triggers multiple alerts - all are observed and accepted', async ({ page }) => {
      // This checks an error scenario where many dialogs could appear; we accept them sequentially.
      const controls = new ControlsPage(page);

      // Use type() to generate multiple input events (one per char). We will accept multiple dialogs.
      const typedValue = 'AB';
      // Start typing and concurrently handle dialogs for each keystroke.
      // Because the number of dialogs equals number of input events, we loop and accept two dialogs.
      const dialogPromises = [];
      // Setup waits for as many dialogs as characters typed.
      for (let i = 0; i < typedValue.length; i++) {
        dialogPromises.push(page.waitForEvent('dialog'));
      }

      await controls.text.click();
      await page.keyboard.type(typedValue);

      // Accept all dialogs in order and verify their messages incrementally match the current text value at that time.
      for (let i = 0; i < dialogPromises.length; i++) {
        const dlg = await dialogPromises[i];
        // The app alerts the full current value; depending on timing, each alert message should be either 'Text: A' then 'Text: AB'
        expect(dlg.message().startsWith('Text:')).toBeTruthy();
        await dlg.accept();
      }

      // Final text value should equal typedValue
      expect(await controls.getTextValue()).toBe(typedValue);
    });
  });
});