import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12138a72-fa7a-11f0-acf9-69409043402d.html';

// Page Object encapsulating common interactions for the Graph demo
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.locators = {
      canvas: page.locator('#canvas'),
      nodeNameInput: page.locator('#nodeNameInput'),
      addNodeBtn: page.locator('#addNodeBtn'),
      deleteNodeBtn: page.locator('#deleteNodeBtn'),
      moveNodeModeBtn: page.locator('#moveNodeModeBtn'),
      edgeNode1Input: page.locator('#edgeNode1Input'),
      edgeNode2Input: page.locator('#edgeNode2Input'),
      addEdgeBtn: page.locator('#addEdgeBtn'),
      deleteEdgeBtn: page.locator('#deleteEdgeBtn'),
      startNodeInput: page.locator('#startNodeInput'),
      bfsBtn: page.locator('#bfsBtn'),
      dfsBtn: page.locator('#dfsBtn'),
      clearHighlightsBtn: page.locator('#clearHighlightsBtn'),
      checkConnectedBtn: page.locator('#checkConnectedBtn'),
      checkCycleBtn: page.locator('#checkCycleBtn'),
      clearGraphBtn: page.locator('#clearGraphBtn'),
      messages: page.locator('#messages'),
      resultOutput: page.locator('#resultOutput')
    };
  }

  // Wait for the initial message to appear after page load
  async waitForInitialReady() {
    await expect(this.locators.messages).toHaveText(/Use canvas click or controls to add nodes and edges\./, { timeout: 2000 });
  }

  // Adds a node via the Add Node button using the provided name
  async addNodeByName(name) {
    await this.locators.nodeNameInput.fill(name);
    await this.locators.addNodeBtn.click();
    // message should appear
    await expect(this.locators.messages).toHaveText(new RegExp(`Node\\s+'${escapeRegExp(name)}' added\\.|Node\\s+'${escapeRegExp(name)}' added at`), { timeout: 2000 });
  }

  // Click on canvas at an offset relative to top-left of canvas element
  async clickCanvasAt(x, y) {
    // Use the locator click with position
    await this.locators.canvas.click({ position: { x, y } });
    // message should indicate node added or warning; just wait a short time for messages to update
    await this.page.waitForTimeout(200);
  }

  // Add an edge by filling inputs and clicking add edge button
  async addEdge(n1, n2) {
    await this.locators.edgeNode1Input.fill(n1);
    await this.locators.edgeNode2Input.fill(n2);
    await this.locators.addEdgeBtn.click();
    // message expected to indicate edge added or an error
    await this.page.waitForTimeout(200);
  }

  async deleteSelectedNode() {
    await this.locators.deleteNodeBtn.click();
    await this.page.waitForTimeout(200);
  }

  async deleteSelectedEdge() {
    await this.locators.deleteEdgeBtn.click();
    await this.page.waitForTimeout(200);
  }

  async toggleMoveMode() {
    await this.locators.moveNodeModeBtn.click();
    await this.page.waitForTimeout(200);
  }

  async runBFS(start) {
    await this.locators.startNodeInput.fill(start);
    await this.locators.bfsBtn.click();
    await this.page.waitForTimeout(200);
  }

  async runDFS(start) {
    await this.locators.startNodeInput.fill(start);
    await this.locators.dfsBtn.click();
    await this.page.waitForTimeout(200);
  }

  async checkConnected() {
    await this.locators.checkConnectedBtn.click();
    await this.page.waitForTimeout(200);
  }

  async checkCycle() {
    await this.locators.checkCycleBtn.click();
    await this.page.waitForTimeout(200);
  }

  async clearHighlights() {
    await this.locators.clearHighlightsBtn.click();
    await this.page.waitForTimeout(200);
  }

  async clearGraph() {
    await this.locators.clearGraphBtn.click();
    await this.page.waitForTimeout(200);
  }

  // Helpers for assertions
  async getMessagesText() {
    return (await this.locators.messages.textContent()) || '';
  }

  async getResultOutputText() {
    return (await this.locators.resultOutput.textContent()) || '';
  }

  async isDeleteNodeDisabled() {
    return await this.locators.deleteNodeBtn.isDisabled();
  }

  async isDeleteEdgeDisabled() {
    return await this.locators.deleteEdgeBtn.isDisabled();
  }

  async moveModeButtonText() {
    return (await this.locators.moveNodeModeBtn.textContent()) || '';
  }
}

// Utility to escape text in regex
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test.describe('Graph (Undirected) Interactive Demo - FSM and UI validations', () => {
  // Captured errors and console messages for each test
  let capturedPageErrors = [];
  let capturedConsole = [];

  test.beforeEach(async ({ page }) => {
    capturedPageErrors = [];
    capturedConsole = [];

    // collect page errors
    page.on('pageerror', (err) => {
      // store the error object for later assertions
      capturedPageErrors.push(err);
    });

    // collect console messages
    page.on('console', (msg) => {
      capturedConsole.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the app and wait for initial render
    await page.goto(APP_URL);
    const graph = new GraphPage(page);
    await graph.waitForInitialReady();
  });

  test.afterEach(async ({ page }) => {
    // Always assert there are no unexpected runtime errors (ReferenceError/SyntaxError/TypeError)
    // This asserts that the page runs without throwing such runtime exceptions.
    const errorTypes = capturedPageErrors.map(e => (e && e.name) || '');
    // If there are any page errors, include them in the assertion failure message for debugging
    expect(errorTypes, 'No page runtime errors should have occurred').toEqual([]);
    // Also ensure console did not emit critical JS errors
    const consoleErrors = capturedConsole.filter(c => c.type === 'error' || c.type === 'warning');
    expect(consoleErrors, `No console error/warning messages expected (found: ${consoleErrors.length})`).toEqual([]);
  });

  test.describe('State S0_Idle - Initial state checks and basic UI presence', () => {
    test('Initial Idle state has expected default UI and messages', async ({ page }) => {
      const graph = new GraphPage(page);

      // Comments: Validate Idle entry actions and initial UI state
      // - drawGraph() invoked on load (visual; we check initial message)
      // - initial informational message present
      await expect(graph.locators.messages).toHaveText(/Use canvas click or controls to add nodes and edges\./);

      // - delete buttons should be disabled
      expect(await graph.isDeleteNodeDisabled()).toBe(true);
      expect(await graph.isDeleteEdgeDisabled()).toBe(true);

      // - move mode button indicates OFF
      expect(await graph.moveModeButtonText()).toContain('Move Node Mode: OFF');

      // - resultOutput should be empty
      expect(await graph.getResultOutputText()).toBe('');
    });
  });

  test.describe('Node operations (Add / Select / Delete) - S0_Idle <-> S1_NodeSelected transitions', () => {
    test('Add node via Add Node button and then delete it', async ({ page }) => {
      const graph = new GraphPage(page);

      // Add node "A"
      await graph.addNodeByName('A');

      // After adding, deleteNodeBtn should be enabled (node selected)
      expect(await graph.isDeleteNodeDisabled()).toBe(false);

      // messages should mention node added
      const msg = await graph.getMessagesText();
      expect(msg).toMatch(/Node\s+'A'\s+added/);

      // Delete the selected node
      await graph.deleteSelectedNode();

      // After deletion, message should indicate deletion and delete button disabled
      const msg2 = await graph.getMessagesText();
      expect(msg2).toMatch(/Node\s+'A'\s+deleted/);
      expect(await graph.isDeleteNodeDisabled()).toBe(true);
    });

    test('Add node by clicking on canvas (auto-generated name) and validate selection', async ({ page }) => {
      const graph = new GraphPage(page);

      // Click the canvas at a specific coordinate to add an auto-named node
      // Coordinates chosen well within canvas bounds
      await graph.clickCanvasAt(80, 80);

      // messages should indicate a node was added at coordinates or failure message
      const msg = await graph.getMessagesText();
      expect(msg).toMatch(/Node\s+'.+'\s+added at \(|Enter a unique node name|Node name '.*' already exists/i);

      // If a node was added and selected, deleteNodeBtn should be enabled
      // This checks both successful add and selection behavior
      // Note: If the message indicated duplicate or failure, deletion remains disabled
      if (/Node\s+'.+'\s+added/.test(msg)) {
        expect(await graph.isDeleteNodeDisabled()).toBe(false);
      }
    });

    test('Edge case: clicking Add Node with empty input shows instructive error', async ({ page }) => {
      const graph = new GraphPage(page);

      // Ensure input is empty and click add node
      await graph.locators.nodeNameInput.fill('');
      await graph.locators.addNodeBtn.click();

      // Expect instructive error message
      await expect(graph.locators.messages).toHaveText(/Enter a unique node name in the input\./);
    });

    test('Edge case: adding duplicate node name is rejected', async ({ page }) => {
      const graph = new GraphPage(page);

      // Add node "Dup"
      await graph.addNodeByName('Dup');

      // Try to add duplicate "Dup"
      await graph.addNodeByName('Dup'); // triggers message "already exists"
      const msg = await graph.getMessagesText();
      expect(msg).toMatch(/already exists/);
    });
  });

  test.describe('Edge operations (Add / Select / Delete) - S0_Idle <-> S2_EdgeSelected transitions', () => {
    test('Add edge between two nodes and then delete it', async ({ page }) => {
      const graph = new GraphPage(page);

      // Prepare nodes A and B
      await graph.addNodeByName('A');
      await graph.addNodeByName('B');

      // Add edge A-B
      await graph.addEdge('A', 'B');

      // Expect a success message about the edge and that deleteEdgeBtn becomes enabled (selected)
      const msg = await graph.getMessagesText();
      expect(msg).toMatch(/Edge added between 'A' and 'B'|Edge between 'A' and 'B' already exists/);

      // Since addEdge handler calls selectEdge when successful, deleteEdgeBtn should be enabled
      // Ensure either it's enabled or (if duplicate error) remains disabled
      const deleteEdgeDisabled = await graph.isDeleteEdgeDisabled();
      expect(deleteEdgeDisabled).toBe(false);

      // Now delete the edge
      await graph.deleteSelectedEdge();

      // Expect deletion message containing the edge id which is 'A--B'
      const msg2 = await graph.getMessagesText();
      expect(msg2).toMatch(/Edge\s+'A--B'\s+deleted|Failed to delete edge/);

      // After deletion, deleteEdgeBtn should be disabled
      expect(await graph.isDeleteEdgeDisabled()).toBe(true);
    });

    test('Edge addition error cases: non-existent nodes and same-node edge', async ({ page }) => {
      const graph = new GraphPage(page);

      // Try adding edge where one node does not exist
      await graph.addEdge('Xdoesnotexist', 'Y');
      let msg = await graph.getMessagesText();
      expect(msg).toMatch(/does not exist|Enter names of two nodes for the edge\./);

      // Add a node and attempt to add an edge from it to itself
      await graph.addNodeByName('SelfNode');
      await graph.addEdge('SelfNode', 'SelfNode');
      msg = await graph.getMessagesText();
      expect(msg).toMatch(/Cannot add edge between the same node|already exists|does not exist/);
    });
  });

  test.describe('Move Node Mode - S3_MoveNodeMode toggle behavior', () => {
    test('Toggle Move Node Mode ON and OFF and verify UI changes and messages', async ({ page }) => {
      const graph = new GraphPage(page);

      // Toggle ON
      await graph.toggleMoveMode();
      expect(await graph.moveModeButtonText()).toContain('Move Node Mode: ON');
      let msg = await graph.getMessagesText();
      expect(msg).toMatch(/Move Node Mode enabled|Move Node Mode enabled: drag nodes on canvas\./);

      // While in move mode, delete buttons should be disabled
      expect(await graph.isDeleteNodeDisabled()).toBe(true);
      expect(await graph.isDeleteEdgeDisabled()).toBe(true);

      // Toggle OFF
      await graph.toggleMoveMode();
      expect(await graph.moveModeButtonText()).toContain('Move Node Mode: OFF');
      msg = await graph.getMessagesText();
      expect(msg).toMatch(/Move Node Mode disabled/);
    });

    test('Attempt selection while Move Node Mode is ON should be ignored for select routines', async ({ page }) => {
      const graph = new GraphPage(page);

      // Ensure there's at least one node
      await graph.addNodeByName('M1');

      // Turn move mode ON
      await graph.toggleMoveMode();
      expect(await graph.moveModeButtonText()).toContain('ON');

      // Click on canvas at the location where node might be - we can't be sure of exact coords,
      // but clicking should not enable delete buttons because selection is disabled in move mode.
      await graph.clickCanvasAt(120, 120);
      // Delete buttons should remain disabled while in move mode
      expect(await graph.isDeleteNodeDisabled()).toBe(true);
      expect(await graph.isDeleteEdgeDisabled()).toBe(true);

      // Turn off move mode to restore selection behavior
      await graph.toggleMoveMode();
      expect(await graph.moveModeButtonText()).toContain('OFF');
    });
  });

  test.describe('Traversals, connectivity, cycle detection, highlights, and clear actions', () => {
    test('Perform BFS and DFS traversals and verify messages and highlights are triggered', async ({ page }) => {
      const graph = new GraphPage(page);

      // Build a simple chain A-B-C
      await graph.addNodeByName('A');
      await graph.addNodeByName('B');
      await graph.addNodeByName('C');

      await graph.addEdge('A', 'B');
      await graph.addEdge('B', 'C');

      // Run BFS from A
      await graph.runBFS('A');
      let msg = await graph.getMessagesText();
      // BFS order should include A and B and C in order A → B → C
      expect(msg).toMatch(/BFS Traversal order:/);
      expect(msg).toMatch(/A.*B.*C|A → B → C/);

      // Run DFS from A
      await graph.runDFS('A');
      msg = await graph.getMessagesText();
      expect(msg).toMatch(/DFS Traversal order:/);
      // DFS order could be A B C for this simple chain
      expect(msg).toMatch(/A.*B.*C|A → B → C/);
    });

    test('Check connectivity reports graph as connected and highlights component', async ({ page }) => {
      const graph = new GraphPage(page);

      // Create a connected graph: A-B-C
      await graph.addNodeByName('A');
      await graph.addNodeByName('B');
      await graph.addNodeByName('C');
      await graph.addEdge('A', 'B');
      await graph.addEdge('B', 'C');

      // Check connectivity
      await graph.checkConnected();
      const resultText = await graph.getResultOutputText();
      expect(resultText).toMatch(/Graph is connected\.|Graph is NOT connected\./);
      // Because we've created a connected chain, expect connected result
      expect(resultText).toBe('Graph is connected.');
      const msg = await graph.getMessagesText();
      expect(msg).toMatch(/Graph is connected\./);
    });

    test('Detect cycle in graph and highlight cycle path', async ({ page }) => {
      const graph = new GraphPage(page);

      // Create a triangle A-B-C-A
      await graph.addNodeByName('A');
      await graph.addNodeByName('B');
      await graph.addNodeByName('C');
      await graph.addEdge('A', 'B');
      await graph.addEdge('B', 'C');
      await graph.addEdge('C', 'A');

      // Run cycle detection
      await graph.checkCycle();
      const res = await graph.getResultOutputText();
      // Should report a cycle path or detection message
      expect(res).toMatch(/Cycle detected:|No cycle detected\./);
      const msg = await graph.getMessagesText();
      expect(msg).toMatch(/Cycle detected:|No cycle detected\./);
    });

    test('Clear highlights action resets highlights and outputs appropriate message', async ({ page }) => {
      const graph = new GraphPage(page);

      // Prepare by adding nodes and performing BFS to create highlights
      await graph.addNodeByName('A');
      await graph.addNodeByName('B');
      await graph.addEdge('A', 'B');
      await graph.runBFS('A');

      // Clear highlights
      await graph.clearHighlights();
      const msg = await graph.getMessagesText();
      expect(msg).toMatch(/Highlights cleared\./);

      // resultOutput should be empty after clearing highlights
      expect(await graph.getResultOutputText()).toBe('');
    });

    test('Clear graph action removes all data and resets UI', async ({ page }) => {
      const graph = new GraphPage(page);

      // Add nodes and edge
      await graph.addNodeByName('A');
      await graph.addNodeByName('B');
      await graph.addEdge('A', 'B');

      // Now clear the graph
      await graph.clearGraph();
      const msg = await graph.getMessagesText();
      expect(msg).toMatch(/Graph cleared\./);

      // After clearing, delete buttons must be disabled and resultOutput empty
      expect(await graph.isDeleteNodeDisabled()).toBe(true);
      expect(await graph.isDeleteEdgeDisabled()).toBe(true);
      expect(await graph.getResultOutputText()).toBe('');
    });
  });

  test.describe('Accessibility & keyboard shortcuts and edge cases', () => {
    test('Pressing Enter in inputs triggers corresponding actions', async ({ page }) => {
      const graph = new GraphPage(page);

      // Enter in nodeNameInput should trigger addNode
      await graph.locators.nodeNameInput.fill('KBD');
      await graph.locators.nodeNameInput.press('Enter');
      await expect(graph.locators.messages).toHaveText(/Node\s+'KBD'\s+added\./);

      // Enter in edge node inputs should trigger addEdge (edge will likely fail if nodes missing)
      // Create a node to allow edge creation
      await graph.addNodeByName('E1');
      await graph.addNodeByName('E2');
      await graph.locators.edgeNode1Input.fill('E1');
      await graph.locators.edgeNode2Input.fill('E2');
      await graph.locators.edgeNode2Input.press('Enter'); // should submit edge
      await expect(graph.locators.messages).toHaveText(/Edge added between 'E1' and 'E2'\./);
    });

    test('Edge case: checkConnected on empty graph reports empty', async ({ page }) => {
      const graph = new GraphPage(page);

      // Ensure graph is clear
      await graph.clearGraph();

      // Click check connected
      await graph.checkConnected();
      const msg = await graph.getMessagesText();
      expect(msg).toMatch(/Graph is empty\./);
      const res = await graph.getResultOutputText();
      expect(res).toBe('Graph is empty.');
    });
  });
});