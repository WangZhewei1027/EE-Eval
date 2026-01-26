import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-test-2/html/4e8ceb10-fa6e-11f0-b568-a7d3d00c46fe.html';

test.describe('Bubble Sort Visualization Tests', () => {
    let page;

    test.beforeAll(async ({ browser }) => {
        page = await browser.newPage();
        await page.goto(BASE_URL);
    });

    test.afterAll(async () => {
        await page.close();
    });

    test('Initial state: Idle', async () => {
        // Verify that the initial array is generated and displayed
        const bars = await page.$$('#arrayContainer .bar');
        expect(bars.length).toBe(10); // Check that 10 bars are created
    });

    test('Start sorting: Transition from Idle to Sorting', async () => {
        // Click the start sort button
        await page.click('#startSort');

        // Verify that the sorting process has started
        const activeBars = await page.$$('.bar.active');
        expect(activeBars.length).toBeGreaterThan(0); // At least one bar should be active
    });

    test('Sorting process: Transition from Sorting to Sorted', async () => {
        // Wait for the sorting to complete
        await page.waitForTimeout(2000); // Wait for a reasonable time for sorting to complete

        // Verify that all bars are marked as sorted
        const sortedBars = await page.$$('.bar.sorted');
        expect(sortedBars.length).toBe(10); // All bars should be sorted
    });

    test('Visual feedback during sorting', async () => {
        // Click the start sort button
        await page.click('#startSort');

        // Wait for some time to allow the sorting to progress
        await page.waitForTimeout(500); // Wait for a short time to observe the active bars

        // Check that there are active bars during sorting
        const activeBars = await page.$$('.bar.active');
        expect(activeBars.length).toBeGreaterThan(0); // At least one bar should be active
    });

    test('Error handling: Check for console errors', async () => {
        // Listen for console messages
        const consoleMessages = [];
        page.on('console', msg => consoleMessages.push(msg.text()));

        // Click the start sort button
        await page.click('#startSort');

        // Wait for sorting to complete
        await page.waitForTimeout(2000);

        // Check if any console errors occurred
        const errors = consoleMessages.filter(msg => msg.includes('Error'));
        expect(errors.length).toBe(0); // Ensure there are no console errors
    });
});