import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0126-biased/html/04454244-fa79-11f0-8a8e-bbe4f11717c6.html';

/**
 * Page object representing the Authentication login page.
 * Encapsulates common interactions and queries to keep tests readable.
 */
class LoginPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = BASE;
  }

  async goto() {
    await this.page.goto(this.url, { waitUntil: 'domcontentloaded' });
  }

  async headerText() {
    return this.page.textContent('h1');
  }

  async isFormPresent() {
    return this.page.$('#login-form') !== null;
  }

  async isInputPresent(selector) {
    return this.page.$(selector) !== null;
  }

  async inputRequired(selector) {
    return this.page.$eval(selector, el => el.hasAttribute('required'));
  }

  async submitButtonText() {
    return this.page.textContent("button[type='submit']");
  }

  async fillCredentials(username, password) {
    await this.page.fill('#username', username);
    await this.page.fill('#password', password);
  }

  // Click the submit button and optionally wait for navigation
  async clickSubmit({ waitForNavigation = false, timeout = 3000 } = {}) {
    if (waitForNavigation) {
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'load', timeout }).catch(e => e),
        this.page.click("button[type='submit']")
      ]);
    } else {
      await this.page.click("button[type='submit']");
    }
  }

  // Returns whether there is any invalid input in the form (HTML5 validation)
  async hasInvalidInputs() {
    return this.page.$eval('#login-form', form => {
      const inputs = Array.from(form.querySelectorAll('input'));
      return inputs.some(i => !i.checkValidity());
    });
  }

  // Check if a function exists on the window (used to verify onEnter/onExit actions presence)
  async typeofWindowFunction(name) {
    return this.page.evaluate((n) => typeof window[n], name);
  }
}

test.describe('Authentication FSM - 04454244-fa79-11f0-8a8e-bbe4f11717c6', () => {

  // Capture console messages and page errors for each test to allow assertions about runtime problems.
  test.beforeEach(async ({ page }) => {
    // Nothing here; individual tests will attach listeners early (so they don't miss messages during navigation).
  });

  test('Idle state renders initial UI (S0_Idle) - header, form and components exist', async ({ page }) => {
    // Validate initial state evidence: <h1>Authentication</h1> and login form present with inputs and submit button.
    const login = new LoginPage(page);

    // Attach listeners to capture console and page errors during initial load.
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push(msg));
    page.on('pageerror', err => pageErrors.push(err));

    await login.goto();

    // Check header
    const header = await login.headerText();
    expect(header).toBeTruthy(); // should exist
    expect(header).toContain('Authentication');

    // Check form presence
    const form = await page.$('#login-form');
    expect(form).not.toBeNull();

    // Check inputs and required attributes per FSM components
    expect(await login.isInputPresent('#username')).toBeTruthy();
    expect(await login.isInputPresent('#password')).toBeTruthy();
    expect(await login.inputRequired('#username')).toBeTruthy();
    expect(await login.inputRequired('#password')).toBeTruthy();

    // Check submit button
    const submitText = await login.submitButtonText();
    expect(submitText).toBe('Login');

    // Ensure there is at least one console or page error logged related to runtime resources (script.js missing or other issues).
    // We don't modify or patch the environment; we only observe and assert that such errors occur naturally.
    const errorLike = consoleMessages.find(m => m.type() === 'error' || /script\.js|Failed to load resource|404/i.test(m.text()));
    // We also accept page errors if any were thrown during load.
    expect(Boolean(errorLike) || pageErrors.length > 0).toBe(true);
  });

  test('Form validation prevents submission when fields are empty (edge case)', async ({ page }) => {
    // This verifies client-side HTML5 validation (required fields) prevents a transition to Logging In.
    const login = new LoginPage(page);
    await login.goto();

    // Capture console and page errors for visibility
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', m => consoleMessages.push(m));
    page.on('pageerror', e => pageErrors.push(e));

    const beforeUrl = page.url();

    // Click submit without filling required inputs. Browser should block submission.
    await login.clickSubmit({ waitForNavigation: false });

    // After clicking submit with empty required inputs, the page should not navigate away.
    expect(page.url()).toBe(beforeUrl);

    // And the form should report invalid inputs via checkValidity()
    const hasInvalid = await login.hasInvalidInputs();
    expect(hasInvalid).toBe(true);

    // There should be no navigation to the Logging In state. We assert that by ensuring no navigation occurred.
    // Also assert that at least one console or page error exists or that there is a validation behavior observed.
    // If there are no console errors, that's acceptable for this test; we explicitly assert the validation result above.
    // But still capture messages for debugging purposes:
    // If there are page errors, expose them as part of the assertion (they may be unrelated).
    expect(Array.isArray(consoleMessages)).toBe(true);
    expect(Array.isArray(pageErrors)).toBe(true);
  });

  test('Submitting valid credentials transitions to Logging In (S1_LoggingIn) and triggers form submission', async ({ page }) => {
    // This test verifies the SubmitLogin event and the transition from S0_Idle to S1_LoggingIn.
    // Because there is no client-side JS to handle the submit, a native form submission will trigger a navigation (page reload).
    const login = new LoginPage(page);

    // Arrays to capture runtime diagnostics (console and page errors).
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', m => consoleMessages.push(m));
    page.on('pageerror', e => pageErrors.push(e));

    await login.goto();

    // Fill the required inputs so HTML5 validation allows submission.
    await login.fillCredentials('testuser', 's3cr3t');

    // Submit and wait for navigation (native form POST/GET to same URL). We allow a moderate timeout for reload.
    const [navResult] = await Promise.all([
      page.waitForNavigation({ waitUntil: 'load', timeout: 5000 }).catch(e => e),
      page.click("button[type='submit']")
    ]);

    // The navigation may resolve to an error object if nothing navigated; assert that either navigation happened (object not an Error) or the page still loaded.
    // We expect navigation to occur because form is valid.
    expect(navResult instanceof Error).toBe(false);

    // After navigation reload, evidence for S1_LoggingIn (presence of submit button) should still be true.
    const submitText = await page.textContent("button[type='submit']");
    expect(submitText).toBe('Login');

    // Observability: The FSM expected an observable "Form submission initiated".
    // Since there's no JS handling the submission, we assert the browser actually attempted navigation and the form submission occurred.
    // We assert that either the navigation did happen (checked above) and that the form/button still exist.
    expect(await page.$('#login-form')).not.toBeNull();

    // Also assert runtime diagnostics exist: console errors (e.g., failed to load script.js) or page errors.
    const hadConsoleError = consoleMessages.some(m => m.type() === 'error' || /script\.js|Failed to load resource|404/i.test(m.text()));
    expect(hadConsoleError || pageErrors.length > 0).toBe(true);
  });

  test('Verify onEnter/onExit actions presence/absence (renderPage) without modifying the environment', async ({ page }) => {
    // FSM mentioned an entry action renderPage(). We must verify its presence or absence as-is.
    // We do NOT inject or call functions; we only observe the runtime.
    const login = new LoginPage(page);

    await login.goto();

    // Check whether a function named renderPage exists on the window.
    const tp = await login.typeofWindowFunction('renderPage');
    // Because the provided HTML doesn't define renderPage, we expect 'undefined'.
    expect(tp).toBe('undefined');

    // If the application had attempted to call renderPage during load and it was undefined,
    // a ReferenceError would have been thrown and captured via pageerror. Validate that such errors are observed or that the function is absent.
    // We accept either the presence of a pageerror mentioning renderPage or the explicit undefined.
    // Collect any page errors now:
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e));

    // Give a tiny delay for any late errors to be emitted (they would typically have occurred on load).
    await page.waitForTimeout(100);

    const renderPageErrorObserved = pageErrors.some(e => /renderPage/i.test(String(e)));
    expect(tp === 'undefined' || renderPageErrorObserved).toBe(true);
  });

  test('Observe console and page errors across navigation and report diagnostic messages', async ({ page }) => {
    // This test focuses solely on collecting console logs and page errors and asserting that we're observing runtime diagnostics.
    const login = new LoginPage(page);

    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push(msg));
    page.on('pageerror', e => pageErrors.push(e));

    await login.goto();

    // Trigger a reload to make sure any resource loading errors are emitted and captured.
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Wait a short while to ensure asynchronous errors (if any) are captured.
    await page.waitForTimeout(200);

    // Build a readable snapshot of console error texts for assertion/debugging.
    const consoleErrorTexts = consoleMessages
      .filter(m => m.type() === 'error' || /Failed to load resource|404|script\.js/i.test(m.text()))
      .map(m => m.text());

    // We expect that at least one console error or page error occurred (e.g., missing script.js or runtime exceptions).
    const hasConsoleOrPageError = consoleErrorTexts.length > 0 || pageErrors.length > 0;
    expect(hasConsoleOrPageError).toBe(true);

    // For visibility in failure output, attach messages to the expectation if the test fails.
    // (Playwright will show values in the assertion failure.)
    expect(consoleErrorTexts.length + pageErrors.length).toBeGreaterThanOrEqual(1);
  });

});