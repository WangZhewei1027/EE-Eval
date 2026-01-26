import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-test-2/html/ff5c2c70-fa6f-11f0-91c5-e388c17587b2.html';

test.describe('Binary Search Tree (BST) Application Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application page before each test
    await page.goto(BASE_URL);
  });

  test('should render the page correctly', async ({ page }) => {
    // Validate that the page has loaded and rendered correctly
    const title = await page.title();
    expect(title).toBe('Binary Search Tree (BST)');
    const content = await page.locator('body').textContent();
    expect(content).toContain('A Binary Search Tree (BST) is a type of binary tree');
  });

  test('should log errors in the console', async ({ page }) => {
    // Observe console logs for any errors
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push(msg.text());
    });

    // Trigger any potential errors (if applicable)
    await page.evaluate(() => {
      // This is a placeholder for any action that might cause an error
      // Since there are no interactive elements, we expect no errors.
    });

    // Check if any errors were logged
    expect(consoleMessages).toEqual(expect.arrayContaining([
      expect.stringContaining('ReferenceError'),
      expect.stringContaining('SyntaxError'),
      expect.stringContaining('TypeError'),
    ]));
  });

  test('should validate the properties of a BST', async ({ page }) => {
    // Check for the presence of key characteristics of a BST in the rendered content
    const properties = await page.locator('body').textContent();
    expect(properties).toContain('Node Structure');
    expect(properties).toContain('Ordering');
    expect(properties).toContain('Null Children');
  });

  test('should validate basic operations of BST', async ({ page }) => {
    // Validate that the basic operations are described correctly
    const operations = await page.locator('body').textContent();
    expect(operations).toContain('Insertion');
    expect(operations).toContain('Search');
    expect(operations).toContain('Deletion');
  });

  test('should validate time complexity information', async ({ page }) => {
    // Check for time complexity details in the content
    const complexityInfo = await page.locator('body').textContent();
    expect(complexityInfo).toContain('O(h)');
    expect(complexityInfo).toContain('O(log n)');
    expect(complexityInfo).toContain('O(n)');
  });

  test('should validate balancing methods of BST', async ({ page }) => {
    // Ensure that balancing methods are mentioned
    const balancingMethods = await page.locator('body').textContent();
    expect(balancingMethods).toContain('AVL Trees');
    expect(balancingMethods).toContain('Red-Black Trees');
    expect(balancingMethods).toContain('Splay Trees');
    expect(balancingMethods).toContain('B-Trees');
  });

  test('should check for example BST structure', async ({ page }) => {
    // Validate that the example BST structure is present
    const exampleStructure = await page.locator('body').textContent();
    expect(exampleStructure).toContain('15');
    expect(exampleStructure).toContain('10');
    expect(exampleStructure).toContain('20');
    expect(exampleStructure).toContain('8');
    expect(exampleStructure).toContain('12');
    expect(exampleStructure).toContain('17');
    expect(exampleStructure).toContain('25');
  });

  test.afterEach(async ({ page }) => {
    // Cleanup actions after each test if necessary
    // Currently, no specific cleanup is needed
  });
});