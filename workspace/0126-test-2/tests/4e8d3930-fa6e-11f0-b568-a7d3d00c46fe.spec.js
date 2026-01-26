import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-test-2/html/4e8d3930-fa6e-11f0-b568-a7d3d00c46fe.html';

test.describe('Binary Search Tree Visualization', () => {
    test.beforeEach(async ({ page }) => {
        // Load the application page before each test
        await page.goto(BASE_URL);
    });

    test('Initial state is Idle', async ({ page }) => {
        // Validate that the initial state is Idle
        const button = await page.locator("button[onclick='insertNode()']");
        await expect(button).toBeVisible();
        await expect(page.locator('#value')).toBeVisible();
    });

    test('Insert Node button is clickable', async ({ page }) => {
        // Ensure the Insert Node button is clickable
        const button = await page.locator("button[onclick='insertNode()']");
        await expect(button).toBeEnabled();
    });

    test('Inserting a valid node updates the BST', async ({ page }) => {
        // Test inserting a valid node and check the BST visualization
        const input = await page.locator('#value');
        const button = await page.locator("button[onclick='insertNode()']");

        await input.fill('10'); // Enter a valid number
        await button.click(); // Click to insert the node

        // Validate that the node is visualized in the BST
        const node = await page.locator('.node');
        await expect(node).toHaveText('10');
    });

    test('Inserting multiple nodes updates the BST correctly', async ({ page }) => {
        // Test inserting multiple nodes and check the BST visualization
        const input = await page.locator('#value');
        const button = await page.locator("button[onclick='insertNode()']");

        await input.fill('15');
        await button.click();
        await input.fill('5');
        await button.click();
        await input.fill('20');
        await button.click();

        // Validate that all nodes are visualized in the BST
        const nodes = await page.locator('.node');
        await expect(nodes).toHaveCount(3);
        await expect(nodes.nth(0)).toHaveText('15'); // Root node
        await expect(nodes.nth(1)).toHaveText('5');  // Left child
        await expect(nodes.nth(2)).toHaveText('20'); // Right child
    });

    test('Inserting an invalid node does not update the BST', async ({ page }) => {
        // Test inserting an invalid node and ensure no update occurs
        const input = await page.locator('#value');
        const button = await page.locator("button[onclick='insertNode()']");

        await input.fill('abc'); // Enter an invalid value
        await button.click(); // Click to insert the node

        // Validate that no nodes are visualized in the BST
        const nodes = await page.locator('.node');
        await expect(nodes).toHaveCount(0);
    });

    test('Inserting a node with empty input does not update the BST', async ({ page }) => {
        // Test inserting with empty input
        const button = await page.locator("button[onclick='insertNode()']");

        await button.click(); // Click to insert the node

        // Validate that no nodes are visualized in the BST
        const nodes = await page.locator('.node');
        await expect(nodes).toHaveCount(0);
    });

    test('Check for console errors on invalid operations', async ({ page }) => {
        // Observe console logs for errors during invalid operations
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('Console error:', msg.text());
            }
        });

        const input = await page.locator('#value');
        const button = await page.locator("button[onclick='insertNode()']");

        await input.fill('abc'); // Enter an invalid value
        await button.click(); // Click to insert the node

        // Expect console error for invalid input
        await expect(page).toHaveConsoleError(/Invalid input/);
    });
});