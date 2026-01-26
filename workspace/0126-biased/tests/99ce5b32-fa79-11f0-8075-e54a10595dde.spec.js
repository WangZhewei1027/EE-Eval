import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99ce5b32-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the Red-Black Tree page
class RedBlackTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleErrors = [];
    this.pageErrors = [];

    // Collect console error messages
    this.consoleListener = (msg) => {
      if (msg.type() === 'error') {
        this.consoleErrors.push(msg.text());
      }
    };
    this.pageListener = (err) => {
      this.pageErrors.push(err.message);
    };

    page.on('console', this.consoleListener);
    page.on('pageerror', this.pageListener);
  }

  // Navigate to the page and wait for DOMContentLoaded
  async goto() {
    await this.page.goto(APP_URL);
    await this.page.waitForLoadState('domcontentloaded');
  }

  // Clean up listeners (to avoid leaks between tests)
  async dispose() {
    this.page.removeListener('console', this.consoleListener);
    this.page.removeListener('pageerror', this.pageListener);
  }

  // Helpers to interact with UI
  async fillValue(value) {
    const input = this.page.locator('#value');
    await input.fill(String(value));
  }

  async clearValue() {
    const input = this.page.locator('#value');
    await input.fill('');
  }

  async clickInsert() {
    await this.page.locator('button[onclick="insertValue()"]').click();
  }

  async clickDelete() {
    await this.page.locator('button[onclick="deleteValue()"]').click();
  }

  async clickSearch() {
    await this.page.locator('button[onclick="searchValue()"]').click();
  }

  async clickReset() {
    await this.page.locator('button[onclick="resetTree()"]').click();
  }

  async clickPrint() {
    await this.page.locator('button[onclick="printTree()"]').click();
  }

  async clickInOrder() {
    await this.page.locator('button[onclick="inOrderTraversal()"]').click();
  }

  async clickPreOrder() {
    await this.page.locator('button[onclick="preOrderTraversal()"]').click();
  }

  async clickPostOrder() {
    await this.page.locator('button[onclick="postOrderTraversal()"]').click();
  }

  async getTreeDisplayText() {
    return await this.page.locator('#treeDisplay').innerText();
  }

  getConsoleErrors() {
    return this.consoleErrors.slice();
  }

  getPageErrors() {
    return this.pageErrors.slice();
  }
}

test.describe('Interactive Red-Black Tree - End-to-End', () => {
  // Each test will create its own page and page object
  test.afterEach(async ({ page }) => {
    // ensure dialogs are closed if left open to avoid interfering with subsequent tests
    try {
      // No-op: just in case a dialog is pending; Playwright will throw if no dialog
      const dialog = await page.waitForEvent('dialog', { timeout: 100 });
      await dialog.dismiss();
    } catch (e) {
      // ignore timeout - means no dialog present
    }
  });

  test('Page loads and UI components are present with no console/page errors', async ({ page }) => {
    // Validate presence of expected UI elements and that initial load has no runtime errors
    const treePage = new RedBlackTreePage(page);
    await treePage.goto();

    // Check input and all buttons exist
    await expect(page.locator('#value')).toBeVisible();
    await expect(page.locator('button[onclick="insertValue()"]')).toHaveCount(1);
    await expect(page.locator('button[onclick="deleteValue()"]')).toHaveCount(1);
    await expect(page.locator('button[onclick="searchValue()"]')).toHaveCount(1);
    await expect(page.locator('button[onclick="resetTree()"]')).toHaveCount(1);
    await expect(page.locator('button[onclick="printTree()"]')).toHaveCount(1);
    await expect(page.locator('button[onclick="inOrderTraversal()"]')).toHaveCount(1);
    await expect(page.locator('button[onclick="preOrderTraversal()"]')).toHaveCount(1);
    await expect(page.locator('button[onclick="postOrderTraversal()"]')).toHaveCount(1);
    await expect(page.locator('#treeDisplay')).toBeVisible();

    // Verify no console or page errors occurred during load
    const consoleErrors = treePage.getConsoleErrors();
    const pageErrors = treePage.getPageErrors();
    await treePage.dispose();

    expect(consoleErrors.length, 'No console error messages on load').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors on load').toBe(0);
  });

  test('Insert values updates visualization correctly', async ({ page }) => {
    // This test inserts multiple values and asserts the visualization text reflects the inserted nodes
    const treePage = new RedBlackTreePage(page);
    await treePage.goto();

    // Insert root
    await treePage.fillValue(10);
    await treePage.clickInsert();

    // After insertion the display should contain root node "10 (R)"
    let display = await treePage.getTreeDisplayText();
    expect(display).toContain('10 (R)');

    // Insert left and right children
    await treePage.fillValue(5);
    await treePage.clickInsert();
    await treePage.fillValue(15);
    await treePage.clickInsert();

    display = await treePage.getTreeDisplayText();
    // Visualize should include root and its two children with indentation
    expect(display).toContain('10 (R)');
    expect(display).toContain('  5 (R)');
    expect(display).toContain('  15 (R)');

    // Confirm no runtime errors happened during these operations
    expect(treePage.getConsoleErrors().length).toBe(0);
    expect(treePage.getPageErrors().length).toBe(0);

    await treePage.dispose();
  });

  test('Search shows alert for found and not found values', async ({ page }) => {
    // This test validates searchValue() generates dialogs "Value found" / "Value not found"
    const treePage = new RedBlackTreePage(page);
    await treePage.goto();

    // Insert a known value to search for
    await treePage.fillValue(20);
    await treePage.clickInsert();

    // Search for existing value -> expect "Value found"
    const [foundDialog] = await Promise.all([
      page.waitForEvent('dialog'),
      (async () => {
        await treePage.fillValue(20);
        await treePage.clickSearch();
      })(),
    ]);
    expect(foundDialog.message()).toBe('Value found');
    await foundDialog.accept();

    // Search for non-existing value -> expect "Value not found"
    const [notFoundDialog] = await Promise.all([
      page.waitForEvent('dialog'),
      (async () => {
        await treePage.fillValue(999);
        await treePage.clickSearch();
      })(),
    ]);
    expect(notFoundDialog.message()).toBe('Value not found');
    await notFoundDialog.accept();

    // Verify no console/page errors
    expect(treePage.getConsoleErrors().length).toBe(0);
    expect(treePage.getPageErrors().length).toBe(0);

    await treePage.dispose();
  });

  test('Reset clears the tree visualization', async ({ page }) => {
    // Validate resetTree() empties the tree display
    const treePage = new RedBlackTreePage(page);
    await treePage.goto();

    // Insert a value then reset
    await treePage.fillValue(7);
    await treePage.clickInsert();

    let display = await treePage.getTreeDisplayText();
    expect(display).toContain('7 (R)');

    await treePage.clickReset();

    display = await treePage.getTreeDisplayText();
    // After reset, display should be empty string
    expect(display).toBe('');

    // Verify no console/page errors
    expect(treePage.getConsoleErrors().length).toBe(0);
    expect(treePage.getPageErrors().length).toBe(0);

    await treePage.dispose();
  });

  test('Print Tree shows visualization in an alert', async ({ page }) => {
    // Validate printTree() shows the same visualization as the #treeDisplay content inside an alert
    const treePage = new RedBlackTreePage(page);
    await treePage.goto();

    // Build small tree
    await treePage.fillValue(30);
    await treePage.clickInsert();
    await treePage.fillValue(25);
    await treePage.clickInsert();

    const display = await treePage.getTreeDisplayText();

    const [printDialog] = await Promise.all([
      page.waitForEvent('dialog'),
      (async () => {
        await treePage.clickPrint();
      })(),
    ]);
    const alertText = printDialog.message();
    // The alert should contain the same visualization text
    expect(alertText).toContain('30 (R)');
    expect(alertText).toContain('  25 (R)');
    // Also check equality or inclusion depending on formatting - inclusion is safer
    expect(alertText).toContain(display.trim().split('\n')[0]);
    await printDialog.accept();

    // Verify no console/page errors
    expect(treePage.getConsoleErrors().length).toBe(0);
    expect(treePage.getPageErrors().length).toBe(0);

    await treePage.dispose();
  });

  test('Traversals (in-order, pre-order, post-order) show expected sequences', async ({ page }) => {
    // This test builds a known tree and verifies traversal dialogs contain correct sequences
    const treePage = new RedBlackTreePage(page);
    await treePage.goto();

    // Build tree: root 10, left 5, right 15 -> deterministic traversal orders
    await treePage.fillValue(10);
    await treePage.clickInsert();
    await treePage.fillValue(5);
    await treePage.clickInsert();
    await treePage.fillValue(15);
    await treePage.clickInsert();

    // In-order: 5, 10, 15
    const [inDialog] = await Promise.all([
      page.waitForEvent('dialog'),
      (async () => {
        await treePage.clickInOrder();
      })(),
    ]);
    expect(inDialog.message()).toBe('5, 10, 15');
    await inDialog.accept();

    // Pre-order: 10, 5, 15
    const [preDialog] = await Promise.all([
      page.waitForEvent('dialog'),
      (async () => {
        await treePage.clickPreOrder();
      })(),
    ]);
    expect(preDialog.message()).toBe('10, 5, 15');
    await preDialog.accept();

    // Post-order: 5, 15, 10
    const [postDialog] = await Promise.all([
      page.waitForEvent('dialog'),
      (async () => {
        await treePage.clickPostOrder();
      })(),
    ]);
    expect(postDialog.message()).toBe('5, 15, 10');
    await postDialog.accept();

    // Verify no console/page errors
    expect(treePage.getConsoleErrors().length).toBe(0);
    expect(treePage.getPageErrors().length).toBe(0);

    await treePage.dispose();
  });

  test('Delete operation does not throw and display behavior is consistent (edge case: delete not implemented)', async ({ page }) => {
    // Because delete() in the implementation is a stub that only calls updateDisplay(),
    // we validate that calling delete does not crash and that the display remains consistent.
    const treePage = new RedBlackTreePage(page);
    await treePage.goto();

    // Insert two values
    await treePage.fillValue(40);
    await treePage.clickInsert();
    await treePage.fillValue(35);
    await treePage.clickInsert();

    const before = await treePage.getTreeDisplayText();

    // Attempt delete of an existing value
    await treePage.fillValue(40);
    await treePage.clickDelete();

    const afterDelete = await treePage.getTreeDisplayText();

    // Since deletion logic is not implemented, the display should remain unchanged.
    expect(afterDelete).toBe(before);

    // Also try deleting a non-existing value to ensure no crash
    await treePage.fillValue(9999);
    await treePage.clickDelete();

    const afterDeleteNonExisting = await treePage.getTreeDisplayText();
    expect(afterDeleteNonExisting).toBe(before);

    // Verify no console/page errors surfaced during delete attempts
    expect(treePage.getConsoleErrors().length).toBe(0);
    expect(treePage.getPageErrors().length).toBe(0);

    await treePage.dispose();
  });

  test('Edge cases: empty input does not trigger actions or alerts', async ({ page }) => {
    // Validate that when the input is empty, operations that require a value do nothing (no alert, no crash)
    const treePage = new RedBlackTreePage(page);
    await treePage.goto();

    await treePage.clearValue();

    // Try Insert with empty input - expect no dialog and no crash
    await treePage.clickInsert();
    // wait briefly to ensure no dialog appears
    let dialogOccurred = false;
    try {
      const dlg = await page.waitForEvent('dialog', { timeout: 200 });
      dialogOccurred = true;
      await dlg.dismiss();
    } catch (e) {
      // Timeout - expected, means no dialog
      dialogOccurred = false;
    }
    expect(dialogOccurred).toBe(false);

    // Try Search with empty input - expect no dialog
    await treePage.clickSearch();
    try {
      const dlg = await page.waitForEvent('dialog', { timeout: 200 });
      dialogOccurred = true;
      await dlg.dismiss();
    } catch (e) {
      dialogOccurred = false;
    }
    expect(dialogOccurred).toBe(false);

    // Try Delete with empty input - expect no dialog and no crash
    await treePage.clickDelete();
    try {
      const dlg = await page.waitForEvent('dialog', { timeout: 200 });
      dialogOccurred = true;
      await dlg.dismiss();
    } catch (e) {
      dialogOccurred = false;
    }
    expect(dialogOccurred).toBe(false);

    // Final check: no console/page errors occurred during these edge attempts
    expect(treePage.getConsoleErrors().length).toBe(0);
    expect(treePage.getPageErrors().length).toBe(0);

    await treePage.dispose();
  });
});