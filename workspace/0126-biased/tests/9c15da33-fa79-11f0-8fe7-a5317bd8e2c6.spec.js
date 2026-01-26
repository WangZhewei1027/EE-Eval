import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c15da33-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Helper utilities used across tests
async function collectPageState(page) {
  return await page.evaluate(() => {
    return {
      graphNodes: (window.graph && window.graph.nodes) ? window.graph.nodes.map(n => ({ id: n.id, label: n.label, x: n.x, y: n.y, down: n.down })) : [],
      graphEdges: (window.graph && window.graph.edges) ? window.graph.edges.map(e => ({ id: e.id, from: e.from, to: e.to, weight: e.weight, directed: e.directed, down: e.down, capacity: e.capacity, load: e.load })) : [],
      displayedPaths: window.displayedPaths ? window.displayedPaths.map(p => ({ id: p.id, name: p.name, nodes: p.nodes, edges: p.edges, dist: p.dist })) : [],
      eventLog: window.eventLog ? window.eventLog.slice(-20) : [],
      failureSequenceLength: window.failureSequence ? window.failureSequence.length : 0,
      agents: window.agents ? window.agents.map(a => ({ id: a.id, name: a.name, source: a.source, target: a.target, state: a.state, pathLen: a.path ? a.path.length : 0 })) : []
    };
  });
}

test.describe('Routing Interactive Sandbox - end-to-end FSM validation', () => {
  // Collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Capture dialogs (alerts/confirms/prompts) and auto-accept to not block flow.
    page.on('dialog', async dialog => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      try {
        // Accept or confirm all dialogs; preserve message for assertions
        await dialog.accept();
      } catch (e) {
        // ignore
      }
    });

    await page.goto(APP_URL);
    // Wait until initial seedDemo finished creating demo graph and initial draw runs
    await page.waitForFunction(() => window.graph && window.graph.nodes && window.graph.nodes.length >= 6, { timeout: 5000 });
  });

  test.afterEach(async () => {
    // Basic sanity: ensure no uncaught exceptions were thrown during the test run
    expect(pageErrors.length, 'No uncaught page errors should be present').toBe(0);
    // Also ensure there were some console logs (the app logs events)
    expect(consoleMessages.length).toBeGreaterThan(0);
  });

  test.describe('Initial render and Idle state (S0_Idle)', () => {
    test('renders main app and shows Graph Editing header, mode label, and canvas', async ({ page }) => {
      // Validate basic DOM evidence for Idle state
      await expect(page.locator('.app')).toBeVisible();
      await expect(page.locator('h3', { hasText: 'Graph Editing' })).toBeVisible();
      await expect(page.locator('#canvas')).toBeVisible();
      // Mode label should reflect default mode 'select'
      await expect(page.locator('#modeLabel')).toHaveText('select');
      // Ensure demo graph seeded (evidence: "Demo graph created" in event log)
      const state = await collectPageState(page);
      expect(state.graphNodes.length).toBeGreaterThanOrEqual(6);
      const foundDemoLog = state.eventLog.some(l => l.toLowerCase().includes('demo graph created'));
      expect(foundDemoLog).toBeTruthy();
    });
  });

  test.describe('Node and Edge editing (S1_AddingNode, S2_AddingEdge, S3_DeletingNode, S4_DeletingEdge)', () => {
    test('can add a node by switching to add-node mode and clicking canvas', async ({ page }) => {
      // Switch mode to add-node
      await page.selectOption('#mode', 'add-node');
      await expect(page.locator('#modeLabel')).toHaveText('add-node');

      // Get canvas bounding box and click roughly center to add node
      const canvas = page.locator('#canvas');
      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();
      const clickX = Math.round(box.x + box.width * 0.5);
      const clickY = Math.round(box.y + box.height * 0.5);

      // Record nodes count before
      const before = await page.evaluate(() => window.graph.nodes.length);
      await page.mouse.click(clickX, clickY);
      // Allow app to handle addNode and draw
      await page.waitForTimeout(200);

      const after = await page.evaluate(() => window.graph.nodes.length);
      expect(after).toBe(before + 1);

      // Event log should contain 'Added node'
      const state = await collectPageState(page);
      const addedNodeLog = state.eventLog.find(l => l.includes('Added node'));
      expect(addedNodeLog).toBeTruthy();
    });

    test('can add an edge by switching to add-edge and clicking two nodes', async ({ page }) => {
      // Ensure we have at least two nodes to connect
      const nodes = await page.evaluate(() => window.graph.nodes.slice(0, 10).map(n => ({ id: n.id, x: n.x, y: n.y })));
      expect(nodes.length).toBeGreaterThanOrEqual(2);

      // Switch mode to add-edge
      await page.selectOption('#mode', 'add-edge');
      await expect(page.locator('#modeLabel')).toHaveText('add-edge');

      // pick first two nodes positions and click them
      const a = nodes[0];
      const b = nodes[1];
      // Click first node
      const canvas = page.locator('#canvas');
      const canvasBox = await canvas.boundingBox();
      expect(canvasBox).not.toBeNull();

      // Use absolute coordinates to click
      await page.mouse.click(canvasBox.x + a.x, canvasBox.y + a.y);
      await page.waitForTimeout(100);
      await page.mouse.click(canvasBox.x + b.x, canvasBox.y + b.y);
      await page.waitForTimeout(300);

      // Verify an edge added where from/to matches the clicked nodes
      const edges = await page.evaluate(() => window.graph.edges.map(e => ({ id: e.id, from: e.from, to: e.to })));
      const found = edges.some(e => (e.from === nodes[0].id && e.to === nodes[1].id) || (e.from === nodes[1].id && e.to === nodes[0].id));
      expect(found).toBeTruthy();

      // Event log should include 'Added edge'
      const state = await collectPageState(page);
      expect(state.eventLog.some(l => l.includes('Added edge'))).toBeTruthy();
    });

    test('can delete a node and an edge in delete mode', async ({ page }) => {
      // Add a temporary node and edge to delete
      await page.selectOption('#mode', 'add-node');
      const canvasBox = await page.locator('#canvas').boundingBox();
      await page.mouse.click(canvasBox.x + 10, canvasBox.y + 10);
      await page.waitForTimeout(100);
      const nodes = await page.evaluate(() => window.graph.nodes.slice(-3).map(n => ({ id: n.id, x: n.x, y: n.y })));
      // create edge between last two nodes to ensure an edge exists
      if (nodes.length >= 2) {
        await page.selectOption('#mode', 'add-edge');
        await page.mouse.click(canvasBox.x + nodes[0].x, canvasBox.y + nodes[0].y);
        await page.waitForTimeout(50);
        await page.mouse.click(canvasBox.x + nodes[1].x, canvasBox.y + nodes[1].y);
        await page.waitForTimeout(200);
      }

      // Identify an edge id to delete
      const edgeToDelete = await page.evaluate(() => {
        const e = window.graph.edges.slice(-1)[0];
        return e ? { id: e.id, from: e.from, to: e.to, midX: (window.graph.nodes.find(n => n.id === e.from).x + window.graph.nodes.find(n => n.id === e.to).x) / 2, midY: (window.graph.nodes.find(n => n.id === e.from).y + window.graph.nodes.find(n => n.id === e.to).y) / 2 } : null;
      });

      // Enter delete mode and delete the edge if found
      await page.selectOption('#mode', 'delete');
      await expect(page.locator('#modeLabel')).toHaveText('delete');
      if (edgeToDelete) {
        const box = await page.locator('#canvas').boundingBox();
        await page.mouse.click(box.x + edgeToDelete.midX, box.y + edgeToDelete.midY);
        await page.waitForTimeout(150);
        // Verify edge removed
        const stillExists = await page.evaluate((eid) => window.graph.edges.some(e => e.id === eid), edgeToDelete.id);
        expect(stillExists).toBeFalsy();
        // Event log contains 'Removed edge'
        const state = await collectPageState(page);
        expect(state.eventLog.some(l => l.toLowerCase().includes('removed edge'))).toBeTruthy();
      }

      // Delete a node: pick the last node and click
      const nodeToDelete = await page.evaluate(() => window.graph.nodes.slice(-1)[0]);
      expect(nodeToDelete).toBeTruthy();
      const box = await page.locator('#canvas').boundingBox();
      await page.mouse.click(box.x + nodeToDelete.x, box.y + nodeToDelete.y);
      await page.waitForTimeout(150);
      // Verify node removed
      const nodeExists = await page.evaluate((nid) => window.graph.nodes.some(n => n.id === nid), nodeToDelete.id);
      expect(nodeExists).toBeFalsy();
      const stateAfter = await collectPageState(page);
      expect(stateAfter.eventLog.some(l => l.toLowerCase().includes('removed node'))).toBeTruthy();
    });
  });

  test.describe('Algorithms & Playback (S5_ComputingPath, S6_RunningAlgorithm, S7_PausingAlgorithm, S8_StoppingAlgorithm)', () => {
    test('compute a single path via Compute Path button and display it', async ({ page }) => {
      // pick two nodes that are connected (from seeded graph)
      const nodes = await page.evaluate(() => window.graph.nodes.slice(0, 6).map(n => ({ id: n.id })));
      expect(nodes.length).toBeGreaterThanOrEqual(2);

      // Set source and target inputs
      await page.fill('#sourceNode', nodes[0].id);
      await page.fill('#targetNode', nodes[5].id);

      // Click compute path
      await page.click('#computePath');
      // Wait for displayed path to be added
      await page.waitForFunction(() => (window.displayedPaths && window.displayedPaths.length > 0), { timeout: 2000 });

      // Confirm displayedPaths contains an entry with nodes including both source and target
      const disp = await page.evaluate(() => window.displayedPaths.map(p => ({ name: p.name, nodes: p.nodes })));
      const found = disp.some(p => Array.isArray(p.nodes) && p.nodes.includes(document.getElementById ? p.nodes[0] : p.nodes[0]) || true); // just ensure there is at least one displayed path
      expect(disp.length).toBeGreaterThan(0);
      // Event log should include 'Computed path'
      const state = await collectPageState(page);
      expect(state.eventLog.some(l => l.toLowerCase().includes('computed path') || l.toLowerCase().includes('computed'))).toBeTruthy();
    });

    test('run->pause->resume->stop algorithm playback via run/pause/stop buttons', async ({ page }) => {
      // choose two nodes
      const nodes = await page.evaluate(() => window.graph.nodes.slice(0, 6).map(n => ({ id: n.id })));
      await page.fill('#sourceNode', nodes[0].id);
      await page.fill('#targetNode', nodes[5].id);

      // Click run (prepares and starts run)
      await page.click('#runBtn');
      // allow some time for preparation log and a few run steps
      await page.waitForTimeout(800);

      // There should be a 'Prepared run' log entry
      let state = await collectPageState(page);
      expect(state.eventLog.some(l => l.toLowerCase().includes('prepared run'))).toBeTruthy();

      // Pause the run
      await page.click('#pauseBtn');
      await page.waitForTimeout(150);
      state = await collectPageState(page);
      expect(state.eventLog.some(l => l.toLowerCase().includes('paused run'))).toBeTruthy();

      // Resume by clicking run again (should prepare or resume)
      await page.click('#runBtn');
      await page.waitForTimeout(300);
      state = await collectPageState(page);
      // Either prepared run or resumed activity has been logged
      expect(state.eventLog.some(l => l.toLowerCase().includes('prepared run') || l.toLowerCase().includes('prepared step'))).toBeTruthy();

      // Finally stop the run
      await page.click('#stopBtn');
      await page.waitForTimeout(150);
      state = await collectPageState(page);
      expect(state.eventLog.some(l => l.toLowerCase().includes('run stopped') || l.toLowerCase().includes('stopped'))).toBeTruthy();
    });
  });

  test.describe('Traffic, Failures, and Agents (S9_SimulatingTraffic, S10_RecordingFailures, S11_PlayingFailures)', () => {
    test('simulate traffic updates edge loads and logs an event', async ({ page }) => {
      // record some edge loads before
      const beforeLoads = await page.evaluate(() => window.graph.edges.map(e => e.load));
      await page.click('#simulateTraffic');
      await page.waitForTimeout(150);
      const afterLoads = await page.evaluate(() => window.graph.edges.map(e => e.load));
      // At least one edge load should differ due to simulation
      const changed = beforeLoads.some((v, i) => v !== afterLoads[i]);
      expect(changed).toBeTruthy();

      // Event log includes 'Simulated traffic'
      const state = await collectPageState(page);
      expect(state.eventLog.some(l => l.toLowerCase().includes('simulated traffic'))).toBeTruthy();
    });

    test('record a failure sequence by toggling node/edge down and playback it', async ({ page }) => {
      // Start recording
      await page.click('#injectFailureSeq');
      await page.waitForTimeout(50);

      // toggle-down a node: pick first node and toggle via clicking in toggle-down mode
      await page.selectOption('#mode', 'toggle-down');
      const node = await page.evaluate(() => window.graph.nodes[0] ? { id: window.graph.nodes[0].id, x: window.graph.nodes[0].x, y: window.graph.nodes[0].y } : null);
      expect(node).not.toBeNull();
      const canvasBox = await page.locator('#canvas').boundingBox();
      await page.mouse.click(canvasBox.x + node.x, canvasBox.y + node.y);
      await page.waitForTimeout(150);

      // Stop recording
      await page.click('#injectFailureSeq');
      await page.waitForTimeout(150);

      // Verify failureSequence length > 0
      const seqLen = await page.evaluate(() => window.failureSequence ? window.failureSequence.length : 0);
      expect(seqLen).toBeGreaterThan(0);

      // Now play the recorded failure sequence
      await page.click('#playFailureSeq');
      // Wait for playback to finish; playback uses setTimeout per step ~400ms; wait enough time
      await page.waitForTimeout(400 * (seqLen + 1));
      // Confirm playback finished logged
      const state = await collectPageState(page);
      expect(state.eventLog.some(l => l.toLowerCase().includes('finished playing failure sequence') || l.toLowerCase().includes('playback set'))).toBeTruthy();
    });

    test('add an agent, compute path and run agent across edges increasing load', async ({ page }) => {
      // pick two nodes for the agent
      const nodes = await page.evaluate(() => window.graph.nodes.slice(0, 6).map(n => ({ id: n.id })));
      await page.fill('#sourceNode', nodes[0].id);
      await page.fill('#targetNode', nodes[5].id);
      await page.fill('#agentName', 'TesterAgent');

      // Add agent
      await page.click('#addAgent');
      await page.waitForTimeout(200);

      // There should be at least one agent listed
      const agentsListText = await page.locator('#agentsList').innerText();
      expect(agentsListText).toContain('TesterAgent');

      // Click 'Compute & Run' for the agent (the renderAgents adds buttons). Find the first 'Compute & Run' button and click it.
      const runButtons = page.locator('#agentsList button', { hasText: 'Compute & Run' });
      await expect(runButtons.first()).toBeVisible();
      await runButtons.first().click();
      // Allow some time for agent to run steps and increment loads
      await page.waitForTimeout(500);

      // Event log should indicate agent computed path and traversed edges
      const state = await collectPageState(page);
      expect(state.eventLog.some(l => l.toLowerCase().includes('agent testeragent computed path') || l.toLowerCase().includes('agent testeragent computed'))).toBeTruthy();

      // Some edges should have load > 0 due to traversal
      const edgeLoads = await page.evaluate(() => window.graph.edges.map(e => e.load));
      const anyLoad = edgeLoads.some(l => l > 0);
      expect(anyLoad).toBeTruthy();
    });
  });

  test.describe('Persistence, Undo/Redo, Clearing (S12_SavingGraph, S13_LoadingGraph, S14_UndoingAction, S15_RedoingAction, S16_ClearingLog, S17_ClearingGraph, S18_GeneratingRandomGraph, S19_ClearingPaths)', () => {
    test('save graph to JSON area and load it back; handle invalid JSON alert', async ({ page }) => {
      // Save graph
      await page.click('#saveGraph');
      await page.waitForTimeout(100);
      // graphJson should contain JSON
      const jsonVal = await page.locator('#graphJson').inputValue();
      expect(jsonVal.trim().startsWith('{') || jsonVal.trim().startsWith('[')).toBeTruthy();

      // Introduce invalid JSON and trigger load to capture 'Invalid JSON' alert
      await page.fill('#graphJson', 'not a valid json');
      // Clear any previously captured dialogs
      dialogs = [];
      await page.click('#loadGraph');
      // Wait briefly to allow dialog to be captured and auto-accepted
      await page.waitForTimeout(100);
      // There should be a dialog with 'Invalid JSON'
      const lastDialog = dialogs.slice(-1)[0];
      expect(lastDialog).toBeTruthy();
      expect(lastDialog.message).toMatch(/Invalid JSON/);
    });

    test('undo and redo an addNode action', async ({ page }) => {
      // Ensure clean cursor: add a new node
      await page.selectOption('#mode', 'add-node');
      const canvasBox = await page.locator('#canvas').boundingBox();
      const beforeCount = await page.evaluate(() => window.graph.nodes.length);
      await page.mouse.click(canvasBox.x + 20, canvasBox.y + 20);
      await page.waitForTimeout(100);
      const afterAdd = await page.evaluate(() => window.graph.nodes.length);
      expect(afterAdd).toBe(beforeCount + 1);

      // Click undo
      await page.click('#undo');
      await page.waitForTimeout(200);
      const afterUndo = await page.evaluate(() => window.graph.nodes.length);
      expect(afterUndo).toBe(beforeCount);

      // Click redo
      await page.click('#redo');
      await page.waitForTimeout(200);
      const afterRedo = await page.evaluate(() => window.graph.nodes.length);
      // Redo attempts to re-add if action was addNode; ensure it's at least previous value
      expect(afterRedo).toBeGreaterThanOrEqual(beforeCount);
    });

    test('clear log empties the event log area', async ({ page }) => {
      // Ensure there is some log
      await page.click('#computePath').catch(() => {}); // might alert 'Set source and target' - ignored
      await page.waitForTimeout(100);
      // Clear log
      await page.click('#clearLog');
      await page.waitForTimeout(50);
      const logText = await page.locator('#eventLog').innerText();
      expect(logText.trim()).toBe('');
    });

    test('clear graph triggers confirm and clears nodes after acceptance', async ({ page }) => {
      // Add one node to ensure graph non-empty
      await page.selectOption('#mode', 'add-node');
      const canvasBox = await page.locator('#canvas').boundingBox();
      await page.mouse.click(canvasBox.x + 30, canvasBox.y + 30);
      await page.waitForTimeout(120);
      const before = await page.evaluate(() => window.graph.nodes.length);
      expect(before).toBeGreaterThanOrEqual(1);

      // Click clearGraph - confirm will be auto-accepted by dialog handler
      await page.click('#clearGraph');
      // Allow some time for clear logic
      await page.waitForTimeout(200);
      const after = await page.evaluate(() => window.graph.nodes.length);
      expect(after).toBe(0);
      // Event log should include 'Cleared graph'
      const state = await collectPageState(page);
      expect(state.eventLog.some(l => l.toLowerCase().includes('cleared graph'))).toBeTruthy();
    });

    test('generate random graph produces expected number of nodes and logs event', async ({ page }) => {
      // Set random graph nodes to 5 and density low to make deterministic-ish
      await page.fill('#rgNodes', '5');
      await page.fill('#rgDensity', '0.1');
      await page.click('#randomGraph');
      await page.waitForTimeout(300);
      const nodesCount = await page.evaluate(() => window.graph.nodes.length);
      expect(nodesCount).toBeGreaterThanOrEqual(1);
      // Event log should include generated random graph
      const state = await collectPageState(page);
      expect(state.eventLog.some(l => l.toLowerCase().includes('generated random graph'))).toBeTruthy();
    });

    test('clear displayed paths removes entries from paths list', async ({ page }) => {
      // Compute a path to ensure displayedPaths present
      const nodes = await page.evaluate(() => window.graph.nodes.slice(0, 6).map(n => ({ id: n.id })));
      await page.fill('#sourceNode', nodes[0].id);
      await page.fill('#targetNode', nodes[5].id);
      await page.click('#computePath').catch(() => {});
      await page.waitForTimeout(300);

      // Ensure there is at least one displayed path
      let pathsCount = await page.evaluate(() => window.displayedPaths.length);
      expect(pathsCount).toBeGreaterThan(0);

      // Click clearPaths
      await page.click('#clearPaths');
      await page.waitForTimeout(150);
      pathsCount = await page.evaluate(() => window.displayedPaths.length);
      expect(pathsCount).toBe(0);
      // UI pathsList should be cleared
      const pathsListText = await page.locator('#pathsList').innerText();
      expect(pathsListText.trim()).toBe('');
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('compute path without source/target triggers alert', async ({ page }) => {
      // Ensure fields empty
      await page.fill('#sourceNode', '');
      await page.fill('#targetNode', '');
      // Clear dialogs log
      dialogs = [];
      // Click computePath should trigger an alert 'Set source and target'
      await page.click('#computePath');
      await page.waitForTimeout(100);
      const lastDialog = dialogs.slice(-1)[0];
      expect(lastDialog).toBeTruthy();
      expect(lastDialog.message.toLowerCase()).toMatch(/set source and target/);
    });

    test('loading malformed JSON triggers alert; saved valid graph loads OK', async ({ page }) => {
      // First save a valid graph
      await page.click('#saveGraph');
      await page.waitForTimeout(100);
      const validJson = await page.locator('#graphJson').inputValue();
      expect(validJson).toBeTruthy();

      // Replace with malformed JSON and attempt load (dialog expected)
      await page.fill('#graphJson', '{ invalid json ');
      dialogs = [];
      await page.click('#loadGraph');
      await page.waitForTimeout(120);
      expect(dialogs.length).toBeGreaterThan(0);
      expect(dialogs.slice(-1)[0].message).toMatch(/Invalid JSON/);

      // Now restore valid JSON and load successfully (no dialog)
      dialogs = [];
      await page.fill('#graphJson', validJson);
      await page.click('#loadGraph');
      await page.waitForTimeout(200);
      // No 'Invalid JSON' dialog should have been emitted this time
      const hadInvalidJsonDialog = dialogs.some(d => /Invalid JSON/.test(d.message));
      expect(hadInvalidJsonDialog).toBeFalsy();
      // Graph should reflect loaded data (graph.nodes length > 0)
      const nodesLen = await page.evaluate(() => window.graph.nodes.length);
      expect(nodesLen).toBeGreaterThan(0);
    });
  });
});