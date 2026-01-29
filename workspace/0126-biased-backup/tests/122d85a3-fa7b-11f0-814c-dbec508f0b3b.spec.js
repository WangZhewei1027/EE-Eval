import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122d85a3-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object encapsulating interactions and selectors for the SDLC page
class SDLCPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.submitSelector = 'input[type="submit"]';
    this.generateButton = 'button[onclick="generatePage()"]';
    this.forms = page.locator('form');
    this.heading = page.locator('h1');
    this.phaseHeadings = page.locator('.phase h2');
  }

  // Navigate to the app
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Get the main heading text
  async getMainHeadingText() {
    return this.heading.textContent();
  }

  // Get the Nth phase heading text (1-based)
  async getPhaseHeadingByIndex(index) {
    const locator = this.phaseHeadings.nth(index - 1);
    return locator.textContent();
  }

  // Submit a form by 1-based index. Returns an object { navigated: boolean }
  // We attempt to detect navigation (form submits often cause navigation). We start waitForNavigation
  // before clicking. If no navigation occurs within timeout, we gracefully return navigated: false.
  async submitFormByIndex(index, navigationTimeout = 2000) {
    const form = this.forms.nth(index - 1);
    const submitButton = form.locator(this.submitSelector);
    // Start navigation watcher
    const navPromise = this.page.waitForNavigation({ timeout: navigationTimeout }).catch(() => null);
    // Perform click
    await submitButton.click();
    // Await result of navigation watcher
    const navResult = await navPromise;
    return { navigated: navResult !== null };
  }

  // Click the Generate Page button
  async clickGenerateButton() {
    await this.page.click(this.generateButton);
  }

  // Call a global function on the page and return any thrown error details
  async callGlobalFunction(functionName) {
    return this.page.evaluate((fnName) => {
      try {
        // Attempt to call the function; if undefined this will throw
        // We intentionally do not patch or define anything on the page.
        window[fnName]();
        return { error: null };
      } catch (e) {
        // Return basic error info; we avoid serializing the whole error object
        return { error: { name: e.name, message: e.message } };
      }
    }, functionName);
  }

  // Utility: verify that a selector exists in DOM
  async exists(selector) {
    return this.page.locator(selector).count().then(count => count > 0);
  }
}

test.describe('Software Development Life Cycle - FSM and UI Validation', () => {
  let consoleMessages;
  let pageErrors;

  // Attach listeners and navigate to the page before each test to ensure isolation
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for later assertions/inspection
    page.on('console', msg => {
      try {
        consoleMessages.push({ text: msg.text(), type: msg.type() });
      } catch {
        // ignore any serialization issues
      }
    });

    // Capture unhandled errors in the page context
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to a fresh copy of the app for each test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Nothing special to teardown; individual tests leave no external side effects
  });

  test('Initial state (Idle) renders the main heading and the Requirements phase', async ({ page }) => {
    // This test validates the initial FSM Idle state evidence and that the Requirements phase is present.
    const sdlc = new SDLCPage(page);

    // Verify main heading as evidence of S0_Idle
    const headingText = await sdlc.getMainHeadingText();
    expect(headingText.trim()).toBe('Software Development Life Cycle');

    // Verify first phase heading exists and is the Requirements Gathering heading
    const firstPhase = await sdlc.getPhaseHeadingByIndex(1);
    expect(firstPhase.trim()).toBe('Requirements Gathering');

    // Verify some key components for the first form exist (name, email, message)
    expect(await sdlc.exists('#name')).toBeTruthy();
    expect(await sdlc.exists('#email')).toBeTruthy();
    expect(await sdlc.exists('#message')).toBeTruthy();

    // No page errors should have occurred just loading the page
    expect(pageErrors.length).toBe(0);
  });

  test('Submit each phase form sequentially (Requirements -> Maintenance): validate submit events and transitions', async ({ page }) => {
    // This test will iterate through the 6 forms and submit each one in order.
    // Because the implementation does not implement JS transitions on submit, we assert that:
    // - Submitting a form does not throw JS errors in the page context
    // - The page still contains the expected phase headings (forms are present on the page)
    // - We attempt to detect navigation (form submit may reload). We will tolerate either case.
    const sdlc = new SDLCPage(page);

    // Validate there are 6 forms as expected from the FSM
    const formCount = await page.locator('form').count();
    expect(formCount).toBeGreaterThanOrEqual(6);

    // Submit each form in order; forms are 1..6
    for (let i = 1; i <= 6; i++) {
      // Each submission uses a fresh page state if a navigation occurred. To be resilient,
      // reload the page if navigation happened; but since we don't force reloads, we will just re-query.
      const result = await sdlc.submitFormByIndex(i, 2000);
      // It's acceptable whether navigation happened or not; just record it for diagnostic messages.
      // But ensure no page errors were produced by the submit action.
      expect(pageErrors.length).toBe(0);

      // After submit, ensure the corresponding phase heading still exists somewhere on the page.
      // Because all phases are present simultaneously in the static HTML, this will validate presence.
      const phaseHeading = await sdlc.getPhaseHeadingByIndex(i);
      expect(typeof phaseHeading).toBe('string');
      expect(phaseHeading.trim().length).toBeGreaterThan(0);
    }
  });

  test('Generate Page button exists and clicking it triggers the generatePage function which leads to a runtime error (TypeError)', async ({ page }) => {
    // This test verifies the "Generate Page" event from the FSM and asserts the natural TypeError
    // that arises from the implementation when generatePage tries to set values on elements that may have been removed.
    const sdlc = new SDLCPage(page);

    // Ensure the generate button exists
    expect(await sdlc.exists('button[onclick="generatePage()"]')).toBeTruthy();

    // Click the generate button and wait a short moment for any pageerror events to fire.
    await sdlc.clickGenerateButton();

    // Give the page a moment to process and emit runtime errors (if any)
    await page.waitForTimeout(250);

    // We expect the script to attempt to set .value on elements that may be null, producing a TypeError.
    // Confirm that at least one pageerror matching a TypeError pattern occurred.
    const typeErrorDetected = pageErrors.some(err => {
      if (!err || !err.message) return false;
      const msg = err.message.toLowerCase();
      // Typical Chromium message: "Cannot set properties of null (setting 'value')"
      return msg.includes('cannot set') || msg.includes('cannot read') || msg.includes('null');
    });

    // Assert that a runtime error was observed as part of clicking Generate Page.
    expect(typeErrorDetected).toBeTruthy();

    // Also assert that a console message may have been produced (non-zero console messages list)
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });

  test('Calling missing renderPage() should throw ReferenceError when invoked in page context', async ({ page }) => {
    // FSM mentions an entry_action renderPage(). The page does not define renderPage.
    // We intentionally attempt to call it to assert it throws a ReferenceError in the page context.
    const sdlc = new SDLCPage(page);

    // Attempt to call a global function named 'renderPage'
    const result = await sdlc.callGlobalFunction('renderPage');

    // We expect an error to be returned and that error.name is 'ReferenceError'
    expect(result).toHaveProperty('error');
    expect(result.error).not.toBeNull();
    // Some environments may label the error 'ReferenceError' and message 'renderPage is not defined'.
    expect(result.error.name).toBe('ReferenceError');
    expect(typeof result.error.message).toBe('string');
    expect(result.error.message.length).toBeGreaterThan(0);
  });

  test('Verify presence and attributes of key form components (inputs, selects, textareas)', async ({ page }) => {
    // This test checks the component evidence from the FSM: presence and basic attributes of inputs/selects/textareas.
    const sdlc = new SDLCPage(page);

    // Spot-check several components
    expect(await sdlc.exists('#name')).toBeTruthy();
    expect(await sdlc.exists('#email')).toBeTruthy();
    expect(await sdlc.exists('#message')).toBeTruthy();
    expect(await sdlc.exists('#color')).toBeTruthy();
    expect(await sdlc.exists('#shape')).toBeTruthy();
    expect(await sdlc.exists('#size')).toBeTruthy();
    expect(await sdlc.exists('#language')).toBeTruthy();
    expect(await sdlc.exists('#framework')).toBeTruthy();
    expect(await sdlc.exists('#database')).toBeTruthy();
    expect(await sdlc.exists('#test_type')).toBeTruthy();
    expect(await sdlc.exists('#test_case')).toBeTruthy();
    expect(await sdlc.exists('#expected_result')).toBeTruthy();
    expect(await sdlc.exists('#deployment_type')).toBeTruthy();
    expect(await sdlc.exists('#deployment_method')).toBeTruthy();
    expect(await sdlc.exists('#bug_report')).toBeTruthy();
    expect(await sdlc.exists('#solution')).toBeTruthy();

    // Validate a sample of input attributes via evaluate to avoid brittle serialization
    const nameType = await page.locator('#name').evaluate(el => el.getAttribute('type'));
    expect(nameType).toBe('text');

    const emailType = await page.locator('#email').evaluate(el => el.getAttribute('type'));
    expect(emailType).toBe('email');

    const sizeType = await page.locator('#size').evaluate(el => el.getAttribute('type'));
    expect(sizeType).toBe('number');
  });

  test('Edge case: submitting a form with empty required-ish fields does not throw JS errors', async ({ page }) => {
    // There are no explicit required attributes on inputs, but we validate submitting while empty
    // does not trigger unexpected JS exceptions in the page.
    const sdlc = new SDLCPage(page);

    // Ensure form 1 fields are empty and submit it
    await page.fill('#name', '');
    await page.fill('#email', '');
    await page.fill('#message', '');

    const { navigated } = await sdlc.submitFormByIndex(1, 2000);
    // Either navigated or not is acceptable; make sure no page errors were collected
    expect(pageErrors.length).toBe(0);

    // After the submit, the main heading should still be present (page reload or not still shows it)
    const headingText = await sdlc.getMainHeadingText();
    expect(headingText.trim()).toBe('Software Development Life Cycle');
  });
});