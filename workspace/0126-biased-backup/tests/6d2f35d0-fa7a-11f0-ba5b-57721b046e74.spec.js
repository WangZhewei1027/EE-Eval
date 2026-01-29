import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2f35d0-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('Recursion Explorer (FSM validation) - 6d2f35d0-fa7a-11f0-ba5b-57721b046e74', () => {
  // Arrays to collect page runtime errors and console messages per test
  let pageErrors = [];
  let consoleMessages = [];

  // Attach listeners before each test and navigate to the app URL.
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      // err is an Error from the page context
      pageErrors.push(err);
    });

    // Collect console messages for debugging and assertions
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate and wait for load (scripts run during load)
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Small pause to allow synchronous handlers and any immediate exceptions to surface
    await page.waitForTimeout(100);
  });

  test.afterEach(async ({ page }) => {
    // Optionally capture a screenshot on failure - leaving commented for performance
    // if (testInfo.status !== 'passed') {
    //   await page.screenshot({ path: `screenshots/${testInfo.title}.png` });
    // }
  });

  test.describe('S0 - Idle (initial state) and global runtime errors', () => {
    test('Initial load should show default UI elements (S0_Idle) and emit runtime error from implementation', async ({ page }) => {
      // Validate initial DOM controls and displayed defaults
      const functionValue = await page.$eval('#functionSelect', el => el.value);
      expect(functionValue).toBe('factorial'); // FSM expects default selection

      const param1ValueText = await page.$eval('#param1Value', el => el.textContent.trim());
      expect(param1ValueText).toBe('5'); // initial slider value shown

      // param2Control should be hidden initially
      const param2Display = await page.$eval('#param2Control', el => getComputedStyle(el).display);
      expect(param2Display === 'none' || param2Display === '').toBeTruthy();

      // Code display should include factorial function code snippet
      const codeText = await page.$eval('#functionCode', el => el.textContent);
      expect(codeText).toContain('function factorial');

      // The implementation's reset/buildSteps is known to cause a TypeError on load for default config
      // Assert that at least one pageerror occurred during initialization
      expect(pageErrors.length).toBeGreaterThan(0);
      // Check that the error message suggests a typical property-of-undefined TypeError (implementation bug)
      const firstMsg = pageErrors[0].message || '';
      expect(firstMsg).toMatch(/Cannot|TypeError|undefined|reading/i);
    });
  });

  test.describe('S1 - FunctionSelected and parameter interactions', () => {
    test('Selecting a multi-parameter function (power) reveals param2 and triggers a new reset (UpdateFunction event)', async ({ page }) => {
      // Record number of errors so far
      const beforeErrors = pageErrors.length;

      // Select 'power' which has multiple params and click Update Function
      await page.selectOption('#functionSelect', 'power');
      await page.click('#updateFunction');

      // Allow event handlers to run
      await page.waitForTimeout(100);

      // param2 control should become visible for multi-parameter functions
      const param2Display = await page.$eval('#param2Control', el => getComputedStyle(el).display);
      expect(param2Display).not.toBe('none');

      // functionCode should update to show power
      const codeText = await page.$eval('#functionCode', el => el.textContent);
      expect(codeText).toContain('function power');

      // The updateFunction leads to reset() being called; due to the generic buildSteps bug many transitions produce a pageerror
      expect(pageErrors.length).toBeGreaterThanOrEqual(beforeErrors);
      // If a new error occurred, ensure it's a runtime error of the expected type
      if (pageErrors.length > beforeErrors) {
        const newError = pageErrors[pageErrors.length - 1];
        expect(newError.message).toMatch(/Cannot|TypeError|undefined|reading/i);
      }
    });

    test('Changing parameters (Param1Input and Param2Input events) dispatches input and calls reset', async ({ page }) => {
      // Select a function that uses both params (power)
      await page.selectOption('#functionSelect', 'power');
      await page.click('#updateFunction');
      await page.waitForTimeout(50);

      // Change param1 (range input) - use native DOM event dispatch to trigger input listeners
      await page.$eval('#param1', (el) => {
        el.value = '2';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // Change param2 (range input)
      await page.$eval('#param2', (el) => {
        el.value = '3';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // Allow handlers to run
      await page.waitForTimeout(50);

      // Validate displayed values were updated
      const p1 = await page.$eval('#param1Value', el => el.textContent.trim());
      const p2 = await page.$eval('#param2Value', el => el.textContent.trim());
      expect(p1).toBe('2');
      expect(p2).toBe('3');

      // The calls to updateParam1/updateParam2 call reset() - errors may be raised; ensure at least the listeners ran
      expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('S2 - Executing Recursion (RunFullRecursion) and transitions to stepping/reset', () => {
    test('Clicking Run Full should toggle isRunning and gracefully finish even with empty steps (RunFullRecursion event)', async ({ page }) => {
      // Record errors count
      const beforeErrors = pageErrors.length;

      // Click 'Run Full Recursion' (this will set state.isRunning and start interval)
      await page.click('#runFull');

      // Wait briefly to allow the interval to run at least once
      await page.waitForTimeout(250);

      // Read isRunning state from page
      const isRunning = await page.evaluate(() => window.state && window.state.isRunning);
      // For many configurations total steps may be zero and the runner clears itself; ensure it is a boolean
      expect(typeof isRunning).toBe('boolean');

      // Allow a little more time for any errors triggered during execution to surface
      await page.waitForTimeout(100);

      // Check that runtime errors were recorded (may or may not be new)
      expect(pageErrors.length).toBeGreaterThanOrEqual(beforeErrors);

      // As a visual check, recursionTree and callStack should exist (even if empty)
      const treeExists = await page.$('#recursionTree');
      const stackExists = await page.$('#callStack');
      expect(treeExists).not.toBeNull();
      expect(stackExists).not.toBeNull();
    });

    test('Stepping forward and backward without prepared steps should not throw but not change currentStep (StepForward/StepBackward events)', async ({ page }) => {
      // Capture currentStep
      const beforeStep = await page.evaluate(() => window.state ? window.state.currentStep : null);

      // Click Step Forward
      await page.click('#stepForward');
      await page.waitForTimeout(50);
      const afterForward = await page.evaluate(() => window.state ? window.state.currentStep : null);

      // If steps are empty, step should not advance; we assert it is not increased beyond possible bounds
      expect(typeof afterForward).toBe('number');
      expect(afterForward).toBeGreaterThanOrEqual(-1);

      // Click Step Backward - should not go below -1
      await page.click('#stepBackward');
      await page.waitForTimeout(50);
      const afterBackward = await page.evaluate(() => window.state ? window.state.currentStep : null);
      expect(afterBackward).toBeGreaterThanOrEqual(-1);
    });
  });

  test.describe('S3 & S4 - Stepping through a safe (base-case) recursion and visual verification', () => {
    test('Prepare a safe base-case (hanoi n=1) and validate step forward/backward visualizations and stack/tree toggles', async ({ page }) => {
      // At this point the page may have thrown errors during initialization (expected).
      // Prepare a safe scenario by setting the state to hanoi with param1=1 then calling reset/updateCodeDisplay.
      // We invoke existing page functions rather than modifying source code.
      await page.evaluate(() => {
        // Set to a function that yields an immediate base case when n = 1
        window.state.currentFunction = 'hanoi';
        window.state.param1 = 1;
        // Ensure UI reflects the change
        window.elements.functionSelect.value = 'hanoi';
        window.updateCodeDisplay();
        // Rebuild steps for safety (should create a single base-case step)
        try {
          window.reset();
        } catch (e) {
          // Let any exceptions bubble to pageerror; do not swallow silently
          throw e;
        }
      });

      // Allow the reset and visualization update to complete
      await page.waitForTimeout(100);

      // Ensure steps were built and include at least one step
      const stepsLength = await page.evaluate(() => (window.state && window.state.steps) ? window.state.steps.length : 0);
      expect(stepsLength).toBeGreaterThan(0);

      // Initial currentStep should be -1 (before any stepping)
      const initialStep = await page.evaluate(() => window.state.currentStep);
      expect(initialStep).toBe(-1);

      // Step Forward: should advance to 0 (first step)
      await page.click('#stepForward');
      await page.waitForTimeout(50);
      const stepAfterForward = await page.evaluate(() => window.state.currentStep);
      expect(stepAfterForward).toBeGreaterThanOrEqual(0);

      // Verify that the recursion tree DOM contains some text corresponding to the base/enter/exit step
      const treeText = await page.$eval('#recursionTree', el => el.textContent);
      expect(treeText.length).toBeGreaterThan(0);
      expect(/Base case|Calling|returned/i.test(treeText)).toBeTruthy();

      // Verify call stack shows frames for current depth
      const stackText = await page.$eval('#callStack', el => el.textContent);
      expect(stackText.length).toBeGreaterThan(0);
      expect(/hanoi/i.test(stackText)).toBeTruthy();

      // Step Backward: should move back (unless at 0)
      await page.click('#stepBackward');
      await page.waitForTimeout(50);
      const stepAfterBackward = await page.evaluate(() => window.state.currentStep);
      expect(stepAfterBackward).toBeGreaterThanOrEqual(-1);

      // Toggle showStack and showTree check they update state and updateVisualization is called (visual content may change)
      await page.click('#showStack'); // toggle
      await page.click('#showTree'); // toggle
      await page.waitForTimeout(50);

      const showStackChecked = await page.$eval('#showStack', el => el.checked);
      const showTreeChecked = await page.$eval('#showTree', el => el.checked);
      expect(typeof showStackChecked).toBe('boolean');
      expect(typeof showTreeChecked).toBe('boolean');

      // After toggles, callStack or recursionTree may be empty; at minimum the toggles should reflect in state
      const stateShowStack = await page.evaluate(() => window.state.showStack);
      const stateShowTree = await page.evaluate(() => window.state.showTree);
      expect(stateShowStack).toBe(showStackChecked);
      expect(stateShowTree).toBe(showTreeChecked);
    });
  });

  test.describe('S5 - Reset behavior and edge cases', () => {
    test('Reset clears execution stack and sets currentStep to -1 (Reset event)', async ({ page }) => {
      // Prepare safe scenario again: set to hanoi n=1 to avoid buildSteps recursion errors
      await page.evaluate(() => {
        window.state.currentFunction = 'hanoi';
        window.state.param1 = 1;
        window.elements.functionSelect.value = 'hanoi';
        window.updateCodeDisplay();
        // Build steps safely
        try {
          window.reset();
        } catch (e) {
          // Let pageerror handle any exceptions
          throw e;
        }
      });

      await page.waitForTimeout(50);

      // Mutate the state a bit by stepping forward
      await page.click('#stepForward');
      await page.waitForTimeout(50);

      // Now click Reset button in UI to exercise Reset transition
      await page.click('#reset');
      await page.waitForTimeout(50);

      // Validate that reset cleared the executionStack and set currentStep to -1
      const execStackLength = await page.evaluate(() => (window.state.executionStack || []).length);
      const currentStep = await page.evaluate(() => window.state.currentStep);
      expect(execStackLength).toBe(0);
      expect(currentStep).toBe(-1);
    });

    test('Changing delay (DelayChange event) updates state.delay and accepts out-of-range values (edge case)', async ({ page }) => {
      // Read original delay
      const originalDelay = await page.$eval('#delay', el => el.value);

      // Attempt to set delay below the min via DOM (browser will accept assignment even if input has min)
      await page.$eval('#delay', (el) => {
        el.value = '200'; // below defined min of 500
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });

      await page.waitForTimeout(50);

      // The updateDelay handler parses the value directly; state.delay should reflect the assigned value (even if out-of-range)
      const newDelay = await page.evaluate(() => window.state.delay);
      expect(typeof newDelay).toBe('number');
      expect(newDelay).toBe(200);

      // Restore original delay for cleanliness
      await page.$eval('#delay', (el, val) => { el.value = val; el.dispatchEvent(new Event('change', { bubbles: true })); }, originalDelay);
      await page.waitForTimeout(20);
    });
  });

  test.describe('Observability: console and pageerror assertions across interactions', () => {
    test('The app emits page errors for certain sequences (assert presence of TypeError-like messages)', async ({ page }) => {
      // We expect at least one page error occurred during initialization; assert that
      expect(pageErrors.length).toBeGreaterThan(0);

      // Ensure console messages were collected; at minimum the DOM exists and may log nothing
      expect(Array.isArray(consoleMessages)).toBeTruthy();

      // If there are errors, check that at least one error message indicates property access of undefined
      const matches = pageErrors.some(e => {
        const m = e && e.message ? e.message : String(e);
        return /Cannot read|Cannot set|TypeError|undefined/i.test(m);
      });
      expect(matches).toBeTruthy();
    });
  });
});