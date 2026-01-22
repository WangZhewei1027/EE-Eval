import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f18203c0-d366-11f0-9b19-a558354ece3e.html';

// Page object helper for the Topological Sort app
class TopoPage {
  constructor(page) {
    this.page = page;
  }

  // Element getters
  performButton() {
    return this.page.locator("button[onclick='performTopologicalSort()']");
  }
  resetButton() {
    return this.page.locator("button[onclick='resetVisualization()']");
  }
  stepButton() {
    return this.page.locator('#stepBtn');
  }
  graphInput() {
    return this.page.locator('#graphInput');
  }
  result() {
    return this.page.locator('#result');
  }
  stepInfo() {
    return this.page.locator('#stepInfo');
  }
  graphContainer() {
    return this.page.locator('#graphContainer');
  }
  nodes() {
    return this.page.locator('.node');
  }

  // Utilities
  async getResultText() {
    return (await this.result().innerText()).trim();
  }

  async getStepInfoText() {
    return (await this.stepInfo().innerText()).trim();
  }

  async getStepBtnText() {
    return (await this.stepButton().innerText()).trim();
  }

  async nodeCount() {
    return await this.nodes().count();
  }

  async nodeWithDataAttr(nodeLabel) {
    return this.page.locator(`.node[data-node="${nodeLabel}"]`);
  }

  async getNodeClassList(nodeLabel) {
    const el = this.page.locator(`.node[data-node="${nodeLabel}"]`);
    const count = await el.count();
    if (count === 0) return null;
    return (await el.getAttribute('class')) || '';
  }
}

test.describe('Topological Sort Visualization - FSM States and Transitions', () => {
  // Capture console errors and page errors during each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', err => {
      // Collect uncaught exceptions thrown on the page
      pageErrors.push(err);
    });

    // Navigate to the application page and wait for load (window.onload calls displayGraph)
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Ensure we observed console and page errors arrays (will be asserted in tests individually)
    // This hook intentionally left to allow individual tests to assert on collected errors.
  });

  test('S0_Idle: Initial render shows title, input and graph nodes (Idle state)', async ({ page }) => {
    // Validate initial (Idle) state UI and that displayGraph executed on window.onload
    const topo = new TopoPage(page);

    // Check page title and header exist
    await expect(page.locator('h1')).toHaveText('Topological Sort Visualization');

    // Result and stepInfo should be empty at initial load
    await expect(topo.result()).toHaveText('');
    await expect(topo.stepInfo()).toHaveText('');

    // Graph should render nodes based on initial textarea content (A, B, C, D)
    // There should be four node elements created by displayGraph()
    await expect(topo.nodes()).toHaveCount(4);

    // Ensure no uncaught page errors occurred during initial load
    expect(pageErrors.length, 'No uncaught page errors during initial load').toBe(0);
    expect(consoleErrors.length, 'No console error messages during initial load').toBe(0);
  });

  test('S0_Idle -> S1_Sorting (PerformSort): Clicking Perform Topological Sort displays correct order and updates visualization', async ({ page }) => {
    // This test validates the transition S0 -> S1 (PerformSort event) and entry action performTopologicalSort()
    const topo = new TopoPage(page);

    // Click the Perform Topological Sort button
    await topo.performButton().click();

    // The result div should contain the Topological Order text.
    // For the provided graph, expected deterministic order: A → B → D → C
    await expect(topo.result()).toContainText('Topological Order:');
    await expect(topo.result()).toHaveText(/Topological Order:\s*A\s*→\s*B\s*→\s*D\s*→\s*C/);

    // stepInfo should be updated by animateSteps (at least first message)
    await expect(topo.stepInfo()).not.toHaveText('');

    // Graph nodes should still exist after sorting
    await expect(topo.nodes()).toHaveCount(4);

    // No uncaught errors expected from performing the sort on valid input
    expect(pageErrors.length, 'No uncaught page errors after performing topological sort').toBe(0);
    expect(consoleErrors.length, 'No console error messages after performing topological sort').toBe(0);
  });

  test('S1_Sorting -> S2_Stepping and stepping through all steps updates step info and node classes', async ({ page }) => {
    // This test validates stepping behavior: entering stepping mode and iterating steps (S1 -> S2 -> S2 ...)
    const topo = new TopoPage(page);

    // To validate that resetVisualization is invoked when stepping starts (onEnter action for stepping),
    // first put the app into a different visible state by clicking perform to have some result text,
    // then click Step Through which (per implementation) calls resetVisualization at start of stepping.
    await topo.performButton().click();
    await expect(topo.result()).toContainText('Topological Order');

    // Now click the Step Through button to start stepping
    await topo.stepButton().click();

    // On first click of Step Through, button text should change to 'Next Step'
    await expect(topo.stepButton()).toHaveText('Next Step');

    // The first step message should indicate starting nodes with indegree 0 (for our graph: 'Starting with nodes having in-degree 0: A')
    const firstStep = await topo.getStepInfoText();
    expect(firstStep).toMatch(/Starting with nodes having in-degree 0:\s*A/);

    // The currently active node for the "initial" step might be null, so the first 'process' step will be the next click.
    // Click through steps until stepping completes and the button text returns to 'Step Through'.
    // We will guard against infinite loops by limiting attempts.
    const maxClicks = 30;
    let clicks = 0;
    while (clicks < maxClicks) {
      const btnText = await topo.getStepBtnText();
      if (btnText === 'Step Through') {
        // We're back to idle stepping button -> stepping finished
        break;
      }
      // Click Next Step
      await topo.stepButton().click();
      clicks++;

      // Small wait to allow DOM updates from updateStep()
      await page.waitForTimeout(50);
    }

    // After stepping completes the button should be reset to 'Step Through'
    await expect(topo.stepButton()).toHaveText('Step Through');

    // As a final verification, nodes that were processed should have 'completed' class applied
    // For the final topological order A,B,D,C the last step should have all nodes completed
    const classesA = await topo.getNodeClassList('A');
    const classesB = await topo.getNodeClassList('B');
    const classesC = await topo.getNodeClassList('C');
    const classesD = await topo.getNodeClassList('D');
    expect(classesA).toContain('completed');
    expect(classesB).toContain('completed');
    expect(classesC).toContain('completed');
    expect(classesD).toContain('completed');

    // No uncaught errors during stepping
    expect(pageErrors.length, 'No uncaught page errors during stepping').toBe(0);
    expect(consoleErrors.length, 'No console error messages during stepping').toBe(0);
  });

  test('S1_Sorting -> S3_Reset: Reset button clears visualization and returns to Idle', async ({ page }) => {
    // This test validates Reset behavior from Sorting state to Reset state and then back to Idle.
    const topo = new TopoPage(page);

    // Start by performing a sort to populate result and graph
    await topo.performButton().click();
    await expect(topo.result()).toContainText('Topological Order');

    // Now click Reset to trigger resetVisualization (S1 -> S3)
    await topo.resetButton().click();

    // After reset, result and stepInfo should be empty and graph should be cleared
    await expect(topo.result()).toHaveText('');
    await expect(topo.stepInfo()).toHaveText('');
    await expect(topo.graphContainer()).toHaveText('', { timeout: 1000 });

    // Step button should be reset to default label
    await expect(topo.stepButton()).toHaveText('Step Through');

    // No uncaught page errors expected
    expect(pageErrors.length, 'No uncaught page errors after reset').toBe(0);
    expect(consoleErrors.length, 'No console error messages after reset').toBe(0);
  });

  test('S2_Stepping -> S3_Reset and S3_Reset -> S0_Idle: Reset during stepping clears state and allow new sort', async ({ page }) => {
    // This test validates that Reset clears stepping state and from Reset we can perform a new sort (S3 -> S0 -> S1)
    const topo = new TopoPage(page);

    // Enter stepping mode
    await topo.stepButton().click();
    await expect(topo.stepButton()).toHaveText('Next Step');

    // Now click Reset while in stepping mode
    await topo.resetButton().click();

    // Should clear step info and return button to 'Step Through'
    await expect(topo.stepInfo()).toHaveText('');
    await expect(topo.stepButton()).toHaveText('Step Through');

    // Now from Reset/Idle perform a new topological sort to verify S3 -> S0 -> S1 transition works
    await topo.performButton().click();
    await expect(topo.result()).toContainText('Topological Order');
    await expect(topo.nodes()).toHaveCount(4);

    // No uncaught page errors expected
    expect(pageErrors.length, 'No uncaught page errors during reset-transition-perform sequence').toBe(0);
    expect(consoleErrors.length, 'No console error messages during reset-transition-perform sequence').toBe(0);
  });

  test('Edge case: Cycle detection shows an error message and does not produce a topological order', async ({ page }) => {
    // This validates cycle detection path (expected observable: "Cycle detected!" and error displayed)
    const topo = new TopoPage(page);

    // Replace graph input with a cyclic graph
    await topo.graphInput().fill('A→B\nB→A');

    // Click Perform Topological Sort
    await topo.performButton().click();

    // The result should contain the cycle error message with .error class
    // Wait briefly for DOM update
    await page.waitForTimeout(50);
    const resultHTML = await topo.result().innerHTML();
    expect(resultHTML).toContain('Cycle detected!');
    expect(resultHTML).toContain('class="error"');

    // stepInfo should include 'Cycle detected' step if steps were recorded
    const stepInfoText = await topo.getStepInfoText();
    // stepInfo might be empty or contain a message - accept either but if present must mention cycle
    if (stepInfoText.length > 0) {
      expect(stepInfoText).toMatch(/Cycle detected/i);
    }

    // No uncaught page errors should have been thrown by cycle detection code
    expect(pageErrors.length, 'No uncaught page errors during cycle detection').toBe(0);
    expect(consoleErrors.length, 'No console error messages during cycle detection').toBe(0);
  });

  test('Verify onExit/onEnter action: performing sort resets stepping state (resetVisualization invoked)', async ({ page }) => {
    // This test validates that performTopologicalSort invokes resetVisualization at start (onExit action from Idle)
    // We induce a visible change to demonstrate resetVisualization effect by entering stepping mode,
    // then performing a sort should reset the step button text (resetVisualization sets to 'Step Through').
    const topo = new TopoPage(page);

    // Enter stepping mode to change the step button text to 'Next Step'
    await topo.stepButton().click();
    await expect(topo.stepButton()).toHaveText('Next Step');

    // Now click Perform Topological Sort which should call resetVisualization() at its start
    await topo.performButton().click();

    // After performTopologicalSort is invoked, resetVisualization should have set the step button label back to 'Step Through'
    await expect(topo.stepButton()).toHaveText('Step Through');

    // And result should display the topological order as well
    await expect(topo.result()).toContainText('Topological Order');

    // No uncaught page errors expected during this sequence
    expect(pageErrors.length, 'No uncaught page errors when verifying reset called on performTopologicalSort').toBe(0);
    expect(consoleErrors.length, 'No console error messages when verifying reset called on performTopologicalSort').toBe(0);
  });
});