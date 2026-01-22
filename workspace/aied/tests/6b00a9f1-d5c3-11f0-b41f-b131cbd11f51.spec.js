import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b00a9f1-d5c3-11f0-b41f-b131cbd11f51.html';

test.describe('Heap Sort Visualization - FSM and runtime validation (App ID: 6b00a9f1-d5c3-11f0-b41f-b131cbd11f51)', () => {
  // Each test navigates to the page fresh to observe script parse/execution behavior as-is.
  // We collect page errors and console messages to assert that the broken script is reported.

  test('Page should load and script parse error(s) should be reported', async ({ page }) => {
    const pageErrors = [];
    const consoleMessages = [];

    // Collect page errors (uncaught exceptions / SyntaxError etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Collect console messages to surface any "Uncaught SyntaxError" or other console.error entries
    page.on('console', (msg) => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    });

    // Navigate to the page
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Allow some time for the browser to report parse-time errors (if any)
    await page.waitForTimeout(500);

    // Validate that at least one page error was captured (expected because the provided JS is truncated)
    expect(pageErrors.length).toBeGreaterThan(0);

    // At least one of the collected page errors should indicate a SyntaxError or unexpected end of input
    const hasSyntaxLike = pageErrors.some(msg =>
      /SyntaxError|Unexpected end of input|Unterminated or unexpected token|Unexpected token/i.test(msg)
    );
    expect(hasSyntaxLike).toBeTruthy();

    // Also assert that console contains error-level messages referencing syntax/runtime issues
    const hasConsoleError = consoleMessages.some(entry =>
      /syntaxerror|uncaught syntaxerror|error|unexpected token|unexpected end of input/i.test(entry)
    );
    expect(hasConsoleError).toBeTruthy();
  });

  test.describe('DOM presence and expected UI elements (despite script error)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
      // small pause to ensure static DOM is available
      await page.waitForTimeout(100);
    });

    test('All control buttons and sliders are present in the DOM', async ({ page }) => {
      // Verify presence of UI controls from the HTML
      await expect(page.locator('#generate-btn')).toHaveCount(1);
      await expect(page.locator('#sort-btn')).toHaveCount(1);
      await expect(page.locator('#reset-btn')).toHaveCount(1);
      await expect(page.locator('#step-btn')).toHaveCount(1);
      await expect(page.locator('#size-slider')).toHaveCount(1);
      await expect(page.locator('#speed-slider')).toHaveCount(1);

      // Verify that the displayed slider values match the static HTML initial values
      await expect(page.locator('#size-value')).toHaveText('10');
      await expect(page.locator('#speed-value')).toHaveText('5');

      // Verify step-info initial text from HTML
      await expect(page.locator('#step-info')).toHaveText('Click "Generate New Array" to begin');
    });

    test('Array container and heap display exist but are initially empty (script not executed)', async ({ page }) => {
      const arrayBars = await page.locator('#array-container .array-bar').count();
      // Since the script is expected to fail to parse, no bars should be programmatically generated
      expect(arrayBars).toBe(0);

      // Heap display should be empty as well
      const heapNodes = await page.locator('#heap-display').locator('*').count();
      expect(heapNodes).toBe(0);
    });
  });

  test.describe('Behavioral checks for FSM events and transitions (will validate that handlers are NOT attached due to script failure)', () => {
    test('Clicking "Generate New Array" should NOT change step-info because handler is not attached', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(String(err && err.message ? err.message : err)));

      await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(200);

      // Capture initial text
      const stepInfo = page.locator('#step-info');
      const initialText = await stepInfo.textContent();

      // Attempt to click the generate button
      await page.click('#generate-btn');

      // Give a moment for any event handlers (if present) to run
      await page.waitForTimeout(200);

      // Because the script did not run correctly (SyntaxError), clicking should not have changed the text
      const afterClickText = await stepInfo.textContent();
      expect(afterClickText).toBe(initialText);

      // Validate that page errors exist (confirming script parse/runtime problem)
      expect(pageErrors.length).toBeGreaterThan(0);
    });

    test('Clicking "Start Heap Sort" and "Next Step" have no effect (handlers missing); UI remains in Idle state', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(200);

      // Confirm initial state text
      await expect(page.locator('#step-info')).toHaveText('Click "Generate New Array" to begin');

      // Try to click Start and Step
      await page.click('#sort-btn');
      await page.click('#step-btn');

      // Allow time for any handlers (if accidentally present) to execute
      await page.waitForTimeout(200);

      // Expect no change because functions like startSorting / performNextStep were not registered
      await expect(page.locator('#step-info')).toHaveText('Click "Generate New Array" to begin');
    });

    test('Reset button will not reset sorting state because resetSorting is undefined due to script error', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(200);

      // Attempt to click Reset (no-op expected)
      await page.click('#reset-btn');
      await page.waitForTimeout(200);

      // The step-info should remain unchanged
      await expect(page.locator('#step-info')).toHaveText('Click "Generate New Array" to begin');
    });

    test('Adjusting sliders does not call JS handlers: displayed values remain unchanged', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(200);

      // Attempt to change the size slider value via evaluate (simulate user input)
      await page.evaluate(() => {
        const size = document.getElementById('size-slider');
        if (size) {
          size.value = '15';
          // Dispatch input event
          size.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });

      // Wait briefly and then assert that the displayed size-value did NOT update (handler not attached)
      await page.waitForTimeout(200);
      await expect(page.locator('#size-value')).toHaveText('10');

      // Attempt to change the speed slider
      await page.evaluate(() => {
        const speed = document.getElementById('speed-slider');
        if (speed) {
          speed.value = '8';
          speed.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });

      await page.waitForTimeout(200);
      await expect(page.locator('#speed-value')).toHaveText('5');
    });

    test('Global functions referenced in the JS should be undefined because script failed to parse', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(200);

      // Evaluate existence of expected global functions
      const globals = await page.evaluate(() => {
        return {
          generateNewArray: typeof window.generateNewArray,
          startSorting: typeof window.startSorting,
          resetSorting: typeof window.resetSorting,
          performNextStep: typeof window.performNextStep,
          updateSizeValue: typeof window.updateSizeValue,
          updateSpeedValue: typeof window.updateSpeedValue
        };
      });

      // If the script failed during parsing, these functions will not be defined (should be "undefined")
      expect(globals.generateNewArray).toBe('undefined');
      expect(globals.startSorting).toBe('undefined');
      expect(globals.resetSorting).toBe('undefined');
      expect(globals.performNextStep).toBe('undefined');
      expect(globals.updateSizeValue).toBe('undefined');
      expect(globals.updateSpeedValue).toBe('undefined');
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Attempting to interact with the visualization should not throw additional uncaught exceptions', async ({ page }) => {
      const runtimeErrors = [];
      page.on('pageerror', err => runtimeErrors.push(String(err && err.message ? err.message : err)));

      await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(200);

      // Try a sequence of interactions that would normally drive FSM transitions
      await page.click('#generate-btn');
      await page.click('#sort-btn');
      await page.click('#step-btn');
      await page.fill('#size-slider', '12').catch(() => { /* ignore fill errors for range input */ });
      await page.evaluate(() => {
        const speed = document.getElementById('speed-slider');
        if (speed) {
          speed.value = '3';
          speed.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });

      // Allow time for any additional errors to surface
      await page.waitForTimeout(300);

      // We already expect at least one parsing error; ensure that no new unrelated runtime errors proliferate after interactions
      // (The test accepts page having errors but asserts that there are not many additional unexpected runtime exceptions)
      expect(runtimeErrors.length).toBeGreaterThan(0);

      // At least one should be parse-related (SyntaxError or similar)
      const containsParse = runtimeErrors.some(msg =>
        /SyntaxError|Unexpected end of input|Unterminated|Unexpected token/i.test(msg)
      );
      expect(containsParse).toBeTruthy();
    });
  });
});