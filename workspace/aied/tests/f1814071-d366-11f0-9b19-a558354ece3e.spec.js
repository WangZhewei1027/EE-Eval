import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f1814071-d366-11f0-9b19-a558354ece3e.html';

// Page object for the Heap Sort Visualizer page
class HeapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleErrors = [];
    this.pageErrors = [];

    // Capture console error messages and page errors for assertions
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the visualizer UI to be ready
    await this.page.waitForSelector('#arrayContainer');
    await this.page.waitForSelector('#stepInfo');
  }

  async getStepInfoText() {
    return (await this.page.locator('#stepInfo').textContent())?.trim();
  }

  async getArrayValues() {
    // returns array of numbers shown in the array container
    const elems = this.page.locator('#arrayContainer .array-element');
    const count = await elems.count();
    const values = [];
    for (let i = 0; i < count; i++) {
      const txt = (await elems.nth(i).textContent())?.trim() ?? '';
      values.push(Number(txt));
    }
    return values;
  }

  async isStepForwardDisabled() {
    return await this.page.locator('#stepForward').isDisabled();
  }

  async clickGenerateRandom() {
    await this.page.click('#generateRandom');
  }

  async clickStartSort() {
    await this.page.click('#startSort');
  }

  async clickStepForward() {
    await this.page.click('#stepForward');
  }

  async clickReset() {
    await this.page.click('#reset');
  }

  async setArrayInput(value) {
    await this.page.fill('#arrayInput', value);
  }

  // helper: wait for stepInfo text to change from previous value (with timeout)
  async waitForStepInfoChange(previousText, timeout = 2000) {
    await this.page.waitForFunction(
      (selector, prev) => document.getElementById(selector).textContent.trim() !== prev,
      'stepInfo',
      previousText,
      { timeout }
    );
  }
}

test.describe('Heap Sort Visualization - FSM states and transitions', () => {
  // Each test gets a fresh page and HeapPage wrapper
  let heapPage;

  test.beforeEach(async ({ page }) => {
    heapPage = new HeapPage(page);
    await heapPage.goto();
  });

  test.afterEach(async ({}, testInfo) => {
    // After each test ensure there were no uncaught page errors or console error messages
    // Tests will fail here if the page threw any unexpected runtime errors
    expect(heapPage.pageErrors, 'Expected no uncaught page errors').toHaveLength(0);
    expect(heapPage.consoleErrors, 'Expected no console error messages').toHaveLength(0);
  });

  test('Initial state (S0_Idle) shows Ready to sort and renders the input array', async () => {
    // This test validates the Idle state entry actions: reset() -> Ready to sort!
    // Verify stepInfo text and the array rendered matches the #arrayInput initial value
    const stepInfo = await heapPage.getStepInfoText();
    expect(stepInfo).toBe('Ready to sort!');

    // The input initial value in the HTML is "64,34,25,12,22,11,90"
    const values = await heapPage.getArrayValues();
    expect(values).toEqual([64, 34, 25, 12, 22, 11, 90]);

    // After reset() the Step Forward button should be enabled according to implementation
    const disabled = await heapPage.isStepForwardDisabled();
    expect(disabled).toBe(false);
  });

  test('Generate Random Array event (S0_Idle -> S0_Idle) updates array and shows Ready to sort!', async () => {
    // Validate clicking Generate Random Array produces a new array and stepInfo remains Ready to sort!
    const beforeValues = await heapPage.getArrayValues();
    await heapPage.clickGenerateRandom();

    // After clicking, stepInfo should still be Ready to sort!
    const stepInfoAfter = await heapPage.getStepInfoText();
    expect(stepInfoAfter).toBe('Ready to sort!');

    const afterValues = await heapPage.getArrayValues();
    // The generated array should be an array of numbers and likely different from previous
    expect(Array.isArray(afterValues)).toBe(true);
    expect(afterValues.length).toBeGreaterThanOrEqual(5); // generation produces 5 to 14 elements
    // It's possible by randomness it matches original; ensure it's an array of numbers
    for (const v of afterValues) {
      expect(Number.isFinite(v)).toBe(true);
    }

    // Step forward should remain enabled after generation
    expect(await heapPage.isStepForwardDisabled()).toBe(false);
  });

  test('Start Sorting (S0_Idle -> S1_Sorting) and Step Forward through sorting to completion (S2_Sorted)', async () => {
    // This test:
    // - Clicks Start Sorting and asserts the sorting-started message
    // - Steps forward through all steps until "Sorting completed!"
    // - Verifies visual feedback (swapping/comparison classes appear at some point)
    // - Verifies final state is sorted and stepForward becomes disabled

    // Start sorting
    await heapPage.clickStartSort();

    // After starting, stepInfo should be the started message
    const startedInfo = await heapPage.getStepInfoText();
    expect(startedInfo).toBe('Sorting started. Use Step Forward to see each step.');

    // Step through steps until completion. Track whether we saw swap/comparison classes
    let sawSwap = false;
    let sawCompare = false;
    const maxSteps = 1000; // safety cap to avoid infinite loops
    let iterations = 0;

    // We'll click stepForward repeatedly until the button becomes disabled or stepInfo shows 'Sorting completed!'
    while (iterations < maxSteps) {
      iterations++;

      // Click step forward
      await heapPage.clickStepForward();

      // Allow DOM to update a little
      await heapPage.page.waitForTimeout(10);

      // Inspect elements for 'swapping' or 'comparison' classes on array elements and heap nodes.
      const arrayElems = heapPage.page.locator('#arrayContainer .array-element');
      const heapNodes = heapPage.page.locator('#heapRepresentation .heap-node');

      // Check a few elements for classes
      const arrayCount = await arrayElems.count();
      for (let i = 0; i < arrayCount; i++) {
        const classList = await arrayElems.nth(i).getAttribute('class');
        if (classList && classList.includes('swapping')) sawSwap = true;
        if (classList && classList.includes('comparison')) sawCompare = true;
      }

      const heapCount = await heapNodes.count();
      for (let i = 0; i < heapCount; i++) {
        const classList = await heapNodes.nth(i).getAttribute('class');
        if (classList && classList.includes('swapping')) sawSwap = true;
        if (classList && classList.includes('comparison')) sawCompare = true;
      }

      const info = await heapPage.getStepInfoText();
      if (info === 'Sorting completed!') {
        // Ensure the Step Forward button is disabled after completion
        expect(await heapPage.isStepForwardDisabled()).toBe(true);
        break;
      }
    }

    expect(iterations).toBeLessThan(maxSteps); // ensure we completed within cap

    // At least one swap or comparison should have occurred during heap sort of the default array
    expect(sawSwap || sawCompare).toBe(true);

    // Verify final array displayed is sorted in ascending order (heap sort should produce ascending)
    const finalValues = await heapPage.getArrayValues();
    for (let i = 1; i < finalValues.length; i++) {
      expect(finalValues[i - 1]).toBeLessThanOrEqual(finalValues[i]);
    }
  });

  test('Reset returns to input array (S0_Idle entry) after modifying input and generating random array', async () => {
    // This test ensures Reset restores state per the FSM S0_Idle entry action reset()
    // Set a known custom input, generate random array to change internal array, then Reset to restore input array
    const customInput = '5,4,3,2,1';
    await heapPage.setArrayInput(customInput);

    // Generate random to change internal array state
    await heapPage.clickGenerateRandom();
    const generatedValues = await heapPage.getArrayValues();
    expect(generatedValues.length).toBeGreaterThanOrEqual(5);

    // Now click reset -> should read the #arrayInput value (customInput) and render it
    await heapPage.clickReset();

    const stepInfo = await heapPage.getStepInfoText();
    expect(stepInfo).toBe('Ready to sort!');

    const valuesAfterReset = await heapPage.getArrayValues();
    expect(valuesAfterReset).toEqual([5, 4, 3, 2, 1]);
  });

  test('Edge case: invalid input in arrayInput falls back to default array', async () => {
    // Input invalid non-numeric values; reset should process them and fallback to default if parsed length is 0
    await heapPage.setArrayInput('a,b,c, ,x');

    // Click Reset which is invoked as entry action maybe already called but we explicitly call reset
    await heapPage.clickReset();

    const stepInfo = await heapPage.getStepInfoText();
    expect(stepInfo).toBe('Ready to sort!');

    // The implementation falls back to [64,34,25,12,22,11,90] when parsed array has length 0
    const values = await heapPage.getArrayValues();
    expect(values).toEqual([64, 34, 25, 12, 22, 11, 90]);
  });

  test('Behavior when clicking Step Forward before starting sort: should simply step through prepared steps if any or do nothing gracefully', async () => {
    // This test probes potential edge case: clicking Step Forward without pressing Start Sort.
    // Because resetVisualization enables stepForward and no steps are prepared, clicking should be a no-op.
    // We assert that no errors occur and the stepInfo remains 'Ready to sort!' (or changes only if steps exist)
    const initialInfo = await heapPage.getStepInfoText();
    expect(initialInfo).toBe('Ready to sort!');

    // Click step forward once
    await heapPage.clickStepForward();
    // Wait briefly to allow any DOM effects
    await heapPage.page.waitForTimeout(50);

    const infoAfter = await heapPage.getStepInfoText();
    // If no steps were prepared, info should remain 'Ready to sort!'
    // The app's implementation will only change stepInfo when visualizeStep is called
    expect(infoAfter === 'Ready to sort!' || infoAfter === initialInfo).toBeTruthy();
  });
});