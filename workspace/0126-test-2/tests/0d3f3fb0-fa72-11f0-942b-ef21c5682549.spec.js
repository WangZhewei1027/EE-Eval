import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-test-2/html/0d3f3fb0-fa72-11f0-942b-ef21c5682549.html';

test.describe('Bubble Sort Visualization Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the Bubble Sort Visualization page before each test
        await page.goto(BASE_URL);
    });

    test('Initial state should display a generated array', async ({ page }) => {
        // Verify that the initial array is displayed
        const bars = await page.locator('#array .bar');
        expect(await bars.count()).toBe(10); // Expect 10 bars for the initial array
    });

    test('Clicking "Start Bubble Sort" should transition to sorting state', async ({ page }) => {
        // Click the start button
        await page.click('button[onclick="startBubbleSort()"]');

        // Verify that the sorting process has started
        const bars = await page.locator('#array .bar');
        expect(await bars.count()).toBe(10); // Expect 10 bars to still be present

        // Wait for a short duration to allow sorting to process
        await page.waitForTimeout(1000);
        
        // Check if the array is sorted (not strictly necessary, but for validation)
        const values = await bars.evaluateAll(bars => bars.map(bar => parseInt(bar.innerText)));
        const isSorted = values.every((v, i, a) => !i || (v >= a[i - 1]));
        expect(isSorted).toBe(true);
    });

    test('Sorting visual feedback should show swapping bars', async ({ page }) => {
        // Click the start button
        await page.click('button[onclick="startBubbleSort()"]');

        // Wait for the sorting to start
        await page.waitForTimeout(1000);

        // Check if any bars have the 'swapping' class
        const swappingBars = await page.locator('#array .bar.swapping');
        expect(await swappingBars.count()).toBeGreaterThan(0); // Expect some bars to be swapping
    });

    test('Error handling when sorting with an empty array', async ({ page }) => {
        // Manually clear the array for this test
        await page.evaluate(() => {
            const arrayContainer = document.getElementById('array');
            arrayContainer.innerHTML = ''; // Clear the array
        });

        // Attempt to start sorting
        await page.click('button[onclick="startBubbleSort()"]');

        // Check for console errors
        page.on('console', msg => {
            if (msg.type() === 'error') {
                expect(msg.text()).toContain('TypeError'); // Expect a TypeError due to empty array
            }
        });

        // Wait for a short duration to allow for any potential errors to be logged
        await page.waitForTimeout(1000);
    });

    test('State transition should not occur if button is not clicked', async ({ page }) => {
        // Check that the sorting state is not active without clicking the button
        const bars = await page.locator('#array .bar');
        expect(await bars.count()).toBe(10); // Expect 10 bars to be present initially

        // Wait and check that no sorting has occurred
        await page.waitForTimeout(1000);
        const swappingBars = await page.locator('#array .bar.swapping');
        expect(await swappingBars.count()).toBe(0); // Expect no bars to be swapping
    });
});