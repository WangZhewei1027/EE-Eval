import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ab8bf1-fa78-11f0-812d-c9788050701f.html';

// Page Object Model for the Context Switching app
class ContextSwitchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Navigates to the page
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Returns numeric offsetLeft of the task card (data-task="n")
  async taskOffsetLeft(taskNumber) {
    return await this.page.$eval(
      `.task-card[data-task="${taskNumber}"]`,
      (el) => el.offsetLeft
    );
  }

  // Returns numeric left style of focus beam (in px)
  async focusBeamLeft() {
    // If style.left is empty string for some reason, also compute computedLeft via getBoundingClientRect relative offsetParent
    return await this.page.$eval('#focusBeam', (el) => {
      const leftStyle = el.style.left;
      if (leftStyle && leftStyle.endsWith('px')) return parseFloat(leftStyle);
      // Fallback: try to get offsetLeft (should match the code's usage)
      return el.offsetLeft;
    });
  }

  // Returns opacity of the focus beam as number
  async focusBeamOpacity() {
    return await this.page.$eval('#focusBeam', (el) => {
      const v = el.style.opacity;
      if (v) return parseFloat(v);
      return parseFloat(getComputedStyle(el).opacity || '0');
    });
  }

  // Clicks the switch button
  async clickSwitchBtn() {
    await this.page.click('#switchBtn');
  }

  // Returns array of line elements style.width values (strings)
  async contextLinesWidths() {
    return await this.page.$$eval('.line', (els) => els.map((el) => el.style.width || getComputedStyle(el).width || '0'));
  }

  // Returns array of line elements style.background values
  async contextLinesBackgrounds() {
    return await this.page.$$eval('.line', (els) => els.map((el) => el.style.background || getComputedStyle(el).background));
  }

  // Waits for the next transition to finish (switchContext uses setTimeout 1000ms)
  async waitForTransitionComplete(timeout = 2000) {
    await this.page.waitForTimeout(timeout);
  }

  // Returns count of task cards
  async taskCardCount() {
    return await this.page.$$eval('.task-card', (els) => els.length);
  }

  // Check whether the switch button exists
  async switchButtonExists() {
    return await this.page.$('#switchBtn') !== null;
  }
}

test.describe('Context Switching | Cognitive Flow Visualization (FSM validation)', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];
    consoleMessages = [];

    // Collect page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Collect console messages and specifically console.error entries
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // No navigation here; each test will navigate via page object
  });

  test.afterEach(async () => {
    // Nothing global to teardown beyond the listeners which are attached to the page and cleared by Playwright automatically.
  });

  test('Initial state (S0_Idle) renders correctly and focusBeam is on Task 1', async ({ page }) => {
    // This test validates initial rendering corresponding to S0_Idle:
    // - Controls and button exist
    // - There are 3 task cards
    // - focusBeam left corresponds to task 1 offsetLeft
    // - focusBeam opacity is 1 (visible)
    const app = new ContextSwitchPage(page);
    await app.goto();

    // Basic DOM existence
    expect(await app.switchButtonExists()).toBeTruthy();
    expect(await app.taskCardCount()).toBe(3);

    // Verify focus beam initial position and visibility
    const task1Left = await app.taskOffsetLeft(1);
    const beamLeft = await app.focusBeamLeft();
    const beamOpacity = await app.focusBeamOpacity();

    // The implementation sets: focusBeam.style.left = taskCards[0].offsetLeft + 'px'; focusBeam.style.opacity = '1';
    expect(beamLeft).toBeCloseTo(task1Left, 0); // integer px equality
    expect(beamOpacity).toBeGreaterThanOrEqual(1); // should be 1

    // Assert no page-level uncaught errors or console errors occurred during load
    expect(pageErrors.map(e => e.message)).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('TriggerContextSwitch button cycles focus: Task1 -> Task2 -> Task3 -> Task1', async ({ page }) => {
    // This test validates the user-triggered transitions and final positions.
    // Because the implementation uses a 1s internal delay for moving the focus beam,
    // we wait slightly longer than 1s after each click to validate final state.
    const app = new ContextSwitchPage(page);
    await app.goto();

    // Capture initial state (Task 1)
    const left1 = await app.taskOffsetLeft(1);
    const left2 = await app.taskOffsetLeft(2);
    const left3 = await app.taskOffsetLeft(3);

    expect(await app.focusBeamLeft()).toBeCloseTo(left1, 0);
    expect(await app.focusBeamOpacity()).toBeGreaterThanOrEqual(1);

    // Click -> should move to Task 2
    await app.clickSwitchBtn();
    // Immediately after clicking the focus fades out (opacity 0). Check that quickly.
    // It's possible the style change is immediate; allow a small wait and assert opacity becomes 0.
    await page.waitForTimeout(50);
    const opacityDuring = await app.focusBeamOpacity();
    expect(opacityDuring).toBeLessThan(1);

    // Wait for transition to complete (setTimeout 1000ms in implementation)
    await app.waitForTransitionComplete(1200);
    const beamLeftAfter1 = await app.focusBeamLeft();
    const beamOpacityAfter1 = await app.focusBeamOpacity();
    expect(beamLeftAfter1).toBeCloseTo(left2, 0);
    expect(beamOpacityAfter1).toBeGreaterThanOrEqual(1);

    // Second click -> Task 3
    await app.clickSwitchBtn();
    await page.waitForTimeout(50);
    expect(await app.focusBeamOpacity()).toBeLessThan(1);
    await app.waitForTransitionComplete(1200);
    const beamLeftAfter2 = await app.focusBeamLeft();
    expect(beamLeftAfter2).toBeCloseTo(left3, 0);

    // Third click -> wrap back to Task 1
    await app.clickSwitchBtn();
    await page.waitForTimeout(50);
    expect(await app.focusBeamOpacity()).toBeLessThan(1);
    await app.waitForTransitionComplete(1200);
    const beamLeftAfter3 = await app.focusBeamLeft();
    expect(beamLeftAfter3).toBeCloseTo(left1, 0);

    // Verify no uncaught page errors or console errors happened during interactions
    expect(pageErrors.map(e => e.message)).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Context lines animate width and reset during a context switch', async ({ page }) => {
    // Validates that context lines gain width and change background when switchContext is triggered,
    // and are reset by the time the transition completes.
    const app = new ContextSwitchPage(page);
    await app.goto();

    // Initially, lines should have width '' or '0' as they are created without explicit width
    const initialWidths = await app.contextLinesWidths();
    // They may be computed widths from CSS; ensure none are a large non-zero number initially (expect small or '0')
    initialWidths.forEach((w) => {
      // treat any width greater than 0 as unexpected before interaction
      if (typeof w === 'string') {
        const n = parseFloat(w) || 0;
        expect(n).toBeLessThanOrEqual(1);
      }
    });

    // Trigger a context switch
    await app.clickSwitchBtn();

    // Shortly after clicking (before setTimeout completes), the switchContext sets line widths and background
    await page.waitForTimeout(100); // check mid-animation
    const midWidths = await app.contextLinesWidths();
    const midBackgrounds = await app.contextLinesBackgrounds();

    // At least one line should have a width greater than 0 and background more opaque than initial
    const anyLineExpanded = midWidths.some((w) => {
      const n = parseFloat(w) || 0;
      return n > 10; // threshold; implementation uses random 100-400px
    });
    expect(anyLineExpanded).toBeTruthy();

    // Backgrounds should have changed to include rgba(255, 255, 255, 0.3) as set in code
    const anyBackgroundChanged = midBackgrounds.some((bg) => typeof bg === 'string' && bg.includes('rgba(255, 255, 255, 0.3)'));
    expect(anyBackgroundChanged).toBeTruthy();

    // After transition completes, lines should reset to width '0' and background to rgba(255, 255, 255, 0.1)
    await app.waitForTransitionComplete(1200);
    const finalWidths = await app.contextLinesWidths();
    const finalBackgrounds = await app.contextLinesBackgrounds();

    finalWidths.forEach((w) => {
      const n = parseFloat(w) || 0;
      expect(n).toBeLessThanOrEqual(1);
    });

    const backgroundsOk = finalBackgrounds.every((bg) => typeof bg === 'string' && (bg.includes('rgba(255, 255, 255, 0.1') || bg.includes('0.1')));
    expect(backgroundsOk).toBeTruthy();

    // Ensure no uncaught errors occurred
    expect(pageErrors.map(e => e.message)).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Rapid clicks do not queue multiple transitions (isAnimating guard)', async ({ page }) => {
    // Validates the edge case where clicking the button rapidly should not cause multiple queued transitions.
    // Implementation uses isAnimating flag to prevent this; we assert only one advancement occurs.
    const app = new ContextSwitchPage(page);
    await app.goto();

    const left1 = await app.taskOffsetLeft(1);
    const left2 = await app.taskOffsetLeft(2);

    // Confirm initial is Task1
    expect(await app.focusBeamLeft()).toBeCloseTo(left1, 0);

    // Click twice quickly (< animation duration)
    await app.clickSwitchBtn();
    // Immediately click again very quickly
    await page.waitForTimeout(50);
    await app.clickSwitchBtn();

    // Wait for transition to finish
    await app.waitForTransitionComplete(1500);

    // Focus should have advanced only one task to Task2
    const finalLeft = await app.focusBeamLeft();
    expect(finalLeft).toBeCloseTo(left2, 0);

    // No page errors
    expect(pageErrors.map(e => e.message)).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('AutoSwitch (interval) triggers transitions every ~8 seconds', async ({ page }) => {
    // This test validates the automatic switching created by setInterval(switchContext, 8000).
    // We do not modify timers; we wait for the natural interval. Because this will take time,
    // the test waits a bit more than 8 seconds for the first automatic transition and then again.
    const app = new ContextSwitchPage(page);
    await app.goto();

    const left1 = await app.taskOffsetLeft(1);
    const left2 = await app.taskOffsetLeft(2);
    const left3 = await app.taskOffsetLeft(3);

    // Initial should be Task1
    expect(await app.focusBeamLeft()).toBeCloseTo(left1, 0);

    // Wait for the auto-switch to trigger (~8s). Wait slightly longer for buffer.
    await page.waitForTimeout(8500);
    // After first interval, the switchContext setTimeout still takes ~1s to move focus, so wait a bit more
    await page.waitForTimeout(1200);

    // Expect it moved to Task2
    const afterFirstAuto = await app.focusBeamLeft();
    expect(afterFirstAuto).toBeCloseTo(left2, 0);

    // Wait another 8+1s to observe next auto-switch to Task3
    await page.waitForTimeout(8500);
    await page.waitForTimeout(1200);
    const afterSecondAuto = await app.focusBeamLeft();
    expect(afterSecondAuto).toBeCloseTo(left3, 0);

    // No uncaught errors during long-running intervals
    expect(pageErrors.map(e => e.message)).toEqual([]);
    expect(consoleErrors).toEqual([]);
  }, /* increase timeout to allow waiting for intervals */ 45000);

  test('Observes console and page errors (should be none for this implementation)', async ({ page }) => {
    // This test ensures we capture console messages and page errors and assert that there are no unexpected runtime exceptions.
    const app = new ContextSwitchPage(page);
    await app.goto();

    // Interact a bit to exercise code paths
    await app.clickSwitchBtn();
    await app.waitForTransitionComplete(1200);

    // Report console messages if any (for debugging in test output)
    // Final assertions: expect no uncaught page errors and no console.error messages
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Additionally assert at least some console messages exist (like informational logs) OR none
    // We won't fail on zero console messages because there may be none.
    // But ensure the captured messages are strings.
    expect(consoleMessages.every(m => typeof m.type === 'string' && typeof m.text === 'string')).toBeTruthy();
  });
});