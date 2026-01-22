import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3c0ea0-d360-11f0-b42e-71f0e7238799.html';

/**
 * Page Object for the Kruskal visualization page.
 * Encapsulates common interactions and queries for the tests.
 */
class KruskalPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.edgeLocator = (text) => this.page.locator('.edge', { hasText: text });
    this.allEdges = () => this.page.locator('.edge');
    this.getMSTButton = () => this.page.locator('#getMST');
    this.resultsDiv = () => this.page.locator('#results');
  }

  async goto() {
    await this.page.goto(BASE_URL);
    // ensure DOM rendered
    await this.page.waitForSelector('.edge');
    await this.page.waitForSelector('#getMST');
    await this.page.waitForSelector('#results');
  }

  async clickEdgeByText(text) {
    const locator = this.edgeLocator(text);
    await expect(locator).toHaveCount(1);
    await locator.click();
  }

  async clickEdgeByIndex(index) {
    const locator = this.allEdges().nth(index);
    await expect(locator).toBeVisible();
    await locator.click();
  }

  async isEdgeSelectedByText(text) {
    const locator = this.edgeLocator(text);
    return await locator.evaluate((el) => el.classList.contains('selected'));
  }

  async isEdgeSelectedByIndex(index) {
    const locator = this.allEdges().nth(index);
    return await locator.evaluate((el) => el.classList.contains('selected'));
  }

  async clickGetMST() {
    await this.getMSTButton().click();
  }

  async getResultsText() {
    return (await this.resultsDiv().innerText()).trim();
  }

  async getEdgeDatasetByText(text) {
    const locator = this.edgeLocator(text);
    return await locator.evaluate((el) => ({ weight: el.dataset.weight, nodes: el.dataset.nodes }));
  }

  async edgeCount() {
    return await this.allEdges().count();
  }

  // convenience to toggle an edge twice
  async toggleEdgeByTextTwice(text) {
    await this.clickEdgeByText(text);
    await this.clickEdgeByText(text);
  }
}

test.describe('Kruskal\'s Algorithm Visualization - FSM validation', () => {
  // Ensure each test has a clean page instance and listeners are handled per test.
  test.beforeEach(async ({ page }) => {
    // no-op here; individual tests will instantiate page object and navigate
  });

  test('S0_Idle: initial state renders edges, button, and empty results', async ({ page }) => {
    // Validate the Idle state: edges present, button present, results empty
    const app = new KruskalPage(page);
    await app.goto();

    // There should be 7 edges as per HTML
    const count = await app.edgeCount();
    expect(count).toBeGreaterThanOrEqual(7);

    // Specific edge is present and has expected text and data attributes
    const edgeInfo = await app.getEdgeDatasetByText('A - B (4)');
    expect(edgeInfo.weight).toBe('4');
    expect(edgeInfo.nodes).toBe('A-B');

    // Get MST button visible
    await expect(app.getMSTButton()).toBeVisible();

    // Results div initially empty (or contains only whitespace)
    const results = await app.getResultsText();
    expect(results).toBe('');
  });

  test.describe('Edge selection transitions (S0 -> S1 and S1 self-transitions)', () => {
    test('Clicking an edge toggles selected class (single click)', async ({ page }) => {
      const app = new KruskalPage(page);
      await app.goto();

      // Click the A - B edge
      await app.clickEdgeByText('A - B (4)');

      // The DOM should reflect selection via class 'selected'
      const selected = await app.isEdgeSelectedByText('A - B (4)');
      expect(selected).toBeTruthy();

      // The CSS change should be observable: background-color style applied via class
      // We validate the class is present; visual color specifics are tested by the presence of the class.
      await expect(app.edgeLocator('A - B (4)')).toHaveClass(/selected/);
    });

    test('Clicking the same edge twice toggles selection off (S1 -> S1)', async ({ page }) => {
      const app = new KruskalPage(page);
      await app.goto();

      // Click twice to toggle on then off
      await app.toggleEdgeByTextTwice('B - C (3)');

      const selectedAfter = await app.isEdgeSelectedByText('B - C (3)');
      expect(selectedAfter).toBeFalsy();
    });

    test('Multiple edges can be selected independently', async ({ page }) => {
      const app = new KruskalPage(page);
      await app.goto();

      // Select a few edges
      await app.clickEdgeByText('A - C (1)');
      await app.clickEdgeByText('C - D (2)');
      await app.clickEdgeByText('D - E (5)');

      // Verify each selected
      expect(await app.isEdgeSelectedByText('A - C (1)')).toBeTruthy();
      expect(await app.isEdgeSelectedByText('C - D (2)')).toBeTruthy();
      expect(await app.isEdgeSelectedByText('D - E (5)')).toBeTruthy();

      // Non-selected edge should remain unselected
      expect(await app.isEdgeSelectedByText('B - D (6)')).toBeFalsy();
    });
  });

  test.describe('Get MST button behavior and transitions to S2_MSTDisplayed', () => {
    test('Clicking GetMST with no edges selected should display empty MST (edge case)', async ({ page }) => {
      const app = new KruskalPage(page);

      // Listen for unexpected page errors; treat as test failure if any occur in this scenario
      let pageError = null;
      const onPageError = (err) => { pageError = err; };
      page.on('pageerror', onPageError);

      await app.goto();

      // Ensure no edges are selected initially
      // Click Get MST without selecting any edges
      await app.clickGetMST();

      // There should be no page error when no edges are selected
      expect(pageError).toBeNull();

      // The results div should now contain the MST text (likely empty list => just the prefix)
      const resultsText = await app.getResultsText();
      // Accept either exact phrase or the phrase with trailing whitespace
      expect(resultsText.startsWith('Minimum Spanning Tree:')).toBeTruthy();
      // When there are no edges, the join yields empty string => exact expected is 'Minimum Spanning Tree: '
      expect(resultsText).toBe('Minimum Spanning Tree:');

      page.off('pageerror', onPageError);
    });

    test('Clicking GetMST after selecting edges produces an application error (TypeError) due to implementation bug', async ({ page }) => {
      const app = new KruskalPage(page);
      await app.goto();

      // Capture page errors and console messages for assertion
      const pageErrors = [];
      page.on('pageerror', (err) => {
        // Push error object for inspection in assertions
        pageErrors.push(err);
      });

      const consoleMessages = [];
      page.on('console', (msg) => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });

      // Select an edge so that the erroneous code path in kruskal() executes (selectedEdges contains nodes only)
      await app.clickEdgeByText('A - B (4)'); // toggles selection on
      // Confirm visual selection
      expect(await app.isEdgeSelectedByText('A - B (4)')).toBeTruthy();

      // Click GetMST which will call kruskal(selectedEdges) -> should cause a TypeError as per page script
      await app.clickGetMST();

      // Wait briefly to ensure the error handler on the page has time to propagate
      // (Playwright will capture the pageerror event as soon as it occurs)
      await page.waitForTimeout(100); // small wait to allow async propagation

      // We expect at least one page error due to the buggy parsing inside kruskal()
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      // Assert the primary error is a TypeError (cannot read property 'slice' of undefined / similar)
      const firstErr = pageErrors[0];
      expect(firstErr).toBeDefined();
      // Different engines have slightly different messages; ensure it's a TypeError and message refers to 'slice' or 'reading'
      expect(firstErr.name).toBe('TypeError');
      const msgLower = (firstErr.message || '').toLowerCase();
      expect(msgLower.includes('slice') || msgLower.includes('reading') || msgLower.includes('cannot')).toBeTruthy();

      // Ensure resultsDiv was not updated to a valid MST string (since an error occurred before setting)
      const resultsTextAfterError = await app.getResultsText();
      // The implementation sets resultsDiv only after kruskal returns successfully.
      // Because kruskal threw, resultsDiv should remain as it was (likely empty).
      expect(resultsTextAfterError === '' || resultsTextAfterError === 'Minimum Spanning Tree:' ).toBeTruthy();

      // Clean up listeners
      page.removeAllListeners('pageerror');
      page.removeAllListeners('console');
    });
  });

  test.describe('Additional robustness and edge cases', () => {
    test('Selecting and deselecting multiple times keeps DOM consistent', async ({ page }) => {
      const app = new KruskalPage(page);
      await app.goto();

      // Rapidly toggle an edge multiple times and ensure class toggles accordingly
      for (let i = 0; i < 5; i++) {
        await app.clickEdgeByText('E - A (7)');
      }
      // After 5 toggles, selection state should be the same as a single toggle (odd => selected)
      expect(await app.isEdgeSelectedByText('E - A (7)')).toBeTruthy();

      // Toggle once more -> even toggles -> not selected
      await app.clickEdgeByText('E - A (7)');
      expect(await app.isEdgeSelectedByText('E - A (7)')).toBeFalsy();
    });

    test('Edge elements contain expected dataset attributes for weight and nodes', async ({ page }) => {
      const app = new KruskalPage(page);
      await app.goto();

      // Iterate edges and assert dataset attributes exist and are parseable
      const expectedEdges = [
        { text: 'A - B (4)', weight: '4', nodes: 'A-B' },
        { text: 'B - C (3)', weight: '3', nodes: 'B-C' },
        { text: 'A - C (1)', weight: '1', nodes: 'A-C' },
        { text: 'C - D (2)', weight: '2', nodes: 'C-D' },
        { text: 'D - E (5)', weight: '5', nodes: 'D-E' },
        { text: 'B - D (6)', weight: '6', nodes: 'B-D' },
        { text: 'E - A (7)', weight: '7', nodes: 'E-A' },
      ];

      for (const e of expectedEdges) {
        const dataset = await app.getEdgeDatasetByText(e.text);
        expect(dataset.weight).toBe(e.weight);
        expect(dataset.nodes).toBe(e.nodes);
      }
    });
  });
});