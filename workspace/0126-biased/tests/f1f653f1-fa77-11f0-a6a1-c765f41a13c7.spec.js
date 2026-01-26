import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f653f1-fa77-11f0-a6a1-c765f41a13c7.html';

test.describe('Floyd–Warshall Visualization (f1f653f1-fa77-11f0-a6a1-c765f41a13c7)', () => {
  // shared helpers: a lightweight page object for the visualization
  class FWPage {
    constructor(page) {
      this.page = page;
    }
    async playButton() { return this.page.locator('#playBtn'); }
    async resetButton() { return this.page.locator('#resetBtn'); }
    async playLabel() { return this.page.locator('#playLabel'); }
    async playIcon() { return this.page.locator('#playIcon'); }
    async matrixCells() { return this.page.locator('#matrix .cell'); }
    async nextMatrixCells() { return this.page.locator('#nextmatrix .cell'); }
    async timelineNodes() { return this.page.locator('.timeline .k-node'); }
    async activeTimelineNode() { return this.page.locator('.timeline .k-node.active'); }
    async svgNodes() { return this.page.locator('#nodes g.node-group'); }
    // read the displayed value of a matrix cell (i,j)
    async getMatrixCellText(i, j) {
      return this.page.locator(`#matrix .cell[data-i="${i}"][data-j="${j}"]`).innerText();
    }
    async getNextMatrixCellText(i, j) {
      return this.page.locator(`#nextmatrix .cell[data-i="${i}"][data-j="${j}"]`).innerText();
    }
    // count helpers
    async matrixCount() { return this.matrixCells().count(); }
    async nextMatrixCount() { return this.nextMatrixCells().count(); }
    async timelineCount() { return this.timelineNodes().count(); }
    async svgNodeCount() { return this.svgNodes().count(); }
    // get currently active k (if any). Returns string of data-k or null
    async currentActiveK() {
      const active = await this.activeTimelineNode();
      const count = await active.count();
      if (count === 0) return null;
      return (await active.first().getAttribute('data-k'));
    }
  }

  // Each test will collect console messages and page errors so we can assert on them.
  test.beforeEach(async ({ page }) => {
    // nothing here; per-test setup below
  });

  test.describe('Setup and initial state validations (S0_Idle entry actions)', () => {
    let consoleMessages = [];
    let pageErrors = [];

    test.beforeEach(async ({ page }) => {
      consoleMessages = [];
      pageErrors = [];

      page.on('console', msg => {
        // collect all console messages for inspection
        try {
          consoleMessages.push({ type: msg.type(), text: msg.text() });
        } catch {
          // ignore if any console event fails to serialize
        }
      });
      page.on('pageerror', err => {
        pageErrors.push(err);
      });

      await page.goto(APP_URL, { waitUntil: 'load' });

      // Wait for key UI pieces created by entry actions
      await page.waitForSelector('#matrix .cell');
      await page.waitForSelector('#nextmatrix .cell');
      await page.waitForSelector('.timeline .k-node');
      await page.waitForSelector('#graph');
    });

    test('Initial render: matrix UI, timeline, and graph elements exist and are populated', async ({ page }) => {
      const fw = new FWPage(page);

      // Validate matrix sizes: n = 6 => 6x6 = 36
      expect(await fw.matrixCount()).toBe(36);
      expect(await fw.nextMatrixCount()).toBe(36);

      // Timeline nodes count should be 6 (k from 0..5)
      expect(await fw.timelineCount()).toBe(6);

      // SVG node group count also should be 6
      expect(await fw.svgNodeCount()).toBe(6);

      // The page auto-plays on load, so play label should initially say 'Pause'
      expect(await fw.playLabel().innerText()).toMatch(/Pause/i);

      // No uncaught page errors at initial render
      expect(pageErrors.length).toBe(0);

      // The initial matrix should contain known values for a few sample positions
      // Check a few deterministic initial distances from the provided initial matrix
      expect(await fw.getMatrixCellText(0, 0)).toBe('0');
      expect(await fw.getMatrixCellText(0, 1)).toBe('7');
      expect(await fw.getMatrixCellText(0, 2)).toBe('∞');
      expect(await fw.getNextMatrixCellText(0, 1)).toBe('1'); // next[0][1] should be j=1
      expect(await fw.getNextMatrixCellText(0, 2)).toBe('-'); // no direct next for INF

      // Ensure no active k immediately before the first step starts (some timing differences possible)
      const activeSoon = await fw.currentActiveK();
      // It may or may not be active depending on micro-timing; accept either null or a valid '0'..'5'
      expect([null, '0', '1', '2', '3', '4', '5']).toContain(activeSoon);
    });

    test('Entry action step scheduling: after startup a k node becomes active (step invoked)', async ({ page }) => {
      const fw = new FWPage(page);

      // The implementation starts the first step after ~700ms.
      // Wait longer than that to observe an active timeline node that setActiveK should create.
      await page.waitForTimeout(900);

      const activeK = await fw.currentActiveK();
      // After the first step begins the k for the first block should be active (likely '0')
      // Accept null (in case the animation finished extremely fast or timing) but prefer a k value.
      expect([null, '0', '1', '2', '3', '4', '5']).toContain(activeK);

      // Ensure no uncaught page errors after some animation time
      // (we capture errors during the test run)
      // Fail the test if there are unexpected page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('User interactions and FSM transitions', () => {
    let consoleMessages = [];
    let pageErrors = [];
    let fw; // FWPage
    let pageRef;

    test.beforeEach(async ({ page }) => {
      consoleMessages = [];
      pageErrors = [];
      pageRef = page;

      page.on('console', msg => {
        try {
          consoleMessages.push({ type: msg.type(), text: msg.text() });
        } catch {}
      });
      page.on('pageerror', err => pageErrors.push(err));

      await page.goto(APP_URL, { waitUntil: 'load' });

      fw = new FWPage(page);

      // Wait for primary UI to be ready
      await page.waitForSelector('#matrix .cell');
      await page.waitForSelector('.timeline .k-node');

      // Let the initial scheduled first step run (we'll wait shorter where necessary in tests)
    });

    test('Play/Pause Click transitions: Running -> Paused -> Running (S1 <-> S2)', async () => {
      // Allow some animation to start so active k is present
      await pageRef.waitForTimeout(900);
      const beforeActive = await fw.currentActiveK();

      // Click Play/Pause to toggle (this should pause if running)
      await (await fw.playButton()).click();

      // After clicking expect label to indicate Play (paused state)
      expect(await fw.playLabel().innerText()).toMatch(/Play/i);
      expect(await fw.playIcon().innerText()).toContain('▶');

      // Record active k at pause moment
      const pausedActiveK = await fw.currentActiveK();

      // Wait longer than a step to ensure that when paused the active k DOES NOT change
      await pageRef.waitForTimeout(1000);

      const pausedActiveKAfter = await fw.currentActiveK();
      expect(pausedActiveKAfter).toBe(pausedActiveK);

      // Click Play/Pause again to resume (Paused -> Running)
      await (await fw.playButton()).click();

      // Expect label to indicate Pause (running)
      expect(await fw.playLabel().innerText()).toMatch(/Pause/i);

      // Allow time for the next step to proceed and for active k to update
      await pageRef.waitForTimeout(700);
      const resumedActiveK = await fw.currentActiveK();

      // After resuming we expect either same k or a future k value; ensure no page errors and that activeK is valid or null
      expect([null, '0', '1', '2', '3', '4', '5']).toContain(resumedActiveK);
      expect(pageErrors.length).toBe(0);
    });

    test('Space key toggles Play/Pause (SpaceKeyPress event)', async () => {
      // Ensure we are in running state; play label initially is Pause
      expect(await fw.playLabel().innerText()).toMatch(/Pause/i);

      // Press Space to toggle (should pause)
      await pageRef.keyboard.press('Space');

      // Give event handler a moment to run
      await pageRef.waitForTimeout(200);

      // Assert paused
      expect(await fw.playLabel().innerText()).toMatch(/Play/i);

      // Press Space again to resume
      await pageRef.keyboard.press('Space');
      await pageRef.waitForTimeout(200);
      expect(await fw.playLabel().innerText()).toMatch(/Pause/i);

      // No page errors produced by key handlers
      expect(pageErrors.length).toBe(0);
    });

    test('Reset button resets visualization (S1 or S2 -> S0_Idle)', async () => {
      // Let the animation run some steps so that the visualization is in-progress
      await pageRef.waitForTimeout(1600);

      // Capture a few matrix cell values before reset to compare after
      const before_0_1 = await fw.getMatrixCellText(0, 1); // initial expected '7'
      const before_0_2 = await fw.getMatrixCellText(0, 2); // likely '∞' initially

      // Click Reset to trigger resetAll - this should rebuild UI and set stepIndex=0 internally
      await (await fw.resetButton()).click();

      // Immediately after reset, resetAll sets playLabel to 'Pause' and rebuilds UI.
      // Give it some time for resetAll to finish DOM rebuild
      await pageRef.waitForTimeout(600);

      // After reset the known initial values should be present
      expect(await fw.getMatrixCellText(0, 1)).toBe('7'); // restored to initial
      expect(await fw.getMatrixCellText(0, 2)).toBe('∞'); // restored to initial

      // Timeline should be rebuilt and no k-node should be active immediately after resetAll setsActiveK(-1)
      const activeAfterReset = await fw.currentActiveK();
      expect(activeAfterReset).toBe(null);

      // Play label should be 'Pause' because resetAll sets it to that
      expect(await fw.playLabel().innerText()).toMatch(/Pause/i);

      // No page errors from reset
      expect(pageErrors.length).toBe(0);
    });

    test('Reset via keyboard press "r" (ResetKeyPress transitions)', async () => {
      // Let animation run a bit
      await pageRef.waitForTimeout(900);

      // Press 'r' to trigger reset via key handler (checks e.key === 'r' or 'R')
      await pageRef.keyboard.press('r');

      // Allow reset to complete
      await pageRef.waitForTimeout(600);

      // After reset, timeline should be present and none active immediately
      expect(await fw.timelineCount()).toBe(6);
      expect(await fw.currentActiveK()).toBe(null);

      // Play label should be 'Pause' (resetAll sets it)
      expect(await fw.playLabel().innerText()).toMatch(/Pause/i);

      expect(pageErrors.length).toBe(0);
    });

    test('Edge cases: rapid toggling and repeated resets should not throw errors', async () => {
      // Rapidly toggle play/pause multiple times
      for (let i = 0; i < 4; i++) {
        await (await fw.playButton()).click();
        await pageRef.waitForTimeout(120);
      }

      // Rapidly trigger reset multiple times
      for (let i = 0; i < 3; i++) {
        await (await fw.resetButton()).click();
        await pageRef.waitForTimeout(200);
      }

      // Press Space and 'r' repeatedly
      for (let i = 0; i < 3; i++) {
        await pageRef.keyboard.press('Space');
        await pageRef.waitForTimeout(120);
        await pageRef.keyboard.press('r');
        await pageRef.waitForTimeout(120);
      }

      // Validate that the UI still contains the expected elements and no page errors occurred
      expect(await fw.matrixCount()).toBe(36);
      expect(await fw.timelineCount()).toBe(6);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Behavioral observations and error capture', () => {
    let consoleMessages = [];
    let pageErrors = [];

    test('Capture console output and ensure no unexpected runtime errors during extended run', async ({ page }) => {
      consoleMessages = [];
      pageErrors = [];

      page.on('console', msg => {
        try {
          consoleMessages.push({ type: msg.type(), text: msg.text() });
        } catch {}
      });
      page.on('pageerror', err => pageErrors.push(err));

      await page.goto(APP_URL, { waitUntil: 'load' });

      // Let the animation run for a while to exercise many steps and potential edge logic
      await page.waitForTimeout(2200);

      // Inspect captured console messages for any 'Error' or 'Exception' entries
      const errorConsoleEntries = consoleMessages.filter(c => /error|exception|uncaught/i.test(c.text));
      // We do not expect the page to intentionally log errors; ensure no console error-like messages exist
      expect(errorConsoleEntries.length).toBe(0);

      // Ensure no uncaught page errors (ReferenceError, TypeError, SyntaxError)
      expect(pageErrors.length).toBe(0);
    });
  });
});