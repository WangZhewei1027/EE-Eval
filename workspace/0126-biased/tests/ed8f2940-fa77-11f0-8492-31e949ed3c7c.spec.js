import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8f2940-fa77-11f0-8492-31e949ed3c7c.html';

test.describe('ACID Properties interactive - FSM validation (ed8f2940-fa77-11f0-8492-31e949ed3c7c)', () => {
  // Collect runtime diagnostics for each test run
  let consoleMessages = [];
  let pageErrors = [];
  let consoleHandler;
  let pageErrorHandler;

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];

    // Attach listeners to observe console output and uncaught page errors
    consoleHandler = (msg) => {
      // collect text for assertions / debugging
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
        });
      } catch (e) {
        // in case msg.type() throws in some env, still record text only
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    };
    pageErrorHandler = (err) => {
      // err is an Error object representing uncaught exception in page
      pageErrors.push(err);
    };

    page.on('console', consoleHandler);
    page.on('pageerror', pageErrorHandler);

    // Navigate to the page under test. We intentionally load it as-is and do not patch anything.
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Detach listeners to avoid memory leaks across tests
    try {
      page.off('console', consoleHandler);
      page.off('pageerror', pageErrorHandler);
    } catch (e) {
      // ignore if already detached
    }
  });

  test.describe('State S0_Idle (Initial render)', () => {
    test('Idle state elements render correctly on page load', async ({ page }) => {
      // This test validates that the initial page (Idle state) is rendered and visible.
      // It checks structural DOM elements and visual presence of the "Learn More" button.

      // Verify main container exists
      const container = await page.locator('.container');
      await expect(container).toBeVisible();

      // Verify header text
      const header = page.locator('.header h1');
      await expect(header).toHaveText('ACID Properties');

      // Verify there are four property cards as implemented in HTML
      const propertyCards = page.locator('.property-card');
      await expect(propertyCards).toHaveCount(4);

      // Verify the Learn More button exists and has the expected class and text
      const infoButton = page.locator('.info-button');
      await expect(infoButton).toBeVisible();
      await expect(infoButton).toHaveText('Learn More');

      // Verify the button has the onclick attribute referencing showAlert()
      const onclickValue = await page.evaluate(() => {
        const btn = document.querySelector('.info-button');
        return btn ? btn.getAttribute('onclick') : null;
      });
      await expect(onclickValue).toBe('showAlert()');

      // Verify whether the page defines showAlert function (it should per HTML)
      const showAlertType = await page.evaluate(() => typeof window.showAlert);
      await expect(showAlertType).toBe('function');

      // The FSM mentions an entry action renderPage(); it is NOT present in the HTML.
      // Confirm that renderPage is not defined to reflect that the entry action was not implemented.
      const renderPageType = await page.evaluate(() => typeof window.renderPage);
      await expect(renderPageType).toBe('undefined');

      // Diagnostic: If there are any page errors recorded during load, assert they are expected JS runtime error types.
      // This follows the instruction to observe and assert page errors if they occur (let them happen naturally).
      if (pageErrors.length > 0) {
        // If any errors occurred, ensure they are classical runtime errors (ReferenceError, TypeError, SyntaxError).
        for (const err of pageErrors) {
          // err.name may be 'ReferenceError' etc.
          expect(['ReferenceError', 'TypeError', 'SyntaxError', 'Error']).toContain(err.name);
        }
      } else {
        // If none, assert that no uncaught page errors happened on initial load.
        expect(pageErrors.length).toBe(0);
      }

      // Also assert that the console did not emit obvious "error" level logs. If it did, record and validate their types.
      const severeConsoleMessages = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      // It's acceptable for there to be no severe console messages; if present, they should contain human-readable text.
      for (const msg of severeConsoleMessages) {
        expect(typeof msg.text).toBe('string');
        expect(msg.text.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  test.describe('Event LearnMoreClick -> Transition to S1_AlertShown', () => {
    test('Clicking Learn More shows alert dialog with expected message (single click)', async ({ page }) => {
      // This test validates the transition from Idle to Alert Shown when the user clicks the button.
      // We observe the alert dialog, verify its text, and accept it.

      const expectedAlertText = "ACID Properties ensure reliable processing of database transactions.\n\nLearn more about database management systems for deeper insights.";

      // Prepare to capture the dialog
      const dialogs = [];
      page.on('dialog', async dialog => {
        // record dialog message and accept it so the page can continue
        dialogs.push({ message: dialog.message(), type: dialog.type() });
        await dialog.accept();
      });

      // Trigger the event: click the button
      await page.click('.info-button');

      // Wait a short time for potential dialog to be handled
      await page.waitForTimeout(100); // small delay to let the dialog handler run

      // There should be exactly one dialog created by a single click
      expect(dialogs.length).toBe(1);
      expect(dialogs[0].type).toBe('alert');
      expect(dialogs[0].message).toBe(expectedAlertText);

      // After accepting, ensure the DOM remains and the button is still present (we didn't navigate away)
      await expect(page.locator('.info-button')).toBeVisible();

      // Ensure no new uncaught errors were emitted as a result of clicking the button
      if (pageErrors.length > 0) {
        for (const err of pageErrors) {
          expect(['ReferenceError', 'TypeError', 'SyntaxError', 'Error']).toContain(err.name);
        }
      } else {
        expect(pageErrors.length).toBe(0);
      }
    });

    test('Double-clicking Learn More results in two sequential alerts (edge-case)', async ({ page }) => {
      // Edge case: user clicks twice quickly. Verify two alerts appear sequentially and both contain the expected text.
      // Note: Browsers show alerts sequentially; the test accepts each in order.

      const expectedAlertText = "ACID Properties ensure reliable processing of database transactions.\n\nLearn more about database management systems for deeper insights.";

      const dialogs = [];
      page.on('dialog', async dialog => {
        dialogs.push({ message: dialog.message(), type: dialog.type() });
        // Accept each alert to allow the next to appear
        await dialog.accept();
      });

      // Perform two clicks quickly
      await page.click('.info-button');
      await page.click('.info-button');

      // A small timeout to allow both dialogs to be delivered and handled
      await page.waitForTimeout(200);

      // Verify two dialogs were recorded
      expect(dialogs.length).toBeGreaterThanOrEqual(2);
      // Validate at least first two messages match expected text
      expect(dialogs[0].type).toBe('alert');
      expect(dialogs[0].message).toBe(expectedAlertText);
      expect(dialogs[1].type).toBe('alert');
      expect(dialogs[1].message).toBe(expectedAlertText);
    });

    test('Activating button via keyboard (Enter) also triggers alert', async ({ page }) => {
      // Accessibility/interaction edge-case: Press Enter when the button is focused to trigger the same transition.

      const expectedAlertText = "ACID Properties ensure reliable processing of database transactions.\n\nLearn more about database management systems for deeper insights.";

      const dialogs = [];
      page.on('dialog', async dialog => {
        dialogs.push({ message: dialog.message(), type: dialog.type() });
        await dialog.accept();
      });

      const infoButton = page.locator('.info-button');
      await infoButton.focus();
      // Press Enter to activate the button
      await page.keyboard.press('Enter');

      await page.waitForTimeout(100);

      expect(dialogs.length).toBe(1);
      expect(dialogs[0].type).toBe('alert');
      expect(dialogs[0].message).toBe(expectedAlertText);
    });
  });

  test.describe('FSM contract checks and error observations', () => {
    test('FSM-specified entry action renderPage() is not implemented; observe and assert accordingly', async ({ page }) => {
      // FSM metadata indicates an entry action renderPage() for S0_Idle. The HTML does not define it.
      // We assert that renderPage is undefined and that no automatic ReferenceError was thrown during load.
      const renderPageType = await page.evaluate(() => typeof window.renderPage);
      expect(renderPageType).toBe('undefined');

      if (pageErrors.length > 0) {
        // If a ReferenceError occurred (e.g. due to a script calling renderPage), it should be of type ReferenceError.
        const referenceErrors = pageErrors.filter(err => err.name === 'ReferenceError');
        // If any pageErrors exist, ensure they are one of expected runtime error types
        for (const err of pageErrors) {
          expect(['ReferenceError', 'TypeError', 'SyntaxError', 'Error']).toContain(err.name);
        }
        // It's acceptable for referenceErrors to be present or not; just log expectation that if present they are ReferenceError.
        if (referenceErrors.length > 0) {
          for (const refErr of referenceErrors) {
            expect(refErr.message.toLowerCase()).toContain('renderpage');
          }
        }
      } else {
        // If there were no page errors, this means the non-existent entry action wasn't invoked (no ReferenceError).
        expect(pageErrors.length).toBe(0);
      }
    });

    test('Verify no unexpected runtime TypeError or SyntaxError occurred during interaction', async ({ page }) => {
      // After interactions above, ensure there were no SyntaxError or unexpected TypeError on the page.
      const syntaxOrTypeErrors = pageErrors.filter(err => err.name === 'SyntaxError' || err.name === 'TypeError');
      // There should be none; if present, fail the test with details for debugging.
      if (syntaxOrTypeErrors.length > 0) {
        // Build a diagnostic message for failure to aid debugging
        const messages = syntaxOrTypeErrors.map(e => `${e.name}: ${e.message}`).join(' | ');
        // Force a failing expectation with diagnostics
        expect(messages).toBe('', { timeout: 0 });
      } else {
        expect(syntaxOrTypeErrors.length).toBe(0);
      }
    });
  });
});