import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c136931-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page Object for the BST demo to keep tests organized
class BSTPage {
  constructor(page) {
    this.page = page;
    // controls
    this.valueInput = '#valueInput';
    this.insertBtn = '#insertBtn';
    this.deleteBtn = '#deleteBtn';
    this.searchBtn = '#searchBtn';
    this.dupMode = '#dupMode';
    this.stepInsertBtn = '#stepInsertBtn';
    this.stepDeleteBtn = '#stepDeleteBtn';
    this.stepSearchBtn = '#stepSearchBtn';
    this.playStepsBtn = '#playStepsBtn';
    this.pauseBtn = '#pauseBtn';
    this.stepForwardBtn = '#stepForwardBtn';
    this.stepBackBtn = '#stepBackBtn';
    this.clearStepsBtn = '#clearStepsBtn';
    this.undoBtn = '#undoBtn';
    this.redoBtn = '#redoBtn';
    this.bulkInput = '#bulkInput';
    this.bulkInsertBtn = '#bulkInsertBtn';
    this.randBtn = '#randBtn';
    this.clearBtn = '#clearBtn';
    this.mirrorBtn = '#mirrorBtn';
    this.balanceBtn = '#balanceBtn';
    this.avlRebalanceBtn = '#avlRebalanceBtn';
    this.selectedInfo = '#selectedInfo';
    this.deleteSelectedBtn = '#deleteSelectedBtn';
    this.rotateLeftBtn = '#rotateLeftBtn';
    this.rotateRightBtn = '#rotateRightBtn';
    this.showSubtreeBtn = '#showSubtreeBtn';
    this.kthBtn = '#kthBtn';
    this.kInput = '#kInput';
    this.inorderBtn = '#inorderBtn';
    this.preorderBtn = '#preorderBtn';
    this.postorderBtn = '#postorderBtn';
    this.levelorderBtn = '#levelorderBtn';
    this.clearLogBtn = '#clearLogBtn';
    this.exportBtn = '#exportBtn';
    this.importBtn = '#importBtn';
    this.clearStorageBtn = '#clearStorageBtn';
    this.infoArea = '#infoArea';
    this.svgArea = '#svgArea';
    this.stepLog = '#stepLog';
  }

  async setValue(v) {
    await this.page.fill(this.valueInput, String(v));
  }
  async click(selector) {
    await this.page.click(selector);
  }
  async insertValue(v) {
    await this.setValue(v);
    await this.click(this.insertBtn);
  }
  async deleteValue(v) {
    await this.setValue(v);
    await this.click(this.deleteBtn);
  }
  async searchValue(v) {
    await this.setValue(v);
    await this.click(this.searchBtn);
  }
  async bulkInsert(csv) {
    await this.page.fill(this.bulkInput, csv);
    await this.page.click(this.bulkInsertBtn);
  }
  async exportPromptAndCapture() {
    // click export and capture the default prompt value (the JSON)
    let captured = null;
    this.page.once('dialog', async dialog => {
      // it's a prompt with default text containing the JSON
      captured = dialog.defaultValue();
      await dialog.accept();
    });
    await this.page.click(this.exportBtn);
    // wait a tick to ensure dialog handler executed
    await this.page.waitForTimeout(50);
    return captured;
  }
  async importWithJson(jsonText) {
    this.page.once('dialog', async dialog => {
      await dialog.accept(jsonText);
    });
    await this.page.click(this.importBtn);
    // wait a tick to allow import processing
    await this.page.waitForTimeout(50);
  }

  async getInfoText() {
    return (await this.page.textContent(this.infoArea)) || '';
  }
  async getStepLogText() {
    return (await this.page.textContent(this.stepLog)) || '';
  }
  async getSelectedInfoText() {
    return (await this.page.textContent(this.selectedInfo)) || '';
  }
  async countSvgNodes() {
    // nodes are <g data-id="..."> appended per node in render
    return await this.page.$$eval('#svgArea g[data-id]', els => els.length);
  }
  async getInorderFromInfo() {
    const txt = await this.getInfoText();
    // parse line "In-order: 1, 2, 3"
    const m = txt.match(/In-order:\s*([^\n]*)/);
    return m ? m[1].trim() : '';
  }
}

test.describe('BST Interactive Demo - States and Transitions', () => {
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', e => {
      // collect uncaught exceptions
      pageErrors.push(String(e && e.message ? e.message : e));
    });

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    await page.goto(APP_URL);
    // ensure fully initialized
    await page.waitForSelector('#main');
  });

  test.afterEach(async ({ page }) => {
    // Assert there are no uncaught page errors
    expect(pageErrors, 'No uncaught page errors').toHaveLength(0);
    // Also ensure no console messages of type 'error' (unexpected runtime errors)
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors, 'No console.error messages').toHaveLength(0);
  });

  test('Initial Idle state shows "Tree is empty." and no nodes', async ({ page }) => {
    // Validate initial S0_Idle conditions
    const bst = new BSTPage(page);
    const info = await bst.getInfoText();
    // The HTML sets <pre id="infoArea">Tree is empty.</pre> initially and init() modifies it,
    // but ensure "Tree is empty." appears somewhere in the info or stepLog initial lines.
    expect(info).toContain('Tree is empty.', 'Initial info area should indicate empty tree');

    const selected = await bst.getSelectedInfoText();
    expect(selected).toBe('none', 'No selected node initially');

    const nodeCount = await bst.countSvgNodes();
    expect(nodeCount).toBe(0, 'SVG should contain no node groups on idle');
  });

  test('Insert transition from Idle to TreeModified and logs insertion', async ({ page }) => {
    // Insert a root and verify the tree becomes modified
    const bst = new BSTPage(page);
    await bst.insertValue(10);

    // infoArea should reflect size 1 and in-order contains 10
    const info = await bst.getInfoText();
    expect(info).toContain('Size: 1', 'After inserting root, size should be 1');
    expect(info).toContain('In-order: 10', 'In-order traversal should include inserted value');

    // stepLog should contain a message about insertion (either "Inserted root" or "Inserted ...")
    const log = await bst.getStepLogText();
    expect(log).toMatch(/Inserted root:?\s*10|Inserted\s+10/, 'Step log should record insertion');

    // SVG should render one node
    const nodeCount = await bst.countSvgNodes();
    expect(nodeCount).toBeGreaterThanOrEqual(1);
  });

  test('Duplicate insertion disallowed by default (dupMode=no)', async ({ page }) => {
    const bst = new BSTPage(page);
    // ensure tree has a value
    await bst.insertValue(20);
    // attempt to insert the same value again
    await bst.insertValue(20);

    const log = await bst.getStepLogText();
    // It should log "Duplicate not allowed: 20"
    expect(log).toContain('Duplicate not allowed', 'Duplicate insertion should be rejected when dupMode=no');
  });

  test('Search finds existing and reports non-existing', async ({ page }) => {
    const bst = new BSTPage(page);
    // create a small tree
    await bst.insertValue(50);
    await bst.insertValue(30);
    await bst.insertValue(70);

    // search for existing
    await bst.searchValue(30);
    let selectedInfo = await bst.getSelectedInfoText();
    expect(selectedInfo).toMatch(/30\s*\(id:/, 'Search should select the found node');
    let log = await bst.getStepLogText();
    expect(log).toContain('Search found: 30');

    // search for non-existing
    await bst.searchValue(9999);
    selectedInfo = await bst.getSelectedInfoText();
    expect(selectedInfo).toBe('none', 'Search for non-existing should not select a node');
    log = await bst.getStepLogText();
    expect(log).toContain('Search not found: 9999');
  });

  test('Delete existing node and handle deletion of non-existing', async ({ page }) => {
    const bst = new BSTPage(page);
    // setup
    await bst.insertValue(15);
    await bst.insertValue(10);
    await bst.insertValue(20);

    // delete an existing value
    await bst.deleteValue(10);
    let info = await bst.getInfoText();
    expect(info).not.toContain('10', 'Deleted value should not appear in in-order traversal');
    let log = await bst.getStepLogText();
    expect(log).toContain('Deleted node: 10');

    // delete a value not present
    await bst.deleteValue(999);
    log = await bst.getStepLogText();
    expect(log).toContain('Delete: value not found: 999');
  });

  test('Stepping: prepare frames for insert/search/delete and control playback', async ({ page }) => {
    const bst = new BSTPage(page);
    // start with empty tree: step insert should prepare frames and allow play
    await bst.setValue(5);
    await bst.click(bst.stepInsertBtn);
    let log = await bst.getStepLogText();
    expect(log).toContain('Prepared step insertion frames for 5');

    // Play steps - since tree is empty, insertion as root will occur
    await bst.click(bst.playStepsBtn);
    // give some time to play at least one frame
    await page.waitForTimeout(100);
    log = await bst.getStepLogText();
    expect(log).toContain('Playing steps...');

    // Pause playback and ensure pause log appears
    await bst.click(bst.pauseBtn);
    await page.waitForTimeout(50);
    log = await bst.getStepLogText();
    expect(log).toContain('Paused steps.');

    // Prepare step search (on existing value)
    await bst.setValue(5);
    await bst.click(bst.stepSearchBtn);
    log = await bst.getStepLogText();
    expect(log).toContain('Prepared step search frames for 5');

    // Step forward and step back should be available
    await bst.click(bst.stepForwardBtn);
    await page.waitForTimeout(50);
    log = await bst.getStepLogText();
    expect(log).toMatch(/Select|Found|Go left|Go right/);

    // Step back attempt (will be a no-op if history not suitable), ensure it does not throw and stepLog remains accessible
    await bst.click(bst.stepBackBtn);
    await page.waitForTimeout(50);
    // validate stepLog is still present
    const stepLogText = await bst.getStepLogText();
    expect(typeof stepLogText).toBe('string');
  });

  test('Undo and Redo operations change state and create logs', async ({ page }) => {
    const bst = new BSTPage(page);
    // start fresh for clarity
    await bst.click(bst.clearBtn);

    // Insert two values
    await bst.insertValue(100);
    await bst.insertValue(200);

    // Undo last insert (200)
    await bst.click(bst.undoBtn);
    await page.waitForTimeout(50);
    let info = await bst.getInfoText();
    expect(info).not.toContain('200', 'Undo should remove last inserted value');
    let log = await bst.getStepLogText();
    expect(log).toContain('Undo: restored previous state');

    // Redo should reapply it
    await bst.click(bst.redoBtn);
    await page.waitForTimeout(50);
    info = await bst.getInfoText();
    expect(info).toContain('200', 'Redo should restore the undone value');
    log = await bst.getStepLogText();
    expect(log).toContain('Redo: restored next state');
  });

  test('Bulk insert, random generation, mirror, balance, AVL rebalance, and clear', async ({ page }) => {
    const bst = new BSTPage(page);
    // Clear first
    await bst.click(bst.clearBtn);

    // Bulk insert
    await bst.bulkInsert('3,1,4,2');
    let info = await bst.getInfoText();
    expect(info).toContain('In-order: 1, 2, 3, 4', 'Bulk insert should add items in BST');

    let log = await bst.getStepLogText();
    expect(log).toContain('Bulk inserted 4 items');

    // Generate random (non-deterministic): just ensure it doesn't throw and logs message
    await bst.click(bst.randBtn);
    await page.waitForTimeout(50);
    log = await bst.getStepLogText();
    expect(log).toMatch(/Generated and inserted random \d+ values\./);

    // Mirror (invert)
    await bst.click(bst.mirrorBtn);
    await page.waitForTimeout(50);
    log = await bst.getStepLogText();
    expect(log).toContain('Mirrored (inverted) tree');

    // Rebuild balanced
    await bst.click(bst.balanceBtn);
    await page.waitForTimeout(50);
    log = await bst.getStepLogText();
    expect(log).toContain('Rebuilt balanced tree');

    // AVL rebalance (attempt)
    await bst.click(bst.avlRebalanceBtn);
    await page.waitForTimeout(50);
    log = await bst.getStepLogText();
    expect(log).toContain('Attempted AVL rebalancing');

    // Clear the tree back to Idle
    await bst.click(bst.clearBtn);
    await page.waitForTimeout(50);
    info = await bst.getInfoText();
    expect(info).toContain('Tree is empty.');
  });

  test('Selection, rotate left/right, delete selected, show subtree, kth smallest, and traversals', async ({ page }) => {
    const bst = new BSTPage(page);
    // Build a known tree
    await bst.click(bst.clearBtn);
    await bst.insertValue(20);
    await bst.insertValue(10);
    await bst.insertValue(30);
    await bst.insertValue(5);
    await bst.insertValue(15);

    // Select node by searching for it (this will set selected and update selectedInfo)
    await bst.searchValue(10);
    let sel = await bst.getSelectedInfoText();
    expect(sel).toMatch(/10\s*\(id:/);

    // Rotate left/right when possible (rotateLeft on selected 10 won't do because 10 may not have right child, so it will log a message)
    await bst.click(bst.rotateLeftBtn);
    await page.waitForTimeout(50);
    let log = await bst.getStepLogText();
    expect(log).toMatch(/Rotate left not possible|Rotated left at node/);

    // Rotate right - similarly accept either possible or not possible
    await bst.click(bst.rotateRightBtn);
    await page.waitForTimeout(50);
    log = await bst.getStepLogText();
    expect(log).toMatch(/Rotate right not possible|Rotated right at node/);

    // Select another node via clicking the SVG node group directly (simulate user clicking)
    // Find a g with data-id attribute and click first occurrence to select something
    const gHandles = await page.$$('#svgArea g[data-id]');
    if (gHandles.length > 0) {
      await gHandles[0].click();
      await page.waitForTimeout(50);
      sel = await bst.getSelectedInfoText();
      // selection should change (either a value or remain 'none')
      expect(typeof sel).toBe('string');
    }

    // Delete selected
    await bst.click(bst.deleteSelectedBtn);
    await page.waitForTimeout(50);
    log = await bst.getStepLogText();
    expect(log).toMatch(/Deleted selected node|No selected node to delete/);

    // Show subtree (if none selected, it will warn)
    await bst.click(bst.showSubtreeBtn);
    await page.waitForTimeout(50);
    log = await bst.getStepLogText();
    expect(log).toMatch(/Subtree values:|No selected node to show subtree/);

    // Find kth smallest with kInput
    await page.fill(bst.kInput, '1');
    await bst.click(bst.kthBtn);
    await page.waitForTimeout(50);
    log = await bst.getStepLogText();
    // either reports kth smallest or out of range/tree empty
    expect(log).toMatch(/-th smallest =|Tree empty|k out of range/);

    // Traversals - ensure pressing traversal buttons logs something
    await bst.click(bst.inorderBtn);
    await bst.click(bst.preorderBtn);
    await bst.click(bst.postorderBtn);
    await bst.click(bst.levelorderBtn);
    await page.waitForTimeout(50);
    log = await bst.getStepLogText();
    expect(log).toMatch(/In-order:|Pre-order:|Post-order:|Level-order:/);
  });

  test('Clear log, export and import JSON, and clear storage', async ({ page }) => {
    const bst = new BSTPage(page);
    // Setup a small tree
    await bst.click(bst.clearBtn);
    await bst.insertValue(8);
    await bst.insertValue(3);
    await bst.insertValue(12);

    // Clear the step log: clicking clearLogBtn triggers a pushLog("Cleared log") and then clears, there are two handlers -
    // ensure no exception and stepLog remains accessible
    await bst.click(bst.clearLogBtn);
    await page.waitForTimeout(50);
    let log = await bst.getStepLogText();
    expect(typeof log).toBe('string');

    // Export: capture JSON from prompt default value
    const exported = await bst.exportPromptAndCapture();
    expect(typeof exported).toBe('string');
    expect(exported.length).toBeGreaterThan(0);

    // Clear tree and import back
    await bst.click(bst.clearBtn);
    await page.waitForTimeout(50);
    await bst.importWithJson(exported);
    await page.waitForTimeout(50);
    // After import, log should indicate import success
    log = await bst.getStepLogText();
    expect(log).toContain('Imported tree from JSON');

    // Clear saved (in-memory) storage
    await bst.click(bst.clearStorageBtn);
    await page.waitForTimeout(50);
    log = await bst.getStepLogText();
    expect(log).toContain('Cleared saved history');
  });

  test('Edge cases: invalid input for operations should produce "Invalid value" logs', async ({ page }) => {
    const bst = new BSTPage(page);
    // Empty value for insert
    await page.fill(bst.valueInput, '');
    await bst.click(bst.insertBtn);
    await page.waitForTimeout(50);
    let log = await bst.getStepLogText();
    expect(log).toContain('Invalid value for insert');

    // Empty for delete
    await page.fill(bst.valueInput, '');
    await bst.click(bst.deleteBtn);
    await page.waitForTimeout(50);
    log = await bst.getStepLogText();
    expect(log).toContain('Invalid value for delete');

    // Empty for search
    await page.fill(bst.valueInput, '');
    await bst.click(bst.searchBtn);
    await page.waitForTimeout(50);
    log = await bst.getStepLogText();
    expect(log).toContain('Invalid value for search');

    // Step insert with invalid value
    await page.fill(bst.valueInput, '');
    await bst.click(bst.stepInsertBtn);
    await page.waitForTimeout(50);
    log = await bst.getStepLogText();
    expect(log).toContain('Invalid value for step insert');
  });

});