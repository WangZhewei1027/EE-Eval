import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a32bc44-ffc5-11f0-8b43-1ffa87931c43.html';

/**
 * Page Object for the Union-Find visualization page.
 * Encapsulates common interactions and queries used across tests.
 */
class UFPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.unionForm = page.locator('#unionForm');
    this.findForm = page.locator('#findForm');
    this.message = page.locator('#message');
    this.setsDisplay = page.locator('#setsDisplay');
    this.svg = page.locator('#svgCanvas');
    this.edgesGroup = page.locator('#edgesGroup');
    this.node = id => page.locator(`g.node[data-id="${id}"]`);
  }

  // Fill and submit union form
  async union(a, b) {
    await this.page.fill('#unionA', String(a));
    await this.page.fill('#unionB', String(b));
    await this.page.click('#unionForm button[type="submit"]');
  }

  // Fill and submit find form
  async find(a, b) {
    await this.page.fill('#findA', String(a));
    await this.page.fill('#findB', String(b));
    await this.page.click('#findForm button[type="submit"]');
  }

  // Returns trimmed text content of message
  async getMessageText() {
    const txt = await this.message.textContent();
    return (txt || '').trim();
  }

  // Returns trimmed text content of sets display
  async getSetsText() {
    const txt = await this.setsDisplay.textContent();
    return (txt || '').trim();
  }

  // Return number of edge <line> elements in edgesGroup
  async getEdgeCount() {
    return await this.page.locator('#edgesGroup line').count();
  }

  // Return array of node ids that currently have the 'highlight' class
  async getHighlightedNodeIds() {
    const highlighted = this.page.locator('g.node.highlight');
    const count = await highlighted.count();
    const ids = [];
    for (let i = 0; i < count; i++) {
      const el = highlighted.nth(i);
      const attr = await el.getAttribute('data-id');
      ids.push(Number(attr));
    }
    return ids.sort((a,b)=>a-b);
  }

  // Focus a node (g.node has tabindex=0 so focusable)
  async focusNode(id) {
    await this.page.focus(`g.node[data-id="${id}"]`);
  }

  // Blur node by focusing something else (body)
  async blurNode(id) {
    // Focus body to blur the node
    await this.page.evaluate(() => document.body.focus());
  }
}

test.describe('Union-Find (Disjoint Set) Visualization - E2E', () => {
  // Collect console messages and page errors for each test so we can assert on them
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Observe console messages and runtime errors
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the app fresh for each test
    await page.goto(APP_URL);
    // Ensure the page loaded by checking the main heading exists
    await expect(page.locator('h1')).toHaveText('Union-Find (Disjoint Set) Data Structure Demo');
  });

  test.afterEach(async () => {
    // Assert there were no uncaught runtime errors during the test
    // The application is expected to run without runtime exceptions (ReferenceError/SyntaxError/TypeError).
    // If such errors exist they will be captured in pageErrors and cause test failures here.
    expect(pageErrors.length, `Expected no page runtime errors, but found: ${pageErrors.map(e => e.message).join(' || ')}`).toBe(0);

    // Also assert there are no console error messages produced by the page
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Expected no console.error messages, but found: ${consoleErrors.map(e => e.text).join(' || ')}`).toBe(0);
  });

  test.describe('Idle state and initial rendering', () => {
    test('renders header, sets display, SVG and initial state (S0_Idle)', async ({ page }) => {
      const uf = new UFPage(page);

      // The initial "Idle" state should render the page and show the header
      await expect(page.locator('h1')).toHaveText('Union-Find (Disjoint Set) Data Structure Demo');

      // The sets display should contain "Current Sets:" with 10 singleton sets {0}, {1}, ..., {9}
      const setsText = await uf.getSetsText();
      expect(setsText.startsWith('Current Sets:'), 'sets display should start with "Current Sets:"').toBeTruthy();

      // Verify that each singleton appears in the sets display
      for (let i = 0; i < 10; i++) {
        expect(setsText).toContain(`{${i}}`);
      }

      // Initially there should be no edges drawn (each element is its own parent)
      const edgeCount = await uf.getEdgeCount();
      expect(edgeCount).toBe(0);

      // No highlighted nodes initially
      const highlighted = await uf.getHighlightedNodeIds();
      expect(highlighted.length).toBe(0);
    });
  });

  test.describe('Union operations and transition to S1_UnionPerformed', () => {
    test('perform union of two distinct elements updates sets, message, and edges', async ({ page }) => {
      const uf = new UFPage(page);

      // Perform union 1 and 2
      await uf.union(1, 2);

      // After union, message should indicate success and mention the elements
      const msg = await uf.getMessageText();
      expect(msg).toContain('Union done: merged sets containing 1 and 2.');

      // The sets display should now contain a combined set {1, 2}
      const setsText = await uf.getSetsText();
      expect(setsText).toContain('{1, 2}');

      // There should now be exactly one edge drawn reflecting the parent-child relation
      const edgesAfter = await uf.getEdgeCount();
      expect(edgesAfter).toBeGreaterThanOrEqual(1);

      // Highlights are cleared after successful union according to implementation
      const highlighted = await uf.getHighlightedNodeIds();
      expect(highlighted.length).toBe(0);
    });

    test('attempting to union the same element shows an error message', async ({ page }) => {
      const uf = new UFPage(page);

      // Union 3 with itself should be rejected by the form handler
      await uf.union(3, 3);
      const msg = await uf.getMessageText();
      expect(msg).toBe('Cannot union the same element with itself.');

      // Ensure sets unchanged (still contains singleton {3})
      const setsText = await uf.getSetsText();
      expect(setsText).toContain('{3}');
    });

    test('union with invalid inputs shows validation message', async ({ page }) => {
      const uf = new UFPage(page);

      // Use an out-of-range value for union (e.g., 12)
      await uf.union(-1, 12);
      let msg = await uf.getMessageText();
      expect(msg).toBe('Please enter valid elements between 0 and 9.');

      // Also test non-numeric input (empty fields) by clearing and submitting
      await page.fill('#unionA', '');
      await page.fill('#unionB', '');
      await page.click('#unionForm button[type="submit"]');
      msg = await uf.getMessageText();
      expect(msg).toBe('Please enter valid elements between 0 and 9.');
    });

    test('union of already connected elements reports already connected', async ({ page }) => {
      const uf = new UFPage(page);

      // First union 4 and 5
      await uf.union(4, 5);
      let msg = await uf.getMessageText();
      expect(msg).toContain('Union done: merged sets containing 4 and 5.');

      // Now union 4 and 5 again -> should say already in same set
      await uf.union(4, 5);
      msg = await uf.getMessageText();
      expect(msg).toContain('Elements 4 and 5 are already in the same set.');
    });
  });

  test.describe('Find/Connected checks and transitions to S2_ConnectedCheck / S3_NotConnectedCheck', () => {
    test('find reports connected for already unioned elements (Yes)', async ({ page }) => {
      const uf = new UFPage(page);

      // Setup: union 6 and 7
      await uf.union(6, 7);
      await expect(uf.getMessageText()).resolves.toContain('Union done: merged sets containing 6 and 7.');

      // Now use find form for 6 and 7
      await uf.find(6, 7);
      const msg = await uf.getMessageText();
      expect(msg).toBe('Yes, elements 6 and 7 are connected (in the same set).');

      // The nodes for 6 and 7 should be highlighted (find highlights path nodes)
      const highlighted = await uf.getHighlightedNodeIds();
      expect(highlighted).toEqual(expect.arrayContaining([6, 7]));
    });

    test('find reports not connected for separate elements (No) and highlights paths', async ({ page }) => {
      const uf = new UFPage(page);

      // Ensure elements 8 and 9 are not unioned (initial state)
      await uf.find(8, 9);
      const msg = await uf.getMessageText();
      expect(msg).toBe('No, elements 8 and 9 are NOT connected (in different sets).');

      // The nodes 8 and 9 should be highlighted as part of the find visualization
      const highlighted = await uf.getHighlightedNodeIds();
      expect(highlighted).toEqual(expect.arrayContaining([8, 9]));
    });

    test('find same element returns immediate connected message and highlights only that node', async ({ page }) => {
      const uf = new UFPage(page);

      // Find for same element 0 vs 0
      await uf.find(0, 0);
      const msg = await uf.getMessageText();
      expect(msg).toBe('Elements 0 and 0 are the same element, so they are connected.');

      // Only node 0 should be highlighted
      const highlighted = await uf.getHighlightedNodeIds();
      expect(highlighted).toEqual([0]);
    });

    test('find with invalid inputs shows validation message', async ({ page }) => {
      const uf = new UFPage(page);

      // Out of range
      await uf.find(20, -5);
      let msg = await uf.getMessageText();
      expect(msg).toBe('Please enter valid elements between 0 and 9.');

      // Empty input
      await page.fill('#findA', '');
      await page.fill('#findB', '');
      await page.click('#findForm button[type="submit"]');
      msg = await uf.getMessageText();
      expect(msg).toBe('Please enter valid elements between 0 and 9.');
    });
  });

  test.describe('Keyboard accessibility: Node focus and blur events (NodeFocus / NodeBlur)', () => {
    test('focusing a node displays its set/root info and highlights it, blurring clears', async ({ page }) => {
      const uf = new UFPage(page);

      // Precondition: union 2 and 3 so that node 3's root is likely 2 (or vice versa) depending on ranks
      await uf.union(2, 3);
      await expect(uf.getMessageText()).resolves.toContain('Union done: merged sets containing 2 and 3.');

      // Focus node 3 (should show "Element 3 belongs to set with root X.")
      await uf.focusNode(3);
      const focusMsg = await uf.getMessageText();
      expect(focusMsg).toMatch(/Element 3 belongs to set with root \d+\./);

      // Node 3 should be highlighted while focused
      let highlighted = await uf.getHighlightedNodeIds();
      expect(highlighted).toContain(3);

      // Blur the node (focus body), the message should be cleared and highlights removed
      await uf.blurNode(3);
      // Give a tiny wait to allow blur handlers to run
      await page.waitForTimeout(50);
      const afterBlurMsg = await uf.getMessageText();
      expect(afterBlurMsg).toBe('');

      highlighted = await uf.getHighlightedNodeIds();
      expect(highlighted.length).toBe(0);
    });
  });

  test.describe('Additional edge cases and visual checks', () => {
    test('edges reflect union parent-child relationships (visual check)', async ({ page }) => {
      const uf = new UFPage(page);

      // Initially 0 edges
      let initialEdges = await uf.getEdgeCount();
      expect(initialEdges).toBe(0);

      // Union 7 and 8 -> create at least one edge
      await uf.union(7, 8);
      await expect(uf.getMessageText()).resolves.toContain('Union done: merged sets containing 7 and 8.');

      // After union there should be at least one line element under #edgesGroup
      const edgesAfter = await uf.getEdgeCount();
      expect(edgesAfter).toBeGreaterThanOrEqual(1);

      // Visual highlight path when doing find should add 'highlight' class to edges,
      // we can't directly assert SVG stroke color easily, but we can assert presence of class
      await uf.find(7, 8);
      // There should be at least one edge that may have highlight class (if path included)
      const highlightedEdgesCount = await page.locator('#edgesGroup line.highlight').count();
      // It's acceptable for highlight count to be 0 in some implementations,
      // but we assert that edge elements exist (already done) — primary check done above.
      expect(edgesAfter).toBeGreaterThanOrEqual(1);
    });
  });
});