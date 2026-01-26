import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9bfa42-fa78-11f0-857d-d58e82d5de73.html';

test.describe('SVM Visualization - FSM states & transitions (3c9bfa42-fa78-11f0-857d-d58e82d5de73)', () => {
  // Collect console error messages and page errors for assertions
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages
    page.on('console', (msg) => {
      if (msg.type && msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : undefined,
        });
      }
    });

    // Capture unhandled page errors (ReferenceError, SyntaxError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push({
        message: err.message,
        stack: err.stack,
        name: err.name,
      });
    });

    // Navigate to the application page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Wait a short time to allow initial animation and render to start
    await page.waitForTimeout(200);
  });

  test.afterEach(async () => {
    // No teardown modifications required; listeners are per-page and cleaned up by Playwright
  });

  // Utility: fetch base64 dataURL of the canvas
  async function getCanvasDataUrl(page) {
    return await page.evaluate(() => {
      const canvas = document.getElementById('svmCanvas');
      if (!canvas) return null;
      try {
        return canvas.toDataURL();
      } catch (e) {
        // If toDataURL throws (very unlikely in same-origin), return the error message
        return `__ERROR__:${e && e.message ? e.message : String(e)}`;
      }
    });
  }

  test('Initial render (Idle state) - canvas and controls present and accessible', async ({ page }) => {
    // Validate presence of main elements and initial attributes that reflect S0_Idle entry actions/rendering
    const canvas = await page.$('#svmCanvas');
    expect(canvas, 'svmCanvas should exist on the page').not.toBeNull();

    const toggleBtn = await page.$('#toggleMarginBtn');
    const regenBtn = await page.$('#regenBtn');
    expect(toggleBtn, 'Toggle Margin button should exist').not.toBeNull();
    expect(regenBtn, 'Regenerate Data button should exist').not.toBeNull();

    // Check accessible attributes as described in FSM components
    const ariaPressed = await toggleBtn!.getAttribute('aria-pressed');
    const ariaControlsToggle = await toggleBtn!.getAttribute('aria-controls');
    const ariaControlsRegen = await regenBtn!.getAttribute('aria-controls');
    expect(ariaPressed).toBeDefined();
    // The HTML indicates aria-pressed initially "true"
    expect(ariaPressed).toBe('true');
    expect(ariaControlsToggle).toBe('svmCanvas');
    expect(ariaControlsRegen).toBe('svmCanvas');

    // Ensure canvas has drawn something (toDataURL returns a non-empty string)
    const dataUrl = await getCanvasDataUrl(page);
    expect(dataUrl, 'canvas should return a data URL after initial render').toBeTruthy();
    expect(typeof dataUrl).toBe('string');

    // Ensure no fatal page errors or console errors occurred during initial load
    expect(pageErrors.length, 'No page errors should be present on initial load').toBe(0);
    expect(consoleErrors.length, 'No console.error messages should be present on initial load').toBe(0);
  });

  test('Toggle Margin transitions: visible -> hidden -> visible (S0 -> S2 -> S1)', async ({ page }) => {
    // Validate ToggleMargin event and transitions by checking aria-pressed toggling and canvas visual changes
    const toggle = await page.$('#toggleMarginBtn');
    expect(toggle).not.toBeNull();

    // Capture initial aria-pressed and canvas image
    const initialPressed = await toggle!.getAttribute('aria-pressed');
    expect(initialPressed).toBe('true'); // per implementation default

    const before = await getCanvasDataUrl(page);
    expect(before).toBeTruthy();

    // Click once: should hide margin (aria-pressed -> false)
    await toggle!.click();
    // allow some frames to re-render
    await page.waitForTimeout(200);
    const afterClick1Pressed = await toggle!.getAttribute('aria-pressed');
    expect(afterClick1Pressed).toBe('false');

    const afterClick1 = await getCanvasDataUrl(page);
    expect(afterClick1).toBeTruthy();

    // The visual representation should change when margin toggles
    expect(afterClick1).not.toBe(before);

    // Click again: should show margin (aria-pressed -> true)
    await toggle!.click();
    await page.waitForTimeout(200);
    const afterClick2Pressed = await toggle!.getAttribute('aria-pressed');
    expect(afterClick2Pressed).toBe('true');

    const afterClick2 = await getCanvasDataUrl(page);
    expect(afterClick2).toBeTruthy();

    // Visual should change again when margin is toggled back
    expect(afterClick2).not.toBe(afterClick1);

    // Confirm no page or console errors happened during toggling
    expect(pageErrors.length, 'No page errors should be thrown by ToggleMargin actions').toBe(0);
    expect(consoleErrors.length, 'No console.error messages should be thrown by ToggleMargin actions').toBe(0);
  });

  test('Rapid toggling stability and parity check', async ({ page }) => {
    // Rapidly toggle the margin multiple times to exercise transitions S1 <-> S2
    const toggle = await page.$('#toggleMarginBtn');
    expect(toggle).not.toBeNull();

    // Get initial boolean state
    let initial = (await toggle!.getAttribute('aria-pressed')) === 'true';

    // Click 5 times quickly
    for (let i = 0; i < 5; i++) {
      await toggle!.click();
      // tiny pause to allow attribute change
      await page.waitForTimeout(60);
    }

    // After 5 toggles, parity means final state should be opposite of initial
    const final = (await toggle!.getAttribute('aria-pressed')) === 'true';
    expect(final).toBe(!initial);

    // Ensure no page errors emitted during rapid toggling
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Regenerate Data event updates the canvas but preserves margin state', async ({ page }) => {
    // Validate RegenerateData triggers re-generation of points and canvas visual changes
    const regen = await page.$('#regenBtn');
    const toggle = await page.$('#toggleMarginBtn');
    expect(regen).not.toBeNull();
    expect(toggle).not.toBeNull();

    // Ensure a known margin state first (true)
    const pressedBefore = await toggle!.getAttribute('aria-pressed');
    expect(pressedBefore).toBe('true');

    const canvasBefore = await getCanvasDataUrl(page);
    expect(canvasBefore).toBeTruthy();

    // Click regenerate
    await regen!.click();
    // Allow some time for re-render
    await page.waitForTimeout(250);

    const canvasAfter = await getCanvasDataUrl(page);
    expect(canvasAfter).toBeTruthy();

    // Regeneration should change the canvas content (since data is randomized)
    expect(canvasAfter).not.toBe(canvasBefore);

    // Margin aria state should be preserved (still true)
    const pressedAfter = await toggle!.getAttribute('aria-pressed');
    expect(pressedAfter).toBe(pressedBefore);

    // Now toggle margin to false and regenerate again, verifying state persists
    await toggle!.click();
    await page.waitForTimeout(150);
    const pressedNow = await toggle!.getAttribute('aria-pressed');
    expect(pressedNow).toBe('false');

    const canvasBeforeRegen2 = await getCanvasDataUrl(page);
    await regen!.click();
    await page.waitForTimeout(250);
    const canvasAfterRegen2 = await getCanvasDataUrl(page);
    expect(canvasAfterRegen2).not.toBe(canvasBeforeRegen2);

    // Margin state should still be 'false'
    const pressedAfterRegen2 = await toggle!.getAttribute('aria-pressed');
    expect(pressedAfterRegen2).toBe('false');

    // No errors during regeneration actions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Animation loop is running (canvas changes over time)', async ({ page }) => {
    // Verify animation is active by sampling canvas data at two times and expecting a difference
    const first = await getCanvasDataUrl(page);
    expect(first).toBeTruthy();

    // Wait some frames to allow glow animation to change drawing
    await page.waitForTimeout(300);

    const second = await getCanvasDataUrl(page);
    expect(second).toBeTruthy();

    // The glow animation should create visible differences between frames
    expect(second).not.toBe(first);

    // Confirm no runtime errors occurred during animation
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge cases: multiple regenerates and toggles combined - stability test', async ({ page }) => {
    const toggle = await page.$('#toggleMarginBtn');
    const regen = await page.$('#regenBtn');
    expect(toggle).not.toBeNull();
    expect(regen).not.toBeNull();

    // Perform a sequence: regen, toggle, regen, toggle x3 quickly
    const snapshots = [];
    for (let i = 0; i < 3; i++) {
      await regen!.click();
      await page.waitForTimeout(180);
      snapshots.push(await getCanvasDataUrl(page));

      await toggle!.click();
      await page.waitForTimeout(120);
      snapshots.push(await getCanvasDataUrl(page));
    }

    // Ensure we captured multiple different snapshots (the canvas should vary across operations)
    const unique = new Set(snapshots);
    expect(unique.size).toBeGreaterThan(1);

    // Final state should reflect parity of toggles performed (we toggled 3 times here; initial was true)
    const finalPressed = await toggle!.getAttribute('aria-pressed');
    // Initial is true; 3 toggles -> false
    expect(finalPressed).toBe('false');

    // No page errors or console errors in stress sequence
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Accessibility & content checks for controls and description', async ({ page }) => {
    // Check that explanatory text exists and is referenced by canvas aria-describedby
    const explanation = await page.$('#explanationText');
    expect(explanation).not.toBeNull();
    const canvas = await page.$('#svmCanvas');
    const described = await canvas!.getAttribute('aria-describedby');
    expect(described).toBe('explanationText');

    // Validate button labels contain expected text
    const toggleText = (await page.$eval('#toggleMarginBtn', el => el.textContent || '')).trim();
    const regenText = (await page.$eval('#regenBtn', el => el.textContent || '')).trim();
    expect(toggleText).toMatch(/Toggle Margin/i);
    expect(regenText).toMatch(/Regenerate Data/i);

    // No console or page errors from simply querying these accessible features
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Assert no unexpected ReferenceError / SyntaxError / TypeError occurred during session', async ({ page }) => {
    // This test inspects pageErrors and fails if any are ReferenceError, SyntaxError, TypeError
    const jsErrorNames = pageErrors.map(e => e.name);
    const problematic = jsErrorNames.filter(n => ['ReferenceError', 'SyntaxError', 'TypeError'].includes(n));
    // We assert that none of these fundamental JS errors occurred
    expect(problematic.length, `No ReferenceError/SyntaxError/TypeError should have occurred. Found: ${problematic.join(', ')}`).toBe(0);

    // Also assert there are no console.error messages that may indicate runtime failures
    expect(consoleErrors.length).toBe(0);
  });

  test('Observe and surface any console.log/error messages (if they exist) for diagnistics', async ({ page }) => {
    // This test is intentionally diagnostic: it will pass if there are no console errors.
    // If console errors or page errors exist, we include them in the assertion message to aid debugging.
    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      // Build informative message
      const msgs = [];
      if (pageErrors.length > 0) {
        msgs.push('Page errors:\n' + pageErrors.map(e => `${e.name}: ${e.message}`).join('\n'));
      }
      if (consoleErrors.length > 0) {
        msgs.push('Console errors:\n' + consoleErrors.map(c => c.text).join('\n'));
      }
      // Fail the test with collected diagnostics if any exist
      expect(false, `Detected errors while loading or interacting with the app:\n${msgs.join('\n\n')}`).toBe(true);
    } else {
      // No errors found -> pass
      expect(true).toBe(true);
    }
  });

});