import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-test-2/html/b3b6bed0-fa6e-11f0-b0ef-5f442423b288.html';

test.describe('Bubble Sort Visualization Tests', () => {
    let page;

    test.beforeAll(async ({ browser }) => {
        page = await browser.newPage();
        await page.goto(BASE_URL);
    });

    test.afterAll(async () => {
        await page.close();
    });

    test('Initial state should render the array', async () => {
        // Validate that the initial state renders the array correctly
        const bars = await page.$$('#arrayContainer .bar');
        expect(bars.length).toBe(8); // Expect 8 bars for the initial array
    });

    test('Clicking "Start Bubble Sort" should transition to Sorting state', async () => {
        // Click the button to start the bubble sort
        await page.click('button[onclick="startBubbleSort()"]');
        
        // Wait for a moment to allow sorting to start
        await page.waitForTimeout(1000);

        // Check if the array is sorted
        const arrayValues = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('#arrayContainer .bar')).map(bar => parseInt(bar.style.height) / 40);
        });

        // Validate that the array is sorted
        const isSorted = arrayValues.every((value, index, arr) => index === 0 || value >= arr[index - 1]);
        expect(isSorted).toBe(true);
    });

    test('Bubble Sort should handle an empty array', async () => {
        // Modify the array to be empty and re-render
        await page.evaluate(() => {
            window.array = [];
            window.renderArray();
        });

        // Click the button to start the bubble sort
        await page.click('button[onclick="startBubbleSort()"]');

        // Validate that no bars are rendered
        const bars = await page.$$('#arrayContainer .bar');
        expect(bars.length).toBe(0); // Expect no bars for an empty array
    });

    test('Bubble Sort should handle a single-element array', async () => {
        // Modify the array to have one element and re-render
        await page.evaluate(() => {
            window.array = [5];
            window.renderArray();
        });

        // Click the button to start the bubble sort
        await page.click('button[onclick="startBubbleSort()"]');

        // Validate that one bar is rendered
        const bars = await page.$$('#arrayContainer .bar');
        expect(bars.length).toBe(1); // Expect one bar for a single element
    });

    test('Bubble Sort should handle already sorted array', async () => {
        // Modify the array to be sorted and re-render
        await page.evaluate(() => {
            window.array = [1, 2, 3, 4, 5, 6, 7, 8];
            window.renderArray();
        });

        // Click the button to start the bubble sort
        await page.click('button[onclick="startBubbleSort()"]');

        // Wait for a moment to allow sorting to start
        await page.waitForTimeout(1000);

        // Check if the array is still sorted
        const arrayValues = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('#arrayContainer .bar')).map(bar => parseInt(bar.style.height) / 40);
        });

        // Validate that the array is sorted
        const isSorted = arrayValues.every((value, index, arr) => index === 0 || value >= arr[index - 1]);
        expect(isSorted).toBe(true);
    });

    test('Bubble Sort should handle a reverse sorted array', async () => {
        // Modify the array to be reverse sorted and re-render
        await page.evaluate(() => {
            window.array = [8, 7, 6, 5, 4, 3, 2, 1];
            window.renderArray();
        });

        // Click the button to start the bubble sort
        await page.click('button[onclick="startBubbleSort()"]');

        // Wait for a moment to allow sorting to start
        await page.waitForTimeout(1000);

        // Check if the array is sorted
        const arrayValues = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('#arrayContainer .bar')).map(bar => parseInt(bar.style.height) / 40);
        });

        // Validate that the array is sorted
        const isSorted = arrayValues.every((value, index, arr) => index === 0 || value >= arr[index - 1]);
        expect(isSorted).toBe(true);
    });

    test('Check for console errors during sorting', async () => {
        // Listen for console errors
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });

        // Start sorting
        await page.click('button[onclick="startBubbleSort()"]');

        // Wait for a moment to allow sorting to start
        await page.waitForTimeout(1000);

        // Validate that there are no console errors
        expect(consoleErrors.length).toBe(0);
    });
});