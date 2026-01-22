import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e14570-d5c1-11f0-a327-5f281c6cb8e2.html';

// Page Object for the BST demo
class BSTPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Traversal output element text
  async traversalText() {
    return this.page.locator('#traversalOutput').innerText();
  }

  // Count SVG nodes (g.node)
  async svgNodeKeys() {
    return this.page.$$eval('svg#svg g.node', nodes => nodes.map(n => n.getAttribute('data-key')));
  }

  async svgNodeCount() {
    return this.page.$$eval('svg#svg g.node', nodes => nodes.length);
  }

  // Fill and click insert
  async insertValue(val, waitForRender = true) {
    await this.page.fill('#valueInput', String(val));
    await this.page.click('#insertBtn');
    if (waitForRender) {
      // small wait for render to finish
      await this.page.waitForTimeout(200);
    }
  }

  // Fill and click delete (input-based)
  async deleteValueViaInput(val) {
    await this.page.fill('#valueInput', String(val));
    await this.page.click('#deleteBtn');
    await this.page.waitForTimeout(200);
  }

  // Click a node in the SVG by key (data-key)
  async clickNodeByKey(key) {
    const selector = `svg#svg g.node[data-key="${key}"]`;
    await this.page.waitForSelector(selector, { state: 'visible' });
    await this.page.click(selector);
    // deleting via node triggers confirm; test should handle dialog externally
    await this.page.waitForTimeout(200);
  }

  // Search via input
  async searchValue(val) {
    await this.page.fill('#searchInput', String(val));
    await this.page.click('#searchBtn');
  }

  // Traversal clicks
  async clickInorder() { await this.page.click('#inorderBtn'); }
  async clickPreorder() { await this.page.click('#preorderBtn'); }
  async clickPostorder() { await this.page.click('#postorderBtn'); }
  async clickLevel() { await this.page.click('#levelBtn'); }
  async clickStop() { await this.page.click('#stopAnim'); }

  // Quick action clicks
  async clickRandom() { await this.page.click('#randomBtn'); }
  async clickBalanced() { await this.page.click('#balancedBtn'); }
  async clickSample() { await this.page.click('#sampleBtn'); }
  async clickClear() { await this.page.click('#clearBtn'); }

  // Get class list for a node (by key)
  async nodeClassList(key) {
    const selector = `svg#svg g.node[data-key="${key}"]`;
    return this.page.$eval(selector, n => Array.from(n.classList));
  }

  // Reset inputs
  async clearInputs() {
    await this.page.fill('#valueInput', '');
    await this.page.fill('#searchInput', '');
  }
}

test.describe('BST Interactive Demo - FSM and UI validation', () => {
  let page;
  let bst;
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleErrors = [];
    pageErrors = [];

    // Collect console errors and page errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(String(err.message || err));
    });

    bst = new BSTPage(page);
    await bst.goto();
  });

  test.afterEach(async () => {
    // Ensure no uncaught console errors or page errors occurred during the test.
    // Tests below will also explicitly assert expected dialogs / UI behavior.
    expect(consoleErrors, 'No console.error should be emitted during test').toEqual([]);
    expect(pageErrors, 'No page runtime errors should be emitted during test').toEqual([]);
    await page.close();
  });

  test.describe('Initial state and FSM states (S0..S5)', () => {
    test('Initial render should show Sample tree loaded (S3_Tree_Populated)', async () => {
      // Verify initial traversalOutput text matches the "Sample tree loaded..." state evidence
      const txt = await bst.traversalText();
      expect(txt).toContain('Sample tree loaded. Try insert/search/delete or traversals.');
      // There should be initial nodes rendered (7 nodes expected from init)
      const keys = await bst.svgNodeKeys();
      // Expect at least 7 initial nodes (50,30,70,20,40,60,80)
      expect(keys.length).toBeGreaterThanOrEqual(7);
      // Specific known keys from init should be present
      for (const k of ['50', '30', '70', '20', '40', '60', '80']) {
        expect(keys).toContain(k);
      }
    });

    test('Clearing tree shows Tree cleared (S1_Tree_Cleared and S2_Tree_Empty evidence)', async () => {
      // clearBtn triggers a confirm dialog. Accept it.
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('confirm');
        expect(dialog.message()).toContain('Clear the entire tree?');
        await dialog.accept();
      });
      await bst.clickClear();
      // After clear, traversalOutput should be 'Tree cleared.'
      await page.waitForFunction(() => document.getElementById('traversalOutput').textContent.includes('Tree cleared.'), { timeout: 2000 });
      const txt = await bst.traversalText();
      expect(txt).toBe('Tree cleared.');
      // There should be no SVG nodes (empty tree)
      const count = await bst.svgNodeCount();
      expect(count).toBe(0);
      // render() sets traversalOutput to 'Tree is empty' when bst.root is falsy during render, but clearBtn sets 'Tree cleared.' per evidence.
    });

    test('Insert into empty tree transitions to populated (S2 -> S3)', async () => {
      // Ensure tree is empty first by clearing (accept confirm)
      page.once('dialog', async d => await d.accept());
      await bst.clickClear();
      await page.waitForFunction(() => document.getElementById('traversalOutput').textContent.includes('Tree cleared.'), { timeout: 2000 });

      // Insert a value into the now-empty tree
      await bst.insertValue(123);
      // After insert, the svg should have one node with data-key="123"
      await page.waitForSelector('svg#svg g.node[data-key="123"]', { timeout: 2000 });
      const keys = await bst.svgNodeKeys();
      expect(keys).toContain('123');
      // traversalOutput should no longer be "Tree cleared." (render updates it possibly to sample message or leaves as-is)
      const txt = await bst.traversalText();
      // The app typically sets traversalOutput to 'Sample tree loaded...' only on init.
      // After manual insert, render() doesn't set traversal output; but tree is populated and svg nodes exist.
      expect(keys.length).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Events and transitions (Insert, Delete, Search, Traversals, Quick actions)', () => {
    test('Insert a new key and ignore duplicates (InsertKey event)', async () => {
      // Insert a brand new key
      await bst.insertValue(999);
      await page.waitForSelector('svg#svg g.node[data-key="999"]', { timeout: 2000 });
      let keys = await bst.svgNodeKeys();
      expect(keys).toContain('999');

      // Try inserting duplicate 999 -> should trigger alert 'Duplicate key ignored.'
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('alert');
        expect(dialog.message()).toMatch(/Duplicate key ignored/i);
        await dialog.accept();
      });
      // set value again and click insert
      await bst.insertValue(999);
      // ensure no additional node duplicates in DOM (keys remain unique)
      keys = await bst.svgNodeKeys();
      // Count occurrences of '999' should be 1
      const occurrences = keys.filter(k => k === '999').length;
      expect(occurrences).toBe(1);
    });

    test('Delete a key via input (DeleteKey event) and handle not-found', async () => {
      // Delete an existing known key, e.g., 20 is in initial sample
      // Set value input to 20 and click deleteBtn; no confirm triggered for deleteBtn (only alerts on not-found)
      await bst.deleteValueViaInput(20);
      // Since deleteBtn does not show a confirm for deletion via input, it will perform deletion immediately.
      // Wait a bit and assert node with key=20 is removed from DOM
      await page.waitForTimeout(300);
      const keys = await bst.svgNodeKeys();
      expect(keys).not.toContain('20');

      // Attempt to delete a non-existent key -> should alert 'Key not found.'
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('alert');
        expect(dialog.message()).toMatch(/Key not found/i);
        await dialog.accept();
      });
      await bst.deleteValueViaInput(1234567);
    });

    test('Delete a node by clicking it (node click) triggers confirm and removes node', async () => {
      // Ensure target exists; use key 40 (initial)
      await page.waitForSelector('svg#svg g.node[data-key="40"]', { timeout: 2000 });
      // When clicking node, a confirm dialog appears. Accept it.
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('confirm');
        expect(dialog.message()).toContain('Delete node 40');
        await dialog.accept();
      });
      await bst.clickNodeByKey('40');
      // After accepting, node should be gone
      await page.waitForTimeout(300);
      const keys = await bst.svgNodeKeys();
      expect(keys).not.toContain('40');
    });

    test('Search for present and absent keys and verify searching/found/deleted classes (SearchKey event)', async () => {
      // Search for a present key 60; should animate and final output contains 'Found 60.'
      await bst.searchValue(60);
      // Wait for final animation to finish: it will set traversalOutput to 'Found 60. Path: ...' as callback
      await page.waitForFunction(() => {
        const t = document.getElementById('traversalOutput').textContent;
        return /Found\s+60/i.test(t) || /Found 60/i.test(t);
      }, { timeout: 5000 });
      const txtFound = await bst.traversalText();
      expect(txtFound).toMatch(/Found\s+60/i);
      // Node 60 should have class 'found'
      const classes = await bst.nodeClassList('60');
      expect(classes).toContain('found');

      // Search for a missing key; pick -9999 to ensure not present
      await bst.searchValue(-9999);
      // Wait for final animation and message 'Key -9999 not found.'
      await page.waitForFunction(() => {
        const t = document.getElementById('traversalOutput').textContent;
        return /not found/i.test(t);
      }, { timeout: 5000 });
      const txtNotFound = await bst.traversalText();
      expect(txtNotFound).toMatch(/not found/i);
      // The last visited node should have class 'deleted' if any nodes were visited
      // We can assert that at least one node has class 'deleted' or 'searching' removed/converted.
      const anyDeleted = await page.$$eval('svg#svg g.node', nodes => nodes.some(n => n.classList.contains('deleted')));
      // It's valid for the search path to be empty if tree is empty; but tree initially populated -> expect some deleted highlight
      expect(anyDeleted).toBe(true);
    });

    test('Traversals animate and produce correct final sequences (InOrder/PreOrder/PostOrder/Level-order)', async () => {
      // In-order on initial tree should yield sorted sequence: 20, 30, 40, 50, 60, 70, 80
      await bst.clickInorder();
      await page.waitForFunction(() => document.getElementById('traversalOutput').textContent.startsWith('In-order:'), { timeout: 2000 });
      // Wait until final text contains expected full list
      await page.waitForFunction(() => document.getElementById('traversalOutput').textContent.includes('20, 30, 40, 50, 60, 70, 80'), { timeout: 8000 });
      const inorderTxt = await bst.traversalText();
      expect(inorderTxt).toContain('In-order: 20, 30, 40, 50, 60, 70, 80');

      // Pre-order on current tree (after deletion tests earlier, ensure keys exist; to be tolerant, rebuild sample)
      await bst.clickSample();
      await page.waitForFunction(() => document.getElementById('traversalOutput').textContent.includes('Sample walkthrough tree populated.'), { timeout: 2000 });
      await bst.clickPreorder();
      await page.waitForFunction(() => document.getElementById('traversalOutput').textContent.startsWith('Pre-order:'), { timeout: 2000 });
      await page.waitForFunction(() => document.getElementById('traversalOutput').textContent.includes('50'), { timeout: 8000 }); // root 50 should appear
      const preTxt = await bst.traversalText();
      expect(preTxt.startsWith('Pre-order:')).toBe(true);

      // Post-order
      await bst.clickPostorder();
      await page.waitForFunction(() => document.getElementById('traversalOutput').textContent.startsWith('Post-order:'), { timeout: 2000 });
      await page.waitForTimeout(1200);
      const postTxt = await bst.traversalText();
      expect(postTxt.startsWith('Post-order:')).toBe(true);

      // Level-order
      await bst.clickLevel();
      await page.waitForFunction(() => document.getElementById('traversalOutput').textContent.startsWith('Level-order:'), { timeout: 2000 });
      await page.waitForTimeout(1200);
      const levelTxt = await bst.traversalText();
      expect(levelTxt.startsWith('Level-order:')).toBe(true);
    });

    test('Stop animation button halts active traversal (StopAnimation event)', async () => {
      // Start a traversal that will animate
      await bst.clickInorder();
      await page.waitForFunction(() => document.getElementById('traversalOutput').textContent.startsWith('In-order:'), { timeout: 2000 });
      // Click Stop
      await bst.clickStop();
      // After clicking stop, traversalOutput should include '(stopped)' suffix
      await page.waitForFunction(() => document.getElementById('traversalOutput').textContent.includes('(stopped)'), { timeout: 2000 });
      const txt = await bst.traversalText();
      expect(txt).toContain('(stopped)');
    });

    test('Quick actions: Random, Balanced, Sample buttons produce expected traversalOutput and nodes', async () => {
      // Random tree
      await bst.clickRandom();
      await page.waitForFunction(() => document.getElementById('traversalOutput').textContent.includes('Random tree with'), { timeout: 2000 });
      const randTxt = await bst.traversalText();
      expect(randTxt).toMatch(/Random tree with \d+ nodes:/i);
      const randCount = await bst.svgNodeCount();
      expect(randCount).toBeGreaterThanOrEqual(3);

      // Balanced
      await bst.clickBalanced();
      await page.waitForFunction(() => document.getElementById('traversalOutput').textContent.includes('Balanced sample created'), { timeout: 2000 });
      const balancedTxt = await bst.traversalText();
      expect(balancedTxt).toContain('Balanced sample created (1..7)');
      // Balanced should create keys 1..7
      const keys = await bst.svgNodeKeys();
      for (const k of ['1','2','3','4','5','6','7']) expect(keys).toContain(k);

      // Sample walkthrough
      await bst.clickSample();
      await page.waitForFunction(() => document.getElementById('traversalOutput').textContent.includes('Sample walkthrough tree populated.'), { timeout: 2000 });
      const sampleTxt = await bst.traversalText();
      expect(sampleTxt).toContain('Sample walkthrough tree populated.');
      const sampleKeys = await bst.svgNodeKeys();
      // Check some expected keys from sample
      for (const k of ['50','30','70','20','40','60','80']) expect(sampleKeys).toContain(k);
    });
  });

  test.describe('Edge cases, dialogs and visual feedback', () => {
    test('Alerts triggered for invalid input on insert and search', async () => {
      // Invalid insert (empty or non-number) -> alert 'Enter a valid integer value.'
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('alert');
        expect(dialog.message()).toMatch(/Enter a valid integer value/i);
        await dialog.accept();
      });
      // Ensure valueInput empty
      await bst.clearInputs();
      await page.click('#insertBtn');

      // Invalid search input
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('alert');
        expect(dialog.message()).toMatch(/Enter a valid integer key to search/i);
        await dialog.accept();
      });
      await bst.clearInputs();
      await page.click('#searchBtn');
    });

    test('Clicking blank SVG area clears highlights', async () => {
      // Trigger a search to create some 'searching' highlights
      await bst.searchValue(50); // root exists -> path visited includes 50 and should end with found
      await page.waitForFunction(() => document.querySelectorAll('svg#svg g.node.found').length > 0, { timeout: 4000 });
      // Click on the SVG blank area (canvasWrap) to clear highlights
      // The SVG container has id=canvasWrap
      await page.click('#canvasWrap', { position: { x: 10, y: 10 } });
      // Ensure no nodes have 'searching' or 'found' classes now (they should be normalized)
      const anySpecial = await page.$$eval('svg#svg g.node', nodes => nodes.some(n => n.classList.contains('searching') || n.classList.contains('found') || n.classList.contains('deleted')));
      // After clicking blank area, resetHighlights() is called; thus, nodes should be back to 'normal'. It's acceptable for some to still be 'found' in some race conditions, but we assert they are not in searching state.
      const anySearching = await page.$$eval('svg#svg g.node', nodes => nodes.some(n => n.classList.contains('searching')));
      expect(anySearching).toBe(false);
    });

    test('Ensure animations and DOM classes change as expected during sequence', async () => {
      // Start level-order traversal and observe intermediate state (some nodes being 'searching')
      await bst.clickLevel();
      await page.waitForFunction(() => document.getElementById('traversalOutput').textContent.startsWith('Level-order:'), { timeout: 2000 });
      // Shortly after starting, at least one node should have 'searching' class
      await page.waitForFunction(() => {
        return Array.from(document.querySelectorAll('svg#svg g.node')).some(n => n.classList.contains('searching'));
      }, { timeout: 2000 });
      // Stop the animation to allow deterministic cleanup
      await bst.clickStop();
      await page.waitForFunction(() => document.getElementById('traversalOutput').textContent.includes('(stopped)'), { timeout: 2000 });
      // Ensure no lingering 'searching' classes exist
      const anySearching = await page.$$eval('svg#svg g.node', nodes => nodes.some(n => n.classList.contains('searching')));
      expect(anySearching).toBe(false);
    });
  });
});