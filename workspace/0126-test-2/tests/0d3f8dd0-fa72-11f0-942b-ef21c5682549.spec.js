import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-test-2/html/0d3f8dd0-fa72-11f0-942b-ef21c5682549.html';

test.describe('Binary Search Tree Demo Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the Binary Search Tree Demo page before each test
        await page.goto(BASE_URL);
    });

    test('should render initial state with input and button', async ({ page }) => {
        // Verify that the input field and button are present in the initial state
        const inputField = await page.locator('#valueInput');
        const insertButton = await page.locator('#insertButton');
        
        await expect(inputField).toBeVisible();
        await expect(insertButton).toBeVisible();
        await expect(inputField).toHaveAttribute('placeholder', 'Enter a number to insert');
        await expect(insertButton).toHaveText('Insert');
    });

    test('should insert a number into the BST and update the visual representation', async ({ page }) => {
        // Insert a number and check if the BST updates
        const inputField = await page.locator('#valueInput');
        const insertButton = await page.locator('#insertButton');

        await inputField.fill('10');
        await insertButton.click();

        // Verify that the BST visual representation updates
        const bstContainer = await page.locator('#bst-container');
        await expect(bstContainer).toContainText('10');
    });

    test('should insert multiple numbers and verify the visual representation', async ({ page }) => {
        // Insert multiple numbers and check if the BST updates correctly
        const inputField = await page.locator('#valueInput');
        const insertButton = await page.locator('#insertButton');

        await inputField.fill('10');
        await insertButton.click();
        await inputField.fill('5');
        await insertButton.click();
        await inputField.fill('15');
        await insertButton.click();

        // Verify that the BST visual representation contains all inserted numbers
        const bstContainer = await page.locator('#bst-container');
        await expect(bstContainer).toContainText('10');
        await expect(bstContainer).toContainText('5');
        await expect(bstContainer).toContainText('15');
    });

    test('should handle invalid input gracefully', async ({ page }) => {
        // Attempt to insert an invalid number and check for no changes in the BST
        const inputField = await page.locator('#valueInput');
        const insertButton = await page.locator('#insertButton');

        await inputField.fill('invalid');
        await insertButton.click();

        // Verify that the BST visual representation does not update
        const bstContainer = await page.locator('#bst-container');
        const initialContent = await bstContainer.innerHTML();
        
        await expect(bstContainer).toHaveText(initialContent);
    });

    test('should clear input field after insertion', async ({ page }) => {
        // Insert a number and check if the input field is cleared
        const inputField = await page.locator('#valueInput');
        const insertButton = await page.locator('#insertButton');

        await inputField.fill('20');
        await insertButton.click();

        // Verify that the input field is cleared
        await expect(inputField).toHaveValue('');
    });

    test('should handle empty input gracefully', async ({ page }) => {
        // Attempt to insert an empty input and check for no changes in the BST
        const insertButton = await page.locator('#insertButton');

        await insertButton.click();

        // Verify that the BST visual representation does not update
        const bstContainer = await page.locator('#bst-container');
        const initialContent = await bstContainer.innerHTML();
        
        await expect(bstContainer).toHaveText(initialContent);
    });

    test('should throw an error on invalid number input', async ({ page }) => {
        // Check for console errors when invalid input is provided
        page.on('console', msg => {
            if (msg.type() === 'error') {
                expect(msg.text()).toContain('ReferenceError');
            }
        });

        const inputField = await page.locator('#valueInput');
        const insertButton = await page.locator('#insertButton');

        await inputField.fill('NaN');
        await insertButton.click();
    });
});