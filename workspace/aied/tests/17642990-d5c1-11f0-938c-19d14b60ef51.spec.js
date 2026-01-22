import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/17642990-d5c1-11f0-938c-19d14b60ef51.html';

/**
 * Page Object for interacting with the Floyd-Warshall demo page.
 * Encapsulates selectors and common operations to keep tests readable.
 */
class FloydWarshallPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator('#runAlgorithmBtn');
    this.graphTable = page.locator('#graphTable');
    this.resultTable = page.locator('#resultTable');

    // collectors for console errors and page errors
    this.consoleErrors = [];
    this.pageErrors = [];
  }

  async initErrorListeners() {
    // collect console messages and pageerrors for assertions later
    this.page.on('console', (msg) => {
      // store only errors for focused assertions; keep text for diagnostics
      if (msg.type() === 'error') {
        this.consoleErrors.push(msg.text());
      }
    });
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(String(err));
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  /**
   * Parse a table element into a 2D array of strings/numbers.
   * It strips the first header column/row and returns the matrix of cell contents.
   * Example return: [[ "0", "3", "∞", "5" ], ...]
   * @param {'graph' | 'result'} which
   */
  async readMatrix(which = 'graph') {
    const table = which === 'graph' ? this.graphTable : this.resultTable;
    // Wait for the table element to exist in DOM
    await expect(table).toBeVisible();
    // Get all rows
    const rows = await table.locator('tr').all();
    // First row is header, following rows have a leading th then data td cells
    const matrix = [];
    for (let i = 1; i < rows.length; i++) {
      const cells = await rows[i].locator('td').allTextContents();
      // cells is array of strings (cell text)
      matrix.push(cells.map(text => text.trim()));
    }
    return matrix;
  }

  async clickRun() {
    await expect(this.runButton).toBeVisible();
    await this.runButton.click();
  }

  /**
   * Returns true if any cell in the result table has class "highlight"
   */
  async resultHasHighlights() {
    // if result table has no rows yet, return false
    const rows = await this.resultTable.locator('tr').count();
    if (rows === 0) return false;
    const highlighted = await this.resultTable.locator('td.highlight').count();
    return highlighted > 0;
  }
}

/**
 * Expected matrices used in assertions.
 */
const EXPECTED_GRAPH_MATRIX = [
  ['0', '3', '∞', '5'],
  ['2', '0', '∞', '4'],
  ['∞', '1', '0', '∞'],
  ['∞', '∞', '2', '0'],
];

const EXPECTED_RESULT_MATRIX = [
  ['0', '3', '7', '5'],
  ['2', '0', '6', '4'],
  ['3', '1', '0', '5'],
  ['5', '3', '2', '0'],
];

test.describe('Floyd-Warshall Visualization - FSM states and transitions', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    // Nothing global here; each test will create its own page object and navigate.
  });

  test('S0_Idle: on initial load the graph table is created (createTable entry action)', async ({ page }) => {
    // This test validates the initial Idle state (S0_Idle)
    const app = new FloydWarshallPage(page);
    await app.initErrorListeners();
    await app.goto();

    // Validate that the run button exists and is visible (component presence)
    await expect(app.runButton).toBeVisible();
    await expect(app.runButton).toHaveText(/Run Floyd-Warshall Algorithm/);

    // Validate graphTable was created and filled as the createTable('graphTable', graph) entry action states
    const graphMatrix = await app.readMatrix('graph');
    expect(graphMatrix).toEqual(EXPECTED_GRAPH_MATRIX);

    // Assert there were no console or page errors on load (we observe errors but expect none for this implementation)
    expect(app.consoleErrors, `console.error messages encountered: ${app.consoleErrors.join(' | ')}`).toHaveLength(0);
    expect(app.pageErrors, `page errors encountered: ${app.pageErrors.join(' | ')}`).toHaveLength(0);
  });

  test('Transition S0_Idle -> S1_AlgorithmRunning -> S2_ResultDisplayed: clicking run computes and displays result', async ({ page }) => {
    // This test covers event RunAlgorithm and both transitions:
    // - S0 -> S1: user clicks the button
    // - S1 -> S2: algorithm runs and resultTable is created (createTable('resultTable', result))
    const app = new FloydWarshallPage(page);
    await app.initErrorListeners();
    await app.goto();

    // Precondition: result table should be empty initially (no rows)
    const initialResultRows = await app.resultTable.locator('tr').count();
    expect(initialResultRows).toBe(0);

    // Click the run button to trigger the algorithm
    // This should synchronously run floydWarshall and then populate the result table.
    await app.clickRun();

    // After click, result table should be visible and contain the final distance matrix
    const resultMatrix = await app.readMatrix('result');
    expect(resultMatrix).toEqual(EXPECTED_RESULT_MATRIX);

    // Verify that the result table cells are not showing Infinity (they should be numeric or '0')
    for (const row of resultMatrix) {
      for (const cell of row) {
        expect(cell, 'result cell should not be the Infinity symbol').not.toBe('∞');
      }
    }

    // Verify the implementation's highlight behavior:
    // highlightIntermediateNodes is called during the algorithm, but at that time resultTable may not be populated,
    // so we expect there to be no '.highlight' classes on the resultTable cells in this implementation.
    const hasHighlights = await app.resultHasHighlights();
    expect(hasHighlights).toBe(false);

    // Validate that graphTable still shows the same original graph after running (createTable('graphTable', graph) is called again)
    const graphMatrixAfterRun = await app.readMatrix('graph');
    expect(graphMatrixAfterRun).toEqual(EXPECTED_GRAPH_MATRIX);

    // Ensure no exceptions were thrown during user interaction and algorithm execution
    expect(app.consoleErrors, `console.error messages (should be none): ${app.consoleErrors.join(' | ')}`).toHaveLength(0);
    expect(app.pageErrors, `page errors (should be none): ${app.pageErrors.join(' | ')}`).toHaveLength(0);
  });

  test('Edge cases: clicking run multiple times and ensuring idempotent result replacement', async ({ page }) => {
    // This test ensures repeated runs replace tables predictably and do not produce errors.
    const app = new FloydWarshallPage(page);
    await app.initErrorListeners();
    await app.goto();

    // Run first time
    await app.clickRun();
    const firstResult = await app.readMatrix('result');
    expect(firstResult).toEqual(EXPECTED_RESULT_MATRIX);

    // Capture a snapshot count of result cells
    const firstCellsCount = await app.resultTable.locator('td').count();

    // Run second time - the resultTable should be recreated and contents should remain the same
    await app.clickRun();
    const secondResult = await app.readMatrix('result');
    expect(secondResult).toEqual(EXPECTED_RESULT_MATRIX);

    const secondCellsCount = await app.resultTable.locator('td').count();
    expect(secondCellsCount).toBe(firstCellsCount);

    // No highlight classes expected (see implementation note)
    const hasHighlights = await app.resultHasHighlights();
    expect(hasHighlights).toBe(false);

    // No console or page errors from repeated execution
    expect(app.consoleErrors).toHaveLength(0);
    expect(app.pageErrors).toHaveLength(0);
  });

  test('Error observation test: explicitly record any runtime errors or console.error messages', async ({ page }) => {
    // This test purposefully only collects console and page errors after load and a click,
    // and asserts that the app runs without emitting JS runtime errors for this implementation.
    const app = new FloydWarshallPage(page);
    await app.initErrorListeners();
    await app.goto();

    // Perform interaction that exercises runtime code
    await app.clickRun();

    // Small delay to ensure any asynchronous pageerrors (if present) are captured
    await page.waitForTimeout(100);

    // Assert there are no page errors or console.error messages.
    // If the page had ReferenceError/SyntaxError/TypeError, they would be present here and cause the assertion to fail.
    expect(app.pageErrors, `Page errors captured: ${app.pageErrors.join(' | ')}`).toHaveLength(0);
    expect(app.consoleErrors, `Console errors captured: ${app.consoleErrors.join(' | ')}`).toHaveLength(0);
  });
});