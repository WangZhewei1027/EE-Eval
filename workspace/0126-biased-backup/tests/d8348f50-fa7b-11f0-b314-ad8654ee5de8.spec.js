import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8348f50-fa7b-11f0-b314-ad8654ee5de8.html';

// Increase default timeout to allow the demo to run to completion (the demo shows ~35 steps at 900ms each).
test.setTimeout(90000);

class DemoPage {
  /**
   * Page object encapsulating interactions and queries for the insertion sort demo.
   */
  constructor(page) {
    this.page = page;
    this.demoBtn = page.locator('#demoBtn');
    this.demoBox = page.locator('#demo');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getButtonEnabled() {
    return await this.demoBtn.isEnabled();
  }

  async clickRun() {
    await this.demoBtn.click();
  }

  async getDemoBoxInnerText() {
    return await this.demoBox.innerText();
  }

  async waitForFirstStep(timeout = 5000) {
    // First step renders immediately on click: "Start: initial array"
    await this.page.waitForSelector('#demo >> text=Start: initial array', { timeout });
  }

  async waitForFinish(timeout = 70000) {
    // Wait for the "Finished: fully sorted array" step to appear.
    await this.page.waitForSelector('#demo >> text=Finished: fully sorted array', { timeout });
  }

  async getChipValues() {
    // returns array of chip text values (strings)
    const chips = this.page.locator('#demo .arrayRow .chip');
    const count = await chips.count();
    const values = [];
    for (let i = 0; i < count; i++) {
      values.push((await chips.nth(i).innerText()).trim());
    }
    return values;
  }

  async isButtonDisabled() {
    return !(await this.demoBtn.isEnabled());
  }
}

test.describe('Insertion Sort — Demo FSM (d8348f50-fa7b-11f0-b314-ad8654ee5de8)', () => {
  // Collect console messages and page errors across tests to assert runtime health.
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Observe console messages for debugging and error detection.
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') consoleErrors.push(text);
    });

    // Observe uncaught errors on the page.
    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });

    // Navigate to the page under test.
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // After each test we expect no uncaught page errors or console.errors (the implementation should run cleanly).
    // Record them with expect so failures show up in test reports.
    expect(pageErrors, `Unexpected page errors: ${pageErrors.join(' | ')}`).toEqual([]);
    expect(consoleErrors, `Unexpected console.error messages: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('S0_Idle: Initial Idle state shows run button and demo placeholder', async ({ page }) => {
    // Validate initial Idle state as described in FSM S0_Idle.
    // - Run demo button present, enabled, with the expected aria label and text.
    // - Demo box contains the placeholder text indicating idle state.
    const demo = new DemoPage(page);

    // Elements exist
    await expect(page.locator('#demoBtn')).toBeVisible();
    await expect(page.locator('#demo')).toBeVisible();

    // Button attributes and state
    const btn = page.locator('#demoBtn');
    await expect(btn).toHaveAttribute('aria-label', 'Run insertion sort demo');
    await expect(btn).toHaveText('Run demo');
    expect(await demo.getButtonEnabled()).toBe(true);

    // Demo placeholder text matches expected evidence in FSM
    const demoText = (await demo.getDemoBoxInnerText()).trim();
    expect(demoText).toMatch(/Demo output will appear here when you click "Run demo"\.|Demo output will appear here when you click "Run demo"\./);

    // No runtime errors so far (checked in afterEach), and at least one console informational message may be present.
    // This test only asserts Idle state's static DOM.
  });

  test('Transition S0_Idle -> S1_DemoRunning: Clicking Run demo disables button and renders first step', async ({ page }) => {
    // Validate the RunDemo event transition:
    // - Clicking the button disables it (onExit action from idle / entry action to running).
    // - First step ("Start: initial array") is rendered immediately.
    // - The chips reflect the initial array snapshot [5,2,4,6,1,3].
    const demo = new DemoPage(page);

    // Click to start demo
    await demo.clickRun();

    // Button should be disabled when demo is running
    expect(await demo.isButtonDisabled()).toBe(true);

    // First step should be rendered immediately: "Start: initial array"
    await demo.waitForFirstStep(5000);

    // Validate the chips show the initial array values in order.
    const chipValues = await demo.getChipValues();
    expect(chipValues).toEqual(['5', '2', '4', '6', '1', '3']);

    // The demo box should include the descriptive line "Snapshot of the array at this step."
    const demoText = await demo.getDemoBoxInnerText();
    expect(demoText).toContain('Snapshot of the array at this step.');

    // Ensure no runtime page errors occurred up to this point (asserted in afterEach).
  });

  test('S1_DemoRunning -> S2_DemoFinished: Demo plays through all steps and returns to Idle', async ({ page }) => {
    // Validate the demo plays to completion:
    // - The demo should eventually render the "Finished: fully sorted array" step.
    // - After completion, the Run demo button should be re-enabled (demo reset transition).
    // - The final chips should be sorted: [1,2,3,4,5,6].
    const demo = new DemoPage(page);

    // Start the demo
    await demo.clickRun();

    // Verify started state
    expect(await demo.isButtonDisabled()).toBe(true);
    await demo.waitForFirstStep(5000);

    // Wait for the demo to complete (this can take ~35 * 900ms ~ 31.5s). Provide generous timeout.
    await demo.waitForFinish(70000);

    // After finished, button should be enabled again (transition S2 -> S0 resets demoBtn.disabled = false)
    expect(await demo.getButtonEnabled()).toBe(true);

    // Validate final snapshot: the chips should be in ascending sorted order
    const finalChips = await demo.getChipValues();
    expect(finalChips).toEqual(['1', '2', '3', '4', '5', '6']);

    // The demo area should contain the "Finished: fully sorted array" description
    const finalText = await demo.getDemoBoxInnerText();
    expect(finalText).toContain('Finished: fully sorted array');

    // No uncaught errors should have occurred (checked in afterEach).
  });

  test('Edge case: Clicking the Run demo button while the demo is running should not throw or restart the demo', async ({ page }) => {
    // Validate that the UI is robust to repeated user interaction while running:
    // - Clicking again while disabled should have no effect (button remains disabled).
    // - No page errors are thrown as a result.
    const demo = new DemoPage(page);

    // Start the demo
    await demo.clickRun();
    await demo.waitForFirstStep(5000);

    // Attempt a second click immediately (button is disabled; this should have no effect and not crash)
    // We try to click via Playwright; the disabled attribute should prevent click event from firing.
    await page.click('#demoBtn').catch(() => {
      // Playwright clicking a disabled element may still succeed at the low level, but the handler won't run.
      // We swallow any internal Playwright throw here to proceed with assertions.
    });

    // Confirm button is still disabled (i.e., demo still running)
    expect(await demo.isButtonDisabled()).toBe(true);

    // Wait a short while and make sure no page error occurred
    // (Comprehensive page error assertion is performed in afterEach.)
    await page.waitForTimeout(1200);
  });

  test('S2_DemoFinished -> S0_Idle and re-run capability: After finish, user can start the demo again', async ({ page }) => {
    // Validate that once the demo finishes and returns to Idle, the user can trigger the demo again.
    // We will:
    // - Run to completion once
    // - Verify button re-enabled
    // - Click Run demo again and verify it enters the running state (first step rendered and button disabled)
    const demo = new DemoPage(page);

    // First full run
    await demo.clickRun();
    await demo.waitForFinish(70000);
    expect(await demo.getButtonEnabled()).toBe(true);

    // Click to start demo again (we won't wait for the full second run to finish to avoid doubling total run time)
    await demo.clickRun();

    // Immediately after clicking, the button should be disabled and the first step should be present again
    expect(await demo.isButtonDisabled()).toBe(true);
    await demo.waitForFirstStep(5000);

    // The chips should show the initial array again on the new run
    const initialChipsSecondRun = await demo.getChipValues();
    expect(initialChipsSecondRun).toEqual(['5', '2', '4', '6', '1', '3']);

    // We will not wait for the second run to finish in this test to keep runtime reasonable.
  });
});