import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b52f22-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('FSM: Comprehensive Guide to SVM (f0b52f22-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  // Arrays to capture console messages and page errors for observation/assertion
  let consoleMessages;
  let pageErrors;

  // Setup: navigate to the page and wire up listeners before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for later assertions / debugging
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture unhandled errors emitted from the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the page exactly as provided
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // no-op teardown placeholder; Playwright's fixtures clean up pages automatically
  });

  test.describe('State S0_Idle validations', () => {
    test('Idle state renders Run Demonstration button and placeholder visualization', async ({ page }) => {
      // Validate presence and visibility of the Run Demonstration button (component evidence)
      const demoButton = page.locator('#demo-button');
      await expect(demoButton).toBeVisible({ timeout: 2000 });
      await expect(demoButton).toHaveText('Run Demonstration');

      // Validate presence of the visualization area with expected placeholder text
      const demoArea = page.locator('#svm-demo');
      await expect(demoArea).toBeVisible();
      await expect(demoArea).toContainText('Click the button to see a simple visualization');

      // Verify FSM S0 entry action 'renderPage()' is not present in the current global scope
      const renderPageType = await page.evaluate(() => typeof renderPage);
      // If the function existed, it would be 'function'. We expect it to be 'undefined' per implementation.
      expect(renderPageType).toBe('undefined');

      // Ensure no unexpected page-level errors were emitted during initial load
      expect(pageErrors).toEqual([]);
    });

    test('Edge case: attempting to call missing entry function renderPage() throws ReferenceError (natural runtime behavior)', async ({ page }) => {
      // We intentionally attempt to invoke the identifier renderPage() inside the page context.
      // Because the page does not declare renderPage, this will throw a ReferenceError in-browser.
      const result = await page.evaluate(() => {
        try {
          // Direct identifier call -> ReferenceError if not defined
          renderPage();
          return { called: true };
        } catch (e) {
          // Return the error name and message so test can assert on it without failing the whole test run
          return { called: false, name: e && e.name, message: e && e.message };
        }
      });

      // Validate that a ReferenceError occurred as a natural consequence of calling an undefined identifier
      expect(result.called).toBeFalsy();
      expect(result.name).toBe('ReferenceError');
      expect(typeof result.message).toBe('string');
    });
  });

  test.describe('Event: RunDemonstration and transition S0 -> S1', () => {
    test('Clicking Run Demonstration displays the SVM visualization (Demo Running state)', async ({ page }) => {
      // Click the demo button to trigger the transition
      const demoButton = page.locator('#demo-button');
      await demoButton.click();

      // After clicking, the demo area should be updated with the injected innerHTML containing the visualization title
      const demoArea = page.locator('#svm-demo');
      await expect(demoArea).toContainText('Simple SVM Visualization', { timeout: 2000 });

      // Validate that the paragraph describing the decision boundary is present
      await expect(demoArea).toContainText('The black line represents the decision boundary');

      // Validate that the inserted visualization container (approx sized box) exists by matching inline style fragment
      const visualizationBox = demoArea.locator('div[style*="width: 280px"][style*="height: 200px"]');
      await expect(visualizationBox).toHaveCount(1);

      // Validate there are three red points and three blue points as per the injected demo markup
      const redPoints = visualizationBox.locator('div[style*="background-color: red"]');
      const bluePoints = visualizationBox.locator('div[style*="background-color: blue"]');
      await expect(redPoints).toHaveCount(3);
      await expect(bluePoints).toHaveCount(3);

      // Validate presence of the decision boundary (black line) and two dashed margin lines
      const blackLine = visualizationBox.locator('div[style*="background-color: black"]');
      const dashedLines = visualizationBox.locator('div[style*="border-style: dashed"]');
      await expect(blackLine).toHaveCount(1);
      await expect(dashedLines).toHaveCount(2);

      // Verify FSM S1 entry action 'showDemoVisualization()' is not present in the global scope
      const showDemoType = await page.evaluate(() => typeof showDemoVisualization);
      expect(showDemoType).toBe('undefined');

      // Confirm that no unhandled page errors were emitted just from clicking and DOM update
      expect(pageErrors).toEqual([]);
    });

    test('Clicking the button multiple times updates the visualization without throwing errors', async ({ page }) => {
      const demoButton = page.locator('#demo-button');
      const demoArea = page.locator('#svm-demo');

      // Click once then again to test idempotent/consistent behavior
      await demoButton.click();
      await expect(demoArea).toContainText('Simple SVM Visualization', { timeout: 2000 });
      // Capture the innerHTML snapshot after first click
      const firstHtml = await demoArea.evaluate((el) => el.innerHTML);

      await demoButton.click();
      // After clicking again, the content should still contain the visualization text
      await expect(demoArea).toContainText('Simple SVM Visualization');
      const secondHtml = await demoArea.evaluate((el) => el.innerHTML);

      // The demo implementation overwrites innerHTML each click; ensure that the result is still valid HTML string
      expect(typeof firstHtml).toBe('string');
      expect(typeof secondHtml).toBe('string');
      // The two snapshots may be equal (overwritten) or equal in content; ensure the expected parts exist
      expect(secondHtml).toContain('Simple SVM Visualization');

      // Ensure no unhandled runtime errors occurred during repeated clicks
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Error scenarios and edge cases for missing onEnter/onExit functions', () => {
    test('Invoking window.renderPage() triggers a TypeError (window property exists as undefined) when called as a function', async ({ page }) => {
      // window.renderPage is undefined; calling window.renderPage() should result in a TypeError inside page context.
      const result = await page.evaluate(() => {
        try {
          // Calling as property of window -> undefined is invoked => TypeError: window.renderPage is not a function
          window.renderPage();
          return { invoked: true };
        } catch (e) {
          return { invoked: false, name: e && e.name, message: e && e.message };
        }
      });

      // Validate that a TypeError occurred as a natural consequence of invoking undefined as a function
      expect(result.invoked).toBeFalsy();
      expect(result.name).toBe('TypeError');
      expect(typeof result.message).toBe('string');
    });

    test('Invoking showDemoVisualization() identifier throws ReferenceError (function not declared)', async ({ page }) => {
      // Attempt to call the identifier showDemoVisualization() directly; expect ReferenceError if not declared.
      const result = await page.evaluate(() => {
        try {
          showDemoVisualization();
          return { invoked: true };
        } catch (e) {
          return { invoked: false, name: e && e.name, message: e && e.message };
        }
      });

      expect(result.invoked).toBeFalsy();
      expect(result.name).toBe('ReferenceError');
    });

    test('Observes console messages and page errors arrays for diagnostics (should be empty for this implementation)', async ({ page }) => {
      // Provide a snapshot of recent console messages and pageErrors
      // The implementation is simple and does not log to console or throw on load, so we expect no page errors
      expect(Array.isArray(consoleMessages)).toBeTruthy();
      expect(Array.isArray(pageErrors)).toBeTruthy();

      // It's acceptable that consoleMessages may contain some entries (e.g., browser internals), but
      // we assert there are no unhandled page errors.
      expect(pageErrors.length).toBe(0);
    });
  });
});