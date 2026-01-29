import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72a9de40-fa78-11f0-812d-c9788050701f.html';

// Number of elements expected by the implementation (arraySize)
const EXPECTED_ARRAY_SIZE = 15;

test.describe('Heap Sort Visualization - FSM and UI integration tests', () => {
  // Collect page errors and console messages for inspection in each test
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Reset collectors before each test
    pageErrors = [];
    consoleMessages = [];

    // Listen for uncaught exceptions on the page
    page.on('pageerror', (err) => {
      // Capture errors so tests can assert their absence/presence
      pageErrors.push(err);
    });

    // Capture console messages for informational assertions / debugging
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the page
    await page.goto(APP_URL);

    // Wait for the page to initialize and show the expected idle status
    const status = page.locator('#status');
    await expect(status).toHaveText('Ready to begin heap sort', { timeout: 5000 });
  });

  test.afterEach(async () => {
    // After each test we will assert there were no unexpected page errors (ReferenceError, SyntaxError, TypeError).
    // The application should run without throwing uncaught exceptions during normal interactions.
    // If any pageErrors exist, fail the test with details.
    if (pageErrors.length > 0) {
      const details = pageErrors.map(e => `${e.name}: ${e.message}`).join('\n');
      throw new Error(`Unexpected page errors were detected:\n${details}`);
    }
  });

  test('Initial Idle state: UI elements present and ready', async ({ page }) => {
    // Validate initial Idle state (S0_Idle) per FSM: init() should have run and status should indicate readiness.
    // Also check visual components are rendered (array bars and tree nodes).
    const startBtn = page.locator('#startBtn');
    const resetBtn = page.locator('#resetBtn');
    const status = page.locator('#status');
    const arrayBars = page.locator('#arrayContainer .array-bar');
    const treeNodes = page.locator('#treeContainer .node');

    // Buttons should exist and be enabled initially
    await expect(startBtn).toBeVisible();
    await expect(startBtn).toBeEnabled();
    await expect(resetBtn).toBeVisible();
    await expect(resetBtn).toBeEnabled();

    // Status must show the idle message (evidence for S0_Idle)
    await expect(status).toHaveText('Ready to begin heap sort');

    // The array should be rendered with the configured length (arraySize)
    await expect(arrayBars).toHaveCount(EXPECTED_ARRAY_SIZE);

    // The tree should render nodes for each array element (heapSize initialized to array.length)
    // Note: tree nodes use class 'node'
    await expect(treeNodes).toHaveCount(EXPECTED_ARRAY_SIZE);

    // Each array bar should have a data-value attribute and a non-zero height style
    const barCount = await arrayBars.count();
    for (let i = 0; i < barCount; i++) {
      const bar = arrayBars.nth(i);
      const dataValue = await bar.getAttribute('data-value');
      expect(dataValue).not.toBeNull();
      const height = await bar.evaluate(el => el.style.height);
      expect(height && height.length).toBeGreaterThan(0);
    }
  });

  test('StartVisualization (S0 -> S1): clicking Start transitions to Sorting and updates status', async ({ page }) => {
    // This test validates the transition from Idle to Sorting upon clicking #startBtn.
    // It asserts immediate, observable effects: startBtn.disabled becomes true and status updates to "Building max heap..."
    const startBtn = page.locator('#startBtn');
    const status = page.locator('#status');

    // Click start and then assert immediate side effects
    await startBtn.click();

    // startBtn should be disabled as the sorting process starts (evidence in code: startBtn.disabled = true)
    await expect(startBtn).toBeDisabled();

    // The first updateStatus call in heapSort sets status to "Building max heap..."
    await expect(status).toHaveText('Building max heap...', { timeout: 3000 });

    // The status element should have the 'pulse' class added by updateStatus
    await expect(status).toHaveClass(/pulse/);

    // Ensure that no uncaught JS errors happened during the initiation of sorting
    // (pageErrors will be asserted empty in afterEach)
  });

  test('Guard: clicking Start while sorting should not trigger a second sorting run (S1 guard)', async ({ page }) => {
    // Validate the guard in Sorting state: If isSorting is true, subsequent Start events should be ignored.
    // Because the button is disabled during sorting, UI-level prevention occurs as well.
    const startBtn = page.locator('#startBtn');
    const status = page.locator('#status');

    // Start sorting
    await startBtn.click();
    await expect(startBtn).toBeDisabled();
    await expect(status).toHaveText('Building max heap...', { timeout: 3000 });

    // Try to click start again - this should have no effect because the button is disabled.
    // We'll attempt both a user click and a programmatic click to observe behavior.
    // First, a user click (should be ignored due to disabled button)
    await startBtn.click({ timeout: 100 }).catch(() => {
      // If Playwright disallows clicking a disabled button, that's expected; ignore the exception.
    });

    // Second, attempt a programmatic click inside the page context.
    // Note: document.getElementById('startBtn').click() may not trigger for disabled buttons in the browser.
    // We call it to allow the page's own guard (if somehow invoked) to handle re-entrance protection.
    await page.evaluate(() => {
      const btn = document.getElementById('startBtn');
      if (btn) {
        try { btn.click(); } catch (e) { /* swallow - we are intentionally probing behavior */ }
      }
    });

    // Confirm the UI still shows the same initial sorting status and the button remains disabled.
    await expect(status).toHaveText('Building max heap...', { timeout: 3000 });
    await expect(startBtn).toBeDisabled();

    // No uncaught errors should have been thrown while probing the guard.
  });

  test('ResetVisualization during Sorting: status resets but start button remains disabled (detect FSM vs implementation mismatch)', async ({ page }) => {
    // This test exercises the transition S1_Sorting -> S0_Idle via ResetVisualization.
    // FSM expected onExit to set isSorting = false and startBtn.disabled = false.
    // The actual implementation attaches resetBtn to init(), which sets status but does NOT clear isSorting or re-enable the start button.
    // We verify the implemented behavior and surface the mismatch with the FSM expectations.
    const startBtn = page.locator('#startBtn');
    const resetBtn = page.locator('#resetBtn');
    const status = page.locator('#status');

    // Start sorting
    await startBtn.click();
    await expect(startBtn).toBeDisabled();
    await expect(status).toHaveText('Building max heap...', { timeout: 3000 });

    // Now trigger reset while sorting is active
    await resetBtn.click();

    // Implementation: init() sets the status back to 'Ready to begin heap sort'
    await expect(status).toHaveText('Ready to begin heap sort', { timeout: 3000 });

    // FSM expectation (exit actions) would re-enable the start button; implementation does NOT.
    // Assert the implementation behavior: startBtn remains disabled (indicating isSorting was not cleared)
    await expect(startBtn).toBeDisabled();

    // This validates an implementation vs FSM mismatch: status was reset, but onExit actions from FSM did not occur.
    // (We do not modify the page to "fix" this; we only observe and assert.)
  });

  test('ResetVisualization from Idle (S2_Reset -> S0_Idle): Reset restores ready state without errors', async ({ page }) => {
    // When in Idle (not sorting), clicking Reset should reinitialize the array and status to the ready message.
    // This validates the S2_Reset -> S0_Idle transition in benign conditions.
    const startBtn = page.locator('#startBtn');
    const resetBtn = page.locator('#resetBtn');
    const status = page.locator('#status');
    const arrayBars = page.locator('#arrayContainer .array-bar');
    const treeNodes = page.locator('#treeContainer .node');

    // Sanity precondition: ensure we're idle
    await expect(status).toHaveText('Ready to begin heap sort');
    await expect(startBtn).toBeEnabled();

    // Capture current data-values to ensure re-render actually changes array content
    const beforeValues = await arrayBars.evaluateAll(nodes => nodes.map(n => n.getAttribute('data-value')));

    // Click reset in idle state
    await resetBtn.click();

    // Status should be reset to the same ready message (init sets it explicitly)
    await expect(status).toHaveText('Ready to begin heap sort');

    // Array should still have the expected number of bars and nodes
    await expect(arrayBars).toHaveCount(EXPECTED_ARRAY_SIZE);
    await expect(treeNodes).toHaveCount(EXPECTED_ARRAY_SIZE);

    // After reset, the array values are re-randomized. It's possible (though unlikely) to be identical;
    // however, we ensure the structure re-renders properly and that no errors occurred.
    const afterValues = await arrayBars.evaluateAll(nodes => nodes.map(n => n.getAttribute('data-value')));
    expect(afterValues.length).toBe(EXPECTED_ARRAY_SIZE);

    // Ensure start button is still enabled in idle after reset
    await expect(startBtn).toBeEnabled();
  });

  test('Edge case: multiple rapid resets and interactions should not produce uncaught exceptions', async ({ page }) => {
    // Stress-test the Reset button with multiple rapid clicks in idle state and while sorting,
    // ensuring the application does not throw uncaught exceptions.
    const startBtn = page.locator('#startBtn');
    const resetBtn = page.locator('#resetBtn');
    const status = page.locator('#status');

    // Rapid resets in idle
    await resetBtn.click();
    await resetBtn.click();
    await resetBtn.click();

    await expect(status).toHaveText('Ready to begin heap sort');

    // Start sorting, then hammer reset a few times
    await startBtn.click();
    await expect(startBtn).toBeDisabled();
    // Press reset multiple times quickly while sorting
    await resetBtn.click();
    await resetBtn.click();
    await resetBtn.click();

    // Status should reflect the last init call; implementation sets it to ready
    await expect(status).toHaveText('Ready to begin heap sort', { timeout: 3000 });

    // No uncaught exceptions should have been emitted during rapid interactions
    // (Assertion of pageErrors enforced in afterEach)
  });
});