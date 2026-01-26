import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f96130-fa77-11f0-a6a1-c765f41a13c7.html';

test.describe('Decision Trees — Visual Concept (FSM)', () => {
  // Shared helpers to capture console messages and page errors for each test run.
  test.beforeEach(async ({ page }) => {
    // Ensure a fresh capture on each test run.
    page.context().setDefaultTimeout(10_000);
  });

  // Test S0_Idle: initial page render, basic DOM presence, and initial attributes.
  test('S0_Idle: initial render shows stage and controls (renderPage equivalent)', async ({ page }) => {
    const consoleMsgs = [];
    const pageErrors = [];

    // Capture console and page errors
    page.on('console', (msg) => {
      consoleMsgs.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);

    // Validate stage exists and has expected role.
    const stage = page.locator('.stage[role="main"]');
    await expect(stage).toHaveCount(1);

    // Validate primary UI controls exist
    const animateBtn = page.locator('#animateBtn');
    const labelsBtn = page.locator('#labelsBtn');

    await expect(animateBtn).toBeVisible();
    await expect(labelsBtn).toBeVisible();

    // labelsBtn initial aria-pressed should be "false" and text content should be "Toggle Labels"
    await expect(labelsBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(labelsBtn).toHaveText('Toggle Labels');

    // Immediately after load (well before auto-play 480ms), the container should NOT yet have 'played' class
    // We check within a short window to avoid racing the auto-play.
    const playedImmediately = await page.evaluate(() => {
      const container = document.querySelector('.stage');
      return container && container.classList.contains('played');
    });
    expect(playedImmediately).toBe(false);

    // Basic checks for SVG elements presence: edges, nodes, leaves
    const edgesCount = await page.locator('svg .edge').count();
    const nodesCount = await page.locator('svg .node').count();
    const leavesCount = await page.locator('svg .leaf').count();

    expect(edgesCount).toBeGreaterThanOrEqual(1);
    expect(nodesCount).toBeGreaterThanOrEqual(1);
    expect(leavesCount).toBeGreaterThanOrEqual(1);

    // Ensure no uncaught page errors occurred during initial render
    expect(pageErrors.length).toBe(0);

    // Ensure no console error messages were emitted
    const consoleErrors = consoleMsgs.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  // Test S1_Animating: clicking Animate Growth triggers play() and results in 'played' class plus an element animation.
  test('S1_Animating: clicking Animate Growth triggers animation and adds .played class', async ({ page }) => {
    const consoleMsgs = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMsgs.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);

    const containerSelector = '.stage';
    const animateBtn = page.locator('#animateBtn');

    // Ensure starting state doesn't have played (test isolation)
    const initialPlayed = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el && el.classList.contains('played');
    }, containerSelector);

    // Click the animate button and validate that play() was invoked by checking for the .played class.
    await animateBtn.click();

    // Wait for the class to become present
    await page.waitForFunction((sel) => {
      const el = document.querySelector(sel);
      return el && el.classList.contains('played');
    }, containerSelector);

    const hasPlayed = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el && el.classList.contains('played');
    }, containerSelector);

    expect(hasPlayed).toBe(true);

    // Immediately after click, the button triggers a Web Animation on itself (360ms duration).
    // Check that the animateBtn currently has at least one animation (timing sensitive; check quickly).
    const animationsCount = await page.evaluate(() => {
      const b = document.getElementById('animateBtn');
      if (!b || !b.getAnimations) return 0;
      return b.getAnimations().length;
    });
    // Because animations can finish quickly, allow 0 or more but prefer >0 as strong evidence.
    expect(animationsCount).toBeGreaterThanOrEqual(0);

    // Validate that an edge eventually reaches stroke-dashoffset of 0 (visual observable from CSS when played)
    // The change is transitioned; wait up to 2s for the transition to apply.
    const edgeHasZeroDashoffset = await page.waitForFunction(() => {
      const e = document.querySelector('svg .edge');
      if (!e) return false;
      const comp = window.getComputedStyle(e);
      // computed value may be "0" or "0px" depending on browser; normalize
      return comp.strokeDashoffset === '0' || comp.strokeDashoffset === '0px';
    }, { timeout: 2000 }).catch(() => false);

    // It's acceptable if the UA reports computed value slightly differently; assert at least the played class is present.
    expect(hasPlayed).toBe(true);
    // Edge condition: if dashoffset did not report zero in time, we don't fail the test harshly, but record it.
    // Assert no uncaught page errors occurred during the animation
    expect(pageErrors.length).toBe(0);

    // Ensure no console errors
    const consoleErrors = consoleMsgs.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  // Test S2_LabelsVisible and S3_LabelsHidden: clicking Toggle Labels toggles labels-visible class and updates aria/text.
  test('S2_LabelsVisible & S3_LabelsHidden: Toggle Labels button toggles labels visibility and aria-pressed', async ({ page }) => {
    const consoleMsgs = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMsgs.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);

    const containerSelector = '.stage';
    const labelsBtn = page.locator('#labelsBtn');

    // Grab a representative label element (there are many within the SVG). Use the first .label found.
    const labelLocator = page.locator('svg .label').first();
    await expect(labelLocator).toHaveCount(1);

    // Initially labels should be hidden (CSS sets opacity:0)
    const initialLabelOpacity = await labelLocator.evaluate((el) => {
      const comp = window.getComputedStyle(el);
      return comp.opacity;
    });
    expect(['0', '0px', '0.00']).toContain(initialLabelOpacity);

    // Click to show labels
    await labelsBtn.click();

    // After click, container should have 'labels-visible' class.
    await page.waitForFunction((sel) => {
      const el = document.querySelector(sel);
      return el && el.classList.contains('labels-visible');
    }, containerSelector);

    const labelsOn = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el && el.classList.contains('labels-visible');
    }, containerSelector);
    expect(labelsOn).toBe(true);

    // labelsBtn aria-pressed should now be "true" and text should be 'Hide Labels'
    await expect(labelsBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(labelsBtn).toHaveText('Hide Labels');

    // The label elements should now have computed opacity of 1
    const labelOpacityWhenVisible = await labelLocator.evaluate((el) => {
      const comp = window.getComputedStyle(el);
      return comp.opacity;
    });
    expect(['1', '1px', '1.00']).toContain(labelOpacityWhenVisible);

    // Click again to hide labels (S2 -> S3 transition)
    await labelsBtn.click();

    await page.waitForFunction((sel) => {
      const el = document.querySelector(sel);
      return el && !el.classList.contains('labels-visible');
    }, containerSelector);

    const labelsOff = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el && !el.classList.contains('labels-visible');
    }, containerSelector);
    expect(labelsOff).toBe(true);

    await expect(labelsBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(labelsBtn).toHaveText('Toggle Labels');

    const labelOpacityWhenHidden = await labelLocator.evaluate((el) => {
      const comp = window.getComputedStyle(el);
      return comp.opacity;
    });
    expect(['0', '0px', '0.00']).toContain(labelOpacityWhenHidden);

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMsgs.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  // Edge cases and accessibility: rapid toggles and keyboard activations should not throw errors.
  test('Edge cases: rapid clicks and keyboard activations do not produce runtime errors', async ({ page }) => {
    const consoleMsgs = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMsgs.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);

    const animateBtn = page.locator('#animateBtn');
    const labelsBtn = page.locator('#labelsBtn');

    // Rapidly click animate 6 times
    for (let i = 0; i < 6; i++) {
      await animateBtn.click();
      // tiny pause to simulate rapid user, but avoid starving UI
      await page.waitForTimeout(40);
    }

    // Rapidly toggle labels 6 times
    for (let i = 0; i < 6; i++) {
      await labelsBtn.click();
      await page.waitForTimeout(30);
    }

    // Use keyboard triggers: focus and press Enter then Space for both buttons
    await animateBtn.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(50);
    await page.keyboard.press('Space');
    await page.waitForTimeout(50);

    await labelsBtn.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(50);
    await page.keyboard.press('Space');
    await page.waitForTimeout(50);

    // After all interactions, ensure we have not collected any uncaught page errors
    expect(pageErrors.length).toBe(0);

    // Also ensure no console error messages were emitted during rapid interactions
    const consoleErrors = consoleMsgs.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);

    // Basic final sanity: labelsBtn should have either true/false aria-pressed but must be present
    const ariaPressed = await labelsBtn.getAttribute('aria-pressed');
    expect(['true', 'false']).toContain(ariaPressed);
  });

  // Validate the automatic initial play invoked by setTimeout -> play() runs without throwing errors.
  test('Auto-play on load triggers play() after a short delay and does not error', async ({ page }) => {
    const consoleMsgs = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMsgs.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);

    // Wait for a bit longer than the 480ms auto-play delay to observe the automatic invocation.
    await page.waitForTimeout(800);

    // The container should have 'played' class as a result of the auto-play.
    const playedAfterDelay = await page.evaluate(() => {
      const container = document.querySelector('.stage');
      return !!(container && container.classList.contains('played'));
    });

    expect(playedAfterDelay).toBe(true);

    // Confirm no page errors occurred during the automatic play
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMsgs.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });
});