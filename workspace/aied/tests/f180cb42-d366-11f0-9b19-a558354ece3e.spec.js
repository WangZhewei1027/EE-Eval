import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f180cb42-d366-11f0-9b19-a558354ece3e.html';

// Page object encapsulating common interactions and selectors
class UFPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  nodeCountInput() { return this.page.locator('#nodeCount'); }
  node1Input() { return this.page.locator('#node1'); }
  node2Input() { return this.page.locator('#node2'); }

  initializeButton() { return this.page.locator('button[onclick="initializeSets()"]'); }
  unionButton() { return this.page.locator('button[onclick="unionNodes()"]'); }
  findButton() { return this.page.locator('button[onclick="findNode()"]'); }
  connectedButton() { return this.page.locator('button[onclick="checkConnected()"]'); }
  clearButton() { return this.page.locator('button[onclick="clearOperations()"]'); }

  visualization() { return this.page.locator('#visualization'); }
  operations() { return this.page.locator('#operations'); }
  operationEntries() { return this.page.locator('#operations .operation'); }

  nodeLocator(index) { return this.page.locator(`#node-${index}`); }

  // Click a node in the visualization (uses the DOM-generated nodes)
  async clickNode(index) {
    const node = this.nodeLocator(index);
    await node.scrollIntoViewIfNeeded();
    await node.click();
  }

  // Convenience: read number of nodes currently rendered
  async renderedNodesCount() {
    return await this.page.locator('.visualization .node').count();
  }

  // Convenience: get text content of last operation
  async lastOperationText() {
    const count = await this.operationEntries().count();
    if (count === 0) return null;
    return await this.operationEntries().nth(count - 1).textContent();
  }
}

test.describe('Union-Find Visualization - FSM and UI tests', () => {
  // Collect console errors and page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen for console events (capture error-like logs)
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Listen for uncaught exceptions in page context
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test we assert that there were no unexpected page errors or console errors.
    // The application source appears syntactically correct; ensure page did not throw uncaught exceptions.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => String(e)).join(', ')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console errors: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
  });

  test.describe('Initialization (S0_Idle -> S1_SetsInitialized)', () => {
    test('should initialize sets on page load and add operation history entry', async ({ page }) => {
      // Validate that window.onload triggers initializeSets() (entry action) and operation history shows initialization
      const ufPage = new UFPage(page);
      await ufPage.goto();

      // Wait for visualization nodes to be present
      await expect(ufPage.visualization()).toBeVisible();

      // There should be the default 6 nodes (value from input)
      const nodeCountValue = await ufPage.nodeCountInput().inputValue();
      expect(nodeCountValue).toBe('6');

      // Wait for nodes to be created
      await page.waitForSelector('.visualization .node');

      // Assert that 6 nodes are rendered
      const nodesCount = await ufPage.renderedNodesCount();
      expect(nodesCount).toBe(6);

      // The operations area should contain an initialization entry
      await page.waitForSelector('#operations .operation');
      const opText = await ufPage.lastOperationText();
      expect(opText).toContain('Initialized 6 disjoint sets');
    });

    test('re-initializing with different node count updates visualization and operations', async ({ page }) => {
      const ufPage = new UFPage(page);
      await ufPage.goto();

      // Change node count and click Initialize Sets
      await ufPage.nodeCountInput().fill('4');
      await ufPage.initializeButton().click();

      // Wait for 4 nodes to appear
      await page.waitForSelector('#node-0');
      const nodesCount = await ufPage.renderedNodesCount();
      expect(nodesCount).toBe(4);

      // Last operation should reflect initialization of 4 sets
      const lastOp = await ufPage.lastOperationText();
      expect(lastOp).toContain('Initialized 4 disjoint sets');
    });
  });

  test.describe('Node selection (S1_SetsInitialized -> S2_NodeSelected)', () => {
    test('clicking nodes selects them and updates input fields and classes', async ({ page }) => {
      const ufPage = new UFPage(page);
      await ufPage.goto();

      // Click node 2 -> should set node1 input to 2 and add selected class
      await ufPage.clickNode(2);
      await expect(ufPage.node1Input()).toHaveValue('2');
      await expect(ufPage.nodeLocator(2)).toHaveClass(/selected/);

      // Click node 4 -> should set node2 input to 4 and add selected class to node-4
      await ufPage.clickNode(4);
      await expect(ufPage.node2Input()).toHaveValue('4');
      await expect(ufPage.nodeLocator(4)).toHaveClass(/selected/);

      // Click node 3 when already two nodes selected -> selection resets and node1 becomes 3, node2 empty
      await ufPage.clickNode(3);
      await expect(ufPage.node1Input()).toHaveValue('3');
      // node2 becomes empty string in DOM; Playwright returns '' for empty input value
      await expect(ufPage.node2Input()).toHaveValue('');
      // Only node-3 should have selected class
      await expect(ufPage.nodeLocator(3)).toHaveClass(/selected/);
    });
  });

  test.describe('Union operation (S2_NodeSelected -> S3_UnionPerformed)', () => {
    test('perform union on two nodes updates visualization and operation history', async ({ page }) => {
      const ufPage = new UFPage(page);
      await ufPage.goto();

      // Ensure node1 and node2 inputs set to 0 and 1 (defaults)
      await expect(ufPage.node1Input()).toHaveValue('0');
      await expect(ufPage.node2Input()).toHaveValue('1');

      // Click Union
      await ufPage.unionButton().click();

      // An operation entry should be appended describing the union
      await page.waitForSelector('#operations .operation');
      const lastOp = await ufPage.lastOperationText();
      expect(lastOp).toMatch(/Union\(\d+, \d+\)/);

      // After union, there should be at least one .edge element (child->parent connection)
      // Wait a short time for updateVisualization to run and edges to be appended
      await page.waitForTimeout(150);
      const edgeCount = await page.locator('.visualization .edge').count();
      expect(edgeCount).toBeGreaterThanOrEqual(1);
    });

    test('union of same node triggers alert and does not append merge operation', async ({ page }) => {
      const ufPage = new UFPage(page);
      await ufPage.goto();

      // Set node1 and node2 to same index
      await ufPage.node1Input().fill('2');
      await ufPage.node2Input().fill('2');

      // Capture dialog and assert its message
      const dialogs = [];
      page.on('dialog', async dialog => {
        dialogs.push(dialog);
        await dialog.dismiss();
      });

      await ufPage.unionButton().click();

      // Ensure an alert was shown with expected message
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      expect(dialogs[0].message()).toContain('Please select different nodes');

      // Operation history should NOT contain "Sets merged" for this invalid action; last op should still be prior ops
      const lastOp = await ufPage.lastOperationText();
      expect(lastOp).not.toContain('Sets merged');
    });

    test('union with out-of-bounds index triggers alert', async ({ page }) => {
      const ufPage = new UFPage(page);
      await ufPage.goto();

      // Intentionally set an out-of-bounds node index (e.g., 100)
      await ufPage.node1Input().fill('0');
      await ufPage.node2Input().fill('100');

      const dialogs = [];
      page.on('dialog', async dialog => {
        dialogs.push(dialog);
        await dialog.dismiss();
      });

      await ufPage.unionButton().click();

      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      expect(dialogs[0].message()).toContain('Node index out of bounds');
    });

    test('union of already connected nodes writes "Already in same set"', async ({ page }) => {
      const ufPage = new UFPage(page);
      await ufPage.goto();

      // First union 0 and 1
      await ufPage.node1Input().fill('0');
      await ufPage.node2Input().fill('1');
      await ufPage.unionButton().click();

      // Then attempt union again on same pair -> should append Already in same set
      await ufPage.unionButton().click();

      // We expect the last operation to mention "Already in same set"
      await page.waitForSelector('#operations .operation');
      const lastOp = await ufPage.lastOperationText();
      expect(lastOp).toContain('Already in same set');
    });
  });

  test.describe('Find operation (S2_NodeSelected -> S4_FindPerformed)', () => {
    test('find returns root and appends operation with path compression note', async ({ page }) => {
      const ufPage = new UFPage(page);
      await ufPage.goto();

      // Create a union to change parent relationships
      await ufPage.node1Input().fill('2');
      await ufPage.node2Input().fill('3');
      await ufPage.unionButton().click();

      // Now call Find on node 3 (should compress path)
      await ufPage.node1Input().fill('3');
      await ufPage.findButton().click();

      // The operation history should include "Find(3) = <root> (Path compression applied)"
      await page.waitForSelector('#operations .operation');
      const lastOp = await ufPage.lastOperationText();
      expect(lastOp).toMatch(/Find\(3\) = \d+ \(Path compression applied\)/);

      // Node 3 should be selected visually
      await expect(ufPage.nodeLocator(3)).toHaveClass(/selected/);
    });

    test('find with out-of-bounds node triggers alert', async ({ page }) => {
      const ufPage = new UFPage(page);
      await ufPage.goto();

      await ufPage.node1Input().fill('999');

      const dialogs = [];
      page.on('dialog', async dialog => {
        dialogs.push(dialog);
        await dialog.dismiss();
      });

      await ufPage.findButton().click();

      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      expect(dialogs[0].message()).toContain('Node index out of bounds');
    });
  });

  test.describe('Connected check (S2_NodeSelected -> S5_ConnectedChecked)', () => {
    test('connected returns false for separate nodes and true after union', async ({ page }) => {
      const ufPage = new UFPage(page);
      await ufPage.goto();

      // Ensure nodes 4 and 5 are separate initially
      await ufPage.node1Input().fill('4');
      await ufPage.node2Input().fill('5');
      await ufPage.connectedButton().click();

      // Last operation should indicate false
      let lastOp = await ufPage.lastOperationText();
      expect(lastOp).toContain('Connected(4, 5) = false');

      // Union 4 and 5, then check again
      await ufPage.node1Input().fill('4');
      await ufPage.node2Input().fill('5');
      await ufPage.unionButton().click();

      await ufPage.connectedButton().click();
      lastOp = await ufPage.lastOperationText();
      expect(lastOp).toContain('Connected(4, 5) = true');
    });
  });

  test.describe('Clear operations (S1_SetsInitialized -> S6_OperationsCleared)', () => {
    test('clearOperations empties the operation history container', async ({ page }) => {
      const ufPage = new UFPage(page);
      await ufPage.goto();

      // Ensure there is at least one operation (initialization)
      await page.waitForSelector('#operations .operation');
      const initialCount = await ufPage.operationEntries().count();
      expect(initialCount).toBeGreaterThanOrEqual(1);

      // Click clear
      await ufPage.clearButton().click();

      // The operations container should only have the header and zero .operation entries
      const afterCount = await ufPage.operationEntries().count();
      expect(afterCount).toBe(0);

      // The operations container should still contain the header text
      await expect(ufPage.operations()).toContainText('Operation History:');
    });
  });

  test.describe('Selection edge-cases and DOM behavior (S2_NodeSelected transitions)', () => {
    test('selecting more than two nodes resets selection to the newly clicked node', async ({ page }) => {
      const ufPage = new UFPage(page);
      await ufPage.goto();

      // Click node 0 and node 1
      await ufPage.clickNode(0);
      await ufPage.clickNode(1);
      await expect(ufPage.nodeLocator(0)).toHaveClass(/selected/);
      await expect(ufPage.nodeLocator(1)).toHaveClass(/selected/);

      // Click node 2 -> should reset selection leaving only node 2 selected
      await ufPage.clickNode(2);
      await expect(ufPage.nodeLocator(2)).toHaveClass(/selected/);

      // Previous nodes should not have 'selected' anymore
      await expect(ufPage.nodeLocator(0)).not.toHaveClass(/selected/);
      await expect(ufPage.nodeLocator(1)).not.toHaveClass(/selected/);
    });
  });

  test.describe('Console and runtime observations', () => {
    test('no uncaught page errors or console.error entries occur during typical flows', async ({ page }) => {
      const ufPage = new UFPage(page);
      await ufPage.goto();

      // Perform a typical sequence: select nodes, union, find, check, clear
      await ufPage.clickNode(0);
      await ufPage.clickNode(1);
      await ufPage.unionButton().click();
      await ufPage.node1Input().fill('1');
      await ufPage.findButton().click();
      await ufPage.node1Input().fill('0');
      await ufPage.node2Input().fill('1');
      await ufPage.connectedButton().click();
      await ufPage.clearButton().click();

      // Allow a short grace period for any asynchronous errors to surface
      await page.waitForTimeout(200);

      // pageErrors and consoleErrors arrays are asserted in afterEach hook to be empty.
      // Here we just assert they are currently empty as well (redundant but explicit for this test).
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });
});