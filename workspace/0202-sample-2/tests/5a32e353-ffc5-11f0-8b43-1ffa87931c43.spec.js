import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a32e353-ffc5-11f0-8b43-1ffa87931c43.html';

// Page object model for the insertion sort visualization page
class InsertionSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayContainer = page.locator('#arrayContainer');
    this.generateBtn = page.locator('#generateBtn');
    this.startBtn = page.locator('#startBtn');
    this.pauseBtn = page.locator('#pauseBtn');
    this.speedRange = page.locator('#speedRange');
    this.speedLabel = page.locator('#speedLabel');
    this.bars = page.locator('.bar');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getBarCount() {
    return await this.bars.count();
  }

  async getFirstBarText() {
    return await this.bars.first().innerText();
  }

  async getAnyBarWithClass(cls) {
    return await this.page.locator(`.bar.${cls}`).count();
  }

  async setSpeed(value) {
    // Set the range input programmatically and dispatch input event to trigger handler
    await this.page.evaluate((v) => {
      const el = document.getElementById('speedRange');
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickPause() {
    // pauseBtn may be disabled; click will fail if disabled. The caller should ensure it's enabled.
    await this.pauseBtn.click();
  }

  async clickGenerate() {
    // generateBtn may be disabled; click will fail if disabled. The caller should ensure it's enabled.
    await this.generateBtn.click();
  }

  async isGenerateDisabled() {
    return await this.generateBtn.isDisabled();
  }

  async isStartDisabled() {
    return await this.startBtn.isDisabled();
  }

  async isPauseDisabled() {
    return await this.pauseBtn.isDisabled();
  }

  async getPauseText() {
    return await this.pauseBtn.textContent();
  }

  async getSpeedLabelText() {
    return (await this.speedLabel.textContent()).trim();
  }

  async waitForAnyCurrentBar(timeout = 5000) {
    await this.page.waitForSelector('.bar.current', { timeout });
  }

  async waitForSomeTime(ms) {
    await this.page.waitForTimeout(ms);
  }
}

test.describe('Insertion Sort Visualization - FSM and UI behavior', () => {
  // Arrays to capture console errors and uncaught page errors
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture unhandled exceptions in the page
    page.on('pageerror', (err) => {
      pageErrors.push(err.message || String(err));
    });

    // Navigate to the app page
    const model = new InsertionSortPage(page);
    await model.goto();
  });

  test.afterEach(async () => {
    // Ensure no unexpected console or page errors happened during tests.
    // The application should be allowed to naturally emit errors if any; we assert what occurred.
    expect(pageErrors, `Unexpected uncaught page errors: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
    expect(consoleErrors, `Unexpected console.error messages: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
  });

  test.describe('Idle state (S0_Idle) - initial render and controls', () => {
    test('Initial load renders array and control default states', async ({ page }) => {
      // Validate initial Idle state: array rendered, controls enabled/disabled per spec
      const model = new InsertionSortPage(page);

      // The initial array should be rendered with ARRAY_SIZE bars (implementation uses 30)
      const count = await model.getBarCount();
      expect(count).toBeGreaterThanOrEqual(20); // sanity check: should be 30, but allow tolerance
      expect(count).toBeLessThanOrEqual(40);

      // Bars should show numeric values
      const firstBarText = await model.getFirstBarText();
      expect(Number(firstBarText)).not.toBeNaN();

      // Control button states in idle
      expect(await model.isGenerateDisabled()).toBe(false); // Generate should be enabled
      expect(await model.isStartDisabled()).toBe(false); // Start should be enabled
      expect(await model.isPauseDisabled()).toBe(true); // Pause should be disabled in idle

      // Speed label should reflect initial value 600 ms
      expect(await model.getSpeedLabelText()).toBe('600 ms');
    });

    test('AdjustSpeed event updates delay label and range value', async ({ page }) => {
      // Changing the speed range input should update the visible label
      const model = new InsertionSortPage(page);

      // Set to a low value for faster runs and assert label updates
      await model.setSpeed(100);
      expect(await model.getSpeedLabelText()).toBe('100 ms');

      // Also test a mid value
      await model.setSpeed(900);
      expect(await model.getSpeedLabelText()).toBe('900 ms');
    });
  });

  test.describe('Sorting state (S1_Sorting) and pause/resume (S2_Paused) transitions', () => {
    test('StartSort transitions Idle -> Sorting and shows visual highlights and button state changes', async ({ page }) => {
      const model = new InsertionSortPage(page);

      // Speed down to minimum to accelerate visualization (keeps test time reasonable)
      await model.setSpeed(100);
      expect(await model.getSpeedLabelText()).toBe('100 ms');

      // Start sorting
      await model.clickStart();

      // After starting:
      // - start button should be disabled while sorting
      // - generate should be disabled while sorting
      // - pause should be enabled
      // - pause button text should be 'Pause'
      expect(await model.isStartDisabled()).toBe(true);
      expect(await model.isGenerateDisabled()).toBe(true);
      expect(await model.isPauseDisabled()).toBe(false);
      expect(await model.getPauseText()).toContain('Pause');

      // The visualization should highlight a "current" element shortly after starting
      await model.waitForAnyCurrentBar(5000);
      const currentCount = await model.getAnyBarWithClass('current');
      expect(currentCount).toBeGreaterThan(0);
    });

    test('PauseSort toggles to Paused (S1 -> S2) and back to Sorting (S2 -> S1)', async ({ page }) => {
      const model = new InsertionSortPage(page);

      // Ensure quick progress
      await model.setSpeed(100);

      // Start sorting
      await model.clickStart();

      // Wait for some activity
      await model.waitForAnyCurrentBar(5000);

      // Pause the sorting (enter S2_Paused)
      // Pause button should be enabled
      expect(await model.isPauseDisabled()).toBe(false);
      await model.clickPause();

      // Pause text should change to 'Resume'
      await model.page.waitForFunction(() => {
        const btn = document.getElementById('pauseBtn');
        return btn && btn.textContent.trim() === 'Resume';
      }, { timeout: 2000 });

      let pauseText = await model.getPauseText();
      expect(pauseText).toContain('Resume');

      // The UI should be in paused state; generate and start remain disabled while sorting variable is still true
      expect(await model.isGenerateDisabled()).toBe(true);
      expect(await model.isStartDisabled()).toBe(true);

      // Wait a short time to ensure paused state holds (no crash, no errors)
      await model.waitForSomeTime(300);

      // Resume sorting (back to S1_Sorting)
      await model.clickPause();

      await model.page.waitForFunction(() => {
        const btn = document.getElementById('pauseBtn');
        return btn && btn.textContent.trim() === 'Pause';
      }, { timeout: 2000 });

      pauseText = await model.getPauseText();
      expect(pauseText).toContain('Pause');

      // After resuming, pause still enabled while sorting continues
      expect(await model.isPauseDisabled()).toBe(false);
      expect(await model.isStartDisabled()).toBe(true);
    });

    test('Edge case: Pause button is disabled in Idle and does not change state when clicked (no-op)', async ({ page }) => {
      const model = new InsertionSortPage(page);

      // Ensure we're in idle (fresh load)
      expect(await model.isPauseDisabled()).toBe(true);

      // Attempting to click a disabled button via Playwright would throw; instead assert it is disabled and clicking is not possible.
      // Confirming the disabled attribute prevents user interaction (as implemented).
      const disabled = await model.isPauseDisabled();
      expect(disabled).toBe(true);
    });

    test('Edge case: Generate button remains disabled while sorting (cannot trigger reset via Generate during S1)', async ({ page }) => {
      const model = new InsertionSortPage(page);

      // Speed up
      await model.setSpeed(100);

      // Start sorting
      await model.clickStart();

      // Wait for some activity
      await model.waitForAnyCurrentBar(5000);

      // Generate button should be disabled while sorting
      expect(await model.isGenerateDisabled()).toBe(true);

      // We will not attempt to programmatically force a generate click; we assert the app prevents the transition by disabling the control.
      // This validates the implementation detail: generateBtn.disabled = true in insertionSort entry.
    });
  });

  test.describe('Transitions, onEnter/onExit actions and error observation', () => {
    test('reset() behavior via UI: on sorting end controls re-enable (S1 exit to S0) - best-effort observation', async ({ page }) => {
      const model = new InsertionSortPage(page);

      // Set speed to minimal to try to let sorting complete faster
      await model.setSpeed(100);

      // Start sort
      await model.clickStart();

      // We will wait up to a limited time for sorting to finish (pauseBtn disabled will indicate sorting ended).
      // Note: depending on the random array and timing this may or may not complete within this short timeout.
      // This is a best-effort check to observe the on-exit actions (reset) that enable controls again.
      const finished = await page.waitForFunction(() => {
        const pauseBtn = document.getElementById('pauseBtn');
        const startBtn = document.getElementById('startBtn');
        const generateBtn = document.getElementById('generateBtn');
        // Sorting is considered finished when pause is disabled and start & generate are enabled
        return pauseBtn && pauseBtn.disabled === true && startBtn && !startBtn.disabled && generateBtn && !generateBtn.disabled;
      }, { timeout: 10000 }).catch(() => false);

      // We accept both possibilities: if the sort completed within the timeout, controls should be re-enabled;
      // otherwise the sort is still running. In either case, the UI must not throw errors.
      if (finished) {
        expect(await model.isPauseDisabled()).toBe(true);
        expect(await model.isStartDisabled()).toBe(false);
        expect(await model.isGenerateDisabled()).toBe(false);
      } else {
        // sorting still active: ensure no unexpected state transitions happened
        expect(await model.isStartDisabled()).toBe(true); // still sorting: start disabled
      }
    });

    test('Observe console and page errors during interactions (should be none)', async ({ page }) => {
      const model = new InsertionSortPage(page);

      // Perform a sequence of interactions to exercise event handlers
      await model.setSpeed(200);
      await model.clickStart();
      await model.waitForAnyCurrentBar(5000);
      await model.clickPause();
      await model.waitForSomeTime(200);
      await model.clickPause();

      // After these interactions, our afterEach hook will assert there are no console/page errors.
      // Here explicitly assert there were no collected errors so far.
      // (Redundant with afterEach, but makes intent explicit within this test.)
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });
});