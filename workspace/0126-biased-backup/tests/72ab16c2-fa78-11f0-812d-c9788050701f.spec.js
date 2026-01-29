import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ab16c2-fa78-11f0-812d-c9788050701f.html';

// Page Object Model to encapsulate interactions and queries for the visualization page
class VisualizationPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    // Navigate and wait for DOMContentLoaded so the script's DOMContentLoaded handler runs
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Give a short time for particle creation etc.
    await this.page.waitForTimeout(200);
  }

  async clickAnimate() {
    await this.page.click('#animateBtn');
  }

  async clickReset() {
    await this.page.click('#resetBtn');
  }

  // Returns the computed height in pixels (number) for a given bar id
  async getComputedHeightPx(id) {
    return await this.page.evaluate((sel) => {
      const el = document.getElementById(sel);
      if (!el) return null;
      const cs = window.getComputedStyle(el);
      return parseFloat(cs.height);
    }, id);
  }

  // Returns the inline style height (as seen in element.style.height) or null if not set
  async getInlineHeightPx(id) {
    return await this.page.evaluate((sel) => {
      const el = document.getElementById(sel);
      if (!el) return null;
      const h = el.style.height;
      return h ? parseFloat(h) : null;
    }, id);
  }

  // Returns number of active animations on element
  async getAnimationCount(id) {
    return await this.page.evaluate((sel) => {
      const el = document.getElementById(sel);
      if (!el || typeof el.getAnimations !== 'function') return 0;
      return el.getAnimations().length;
    }, id);
  }

  // Utility to wait until animations settle (timeout in ms)
  async wait(ms) {
    await this.page.waitForTimeout(ms);
  }
}

test.describe('Big-O Notation Visualization - FSM and Interaction Tests', () => {
  let viz;
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for assertions
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // capture thrown exceptions on the page (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    viz = new VisualizationPage(page);
    await viz.goto();
  });

  test.describe('State S0_Idle (Initial Render)', () => {
    test('Initial render shows control buttons and graph bars with expected initial heights', async ({ page }) => {
      // Validate presence of Animate Growth and Reset buttons
      const animateBtn = await page.$('#animateBtn');
      const resetBtn = await page.$('#resetBtn');
      expect(animateBtn).not.toBeNull();
      expect(resetBtn).not.toBeNull();
      expect(await animateBtn.textContent()).toContain('Animate Growth');
      expect(await resetBtn.textContent()).toContain('Reset');

      // Verify initial inline heights from HTML attributes match expected values
      // (these represent the Idle state's visual evidence)
      const o1Inline = await viz.getInlineHeightPx('o1');
      const olognInline = await viz.getInlineHeightPx('ologn');
      const onInline = await viz.getInlineHeightPx('on');
      const on2Inline = await viz.getInlineHeightPx('on2');
      const o2nInline = await viz.getInlineHeightPx('o2n');

      expect(o1Inline).toBeCloseTo(30, 0); // 30px
      expect(olognInline).toBeCloseTo(80, 0); // 80px
      expect(onInline).toBeCloseTo(200, 0); // 200px
      expect(on2Inline).toBeCloseTo(400, 0); // 400px
      expect(o2nInline).toBeCloseTo(600, 0); // 600px

      // Ensure no runtime page errors were thrown during initial render
      const criticalErrors = pageErrors.filter(e =>
        /ReferenceError|SyntaxError|TypeError/.test(e.message)
      );
      // Expectation: No critical errors on initial load.
      expect(criticalErrors.length).toBe(0);
    });
  });

  test.describe('Transition: AnimateGrowth (S0 -> S1_Animating)', () => {
    test('Clicking Animate Growth starts animations and increases bar heights appropriately', async () => {
      // Click Animate Growth to trigger animateGrowth() (entry action for S1_Animating)
      await viz.clickAnimate();

      // Immediately after clicking, there should be active animations on some elements.
      // Check that at least one animation exists on a significant bar (e.g., 'on' or 'o2n').
      const animCountOn = await viz.getAnimationCount('on');
      const animCountO2n = await viz.getAnimationCount('o2n');
      expect(Math.max(animCountOn, animCountO2n)).toBeGreaterThanOrEqual(1);

      // Wait for animations to complete (animateGrowth uses ~3000ms durations)
      await viz.wait(3500);

      // After animations, computed heights should reflect grown values.
      const o1Computed = await viz.getComputedHeightPx('o1'); // stays 30
      const olognComputed = await viz.getComputedHeightPx('ologn'); // should grow to ~120
      const onComputed = await viz.getComputedHeightPx('on'); // should grow to ~400
      const on2Computed = await viz.getComputedHeightPx('on2'); // should grow to ~700
      const o2nComputed = await viz.getComputedHeightPx('o2n'); // should grow to ~900

      // o1 shouldn't change (30px)
      expect(o1Computed).toBeGreaterThanOrEqual(28);
      expect(o1Computed).toBeLessThanOrEqual(40);

      // other bars should be noticeably larger than their initial values
      expect(olognComputed).toBeGreaterThan(100); // expected ~120
      expect(onComputed).toBeGreaterThan(350); // expected ~400
      expect(on2Computed).toBeGreaterThan(650); // expected ~700
      expect(o2nComputed).toBeGreaterThan(850); // expected ~900

      // Verify no fatal JS errors occurred while animating
      const criticalErrors = pageErrors.filter(e =>
        /ReferenceError|SyntaxError|TypeError/.test(e.message)
      );
      expect(criticalErrors.length).toBe(0);
    });

    test('Rapid multiple clicks on Animate Growth do not crash the page and reach final state', async () => {
      // Simulate rapid clicks
      await viz.clickAnimate();
      await viz.clickAnimate();
      await viz.clickAnimate();

      // Allow animations to run out
      await viz.wait(4000);

      // Ensure final heights approximate the expected animated final values
      const onComputed = await viz.getComputedHeightPx('on');
      const o2nComputed = await viz.getComputedHeightPx('o2n');

      expect(onComputed).toBeGreaterThanOrEqual(390);
      expect(o2nComputed).toBeGreaterThanOrEqual(850);

      // No critical errors on repeated triggers
      const criticalErrors = pageErrors.filter(e =>
        /ReferenceError|SyntaxError|TypeError/.test(e.message)
      );
      expect(criticalErrors.length).toBe(0);
    });
  });

  test.describe('Transitions: Reset (S1_Animating -> S0_Idle and S0_Idle -> S2_Resetting)', () => {
    test('Clicking Reset after animation returns bars to initial heights (S1_Animating -> S0_Idle)', async () => {
      // Trigger animation
      await viz.clickAnimate();
      await viz.wait(3500);

      // Now click Reset to execute resetGrowth()
      await viz.clickReset();

      // Small delay for styles to be applied
      await viz.wait(100);

      // Inline style heights should equal initial values as resetGrowth sets them directly
      const o1Inline = await viz.getInlineHeightPx('o1');
      const olognInline = await viz.getInlineHeightPx('ologn');
      const onInline = await viz.getInlineHeightPx('on');
      const on2Inline = await viz.getInlineHeightPx('on2');
      const o2nInline = await viz.getInlineHeightPx('o2n');

      expect(o1Inline).toBeCloseTo(30, 0);
      expect(olognInline).toBeCloseTo(80, 0);
      expect(onInline).toBeCloseTo(200, 0);
      expect(on2Inline).toBeCloseTo(400, 0);
      expect(o2nInline).toBeCloseTo(600, 0);

      // Confirm computed heights are also close to these values
      const o1Computed = await viz.getComputedHeightPx('o1');
      const onComputed = await viz.getComputedHeightPx('on');
      expect(o1Computed).toBeGreaterThanOrEqual(28);
      expect(onComputed).toBeGreaterThanOrEqual(190);

      // Ensure no critical JS errors occurred
      const criticalErrors = pageErrors.filter(e =>
        /ReferenceError|SyntaxError|TypeError/.test(e.message)
      );
      expect(criticalErrors.length).toBe(0);
    });

    test('Clicking Reset from Idle keeps bars at initial heights (S0_Idle -> S2_Resetting)', async () => {
      // From idle, click Reset (should be idempotent)
      await viz.clickReset();

      // Allow style changes to apply
      await viz.wait(50);

      // Inline heights should equal the initial declared values
      const o2nInline = await viz.getInlineHeightPx('o2n');
      expect(o2nInline).toBeCloseTo(600, 0);

      // No critical JS errors thrown by calling reset in idle
      const criticalErrors = pageErrors.filter(e =>
        /ReferenceError|SyntaxError|TypeError/.test(e.message)
      );
      expect(criticalErrors.length).toBe(0);
    });

    test('Edge case: animate then immediate reset cancels growth and sets initial heights', async () => {
      // Click animate and almost immediately reset
      await viz.clickAnimate();
      // Immediately click reset before animation completes
      await viz.clickReset();

      // Allow time for reset to apply
      await viz.wait(50);

      // Heights should be the reset values
      const onInline = await viz.getInlineHeightPx('on');
      const o2nInline = await viz.getInlineHeightPx('o2n');
      expect(onInline).toBeCloseTo(200, 0);
      expect(o2nInline).toBeCloseTo(600, 0);

      // Confirm no critical errors occurred during the rapid transition
      const criticalErrors = pageErrors.filter(e =>
        /ReferenceError|SyntaxError|TypeError/.test(e.message)
      );
      expect(criticalErrors.length).toBe(0);
    });
  });

  test.describe('Observability: Console and Page Errors', () => {
    test('No unexpected console errors or thrown page errors during normal interactions', async () => {
      // Interact: animate -> wait -> reset
      await viz.clickAnimate();
      await viz.wait(3500);
      await viz.clickReset();
      await viz.wait(100);

      // Check captured console messages for 'error' type
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      // The application is expected to run without console.error messages
      expect(consoleErrors.length).toBe(0);

      // Check for thrown page errors (uncaught exceptions)
      const criticalErrors = pageErrors.filter(e =>
        /ReferenceError|SyntaxError|TypeError/.test(e.message)
      );

      // Expectation: No uncaught ReferenceError/SyntaxError/TypeError occurred
      expect(criticalErrors.length).toBe(0);

      // For visibility: if any console warnings exist, they don't cause test failure,
      // but we assert that they are not errors.
      const consoleWarnings = consoleMessages.filter(m => m.type === 'warning');
      // Just assert that the warnings are an array (existence check)
      expect(Array.isArray(consoleWarnings)).toBe(true);
    });
  });
});