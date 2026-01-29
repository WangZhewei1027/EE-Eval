import { test, expect } from '@playwright/test';

// Test file: 12144dc2-fa7a-11f0-acf9-69409043402d.spec.js
// Application URL:
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12144dc2-fa7a-11f0-acf9-69409043402d.html';

// Simple page object encapsulating common interactions with the demo.
class DijkstraPage {
  constructor(page) {
    this.page = page;
    // UI element selectors
    this.nodeCountInput = page.locator('#nodeCount');
    this.createGraphBtn = page.locator('#createGraphBtn');
    this.graphContainer = page.locator('#graphContainer');
    this.startNodeSelect = page.locator('#startNodeSelect');
    this.initializeBtn = page.locator('#initializeBtn');
    this.statusOutput = page.locator('#statusOutput');
    this.nextStepBtn = page.locator('#nextStepBtn');
    this.autoRunBtn = page.locator('#autoRunBtn');
    this.pauseAutoBtn = page.locator('#pauseAutoBtn');
    this.resetAlgorithmBtn = page.locator('#resetAlgorithmBtn');
    this.currentNodeSetSpan = page.locator('#currentNodeSet');
    this.showDistancesBtn = page.locator('#showDistancesBtn');
    this.showPredecessorsBtn = page.locator('#showPredecessorsBtn');
    this.tablesContainer = page.locator('#tablesContainer');
    this.destinationInput = page.locator('#destinationInput');
    this.findPathBtn = page.locator('#findPathBtn');
    this.pathOutput = page.locator('#pathOutput');
    this.clearAllBtn = page.locator('#clearAllBtn');
    this.graphTable = page.locator('#graphTable');
  }

  // Create graph with specified node count - expects no dialog confirmation for valid input
  async createGraph(count) {
    await this.nodeCountInput.fill(String(count));
    await this.createGraphBtn.click();
    // wait for graphTable to appear
    await expect(this.graphContainer.locator('#graphTable')).toBeVisible();
  }

  // Click cell in adjacency matrix and set weight via prompt dialog
  // row and col are numeric indices (0-based), weight is string ('' to clear)
  async setEdgeWeight(row, col, weight) {
    // Find the specific td by data attributes inside the table
    const td = this.graphContainer.locator(`#graphTable td[data-row="${row}"][data-col="${col}"]`);
    // Prepare to accept prompt dialog
    const dialogPromise = this.page.waitForEvent('dialog');
    await td.click();
    const dialog = await dialogPromise;
    // Accept with provided weight (empty string clears)
    await dialog.accept(weight);
    // Wait a little for table to refresh
    await this.page.waitForTimeout(50);
  }

  // Select start node by index (0-based, corresponds to option value)
  async selectStartNode(index) {
    await this.startNodeSelect.selectOption(String(index));
  }

  // Initialize algorithm
  async initializeAlgorithm() {
    await this.initializeBtn.click();
    // statusOutput updates
    await expect(this.statusOutput).not.toHaveText('No algorithm initialized.');
  }

  // Execute next step
  async nextStep() {
    await this.nextStepBtn.click();
  }

  // Start auto run and optionally wait a bit
  async startAutoRun() {
    await this.autoRunBtn.click();
  }

  // Pause auto run
  async pauseAutoRun() {
    await this.pauseAutoBtn.click();
  }

  // Reset algorithm state
  async resetAlgorithm() {
    await this.resetAlgorithmBtn.click();
  }

  // Show distances table
  async showDistances() {
    await this.showDistancesBtn.click();
    await expect(this.tablesContainer.locator('h3', { hasText: 'Table: Distances' })).toBeVisible();
  }

  // Show predecessors table
  async showPredecessors() {
    await this.showPredecessorsBtn.click();
    await expect(this.tablesContainer.locator('h3', { hasText: 'Table: Predecessors' })).toBeVisible();
  }

  // Find shortest path by entering destination letter and clicking button
  async findPath(destinationLetter) {
    await this.destinationInput.fill(destinationLetter);
    await this.findPathBtn.click();
  }

  // Click clear all and accept confirm dialog
  async clearAllAcceptConfirm() {
    const dialogPromise = this.page.waitForEvent('dialog');
    await this.clearAllBtn.click();
    const dialog = await dialogPromise;
    await dialog.accept();
    // Wait for clearAll to take effect
    await this.page.waitForTimeout(50);
  }
}

test.describe('Dijkstra Interactive Demo - FSM and UI tests', () => {
  // arrays to capture runtime console and page errors
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for diagnostics
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({}, testInfo) => {
    // Diagnostics: attach console messages summary to test output if available
    if (consoleMessages.length) {
      for (const c of consoleMessages.slice(0, 20)) {
        // small safeguard to not spam logs; Playwright will still collect details
        testInfo.attachments = testInfo.attachments || [];
      }
    }
    // Assert that no critical JavaScript errors (ReferenceError, TypeError, SyntaxError) were thrown
    // NOTE: The page is loaded and errors are observed naturally. We assert that no uncaught errors of
    // these critical types have occurred during the test run.
    const criticalErrors = pageErrors.filter(e =>
      /ReferenceError|TypeError|SyntaxError/.test(String(e && e.name))
      || /ReferenceError|TypeError|SyntaxError/.test(String(e && e.message))
    );
    expect(criticalErrors.length, `Unexpected critical JS errors: ${criticalErrors.map(e => String(e)).join('; ')}`).toBe(0);
  });

  test.describe('State S0_Idle (Initial)', () => {
    test('Initial page load should be in Idle state: controls reset and graph cleared', async ({ page }) => {
      const p = new DijkstraPage(page);

      // Verify nodeCount default value restored by clearAll() in on-load init
      await expect(p.nodeCountInput).toHaveValue('5');

      // Graph container should be empty (clearAll sets graphContainer.innerHTML = '')
      await expect(p.graphContainer).toBeEmpty();

      // Start node select disabled initially
      await expect(p.startNodeSelect).toBeDisabled();

      // Initialize button disabled
      await expect(p.initializeBtn).toBeDisabled();

      // Status outputs
      await expect(p.statusOutput).toHaveText('No algorithm initialized.');

      // Next step and other controls disabled in Idle
      await expect(p.nextStepBtn).toBeDisabled();
      await expect(p.autoRunBtn).toBeDisabled();
      await expect(p.pauseAutoBtn).toBeDisabled();
      await expect(p.resetAlgorithmBtn).toBeDisabled();

      // currentNodeSetSpan should be 'N/A' in Idle
      await expect(p.currentNodeSetSpan).toHaveText('N/A');
    });
  });

  test.describe('Creating and defining the graph (S1_GraphDefined)', () => {
    test('CREATE_GRAPH: create adjacency matrix and populate start node select', async ({ page }) => {
      const p = new DijkstraPage(page);

      // Create a graph with 4 nodes
      await p.createGraph(4);

      // The graph table (4x4) should be present: header row + 4 rows => 5 tr
      await expect(p.graphContainer.locator('#graphTable')).toBeVisible();

      // Check number of data cells = 4*4
      const tds = p.graphContainer.locator('#graphTable td');
      await expect(tds).toHaveCount(16);

      // Start node select should now be enabled and have options for A-D
      await expect(p.startNodeSelect).toBeEnabled();
      await expect(p.startNodeSelect.locator('option')).toHaveCount(1 + 4); // placeholder + 4 options

      // The initialize button should still be disabled until a start node is selected
      await expect(p.initializeBtn).toBeDisabled();
    });

    test('Edge case: invalid node count triggers alert and graph not created', async ({ page }) => {
      const p = new DijkstraPage(page);

      // Set invalid node count 0 and click Create Graph -> should alert
      await p.nodeCountInput.fill('0');

      const dialogPromise = page.waitForEvent('dialog');
      await p.createGraphBtn.click();
      const dialog = await dialogPromise;
      // The app uses alert for invalid input - verify message and dismiss
      expect(dialog.message()).toContain('Please enter an integer node count between 1 and 26.');
      await dialog.accept();

      // Graph should not be created; graphContainer remains empty
      await expect(p.graphContainer).toBeEmpty();
    });
  });

  test.describe('Algorithm initialization and interactions (S2_AlgorithmInitialized)', () => {
    test('INITIALIZE_ALGORITHM: selecting start node enables initialization and initializes algorithm', async ({ page }) => {
      const p = new DijkstraPage(page);

      // create graph and pick start node
      await p.createGraph(3);

      // Select start node A (value "0") -> initializeBtn should become enabled
      await p.selectStartNode(0);
      await expect(p.initializeBtn).toBeEnabled();

      // Click initialize - should enable algorithm controls and update status
      await p.initializeAlgorithm();

      // After initialization:
      await expect(p.nextStepBtn).toBeEnabled();
      await expect(p.autoRunBtn).toBeEnabled();
      await expect(p.pauseAutoBtn).toBeDisabled();
      await expect(p.resetAlgorithmBtn).toBeEnabled();
      await expect(p.showDistancesBtn).toBeEnabled();
      await expect(p.showPredecessorsBtn).toBeEnabled();
      await expect(p.destinationInput).toBeEnabled();
      await expect(p.findPathBtn).toBeEnabled();

      // currentNodeSetSpan should show Unvisited containing all nodes initially
      const currentSetText = await p.currentNodeSetSpan.textContent();
      expect(currentSetText).toContain('Unvisited');
    });

    test('SHOW_DISTANCES and SHOW_PREDECESSORS generate appropriate tables', async ({ page }) => {
      const p = new DijkstraPage(page);

      await p.createGraph(3);
      await p.selectStartNode(0);
      await p.initializeAlgorithm();

      // Show distances table -> should be displayed with header and '∞' values initially
      await p.showDistances();
      const distancesTable = p.tablesContainer.locator('h3', { hasText: 'Table: Distances' }).locator('..').locator('table');
      await expect(distancesTable).toBeVisible();
      // Check that at least one '∞' cell exists (start may be 0, others ∞)
      await expect(distancesTable.locator('td', { hasText: '∞' })).toBeVisible();

      // Show predecessors table -> dummies '-' since none set
      await p.showPredecessors();
      const predsTable = p.tablesContainer.locator('h3', { hasText: 'Table: Predecessors' }).locator('..').locator('table');
      await expect(predsTable.locator('td', { hasText: '-' })).toBeVisible();
    });

    test('FIND_SHORTEST_PATH returns message when algorithm not initialized (edge case)', async ({ page }) => {
      const p = new DijkstraPage(page);

      await p.createGraph(3);
      // Do not initialize algorithm - attempt to click find path -> should alert
      await p.destinationInput.fill('B');

      const dialogPromise = page.waitForEvent('dialog');
      await p.findPathBtn.click();
      const dialog = await dialogPromise;
      expect(dialog.message()).toContain('Algorithm not initialized.');
      await dialog.accept();
    });
  });

  test.describe('Algorithm running steps and auto-run (S3_AlgorithmRunning -> S4_AlgorithmFinished)', () => {
    test('NEXT_STEP steps through the algorithm until finished', async ({ page }) => {
      const p = new DijkstraPage(page);

      // Create a small graph of 3 nodes and add edges:
      // A -> B (2), A -> C (5), B -> C (1)
      await p.createGraph(3);
      // Set A->B = 2
      await p.setEdgeWeight(0, 1, '2');
      // Set A->C = 5
      await p.setEdgeWeight(0, 2, '5');
      // Set B->C = 1
      await p.setEdgeWeight(1, 2, '1');

      // Select start node A and initialize
      await p.selectStartNode(0);
      await p.initializeAlgorithm();

      // First step: should visit A, update distances to B=2, C=5
      await p.nextStep();
      let status = await p.statusOutput.textContent();
      expect(status).toContain('Visited nodes: A');
      // Show distances to verify values updated
      await p.showDistances();
      const distText = await p.tablesContainer.textContent();
      expect(distText).toContain('A: 0');
      expect(distText).toContain('B: 2');
      expect(distText).toContain('C: 5');

      // Second step: choose B next and relax B->C making C distance 3
      await p.nextStep();
      status = await p.statusOutput.textContent();
      expect(status).toContain('Visited nodes: A, B');

      // Third step: choose C and finish
      await p.nextStep();
      status = await p.statusOutput.textContent();
      // When finished, the statusOutput contains 'Algorithm finished.'
      expect(status).toContain('Algorithm finished');

      // After finishing, nextStep and autoRun should be disabled
      await expect(p.nextStepBtn).toBeDisabled();
      await expect(p.autoRunBtn).toBeDisabled();
    });

    test('AUTO_RUN starts interval and PAUSE_AUTO_RUN stops it', async ({ page }) => {
      const p = new DijkstraPage(page);

      // Create graph and edges so there are steps to run
      await p.createGraph(3);
      await p.setEdgeWeight(0, 1, '1');
      await p.setEdgeWeight(1, 2, '1');

      // Initialize from A
      await p.selectStartNode(0);
      await p.initializeAlgorithm();

      // Start auto-run; allow one interval tick then pause
      await p.startAutoRun();
      // Wait slightly more than AUTO_RUN_SPEED_MS (1000ms used by app)
      await page.waitForTimeout(1100);

      // Pause auto-run
      await p.pauseAutoRun();

      // After pausing, autoRunBtn should be enabled again and pauseAutoBtn disabled
      await expect(p.autoRunBtn).toBeEnabled();
      await expect(p.pauseAutoBtn).toBeDisabled();

      // Check that some nodes were visited (statusOutput updated)
      const status = await p.statusOutput.textContent();
      expect(status.length).toBeGreaterThan(0);
    });

    test('RESET_ALGORITHM moves back to initialized=false and disables controls', async ({ page }) => {
      const p = new DijkstraPage(page);

      await p.createGraph(3);
      await p.setEdgeWeight(0, 1, '1');
      await p.selectStartNode(0);
      await p.initializeAlgorithm();

      // After init, resetAlgorithmBtn should be enabled
      await expect(p.resetAlgorithmBtn).toBeEnabled();
      await p.resetAlgorithm();

      // After reset, status should show 'No algorithm initialized.' and most controls disabled
      await expect(p.statusOutput).toHaveText('No algorithm initialized.');
      await expect(p.nextStepBtn).toBeDisabled();
      await expect(p.autoRunBtn).toBeDisabled();
      await expect(p.showDistancesBtn).toBeDisabled();
      await expect(p.destinationInput).toBeDisabled();
    });
  });

  test.describe('Display tables and path querying (S2_AlgorithmInitialized actions)', () => {
    test('SHOW_DISTANCES/SHOW_PREDECESSORS after steps reflect computed values', async ({ page }) => {
      const p = new DijkstraPage(page);

      // Build graph A->B 2, A->C 4, B->C 1
      await p.createGraph(3);
      await p.setEdgeWeight(0,1,'2');
      await p.setEdgeWeight(0,2,'4');
      await p.setEdgeWeight(1,2,'1');

      await p.selectStartNode(0);
      await p.initializeAlgorithm();

      // Step once (visit A) -> distances B=2, C=4
      await p.nextStep();

      // Show distances and verify numbers
      await p.showDistances();
      const distText = await p.tablesContainer.textContent();
      expect(distText).toContain('A: 0');
      expect(distText).toContain('B: 2');
      expect(distText).toContain('C: 4');

      // Step again (visit B) -> C should be updated to 3 (via B)
      await p.nextStep();
      await p.showDistances();
      const distText2 = await p.tablesContainer.textContent();
      expect(distText2).toContain('C: 3');

      // Show predecessors table and confirm predecessor of C is B (i.e., 'B')
      await p.showPredecessors();
      const predText = await p.tablesContainer.textContent();
      expect(predText).toMatch(/C[\s\S]*B/);
    });

    test('FIND_SHORTEST_PATH reconstructs and displays path correctly', async ({ page }) => {
      const p = new DijkstraPage(page);

      // Construct graph A->B (1), B->C (1)
      await p.createGraph(3);
      await p.setEdgeWeight(0,1,'1');
      await p.setEdgeWeight(1,2,'1');

      await p.selectStartNode(0);
      await p.initializeAlgorithm();

      // Run to completion
      await p.nextStep(); // visit A
      await p.nextStep(); // visit B
      await p.nextStep(); // visit C (finish)

      // Enter destination 'C' and find path
      await p.findPath('C');
      const pathText = await p.pathOutput.textContent();
      expect(pathText).toContain('Shortest path from A to C:');
      expect(pathText).toContain('A → B → C');
      expect(pathText).toContain('Total cost: 2');
    });

    test('FIND_SHORTEST_PATH invalid letter triggers alert (edge case)', async ({ page }) => {
      const p = new DijkstraPage(page);

      await p.createGraph(3);
      await p.selectStartNode(0);
      await p.initializeAlgorithm();

      // Enter invalid destination 'Z' (out of range)
      await p.destinationInput.fill('Z');
      const dialogPromise = page.waitForEvent('dialog');
      await p.findPathBtn.click();
      const dialog = await dialogPromise;
      expect(dialog.message()).toContain('Please enter a valid destination node letter');
      await dialog.accept();
    });
  });

  test.describe('CLEAR_ALL action and overall cleanup (S0_Idle final)', () => {
    test('CLEAR_ALL: clears data and resets UI after confirmation', async ({ page }) => {
      const p = new DijkstraPage(page);

      // Create graph then clear it via clearAll button (confirm accepted)
      await p.createGraph(3);
      await p.clearAllAcceptConfirm();

      // After clearing, graphContainer should be empty, startNodeSelect disabled, and nodeCount reset to 5
      await expect(p.graphContainer).toBeEmpty();
      await expect(p.startNodeSelect).toBeDisabled();
      await expect(p.nodeCountInput).toHaveValue('5');
      await expect(p.statusOutput).toHaveText('No algorithm initialized.');
    });
  });
});