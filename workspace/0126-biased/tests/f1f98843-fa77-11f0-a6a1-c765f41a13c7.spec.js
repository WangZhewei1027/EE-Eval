import { test, expect } from '@playwright/test';

// Test file for Application ID: f1f98843-fa77-11f0-a6a1-c765f41a13c7
// Served at: http://127.0.0.1:5500/workspace/0126-biased/html/f1f98843-fa77-11f0-a6a1-c765f41a13c7.html
//
// This suite validates the FSM states/transitions described in the extraction:
// - S0_Idle (init())
// - S1_Playing (playAnimation())
// - S2_Paused (pauseAnimation())
// Events:
// - PlayPause (button #playPause toggles playing)
 // - ToggleNoise (button #toggleNoise regenerates dataset)
//
// The tests intentionally load the page exactly as-is, observe console and page errors,
// and assert expected runtime behavior (without modifying the page).

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f98843-fa77-11f0-a6a1-c765f41a13c7.html';

// Simple page object encapsulating selectors and common operations
class OverfitPage {
  constructor(page) {
    this.page = page;
    this.playPause = page.locator('#playPause');
    this.toggleNoise = page.locator('#toggleNoise');
    this.trainLossVal = page.locator('#trainLossVal');
    this.valLossVal = page.locator('#valLossVal');
    this.trainPointsG = page.locator('#trainPoints');
    this.valPointsG = page.locator('#valPoints');
    this.modelCurve = page.locator('#modelCurve');
    this.modelCurveThin = page.locator('#modelCurveThin');
    this.complexityValue = page.locator('#complexityValue');
    this.valLossText = page.locator('#valLossText');
  }

  // Click play/pause
  async clickPlayPause() {
    await this.playPause.click();
  }

  // Click toggle noise
  async clickToggleNoise() {
    await this.toggleNoise.click();
  }

  // Read button text
  async playPauseText() {
    return (await this.playPause.textContent())?.trim();
  }

  async toggleNoiseInlineTransform() {
    // returns inline style transform value (may be empty string)
    return this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el && el.style ? el.style.transform : null;
    }, '#toggleNoise');
  }

  // Number of train/val points (child <g> elements)
  async trainPointsCount() {
    return this.page.evaluate((sel) => {
      const g = document.querySelector(sel);
      return g ? g.children.length : 0;
    }, '#trainPoints');
  }

  async valPointsCount() {
    return this.page.evaluate((sel) => {
      const g = document.querySelector(sel);
      return g ? g.children.length : 0;
    }, '#valPoints');
  }

  // Get transform attribute string of the first train point group
  async firstTrainPointTransform() {
    return this.page.evaluate(() => {
      const g = document.querySelector('#trainPoints g');
      return g ? g.getAttribute('transform') : null;
    });
  }

  // Read numeric loss values as floats
  async readTrainLoss() {
    const txt = await this.trainLossVal.textContent();
    return parseFloat((txt ?? '').trim());
  }

  async readValLoss() {
    const txt = await this.valLossVal.textContent();
    return parseFloat((txt ?? '').trim());
  }

  // Read modelCurve d attribute (path data)
  async modelCurvePathD() {
    return this.page.evaluate(() => {
      const el = document.getElementById('modelCurve');
      return el ? el.getAttribute('d') : '';
    });
  }

  // Read complexity text
  async complexityText() {
    return (await this.complexityValue.textContent())?.trim();
  }
}

test.describe('Overfitting — Visual Exploration FSM and Interactions', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async ({ page }) => {
    // Allow some time for background tasks to settle before assertions in teardown if needed
    await page.waitForTimeout(30);
  });

  test('Initial state: init() ran and visualization elements present (S0_Idle -> S1_Playing expected behavior)', async ({ page }) => {
    // This validates that the initial entry action init() executed correctly by checking core DOM updates.
    const app = new OverfitPage(page);

    // Wait until model curve path 'd' is non-empty and train/val points are rendered
    await page.waitForFunction(() => {
      const mc = document.getElementById('modelCurve');
      const tG = document.getElementById('trainPoints');
      const vG = document.getElementById('valPoints');
      return mc && mc.getAttribute('d') && tG && tG.children.length > 0 && vG && vG.children.length > 0;
    }, { timeout: 5000 });

    // Assert expected counts for points (trainN=18, valN=12 per implementation)
    const trainCount = await app.trainPointsCount();
    const valCount = await app.valPointsCount();
    expect(trainCount).toBeGreaterThanOrEqual(18); // Expect at least 18 training points
    expect(valCount).toBeGreaterThanOrEqual(12); // Expect at least 12 validation points

    // Assert complexity label exists
    const complexity = await app.complexityText();
    expect(complexity).toMatch(/^Complexity:/);

    // Assert playPause initial label is 'Pause' (since playing=true by default)
    const playText = await app.playPauseText();
    expect(playText).toBe('Pause');

    // The model curve path should be a non-empty string
    const d = await app.modelCurvePathD();
    expect(typeof d).toBe('string');
    expect(d.length).toBeGreaterThan(10);

    // Record console and page errors snapshot — ensure there are no uncaught exceptions at initial load
    // (We assert no page errors — the page is intended to run without uncaught exceptions.)
    expect(pageErrors.length).toBe(0);
  });

  test('PlayPause: clicking toggles playing state -> Pause -> Play (S1_Playing <-> S2_Paused)', async ({ page }) => {
    // Validate the PlayPause event toggles animation and textual feedback.
    const app = new OverfitPage(page);

    // Ensure page fully initialized
    await page.waitForSelector('#playPause');

    // Starting state should be 'Pause'
    expect(await app.playPauseText()).toBe('Pause');

    // Capture loss values while playing
    const trainLoss1 = await app.readTrainLoss();
    const valLoss1 = await app.readValLoss();

    // Pause by clicking the button
    await app.clickPlayPause();

    // Button text should update to 'Play'
    await expect(app.playPause).toHaveText('Play');

    // After paused, losses should remain stable over a short interval
    await page.waitForTimeout(350);
    const trainLossAfterPause = await app.readTrainLoss();
    const valLossAfterPause = await app.readValLoss();

    // When paused, there should be minimal change (allowing small epsilon for timing)
    const eps = 1e-6;
    expect(Math.abs(trainLossAfterPause - trainLoss1)).toBeLessThanOrEqual(0.02 + eps);
    expect(Math.abs(valLossAfterPause - valLoss1)).toBeLessThanOrEqual(0.02 + eps);

    // Resume playing
    await app.clickPlayPause();
    await expect(app.playPause).toHaveText('Pause');

    // After resuming, values should change given time for animation updates
    await page.waitForTimeout(400);
    const trainLossAfterResume = await app.readTrainLoss();
    const valLossAfterResume = await app.readValLoss();

    // At least one of the losses should have changed appreciably after resuming
    const changed = (Math.abs(trainLossAfterResume - trainLossAfterPause) > eps) || (Math.abs(valLossAfterResume - valLossAfterPause) > eps);
    expect(changed).toBeTruthy();
  });

  test('ToggleNoise: clicking regenerates dataset and pulses button (ToggleNoise event)', async ({ page }) => {
    // Validate ToggleNoise event regenerates points and UI reflects the pulse animation.
    const app = new OverfitPage(page);

    // Ensure points present
    await page.waitForFunction(() => {
      const g = document.getElementById('trainPoints');
      return g && g.children.length > 0;
    });

    // Capture first train point transform before toggle
    const beforeTransform = await app.firstTrainPointTransform();
    expect(beforeTransform).toBeTruthy();

    // Click toggle noise
    await app.clickToggleNoise();

    // Immediately after click, inline style transform should show the temporary pulse translation
    const inlineTransform = await app.toggleNoiseInlineTransform();
    // The implementation sets style.transform = 'translateY(-3px)' briefly on click
    expect(inlineTransform === 'translateY(-3px)' || inlineTransform === 'translateY(-3px) ').toBeTruthy();

    // Wait for the pulse timeout to clear (~180 ms in implementation) plus a small buffer
    await page.waitForTimeout(240);

    // Ensure inline style transform cleared (back to empty string)
    const inlineTransformAfter = await app.toggleNoiseInlineTransform();
    // style.transform may reset to '' (empty string) — accept null as well if not present
    expect(inlineTransformAfter === '' || inlineTransformAfter === null).toBeTruthy();

    // After toggle, first train point transform should have changed (points re-generated)
    // It's highly unlikely the first point's transform is identical after a fresh random generation.
    const afterTransform = await app.firstTrainPointTransform();
    expect(afterTransform).toBeTruthy();
    expect(afterTransform).not.toBe(beforeTransform);
  });

  test('ToggleNoise while paused: ensures dataset regeneration does not restart animation', async ({ page }) => {
    // Edge case: toggling noise while paused should update data and visuals but not start playback.
    const app = new OverfitPage(page);

    // Ensure initialized
    await page.waitForSelector('#toggleNoise');

    // Pause animation
    if ((await app.playPauseText()) === 'Pause') {
      await app.clickPlayPause();
      await expect(app.playPause).toHaveText('Play');
    }

    // Read losses and first train point transform
    const trainLossBefore = await app.readTrainLoss();
    const valLossBefore = await app.readValLoss();
    const transformBefore = await app.firstTrainPointTransform();

    // Toggle noise
    await app.clickToggleNoise();

    // Wait for redraw operations
    await page.waitForTimeout(240);

    // Ensure animation still paused (button should still say 'Play')
    expect(await app.playPauseText()).toBe('Play');

    // Loss values should update due to new data
    const trainLossAfter = await app.readTrainLoss();
    const valLossAfter = await app.readValLoss();

    // It's expected that loss values may change when data regenerated (noise amplitude toggles)
    // Accept equal or changed values; but to validate regeneration, check point transform has changed
    const transformAfter = await app.firstTrainPointTransform();
    expect(transformAfter).toBeTruthy();
    expect(transformAfter).not.toBe(transformBefore);

    // No uncaught page errors should be introduced by toggling while paused
    // (we captured pageErrors in beforeEach)
    expect(pageErrors.length).toBe(0);
  });

  test('Rapid toggles on PlayPause do not cause uncaught exceptions (stress edge case)', async ({ page }) => {
    // Rapidly click PlayPause multiple times and ensure UI toggles and no runtime errors occur.
    const app = new OverfitPage(page);
    await page.waitForSelector('#playPause');

    // Rapid toggle sequence
    for (let i = 0; i < 6; i++) {
      await app.clickPlayPause();
      // small interval to simulate user rapidly clicking but allowing handler to execute
      await page.waitForTimeout(70);
    }

    // After sequence, button text must be either 'Play' or 'Pause' (valid states)
    const finalText = await app.playPauseText();
    expect(['Play', 'Pause']).toContain(finalText);

    // Ensure no uncaught exceptions were emitted during the rapid toggles
    expect(pageErrors.length).toBe(0);
  });

  test('Console messages capture and basic validation', async ({ page }) => {
    // Observes console messages emitted during page lifetime and asserts none are errors.
    // We simply assert that no console message of type 'error' was emitted.
    // This complements pageerror checks.
    // Give some time for background tasks to emit logs if any
    await page.waitForTimeout(300);

    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    // If there are console error messages, surface them for easier debugging in failure outputs.
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Final check: no uncaught page errors after full interaction sequence', async ({ page }) => {
    // Execute an interaction sequence: toggle noise, pause, resume, toggle noise again
    const app = new OverfitPage(page);

    await page.waitForSelector('#toggleNoise');

    await app.clickToggleNoise();
    await page.waitForTimeout(220);

    await app.clickPlayPause(); // pause
    await page.waitForTimeout(120);

    await app.clickPlayPause(); // resume
    await page.waitForTimeout(220);

    await app.clickToggleNoise();
    await page.waitForTimeout(220);

    // There should be no uncaught page errors encountered during all interactions
    expect(pageErrors.length).toBe(0);
  });
});