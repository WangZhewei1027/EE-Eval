import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/121474d1-fa7a-11f0-acf9-69409043402d.html';

// Page object to encapsulate common interactions with the demo UI
class PrimDemoPage {
  constructor(page) {
    this.page = page;
    this.nodeCount = page.locator('#nodeCount');
    this.generateEmptyMatrixBtn = page.locator('#generateEmptyMatrix');
    this.autoGenerateGraphBtn = page.locator('#autoGenerateGraph');
    this.graphText = page.locator('#graphText');
    this.loadGraphBtn = page.locator('#loadGraph');
    this.clearGraphInputBtn = page.locator('#clearGraphInput');
    this.inputFeedback = page.locator('#inputFeedback');

    this.graphDisplaySection = page.locator('#graphDisplaySection');
    this.adjMatrix = page.locator('#adjMatrix');
    this.edgeList = page.locator('#edgeList');

    this.primControlSection = page.locator('#primControlSection');
    this.startNode = page.locator('#startNode');
    this.primInitBtn = page.locator('#primInit');
    this.primStepBtn = page.locator('#primStep');
    this.primRunBtn = page.locator('#primRun');
    this.primResetBtn = page.locator('#primReset');
    this.primClearAllBtn = page.locator('#primClearAll');
    this.status = page.locator('#status');
    this.showDetails = page.locator('#showDetails');

    this.explorationSection = page.locator('#explorationSection');
    this.addEdgeButton = page.locator('#addEdgeButton');
    this.removeEdgeButton = page.locator('#removeEdgeButton');
    this.edgeModifyControls = page.locator('#edgeModifyControls');
    this.edgeNodeA = page.locator('#edgeNodeA');
    this.edgeNodeB = page.locator('#edgeNodeB');
    this.edgeWeight = page.locator('#edgeWeight');
    this.applyEdgeChange = page.locator('#applyEdgeChange');
    this.cancelEdgeChange = page.locator('#cancelEdgeChange');
    this.edgeModifyFeedback = page.locator('#edgeModifyFeedback');

    this.mstEdges = page.locator('#mstEdges');
    this.mstWeight = page.locator('#mstWeight');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setNodeCount(n) {
    await this.nodeCount.fill(String(n));
    // some browsers may not update valueAsNumber until blur; blur to be safe
    await this.nodeCount.press('Tab');
  }

  async fillGraphText(text) {
    await this.graphText.fill(text);
  }

  async clickLoadGraph() {
    await this.loadGraphBtn.click();
  }

  async clickGenerateEmptyMatrix() {
    await this.generateEmptyMatrixBtn.click();
  }

  async clickAutoGenerateGraph() {
    await this.autoGenerateGraphBtn.click();
  }

  async clickPrimInit() {
    await this.primInitBtn.click();
  }

  async clickPrimStep() {
    await this.primStepBtn.click();
  }

  async clickPrimRun() {
    await this.primRunBtn.click();
  }

  async clickPrimReset() {
    await this.primResetBtn.click();
  }

  async clickClearAll() {
    await this.primClearAllBtn.click();
  }

  async clickAddEdge() {
    await this.addEdgeButton.click();
  }

  async clickRemoveEdge() {
    await this.removeEdgeButton.click();
  }

  async applyEdgeChangeValues(a, b, w) {
    // set selects and weight then click apply
    await this.edgeNodeA.selectOption(a);
    await this.edgeNodeB.selectOption(b);
    if (w !== null) {
      await this.edgeWeight.fill(String(w));
    }
    await this.applyEdgeChange.click();
  }

  async clickCancelEdgeChange() {
    await this.cancelEdgeChange.click();
  }
}

test.describe('Prim\'s Algorithm Interactive Demo - FSM states and transitions', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // reset collectors
    consoleMessages = [];
    pageErrors = [];

    // collect console messages and page errors
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Navigate to the app
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Sanity checks for console errors and uncaught page errors.
    // Tests below will assert more specific behaviors; here we ensure there are no fatal runtime errors.
    const errorConsoleCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(pageErrors.length).toBe(0);
    expect(errorConsoleCount).toBe(0);
  });

  test('Initial Idle state S0_Idle - clearAll executed and UI is reset', async ({ page }) => {
    // This test validates the initial "Idle" state: clearAll() should be executed on load.
    // We assert that graph/prim sections are hidden and UI fields are cleared.
    const p = new PrimDemoPage(page);
    // Wait for main heading to ensure page loaded
    await page.waitForSelector('h1:has-text("Prim\'s Algorithm Interactive Demo")');

    // Graph display and prim control sections must be hidden at start
    await expect(p.graphDisplaySection).toHaveCSS('display', 'none');
    await expect(p.primControlSection).toHaveCSS('display', 'none');
    await expect(p.explorationSection).toHaveCSS('display', 'none');

    // MST weight should be '0' as clearAll resets it
    await expect(p.mstWeight).toHaveText('0');

    // Textareas and feedback should be empty
    await expect(p.graphText).toHaveValue('');
    await expect(p.inputFeedback).toHaveText('');

    // The startNode select should be empty (populated when graph loaded)
    const options = await p.startNode.locator('option').count();
    expect(options).toBe(0);
  });

  test('LOAD_GRAPH transition S0 -> S1: load adjacency matrix and display graph', async ({ page }) => {
    // This test validates loading a correctly formatted adjacency matrix transitions to "Graph Defined".
    const p = new PrimDemoPage(page);
    // Set node count to 3 and input a symmetric adjacency matrix with zeros on diagonal
    await p.setNodeCount(3);
    const matrix = [
      '0 1 2',
      '1 0 3',
      '2 3 0'
    ].join('\n');
    await p.fillGraphText(matrix);

    // Click load graph
    await p.clickLoadGraph();

    // After loading, graph display and other sections should be visible
    await expect(p.graphDisplaySection).toBeVisible();
    await expect(p.primControlSection).toBeVisible();
    await expect(p.explorationSection).toBeVisible();

    // Input feedback should indicate successful load
    await expect(p.inputFeedback).toHaveText('Graph loaded successfully.');

    // Adj matrix and edge list should contain expected labels/numbers
    const adjText = await p.adjMatrix.textContent();
    expect(adjText).toContain('A');
    expect(adjText).toContain('B');
    expect(adjText).toContain('C');
    expect(adjText).toContain('1');
    expect(adjText).toContain('2');
    expect(adjText).toContain('3');

    const edgeText = await p.edgeList.textContent();
    // Edge list should include at least one edge line like "A-B : 1"
    expect(edgeText).toMatch(/A-B\s*:\s*1|A-C\s*:\s*2|B-C\s*:\s*3/);

    // startNode options must be populated with 3 nodes
    const optionCount = await p.startNode.locator('option').count();
    expect(optionCount).toBe(3);
  });

  test('PRIM_INIT transition S1 -> S2: initialize Prim algorithm and enable controls', async ({ page }) => {
    // This test validates initialization of Prim's algorithm from a loaded graph.
    const p = new PrimDemoPage(page);
    // Prepare and load a small graph
    await p.setNodeCount(3);
    await p.fillGraphText(['0 1 2','1 0 3','2 3 0'].join('\n'));
    await p.clickLoadGraph();

    // Choose start node 'B' (index 1)
    await p.startNode.selectOption('B');
    // Click initialize
    await p.clickPrimInit();

    // Status should indicate initialization
    const statusText = await p.status.textContent();
    expect(statusText).toMatch(/initialized with start node B/i);

    // Prim step and run buttons should be enabled now
    await expect(p.primStepBtn).toBeEnabled();
    await expect(p.primRunBtn).toBeEnabled();

    // MST display should be empty and weight zero on init
    await expect(p.mstEdges).toHaveText('');
    await expect(p.mstWeight).toHaveText('0');
  });

  test('PRIM_STEP transition S2 -> S3: run a single Prim step and display details', async ({ page }) => {
    // This test validates running a single step of Prim's algorithm updates the UI status and internal progression.
    const p = new PrimDemoPage(page);
    await p.setNodeCount(3);
    await p.fillGraphText(['0 1 2','1 0 3','2 3 0'].join('\n'));
    await p.clickLoadGraph();

    // Ensure showDetails is checked so details appear
    await p.showDetails.check();
    await p.startNode.selectOption('A');
    await p.clickPrimInit();

    // Click step once
    await p.clickPrimStep();

    // Status should now include "Selected node for MST" describing chosen node
    const statusText = await p.status.textContent();
    expect(statusText).toMatch(/Selected node for MST:/i);

    // After a step, primReset should be enabled (depends on implementation), primStep may still be enabled
    // We at least check primStep btn exists and is a button
    await expect(p.primStepBtn).toBeVisible();
  });

  test('PRIM_RUN transition S3 -> S4: run to completion constructs MST and updates display', async ({ page }) => {
    // This test verifies run-to-completion yields a completed MST and updates MST display and weight.
    const p = new PrimDemoPage(page);
    await p.setNodeCount(4);
    // Create small connected graph for 4 nodes
    const matrix = [
      '0 1 0 4',
      '1 0 2 0',
      '0 2 0 3',
      '4 0 3 0'
    ].join('\n');
    await p.fillGraphText(matrix);
    await p.clickLoadGraph();

    // Initialize and run to completion
    await p.startNode.selectOption('A');
    await p.clickPrimInit();
    await p.clickPrimRun();

    // Status should indicate completion
    const statusText = await p.status.textContent();
    expect(statusText).toMatch(/Prim's algorithm completed/i);

    // MST edges area should show edges (non-empty)
    const mstText = await p.mstEdges.textContent();
    expect(mstText.trim().length).toBeGreaterThan(0);

    // MST weight should be > 0
    const weightText = await p.mstWeight.textContent();
    const weightNum = Number(weightText.trim());
    expect(Number.isFinite(weightNum)).toBeTruthy();
    expect(weightNum).toBeGreaterThan(0);

    // After completion, Step and Run should be disabled while Reset is enabled
    await expect(p.primStepBtn).toBeDisabled();
    await expect(p.primRunBtn).toBeDisabled();
    await expect(p.primResetBtn).toBeEnabled();
  });

  test('PRIM_RESET and CLEAR_ALL transitions: reset and clear everything', async ({ page }) => {
    // Validate resetting Prim and clearing all graph data
    const p = new PrimDemoPage(page);
    await p.setNodeCount(3);
    await p.fillGraphText(['0 1 2','1 0 3','2 3 0'].join('\n'));
    await p.clickLoadGraph();

    // Init and run one step then reset
    await p.startNode.selectOption('A');
    await p.clickPrimInit();
    await p.clickPrimStep();

    // Reset prim algorithm
    await p.clickPrimReset();
    const resetStatus = await p.status.textContent();
    expect(resetStatus).toMatch(/reset/i);

    // Buttons should be disabled after reset
    await expect(p.primStepBtn).toBeDisabled();
    await expect(p.primRunBtn).toBeDisabled();
    await expect(p.primResetBtn).toBeDisabled();

    // Now clear all
    await p.clickClearAll();
    // Sections hidden and MST weight reset
    await expect(p.graphDisplaySection).toHaveCSS('display', 'none');
    await expect(p.primControlSection).toHaveCSS('display', 'none');
    await expect(p.mstWeight).toHaveText('0');
  });

  test('Edge modification transitions S1 <-> S5: add and remove edges via UI and cancel', async ({ page }) => {
    // This test covers adding an edge, verifying graph updates, and canceling an in-progress modification.
    const p = new PrimDemoPage(page);
    await p.setNodeCount(4);
    // Start with a sparse graph containing only a chain A-B, B-C
    const matrix = [
      '0 1 0 0',
      '1 0 2 0',
      '0 2 0 0',
      '0 0 0 0'
    ].join('\n');
    await p.fillGraphText(matrix);
    await p.clickLoadGraph();

    // Click Add Edge to open controls
    await p.clickAddEdge();
    await expect(p.edgeModifyControls).toBeVisible();

    // Add edge between C and D (nodes 'C' and 'D') with weight 5
    await p.applyEdgeChangeValues('C', 'D', 5);

    // Feedback should indicate edge added
    await expect(p.edgeModifyFeedback).toContainText('Edge added between C and D');

    // Adj matrix and edge list should now contain edge C-D
    const adjText = await p.adjMatrix.textContent();
    expect(adjText).toContain('C');
    expect(adjText).toContain('D');
    expect(adjText).toContain('5');

    // After modifying graph, prim should be reset/disabled
    await expect(p.primStepBtn).toBeDisabled();
    await expect(p.primRunBtn).toBeDisabled();

    // Now test remove edge flow: open remove controls then cancel
    await p.clickRemoveEdge();
    await expect(p.edgeModifyControls).toBeVisible();
    await p.clickCancelEdgeChange();
    // Controls hidden after cancel
    await expect(p.edgeModifyControls).toHaveCSS('display', 'none');

    // Remove an existing edge: open remove, pick C-D then apply
    await p.clickRemoveEdge();
    await expect(p.edgeModifyControls).toBeVisible();
    // choose C and D and apply remove (weight field is disabled in remove mode)
    await p.edgeNodeA.selectOption('C');
    await p.edgeNodeB.selectOption('D');
    await p.applyEdgeChange.click();

    // Feedback should indicate removal
    await expect(p.edgeModifyFeedback).toContainText('Edge removed between C and D');
    // adjacency no longer contains 5 for that edge (but other occurrences of 5 elsewhere unlikely)
    const adjAfterRemove = await p.adjMatrix.textContent();
    expect(adjAfterRemove).not.toContain('5');
  });

  test('Error scenarios and edge cases: invalid inputs, generate empty matrix and auto-generate', async ({ page }) => {
    // This test verifies error handling when invalid input is provided and also checks helper generators.
    const p = new PrimDemoPage(page);

    // 1) Invalid adjacency matrix (wrong number of rows)
    await p.setNodeCount(4);
    // Provide only 3 lines instead of 4
    const badMatrix = [
      '0 1 0 0',
      '1 0 2 0',
      '0 2 0 0'
    ].join('\n');
    await p.fillGraphText(badMatrix);
    await p.clickLoadGraph();
    // Expect an error message
    await expect(p.inputFeedback).toContainText('Error parsing adjacency matrix');

    // 2) Generate empty matrix for nodeCount
    await p.clickGenerateEmptyMatrix();
    await expect(p.inputFeedback).toHaveText('Empty adjacency matrix generated.');
    const generated = await p.graphText.inputValue();
    // Should have 4 lines each with 4 zeros
    const lines = generated.split('\n').map(l => l.trim());
    expect(lines.length).toBe(4);
    expect(lines[0].split(/\s+/).length).toBe(4);

    // 3) Auto-generate random graph (should produce content)
    await p.clickAutoGenerateGraph();
    await expect(p.inputFeedback).toHaveText('Random connected graph generated.');
    const autoText = await p.graphText.inputValue();
    expect(autoText.trim().length).toBeGreaterThan(0);
  });

  test('Observe console logs and page errors during interactions', async ({ page }) => {
    // This test explicitly exercises several interactions while recording console and page errors.
    // It then asserts that no unhandled errors appeared in the console or page error events.
    const p = new PrimDemoPage(page);

    // Perform a sequence of operations
    await p.setNodeCount(3);
    await p.fillGraphText(['0 1 2','1 0 3','2 3 0'].join('\n'));
    await p.clickLoadGraph();

    await p.startNode.selectOption('A');
    await p.clickPrimInit();
    await p.clickPrimStep();
    await p.clickPrimRun();
    await p.clickPrimReset();
    await p.clickClearAll();

    // After these interactions, ensure there were no page errors or console error messages collected.
    const errorConsoleCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(pageErrors.length).toBe(0);
    expect(errorConsoleCount).toBe(0);

    // Also assert that some informative console messages (if any) were produced, but don't rely on them.
    // For example, ensure we at least captured non-error console messages or none (just check array exists).
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });

});