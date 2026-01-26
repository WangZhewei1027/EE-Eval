import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-test/html/9acba190-fa66-11f0-a455-3d3607d50364.html';

test.describe('Bubble Sort Application Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Load the Bubble Sort application page before each test
        await page.goto(BASE_URL);
    });

    test('Initial state is Idle', async ({ page }) => {
        // Verify that the initial state is Idle
        const dataContent = await page.locator('#data').innerHTML();
        expect(dataContent).toBe('');
    });

    test('Bubble Sort transitions to Sorted state', async ({ page }) => {
        // Check console logs for original and sorted array
        const originalArray = [5, 3, 8, 4, 2];
        await page.evaluate((arr) => {
            document.getElementById('data').innerHTML = JSON.stringify(arr);
        }, originalArray);

        // Listen for console messages
        const consoleMessages = [];
        page.on('console', msg => consoleMessages.push(msg.text()));

        // Trigger the sorting process
        await page.evaluate(() => {
            let arr = JSON.parse(document.getElementById('data').innerHTML);
            arr = bubbleSort(arr); // This should trigger the sorting
            document.getElementById('data').innerHTML = JSON.stringify(arr);
        });

        // Verify that the console logs show the correct original and sorted arrays
        expect(consoleMessages).toContain('Original array: [5,3,8,4,2]');
        expect(consoleMessages).toContain('Sorted array: [2,3,4,5,8]');

        // Verify that the state has transitioned to Sorted
        const sortedDataContent = await page.locator('#data').innerHTML();
        expect(sortedDataContent).toBe(JSON.stringify([2, 3, 4, 5, 8]));
    });

    test('Handles empty array', async ({ page }) => {
        // Check console logs for sorting an empty array
        const emptyArray = [];
        await page.evaluate((arr) => {
            document.getElementById('data').innerHTML = JSON.stringify(arr);
        }, emptyArray);

        // Listen for console messages
        const consoleMessages = [];
        page.on('console', msg => consoleMessages.push(msg.text()));

        // Trigger the sorting process
        await page.evaluate(() => {
            let arr = JSON.parse(document.getElementById('data').innerHTML);
            arr = bubbleSort(arr); // This should trigger the sorting
            document.getElementById('data').innerHTML = JSON.stringify(arr);
        });

        // Verify that the console logs show the correct original and sorted arrays
        expect(consoleMessages).toContain('Original array: []');
        expect(consoleMessages).toContain('Sorted array: []');

        // Verify that the state has transitioned to Sorted
        const sortedDataContent = await page.locator('#data').innerHTML();
        expect(sortedDataContent).toBe(JSON.stringify([]));
    });

    test('Handles single element array', async ({ page }) => {
        // Check console logs for sorting a single element array
        const singleElementArray = [42];
        await page.evaluate((arr) => {
            document.getElementById('data').innerHTML = JSON.stringify(arr);
        }, singleElementArray);

        // Listen for console messages
        const consoleMessages = [];
        page.on('console', msg => consoleMessages.push(msg.text()));

        // Trigger the sorting process
        await page.evaluate(() => {
            let arr = JSON.parse(document.getElementById('data').innerHTML);
            arr = bubbleSort(arr); // This should trigger the sorting
            document.getElementById('data').innerHTML = JSON.stringify(arr);
        });

        // Verify that the console logs show the correct original and sorted arrays
        expect(consoleMessages).toContain('Original array: [42]');
        expect(consoleMessages).toContain('Sorted array: [42]');

        // Verify that the state has transitioned to Sorted
        const sortedDataContent = await page.locator('#data').innerHTML();
        expect(sortedDataContent).toBe(JSON.stringify([42]));
    });

    test('Handles already sorted array', async ({ page }) => {
        // Check console logs for sorting an already sorted array
        const sortedArray = [1, 2, 3, 4, 5];
        await page.evaluate((arr) => {
            document.getElementById('data').innerHTML = JSON.stringify(arr);
        }, sortedArray);

        // Listen for console messages
        const consoleMessages = [];
        page.on('console', msg => consoleMessages.push(msg.text()));

        // Trigger the sorting process
        await page.evaluate(() => {
            let arr = JSON.parse(document.getElementById('data').innerHTML);
            arr = bubbleSort(arr); // This should trigger the sorting
            document.getElementById('data').innerHTML = JSON.stringify(arr);
        });

        // Verify that the console logs show the correct original and sorted arrays
        expect(consoleMessages).toContain('Original array: [1,2,3,4,5]');
        expect(consoleMessages).toContain('Sorted array: [1,2,3,4,5]');

        // Verify that the state has transitioned to Sorted
        const sortedDataContent = await page.locator('#data').innerHTML();
        expect(sortedDataContent).toBe(JSON.stringify([1, 2, 3, 4, 5]));
    });
});