import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79d3ce0-d361-11f0-8438-11a56595a476.html';

test.describe('BFS Visualization (FSM) - d79d3ce0-d361-11f0-8438-11a56595a476', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      // store text and type for debugging/assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application under test
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Ensure basic elements are present before each test
    await expect(page.locator('#start-btn')).toBeVisible();
    await expect(page.locator('#reset-btn')).toBeVisible();
    await expect(page.locator('#start-node')).toBeVisible();
    await expect(page.locator('#graph')).toBeVisible();
    await expect(page.locator('#log')).toBeVisible();
  });

  test.afterEach(async () => {
    // After each test we ensure there were no unexpected uncaught errors
    // (Tests below assert specific behaviors; if there are any uncaught errors they are surfaced here.)
    expect(pageErrors.length).toBe(0);
  });

  test('Initial state (S0_Idle): controls initialized and reset disabled', async ({ page }) => {
    // Validate initial Idle state entries:
    // - initOptions() should populate the start-node select
    // - reset button should be disabled
    // - no nodes should have visited/current classes
    // - log should be empty

    // Check start-node has options (initOptions called on entry)
    const optionsCount = await page.$eval('#start-node', (sel) => sel.options.length);
    expect(optionsCount).toBeGreaterThan(0);

    // Check reset button is disabled (evidence: resetBtn.disabled = true;)
    const resetDisabled = await page.$eval('#reset-btn', (btn) => btn.disabled);
    expect(resetDisabled).toBe(true);

    // Check start button is enabled
    const startDisabled = await page.$eval('#start-btn', (btn) => btn.disabled);
    expect(startDisabled).toBe(false);

    // Ensure no node has 'visited' or 'current' class initially
    const anyVisitedOrCurrent = await page.$$eval('[data-node]', (nodes) =>
      nodes.some((n) => n.classList.contains('visited') || n.classList.contains('current'))
    );
    expect(anyVisitedOrCurrent).toBe(false);

    // Log should be empty initially
    const logText = await page.$eval('#log', (el) => el.textContent.trim());
    expect(logText).toBe('');

    // Ensure no uncaught page errors were emitted during load
    expect(pageErrors.length).toBe(0);
  });

  test('Start BFS transitions to Animating (S0 -> S1): start button disables and animation begins', async ({ page }) => {
    // This test validates:
    // - clicking Start BFS disables the start button (evidence)
    // - animateBFS(start) is invoked (we detect "Starting BFS from node X" in the log)
    // - the selected start node becomes 'current'
    // - the reset button remains disabled during animation per implementation

    // Capture the initially selected start node value (should be the first option)
    const startNodeValue = await page.$eval('#start-node', (sel) => sel.value);
    expect(startNodeValue).toBeTruthy();

    // Click Start BFS
    await page.click('#start-btn');

    // Immediately after click, startBtn should be disabled and resetBtn should remain disabled
    await expect(page.locator('#start-btn')).toBeDisabled();
    await expect(page.locator('#reset-btn')).toBeDisabled();

    // Check the log contains the starting message for the chosen start node
    await page.waitForFunction(
      (expected) => {
        const log = document.getElementById('log');
        return log && log.innerText.includes(`Starting BFS from node ${expected}`);
      },
      startNodeValue,
      { timeout: 3000 }
    );

    // The start node should have the 'current' class applied
    const hasCurrent = await page.$eval(`[data-node="${startNodeValue}"]`, (el) =>
      el.classList.contains('current')
    );
    expect(hasCurrent).toBe(true);

    // The log should start showing visiting messages after some time (animation tick)
    await page.waitForFunction(
      () => {
        const log = document.getElementById('log');
        return log && /Visiting node/.test(log.innerText);
      },
      {},
      { timeout: 5000 }
    );

    // Make sure there were no uncaught page errors so far
    expect(pageErrors.length).toBe(0);
  });

  test('BFS completes and transitions to Completed (S1 -> S2): traversal finishes and controls enabled', async ({ page }) => {
    // This test validates the BFS runs to completion and the app transitions to Completed:
    // - We wait for the 'BFS traversal complete.' message
    // - Verify start and reset buttons are re-enabled
    // - Verify nodes have 'visited' marks (at least some)
    // - Verify the initial start node no longer has 'current' class

    // Start BFS
    await page.click('#start-btn');

    // Wait for BFS traversal to complete; allow generous timeout because animation uses setInterval(1200)
    await page.waitForFunction(
      () => {
        const log = document.getElementById('log');
        return log && log.innerText.includes('BFS traversal complete.');
      },
      {},
      { timeout: 20000 }
    );

    // At completion, startBtn and resetBtn should both be enabled per implementation
    await expect(page.locator('#start-btn')).toBeEnabled();
    await expect(page.locator('#reset-btn')).toBeEnabled();

    // The log must contain the completion message
    const logText = await page.$eval('#log', (el) => el.innerText);
    expect(logText).toContain('BFS traversal complete.');

    // At least one node should have class 'visited' (green)
    const someVisited = await page.$$eval('[data-node]', (nodes) =>
      nodes.some((n) => n.classList.contains('visited'))
    );
    expect(someVisited).toBe(true);

    // No node should have 'current' class (the implementation removes 'current' from start)
    const anyCurrent = await page.$$eval('[data-node]', (nodes) =>
      nodes.some((n) => n.classList.contains('current'))
    );
    expect(anyCurrent).toBe(false);

    // Ensure no uncaught page errors
    expect(pageErrors.length).toBe(0);
  }, 25000);

  test('Reset after completion transitions back to Idle (S2 -> S0): clicking Reset clears state', async ({ page }) => {
    // This test validates:
    // - After completion, clicking Reset clears logs and node highlights
    // - Reset sets resetBtn.disabled = true and startBtn.disabled = false (back to Idle)
    // Steps:
    // 1. Start BFS and wait for completion
    // 2. Click Reset and verify Idle state properties

    // Start BFS and wait for completion
    await page.click('#start-btn');
    await page.waitForFunction(
      () => {
        const log = document.getElementById('log');
        return log && log.innerText.includes('BFS traversal complete.');
      },
      {},
      { timeout: 20000 }
    );

    // Click the reset button now that it should be enabled
    await expect(page.locator('#reset-btn')).toBeEnabled();
    await page.click('#reset-btn');

    // After reset:
    // - log should be empty
    await page.waitForFunction(
      () => {
        const log = document.getElementById('log');
        return log && log.innerText.trim() === '';
      },
      {},
      { timeout: 2000 }
    );
    const logTextAfterReset = await page.$eval('#log', (el) => el.innerText.trim());
    expect(logTextAfterReset).toBe('');

    // - all nodes should have no 'visited' or 'current' classes
    const anyMarked = await page.$$eval('[data-node]', (nodes) =>
      nodes.some((n) => n.classList.contains('visited') || n.classList.contains('current'))
    );
    expect(anyMarked).toBe(false);

    // - startBtn should be enabled, resetBtn should be disabled (back to Idle defaults)
    await expect(page.locator('#start-btn')).toBeEnabled();
    await expect(page.locator('#reset-btn')).toBeDisabled();

    // Ensure no uncaught page errors
    expect(pageErrors.length).toBe(0);
  }, 25000);

  test('Attempting Reset during animation does not trigger reset (button remains disabled) - tests S1 -> S0 expectation vs implementation', async ({ page }) => {
    // FSM lists a transition S1_Animating -> S0_Idle on ResetBFS_Click.
    // Implementation disables the reset button during animation, making a user-initiated Reset not possible.
    // This test verifies that the reset button remains disabled during animation and that attempting to click via Playwright
    // (which will fail on a disabled element) does not perform a reset.
    //
    // We intentionally check that the disabled attribute prevents a reset event, highlighting the difference
    // between the FSM's transition and the runtime behavior in this implementation.

    // Start BFS
    await page.click('#start-btn');

    // Ensure animation started
    await page.waitForFunction(
      () => {
        const log = document.getElementById('log');
        return log && log.innerText.includes('Starting BFS from node');
      },
      {},
      { timeout: 3000 }
    );

    // Confirm reset button is disabled during animation
    await expect(page.locator('#reset-btn')).toBeDisabled();

    // Attempting to click a disabled button via Playwright should throw.
    // We capture that behavior and assert that the click is not possible.
    let clickFailed = false;
    try {
      await page.click('#reset-btn', { timeout: 2000 });
    } catch (err) {
      clickFailed = true;
      // The error should indicate element is disabled or not clickable, ensure we captured a failure
      expect(err.message).toBeTruthy();
    }
    expect(clickFailed).toBe(true);

    // While animation proceeds, startBtn should remain disabled until completion
    await expect(page.locator('#start-btn')).toBeDisabled();

    // Let the BFS finish to clean up for subsequent tests
    await page.waitForFunction(
      () => document.getElementById('log') && document.getElementById('log').innerText.includes('BFS traversal complete.'),
      {},
      { timeout: 20000 }
    );

    // Ensure no uncaught page errors
    expect(pageErrors.length).toBe(0);
  }, 25000);

  test('Edge case: clicking Start when no start node selected does nothing', async ({ page }) => {
    // The implementation checks `const start = startNodeSelect.value; if (!start) return;`
    // We simulate the edge case where the select has no value by temporarily clearing the selection via DOM operations.
    // Note: This modifies DOM only for testing purposes and does not attempt to redefine application logic.

    // Remove selection by setting value to empty string (there is no option with empty value)
    await page.evaluate(() => {
      const sel = document.getElementById('start-node');
      if (sel) sel.value = '';
    });

    // Click Start; since start value is falsy, the click handler should return early and not disable startBtn.
    await page.click('#start-btn');

    // startBtn should remain enabled because handler returned early
    await expect(page.locator('#start-btn')).toBeEnabled();

    // There should be no "Starting BFS" message in the log
    const logText = await page.$eval('#log', (el) => el.innerText);
    expect(logText).not.toContain('Starting BFS from node');

    // Ensure no uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Console and page error observation: ensure no unexpected console errors during interactions', async ({ page }) => {
    // This test performs a quick start->complete run and asserts that no console.error or pageerror messages were emitted.

    // Start BFS
    await page.click('#start-btn');

    // Wait for completion (generous timeout)
    await page.waitForFunction(
      () => {
        const log = document.getElementById('log');
        return log && log.innerText.includes('BFS traversal complete.');
      },
      {},
      { timeout: 20000 }
    );

    // Inspect captured console messages for any error-level entries
    const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
    expect(errorConsoleMessages.length).toBe(0);

    // Inspect pageErrors captured by 'pageerror' handler
    expect(pageErrors.length).toBe(0);
  }, 25000);
});