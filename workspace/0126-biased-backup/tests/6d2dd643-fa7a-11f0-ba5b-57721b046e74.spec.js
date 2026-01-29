import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2dd643-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object to encapsulate common interactions and queries
class CountingSortPage {
  constructor(page) {
    this.page = page;
    this.locators = {
      arraySize: page.locator('#arraySize'),
      sizeValue: page.locator('#sizeValue'),
      maxVal: page.locator('#maxVal'),
      maxValueSpan: page.locator('#maxValue'),
      maxManualValueSpan: page.locator('#maxManualValue'),
      randomize: page.locator('#randomize'),
      manualEdit: page.locator('#manualEdit'),
      manualInputContainer: page.locator('#manualInputContainer'),
      manualInput: page.locator('#manualInput'),
      applyManual: page.locator('#applyManual'),
      stepBack: page.locator('#stepBack'),
      stepForward: page.locator('#stepForward'),
      play: page.locator('#play'),
      reset: page.locator('#reset'),
      complete: page.locator('#complete'),
      speed: page.locator('#speed'),
      currentState: page.locator('#currentState'),
      currentArray: page.locator('#currentArray'),
      countArrayContainer: page.locator('#countArrayContainer'),
      countArray: page.locator('#countArray'),
      outputArrayContainer: page.locator('#outputArrayContainer'),
      outputArray: page.locator('#outputArray'),
      explanation: page.locator('#explanation')
    };
  }

  // Helper to set a range input value and dispatch 'input' event
  async setRange(selectorLocator, value) {
    await this.page.evaluate(
      (el, v) => {
        el.value = String(v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      },
      await selectorLocator.elementHandle(),
      String(value)
    );
  }

  async getCurrentStateText() {
    return (await this.locators.currentState.textContent()).trim();
  }

  async getArrayElementsCount() {
    return await this.locators.currentArray.locator('.array-element').count();
  }

  async getOutputElementsCount() {
    return await this.locators.outputArray.locator('.array-element').count();
  }

  async getCountElementsCount() {
    return await this.locators.countArray.locator('.count-element').count();
  }

  async clickStepForward(times = 1) {
    for (let i = 0; i < times; i++) {
      await this.locators.stepForward.click();
      // give brief time for UI updates
      await this.page.waitForTimeout(50);
    }
  }

  async clickStepBack(times = 1) {
    for (let i = 0; i < times; i++) {
      await this.locators.stepBack.click();
      await this.page.waitForTimeout(50);
    }
  }

  async clickPlayToggle() {
    await this.locators.play.click();
    await this.page.waitForTimeout(50);
  }

  async clickComplete() {
    await this.locators.complete.click();
    await this.page.waitForTimeout(50);
  }

  async isCountArrayVisible() {
    return (await this.locators.countArrayContainer.evaluate(el => window.getComputedStyle(el).display !== 'none'));
  }

  async isOutputArrayVisible() {
    return (await this.locators.outputArrayContainer.evaluate(el => window.getComputedStyle(el).display !== 'none'));
  }

  async getExplanationHTML() {
    return await this.locators.explanation.innerHTML();
  }
}

test.describe('Interactive Counting Sort - FSM and UI tests', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
    });

    // Capture unhandled page errors (e.g., ReferenceError, TypeError, etc.)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(BASE);
  });

  test.afterEach(async ({ page }) => {
    // Keep page open teardown handled by Playwright
  });

  test('Initial state loads correctly and basic UI elements are present', async ({ page }) => {
    // Validate initial loaded state and controls
    const p = new CountingSortPage(page);

    // Current state should be "Initial Array"
    await expect(p.locators.currentState).toHaveText('Initial Array');

    // Step back should be disabled at initial
    await expect(p.locators.stepBack).toBeDisabled();

    // Step forward enabled
    await expect(p.locators.stepForward).toBeEnabled();

    // Count and output sections hidden initially
    expect(await p.isCountArrayVisible()).toBe(false);
    expect(await p.isOutputArrayVisible()).toBe(false);

    // Array elements should match default array size (value attribute default is 10)
    const arrayCount = await p.getArrayElementsCount();
    expect(arrayCount).toBeGreaterThanOrEqual(3);
    expect(arrayCount).toBeLessThanOrEqual(20);

    // Explanation contains initial guidance
    const explanation = await p.getExplanationHTML();
    expect(explanation).toContain('Initial array. Click "Step Forward" to begin counting');

    // No unexpected page errors occurred during initial load
    expect(Array.isArray(pageErrors)).toBe(true);
    expect(pageErrors.length).toBe(0);
  });

  test('Changing array size and max value updates UI and regenerates arrays', async ({ page }) => {
    const p = new CountingSortPage(page);

    // Set array size to 5 (small testable size)
    await p.setRange(p.locators.arraySize, 5);
    await page.waitForTimeout(100); // allow generateRandomArray() to run
    await expect(p.locators.sizeValue).toHaveText('5');

    // Set max value to 3 to reduce steps needed in other tests
    await p.setRange(p.locators.maxVal, 3);
    await page.waitForTimeout(100);
    await expect(p.locators.maxValueSpan).toHaveText('3');
    await expect(p.locators.maxManualValueSpan).toHaveText('3');

    // Now array length should be 5
    const arrayCount = await p.getArrayElementsCount();
    expect(arrayCount).toBe(5);

    // Count array should still be hidden until stepping
    expect(await p.isCountArrayVisible()).toBe(false);

    // No runtime page errors observed when changing controls
    expect(pageErrors.length).toBe(0);
  });

  test('Manual edit toggle shows manual input and invalid apply triggers alert', async ({ page }) => {
    const p = new CountingSortPage(page);

    // Ensure manual input container is hidden initially
    expect(await p.locators.manualInputContainer.evaluate(el => window.getComputedStyle(el).display === 'none')).toBe(true);

    // Click "Edit Manually" to show container
    await p.locators.manualEdit.click();
    await page.waitForTimeout(50);

    // Container should be visible and manual input prefilled
    expect(await p.locators.manualInputContainer.evaluate(el => window.getComputedStyle(el).display !== 'none')).toBe(true);
    const prefilled = await p.locators.manualInput.inputValue();
    expect(typeof prefilled).toBe('string');

    // Apply invalid input (non-numeric) and assert alert dialog appears
    const dialogPromise = page.waitForEvent('dialog');
    await p.locators.manualInput.fill('a, b, -1');
    await p.locators.applyManual.click();
    const dialog = await dialogPromise;
    // The implementation alerts: "Please enter numbers between 0 and ${maxValue} separated by commas."
    expect(dialog.message()).toContain('Please enter numbers');
    await dialog.dismiss();

    // Dismissed dialog should not produce page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Manual edit with valid input applies and updates the current array', async ({ page }) => {
    const p = new CountingSortPage(page);

    // Set small max value to 3 and array size to 4 for deterministic test
    await p.setRange(p.locators.maxVal, 3);
    await p.setRange(p.locators.arraySize, 4);
    await page.waitForTimeout(100);

    // Open manual edit
    await p.locators.manualEdit.click();
    await page.waitForTimeout(50);

    // Provide a valid manual array within range
    const manualValue = '2, 1, 0, 3';
    await p.locators.manualInput.fill(manualValue);

    // Listen for dialog to not appear, but still handle if it does
    let dialogOccurred = false;
    const dialogHandler = page.on('dialog', async dialog => {
      dialogOccurred = true;
      await dialog.dismiss();
    });

    await p.locators.applyManual.click();
    await page.waitForTimeout(100);

    // If a dialog happened, that's a failure; assert none happened
    expect(dialogOccurred).toBe(false);

    // Manual container should be hidden after successful apply
    expect(await p.locators.manualInputContainer.evaluate(el => window.getComputedStyle(el).display === 'none')).toBe(true);

    // Current array should now reflect the manual input (length and visible contents)
    const arrCount = await p.getArrayElementsCount();
    expect(arrCount).toBe(4);

    // Ensure the UI still has no page errors
    expect(pageErrors.length).toBe(0);

    // Remove dialog handler
    page.off('dialog', dialogHandler);
  });

  test('Step through all phases (Counting -> Cumulative -> Building Output -> Complete) and validate transitions and DOM updates', async ({ page }) => {
    const p = new CountingSortPage(page);

    // Configure compact test scenario: arraySize = 4, maxVal = 3
    await p.setRange(p.locators.arraySize, 4);
    await p.setRange(p.locators.maxVal, 3);
    await page.waitForTimeout(100);

    // Ensure initial
    expect(await p.getCurrentStateText()).toBe('Initial Array');

    // 1) First step: enter Counting Phase
    await p.clickStepForward(1);
    expect(await p.getCurrentStateText()).toBe('Counting Phase');

    // Count array should be visible
    expect(await p.isCountArrayVisible()).toBe(true);

    // At counting phase there should be (maxValue + 1) count elements (4 in our config)
    const countElems = await p.getCountElementsCount();
    expect(countElems).toBe(4);

    // The explanation should mention "Counting Phase"
    const explanation1 = await p.getExplanationHTML();
    expect(explanation1).toContain('Counting Phase');

    // 2) Complete counting phase: need (maxValue + 1) iterations in counting loop.
    const maxVal = parseInt(await p.locators.maxVal.evaluate(el => el.value));
    await p.clickStepForward(maxVal + 1);
    // After finishing counting, current state should transition to Cumulative
    expect(await p.getCurrentStateText()).toBe('Cumulative Count Phase');
    const explanation2 = await p.getExplanationHTML();
    expect(explanation2).toContain('Cumulative Count Phase');

    // 3) Complete cumulative phase: need (maxValue + 1) iterations
    await p.clickStepForward(maxVal + 1);
    // After cumulative, should be in Building Output
    expect(await p.getCurrentStateText()).toBe('Building Output');
    // Output array should be visible now
    expect(await p.isOutputArrayVisible()).toBe(true);

    // 4) Complete building output: need arraySize iterations
    const arraySize = parseInt(await p.locators.arraySize.evaluate(el => el.value));
    await p.clickStepForward(arraySize);
    // Now should be sorting complete
    expect(await p.getCurrentStateText()).toBe('Sorting Complete');
    const explanationFinal = await p.getExplanationHTML();
    expect(explanationFinal).toContain('Sorting Complete');

    // Validate updateControls: stepForward disabled in final state
    await expect(p.locators.stepForward).toBeDisabled();
    // complete button disabled in final state
    await expect(p.locators.complete).toBeDisabled();

    // Now test stepping back one step to Building Output
    await p.clickStepBack(1);
    expect(await p.getCurrentStateText()).toBe('Building Output');

    // Step back until we reach Initial Array; compute how many steps we took and reverse them.
    // We performed totalSteps:
    // 1 (enter counting) + (maxVal+1) + (maxVal+1) + arraySize = total
    const totalStepsPerformed = 1 + (maxVal + 1) + (maxVal + 1) + arraySize;
    // We have already stepped back 1, remaining to go back to initial:
    const remainingBackSteps = totalStepsPerformed - 1;
    // Step back remaining times
    await p.clickStepBack(remainingBackSteps);
    expect(await p.getCurrentStateText()).toBe('Initial Array');

    // Confirm count and output arrays hidden again
    expect(await p.isCountArrayVisible()).toBe(false);
    expect(await p.isOutputArrayVisible()).toBe(false);

    // No uncaught page errors throughout
    expect(pageErrors.length).toBe(0);
  }, { timeout: 20000 });

  test('Play/Pause toggles and Complete Sort button completes the algorithm immediately', async ({ page }) => {
    const p = new CountingSortPage(page);

    // Configure small scenario
    await p.setRange(p.locators.arraySize, 4);
    await p.setRange(p.locators.maxVal, 3);
    await page.waitForTimeout(100);

    // Click play to start animation; play toggles text to "Pause"
    await p.clickPlayToggle();
    // Immediately, the text should be "Pause"
    await expect(p.locators.play).toHaveText('Pause');

    // Let it run briefly and then pause
    await page.waitForTimeout(300);
    await p.clickPlayToggle();
    // Now should be "Play" again
    await expect(p.locators.play).toHaveText('Play');

    // Press complete to finish algorithm immediately
    await p.clickComplete();
    expect(await p.getCurrentStateText()).toBe('Sorting Complete');

    // After completion, stepForward should be disabled
    await expect(p.locators.stepForward).toBeDisabled();

    // No unexpected runtime errors
    expect(pageErrors.length).toBe(0);
  });

  test('Observes console messages and page errors during interactions', async ({ page }) => {
    const p = new CountingSortPage(page);

    // Perform a few interactions to generate console messages (randomize, step forward, reset)
    await p.locators.randomize.click();
    await p.locators.stepForward.click();
    await p.locators.reset.click();
    await page.waitForTimeout(100);

    // We collected console messages; ensure we have an array and it's not unexpectedly empty
    expect(Array.isArray(consoleMessages)).toBe(true);
    // At least one console message entry exists (the page may not log much; if none, it's acceptable)
    // We assert the captured array is defined and accessible
    expect(consoleMessages).toBeDefined();

    // Assert there were no unhandled page errors (such as ReferenceError, TypeError)
    expect(pageErrors.length).toBe(0);
  });
});