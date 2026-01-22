import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b41382-d5c2-11f0-9651-0f1ae31ac260.html';

// Helper: click on canvas at coordinates (x,y) relative to canvas top-left
async function clickCanvasAt(page, x, y) {
  await page.click('#graphCanvas', { position: { x, y } });
}

// Helper: read info region text trimmed
async function infoText(page) {
  return (await page.locator('#info').innerText()).trim();
}

test.describe('Prim\'s Algorithm Visualization - FSM state and transition tests', () => {
  // Collect console messages and page errors for assertions
  test.beforeEach(async ({ page }) => {
    // Listen to console messages
    page.context().on('page', () => {}); // ensure context exists; noop to avoid linter warnings
    page.on('console', msg => {
      // Keep console output in test traces for debugging
      // Do not modify page environment; just log to playwright output
      // eslint-disable-next-line no-console
      console.log(`[console:${msg.type()}] ${msg.text()}`);
    });

    // Fail fast if any pageerror occurs - but we will collect and assert later
    page.on('pageerror', err => {
      // eslint-disable-next-line no-console
      console.error('[pageerror]', err);
    });

    await page.goto(APP_URL);
    // Ensure page fully initialized via expected DOM controls
    await expect(page.locator('#graphCanvas')).toBeVisible();
    await expect(page.locator('#runPrim')).toBeVisible();
    await expect(page.locator('#resetGraph')).toBeVisible();
    await expect(page.locator('#clearMST')).toBeVisible();
    await expect(page.locator('#startNodeSelect')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    // nothing to teardown specifically; page will be closed by Playwright runner
  });

  test('S0 Idle on load: resetGraph() should be executed and initial UI disabled', async ({ page }) => {
    // Validate initial "Idle" state after page load
    const info = await infoText(page);
    // The implementation calls resetGraph() on load which sets this text
    expect(info).toContain('Graph reset. Add new nodes by clicking on the canvas.');

    // startNodeSelect and runPrim should be disabled, clearMST disabled
    const startDisabled = await page.locator('#startNodeSelect').getAttribute('disabled');
    expect(startDisabled).not.toBeNull(); // disabled attribute present

    const runDisabled = await page.locator('#runPrim').getAttribute('disabled');
    expect(runDisabled).not.toBeNull();

    const clearDisabled = await page.locator('#clearMST').getAttribute('disabled');
    expect(clearDisabled).not.toBeNull();
  });

  test('S1 Adding Node: clicking empty canvas adds nodes and enables controls', async ({ page }) => {
    // Add two nodes
    await clickCanvasAt(page, 60, 80);
    // After adding first node, info should mention Node 1 added
    let info = await infoText(page);
    expect(info).toContain('Node 1 added');

    // Add second node
    await clickCanvasAt(page, 180, 80);
    info = await infoText(page);
    expect(info).toContain('Node 2 added');

    // startNodeSelect should now be enabled and contain 2 options
    const select = page.locator('#startNodeSelect');
    expect(await select.getAttribute('disabled')).toBeNull();
    const options = await select.locator('option').allInnerTexts();
    expect(options.length).toBeGreaterThanOrEqual(2);
    expect(options[0]).toContain('Node 1');
    expect(options[1]).toContain('Node 2');

    // runPrim button should be enabled now
    expect(await page.locator('#runPrim').getAttribute('disabled')).toBeNull();
  });

  test('S2 Selecting First Node then S3 Creating Edge: create edge via prompt and verify edge added', async ({ page }) => {
    // Add two nodes first
    await clickCanvasAt(page, 70, 120);  // Node 1
    await clickCanvasAt(page, 200, 120); // Node 2

    // Select first node to start edge creation (enter S2_SelectingFirstNode)
    await clickCanvasAt(page, 70, 120);
    let info = await infoText(page);
    expect(info).toContain('Selected Node 1 as first node for edge');

    // Prepare to handle the prompt for weight; accept with "3"
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('prompt');
      await dialog.accept('3');
    });

    // Click second node to trigger prompt and add edge (enter S3_CreatingEdge -> back to S1_AddingNode)
    await clickCanvasAt(page, 200, 120);

    // After edge creation, check info text about edge added
    info = await infoText(page);
    expect(info).toContain('Edge added between node 1 and node 2 with weight 3.');

    // Edge creation should have reset the edge selection state (indirect check: selecting a node again should select fresh)
    // Click Node 1 again to ensure we can start edge creation anew
    await clickCanvasAt(page, 70, 120);
    info = await infoText(page);
    expect(info).toContain('Selected Node 1 as first node for edge');
  });

  test('Edge creation edge-cases: self-loop click cancels and duplicate edge triggers alert', async ({ page }) => {
    // Add two nodes
    await clickCanvasAt(page, 120, 200); // Node 1
    await clickCanvasAt(page, 240, 200); // Node 2

    // Create an edge Node1-Node2 with weight 4
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('prompt');
      await dialog.accept('4');
    });
    await clickCanvasAt(page, 120, 200); // select node1
    await clickCanvasAt(page, 240, 200); // select node2 and prompt

    let info = await infoText(page);
    expect(info).toContain('Edge added between node 1 and node 2 with weight 4.');

    // Now attempt self-loop: select Node1 then click Node1 again
    await clickCanvasAt(page, 120, 200); // select node1
    await clickCanvasAt(page, 120, 200); // click same node => should cancel
    info = await infoText(page);
    expect(info).toContain('You must select a different second node to create edge. Operation cancelled.');

    // Now attempt to create duplicate edge Node1-Node2
    // This will prompt for weight and then show an alert about duplicate. Handle both dialogs.
    // First the prompt for weight (we accept), then the alert (we accept).
    page.once('dialog', async dialog => {
      // First dialog: prompt
      expect(dialog.type()).toBe('prompt');
      await dialog.accept('5');
    });

    // The alert that reports duplicate will be shown after prompt -> handle it with another once
    page.once('dialog', async dialog => {
      // This should be an alert
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toMatch(/Edge already exists|invalid/i);
      await dialog.accept();
    });

    // Start selection and click second node to attempt adding duplicate
    await clickCanvasAt(page, 120, 200); // select node1
    await clickCanvasAt(page, 240, 200); // attempt to add duplicate edge
    // After duplicate attempt, the app resets edge creation; verify we're back to idle-like message or similar
    info = await infoText(page);
    expect(info).toMatch(/Ready to add new edges|Edge added|cancelled|must select/i);
  });

  test('S4 Running Prim: run Prim on connected graph and verify MST result and Clear MST enabled', async ({ page }) => {
    // Build a connected graph: 3 nodes with two edges (1-2 weight 3, 2-3 weight 2)
    await clickCanvasAt(page, 80, 260);  // Node 1
    await clickCanvasAt(page, 200, 260); // Node 2
    await clickCanvasAt(page, 320, 260); // Node 3

    // Edge 1-2 weight 3
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('prompt');
      await dialog.accept('3');
    });
    await clickCanvasAt(page, 80, 260);  // select node1
    await clickCanvasAt(page, 200, 260); // click node2 to add edge

    // Edge 2-3 weight 2
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('prompt');
      await dialog.accept('2');
    });
    await clickCanvasAt(page, 200, 260); // select node2
    await clickCanvasAt(page, 320, 260); // click node3 to add edge

    // Select start node = Node 1 and click Run Prim's Algorithm
    await page.selectOption('#startNodeSelect', '1');

    // Run prim and assert expected information. No dialogs expected here.
    await page.click('#runPrim');

    // After running, info should contain total cost of MST (3 + 2 = 5)
    const info = await infoText(page);
    expect(info).toContain("Prim's algorithm completed");
    expect(info).toContain('Total cost of MST: 5');

    // Clear MST button should now be enabled
    expect(await page.locator('#clearMST').getAttribute('disabled')).toBeNull();
  });

  test('S5 Clearing MST: clear MST resets inMST flags and disables Clear MST button', async ({ page }) => {
    // Build a tiny connected graph, run prim, then clear MST
    await clickCanvasAt(page, 90, 320);  // Node 1
    await clickCanvasAt(page, 220, 320); // Node 2

    // Add edge 1-2 weight 1
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('prompt');
      await dialog.accept('1');
    });
    await clickCanvasAt(page, 90, 320);
    await clickCanvasAt(page, 220, 320);

    // Run Prim
    await page.selectOption('#startNodeSelect', '1');
    await page.click('#runPrim');

    // Ensure Clear MST enabled
    expect(await page.locator('#clearMST').getAttribute('disabled')).toBeNull();

    // Click Clear MST
    await page.click('#clearMST');

    // After clearing, info should mention MST cleared, and clearMST should be disabled
    const info = await infoText(page);
    expect(info).toContain('MST cleared');

    // clearMST disabled now
    const clearedDisabled = await page.locator('#clearMST').getAttribute('disabled');
    expect(clearedDisabled).not.toBeNull();
  });

  test('S6 Resetting Graph: resetGraph() clears nodes/edges after confirm', async ({ page }) => {
    // Add a node so that reset does something
    await clickCanvasAt(page, 140, 380);
    let info = await infoText(page);
    expect(info).toContain('Node 1 added');

    // Confirm dialog should be accepted when clicking Reset Graph
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('confirm');
      await dialog.accept();
    });

    await page.click('#resetGraph');

    // After reset, verify UI is back to initial state
    info = await infoText(page);
    expect(info).toContain('Graph reset. Add new nodes by clicking on the canvas.');

    // startNodeSelect and buttons disabled again
    expect(await page.locator('#startNodeSelect').getAttribute('disabled')).not.toBeNull();
    expect(await page.locator('#runPrim').getAttribute('disabled')).not.toBeNull();
    expect(await page.locator('#clearMST').getAttribute('disabled')).not.toBeNull();
  });

  test('Edge case: Running Prim on disconnected graph should show not connected message', async ({ page }) => {
    // Add two nodes but do not connect them
    await clickCanvasAt(page, 100, 440); // Node 1
    await clickCanvasAt(page, 260, 440); // Node 2

    // Select start node 1 and run prim
    await page.selectOption('#startNodeSelect', '1');
    await page.click('#runPrim');

    // Expect message about graph not connected
    const info = await infoText(page);
    expect(info).toContain('Graph is not connected. MST cannot be formed covering all nodes.');
    // Clear MST button still enabled (per implementation)
    expect(await page.locator('#clearMST').getAttribute('disabled')).toBeNull();
  });

  test('Sanity: ensure no uncaught page errors occurred during interactions', async ({ page }) => {
    // This test will perform a simple interaction sequence and assert no runtime errors were raised to pageerror handler.
    const pageErrors = [];
    const onError = (err) => pageErrors.push(err);
    page.on('pageerror', onError);

    // Simple interactions
    await clickCanvasAt(page, 50, 50);
    await clickCanvasAt(page, 150, 50);

    // Wait a moment for any async errors to surface
    await page.waitForTimeout(200);

    // Remove listener
    page.off('pageerror', onError);

    // Assert there were no page errors (ReferenceError/TypeError/SyntaxError) observed
    expect(pageErrors.length).toBe(0);
  });
});