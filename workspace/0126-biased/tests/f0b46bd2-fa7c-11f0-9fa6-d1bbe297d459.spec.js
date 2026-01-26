import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b46bd2-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object for the demo page to encapsulate common interactions and queries
class DemoPage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
        this.button = page.locator('.demo-button');
        this.demoResults = page.locator('#demo-results');
        this.testResultsContainer = page.locator('#test-results');
        this.testCaseLocator = page.locator('.test-case');
    }

    async goto() {
        await this.page.goto(APP_URL);
    }

    async clickRunDemo() {
        await this.button.click();
    }

    async isDemoResultsVisible() {
        return this.demoResults.isVisible();
    }

    async getTestCasesCount() {
        return this.testCaseLocator.count();
    }

    async getTestCaseTexts() {
        const count = await this.getTestCasesCount();
        const texts = [];
        for (let i = 0; i < count; i++) {
            texts.push(await this.testCaseLocator.nth(i).innerText());
        }
        return texts;
    }

    async getTestCaseStatusClasses() {
        const statuses = [];
        const count = await this.getTestCasesCount();
        for (let i = 0; i < count; i++) {
            const el = this.testCaseLocator.nth(i).locator('strong').last();
            statuses.push({
                text: await el.innerText(),
                className: await el.getAttribute('class')
            });
        }
        return statuses;
    }

    async getButtonOnclickAttribute() {
        return this.page.locator('.demo-button').getAttribute('onclick');
    }

    async isRenderPageDefined() {
        return await this.page.evaluate(() => typeof window.renderPage !== 'undefined');
    }
}

test.describe('FSM validation and interactive tests for "Comprehensive Guide to Unit Testing"', () => {
    let consoleMessages = [];
    let pageErrors = [];

    // Setup listeners for console messages and page errors before each test.
    test.beforeEach(async ({ page }) => {
        consoleMessages = [];
        pageErrors = [];

        page.on('console', msg => {
            consoleMessages.push({
                type: msg.type(),
                text: msg.text()
            });
        });

        page.on('pageerror', err => {
            // Capture the error message for assertions
            pageErrors.push(err.message);
        });
    });

    // Test initial Idle state (S0_Idle)
    test('S0_Idle: initial render - button visible, demo results hidden, renderPage not defined', async ({ page }) => {
        const demo = new DemoPage(page);
        // Navigate to the page as-is
        await demo.goto();

        // Validate that the main heading is present to ensure the page loaded
        await expect(page.locator('h1')).toHaveText('Comprehensive Guide to Unit Testing');

        // The FSM's Idle state evidence includes the demo button - ensure it exists and is visible
        await expect(demo.button).toBeVisible();
        await expect(demo.button).toHaveText('Run Test Demonstration');

        // Verify the button has an onclick attribute that references runDemo (evidence in FSM)
        const onclick = await demo.getButtonOnclickAttribute();
        // The HTML uses onclick="runDemo()" - check that it contains 'runDemo'
        expect(typeof onclick).toBe('string');
        expect(onclick).toContain('runDemo');

        // The demo results container should be hidden initially (S0_Idle entry state)
        await expect(demo.demoResults).toBeHidden();

        // The FSM entry action for S0_Idle mentions renderPage(), but the HTML does not define it.
        // We assert that renderPage is not defined on the window (we do not call or patch it).
        const renderPageDefined = await demo.isRenderPageDefined();
        expect(renderPageDefined).toBe(false);

        // Ensure no uncaught page errors occurred while loading the page
        expect(pageErrors.length).toBe(0);

        // Ensure there are no console error messages emitted on load
        const consoleErrors = consoleMessages.filter(m => m.type === 'error');
        expect(consoleErrors.length).toBe(0);
    });

    // Test transition: clicking the demo button triggers S1_DemoRunning
    test('RunDemo event/transition: clicking .demo-button shows #demo-results and runs test cases', async ({ page }) => {
        const demo = new DemoPage(page);
        await demo.goto();

        // Click the Run Test Demonstration button (event: RunDemo)
        // This should trigger runDemo() defined in the page and transition to S1_DemoRunning
        await demo.clickRunDemo();

        // The demo results container should become visible (expected observable in the FSM)
        await expect(demo.demoResults).toBeVisible();

        // There are 4 test cases defined in the page's runDemo() implementation
        const count = await demo.getTestCasesCount();
        expect(count).toBe(4);

        // Each test case in the demo is expected to PASS according to the simple stringLength logic in the page
        const statuses = await demo.getTestCaseStatusClasses();
        // Validate that each final <strong> element indicates 'PASSED' and has class 'success'
        for (const status of statuses) {
            expect(status.text.trim()).toBe('PASSED');
            expect(status.className).toBe('success');
        }

        // Validate the displayed inputs and expected/actual outputs are present in the DOM strings
        const texts = await demo.getTestCaseTexts();
        expect(texts[0]).toContain('should return correct length for non-empty string');
        expect(texts[0]).toContain('Input: "hello"');
        expect(texts[0]).toContain('Expected: 5');
        expect(texts[0]).toContain('Actual: 5');

        expect(texts[1]).toContain('should return 0 for empty string');
        expect(texts[1]).toContain('Input: ""');
        expect(texts[1]).toContain('Expected: 0');

        expect(texts[2]).toContain('should return 0 for non-string input (number)');
        expect(texts[2]).toContain('Input: 123');
        expect(texts[2]).toContain('Expected: 0');

        expect(texts[3]).toContain('should return 0 for non-string input (null)');
        expect(texts[3]).toContain('Input: null');
        expect(texts[3]).toContain('Expected: 0');

        // Confirm no uncaught page errors were produced while running the demo
        expect(pageErrors.length).toBe(0);

        // Confirm no console.error messages were emitted during the demo run
        const consoleErrs = consoleMessages.filter(m => m.type === 'error');
        expect(consoleErrs.length).toBe(0);
    });

    // Edge case and idempotency: running the demo multiple times should clear previous results and produce the same visible outcome
    test('Re-running demo clears previous results and reproduces expected output (idempotency)', async ({ page }) => {
        const demo = new DemoPage(page);
        await demo.goto();

        // Run demo first time
        await demo.clickRunDemo();
        await expect(demo.demoResults).toBeVisible();
        const firstRunCount = await demo.getTestCasesCount();
        expect(firstRunCount).toBe(4);

        const firstRunTexts = await demo.getTestCaseTexts();

        // Run demo second time - per implementation, it clears testResultsContainer.innerHTML before running tests
        await demo.clickRunDemo();
        await expect(demo.demoResults).toBeVisible();

        const secondRunCount = await demo.getTestCasesCount();
        expect(secondRunCount).toBe(4);

        const secondRunTexts = await demo.getTestCaseTexts();

        // The content should be equivalent in structure and expected results
        expect(secondRunTexts.length).toBe(firstRunTexts.length);
        for (let i = 0; i < secondRunTexts.length; i++) {
            // Ensure the test descriptions and expected/actual output appear after both runs
            expect(secondRunTexts[i]).toContain(firstRunTexts[i].split('\n')[0].trim());
            // Ensure outcomes are still PASSED
            expect(secondRunTexts[i]).toContain('PASSED');
        }

        // Also ensure no additional console errors or page errors appeared during re-run
        expect(pageErrors.length).toBe(0);
        const consoleErrs = consoleMessages.filter(m => m.type === 'error');
        expect(consoleErrs.length).toBe(0);
    });

    // Validate demonstration covers edge case inputs as displayed to the user
    test('Edge cases displayed in demo: non-string inputs and empty string are handled and shown', async ({ page }) => {
        const demo = new DemoPage(page);
        await demo.goto();

        // Run the demo
        await demo.clickRunDemo();
        await expect(demo.demoResults).toBeVisible();

        const texts = await demo.getTestCaseTexts();

        // Confirm the test that uses number input shows "Input: 123" and PASSED
        const numberCase = texts.find(t => t.includes('non-string input (number)'));
        expect(numberCase).toBeTruthy();
        expect(numberCase).toContain('Input: 123');
        expect(numberCase).toContain('Expected: 0');
        expect(numberCase).toContain('Actual: 0');
        expect(numberCase).toContain('PASSED');

        // Confirm the test that uses null input shows "Input: null" and PASSED
        const nullCase = texts.find(t => t.includes('non-string input (null)'));
        expect(nullCase).toBeTruthy();
        expect(nullCase).toContain('Input: null');
        expect(nullCase).toContain('Expected: 0');
        expect(nullCase).toContain('Actual: 0');
        expect(nullCase).toContain('PASSED');

        // Confirm the empty string case behaves correctly
        const emptyCase = texts.find(t => t.includes('empty string'));
        expect(emptyCase).toBeTruthy();
        expect(emptyCase).toContain('Input: ""');
        expect(emptyCase).toContain('Expected: 0');
        expect(emptyCase).toContain('Actual: 0');
        expect(emptyCase).toContain('PASSED');

        // No page errors or console errors expected
        expect(pageErrors.length).toBe(0);
        const consoleErrs = consoleMessages.filter(m => m.type === 'error');
        expect(consoleErrs.length).toBe(0);
    });

    // After all actions, perform a final assertion: ensure no unexpected runtime errors were emitted during the tests
    test('Runtime observation: no uncaught exceptions or console errors during interactions', async ({ page }) => {
        const demo = new DemoPage(page);
        await demo.goto();

        // Perform one run to exercise the demo code
        await demo.clickRunDemo();
        await expect(demo.demoResults).toBeVisible();

        // Assert we captured zero page errors
        expect(pageErrors.length).toBe(0, `Expected no page errors, but found: ${JSON.stringify(pageErrors)}`);

        // Assert no console errors were emitted
        const consoleErrs = consoleMessages.filter(m => m.type === 'error');
        expect(consoleErrs.length).toBe(0, `Expected no console.error messages, but found: ${JSON.stringify(consoleErrs)}`);
    });
});