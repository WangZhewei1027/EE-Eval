import { test, expect } from '@playwright/test';

// Test file for Application ID: 3c96a311-fa78-11f0-857d-d58e82d5de73
// URL served at:
// http://127.0.0.1:5500/workspace/0126-biased/html/3c96a311-fa78-11f0-857d-d58e82d5de73.html

// Page object to encapsulate interactions with the graph app
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c96a311-fa78-11f0-857d-d58e82d5de73.html';
    this.canvas = page.locator('#graph-canvas');
    this.btnToggle = page.locator('#btn-toggle-arrows');
    this.btnReset = page.locator('#btn-reset');
    this.tooltip = page.locator('#tooltip');

    // Known normalized node positions extracted from the implementation.
    // Using these normalized coordinates lets tests move the mouse over nodes.
    this.nodePositions = {
      A: { x: 0.22, y: 0.17 },
      B: { x: 0.50, y: 0.10 },
      C: { x: 0.78, y: 0.17 },
      D: { x: 0.30, y: 0.45 },
      E: { x: 0.70, y: 0.40 },
      F: { x: 0.41, y: 0.75 },
      G: { x: 0.59, y: 0.75 },
      H: { x: 0.50, y: 0.90 }
    };
  }

  // Navigate to the page and ensure basic elements are present
  async goto() {
    await this.page.goto(this.url);
    // Wait for essential elements to be ready
    await Promise.all([
      this.canvas.waitFor({ state: 'visible', timeout: 5000 }),
      this.btnToggle.waitFor({ state: 'visible', timeout: 5000 }),
      this.btnReset.waitFor({ state: 'visible', timeout: 5000 })
    ]);
  }

  // Return bounding box of the canvas (x, y, width, height)
  async canvasBox() {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not available');
    return box;
  }

  // Move mouse to a normalized node location and wait a bit for hover effects
  async hoverNode(label) {
    const box = await this.canvasBox();
    const pos = this.nodePositions[label];
    if (!pos) throw new Error(`Unknown node label: ${label}`);
    const clientX = box.x + pos.x * box.width;
    const clientY = box.y + pos.y * box.height;
    await this.page.mouse.move(clientX, clientY);
    // allow the canvas event handlers to process and for tooltip to appear
    await this.page.waitForTimeout(200);
    return { clientX, clientY };
  }

  // Move mouse off the canvas (top-left of viewport)
  async moveOffCanvas() {
    await this.page.mouse.move(0, 0);
    await this.page.waitForTimeout(150);
  }

  // Toggle arrow animation button
  async clickToggle() {
    await this.btnToggle.click();
    // small wait for UI updates
    await this.page.waitForTimeout(120);
  }

  // Click reset button
  async clickReset() {
    await this.btnReset.click();
    await this.page.waitForTimeout(120);
  }
}

// Capture console errors and page errors across tests
test.describe('Directed Graph — FSM and interaction tests', () => {
  let gp;
  /** @type {string[]} */
  let consoleErrorMessages;
  /** @type {Error[]} */
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize arrays to collect runtime issues
    consoleErrorMessages = [];
    pageErrors = [];

    // Listen to console events and collect error-level messages
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrorMessages.push(msg.text());
        }
      } catch (e) {
        // ignore listener exceptions
      }
    });

    // Listen to uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    gp = new GraphPage(page);
    await gp.goto();
  });

  test.afterEach(async ({ page }) => {
    // For diagnostic purposes, if errors were captured, dump them to the Playwright trace (console)
    if (consoleErrorMessages.length > 0) {
      // eslint-disable-next-line no-console
      console.error('Console errors captured during test:', ...consoleErrorMessages);
    }
    if (pageErrors.length > 0) {
      // eslint-disable-next-line no-console
      console.error('Page errors captured during test:', ...pageErrors);
    }
    // Sanity: assert no uncaught page errors or console errors happened during interactions
    expect(pageErrors.length, 'No uncaught page errors should be present').toBe(0);
    expect(consoleErrorMessages.length, 'No console.error messages should be present').toBe(0);
  });

  test.describe('Initial state - S0_Idle validations', () => {
    test('Initial DOM elements, attributes and Idle expectations', async () => {
      // Validate initial button label and aria state which imply animation state
      await expect(gp.btnToggle).toHaveText('Pause Arrows');
      await expect(gp.btnToggle).toHaveAttribute('aria-pressed', 'true');

      // Tooltip should be hidden at load (Idle)
      await expect(gp.tooltip).toHaveAttribute('aria-hidden', 'true');
      // Tooltip has no visible text initially
      const tText = await gp.tooltip.textContent();
      expect(tText ? tText.trim() : '').toBe('');

      // Canvas should have expected role and labeling
      await expect(gp.canvas).toHaveAttribute('role', 'img');
      await expect(gp.canvas).toHaveAttribute('aria-label', 'Directed graph illustration');
    });

    test('Moving mouse in Idle triggers draw and tooltip when hovering a node (S0 -> S2)', async ({ page }) => {
      // Move to node A; in Idle moving to a node should start rendering and show tooltip
      const { clientX, clientY } = await gp.hoverNode('A');

      // Tooltip should show node label and be visible
      await expect(gp.tooltip).toHaveText('Node A');
      await expect(gp.tooltip).toHaveClass(/visible/);
      await expect(gp.tooltip).toHaveAttribute('aria-hidden', 'false');

      // Tooltip position should roughly match mouse coordinates (left/top style)
      const leftStyle = await gp.tooltip.evaluate((el) => el.style.left);
      const topStyle = await gp.tooltip.evaluate((el) => el.style.top);
      expect(leftStyle).toContain(Math.round(clientX).toString().slice(0, 3)); // coarse check
      expect(topStyle).toContain(Math.round(clientY).toString().slice(0, 3));
    });
  });

  test.describe('Toggle arrow animation transitions (S0 <-> S1 <-> S2)', () => {
    test('Clicking toggle pauses and resumes animation and updates aria attributes', async () => {
      // Initial state is playing (Pause Arrows). Click -> pause
      await gp.clickToggle();
      await expect(gp.btnToggle).toHaveText('Play Arrows');
      await expect(gp.btnToggle).toHaveAttribute('aria-pressed', 'false');

      // Click again -> resume
      await gp.clickToggle();
      await expect(gp.btnToggle).toHaveText('Pause Arrows');
      await expect(gp.btnToggle).toHaveAttribute('aria-pressed', 'true');

      // Additional toggles should keep parity consistent
      await gp.clickToggle(); // pause
      await gp.clickToggle(); // play
      await expect(gp.btnToggle).toHaveText('Pause Arrows');
      await expect(gp.btnToggle).toHaveAttribute('aria-pressed', 'true');
    });

    test('Rapid toggling does not throw errors and leaves the UI in a consistent state', async ({ page }) => {
      // Rapid click sequence
      for (let i = 0; i < 6; i++) {
        await gp.btnToggle.click();
        // micro-wait to allow handlers to run
        await page.waitForTimeout(40);
      }
      // Final state should be based on parity; starting from Pause Arrows (playing), six toggles -> still playing
      await expect(gp.btnToggle).toHaveText('Pause Arrows');
      await expect(gp.btnToggle).toHaveAttribute('aria-pressed', 'true');
    });
  });

  test.describe('Mouse interactions while animation playing (S2) and leaving (S2 -> S0)', () => {
    test('Hovering different nodes updates tooltip and hovered node state visually', async ({ page }) => {
      // Ensure playing state
      await expect(gp.btnToggle).toHaveText('Pause Arrows');

      // Hover node D
      await gp.hoverNode('D');
      await expect(gp.tooltip).toHaveText('Node D');
      await expect(gp.tooltip).toHaveAttribute('aria-hidden', 'false');

      // Hover node G
      await gp.hoverNode('G');
      await expect(gp.tooltip).toHaveText('Node G');
      await expect(gp.tooltip).toHaveClass(/visible/);

      // Move off canvas -> tooltip should hide and aria-hidden true
      await gp.moveOffCanvas();
      await expect(gp.tooltip).toHaveAttribute('aria-hidden', 'true');
      await expect(gp.tooltip).not.toHaveClass(/visible/);
    });

    test('Mouseleave triggers tooltip hide and does not cause runtime errors', async () => {
      // Hover a node first
      await gp.hoverNode('E');
      await expect(gp.tooltip).toHaveText('Node E');

      // Trigger mouseleave by moving outside canvas
      await gp.moveOffCanvas();

      // Tooltip should be hidden
      await expect(gp.tooltip).toHaveAttribute('aria-hidden', 'true');
    });
  });

  test.describe('Reset event and edge cases', () => {
    test('Clicking Reset resets animation progress without producing errors', async ({ page }) => {
      // Click reset while playing
      await gp.clickReset();

      // There is no visible textual change expected from Reset, but the button should remain the same
      await expect(gp.btnToggle).toHaveText(/Pause|Play Arrows/);

      // Click toggle to pause and then click reset - should still not error
      await gp.clickToggle(); // pause
      await gp.clickReset();
      await expect(gp.btnToggle).toHaveText('Play Arrows');

      // Resume play for stability
      await gp.clickToggle();
      await expect(gp.btnToggle).toHaveText('Pause Arrows');
    });

    test('Moving to empty canvas area does not show tooltip and does not error', async () => {
      // Compute a point likely far from nodes: center bottom-right corner fraction
      const box = await gp.canvasBox();
      const clientX = box.x + box.width * 0.95;
      const clientY = box.y + box.height * 0.95;
      await gp.page.mouse.move(clientX, clientY);
      await gp.page.waitForTimeout(150);

      // Tooltip should remain hidden
      await expect(gp.tooltip).toHaveAttribute('aria-hidden', 'true');
      await expect(gp.tooltip).not.toHaveClass(/visible/);
    });
  });

  test.describe('Observability: console and page errors', () => {
    test('No console.error or uncaught page errors during typical usage scenarios', async ({ page }) => {
      // Perform a couple interactions: hover, toggle, reset, leave
      await gp.hoverNode('B');
      await gp.clickToggle();
      await gp.clickReset();
      await gp.clickToggle();
      await gp.moveOffCanvas();

      // Allow potential asynchronous errors to surface
      await page.waitForTimeout(250);

      // The afterEach hook will assert zero pageErrors and zero console errors.
      // To add an explicit assertion here as well:
      expect(pageErrors.length).toBe(0);
      expect(consoleErrorMessages.length).toBe(0);
    });
  });
});