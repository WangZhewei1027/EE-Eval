import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324d5fc2-fa73-11f0-a9d0-d7a1991987c6.html';

// Page object to encapsulate interactions with the Counting Sort page
class CountingSortPage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
        this.consoleErrors = [];
        this.pageErrors = [];
    }

    async goto() {
        // Attach error collectors before navigation to catch load-time issues
        this.page.on('console', msg => {
            if (msg.type() === 'error') {
                this.consoleErrors.push(msg.text());
            }
        });
        this.page.on('pageerror', err => {
            this.pageErrors.push(err);
        });
        await this.page.goto(APP_URL);
    }

    async setInput(value) {
        const input = this.page.locator('#inputArray');
        await input.fill('');
        // Use type to simulate user entering values more realistically
        await input.type(value);
    }

    async clickSort() {
        // Click the button that triggers performCountingSort()
        await this.page.click('button[onclick="performCountingSort()"]');
    }

    // Returns numeric values shown inside .bar elements of a container
    async getBarValues(containerId) {
        return await this.page.$$eval(`#${containerId} .bar`, bars =>
            bars.map(b => {
                const n = Number(b.textContent);
                // If parsing fails, return NaN to make assertions explicit
                return Number.isNaN(n) ? NaN : n;
            })
        );
    }

    // Returns CSS height values (in px) for bars in container
    async getBarHeights(containerId) {
        return await this.page.$$eval(`#${containerId} .bar`, bars =>
            bars.map(b => window.getComputedStyle(b).height)
        );
    }

    async countBars(containerId) {
        return await this.page.$$eval(`#${containerId} .bar`, bars => bars.length);
    }

    // Helper to wait for at least one bar in a container (or timeout)
    async waitForBars(containerId, timeout = 2000) {
        await this.page.waitForSelector(`#${containerId} .bar`, { timeout });
    }

    // Expose collected errors for assertions
    getConsoleErrors() {
        return this.consoleErrors.slice();
    }

    getPageErrors() {
        return this.pageErrors.slice();
    }
}

test.describe('Counting Sort Visualization - FSM validation and behaviors', () => {
    // Recreate page object per test using Playwright's fixture
    test.describe.configure({ mode: 'serial' });

    test.beforeEach(async ({ page }) => {
        // Nothing global here; individual tests create their own PageObject and call goto()
    });

    test('S0_Idle: initial page renders input, Sort button, and empty array/output containers', async ({ page }) => {
        // Validate initial Idle state as per FSM S0_Idle
        const csPage = new CountingSortPage(page);
        await csPage.goto();

        // Input exists and has the default value from the HTML
        const input = page.locator('#inputArray');
        await expect(input).toBeVisible();
        await expect(input).toHaveValue('4,2,2,8,3,3,1');

        // Sort button exists and is interactive
        const sortButton = page.locator('button[onclick="performCountingSort()"]');
        await expect(sortButton).toBeVisible();
        await expect(sortButton).toBeEnabled();

        // arrayDiv and output exist and are initially empty (no .bar children)
        const arrayBars = page.locator('#arrayDiv .bar');
        const outputBars = page.locator('#output .bar');
        await expect(arrayBars).toHaveCount(0);
        await expect(outputBars).toHaveCount(0);

        // Ensure no console/page errors occurred during initial load
        expect(csPage.getConsoleErrors().length, 'No console errors on load').toBe(0);
        expect(csPage.getPageErrors().length, 'No page errors on load').toBe(0);
    });

    test('Transition: SortButtonClick displays original array in #arrayDiv and sorted array in #output', async ({ page }) => {
        // This validates transitions from S0 -> S1 and S1 -> S2 (implementation performs both on one click)
        const csPage = new CountingSortPage(page);
        await csPage.goto();

        // Click sort and then verify both original and sorted visualizations
        await csPage.clickSort();

        // Wait for original array bars and output bars to appear
        await csPage.waitForBars('arrayDiv');
        await csPage.waitForBars('output');

        // Grab displayed values
        const originalValues = await csPage.getBarValues('arrayDiv');
        const outputValues = await csPage.getBarValues('output');

        // Original should reflect the input value by order
        expect(originalValues).toEqual([4, 2, 2, 8, 3, 3, 1]);

        // Output should be sorted ascending
        const sortedCopy = [...originalValues].sort((a, b) => a - b);
        expect(outputValues).toEqual(sortedCopy);

        // Validate visual feedback: each bar height equals number * 10 px (as per CSS style set in displayArray)
        const heights = await csPage.getBarHeights('arrayDiv');
        for (let i = 0; i < originalValues.length; i++) {
            const expectedPx = `${originalValues[i] * 10}px`;
            expect(heights[i]).toBe(expectedPx);
        }

        // Confirm no runtime errors occurred during this normal interaction
        expect(csPage.getConsoleErrors().length, 'No console errors after valid sort').toBe(0);
        expect(csPage.getPageErrors().length, 'No page errors after valid sort').toBe(0);
    });

    test('Sorting with a custom input sorts correctly and updates DOM appropriately', async ({ page }) => {
        // Validate sorting correctness for a different input set and DOM update behavior
        const csPage = new CountingSortPage(page);
        await csPage.goto();

        // Use a custom unsorted array
        await csPage.setInput('5,3,4,1');
        await csPage.clickSort();

        await csPage.waitForBars('arrayDiv');
        await csPage.waitForBars('output');

        const originalValues = await csPage.getBarValues('arrayDiv');
        const outputValues = await csPage.getBarValues('output');

        expect(originalValues).toEqual([5, 3, 4, 1]);

        // Output must be ascending [1,3,4,5]
        expect(outputValues).toEqual([1, 3, 4, 5]);

        // Verify number of bars equals array length for both containers
        const arrayCount = await csPage.countBars('arrayDiv');
        const outputCount = await csPage.countBars('output');
        expect(arrayCount).toBe(4);
        expect(outputCount).toBe(4);

        // No runtime errors expected for valid numeric input
        expect(csPage.getConsoleErrors().length).toBe(0);
        expect(csPage.getPageErrors().length).toBe(0);
    });

    test('Edge case: empty input string should be handled without uncaught errors (treated as [0])', async ({ page }) => {
        // Empty input -> ''.split(',') -> [''] -> Number('') === 0, so array [0]
        const csPage = new CountingSortPage(page);
        await csPage.goto();

        await csPage.setInput(''); // empty input
        await csPage.clickSort();

        // Expect a single bar representing 0 in both original and output
        await csPage.waitForBars('arrayDiv');
        await csPage.waitForBars('output');

        const originalValues = await csPage.getBarValues('arrayDiv');
        const outputValues = await csPage.getBarValues('output');

        expect(originalValues).toEqual([0]);
        expect(outputValues).toEqual([0]);

        // Height should be 0px (0 * 10)
        const height = (await csPage.getBarHeights('arrayDiv'))[0];
        expect(height).toBe('0px');

        // No runtime errors expected for this edge case
        expect(csPage.getConsoleErrors().length).toBe(0);
        expect(csPage.getPageErrors().length).toBe(0);
    });

    test('Error scenario: non-numeric input should produce a runtime error (observed via pageerror or console error)', async ({ page }) => {
        // Intentionally feed invalid data that will likely lead to a runtime exception in countingSort
        // The implementation uses Math.max(...array) and new Array(max + 1), which will throw if max is NaN.
        const csPage = new CountingSortPage(page);
        await csPage.goto();

        // Provide invalid values that map to NaN
        await csPage.setInput('a,b,c');
        
        // Clear any previously collected errors for clean assertion
        csPage.consoleErrors = [];
        csPage.pageErrors = [];

        // Click sort and then give the page a moment to surface errors
        await csPage.clickSort();

        // Small wait to allow synchronous errors to bubble up to event handlers
        await page.waitForTimeout(200);

        const consoleErrs = csPage.getConsoleErrors();
        const pageErrs = csPage.getPageErrors();

        // At least one error is expected in this scenario (RangeError or similar)
        const detectedErrorCount = consoleErrs.length + pageErrs.length;
        expect(detectedErrorCount, `Expected runtime error(s) for invalid input, got console:${consoleErrs.length} page:${pageErrs.length}`).toBeGreaterThan(0);

        // Log the first error messages for debugging if available (non-fatal in test output)
        if (consoleErrs.length) {
            // Ensure we capture evidence that an error was logged to console
            expect(consoleErrs[0].length).toBeGreaterThan(0);
        }
        if (pageErrs.length) {
            // The error object should have a message
            expect(String(pageErrs[0].message || pageErrs[0])).toBeTruthy();
        }
    });

    test('Robustness: multiple clicks do not cause unexpected crashes or duplicate severe errors', async ({ page }) => {
        // Ensure the UI remains stable across repeated interactions
        const csPage = new CountingSortPage(page);
        await csPage.goto();

        // Reset any errors and perform repeated clicks with valid input
        await csPage.setInput('2,1,3');
        csPage.consoleErrors = [];
        csPage.pageErrors = [];

        // Click the sort button multiple times
        await csPage.clickSort();
        await page.waitForTimeout(50);
        await csPage.clickSort();
        await page.waitForTimeout(50);
        await csPage.clickSort();

        // After multiple valid interactions, verify output is still correct
        await csPage.waitForBars('output');
        const outputValues = await csPage.getBarValues('output');
        expect(outputValues).toEqual([1, 2, 3]);

        // There should be no uncaught errors after repeated valid interactions
        expect(csPage.getConsoleErrors().length).toBe(0);
        expect(csPage.getPageErrors().length).toBe(0);
    });
});