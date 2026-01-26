import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72a94201-fa78-11f0-812d-c9788050701f.html';

/**
 * Page Object for the Min Heap Visualization page.
 * Encapsulates common interactions and queries to keep tests readable.
 */
class HeapPage {
  constructor(page) {
    this.page = page;
    this.containerSelector = '#heapTree';
    this.nodeSelector = `${this.containerSelector} .node`;
    this.minNodeSelector = `${this.containerSelector} .node.min`;
    this.activeNodeSelector = `${this.containerSelector} .node.active`;
    this.insertBtn = page.locator('#insertBtn');
    this.extractBtn = page.locator('#extractBtn');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for DOMContentLoaded-driven initialization
    await this.page.waitForLoadState('domcontentloaded');
  }

  async getNodeCount() {
    return await this.page.locator(this.nodeSelector).count();
  }

  async getNodeTexts() {
    const loc = this.page.locator(this.nodeSelector);
    const count = await loc.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await loc.nth(i).innerText()).trim());
    }
    return texts;
  }

  async getRootText() {
    const root = this.page.locator(`${this.nodeSelector} >> nth=0`);
    if ((await root.count()) === 0) return null;
    return (await root.innerText()).trim();
  }

  async waitForMinHighlight(timeout = 2000) {
    await this.page.locator(this.minNodeSelector).waitFor({ state: 'visible', timeout });
  }

  async waitForActiveNode(timeout = 2000) {
    await this.page.locator(this.activeNodeSelector).first().waitFor({ state: 'visible', timeout });
  }

  async clickInsert() {
    await this.insertBtn.click();
  }

  async clickExtract() {
    await this.extractBtn.click();
  }

  async isHeapEmptyMessageVisible() {
    const html = await this.page.locator(this.containerSelector).innerHTML();
    return html.includes('Heap is empty');
  }

  async waitForNodeCountToBe(expected, timeout = 3000) {
    await this.page.waitForFunction(
      ({ sel, expected }) => document.querySelectorAll(sel).length === expected,
      { timeout },
      { sel: this.nodeSelector, expected }
    );
  }

  async waitForNodeCountToBeGreaterThan(threshold, timeout = 3000) {
    await this.page.waitForFunction(
      ({ sel, threshold }) => document.querySelectorAll(sel).length > threshold,
      { timeout },
      { sel: this.nodeSelector, threshold }
    );
  }

  async waitForNodeCountToBeLessThan(threshold, timeout = 3000) {
    await this.page.waitForFunction(
      ({ sel, threshold }) => document.querySelectorAll(sel).length < threshold,
      { timeout },
      { sel: this.nodeSelector, threshold }
    );
  }
}

test.describe('Min Heap Visualization (FSM validation) - Application ID 72a94201-fa78-11f0-812d-c9788050701f', () => {
  // Collect console and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Nothing here; per-test listeners are created inside each test to isolate captures.
  });

  // Test initial Idle state (S0_Idle) and renderHeap entry action
  test('S0_Idle: Initial renderHeap() on load - verifies nodes and min highlight', async ({ page }) => {
    // Capture console errors and page errors
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const heap = new HeapPage(page);
    await heap.goto();

    // After initialization, renderHeap() should have created nodes OR show empty message.
    // Wait briefly for the rendering and min highlight timeouts inside the app.
    // The app adds .min class after a 300ms timeout; wait up to 2s for it.
    const nodeCount = await heap.getNodeCount();

    // Assert that either there are nodes or the "Heap is empty" text is visible.
    const emptyVisible = await heap.isHeapEmptyMessageVisible();
    expect(nodeCount > 0 || emptyVisible).toBeTruthy();

    if (nodeCount > 0) {
      // There should be a root element and eventually a .min class on it
      await heap.waitForMinHighlight(2000);
      const minCount = await page.locator(heap.minNodeSelector).count();
      expect(minCount).toBeGreaterThanOrEqual(1);
      // Root text should be a number string
      const rootText = await heap.getRootText();
      expect(rootText).toMatch(/^\d+$/);
    } else {
      // Confirm the empty message is shown and contains expected text
      const html = await page.locator(heap.containerSelector).innerHTML();
      expect(html).toContain('Heap is empty');
    }

    // Assert no unexpected console or page errors were produced during initial load
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  // Test Insert action: S0_Idle -> S1_Inserting -> S0_Idle
  test('S1_Inserting: Insert Random Value triggers insertRandomValue() then renderHeap()', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const heap = new HeapPage(page);
    await heap.goto();

    // Record initial node count
    let initialCount = await heap.getNodeCount();

    // If heap is empty initially, the insert will create nodes - handle both cases
    // Click Insert Random Value (triggers S1_Inserting entry action insertRandomValue())
    await heap.clickInsert();

    // After inserting, node count should increase by 1 (or go from 0 to >=1)
    await heap.waitForNodeCountToBeGreaterThan(initialCount, 4000);
    const afterInsertCount = await heap.getNodeCount();
    expect(afterInsertCount).toBeGreaterThan(initialCount);

    // During insertion, nodes are highlighted with 'active' class temporarily - wait for any active node
    // highlightNode uses duration 1000ms; heapify animations add additional delays. Wait up to 3s.
    const activeExists = await page.locator(heap.activeNodeSelector).count();
    // active may have been added and removed already; at least ensure no errors and that final heap renders
    const finalRoot = await heap.getRootText();
    expect(finalRoot).toMatch(/^\d+$/);

    // After the operation completes, the min (root) should still have 'min' class
    await heap.waitForMinHighlight(3000);
    const minCount = await page.locator(heap.minNodeSelector).count();
    expect(minCount).toBeGreaterThanOrEqual(1);

    // Ensure no JS console errors or uncaught page errors happened during insert
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  // Test Extract action: S0_Idle -> S2_Extracting -> S0_Idle
  test('S2_Extracting: Extract Minimum removes root and re-renders heap', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const heap = new HeapPage(page);
    await heap.goto();

    // Ensure there is at least one node to extract; if empty, insert one first to create a node.
    let initialCount = await heap.getNodeCount();
    if (initialCount === 0) {
      await heap.clickInsert();
      await heap.waitForNodeCountToBeGreaterThan(0, 3000);
      initialCount = await heap.getNodeCount();
      expect(initialCount).toBeGreaterThan(0);
    }

    // Capture current root value for later comparison
    const rootBefore = await heap.getRootText();

    // Click Extract Minimum - this triggers highlight and animations
    await heap.clickExtract();

    // After extract, node count should reduce by 1 OR the heap may become empty
    // Wait up to 5s since extract has animation delays and heapify animations
    await heap.page.waitForTimeout(50); // small delay to let operation begin
    await heap.page.waitForFunction(
      ({ sel, initial }) => document.querySelectorAll(sel).length < initial,
      { timeout: 5000 },
      { sel: heap.nodeSelector, initial: initialCount }
    ).catch(() => {}); // swallow - we'll check counts below

    const afterCount = await heap.getNodeCount();

    // If the heap had one element, after extraction it may be zero and display "Heap is empty"
    if (initialCount === 1) {
      expect(afterCount).toBe(0);
      const emptyVisible = await heap.isHeapEmptyMessageVisible();
      expect(emptyVisible).toBeTruthy();
    } else {
      // Otherwise count should have decreased by 1
      expect(afterCount).toBe(initialCount - 1);
      // And the new root should be a number, likely different from previous root
      const newRoot = await heap.getRootText();
      expect(newRoot).toMatch(/^\d+$/);
      // It's valid for new root to be different; if same (identical numbers) that's okay too.
    }

    // Ensure the min class exists on the root if heap is non-empty
    if (afterCount > 0) {
      await heap.waitForMinHighlight(3000);
      const minCount = await page.locator(heap.minNodeSelector).count();
      expect(minCount).toBeGreaterThanOrEqual(1);
    }

    // No unexpected console or uncaught errors during extraction
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  // Edge case: Repeatedly extract until empty then call extract on empty
  test('Edge Case: Extract until empty and ensure extract on empty is safe (no errors)', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const heap = new HeapPage(page);
    await heap.goto();

    // Keep extracting until the "Heap is empty" message appears or until 20 attempts
    let attempts = 0;
    while (attempts < 20) {
      const count = await heap.getNodeCount();
      if (count === 0) break;
      await heap.clickExtract();
      // wait a reasonable amount for animation + re-render
      await page.waitForTimeout(600);
      attempts++;
    }

    // At this point heap should be empty
    const emptyVisible = await heap.isHeapEmptyMessageVisible();
    expect(emptyVisible).toBeTruthy();

    // Now call extract again on empty heap - should be a no-op and not throw
    await heap.clickExtract();
    // Wait briefly to allow any errors to surface
    await page.waitForTimeout(300);

    // Confirm still empty and no console/page errors
    const stillEmpty = await heap.isHeapEmptyMessageVisible();
    expect(stillEmpty).toBeTruthy();

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  // Edge case: Insert after empty - ensure inserting into an empty heap re-renders correctly
  test('Edge Case: Insert into empty heap re-renders nodes and sets min', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const heap = new HeapPage(page);
    await heap.goto();

    // Ensure empty first by extracting until empty
    for (let i = 0; i < 10; i++) {
      const count = await heap.getNodeCount();
      if (count === 0) break;
      await heap.clickExtract();
      await page.waitForTimeout(200);
    }

    expect(await heap.isHeapEmptyMessageVisible()).toBeTruthy();

    // Now insert into empty heap
    await heap.clickInsert();

    // Wait for nodes to appear
    await heap.waitForNodeCountToBeGreaterThan(0, 4000);
    const countAfter = await heap.getNodeCount();
    expect(countAfter).toBeGreaterThan(0);

    // Min highlight should appear
    await heap.waitForMinHighlight(3000);
    const minCount = await page.locator(heap.minNodeSelector).count();
    expect(minCount).toBeGreaterThanOrEqual(1);

    // No console or page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  // Verify visual cues: nodes have expected classes and inline styles applied when present
  test('Visual feedback: nodes have .node class and inline position styles after render', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const heap = new HeapPage(page);
    await heap.goto();

    // Wait for render to finish
    const count = await heap.getNodeCount();
    if (count === 0) {
      // If empty, insert one to test visual rendering
      await heap.clickInsert();
      await heap.waitForNodeCountToBeGreaterThan(0, 3000);
    }

    // Check first node has inline left/top style values (positioned nodes)
    const firstNode = page.locator('#heapTree .node').first();
    await expect(firstNode).toHaveAttribute('style', /left:.*px;.*top:.*px/);

    // Nodes should have class 'node'
    const classes = await firstNode.getAttribute('class');
    expect(classes.split(' ')).toContain('node');

    // No runtime errors produced
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});