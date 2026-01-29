import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b342a1-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('Software Development Life Cycle - FSM tests (Application ID: f5b342a1-fa7c-11f0-adc7-178f556b1ee0)', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (log, warn, error, info, etc.)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect unhandled page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Cleanup listeners to avoid leakage between tests
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
    page.removeAllListeners('dialog');
  });

  test.describe('S0_Idle (Initial State) validations', () => {
    test('Initial render: Learn More button exists and is visible (validates S0_Idle evidence)', async ({ page }) => {
      // This test validates the S0_Idle state evidence:
      // The page should render a button with id "demo-button" and the text "Learn More".
      const demoButton = await page.locator('#demo-button');
      await expect(demoButton).toBeVisible();
      await expect(demoButton).toHaveText('Learn More');

      // Also assert some general content exists to validate page rendered
      await expect(page.locator('h1')).toHaveText('Software Development Life Cycle');

      // Verify there were no runtime page errors on initial load
      expect(pageErrors).toEqual([]);

      // Ensure console did not report any 'error' type messages during load
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors).toEqual([]);
    });

    test('Entry actions (renderPage) are not present as functions on window; verify absence', async ({ page }) => {
      // FSM mentioned an entry action renderPage() for S0_Idle.
      // The implementation does not define a global renderPage function.
      // We assert that renderPage is not defined as a function in the page context.
      const hasRenderPageFunction = await page.evaluate(() => {
        // Do not create or call renderPage — only inspect its existence
        return typeof window.renderPage === 'function';
      });
      expect(hasRenderPageFunction).toBe(false);

      // Validate that missing renderPage did not produce a pageerror (no unexpected ReferenceError on load)
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transitions and S1_AlertDisplayed validations', () => {
    test('Clicking Learn More shows an alert with the expected message (validates ButtonClick -> S1_AlertDisplayed)', async ({ page }) => {
      // This test validates the transition from S0_Idle to S1_AlertDisplayed when #demo-button is clicked.
      // We assert that an alert dialog opens with the exact message from the implementation.

      // Prepare to capture the dialog
      const dialogMessages = [];
      page.on('dialog', async (dialog) => {
        dialogMessages.push(dialog.message());
        // Accept the alert so the page can continue running
        await dialog.accept();
      });

      // Click the button which should trigger the alert
      await page.click('#demo-button');

      // Allow a tick for the dialog handler to run
      // Wait until we have captured at least one dialog message
      await page.waitForFunction(() => {
        // This code runs within the page; it cannot access dialogMessages in Node,
        // so we ensure at least that the environment is idle for the dialog handling.
        return true;
      });

      // Assert we captured exactly one dialog message and that it matches expected text
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      const expectedMessage = 'This is just a demonstration of the Software Development Life Cycle. For a more comprehensive understanding, please refer to the following resources: https://en.wikipedia.org/wiki/Software_development_life_cycle';
      expect(dialogMessages[0]).toBe(expectedMessage);

      // After the alert, the DOM should remain intact; button should still exist and be visible
      const demoButton = await page.locator('#demo-button');
      await expect(demoButton).toBeVisible();
      await expect(demoButton).toHaveText('Learn More');

      // No unexpected page errors should have been thrown during the click/alert sequence
      expect(pageErrors).toEqual([]);

      // No console.error messages should have appeared as a result of the transition
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors).toEqual([]);
    });

    test('Clicking Learn More multiple times produces multiple alerts (edge case)', async ({ page }) => {
      // This edge case validates repeated event handling and ensures each click produces an alert.
      const capturedDialogs = [];
      page.on('dialog', async (dialog) => {
        capturedDialogs.push(dialog.message());
        await dialog.accept();
      });

      // Click the button twice in succession
      await page.click('#demo-button');
      await page.click('#demo-button');

      // Give Playwright a moment to process both dialogs
      // Wait for up to a short timeout for both dialogs to be captured
      await page.waitForTimeout(200); // small pause; dialogs are handled synchronously via event

      // We expect at least two dialogs captured
      expect(capturedDialogs.length).toBeGreaterThanOrEqual(2);

      // Validate both dialogs have the expected message
      const expectedMessage = 'This is just a demonstration of the Software Development Life Cycle. For a more comprehensive understanding, please refer to the following resources: https://en.wikipedia.org/wiki/Software_development_life_cycle';
      for (const msg of capturedDialogs.slice(0, 2)) {
        expect(msg).toBe(expectedMessage);
      }

      // Ensure no page errors occurred during repeated interactions
      expect(pageErrors.length).toBe(0);
    });

    test('S1 entry action showAlert is not present as a named function; alert is invoked directly', async ({ page }) => {
      // FSM listed an entry action showAlert() for S1_AlertDisplayed.
      // The actual implementation triggers alert(...) directly inside an event listener,
      // and does not define a global showAlert function. Assert that showAlert is not defined.
      const hasShowAlertFunction = await page.evaluate(() => {
        return typeof window.showAlert === 'function';
      });
      expect(hasShowAlertFunction).toBe(false);

      // Now click the button to ensure alert still occurs (demonstrating that showAlert absence
      // does not prevent the alert from being shown because alert is called inline).
      const received = [];
      page.once('dialog', async (dialog) => {
        received.push(dialog.message());
        await dialog.accept();
      });
      await page.click('#demo-button');

      // Confirm we received the alert and it contained the expected text
      expect(received.length).toBe(1);
      const expectedText = 'This is just a demonstration of the Software Development Life Cycle. For a more comprehensive understanding, please refer to the following resources: https://en.wikipedia.org/wiki/Software_development_life_cycle';
      expect(received[0]).toBe(expectedText);

      // No page errors expected
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Error observation and related assertions', () => {
    test('No unexpected ReferenceError/SyntaxError/TypeError occurred on page load or interactions', async ({ page }) => {
      // This test explicitly asserts that there were no uncaught runtime errors captured by Playwright.
      // Note: We intentionally do not call undefined functions to provoke errors; we only observe the natural runtime.
      expect(pageErrors.length).toBe(0);

      // Ensure the console has not emitted error-level messages
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors).toEqual([]);
    });

    test('If there were any runtime errors, they should be surfaced here (keeps test informative)', async ({ page }) => {
      // This test documents any collected page errors and console error messages for debugging purposes.
      // It does not create failures beyond what has already been asserted in earlier tests.
      // If pageErrors exist, they will be included in the assertion message to help debug the application.
      if (pageErrors.length > 0) {
        // Format the errors for clearer test failure messages
        const errorMessages = pageErrors.map((e) => e.message).join(' | ');
        // Fail the test with detailed info if any page errors were captured
        expect(pageErrors.length, `Unexpected page errors: ${errorMessages}`).toBe(0);
      }

      const consoleErrorEntries = consoleMessages.filter((m) => m.type === 'error');
      if (consoleErrorEntries.length > 0) {
        const joined = consoleErrorEntries.map((c) => c.text).join(' | ');
        expect(consoleErrorEntries.length, `Unexpected console.error messages: ${joined}`).toBe(0);
      }

      // If none were present, simply assert true to record the pass
      expect(pageErrors.length).toBe(0);
      expect(consoleErrorEntries.length).toBe(0);
    });
  });
});