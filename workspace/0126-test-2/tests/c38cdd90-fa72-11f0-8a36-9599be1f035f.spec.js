import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-test-2/html/c38cdd90-fa72-11f0-8a36-9599be1f035f.html';

test.describe('Bubble Sort Application Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the Bubble Sort application page before each test
        await page.goto(BASE_URL);
    });

    test('should display the original list on load', async ({ page }) => {
        // Verify that the original list is displayed correctly
        const originalListText = await page.locator('pre').innerText();
        expect(originalListText).toBe("['dog', 'cat', 'apple', 'banana', 'elephant']");
    });

    test('should sort the list when the sort button is clicked', async ({ page }) => {
        // Click the sort button
        await page.click('#sort-button');

        // Verify that the console logs the sorted list
        const consoleMessages = [];
        page.on('console', msg => {
            if (msg.type() === 'log') {
                consoleMessages.push(msg.text());
            }
        });

        // Wait for the sort operation to complete
        await page.waitForTimeout(100); // Adjust timeout as necessary

        // Check that the sorted list is logged correctly
        expect(consoleMessages).toContain("Sorted List: ['apple', 'banana', 'cat', 'dog', 'elephant']");
    });

    test('should not throw errors on initial load', async ({ page }) => {
        // Listen for console errors
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });

        // Wait for the page to load completely
        await page.waitForLoadState('load');

        // Check that no errors were logged
        expect(consoleErrors.length).toBe(0;
    });

    test('should handle empty list gracefully', async ({ page }) => {
        // Modify the originalList to be empty (this would normally be done in the app code)
        await page.evaluate(() => {
            window.originalList = [];
            console.log('Sorted List:', window.originalList);
        });

        // Click the sort button
        await page.click('#sort-button');

        // Check that the sorted list is logged correctly
        const consoleMessages = [];
        page.on('console', msg => {
            if (msg.type() === 'log') {
                consoleMessages.push(msg.text());
            }
        });

        // Wait for the sort operation to complete
        await page.waitForTimeout(100); // Adjust timeout as necessary

        // Check that the sorted list is logged as empty
        expect(consoleMessages).toContain("Sorted List: []");
    });

    test('should handle single element list', async ({ page }) => {
        // Modify the originalList to contain a single element
        await page.evaluate(() => {
            window.originalList = ['apple'];
            console.log('Sorted List:', window.originalList);
        });

        // Click the sort button
        await page.click('#sort-button');

        // Check that the sorted list is logged correctly
        const consoleMessages = [];
        page.on('console', msg => {
            if (msg.type() === 'log') {
                consoleMessages.push(msg.text());
            }
        });

        // Wait for the sort operation to complete
        await page.waitForTimeout(100); // Adjust timeout as necessary

        // Check that the sorted list is logged as the same single element
        expect(consoleMessages).toContain("Sorted List: ['apple']");
    });
});