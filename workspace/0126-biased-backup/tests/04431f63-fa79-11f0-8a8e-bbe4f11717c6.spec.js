import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04431f63-fa79-11f0-8a8e-bbe4f11717c6.html';

test.describe('Sliding Window (FSM) - Application 04431f63-fa79-11f0-8a8e-bbe4f11717c6', () => {
  // Arrays to collect page-level errors and console messages for each test
  let pageErrors = [];
  let consoleMessages = [];

  // Attach listeners and load the page before each test so we capture errors during initial script execution.
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture unhandled page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      // store the Error object for assertions
      pageErrors.push(err);
    });

    // Capture console messages for debugging/visibility assertions
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the application URL (this will execute the inline script)
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Ensure listeners are removed to avoid leaks between tests (Playwright will clean up pages, but being explicit)
    page.removeAllListeners('pageerror');
    page.removeAllListeners('console');
  });

  test('Initialization state: init() is invoked on load and results in a page error due to missing #window element', async ({ page }) => {
    // The implementation calls init() on load and attempts to access document.getElementById("window").style,
    // but the HTML does not include an element with id="window". We expect a TypeError (or similar) to be emitted as a pageerror.
    expect(pageErrors.length).toBeGreaterThan(0);

    // At least one of the collected errors should be a TypeError that mentions null / undefined access to .style
    const hasTypeError = pageErrors.some(err => {
      if (!err || !err.name || !err.message) return false;
      return err.name === 'TypeError' || /Cannot read (properties|property) of null|cannot set property|Cannot set properties of undefined/i.test(err.message);
    });
    expect(hasTypeError).toBeTruthy();

    // Also assert that console messages were captured (if any)
    // This is not required to be non-empty, but helps verify we recorded console output if present.
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });

  test('UI components: two buttons with expected labels are present', async ({ page }) => {
    // Ensure there are exactly two .button elements and their text matches the FSM evidence
    const buttons = await page.$$('.button');
    expect(buttons.length).toBeGreaterThanOrEqual(2); // HTML shows two .button elements

    // Verify the text content of the first two buttons
    const texts = await Promise.all(buttons.slice(0, 2).map(async (b) => (await b.textContent()).trim()));
    // The HTML has "Click Me" and "Click Again" in that order in this page
    expect(texts).toContain('Click Me');
    expect(texts).toContain('Click Again');
  });

  test('Event: clicking .button elements does not unexpectedly fix the missing #window; no new pageerrors should be introduced by clicks', async ({ page }) => {
    // Record number of page errors that happened during initial load
    const initialErrorCount = pageErrors.length;

    // Click all buttons found on the page
    const buttons = await page.$$('.button');
    for (const b of buttons) {
      await b.click();
    }

    // Give the page a short moment to react (if it had handlers)
    await page.waitForTimeout(250);

    // Because the page's script did not attach click handlers to call updateWindow on click,
    // clicking should not produce additional page errors (the primary error occurred during init).
    expect(pageErrors.length).toBe(initialErrorCount);
  });

  test('Transition action: invoking updateWindow() directly should throw a TypeError due to missing #window', async ({ page }) => {
    // The script defines updateWindow() in the global scope before calling init().
    // Even though init() threw, updateWindow should exist. Calling it should attempt to access #window and throw.

    // Ensure updateWindow is present
    const updateWindowType = await page.evaluate(() => typeof window.updateWindow !== 'undefined' ? 'function' : typeof window.updateWindow);
    expect(updateWindowType).toBe('function');

    // Call updateWindow via page.evaluate and assert that it throws (we expect a rejected promise).
    let caughtError = null;
    try {
      // Do not catch inside the page - let the exception propagate to Playwright so we can assert its message.
      await page.evaluate(() => updateWindow());
      // If it did not throw, that's unexpected for this broken environment.
      throw new Error('Expected updateWindow() to throw, but it completed without exception');
    } catch (err) {
      // Playwright surfaces the page exception as a thrown error. Capture it for assertions.
      caughtError = err;
    }

    expect(caughtError).not.toBeNull();
    // The Playwright error message should indicate a TypeError originating from the page evaluation.
    // Accept a few possible phrasings across browser versions.
    const errMsg = String(caughtError.message);
    expect(/TypeError/i.test(errMsg)).toBeTruthy();
    expect(/null|undefined|Cannot read|Cannot set|reading 'style'|reading "style"/i.test(errMsg)).toBeTruthy();

    // Also confirm that another pageerror was emitted as a result of calling updateWindow()
    const hasNewPageError = pageErrors.some(err => err && err.name === 'TypeError' && /style/i.test(err.message));
    expect(hasNewPageError).toBeTruthy();
  });

  test('Edge case: invoking init() again should also produce an error (reentry attempt)', async ({ page }) => {
    // Attempt to call init() directly. Because init() previously threw during initial load, calling it now should also attempt the same DOM access and throw.
    let thrown = null;
    try {
      await page.evaluate(() => init());
      throw new Error('Expected init() to throw when invoked again, but it did not.');
    } catch (err) {
      thrown = err;
    }

    expect(thrown).not.toBeNull();
    expect(/TypeError/i.test(thrown.message)).toBeTruthy();

    // Confirm that at least one pageerror refers to init or the same missing element issue.
    const initErrorPresent = pageErrors.some(err => err && err.name === 'TypeError' && /style/i.test(err.message));
    expect(initErrorPresent).toBeTruthy();
  });

  test('Robustness: resizing the viewport should not cause additional runtime errors in this broken initialization scenario', async ({ page }) => {
    // Record initial error count
    const initialErrorCount = pageErrors.length;

    // Change viewport size to simulate a window resize (the code attempts to add a resize handler, but init likely failed before adding)
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(200);

    // If the resize handler was not successfully attached (due to earlier error), no new errors should appear.
    expect(pageErrors.length).toBe(initialErrorCount);
  });

  test('Sanity: ensure that missing #window prevents state evidence DOM updates (no #window element present)', async ({ page }) => {
    // The FSM evidence expects an element with id "window" to exist and have inline styles set.
    const windowElement = await page.$('#window');
    // We expect it to be missing in the provided HTML.
    expect(windowElement).toBeNull();
  });

});