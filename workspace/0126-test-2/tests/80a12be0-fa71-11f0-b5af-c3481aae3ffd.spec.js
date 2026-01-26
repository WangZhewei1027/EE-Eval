import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-test-2/html/80a12be0-fa71-11f0-b5af-c3481aae3ffd.html';

test.describe('Bubble Sort Visualization Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Load the application page before each test
        await page.goto(BASE_URL);
    });

    test('Initial state - Idle', async ({ page }) => {
        // Verify the initial state of the application
        const startSortButton = await page.locator('#startSort');
        const stopSortButton = await page.locator('#stopSort');
        
        await expect(startSortButton).toBeDisabled();
        await expect(stopSortButton).toBeDisabled();
    });

    test('Generate Array - Transition to Array Generated', async ({ page }) => {
        // Click the generate array button and check the transition
        await page.click('#generateArray');
        
        const arrayDisplay = await page.locator('#arrayDisplay');
        await expect(arrayDisplay).not.toHaveText('');
        
        const startSortButton = await page.locator('#startSort');
        const stopSortButton = await page.locator('#stopSort');
        
        await expect(startSortButton).toBeEnabled();
        await expect(stopSortButton).toBeEnabled();
    });

    test('Start Sorting - Transition to Sorting', async ({ page }) => {
        // Generate an array first
        await page.click('#generateArray');
        
        // Start sorting the array
        await page.click('#startSort');
        
        const stopSortButton = await page.locator('#stopSort');
        await expect(stopSortButton).toBeEnabled();
        
        // Check if sorting is in progress
        await expect(page.locator('#arrayDisplay')).toHaveText(/^\d+$/); // Check if numbers are displayed
    });

    test('Stop Sorting - Transition back to Idle', async ({ page }) => {
        // Generate an array and start sorting
        await page.click('#generateArray');
        await page.click('#startSort');
        
        // Stop sorting
        await page.click('#stopSort');
        
        const stopSortButton = await page.locator('#stopSort');
        await expect(stopSortButton).toBeEnabled();
        
        // Verify alert message
        page.on('dialog', async dialog => {
            expect(dialog.message()).toBe('Sorting stopped.');
            await dialog.dismiss();
        });
    });

    test('Start Sorting on Already Sorted Array', async ({ page }) => {
        // Generate an array and sort it
        await page.click('#generateArray');
        await page.click('#startSort');
        
        // Stop sorting to simulate already sorted state
        await page.click('#stopSort');
        
        // Start sorting again
        await page.click('#startSort');
        
        // Verify alert message
        page.on('dialog', async dialog => {
            expect(dialog.message()).toBe('Array is already sorted. Generate a new array to sort again.');
            await dialog.dismiss();
        });
    });

    test('Sorting Completes - Transition to Sorted', async ({ page }) => {
        // Generate an array and start sorting
        await page.click('#generateArray');
        await page.click('#startSort');
        
        // Wait for sorting to complete
        await page.waitForTimeout(5000); // Adjust timeout based on sorting speed
        
        // Verify sorting complete alert
        page.on('dialog', async dialog => {
            expect(dialog.message()).toBe('Sorting complete!');
            await dialog.dismiss();
        });
    });

    test('Generate Array with Invalid Size', async ({ page }) => {
        // Set an invalid size and attempt to generate an array
        await page.fill('#arraySize', '1'); // Invalid size
        await page.click('#generateArray');
        
        // Verify that the array is not generated
        const arrayDisplay = await page.locator('#arrayDisplay');
        await expect(arrayDisplay).toHaveText('');
    });

    test('Stop Sorting without Starting', async ({ page }) => {
        // Attempt to stop sorting without starting
        await page.click('#stopSort');
        
        // Verify alert message
        page.on('dialog', async dialog => {
            expect(dialog.message()).toBe('Sorting stopped.');
            await dialog.dismiss();
        });
    });
});