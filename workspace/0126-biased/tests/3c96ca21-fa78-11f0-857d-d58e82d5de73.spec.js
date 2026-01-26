import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c96ca21-fa78-11f0-857d-d58e82d5de73.html';

// Page Object Model for the Selection Sort visualization page
class SelectionSortPage {
  constructor(page) {
    this.page = page;
    this.locators = {
      startBtn: '#btn-start',
      resetBtn: '#btn-reset',
      visualization: '#visualization',
      description: '#description',
      bars: '.bar',
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure the page has loaded the main elements:
    await Promise.all([
      this.page.waitForSelector(this.locators.startBtn),
      this.page.waitForSelector(this.locators.resetBtn),
      this.page.waitForSelector(this.locators.visualization),
      this.page.waitForSelector(this.locators.description),
    ]);
  }

  async getButtonDisabledState(selector) {
    return await this.page.$eval(selector, (el) => el.disabled);
  }

  async getDescriptionText() {
    return (await this.page.$eval(this.locators.description, el => el.textContent || '')).trim();
  }

  async getBarsCount() {
    return await this.page.$$eval(this.locators.bars, els => els.length);
  }

  async clickStart() {
    await this.page.click(this.locators.startBtn);
  }

  async clickReset(options = {}) {
    await this.page.click(this.locators.resetBtn, options);
  }

  async waitForAnyBarWithClass(cls, timeout = 10000) {
    return await this.page.waitForSelector(`${this.locators.bars}.${cls}`, { timeout });
  }

  async anyBarHasClass(cls) {
    return await this.page.$(`${this.locators.bars}.${cls}`) !== null;
  }

  async getBarAttribute(index, attr) {
    const handle = await this.page.$(`${this.locators.bars}[data-index="${index}"]`);
    if (!handle) return null;
    return await handle.getAttribute(attr);
  }

  async getBarLabelText(index) {
    const handle = await this.page.$(`${this.locators.bars}[data-index="${index}"] .label`);
    if (!handle) return null;
    return (await handle.textContent())?.trim() ?? null;
  }

  async waitForDescriptionToContain(text, timeout = 10000) {
    await this.page.waitForFunction(
      (sel, expected) => (document.querySelector(sel)?.textContent || '').includes(expected),
      { timeout },
      this.locators.description,
      text
    );
  }

  async waitForDescriptionEquals(text, timeout = 10000) {
    await this.page.waitForFunction(
      (sel, expected) => ((document.querySelector(sel)?.textContent || '').trim() === expected),
      { timeout },
      this.locators.description,
      text
    );
  }
}

// Group tests for the FSM and UI behavior
test.describe('Selection Sort Visualization — FSM and UI validation', () => {
  // Shared variables for logging console and page errors per test
  let consoleMessages = [];
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset logs
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages and errors
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        consoleErrors.push({ text });
      }
    });

    page.on('pageerror', (err) => {
      // pageerror captures uncaught exceptions from the page
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test we assert that there were no uncaught page errors or console errors.
    // This helps validate that the application runs without runtime exceptions for the exercised flows.
    expect(pageErrors, 'No uncaught page errors should occur').toEqual([]);
    expect(consoleErrors, 'No console.error messages should be emitted').toEqual([]);
  });

  test('S0_Idle: On load the app is in Idle state (buttons and description)', async ({ page }) => {
    // Validate initial Idle state (S0_Idle)
    const app = new SelectionSortPage(page);
    await app.goto();

    // Assert that resetVisualization() ran on load by checking initial UI:
    // - Start button enabled
    // - Reset button disabled
    // - Description contains the initial instructional paragraph
    const startDisabled = await app.getButtonDisabledState(app.locators.startBtn);
    const resetDisabled = await app.getButtonDisabledState(app.locators.resetBtn);
    const description = await app.getDescriptionText();
    const barsCount = await app.getBarsCount();

    // Assertions per FSM evidence for S0_Idle
    expect(startDisabled, 'Start button should be enabled on Idle').toBe(false);
    expect(resetDisabled, 'Reset button should be disabled on Idle').toBe(true);

    // Description should start with the instructional paragraph (we compare substring)
    expect(description.startsWith('Selection Sort iteratively selects the smallest remaining element'), 'Initial description should match expected idle text').toBe(true);

    // Bars should have been created by resetVisualization on init
    expect(barsCount, 'Visualization should contain 15 bars after initialization').toBe(15);

    // No console/page errors so far
    expect(consoleErrors.length, 'No console error messages expected on initial load').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors expected on initial load').toBe(0);
  });

  test('StartVisualization event transitions Idle -> Visualizing (S0 -> S1) and disables controls', async ({ page }) => {
    // Validate that clicking the Start button moves the app into the Visualizing state:
    // - Start and Reset buttons should be disabled when visualization begins
    // - Bars and description update to indicate progress (current/min highlights)
    const app = new SelectionSortPage(page);
    await app.goto();

    // Click Start visualization
    await app.clickStart();

    // Immediately after click, per application code both buttons should be disabled
    const startDisabledAfterClick = await app.getButtonDisabledState(app.locators.startBtn);
    const resetDisabledAfterClick = await app.getButtonDisabledState(app.locators.resetBtn);

    expect(startDisabledAfterClick, 'Start button should be disabled immediately after clicking Start').toBe(true);
    expect(resetDisabledAfterClick, 'Reset button should be disabled immediately after starting visualization').toBe(true);

    // The description should update to indicate the visualization has started.
    // The app sets description to "Starting Selection Sort on an array of X elements." before first delay.
    await app.waitForDescriptionToContain('Starting Selection Sort on an array of');

    const descAfterStart = await app.getDescriptionText();
    expect(descAfterStart.includes('Starting Selection Sort on an array of'), 'Description should indicate visualization start').toBe(true);

    // During visualizing, bars should acquire a "current" class at some point.
    // The first 'current' appears after an initial delay; wait for it with a reasonable timeout.
    await app.waitForAnyBarWithClass('current', 15000);
    const someCurrent = await app.anyBarHasClass('current');
    expect(someCurrent, 'At least one bar should be highlighted as current during visualization').toBe(true);

    // While visualizing, attempting to click the disabled Reset button without force should fail;
    // expecting Playwright to throw because the element is not "actionable".
    // We assert that a normal user click is not allowed while the button is disabled.
    await expect(async () => {
      await app.page.click(app.locators.resetBtn, { timeout: 3000 });
    }).rejects.toThrow();

    // No console/page errors occurred while starting visualization
    expect(consoleErrors.length, 'No console errors should be emitted on start').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors should be raised on start').toBe(0);
  });

  test('Full visualization completes and enters Completed state (S1 -> S2)', async ({ page }) => {
    // This test waits for the long-running visualization to finish and validates Completed state evidence.
    // Because the visualization uses many delays, extend the test timeout to accommodate the full run.
    test.setTimeout(5 * 60 * 1000); // 5 minutes

    const app = new SelectionSortPage(page);
    await app.goto();

    // Start the visualization
    await app.clickStart();

    // Verify initial visualizing disable state quickly
    expect(await app.getButtonDisabledState(app.locators.startBtn), 'Start should be disabled while visualizing').toBe(true);

    // Wait for the final description text that indicates completion
    const finalText = 'Array fully sorted. Visualization complete.';
    // The visualization is long; allow generous timeout
    await app.waitForDescriptionEquals(finalText, 240000); // 4 minutes

    // After completion the last bar should be marked sorted and all bars should show at least a sorted state
    const barsCount = await app.getBarsCount();
    expect(barsCount, 'There should be bars present at completion').toBeGreaterThan(0);

    // Check that the last bar has the 'sorted' class
    const lastBarSorted = await app.page.$eval(
      `${app.locators.bars}:last-child`,
      (el) => el.classList.contains('sorted')
    );
    expect(lastBarSorted, 'Last bar should be marked sorted after completion').toBe(true);

    // The description should exactly equal the final message per FSM evidence
    const descriptionFinal = await app.getDescriptionText();
    expect(descriptionFinal, 'Description should show the final completion message').toBe(finalText);

    // Buttons: at the end of visualization both Start and Reset are enabled per implementation
    expect(await app.getButtonDisabledState(app.locators.startBtn), 'Start button should be re-enabled after completion').toBe(false);
    expect(await app.getButtonDisabledState(app.locators.resetBtn), 'Reset button should be enabled after completion').toBe(false);

    // No console/page errors during completion
    expect(consoleErrors.length, 'No console errors should be emitted by the visualization').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors should be raised during visualization').toBe(0);
  });

  test('ResetVisualization event in Idle resets bars and description (S0 -> S0) and keeps Reset disabled', async ({ page }) => {
    // Validate Reset behavior while in Idle state.
    const app = new SelectionSortPage(page);
    await app.goto();

    // Capture initial labels to compare after reset
    const beforeLabels = [];
    const barsBefore = await page.$$(app.locators.bars);
    for (const bar of barsBefore) {
      const label = (await bar.$eval('.label', el => el.textContent || '')).trim();
      beforeLabels.push(label);
    }

    // Reset should be disabled initially (Idle); however clicking Reset is a valid Idle->Idle transition via the button.
    // The Reset button is initially disabled, per spec, so programmatic click will be blocked for a user.
    // To exercise the Reset action path, first ensure we can enable the Reset by simulating a completed visualization.
    // For a safe test that doesn't require running a full visualization, we can:
    //  - Programmatically click Start and wait briefly for visualizing to start and then wait for Reset to become enabled after completion.
    // However running full visualization is expensive; instead, follow the FSM Idle->Idle expected behavior:
    // Attempting to click Reset while it's disabled should not change the bars. Assert that behavior.
    await expect(async () => {
      await app.page.click(app.locators.resetBtn, { timeout: 3000 });
    }).rejects.toThrow();

    // Ensure nothing changed
    const afterLabels = [];
    const barsAfter = await page.$$(app.locators.bars);
    for (const bar of barsAfter) {
      const label = (await bar.$eval('.label', el => el.textContent || '')).trim();
      afterLabels.push(label);
    }

    expect(afterLabels, 'Bar labels should be unchanged when clicking disabled Reset in Idle').toEqual(beforeLabels);

    // Now, to also validate the Reset action when it is enabled: run a minimal flow to enable Reset
    // We will start and wait for completion (long test). To keep test time reasonable, do a quick short-circuit:
    // Instead, use the following pragmatic approach: click Start and then wait until Reset becomes enabled.
    // This will wait for the full visualization to finish (tested in previous test). We won't duplicate the whole validation here.
    // But we will validate that when Reset is enabled it returns the page to Idle state.
    // Start the visualization and wait for completion (with generous timeout)
    test.setTimeout(5 * 60 * 1000); // 5 minutes for this flow
    await app.clickStart();
    // Wait for completion
    await app.waitForDescriptionEquals('Array fully sorted. Visualization complete.', 240000);

    // Now Reset should be enabled
    expect(await app.getButtonDisabledState(app.locators.resetBtn), 'Reset should be enabled after visualization completes').toBe(false);

    // Click Reset to go back to Idle
    await app.clickReset();

    // After reset, description should revert to the initial instructional text
    const resetDescription = await app.getDescriptionText();
    expect(resetDescription.startsWith('Selection Sort iteratively selects the smallest remaining element'), 'Description should revert to initial idle text after Reset').toBe(true);

    // After reset, Reset button is disabled again and Start is enabled
    expect(await app.getButtonDisabledState(app.locators.resetBtn), 'Reset should be disabled after Reset action returns to Idle').toBe(true);
    expect(await app.getButtonDisabledState(app.locators.startBtn), 'Start should be enabled after Reset action returns to Idle').toBe(false);

    // Bars should exist and be re-created (count should be 15)
    expect(await app.getBarsCount(), 'After reset there should be 15 bars').toBe(15);

    // No console/page errors throughout this flow
    expect(consoleErrors.length, 'No console errors should be emitted during reset flows').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors should be raised during reset flows').toBe(0);
  });

  test('Edge case: attempting to interact with disabled controls during Visualizing should be prevented', async ({ page }) => {
    // Ensure disabled controls cannot be interacted with during the Visualizing state.
    const app = new SelectionSortPage(page);
    await app.goto();

    // Start visualization
    await app.clickStart();

    // Confirm visualizing state (Start disabled)
    expect(await app.getButtonDisabledState(app.locators.startBtn), 'Start must be disabled while visualizing').toBe(true);
    expect(await app.getButtonDisabledState(app.locators.resetBtn), 'Reset must be disabled while visualizing').toBe(true);

    // Attempt to click Start again using usual click (should fail because it's disabled/unactionable)
    await expect(async () => {
      await app.page.click(app.locators.startBtn, { timeout: 3000 });
    }).rejects.toThrow();

    // Attempt to programmatically focus the reset button then press Enter to simulate keyboard interaction
    // (This simulates a real user trying to interact but will not trigger the action)
    await expect(async () => {
      await app.page.focus(app.locators.resetBtn);
      // Pressing Enter on a disabled button should not trigger action; Playwright will still send the key,
      // but the button is disabled and should not perform the reset. We assert no exception here, but ensure the description does not change to the initial text.
      await app.page.keyboard.press('Enter');
    }).resolves.toBeUndefined();

    // The description should not have reverted to the Idle instruction (meaning Reset did not take effect)
    const descriptionDuring = await app.getDescriptionText();
    expect(descriptionDuring.includes('Starting Selection Sort') || descriptionDuring.includes('Iteration') || descriptionDuring.includes('Comparing'), 'Reset should not have been applied during visualizing').toBe(true);

    // No console/page errors for these interactions
    expect(consoleErrors.length, 'No console errors should be emitted for invalid interactions').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors should be raised for invalid interactions').toBe(0);
  });
});