import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a16150-fa7b-11f0-8b01-9f078a0ff214.html';

test.describe('BFS Interactive Application - d5a16150-fa7b-11f0-8b01-9f078a0ff214', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and categorize them
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture runtime page errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the static HTML page
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // ensure page is still reachable after tests
    await expect(page).not.toBeNull();
  });

  test.describe('State: S0_Idle (Initial state verification)', () => {
    test('renders page content and key DOM elements (Idle state)', async ({ page }) => {
      // This test validates that the initial "Idle" state (S0_Idle) corresponds
      // to the page being rendered with expected static content and the BFS demo button.

      // Title and heading checks
      await expect(page).toHaveTitle(/Breadth-First Search \(BFS\)/);
      const h1 = await page.locator('h1').innerText();
      expect(h1).toContain('Breadth-First Search (BFS)');

      // Check that the example block exists and contains the expected node list snippet
      const exampleText = await page.locator('.example').innerText();
      expect(exampleText).toContain('A');
      expect(exampleText).toContain('B');
      expect(exampleText).toContain('C');

      // Ensure the demonstration button exists and has expected visible text
      const button = page.locator('button');
      await expect(button).toHaveCount(1);
      await expect(button).toHaveText(/Demonstration of BFS/);

      // No runtime page errors should have occurred just from loading the page
      expect(pageErrors.length).toBe(0);

      // No console error messages should have been logged during load
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('entry action "renderPage()" is not present - calling it throws ReferenceError', async ({ page }) => {
      // The FSM mentions an entry action renderPage(). The implementation does
      // not define renderPage(). We assert that invoking it in-page leads to
      // a ReferenceError / evaluation rejection, and that the page records the error.

      // Attempt to call the function in page context; this should cause a rejection.
      // We assert that the promise rejects and that the error message references renderPage.
      await expect(page.evaluate(() => {
        // Intentionally call an undefined function to observe natural ReferenceError
        // Do not define or patch renderPage; let the runtime error occur naturally.
        // The evaluation is expected to reject.
        return renderPage();
      })).rejects.toThrow(/renderPage/);

      // The pageerror listener should capture at least one error related to renderPage.
      // Note: depending on the browser engine, the message text might vary slightly.
      // We assert that one of the captured errors mentions renderPage.
      const found = pageErrors.some((err) => String(err).includes('renderPage'));
      expect(found).toBeTruthy();
    });
  });

  test.describe('Event: DemonstrationBFS (button click -> alert)', () => {
    test('clicking the Demonstration of BFS button shows the expected alert and preserves Idle state', async ({ page }) => {
      // This test validates the FSM transition DemonstrationBFS:
      // - Trigger: click button[onclick]
      // - Action: alert(...) with the exact message
      // - Transition keeps the application in S0_Idle (state does not navigate away)

      // Prepare to wait for a dialog (alert)
      const expectedAlertText = "This would trigger a demonstration of BFS, but due to the static nature of this page, it remains illustrative only. Please refer to the text for understanding BFS.";

      // Click the button and capture the dialog
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('button[onclick]'),
      ]);

      // Verify the alert's message exactly matches the inline onclick content
      expect(dialog.message()).toBe(expectedAlertText);

      // Accept the alert to allow interactions to continue
      await dialog.accept();

      // After the alert, the app should remain in the Idle state: the button and heading still exist
      await expect(page.locator('button')).toHaveCount(1);
      const h1After = await page.locator('h1').innerText();
      expect(h1After).toContain('Breadth-First Search (BFS)');

      // No navigation should have occurred as a result of the click
      expect(page.url()).toBe(APP_URL);

      // No page errors are expected from a normal alert interaction
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('clicking the button multiple times triggers multiple alerts (idempotent action)', async ({ page }) => {
      // Edge case: ensure repeated triggering of the same event produces the expected alerts each time.

      const expectedAlertText = "This would trigger a demonstration of BFS, but due to the static nature of this page, it remains illustrative only. Please refer to the text for understanding BFS.";

      // Click twice and capture two dialogs sequentially
      for (let i = 0; i < 2; i++) {
        const [dialog] = await Promise.all([
          page.waitForEvent('dialog'),
          page.click('button[onclick]'),
        ]);
        expect(dialog.message()).toBe(expectedAlertText);
        await dialog.accept();
      }

      // After repeated interactions, ensure still in Idle state and no page errors occurred
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('DOM and attribute verification (evidence extraction)', () => {
    test('button has correct onclick attribute content as documented in FSM', async ({ page }) => {
      // Verify that the button element has an onclick attribute that includes
      // the alert invocation described in the FSM definition.

      const onclickAttr = await page.getAttribute('button', 'onclick');
      expect(onclickAttr).not.toBeNull();
      expect(onclickAttr).toContain("alert(");
      expect(onclickAttr).toContain("This would trigger a demonstration of BFS");
    });

    test('page includes expected textual sections described by the FSM', async ({ page }) => {
      // Confirm several sections exist to validate the 'rendered' representation of the Idle state.

      await expect(page.locator('h2', { hasText: 'Concept and Theory' })).toHaveCount(1);
      await expect(page.locator('h2', { hasText: 'Algorithm Steps' })).toHaveCount(1);
      await expect(page.locator('h2', { hasText: 'Example' })).toHaveCount(1);
      await expect(page.locator('code')).toHaveCount(1);
    });
  });

  test.describe('Error and edge-case scenarios', () => {
    test('calling undefined functions in-page surfaces ReferenceError and is observable via pageerror', async ({ page }) => {
      // Another explicit check: call a clearly undefined function name to ensure pageerror events propagate.
      // This is to validate the test harness captures runtime exceptions naturally.

      // Make sure we start with no pageErrors
      expect(pageErrors.length).toBe(0);

      // Try calling a non-existent function and assert rejection
      await expect(page.evaluate(() => nonExistentFunctionXYZ())).rejects.toThrow(/nonExistentFunctionXYZ|not defined/);

      // Confirm the pageerror array captured an error mentioning the function
      const found = pageErrors.some((err) => String(err).includes('nonExistentFunctionXYZ') || String(err).includes('not defined'));
      expect(found).toBeTruthy();
    });

    test('no unexpected console errors during normal content interactions', async ({ page }) => {
      // Interact with some page content (scroll, read text) and assert no console.error messages are produced.

      // Read a few pieces of content
      await page.locator('p').first().textContent();
      await page.locator('code').textContent();

      // Scroll down to trigger any lazy logging (though this page is static)
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      // Ensure no console errors were emitted
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });
});