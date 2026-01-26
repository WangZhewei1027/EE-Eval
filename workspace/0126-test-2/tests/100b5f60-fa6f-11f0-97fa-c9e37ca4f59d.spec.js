import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-test-2/html/100b5f60-fa6f-11f0-97fa-c9e37ca4f59d.html';

test.describe('Binary Search Tree Visualization Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Load the application page before each test
        await page.goto(BASE_URL);
    });

    test('Initial state - Idle', async ({ page }) => {
        // Verify that the application starts in the Idle state
        const input = await page.locator('#value');
        const insertBtn = await page.locator('#insertBtn');
        const inorderBtn = await page.locator('#inorderBtn');
        
        await expect(input).toBeVisible();
        await expect(insertBtn).toBeVisible();
        await expect(inorderBtn).toBeVisible();
    });

    test('Insert a value into the BST', async ({ page }) => {
        // Test inserting a valid value into the BST
        await page.fill('#value', '10');
        await page.click('#insertBtn');

        // Verify that the canvas is redrawn (check for visual feedback)
        const canvas = await page.locator('#canvas');
        await expect(canvas).toBeVisible();
        
        // Check if the input field is cleared after insertion
        await expect(page.locator('#value')).toHaveValue('');
    });

    test('Insert an invalid value', async ({ page }) => {
        // Test inserting an invalid value (non-numeric)
        await page.fill('#value', 'abc');
        await page.click('#insertBtn');

        // Verify that the canvas is not updated (still in Idle state)
        const canvas = await page.locator('#canvas');
        await expect(canvas).toBeVisible();
    });

    test('Perform inorder traversal', async ({ page }) => {
        // Insert values first
        await page.fill('#value', '10');
        await page.click('#insertBtn');
        await page.fill('#value', '5');
        await page.click('#insertBtn');
        await page.fill('#value', '15');
        await page.click('#insertBtn');

        // Perform inorder traversal
        await page.click('#inorderBtn');

        // Verify that the alert shows the correct inorder traversal result
        page.on('dialog', async dialog => {
            expect(dialog.message()).toBe('Inorder Traversal: 5, 10, 15');
            await dialog.dismiss();
        });
    });

    test('Check alert for inorder traversal with no values', async ({ page }) => {
        // Perform inorder traversal without inserting any values
        await page.click('#inorderBtn');

        // Verify that the alert shows an empty result
        page.on('dialog', async dialog => {
            expect(dialog.message()).toBe('Inorder Traversal: ');
            await dialog.dismiss();
        });
    });

    test('Insert multiple values and verify state', async ({ page }) => {
        // Insert multiple values
        await page.fill('#value', '20');
        await page.click('#insertBtn');
        await page.fill('#value', '10');
        await page.click('#insertBtn');
        await page.fill('#value', '30');
        await page.click('#insertBtn');

        // Perform inorder traversal
        await page.click('#inorderBtn');

        // Verify that the alert shows the correct inorder traversal result
        page.on('dialog', async dialog => {
            expect(dialog.message()).toBe('Inorder Traversal: 10, 20, 30');
            await dialog.dismiss();
        });
    });

    test('Check console errors on invalid input', async ({ page }) => {
        // Listen for console errors
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });

        // Attempt to insert an invalid value
        await page.fill('#value', 'invalid');
        await page.click('#insertBtn');

        // Check that an error was logged to the console
        await expect(consoleErrors.length).toBeGreaterThan(0);
    });
});