import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-test/html/f2d4c7b0-fa64-11f0-b80e-5da67a37747e.html';

test.describe('Bubble Sort Visualization Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the Bubble Sort Visualization page before each test
        await page.goto(BASE_URL);
    });

    test('Initial state should render the array', async ({ page }) => {
        // Verify that the initial state renders the array
        const bars = await page.$$('#array-container .bar');
        expect(bars.length).toBeGreaterThan(0); // Ensure there are bars rendered
    });

    test('Clicking "Start Bubble Sort" button transitions to Sorting state', async ({ page }) => {
        // Click the button to start the sorting process
        await page.click('button[onclick="startBubbleSort()"]');

        // Check if the sorting process has started by observing the color change of the bars
        const bars = await page.$$('#array-container .bar');
        const initialColors = await Promise.all(bars.map(bar => bar.evaluate(el => el.style.backgroundColor)));

        // Wait for a brief moment to allow sorting to begin
        await page.waitForTimeout(500);

        // Verify that at least one bar has changed color to red indicating sorting is in progress
        const currentColors = await Promise.all(bars.map(bar => bar.evaluate(el => el.style.backgroundColor)));
        const hasRed = currentColors.some(color => color === 'red');
        expect(hasRed).toBe(true); // Expect at least one bar to be red
    });

    test('Sorting process should complete without errors', async ({ page }) => {
        // Click the button to start the sorting process
        await page.click('button[onclick="startBubbleSort()"]');

        // Wait for the sorting process to complete
        await page.waitForTimeout(3000); // Adjust timeout as necessary for the sort to complete

        // Check for any console errors during the sorting process
        const consoleErrors = await page.evaluate(() => {
            return window.console.error.calls;
        });
        expect(consoleErrors.length).toBe(0); // Expect no console errors
    });

    test('State transition should handle edge cases', async ({ page }) => {
        // Click the button to start the sorting process
        await page.click('button[onclick="startBubbleSort()"]');

        // Wait for a brief moment to allow sorting to begin
        await page.waitForTimeout(500);

        // Attempt to click the button again while sorting is in progress
        await page.click('button[onclick="startBubbleSort()"]');

        // Verify that the sorting process continues without interruption
        const bars = await page.$$('#array-container .bar');
        const currentColors = await Promise.all(bars.map(bar => bar.evaluate(el => el.style.backgroundColor)));
        const hasRed = currentColors.some(color => color === 'red');
        expect(hasRed).toBe(true); // Expect sorting to still be in progress
    });

    test('Check for console errors on page load', async ({ page }) => {
        // Listen for console errors
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });

        // Reload the page to check for errors
        await page.reload();

        // Verify that there are no console errors
        expect(consoleErrors.length).toBe(0); // Expect no console errors on load
    });
});