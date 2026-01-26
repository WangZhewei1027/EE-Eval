import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b1e313-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('Time Complexity Interactive App (f5b1e313-fa7c-11f0-adc7-178f556b1ee0)', () => {
  // Shared holders for console and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset collectors for each test
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', msg => {
      try {
        // serialize arguments for easier assertions
        const text = msg.text();
        consoleMessages.push({ type: msg.type(), text });
      } catch (e) {
        // If serialization fails, still record something
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Collect uncaught page errors
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
    // Ensure the basic document is loaded
    await expect(page).toHaveTitle(/Time Complexity/i);
  });

  test.afterEach(async () => {
    // No special teardown needed; listener removal is automatic when page is closed by Playwright
  });

  test.describe('State S0_Idle (renderPage)', () => {
    test('renders the page and shows the Demonstrate Time Complexity button', async ({ page }) => {
      // This test validates the S0_Idle entry action renderPage()
      // - The button must exist with id #demonstration-button
      // - Initial console should not yet contain demonstration logs
      const button = page.locator('#demonstration-button');
      await expect(button).toBeVisible();
      await expect(button).toHaveText('Demonstrate Time Complexity');

      // Validate that content describing time complexities is present
      await expect(page.locator('h1')).toHaveText('Time Complexity');
      await expect(page.locator('text=O(n log n)')).toBeVisible();

      // There should be no demonstration console logs before clicking
      const hasDemoLogBefore = consoleMessages.some(m => /Time complexity of algorithm:/i.test(m.text));
      expect(hasDemoLogBefore).toBe(false);

      // Verify there are no uncaught page errors on initial render
      expect(pageErrors.length).toBe(0);
    });

    test('button attributes and accessibility checks', async ({ page }) => {
      // Check that the button has the expected id and is focusable
      const button = page.locator('#demonstration-button');
      await expect(button).toHaveAttribute('id', 'demonstration-button');
      await button.focus();
      // After focusing, verify it is the active element
      const activeId = await page.evaluate(() => document.activeElement?.id);
      expect(activeId).toBe('demonstration-button');
    });
  });

  test.describe('Transition: DemonstrateClick (S0 -> S1)', () => {
    test('clicking the Demonstrate button triggers startDemonstration and logs expected messages', async ({ page }) => {
      // This test validates the transition from S0_Idle to S1_Demonstrating
      // It asserts that clicking the button triggers console logs:
      //  - "Time complexity of algorithm: O(1000 log 1000)"
      //  - "Time elapsed: ... milliseconds"

      // Click the button and wait for the expected console messages to appear.
      // We'll wait up to a reasonable timeout for both messages to be observed.
      const button = page.locator('#demonstration-button');

      // Click once to start demonstration
      await button.click();

      // Wait loop to allow console messages to be collected since the demonstration logs to console.
      // We'll poll the collected consoleMessages for presence of expected logs.
      const waitForLogs = async (timeout = 5000) => {
        const start = Date.now();
        while (Date.now() - start < timeout) {
          const hasComplexityLog = consoleMessages.some(m =>
            /Time complexity of algorithm: O\(\s*1000\s*log\s*1000\s*\)/i.test(m.text)
          );
          const hasElapsedLog = consoleMessages.some(m =>
            /Time elapsed:\s*\d+(\.\d+)?\s*milliseconds/i.test(m.text)
          );
          if (hasComplexityLog && hasElapsedLog) return true;
          // small delay
          await new Promise(res => setTimeout(res, 50));
        }
        return false;
      };

      const found = await waitForLogs(7000);
      expect(found).toBe(true);

      // Assert specific console message contents
      const complexityMsg = consoleMessages.find(m =>
        /Time complexity of algorithm:/i.test(m.text)
      );
      expect(complexityMsg).toBeDefined();
      expect(complexityMsg.text).toMatch(/O\(\s*1000\s*log\s*1000\s*\)/i);

      const elapsedMsg = consoleMessages.find(m =>
        /Time elapsed:/i.test(m.text)
      );
      expect(elapsedMsg).toBeDefined();
      // Extract numeric milliseconds value and ensure it's a number >= 0
      const match = elapsedMsg.text.match(/Time elapsed:\s*([\d.]+)\s*milliseconds/i);
      expect(match).not.toBeNull();
      const ms = Number(match[1]);
      expect(Number.isFinite(ms)).toBe(true);
      expect(ms).toBeGreaterThanOrEqual(0);

      // No uncaught page errors should have occurred during the transition
      expect(pageErrors.length).toBe(0);

      // Confirm that the FSM active state would be S1_Demonstrating by verifying event handler presence evidence:
      // We can't introspect internal state machine, but we can assert that an external observable (logs) indicates the action ran.
      // Already validated via logs above.
    });

    test('multiple rapid clicks produce multiple demonstrations and do not throw page errors', async ({ page }) => {
      // Edge case: user clicks rapidly multiple times.
      // Expect multiple sets of logs and no uncaught page errors or crashes.

      const button = page.locator('#demonstration-button');

      // Click twice in rapid succession
      await button.click();
      await button.click();

      // Wait for at least two "Time complexity..." logs
      const waitForTwoComplexityLogs = async (timeout = 8000) => {
        const start = Date.now();
        while (Date.now() - start < timeout) {
          const count = consoleMessages.filter(m =>
            /Time complexity of algorithm:/i.test(m.text)
          ).length;
          if (count >= 2) return true;
          await new Promise(res => setTimeout(res, 50));
        }
        return false;
      };

      const gotTwo = await waitForTwoComplexityLogs(9000);
      expect(gotTwo).toBe(true);

      // Ensure at least two elapsed logs exist and parse numeric values
      const elapsedLogs = consoleMessages.filter(m => /Time elapsed:/i.test(m.text));
      expect(elapsedLogs.length).toBeGreaterThanOrEqual(2);
      for (const log of elapsedLogs) {
        const match = log.text.match(/Time elapsed:\s*([\d.]+)\s*milliseconds/i);
        expect(match).not.toBeNull();
        const val = Number(match[1]);
        expect(Number.isFinite(val)).toBe(true);
        expect(val).toBeGreaterThanOrEqual(0);
      }

      // Ensure no uncaught page errors were recorded
      expect(pageErrors.length).toBe(0);
    });

    test('verifies no ReferenceError / SyntaxError / TypeError occurred during interactions', async ({ page }) => {
      // This test specifically inspects collected page errors and console errors
      // and asserts that none of them are ReferenceError, SyntaxError, or TypeError.
      const button = page.locator('#demonstration-button');
      await button.click();

      // Wait briefly for possible errors to surface
      await new Promise(res => setTimeout(res, 500));

      // Check captured page errors for specific error names
      const problematic = pageErrors.filter(err => {
        const name = err && err.name ? err.name : '';
        return ['ReferenceError', 'SyntaxError', 'TypeError'].includes(name);
      });
      expect(problematic.length).toBe(0);

      // Also inspect console messages of type 'error' for these keywords
      const consoleErrorProblems = consoleMessages.filter(m =>
        m.type === 'error' &&
        /ReferenceError|SyntaxError|TypeError/i.test(m.text)
      );
      expect(consoleErrorProblems.length).toBe(0);
    });
  });

  test.describe('Additional Observability & FSM Evidence', () => {
    test('verifies evidence strings referenced in FSM are present in implementation (event listener and button)', async ({ page }) => {
      // This test ensures that the page includes evidence that maps to the FSM:
      // - The HTML contains the <button id="demonstration-button">...
      // - The script contains an addEventListener for 'click' (we look for the string in page source)

      // Button existence already validated, but also check page source for the event handler code snippet
      const source = await page.content();

      // Evidence: presence of demonstrationButton.addEventListener('click'
      expect(source).toContain("demonstrationButton.addEventListener('click'");

      // Evidence: the button markup is present in the source
      expect(source).toContain('<button id="demonstration-button">Demonstrate Time Complexity</button>');
    });

    test('edge case: clicking when button is removed (simulate by navigating away) should not produce runtime errors in the original page', async ({ page }) => {
      // This test simulates an edge flow where user navigates away quickly after click.
      // We will click, then immediately navigate to about:blank, and then check that the original page logged messages (or at least no tracked uncaught errors).
      const button = page.locator('#demonstration-button');

      await button.click();
      // Immediately navigate away to simulate abrupt user action
      await page.goto('about:blank');

      // There should be no exceptions thrown by Playwright; we also check the previously collected pageErrors length
      // Note: pageErrors is tied to the original page instance; after navigation it still reflects errors collected earlier.
      expect(pageErrors.length).toBeGreaterThanOrEqual(0);
      // We assert there were no severe JS engine errors of the tracked types during the operation
      const severe = pageErrors.filter(err => ['ReferenceError', 'SyntaxError', 'TypeError'].includes(err.name));
      expect(severe.length).toBe(0);
    });
  });
});