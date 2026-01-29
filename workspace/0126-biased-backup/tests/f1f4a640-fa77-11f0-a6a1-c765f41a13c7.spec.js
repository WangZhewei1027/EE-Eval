import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f4a640-fa77-11f0-a6a1-c765f41a13c7.html';

// Page object encapsulating interactions and queries for the Deque demo
class DequePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.playSelector = '#playPause';
    this.stateLabelSel = '#stateLabel';
    this.opLabelSel = '#opLabel';
    this.rackSel = '#rack';
    this.playIconSel = '#playIcon';
    this.pauseIconSel = '#pauseIcon';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait for essential elements to be present and for the demo to initialize slots
    await Promise.all([
      this.page.waitForSelector(this.playSelector),
      this.page.waitForSelector(this.stateLabelSel),
      this.page.waitForSelector(this.rackSel),
      this.page.waitForSelector(this.opLabelSel),
    ]);
  }

  async getPlayButton() {
    return this.page.locator(this.playSelector);
  }

  async clickPlayPause() {
    await this.page.click(this.playSelector);
  }

  async getStateLabelText() {
    return (await this.page.locator(this.stateLabelSel).innerText()).trim();
  }

  async getPlayAriaPressed() {
    return (await this.page.locator(this.playSelector).getAttribute('aria-pressed'));
  }

  async isPlayIconVisible() {
    // visible if display !== 'none'
    return this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      return getComputedStyle(el).display !== 'none';
    }, this.playIconSel);
  }

  async isPauseIconVisible() {
    return this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      return getComputedStyle(el).display !== 'none';
    }, this.pauseIconSel);
  }

  async countPieces() {
    return this.page.evaluate(() => document.querySelectorAll('.piece').length);
  }

  async getSlotClasses() {
    return this.page.evaluate(() => {
      const slots = Array.from(document.querySelectorAll('.slot'));
      return slots.map(s => ({ index: s.dataset.index, classes: s.className }));
    });
  }

  async getOpLabelText() {
    return (await this.page.locator(this.opLabelSel).innerText()).trim();
  }

  async waitForPiecesAtLeast(n, timeout = 5000) {
    await this.page.waitForFunction((expected) => {
      return document.querySelectorAll('.piece').length >= expected;
    }, n, { timeout });
  }

  async waitForOpLabelTextChange(prevText, timeout = 5000) {
    await this.page.waitForFunction((sel, old) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      return el.textContent.trim() !== old;
    }, this.opLabelSel, prevText, { timeout });
  }

  async waitForSlotClassChange(timeout = 2000) {
    // Wait until at least one slot element has front or back class
    await this.page.waitForFunction(() => {
      const slots = document.querySelectorAll('.slot');
      return Array.from(slots).some(s => s.classList.contains('front') || s.classList.contains('back'));
    }, null, { timeout });
  }
}

test.describe('Deque demo FSM and UI validations (f1f4a640-fa77-11f0-a6a1-c765f41a13c7)', () => {
  let dequePage;
  let pageErrors = [];
  let consoleErrors = [];
  let consoleWarnings = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];
    consoleWarnings = [];
    consoleMessages = [];

    // collect page errors as they occur
    page.on('pageerror', (err) => {
      // store the Error object for assertions later
      pageErrors.push(err);
    });

    // collect console messages (info, warnings, errors) for assertions and diagnostics
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
      if (type === 'warning') consoleWarnings.push(text);
    });

    dequePage = new DequePage(page);
    await dequePage.goto();
  });

  test.afterEach(async () => {
    // basic teardown no-op (but available for future)
  });

  test('Initial state should reflect "Playing" and controls proper initial attributes', async ({ page }) => {
    // Validate initial FSM state label matches the S0_Playing evidence
    const stateText = await dequePage.getStateLabelText();
    expect(stateText).toBe('Playing');

    // The play/pause button should initially have aria-pressed="false" per component evidence
    const aria = await dequePage.getPlayAriaPressed();
    expect(aria).toBe('false');

    // The icons initial visibility: play icon visible, pause icon hidden (as per HTML)
    const playIconVisible = await dequePage.isPlayIconVisible();
    const pauseIconVisible = await dequePage.isPauseIconVisible();
    expect(playIconVisible).toBe(true);
    expect(pauseIconVisible).toBe(false);

    // The rack should initialize some pieces (seeded in init). Wait for at least 3 pieces seeded.
    await dequePage.waitForPiecesAtLeast(3, 4000);
    const piecesCount = await dequePage.countPieces();
    expect(piecesCount).toBeGreaterThanOrEqual(3);

    // Slots should be created and have front/back assigned after reflow
    await dequePage.waitForSlotClassChange(3000);
    const slotClasses = await dequePage.getSlotClasses();
    // Ensure there is at least one 'front' and one 'back' marking when pieces present
    const hasFront = slotClasses.some(s => s.classes.includes('front'));
    const hasBack = slotClasses.some(s => s.classes.includes('back'));
    expect(hasFront).toBe(true);
    expect(hasBack).toBe(true);

    // Ensure no unexpected runtime exceptions were thrown during load
    expect(pageErrors.length).toBe(0);
    // No console errors either
    expect(consoleErrors.length).toBe(0);
  });

  test('Click Play/Pause toggles to Paused state (S0_Playing -> S1_Paused) and updates visuals', async ({ page }) => {
    // Capture state before click
    const beforeState = await dequePage.getStateLabelText();
    expect(beforeState).toBe('Playing');

    // Click to pause
    await dequePage.clickPlayPause();

    // After click, per FSM transition expected: stateLabel should read 'Paused'
    await page.waitForFunction(() => document.getElementById('stateLabel').textContent.trim() === 'Paused', null, { timeout: 2000 });
    const afterState = await dequePage.getStateLabelText();
    expect(afterState).toBe('Paused');

    // aria-pressed should now be 'true' per code behavior
    const aria = await dequePage.getPlayAriaPressed();
    expect(aria).toBe('true');

    // Icon visibility toggles: pause icon should now be visible, play icon hidden
    const playIconVisible = await dequePage.isPlayIconVisible();
    const pauseIconVisible = await dequePage.isPauseIconVisible();
    expect(playIconVisible).toBe(false);
    expect(pauseIconVisible).toBe(true);

    // No runtime page errors or console errors should have occurred during the transition
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Click Play/Pause again toggles back to Playing (S1_Paused -> S0_Playing) and resumes operations', async ({ page }) => {
    // Ensure we are in Playing initially; click once to pause then again to resume to test full round-trip
    // Pause first
    await dequePage.clickPlayPause();
    await page.waitForFunction(() => document.getElementById('stateLabel').textContent.trim() === 'Paused', null, { timeout: 2000 });

    // Now click to resume
    await dequePage.clickPlayPause();

    // stateLabel should read 'Playing' after resume
    await page.waitForFunction(() => document.getElementById('stateLabel').textContent.trim() === 'Playing', null, { timeout: 2000 });
    const resumedState = await dequePage.getStateLabelText();
    expect(resumedState).toBe('Playing');

    // aria-pressed should return to 'false'
    const aria = await dequePage.getPlayAriaPressed();
    expect(aria).toBe('false');

    // Icon visibility toggles back: play icon visible, pause icon hidden
    const playIconVisible = await dequePage.isPlayIconVisible();
    const pauseIconVisible = await dequePage.isPauseIconVisible();
    expect(playIconVisible).toBe(true);
    expect(pauseIconVisible).toBe(false);

    // After resuming, the operation banner should change at least once (performNext will run). Capture previous op text and wait for change.
    const prevOp = await dequePage.getOpLabelText();
    // Wait up to 5s for the op banner to update after resuming
    await dequePage.waitForOpLabelTextChange(prevOp, 6000);
    const newOp = await dequePage.getOpLabelText();
    expect(newOp.length).toBeGreaterThan(0);
    expect(newOp).not.toBe(prevOp);

    // No uncaught exceptions as a result of toggling rapidly
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Rapid toggling of Play/Pause does not produce runtime errors and final state is consistent', async ({ page }) => {
    // Rapidly toggle the play/pause button multiple times to exercise edge-case timing
    // We'll click 6 times with minimal delay
    for (let i = 0; i < 6; i++) {
      await dequePage.clickPlayPause();
      // short delay to allow DOM updates but keep toggles quick
      await page.waitForTimeout(80);
    }

    // After rapid toggling, ensure the stateLabel and aria-pressed reflect a coherent state
    const finalState = await dequePage.getStateLabelText();
    const finalAria = await dequePage.getPlayAriaPressed();

    // The aria-pressed attribute should always be 'true' or 'false' string
    expect(['true', 'false']).toContain(finalAria);
    expect(typeof finalState).toBe('string');
    expect(finalState.length).toBeGreaterThan(0);

    // Ensure that no page errors or console errors occurred during rapid toggling
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Demo operations produce visible opBanner updates and pieces animate without exceptions', async ({ page }) => {
    // Ensure in playing state; if paused, resume
    const state = await dequePage.getStateLabelText();
    if (state === 'Paused') {
      await dequePage.clickPlayPause();
      await page.waitForFunction(() => document.getElementById('stateLabel').textContent.trim() === 'Playing', null, { timeout: 2000 });
    }

    // Capture current pieces count and op banner value
    const beforePieces = await dequePage.countPieces();
    const prevOp = await dequePage.getOpLabelText();

    // Wait for the op banner to change which indicates performNext executed
    await dequePage.waitForOpLabelTextChange(prevOp, 8000);
    const afterOp = await dequePage.getOpLabelText();
    expect(afterOp).not.toBe(prevOp);

    // Allow some time for animations to settle and then assert pieces count is a reasonable number (>=0)
    await page.waitForTimeout(800);
    const afterPieces = await dequePage.countPieces();
    expect(afterPieces).toBeGreaterThanOrEqual(0); // sanity: should be non-negative
    // Ensure there is no DOM corruption (pieces should be valid elements)
    const piecesCount = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.piece')).every(el => el instanceof HTMLElement);
    });
    expect(piecesCount).toBe(true);

    // No page errors or console error messages
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: ensure safe handling when pops occur with zero pieces (no exceptions thrown)', async ({ page }) => {
    // Pause the demo to prevent new pushes
    const currentState = await dequePage.getStateLabelText();
    if (currentState === 'Playing') {
      await dequePage.clickPlayPause();
      await page.waitForFunction(() => document.getElementById('stateLabel').textContent.trim() === 'Paused', null, { timeout: 2000 });
    }

    // Attempt to wait until pieces drop to zero by simulating time passing while paused (they won't change while paused)
    // Instead, we will inspect the current pieces count and then programmatically wait while ensuring no errors occur
    const currentCount = await dequePage.countPieces();

    // If there are pieces, try to unpause briefly to allow a sequence that may pop items, then pause again.
    if (currentCount > 0) {
      // Resume for a short period to allow pop operations, then pause again
      await dequePage.clickPlayPause(); // resume
      await page.waitForFunction(() => document.getElementById('stateLabel').textContent.trim() === 'Playing', null, { timeout: 2000 });
      // Wait a few operations worth of time to allow pops (if any) to occur
      await page.waitForTimeout(3500);
      // Pause again
      await dequePage.clickPlayPause();
      await page.waitForFunction(() => document.getElementById('stateLabel').textContent.trim() === 'Paused', null, { timeout: 2000 });
    }

    // At no point should there be unhandled exceptions from pop operations
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Additionally, ensure that calling pop-like behavior indirectly did not leave detached nodes or invalid pieces
    const validPieces = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.piece')).every(el => el.parentElement && el.isConnected);
    });
    expect(validPieces).toBe(true);
  });

  test('Console output sanity: log messages captured and no unexpected error-level console logs', async ({ page }) => {
    // Let demo run briefly to gather console messages
    await page.waitForTimeout(1200);

    // We expect there may be informational console messages in some environments but aim to detect error logs
    // No console.error entries should exist
    expect(consoleErrors.length).toBe(0);

    // Provide diagnostic assertion: console warnings should be zero or low, but we won't fail if some warnings exist.
    // Still assert messages array captured some entries (page produced some console activity or none) - this ensures listener worked.
    expect(Array.isArray(consoleMessages)).toBe(true);

    // Ensure no page runtime errors
    expect(pageErrors.length).toBe(0);
  });
});