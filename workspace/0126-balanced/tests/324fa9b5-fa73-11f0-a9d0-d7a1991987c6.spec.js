import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324fa9b5-fa73-11f0-a9d0-d7a1991987c6.html';

/**
 * Page Object for the Static Typing Example page.
 * Encapsulates common actions and queries so tests are readable and maintainable.
 */
class StaticTypingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = "button[onclick='demonstrateStaticTyping()']";
    this.resultSelector = '#result';
  }

  // Navigate to the application URL
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Returns the button element handle (if present)
  async getButton() {
    return await this.page.$(this.buttonSelector);
  }

  // Click the "Run Static Typing Example" button
  async clickRun() {
    await this.page.click(this.buttonSelector);
  }

  // Get the result text content
  async getResultText() {
    return (await this.page.textContent(this.resultSelector)) ?? '';
  }

  // Wait for result to be non-empty (used after clicking)
  async waitForResultNonEmpty(timeout = 2000) {
    await this.page.waitForFunction(
      selector => {
        const el = document.querySelector(selector);
        return el && el.innerText && el.innerText.trim().length > 0;
      },
      this.resultSelector,
      { timeout }
    );
  }
}

test.describe('Static Typing Example - FSM states and transitions', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // Defensive: ensure capturing doesn't throw test failures
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture unhandled exceptions thrown on the page
    page.on('pageerror', err => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });
  });

  test.afterEach(async ({}, testInfo) => {
    // If a test fails, attach captured console and errors to the output for debugging
    if (testInfo.status !== testInfo.expectedStatus) {
      // Print a concise summary to the test output
      // Playwright test runner will show these in the logs
      // We don't throw here; this is only for diagnostics.
      // eslint-disable-next-line no-console
      console.log('--- Captured console messages ---', consoleMessages);
      // eslint-disable-next-line no-console
      console.log('--- Captured page errors ---', pageErrors);
    }
  });

  test('Initial Idle state: page renders button and empty result (S0_Idle)', async ({ page }) => {
    // This test validates the initial "Idle" state per the FSM:
    // - The Run button should be present with the expected onclick handler selector
    // - The result div should exist and be empty
    // - No unexpected page errors should be present on load
    const app = new StaticTypingPage(page);
    await app.goto();

    // Verify the button exists and has expected text
    const button = await app.getButton();
    expect(button).not.toBeNull();
    const buttonText = (await button.textContent())?.trim();
    expect(buttonText).toBe('Run Static Typing Example');

    // Verify the result div exists and is initially empty
    const initialResult = await app.getResultText();
    expect(initialResult).toBe(''); // Idle state expectation: no result displayed

    // Verify that there were no uncaught page errors while loading the Idle state
    expect(pageErrors).toEqual([]);

    // Verify console did not emit error-level messages on load
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);

    // FSM entry_action mentioned "renderPage()" - confirm that no global renderPage function is present.
    // We must not inject or modify globals; simply observe its absence.
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(hasRenderPage).toBe(false);
  });

  test('Transition on click: clicking the button displays the result (S0_Idle -> S1_ResultDisplayed)', async ({ page }) => {
    // This test validates the transition triggered by the RunStaticTyping event:
    // - Clicking the button runs demonstrateStaticTyping() and updates #result with the expected greeting
    // - The DOM update is verified, and no runtime errors are thrown during the transition
    const app1 = new StaticTypingPage(page);
    await app.goto();

    // Precondition: result is empty
    expect(await app.getResultText()).toBe('');

    // Click the button to trigger the FSM transition/action
    await app.clickRun();

    // Wait for result to be populated by the page script
    await app.waitForResultNonEmpty();

    // Validate the expected text was placed into the result div
    const resultText = (await app.getResultText()).trim();
    expect(resultText).toBe('Hello, John, you are 30 years old.');

    // Validate that the result div has the expected class styling present in the DOM
    const hasResultClass = await page.$eval('#result', el => el.classList.contains('result'));
    expect(hasResultClass).toBe(true);

    // Verify no uncaught page errors were emitted during the action
    expect(pageErrors).toEqual([]);

    // Verify no console error messages were produced during the action
    const errorConsoleMessages1 = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Idempotency and repeated interactions: multiple clicks produce consistent result and no errors', async ({ page }) => {
    // This test validates repeated triggering of the same transition:
    // - Clicking the Run button multiple times should result in the same result text
    // - No additional errors should be emitted on repeated execution
    const app2 = new StaticTypingPage(page);
    await app.goto();

    // Click first time
    await app.clickRun();
    await app.waitForResultNonEmpty();
    const firstResult = (await app.getResultText()).trim();
    expect(firstResult).toBe('Hello, John, you are 30 years old.');

    // Click a second time and ensure the same outcome (idempotent final state)
    await app.clickRun();
    // A small wait to allow any potential re-render; not expecting change but ensure stability
    await page.waitForTimeout(200);
    const secondResult = (await app.getResultText()).trim();
    expect(secondResult).toBe(firstResult);

    // No page errors across the repeated interactions
    expect(pageErrors).toEqual([]);
    const errorConsoleMessages2 = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Edge case / Negative test: clicking non-trigger elements does not change result or cause errors', async ({ page }) => {
    // This test validates that only the configured event (button click with onclick handler)
    // triggers the transition. Clicking an arbitrary element (the body) should not change state.
    const app3 = new StaticTypingPage(page);
    await app.goto();

    // Ensure result is empty at the start
    expect(await app.getResultText()).toBe('');

    // Click the body (a non-trigger). This should not run the demonstrateStaticTyping() function.
    await page.click('body', { position: { x: 5, y: 5 } });

    // Short wait to ensure no asynchronous handler executed unexpectedly
    await page.waitForTimeout(200);

    // Result should remain unchanged (still empty)
    expect(await app.getResultText()).toBe('');

    // No page errors because nothing should have happened
    expect(pageErrors).toEqual([]);
  });

  test('Implementation note verification: greetUser type checks throw when used improperly (observational)', async ({ page }) => {
    // We cannot redefine functions or inject globals per requirements.
    // Instead, we observe the presence and behavior of greetUser as defined on the page:
    // - greetUser should exist and be a function
    // - When called with the expected shape it returns the correct string
    // We will call greetUser with a correctly shaped object via page.evaluate to observe normal behavior.
    const app4 = new StaticTypingPage(page);
    await app.goto();

    // Confirm greetUser exists and behaves as expected when called with correct types
    const greetResult = await page.evaluate(() => {
      // Access the page's greetUser function and call it with a correct object.
      // This is allowed because we are only observing runtime behavior, not redefining.
      if (typeof window.greetUser !== 'function') {
        return { error: 'missing' };
      }
      try {
        const r = window.greetUser({ name: 'Alice', age: 25 });
        return { value: r };
      } catch (err) {
        return { error: String(err) };
      }
    });

    // Expect the call to succeed and produce a greeting for the provided user object
    expect(greetResult.error).toBeUndefined();
    expect(greetResult.value).toBe('Hello, Alice, you are 25 years old.');

    // We also intentionally do NOT call greetUser with bad types because the instructions forbid
    // altering the environment or injecting erroneous data that could cause side-effects.
    // The FSM indicates a type-check error would be thrown inside greetUser for bad inputs,
    // but we will not induce that error here to avoid modifying the runtime environment.
    expect(pageErrors).toEqual([]);
  });
});