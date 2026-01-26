import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-test-2/html/8a435360-fa6e-11f0-aefd-75a6f6ae020e.html';

test.describe('Bubble Sort Visualization Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the Bubble Sort Visualization page before each test
        await page.goto(BASE_URL);
    });

    test('Initial State - Random Array Generation', async ({ page }) => {
        // Validate that the initial state generates a random array
        const bars = await page.locator('#array-container .bar');
        expect(await bars.count()).toBeGreaterThan(0); // Ensure there are bars displayed
    });

    test('Sort Button Click - Transition to Sorting State', async ({ page }) => {
        // Click the Sort button and validate the sorting process
        await page.click('#sort-button');
        const bars = await page.locator('#array-container .bar');
        
        // Wait for sorting to complete (assuming it takes some time)
        await page.waitForTimeout(2000);
        
        // Check if the array is sorted
        const values = await bars.evaluateAll(bars => bars.map(bar => parseInt(bar.style.height) / 3));
        const sortedValues = [...values].sort((a, b) => a - b);
        expect(values).toEqual(sortedValues); // Ensure the array is sorted
    });

    test('Reset Button Click - Transition to Reset State', async ({ page }) => {
        // Click the Reset button and validate the reset process
        await page.click('#reset-button');
        const bars = await page.locator('#array-container .bar');
        
        // Ensure a new random array is generated
        expect(await bars.count()).toBeGreaterThan(0); // Ensure there are bars displayed
    });

    test('Reset Button Click - Transition from Initial State', async ({ page }) => {
        // Click the Reset button when already in the initial state
        await page.click('#reset-button');
        const bars = await page.locator('#array-container .bar');
        
        // Ensure a new random array is generated
        expect(await bars.count()).toBeGreaterThan(0); // Ensure there are bars displayed
    });

    test('Sort Button Click - Check Visual Feedback', async ({ page }) => {
        // Click the Sort button and check for visual feedback during sorting
        await page.click('#sort-button');
        const initialBars = await page.locator('#array-container .bar');
        
        // Wait for a short duration to observe changes
        await page.waitForTimeout(500);
        
        const updatedBars = await page.locator('#array-container .bar');
        expect(await updatedBars.count()).toBe(initialBars.count()); // Ensure the number of bars remains the same
    });

    test('Error Handling - Check for Console Errors', async ({ page }) => {
        // Listen for console errors
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });

        await page.goto(BASE_URL);
        await page.click('#sort-button'); // Trigger sorting which may cause errors
        await page.waitForTimeout(2000); // Wait for sorting to complete

        expect(consoleErrors.length).toBe(0; // Ensure no console errors occurred during sorting
    });
});