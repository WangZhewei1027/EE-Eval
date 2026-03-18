import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a330a63-ffc5-11f0-8b43-1ffa87931c43.html';

/**
 * Page Object for Radix Sort Visualization
 */
class RadixPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputArray');
    this.startBtn = page.locator('#startBtn');
    this.prevBtn = page.locator('#prevStepBtn');
    this.nextBtn = page.locator('#nextStepBtn');
    this.autoBtn = page.locator('#autoBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.speedRange = page.locator('#speedRange');
    this.speedLabel = page.locator('#speedLabel');
    this.arrayItems = page.locator('#arrayContainer .array-item');
    this.bucketsArea = page.locator('#bucketsArea');
    this.logArea = page.locator('#logArea');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait for the main elements to be present
    await Promise.all([
      this.input.waitFor({ state: 'attached' }),
      this.startBtn.waitFor({ state: 'attached' }),
      this.logArea.waitFor({ state: 'attached' })
    ]);
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async fillInput(value) {
    await this.input.fill(value);
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickNext() {
    await this.nextBtn.click();
  }

  async clickPrev() {
    await this.prevBtn.click();
  }

  async toggleAuto() {
    await this.autoBtn.click();
  }

  async setSpeed(value) {
    // value is a number (ms). Use input dispatch so the page's event listener runs.
    await this.speedRange.fill(String(value));
    // Trigger input event programmatically (some browsers require actual input event)
    await this.page.$eval('#speedRange', (el, v) => {
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
    // Wait for label update
    await expect(this.speedLabel).toHaveText(String(value) + ' ms');
  }

  async getLogText() {
    return (await this.logArea.textContent())?.trim() ?? '';
  }

  async getArrayItemsText() {
    return this.arrayItems.allTextContents();
  }

  async isStartDisabled() {
    return await this.startBtn.isDisabled();
  }

  async isPrevDisabled() {
    return await this.prevBtn.isDisabled();
  }

  async isNextDisabled() {
    return await this.nextBtn.isDisabled();
  }

  async isAutoDisabled() {
    return await this.autoBtn.isDisabled();
  }

  async isResetDisabled() {
    return await this.resetBtn.isDisabled();
  }

  async bucketsVisible() {
    return (await this.bucketsArea.evaluate((el) => {
      return window.getComputedStyle(el).display !== 'none';
    }));
  }

  // Wait until the log contains expected substring
  async waitForLogContains(substring, timeout = 5000) {
    await this.page.waitForFunction(
      (sel, s) => document.querySelector(sel) && document.querySelector(sel).textContent.includes(s),
      '#logArea',
      substring,
      { timeout }
    );
  }
}

test.describe('Radix Sort Visualization - FSM and UI interactions', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // capture unhandled errors
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test('Initial Idle state should render Ready message and controls disabled as implemented', async ({ page }) => {
    // Validate initial page rendering matches Idle state expectations
    const p = new RadixPage(page);
    await p.goto();

    // The app's log area should show the idle message
    await expect(p.logArea).toHaveText('Ready to start radix sort.');

    // According to the implementation setControlsDisabled(true) was called at init:
    // start button should be disabled, navigation buttons disabled, auto disabled, reset enabled
    expect(await p.isStartDisabled()).toBe(true);
    expect(await p.isPrevDisabled()).toBe(true);
    expect(await p.isNextDisabled()).toBe(true);
    expect(await p.isAutoDisabled()).toBe(true);
    expect(await p.isResetDisabled()).toBe(false);

    // No unexpected page errors at initial load
    expect(pageErrors.length).toBe(0);
  });

  test('StartSort transition: enable start via Reset, provide valid input and start sorting', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_Sorting triggered by StartSort (via enabling start using Reset)
    const p = new RadixPage(page);
    await p.goto();

    // Click Reset to enable controls (resetAll calls setControlsDisabled(false))
    await p.clickReset();

    // After reset start should be enabled
    expect(await p.isStartDisabled()).toBe(false);

    // Provide a valid input and start
    const numbers = '170, 45, 75';
    await p.fillInput(numbers);

    // Start the sort
    await p.clickStart();

    // The implementation sets the log to 'Radix sort started. Use Next Step to proceed.' after rendering first state
    await p.waitForLogContains('Radix sort started. Use Next Step to proceed.');

    // Verify array items were rendered and match the provided numbers
    const items = await p.getArrayItemsText();
    // prepare expected array tokens split by commas/spaces
    expect(items.map(s => s.trim())).toEqual(['170', '45', '75']);

    // Controls expectations after starting
    expect(await p.isPrevDisabled()).toBe(true); // we are at step 0
    expect(await p.isNextDisabled()).toBe(false);
    expect(await p.isAutoDisabled()).toBe(false);

    // No runtime page errors occurred during start
    expect(pageErrors.length).toBe(0);
  });

  test('NextStep and PrevStep transitions navigate through steps and reach Completed state', async ({ page }) => {
    // This test will drive NextStep until it reaches the Completed state (S2_Completed),
    // then use PrevStep to step back and assert the messages and enabling/disabling of controls.
    const p = new RadixPage(page);
    await p.goto();

    // Enable start then start with a sample set that yields multiple steps
    await p.clickReset();
    await p.fillInput('170 45 75'); // same numbers as before
    await p.clickStart();

    // Move forward step-by-step until completion or until safety limit
    let reachedCompleted = false;
    // safety limit to prevent infinite loops in case of unexpected behavior
    const safetyLimit = 500;
    let clicks = 0;
    // Keep clicking Next until log shows completion or next becomes disabled
    while (clicks < safetyLimit) {
      const logText = await p.getLogText();
      if (logText.includes('Radix sort completed!')) {
        reachedCompleted = true;
        break;
      }
      if (await p.isNextDisabled()) {
        // If next got disabled but log not containing completed, break to avoid infinite loop
        break;
      }
      await p.clickNext();
      clicks++;
    }

    // Validate we reached completed (per FSM there is a final state)
    expect(reachedCompleted).toBe(true);

    // At completion Next should be disabled
    expect(await p.isNextDisabled()).toBe(true);

    // Now click Prev to step back one step from the final state and assert log changed away from completed
    if (!await p.isPrevDisabled()) {
      const prevLogBefore = await p.getLogText();
      await p.clickPrev();
      const prevLogAfter = await p.getLogText();
      expect(prevLogAfter).not.toEqual(prevLogBefore);
      expect(prevLogAfter).not.toContain('Radix sort completed!');
      // Next should now be enabled because we moved back
      expect(await p.isNextDisabled()).toBe(false);
    }

    // Ensure buckets area is visible at some intermediate step (buckets are used during sorting)
    // We navigate back to an intermediate step if currently at start or completed.
    // Click Next once to reach a non-initial state and assert buckets visible.
    if (await p.isNextDisabled() === false) {
      await p.clickNext();
      // bucketsArea should be displayed (renderBuckets sets display to 'flex')
      expect(await p.bucketsVisible()).toBe(true);
    }

    // No uncaught page errors during navigation
    expect(pageErrors.length).toBe(0);
  });

  test('AutoPlay toggles autoplay, respects speed, and completes automatically', async ({ page }) => {
    // This test validates the AutoPlay event: toggle auto play, ensure controls are disabled while playing,
    // and that it completes automatically and resets controls appropriately.
    const p = new RadixPage(page);
    await p.goto();

    // Prepare run
    await p.clickReset();
    await p.fillInput('170 45 75');
    await p.clickStart();

    // Speed up autoplay to make the test fast
    await p.setSpeed(100); // 100 ms per step

    // Start autoplay
    await p.toggleAuto();

    // When auto is playing, the button text becomes 'Pause'
    await expect(p.autoBtn).toHaveText('Pause');

    // While auto playing, prev and next should be disabled, start should be disabled
    expect(await p.isPrevDisabled()).toBe(true);
    expect(await p.isNextDisabled()).toBe(true);
    expect(await p.isStartDisabled()).toBe(true);

    // Wait until completion message appears in the log (auto play should finish and auto toggles off)
    await p.waitForLogContains('Radix sort completed!', 20000);

    // After completion, autoplay should have toggled back to 'Auto Play' and controls re-enabled appropriately
    await expect(p.autoBtn).toHaveText('Auto Play');

    // Start should be enabled again and input should be editable
    expect(await p.isStartDisabled()).toBe(false);

    // No uncaught page errors during autoplay
    expect(pageErrors.length).toBe(0);
  });

  test('ChangeSpeed updates the speed label and affects running autoplay timer', async ({ page }) => {
    // This test checks ChangeSpeed event: updating the range updates the label text and,
    // when autoplay is running, the interval is updated (we infer by successful completion at faster speed).
    const p = new RadixPage(page);
    await p.goto();

    await p.clickReset();
    await p.fillInput('170 45 75');
    await p.clickStart();

    // Initially set a slow speed then switch to fast while autoplay is running
    await p.setSpeed(800);
    expect(await p.speedLabel.textContent()).toContain('800 ms');

    // Start autoplay
    await p.toggleAuto();
    await expect(p.autoBtn).toHaveText('Pause');

    // Now change speed to a faster value
    await p.setSpeed(100);
    expect(await p.speedLabel.textContent()).toContain('100 ms');

    // Wait for completion which should be quicker due to 100ms speed
    await p.waitForLogContains('Radix sort completed!', 15000);

    // Ensure label still shows the updated speed after completion
    expect(await p.speedLabel.textContent()).toContain('100 ms');

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Reset returns app to Idle state from Sorting and clears timers', async ({ page }) => {
    // This test validates Reset transition from S1_Sorting -> S0_Idle and that UI is reset.
    const p = new RadixPage(page);
    await p.goto();

    // Start a sorting session
    await p.clickReset();
    await p.fillInput('170 45 75');
    await p.clickStart();

    // Ensure we are in sorting mode
    await p.waitForLogContains('Radix sort started. Use Next Step to proceed.');

    // Click Reset to go back to Idle
    await p.clickReset();

    // The log should show the ready message again
    await expect(p.logArea).toHaveText('Ready to start radix sort.');

    // Controls after resetAll should be enabled (setControlsDisabled(false) called in resetAll)
    // But the script calls setControlsDisabled(false) making start enabled; however at the end of init they call setControlsDisabled(true) only at load.
    // Here, after reset, expected behavior per implementation: start enabled
    expect(await p.isStartDisabled()).toBe(false);

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: invalid input triggers alert and does not start sorting', async ({ page }) => {
    // Validate the app handles invalid input by showing alert dialogs and not progressing into Sorting state.
    const p = new RadixPage(page);
    await p.goto();

    // Ensure start is enabled via reset
    await p.clickReset();
    expect(await p.isStartDisabled()).toBe(false);

    // Provide an invalid token in the input
    await p.fillInput('12 abc 34');

    // Listen for the dialog and capture its message
    let dialogMessage = null;
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Click start which should cause an alert for invalid input
    await p.clickStart();

    // Wait briefly for dialog handler to run
    await page.waitForTimeout(200);

    expect(dialogMessage).toContain('Invalid input: "abc"');

    // Ensure we did not proceed to sorting - log should remain as either initial start message or not show sorting start
    const log = await p.getLogText();
    // The implementation only logs 'Radix sort started...' when successful, so ensure that's not present
    expect(log).not.toContain('Radix sort started. Use Next Step to proceed.');

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test.afterEach(async ({}, testInfo) => {
    // Final assertion to ensure no unexpected uncaught exceptions happened in any test.
    // Note: We intentionally capture pageErrors in each test and assert length === 0 where appropriate.
    // This afterEach can log console messages for debugging if a test failed.
    if (testInfo.status !== testInfo.expectedStatus) {
      // Print console messages for debugging in case of failure
      // (Playwright test runner will capture stdout)
      console.log('Captured console messages:', consoleMessages);
      console.log('Captured page errors:', pageErrors.map(e => String(e)));
    }
  });
});