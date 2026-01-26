import { test, expect } from '@playwright/test';

test.describe('OSI Model interactive app - f5b2cd71-fa7c-11f0-adc7-178f556b1ee0', () => {
  const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b2cd71-fa7c-11f0-adc7-178f556b1ee0.html';

  // Page object for the demonstration button and common queries
  class OSIPage {
    constructor(page) {
      this.page = page;
      this.demonstration = page.locator('#demonstration');
      this.header = page.locator('h1');
      this.container = page.locator('.container');
    }

    async goto() {
      await this.page.goto(APP_URL, { waitUntil: 'load' });
    }

    async isButtonVisible() {
      return this.demonstration.isVisible();
    }

    async getButtonText() {
      return this.demonstration.textContent();
    }

    async clickDemonstration() {
      await this.demonstration.click();
    }

    async clickHeader() {
      await this.header.click();
    }
  }

  // Shared collectors for console messages and page errors
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors for each test so tests can assert on them
    consoleMessages = [];
    pageErrors = [];

    // Observe console messages (logs, errors, warnings, etc.)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Observe unhandled page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (error) => {
      // store Error objects for detailed assertions
      pageErrors.push(error);
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Ensure page is closed if necessary (Playwright handles this in fixtures,
    // but explicit teardown helps clarity)
    try {
      await page.close();
    } catch (e) {
      // ignore errors closing page in teardown
    }
  });

  test('Initial Idle state: button is rendered and visible with correct text', async ({ page }) => {
    // Validate the S0_Idle state: renderPage() is listed in FSM but not present as a function.
    // We assert the observable evidence: the demonstration button exists and is visible.
    const osi = new OSIPage(page);

    // Button should be visible and present in the DOM
    await expect(osi.demonstration).toBeVisible();

    // Button text must match the FSM/component extraction
    const text = await osi.getButtonText();
    expect(text?.trim()).toBe('Click here to see a demonstration');

    // No page errors should have occurred just from loading the page (Idle state)
    expect(pageErrors.length).toBe(0);

    // No console messages indicating startDemonstration/renderPage should be present
    const hasStartDemonstrationLog = consoleMessages.some(m => m.text.includes('startDemonstration'));
    const hasRenderPageLog = consoleMessages.some(m => m.text.includes('renderPage'));
    expect(hasStartDemonstrationLog).toBe(false);
    expect(hasRenderPageLog).toBe(false);
  });

  test('Transition on click: clicking the demonstration button triggers runtime error (Socket not defined)', async ({ page }) => {
    // This validates the transition S0_Idle -> S1_Demonstration on "DemonstrationClick".
    // The page implementation attempts to use a non-existent Socket constructor which should raise an error.
    const osi = new OSIPage(page);

    // Ensure no errors before clicking
    expect(pageErrors.length).toBe(0);

    // Start waiting for the pageerror event that should result from the missing Socket
    const pageErrorPromise = page.waitForEvent('pageerror');

    // Perform the click that triggers the demonstration code
    await osi.clickDemonstration();

    // Await the runtime error event
    const error = await pageErrorPromise;

    // The implementation attempts: var socket = new Socket(...);
    // We expect a ReferenceError mentioning "Socket" or similar since Socket is not defined.
    expect(error).toBeTruthy();
    const message = String(error.message || error.toString());
    expect(message).toMatch(/Socket/i);

    // Confirm that console did not log "Received data" or "Connection closed" (those are in socket callbacks)
    const receivedDataLog = consoleMessages.some(m => /Received data/i.test(m.text));
    const closedLog = consoleMessages.some(m => /Connection closed/i.test(m.text));
    expect(receivedDataLog).toBe(false);
    expect(closedLog).toBe(false);
  });

  test('Multiple clicks produce multiple runtime errors (repeated transition attempts)', async ({ page }) => {
    // Test edge behavior: clicking the demonstration button repeatedly should cause repeated runtime errors
    // due to the missing Socket constructor in each handler invocation.
    const osi = new OSIPage(page);

    // Ensure fresh start
    expect(pageErrors.length).toBe(0);

    // Click twice and wait for two pageerror events.
    // Use two separate waitForEvent calls started before each click to avoid missing synchronous errors.
    const firstErrorPromise = page.waitForEvent('pageerror');
    await osi.clickDemonstration();
    const firstError = await firstErrorPromise;
    expect(String(firstError.message || firstError.toString())).toMatch(/Socket/i);

    // Second click should similarly produce an error
    const secondErrorPromise = page.waitForEvent('pageerror');
    await osi.clickDemonstration();
    const secondError = await secondErrorPromise;
    expect(String(secondError.message || secondError.toString())).toMatch(/Socket/i);

    // At least two pageErrors captured overall
    expect(pageErrors.length).toBeGreaterThanOrEqual(2);
  });

  test('Clicking a non-trigger element (header) does not invoke demonstration handler nor produce errors', async ({ page }) => {
    // Edge case: ensure that clicks on elements other than the demonstration button do not cause the transition
    const osi = new OSIPage(page);

    // Capture current error count
    const beforeErrors = pageErrors.length;

    // Click the header which should be inert with respect to the FSM transition
    await osi.clickHeader();

    // Give a short window to allow unexpected errors to surface
    await page.waitForTimeout(250);

    // No new errors should have been introduced by clicking the header
    expect(pageErrors.length).toBe(beforeErrors);

    // No console logs corresponding to socket or demonstration should appear
    const socketConsole = consoleMessages.some(m => /Socket/i.test(m.text));
    expect(socketConsole).toBe(false);
  });

  test('FSM entry/exit actions verification: ensure expected functions are not silently called', async ({ page }) => {
    // The FSM mentions entry actions renderPage() for Idle and startDemonstration() for Demonstration.
    // The actual implementation does not define these functions. We assert that:
    // - No console logs indicate these functions were called.
    // - The attempt to perform the demonstration results in the observed Socket error instead.
    const osi = new OSIPage(page);

    // Assert no logs referring to renderPage or startDemonstration on initial load
    const logsBefore = consoleMessages.map(m => m.text).join('\n');
    expect(/renderPage/i.test(logsBefore)).toBe(false);
    expect(/startDemonstration/i.test(logsBefore)).toBe(false);

    // Trigger demonstration and ensure the observed error matches the implementation's behavior
    const pageErrorPromise = page.waitForEvent('pageerror');
    await osi.clickDemonstration();
    const error = await pageErrorPromise;
    expect(String(error.message || error.toString())).toMatch(/Socket/i);
  });
});