import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2d3a00-fa7a-11f0-ba5b-57721b046e74.html';

/**
 * Page object for interacting with the B-Tree UI.
 * Methods simply perform DOM interactions (clicks, inputs) without attempting to repair or patch the page.
 */
class BTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    // Attach listeners should be done in the test so errors are captured during navigation.
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async degreeValue() {
    return await this.page.$eval('#degree-input', el => el.value);
  }

  async setDegree(value) {
    await this.page.fill('#degree-input', String(value));
  }

  async clickInitialize() {
    await this.page.click('#init-btn');
  }

  async fillKey(key) {
    await this.page.fill('#key-input', String(key));
  }

  async clickInsert() {
    await this.page.click('#insert-btn');
  }

  async clickDelete() {
    await this.page.click('#delete-btn');
  }

  async clickSearch() {
    await this.page.click('#search-btn');
  }

  async fillBulk(keysStr) {
    await this.page.fill('#bulk-input', keysStr);
  }

  async clickBulkInsert() {
    await this.page.click('#bulk-insert-btn');
  }

  async clickBulkDelete() {
    await this.page.click('#bulk-delete-btn');
  }

  async clickRandom() {
    await this.page.click('#random-btn');
  }

  async clickExpand() {
    await this.page.click('#expand-btn');
  }

  async clickCollapse() {
    await this.page.click('#collapse-btn');
  }

  async togglePointers() {
    await this.page.click('#show-pointers');
  }

  async pressEnterOnKeyInput() {
    await this.page.focus('#key-input');
    await this.page.keyboard.press('Enter');
  }

  async treeContainerText() {
    return await this.page.$eval('#tree-container', el => el.innerText);
  }

  async operationLogText() {
    return await this.page.$eval('#operation-log', el => el.innerText);
  }

  async isPointersChecked() {
    return await this.page.$eval('#show-pointers', el => el.checked);
  }
}

test.describe('Interactive B-Tree - FSM states and transitions (observing runtime errors)', () => {
  // Capture console messages and page errors for each test run
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console events (info, error, warn, log)
    page.on('console', msg => {
      // store serializable info
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', error => {
      pageErrors.push({
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    });
  });

  test('Page loads: initial UI present and runtime errors are emitted (expected ReferenceError)', async ({ page }) => {
    // Arrange
    const btree = new BTreePage(page);

    // Act
    await btree.goto();

    // Assert: initial instruction text is present (Idle state evidence)
    const treeText = await btree.treeContainerText();
    expect(treeText).toContain('Initialize a B-Tree by setting the minimum degree');

    // Assert: operation log initial text present
    const logText = await btree.operationLogText();
    expect(logText).toContain('Operation log will appear here');

    // Assert: a runtime page error should have been captured (the implementation has a ReferenceError in the constructor)
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const hasReferenceError = pageErrors.some(e => e.name === 'ReferenceError' || (e.message && e.message.includes('treeContainer')));
    expect(hasReferenceError).toBeTruthy();

    // Also ensure console captured at least one error message
    const hasConsoleError = consoleMessages.some(c => c.type === 'error' || /ReferenceError/.test(c.text));
    expect(hasConsoleError).toBeTruthy();
  });

  test.describe('FSM Events - interactions should be attempted but runtime error prevents normal behavior', () => {
    test('InitializeTree transition: clicking Initialize should not mutate tree due to runtime error', async ({ page }) => {
      const btree = new BTreePage(page);

      // Listen for errors that may occur during navigation and interaction
      await btree.goto();

      // Precondition: default degree is 2
      expect(await btree.degreeValue()).toBe('2');

      // Try to initialize with t = 3
      await btree.setDegree(3);
      await btree.clickInitialize();

      // Wait briefly to allow any event handlers (if present) to run
      await page.waitForTimeout(150);

      // Because the script threw a ReferenceError during initialization, the UI should remain in its Idle textual state
      const treeTextAfter = await btree.treeContainerText();
      expect(treeTextAfter).toContain('Initialize a B-Tree by setting the minimum degree');

      // The operation log should not have the expected 'Initialized B-Tree' message since visualizer didn't initialize
      const log = await btree.operationLogText();
      expect(log).not.toContain('Initialized B-Tree with minimum degree');

      // Confirm we observed the ReferenceError
      expect(pageErrors.some(e => e.name === 'ReferenceError')).toBeTruthy();
    });

    test('InsertKey transition: attempting to insert should not add keys to the DOM', async ({ page }) => {
      const btree = new BTreePage(page);
      await btree.goto();

      // Fill a key and click Insert
      await btree.fillKey(42);
      await btree.clickInsert();

      await page.waitForTimeout(150);

      // The tree container should remain unchanged (no node elements added)
      const treeHtml = await page.$eval('#tree-container', el => el.innerHTML);
      expect(treeHtml).toContain('Initialize a B-Tree by setting the minimum degree');

      // operation-log should not show 'Inserting key'
      const log = await btree.operationLogText();
      expect(log).not.toContain('Inserting key');

      // Ensure runtime error still present
      expect(pageErrors.some(e => e.name === 'ReferenceError')).toBeTruthy();
    });

    test('DeleteKey and SearchKey transitions: attempting delete/search should not crash further (assert no expected log changes)', async ({ page }) => {
      const btree = new BTreePage(page);
      await btree.goto();

      // Fill a key and click Delete
      await btree.fillKey(42);
      await btree.clickDelete();
      await page.waitForTimeout(100);

      // Search for a key
      await btree.fillKey(42);
      await btree.clickSearch();
      await page.waitForTimeout(100);

      // No 'Deleting key' or 'Searching for key' messages should be present
      const log = await btree.operationLogText();
      expect(log).not.toContain('Deleting key');
      expect(log).not.toContain('Searching for key');

      // Runtime ReferenceError should be present
      expect(pageErrors.some(e => e.name === 'ReferenceError')).toBeTruthy();
    });

    test('BulkInsert and BulkDelete transitions: attempting bulk operations should not alter tree DOM', async ({ page }) => {
      const btree = new BTreePage(page);
      await btree.goto();

      // Fill bulk input and click Bulk Insert
      await btree.fillBulk('5,10,15,20');
      await btree.clickBulkInsert();
      await page.waitForTimeout(100);

      // Then Bulk Delete
      await btree.fillBulk('10,20');
      await btree.clickBulkDelete();
      await page.waitForTimeout(100);

      // tree container remains showing initial instruction
      const treeText = await btree.treeContainerText();
      expect(treeText).toContain('Initialize a B-Tree by setting the minimum degree');

      // operation log should not contain 'Bulk inserting' or 'Bulk deleting'
      const log = await btree.operationLogText();
      expect(log).not.toContain('Bulk inserting keys');
      expect(log).not.toContain('Bulk deleting keys');

      // ReferenceError recorded
      expect(pageErrors.some(e => e.name === 'ReferenceError')).toBeTruthy();
    });

    test('GenerateRandom transition: clicking Random Tree should not populate tree due to runtime error', async ({ page }) => {
      const btree = new BTreePage(page);
      await btree.goto();

      await btree.clickRandom();
      await page.waitForTimeout(150);

      const treeText = await btree.treeContainerText();
      expect(treeText).toContain('Initialize a B-Tree by setting the minimum degree');

      // operation-log should not contain 'Generating random tree'
      const log = await btree.operationLogText();
      expect(log).not.toContain('Generating random tree with keys');

      expect(pageErrors.some(e => e.name === 'ReferenceError')).toBeTruthy();
    });

    test('ExpandAll and CollapseAll transitions: clicking expand/collapse should not reveal nodes', async ({ page }) => {
      const btree = new BTreePage(page);
      await btree.goto();

      await btree.clickExpand();
      await page.waitForTimeout(100);

      await btree.clickCollapse();
      await page.waitForTimeout(100);

      // tree should still show the initial paragraph, not expanded nodes
      const treeHtml = await page.$eval('#tree-container', el => el.innerHTML);
      expect(treeHtml).toContain('Initialize a B-Tree by setting the minimum degree');

      // operation log should not have 'Expanded all nodes' nor 'Collapsed all nodes'
      const log = await btree.operationLogText();
      expect(log).not.toContain('Expanded all nodes');
      expect(log).not.toContain('Collapsed all nodes');

      // Confirm runtime ReferenceError present
      expect(pageErrors.some(e => e.name === 'ReferenceError')).toBeTruthy();
    });

    test('TogglePointers event: toggling the checkbox changes its checked state but does not change pointer rendering', async ({ page }) => {
      const btree = new BTreePage(page);
      await btree.goto();

      const beforeChecked = await btree.isPointersChecked();
      expect(beforeChecked).toBeFalsy();

      // Toggle the checkbox (this will change the input checked property even if event handler didn't attach)
      await btree.togglePointers();
      await page.waitForTimeout(50);

      const afterChecked = await btree.isPointersChecked();
      expect(afterChecked).toBeTruthy();

      // However, because the visualizer failed to initialize, no child-pointer text should appear in tree container
      const treeText = await btree.treeContainerText();
      expect(treeText).not.toContain('Child');

      // Runtime error should still be captured
      expect(pageErrors.some(e => e.name === 'ReferenceError')).toBeTruthy();
    });

    test('Pressing Enter in key input should not trigger insertion because keypress listener was not registered (due to earlier runtime error)', async ({ page }) => {
      const btree = new BTreePage(page);
      await btree.goto();

      // Type into key input and press Enter
      await btree.fillKey(99);
      await btree.pressEnterOnKeyInput();
      await page.waitForTimeout(150);

      // The tree container should remain unchanged
      const treeHtml = await page.$eval('#tree-container', el => el.innerHTML);
      expect(treeHtml).toContain('Initialize a B-Tree by setting the minimum degree');

      // operation-log should not contain 'Inserting key: 99'
      const log = await btree.operationLogText();
      expect(log).not.toContain('Inserting key: 99');

      // Confirm ReferenceError still observed
      expect(pageErrors.some(e => e.name === 'ReferenceError')).toBeTruthy();
    });

    test('Edge case: invalid degree (<2) should not be handled because visualizer failed to initialize', async ({ page }) => {
      const btree = new BTreePage(page);
      await btree.goto();

      // Set invalid degree to 1 and click Initialize
      await btree.setDegree(1);
      await btree.clickInitialize();
      await page.waitForTimeout(150);

      // Normally you'd expect a log "Minimum degree must be at least 2", but since visualizer wasn't created, no such log
      const log = await btree.operationLogText();
      expect(log).not.toContain('Minimum degree must be at least 2');

      // And tree content should remain the same
      const treeText = await btree.treeContainerText();
      expect(treeText).toContain('Initialize a B-Tree by setting the minimum degree');

      // Confirm runtime ReferenceError captured at load
      expect(pageErrors.some(e => e.name === 'ReferenceError')).toBeTruthy();
    });
  });

  test.describe('Error inspection and diagnostics', () => {
    test('Console and pageerror entries include ReferenceError with relevant message and stack', async ({ page }) => {
      const btree = new BTreePage(page);

      await btree.goto();

      // We expect at least one page error entry
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      const refErrors = pageErrors.filter(e => e.name === 'ReferenceError' || (e.message && e.message.includes('treeContainer')));
      expect(refErrors.length).toBeGreaterThanOrEqual(1);

      // Check that console captured an error-level message as well
      const errorMsgs = consoleMessages.filter(m => m.type === 'error' || /ReferenceError/.test(m.text));
      expect(errorMsgs.length).toBeGreaterThanOrEqual(1);

      // Ensure that stack traces (if present) refer to the HTML file path or script context
      const hasStack = refErrors.some(e => e.stack && e.stack.length > 0);
      expect(hasStack).toBeTruthy();
    });
  });
});