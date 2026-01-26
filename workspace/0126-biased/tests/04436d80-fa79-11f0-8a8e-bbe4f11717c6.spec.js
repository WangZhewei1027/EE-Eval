import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04436d80-fa79-11f0-8a8e-bbe4f11717c6.html';

test.describe('Space Complexity Interactive App (FSM validation)', () => {
  // Arrays to collect console messages and page errors for each test run.
  let consoleMessages;
  let pageErrors;

  // Set up fresh page listeners before each test and navigate to the app.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages emitted by the page
    page.on('console', (msg) => {
      try {
        consoleMessages.push(msg.text());
      } catch (e) {
        // ignore any issues reading message text
      }
    });

    // Capture uncaught exceptions and page errors
    page.on('pageerror', (err) => {
      try {
        pageErrors.push(err.message || String(err));
      } catch (e) {
        pageErrors.push(String(err));
      }
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Basic teardown: ensure arrays are cleared for next test
    consoleMessages = [];
    pageErrors = [];
  });

  test.describe('Idle State (S0_Idle) validations', () => {
    test('Initial render shows header and buttons and does not call missing renderPage()', async ({ page }) => {
      // This test validates the Idle state's expected DOM and checks onEnter action presence/absence.
      // Verify header content is present
      const header = page.locator('.header h1');
      await expect(header).toHaveText('Space Complexity');

      // Verify Learn More (.button-primary) button exists and has the expected onclick attribute
      const learnMore = page.locator('.button-primary');
      await expect(learnMore).toBeVisible();
      await expect(await learnMore.getAttribute('onclick')).toBe('arrayExample()');

      // Verify Clear Example (.button) button exists and has the expected onclick attribute
      const clearBtn = page.locator('.button');
      await expect(clearBtn).toBeVisible();
      await expect(await clearBtn.getAttribute('onclick')).toBe('clearExample()');

      // FSM S0_Idle entry action mentions renderPage(). The implementation does not provide renderPage.
      // Confirm that the page does not have a renderPage function defined on window (i.e., it wasn't invoked).
      const renderPageType = await page.evaluate(() => typeof window.renderPage);
      expect(renderPageType).toBe('undefined');

      // Ensure no page errors occurred during initial load
      expect(pageErrors.length).toBe(0);

      // Ensure no console messages about array were emitted yet
      const foundArrayLog = consoleMessages.some((m) => m.includes('Array size'));
      expect(foundArrayLog).toBe(false);
    });
  });

  test.describe('Array Example State (S1_ArrayExample) and transitions', () => {
    test('Clicking Learn More triggers arrayExample() and logs "Array size: 1000000"', async ({ page }) => {
      // This test validates the transition S0 -> S1 on Learn More click and checks onEnter action arrayExample().
      // Ensure the function arrayExample exists on window
      const arrayExampleType = await page.evaluate(() => typeof window.arrayExample);
      expect(arrayExampleType).toBe('function');

      // Click Learn More and wait for the Console message containing the array size.
      const consolePromise = page.waitForEvent('console', {
        predicate: (msg) => msg.text().includes('Array size')
      });
      await page.click('.button-primary');
      const consoleMsg = await consolePromise;
      const text = consoleMsg.text();

      // Validate console log includes expected content and numeric size
      expect(text).toContain('Array size');
      expect(text).toContain('1000000');

      // Also ensure no page errors occurred as a result of clicking Learn More
      expect(pageErrors.length).toBe(0);

      // There is no DOM element with id "array" in the HTML; ensure it remains absent.
      const arrayElementExists = await page.$('#array');
      expect(arrayElementExists).toBeNull();
    });

    test('Clicking Clear Example after showing the example triggers a runtime error (TypeError) due to missing #array element', async ({ page }) => {
      // This test validates the transition S1 -> S0 via Clear Example and asserts the runtime error described by the implementation.
      // First, trigger the example so the FSM would be in S1_ArrayExample
      await page.click('.button-primary');
      // Wait for the array log to ensure arrayExample completed
      await page.waitForEvent('console', { predicate: (msg) => msg.text().includes('Array size') });

      // Now click Clear Example and expect a pageerror because clearExample tries to set innerHTML on a null element.
      const [error] = await Promise.all([
        page.waitForEvent('pageerror'),
        page.click('.button')
      ]);

      // The engine's exact message can vary between "Cannot set properties of null (setting 'innerHTML')"
      // and "Cannot read properties of null (reading 'innerHTML')". We assert it mentions null and innerHTML.
      const errMsg = typeof error === 'string' ? error : error.message || String(error);
      expect(errMsg.toLowerCase()).toContain('innerhtml');
      expect(errMsg.toLowerCase()).toContain('null');

      // Confirm that the captured pageErrors array includes the same message
      const captured = pageErrors.find((m) => m.toLowerCase().includes('innerhtml') && m.toLowerCase().includes('null'));
      expect(captured).toBeTruthy();
    });

    test('Clicking Clear Example from Idle (without running Learn More) also causes a runtime error (edge case)', async ({ page }) => {
      // This edge case validates that Clear Example alone triggers the same runtime error when #array is absent.
      const [error] = await Promise.all([
        page.waitForEvent('pageerror'),
        page.click('.button')
      ]);

      const errMsg = typeof error === 'string' ? error : error.message || String(error);
      expect(errMsg.toLowerCase()).toContain('innerhtml');
      expect(errMsg.toLowerCase()).toContain('null');

      // Also confirm our pageErrors array captured it
      const captured = pageErrors.find((m) => m.toLowerCase().includes('innerhtml') && m.toLowerCase().includes('null'));
      expect(captured).toBeTruthy();
    });

    test('Clicking Learn More twice emits two array size logs (edge case for repeated entry into S1)', async ({ page }) => {
      // This test validates repeated entry into the array example (S1) produces repeated console logs.
      // First click
      const firstConsolePromise = page.waitForEvent('console', { predicate: (msg) => msg.text().includes('Array size') });
      await page.click('.button-primary');
      const firstMsg = await firstConsolePromise;
      expect(firstMsg.text()).toContain('Array size');

      // Second click; the function will allocate again and log again. Wait for second console message.
      const secondConsolePromise = page.waitForEvent('console', { predicate: (msg) => msg.text().includes('Array size') });
      await page.click('.button-primary');
      const secondMsg = await secondConsolePromise;
      expect(secondMsg.text()).toContain('Array size');

      // Validate that at least two such messages are present in the captured consoleMessages collection
      const arrayLogs = consoleMessages.filter((m) => m.includes('Array size'));
      expect(arrayLogs.length).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe('Implementation surface checks and FSM evidence assertions', () => {
    test('Buttons have expected text and handlers per FSM evidence', async ({ page }) => {
      // Validate textual evidence and onclick attributes as extracted by FSM
      const learnMoreText = await page.locator('.button-primary').innerText();
      expect(learnMoreText).toBe('Learn More');

      const clearText = await page.locator('.button').innerText();
      expect(clearText).toBe('Clear Example');

      // Confirm onclick attributes match FSM evidence
      const learnAttr = await page.locator('.button-primary').getAttribute('onclick');
      expect(learnAttr).toBe('arrayExample()');

      const clearAttr = await page.locator('.button').getAttribute('onclick');
      expect(clearAttr).toBe('clearExample()');
    });

    test('FSM onEnter/onExit verification: arrayExample exists, renderPage does not, clearExample exists (function presence)', async ({ page }) => {
      // This test explicitly checks presence/absence of functions referenced by FSM entry/exit actions.
      const types = await page.evaluate(() => {
        return {
          renderPage: typeof window.renderPage,
          arrayExample: typeof window.arrayExample,
          clearExample: typeof window.clearExample
        };
      });

      // As implementation shows: arrayExample and clearExample should be functions; renderPage is not implemented
      expect(types.renderPage).toBe('undefined');
      expect(types.arrayExample).toBe('function');
      expect(types.clearExample).toBe('function');
    });
  });
});