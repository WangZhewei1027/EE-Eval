import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f89de0-fa77-11f0-a6a1-c765f41a13c7.html';

test.describe('SDLC Visual Exploration - Autoplay FSM tests (f1f89de0-fa77-11f0-a6a1-c765f41a13c7)', () => {
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Collect console errors and page errors for assertions later.
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Load the page exactly as-is.
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Ensure the primary elements are present before running tests.
    await expect(page.locator('#toggleAuto')).toBeVisible();
    await expect(page.locator('#toggleLabel')).toBeVisible();
    await expect(page.locator('#phaseHeading')).toBeVisible();
    await expect(page.locator('#nodesContainer')).toBeVisible();
  });

  test.afterEach(async () => {
    // nothing to teardown beyond automatic Playwright cleanup
  });

  test.describe('State S0_Idle (Initial Idle)', () => {
    test('Initial page loads in Idle state with correct attributes and content', async ({ page }) => {
      // Validate the toggle button reflects Idle state (S0_Idle)
      const toggle = page.locator('#toggleAuto');
      const label = page.locator('#toggleLabel');

      // Expect aria-pressed false and label 'Autoplay'
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await expect(label).toHaveText('Autoplay');

      // Validate panel shows Planning as initial active phase
      await expect(page.locator('#phaseHeading')).toHaveText('Planning');
      await expect(page.locator('#phaseDesc')).toContainText('Establish vision, goals');

      // Validate nodes were created and initial active node exists (class added by JS)
      const nodes = page.locator('#nodesContainer .node');
      await expect(nodes).toHaveCount(7); // 7 stages in the FSM data

      // Timeline initial width should be 14% (Math.round((1/7)*100) = 14)
      const timelineFill = page.locator('#timelineFill');
      await expect(timelineFill).toHaveCSS('width', /14%|14px|14/); // allow flexible match

      // No runtime errors should have been emitted while loading the idle state
      expect(consoleErrors.length, 'console errors on load').toBe(0);
      expect(pageErrors.length, 'page errors on load').toBe(0);
    });
  });

  test.describe('ToggleAutoplay (Click) transitions', () => {
    test('Clicking toggle: Idle -> Autoplay On (S1_AutoplayOn) entry actions observed', async ({ page }) => {
      const toggle = page.locator('#toggleAuto');
      const label = page.locator('#toggleLabel');
      const svg = toggle.locator('svg');

      // Click to start autoplay
      await toggle.click();

      // After startAuto() should run: aria-pressed true and label changes
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await expect(label).toHaveText('Autoplay: On');

      // SVG should have changed to a "pause" like path (pause icon path present)
      const svgContent = await svg.innerHTML();
      expect(svgContent.includes('M6 5h4v14H6z') || svgContent.includes('M6 5h4v14H6'), 'svg changed to pause icon').toBe(true);

      // No runtime errors created by clicking to start autoplay
      expect(consoleErrors.length, 'console errors after starting autoplay').toBe(0);
      expect(pageErrors.length, 'page errors after starting autoplay').toBe(0);

      // Clean up: stop autoplay to leave page in deterministic state for next tests
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await expect(label).toHaveText('Autoplay');
    });

    test('Clicking toggle when Autoplay is on: Autoplay On -> Autoplay Off (S2_AutoplayOff)', async ({ page }) => {
      const toggle = page.locator('#toggleAuto');
      const label = page.locator('#toggleLabel');

      // Start autoplay
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await expect(label).toHaveText('Autoplay: On');

      // Click again to stop autoplay
      await toggle.click();

      // Expect onExit/stopAuto side-effects: aria-pressed false and label reset
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await expect(label).toHaveText('Autoplay');

      // Ensure svg returned to 'play' path
      const svgInner = await toggle.locator('svg').innerHTML();
      expect(svgInner.includes('M5 3v18l15-9L5 3z') || svgInner.includes('M5 3v18'), 'svg changed back to play icon').toBe(true);

      // No errors from rapid toggling
      expect(consoleErrors.length, 'console errors after toggling off').toBe(0);
      expect(pageErrors.length, 'page errors after toggling off').toBe(0);
    });

    test('Rapid double clicks result in consistent toggle state (edge case)', async ({ page }) => {
      const toggle = page.locator('#toggleAuto');
      const label = page.locator('#toggleLabel');

      // Ensure starting from off
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');

      // Double click quickly
      await toggle.click();
      await toggle.click();

      // Since two clicks, state should be same as initial (off)
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await expect(label).toHaveText('Autoplay');

      // No runtime errors on rapid interaction
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('ToggleAutoplayKeyboard (Keyboard) transitions', () => {
    test('Pressing Enter on the toggle triggers keyboard handler and toggles autoplay (Enter)', async ({ page }) => {
      const toggle = page.locator('#toggleAuto');
      const label = page.locator('#toggleLabel');

      // Focus the toggle and press Enter to toggle
      await toggle.focus();
      await page.keyboard.press('Enter');

      // Expect aria-pressed true and label updated
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await expect(label).toHaveText('Autoplay: On');

      // Press Enter again to toggle off
      await page.keyboard.press('Enter');
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await expect(label).toHaveText('Autoplay');

      // No console/page errors from keyboard usage
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Pressing Space on the toggle triggers keyboard handler and toggles autoplay (Space)', async ({ page }) => {
      const toggle = page.locator('#toggleAuto');
      const label = page.locator('#toggleLabel');

      // Focus and press Space to toggle on
      await toggle.focus();
      await page.keyboard.press('Space');

      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await expect(label).toHaveText('Autoplay: On');

      // Press Space again to toggle off
      await page.keyboard.press('Space');
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await expect(label).toHaveText('Autoplay');

      // No console/page errors from space key interactions
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Autoplay behavior over time and UI updates', () => {
    test('Autoplay cycles stages automatically (S1 behavior) and updates timeline & panel', async ({ page }) => {
      const toggle = page.locator('#toggleAuto');
      const phaseHeading = page.locator('#phaseHeading');
      const timelineFill = page.locator('#timelineFill');

      // Record initial phase
      const initialPhase = await phaseHeading.textContent();
      const initialTimelineWidth = await timelineFill.evaluate(el => el.style.width);

      // Start autoplay
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');

      // Wait slightly longer than one stepDuration (2600ms) so the active stage should advance at least once
      await page.waitForTimeout(2800);

      const newPhase = await phaseHeading.textContent();
      const newTimelineWidth = await timelineFill.evaluate(el => el.style.width);

      // Verify that phase heading and timeline changed as autoplay progressed
      expect(newPhase, 'phase should change after autoplay tick').not.toBe(initialPhase);
      expect(newTimelineWidth, 'timeline width should update after autoplay tick').not.toBe(initialTimelineWidth);

      // Stop autoplay to clean up
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');

      // No console/page errors due to autoplay cycling
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    }, { timeout: 15_000 }); // allow extra time for timing-sensitive behavior
  });

  test.describe('Robustness and error-checking', () => {
    test('No unexpected runtime errors during a series of interactions (sanity)', async ({ page }) => {
      const toggle = page.locator('#toggleAuto');

      // Perform a mix of interactions: click, keyboard, wait, resize
      await toggle.click(); // on
      await page.waitForTimeout(200);
      await page.keyboard.press('Enter'); // off
      await page.waitForTimeout(200);
      await toggle.click(); // on
      await page.waitForTimeout(200);

      // Trigger a resize event to exercise resize handler
      await page.setViewportSize({ width: 800, height: 800 });
      await page.waitForTimeout(150);

      // Stop autoplay if it's running
      const aria = await toggle.getAttribute('aria-pressed');
      if (aria === 'true') {
        await toggle.click();
      }

      // Final error assertions: expect no pageErrors or console errors captured
      expect(pageErrors.length, 'no uncaught page errors during mixed interactions').toBe(0);
      expect(consoleErrors.length, 'no console.error messages during mixed interactions').toBe(0);
    });
  });
});