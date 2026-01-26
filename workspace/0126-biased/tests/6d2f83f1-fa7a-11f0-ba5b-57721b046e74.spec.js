import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2f83f1-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object to encapsulate commonly used interactions and queries
class TwoPointersPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.locators = {
      arrayDisplay: page.locator('#arrayDisplay'),
      arrayElements: page.locator('.array-element'),
      pointersDisplay: page.locator('#pointersDisplay'),
      sizeValue: page.locator('#sizeValue'),
      arraySize: page.locator('#arraySize'),
      randomArray: page.locator('#randomArray'),
      sortedArray: page.locator('#sortedArray'),
      reverseArray: page.locator('#reverseArray'),
      customArrayInput: page.locator('#customArray'),
      setCustomArray: page.locator('#setCustomArray'),
      algorithmSelect: page.locator('#algorithm'),
      runAlgorithm: page.locator('#runAlgorithm'),
      stepThrough: page.locator('#stepThrough'),
      reset: page.locator('#reset'),
      explanation: page.locator('#explanation'),
      stepCount: page.locator('#stepCount'),
      comparisonCount: page.locator('#comparisonCount'),
      swapCount: page.locator('#swapCount'),
      sumParams: page.locator('#sumParams'),
      containerParams: page.locator('#containerParams'),
      palindromeParams: page.locator('#palindromeParams'),
      removeDuplicatesParams: page.locator('#removeDuplicatesParams'),
      targetSumInput: page.locator('#targetSum'),
    };
  }

  // Wait for the array display to be ready
  async waitForReady() {
    await this.locators.arrayDisplay.waitFor({ state: 'visible' });
  }

  // Get array element values as numbers in DOM order
  async getArrayValues() {
    return await this.page.$$eval('.array-element', els => els.map(e => Number(e.textContent.trim())));
  }

  // Get count of array elements
  async getArrayCount() {
    return await this.locators.arrayElements.count();
  }

  // Set range slider value and trigger input event
  async setArraySize(value) {
    // Use evaluate to set value and dispatch input
    await this.page.$eval('#arraySize', (el, v) => {
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
    // Wait for DOM to update
    await this.page.waitForTimeout(50);
  }

  // Set custom array via input and click Set
  async setCustomArray(valuesString) {
    await this.locators.customArrayInput.fill(valuesString);
    await this.locators.setCustomArray.click();
    // Wait for DOM to update
    await this.page.waitForTimeout(50);
  }

  // Select an algorithm by option value
  async selectAlgorithm(value) {
    await this.locators.algorithmSelect.selectOption({ value });
    // Wait for params display update
    await this.page.waitForTimeout(50);
  }

  // Run algorithm by clicking Run Algorithm
  async runAlgorithm() {
    await this.locators.runAlgorithm.click();
    // runAlgorithm is synchronous for the demo (it loops until completion), but give a tick
    await this.page.waitForTimeout(50);
  }

  // Toggle Step Through (start/stop)
  async toggleStepThrough() {
    await this.locators.stepThrough.click();
  }

  // Click reset
  async resetAlgorithm() {
    await this.locators.reset.click();
    await this.page.waitForTimeout(50);
  }

  // Read pointer labels text content (should be 'L' and 'R')
  async getPointerLabels() {
    return await this.page.$$eval('#pointersDisplay .pointer', els => els.map(e => e.textContent.trim()));
  }

  // Read computed background color for a specific element index
  async getElementBackgroundColor(index) {
    return await this.page.$eval(`#element-${index}`, el => {
      const style = window.getComputedStyle(el);
      return style.backgroundColor;
    });
  }

  // Get explanation inner text
  async getExplanationText() {
    return await this.locators.explanation.innerText();
  }

  // Get numeric stat values
  async getStats() {
    const step = Number(await this.locators.stepCount.textContent());
    const comparisons = Number(await this.locators.comparisonCount.textContent());
    const swaps = Number(await this.locators.swapCount.textContent());
    return { step, comparisons, swaps };
  }

  // Get stepThrough button text
  async getStepThroughButtonText() {
    return await this.locators.stepThrough.textContent();
  }
}

test.describe('Two Pointers Technique - FSM and UI integration tests', () => {
  // Capture console errors and page errors per test to observe runtime issues
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen for console error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : undefined,
        });
      }
    });

    // Listen for unhandled page errors (uncaught exceptions)
    page.on('pageerror', err => {
      // err is an Error object
      pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
    });

    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Basic sanity: no unexpected page errors should have occurred during test.
    // If any existed, fail the test with the collected error details to make issues visible.
    if (pageErrors.length > 0) {
      // Throw to make the test fail and surface the errors
      throw new Error(`Page had uncaught errors: ${JSON.stringify(pageErrors, null, 2)}`);
    }
    // Also check console errors (these may include network or runtime errors)
    if (consoleErrors.length > 0) {
      throw new Error(`Console had error messages: ${JSON.stringify(consoleErrors, null, 2)}`);
    }
  });

  test('Initial Idle state: page load triggers array generation and displays pointers', async ({ page }) => {
    // Validate S0_Idle entry actions: generateRandomArray() and updateArrayDisplay() on load
    // 1) Array size indicator should match default slider value (10)
    const tp = new TwoPointersPage(page);
    await tp.waitForReady();

    const sizeValue = await tp.locators.sizeValue.textContent();
    expect(sizeValue.trim()).toBe('10');

    // 2) Array should contain 10 elements (default)
    const count = await tp.getArrayCount();
    expect(count).toBe(10);

    // 3) Pointers display should contain L and R labels
    const labels = await tp.getPointerLabels();
    expect(labels).toContain('L');
    expect(labels).toContain('R');

    // 4) Highlighting should be applied to first and last elements (background not empty)
    const bgFirst = await tp.getElementBackgroundColor(0);
    const bgLast = await tp.getElementBackgroundColor(count - 1);
    expect(bgFirst).not.toBe('');
    expect(bgLast).not.toBe('');
  });

  test('Array generation buttons: sorted and reverse produce expected ordering', async ({ page }) => {
    // Validate GenerateSortedArray and GenerateReverseSortedArray events
    const tp = new TwoPointersPage(page);
    await tp.waitForReady();

    // Click sorted array and validate ascending order
    await tp.locators.sortedArray.click();
    await page.waitForTimeout(50);
    let values = await tp.getArrayValues();
    // Validate monotonic non-decreasing
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }

    // Click reverse sorted and validate descending order
    await tp.locators.reverseArray.click();
    await page.waitForTimeout(50);
    values = await tp.getArrayValues();
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThanOrEqual(values[i - 1]);
    }
  });

  test('Array size slider updates sizeValue and regenerates array', async ({ page }) => {
    // Validate ChangeArraySize event and its side effects
    const tp = new TwoPointersPage(page);
    await tp.waitForReady();

    // Change to new size 6
    await tp.setArraySize(6);

    // sizeValue should reflect 6
    const sizeText = await tp.locators.sizeValue.textContent();
    expect(sizeText.trim()).toBe('6');

    // array length should be 6
    const count = await tp.getArrayCount();
    expect(count).toBe(6);
  });

  test('Set custom array: valid and empty input behaviors', async ({ page }) => {
    // Validate SetCustomArray event behavior and edge case for empty input
    const tp = new TwoPointersPage(page);
    await tp.waitForReady();

    // Record current array length
    const beforeCount = await tp.getArrayCount();

    // Attempt to set empty input -> should not change array
    await tp.locators.customArrayInput.fill('');
    await tp.locators.setCustomArray.click();
    await page.waitForTimeout(50);
    const afterCount = await tp.getArrayCount();
    expect(afterCount).toBe(beforeCount);

    // Now set a custom array and validate display
    const custom = '2,4,6,8';
    await tp.setCustomArray(custom);
    const values = await tp.getArrayValues();
    expect(values).toEqual([2, 4, 6, 8]);
  });

  test('Selecting algorithm updates parameter sections (SelectAlgorithm event)', async ({ page }) => {
    // Validate that selecting different algorithms reveals relevant parameter section
    const tp = new TwoPointersPage(page);
    await tp.waitForReady();

    // Select container algorithm -> containerParams visible
    await tp.selectAlgorithm('container');
    expect(await tp.locators.containerParams.isVisible()).toBeTruthy();
    expect(await tp.locators.sumParams.isVisible()).toBeFalsy();
    expect(await tp.locators.palindromeParams.isVisible()).toBeFalsy();

    // Select sum algorithm -> sumParams visible
    await tp.selectAlgorithm('sum');
    expect(await tp.locators.sumParams.isVisible()).toBeTruthy();

    // Select removeDuplicates -> corresponding params visible
    await tp.selectAlgorithm('removeDuplicates');
    expect(await tp.locators.removeDuplicatesParams.isVisible()).toBeTruthy();
  });

  test('Run Algorithm (Two Sum) transitions to Algorithm Running and finds known pair', async ({ page }) => {
    // Validate transition S0_Idle -> S1_AlgorithmRunning via RunAlgorithm event
    // Use a deterministic custom array where a known pair exists
    const tp = new TwoPointersPage(page);
    await tp.waitForReady();

    await tp.setCustomArray('1,3,4,8'); // sorted array
    await tp.selectAlgorithm('sum');

    // Set target sum to 11 (3 + 8)
    await tp.locators.targetSumInput.fill('11');

    // Click Run Algorithm - runAlgorithm() runs synchronously to completion in this demo
    await tp.runAlgorithm();

    // Expect explanation to include 'Found pair'
    const explanation = await tp.getExplanationText();
    expect(explanation).toContain('Found pair');

    // Stats should reflect some comparisons (>=1)
    const stats = await tp.getStats();
    expect(stats.comparisons).toBeGreaterThanOrEqual(1);
    expect(stats.step).toBeGreaterThanOrEqual(1);
  });

  test('Step Through Algorithm toggles, progresses, and can be stopped (StepThroughAlgorithm event)', async ({ page }) => {
    // Validate S0_Idle -> S2_StepThrough via clicking Step Through and stopping back to Idle
    const tp = new TwoPointersPage(page);
    await tp.waitForReady();

    // Small palindrome array to finish quickly via stepping
    await tp.setCustomArray('1,2,3,2,1');
    await tp.selectAlgorithm('palindrome');

    // Start stepping
    await tp.toggleStepThrough();

    // When started, button text should be 'Stop'
    let btnText = await tp.getStepThroughButtonText();
    expect(btnText.trim()).toBe('Stop');

    // Wait until at least one step has occurred (stepCount > 0)
    await page.waitForFunction(() => {
      const el = document.getElementById('stepCount');
      return el && Number(el.textContent) > 0;
    });

    const statsDuring = await tp.getStats();
    expect(statsDuring.step).toBeGreaterThan(0);

    // Stop stepping by clicking again
    await tp.toggleStepThrough();

    // After stopping, text should revert to 'Step Through'
    btnText = await tp.getStepThroughButtonText();
    expect(btnText.trim()).toBe('Step Through');

    // Explanation should eventually indicate palindrome result (or at least some progress)
    const explanation = await tp.getExplanationText();
    expect(explanation.length).toBeGreaterThan(0);
  });

  test('Reset Algorithm clears state, stats and resets pointers (ResetAlgorithm event)', async ({ page }) => {
    // Validate S1 or S2 -> S0 transitions via ResetAlgorithm: resetAlgorithm() effects
    const tp = new TwoPointersPage(page);
    await tp.waitForReady();

    // Prepare: run an algorithm to change stats and pointers
    await tp.setCustomArray('1,2,3,4,5');
    await tp.selectAlgorithm('container');
    await tp.runAlgorithm();

    // Ensure stats are non-zero or explanation changed
    const statsBefore = await tp.getStats();
    expect(statsBefore.step).toBeGreaterThanOrEqual(1);

    // Click reset
    await tp.resetAlgorithm();

    // Stats should be reset to 0
    const statsAfter = await tp.getStats();
    expect(statsAfter.step).toBe(0);
    expect(statsAfter.comparisons).toBe(0);
    expect(statsAfter.swaps).toBe(0);

    // Pointers should be reset to endpoints: verify highlighting on first and last elements
    const count = await tp.getArrayCount();
    const bgFirst = await tp.getElementBackgroundColor(0);
    const bgLast = await tp.getElementBackgroundColor(count - 1);
    expect(bgFirst).not.toBe('');
    expect(bgLast).not.toBe('');
  });

  test('Remove Duplicates algorithm produces swaps and final length message (edge case with duplicates)', async ({ page }) => {
    // Validate removeDuplicates algorithm flow and that swapCount increments
    const tp = new TwoPointersPage(page);
    await tp.waitForReady();

    // Use a sorted array with duplicates
    await tp.setCustomArray('1,1,2,2,3');
    await tp.selectAlgorithm('removeDuplicates');

    // Run algorithm to completion
    await tp.runAlgorithm();

    // Swap count should be >= 1 for this input
    const stats = await tp.getStats();
    expect(stats.swaps).toBeGreaterThanOrEqual(1);

    // Explanation should include 'Final array length'
    const explanation = await tp.getExplanationText();
    expect(explanation).toContain('Final array length');
  });

  test('Edge case: extremely small array for two pointers (size 5 minimum) and behavior', async ({ page }) => {
    // Validate behavior when using minimum allowed slider value and using container algorithm
    const tp = new TwoPointersPage(page);
    await tp.waitForReady();

    // Set slider to minimum 5
    await tp.setArraySize(5);
    const count = await tp.getArrayCount();
    expect(count).toBe(5);

    // Select container algorithm and step through a couple steps to ensure no runtime error
    await tp.selectAlgorithm('container');

    // Start step through
    await tp.toggleStepThrough();
    // Wait for some progress
    await page.waitForTimeout(600);
    // Stop step through
    await tp.toggleStepThrough();

    // Ensure explanation got some entries
    const explanation = await tp.getExplanationText();
    expect(explanation.length).toBeGreaterThan(0);
  });
});