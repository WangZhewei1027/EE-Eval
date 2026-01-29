import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b08af2-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object encapsulating interactions and queries for the B+ Tree demo
class BPlusPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      inputKey: '#inputKey',
      insertBtn: '#insertBtn',
      searchBtn: '#searchBtn',
      resetBtn: '#resetBtn',
      message: '#message',
      tree: '#tree',
      orderDisplay: '#orderDisplay',
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async insertKey(value) {
    // Fill value (string or number)
    await this.page.fill(this.selectors.inputKey, String(value));
    await this.page.click(this.selectors.insertBtn);
    // Wait a tick for UI update
    await this.page.waitForTimeout(10);
  }

  async searchKey(value) {
    await this.page.fill(this.selectors.inputKey, String(value));
    await this.page.click(this.selectors.searchBtn);
    await this.page.waitForTimeout(10);
  }

  async resetTree() {
    await this.page.click(this.selectors.resetBtn);
    await this.page.waitForTimeout(10);
  }

  async getMessage() {
    return (await this.page.locator(this.selectors.message).textContent()) || '';
  }

  async getTreeText() {
    return (await this.page.locator(this.selectors.tree).textContent()) || '';
  }

  async getOrderDisplay() {
    return (await this.page.locator(this.selectors.orderDisplay).textContent()) || '';
  }

  async getInputValue() {
    return (await this.page.locator(this.selectors.inputKey).inputValue());
  }
}

test.describe('B+ Tree Visualization and Demo (FSM states and transitions)', () => {
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // capture console messages and page errors for each test
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // collect page errors (uncaught exceptions)
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test.describe('Initial state and UI sanity checks', () => {
    test('S0_Empty: page loads and shows Empty B+ Tree ready message & visualization', async ({ page }) => {
      const app = new BPlusPage(page);
      await app.goto();

      // Verify order display is set to 3
      expect(await app.getOrderDisplay()).toBe('3');

      // Verify initial message is the FSM evidence for S0_Empty
      const msg = await app.getMessage();
      expect(msg).toBe('Empty B+ Tree ready.');

      // Verify tree visualization contains leaf linked list and empty leaf
      const treeText = await app.getTreeText();
      expect(treeText).toContain('Leaf node linked list:');
      // The empty leaf should be represented as []
      expect(treeText).toContain('[]');

      // Ensure no uncaught page errors occurred and no console 'error' types
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Insert operations and S1_KeyInserted state', () => {
    test('Insert a valid integer key transitions to S1_KeyInserted and updates view', async ({ page }) => {
      const app1 = new BPlusPage(page);
      await app.goto();

      // Insert key 5
      await app.insertKey(5);

      // Check message evidence for S1_KeyInserted
      expect(await app.getMessage()).toBe('Inserted key 5.');

      // Tree visualization should now include the inserted key
      const treeText1 = await app.getTreeText();
      expect(treeText).toContain('[5]');

      // Input should be cleared and focused (input value empty string)
      expect(await app.getInputValue()).toBe('');

      // No runtime errors
      const consoleErrors1 = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Inserting a duplicate key keeps state S1_KeyInserted and shows duplicate message', async ({ page }) => {
      const app2 = new BPlusPage(page);
      await app.goto();

      // Insert key 7
      await app.insertKey(7);
      expect(await app.getMessage()).toBe('Inserted key 7.');

      // Insert duplicate key 7
      await app.insertKey(7);
      expect(await app.getMessage()).toBe('Key 7 already exists, duplicate insert ignored.');

      // Tree should still show a single instance of 7 in leaves
      const treeText2 = await app.getTreeText();
      // The leaf containing 7 should display 7 at least once; ensure no multiple entries like 7|7
      expect(treeText).toContain('[7]');
      expect(treeText).not.toContain('7|7');

      // No runtime errors
      const consoleErrors2 = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Insert sequence causing split: insert 1,2,3 and verify internal structure (visualization shows internal nodes)', async ({ page }) => {
      const app3 = new BPlusPage(page);
      await app.goto();

      // Insert 1,2,3 (with order=3, inserting third will cause a split)
      await app.insertKey(1);
      expect(await app.getMessage()).toBe('Inserted key 1.');
      await app.insertKey(2);
      expect(await app.getMessage()).toBe('Inserted key 2.');
      await app.insertKey(3);
      expect(await app.getMessage()).toBe('Inserted key 3.');

      const treeText3 = await app.getTreeText();
      // After splitting we expect to see both an Internal level and Leaves in visualization
      expect(treeText).toContain('Level 0 (Internal nodes') || expect(treeText).toContain('Level 0 (Leaves');
      // Always expect to have leaf linked list line
      expect(treeText).toContain('Leaf node linked list:');
      // Ensure the leaf linked list includes the keys 1,2,3 somewhere
      expect(treeText).toMatch(/1|2|3/);

      // No runtime errors
      const consoleErrors3 = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Search operations (S2_KeyFound and S3_KeyNotFound)', () => {
    test('Searching for an existing key yields S2_KeyFound message', async ({ page }) => {
      const app4 = new BPlusPage(page);
      await app.goto();

      // Insert then search
      await app.insertKey(10);
      expect(await app.getMessage()).toBe('Inserted key 10.');

      await app.searchKey(10);
      expect(await app.getMessage()).toBe('Key 10 found in leaf node.');

      // Tree visualization should still include the key
      const treeText4 = await app.getTreeText();
      expect(treeText).toContain('[10]');

      // No runtime errors
      const consoleErrors4 = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Searching for a non-existing key yields S3_KeyNotFound message', async ({ page }) => {
      const app5 = new BPlusPage(page);
      await app.goto();

      // Ensure empty tree search returns not found
      await app.searchKey(9999);
      expect(await app.getMessage()).toBe('Key 9999 NOT found in the tree.');

      // After not-found search, visualization still valid
      const treeText5 = await app.getTreeText();
      expect(treeText).toContain('Leaf node linked list:');

      // No runtime errors
      const consoleErrors5 = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Search with invalid input (non-integer text) shows validation message and does not throw', async ({ page }) => {
      const app6 = new BPlusPage(page);
      await app.goto();

      // Force a non-number string into the input (bypassing UI niceties)
      await page.fill('#inputKey', 'abc');
      await page.click('#searchBtn');

      // The app should validate and show the proper message
      expect(await app.getMessage()).toBe('Please enter a valid integer key to search.');

      // No uncaught runtime error must have happened
      const consoleErrors6 = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Reset operation (S4_TreeReset) from various states', () => {
    test('Reset from initial empty state sets message to Tree has been reset.', async ({ page }) => {
      const app7 = new BPlusPage(page);
      await app.goto();

      // Reset when already empty
      await app.resetTree();
      expect(await app.getMessage()).toBe('Tree has been reset.');

      // Visualization returns to empty leaf
      const treeText6 = await app.getTreeText();
      expect(treeText).toContain('[]');

      // No runtime errors
      const consoleErrors7 = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Reset after insertion resets tree (from S1_KeyInserted to S4_TreeReset)', async ({ page }) => {
      const app8 = new BPlusPage(page);
      await app.goto();

      await app.insertKey(42);
      expect(await app.getMessage()).toBe('Inserted key 42.');

      await app.resetTree();
      // According to FSM evidence: message.textContent = 'Tree has been reset.'
      expect(await app.getMessage()).toBe('Tree has been reset.');
      // visualization should be empty
      const treeText7 = await app.getTreeText();
      expect(treeText).toContain('[]');

      const consoleErrors8 = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Reset after found search resets tree (from S2_KeyFound to S4_TreeReset)', async ({ page }) => {
      const app9 = new BPlusPage(page);
      await app.goto();

      await app.insertKey(88);
      expect(await app.getMessage()).toBe('Inserted key 88.');
      await app.searchKey(88);
      expect(await app.getMessage()).toBe('Key 88 found in leaf node.');

      await app.resetTree();
      expect(await app.getMessage()).toBe('Tree has been reset.');
      expect((await app.getTreeText())).toContain('[]');

      const consoleErrors9 = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Reset after not-found search resets tree (from S3_KeyNotFound to S4_TreeReset)', async ({ page }) => {
      const app10 = new BPlusPage(page);
      await app.goto();

      // Ensure not found state
      await app.searchKey(12345);
      expect(await app.getMessage()).toBe('Key 12345 NOT found in the tree.');

      await app.resetTree();
      expect(await app.getMessage()).toBe('Tree has been reset.');
      expect((await app.getTreeText())).toContain('[]');

      const consoleErrors10 = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and input validation', () => {
    test('Insert with empty input shows validation message and does not throw', async ({ page }) => {
      const app11 = new BPlusPage(page);
      await app.goto();

      // Ensure input empty then click Insert
      await page.fill('#inputKey', '');
      await page.click('#insertBtn');

      expect(await app.getMessage()).toBe('Please enter a valid integer key.');

      // No uncaught runtime errors
      const consoleErrors11 = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Insert with non-integer string (via fill) is handled gracefully', async ({ page }) => {
      const app12 = new BPlusPage(page);
      await app.goto();

      // Force a non-number string into the input
      await page.fill('#inputKey', 'notanumber');
      await page.click('#insertBtn');

      // Should show validation message rather than throwing
      expect(await app.getMessage()).toBe('Please enter a valid integer key.');

      const consoleErrors12 = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Search after reset behaves as from initial empty tree', async ({ page }) => {
      const app13 = new BPlusPage(page);
      await app.goto();

      // Insert and reset
      await app.insertKey(77);
      expect(await app.getMessage()).toBe('Inserted key 77.');
      await app.resetTree();
      expect(await app.getMessage()).toBe('Tree has been reset.');

      // Search for previously existing key should be NOT found now
      await app.searchKey(77);
      expect(await app.getMessage()).toBe('Key 77 NOT found in the tree.');

      const consoleErrors13 = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });
});