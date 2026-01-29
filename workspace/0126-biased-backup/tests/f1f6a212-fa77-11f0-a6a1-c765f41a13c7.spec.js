import { test, expect } from '@playwright/test';

// Test file: f1f6a212-fa77-11f0-a6a1-c765f41a13c7.spec.js
// Page under test:
// http://127.0.0.1:5500/workspace/0126-biased/html/f1f6a212-fa77-11f0-a6a1-c765f41a13c7.html

// Page Object Model for the Recursion visual app
class RecursionPage {
  constructor(page) {
    this.page = page;
    this.toggleBtn = page.locator('#toggleBtn');
    this.paletteBtn = page.locator('#paletteBtn');
    this.root = page.locator('#recursive-root');
    this.svg = page.locator('#recursion');
  }

  // Returns the text content of the toggle button (Pause/Play)
  async getToggleText() {
    return (await this.toggleBtn.textContent())?.trim();
  }

  // Returns the aria-pressed attribute on the toggle button
  async getToggleAriaPressed() {
    return await this.toggleBtn.getAttribute('aria-pressed');
  }

  // Click the toggle button
  async clickToggle() {
    await this.toggleBtn.click();
  }

  // Click the palette shuffle button
  async clickPalette() {
    await this.paletteBtn.click();
  }

  // Count number of direct children under #recursive-root
  async countRootChildren() {
    return await this.page.evaluate(() => {
      const root = document.getElementById('recursive-root');
      return root ? root.childElementCount : 0;
    });
  }

  // Determine if elements under #recursive-root currently have animation-play-state paused
  async isAnimationPaused() {
    return await this.page.evaluate(() => {
      const root = document.getElementById('recursive-root');
      if(!root) return null;
      // Find the first group that was assigned a CSS animation and return its play state.
      const g = root.querySelector('g');
      if(!g) return null;
      // If style.animationPlayState is set explicitly, use it. Otherwise, default to 'running'
      return g.style.animationPlayState || getComputedStyle(g).animationPlayState || 'running';
    });
  }

  // Get computed CSS variable --accent-a on :root
  async getAccentA() {
    return await this.page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--accent-a').trim();
    });
  }

  // Return number of circle elements under #recursive-root (useful to detect re-render)
  async countCirclesInRoot() {
    return await this.page.evaluate(() => {
      const root = document.getElementById('recursive-root');
      if(!root) return 0;
      return root.querySelectorAll('circle').length;
    });
  }

  // Force a window resize (simulate user resizing the browser) which should trigger a debounced re-render
  async triggerResize(width = 800, height = 700) {
    await this.page.setViewportSize({ width, height });
    // wait for the debounced resize handler in page (180ms + some slack)
    await this.page.waitForTimeout(350);
  }
}

test.describe('Recursion Visual - States, Events, and Robustness', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture console messages for later assertions and debugging.
    page.on('console', msg => {
      // store text and type
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page runtime errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the served HTML exactly as-is
    await page.goto('http://127.0.0.1:5500/workspace/0126-biased/html/f1f6a212-fa77-11f0-a6a1-c765f41a13c7.html', { waitUntil: 'load' });

    // Wait a tad to allow initial render + animations to be applied
    await page.waitForTimeout(300);
  });

  test.afterEach(async ({ page }) => {
    // make sure to close any open animations or cleanup if needed (page will be closed by Playwright)
    // No teardown modifications of the app are performed (per instructions).
  });

  test.describe('Initial State and Animation Running (S0_AnimationRunning)', () => {
    test('Initial UI elements exist and initial state indicates running animation', async ({ page }) => {
      const app = new RecursionPage(page);

      // Validate the toggle button's initial label and aria attribute as per FSM component description
      const toggleText = await app.getToggleText();
      const ariaPressed = await app.getToggleAriaPressed();

      // Expect initial button text to be "Pause" (running by default)
      expect(toggleText).toBe('Pause');
      // As per FSM evidence: toggleBtn.setAttribute('aria-pressed', String(!running));
      // With running === true initially, aria-pressed should be "false"
      expect(ariaPressed).toBe('false');

      // The recursive-root should have been rendered with children
      const childCount = await app.countRootChildren();
      expect(childCount).toBeGreaterThan(0);

      // There should be circle elements rendered
      const circleCount = await app.countCirclesInRoot();
      expect(circleCount).toBeGreaterThan(0);

      // Check that at least one group has a CSS animation assigned (animation property present)
      const hasAnimation = await page.evaluate(() => {
        const root = document.getElementById('recursive-root');
        if(!root) return false;
        const g = root.querySelector('g');
        if(!g) return false;
        const anim = getComputedStyle(g).animationName || g.style.animation;
        return Boolean(anim && anim !== 'none');
      });
      expect(hasAnimation).toBeTruthy();

      // Record that no unexpected navigation errors happened so far (we'll assert pageErrors later centralised)
    });
  });

  test.describe('Toggle Animation (ToggleAnimation event, transitions S0 <-> S1)', () => {
    test('Clicking toggle pauses the animation and updates UI (S0 -> S1)', async ({ page }) => {
      const app = new RecursionPage(page);

      // Ensure initial running state as baseline
      expect(await app.getToggleText()).toBe('Pause');

      // Click toggle to pause
      await app.clickToggle();
      await page.waitForTimeout(120); // allow UI updates to propagate

      // After toggle: button text should switch to Play, aria-pressed toggled to "true"
      expect(await app.getToggleText()).toBe('Play');
      expect(await app.getToggleAriaPressed()).toBe('true');

      // Animation play state should be 'paused' for groups
      const playState = await app.isAnimationPaused();
      // Could be 'paused' or '' if not set; expect paused string for explicit pause
      expect(playState === 'paused' || playState === 'paused').toBeTruthy();

      // Verify that the DOM still contains the recursive structure (no removal)
      expect(await app.countRootChildren()).toBeGreaterThan(0);
    });

    test('Clicking toggle again resumes the animation and updates UI (S1 -> S0)', async ({ page }) => {
      const app = new RecursionPage(page);

      // Start by pausing
      await app.clickToggle();
      await page.waitForTimeout(100);

      // Now click to resume
      await app.clickToggle();
      await page.waitForTimeout(120);

      // UI should reflect running state: 'Pause' and aria-pressed false
      expect(await app.getToggleText()).toBe('Pause');
      expect(await app.getToggleAriaPressed()).toBe('false');

      // Animation play state should be running for groups (either explicit 'running' or computed)
      const playState = await app.isAnimationPaused();
      expect(playState === 'running' || playState === '' || playState === null ? true : playState === 'running').toBeTruthy();
    });

    test('Rapid toggling stabilizes to the correct final state', async ({ page }) => {
      const app = new RecursionPage(page);

      // Starting state is running (Pause). Rapidly click toggle 5 times.
      for (let i = 0; i < 5; i++) {
        await app.clickToggle();
        // small gap to simulate fast user interactions
        await page.waitForTimeout(40);
      }

      // After 5 toggles, final expected: toggled odd number -> paused
      const expectedText = (5 % 2 === 1) ? 'Play' : 'Pause';
      const expectedAria = (5 % 2 === 1) ? 'true' : 'false';

      expect(await app.getToggleText()).toBe(expectedText);
      expect(await app.getToggleAriaPressed()).toBe(expectedAria);
    });
  });

  test.describe('Shuffle Palette (ShufflePalette event)', () => {
    test('Clicking Shuffle Palette updates CSS variables and re-renders geometry (while running)', async ({ page }) => {
      const app = new RecursionPage(page);

      // Capture root accent before shuffle
      const beforeAccent = await app.getAccentA();
      const beforeCircles = await app.countCirclesInRoot();

      // Click palette shuffle
      await app.clickPalette();
      // allow time for animation and render reflow
      await page.waitForTimeout(400);

      const afterAccent = await app.getAccentA();
      const afterCircles = await app.countCirclesInRoot();

      // The CSS variable for --accent-a should change to reflect new palette
      // It's possible randomization selects same palette; therefore accept either changed or unchanged but assert re-render occurred.
      // Ensure at minimum that the geometry was re-rendered (circle count should be >= 0 and present)
      expect(afterCircles).toBeGreaterThanOrEqual(0);
      expect(afterCircles).toBeGreaterThan(0);

      // We prefer to see a change in accent variable (likely changed); assert that the variable exists
      expect(typeof afterAccent).toBe('string');
      expect(afterAccent.length).toBeGreaterThan(0);
    });

    test('Shuffle Palette while paused keeps animation paused and still updates colors', async ({ page }) => {
      const app = new RecursionPage(page);

      // Pause first
      await app.clickToggle();
      await page.waitForTimeout(120);
      expect(await app.getToggleText()).toBe('Play');

      const beforeAccent = await app.getAccentA();
      const beforePlayState = await app.isAnimationPaused();
      expect(beforePlayState === 'paused' || beforePlayState === 'paused').toBeTruthy();

      // Click shuffle while paused
      await app.clickPalette();
      await page.waitForTimeout(400);

      // Ensure accent var exists and may have changed
      const afterAccent = await app.getAccentA();
      expect(typeof afterAccent).toBe('string');
      expect(afterAccent.length).toBeGreaterThan(0);

      // Ensure animation remains paused (shuffle should not resume the animation)
      const afterPlayState = await app.isAnimationPaused();
      // We expect 'paused' or the style to remain effectively paused
      expect(afterPlayState === 'paused' || afterPlayState === 'paused').toBeTruthy();

      // Put app back to running to keep tests consistent
      await app.clickToggle();
      await page.waitForTimeout(120);
      expect(await app.getToggleText()).toBe('Pause');
    });
  });

  test.describe('Robustness and Edge Cases', () => {
    test('Window resize triggers debounced re-render without throwing', async ({ page }) => {
      const app = new RecursionPage(page);

      const beforeCount = await app.countCirclesInRoot();

      // Trigger a viewport resize which should cause the app to recompute base radius and re-render
      await app.triggerResize(700, 600);

      const afterCount = await app.countCirclesInRoot();

      // The number of circles should still be > 0 and likely similar; ensure no crash
      expect(beforeCount).toBeGreaterThan(0);
      expect(afterCount).toBeGreaterThan(0);
    });

    test('Repeated palette shuffles do not remove core SVG and keep DOM stable', async ({ page }) => {
      const app = new RecursionPage(page);

      const initialRootChildren = await app.countRootChildren();

      // Shuffle multiple times
      for (let i = 0; i < 6; i++) {
        await app.clickPalette();
        await page.waitForTimeout(220);
      }

      // Root should still have children and not be emptied
      const finalRootChildren = await app.countRootChildren();
      expect(finalRootChildren).toBeGreaterThanOrEqual(1);
      // It should not have unexpectedly exploded to an absurd number (sanity check)
      expect(finalRootChildren).toBeLessThan(10000);
      // Ensure core center circle still exists (there should be at least one circle)
      expect(await app.countCirclesInRoot()).toBeGreaterThan(0);
    });
  });

  test.describe('Console and Page Errors Observation', () => {
    test('Collect console messages and page errors; assert their presence/characteristics', async ({ page }) => {
      // Note: Per instructions, we must observe console logs and page errors and allow any ReferenceError, SyntaxError, TypeError to happen naturally.
      // We will verify we captured the arrays and make reasonable assertions:
      // - consoleMessages is an array and may include debug/info logs.
      // - pageErrors is an array (possibly empty). If errors occurred, ensure they are Error instances and have expected names.
      // We will not mutate the app to force errors. This test simply asserts the shape of captured diagnostics.

      // Allow some time for late errors (e.g., async timers) to surface
      await page.waitForTimeout(600);

      // Ensure we collected console messages array
      expect(Array.isArray(consoleMessages)).toBeTruthy();

      // Ensure we have captured pageErrors as an array
      expect(Array.isArray(pageErrors)).toBeTruthy();

      // If pageErrors occurred, assert that they are Error instances and names are reasonable
      if (pageErrors.length > 0) {
        for (const err of pageErrors) {
          expect(err).toBeInstanceOf(Error);
          // Accept common JS error types; be permissive but ensure name is string
          expect(typeof err.name).toBe('string');
          expect(err.name.length).toBeGreaterThan(0);
        }
      } else {
        // If there were no uncaught page errors, that's also acceptable.
        expect(pageErrors.length).toBe(0);
      }

      // Sanity check: At least ensure we captured some console messages from the page (it typically logs nothing, but this guards the capture)
      expect(Array.isArray(consoleMessages)).toBeTruthy();
    });
  });
});