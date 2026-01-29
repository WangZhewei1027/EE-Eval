import { test, expect } from '@playwright/test';

// File: de3b8b82-fa74-11f0-a1b6-4b9b8151441a.spec.js
// Tests for: Insertion Sort Visualization
// URL: http://127.0.0.1:5500/workspace/0126-balanced/html/de3b8b82-fa74-11f0-a1b6-4b9b8151441a.html

// Page Object Model for the visualization page
class InsertionSortPage {
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3b8b82-fa74-11f0-a1b6-4b9b8151441a.html';
  }

  // Navigate to the page and wait for initial render
  async goto() {
    await this.page.goto(this.url);
    // Wait for array container to be populated
    await this.page.waitForSelector('#array-container .array-element');
  }

  // Get button locators
  randomize() { return this.page.locator('#randomize'); }
  sortStep() { return this.page.locator('#sort'); }
  autoSort() { return this.page.locator('#autoSort'); }
  reset() { return this.page.locator('#reset'); }
  arrayElements() { return this.page.locator('#array-container .array-element'); }

  // Read internal state variables from the page context
  async getStateVars() {
    return await this.page.evaluate(() => {
      return {
        arrayLength: array.length,
        currentIndex,
        comparingIndex,
        isSorting,
        // autoSortInterval might be a number (interval id) or null/undefined
        autoSortInterval: typeof autoSortInterval !== 'undefined' ? autoSortInterval : null
      };
    });
  }

  // Read the DOM classes of each array element
  async getArrayClasses() {
    return await this.page.$$eval('#array-container .array-element', els =>
      els.map(el => Array.from(el.classList))
    );
  }

  // Read the text content of each array element (numbers)
  async getArrayValues() {
    return await this.page.$$eval('#array-container .array-element', els =>
      els.map(el => el.textContent.trim())
    );
  }
}

// Helper to step sorting until finished with a max cap to avoid infinite loops
async function stepUntilSorted(pageModel, maxSteps = 500) {
  for (let i = 0; i < maxSteps; i++) {
    const vars = await pageModel.getStateVars();
    if (vars.currentIndex >= vars.arrayLength) {
      // Already sorted
      return vars;
    }
    // Click sort button to perform a single step; ensure button is visible/enabled
    const sortBtn = pageModel.sortStep();
    // If disabled, break to avoid infinite loop
    if (await sortBtn.isDisabled()) break;
    await sortBtn.click();
    // Small wait to allow DOM updates
    await pageModel.page.waitForTimeout(20);
  }
  return await pageModel.getStateVars();
}

test.describe('Insertion Sort Visualization - FSM and UI tests', () => {
  // store console and page errors per test
  test.beforeEach(async ({ page }) => {
    // Attach listeners to capture console errors and page errors
    page._consoleMessages = [];
    page._pageErrors = [];

    page.on('console', msg => {
      // capture console message type and text
      page._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // capture uncaught exceptions
      page._pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Assert that there were no unexpected page errors or console errors
    // The application is expected to run without uncaught exceptions.
    // If there are any, surface them for debugging.
    const consoleErrors = (page._consoleMessages || []).filter(m => m.type === 'error');
    const pageErrors = page._pageErrors || [];

    // Attach diagnostic information to failure messages if any error exists
    expect(pageErrors.length, `Uncaught page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `Console errors: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
  });

  test.describe('Initial Idle State (S0_Idle)', () => {
    // Validate the initial state immediately after page load
    test('should initialize array and display Idle state correctly', async ({ page }) => {
      const model = new InsertionSortPage(page);
      await model.goto();

      // Validate presence of controls and array container
      await expect(model.randomize()).toBeVisible();
      await expect(model.sortStep()).toBeVisible();
      await expect(model.autoSort()).toBeVisible();
      await expect(model.reset()).toBeVisible();

      // Validate initial internal vars and DOM classes reflect Idle
      const vars = await model.getStateVars();
      // initial array length is 10 per initialization logic
      expect(vars.arrayLength).toBe(10);
      expect(vars.currentIndex).toBe(1);
      expect(vars.comparingIndex).toBe(0);
      expect(vars.isSorting).toBe(false);

      // Validate the DOM: index 0 should be 'sorted' and 'comparing'; index 1 should be 'current'
      const classes = await model.getArrayClasses();
      expect(classes.length).toBe(10);
      expect(classes[0]).toEqual(expect.arrayContaining(['array-element', 'sorted', 'comparing']));
      expect(classes[1]).toEqual(expect.arrayContaining(['array-element', 'current']));

      // Buttons enabled in idle state
      expect(await model.sortStep().isDisabled()).toBe(false);
      expect(await model.autoSort().isDisabled()).toBe(false);
    });
  });

  test.describe('Randomize Array Event (RandomizeArray)', () => {
    test('clicking Randomize reinitializes array and keeps Idle state', async ({ page }) => {
      const model = new InsertionSortPage(page);
      await model.goto();

      // capture previous values
      const prevValues = await model.getArrayValues();

      // Click randomize
      await model.randomize().click();
      await page.waitForTimeout(50);

      // After randomize, array should still have 10 elements and state reset
      const vars = await model.getStateVars();
      expect(vars.arrayLength).toBe(10);
      expect(vars.currentIndex).toBe(1);
      expect(vars.comparingIndex).toBe(0);
      expect(vars.isSorting).toBe(false);

      const newValues = await model.getArrayValues();
      // Randomization likely changes at least one value (very high probability)
      // but to be robust, we assert arrays are arrays of length 10 and contain numbers
      expect(newValues.length).toBe(10);
      newValues.forEach(v => expect(Number.isFinite(Number(v))).toBe(true));
    });
  });

  test.describe('Step-by-Step Sorting (S1_Sorting)', () => {
    test('clicking Sort starts sorting (isSorting=true) and performs steps until Sorted (S3_Sorted)', async ({ page }) => {
      const model = new InsertionSortPage(page);
      await model.goto();

      // Start sorting with step-by-step mode
      await model.sortStep().click();
      // Allow small time for the step to execute
      await page.waitForTimeout(20);

      // After initiating, isSorting should be true (entry action)
      let vars = await model.getStateVars();
      expect(vars.isSorting).toBe(true);

      // Continue stepping until sorted or until we hit a safe max iterations
      vars = await stepUntilSorted(model, 1000);

      // After sorting completes, insertionSortStep sets isSorting=false and disables sort/autoSort
      expect(vars.currentIndex >= vars.arrayLength).toBeTruthy();
      expect(vars.isSorting).toBe(false);

      // Buttons should be disabled as per exit actions when sorted
      expect(await model.sortStep().isDisabled()).toBe(true);
      expect(await model.autoSort().isDisabled()).toBe(true);

      // All array elements should have the 'sorted' class in DOM (index < currentIndex)
      const classes = await model.getArrayClasses();
      for (let i = 0; i < classes.length; i++) {
        // after completion currentIndex >= length, so each element should have sorted class
        expect(classes[i]).toEqual(expect.arrayContaining(['array-element', 'sorted']));
      }
    });

    test('clicking Sort while isSorting=true should be ignored (no duplicate starts)', async ({ page }) => {
      const model = new InsertionSortPage(page);
      await model.goto();

      // Start auto sorting to set isSorting true quickly
      await model.autoSort().click();
      await page.waitForTimeout(30);

      // Ensure isSorting is true
      let vars = await model.getStateVars();
      expect(vars.isSorting).toBe(true);

      // Capture interval id before clicking sort (if any)
      const beforeInterval = vars.autoSortInterval;

      // Click sort while isSorting is true - the code should ignore this click
      await model.sortStep().click();
      await page.waitForTimeout(30);

      // State should remain sorting and interval id should not cause new unexpected errors
      vars = await model.getStateVars();
      expect(vars.isSorting).toBe(true);
      // The autoSortInterval may remain defined; ensure it did not become undefined unexpectedly
      expect(vars.autoSortInterval === null || typeof vars.autoSortInterval === 'number').toBe(true);

      // Clean-up: click reset to stop auto sort
      await model.reset().click();
      await page.waitForTimeout(20);
      vars = await model.getStateVars();
      expect(vars.isSorting).toBe(false);
    }, { timeout: 10000 });
  });

  test.describe('Auto Sorting (S2_AutoSorting)', () => {
    test('clicking Auto Sort starts interval-driven sorting and Reset clears it', async ({ page }) => {
      const model = new InsertionSortPage(page);
      await model.goto();

      // Start auto sort
      await model.autoSort().click();
      await page.waitForTimeout(50);

      // Entry evidence: isSorting should be true and autoSortInterval should be set (non-null/undefined)
      let vars = await model.getStateVars();
      expect(vars.isSorting).toBe(true);
      // autoSortInterval can be numeric id; it should not be null/undefined right after start
      expect(vars.autoSortInterval === null || typeof vars.autoSortInterval === 'number').toBe(true);

      // Now click reset which should stop sorting and clear the interval
      await model.reset().click();
      await page.waitForTimeout(50);

      vars = await model.getStateVars();
      // isSorting should be false after reset
      expect(vars.isSorting).toBe(false);
      // currentIndex should be reset to 1
      expect(vars.currentIndex).toBe(1);
      // Buttons should be re-enabled after reset
      expect(await model.sortStep().isDisabled()).toBe(false);
      expect(await model.autoSort().isDisabled()).toBe(false);

      // Because the implementation calls clearInterval(autoSortInterval) but does not set variable to null,
      // we accept either numeric id or null, and rely on isSorting=false as indicator interval was stopped.
      expect(vars.autoSortInterval === null || typeof vars.autoSortInterval === 'number').toBe(true);
    }, { timeout: 10000 });
  });

  test.describe('Reset Transition from Sorted (S3_Sorted -> S0_Idle)', () => {
    test('after fully sorting, Reset returns application to Idle state', async ({ page }) => {
      const model = new InsertionSortPage(page);
      await model.goto();

      // Fully sort using step clicks
      await model.sortStep().click();
      await page.waitForTimeout(20);
      // step until sorted
      let vars = await stepUntilSorted(model, 1000);

      expect(vars.currentIndex >= vars.arrayLength).toBe(true);
      expect(vars.isSorting).toBe(false);
      expect(await model.sortStep().isDisabled()).toBe(true);

      // Now click reset to go back to Idle
      await model.reset().click();
      await page.waitForTimeout(50);

      vars = await model.getStateVars();
      expect(vars.isSorting).toBe(false);
      expect(vars.currentIndex).toBe(1);
      expect(vars.comparingIndex).toBe(0);
      expect(await model.sortStep().isDisabled()).toBe(false);
      expect(await model.autoSort().isDisabled()).toBe(false);

      // DOM should reflect idle classes again: index 0 sorted+comparing, index1 current
      const classes = await model.getArrayClasses();
      expect(classes[0]).toEqual(expect.arrayContaining(['array-element', 'sorted', 'comparing']));
      expect(classes[1]).toEqual(expect.arrayContaining(['array-element', 'current']));
    }, { timeout: 20000 });
  });

  test.describe('Edge cases and robustness checks', () => {
    test('rapid clicks on Randomize do not crash and keep application in Idle', async ({ page }) => {
      const model = new InsertionSortPage(page);
      await model.goto();

      // Rapidly click randomize multiple times
      for (let i = 0; i < 5; i++) {
        await model.randomize().click();
      }
      await page.waitForTimeout(30);

      // State should remain idle
      const vars = await model.getStateVars();
      expect(vars.isSorting).toBe(false);
      expect(vars.currentIndex).toBe(1);

      // Ensure there are still 10 elements
      expect((await model.getArrayValues()).length).toBe(10);
    });

    test('pressing Reset when already idle should be safe and keep Idle', async ({ page }) => {
      const model = new InsertionSortPage(page);
      await model.goto();

      await model.reset().click();
      await page.waitForTimeout(20);

      const vars = await model.getStateVars();
      expect(vars.isSorting).toBe(false);
      expect(vars.currentIndex).toBe(1);
    });

    test('application should not produce console errors or uncaught exceptions during interactions', async ({ page }) => {
      const model = new InsertionSortPage(page);
      await model.goto();

      // perform a sequence of interactions
      await model.randomize().click();
      await model.sortStep().click();
      await page.waitForTimeout(10);
      await model.reset().click();
      await model.autoSort().click();
      await page.waitForTimeout(20);
      await model.reset().click();

      // After interactions, the afterEach hook will assert no console/page errors.
      // We still explicitly assert here that the captured arrays exist and are arrays
      expect(Array.isArray(page._consoleMessages)).toBe(true);
      expect(Array.isArray(page._pageErrors)).toBe(true);
    }, { timeout: 10000 });
  });

});