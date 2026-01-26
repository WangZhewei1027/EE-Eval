import { test, expect } from '@playwright/test';

const url = 'http://127.0.0.1:5500/workspace/0126-test-2/html/cb00a170-fa71-11f0-b5fe-49eb673a8a43.html';

test.describe('Bubble Sort Interactive Application', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the application page before each test
        await page.goto(url);
    });

    test('Initial state should be Idle', async ({ page }) => {
        // Verify that the demo is not visible initially
        const demoDiv = await page.locator('#demo');
        const displayStyle = await demoDiv.evaluate(el => el.style.display);
        expect(displayStyle).toBe('none');
    });

    test('Clicking the button shows the Bubble Sort demonstration', async ({ page }) => {
        // Click the button to show the demo
        await page.click('button[onclick="displayDemo()"]');

        // Verify that the demo is now visible
        const demoDiv = await page.locator('#demo');
        const displayStyle = await demoDiv.evaluate(el => el.style.display);
        expect(displayStyle).toBe('block');
    });

    test('Clicking the button again hides the Bubble Sort demonstration', async ({ page }) => {
        // Click the button to show the demo
        await page.click('button[onclick="displayDemo()"]');
        
        // Click the button again to hide the demo
        await page.click('button[onclick="displayDemo()"]');

        // Verify that the demo is hidden again
        const demoDiv = await page.locator('#demo');
        const displayStyle = await demoDiv.evaluate(el => el.style.display);
        expect(displayStyle).toBe('none');
    });

    test('Check console for errors when interacting with the application', async ({ page }) => {
        // Listen for console messages
        const consoleMessages = [];
        page.on('console', msg => consoleMessages.push(msg.text()));

        // Click the button to show the demo
        await page.click('button[onclick="displayDemo()"]');
        
        // Check for any errors in the console
        const errors = consoleMessages.filter(msg => msg.includes('Error'));
        expect(errors.length).toBe(0; // Expect no errors to be logged
    });

    test('Verify DOM changes on button click', async ({ page }) => {
        // Click the button to show the demo
        await page.click('button[onclick="displayDemo()"]');

        // Check if the demo div is visible
        const demoDiv = await page.locator('#demo');
        const isVisible = await demoDiv.isVisible();
        expect(isVisible).toBe(true);

        // Click the button again to hide the demo
        await page.click('button[onclick="displayDemo()"]');

        // Check if the demo div is hidden
        const isHidden = await demoDiv.isHidden();
        expect(isHidden).toBe(true);
    });

    test('Check for ReferenceError when calling undefined function', async ({ page }) => {
        // This test is expected to throw a ReferenceError
        const [error] = await Promise.all([
            page.evaluate(() => {
                try {
                    // Attempt to call a non-existent function
                    nonExistentFunction();
                } catch (e) {
                    return e;
                }
            }),
            page.waitForTimeout(1000) // Wait for a moment to ensure the error is caught
        ]);
        expect(error).toBeInstanceOf(ReferenceError);
    });

    test('Check for SyntaxError in the script', async ({ page }) => {
        // This test is expected to throw a SyntaxError
        const [error] = await Promise.all([
            page.evaluate(() => {
                try {
                    // Intentionally create a syntax error
                    eval('var a = ;');
                } catch (e) {
                    return e;
                }
            }),
            page.waitForTimeout(1000) // Wait for a moment to ensure the error is caught
        ]);
        expect(error).toBeInstanceOf(SyntaxError);
    });
});