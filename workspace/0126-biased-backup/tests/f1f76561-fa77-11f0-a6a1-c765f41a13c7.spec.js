import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f76561-fa77-11f0-a6a1-c765f41a13c7.html';

test.describe('Context Switching — Visual Concept (f1f76561)', () => {
  // Page object encapsulating common interactions & queries
  class ContextPage {
    constructor(page) {
      this.page = page;
    }

    async getIndicatorActiveIndex() {
      // returns integer index of the active indicator dot
      return await this.page.evaluate(() => {
        const active = document.querySelector('.dot-ind.active');
        return active ? parseInt(active.dataset.i, 10) : null;
      });
    }

    async getCardClasses(index) {
      return await this.page.evaluate((i) => {
        const el = document.getElementById(`card-${i}`);
        if (!el) return null;
        return Array.from(el.classList);
      }, index);
    }

    async getLabelText() {
      return await this.page.$eval('#labelPulse', el => el.textContent.trim());
    }

    async getContextLabelTitle() {
      return await this.page.$eval('#contextLabel', el => el.getAttribute('title'));
    }

    async getPlayButtonAttributes() {
      return await this.page.$eval('#playBtn', btn => {
        return {
          title: btn.title,
          ariaPressed: btn.getAttribute('aria-pressed'),
          ariaLabel: btn.getAttribute('aria-label'),
        };
      });
    }

    async clickPlay() {
      await this.page.click('#playBtn');
    }

    async clickReset() {
      await this.page.click('#resetBtn');
    }

    async pressSpace() {
      // emulate a real keydown on the window
      await this.page.keyboard.press('Space');
    }

    async waitForIndicatorToBe(expectedIndex, timeout = 5000) {
      await this.page.waitForFunction((expected) => {
        const active = document.querySelector('.dot-ind.active');
        return active && parseInt(active.dataset.i, 10) === expected;
      }, expectedIndex, { timeout });
    }

    async waitForIndicatorToChangeFrom(prevIndex, timeout = 5000) {
      await this.page.waitForFunction((prev) => {
        const active = document.querySelector('.dot-ind.active');
        if (!active) return false;
        return parseInt(active.dataset.i, 10) !== prev;
      }, prevIndex, { timeout });
    }

    async waitForSomeTime(ms) {
      await this.page.waitForTimeout(ms);
    }
  }

  // Collect console errors and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Increase default timeout for navigation & waits in a few tests
    // Listeners set per test via local arrays attached to page
  });

  test.describe('Initial state and automatic behavior', () => {
    test('S0_Active: on load center card & labels are correct and auto-advance runs', async ({ page }) => {
      // Arrays to capture runtime errors and console error messages
      const pageErrors = [];
      const consoleErrors = [];

      page.on('pageerror', (err) => pageErrors.push(err)); // capture uncaught exceptions
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      const ctx = new ContextPage(page);
      // Load the page exactly as-is
      await page.goto(APP_URL, { waitUntil: 'load' });

      // Initial expectations for S0_Active
      // - active should start as index 2 (center)
      const initialActive = await ctx.getIndicatorActiveIndex();
      expect(initialActive).toBe(2);

      // - card-2 should have pos-center and center classes
      const classes = await ctx.getCardClasses(2);
      expect(classes).toContain('pos-center');
      expect(classes).toContain('center');

      // - labelPulse should show Editor • Focus
      const labelText = await ctx.getLabelText();
      expect(labelText).toContain('Editor • Focus');

      // - play button should indicate "Pause animation" (start() was called on init)
      const playAttrs = await ctx.getPlayButtonAttributes();
      expect(playAttrs.title).toMatch(/Pause animation/i);
      expect(playAttrs.ariaPressed).toBe('false');

      // - contextLabel title attribute should be in sync with label text (MutationObserver)
      const contextLabelTitle = await ctx.getContextLabelTitle();
      // It's possible the mutation observer runs asynchronously; wait briefly if needed
      if (!contextLabelTitle || !contextLabelTitle.trim()) {
        // wait a bit for observer to populate
        await page.waitForTimeout(200);
      }
      const updatedTitle = await ctx.getContextLabelTitle();
      expect(updatedTitle).toContain('Editor • Focus');

      // Automatic behavior: after interval (3000ms) a "next" should occur (active becomes 3)
      // Wait a bit longer than the interval to accommodate scheduling
      await ctx.waitForIndicatorToChangeFrom(2, 4500);
      const afterAdvance = await ctx.getIndicatorActiveIndex();
      // It should have advanced to 3
      expect(afterAdvance).toBe(3);

      // Assert no uncaught runtime page errors or console errors were emitted during load and auto-advance
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });

  test.describe('Play/Pause control (S0 <-> S1 transitions) and keyboard toggles', () => {
    test('PlayPauseClick: clicking play button pauses and resumes animation (S0 -> S1 and back)', async ({ page }) => {
      const pageErrors = [];
      const consoleErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

      const ctx = new ContextPage(page);
      await page.goto(APP_URL, { waitUntil: 'load' });

      // Ensure initial running state (should auto-start) and get current active index
      const startIndex = await ctx.getIndicatorActiveIndex();
      expect(startIndex).toBeGreaterThanOrEqual(0);

      // Click play button to pause (stop())
      await ctx.clickPlay();

      // Immediately verify play button attributes reflect paused state
      let playAttrs = await ctx.getPlayButtonAttributes();
      expect(playAttrs.ariaPressed).toBe('true');
      expect(playAttrs.title).toMatch(/Play animation/i);

      // Remember active index and wait longer than interval to verify it does NOT advance while paused
      const pausedIndex = await ctx.getIndicatorActiveIndex();
      await ctx.waitForSomeTime(3500); // > interval (3000ms)
      const currentAfterWait = await ctx.getIndicatorActiveIndex();
      expect(currentAfterWait).toBe(pausedIndex);

      // Click again to resume (start())
      await ctx.clickPlay();

      // Verify play button attributes reflect running state
      playAttrs = await ctx.getPlayButtonAttributes();
      expect(playAttrs.ariaPressed).toBe('false');
      expect(playAttrs.title).toMatch(/Pause animation/i);

      // Now wait for indicator to change (should advance)
      await ctx.waitForIndicatorToChangeFrom(pausedIndex, 4500);
      const resumedIndex = await ctx.getIndicatorActiveIndex();
      expect(resumedIndex).not.toBe(pausedIndex);

      // Also ensure no page errors occurred during toggling
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('SpaceKey: pressing Space toggles play/pause via keyboard', async ({ page }) => {
      const pageErrors = [];
      const consoleErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

      const ctx = new ContextPage(page);
      await page.goto(APP_URL, { waitUntil: 'load' });

      // Ensure running; press Space to toggle to paused
      await ctx.pressSpace();

      let playAttrs = await ctx.getPlayButtonAttributes();
      expect(playAttrs.ariaPressed).toBe('true');

      // Press Space again to resume
      await ctx.pressSpace();
      playAttrs = await ctx.getPlayButtonAttributes();
      expect(playAttrs.ariaPressed).toBe('false');

      // Clean assertions for runtime errors
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });

  test.describe('Reset behavior (S0 -> S2_Reset) and side effects', () => {
    test('ResetClick: clicking reset sets active to first context, stops, then restarts', async ({ page }) => {
      const pageErrors = [];
      const consoleErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

      const ctx = new ContextPage(page);
      await page.goto(APP_URL, { waitUntil: 'load' });

      // Ensure currently not necessarily at 0
      const before = await ctx.getIndicatorActiveIndex();
      // Click reset
      await ctx.clickReset();

      // Immediately after reset, active should be 0
      await ctx.waitForIndicatorToBe(0, 1000);
      let activeAfterReset = await ctx.getIndicatorActiveIndex();
      expect(activeAfterReset).toBe(0);

      // Also reset should have invoked stop() so playBtn should reflect paused state
      let playAttrs = await ctx.getPlayButtonAttributes();
      expect(playAttrs.ariaPressed).toBe('true');
      expect(playAttrs.title).toMatch(/Play animation/i);

      // After 1200ms the start() is called (per implementation). Wait slightly longer and assert it's running.
      await ctx.waitForSomeTime(1400);
      playAttrs = await ctx.getPlayButtonAttributes();
      // start() sets aria-pressed to 'false' and title to "Pause animation"
      expect(playAttrs.ariaPressed).toBe('false');
      expect(playAttrs.title).toMatch(/Pause animation/i);

      // After resuming, indicator should advance from 0 within another interval window
      await ctx.waitForIndicatorToChangeFrom(0, 4500);
      const afterRestartIndex = await ctx.getIndicatorActiveIndex();
      expect(afterRestartIndex).not.toBe(0);

      // No uncaught errors or console errors
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Edge case: rapid multiple reset clicks should keep behavior stable', async ({ page }) => {
      const pageErrors = [];
      const consoleErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

      const ctx = new ContextPage(page);
      await page.goto(APP_URL, { waitUntil: 'load' });

      // Click reset multiple times rapidly
      await Promise.all([
        ctx.clickReset(),
        ctx.clickReset(),
        ctx.clickReset()
      ]);

      // The last reset should still set active to 0 immediately
      await ctx.waitForIndicatorToBe(0, 1000);
      const active0 = await ctx.getIndicatorActiveIndex();
      expect(active0).toBe(0);

      // After scheduled restart (1200ms) it should resume
      await ctx.waitForSomeTime(1400);
      const playAttrs = await ctx.getPlayButtonAttributes();
      expect(playAttrs.ariaPressed).toBe('false');

      // Ensure there were no uncaught errors due to rapid interactions
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });

  test.describe('MutationObserver & accessibility side-effects', () => {
    test('MutationObserver: contextLabel title updates when active context label changes', async ({ page }) => {
      const pageErrors = [];
      const consoleErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

      const ctx = new ContextPage(page);
      await page.goto(APP_URL, { waitUntil: 'load' });

      // initial title should be the initial label (Editor • Focus)
      let initialTitle = await ctx.getContextLabelTitle();
      if (!initialTitle) {
        // allow brief time for mutation observer to set it
        await page.waitForTimeout(200);
        initialTitle = await ctx.getContextLabelTitle();
      }
      expect(initialTitle).toContain('Editor • Focus');

      // Trigger a change by advancing the indicator (let timer run or click play to pause/resume)
      // We'll click play to pause, then click to resume so that a next() happens soon (we wait for change)
      await ctx.clickPlay();  // pause
      await ctx.clickPlay();  // resume

      // Wait for the label to change from Editor • Focus to something else (e.g., Playback • Media or next)
      await ctx.waitForIndicatorToChangeFrom(2, 4500).catch(() => { /* may have advanced earlier */ });

      // Now fetch label text and contextLabel title and ensure they match
      const labelText = await ctx.getLabelText();
      const titleAttr = await ctx.getContextLabelTitle();

      expect(labelText).toBeTruthy();
      expect(titleAttr).toBeTruthy();
      // They should contain the same substring for the active context
      expect(titleAttr).toContain(labelText);

      // No runtime errors must have been thrown
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });

  test.describe('Robustness: rapid play/pause and keyboard spam', () => {
    test('Edge case: rapid toggles via click and space do not throw errors', async ({ page }) => {
      const pageErrors = [];
      const consoleErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

      const ctx = new ContextPage(page);
      await page.goto(APP_URL, { waitUntil: 'load' });

      // Rapidly toggle play/pause via clicking
      for (let i = 0; i < 6; i++) {
        await ctx.clickPlay();
      }

      // Rapidly send space key presses
      for (let i = 0; i < 6; i++) {
        await ctx.pressSpace();
      }

      // Wait a moment to let any asynchronous handlers run
      await ctx.waitForSomeTime(800);

      // Ensure no uncaught page errors or console error logs appeared
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });
});