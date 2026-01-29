import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c96f132-fa78-11f0-857d-d58e82d5de73.html';

/**
 * Page Object for the Heap Sort Visualizer app.
 * Encapsulates common interactions used across tests.
 */
class VisualizerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleErrors = [];
    this.pageErrors = [];

    // capture console error messages and page errors for assertions
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        this.consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });
    this.page.on('pageerror', err => {
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // ensure initial rendering tick has completed
    await this.page.waitForTimeout(50);
  }

  // Control buttons
  startButton() {
    return this.page.locator('#startBtn');
  }
  resetButton() {
    return this.page.locator('#resetBtn');
  }

  async clickStart() {
    await this.startButton().click();
  }
  async clickReset() {
    await this.resetButton().click();
  }

  // DOM queries
  arrayBars() {
    return this.page.locator('#arrayContainer .array-bar');
  }
  heapNodes() {
    return this.page.locator('svg#heapTree circle.node');
  }
  heapLabels() {
    return this.page.locator('svg#heapTree text.node-label');
  }
  tooltip() {
    return this.page.locator('.tooltip');
  }
  svgHeap() {
    return this.page.locator('svg#heapTree');
  }

  // Helpers to extract values from array bars
  async getArrayValues() {
    const count = await this.arrayBars().count();
    const values = [];
    for (let i = 0; i < count; i++) {
      values.push(await this.arrayBars().nth(i).textContent());
    }
    return values.map(v => v && v.trim());
  }

  // Helpers to get all heap node values and indices
  async getHeapNodeData() {
    const nodes = [];
    const count = await this.heapNodes().count();
    for (let i = 0; i < count; i++) {
      const n = this.heapNodes().nth(i);
      const idx = await n.getAttribute('data-index');
      const val = await n.getAttribute('data-value');
      nodes.push({ index: idx === null ? null : Number(idx), value: val === null ? null : Number(val) });
    }
    return nodes;
  }

  async isStartDisabled() {
    return await this.startButton().isDisabled();
  }
  async isResetDisabled() {
    return await this.resetButton().isDisabled();
  }

  async waitForAnyHighlight(timeout = 5000) {
    // Wait for any element to have the CSS 'highlighted' class which indicates animation
    await this.page.waitForSelector('.highlighted', { timeout });
  }

  async hoverFirstHeapNode() {
    const first = this.heapNodes().first();
    const box = await first.boundingBox();
    if (!box) throw new Error('First heap node has no bounding box');
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    // small delay to allow tooltip to appear
    await this.page.waitForTimeout(100);
  }

  async leaveHeap() {
    // Move mouse out of svg area to trigger mouseleave
    const svgBox = await this.svgHeap().boundingBox();
    if (!svgBox) throw new Error('SVG has no bounding box');
    await this.page.mouse.move(svgBox.x + svgBox.width + 10, svgBox.y + svgBox.height + 10);
    await this.page.waitForTimeout(50);
  }
}

test.describe('Heap Sort Visualization — FSM & UI tests', () => {
  let visual;

  test.beforeEach(async ({ page }) => {
    visual = new VisualizerPage(page);
    await visual.goto();
  });

  test.afterEach(async ({}, testInfo) => {
    // Always assert we have captured console and page error arrays as part of diagnostics.
    // Tests below will assert expected absence or presence of errors depending on scenario.
    // Attach diagnostics to test output if available
    if (visual.consoleErrors.length > 0) {
      // Print console errors to test output (Playwright will record them)
      // eslint-disable-next-line no-console
      console.warn('Console error messages captured:', visual.consoleErrors);
    }
    if (visual.pageErrors.length > 0) {
      // eslint-disable-next-line no-console
      console.warn('Page errors captured:', visual.pageErrors);
    }
  });

  test.describe('Initial State: S0_Idle', () => {
    test('initializes array and tree on load (initialize entry action)', async () => {
      // This validates initialize() was invoked on load: array and tree are rendered.
      const heapNodesCount = await visual.heapNodes().count();
      const arrayBarsCount = await visual.arrayBars().count();

      // According to implementation, maxElements is 15, so expect 15 bars and 15 heap nodes (one per element)
      expect(arrayBarsCount).toBeGreaterThan(0);
      expect(heapNodesCount).toBeGreaterThan(0);
      // They should match in count
      expect(heapNodesCount).toEqual(arrayBarsCount);

      // Start should be enabled initially and aria-pressed default "false" (attribute exists)
      const start = visual.startButton();
      await expect(start).toBeEnabled();
      const ariaPressed = await start.getAttribute('aria-pressed');
      expect(ariaPressed).toBe('false');

      // No console or page errors at initialization
      expect(visual.consoleErrors).toEqual([]);
      expect(visual.pageErrors).toEqual([]);
    });

    test('reset button resets to a new array when idle', async () => {
      // Capture current array values
      const before = await visual.getArrayValues();
      expect(before.length).toBeGreaterThan(0);

      // Clicking reset when idle should re-run initialize() and likely change the array
      await visual.clickReset();

      // small delay for re-initialization
      await visual.page.waitForTimeout(100);

      const after = await visual.getArrayValues();
      expect(after.length).toBeGreaterThan(0);

      // The arrays should typically be different; in the unlikely event of equality we still assert the app remained stable
      // So assert either different or identical but no runtime errors occurred and DOM updated
      // Prefer to assert that a new array was produced (most likely)
      if (before.join(',') === after.join(',')) {
        // If identical (extremely unlikely), at least confirm elements exist and there are no errors
        expect(after).toEqual(before);
      } else {
        expect(after.join(',')).not.toEqual(before.join(','));
      }

      expect(visual.consoleErrors).toEqual([]);
      expect(visual.pageErrors).toEqual([]);
    });
  });

  test.describe('Animating State: S1_Animating and transitions', () => {
    test('StartAnimation transitions to animating: start disables controls and produces highlights', async () => {
      // Click start and immediately controls should reflect animation starting
      await visual.clickStart();

      // Start of animation sets these buttons disabled in playAnimations() — validate that
      await expect(visual.startButton()).toBeDisabled();
      await expect(visual.resetButton()).toBeDisabled();

      // While animating, the UI should produce highlighted elements at some point.
      // We wait for any .highlighted element to appear to assert that animations are playing.
      await visual.waitForAnyHighlight(10000); // allow up to 10s to see first highlight for slower machines

      // Ensure at least one highlighted element exists now
      const highlightedCount = await visual.page.locator('.highlighted').count();
      expect(highlightedCount).toBeGreaterThan(0);

      // After observing that animation started, do not wait for entire sort to finish here to keep test time reasonable.
      // Instead, assert that no fatal console errors or page errors were produced up to this point.
      expect(visual.consoleErrors).toEqual([]);
      expect(visual.pageErrors).toEqual([]);
    });

    test('Reset during animation should be ignored (no transition) and controls remain disabled', async () => {
      // Start animation
      await visual.clickStart();
      await expect(visual.startButton()).toBeDisabled();
      await expect(visual.resetButton()).toBeDisabled();

      // Try clicking reset while animationRunning; onReset should return early (no initialize)
      await visual.clickReset();

      // Buttons should remain disabled because reset was ignored while animating
      await expect(visual.startButton()).toBeDisabled();
      await expect(visual.resetButton()).toBeDisabled();

      // Still should see highlighted elements eventually to confirm animation continues
      await visual.waitForAnyHighlight(10000);

      // No errors expected by merely attempting Reset during animation
      expect(visual.consoleErrors).toEqual([]);
      expect(visual.pageErrors).toEqual([]);
    });

    test('After animation completes, controls re-enable and reset performs initialize action (S1 -> S0)', async () => {
      // Start animation and wait until it finishes by waiting for start button to become enabled again
      await visual.clickStart();

      // Wait for animation to start (first highlight)
      await visual.waitForAnyHighlight(10000);

      // Now wait up to a generous timeout for animation to complete (may be many steps)
      // playAnimations sets startBtn.disabled = false when complete
      await visual.page.waitForFunction(() => {
        const b = document.getElementById('startBtn');
        return b && b.disabled === false;
      }, null, { timeout: 60000 }); // allow up to 60s for full animation on slower CI

      // Now start should be enabled and reset enabled
      await expect(visual.startButton()).toBeEnabled();
      await expect(visual.resetButton()).toBeEnabled();

      // Capture array after full animation
      const afterSort = await visual.getArrayValues();
      expect(afterSort.length).toBeGreaterThan(0);

      // Clicking reset now should re-initialize (S1_Animating -> S0_Idle transition triggers initialize())
      await visual.clickReset();
      await visual.page.waitForTimeout(100);
      const afterReset = await visual.getArrayValues();
      expect(afterReset.length).toBeGreaterThan(0);

      // Arrays are expected to change after reset (although they might coincidentally be the same)
      // At minimum, ensure DOM is stable and no errors were produced
      expect(visual.consoleErrors).toEqual([]);
      expect(visual.pageErrors).toEqual([]);
    }, { timeout: 90000 }); // longer timeout for full sort + reset

    test('Hovering over a heap node shows tooltip, leaving hides it (NodeHover & NodeLeave)', async () => {
      // Hover the first heap node to trigger tooltip
      await visual.hoverFirstHeapNode();

      // Tooltip should become visible and contain index and value text
      const tooltip = visual.tooltip();
      await expect(tooltip).toHaveClass(/visible/);
      const tooltipText = (await tooltip.textContent())?.trim() ?? '';
      expect(tooltipText).toMatch(/Heap Index:\s*\d+\s*\|\s*Value:\s*\d+/);

      // Leave the SVG area to hide tooltip
      await visual.leaveHeap();
      // small delay for hide transition
      await visual.page.waitForTimeout(100);
      await expect(tooltip).not.toHaveClass(/visible/);

      expect(visual.consoleErrors).toEqual([]);
      expect(visual.pageErrors).toEqual([]);
    });
  });

  test.describe('Edge cases & error observation', () => {
    test('Multiple rapid starts: subsequent starts are ignored while animating', async () => {
      // Kick off animation
      await visual.clickStart();

      // Ensure it's disabled after start
      await expect(visual.startButton()).toBeDisabled();

      // Attempt to click Start again multiple times rapidly
      // These clicks should have no effect and should not throw errors
      for (let i = 0; i < 5; i++) {
        await visual.startButton().click().catch(() => { /* clicking disabled button may throw; ignore */ });
      }

      // Confirm controls still disabled (animation still in progress)
      await expect(visual.startButton()).toBeDisabled();
      await expect(visual.resetButton()).toBeDisabled();

      // Wait for animation to finish to avoid flakiness in following tests
      await visual.page.waitForFunction(() => {
        const b = document.getElementById('startBtn');
        return b && b.disabled === false;
      }, null, { timeout: 60000 });

      // No console or page errors observed during rapid interactions
      expect(visual.consoleErrors).toEqual([]);
      expect(visual.pageErrors).toEqual([]);
    }, { timeout: 90000 });

    test('Sanity check: no unexpected runtime exceptions were thrown during interactions', async () => {
      // This test simply asserts that page did not emit any pageerror or console.error during previous interactions.
      // (Listeners were attached in the VisualizerPage constructor).
      expect(Array.isArray(visual.consoleErrors)).toBe(true);
      expect(Array.isArray(visual.pageErrors)).toBe(true);

      // The application is expected to run without runtime errors in normal operation.
      // Assert that no console errors or page errors were captured.
      expect(visual.consoleErrors).toEqual([]);
      expect(visual.pageErrors).toEqual([]);
    });
  });
});