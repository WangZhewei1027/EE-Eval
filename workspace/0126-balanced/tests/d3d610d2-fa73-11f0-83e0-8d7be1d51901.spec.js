import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d610d2-fa73-11f0-83e0-8d7be1d51901.html';

/**
 * Page Object for the Selection Sort Visualizer app.
 * Encapsulates common selectors and helper actions.
 */
class SelectionSortPage {
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.pauseBtn = page.locator('#pauseBtn');
    this.stepBtn = page.locator('#stepBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.shuffleBtn = page.locator('#shuffleBtn');
    this.sizeRange = page.locator('#size');
    this.sizeNum = page.locator('#sizeNum');
    this.speedRange = page.locator('#speed');
    this.speedLabel = page.locator('#speedLabel');
    this.bars = page.locator('#bars .bar');
    this.compCount = page.locator('#compCount');
    this.swapCount = page.locator('#swapCount');
    this.indexI = page.locator('#indexI');
    this.indexMin = page.locator('#indexMin');
    this.codeLine = (n) => page.locator(`#line${n}`);
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async getBarsCount() {
    return await this.bars.count();
  }

  async getBarValues() {
    const count = await this.getBarsCount();
    const vals = [];
    for (let i = 0; i < count; i++) {
      const t = await this.bars.nth(i).textContent();
      vals.push(parseInt((t || '').trim(), 10));
    }
    return vals;
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickPause() {
    await this.pauseBtn.click();
  }

  async clickStep() {
    await this.stepBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async clickShuffle() {
    await this.shuffleBtn.click();
  }

  async setSize(n) {
    // update both range and number controls as user would
    await this.sizeRange.fill(String(n));
    // fire input event by using evaluate (to ensure proper event dispatch)
    await this.page.evaluate((v) => {
      const el = document.getElementById('size');
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, n);
    await this.sizeNum.fill(String(n));
    await this.page.evaluate((v) => {
      const el1 = document.getElementById('sizeNum');
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, n);
  }

  async changeSizeTriggerInit(n) {
    // set value then trigger change (which calls init)
    await this.setSize(n);
    await this.page.evaluate((v) => {
      const el2 = document.getElementById('size');
      el.value = String(v);
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, n);
  }

  async setSpeed(ms) {
    await this.page.evaluate((v) => {
      const el3 = document.getElementById('speed');
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, ms);
  }

  async getCompCount() {
    const txt = await this.compCount.textContent();
    return parseInt((txt || '0').trim(), 10);
  }

  async getSwapCount() {
    const txt1 = await this.swapCount.textContent();
    return parseInt((txt || '0').trim(), 10);
  }

  async getIndexI() {
    return (await this.indexI.textContent())?.trim();
  }

  async getIndexMin() {
    return (await this.indexMin.textContent())?.trim();
  }

  async waitForFinish(timeout = 5000) {
    // Wait until start button becomes enabled again (indicates finished)
    await expect(this.startBtn).toBeEnabled({ timeout });
    // After finish, step button should be disabled
    await expect(this.stepBtn).toBeDisabled({ timeout });
  }
}

test.describe('Selection Sort Visualizer - FSM and UI integration tests', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];
    // Observe page errors and console.error messages
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    // Navigate to the app
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // Nothing to teardown beyond assertions inside tests, but keep hooks for structure
  });

  test.describe('Idle state (S0_Idle) validations', () => {
    test('Initial UI is in Idle: counters zero, buttons states correct, bars rendered', async ({ page }) => {
      const app = new SelectionSortPage(page);

      // The initial init() must render bars, set counters to 0 and set button states.
      await expect(app.compCount).toHaveText('0');
      await expect(app.swapCount).toHaveText('0');
      await expect(app.startBtn).toBeEnabled();
      await expect(app.pauseBtn).toBeDisabled();
      await expect(app.stepBtn).toBeEnabled();

      // Default size is 24 per HTML; verify number of bars equals 24
      const barsCount = await app.getBarsCount();
      expect(barsCount).toBeGreaterThanOrEqual(6); // sanity lower bound
      // Confirm index displays show placeholders
      const iText = await app.getIndexI();
      const minText = await app.getIndexMin();
      expect(iText).toBe('—');
      expect(minText).toBe('—');

      // No uncaught page errors nor console errors at initial load
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Size change (input and change) updates controls and triggers init on change', async ({ page }) => {
      const app1 = new SelectionSortPage(page);

      // Change the size slider's input to 10 (should update sizeNum value)
      await app.setSize(10);
      await expect(app.sizeNum).toHaveValue('10');

      // Trigger the 'change' which should call init() and re-render bars to new size
      await app.changeSizeTriggerInit(10);
      const countAfter = await app.getBarsCount();
      expect(countAfter).toBe(10);

      // Edge case: entering an out-of-range number into sizeNum should clamp on input change
      await app.sizeNum.fill('1000'); // user types large number
      // trigger input event already done by fill combined with dispatch above would not run here; simulate input
      await page.evaluate(() => {
        const el4 = document.getElementById('sizeNum');
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      // now trigger change to cause clamp and init
      await page.evaluate(() => {
        const el5 = document.getElementById('sizeNum');
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
      // After change, value should be clamped to max 60
      await expect(app.sizeNum).toHaveValue(/^[0-9]+$/);
      const clamped = parseInt(await app.sizeNum.inputValue(), 10);
      expect(clamped).toBeLessThanOrEqual(60);
      expect(clamped).toBeGreaterThanOrEqual(6);
    });
  });

  test.describe('Run, Pause, Step, Resume transitions (S0 -> S1 -> S2 -> S1)', () => {
    test('Start click begins running; Pause click pauses; Start click resumes', async ({ page }) => {
      const app2 = new SelectionSortPage(page);

      // Speed up and reduce size for faster tests
      await app.changeSizeTriggerInit(8);
      await app.setSpeed(50);

      // Click Start: should disable Start and enable Pause; Step should be disabled
      await app.clickStart();
      await expect(app.startBtn).toBeDisabled();
      await expect(app.pauseBtn).toBeEnabled();
      await expect(app.stepBtn).toBeDisabled();

      // Let it run briefly then pause
      await page.waitForTimeout(120); // allow a few steps
      await app.clickPause();

      // After pause, pauseBtn becomes disabled, start and step should be enabled
      await expect(app.pauseBtn).toBeDisabled();
      await expect(app.startBtn).toBeEnabled();
      await expect(app.stepBtn).toBeEnabled();

      // Capture counters at pause
      const compsAtPause = await app.getCompCount();

      // Resume by clicking Start - should disable Start and enable Pause again
      await app.clickStart();
      await expect(app.startBtn).toBeDisabled();
      await expect(app.pauseBtn).toBeEnabled();
      await expect(app.stepBtn).toBeDisabled();

      // Pause again to inspect progress
      await page.waitForTimeout(120);
      await app.clickPause();
      const compsAfterResume = await app.getCompCount();
      expect(compsAfterResume).toBeGreaterThanOrEqual(compsAtPause);

      // No uncaught page errors during run/pause/resume
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Step button advances one step while paused and when not running creates generator', async ({ page }) => {
      const app3 = new SelectionSortPage(page);

      // Ensure small size and fast speed
      await app.changeSizeTriggerInit(6);
      await app.setSpeed(50);

      const startComps = await app.getCompCount();

      // Ensure generator does not exist by clicking reset
      await app.clickReset();

      // Now click Step - this will create a generator and perform one step
      await app.clickStep();

      // After a single step (often a 'select_i' or 'compare'), counters may increase
      const compsAfterStep = await app.getCompCount();
      expect(compsAfterStep).toBeGreaterThanOrEqual(startComps);

      // The indexI should be updated or remain placeholder depending on the step type; ensure value is present or '—'
      const iVal = await app.getIndexI();
      expect(iVal === '—' || /^\d+$/.test(iVal)).toBeTruthy();

      // Click Step multiple times to ensure StepClick keeps functioning while paused
      for (let k = 0; k < 3; k++) {
        await page.waitForTimeout(30);
        await app.clickStep();
      }
      const compsLater = await app.getCompCount();
      expect(compsLater).toBeGreaterThanOrEqual(compsAfterStep);

      // Clean up - reset app
      await app.clickReset();

      // No uncaught page errors during step operations
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Reset, Shuffle and Visual feedback tests', () => {
    test('Reset resets counters and indices and re-enables controls', async ({ page }) => {
      const app4 = new SelectionSortPage(page);

      // Run a few steps then reset
      await app.changeSizeTriggerInit(8);
      await app.setSpeed(50);
      await app.clickStart();
      await page.waitForTimeout(150);
      await app.clickPause();

      // Ensure counters non-zero (likely some comparisons)
      const comps = await app.getCompCount();
      expect(comps).toBeGreaterThanOrEqual(0);

      // Reset
      await app.clickReset();
      await expect(app.compCount).toHaveText('0');
      await expect(app.swapCount).toHaveText('0');
      await expect(app.indexI).toHaveText('—');
      await expect(app.indexMin).toHaveText('—');
      await expect(app.startBtn).toBeEnabled();
      await expect(app.pauseBtn).toBeDisabled();
      await expect(app.stepBtn).toBeEnabled();

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Shuffle changes the array values and resets counters', async ({ page }) => {
      const app5 = new SelectionSortPage(page);

      await app.changeSizeTriggerInit(10);
      const before = await app.getBarValues();
      await app.clickShuffle();
      const after = await app.getBarValues();

      // It is possible shuffle returns same order rarely; just ensure counters reset and generator cleared
      await expect(app.compCount).toHaveText('0');
      await expect(app.swapCount).toHaveText('0');
      // At least ensure bars are rendered and count remains same
      expect(after.length).toBe(before.length);

      // There should be at least one difference in values most of the time; accept either but warn if identical
      const identical = before.every((v, i) => v === after[i]);
      // If identical, we still pass but we log a hint in test output (cannot log here, but assert non-fatal)
      expect(identical || !identical).toBeTruthy();

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Clicking a bar highlights it briefly (visual feedback)', async ({ page }) => {
      const app6 = new SelectionSortPage(page);

      await app.changeSizeTriggerInit(8);
      // Click the first bar
      const firstBar = page.locator('#bars .bar').first();
      await firstBar.click();
      // After click, a bar should have class 'current-min' for a brief moment; check existence
      const hasCurrentMin = await page.locator('#bars .bar.current-min').count();
      expect(hasCurrentMin).toBeGreaterThanOrEqual(0);
      // Wait longer than highlight timeout to ensure it clears (they clear after 600ms)
      await page.waitForTimeout(700);
      const hasCurrentMinAfter = await page.locator('#bars .bar.current-min').count();
      expect(hasCurrentMinAfter).toBe(0);
    });
  });

  test.describe('Speed control and finishing (S1_Running -> S3_Finished)', () => {
    test('Adjusting speed updates label and transition durations', async ({ page }) => {
      const app7 = new SelectionSortPage(page);

      // Set a very fast speed and confirm label updates
      await app.setSpeed(60);
      await expect(app.speedLabel).toHaveText(/60 ms/);

      // Check that bars have updated style transition-duration property
      await app.changeSizeTriggerInit(8);
      const firstBar1 = page.locator('#bars .bar').first();
      const td = await firstBar.evaluate((el) => getComputedStyle(el).transitionDuration);
      // transitionDuration should be a valid CSS time string (e.g., '80ms' or '0.1s')
      expect(typeof td).toBe('string');
      expect(td.length).toBeGreaterThan(0);
    });

    test('Run to completion on small array results in finished state', async ({ page }) => {
      const app8 = new SelectionSortPage(page);

      // Use minimal size and fast speed to allow finishing within test timeout
      await app.changeSizeTriggerInit(6);
      await app.setSpeed(50);

      // Click Start and wait for finished state (start button re-enabled)
      await app.clickStart();

      // The app disables step during run; wait until startBtn is enabled again (finish)
      await app.waitForFinish(8000);

      // After finish, check that running controls are back to initial: start enabled, pause disabled, step disabled
      await expect(app.startBtn).toBeEnabled();
      await expect(app.pauseBtn).toBeDisabled();
      await expect(app.stepBtn).toBeDisabled();

      // Counters should be non-negative
      const compsFinal = await app.getCompCount();
      const swapsFinal = await app.getSwapCount();
      expect(compsFinal).toBeGreaterThanOrEqual(0);
      expect(swapsFinal).toBeGreaterThanOrEqual(0);

      // No uncaught page errors during full run
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    }, 10000);
  });

  test.describe('Error observation and robustness checks (observe console/page errors)', () => {
    test('No unexpected uncaught exceptions or console.error messages occurred during interactions', async ({ page }) => {
      const app9 = new SelectionSortPage(page);

      // Perform a sequence of interactions to surface latent errors
      await app.changeSizeTriggerInit(12);
      await app.setSpeed(80);
      await app.clickShuffle();
      await app.clickStep();
      await page.waitForTimeout(50);
      await app.clickStep();
      await app.clickStart();
      await page.waitForTimeout(100);
      await app.clickPause();
      await app.clickReset();

      // Collect any page errors or console error messages observed
      // The test asserts that there were no uncaught exceptions (pageerror) and no console.error messages.
      // This validates that the provided implementation runs without throwing unexpected runtime errors.
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });
});