import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25c9b471-fa7c-11f0-ba20-415c525382ea.html';

test.describe('Bubble Sort Demo FSM (Application ID: 25c9b471-fa7c-11f0-ba20-415c525382ea)', () => {
  // Shared variables to capture console messages and page errors for each test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  // Setup a fresh page and listeners before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages and errors
    page.on('console', (msg) => {
      const entry = { type: msg.type(), text: msg.text() };
      consoleMessages.push(entry);
      if (msg.type() === 'error') {
        consoleErrors.push(entry);
      }
    });

    // Collect uncaught page errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      // err is an Error object
      pageErrors.push({
        message: err.message,
        stack: err.stack,
        name: err.name,
      });
    });

    // Navigate to the application page (load exactly as-is)
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Ensure that we remove any event listeners or leftover state by navigating away
    await page.evaluate(() => {
      // No modifications to application script; just a neutral navigation cleanup if possible
      void 0;
    });
    // It's useful to keep captured logs available via the test runner output if needed
  });

  test.describe('States and Transitions', () => {
    test('S0_Idle - Initial render: Run Demo button visible and demo areas empty', async ({ page }) => {
      // This test validates the initial "Idle" state (S0_Idle) as described in the FSM.
      // It checks for the presence of the Run Demo button and that the demo array/log are empty before interaction.

      const runButton = page.locator('#run-demo');
      const demoArray = page.locator('#demo-array');
      const demoLog = page.locator('#demo-log');

      // Button should be visible and enabled on initial render
      await expect(runButton).toBeVisible();
      await expect(runButton).toBeEnabled();
      await expect(runButton).toHaveAttribute('aria-label', 'Run Bubble Sort demonstration');
      await expect(runButton).toHaveText('Run Demo');

      // demo-array and demo-log should be empty at initial load (Idle state's evidence)
      await expect(demoArray).toHaveText('', { timeout: 1000 });
      await expect(demoLog).toHaveText('', { timeout: 1000 });

      // No uncaught page errors should have occurred just by loading the page
      expect(pageErrors.length).toBe(0);
      // No console.error entries expected during initial render
      expect(consoleErrors.length).toBe(0);
    });

    test('S1_DemoRunning - Clicking Run Demo starts demo and shows Pass 1 immediately', async ({ page }) => {
      // This test validates transition from S0_Idle -> S1_DemoRunning (RunDemo event).
      // It asserts that bubbleSortStepDemo runs by verifying immediate DOM updates after click:
      //  - Run button becomes disabled
      //  - demo-array shows the array after the first pass
      //  - demo-log contains "Pass 1" and indicates swaps occurred for the provided initialArray

      const runButton = page.locator('#run-demo');
      const demoArray = page.locator('#demo-array');
      const demoLog = page.locator('#demo-log');

      // Click the button to start the demo
      await runButton.click();

      // Immediately after starting, the button should be disabled (S1 entry action disables the button)
      await expect(runButton).toBeDisabled();

      // The demo's first state is displayed synchronously by displayState() before any setTimeout delay.
      // For the provided initialArray = [4, 3, 7, 1, 9], after Pass 1 the array should be: [3, 4, 1, 7, 9]
      // The formatArray joins elements with three spaces '   '.
      const expectedPass1ArrayText = '3   4   1   7   9';
      await expect(demoArray).toHaveText(expectedPass1ArrayText, { timeout: 2000 });

      // demo-log should indicate Pass 1 and the phrase "(swaps occurred)"
      await expect(demoLog).toContainText('Pass 1', { timeout: 2000 });
      await expect(demoLog).toContainText('(swaps occurred)', { timeout: 2000 });

      // Confirm that no uncaught page errors occurred while starting the demo
      expect(pageErrors.length).toBe(0);

      // Capture current console entries for debugging purposes
      // (We don't assert a specific console message produced by the app since it doesn't log by design)
      expect(Array.isArray(consoleMessages)).toBe(true);
    });

    test('S2_DemoComplete - After all passes, shows "Sorting complete." and re-enables the button', async ({ page }) => {
      // This test validates the transition S1_DemoRunning -> S2_DemoComplete (DemoComplete event).
      // It waits for the textual "Sorting complete." indicator and verifies the Run Demo button is re-enabled.

      const runButton = page.locator('#run-demo');
      const demoLog = page.locator('#demo-log');

      // Start the demo
      await runButton.click();

      // Wait for the final "Sorting complete." message which is appended after all displayState timeouts finish.
      // The demo has 4 passes for the test array; displayState schedules each state 2000ms apart.
      // We allow generous timeout for the entire animation to finish.
      await page.waitForFunction(() => {
        const el = document.getElementById('demo-log');
        return el && el.textContent && el.textContent.includes('Sorting complete.');
      }, { timeout: 12000 });

      // Verify the "Sorting complete." string appears in the demo log
      await expect(demoLog).toContainText('Sorting complete.');

      // After completion, the button should be re-enabled according to the implementation
      await expect(runButton).toBeEnabled();

      // Ensure there were no uncaught runtime errors during the full demo run
      expect(pageErrors.length).toBe(0);
      // Again, there should be no console.error
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Edge Cases and Error Scenarios', () => {
    test('Attempting to click Run Demo while the demo is running should be blocked (button disabled)', async ({ page }) => {
      // This test validates that while the demo is running the Run Demo button is disabled
      // and that attempting to click it in the normal way is not permitted by the page.
      // We check that Playwright's normal click will fail due to the element being disabled.

      const runButton = page.locator('#run-demo');

      // Start the demo
      await runButton.click();

      // Confirm the button is disabled
      await expect(runButton).toBeDisabled();

      // Attempting to click the disabled button using a normal Playwright click should throw an error.
      // We assert that an error is thrown to validate that the UI prevents a second start.
      let clickThrew = false;
      try {
        // This call is expected to fail because the element is disabled (not enabled for interaction).
        await runButton.click({ timeout: 2000 });
      } catch (err) {
        clickThrew = true;
        // Confirm the thrown error mentions the element is not enabled / is disabled or is not actionable
        expect(String(err).toLowerCase()).toContain('element is not enabled', { ignoreCase: true } || '');
      }
      expect(clickThrew).toBe(true);

      // Clean up: wait for demo to finish to avoid affecting other tests
      await page.waitForFunction(() => {
        const el = document.getElementById('demo-log');
        return el && el.textContent && el.textContent.includes('Sorting complete.');
      }, { timeout: 12000 });
    });

    test('Forced click while disabled (edge input) - ensure application remains stable and does not throw errors', async ({ page }) => {
      // This test simulates an adversarial interaction: forcing a click on the disabled button.
      // Note: Using force:true simulates pressing the element regardless of disabled state.
      // This is an edge-case test to ensure the page either tolerates or throws no uncaught errors when abused.

      const runButton = page.locator('#run-demo');

      // Start the demo normally
      await runButton.click();
      await expect(runButton).toBeDisabled();

      // Force a second click while button is disabled (edge case)
      // We do not patch page code; we allow the page to handle this naturally.
      await runButton.click({ force: true });

      // Wait for the demo to complete (either single or overlapping demos should finish without uncaught exceptions)
      await page.waitForFunction(() => {
        const el = document.getElementById('demo-log');
        return el && el.textContent && el.textContent.includes('Sorting complete.');
      }, { timeout: 15000 });

      // Validate no uncaught page errors were produced by this forced interaction
      expect(pageErrors.length).toBe(0);

      // Validate no console.error entries were emitted
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Observability: Console and Page Errors', () => {
    test('No uncaught ReferenceError, SyntaxError, or TypeError occurred during page lifecycle', async ({ page }) => {
      // This test explicitly asserts that no uncaught runtime errors (ReferenceError, SyntaxError, TypeError) occurred.
      // It also replays a normal demo run to observe if any errors arise during the entire lifecycle.

      // Start demo and wait for completion
      await page.locator('#run-demo').click();
      await page.waitForFunction(() => {
        const el = document.getElementById('demo-log');
        return el && el.textContent && el.textContent.includes('Sorting complete.');
      }, { timeout: 12000 });

      // Assert there were no page errors captured
      if (pageErrors.length > 0) {
        // If there are any, fail with details to help debugging
        const first = pageErrors[0];
        throw new Error(`Unexpected page error: ${first.name}: ${first.message}\nStack: ${first.stack}`);
      }
      expect(pageErrors.length).toBe(0);

      // Also ensure there are no console.error messages
      expect(consoleErrors.length).toBe(0);

      // Optionally assert that console messages (info/log) are present but not errors (the app itself doesn't intentionally log)
      expect(consoleMessages.filter(m => m.type === 'log' || m.type === 'info').length).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('FSM Evidence Assertions', () => {
    test('Verify onEnter actions and expected observables: display of array states after each pass', async ({ page }) => {
      // This test validates the expected-observables from the FSM:
      // - Bubble Sort demo displays the array state after each pass
      // - Each pass is logged with "Pass X: ..." in demo-log
      // - The sequence of passes leads to a final sorted state

      const demoArray = page.locator('#demo-array');
      const demoLog = page.locator('#demo-log');
      const runButton = page.locator('#run-demo');

      // Start the demo
      await runButton.click();

      // Immediately verify Pass 1
      await expect(demoLog).toContainText('Pass 1', { timeout: 2000 });
      const pass1Text = await demoLog.textContent();
      expect(pass1Text).toMatch(/Pass 1:.*(swaps occurred|no swaps)/i);

      // Wait for Pass 2 (the second state is displayed after a 2s delay)
      await page.waitForTimeout(2100);
      // Check that demoLog now contains Pass 2
      await expect(demoLog).toContainText('Pass 2', { timeout: 1000 });

      // Wait for Pass 3 and Pass 4 then final complete message
      await page.waitForFunction(() => {
        const el = document.getElementById('demo-log');
        return el && el.textContent && el.textContent.includes('Sorting complete.');
      }, { timeout: 12000 });

      // Confirm final array is sorted as in FSM example [1, 2, 5, 5, 6, 9] is for their textual example,
      // but for this page's initialArray [4,3,7,1,9] the final sorted array is [1,3,4,7,9]
      await expect(demoArray).toHaveText('1   3   4   7   9', { timeout: 1000 });

      // Confirm the demo log ends with the intended completion evidence
      await expect(demoLog).toContainText('Sorting complete.');

      // No uncaught errors expected
      expect(pageErrors.length).toBe(0);
    });
  });
});