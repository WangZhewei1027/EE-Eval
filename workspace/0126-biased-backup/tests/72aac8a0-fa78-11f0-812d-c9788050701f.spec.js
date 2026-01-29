import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72aac8a0-fa78-11f0-812d-c9788050701f.html';

test.describe('PageRank Visualization FSM - 72aac8a0-fa78-11f0-812d-c9788050701f', () => {
  // Shared collectors for console and page errors so tests can assert on them
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture all console messages for inspection
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // Capture uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the provided HTML page
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // Nothing to teardown beyond Playwright's default - listeners are bound per page instance
  });

  test('Initial render (S0_Idle): renderGraph() should create nodes and rankings on DOMContentLoaded', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) where renderGraph() is invoked on DOMContentLoaded.
    // We verify that nodes and rankings are present and correctly sorted by rank.
    const graphLocator = page.locator('#graph');
    const rankingsLocator = page.locator('#rankings');

    // Wait for nodes and rankings to appear (renderGraph runs synchronously during DOMContentLoaded)
    await expect(graphLocator).toBeVisible({ timeout: 2000 });
    await expect(rankingsLocator).toBeVisible({ timeout: 2000 });

    // There should be multiple node elements (5 in the implementation)
    const nodeCount = await page.locator('.node').count();
    expect(nodeCount).toBeGreaterThanOrEqual(5);

    // Rankings should contain the same number of items as nodes (5)
    const rankingItems = page.locator('#rankings .rank-item');
    await expect(rankingItems).toHaveCount(nodeCount);

    // Verify top ranking value matches expected (A has 0.300)
    const firstRankValue = await page.locator('#rankings .rank-item .rank-value').first().textContent();
    expect(firstRankValue.trim()).toBe('0.300');

    // Ensure reset button exists and is enabled
    const reset = page.locator('#reset');
    await expect(reset).toBeVisible();
    await expect(reset).toBeEnabled();

    // Check that no uncaught page errors occurred immediately after load
    expect(pageErrors.length).toBe(0);
    // And no console.error messages were emitted on load
    expect(consoleErrors.length).toBe(0);
  });

  test('Animation starts (transition to S1_Animating): animatePageRank() runs after initial delay', async ({ page }) => {
    // The animation is scheduled to start 2000ms after initialization.
    // We wait for that window and assert that highlight/pulse elements appear indicating animation activity.
    // Use a larger timeout to account for scheduling and DOM operations.
    const pulseLocator = page.locator('.pulse');

    // Wait up to 6s for at least one pulse element to appear (animation uses setInterval and pulses last ~2000ms)
    await expect(pulseLocator.first()).toBeVisible({ timeout: 6000 });

    // Confirm that there is at least one highlight element present
    const highlightCount = await page.locator('.highlight').count();
    expect(highlightCount).toBeGreaterThanOrEqual(1);

    // Verify again no uncaught page errors during animation start
    expect(pageErrors.length).toBe(0);
    // Ensure console did not contain error-level messages
    expect(consoleErrors.length).toBe(0);
  });

  test('Reset Animation from Idle (S0_Idle -> S1_Animating): clicking reset re-renders graph and restarts animation', async ({ page }) => {
    // Ensure we are in Idle long enough (before automatic animation kicks in)
    // Click reset and verify renderGraph() runs and animatePageRank() is scheduled (after 1000ms)
    const reset = page.locator('#reset');
    await expect(reset).toBeVisible();

    // Wait a bit to ensure initial animate hasn't started yet (animation scheduled at 2000ms)
    // If test runs slower, this still should be okay because we'll assert pulses after the reset's 1s delay.
    // Click reset to trigger the transition defined in FSM
    await reset.click();

    // Immediately after click, graph and rankings should still be present (re-render)
    await expect(page.locator('.node').first()).toBeVisible({ timeout: 2000 });
    await expect(page.locator('#rankings .rank-item').first()).toBeVisible({ timeout: 2000 });

    // Because reset schedules animatePageRank after 1000ms, wait slightly longer and expect pulses
    await expect(page.locator('.pulse').first()).toBeVisible({ timeout: 5000 });

    // Validate that rankings are present and show expected formatting
    const rankingValues = await page.locator('#rankings .rank-item .rank-value').allTextContents();
    expect(rankingValues.length).toBeGreaterThanOrEqual(5);
    // Each value should be a decimal string with three decimals
    for (const val of rankingValues) {
      expect(/^\d\.\d{3}$/.test(val.trim())).toBeTruthy();
    }

    // No uncaught errors on reset
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Reset while animating (S1_Animating -> S1_Animating): clicking reset during animation restarts animation without errors', async ({ page }) => {
    // Wait for initial animation to begin
    await expect(page.locator('.pulse').first()).toBeVisible({ timeout: 6000 });

    // Click reset while animation is ongoing
    await page.locator('#reset').click();

    // After clicking reset, the implementation should call renderGraph() immediately and schedule animatePageRank() after 1000ms.
    // Ensure nodes and rankings are present after click
    await expect(page.locator('.node').first()).toBeVisible({ timeout: 2000 });
    await expect(page.locator('#rankings .rank-item').first()).toBeVisible({ timeout: 2000 });

    // Confirm that a new animation cycle's pulse appears after the 1s scheduling
    await expect(page.locator('.pulse').first()).toBeVisible({ timeout: 5000 });

    // Ensure no uncaught errors occurred during this transition
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Rapid multiple resets (edge case): multiple quick clicks should not produce uncaught errors', async ({ page }) => {
    // Click reset rapidly several times to simulate a user spamming the button
    const reset = page.locator('#reset');
    await expect(reset).toBeVisible();

    // Rapidly click 3 times
    await reset.click();
    await reset.click();
    await reset.click();

    // Allow time for the scheduled animation to start (after last click, animatePageRank scheduled 1000ms)
    await expect(page.locator('.pulse').first()).toBeVisible({ timeout: 6000 });

    // Validate that nodes and rankings are still present and not duplicated in an unexpected way
    const nodeCount = await page.locator('.node').count();
    expect(nodeCount).toBeGreaterThanOrEqual(5);

    const rankingCount = await page.locator('#rankings .rank-item').count();
    expect(rankingCount).toBe(nodeCount);

    // No uncaught errors should have occurred
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Also assert that console messages do not contain unexpected error logs
    const errorsFromConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorsFromConsole.length).toBe(0);
  });

  test('Instrumentation: capture console output and page errors for diagnostic purposes', async ({ page }) => {
    // This test documents the console and page error state for the loaded application.
    // It does not attempt to modify the runtime; it simply asserts the observed diagnostics.
    // Wait briefly to collect any late-emitted errors or logs (animations and timeouts may emit)
    await page.waitForTimeout(3000);

    // Provide a friendly assertion: the application is expected to run without uncaught exceptions.
    // If there are uncaught exceptions, the test will fail and surface them.
    expect(pageErrors.length).toBe(0);

    // Ensure no console.error messages were emitted during the session
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleEntries.length).toBe(0);

    // Log non-error console messages to aid debugging if needed (this does not fail the test)
    // NOTE: We only assert emptiness for error-level logs to avoid flaky failures from benign logs.
    // But we still expose the count so maintainers can inspect test output if necessary.
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });
});