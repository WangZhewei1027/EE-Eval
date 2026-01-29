import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b03563-fa7c-11f0-adc7-178f556b1ee0.html';

// Page object for the Heap (Max) Explanation app
class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoButton = page.locator('#demonstration-button');
    this.textElement = page.locator('#text');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickDemonstrate() {
    await this.demoButton.click();
  }

  async getTextContent() {
    return this.textElement.textContent();
  }

  async isDemoButtonVisible() {
    return this.demoButton.isVisible();
  }

  async getDemoButtonText() {
    return this.demoButton.textContent();
  }
}

test.describe('Heap (Max) Explanation - FSM validation', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages = [];
  let pageErrors = [];
  let consoleHandler;
  let pageErrorHandler;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Attach console listener to capture console.log output from the page
    consoleHandler = msg => {
      // Normalize text for easier assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    };
    page.on('console', consoleHandler);

    // Attach page error listener to capture runtime exceptions (e.g., TypeError)
    pageErrorHandler = error => {
      pageErrors.push(error);
    };
    page.on('pageerror', pageErrorHandler);
  });

  test.afterEach(async ({ page }) => {
    // Detach listeners to avoid leaking between tests
    if (consoleHandler) page.off('console', consoleHandler);
    if (pageErrorHandler) page.off('pageerror', pageErrorHandler);
    consoleHandler = null;
    pageErrorHandler = null;
  });

  test('S0_Idle: initial state should render the page and show the demonstration button', async ({ page }) => {
    // This test verifies the Idle state (S0_Idle) from the FSM:
    // - The page loads without executing any missing onEnter actions that would throw
    // - The demonstration button is present and visible
    // - The text area is present (but not modified by entry actions)
    const app = new AppPage(page);
    await app.goto();

    // Verify that the "renderPage" function mentioned in the FSM is not present on the window.
    // The FSM mentioned renderPage() as an entry action, but implementation does not define it.
    // We assert that it is undefined (i.e., it wasn't called because it doesn't exist).
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // The page should not have emitted any errors on load (the main runtime error is triggered later on click)
    expect(pageErrors.length).toBe(0);

    // The demonstration button should exist and be visible/enabled
    expect(await app.isDemoButtonVisible()).toBe(true);
    const btnText = await app.getDemoButtonText();
    expect(btnText).toContain('Demonstrate Heap (Max) Operation');

    // The text paragraph should be present and initially empty (implementation writes nothing into it)
    const initialText = await app.getTextContent();
    // Could be null or empty string depending on browser; assert it's falsy or whitespace
    expect(initialText === null || initialText.trim() === '').toBeTruthy();
  });

  test('S1_Demonstrating: clicking the demonstration button triggers heap logs and a runtime TypeError', async ({ page }) => {
    // This test verifies the transition S0_Idle -> S1_Demonstrating:
    // - The event handler demonstrateHeapMax is attached (validated by observing console output)
    // - The console logs include "Heap (Max) elements:" and "Extracted maximum element:"
    // - A runtime TypeError occurs due to reassigning a const (we assert that pageerror is raised)
    const app = new AppPage(page);
    await app.goto();

    // Sanity check: the demonstrateHeapMax function should exist in the page global scope
    const demoFnType = await page.evaluate(() => typeof window.demonstrateHeapMax);
    expect(demoFnType).toBe('function');

    // Click the demonstration button and wait for the pageerror to be emitted.
    // The function logs several messages and then throws when attempting to reassign a const.
    const [error] = await Promise.all([
      page.waitForEvent('pageerror'),
      app.clickDemonstrate()
    ]);

    // Ensure at least one pageerror was captured via both page.waitForEvent and listener
    expect(error).toBeTruthy();
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // The specific runtime error expected is a TypeError from "Assignment to constant variable."
    // We assert that the error message includes "Assignment to constant" which is typical for Chromium.
    const message = error && error.message ? error.message : pageErrors[0].message;
    expect(message).toMatch(/Assignment to constant/i);

    // Confirm console messages prior to the error contain expected observables
    // The FSM expected observables: "Heap (Max) elements:", "Extracted maximum element:"
    const messagesText = consoleMessages.map(m => m.text).join('\n');
    expect(messagesText).toMatch(/Heap \(Max\) elements:/);
    expect(messagesText).toMatch(/Extracted maximum element:/);

    // Verify that even after the error, the page DOM was not unexpectedly altered by the demo function
    const postClickText = await app.getTextContent();
    expect(postClickText === null || postClickText.trim() === '').toBeTruthy();
  });

  test('Transition behavior: multiple clicks produce repeated errors and logs (edge case)', async ({ page }) => {
    // Edge case test:
    // - Clicking the demo button multiple times should trigger the handler each time.
    // - Each invocation should produce console logs and an unhandled TypeError.
    const app = new AppPage(page);
    await app.goto();

    // Helper to click and wait for error
    async function clickAndWaitForError() {
      return Promise.all([
        page.waitForEvent('pageerror'),
        app.clickDemonstrate()
      ]);
    }

    // First click
    const [firstError] = await clickAndWaitForError();
    expect(firstError).toBeTruthy();
    expect(firstError.message).toMatch(/Assignment to constant/i);

    // Clear captured console and errors arrays to isolate the second click assertions
    consoleMessages = [];
    pageErrors = [];

    // Second click should again run the handler and produce similar logs and error
    const [secondError] = await clickAndWaitForError();
    expect(secondError).toBeTruthy();
    expect(secondError.message).toMatch(/Assignment to constant/i);

    // Confirm logs were also produced during the second invocation
    const messagesText = consoleMessages.map(m => m.text).join('\n');
    expect(messagesText).toMatch(/Heap \(Max\) elements:/);
    expect(messagesText).toMatch(/Extracted maximum element:/);
  });

  test('Event handler attachment validation: clicking verifies addEventListener existence via effects', async ({ page }) => {
    // There is no direct browser API to introspect addEventListener registrations reliably across browsers,
    // so validate that the event handler is attached by observing its side effects when clicking the button.
    const app = new AppPage(page);
    await app.goto();

    // Ensure no console logs prior to clicking
    expect(consoleMessages.length).toBe(0);

    // Click and wait for error as evidence the handler executed
    const [err] = await Promise.all([page.waitForEvent('pageerror'), app.clickDemonstrate()]);
    expect(err).toBeTruthy();

    // The presence of heap-related logs prove the handler ran (i.e., addEventListener attached successfully)
    const texts = consoleMessages.map(m => m.text);
    expect(texts.some(t => t.includes('Heap (Max) elements:'))).toBeTruthy();
  });

  test('Implementation sanity checks: verify Heap class exists and key functions are globally accessible', async ({ page }) => {
    // Validate that core symbols from the implementation are available on the page.
    // This helps ensure the implementation loaded and that FSM states referencing these constructs are meaningful.
    const app = new AppPage(page);
    await app.goto();

    // The Heap constructor should be available in the global scope (script is non-module)
    const heapType = await page.evaluate(() => typeof window.Heap);
    expect(heapType).toBe('function');

    // demonstrateHeapMax should be a function as already asserted in other tests
    const demoFnType = await page.evaluate(() => typeof window.demonstrateHeapMax);
    expect(demoFnType).toBe('function');

    // Confirm that the demo function when stringified contains "console.log" to indicate it outputs the expected observables
    const demoFnSource = await page.evaluate(() => window.demonstrateHeapMax.toString());
    expect(demoFnSource).toContain('console.log');
    expect(demoFnSource).toContain('Heap (Max) elements:');
  });
});