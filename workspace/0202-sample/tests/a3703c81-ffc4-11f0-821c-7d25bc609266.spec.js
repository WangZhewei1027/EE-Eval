import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a3703c81-ffc4-11f0-821c-7d25bc609266.html';

// Page Object for the Hash Map demo page
class HashMapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demoBtn');
    this.result = page.locator('#demoResult');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickDemo() {
    await this.button.click();
  }

  async getButtonText() {
    return this.button.textContent();
  }

  async isButtonDisabled() {
    return this.button.isDisabled();
  }

  async getButtonCursorStyle() {
    return this.page.evaluate(() => {
      const btn = document.getElementById('demoBtn');
      return window.getComputedStyle(btn).cursor;
    });
  }

  async getResultText() {
    return this.result.textContent();
  }

  async resultHasSubstring(sub) {
    const txt = await this.getResultText();
    return txt.includes(sub);
  }

  async resultIsEmpty() {
    const txt = await this.getResultText();
    return !txt || txt.trim().length === 0;
  }

  async hasAriaLivePolite() {
    return this.result.getAttribute('aria-live').then(v => v === 'polite');
  }
}

test.describe('Comprehensive Hash Map Demo - FSM validation', () => {
  // Capture console and page errors across tests
  let consoleMessages = [];
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages for inspection
    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    // Collect uncaught page errors
    page.on('pageerror', error => {
      pageErrors.push(error);
    });
  });

  test.afterEach(async ({ page }) => {
    // Attach console output to test logs for easier debugging if needed
    if (consoleMessages.length) {
      // Intentionally left as a no-op to avoid altering behavior; Playwright will still show output on failure.
    }
  });

  test('Initial Idle state (S0_Idle) is rendered correctly', async ({ page }) => {
    // Validate initial UI: the "Show Simple Hash Map Demo" button and empty result div.
    const hmp = new HashMapPage(page);
    await hmp.goto();

    // The page must load without fatal network-level failures.
    await expect(page).toHaveURL(APP_URL);

    // Button should exist and show the expected label.
    await expect(hmp.button).toBeVisible();
    const btnText = await hmp.getButtonText();
    expect(btnText.trim()).toBe('Show Simple Hash Map Demo');

    // Button should be enabled in the Idle state.
    expect(await hmp.isButtonDisabled()).toBe(false);

    // Result area should exist, be empty initially, and have aria-live="polite".
    await expect(hmp.result).toBeVisible();
    expect(await hmp.resultIsEmpty()).toBe(true);
    expect(await hmp.hasAriaLivePolite()).toBe(true);

    // Ensure no uncaught page errors were emitted during initial load.
    expect(pageErrors.length).toBe(0);

    // No console.error messages expected on initial load for a well-formed page.
    expect(consoleErrors.length).toBe(0);
  });

  test('Clicking Show Demo transitions to Demo Shown (S1_DemoShown) and displays results', async ({ page }) => {
    // This test validates the transition triggered by the click event (#demoBtn)
    const hmp = new HashMapPage(page);
    await hmp.goto();

    // Click the demo button to trigger hashMapDemo and the FSM transition
    await hmp.clickDemo();

    // After clicking, the button should be disabled and text changed to 'Demo Shown'
    expect(await hmp.isButtonDisabled()).toBe(true);
    const newBtnText = await hmp.getButtonText();
    expect(newBtnText.trim()).toBe('Demo Shown');

    // Cursor style is set to default in the page's event handler; assert that change.
    const cursor = await hmp.getButtonCursorStyle();
    // Some browsers may return 'default' or 'auto' depending on computed style; accept either.
    expect(['default', 'auto']).toContain(cursor);

    // The demo result must contain expected parts of the output produced by hashMapDemo().
    const resultText = await hmp.getResultText();
    expect(resultText).toBeTruthy();

    // Check several expected substrings that indicate correct demo execution
    expect(resultText).toContain('Hash Table Size: 5');
    expect(resultText).toContain('Inserting entries:');
    expect(resultText).toContain('Hash Table Buckets (with chaining):');
    expect(resultText).toContain('Lookup examples:');
    // Example lookup expected results: 'Found value' or 'Key not found.' appear for lookup keys.
    expect(resultText).toMatch(/Found value:|Key not found\./);

    // No uncaught page errors should have occurred during the click handler execution
    expect(pageErrors.length).toBe(0);

    // Also no console.error on click handler execution
    expect(consoleErrors.length).toBe(0);
  });

  test('hashMapDemo function exists and can be invoked programmatically (idempotency check)', async ({ page }) => {
    // Validate that the demo function is exposed on the window and running it again produces a valid result
    const hmp = new HashMapPage(page);
    await hmp.goto();

    // Confirm function exists on window
    const fnType = await page.evaluate(() => typeof window.hashMapDemo);
    expect(fnType).toBe('function');

    // Call it once via the UI to produce initial output
    await hmp.clickDemo();
    const firstOutput = await hmp.getResultText();
    expect(firstOutput).toContain('Hash Table Size: 5');

    // Now invoke the function directly from page context to simulate re-running the demo
    // This should overwrite (not append) the demoResult content as the implementation sets textContent.
    await page.evaluate(() => {
      // Call the existing function; do not redefine or patch it.
      window.hashMapDemo();
    });

    const secondOutput = await hmp.getResultText();
    // The output should still contain the expected header and not be duplicated in a way that produces two headers.
    expect(secondOutput).toContain('Hash Table Size: 5');

    // Simple heuristic: count occurrences of the header to ensure not duplicated
    const headerCount = (secondOutput.match(/Hash Table Size: 5/g) || []).length;
    expect(headerCount).toBe(1);

    // The button should remain disabled after the first UI click; invoking hashMapDemo programmatically does not re-enable.
    expect(await hmp.isButtonDisabled()).toBe(true);

    // No unexpected page errors from programmatic invocation
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('renderPage missing: invoking renderPage() results in a ReferenceError (edge / error scenario)', async ({ page }) => {
    // The FSM entry_actions mentioned renderPage(), however the actual page does not define it.
    // This test intentionally attempts to call renderPage() in page context to observe the natural ReferenceError.
    const hmp = new HashMapPage(page);
    await hmp.goto();

    // Execute a page.evaluate that tries to call renderPage() by name (not via window) to provoke ReferenceError.
    const errorInfo = await page.evaluate(() => {
      try {
        // Calling renderPage() directly should throw a ReferenceError if it is not defined in the global scope.
        // We do not catch/handle it at page level beyond returning info; we let it happen naturally inside the evaluation.
        renderPage();
        return { thrown: false, type: null, message: null };
      } catch (e) {
        // Return error name and message for assertions in the test process.
        return { thrown: true, type: e && e.name ? e.name : null, message: e && e.message ? e.message : null };
      }
    });

    // The page did not define renderPage(), so a ReferenceError is expected.
    expect(errorInfo.thrown).toBe(true);
    // Different browsers may report slightly different messages, but the name should be 'ReferenceError'.
    expect(errorInfo.type).toBe('ReferenceError');

    // Because we invoked the call inside page.evaluate and caught the error there, it should not have emitted as a global pageerror.
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: ensure clicking disabled button does not change already shown demo output (user cannot re-trigger via UI)', async ({ page }) => {
    // Validate that once the demo is shown and the button disabled, a user click via the UI is ineffective.
    const hmp = new HashMapPage(page);
    await hmp.goto();

    // Show the demo via UI click
    await hmp.clickDemo();
    const before = await hmp.getResultText();

    // Attempt to click the button via Playwright's click (simulates user) - Playwright respects disabled state and will throw if not clickable.
    // To stay consistent with not patching the page, attempt a user-simulated click that should be ignored because the element is disabled.
    // We'll attempt to use JS to call element.click(); in HTML, a disabled button does not respond to user activation, but programmatic click() still triggers handlers.
    // Here we specifically simulate a user click by using Playwright's click which will fail if disabled; catch that to assert behavior.
    let clickError = null;
    try {
      await hmp.button.click({ timeout: 500 });
    } catch (e) {
      clickError = e;
    }

    // The click should either be ignored or Playwright will throw because the element is disabled/unable to be clicked.
    // We accept either: if Playwright threw, we captured the error; if it didn't throw, the event handler would have been triggered.
    // In either case, the demo output should not have duplicated content because hashMapDemo overwrites textContent.
    const after = await hmp.getResultText();
    expect(after).toBe(before);

    // If Playwright produced an error when trying to click a disabled element, assert that such an error occurred (ensures UI is indeed disabled)
    if (clickError) {
      // The error message should indicate the element is not visible or not enabled in a normal case.
      expect(String(clickError.message)).toMatch(/element|disabled|not/);
    }

    // No global page errors expected
    expect(pageErrors.length).toBe(0);
  });
});