import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-test-2/html/4d53c770-fa71-11f0-92ad-77d0cd5588f1.html';

test.describe('Binary Search Tree Visualization', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the application page before each test
        await page.goto(BASE_URL);
    });

    test('Initial state is Idle', async ({ page }) => {
        // Verify that the initial state is Idle
        const button = await page.locator('#generateTree');
        await expect(button).toBeVisible();
        await expect(button).toHaveText('Generate BST');
    });

    test('Generate BST button click transitions to Tree Generated state', async ({ page }) => {
        // Click the Generate BST button
        await page.click('#generateTree');

        // Verify that the tree nodes are displayed after clicking the button
        const treeContainer = await page.locator('#tree');
        await expect(treeContainer).toHaveCount(7); // Expecting 7 nodes to be drawn

        // Check if lines connecting nodes are present
        const lines = await page.locator('.line');
        await expect(lines).toHaveCount(6); // Expecting 6 lines to connect nodes
    });

    test('Clicking Generate BST multiple times does not duplicate nodes', async ({ page }) => {
        // Click the Generate BST button multiple times
        await page.click('#generateTree');
        await page.click('#generateTree');

        // Verify that nodes are still 7 and lines are still 6
        const treeContainer = await page.locator('#tree');
        await expect(treeContainer).toHaveCount(7); // Expecting 7 nodes to be drawn
        const lines = await page.locator('.line');
        await expect(lines).toHaveCount(6); // Expecting 6 lines to connect nodes
    });

    test('Check console for errors on page load', async ({ page }) => {
        // Listen for console messages and check for errors
        const consoleMessages = [];
        page.on('console', msg => consoleMessages.push(msg.text()));

        await page.goto(BASE_URL);

        // Check if there are any errors in the console
        const errors = consoleMessages.filter(msg => msg.startsWith('Error:'));
        expect(errors.length).toBe(0; // Expecting no errors on initial load
    });

    test('Verify visual feedback of nodes and lines', async ({ page }) => {
        // Click the Generate BST button to generate the tree
        await page.click('#generateTree');

        // Check if the nodes have the correct styles
        const nodes = await page.locator('.node');
        for (let i = 0; i < 7; i++) {
            await expect(nodes.nth(i)).toHaveCSS('background-color', 'rgb(0, 119, 204)'); // Check node color
            await expect(nodes.nth(i)).toHaveCSS('color', 'rgb(255, 255, 255)'); // Check text color
        }
    });

    test('Check for any uncaught errors after generating the tree', async ({ page }) => {
        // Click the Generate BST button
        await page.click('#generateTree');

        // Listen for uncaught exceptions
        const uncaughtErrors = [];
        page.on('pageerror', error => {
            uncaughtErrors.push(error.message);
        });

        // Verify that there are no uncaught errors
        expect(uncaughtErrors.length).toBe(0; // Expecting no uncaught errors after generating the tree
    });
});