import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a35d22-fa7b-11f0-8b01-9f078a0ff214.html';

test.describe('d5a35d22-fa7b-11f0-8b01-9f078a0ff214 - K-Means Clustering Interactive App', () => {
  // Shared state for listeners collected each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors for console messages and page errors
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // collect console messages (type, text)
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // collect Error objects thrown in the page context
      pageErrors.push({ name: err.name, message: err.message, stack: err.stack });
    });

    // Navigate to the application page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Nothing to teardown beyond automatic Playwright cleanup.
    // We preserve collected consoleMessages/pageErrors per test for assertions.
  });

  test.describe('State S0_Idle (Initial state)', () => {
    test('Idle: Page renders expected static content and the demo trigger button exists', async ({ page }) => {
      // Validate major headings and content to ensure the page rendered (renderPage() was an FSM entry action, but not necessarily present)
      const heading = await page.locator('h1').innerText();
      expect(heading).toContain('K-Means Clustering');

      // Verify the demo trigger button exists, is visible, has expected text and onclick attribute
      const button = page.locator('.button');
      await expect(button).toBeVisible();
      await expect(button).toHaveText('Trigger Simple Demo');

      const onclickAttr = await button.getAttribute('onclick');
      // The HTML evidence shows an inline onclick with an alert call; assert it matches the expected snippet.
      expect(onclickAttr).toBe("alert('K-Means clustering demonstration triggered!')");

      // Ensure no alert/dialog popped up on initial load
      // (If an alert had run on load, Playwright would have emitted a dialog which we didn't accept — but since we didn't register a handler for load, we just verify there are no outstanding page errors)
      expect(pageErrors.length).toBe(0);

      // Assert that no console error-level messages exist on load (collect any console messages with type 'error')
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Event: TriggerDemo and State S1_DemoTriggered (Transition testing)', () => {
    test('TriggerDemo: clicking the button shows the expected alert and transitions to DemoTriggered', async ({ page }) => {
      // This test validates the transition from S0_Idle -> S1_DemoTriggered by asserting the alert dialog is shown with the expected message.
      let dialogSeen = 0;
      page.once('dialog', async (dialog) => {
        try {
          expect(dialog.type()).toBe('alert');
          expect(dialog.message()).toBe('K-Means clustering demonstration triggered!');
        } finally {
          // Accept the alert to allow further interactions
          await dialog.accept();
          dialogSeen++;
        }
      });

      // Click the button to trigger the demo alert
      await page.click('.button');

      // Give microtask loop a tick to ensure dialog handler executed
      await page.waitForTimeout(50);

      // Ensure the dialog was seen exactly once for this click
      expect(dialogSeen).toBe(1);

      // Verify no unexpected page errors after triggering the demo
      const criticalErrors = pageErrors.filter(e => ['ReferenceError', 'SyntaxError', 'TypeError'].includes(e.name));
      // If any critical errors exist, fail the test — for this correct implementation we expect none.
      expect(criticalErrors.length).toBe(0);
    });

    test('TriggerDemo: rapid repeated activation (click twice) produces two alerts sequentially', async ({ page }) => {
      // This test validates behavior under repeated interactions (edge case).
      let seenDialogs = [];

      // Helper to register a one-time dialog listener that records the message
      const waitForNextAlert = () =>
        new Promise<void>((resolve) => {
          page.once('dialog', async (dialog) => {
            try {
              expect(dialog.type()).toBe('alert');
              seenDialogs.push(dialog.message());
            } finally {
              await dialog.accept();
              resolve();
            }
          });
        });

      // First click
      const p1 = waitForNextAlert();
      await page.click('.button');
      await p1;

      // Second click
      const p2 = waitForNextAlert();
      await page.click('.button');
      await p2;

      // We expect two alerts with identical messages in sequence
      expect(seenDialogs.length).toBe(2);
      expect(seenDialogs[0]).toBe('K-Means clustering demonstration triggered!');
      expect(seenDialogs[1]).toBe('K-Means clustering demonstration triggered!');

      // Confirm that no page-level critical errors occurred during repeated interaction
      const criticalErrors = pageErrors.filter(e => ['ReferenceError', 'SyntaxError', 'TypeError'].includes(e.name));
      expect(criticalErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Edge Case: invoking a non-existent function in page context produces a ReferenceError (natural page error)', async ({ page }) => {
      // This test intentionally executes code in the page context that references a non-existent function
      // so that a ReferenceError occurs naturally in the page/runtime. We do not patch or redefine any functions.
      // We will observe the pageerror event and assert that a ReferenceError was emitted.

      // Prepare a promise which resolves when a pageerror matching ReferenceError is seen (or times out)
      const errorPromise = new Promise((resolve) => {
        const onError = (err) => {
          // Only resolve on a ReferenceError; ignore other errors for this test
          if (err.name === 'ReferenceError') {
            page.off('pageerror', onError);
            resolve(err);
          }
        };
        page.on('pageerror', onError);
        // Safety timeout: if nothing fires, resolve with null after a short duration
        setTimeout(() => {
          page.off('pageerror', onError);
          resolve(null);
        }, 2000);
      });

      // Execute code that will throw a ReferenceError in the page context.
      // We expect page.evaluate to reject in Node because the evaluated code throws.
      let evalThrown = false;
      try {
        await page.evaluate(() => {
          // Intentionally call a non-existent function to cause ReferenceError in the page.
          // This is done purely to observe natural runtime errors — no patching or fixing is performed.
          nonExistentFunctionTriggeredByTest();
        });
      } catch (err) {
        evalThrown = true;
        // The thrown error here is the propagation of the page exception to the test context.
        // We continue to rely on the pageerror event for the in-page Error object.
      }

      // Await the captured pageerror if any
      const capturedError = await errorPromise;

      // The evaluate call should have thrown due to the ReferenceError in page context
      expect(evalThrown).toBe(true);

      // Assert that a ReferenceError was observed in the page
      expect(capturedError).not.toBeNull();
      expect(capturedError.name).toBe('ReferenceError');
      // The message should reference the missing identifier (exact message may vary by engine, but check presence of identifier)
      expect(capturedError.message).toContain('nonExistentFunctionTriggeredByTest');

      // Also ensure that our pageErrors collector captured the error
      const matched = pageErrors.find(e => e.name === 'ReferenceError' && e.message.includes('nonExistentFunctionTriggeredByTest'));
      expect(matched).toBeTruthy();
    });

    test('Edge Case: if any page errors exist they should be standard JS error types (ReferenceError, SyntaxError, TypeError)', async ({ page }) => {
      // This test will examine any collected page errors and assert they are standard JS runtime error types.
      // It's a general validation of the types of page errors emitted during tests.
      // Note: This test is tolerant if there are zero page errors.

      // Map any existing errors to their names
      const errorNames = pageErrors.map(e => e.name);

      // Ensure each error name (if present) is one of the expected JavaScript error types
      for (const name of errorNames) {
        expect(['ReferenceError', 'SyntaxError', 'TypeError', 'RangeError', 'URIError', 'EvalError'].includes(name)).toBe(true);
      }
    });
  });

  test.describe('FSM evidence assertions', () => {
    test('Evidence: the inline onclick attribute and alert message match FSM evidence', async ({ page }) => {
      // This test cross-checks DOM evidence described in the FSM with the actual DOM attributes and runtime alert.
      const button = page.locator('.button');
      const onclick = await button.getAttribute('onclick');
      expect(onclick).toBe("alert('K-Means clustering demonstration triggered!')");

      // Trigger the button and assert the dialog message equals the FSM's expected observable
      const dialogPromise = page.waitForEvent('dialog');
      await button.click();
      const dialog = await dialogPromise;
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe('K-Means clustering demonstration triggered!');
      await dialog.accept();
    });
  });
});