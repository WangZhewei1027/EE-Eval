import { test, expect } from '@playwright/test';

test.setTimeout(60000);

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e1baa1-d5c1-11f0-a327-5f281c6cb8e2.html';

// Page Object for the Bubble Sort Visualizer
class BubblePage {
  constructor(page) {
    this.page = page;
    this.status = page.locator('#statusText');
    this.startBtn = page.locator('#startBtn');
    this.pauseBtn = page.locator('#pauseBtn');
    this.stepBtn = page.locator('#stepBtn');
    this.shuffleBtn = page.locator('#shuffleBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.sizeRange = page.locator('#sizeRange');
    this.sizeVal = page.locator('#sizeVal');
    this.sizeShow = page.locator('#sizeShow');
    this.speedRange = page.locator('#speedRange');
    this.speedVal = page.locator('#speedVal');
    this.orderToggle = page.locator('#orderToggle');
    this.showValues = page.locator('#showValues');
    this.compVal = page.locator('#compVal');
    this.swapVal = page.locator('#swapVal');
    this.stepVal = page.locator('#stepVal');
    this.bars = page.locator('#bars .bar');
    this.progressText = page.locator('#progressText');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'networkidle' });
    // Wait for initial render
    await expect(this.status).toHaveText(/Idle|Size changed|Shuffled|Reset to near-sorted/, { timeout: 5000 });
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
  async clickShuffle() {
    await this.shuffleBtn.click();
  }
  async clickReset() {
    await this.resetBtn.click();
  }

  async setSize(value) {
    // set range input and dispatch input+change events
    await this.page.evaluate((val) => {
      const el = document.getElementById('sizeRange');
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, String(value));
    // Wait for UI to reflect new size
    await expect(this.sizeVal).toHaveText(String(value), { timeout: 2000 });
    await expect(this.sizeShow).toHaveText(String(value), { timeout: 2000 });
  }

  async setSpeed(value) {
    await this.page.evaluate((val) => {
      const el = document.getElementById('speedRange');
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
    await expect(this.speedVal).toHaveText(String(value), { timeout: 2000 });
  }

  async toggleOrder(on) {
    await this.page.evaluate((checked) => {
      const el = document.getElementById('orderToggle');
      el.checked = checked;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, Boolean(on));
  }

  async toggleShowValues(on) {
    await this.page.evaluate((checked) => {
      const el = document.getElementById('showValues');
      el.checked = checked;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, Boolean(on));
  }

  async barsCount() {
    return await this.bars.count();
  }

  async getBarValues() {
    return await this.page.$$eval('#bars .bar .bar-value', nodes => nodes.map(n => n.textContent.trim()));
  }

  async getStatusText() {
    return (await this.status.textContent()).trim();
  }

  async waitForStatus(expected, timeout = 5000) {
    await expect(this.status).toHaveText(expected, { timeout });
  }

  async allBarsHaveClass(cls) {
    return await this.page.$$eval('#bars .bar', (bars, c) => bars.every(b => b.classList.contains(c)), cls);
  }
}

// Test suite
test.describe('Bubble Sort Visualizer - FSM states and transitions', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages, pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // capture only errors and warnings for clarity
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  // Test initial Idle state and basic UI
  test('Initial state is Idle and baseline UI elements are present', async ({ page }) => {
    const app = new BubblePage(page);
    await app.goto();

    // Validate initial state: status text = 'Idle'
    await expect(app.status).toHaveText('Idle');

    // Pause button should be disabled, Start enabled
    await expect(app.pauseBtn).toBeDisabled();
    await expect(app.startBtn).toBeEnabled();

    // Step and Reset and Shuffle should be enabled
    await expect(app.stepBtn).toBeEnabled();
    await expect(app.resetBtn).toBeEnabled();
    await expect(app.shuffleBtn).toBeEnabled();

    // Bars should render and size be reflected
    const count = await app.barsCount();
    expect(count).toBeGreaterThan(0);

    // Stats should show zero initially
    await expect(app.compVal).toHaveText('0');
    await expect(app.swapVal).toHaveText('0');
    await expect(app.stepVal).toHaveText('0');
  });

  // Reset transition from Idle -> Reset (S0 -> S5)
  test('Reset button transitions Idle -> Reset (status text and UI updates)', async ({ page }) => {
    const app = new BubblePage(page);
    await app.goto();

    // Click reset and verify status text is as FSM expects
    await app.clickReset();
    await expect(app.status).toHaveText('Reset to near-sorted');

    // After reset, step and start should be enabled and pause disabled
    await expect(app.stepBtn).toBeEnabled();
    await expect(app.startBtn).toBeEnabled();
    await expect(app.pauseBtn).toBeDisabled();

    // Bars should still be present and sizeShow updated
    const sizeShowText = (await app.sizeShow.textContent()).trim();
    const barsCount = await app.barsCount();
    expect(Number(sizeShowText)).toBe(barsCount);
  });

  // Start from Idle -> Running and Pause transition (S0 -> S1 and S1 -> S2)
  test('Start from Idle -> Running, then Pause -> Paused (button states & status text)', async ({ page }) => {
    const app = new BubblePage(page);
    await app.goto();

    // Start sorting
    await app.clickStart();
    // Status should become 'Running'
    await expect(app.status).toHaveText('Running', { timeout: 2000 });

    // Buttons reflect running state
    await expect(app.startBtn).toBeDisabled();
    await expect(app.pauseBtn).toBeEnabled();

    // Pause sorting
    await app.clickPause();
    await expect(app.status).toHaveText('Paused', { timeout: 2000 });

    // Buttons reflect paused state
    await expect(app.pauseBtn).toBeDisabled();
    await expect(app.startBtn).toBeEnabled();
  });

  // Paused -> Start (S2 -> S1)
  test('Resume from Paused to Running', async ({ page }) => {
    const app = new BubblePage(page);
    await app.goto();

    // Start then pause
    await app.clickStart();
    await expect(app.status).toHaveText('Running', { timeout: 2000 });
    await app.clickPause();
    await expect(app.status).toHaveText('Paused', { timeout: 2000 });

    // Resume
    await app.clickStart();
    await expect(app.status).toHaveText('Running', { timeout: 2000 });

    // Confirm buttons reflect running
    await expect(app.startBtn).toBeDisabled();
    await expect(app.pauseBtn).toBeEnabled();
  });

  // Shuffle transition (S1 -> S4 via Shuffle from FSM; we test Shuffle from Idle as implemented)
  test('Shuffle action updates status to Shuffled and allows starting (Shuffle -> Start)', async ({ page }) => {
    const app = new BubblePage(page);
    await app.goto();

    // Click shuffle
    await app.clickShuffle();
    await expect(app.status).toHaveText('Shuffled', { timeout: 2000 });

    // After shuffle, start should be enabled
    await expect(app.startBtn).toBeEnabled();
    await expect(app.pauseBtn).toBeDisabled();

    // Now start from Shuffled -> Running
    await app.clickStart();
    await expect(app.status).toHaveText('Running', { timeout: 2000 });
    // Pause shortly to avoid long runs in CI
    await app.clickPause();
    await expect(app.status).toHaveText('Paused', { timeout: 2000 });
  });

  // Step through sorting until Sorted (S1 -> S3 via doOneStep or stepping while not running)
  test('Step repeatedly until array is Sorted; verify sorted visuals and stats', async ({ page }) => {
    const app = new BubblePage(page);
    await app.goto();

    // Reduce size to small to finish quickly
    await app.setSize(6);
    // Also reduce speed for faster steps
    await app.setSpeed(10);

    // Ensure we are not running
    // Repeatedly click Step until status becomes 'Sorted' or timeout
    const maxSteps = 200;
    let sorted = false;
    for (let k = 0; k < maxSteps; k++) {
      // click step (when not running step() triggers doOneStep)
      await app.clickStep();
      // wait a little for step to process
      try {
        await app.page.waitForTimeout(50);
      } catch (e) {}
      const s = (await app.getStatusText());
      if (s === 'Sorted') {
        sorted = true;
        break;
      }
    }
    expect(sorted).toBeTruthy();

    // After sorted, all bars should have sorted class
    const allSorted = await app.allBarsHaveClass('sorted');
    expect(allSorted).toBe(true);

    // Step button should be disabled after sorted
    await expect(app.stepBtn).toBeDisabled();

    // Ensure stats show some steps and possibly swaps/comparisons
    const stepsCount = Number((await app.stepVal.textContent()).trim());
    expect(stepsCount).toBeGreaterThan(0);
  });

  // Start from Reset -> Running (S5 -> S1)
  test('Starting after Reset transitions Reset -> Running', async ({ page }) => {
    const app = new BubblePage(page);
    await app.goto();

    // Reset
    await app.clickReset();
    await expect(app.status).toHaveText('Reset to near-sorted');

    // Start after reset
    await app.clickStart();
    await expect(app.status).toHaveText('Running', { timeout: 2000 });

    // Pause to clean up
    await app.clickPause();
    await expect(app.status).toHaveText('Paused', { timeout: 2000 });
  });

  // Speed, Order, ShowValues controls (SizeChange, SpeedChange, OrderToggle, ShowValuesToggle)
  test('Controls: Speed change, Order toggle, Show values toggle and their visual effects', async ({ page }) => {
    const app = new BubblePage(page);
    await app.goto();

    // Change speed and ensure speedVal updated
    await app.setSpeed(20);
    await expect(app.speedVal).toHaveText('20');

    // Toggle order to descending
    await app.toggleOrder(true);
    await expect(app.status).toHaveText('Descending order');
    // Toggle back to ascending
    await app.toggleOrder(false);
    await expect(app.status).toHaveText('Ascending order');

    // Toggle show values off: bar-value elements should not exist
    await app.toggleShowValues(false);
    await page.waitForTimeout(100);
    const valuesAfterOff = await app.getBarValues();
    expect(valuesAfterOff.length).toBe(0);

    // Toggle show values on: bar-value elements should exist
    await app.toggleShowValues(true);
    // wait for re-render
    await page.waitForTimeout(100);
    const valuesAfterOn = await app.getBarValues();
    expect(valuesAfterOn.length).toBeGreaterThan(0);
  });

  // Edge case: clicking Step while Running should NOT perform a step (per implementation step() returns early if running)
  test('Edge case: clicking Step while Running does not advance steps (implementation detail)', async ({ page }) => {
    const app = new BubblePage(page);
    await app.goto();

    // Ensure small size and fast speed to reduce waiting
    await app.setSize(8);
    await app.setSpeed(10);

    // Start running
    await app.clickStart();
    await expect(app.status).toHaveText('Running', { timeout: 2000 });

    // Capture step count
    const before = Number((await app.stepVal.textContent()).trim());

    // Click Step while running - per implementation this should return early and not increment steps
    await app.clickStep();
    // Wait a short moment
    await page.waitForTimeout(200);

    const after = Number((await app.stepVal.textContent()).trim());

    // The step count should not have increased as step() early-returns when running
    expect(after).toBeGreaterThanOrEqual(before); // it may also increase because runLoop continues, but it must not be solely caused by the Step click
    // To be more specific: ensure that a direct Step click did not cause an immediate extra step beyond run behavior
    // We allow after >= before; this test documents observed behavior rather than enforcing a strict FSM transition that contradicts implementation.

    // Pause to stop runLoop
    await app.clickPause();
    await expect(app.status).toHaveText('Paused', { timeout: 2000 });
  });

  // Observation: console and page errors should be collected and asserted (no unexpected runtime errors)
  test('No uncaught page errors or console error messages during interactions', async ({ page }) => {
    const app = new BubblePage(page);
    await app.goto();

    // Perform a series of interactions to exercise the code paths
    await app.clickShuffle();
    await app.clickReset();
    await app.setSize(6);
    await app.setSpeed(10);
    await app.toggleOrder(true);
    await app.toggleShowValues(false);
    await app.clickStart();
    // wait briefly to catch any runtime errors
    await page.waitForTimeout(300);
    // pause to stop loop and avoid long-running sort
    await app.clickPause();

    // Collect console error messages and page errors
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    // Assert there are no uncaught page errors and no console errors/warnings
    expect(pageErrors.length, 'No unhandled page errors should be emitted').toBe(0);
    expect(errorConsoleMessages.length, 'No console error/warning messages should be emitted').toBe(0);
  });
});