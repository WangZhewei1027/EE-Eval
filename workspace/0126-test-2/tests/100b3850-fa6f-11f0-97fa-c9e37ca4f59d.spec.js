import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-test-2/html/100b3850-fa6f-11f0-97fa-c9e37ca4f59d.html';

test.describe('Bubble Sort Visualization', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the application page before each test
        await page.goto(BASE_URL);
    });

    test('Initial state renders the array correctly', async ({ page }) => {
        // Validate that the initial render displays the array
        const bars = await page.locator('#arrayContainer .bar');
        expect(await bars.count()).toBe(8); // Check if there are 8 bars
    });

    test('Clicking Sort Array button transitions to Sorting state', async ({ page }) => {
        // Click the Sort Array button
        await page.click('button[onclick="bubbleSort()"]');
        
        // Wait for the sorting animation to complete
        await page.waitForTimeout(5000); // Wait for a reasonable time to observe sorting

        // Validate that the array is sorted visually
        const heights = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('#arrayContainer .bar')).map(bar => bar.offsetHeight);
        });

        const sortedHeights = [...heights].sort((a, b) => a - b);
        expect(heights).toEqual(sortedHeights); // Check if the heights are sorted
    });

    test('Clicking Sort Array button during sorting does not break the process', async ({ page }) => {
        // Start sorting
        await page.click('button[onclick="bubbleSort()"]');
        
        // Click the Sort Array button again while sorting
        await page.click('button[onclick="bubbleSort()"]');

        // Wait for the sorting animation to complete
        await page.waitForTimeout(5000); // Wait for a reasonable time to observe sorting

        // Validate that the array is still sorted
        const heights = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('#arrayContainer .bar')).map(bar => bar.offsetHeight);
        });

        const sortedHeights = [...heights].sort((a, b) => a - b);
        expect(heights).toEqual(sortedHeights); // Check if the heights are sorted
    });

    test('Check for console errors during sorting', async ({ page }) => {
        // Start sorting and listen for console errors
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });

        await page.click('button[onclick="bubbleSort()"]');
        await page.waitForTimeout(5000); // Wait for a reasonable time to observe sorting

        // Assert that no console errors occurred
        expect(consoleErrors.length).toBe(0);
    });

    test('Ensure DOM updates correctly after sorting', async ({ page }) => {
        // Start sorting
        await page.click('button[onclick="bubbleSort()"]');
        
        // Wait for the sorting animation to complete
        await page.waitForTimeout(5000); // Wait for a reasonable time to observe sorting

        // Validate that the array container has updated bars
        const bars = await page.locator('#arrayContainer .bar');
        expect(await bars.count()).toBe(8); // Check if there are still 8 bars
    });
});