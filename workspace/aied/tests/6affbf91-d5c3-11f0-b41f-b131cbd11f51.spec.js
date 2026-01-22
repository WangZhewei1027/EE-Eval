import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6affbf91-d5c3-11f0-b41f-b131cbd11f51.html';

test.describe('Binary Tree Visualization - FSM and UI end-to-end tests', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Collect page errors and console messages for each test
    pageErrors = [];
    consoleMessages = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Load the application fresh for each test so we start from the Idle state (window.onload sample tree)
    await page.goto(APP_URL);
    // Wait for the initial visualization to render: sample tree of 7 nodes should appear due to window.onload
    await page.waitForSelector('.node', { timeout: 2000 });
  });

  test.afterEach(async () => {
    // Basic sanity: no unexpected page errors occurred during the test
    // If there are page errors, we still let them surface by asserting none — this will fail the test and expose the error.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => String(e)).join('\n')}`).toBe(0);
  });

  test.describe('Initial state (S0_Idle)', () => {
    test('should initialize with sample tree and update info & visualization (onEnter updateInfo/updateVisualization)', async ({ page }) => {
      // Verify the page title and UI elements exist
      await expect(page.locator('h1')).toHaveText('Binary Tree Visualization');
      await expect(page.locator('#nodeValue')).toBeVisible();

      // The sample tree inserted in window.onload is [50,30,70,20,40,60,80]
      // Validate info panel values: Height should be 3, Node count 7
      const heightText = await page.locator('#treeHeight').textContent();
      const nodeCountText = await page.locator('#nodeCount').textContent();
      expect(parseInt(heightText)).toBe(3);
      expect(parseInt(nodeCountText)).toBe(7);

      // There should be 7 visual node elements in the visualization
      const nodeCount = await page.locator('.node').count();
      expect(nodeCount).toBe(7);

      // Traversal result should be empty initially
      await expect(page.locator('#traversalResult')).toHaveText('');

      // Ensure no page console errors occurred during load
      const errors = pageErrors.map(e => String(e)).join('\n');
      expect(errors).toBe('');
    });
  });

  test.describe('Insert Node (S1_NodeInserted) and related behaviors', () => {
    test('inserting a new value updates visualization and info (enter NodeInserted)', async ({ page }) => {
      // Insert a value that will modify tree structure (25)
      await page.fill('#nodeValue', '25');

      // Click Insert Node
      await page.click("button[onclick='insertNode()']");

      // After insertion, tree info should update (node count increases to 8, height should update to 4)
      await expect(page.locator('#nodeCount')).toHaveText('8');
      await expect(page.locator('#treeHeight')).toHaveText('4');

      // Visualization should now contain the new node with value 25
      const nodes = page.locator('.node');
      const totalNodes = await nodes.count();
      expect(totalNodes).toBe(8);

      // Verify there's a node element whose textContent is 25
      const nodeWith25 = page.locator('.node', { hasText: '25' });
      await expect(nodeWith25).toHaveCount(1);
    });

    test('inserting a duplicate value triggers alert and does not change the tree', async ({ page }) => {
      // Insert a duplicate value (50 exists in initial sample)
      await page.fill('#nodeValue', '50');

      // Expect a dialog saying "Value already exists in the tree"
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click("button[onclick='insertNode()']"),
      ]);
      expect(dialog.message()).toContain('Value already exists in the tree');
      await dialog.accept();

      // Node count and height should remain unchanged (still 7 and 3)
      await expect(page.locator('#nodeCount')).toHaveText('7');
      await expect(page.locator('#treeHeight')).toHaveText('3');

      // Number of .node elements remains 7
      const nodeCount = await page.locator('.node').count();
      expect(nodeCount).toBe(7);
    });

    test('inserting with invalid (empty) input triggers validation alert', async ({ page }) => {
      // Clear input
      await page.fill('#nodeValue', '');

      // Expect validation alert "Please enter a valid number"
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click("button[onclick='insertNode()']"),
      ]);
      expect(dialog.message()).toContain('Please enter a valid number');
      await dialog.accept();

      // Ensure tree unchanged
      await expect(page.locator('#nodeCount')).toHaveText('7');
      await expect(page.locator('#treeHeight')).toHaveText('3');
    });
  });

  test.describe('Delete Node (S2_NodeDeleted) behaviors', () => {
    test('deleting an existing node updates visualization and info (enter NodeDeleted)', async ({ page }) => {
      // First insert a node that we will delete to ensure deterministic behavior
      await page.fill('#nodeValue', '25');
      await page.click("button[onclick='insertNode()']");
      await expect(page.locator('#nodeCount')).toHaveText('8');

      // Now delete the node 25
      await page.fill('#nodeValue', '25');
      await page.click("button[onclick='deleteNode()']");

      // After deletion node count should revert to 7 and node 25 should be removed
      await expect(page.locator('#nodeCount')).toHaveText('7');

      // Ensure node 25 is no longer present in the visualization
      const removedNode = page.locator('.node', { hasText: '25' });
      await expect(removedNode).toHaveCount(0);
    });

    test('deleting with invalid input triggers validation alert', async ({ page }) => {
      // Ensure input empty
      await page.fill('#nodeValue', '');

      // Expect validation alert when clicking delete
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click("button[onclick='deleteNode()']"),
      ]);
      expect(dialog.message()).toContain('Please enter a valid number');
      await dialog.accept();

      // No change to node count
      await expect(page.locator('#nodeCount')).toHaveText('7');
    });
  });

  test.describe('Search Node (S3_NodeSearched) and highlighting', () => {
    test('searching for an existing node shows alert and highlights the node', async ({ page }) => {
      // Search for a known existing value 60
      await page.fill('#nodeValue', '60');

      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click("button[onclick='searchNode()']"),
      ]);

      // Expect alert to indicate found
      expect(dialog.message()).toContain('Value 60 found in the tree!');
      await dialog.accept();

      // Verify highlight applied to the node with value 60
      const highlighted = page.locator('.node.highlight', { hasText: '60' });
      await expect(highlighted).toHaveCount(1);
    });

    test('searching for a non-existing node shows not found alert and no highlight', async ({ page }) => {
      // Choose a value not in the initial tree (e.g., 999)
      await page.fill('#nodeValue', '999');

      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click("button[onclick='searchNode()']"),
      ]);
      expect(dialog.message()).toContain('Value 999 not found in the tree.');
      await dialog.accept();

      // Ensure no node is highlighted for 999
      const highlighted = page.locator('.node.highlight', { hasText: '999' });
      await expect(highlighted).toHaveCount(0);
    });
  });

  test.describe('Traversals (S0_Idle -> traversal actions)', () => {
    test('in-order traversal shows sorted node sequence', async ({ page }) => {
      // Click In-Order Traversal
      await page.click("button[onclick='traverseInOrder()']");

      // Expected in-order for initial tree: 20 → 30 → 40 → 50 → 60 → 70 → 80
      await expect(page.locator('#traversalResult')).toHaveText('20 → 30 → 40 → 50 → 60 → 70 → 80');
    });

    test('pre-order traversal shows root-first sequence', async ({ page }) => {
      await page.click("button[onclick='traversePreOrder()']");
      // Expected pre-order: 50 → 30 → 20 → 40 → 70 → 60 → 80
      await expect(page.locator('#traversalResult')).toHaveText('50 → 30 → 20 → 40 → 70 → 60 → 80');
    });

    test('post-order traversal shows children-first sequence', async ({ page }) => {
      await page.click("button[onclick='traversePostOrder()']");
      // Expected post-order: 20 → 40 → 30 → 60 → 80 → 70 → 50
      await expect(page.locator('#traversalResult')).toHaveText('20 → 40 → 30 → 60 → 80 → 70 → 50');
    });
  });

  test.describe('Clear Tree (S4_TreeCleared) and Random Tree (S5_TreeRandomGenerated)', () => {
    test('clearTree clears visualization, info and traversal result (enter TreeCleared)', async ({ page }) => {
      // First ensure traversalResult has something by performing a traversal
      await page.click("button[onclick='traverseInOrder()']");
      await expect(page.locator('#traversalResult')).not.toHaveText('');

      // Now clear the tree
      await page.click("button[onclick='clearTree()']");

      // Info panel should show zero values
      await expect(page.locator('#treeHeight')).toHaveText('0');
      await expect(page.locator('#nodeCount')).toHaveText('0');

      // Visualization should contain no .node elements
      await expect(page.locator('.node')).toHaveCount(0);

      // Traversal result cleared
      await expect(page.locator('#traversalResult')).toHaveText('');
    });

    test('generateRandomTree creates a random tree and updates visualization & info (enter RandomGenerated)', async ({ page }) => {
      // Click Random Tree
      await page.click("button[onclick='generateRandomTree()']");

      // After generation, nodeCount should reflect number of nodes in the tree.
      // According to implementation it attempts to insert between 5 and 14 nodes.
      // We assert that nodeCount is at least 5 and at most 14 to validate generation occurred.
      // Note: duplicates could theoretically reduce count, but probability is low; this is an acceptance check.
      const nodeCountText = await page.locator('#nodeCount').textContent();
      const nodeCount = parseInt(nodeCountText);
      expect(nodeCount).toBeGreaterThanOrEqual(5);
      expect(nodeCount).toBeLessThanOrEqual(14);

      // Visualization should have same number of .node elements as nodeCount
      const visualNodes = await page.locator('.node').count();
      expect(visualNodes).toBe(nodeCount);

      // Height should be at least 1 for a non-empty tree
      const height = parseInt(await page.locator('#treeHeight').textContent());
      expect(height).toBeGreaterThanOrEqual(1);
    });
  });
});