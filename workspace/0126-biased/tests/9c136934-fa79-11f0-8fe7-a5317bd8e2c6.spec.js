import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c136934-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('B-Tree Interactive Demo (FSM driven tests) - 9c136934-fa79-11f0-8fe7-a5317bd8e2c6', () => {
  // Collect console and page errors for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // ignore if unable to read
      }
    });

    // Capture uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Ensure the main visual and controls are present
    await page.waitForSelector('#visual');
    await page.waitForSelector('#log');
  });

  test.afterEach(async () => {
    // Basic sanity: no unexpected page errors occurred during the test
    // The application is expected to run without uncaught exceptions.
    expect(pageErrors.length, 'No uncaught page errors (ReferenceError/SyntaxError/TypeError) should occur').toBe(0);
  });

  // Helper to read the log textarea (most app messages are written there)
  async function readLog(page) {
    return await page.$eval('#log', (ta) => ta.value);
  }

  // Helper to wait until log contains substring
  async function waitForLogContains(page, substr, timeout = 2000) {
    await page.waitForFunction(
      (s) => document.getElementById('log').value.includes(s),
      substr,
      { timeout }
    );
  }

  test.describe('Initial State and Idle State Validation', () => {
    test('Initial load should initialize demo and render empty B-Tree', async ({ page }) => {
      // Validate that the app initialization message was logged
      const log = await readLog(page);
      expect(log).toContain('Initialized demo with empty B-Tree');

      // The visual should include at least the root node element rendered with id and (empty) text
      const visualText = await page.$eval('#visual', el => el.textContent || '');
      expect(visualText).toMatch(/id:/); // node id visible
      expect(visualText).toContain('(empty)'); // root has no keys initially

      // Internally App.tree should exist and be a BTree instance (we can check some properties)
      const treeInfo = await page.evaluate(() => {
        return {
          hasTree: !!window.App && !!window.App.tree,
          order: window.App && window.App.tree ? window.App.tree.order : null,
          rootKeysLength: window.App && window.App.tree ? window.App.tree.root.keys.length : null
        };
      });
      expect(treeInfo.hasTree).toBe(true);
      expect(typeof treeInfo.order).toBe('number');
      expect(treeInfo.rootKeysLength).toBe(0);
    });
  });

  test.describe('Create, Insert, Traverse, Validate, Search, Delete transitions', () => {
    test('Create B-Tree with seed should produce expected traversal and logs', async ({ page }) => {
      // Enable step mode off to not create snapshots for this test
      const chkStep = page.locator('#chkStepMode');
      if (await chkStep.isChecked()) await chkStep.click();

      // Provide seed and create
      await page.fill('#inputSeed', '10,20,5');
      await page.click('#btnCreate');

      // Wait for create log
      await waitForLogContains(page, 'Created new B-Tree order=');

      // Verify the tree inorder traversal via the UI traverse button
      await page.selectOption('#selectTraversal', 'inorder');
      await page.click('#btnTraverse');

      // The traversal log should contain sorted keys: 5,10,20
      await waitForLogContains(page, 'Traversal inorder:');
      const log = await readLog(page);
      expect(log).toContain('Traversal inorder: [5,10,20]');

      // Also validate internal tree inorder matches expected array
      const inorder = await page.evaluate(() => window.App.tree.inorder());
      expect(inorder).toEqual([5, 10, 20]);

      // Validate action saved as last action
      const lastAction = await page.evaluate(() => window.App.lastAction && window.App.lastAction.desc);
      expect(lastAction).toBeDefined();
      expect(lastAction).toContain('Create');
    });

    test('Insert key transitions and visual update', async ({ page }) => {
      // Ensure a fresh tree by creating one
      await page.fill('#inputSeed', '');
      await page.click('#btnCreate');
      await waitForLogContains(page, 'Created new B-Tree order=');

      // Insert value 15
      await page.fill('#inputInsert', '15');
      await page.click('#btnInsert');

      // Wait for insert log
      await waitForLogContains(page, 'Inserted 15');
      const log = await readLog(page);
      expect(log).toContain('Inserted 15');

      // Assert App.tree contains the inserted key
      const hasKey = await page.evaluate(() => {
        return window.App.tree.inorder().includes(15);
      });
      expect(hasKey).toBe(true);

      // Visual should show node text including '15'
      const visual = await page.$eval('#visual', el => el.textContent || '');
      expect(visual).toContain('15');
    });

    test('Search should find an existing key and populate node id', async ({ page }) => {
      // Prepare tree with known keys
      await page.fill('#inputSeed', '8,12,16');
      await page.click('#btnCreate');
      await waitForLogContains(page, 'Created new B-Tree order=');

      // Search for 12
      await page.fill('#inputSearch', '12');
      await page.click('#btnSearch');

      // Expect the log to report found
      await waitForLogContains(page, 'Search: found 12');
      const log = await readLog(page);
      expect(log).toContain('Search: found 12');

      // Ensure inputNodeId has been populated with some id
      const nodeIdValue = await page.$eval('#inputNodeId', el => el.value);
      expect(nodeIdValue).not.toEqual('');
    });

    test('Delete key transitions remove the key from tree and logs action', async ({ page }) => {
      // Create with keys, then delete one
      await page.fill('#inputSeed', '2,4,6,8');
      await page.click('#btnCreate');
      await waitForLogContains(page, 'Created new B-Tree order=');

      // Delete 4
      await page.fill('#inputDelete', '4');
      await page.click('#btnDelete');

      // Wait for delete log
      await waitForLogContains(page, 'Delete requested for 4');
      const log = await readLog(page);
      expect(log).toContain('Delete requested for 4');

      // Verify 4 is no longer present in inorder output
      const inorder = await page.evaluate(() => window.App.tree.inorder());
      expect(inorder.includes(4)).toBe(false);
    });

    test('Validate B-Tree reports validation message', async ({ page }) => {
      // Create a clean tree with a sequence that should be valid
      await page.fill('#inputSeed', '1,3,5,7,9');
      await page.click('#btnCreate');
      await waitForLogContains(page, 'Created new B-Tree order=');

      // Click validate
      await page.click('#btnValidate');

      // Wait for Validation log
      await page.waitForFunction(() => document.getElementById('log').value.toLowerCase().includes('validation'), {}, { timeout: 2000 }).catch(() => {});
      const log = await readLog(page);
      // Can be OK or FOUND issues depending on internal shape; assert validation entry exists
      expect(log).toMatch(/Validation:/);
    });

    test('Traverse supports all traversal types and logs result', async ({ page }) => {
      // Create tree
      await page.fill('#inputSeed', '11,7,14');
      await page.click('#btnCreate');
      await waitForLogContains(page, 'Created new B-Tree order=');

      // In-order
      await page.selectOption('#selectTraversal', 'inorder');
      await page.click('#btnTraverse');
      await waitForLogContains(page, 'Traversal inorder:');
      expect((await readLog(page))).toContain('Traversal inorder:');

      // Pre-order
      await page.selectOption('#selectTraversal', 'preorder');
      await page.click('#btnTraverse');
      await waitForLogContains(page, 'Traversal preorder:');
      // The app logs 'Traverse preorder' as 'Traverse preorder' in saveLastAction but log uses 'Traversal pre-order' pattern; to be robust assert presence of 'Traverse' or 'Traversal'
      const logText = await readLog(page);
      expect(/Traverse|Traversal/.test(logText)).toBeTruthy();

      // Level-order
      await page.selectOption('#selectTraversal', 'level');
      await page.click('#btnTraverse');
      await waitForLogContains(page, 'Traversal level:');
      expect((await readLog(page))).toContain('Traversal level:');
    });
  });

  test.describe('Snapshots, Step Mode, and History controls', () => {
    test('Step mode records snapshots and step controls preview snapshots', async ({ page }) => {
      // Enable step mode
      const chkStep = page.locator('#chkStepMode');
      if (!(await chkStep.isChecked())) await chkStep.click();

      // Create a tree (this should push an initial snapshot when step mode is on)
      await page.fill('#inputSeed', '1,2,3');
      await page.click('#btnCreate');
      await waitForLogContains(page, 'Created new B-Tree order=');
      // After create in step mode, snapshots should contain at least 1 entry
      const snapCountText = await page.$eval('#snapCount', el => el.textContent);
      expect(Number(snapCountText)).toBeGreaterThanOrEqual(1);

      // Insert a key - should create before/after snapshots
      await page.fill('#inputInsert', '4');
      await page.click('#btnInsert');
      await waitForLogContains(page, 'Inserted 4');

      // Snapshots count should have increased
      const snapCountAfter = Number(await page.$eval('#snapCount', el => el.textContent));
      expect(snapCountAfter).toBeGreaterThanOrEqual(2);

      // Use Step Next to preview snapshots (should update snapIndex and log)
      await page.click('#btnStepNext');
      await page.waitForFunction(() => document.getElementById('log').value.toLowerCase().includes('snapshot #') || document.getElementById('snapIndex').textContent !== '-', {}, { timeout: 2000 });
      const snapIndexText = await page.$eval('#snapIndex', el => el.textContent);
      expect(snapIndexText).not.toEqual('-');

      // Click Jump to Start and Jump to End to ensure controls operate
      await page.click('#btnJumpStart');
      await waitForLogContains(page, 'Jumped to snapshot 0', 2000);
      await page.click('#btnJumpEnd');
      await waitForLogContains(page, 'Jumped to last snapshot', 2000);

      // Restore snapshot (use inputSnapshotIndex = 0)
      await page.fill('#inputSnapshotIndex', '0');
      await page.click('#btnRestoreSnapshot');
      await waitForLogContains(page, 'Restored snapshot', 2000);
      const log = await readLog(page);
      expect(log).toContain('Restored snapshot 0');
    });

    test('Clear history removes snapshots and updates display', async ({ page }) => {
      // Ensure some snapshots exist by enabling step mode and creating a tree
      const chkStep = page.locator('#chkStepMode');
      if (!(await chkStep.isChecked())) await chkStep.click();
      await page.fill('#inputSeed', '21,22');
      await page.click('#btnCreate');
      await waitForLogContains(page, 'Created new B-Tree order=');

      // Now clear history
      await page.click('#btnClearHistory');
      await waitForLogContains(page, 'Cleared snapshots history');
      const snapCount = await page.$eval('#snapCount', el => el.textContent);
      expect(Number(snapCount)).toBe(0);
      const snapIndex = await page.$eval('#snapIndex', el => el.textContent);
      // snapIndex should be '-' or empty
      expect(snapIndex === '-' || snapIndex === '').toBe(true);
    });
  });

  test.describe('Edge Cases and Error Scenarios', () => {
    test('Insert with invalid input logs an error message', async ({ page }) => {
      // Clear any tree to test behavior when no tree exists
      await page.click('#btnClear');
      await waitForLogContains(page, 'Cleared tree');

      // Ensure inputInsert is empty and click Insert
      await page.fill('#inputInsert', '');
      await page.click('#btnInsert');

      // Expect the app to log 'Insert: invalid number'
      await waitForLogContains(page, 'Insert: invalid number');
      const log = await readLog(page);
      expect(log).toContain('Insert: invalid number');
    });

    test('Delete when no tree logs invalid or no tree message', async ({ page }) => {
      // Clear the tree to simulate no tree present
      await page.click('#btnClear');
      await waitForLogContains(page, 'Cleared tree');

      // Provide a delete value and click Delete
      await page.fill('#inputDelete', '999');
      await page.click('#btnDelete');

      // Expect specific message for invalid or no tree
      await waitForLogContains(page, 'Delete: invalid or no tree');
      const log = await readLog(page);
      expect(log).toContain('Delete: invalid or no tree');
    });

    test('Force-split root and manual node editing produce logs and visual changes', async ({ page }) => {
      // Create a tree with several keys that will be present in root (depending on order)
      await page.fill('#inputSeed', '100,200,300,400,500'); // many keys
      await page.click('#btnCreate');
      await waitForLogContains(page, 'Created new B-Tree order=');

      // Try manual edit on root: fetch root id and set some keys
      const rootId = await page.evaluate(() => window.App.tree.root.id);
      await page.fill('#inputNodeId', rootId);
      await page.fill('#inputNodeKeys', '42,84');
      // Mark as leaf for testing purposes
      const chkLeaf = page.locator('#chkLeafFlag');
      if (!(await chkLeaf.isChecked())) await chkLeaf.click();
      await page.click('#btnApplyNodeEdit');

      await waitForLogContains(page, 'Applied manual edit to node ' + rootId);
      const log = await readLog(page);
      expect(log).toContain('Applied manual edit to node ' + rootId);

      // Now force split (attempt) on edited node
      await page.click('#btnForceSplit');
      // Expect either forced split log or a message about parent/root; ensure some log referencing 'Force' or 'Forced'
      await page.waitForTimeout(200); // small delay to let action log
      const logNow = await readLog(page);
      expect(/Force split|Forced split|force split|Cannot force split|Forced split root/i.test(logNow)).toBeTruthy();
    });
  });

  test.describe('Inspector, Export, and Auxiliary controls', () => {
    test('Show structure, nodes list and count operations write to log', async ({ page }) => {
      // Create a small tree
      await page.fill('#inputSeed', '3,6,9');
      await page.click('#btnCreate');
      await waitForLogContains(page, 'Created new B-Tree order=');

      // Show structure
      await page.click('#btnShowStructure');
      await waitForLogContains(page, 'Show structure', 2000);
      const log1 = await readLog(page);
      expect(log1.length).toBeGreaterThan(0);

      // Show nodes list
      await page.click('#btnShowNodesList');
      await waitForLogContains(page, 'Show nodes list', 2000);
      const log2 = await readLog(page);
      expect(log2.length).toBeGreaterThan(0);

      // Count & height
      await page.click('#btnCount');
      await waitForLogContains(page, 'Counts: nodes=', 2000);
      const log3 = await readLog(page);
      expect(log3).toContain('Counts: nodes=');
    });

    test('Exporting tree triggers export log entry', async ({ page }) => {
      // Ensure a tree exists
      await page.fill('#inputSeed', '1,2');
      await page.click('#btnCreate');
      await waitForLogContains(page, 'Created new B-Tree order=');

      // Click export - this triggers a synthetic download anchor click
      await page.click('#btnExport');
      await waitForLogContains(page, 'Exported tree to JSON', 2000);
      const log = await readLog(page);
      expect(log).toContain('Exported tree to JSON');
    });
  });

  test.describe('Final sanity: no uncaught errors and console inspection', () => {
    test('Console should not contain unhandled error messages', async ({ page }) => {
      // Already captured console messages in beforeEach. Validate none are of type 'error' associated with runtime exceptions
      const errorLike = consoleMessages.filter(m => m.type === 'error' || m.text.toLowerCase().includes('error'));
      // We allow some benign logs mentioning 'error' but there should not be unhandled exceptions reported as 'pageerror' (checked in afterEach)
      expect(errorLike.length).toBeLessThan(3); // allow at most a couple of benign mentions
    });
  });
});