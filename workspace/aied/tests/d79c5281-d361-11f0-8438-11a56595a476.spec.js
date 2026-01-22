import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79c5281-d361-11f0-8438-11a56595a476.html';

// Page Object for the adjacency matrix demo
class AdjacencyPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.edgesSelector = '#edges';
    this.generateBtn = '#generate-btn';
    this.outputSelector = '#output';
    this.errorSelector = '#error-message';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getTitleText() {
    return this.page.locator('h1').innerText();
  }

  async getEdgesValue() {
    return this.page.locator(this.edgesSelector).inputValue();
  }

  async setEdgesValue(value) {
    await this.page.fill(this.edgesSelector, value);
  }

  async clickGenerate() {
    await this.page.click(this.generateBtn);
  }

  async getErrorText() {
    return this.page.locator(this.errorSelector).innerText();
  }

  async outputHasTable() {
    return await this.page.locator(`${this.outputSelector} table`).count() > 0;
  }

  async getTableLocator() {
    return this.page.locator(`${this.outputSelector} table`);
  }

  // Returns matrix as array of arrays of strings (cell text)
  async readMatrixFromTable() {
    const table = this.page.locator(`${this.outputSelector} table`);
    const exists = await table.count();
    if (!exists) return null;
    // Skip the header row when constructing numeric matrix (but include headers separately)
    const headerCells = table.locator('tr').first().locator('th');
    const headerCount = await headerCells.count();
    const headers = [];
    for (let i = 1; i < headerCount; i++) { // skip top-left empty th
      headers.push((await headerCells.nth(i).innerText()).trim());
    }
    const rows = [];
    const rowCount = await table.locator('tr').count();
    for (let r = 1; r < rowCount; r++) { // skip header row
      const rowLocator = table.locator('tr').nth(r);
      // first th is row header
      const rowHeader = (await rowLocator.locator('th').innerText()).trim();
      const cells = [];
      const tdCount = await rowLocator.locator('td').count();
      for (let c = 0; c < tdCount; c++) {
        cells.push((await rowLocator.locator('td').nth(c).innerText()).trim());
      }
      rows.push({ rowHeader, cells });
    }
    return { headers, rows };
  }
}

test.describe('Adjacency Matrix Demonstration - FSM and UI tests', () => {
  // Capture console and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen for console messages and page errors emitted by the page
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', error => {
      pageErrors.push(error);
    });
  });

  test.afterEach(async () => {
    // Nothing to teardown beyond Playwright defaults; this hook exists for symmetry.
  });

  test('S0_Idle: initial render shows title, textarea, button, and pre-filled example edges', async ({ page }) => {
    const app = new AdjacencyPage(page);
    await app.goto();

    // Validate the initial heading is present (S0_Idle evidence)
    const title = await app.getTitleText();
    expect(title).toContain('Adjacency Matrix Visualization');

    // textarea exists and has placeholder (S1 evidence mentions placeholder in FSM)
    const edgesValue = await app.getEdgesValue();
    // The page pre-fills example edges; ensure the prefilled content includes expected lines
    expect(edgesValue).toContain('A B');
    expect(edgesValue).toContain('A C');
    expect(edgesValue).toContain('B C');
    expect(edgesValue).toContain('C D');

    // Error div should be empty initially
    const errorText = await app.getErrorText();
    expect(errorText).toBe('');

    // Output should be empty initially (no table)
    const hasTable = await app.outputHasTable();
    expect(hasTable).toBeFalsy();

    // Assert that no unexpected page errors or console error messages occurred during load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0 -> S2 via GenerateButtonClick: clicking generate with valid input renders adjacency matrix table (S2_MatrixGenerated)', async ({ page }) => {
    const app = new AdjacencyPage(page);
    await app.goto();

    // Ensure prefilled example exists and then click generate
    const beforeValue = await app.getEdgesValue();
    expect(beforeValue.trim().length).toBeGreaterThan(0);

    // Click generate and expect a table to be appended to #output
    await app.clickGenerate();

    // Validate the output contains a table
    const hasTable = await app.outputHasTable();
    expect(hasTable).toBeTruthy();

    // Read matrix and headers from table and validate content against known expected matrix
    const matrixData = await app.readMatrixFromTable();
    expect(matrixData).not.toBeNull();

    // Headers should be nodes sorted as strings: A, B, C, D
    expect(matrixData.headers).toEqual(['A', 'B', 'C', 'D']);

    // Build numeric matrix from rows to compare
    const numeric = matrixData.rows.map(r => r.cells.map(c => Number(c)));

    // Expected adjacency (undirected) for edges A-B, A-C, B-C, C-D:
    //   A B C D
    // A 0 1 1 0
    // B 1 0 1 0
    // C 1 1 0 1
    // D 0 0 1 0
    const expected = [
      [0,1,1,0],
      [1,0,1,0],
      [1,1,0,1],
      [0,0,1,0],
    ];
    expect(numeric).toEqual(expected);

    // Validate that a caption was appended to the table as the implementation does
    const captionText = await page.locator('#output table caption').innerText();
    expect(captionText).toContain('Adjacency Matrix');

    // Ensure no uncaught page errors or console errors during this generation
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S1 -> S3 (empty input): clicking generate with empty textarea shows error message and does not render table', async ({ page }) => {
    const app = new AdjacencyPage(page);
    await app.goto();

    // Clear the textarea to trigger the empty input error path
    await app.setEdgesValue('');
    // Sanity check that it's empty
    const now = await app.getEdgesValue();
    expect(now.trim()).toBe('');

    // Click generate
    await app.clickGenerate();

    // Expect error message to be shown as per FSM S3_Error on empty input
    const error = await app.getErrorText();
    expect(error).toBe('Please enter at least one edge.');

    // Output should remain empty (no table rendered)
    const hasTable = await app.outputHasTable();
    expect(hasTable).toBeFalsy();

    // Ensure no uncaught page errors occurred (the error is a controlled UI message)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S1 -> S3 (invalid format): clicking generate with malformed edge line shows parse error message', async ({ page }) => {
    const app = new AdjacencyPage(page);
    await app.goto();

    // Provide an invalid edge line to trigger parseEdges error
    const invalidInput = `A B
BADLINE
C D`;
    await app.setEdgesValue(invalidInput);

    // Click generate to attempt parsing
    await app.clickGenerate();

    // Validate that an error message containing 'Invalid edge format' appears
    const error = await app.getErrorText();
    expect(error).toContain('Invalid edge format');

    // Ensure output is empty
    const hasTable = await app.outputHasTable();
    expect(hasTable).toBeFalsy();

    // Confirm no unhandled exceptions bubbled up as page errors (error is handled in try/catch)
    expect(pageErrors.length).toBe(0);

    // Also ensure there are no console error-level messages emitted by the page during this scenario
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  test('Repeated generation: output is cleared before rendering new matrix (validate onExit/onEnter behavior implied by implementation)', async ({ page }) => {
    const app = new AdjacencyPage(page);
    await app.goto();

    // First generate with default prefilled input
    await app.clickGenerate();
    let hasTable = await app.outputHasTable();
    expect(hasTable).toBeTruthy();

    // Now change edges to a different valid set and generate again
    const newEdges = `X Y
Y Z`;
    await app.setEdgesValue(newEdges);

    // Before clicking, ensure output currently has a table (from previous run)
    expect(await app.outputHasTable()).toBeTruthy();

    // Click generate which should clear previous output and render new table
    await app.clickGenerate();

    // After second generation, a table should still be present
    hasTable = await app.outputHasTable();
    expect(hasTable).toBeTruthy();

    // Validate that the headers now correspond to nodes X, Y, Z (sorted)
    const matrixData = await app.readMatrixFromTable();
    expect(matrixData.headers).toEqual(['X', 'Y', 'Z']);

    // Confirm the adjacency reflects edges X-Y and Y-Z (undirected)
    const numeric = matrixData.rows.map(r => r.cells.map(c => Number(c)));
    const expected = [
      [0,1,0], // X
      [1,0,1], // Y
      [0,1,0], // Z
    ];
    expect(numeric).toEqual(expected);

    // Ensure no uncaught page errors or console errors happened
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  test('Console and page error observability: verify we captured any console messages and page errors (if any)', async ({ page }) => {
    // This test ensures our event listeners are active and records current captured messages.
    const app = new AdjacencyPage(page);
    await app.goto();

    // Trigger a benign action to produce typical console logs if implementation had them
    await app.clickGenerate();

    // The application implementation is not expected to throw uncaught ReferenceError/SyntaxError/TypeError.
    // We assert that there are no uncaught page errors. If the page does throw, the test will fail and surface them.
    expect(pageErrors.length).toBe(0);

    // For robustness assert there are no console error messages recorded
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);

    // We also assert that we observed at least one console message of any type (e.g., info, log) or none is acceptable.
    // This assertion is intentionally permissive; the main goal is to ensure we captured and checked console/page errors.
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });
});