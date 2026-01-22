import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0baa98f1-d5b2-11f0-b169-abe023d0d932.html';

class KnnPage {
  /**
   * Page object for the KNN demo page.
   * Encapsulates common actions and queries.
   */
  constructor(page) {
    this.page = page;
    this.url = BASE_URL;
  }

  async goto() {
    await this.page.goto(this.url);
  }

  async getFormHandle() {
    return this.page.$('#knn-form');
  }

  async fillInputs(values = { input1: '', input2: '', input3: '' }) {
    const { page } = this;
    await page.fill('#input1', String(values.input1));
    await page.fill('#input2', String(values.input2));
    await page.fill('#input3', String(values.input3));
  }

  async clickSubmit() {
    await this.page.click("button[type='submit']");
  }

  async getResultText() {
    return (await this.page.$eval('#result', el => el.innerText)).trim();
  }

  async formIsValid() {
    return this.page.$eval('#knn-form', form => form.checkValidity());
  }
}

test.describe('KNN FSM and UI - 0baa98f1-d5b2-11f0-b169-abe023d0d932', () => {
  // Arrays to collect runtime page errors and console messages for assertions
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture uncaught page errors (TypeError, ReferenceError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      // store Error object for assertions
      pageErrors.push(err);
    });

    // Capture console events for visibility (not expected on success but helpful)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test.describe('State S0_Idle (Initial Rendering)', () => {
    test('renders the KNN form with three required inputs and a submit button', async ({ page }) => {
      // Validate initial Idle state UI elements and attributes
      const knn = new KnnPage(page);
      await knn.goto();

      // Ensure the form exists
      const form = await knn.getFormHandle();
      expect(form).not.toBeNull();

      // Ensure required inputs are present and marked required
      const input1Required = await page.$eval('#input1', el => el.hasAttribute('required'));
      const input2Required = await page.$eval('#input2', el => el.hasAttribute('required'));
      const input3Required = await page.$eval('#input3', el => el.hasAttribute('required'));
      expect(input1Required).toBe(true);
      expect(input2Required).toBe(true);
      expect(input3Required).toBe(true);

      // Submit button present
      const btnText = await page.$eval("button[type='submit']", el => el.innerText);
      expect(btnText).toMatch(/Submit/i);

      // Result area initially empty
      const resultText = await knn.getResultText();
      expect(resultText).toBe('');
      // No runtime errors should have fired just by loading the page
      expect(pageErrors.length).toBe(0);
      // No console messages expected on load for this page
      // (but we do not fail the test if there are benign console logs)
    });
  });

  test.describe('Event: SubmitForm (transition S0_Idle -> S1_Submitted)', () => {
    test('submitting with empty required fields is blocked by HTML constraint validation', async ({ page }) => {
      // This validates the browser's built-in required attribute behavior.
      const knn = new KnnPage(page);
      await knn.goto();

      // Intentionally click submit without filling required inputs.
      await knn.clickSubmit();

      // The form should be invalid and the submit event should not have been dispatched to the handler.
      const validity = await knn.formIsValid();
      expect(validity).toBe(false);

      // Because submission should be blocked, no runtime page errors should have occurred.
      expect(pageErrors.length).toBe(0);
    });

    test('submitting with numeric inputs triggers submit handler and results in runtime errors from the page implementation', async ({ page }) => {
      // This test validates that the submit event fires, the JS handler runs,
      // and—due to defects in the implementation—runtime errors occur.
      const knn = new KnnPage(page);
      await knn.goto();

      // Fill inputs with numeric strings so the submit handler executes past basic loops.
      await knn.fillInputs({ input1: '1', input2: '2', input3: '3' });

      // Capture current URL to assert submit does not cause navigation (preventDefault expected)
      const beforeUrl = page.url();

      // Trigger the submit and wait for the pageerror event. We use race with a short timeout
      // so the test does not hang if no error occurs (but we expect an error to happen).
      let errorCaught = null;
      const waitForError = page.waitForEvent('pageerror', { timeout: 2000 }).then(err => err).catch(() => null);

      await knn.clickSubmit();

      errorCaught = await waitForError;

      // The page has a known bug: it tries to read an element with id 'knn-input' (missing),
      // which should cause a TypeError when accessing .value on null. We assert that at least
      // one runtime error occurred and that the error type/message is consistent with a missing element.
      if (errorCaught) {
        // page.waitForEvent returned an Error object
        expect(errorCaught).toBeTruthy();
        // The error type/name should be present and is expected to be 'TypeError' in modern browsers
        expect(errorCaught.name).toMatch(/TypeError|ReferenceError/);
      } else {
        // If no specific event was captured by waitForEvent, ensure our captured pageErrors array has entries
        expect(pageErrors.length).toBeGreaterThan(0);
      }

      // Confirm that the page did not navigate away (submit handler calls e.preventDefault())
      const afterUrl = page.url();
      expect(afterUrl).toBe(beforeUrl);

      // The implementation attempts to set a predicted label into #result only after multiple computations.
      // Because a runtime error is expected, we check that the result is not a valid "Predicted label" string.
      const resultText = await knn.getResultText();
      expect(resultText).not.toMatch(/^Predicted label:/);

      // Additionally assert that at least one page error in the collected array has a message indicative of missing element access
      const hasTypeOrRefError = pageErrors.some(err => {
        if (!err) return false;
        const name = err.name || '';
        const message = String(err.message || '').toLowerCase();
        return /typeerror|referenceerror/.test(name.toLowerCase()) ||
               message.includes('cannot read') ||
               message.includes('null') ||
               message.includes('is not defined');
      }) || (errorCaught !== null);
      expect(hasTypeOrRefError).toBe(true);
    });

    test('submitting with non-numeric inputs also triggers runtime error path in the page implementation', async ({ page }) => {
      // This test checks an edge case with non-numeric string inputs.
      // The underlying code performs numeric operations without robust validation,
      // which should produce NaN-based behavior or runtime errors when later code tries to read missing DOM elements.
      const knn = new KnnPage(page);
      await knn.goto();

      // Fill inputs with non-numeric strings.
      await knn.fillInputs({ input1: 'a', input2: 'b', input3: 'c' });

      // Wait for a pageerror; the code is expected to throw due to missing elements / invalid DOM access.
      const waitForError = page.waitForEvent('pageerror', { timeout: 2000 }).then(err => err).catch(() => null);

      await knn.clickSubmit();

      const errorCaught = await waitForError;

      // We expect an error to have occurred. If so, validate it's a runtime error (TypeError/ReferenceError).
      if (errorCaught) {
        expect(errorCaught.name).toMatch(/TypeError|ReferenceError/);
      } else {
        // fallback: rely on collected pageErrors
        expect(pageErrors.length).toBeGreaterThan(0);
      }

      // Verify the result area is not populated with a valid predicted label string.
      const resultText = await knn.getResultText();
      expect(resultText).not.toMatch(/^Predicted label:/);
    });
  });

  test.describe('Verify onEnter/onExit actions and FSM expectations', () => {
    test('entry action renderPage() is represented by presence of form elements (Idle onEnter)', async ({ page }) => {
      // FSM S0_Idle entry_action is renderPage() which should produce the form and controls.
      // Here we validate presence of the expected DOM elements as the manifestation of the entry action.
      const knn = new KnnPage(page);
      await knn.goto();

      expect(await page.$('#knn-form')).not.toBeNull();
      expect(await page.$('#input1')).not.toBeNull();
      expect(await page.$('#input2')).not.toBeNull();
      expect(await page.$('#input3')).not.toBeNull();
      expect(await page.$('#result')).not.toBeNull();
    });

    test('transition action calculatePredictedLabel() is attempted on submit (but implementation errors are allowed and asserted)', async ({ page }) => {
      // The FSM transition from Idle -> Submitted invokes calculatePredictedLabel().
      // The page's submit handler contains logic that corresponds to calculatePredictedLabel().
      // Rather than expecting a correct prediction (implementation is buggy), we assert that the submit handler executes
      // and that runtime errors produced by that attempted calculation are observable.
      const knn = new KnnPage(page);
      await knn.goto();

      await knn.fillInputs({ input1: '5', input2: '6', input3: '7' });

      // Race for pageerror
      const waitForError = page.waitForEvent('pageerror', { timeout: 2000 }).then(err => err).catch(() => null);

      await knn.clickSubmit();

      const error = await waitForError;

      // The transition should run and produce an error because the implementation references a missing element ('knn-input') etc.
      expect(error || pageErrors.length).toBeTruthy();
    });
  });

  test.afterEach(async ({ page }) => {
    // Helpful diagnostic output for local debugging if tests fail:
    if (pageErrors.length > 0) {
      // Do not throw here; test assertions handle expectations. This is only to make failures easier to inspect.
      // Convert to strings to avoid serialization issues in some reporters.
      for (const err of pageErrors) {
        // eslint-disable-next-line no-console
        console.log('Captured pageerror:', err && err.name, err && err.message);
      }
    }
    if (consoleMessages.length > 0) {
      for (const msg of consoleMessages) {
        // eslint-disable-next-line no-console
        console.log('Console:', msg.type, msg.text);
      }
    }
  });
});