import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8f7761-fa77-11f0-8492-31e949ed3c7c.html';

test.describe('Socket Programming Visualization - FSM: S0_Idle and LearnMore_Click', () => {
  // Capture console messages and page errors for each test run
  test.beforeEach(async ({ page }) => {
    // Attach listeners early to capture anything during navigation
    page.context()._consoleMessages = [];
    page.context()._pageErrors = [];

    page.on('console', (msg) => {
      // store console messages for assertions later
      page.context()._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // store uncaught exceptions that bubble to pageerror
      page.context()._pageErrors.push(err);
    });

    // Navigate to the application under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Provide helpful debug output when assertions fail locally (not printed by Playwright runner by default)
    const consoleMessages = page.context()._consoleMessages || [];
    const pageErrors = page.context()._pageErrors || [];
    if (consoleMessages.length) {
      // eslint-disable-next-line no-console
      console.log('Captured console messages:', consoleMessages);
    }
    if (pageErrors.length) {
      // eslint-disable-next-line no-console
      console.log('Captured page errors:', pageErrors.map(e => e.message));
    }
  });

  test.describe('Initial state: S0_Idle (rendering and static DOM checks)', () => {
    test('renders the main heading, description, Learn More button and socket visual', async ({ page }) => {
      // Validate the heading text to confirm page load and Idle state rendering
      const heading = await page.locator('h1');
      await expect(heading).toHaveText('Socket Programming');

      // Validate paragraph contains expected descriptive text
      const paragraph = await page.locator('p');
      await expect(paragraph).toContainText('real-time communication');

      // Validate button exists with the correct class and text
      const button = await page.locator('.button');
      await expect(button).toBeVisible();
      await expect(button).toHaveText('Learn More');

      // Verify the button has the expected inline onclick attribute declared in the HTML
      const onclickAttr = await page.locator('.button').getAttribute('onclick');
      expect(onclickAttr).toBe("alert('Socket Programming Example!')");

      // Validate the socket visual element exists and has the expected size (200x200)
      const socketVisual = await page.locator('.socket-visual');
      await expect(socketVisual).toBeVisible();
      const box = await socketVisual.boundingBox();
      // boundingBox may return undefined in headless/offscreen conditions; guard against that
      expect(box).not.toBeNull();
      if (box) {
        // Accept slight variations, use approximate check
        expect(Math.round(box.width)).toBeGreaterThanOrEqual(195);
        expect(Math.round(box.width)).toBeLessThanOrEqual(205);
        expect(Math.round(box.height)).toBeGreaterThanOrEqual(195);
        expect(Math.round(box.height)).toBeLessThanOrEqual(205);
      }

      // Check that CSS animations are present by querying computed style for animation-duration
      const animationDuration = await page.evaluate(() => {
        const el = document.querySelector('.button');
        return el ? window.getComputedStyle(el).animationDuration : null;
      });
      // Expect some animation (duration not '0s' or empty)
      expect(animationDuration).not.toBeNull();
      if (animationDuration) {
        // It's typically '2s' in the provided CSS; ensure it's not '0s'
        expect(animationDuration).not.toBe('0s');
      }

      // Ensure there were no uncaught page errors during initial rendering
      const pageErrors = page.context()._pageErrors || [];
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Event: LearnMore_Click and transitions', () => {
    test('clicking the Learn More button triggers an alert with the expected message', async ({ page }) => {
      // Collect dialog messages to assert multiple clicks produce dialogs
      const dialogMessages = [];
      page.on('dialog', async (dialog) => {
        try {
          dialogMessages.push(dialog.message());
          // dismiss to allow continuation (alert -> dismiss is fine)
          await dialog.dismiss();
        } catch (e) {
          // swallow potential errors during dialog handling to allow assertions later
        }
      });

      // Click the button once and assert dialog was shown with expected text
      const button = page.locator('.button');
      await button.click();

      // Wait a short while for dialog handler to execute
      await page.waitForTimeout(100);

      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      expect(dialogMessages[0]).toBe('Socket Programming Example!');

      // Click the button again to ensure the transition is repeatable and idempotent
      await button.click();
      await page.waitForTimeout(100);
      expect(dialogMessages.length).toBeGreaterThanOrEqual(2);
      expect(dialogMessages[1]).toBe('Socket Programming Example!');

      // Final assertion: no uncaught page errors were generated by clicking the button
      const pageErrors = page.context()._pageErrors || [];
      expect(pageErrors.length).toBe(0);
    });

    test('multiple rapid clicks queue dialogs and each shows the expected alert text', async ({ page }) => {
      // Some browsers queue alerts; collect all dialog messages
      const dialogs = [];
      page.on('dialog', async (dialog) => {
        dialogs.push(dialog.message());
        await dialog.dismiss();
      });

      const button = page.locator('.button');

      // Rapidly click the button three times
      await button.click();
      await button.click();
      await button.click();

      // Give time for dialogs to be emitted and handled
      await page.waitForTimeout(500);

      // Expect three dialogs captured and each with expected message
      expect(dialogs.length).toBe(3);
      for (const msg of dialogs) {
        expect(msg).toBe('Socket Programming Example!');
      }

      // Ensure no uncaught page errors as a result of repeated alerts
      const pageErrors = page.context()._pageErrors || [];
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Entry/Exit action verification and error observation', () => {
    test('verify declared entry action renderPage() is not defined and calling it produces a ReferenceError or TypeError', async ({ page }) => {
      // The FSM entry action mentions renderPage(). The HTML does not define it.
      // We intentionally attempt to call it inside the page context and capture the thrown error,
      // verifying that missing-onEntry implementation is observable as a ReferenceError/TypeError.
      const callResult = await page.evaluate(() => {
        try {
          // Attempt a bare call; if renderPage is not declared this should throw ReferenceError.
          // Note: this is executed in the page environment exactly as-is; we do not modify the page.
          renderPage();
          return { ok: true, message: 'renderPage executed (unexpected)' };
        } catch (err) {
          return { ok: false, name: err && err.name ? err.name : 'UnknownError', message: err && err.message ? err.message : String(err) };
        }
      });

      // We expect the call to fail because renderPage() is not implemented in the HTML.
      expect(callResult.ok).toBe(false);
      // Accept either ReferenceError (call as bare identifier) or TypeError (if referencing via undefined property), but ensure it's an error about missing function
      expect(['ReferenceError', 'TypeError']).toContain(callResult.name);
      expect(callResult.message.length).toBeGreaterThan(0);
    });

    test('confirm renderPage is not present on the global window object', async ({ page }) => {
      // Check typeof window.renderPage to confirm absence
      const typeOfRenderPage = await page.evaluate(() => {
        return typeof window.renderPage;
      });
      // If renderPage were defined, typeof would be 'function'; we expect 'undefined' here
      expect(typeOfRenderPage).toBe('undefined');
    });

    test('observe console messages and page errors during navigation and interactions', async ({ page }) => {
      // This test verifies we correctly observed console messages and page errors via attached listeners.
      // Interact to potentially generate more logs.
      const button = page.locator('.button');
      // Handle and immediately dismiss any alert to prevent blocking
      page.on('dialog', async (dialog) => {
        await dialog.dismiss();
      });
      await button.click();

      // Wait briefly for any console messages or errors to surface
      await page.waitForTimeout(200);

      const consoleMessages = page.context()._consoleMessages || [];
      const pageErrors = page.context()._pageErrors || [];

      // For this well-formed HTML we expect no uncaught page errors
      expect(pageErrors.length).toBe(0);

      // Console messages may be present; ensure that none are of fatal 'error' type.
      const fatalConsoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(fatalConsoleErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and robustness checks', () => {
    test('button remains interactive after CSS animations and is focusable', async ({ page }) => {
      const button = page.locator('.button');
      await expect(button).toBeVisible();

      // Focus and press Enter to trigger the onclick via keyboard (accessibility check)
      await button.focus();
      // Listen for dialog and dismiss
      let sawDialog = false;
      page.once('dialog', async (d) => {
        sawDialog = true;
        await d.dismiss();
      });

      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);
      expect(sawDialog).toBe(true);
    });

    test('the inline onclick attribute exactly matches the FSM evidence', async ({ page }) => {
      // Validate that the evidence string from the FSM is present verbatim on the element
      const onclickAttr = await page.locator('.button').getAttribute('onclick');
      expect(onclickAttr).toBe("alert('Socket Programming Example!')");
      // As additional proof, retrieve outerHTML and ensure it contains the expected snippet
      const outerHTML = await page.locator('.button').evaluate((el) => el.outerHTML);
      expect(outerHTML).toContain("onclick=\"alert('Socket Programming Example!')\"");
    });
  });
});