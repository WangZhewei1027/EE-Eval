import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a1af71-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object for the demo page to encapsulate queries and actions
class BacktrackingDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('button');
    this.heading = page.locator('h1');
    this.contentContainer = page.locator('.content');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getButtonText() {
    return this.button.innerText();
  }

  async getOnclickAttribute() {
    return this.button.getAttribute('onclick');
  }

  async clickDemoButton() {
    // Wait for clickability then click
    await this.button.waitFor({ state: 'visible' });
    return this.button.click();
  }

  async getHeadingText() {
    return this.heading.innerText();
  }

  async isContentVisible() {
    return this.contentContainer.isVisible();
  }

  async hasRenderPageFunction() {
    return this.page.evaluate(() => typeof window.renderPage !== 'undefined');
  }
}

test.describe('Backtracking Demo Application - FSM validation', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console events and capture them
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Listen to page-level uncaught exceptions
    page.on('pageerror', (err) => {
      // Capture error message (could be ReferenceError, TypeError, etc.)
      pageErrors.push(err.message || String(err));
    });
  });

  test.afterEach(async ({ page }) => {
    // Helpful debugging: print captured console messages on failure (Playwright shows them too).
    // Do not modify runtime or page environment; only observe.
    if (pageErrors.length > 0) {
      // Intentionally keep as an expect(false) in tests that need to assert errors exist.
      // Otherwise, tests below will assert the expected state.
    }
  });

  test.describe('State S0_Idle (Initial state)', () => {
    // Validate that the page renders expected static content and that the "idle" state
    // reflects the expected DOM evidence.
    test('Idle state renders page content and shows the demonstration button', async ({ page }) => {
      const demo = new BacktrackingDemoPage(page);

      // Navigate to the page (entry into S0_Idle)
      await demo.goto();

      // Assert the main content is visible
      await expect(demo.contentContainer).toBeVisible();

      // Assert heading text present and correct (basic sanity check)
      await expect(demo.heading).toHaveText('Understanding Backtracking');

      // Assert the demo button exists and has the expected label text
      await expect(demo.button).toBeVisible();
      const btnText = await demo.getButtonText();
      expect(btnText).toBe('Click for a Simple Demonstration');

      // Verify the inline onclick attribute exists and contains the expected alert text evidence
      const onclickAttr = await demo.getOnclickAttribute();
      expect(onclickAttr).toBeTruthy();
      expect(onclickAttr).toContain("alert('Backtracking demonstration is a complex exercise!");

      // Verify that there is no globally defined renderPage function on the page.
      // FSM entry action for S0_Idle listed renderPage(), but the HTML does not define it.
      // We assert the actual runtime shape: renderPage should be undefined.
      const hasRenderPage = await demo.hasRenderPageFunction();
      expect(hasRenderPage).toBe(false);

      // Assert no uncaught page errors occurred during initial render (expected for a well-formed page)
      expect(pageErrors).toEqual([]);
      // Also assert there are no console errors
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    // Edge case: Verify clicking somewhere that is not the button does not trigger the alert transition.
    test('Clicking non-button area does not trigger demonstration alert', async ({ page }) => {
      const demo = new BacktrackingDemoPage(page);
      await demo.goto();

      // Click on the content container (not the button). This should not produce a dialog.
      // We will watch for dialogs for a short period to assert none were produced.
      let dialogFired = false;
      const dialogHandler = () => { dialogFired = true; };
      page.on('dialog', dialogHandler);

      // Click an innocuous element (the content wrapper)
      await demo.contentContainer.click();

      // Allow a brief moment for any unexpected dialogs to surface
      await page.waitForTimeout(200);

      page.off('dialog', dialogHandler);
      expect(dialogFired).toBe(false);
      // Still ensure no runtime errors were generated from such a click
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Transition: ClickForDemonstration -> S1_DemonstrationAlert', () => {
    // Validate that clicking the demonstration button triggers the alert (entry action for S1)
    test('Clicking the demo button displays the expected alert dialog (S1_DemonstrationAlert entry action)', async ({ page }) => {
      const demo = new BacktrackingDemoPage(page);
      await demo.goto();

      // Prepare to capture the dialog resulting from the onclick alert
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        demo.clickDemoButton()
      ]);

      // Verify dialog message matches the FSM evidence exactly
      const expectedMessage = "Backtracking demonstration is a complex exercise! Explore algorithms like N-Queens in detail through coding platforms and textbooks.";
      expect(dialog.message()).toBe(expectedMessage);

      // Dismiss the alert as would a user
      await dialog.dismiss();

      // After dismissing, ensure no unexpected page errors were produced by the interaction
      expect(pageErrors).toEqual([]);
    });

    // Edge case: Click the button multiple times sequentially (dismiss each alert) - ensure behavior is consistent
    test('Sequential clicks produce repeated alerts with identical messages and no accumulation errors', async ({ page }) => {
      const demo = new BacktrackingDemoPage(page);
      await demo.goto();

      const expectedMessage = "Backtracking demonstration is a complex exercise! Explore algorithms like N-Queens in detail through coding platforms and textbooks.";

      // First click
      const [dialog1] = await Promise.all([
        page.waitForEvent('dialog'),
        demo.clickDemoButton()
      ]);
      expect(dialog1.message()).toBe(expectedMessage);
      await dialog1.dismiss();

      // Second click (after first dismissed)
      const [dialog2] = await Promise.all([
        page.waitForEvent('dialog'),
        demo.clickDemoButton()
      ]);
      expect(dialog2.message()).toBe(expectedMessage);
      await dialog2.dismiss();

      // No uncaught errors should have occurred during the sequence
      expect(pageErrors).toEqual([]);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    // Negative/robustness test: Ensure that clicking while a dialog is open will not cause an unhandled exception.
    test('Attempting to click the button while a dialog is open is gracefully handled by the browser', async ({ page }) => {
      const demo = new BacktrackingDemoPage(page);
      await demo.goto();

      // Start the click and wait for the dialog
      const clickAndDialog = page.waitForEvent('dialog').then(async (dialog) => {
        // While dialog is open, attempt to click the button again.
        // In most browsers alerts are modal and further clicks won't trigger additional events until dismissed.
        // We assert that no exceptions are thrown by this attempt, and that only one dialog is active.
        let secondDialogFired = false;
        const secondDialogListener = () => { secondDialogFired = true; };
        page.on('dialog', secondDialogListener);

        // Attempt extra click - may be ignored by browser while dialog is present
        try {
          await demo.clickDemoButton();
        } catch (e) {
          // Some browsers block interactions while modal dialogs are present; catching any playright/internal error is okay.
        }

        // brief pause to allow any unexpected dialogs to surface
        await page.waitForTimeout(200);
        page.off('dialog', secondDialogListener);

        // Dismiss the original dialog
        await dialog.dismiss();

        // Assert that no second dialog unexpectedly appeared
        expect(secondDialogFired).toBe(false);
      });

      // Trigger the initial dialog by clicking
      await demo.clickDemoButton();
      // Wait for internal assertion flow to finish
      await clickAndDialog;

      // Final check: no uncaught errors
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('FSM entry/exit actions validation and error observation', () => {
    // Validate that S0 entry action (renderPage()) is not present as a global function,
    // and that S1 entry action (alert) happens only upon clicking the button.
    test('S0 entry action renderPage() is not defined and no runtime errors from missing function were thrown', async ({ page }) => {
      const demo = new BacktrackingDemoPage(page);
      await demo.goto();

      // FSM suggests an entry action renderPage(), but the HTML does not define it.
      // Assert that it is undefined (i.e., not invoked and not present).
      const hasRenderPage = await demo.hasRenderPageFunction();
      expect(hasRenderPage).toBe(false);

      // If the environment attempted to call renderPage(), we'd likely see a ReferenceError in pageErrors.
      // Assert that no ReferenceError or other page errors were produced on load.
      expect(pageErrors).toEqual([]);
    });

    test('S1 entry action is the alert call; verify no additional onExit actions are present', async ({ page }) => {
      const demo = new BacktrackingDemoPage(page);
      await demo.goto();

      // Click to enter S1 and verify alert (entry action)
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        demo.clickDemoButton()
      ]);

      const expectedMessage = "Backtracking demonstration is a complex exercise! Explore algorithms like N-Queens in detail through coding platforms and textbooks.";
      expect(dialog.message()).toBe(expectedMessage);
      await dialog.dismiss();

      // FSM lists no exit_actions for S1; we assert there is no visible DOM change indicative of exit actions.
      // The page content should remain visible and button still present.
      await expect(demo.contentContainer).toBeVisible();
      await expect(demo.button).toBeVisible();

      // Confirm no runtime errors occurred as a result of entering/exiting S1
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Observability: Console and page error assertions', () => {
    // This final set of checks ensures we observed and recorded console messages and page errors,
    // and that their content (or absence) matches reasonable expectations for this static demo page.
    test('No unexpected console errors or page errors during typical interactions', async ({ page }) => {
      const demo = new BacktrackingDemoPage(page);
      await demo.goto();

      // Interact: trigger the alert once
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        demo.clickDemoButton()
      ]);
      await dialog.dismiss();

      // We expect that this static page produces no console error messages nor uncaught page errors
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
      expect(pageErrors).toEqual([]);
    });

    // Intentionally observe and report any errors if they exist (tests will fail if unexpected errors appear).
    test('Capture and expose any runtime errors (if present) for diagnosis', async ({ page }) => {
      const demo = new BacktrackingDemoPage(page);
      await demo.goto();

      // This test purposefully does not assert zero errors; instead it surfaces them so failures show diagnostics.
      // If there are any pageErrors, fail with a message listing them for debug.
      if (pageErrors.length > 0) {
        // Fail with aggregated error messages so they're visible in test output
        throw new Error('Page produced runtime errors: ' + pageErrors.join(' | '));
      }

      // If no errors, simply assert that pageErrors is empty
      expect(pageErrors).toEqual([]);
    });
  });
});