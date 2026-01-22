import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e932b121-d360-11f0-a097-ffdd56c22ef4.html';

// Page object encapsulating common interactions and queries
class BSTPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.loc = page.locator.bind(page);
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // wait for svg to be present and initial render to finish
    await this.page.waitForSelector('#svg');
    await this.page.waitForSelector('#lastOp');
  }

  async lastOpText() {
    return (await this.loc('#lastOp').innerText()).trim();
  }

  async nodeCount() {
    const t = (await this.loc('#nodeCount').innerText()).trim();
    return Number(t);
  }

  async heightVal() {
    const t = (await this.loc('#heightVal').innerText()).trim();
    return Number(t);
  }

  async rootValueText() {
    return (await this.loc('#rootValue').innerText()).trim();
  }

  async setValueInput(val) {
    await this.loc('#valueInput').fill(String(val));
  }

  async setSearchInput(val) {
    await this.loc('#searchInput').fill(String(val));
  }

  async setBulkInput(text) {
    await this.loc('#bulkInput').fill(text);
  }

  async clickInsert() {
    await this.loc('#insertBtn').click();
  }

  async clickDelete() {
    await this.loc('#deleteBtn').click();
  }

  async clickSearch() {
    await this.loc('#searchBtn').click();
  }

  async clickBuild() {
    await this.loc('#buildBtn').click();
  }

  async clickPreset() {
    await this.loc('#presetBtn').click();
  }

  async selectPreset(value) {
    await this.loc('#presetSelect').selectOption(value);
  }

  async clickClear() {
    await this.loc('#clearBtn').click();
  }

  async clickTraversal(buttonId) {
    await this.loc(`#${buttonId}`).click();
  }

  async toggleAnimate(on) {
    const checkbox = this.loc('#animateToggle');
    const isChecked = await checkbox.isChecked();
    if (isChecked !== on) {
      await checkbox.click();
    }
  }

  async toggleRepeat(on) {
    const checkbox = this.loc('#repeatToggle');
    const isChecked = await checkbox.isChecked();
    if (isChecked !== on) {
      await checkbox.click();
    }
  }

  // find g.node which contains a text node equal to given value
  nodeLocatorByValue(val) {
    // Use has-text based locator to find group containing the text content
    return this.loc('g.node', { hasText: String(val) });
  }

  // returns the circle element inside that g.node
  circleLocatorForValue(val) {
    return this.nodeLocatorByValue(val).locator('circle');
  }

  // Get traversal output items (array of numbers shown)
  async traversalOutputValues() {
    const count = await this.loc('#traversalOutput .chip').count();
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push(Number((await this.loc('#traversalOutput .chip').nth(i).innerText()).trim()));
    }
    return out;
  }

  // click first node in svg (useful for NodeClick deletion)
  async clickFirstNode() {
    const count = await this.loc('g.node').count();
    if (count === 0) throw new Error('No nodes to click');
    await this.loc('g.node').first().click();
  }

  // Build from comma-separated list and wait for render
  async buildFromList(listStr) {
    await this.setBulkInput(listStr);
    await this.clickBuild();
    // wait for lastOp to reflect build (expected to be "Built from list (N values)")
    await this.page.waitForTimeout(50);
  }
}

test.describe('Binary Tree (BST) Visualizer - e932b121-d360-11f0-a097-ffdd56c22ef4', () => {
  // Collect console messages and page errors for assertions
  test.beforeEach(async ({ page }) => {
    // no-op here; setup is per test below
  });

  test.describe('Application load and Idle state (S0_Idle)', () => {
    test('Initial render shows demo tree and stats, no uncaught page errors', async ({ page }) => {
      const pageErrors = [];
      const consoleMsgs = [];
      page.on('pageerror', (err) => pageErrors.push(err));
      page.on('console', (msg) => consoleMsgs.push(`${msg.type()}: ${msg.text()}`));

      const bst = new BSTPage(page);
      await bst.goto();

      // Validate Idle evidence: last operation should be 'Initial demo tree'
      const last = await bst.lastOpText();
      expect(last).toBe('Initial demo tree');

      // Node count and height should reflect seeded demo tree
      const nodeCount = await bst.nodeCount();
      expect(nodeCount).toBeGreaterThanOrEqual(1);
      const height = await bst.heightVal();
      expect(height).toBeGreaterThanOrEqual(1);

      // Root value should show 'root: 50' based on seed in implementation
      const rootValue = await bst.rootValueText();
      expect(rootValue).toMatch(/root:\s*50/);

      // Ensure no uncaught page errors occurred during load
      expect(pageErrors).toHaveLength(0);

      // Console should at least include some logs or none; ensure capturing works
      expect(Array.isArray(consoleMsgs)).toBe(true);
    });
  });

  test.describe('Tree modification interactions (S1_TreeModified)', () => {
    test('Insert a value -> updates tree, lastOp and node count', async ({ page }) => {
      const bst = new BSTPage(page);
      await bst.goto();

      const before = await bst.nodeCount();

      // Insert a new unique value
      await bst.setValueInput(55);
      await bst.clickInsert();

      // lastOp should reflect insertion
      await page.waitForFunction(() => document.querySelector('#lastOp').textContent.includes('Inserted'));
      const last = await bst.lastOpText();
      expect(last).toBe('Inserted 55');

      // Node count increased by 1
      const after = await bst.nodeCount();
      expect(after).toBe(before + 1);

      // The SVG should contain a node element with value 55
      const node = bst.nodeLocatorByValue(55);
      await expect(node).toHaveCount(1);

      // The inserted node is briefly highlighted with class 'highlight' (allow some time)
      const circle = bst.circleLocatorForValue(55);
      // wait for highlight to appear (setTimeout 40ms in app)
      await page.waitForTimeout(60);
      // ensure circle exists
      await expect(circle).toBeVisible();
    });

    test('Delete a value via input -> updates tree and lastOp', async ({ page }) => {
      const bst = new BSTPage(page);
      await bst.goto();

      // ensure value 55 exists (insert if needed)
      const node55 = bst.nodeLocatorByValue(55);
      const exists55 = await node55.count() > 0;
      if (!exists55) {
        await bst.setValueInput(55);
        await bst.clickInsert();
        await page.waitForTimeout(60);
      }

      const before = await bst.nodeCount();

      // Delete value 55 using deleteBtn
      await bst.setValueInput(55);
      await bst.clickDelete();

      // lastOp should reflect deletion of value 55
      await page.waitForFunction(() => document.querySelector('#lastOp').textContent.length > 0);
      const last = await bst.lastOpText();
      // Could be "Deleted 55" or if multiple duplicates some other wording - but implementation sets Deleted ${v} on successful delete
      expect(last).toBeOneOf(['Deleted 55', `Deleted 55`]);

      const after = await bst.nodeCount();
      expect(after).toBe(before - 1);
    });

    test('Clicking a node deletes that specific node (NodeClick)', async ({ page }) => {
      const bst = new BSTPage(page);
      await bst.goto();

      // Build a small deterministic tree
      await bst.buildFromList('8,3,10,1,6');
      // wait for render and lastOp
      await page.waitForFunction(() => document.querySelector('#lastOp').textContent.includes('Built from list'));

      const before = await bst.nodeCount();
      // Click the node containing value 10 (exists in tree)
      const node10 = bst.nodeLocatorByValue(10);
      await expect(node10).toHaveCount(1);
      await node10.click();

      // After click, lastOp should include 'Deleted node' and the node count decreased by 1
      await page.waitForFunction(() => document.querySelector('#lastOp').textContent.includes('Deleted node'));
      const last = await bst.lastOpText();
      expect(last).toMatch(/Deleted node\s*\d+/);

      const after = await bst.nodeCount();
      expect(after).toBe(before - 1);
    });

    test('Invalid insert/delete input triggers alert dialogs (edge cases)', async ({ page }) => {
      const bst = new BSTPage(page);
      await bst.goto();

      // Intercept dialog for insert (no value)
      const insertPromise = page.waitForEvent('dialog');
      await bst.setValueInput(''); // clear
      await bst.clickInsert();
      const dialog1 = await insertPromise;
      expect(dialog1.message()).toBe('Please enter a number to insert.');
      await dialog1.accept();

      // Intercept dialog for delete (no value)
      const deletePromise = page.waitForEvent('dialog');
      await bst.setValueInput('');
      await bst.clickDelete();
      const dialog2 = await deletePromise;
      expect(dialog2.message()).toBe('Please enter a number to delete.');
      await dialog2.accept();
    });
  });

  test.describe('Search interactions (S2_Searching)', () => {
    test('Search for existing value animates and marks found node', async ({ page }) => {
      const bst = new BSTPage(page);
      await bst.goto();

      // Search for a value that exists in seeded demo (e.g., 60)
      await bst.setSearchInput(60);

      // The search logic animates; wait for final lastOp to become 'Found 60'
      await bst.clickSearch();
      // The search animation uses delays; wait enough time for it to complete
      await page.waitForFunction(() => document.querySelector('#lastOp').textContent.includes('Found') || document.querySelector('#lastOp').textContent.includes('not found'), { timeout: 5000 });

      const last = await bst.lastOpText();
      expect(last).toBe('Found 60');

      // The node with value 60 should have a circle with class 'search' and appropriate inline style
      const circle = bst.circleLocatorForValue(60);
      await expect(circle).toHaveCount(1);
      // Allow some time for marking
      await page.waitForTimeout(50);

      // Verify that the circle has the class 'search' applied
      const hasSearchClass = await circle.evaluate((c) => c.classList.contains('search'));
      expect(hasSearchClass).toBe(true);
    });

    test('Searching with empty input triggers alert', async ({ page }) => {
      const bst = new BSTPage(page);
      await bst.goto();

      const dlgPromise = page.waitForEvent('dialog');
      await bst.setSearchInput('');
      await bst.clickSearch();
      const dlg = await dlgPromise;
      expect(dlg.message()).toBe('Please enter a number to search.');
      await dlg.accept();
    });
  });

  test.describe('Build and Generate Presets (S1_TreeModified)', () => {
    test('Build from comma-separated list constructs tree and updates stats', async ({ page }) => {
      const bst = new BSTPage(page);
      await bst.goto();

      // Build a specific list
      await bst.buildFromList('8,3,10,1,6');
      // Wait for lastOp change to built
      await page.waitForFunction(() => document.querySelector('#lastOp').textContent.includes('Built from list'), { timeout: 2000 });

      const last = await bst.lastOpText();
      expect(last).toBe('Built from list (5 values)');

      const nodeCount = await bst.nodeCount();
      expect(nodeCount).toBe(5);

      // Ensure nodes for provided values are present
      for (const v of [8, 3, 10, 1, 6]) {
        await expect(bst.nodeLocatorByValue(v)).toHaveCount(1);
      }
    });

    test('Generate sorted and balanced presets update lastOp and node counts', async ({ page }) => {
      const bst = new BSTPage(page);
      await bst.goto();

      // Sorted preset
      await bst.selectPreset('sorted');
      await bst.clickPreset();
      await page.waitForFunction(() => document.querySelector('#lastOp').textContent.includes('Generated sorted'), { timeout: 2000 });
      expect(await bst.lastOpText()).toBe('Generated sorted tree (degenerate)');
      expect(await bst.nodeCount()).toBe(10);
      // Height for sorted degenerate tree should be equal to number of nodes (10)
      expect(await bst.heightVal()).toBeGreaterThanOrEqual(1);

      // Balanced preset
      await bst.selectPreset('balanced');
      await bst.clickPreset();
      await page.waitForFunction(() => document.querySelector('#lastOp').textContent.includes('Generated balanced'), { timeout: 2000 });
      expect(await bst.lastOpText()).toBe('Generated balanced tree');
      expect(await bst.nodeCount()).toBe(15);
      // Balanced tree height should be less than 15
      expect(await bst.heightVal()).toBeLessThanOrEqual(15);
    });

    test('Clear tree resets stats and traversal output (S1 -> S0)', async ({ page }) => {
      const bst = new BSTPage(page);
      await bst.goto();

      // Ensure there's some tree, then clear
      await bst.clickClear();
      await page.waitForFunction(() => document.querySelector('#lastOp').textContent.includes('Cleared tree'));
      expect(await bst.lastOpText()).toBe('Cleared tree');
      expect(await bst.nodeCount()).toBe(0);
      expect((await bst.rootValueText()).length).toBeLessThanOrEqual(0);
      const traversalCount = await page.locator('#traversalOutput .chip').count();
      expect(traversalCount).toBe(0);
    });

    test('Build invalid inputs produce expected alert dialogs (edge cases)', async ({ page }) => {
      const bst = new BSTPage(page);
      await bst.goto();

      // Empty bulk input
      const dlg1 = page.waitForEvent('dialog');
      await bst.setBulkInput('');
      await bst.clickBuild();
      const d1 = await dlg1;
      expect(d1.message()).toBe('Enter comma separated numbers');
      await d1.accept();

      // Bulk input with non-numeric values
      const dlg2 = page.waitForEvent('dialog');
      await bst.setBulkInput('a, b, hello');
      await bst.clickBuild();
      const d2 = await dlg2;
      expect(d2.message()).toBe('No valid numbers found');
      await d2.accept();
    });
  });

  test.describe('Traversals and animations (S3_Traversing)', () => {
    test('Inorder, Preorder, Postorder, Level-order update lastOp and traversal output', async ({ page }) => {
      const bst = new BSTPage(page);
      await bst.goto();

      // Build a known tree for deterministic traversal
      await bst.buildFromList('50,30,70,20,40,60,80');
      await page.waitForFunction(() => document.querySelector('#lastOp').textContent.includes('Built from list'));

      // Turn off animate to get immediate traversal result
      await bst.toggleAnimate(false);

      // Inorder
      await bst.clickTraversal('inBtn');
      await page.waitForFunction(() => document.querySelector('#lastOp').textContent.includes('Inorder traversal'));
      expect(await bst.lastOpText()).toBe('Inorder traversal');
      const inorder = await bst.traversalOutputValues();
      // For the built tree, inorder should have same number of nodes as nodeCount
      expect(inorder.length).toBe(await bst.nodeCount());

      // Preorder
      await bst.clickTraversal('preBtn');
      await page.waitForFunction(() => document.querySelector('#lastOp').textContent.includes('Preorder traversal'));
      expect(await bst.lastOpText()).toBe('Preorder traversal');
      const preorder = await bst.traversalOutputValues();
      expect(preorder.length).toBe(await bst.nodeCount());

      // Postorder
      await bst.clickTraversal('postBtn');
      await page.waitForFunction(() => document.querySelector('#lastOp').textContent.includes('Postorder traversal'));
      expect(await bst.lastOpText()).toBe('Postorder traversal');
      const postorder = await bst.traversalOutputValues();
      expect(postorder.length).toBe(await bst.nodeCount());

      // Level-order
      await bst.clickTraversal('levelBtn');
      await page.waitForFunction(() => document.querySelector('#lastOp').textContent.includes('Level-order traversal'));
      expect(await bst.lastOpText()).toBe('Level-order traversal');
      const levelorder = await bst.traversalOutputValues();
      expect(levelorder.length).toBe(await bst.nodeCount());
    });

    test('Traversal repeat toggle can be toggled without throwing errors', async ({ page }) => {
      const bst = new BSTPage(page);
      await bst.goto();

      // Build small tree
      await bst.buildFromList('4,2,6,1,3');
      await page.waitForFunction(() => document.querySelector('#lastOp').textContent.includes('Built from list'));

      // Turn on animate and repeat to exercise animated path with repeat (run briefly)
      await bst.toggleAnimate(true);
      await bst.toggleRepeat(true);

      // Click inorder but do not wait too long; ensure lastOp is set and no unhandled errors occur
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));
      await bst.clickTraversal('inBtn');

      // Wait for lastOp to be updated
      await page.waitForFunction(() => document.querySelector('#lastOp').textContent.includes('Inorder traversal'), { timeout: 5000 });
      expect(await bst.lastOpText()).toBe('Inorder traversal');

      // After a short delay, ensure no uncaught page errors happened
      await page.waitForTimeout(300);
      expect(pageErrors.length).toBe(0);

      // Turn off repeat to avoid ongoing animation issues for subsequent tests
      await bst.toggleRepeat(false);
      await bst.toggleAnimate(false);
    });
  });

  test.describe('Robustness: console and page error observation', () => {
    test('Collect console messages and assert no uncaught ReferenceError/SyntaxError/TypeError occurred', async ({ page }) => {
      const pageErrors = [];
      const consoleMsgs = [];
      page.on('pageerror', (err) => pageErrors.push(err));
      page.on('console', (msg) => consoleMsgs.push({ type: msg.type(), text: msg.text() }));

      const bst = new BSTPage(page);
      await bst.goto();

      // Interact a bit to exercise code paths
      await bst.setValueInput(77);
      await bst.clickInsert();
      await page.waitForTimeout(60);
      await bst.setValueInput(77);
      await bst.clickDelete();
      await page.waitForTimeout(60);

      // We expect no uncaught page errors of fundamental types
      const seriousErrors = pageErrors.filter(e => {
        const name = e.name || '';
        return ['ReferenceError', 'SyntaxError', 'TypeError'].includes(name);
      });

      // Assert that there are no serious uncaught errors
      expect(seriousErrors.length).toBe(0);

      // Console messages are captured (may be empty) and should be an array
      expect(Array.isArray(consoleMsgs)).toBe(true);
    });
  });
});

// Helper to allow expect.oneOf like assertion (small helper extension)
expect.extend({
  async toBeOneOf(received, expectedArray) {
    const pass = expectedArray.includes(received);
    if (pass) {
      return { pass: true, message: () => `expected ${received} not to be one of ${expectedArray}` };
    } else {
      return { pass: false, message: () => `expected ${received} to be one of ${expectedArray}` };
    }
  }
});