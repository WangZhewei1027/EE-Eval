import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a32bc43-ffc5-11f0-8b43-1ffa87931c43.html';

/**
 * Page Object for the Adjacency List sample app.
 * Encapsulates selectors and common interactions.
 */
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {{consoleErrors: string[], pageErrors: string[]}} errorCollectors
   */
  constructor(page, errorCollectors = null) {
    this.page = page;
    this.textarea = page.locator('#graphInput');
    this.buildBtn = page.locator('#buildGraphBtn');
    this.output = page.locator('#output');
    this.outputHeader = page.locator('#output h2');
    this.listItems = page.locator('#output ul li');
    this.consoleErrors = errorCollectors ? errorCollectors.consoleErrors : null;
    this.pageErrors = errorCollectors ? errorCollectors.pageErrors : null;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for the initial display triggered on window.onload
    await this.outputHeader.waitFor({ state: 'visible', timeout: 2000 });
  }

  async readDisplayedAdjacencyList() {
    // Returns an ordered array of { node: string, neighbors: string[] }
    const items = await this.listItems.elementHandles();
    const result = [];
    for (const handle of items) {
      const nodeSpan = await handle.$('.node');
      const neighborSpan = await handle.$('.neighbor-list');

      const node = nodeSpan ? (await nodeSpan.innerText()).trim() : '';
      const neighborsText = neighborSpan ? (await neighborSpan.innerText()).trim() : '';
      let neighbors = [];
      if (neighborsText === '(no neighbors)') {
        neighbors = [];
      } else if (neighborsText.length === 0) {
        neighbors = [];
      } else {
        neighbors = neighborsText.split(',').map(s => s.trim()).filter(Boolean);
      }
      result.push({ node, neighbors });
    }
    return result;
  }

  async clickBuild() {
    await this.buildBtn.click();
    // Wait a short time for DOM update to reflect build action
    await this.page.waitForTimeout(100); // small pause; DOM update is synchronous but keep stable
  }

  async setInput(text) {
    await this.textarea.fill(text);
  }

  async getOutputHtml() {
    return this.output.innerHTML();
  }

  async getListItemTexts() {
    return this.listItems.allTextContents();
  }
}

test.describe('Adjacency List Demonstration - FSM tests', () => {
  // Collect console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(`${msg.text()}`);
      }
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });
  });

  test('Initial render should display adjacency list on page load (S0_Idle)', async ({ page }) => {
    // This test validates the initial state S0_Idle:
    // - window.onload triggers initial rendering
    // - adjacency list is displayed with the nodes and their neighbors
    // - no unexpected console errors or uncaught page exceptions occurred during load
    const gp = new GraphPage(page, { consoleErrors, pageErrors });
    await gp.goto();

    // The header should be present
    await expect(gp.outputHeader).toBeVisible();
    const headerText = await gp.outputHeader.textContent();
    expect(headerText).toBeTruthy();
    expect(headerText.trim()).toMatch(/Adjacency List/i);

    // Read displayed adjacency list items
    const displayed = await gp.readDisplayedAdjacencyList();

    // The expected nodes in insertion order based on the default textarea content:
    // A -> B, C
    // B -> D
    // C -> D
    // D -> E
    // E -> (no neighbors)
    const expected = [
      { node: 'A', neighbors: ['B', 'C'] },
      { node: 'B', neighbors: ['D'] },
      { node: 'C', neighbors: ['D'] },
      { node: 'D', neighbors: ['E'] },
      { node: 'E', neighbors: [] },
    ];

    expect(displayed.length).toBe(expected.length);
    for (let i = 0; i < expected.length; i++) {
      expect(displayed[i].node).toBe(expected[i].node);
      expect(displayed[i].neighbors).toEqual(expected[i].neighbors);
    }

    // Assert no console errors or page errors were recorded during load
    expect(consoleErrors, 'No console.error messages should have been emitted').toEqual([]);
    expect(pageErrors, 'No uncaught page exceptions should have occurred').toEqual([]);
  });

  test('Clicking Build Graph updates display according to textarea (BuildGraphClick -> S1_GraphBuilt)', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_GraphBuilt
    // - Modify the textarea input
    // - Click the "Build Graph" button
    // - Ensure display updates to reflect new adjacency list
    const gp = new GraphPage(page, { consoleErrors, pageErrors });
    await gp.goto();

    // New input with some different edges
    const newInput = `X Y
Y Z
X Z
Z A
A X
`;
    await gp.setInput(newInput);

    // Click Build Graph to trigger the transition
    await gp.clickBuild();

    const displayed = await gp.readDisplayedAdjacencyList();

    // Expected adjacency list according to the input (in insertion order)
    // X -> [Y, Z]
    // Y -> [Z]
    // Z -> [A]
    // A -> [X]
    // Additionally, nodes that appear only as 'to' should still be in the map; here Y,Z,A appear as to/from.
    const expected = [
      { node: 'X', neighbors: ['Y', 'Z'] },
      { node: 'Y', neighbors: ['Z'] },
      { node: 'Z', neighbors: ['A'] },
      { node: 'A', neighbors: ['X'] },
    ];

    expect(displayed.length).toBe(expected.length);
    for (let i = 0; i < expected.length; i++) {
      expect(displayed[i].node).toBe(expected[i].node);
      expect(displayed[i].neighbors).toEqual(expected[i].neighbors);
    }

    // Assert no console errors or page errors during this interaction
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Handles invalid lines, duplicates, and self-loops as edge cases', async ({ page }) => {
    // This test validates error scenarios and edge cases:
    // - Lines that are invalid (not two tokens) are ignored
    // - Duplicate edges are represented as repeated neighbors
    // - Self-loops are allowed and shown as neighbor pointing to self
    const gp = new GraphPage(page, { consoleErrors, pageErrors });
    await gp.goto();

    // Input includes:
    // - A B (valid)
    // - A B (duplicate)
    // - INVALIDLINE (ignored)
    // - C D (valid)
    // - D D (self-loop)
    // - E   (invalid)
    const trickyInput = `A B
A B
INVALIDLINE
C D
D D
E
`;
    await gp.setInput(trickyInput);
    await gp.clickBuild();

    const displayed = await gp.readDisplayedAdjacencyList();

    // Expected insertion order from processing lines:
    // A -> [B, B]
    // B -> []  (created as to)
    // C -> [D]
    // D -> [D]
    // E is an invalid line with single token, so it should be ignored and not added
    const expected = [
      { node: 'A', neighbors: ['B', 'B'] },
      { node: 'B', neighbors: [] },
      { node: 'C', neighbors: ['D'] },
      { node: 'D', neighbors: ['D'] },
    ];

    expect(displayed.length).toBe(expected.length);
    for (let i = 0; i < expected.length; i++) {
      expect(displayed[i].node).toBe(expected[i].node);
      expect(displayed[i].neighbors).toEqual(expected[i].neighbors);
    }

    // Also explicitly verify that nodes with no neighbors display "(no neighbors)"
    const lis = page.locator('#output ul li');
    const bItem = lis.filter({ hasText: /^B:/ }).first();
    // Find neighbor-list span inside B item
    const bNeighborText = await bItem.locator('.neighbor-list').textContent();
    expect(bNeighborText.trim()).toBe('(no neighbors)');

    // Assert no console or page errors occurred during these edge-case operations
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Handles empty or whitespace-only input gracefully', async ({ page }) => {
    // This test validates that an empty or whitespace-only input yields an empty adjacency list display
    // (i.e., the <ul> should be present but contain no <li> elements)
    const gp = new GraphPage(page, { consoleErrors, pageErrors });
    await gp.goto();

    // Set the textarea to whitespace-only content
    await gp.setInput('   \n   ');
    await gp.clickBuild();

    // The header should still be present
    await expect(gp.outputHeader).toBeVisible();

    // There should be zero list items
    const itemsCount = await page.locator('#output ul li').count();
    expect(itemsCount).toBe(0);

    // Validate that output HTML contains an empty ul (no li's)
    const html = await gp.getOutputHtml();
    expect(html).toMatch(/<ul[^>]*>\s*<\/ul>/);

    // No console or page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Monitors the console and page errors during interactions', async ({ page }) => {
    // This test explicitly demonstrates capturing console.error and uncaught exceptions.
    // It will perform a few interactions and then assert that none of the error collectors have entries.
    const gp = new GraphPage(page, { consoleErrors, pageErrors });
    await gp.goto();

    // Perform a sequence of interactions
    await gp.setInput('P Q\nQ R\n');
    await gp.clickBuild();

    await gp.setInput(''); // empty input
    await gp.clickBuild();

    // Short pause to allow any async page errors to surface (if any)
    await page.waitForTimeout(100);

    // We expect no console.error messages and no uncaught page exceptions for this correct implementation
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test.afterEach(async ({}, testInfo) => {
    // If any test fails and there are console/page errors, include them in the failure message for debugging
    if (testInfo.status !== testInfo.expectedStatus) {
      // test failed — we won't modify behavior, but ensure debug info is available in test output
      if (consoleErrors.length) {
        console.log('Captured console.error messages:', consoleErrors);
      }
      if (pageErrors.length) {
        console.log('Captured uncaught page errors:', pageErrors);
      }
    }
  });
});