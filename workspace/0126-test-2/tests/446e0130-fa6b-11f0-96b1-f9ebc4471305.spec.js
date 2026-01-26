import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-test-2/html/446e0130-fa6b-11f0-96b1-f9ebc4471305.html';

test.describe('Binary Search Tree Visualization', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the application page before each test
        await page.goto(BASE_URL);
    });

    test('Initial state should be Idle', async ({ page }) => {
        // Verify that the input and button are present in the Idle state
        const input = await page.locator('#value');
        const button = await page.locator('button[onclick="insertNode()"]');
        
        await expect(input).toBeVisible();
        await expect(button).toBeVisible();
    });

    test('Inserting a valid node should transition to Node Inserted state', async ({ page }) => {
        // Insert a valid node and check the state transition
        const input = await page.locator('#value');
        const button = await page.locator('button[onclick="insertNode()"]');
        
        await input.fill('10'); // Valid input
        await button.click(); // Trigger the insertNode event
        
        // Verify that the node is rendered in the BST container
        const bstContainer = await page.locator('#bst-container');
        await expect(bstContainer).toContainText('10');
    });

    test('Inserting multiple nodes should render them correctly', async ({ page }) => {
        // Insert multiple nodes and check their rendering
        const input = await page.locator('#value');
        const button = await page.locator('button[onclick="insertNode()"]');
        
        await input.fill('5');
        await button.click();
        
        await input.fill('15');
        await button.click();
        
        await input.fill('3');
        await button.click();
        
        await input.fill('7');
        await button.click();
        
        const bstContainer = await page.locator('#bst-container');
        await expect(bstContainer).toContainText('5');
        await expect(bstContainer).toContainText('15');
        await expect(bstContainer).toContainText('3');
        await expect(bstContainer).toContainText('7');
    });

    test('Inserting an invalid node should show an alert', async ({ page }) => {
        // Attempt to insert an invalid node and check for alert
        const input = await page.locator('#value');
        const button = await page.locator('button[onclick="insertNode()"]');
        
        await input.fill('invalid'); // Invalid input
        await button.click();
        
        // Verify that an alert is shown
        const [alert] = await Promise.all([
            page.waitForEvent('dialog'),
            button.click()
        ]);
        expect(alert.message()).toBe('Please enter a valid number.');
        await alert.dismiss(); // Dismiss the alert
    });

    test('Inserting a node should clear the input field', async ({ page }) => {
        // Insert a valid node and check if the input field is cleared
        const input = await page.locator('#value');
        const button = await page.locator('button[onclick="insertNode()"]');
        
        await input.fill('20');
        await button.click();
        
        // Verify that the input field is cleared
        await expect(input).toHaveValue('');
    });

    test('Check console errors on invalid input', async ({ page }) => {
        // Listen for console errors
        const consoleMessages = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleMessages.push(msg.text());
            }
        });

        const input = await page.locator('#value');
        const button = await page.locator('button[onclick="insertNode()"]');
        
        await input.fill('invalid'); // Invalid input
        await button.click();

        // Check for any console errors
        await expect(consoleMessages).toContainEqual(expect.stringContaining('ReferenceError'));
    });
});