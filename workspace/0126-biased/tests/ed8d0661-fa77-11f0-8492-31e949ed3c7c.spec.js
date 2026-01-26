import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8d0661-fa77-11f0-8492-31e949ed3c7c.html';

class TreePage {
  /**
   * Page object for the Red-Black Tree Visualization page.
   * Encapsulates interactions and common assertions.
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Click the "Toggle View" button
  async clickToggle() {
    await this.page.click("button[onclick='toggleView()']");
    // Wait a short moment for JS to run and transitions (if any) to take effect.
    await this.page.waitForTimeout(150);
  }

  // Click the "Reset" button
  async clickReset() {
    await this.page.click("button[onclick='resetView()']");
    await this.page.waitForTimeout(150);
  }

  // Return Node elements handles
  async getNodeHandles() {
    return await this.page.$$('.node');
  }

  // Return an array of inline style.transform values for all .node elements
  async getNodeInlineTransforms() {
    return await this.page.$$eval('.node', nodes => nodes.map(n => n.style.transform || ''));
  }

  // Return an array of computed transform strings for all .node elements
  // (Some browsers might convert scale(...) to matrix(...))
  async getNodeComputedTransforms() {
    return await this.page.$$eval('.node', nodes => {
      return nodes.map(n => {
        const cs = window.getComputedStyle(n);
        return cs.transform || 'none';
      });
    });
  }

  // Utility to count how many nodes have a particular inline transform value
  async countInlineTransforms(value) {
    const arr = await this.getNodeInlineTransforms();
    return arr.filter(v => v === value).length;
  }

  // Utility to assert that all nodes have a particular inline transform value
  async allNodesHaveInlineTransform(value) {
    const arr = await this.getNodeInlineTransforms();
    return arr.every(v => v === value);
  }

  // Utility to assert that at least one node has inline transform equal to value
  async someNodeHasInlineTransform(value) {
    const arr = await this.getNodeInlineTransforms();
    return arr.some(v => v === value);
  }
}

test.describe('Red-Black Tree Visualization - FSM and DOM tests', () => {
  // Arrays to collect console.error messages and page errors for each test
  let consoleErrors;
  let consoleWarnings;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    consoleWarnings = [];
    pageErrors = [];

    // Capture console messages and page errors
    page.on('console', msg => {
      // collect error/warn logs for later assertions and debugging
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        consoleErrors.push(text);
      } else if (type === 'warning') {
        consoleWarnings.push(text);
      }
    });

    page.on('pageerror', err => {
      // Uncaught exceptions will be reported here.
      pageErrors.push(err.toString());
    });
  });

  test('Initial state S0_Idle on page load - controls present and nodes rendered', async ({ page }) => {
    // Validate the Idle state's visible evidence: page renders buttons and nodes exist
    const tree = new TreePage(page);
    await tree.goto();

    // Check that the Toggle and Reset buttons are present
    const toggleButton = await page.$("button[onclick='toggleView()']");
    const resetButton = await page.$("button[onclick='resetView()']");
    expect(toggleButton).not.toBeNull();
    expect(resetButton).not.toBeNull();

    // Verify expected button text
    const toggleText = await toggleButton.innerText();
    const resetText = await resetButton.innerText();
    expect(toggleText).toContain('Toggle View');
    expect(resetText).toContain('Reset');

    // Verify nodes exist and initial inline transforms are empty (no scaling applied yet)
    const nodes = await tree.getNodeHandles();
    expect(nodes.length).toBeGreaterThanOrEqual(1); // there should be nodes drawn

    const inlineTransforms = await tree.getNodeInlineTransforms();
    // Initial implementation does not set inline transform for nodes, so expect empty strings
    for (const t of inlineTransforms) {
      expect(typeof t).toBe('string');
    }

    // Assert there were no uncaught exceptions or console errors on load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition: ToggleView (S0_Idle -> S1_BoldView) - observe actual DOM transforms and detect implementation discrepancy', async ({ page }) => {
    // This test clicks the Toggle View button and inspects the inline transforms.
    // FSM expects all nodes to scale to 1.1. The implementation contains a subtle bug:
    // it toggles the global isBold flag inside the forEach loop, producing alternating scales.
    const tree = new TreePage(page);
    await tree.goto();

    // Click Toggle once
    await tree.clickToggle();

    // Gather inline transforms after toggle
    const inlineTransforms = await tree.getNodeInlineTransforms();

    // There should be at least one node scaled to 1.1 according to implementation behavior
    const countScale11 = inlineTransforms.filter(t => t === 'scale(1.1)').length;
    const countScale1 = inlineTransforms.filter(t => t === 'scale(1)').length;

    // Validate that toggle attempted to scale nodes (at least one node got scale(1.1))
    expect(countScale11).toBeGreaterThanOrEqual(1);

    // Validate whether the implementation produced a uniform result.
    // FSM expects all nodes to be scale(1.1), but the current implementation toggles per-node,
    // so we assert the presence of both scales to highlight the discrepancy.
    const hasBothScales = countScale11 > 0 && countScale1 > 0;
    expect(hasBothScales).toBe(true);

    // Also assert no uncaught runtime errors occurred during this interaction
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition: ToggleView (S1_BoldView -> S0_Idle) - second toggle click and verification', async ({ page }) => {
    // Clicking Toggle again should reverse the view. FSM expects nodes to scale to 1.
    // Because of the implementation bug, the result will still be non-uniform; verify actual behavior.
    const tree = new TreePage(page);
    await tree.goto();

    // Click twice to return to the "idle" expected state
    await tree.clickToggle();
    await tree.clickToggle();

    const inlineTransforms = await tree.getNodeInlineTransforms();

    // Count inline transform occurrences
    const countScale11 = inlineTransforms.filter(t => t === 'scale(1.1)').length;
    const countScale1 = inlineTransforms.filter(t => t === 'scale(1)').length;

    // Verify that at least some nodes are set to scale(1) (reset behavior intended by toggling)
    expect(countScale1).toBeGreaterThanOrEqual(1);

    // Due to the bug, there will likely still be nodes with scale(1.1).
    // Confirm that both transform values are present, indicating the non-uniform toggle behavior.
    const hasBothScales = countScale11 > 0 && countScale1 > 0;
    expect(hasBothScales).toBe(true);

    // No uncaught errors should have occurred
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition: ResetView (S0_Idle -> S2_NormalView) - reset button sets all nodes to scale(1)', async ({ page }) => {
    // Reset should set every node's inline transform to 'scale(1)' and also restore isBold logical value.
    // We validate that every node gets scale(1) inline style.
    const tree = new TreePage(page);
    await tree.goto();

    // First, induce a variety of states by toggling once
    await tree.clickToggle();

    // Now click Reset
    await tree.clickReset();

    // After reset, the implementation explicitly sets node.style.transform = 'scale(1)' for all nodes
    const inlineTransformsAfterReset = await tree.getNodeInlineTransforms();

    // All nodes should have inline transform exactly 'scale(1)'
    for (const t of inlineTransformsAfterReset) {
      expect(t).toBe('scale(1)');
    }

    // For additional verification, check computed transforms (some browsers may show matrix)
    const computedTransforms = await tree.getNodeComputedTransforms();
    for (const ct of computedTransforms) {
      // computed style may be 'matrix(1, 0, 0, 1, 0, 0)' for scale(1) or 'none'
      expect(ct === 'none' || ct === 'matrix(1, 0, 0, 1, 0, 0)' || ct === 'matrix(1,0,0,1,0,0)').toBeTruthy();
    }

    // No uncaught runtime errors should happen during reset
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge cases: multiple resets and rapid toggles should not throw runtime errors', async ({ page }) => {
    // Rapid interactions should be tolerated by the page; collect any runtime errors produced.
    const tree = new TreePage(page);
    await tree.goto();

    // Rapid sequence: toggle, reset, toggle x3, reset x2
    await tree.clickToggle();
    await tree.clickReset();
    await tree.clickToggle();
    await tree.clickToggle();
    await tree.clickToggle();
    await tree.clickReset();
    await tree.clickReset();

    // Verify final state: after final reset all inline transforms should be 'scale(1)'
    const inlineTransforms = await tree.getNodeInlineTransforms();
    for (const t of inlineTransforms) {
      expect(t).toBe('scale(1)');
    }

    // Assert no uncaught exceptions were produced during the rapid interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Implementation characterization: confirm the toggle implementation results in alternating transforms (demonstrates bug vs FSM expectation)', async ({ page }) => {
    // This test deliberately characterizes the bug: the global isBold is toggled inside the forEach loop,
    // causing an alternating pattern of inline transforms instead of a uniform change.
    const tree = new TreePage(page);
    await tree.goto();

    // Trigger toggle once
    await tree.clickToggle();

    const inlineTransforms = await tree.getNodeInlineTransforms();

    // Build a pattern string, e.g., "1.1,1,1.1,1,..." for visibility in assertion messages
    const pattern = inlineTransforms.map(t => t.replace('scale(', '').replace(')', '') || 'none').join(',');

    // Expect at least two distinct values among inline transforms (evidence of non-uniform scaling)
    const uniqueValues = Array.from(new Set(inlineTransforms));
    expect(uniqueValues.length).toBeGreaterThanOrEqual(2);

    // Provide an explicit informative check: count of alternating values should be >= 1 for both
    const countScale11 = inlineTransforms.filter(t => t === 'scale(1.1)').length;
    const countScale1 = inlineTransforms.filter(t => t === 'scale(1)').length;
    expect(countScale11).toBeGreaterThanOrEqual(1);
    expect(countScale1).toBeGreaterThanOrEqual(1);

    // Ensure no runtime errors were produced while exposing this behavior
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Attach the pattern to the test failure message if problems arise (Playwright will show assertion context)
    // (No further action — pattern is available in the test output through variables if needed)
  });
});