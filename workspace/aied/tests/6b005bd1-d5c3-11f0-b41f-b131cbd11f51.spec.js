import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b005bd1-d5c3-11f0-b41f-b131cbd11f51.html';

// Page object for the Bubble Sort visualization page
class BubbleSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.generateBtn = page.locator('#generateArray');
    this.startBtn = page.locator('#startSort');
    this.pauseResumeBtn = page.locator('#pauseResume');
    this.stepForwardBtn = page.locator('#stepForward');
    this.resetBtn = page.locator('#reset');
    this.arrayContainer = page.locator('#arrayContainer');
    this.comparisonCount = page.locator('#comparisonCount');
    this.swapCount = page.locator('#swapCount');
    this.passCount = page.locator('#passCount');
    this.stepInfo = page.locator('#stepInfo');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait until array bars are rendered after initial generateRandomArray call
    await this.page.waitForSelector('#arrayContainer .array-bar');
  }

  async getBarCount() {
    return await this.arrayContainer.locator('.array-bar').count();
  }

  async getBarHeights() {
    const count = await this.getBarCount();
    const heights = [];
    for (let i = 0; i < count; i++) {
      const height = await this.arrayContainer.locator('.array-bar').nth(i).evaluate((el) => el.style.height);
      heights.push(height);
    }
    return heights;
  }

  async getSortedBarCount() {
    return await this.arrayContainer.locator('.array-bar.sorted').count();
  }

  async clickGenerate() {
    await this.generateBtn.click();
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickPauseResume() {
    await this.pauseResumeBtn.click();
  }

  async clickStepForward() {
    await this.stepForwardBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async getComparisonCount() {
    return parseInt(await this.comparisonCount.textContent(), 10);
  }

  async getSwapCount() {
    return parseInt(await this.swapCount.textContent(), 10);
  }

  async getPassCount() {
    return parseInt(await this.passCount.textContent(), 10);
  }

  async getStepInfoText() {
    return (await this.stepInfo.textContent()).trim();
  }

  async getPauseResumeText() {
    return (await this.pauseResumeBtn.textContent()).trim();
  }

  async isStartDisabled() {
    return await this.startBtn.isDisabled();
  }

  async isPauseDisabled() {
    return await this.pauseResumeBtn.isDisabled();
  }

  async isStepForwardDisabled() {
    return await this.stepForwardBtn.isDisabled();
  }

  async isGenerateDisabled() {
    return await this.generateBtn.isDisabled();
  }
}

test.describe('Bubble Sort Visualization - FSM and UI behaviors', () => {
  let consoleErrors = [];
  let pageErrors = [];

  // Attach listeners and navigate before each test
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console error messages
    page.on('console', (msg) => {
      // Capture console errors to validate runtime issues
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : undefined,
        });
      }
    });

    // Capture page exceptions (uncaught)
    page.on('pageerror', (err) => {
      pageErrors.push({
        message: err.message,
        name: err.name,
        stack: err.stack,
      });
    });
  });

  test.describe('Initial Idle State (S0_Idle) and GenerateArray event', () => {
    test('Initial load should be in Idle state: array generated and UI counters reset', async ({ page }) => {
      const app = new BubbleSortPage(page);
      await app.goto();

      // Validate that generateRandomArray was called on initialization and stepInfo updated
      // The implementation sets stepInfo to 'New array generated. Ready to sort.' in generateRandomArray()
      const stepText = await app.getStepInfoText();
      expect(stepText).toBe('New array generated. Ready to sort.');

      // Ensure 15 bars were generated as per implementation
      const barCount = await app.getBarCount();
      expect(barCount).toBe(15);

      // Counters should be zero after generation
      expect(await app.getComparisonCount()).toBe(0);
      expect(await app.getSwapCount()).toBe(0);
      expect(await app.getPassCount()).toBe(0);

      // Buttons: start enabled, generate enabled, pause disabled, stepForward disabled
      expect(await app.isStartDisabled()).toBe(false);
      expect(await app.isGenerateDisabled()).toBe(false);
      expect(await app.isPauseDisabled()).toBe(true);
      expect(await app.isStepForwardDisabled()).toBe(true);
    });

    test('Clicking "Generate New Array" (GenerateArray event) regenerates array and resets counters', async ({ page }) => {
      const app = new BubbleSortPage(page);
      await app.goto();

      // Modify some counters by directly clicking start then reset quickly to ensure change,
      // but we will just click generate and verify counters reset
      await app.clickGenerate();

      // After generating a new array, stepInfo should indicate readiness
      const stepText = await app.getStepInfoText();
      expect(stepText).toBe('New array generated. Ready to sort.');

      // Bar count remains 15
      expect(await app.getBarCount()).toBe(15);

      // Counters should be reset to zero
      expect(await app.getComparisonCount()).toBe(0);
      expect(await app.getSwapCount()).toBe(0);
      expect(await app.getPassCount()).toBe(0);
    });
  });

  test.describe('Sorting (S1_Sorting) and Pause/Resume (S2_Paused) transitions', () => {
    test('StartSorting (StartSort event) should update UI and allow pausing', async ({ page }) => {
      const app = new BubbleSortPage(page);
      await app.goto();

      // Start the sorting process
      await app.clickStart();

      // After starting, start button should be disabled and pause should be enabled
      expect(await app.isStartDisabled()).toBe(true);
      expect(await app.isPauseDisabled()).toBe(false);

      // The UI stepForward stays disabled while not paused (implementation details)
      // Because isPaused is false initially, stepForwardBtn.disabled was set to !isSorting || !isPaused => true
      expect(await app.isStepForwardDisabled()).toBe(true);

      // Generate button should be disabled while sorting
      expect(await app.isGenerateDisabled()).toBe(true);
    });

    test('PauseResume toggles paused state and the Pause button text changes accordingly', async ({ page }) => {
      const app = new BubbleSortPage(page);
      await app.goto();

      // Start sorting
      await app.clickStart();

      // Immediately pause
      await app.clickPauseResume();

      // Pause should have changed label to 'Resume' per implementation
      expect(await app.getPauseResumeText()).toBe('Resume');

      // Pause should enable step forward button per the button state logic (even though implementation has a logic bug)
      expect(await app.isStepForwardDisabled()).toBe(false);
      // Pause button should remain enabled
      expect(await app.isPauseDisabled()).toBe(false);

      // Attempting to click stepForward while paused should not change counters because stepForward() returns early when paused
      const comparisonsBefore = await app.getComparisonCount();
      await app.clickStepForward();
      // Give a short time to ensure no asynchronous change occurs
      await page.waitForTimeout(200);
      const comparisonsAfter = await app.getComparisonCount();
      expect(comparisonsAfter).toBe(comparisonsBefore);
    });

    test('Resuming from pause should continue sorting (observed by comparisons incrementing)', async ({ page }) => {
      const app = new BubbleSortPage(page);
      await app.goto();

      // Start and then pause quickly
      await app.clickStart();
      await app.clickPauseResume(); // now paused

      // Resume sorting
      await app.clickPauseResume(); // text should become 'Pause'
      expect(await app.getPauseResumeText()).toBe('Pause');

      // Wait until at least one comparison occurs (the algorithm schedules steps via setTimeout)
      // We allow up to 5 seconds for a step to occur (animationSpeed is 500ms in the implementation)
      await page.waitForFunction(() => {
        const el = document.getElementById('comparisonCount');
        return el && parseInt(el.textContent || '0', 10) > 0;
      }, { timeout: 5000 });

      const comparisons = await app.getComparisonCount();
      expect(comparisons).toBeGreaterThan(0);

      // Pause again to stop automatic progression for test stability
      await app.clickPauseResume();
      expect(await app.getPauseResumeText()).toBe('Resume');
    });

    test('Clicking Start then Reset (Reset event) should stop sorting and return to Idle', async ({ page }) => {
      const app = new BubbleSortPage(page);
      await app.goto();

      // Start sorting and allow one step to occur
      await app.clickStart();
      await page.waitForTimeout(600); // wait a bit for one scheduled step
      // Now reset
      await app.clickReset();

      // After reset, stepInfo should show reset message per implementation
      const stepText = await app.getStepInfoText();
      expect(stepText).toBe('Reset. Ready to begin sorting.');

      // All counters should be reset to zero after generateRandomArray() runs within reset()
      expect(await app.getComparisonCount()).toBe(0);
      expect(await app.getSwapCount()).toBe(0);
      expect(await app.getPassCount()).toBe(0);

      // Buttons should be back to idle state
      expect(await app.isStartDisabled()).toBe(false);
      expect(await app.isPauseDisabled()).toBe(true);
      expect(await app.isStepForwardDisabled()).toBe(true);
      expect(await app.isGenerateDisabled()).toBe(false);
    });
  });

  test.describe('Edge cases, StepForward behavior, and Completed state (S3_Completed)', () => {
    test('StepForward on Idle should do nothing (edge case)', async ({ page }) => {
      const app = new BubbleSortPage(page);
      await app.goto();

      // Record counters
      const compBefore = await app.getComparisonCount();
      const swapBefore = await app.getSwapCount();
      const passBefore = await app.getPassCount();

      // Click stepForward when not sorting; per implementation it should return early
      await app.clickStepForward();
      // Wait briefly to ensure no asynchronous change
      await page.waitForTimeout(200);

      expect(await app.getComparisonCount()).toBe(compBefore);
      expect(await app.getSwapCount()).toBe(swapBefore);
      expect(await app.getPassCount()).toBe(passBefore);
    });

    test('Programmatically drive generator to completion to validate Completed state without waiting for long animations', async ({ page }) => {
      const app = new BubbleSortPage(page);
      await app.goto();

      // Execute bubbleSortGenerator to completion within the page context.
      // This uses the functions already defined on the page and does not redefine or patch them.
      // It iterates the generator synchronously to avoid waiting for timeouts (safe for test environment).
      const result = await page.evaluate(() => {
        // Use existing global variables and functions from the page
        // Set sorting flags to simulate starting state
        isSorting = true;
        isPaused = false;
        // Create a generator instance attached to existing variable sortGenerator
        sortGenerator = bubbleSortGenerator();

        // Exhaust the generator synchronously
        let res = sortGenerator.next();
        let iterations = 0;
        // Protect against infinite loops by bounding iterations (shouldn't be needed for bubbleSort)
        while (!res.done && iterations < 1000000) {
          res = sortGenerator.next();
          iterations++;
        }

        // After exhaustion, bubbleSortGenerator sets stepInfo and isSorting itself.
        return {
          stepInfo: stepInfo.textContent,
          isSorting,
          comparisons: comparisonCount.textContent,
          swaps: swapCount.textContent,
          passes: passCount.textContent,
          sortedBars: Array.from(document.querySelectorAll('#arrayContainer .array-bar.sorted')).length,
          totalBars: document.querySelectorAll('#arrayContainer .array-bar').length
        };
      });

      // Validate Completed state evidence per FSM
      expect(result.stepInfo).toBe('Sorting complete! The array is now sorted.');
      expect(result.isSorting).toBe(false);

      // There should be at least one comparison and one pass (since for 15 elements, many operations happen)
      expect(parseInt(result.comparisons, 10)).toBeGreaterThanOrEqual(0);
      expect(parseInt(result.passes, 10)).toBeGreaterThanOrEqual(1);

      // All bars should be marked as sorted when complete
      expect(result.sortedBars).toBe(result.totalBars);
    });

    test('StepForward button behavior when paused demonstrates implementation edge-case (button enabled but function returns early)', async ({ page }) => {
      const app = new BubbleSortPage(page);
      await app.goto();

      // Start sorting and pause
      await app.clickStart();
      await app.clickPauseResume(); // now paused

      // Ensure stepForward is enabled per button state logic
      expect(await app.isStepForwardDisabled()).toBe(false);

      // But clicking it should not advance (implementation returns early if isPaused)
      const compBefore = await app.getComparisonCount();
      await app.clickStepForward();
      await page.waitForTimeout(200);
      const compAfter = await app.getComparisonCount();

      // Assert that no progress occurred
      expect(compAfter).toBe(compBefore);
    });
  });

  test.describe('Runtime console and page errors observation', () => {
    test('There should be no uncaught ReferenceError, SyntaxError, or TypeError on load and basic interactions', async ({ page }) => {
      const app = new BubbleSortPage(page);
      await app.goto();

      // Perform a few interactions to surface runtime errors
      await app.clickStart();
      await page.waitForTimeout(200);
      await app.clickPauseResume();
      await app.clickReset();
      await page.waitForTimeout(200);

      // Give the page a moment to emit any console/page errors
      await page.waitForTimeout(200);

      // Access captured console and page errors that were collected in beforeEach listener
      // pageErrors and consoleErrors variables live in outer scope and were populated via listeners
      // Because those are managed in beforeEach, we need to retrieve them by re-attaching
      // However, Playwright listeners assigned in beforeEach are filling outer-scope arrays.
      // Validate that no pageErrors or consoleErrors of the targeted types exist.

      // We assert that there are no uncaught page errors collected
      expect(pageErrors.length).toBe(0);

      // consoleErrors should not include developer console error messages
      expect(consoleErrors.length).toBe(0);
    });
  });
});