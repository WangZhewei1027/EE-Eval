import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3ad621-d360-11f0-b42e-71f0e7238799.html';

test.describe('Weighted Graph Demo FSM (Application ID: 7b3ad621-d360-11f0-b42e-71f0e7238799)', () => {
  // Shared variables for capturing page errors and console messages
  let pageErrors;
  let pageConsoleMessages;

  test.beforeEach(async ({ page }) => {
    // Initialize containers for captured errors/messages
    pageErrors = [];
    pageConsoleMessages = [];

    // Capture uncaught exceptions from the page (we must let them occur naturally)
    page.on('pageerror', (err) => {
      // Store the Error object for assertions
      pageErrors.push(err);
    });

    // Capture console messages for additional evidence (if any)
    page.on('console', (msg) => {
      pageConsoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'networkidle' });

    // Ensure the canvas element is present before each test
    await expect(page.locator('#graphCanvas')).toBeVisible();
  });

  test.afterEach(async () => {
    // Nothing to tear down explicitly; listeners are per-page and cleared automatically.
  });

  test('Initial Idle state (S0_Idle): canvas exists and no nodes/edges present', async ({ page }) => {
    // This validates the initial Idle state: canvas present and the global node/edge structures are empty.
    // Access global variables declared by the page's script (nodes, edges, nodeCounter).
    const initialState = await page.evaluate(() => {
      return {
        hasCanvas: !!document.getElementById('graphCanvas'),
        nodesLength: typeof nodes !== 'undefined' ? nodes.length : null,
        edgesLength: typeof edges !== 'undefined' ? edges.length : null,
        nodeCounter: typeof nodeCounter !== 'undefined' ? nodeCounter : null
      };
    });

    // Assertions for expected initial conditions
    expect(initialState.hasCanvas).toBe(true);
    expect(initialState.nodesLength).toBe(0);
    expect(initialState.edgesLength).toBe(0);
    expect(initialState.nodeCounter).toBe(0);

    // There should be no uncaught page errors at initial load
    expect(pageErrors.length).toBe(0);
  });

  test('Create a node by clicking on the canvas transitions to NodeCreated (S1_NodeCreated)', async ({ page }) => {
    // This validates that clicking on the canvas creates a new node (S0 -> S1).
    const clickPos = { x: 100, y: 100 };

    // Click the canvas at the specified position
    await page.click('#graphCanvas', { position: clickPos });

    // Read the nodes array from the page to confirm the node was created
    const nodeData = await page.evaluate(() => {
      return {
        nodesLength: nodes.length,
        node0: nodes[0] ? { id: nodes[0].id, x: nodes[0].x, y: nodes[0].y } : null,
        nodeCounter: nodeCounter
      };
    });

    // Expect one node created with id 0 and coordinates close to the click position
    expect(nodeData.nodesLength).toBe(1);
    expect(nodeData.node0).not.toBeNull();
    expect(nodeData.node0.id).toBe(0);
    // Coordinates are set from event.offsetX/Y, which should match the click position
    expect(nodeData.node0.x).toBe(clickPos.x);
    expect(nodeData.node0.y).toBe(clickPos.y);
    expect(nodeData.nodeCounter).toBe(1);

    // Ensure no uncaught exceptions occurred during node creation
    expect(pageErrors.length).toBe(0);
  });

  test('Clicking the same node should prompt for weight; accepting prompt triggers a runtime ReferenceError due to bug (S1 -> S2 attempt)', async ({ page }) => {
    // This test reproduces the transition attempt from NodeCreated to EdgeCreated.
    // The implementation contains a bug: it references `newNode` inside the edge creation branch where it's not defined.
    // We must observe the prompt, accept it, and assert that a ReferenceError is thrown and no edge is created.

    const clickPos = { x: 200, y: 80 };

    // Step 1: Create a node at clickPos
    await page.click('#graphCanvas', { position: clickPos });

    // Confirm node created
    const nodesAfterCreation = await page.evaluate(() => nodes.length);
    expect(nodesAfterCreation).toBe(1);

    // Prepare to handle the prompt by accepting with a value "5"
    page.once('dialog', async (dialog) => {
      // The dialog should be a prompt asking for weight
      expect(dialog.type()).toBe('prompt');
      // Accept with a numeric string
      await dialog.accept('5');
    });

    // Now click the same position to trigger the "connect" action and the prompt
    await page.click('#graphCanvas', { position: clickPos });

    // Wait briefly to allow any uncaught exception to propagate to the pageerror handler
    await page.waitForTimeout(200);

    // We expect at least one page error due to ReferenceError: newNode is not defined
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    // Check that at least one error mentions the missing identifier
    const messages = pageErrors.map(e => (e && e.message ? e.message : String(e)));
    expect(messages.some(m => /newNode/i.test(m) || /is not defined/i.test(m))).toBe(true);

    // Because the edge creation code failed with a runtime error, edges should remain empty
    const edgesLength = await page.evaluate(() => edges.length);
    expect(edgesLength).toBe(0);

    // Nodes should remain unchanged (still only the first node)
    const nodesLength = await page.evaluate(() => nodes.length);
    expect(nodesLength).toBe(1);
  });

  test('Clicking the same node and dismissing the prompt results in no edge and no runtime error', async ({ page }) => {
    // This test ensures that if the user cancels the prompt, the faulty edge creation code path that references newNode is not executed.
    const clickPos = { x: 300, y: 120 };

    // Create a node at clickPos
    await page.click('#graphCanvas', { position: clickPos });

    // Confirm a node exists
    expect(await page.evaluate(() => nodes.length)).toBe(1);

    // Handle the prompt by dismissing it (simulate user cancel)
    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('prompt');
      await dialog.dismiss();
    });

    // Click the same position to trigger the prompt, then dismiss it
    await page.click('#graphCanvas', { position: clickPos });

    // Wait a short while to ensure any asynchronous behavior settles
    await page.waitForTimeout(200);

    // No new page errors should have been produced because the block that references newNode should not run when weight is null
    expect(pageErrors.length).toBe(0);

    // No edges should have been created
    expect(await page.evaluate(() => edges.length)).toBe(0);

    // Node count should still be 1
    expect(await page.evaluate(() => nodes.length)).toBe(1);
  });

  test('Create multiple distinct nodes and verify nodes array grows; no edges created unintentionally', async ({ page }) => {
    // This validates creating multiple nodes at different positions (S1 transitions repeated)
    const positions = [
      { x: 50, y: 50 },
      { x: 120, y: 60 },
      { x: 220, y: 200 }
    ];

    for (const pos of positions) {
      await page.click('#graphCanvas', { position: pos });
      // Small delay to allow the click handler to run
      await page.waitForTimeout(50);
    }

    // Verify nodes count equals number of clicks
    const nodesLength = await page.evaluate(() => nodes.length);
    expect(nodesLength).toBe(positions.length);

    // Verify edges are still zero (no accidental edges)
    const edgesLength = await page.evaluate(() => edges.length);
    expect(edgesLength).toBe(0);

    // Ensure no uncaught exceptions occurred during these node creations
    expect(pageErrors.length).toBe(0);
  });

  test('Attempt to create an edge between two different nodes: prompt acceptance triggers the same runtime error due to bug', async ({ page }) => {
    // Create two nodes at two distinct coordinates
    const A = { x: 30, y: 30 };
    const B = { x: 60, y: 60 };

    await page.click('#graphCanvas', { position: A });
    await page.click('#graphCanvas', { position: B });

    // Confirm two nodes created
    expect(await page.evaluate(() => nodes.length)).toBe(2);

    // Now click the first node location to trigger the prompt and attempt an edge creation to the second node.
    // The implementation expects to handle connection when clicking on an existing node; accepting the prompt will execute the buggy code path.
    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('prompt');
      await dialog.accept('7');
    });

    // Clear any existing page errors captured so far
    pageErrors = [];

    // Click at the first node to start an edge creation
    await page.click('#graphCanvas', { position: A });

    // Wait briefly for potential pageerror
    await page.waitForTimeout(200);

    // The buggy implementation tries to push an edge referencing an undefined variable newNode when weight is provided.
    // Assert that a ReferenceError is observed
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const msgTexts = pageErrors.map(e => (e && e.message ? e.message : String(e)));
    expect(msgTexts.some(m => /newNode/i.test(m) || /is not defined/i.test(m))).toBe(true);

    // Ensure edges array remains unchanged due to failure
    expect(await page.evaluate(() => edges.length)).toBe(0);
  });
});