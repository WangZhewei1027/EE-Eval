import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f5b7b2-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object Model for the Counting Sort visualization page
class CountingSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.playBtn = page.locator('#playBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.inputRow = page.locator('#inputRow');
    this.countRow = page.locator('#countRow');
    this.cumRow = page.locator('#cumRow');
    this.outputRow = page.locator('#outputRow');
    this.rangeLabel = page.locator('#rangeLabel');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Ensure initial build has had a chance to run
    await this.page.waitForSelector('#inputRow .tile');
  }

  async clickPlay() {
    await this.playBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async pressPlayEnter() {
    await this.playBtn.focus();
    await this.page.keyboard.press('Enter');
  }

  async isPlayDisabled() {
    return await this.playBtn.evaluate((el) => el.disabled);
  }

  async isResetDisabled() {
    return await this.resetBtn.evaluate((el) => el.disabled);
  }

  async inputTilesText() {
    return await this.page.$$eval('#inputRow .tile', (els) => els.map(e => e.textContent.trim()));
  }

  async countBubblesText() {
    return await this.page.$$eval('#countRow .count-bubble', (els) => els.map(e => e.textContent.trim()));
  }

  async cumFillWidths() {
    return await this.page.$$eval('#cumRow .cum-fill', (els) => els.map(e => e.style.width || '0%'));
  }

  async outputSlotsText() {
    return await this.page.$$eval('#outputRow .slot', (els) => els.map(e => e.textContent.trim()));
  }

  async outputSlotsHaveClassValue() {
    return await this.page.$$eval('#outputRow .slot', (els) => els.map(e => e.classList.contains('value')));
  }

  // Wait for the animation sequence to complete by waiting for playBtn to be re-enabled.
  // The page sets playBtn.disabled = true at start and false at end.
  async waitForAnimationComplete(timeout = 120000) {
    await this.page.waitForFunction(() => {
      const btn = document.getElementById('playBtn');
      return btn && !btn.disabled;
    }, { timeout });
  }
}

test.describe('Counting Sort — Visual Elegance (f1f5b7b2-fa77-11f0-a6a1-c765f41a13c7)', () => {
  // Increase timeout for long-running animation tests
  test.beforeEach(async ({}, testInfo) => {
    testInfo.setTimeout(180000);
  });

  // We'll capture console errors and page errors for each test and assert none happened.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Assert that no unexpected console or page errors occurred during the test.
    // If there are errors, include them in the message to aid debugging.
    expect(consoleErrors.length, `Console errors found: ${JSON.stringify(consoleErrors, null, 2)}`).toBe(0);
    expect(pageErrors.length, `Page errors found: ${JSON.stringify(pageErrors, null, 2)}`).toBe(0);
  });

  test('S0_Idle: initial UI is built by buildUI() on load', async ({ page }) => {
    // Validate initial state (Idle): buildUI has been executed and DOM elements exist with expected counts
    const model = new CountingSortPage(page);
    await model.goto();

    // Verify range label shows expected MIN — MAX text
    await expect(model.rangeLabel).toHaveText(/0\s*—\s*9/);

    // Input row should have tiles for each input value (the sample input has 7 elements)
    const inputTexts = await model.inputTilesText();
    expect(inputTexts.length).toBe(7);
    expect(inputTexts).toEqual(['4', '2', '2', '8', '3', '3', '1']);

    // Count buckets should have 10 bubbles (0..9)
    const counts = await model.countBubblesText();
    expect(counts.length).toBe(10);
    // Initially all bubbles display '0'
    for (const c of counts) expect(c).toBe('0');

    // Cumulative fills should exist and be 0% width initially
    const fills = await model.cumFillWidths();
    expect(fills.length).toBe(10);
    for (const w of fills) expect(w === '0%' || w === '' ).toBeTruthy();

    // Output row should have empty slots equal to input length
    const outputs = await model.outputSlotsText();
    expect(outputs.length).toBe(7);
    for (const out of outputs) expect(out).toBe('');

    // Play and Reset buttons should be enabled in Idle
    expect(await model.isPlayDisabled()).toBeFalsy();
    expect(await model.isResetDisabled()).toBeFalsy();
  });

  test('Transition S0 -> S1 via PlayAnimation (click): animation runs and final sorted output is produced', async ({ page }) => {
    // This test validates that clicking Play starts the animation and produces a correct sorted output
    // It also asserts that the UI disables controls during animation and re-enables afterwards.
    const model = new CountingSortPage(page);
    await model.goto();

    // Start listening to potential console/page errors (already set up in hooks)

    // Click Play to start the animation
    await model.clickPlay();

    // Immediately after click, Play should become disabled (animation running), same for Reset
    // Give a short moment for script to set disabled
    await page.waitForTimeout(50);
    expect(await model.isPlayDisabled()).toBeTruthy();
    expect(await model.isResetDisabled()).toBeTruthy();

    // Wait for the animation to complete (playBtn re-enabled)
    // The animation is intentionally long (~20s); allow generous timeout.
    await model.waitForAnimationComplete(120000);

    // After completion, buttons should be enabled again
    expect(await model.isPlayDisabled()).toBeFalsy();
    expect(await model.isResetDisabled()).toBeFalsy();

    // Validate final outputs are sorted and stable: expected sorted array [1,2,2,3,3,4,8]
    const finalOutputs = await model.outputSlotsText();
    expect(finalOutputs).toEqual(['1','2','2','3','3','4','8']);

    // Validate that count bubbles have been decremented to zeros (all counts consumed)
    const finalCounts = await model.countBubblesText();
    for (const c of finalCounts) expect(c).toBe('0');

    // Validate that cumulative fills are all zero (no filled cumulative after completion)
    const finalFills = await model.cumFillWidths();
    for (const w of finalFills) expect(w === '0%' || w === '').toBeTruthy();
  });

  test('S1_Animating -> S0_Idle via Reset after animation: resetAll() rebuilds the UI', async ({ page }) => {
    // Run the animation, wait for completion, then click Reset and assert the UI returns to initial state.
    const model = new CountingSortPage(page);
    await model.goto();

    // Run animation to populate output slots
    await model.clickPlay();
    await model.waitForAnimationComplete(120000);

    // Confirm outputs are populated
    const filledOutputs = await model.outputSlotsText();
    expect(filledOutputs.some(t => t !== '')).toBeTruthy();

    // Now click Reset (after animation: resetBtn should be enabled)
    await model.clickReset();

    // After reset, output slots should be cleared, counts zeroed, cum fills reset
    // Wait a short time for resetAll() to rebuild UI (it's synchronous but allow DOM microtasks)
    await page.waitForTimeout(50);

    const postResetOutputs = await model.outputSlotsText();
    expect(postResetOutputs.length).toBe(7);
    for (const s of postResetOutputs) expect(s).toBe('');

    const postResetCounts = await model.countBubblesText();
    for (const c of postResetCounts) expect(c).toBe('0');

    const postResetFills = await model.cumFillWidths();
    for (const f of postResetFills) expect(f === '0%' || f === '').toBeTruthy();

    // Buttons should be enabled again after reset
    expect(await model.isPlayDisabled()).toBeFalsy();
    expect(await model.isResetDisabled()).toBeFalsy();
  });

  test('Play animation via keyboard (Enter) triggers S0 -> S1 and completes', async ({ page }) => {
    // This test validates keyboard accessibility: pressing Enter on the Play button starts the animation
    const model = new CountingSortPage(page);
    await model.goto();

    // Trigger via Enter key
    await model.pressPlayEnter();

    // Play should be disabled while running
    await page.waitForTimeout(50);
    expect(await model.isPlayDisabled()).toBeTruthy();

    // Wait for completion and verify final sorted output
    await model.waitForAnimationComplete(120000);
    const outputs = await model.outputSlotsText();
    expect(outputs).toEqual(['1','2','2','3','3','4','8']);
  });

  test('Edge case: double-clicking Play quickly should not start multiple concurrent runs or throw errors', async ({ page }) => {
    // Clicking Play twice in rapid succession should be guarded by `running` and should not cause exceptions.
    const model = new CountingSortPage(page);
    await model.goto();

    // Rapid clicks
    await Promise.all([
      model.playBtn.click(),
      model.playBtn.click()
    ]).catch(() => {
      // Some browsers may ignore the second click due to button being disabled; ignore click failures here.
    });

    // Play should be disabled and no page errors should have occurred
    await page.waitForTimeout(100);
    expect(await model.isPlayDisabled()).toBeTruthy();

    // Wait for completion
    await model.waitForAnimationComplete(120000);

    // Ensure that the final state is consistent and no exceptions were raised (checked in afterEach)
    const outputs = await model.outputSlotsText();
    expect(outputs).toEqual(['1','2','2','3','3','4','8']);
  });

  test('Attempting Reset while running is ignored (Reset button is disabled during animation)', async ({ page }) => {
    // Validate that when animation is running the Reset button is disabled (script sets resetBtn.disabled = true)
    const model = new CountingSortPage(page);
    await model.goto();

    // Start animation
    await model.clickPlay();

    // Immediately ensure Reset is disabled
    await page.waitForTimeout(50);
    const resetDisabledDuringRun = await model.isResetDisabled();
    expect(resetDisabledDuringRun).toBeTruthy();

    // Attempt to click Reset (should be a no-op because disabled)
    // We perform a click only if Play/Reset are not disabled (to avoid throwing) - here it's disabled so skip click.
    if (!resetDisabledDuringRun) {
      await model.clickReset();
    }

    // Wait for animation to finish normally
    await model.waitForAnimationComplete(120000);

    // After completion, Reset should be enabled again
    expect(await model.isResetDisabled()).toBeFalsy();
  });

  test('Observability: capture any console errors or page errors that might surface during interactions', async ({ page }) => {
    // This test ensures we are actively observing console and page errors during a typical interaction sequence.
    // It duplicates a run and then verifies captured error arrays are empty (see afterEach assertion).
    const model = new CountingSortPage(page);
    await model.goto();

    // Perform a full run via click
    await model.clickPlay();
    await model.waitForAnimationComplete(120000);

    // Then soft-reset
    await model.clickReset();
    await page.waitForTimeout(50);

    // No explicit assertions here about errors because afterEach will assert consoleErrors/pageErrors are empty.
    // This test primarily exists to ensure the instrumentation (listeners) runs during typical usage.
  });
});