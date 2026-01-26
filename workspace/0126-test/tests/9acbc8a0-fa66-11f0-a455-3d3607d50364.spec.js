import { test, expect } from '@playwright/test';

const baseUrl = 'http://127.0.0.1:5500/workspace/0126-test/html/9acbc8a0-fa66-11f0-a455-3d3607d50364.html';

test.describe('Binary Search Tree Application', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the application page before each test
        await page.goto(baseUrl);
    });

    test('Initial state should render the input and button', async ({ page }) => {
        // Validate that the initial state (Idle) is rendered correctly
        const input = await page.locator('#root');
        const button = await page.locator('#add-tree');
        await expect(input).toBeVisible();
        await expect(button).toBeVisible();
        await expect(input).toHaveAttribute('placeholder', 'Enter the root of the BST');
        await expect(button).toHaveText('Add');
    });

    test('Adding a node to the BST should transition to Tree Displayed state', async ({ page }) => {
        // Simulate user input and click the Add button
        await page.fill('#root', '1');
        await page.click('#add-tree');

        // Validate that the tree is displayed in the tree-container
        const treeContainer = await page.locator('#tree-container');
        await expect(treeContainer).toContainText('1');
    });

    test('Adding multiple nodes should display all nodes correctly', async ({ page }) => {
        // Add multiple nodes to the BST
        await page.fill('#root', '2');
        await page.click('#add-tree');
        await page.fill('#root', '3');
        await page.click('#add-tree');
        await page.fill('#root', '4');
        await page.click('#add-tree');

        // Validate that all nodes are displayed correctly
        const treeContainer = await page.locator('#tree-container');
        await expect(treeContainer).toContainText('2');
        await expect(treeContainer).toContainText('3');
        await expect(treeContainer).toContainText('4');
    });

    test('Adding an empty node should not cause any errors', async ({ page }) => {
        // Attempt to add an empty node
        await page.fill('#root', '');
        await page.click('#add-tree');

        // Validate that no nodes are displayed in the tree-container
        const treeContainer = await page.locator('#tree-container');
        await expect(treeContainer).toBeEmpty();
    });

    test('Adding a non-numeric value should not cause any errors', async ({ page }) => {
        // Attempt to add a non-numeric value
        await page.fill('#root', 'abc');
        await page.click('#add-tree');

        // Validate that the tree-container does not contain the non-numeric value
        const treeContainer = await page.locator('#tree-container');
        await expect(treeContainer).not.toContainText('abc');
    });

    test('Console errors should be logged when adding invalid nodes', async ({ page }) => {
        // Listen for console messages
        const consoleMessages = [];
        page.on('console', msg => consoleMessages.push(msg.text()));

        // Attempt to add an invalid node
        await page.fill('#root', 'invalid');
        await page.click('#add-tree');

        // Validate that a console error is logged
        await expect(consoleMessages).toContainEqual(expect.stringContaining('Error'));
    });
});