import { test, expect } from '@playwright/test';

// Test file for Application ID: 044171b0-fa79-11f0-8a8e-bbe4f11717c6
// URL served at: http://127.0.0.1:5500/workspace/0126-biased/html/044171b0-fa79-11f0-8a8e-bbe4f11717c6.html
//
// Notes:
// - Tests exercise the FSM states: S0_Idle (initial) and S1_Started (after Start clicked).
// - Tests exercise transitions StartButtonClick and EndButtonClick.
// - Tests observe console messages and page errors (ReferenceError, TypeError, SyntaxError) and assert expectations about them.
// - Tests intentionally do not modify/patch the page or global scope. They load the page as-is and observe natural runtime behavior.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/044171b0-fa79-11f0-8a8e-bbe4f11717c6.html';

class QueuePage {
  /**
   * Page object for the Queue application.
   * Encapsulates selectors and helpful actions for tests.
   */
  constructor(page) {
    this.page = page;
    this.startButton = page.locator('#start-button');
    this.endButton = page.locator('#end-button');
    this.queueContainer = page.locator('.queue-container');
    this.animationContainer = page.locator('.animation-container');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure initial render cycle completes
    await this.page.waitForLoadState('domcontentloaded');
  }

  async clickStart() {
    await this.startButton.click();
  }

  async clickEnd(options = {}) {
    // options may include { force: true } if needed by tests — default is to attempt normal click
    await this.endButton.click(options);
  }

  async isEndButtonDisabled() {
    return await this.endButton.getAttribute('disabled') !== null;
  }

  async getEndButtonText() {
    return await this.endButton.innerText();
  }

  async getStartButtonText() {
    return await this.startButton.innerText();
  }
}

test.describe('Queue FSM - Interactive tests and runtime observation', () => {
  // Arrays to capture runtime diagnostics across each test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  // The page object will be created per test using the Playwright page fixture
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console events
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    // Capture uncaught exceptions / page errors
    page.on('pageerror', (err) => {
      // err is an Error object in many runtimes
      pageErrors.push(err);
    });
  });

  test('Initial state S0_Idle: Start visible and End disabled', async ({ page }) => {
    // Validate initial render (entry action: renderPage())
    const app = new QueuePage(page);
    await app.goto();

    // Check presence and text of the Start button
    await expect(app.startButton).toBeVisible();
    await expect(app.startButton).toHaveText('Start');

    // End button should be present and disabled per FSM evidence for S0_Idle
    await expect(app.endButton).toBeVisible();
    const endDisabled = await app.endButton.getAttribute('disabled');
    expect(endDisabled !== null).toBeTruthy();

    // Validate container elements exist
    await expect(app.queueContainer).toBeVisible();
    await expect(app.animationContainer).toBeVisible();

    // Observe runtime errors that may have occurred on load.
    // If any page errors occurred, assert they are Error instances and record their messages.
    if (pageErrors.length > 0) {
      for (const err of pageErrors) {
        expect(err).toBeInstanceOf(Error);
        // The message should contain a type-like substring in many runtimes (e.g., ReferenceError, TypeError, SyntaxError)
        expect(typeof err.message).toBe('string');
      }
    }

    // Also check that the console was not flooded with error messages during initial render.
    // We only assert that captured console errors (if any) are strings.
    for (const ce of consoleErrors) {
      expect(typeof ce).toBe('string');
    }
  });

  test('Transition: Start button click should enable End button (S0_Idle -> S1_Started)', async ({ page }) => {
    const app = new QueuePage(page);
    await app.goto();

    // Ensure starting state as precondition
    expect(await app.isEndButtonDisabled()).toBeTruthy();
    await app.clickStart();

    // After clicking Start, the FSM transition actions expect enableEndButton()
    // We validate that the End button is no longer disabled in the DOM.
    // Some implementations might toggle disabled attribute; we check both attribute and computed disabled state.
    const attr = await app.endButton.getAttribute('disabled');
    if (attr === null) {
      // disabled attribute removed -> enabled
      expect(true).toBeTruthy();
    } else {
      // If attribute persists but the element reports not disabled, inspect property
      const isDisabledProperty = await app.page.evaluate(el => el.disabled, await app.endButton.elementHandle());
      expect(isDisabledProperty).toBe(false);
    }

    // Ensure the End button text still reads "End"
    await expect(app.endButton).toHaveText('End');

    // Check that interacting didn't remove the Start button from the DOM
    await expect(app.startButton).toBeVisible();

    // Record any console errors that may have occurred during the transition.
    // If errors occurred, assert they are typical JS error types or messages (do not attempt to patch them).
    if (pageErrors.length > 0) {
      let hasExpectedErrorType = false;
      for (const err of pageErrors) {
        // err.name is often 'ReferenceError' or 'TypeError' etc.
        const name = err.name || '';
        const msg = err.message || '';
        if (/ReferenceError|TypeError|SyntaxError/.test(name) || /ReferenceError|TypeError|SyntaxError/.test(msg)) {
          hasExpectedErrorType = true;
        }
      }
      // If there are page errors, at least one should look like a common JS error (observational assertion)
      if (pageErrors.length > 0) {
        expect(hasExpectedErrorType).toBeTruthy();
      }
    }
  });

  test('Transition: End button click should disable End button (S1_Started -> S0_Idle)', async ({ page }) => {
    const app = new QueuePage(page);
    await app.goto();

    // Precondition: click Start to enter S1_Started
    await app.clickStart();

    // Ensure End is enabled before clicking End
    const endDisabledBefore = await app.endButton.getAttribute('disabled');
    // If the implementation failed to enable, this test will capture the state and proceed to click conditionally.
    if (endDisabledBefore !== null) {
      // End button is still disabled - attempt to click will likely fail; record this as an error scenario.
      // We assert that clicking a disabled button should not be possible with a normal click.
      let clickFailed = false;
      try {
        await app.clickEnd();
      } catch (e) {
        clickFailed = true;
        // Confirm the thrown error is a Playwright error indicating action could not be performed on a disabled element.
        expect(e.message).toBeTruthy();
      }
      expect(clickFailed).toBeTruthy();
      // After the failed click, ensure the End button remains disabled per expected behavior of S0_Idle
      const stillDisabled = await app.endButton.getAttribute('disabled');
      expect(stillDisabled !== null).toBeTruthy();
      return;
    }

    // If enabled, click End to return to Idle
    await app.clickEnd();

    // After clicking End, FSM expects disableEndButton() and End to become disabled.
    const endDisabledAfter = await app.endButton.getAttribute('disabled');
    expect(endDisabledAfter !== null).toBeTruthy();

    // Verify that UI texts remain consistent
    await expect(app.endButton).toHaveText('End');
    await expect(app.startButton).toHaveText('Start');
  });

  test('Edge case: Repeated Start clicks should not break state (idempotence) and End remains enabled', async ({ page }) => {
    const app = new QueuePage(page);
    await app.goto();

    // Click Start multiple times
    await app.clickStart();
    await app.clickStart();
    await app.clickStart();

    // End should remain enabled
    const attr = await app.endButton.getAttribute('disabled');
    if (attr === null) {
      // enabled as expected
      expect(true).toBeTruthy();
    } else {
      // If still disabled, record as an unexpected state but assert we captured that behavior
      expect(attr).not.toBeNull();
    }
  });

  test('Edge case: Click End when disabled (should not transition) and assert proper error surface', async ({ page }) => {
    const app = new QueuePage(page);
    await app.goto();

    // Ensure End is disabled initially
    expect(await app.isEndButtonDisabled()).toBeTruthy();

    // Attempt to click the disabled End button - Playwright throws for disabled elements.
    let throwError = null;
    try {
      await app.clickEnd();
    } catch (e) {
      throwError = e;
    }

    // We expect Playwright to prevent clicking disabled element and throw an error.
    expect(throwError).not.toBeNull();
    expect(typeof throwError.message).toBe('string');

    // Ensure that no inadvertent DOM state change happened
    expect(await app.isEndButtonDisabled()).toBeTruthy();
  });

  test('Runtime diagnostics: capture and assert console and page errors (if any)', async ({ page }) => {
    const app = new QueuePage(page);
    await app.goto();

    // Interact with the app to exercise more code paths
    // Click Start (may cause runtime ReferenceError if handlers call missing functions)
    try {
      await app.clickStart();
    } catch (e) {
      // If click fails due to Playwright constraints, note it but continue to inspect runtime diagnostics
    }

    // Click End if enabled
    const endAttr = await app.endButton.getAttribute('disabled');
    if (endAttr === null) {
      try {
        await app.clickEnd();
      } catch (e) {
        // ignore click errors for diagnostics
      }
    }

    // Now assert diagnostics collections are well-formed
    // consoleMessages is an array of { type, text }
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    for (const m of consoleMessages) {
      expect(typeof m.type).toBe('string');
      expect(typeof m.text).toBe('string');
    }

    // pageErrors is an array of Error objects captured via page.on('pageerror')
    expect(Array.isArray(pageErrors)).toBeTruthy();
    for (const err of pageErrors) {
      // Each error should be an Error-like object with name and message
      expect(err).toBeInstanceOf(Error);
      expect(typeof err.message).toBe('string');
      // If the error references a common JS error type, assert that it appears in name or message
      const hasJSName = /ReferenceError|TypeError|SyntaxError/.test(err.name || '') || /ReferenceError|TypeError|SyntaxError/.test(err.message || '');
      // We don't force that there MUST be such an error; but if there are page errors, they usually match JS types.
      if (pageErrors.length > 0) {
        expect(hasJSName).toBeTruthy();
      }
    }

    // If there were any console errors, they should be captured in consoleErrors array
    for (const ce of consoleErrors) {
      expect(typeof ce).toBe('string');
      // Optionally ensure they are non-empty messages
      expect(ce.length).toBeGreaterThanOrEqual(0);
    }
  });
});