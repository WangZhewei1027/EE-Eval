import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/1763db72-d5c1-11f0-938c-19d14b60ef51.html';

test.describe('DFS Visualization FSM (Application ID: 1763db72-d5c1-11f0-938c-19d14b60ef51)', () => {
  // Arrays to capture console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  // Setup before each test: navigate to the app and wire up console/pageerror listeners
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // capture console messages for later assertions
      try {
        consoleMessages.push(msg.text());
      } catch (e) {
        consoleMessages.push(`<unserializable console message: ${e.message}>`);
      }
    });

    page.on('pageerror', err => {
      // capture runtime errors (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL);
  });

  // Teardown: on failure we still keep the captured logs for Playwright reporter
  test.afterEach(async ({}, testInfo) => {
    // Attach some basic debug info to test report for easier inspection if needed
    testInfo.attach('console-messages', { body: consoleMessages.join('\n'), contentType: 'text/plain' });
    if (pageErrors.length) {
      testInfo.attach('page-errors', { body: pageErrors.map(e => String(e)).join('\n\n'), contentType: 'text/plain' });
    }
  });

  test('S0_Idle: Initial Idle state renders Start button and all node elements', async ({ page }) => {
    // Validate initial "Idle" state: Start button exists and nodes A-F are rendered
    // This corresponds to the S0_Idle state's entry action renderPage()
    const startButton = page.locator('#start');
    await expect(startButton).toBeVisible();
    await expect(startButton).toHaveText('Start DFS');

    // Expect six node elements with ids A..F to be present
    const nodeIds = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (const id of nodeIds) {
      const node = page.locator(`#${id}`);
      await expect(node).toBeVisible();
      await expect(node).toHaveClass(/node/); // class includes 'node'
      // Nodes should not be visited in Idle state
      const classAttr = await node.getAttribute('class');
      expect(classAttr).not.toContain('visited');
    }

    // No runtime errors should have happened on initial render
    expect(pageErrors.length).toBe(0);
  });

  test('S0 -> S1 Transition: Clicking Start triggers DFS Running and logs traversal', async ({ page }) => {
    // This test validates the event StartDFS and the transition to DFS Running (S1)
    // We click the #start button, then assert console output matches the DFS traversal order.
    // Also assert no unexpected runtime errors occurred during the traversal.

    // Start listening for console messages already done in beforeEach
    const startButton = page.locator('#start');
    await expect(startButton).toBeVisible();

    // Click Start to trigger dfs(nodes[0], visitedNodes)
    await startButton.click();

    // Wait for the expected number of console logs produced by the DFS traversal
    // The graph and dfs implementation should log one entry per node visited.
    // Expected DFS order: A, B, D, E, F, C
    const expectedOrder = ['A', 'B', 'D', 'E', 'F', 'C'];

    // Wait for consoleMessages to accumulate at least the number of expected messages
    await page.waitForFunction(
      (expectedCount) => window.__console_capture_placeholder__ === undefined || true,
      expectedOrder.length // dummy param to ensure playwright waits; actual waiting below relies on polling
    );

    // Polling loop: wait up to a reasonable timeout for console messages to reach expected count
    const deadline = Date.now() + 3000; // 3s timeout
    while (consoleMessages.length < expectedOrder.length && Date.now() < deadline) {
      // small delay
      // eslint-disable-next-line no-await-in-loop
      await new Promise(r => setTimeout(r, 50));
    }

    // Now assert the console messages include the expected traversal in order.
    // The page's console messages may include other logs, so we find the first occurrence of 'A' and compare sequence.
    const joined = consoleMessages.join('\n');
    // Extract the sequence of single-letter logs in order
    const letterLogs = consoleMessages.filter(text => /^[A-F]$/.test(text));

    expect(letterLogs.length).toBeGreaterThanOrEqual(expectedOrder.length);
    // Compare first six letter logs to expected order
    const firstSix = letterLogs.slice(0, expectedOrder.length);
    expect(firstSix).toEqual(expectedOrder);

    // Verify that S1 entry action effectively ran by observing that nodes eventually became visited.
    for (const id of expectedOrder) {
      const locator = page.locator(`#${id}`);
      // Wait for the visited class to appear (Node Visited state S2)
      await expect(locator).toHaveClass(/visited/);
    }

    // Ensure no runtime page errors occurred
    expect(pageErrors.length).toBe(0);
  });

  test('S1 -> S2 Transition: Individual node becomes visited when DFS reaches it', async ({ page }) => {
    // Validate that when DFS runs, individual nodes enter the "visited" state (S2_Node_Visited)
    // We'll click Start and assert that node 'A' gets the visited class quickly (onEnter action).
    const nodeA = page.locator('#A');
    await expect(nodeA).toBeVisible();

    // Before starting, ensure A is not visited
    let cls = await nodeA.getAttribute('class');
    expect(cls).not.toContain('visited');

    // Click Start to begin DFS
    await page.locator('#start').click();

    // Wait specifically for node A to get the visited class as evidence of S2_Node_Visited
    await page.waitForSelector('#A.visited', { timeout: 2000 });

    // Assert node A indeed has the visited class
    cls = await nodeA.getAttribute('class');
    expect(cls).toContain('visited');

    // Also check that the console logged 'A' at some point
    expect(consoleMessages).toContain('A');

    // No runtime errors for this transition
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Clicking Start multiple times does not throw errors and visited state persists', async ({ page }) => {
    // Clicking Start again should re-run DFS but should not cause uncaught errors.
    // The nodes should still end up visited and we should observe repeated logs.
    const start = page.locator('#start');

    // First click
    await start.click();

    // Wait for initial traversal logs
    const deadline1 = Date.now() + 2000;
    while (consoleMessages.filter(t => /^[A-F]$/.test(t)).length < 6 && Date.now() < deadline1) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise(r => setTimeout(r, 50));
    }

    const firstPassCount = consoleMessages.filter(t => /^[A-F]$/.test(t)).length;
    expect(firstPassCount).toBeGreaterThanOrEqual(6);

    // Click Start again
    await start.click();

    // Wait for additional logs from second run (at least another 6 logs)
    const deadline2 = Date.now() + 3000;
    while (consoleMessages.filter(t => /^[A-F]$/.test(t)).length < 12 && Date.now() < deadline2) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise(r => setTimeout(r, 50));
    }

    const totalLetterLogs = consoleMessages.filter(t => /^[A-F]$/.test(t)).length;
    expect(totalLetterLogs).toBeGreaterThanOrEqual(12);

    // After multiple runs, all nodes should still be marked visited
    const nodeIds = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (const id of nodeIds) {
      const node = page.locator(`#${id}`);
      const classAttr = await node.getAttribute('class');
      expect(classAttr).toContain('visited');
    }

    // No unhandled page errors occurred during repeated starts
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Interacting with node elements before starting DFS does not cause errors', async ({ page }) => {
    // Clicking a node prior to starting DFS should not raise runtime errors or change visited classes
    const nodeB = page.locator('#B');
    await expect(nodeB).toBeVisible();

    // Click node B before start
    await nodeB.click();

    // Node B should still not be visited because DFS hasn't run
    const classAttrBefore = await nodeB.getAttribute('class');
    expect(classAttrBefore).not.toContain('visited');

    // Ensure no page errors after this interaction
    expect(pageErrors.length).toBe(0);

    // Now start the DFS to ensure normal behavior still works afterward
    await page.locator('#start').click();

    // Wait for traversal completion
    const deadline = Date.now() + 2000;
    while (consoleMessages.filter(t => /^[A-F]$/.test(t)).length < 6 && Date.now() < deadline) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise(r => setTimeout(r, 50));
    }

    // All nodes should now be visited
    const nodeIds = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (const id of nodeIds) {
      const cls = await page.locator(`#${id}`).getAttribute('class');
      expect(cls).toContain('visited');
    }

    expect(pageErrors.length).toBe(0);
  });

  test('Observability: Capture and assert console logs and absence of runtime errors for full run', async ({ page }) => {
    // This test explicitly demonstrates capturing console output and runtime errors as required.
    // Click Start to run DFS
    await page.locator('#start').click();

    // Wait for expected console log sequence
    const expectedOrder = ['A', 'B', 'D', 'E', 'F', 'C'];
    const deadline = Date.now() + 3000;
    while (consoleMessages.filter(t => /^[A-F]$/.test(t)).length < expectedOrder.length && Date.now() < deadline) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise(r => setTimeout(r, 50));
    }

    const letterLogs = consoleMessages.filter(text => /^[A-F]$/.test(text)).slice(0, expectedOrder.length);
    expect(letterLogs).toEqual(expectedOrder);

    // Assert that there were no page-level errors captured during the entire interaction
    expect(pageErrors.length).toBe(0);
  });
});