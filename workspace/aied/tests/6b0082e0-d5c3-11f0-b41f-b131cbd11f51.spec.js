import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b0082e0-d5c3-11f0-b41f-b131cbd11f51.html';

// Page Object for the Selection Sort Visualization page
class SelectionSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'networkidle' });
  }

  get statusLocator() {
    return this.page.locator('#status');
  }

  get generateBtn() {
    return this.page.locator('#generateBtn');
  }

  get sortBtn() {
    return this.page.locator('#sortBtn');
  }

  get stepBtn() {
    return this.page.locator('#stepBtn');
  }

  get resetBtn() {
    return this.page.locator('#resetBtn');
  }

  get arrayContainer() {
    return this.page.locator('#arrayContainer');
  }

  async getStatusText() {
    return (await this.statusLocator.textContent())?.trim() ?? '';
  }

  async getArrayElements() {
    return this.page.locator('.array-element');
  }

  async getArrayValues() {
    const elems = this.page.locator('.array-element');
    const count = await elems.count();
    const values = [];
    for (let i = 0; i < count; i++) {
      values.push((await elems.nth(i).textContent())?.trim() ?? '');
    }
    return values;
  }

  async clickGenerate() {
    await this.generateBtn.click();
  }

  async clickSort() {
    await this.sortBtn.click();
  }

  async clickStep() {
    await this.stepBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async isButtonDisabled(locator) {
    return await locator.isDisabled();
  }

  async getElementClassName(index) {
    return await this.page.locator(`#element-${index}`).getAttribute('class');
  }
}

test.describe('Selection Sort Visualization - FSM validation (App ID: 6b0082e0-d5c3-11f0-b41f-b131cbd11f51)', () => {
  // Collect console errors and page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Capture uncaught page errors (exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push({
        message: err.message,
        stack: err.stack
      });
    });
  });

  test.afterEach(async () => {
    // After each test assert that there were no unexpected console errors or page errors.
    // These assertions help detect ReferenceError, SyntaxError, TypeError or other runtime issues.
    expect(consoleErrors, `Console errors occurred: ${JSON.stringify(consoleErrors)}`).toEqual([]);
    expect(pageErrors, `Page errors occurred: ${JSON.stringify(pageErrors)}`).toEqual([]);
  });

  test('S0_Idle: On initial load generateArray() called and initial state is Ready to begin', async ({ page }) => {
    // This test validates the S0_Idle initial state entry action (generateArray)
    // - generateArray() should run on initialization
    // - status should be "Status: Ready to begin"
    // - array elements should be present (10 elements created by implementation)
    // - step button should be enabled because resetSorting() (called by generateArray) enables it
    const app = new SelectionSortPage(page);

    // Navigate to the page (listeners were attached in beforeEach)
    await app.goto();

    // Verify status text matches Idle evidence
    const status = await app.getStatusText();
    expect(status).toBe('Status: Ready to begin');

    // Verify array elements were generated (expect 10 based on implementation)
    const elems = await app.getArrayElements();
    const count = await elems.count();
    expect(count).toBeGreaterThanOrEqual(1);
    // Implementation creates 10 elements - assert at least 10 to be robust
    expect(count).toBe(10);

    // Verify that step button has been enabled by resetSorting()
    const stepDisabled = await app.isButtonDisabled(app.stepBtn);
    expect(stepDisabled).toBe(false);

    // Check first element exists with expected id and non-empty text
    const firstText = (await app.getArrayValues())[0];
    expect(firstText).not.toBe('');

    // Ensure generateBtn exists and is enabled
    const genDisabled = await app.isButtonDisabled(app.generateBtn);
    expect(genDisabled).toBe(false);
  });

  test('GenerateArray event: clicking Generate New Array recreates the array and keeps state Ready to begin', async ({ page }) => {
    // This test validates the GenerateArray event and S0_Idle -> S0_Idle transition
    // - clicking #generateBtn should regenerate the array
    // - status should remain "Status: Ready to begin"
    const app = new SelectionSortPage(page);
    await app.goto();

    const beforeValues = await app.getArrayValues();

    // Click generate to create a new array
    await app.clickGenerate();

    // After generation, status should be Ready to begin
    const statusAfter = await app.getStatusText();
    expect(statusAfter).toBe('Status: Ready to begin');

    // Ensure array elements exist and count is consistent
    const afterValues = await app.getArrayValues();
    expect(afterValues.length).toBeGreaterThanOrEqual(1);
    expect(afterValues.length).toBe(10);

    // It's possible random values repeat; ensure the DOM updated (elements present and have numeric text)
    for (const val of afterValues) {
      // Each element should contain something that can be parsed to an integer
      expect(Number.isFinite(Number(val))).toBe(true);
    }

    // Ensure stepBtn remains enabled (resetSorting called by generateArray)
    expect(await app.isButtonDisabled(app.stepBtn)).toBe(false);
  });

  test('S1_Sorting via NextStep: stepping through sorting updates status and finally reaches Sorted state', async ({ page }) => {
    // This test validates the S1_Sorting state and NextStep transitions:
    // - Each click of #stepBtn should advance currentStep and update the status to "Status: Step X completed"
    // - After enough steps, the status should become "Status: Sorting complete!"
    // - All elements should have class containing "sorted" when complete
    const app = new SelectionSortPage(page);
    await app.goto();

    // Ensure we start from Ready to begin
    expect(await app.getStatusText()).toBe('Status: Ready to begin');

    const elems = await app.getArrayElements();
    const n = await elems.count();

    // Click Next Step repeatedly until we observe "Sorting complete!" or we reach safety limit
    let finalReached = false;
    const maxClicks = n + 2; // slightly more than length to ensure completion logic triggers
    for (let i = 0; i < maxClicks; i++) {
      await app.clickStep();
      // Small short wait to allow DOM updates (no animation delay for step clicks)
      await page.waitForTimeout(50);
      const status = await app.getStatusText();
      if (status === 'Status: Sorting complete!') {
        finalReached = true;
        break;
      }
      // If status is a Step message, ensure it matches the expected pattern
      const stepMatch = status.match(/^Status:\s*Step\s+(\d+)\s+completed$/);
      if (stepMatch) {
        const stepNum = Number(stepMatch[1]);
        expect(stepNum).toBeGreaterThan(0);
        expect(stepNum).toBeLessThanOrEqual(n);
      } else {
        // Unexpected status format (fail)
        throw new Error(`Unexpected status text after step: "${status}"`);
      }
    }

    expect(finalReached).toBe(true);

    // Verify all elements have 'sorted' class applied
    for (let i = 0; i < n; i++) {
      const className = await app.getElementClassName(i);
      // className might include multiple classes; ensure 'sorted' is present
      expect(className).toContain('sorted');
    }

    // Verify sort and step buttons are disabled at completion
    expect(await app.isButtonDisabled(app.sortBtn)).toBe(true);
    expect(await app.isButtonDisabled(app.stepBtn)).toBe(true);
  }, 20000); // extended timeout to be safe

  test('Transition Reset: while mid-sorting, Reset returns to Idle state and clears visual indicators', async ({ page }) => {
    // This test validates the Reset transition (S1_Sorting -> S0_Idle)
    // - Step a few times to simulate being mid-sort
    // - Click Reset to return to Ready to begin
    // - Visual classes should be reset to default 'array-element'
    const app = new SelectionSortPage(page);
    await app.goto();

    // Take a couple of manual steps
    await app.clickStep();
    await page.waitForTimeout(20);
    await app.clickStep();
    await page.waitForTimeout(20);

    // Sanity check: status should be Step 1+ etc.
    const statusMid = await app.getStatusText();
    expect(statusMid).toMatch(/^Status:\s*(Step\s+\d+\s+completed|Sorting complete!)$/);

    // Click Reset
    await app.clickReset();

    // After reset, status should be Ready to begin
    expect(await app.getStatusText()).toBe('Status: Ready to begin');

    // All elements should have their class reset to exactly 'array-element'
    const elems = await app.getArrayElements();
    const count = await elems.count();
    for (let i = 0; i < count; i++) {
      const cls = await app.getElementClassName(i);
      expect(cls).toBe('array-element');
    }

    // Buttons should be enabled after reset (sort and step enabled per resetSorting)
    expect(await app.isButtonDisabled(app.sortBtn)).toBe(false);
    expect(await app.isButtonDisabled(app.stepBtn)).toBe(false);
  });

  test('StartSorting event: clicking Start Sorting begins automatic sorting and completes', async ({ page }) => {
    // This test validates the StartSorting event and S0_Idle -> S1_Sorting entry action:
    // - Clicking #sortBtn disables interaction buttons and starts automatic sort
    // - When automatic sorting finishes, status becomes "Status: Sorting complete!"
    // Note: Implementation uses a 500ms interval; allow sufficient timeout for completion.
    const app = new SelectionSortPage(page);
    await app.goto();

    // Ensure step button is enabled initially
    expect(await app.isButtonDisabled(app.stepBtn)).toBe(false);

    // Click Start Sorting to trigger automatic sorting
    await app.clickSort();

    // Immediately after clicking, the sortBtn and stepBtn should be disabled by startSorting()
    expect(await app.isButtonDisabled(app.sortBtn)).toBe(true);
    // stepBtn is also disabled during auto-sort
    expect(await app.isButtonDisabled(app.stepBtn)).toBe(true);

    // Wait for sorting to complete. For 10 elements at 500ms per step we expect within ~6s.
    // Poll status until it becomes 'Sorting complete!' or timeout
    const deadline = Date.now() + 10000; // 10 seconds deadline
    let finalStatus = '';
    while (Date.now() < deadline) {
      finalStatus = await app.getStatusText();
      if (finalStatus === 'Status: Sorting complete!') break;
      await page.waitForTimeout(200);
    }
    expect(finalStatus).toBe('Status: Sorting complete!');

    // After completion, all elements should be marked sorted
    const elems = await app.getArrayElements();
    const count = await elems.count();
    for (let i = 0; i < count; i++) {
      const cls = await app.getElementClassName(i);
      expect(cls).toContain('sorted');
    }

    // Buttons should be disabled at completion per selectionSortStep()
    expect(await app.isButtonDisabled(app.sortBtn)).toBe(true);
    expect(await app.isButtonDisabled(app.stepBtn)).toBe(true);
  }, 20000);

  test('Edge case: clicking Next Step after sorting complete keeps state stable and does not throw', async ({ page }) => {
    // This test ensures clicking Next Step when already sorted does not throw and keeps status as Sorting complete!
    const app = new SelectionSortPage(page);
    await app.goto();

    // Complete the sort manually by clicking Next Step N times
    const elems = await app.getArrayElements();
    const n = await elems.count();
    for (let i = 0; i < n + 1; i++) {
      // clicking extra times should not throw
      await app.clickStep();
      await page.waitForTimeout(20);
    }

    // Final status must be Sorting complete!
    expect(await app.getStatusText()).toBe('Status: Sorting complete!');

    // Click Next Step again as an edge operation
    await app.clickStep();
    await page.waitForTimeout(20);

    // Status should remain the same and no errors should have been emitted (checked in afterEach)
    expect(await app.getStatusText()).toBe('Status: Sorting complete!');
  });

  test('Verify evidence of onEnter actions: startSorting changes isSorting and disables buttons', async ({ page }) => {
    // This test uses page.evaluate to read internal variables (if accessible) to verify entry actions.
    // It checks that startSorting sets isSorting = true and disables UI controls.
    // Note: We do not alter functions or patch code; we only read state when possible.
    const app = new SelectionSortPage(page);
    await app.goto();

    // Before starting, isSorting should be false (as per implementation)
    const isSortingBefore = await page.evaluate(() => {
      return typeof isSorting !== 'undefined' ? isSorting : null;
    });
    // If variable exists, expect false; if not exposed, we accept null but ensure UI is Ready
    if (isSortingBefore !== null) {
      expect(isSortingBefore).toBe(false);
    }
    expect(await app.getStatusText()).toBe('Status: Ready to begin');

    // Trigger startSorting
    await app.clickSort();

    // Check that isSorting became true (if accessible)
    const isSortingAfter = await page.evaluate(() => {
      return typeof isSorting !== 'undefined' ? isSorting : null;
    });
    if (isSortingAfter !== null) {
      expect(isSortingAfter).toBe(true);
    }

    // Verify UI changes expected by entry action: buttons disabled
    expect(await app.isButtonDisabled(app.sortBtn)).toBe(true);
    expect(await app.isButtonDisabled(app.stepBtn)).toBe(true);

    // Reset back to idle to not interfere with subsequent tests
    await app.clickReset();
    expect(await app.getStatusText()).toBe('Status: Ready to begin');
  });
});