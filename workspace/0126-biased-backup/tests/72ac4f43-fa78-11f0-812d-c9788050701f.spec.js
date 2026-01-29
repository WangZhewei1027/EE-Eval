import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ac4f43-fa78-11f0-812d-c9788050701f.html';

test.describe('HTTP Visualization FSM - 72ac4f43-fa78-11f0-812d-c9788050701f', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait a bit longer than the initial animation timer so initial animateNewItems() run finishes
    await page.waitForTimeout(1000);
  });

  test.afterEach(async () => {
    // Sanity check for unexpected page errors after each test - these assertions are per-test specific below as well
    // (No teardown modifications to the page are performed)
  });

  test.describe('State: S0_Idle (Initial state)', () => {
    test('Initial Idle state shows default request and response items and runs initial animation', async ({ page }) => {
      // Verify that request and response lists have their initial 3 items each
      const requestItems = page.locator('.request-list .request-item');
      const responseItems = page.locator('.response-list .response-item');

      await expect(requestItems).toHaveCount(3);
      await expect(responseItems).toHaveCount(3);

      // Verify one of the initial request lines is the expected GET /index.html HTTP/1.1
      await expect(requestItems.nth(0)).toHaveText(/GET\s+\/index\.html\s+HTTP\/1\.1/);

      // The FSM entry action is animateNewItems(); verify that the function exists on the page
      const animateExists = await page.evaluate(() => typeof animateNewItems === 'function');
      expect(animateExists).toBe(true);

      // After initial animation we expect items to reach full opacity (animation sets inline style opacity to '1')
      // We already waited in beforeEach, but double check the computed style
      const reqOpacity = await requestItems.first().evaluate(el => window.getComputedStyle(el).opacity);
      const resOpacity = await responseItems.first().evaluate(el => window.getComputedStyle(el).opacity);
      expect(reqOpacity).toBe('1');
      expect(resOpacity).toBe('1');

      // Ensure there are no uncaught page errors during initial load/animation
      expect(pageErrors.length).toBe(0);

      // Ensure there are no console.error messages captured during initial state
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Event: NewRequest -> Transition S0_Idle to S1_RequestSent', () => {
    test('Clicking New Request replaces request items immediately and populates response after delay', async ({ page }) => {
      const newRequestButton = page.locator('#newRequest');
      const requestList = page.locator('.request-list');
      const responseList = page.locator('.response-list');

      // Ensure button is visible and enabled
      await expect(newRequestButton).toBeVisible();
      await expect(newRequestButton).toBeEnabled();

      // Capture current content for comparison
      const initialRequestHtml = await requestList.innerHTML();
      const initialResponseHtml = await responseList.innerHTML();
      expect(initialRequestHtml).toContain('GET /index.html HTTP/1.1');
      expect(initialResponseHtml).toContain('HTTP/1.1 200 OK');

      // Click New Request - per implementation this clears lists then sets new request items immediately and response after ~800ms
      await newRequestButton.click();

      // Immediately after click: request-list should have new items (not equal to initial HTML)
      const postClickRequestHtml = await requestList.innerHTML();
      expect(postClickRequestHtml).not.toBe(initialRequestHtml);

      // Immediately after click: response-list should be cleared (no .response-item)
      await expect(page.locator('.response-list .response-item')).toHaveCount(0);

      // Verify new request first item includes an HTTP/1.1 line and one of expected methods
      const newReqFirst = page.locator('.request-list .request-item').first();
      await expect(newReqFirst).toHaveText(/(GET|POST|PUT|DELETE)\s+\/[^\s]*\s+HTTP\/1\.1/);

      // Wait for the response to appear (implementation uses setTimeout 800ms)
      await expect(page.locator('.response-list .response-item')).toHaveCount(3, { timeout: 2000 });

      // Once responses are present, the first response item should include 'HTTP/1.1' and a 3-digit code
      const respFirstText = await page.locator('.response-list .response-item').first().innerText();
      expect(respFirstText).toMatch(/HTTP\/1\.1\s+\d{3}\s+/);

      // Verify animateNewItems was invoked for response items: computed opacity should be 1
      const respOpacity = await page.locator('.response-list .response-item').first().evaluate(el => window.getComputedStyle(el).opacity);
      expect(respOpacity).toBe('1');

      // Ensure no uncaught exceptions or console.error occurred during the transition
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0, `console.error messages found: ${JSON.stringify(consoleErrors)}`);
      expect(pageErrors.length).toBe(0);
    });

    test('Rapidly clicking New Request multiple times does not cause uncaught exceptions', async ({ page }) => {
      const newRequestButton = page.locator('#newRequest');

      // Click multiple times in quick succession
      await newRequestButton.click();
      await newRequestButton.click();
      await newRequestButton.click();

      // Allow time for the last response to be populated
      await page.waitForTimeout(1200);

      // Expect responses to exist (3 items)
      await expect(page.locator('.response-list .response-item')).toHaveCount(3);

      // Check there are no uncaught errors from rapid clicking
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Event: ResetView -> Transition S1_RequestSent to S0_Idle', () => {
    test('Clicking Reset restores initial request and response lists and triggers animation', async ({ page }) => {
      const newRequestButton = page.locator('#newRequest');
      const resetButton = page.locator('#resetView');

      // Generate a new request first to ensure we are in S1_RequestSent
      await newRequestButton.click();

      // Wait for the response to be populated
      await expect(page.locator('.response-list .response-item')).toHaveCount(3, { timeout: 2000 });

      // Now click Reset to return to Idle state
      await resetButton.click();

      // After reset, request-list and response-list should contain the original default HTML lines
      const requestItems = page.locator('.request-list .request-item');
      const responseItems = page.locator('.response-list .response-item');

      await expect(requestItems).toHaveCount(3);
      await expect(responseItems).toHaveCount(3);

      // Verify reset content matches initial expected strings
      await expect(requestItems.nth(0)).toHaveText(/GET\s+\/index\.html\s+HTTP\/1\.1/);
      await expect(responseItems.nth(0)).toHaveText(/HTTP\/1\.1\s+200\s+OK/);

      // Verify animateNewItems exists and was triggered (inline styles should show items animated to opacity 1)
      const reqOpacity = await requestItems.first().evaluate(el => window.getComputedStyle(el).opacity);
      const resOpacity = await responseItems.first().evaluate(el => window.getComputedStyle(el).opacity);
      expect(reqOpacity).toBe('1');
      expect(resOpacity).toBe('1');

      // Ensure no uncaught exceptions or console.error messages during reset
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Edge case: clicking Reset immediately after New Request (race condition) results in stable Idle state', async ({ page }) => {
      const newRequestButton = page.locator('#newRequest');
      const resetButton = page.locator('#resetView');

      // Click newRequest and immediately reset to simulate a race
      await newRequestButton.click();
      await resetButton.click();

      // Wait longer than the response timeout to ensure any pending setTimeout handlers have completed
      await page.waitForTimeout(1200);

      // Confirm final state is Idle (reset content)
      const requestItems = page.locator('.request-list .request-item');
      const responseItems = page.locator('.response-list .response-item');

      await expect(requestItems).toHaveCount(3);
      await expect(responseItems).toHaveCount(3);

      await expect(requestItems.nth(0)).toHaveText(/GET\s+\/index\.html\s+HTTP\/1\.1/);
      await expect(responseItems.nth(0)).toHaveText(/HTTP\/1\.1\s+200\s+OK/);

      // Ensure no uncaught exceptions happened during the race
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('API surface and robustness checks', () => {
    test('animateNewItems function is part of the page and callable without throwing', async ({ page }) => {
      // Ensure the function exists
      const exists = await page.evaluate(() => typeof animateNewItems === 'function');
      expect(exists).toBe(true);

      // Call animateNewItems from the page and ensure it does not throw (it uses DOM APIs)
      const result = await page.evaluate(() => {
        try {
          animateNewItems();
          return { threw: false };
        } catch (err) {
          return { threw: true, message: String(err) };
        }
      });
      expect(result.threw).toBe(false);

      // No page errors should have been recorded by invoking the function
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('UI controls exist and are accessible', async ({ page }) => {
      const newRequestButton = page.locator('#newRequest');
      const resetButton = page.locator('#resetView');

      await expect(newRequestButton).toBeVisible();
      await expect(newRequestButton).toHaveText('New Request');

      await expect(resetButton).toBeVisible();
      await expect(resetButton).toHaveText('Reset');

      // Buttons should be interactive
      await expect(newRequestButton).toBeEnabled();
      await expect(resetButton).toBeEnabled();
    });
  });
});