import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b3ec70-d5c2-11f0-9651-0f1ae31ac260.html';

// Helper to wait until the #log contains some text
async function waitForLogContains(page, substring, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const text = await page.locator('#log').innerText();
    if (text.includes(substring)) return text;
    await page.waitForTimeout(50);
  }
  throw new Error(`Timed out waiting for log to contain "${substring}". Current log:\n` + (await page.locator('#log').innerText()));
}

test.describe('BFS Visualization - FSM state and transition tests', () => {
  // Capture console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // navigate to the application page before each test
    await page.goto(APP_URL);
  });

  test('Initial Idle state: controls and selects initialized', async ({ page }) => {
    // Comments: Validate the Idle state (S0_Idle) after page load.
    // We check that the start select is populated, default value is the first node,
    // and the control buttons have the expected enabled/disabled states.

    // Ensure selects and buttons are present
    const startNodeSelect = page.locator('#startNode');
    const endNodeSelect = page.locator('#endNode');
    const startBtn = page.locator('#startBtn');
    const resetBtn = page.locator('#resetBtn');
    const stepBtn = page.locator('#stepBtn');
    const runBtn = page.locator('#runBtn');
    const logDiv = page.locator('#log');
    const canvas = page.locator('#graphCanvas');

    await expect(startNodeSelect).toBeVisible();
    await expect(endNodeSelect).toBeVisible();
    await expect(startBtn).toBeVisible();
    await expect(resetBtn).toBeVisible();
    await expect(stepBtn).toBeVisible();
    await expect(runBtn).toBeVisible();
    await expect(logDiv).toBeVisible();
    await expect(canvas).toBeVisible();

    // Default start node should be the first node (A)
    await expect(startNodeSelect).toHaveValue('A');

    // Reset/Step/Run should be disabled in Idle
    await expect(resetBtn).toBeDisabled();
    await expect(stepBtn).toBeDisabled();
    await expect(runBtn).toBeDisabled();

    // Start should be enabled
    await expect(startBtn).toBeEnabled();

    // Log should initially be empty
    const initialLog = await logDiv.innerText();
    expect(initialLog.trim()).toBe('');

    // No page errors and no console error-level messages
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e));
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // small delay to catch any immediate runtime errors during initialization
    await page.waitForTimeout(200);
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Start BFS: transition from Idle to BFS Started (S0 -> S1)', async ({ page }) => {
    // Comments: Clicking Start should initialize BFS and produce a start log entry,
    // enable Step/Run/Reset, and disable Start.

    const startBtn = page.locator('#startBtn');
    const resetBtn = page.locator('#resetBtn');
    const stepBtn = page.locator('#stepBtn');
    const runBtn = page.locator('#runBtn');
    const logDiv = page.locator('#log');

    // Click Start BFS
    await startBtn.click();

    // Verify buttons state after starting
    await expect(startBtn).toBeDisabled();
    await expect(resetBtn).toBeEnabled();
    await expect(stepBtn).toBeEnabled();
    await expect(runBtn).toBeEnabled();

    // The log should contain the Start BFS message for the chosen start node (default A)
    const logText = await waitForLogContains(page, 'Start BFS at node A');
    expect(logText).toMatch(/Start BFS at node A/);

    // Ensure no JS runtime page errors occurred
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e));
    await page.waitForTimeout(100);
    expect(pageErrors.length).toBe(0);
  });

  test('Step BFS: single step processes a node and marks neighbors (S1 -> S2)', async ({ page }) => {
    // Comments: Start BFS, then perform a single step. Verify dequeued log,
    // neighbor "Visited ..." logs and that after step the queue may be non-empty
    // (depending on graph), and that step button remains enabled unless BFS finished.

    const startBtn = page.locator('#startBtn');
    const stepBtn = page.locator('#stepBtn');
    const logDiv = page.locator('#log');

    // Start BFS
    await startBtn.click();
    await waitForLogContains(page, 'Start BFS at node A');

    // Click Step once
    await stepBtn.click();

    // Should log the dequeued node (A) and at least one visited neighbor
    await waitForLogContains(page, 'Dequeued: A');
    const logText = await page.locator('#log').innerText();
    expect(logText).toMatch(/Dequeued: A/);
    // Graph adjacency for A: B and H, so expect at least one 'Visited B' or 'Visited H'
    expect(logText).toMatch(/Visited (B|H), added to queue\./);

    // No page runtime errors
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e));
    await page.waitForTimeout(50);
    expect(pageErrors.length).toBe(0);
  });

  test('Full BFS via stepping: reaches finished state (S2 -> S3)', async ({ page }) => {
    // Comments: Start from Idle, then keep clicking Step until BFS finishes.
    // We assert we see 'Queue empty. BFS finished.' and that Step/Run get disabled.

    const startBtn = page.locator('#startBtn');
    const stepBtn = page.locator('#stepBtn');
    const runBtn = page.locator('#runBtn');
    const resetBtn = page.locator('#resetBtn');
    const logDiv = page.locator('#log');

    await startBtn.click();
    await waitForLogContains(page, 'Start BFS at node A');

    // Click Step repeatedly until BFS finished or we exceed a reasonable iteration count
    let finished = false;
    for (let i = 0; i < 50; i++) {
      // If already finished, break
      const logText = await logDiv.innerText();
      if (logText.includes('Queue empty. BFS finished.') || logText.includes('End node')) {
        finished = true;
        break;
      }
      if (await stepBtn.isEnabled()) {
        await stepBtn.click();
      } else {
        // If the step button is disabled, wait a short time and break if finished
        await page.waitForTimeout(50);
      }
      // allow some time for logs to update
      await page.waitForTimeout(20);
    }

    // After repetition, ensure BFS finished message is present
    const fullLog = await logDiv.innerText();
    expect(fullLog).toMatch(/Queue empty. BFS finished\./);

    // Step and Run should be disabled after finish
    await expect(stepBtn).toBeDisabled();
    await expect(runBtn).toBeDisabled();

    // Reset should still be enabled after finishing
    await expect(resetBtn).toBeEnabled();

    // No page errors
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e));
    await page.waitForTimeout(50);
    expect(pageErrors.length).toBe(0);
  });

  test('Run Automatically completes the BFS (Run button with interval)', async ({ page }) => {
    // Comments: Start BFS and press Run Automatically. Wait for finish message.
    // Because the automatic run uses setInterval(800ms), allow sufficient timeout.

    const startBtn = page.locator('#startBtn');
    const runBtn = page.locator('#runBtn');
    const stepBtn = page.locator('#stepBtn');
    const logDiv = page.locator('#log');

    await startBtn.click();
    await waitForLogContains(page, 'Start BFS at node A');

    // Click Run automatically
    await runBtn.click();

    // Run should disable immediately
    await expect(runBtn).toBeDisabled();

    // Wait up to 15 seconds for BFS finish due to interval stepping
    await waitForLogContains(page, 'Queue empty. BFS finished.', 15000);

    // After finish, step and run should be disabled
    await expect(stepBtn).toBeDisabled();
    await expect(runBtn).toBeDisabled();

    // No page errors captured during automatic run
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e));
    await page.waitForTimeout(50);
    expect(pageErrors.length).toBe(0);
  });

  test('Search for end node: finds the end and draws path (findEndNode true)', async ({ page }) => {
    // Comments: Select an end node, start BFS and step through until the end node is found.
    // Validate the log includes the searching note and the end found message.

    const startBtn = page.locator('#startBtn');
    const stepBtn = page.locator('#stepBtn');
    const startNodeSelect = page.locator('#startNode');
    const endNodeSelect = page.locator('#endNode');
    const logDiv = page.locator('#log');

    // Choose start = A (default) and end = D (a reachable node)
    await startNodeSelect.selectOption({ value: 'A' });
    await endNodeSelect.selectOption({ value: 'D' });

    await startBtn.click();

    // The start log should mention searching for the end node
    await waitForLogContains(page, 'searching for end node D');

    // Step until end node found
    let found = false;
    for (let i = 0; i < 50; i++) {
      const text = await logDiv.innerText();
      if (text.includes('End node D found!') || text.includes('Queue empty. BFS finished.')) {
        found = text.includes('End node D found!');
        break;
      }
      if (await stepBtn.isEnabled()) {
        await stepBtn.click();
      } else {
        await page.waitForTimeout(50);
      }
      await page.waitForTimeout(30);
    }

    // Assert we found the end node, not just finished without finding it
    const finalLog = await logDiv.innerText();
    expect(finalLog).toContain('End node D found!');

    // The log should also include the "Start BFS at node A, searching for end node D" message
    expect(finalLog).toMatch(/Start BFS at node A, searching for end node D/);

    // No page errors
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e));
    await page.waitForTimeout(50);
    expect(pageErrors.length).toBe(0);
  });

  test('Reset during run clears state and intervals', async ({ page }) => {
    // Comments: Start BFS, click Run Automatically, then click Reset.
    // Validate that reset returns buttons to Idle state and that no further "Visited ..." logs appear.

    const startBtn = page.locator('#startBtn');
    const runBtn = page.locator('#runBtn');
    const resetBtn = page.locator('#resetBtn');
    const stepBtn = page.locator('#stepBtn');
    const logDiv = page.locator('#log');

    // Start BFS and run
    await startBtn.click();
    await waitForLogContains(page, 'Start BFS at node A');

    await runBtn.click();
    // wait a short time to allow some steps to happen
    await page.waitForTimeout(900);

    // Capture current log content
    const logBeforeReset = await logDiv.innerText();

    // Click Reset while the automatic run may be running
    await resetBtn.click();

    // After reset, the Idle state expectations:
    await expect(resetBtn).toBeDisabled();
    await expect(stepBtn).toBeDisabled();
    await expect(runBtn).toBeDisabled();
    await expect(startBtn).toBeEnabled();

    // Wait a bit to see if any new "Visited" lines are added after reset (they should not)
    await page.waitForTimeout(1000);
    const logAfter = await logDiv.innerText();

    // Expect log after reset to be empty (resetState clears log)
    expect(logAfter.trim()).toBe('');

    // No page errors
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e));
    await page.waitForTimeout(50);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge cases: Step and Run are disabled before Start and clicking disabled controls does nothing', async ({ page }) => {
    // Comments: Validate that Step/Run/Reset are disabled in Idle. Attempting to click disabled controls should not throw errors.
    // We will assert they remain disabled and observe no page errors or console errors.

    const stepBtn = page.locator('#stepBtn');
    const runBtn = page.locator('#runBtn');
    const resetBtn = page.locator('#resetBtn');

    await expect(stepBtn).toBeDisabled();
    await expect(runBtn).toBeDisabled();
    await expect(resetBtn).toBeDisabled();

    // Collect possible page errors and console error messages
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', e => pageErrors.push(e));
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Attempt to click disabled buttons — Playwright allows clicking, but in most browsers it's a no-op.
    // We ensure the action does not raise runtime errors in the app.
    await stepBtn.click().catch(() => {});
    await runBtn.click().catch(() => {});
    await resetBtn.click().catch(() => {});

    // short wait to capture any errors
    await page.waitForTimeout(100);
    expect(pageErrors.length).toBe(0, 'Expected no page errors after clicking disabled buttons');
    expect(consoleErrors.length).toBe(0);
  });

  test('Console and page error monitoring: ensure no ReferenceError/TypeError/SyntaxError occurred', async ({ page }) => {
    // Comments: This test hooks into console and page error events and asserts that no common fatal errors occurred.
    // It demonstrates that we observed logs/errors while loading and interacting with the page.

    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', e => {
      pageErrors.push(e);
    });

    // Do a basic interaction sequence to exercise scripts
    const startBtn = page.locator('#startBtn');
    await startBtn.click();
    await waitForLogContains(page, 'Start BFS at node A');
    const stepBtn = page.locator('#stepBtn');
    if (await stepBtn.isEnabled()) {
      await stepBtn.click();
    }

    // short delay for potential errors to surface
    await page.waitForTimeout(200);

    // Assert no page error events fired
    expect(pageErrors.length).toBe(0);

    // Assert no console messages contain critical JS error keywords
    const errorKeywords = ['ReferenceError', 'TypeError', 'SyntaxError'];
    for (const m of consoleMessages) {
      for (const kw of errorKeywords) {
        expect(m.text).not.toContain(kw);
      }
      // Also ensure there were no console.error messages
      expect(m.type).not.toBe('error');
    }
  });
});