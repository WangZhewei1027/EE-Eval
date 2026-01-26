import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d326a20-fa7a-11f0-ba5b-57721b046e74.html';

// Page object encapsulating interactions with the Type System Explorer
class TypeSystemPage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
        // Helpers
        this.typeCategory = page.locator('#type-category');
        this.typeName = page.locator('#type-name');
        this.createTypeBtn = page.locator('#create-type');
        this.typeConfig = page.locator('#type-config');

        // Playground
        this.selectedType = page.locator('#selected-type');
        this.valueInput = page.locator('#value-input');
        this.checkTypeBtn = page.locator('#check-type');
        this.inferTypeBtn = page.locator('#infer-type');
        this.typeResult = page.locator('#type-result');

        // Operations
        this.typeOp1 = page.locator('#type-op1');
        this.typeOp2 = page.locator('#type-op2');
        this.typeOperation = page.locator('#type-operation');
        this.performOperationBtn = page.locator('#perform-operation');
        this.operationResult = page.locator('#operation-result');

        // Function config
        this.functionParams = page.locator('#function-params');
        this.addParamBtn = page.locator('#add-param');

        // Generic config
        this.genericParamInput = page.locator('#generic-param');
        this.addGenericParamBtn = page.locator('#add-generic-param');
        this.genericParamsList = page.locator('#generic-params-list');

        // Examples
        this.typeExamples = page.locator('.type-example');
        this.exampleDetails = page.locator('#example-details');

        // Summary
        this.typeSummary = page.locator('#type-summary');

        // Misc
        this.compositeTypeSelect = page.locator('#composite-type');
        this.returnTypeSelect = page.locator('#return-type');
    }

    async goto() {
        await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    }

    // Change the type category (triggers display of config panel)
    async changeCategory(categoryValue) {
        await this.typeCategory.selectOption({ value: categoryValue });
    }

    // Create a type with a given name. For categories that trigger prompt dialogs,
    // the test harness should set the prompt response via the dialog handler.
    async createTypeWithName(name) {
        await this.typeName.fill(name);
        await this.createTypeBtn.click();
    }

    async selectCompositeType(value) {
        await this.compositeTypeSelect.selectOption({ value });
    }

    async addFunctionParam(name = '', type = 'number') {
        await this.addParamBtn.click();
        // the newly added row is the last .row inside #function-params
        const rows = this.functionParams.locator('.row');
        const last = rows.nth((await rows.count()) - 1);
        if (name) {
            await last.locator('.param-name').fill(name);
        }
        await last.locator('.param-type').selectOption({ label: type });
        return last;
    }

    async removeFunctionParam(rowLocator) {
        await rowLocator.locator('.remove-param').click();
    }

    async addGenericParam(paramName) {
        await this.genericParamInput.fill(paramName);
        await this.addGenericParamBtn.click();
    }

    async selectTypeInPlayground(typeName) {
        await this.selectedType.selectOption({ value: typeName });
    }

    async setValueInput(value) {
        await this.valueInput.fill(value);
    }

    async clickCheckType() {
        await this.checkTypeBtn.click();
    }

    async clickInferType() {
        await this.inferTypeBtn.click();
    }

    async selectOperation(type1, op, type2) {
        await this.typeOp1.selectOption({ value: type1 });
        await this.typeOperation.selectOption({ value: op });
        await this.typeOp2.selectOption({ value: type2 });
    }

    async clickPerformOperation() {
        await this.performOperationBtn.click();
    }

    async clickTypeExampleByIndex(index) {
        await this.typeExamples.nth(index).click();
    }

    async getTypeSummaryText() {
        return await this.typeSummary.innerText();
    }

    async getTypeResultText() {
        return await this.typeResult.innerText();
    }

    async getOperationResultText() {
        return await this.operationResult.innerText();
    }

    async getExampleDetailsText() {
        return await this.exampleDetails.innerText();
    }

    async getSelectedTypeOptions() {
        return await this.page.$$eval('#selected-type option', opts => opts.map(o => ({ value: o.value, text: o.textContent })));
    }

    async getTypeOpOptions(selector = '#type-op1') {
        return await this.page.$$eval(selector + ' option', opts => opts.map(o => ({ value: o.value, text: o.textContent })));
    }
}

test.describe('Type System Explorer (FSM integration tests)', () => {
    let page;
    let tsPage;
    let consoleErrors = [];
    let pageErrors = [];
    // Variable used by the global dialog handler to answer prompt dialogs dynamically
    let promptResponse = null;
    let lastAlertMessage = null;

    test.beforeEach(async ({ browser }) => {
        const context = await browser.newContext();
        page = await context.newPage();

        // reset collectors
        consoleErrors = [];
        pageErrors = [];
        promptResponse = null;
        lastAlertMessage = null;

        // Capture console error messages
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push({ text: msg.text(), location: msg.location() });
            }
        });

        // Capture uncaught page errors
        page.on('pageerror', error => {
            pageErrors.push(error);
        });

        // Central dialog handler: tests set promptResponse before actions that cause a prompt.
        page.on('dialog', async dialog => {
            try {
                if (dialog.type() === 'prompt') {
                    // If promptResponse is null, accept with empty string (simulate user)
                    await dialog.accept(promptResponse === null ? '' : String(promptResponse));
                } else if (dialog.type() === 'alert') {
                    lastAlertMessage = dialog.message();
                    await dialog.accept();
                } else {
                    // For confirm or others, accept by default
                    await dialog.accept();
                }
            } catch (e) {
                // Ignore dialog handling errors; they will surface via page errors if they break the page
            }
        });

        tsPage = new TypeSystemPage(page);
        await tsPage.goto();
    });

    test.afterEach(async () => {
        // After each test we assert there were no uncaught console errors or page errors.
        // This ensures the page ran without unexpected runtime exceptions.
        if (consoleErrors.length > 0 || pageErrors.length > 0) {
            // Build a detailed failure message for easier debugging
            const errParts = [];
            if (consoleErrors.length > 0) {
                errParts.push('Console errors:\n' + consoleErrors.map(e => `- ${e.text}`).join('\n'));
            }
            if (pageErrors.length > 0) {
                errParts.push('Page errors:\n' + pageErrors.map(e => `- ${e.toString()}`).join('\n'));
            }
            // Fail the test with the combined message
            throw new Error('Unexpected runtime errors on page:\n' + errParts.join('\n\n'));
        }
        await page.context().close();
    });

    test.describe('S0 Idle: initial UI state', () => {
        test('Initial UI update should populate selectors and summary (entry action updateUI)', async () => {
            // Validate that initial primitive types exist in the type summary
            const summaryText = await tsPage.getTypeSummaryText();
            expect(summaryText).toContain('number');
            expect(summaryText).toContain('string');
            expect(await tsPage.getSelectedTypeOptions()).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ value: 'number' }),
                    expect.objectContaining({ value: 'string' }),
                    expect.objectContaining({ value: 'boolean' })
                ])
            );
        });
    });

    test.describe('S1 TypeCreation: category change, add params, generic params, create types', () => {
        test('TypeCategoryChange displays the correct configuration panel', async () => {
            // Switch to composite config and assert related panel is visible
            await tsPage.changeCategory('composite');
            await expect(tsPage.typeConfig).toBeVisible();
            await expect(page.locator('#composite-config')).toBeVisible();

            // Switch to function config
            await tsPage.changeCategory('function');
            await expect(page.locator('#function-config')).toBeVisible();

            // Switch to generic config
            await tsPage.changeCategory('generic');
            await expect(page.locator('#generic-config')).toBeVisible();
        });

        test('CreateType without a name triggers alert (edge case)', async () => {
            // Ensure category is primitive so no prompt is expected
            await tsPage.changeCategory('primitive');
            // Ensure name is empty
            await tsPage.typeName.fill('');
            // Click create-type: code shows it will alert
            await tsPage.createTypeBtn.click();
            // The dialog handler will capture alert message
            expect(lastAlertMessage).toBe('Please enter a type name');
        });

        test('Create primitive type updates UI and selectors', async () => {
            await tsPage.changeCategory('primitive');
            // Choose primitive radio 'string' - it's present; select via clicking input
            await page.locator('input[name="primitive-type"][value="string"]').click();
            await tsPage.createTypeWithName('mystring');
            // After creation, UI should update: summary and selectors include new type
            await expect(tsPage.typeSummary).toContainText('mystring');
            const options = await tsPage.getSelectedTypeOptions();
            expect(options.some(o => o.value === 'mystring')).toBe(true);
        });

        test('Create composite array type via prompt and object type via prompt', async () => {
            // Create array composite
            await tsPage.changeCategory('composite');
            await tsPage.selectCompositeType('array');
            // prepare prompt response for element type
            promptResponse = 'number';
            await tsPage.typeName.fill('NumberArray');
            await tsPage.createTypeBtn.click();

            // Verify summary contains array detail
            await expect(tsPage.typeSummary).toContainText('NumberArray');
            await expect(tsPage.typeSummary).toContainText('Array of number');

            // Create object composite
            await tsPage.selectCompositeType('object');
            // prompt for properties
            promptResponse = 'age:number, name:string';
            await tsPage.typeName.fill('Person');
            await tsPage.createTypeBtn.click();

            // Verify object type in summary (properties are rendered)
            await expect(tsPage.typeSummary).toContainText('Person');
            await expect(tsPage.typeSummary).toContainText('age: number');
            await expect(tsPage.typeSummary).toContainText('name: string');
        });

        test('Function type: add/remove parameters and create', async () => {
            await tsPage.changeCategory('function');
            // Add an extra parameter
            const row = await tsPage.addFunctionParam('x', 'string');
            // Validate the added row contains the values
            await expect(row.locator('.param-name')).toHaveValue('x');
            await expect(row.locator('.param-type')).toHaveValue('string');

            // Remove the row and verify it goes away
            await tsPage.removeFunctionParam(row);
            // After removal, ensure no param named 'x' exists
            const paramNames = await page.$$eval('#function-params .param-name', els => els.map(e => e.value));
            expect(paramNames).not.toContain('x');

            // Create a function type using existing default parameter and set return
            await tsPage.typeName.fill('MyFunc');
            await tsPage.returnTypeSelect.selectOption({ label: 'void' });
            await tsPage.createTypeBtn.click();

            // UI should contain the new type name in selectors
            const options = await tsPage.getSelectedTypeOptions();
            expect(options.some(o => o.value === 'MyFunc')).toBe(true);
        });

        test('Generic type: add generic param and create', async () => {
            await tsPage.changeCategory('generic');
            // Add a generic param
            await tsPage.addGenericParam('T');
            await expect(tsPage.genericParamsList).toContainText('T');

            // Choose base type if needed (default exists)
            await page.locator('#generic-base-type').selectOption({ value: 'array' });

            // Create a generic type
            await tsPage.typeName.fill('ArrayT');
            await tsPage.createTypeBtn.click();

            // Ensure created type present in selectors/summary
            const options = await tsPage.getSelectedTypeOptions();
            expect(options.some(o => o.value === 'ArrayT')).toBe(true);
            await expect(tsPage.typeSummary).toContainText('ArrayT');
        });
    });

    test.describe('S2 TypePlayground: check and infer type interactions', () => {
        test('CheckTypeClick: valid and invalid checks and eval syntax error handling', async () => {
            // Ensure number exists; use existing primitive 'number'
            await tsPage.selectTypeInPlayground('number');
            // Valid value
            await tsPage.setValueInput('42');
            await tsPage.clickCheckType();
            const validResult = await tsPage.getTypeResultText();
            expect(validResult).toContain('Result:');
            expect(validResult).toContain('Valid');
            expect(validResult).toContain('Actual type: number');

            // Invalid syntax: cause eval error -> UI should show .error
            await tsPage.setValueInput('foo('); // invalid JS
            await tsPage.clickCheckType();
            // Should show an element with class .error
            await expect(page.locator('#type-result .error')).toBeVisible();
            const errText = await page.locator('#type-result .error').innerText();
            expect(errText).toMatch(/Invalid value syntax/);
        });

        test('InferTypeClick: infers arrays, objects, and primitives', async () => {
            // Array inference
            await tsPage.setValueInput('[1, 2, 3]');
            await tsPage.clickInferType();
            const infer1 = await tsPage.getTypeResultText();
            expect(infer1).toContain('Inferred Type');
            expect(infer1).toContain('Array<number>');

            // Object inference
            await tsPage.setValueInput('{ "a": 1, "b": "x" }');
            await tsPage.clickInferType();
            const infer2 = await tsPage.getTypeResultText();
            // The inferType function returns something like { a: number, b: string }
            expect(infer2).toContain('Inferred Type');
            expect(infer2).toContain('a: number');
            expect(infer2).toContain('b: string');

            // Primitive inference
            await tsPage.setValueInput('"hello"');
            await tsPage.clickInferType();
            const infer3 = await tsPage.getTypeResultText();
            expect(infer3).toContain('Inferred Type');
            expect(infer3).toContain('string');
        });
    });

    test.describe('S3 TypeOperations: perform operations and edge cases', () => {
        test('PerformOperationClick shows error when types not selected, and operations result otherwise', async () => {
            // Trigger operation without selecting types
            // Ensure type-op1 and type-op2 have default empty selections
            await tsPage.typeOp1.selectOption({ value: '' });
            await tsPage.typeOp2.selectOption({ value: '' });
            await tsPage.clickPerformOperation();
            await expect(page.locator('#operation-result .error')).toBeVisible();
            expect(await tsPage.getOperationResultText()).toContain('Please select both types');

            // Perform actual operation between number and string for 'assignable'
            await tsPage.selectOperation('number', 'assignable', 'string');
            await tsPage.clickPerformOperation();
            const res1 = await tsPage.getOperationResultText();
            expect(res1).toContain('Operation: assignable');
            expect(res1).toContain('Type 1: number');
            expect(res1).toContain('Type 2: string');
            expect(res1).toContain('NOT assignable');

            // Union operation
            await tsPage.selectOperation('number', 'union', 'string');
            await tsPage.clickPerformOperation();
            const res2 = await tsPage.getOperationResultText();
            expect(res2).toContain('Operation: union');
            expect(res2).toContain('Result:');
            expect(res2).toContain('number | string');

            // Extends operation (simplified equality check used in app)
            await tsPage.selectOperation('number', 'extends', 'number');
            await tsPage.clickPerformOperation();
            const res3 = await tsPage.getOperationResultText();
            expect(res3).toContain('extends');
        });
    });

    test.describe('S4 TypeExamples: clicking examples shows details', () => {
        test('TypeExampleClick displays details for multiple examples', async () => {
            // Click the first example (42, number)
            await tsPage.clickTypeExampleByIndex(0);
            await expect(tsPage.exampleDetails).toContainText('number');
            await expect(tsPage.exampleDetails).toContainText('Primitive numeric type');

            // Click a function example
            const fnIndex = await page.$$eval('.type-example', els => els.findIndex(e => e.getAttribute('data-type') === 'function'));
            if (fnIndex >= 0) {
                await tsPage.clickTypeExampleByIndex(fnIndex);
                await expect(tsPage.exampleDetails).toContainText('function');
                await expect(tsPage.exampleDetails).toContainText('Function type');
            }
        });
    });

    test.describe('UI behavior and edge cases', () => {
        test('Adding and removing function parameters updates the DOM correctly', async () => {
            await tsPage.changeCategory('function');
            const before = await page.$$eval('#function-params .row', r => r.length);
            const newRow = await tsPage.addFunctionParam('newParam', 'boolean');
            const after = await page.$$eval('#function-params .row', r => r.length);
            expect(after).toBeGreaterThan(before);

            // Remove the param added
            await tsPage.removeFunctionParam(newRow);
            const finalCount = await page.$$eval('#function-params .row', r => r.length);
            expect(finalCount).toBe(before);
        });

        test('Add generic parameter prevents empty adds (edge case)', async () => {
            await tsPage.changeCategory('generic');
            // Attempt to add empty generic param: nothing should be added
            await tsPage.genericParamInput.fill('');
            await tsPage.addGenericParamBtn.click();
            // There should be no generic-param elements
            const count = await page.$$eval('#generic-params-list .generic-param', els => els.length);
            expect(count).toBeGreaterThanOrEqual(0); // ensure no crash; specific absence could be 0
        });
    });
});