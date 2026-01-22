import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b00d100-d5c3-11f0-b41f-b131cbd11f51.html';

class RadixPage {
  /**
   * Page object encapsulating selectors and common interactions for the Radix Sort visualization.
   */
  constructor(page) {
    this.page = page;
    this.generateBtn = page.locator('#generate-btn');
    this.sortBtn = page.locator('#sort-btn');
    this.resetBtn = page.locator('#reset-btn');
    this.sizeSlider = page.locator('#size-slider');
    this.speedSlider = page.locator('#speed-slider');
    this.sizeValue = page.locator('#size-value');
    this.speedValue = page.locator('#speed-value');
    this.arrayContainer = page.locator('#array-container');
    this.stepInfo = page.locator('#step-info');
    this.bucketsContainer = page.locator('#buckets-container');
    this.passes = page.locator('#passes');
    this.digitPlace = page.locator('#digit-place');
    this.arrayBars = page.locator('.array-bar');
    this.sortedBars = page.locator('.array-bar.sorted');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Click handlers
  async clickGenerate() {
    await this.generateBtn.click();
  }

  async clickSort() {
    await this.sortBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  // Set the size slider by dispatching an input event (range inputs require events to trigger handlers)
  async setSize(value) {
    await this.sizeSlider.evaluate((el, v) => {
      el.value = String(v);
      // Trigger input event to call updateSizeValue() in page script
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }

  // Set the speed slider similarly
  async setSpeed(value) {
    await this.speedSlider.evaluate((el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }

  // Get number of bars currently rendered
  async getBarsCount() {
    return await this.arrayBars.count();
  }

  // Return array of bar texts (numbers shown)
  async getBarValues() {
    const count = await this.getBarsCount();
    const values = [];
    for (let i = 0; i < count; i++) {
      values.push(await this.arrayBars.nth(i).textContent());
    }
    return values;
  }

  // Wait until all bars have .sorted class (final sorted state)
  async waitForAllBarsSorted(timeout = 20000) {
    const total = await this.getBarsCount();
    await this.page.waitForFunction(
      (sel, expected) => document.querySelectorAll(sel).length === expected,
      { timeout },
      '.array-bar.sorted',
      total
    );
    // Ensure count equals total
    await this.page.waitForFunction(
      (sel, expected) => document.querySelectorAll(sel).length === expected,
      { timeout },
      '.array-bar.sorted',
      total
    );
  }

  // Wait until step-info contains particular text
  async waitForStepInfoContains(text, timeout = 10000) {
    await this.page.waitForFunction(
      (selector, substr) => {
        const el = document.querySelector(selector);
        return el && el.textContent.includes(substr);
      },
      { timeout },
      '#step-info',
      text
    );
  }
}

test.describe('Radix Sort Visualization (App ID: 6b00d100-d5c3-11f0-b41f-b131cbd11f51)', () => {
  // Arrays to capture console errors and page errors for each test run
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages emitted by the page
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture unhandled page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test('Initial Idle State is rendered correctly (S0_Idle)', async ({ page }) => {
    // Validate initial render and Idle state expectations
    const rp = new RadixPage(page);
    await rp.goto();

    // Confirm the initial step-info prompt corresponds to Idle state entry
    await expect(rp.stepInfo).toContainText('Click "Start Radix Sort" to begin the visualization.');

    // Confirm controls exist and initial values are displayed
    await expect(rp.generateBtn).toBeVisible();
    await expect(rp.sortBtn).toBeVisible();
    await expect(rp.resetBtn).toBeVisible();
    await expect(rp.sizeValue).toHaveText(await rp.sizeSlider.evaluate(el => el.value));
    await expect(rp.speedValue).toHaveText(await rp.speedSlider.evaluate(el => el.value));

    // Ensure an initial array was generated on load and bars are present
    const initialCount = await rp.getBarsCount();
    const sliderVal = parseInt(await rp.sizeSlider.evaluate(el => el.value), 10);
    expect(initialCount).toBe(sliderVal);

    // Assert no console errors or page errors occurred during initial load
    expect(consoleErrors.length, `Console error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Generate New Array transitions Idle -> ArrayGenerated (S0_Idle -> S1_ArrayGenerated)', async ({ page }) => {
    // This test validates clicking Generate New Array produces the expected UI updates and state transition
    const rp = new RadixPage(page);
    await rp.goto();

    // Capture values before generating to detect change
    const beforeValues = await rp.getBarValues();

    await rp.clickGenerate();

    // After generating, step-info should indicate new array and buckets cleared
    await expect(rp.stepInfo).toContainText("New array generated. Click 'Start Radix Sort' to begin.");

    // There should be bars present and number equals size slider
    const count = await rp.getBarsCount();
    const size = parseInt(await rp.sizeSlider.evaluate(el => el.value), 10);
    expect(count).toBe(size);

    // It's possible the random array yields the same sequence; we at least assert the UI updated step-info and bucket container cleared
    await expect(rp.bucketsContainer).toBeEmpty();

    // Assert no runtime JS errors happened during generation
    expect(consoleErrors.length, `Console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Adjust Array Size triggers Update and regenerates array (S1_ArrayGenerated)', async ({ page }) => {
    // Validate that moving the size slider updates the displayed size value and regenerates the array with new length
    const rp = new RadixPage(page);
    await rp.goto();

    // Choose a new valid size within min/max
    const newSize = 8;
    await rp.setSize(newSize);

    // The displayed size value should reflect the change and array length updates
    await expect(rp.sizeValue).toHaveText(String(newSize));

    // Number of bars should equal the new size
    const barsCount = await rp.getBarsCount();
    expect(barsCount).toBe(newSize);

    // step-info should indicate new array generated
    await expect(rp.stepInfo).toContainText("New array generated.");

    // No console or page errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Adjust Speed updates UI (AdjustSpeed event)', async ({ page }) => {
    // Validate speed slider changes update the UI and underlying displayed speed value
    const rp = new RadixPage(page);
    await rp.goto();

    // Increase speed to fastest (max)
    const newSpeed = 10;
    await rp.setSpeed(newSpeed);

    // The displayed speed value should update
    await expect(rp.speedValue).toHaveText(String(newSpeed));

    // No console or page errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Start Radix Sort triggers Sorting (S1_ArrayGenerated -> S2_Sorting) and completes (S2_Sorting -> S3_Sorted)', async ({ page }) => {
    // This test validates the full sorting lifecycle:
    // - Start sorting
    // - Buttons disabled while sorting
    // - Progress / passes and digit-place update
    // - At completion, step-info indicates completion and all bars are highlighted as sorted

    const rp = new RadixPage(page);
    await rp.goto();

    // To speed up the animation for tests, make the array small and speed high
    await rp.setSize(5);    // fewer elements => fewer operations
    await rp.setSpeed(10);  // fastest animation setting (min animation sleep)

    // Ensure we have the expected number of bars
    const totalBars = await rp.getBarsCount();
    expect(totalBars).toBe(5);

    // Start sorting
    await rp.clickSort();

    // Immediately after click, the application should have disabled the control buttons
    await expect(rp.sortBtn).toBeDisabled();
    await expect(rp.generateBtn).toBeDisabled();
    await expect(rp.resetBtn).toBeDisabled();

    // During sorting, passes should move from 0 upwards; wait for passes >= 1
    await rp.page.waitForFunction(() => {
      const p = document.getElementById('passes');
      return p && Number(p.textContent) >= 1;
    }, null, { timeout: 10000 });

    // digit-place should reflect a numeric value (not '-')
    await expect(rp.digitPlace).not.toHaveText('-');

    // Buckets should have been rendered at some point during sorting (non-empty)
    // We cannot guarantee exact timing, so wait a little and check for existence of bucket elements
    await rp.page.waitForFunction(() => {
      const container = document.getElementById('buckets-container');
      return container && container.children.length > 0;
    }, null, { timeout: 10000 });

    // Wait for sorting to complete: the step-info should state sorting completed
    await rp.waitForStepInfoContains('Sorting completed! The array is now sorted.', 20000);

    // At completion, all bars should have 'sorted' class
    await rp.waitForAllBarsSorted(20000);

    // After completion, buttons should be enabled again
    await expect(rp.sortBtn).toBeEnabled();
    await expect(rp.generateBtn).toBeEnabled();
    await expect(rp.resetBtn).toBeEnabled();

    // Confirm final step-info
    await expect(rp.stepInfo).toContainText('Sorting completed! The array is now sorted.');

    // As an extra safety, ensure passes is at least 1 and is a number
    const passesText = await rp.passes.textContent();
    expect(Number(passesText)).toBeGreaterThanOrEqual(1);

    // No unhandled runtime errors occurred during sorting
    expect(consoleErrors.length, `Console errors during sorting: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors during sorting: ${JSON.stringify(pageErrors)}`).toBe(0);
  }, 30000); // allow larger timeout for full sorting lifecycle

  test('Reset while in ArrayGenerated re-generates array (S1_ArrayGenerated -> S1_ArrayGenerated)', async ({ page }) => {
    // Validate Reset recreates the array and updates step-info
    const rp = new RadixPage(page);
    await rp.goto();

    // Ensure we're in ArrayGenerated state initially by clicking generate
    await rp.clickGenerate();
    await expect(rp.stepInfo).toContainText("New array generated.");

    // Capture current bar values
    const before = await rp.getBarValues();

    // Click reset to generate a new array
    await rp.clickReset();

    // After reset, step-info should indicate new array generated
    await expect(rp.stepInfo).toContainText("New array generated.");

    // The number of bars should equal the size value
    const size = parseInt(await rp.sizeSlider.evaluate(el => el.value), 10);
    const barsCount = await rp.getBarsCount();
    expect(barsCount).toBe(size);

    // It's permissible for random generator to occasionally produce same sequence; we primarily assert UI updated.
    // No runtime errors should have happened during reset
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Attempting to generate while sorting has no effect (edge case)', async ({ page }) => {
    // Validate clicking the Generate button while sorting is in progress is prevented (buttons disabled)
    const rp = new RadixPage(page);
    await rp.goto();

    // Make array small and speed high to shorten sorting
    await rp.setSize(6);
    await rp.setSpeed(10);

    // Start sorting
    await rp.clickSort();

    // Ensure sorting started and buttons disabled
    await expect(rp.generateBtn).toBeDisabled();
    await expect(rp.sortBtn).toBeDisabled();

    // Attempt to click generate while disabled - Playwright will throw if we try to click a disabled element.
    // Instead, assert the element is disabled and cannot trigger a change. We can try to dispatch a click via evaluate,
    // but per instructions we MUST NOT inject globals or patch, so we will not attempt to force a click.
    // We assert the expected protective behavior: generate button is disabled and step-info does not change due to a user attempt.

    const beforeStep = await rp.stepInfo.textContent();

    // Try to perform .click() via Playwright - this will either be ignored or throw if disabled.
    let clickThrew = false;
    try {
      await rp.generateBtn.click({ timeout: 2000 });
    } catch (e) {
      clickThrew = true; // Playwright may reject clicking disabled element
    }

    const afterStep = await rp.stepInfo.textContent();

    // The step-info should not be replaced by a new "New array generated." message while sorting.
    // It may change due to sorting progress, so we ensure it does not become the explicit new-array message.
    expect(afterStep).not.toContain("New array generated.");

    // Ensure at least that generateBtn is disabled (defensive)
    await expect(rp.generateBtn).toBeDisabled();

    // Wait for sorting to finish so we don't leave background tasks
    await rp.waitForStepInfoContains('Sorting completed! The array is now sorted.', 20000);
    await rp.waitForAllBarsSorted(20000);

    // No unexpected runtime errors occurred
    expect(consoleErrors.length, `Console errors during disabled-click attempt: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors during disabled-click attempt: ${JSON.stringify(pageErrors)}`).toBe(0);
  }, 30000);

  test.afterEach(async ({ page }) => {
    // Final assertion to ensure no uncaught exceptions or console errors leaked through any test.
    // If any test intentionally allowed an error to occur, it should assert that explicitly within that test.
    // Here we assert the global listeners captured zero errors for the prepared interactions by default.
    expect(consoleErrors.length, `Console errors captured: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors captured: ${JSON.stringify(pageErrors)}`).toBe(0);
  });
});