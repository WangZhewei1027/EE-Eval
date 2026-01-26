import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12144dc1-fa7a-11f0-acf9-69409043402d.html';

test.describe('BFS Interactive Demo - FSM validation and transitions', () => {
  // Shared listeners storage
  let consoleMessages;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    // Capture console messages for inspection
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture unhandled page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Auto-accept alerts but record them
    page.on('dialog', async dialog => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      // Accept alerts/prompts/confirmations to allow the UI flow to continue
      await dialog.accept();
    });

    await page.goto(APP_URL);
    // Ensure page loaded and initial UI present
    await expect(page.locator('h1')).toHaveText(/Breadth-First Search/i);
  });

  test.afterEach(async () => {
    // Sanity: assert no unexpected runtime exceptions were thrown
    // The app is expected to run without uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Initial Idle state: BFS controls are disabled', async ({ page }) => {
    // Validate S0_Idle: initial entry action updateBFSControls(false) should disable BFS controls
    const bfsStep = page.locator('#bfs-step-btn');
    const bfsAuto = page.locator('#bfs-auto-btn');
    const bfsPause = page.locator('#bfs-pause-btn');
    const bfsReset = page.locator('#bfs-reset-btn');

    await expect(bfsStep).toBeDisabled();
    await expect(bfsAuto).toBeDisabled();
    await expect(bfsPause).toBeDisabled();
    await expect(bfsReset).toBeDisabled();

    // Initial graph area message should indicate load hint
    await expect(page.locator('#graph-area')).toContainText('(Load a graph to show adjacency list here)');

    // No dialogs should have shown at initial load
    expect(dialogs.length).toBe(0);
  });

  test.describe('Graph loading, parsing, and error scenarios', () => {
    test('Load a valid graph enables BFS controls and shows adjacency list (S0 -> S1)', async ({ page }) => {
      // Prepare graph input and start node, then click Load Graph
      const graphText = `
A B
A C
B D
C D
D E
`;
      await page.fill('#graph-text', graphText);
      await page.fill('#start-node', 'A');

      // Click Load Graph
      await page.click('#load-graph-btn');

      // After loading, adjacency list should be rendered and BFS controls enabled
      await expect(page.locator('#graph-area')).toContainText('A: B C');
      await expect(page.locator('#graph-area')).toContainText('D: E');

      // The queue should be initialized with the start node
      await expect(page.locator('#queue-area')).toContainText('A');

      // BFS control buttons should now be enabled appropriately
      await expect(page.locator('#bfs-step-btn')).toBeEnabled();
      await expect(page.locator('#bfs-auto-btn')).toBeEnabled(); // not running yet
      await expect(page.locator('#bfs-reset-btn')).toBeEnabled();
      // Pause should still be disabled until running
      await expect(page.locator('#bfs-pause-btn')).toBeDisabled();

      // The log should contain the load confirmation
      await expect(page.locator('#log-area')).toContainText('Graph loaded. BFS ready to start from node "A".');

      // Advanced controls should be enabled
      await expect(page.locator('#add-node-btn')).toBeEnabled();
      await expect(page.locator('#add-edge-btn')).toBeEnabled();
      await expect(page.locator('#export-graph-btn')).toBeEnabled();

      // No alerts should have occurred
      expect(dialogs.length).toBe(0);
    });

    test('Loading graph with missing start node triggers alert and remains disabled (S0 -> S1 error case)', async ({ page }) => {
      // Provide a graph but a start node not in graph
      const graphText = `
X Y
Y Z
`;
      await page.fill('#graph-text', graphText);
      await page.fill('#start-node', 'NON_EXISTENT');

      // Click Load Graph, expecting an alert about missing start node
      await page.click('#load-graph-btn');

      // A dialog should have occurred complaining about start node
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      const lastDialog = dialogs[dialogs.length - 1];
      expect(lastDialog.message).toMatch(/Start node "NON_EXISTENT" is not in the graph/i);

      // BFS controls should remain disabled
      await expect(page.locator('#bfs-step-btn')).toBeDisabled();
      await expect(page.locator('#bfs-auto-btn')).toBeDisabled();
      await expect(page.locator('#bfs-reset-btn')).toBeDisabled();
    });
  });

  test.describe('BFS execution flows (step, auto, pause, reset)', () => {
    test.beforeEach(async ({ page }) => {
      // Ensure a known graph is loaded for these tests
      const graphText = `
A B
A C
B D
C D
D E
`;
      await page.fill('#graph-text', graphText);
      await page.fill('#start-node', 'A');
      await page.click('#load-graph-btn');

      // Confirm loaded
      await expect(page.locator('#log-area')).toContainText('Graph loaded. BFS ready to start from node "A".');
    });

    test('Step through BFS updates visited and queue (S1 -> S1 via BFS_Step)', async ({ page }) => {
      // Click Step BFS
      await page.click('#bfs-step-btn');

      // Expect log to show visiting A and enqueued neighbors (B and C)
      await expect(page.locator('#log-area')).toContainText('Visiting node: A');
      await expect(page.locator('#log-area')).toContainText('Enqueued neighbor: B');

      // Visited area should show A
      await expect(page.locator('#visited-area')).toContainText('A');

      // Queue should now include B and C
      await expect(page.locator('#queue-area')).toContainText('B');
      await expect(page.locator('#queue-area')).toContainText('C');
    });

    test('Run auto BFS, then pause it (S1 -> S2 -> S3)', async ({ page }) => {
      // Speed up the auto-run by reducing step delay
      await page.fill('#step-delay-range', '100'); // range input; trigger input event by evaluating
      await page.evaluate(() => {
        const el = document.getElementById('step-delay-range');
        el.value = '100';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      // Start auto-run
      await page.click('#bfs-auto-btn');

      // When running, bfsAutoBtn should be disabled and pause enabled
      await expect(page.locator('#bfs-auto-btn')).toBeDisabled();
      await expect(page.locator('#bfs-pause-btn')).toBeEnabled();

      // Wait for at least one visiting log to appear
      await expect(page.locator('#log-area')).toContainText('Visiting node:', { timeout: 5000 });

      // Pause the auto BFS
      await page.click('#bfs-pause-btn');

      // After pause, a log message should indicate the pause
      await expect(page.locator('#log-area')).toContainText('Auto BFS paused.');

      // Controls after pause: auto enabled again, pause disabled
      await expect(page.locator('#bfs-auto-btn')).toBeEnabled();
      await expect(page.locator('#bfs-pause-btn')).toBeDisabled();
    });

    test('Reset BFS while running or paused resets state and queue (S2 -> S4)', async ({ page }) => {
      // Start auto-run then reset
      await page.evaluate(() => {
        const el = document.getElementById('step-delay-range');
        el.value = '200';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.click('#bfs-auto-btn');

      // Allow some progress
      await expect(page.locator('#log-area')).toContainText('Visiting node:', { timeout: 3000 });

      // Click reset
      await page.click('#bfs-reset-btn');

      // Expect a reset log entry for start node
      await expect(page.locator('#log-area')).toContainText('BFS reset to start node "A"');

      // Queue should be reset to start node
      await expect(page.locator('#queue-area')).toContainText('A');

      // Step and auto should be enabled again (since BFS reset)
      await expect(page.locator('#bfs-step-btn')).toBeEnabled();
      await expect(page.locator('#bfs-auto-btn')).toBeEnabled();
    });
  });

  test.describe('Graph modification events and consistency', () => {
    test.beforeEach(async ({ page }) => {
      // Start with a loaded graph
      const graphText = `
A B
B C
`;
      await page.fill('#graph-text', graphText);
      await page.fill('#start-node', 'A');
      await page.click('#load-graph-btn');

      await expect(page.locator('#graph-area')).toContainText('A: B');
    });

    test('Add node and edge update adjacency and logs (S1 -> S1)', async ({ page }) => {
      // Add a new node X
      await page.fill('#add-node-input', 'X');
      await page.click('#add-node-btn');

      await expect(page.locator('#log-area')).toContainText('Node "X" added.');
      await expect(page.locator('#graph-area')).toContainText('X:');

      // Add an edge A -> X
      await page.fill('#add-edge-input-a', 'A');
      await page.fill('#add-edge-input-b', 'X');
      await page.click('#add-edge-btn');

      await expect(page.locator('#log-area')).toContainText('Edge "A → X" added.');
      await expect(page.locator('#graph-area')).toContainText('A: B X');

      // BFS state should have been reset and queue contain start node
      await expect(page.locator('#queue-area')).toContainText('A');
    });

    test('Remove edge and node reflect in adjacency and logs (S1 -> S1 or S5)', async ({ page }) => {
      // Ensure edge B C exists then remove it
      await expect(page.locator('#graph-area')).toContainText('B: C');

      await page.fill('#remove-edge-input-a', 'B');
      await page.fill('#remove-edge-input-b', 'C');
      await page.click('#remove-edge-btn');

      await expect(page.locator('#log-area')).toContainText('Edge "B → C" removed.');
      // B no longer lists C
      await expect(page.locator('#graph-area')).not.toContainText('B: C');

      // Now remove node C
      await page.fill('#remove-node-input', 'C');
      await page.click('#remove-node-btn');

      await expect(page.locator('#log-area')).toContainText('Node "C" removed.');
      // C should no longer appear in adjacency list
      await expect(page.locator('#graph-area')).not.toContainText('C:');
    });

    test('Changing the start node resets BFS and updates UI (S1 -> S1)', async ({ page }) => {
      // Add node Z to allow start change
      await page.fill('#add-node-input', 'Z');
      await page.click('#add-node-btn');

      // Change start node to Z
      await page.fill('#change-start-node', 'Z');
      await page.click('#change-start-node-btn');

      await expect(page.locator('#log-area')).toContainText('Start node changed to "Z". BFS reset.');
      await expect(page.locator('#queue-area')).toContainText('Z');
      // The start node input should be updated accordingly by the code
      await expect(page.locator('#start-node')).toHaveValue('Z');
    });
  });

  test.describe('Import and export graph flows', () => {
    test('Import adjacency list updates graph and logs (S1 via ImportGraph)', async ({ page }) => {
      // Open import area
      await page.click('#import-graph-btn');
      await expect(page.locator('#import-area')).toBeVisible();

      // Provide a valid adjacency list that includes a start node 'S'
      const importText = `S: A B
A: S
B: S`;
      await page.fill('#import-textarea', importText);

      // Set start node to a valid node to avoid the alert
      await page.fill('#start-node', 'S');

      // Confirm import
      await page.click('#import-graph-confirm-btn');

      // Log should indicate import
      await expect(page.locator('#log-area')).toContainText('Graph imported from adjacency list.');

      // Graph area should contain S and neighbors
      await expect(page.locator('#graph-area')).toContainText('S: A B');

      // Advanced controls should be enabled
      await expect(page.locator('#add-node-btn')).toBeEnabled();
    });

    test('Export graph opens popup window with adjacency text (S1 via ExportGraph)', async ({ page }) => {
      // Ensure a graph is loaded first
      const graphText = `
P Q
Q R
`;
      await page.fill('#graph-text', graphText);
      await page.fill('#start-node', 'P');
      await page.click('#load-graph-btn');

      // Click export and wait for popup
      const [popup] = await Promise.all([
        page.waitForEvent('popup'),
        page.click('#export-graph-btn')
      ]);

      // Wait for popup to load and get its content
      await popup.waitForLoadState('domcontentloaded');
      // The code sets popup.title and writes a <pre> with adjacency list
      await expect(popup).toHaveTitle('Exported Graph Adjacency List');

      // The exported pre content should include lines like "P: Q"
      const preText = await popup.locator('pre').innerText();
      expect(preText).toContain('P: Q');
      await popup.close();
    });
  });

  test('Clear graph transitions to GraphCleared and disables controls (S1 -> S5)', async ({ page }) => {
    // Load a graph first
    await page.fill('#graph-text', 'A B\n');
    await page.fill('#start-node', 'A');
    await page.click('#load-graph-btn');

    // Click clear graph
    await page.click('#clear-graph-btn');

    // Graph area should indicate empty
    await expect(page.locator('#graph-area')).toHaveText('(Graph is empty)');

    // Log should contain 'Graph cleared.'
    await expect(page.locator('#log-area')).toContainText('Graph cleared.');

    // Advanced controls should be disabled
    await expect(page.locator('#add-node-btn')).toBeDisabled();
    await expect(page.locator('#export-graph-btn')).toBeDisabled();

    // BFS controls disabled
    await expect(page.locator('#bfs-step-btn')).toBeDisabled();
    await expect(page.locator('#bfs-auto-btn')).toBeDisabled();
  });

  test('Edge case: parsing invalid edge format shows alert and sets graphArea to error', async ({ page }) => {
    // Provide malformed graph input (three nodes on a line)
    await page.fill('#graph-text', 'A B C\n');
    await page.fill('#start-node', 'A');

    // Click load - should alert about invalid format and update graphArea to error state
    await page.click('#load-graph-btn');

    // Dialog should appear
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    const last = dialogs[dialogs.length - 1];
    expect(last.message).toMatch(/Invalid edge format/i);

    // Graph area should display parsing error per code's catch block
    await expect(page.locator('#graph-area')).toContainText('(Error parsing graph)');
  });
});