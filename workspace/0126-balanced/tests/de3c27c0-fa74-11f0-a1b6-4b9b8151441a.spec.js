import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3c27c0-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('Floyd-Warshall FSM - de3c27c0-fa74-11f0-a1b6-4b9b8151441a', () => {
  // Reuse selectors from the FSM / HTML
  const sizeSelector = 'input#size';
  const createButton = "button[onclick='createGraphInput()']";
  const runButton = "button[onclick='runAlgorithm()']";
  const graphContainer = '#graph-container';
  const stepsSelector = '#steps';

  test.beforeEach(async ({ page }) => {
    // Navigate to the page fresh for each test
    await page.goto(APP_URL);
  });

  // Test: Initial Idle state - verify presence of key controls (S0_Idle)
  test('S0_Idle: initial page has expected controls (size input, Create Matrix, Run Algorithm)', async ({ page }) => {
    // Validate that the size input exists and has default value 4
    const sizeValue = await page.$eval(sizeSelector, el => el.value);
    expect(sizeValue).toBe('4');

    // Validate that buttons exist
    const createExists = await page.$(createButton);
    const runExists = await page.$(runButton);
    expect(createExists).not.toBeNull();
    expect(runExists).not.toBeNull();

    // Ensure graph container and steps container exist
    const gc = await page.$(graphContainer);
    const steps = await page.$(stepsSelector);
    expect(gc).not.toBeNull();
    expect(steps).not.toBeNull();
  });

  // Test: Transition S0 -> S1 (Create Matrix) and verify DOM updates (Matrix Created)
  test('S0 -> S1: clicking Create Matrix builds the input matrix with expected structure', async ({ page }) => {
    // Click the Create Matrix button
    await page.click(createButton);

    // For default size 4, the container should have (n+1)^2 children = 25
    const childrenCount = await page.$eval(graphContainer, el => el.children.length);
    expect(childrenCount).toBe(25);

    // Validate some specific inputs and values created by createGraphInput()
    // Diagonal cell should be '0'
    const diagValue = await page.$eval('#cell-0-0', el => el.value);
    expect(diagValue).toBe('0');

    // Off-diagonal values should reflect the sampleGraph (e.g., cell-0-1 = 3 from sampleGraph)
    const offValue = await page.$eval('#cell-0-1', el => el.value);
    // sampleGraph[0][1] is 3, so expect the input to be '3'
    expect(offValue).toBe('3');

    // Creating the matrix twice should reset and recreate (no accumulation)
    await page.click(createButton);
    const childrenCountAfter = await page.$eval(graphContainer, el => el.children.length);
    expect(childrenCountAfter).toBe(25);
  });

  // Test: Edge case - RunAlgorithm invoked without creating matrix -> getInputGraph will attempt to read non-existent inputs -> expect a TypeError
  test('Error scenario: clicking Run Algorithm without creating matrix should raise a TypeError (missing inputs)', async ({ page }) => {
    // Wait for the pageerror event that should be thrown when runAlgorithm tries to access missing DOM elements
    const [error] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click(runButton),
    ]);

    // The error should be a TypeError because getInputGraph accesses .value on null if inputs are missing
    expect(error).toBeDefined();
    // Different browsers may craft messages differently; assert the error name is TypeError
    expect(error.name).toBe('TypeError');
  });

  // Test: S1 -> S2 and S2 -> S3: create matrix then run algorithm -> runtime attempts to call missing displayStep -> ReferenceError expected
  test('S1 -> S2 -> S3: after creating matrix, running algorithm triggers ReferenceError due to missing displayStep', async ({ page }) => {
    // Create the matrix first (transition S0 -> S1)
    await page.click(createButton);

    // Optionally mutate some inputs to ensure getInputGraph reads values (we'll set a cell to INF to exercise parsing)
    await page.fill('#cell-0-2', 'INF'); // set a disconnected edge explicitly
    await page.fill('#cell-1-2', '7');   // overwrite a value

    // Now attempt to run the algorithm and wait for the page-level error.
    // The implementation calls displayStep(...) which is not defined in the provided JS -> ReferenceError expected.
    const [error] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click(runButton),
    ]);

    // Verify it's a ReferenceError related to displayStep
    expect(error).toBeDefined();
    expect(error.name).toBe('ReferenceError');

    // Error message should reference displayStep if present in the environment; check that the string 'displayStep' is in message when available.
    if (typeof error.message === 'string') {
      expect(error.message.toLowerCase()).toContain('displaystep');
    }

    // Also verify that steps container was cleared (runAlgorithm sets innerHTML = '' before calling displayStep)
    const stepsHtml = await page.$eval(stepsSelector, el => el.innerHTML);
    expect(stepsHtml).toBe('');
  });

  // Test: getInputGraph works correctly after creating a smaller matrix (edge case size=2)
  test('Edge case: set size to 2, create matrix, and verify getInputGraph returns expected 2x2 graph', async ({ page }) => {
    // Change size to 2
    await page.fill(sizeSelector, '2');

    // Click create matrix
    await page.click(createButton);

    // Validate DOM structure: (n+1)^2 = 9 children for size 2
    const childrenCount = await page.$eval(graphContainer, el => el.children.length);
    expect(childrenCount).toBe(9);

    // Call the page's getInputGraph() function via evaluate to extract the graph object
    const graph = await page.evaluate(() => {
      // getInputGraph is defined in the page script; return its result
      try {
        return getInputGraph();
      } catch (e) {
        // If there's any unexpected error, return a sentinel so the test fails with meaningful info
        return { __error__: e.message || String(e) };
      }
    });

    // Ensure graph was returned and has expected dimensions
    expect(Array.isArray(graph)).toBeTruthy();
    expect(graph.length).toBe(2);
    expect(graph[0].length).toBe(2);

    // Based on the sampleGraph, for size 2 we expect:
    // graph[0][0] === 0, graph[0][1] === 3
    // graph[1][0] === 2, graph[1][1] === 0
    expect(graph[0][0]).toBe(0);
    expect(graph[0][1]).toBe(3);
    expect(graph[1][0]).toBe(2);
    expect(graph[1][1]).toBe(0);
  });

  // Test: Verify createGraphInput produces consistent ids and values for a couple of cells (structural assertions)
  test('Matrix structure: verify presence of labeled headers and specific cell ids after creation', async ({ page }) => {
    await page.click(createButton);

    // Check header labels (first row of container) - accessible via the container children
    const headers = await page.$$eval('#graph-container > div:nth-child(-n+4)', nodes => nodes.map(n => n.textContent.trim()));
    // For default size 4, first 4 header cells (since first cell is blank then A..D)
    // The first header might be empty string, then 'A','B','C','D' for the sample
    expect(headers.length).toBeGreaterThanOrEqual(1);

    // Ensure ids for a couple of inputs exist
    const ids = ['cell-0-0', 'cell-2-3', 'cell-3-2'];
    for (const id of ids) {
      const el = await page.$(`#${id}`);
      expect(el).not.toBeNull();
    }
  });

  // Test: Observability - capture console messages during normal Create Matrix flow (no unexpected errors)
  test('Observability: creating matrix should not emit page errors (no exceptions during createGraphInput)', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    // Create matrix
    await page.click(createButton);

    // Wait a brief moment to ensure no asynchronous errors are thrown
    await page.waitForTimeout(200);

    // Validate that no page errors were recorded during creation
    expect(pageErrors.length).toBe(0);
  });
});