import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cea952-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the Selection Sort Visualizer
class SelectionSortPage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
        this.consoleMessages = [];
        this.pageErrors = [];

        // Attach listeners to capture console messages and uncaught page errors
        this.page.on('console', msg => {
            try {
                // Some console messages may not have text(), guard against exceptions
                this.consoleMessages.push(msg.text());
            } catch (e) {
                this.consoleMessages.push(String(msg));
            }
        });
        this.page.on('pageerror', error => {
            this.pageErrors.push(error);
        });
    }

    async goto() {
        await this.page.goto(APP_URL);
    }

    async fillInput(value) {
        await this.page.fill('#arrayInput', value);
    }

    async clickGenerate() {
        await this.page.click('#generateArray');
    }

    async clickStart() {
        await this.page.click('#startSort');
    }

    async clickReset() {
        await this.page.click('#reset');
    }

    async getInputValue() {
        return await this.page.$eval('#arrayInput', el => el.value);
    }

    async getBars() {
        return await this.page.$$('#arrayContainer .bar');
    }

    // Returns the numeric values represented by the bar heights (height / 5)
    async getBarValues() {
        const bars = await this.getBars();
        const values = [];
        for (const bar of bars) {
            const height = await bar.evaluate(el => el.style.height);
            // height is like "34px" or "NaNpx"
            const numeric = parseFloat(height);
            // Convert pixel height back to original number by dividing by 5
            if (Number.isNaN(numeric)) {
                values.push(NaN);
            } else {
                values.push(numeric / 5);
            }
        }
        return values;
    }

    async isArrayContainerEmpty() {
        const html = await this.page.$eval('#arrayContainer', el => el.innerHTML);
        return html.trim() === '';
    }

    // Utility: wait for some time (ms)
    async wait(ms) {
        await this.page.waitForTimeout(ms);
    }
}

test.describe('Selection Sort Visualizer (FSM validation) - 99cea952-fa79-11f0-8075-e54a10595dde', () => {
    let selectionPage;

    test.beforeEach(async ({ page }) => {
        selectionPage = new SelectionSortPage(page);
        await selectionPage.goto();
    });

    // Test S0: Idle state - initial render and controls presence
    test('S0_Idle: Page loads with controls and empty visualization (Idle state)', async ({ page }) => {
        // Validate that input and buttons are present
        await expect(page.locator('#arrayInput')).toBeVisible();
        await expect(page.locator('#generateArray')).toBeVisible();
        await expect(page.locator('#startSort')).toBeVisible();
        await expect(page.locator('#reset')).toBeVisible();

        // Validate placeholder text as evidence of the input component
        const placeholder = await page.$eval('#arrayInput', el => el.getAttribute('placeholder'));
        expect(placeholder).toBe('e.g. 34,7,23,32,5');

        // Validate array container is empty on initial render
        const empty = await selectionPage.isArrayContainerEmpty();
        expect(empty).toBe(true);

        // Observe console and page errors: assert there were no uncaught errors on load
        expect(selectionPage.pageErrors.length).toBe(0);
    });

    // Test transition S0 -> S1: GenerateArray event
    test('GenerateArray: entering S1_ArrayGenerated renders bars corresponding to input', async () => {
        // Provide a valid input and click generate
        await selectionPage.fillInput('34,7,23');
        await selectionPage.clickGenerate();

        // After renderArray() we expect three bars to be present
        const bars = await selectionPage.getBars();
        expect(bars.length).toBe(3);

        // Heights should match numbers * 5 px
        const values = await selectionPage.getBarValues();
        expect(values).toEqual([34, 7, 23]);

        // No uncaught page errors
        expect(selectionPage.pageErrors.length).toBe(0);
    });

    // Edge case: start sorting when no array generated should alert the user (S0 -> S2 guard)
    test('StartSort with empty array should show alert and not start sorting (edge case)', async ({ page }) => {
        // Ensure input and container are empty
        await selectionPage.fillInput('');
        const emptyBefore = await selectionPage.isArrayContainerEmpty();
        expect(emptyBefore).toBe(true);

        // Listen for dialog and assert message
        const dialogPromise = new Promise(resolve => {
            page.once('dialog', async dialog => {
                try {
                    expect(dialog.message()).toBe('Please generate an array first.');
                } finally {
                    await dialog.accept();
                    resolve(true);
                }
            });
        });

        // Click start sort - should trigger alert
        await selectionPage.clickStart();

        // Wait for dialog to be handled
        await dialogPromise;

        // Ensure still no bars rendered
        const emptyAfter = await selectionPage.isArrayContainerEmpty();
        expect(emptyAfter).toBe(true);

        // No uncaught page errors
        expect(selectionPage.pageErrors.length).toBe(0);
    });

    // Test S1 -> S2: StartSort after generating begins sorting and eventually sorts array
    test('StartSort after GenerateArray begins Sorting (SelectionSort) and completes (S1 -> S2 -> sorted)', async () => {
        // Use a small array to observe sorting completion deterministically
        await selectionPage.fillInput('3,1,2');
        await selectionPage.clickGenerate();

        // Verify initial rendered values
        let vals = await selectionPage.getBarValues();
        expect(vals).toEqual([3, 1, 2]);

        // Start sorting
        await selectionPage.clickStart();

        // Wait sufficient time for the selection sort to finish for n=3
        // The interval runs every 500ms and performs steps; wait 4 seconds to allow completion
        await selectionPage.wait(4000);

        // After sorting completes, expect the bars to be in ascending order [1,2,3]
        const finalVals = await selectionPage.getBarValues();

        // Because of potential quirks, ensure finalVals are numbers and sorted
        expect(finalVals.length).toBe(3);
        expect(finalVals[0]).toBeCloseTo(1, 6);
        expect(finalVals[1]).toBeCloseTo(2, 6);
        expect(finalVals[2]).toBeCloseTo(3, 6);

        // No uncaught page errors during sorting
        expect(selectionPage.pageErrors.length).toBe(0);
    });

    // Test Reset during Sorting (S2 -> S3): clearInterval and clear visualization/input
    test('Reset during Sorting clears interval, empties input and arrayContainer (S2 -> S3)', async ({ page }) => {
        // Generate an array and start sorting
        await selectionPage.fillInput('5,2,4');
        await selectionPage.clickGenerate();

        // Start sorting
        await selectionPage.clickStart();

        // Wait a short time to ensure sorting has started (one interval tick)
        await selectionPage.wait(600);

        // Click reset while sorting is ongoing
        await selectionPage.clickReset();

        // Immediately verify input cleared (evidence of S3 entry action)
        const inputValue = await selectionPage.getInputValue();
        expect(inputValue).toBe('');

        // Verify arrayContainer cleared
        const isEmpty = await selectionPage.isArrayContainerEmpty();
        expect(isEmpty).toBe(true);

        // Wait additional time to ensure no further rendering occurs (interval should be cleared)
        await selectionPage.wait(1500);

        // Confirm still empty and no new bars appear
        const stillEmpty = await selectionPage.isArrayContainerEmpty();
        expect(stillEmpty).toBe(true);

        // No uncaught page errors
        expect(selectionPage.pageErrors.length).toBe(0);
    });

    // Edge case: invalid input values produce NaN heights - assert behavior without repairing code
    test('GenerateArray with invalid/non-numeric input creates bars with NaN heights (observed behavior)', async () => {
        await selectionPage.fillInput('a,b');
        await selectionPage.clickGenerate();

        // Expect two bars present despite invalid numbers
        const bars = await selectionPage.getBars();
        expect(bars.length).toBe(2);

        // Bar values should include NaN since Number('a') === NaN
        const vals = await selectionPage.getBarValues();
        expect(vals.length).toBe(2);
        // At least one should be NaN
        const hasNaN = vals.some(v => Number.isNaN(v));
        expect(hasNaN).toBe(true);

        // No uncaught page errors from this rendering step
        expect(selectionPage.pageErrors.length).toBe(0);
    });

    // Final test: observe console messages and uncaught errors over typical flows
    test('Observe console logs and page errors while performing typical interactions', async ({ page }) => {
        // Perform a typical flow: generate, start, reset
        await selectionPage.fillInput('2,3,1');
        await selectionPage.clickGenerate();

        // Start sorting and then reset quickly
        await selectionPage.clickStart();
        await selectionPage.wait(700);
        await selectionPage.clickReset();

        // Give the page a moment to emit console messages or errors if any
        await selectionPage.wait(200);

        // Assert that we collected console messages array (could be empty) - verify it's an array
        expect(Array.isArray(selectionPage.consoleMessages)).toBe(true);

        // Assert there are no uncaught page errors during the flow
        // If there were uncaught exceptions, they'd be captured in selectionPage.pageErrors
        expect(selectionPage.pageErrors.length).toBe(0);
    });
});