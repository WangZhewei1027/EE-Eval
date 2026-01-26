import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8f7763-fa77-11f0-8492-31e949ed3c7c.html';

test.describe('Version Control Concept - Interactive Application (ed8f7763-fa77-11f0-8492-31e949ed3c7c)', () => {
  // Array collectors for console messages and page errors per test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors before each test
    consoleMessages = [];
    pageErrors = [];

    // Listen to console events for observation
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Listen to page errors (runtime exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the exact page as provided (do not modify the page)
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Ensure dialogs are dismissed if any left open (defensive)
    page.removeAllListeners('dialog');
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
    // No explicit teardown needed beyond Playwright's fixtures
  });

  test.describe('Initial State (S0_Idle) rendering and DOM checks', () => {
    test('renders Idle state content and components correctly', async ({ page }) => {
      // Validate top-level headings to ensure page rendered as expected (entry action: renderPage() per FSM expected, but not present in HTML)
      const title = await page.locator('h1').textContent();
      const subtitle = await page.locator('h2').textContent();
      expect(title).toBe('Version Control');
      expect(subtitle).toContain('Manage your projects');

      // Validate there are exactly 3 cards representing features
      const cards = page.locator('.version-control .card');
      await expect(cards).toHaveCount(3);

      // Validate the Learn More button exists, is visible and has expected text
      const button = page.locator('button.button');
      await expect(button).toBeVisible();
      await expect(button).toHaveText('Learn More');

      // Validate the inline onclick attribute exists and contains the expected alert call
      const onclickAttr = await button.getAttribute('onclick');
      expect(onclickAttr).toBe("alert('Thank you for your interest!')");

      // No runtime page errors should have occurred during initial render
      expect(pageErrors.length).toBe(0);

      // No console errors expected but record the console messages for debugging
      // We assert that at least some console message object array exists (could be empty)
      expect(Array.isArray(consoleMessages)).toBeTruthy();
    });

    test('button has expected styling and hover visual feedback', async ({ page }) => {
      const button = page.locator('button.button');

      // Get computed background color before hover
      const beforeBg = await page.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      }, await button.elementHandle());

      // Hover the button
      await button.hover();

      // Get computed background color after hover
      const afterBg = await page.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      }, await button.elementHandle());

      // The colors should differ due to the :hover rule changing background
      expect(beforeBg).not.toBe(afterBg);

      // Ensure the button remains visible and enabled after hover
      await expect(button).toBeVisible();
      expect(await button.isEnabled()).toBe(true);

      // No runtime page errors should have occurred
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Events and Transitions (LearnMoreClick -> S0_Idle)', () => {
    test('clicking Learn More triggers an alert dialog with expected message', async ({ page }) => {
      // This test validates the FSM transition: clicking the ".button" triggers alert('Thank you for your interest!')
      const button = page.locator('button.button');

      // Listen for a dialog and validate its message
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        button.click(), // trigger click that should open alert
      ]);

      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe("Thank you for your interest!");
      await dialog.accept();

      // Ensure no page runtime errors occurred as a result of the click
      expect(pageErrors.length).toBe(0);
    });

    test('clicking Learn More multiple times triggers multiple alert dialogs in sequence', async ({ page }) => {
      const button = page.locator('button.button');

      // Click twice and handle two dialogs sequentially
      const dialog1Promise = page.waitForEvent('dialog');
      await button.click();
      const dialog1 = await dialog1Promise;
      expect(dialog1.message()).toBe("Thank you for your interest!");
      await dialog1.accept();

      const dialog2Promise = page.waitForEvent('dialog');
      await button.click();
      const dialog2 = await dialog2Promise;
      expect(dialog2.message()).toBe("Thank you for your interest!");
      await dialog2.accept();

      // No page errors expected during repeated interactions
      expect(pageErrors.length).toBe(0);
    });

    test('onclick attribute contains the expected alert code exactly as in FSM evidence', async ({ page }) => {
      const button = page.locator('button.button');
      const onclickAttr = await button.getAttribute('onclick');
      // Assert exact string match to evidence in FSM
      expect(onclickAttr).toBe("alert('Thank you for your interest!')");
    });
  });

  test.describe('FSM entry/exit action checks and error scenarios (edge cases)', () => {
    test('calling the non-existent entry action renderPage() produces a ReferenceError when invoked', async ({ page }) => {
      // The FSM mentions an entry action renderPage(), but the HTML does not define it.
      // We intentionally attempt to call it in the page context to observe the natural ReferenceError.
      let caughtError = null;
      try {
        // This should throw a ReferenceError in the page context
        await page.evaluate(() => {
          // Intentionally call undefined function to observe natural ReferenceError
          // (We do not define or patch renderPage; we let the runtime error happen)
          return renderPage();
        });
      } catch (err) {
        caughtError = err;
      }

      // We expect an error to have been thrown and it should indicate a ReferenceError / not defined
      expect(caughtError).not.toBeNull();
      // The message should include 'renderPage' and likely 'not defined' or 'is not defined'
      expect(caughtError.message.toLowerCase()).toContain('renderpage');
      // Ensure it's a ReferenceError type somewhere in the message (browser error text varies)
      expect(caughtError.message.toLowerCase()).toMatch(/referenceerror|not defined|is not defined/);
    });

    test('intentional SyntaxError when evaluating malformed code in page context', async ({ page }) => {
      // Intentionally evaluate malformed JS to allow a natural SyntaxError to be thrown by the runtime
      let caughtError = null;
      try {
        await page.evaluate(() => {
          // This will throw a SyntaxError due to invalid JS passed to eval
          eval('function malformed( { ');
        });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      // Message should reflect a SyntaxError occurred (varies across browsers but include 'Syntax')
      expect(caughtError.message.toLowerCase()).toMatch(/syntaxerror|syntax/);
    });

    test('intentional TypeError when trying to call a non-function in page context', async ({ page }) => {
      // Intentionally call a non-function to observe a natural TypeError
      let caughtError = null;
      try {
        await page.evaluate(() => {
          const notAFunction = {};
          // This will throw a TypeError: notAFunction is not a function
          return notAFunction();
        });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      // Confirm the message indicates a TypeError or 'is not a function'
      expect(caughtError.message.toLowerCase()).toMatch(/typeerror|not a function|is not a function/);
    });
  });

  test.describe('Observability and robustness checks', () => {
    test('no unexpected page errors during navigation and initial idle state', async ({ page }) => {
      // This test verifies that simply loading the page and rendering the Idle state does not produce runtime errors
      expect(pageErrors.length).toBe(0);

      // Validate that console messages are collected and do not include uncaught exceptions
      const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMessages.length).toBe(0);
    });

    test('observes console and pageerror events during deliberate failing evaluations', async ({ page }) => {
      // Ensure pageerror listener captures errors thrown from page.evaluate as well
      // Trigger a thrown ReferenceError via evaluate; pageerror should capture runtime errors from page context (some eval errors are propagated as exceptions only)
      // We will still catch the thrown error from evaluate, but we also want to ensure pageerror listener operates (it may or may not get an entry depending on context)
      try {
        await page.evaluate(() => {
          // Throw an unhandled error (not caught) in page context asynchronously to trigger pageerror
          setTimeout(() => { throw new Error('async test error for pageerror capture'); }, 0);
        });
      } catch (e) {
        // ignore immediate exceptions (none expected here)
      }

      // Wait briefly to allow async error to surface to pageerror listener
      await page.waitForTimeout(250);

      // The pageerror listener should have captured the asynchronous error
      const hasAsyncError = pageErrors.some(e => String(e.message).includes('async test error for pageerror capture'));
      expect(hasAsyncError).toBe(true);
    });
  });
});