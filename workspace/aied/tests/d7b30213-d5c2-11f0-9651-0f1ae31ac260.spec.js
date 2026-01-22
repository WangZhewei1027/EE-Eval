import { test, expect } from '@playwright/test';

// Test file for: d7b30213-d5c2-11f0-9651-0f1ae31ac260
// This suite validates the Weighted Graph Demonstration interactive application.
// It exercises all FSM states and transitions described in the specification.
// It also captures console messages and page errors that occur naturally and asserts on them.

// URL of the application under test (served by the harness)
const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b30213-d5c2-11f0-9651-0f1ae31ac260.html';

// Utility tolerances for color comparisons (canvas anti-aliasing can change pixel values)
const COLOR_TOLERANCE = 30;

// Helpful utility: compare two colors with tolerance
function closeColor(actual, expected, tol = COLOR_TOLERANCE) {
  return Math.abs(actual[0] - expected[0]) <= tol &&
         Math.abs(actual[1] - expected[1]) <= tol &&
         Math.abs(actual[2] - expected[2]) <= tol;
}

// Expected approximate RGB colors (from app CSS/JS colors)
const COLORS = {
  background: [255, 255, 255],
  nodeDefault: [0, 119, 204],      // #0077cc
  nodeSelected: [74, 144, 226],    // #4a90e2
  edgeLabel: [34, 34, 34],         // #222
  canvasShadowOrStroke: [0, 0, 0], // some dark values may appear
};

test.describe('Weighted Graph Demonstration - FSM and interactions', () => {
  // Capture console messages and page errors for each test to validate runtime behavior
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages of all types
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled exceptions (pageerror)
    page.on('pageerror', err => {
      // err is Error object
      pageErrors.push(err);
    });

    // Navigate to the app
    await page.goto(APP_URL, { waitUntil: 'networkidle' });

    // Wait briefly to allow the initial drawing to complete
    await page.waitForTimeout(200);
  });

  test.afterEach(async ({}, testInfo) => {
    // After each test assert that there were no unexpected page errors (ReferenceError/SyntaxError/TypeError).
    // We do not attempt to inject or fix anything; we only observe errors that may have happened naturally.
    const severeErrors = pageErrors.filter(e =>
      e.name === 'ReferenceError' || e.name === 'SyntaxError' || e.name === 'TypeError'
    );

    // Report captured console messages in the test output for debugging
    if (consoleMessages.length) {
      for (const m of consoleMessages) {
        testInfo.attach(`${m.type}-console`, { body: m.text, contentType: 'text/plain' });
      }
    }

    // Fail the test if severe uncaught runtime errors occurred
    expect(severeErrors, 'No ReferenceError, SyntaxError, or TypeError should be thrown by the page').toHaveLength(0);
  });

  // Helper to sample a single pixel RGBA from the canvas at integer coordinates (x,y)
  async function sampleCanvasPixel(page, x, y) {
    return await page.evaluate(({ x, y }) => {
      const canvas = document.getElementById('graphCanvas');
      const ctx = canvas.getContext('2d');
      // Clamp coordinates inside canvas
      const cx = Math.max(0, Math.min(canvas.width - 1, Math.round(x)));
      const cy = Math.max(0, Math.min(canvas.height - 1, Math.round(y)));
      const img = ctx.getImageData(cx, cy, 1, 1).data;
      return [img[0], img[1], img[2], img[3]];
    }, { x, y });
  }

  test.describe('State: S0_Idle (initial canvas drawing)', () => {
    test('Initial graph is drawn and node A is visible at expected position', async ({ page }) => {
      // Node A initial coordinates are known from initSampleGraph(): {x:150, y:120}
      const px = await sampleCanvasPixel(page, 150, 120);

      // Expect that pixel is not pure white (background). It should be filled by a node with a blue-ish color.
      expect(closeColor(px, COLORS.background)).toBeFalsy();
      // Expect color is approximately nodeDefault
      expect(closeColor(px, COLORS.nodeDefault)).toBeTruthy();
    });
  });

  test.describe('State: S1_SelectingNode and S2_CreatingEdge', () => {
    test('Selecting a node changes its fill color (selected state)', async ({ page }) => {
      // Click on node A (150,120) to select it
      await page.mouse.click(150, 120, { button: 'left' });
      await page.waitForTimeout(100);

      // Sample pixel at center; selected color should be used
      const sel = await sampleCanvasPixel(page, 150, 120);
      expect(closeColor(sel, COLORS.nodeSelected)).toBeTruthy();

      // Clicking same node again should cancel selection (selected -> null)
      await page.mouse.click(150, 120, { button: 'left' });
      await page.waitForTimeout(100);
      const after = await sampleCanvasPixel(page, 150, 120);
      expect(closeColor(after, COLORS.nodeDefault)).toBeTruthy();
    });

    test('Creating an edge via selecting two nodes triggers prompt and draws weight label', async ({ page }) => {
      // To observe prompt and input behavior, set up a one-time dialog handler.
      // First, click node A to select it
      await page.mouse.click(150, 120, { button: 'left' });
      await page.waitForTimeout(80);

      // Set up handler for prompt that will appear when selecting second node
      page.once('dialog', async dialog => {
        // Expect a prompt and supply weight "9"
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('9');
      });

      // Click node B (350,180) to complete edge creation. This will cause prompt and then draw the edge label.
      await page.mouse.click(350, 180, { button: 'left' });

      // Allow a bit of time for drawing to update
      await page.waitForTimeout(200);

      // The weight label will be drawn near the midpoint of the edge (A->B).
      // Compute approximate midpoint between the adjusted start/end used by drawGraph.
      // For simplicity sample near the visual midpoint between the nodes:
      const midX = Math.round((150 + 350) / 2);
      const midY = Math.round((120 + 180) / 2);

      const pixel = await sampleCanvasPixel(page, midX, midY);
      // Expect dark text near mid (edge label)
      expect(closeColor(pixel, COLORS.edgeLabel)).toBeTruthy();
    });

    test('Creating an edge with invalid weight triggers alert and does not add edge', async ({ page }) => {
      // Select node A
      await page.mouse.click(150, 120, { button: 'left' });
      await page.waitForTimeout(80);

      // First prompt: we will supply an invalid weight "abc"
      let sawAlert = false;
      // Set up a combined dialog handler:
      page.once('dialog', async dialog => {
        // The first dialog should be a prompt
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('abc'); // invalid numeric input
      });

      // After the prompt returns a non-numeric value, the app shows an alert we'll catch
      page.once('dialog', async dialog => {
        // This should be an alert indicating invalid weight
        expect(dialog.type()).toBe('alert');
        expect(dialog.message()).toMatch(/Invalid weight/);
        sawAlert = true;
        await dialog.accept();
      });

      // Click node B to trigger prompt and subsequent alert
      await page.mouse.click(350, 180, { button: 'left' });
      await page.waitForTimeout(200);

      expect(sawAlert).toBeTruthy();

      // The edge should not have been drawn (weight label absent).
      const midX = Math.round((150 + 350) / 2);
      const midY = Math.round((120 + 180) / 2);
      const pixel = await sampleCanvasPixel(page, midX, midY);
      // The pixel should NOT be the dark edge label color (it may be background or line from earlier edges).
      // Ensure it's not clearly the edge label color
      expect(closeColor(pixel, COLORS.edgeLabel)).toBeFalsy();
    });
  });

  test.describe('State: S3_DraggingNode', () => {
    test('Dragging a node updates its position on the canvas', async ({ page }) => {
      // Node C initial pos: {x:240, y:350}
      const startX = 240;
      const startY = 350;
      const dx = 50;
      const dy = 50;
      const endX = startX + dx;
      const endY = startY + dy;

      // Ensure initial pixel at original location indicates node presence
      const before = await sampleCanvasPixel(page, startX, startY);
      expect(closeColor(before, COLORS.nodeDefault)).toBeTruthy();

      // Perform drag: mousedown -> move -> mouseup
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      // Move in steps to simulate dragging
      await page.mouse.move(startX + dx / 2, startY + dy / 2);
      await page.mouse.move(endX, endY);
      await page.mouse.up();

      // Give the app time to redraw
      await page.waitForTimeout(200);

      // Pixel at original location should no longer be node color (or at least not selected)
      const afterOriginal = await sampleCanvasPixel(page, startX, startY);
      expect(closeColor(afterOriginal, COLORS.nodeDefault)).toBeFalsy();

      // Pixel at new location should show node
      const afterNew = await sampleCanvasPixel(page, endX, endY);
      expect(closeColor(afterNew, COLORS.nodeDefault) || closeColor(afterNew, COLORS.nodeSelected)).toBeTruthy();
    });
  });

  test.describe('State: S4_DeletingNode and S5_DeletingEdge', () => {
    test('Right-clicking a node prompts for deletion and removes the node & its edges when confirmed', async ({ page }) => {
      // Node E initial pos: {x:700, y:120}
      const nodeX = 700;
      const nodeY = 120;

      // Right-click near node E; the app listens to mousedown with evt.button === 2
      // Setup dialog handler to accept the confirm
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('confirm');
        // Accept deletion
        await dialog.accept();
      });

      // Perform right-click via page.mouse
      await page.mouse.click(nodeX, nodeY, { button: 'right' });
      await page.waitForTimeout(200);

      // Pixel at node location should now be background (node removed)
      const pixel = await sampleCanvasPixel(page, nodeX, nodeY);
      expect(closeColor(pixel, COLORS.background)).toBeTruthy();
    });

    test('Right-clicking an existing edge prompts for deletion and removes it when confirmed', async ({ page }) => {
      // Choose edge from D (n4:600,280) to E (n5:700,120) originally present.
      // Midpoint approx:
      const midX = Math.round((600 + 700) / 2);
      const midY = Math.round((280 + 120) / 2);

      // First ensure there's an edge label pixel (edge exists). This may fail if previous tests removed node E.
      // Check if pixel at mid is dark (edge label); if not, attempt to pick another existing edge midpoint.
      let sample = await sampleCanvasPixel(page, midX, midY);

      // Helper to find a working edge midpoint among known edges if above is absent
      const knownEdgeMidpoints = [
        { x: Math.round((150+350)/2), y: Math.round((120+180)/2) }, // A->B
        { x: Math.round((150+240)/2), y: Math.round((120+350)/2) }, // A->C
        { x: Math.round((350+600)/2), y: Math.round((180+280)/2) }, // B->D
        { x: Math.round((240+600)/2), y: Math.round((350+280)/2) }, // C->D
        { x: Math.round((600+700)/2), y: Math.round((280+120)/2) }, // D->E (target)
        { x: Math.round((600+620)/2), y: Math.round((280+420)/2) }, // D->F
      ];

      let chosen = null;
      for (const p of knownEdgeMidpoints) {
        const pix = await sampleCanvasPixel(page, p.x, p.y);
        if (closeColor(pix, COLORS.edgeLabel)) {
          chosen = p;
          break;
        }
      }

      // If no edge label found, skip with an assertion to explain missing visual label
      expect(chosen, 'Expected at least one edge label to be present before attempting deletion').toBeTruthy();

      // Now right-click near chosen edge midpoint and accept confirm
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('confirm');
        await dialog.accept();
      });

      await page.mouse.click(chosen.x, chosen.y, { button: 'right' });
      await page.waitForTimeout(200);

      // After deletion, the pixel at the same midpoint should no longer be dark edge label
      const after = await sampleCanvasPixel(page, chosen.x, chosen.y);
      expect(closeColor(after, COLORS.edgeLabel)).toBeFalsy();
    });
  });

  test.describe('State: S6_ResettingGraph', () => {
    test('Reset button prompts for confirmation and clears the entire graph when confirmed', async ({ page }) => {
      // Click reset button and accept confirm dialog
      // Ensure some node exists first (A at 150,120)
      const before = await sampleCanvasPixel(page, 150, 120);
      expect(closeColor(before, COLORS.nodeDefault)).toBeTruthy();

      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('confirm');
        await dialog.accept();
      });

      // Click the reset button
      await page.click('#resetButton');
      await page.waitForTimeout(200);

      // After reset, pixel at old node location should be background white
      const after = await sampleCanvasPixel(page, 150, 120);
      expect(closeColor(after, COLORS.background)).toBeTruthy();
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('Clicking empty space when a node is selected cancels selection', async ({ page }) => {
      // Select node A
      await page.mouse.click(150, 120, { button: 'left' });
      await page.waitForTimeout(80);
      const sel = await sampleCanvasPixel(page, 150, 120);
      expect(closeColor(sel, COLORS.nodeSelected)).toBeTruthy();

      // Click empty space (near bottom-left) to cancel selection
      await page.mouse.click(50, 550, { button: 'left' });
      await page.waitForTimeout(100);

      const after = await sampleCanvasPixel(page, 150, 120);
      expect(closeColor(after, COLORS.nodeDefault)).toBeTruthy();
    });

    test('Right-clicking empty canvas area does not throw and has no side-effects', async ({ page }) => {
      // Capture error count before
      const beforeErrors = pageErrors.length;

      // Right-click at a blank area (10,10) - top-left corner likely white region
      await page.mouse.click(10, 10, { button: 'right' });
      await page.waitForTimeout(100);

      // No new pageerror events should be emitted as a result
      expect(pageErrors.length).toBe(beforeErrors);
    });

    test('Canvas contextmenu is disabled (native menu prevented) so no default contextmenu appears', async ({ page }) => {
      // Dispatch a contextmenu event via evaluate to check that defaultPrevented is true on the listener
      const prevented = await page.evaluate(() => {
        const canvas = document.getElementById('graphCanvas');
        let defaultPrevented = false;
        const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window, button: 2 });
        defaultPrevented = !canvas.dispatchEvent(ev) ? true : ev.defaultPrevented;
        // Return whether default was prevented (true means app prevents native menu)
        return defaultPrevented;
      });
      expect(prevented).toBeTruthy();
    });
  });
});