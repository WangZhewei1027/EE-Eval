import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f1807d21-d366-11f0-9b19-a558354ece3e.html';

// Page object to encapsulate interactions and common assertions
class TreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.nodeValue = page.locator('input#nodeValue');
    this.insertBtn = page.locator('button', { hasText: 'Insert' });
    this.deleteBtn = page.locator('button#deleteBtn');
    this.searchBtn = page.locator('button', { hasText: 'Search' });
    this.clearBtn = page.locator('button', { hasText: 'Clear Tree' });
    this.randomBtn = page.locator('button', { hasText: 'Generate Random Tree' });
    this.treeContainer = page.locator('#treeContainer');
    this.opCount = page.locator('#opCount');
    this.log = page.locator('#log');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setValue(value) {
    // focus and fill the numeric input
    await this.nodeValue.fill(String(value));
  }

  async clearInput() {
    await this.nodeValue.fill('');
  }

  async clickInsert() {
    await this.insertBtn.click();
  }

  async clickDelete() {
    await this.deleteBtn.click();
  }

  async clickSearch() {
    await this.searchBtn.click();
  }

  async clickClear() {
    await this.clearBtn.click();
  }

  async clickGenerateRandom() {
    await this.randomBtn.click();
  }

  async getOpCount() {
    const text = await this.opCount.textContent();
    return parseInt(text || '0', 10);
  }

  async getLogText() {
    return (await this.log.innerText()).trim();
  }

  async getTreeContainerText() {
    return (await this.treeContainer.innerText()).trim();
  }

  async getNodeElements() {
    return this.page.locator('.node');
  }

  async getNodeTexts() {
    const nodes = await this.getNodeElements();
    const count = await nodes.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await nodes.nth(i).textContent()).trim());
    }
    return texts;
  }

  async isDeleteDisabled() {
    return await this.deleteBtn.isDisabled();
  }

  // Returns inline style boxShadow for a node with given numeric text
  async getNodeBoxShadow(value) {
    const node = this.page.locator(`.node`, { hasText: String(value) });
    const count = await node.count();
    if (count === 0) return '';
    return await node.evaluate((el) => el.style.boxShadow || '');
  }
}

test.describe('Red-Black Tree Visualization - FSM validations', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for later assertions
    page.on('console', (msg) => {
      // store type and text for debugging and assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // helpful debugging output in case a test fails - Playwright will show it anyway
    if (pageErrors.length > 0) {
      console.log('Captured page errors:', pageErrors);
    }
    if (consoleMessages.length > 0) {
      // only show top 10 for brevity
      console.log('Captured console messages:', consoleMessages.slice(0, 10));
    }
  });

  test('S0 Idle: initial state renders empty tree and controls are initialized', async ({ page }) => {
    // Validate entry action: renderTree() -> tree should be empty on load
    const treePage = new TreePage(page);
    await treePage.goto();

    // No uncaught page errors on load
    expect(pageErrors.length).toBe(0);

    // The UI should indicate the tree is empty
    const containerText = await treePage.getTreeContainerText();
    expect(containerText.toLowerCase()).toContain('tree is empty');

    // Operation count should be 0 (entry state)
    expect(await treePage.getOpCount()).toBe(0);

    // Delete button should be disabled when tree is empty
    expect(await treePage.isDeleteDisabled()).toBe(true);

    // There should be no .node elements
    expect(await treePage.getNodeElements().count()).toBe(0);

    // Ensure initial render didn't emit console errors
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
  });

  test.describe('Insert operations -> S1_NodeInserted', () => {
    test('Insert a valid node updates tree, op count and enables delete', async ({ page }) => {
      // Test that inserting a node triggers insert logic and renderTree (entry actions)
      const treePage = new TreePage(page);
      await treePage.goto();

      // Insert a node value 10
      await treePage.setValue(10);
      await treePage.clickInsert();

      // After insert the log should contain the insertion message
      const logText = await treePage.getLogText();
      expect(logText).toContain('Inserting value: 10');

      // A node element with '10' should exist in the tree
      const nodeTexts = await treePage.getNodeTexts();
      expect(nodeTexts).toContain('10');

      // Operation count should have incremented (insert increments operationCount via log)
      const op = await treePage.getOpCount();
      expect(op).toBeGreaterThanOrEqual(1);

      // Delete button should now be enabled because tree is no longer empty
      expect(await treePage.isDeleteDisabled()).toBe(false);

      // No uncaught page errors during insertion flow
      expect(pageErrors.length).toBe(0);
    });

    test('Inserting with invalid input shows alert (edge case)', async ({ page }) => {
      // Validate error handling for missing/invalid input when inserting
      const treePage = new TreePage(page);
      await treePage.goto();

      // Ensure input is empty
      await treePage.clearInput();

      // Listen for dialog and capture the message
      let dialogMessage = null;
      page.once('dialog', async (dlg) => {
        dialogMessage = dlg.message();
        await dlg.accept();
      });

      // Click Insert without valid number -> should raise alert
      await treePage.clickInsert();

      // dialog should have been shown
      expect(dialogMessage).toBe('Please enter a valid number');

      // Ensure no page errors due to alert flow
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Search operations -> S2_NodeSearched', () => {
    test('Search for existing node highlights it and logs found message', async ({ page }) => {
      // Insert a known node then search for it to validate highlightNode entry action
      const treePage = new TreePage(page);
      await treePage.goto();

      // Insert 15
      await treePage.setValue(15);
      await treePage.clickInsert();

      // Now search for 15
      await treePage.setValue(15);

      // Capture the log text before search to later assert new messages appended
      const previousLog = await treePage.getLogText();

      await treePage.clickSearch();

      // The log should contain searching and found messages
      const logText = await treePage.getLogText();
      expect(logText).toContain('Searching for value: 15');
      expect(logText).toMatch(/✓ Value 15 found|Value 15 found/);

      // The highlightNode function sets inline style boxShadow briefly.
      // Immediately after search, the style should be present.
      const boxShadow = await treePage.getNodeBoxShadow(15);
      expect(boxShadow.length).toBeGreaterThan(0);

      // No page errors during search
      expect(pageErrors.length).toBe(0);
    });

    test('Search for non-existing node logs not found and does not highlight anything', async ({ page }) => {
      const treePage = new TreePage(page);
      await treePage.goto();

      // Ensure tree is empty or has some nodes; search for a value not present
      await treePage.setValue(9999);
      await treePage.clickSearch();

      const logText = await treePage.getLogText();
      expect(logText).toContain('Searching for value: 9999');
      expect(logText).toContain('✗ Value 9999 not found in the tree');

      // Ensure no node was highlighted for that value
      const boxShadow = await treePage.getNodeBoxShadow(9999);
      expect(boxShadow).toBe('');

      // No page errors during search
      expect(pageErrors.length).toBe(0);
    });

    test('Searching with invalid input shows alert (edge case)', async ({ page }) => {
      const treePage = new TreePage(page);
      await treePage.goto();

      // Ensure input empty
      await treePage.clearInput();

      let dialogMessage = null;
      page.once('dialog', async (dlg) => {
        dialogMessage = dlg.message();
        await dlg.accept();
      });

      await treePage.clickSearch();

      expect(dialogMessage).toBe('Please enter a valid number');
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Clear and Generate Random -> S3_TreeCleared and S4_RandomTreeGenerated', () => {
    test('Clear tree resets UI, opCount and logs tree cleared', async ({ page }) => {
      const treePage = new TreePage(page);
      await treePage.goto();

      // Insert a node to make sure clear has an effect
      await treePage.setValue(42);
      await treePage.clickInsert();

      // Confirm tree is not empty
      expect(await treePage.getNodeElements().count()).toBeGreaterThan(0);

      // Click Clear Tree
      await treePage.clickClear();

      // Tree container should indicate empty
      const containerText = await treePage.getTreeContainerText();
      expect(containerText.toLowerCase()).toContain('tree is empty');

      // Operation count should be reset to '0' then incremented by tree.log('Tree cleared') to 1
      // According to implementation: opCount displayed was set to '0' then tree.log('Tree cleared') increments to 1.
      const op = await treePage.getOpCount();
      expect(op).toBeGreaterThanOrEqual(1);

      // Log should contain 'Tree cleared'
      const logText = await treePage.getLogText();
      expect(logText).toContain('Tree cleared');

      // Delete button should be disabled after clear
      expect(await treePage.isDeleteDisabled()).toBe(true);

      // No page errors on clearing
      expect(pageErrors.length).toBe(0);
    });

    test('Generate Random Tree produces multiple nodes and increments opCount', async ({ page }) => {
      const treePage = new TreePage(page);
      await treePage.goto();

      // Click Generate Random Tree
      await treePage.clickGenerateRandom();

      // After generation, there should be several .node elements rendered
      // Wait briefly for DOM updates as multiple inserts happen
      await page.waitForTimeout(200); // small wait to let renderTree finish

      const nodeCount = await treePage.getNodeElements().count();
      expect(nodeCount).toBeGreaterThanOrEqual(5); // implementation generates between 5 and 14 values

      // Operation count should reflect at least the one 'Tree cleared' log plus the inserted nodes
      const op = await treePage.getOpCount();
      expect(op).toBeGreaterThanOrEqual(5);

      // Delete button should be enabled because the tree is not empty
      expect(await treePage.isDeleteDisabled()).toBe(false);

      // No page errors during random generation
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Delete button behavior and delete operation (stub) - edge cases', () => {
    test('Delete button is disabled when tree empty and enabled after insert', async ({ page }) => {
      const treePage = new TreePage(page);
      await treePage.goto();

      // Initially disabled
      expect(await treePage.isDeleteDisabled()).toBe(true);

      // Insert a node
      await treePage.setValue(7);
      await treePage.clickInsert();

      // Now enabled
      expect(await treePage.isDeleteDisabled()).toBe(false);
    });

    test('Clicking Delete with invalid input shows alert and logs not throwing runtime errors', async ({ page }) => {
      const treePage = new TreePage(page);
      await treePage.goto();

      // Insert a node to enable delete button
      await treePage.setValue(21);
      await treePage.clickInsert();

      // Ensure delete button enabled
      expect(await treePage.isDeleteDisabled()).toBe(false);

      // Clear input to trigger invalid input scenario for delete
      await treePage.clearInput();

      let dialogMessage = null;
      page.once('dialog', async (dlg) => {
        dialogMessage = dlg.message();
        await dlg.accept();
      });

      await treePage.clickDelete();

      // Should show alert for invalid number input
      expect(dialogMessage).toBe('Please enter a valid number');

      // Delete is a stub in this demo; it logs a message if a number provided - ensure no runtime errors occurred
      expect(pageErrors.length).toBe(0);
    });

    test('Clicking Delete with a valid number logs a delete stub message', async ({ page }) => {
      const treePage = new TreePage(page);
      await treePage.goto();

      // Insert a node to enable delete
      await treePage.setValue(33);
      await treePage.clickInsert();

      // Now set input to 33 and click delete
      await treePage.setValue(33);
      await treePage.clickDelete();

      const logText = await treePage.getLogText();
      expect(logText).toContain('Delete operation for value 33 (not implemented in this demo)');

      // No runtime page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test('Observe console messages and ensure no unexpected console.error', async ({ page }) => {
    // This test centralizes observation of console messages over a few operations
    const treePage = new TreePage(page);
    await treePage.goto();

    // Perform some operations that write to DOM log (not console) but may produce console messages if any runtime issues
    await treePage.setValue(5);
    await treePage.clickInsert();

    await treePage.setValue(5);
    await treePage.clickSearch();

    await treePage.clickClear();

    // Allow some time for logs and potential console messages
    await page.waitForTimeout(100);

    // Assert that there weren't console.error messages captured
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);

    // Also ensure no uncaught page errors
    expect(pageErrors.length).toBe(0);
  });
});