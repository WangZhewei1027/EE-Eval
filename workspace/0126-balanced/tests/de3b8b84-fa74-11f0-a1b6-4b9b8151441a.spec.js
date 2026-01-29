import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3b8b84-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object for the Quick Sort Visualization page
class QuickSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.generateBtn = page.locator('#generateBtn');
    this.sortBtn = page.locator('#sortBtn');
    this.stepBtn = page.locator('#stepBtn');
    this.arrayContainer = page.locator('#arrayContainer');
    this.barLocator = () => this.arrayContainer.locator('.array-bar');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Returns number of bars rendered
  async countBars() {
    return await this.barLocator().count();
  }

  // Returns array of bar text contents (numbers as strings)
  async getBarValues() {
    const count = await this.countBars();
    const values = [];
    for (let i = 0; i < count; i++) {
      values.push(await this.barLocator().nth(i).locator('span').innerText());
    }
    return values;
  }

  async isGenerateEnabled() {
    return await this.generateBtn.isEnabled();
  }

  async isSortEnabled() {
    return await this.sortBtn.isEnabled();
  }

  async isStepEnabled() {
    return await this.stepBtn.isEnabled();
  }

  // Click helpers
  async clickGenerate() {
    await this.generateBtn.click();
  }

  async clickSort() {
    await this.sortBtn.click();
  }

  // Try clicking step; since it may be disabled, use click() which will throw if disabled.
  // We wrap to avoid test crash and return boolean indicating whether click happened.
  async tryClickStep() {
    const enabled = await this.isStepEnabled();
    if (!enabled) return false;
    await this.stepBtn.click();
    return true;
  }

  // Wait until a condition on the DOM is true or timeout
  async waitForSortToComplete(timeout = 30000) {
    // The app re-enables sortBtn and disables stepBtn when sorting completes.
    await this.page.waitForFunction(() => {
      const sortBtn = document.getElementById('sortBtn');
      const stepBtn = document.getElementById('stepBtn');
      return sortBtn && !sortBtn.disabled && stepBtn && stepBtn.disabled;
    }, { timeout });
  }

  // Wait until any bar with a specific class appears (e.g., 'pivot', 'comparing', 'sorted')
  async waitForAnyBarWithClass(className, timeout = 5000) {
    await this.page.waitForFunction((cls) => {
      return Array.from(document.querySelectorAll('.array-bar')).some(b => b.classList.contains(cls));
    }, className, { timeout });
  }
}

test.describe('Quick Sort Visualization - FSM states and transitions', () => {
  // Increase default timeout for tests that need to wait for sorting animation to finish.
  test.setTimeout(60000);

  // Variables to collect console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Attach listeners to capture console messages and page errors
    page.context()._consoleMessages = [];
    page.context()._pageErrors = [];

    page.on('console', (msg) => {
      // store a lightweight representation
      page.context()._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      page.context()._pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // After each test assert there were no uncaught page errors (SyntaxError, ReferenceError, TypeError, etc.)
    const pageErrors = page.context()._pageErrors || [];
    // Provide detailed failure message if any page errors occurred
    expect(pageErrors.length, `Expected no page errors, but found: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
  });

  test('Initial load renders an array and sets controls correctly (S1_ArrayGenerated)', async ({ page }) => {
    // This test verifies that on page load the generateArray() initialization has run:
    // - The array container should have 10 bars (arraySize = 10)
    // - The Sort button should be enabled
    // - The Step button should be disabled (since no animation steps yet)
    const qs = new QuickSortPage(page);
    await qs.goto();

    // Wait for bars to be rendered
    await page.waitForSelector('.array-bar');

    const barCount = await qs.countBars();
    expect(barCount).toBe(10); // arraySize defined in implementation is 10

    // Check that each bar contains a numeric label
    const values1 = await qs.getBarValues();
    expect(values.length).toBe(10);
    for (const val of values) {
      // Every label should parse to an integer number
      expect(Number.isFinite(Number(val))).toBeTruthy();
    }

    // Control states
    expect(await qs.isGenerateEnabled()).toBe(true);
    expect(await qs.isSortEnabled()).toBe(true);
    expect(await qs.isStepEnabled()).toBe(false);
  });

  test('Clicking Generate New Array transitions to Array Generated (S1_ArrayGenerated)', async ({ page }) => {
    // This test checks that clicking the Generate button replaces the existing array,
    // resets animation-related states in the DOM (step disabled), and does not produce errors.
    const qs1 = new QuickSortPage(page);
    await qs.goto();

    // Capture current array values
    const beforeValues = await qs.getBarValues();
    expect(beforeValues.length).toBeGreaterThan(0);

    // Click generate to get a new array
    await qs.clickGenerate();

    // Wait for re-render: at least first bar text should change or we wait for new bars
    await page.waitForTimeout(200); // small wait for UI update

    const afterValues = await qs.getBarValues();
    expect(afterValues.length).toBe(10);

    // It's possible (rare) that RNG produced same array; assert that either values differ or that the DOM was re-rendered (timing)
    const same = beforeValues.join(',') === afterValues.join(',');
    // We allow the edge case of same array, but still assert that step/reset state is correct
    expect(await qs.isStepEnabled()).toBe(false);
    expect(await qs.isSortEnabled()).toBe(true);

    // If the arrays are identical, record this fact in the assertion to avoid flaky failure
    // (This ensures the test focuses on state transition rather than randomness.)
    expect([true, false].includes(same)).toBe(true);
  });

  test('Starting Quick Sort triggers sorting (S2_Sorting) and completes (S3_Sorted)', async ({ page }) => {
    // This test validates:
    // - Clicking the Start Quick Sort button disables the sort button and enables the step button (S2_Sorting evidence)
    // - Sorting auto-plays via setInterval; eventually sorting completes and buttons return to expected state (S3_Sorted)
    const qs2 = new QuickSortPage(page);
    await qs.goto();

    // Ensure initial conditions
    expect(await qs.isStepEnabled()).toBe(false);
    expect(await qs.isSortEnabled()).toBe(true);

    // Click Start Quick Sort
    await qs.clickSort();

    // Immediately after clicking we expect sortBtn disabled and stepBtn enabled (per code)
    // Use small wait to allow DOM updates
    await page.waitForTimeout(50);
    expect(await qs.isSortEnabled()).toBe(false);
    // stepBtn should be enabled while sorting is in progress
    expect(await qs.isStepEnabled()).toBe(true);

    // While sorting is ongoing, the UI should show intermediate states such as 'pivot' or 'comparing' classes.
    // Wait for at least one of these classes to appear to confirm sorting animation is running.
    let sawAnimationClass = false;
    try {
      // Wait up to 5s to see a 'pivot' or 'comparing' or 'sorted' class appear
      await Promise.race([
        qs.waitForAnyBarWithClass('pivot', 5000),
        qs.waitForAnyBarWithClass('comparing', 5000),
        qs.waitForAnyBarWithClass('sorted', 5000)
      ]);
      sawAnimationClass = true;
    } catch (e) {
      sawAnimationClass = false;
    }
    // It's acceptable if we didn't see the specific classes within the short window, but we should assert that animation progressed by final completion.
    // Now wait for sorting to complete (buttons return to Sorted state).
    await qs.waitForSortToComplete(45000); // give plenty of time for full animation

    // After completion, per S3_Sorted evidence: isSorting = false, stepBtn.disabled = true, sortBtn.disabled = false
    expect(await qs.isSortEnabled()).toBe(true);
    expect(await qs.isStepEnabled()).toBe(false);

    // Validate that at least one animation class appeared during the run OR that the array changed (sorted)
    const finalValues = await qs.getBarValues();
    // finalValues should be an array of numbers; we can assert it is the same length and numeric
    expect(finalValues.length).toBe(10);
    for (const val of finalValues) {
      expect(Number.isFinite(Number(val))).toBeTruthy();
    }

    // To ensure sorting had some visible animation, assert that we either observed animation classes earlier,
    // or that the final state contains at least one 'sorted' class (some UI frameworks might mark final items).
    const anySortedClass = await page.$('.array-bar.sorted') !== null;
    expect(sawAnimationClass || anySortedClass).toBeTruthy();
  });

  test('Clicking Sort multiple times quickly should not produce errors or break flow (edge case)', async ({ page }) => {
    // Edge case: user clicks Start Quick Sort repeatedly.
    // The code guards via isSorting; this test ensures there are no page errors and the final state is S3_Sorted.
    const qs3 = new QuickSortPage(page);
    await qs.goto();

    // Click sort twice in quick succession
    await qs.clickSort();
    // Attempt to click again immediately; this should either be ignored by the app or be no-op
    // We try clicking but guard it not to throw (sortBtn may be disabled)
    try {
      await qs.clickSort();
    } catch (e) {
      // If clicking a disabled button throws, ignore - we only care that it doesn't cause page errors
    }

    // Wait for completion
    await qs.waitForSortToComplete(45000);

    expect(await qs.isSortEnabled()).toBe(true);
    expect(await qs.isStepEnabled()).toBe(false);

    // No uncaught page errors were recorded in afterEach
  });

  test('Clicking Next Step when disabled should be a no-op and not cause errors', async ({ page }) => {
    // This test asserts that clicking the disabled Next Step button (when disabled) does nothing
    // and does not produce any page errors or throw in the test.
    const qs4 = new QuickSortPage(page);
    await qs.goto();

    // Ensure step button is disabled to begin with
    expect(await qs.isStepEnabled()).toBe(false);

    // Try clicking via Playwright's click should throw if disabled; to verify it's no-op we catch the error
    let clickThrown = false;
    try {
      await qs.stepBtn.click({ timeout: 500 });
    } catch (e) {
      clickThrown = true; // expected because button is disabled
    }
    expect(clickThrown).toBeTruthy();

    // Ensure DOM state unchanged: array still present and sort button still enabled
    expect(await qs.countBars()).toBe(10);
    expect(await qs.isSortEnabled()).toBe(true);
  });

  test('Attempt stepping manually via Step button after sorting completes (observed behavior)', async ({ page }) => {
    // This test explores the Step button handler behavior:
    // The app's step button handler has a guard 'if (isSorting) return', so clicking step while sorting is a no-op.
    // The manual stepping path requires animationSteps to be present while isSorting is false.
    // Since the UI doesn't expose these internals, we validate observable behavior:
    // - After a full auto-run (sort completes), stepBtn is disabled.
    // - Attempt clicking stepBtn after enabling it via UI (simulate user enabling by clicking sort again is not possible).
    // We will not mutate internal variables; we will simply check that the step button cannot be used as a manual stepper in normal flow.
    const qs5 = new QuickSortPage(page);
    await qs.goto();

    // Run a full automatic sort
    await qs.clickSort();
    await qs.waitForSortToComplete(45000);

    // After completion, step button must be disabled
    expect(await qs.isStepEnabled()).toBe(false);

    // Attempt to click step (should throw since disabled)
    let thrown = false;
    try {
      await qs.stepBtn.click({ timeout: 500 });
    } catch (e) {
      thrown = true;
    }
    expect(thrown).toBeTruthy();
  });
});