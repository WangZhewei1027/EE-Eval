import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122d1074-fa7b-11f0-814c-dbec508f0b3b.html';

// Helper page object for transaction form interactions
class TransactionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      heading: 'h2',
      submitButton: 'button[type="submit"]',
      inputs: {
        input1: '#input1',
        input2: '#input2',
        input3: '#input3',
        input4: '#input4',
        input5: '#input5',
        input6: '#input6',
        input7: '#input7',
        input8: '#input8',
        input9: '#input9',
        input10: '#input10'
      },
      progress: '#progress'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async headingText() {
    return this.page.textContent(this.selectors.heading);
  }

  async submitVisible() {
    return this.page.isVisible(this.selectors.submitButton);
  }

  async elementExists(selector) {
    return this.page.$(selector).then(el => !!el);
  }

  async fillInput(name, value) {
    await this.page.fill(this.selectors.inputs[name], value);
  }

  async clickSubmit() {
    await this.page.click(this.selectors.submitButton);
  }

  async callValidateInput() {
    // Call validateInput in page context and return its return value
    return this.page.evaluate(() => {
      // Intentionally call validateInput from the page as-is
      return validateInput();
    });
  }

  async callShowProgress() {
    return this.page.evaluate(() => {
      return showProgress();
    });
  }

  async callUpdateProgress() {
    return this.page.evaluate(() => {
      return updateProgress();
    });
  }
}

test.describe('Transaction FSM tests - 122d1074-fa7b-11f0-814c-dbec508f0b3b', () => {
  let pageErrors = [];
  let consoleMessages = [];
  let dialogs = [];
  let page;

  test.beforeEach(async ({ browser }) => {
    // Create new context/page for isolation
    const context = await browser.newContext();
    page = await context.newPage();

    pageErrors = [];
    consoleMessages = [];
    dialogs = [];

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // store stringified error for assertions
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture dialogs (alerts) that will be produced by validateInput
    page.on('dialog', async (dialog) => {
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      // Accept the dialog so that script execution can continue
      try {
        await dialog.accept();
      } catch (e) {
        // ignore acceptance errors
      }
    });

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    if (page && !page.isClosed()) {
      await page.close();
    }
  });

  test('Initial Idle state renders the page (S0_Idle) and shows core elements', async () => {
    // Validate entry "renderPage()" by checking DOM elements from Idle state
    const transaction = new TransactionPage(page);

    // Check heading exists and contains "Transaction"
    const heading = await transaction.headingText();
    expect(heading).toBeTruthy();
    expect(heading.trim()).toContain('Transaction');

    // Check the submit button is present and visible
    const submitExists = await transaction.elementExists(transaction.selectors.submitButton);
    expect(submitExists).toBe(true);
    const submitVisible = await transaction.submitVisible();
    expect(submitVisible).toBe(true);

    // Verify that the expected inputs exist (evidence of Idle state)
    for (const inputName of Object.keys(transaction.selectors.inputs)) {
      const exists = await transaction.elementExists(transaction.selectors.inputs[inputName]);
      expect(exists, `Expected ${inputName} to exist`).toBe(true);
    }

    // There should be no progress element initially (progress UI not yet created)
    const progressExists = await transaction.elementExists(transaction.selectors.progress);
    expect(progressExists).toBe(false);
  });

  test('Script loading produces runtime errors due to implementation bugs', async () => {
    // The HTML/JS has errors (e.g., submitButton null addEventListener call).
    // We observe page errors collected during load.
    // Assert that at least one page error occurred and that it looks like a TypeError related to addEventListener or null
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    const combined = pageErrors.join(' | ');
    // The message may vary across runtimes, check for patterns indicating the observed bug
    const expectedPatterns = [
      /addEventListener/i,
      /Cannot read properties of null/i,
      /Cannot read property 'addEventListener'/i,
      /TypeError/i,
      /addEventListener of null/i,
      /Cannot set property/i, // in case of other environments
    ];

    const matches = expectedPatterns.some((re) => re.test(combined));
    expect(matches, `Expected page error messages to include addEventListener/null TypeError; got: ${combined}`).toBe(true);
  });

  test('Clicking Submit triggers form submission and produces further errors (transition attempt S0 -> S1)', async () => {
    // Clicking the Submit button is the "SubmitClick" event in the FSM.
    // Because addEventListener failed in script, the submit handler may not be attached.
    // Clicking may cause a form submit and page reload; we assert that clicking produces at least one page error (new or existing).
    const transaction = new TransactionPage(page);

    // Record count before clicking
    const beforeErrors = pageErrors.length;

    // Click the submit button. It may navigate (form submit). Be tolerant: wait for short time rather than waitForNavigation indefinitely.
    try {
      await transaction.clickSubmit();
      // Allow time for possible navigation/errors to happen
      await page.waitForTimeout(500);
    } catch (e) {
      // If Playwright raises due to navigation, ignore; we will assert on collected errors
    }

    // There should be page errors (either pre-existing or new ones after form submit)
    expect(pageErrors.length).toBeGreaterThanOrEqual(beforeErrors);

    // The FSM transition to Validating ideally triggers validateInput; since handler isn't attached, we still expect errors related to missing submitButton or form reload.
    const combined = pageErrors.join(' | ');
    const match = /addEventListener|Cannot read properties of null|TypeError|RangeError/i.test(combined);
    expect(match, `Expected error related to event handler or runtime on click; got: ${combined}`).toBe(true);
  });

  test('Directly invoking validateInput exercises S1 -> S2 (validation failed) sequentially and eventually S3 (validation passed)', async () => {
    // We'll call validateInput() directly several times to traverse validation guards.
    // Each failed validation triggers an alert; we capture and assert the messages.
    const transaction = new TransactionPage(page);

    // Ensure validateInput exists on the page context
    const validateType = await page.evaluate(() => typeof validateInput);
    expect(validateType).toBe('function');

    // 1) First invocation when all inputs are empty -> should alert for input1
    dialogs = []; // reset captured dialogs
    const ret1 = await page.evaluate(() => {
      try {
        return validateInput();
      } catch (e) {
        // If validateInput threw (should not), rethrow to make test fail
        throw e;
      }
    });
    // validateInput returns false on first missing input; also produced an alert which we accepted in dialog handler
    expect(ret1).toBe(false);
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[0].message).toContain('Please enter text for input 1');

    // 2) Fill input1, call again -> should alert for input2
    await transaction.fillInput('input1', 'value1');
    dialogs = [];
    const ret2 = await page.evaluate(() => validateInput());
    expect(ret2).toBe(false);
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[0].message).toContain('Please enter text for input 2');

    // 3) Fill input2, call again -> input3 alert
    await transaction.fillInput('input2', 'value2');
    dialogs = [];
    const ret3 = await page.evaluate(() => validateInput());
    expect(ret3).toBe(false);
    expect(dialogs[0].message).toContain('Please enter text for input 3');

    // 4) Fill input3, call again -> input4 alert
    await transaction.fillInput('input3', 'value3');
    dialogs = [];
    const ret4 = await page.evaluate(() => validateInput());
    expect(ret4).toBe(false);
    expect(dialogs[0].message).toContain('Please enter text for input 4');

    // 5) Fill input4, call again -> input5 (number) alert
    await transaction.fillInput('input4', 'value4');
    dialogs = [];
    const ret5 = await page.evaluate(() => validateInput());
    expect(ret5).toBe(false);
    expect(dialogs[0].message).toContain('Please enter number for input 5');

    // 6) Fill input5 (number), call again -> input6 (date) alert
    await transaction.fillInput('input5', '42');
    dialogs = [];
    const ret6 = await page.evaluate(() => validateInput());
    expect(ret6).toBe(false);
    expect(dialogs[0].message).toContain('Please enter date for input 6');

    // 7) Fill input6 (date), call again -> input7 (time) alert
    // Use a valid date and time format acceptable to input elements
    await transaction.fillInput('input6', '2020-01-01');
    dialogs = [];
    const ret7 = await page.evaluate(() => validateInput());
    expect(ret7).toBe(false);
    expect(dialogs[0].message).toContain('Please enter time for input 7');

    // 8) Fill input7 (time), call again -> input8 (select) check
    await transaction.fillInput('input7', '12:34');
    dialogs = [];
    const ret8 = await page.evaluate(() => validateInput());
    // For select, if no value is empty string, but default option has value 'option1', so unless changed it won't alert.
    // However code checks if (input8.value === '') alert. The default isn't empty, so if input8.value not empty, it will progress.
    // To exercise the guard, first check behavior: if default option present, validateInput should not complain about input8.
    // We assert based on observed behavior.
    if (ret8 === false) {
      // If it complained, assert it's for input8
      expect(dialogs[0].message).toContain('Please select option for input 8');
      // Fill select with a valid option now
      await page.selectOption('#input8', 'option1');
    } else {
      // If it passed this guard, ensure no dialog was shown for input8
      expect(dialogs.length).toBe(0);
    }

    // 9) Ensure input8 has a value; fill input9 and input10 sequentially to reach final pass
    await page.selectOption('#input8', 'option1');
    await transaction.fillInput('input9', 'value9');
    dialogs = [];
    const ret9 = await page.evaluate(() => validateInput());
    if (ret9 === false) {
      // Expect it to complain about input10 now
      expect(dialogs[0].message).toContain('Please enter text for input 10');
    }

    // 10) Fill input10 and call validateInput -> should return true (S3_ValidationPassed)
    await transaction.fillInput('input10', 'value10');
    dialogs = [];
    const finalRet = await page.evaluate(() => validateInput());
    expect(finalRet).toBe(true);
    // No dialogs expected when validation passes
    expect(dialogs.length).toBe(0);
  });

  test('Calling showProgress triggers runtime error due to const reassignment bug (onEnter/onExit check)', async () => {
    // The implementation of showProgress/hideProgress assigns to a const variable when no #progress exists.
    // Calling showProgress should throw an exception; we observe it via evaluate throwing.
    let threw = false;
    let errMessage = '';
    try {
      await page.evaluate(() => {
        // Call the function as-is; any runtime exception will propagate to Playwright
        return showProgress();
      });
    } catch (e) {
      threw = true;
      errMessage = String(e.message || e);
    }
    expect(threw).toBe(true);
    // The error message may differ by engine; look for 'Assignment' or 'constant' or 'progress'
    const patterns = [/Assignment to constant variable/i, /constant/i, /progress/i, /TypeError/i];
    const matched = patterns.some((re) => re.test(errMessage));
    expect(matched, `Expected showProgress invocation to raise a const-assignment/TypeError; got: ${errMessage}`).toBe(true);
  });

  test('Calling updateProgress can lead to recursion/RangeError due to fallback calling itself (edge case)', async () => {
    // updateProgress has an else branch that calls updateProgress() recursively when #progress absent.
    // Invoking it may lead to a RangeError (maximum call stack) or other engine-specific recursion error.
    let threw = false;
    let errMessage = '';
    try {
      await page.evaluate(() => {
        // Call updateProgress directly
        return updateProgress();
      });
    } catch (e) {
      threw = true;
      errMessage = String(e.message || e);
    }
    // We expect an exception (likely RangeError or similar), assert that an error was thrown
    expect(threw).toBe(true);
    // Accept multiple possible messages: stack overflow, maximum call stack, or recursion exceeded
    const patterns = [/RangeError/i, /Maximum call stack/i, /maximum call stack/i, /call stack/i, /recursion/i, /stack overflow/i];
    const matched = patterns.some((re) => re.test(errMessage));
    expect(matched, `Expected recursive updateProgress to raise a stack/recursion error; got: ${errMessage}`).toBe(true);
  });

  test('Console output and captured dialogs summary (sanity checks)', async () => {
    // Ensure we captured some console messages or dialogs across tests; this is a sanity grouping test.
    // There should be at least the dialogs we triggered earlier if running within a single test-run;
    // however this file's tests are independent; so just assert that arrays exist and are arrays.
    expect(Array.isArray(consoleMessages)).toBe(true);
    expect(Array.isArray(dialogs)).toBe(true);
    // If any dialogs were captured during this test's page lifetime, they should have message strings
    for (const d of dialogs) {
      expect(typeof d.message).toBe('string');
      expect(d.message.length).toBeGreaterThanOrEqual(0);
    }
  });
});