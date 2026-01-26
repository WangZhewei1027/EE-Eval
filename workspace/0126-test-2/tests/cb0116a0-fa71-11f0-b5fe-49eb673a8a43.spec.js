import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-test-2/html/cb0116a0-fa71-11f0-b5fe-49eb673a8a43.html';

test.describe('Binary Search Tree (BST) Interactive Application', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the application page before each test
        await page.goto(BASE_URL);
    });

    test('should display the Idle state with the Demonstration button', async ({ page }) => {
        // Verify that the page is in the Idle state
        const button = await page.locator('.button');
        await expect(button).toBeVisible();
        await expect(button).toHaveText('Demonstration');
    });

    test('should show demo alert when Demonstration button is clicked', async ({ page }) => {
        // Click the Demonstration button and verify the alert
        const [alert] = await Promise.all([
            page.waitForEvent('dialog'), // Wait for the alert dialog to be shown
            page.locator('.button').click() // Click the button
        ]);
        expect(alert.message()).toBe('This feature is a placeholder. The demonstration would illustrate BST operations visually.');
        await alert.dismiss(); // Dismiss the alert
    });

    test('should transition from Idle to DemoShown state on button click', async ({ page }) => {
        // Click the Demonstration button
        const [alert] = await Promise.all([
            page.waitForEvent('dialog'), // Wait for the alert dialog to be shown
            page.locator('.button').click() // Click the button
        ]);
        // Verify that the alert is displayed
        expect(alert.message()).toBe('This feature is a placeholder. The demonstration would illustrate BST operations visually.');
        await alert.dismiss(); // Dismiss the alert
    });

    test('should handle multiple clicks on the Demonstration button', async ({ page }) => {
        // Click the Demonstration button twice and verify alerts
        for (let i = 0; i < 2; i++) {
            const [alert] = await Promise.all([
                page.waitForEvent('dialog'), // Wait for the alert dialog to be shown
                page.locator('.button').click() // Click the button
            ]);
            expect(alert.message()).toBe('This feature is a placeholder. The demonstration would illustrate BST operations visually.');
            await alert.dismiss(); // Dismiss the alert
        }
    });

    test('should not throw errors when the page is loaded', async ({ page }) => {
        // Check for console errors on page load
        const consoleMessages = [];
        page.on('console', msg => consoleMessages.push(msg.text()));
        
        await page.goto(BASE_URL);
        
        // Assert that no errors are logged to the console
        const errorMessages = consoleMessages.filter(msg => msg.includes('Error'));
        expect(errorMessages.length).toBe(0);
    });

    test('should handle alert dismissal correctly', async ({ page }) => {
        // Click the Demonstration button and dismiss the alert
        const [alert] = await Promise.all([
            page.waitForEvent('dialog'), // Wait for the alert dialog to be shown
            page.locator('.button').click() // Click the button
        ]);
        await alert.dismiss(); // Dismiss the alert
        
        // Verify that the alert was dismissed and no further alerts are shown
        await expect(page.locator('.button')).toBeVisible();
    });
});