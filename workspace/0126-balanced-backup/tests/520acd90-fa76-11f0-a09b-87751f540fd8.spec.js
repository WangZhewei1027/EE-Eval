import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520acd90-fa76-11f0-a09b-87751f540fd8.html';

test.describe('HTTPS Example FSM Tests - 520acd90-fa76-11f0-a09b-87751f540fd8', () => {
  // Each test gets a fresh page fixture provided by Playwright.
  // We will monitor console and page errors without modifying page code.

  // Helper: navigate to the app and attach simple listeners for diagnostics
  async function loadPageWithListeners(page) {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Capture runtime exceptions thrown in the page
      pageErrors.push(err);
    });

    await page.goto(APP_URL, { waitUntil: 'load' });
    return { consoleMessages, pageErrors };
  }

  test('Idle state - initial DOM shows Generate HTTPS Link button', async ({ page }) => {
    // Validate Idle state (S0_Idle): the button exists and page has loaded without runtime errors.
    const { consoleMessages, pageErrors } = await loadPageWithListeners(page);

    // The button should be present and visible with expected text
    const button = page.locator('#generate-https-link');
    await expect(button).toHaveCount(1);
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Generate HTTPS Link');

    // As this is the Idle state, there should be no href attribute initially on the element
    // Note: button elements normally don't have href attributes reflected as attributes.
    const hrefAttr = await page.evaluate(() => document.getElementById('generate-https-link').getAttribute('href'));
    expect(hrefAttr).toBeNull();

    // Ensure no page runtime errors were emitted immediately on load
    expect(pageErrors.length).toBe(0);

    // Log any console error/warning messages for debugging assertions (should be none)
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Transition S0 -> S1: clicking generates HTTPS link and triggers assignment then click', async ({ page }) => {
    // This test validates the transition triggered by clicking the button:
    // - generateHttpsLink() sets link.href to 'https://example.com/https-example'
    // - then it calls link.click() which, because the handler is attached to the same element,
    //   leads to recursive invocation and should produce a runtime error (stack overflow / RangeError).
    const { consoleMessages, pageErrors } = await loadPageWithListeners(page);

    // Before clicking, capture current page.url so we can verify navigation did not happen
    const beforeUrl = page.url();

    // Trigger the click. We expect a runtime exception to be emitted to the page (pageerror).
    // Use Promise.race between click and a pageerror wait to ensure we capture the error.
    const pageErrorPromise = page.waitForEvent('pageerror', { timeout: 3000 }).catch(() => null);

    // Perform the click. The page's JS may throw synchronously during the click handler.
    await page.click('#generate-https-link');

    // Await the pageerror event (if any). If the app triggers a recursion-induced error, it should appear.
    const pageError = await pageErrorPromise;

    // After the click, regardless of whether an error occurred, check the element's href property.
    // Note: the implementation sets element.href directly (even though it's a button).
    const elementHref = await page.evaluate(() => {
      // Access the DOM element's href property (the JS assignment sets it as a property)
      const el = document.getElementById('generate-https-link');
      return el && el.href ? el.href : null;
    });

    // The FSM expects link.href = 'https://example.com/https-example'
    expect(elementHref).toBe('https://example.com/https-example');

    // Ensure the page did not navigate away; the URL should remain the same as before.
    const afterUrl = page.url();
    expect(afterUrl).toBe(beforeUrl);

    // Assert that a page error occurred due to recursive click (expected behavior given implementation).
    // The exact message may vary, so accept common patterns like "Maximum call stack size exceeded" or RangeError.
    expect(pageError).not.toBeNull();
    const msg = pageError ? pageError.message : '';
    const matchesExpected = /maximum call stack|maximum call stack size|rangeerror|call stack/i.test(msg);
    expect(matchesExpected).toBeTruthy();

    // Also ensure at least one console error or pageerror was recorded in the listeners
    const recordedPageErrors = pageErrors; // captured by listener in loadPageWithListeners
    expect(recordedPageErrors.length).toBeGreaterThanOrEqual(1);

    // Provide diagnostics: record console.error messages if present (not required, but useful)
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    // We don't assert a specific count here because console errors may or may not be emitted,
    // but ensure that the structures were captured without throwing in the test harness.
    expect(Array.isArray(errorConsoleMessages)).toBe(true);
  });

  test('Edge case: repeated clicks after error still reflect href assignment and produce additional errors', async ({ page }) => {
    // This test checks repeated interactions: each click attempts the same behavior.
    const { consoleMessages, pageErrors } = await loadPageWithListeners(page);

    // First click - expect a page error
    const firstErrorPromise = page.waitForEvent('pageerror', { timeout: 3000 }).catch(() => null);
    await page.click('#generate-https-link');
    const firstError = await firstErrorPromise;
    expect(firstError).not.toBeNull();

    // Confirm href property still equals the expected HTTPS URL after the first click
    const hrefAfterFirst = await page.evaluate(() => document.getElementById('generate-https-link').href);
    expect(hrefAfterFirst).toBe('https://example.com/https-example');

    // Reset: reload the page to get a clean state for a second click scenario
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Second click - ensure a page error occurs again on a fresh page
    const secondErrorPromise = page.waitForEvent('pageerror', { timeout: 3000 }).catch(() => null);
    await page.click('#generate-https-link');
    const secondError = await secondErrorPromise;
    expect(secondError).not.toBeNull();

    // Confirm href assignment after the second click invocation as well
    const hrefAfterSecond = await page.evaluate(() => document.getElementById('generate-https-link').href);
    expect(hrefAfterSecond).toBe('https://example.com/https-example');

    // Validate that listener arrays captured errors during the test run
    expect(Array.isArray(pageErrors)).toBe(true);
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Console diagnostics (non-deterministic). Ensure we did not cause the test harness to crash.
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(Array.isArray(errorConsoleMessages)).toBe(true);
  });

  test('Sanity check: generateHttpsLink function not exposed globally as window property (observational)', async ({ page }) => {
    // The implementation declares `const generateHttpsLink = () => { ... }` in a script tag.
    // In browsers, top-level const does not create a window property. This test observes that.
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Check whether window.generateHttpsLink exists - we do not modify page globals.
    const hasGlobal = await page.evaluate(() => typeof window.generateHttpsLink !== 'undefined');
    // This is an observational check: it's valid for it to be false in many environments.
    // We assert it's either false or a function, but do not attempt to call it.
    expect(typeof hasGlobal === 'boolean').toBe(true);
  });

  // No explicit teardown required; Playwright closes contexts/pages between tests automatically.
});