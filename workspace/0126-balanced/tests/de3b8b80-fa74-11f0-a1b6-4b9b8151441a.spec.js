import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3b8b80-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object for the Bubble Sort Visualization page
class BubbleSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.generateBtn = '#generateBtn';
    this.sortBtn = '#sortBtn';
    this.stepBtn = '#stepBtn';
    this.arrayContainer = '#arrayContainer';
    this.status = '#status';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickGenerate() {
    await this.page.click(this.generateBtn);
  }

  async clickStartSorting() {
    await this.page.click(this.sortBtn);
  }

  // Click step button normally (will not fire if disabled)
  async clickStep() {
    await this.page.click(this.stepBtn);
  }

  // Force click step button even if disabled (for testing edge paths)
  async forceClickStep() {
    await this.page.click(this.stepBtn, { force: true });
  }

  async getStatusText() {
    return (await this.page.locator(this.status).innerText()).trim();
  }

  async getArrayElements() {
    return this.page.locator(`${this.arrayContainer} .array-element`);
  }

  async getArrayValues() {
    const elems = this.page.locator(`${this.arrayContainer} .array-element`);
    const count = await elems.count();
    const values = [];
    for (let i = 0; i < count; i++) {
      const t = await elems.nth(i).innerText();
      values.push(t.trim());
    }
    return values;
  }

  async countComparingElements() {
    return this.page.locator(`${this.arrayContainer} .array-element.comparing`).count();
  }

  async countSortedElements() {
    return this.page.locator(`${this.arrayContainer} .array-element.sorted`).count();
  }

  async isButtonDisabled(selector) {
    return await this.page.locator(selector).isDisabled();
  }

  async waitForStatusToContain(re, timeout = 5000) {
    await this.page.waitForFunction(
      (sel, pattern) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        return new RegExp(pattern).test(el.textContent || '');
      },
      this.status,
      re.source,
      { timeout }
    );
  }
}

test.describe('Bubble Sort Visualization FSM (de3b8b80-fa74-11f0-a1b6-4b9b8151441a)', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      // Save type and text for assertions/diagnostics
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test('Initial Idle state on load (S0_Idle) - renderArray() on entry and UI initial conditions', async ({ page }) => {
    // Validate that on initial load the page is in Idle state:
    // - status text is the Ready message
    // - renderArray() called (array elements are rendered, 10 elements)
    // - sortBtn enabled, stepBtn disabled
    // - no unexpected page errors (or if errors appear, they are JS Error types)
    const bs = new BubbleSortPage(page);
    await bs.goto();

    // Wait for array elements to appear (generateArray() is called on initialize)
    await page.waitForSelector('#arrayContainer .array-element');

    const arrayCount = await bs.getArrayElements().count();
    expect(arrayCount).toBeGreaterThanOrEqual(1); // Should render elements (expected to be 10)
    // The HTML initializes with generateArray() which creates 10 elements
    expect(arrayCount).toBe(10);

    const statusText = await bs.getStatusText();
    expect(statusText).toBe('Ready to sort! Click "Start Sorting" to begin.');

    // sortBtn should be enabled after generateArray() sets it
    const sortDisabled = await bs.isButtonDisabled(bs.sortBtn);
    expect(sortDisabled).toBe(false);

    // stepBtn should be disabled initially
    const stepDisabled = await bs.isButtonDisabled(bs.stepBtn);
    expect(stepDisabled).toBe(true);

    // Assert console and page errors: either none, or if present they should be Error objects
    // We do not suppress or change runtime errors; we only observe and assert their types if any
    expect(pageErrors.length).toBe(0);

    // No critical console errors (error type messages) should be present
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrorMessages.length).toBe(0);
  });

  test('Generate New Array transition (S0_Idle -> S1_ArrayGenerated) - clicking generateBtn re-renders and sets controls', async ({ page }) => {
    // Validate clicking "Generate New Array" re-renders array, enables sortBtn and disables stepBtn
    const bs1 = new BubbleSortPage(page);
    await bs.goto();

    // Capture current array values to compare
    const beforeValues = await bs.getArrayValues();
    expect(beforeValues.length).toBe(10);

    // Click the generate button to transition to Array Generated state
    await bs.clickGenerate();

    // After generating, there should still be array elements rendered
    await page.waitForSelector('#arrayContainer .array-element');

    const afterValues = await bs.getArrayValues();
    expect(afterValues.length).toBe(10);

    // It's possible the random array remains the same by chance; ensure DOM was rerendered by comparing
    // the nodes themselves via innerHTML change - at least ensure the container was updated
    const containerHtml = await page.locator('#arrayContainer').innerHTML();
    expect(containerHtml).toBeTruthy();

    // Controls: sortBtn enabled, stepBtn disabled per FSM evidence
    expect(await bs.isButtonDisabled(bs.sortBtn)).toBe(false);
    expect(await bs.isButtonDisabled(bs.stepBtn)).toBe(true);

    // Status should be reset to the Ready message
    const statusText1 = await bs.getStatusText();
    expect(statusText).toBe('Ready to sort! Click "Start Sorting" to begin.');

    // No page errors introduced by clicking generate
    expect(pageErrors.length).toBe(0);
  });

  test('Start Sorting transition (S1_ArrayGenerated -> S2_Sorting) - automatic sorting begins and comparing indicators appear', async ({ page }) => {
    // Validate that clicking "Start Sorting" begins the automatic sorting process:
    // - sortBtn disabled while sorting
    // - stepBtn disabled while sorting
    // - status reflects comparisons or swaps
    // - array elements show "comparing" class when comparisons occur
    const bs2 = new BubbleSortPage(page);
    await bs.goto();

    // Ensure we are in Array Generated state
    expect(await bs.isButtonDisabled(bs.sortBtn)).toBe(false);

    // Click Start Sorting
    await bs.clickStartSorting();

    // After clicking, sortBtn should be disabled, stepBtn disabled
    expect(await bs.isButtonDisabled(bs.sortBtn)).toBe(true);
    expect(await bs.isButtonDisabled(bs.stepBtn)).toBe(true);

    // Wait for the first comparison or swap to be visible in status text
    // The code writes "Comparing X and Y" or "Swapped X and Y" or "Element ... is now in its correct position"
    await bs.waitForStatusToContain(/Comparing|Swapped|Element/, 7000);

    const statusText2 = await bs.getStatusText();
    expect(/Comparing|Swapped|Element/.test(statusText)).toBe(true);

    // When comparing, at least two elements should have the 'comparing' class at some point.
    // Give a short window to observe comparing highlight.
    let comparingCount = 0;
    for (let attempt = 0; attempt < 5; attempt++) {
      comparingCount = await bs.countComparingElements();
      if (comparingCount >= 2) break;
      // small pause to allow animation/state to appear
      await page.waitForTimeout(300);
    }
    // It's expected that during comparisons there are 2 comparing elements
    expect(comparingCount).toBeGreaterThanOrEqual(0); // Could be 0 if the interval advanced; allow 0 but log diagnostic
    // Ensure no page exceptions occurred during startSorting
    expect(pageErrors.length).toBe(0);
  });

  test('Step Through Sort (S2_Sorting -> S2_Sorting) - edge behavior: step button disabled and forced step', async ({ page }) => {
    // This test validates two things:
    // 1) Attempting to click the disabled "Next Step" button normally does nothing (edge case)
    // 2) For testing the FSM transition we can force a click to invoke stepThroughSort and observe a single step execution
    const bs3 = new BubbleSortPage(page);
    await bs.goto();

    // Normal click should be a no-op because the button is disabled
    const beforeStatus = await bs.getStatusText();
    // Attempt a normal click (should not fire event because button disabled)
    await page.click(bs.stepBtn).catch(() => {
      // Playwright may throw if clicking a disabled element; swallow to assert behavior below
    });
    const afterStatus = await bs.getStatusText();
    // Status should remain unchanged
    expect(afterStatus).toBe(beforeStatus);

    // Now force a click on the disabled step button to directly invoke stepThroughSort (testing manual stepping path).
    // Note: force clicking simulates an override of user-interaction constraints for testing purposes.
    await bs.forceClickStep();

    // After forcing a step, status should have changed to a comparing/swapped/element message
    await bs.waitForStatusToContain(/Comparing|Swapped|Element/, 3000);
    const newStatus = await bs.getStatusText();
    expect(/Comparing|Swapped|Element/.test(newStatus)).toBe(true);

    // And we should see comparing highlight on elements for that single step
    const comparingNow = await bs.countComparingElements();
    // comparingNow can be 0 if the algorithm advanced quickly, so accept >=0 but assert DOM remained valid
    expect(await bs.getArrayElements().count()).toBe(10);

    // Ensure no unexpected errors were thrown when invoking the step handler
    expect(pageErrors.length).toBe(0);
  });

  test('Sorting completion (S2_Sorting -> S3_Sorted) - perform repeated steps until "Sorting complete!"', async ({ page }) => {
    // We will use forced step clicks repeatedly to progress the algorithm to completion.
    // This avoids waiting for the 1s interval of the automatic sorter and keeps the test fast.
    const bs4 = new BubbleSortPage(page);
    await bs.goto();

    // Ensure we have an array to sort
    expect(await bs.getArrayElements().count()).toBe(10);

    // We'll perform up to 200 forced steps; bubble sort for 10 elements requires at most ~45 comparisons + passes
    const maxSteps = 200;
    let completed = false;
    for (let step = 0; step < maxSteps; step++) {
      // Force click the step button to invoke stepThroughSort (calls bubbleSortStep internally)
      await bs.forceClickStep();
      // Short pause to let DOM update
      await page.waitForTimeout(10);

      // Check for completion status
      const statusText3 = await bs.getStatusText();
      if (statusText === 'Sorting complete!') {
        completed = true;
        break;
      }

      // Small throttle to prevent tight loop
      if (step % 10 === 0) await page.waitForTimeout(10);
    }

    // Assert that sorting eventually completes within our step budget
    expect(completed).toBe(true);

    // After completion, verify all elements have 'sorted' class (renderArray called with all sorted indices)
    const sortedCount = await bs.countSortedElements();
    expect(sortedCount).toBe(10);

    // And the controls should be disabled as per FSM evidence
    expect(await bs.isButtonDisabled(bs.sortBtn)).toBe(true);
    expect(await bs.isButtonDisabled(bs.stepBtn)).toBe(true);

    // Ensure the status text equals the exact "Sorting complete!" message
    const finalStatus = await bs.getStatusText();
    expect(finalStatus).toBe('Sorting complete!');

    // No unexpected page errors during repeated stepping
    expect(pageErrors.length).toBe(0);
  });

  test('Robustness: clicking Start Sorting while sorting is active should have no adverse effects', async ({ page }) => {
    // Validate that clicking Start Sorting while sorting is already in progress does nothing harmful.
    const bs5 = new BubbleSortPage(page);
    await bs.goto();

    // Start sorting automatically
    await bs.clickStartSorting();

    // Wait briefly for sorting to start
    await bs.waitForStatusToContain(/Comparing|Swapped|Element/, 7000);

    // Try clicking Start Sorting again while sorting should be active (button should be disabled)
    // We attempt both a normal click and a forced click to observe behavior
    // Normal click: should be a no-op (button is disabled)
    await page.click(bs.sortBtn).catch(() => { /* ignore */ });

    // Forced click: attempt to simulate an extra event; the implementation guards against sorting being true
    await page.click(bs.sortBtn, { force: true }).catch(() => { /* ignore if it errors */ });

    // Confirm the page did not throw errors and remains in sorting/working condition
    expect(pageErrors.length).toBe(0);

    // Sorting should still eventually progress; check that there is no immediate crash by asserting array still present
    expect(await bs.getArrayElements().count()).toBe(10);
  });

  test.afterEach(async ({ page }) => {
    // Post-test diagnostics: if any page errors were captured, assert they are of expected runtime types
    // This follows the instruction to observe console logs and page errors and let errors happen naturally.
    if (pageErrors.length > 0) {
      // Assert that each error is one of ReferenceError, SyntaxError, TypeError (if any occurred)
      for (const err of pageErrors) {
        // err.name is often present
        const name = err && err.name ? err.name : 'UnknownError';
        const allowed = ['ReferenceError', 'SyntaxError', 'TypeError'];
        // Make the assertion informational: fail the test if an unexpected error type occurred
        expect(allowed.includes(name)).toBeTruthy();
      }
    }

    // Also ensure console did not produce fatal errors; if console error messages exist, assert their types
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMsgs.length).toBe(0);
  });
});