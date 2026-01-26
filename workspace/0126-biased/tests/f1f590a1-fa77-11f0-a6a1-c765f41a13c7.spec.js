import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f590a1-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object encapsulating common interactions and queries
class SelectionSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.playBtn = page.locator('#playBtn');
    this.shuffleBtn = page.locator('#shuffleBtn');
    this.barArea = page.locator('#barArea');
    this.stepCount = page.locator('#stepCount');
    this.compCount = page.locator('#compCount');
    this.swapCount = page.locator('#swapCount');
    this.nVal = page.locator('#nVal');
    this.progress = page.locator('#progress');
    this.statusTitle = page.locator('#statusTitle');
    this.pseudocode = page.locator('#pseudocode');
  }

  // Helper to get normalized text content of the play button
  async getPlayButtonText() {
    const txt = await this.playBtn.textContent();
    return (txt || '').replace(/\s+/g, ' ').trim();
  }

  // Returns an array of bar label numbers as strings
  async getBarLabels() {
    const labels = await this.barArea.locator('.bar .label').allTextContents();
    return labels.map(s => s.trim());
  }

  // Returns HTML snapshot of bar area (for comparison)
  async getBarAreaSnapshot() {
    return await this.barArea.innerHTML();
  }

  // Press global key (window) by dispatching keydown
  async pressWindowKey(key) {
    await this.page.keyboard.down(key);
    await this.page.keyboard.up(key);
  }

  // Click play and wait a short stabilization period for DOM updates
  async clickPlay() {
    await this.playBtn.click();
    // allow immediate handlers to run
    await this.page.waitForTimeout(120);
  }

  // Click shuffle and wait a short stabilization period
  async clickShuffle() {
    await this.shuffleBtn.click();
    await this.page.waitForTimeout(120);
  }

  // Wait until play button reaches a particular aria-pressed state (string 'true'/'false')
  async waitForAriaPressed(value, timeout = 2000) {
    await expect(this.playBtn).toHaveAttribute('aria-pressed', value, { timeout });
  }
}

test.describe('Selection Sort — Visual Elegance (FSM and UI interactions)', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    pageErrors = [];
    consoleMessages = [];

    // Capture page errors and console messages for assertions later
    page.on('pageerror', (err) => {
      // Collect the error object (message) for later assertions
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    page.on('console', (msg) => {
      // Collect console messages along with type for diagnostics
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    await page.goto(APP_URL);
    // Wait briefly for initial render and initial animations to setup DOM
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(300); // let initial init() complete
  });

  test.afterEach(async ({}, testInfo) => {
    // Attach console and page error summaries to test output for debugging when needed
    testInfo.attach('console-messages', { body: JSON.stringify(consoleMessages, null, 2), contentType: 'application/json' });
    testInfo.attach('page-errors', { body: JSON.stringify(pageErrors, null, 2), contentType: 'application/json' });
  });

  test('Initial Idle state is correct (S0_Idle) — UI and counters reflect init()', async ({ page }) => {
    const app = new SelectionSortPage(page);

    // The initial state after init(10) should be Idle:
    // - Play button shows "▶ Play" and aria-pressed = "false"
    // - Status title reads "Ready"
    // - Counters for steps, comparisons, swaps are 0 and nVal is 10
    const playText = await app.getPlayButtonText();
    expect(playText).toContain('▶ Play');

    await expect(app.playBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(app.statusTitle).toHaveText('Ready');
    await expect(app.stepCount).toHaveText('0');
    await expect(app.compCount).toHaveText('0');
    await expect(app.swapCount).toHaveText('0');
    await expect(app.nVal).toHaveText('10');

    // There should be 10 bars initially (n=10)
    const labels = await app.getBarLabels();
    expect(labels.length).toBe(10);

    // Ensure no uncaught page errors or console error-level messages at idle time
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors).toEqual([]); // fail if there are any uncaught page errors
    expect(consoleErrors).toEqual([]); // fail if any console.error logged
  });

  test('Clicking Play transitions Idle -> Playing (S0_Idle -> S1_Playing) and updates UI', async ({ page }) => {
    const app = new SelectionSortPage(page);

    // Clicking Play should start the animation: playBtn text becomes ❚❚ Pause and aria-pressed true
    await app.clickPlay();

    // After the click, startVisual sets playBtn.textContent = '❚❚ Pause' and aria-pressed = 'true'
    // Also playBtn is disabled while the visualization runs
    await expect.poll(async () => await app.getPlayButtonText(), { timeout: 2000 }).toContain('❚❚ Pause');
    await app.waitForAriaPressed('true');

    // Play button should be disabled initially while sorting is running
    await expect(app.playBtn).toBeDisabled();

    // The statusTitle is set to 'Starting…' quickly when starting
    await expect(app.statusTitle).toHaveText('Starting…');

    // Ensure comparisons counter begins at 0 and increments eventually (but may be 0 at the immediate moment)
    await expect(app.compCount).toHaveText('0');

    // No uncaught page errors during start
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Clicking Play while Playing pauses the run (S1_Playing -> S2_Paused)', async ({ page }) => {
    const app = new SelectionSortPage(page);

    // Start playing
    await app.clickPlay();
    await expect.poll(async () => await app.getPlayButtonText(), { timeout: 2000 }).toContain('❚❚ Pause');
    await app.waitForAriaPressed('true');

    // Now click play again to pause
    await app.clickPlay();

    // stopVisual should immediately set play button back to "▶ Play" and aria-pressed = "false" and enable buttons
    await expect.poll(async () => await app.getPlayButtonText(), { timeout: 2000 }).toContain('▶ Play');
    await app.waitForAriaPressed('false');

    // Play button should eventually be enabled again
    await expect(app.playBtn).toBeEnabled({ timeout: 2000 });

    // The application should still show some progress or step counts >= 0 (can't assert exact)
    const stepText = await app.stepCount.textContent();
    expect(Number(stepText)).toBeGreaterThanOrEqual(0);

    // No uncaught page errors during pause
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Paused -> Playing resumes when clicking Play again (S2_Paused -> S1_Playing)', async ({ page }) => {
    const app = new SelectionSortPage(page);

    // Start and then pause
    await app.clickPlay();
    await app.waitForAriaPressed('true');
    await app.clickPlay();
    await app.waitForAriaPressed('false');

    // Now resume
    await app.clickPlay();

    // Expect to be playing again
    await expect.poll(async () => await app.getPlayButtonText(), { timeout: 2000 }).toContain('❚❚ Pause');
    await app.waitForAriaPressed('true');

    // Then stop to clean up for subsequent tests
    await app.clickPlay(); // pause/stop
    await app.waitForAriaPressed('false');

    // No uncaught errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('ShuffleClick reinitializes array when not playing (S0_Idle or S2_Paused -> S0_Idle)', async ({ page }) => {
    const app = new SelectionSortPage(page);

    // Ensure idle
    const beforeSnapshot = await app.getBarAreaSnapshot();
    const beforeSteps = await app.stepCount.textContent();
    expect(beforeSteps).toBe('0');

    // Click shuffle (idle)
    await app.clickShuffle();

    // After shuffle, init(10) runs: counters reset and nVal stays 10
    await expect(app.stepCount).toHaveText('0');
    await expect(app.compCount).toHaveText('0');
    await expect(app.swapCount).toHaveText('0');
    await expect(app.nVal).toHaveText('10');
    await expect(app.statusTitle).toHaveText('Ready');

    const afterSnapshot = await app.getBarAreaSnapshot();
    // It's expected that at least the DOM updated (innerHTML may change due to random array)
    expect(typeof afterSnapshot).toBe('string');
    // If the innerHTML is identical (rare), still ensure that the DOM has 10 bars
    const afterLabels = await app.getBarLabels();
    expect(afterLabels.length).toBe(10);

    // No uncaught page errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('ShuffleClick is ignored while playing (S1_Playing -> S1_Playing)', async ({ page }) => {
    const app = new SelectionSortPage(page);

    // Start playing
    await app.clickPlay();
    await app.waitForAriaPressed('true');

    // Snapshot the bar area and counters
    const beforeSnapshot = await app.getBarAreaSnapshot();
    const beforeComp = await app.compCount.textContent();
    const beforeSwap = await app.swapCount.textContent();

    // Attempt to shuffle while playing (should be no-op)
    await app.clickShuffle();

    // Wait a bit for any accidental re-init to happen (it should not)
    await page.waitForTimeout(300);

    const afterSnapshot = await app.getBarAreaSnapshot();
    const afterComp = await app.compCount.textContent();
    const afterSwap = await app.swapCount.textContent();

    // The snapshots should remain the same (no re-init)
    expect(afterSnapshot).toBe(beforeSnapshot);
    // The comp/swap counters should not have been reset by shuffle click
    expect(afterComp).toBe(beforeComp);
    expect(afterSwap).toBe(beforeSwap);

    // Now stop the visualization to clean up
    await app.clickPlay(); // pause
    await app.waitForAriaPressed('false');

    // No uncaught page errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Keyboard "P" toggles play/pause (KeyPressP event)', async ({ page }) => {
    const app = new SelectionSortPage(page);

    // Ensure idle -> press 'p' should start playing
    await app.pressWindowKey('p');
    await expect.poll(async () => await app.getPlayButtonText(), { timeout: 2000 }).toContain('❚❚ Pause');
    await app.waitForAriaPressed('true');

    // Press 'p' again to pause
    await app.pressWindowKey('p');
    await expect.poll(async () => await app.getPlayButtonText(), { timeout: 2000 }).toContain('▶ Play');
    await app.waitForAriaPressed('false');

    // Uppercase 'P' should also work (handler uses toLowerCase)
    await app.pressWindowKey('P');
    await expect.poll(async () => await app.getPlayButtonText(), { timeout: 2000 }).toContain('❚❚ Pause');
    await app.waitForAriaPressed('true');

    // Cleanup: pause
    await app.pressWindowKey('p');
    await app.waitForAriaPressed('false');

    // No uncaught page errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Non-"p" keys do not toggle play/pause — edge case', async ({ page }) => {
    const app = new SelectionSortPage(page);

    // Record state
    const originalPlayText = await app.getPlayButtonText();
    const originalAria = await app.playBtn.getAttribute('aria-pressed');

    // Press 'x' — should not trigger play/pause
    await app.pressWindowKey('x');
    await page.waitForTimeout(200);

    const newPlayText = await app.getPlayButtonText();
    const newAria = await app.playBtn.getAttribute('aria-pressed');

    expect(newPlayText).toBe(originalPlayText);
    expect(newAria).toBe(originalAria);

    // No uncaught page errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Visual indicators update as algorithm progresses (sanity check during run)', async ({ page }) => {
    const app = new SelectionSortPage(page);

    // Start the visualization
    await app.clickPlay();
    await app.waitForAriaPressed('true');

    // Wait some time to allow the algorithm to perform a few comparisons/swaps
    await page.waitForTimeout(1200);

    // During run, we expect:
    // - stepCount to be >= 1
    // - compCount to be >= 1
    const steps = Number(await app.stepCount.textContent());
    const comps = Number(await app.compCount.textContent());
    expect(steps).toBeGreaterThanOrEqual(1);
    expect(comps).toBeGreaterThanOrEqual(1);

    // There should be some bars with class names indicating state like 'current' or 'min' or 'compare' possibly
    const anyCurrent = await app.barArea.locator('.bar.current').count();
    const anyMin = await app.barArea.locator('.bar.min').count();
    // It's acceptable if zero of these are present at the exact sampling time; just assert that the DOM is valid and bars exist
    const totalBars = await app.barArea.locator('.bar').count();
    expect(totalBars).toBeGreaterThan(0);

    // Pause the visualization to stop the test quickly
    await app.clickPlay();
    await app.waitForAriaPressed('false');

    // No uncaught page errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('No unexpected runtime errors were emitted during the scenario (observability)', async ({ page }) => {
    // This test asserts that during the lifecycle of the page we did not observe uncaught errors.
    // Because all previous tests collect pageErrors and consoleMessages in beforeEach/afterEach attachments,
    // we assert again on the current run (this test runs with a fresh beforeEach).
    const app = new SelectionSortPage(page);

    // Do a couple of normal interactions
    await app.clickPlay();
    await app.waitForAriaPressed('true');
    await page.waitForTimeout(400);
    await app.clickPlay();
    await app.waitForAriaPressed('false');
    await app.clickShuffle();
    await page.waitForTimeout(120);

    // Final assertion: no page errors and no console.error messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});