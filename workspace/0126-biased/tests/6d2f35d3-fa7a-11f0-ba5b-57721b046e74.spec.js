import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2f35d3-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object for the Greedy Algorithms Explorer app
class GreedyApp {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.consoleErrors = [];
    this.pageErrors = [];
    this._boundConsole = null;
    this._boundPageError = null;
  }

  // Navigate to the application and wire up listeners to capture console/page errors
  async goto() {
    // Capture console messages and errors
    this._boundConsole = (msg) => {
      const text = msg.text();
      this.consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') this.consoleErrors.push(text);
    };
    this.page.on('console', this._boundConsole);

    // Capture uncaught page errors
    this._boundPageError = (err) => {
      // err is Error object; store message and stack for assertions
      this.pageErrors.push({
        message: err.message,
        stack: err.stack
      });
    };
    this.page.on('pageerror', this._boundPageError);

    await this.page.goto(APP_URL);
    // Wait for main container to be present
    await this.page.waitForSelector('#algorithm-container');
  }

  // Remove listeners (teardown)
  async teardown() {
    if (this._boundConsole) this.page.off('console', this._boundConsole);
    if (this._boundPageError) this.page.off('pageerror', this._boundPageError);
  }

  // Select an algorithm from the selector and click Load Algorithm
  async loadAlgorithm(value) {
    const selector = this.page.locator('#algorithm-selector');
    await selector.selectOption(value);
    await this.page.click('#select-algorithm');
    // Wait for algorithm-specific container to render its h2 header
    await this.page.waitForSelector('.algorithm-section h2');
  }

  // Helpers that read visible text from current algorithm container
  async getAlgorithmHeader() {
    const h = await this.page.locator('.algorithm-section h2').innerText();
    return h.trim();
  }

  async getVisualizationText(idSelector) {
    const viz = this.page.locator(idSelector);
    await viz.waitFor({ state: 'visible' });
    return viz.innerText();
  }

  // Count table rows under a container (excluding header row)
  async countTableRows(containerSelector) {
    const rows = this.page.locator(`${containerSelector} table tr`);
    // If there is no table, return 0
    const tableExists = await this.page.$(`${containerSelector} table`);
    if (!tableExists) return 0;
    // Exclude header row if present
    const total = await rows.count();
    // If first row contains <th> assume header present
    const firstRowTh = await this.page.$(`${containerSelector} table tr th`);
    return firstRowTh ? Math.max(0, total - 1) : total;
  }
}

test.describe('Greedy Algorithms Explorer - FSM End-to-End', () => {
  let app;
  test.beforeEach(async ({ page }) => {
    app = new GreedyApp(page);
    await app.goto();
  });

  test.afterEach(async () => {
    // Teardown listeners to avoid leaking to next tests
    await app.teardown();
  });

  test('Initial Load: app initializes and default algorithm (Coin Change) is rendered', async () => {
    // Validate that the default algorithm is Coin Change as set in window.load
    const header = await app.getAlgorithmHeader();
    expect(header).toContain('Coin Change Problem');

    // Coin visualization should be present and show the message prompting Solve
    const vizText = await app.getVisualizationText('#coin-visualization');
    expect(vizText).toContain("Click 'Solve'");

    // Ensure no uncaught page errors or console errors occurred during initial load
    expect(app.pageErrors.length).toBe(0);
    expect(app.consoleErrors.length).toBe(0);
  });

  test.describe('Coin Change Problem (S1_CoinChange)', () => {
    test('Load Coin Change explicitly, update coins to custom set and solve', async () => {
      // Ensure algorithm is set to coin and loaded
      await app.loadAlgorithm('coin');
      expect(await app.getAlgorithmHeader()).toContain('Coin Change Problem');

      // Update coin denominations to a custom set
      const coinInput = app.page.locator('#coin-input');
      await coinInput.fill('50,20,5');
      await app.page.click('#update-coins');

      // Visualization should still prompt to solve (no solution yet)
      let viz = await app.getVisualizationText('#coin-visualization');
      expect(viz).toContain("Click 'Solve'");

      // Set a new amount then click solve and assert table result
      const amountInput = app.page.locator('#amount-input');
      await amountInput.fill('100');
      await app.page.click('#solve-coin');

      viz = await app.getVisualizationText('#coin-visualization');
      expect(viz).toContain('Solution for 100:');
      expect(viz).toContain('<table>'); // table markup rendered inside visualization
      expect(viz).toContain('Total');

      // Ensure coin 50 row appears (we used 50,20,5)
      expect(viz).toMatch(/<td>50<\/td>/);

      // Check that no exceptions were thrown during coin operations
      expect(app.pageErrors.length).toBe(0);
      expect(app.consoleErrors.length).toBe(0);
    });

    test('Edge case: update coins to invalid input (empty) and solve should not crash', async () => {
      await app.loadAlgorithm('coin');

      // Enter invalid coin string causing algorithmState.coins to become [] after parsing
      await app.page.locator('#coin-input').fill('');
      await app.page.click('#update-coins');

      // Set amount and click solve - should not throw, but solution remains empty and message shown
      await app.page.locator('#amount-input').fill('30');
      await app.page.click('#solve-coin');

      const viz = await app.getVisualizationText('#coin-visualization');
      // With no coins, solution stays empty and the UI should ask to click Solve (or show no rows)
      expect(viz).toContain("Click 'Solve'").or.toContain('Solution for 30:');

      // No runtime errors should have been captured
      expect(app.pageErrors.length).toBe(0);
      expect(app.consoleErrors.length).toBe(0);
    });
  });

  test.describe('Fractional Knapsack (S2_FractionalKnapsack)', () => {
    test('Load Fractional Knapsack, update capacity, add item, and solve', async () => {
      await app.loadAlgorithm('fractional');
      expect(await app.getAlgorithmHeader()).toContain('Fractional Knapsack');

      // Initial items table should exist
      const itemsRowsBefore = await app.countTableRows('#items-container');
      expect(itemsRowsBefore).toBeGreaterThanOrEqual(1);

      // Update capacity to a different value
      await app.page.locator('#capacity-input').fill('40');
      await app.page.click('#update-capacity');

      // Visualization should still prompt Solve until we click solve
      const vizBefore = await app.getVisualizationText('#knapsack-visualization');
      expect(vizBefore).toContain("Click 'Solve'");

      // Add an item and ensure item rows increased
      await app.page.click('#add-item');
      const itemsRowsAfter = await app.countTableRows('#items-container');
      expect(itemsRowsAfter).toBeGreaterThanOrEqual(itemsRowsBefore + 1);

      // Now click solve and validate solution content
      await app.page.click('#solve-knapsack');
      const vizAfter = await app.getVisualizationText('#knapsack-visualization');
      expect(vizAfter).toContain('Solution:');
      expect(vizAfter).toContain('Total Value');

      // Ensure total weight row and total value exist in the table
      expect(vizAfter).toMatch(/Total Value:/);

      // No runtime errors occurred
      expect(app.pageErrors.length).toBe(0);
      expect(app.consoleErrors.length).toBe(0);
    });

    test('Edge case: Solve without changing anything should still be safe', async () => {
      await app.loadAlgorithm('fractional');

      // Solve right away even if solution empty - should produce table only if solution computed
      await app.page.click('#solve-knapsack');
      const viz = await app.getVisualizationText('#knapsack-visualization');
      // Could be "Click 'Solve'" if no solution, or a solution table; either way it must not have thrown
      expect(viz.length).toBeGreaterThan(0);

      // No runtime exceptions
      expect(app.pageErrors.length).toBe(0);
      expect(app.consoleErrors.length).toBe(0);
    });
  });

  test.describe('Activity Selection (S3_ActivitySelection)', () => {
    test('Load Activity Selection, reset activities, add activities, solve, and reset again', async () => {
      await app.loadAlgorithm('activity');
      expect(await app.getAlgorithmHeader()).toContain('Activity Selection');

      // Reset activities first - should clear initial list if any
      await app.page.click('#reset-activities');
      let activitiesText = await app.page.locator('#activities-container').innerText();
      expect(activitiesText).toContain('No activities');

      // Add a few random activities
      await app.page.click('#add-activity');
      await app.page.click('#add-activity');
      await app.page.click('#add-activity');

      // There should now be activity rows
      const rows = await app.countTableRows('#activities-container');
      expect(rows).toBeGreaterThanOrEqual(1);

      // Solve activity selection and assert selected activities and total are shown
      await app.page.click('#solve-activity');
      const solutionText = await app.getVisualizationText('#activity-visualization');
      // After solving, should either show table or 'Click Solve' if something unexpected; check for 'Selected Activities' label
      expect(solutionText).toContain('Selected Activities').or.toContain("Click 'Solve'").or.toContain('Total:');

      // Now reset activities and confirm cleared
      await app.page.click('#reset-activities');
      activitiesText = await app.page.locator('#activities-container').innerText();
      expect(activitiesText).toContain('No activities');

      // No runtime errors captured
      expect(app.pageErrors.length).toBe(0);
      expect(app.consoleErrors.length).toBe(0);
    });

    test('Edge case: Reset when activities already empty must not throw', async () => {
      await app.loadAlgorithm('activity');
      // Ensure activities cleared
      await app.page.click('#reset-activities');
      // Click reset again to exercise idempotence
      await app.page.click('#reset-activities');

      const activitiesText = await app.page.locator('#activities-container').innerText();
      expect(activitiesText).toContain('No activities');

      // Ensure no errors occurred
      expect(app.pageErrors.length).toBe(0);
      expect(app.consoleErrors.length).toBe(0);
    });
  });

  test.describe('Huffman Coding (S4_HuffmanCoding)', () => {
    test('Load Huffman Coding, add character, generate codes, and reset', async () => {
      await app.loadAlgorithm('huffman');
      expect(await app.getAlgorithmHeader()).toContain('Huffman Coding');

      // There should initially be characters from the default state; count rows
      const initialRows = await app.countTableRows('#characters-container');
      expect(initialRows).toBeGreaterThanOrEqual(1);

      // Add a random character and ensure characters count increases
      await app.page.click('#add-character');
      const rowsAfterAdd = await app.countTableRows('#characters-container');
      expect(rowsAfterAdd).toBeGreaterThanOrEqual(initialRows + 1);

      // Generate Huffman codes and assert the codes table and average code length presence
      await app.page.click('#solve-huffman');
      const codesViz = await app.getVisualizationText('#huffman-visualization');
      expect(codesViz).toContain('Huffman Codes:');
      expect(codesViz).toMatch(/Average code length/);

      // Reset Huffman and ensure characters and codes cleared
      await app.page.click('#reset-huffman');
      const charsAfterReset = await app.page.locator('#characters-container').innerText();
      expect(charsAfterReset).toContain('No characters');

      const codesAfterReset = await app.page.locator('#huffman-visualization').innerText();
      expect(codesAfterReset).toContain("Click 'Generate Codes'");

      // No runtime errors occurred
      expect(app.pageErrors.length).toBe(0);
      expect(app.consoleErrors.length).toBe(0);
    });

    test('Edge case: Generate codes with a single character returns code 0 and computes average properly', async () => {
      await app.loadAlgorithm('huffman');

      // Reset first to clear defaults
      await app.page.click('#reset-huffman');
      // Add a single character deterministically by clicking add-character once
      await app.page.click('#add-character');

      // Generate codes
      await app.page.click('#solve-huffman');

      const viz = await app.getVisualizationText('#huffman-visualization');
      // With a single character, code should be '0' for that character per implementation
      expect(viz).toMatch(/<td>[a-z]<\/td>\s*<td>0<\/td>/);

      // Average code length should be present and equal to code length (0 -> length 1 in implementation)
      expect(viz).toMatch(/Average code length: \d+(\.\d+)?/);

      expect(app.pageErrors.length).toBe(0);
      expect(app.consoleErrors.length).toBe(0);
    });
  });

  test('Full FSM coverage: walk through selecting each algorithm and verifying entry actions', async () => {
    // Coin
    await app.loadAlgorithm('coin');
    expect(await app.getAlgorithmHeader()).toContain('Coin Change Problem');

    // Fractional Knapsack
    await app.loadAlgorithm('fractional');
    expect(await app.getAlgorithmHeader()).toContain('Fractional Knapsack');

    // Activity Selection
    await app.loadAlgorithm('activity');
    expect(await app.getAlgorithmHeader()).toContain('Activity Selection');

    // Huffman Coding
    await app.loadAlgorithm('huffman');
    expect(await app.getAlgorithmHeader()).toContain('Huffman Coding');

    // Across all loads there should be no uncaught exceptions in pageErrors
    expect(app.pageErrors.length).toBe(0);
    expect(app.consoleErrors.length).toBe(0);
  });

  test('Observe and assert console and page error visibility (no unexpected runtime errors)', async () => {
    // This test purposefully inspects any collected logs from the app interactions in prior tests
    // Note: because we run each test with a fresh page, we still check current collections
    // For this single test, we haven't interacted more, but we assert captured errors array is accessible and is empty
    expect(Array.isArray(app.consoleMessages)).toBe(true);
    expect(Array.isArray(app.pageErrors)).toBe(true);

    // Assert that there were no console error messages and no uncaught page errors
    expect(app.consoleErrors.length).toBe(0);
    expect(app.pageErrors.length).toBe(0);
  });
});