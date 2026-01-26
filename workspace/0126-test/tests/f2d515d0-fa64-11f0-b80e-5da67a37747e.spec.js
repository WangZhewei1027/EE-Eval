import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-test/html/f2d515d0-fa64-11f0-b80e-5da67a37747e.html';

test.describe('Binary Search Tree Visualization Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the application page before each test
        await page.goto(BASE_URL);
    });

    test('should be in Idle state initially', async ({ page }) => {
        // Validate that the input field and button are present
        const inputField = await page.locator('input#valueInput');
        const insertButton = await page.locator('button[onclick="insertNode()"]');
        await expect(inputField).toBeVisible();
        await expect(insertButton).toBeVisible();
    });

    test('should insert a node and transition to NodeInserted state', async ({ page }) => {
        // Input a valid number and click the insert button
        await page.fill('input#valueInput', '10');
        await page.click('button[onclick="insertNode()"]');

        // Validate that the tree visualization is updated
        const bstContainer = await page.locator('#bstContainer');
        await expect(bstContainer).toContainText('10');
    });

    test('should allow multiple nodes to be inserted', async ({ page }) => {
        // Insert first node
        await page.fill('input#valueInput', '10');
        await page.click('button[onclick="insertNode()"]');
        await expect(page.locator('#bstContainer')).toContainText('10');

        // Insert second node
        await page.fill('input#valueInput', '5');
        await page.click('button[onclick="insertNode()"]');
        await expect(page.locator('#bstContainer')).toContainText('5');

        // Insert third node
        await page.fill('input#valueInput', '15');
        await page.click('button[onclick="insertNode()"]');
        await expect(page.locator('#bstContainer')).toContainText('15');
    });

    test('should alert when a non-numeric value is entered', async ({ page }) => {
        // Enter a non-numeric value
        await page.fill('input#valueInput', 'abc');
        await page.click('button[onclick="insertNode()"]');

        // Validate that an alert is shown
        const [alert] = await Promise.all([
            page.waitForEvent('dialog'),
            page.click('button[onclick="insertNode()"]')
        ]);
        expect(alert.message()).toBe('Please enter a valid number.');
        await alert.dismiss();
    });

    test('should clear input field after inserting a node', async ({ page }) => {
        // Insert a valid node
        await page.fill('input#valueInput', '10');
        await page.click('button[onclick="insertNode()"]');

        // Validate that the input field is cleared
        const inputFieldValue = await page.inputValue('input#valueInput');
        expect(inputFieldValue).toBe('');
    });

    test('should handle multiple invalid inputs gracefully', async ({ page }) => {
        // Enter multiple invalid values
        await page.fill('input#valueInput', 'abc');
        await page.click('button[onclick="insertNode()"]');
        
        const [alert1] = await Promise.all([
            page.waitForEvent('dialog'),
            page.click('button[onclick="insertNode()"]')
        ]);
        await alert1.dismiss();

        await page.fill('input#valueInput', '');
        await page.click('button[onclick="insertNode()"]');

        const [alert2] = await Promise.all([
            page.waitForEvent('dialog'),
            page.click('button[onclick="insertNode()"]')
        ]);
        await alert2.dismiss();
    });

    test('should not insert a node if input is empty', async ({ page }) => {
        // Click the insert button without entering a value
        await page.click('button[onclick="insertNode()"]');

        // Validate that the tree visualization is still empty
        const bstContainer = await page.locator('#bstContainer');
        await expect(bstContainer).toBeEmpty();
    });

    test('should show the correct tree structure after multiple inserts', async ({ page }) => {
        // Insert nodes in a specific order
        await page.fill('input#valueInput', '10');
        await page.click('button[onclick="insertNode()"]');
        await page.fill('input#valueInput', '5');
        await page.click('button[onclick="insertNode()"]');
        await page.fill('input#valueInput', '15');
        await page.click('button[onclick="insertNode()"]');

        // Validate the tree structure
        const bstContainer = await page.locator('#bstContainer');
        await expect(bstContainer).toContainText('10');
        await expect(bstContainer).toContainText('5');
        await expect(bstContainer).toContainText('15');
    });
});