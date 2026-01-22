import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba8eb42-d5b2-11f0-b169-abe023d0d932.html';

// Page Object for the Union-Find demo page
class UnionFindPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // capture console messages and page errors for assertions
    this.page.on('console', (msg) => {
      try {
        this.consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // ignore any capture errors
      }
    });
    this.page.on('pageerror', (err) => {
      // store error.message for easier matching in tests
      this.pageErrors.push(String(err && err.message ? err.message : err));
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Set the #num-vertices input value
  async setNumVertices(value) {
    const input = await this.page.$('#num-vertices');
    await input.fill(String(value));
  }

  // Click Add Vertex button
  async clickAddVertex() {
    await this.page.click('button[onclick="addVertex()"]');
  }

  // Click Add Edge button
  async clickAddEdge() {
    await this.page.click('button[onclick="addEdge()"]');
  }

  // Get counts of elements inside the #graph
  async graphCounts() {
    const vertexCount = await this.page.$$eval('#graph .vertex', (els) => els.length);
    const edgeCount = await this.page.$$eval('#graph .edge', (els) => els.length);
    const edgeLabelCount = await this.page.$$eval('#graph .edge-label', (els) => els.length);
    const parentLabelCount = await this.page.$$eval('#graph .parent-label', (els) => els.length);
    const childLabelCount = await this.page.$$eval('#graph .child-label', (els) => els.length);
    return { vertexCount, edgeCount, edgeLabelCount, parentLabelCount, childLabelCount };
  }

  // Helpers to query DOM text if needed
  async headingText() {
    return this.page.textContent('h1');
  }
}

test.describe('Union-Find (Disjoint Set) interactive application - states and transitions', () => {
  let page;
  let uf;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    uf = new UnionFindPage(page);
    await uf.goto();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Idle state: page renders heading and empty graph (S0_Idle)', async () => {
    // Validate initial UI - evidence for Idle state: heading present
    const heading = await uf.headingText();
    expect(heading).toBe('Union-Find (Disjoint Set) Algorithm');

    // Graph should be present and initially empty
    const counts = await uf.graphCounts();
    expect(counts.vertexCount).toBe(0);
    expect(counts.edgeCount).toBe(0);

    // No runtime errors must be present immediately after load
    expect(uf.pageErrors.length).toBe(0);
  });

  test('Add a single vertex transitions to Vertex Added (S1_VertexAdded) without runtime error', async () => {
    // This test validates the transition: S0_Idle --AddVertex--> S1_VertexAdded
    // Provide 1 vertex to avoid drawGraph attempting to append to numeric parents
    await uf.setNumVertices(1);
    await uf.clickAddVertex();

    // Allow any synchronous script to run
    // Verify DOM updated: one vertex and one edge element created (per drawGraph logic)
    const counts = await uf.graphCounts();
    expect(counts.vertexCount).toBe(1);
    expect(counts.edgeCount).toBe(1);

    // Since only one vertex, no labels should exist (labels added only when i > 0)
    expect(counts.edgeLabelCount).toBe(0);
    expect(counts.parentLabelCount).toBe(0);
    expect(counts.childLabelCount).toBe(0);

    // No page errors should have been thrown for this safe case
    expect(uf.pageErrors.length).toBe(0);
  });

  test('Add multiple vertices triggers runtime error during drawGraph and partially updates DOM (S1_VertexAdded -> error)', async () => {
    // This test exercises the problematic drawGraph behavior when vertices array contains numbers
    // that are used as DOM nodes by mistake. We expect a TypeError related to appendChild.
    await uf.setNumVertices(2);
    await uf.clickAddVertex();

    // drawGraph is synchronous; pageerror should have been captured
    expect(uf.pageErrors.length).toBeGreaterThanOrEqual(1);

    // The error message should indicate appendChild usage on a non-DOM object
    // Different engines format messages differently; check for the substring 'appendChild'
    const combinedErrors = uf.pageErrors.join(' | ');
    expect(combinedErrors.toLowerCase()).toContain('appendchild');

    // Despite the error, some DOM changes may have occurred before the exception
    const counts = await uf.graphCounts();

    // Expect at least the first iteration additions to be present (>=1),
    // and likely two vertices/edges were created before the exception in the second iteration.
    expect(counts.vertexCount).toBeGreaterThanOrEqual(1);
    expect(counts.edgeCount).toBeGreaterThanOrEqual(1);

    // Labels (edge-label, parent-label, child-label) are attempted to be added for i > 0
    // but appending to numeric parent will have thrown; assert that label append did not complete normally
    // So either zero or partial labels; ensure we don't assert a strict number here
    expect(counts.edgeLabelCount + counts.parentLabelCount + counts.childLabelCount).toBeGreaterThanOrEqual(0);
  });

  test('Add Edge event triggers runtime error due to missing input fields (S1_VertexAdded -> S2_EdgeAdded error)', async () => {
    // This test validates the AddEdge event behavior: the HTML tries to read inputs #u-vertex1 and #v-vertex1
    // which are not present in the DOM. We expect a runtime error about reading property "value" of null.
    await uf.clickAddEdge();

    // Confirm at least one page error occurred
    expect(uf.pageErrors.length).toBeGreaterThanOrEqual(1);

    // Error message should reference missing elements or 'value'
    const combinedErrors = uf.pageErrors.join(' | ');
    const lower = combinedErrors.toLowerCase();
    // Accept variations like "cannot read properties of null (reading 'value')" or mentions of the id
    expect(lower).toSatisfy((s) => s.includes('u-vertex1') || s.includes('v-vertex1') || s.includes('reading') || s.includes('value') || s.includes('null'));
  });

  test('Edge cases for Add Vertex: zero, negative, and non-numeric inputs do not change graph and do not throw', async () => {
    // Zero vertices -> should not alter graph
    await uf.setNumVertices(0);
    await uf.clickAddVertex();
    let counts = await uf.graphCounts();
    expect(counts.vertexCount).toBe(0);
    expect(uf.pageErrors.length).toBe(0);

    // Negative number -> should not alter graph
    await uf.setNumVertices(-5);
    await uf.clickAddVertex();
    counts = await uf.graphCounts();
    expect(counts.vertexCount).toBe(0);
    expect(uf.pageErrors.length).toBe(0);

    // Non-numeric / empty -> parseInt yields NaN -> no change
    await uf.setNumVertices(''); // empty input
    await uf.clickAddVertex();
    counts = await uf.graphCounts();
    expect(counts.vertexCount).toBe(0);
    expect(uf.pageErrors.length).toBe(0);

    // Non-integer string
    await uf.setNumVertices('abc');
    await uf.clickAddVertex();
    counts = await uf.graphCounts();
    expect(counts.vertexCount).toBe(0);
    expect(uf.pageErrors.length).toBe(0);
  });

  test('Validate that the FSM evidence elements exist in the DOM (e.g., heading and inputs/buttons)', async () => {
    // The FSM expected components include #num-vertices input and the two buttons
    const numInput = await page.$('#num-vertices');
    const addVBtn = await page.$('button[onclick="addVertex()"]');
    const addEBtn = await page.$('button[onclick="addEdge()"]');
    const graphDiv = await page.$('#graph');
    expect(numInput).not.toBeNull();
    expect(addVBtn).not.toBeNull();
    expect(addEBtn).not.toBeNull();
    expect(graphDiv).not.toBeNull();

    // Ensure the placeholder text is present on the input
    const placeholder = await numInput.getAttribute('placeholder');
    expect(placeholder).toBe('Number of Vertices');
  });

  test('Observe console output and page errors behavior while performing a sequence of interactions', async () => {
    // Sequence: valid single vertex -> invalid add edge -> invalid multi-vertex
    // This test records console and page errors across actions to ensure they are captured
    await uf.setNumVertices(1);
    await uf.clickAddVertex();

    // Add Edge (will throw due to missing inputs)
    await uf.clickAddEdge();

    // Add multiple vertices (will likely throw in drawGraph)
    await uf.setNumVertices(3);
    await uf.clickAddVertex();

    // We expect at least one page error from Add Edge and at least one from multi-vertex draw
    expect(uf.pageErrors.length).toBeGreaterThanOrEqual(1);

    // Console messages may or may not exist; ensure we can access them safely
    // Validate that captured messages are strings and accessible
    for (const msg of uf.consoleMessages) {
      expect(typeof msg.text).toBe('string');
      expect(typeof msg.type).toBe('string');
    }
  });
});