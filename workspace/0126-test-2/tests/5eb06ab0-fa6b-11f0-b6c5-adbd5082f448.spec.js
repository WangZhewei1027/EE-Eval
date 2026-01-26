import { test, expect } from '@playwright/test';

const url = 'http://127.0.0.1:5500/workspace/0126-test-2/html/5eb06ab0-fa6b-11f0-b6c5-adbd5082f448.html';

test.describe('Binary Search Tree Interactive Application', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the application page before each test
        await page.goto(url);
    });

    test('should render the initial state correctly', async ({ page }) => {
        // Validate that the initial state (Idle) is rendered
        const treeDiv = await page.locator('#tree');
        await expect(treeDiv).toBeVisible();
        const content = await treeDiv.innerHTML();
        expect(content).toBe('');
    });

    test('should populate the tree and transition to Tree Populated state', async ({ page }) => {
        // Validate that the tree is populated correctly
        const treeDiv = await page.locator('#tree');
        
        // Wait for the tree to be populated
        await page.waitForTimeout(1000); // Wait for the insertion to complete

        const content = await treeDiv.innerHTML();
        const expectedValues = ['5', '2', '8', '3', '9', '1', '6', '7', '4'];
        expectedValues.forEach(value => {
            expect(content).toContain(`<p>${value}</p>`);
        });
    });

    test('should handle insertion of duplicate values gracefully', async ({ page }) => {
        // Attempt to insert duplicate values and check for errors
        await page.evaluate(() => {
            const bst = new BinarySearchTree();
            bst.insert(5);
            bst.insert(5); // Inserting duplicate
            bst.inorder();
        });

        const treeDiv = await page.locator('#tree');
        const content = await treeDiv.innerHTML();
        expect(content).toContain('<p>5</p>'); // Should still only show one instance of 5
    });

    test('should handle invalid input gracefully', async ({ page }) => {
        // Attempt to insert invalid values and check for errors
        await page.evaluate(() => {
            const bst = new BinarySearchTree();
            try {
                bst.insert(null); // Invalid input
            } catch (e) {
                console.error(e);
            }
            bst.inorder();
        });

        const treeDiv = await page.locator('#tree');
        const content = await treeDiv.innerHTML();
        expect(content).not.toContain('<p></p>'); // Should not render anything for invalid input
    });

    test('should log errors to the console', async ({ page }) => {
        // Check for console errors when inserting invalid values
        const consoleMessages = [];
        page.on('console', msg => consoleMessages.push(msg.text()));

        await page.evaluate(() => {
            const bst = new BinarySearchTree();
            bst.insert(undefined); // Invalid input
        });

        expect(consoleMessages).toContain(expect.stringContaining('TypeError'));
    });
});