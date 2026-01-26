import { test, expect } from '@playwright/test';

const URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f653f3-fa77-11f0-a6a1-c765f41a13c7.html';

// Page object encapsulating interactions and queries against the visualization page
class PrimPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    // Load the page as-is; let any runtime errors happen naturally
    await this.page.goto(URL, { waitUntil: 'domcontentloaded' });
  }

  replayBtn() {
    return this.page.locator('#replayBtn');
  }

  nodes() {
    return this.page.locator('#nodes > g');
  }

  edges() {
    return this.page.locator('#edges > path');
  }

  weights() {
    return this.page.locator('#weights > g');
  }

  timelineSteps() {
    return this.page.locator('#timeline .step');
  }

  stepByIndex(idx) {
    return this.page.locator(`#step-${idx}`);
  }

  finalStep() {
    return this.page.locator('#step-final');
  }

  startNodeEl() {
    return this.page.locator('#startNode');
  }

  totalWeightEl() {
    return this.page.locator('#totalWeight');
  }

  finalWeightEl() {
    return this.page.locator('#finalWeight');
  }

  // Waits until final timeline step has 'active' class indicating animation completed
  async waitForAnimationComplete(timeout = 20000) {
    await this.page.waitForFunction(() => {
      const fin = document.getElementById('step-final');
      return !!fin && fin.classList.contains('active');
    }, null, { timeout });
  }

  // Waits until the replay button returns to enabled state (useful after clicking replay)
  async waitForReplayButtonEnabled(timeout = 20000) {
    await this.page.waitForFunction(() => {
      const btn = document.getElementById('replayBtn');
      return !!btn && btn.disabled === false;
    }, null, { timeout });
  }
}

test.describe("Prim's Algorithm — Visual Elegance (f1f653f3...)", () => {
  // Collect console errors and page errors for assertions
  let consoleErrors = [];
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages; we will assert expectations later.
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ }, testInfo) => {
    // If any unexpected console errors / page errors exist, attach them to the test output to aid debugging.
    if (consoleErrors.length > 0) {
      testInfo.attach('console-errors', { body: consoleErrors.join('\n'), contentType: 'text/plain' });
    }
    if (pageErrors.length > 0) {
      testInfo.attach('page-errors', { body: pageErrors.map(e => String(e)).join('\n\n'), contentType: 'text/plain' });
    }
  });

  test('S0_Idle: on initial load the graph is drawn and base visuals exist', async ({ page }) => {
    // This test validates the Idle state (S0_Idle):
    // - drawGraph() is invoked on entry (we verify DOM elements were created)
    // - edges are initially dimmed
    // - nodes and weight labels are present
    const prim = new PrimPage(page);
    await prim.goto();

    // Wait for the SVG groups to be present
    await expect(prim.nodes()).toHaveCount(8, { timeout: 2000 }); // expect 8 nodes as per the HTML data
    const edgeCount = await prim.edges().count();
    const weightCount = await prim.weights().count();

    // Basic sanity checks: there should be at least one edge and weight label per visible edge
    expect(edgeCount).toBeGreaterThan(0);
    expect(weightCount).toBeGreaterThan(0);
    // The counts should be equalish (each edge draws one weight group)
    expect(Math.abs(edgeCount - weightCount)).toBeLessThanOrEqual(2);

    // Check that edges have the 'dim' class applied initially (drawGraph then applied dim class)
    const anyDim = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('#edges > path')).some(p => p.classList.contains('dim'));
    });
    expect(anyDim).toBe(true);

    // startNode element may be updated by autoplay shortly; ensure it exists
    await expect(prim.startNodeEl()).toHaveText(/^[A-Z]$/); // should be a single letter like "A" quickly
  });

  test('S1_Animating: autoplay runs and animation completes (final step active and weights updated)', async ({ page }) => {
    // This test validates the Animating state (S1_Animating) and the AnimationComplete transition back to Idle:
    // - after autoplay the timeline final step should become active
    // - total and final weight display update from placeholders to numeric totals
    const prim = new PrimPage(page);
    await prim.goto();

    // Wait for the animation to complete (timeline final step gains 'active' class)
    await prim.waitForAnimationComplete(20000);

    // Assert final timeline step has active class
    const finalHasActive = await page.evaluate(() => {
      const fin = document.getElementById('step-final');
      return !!fin && fin.classList.contains('active');
    });
    expect(finalHasActive).toBe(true);

    // Verify that totalWeight and finalWeight were updated to show numeric totals
    const totalText = await prim.totalWeightEl().innerText();
    const finalText = await prim.finalWeightEl().innerText();
    // totalWeight should now be some numeric string (not the placeholder '—')
    expect(totalText).not.toMatch(/—/);
    expect(finalText).toMatch(/Total:\s*\d+/);

    // Verify nodes have some in-tree markings after completion
    const inTreeCount = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.node.in-tree')).length;
    });
    expect(inTreeCount).toBeGreaterThanOrEqual(2); // After MST completes, several nodes are in-tree
  });

  test('ReplayClick transition: clicking #replayBtn triggers replay flow and restores button state', async ({ page }) => {
    // This test validates the transition S0_Idle --(ReplayClick)--> S1_Animating and the completion transition:
    // - clicking replay disables the button and changes its text to the "replaying" label
    // - after animation completes the button is re-enabled and text restored to '▶ Replay'
    const prim = new PrimPage(page);
    await prim.goto();

    // Wait for initial autoplay to finish to get into a stable Idle state
    await prim.waitForAnimationComplete(20000);

    const btn = prim.replayBtn();
    await expect(btn).toBeVisible();

    // Click the replay button and assert immediate UI updates
    await btn.click();

    // Immediately after click the button should be disabled and text changed
    await expect(btn).toBeDisabled();
    // Text content may contain whitespace/newline; normalize by reading innerText
    const afterClickText = (await btn.innerText()).trim();
    expect(afterClickText).toContain('Replaying');

    // While replaying, the timeline should update: step-final will eventually become active again
    await prim.waitForAnimationComplete(20000);

    // After the replay completes, button should become enabled and text restored
    await prim.waitForReplayButtonEnabled(20000);
    await expect(btn).toBeEnabled();
    const finalBtnText = (await btn.innerText()).trim();
    // exact content expected from code is '▶ Replay'
    expect(finalBtnText).toContain('Replay');

    // Ensure final timeline step active again after replay
    const finActive = await page.evaluate(() => {
      const fin = document.getElementById('step-final');
      return !!fin && fin.classList.contains('active');
    });
    expect(finActive).toBe(true);
  });

  test('Edge cases and data consistency: cleaned edges and weights align with SVG elements', async ({ page }) => {
    // This test explores edge cases:
    // - invalid/malformed edges were filtered out by the implementation (no references to non-existent nodes)
    // - number of weight labels corresponds to rendered edges
    const prim = new PrimPage(page);
    await prim.goto();

    // Query counts
    const nodeCount = await prim.nodes().count();
    const edgeCount = await prim.edges().count();
    const weightCount = await prim.weights().count();

    // Confirm expected node count from the source (8 nodes)
    expect(nodeCount).toBe(8);

    // Each edge should have a corresponding weight label group
    // Accept small variance but ensure weightCount >= edgeCount - tolerate grouping differences
    expect(weightCount).toBeGreaterThanOrEqual(Math.max(0, edgeCount - 1));

    // Verify no edge's path has coordinates referencing missing nodes:
    // We will ensure every edge path has a valid 'd' attribute and is attached to the DOM
    const invalidPaths = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('#edges > path')).filter(p => {
        const d = p.getAttribute('d');
        return !d || typeof d !== 'string' || d.trim().length === 0;
      }).length;
    });
    expect(invalidPaths).toBe(0);
  });

  test('Observes console and page errors: there should be no uncaught exceptions or console-level errors', async ({ page }) => {
    // This test monitors runtime errors. Per instructions we let errors happen naturally and assert expectations.
    // The visualization should ideally not produce uncaught ReferenceError/TypeError/SyntaxError.
    const prim = new PrimPage(page);
    await prim.goto();

    // Wait a short while to collect console messages and possible page errors from initial autoplay
    // (longer wait to allow any async code to run)
    await page.waitForTimeout(2500);

    // Process the collected messages / errors
    // Ensure no page-level uncaught exceptions were emitted
    expect(pageErrors.length).toBe(0);

    // Ensure there were no console messages of type 'error'
    expect(consoleErrors.length).toBe(0);

    // If there are any console messages, at least they should be benign (info/debug)
    // Attach a summary of console messages to test output if present for debugging
    if (consoleMessages.length > 0) {
      // Basic sanity: at least some logs were produced (could be zero)
      // We simply ensure there are no 'error' typed messages (already asserted)
      expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
    }
  });

});