import { test, expect } from '@playwright/test';

const url = 'http://127.0.0.1:5500/workspace/0126-test-2/html/8a43a180-fa6e-11f0-aefd-75a6f6ae020e.html';

test.describe('Binary Search Tree Visualization Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the application page before each test
        await page.goto(url);
    });

    test('Initial state is Idle', async ({ page }) => {
        // Validate that the initial state is Idle
        const button = await page.locator("button[onclick='insertNode()']");
        await expect(button).toBeVisible();
        await expect(button).toHaveText('Insert Node');
    });

    test('Insert Node with valid input', async ({ page }) => {
        // Test inserting a valid node into the BST
        await page.fill('#valueInput', '10');
        await page.click("button[onclick='insertNode()']");

        // Validate that the node has been inserted and visualized
        const bstContainer = await page.locator('#bst');
        await expect(bstContainer).toContainText('10');
    });

    test('Insert Node with invalid input', async ({ page }) => {
        // Test inserting an invalid node (non-numeric input)
        await page.fill('#valueInput', 'not-a-number');
        await page.click("button[onclick='insertNode()']");

        // Validate that an alert is shown for invalid input
        page.on('dialog', async dialog => {
            expect(dialog.message()).toBe('Please enter a valid number.');
            await dialog.dismiss();
        });
    });

    test('Insert multiple nodes', async ({ page }) => {
        // Test inserting multiple valid nodes into the BST
        const values = [15, 5, 20, 3, 7];
        for (const value of values) {
            await page.fill('#valueInput', value.toString());
            await page.click("button[onclick='insertNode()']");
        }

        // Validate that all nodes have been inserted and visualized
        const bstContainer = await page.locator('#bst');
        for (const value of values) {
            await expect(bstContainer).toContainText(value.toString());
        }
    });

    test('Check BST structure after multiple insertions', async ({ page }) => {
        // Test the structure of the BST after multiple insertions
        await page.fill('#valueInput', '10');
        await page.click("button[onclick='insertNode()']");
        await page.fill('#valueInput', '5');
        await page.click("button[onclick='insertNode()']");
        await page.fill('#valueInput', '15');
        await page.click("button[onclick='insertNode()']");

        // Validate that the BST visualizes the correct structure
        const bstContainer = await page.locator('#bst');
        await expect(bstContainer).toContainText('10');
        await expect(bstContainer).toContainText('5');
        await expect(bstContainer).toContainText('15');
    });

    test('Check for console errors', async ({ page }) => {
        // Listen for console errors and assert that they occur
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });

        await page.goto(url);
        expect(consoleErrors.length).toBe(0; // Adjust this based on expected errors
    });
});