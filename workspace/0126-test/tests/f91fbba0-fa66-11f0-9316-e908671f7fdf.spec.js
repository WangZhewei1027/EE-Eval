import { test, expect } from '@playwright/test';

test.describe('Binary Search Tree Interactive Application', () => {
  // Setup and teardown
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:5500/workspace/0126-test/html/f91fbba0-fa66-11f0-9316-e908671f7fdf.html');
  });

  test('Initial state: Idle', async ({ page }) => {
    // Verify initial state elements are present
    const treeDiv = await page.$('#tree');
    expect(treeDiv).not.toBeNull();
    const searchInput = await page.$('#search-input');
    expect(searchInput).not.toBeNull();
    const searchButton = await page.$('#search-btn');
    expect(searchButton).not.toBeNull();
  });

  test.describe('State transitions and interactions', () => {
    test('Transition from Idle to Searching via input change', async ({ page }) => {
      const searchInput = await page.$('#search-input');
      await searchInput.type('5');
      const consoleMessages = [];
      page.on('console', msg => consoleMessages.push(msg.text()));
      await page.waitForTimeout(1000); // Wait for potential async operations

      // Verify console logs for search and inorder traversal
      expect(consoleMessages).toContain('bst.search(value);');
      expect(consoleMessages).toContain('bst.inorder();');
    });

    test('Transition from Idle to Searching via button click', async ({ page }) => {
      const searchInput = await page.$('#search-input');
      await searchInput.type('5');
      const searchButton = await page.$('#search-btn');
      await searchButton.click();
      const consoleMessages = [];
      page.on('console', msg => consoleMessages.push(msg.text()));
      await page.waitForTimeout(1000); // Wait for potential async operations

      // Verify console logs for search
      expect(consoleMessages).toContain('bst.search(value);');
    });

    test('Transition from Searching to Display Result via button click', async ({ page }) => {
      const searchInput = await page.$('#search-input');
      await searchInput.type('5');
      const searchButton = await page.$('#search-btn');
      await searchButton.click();
      await page.waitForTimeout(1000); // Wait for potential async operations

      // Verify DOM changes for search result display
      const treeContent = await page.$eval('#tree', el => el.innerHTML);
      expect(treeContent).toContain('<span class="node">5</span>');
    });

    test('Transition from Searching to Inorder Traversal via input change', async ({ page }) => {
      const searchInput = await page.$('#search-input');
      await searchInput.type('5');
      await page.waitForTimeout(1000); // Wait for potential async operations

      // Verify DOM changes for inorder traversal display
      const treeContent = await page.$eval('#tree', el => el.innerHTML);
      expect(treeContent).toContain('<span class="node">');
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Search for a non-existent value', async ({ page }) => {
      const searchInput = await page.$('#search-input');
      await searchInput.type('999');
      const searchButton = await page.$('#search-btn');
      await searchButton.click();
      await page.waitForTimeout(1000); // Wait for potential async operations

      // Verify DOM changes for non-existent value
      const treeContent = await page.$eval('#tree', el => el.innerHTML);
      expect(treeContent).toBe('<span class="node">null</span>');
    });

    test('Empty input search', async ({ page }) => {
      const searchButton = await page.$('#search-btn');
      await searchButton.click();
      await page.waitForTimeout(1000); // Wait for potential async operations

      // Verify DOM changes for empty input
      const treeContent = await page.$eval('#tree', el => el.innerHTML);
      expect(treeContent).toBe('<span class="node">null</span>');
    });
  });
});