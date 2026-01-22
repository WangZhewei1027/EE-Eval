import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e934acf1-d360-11f0-a097-ffdd56c22ef4.html';

test.describe('Recursion Explorer — FSM end-to-end tests (e934acf1-d360-11f0-a097-ffdd56c22ef4)', () => {
  // Collect console and page errors for assertions
  let consoleErrors = [];
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    consoleMessages = [];

    // Observe console messages and page errors
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      // Uncaught exceptions end up here
      pageErrors.push(err);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL);

    // Wait for the main UI to be available
    await page.waitForSelector('.wrap');

    // The app triggers an initial trace automatically (initialDemo).
    // Wait for that initial trace to finish so tests start from a stable state.
    // animateEvents appends a "Trace finished. Final result shown above on last return event."
    // string to #factEvents when done.
    try {
      await page.locator('#factEvents').locator('text=Trace finished.').waitFor({ timeout: 15000 });
    } catch (e) {
      // If the initial trace didn't finish within timeout, continue tests anyway.
      // Some environments may throttle timers; tests will still attempt to drive UI.
    }
  });

  test.afterEach(async () => {
    // no-op; the page lifecycle is managed by Playwright fixtures
  });

  test.describe('S0_Idle (Idle) - Initial page render', () => {
    test('renders main UI and components are present', async ({ page }) => {
      // Validate presence of primary containers and controls
      await expect(page.locator('.wrap')).toBeVisible();
      await expect(page.locator('#runFact')).toBeVisible();
      await expect(page.locator('#runFactInstant')).toBeVisible();
      await expect(page.locator('#factN')).toHaveValue('6'); // matches default in HTML
      await expect(page.locator('#speed')).toBeVisible();
      await expect(page.locator('#runFib')).toBeVisible();
      await expect(page.locator('#treeDepth')).toHaveValue(/.*/); // any value present
      await expect(page.locator('#angle')).toHaveValue(/.*/);
      await expect(page.locator('#treeCanvas')).toBeVisible();
      // Code sample exists
      await expect(page.locator('#codeSample')).toContainText('function factorial');
    });
  });

  test.describe('S1_Factorial_Tracing (Factorial Tracing) - run trace and animation', () => {
    test('Run Trace animates events and completes (tracedFactorial -> animateEvents)', async ({ page }) => {
      // Shrink speed to accelerate animation for test
      await page.$eval('#speed', (el) => el.value = '50');
      // Set a smaller n to keep trace short and deterministic
      await page.fill('#factN', '4');

      // Start the trace
      const runFact = page.locator('#runFact');
      await runFact.click();

      // Expect an enter event and return events to be displayed; wait until final "Trace finished." marker appears
      const factEvents = page.locator('#factEvents');
      await expect(factEvents).toContainText('enter', { timeout: 15000 });
      await expect(factEvents).toContainText('return', { timeout: 15000 });

      // Wait for the "Trace finished." final note placed by animateEvents
      await expect(factEvents).toContainText('Trace finished. Final result shown above on last return event.', { timeout: 15000 });

      // After animation completes the stack area should be cleared (frames popped)
      const stackAreaText = await page.locator('#stackArea').innerText();
      expect(stackAreaText.trim() === '' || stackAreaText === null).toBeTruthy();
    });
  });

  test.describe('S2_Factorial_Instant (Factorial Instant Compute) - compute only behavior and edge case', () => {
    test('Compute Only displays instant factorial result and shows result frame', async ({ page }) => {
      await page.fill('#factN', '5'); // 5! = 120
      await page.locator('#runFactInstant').click();

      // Expect the explicit textual result to appear in factEvents
      await expect(page.locator('#factEvents')).toContainText('factorial(5) = 120', { timeout: 5000 });

      // Stack area should contain a frame showing the result
      const frame = page.locator('#stackArea .frame');
      await expect(frame).toBeVisible();
      await expect(frame).toContainText('result');
      await expect(frame).toContainText('n = 5');
      await expect(frame).toContainText('120');
    });

    test('Compute Only handles extreme input by catching recursion depth errors', async ({ page }) => {
      // Use an extremely large n to exercise the try/catch path that handles recursion too deep.
      // Note: behavior depends on runtime; the code catches errors and writes a friendly message.
      await page.fill('#factN', '100000');
      await page.locator('#runFactInstant').click();

      // The handler sets a friendly error message in #factEvents on failure
      await expect(page.locator('#factEvents')).toContainText('Error', { timeout: 5000 });
      // It is acceptable if it specifically says "recursion might be too deep"
      const text = await page.locator('#factEvents').innerText();
      expect(text.toLowerCase()).toContain('error');
    });
  });

  test.describe('S3_Fibonacci_Comparison (Fibonacci Comparison)', () => {
    test('Compare naive and memoized fibonacci produce values and call counts', async ({ page }) => {
      // Choose a modest n for deterministic runtime
      await page.fill('#fibN', '10');
      await page.locator('#runFib').click();

      // Verify outputs have been populated (not the placeholder '—')
      const naiveVal = await page.locator('#fibNaive').innerText();
      const naiveCalls = await page.locator('#fibNaiveCalls').innerText();
      const memoVal = await page.locator('#fibMemo').innerText();
      const memoCalls = await page.locator('#fibMemoCalls').innerText();

      expect(naiveVal.trim()).not.toBe('—');
      expect(memoVal.trim()).not.toBe('—');

      // Ensure calls are numbers and greater than zero
      const callsNaiveMatch = naiveCalls.match(/Calls:\s*(\d+)/);
      const callsMemoMatch = memoCalls.match(/Calls:\s*(\d+)/);
      expect(callsNaiveMatch).not.toBeNull();
      expect(callsMemoMatch).not.toBeNull();
      expect(parseInt(callsNaiveMatch[1], 10)).toBeGreaterThan(0);
      expect(parseInt(callsMemoMatch[1], 10)).toBeGreaterThan(0);

      // The computed values from naive and memoized should match
      const extractVal = (s) => {
        const m = s.match(/(-?\d+)/);
        return m ? parseInt(m[1], 10) : null;
      };
      const vNaive = extractVal(naiveVal);
      const vMemo = extractVal(memoVal);
      expect(vNaive).toBe(vMemo);
    });
  });

  test.describe('S4_Fractal_Tree_Draw (Fractal Tree Drawing) and UpdateTreeLabels', () => {
    test('Updating tree depth and angle inputs updates labels (UpdateTreeLabels)', async ({ page }) => {
      // Update depth to 5 and dispatch input
      await page.$eval('#treeDepth', (el) => {
        el.value = '5';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await expect(page.locator('#treeDepthLabel')).toHaveText('5');

      // Update angle to 30 and dispatch input
      await page.$eval('#angle', (el) => {
        el.value = '30';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await expect(page.locator('#angleLabel')).toHaveText('30°');
    });

    test('Clicking Redraw draws onto the canvas (drawTree invoked) and produces a non-empty image data', async ({ page }) => {
      // Ensure labels are set to known values before drawing
      await page.$eval('#treeDepth', (el) => { el.value = '6'; el.dispatchEvent(new Event('input', { bubbles: true })); });
      await page.$eval('#angle', (el) => { el.value = '25'; el.dispatchEvent(new Event('input', { bubbles: true })); });

      // Click redraw
      await page.locator('#drawTree').click();

      // Inspect canvas element to ensure width/height are set and a data URL can be produced.
      // If drawTree used resizeCanvasToDisplaySize, canvas.width/height will be > 0.
      const canvasSize = await page.$eval('#treeCanvas', (c) => ({ w: c.width, h: c.height }));
      expect(canvasSize.w).toBeGreaterThan(0);
      expect(canvasSize.h).toBeGreaterThan(0);

      // Attempt to produce a data URL from the canvas; length should be significant.
      const dataUrlLength = await page.$eval('#treeCanvas', (c) => {
        try {
          return c.toDataURL().length;
        } catch (e) {
          return 0;
        }
      });
      expect(dataUrlLength).toBeGreaterThan(1000);
    });
  });

  test.describe('Console and page error observation', () => {
    test('No unexpected console.error or uncaught page errors occurred during interaction', async ({ page }) => {
      // This test asserts that the loaded page did not produce uncaught exceptions
      // or console.error messages during the tests' interactions.
      // We gather console error messages in page.on('console') and page.on('pageerror').
      // Allow a brief pause to ensure any asynchronous errors surface.
      await page.waitForTimeout(500);

      // Assert no uncaught page errors
      expect(pageErrors.length).toBe(0);

      // Assert there were no console.error messages
      expect(consoleErrors.length).toBe(0);

      // Additionally, ensure there are console messages captured (informational), but none are error-level
      // This is not a strict requirement; we only enforce that there were no error-level console messages.
      // For transparency, if there are console messages, they are available in the test output.
      // (Do not fail on presence of non-error console messages.)
    });
  });
});