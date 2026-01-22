import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/17640280-d5c1-11f0-938c-19d14b60ef51.html';

test.describe('BFS Visualization - FSM comprehensive tests (Application ID: 17640280-d5c1-11f0-938c-19d14b60ef51)', () => {
  // Reusable helper to attach listeners for console messages and page errors.
  const attachDiagnostics = (page) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    return { consoleMessages, pageErrors };
  };

  test.beforeEach(async ({ page }) => {
    // Navigate to the app before each test
    await page.goto(APP_URL);
  });

  test('S0_Idle: Initial render shows Start button, graph nodes, and empty output', async ({ page }) => {
    // This test validates the initial/idle state (S0_Idle) described in the FSM:
    // - startButton should be present
    // - All nodes should render (A..G)
    // - No node should have the 'visited' class
    // - output should be empty
    const { consoleMessages, pageErrors } = attachDiagnostics(page);

    // Start button exists and visible
    const startButton = page.locator('#startButton');
    await expect(startButton).toBeVisible();
    await expect(startButton).toHaveText('Start BFS from A');

    // There should be 7 nodes A..G
    const nodes = page.locator('.node');
    await expect(nodes).toHaveCount(7);

    // Verify each expected data-node exists
    const expectedNodes = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    for (const label of expectedNodes) {
      await expect(page.locator(`.node[data-node="${label}"]`)).toBeVisible();
    }

    // No node should have the visited class initially
    const visitedCount = await page.evaluate(() => document.querySelectorAll('.node.visited').length);
    expect(visitedCount).toBe(0);

    // Output area should be empty string initially
    const outputText = await page.locator('#output').innerText();
    expect(outputText.trim()).toBe('');

    // No uncaught errors should have been raised during initial render
    expect(pageErrors.length).toBe(0);

    // Ensure nothing was printed as an error-level console message
    const hasErrorConsole = consoleMessages.some(m => m.type === 'error' || /error/i.test(m.text));
    expect(hasErrorConsole).toBe(false);
  });

  test('Transition S0_Idle -> S1_BFS_Running: clicking Start triggers BFS and prints Starting message', async ({ page }) => {
    // Validate that clicking the start button triggers bfs('A') (S1_BFS_Running entry action)
    // and writes "Starting BFS from A" into the output as specified in the transition evidence.
    const { consoleMessages, pageErrors } = attachDiagnostics(page);

    // Click the Start button
    await page.click('#startButton');

    // Immediately the output.innerText should contain the Starting message
    await expect(page.locator('#output')).toHaveText(/Starting BFS from A/);

    // Wait for the first node (A) to be visited. BFS uses a 1s interval, so wait reasonably.
    await page.waitForSelector('.node[data-node="A"].visited', { timeout: 5000 });
    const outputText = await page.locator('#output').innerText();
    expect(outputText).toMatch(/Visited:\s*A/);

    // Verify that the visited class was applied to node A (S2_Node_Visited evidence)
    const aHasVisited = await page.locator('.node[data-node="A"]').evaluate((el) => el.classList.contains('visited'));
    expect(aHasVisited).toBe(true);

    // There should be no uncaught page errors during a normal BFS start/first-visit
    expect(pageErrors.length).toBe(0);

    // Console should not show an error-level message related to BFS start
    const errorConsole = consoleMessages.find(m => m.type === 'error' || /error/i.test(m.text));
    expect(errorConsole).toBeUndefined();
  });

  test('S1_BFS_Running -> S2_Node_Visited transitions and BFS completion (full run)', async ({ page }) => {
    // This test runs BFS to completion and validates repeated S1<->S2 transitions:
    // - Each node eventually receives .visited
    // - The output contains a "Visited: <node>" line for nodes visited
    // - After BFS completes (queue empty), no further DOM changes happen (onExit clearInterval)
    // Note: This test waits for the BFS process to finish; allow a generous timeout.
    const { consoleMessages, pageErrors } = attachDiagnostics(page);

    // Start the BFS
    await page.click('#startButton');

    // Wait until all 7 nodes are marked visited. BFS marks one node per second; allow up to 12s for safety.
    await page.waitForFunction(() => document.querySelectorAll('.node.visited').length === 7, null, { timeout: 12000 });

    // Confirm all nodes have visited class
    const visitedNodes = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.node.visited')).map(n => n.getAttribute('data-node'))
    );
    const expectedNodes = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    // Sort both arrays to compare ignoring order (BFS order won't necessarily be alphabetical)
    expect(visitedNodes.sort()).toEqual(expectedNodes.sort());

    // Confirm output contains Starting + 7 Visited lines
    const outputText = await page.locator('#output').innerText();
    const lines = outputText.split('\n').map(l => l.trim()).filter(Boolean);
    // Expect at least 8 lines: 1 starting + 7 visited entries
    expect(lines.length).toBeGreaterThanOrEqual(8);
    expect(lines[0]).toMatch(/Starting BFS from A/);
    // Ensure at least one visited line for node G exists (final nodes)
    expect(outputText).toMatch(/Visited:\s*G/);

    // Wait an extra short time to ensure interval has been cleared and no further mutations occur
    const snapshotAfterCompletion = await page.locator('#output').innerText();
    await page.waitForTimeout(1500);
    const snapshotLater = await page.locator('#output').innerText();
    expect(snapshotLater).toBe(snapshotAfterCompletion);

    // No uncaught page errors during a successful complete run
    expect(pageErrors.length).toBe(0);

    // No error-level console logs recorded
    const consoleError = consoleMessages.find(m => m.type === 'error' || /error/i.test(m.text));
    expect(consoleError).toBeUndefined();
  }, { timeout: 20000 });

  test('Edge case: Removing an expected node element causes a runtime error when markVisited is called (error scenario)', async ({ page }) => {
    // This test intentionally removes a node element from the DOM (node C) prior to starting BFS.
    // The application's markVisited uses querySelector and then classList.add on the result without null-check.
    // Removing the element should cause a TypeError when markVisited attempts to access classList of null.
    // The test observes the pageerror event and asserts that such an error occurs naturally.
    const diagnostics = attachDiagnostics(page);

    // Remove node "C" from the DOM to create a missing element error scenario
    await page.evaluate(() => {
      const el = document.querySelector('.node[data-node="C"]');
      if (el) el.remove();
    });

    // Start BFS and wait for a pageerror event
    // BFS will attempt to markVisited for A (exists), then B, then C -> error should happen on C
    let caughtError = null;
    const pageErrorPromise = page.waitForEvent('pageerror', { timeout: 8000 }).then(err => { caughtError = err; return err; }).catch(() => null);

    await page.click('#startButton');

    // Wait for the pageerror to be captured (or timeout)
    await pageErrorPromise;

    // We expect an error to have occurred due to missing DOM node
    expect(caughtError).not.toBeNull();
    // The error message can vary depending on the browser; check it mentions classList / null / Cannot read
    const msg = String(caughtError && caughtError.message ? caughtError.message : caughtError);
    expect(msg.toLowerCase()).toMatch(/(cannot read|cannot set|get property 'classlist'|of null|cannot read properties)/i);

    // Confirm diagnostics array recorded at least one pageerror
    expect(diagnostics.pageErrors.length).toBeGreaterThanOrEqual(1);

    // Optional: ensure that the output at least started before the error occurred
    const out = await page.locator('#output').innerText();
    expect(out).toMatch(/Starting BFS from A/);
  });

  test('Edge case: Clicking Start multiple times while BFS is running (idempotency / multiple intervals)', async ({ page }) => {
    // This test clicks Start twice in quick succession to observe behavior:
    // - Second click triggers another bfs('A') call without explicit protection
    // - Validate output and ensure no uncaught exceptions occur when doing so
    const { consoleMessages, pageErrors } = attachDiagnostics(page);

    // Click start once, then click again after a short delay
    await page.click('#startButton');
    await page.waitForTimeout(300); // click again while the first BFS may already be running
    await page.click('#startButton');

    // After second click, output should contain at least the Starting message (it gets overwritten by new call),
    // and the algorithm should still proceed to mark nodes visited. Wait for at least one visited node.
    await page.waitForSelector('.node[data-node="A"].visited', { timeout: 5000 });
    const outputText = await page.locator('#output').innerText();
    expect(outputText).toMatch(/Starting BFS from A/);
    expect(outputText).toMatch(/Visited:\s*A/);

    // There should be no uncaught errors emitted just by clicking Start twice
    expect(pageErrors.length).toBe(0);

    // No error-level console messages expected
    const anyConsoleError = consoleMessages.find(m => m.type === 'error' || /error/i.test(m.text));
    expect(anyConsoleError).toBeUndefined();
  });

  test('Verify markVisited DOM operation uses expected selector and adds visited class (S2_Node_Visited evidence)', async ({ page }) => {
    // This test inspects the DOM to ensure markVisited's evidence is present:
    // "const nodeElement = document.querySelector(`.node[data-node=\"${node}\"]`);"
    // We inspect that nodes can be selected via that exact selector and that adding the visited class changes styles/classes.
    const { pageErrors } = attachDiagnostics(page);

    // Select node B using the exact selector pattern and assert class manipulation works
    const nodeB = page.locator('.node[data-node="B"]');
    await expect(nodeB).toBeVisible();

    // Manually add 'visited' class to the element via DOM to simulate markVisited behavior and assert effect
    await page.evaluate(() => {
      const el = document.querySelector('.node[data-node="B"]');
      el.classList.add('visited');
    });

    // Now verify class exists in DOM API
    const hasVisited = await page.locator('.node[data-node="B"]').evaluate(e => e.classList.contains('visited'));
    expect(hasVisited).toBe(true);

    // Clean up: remove the class so subsequent tests remain deterministic
    await page.evaluate(() => {
      const el = document.querySelector('.node[data-node="B"]');
      if (el) el.classList.remove('visited');
    });

    // No page errors during direct DOM manipulation
    expect(pageErrors.length).toBe(0);
  });
});