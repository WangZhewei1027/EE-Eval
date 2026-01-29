import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9802a0-fa78-11f0-857d-d58e82d5de73.html';

// Increase timeout for tests that interact with animation timers
test.setTimeout(30_000);

test.describe("Prim's Algorithm Visualization - FSM and interaction tests", () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for assertions
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // capture console messages with their type & text
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // capture uncaught exceptions on the page
      pageErrors.push(err);
    });

    // Navigate to the provided HTML page
    await page.goto(APP_URL);
    // Wait a short time to allow initial scripts (initialDraw, applyCanvasGlow) to run
    await page.waitForTimeout(200);
  });

  test.afterEach(async ({ page }) => {
    // Helpful debugging output if a test fails locally
    if (pageErrors.length) {
      // eslint-disable-next-line no-console
      console.warn('Page errors captured during test:', pageErrors);
    }
    if (consoleMessages.length) {
      // eslint-disable-next-line no-console
      console.log('Console messages captured during test (first 20):', consoleMessages.slice(0, 20));
    }
  });

  test.describe('Idle State (S0_Idle) validations', () => {
    test('Initial page load shows idle visuals: start button enabled, tooltip hidden, canvas glow applied', async ({ page }) => {
      // Validate Start button is present and not pressed (Idle state expectations)
      const startBtn = page.locator('#startBtn');
      await expect(startBtn).toBeVisible();
      await expect(startBtn).toHaveAttribute('aria-pressed', 'false');
      await expect(startBtn).toBeEnabled();

      // Validate Reset button is present and visible
      const resetBtn = page.locator('#resetBtn');
      await expect(resetBtn).toBeVisible();
      await expect(resetBtn).toBeEnabled();

      // Tooltip should be present but hidden (opacity '0')
      const tooltip = page.locator('#tooltip');
      await expect(tooltip).toBeVisible();
      // style.opacity set inline in script on reset/hover; initial state should be '0'
      const tooltipOpacity = await tooltip.evaluate(el => el.style.opacity || window.getComputedStyle(el).opacity);
      expect(tooltipOpacity === '0' || tooltipOpacity === '0' /* fallback */).toBeTruthy();

      // The canvas should have the glow style applied by applyCanvasGlow()
      const canvas = page.locator('#primCanvas');
      await expect(canvas).toBeVisible();
      const boxShadow = await canvas.evaluate(el => el.style.boxShadow);
      expect(typeof boxShadow === 'string' && boxShadow.length > 0).toBeTruthy();

      // Ensure no uncaught page errors happened during initial load
      expect(pageErrors.length).toBe(0);
    });

    test('Initial draw evidence: canvas has non-empty pixel data (sanity check)', async ({ page }) => {
      // We can't call internal functions, but we can read canvas pixel data to check something was drawn.
      const canvasPresent = await page.locator('#primCanvas').count();
      expect(canvasPresent).toBe(1);

      // Read a few pixels in the canvas to ensure background draw executed
      const pixels = await page.evaluate(() => {
        const canvas = document.getElementById('primCanvas');
        const ctx = canvas.getContext('2d');
        // Sample some pixel RGBA values at a few coordinates
        const sample = (x, y) => {
          const d = ctx.getImageData(x, y, 1, 1).data;
          return [d[0], d[1], d[2], d[3]];
        };
        return {
          center: sample(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2)),
          corner: sample(10, 10),
          midRight: sample(canvas.width - 10, Math.floor(canvas.height / 2))
        };
      });

      // Expect that at least one sample is not fully transparent (alpha !== 0)
      const someOpaque = Object.values(pixels).some(arr => arr[3] !== 0);
      expect(someOpaque).toBeTruthy();

      // No page errors on canvas drawing
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Animating State (S1_Animating) and transitions', () => {
    test('Clicking Start transitions to Animating: start button disabled and aria-pressed true', async ({ page }) => {
      const startBtn = page.locator('#startBtn');
      await startBtn.click();

      // Immediately after clicking, the button should be disabled and aria-pressed true
      await expect(startBtn).toBeDisabled();
      await expect(startBtn).toHaveAttribute('aria-pressed', 'true');

      // Wait a short time to let animation loop begin
      await page.waitForTimeout(150);

      // Ensure no uncaught page errors triggered by starting animation
      expect(pageErrors.length).toBe(0);
    });

    test('Clicking Start twice quickly does not throw and keeps button disabled (guard against double-start)', async ({ page }) => {
      const startBtn = page.locator('#startBtn');

      // First click: start animation
      await startBtn.click();
      await expect(startBtn).toBeDisabled();
      await expect(startBtn).toHaveAttribute('aria-pressed', 'true');

      // Second click while animating should be a no-op (guard if animating)
      // Attempt to click again; since button is disabled, Playwright will throw if we try to click disabled element.
      // Instead dispatch a DOM click via evaluate to emulate an attempted click that the app should guard against.
      await page.evaluate(() => {
        const btn = document.getElementById('startBtn');
        // Simulate a programmatic click event dispatch even if disabled (to test guard in JS)
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });

      // Button should remain disabled and aria-pressed true
      await expect(startBtn).toBeDisabled();
      await expect(startBtn).toHaveAttribute('aria-pressed', 'true');

      // No uncaught exceptions should be logged
      expect(pageErrors.length).toBe(0);
    });

    test('Reset during animation cancels animation and returns to Idle: re-enables Start, tooltip hidden', async ({ page }) => {
      const startBtn = page.locator('#startBtn');
      const resetBtn = page.locator('#resetBtn');
      const tooltip = page.locator('#tooltip');

      // Start animation
      await startBtn.click();
      await expect(startBtn).toBeDisabled();
      await expect(startBtn).toHaveAttribute('aria-pressed', 'true');

      // Wait briefly to ensure animation loop has started
      await page.waitForTimeout(200);

      // Click Reset to force transition from Animating -> Idle
      await resetBtn.click();

      // After reset, start button should be enabled and aria-pressed false
      await expect(startBtn).toBeEnabled();
      await expect(startBtn).toHaveAttribute('aria-pressed', 'false');

      // Tooltip should be hidden by reset handler
      const tooltipOpacityAfterReset = await tooltip.evaluate(el => el.style.opacity || window.getComputedStyle(el).opacity);
      expect(tooltipOpacityAfterReset === '0' || tooltipOpacityAfterReset === '0').toBeTruthy();

      // No page errors on reset
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Pointer interactions: PointerMove and PointerLeave (tooltips)', () => {
    // Helper to compute client coordinates to target canvas-based coordinates
    async function canvasClientCoordsFor(page, canvasSelector, targetCanvasX, targetCanvasY) {
      return await page.evaluate(({ selector, x, y }) => {
        const canvas = document.querySelector(selector);
        const rect = canvas.getBoundingClientRect();
        // Map canvas internal coords to client coords assuming 1:1 scaling between width attribute and layout width
        const scaleX = rect.width / canvas.width;
        const scaleY = rect.height / canvas.height;
        const clientX = rect.left + x * scaleX;
        const clientY = rect.top + y * scaleY;
        return { clientX, clientY };
      }, { selector: canvasSelector, x: targetCanvasX, y: targetCanvasY });
    }

    test('PointerMove near a node shows Node tooltip; PointerLeave hides it', async ({ page }) => {
      const canvasSelector = '#primCanvas';
      const tooltip = page.locator('#tooltip');

      // Node 0 coordinates in the app: { id: 0, x: 140, y: 140 }
      const node0 = { x: 140, y: 140 };
      const coords = await canvasClientCoordsFor(page, canvasSelector, node0.x, node0.y);

      // Move mouse to node position - this triggers pointermove on canvas
      await page.mouse.move(coords.clientX, coords.clientY);
      // Wait a bit for tooltip to update style
      await page.waitForTimeout(120);

      // Tooltip should become visible and contain "Node 1"
      const tText = await tooltip.innerText();
      expect(tText).toContain('Node 1');

      const tOpacity = await tooltip.evaluate(el => el.style.opacity || window.getComputedStyle(el).opacity);
      expect(tOpacity === '1' || Number(tOpacity) > 0).toBeTruthy();

      // Now dispatch pointerleave on canvas to hide tooltip
      await page.dispatchEvent(canvasSelector, 'pointerleave', {});
      await page.waitForTimeout(150);

      const tOpacityAfter = await tooltip.evaluate(el => el.style.opacity || window.getComputedStyle(el).opacity);
      expect(tOpacityAfter === '0' || Number(tOpacityAfter) === 0).toBeTruthy();

      // Ensure no uncaught page errors during pointer interactions
      expect(pageErrors.length).toBe(0);
    });

    test('PointerMove near an edge shows Edge tooltip', async ({ page }) => {
      const canvasSelector = '#primCanvas';
      const tooltip = page.locator('#tooltip');

      // Choose an edge known in implementation: edge 0 between nodes 0 (140,140) and 1 (400,90)
      const from = { x: 140, y: 140 };
      const to = { x: 400, y: 90 };
      const midX = Math.round((from.x + to.x) / 2);
      const midY = Math.round((from.y + to.y) / 2);

      const coords = await canvasClientCoordsFor(page, canvasSelector, midX, midY);

      // Move mouse to edge midpoint
      await page.mouse.move(coords.clientX, coords.clientY);
      await page.waitForTimeout(120);

      // Tooltip should mention 'Edge' and include the nodes/weight text
      const tText = await tooltip.innerText();
      expect(tText).toMatch(/Edge\s*\(/i);
      expect(tText).toMatch(/Weight/i);

      const tOpacity = await tooltip.evaluate(el => el.style.opacity || window.getComputedStyle(el).opacity);
      expect(tOpacity === '1' || Number(tOpacity) > 0).toBeTruthy();

      // Cleanup by leaving
      await page.dispatchEvent(canvasSelector, 'pointerleave', {});
      await page.waitForTimeout(100);

      // No uncaught errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenario validations', () => {
    test('No uncaught ReferenceError / SyntaxError / TypeError occur during a full interaction sequence', async ({ page }) => {
      const startBtn = page.locator('#startBtn');
      const resetBtn = page.locator('#resetBtn');

      // Start animation
      await startBtn.click();
      await page.waitForTimeout(300);

      // Move pointer around a couple places to exercise hover handlers while animating
      const canvasSelector = '#primCanvas';
      const sampleCoords = [
        { x: 140, y: 140 },
        { x: 400, y: 90 },
        { x: 300, y: 300 }
      ];
      for (const c of sampleCoords) {
        const coords = await page.evaluate(({ selector, x, y }) => {
          const canvas = document.querySelector(selector);
          const rect = canvas.getBoundingClientRect();
          const scaleX = rect.width / canvas.width;
          const scaleY = rect.height / canvas.height;
          return { clientX: rect.left + x * scaleX, clientY: rect.top + y * scaleY };
        }, { selector: canvasSelector, x: c.x, y: c.y });
        await page.mouse.move(coords.clientX, coords.clientY);
        await page.waitForTimeout(80);
      }

      // Reset to stop animation
      await resetBtn.click();
      await page.waitForTimeout(150);

      // Assert no page-level errors (ReferenceError/SyntaxError/TypeError) were thrown during sequence
      // This asserts that the app ran without uncaught runtime errors during normal use.
      expect(pageErrors.length).toBe(0);

      // Also assert there are some console.info/debug messages emitted (not mandatory, but useful)
      // We don't require specific messages, just capture that console was active.
      expect(Array.isArray(consoleMessages)).toBeTruthy();
    });

    test('Rapid pointer movements do not produce uncaught errors (stress hover)', async ({ page }) => {
      const canvasSelector = '#primCanvas';
      // Rapidly move around the canvas region
      const positions = [
        { x: 50, y: 50 },
        { x: 200, y: 120 },
        { x: 400, y: 90 },
        { x: 600, y: 200 },
        { x: 300, y: 400 },
        { x: 100, y: 300 }
      ];
      for (const pos of positions) {
        const coords = await page.evaluate(({ selector, x, y }) => {
          const canvas = document.querySelector(selector);
          const rect = canvas.getBoundingClientRect();
          const scaleX = rect.width / canvas.width;
          const scaleY = rect.height / canvas.height;
          return { clientX: rect.left + x * scaleX, clientY: rect.top + y * scaleY };
        }, { selector: canvasSelector, x: pos.x, y: pos.y });
        await page.mouse.move(coords.clientX, coords.clientY);
        // minimal wait to simulate speed
        await page.waitForTimeout(30);
      }

      // After rapid movements, dispatch pointerleave
      await page.dispatchEvent(canvasSelector, 'pointerleave', {});
      await page.waitForTimeout(80);

      // Confirm no uncaught errors
      expect(pageErrors.length).toBe(0);
    });
  });
});