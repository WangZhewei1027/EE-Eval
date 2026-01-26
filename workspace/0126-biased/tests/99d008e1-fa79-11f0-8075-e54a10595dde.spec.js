import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d008e1-fa79-11f0-8075-e54a10595dde.html';

// Page object for the Virtual Memory Simulation app
class VirtualMemoryPage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
        this.totalPagesInput = page.locator('#totalPages');
        this.pageSizeInput = page.locator('#pageSize');
        this.processSizeInput = page.locator('#processSize');
        this.calculateButton = page.locator('#calculate');
        this.resetButton = page.locator('#reset');
        this.addPageButton = page.locator('#addPage');
        this.removePageButton = page.locator('#removePage');
        this.memoryOutput = page.locator('#memoryOutput');
        this.pageTable = page.locator('#pageTable');
    }

    async goto() {
        await this.page.goto(APP_URL);
    }

    async getMemoryOutputText() {
        return (await this.memoryOutput.textContent())?.trim() ?? '';
    }

    async getPageTableText() {
        return (await this.pageTable.textContent())?.trim() ?? '';
    }

    async setTotalPages(value) {
        await this.totalPagesInput.fill(String(value));
    }

    async setPageSize(value) {
        await this.pageSizeInput.fill(String(value));
    }

    async setProcessSize(value) {
        await this.processSizeInput.fill(String(value));
    }

    async clickCalculate() {
        await this.calculateButton.click();
    }

    async clickReset() {
        await this.resetButton.click();
    }

    async clickAddPage() {
        await this.addPageButton.click();
    }

    async clickRemovePage() {
        await this.removePageButton.click();
    }

    async getInputValues() {
        const totalPages = await this.totalPagesInput.inputValue();
        const pageSize = await this.pageSizeInput.inputValue();
        const processSize = await this.processSizeInput.inputValue();
        return {
            totalPages: Number(totalPages),
            pageSize: Number(pageSize),
            processSize: Number(processSize)
        };
    }
}

test.describe('Virtual Memory Simulation - FSM tests', () => {
    // Shared variables to capture console errors and page errors
    let consoleErrors;
    let consoleMessages;
    let pageErrors;

    test.beforeEach(async ({ page }) => {
        consoleErrors = [];
        consoleMessages = [];
        pageErrors = [];

        // Capture console events and page errors for assertions
        page.on('console', (msg) => {
            const type = msg.type();
            const text = msg.text();
            if (type === 'error') {
                consoleErrors.push(text);
            } else {
                consoleMessages.push({ type, text });
            }
        });

        page.on('pageerror', (err) => {
            pageErrors.push(err);
        });
    });

    // Helper to assert that no uncaught JS errors happened on the page
    async function assertNoPageErrors() {
        expect(pageErrors.length, `Unexpected pageerrors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
        expect(consoleErrors.length, `Unexpected console errors: ${consoleErrors.join('; ')}`).toBe(0);
    }

    // Idle state: verify initial page load updates memoryOutput and pageTable (onEnter actions)
    test('Idle state: initial values and visual output are correct', async ({ page }) => {
        // This test validates the S0_Idle state entry actions (updateMemoryOutput, updatePageTable)
        const vm = new VirtualMemoryPage(page);
        await vm.goto();

        // After load, memoryOutput should reflect totalPages and pageSize, with in-use 0
        const memoryText = await vm.getMemoryOutputText();
        expect(memoryText).toBe('Total Memory: 20 KB, In Use: 0 KB');

        // Page table should indicate no pages allocated
        const pageTableText = await vm.getPageTableText();
        expect(pageTableText).toBe('No pages allocated');

        // Ensure no runtime errors were raised on load
        await assertNoPageErrors();
    });

    // Calculating transition: normal calculation from default inputs
    test('S0 -> S1 Calculating: calculate uses inputs to update memory and page table', async ({ page }) => {
        // This test validates the CalculateClick event and the S1_Calculating entry actions
        const vm = new VirtualMemoryPage(page);
        await vm.goto();

        // Ensure default inputs are as expected
        const inputsBefore = await vm.getInputValues();
        expect(inputsBefore).toEqual({ totalPages: 5, pageSize: 4, processSize: 12 });

        // Click calculate and verify outputs:
        await vm.clickCalculate();

        // Expected pagesInProcess = ceil(12/4) = 3 -> inUse = 3 * 4 = 12 KB
        const memoryText = await vm.getMemoryOutputText();
        expect(memoryText).toBe('Total Memory: 20 KB, In Use: 12 KB');

        // Page table should list 3 pages
        const pageTableText = await vm.getPageTableText();
        expect(pageTableText).toBe('Page 1, Page 2, Page 3');

        await assertNoPageErrors();
    });

    // Calculating edge case: process requires more pages than available -> alert and cap to totalPages
    test('S0 -> S1 Calculating: oversized process triggers alert and caps pages to totalPages', async ({ page }) => {
        // This test triggers the error branch in calculate where pagesInProcess > totalPages
        const vm = new VirtualMemoryPage(page);
        await vm.goto();

        // Set a very large process size to exceed total pages
        await vm.setProcessSize(1000);

        // Listen for the expected alert dialog; capture and accept it.
        const [dialog] = await Promise.all([
            page.waitForEvent('dialog'),
            vm.clickCalculate() // clicking triggers alert in the page code
        ]);

        // Verify dialog message indicates the expected error
        expect(dialog.message()).toContain('Error: Process uses more pages than total available in memory!');
        await dialog.accept();

        // After alert, pagesInProcess should have been limited to totalPages = 5 -> inUse = 5 * pageSize (4) = 20 KB
        const memoryText = await vm.getMemoryOutputText();
        expect(memoryText).toBe('Total Memory: 20 KB, In Use: 20 KB');

        // Page table should list 5 pages (capped)
        const pageTableText = await vm.getPageTableText();
        expect(pageTableText).toBe('Page 1, Page 2, Page 3, Page 4, Page 5');

        await assertNoPageErrors();
    });

    // Reset transition: ensure inputs and derived state reset to defaults and entry actions run
    test('S0 -> S2 Reset: reset inputs to defaults and clear pagesInProcess', async ({ page }) => {
        // This test validates the ResetClick event behavior and entry actions on S2_Reset
        const vm = new VirtualMemoryPage(page);
        await vm.goto();

        // Change inputs and compute first to modify state
        await vm.setProcessSize(20);
        await vm.clickCalculate();

        // Now click reset
        await vm.clickReset();

        // Inputs should revert to defaults
        const inputs = await vm.getInputValues();
        expect(inputs).toEqual({ totalPages: 5, pageSize: 4, processSize: 12 });

        // pagesInProcess should have been set to 0 and reflected in outputs
        const mem = await vm.getMemoryOutputText();
        expect(mem).toBe('Total Memory: 20 KB, In Use: 0 KB');

        const table = await vm.getPageTableText();
        expect(table).toBe('No pages allocated');

        await assertNoPageErrors();
    });

    // Adding Page transition: normal adds and edge case attempting to exceed totalPages
    test('S0 -> S3 AddingPage: add pages until limit and assert alert when exceeding', async ({ page }) => {
        // This test validates AddPageClick event behavior and S3_AddingPage entry actions
        const vm = new VirtualMemoryPage(page);
        await vm.goto();

        // Ensure we're in reset state (no pages)
        await vm.clickReset();
        expect(await vm.getPageTableText()).toBe('No pages allocated');

        // Add a single page and validate updates
        await vm.clickAddPage();
        expect(await vm.getMemoryOutputText()).toBe('Total Memory: 20 KB, In Use: 4 KB');
        expect(await vm.getPageTableText()).toBe('Page 1');

        // Add pages up to totalPages (5)
        for (let i = 2; i <= 5; i++) {
            await vm.clickAddPage();
            const expectedInUse = i * 4;
            expect(await vm.getMemoryOutputText()).toBe(`Total Memory: 20 KB, In Use: ${expectedInUse} KB`);
        }

        // Attempting to add one more should trigger an alert about limit reached
        const [dialog] = await Promise.all([
            page.waitForEvent('dialog'),
            vm.clickAddPage()
        ]);
        expect(dialog.message()).toContain('Cannot add more pages - limit reached!');
        await dialog.accept();

        // State should still be at the maximum (5 pages)
        expect(await vm.getMemoryOutputText()).toBe('Total Memory: 20 KB, In Use: 20 KB');
        expect(await vm.getPageTableText()).toBe('Page 1, Page 2, Page 3, Page 4, Page 5');

        await assertNoPageErrors();
    });

    // Removing Page transition: normal removes and edge case removing when none exist
    test('S0 -> S4 RemovingPage: remove pages and assert alert when trying to remove beyond zero', async ({ page }) => {
        // This test validates RemovePageClick event behavior and S4_RemovingPage entry actions
        const vm = new VirtualMemoryPage(page);
        await vm.goto();

        // Start by resetting and then adding two pages to remove later
        await vm.clickReset();
        await vm.clickAddPage();
        await vm.clickAddPage();
        expect(await vm.getPageTableText()).toBe('Page 1, Page 2');
        expect(await vm.getMemoryOutputText()).toBe('Total Memory: 20 KB, In Use: 8 KB');

        // Remove one page
        await vm.clickRemovePage();
        expect(await vm.getPageTableText()).toBe('Page 1');
        expect(await vm.getMemoryOutputText()).toBe('Total Memory: 20 KB, In Use: 4 KB');

        // Remove second page -> should be none allocated
        await vm.clickRemovePage();
        expect(await vm.getPageTableText()).toBe('No pages allocated');
        expect(await vm.getMemoryOutputText()).toBe('Total Memory: 20 KB, In Use: 0 KB');

        // Attempt to remove when none exist should produce an alert "No more pages to remove!"
        const [dialog] = await Promise.all([
            page.waitForEvent('dialog'),
            vm.clickRemovePage()
        ]);
        expect(dialog.message()).toContain('No more pages to remove!');
        await dialog.accept();

        // Ensure state unchanged (still none allocated)
        expect(await vm.getPageTableText()).toBe('No pages allocated');
        expect(await vm.getMemoryOutputText()).toBe('Total Memory: 20 KB, In Use: 0 KB');

        await assertNoPageErrors();
    });

    // After all tests, ensure there were no uncaught errors during the test run as captured
    test.afterEach(async () => {
        // Nothing to clean up globally here; individual tests assert no page errors.
    });
});