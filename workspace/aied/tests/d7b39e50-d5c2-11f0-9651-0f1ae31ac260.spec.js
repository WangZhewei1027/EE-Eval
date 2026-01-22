import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b39e50-d5c2-11f0-9651-0f1ae31ac260.html';

// Page Object encapsulating interactions with the Quick Sort Visualization page
class QuickSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.input = page.locator('#arrayInput');
    this.arrayContainer = page.locator('#arrayContainer');
    this.log = page.locator('#log');
  }

  async goto() {
    await this.page.goto(BASE_URL);
    // Ensure page loaded and initial script executed
    await expect(this.page).toHaveURL(BASE_URL);
  }

  async getBarValues() {
    const bars = this.arrayContainer.locator('.bar');
    const count = await bars.count();
    const values = [];
    for (let i = 0; i < count; i++) {
      values.push((await bars.nth(i).textContent()).trim());
    }
    return values;
  }

  async getBarsCount() {
    return await this.arrayContainer.locator('.bar').count();
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async setInput(value) {
    await this.input.fill(value);
  }

  async getLogText() {
    return (await this.log.textContent()) || '';
  }

  async waitForLogContains(text, timeout = 30000) {
    await this.page.waitForFunction(
      (t) => {
        const el = document.getElementById('log');
        return el && el.textContent && el.textContent.indexOf(t) !== -1;
      },
      text,
      { timeout }
    );
  }

  async anyBarHasClass(cls) {
    return await this.arrayContainer.locator(`.bar.${cls}`).count() > 0;
  }

  async allBarsHaveClass(cls) {
    const bars = this.arrayContainer.locator('.bar');
    const count = await bars.count();
    if (count === 0) return false;
    for (let i = 0; i < count; i++) {
      const has = await bars.nth(i).evaluate((el, c) => el.classList.contains(c), cls);
      if (!has) return false;
    }
    return true;
  }

  async isStartDisabled() {
    return await this.startBtn.isDisabled();
  }

  async isResetDisabled() {
    return await this.resetBtn.isDisabled();
  }

  async isInputDisabled() {
    // There's no direct locator API for 'disabled' attribute value, use evaluate
    return await this.input.evaluate((el) => el.disabled);
  }
}

// Keep track of console messages and page errors across tests to assert no unexpected runtime errors
test.describe('Quick Sort Visualization - FSM and UI behavior', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    // Attach listeners to capture console and page errors for assertions
    page._consoleMessages = [];
    page._pageErrors = [];

    page.on('console', (msg) => {
      // capture text for later assertions
      try {
        page._consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch {
        // ignore any issues capturing console
      }
    });

    page.on('pageerror', (err) => {
      page._pageErrors.push(err);
    });
  });

  // Test the initial state (S0_Idle) - initializeArray() should run on load
  test('Initial state (S0_Idle) - array initialized on load, Start enabled, Reset disabled', async ({ page }) => {
    const qs = new QuickSortPage(page);
    await qs.goto();

    // Verify that initializeArray rendered bars representing the default array
    const barCount = await qs.getBarsCount();
    expect(barCount).toBe(6); // default value "50,23,9,18,61,32" => 6 bars

    const values = await qs.getBarValues();
    expect(values).toEqual(['50', '23', '9', '18', '61', '32']);

    // UI controls: start enabled, reset disabled, input enabled
    expect(await qs.isStartDisabled()).toBe(false);
    expect(await qs.isResetDisabled()).toBe(true);
    expect(await qs.isInputDisabled()).toBe(false);

    // Log should be empty initially
    const logText = await qs.getLogText();
    expect(logText.trim()).toBe('');

    // No runtime page errors expected on initial load
    expect(page._pageErrors.length).toBe(0);
  });

  // Test transition S0_Idle -> S1_Sorting via StartSort event
  test('Transition S0_Idle -> S1_Sorting: clicking Start Sort begins visualization and updates UI', async ({ page }) => {
    const qs = new QuickSortPage(page);
    await qs.goto();

    // Start sorting and verify UI changes immediately after click
    await Promise.all([
      // do not wait for sorting to finish here; just trigger
      qs.clickStart(),
    ]);

    // Immediately after starting, input should be disabled, start button disabled, reset enabled
    await expect(qs.startBtn).toBeDisabled();
    expect(await qs.isInputDisabled()).toBe(true);
    expect(await qs.isResetDisabled()).toBe(false);

    // The log should contain the starting message
    await qs.waitForLogContains('Starting quick sort...', 5000);
    const logText = await qs.getLogText();
    expect(logText).toContain('Starting quick sort...');

    // Wait for partition to begin (synchronization point) - pivot chosen message
    await qs.waitForLogContains('Pivot chosen', 15000);

    // At this point, at least one element should be highlighted as pivot
    const pivotCount = await page.locator('#arrayContainer .bar.pivot').count();
    expect(pivotCount).toBeGreaterThanOrEqual(1);

    // Ensure there were no uncaught page errors while starting the sort
    expect(page._pageErrors.length).toBe(0);
  }, { timeout: 30000 });

  // Test that sorting completes and S1_Sorting -> S2_Reset via Reset after completion
  test('Sorting completes and Reset transitions to Idle (S1_Sorting -> S2_Reset -> S0_Idle)', async ({ page }) => {
    const qs = new QuickSortPage(page);
    await qs.goto();

    // Start the sorting process
    await qs.clickStart();

    // Wait for the "Array sorted!" log entry which signals completion
    await qs.waitForLogContains('Array sorted!', 60000);

    // After completion, the UI highlights final array elements (all bars get 'swap' class)
    const allSwapped = await qs.allBarsHaveClass('swap');
    expect(allSwapped).toBe(true);

    // After sorting completes, the page's reset button should be enabled so user can reset UI
    expect(await qs.isResetDisabled()).toBe(false);

    // Now click reset to transition to Idle: Reset should re-enable Start and input, disable Reset
    await qs.clickReset();

    // After reset, Start should be enabled, Reset disabled, input enabled
    expect(await qs.isStartDisabled()).toBe(false);
    expect(await qs.isResetDisabled()).toBe(true);
    expect(await qs.isInputDisabled()).toBe(false);

    // Array values should be restored to initial values as initializeArray is called on reset
    const values = await qs.getBarValues();
    expect(values).toEqual(['50', '23', '9', '18', '61', '32']);

    // Confirm the log has been cleared by reset
    const logTextAfterReset = await qs.getLogText();
    expect(logTextAfterReset.trim()).toBe('');

    // Verify no uncaught errors occurred during full sort and reset
    expect(page._pageErrors.length).toBe(0);
  }, { timeout: 90000 });

  // Edge case: Clicking Reset while sorting is in progress should be ignored due to isSorting guard
  test('Edge case: Reset clicked during active sorting is ignored (no state change) ', async ({ page }) => {
    const qs = new QuickSortPage(page);
    await qs.goto();

    // Start sorting
    await qs.clickStart();

    // Ensure sorting started
    await qs.waitForLogContains('Starting quick sort...', 5000);

    // Try to click reset while sorting is running
    await qs.clickReset();

    // Because isSorting is true, reset() returns early and UI should remain in sorting state:
    // startBtn should remain disabled, resetBtn should remain enabled and input disabled
    expect(await qs.isStartDisabled()).toBe(true);
    expect(await qs.isResetDisabled()).toBe(false);
    expect(await qs.isInputDisabled()).toBe(true);

    // The log should still contain starting message and should not be cleared
    const logText = await qs.getLogText();
    expect(logText).toContain('Starting quick sort...');

    // Wait for full completion to avoid leaving background sorting processes for next tests
    await qs.waitForLogContains('Array sorted!', 60000);

    // After completion, perform reset to clean up UI state
    await qs.clickReset();
    expect(await qs.isStartDisabled()).toBe(false);

    // Confirm no uncaught errors occurred
    expect(page._pageErrors.length).toBe(0);
  }, { timeout: 90000 });

  // Error scenario: invalid input (non-numeric values) should trigger alert and prevent starting
  test('Invalid input shows alert and prevents sorting from starting', async ({ page }) => {
    const qs = new QuickSortPage(page);
    await qs.goto();

    const dialogMessages = [];
    page.on('dialog', async (dialog) => {
      dialogMessages.push(dialog.message());
      await dialog.dismiss();
    });

    // Enter an invalid array string
    await qs.setInput('a,b, c');

    // Click start - initializeArray should detect NaN and alert
    await qs.clickStart();

    // Wait a short time for dialog to be captured
    await page.waitForTimeout(500);

    // We expect an alert to have shown with invalid list message
    expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
    const msg = dialogMessages[0];
    expect(msg).toMatch(/Please enter a valid list of numbers/i);

    // Ensure sorting did not start: start button should remain enabled (initializeArray returned false so startSort not invoked)
    expect(await qs.isStartDisabled()).toBe(false);
    // Bars should reflect previous (initial) values
    const values = await qs.getBarValues();
    expect(values).toEqual(['50', '23', '9', '18', '61', '32']);

    // No runtime errors expected
    expect(page._pageErrors.length).toBe(0);
  });

  // Error scenario: empty input should trigger alert and prevent sorting
  test('Empty input shows alert and sorting is prevented', async ({ page }) => {
    const qs = new QuickSortPage(page);
    await qs.goto();

    const dialogMessages = [];
    page.on('dialog', async (dialog) => {
      dialogMessages.push(dialog.message());
      await dialog.dismiss();
    });

    // Clear input (empty)
    await qs.setInput('');

    // Click start - initializeArray should alert about needing at least one number
    await qs.clickStart();

    // Wait a short time for dialog to be captured
    await page.waitForTimeout(500);

    expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
    const msg = dialogMessages[0];
    expect(msg).toMatch(/Please enter at least one number/i);

    // Ensure sorting did not start
    expect(await qs.isStartDisabled()).toBe(false);

    // No runtime page errors
    expect(page._pageErrors.length).toBe(0);
  });

  // Final check: observe console messages and page errors after exercising UI heavily
  test('Final check: no unexpected console errors or page errors were emitted during tests', async ({ page }) => {
    // This test just navigates and ensures there are no low-level errors visible on load
    const qs = new QuickSortPage(page);
    await qs.goto();

    // Allow any background onload actions to complete
    await page.waitForTimeout(200);

    // Validate captured lists exist on the page object created in beforeEach
    // (page._consoleMessages and page._pageErrors)
    const consoleMessages = page._consoleMessages || [];
    const pageErrors = page._pageErrors || [];

    // There might be console messages but none of type 'error' should be present
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
  });
});