import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72aaa190-fa78-11f0-812d-c9788050701f.html';

// Page object to encapsulate commonly-used selectors and actions.
class PrimAppPage {
  constructor(page) {
    this.page = page;
    this.startSelector = '#startBtn';
    this.resetSelector = '#resetBtn';
    this.weightSelector = '#weightDisplay';
    this.graphContainerSelector = '#graphContainer';
  }

  async waitForLoad() {
    // Wait for main container to be present
    await this.page.waitForSelector(this.graphContainerSelector, { state: 'attached' });
    // Wait for weight display
    await this.page.waitForSelector(this.weightSelector, { state: 'attached' });
  }

  async startButton() {
    return this.page.locator(this.startSelector);
  }

  async resetButton() {
    return this.page.locator(this.resetSelector);
  }

  async weightText() {
    return this.page.locator(this.weightSelector);
  }

  async graphCanvas() {
    // The implementation creates a <canvas> inside #graphContainer
    return this.page.locator(`${this.graphContainerSelector} canvas`);
  }

  // Helper to click start (guarded)
  async clickStart() {
    await this.page.click(this.startSelector);
  }

  async clickReset() {
    await this.page.click(this.resetSelector);
  }

  // Returns numeric MST weight parsed from the weight display text
  async getMstWeightNumber() {
    const text = await this.weightText().innerText();
    const match = text.match(/MST Weight:\s*([0-9]+)/);
    if (match) return Number(match[1]);
    return NaN;
  }
}

test.describe('Prim\'s Algorithm Visualization - E2E (FSM + DOM + Errors)', () => {
  // Arrays to collect console error messages and page errors per test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Capture uncaught exceptions / page errors
    page.on('pageerror', exception => {
      pageErrors.push(exception);
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Ensure we close any leftover dialogs or intervals gracefully by navigating away
    // This is teardown to avoid influencing next tests.
    try {
      await page.evaluate(() => {
        // No modification of page logic; simply navigate away to stop script execution in the renderer.
        // Note: We DO NOT inject or override functions as per instructions.
        return true;
      });
    } catch (e) {
      // swallow any evaluation errors — they will be asserted via pageErrors/consoleErrors below
    }
  });

  test('Initial Idle state: canvas, controls and weight display are present and correct', async ({ page }) => {
    // Validate the initial (Idle) state of the app after DOMContentLoaded initialization
    const app = new PrimAppPage(page);
    await app.waitForLoad();

    // The graph should have a canvas inserted by the script
    const canvas = await app.graphCanvas();
    await expect(canvas).toHaveCount(1);

    // Start button should be present and enabled or disabled depending on implementation.
    const startBtn = await app.startButton();
    await expect(startBtn).toBeVisible();

    // Reset button should be present
    const resetBtn = await app.resetButton();
    await expect(resetBtn).toBeVisible();

    // Ensure weight display shows initial MST weight text
    const weightText = await app.weightText();
    await expect(weightText).toHaveText(/MST Weight:\s*\d+/);

    // Check specific numeric initial weight is 0 (implementation sets it to 0)
    const initialWeight = await app.getMstWeightNumber();
    expect(initialWeight).toBe(0);

    // Resize the viewport to trigger canvas resize handler and ensure no runtime errors are emitted
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(300); // allow resize handler to run

    // Assertions on errors: for robustness we expect no console.error or uncaught page errors.
    // Collecting and asserting to ensure the page loaded without runtime exceptions.
    expect(consoleErrors.length, `console.error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Start Animation: clicking Start transitions to Animating state and updates DOM (startBtn disabled, resetBtn enabled, weight increases)', async ({ page }) => {
    const app = new PrimAppPage(page);
    await app.waitForLoad();

    // Capture initial button states
    const startBtn = await app.startButton();
    const resetBtn = await app.resetButton();

    const startDisabledBefore = await startBtn.getAttribute('disabled');
    const resetDisabledBefore = await resetBtn.getAttribute('disabled');

    // Click Start to begin Prim's algorithm animation. This should call prim() and set up an interval.
    await app.clickStart();

    // After clicking start, per implementation startBtn.disabled = true and resetBtn.disabled = false
    await expect(startBtn).toBeDisabled();
    await expect(resetBtn).toBeEnabled();

    // Wait for the weight display to change from 0 to a larger number as MST edges are added.
    // The algorithm uses setInterval with config.animationSpeed = 1500ms and may have several steps.
    // We'll wait up to 30000ms for the MST weight to become > 0.
    const maxWaitMs = 30000;
    const pollInterval = 500;
    let mstIncreased = false;
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      const weight = await app.getMstWeightNumber();
      if (weight > 0) {
        mstIncreased = true;
        break;
      }
      await page.waitForTimeout(pollInterval);
    }

    // If no increase happened within the max wait, this could indicate an issue; assert that it did increase.
    expect(mstIncreased).toBe(true);

    // Ensure no console errors or uncaught exceptions occurred during animation startup
    expect(consoleErrors.length, `console.error messages during start: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors during start: ${JSON.stringify(pageErrors)}`).toBe(0);
  }, { timeout: 45000 }); // extended timeout as animation may take time

  test('Reset during animation: clicking Reset stops the animation and returns to Idle state', async ({ page }) => {
    const app = new PrimAppPage(page);
    await app.waitForLoad();

    // Start the animation
    await app.clickStart();

    const startBtn = await app.startButton();
    const resetBtn = await app.resetButton();

    // Confirm animation has started (start button disabled)
    await expect(startBtn).toBeDisabled();
    await expect(resetBtn).toBeEnabled();

    // Wait a short moment to let some steps run
    await page.waitForTimeout(2000);

    // Click reset to stop the animation
    await app.clickReset();

    // After reset, the implementation sets startBtn.disabled = false and resetBtn.disabled = true
    await expect(startBtn).toBeEnabled();
    await expect(resetBtn).toBeDisabled();

    // The weight display should be reset to 0 by reset()
    // Wait a bit to allow reset() to update DOM
    await page.waitForTimeout(200);
    const weightAfterReset = await app.getMstWeightNumber();
    expect(weightAfterReset).toBe(0);

    // Ensure subsequent waiting does not reveal uncaught errors
    expect(consoleErrors.length, `console.error messages during reset: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors during reset: ${JSON.stringify(pageErrors)}`).toBe(0);
  }, { timeout: 20000 });

  test('Clicking Reset when idle (disabled) should be a no-op and not produce runtime errors', async ({ page }) => {
    const app = new PrimAppPage(page);
    await app.waitForLoad();

    const startBtn = await app.startButton();
    const resetBtn = await app.resetButton();

    // Ensure starting state: start button enabled and reset button is likely disabled (based on implementation).
    // Record current weight and states
    const weightBefore = await app.getMstWeightNumber();
    const startEnabled = await startBtn.isEnabled();
    const resetDisabled = await resetBtn.isDisabled();

    // Attempt to click the reset button even if it's disabled.
    // Playwright will still attempt to click, but if the element is disabled the browser will not dispatch click event.
    // This ensures we exercise the edge case.
    try {
      await app.clickReset();
    } catch (e) {
      // Playwright throws if element is not actionable; swallow that since it's an expected edge interaction.
    }

    // Wait a short moment to ensure no state changes happened
    await page.waitForTimeout(250);

    const weightAfter = await app.getMstWeightNumber();
    const startEnabledAfter = await startBtn.isEnabled();
    const resetDisabledAfter = await resetBtn.isDisabled();

    // Validate that nothing changed as reset was disabled -> no-op
    expect(weightAfter).toBe(weightBefore);
    expect(startEnabledAfter).toBe(startEnabled);
    expect(resetDisabledAfter).toBe(resetDisabled);

    // No runtime errors should have been emitted
    expect(consoleErrors.length, `console.error messages from disabled reset click: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors from disabled reset click: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Multiple rapid Start clicks should not create unhandled errors and animation still progresses', async ({ page }) => {
    const app = new PrimAppPage(page);
    await app.waitForLoad();

    // Rapidly click start multiple times
    // Only the first click is expected to begin animation; subsequent clicks should be ignored because button becomes disabled.
    const clicks = 3;
    for (let i = 0; i < clicks; i++) {
      try {
        await app.clickStart();
      } catch (e) {
        // If the element becomes not actionable, Playwright may throw; ignore such thrown action errors.
      }
      // Tiny delay between clicks to simulate user double-clicks
      await page.waitForTimeout(100);
    }

    const startBtn = await app.startButton();
    const resetBtn = await app.resetButton();

    // start should be disabled, reset enabled
    await expect(startBtn).toBeDisabled();
    await expect(resetBtn).toBeEnabled();

    // Wait up to 20s to observe weight increase
    let increased = false;
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      const w = await app.getMstWeightNumber();
      if (w > 0) {
        increased = true;
        break;
      }
      await page.waitForTimeout(400);
    }
    expect(increased).toBe(true);

    // Assert no console errors or page errors
    expect(consoleErrors.length, `console.error messages after multiple starts: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors after multiple starts: ${JSON.stringify(pageErrors)}`).toBe(0);
  }, { timeout: 35000 });

  test('Full run: let animation complete naturally and observe final state (buttons and weight stable)', async ({ page }) => {
    const app = new PrimAppPage(page);
    await app.waitForLoad();

    // Start animation
    await app.clickStart();

    const startBtn = await app.startButton();
    const resetBtn = await app.resetButton();

    // Expect start disabled and reset enabled during animation
    await expect(startBtn).toBeDisabled();
    await expect(resetBtn).toBeEnabled();

    // The animation will eventually clear the interval and set isAnimating = false.
    // After completion, startBtn should be enabled again and resetBtn disabled.
    // We'll poll for that state up to a reasonable timeout (e.g., 60s) to account for variable graph complexity.
    const maxWait = 60000;
    const poll = 1000;
    let completed = false;
    const startTime = Date.now();
    while (Date.now() - startTime < maxWait) {
      const startEnabled = await startBtn.isEnabled();
      const resetDisabled = await resetBtn.isDisabled();
      if (startEnabled && resetDisabled) {
        completed = true;
        break;
      }
      await page.waitForTimeout(poll);
    }

    expect(completed, `animation completed and returned to Idle within ${maxWait}ms`).toBe(true);

    // Final weight should be the total MST weight (non-negative integer)
    const finalWeight = await app.getMstWeightNumber();
    expect(Number.isInteger(finalWeight)).toBe(true);
    expect(finalWeight).toBeGreaterThanOrEqual(0);

    // No runtime errors during the full run
    expect(consoleErrors.length, `console.error messages during full run: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors during full run: ${JSON.stringify(pageErrors)}`).toBe(0);
  }, { timeout: 90000 }); // extended to allow full animation

});