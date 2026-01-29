import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/32501ee4-fa73-11f0-a9d0-d7a1991987c6.html';

test.describe('Overfitting Demonstration - FSM and runtime error observations', () => {
  // Arrays to collect runtime errors and console error messages for each test
  let consoleErrors;
  let pageErrors;

  // Attach listeners for console and page errors for each test run
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages of type 'error'
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          // include args' textual representation as well
          const text = msg.text();
          consoleErrors.push(text);
        }
      } catch (e) {
        // ignore any issues reading console message
      }
    });

    // Collect unhandled page errors (uncaught exceptions)
    page.on('pageerror', err => {
      try {
        pageErrors.push(err && err.message ? String(err.message) : String(err));
      } catch (e) {
        pageErrors.push(String(err));
      }
    });
  });

  // Basic smoke test: page loads and the known DOM elements exist
  test('Page contains expected controls and chart container', async ({ page }) => {
    // Load the page and wait for load event
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Verify the heading and paragraph are present
    await expect(page.locator('h1')).toHaveText('Overfitting Demonstration');
    await expect(page.locator('p')).toContainText('overfitting');

    // Verify chart container exists and is a div (this is important because
    // the implementation erroneously expects a canvas element)
    const chartLocator = page.locator('#chart');
    await expect(chartLocator).toHaveCount(1);

    // Ensure the chart element is indeed a div in the DOM (not a canvas)
    const chartTagName = await chartLocator.evaluate(el => el.tagName.toLowerCase());
    expect(chartTagName).toBe('div'); // this is the implemented DOM: div#chart

    // Verify the three buttons exist with the exact onclick attributes indicated by the FSM
    const underfit = page.locator('button[onclick="drawGraph(1)"]');
    const justRight = page.locator('button[onclick="drawGraph(3)"]');
    const overfit = page.locator('button[onclick="drawGraph(10)"]');

    await expect(underfit).toHaveCount(1);
    await expect(justRight).toHaveCount(1);
    await expect(overfit).toHaveCount(1);

    await expect(underfit).toHaveText('Underfitting');
    await expect(justRight).toHaveText('Just Right');
    await expect(overfit).toHaveText('Overfitting');

    // Confirm the onclick attributes match the FSM evidence
    await expect(underfit).toHaveAttribute('onclick', 'drawGraph(1)');
    await expect(justRight).toHaveAttribute('onclick', 'drawGraph(3)');
    await expect(overfit).toHaveAttribute('onclick', 'drawGraph(10)');

    // At least assert that Chart.js script tag is present by looking for the external src
    const scriptTags = await page.locator('script[src]').all();
    const srcs = await Promise.all(scriptTags.map(s => s.getAttribute('src')));
    const hasChartJs = srcs.some(s => s && s.includes('chart.js'));
    expect(hasChartJs).toBeTruthy();
  });

  // The implementation calls getContext on a div at script load -> expect a TypeError
  test('Initial load should produce a runtime error (e.g., getContext is not a function)', async ({ page }) => {
    // Navigate to the page
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Give the page a short moment to surface errors
    await page.waitForTimeout(250);

    // Combine collected error messages
    const combined = [...pageErrors, ...consoleErrors].join(' | ').toLowerCase();

    // We expect at least one error mentioning getcontext or "is not a function"
    const hasGetContextIssue = combined.includes('getcontext') || combined.includes('getContext'.toLowerCase());
    const hasIsNotFunction = combined.includes('is not a function') || combined.includes('is not a function'.toLowerCase());

    // The implementation is known to call .getContext on a DIV, so assert an error exists
    expect(pageErrors.length + consoleErrors.length).toBeGreaterThan(0);

    // At least one of the error messages should indicate getContext-related problem
    expect(hasGetContextIssue || hasIsNotFunction).toBeTruthy();
  });

  // Tests for each FSM event: simulate clicks and assert that clicking triggers errors
  test.describe('FSM event interactions (button clicks) and resulting errors', () => {
    // Helper to reset captured errors arrays between load and click events
    const clearCapturedErrors = () => {
      // Reassign arrays to clear contents while preserving listeners
      // (since arrays were declared outside)
      consoleErrors.length = 0;
      pageErrors.length = 0;
    };

    test('Underfitting button click (S0 -> S1) should attempt to call drawGraph and produce an error', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'load' });

      // Clear errors collected during initial load so we can focus on click-caused errors
      clearCapturedErrors();

      // Click Underfitting button
      await page.click('button[onclick="drawGraph(1)"]');

      // Allow event handlers and errors to surface
      await page.waitForTimeout(200);

      // We expect an error to occur on click: either ReferenceError for drawGraph
      // or TypeError from earlier script failure. Check collected messages.
      const combined1 = [...pageErrors, ...consoleErrors].join(' | ').toLowerCase();

      const mentionsDrawGraph = combined.includes('drawgraph');
      const mentionsReferenceError = combined.includes('referenceerror') || combined.includes('not defined');
      const mentionsTypeError = combined.includes('typeerror') || combined.includes('is not a function');

      expect(pageErrors.length + consoleErrors.length).toBeGreaterThan(0);
      expect(mentionsDrawGraph || mentionsReferenceError || mentionsTypeError).toBeTruthy();
    });

    test('Just Right button click (S0 -> S2) should attempt to call drawGraph and produce an error', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'load' });
      clearCapturedErrors();

      await page.click('button[onclick="drawGraph(3)"]');
      await page.waitForTimeout(200);

      const combined2 = [...pageErrors, ...consoleErrors].join(' | ').toLowerCase();
      const mentionsDrawGraph1 = combined.includes('drawgraph');
      const mentionsReferenceError1 = combined.includes('referenceerror') || combined.includes('not defined');
      const mentionsTypeError1 = combined.includes('typeerror') || combined.includes('is not a function');

      expect(pageErrors.length + consoleErrors.length).toBeGreaterThan(0);
      expect(mentionsDrawGraph || mentionsReferenceError || mentionsTypeError).toBeTruthy();
    });

    test('Overfitting button click (S0 -> S3) should attempt to call drawGraph and produce an error', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'load' });
      clearCapturedErrors();

      await page.click('button[onclick="drawGraph(10)"]');
      await page.waitForTimeout(200);

      const combined3 = [...pageErrors, ...consoleErrors].join(' | ').toLowerCase();
      const mentionsDrawGraph2 = combined.includes('drawgraph');
      const mentionsReferenceError2 = combined.includes('referenceerror') || combined.includes('not defined');
      const mentionsTypeError2 = combined.includes('typeerror') || combined.includes('is not a function');

      expect(pageErrors.length + consoleErrors.length).toBeGreaterThan(0);
      expect(mentionsDrawGraph || mentionsReferenceError || mentionsTypeError).toBeTruthy();
    });

    test('Sequence of transitions: Underfitting -> Just Right -> Overfitting -> Underfitting', async ({ page }) => {
      // This test executes a sequence of clicks that represent transitions in the FSM.
      // Because the implementation is broken at load-time, we verify that each attempted transition
      // results in runtime errors being emitted (as required by the testing instructions).
      await page.goto(APP_URL, { waitUntil: 'load' });

      // Helper to click and capture whether an error referencing drawGraph or getContext occurred
      async function clickAndCheck(selector) {
        // Clear previous errors
        consoleErrors.length = 0;
        pageErrors.length = 0;

        await page.click(selector);
        await page.waitForTimeout(200);

        const combined4 = [...pageErrors, ...consoleErrors].join(' | ').toLowerCase();
        const mentionsDrawGraph3 = combined.includes('drawgraph');
        const mentionsGetContext = combined.includes('getcontext') || combined.includes('is not a function');

        // There should be at least one error per click in this broken environment
        expect(pageErrors.length + consoleErrors.length).toBeGreaterThan(0);

        // Accept either drawGraph reference issues or getContext issues (both are plausible)
        expect(mentionsDrawGraph || mentionsGetContext).toBeTruthy();
      }

      await clickAndCheck('button[onclick="drawGraph(1)"]');  // Underfitting
      await clickAndCheck('button[onclick="drawGraph(3)"]');  // Just Right
      await clickAndCheck('button[onclick="drawGraph(10)"]'); // Overfitting
      await clickAndCheck('button[onclick="drawGraph(1)"]');  // Underfitting again
    });

    test('Edge case: clicking quickly multiple times on a control should still surface errors', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'load' });

      // Clear initial load errors and then click the same button rapidly
      consoleErrors.length = 0;
      pageErrors.length = 0;

      const selector = 'button[onclick="drawGraph(3)"]';
      // Rapid clicks
      await page.click(selector);
      await page.click(selector);
      await page.click(selector);

      // Allow time for errors to appear
      await page.waitForTimeout(300);

      // Expect multiple errors collected (or at least one)
      expect(pageErrors.length + consoleErrors.length).toBeGreaterThan(0);

      // At least one of the messages should mention drawGraph or a type/getContext issue
      const combined5 = [...pageErrors, ...consoleErrors].join(' | ').toLowerCase();
      expect(combined.includes('drawgraph') || combined.includes('getcontext') || combined.includes('is not a function')).toBeTruthy();
    });
  });

  // Verify that onEnter actions (as described in FSM) are referenced by the DOM (evidence)
  test('FSM evidence: verify onclick attributes correspond to onEnter actions', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    // The FSM entry_actions and evidence show drawGraph(1), drawGraph(3), drawGraph(10)
    const selectors = [
      { sel: 'button[onclick="drawGraph(1)"]', expected: 'drawGraph(1)' },
      { sel: 'button[onclick="drawGraph(3)"]', expected: 'drawGraph(3)' },
      { sel: 'button[onclick="drawGraph(10)"]', expected: 'drawGraph(10)' },
    ];

    for (const s of selectors) {
      const btn = page.locator(s.sel);
      await expect(btn).toHaveCount(1);
      const onclick = await btn.getAttribute('onclick');
      expect(onclick).toBe(s.expected);
    }
  });

  // Final test: assert that the page surfaces at least one uncaught exception overall
  test('At least one uncaught exception is present in the runtime (summary assertion)', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait a bit to ensure errors are surfaced
    await page.waitForTimeout(200);

    // There should be collected page errors or console errors indicating runtime problems
    const totalErrors = pageErrors.length + consoleErrors.length;
    expect(totalErrors).toBeGreaterThan(0);

    // Log the observed errors to the test output for debugging purposes
    // (Playwright test output will show the console when assertions fail)
    // NOTE: We won't print here programmatically; the arrays are available in scope for debugging.
  });
});