import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a224a3-fa7b-11f0-8b01-9f078a0ff214.html';

test.describe('Understanding Monitors in Concurrency - FSM verification (d5a224a3-fa7b-11f0-8b01-9f078a0ff214)', () => {
  // Arrays to collect runtime observations per test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset collectors for each test
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for later inspection
    page.on('console', (msg) => {
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
        });
      } catch (e) {
        // best-effort, do not interfere with page runtime
      }
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (error) => {
      // store name and message for assertions
      pageErrors.push({
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    });

    // Navigate to the provided HTML page exactly as-is
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Remove listeners to avoid cross-test interference (Playwright automatically cleans up the page between tests,
    // but we keep this here to be explicit and safe).
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test.describe('State: S0_Idle (Initial render)', () => {
    test('Initial page renders and Idle state shows expected UI elements', async ({ page }) => {
      // This test validates that the page renders the expected headline and the button exists.
      // It also verifies that no unexpected page runtime errors occurred during initial load.
      const heading = await page.locator('header h1').textContent();
      expect(heading).toContain('Understanding Monitors in Concurrency');

      // The FSM's S0_Idle evidence expects a button with an onclick attribute.
      const button = page.locator('button[onclick]');
      await expect(button).toBeVisible();

      // Validate the button text content is as expected.
      const buttonText = (await button.textContent())?.trim();
      expect(buttonText).toBe('Trigger Simple Demonstration');

      // Verify that the onclick attribute exists and contains the expected alert invocation.
      const onclickAttr = await button.getAttribute('onclick');
      expect(onclickAttr).toBe(
        "alert('Simple demonstration triggered! This would normally show an example of how monitors work in practice.')"
      );

      // Verify that there were no uncaught runtime errors on page load by default.
      expect(pageErrors.length).toBe(0);

      // The FSM listed an entry action renderPage() for S0. The HTML does not define this function.
      // We assert that window.renderPage is undefined (we do NOT inject or modify anything).
      const renderPageType = await page.evaluate(() => typeof window.renderPage);
      expect(renderPageType).toBe('undefined');
    });
  });

  test.describe('Event: ButtonClick and Transition S0 -> S1', () => {
    test('Clicking the button triggers the demonstration alert (S1 entry action)', async ({ page }) => {
      // This test validates the reported transition: clicking the button should trigger an alert with the expected message.
      // We capture the dialog event triggered by the button click.
      const expectedAlertText =
        'Simple demonstration triggered! This would normally show an example of how monitors work in practice.';

      // Use Promise.all to ensure we wait for the dialog that the click will produce.
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('button[onclick]'),
      ]);

      // Verify dialog type and message
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe(expectedAlertText);

      // Accept the alert to allow further interactions.
      await dialog.accept();

      // After the transition, ensure no unexpected runtime errors were produced by the action.
      expect(pageErrors.length).toBe(0);

      // The button should still be present after the alert (no DOM removal in this app).
      await expect(page.locator('button[onclick]')).toBeVisible();
    });

    test('Repeated rapid clicks each produce their own alert dialogs', async ({ page }) => {
      // This test validates that multiple activations generate repeated S1 entry actions (alert) each time.
      const clickCount = 3;
      const seenDialogs = [];

      for (let i = 0; i < clickCount; i++) {
        const [dialog] = await Promise.all([
          page.waitForEvent('dialog'),
          page.click('button[onclick]'),
        ]);
        seenDialogs.push({
          type: dialog.type(),
          message: dialog.message(),
        });
        await dialog.accept();
      }

      // All dialogs should be alerts and have the expected message content.
      expect(seenDialogs.length).toBe(clickCount);
      for (const d of seenDialogs) {
        expect(d.type).toBe('alert');
        expect(d.message).toContain('Simple demonstration triggered!');
      }

      // No runtime page errors should result from repeated clicks in this implementation.
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Clicking a non-existent selector should raise an actionable error from Playwright', async ({ page }) => {
      // This test demonstrates an edge case where a test tries to act on a selector that is not present.
      // We assert that Playwright will throw when trying to click a non-existing element.
      // This is not a page runtime error — it is a test/runtime error exposed by Playwright.
      let caught = false;
      try {
        await page.click('button#this-does-not-exist', { timeout: 1000 });
      } catch (err) {
        caught = true;
        // Ensure the thrown error message mentions that the element could not be found or click failed.
        expect(String(err.message)).toMatch(/could not|No node found|waiting for selector/i);
      }
      expect(caught).toBe(true);
    });

    test('Check for runtime ReferenceError/SyntaxError/TypeError occurrences (if any)', async ({ page }) => {
      // This test inspects collected page errors looking specifically for ReferenceError, SyntaxError, or TypeError
      // that may happen naturally in the loaded page. We do not inject or alter the runtime; we only observe.
      const problematic = pageErrors.filter((e) =>
        ['ReferenceError', 'SyntaxError', 'TypeError'].includes(e.name)
      );

      // In this HTML implementation there are no such runtime errors expected.
      // We assert that none occurred. If any do occur naturally, this assertion will fail and reveal them.
      expect(problematic.length).toBe(0);
    });

    test('Invoking the button via DOM click() produces the same alert dialog', async ({ page }) => {
      // This test checks that programmatically invoking the button's click() (instead of page.click) still triggers the alert.
      const expectedAlertText =
        'Simple demonstration triggered! This would normally show an example of how monitors work in practice.';

      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.evaluate(() => {
          const btn = document.querySelector('button[onclick]');
          // Call DOM click() directly; we do not redefine anything.
          if (btn) btn.click();
        }),
      ]);

      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe(expectedAlertText);
      await dialog.accept();

      // No runtime errors should have been recorded as a result of this programmatic click.
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Observability assertions (console & pageerror collection)', () => {
    test('Console messages and page errors can be observed; none unexpected at baseline', async ({ page }) => {
      // This test demonstrates that console logs and page errors were being captured.
      // Confirm arrays exist and are the ones we inspected in other tests.
      expect(Array.isArray(consoleMessages)).toBe(true);
      expect(Array.isArray(pageErrors)).toBe(true);

      // At baseline load the application should not emit console error messages.
      const consoleErrorMessages = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrorMessages.length).toBe(0);

      // No uncaught page errors were recorded at baseline load.
      expect(pageErrors.length).toBe(0);
    });
  });
});