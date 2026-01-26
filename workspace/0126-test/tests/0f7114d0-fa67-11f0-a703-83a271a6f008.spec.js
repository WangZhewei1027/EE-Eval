import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-test/html/0f7114d0-fa67-11f0-a703-83a271a6f008.html';

test.describe('Binary Search Tree Interactive Application', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the application page before each test
        await page.goto(BASE_URL);
    });

    test('should render the initial state correctly', async ({ page }) => {
        // Validate the initial state of the application
        const rootDiv = await page.locator('.root');
        await expect(rootDiv).toBeVisible();
    });

    test('should insert nodes and log correct messages', async ({ page }) => {
        // Insert nodes into the Binary Search Tree
        await page.evaluate(() => {
            insertNode('A', 0);
            insertNode('B', 0);
            insertNode('C', 1);
            insertNode('D', 1);
            insertNode('E', 1);
        });

        // Check console logs for inserted nodes
        const consoleMessages = await page.evaluate(() => {
            return console.logs;
        });

        expect(consoleMessages).toContain('Node 1:');
        expect(consoleMessages).toContain('Node 2:');
        expect(consoleMessages).toContain('Node 3:');
        expect(consoleMessages).toContain('Node 4:');
        expect(consoleMessages).toContain('Node 5:');
    });

    test('should search for a node and log the result', async ({ page }) => {
        // Insert nodes first
        await page.evaluate(() => {
            insertNode('A', 0);
            insertNode('B', 0);
            insertNode('C', 1);
            insertNode('D', 1);
            insertNode('E', 1);
        });

        // Search for a specific node
        const searchResult = await page.evaluate(() => {
            return searchNode('E', 1);
        });

        // Validate the search result
        expect(searchResult).toEqual({ data: 'E' });
    });

    test('should handle search for a non-existent node', async ({ page }) => {
        // Attempt to search for a node that does not exist
        const searchResult = await page.evaluate(() => {
            return searchNode('Z', 1);
        });

        // Validate that the search result is null
        expect(searchResult).toBeNull();
    });

    test('should not insert node with invalid index', async ({ page }) => {
        // Attempt to insert a node with an invalid index
        await page.evaluate(() => {
            insertNode('A', -1); // Invalid index
        });

        // Check console logs for any error or warning messages
        const consoleMessages = await page.evaluate(() => {
            return console.logs;
        });

        expect(consoleMessages).not.toContain('Node 1:');
    });

    test('should not search node with invalid index', async ({ page }) => {
        // Attempt to search for a node with an invalid index
        const searchResult = await page.evaluate(() => {
            return searchNode('A', -1); // Invalid index
        });

        // Validate that the search result is null
        expect(searchResult).toBeNull();
    });

    test.afterEach(async ({ page }) => {
        // Cleanup actions after each test if necessary
        await page.evaluate(() => {
            // Reset the BST or any other necessary cleanup
        });
    });
});