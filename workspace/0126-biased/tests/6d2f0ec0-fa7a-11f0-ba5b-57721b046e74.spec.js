import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2f0ec0-fa7a-11f0-ba5b-57721b046e74.html';

// Page object for interacting with controls in the UI
class TopoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      graphInput: '#graphInput',
      parseGraph: '#parseGraph',
      newNode: '#newNode',
      addNode: '#addNode',
      edgeFrom: '#edgeFrom',
      edgeTo: '#edgeTo',
      addEdge: '#addEdge',
      removeSelected: '#removeSelected',
      startSort: '#startSort',
      nextStep: '#nextStep',
      autoStep: '#autoStep',
      reset: '#reset',
      speed: '#speed',
      presetDAG: '#presetDAG',
      presetCycle: '#presetCycle',
      presetLarge: '#presetLarge',
      nodesContainer: '#nodesContainer',
      sortedNodes: '#sortedNodes',
      algorithmSteps: '#algorithmSteps',
    };
  }

  async click(selector) {
    await this.page.click(selector);
  }

  async fill(selector, value) {
    await this.page.fill(selector, value);
  }

  async getInnerHTML(selector) {
    return this.page.$eval(selector, el => el.innerHTML);
  }

  async getValue(selector) {
    return this.page.$eval(selector, el => el.value);
  }

  async isDisabled(selector) {
    return this.page.$eval(selector, el => !!el.disabled);
  }

  async exists(selector) {
    return (await this.page.$(selector)) !== null;
  }

  async typeOfGlobal(name) {
    return this.page.evaluate((n) => typeof window[n], name);
  }
}

test.describe('Topological Sort Interactive Demo - FSM validation and error observation', () => {
  // We'll capture console errors and page errors emitted during page load and interactions.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture unhandled page errors (window.onerror / exceptions)
    page.on('pageerror', (err) => {
      // err is an Error instance serialized from the page
      pageErrors.push(err.message || String(err));
    });

    // Navigate to the app page. Syntax errors in the inline script may fire during this navigation.
    await page.goto(APP_URL);
  });

  test.describe('Initial Load / Idle State (S0_Idle)', () => {
    test('Page loads and essential controls are present (Idle state UI) and syntax/runtime errors are captured', async ({ page }) => {
      const topo = new TopoPage(page);

      // Verify that the basic controls exist in the DOM even if script failed.
      await expect(page.locator(topo.selectors.parseGraph)).toBeVisible();
      await expect(page.locator(topo.selectors.addNode)).toBeVisible();
      await expect(page.locator(topo.selectors.addEdge)).toBeVisible();
      await expect(page.locator(topo.selectors.removeSelected)).toBeVisible();
      await expect(page.locator(topo.selectors.startSort)).toBeVisible();
      await expect(page.locator(topo.selectors.nextStep)).toBeVisible();
      await expect(page.locator(topo.selectors.autoStep)).toBeVisible();
      await expect(page.locator(topo.selectors.reset)).toBeVisible();

      // Textarea should contain the initial sample graph text from HTML.
      const graphInputValue = await topo.getValue(topo.selectors.graphInput);
      expect(graphInputValue).toContain('A: b,c');
      expect(graphInputValue).toContain('E: d');

      // Because the implementation script in the page contains a syntax error, we expect errors to have been captured.
      // At least one console error or page error should mention either "SyntaxError" or the problematic identifier 'edges'.
      const combinedErrors = consoleErrors.concat(pageErrors).join('\n');
      const hasSyntaxOrEdges = /SyntaxError|Unexpected|edges|const edges/i.test(combinedErrors);
      expect(hasSyntaxOrEdges).toBeTruthy();

      // The inline script failed to execute fully, so global variables that would have been created by it should be undefined.
      const parseGraphType = await topo.typeOfGlobal('parseGraph');
      const algorithmStateType = await topo.typeOfGlobal('algorithmState');
      expect(parseGraphType).toBe('undefined');
      expect(algorithmStateType).toBe('undefined');

      // Nodes container should be empty because renderGraph() from the script was not executed successfully.
      const nodesHTML = await topo.getInnerHTML(topo.selectors.nodesContainer);
      expect(nodesHTML.trim()).toBe('');
    });
  });

  test.describe('Events / Transitions (attempts and expected failure behavior)', () => {
    test('Parsing Graph (S0 -> S1): clicking Parse Graph does not trigger parse handler and no new nodes rendered (script error prevents transition)', async ({ page }) => {
      const topo = new TopoPage(page);

      // Snapshot of nodesContainer before clicking
      const before = await topo.getInnerHTML(topo.selectors.nodesContainer);

      // Attempt to click Parse Graph; because event listeners were not attached (script failed), this should be a no-op.
      await topo.click(topo.selectors.parseGraph);

      // Allow a small delay for any unexpected side effects (there should be none)
      await page.waitForTimeout(100);

      const after = await topo.getInnerHTML(topo.selectors.nodesContainer);
      expect(after).toBe(before);

      // Confirm that parseGraph function is not available globally due to script parse error
      const parseGraphType = await topo.typeOfGlobal('parseGraph');
      expect(parseGraphType).toBe('undefined');

      // Ensure syntax/runtime error exists (from page load)
      const combined = consoleErrors.concat(pageErrors).join('\n');
      expect(/SyntaxError|Unexpected|edges/i.test(combined)).toBeTruthy();
    });

    test('Adding Node (S0 -> S2): attempting to add a node via UI input does nothing when script failed', async ({ page }) => {
      const topo = new TopoPage(page);

      // Fill the new node input and click Add Node
      await topo.fill(topo.selectors.newNode, 'Z');
      await topo.click(topo.selectors.addNode);

      // Wait briefly for any handlers (none should be attached)
      await page.waitForTimeout(100);

      // The nodes container should remain empty (no node elements created by renderGraph)
      const nodesHTML = await topo.getInnerHTML(topo.selectors.nodesContainer);
      expect(nodesHTML.trim()).toBe('');

      // The input should still contain the value (script didn't clear it)
      const newNodeValue = await topo.getValue(topo.selectors.newNode);
      expect(newNodeValue).toBe('Z');

      // The global function addNewNode should not be defined due to script failure
      const addNewNodeType = await topo.typeOfGlobal('addNewNode');
      expect(addNewNodeType).toBe('undefined');
    });

    test('Adding Edge (S0 -> S3): attempt to add an edge between nodes fails quietly when event handlers are missing', async ({ page }) => {
      const topo = new TopoPage(page);

      // set inputs for edge
      await topo.fill(topo.selectors.edgeFrom, 'A');
      await topo.fill(topo.selectors.edgeTo, 'B');

      // Click Add Edge
      await topo.click(topo.selectors.addEdge);
      await page.waitForTimeout(100);

      // Nothing should be rendered in nodes container
      const nodesHTML = await topo.getInnerHTML(topo.selectors.nodesContainer);
      expect(nodesHTML.trim()).toBe('');

      // No alert dialogs should have been shown (if the script had run, invalid edges might trigger alert).
      // We assert that the script-level addNewEdge handler is not present.
      const addNewEdgeType = await topo.typeOfGlobal('addNewEdge');
      expect(addNewEdgeType).toBe('undefined');
    });

    test('Remove Selected (S0 -> S4): clicking Remove Selected is a no-op when script has not attached handlers', async ({ page }) => {
      const topo = new TopoPage(page);

      // Click removeSelected and ensure no DOM changes
      const before = await topo.getInnerHTML(topo.selectors.nodesContainer);
      await topo.click(topo.selectors.removeSelected);
      await page.waitForTimeout(100);
      const after = await topo.getInnerHTML(topo.selectors.nodesContainer);
      expect(after).toBe(before);

      // removeSelected handler should not exist as a global function variable
      const removeSelectedType = await topo.typeOfGlobal('removeSelectedNodes');
      expect(removeSelectedType).toBe('undefined');
    });

    test('Start Sort (S0 -> S5): attempting to start algorithm does nothing; algorithmState missing due to script error', async ({ page }) => {
      const topo = new TopoPage(page);

      // Click start sort
      await topo.click(topo.selectors.startSort);
      await page.waitForTimeout(100);

      // Because script failed, algorithmState is not defined
      const algoType = await topo.typeOfGlobal('algorithmState');
      expect(algoType).toBe('undefined');

      // The "sortedNodes" panel should remain empty
      const sortedHTML = await topo.getInnerHTML(topo.selectors.sortedNodes);
      expect(sortedHTML.trim()).toBe('');

      // The startSort button should remain enabled (script didn't disable it)
      const startDisabled = await topo.isDisabled(topo.selectors.startSort);
      expect(startDisabled).toBe(false);
    });

    test('Next Step (S5 -> S6) and Auto Step (S5 -> S7): clicking should not progress algorithm when script did not initialize it', async ({ page }) => {
      const topo = new TopoPage(page);

      // Ensure algorithmState is undefined
      const beforeAlgo = await topo.typeOfGlobal('algorithmState');
      expect(beforeAlgo).toBe('undefined');

      // Click Next Step and Auto Step
      await topo.click(topo.selectors.nextStep);
      await topo.click(topo.selectors.autoStep);

      // Nothing should be added to algorithmSteps
      const stepsHTML = await topo.getInnerHTML(topo.selectors.algorithmSteps);
      expect(stepsHTML.trim()).toBe('');

      // autoStep handler should not exist as a global function
      const toggleAutoStepType = await topo.typeOfGlobal('toggleAutoStep');
      expect(toggleAutoStepType).toBe('undefined');
    });

    test('Reset (S5 -> S8): clicking Reset clears nothing (script not executed) but does not crash page', async ({ page }) => {
      const topo = new TopoPage(page);

      // Precondition: algorithmSteps empty
      const before = await topo.getInnerHTML(topo.selectors.algorithmSteps);
      await topo.click(topo.selectors.reset);
      await page.waitForTimeout(100);
      const after = await topo.getInnerHTML(topo.selectors.algorithmSteps);
      expect(after).toBe(before);

      // resetAlgorithm should not be defined globally
      const resetType = await topo.typeOfGlobal('resetAlgorithm');
      expect(resetType).toBe('undefined');
    });

    test('Load Preset Graphs (S0 -> S9): clicking preset buttons does not update textarea when handlers are missing', async ({ page }) => {
      const topo = new TopoPage(page);

      const before = await topo.getValue(topo.selectors.graphInput);

      await topo.click(topo.selectors.presetDAG);
      await topo.click(topo.selectors.presetCycle);
      await topo.click(topo.selectors.presetLarge);

      // Give a brief moment for any handlers (none expected)
      await page.waitForTimeout(100);

      const after = await topo.getValue(topo.selectors.graphInput);
      // Since script failed, the preset loading functions did not run and the textarea should remain as initially declared.
      expect(after).toBe(before);

      // loadPreset function should not be present on the window
      const loadPresetType = await topo.typeOfGlobal('loadPreset');
      expect(loadPresetType).toBe('undefined');
    });
  });

  test.describe('Error analysis and edge-case assertions', () => {
    test('Confirm that the page-level syntax error mentions the problematic declaration (edges) and prevents script execution', async ({ page }) => {
      const topo = new TopoPage(page);

      // Combine captured errors and assert informative content expected from the provided HTML bug.
      const combined = consoleErrors.concat(pageErrors).join('\n');

      // We expect the error message to reference either 'edges' or a SyntaxError/Unexpected token/identifier
      const matches = /edges|SyntaxError|Unexpected/.test(combined);
      expect(matches).toBeTruthy();

      // Because of the syntax error the renderGraph function and other functions are not available
      const renderGraphType = await topo.typeOfGlobal('renderGraph');
      const visitType = await topo.typeOfGlobal('visit');
      expect(renderGraphType).toBe('undefined');
      expect(visitType).toBe('undefined');
    });

    test('Edge case: interacting with controls should not create unexpected global exceptions beyond the initial syntax error', async ({ page }) => {
      const topo = new TopoPage(page);

      // Clear collected errors snapshot
      const initialErrorSnapshot = consoleErrors.concat(pageErrors).join('\n');

      // Interact with several controls to ensure no additional uncaught exceptions are produced by user interactions
      await topo.click(topo.selectors.parseGraph);
      await topo.click(topo.selectors.addNode);
      await topo.fill(topo.selectors.newNode, 'ShouldNotExist');
      await topo.click(topo.selectors.addEdge);
      await topo.click(topo.selectors.startSort);
      await topo.click(topo.selectors.autoStep);
      await topo.click(topo.selectors.reset);
      await page.waitForTimeout(200);

      const postErrors = consoleErrors.concat(pageErrors).join('\n');

      // The postErrors should include the initial error, but should not show a large number of new distinct errors.
      // We assert that the main issue remains the syntax error by checking it is present and that no new 'TypeError' spikes occurred.
      expect(/SyntaxError|edges|Unexpected/.test(postErrors)).toBeTruthy();

      // Assert there are not many different new error lines (lenient check: fewer than 10 error occurrences total).
      const errorLines = postErrors.split('\n').filter(Boolean);
      expect(errorLines.length).toBeLessThan(10);
    });
  });
});