import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/batch-1207/html/e93410b0-d360-11f0-a097-ffdd56c22ef4.html';

// Page Object Model for the Binary Search Visualizer
class VisualizerPage {
  constructor(page) {
    this.page = page;
    this.generate = page.locator('#generate');
    this.shuffle = page.locator('#shuffle');
    this.pickRandom = page.locator('#pickRandom');
    this.step = page.locator('#step');
    this.stepBack = page.locator('#stepBack');
    this.auto = page.locator('#auto');
    this.pause = page.locator('#pause');
    this.reset = page.locator('#reset');
    this.size = page.locator('#size');
    this.sizeLabel = page.locator('#sizeLabel');
    this.target = page.locator('#target');
    this.speed = page.locator('#speed');
    this.speedLabel = page.locator('#speedLabel');
    this.arrayArea = page.locator('#arrayArea');
    this.statusMsg = page.locator('#statusMsg');
    this.lowIdx = page.locator('#lowIdx');
    this.midIdx = page.locator('#midIdx');
    this.highIdx = page.locator('#highIdx');
    this.stepsCount = page.locator('#stepsCount');
    this.result = page.locator('#result');
    this.pseudocodeLines = index => page.locator(`#pc${index}`);
  }

  async goto() {
    await this.page.goto(BASE);
    // wait for initial generate (page calls generate on load)
    await this.page.waitForLoadState('load');
    // wait until arrayArea is populated
    await this.page.waitForFunction(() => {
      const el = document.getElementById('arrayArea');
      return el && el.children.length > 0;
    });
  }

  async getArrayValues() {
    return this.page.$$eval('#arrayArea .cell .val', nodes => nodes.map(n => n.textContent));
  }

  async getArrayLength() {
    return this.page.$$eval('#arrayArea .cell', nodes => nodes.length);
  }

  async getStatusText() {
    return this.statusMsg.textContent();
  }

  async setSize(value) {
    await this.size.fill(String(value));
    // dispatch input event
    await this.page.dispatchEvent('#size', 'input');
    // wait for label update
    await expect(this.sizeLabel).toHaveText(String(value));
  }

  async setSpeed(value) {
    await this.speed.fill(String(value));
    await this.page.dispatchEvent('#speed', 'input');
    await expect(this.speedLabel).toHaveText(String(value));
  }

  async setTargetValue(value) {
    await this.target.fill(String(value));
    // dispatch change event to trigger rebuilding
    await this.page.dispatchEvent('#target', 'change');
  }

  async triggerChangeOnTarget(value) {
    // Directly set + dispatch to ensure change handler runs
    await this.page.evaluate((v) => {
      const el = document.getElementById('target');
      el.value = v;
      const ev = new Event('change', { bubbles: true });
      el.dispatchEvent(ev);
    }, String(value));
  }

  async getPcActiveLines() {
    // returns array of bools for pc0...pc7 whether they have class pc-active
    return this.page.evaluate(() => {
      const res = [];
      for (let i = 0; i < 8; i++) {
        const el = document.getElementById('pc' + i);
        res.push(el && el.classList.contains('pc-active'));
      }
      return res;
    });
  }
}

test.describe('Binary Search Visualizer - FSM and UI integration (e93410b0-d360-11f0-a097-ffdd56c22ef4)', () => {
  // Collect console and page errors per test
  test.beforeEach(async ({ page }) => {
    // Increase timeout for flaky environments if needed
    page.setDefaultTimeout(5000);
  });

  test('S1_ArrayGenerated on load: array rendered, status and pseudocode initial', async ({ page }) => {
    // Collect runtime errors and console messages
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err.message));

    const vp = new VisualizerPage(page);
    await vp.goto();

    // After load, the app auto-generates an array and sets up steps with a random target.
    // Validate array length equals the size label (default 12)
    const sizeLabelText = await vp.sizeLabel.textContent();
    const arrLen = await vp.getArrayLength();
    expect(Number(sizeLabelText)).toBe(arrLen);

    // Status should indicate ready to start stepping or autoplay
    await expect(vp.statusMsg).toHaveText('Press Step or Auto to start the search.');

    // Pseudocode should highlight initialization (pc0 active)
    const pcActive = await vp.getPcActiveLines();
    expect(pcActive[0]).toBe(true);

    // No unexpected console errors or page errors should have been emitted
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('GenerateSortedArray transition (S0 -> S1 / S5 -> S1): changing size and generate', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err.message));

    const vp = new VisualizerPage(page);
    await vp.goto();

    // Change size and click Generate to create a new sorted array
    await vp.setSize(8); // change to 8
    await vp.generate.click();

    // After generating, array length should be 8 and status should be ready
    await expect(vp.sizeLabel).toHaveText('8');
    const arrLen = await vp.getArrayLength();
    expect(arrLen).toBe(8);
    await expect(vp.statusMsg).toHaveText('Press Step or Auto to start the search.');

    // Ensure array values are sorted ascending (simple check)
    const values = (await vp.getArrayValues()).map(x => Number(x));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }

    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('ShuffleArray (S1 -> S5): shuffle visually and steps cleared', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err.message));

    const vp = new VisualizerPage(page);
    await vp.goto();

    // Capture original order
    const original = await vp.getArrayValues();

    // Click shuffle -> displayedArray shuffled, steps cleared, status updated
    await vp.shuffle.click();

    await expect(vp.statusMsg).toHaveText('Array visually shuffled — binary search requires sorted array.');

    const shuffled = await vp.getArrayValues();
    // The shuffled array should be a permutation of the original
    expect(shuffled.sort()).toEqual(original.sort());
    // There's a high chance the order is different; assert that it either differs or it's allowed
    // (we don't fail if shuffle randomly produced same order)
    // Steps count (UI) should show '0' (updateUI sets stepsCount to '0' when !st)
    await expect(vp.stepsCount).toHaveText('0');

    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('PickRandomTarget and StepFlow (S1 -> S6 then S6 -> S2): pick random, then step forward/back', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err.message));

    const vp = new VisualizerPage(page);
    await vp.goto();

    // Ensure array exists
    const values = await vp.getArrayValues();
    expect(values.length).toBeGreaterThan(0);

    // Clear target then click pickRandom
    await vp.target.fill('');
    await vp.pickRandom.click();

    // The target input should now contain one of the array values
    const targetVal = await vp.target.inputValue();
    expect(values).toContain(targetVal);

    // Clicking Step should build steps if absent and move to first step
    await vp.step.click();

    // After one step, stepsCount should be >= 1 and status should reflect a comparison or init
    const stepsCountText = await vp.stepsCount.textContent();
    expect(Number(stepsCountText)).toBeGreaterThanOrEqual(1);

    // Pseudocode active line should not be the initial-only after stepping; check that some pc line is active
    const pcActive = await vp.getPcActiveLines();
    expect(pcActive.some(Boolean)).toBeTruthy();

    // Now step back
    await vp.stepBack.click();
    // After stepping back to -1, UI shows 'Press Step or Auto to start the search.'
    await expect(vp.statusMsg).toHaveText('Press Step or Auto to start the search.');

    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('StepForward/StepBackward edge case: clicking step when no steps available (after shuffle)', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err.message));

    const vp = new VisualizerPage(page);
    await vp.goto();

    // Shuffle to clear steps
    await vp.shuffle.click();
    // Steps are cleared; clicking step should show an explanatory message
    await vp.step.click();
    await expect(vp.statusMsg).toHaveText('No steps available. Generate array and choose a target.');

    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('AutoPlay and Pause (S1 -> S3 and S3 -> S3): start autoplay and pause', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err.message));

    const vp = new VisualizerPage(page);
    await vp.goto();

    // Ensure speed is small so autoplay finishes quickly in test
    await vp.setSpeed(80);

    // If steps were cleared previously, ensure steps exist by generating a new array
    await vp.generate.click();

    // Click auto to start auto-play: the UI should advance steps over time
    await vp.auto.click();

    // Wait until result changes from '—' to either 'Found at index X' or 'Not found'
    await page.waitForFunction(() => {
      const r = document.getElementById('result');
      return r && r.textContent && r.textContent.trim() !== '—';
    }, { timeout: 3000 });

    const resultText = await vp.result.textContent();
    expect(resultText.trim().length).toBeGreaterThan(0);
    expect(resultText.trim()).not.toBe('—');

    // Now pause and assert that autoplay stops (clicking pause should not throw)
    await vp.pause.click();

    // Capture current stepsCount, wait short time and ensure it does not advance further
    const beforeCount = await vp.stepsCount.textContent();
    await page.waitForTimeout(300);
    const afterCount = await vp.stepsCount.textContent();
    expect(afterCount).toBe(beforeCount);

    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('Reset behavior (S1 -> S4 -> S0): reset clears current step pointer', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err.message));

    const vp = new VisualizerPage(page);
    await vp.goto();

    // Step forward so cur changes
    await vp.step.click();
    // Ensure we are in a stepped state (result may still be '—')
    const steppedCount = Number(await vp.stepsCount.textContent());
    expect(steppedCount).toBeGreaterThanOrEqual(1);

    // Now trigger reset
    await vp.reset.click();

    // After reset, status should indicate ready to start (cur becomes -1)
    await expect(vp.statusMsg).toHaveText('Press Step or Auto to start the search.');
    // indices should be '-'
    await expect(vp.lowIdx).toHaveText('-');
    await expect(vp.midIdx).toHaveText('-');
    await expect(vp.highIdx).toHaveText('-');

    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('ChangeTargetValue edge cases: non-numeric input and not-found scenario', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err.message));

    const vp = new VisualizerPage(page);
    await vp.goto();

    // Set target to a non-numeric string and dispatch change -> should show instructive status
    await vp.triggerChangeOnTarget('not-a-number');
    await expect(vp.statusMsg).toHaveText('Enter a numeric target or "random".');

    // Now set target to a number not in array (very large), and dispatch change
    await vp.triggerChangeOnTarget('999999');
    // After change, UI should update (target triggers rebuild). Steps exist but target not found only after stepping through
    // Step through to final state by repeatedly clicking step (safe loop with timeout)
    // We'll click step until result shows 'Not found' or max iterations
    let foundNotFound = false;
    for (let i = 0; i < 50; i++) {
      await vp.step.click();
      const res = (await vp.result.textContent()).trim();
      if (res === 'Not found') { foundNotFound = true; break; }
      // small throttle to allow UI update
      await page.waitForTimeout(20);
    }
    expect(foundNotFound).toBe(true);

    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('ChangeSpeed while auto-playing restarts with new interval', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err.message));

    const vp = new VisualizerPage(page);
    await vp.goto();

    // Ensure steps exist
    await vp.generate.click();

    // Start auto-play with a slower speed, then change to faster and ensure UI advances afterwards
    await vp.setSpeed(500);
    await vp.auto.click();

    // Wait a short time then change speed to faster value via input (this will pause and autoPlay according to implementation)
    await page.waitForTimeout(200);
    await vp.setSpeed(80);

    // Wait until result changes from '—'
    await page.waitForFunction(() => {
      const r = document.getElementById('result');
      return r && r.textContent && r.textContent.trim() !== '—';
    }, { timeout: 3000 });

    // Pause to ensure stable state
    await vp.pause.click();

    const resText = await vp.result.textContent();
    expect(resText.trim()).not.toBe('—');

    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('Keyboard shortcuts: Space for step, ArrowLeft for stepBack, ArrowRight for step', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err.message));

    const vp = new VisualizerPage(page);
    await vp.goto();

    // Ensure starting from reset state for clarity
    await vp.reset.click();

    // Press Space to step forward
    await page.keyboard.press(' ');
    // After pressing space the UI should have stepsCount >= 1
    const afterSpace = Number(await vp.stepsCount.textContent());
    expect(afterSpace).toBeGreaterThanOrEqual(1);

    // Press ArrowLeft to step backward
    await page.keyboard.press('ArrowLeft');
    const afterLeft = await vp.stepsCount.textContent();
    // after stepping back once, either 0 or unchanged; ensure no exception and UI updated
    expect(afterLeft).toBeDefined();

    // Press ArrowRight to step forward again
    await page.keyboard.press('ArrowRight');
    const afterRight = Number(await vp.stepsCount.textContent());
    expect(afterRight).toBeGreaterThanOrEqual(1);

    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('Inspect console and page errors during complex interaction sequence', async ({ page }) => {
    // This test performs multiple actions to observe any runtime exceptions
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err.message));

    const vp = new VisualizerPage(page);
    await vp.goto();

    // Series of interactions covering many transitions
    await vp.generate.click();
    await vp.setSize(10);
    await vp.generate.click();
    await vp.pickRandom.click();
    await vp.step.click();
    await vp.step.click();
    await vp.stepBack.click();
    await vp.shuffle.click();
    await vp.generate.click();
    await vp.triggerChangeOnTarget('random');
    await vp.auto.click();
    // give some time for autoplay to progress, then pause
    await page.waitForTimeout(300);
    await vp.pause.click();
    await vp.reset.click();

    // Assert that no console error or page error was emitted during the sequence
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });
});