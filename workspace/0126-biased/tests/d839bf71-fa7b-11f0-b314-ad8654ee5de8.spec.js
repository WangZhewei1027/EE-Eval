import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d839bf71-fa7b-11f0-b314-ad8654ee5de8.html';

test.describe('Interactive Demo FSM tests - d839bf71-fa7b-11f0-b314-ad8654ee5de8', () => {
  // Containers for runtime observations (console messages and uncaught page errors)
  let consoleMessages = [];
  let pageErrors = [];

  // Setup before each test: navigate to the page and attach listeners to observe runtime errors and console output.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages with their types and text
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // If reading message fails for some reason, still capture that an unreadable console message existed.
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Collect unhandled page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Tear down: no special teardown required - listeners are scoped to page and cleared automatically.

  test.describe('State S0_Idle (initial) validations', () => {
    test('Idle: page render shows demo button and result element is hidden', async ({ page }) => {
      // Validate the initial "Idle" state UI components per FSM evidence:
      // - The Run demo unit tests button exists and is visible
      const runButton = page.locator('#runDemo');
      await expect(runButton).toBeVisible();
      await expect(runButton).toHaveText('Run demo unit tests');

      // - The result container exists but is initially hidden (style display none and aria-hidden true)
      const result = page.locator('#demoResult');
      await expect(result).toBeAttached();
      // The inline style initially includes display:none per implementation
      const ariaHidden = await result.getAttribute('aria-hidden');
      expect(ariaHidden).toBe('true');

      // Computed style should reflect hidden (display: none)
      const computedDisplay = await result.evaluate((el) => window.getComputedStyle(el).display);
      expect(computedDisplay).toBe('none');

      // Assert that no uncaught page errors of critical types happened during initial render
      const criticalPageErrors = pageErrors.filter(e => {
        const name = e && e.name ? e.name : '';
        return name === 'ReferenceError' || name === 'SyntaxError' || name === 'TypeError';
      });
      expect(criticalPageErrors.length).toBe(0);

      // Also assert there are no console.error messages referencing critical error names
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      const consoleCritical = consoleErrors.filter(m =>
        /ReferenceError|SyntaxError|TypeError/.test(m.text)
      );
      expect(consoleCritical.length).toBe(0);
    });
  });

  test.describe('Transition S0 -> S1 -> S2 (Run demo workflow)', () => {
    test('Clicking the Run demo button runs tests and displays the report (S1_Testing -> S2_ResultDisplayed)', async ({ page }) => {
      // Click the button to trigger the transition from Idle -> Testing (runTests) -> ResultDisplayed (displayResults)
      const runButton = page.locator('#runDemo');
      await expect(runButton).toBeVisible();

      // Click to run tests
      await runButton.click();

      // Wait for the results element to become visible (out.style.display = 'block' per implementation)
      const result = page.locator('#demoResult');
      await result.waitFor({ state: 'visible' });

      // Verify the result is visible by computed style
      const computedDisplayAfter = await result.evaluate((el) => window.getComputedStyle(el).display);
      expect(computedDisplayAfter).toBe('block');

      // Verify aria-hidden attribute changed to 'false'
      const ariaHiddenAfter = await result.getAttribute('aria-hidden');
      expect(ariaHiddenAfter).toBe('false');

      // Verify the textual report contains expected header and counts
      const text = await result.textContent();
      expect(text).toBeTruthy();
      expect(text).toContain('Tiny Unit Test Suite Report');
      // The demo defines 3 tests: two passing numeric adds and one that asserts a TypeError is thrown.
      expect(text).toContain('Total: 3');
      expect(text).toContain('Passed: 3');
      expect(text).toContain('Failed: 0');

      // Verify each test title appears in the report with success markers (✓)
      expect(text).toContain('adds two positive numbers');
      expect(text).toContain('adds negative numbers');
      expect(text).toContain('throws when given non-numbers');
      // Expect checkmarks for passed tests
      const passedMarkers = (text.match(/✓/g) || []).length;
      expect(passedMarkers).toBeGreaterThanOrEqual(3);

      // Confirm UI evidence lines that indicate displayResults() ran (report textContent and style changes)
      expect(text).toMatch(/Tiny Unit Test Suite Report\s*-+\s*Total: 3\s*Passed: 3\s*Failed: 0/);

      // Validate there were no uncaught runtime errors of critical types during the run
      const criticalPageErrors = pageErrors.filter(e => {
        const name = e && e.name ? e.name : '';
        return name === 'ReferenceError' || name === 'SyntaxError' || name === 'TypeError';
      });
      expect(criticalPageErrors.length).toBe(0);

      // Also assert there are no console.error messages that indicate critical errors
      const consoleCriticalErrors = consoleMessages.filter(m =>
        m.type === 'error' && /ReferenceError|SyntaxError|TypeError/.test(m.text)
      );
      expect(consoleCriticalErrors.length).toBe(0);
    });

    test('Idempotency / repeated runs: clicking the demo button multiple times produces consistent reports', async ({ page }) => {
      const runButton = page.locator('#runDemo');
      const result = page.locator('#demoResult');

      // First run
      await runButton.click();
      await result.waitFor({ state: 'visible' });
      const firstText = await result.textContent();
      expect(firstText).toBeTruthy();

      // Second run (click again) - should re-run tests and produce a report with same counts and structure
      await runButton.click();
      // Wait a little for rerun to complete; still the result is visible, so poll for content stability
      await page.waitForTimeout(50); // small pause to allow synchronous rerun to update UI

      const secondText = await result.textContent();
      expect(secondText).toBeTruthy();

      // Reports should be identical (synchronous deterministic runner)
      expect(secondText).toBe(firstText);

      // Ensure still no uncaught critical page errors after repeated runs
      const criticalPageErrors = pageErrors.filter(e => {
        const name = e && e.name ? e.name : '';
        return name === 'ReferenceError' || name === 'SyntaxError' || name === 'TypeError';
      });
      expect(criticalPageErrors.length).toBe(0);

      // And no console critical errors
      const consoleCriticalErrors = consoleMessages.filter(m =>
        m.type === 'error' && /ReferenceError|SyntaxError|TypeError/.test(m.text)
      );
      expect(consoleCriticalErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases, runtime observation, and FSM entry/exit action verification', () => {
    test('FSM entry/exit evidence: initial render (renderPage), runTests invocation, and displayResults side-effects observable in the DOM', async ({ page }) => {
      // Validate initial evidence that "renderPage()" had its intended effect: main interactive elements are present
      const runButton = page.locator('#runDemo');
      const result = page.locator('#demoResult');
      await expect(runButton).toBeVisible();
      await expect(result).toBeAttached();

      // Now trigger the test run.
      await runButton.click();
      await result.waitFor({ state: 'visible' });

      // Evidence for runTests(): the script returns results used to build report; we cannot access internal "results" var,
      // but we can observe the final product (report) which proves runTests() executed.
      const text = await result.textContent();
      expect(text).toContain('Tiny Unit Test Suite Report');
      expect(text).toContain('Total: 3');

      // Evidence for displayResults(): out.style.display is set and out.textContent updated (test below)
      const computedDisplay = await result.evaluate((el) => window.getComputedStyle(el).display);
      expect(computedDisplay).toBe('block');

      // Confirm the element's textContent matches the report we observed
      const textContentAttr = await result.textContent();
      expect(textContentAttr).toBe(text);

      // Validate that during the entire lifecycle we did not observe unhandled syntax/Reference/Type errors
      const criticalPageErrors = pageErrors.filter(e => {
        const name = e && e.name ? e.name : '';
        return name === 'ReferenceError' || name === 'SyntaxError' || name === 'TypeError';
      });
      expect(criticalPageErrors.length).toBe(0);

      // If any console.error messages exist, capture them for debugging; assert none indicate typical JS runtime errors
      const consoleCritical = consoleMessages.filter(m =>
        m.type === 'error' && /ReferenceError|SyntaxError|TypeError/.test(m.text)
      );
      expect(consoleCritical.length).toBe(0);
    });

    test('Runtime observation: capture and report any console messages or page errors for diagnostic purposes', async ({ page, browserName }) => {
      // This test demonstrates observing runtime logs and errors. It does not mutate the page.
      // Ensure we can at least access previously collected console and page error arrays and validate shapes.
      // Trigger a run to ensure we exercise script paths
      await page.locator('#runDemo').click();
      await page.locator('#demoResult').waitFor({ state: 'visible' });

      // There should be an array of console messages (may be empty) and page errors (expected empty)
      expect(Array.isArray(consoleMessages)).toBe(true);
      expect(Array.isArray(pageErrors)).toBe(true);

      // Ensure that none of the pageErrors are unexpected critical errors
      const unexpected = pageErrors.filter(e => {
        const name = e && e.name ? e.name : '';
        return name === 'ReferenceError' || name === 'SyntaxError' || name === 'TypeError';
      });
      // We expect no unexpected critical runtime errors for this well-formed demo
      expect(unexpected.length).toBe(0);

      // If any console messages exist, ensure none are errors that indicate a JS runtime failure
      const consoleCritical = consoleMessages.filter(m =>
        m.type === 'error' && /ReferenceError|SyntaxError|TypeError/.test(m.text)
      );
      expect(consoleCritical.length).toBe(0);

      // Also assert that on at least one run we saw informational strings in the result area
      const resultText = await page.locator('#demoResult').textContent();
      expect(resultText).toContain('Tiny Unit Test Suite Report');
    });
  });
});