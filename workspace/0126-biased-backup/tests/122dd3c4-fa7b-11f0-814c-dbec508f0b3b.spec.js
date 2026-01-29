import { test, expect } from '@playwright/test';

// Test file: 122dd3c4-fa7b-11f0-814c-dbec508f0b3b.spec.js
// URL: http://127.0.0.1:5500/workspace/0126-biased/html/122dd3c4-fa7b-11f0-814c-dbec508f0b3b.html

// Page object to encapsulate interactions and selectors for the Dynamic Typing app
class DynamicTypingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.inputSelector = 'input[type="text"]';
    this.inputSubmitSelector = '.input-field button';
    this.containerButtonsSelector = '.button-container button';
    this.firstContainerButtonSelector = '.button-container button:first-of-type';
  }

  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/0126-biased/html/122dd3c4-fa7b-11f0-814c-dbec508f0b3b.html', { waitUntil: 'load' });
  }

  async getInputValue() {
    return await this.page.$eval(this.inputSelector, el => el.value);
  }

  async setInputValueUsingType(value) {
    // Clear then type char-by-char to trigger input events reliably.
    await this.page.focus(this.inputSelector);
    // Select existing content and clear
    await this.page.fill(this.inputSelector, '');
    for (const ch of value) {
      await this.page.type(this.inputSelector, ch);
      // Slight pause to simulate realistic typing and ensure input handlers run
      await this.page.waitForTimeout(30);
    }
  }

  async fillInputDirect(value) {
    // Use fill (may dispatch input once)
    await this.page.fill(this.inputSelector, value);
  }

  async clickFirstContainerButton() {
    await this.page.click(this.firstContainerButtonSelector);
  }

  async getFirstContainerButtonText() {
    return await this.page.$eval(this.firstContainerButtonSelector, el => el.textContent);
  }

  async getContainerButtonsCount() {
    return await this.page.$$eval(this.containerButtonsSelector, els => els.length);
  }

  async getOtherContainerButtonsTexts() {
    return await this.page.$$eval(this.containerButtonsSelector, els => els.map(e => e.textContent));
  }

  async getSubmitButtonExists() {
    return await this.page.$(this.inputSubmitSelector) !== null;
  }

  async getGlobalButtonCount() {
    // Access the page's global variable `buttonCount`
    return await this.page.evaluate(() => {
      // If buttonCount not defined, return null for the test to assert existence
      return typeof window.buttonCount !== 'undefined' ? window.buttonCount : null;
    });
  }
}

// Helper to calculate expected transformed value after clicking the first container button.
// This mirrors the sequence of click event listeners in the HTML implementation.
function computeExpectedAfterClick(initial) {
  // We'll mutate `value` in the same sequence of event listeners.
  let value = initial;

  // Helper for safe charAt and slices when string empty
  const capitalizeFirst = (s) => {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  // 1) value = value.toUpperCase();
  value = value.toUpperCase();

  // 2) value = value.toLowerCase();
  value = value.toLowerCase();

  // 3) value = value.charAt(0).toUpperCase() + value.slice(1);
  value = capitalizeFirst(value);

  // 4) value = value + 'Hello';
  value = value + 'Hello';

  // 5) value = value + ' World';
  value = value + ' World';

  // 6) value = value + ' ' + value;
  value = value + ' ' + value;

  // The remaining steps append variants derived from the current value at each step.
  // For each step, compute using the current `value` similarly to the page script.

  // 7) + ' ' + value.charAt(0).toUpperCase() + value.slice(1);
  value = value + ' ' + capitalizeFirst(value);

  // 8) + ' ' + value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  const step8Derived = (v) => {
    if (!v) return '';
    return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
  };
  value = value + ' ' + step8Derived(value);

  // 9) + ' ' + value.charAt(0).toUpperCase() + value.slice(1).toUpperCase();
  const step9Derived = (v) => {
    if (!v) return '';
    return v.charAt(0).toUpperCase() + v.slice(1).toUpperCase();
  };
  value = value + ' ' + step9Derived(value);

  // 10) + ' ' + value.charAt(0).toUpperCase() + value.slice(1).toLowerCase().toUpperCase();
  const step10Derived = (v) => {
    if (!v) return '';
    return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase().toUpperCase();
  };
  value = value + ' ' + step10Derived(value);

  // 11) + ' ' + value.charAt(0).toUpperCase() + value.slice(1).toUpperCase().toLowerCase();
  const step11Derived = (v) => {
    if (!v) return '';
    return v.charAt(0).toUpperCase() + v.slice(1).toUpperCase().toLowerCase();
  };
  value = value + ' ' + step11Derived(value);

  // 12) + ' ' + value.charAt(0).toUpperCase() + value.slice(1).toLowerCase().toLowerCase();
  const step12Derived = (v) => {
    if (!v) return '';
    return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase().toLowerCase();
  };
  value = value + ' ' + step12Derived(value);

  // 13) + ' ' + value.charAt(0).toUpperCase() + value.slice(1).toLowerCase().toLowerCase().toUpperCase();
  const step13Derived = (v) => {
    if (!v) return '';
    return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase().toLowerCase().toUpperCase();
  };
  value = value + ' ' + step13Derived(value);

  return value;
}

test.describe('Dynamic Typing - FSM: Idle and TextModified states', () => {
  // The listeners arrays are created per test to capture console and page errors.
  test('Idle state renders correctly (S0_Idle) - structure and globals', async ({ page }) => {
    // Set up collectors for console and page errors to observe runtime behavior.
    const consoleMessages = [];
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      // err is an Error object from the page
      pageErrors.push({ name: err.name, message: err.message });
    });

    const app = new DynamicTypingPage(page);
    await app.goto();

    // Validate presence of input field and submit button as part of Idle state's evidence.
    const placeholder = await page.$eval(app.inputSelector, el => el.getAttribute('placeholder'));
    expect(placeholder).toBe('Enter your name');

    const submitExists = await app.getSubmitButtonExists();
    expect(submitExists).toBe(true);

    // Validate number of buttons in the container matches FSM's detected count (20)
    const btnCount = await app.getContainerButtonsCount();
    expect(btnCount).toBe(20);

    // Validate initial global buttonCount variable exists and is 0 per HTML script
    const globalButtonCount = await app.getGlobalButtonCount();
    expect(globalButtonCount).toBe(0);

    // Validate the first container button's text is not undefined (initially likely "Button 1")
    const firstBtnText = await app.getFirstContainerButtonText();
    expect(typeof firstBtnText).toBe('string');
    expect(firstBtnText.length).toBeGreaterThan(0);

    // Ensure no uncaught pageerrors or console error messages occurred during page load.
    // The application should load without throwing runtime exceptions.
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);

    // Keep some of the console log info for debugging if needed (not asserting on generic logs)
    // This test validates the Idle state's renderPage() effect implicitly by presence of DOM.
  });

  test('InputChange event triggers buttonCount increment and updates first button text (transition S0 -> S1)', async ({ page }) => {
    // This test validates the InputChange event handler:
    // inputFieldInput.addEventListener('input', function() { buttonCount++; document.querySelector('.button-container button').textContent = buttonCount; });
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => { pageErrors.push({ name: err.name, message: err.message }); });

    const app = new DynamicTypingPage(page);
    await app.goto();

    // Type char-by-char to trigger multiple 'input' events and increment buttonCount each keystroke.
    const inputString = 'abc';
    await app.setInputValueUsingType(inputString);

    // After typing 3 characters, global buttonCount should be 3 and first button's textContent should be '3'
    const globalButtonCount = await app.getGlobalButtonCount();
    expect(globalButtonCount).toBe(inputString.length);

    const firstBtnText = await app.getFirstContainerButtonText();
    // first button's text content is set to the numeric count in the page script
    expect(firstBtnText).toBe(String(inputString.length));

    // Ensure other buttons remain unchanged (they should still display their original labels like 'Button 2', etc.)
    const allTexts = await app.getOtherContainerButtonsTexts();
    // The first element should be the count (stringified), the rest should contain "Button"
    expect(allTexts.length).toBeGreaterThanOrEqual(20);
    for (let i = 1; i < allTexts.length; i++) {
      expect(allTexts[i]).toMatch(/Button \d+/);
    }

    // Validate input value is exactly what we typed
    const inputVal = await app.getInputValue();
    expect(inputVal).toBe(inputString);

    // Assert there were no runtime errors triggered by input events
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('ButtonClick event applies sequential transformations (non-empty input) - S1 -> S1 self-transition', async ({ page }) => {
    // This test validates that clicking the first container button runs all click handlers in sequence
    // and results in a deterministic transformed input value matching the JS logic.
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => { pageErrors.push({ name: err.name, message: err.message }); });

    const app = new DynamicTypingPage(page);
    await app.goto();

    const initial = 'play';
    // Ensure input has this value by typing (to trigger input increment as well)
    await app.setInputValueUsingType(initial);

    // Now click the first container button which has multiple click listeners attached in sequence.
    await app.clickFirstContainerButton();

    // Read out the resulting value
    const finalValue = await app.getInputValue();

    // Compute expected value using the same sequence of operations present in the page's script
    const expected = computeExpectedAfterClick(initial);

    // Validate the final input value matches expected transformed value
    expect(finalValue).toBe(expected);

    // Clicking should not have produced uncaught errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('ButtonClick event transforms empty input (edge case) and repeated clicks accumulate changes', async ({ page }) => {
    // Edge case: input is empty string: ensure no runtime errors (like calling methods on undefined) occur,
    // and transformations happen deterministically (they should append strings like 'Hello', ' World', etc.)
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => { pageErrors.push({ name: err.name, message: err.message }); });

    const app = new DynamicTypingPage(page);
    await app.goto();

    // Ensure input is empty
    await app.fillInputDirect('');
    const before = await app.getInputValue();
    expect(before).toBe('');

    // Click once
    await app.clickFirstContainerButton();
    const afterOne = await app.getInputValue();
    const expectedOne = computeExpectedAfterClick('');

    expect(afterOne).toBe(expectedOne);

    // Click again: handlers will run again on the new value and further mutate it
    await app.clickFirstContainerButton();
    const afterTwo = await app.getInputValue();
    // The expected after two clicks is computeExpectedAfterClick(expectedOne)
    const expectedTwo = computeExpectedAfterClick(expectedOne);
    expect(afterTwo).toBe(expectedTwo);

    // Ensure no uncaught errors occurred for this edge-case sequence
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Submit button exists and does not throw when clicked (structural check & error scenario)', async ({ page }) => {
    // This test clicks the Submit button inside the input-field area to ensure it exists and triggers no errors.
    // The HTML does not attach any handlers to this Submit button, but clicking it should be safe.
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => { pageErrors.push({ name: err.name, message: err.message }); });

    const app = new DynamicTypingPage(page);
    await app.goto();

    const submitButton = await page.$(app.inputSubmitSelector);
    expect(submitButton).not.toBeNull();

    // Click the submit button and ensure it does not generate page errors
    await submitButton.click();

    // There are no action handlers for this button in the HTML; verify still no exceptions were thrown
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Sanity check: no unexpected ReferenceError/SyntaxError/TypeError occurred during interactions', async ({ page }) => {
    // This test specifically gathers emitted page errors across a few interactions and asserts that
    // none of them are ReferenceError, SyntaxError, or TypeError. It is an extra guard to ensure
    // the runtime environment remains stable under typical interactions.
    const collectedPageErrors = [];
    page.on('pageerror', err => {
      collectedPageErrors.push({ name: err.name, message: err.message });
    });

    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const app = new DynamicTypingPage(page);
    await app.goto();

    // Perform a series of interactions that exercise input and button handlers
    await app.setInputValueUsingType('Edge');
    await app.clickFirstContainerButton();
    await app.fillInputDirect('');
    await app.clickFirstContainerButton();

    // Now assert that none of the page errors (if any) are ReferenceError/SyntaxError/TypeError.
    // Preferably there are no errors at all.
    const offending = collectedPageErrors.filter(e => ['ReferenceError', 'SyntaxError', 'TypeError'].includes(e.name));
    expect(offending).toEqual([]);

    // Also ensure no console error messages were emitted
    expect(consoleErrors).toEqual([]);
  });
});