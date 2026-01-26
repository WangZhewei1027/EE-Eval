import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f6f032-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object to encapsulate interactions and queries
class TwoPointersPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.playBtn = page.locator('#play');
    this.playLabel = page.locator('#play-label');
    this.resetBtn = page.locator('#reset');
    this.statusEl = page.locator('#status');
    this.stepCount = page.locator('#step-count');
    this.currentPair = page.locator('#current-pair');
    this.pointerLeft = page.locator('#pointerLeft');
    this.pointerRight = page.locator('#pointerRight');
    this.arrayWrap = page.locator('#arrayWrap');
    this.cells = page.locator('.cell');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // wait a tiny bit for the intro animation to set initial state
    await this.page.waitForTimeout(120);
  }

  async clickPlay() {
    await this.playBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async pressSpace() {
    // Press space on the page (will send to window)
    await this.page.keyboard.press('Space');
  }

  async getStatusText() {
    return (await this.statusEl.textContent())?.trim();
  }

  async getPlayLabelText() {
    return (await this.playLabel.textContent())?.trim();
  }

  async getStepCountText() {
    return (await this.stepCount.textContent())?.trim();
  }

  async getCurrentPairText() {
    return (await this.currentPair.textContent())?.trim();
  }

  async getCellClassAt(index) {
    const el = this.cells.nth(index);
    return (await el.getAttribute('class')) || '';
  }

  async getPointerTransformLeft() {
    return (await this.pointerLeft.getAttribute('style')) || '';
  }

  async getPointerTransformRight() {
    return (await this.pointerRight.getAttribute('style')) || '';
  }

  async cellCount() {
    return await this.cells.count();
  }
}

// Test suite
test.describe('Two Pointers — FSM states and transitions', () => {
  // Capture console and page errors for each test to assert no unexpected runtime errors
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Ensure no uncaught page errors or console errors occurred during the test run.
    // This asserts the runtime stayed free of ReferenceError/SyntaxError/TypeError and other uncaught exceptions.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => String(e)).join('\n')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console.error messages: ${consoleErrors.join('\n')}`).toBe(0);
  });

  test('Initial load shows introductory status and panels render (Idle cue present via reset)', async ({ page }) => {
    // Validate initial rendering and the minimal startup cue introduced by the app.
    const vp = new TwoPointersPage(page);
    await vp.goto();

    // The app runs a tiny "intro" that sets status to 'Ready — press Play'
    const status = await vp.getStatusText();
    expect(status).toMatch(/Ready\s*—\s*press Play/i);

    // Panels should be present and array cells rendered
    const cellsCount = await vp.cellCount();
    expect(cellsCount).toBeGreaterThanOrEqual(7); // the example array has 7 elements

    // Now trigger reset to move to the explicit Idle state from FSM (reset sets 'Idle — press Play')
    await vp.clickReset();
    await page.waitForTimeout(40); // small wait for UI updates
    const statusAfterReset = await vp.getStatusText();
    expect(statusAfterReset).toBe('Idle — press Play');

    // Step counter should be reset to 0 / N pattern
    const stepText = await vp.getStepCountText();
    expect(stepText).toMatch(/^0\s*\/\s*\d+$/);
  });

  test('Play button toggles Idle -> Playing and updates UI (Play label -> Pause and step increments)', async ({ page }) => {
    const vp = new TwoPointersPage(page);
    await vp.goto();

    // Ensure idle via reset first to align with FSM S0_Idle
    await vp.clickReset();
    await page.waitForTimeout(30);
    expect(await vp.getStatusText()).toBe('Idle — press Play');
    expect(await vp.getPlayLabelText()).toBe('Play');

    // Click Play: should start animation and change Play label to Pause
    await vp.clickPlay();

    // play() triggers an immediate step; stepCount should change to '1 / total'
    await expect.poll(() => vp.getPlayLabelText(), { interval: 50, timeout: 2000 }).toBe('Pause');
    await expect.poll(() => vp.getStepCountText(), { interval: 50, timeout: 2000 }).toMatch(/^\d+\s*\/\s*\d+$/);

    const stepText = await vp.getStepCountText();
    // Validate we progressed at least to 1 / total
    expect(stepText.startsWith('1')).toBeTruthy();

    // The status should reflect an algorithm message (not 'Idle'); check that it's not 'Idle — press Play'
    const status = await vp.getStatusText();
    expect(status && !status.includes('Idle')).toBeTruthy();

    // Some cells should be highlighted for the current pair
    const c0Class = await vp.getCellClassAt(0);
    // Since first step highlights leftmost and rightmost, first cell likely is highlighted or match
    expect(c0Class.includes('highlight') || c0Class.includes('match')).toBeTruthy();
  });

  test('Clicking Play while Playing pauses the visualization (Playing -> Paused)', async ({ page }) => {
    const vp = new TwoPointersPage(page);
    await vp.goto();

    await vp.clickReset();
    await page.waitForTimeout(10);
    await vp.clickPlay();

    // Wait until it reports Pause label
    await expect.poll(() => vp.getPlayLabelText(), { interval: 50, timeout: 2000 }).toBe('Pause');

    // Click Play again to toggle pause
    await vp.clickPlay();

    // Pause sets playLabel back to 'Play' and status text to 'Paused'
    await expect.poll(() => vp.getPlayLabelText(), { interval: 50, timeout: 2000 }).toBe('Play');
    await expect.poll(() => vp.getStatusText(), { interval: 20, timeout: 2000 }).toBe('Paused');

    // Step count should remain at least 1 / total (no automatic forward while paused)
    const sc = await vp.getStepCountText();
    expect(sc.startsWith('1') || sc.startsWith('0')).toBeTruthy();
  });

  test('Space key toggles Play/Pause (SpaceKeyPress event)', async ({ page }) => {
    const vp = new TwoPointersPage(page);
    await vp.goto();

    await vp.clickReset();
    await page.waitForTimeout(10);
    // Focus something inert to ensure keydown goes to window; pressing on body
    await page.locator('body').click();

    // Press space to start playing
    await vp.pressSpace();

    await expect.poll(() => vp.getPlayLabelText(), { interval: 50, timeout: 2000 }).toBe('Pause');

    // Press space again to pause
    await vp.pressSpace();

    await expect.poll(() => vp.getPlayLabelText(), { interval: 50, timeout: 2000 }).toBe('Play');
    await expect.poll(() => vp.getStatusText(), { interval: 50, timeout: 2000 }).toBe('Paused');
  });

  test('Reset transitions to Idle from both Playing and Paused states', async ({ page }) => {
    const vp = new TwoPointersPage(page);
    await vp.goto();

    // Ensure playing then reset
    await vp.clickReset();
    await page.waitForTimeout(10);
    await vp.clickPlay();
    await expect.poll(() => vp.getPlayLabelText(), { interval: 50, timeout: 2000 }).toBe('Pause');

    // Now click Reset while playing
    await vp.clickReset();
    // Reset should set Idle text and play label to Play
    await expect.poll(() => vp.getStatusText(), { interval: 20, timeout: 2000 }).toBe('Idle — press Play');
    await expect.poll(() => vp.getPlayLabelText(), { interval: 20, timeout: 2000 }).toBe('Play');
    await expect.poll(() => vp.getStepCountText(), { interval: 20, timeout: 2000 }).toMatch(/^0\s*\/\s*\d+$/);

    // Start and then pause, then reset
    await vp.clickPlay();
    await expect.poll(() => vp.getPlayLabelText(), { interval: 50, timeout: 2000 }).toBe('Pause');
    await vp.clickPlay(); // pause
    await expect.poll(() => vp.getStatusText(), { interval: 20, timeout: 2000 }).toBe('Paused');

    // Reset while paused
    await vp.clickReset();
    await expect.poll(() => vp.getStatusText(), { interval: 20, timeout: 2000 }).toBe('Idle — press Play');
    await expect.poll(() => vp.getPlayLabelText(), { interval: 20, timeout: 2000 }).toBe('Play');
  });

  test('Edge case: rapid toggling of Play/Pause and repeated Reset calls do not produce runtime errors', async ({ page }) => {
    const vp = new TwoPointersPage(page);
    await vp.goto();

    // Rapid toggles
    await vp.clickReset();
    for (let i = 0; i < 5; i++) {
      await vp.clickPlay();
      // tiny delay to simulate rapid user toggling
      await page.waitForTimeout(80);
      await vp.clickPlay();
      await page.waitForTimeout(30);
    }

    // Rapid resets
    for (let i = 0; i < 4; i++) {
      await vp.clickReset();
      await page.waitForTimeout(30);
    }

    // Ensure UI remains responsive: play label should be 'Play' and status 'Idle — press Play'
    await expect.poll(() => vp.getPlayLabelText(), { interval: 20, timeout: 2000 }).toBe('Play');
    await expect.poll(() => vp.getStatusText(), { interval: 20, timeout: 2000 }).toBe('Idle — press Play');
  });

  test('Complete run reaches a matching pair and UI marks match classes', async ({ page }) => {
    const vp = new TwoPointersPage(page);
    await vp.goto();

    // Reset to initial state and start playing to completion
    await vp.clickReset();
    await page.waitForTimeout(10);
    await vp.clickPlay();

    // Wait long enough for the full algorithm to progress to the 'match' state.
    // The implementation uses ~1200ms between steps and there are 4 steps; give generous timeout.
    await page.waitForTimeout(5500);

    // After completion, playLabel should be 'Play' (play() sets it back on completion)
    expect(await vp.getPlayLabelText()).toBe('Play');

    // The matched pair from computeSteps is indices 2 and 5 (values 4 and 8 -> 12)
    // Check that at least one cell has class 'match' and the currentPair contains '12' as sum
    const currentPair = await vp.getCurrentPairText();
    expect(currentPair).toMatch(/12/);

    // Verify that at least one cell has 'match' class
    const count = await vp.cellCount();
    let foundMatch = false;
    for (let i = 0; i < count; i++) {
      const cls = await vp.getCellClassAt(i);
      if (cls.includes('match')) {
        foundMatch = true;
        break;
      }
    }
    expect(foundMatch).toBeTruthy();
  });

});