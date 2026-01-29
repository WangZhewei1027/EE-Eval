import { test, expect } from '@playwright/test';

// Test file for: ed90afe1-fa77-11f0-8492-31e949ed3c7c
// Serves the HTML at:
// http://127.0.0.1:5500/workspace/0126-biased/html/ed90afe1-fa77-11f0-8492-31e949ed3c7c.html

// Page Object for the Authentication Design Sample
class AuthPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url =
      'http://127.0.0.1:5500/workspace/0126-biased/html/ed90afe1-fa77-11f0-8492-31e949ed3c7c.html';
  }

  async goto() {
    await this.page.goto(this.url);
  }

  async headerText() {
    return this.page.textContent('h1');
  }

  async paragraphText() {
    return this.page.textContent('p');
  }

  async learnMoreButton() {
    return this.page.locator('.button');
  }

  async clickLearnMore() {
    const btn = await this.learnMoreButton();
    await btn.click();
  }

  async observeActionSource() {
    return this.page.evaluate(() => {
      // Access the function source if present
      if (typeof observeAction === 'function') return observeAction.toString();
      return null;
    });
  }
}

test.describe('Authentication Design Sample - FSM validation', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console events
    page.on('console', (msg) => {
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
        });
      } catch (e) {
        // swallow listener issues
      }
    });

    // Collect uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // cleanup arrays (not strictly necessary, but keeps state isolated)
    consoleMessages = [];
    pageErrors = [];
  });

  test('Initial Idle state: page renders expected elements (S0_Idle)', async ({ page }) => {
    // Validate the initial "Idle" state: elements rendered and visible
    const auth = new AuthPage(page);
    await auth.goto();

    // Assert header and paragraph text are present as described in the HTML
    await expect(auth.headerText()).resolves.toBe('Secure Authentication');
    await expect(auth.paragraphText()).resolves.toContain(
      'Experience seamless and secure login'
    );

    // Assert the "Learn More" button exists and is visible with correct label
    const button = await auth.learnMoreButton();
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Learn More');

    // There should be no uncaught page errors immediately after load
    expect(pageErrors.length).toBe(0);

    // Ensure no unexpected console errors on load
    const errorConsole = consoleMessages.find((m) => m.type === 'error');
    expect(errorConsole).toBeUndefined();
  });

  test('FSM S0 entry action "renderPage()" is not defined and invoking it triggers ReferenceError', async ({
    page,
  }) => {
    // This test intentionally attempts to invoke the renderPage() function that the FSM
    // declares as an entry action but the page does not implement. We assert a ReferenceError.
    const auth = new AuthPage(page);
    await auth.goto();

    // Calling renderPage() inside page.evaluate should reject.
    let caughtError = null;
    try {
      // Do not catch inside page.evaluate; let the evaluate call reject so we can assert.
      await page.evaluate(() => {
        // Intentionally call the function that does not exist in the environment
        // to reproduce the ReferenceError described by the FSM mismatch.
        // This will cause the evaluate promise to reject.
        // eslint-disable-next-line no-undef
        return renderPage();
      });
    } catch (err) {
      caughtError = err;
    }

    // We expect an error was thrown and it is a ReferenceError-like message about renderPage
    expect(caughtError).not.toBeNull();
    // The exact message varies by engine but should mention 'renderPage' and 'not defined' or 'is not defined'
    const msg = String(caughtError.message || caughtError);
    expect(msg.toLowerCase()).toContain('renderpage');
    expect(
      msg.toLowerCase().includes('not defined') ||
        msg.toLowerCase().includes('is not defined') ||
        msg.toLowerCase().includes('is not a function')
    ).toBeTruthy();
  });

  test('Clicking "Learn More" triggers the alert (S0_Idle -> S1_AlertShown transition)', async ({
    page,
  }) => {
    // Validate the transition that clicking the button shows the expected alert dialog.
    const auth = new AuthPage(page);
    await auth.goto();

    // Ensure the observeAction function is present as a function before click
    const src = await auth.observeActionSource();
    expect(typeof src).toBe('string');
    expect(src).toContain('Visuals and design are key');

    // Listen for the dialog that should appear when clicking the button.
    let dialogMessage = null;
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Click the Learn More button to trigger the alert
    await auth.clickLearnMore();

    // Wait briefly for the dialog handler to run
    await page.waitForTimeout(100);

    // Assert we got the expected alert message exactly as implemented in the page
    expect(dialogMessage).toBe(
      'Visuals and design are key! \nThank you for observing.'
    );

    // After transition, ensure no uncaught page errors were reported during this flow
    expect(pageErrors.length).toBe(0);
  });

  test('Clicking "Learn More" twice produces two alerts (edge case)', async ({ page }) => {
    // Edge case: user clicks the button multiple times quickly.
    // The page code uses an alert on each click; we expect two dialogs to appear sequentially.
    const auth = new AuthPage(page);
    await auth.goto();

    const messages = [];
    page.on('dialog', async (dialog) => {
      messages.push(dialog.message());
      // accept to allow subsequent dialogs
      await dialog.accept();
    });

    const btn = await auth.learnMoreButton();
    // Perform two rapid clicks
    await btn.click();
    await btn.click();

    // Give time for both dialogs to be emitted and handled
    await page.waitForTimeout(200);

    // Expect two dialogs/messages with the same content
    expect(messages.length).toBe(2);
    for (const m of messages) {
      expect(m).toBe('Visuals and design are key! \nThank you for observing.');
    }
  });

  test('observeAction function source contains expected alert text (evidence verification)', async ({
    page,
  }) => {
    // Verify the function implementation matches the FSM evidence (string content).
    const auth = new AuthPage(page);
    await auth.goto();

    const src = await auth.observeActionSource();
    expect(src).toBeTruthy();
    // The source should include the alert string with the newline and thank-you message.
    expect(src).toContain('Visuals and design are key!');
    expect(src).toContain('Thank you for observing');
  });

  test('Asynchronous uncaught ReferenceError is surfaced via pageerror (error observation)', async ({
    page,
  }) => {
    // This test intentionally schedules an async call to a non-existent function
    // so that the error is uncaught in page context and is reported via the 'pageerror' event.
    const auth = new AuthPage(page);
    await auth.goto();

    // Clear any previous errors
    pageErrors = [];

    // Schedule an async call that will throw an uncaught ReferenceError
    await page.evaluate(() => {
      // This will run in the page context asynchronously and cause an uncaught exception
      setTimeout(() => {
        // eslint-disable-next-line no-undef
        nonExistentFunctionForTest(); // intentionally undefined
      }, 0);
    });

    // Wait for the pageerror event to be propagated and collected via the listener
    await page.waitForTimeout(200);

    // We expect at least one page error captured
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // The most recent error should reference the missing function name
    const err = pageErrors.find((e) =>
      String(e.message || '').includes('nonExistentFunctionForTest')
    );
    expect(err).toBeTruthy();
    // Ensure it's a ReferenceError-like message
    const errMsg = String(err.message || '');
    expect(
      errMsg.toLowerCase().includes('not defined') ||
        errMsg.toLowerCase().includes('is not defined') ||
        errMsg.toLowerCase().includes('nonexistent')
    ).toBeTruthy();
  });

  test('Console messages are captured and contain no unexpected errors during interactions', async ({
    page,
  }) => {
    // Test ensures console messages are observed; also acts as integration check during interactions.
    const auth = new AuthPage(page);
    await auth.goto();

    // Create a console message from within the page to ensure listener is working.
    await page.evaluate(() => {
      console.log('PLAYWRIGHT_TEST_LOG: init-success');
    });

    // Click button to trigger alert and a subsequent console.log
    page.once('dialog', async (d) => {
      await d.accept();
    });

    // After clicking, log another message
    await page.evaluate(() => {
      // No-ops: ensure we can still log after potential dialog interactions
      console.log('PLAYWRIGHT_TEST_LOG: before-click');
    });

    const btn = await auth.learnMoreButton();
    await btn.click();

    await page.waitForTimeout(100);

    // Confirm our custom console logs were captured
    const foundInit = consoleMessages.find((m) =>
      m.text?.includes('PLAYWRIGHT_TEST_LOG: init-success')
    );
    const foundBefore = consoleMessages.find((m) =>
      m.text?.includes('PLAYWRIGHT_TEST_LOG: before-click')
    );
    expect(foundInit).toBeTruthy();
    expect(foundBefore).toBeTruthy();

    // Ensure there are no console.error messages generated during this flow
    const anyConsoleError = consoleMessages.some((m) => m.type === 'error');
    expect(anyConsoleError).toBe(false);
  });
});