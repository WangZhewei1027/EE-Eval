import { test, expect } from '@playwright/test';

// Page object for the Interpreter page
class InterpreterPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-balanced/html/ca7d1cc1-fa75-11f0-9854-e7309e7cf385.html';
    this.selectors = {
      inputNumber: '#number',
      submitButton: 'button[type="submit"]',
      form: 'form',
      result: '#result',
      heading: 'h1'
    };
    // containers for console and page errors observed
    this.consoleMessages = [];
    this.pageErrors = [];
    // bind listeners when constructed
    this._onConsole = (msg) => {
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    };
    this._onPageError = (err) => {
      this.pageErrors.push(err);
    };
  }

  // Navigate to the page and attach listeners
  async goto() {
    this.page.on('console', this._onConsole);
    this.page.on('pageerror', this._onPageError);
    await this.page.goto(this.url, { waitUntil: 'load' });
  }

  // Detach listeners (cleanup)
  async teardown() {
    this.page.removeListener('console', this._onConsole);
    this.page.removeListener('pageerror', this._onPageError);
  }

  async getResultText() {
    await this.page.waitForSelector(this.selectors.result);
    return (await this.page.$eval(this.selectors.result, el => el.innerText)).trim();
  }

  async getInputValue() {
    const el = await this.page.$(this.selectors.inputNumber);
    if (!el) return null;
    return await this.page.$eval(this.selectors.inputNumber, el => el.value);
  }

  async fillNumber(value) {
    await this.page.fill(this.selectors.inputNumber, String(value));
  }

  // Submit the form by clicking the button and wait for possible navigation
  async submitForm() {
    // Start waiting for navigation, but tolerate no navigation by catching the timeout
    const waitNav = this.page.waitForNavigation({ waitUntil: 'load', timeout: 2000 }).catch(() => null);
    await Promise.all([this.page.click(this.selectors.submitButton), waitNav]);
  }

  async isInputPresent() {
    return (await this.page.$(this.selectors.inputNumber)) !== null;
  }

  async isButtonPresent() {
    return (await this.page.$(this.selectors.submitButton)) !== null;
  }

  getConsoleMessages() {
    return this.consoleMessages;
  }

  getPageErrors() {
    return this.pageErrors;
  }
}

// Group tests for the Interpreter FSM and behaviors
test.describe('Interpreter FSM - ca7d1cc1-fa75-11f0-9854-e7309e7cf385', () => {
  // Per-test instance
  test.beforeEach(async ({ page }) => {
    // noop - individual tests will create their InterpreterPage and navigate
  });

  test.afterEach(async ({ page }) => {
    // Ensure listeners removed if any tests left them attached by calling teardown on a fresh object
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('Initial Idle state renders correctly and entry action executed (renderPage)', async ({ page }) => {
    // This test validates the S0_Idle state:
    // - Elements (input, button, result) exist as evidence
    // - The page script runs on load and updates #result (renderPage effect)
    const app = new InterpreterPage(page);
    await app.goto();

    // Verify presence of UI elements
    expect(await app.isInputPresent()).toBeTruthy(); // <input id="number">
    expect(await app.isButtonPresent()).toBeTruthy(); // <button type="submit">
    const heading = await page.textContent('h1');
    expect(heading).toContain('Interpreter');

    // Verify initial input value (expected empty string)
    const initialValue = await app.getInputValue();
    expect(initialValue).toBe(''); // input should start empty

    // The implementation sets the result on page load to:
    // "The square of " + number + " is " + Math.sqrt(number);
    // with number === '' initially, Math.sqrt('') === 0, so expect that string
    const resultText = await app.getResultText();
    expect(resultText).toBe('The square of  is 0');

    // Observe console messages and page errors produced during load
    const consoleMessages = app.getConsoleMessages();
    const pageErrors = app.getPageErrors();

    // There should be no uncaught page errors on initial load for this implementation.
    expect(pageErrors.length).toBe(0);

    // Record that console messages were observed (may be zero); just assert it's an array.
    expect(Array.isArray(consoleMessages)).toBeTruthy();

    // Cleanup listeners
    await app.teardown();
  });

  test('Submitting form triggers transition to Calculated state - behavior observed', async ({ page }) => {
    // This test validates transition S0_Idle -> S1_Calculated via SubmitForm:
    // - Fill a value, submit the form, and observe the result text changed/updated by page script
    // Note: Implementation does not attach a submit handler; it computes result on load.
    const app = new InterpreterPage(page);
    await app.goto();

    // Fill with a known numeric input
    const inputValue = '9';
    await app.fillNumber(inputValue);

    // Ensure the form had the intended value before submit
    const beforeSubmit = await app.getInputValue();
    expect(beforeSubmit).toBe(inputValue);

    // Submit the form (this may or may not navigate). We will handle both cases.
    await app.submitForm();

    // After submission the page script runs on page load; depending on browser behavior the input
    // value might be preserved or reset. We assert the observed behavior is consistent with the
    // implementation's formula: "The square of <number> is <Math.sqrt(number)>"
    const resultAfter = await app.getResultText();

    // The result should match the pattern "The square of <something> is <something>"
    const pattern = /^The square of (.*) is (.*)$/;
    const match = resultAfter.match(pattern);
    expect(match).not.toBeNull();

    const displayedNumber = match[1]; // could be '' if input reset
    const displayedValue = match[2];

    // If the displayedNumber equals the original input, we expect displayedValue === Math.sqrt(original)
    if (displayedNumber === inputValue) {
      const expected = String(Math.sqrt(Number(inputValue)));
      expect(displayedValue).toBe(expected);
    } else {
      // Otherwise, the page likely reset the input and computed using empty string => Math.sqrt('') === 0
      expect(displayedValue).toBe('0');
    }

    // Confirm that the transition produced an observable change in the DOM (result contains expected phrase)
    expect(resultAfter.startsWith('The square of ')).toBeTruthy();

    // There should still be no uncaught page errors
    expect(app.getPageErrors().length).toBe(0);

    await app.teardown();
  });

  test('Edge case: negative number input results in NaN (Math.sqrt of negative)', async ({ page }) => {
    // This test validates how the implementation handles negative numbers: Math.sqrt(-4) -> NaN
    const app = new InterpreterPage(page);
    await app.goto();

    await app.fillNumber('-4');
    const before = await app.getInputValue();
    expect(before).toBe('-4');

    await app.submitForm();

    const result = await app.getResultText();
    expect(result).toMatch(/^The square of .* is .*$/);

    // Extract the numeric result part
    const value = result.replace(/^The square of .* is /, '').trim();

    // Math.sqrt(-4) yields NaN, and the implementation will stringify that to 'NaN'
    expect(value).toBe('NaN');

    // Assert no page errors occurred
    expect(app.getPageErrors().length).toBe(0);

    await app.teardown();
  });

  test('Edge case: non-numeric input leads to NaN in result', async ({ page }) => {
    // Try to input a non-numeric string. Input type="number" normally prevents typing text in UI,
    // but programmatic filling may set the value attribute and the script will read it.
    const app = new InterpreterPage(page);
    await app.goto();

    // Programmatically set a non-numeric value
    await app.fillNumber('abc');
    const before = await app.getInputValue();
    // Some browsers may coerce/ignore non-numeric strings; ensure the value retrieved is the string we set,
    // or possibly empty; both outcomes are acceptable but the result should be consistent with Math.sqrt applied.
    expect(typeof before).toBe('string');

    await app.submitForm();

    const result = await app.getResultText();
    expect(result).toMatch(/^The square of .* is .*$/);

    const displayedValue = result.replace(/^The square of .* is /, '').trim();

    // If the field was preserved as 'abc', Math.sqrt('abc') -> NaN; otherwise if emptied, -> 0
    if (before === 'abc') {
      expect(displayedValue).toBe('NaN');
    } else {
      // If browser cleared the invalid value, the result will be 0 as Math.sqrt('') === 0
      expect(displayedValue).toBe('0');
    }

    expect(app.getPageErrors().length).toBe(0);

    await app.teardown();
  });

  test('Verify onEnter/onExit actions inferred by FSM: initial render and post-submit calculation observed', async ({ page }) => {
    // This test ties FSM states to observable DOM effects:
    // - Entry action of S0 (renderPage) was executed at load (result already present)
    // - Transition action to S1 (calculateSquare) should be observable after submit (result updated)
    const app = new InterpreterPage(page);
    await app.goto();

    // Validate S0 onEnter effect
    const initialResult = await app.getResultText();
    expect(initialResult).toBe('The square of  is 0');

    // Now perform transition by submitting with a value
    await app.fillNumber('16');
    const before = await app.getInputValue();
    expect(before).toBe('16');

    await app.submitForm();

    // After submit, the page's script runs again; if input preserved, Math.sqrt(16) === 4
    const after = await app.getResultText();
    expect(after.startsWith('The square of ')).toBeTruthy();

    // Accept either preserved behavior (value 4) or reset behavior (0)
    const maybeMatch = after.match(/^The square of (.*) is (.*)$/);
    expect(maybeMatch).not.toBeNull();
    const displayedNum = maybeMatch[1];
    const displayedVal = maybeMatch[2];

    if (displayedNum === '16') {
      expect(displayedVal).toBe('4');
    } else {
      expect(displayedVal).toBe('0');
    }

    // No uncaught exceptions should have occurred during these transitions
    expect(app.getPageErrors().length).toBe(0);

    await app.teardown();
  });

  test('Observes console messages and ensures no runtime ReferenceError/SyntaxError/TypeError on load', async ({ page }) => {
    // This test explicitly observes console and pageerror events during load and basic interaction.
    // According to instructions we should NOT inject or force errors; we only observe what naturally occurs.
    const app = new InterpreterPage(page);
    await app.goto();

    // There should be zero uncaught page errors (the inline script is simple and shouldn't throw)
    const pageErrors = app.getPageErrors();
    expect(pageErrors.length).toBe(0);

    // Console messages may or may not exist; ensure we captured them as an array
    const consoleMsgs = app.getConsoleMessages();
    expect(Array.isArray(consoleMsgs)).toBeTruthy();

    // Interact briefly to ensure no later runtime errors occur
    await app.fillNumber('2');
    await app.submitForm();

    // Still expect no uncaught page errors after interaction
    expect(app.getPageErrors().length).toBe(0);

    await app.teardown();
  });
});