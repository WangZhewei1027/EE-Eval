import { test, expect } from '@playwright/test';

// Test file: d5a001c2-fa7b-11f0-8b01-9f078a0ff214.spec.js
// Application URL (served by the runner environment)
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a001c2-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object representing the demonstration page
class DemonstrationPage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
        this.showButton = page.locator("button[onclick='showDemonstration()']");
        this.demo = page.locator('#demonstration');
    }

    async goto() {
        await this.page.goto(APP_URL);
    }

    async clickShowButton() {
        await this.showButton.click();
    }

    // returns computed style display value (e.g., 'none' or 'block')
    async getDemoDisplayComputed() {
        return await this.page.evaluate(() => {
            const demo = document.getElementById('demonstration');
            return window.getComputedStyle(demo).display;
        });
    }

    // returns inline style attribute value (string) or null
    async getDemoStyleAttribute() {
        return await this.page.evaluate(() => {
            const demo = document.getElementById('demonstration');
            return demo.getAttribute('style');
        });
    }

    // returns innerText of the demo container
    async getDemoInnerText() {
        return await this.demo.innerText();
    }
}

test.describe('Understanding Stacks - Demonstration visibility FSM tests', () => {
    // Capture console errors and page errors during each test so assertions can be made.
    test.beforeEach(async ({ page }) => {
        // Nothing here; listeners are set up within each test to capture events scoped to that test.
    });

    test('Initial state S0_Idle: button present and demonstration hidden', async ({ page }) => {
        // Arrays to capture console and page errors during navigation/interaction
        const consoleErrors = [];
        const pageErrors = [];

        // Listen for console messages of type 'error'
        page.on('console', (msg) => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });

        // Listen for unhandled page errors
        page.on('pageerror', (err) => {
            pageErrors.push(err);
        });

        const demoPage = new DemonstrationPage(page);
        await demoPage.goto();

        // Validate button exists and has expected text
        await expect(demoPage.showButton).toBeVisible();
        await expect(demoPage.showButton).toHaveText('Show Stack Operations');

        // Validate demonstration element exists
        await expect(demoPage.demo).toBeVisible(); // element exists in DOM; visibility asserted separately

        // The FSM initial state S0_Idle expects the demonstration to be hidden.
        // Check both inline style attribute and computed style.
        const inlineStyle = await demoPage.getDemoStyleAttribute();
        expect(inlineStyle).toBeTruthy(); // should exist per HTML: style="display:none;"
        expect(inlineStyle.replace(/\s/g, '')).toContain('display:none'); // inline attribute contains display:none

        const computedDisplay = await demoPage.getDemoDisplayComputed();
        expect(computedDisplay).toBe('none');

        // Sanity check: inner text contains 'Demonstration' header when visible later
        const inner = await demoPage.getDemoInnerText();
        expect(inner).toContain('Demonstration');

        // Assert that no console.error or page-level errors occurred while loading the page.
        // This validates that the runtime didn't throw ReferenceError/SyntaxError/TypeError unexpectedly.
        expect(consoleErrors.length).toBe(0);
        expect(pageErrors.length).toBe(0);
    });

    test('Transition S0_Idle -> S1_DemonstrationVisible on ShowStackOperations (single click)', async ({ page }) => {
        const consoleErrors = [];
        const pageErrors = [];

        page.on('console', (msg) => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        page.on('pageerror', (err) => {
            pageErrors.push(err);
        });

        const demoPage = new DemonstrationPage(page);
        await demoPage.goto();

        // Precondition: demonstration is hidden
        expect(await demoPage.getDemoDisplayComputed()).toBe('none');

        // Click the button to trigger showDemonstration() -> S1_DemonstrationVisible
        await demoPage.clickShowButton();

        // After clicking once, demonstration should become visible (entry action showDemonstration executed)
        await expect(demoPage.demo).toBeVisible();
        const displayAfterClick = await demoPage.getDemoDisplayComputed();
        expect(displayAfterClick === 'block' || displayAfterClick === 'flex' || displayAfterClick === 'inline-block').toBeTruthy();

        // Verify content remains correct
        const inner = await demoPage.getDemoInnerText();
        expect(inner).toContain('This would be an interactive visualization of stack operations');

        // Ensure no console or page errors occurred during the click and toggle
        expect(consoleErrors.length).toBe(0);
        expect(pageErrors.length).toBe(0);
    });

    test('Transition S1_DemonstrationVisible -> S0_Idle toggles hidden on second click', async ({ page }) => {
        const consoleErrors = [];
        const pageErrors = [];

        page.on('console', (msg) => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        page.on('pageerror', (err) => {
            pageErrors.push(err);
        });

        const demoPage = new DemonstrationPage(page);
        await demoPage.goto();

        // Click once to show
        await demoPage.clickShowButton();
        expect(await demoPage.getDemoDisplayComputed()).toBe('block');

        // Click again to hide (toggle back)
        await demoPage.clickShowButton();
        const displayAfterSecondClick = await demoPage.getDemoDisplayComputed();
        expect(displayAfterSecondClick).toBe('none');

        // Make sure DOM still contains the demonstration content (just hidden)
        const inner = await demoPage.getDemoInnerText();
        expect(inner).toContain('This would be an interactive visualization of stack operations');

        // Validate no runtime errors occurred during the toggling transitions
        expect(consoleErrors.length).toBe(0);
        expect(pageErrors.length).toBe(0);
    });

    test('Edge case: rapid repeated clicks should toggle deterministically (no JS errors)', async ({ page }) => {
        const consoleErrors = [];
        const pageErrors = [];

        page.on('console', (msg) => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        page.on('pageerror', (err) => {
            pageErrors.push(err);
        });

        const demoPage = new DemonstrationPage(page);
        await demoPage.goto();

        // Rapidly click the button multiple times
        for (let i = 0; i < 7; i++) {
            await demoPage.clickShowButton();
        }

        // After odd number of clicks (7), the visibility should be toggled from initial hidden -> visible
        const finalDisplay = await demoPage.getDemoDisplayComputed();
        expect(finalDisplay).toBe('block');

        // Now click one more time to make it hidden again
        await demoPage.clickShowButton();
        expect(await demoPage.getDemoDisplayComputed()).toBe('none');

        // Ensure no console/page errors were emitted during rapid interactions
        expect(consoleErrors.length).toBe(0);
        expect(pageErrors.length).toBe(0);
    });

    test('FSM coverage: verify both states reachable and transitions are idempotent over cycles', async ({ page }) => {
        const consoleErrors = [];
        const pageErrors = [];

        page.on('console', (msg) => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        page.on('pageerror', (err) => {
            pageErrors.push(err);
        });

        const demoPage = new DemonstrationPage(page);
        await demoPage.goto();

        // Cycle through show/hide multiple times and assert states
        for (let cycle = 0; cycle < 3; cycle++) {
            // S0_Idle -> S1_DemonstrationVisible
            await demoPage.clickShowButton();
            expect(await demoPage.getDemoDisplayComputed()).toBe('block');

            // S1_DemonstrationVisible -> S0_Idle
            await demoPage.clickShowButton();
            expect(await demoPage.getDemoDisplayComputed()).toBe('none');
        }

        // Confirm content remains unchanged
        const inner = await demoPage.getDemoInnerText();
        expect(inner).toContain('This would be an interactive visualization of stack operations');

        // Assert no runtime errors (ReferenceError/SyntaxError/TypeError) happened during repeated cycles
        expect(consoleErrors.length).toBe(0);
        expect(pageErrors.length).toBe(0);
    });

    test('Error observation: explicitly assert that no ReferenceError, SyntaxError, or TypeError occurred', async ({ page }) => {
        // This test focuses on observing JavaScript runtime errors and asserting none of the specified error types were thrown.
        const pageErrors = [];
        page.on('pageerror', (err) => {
            pageErrors.push(err);
        });

        const demoPage = new DemonstrationPage(page);
        await demoPage.goto();

        // Perform normal interactions that could plausibly cause errors if code were broken
        await demoPage.clickShowButton();
        await demoPage.clickShowButton();

        // Examine captured page errors and ensure none match the specified error types.
        const errorNames = pageErrors.map(e => e.name);
        // If there are no errors, the arrays will be empty and assertions below will pass.
        expect(errorNames.includes('ReferenceError')).toBeFalsy();
        expect(errorNames.includes('SyntaxError')).toBeFalsy();
        expect(errorNames.includes('TypeError')).toBeFalsy();

        // Also assert total pageErrors is zero for stronger guarantee
        expect(pageErrors.length).toBe(0);
    });
});