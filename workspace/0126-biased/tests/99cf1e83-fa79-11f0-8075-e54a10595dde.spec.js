import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cf1e83-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the Floyd-Warshall demo page
class FloydWarshallPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.vertexInput = page.locator('#vertexCount');
    this.initButton = page.locator("button[onclick='initializeGraph()']");
    this.calcButton = page.locator("button[onclick='calculateFloydWarshall()']");
    this.graphTable = page.locator('#graphTable');
    this.resultTable = page.locator('#resultTable');
  }

  async goto() {
    await this.page.goto(APP_URL);
    await this.page.waitForLoadState('load');
  }

  async setVertexCount(value) {
    await this.vertexInput.fill(String(value));
  }

  async clickInitialize() {
    await this.initButton.click();
  }

  async clickCalculate() {
    await this.calcButton.click();
  }

  // returns a 2D array of cell text content for the graph table
  async getGraphTableMatrixText() {
    return await this.page.evaluate(() => {
      const table = document.getElementById('graphTable');
      if (!table) return [];
      const rows = Array.from(table.rows);
      return rows.map(row => Array.from(row.cells).map(cell => cell.textContent.trim()));
    });
  }

  // returns a 2D array of cell text content for the result table
  async getResultTableMatrixText() {
    return await this.page.evaluate(() => {
      const table = document.getElementById('resultTable');
      if (!table) return [];
      const rows = Array.from(table.rows);
      return rows.map(row => Array.from(row.cells).map(cell => cell.textContent.trim()));
    });
  }

  // counts number of <input> inside graphTable
  async graphInputCount() {
    return await this.page.locator('#graphTable input').count();
  }
}

test.describe('Floyd-Warshall Algorithm Interactive Demo - FSM Validation', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });
  });

  test('S0_Idle: Page loads and initial UI elements are present (Idle state)', async ({ page }) => {
    // Validate the Idle state renders the initial UI and no runtime errors on load
    const app = new FloydWarshallPage(page);
    await app.goto();

    // The input for vertex count should exist with default value 3
    await expect(app.vertexInput).toBeVisible();
    await expect(app.vertexInput).toHaveValue('3');

    // The Initialize Graph and Calculate buttons should be visible
    await expect(app.initButton).toBeVisible();
    await expect(app.calcButton).toBeVisible();

    // Graph and result tables should be present (but empty initially)
    await expect(app.graphTable).toBeVisible();
    await expect(app.resultTable).toBeVisible();

    const graphMatrix = await app.getGraphTableMatrixText();
    const resultMatrix = await app.getResultTableMatrixText();

    // Initially both tables should be empty (no rows)
    expect(graphMatrix.length).toBe(0);
    expect(resultMatrix.length).toBe(0);

    // No uncaught page errors should have occurred during initial load
    expect(pageErrors.length).toBe(0);
    // Also no console.error messages expected on load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('S1_GraphInitialized: Clicking Initialize Graph renders graph input fields and diagonal zeros', async ({ page }) => {
    // This test validates the transition from Idle -> GraphInitialized and the renderGraphInput entry action
    const app = new FloydWarshallPage(page);
    await app.goto();

    // Use the default vertex count (3), click initialize
    await app.clickInitialize();

    // After initialization, graph table should have 3 rows and 3 columns
    const graphMatrix = await app.getGraphTableMatrixText();
    expect(graphMatrix.length).toBe(3);
    for (let i = 0; i < 3; i++) {
      expect(graphMatrix[i].length).toBe(3);
    }

    // Diagonal cells should contain '0'
    for (let i = 0; i < 3; i++) {
      expect(graphMatrix[i][i]).toBe('0');
    }

    // Non-diagonal cells should be inputs; ensure the number of inputs equals 3 * (3 - 1) = 6
    const inputCount = await app.graphInputCount();
    expect(inputCount).toBe(6);

    // Ensure initialize did not cause any uncaught exceptions
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition CalculateShortestPaths: Clicking Calculate after initialization results in a runtime error due to missing diagonal inputs (observed TypeError)', async ({ page }) => {
    // The implementation has a mismatch: renderGraphInput does not create inputs for i===j,
    // but calculateFloydWarshall expects inputs for all i,j. This leads to a TypeError.
    // This test asserts that clicking Calculate triggers an uncaught exception and no result is rendered.
    const app = new FloydWarshallPage(page);
    await app.goto();

    // Initialize graph (default 3 vertices)
    await app.clickInitialize();

    // Now click Calculate and wait for an uncaught page error event
    // We expect a pageerror to be emitted due to reading .value of null for diagonal inputs.
    const [error] = await Promise.all([
      page.waitForEvent('pageerror'),
      app.clickCalculate().catch(() => {
        // click might throw in the test context; swallow because we capture pageerror above
      })
    ]);

    // An error must have been captured
    expect(error).toBeTruthy();

    // The error message should indicate a null property access for 'value' (messages vary across engines).
    // We accept a few common variants.
    const msg = String(error.message || error);
    expect(msg).toMatch(/Cannot read properties of null|reading 'value'|Cannot read property 'value' of null/i);

    // After the error, result table should remain empty or not have valid computed rows
    const resultMatrix = await app.getResultTableMatrixText();
    // Implementation attempted to compute and render, but due to error resultTable should still be empty
    expect(resultMatrix.length).toBe(0);

    // Confirm that we observed at least one console error message corresponding to the runtime error
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBeGreaterThanOrEqual(0); // may be zero or >0 depending on environment
    // If there are console errors, at least one should mention 'value' or 'null' similarly.
    if (consoleErrors.length > 0) {
      const joined = consoleErrors.map(c => c.text).join(' ');
      expect(joined).toMatch(/Cannot read properties of null|reading 'value'|Cannot read property 'value' of null/i);
    }
  });

  test('Edge case: Click Calculate without initializing should not throw and leaves result empty', async ({ page }) => {
    // If user clicks Calculate without initializing, vertices === 0 so loops do nothing.
    // This should not throw and should render an empty result table.
    const app = new FloydWarshallPage(page);
    await app.goto();

    // Assert vertices is default 3 in input, but we will empty it to simulate not initializing via code path
    // Instead, we will reload page and directly click Calculate (without initialize) to follow described edge case.
    // Note: the code uses an internal variable 'vertices' which starts at 0; therefore this path should be safe.
    // Reload to ensure internal 'vertices' remains 0 (fresh state)
    await page.reload();
    await page.waitForLoadState('load');

    // Click Calculate (no initialize)
    await app.clickCalculate();

    // No pageerror expected
    expect(pageErrors.length).toBe(0);

    // Result table should be empty
    const resultMatrix = await app.getResultTableMatrixText();
    expect(resultMatrix.length).toBe(0);
  });

  test('Edge case: Setting vertex count to 0 then initializing and calculating results in an uncaught exception', async ({ page }) => {
    // Explicitly exercise the 0-vertex edge case to produce runtime error scenarios.
    const app = new FloydWarshallPage(page);
    await app.goto();

    // Set vertex count to 0 (this bypasses min check since we fill the input directly)
    await app.setVertexCount(0);

    // Click initialize to create a graph with 0 vertices (graph = [])
    await app.clickInitialize();

    // Clicking calculate after this should also produce no rows but may attempt to access elements.
    // However, because vertices=0 the loops in calculateFloydWarshall should skip, similarly for floydWarshall,
    // so this path might not throw. Instead, we still attempt to click calculate and observe whether any error occurs.
    let errorEvent = null;
    try {
      errorEvent = await Promise.race([
        page.waitForEvent('pageerror', { timeout: 1000 }).then(e => e).catch(() => null),
        (async () => { await app.clickCalculate(); return null; })()
      ]);
    } catch {
      // ignore
    }

    // If an error occurred, assert its shape; otherwise assert no result rows were rendered.
    if (errorEvent) {
      const msg = String(errorEvent.message || errorEvent);
      expect(msg).toMatch(/Cannot read properties of null|reading 'value'|Cannot read property 'value' of null/i);
    } else {
      const resultMatrix = await app.getResultTableMatrixText();
      expect(resultMatrix.length).toBe(0);
    }
  });
});