import { test, expect } from '@playwright/test';

const URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a32bc42-ffc5-11f0-8b43-1ffa87931c43.html';

/**
 * Page Object for the Adjacency Matrix Visualization page.
 * Encapsulates common interactions and DOM queries.
 */
class AdjMatrixPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.edges = page.locator('#edges');
    this.buildBtn = page.locator('#buildBtn');
    this.matrixContainer = page.locator('#matrix-container');
    this.canvas = page.locator('#canvas');
  }

  async goto() {
    await this.page.goto(URL);
  }

  async getBuildButtonVisible() {
    return this.buildBtn.isVisible();
  }

  async getEdgesValue() {
    return this.edges.inputValue();
  }

  async setEdges(text) {
    // Replace content reliably
    await this.edges.fill('');
    if (text.length) {
      await this.edges.type(text);
    }
  }

  async clickBuild() {
    await this.buildBtn.click();
  }

  async waitForTable() {
    await this.page.waitForSelector('#matrix-container table');
  }

  async getTableHeaders() {
    // Returns the header texts in order (includes corner empty header as first element)
    const headers = await this.page.$$eval('#matrix-container table thead th', ths =>
      ths.map(t => t.textContent.trim())
    );
    return headers;
  }

  async getMatrixRows() {
    // Each row returns array of cell texts, starting with the row header then the numeric cells
    const rows = await this.page.$$eval('#matrix-container table tbody tr', trs =>
      trs.map(tr => {
        const cells = Array.from(tr.querySelectorAll('th, td')).map(c => c.textContent.trim());
        return cells;
      })
    );
    return rows;
  }

  async getMatrixInnerHTML() {
    return this.matrixContainer.innerHTML();
  }

  async canvasHasDrawingSamples() {
    // Evaluate in page: sample pixels at a coarse grid to detect any non-white pixel
    return this.page.evaluate(() => {
      const c = document.getElementById('canvas');
      const ctx = c.getContext('2d');
      try {
        const data = ctx.getImageData(0, 0, c.width, c.height).data;
        const step = 25; // sample every 25 pixels for speed
        for (let y = 0; y < c.height; y += step) {
          for (let x = 0; x < c.width; x += step) {
            const idx = (y * c.width + x) * 4;
            const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
            // If any sampled pixel is not white (255,255,255) or has alpha not zero, consider it drawn
            if (!(r === 255 && g === 255 && b === 255)) return true;
            if (a !== 255 && a !== 0) return true; // some browsers may use different alpha semantics
          }
        }
        return false;
      } catch (e) {
        // In case of security or other issues, return false meaning "no drawing detected"
        return false;
      }
    });
  }
}

test.describe('Adjacency Matrix Visualization - FSM states and transitions', () => {
  // Collect console errors and page errors to assert no unexpected runtime errors occur.
  let consoleErrors;
  let pageErrors;
  let consoleHandler;
  let pageErrorHandler;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    consoleHandler = msg => {
      if (msg.type() === 'error') {
        // Capture console.error messages
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    };
    pageErrorHandler = err => {
      pageErrors.push(err);
    };

    page.on('console', consoleHandler);
    page.on('pageerror', pageErrorHandler);
  });

  test.afterEach(async ({ page }) => {
    // Remove event listeners to avoid leaking between tests
    page.off('console', consoleHandler);
    page.off('pageerror', pageErrorHandler);

    // Assert that no console errors or uncaught page errors occurred during the test.
    // These assertions validate that the page script executed without unexpected runtime exceptions.
    expect(consoleErrors, `Expected no console.error messages, but found: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
    expect(pageErrors, `Expected no uncaught page errors, but found: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
  });

  test('S0_Idle evidence exists on page: build button and textarea present', async ({ page }) => {
    // This test validates the Idle state's evidence: the build button and edges textarea exist.
    const app = new AdjMatrixPage(page);
    await app.goto();

    // Because the page script auto-clicks "Build Matrix" on load, wait for the matrix to be present.
    await app.waitForTable();

    // Check that the Build Matrix button exists and is visible (evidence for S0_Idle).
    expect(await app.getBuildButtonVisible()).toBe(true);

    // Check that the textarea exists and contains the default example edges.
    const edgesValue = await app.getEdgesValue();
    expect(edgesValue).toContain('A B');
    expect(edgesValue).toContain('C D');
  });

  test('S1_MatrixBuilt entry actions render matrix and draw graph on initial load', async ({ page }) => {
    // This test validates that on entering the MatrixBuilt state the matrix is rendered and the graph drawn.
    const app = new AdjMatrixPage(page);
    await app.goto();

    // Wait for the table to be created by the automatic initial buildBtn.click() in the page script.
    await app.waitForTable();

    // Validate table headers contain the expected nodes sorted alphabetically (A, B, C, D).
    const headers = await app.getTableHeaders();
    // headers[0] is the corner cell (empty)
    expect(headers[0]).toBe('');
    // subsequent headers should include A B C D in some order; the script sorts nodes with localeCompare
    const nodeHeaders = headers.slice(1);
    expect(nodeHeaders).toEqual(['A', 'B', 'C', 'D']);

    // Validate matrix numeric values for the example graph
    // Expected adjacency:
    // A connected to B and C -> row A: 0 1 1 0
    // B connected to A and C -> row B: 1 0 1 0
    // C connected to A and B and D -> row C: 1 1 0 1
    // D connected to C -> row D: 0 0 1 0
    const rows = await app.getMatrixRows();
    // There should be 4 rows, each starting with the node label then numeric cells
    expect(rows.length).toBe(4);
    expect(rows[0]).toEqual(['A', '0', '1', '1', '0']);
    expect(rows[1]).toEqual(['B', '1', '0', '1', '0']);
    expect(rows[2]).toEqual(['C', '1', '1', '0', '1']);
    expect(rows[3]).toEqual(['D', '0', '0', '1', '0']);

    // Validate the canvas has drawing (graph visualization). We sample pixels to detect non-white pixels.
    const hasDrawing = await app.canvasHasDrawingSamples();
    expect(hasDrawing).toBe(true);
  });

  test('BuildMatrixClick transition: updating edges updates matrix and visualization', async ({ page }) => {
    // This test validates the BuildMatrixClick event: user changes edges and clicks Build Matrix to transition states.
    const app = new AdjMatrixPage(page);
    await app.goto();

    // Wait for any initial render to complete
    await app.waitForTable();

    // Set a new edges input with numeric node labels to test numeric sorting behavior
    const newEdges = `1 3
3 2`;
    await app.setEdges(newEdges);

    // Click the Build Matrix button to trigger the transition
    await app.clickBuild();

    // Wait for the new table to render
    await app.waitForTable();

    // Validate headers are numeric-sorted: 1,2,3
    const headers = await app.getTableHeaders();
    expect(headers[0]).toBe('');
    expect(headers.slice(1)).toEqual(['1', '2', '3']);

    // Validate matrix numeric values:
    // Edges: [1-3], [3-2] -> adjacency:
    // 1: [0,0,1]
    // 2: [0,0,1]
    // 3: [1,1,0]
    const rows = await app.getMatrixRows();
    expect(rows.length).toBe(3);
    expect(rows[0]).toEqual(['1', '0', '0', '1']);
    expect(rows[1]).toEqual(['2', '0', '0', '1']);
    expect(rows[2]).toEqual(['3', '1', '1', '0']);

    // Visualization should be drawn for this graph
    const hasDrawing = await app.canvasHasDrawingSamples();
    expect(hasDrawing).toBe(true);
  });

  test('Invalid input (line with more than two tokens) triggers alert and prevents matrix rebuild', async ({ page }) => {
    // This test verifies the error scenario where parseEdges should alert the user and abort.
    const app = new AdjMatrixPage(page);
    await app.goto();

    // Wait for any initial table
    await app.waitForTable();

    // Capture the current matrix HTML to verify it doesn't change after invalid input
    const beforeHTML = await page.$eval('#matrix-container', el => el.innerHTML);

    // Prepare to handle the alert dialog triggered by invalid input
    const dialogMessages = [];
    page.once('dialog', async dialog => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    // Set invalid edges and click Build
    await app.setEdges('A B C'); // invalid: three tokens on a line
    await app.clickBuild();

    // Give a small pause to allow any DOM changes (should be none)
    await page.waitForTimeout(200);

    // Ensure an alert dialog was shown with the expected message
    expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
    expect(dialogMessages[0]).toContain('Each line should contain exactly two nodes separated by space.');

    // Ensure the matrix was not replaced (remains equal to before)
    const afterHTML = await page.$eval('#matrix-container', el => el.innerHTML);
    expect(afterHTML).toBe(beforeHTML);
  });

  test('Edge case: empty input produces empty node set and empty matrix body', async ({ page }) => {
    // This test validates behavior when the textarea is empty: matrix header may exist but no node rows.
    const app = new AdjMatrixPage(page);
    await app.goto();

    // Wait for any initial render then set empty input
    await app.waitForTable();

    await app.setEdges(''); // empty textarea
    await app.clickBuild();

    // Wait for the table to be present (it may be an empty header-only table)
    await app.waitForSelector('#matrix-container table');

    // The tbody should have zero rows
    const rows = await app.getMatrixRows();
    expect(rows.length).toBe(0);

    // The canvas should not have node drawings
    const hasDrawing = await app.canvasHasDrawingSamples();
    // When there are no nodes, drawGraph returns early after clearing; we expect no user-drawn content.
    expect(hasDrawing).toBe(false);
  });
});