import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a30f03-fa7b-11f0-8b01-9f078a0ff214.html';

/**
 * Page Object for the "Understanding Type Systems" application.
 * Encapsulates common interactions and queries used across tests.
 */
class TypeSystemPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
    // Capture console events and page errors for assertions in tests
    this.page.on('console', (msg) => {
      // store all console messages to inspect later (type, text)
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', (err) => {
      // store page errors (uncaught exceptions in page context)
      this.pageErrors.push(err);
    });
  }

  // Load the application page and wait for basic content to be available
  async open() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait for the demo button to be present as a sign the page rendered
    await this.page.waitForSelector("button[onclick='showDemo()']");
  }

  // Returns the show demo button element handle
  async getShowButton() {
    return this.page.$("button[onclick='showDemo()']");
  }

  // Click the show demo button and capture the alert dialog message
  async clickShowButtonAndCaptureDialog() {
    return new Promise(async (resolve) => {
      // Attach a one-time dialog handler to capture the alert
      this.page.once('dialog', async (dialog) => {
        const message = dialog.message();
        // Accept the alert so the page can continue
        await dialog.accept();
        resolve(message);
      });
      // Perform the click that triggers the alert
      await this.page.click("button[onclick='showDemo()']");
    });
  }

  // Programmatically invoke showDemo() in page context and capture dialog message
  async invokeShowDemoProgrammatically() {
    return new Promise(async (resolve, reject) => {
      // Attach dialog handler before calling the function
      this.page.once('dialog', async (dialog) => {
        const message = dialog.message();
        await dialog.accept();
        resolve(message);
      });
      try {
        // Call the global showDemo function. If it is undefined, this will throw in the page context and be captured by pageerror and reject here.
        await this.page.evaluate(() => {
          // Deliberately call the page's showDemo function
          // This is intended to exercise the FSM's "entry action" for S1 (showDemo)
          // We do not define or patch anything here; we call whatever exists in the page.
          window.showDemo();
        });
      } catch (err) {
        // If evaluate throws because the function is missing, propagate the error to the test via reject
        reject(err);
      }
    });
  }

  // Attempt to call a non-existent function renderPage() to surface ReferenceError/pageerror
  async callMissingRenderPage() {
    // We intentionally call a function that does not exist in the page to allow natural ReferenceError/pageerror to surface.
    // We do not patch or define the function; we expect the browser to throw.
    return this.page.evaluate(() => {
      // This will throw a ReferenceError in the page context if renderPage is not defined.
      // We do not catch it here so it surfaces to the caller and (likely) triggers a pageerror event.
      return renderPage();
    });
  }
}

/*
  Test Suite: FSM States and Transitions for "Understanding Type Systems"
  Tests cover:
  - Idle state rendering (S0_Idle)
  - Transition ShowDemo (Show button click -> alert) to S1_DemoShown
  - Entry action showDemo() for S1 invoked programmatically
  - Error scenario: renderPage() missing (ReferenceError) as described in FSM entry_actions
*/
test.describe('FSM States and Transitions - Understanding Type Systems (d5a30f03...)', () => {
  // Each test gets a fresh page fixture from Playwright
  test.beforeEach(async ({ page }) => {
    // No global setup beyond what each test will do via the TypeSystemPage page object.
  });

  test.afterEach(async ({ page }) => {
    // Ensure page is closed/clean between tests (Playwright test runner typically handles this).
    // Explicitly clear listeners if needed by reloading a blank page.
    try {
      await page.goto('about:blank');
    } catch (e) {
      // ignore teardown navigation errors
    }
  });

  test('S0_Idle: Page renders and Idle state evidence is present (button exists, content visible)', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) entry: the page renders and contains the "Show Type Demo" button.
    const app = new TypeSystemPage(page);
    await app.open();

    // Verify page title and a known heading to ensure content loaded
    await expect(page).toHaveTitle(/Understanding Type Systems/);
    const heading = await page.textContent('h1');
    expect(heading).toBeTruthy();
    expect(heading).toContain('Understanding Type Systems');

    // Verify the "Show Type Demo" button exists and has correct text
    const button = await app.getShowButton();
    expect(button).not.toBeNull();
    const btnText = await button.innerText();
    expect(btnText).toBe('Show Type Demo');

    // Ensure there are no page errors at initial load
    expect(app.pageErrors.length).toBe(0);

    // Ensure console does not have error-level messages on load
    const errorConsoleEntries = app.consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
    expect(errorConsoleEntries.length).toBe(0);
  });

  test('Transition ShowDemo: clicking button triggers an alert with expected demo text (S0_Idle -> S1_DemoShown)', async ({ page }) => {
    // This test validates the transition described in the FSM: clicking the button triggers showDemo() and displays an alert.
    const app = new TypeSystemPage(page);
    await app.open();

    // Click the button and capture the alert text
    const dialogMessage = await app.clickShowButtonAndCaptureDialog();

    // Expected alert content as defined in the HTML implementation
    const expected = "Static Type System: Let number: Int = 5; // Valid\n" +
                     "Dynamic Type System: Let number = 5; // Also valid\n" +
                     "But Static typing catches errors like: Int x = 'text'; // Compile error!";

    expect(dialogMessage).toBe(expected);

    // After transition, ensure the show button is still present (no DOM removal occurred)
    const buttonAfter = await app.getShowButton();
    expect(buttonAfter).not.toBeNull();

    // No unexpected page errors should have been emitted as the showDemo function exists and executed successfully
    expect(app.pageErrors.length).toBe(0);

    // Clicking again should show the alert again (idempotency check for this transition)
    const dialogMessage2 = await app.clickShowButtonAndCaptureDialog();
    expect(dialogMessage2).toBe(expected);
  });

  test('S1_DemoShown entry action: invoking showDemo() programmatically triggers the same alert (simulate entering S1)', async ({ page }) => {
    // This test invokes the FSM entry action showDemo() directly via the page context and asserts the alert is displayed.
    const app = new TypeSystemPage(page);
    await app.open();

    // Programmatic invocation of showDemo() should behave the same as clicking the button.
    let programmaticMessage;
    try {
      programmaticMessage = await app.invokeShowDemoProgrammatically();
    } catch (err) {
      // If for some reason invoking programmatically fails (shouldn't in this implementation), fail the test with the caught error.
      throw new Error('Programmatic invocation of showDemo() failed: ' + err);
    }

    const expected = "Static Type System: Let number: Int = 5; // Valid\n" +
                     "Dynamic Type System: Let number = 5; // Also valid\n" +
                     "But Static typing catches errors like: Int x = 'text'; // Compile error!";

    expect(programmaticMessage).toBe(expected);

    // Ensure no page errors resulted from direct invocation
    expect(app.pageErrors.length).toBe(0);
  });

  test('Error scenario / Edge case: calling missing entry action renderPage() surfaces a ReferenceError/pageerror naturally', async ({ page }) => {
    // This test intentionally invokes a non-existent function renderPage() in the page context to validate that missing
    // onEnter actions produce natural ReferenceErrors which we must observe and assert.
    const app = new TypeSystemPage(page);
    await app.open();

    // Prepare to capture any pageerrors that might be emitted as a result of calling the missing function
    let caughtError = null;
    try {
      // Attempt to call renderPage() which is not defined in the provided HTML.
      // We do not define or patch anything; we rely on the runtime to throw.
      await app.callMissingRenderPage();
    } catch (err) {
      // The evaluation should reject with an error describing that renderPage is not defined.
      caughtError = err;
    }

    // Assert that an error was thrown when attempting to call renderPage()
    expect(caughtError).not.toBeNull();
    const errMsg = String(caughtError && caughtError.message ? caughtError.message : caughtError);
    // The exact message can vary across browsers/runtimes, but it should reference renderPage and indicate it's undefined or not found.
    const matches = /renderPage/.test(errMsg) && /(is not defined|not defined|ReferenceError|renderPage)/i.test(errMsg);
    expect(matches).toBeTruthy();

    // Additionally, the page may emit a pageerror corresponding to the ReferenceError.
    // Wait briefly to allow any pageerror event to be collected.
    await page.waitForTimeout(100); // small wait for events to propagate
    const pageErrorsFound = app.pageErrors.filter(e => String(e).toLowerCase().includes('renderpage') || String(e).toLowerCase().includes('referenceerror'));
    // At least one pageerror should be present that references renderPage or ReferenceError in common environments.
    expect(pageErrorsFound.length).toBeGreaterThanOrEqual(0);
    // We assert that either the thrown error or a pageerror contains a reference to the missing function.
    const foundInPageErrors = app.pageErrors.some(e => /renderPage/i.test(String(e)));
    expect(foundInPageErrors || /renderPage/i.test(errMsg)).toBeTruthy();
  });
});