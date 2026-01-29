import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c98ed02-fa78-11f0-857d-d58e82d5de73.html';

test.describe('Amortized Analysis — Visualizer (FSM validation)', () => {
  // We'll capture console messages and uncaught page errors to observe runtime behavior.
  // Each test uses a fresh page so listeners are reset per test for isolation.
  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for assertions
    page.context()._consoleMessages = [];
    page.context()._pageErrors = [];

    page.on('console', (msg) => {
      // store lightweight representation
      page.context()._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      page.context()._pageErrors.push(err);
    });

    // Navigate to the app
    await page.goto(APP_URL);
    // Wait for essential elements to be present
    await page.waitForSelector('#btnStartPause', { state: 'visible' });
    await page.waitForSelector('#animation', { state: 'visible' });

    // allow initial drawing and the background "pulse" to run at least one frame
    await page.waitForTimeout(250);
  });

  test.afterEach(async ({ page }) => {
    // keep any accumulated logs on the page context for debugging if needed
    // (they will be asserted inside tests)
    // Close page cleanup is handled by Playwright runner
  });

  // Helper to sample a single pixel's RGBA from the canvas (canvas internal coordinates)
  async function getCanvasPixelRGBA(page, x = 50, y = 50) {
    return await page.evaluate(({ x, y }) => {
      const canvas = document.getElementById('animation');
      // Defensive: return a sentinel if canvas or ctx missing (let runtime errors surface naturally)
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');
      if (!ctx || typeof ctx.getImageData !== 'function') return null;
      const d = ctx.getImageData(x, y, 1, 1).data;
      return Array.from(d);
    }, { x, y });
  }

  test.describe('Initial Idle state (S0_Idle) validation', () => {
    test('Initial UI should show Idle state: button text, aria attributes, canvas present', async ({ page }) => {
      // Validate button text & aria attribute reflect Idle
      const btn = await page.locator('#btnStartPause');
      await expect(btn).toHaveText('Play ▶️');
      await expect(btn).toHaveAttribute('aria-pressed', 'false');
      await expect(btn).toHaveAttribute('aria-label', 'Play or pause the amortized cost animation');

      // Validate canvas attributes are set as defined in FSM/components
      const canvas = await page.locator('#animation');
      await expect(canvas).toHaveAttribute('width', '600');
      await expect(canvas).toHaveAttribute('height', '420');
      await expect(canvas).toHaveAttribute('role', 'img');
      await expect(canvas).toHaveAttribute('aria-hidden', 'true');

      // Verify canvas received some drawing from entry actions (drawBackground/drawGrid/drawBars/drawAmortizedCircle)
      // Sample a pixel and assert it is not fully transparent (alpha > 0)
      const pixel = await getCanvasPixelRGBA(page, 60, 60);
      expect(pixel, 'Canvas pixel data should be available after initial draw').not.toBeNull();
      // pixel is [r,g,b,a] with a in 0..255; expect some drawing -> alpha > 0
      expect(pixel[3], 'Initial canvas alpha component should be > 0 indicating drawing occurred').toBeGreaterThan(0);

      // Ensure no uncaught page errors or console.error messages occurred up to this point
      const consoleErrors = page.context()._consoleMessages.filter(m => m.type === 'error');
      expect(page.context()._pageErrors.length, 'No uncaught page errors expected on load').toBe(0);
      expect(consoleErrors.length, 'No console.error messages expected on load').toBe(0);
    });

    test('Initial idle state should have static canvas until animation runs', async ({ page }) => {
      // Sample a pixel twice with some delay and ensure it remains the same when animation not running
      const p1 = await getCanvasPixelRGBA(page, 100, 80);
      await page.waitForTimeout(180);
      const p2 = await getCanvasPixelRGBA(page, 100, 80);
      expect(p1).toEqual(p2);
    });
  });

  test.describe('Play/Pause transitions (PlayPause event)', () => {
    test('Clicking Play transitions to Running (S1_Running) and starts animation', async ({ page }) => {
      const btn = page.locator('#btnStartPause');

      // Ensure we start from Idle
      await expect(btn).toHaveText('Play ▶️');
      await expect(btn).toHaveAttribute('aria-pressed', 'false');

      // Sample a pixel before starting animation
      const before = await getCanvasPixelRGBA(page, 140, 110);

      // Click Play to trigger transition to Running
      await btn.click();

      // Immediately assert button text and aria attribute changed as per evidence/actions
      await expect(btn).toHaveText('Pause ⏸');
      await expect(btn).toHaveAttribute('aria-pressed', 'true');

      // Allow animation frames to run
      await page.waitForTimeout(220);

      // Sample the same pixel; because animation is running, the canvas should have changed
      const during = await getCanvasPixelRGBA(page, 140, 110);
      expect(during, 'Canvas pixel should be present while running').not.toBeNull();
      // It's possible the pixel remains same for some positions; choose a different coordinate if needed.
      // We'll accept any visible difference as evidence of animation frames.
      const changed = !(before && during && before[0] === during[0] && before[1] === during[1] && before[2] === during[2] && before[3] === during[3]);
      expect(changed, 'Canvas should change after starting animation (evidence of requestAnimationFrame(animate))').toBeTruthy();

      // No unexpected page errors or console.error while starting
      const consoleErrors = page.context()._consoleMessages.filter(m => m.type === 'error');
      expect(page.context()._pageErrors.length, 'No uncaught page errors expected after starting animation').toBe(0);
      expect(consoleErrors.length, 'No console.error messages expected after starting animation').toBe(0);
    });

    test('Clicking Pause transitions back to Idle (S0_Idle) and stops animation', async ({ page }) => {
      const btn = page.locator('#btnStartPause');

      // Start the animation first
      await btn.click();
      await expect(btn).toHaveText('Pause ⏸');
      await expect(btn).toHaveAttribute('aria-pressed', 'true');

      // Wait a bit to allow animation to change canvas
      await page.waitForTimeout(200);
      const snapshotWhileRunning = await getCanvasPixelRGBA(page, 180, 120);
      expect(snapshotWhileRunning).not.toBeNull();

      // Click to pause (toggle)
      await btn.click();

      // Button should reflect paused state
      await expect(btn).toHaveText('Play ▶️');
      await expect(btn).toHaveAttribute('aria-pressed', 'false');

      // After pausing, the canvas should stop updating. Sample multiple times to assert stability.
      await page.waitForTimeout(120);
      const p1 = await getCanvasPixelRGBA(page, 180, 120);
      await page.waitForTimeout(160);
      const p2 = await getCanvasPixelRGBA(page, 180, 120);

      // If animation paused, the canvas pixels should remain identical across these samples
      expect(p1).toEqual(p2);

      // Confirm no uncaught errors during pause transition
      const consoleErrors = page.context()._consoleMessages.filter(m => m.type === 'error');
      expect(page.context()._pageErrors.length, 'No uncaught page errors expected after pausing animation').toBe(0);
      expect(consoleErrors.length, 'No console.error messages expected after pausing animation').toBe(0);
    });

    test('Rapid toggling of Play/Pause results in consistent final state (edge case)', async ({ page }) => {
      const btn = page.locator('#btnStartPause');

      // Rapidly click the button multiple times
      await btn.click(); // play
      await btn.click(); // pause
      await btn.click(); // play
      await btn.click(); // pause
      await btn.click(); // play (final)
      // Allow micro-tasks and frames to settle
      await page.waitForTimeout(150);

      // Final expected state is Running (because last click toggled to play)
      await expect(btn).toHaveText('Pause ⏸');
      await expect(btn).toHaveAttribute('aria-pressed', 'true');

      // Now click once more to end in Idle
      await btn.click();
      await page.waitForTimeout(80);
      await expect(btn).toHaveText('Play ▶️');
      await expect(btn).toHaveAttribute('aria-pressed', 'false');

      // Validate there were no uncaught errors during the noisy toggling scenario
      const consoleErrors = page.context()._consoleMessages.filter(m => m.type === 'error');
      expect(page.context()._pageErrors.length, 'No uncaught page errors expected during rapid toggling').toBe(0);
      expect(consoleErrors.length, 'No console.error messages expected during rapid toggling').toBe(0);
    });
  });

  test.describe('FSM entry/exit actions and visual feedback checks', () => {
    test('Entry actions for Idle (initial) produce expected visual elements on canvas', async ({ page }) => {
      // We validate that the right title text and "Amortized Cost" label exist on the drawn canvas
      // Since we cannot introspect internal draw calls, we sample pixels in areas where text/graphics are expected.
      // Sample near the right visualizer title area (W - 160) approximated in canvas coords
      const titlePixel = await getCanvasPixelRGBA(page, 600 - 160, 80);
      expect(titlePixel).not.toBeNull();
      expect(titlePixel[3], 'Title area should be drawn and not fully transparent').toBeGreaterThan(0);
    });

    test('Amortized circle numeric value displayed changes as animation progresses (visual feedback)', async ({ page }) => {
      const btn = page.locator('#btnStartPause');

      // Start animation
      await btn.click();
      await expect(btn).toHaveText('Pause ⏸');

      // Sample central right canvas region where numeric amortized cost is drawn
      const locX = 600 - 160;
      const locY = 360 - 100;
      const before = await getCanvasPixelRGBA(page, Math.round(locX), Math.round(locY));
      await page.waitForTimeout(300);
      const after = await getCanvasPixelRGBA(page, Math.round(locX), Math.round(locY));

      // There should be visible changes due to pulsing and text updates; at least expect some pixel differences
      const different = !(before && after && before[0] === after[0] && before[1] === after[1] && before[2] === after[2] && before[3] === after[3]);
      expect(different, 'Amortized-cost area on canvas should change while animating').toBeTruthy();

      // Pause to restore Idle
      await btn.click();
      await expect(btn).toHaveText('Play ▶️');
    });
  });

  test.describe('Diagnostics: observe console & page errors for unexpected runtime issues', () => {
    test('No unexpected runtime errors (pageerror / console.error) should have occurred during full scenario', async ({ page }) => {
      // Perform a typical usage flow: check initial, start, wait, pause
      const btn = page.locator('#btnStartPause');

      // initial -> play
      await expect(btn).toHaveText('Play ▶️');
      await btn.click();
      await page.waitForTimeout(220);
      // pause
      await btn.click();
      await page.waitForTimeout(120);

      // Gather captured errors and console.error messages
      const pageErrors = page.context()._pageErrors || [];
      const consoleErrors = (page.context()._consoleMessages || []).filter(m => m.type === 'error');

      // Assert none occurred. We let any ReferenceError/TypeError/SyntaxError surface and be collected;
      // if they did happen, the test will fail here with details.
      expect(pageErrors.length, `Expected no uncaught page errors, but found: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
      expect(consoleErrors.length, `Expected no console.error messages, but found: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
    });
  });
});