import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324dd4f2-fa73-11f0-a9d0-d7a1991987c6.html';

test.describe('Floyd-Warshall Algorithm Visualization (FSM: Idle -> AlgorithmRunning -> ResultsDisplayed)', () => {
  // Containers for console and page errors observed during each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture unhandled page errors (e.g., ReferenceError, TypeError ...)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the page. Listeners registered before navigation to capture load-time errors.
    await page.goto(APP_URL);
    // Ensure main components are present before assertions
    await page.waitForSelector('#matrix');
    await page.waitForSelector('button[onclick="runFloydWarshall()"]');
    await page.waitForSelector('#output');
  });

  test.afterEach(async () => {
    // By default assert there were no console or page errors in each test scenario.
    // This validates that the page runs without runtime exceptions (ReferenceError, SyntaxError, TypeError).
    expect(consoleErrors.length, `Expected no console.error messages, but got: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Expected no page errors, but got: ${pageErrors.map(e => String(e)).join(', ')}`).toBe(0);
  });

  test('S0_Idle: On load the matrix table is created (createMatrixTable()) and shows initial adjacency matrix', async ({ page }) => {
    // This test validates the initial state S0_Idle:
    // - createMatrixTable() should populate the #matrix table
    // - the table should have numVertices rows and correct initial cell values (including "∞" for Infinity)

    const expectedInitial = [
      ['0', '3', '∞', '7'],
      ['∞', '0', '1', '∞'],
      ['∞', '∞', '0', '2'],
      ['6', '∞', '∞', '0']
    ];

    // Extract matrix cell texts row-major
    const matrixValues = await page.$$eval('#matrix tr', (rows) =>
      rows.map((row) => Array.from(row.querySelectorAll('td')).map((td) => td.textContent.trim()))
    );

    // Assert we have 4 rows and each row has 4 columns
    expect(matrixValues.length).toBe(4);
    for (let r = 0; r < 4; r++) {
      expect(matrixValues[r].length).toBe(4);
      expect(matrixValues[r]).toEqual(expectedInitial[r]);
    }

    // Ensure the Run button exists and displays expected text
    const runBtnText = await page.$eval('button[onclick="runFloydWarshall()"]', (btn) => btn.textContent.trim());
    expect(runBtnText).toBe('Run Floyd-Warshall Algorithm');
  });

  test('S0 -> S1 -> S2 transition: Clicking Run triggers runFloydWarshall() and displayOutput(result)', async ({ page }) => {
    // This test validates the transition from Idle to AlgorithmRunning to ResultsDisplayed:
    // - Clicking the button should run the algorithm and produce output in #output
    // - The output should include an <h2> header and a result table with the shortest path distances

    // Expected final distances computed from the algorithm
    const expectedFinal = [
      ['0', '3', '4', '6'],
      ['9', '0', '1', '3'],
      ['8', '11', '0', '2'],
      ['6', '9', '10', '0']
    ];

    // Click the Run button to initiate the algorithm
    await page.click('button[onclick="runFloydWarshall()"]');

    // Wait for the output header to appear indicating displayOutput was called
    await page.waitForSelector('#output h2');

    // Verify the header content
    const headerText = await page.$eval('#output h2', (h2) => h2.textContent.trim());
    expect(headerText).toBe('Shortest Path Distances');

    // Extract the result table that displayOutput appended
    const resultTableExists = await page.$('#output table');
    expect(resultTableExists).not.toBeNull();

    const resultValues = await page.$$eval('#output table tr', (rows) =>
      rows.map((row) => Array.from(row.querySelectorAll('td')).map((td) => td.textContent.trim()))
    );

    // Validate dimensions and numerical results match expectedFinal
    expect(resultValues.length).toBe(4);
    for (let r = 0; r < 4; r++) {
      expect(resultValues[r].length).toBe(4);
      expect(resultValues[r]).toEqual(expectedFinal[r]);
    }
  });

  test('Idempotency and repeated runs: Clicking Run multiple times produces consistent output and does not duplicate header', async ({ page }) => {
    // This test validates repeated interaction edge-case:
    // - Clicking Run twice should still display a single header + one table in #output
    // - Results should remain identical and not accumulate multiple headers or tables

    const expectedFinal = [
      ['0', '3', '4', '6'],
      ['9', '0', '1', '3'],
      ['8', '11', '0', '2'],
      ['6', '9', '10', '0']
    ];

    // First run
    await page.click('button[onclick="runFloydWarshall()"]');
    await page.waitForSelector('#output h2');

    // Second run
    await page.click('button[onclick="runFloydWarshall()"]');
    // Still expect exactly one header and one table (displayOutput replaces innerHTML then appends table)
    const headers = await page.$$eval('#output h2', (els) => els.map((e) => e.textContent.trim()));
    const tables = await page.$$('#output table');

    expect(headers.length).toBe(1);
    expect(headers[0]).toBe('Shortest Path Distances');
    expect(tables.length).toBe(1);

    // Validate table content remains consistent
    const resultValues = await page.$$eval('#output table tr', (rows) =>
      rows.map((row) => Array.from(row.querySelectorAll('td')).map((td) => td.textContent.trim()))
    );

    for (let r = 0; r < 4; r++) {
      expect(resultValues[r]).toEqual(expectedFinal[r]);
    }
  });

  test('Edge cases: initial matrix contains "∞" (Infinity) while result matrix contains no "∞"', async ({ page }) => {
    // This test ensures that Infinity values are displayed as "∞" in the initial matrix,
    // and that after running the algorithm the final result table has resolved those to finite numbers.

    // Check positions that should be Infinity initially
    const initialMatrix = await page.$$eval('#matrix tr', (rows) =>
      rows.map((row) => Array.from(row.querySelectorAll('td')).map((td) => td.textContent.trim()))
    );

    // Coordinates where Infinity expected in initial matrix (r,c)
    const infPositions = [
      [0, 2],
      [1, 0],
      [1, 3],
      [2, 0],
      [2, 1],
      [3, 1],
      [3, 2]
    ];

    for (const [r, c] of infPositions) {
      expect(initialMatrix[r][c]).toBe('∞');
    }

    // Run algorithm
    await page.click('button[onclick="runFloydWarshall()"]');
    await page.waitForSelector('#output table');

    // Ensure no "∞" in the result table
    const resultValues = await page.$$eval('#output table tr', (rows) =>
      rows.flatMap((row) => Array.from(row.querySelectorAll('td')).map((td) => td.textContent.trim()))
    );

    // None of the result cell texts should be the infinity symbol
    expect(resultValues.some((v) => v === '∞')).toBe(false);

    // Also ensure all values are parseable as integers (since final distances are finite integers)
    for (const v of resultValues) {
      // Allow negative or positive integers; in this graph they're non-negative.
      expect(Number.isFinite(Number(v))).toBe(true);
    }
  });

  test('Observes console and runtime errors during load and interactions (assert none occurred)', async ({ page }) => {
    // This explicit test demonstrates observation of console and page errors during the lifecycle.
    // The assertions are performed in the afterEach hook, but we further assert here for clarity.

    // Perform a run to potentially trigger runtime issues
    await page.click('button[onclick="runFloydWarshall()"]');
    await page.waitForSelector('#output h2');

    // Assert captured error arrays are empty (no runtime exceptions or console.error)
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});