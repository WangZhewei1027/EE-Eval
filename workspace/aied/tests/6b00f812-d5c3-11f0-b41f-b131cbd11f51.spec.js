import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b00f812-d5c3-11f0-b41f-b131cbd11f51.html';

test.describe('Dijkstra\'s Algorithm Visualization - FSM tests (6b00f812-d5c3-11f0-b41f-b131cbd11f51)', () => {
  // Collect console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      // Save text and type for assertions / debugging
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions / page errors
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure key elements are present before proceeding
    await expect(page.locator('#graphType')).toBeVisible();
    await expect(page.locator('#startNode')).toBeVisible();
    await expect(page.locator('#endNode')).toBeVisible();
    await expect(page.locator('#runAlgorithm')).toBeVisible();
    await expect(page.locator('#resetGraph')).toBeVisible();
    await expect(page.locator('#pathResult')).toBeVisible();
    await expect(page.locator('#distanceResult')).toBeVisible();
  });

  test.afterEach(async () => {
    // Basic sanity: no unexpected fatal page errors (SyntaxError/ReferenceError/TypeError)
    // If there are pageErrors we fail the test to surface runtime issues.
    const fatalErrors = pageErrors.filter(err =>
      /ReferenceError|TypeError|SyntaxError/i.test(String(err))
    );
    expect(fatalErrors.length).toBe(0);
  });

  test.describe('Initial State (S0_Idle)', () => {
    test('should show default UI texts and have canvas drawn via drawGraph() on load', async ({ page }) => {
      // This test validates the initial Idle state:
      // - Entry action drawGraph() was invoked (visual evidence is canvas content; we assert DOM defaults)
      // - Path and distance placeholders are correct

      const pathResult = page.locator('#pathResult');
      const distanceResult = page.locator('#distanceResult');
      const canvas = page.locator('#graphCanvas');

      // Validate default texts per the implementation (S0_Idle expected observables)
      await expect(pathResult).toHaveText('Click "Run Algorithm" to find the shortest path');
      await expect(distanceResult).toHaveText('Total distance: -');

      // Canvas should exist and have reasonable dimensions set by resizeCanvas()
      const canvasWidth = await page.evaluate(() => document.getElementById('graphCanvas').width);
      const canvasHeight = await page.evaluate(() => document.getElementById('graphCanvas').height);
      expect(canvasWidth).toBeGreaterThan(0);
      expect(canvasHeight).toBeGreaterThan(0);

      // Ensure there were no console-level errors emitted during load
      const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleEntries.length).toBe(0);
    });
  });

  test.describe('Run Algorithm and Completion (S0 -> S1 -> S2)', () => {
    test('running Dijkstra from A to F transitions to AlgorithmCompleted and shows shortest path and distance', async ({ page }) => {
      // This test validates:
      // - Clicking Run Algorithm triggers the algorithm (S0 -> S1)
      // - Algorithm completes (S1 -> S2)
      // - UI updates to show Path and Total distance and highlightPath() is invoked (visual change on canvas)

      // Select start=A (default) and end=F
      await page.selectOption('#startNode', 'A');
      await page.selectOption('#endNode', 'F');

      // Click run algorithm
      await Promise.all([
        page.click('#runAlgorithm'),
        // wait for the distanceResult text to update to a numeric value
        page.locator('#distanceResult').waitFor({ state: 'visible' })
      ]);

      // Validate result texts
      const pathText = await page.locator('#pathResult').innerText();
      const distanceText = await page.locator('#distanceResult').innerText();

      // Expected path based on provided graph data:
      // A -> C (2), C -> B (1), B -> D (5), D -> F (6) => total 14
      expect(pathText).toBe('Path: A → C → B → D → F');
      expect(distanceText).toBe('Total distance: 14');

      // Visual effect: while we cannot directly read pixels reliably here,
      // ensure that no runtime console errors occurred during highlighting
      const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleEntries.length).toBe(0);
    });
  });

  test.describe('Reset Graph (S2 -> S0)', () => {
    test('resetting after completion returns UI to Idle defaults and redraws graph', async ({ page }) => {
      // This test validates:
      // - After a successful run, clicking Reset Graph transitions back to Idle (S2 -> S0)
      // - drawGraph() entry action is executed (we validate UI texts reset and canvas dimensions remain valid)

      // First run a successful algorithm (A -> F)
      await page.selectOption('#startNode', 'A');
      await page.selectOption('#endNode', 'F');
      await page.click('#runAlgorithm');

      // Confirm changed state (algorithm completed)
      await expect(page.locator('#pathResult')).toHaveText('Path: A → C → B → D → F');
      await expect(page.locator('#distanceResult')).toHaveText('Total distance: 14');

      // Click Reset Graph to go back to Idle
      await page.click('#resetGraph');

      // Verify UI texts are reset per transition expected_observables
      await expect(page.locator('#pathResult')).toHaveText('Click "Run Algorithm" to find the shortest path');
      await expect(page.locator('#distanceResult')).toHaveText('Total distance: -');

      // Canvas remained present and sized (drawGraph should have re-rendered)
      const canvasWidth = await page.evaluate(() => document.getElementById('graphCanvas').width);
      const canvasHeight = await page.evaluate(() => document.getElementById('graphCanvas').height);
      expect(canvasWidth).toBeGreaterThan(0);
      expect(canvasHeight).toBeGreaterThan(0);

      // Check for console errors during reset
      const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleEntries.length).toBe(0);
    });
  });

  test.describe('Edge Cases & Error Scenarios (S1 -> S3)', () => {
    test('selecting the same start and end node should trigger an alert and prevent algorithm from running', async ({ page }) => {
      // This test validates:
      // - The 'Start and end nodes must be different' alert is shown if user picks same node
      // - No path/distance UI updates occur in that case

      // Ensure both selects are the same (A)
      await page.selectOption('#startNode', 'A');
      await page.selectOption('#endNode', 'A');

      // Listen for dialog and assert message
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('alert');
        expect(dialog.message()).toBe('Start and end nodes must be different');
        await dialog.accept();
      });

      // Click runAlgorithm; this should trigger the alert and do nothing else
      await page.click('#runAlgorithm');

      // Validate UI remained in Idle defaults (no path computed)
      await expect(page.locator('#pathResult')).toHaveText('Click "Run Algorithm" to find the shortest path');
      await expect(page.locator('#distanceResult')).toHaveText('Total distance: -');

      // No page errors due to this interaction
      const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleEntries.length).toBe(0);
    });

    test('observe console and runtime errors across interactions (should not have Reference/Type/Syntax errors)', async ({ page }) => {
      // This test collects console and page errors during a few interactions and asserts
      // that there are no critical runtime errors such as ReferenceError, TypeError, or SyntaxError.

      // Perform several interactions:
      // 1) Run a valid algorithm (A -> F)
      await page.selectOption('#startNode', 'A');
      await page.selectOption('#endNode', 'F');
      await page.click('#runAlgorithm');

      // 2) Reset the graph
      await page.click('#resetGraph');

      // 3) Trigger the same-node alert
      page.once('dialog', async dialog => {
        await dialog.accept();
      });
      await page.selectOption('#startNode', 'B');
      await page.selectOption('#endNode', 'B');
      await page.click('#runAlgorithm');

      // Now evaluate collected console messages and page errors
      // Assert there are no fatal uncaught exceptions
      const fatalPageErrors = pageErrors.filter(err =>
        /ReferenceError|TypeError|SyntaxError/i.test(String(err))
      );
      expect(fatalPageErrors.length).toBe(0);

      // Ensure console errors are not present
      const consoleErrorEntries = consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.type));
      expect(consoleErrorEntries.length).toBe(0);

      // Optionally, report other console info messages exist (drawGraph may log nothing),
      // but the important checks above validate the runtime integrity.
    });
  });
});