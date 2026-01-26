import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-test-2/html/b3b70cf0-fa6e-11f0-b0ef-5f442423b288.html';

test.describe('Binary Search Tree Visualization', () => {
    test.beforeEach(async ({ page }) => {
        // Load the application page before each test
        await page.goto(BASE_URL);
    });

    test('should be in Idle state initially', async ({ page }) => {
        // Check that the input field and button are present
        const inputField = await page.locator('#value-input');
        const insertButton = await page.locator('button[onclick="insertValue()"]');
        
        await expect(inputField).toBeVisible();
        await expect(insertButton).toBeVisible();
    });

    test('should insert a valid number and visualize the BST', async ({ page }) => {
        // Insert a valid number and check the visualization
        const inputField = await page.locator('#value-input');
        const insertButton = await page.locator('button[onclick="insertValue()"]');
        
        await inputField.fill('10');
        await insertButton.click();

        // Verify that the BST is visualized correctly
        const bstDiv = await page.locator('#bst');
        await expect(bstDiv).toContainText('10');
    });

    test('should insert multiple numbers and visualize the BST structure', async ({ page }) => {
        // Insert multiple numbers and check the visualization
        const inputField = await page.locator('#value-input');
        const insertButton = await page.locator('button[onclick="insertValue()"]');

        await inputField.fill('10');
        await insertButton.click();
        await inputField.fill('5');
        await insertButton.click();
        await inputField.fill('15');
        await insertButton.click();

        // Verify that the BST is visualized correctly
        const bstDiv = await page.locator('#bst');
        await expect(bstDiv).toContainText('10');
        await expect(bstDiv).toContainText('5');
        await expect(bstDiv).toContainText('15');
    });

    test('should alert when inserting an invalid number', async ({ page }) => {
        // Attempt to insert an invalid number
        const inputField = await page.locator('#value-input');
        const insertButton = await page.locator('button[onclick="insertValue()"]');

        await inputField.fill('invalid');
        await insertButton.click();

        // Verify that an alert is shown
        page.on('dialog', async dialog => {
            expect(dialog.message()).toBe('Please enter a valid number.');
            await dialog.dismiss();
        });
    });

    test('should clear the input field after insertion', async ({ page }) => {
        // Insert a valid number and check if the input field is cleared
        const inputField = await page.locator('#value-input');
        const insertButton = await page.locator('button[onclick="insertValue()"]');

        await inputField.fill('20');
        await insertButton.click();

        // Verify that the input field is cleared
        await expect(inputField).toHaveValue('');
    });

    test('should handle multiple insertions correctly', async ({ page }) => {
        // Insert multiple valid numbers and check the visualization
        const inputField = await page.locator('#value-input');
        const insertButton = await page.locator('button[onclick="insertValue()"]');

        await inputField.fill('30');
        await insertButton.click();
        await inputField.fill('20');
        await insertButton.click();
        await inputField.fill('40');
        await insertButton.click();

        // Verify that the BST is visualized correctly
        const bstDiv = await page.locator('#bst');
        await expect(bstDiv).toContainText('30');
        await expect(bstDiv).toContainText('20');
        await expect(bstDiv).toContainText('40');
    });

    test('should not visualize when no values are inserted', async ({ page }) => {
        // Check the BST visualization when no values are inserted
        const bstDiv = await page.locator('#bst');
        await expect(bstDiv).toBeEmpty();
    });
});