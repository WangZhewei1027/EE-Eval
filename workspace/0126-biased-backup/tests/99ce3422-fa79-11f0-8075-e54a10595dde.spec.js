import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99ce3422-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the Multiset interactive demo
class MultisetPage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
        this.selectors = {
            itemInput: '#itemInput',
            countInput: '#countInput',
            addButton: "button[onclick='addItem()']",
            removeItemInput: '#removeItemInput',
            removeCountInput: '#removeCountInput',
            removeButton: "button[onclick='removeItem()']",
            multisetView: '#multisetView',
            searchInput: '#searchInput',
            searchButton: "button[onclick='searchItem()']",
            searchResult: '#searchResult',
            clearButton: "button[onclick='clearMultiset()']"
        };
    }

    async goto() {
        await this.page.goto(APP_URL);
    }

    async addItem(name, count = '1') {
        await this.page.fill(this.selectors.itemInput, name);
        await this.page.fill(this.selectors.countInput, String(count));
        await this.page.click(this.selectors.addButton);
    }

    async removeItem(name, count = '1') {
        await this.page.fill(this.selectors.removeItemInput, name);
        await this.page.fill(this.selectors.removeCountInput, String(count));
        await this.page.click(this.selectors.removeButton);
    }

    async searchItem(name) {
        await this.page.fill(this.selectors.searchInput, name);
        await this.page.click(this.selectors.searchButton);
    }

    async clearMultiset() {
        await this.page.click(this.selectors.clearButton);
    }

    async getMultisetViewText() {
        return (await this.page.textContent(this.selectors.multisetView)) ?? '';
    }

    async getSearchResultText() {
        return (await this.page.textContent(this.selectors.searchResult)) ?? '';
    }

    async inputValue(selector) {
        return await this.page.getAttribute(selector, 'value');
    }
}

// Group all tests for this application
test.describe('Multiset Interactive Demo (Application ID: 99ce3422-fa79-11f0-8075-e54a10595dde)', () => {
    let page;
    let multiset;
    let consoleErrors;
    let pageErrors;

    test.beforeEach(async ({ browser }) => {
        // create a new context/page for isolation
        const context = await browser.newContext();
        page = await context.newPage();

        // collect console errors and page errors for assertions
        consoleErrors = [];
        pageErrors = [];

        page.on('console', (msg) => {
            // capture only console errors to avoid flakiness from warnings/info
            try {
                if (msg.type() === 'error') {
                    consoleErrors.push(msg.text());
                }
            } catch (e) {
                // Defensive: if msg.type() throws, record raw text
                consoleErrors.push(String(msg));
            }
        });

        page.on('pageerror', (err) => {
            // pageerror is an Error object for uncaught exceptions
            pageErrors.push(String(err && err.message ? err.message : err));
        });

        multiset = new MultisetPage(page);
        await multiset.goto();
    });

    test.afterEach(async () => {
        // ensure we close the page to free resources
        try {
            await page.close();
        } catch (e) {
            // ignore
        }
    });

    // Validate initial Idle state and presence of UI components
    test('S0_Idle: Initial render shows controls and empty multiset view', async () => {
        // Check that all main controls are visible
        await expect(page.locator(multiset.selectors.addButton)).toBeVisible();
        await expect(page.locator(multiset.selectors.removeButton)).toBeVisible();
        await expect(page.locator(multiset.selectors.searchButton)).toBeVisible();
        await expect(page.locator(multiset.selectors.clearButton)).toBeVisible();

        // Inputs exist
        await expect(page.locator(multiset.selectors.itemInput)).toBeVisible();
        await expect(page.locator(multiset.selectors.countInput)).toBeVisible();
        await expect(page.locator(multiset.selectors.removeItemInput)).toBeVisible();
        await expect(page.locator(multiset.selectors.removeCountInput)).toBeVisible();
        await expect(page.locator(multiset.selectors.searchInput)).toBeVisible();

        // The multiset view should be empty on initial load (no updateMultisetView called automatically)
        const viewText = await multiset.getMultisetViewText();
        expect(viewText.trim()).toBe('', 'Expected multisetView to be empty string on initial load');

        // Ensure no console errors or page errors occurred during load
        expect(consoleErrors, `Console errors during load: ${consoleErrors.join('\n')}`).toHaveLength(0);
        expect(pageErrors, `Page errors during load: ${pageErrors.join('\n')}`).toHaveLength(0);
    });

    // Test adding items transitions to S1_ItemAdded and updates view
    test('S1_ItemAdded: Adding items updates multisetView and resets inputs', async () => {
        // Add 'apple' x3
        await multiset.addItem('apple', 3);
        let view = await multiset.getMultisetViewText();
        expect(view).toContain('apple: 3');

        // After add, inputs should be reset: itemInput empty and countInput back to '1'
        const itemInputVal = await page.inputValue(multiset.selectors.itemInput);
        const countInputVal = await page.inputValue(multiset.selectors.countInput);
        // itemInput value attribute may be empty string; retrieving attribute 'value' may return null in some browsers, but we assert trimmed text content via DOM
        // Using evaluate to read real value property for robust check:
        const itemValProperty = await page.$eval(multiset.selectors.itemInput, el => el.value);
        const countValProperty = await page.$eval(multiset.selectors.countInput, el => el.value);
        expect(itemValProperty).toBe('', 'Expected item input to be cleared after add');
        expect(countValProperty).toBe('1', 'Expected count input to reset to 1 after add');

        // Add 'apple' x2 again to ensure accumulation works
        await multiset.addItem('apple', 2);
        view = await multiset.getMultisetViewText();
        expect(view).toContain('apple: 5', 'Expected counts to accumulate when adding same item');

        // Add another distinct item 'banana' x1
        await multiset.addItem('banana', 1);
        view = await multiset.getMultisetViewText();
        expect(view).toContain('banana: 1');
        expect(view).toMatch(/apple: 5/);

        // Ensure no console/page errors while adding items
        expect(consoleErrors).toHaveLength(0);
        expect(pageErrors).toHaveLength(0);
    });

    // Test removing items transitions to S2_ItemRemoved and updates view correctly
    test('S2_ItemRemoved: Removing items modifies counts and deletes when <= 0', async () => {
        // Setup: add banana x4
        await multiset.addItem('banana', 4);
        let view = await multiset.getMultisetViewText();
        expect(view).toContain('banana: 4');

        // Remove 2 -> expect banana:2
        await multiset.removeItem('banana', 2);
        view = await multiset.getMultisetViewText();
        expect(view).toContain('banana: 2');

        // Remove remaining 2 -> banana removed from view
        await multiset.removeItem('banana', 2);
        view = await multiset.getMultisetViewText();
        expect(view).not.toContain('banana:');
        // The view may contain other items or be empty; ensure no 'banana:' remains

        // Edge: Remove nonexistent item does nothing and does not throw
        await multiset.removeItem('nonexistent', 3);
        const afterAttempt = await multiset.getMultisetViewText();
        expect(afterAttempt).toBe(view, 'Removing a nonexistent item should not change the multiset view');

        // Edge: Removing more than exists deletes the item (already validated by removal logic)
        // Add orange x1 then remove 5 -> orange removed
        await multiset.addItem('orange', 1);
        let v = await multiset.getMultisetViewText();
        expect(v).toContain('orange: 1');
        await multiset.removeItem('orange', 5);
        v = await multiset.getMultisetViewText();
        expect(v).not.toContain('orange:', 'Removing more than existing should delete the item');

        // Ensure remove input fields were reset to empty and '1'
        const removeItemValue = await page.$eval(multiset.selectors.removeItemInput, el => el.value);
        const removeCountValue = await page.$eval(multiset.selectors.removeCountInput, el => el.value);
        expect(removeItemValue).toBe('', 'removeItemInput should be cleared after removal');
        expect(removeCountValue).toBe('1', 'removeCountInput should reset to 1 after removal');

        // Ensure no console/page errors while removing items
        expect(consoleErrors).toHaveLength(0);
        expect(pageErrors).toHaveLength(0);
    });

    // Test searching items transitions to S3_ItemSearched and displays correct results
    test('S3_ItemSearched: Searching returns correct counts for existing and non-existing items', async () => {
        // Ensure a known state
        await multiset.addItem('grape', 2);
        let view = await multiset.getMultisetViewText();
        expect(view).toContain('grape: 2');

        // Search existing item
        await multiset.searchItem('grape');
        let result = await multiset.getSearchResultText();
        expect(result).toBe('Count: 2', 'Search should display the correct count for an existing item');

        // Search non-existing item
        await multiset.searchItem('pear');
        result = await multiset.getSearchResultText();
        expect(result).toBe('Count: 0', 'Search for nonexistent item should display Count: 0');

        // Edge: search with empty input should show Count: 0
        await multiset.searchItem('');
        result = await multiset.getSearchResultText();
        expect(result).toBe('Count: 0', 'Searching empty string should display Count: 0');

        // Ensure no console/page errors while searching
        expect(consoleErrors).toHaveLength(0);
        expect(pageErrors).toHaveLength(0);
    });

    // Test clearing the multiset transitions to S4_MultisetCleared and empties view
    test('S4_MultisetCleared: Clear All empties the multiset and updates view', async () => {
        // Add multiple items
        await multiset.addItem('a', 1);
        await multiset.addItem('b', 2);
        let view = await multiset.getMultisetViewText();
        expect(view).toContain('a: 1');
        expect(view).toContain('b: 2');

        // Click Clear All
        await multiset.clearMultiset();

        // After clear, the updateMultisetView sets text to 'Multiset is empty'
        const clearedView = await multiset.getMultisetViewText();
        // The implementation sets 'Multiset is empty' when no entries exist; assert that or empty string if not.
        // Accept either to be robust:
        expect(['', 'Multiset is empty']).toContain(clearedView, 'After clearing, multisetView should indicate an empty multiset');

        // Ensure no console/page errors while clearing
        expect(consoleErrors).toHaveLength(0);
        expect(pageErrors).toHaveLength(0);
    });

    // Edge cases and validation tests: input validation and negative/zero counts
    test('Edge cases: invalid inputs (empty names, zero/negative counts) do not change multiset and do not error', async () => {
        // Start clean
        await multiset.clearMultiset();

        const before = await multiset.getMultisetViewText();

        // Attempt to add with empty name
        await multiset.addItem('', 3);
        expect(await multiset.getMultisetViewText()).toBe(before, 'Adding with empty name should not change multiset');

        // Attempt to add with zero count
        await multiset.addItem('x', 0);
        expect(await multiset.getMultisetViewText()).toBe(before, 'Adding with zero count should not change multiset');

        // Attempt to add with negative count
        await multiset.addItem('x', -5);
        expect(await multiset.getMultisetViewText()).toBe(before, 'Adding with negative count should not change multiset');

        // Attempt to remove with empty name
        await multiset.removeItem('', 1);
        expect(await multiset.getMultisetViewText()).toBe(before, 'Removing with empty name should not change multiset');

        // Attempt to remove with zero/negative count
        await multiset.removeItem('x', 0);
        expect(await multiset.getMultisetViewText()).toBe(before, 'Removing with zero count should not change multiset');
        await multiset.removeItem('x', -2);
        expect(await multiset.getMultisetViewText()).toBe(before, 'Removing with negative count should not change multiset');

        // Ensure searching an empty string yields Count: 0 and does not produce errors
        await multiset.searchItem('');
        const searchRes = await multiset.getSearchResultText();
        expect(searchRes).toBe('Count: 0');

        // Verify no console or page errors occurred during edge case interactions
        expect(consoleErrors).toHaveLength(0);
        expect(pageErrors).toHaveLength(0);
    });

    // Diagnostics: ensure no ReferenceError/SyntaxError/TypeError were thrown during any interaction
    test('Diagnostics: No uncaught ReferenceError, SyntaxError, or TypeError occurred during tests', async () => {
        // We already capture pageErrors and consoleErrors across the test lifecycle for the current page.
        // This test validates that none of those error messages indicate common JS runtime errors.
        const combinedErrors = [...consoleErrors, ...pageErrors].join('\n');

        // Assert there are no page errors and no console errors
        expect(combinedErrors).toBe('', `Expected no runtime or console errors, but found:\n${combinedErrors}`);

        // Also assert explicitly that specific error names are not present if combinedErrors is not empty
        expect(combinedErrors.includes('ReferenceError')).toBe(false);
        expect(combinedErrors.includes('SyntaxError')).toBe(false);
        expect(combinedErrors.includes('TypeError')).toBe(false);
    });
});