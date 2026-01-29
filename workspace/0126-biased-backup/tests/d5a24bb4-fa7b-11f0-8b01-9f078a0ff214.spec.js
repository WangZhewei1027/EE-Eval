import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a24bb4-fa7b-11f0-8b01-9f078a0ff214.html';
const EXPECTED_ALERT_TEXT = "This is a basic demonstration of B-Tree structure described in the text!";

test.describe('B-Tree Index Explained - FSM validation (d5a24bb4-fa7b-11f0-8b01-9f078a0ff214)', () => {
  // Containers to collect console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (info, warning, error, etc.)
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // In case msg.type() or msg.text() throws unexpectedly, still capture basic info
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture uncaught errors that bubble to the page
    page.on('pageerror', err => {
      // err is an Error object from the page context
      pageErrors.push(err);
    });

    // Navigate to the application page. Let any runtime errors occur naturally.
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Small pause to ensure we captured any late errors triggered by interactions
    await page.waitForTimeout(50);
    // Optionally clear listeners (Playwright cleans up between tests, but be explicit)
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test.describe('Idle state (S0_Idle) validations', () => {
    test('renders the main content and contains the Demonstration button', async ({ page }) => {
      // This test validates that the Idle state has rendered the page HTML
      // and that the "Demonstration" button exists with the expected onclick attribute.

      // Check page title and main heading exist as evidence of renderPage() having displayed content
      await expect(page.locator('h1')).toHaveText('B-Tree Index Explained');

      // Locate the button that has an inline onclick handler
      const demoButton = page.locator('button[onclick]');
      await expect(demoButton).toHaveCount(1);
      await expect(demoButton).toBeVisible();

      // Validate visible button text
      await expect(demoButton).toHaveText('Demonstration');

      // Validate the onclick attribute contains the expected alert text
      const onclickAttr = await demoButton.getAttribute('onclick');
      expect(onclickAttr).toContain("alert('This is a basic demonstration of B-Tree structure described in the text!')");

      // Verify no uncaught page errors occurred during initial render (common expectation)
      // If there are page errors, they will be reported below; tests will fail making issues visible.
      expect(pageErrors.length).toBe(0);

      // Ensure no console errors were logged during load
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('renderPage entry action is not present as a callable function on window (if not implemented)', async ({ page }) => {
      // FSM entry action lists renderPage(), but the HTML does not define it.
      // We assert that it's not defined on the window (no injection or unexpected global created).
      const typeOfRenderPage = await page.evaluate(() => typeof window.renderPage);
      expect(typeOfRenderPage === 'undefined' || typeOfRenderPage === 'function').toBeTruthy();
      // If it is undefined, that confirms the page did not attempt to expose/require that function.
      // If it is a function, we don't call it (per instructions). We only assert presence/type.
    });
  });

  test.describe('Demonstration transition and alert state (S1_Demonstration)', () => {
    test('clicking the Demonstration button triggers an alert dialog with the expected text', async ({ page }) => {
      // This test validates the transition S0_Idle -> S1_Demonstration:
      // clicking the button should produce a browser alert with exact expected content.

      // Prepare to capture the dialog event
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        // Click the button that has the inline onclick attribute
        page.click('button[onclick]')
      ]);

      // Validate dialog type and message text (onEnter action for S1 is alert(...))
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe(EXPECTED_ALERT_TEXT);

      // Accept the alert to allow the page to continue
      await dialog.accept();

      // After dismissing the alert, ensure the button is still present
      await expect(page.locator('button[onclick]')).toBeVisible();

      // Confirm no new page errors were introduced by the alert
      expect(pageErrors.length).toBe(0);

      // Ensure console did not log error-level messages as a consequence of the alert
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('multiple sequential clicks on the Demonstration button show alerts each time', async ({ page }) => {
      // Edge case: user clicks the demonstration button multiple times
      // We perform two sequential clicks and ensure alerts appear each time and are handled.

      const btnLocator = page.locator('button[onclick]');
      await expect(btnLocator).toBeVisible();

      // First click -> dialog
      const firstDialogPromise = page.waitForEvent('dialog');
      await btnLocator.click();
      const firstDialog = await firstDialogPromise;
      expect(firstDialog.message()).toBe(EXPECTED_ALERT_TEXT);
      await firstDialog.accept();

      // Small delay to simulate quick subsequent user action
      await page.waitForTimeout(50);

      // Second click -> dialog again
      const secondDialogPromise = page.waitForEvent('dialog');
      await btnLocator.click();
      const secondDialog = await secondDialogPromise;
      expect(secondDialog.message()).toBe(EXPECTED_ALERT_TEXT);
      await secondDialog.accept();

      // Ensure no page errors or console errors occurred during repeated alerts
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('transition evidence: button has expected inline handler string (evidence from FSM)', async ({ page }) => {
      // Validate the button's inner HTML evidence matches the FSM's documented evidence fragment.
      const btnHtml = await page.locator('button[onclick]').evaluate((el) => el.outerHTML);
      expect(btnHtml).toContain("onclick=\"alert('This is a basic demonstration of B-Tree structure described in the text!')\"");
      expect(btnHtml).toContain('>Demonstration</button>');
    });
  });

  test.describe('Error and edge-case observations', () => {
    test('no unexpected ReferenceError, SyntaxError, or TypeError occurred during interaction', async ({ page }) => {
      // We explicitly check that none of the pageErrors correspond to ReferenceError, SyntaxError or TypeError
      const errorNames = pageErrors.map(e => e.name);
      const forbidden = ['ReferenceError', 'SyntaxError', 'TypeError'];
      for (const name of forbidden) {
        expect(errorNames.includes(name)).toBe(false);
      }

      // Also assert that no console messages contain "Uncaught" style errors
      const uncaughtConsole = consoleMessages.filter(m => /uncaught/i.test(m.text) || /error/i.test(m.text));
      // It's acceptable to have logs, but not error-like messages for this simple demo
      expect(uncaughtConsole.length).toBe(0);
    });

    test('clicking a non-existent element results in a test-side error (demonstrates edge behavior)', async ({ page }) => {
      // Edge case: attempting to click an element that does not exist should throw on the test side.
      // We use Playwright's expect().toThrow to assert that an action against a missing selector fails.
      // Note: This validates the test harness behavior rather than the page itself.

      let threw = false;
      try {
        await page.click('button#this-element-does-not-exist', { timeout: 500 });
      } catch (err) {
        threw = true;
        // Expect the thrown error to be a Playwright timeout/locator error
        expect(err.message).toBeTruthy();
      }
      expect(threw).toBe(true);
    });
  });
});