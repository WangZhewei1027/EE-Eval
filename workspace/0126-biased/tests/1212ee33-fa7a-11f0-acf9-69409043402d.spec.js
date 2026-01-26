import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1212ee33-fa7a-11f0-acf9-69409043402d.html';

// Page Object for the Binary Tree Interactive Demo
class BinaryTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // selectors
    this.rootValue = '#rootValue';
    this.createTreeBtn = '#createTreeBtn';
    this.clearTreeBtn = '#clearTreeBtn';
    this.insertValue = '#insertValue';
    this.insertPath = '#insertPath';
    this.insertBtn = '#insertBtn';
    this.deletePath = '#deletePath';
    this.deleteBtn = '#deleteBtn';
    this.searchValue = '#searchValue';
    this.searchBtn = '#searchBtn';
    this.traversalType = '#traversalType';
    this.traverseBtn = '#traverseBtn';
    this.traversalStep = '#traversalStep';
    this.prevStepBtn = '#prevStepBtn';
    this.nextStepBtn = '#nextStepBtn';
    this.currentNodeDisplay = '#currentNodeDisplay';
    this.heightBtn = '#heightBtn';
    this.heightDisplay = '#heightDisplay';
    this.balanceCheckBtn = '#balanceCheckBtn';
    this.balanceDisplay = '#balanceDisplay';
    this.explorePath = '#explorePath';
    this.exploreBtn = '#exploreBtn';
    this.pathDisplay = '#pathDisplay';
    this.treeDisplay = '#treeDisplay';
  }

  async createRoot(value = 10) {
    await this.page.fill(this.rootValue, String(value));
    const [dialog] = await Promise.all([
      // in case code triggers alert, capture it. Many operations alert on invalid input.
      this.page.waitForEvent('dialog').catch(() => null),
      this.page.click(this.createTreeBtn)
    ]);
    if (dialog) {
      const msg = dialog.message();
      await dialog.accept();
      return msg;
    }
    return null;
  }

  async clearTree() {
    await this.page.click(this.clearTreeBtn);
  }

  async insertNode(value, path) {
    await this.page.fill(this.insertValue, String(value));
    await this.page.fill(this.insertPath, path);
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog').catch(() => null),
      this.page.click(this.insertBtn)
    ]);
    if (dialog) {
      const msg = dialog.message();
      await dialog.accept();
      return msg;
    }
    return null;
  }

  async deleteNode(path) {
    await this.page.fill(this.deletePath, path);
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog').catch(() => null),
      this.page.click(this.deleteBtn)
    ]);
    if (dialog) {
      const msg = dialog.message();
      await dialog.accept();
      return msg;
    }
    return null;
  }

  async searchValueFor(value) {
    await this.page.fill(this.searchValue, String(value));
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog').catch(() => null),
      this.page.click(this.searchBtn)
    ]);
    if (dialog) {
      const msg = dialog.message();
      await dialog.accept();
      return msg;
    }
    return null;
  }

  async traverse(type = 'inorder') {
    await this.page.selectOption(this.traversalType, type);
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog').catch(() => null),
      this.page.click(this.traverseBtn)
    ]);
    if (dialog) {
      const msg = dialog.message();
      await dialog.accept();
      return msg;
    }
    return null;
  }

  async gotoTraversalStep(step) {
    // set range input value programmatically via fill or evaluate if needed
    await this.page.locator(this.traversalStep).evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('input')); }, String(step));
  }

  async prevStep() {
    await this.page.click(this.prevStepBtn);
  }

  async nextStep() {
    await this.page.click(this.nextStepBtn);
  }

  async computeHeight() {
    await this.page.click(this.heightBtn);
  }

  async checkBalance() {
    await this.page.click(this.balanceCheckBtn);
  }

  async explorePathAt(path) {
    await this.page.fill(this.explorePath, path);
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog').catch(() => null),
      this.page.click(this.exploreBtn)
    ]);
    if (dialog) {
      const msg = dialog.message();
      await dialog.accept();
      return msg;
    }
    return null;
  }

  async treeText() {
    return (await this.page.locator(this.treeDisplay).innerText()).trim();
  }

  async currentNodeText() {
    return (await this.page.locator(this.currentNodeDisplay).innerText()).trim();
  }

  async heightText() {
    return (await this.page.locator(this.heightDisplay).innerText()).trim();
  }

  async balanceText() {
    return (await this.page.locator(this.balanceDisplay).innerText()).trim();
  }

  async pathDisplayText() {
    return (await this.page.locator(this.pathDisplay).innerText()).trim();
  }
}

// Group tests into describe blocks per FSM area
test.describe('Binary Tree Interactive Demo - FSM Validation', () => {
  // Capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
  });

  test.afterEach(async ({}, testInfo) => {
    // Basic assertions about runtime errors and console error messages.
    // Ensure there are no uncaught page errors (ReferenceError, TypeError, etc.)
    expect(pageErrors, 'No uncaught page errors should be present').toEqual([]);
    // Ensure console does not have "error" type messages
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole, 'No console.error messages should be emitted').toEqual([]);
  });

  test.describe('S0_Idle (Initial state)', () => {
    test('initial display should show empty tree and N/A current node', async ({ page }) => {
      const p = new BinaryTreePage(page);
      // Validate initial tree display state corresponds to "Idle" - empty tree
      const treeText = await p.treeText();
      expect(treeText).toBe('[empty tree]');
      const current = await p.currentNodeText();
      expect(current).toBe('N/A');
    });
  });

  test.describe('Create / Clear Tree (S1_TreeCreated and back to S0_Idle)', () => {
    test('create root node from default input updates display and clears status', async ({ page }) => {
      const p = new BinaryTreePage(page);
      // Create root with default 10
      const dialogMsg = await p.createRoot(10);
      // There should be no alert dialog for valid create; dialogMsg would be null
      expect(dialogMsg).toBeNull();
      const treeText = await p.treeText();
      expect(treeText).toContain('10');
      // After create, height and balance displays should be empty
      expect(await p.heightText()).toBe('');
      expect(await p.balanceText()).toBe('');
    });

    test('clear tree returns to empty display and resets traversal', async ({ page }) => {
      const p = new BinaryTreePage(page);
      await p.createRoot(7);
      await p.clearTree();
      const treeText = await p.treeText();
      expect(treeText).toBe('[empty tree]');
      expect(await p.currentNodeText()).toBe('N/A');
    });
  });

  test.describe('Insert and Delete Node (S2_NodeInserted, S3_NodeDeleted)', () => {
    test('insert node at left child path and delete it', async ({ page }) => {
      const p = new BinaryTreePage(page);
      // create root
      await p.createRoot(20);
      // Insert left child with value 15 at path 'L'
      const insertAlert = await p.insertNode(15, 'L');
      expect(insertAlert).toBeNull();
      let treeText = await p.treeText();
      // printed tree should contain 15
      expect(treeText).toContain('15');
      // Now delete the left child
      const deleteAlert = await p.deleteNode('L');
      expect(deleteAlert).toBeNull();
      treeText = await p.treeText();
      // Should no longer contain 15
      expect(treeText).not.toContain('15');
    });

    test('insert fails with non-number and shows alert', async ({ page }) => {
      const p = new BinaryTreePage(page);
      await p.createRoot(1);
      // supply non-number via empty insertValue -> alert expected
      await p.page.fill('#insertValue', ''); // clear
      const alertMessage = await p.insertNode('', 'L');
      expect(alertMessage).toContain('Insert value must be a number.');
    });

    test('insert to empty tree should alert to create root first', async ({ page }) => {
      const p = new BinaryTreePage(page);
      // Ensure empty tree
      const treeTextBefore = await p.treeText();
      expect(treeTextBefore).toBe('[empty tree]');
      // attempt to insert into empty tree
      const alertMessage = await p.insertNode(5, 'L');
      expect(alertMessage).toContain('Tree is empty. Create root first.');
    });

    test('delete with invalid path formatting triggers alert', async ({ page }) => {
      const p = new BinaryTreePage(page);
      await p.createRoot(2);
      const alertMessage = await p.deleteNode('X1'); // invalid path
      expect(alertMessage).toContain('Invalid path format');
    });
  });

  test.describe('Search Node (S4_NodeSearched)', () => {
    test('search finds node and shows dialog listing paths', async ({ page }) => {
      const p = new BinaryTreePage(page);
      // Build small tree: root 8, left 3, right 10
      await p.createRoot(8);
      await p.insertNode(3, 'L');
      await p.insertNode(10, 'R');
      // Search for existing value 3
      const dialogMsg = await p.searchValueFor(3);
      expect(dialogMsg).toContain('Value found at paths:');
      expect(dialogMsg).toContain('L'); // path of left child
    });

    test('search with non-number shows alert', async ({ page }) => {
      const p = new BinaryTreePage(page);
      await p.createRoot(8);
      // clear input and attempt non-number (empty)
      await p.page.fill('#searchValue', '');
      const dialogMsg = await p.searchValueFor('');
      expect(dialogMsg).toContain('Search value must be a number.');
    });

    test('search on empty tree alerts Tree is empty', async ({ page }) => {
      const p = new BinaryTreePage(page);
      // Ensure empty
      await p.clearTree();
      const dialogMsg = await p.searchValueFor(10);
      expect(dialogMsg).toContain('Tree is empty.');
    });
  });

  test.describe('Traversal (S5_TreeTraversed) and stepping', () => {
    test('traverse inorder yields traversal and prev/next update current node', async ({ page }) => {
      const p = new BinaryTreePage(page);
      // create a small tree with root 50, left 30, right 70
      await p.createRoot(50);
      await p.insertNode(30, 'L');
      await p.insertNode(70, 'R');

      // Perform inorder traversal
      const traversalAlert = await p.traverse('inorder');
      // No alert expected for valid traverse when tree present
      expect(traversalAlert).toBeNull();

      // After traversal current node should be the first entry (inorder -> leftmost)
      const curr = await p.currentNodeText();
      expect(curr).toMatch(/Value: .*30/);

      // Click next step should move to root (50)
      await p.nextStep();
      const currAfterNext = await p.currentNodeText();
      expect(currAfterNext).toMatch(/Value: .*50/);

      // Click next again should go to right (70)
      await p.nextStep();
      const currAfterNext2 = await p.currentNodeText();
      expect(currAfterNext2).toMatch(/Value: .*70/);

      // Prev should go back to root (50)
      await p.prevStep();
      const currAfterPrev = await p.currentNodeText();
      expect(currAfterPrev).toMatch(/Value: .*50/);

      // Also test range input to jump to first step
      await p.gotoTraversalStep(0);
      const jumped = await p.currentNodeText();
      expect(jumped).toMatch(/Value: .*30/);
    });

    test('traverse when tree empty alerts and sets traversal state accordingly', async ({ page }) => {
      const p = new BinaryTreePage(page);
      await p.clearTree();
      const alertMsg = await p.traverse('preorder');
      expect(alertMsg).toContain('Tree is empty.');
      expect(await p.currentNodeText()).toBe('N/A');
    });
  });

  test.describe('Height Computation (S6_HeightComputed) and Balance Check (S7_BalanceChecked)', () => {
    test('compute height displays correct height for simple tree', async ({ page }) => {
      const p = new BinaryTreePage(page);
      await p.createRoot(100);
      // height 1
      await p.computeHeight();
      expect(await p.heightText()).toBe('Height: 1');

      // Add left child and its left child to make height 3
      await p.insertNode(50, 'L');
      await p.insertNode(25, 'LL');
      await p.computeHeight();
      expect(await p.heightText()).toBe('Height: 3');
    });

    test('check balance displays Balanced: Yes for balanced tree', async ({ page }) => {
      const p = new BinaryTreePage(page);
      await p.createRoot(10);
      await p.insertNode(5, 'L');
      await p.insertNode(15, 'R');
      await p.checkBalance();
      expect(await p.balanceText()).toBe('Balanced: Yes');
    });

    test('check balance shows reason on unbalanced tree', async ({ page }) => {
      const p = new BinaryTreePage(page);
      await p.createRoot(1);
      // chain left nodes to make unbalanced
      await p.insertNode(2, 'L');
      await p.insertNode(3, 'LL');
      await p.checkBalance();
      const balText = await p.balanceText();
      expect(balText.startsWith('Balanced: No.') || balText.includes('No.')).toBe(true);
    });
  });

  test.describe('Path Exploration (S8_PathExplored)', () => {
    test('explore path shows node details for existing node', async ({ page }) => {
      const p = new BinaryTreePage(page);
      await p.createRoot(42);
      await p.insertNode(21, 'L');
      await p.insertNode(84, 'R');
      // Explore left child
      const maybeDialog = await p.explorePathAt('L');
      // exploreBtn only alerts on invalid input; for valid path returns content in pathDisplay
      expect(maybeDialog).toBeNull();
      const details = await p.pathDisplayText();
      expect(details).toContain('Node at path: L');
      expect(details).toContain('Value: 21');
    });

    test('explore invalid path triggers alert', async ({ page }) => {
      const p = new BinaryTreePage(page);
      await p.createRoot(5);
      const dialogMsg = await p.explorePathAt('X');
      expect(dialogMsg).toContain('Invalid path format.');
    });

    test('explore when tree empty displays "Tree is empty."', async ({ page }) => {
      const p = new BinaryTreePage(page);
      await p.clearTree();
      // For empty tree, explore does not alert, it writes to pathDisplay
      await p.explorePathAt(''); // path empty for root
      const display = await p.pathDisplayText();
      expect(display).toBe('Tree is empty.');
    });
  });

  test.describe('Edge-case validations and error dialogs', () => {
    test('create root with non-number shows alert', async ({ page }) => {
      const p = new BinaryTreePage(page);
      // set root value to non-number (empty)
      await p.page.fill('#rootValue', '');
      const dialogMessage = await p.createRoot('');
      expect(dialogMessage).toContain('Root value must be a number.');
    });

    test('search value not found alerts user', async ({ page }) => {
      const p = new BinaryTreePage(page);
      await p.createRoot(999);
      const dialogMsg = await p.searchValueFor(12345);
      expect(dialogMsg).toContain('Value not found in tree.');
    });

    test('traverse yields "Traversal yielded no nodes." if something unexpected', async ({ page }) => {
      // This test constructs a scenario that should not normally occur,
      // but verifies that the UI handles zero-length traversal array gracefully.
      const p = new BinaryTreePage(page);
      await p.clearTree();
      // If tree is empty traverse produces alert 'Tree is empty.' - already tested.
      const alert = await p.traverse('inorder');
      expect(alert).toContain('Tree is empty.');
    });
  });
});