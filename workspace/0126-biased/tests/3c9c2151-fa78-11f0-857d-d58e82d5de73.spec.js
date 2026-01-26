import { test, expect } from '@playwright/test';

// Test file for Application ID: 3c9c2151-fa78-11f0-857d-d58e82d5de73
// Served at: http://127.0.0.1:5500/workspace/0126-biased/html/3c9c2151-fa78-11f0-857d-d58e82d5de73.html
// This suite validates the FSM interactions and visual/DOM feedback for the K-Nearest Neighbors demo.
// It also observes console logs and page errors (and asserts on their presence/absence).
// Note: The page script runs inside an IIFE and is not mutated by these tests.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9c2151-fa78-11f0-857d-d58e82d5de73.html';

// Page object model encapsulating interactions and queries
class KNNPage {
  constructor(page) {
    this.page = page;
    this.canvas = page.locator('#knnCanvas');
    this.toggleBtn = page.locator('#toggleAnimation');
    this.tooltip = page.locator('#tooltip');
  }

  // Navigate to the application and wait for it to settle
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait a short while for initial animations/raf to start
    await this.page.waitForTimeout(300);
    // Ensure canvas and controls are present
    await expect(this.canvas).toBeVisible({ timeout: 2000 });
    await expect(this.toggleBtn).toBeVisible({ timeout: 2000 });
  }

  // Returns the toggle button text content
  async getToggleText() {
    return (await this.toggleBtn.textContent())?.trim();
  }

  // Returns the aria-pressed attribute as string
  async getAriaPressed() {
    return await this.toggleBtn.getAttribute('aria-pressed');
  }

  // Click the toggle button
  async clickToggle() {
    await this.toggleBtn.click();
    // small delay to allow click handler to update DOM
    await this.page.waitForTimeout(120);
  }

  // Returns whether tooltip is visible by computed opacity and presence
  async isTooltipVisible() {
    return await this.page.evaluate(() => {
      const tt = document.getElementById('tooltip');
      if (!tt) return false;
      const s = window.getComputedStyle(tt);
      // opacity may be transition target; treat numeric > 0.05 as visible
      return parseFloat(s.opacity || '0') > 0.05;
    });
  }

  // Returns tooltip textContent trimmed
  async getTooltipText() {
    return await this.page.evaluate(() => {
      const tt = document.getElementById('tooltip');
      return tt ? tt.textContent.trim() : '';
    });
  }

  // Move mouse to absolute canvas-relative coords (cx, cy are relative to canvas top-left)
  async moveToCanvasOffset(cx, cy) {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not available');
    const absX = box.x + cx;
    const absY = box.y + cy;
    await this.page.mouse.move(absX, absY);
    // Allow event handlers to run
    await this.page.waitForTimeout(80);
  }

  // Move mouse outside canvas to trigger mouseleave
  async moveMouseOutside() {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not available');
    // Move to top-left of page (outside canvas)
    await this.page.mouse.move(box.x - 20, box.y - 20);
    await this.page.waitForTimeout(80);
  }

  // Sample across the canvas to find any coordinate that triggers the tooltip.
  // Returns {found: boolean, x, y, text} when found, else {found:false}
  async sampleToFindTooltip({ step = 40, timeout = 3000 } = {}) {
    const box = await this.canvas.boundingBox();
    if (!box) return { found: false };

    const start = Date.now();
    // iterate grid positions across the canvas
    for (let offsetY = 10; offsetY < box.height - 10; offsetY += step) {
      for (let offsetX = 10; offsetX < box.width - 10; offsetX += step) {
        // bail if overall timeout reached
        if (Date.now() - start > timeout) {
          return { found: false };
        }
        await this.moveToCanvasOffset(offsetX, offsetY);
        const visible = await this.isTooltipVisible();
        if (visible) {
          const text = await this.getTooltipText();
          return { found: true, x: offsetX, y: offsetY, text };
        }
      }
    }
    // Do a few extra random probes in case grid misses dense clusters
    for (let i = 0; i < 12; i++) {
      if (Date.now() - start > timeout) break;
      const rx = 10 + Math.floor(Math.random() * Math.max(1, box.width - 20));
      const ry = 10 + Math.floor(Math.random() * Math.max(1, box.height - 20));
      await this.moveToCanvasOffset(rx, ry);
      const visible = await this.isTooltipVisible();
      if (visible) {
        const text = await this.getTooltipText();
        return { found: true, x: rx, y: ry, text };
      }
    }
    return { found: false };
  }
}

test.describe('K-Nearest Neighbors interactive demo - FSM validation', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let knn;

  test.beforeEach(async ({ page }) => {
    // Capture uncaught page errors
    pageErrors = [];
    consoleErrors = [];
    page.on('pageerror', err => {
      // store full error message
      pageErrors.push(String(err && err.stack ? err.stack : err));
    });
    page.on('console', msg => {
      // capture console messages of type 'error' for later assertions
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    knn = new KNNPage(page);
    await knn.goto();
  });

  test.afterEach(async () => {
    // Basic teardown assertion: ensure no fatal page errors occurred during the test unless
    // the test explicitly expects errors. Most tests below assert that there are no pageErrors.
    // Individual tests can override this behavior by inspecting pageErrors/consoleErrors directly.
  });

  test('Initial render state - S0_Idle entry actions and components exist', async () => {
    // Validate entry action renderPage(): canvas exists and is visible, tooltip initially hidden,
    // and toggle button has expected initial text and attributes as FSM evidence.
    await expect(knn.canvas).toBeVisible();
    const toggleText = await knn.getToggleText();
    expect(toggleText).toBe('Pause Animation'); // evidence in FSM state S0_Idle
    const aria = await knn.getAriaPressed();
    // The HTML initially sets aria-pressed="true"
    expect(aria === 'true' || aria === 'true').toBeTruthy();
    const tooltipVisible = await knn.isTooltipVisible();
    expect(tooltipVisible).toBeFalsy();

    // Assert there were no runtime page errors during initial render
    expect(pageErrors).toEqual([]);
    // Also expect no console.error messages at load
    expect(consoleErrors).toEqual([]);
  });

  test('ToggleAnimation event toggles animation state and updates DOM (button text and aria-pressed)', async () => {
    // FSM transition: ToggleAnimation toggles animationPlaying and button text
    const initialText = await knn.getToggleText();
    expect(initialText).toBe('Pause Animation');

    const initialAria = await knn.getAriaPressed();
    expect(initialAria).toBe('true');

    // Click to pause (should set to Play Animation)
    await knn.clickToggle();
    const afterClickText = await knn.getToggleText();
    expect(afterClickText).toBe('Play Animation');
    const afterClickAria = await knn.getAriaPressed();
    // The handler sets aria-pressed to animationPlaying (boolean) — when paused it should be false
    // attribute stored as string 'false'
    expect(afterClickAria === 'false' || afterClickAria === 'false').toBeTruthy();

    // Click again to resume
    await knn.clickToggle();
    const resumedText = await knn.getToggleText();
    expect(resumedText).toBe('Pause Animation');
    const resumedAria = await knn.getAriaPressed();
    expect(resumedAria).toBe('true');

    // Ensure no unexpected page errors occurred during toggles
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('MouseMove event: tooltip appears when hovering near a data point and hides on mouseleave', async () => {
    // This test will sample positions across the canvas to find at least one coordinate that
    // triggers the tooltip (because dataset is randomly generated inside the page).
    // It verifies the tooltip text format and that mouseleave hides it.

    // Ensure tooltip starts hidden
    expect(await knn.isTooltipVisible()).toBeFalsy();

    // Try to discover a hover location that shows a tooltip
    const result = await knn.sampleToFindTooltip({ step: 36, timeout: 4000 });
    expect(result.found).toBeTruthy();

    // Validate tooltip text has expected pattern "Class X" where X in {A,B,C}
    const ttText = result.text;
    expect(typeof ttText).toBe('string');
    expect(ttText).toMatch(/^Class [A-C]$/);

    // Now simulate moving the mouse out of the canvas to trigger mouseleave
    await knn.moveMouseOutside();
    // Allow the mouseleave handler to hide the tooltip
    await knn.page.waitForTimeout(120);

    const visibleAfterLeave = await knn.isTooltipVisible();
    expect(visibleAfterLeave).toBeFalsy();

    // No page errors during hovering interactions
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('MouseMove+MouseLeave robustness: repeated moves should not produce JS runtime exceptions', async () => {
    // Repeatedly move across canvas edges and inside to ensure no ReferenceError/TypeError occur.
    // This exercises the mousemove/mouseleave handlers and tooltip show/hide logic.

    const box = await knn.canvas.boundingBox();
    expect(box).toBeTruthy();

    // We'll sweep along a diagonal and bounce out to trigger mouseleave several times.
    for (let i = 0; i < 8; i++) {
      const x = 10 + (i / 7) * (box.width - 20);
      const y = 10 + (i / 7) * (box.height - 20);
      await knn.moveToCanvasOffset(Math.round(x), Math.round(y));
      await knn.page.waitForTimeout(40);
      // Occasionally move outside to fire mouseleave
      if (i % 3 === 2) {
        await knn.moveMouseOutside();
        await knn.page.waitForTimeout(40);
      }
    }

    // After the sweep, assert that no uncaught errors arose
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Edge case: clicking toggle rapidly toggles textual and aria states consistently', async () => {
    // Rapid toggles should consistently update the DOM. This checks for race conditions.
    const iterations = 6;
    for (let i = 0; i < iterations; i++) {
      await knn.clickToggle();
    }
    // After even number of clicks (6), we expect final state to match initial state
    const finalText = await knn.getToggleText();
    const finalAria = await knn.getAriaPressed();
    expect(finalText).toBe('Pause Animation');
    expect(finalAria).toBe('true');

    // No runtime exceptions
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Sanity check: tooltip DOM node exists and has expected styling properties', async () => {
    // Validate the tooltip element has CSS characteristics that the app relies on (positioning and opacity)
    const exists = await knn.tooltip.count();
    expect(exists).toBeGreaterThan(0);

    // The tooltip should be absolutely positioned and start with opacity 0 (hidden)
    const style = await knn.page.evaluate(() => {
      const tt = document.getElementById('tooltip');
      if (!tt) return null;
      const s = window.getComputedStyle(tt);
      return {
        position: s.position,
        pointerEvents: s.pointerEvents,
        opacity: s.opacity,
        transition: s.transition
      };
    });
    expect(style).not.toBeNull();
    expect(style.position).toBe('absolute');
    // pointer-events is 'none' as per CSS
    expect(style.pointerEvents).toBe('none');
    // opacity should be a numeric string (likely "0" initially)
    expect(typeof style.opacity).toBe('string');

    // No runtime errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Diagnostic: capture and assert that there are no unexpected console errors or page errors', async () => {
    // This test explicitly inspects the captured arrays and fails if any unexpected errors occurred.
    // It helps surface ReferenceError / SyntaxError / TypeError if they happen in the runtime.
    // We do not attempt to patch the page; we merely surface these runtime issues.

    // Small additional interaction to ensure we capture errors that might occur on events
    await knn.clickToggle();
    const sample = await knn.sampleToFindTooltip({ step: 60, timeout: 2000 });

    // Assert: no uncaught page errors
    expect(pageErrors).toEqual([]);

    // Assert: no console.error messages were emitted
    expect(consoleErrors).toEqual([]);
  });
});