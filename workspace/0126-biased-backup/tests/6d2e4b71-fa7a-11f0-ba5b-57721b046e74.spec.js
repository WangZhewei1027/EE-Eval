import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2e4b71-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object for the Interpolation Search Demo
class InterpolationPage {
  constructor(page) {
    this.page = page;
    this.locators = {
      arraySize: page.locator('#arraySize'),
      minValue: page.locator('#minValue'),
      maxValue: page.locator('#maxValue'),
      sortedCheckbox: page.locator('#sortedCheckbox'),
      generateBtn: page.locator('button[onclick="generateArray()"]'),
      arrayContainer: page.locator('#arrayContainer'),
      searchValue: page.locator('#searchValue'),
      startSearchBtn: page.locator('#runSearch'),
      resetBtn: page.locator('button[onclick="resetSearch()"]'),
      prevStepBtn: page.locator('#prevStep'),
      nextStepBtn: page.locator('#nextStep'),
      runFullSearchBtn: page.locator('button[onclick="runSearch()"]'),
      speedSlider: page.locator('#speedSlider'),
      stepInfo: page.locator('#stepInfo'),
    };
  }

  async waitForLoad() {
    // Ensure the array container is populated by the initial generateArray() call in the page.
    await this.locators.arrayContainer.waitFor({ state: 'visible' });
  }

  async getArrayElementsCount() {
    return await this.page.evaluate(() => document.querySelectorAll('.array-element').length);
  }

  async getStepInfoText() {
    return await this.locators.stepInfo.textContent();
  }

  async setArrayConfig(size, min, max, sorted = true) {
    await this.locators.arraySize.fill(String(size));
    await this.locators.minValue.fill(String(min));
    await this.locators.maxValue.fill(String(max));
    const checked = await this.locators.sortedCheckbox.isChecked();
    if (checked !== sorted) {
      await this.locators.sortedCheckbox.click();
    }
  }

  async clickGenerate() {
    await this.locators.generateBtn.click();
  }

  async setSearchValue(value) {
    await this.locators.searchValue.fill(String(value));
  }

  async clickStartSearch() {
    await this.locators.startSearchBtn.click();
  }

  async clickReset() {
    await this.locators.resetBtn.click();
  }

  async clickNextStep() {
    await this.locators.nextStepBtn.click();
  }

  async clickPrevStep() {
    await this.locators.prevStepBtn.click();
  }

  async clickRunFullSearch() {
    // The "Run Full Search" button on the page uses onclick="runSearch()", selector used below:
    await this.locators.runFullSearchBtn.click();
  }

  async setSpeedSlider(value) {
    await this.locators.speedSlider.fill(String(value));
    // Fire input event to trigger oninput handler
    await this.page.locator('#speedSlider').evaluate((el) => el.dispatchEvent(new Event('input', { bubbles: true })));
  }

  async getWindowVariable(varName) {
    return await this.page.evaluate((name) => window[name], varName);
  }

  async getStepsLength() {
    return await this.page.evaluate(() => (window.steps ? window.steps.length : 0));
  }

  async isElementHighlighted(index) {
    return await this.page.evaluate((i) => {
      const el = document.getElementById(`element-${i}`);
      if (!el) return false;
      return !!(el.style.backgroundColor || el.style.fontWeight);
    }, index);
  }

  async isNextDisabled() {
    return await this.locators.nextStepBtn.isDisabled();
  }

  async isPrevDisabled() {
    return await this.locators.prevStepBtn.isDisabled();
  }

  async isStartDisabled() {
    return await this.locators.startSearchBtn.isDisabled();
  }
}

test.describe('Interpolation Search Interactive Demo - FSM and UI validation', () => {
  // Track console errors and page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen for console messages and page errors. We will assert on these later.
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', (err) => {
      // Capture uncaught exceptions
      pageErrors.push(err);
    });

    // Navigate to the application
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Ensure no unexpected console errors or page errors occurred during the test run.
    // These assertions confirm we observed the console and page errors (if any).
    expect(consoleErrors, 'No console.error messages should have been emitted').toEqual([]);
    expect(pageErrors, 'No uncaught page errors should have been emitted').toEqual([]);
    // Close page to clean up
    await page.close();
  });

  test('S0_Idle: Initial load initializes array and resets search (generateArray on entry)', async ({ page }) => {
    // Validate initial idle state created by onload generateArray()
    const app = new InterpolationPage(page);
    await app.waitForLoad();

    // stepInfo should indicate search not started
    const stepInfo = await app.getStepInfoText();
    expect(stepInfo.trim()).toBe('Search not started');

    // Default array size is 20 per HTML attributes; ensure there are elements
    const count = await app.getArrayElementsCount();
    expect(count).toBeGreaterThanOrEqual(5); // at least min allowed
    expect(count).toBeLessThanOrEqual(50);

    // Prev and Next buttons should be disabled; Start should be enabled
    expect(await app.isPrevDisabled()).toBeTruthy();
    expect(await app.isNextDisabled()).toBeTruthy();
    expect(await app.isStartDisabled()).toBeFalsy();
  });

  test('GenerateArray event: changing configuration and generating new array updates DOM', async ({ page }) => {
    // This validates the GenerateArray transition and S0_Idle -> S0_Idle behavior
    const app = new InterpolationPage(page);
    await app.waitForLoad();

    // Configure a smaller deterministic array size for test stability
    await app.setArrayConfig(10, 0, 10, true);
    await app.clickGenerate();

    // After generation, array container should have exactly 10 elements
    const count = await app.getArrayElementsCount();
    expect(count).toBe(10);

    // stepInfo should be reset to 'Search not started'
    expect((await app.getStepInfoText()).trim()).toBe('Search not started');
  });

  test('StartSearch event: start search with deterministic array and verify transition to Searching (S1_Searching)', async ({ page }) => {
    // We will create a deterministic array by setting minValue == maxValue so every element is identical.
    // This ensures a predictable outcome (FOUND) and consistent steps length.
    const app = new InterpolationPage(page);
    await app.waitForLoad();

    // Create an array where every element is 5
    await app.setArrayConfig(10, 5, 5, true);
    await app.clickGenerate();

    // Ensure array elements were created and reflect the value 5
    const count = await app.getArrayElementsCount();
    expect(count).toBe(10);

    // Set search value to 5 and click Start Search
    await app.setSearchValue(5);

    // No dialog expected, but intercept just in case (fail if unexpected)
    let dialogSeen = false;
    page.on('dialog', async (dialog) => {
      dialogSeen = true;
      // Accept alerts to avoid blocking
      await dialog.accept();
    });

    await app.clickStartSearch();

    // Ensure that startSearch toggled UI state (runSearch disabled)
    expect(await app.isStartDisabled()).toBeTruthy();

    // Steps should be created and current step display should indicate FOUND
    const stepsLen = await app.getStepsLength();
    expect(stepsLen).toBeGreaterThanOrEqual(1);

    const infoText = await app.getStepInfoText();
    expect(infoText).toContain('FOUND');

    // If only one step exists, next should be disabled. Otherwise it should be enabled.
    const nextDisabled = await app.isNextDisabled();
    if (stepsLen === 1) {
      expect(nextDisabled).toBeTruthy();
    } else {
      expect(nextDisabled).toBeFalsy();
    }

    // No unexpected dialog should have appeared
    expect(dialogSeen).toBeFalsy();
  });

  test('NextStep and PrevStep transitions: navigate through steps when multiple steps exist (S2_StepDisplay)', async ({ page }) => {
    const app = new InterpolationPage(page);
    await app.waitForLoad();

    // Try to create conditions likely to produce multiple steps:
    // Use varied min/max so interpolation has to converge (bigger spread)
    await app.setArrayConfig(20, 0, 100, true);
    await app.clickGenerate();

    // Choose a search value likely present: pick element at index 5 to guarantee it's in array
    // We can read the DOM element to get the value and use it as the search target.
    const valueAtIndex5 = await page.evaluate(() => {
      const el = document.getElementById('element-5');
      return el ? parseInt(el.textContent) : null;
    });

    // If not available fallback to a value from index 0
    const searchTarget = valueAtIndex5 !== null ? valueAtIndex5 : await page.evaluate(() => parseInt(document.querySelector('.array-element').textContent));

    await app.setSearchValue(searchTarget);
    await app.clickStartSearch();

    const stepsLen = await app.getStepsLength();

    // If steps length is 0 or 1, there's nothing to navigate; assert graceful handling
    if (stepsLen <= 1) {
      // Next/Prev should be disabled appropriately
      expect(await app.isNextDisabled()).toBeTruthy();
      expect(await app.isPrevDisabled()).toBeTruthy();
      const info = await app.getStepInfoText();
      expect(info).toContain('FOUND');
      return;
    }

    // Ensure we can navigate forward
    const initialInfo = await app.getStepInfoText();
    expect(initialInfo).toContain(`Step 1/${stepsLen}`);

    // Click Next until the last step - verify step index increments and highlight updates
    for (let i = 1; i < stepsLen; i++) {
      await app.clickNextStep();
      const info = await app.getStepInfoText();
      expect(info).toContain(`Step ${i + 1}/${stepsLen}`);
    }

    // At end, Next should be disabled, Prev enabled
    expect(await app.isNextDisabled()).toBeTruthy();
    expect(await app.isPrevDisabled()).toBeFalsy();

    // Navigate back to the first step using Prev
    for (let i = stepsLen - 1; i > 0; i--) {
      await app.clickPrevStep();
    }

    // After returning to first step, Prev should be disabled
    expect(await app.isPrevDisabled()).toBeTruthy();
  });

  test('ResetSearch event: resets UI and clears highlights (S3_Reset)', async ({ page }) => {
    const app = new InterpolationPage(page);
    await app.waitForLoad();

    // Prepare a search scenario
    await app.setArrayConfig(10, 1, 10, true);
    await app.clickGenerate();

    // Pick a value from the array to guarantee existence
    const val = await page.evaluate(() => parseInt(document.getElementById('element-2').textContent));
    await app.setSearchValue(val);
    await app.clickStartSearch();

    // Ensure something is highlighted
    const highlightedBefore = await app.isElementHighlighted(2);
    // It is possible that different index highlighted; just ensure at least one highlight exists
    const anyHighlightedBefore = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.array-element')).some(el => el.style.backgroundColor || el.style.fontWeight);
    });
    expect(anyHighlightedBefore).toBeTruthy();

    // Click Reset
    await app.clickReset();

    // stepInfo should be reset
    expect((await app.getStepInfoText()).trim()).toBe('Search not started');

    // All elements should have no inline highlight styles
    const anyHighlightedAfter = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.array-element')).some(el => el.style.backgroundColor || el.style.fontWeight);
    });
    expect(anyHighlightedAfter).toBeFalsy();

    // Buttons should be reset: prev/next disabled, start enabled
    expect(await app.isPrevDisabled()).toBeTruthy();
    expect(await app.isNextDisabled()).toBeTruthy();
    expect(await app.isStartDisabled()).toBeFalsy();
  });

  test('RunFullSearch event: runs automatic progression through steps and respects speed slider', async ({ page }) => {
    const app = new InterpolationPage(page);
    await app.waitForLoad();

    // Configure and generate array
    await app.setArrayConfig(15, 0, 50, true);
    await app.clickGenerate();

    // Pick a value present in the array
    const pickVal = await page.evaluate(() => {
      const el = document.getElementById('element-7');
      return el ? parseInt(el.textContent) : null;
    });

    if (pickVal === null) {
      test.skip('Element not present to run full search reliably');
      return;
    }

    // Set a fast speed so the runSearch interval completes quickly
    // speed = 1000 - sliderValue, so to set speed small use sliderValue high (e.g., 900 -> speed=100)
    await app.setSpeedSlider(900);
    await app.setSearchValue(pickVal);

    // Click Run Full Search (this uses onclick="runSearch()" button)
    // Wait for run to complete by polling for nextStep to become disabled and prevStep to be enabled (end state)
    await app.clickRunFullSearch();

    // Wait up to a few seconds for the animation to complete; if steps short it will complete almost immediately
    await page.waitForFunction(() => {
      const next = document.getElementById('nextStep');
      const prev = document.getElementById('prevStep');
      // We consider search complete when next is disabled (can't go further)
      return next && next.disabled === true;
    }, { timeout: 5000 });

    // After completion, next should be disabled
    expect(await app.isNextDisabled()).toBeTruthy();

    // stepInfo should indicate FOUND or final step state
    const info = await app.getStepInfoText();
    expect(info).toMatch(/Step \d+\/\d+:|FOUND/);
  });

  test('UpdateSpeed event: slider input updates the internal speed variable', async ({ page }) => {
    const app = new InterpolationPage(page);
    await app.waitForLoad();

    // Default slider value is 500 -> speed = 1000 - 500 = 500
    const initialSpeed = await app.getWindowVariable('speed');
    // speed variable may be initialized to 500 per script
    expect(typeof initialSpeed === 'number').toBeTruthy();

    // Set slider to 800 -> speed should become 200
    await app.setSpeedSlider(800);
    // read speed variable from window
    const newSpeed = await app.getWindowVariable('speed');
    expect(newSpeed).toBe(1000 - 800);
  });

  test('Error scenarios: starting search when array not sorted and when search value invalid triggers alerts (edge cases)', async ({ page }) => {
    const app = new InterpolationPage(page);
    await app.waitForLoad();

    // 1) Unchecked sorted checkbox should trigger alert when starting search
    await app.setArrayConfig(10, 0, 10, false); // unsorted
    await app.clickGenerate();

    // Intercept dialog for unsorted array
    let unsortedDialogMessage = null;
    page.once('dialog', async (dialog) => {
      unsortedDialogMessage = dialog.message();
      await dialog.accept();
    });

    // Provide a valid search value
    await app.setSearchValue(5);
    await app.clickStartSearch();

    // Expect the alert about needing sorted array
    // The application displays: "Array must be sorted for interpolation search!"
    await page.waitForTimeout(50); // small pause to ensure dialog handler fired
    expect(unsortedDialogMessage).toBe('Array must be sorted for interpolation search!');

    // 2) Empty/invalid search value should trigger an alert
    // Ensure array is sorted again
    await app.locators.sortedCheckbox.check();

    // Clear the search value field
    await app.setSearchValue('');
    let invalidDialogMessage = null;
    page.once('dialog', async (dialog) => {
      invalidDialogMessage = dialog.message();
      await dialog.accept();
    });

    await app.clickStartSearch();
    await page.waitForTimeout(50);
    expect(invalidDialogMessage).toBe('Please enter a valid number to search for');
  });
});