import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-test-2/html/446dda20-fa6b-11f0-96b1-f9ebc4471305.html';

test.describe('Bubble Sort Visualization', () => {
    test.beforeEach(async ({ page }) => {
        // Load the application before each test
        await page.goto(BASE_URL);
    });

    test('Initial state should generate an array', async ({ page }) => {
        // Validate that an array is generated on initial load
        const bars = await page.$$('#array-container .bar');
        expect(bars.length).toBeGreaterThan(0); // Ensure at least one bar is rendered
    });

    test('Clicking "Generate New Array" should create a new array', async ({ page }) => {
        // Click the generate button
        await page.click('#generate');
        
        // Validate that a new array is generated
        const initialBars = await page.$$('#array-container .bar');
        await page.click('#generate'); // Click again to generate a new array
        const newBars = await page.$$('#array-container .bar');
        
        expect(newBars.length).toBeGreaterThan(0); // Ensure new bars are rendered
        expect(initialBars.length).not.toEqual(newBars.length); // Ensure the array size changes
    });

    test('Clicking "Start Sorting" should trigger bubble sort', async ({ page }) => {
        // Generate a new array first
        await page.click('#generate');
        
        // Click the start button
        await page.click('#start');
        
        // Validate that sorting is in progress by checking the color change of bars
        const bars = await page.$$('#array-container .bar');
        const initialColor = await bars[0].evaluate(el => el.style.backgroundColor);
        
        // Wait for a short duration to allow sorting to start
        await page.waitForTimeout(200); 
        
        const currentColor = await bars[0].evaluate(el => el.style.backgroundColor);
        expect(currentColor).not.toEqual(initialColor); // Ensure the color has changed indicating sorting
    });

    test('Clicking "Start Sorting" without generating an array should still work', async ({ page }) => {
        // Click the start button without generating a new array
        await page.click('#start');
        
        // Validate that sorting is attempted
        const bars = await page.$$('#array-container .bar');
        expect(bars.length).toBeGreaterThan(0); // Ensure there are bars to sort
    });

    test('Error handling when clicking "Start Sorting" multiple times', async ({ page }) => {
        // Generate a new array and start sorting
        await page.click('#generate');
        await page.click('#start');
        
        // Click start again while sorting
        await page.click('#start');
        
        // Validate that no errors are thrown in the console
        page.on('console', msg => {
            if (msg.type() === 'error') {
                throw new Error('Error occurred during sorting');
            }
        });
        
        // Wait for a short duration to allow sorting to continue
        await page.waitForTimeout(200);
    });

    test('Check console errors when the application is loaded', async ({ page }) => {
        // Listen for console errors
        let errorOccurred = false;
        page.on('console', msg => {
            if (msg.type() === 'error') {
                errorOccurred = true;
            }
        });

        // Validate that no errors are thrown on initial load
        await page.waitForTimeout(100); // Allow time for potential errors to be logged
        expect(errorOccurred).toBe(false);
    });
});