import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-test-2/html/80a1a110-fa71-11f0-b5af-c3481aae3ffd.html';

test.describe('Binary Search Tree Interactive Demo', () => {
    test.beforeEach(async ({ page }) => {
        // Load the page before each test
        await page.goto(BASE_URL);
    });

    test('should insert a value into the Binary Search Tree', async ({ page }) => {
        // Test inserting a value
        await page.fill('#node-input', '10');
        await page.click('#insert-btn');
        
        // Verify that the tree is updated
        const treeContent = await page.innerText('#tree');
        expect(treeContent).toContain('"value": 10');
    });

    test('should find the minimum value in the Binary Search Tree', async ({ page }) => {
        // Insert values and find minimum
        await page.fill('#node-input', '20');
        await page.click('#insert-btn');
        await page.fill('#node-input', '10');
        await page.click('#insert-btn');
        
        await page.click('#min-btn');
        
        // Verify alert for minimum value
        page.on('dialog', async dialog => {
            expect(dialog.message()).toBe('Minimum value: 10');
            await dialog.dismiss();
        });
    });

    test('should find the maximum value in the Binary Search Tree', async ({ page }) => {
        // Insert values and find maximum
        await page.fill('#node-input', '20');
        await page.click('#insert-btn');
        await page.fill('#node-input', '10');
        await page.click('#insert-btn');
        
        await page.click('#max-btn');
        
        // Verify alert for maximum value
        page.on('dialog', async dialog => {
            expect(dialog.message()).toBe('Maximum value: 20');
            await dialog.dismiss();
        });
    });

    test('should perform in-order traversal of the Binary Search Tree', async ({ page }) => {
        // Insert values and perform in-order traversal
        await page.fill('#node-input', '20');
        await page.click('#insert-btn');
        await page.fill('#node-input', '10');
        await page.click('#insert-btn');
        
        await page.click('#inorder-btn');
        
        // Verify alert for in-order traversal
        page.on('dialog', async dialog => {
            expect(dialog.message()).toBe('In-order Traversal: 10, 20');
            await dialog.dismiss();
        });
    });

    test('should perform pre-order traversal of the Binary Search Tree', async ({ page }) => {
        // Insert values and perform pre-order traversal
        await page.fill('#node-input', '20');
        await page.click('#insert-btn');
        await page.fill('#node-input', '10');
        await page.click('#insert-btn');
        
        await page.click('#preorder-btn');
        
        // Verify alert for pre-order traversal
        page.on('dialog', async dialog => {
            expect(dialog.message()).toBe('Pre-order Traversal: 20, 10');
            await dialog.dismiss();
        });
    });

    test('should perform post-order traversal of the Binary Search Tree', async ({ page }) => {
        // Insert values and perform post-order traversal
        await page.fill('#node-input', '20');
        await page.click('#insert-btn');
        await page.fill('#node-input', '10');
        await page.click('#insert-btn');
        
        await page.click('#postorder-btn');
        
        // Verify alert for post-order traversal
        page.on('dialog', async dialog => {
            expect(dialog.message()).toBe('Post-order Traversal: 10, 20');
            await dialog.dismiss();
        });
    });

    test('should delete a value from the Binary Search Tree', async ({ page }) => {
        // Insert values and delete a value
        await page.fill('#node-input', '20');
        await page.click('#insert-btn');
        await page.fill('#node-input', '10');
        await page.click('#insert-btn');
        
        await page.fill('#delete-input', '10');
        await page.click('#delete-btn');
        
        // Verify that the tree is updated
        const treeContent = await page.innerText('#tree');
        expect(treeContent).not.toContain('"value": 10');
    });

    test('should search for a value in the Binary Search Tree', async ({ page }) => {
        // Insert values and search for a value
        await page.fill('#node-input', '20');
        await page.click('#insert-btn');
        await page.fill('#node-input', '10');
        await page.click('#insert-btn');
        
        await page.fill('#search-input', '10');
        await page.click('#search-btn');
        
        // Verify alert for found value
        page.on('dialog', async dialog => {
            expect(dialog.message()).toBe('Value 10 found');
            await dialog.dismiss();
        });
    });

    test('should alert when searching for a non-existent value', async ({ page }) => {
        // Search for a value that does not exist
        await page.fill('#search-input', '30');
        await page.click('#search-btn');
        
        // Verify alert for not found value
        page.on('dialog', async dialog => {
            expect(dialog.message()).toBe('Value 30 not found');
            await dialog.dismiss();
        });
    });

    test('should handle edge case for finding minimum in an empty tree', async ({ page }) => {
        // Find minimum in an empty tree
        await page.click('#min-btn');
        
        // Verify alert for empty tree
        page.on('dialog', async dialog => {
            expect(dialog.message()).toBe('Tree is empty');
            await dialog.dismiss();
        });
    });

    test('should handle edge case for finding maximum in an empty tree', async ({ page }) => {
        // Find maximum in an empty tree
        await page.click('#max-btn');
        
        // Verify alert for empty tree
        page.on('dialog', async dialog => {
            expect(dialog.message()).toBe('Tree is empty');
            await dialog.dismiss();
        });
    });
});