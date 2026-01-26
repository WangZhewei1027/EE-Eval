import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b2f480-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('FSM: HTTPS: A Comprehensive Guide (f5b2f480-fa7c-11f0-adc7-178f556b1ee0)', () => {
  // Shared per-test holders for observed console messages and page errors
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize arrays to capture runtime observations for each test
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages emitted by the page
    page.on('console', (msg) => {
      // Store type and text for assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the page exactly as provided
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Clean up listeners to avoid cross-test leakage (Playwright automatically clears page between tests,
    // but explicit removal is safe in case of custom listeners).
    page.removeAllListeners && page.removeAllListeners('console');
    page.removeAllListeners && page.removeAllListeners('pageerror');
  });

  test.describe('State S0_Idle (Initial)', () => {
    test('Idle state: button is present, visible, enabled and matches expected evidence', async ({ page }) => {
      // Validate that the Idle state's evidence (the demo button) exists in the DOM
      const button = page.locator('#demo-button');

      // Button should be present exactly once
      await expect(button).toHaveCount(1);

      // Button should be visible to the user
      await expect(button).toBeVisible();

      // Button should be enabled (not disabled)
      await expect(button).not.toBeDisabled();

      // Button text should match the FSM / HTML evidence
      await expect(button).toHaveText('Demonstrate HTTPS in Action');

      // Before any interaction, there should be no console logs related to the demo entry action
      expect(consoleMessages.length).toBe(0);

      // And there should be no page errors at page load
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transition DemonstrateHTTPS -> S1_Demonstration', () => {
    test('Clicking the button triggers the Demonstration entry action (console.log)', async ({ page }) => {
      // This test validates the transition S0_Idle -> S1_Demonstration:
      // - the click event on #demo-button should cause console.log("HTTPS in action!")
      const button = page.locator('#demo-button');

      // Sanity check: button exists
      await expect(button).toBeVisible();

      // Perform a single user click
      await button.click();

      // Wait briefly to ensure console handlers run
      await page.waitForTimeout(100); // small wait to collect console events

      // Assert that at least one console message was emitted
      expect(consoleMessages.length).toBeGreaterThanOrEqual(1);

      // Look for the exact expected message emitted by the entry action
      const found = consoleMessages.some(
        (m) => m.type === 'log' && m.text.includes('HTTPS in action!')
      );
      expect(found).toBeTruthy();

      // Ensure no uncaught page errors occurred during the interaction
      expect(pageErrors.length).toBe(0);
    });

    test('Multiple clicks produce corresponding number of console logs (edge case)', async ({ page }) => {
      // Validate repeated transitions / repeated invocations of the entry action:
      // Each click should log "HTTPS in action!" once.
      const button = page.locator('#demo-button');

      // Perform several clicks in quick succession
      const clicks = 3;
      for (let i = 0; i < clicks; i++) {
        await button.click();
      }

      // Wait briefly to ensure console messages are captured
      await page.waitForTimeout(150);

      // Filter console messages for the exact expected text
      const demoLogs = consoleMessages.filter(
        (m) => m.type === 'log' && m.text.includes('HTTPS in action!')
      );

      // Expect exactly 'clicks' number of demo logs
      // It's acceptable if there are other console logs from other sources, but we expect at least `clicks`
      expect(demoLogs.length).toBe(clicks);

      // Confirm the content of each message is correct
      for (const log of demoLogs) {
        expect(log.text).toBe('HTTPS in action!');
      }

      // No page errors expected even under rapid interaction
      expect(pageErrors.length).toBe(0);
    });

    test('Programmatic click (dispatchEvent) also triggers the console log', async ({ page }) => {
      // This validates that the click handler is attached to the element and responds to programmatic events.
      // We will dispatch an explicit click event via evaluate().
      await page.evaluate(() => {
        const btn = document.getElementById('demo-button');
        if (btn) {
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }
      });

      // Wait briefly to collect console events
      await page.waitForTimeout(100);

      // Assert that we observed the expected console log
      const found = consoleMessages.some((m) => m.text === 'HTTPS in action!');
      expect(found).toBe(true);

      // No uncaught errors expected
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Error & edge-case scenarios', () => {
    test('Attempting to click a non-existent selector should result in an error (Playwright throws)', async ({ page }) => {
      // Intentionally click a selector that does not exist and assert Playwright throws an error.
      // This validates the test harness and how the application behaves when asked to perform an invalid action.
      let thrown = false;
      try {
        // Small timeout so the test doesn't wait long
        await page.click('#this-selector-does-not-exist', { timeout: 1000 });
      } catch (e) {
        // Expect an Error to be thrown by Playwright due to missing element
        expect(e).toBeInstanceOf(Error);
        thrown = true;
      }
      expect(thrown).toBe(true);

      // Ensure that this attempted action did not introduce page runtime errors
      expect(pageErrors.length).toBe(0);
    });

    test('No unexpected JavaScript runtime errors on page load or after interactions', async ({ page }) => {
      // Perform some normal interactions
      const button = page.locator('#demo-button');
      await expect(button).toBeVisible();
      await button.click();
      await page.waitForTimeout(50);

      // Assert that pageErrors array remains empty, meaning no uncaught exceptions occurred
      expect(pageErrors.length).toBe(0);

      // For transparency, also assert that consoleMessages contains the expected log
      const demoLog = consoleMessages.find((m) => m.text === 'HTTPS in action!');
      expect(demoLog).toBeDefined();
    });
  });
});