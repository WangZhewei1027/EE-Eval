import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a1d683-fa7b-11f0-8b01-9f078a0ff214.html';

test.describe('Understanding Space Complexity - FSM validation (d5a1d683-fa7b-11f0-8b01-9f078a0ff214)', () => {
  // Arrays to collect console messages and page errors for each test run.
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset collections before each test.
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages for inspection.
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // Capture uncaught exceptions on the page.
    page.on('pageerror', (err) => {
      // err is an Error object; capture its message for assertions.
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Navigate to the page under test.
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Ensure any unexpected dialogs do not hang subsequent tests.
    // Accept any open dialogs (defensive): use waitForEvent with short timeout.
    try {
      // Try to accept a dialog if one appears momentarily.
      const dialog = await page.waitForEvent('dialog', { timeout: 200 }).catch(() => null);
      if (dialog) await dialog.accept();
    } catch {
      // no-op
    }
  });

  test.describe('Initial Render (S0_Idle) validations', () => {
    test('renders main headings, content, and the demonstration button (Idle state)', async ({ page }) => {
      // Validate static content and presence of button expected in the Idle state.
      // This asserts evidence of S0_Idle: button with onclick and page text.
      await expect(page.locator('h1')).toHaveText('Understanding Space Complexity');
      await expect(page.locator('h2')).toContainText('What is Space Complexity?');

      const button = page.locator('button[onclick]');
      await expect(button).toHaveCount(1);
      await expect(button).toBeVisible();
      await expect(button).toHaveText('Click for a simple demonstration');

      // The button should have the inline onclick attribute exactly as in the HTML.
      const onclickAttr = await button.getAttribute('onclick');
      expect(onclickAttr).toBe("alert('This is a demonstration of space complexity!')");

      // Verify there were no page-level uncaught errors on initial load.
      expect(pageErrors.length).toBe(0);

      // Verify that renderPage() was not unexpectedly called (no ReferenceError for renderPage).
      // The FSM mentioned renderPage() as an entry action, but the HTML does not call it.
      // We assert that no ReferenceError mentioning renderPage occurred.
      const foundRenderPageRefError = pageErrors.some(msg => msg.includes('renderPage'));
      expect(foundRenderPageRefError).toBe(false);

      // Ensure no console.error messages were reported during load.
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Transition: ButtonClick -> Demonstration (S0_Idle to S1_Demonstration)', () => {
    test('clicking the demonstration button shows an alert with the expected message', async ({ page }) => {
      // Locate button and click it. Expect a dialog with the expected message as evidence of S1_Demonstration entry action.
      const button = page.locator('button[onclick]');
      await expect(button).toBeVisible();

      // Trigger the click and wait for the dialog event.
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        button.click()
      ]);

      // The FSM expects an alert with this exact message.
      expect(dialog.message()).toBe('This is a demonstration of space complexity!');

      // Accept the alert to proceed.
      await dialog.accept();

      // After accepting, ensure no uncaught page errors were thrown as a result.
      expect(pageErrors.length).toBe(0);

      // Also ensure that the console did not record unexpected errors during the transition.
      expect(consoleErrors.length).toBe(0);
    });

    test('repeated clicks produce repeated alerts (Demonstration state is re-entrant)', async ({ page }) => {
      const button = page.locator('button[onclick]');
      await expect(button).toBeVisible();

      // Click twice and verify two dialogs appear with the same message.
      const dialogs = [];
      // First click
      const promise1 = page.waitForEvent('dialog');
      await button.click();
      const d1 = await promise1;
      dialogs.push(d1);
      await d1.accept();

      // Second click
      const promise2 = page.waitForEvent('dialog');
      await button.click();
      const d2 = await promise2;
      dialogs.push(d2);
      await d2.accept();

      // Validate both dialogs had the exact expected message.
      expect(dialogs.length).toBe(2);
      for (const dlg of dialogs) {
        expect(dlg.message()).toBe('This is a demonstration of space complexity!');
      }

      // Ensure no page errors were recorded as a result of repeated interactions.
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('activating the button via keyboard triggers the same alert (accessibility/edge case)', async ({ page }) => {
      const button = page.locator('button[onclick]');
      await button.focus();

      // Trigger activation using Enter key (should fire a click).
      const dialogPromise = page.waitForEvent('dialog');
      await page.keyboard.press('Enter');
      const dialog = await dialogPromise;
      expect(dialog.message()).toBe('This is a demonstration of space complexity!');
      await dialog.accept();

      // Also test Space key triggers it.
      const dialogPromise2 = page.waitForEvent('dialog');
      await page.keyboard.press(' ');
      const dialog2 = await dialogPromise2;
      expect(dialog2.message()).toBe('This is a demonstration of space complexity!');
      await dialog2.accept();

      // Verify no unexpected errors occurred.
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error observations', () => {
    test('there are no syntax/runtime errors on page load or during normal interactions', async ({ page }) => {
      // We performed interactions in previous tests, but here we re-check the current arrays in this session.
      // Asserting that the page executed without producing SyntaxError/ReferenceError/TypeError.
      const errorKindsToDetect = ['ReferenceError', 'SyntaxError', 'TypeError'];

      // Combine messages from pageErrors and consoleErrors for inspection.
      const combinedMessages = [...pageErrors, ...consoleErrors];

      // Ensure none of the common fatal JS errors were captured.
      for (const kind of errorKindsToDetect) {
        const found = combinedMessages.some(msg => msg.includes(kind) || msg.includes(kind.replace('Error','')));
        expect(found).toBe(false);
      }

      // Also assert that no console.error was emitted.
      expect(consoleErrors.length).toBe(0);
    });

    test('page displays meaningful educational content even if JS features are limited', async ({ page }) => {
      // The educational content should still be present in the DOM regardless of JS runtime issues.
      await expect(page.locator('h1')).toHaveText('Understanding Space Complexity');
      await expect(page.locator('.example')).toHaveCount(2);
    });

    test('no hidden modifications or unexpected global errors occur when clicking the demo button', async ({ page }) => {
      const button = page.locator('button[onclick]');
      // Click and accept the dialog; afterwards ensure still no errors were recorded.
      const dialogPromise = page.waitForEvent('dialog');
      await button.click();
      const dialog = await dialogPromise;
      await dialog.accept();

      // No pageerrors expected.
      expect(pageErrors.length).toBe(0);

      // No console errors emitted.
      expect(consoleErrors.length).toBe(0);

      // Confirm the DOM remains intact: button still exists and is visible.
      await expect(button).toBeVisible();
      await expect(button).toHaveText('Click for a simple demonstration');
    });
  });
});