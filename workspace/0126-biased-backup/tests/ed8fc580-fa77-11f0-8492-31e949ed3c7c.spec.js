import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8fc580-fa77-11f0-8492-31e949ed3c7c.html';
const EXPECTED_ALERT_TEXT = 'Integration Testing ensures that components work together as expected.';

test.describe('Integration Testing Showcase - FSM validation (ed8fc580-fa77-11f0-8492-31e949ed3c7c)', () => {
  // Shared listeners storage for console messages and page errors
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for inspection
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect page errors (unhandled exceptions in the page)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Reset collections after each test (not strictly necessary, but keeps expectations local)
    consoleMessages = [];
    pageErrors = [];
  });

  test.describe('Idle State (S0_Idle) - initial render and DOM verification', () => {
    test('renders the page and exposes the Learn More button with expected attributes', async ({ page }) => {
      // Validate that the page loads successfully and the button is present with the expected text and onclick attribute.
      const response = await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
      // Ensure the page responded (may be null in some environments but do a best-effort check)
      expect(response && response.ok()).not.toBe(false);

      // Find the button and verify properties
      const button = page.locator('.button');
      await expect(button).toBeVisible();
      await expect(button).toHaveText('Learn More');

      // Verify the onclick attribute exists and references the showMessage function (string match)
      const onclickAttr = await button.getAttribute('onclick');
      expect(onclickAttr).toContain('showMessage');

      // Ensure the global function showMessage exists in the page context (as declared in the provided HTML)
      const showMessageType = await page.evaluate(() => typeof window.showMessage);
      expect(showMessageType).toBe('function');

      // The FSM mentions an entry action renderPage() for S0_Idle, but the provided HTML does not define renderPage.
      // Verify that renderPage is not defined in the page context.
      const renderPageType = await page.evaluate(() => typeof window.renderPage);
      expect(renderPageType).toBe('undefined');

      // No console errors should be present on initial load for this page (unless environment differs)
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('attempting to call missing entry action renderPage() results in ReferenceError', async ({ page }) => {
      // This test explicitly verifies the edge case where the FSM lists an entry action renderPage()
      // that is not implemented in the page. We call it to let a ReferenceError occur naturally and assert.
      await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

      // Prepare to capture the pageerror event produced by the missing function call
      const pageErrorPromise = page.waitForEvent('pageerror');

      // Attempt to call the undefined function. This should reject in Node and emit a pageerror event.
      let evalError = null;
      try {
        // This evaluation will run in the page and should throw a ReferenceError.
        await page.evaluate(() => {
          // Intentionally call the missing function exactly as named in FSM
          // Do not inject or define anything; allow the runtime to throw naturally.
          // eslint-disable-next-line no-undef
          return renderPage();
        });
      } catch (err) {
        evalError = err;
      }

      // Wait for the pageerror event that corresponds to the ReferenceError thrown in the page context
      const pageErr = await pageErrorPromise;

      // Assertions: the evaluation should have thrown, and the page error message should indicate the missing function.
      expect(evalError).toBeTruthy();
      expect(String(evalError.message)).toMatch(/renderPage|is not defined|ReferenceError/);

      expect(pageErr).toBeTruthy();
      // pageErr.message may vary by browser; check that it references renderPage and is some kind of ReferenceError
      expect(String(pageErr.message)).toMatch(/renderPage|is not defined|ReferenceError/);
    });
  });

  test.describe('Event: LearnMore_Click and Transition to Message Shown (S1_MessageShown)', () => {
    test('clicking the Learn More button shows an alert dialog with the expected message', async ({ page }) => {
      // Load page and click the button; assert that a dialog appears with expected text and is handled properly.
      await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

      // Click the button and wait for the alert dialog to appear
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('.button'),
      ]);

      // Validate the dialog message
      expect(dialog.message()).toBe(EXPECTED_ALERT_TEXT);

      // Accept the alert to allow page to continue
      await dialog.accept();

      // No uncaught page errors should have occurred as a result of normal operation
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('programmatic invocation of showMessage() triggers the same alert (S1 entry observable)', async ({ page }) => {
      // Demonstrates that invoking the action that drives the transition results in the same observable: the alert.
      await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

      // Call showMessage() from page context and wait for the dialog
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.evaluate(() => {
          // Call the existing function defined in the page.
          window.showMessage();
        }),
      ]);

      expect(dialog.message()).toBe(EXPECTED_ALERT_TEXT);
      await dialog.accept();

      // Ensure no page errors
      expect(pageErrors.length).toBe(0);
    });

    test('multiple rapid clicks produce multiple alerts that can be handled sequentially', async ({ page }) => {
      // This explores an edge case: user clicking the button multiple times quickly.
      await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

      // Click twice and handle two dialogs sequentially
      const dialog1Promise = page.waitForEvent('dialog');
      await page.click('.button');
      const dialog1 = await dialog1Promise;
      expect(dialog1.message()).toBe(EXPECTED_ALERT_TEXT);
      await dialog1.accept();

      const dialog2Promise = page.waitForEvent('dialog');
      await page.click('.button');
      const dialog2 = await dialog2Promise;
      expect(dialog2.message()).toBe(EXPECTED_ALERT_TEXT);
      await dialog2.accept();

      // No page errors from repeated interaction
      expect(pageErrors.length).toBe(0);
    });

    test('keyboard activation (Enter) on the button triggers the alert', async ({ page }) => {
      // Validate accessibility/keyboard activation path to trigger the same transition.
      await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

      // Focus the button and press Enter
      await page.focus('.button');
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.keyboard.press('Enter'),
      ]);

      expect(dialog.message()).toBe(EXPECTED_ALERT_TEXT);
      await dialog.accept();

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases, negative flows, and environment observations', () => {
    test('clicking a non-existent selector should throw a Playwright error', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

      // Attempt to click a selector that does not exist and assert Playwright throws an informative error.
      let thrown = null;
      try {
        await page.click('.this-selector-does-not-exist', { timeout: 1000 });
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toBeTruthy();
      // The thrown error message should indicate the element was not found / clickable
      expect(String(thrown.message)).toMatch(/No node found|cannot find|waiting for selector/i);
    });

    test('page console and error streams are observable and reported', async ({ page }) => {
      // This test ensures our listeners capture console and pageerror events.
      await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

      // Emit a console message from the page and a deliberate error (call undefined function) to ensure both streams are captured.
      const consolePromise = page.waitForEvent('console', { predicate: msg => msg.type() === 'log' });
      const pageErrorPromise = page.waitForEvent('pageerror');

      // Trigger a console.log and a ReferenceError in the page context.
      await page.evaluate(() => {
        // console message
        console.log('playwright-test-debug: console log emitted');
        // throw a deliberate error by calling an undefined function to exercise pageerror handling
        try {
          // eslint-disable-next-line no-undef
          nonExistentFunctionForTest();
        } catch (e) {
          // Swallow here so pageerror may not be emitted from this try/catch.
          // To ensure a pageerror event, throw asynchronously.
          setTimeout(() => {
            // eslint-disable-next-line no-undef
            nonExistentFunctionForTest();
          }, 0);
        }
      });

      // Await the console log and page error
      const consoleMsg = await consolePromise;
      const pageErr = await pageErrorPromise;

      expect(consoleMsg.text()).toContain('playwright-test-debug: console log emitted');
      // pageErr message should mention the undefined function
      expect(String(pageErr.message)).toMatch(/nonExistentFunctionForTest|is not defined|ReferenceError/);
    });
  });
});