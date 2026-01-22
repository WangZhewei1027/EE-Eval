import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79ca0a2-d361-11f0-8438-11a56595a476.html';

// Page Object Model for the Insertion Sort Visualization app
class InsertionSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputArray');
    this.startButton = page.locator('#startButton');
    this.arrayContainer = page.locator('#arrayContainer');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getInputValue() {
    return await this.input.inputValue();
  }

  async setInputValue(value) {
    await this.input.fill(value);
    // trigger input event if needed
    await this.input.evaluate((el) => el.dispatchEvent(new Event('input', { bubbles: true })));
  }

  async clickStart() {
    await this.startButton.click();
  }

  async isStartDisabled() {
    return await this.startButton.evaluate((b) => b.disabled);
  }

  async isInputDisabled() {
    return await this.input.evaluate((i) => i.disabled);
  }

  async getBars() {
    return this.page.locator('#arrayContainer .bar');
  }

  async waitForAnyBarStateDuringSort(timeout = 10000) {
    // Wait for either .current or .compared to appear - indicates sorting is in progress
    await this.page.waitForSelector('#arrayContainer .bar.current, #arrayContainer .bar.compared', {
      timeout,
    });
  }

  async waitForSortingToComplete(timeout = 30000) {
    // Sorting completion indicated by startButton becoming enabled again
    await this.page.waitForFunction(() => {
      const btn = document.getElementById('startButton');
      return btn && !btn.disabled;
    }, null, { timeout });
  }

  async getBarCount() {
    return await this.getBars().count();
  }

  async allBarsHaveClass(clazz) {
    const count = await this.getBars().count();
    for (let i = 0; i < count; i++) {
      const has = await this.getBars().nth(i).evaluate((el, c) => el.classList.contains(c), clazz);
      if (!has) return false;
    }
    return true;
  }
}

test.describe('Insertion Sort Visualization - FSM and UI validation', () => {
  // Collect console messages and page errors for each test run
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Listen for uncaught page errors
    page.on('pageerror', (err) => {
      // Capture page error objects
      pageErrors.push(err);
    });

    // Capture console messages (info/warn/error) for debugging/validation
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test.afterEach(async () => {
    // After each test we will assert there were no uncaught page errors.
    // This ensures we observed runtime issues (ReferenceError/TypeError/SyntaxError) if they occurred.
    expect(pageErrors, `No uncaught page.errors should have occurred. Console messages: ${JSON.stringify(consoleMessages)}`).toHaveLength(0);
  });

  test('S0_Idle: initial state has example input set and no bars drawn (setExampleArray onEnter)', async ({ page }) => {
    // Validate initial Idle state and the onEnter action setExampleArray()
    const app = new InsertionSortPage(page);
    await app.goto();

    // The initial example array is set by setExampleArray()
    const initialValue = await app.getInputValue();
    expect(initialValue).toBe('5, 3, 8, 6, 2, 7, 4, 1');

    // No bars should be drawn until sorting starts (initial idle)
    const barCount = await app.getBarCount();
    expect(barCount).toBe(0);

    // Start button should be enabled in Idle state
    expect(await app.isStartDisabled()).toBe(false);
    expect(await app.isInputDisabled()).toBe(false);
  });

  test('StartSorting (S0_Idle -> S1_Sorting): clicking Start Sorting disables controls and shows visual steps, then re-enables after completion', async ({ page }) => {
    // This test validates:
    // - Transition from Idle to Sorting when Start Sorting clicked
    // - Entry actions: insertionSortVisual runs and visual DOM updates appear (.current/.compared)
    // - Exit actions: drawArray(...); startButton and input re-enabled after sorting
    const app = new InsertionSortPage(page);
    await app.goto();

    // Use a small custom array to keep test timings reasonable
    await app.setInputValue('3,1,2');

    // Start sorting
    const [dialogPromise] = []; // no dialog expected here, just placeholder
    await app.clickStart();

    // Immediately after clicking, controls should be disabled (S1_Sorting entry)
    await page.waitForFunction(() => document.getElementById('startButton').disabled === true);
    expect(await app.isStartDisabled()).toBe(true);
    expect(await app.isInputDisabled()).toBe(true);

    // During sorting, at least once a bar should be in .current or .compared state
    await app.waitForAnyBarStateDuringSort(10000);

    // Ensure bars are rendered and count equals number of input values
    const barCountDuring = await app.getBarCount();
    expect(barCountDuring).toBe(3);

    // Wait for sorting to finish (start button re-enabled)
    await app.waitForSortingToComplete(20000);

    // After sorting, controls must be re-enabled (S1_Sorting -> S0_Idle exit actions)
    expect(await app.isStartDisabled()).toBe(false);
    expect(await app.isInputDisabled()).toBe(false);

    // Final bars count should still equal input length and they should all be marked as sorted
    const finalBarCount = await app.getBarCount();
    expect(finalBarCount).toBe(3);

    // Each final bar should have the 'sorted' class because drawArray(..., sortedUpto = arr.length-1) is called
    const allSorted = await app.allBarsHaveClass('sorted');
    expect(allSorted).toBe(true);
  });

  test('Edge case: empty input triggers alert and prevents sorting', async ({ page }) => {
    // Validate InputValidation event: empty input triggers alert and sorting is not started
    const app = new InsertionSortPage(page);
    await app.goto();

    // Clear input to simulate empty input scenario
    await app.setInputValue('');

    // Listen for dialog once and validate message
    page.once('dialog', async (dialog) => {
      try {
        expect(dialog.message()).toBe('Please enter a list of numbers separated by commas.');
      } finally {
        await dialog.dismiss();
      }
    });

    // Click start and expect the alert to show and no sorting to occur
    await app.clickStart();

    // Ensure controls remain enabled (sorting should not have been initiated)
    expect(await app.isStartDisabled()).toBe(false);
    expect(await app.isInputDisabled()).toBe(false);

    // No bars should be created
    const barCount = await app.getBarCount();
    expect(barCount).toBe(0);
  });

  test('Edge case: non-numeric input triggers validation alert', async ({ page }) => {
    // Validate that invalid numeric input triggers the appropriate alert and sorting is not started
    const app = new InsertionSortPage(page);
    await app.goto();

    await app.setInputValue('5, a, 3');

    page.once('dialog', async (dialog) => {
      try {
        expect(dialog.message()).toBe('Please make sure all inputs are valid numbers.');
      } finally {
        await dialog.dismiss();
      }
    });

    await app.clickStart();

    // Ensure controls remain enabled and no bars are drawn
    expect(await app.isStartDisabled()).toBe(false);
    expect(await app.isInputDisabled()).toBe(false);
    expect(await app.getBarCount()).toBe(0);
  });

  test('Edge case: single number input triggers "at least two numbers" alert', async ({ page }) => {
    // Validate that providing a single number warns the user to provide at least two numbers
    const app = new InsertionSortPage(page);
    await app.goto();

    await app.setInputValue('42');

    page.once('dialog', async (dialog) => {
      try {
        expect(dialog.message()).toBe('Please enter at least two numbers to sort.');
      } finally {
        await dialog.dismiss();
      }
    });

    await app.clickStart();

    // No sorting should happen and controls stay enabled
    expect(await app.isStartDisabled()).toBe(false);
    expect(await app.isInputDisabled()).toBe(false);
    expect(await app.getBarCount()).toBe(0);
  });

  test('Transition S1_Sorting -> S0_Idle can be observed: after sorting, updating input triggers InputValidation semantics', async ({ page }) => {
    // This test verifies the FSM transition that after sorting completes, controls are re-enabled,
    // and user input can be changed (simulating the InputValidation event in the FSM).
    const app = new InsertionSortPage(page);
    await app.goto();

    // Use small array to sort
    await app.setInputValue('2,1');

    // Start sorting
    await app.clickStart();

    // Wait for sorting to complete
    await app.waitForSortingToComplete(20000);

    // Now controls should be enabled (S0_Idle)
    expect(await app.isStartDisabled()).toBe(false);
    expect(await app.isInputDisabled()).toBe(false);

    // Simulate user changing the input (InputValidation event)
    await app.setInputValue('9,8,7');

    // After input change, application stays idle but the input value must reflect change
    const currentVal = await app.getInputValue();
    expect(currentVal).toBe('9,8,7');

    // And start button should still be enabled allowing user to initiate a new sort
    expect(await app.isStartDisabled()).toBe(false);

    // No automatic sorting happens on input change, so bars remain (or get cleared on next sort);
    // We simply assert that the application is ready for a new StartSorting event.
  });
});