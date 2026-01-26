import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122dacb3-fa7b-11f0-814c-dbec508f0b3b.html';

// Page object to encapsulate interactions with the Refactoring Demo page
class RefactorPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.name = page.locator('#name');
    this.password = page.locator('#password');
    this.birthdate = page.locator('#birthdate');
    this.message = page.locator('#message');
    this.saveBtn = page.locator('#save-btn');
    this.submitBtn = page.locator('#submit-btn');
    this.clearBtn = page.locator('#clear-btn');
    this.form = page.locator('#refactoring-form');
    this.errorDiv = page.locator('#error');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillForm(values) {
    const { name = '', password = '', birthdate = '', message = '' } = values;
    await this.name.fill(name);
    await this.password.fill(password);
    // date input: ensure value is a ISO date (YYYY-MM-DD) if provided
    if (birthdate) {
      await this.birthdate.fill(birthdate);
    } else {
      // clear
      await this.birthdate.fill('');
    }
    await this.message.fill(message);
  }

  async clickSave() {
    await this.saveBtn.click();
  }

  async clickSubmit() {
    await this.submitBtn.click();
  }

  async clickClear() {
    await this.clearBtn.click();
  }

  async getErrorText() {
    return (await this.errorDiv.textContent())?.trim() ?? '';
  }

  async getFieldValues() {
    return {
      name: await this.name.inputValue(),
      password: await this.password.inputValue(),
      birthdate: await this.birthdate.inputValue(),
      message: await this.message.inputValue()
    };
  }
}

// Helper that waits for a console message containing some substring
function waitForConsoleSubstring(messagesArray, substring, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const found = messagesArray.find(m => m.text.includes(substring));
      if (found) return resolve(found);
      if (Date.now() - start > timeout) return reject(new Error(`Timeout waiting for console message containing "${substring}"`));
      setTimeout(check, 50);
    };
    check();
  });
}

test.describe('Refactoring Demo (FSM) - 122dacb3-fa7b-11f0-814c-dbec508f0b3b', () => {
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for each test so we can assert on them
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // capture runtime errors (ReferenceError, TypeError, SyntaxError, etc.)
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      // record console messages for assertions
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
  });

  test.afterEach(async () => {
    // Ensure no unexpected page errors occurred during the test execution.
    // The application is expected to run without runtime exceptions.
    expect(pageErrors, `Expected no runtime page errors, but found: ${pageErrors.map(e => e.message).join('; ')}`).toHaveLength(0);
  });

  test('Idle state: initial render shows all expected elements', async ({ page }) => {
    // Validate initial "S0_Idle" state: page renders inputs and buttons
    // and initial error area is empty.
    const app = new RefactorPage(page);
    await app.goto();

    // Check presence and labels of major buttons and inputs
    await expect(app.saveBtn).toBeVisible();
    await expect(app.saveBtn).toHaveText('Save');

    await expect(app.submitBtn).toBeVisible();
    await expect(app.submitBtn).toHaveText('Refactor');

    await expect(app.clearBtn).toBeVisible();
    await expect(app.clearBtn).toHaveText('Clear');

    await expect(app.name).toBeVisible();
    await expect(app.password).toBeVisible();
    await expect(app.birthdate).toBeVisible();
    await expect(app.message).toBeVisible();

    // Ensure the error paragraph is initially empty
    const errorText = await app.getErrorText();
    expect(errorText).toBe('', 'Initial error paragraph should be empty in Idle state');

    // No console outputs expected on initial render for this implementation
    const foundInitialConsole = consoleMessages.some(m => m.text && m.text.length > 0);
    expect(foundInitialConsole).toBe(false);

    // pageErrors verified in afterEach
  });

  test('Save transition (S0 -> S1): successful save when all fields filled', async ({ page }) => {
    // Validate that clicking Save with all fields populated triggers the "Refactoring saved successfully!" console log
    // and clears any error messages.
    const app = new RefactorPage(page);
    await app.goto();

    // Fill the form completely
    await app.fillForm({
      name: 'Alice',
      password: 's3cr3t',
      birthdate: '1990-01-01',
      message: 'Refactor details'
    });

    // Click Save and wait for the expected console message
    await app.clickSave();

    // Wait for the expected console message to appear on the captured consoleMessages
    const savedMsg = await waitForConsoleSubstring(consoleMessages, 'Refactoring saved successfully!', 2000);
    expect(savedMsg.text).toContain('Refactoring saved successfully!');

    // Ensure error area is cleared after successful save
    const errorText = await app.getErrorText();
    expect(errorText).toBe('', 'Error paragraph should be cleared after successful save');

    // Ensure form values remain unchanged after save (save does not reset form)
    const values = await app.getFieldValues();
    expect(values).toEqual({
      name: 'Alice',
      password: 's3cr3t',
      birthdate: '1990-01-01',
      message: 'Refactor details'
    });
  });

  test('Save transition (S0 -> S1) edge case: missing fields shows validation error', async ({ page }) => {
    // Validate that clicking Save with missing fields sets an error message and does NOT log success.
    const app = new RefactorPage(page);
    await app.goto();

    // Fill only some fields, leave others blank
    await app.fillForm({
      name: 'Bob',
      password: '',
      birthdate: '',
      message: 'Partial message'
    });

    // Click Save
    await app.clickSave();

    // Expect the error paragraph to show the expected validation message
    const errorText = await app.getErrorText();
    expect(errorText).toBe('Please fill in all fields.');

    // Ensure that 'Refactoring saved successfully!' was NOT logged
    const savedLogExists = consoleMessages.some(m => m.text.includes('Refactoring saved successfully!'));
    expect(savedLogExists).toBe(false);
  });

  test('Submit transition (S0 -> S2): clicking Refactor logs the submitted object', async ({ page }) => {
    // Validate submitRefactoring behavior: logs "Refactoring submitted:" with object,
    // clears error area, and does not produce a validation error.
    const app = new RefactorPage(page);
    await app.goto();

    // Fill the form with known values
    const payload = {
      name: 'Charlie',
      password: 'p@ss',
      birthdate: '1985-12-24',
      message: 'Please refactor this'
    };
    await app.fillForm(payload);

    // Click the Refactor button. Note: because the button is inside a form and has no type specified,
    // browsers treat it as a submit button (type="submit") by default. The page has a click handler
    // that logs the object on click. We listen for the console log; we also allow for a page reload
    // but the console log usually happens prior to any possible navigation.
    await app.clickSubmit();

    // Wait for the expected console message. If a navigation happens quickly, the console log may still be present.
    const submittedMsg = await waitForConsoleSubstring(consoleMessages, 'Refactoring submitted:', 2000);
    expect(submittedMsg.text).toContain('Refactoring submitted:');

    // The console text should include at least the name we submitted (stringified object snippet)
    expect(submittedMsg.text).toContain(payload.name);

    // After submit, the error area should be cleared according to the implementation
    const errorText = await app.getErrorText();
    expect(errorText).toBe('', 'Error paragraph should be cleared after submit');

    // The FSM expected observable is the console.log; we've asserted it occurred.
  });

  test('Submit transition edge case: submit with empty fields still logs submitted object with empty values', async ({ page }) => {
    // Ensure that submitting an empty form logs the submitted object (with empty strings) and clears errors.
    const app = new RefactorPage(page);
    await app.goto();

    // Ensure form is cleared
    await app.fillForm({ name: '', password: '', birthdate: '', message: '' });

    await app.clickSubmit();

    // Expect a console log for submit as implementation always logs submitted object
    const submittedMsg = await waitForConsoleSubstring(consoleMessages, 'Refactoring submitted:', 2000);
    expect(submittedMsg.text).toContain('Refactoring submitted:');

    // The logged object representation should include empty strings (or be representationally empty),
    // but at minimum it should include the 'Refactoring submitted:' prefix.
    const errorText = await app.getErrorText();
    expect(errorText).toBe('', 'Error paragraph should be cleared after submit even if fields are empty');
  });

  test('Clear transition (S0 -> S3): clicking Clear resets the form', async ({ page }) => {
    // Validate that the clearRefactoring action resets the form values and clears errors.
    const app = new RefactorPage(page);
    await app.goto();

    // Fill form with values
    await app.fillForm({
      name: 'Diana',
      password: 'pw',
      birthdate: '2000-06-15',
      message: 'To be cleared'
    });

    // Put an artificial error text to ensure clear also clears it
    await page.evaluate(() => {
      const e = document.getElementById('error');
      if (e) e.textContent = 'Some error';
    });

    // Click Clear
    await app.clickClear();

    // After clearing, all form inputs should be empty strings
    const values = await app.getFieldValues();
    expect(values).toEqual({
      name: '',
      password: '',
      birthdate: '',
      message: ''
    });

    // Error area should be cleared
    const errorText = await app.getErrorText();
    expect(errorText).toBe('', 'Error paragraph should be cleared after clicking Clear');

    // No console output is expected for clear (implementation only resets form and clears error)
    const clearConsole = consoleMessages.some(m => m.text.includes('Refactoring saved successfully!') || m.text.includes('Refactoring submitted:'));
    // It's okay if other console messages exist, but none related to save/submit should have been produced by clear
    expect(clearConsole).toBe(false);
  });
});