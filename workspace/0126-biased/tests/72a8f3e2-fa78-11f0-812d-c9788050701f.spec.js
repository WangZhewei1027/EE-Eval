import { test, expect } from '@playwright/test';

// URL of the served HTML for this application
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72a8f3e2-fa78-11f0-812d-c9788050701f.html';

// Utility: wait until a condition or timeout
async function waitForCondition(page, conditionFn, timeout = 3000, interval = 50) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await page.evaluate(conditionFn);
    if (result) return;
    if (Date.now() - start > timeout) throw new Error('waitForCondition timed out');
    await page.waitForTimeout(interval);
  }
}

test.describe('Binary Tree Visualization (FSM states & transitions)', () => {
  // Each test will collect console messages and page errors to assert on them
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture uncaught errors on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // As a lightweight teardown, clear handlers (Playwright auto-clears page on next test)
    // Also allow some time for background animations to run and generate console messages if any
    await page.waitForTimeout(100); // small pause to flush any trailing async logs
  });

  test('S0 Idle state: on load the tree is built (buildBalancedTree(4) executed)', async ({ page }) => {
    // This test validates the entry action for S0_Idle: buildBalancedTree(4)
    // The balanced tree of depth 4 should produce 2^4 - 1 = 15 nodes.
    // Nodes animate into view with increasing delays. Wait sufficiently for them to appear.

    // Wait for at least one node to appear
    await page.waitForSelector('.node', { timeout: 2000 });

    // Wait up to 2s for all nodes to be drawn (max draw delay ~ 600ms)
    await page.waitForTimeout(1000);

    // Count nodes and lines
    const nodeCount = await page.$$eval('.node', (els) => els.length);
    const lineCount = await page.$$eval('.line', (els) => els.length);

    // Assert expected counts
    expect(nodeCount).toBe(15);
    // For a tree with 15 nodes there should be 14 connecting lines
    expect(lineCount).toBeGreaterThanOrEqual(14);

    // Ensure no uncaught errors happened during load
    expect(pageErrors.length).toBe(0);

    // Basic visual checks: nodes should have text content corresponding to values (some sample check)
    const sampleText = await page.$eval('.node', (el) => el.textContent.trim());
    expect(sampleText.length).toBeGreaterThan(0);

    // Also ensure animate & reset buttons are present and visible
    await expect(page.locator('#animateBtn')).toBeVisible();
    await expect(page.locator('#resetBtn')).toBeVisible();
  });

  test('S0 -> S1 transition: clicking "Animate Tree" triggers animateTraversal() and highlights nodes and creates particles', async ({ page }) => {
    // This test validates S1 entry action animateTraversal() upon clicking Animate Tree.
    // Clicking should highlight nodes sequentially and create particle elements.
    // We assert that after clicking we see at least one highlighted node and some particles.

    // Ensure tree exists
    await page.waitForSelector('.node');

    // Click the animate button
    await page.click('#animateBtn');

    // The first highlight occurs with 0ms delay for index 0; wait a short time
    await page.waitForTimeout(200);

    // Check for at least one highlighted node
    const highlightedCount = await page.$$eval('.node.highlight', (els) => els.length);
    expect(highlightedCount).toBeGreaterThanOrEqual(1);

    // Some particles should be created and appended to the body during animation
    const particleCount = await page.$$eval('.particle', (els) => els.length);
    expect(particleCount).toBeGreaterThanOrEqual(1);

    // Ensure the tree still has expected node count during animation
    const nodeCountDuringAnim = await page.$$eval('.node', (els) => els.length);
    expect(nodeCountDuringAnim).toBe(15);

    // No uncaught page errors should have occurred from a normal animation
    expect(pageErrors.length).toBe(0);

    // Inspect console messages for any warnings/errors
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('S1 -> S0 transition: clicking "Reset" during animation rebuilds the tree and removes highlights', async ({ page }) => {
    // This test validates that clicking Reset returns the app to Idle state.
    // We click animate, allow it to start, then click reset and assert that there are no highlighted nodes and the tree is rebuilt.

    await page.waitForSelector('.node');
    // Start animation
    await page.click('#animateBtn');

    // Allow the first highlight to apply
    await page.waitForTimeout(150);

    // Confirm we have highlights
    let highlightedBeforeReset = await page.$$eval('.node.highlight', els => els.length);
    expect(highlightedBeforeReset).toBeGreaterThanOrEqual(1);

    // Click reset to transition to Idle
    await page.click('#resetBtn');

    // Wait a short time to allow rebuild to happen
    await page.waitForTimeout(400);

    // After reset, nodes should be rebuilt to 15 nodes
    const nodeCountAfterReset = await page.$$eval('.node', els => els.length);
    expect(nodeCountAfterReset).toBe(15);

    // No node should have the highlight class after reset (tree rebuilt)
    const highlightedAfterReset = await page.$$eval('.node.highlight', els => els.length);
    expect(highlightedAfterReset).toBe(0);

    // The implementation may cause background particle elements to still be present transiently.
    // Ensure that there are no persistent uncaught errors as a result of this common action.
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: clicking Reset during animation may produce runtime errors (we observe and assert such errors occur)', async ({ page }) => {
    // This test intentionally attempts to reproduce a race condition:
    // Start animation, then immediately click Reset. The animation's timeouts will still run and
    // may attempt to access DOM nodes that were removed -> potential TypeError. We must observe and assert that such an error occurs naturally.

    await page.waitForSelector('.node');

    // Start animation
    await page.click('#animateBtn');

    // Immediately click reset to interrupt animation and potentially provoke a runtime error
    await page.click('#resetBtn');

    // Wait enough time for scheduled timeouts from animateTraversal to execute and for any errors to be surfaced
    await page.waitForTimeout(1500);

    // We expect at least one uncaught page error (TypeError) due to nodes being removed while timeouts run.
    const hasTypeError = pageErrors.some(err => {
      // err is an Error object; check its name and message for TypeError indications
      try {
        if (err && err.name === 'TypeError') return true;
        const m = String(err && err.message ? err.message : '');
        return /typeerror/i.test(m) || /cannot read|cannot set|is undefined|of undefined/i.test(m);
      } catch {
        return false;
      }
    });

    // Assert that a TypeError (or similar) occurred as an outcome of this race condition.
    expect(hasTypeError).toBeTruthy();

    // Additionally verify that the app eventually returned to Idle state with 15 nodes (rebuild worked)
    const finalNodeCount = await page.$$eval('.node', els => els.length);
    expect(finalNodeCount).toBe(15);
  });

  test('Robustness: clicking Animate multiple times should not crash the page (no new uncaught errors)', async ({ page }) => {
    // This test simulates repeated user interaction by clicking Animate several times in quick succession.
    // We ensure the page does not produce uncaught errors from rapid repeated invocations.

    await page.waitForSelector('.node');

    // Click animate multiple times
    await page.click('#animateBtn');
    await page.waitForTimeout(100);
    await page.click('#animateBtn');
    await page.waitForTimeout(100);
    await page.click('#animateBtn');

    // Allow some animation time
    await page.waitForTimeout(1200);

    // Assert that although multiple animations might overlap, there are no uncaught page errors
    const pageErrorCount = pageErrors.length;
    expect(pageErrorCount).toBe(0);

    // Also assert that there is at least one highlighted node shortly after
    const highlighted = await page.$$eval('.node.highlight', els => els.length);
    expect(highlighted).toBeGreaterThanOrEqual(1);

    // Clean up: click reset to restore Idle
    await page.click('#resetBtn');
    await page.waitForTimeout(400);
    const nodesAfterCleanup = await page.$$eval('.node', els => els.length);
    expect(nodesAfterCleanup).toBe(15);
  });

  test('Observability: collect and assert console messages do not include unexpected errors on normal flows', async ({ page }) => {
    // This test asserts that normal user flows (load -> animate -> reset) do not emit console.error messages.
    await page.waitForSelector('.node');

    // Flow: animate then reset
    await page.click('#animateBtn');
    await page.waitForTimeout(300);
    await page.click('#resetBtn');
    await page.waitForTimeout(400);

    // Check collected console messages
    const errorLogs = consoleMessages.filter(m => m.type === 'error');
    expect(errorLogs.length).toBe(0);

    // And ensure pageErrors is empty for the normal flow
    expect(pageErrors.length).toBe(0);
  });
});