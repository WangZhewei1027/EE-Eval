import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2e9992-fa7a-11f0-ba5b-57721b046e74.html';

test.describe.serial('Floyd-Warshall Interactive - FSM validation', () => {
  // Arrays to capture runtime issues and console output
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture any uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages for additional context
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Load page and wait for load event to ensure scripts run (and errors surface)
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Provide diagnostics if a test fails by printing console messages
    if (consoleMessages.length) {
      // eslint-disable-next-line no-console
      console.log('Console messages snapshot:', JSON.stringify(consoleMessages.slice(0, 20), null, 2));
    }
    if (pageErrors.length) {
      // eslint-disable-next-line no-console
      console.log('Page errors snapshot:', pageErrors.map(e => ({ name: e.name, message: String(e.message) })));
    }
  });

  test('Initial load should register a runtime TypeError (observing page errors) and app elements exist', async ({ page }) => {
    // Comment: This test validates that the page loads and that the initial erroneous call (resetAlgorithm())
    // which runs before DOMContentLoaded produces a runtime error (TypeError). We must allow errors to occur naturally.
    expect(pageErrors.length).toBeGreaterThan(0);
    // At least one error should be a TypeError (attempting to access .value of a non-existent input)
    const hasTypeError = pageErrors.some(err => err.name === 'TypeError' || String(err.message).includes('Cannot read'));
    expect(hasTypeError).toBeTruthy();

    // Despite the earlier error, the application attempts to initialize on DOMContentLoaded.
    // Verify critical UI elements exist so we can continue to test transitions.
    await expect(page.locator('input#nodeCount')).toHaveCount(1);
    await expect(page.locator('button#updateSize')).toHaveCount(1);
    await expect(page.locator('#matrixEditor')).toHaveCount(1);
    await expect(page.locator('#runStep')).toHaveCount(1);
    await expect(page.locator('#runFull')).toHaveCount(1);
    await expect(page.locator('#reset')).toHaveCount(1);

    // Check that currentK exists and is a numeric-like string (likely "0")
    const currentK = await page.locator('#currentK').textContent();
    expect(currentK).not.toBeNull();
    // Should be initial value "0"
    expect(currentK.trim()).toMatch(/^\d+$/);

    // operationInfo should at least be present
    const opInfo = await page.locator('#operationInfo').textContent();
    expect(opInfo).not.toBeNull();
  });

  test('Update Size (S0_Idle -> S3_AlgorithmReset) creates matrix editor with expected size and updates path selects', async ({ page }) => {
    // Comment: Simulate UpdateSize event to trigger transition from Idle to AlgorithmReset and validate entry actions
    // Set node count to 5
    await page.fill('#nodeCount', '5');
    await page.click('#updateSize');

    // After clicking updateSize, createMatrixEditor should create a matrix table with header columns = n + 1 (empty header + n)
    const headerCells = await page.locator('#matrixEditor table thead tr th').count();
    expect(headerCells).toBe(6); // 5 nodes + 1 empty header

    // Also the path select dropdowns should have 5 options each
    const fromOptions = await page.locator('#pathFrom option').count();
    const toOptions = await page.locator('#pathTo option').count();
    expect(fromOptions).toBe(5);
    expect(toOptions).toBe(5);

    // currentK should be reset to 0 on AlgorithmReset entry action
    await expect(page.locator('#currentK')).toHaveText('0');

    // operationInfo should reflect a reset (resetAlgorithm sets 'Algorithm reset')
    await expect(page.locator('#operationInfo')).toHaveText(/Algorithm reset/i);
  });

  test('Generate Random Graph (S3_AlgorithmReset -> S0_Idle) fills adjacency inputs and updates visualization', async ({ page }) => {
    // Comment: From reset state, clicking "Generate Random Graph" should populate edge inputs and update visuals
    // Ensure we have a matrix (from previous test) or create one if not
    const nodeCountValue = await page.locator('#nodeCount').inputValue();
    const n = parseInt(nodeCountValue, 10) || 4;

    // Click randomGraph (should call generateRandomGraph and updateVisualization)
    await page.click('#randomGraph');

    // Verify that at least diagonal inputs exist and have '0' and others are present in DOM
    const diagInput = page.locator(`#edge-0-0`);
    await expect(diagInput).toHaveCount(1);
    await expect(diagInput).toHaveValue('0');

    // Verify currentMatrix table rendered
    await expect(page.locator('#currentMatrix table')).toHaveCount(1);

    // Graph canvas should be present in graph-container
    const canvas = page.locator('#graph-container canvas');
    await expect(canvas).toHaveCount(1);
  });

  test('Run Step (S3_AlgorithmReset -> S1_AlgorithmRunning) increments currentK and updates operation info', async ({ page }) => {
    // Comment: Clicking step forward should process one intermediate node (performStep) and update currentK by 1
    // Ensure reset state
    await page.click('#reset'); // ensure we are reset

    // Read initial K
    const initialK = parseInt(await page.locator('#currentK').textContent(), 10);
    expect(initialK).toBeGreaterThanOrEqual(0);

    // Click step forward
    await page.click('#runStep');

    // After performing a step, currentK should increment by 1
    const newKText = await page.locator('#currentK').textContent();
    const newK = parseInt(newKText, 10);
    expect(newK).toBe(initialK + 1);

    // operationInfo should indicate processing of an intermediate node (Processing intermediate node X)
    const opInfo = (await page.locator('#operationInfo').textContent()) || '';
    expect(opInfo).toMatch(/Processing intermediate node\s*\d+/i);
  });

  test('Run Full to Completion (S1_AlgorithmRunning -> S2_AlgorithmCompleted) completes algorithm and toggles controls', async ({ page }) => {
    // Comment: Start algorithm (run to completion) and wait until operationInfo indicates completion
    // Prepare a small graph to ensure completion occurs quickly; set nodeCount to 3 and update
    await page.fill('#nodeCount', '3');
    await page.click('#updateSize');

    // Set speed to high to accelerate timeouts
    await page.fill('#speedControl', '10');
    // Trigger input event by dispatching manual change: use set input value via JavaScript to ensure change event fires
    await page.evaluate(() => {
      const slider = document.getElementById('speedControl');
      slider.value = '10';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Ensure deterministic edges so algorithm has something to work on; fill some inputs and reset algorithm
    // We'll create a simple fully connected graph with small weights
    await page.fill('#edge-0-1', '1');
    await page.fill('#edge-1-2', '1');
    await page.fill('#edge-0-2', '5');
    await page.fill('#edge-1-0', '');
    await page.fill('#edge-2-0', '');
    await page.fill('#edge-2-1', '');
    // Ensure diagonals
    await page.fill('#edge-0-0', '0');
    await page.fill('#edge-1-1', '0');
    await page.fill('#edge-2-2', '0');

    // Click reset to load these values into the algorithm state
    await page.click('#reset');

    // Click runFull to start the algorithm
    await page.click('#runFull');

    // Wait for operationInfo to show 'Algorithm completed' within a reasonable timeout
    await page.waitForFunction(() => {
      const el = document.getElementById('operationInfo');
      return el && el.textContent && el.textContent.includes('Algorithm completed');
    }, { timeout: 5000 });

    // Verify operationInfo is 'Algorithm completed'
    await expect(page.locator('#operationInfo')).toHaveText(/Algorithm completed/i);

    // Verify currentK equals node count (3)
    await expect(page.locator('#currentK')).toHaveText('3');

    // The runFull button should have its text reset to 'Run to Completion'
    await expect(page.locator('#runFull')).toHaveText(/Run to Completion/i);
  });

  test('Find Path (S2_AlgorithmCompleted -> S3_AlgorithmReset) reconstructs and highlights path after completion', async ({ page }) => {
    // Comment: Set up a small deterministic graph (3 nodes) where a path 0->1->2 exists and verify findPath reconstructs it.
    await page.fill('#nodeCount', '3');
    await page.click('#updateSize');

    // Build explicit edges: 0->1 (1), 1->2 (1), 0->2 (empty so it relies on intermediate)
    await page.fill('#edge-0-0', '0');
    await page.fill('#edge-1-1', '0');
    await page.fill('#edge-2-2', '0');
    await page.fill('#edge-0-1', '1');
    await page.fill('#edge-1-2', '1');
    await page.fill('#edge-0-2', '', { timeout: 100 }).catch(() => {});
    await page.fill('#edge-1-0', '', { timeout: 100 }).catch(() => {});
    await page.fill('#edge-2-0', '', { timeout: 100 }).catch(() => {});
    await page.fill('#edge-2-1', '', { timeout: 100 }).catch(() => {});

    // Reset algorithm so the graph is read into the algorithm state
    await page.click('#reset');

    // Run algorithm to completion
    // Speed up the run
    await page.evaluate(() => {
      const slider = document.getElementById('speedControl');
      slider.value = '10';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.click('#runFull');

    // Wait for completion
    await page.waitForFunction(() => {
      const el = document.getElementById('operationInfo');
      return el && el.textContent && el.textContent.includes('Algorithm completed');
    }, { timeout: 5000 });

    // Choose From = 0, To = 2
    await page.selectOption('#pathFrom', '0');
    await page.selectOption('#pathTo', '2');

    // Click findPath to reconstruct and show path
    await page.click('#findPath');

    // The pathResult should list the path 0 → 1 → 2 and total weight 2
    const pathResultText = await page.locator('#pathResult').textContent();
    expect(pathResultText).toMatch(/Shortest path from 0 to 2/i);
    expect(pathResultText).toMatch(/0\s*→\s*1\s*→\s*2/);
    expect(pathResultText).toMatch(/\(Total weight:\s*2\)/);

    // The pathSteps should show reconstruction steps listing the direct edges
    const pathStepsHtml = await page.locator('#pathSteps').innerHTML();
    expect(pathStepsHtml).toContain('Direct edge from 0 to 1');
    expect(pathStepsHtml).toContain('Direct edge from 1 to 2');

    // The currentMatrix table should contain at least some td elements with class 'path' (highlight)
    const pathCells = await page.locator('#currentMatrix td.path').count();
    expect(pathCells).toBeGreaterThanOrEqual(1);
  });

  test('Find Path before completion shows appropriate error message (edge case)', async ({ page }) => {
    // Comment: Ensure that findPath when algorithm hasn't completed warns the user
    // Setup a small graph (3 nodes), but do NOT run to completion
    await page.fill('#nodeCount', '3');
    await page.click('#updateSize');

    // Ensure reset so state is at currentK = 0
    await page.click('#reset');

    // Select a pair and click findPath
    await page.selectOption('#pathFrom', '0');
    await page.selectOption('#pathTo', '1');
    await page.click('#findPath');

    // Expect an informative message requiring completion first
    await expect(page.locator('#pathResult')).toHaveText(/Algorithm must complete first/i);
  });

  test('Reset while running should return to AlgorithmReset state (S1_AlgorithmRunning -> S3_AlgorithmReset)', async ({ page }) => {
    // Comment: Start the algorithm and then trigger Reset to test onExit behavior and return to reset state
    // Prepare a small graph
    await page.fill('#nodeCount', '3');
    await page.click('#updateSize');

    // Make sure values exist
    await page.fill('#edge-0-1', '1').catch(() => {});
    await page.fill('#edge-1-2', '1').catch(() => {});
    await page.fill('#edge-0-0', '0').catch(() => {});
    await page.fill('#edge-1-1', '0').catch(() => {});
    await page.fill('#edge-2-2', '0').catch(() => {});

    // Reset to load them
    await page.click('#reset');

    // Start runFull (this toggles to running)
    await page.click('#runFull');

    // Immediately click reset to simulate a stop/reset while running
    await page.click('#reset');

    // After reset, currentK should be 0 and operationInfo should be 'Algorithm reset'
    await expect(page.locator('#currentK')).toHaveText('0');
    await expect(page.locator('#operationInfo')).toHaveText(/Algorithm reset/i);

    // runFull button text should be default
    await expect(page.locator('#runFull')).toHaveText(/Run to Completion/i);
  });

  test('Change speed updates UI (ChangeSpeed event) and is reflected in label', async ({ page }) => {
    // Comment: Changing speedControl should update speedValue text content
    await page.fill('#speedControl', '7');
    await page.evaluate(() => {
      const e = new Event('input', { bubbles: true });
      document.getElementById('speedControl').dispatchEvent(e);
    });

    await expect(page.locator('#speedValue')).toHaveText('7x');
  });

  test('UpdateSize with edge cases: minimum and maximum values create valid editors', async ({ page }) => {
    // Comment: Validate UpdateSize works at boundaries (min 2, max 10)
    // Minimum
    await page.fill('#nodeCount', '2');
    await page.click('#updateSize');
    const minHeaderCount = await page.locator('#matrixEditor table thead tr th').count();
    expect(minHeaderCount).toBe(3); // 2 nodes + 1 empty header

    // Maximum
    await page.fill('#nodeCount', '10');
    await page.click('#updateSize');
    const maxHeaderCount = await page.locator('#matrixEditor table thead tr th').count();
    expect(maxHeaderCount).toBe(11); // 10 nodes + 1 empty header
  });

  test('Validate that runtime TypeError observed during initial script execution is preserved in page errors', async ({ page }) => {
    // Comment: Confirm that the original runtime error (TypeError) is present in the captured page errors,
    // ensuring we did not patch or suppress errors.
    const hasTypeError = pageErrors.some(err => err.name === 'TypeError' || String(err.message).includes('Cannot read'));
    expect(hasTypeError).toBeTruthy();
  });
});