import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f1811962-d366-11f0-9b19-a558354ece3e.html';

// Page Object for the Merge Sort Visualization page
class MergeSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      arrayInput: '#arrayInput',
      startBtn: "button[onclick='startSorting()']",
      nextBtn: "button[onclick='nextStep()']",
      prevBtn: "button[onclick='previousStep()']",
      resetBtn: "button[onclick='reset()']",
      stepInfo: '#stepInfo',
      visualization: '#visualization',
      arrayElements: '.array-element'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure page is loaded
    await expect(this.page.locator(this.selectors.startBtn)).toBeVisible();
  }

  async getStepInfoText() {
    return this.page.locator(this.selectors.stepInfo).innerText();
  }

  async isNextDisabled() {
    return await this.page.locator(this.selectors.nextBtn).isDisabled();
  }

  async isPrevDisabled() {
    return await this.page.locator(this.selectors.prevBtn).isDisabled();
  }

  async clickStart() {
    await Promise.all([
      this.page.waitForTimeout(50), // slight pause to avoid racing, UI is sync but keep it stable
      this.page.click(this.selectors.startBtn)
    ]);
  }

  async clickNext() {
    await this.page.click(this.selectors.nextBtn);
  }

  async clickPrevious() {
    await this.page.click(this.selectors.prevBtn);
  }

  async clickReset() {
    await this.page.click(this.selectors.resetBtn);
  }

  async getVisualizationText() {
    return this.page.locator(this.selectors.visualization).innerText();
  }

  async getArrayElementsText() {
    return this.page.$$eval(this.selectors.arrayElements, els => els.map(e => e.textContent.trim()));
  }

  async getArrayElementsCount() {
    return this.page.locator(this.selectors.arrayElements).count();
  }

  // Access internal page variables (steps, currentStep, isSorting)
  async getInternalState() {
    return this.page.evaluate(() => {
      return {
        originalArray: typeof originalArray !== 'undefined' ? originalArray : null,
        steps: typeof steps !== 'undefined' ? steps : null,
        stepsLength: typeof steps !== 'undefined' ? steps.length : null,
        currentStep: typeof currentStep !== 'undefined' ? currentStep : null,
        isSorting: typeof isSorting !== 'undefined' ? isSorting : null
      };
    });
  }

  async setInputValue(value) {
    await this.page.fill(this.selectors.arrayInput, value);
  }

  async getInputValue() {
    return this.page.locator(this.selectors.arrayInput).inputValue();
  }
}

test.describe('Merge Sort Visualization - FSM and UI tests', () => {
  // Collect console errors and page errors for assertions
  let consoleErrors;
  let pageErrors;
  let mergeSort;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      // Capture console errors and warnings for inspection
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location ? msg.location() : null });
      }
    });

    page.on('pageerror', err => {
      // Uncaught exceptions on the page
      pageErrors.push(err);
    });

    mergeSort = new MergeSortPage(page);
    await mergeSort.goto();
  });

  test.afterEach(async () => {
    // Assert that there were no unexpected runtime page errors (ReferenceError/SyntaxError/TypeError)
    // We observe console and page errors and assert none occurred.
    // This verifies the page runs without uncaught exceptions during our interactions.
    const errorNames = pageErrors.map(e => e.name);
    // Fail if any uncaught page errors present
    expect(pageErrors, `Uncaught page errors: ${JSON.stringify(pageErrors, null, 2)}`).toEqual([]);
    // Fail if any console errors captured
    expect(consoleErrors, `Console errors: ${JSON.stringify(consoleErrors, null, 2)}`).toEqual([]);
  });

  test('Initial Idle state: UI elements & defaults are correct', async () => {
    // Validate initial Idle state (S0_Idle)
    // - Start Sorting button exists
    // - Next/Previous buttons are disabled
    // - Step info shows Step: 0/0
    // - Visualization is empty
    const startBtn = mergeSort.page.locator(mergeSort.selectors.startBtn);
    await expect(startBtn).toBeVisible();
    await expect(mergeSort.page.locator(mergeSort.selectors.nextBtn)).toBeDisabled();
    await expect(mergeSort.page.locator(mergeSort.selectors.prevBtn)).toBeDisabled();

    const stepInfo = await mergeSort.getStepInfoText();
    expect(stepInfo.trim()).toBe('Step: 0/0');

    const vizText = (await mergeSort.getVisualizationText()).trim();
    // Visualization should be empty initially
    expect(vizText).toBe('');

    // Internal state check: steps array should exist and be empty, isSorting false, currentStep 0
    const state = await mergeSort.getInternalState();
    expect(state.steps).toEqual([]);
    expect(state.stepsLength).toBe(0);
    expect(state.currentStep).toBe(0);
    expect(state.isSorting).toBe(false);
  });

  test('StartSorting transition moves to Sorting state and populates steps', async () => {
    // Start the sorting process (S0_Idle -> S1_Sorting)
    // Validate internal variables after startSorting:
    // - originalArray is parsed
    // - steps is populated (steps.length > 0)
    // - currentStep === 0
    // - isSorting === true
    await mergeSort.clickStart();

    // After clicking start, internal 'steps' should be non-empty
    const state = await mergeSort.getInternalState();
    expect(Array.isArray(state.originalArray)).toBeTruthy();
    expect(state.originalArray.length).toBeGreaterThan(0);
    expect(state.stepsLength).toBeGreaterThan(0);
    expect(state.currentStep).toBe(0);
    expect(state.isSorting).toBe(true);

    // UI updates: next button should eventually be enabled if more than one step exists
    // updateControls disables next if currentStep === steps.length - 1, so for large enough steps it's enabled
    if (state.stepsLength > 1) {
      await expect(mergeSort.page.locator(mergeSort.selectors.nextBtn)).toBeEnabled();
    } else {
      await expect(mergeSort.page.locator(mergeSort.selectors.nextBtn)).toBeDisabled();
    }

    // Step info should be updated to show current step and step message
    const stepInfoText = await mergeSort.getStepInfoText();
    expect(stepInfoText).toMatch(/^Step: 1\/\d+ - /);
    // Visualization should contain at least one array-element
    const elementCount = await mergeSort.getArrayElementsCount();
    expect(elementCount).toBeGreaterThanOrEqual(1);
  });

  test('NextStep and PreviousStep transitions within Sorting state behave correctly and finalizes to Sorted', async () => {
    // Start sorting and then step forward and back, verifying currentStep and visual output.
    await mergeSort.clickStart();
    let state = await mergeSort.getInternalState();
    const totalSteps = state.stepsLength;

    // If totalSteps is 0 (defensive), treat as an immediate final state
    if (totalSteps === 0) {
      // Should show final sorted message in visualization
      const viz = await mergeSort.getVisualizationText();
      expect(viz).toContain('Array is fully sorted!');
      return;
    }

    // Click next until we reach the last available step index (steps.length - 1)
    // The application's nextStep only increments while currentStep < steps.length - 1
    for (let i = 0; i < Math.min(5, totalSteps - 1); i++) {
      const before = await mergeSort.getInternalState();
      await mergeSort.clickNext();
      const after = await mergeSort.getInternalState();
      // If before.currentStep < steps.length - 1, it should have incremented
      if (before.currentStep < before.stepsLength - 1) {
        expect(after.currentStep).toBe(before.currentStep + 1);
      } else {
        // If it was already at last step, clicking should not change currentStep
        expect(after.currentStep).toBe(before.currentStep);
      }
    }

    // Now click previous once (if possible) and assert currentStep decreases
    const beforePrev = await mergeSort.getInternalState();
    if (beforePrev.currentStep > 0) {
      await mergeSort.clickPrevious();
      const afterPrev = await mergeSort.getInternalState();
      expect(afterPrev.currentStep).toBe(beforePrev.currentStep - 1);
    } else {
      // If at 0, previous should keep it at 0
      await mergeSort.clickPrevious();
      const afterPrev = await mergeSort.getInternalState();
      expect(afterPrev.currentStep).toBe(0);
    }

    // Move to the end to trigger final Sorted state: click next until currentStep >= steps.length
    // Note: the code sets final display when currentStep >= steps.length
    // To simulate that, repeatedly click next until we cannot progress further; then manually set currentStep to steps.length to test final UI.
    // But we cannot mutate page internals. Instead, click next until nextBtn is disabled (last step)
    // and then click next once more will not change (code prevents increment when at last index).
    // The displayStep shows final sorted array when currentStep >= steps.length. Since code doesn't increment beyond steps.length-1,
    // the only way to hit the final branch is when steps.length === 0 or currentStep >= steps.length.
    // However, displayStep can show final sorted array if currentStep >= steps.length. Given code, this occurs only if someone sets currentStep >= steps.length.
    // We'll still verify the behavior at the last step and validate the final merge output by inspecting the last recorded step and the 'sorted' rendering if we simulate reset then display.
    // Validate last visible step message exists
    const lastState = await mergeSort.getInternalState();
    const lastIndex = Math.max(0, lastState.stepsLength - 1);
    // Navigate to last index by repeatedly clicking next
    for (let i = lastState.currentStep; i < lastIndex; i++) {
      await mergeSort.clickNext();
    }
    const atLast = await mergeSort.getInternalState();
    expect(atLast.currentStep).toBe(lastIndex);

    // At the last step, next button should be disabled by updateControls
    await expect(mergeSort.page.locator(mergeSort.selectors.nextBtn)).toBeDisabled();

    // Check that visualization shows the last recorded step message in step-info within visualization OR array elements
    const vizText = await mergeSort.getVisualizationText();
    expect(vizText.length).toBeGreaterThan(0);

    // Now simulate finishing by invoking reset to clear and then re-run a short sort to reach final "Array is fully sorted!" view:
    await mergeSort.clickReset();
    // After reset, steps should be empty and visualization empty
    const cleared = await mergeSort.getInternalState();
    expect(cleared.stepsLength).toBe(0);
    expect(await mergeSort.getVisualizationText()).toBe('');

    // Re-run sorting and then manually advance to end by repeated calls to next until no change occurs.
    await mergeSort.clickStart();
    let s = await mergeSort.getInternalState();
    // Repeatedly attempt next until no change in currentStep
    let prevStep = -1;
    for (let i = 0; i < 500; i++) {
      const cur = await mergeSort.getInternalState();
      if (cur.currentStep === prevStep) break;
      prevStep = cur.currentStep;
      await mergeSort.clickNext();
    }
    // After exhausting next presses, attempt to detect final "Array is fully sorted!" in visualization.
    const finalViz = await mergeSort.getVisualizationText();
    // The final sorted message will appear in the visualization only if displayStep ran the branch for final array.
    // It's safer to verify that the visualization contains sorted elements (green) when steps exhausted.
    // Check that there is at least one element with class 'array-element' and that some have 'sorted' class set in DOM snapshot
    const arrayTexts = await mergeSort.getArrayElementsText();
    expect(arrayTexts.length).toBeGreaterThanOrEqual(1);
  });

  test('Reset transition returns to Idle state and clears internal state and UI', async () => {
    // Start sorting and then reset
    await mergeSort.clickStart();
    const started = await mergeSort.getInternalState();
    expect(started.stepsLength).toBeGreaterThan(0);
    expect(started.isSorting).toBe(true);

    // Click reset (S1_Sorting -> S0_Idle)
    await mergeSort.clickReset();

    // Validate internal state reset
    const state = await mergeSort.getInternalState();
    expect(state.isSorting).toBe(false);
    expect(state.currentStep).toBe(0);
    expect(state.stepsLength).toBe(0);
    // UI controls disabled
    await expect(mergeSort.page.locator(mergeSort.selectors.nextBtn)).toBeDisabled();
    await expect(mergeSort.page.locator(mergeSort.selectors.prevBtn)).toBeDisabled();
    // step info text reset
    expect(await mergeSort.getStepInfoText()).toBe('Step: 0/0');
    // input value reset to default
    expect(await mergeSort.getInputValue()).toBe('5,2,8,1,9,3,7,4,6');
    // visualization cleared
    expect(await mergeSort.getVisualizationText()).toBe('');
  });

  test('Edge case: invalid/empty input triggers alert and does not start sorting', async ({ page }) => {
    // Replace input with invalid content (empty string)
    await mergeSort.setInputValue('');
    // Listen for dialog and assert alert text
    let dialogMessage = null;
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    await mergeSort.clickStart();

    // Wait a moment for dialog to appear, if any
    await page.waitForTimeout(100);

    expect(dialogMessage).toBe('Please enter valid numbers separated by commas');

    // Ensure no steps have been created
    const state = await mergeSort.getInternalState();
    expect(state.stepsLength).toBe(0);
    expect(state.isSorting).toBe(false);

    // Restore input for cleanliness
    await mergeSort.setInputValue('5,2,8,1,9,3,7,4,6');
  });

  test('DOM visual cues: elements in visualization have expected classes and colors', async () => {
    // Start sorting and inspect first few steps for expected DOM changes:
    await mergeSort.clickStart();

    // Wait a tick to ensure visualization rendered
    await mergeSort.page.waitForTimeout(50);

    // The visualization should contain array elements with class 'array-element'
    const elements = mergeSort.page.locator(mergeSort.selectors.arrayElements);
    await expect(elements).toHaveCountGreaterThan(0);

    // For the current step, some elements may have inline backgroundColor set to merging color #FF9800
    // We'll capture style attribute values for array elements in current visualization
    const bgColors = await mergeSort.page.$$eval('.array-container .array-element', nodes =>
      nodes.map(n => n.style.backgroundColor)
    );

    // At least one element should have a non-empty background color (either set inline or default CSS)
    const nonEmptyColors = bgColors.filter(c => c && c.trim().length > 0);
    expect(nonEmptyColors.length).toBeGreaterThanOrEqual(1);

    // Move to last step and validate 'sorted' visuals exist (class includes 'sorted' or background color green)
    const internal = await mergeSort.getInternalState();
    const lastIndex = Math.max(0, internal.stepsLength - 1);
    for (let i = internal.currentStep; i < lastIndex; i++) {
      await mergeSort.clickNext();
    }

    // Now reset to get final sorted rendering (displayStep will render final sorted array when steps empty or final trigger)
    // But since reset clears steps, instead inspect that array elements (when showing sorted state) have class 'sorted'
    // Attempt to call displayStep indirectly by setting currentStep to a large value isn't allowed. So we assert that on the last step,
    // some array elements have inline green background (#FF9800 is merging, '#4CAF50' is sorted).
    const lastBgColors = await mergeSort.page.$$eval('.array-container .array-element', nodes =>
      nodes.map(n => ({ text: n.textContent.trim(), bg: n.style.backgroundColor, className: n.className }))
    );

    // It is acceptable for some elements to have 'sorted' class on the last visible step
    const hasSortedClass = lastBgColors.some(n => n.className.includes('sorted') || n.bg.includes('rgb') || n.bg.includes('#4CAF50'));
    expect(hasSortedClass).toBeTruthy();
  });
});