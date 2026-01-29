import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99ce8245-fa79-11f0-8075-e54a10595dde.html';

// Page Object encapsulating interactions with the Directed Graph demo
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.nodeInput = page.locator('#nodeInput');
    this.sourceInput = page.locator('#sourceInput');
    this.targetInput = page.locator('#targetInput');
    this.addNodeBtn = page.locator('button[onclick="addNode()"]');
    this.addEdgeBtn = page.locator('button[onclick="addEdge()"]');
    this.removeNodeBtn = page.locator('button[onclick="removeNode()"]');
    this.removeEdgeBtn = page.locator('button[onclick="removeEdge()"]');
    this.displayGraphBtn = page.locator('button[onclick="displayGraph()"]');
    this.graphArea = page.locator('#graph');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async addNode(name) {
    await this.nodeInput.fill(name);
    await this.addNodeBtn.click();
  }

  async addEdge(source, target) {
    await this.sourceInput.fill(source);
    await this.targetInput.fill(target);
    await this.addEdgeBtn.click();
  }

  async removeNode(name) {
    await this.nodeInput.fill(name);
    await this.removeNodeBtn.click();
  }

  async removeEdge(source, target) {
    await this.sourceInput.fill(source);
    await this.targetInput.fill(target);
    await this.removeEdgeBtn.click();
  }

  async displayGraph() {
    await this.displayGraphBtn.click();
  }

  async graphInnerHTML() {
    return await this.graphArea.innerHTML();
  }

  // Utility to get runtime Sets from page context
  async getNodesArray() {
    return await this.page.evaluate(() => Array.from(window.nodes || []));
  }

  async getEdgesArray() {
    return await this.page.evaluate(() => Array.from(window.edges || []));
  }
}

test.describe('Directed Graph Interactive Demonstration (FSM Verification)', () => {
  let consoleMessages;
  let pageErrors;
  let dialogMessages;

  // Global listeners setup for each test - capture console messages, page errors and dialogs
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogMessages = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Capture any unhandled exceptions (ReferenceError, SyntaxError, TypeError, etc.)
      pageErrors.push(err);
    });

    page.on('dialog', async (dialog) => {
      dialogMessages.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept(); // accept alerts automatically to allow test flow to continue
    });
  });

  // After each test, ensure there are no unexpected runtime errors (page errors) and no console.error logs
  test.afterEach(async () => {
    // Assert no uncaught page errors occurred during the test run
    expect(pageErrors, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`).toHaveLength(0);

    // Assert there are no console messages of type 'error'
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages, `Unexpected console.error messages: ${errorConsoleMessages.map(m => m.text).join('; ')}`).toHaveLength(0);
  });

  // Validate initial Idle state (S0_Idle)
  test('Initial Idle state: page renders expected controls and empty graph', async ({ page }) => {
    const gp = new GraphPage(page);
    await gp.goto();

    // Validate presence of expected input and buttons (evidence for S0_Idle)
    await expect(gp.nodeInput).toBeVisible();
    await expect(gp.addNodeBtn).toBeVisible();
    await expect(gp.addEdgeBtn).toBeVisible();

    // On initial load graph area should be empty (renderPage() is not defined in implementation; ensure no errors)
    const html = await gp.graphInnerHTML();
    expect(html.trim()).toBe('', 'Graph area should be empty on initial load');
  });

  test.describe('Node operations (S1_NodeAdded, S3_NodeRemoved)', () => {
    test('Add Node transitions to NodeAdded and updates graph (entry action updateGraph)', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Add a node "A"
      await gp.addNode('A');

      // Node input should be cleared (evidence)
      await expect(gp.nodeInput).toHaveValue('');

      // Graph should display the node (updateGraph -> displayGraph)
      const graphHtml = await gp.graphInnerHTML();
      expect(graphHtml).toContain('Nodes:</strong> A', 'Graph display should list added node A');

      // Internal Set nodes should contain "A"
      const nodes = await gp.getNodesArray();
      expect(nodes).toContain('A');
    });

    test('Adding empty node should have no effect (edge case)', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Ensure no nodes initially
      const initialNodes = await gp.getNodesArray();
      expect(initialNodes).toHaveLength(0);

      // Attempt to add empty node
      await gp.addNode('');

      // Nothing should be added, no alerts raised
      const nodesAfter = await gp.getNodesArray();
      expect(nodesAfter).toEqual(initialNodes);
      expect(dialogMessages).toHaveLength(0);
    });

    test('Remove Node transitions to NodeRemoved and removes related edges', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Setup: add nodes and edge C->D
      await gp.addNode('C');
      await gp.addNode('D');
      await gp.addEdge('C', 'D');

      // Verify setup
      let nodes = await gp.getNodesArray();
      let edges = await gp.getEdgesArray();
      expect(nodes).toEqual(expect.arrayContaining(['C', 'D']));
      expect(edges).toEqual(expect.arrayContaining(['C->D']));

      // Remove node C
      await gp.removeNode('C');

      // Node input should be cleared
      await expect(gp.nodeInput).toHaveValue('');

      // Node C should be removed from internal set, and edge C->D removed
      nodes = await gp.getNodesArray();
      edges = await gp.getEdgesArray();
      expect(nodes).not.toContain('C');
      expect(edges).not.toContain('C->D');

      // Graph area should not contain 'C' in Nodes or Edges listing
      const graphHtml = await gp.graphInnerHTML();
      expect(graphHtml).not.toContain('C');
    });

    test('Removing non-existent node shows alert (edge case)', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Ensure node X does not exist
      const nodes = await gp.getNodesArray();
      expect(nodes).not.toContain('X');

      // Attempt to remove non-existent node triggers alert
      await gp.removeNode('X');

      // A dialog should have been captured with the expected message
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      expect(dialogMessages[dialogMessages.length - 1].message).toBe('Node does not exist!');
    });
  });

  test.describe('Edge operations (S2_EdgeAdded, S4_EdgeRemoved)', () => {
    test('Add Edge transitions to EdgeAdded when nodes exist and updates graph', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Setup nodes
      await gp.addNode('A');
      await gp.addNode('B');

      // Add edge A->B
      await gp.addEdge('A', 'B');

      // Source and target inputs should be cleared (evidence)
      await expect(gp.sourceInput).toHaveValue('');
      await expect(gp.targetInput).toHaveValue('');

      // Edge should be present in internal set
      const edges = await gp.getEdgesArray();
      expect(edges).toContain('A->B');

      // Graph should display the edge
      const graphHtml = await gp.graphInnerHTML();
      expect(graphHtml).toContain('A->B');
    });

    test('Adding edge with missing nodes triggers alert (edge case)', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Ensure nodes X and Y are absent
      const nodes = await gp.getNodesArray();
      expect(nodes).not.toContain('X');
      expect(nodes).not.toContain('Y');

      // Try to add edge X->Y should show alert "Invalid source or target node!"
      await gp.addEdge('X', 'Y');

      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      expect(dialogMessages[dialogMessages.length - 1].message).toBe('Invalid source or target node!');
    });

    test('Remove Edge transitions to EdgeRemoved and updates graph', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Setup nodes and edge E->F
      await gp.addNode('E');
      await gp.addNode('F');
      await gp.addEdge('E', 'F');

      // Verify edge present
      let edges = await gp.getEdgesArray();
      expect(edges).toContain('E->F');

      // Remove edge E->F
      await gp.removeEdge('E', 'F');

      // Source and target inputs should be cleared
      await expect(gp.sourceInput).toHaveValue('');
      await expect(gp.targetInput).toHaveValue('');

      // Edge should be removed
      edges = await gp.getEdgesArray();
      expect(edges).not.toContain('E->F');

      // Graph should not list E->F
      const graphHtml = await gp.graphInnerHTML();
      expect(graphHtml).not.toContain('E->F');
    });

    test('Removing non-existent edge shows alert (edge case)', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Ensure edge G->H does not exist
      const edges = await gp.getEdgesArray();
      expect(edges).not.toContain('G->H');

      // Attempt to remove non-existent edge triggers alert
      await gp.removeEdge('G', 'H');

      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      expect(dialogMessages[dialogMessages.length - 1].message).toBe('Edge does not exist!');
    });
  });

  test.describe('Display Graph (S5_GraphDisplayed) and overall integration', () => {
    test('Display Graph shows nodes and edges correctly (entry action displayGraph)', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Create a set of nodes and edges
      await gp.addNode('N1');
      await gp.addNode('N2');
      await gp.addEdge('N1', 'N2');

      // Explicitly click Display Graph (transition to S5_GraphDisplayed)
      await gp.displayGraph();

      // The graph innerHTML should match expected formatting listing both nodes and edges
      const graphHtml = await gp.graphInnerHTML();
      // Check for Nodes and Edges labels and content
      expect(graphHtml).toContain('<strong>Nodes:</strong>');
      expect(graphHtml).toContain('<strong>Edges:</strong>');
      expect(graphHtml).toContain('N1');
      expect(graphHtml).toContain('N2');
      expect(graphHtml).toContain('N1->N2');

      // Validate internal data matches displayed content
      const nodes = await gp.getNodesArray();
      const edges = await gp.getEdgesArray();
      expect(nodes).toEqual(expect.arrayContaining(['N1', 'N2']));
      expect(edges).toEqual(expect.arrayContaining(['N1->N2']));
    });
  });
});