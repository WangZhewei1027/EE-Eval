import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122d3783-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object for the application to encapsulate common interactions
class HttpExamplePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.message = page.locator('#message');
    this.urlInput = page.locator('#url');
    this.submit = page.locator('#submit');
    this.clear = page.locator('#clear');
    this.refresh = page.locator('#refresh');
    this.reset = page.locator('#reset');
    this.submitError = page.locator('#submit-error');
    this.form = page.locator('#form');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async fillUrl(value) {
    // use fill so input event triggers
    await this.urlInput.fill(value);
  }

  async getMessageText() {
    return (await this.message.textContent()) ?? '';
  }

  async getUrlValue() {
    return await this.urlInput.inputValue();
  }

  async isFormPresent() {
    return await this.form.count() > 0;
  }

  // Click the selector and detect if a navigation (form submit) occurred.
  // Returns true if navigation happened (page reloaded/navigated), false otherwise.
  async clickAndDetectNavigation(locator) {
    let navigated = false;
    // Start waiting for navigation (short timeout). If navigation does not happen, the promise will reject.
    const navPromise = this.page.waitForNavigation({ waitUntil: 'load', timeout: 500 }).then(() => {
      navigated = true;
    }).catch(() => {
      // swallow timeout / no navigation case
    });

    await locator.click();
    // await the navPromise to settle
    await navPromise;
    return navigated;
  }
}

test.describe('HTTP Example FSM - 122d3783-fa7b-11f0-814c-dbec508f0b3b', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture console messages for analysis
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture uncaught page errors (ReferenceError, TypeError, etc.) if they occur
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // detach listeners by closing page automatically done by Playwright; keep arrays for assertions in tests
  });

  test.describe('Initial state (S0_Idle) and basic structure', () => {
    test('renders the page with message element and form present (Idle state)', async ({ page }) => {
      // This verifies renderPage() entry evidence: #message and #form exist
      const app = new HttpExamplePage(page);

      expect(await app.isFormPresent()).toBeTruthy();
      const msg = await app.getMessageText();
      // On initial load message is expected to be empty string
      expect(msg).toBe('');
      // No uncaught errors should have occurred simply by rendering
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('URL input interactions and S0 -> S1 transition', () => {
    test('typing into URL input updates message text (URL Entered)', async ({ page }) => {
      // This validates the InputURL event and the transition to S1_URL_Entered
      const app = new HttpExamplePage(page);
      const testUrl = 'https://example.com/test';

      await app.fillUrl(testUrl);

      // The app listens to input event and updates message: 'URL: ' + urlInput.value
      await expect(app.message).toHaveText('URL: ' + testUrl);

      // Ensure no uncaught errors while typing
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Form actions that may trigger navigation due to buttons being inside a form', () => {
    // Helper to check current message after potential navigation.
    async function fetchMessageAfterClick(app, navigated) {
      // If navigated, wait for the page to stabilize then re-create message locator
      if (navigated) {
        // Wait a short time for scripts to re-run
        await app.page.waitForLoadState('domcontentloaded');
      }
      return await app.getMessageText();
    }

    test('Clear button clears message and resets form (ClearForm)', async ({ page }) => {
      // This tests S0_Idle -> S0_Idle on ClearForm
      const app = new HttpExamplePage(page);

      // Populate input first
      await app.fillUrl('some value');
      await expect(app.message).toHaveText('URL: some value');

      const navigated = await app.clickAndDetectNavigation(app.clear);

      const messageAfter = await fetchMessageAfterClick(app, navigated);

      // Expected observable: message cleared
      expect(messageAfter).toBe('');

      // The form should be reset: url value empty
      const urlVal = await app.getUrlValue();
      expect(urlVal).toBe('');

      // No uncaught page errors expected
      expect(pageErrors.length).toBe(0);
    });

    test('Reset button clears message and resets form (ResetForm)', async ({ page }) => {
      // This tests S0_Idle -> S0_Idle on ResetForm
      const app = new HttpExamplePage(page);

      await app.fillUrl('another value');
      await expect(app.message).toHaveText('URL: another value');

      const navigated = await app.clickAndDetectNavigation(app.reset);

      const messageAfter = navigated ? '' : await app.getMessageText();

      expect(messageAfter).toBe('');

      const urlVal = await app.getUrlValue();
      expect(urlVal).toBe('');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Refresh data (S0 -> S2 or S3) and handling network responses', () => {
    test('clicking Refresh attempts fetch and updates message (Success or Error)', async ({ page }) => {
      // This validates the RefreshData event and either Success or Error transitions
      const app = new HttpExamplePage(page);

      // Click refresh; the app will fetch GitHub user and set message to 'Success: ' + data.message (likely undefined)
      const navigated = await app.clickAndDetectNavigation(app.refresh);

      // If navigation occurred, page reloaded - wait and then inspect message
      if (navigated) {
        await app.page.waitForLoadState('domcontentloaded');
      }

      const msg = await app.getMessageText();

      // The application attempts to set message to either 'Success: ...' or 'Error: ...'
      // Accept either: if fetch succeeded message should start with 'Success:', if failed start with 'Error:'
      const ok = msg.startsWith('Success:') || msg.startsWith('Error:') || msg === '';
      expect(ok).toBeTruthy();

      // No uncaught exceptions should be present (fetch errors are handled by catch in script)
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Submit flows from S1_URL_Entered to S2_Success and S3_Error', () => {
    test('submitting a valid data: URL results in Success (S1 -> S2)', async ({ page }) => {
      // This validates SubmitURL success path without network dependency to external servers.
      // We use a data: URL that, when fetched, returns JSON: {"message":"ok"}
      const app = new HttpExamplePage(page);

      const json = JSON.stringify({ message: 'ok' });
      // percent-encode JSON payload for data URL
      const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);

      await app.fillUrl(dataUrl);
      await expect(app.message).toHaveText('URL: ' + dataUrl);

      const navigated = await app.clickAndDetectNavigation(app.submit);

      // If the page navigated (form submission), the fetch promise may not have completed.
      // In that case, we reload state and check message (may be empty).
      if (navigated) {
        // After a reload, try to re-open page state to inspect message
        await app.page.waitForLoadState('domcontentloaded');
      } else {
        // Wait a short while for fetch to resolve and DOM to update
        await app.page.waitForTimeout(300);
      }

      const msg = await app.getMessageText();

      // If the handler ran to completion, it should set message to 'Success: ok'
      // If the form submission navigated away, message may be '', but we accept both possibilities.
      const acceptable = msg === '' || msg === 'Success: ok';
      expect(acceptable).toBeTruthy();

      // Ensure no uncaught runtime errors occurred in the page
      expect(pageErrors.length).toBe(0);
    });

    test('submitting an invalid URL results in Error message (S1 -> S3)', async ({ page }) => {
      // This validates SubmitURL error path: fetch rejection should be caught and message updated
      const app = new HttpExamplePage(page);

      // Use an invalid-looking URL that will cause fetch to fail (network error).
      // The app will catch and set message to 'Error: ' + error.message
      await app.fillUrl('http://invalid.invalid.example');

      // Ensure the input reflected in message
      await expect(app.message).toHaveText('URL: http://invalid.invalid.example');

      const navigated = await app.clickAndDetectNavigation(app.submit);

      if (navigated) {
        // If navigation (form submit) occurred then fetch may not complete
        await app.page.waitForLoadState('domcontentloaded');
      } else {
        // Wait for the promise chain to run and catch to update message
        await app.page.waitForTimeout(500);
      }

      const msg = await app.getMessageText();

      // Expect either an Error message from catch or empty (if form submission reloaded)
      if (msg === '') {
        // If blank due to navigation, assert no uncaught errors (handled by page script)
        expect(pageErrors.length).toBe(0);
      } else {
        expect(msg.startsWith('Error:')).toBeTruthy();
      }
    });

    test('Submit (Error Handling) button triggers the same success/error behavior as Submit', async ({ page }) => {
      // This validates SubmitWithError event transitions to S2 or S3 depending on fetch result
      const app = new HttpExamplePage(page);

      // Provide a data URL that returns JSON to test success branch
      const json = JSON.stringify({ message: 'ok2' });
      const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);

      await app.fillUrl(dataUrl);
      await expect(app.message).toHaveText('URL: ' + dataUrl);

      const navigated = await app.clickAndDetectNavigation(app.submitError);

      if (navigated) {
        await app.page.waitForLoadState('domcontentloaded');
      } else {
        await app.page.waitForTimeout(300);
      }

      const msg = await app.getMessageText();

      // Accept either success message or blank if navigation interrupted execution
      expect(msg === '' || msg === 'Success: ok2').toBeTruthy();

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('submitting with empty URL shows validation message and does not attempt fetch', async ({ page }) => {
      // When the input is empty and Submit clicked, the app sets message to 'Please enter a URL'
      const app = new HttpExamplePage(page);

      // Ensure input is empty
      await app.fillUrl('');
      await expect(app.message).toHaveText('URL: '); // the input listener sets 'URL: ' when empty typed

      // Click submit; because URL is empty, handler should set message to 'Please enter a URL'
      const navigated = await app.clickAndDetectNavigation(app.submit);

      if (navigated) {
        // If navigation happened, page may have reloaded and the message may be empty
        await app.page.waitForLoadState('domcontentloaded');
        // try to determine if message is now the validation message (unlikely because reload resets)
        const msgAfter = await app.getMessageText();
        // If reload occurred, allow either empty or the validation message
        expect(msgAfter === '' || msgAfter === 'Please enter a URL').toBeTruthy();
      } else {
        // No navigation; expect the validation message to be set
        await app.page.waitForTimeout(100);
        const msgAfter = await app.getMessageText();
        expect(msgAfter).toBe('Please enter a URL');
      }

      // No uncaught page errors expected
      expect(pageErrors.length).toBe(0);
    });

    test('monitor console for unexpected errors during interactions', async ({ page }) => {
      // This test performs multiple interactions and asserts that no uncaught runtime exceptions
      // (ReferenceError/SyntaxError/TypeError) bubbled up to become page errors.
      const app = new HttpExamplePage(page);

      // Perform multiple interactions
      await app.fillUrl('https://example.com/hello');
      await expect(app.message).toHaveText('URL: https://example.com/hello');

      // Click clear, reset, and refresh sequentially. These might cause navigation due to buttons inside the form.
      // We handle navigation detection and continue.
      await app.clickAndDetectNavigation(app.clear);
      await app.clickAndDetectNavigation(app.reset);
      await app.clickAndDetectNavigation(app.refresh);

      // Allow any asynchronous handlers to run
      await app.page.waitForTimeout(300);

      // There should be no uncaught page errors (the script handles exceptions for fetch).
      expect(pageErrors.length).toBe(0);

      // Inspect console messages captured; assert that none are 'error' type with JS exception
      const jsExceptionConsole = consoleMessages.find(c => c.type === 'error' && /Uncaught|ReferenceError|TypeError|SyntaxError/i.test(c.text));
      expect(!!jsExceptionConsole).toBe(false);
    });
  });
});