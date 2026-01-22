import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b39e51-d5c2-11f0-9651-0f1ae31ac260.html';

// Page Object for the Heap Sort page
class HeapSortPage {
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#arrayInput');
    this.sortButton = page.locator('#sortButton');
    this.speedRange = page.locator('#speedRange');
    this.speedValue = page.locator('#speedValue');
    this.arrayBars = page.locator('.array-bar');
    this.arrayContainer = page.locator('#arrayContainer');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getArrayInputValue() {
    return (await this.arrayInput.inputValue()).trim();
  }

  async setArrayInput(value) {
    await this.arrayInput.fill(value);
  }

  async clickStart() {
    await this.sortButton.click();
  }

  async setSpeed(value) {
    // Use the native user interaction which honors disabled state
    await this.speedRange.fill(String(value));
    // Trigger input event in case fill didn't do it (keeps within allowed interactions)
    await this.page.evaluate((v) => {
      const el = document.getElementById('speedRange');
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }

  async getSpeedValueText() {
    return (await this.speedValue.textContent()).trim();
  }

  async getArrayBarTexts() {
    return await this.arrayBars.allTextContents();
  }

  async getArrayBarsCount() {
    return await this.arrayBars.count();
  }

  async isControlDisabled(locator) {
    return await locator.isDisabled();
  }

  // Wait until sorting completes by observing the sortButton being re-enabled.
  async waitForSortingComplete(timeout = 120000) {
    await expect(this.sortButton).toBeEnabled({ timeout });
  }

  // Wait until sortButton becomes disabled (entered Sorting state)
  async waitForSortingStart(timeout = 5000) {
    await expect(this.sortButton).toBeDisabled({ timeout });
  }

  async areAllBarsSortedClass() {
    const count = await this.getArrayBarsCount();
    for (let i = 0; i < count; i++) {
      const hasSorted = await this.page.locator('.array-bar').nth(i).evaluate((el) => el.classList.contains('sorted'));
      if (!hasSorted) return false;
    }
    return true;
  }
}

test.describe('Heap Sort Visualization - FSM and UI tests', () => {
  // We will capture console errors and page errors to observe runtime issues.
  test.beforeEach(async ({ page }) => {
    // No-op; each test will create its own HeapSortPage and goto the URL.
  });

  test('Initial Idle state: sample array is rendered on load', async ({ page }) => {
    // This test validates the S0_Idle state: initial array should be present and rendered.
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    const heap = new HeapSortPage(page);
    await heap.goto();

    // Verify initial textarea value contains the expected sample array string from the implementation.
    const inputValue = await heap.getArrayInputValue();
    expect(inputValue).toContain('12');
    expect(inputValue).toContain('78');

    // The initial sample array '12, 4, 56, 23, 78, 1, 9' should result in 7 bars.
    const barCount = await heap.getArrayBarsCount();
    expect(barCount).toBe(7);

    // The first bar text should be '12' (reflecting the first element)
    const barTexts = await heap.getArrayBarTexts();
    expect(barTexts[0]).toBe('12');

    // Assert there were no runtime page errors or console errors on initial load.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: empty input triggers alert and does not start sorting', async ({ page }) => {
    // This test validates the guard clauses before transition S0_Idle -> S1_Sorting:
    // when user provides no input, an alert should appear and sorting should not start.
    const heap = new HeapSortPage(page);
    await heap.goto();

    // Clear the input to simulate empty input
    await heap.setArrayInput('');

    // Capture the dialog message
    let dialogMessage = null;
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Click sort and expect an alert about invalid array
    await heap.clickStart();

    // Wait a short time to ensure dialog was triggered
    await page.waitForTimeout(200);

    expect(dialogMessage).toBe('Please enter a valid array of numbers.');

    // After dismissal, controls should remain enabled (sorting did not start)
    expect(await heap.isControlDisabled(heap.sortButton)).toBe(false);
    expect(await heap.isControlDisabled(heap.arrayInput)).toBe(false);
    expect(await heap.isControlDisabled(heap.speedRange)).toBe(false);
  });

  test('Edge case: too many elements triggers alert and prevents sorting', async ({ page }) => {
    // This test validates the "arr.length > 50" guard before starting S1_Sorting.
    const heap = new HeapSortPage(page);
    await heap.goto();

    // Create 51 numbers
    const largeArray = Array.from({ length: 51 }, (_, i) => i + 1).join(', ');
    await heap.setArrayInput(largeArray);

    let dialogMessage = null;
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await heap.clickStart();
    await page.waitForTimeout(200);

    expect(dialogMessage).toBe('Please enter no more than 50 numbers for clear visualization.');

    // Sorting should not have started
    expect(await heap.isControlDisabled(heap.sortButton)).toBe(false);
    expect(await heap.isControlDisabled(heap.arrayInput)).toBe(false);
    expect(await heap.isControlDisabled(heap.speedRange)).toBe(false);
  });

  test('StartHeapSort event: clicking Start triggers Sorting state and completes to Completed state', async ({ page }) => {
    // This test covers S0_Idle -> S1_Sorting transition on StartHeapSort
    // and the S1_Sorting -> S2_Completed transition when sorting finishes.
    // It also verifies entry/exit actions: controls disabled during sorting and re-enabled after completion,
    // and that the final DOM shows all bars as sorted and in ascending order.

    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    const heap = new HeapSortPage(page);
    await heap.goto();

    // Speed up the animation to make test run faster
    // Use the control before sorting to update speed
    await heap.setSpeed(50);
    expect(await heap.getSpeedValueText()).toBe('50');

    // Read the original array from the input to compute expected sorted order
    const inputValue = await heap.getArrayInputValue();
    const parsed = inputValue
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter(n => !isNaN(n));
    expect(parsed.length).toBeGreaterThan(0);

    // Start sorting
    const start = Date.now();
    const clickPromise = heap.clickStart();

    // Wait for sorting to start: controls should become disabled
    await heap.waitForSortingStart(5000);
    expect(await heap.isControlDisabled(heap.arrayInput)).toBe(true);
    expect(await heap.isControlDisabled(heap.sortButton)).toBe(true);
    expect(await heap.isControlDisabled(heap.speedRange)).toBe(true);

    // Wait for sorting to finish: sortButton re-enabled indicates exit of S1_Sorting
    await heap.waitForSortingComplete(120000);
    const durationMs = Date.now() - start;

    // After completion, controls should be re-enabled (exit action disableControls(false))
    expect(await heap.isControlDisabled(heap.arrayInput)).toBe(false);
    expect(await heap.isControlDisabled(heap.sortButton)).toBe(false);
    expect(await heap.isControlDisabled(heap.speedRange)).toBe(false);

    // Validate final state: all bars should be present and have 'sorted' class
    const finalBarCount = await heap.getArrayBarsCount();
    expect(finalBarCount).toBe(parsed.length);

    // DOM texts should match sorted ascending order
    const finalTexts = (await heap.getArrayBarTexts()).map(t => Number(t));
    const expectedSorted = [...parsed].sort((a,b) => a - b);
    expect(finalTexts).toEqual(expectedSorted);

    // Confirm all bars have the 'sorted' class
    const allSorted = await heap.areAllBarsSortedClass();
    expect(allSorted).toBe(true);

    // Assert no runtime console or page errors occurred during the run
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Basic sanity: sorting completed within reasonable time (upper bound)
    expect(durationMs).toBeLessThan(120000);
  }, 180000); // extended timeout for sorting test

  test('AdjustSpeed event: changing speed updates UI; cannot change via UI while sorting (controls disabled)', async ({ page }) => {
    // This test covers the AdjustSpeed event and the behavior of the speed control before/during sorting.
    const heap = new HeapSortPage(page);
    await heap.goto();

    // Change speed before sorting: should update #speedValue text
    await heap.setSpeed(500);
    expect(await heap.getSpeedValueText()).toBe('500');

    // Start sorting using a small array to make it quick
    await heap.setArrayInput('5, 3, 8');
    // Speed at 500ms will make the animation visible but still fast enough
    await heap.setSpeed(50);
    expect(await heap.getSpeedValueText()).toBe('50');

    // Start sorting and wait for it to begin
    await heap.clickStart();
    await heap.waitForSortingStart(5000);

    // While sorting, the speedRange should be disabled and thus not interactable by user
    expect(await heap.isControlDisabled(heap.speedRange)).toBe(true);

    // Attempting to set speed via UI actions should not be possible as it's disabled; simulate a human attempt:
    // Use page.keyboard/tab/arrow keys is not meaningful for disabled element. We assert the disabled state.
    // Now wait for sorting to complete and ensure the speed control re-enables.
    await heap.waitForSortingComplete(120000);
    expect(await heap.isControlDisabled(heap.speedRange)).toBe(false);

    // After completion, changing speed again updates the display
    await heap.setSpeed(300);
    expect(await heap.getSpeedValueText()).toBe('300');
  });

  test('Observes console and page errors across interactions (should be none)', async ({ page }) => {
    // This test explicitly listens to console and page errors while performing common interactions,
    // and asserts that no ReferenceError / TypeError / SyntaxError occurred.
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const heap = new HeapSortPage(page);
    await heap.goto();

    // Perform a sequence of interactions: change speed, start sort, wait complete
    await heap.setSpeed(50);
    await heap.clickStart();
    await heap.waitForSortingStart(5000);
    await heap.waitForSortingComplete(120000);

    // No errors expected
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  }, 180000);
});