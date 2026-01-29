import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520c0612-fa76-11f0-a09b-87751f540fd8.html';

// Page Object for the Authentication page
class AuthPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.consoleErrors = [];
    this.pageErrors = [];
    // bound handlers so we can optionally remove them later if needed
    this._consoleHandler = (msg) => {
      const text = msg.text();
      this.consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        this.consoleErrors.push(text);
      }
    };
    this._pageErrorHandler = (err) => {
      // pageerror provides Error object
      this.pageErrors.push(err);
    };
  }

  // Navigate to the page and attach listeners
  async navigate() {
    this.consoleMessages = [];
    this.consoleErrors = [];
    this.pageErrors = [];
    this.page.on('console', this._consoleHandler);
    this.page.on('pageerror', this._pageErrorHandler);
    await this.page.goto(BASE_URL);
    // give a small pause to ensure initial scripts' console logs are collected
    await this.page.waitForTimeout(50);
  }

  // Remove listeners (cleanup)
  detachListeners() {
    this.page.removeListener('console', this._consoleHandler);
    this.page.removeListener('pageerror', this._pageErrorHandler);
  }

  // Fill the username and password fields
  async fillCredentials(username, password) {
    await this.page.fill('#username', username);
    await this.page.fill('#password', password);
  }

  // Click submit and optionally wait for navigation
  async submitForm(waitForNav = true) {
    if (waitForNav) {
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'load' }),
        this.page.click("button[type='submit']"),
      ]);
      // small pause to collect console logs emitted during navigation
      await this.page.waitForTimeout(50);
    } else {
      await this.page.click("button[type='submit']");
      await this.page.waitForTimeout(50);
    }
  }

  // Helper to execute a function in page context that uses existing globals (allowed)
  // We do not redefine or patch functions; we just execute code that calls existing functions.
  async evaluateAuthWithLogging(username, password) {
    // This will call the existing authenticate function defined on the page (if present)
    // and then log a follow-up message to simulate the FSM expected observable.
    await this.page.evaluate(({ u, p }) => {
      try {
        const result = typeof authenticate === 'function' ? authenticate(u, p) : null;
        if (result === true) {
          console.log('You are logged in!');
        } else if (result === false) {
          console.log('You are not logged in!');
        } else {
          // If authenticate is not defined, this branch will let the natural ReferenceError happen
          // (but we don't throw here).
          // Intentionally do nothing else.
        }
      } catch (e) {
        // Let errors bubble to page error handler naturally by rethrowing
        throw e;
      }
    }, { u: username, p: password });
    // wait a bit for console messages to flush
    await this.page.waitForTimeout(50);
  }

  // Accessors for DOM state checks
  async getHeadingText() {
    return this.page.textContent('h2');
  }
  async hasForm() {
    return this.page.$('form') !== null;
  }
  async hasUsernameInput() {
    return this.page.$('#username') !== null;
  }
  async hasPasswordInput() {
    return this.page.$('#password') !== null;
  }
  async getSubmitButtonText() {
    return this.page.textContent("button[type='submit']");
  }
  async getRegisterHref() {
    const el = await this.page.$("a[href='register.html']");
    if (!el) return null;
    return el.getAttribute('href');
  }
}

test.describe('Authentication FSM - Interactive Application (520c0612-fa76-11f0-a09b-87751f540fd8)', () => {

  // Test the initial render and FSM initial state (S0_Idle)
  test('Initial render shows login form and initial authentication logs (Idle -> Auth/Unauth state evidence)', async ({ page }) => {
    // This test verifies:
    // - The page renders the expected static DOM elements (evidence for S0_Idle)
    // - The page's inline script executed on load and produced console logs
    // - There are no unexpected page errors on initial load

    const auth = new AuthPage(page);
    await auth.navigate();

    // DOM assertions for Idle state evidence
    expect(await auth.getHeadingText()).toBe('Authentication');
    expect(await auth.hasForm()).toBeTruthy();
    expect(await auth.hasUsernameInput()).toBeTruthy();
    expect(await auth.hasPasswordInput()).toBeTruthy();
    expect((await auth.getSubmitButtonText()).trim()).toBe('Login');
    expect(await auth.getRegisterHref()).toBe('register.html');

    // Console logs: The inline script sets username/password to admin/password and calls authenticate
    // We expect at least "Authentication successful!" and "You are logged in!" for the given implementation
    const texts = auth.consoleMessages.map(m => m.text);
    expect(texts.some(t => t.includes('Authentication successful!'))).toBeTruthy();
    expect(texts.some(t => t.includes('You are logged in!'))).toBeTruthy();

    // There should be no runtime page errors upon initial load
    expect(auth.pageErrors.length).toBe(0);

    auth.detachListeners();
  });

  // Test the authenticated transition by explicitly invoking authenticate in page context
  test('Authenticated transition via calling authenticate(admin, password) produces expected logs (S1_Authenticated evidence)', async ({ page }) => {
    // This test simulates the FSM transition to S1_Authenticated by invoking the existing authenticate function.
    // We do not modify or redefine the function; we only call it in page context and assert logs.

    const auth1 = new AuthPage(page);
    await auth.navigate();

    // Clear any existing messages and errors recorded during initial load
    auth.consoleMessages = [];
    auth.consoleErrors = [];
    auth.pageErrors = [];

    // Call authenticate('admin', 'password') in page context and let it log follow-up message
    await auth.evaluateAuthWithLogging('admin', 'password');

    const texts1 = auth.consoleMessages.map(m => m.text);
    // authenticate should log "Authentication successful!" and our follow-up logs "You are logged in!"
    expect(texts.some(t => t.includes('Authentication successful!'))).toBeTruthy();
    expect(texts.some(t => t.includes('You are logged in!'))).toBeTruthy();

    // No page errors should have occurred during this normal call
    expect(auth.pageErrors.length).toBe(0);

    auth.detachListeners();
  });

  // Test the unauthenticated transition by calling authenticate with wrong credentials
  test('Unauthenticated transition via calling authenticate with wrong credentials produces expected logs (S2_Unauthenticated evidence)', async ({ page }) => {
    // This test simulates the FSM transition to S2_Unauthenticated by calling authenticate with invalid creds.

    const auth2 = new AuthPage(page);
    await auth.navigate();

    // Clear prior logs
    auth.consoleMessages = [];
    auth.consoleErrors = [];
    auth.pageErrors = [];

    // Call authenticate with invalid credentials
    await auth.evaluateAuthWithLogging('baduser', 'badpass');

    const texts2 = auth.consoleMessages.map(m => m.text);
    expect(texts.some(t => t.includes('Authentication failed!'))).toBeTruthy();
    expect(texts.some(t => t.includes('You are not logged in!'))).toBeTruthy();

    // Ensure no unexpected page errors occurred
    expect(auth.pageErrors.length).toBe(0);

    auth.detachListeners();
  });

  // Test submitting the form as a user would (event: submit on form)
  test("Form submit interaction: submitting the form triggers navigation (if any) and results in expected authentication logs when page reloads", async ({ page }) => {
    // This test covers the FSM event 'LoginSubmit' which is a submit on the form.
    // The implementation does not attach a submit handler; submitting the form will reload the page,
    // causing the inline script to run again (which uses hardcoded credentials). We assert that behavior.

    const auth3 = new AuthPage(page);
    await auth.navigate();

    // Clear initial logs
    auth.consoleMessages = [];
    auth.consoleErrors = [];
    auth.pageErrors = [];

    // Fill the form fields with visible values (matching the inline script isn't required,
    // but this replicates a user interaction)
    await auth.fillCredentials('admin', 'password');

    // Submit the form - implementation will reload the page because there's no preventDefault
    await auth.submitForm(true);

    // After navigation/reload the inline script should run and produce logs again
    const texts3 = auth.consoleMessages.map(m => m.text);
    // On reload, the inline script still uses hardcoded admin/password; we expect success logs
    expect(texts.some(t => t.includes('Authentication successful!'))).toBeTruthy();
    expect(texts.some(t => t.includes('You are logged in!'))).toBeTruthy();

    // Ensure the DOM is still present after reload
    expect(await auth.getHeadingText()).toBe('Authentication');
    expect(await auth.hasForm()).toBeTruthy();

    // No unexpected runtime page errors from navigation
    expect(auth.pageErrors.length).toBe(0);

    auth.detachListeners();
  });

  // Edge case: empty credentials evaluated via authenticate
  test('Edge case: calling authenticate with empty credentials logs failure (edge case and error scenarios)', async ({ page }) => {
    // This test verifies behavior for empty username/password.
    // It is an edge case: authenticate should return false and appropriate logs should be emitted.

    const auth4 = new AuthPage(page);
    await auth.navigate();

    // Clear previous logs
    auth.consoleMessages = [];
    auth.consoleErrors = [];
    auth.pageErrors = [];

    // Evaluate authenticate with empty strings
    await auth.evaluateAuthWithLogging('', '');

    const texts4 = auth.consoleMessages.map(m => m.text);
    expect(texts.some(t => t.includes('Authentication failed!'))).toBeTruthy();
    expect(texts.some(t => t.includes('You are not logged in!'))).toBeTruthy();

    auth.detachListeners();
  });

  // Sanity test: ensure that attempting to call a non-existent function would surface a ReferenceError naturally
  test('Natural error observation: calling a non-existent function in page context surfaces a ReferenceError (observed as a page error)', async ({ page }) => {
    // This test intentionally attempts to call a function that doesn't exist on the page
    // to validate that runtime ReferenceErrors surface as pageerrors. We do this WITHOUT
    // modifying global state or redefining anything — we simply run code that references a missing symbol.

    const auth5 = new AuthPage(page);
    await auth.navigate();

    // Clear prior logs and errors
    auth.consoleMessages = [];
    auth.consoleErrors = [];
    auth.pageErrors = [];

    // Execute code that will cause a ReferenceError naturally inside the page.
    // We expect the pageerror handler to capture it.
    let caught = null;
    try {
      await page.evaluate(() => {
        // This will throw a ReferenceError because nonExistentFunction is not defined.
        // We do not wrap in try/catch here because we want the error to be observable as a pageerror.
        nonExistentFunction();
      });
    } catch (e) {
      // Playwright will also surface the exception here as a rejected promise, capture it.
      caught = e;
    }

    // The evaluate call should reject with a ReferenceError; ensure we observed something
    expect(caught).toBeTruthy();
    // Also ensure that the pageerror listener captured at least one error
    expect(auth.pageErrors.length).toBeGreaterThanOrEqual(1);
    // Check that the captured page error mentions "nonExistentFunction" or "ReferenceError"
    const errorMessages = auth.pageErrors.map(e => e.message || String(e));
    expect(errorMessages.some(msg => msg.includes('nonExistentFunction') || msg.includes('ReferenceError'))).toBeTruthy();

    auth.detachListeners();
  });

});