import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12175b00-fa7a-11f0-acf9-69409043402d.html';

// Page Object Model for the Decision Tree page
class DecisionTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // node UI
    this.inputNewNodeLabel = page.locator('#new-node-label');
    this.btnAddNode = page.locator('#btn-add-node');
    this.btnClearAll = page.locator('#btn-clear-all');
    this.nodeListDiv = page.locator('#node-list');
    this.messageDiv = page.locator('#message');

    // branch UI
    this.branchForm = page.locator('#branch-form');
    this.branchFromSelect = page.locator('#branch-from');
    this.branchToSelect = page.locator('#branch-to');
    this.branchConditionInput = page.locator('#branch-condition');
    this.branchesListDiv = page.locator('#branches-list');
    this.btnClearBranches = page.locator('#btn-clear-branches');

    // simulation UI
    this.simStartNodeSelect = page.locator('#sim-start-node');
    this.btnStartSim = page.locator('#btn-start-sim');
    this.simContainerDiv = page.locator('#sim-container');
    this.btnEndSim = page.locator('#btn-end-sim');
    this.pathTraceDiv = page.locator('#path-trace');

    // json import/export
    this.jsonTextarea = page.locator('#json-textarea');
    this.btnImportJson = page.locator('#btn-import-json');
    this.btnExportJson = page.locator('#btn-export-json');
    this.jsonMessageDiv = page.locator('#json-message');

    // analysis
    this.btnValidateTree = page.locator('#btn-validate-tree');
    this.btnShowDepth = page.locator('#btn-show-depth');
    this.btnShowLeaves = page.locator('#btn-show-leaves');
    this.analysisOutputDiv = page.locator('#analysis-output');
  }

  // Navigation
  async goto() {
    await this.page.goto(BASE_URL, { waitUntil: 'load' });
  }

  // Node helpers
  async addNode(label) {
    await this.inputNewNodeLabel.fill(label);
    await this.btnAddNode.click();
  }

  async clearAllNodesAcceptConfirm() {
    // Clicking triggers confirm; tests attach a dialog handler to accept
    await this.btnClearAll.click();
  }

  async getMessageText() {
    return (await this.messageDiv.textContent())?.trim() ?? '';
  }

  async getNodeListText() {
    return (await this.nodeListDiv.textContent())?.trim() ?? '';
  }

  // Branch helpers
  async addBranch(fromValue, condition, toValue) {
    await this.branchFromSelect.selectOption(fromValue);
    await this.branchToSelect.selectOption(toValue);
    await this.branchConditionInput.fill(condition);
    await this.branchForm.evaluate(form => form.requestSubmit ? form.requestSubmit() : form.submit());
  }

  async clearAllBranchesAcceptConfirm() {
    await this.btnClearBranches.click();
  }

  async getBranchesListText() {
    return (await this.branchesListDiv.textContent())?.trim() ?? '';
  }

  // Simulation helpers
  async startSimulation(selectValue) {
    await this.simStartNodeSelect.selectOption(selectValue);
    await this.btnStartSim.click();
  }

  async endSimulation() {
    await this.btnEndSim.click();
  }

  async isEndSimVisible() {
    return await this.btnEndSim.evaluate(el => window.getComputedStyle(el).display !== 'none');
  }

  async isPathTraceVisible() {
    return await this.pathTraceDiv.evaluate(el => window.getComputedStyle(el).display !== 'none');
  }

  // JSON helpers
  async importJson(text) {
    await this.jsonTextarea.fill(text);
    await this.btnImportJson.click();
  }

  async exportJson() {
    await this.btnExportJson.click();
    return (await this.jsonTextarea.inputValue());
  }

  async getJsonMessageText() {
    return (await this.jsonMessageDiv.textContent())?.trim() ?? '';
  }

  // Analysis helpers
  async clickValidate() {
    await this.btnValidateTree.click();
  }

  async clickShowDepth() {
    await this.btnShowDepth.click();
  }

  async clickShowLeaves() {
    await this.btnShowLeaves.click();
  }

  async getAnalysisOutput() {
    return (await this.analysisOutputDiv.textContent())?.trim() ?? '';
  }

  // Utilities
  async findDeleteNodeButtons() {
    return this.nodeListDiv.locator('button', { hasText: 'Delete Node' });
  }

  async findDeleteBranchButtons() {
    return this.branchesListDiv.locator('button', { hasText: 'Delete Branch' });
  }
}

// Global test suite
test.describe('Decision Tree Explorer - FSM behavior and UI interactions', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console logs and errors
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Accept all dialogs by default (confirm/alert) to let flows continue.
    page.on('dialog', async dialog => {
      // Auto-accept confirmations and alerts to allow the flow to proceed.
      try {
        await dialog.accept();
      } catch (e) {
        // ignore
      }
    });

    const dt = new DecisionTreePage(page);
    await dt.goto();
  });

  test.afterEach(async ({ page }) => {
    // At the end of each test ensure there are no uncaught page errors
    // Collect readable descriptions for debugging if any
    if (pageErrors.length > 0) {
      // Attach console messages to the error for diagnosis
      const cms = consoleMessages.map(c => `${c.type}: ${c.text}`).join('\n');
      throw new Error(`Page errors occurred:\n${pageErrors.map(e => e.toString()).join('\n')}\nConsole:\n${cms}`);
    }
  });

  test('Initial Idle state: UI elements reflect idle S0_Idle', async ({ page }) => {
    // Validate initial state (S0_Idle): refreshAll and resetSimulation expected to run
    const dt = new DecisionTreePage(page);

    // message should be empty
    await expect(dt.messageDiv).toHaveText('', { timeout: 2000 });

    // node list shows no nodes created
    await expect(dt.nodeListDiv).toHaveText('(No nodes created yet)');

    // sim controls: end sim hidden, path trace hidden, start sim enabled
    expect(await dt.isEndSimVisible()).toBe(false);
    expect(await dt.isPathTraceVisible()).toBe(false);
    await expect(dt.btnStartSim).toBeEnabled();

    // sim-start select shows '(no nodes)' because no nodes exist
    await expect(dt.simStartNodeSelect.locator('option')).toHaveCount(1);
    await expect(dt.simStartNodeSelect.locator('option')).toHaveText(['(no nodes)']);
  });

  test('Add Node transition (S0 -> S1): add nodes updates DOM and selects', async ({ page }) => {
    const dt = new DecisionTreePage(page);

    // Add first node
    await dt.addNode('Is it raining?');

    // After adding node, message should be displayed per S1_NodeAdded evidence
    await expect(dt.messageDiv).toHaveText('Node added: "Is it raining?"');

    // Node list contains entry with ID:1
    await expect(dt.nodeListDiv).toContainText('ID:1 - Is it raining?');

    // branch selects should include ID:1 option
    await expect(dt.branchFromSelect.locator('option')).toContainText('ID:1 - Is it raining?');
    await expect(dt.branchToSelect.locator('option')).toContainText('ID:1 - Is it raining?');

    // sim-start select should include ID:1
    await expect(dt.simStartNodeSelect.locator('option')).toContainText('ID:1 - Is it raining?');

    // Add second node
    await dt.addNode('Have umbrella?');
    await expect(dt.messageDiv).toHaveText('Node added: "Have umbrella?"');

    // Node list should show both nodes (IDs 1 and 2)
    const nodeListText = await dt.getNodeListText();
    expect(nodeListText).toMatch(/ID:1/);
    expect(nodeListText).toMatch(/ID:2/);
  });

  test('Add Branch transition (S0 -> S2) and duplicate condition prevention', async ({ page }) => {
    const dt = new DecisionTreePage(page);

    // Create two nodes
    await dt.addNode('Start');
    await dt.addNode('Go Outside');

    // Add branch from 1 to 2 with condition Yes
    // The selects will have values '1' and '2'
    await dt.addBranch('1', 'Yes', '2');

    // Expect branch added message
    await expect(dt.messageDiv).toHaveText('Branch added: From ID:1 [Yes] to ID:2');

    // Branches list should contain the branch info
    await expect(dt.branchesListDiv).toContainText('From ID:1 (Start) [Yes] → ID:2 (Go Outside)');

    // Node listing should include branch summary
    await expect(dt.nodeListDiv).toContainText('[Yes]→Go Outside');

    // Try to add the same condition again on same node - should fail and display message
    await dt.branchFromSelect.selectOption('1');
    await dt.branchToSelect.selectOption('2');
    await dt.branchConditionInput.fill('Yes');
    await dt.branchForm.evaluate(form => form.requestSubmit ? form.requestSubmit() : form.submit());

    // The code will display an error message for duplicate condition
    await expect(dt.messageDiv).toHaveText('Failed to add branch. Condition labels must be unique for the same node.');
  });

  test('Clear Branches transition (S2 -> S0): clear branches updates UI', async ({ page }) => {
    const dt = new DecisionTreePage(page);

    // Setup: two nodes and a branch
    await dt.addNode('A');
    await dt.addNode('B');
    await dt.addBranch('1', 'go', '2');

    // Ensure branch exists
    await expect(dt.branchesListDiv).toContainText('From ID:1 (A) [go] → ID:2 (B)');

    // Clear branches (confirm accepted by dialog handler)
    await dt.clearAllBranchesAcceptConfirm();

    // Expect message about clearing branches
    await expect(dt.messageDiv).toHaveText('All branches cleared.');

    // Branches list should show '(No branches defined)'
    await expect(dt.branchesListDiv).toHaveText('(No branches defined)');
  });

  test('Clear All Nodes transition (S1 -> S0): clears nodes, resets IDs and UI', async ({ page }) => {
    const dt = new DecisionTreePage(page);

    // Add nodes
    await dt.addNode('Node X');
    await dt.addNode('Node Y');

    // Clear all (confirm accepted)
    await dt.clearAllNodesAcceptConfirm();

    // Expect message
    await expect(dt.messageDiv).toHaveText('All nodes and branches cleared.');

    // Node list shows no nodes
    await expect(dt.nodeListDiv).toHaveText('(No nodes created yet)');

    // After clearing, sim-start select should be reset to '(no nodes)'
    await expect(dt.simStartNodeSelect.locator('option')).toHaveText(['(no nodes)']);
  });

  test('Simulation start (S0 -> S3) and end (S3 -> S4): UI updates and path trace', async ({ page }) => {
    const dt = new DecisionTreePage(page);

    // Create nodes and branches for simulation: 1 -> 2
    await dt.addNode('Q1');
    await dt.addNode('Q2');
    await dt.addBranch('1', 'Yes', '2');

    // Start simulation from node 1
    await dt.startSimulation('1');

    // After starting, message should indicate start
    await expect(dt.messageDiv).toHaveText('Simulation started at node ID:1');

    // btnStartSim disabled, btnEndSim visible, pathTrace visible
    await expect(dt.btnStartSim).toBeDisabled();
    expect(await dt.isEndSimVisible()).toBe(true);
    expect(await dt.isPathTraceVisible()).toBe(true);

    // sim container should show current node label and a choice button
    await expect(dt.simContainerDiv).toContainText('Current Node [ID:1]: Q1');
    await expect(dt.simContainerDiv.locator('button')).toContainText('[Yes] → Q2');

    // Choose the branch by clicking the choice button
    await dt.simContainerDiv.locator('button', { hasText: '[Yes] → Q2' }).click();

    // Path trace should now contain two steps
    await expect(dt.pathTraceDiv).toContainText('1. Node [ID:1]');
    await expect(dt.pathTraceDiv).toContainText('2. Node [ID:2]');

    // End simulation
    await dt.endSimulation();

    // After ending, message should display 'Simulation ended.'
    await expect(dt.messageDiv).toHaveText('Simulation ended.');

    // btnEndSim hidden, btnStartSim enabled, path trace hidden
    expect(await dt.isEndSimVisible()).toBe(false);
    expect(await dt.isPathTraceVisible()).toBe(false);
    await expect(dt.btnStartSim).toBeEnabled();
  });

  test('Import JSON (S0 -> S5) success and failure cases for importFromJson', async ({ page }) => {
    const dt = new DecisionTreePage(page);

    // Valid JSON with two nodes and a branch
    const validJson = JSON.stringify([
      { id: "10", label: "Root", branches: [{ condition: "Yes", toNodeId: "11" }] },
      { id: "11", label: "Leaf", branches: [] }
    ], null, 2);

    await dt.importJson(validJson);

    // Import successful message expected
    await expect(dt.jsonMessageDiv).toHaveText('Import successful.');

    // Node list should show the imported IDs and labels
    await expect(dt.nodeListDiv).toContainText('ID:10 - Root');
    await expect(dt.nodeListDiv).toContainText('ID:11 - Leaf');

    // Export should produce a JSON containing the nodes
    const exported = await dt.exportJson();
    expect(exported).toContain('"id": "10"');
    expect(exported).toContain('"Label"'.toLowerCase(), { timeout: 0 }); // intentionally tolerant

    // Invalid JSON case
    await dt.importJson('not a json');

    // json message should indicate import error
    await expect(dt.jsonMessageDiv).toContainText('Import error:');
  });

  test('Export JSON updates textarea and shows status message', async ({ page }) => {
    const dt = new DecisionTreePage(page);

    // Ensure at least one node exists
    await dt.addNode('ExportNode');

    // Click export
    const json = await dt.exportJson();

    // JSON textarea should now contain JSON text and a status message displayed
    const jsonMsg = await dt.getJsonMessageText();
    expect(jsonMsg).toBe('Export completed. JSON updated in textarea.');
    expect(json).toContain('"label": "ExportNode"');
  });

  test('Validation (S0 -> S6): detect cycles and unconnected nodes', async ({ page }) => {
    const dt = new DecisionTreePage(page);

    // Build nodes: 1 <-> 2 cycle, and 3 unconnected
    await dt.addNode('N1'); // id=1
    await dt.addNode('N2'); // id=2
    await dt.addNode('N3'); // id=3

    // Add branches to create cycle 1->2 and 2->1
    await dt.addBranch('1', 'to2', '2');
    await dt.addBranch('2', 'to1', '1');

    // Node 3 stays unconnected (no inbound from roots)
    await dt.clickValidate();

    // analysis output must mention cycles and unconnected nodes
    const analysis = await dt.getAnalysisOutput();
    expect(analysis).toMatch(/Cycles found/);
    expect(analysis).toMatch(/Unconnected nodes/);
    expect(analysis).toMatch(/ID:3/);
  });

  test('Show Depth and Show Leaves exploration tools', async ({ page }) => {
    const dt = new DecisionTreePage(page);

    // Build a chain 1->2->3 to have depth 3
    await dt.addNode('RootD'); // 1
    await dt.addNode('MidD'); // 2
    await dt.addNode('LeafD'); // 3

    await dt.addBranch('1', 'a', '2');
    await dt.addBranch('2', 'b', '3');

    // Show depth should report 3
    await dt.clickShowDepth();
    await expect(dt.analysisOutputDiv).toHaveText('Maximum decision tree depth: 3');

    // Show leaves should report node 3
    await dt.clickShowLeaves();
    await expect(dt.analysisOutputDiv).toContainText('Leaf nodes (no outgoing branches):');
    await expect(dt.analysisOutputDiv).toContainText('ID:3 (LeafD)');
  });

  test('Edge cases: adding empty node label, self-branch with confirmation and deleting node/branch', async ({ page }) => {
    const dt = new DecisionTreePage(page);

    // Attempt to add a node with empty label -> should display validation error
    await dt.inputNewNodeLabel.fill('   ');
    await dt.btnAddNode.click();
    await expect(dt.messageDiv).toHaveText('Please enter a valid node label.');

    // Create a node and attempt to add a self-branch (should prompt confirm and be accepted)
    await dt.addNode('SelfNode'); // id=1
    await dt.addBranch('1', 'loop', '1'); // self-branch; branchForm code calls confirm which is accepted

    // After adding, branch should exist
    await expect(dt.branchesListDiv).toContainText('From ID:1 (SelfNode) [loop] → ID:1 (SelfNode)');

    // Delete the branch via Delete Branch button (confirm accepted)
    const delBranchBtns = await dt.findDeleteBranchButtons();
    await expect(delBranchBtns).toHaveCount(1);
    await delBranchBtns.nth(0).click();

    // Message should indicate branch deleted
    await expect(dt.messageDiv).toHaveText('Branch deleted.');

    // Now delete the node using the Delete Node button (confirm accepted)
    const delNodeBtns = await dt.findDeleteNodeButtons();
    // There may be one Delete Node button for the created node
    await expect(delNodeBtns).toHaveCount(1);
    await delNodeBtns.nth(0).click();

    // After deletion, message should indicate node deleted
    await expect(dt.messageDiv).toContainText('Deleted node ID:1');
  });

  // Final check to ensure no page errors or exceptions leaked into console.error
  test('Console and pageerror observation - no runtime errors should be present', async ({ page }) => {
    // This test just re-loads the page and then inspects collected console messages to ensure no error-level console entries.
    const dt = new DecisionTreePage(page);

    // Add a node then clear to execute code paths
    await dt.addNode('ProbeNode');
    await dt.clearAllNodesAcceptConfirm();

    // Inspect console messages captured during this test
    // Any console message of type 'error' is considered a sign of runtime issues (TypeError/ReferenceError etc.)
    const entries = [];
    for (const msg of (await page.context().pages())[0] ? [] : []) { /*noop*/ }

    // We captured console messages in beforeEach; use page.on listener's storage above: consoleMessages
    // Because we cannot access that variable here directly (scoped in outer closure),
    // instead, re-add a fresh listener and collect new messages for this specific run.

    const captured = [];
    page.on('console', c => captured.push({ type: c.type(), text: c.text() }));

    // Trigger some UI to generate logs if any
    await dt.addNode('AnotherProbe');
    await dt.clearAllNodesAcceptConfirm();

    // Wait a small amount to allow any console logs to be emitted
    await page.waitForTimeout(200);

    // Assert no console error messages were emitted during these interactions
    const errors = captured.filter(c => c.type === 'error');
    expect(errors.length).toBe(0);
  });

});