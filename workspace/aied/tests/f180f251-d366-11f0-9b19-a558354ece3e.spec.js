import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f180f251-d366-11f0-9b19-a558354ece3e.html';

// Increase default timeout for tests that wait for the full animation sequence
test.setTimeout(2 * 60 * 1000); // 2 minutes

// Page Object for the Bubble Sort Visualization page
class BubbleSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async startSorting() {
    await this.page.click('#startBtn');
  }

  async resetArray() {
    await this.page.click('#resetBtn');
  }

  async getStepInfoText() {
    return this.page.locator('#stepInfo').innerText();
  }

  async getArrayElements() {
    return this.page.locator('#arrayContainer .array-element');
  }

  async getArrayValues() {
    const els = await this.getArrayElements();
    const count = await els.count();
    const values = [];
    for (let i = 0; i < count; i++) {
      values.push(await els.nth(i).innerText());
    }
    return values;
  }

  async isStartButtonDisabled() {
    return this.page.locator('#startBtn').isDisabled();
  }

  async isResetButtonDisabled() {
    return this.page.locator('#resetBtn').isDisabled();
  }

  async getWindowFlag(flagName) {
    return this.page.evaluate((name) => window[name], flagName);
  }

  async waitForAnyElementClass(className, timeout = 10000) {
    return this.page.waitForFunction(
      (cls) => {
        const els = Array.from(document.querySelectorAll('.array-element'));
        return els.some((el) => el.classList.contains(cls));
      },
      className,
      { timeout }
    );
  }

  async waitForCompleteStep(timeout = 120000) {
    // Wait for visible 'Sorting completed!' step info OR for startBtn to become enabled again.
    return Promise.race([
      this.page.waitForFunction(
        () => document.getElementById('stepInfo')?.textContent?.includes('Sorting completed!'),
        null,
        { timeout }
      ),
      this.page.waitForFunction(() => !document.getElementById('startBtn').disabled, null, { timeout })
    ]);
  }
}

test.describe('Bubble Sort Visualization FSM - f180f251-d366-11f0-9b19-a558354ece3e', () => {
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Capture console.error messages and page errors for later assertions
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // Capture only error-level console messages
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(`${msg.text()}`);
        }
      } catch (e) {
        // ignore instrumentation errors
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err.message || String(err));
    });
  });

  // Test: Initial Idle state on load
  test('Initial Idle state: page loads and initializeArray is called (S0_Idle)', async ({ page }) => {
    const pageObj = new BubbleSortPage(page);
    // Navigate to the app
    await pageObj.goto();

    // Validate initial visual and state expectations for Idle state
    // - stepInfo shows prompt to start
    // - arrayContainer has elements rendered (initial array)
    // - startBtn is enabled
    const stepText = await pageObj.getStepInfoText();
    expect(stepText).toContain('Click "Start Sorting" to begin');

    const values = await pageObj.getArrayValues();
    // The implementation initializes 8 elements; verify count and some expected values
    expect(values.length).toBe(8);
    expect(values[0]).toBe('64');
    expect(values[values.length - 1]).toBe('5');

    // start button should be enabled in idle
    expect(await pageObj.isStartButtonDisabled()).toBeFalsy();

    // Check window flag isSorting should be false initially
    const isSorting = await pageObj.getWindowFlag('isSorting');
    expect(isSorting).toBeFalsy();

    // Assert no runtime errors occurred during load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test: StartSorting transition to Sorting (S0_Idle -> S1_Sorting)
  test('StartSorting event triggers Sorting state (S1_Sorting): isSorting true and startBtn disabled', async ({ page }) => {
    const pageObj = new BubbleSortPage(page);
    await pageObj.goto();

    // Click Start Sorting to trigger transition
    await pageObj.startSorting();

    // Validate evidence from FSM: isSorting should be true and startBtn disabled
    // Wait briefly for click handler to set these flags
    await page.waitForFunction(() => window.isSorting === true);

    expect(await pageObj.getWindowFlag('isSorting')).toBe(true);
    expect(await pageObj.isStartButtonDisabled()).toBe(true);

    // The stepInfo should change from initial prompt to something indicating progress
    const stepInfo = await pageObj.getStepInfoText();
    expect(stepInfo.length).toBeGreaterThan(0);
    expect(stepInfo).not.toContain('Click "Start Sorting" to begin');

    // At least one element should get a 'comparison' or 'swapping' class as animation starts
    // Wait for either class to appear on any element
    await pageObj.waitForAnyElementClass('comparison', 15000).catch(() => {});
    await pageObj.waitForAnyElementClass('swapping', 15000).catch(() => {});

    const anyComparison = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.array-element')).some(el => el.classList.contains('comparison'));
    });
    const anySwapping = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.array-element')).some(el => el.classList.contains('swapping'));
    });

    // At least one of these should be true during the sorting animation
    expect(anyComparison || anySwapping).toBeTruthy();

    // Ensure no unexpected console or page errors occurred
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test: Clicking Start while already sorting should have no effect (guard)
  test('Guard: StartSorting clicked while already sorting does nothing', async ({ page }) => {
    const pageObj = new BubbleSortPage(page);
    await pageObj.goto();

    // Start sorting
    await pageObj.startSorting();
    await page.waitForFunction(() => window.isSorting === true);

    // Record currentStep and animations length to compare after second click
    const before = await page.evaluate(() => ({ currentStep, animationsLength: animations.length }));

    // Click start again while sorting - startSorting has guard to return if isSorting true
    await pageObj.startSorting();

    // Give micro-time for any side effects (should be none)
    await page.waitForTimeout(300);

    const after = await page.evaluate(() => ({ currentStep, animationsLength: animations.length }));

    // Expect currentStep to be unchanged by the second start click (or increased only by animation progression)
    // currentStep should not be reset to 0 by the second click
    expect(after.currentStep).toBeGreaterThanOrEqual(before.currentStep);

    // animations array should remain defined and unchanged in content length (no re-generation)
    expect(after.animationsLength).toBe(before.animationsLength);

    // No console/page errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test: ResetArray event while idle resets array and updates step info (S0_Idle -> S0_Idle)
  test('ResetArray resets array and updates stepInfo when idle', async ({ page }) => {
    const pageObj = new BubbleSortPage(page);
    await pageObj.goto();

    // Modify the DOM slightly to simulate a changed array (swap two elements via DOM only)
    // We avoid changing the app state variables; just ensure reset restores initial values.
    await page.evaluate(() => {
      const el0 = document.getElementById('element-0');
      const el1 = document.getElementById('element-1');
      if (el0 && el1) {
        const t0 = el0.textContent;
        el0.textContent = el1.textContent;
        el1.textContent = t0;
      }
    });

    // Click reset button
    await pageObj.resetArray();

    // After reset, stepInfo should show reset message
    const stepInfo = await pageObj.getStepInfoText();
    expect(stepInfo).toContain('Array reset. Click "Start Sorting" to begin');

    // Array values should correspond to the initialized array again
    const values = await pageObj.getArrayValues();
    expect(values.length).toBe(8);
    expect(values[0]).toBe('64');
    expect(values[values.length - 1]).toBe('5');

    // Ensure no elements retain animated classes
    const anyAnimated = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.array-element')).some(el => el.classList.contains('comparison') || el.classList.contains('swapping') || el.classList.contains('sorted'));
    });
    expect(anyAnimated).toBe(false);

    // No console/page errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test: ResetArray during sorting is ignored (should not reset while isSorting == true)
  test('ResetArray while sorting is ignored (guard) and does not reset array', async ({ page }) => {
    const pageObj = new BubbleSortPage(page);
    await pageObj.goto();

    // Start sorting
    await pageObj.startSorting();
    await page.waitForFunction(() => window.isSorting === true);

    // Capture stepInfo before attempting reset
    const beforeStep = await pageObj.getStepInfoText();

    // Attempt to reset while sorting; resetArray contains guard to return if isSorting
    await pageObj.resetArray();

    // Small wait to let any unintended effects happen
    await page.waitForTimeout(500);

    // stepInfo should not have been changed to the reset message (since reset should be ignored)
    const afterStep = await pageObj.getStepInfoText();
    expect(afterStep).toContain(beforeStep.slice(0, Math.min(beforeStep.length, 20)));

    // The app-level isSorting should still be true
    expect(await pageObj.getWindowFlag('isSorting')).toBe(true);

    // No console/page errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test: Sorting eventually completes and reaches Completed state (S1_Sorting -> S2_Completed)
  test('Sorting completes and reaches Completed state with final observables', async ({ page }) => {
    const pageObj = new BubbleSortPage(page);
    await pageObj.goto();

    // Start sorting
    await pageObj.startSorting();

    // Wait for the animation to reach the 'complete' step or for startBtn to be re-enabled
    // This can take time because the animation runs with setTimeout intervals.
    await pageObj.waitForCompleteStep(110000); // allow up to ~110s for completion in worst case

    // After completion, stepInfo should include 'Sorting completed!'
    const stepInfo = await pageObj.getStepInfoText();
    expect(stepInfo).toContain('Sorting completed!');

    // isSorting should be false and start button should be enabled again
    expect(await pageObj.getWindowFlag('isSorting')).toBe(false);
    expect(await pageObj.isStartButtonDisabled()).toBe(false);

    // All visible elements should have 'sorted' class
    const allSorted = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('.array-element'));
      return els.length > 0 && els.every(el => el.classList.contains('sorted'));
    });
    expect(allSorted).toBe(true);

    // Ensure animations array contains a 'complete' entry as described by FSM evidence
    const hasCompleteAnimation = await page.evaluate(() => {
      return Array.isArray(animations) && animations.some(a => a && a.type === 'complete' && a.step && a.step.includes('Sorting completed'));
    });
    expect(hasCompleteAnimation).toBe(true);

    // No console/page errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Edge case test: Validate that internal variables exist and types are as expected
  test('Internal variables existence and types (edge case checks)', async ({ page }) => {
    const pageObj = new BubbleSortPage(page);
    await pageObj.goto();

    // Validate that expected globals are defined and of correct types
    const globals = await page.evaluate(() => {
      return {
        hasArray: typeof array !== 'undefined' && Array.isArray(array),
        hasIsSorting: typeof isSorting !== 'undefined' && typeof isSorting === 'boolean',
        hasCurrentStep: typeof currentStep !== 'undefined' && typeof currentStep === 'number',
        hasAnimations: typeof animations !== 'undefined' && Array.isArray(animations),
      };
    });

    expect(globals.hasArray).toBe(true);
    expect(globals.hasIsSorting).toBe(true);
    expect(globals.hasCurrentStep).toBe(true);
    expect(globals.hasAnimations).toBe(true);

    // No console/page errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});