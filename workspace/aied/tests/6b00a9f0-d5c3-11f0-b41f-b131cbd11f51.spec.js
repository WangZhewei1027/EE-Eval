import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b00a9f0-d5c3-11f0-b41f-b131cbd11f51.html';

// Page Object for the Quick Sort Visualization page
class QuickSortPage {
  constructor(page) {
    this.page = page;
  }

  // UI element handles
  input() {
    return this.page.locator('#arrayInput');
  }
  generateBtn() {
    return this.page.locator('button[onclick="generateArray()"]');
  }
  startBtn() {
    return this.page.locator('button[onclick="startSorting()"]');
  }
  resetBtn() {
    return this.page.locator('button[onclick="reset()"]');
  }
  nextStepBtn() {
    return this.page.locator('button#nextStepBtn');
  }
  arrayDisplay() {
    return this.page.locator('#arrayDisplay');
  }
  stepInfo() {
    return this.page.locator('#stepInfo');
  }

  // Interactions
  async goto() {
    await this.page.goto(APP_URL);
  }

  async setInputValue(value) {
    await this.input().fill(''); // clear
    await this.input().type(value);
  }

  async clickGenerate() {
    await this.generateBtn().click();
  }
  async clickStart() {
    await this.startBtn().click();
  }
  async clickReset() {
    await this.resetBtn().click();
  }
  async clickNextStep() {
    await this.nextStepBtn().click();
  }

  // Get array element nodes (DOM elements representing values)
  async getArrayElements() {
    return this.arrayDisplay().locator('.element');
  }

  // Convenience getters for page variables via evaluate
  async getOriginalArray() {
    return await this.page.evaluate(() => Array.isArray(originalArray) ? [...originalArray] : null);
  }
  async getCurrentArray() {
    return await this.page.evaluate(() => Array.isArray(currentArray) ? [...currentArray] : null);
  }
  async getSortingSteps() {
    return await this.page.evaluate(() => Array.isArray(sortingSteps) ? [...sortingSteps] : null);
  }
  async getCurrentStepIndex() {
    return await this.page.evaluate(() => typeof currentStep !== 'undefined' ? currentStep : null);
  }
  async getIsSorting() {
    return await this.page.evaluate(() => !!isSorting);
  }
  async isNextStepDisabled() {
    return await this.nextStepBtn().isDisabled();
  }
}

test.describe('Quick Sort Visualization - FSM states and transitions', () => {
  let page;
  let qsPage;
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Collect console error messages and page errors for assertions
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      // capture error-level console messages
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', err => {
      // uncaught exceptions on the page
      pageErrors.push(err);
    });

    qsPage = new QuickSortPage(page);
    await qsPage.goto();
    // Ensure initial load completed before assertions in tests
    await page.waitForLoadState('load');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Initial Idle state (S0_Idle) on load should generate default array and call reset', async () => {
    // This test validates S0_Idle entry action: generateArray() invoked on window.onload
    // and verifies that reset() has been called producing default array display and stepInfo.

    // Step info should be set by reset()
    await expect(qsPage.stepInfo()).toHaveText('Click "Start Quick Sort" to begin');

    // The default input value is provided in HTML; originalArray should be parsed accordingly
    const original = await qsPage.getOriginalArray();
    expect(Array.isArray(original)).toBeTruthy();
    // Default value in HTML: "5,3,8,1,2,7,6,4"
    expect(original).toEqual([5, 3, 8, 1, 2, 7, 6, 4]);

    // arrayDisplay should contain one .element per array item
    const elements = await qsPage.getArrayElements();
    expect(await elements.count()).toBe(original.length);

    // Next Step button must be disabled at idle
    expect(await qsPage.isNextStepDisabled()).toBeTruthy();

    // Ensure no unexpected console errors or uncaught page errors occurred on load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('GenerateArray event transitions S0_Idle -> S1_ArrayGenerated and displays parsed input', async () => {
    // This test validates clicking "Generate Array" after editing input produces the parsed array
    await qsPage.setInputValue('9,1,4');
    await qsPage.clickGenerate();

    // originalArray should reflect new input
    const original = await qsPage.getOriginalArray();
    expect(original).toEqual([9, 1, 4]);

    // currentArray should also be set to the same after reset()
    const current = await qsPage.getCurrentArray();
    expect(current).toEqual([9, 1, 4]);

    // arrayDisplay should show 3 elements with the expected text content
    const elems = qsPage.getArrayElements();
    expect(await elems.count()).toBe(3);
    const texts = await elems.allTextContents();
    expect(texts).toEqual(['9', '1', '4']);

    // stepInfo should be reset message
    await expect(qsPage.stepInfo()).toHaveText('Click "Start Quick Sort" to begin');

    // Next Step remains disabled
    expect(await qsPage.isNextStepDisabled()).toBeTruthy();

    // No console/page errors expected for this normal interaction
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('StartSorting event transitions S1_ArrayGenerated -> S2_Sorting (generates sorting steps and enables Next Step)', async () => {
    // Prepare a known array, generate it, then start sorting
    await qsPage.setInputValue('4,2,6,1');
    await qsPage.clickGenerate();

    // Start the quick sort process
    await qsPage.clickStart();

    // isSorting should be true
    expect(await qsPage.getIsSorting()).toBeTruthy();

    // sortingSteps array should have been populated
    const steps = await qsPage.getSortingSteps();
    expect(Array.isArray(steps)).toBeTruthy();
    expect(steps.length).toBeGreaterThan(0);

    // nextStepBtn should be enabled after startSorting
    expect(await qsPage.isNextStepDisabled()).toBeFalsy();

    // stepInfo should indicate Step 1/... and include "Ready to begin"
    const info = await qsPage.stepInfo().textContent();
    expect(info).toContain('Step 1/');
    expect(info).toContain('Ready to begin');

    // No console/page errors expected
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('NextStep event iterates through sorting steps and eventually reaches Sorting Completed (S3_SortingCompleted)', async () => {
    // This test will click through Next Step until the sorting completes and asserts final state

    // Start with default generated array (from onload)
    // Ensure sorting is started
    await qsPage.clickStart();

    // Wait until sortingSteps is available and has length
    const steps = await qsPage.getSortingSteps();
    expect(steps && steps.length).toBeGreaterThan(0);

    // Click Next Step repeatedly until the next button becomes disabled
    // Put an upper bound to avoid infinite loops in case of bugs
    const maxClicks = 1000;
    let clicks = 0;
    while (!(await qsPage.isNextStepDisabled()) && clicks < maxClicks) {
      // Before clicking, capture current step info
      const prevInfo = await qsPage.stepInfo().textContent();
      await qsPage.clickNextStep();
      // Wait briefly for UI to update after each step
      await page.waitForTimeout(20);
      const newInfo = await qsPage.stepInfo().textContent();

      // After clicking Next Step, stepInfo should update (or eventually append Completed message)
      expect(newInfo.length).toBeGreaterThanOrEqual(prevInfo.length - 50); // generic sanity check

      clicks++;
    }

    // After loop, nextStepBtn must be disabled (sorting completed)
    expect(await qsPage.isNextStepDisabled()).toBeTruthy();

    // stepInfo should contain 'Sorting Completed!'
    const finalInfo = await qsPage.stepInfo().textContent();
    expect(finalInfo).toMatch(/Sorting Completed!/);

    // currentStep should equal sortingSteps.length
    const sortingStepsArr = await qsPage.getSortingSteps();
    const currentIndex = await qsPage.getCurrentStepIndex();
    expect(currentIndex).toBe(sortingStepsArr.length);

    // The displayed array should be present and consist of element divs equal to array length
    const displayedElems = qsPage.getArrayElements();
    expect(await displayedElems.count()).toBeGreaterThan(0);

    // Final expected: no console/page errors during iteration
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Reset event transitions back to Array Generated (S1_ArrayGenerated) and disables Next Step', async () => {
    // Start sorting first to ensure reset acts as an exit from Sorting
    await qsPage.setInputValue('3,2,1');
    await qsPage.clickGenerate();
    await qsPage.clickStart();

    // Confirm next step is enabled
    expect(await qsPage.isNextStepDisabled()).toBeFalsy();

    // Click Reset
    await qsPage.clickReset();

    // After reset: isSorting false and nextStepBtn disabled
    expect(await qsPage.getIsSorting()).toBeFalsy();
    expect(await qsPage.isNextStepDisabled()).toBeTruthy();

    // currentArray should equal originalArray
    const original = await qsPage.getOriginalArray();
    const current = await qsPage.getCurrentArray();
    expect(current).toEqual(original);

    // stepInfo should be reset message
    await expect(qsPage.stepInfo()).toHaveText('Click "Start Quick Sort" to begin');

    // No console/page errors expected
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Empty input falls back to default array when generating', async () => {
    // Clear input entirely and click generate
    await qsPage.setInputValue('');
    await qsPage.clickGenerate();

    // originalArray should fallback to the defined default
    const original = await qsPage.getOriginalArray();
    expect(original).toEqual([5, 3, 8, 1, 2, 7, 6, 4]);

    // arrayDisplay should show 8 elements
    const elems = qsPage.getArrayElements();
    expect(await elems.count()).toBe(8);

    // No console/page errors expected
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Invalid input values filtered out; invalid-only input falls back to default', async () => {
    // Enter invalid input and generate
    await qsPage.setInputValue('a,b,c');
    await qsPage.clickGenerate();

    // Since parsed array would be empty, it should fallback
    const original = await qsPage.getOriginalArray();
    expect(original).toEqual([5, 3, 8, 1, 2, 7, 6, 4]);

    // Mixed valid/invalid input: only valid numbers should be kept
    await qsPage.setInputValue('10, x, 5,foo,2');
    await qsPage.clickGenerate();
    const mixedOriginal = await qsPage.getOriginalArray();
    expect(mixedOriginal).toEqual([10, 5, 2]);

    // No console/page errors expected
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Visual feedback: displayArrayWithHighlights applies pivot/comparing/partition CSS classes correctly for a step', async () => {
    // Use a small array and start sorting to get predictable steps
    await qsPage.setInputValue('3,1,2');
    await qsPage.clickGenerate();
    await qsPage.clickStart();

    // Get generated steps and find one that includes a pivotIndex
    const steps = await qsPage.getSortingSteps();
    expect(steps.length).toBeGreaterThan(0);

    // Find first step that has a pivotIndex >= 0 or comparing array non-empty
    const targetIndex = steps.findIndex(s => (s && (typeof s.pivotIndex === 'number' && s.pivotIndex >= 0)) || (s && Array.isArray(s.comparing) && s.comparing.length > 0));
    expect(targetIndex).toBeGreaterThanOrEqual(0);

    // Set currentStep to that index and call displayArrayWithHighlights by invoking nextStep until we reach it
    // Reset to beginning by generating and starting again (currentStep is 0)
    // Click Next Step until targetIndex is reached
    for (let i = 0; i <= targetIndex; i++) {
      await qsPage.clickNextStep();
      await page.waitForTimeout(10);
    }

    // Now inspect DOM elements for applied classes
    const elems = qsPage.getArrayElements();
    const count = await elems.count();
    expect(count).toBeGreaterThan(0);
    const classLists = [];
    for (let i = 0; i < count; i++) {
      classLists.push(await elems.nth(i).getAttribute('class'));
    }

    // At least one element should have class 'pivot' or 'comparing' or 'partition' depending on step
    const hasHighlight = classLists.some(cl => cl && (cl.includes('pivot') || cl.includes('comparing') || cl.includes('partition')));
    expect(hasHighlight).toBeTruthy();

    // No console/page errors expected
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});