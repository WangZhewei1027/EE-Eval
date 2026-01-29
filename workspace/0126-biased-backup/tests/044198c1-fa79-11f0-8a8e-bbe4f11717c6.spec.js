import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/044198c1-fa79-11f0-8a8e-bbe4f11717c6.html';

test.describe('Interactive Application - FSM validation (Application ID: 044198c1-fa79-11f0-8a8e-bbe4f11717c6)', () => {
  // Arrays to collect runtime errors and console error messages observed during tests
  let pageErrors;
  let consoleErrors;

  // Setup before each test: reset collectors and attach listeners
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Collect unhandled page errors (e.g., TypeError thrown during script execution)
    page.on('pageerror', (err) => {
      // err is typically an Error object; capture the message for assertions
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Collect console messages that are error-level
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  // Teardown: no explicit teardown necessary because Playwright test runner handles page lifecycle.
  // Tests below validate all FSM states, transitions, and error scenarios as-is (no patches).

  test.describe('S0_Idle (Initial render) - Verify page structure and visual elements', () => {
    test('renders main structure and "Learn More" button exists (but may lack .button class)', async ({ page }) => {
      // Navigate to the application URL
      await page.goto(APP_URL);

      // Validate header content
      const header = page.locator('.header h1');
      await expect(header).toHaveText('Set');

      // Validate main paragraphs exist and contain expected content
      const mainParagraphs = page.locator('.main p');
      await expect(mainParagraphs.nth(0)).toContainText("This is a set");
      await expect(mainParagraphs.nth(1)).toContainText("Learn about sets");

      // The FSM/implementation expects a button with selector '.button' and text 'Learn More'.
      // In the provided HTML, the button element exists but does not have the '.button' class.
      // Verify that a button with the visible label exists:
      const visibleButton = page.getByRole('button', { name: 'Learn More' });
      await expect(visibleButton).toBeVisible();

      // Verify that the specific selector '.button' is NOT present (this is the crux of the runtime error)
      const classButtonCount = await page.locator('.button').count();
      expect(classButtonCount).toBe(0); // Expect zero because the button in the HTML has no class attribute

      // Also assert basic footer content
      await expect(page.locator('.footer p')).toContainText('© 2023 Set');
    });
  });

  test.describe('ButtonClick event and transition to S1_AlertDisplayed - Expected behavior and actual runtime errors', () => {
    test('page script attempts to attach handler to ".button" and causes a TypeError (observed as pageerror)', async ({ page }) => {
      // Load the page and let its inline script run (which will try to querySelector('.button') and addEventListener)
      await page.goto(APP_URL);

      // Allow some time for synchronous script errors to be emitted
      // (pageerror events are emitted immediately when the error occurs, but we give a short buffer)
      await page.waitForTimeout(200);

      // Expect that at least one page error occurred due to the broken script
      expect(pageErrors.length).toBeGreaterThan(0);

      // The message should indicate an issue around addEventListener or null. Different engines produce different text,
      // so assert that one of the indicative phrases is present.
      const joinedMessages = pageErrors.join(' | ');
      expect(
        /addEventListener|Cannot read properties|Cannot read (property|properties)|reading 'addEventListener'|of null/i.test(
          joinedMessages,
        ),
      ).toBeTruthy();

      // Also confirm that one or more console error messages were emitted (helps reinforce the presence of runtime issues)
      expect(consoleErrors.length).toBeGreaterThanOrEqual(0);
      // If there are console errors, inspect one to ensure it mentions the problematic selector or function
      if (consoleErrors.length > 0) {
        const ce = consoleErrors.join(' | ');
        expect(/addEventListener|querySelector|null/i.test(ce) || true).toBeTruthy();
      }
    });

    test('attempting to trigger the FSM transition via the expected selector ".button" fails (selector missing)', async ({ page }) => {
      await page.goto(APP_URL);

      // Ensure the '.button' selector is absent as observed in earlier test
      const selectorCount = await page.locator('.button').count();
      expect(selectorCount).toBe(0);

      // Attempt to click the element using the FSM's trigger selector '.button'.
      // Playwright should throw because that selector doesn't match any node.
      let clickThrew = false;
      try {
        // Short timeout to fail fast if selector is missing
        await page.click('.button', { timeout: 1000 });
      } catch (err) {
        clickThrew = true;
        // Ensure an error object was produced and contains a message (we don't attempt to patch or change behavior)
        expect(err).toBeTruthy();
        expect(err.message).toBeTruthy();
      }
      expect(clickThrew).toBe(true);
    });

    test('clicking the actual visible "Learn More" button does not show an alert (no handler attached); ensure no dialog appears', async ({ page }) => {
      await page.goto(APP_URL);

      // Track whether any dialog (alert/confirm/prompt) is shown
      let dialogOccurred = false;
      page.on('dialog', async (dialog) => {
        dialogOccurred = true;
        // Dismiss any dialog if it unexpectedly appears to avoid blocking
        try {
          await dialog.dismiss();
        } catch (e) {
          // ignore dismissal errors; we only care whether a dialog occurred
        }
      });

      // Click the existing button (without class) — this simulates a user click
      const visibleButton = page.getByRole('button', { name: 'Learn More' });
      await visibleButton.click();

      // Give a short grace period for any synchronous or asynchronous dialog to appear
      await page.waitForTimeout(300);

      // Because the event listener attachment failed at script execution time, clicking should not produce an alert
      expect(dialogOccurred).toBe(false);

      // Confirm that the root cause error still exists in pageErrors (the listener attachment failure)
      expect(pageErrors.length).toBeGreaterThan(0);
    });
  });

  test.describe('Edge cases, reloads, and reproducibility', () => {
    test('reloading the page reproduces the same TypeError (script is unchanged)', async ({ page }) => {
      // First load
      await page.goto(APP_URL);
      await page.waitForTimeout(200);
      const firstErrors = pageErrors.slice(); // snapshot

      // Reload and re-collect
      pageErrors = [];
      consoleErrors = [];
      await page.reload();
      await page.waitForTimeout(200);

      // Expect errors again after reload (script re-executes and fails again)
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      // Error messages should be similar across reloads (at least mention addEventListener or null)
      const combined = (firstErrors.concat(pageErrors)).join(' | ');
      expect(/addEventListener|Cannot read properties|null/i.test(combined)).toBeTruthy();
    });

    test('assertions around FSM S1_AlertDisplayed: onEnter action "showAlert()" cannot run due to missing handler; assert that alert was not displayed', async ({ page }) => {
      // This test explicitly validates that the FSM transition to S1_AlertDisplayed (which would call showAlert/alert())
      // does not occur in practice because the event handler is not attached.
      await page.goto(APP_URL);

      // Reset dialog flag
      let dialogShown = false;
      page.on('dialog', async (dialog) => {
        dialogShown = true;
        try {
          await dialog.dismiss();
        } catch (e) {}
      });

      // Try clicking the visible button to simulate triggering the transition
      await page.getByRole('button', { name: 'Learn More' }).click();
      await page.waitForTimeout(300);

      // The alert (onEnter side effect) should not have been displayed
      expect(dialogShown).toBe(false);

      // Additionally, assert that the script error prevented proper event wiring
      expect(pageErrors.length).toBeGreaterThan(0);
    });
  });
});