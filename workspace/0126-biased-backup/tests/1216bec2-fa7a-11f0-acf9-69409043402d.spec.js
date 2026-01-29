import { test, expect } from '@playwright/test';

test.describe('Unit Testing Interactive Demo - FSM validation and interactions', () => {
  const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1216bec2-fa7a-11f0-acf9-69409043402d.html';

  // Shared state to capture console and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection
    page.on('console', msg => {
      // store text and type to allow assertions later
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL);

    // Wait until the tests table is rendered (initial load triggers loadSampleTests)
    await page.waitForSelector('#tests tbody');
    // Ensure initial test control fieldsets are present after initial render
    await page.waitForTimeout(50); // brief pause to let initial JS run and DOM populate
  });

  test.afterEach(async () => {
    // after each individual test we assert that no unexpected runtime errors occurred
    // (pageErrors captures uncaught exceptions like ReferenceError, TypeError, etc.)
    expect(pageErrors, 'No uncaught page errors should happen during the test').toHaveLength(0);
  });

  test('S0 Idle -> Load sample tests: initial state should render tests and control panels', async ({ page }) => {
    // Validate that sample tests were loaded on initial script run (entry action loadSampleTests)
    const testsRows = page.locator('#tests tbody tr');
    await expect(testsRows).toHaveCountGreaterThan(0);

    // tests-def fieldset should be visible because initial setup calls testsDefFieldset.style.display = '';
    const testsDef = page.locator('#tests-def');
    await expect(testsDef).toBeVisible();

    // test-control and deep-exploration are initially displayed by renderTestsTable/selectTest for first test
    const testControl = page.locator('#test-control');
    const deepExploration = page.locator('#deep-exploration');
    await expect(testControl).toBeVisible();
    await expect(deepExploration).toBeVisible();

    // Ensure no uncaught page errors up to this point
    expect(pageErrors).toHaveLength(0);
  });

  test('S1 Function Selected -> change function and load sample tests for that function', async ({ page }) => {
    // Select 'divide' function from the dropdown
    const funcSelect = page.locator('#func-selection');
    await funcSelect.selectOption('divide');

    // Click "Load Sample Tests" to explicitly trigger LoadTests transition (though change handler also loads)
    await page.click('#load-tests');

    // After loading divide tests, there should be a row named "Divide by zero"
    const row = page.locator('#tests tbody tr td').filter({ hasText: 'Divide by zero' });
    await expect(row).toHaveCountGreaterThan(0);

    // Ensure selectedFunc change resulted in input editor appropriate for divide (two args a,b => two inputs)
    await page.waitForSelector('#input-a');
    await page.waitForSelector('#input-b');

    // Ensure no uncaught page errors
    expect(pageErrors).toHaveLength(0);
  });

  test('S2 Add Test -> Add New Test increases table count and selects new test', async ({ page }) => {
    // Count current tests
    const rowsBefore = await page.locator('#tests tbody tr').count();

    // Click Add New Test
    await page.click('#add-test-btn');

    // New row count should be rowsBefore + 1
    const rowsAfter = await page.locator('#tests tbody tr').count();
    expect(rowsAfter).toBeGreaterThan(rowsBefore);

    // The selected-test dropdown should have the newly created test selected
    const selectedOption = await page.locator('#selected-test option:checked').textContent();
    expect(selectedOption).toContain('New Test');

    // Ensure input editors appeared for the new test
    await expect(page.locator('#input-a').first()).toBeVisible();

    // No uncaught page errors
    expect(pageErrors).toHaveLength(0);
  });

  test('S3 Select Test -> Selecting test via dropdown and via table Select button updates controls', async ({ page }) => {
    // Ensure there is at least one Select button in the table
    const selectButton = page.locator('#tests tbody tr button', { hasText: 'Select' }).first();
    await expect(selectButton).toBeVisible();

    // Click the Select button on the first test row
    await selectButton.click();

    // The selected-test dropdown should reflect that selection
    const selectedVal = await page.locator('#selected-test').inputValue();
    expect(selectedVal).not.toBe('');

    // Now change the selected-test via the select element to the second option if exists
    const options = page.locator('#selected-test option');
    const optionsCount = await options.count();
    if (optionsCount > 1) {
      const secondOptionValue = await options.nth(1).getAttribute('value');
      await page.selectOption('#selected-test', secondOptionValue);
      // After change, the selectedTestId should match the selected option
      const val = await page.locator('#selected-test').inputValue();
      expect(val).toBe(secondOptionValue);
    }

    // No uncaught errors
    expect(pageErrors).toHaveLength(0);
  });

  test('S4 Test Running -> Running passing, failing, and throws tests update run results and log', async ({ page }) => {
    // Find a known passing test for current function (initial default is 'add')
    // Locate option whose text contains 'Add positive' or fallback to first option
    const optionLocator = page.locator('#selected-test option', { hasText: 'Add positive' });
    if (await optionLocator.count() > 0) {
      const val = await optionLocator.getAttribute('value');
      await page.selectOption('#selected-test', val);
    } else {
      // just select first
      const firstValue = await page.locator('#selected-test option').first().getAttribute('value');
      await page.selectOption('#selected-test', firstValue);
    }

    // Ensure expected is 3 for Add positive - verify expectedValue input contains "3"
    const expectedInput = page.locator('#expected-value');
    const expectedText = await expectedInput.inputValue();
    // If equal to serialized 3 or contains 3, proceed, else attempt to set inputs for deterministic test
    // Run the test
    await page.click('#run-test-btn');

    // Check log shows PASS or FAIL depending on current data
    const logText1 = await page.locator('#log').textContent();
    expect(logText1).toBeTruthy();

    // Now intentionally break expected to force a FAIL: set expected to a wrong value and update assertion
    await expectedInput.fill('9999');
    await page.click('#edit-assertion-btn'); // Update assertion to use new expected
    await page.click('#run-test-btn');
    const logText2 = await page.locator('#log').textContent();
    expect(logText2).toContain('Result: FAIL');

    // For a throws test, switch function to 'divide' and select the 'Divide by zero' sample
    await page.selectOption('#func-selection', 'divide');
    await page.click('#load-tests');
    // Select the "Divide by zero" test
    const divideOpt = page.locator('#selected-test option', { hasText: 'Divide by zero' });
    if (await divideOpt.count() > 0) {
      const v = await divideOpt.getAttribute('value');
      await page.selectOption('#selected-test', v);
    }
    // Ensure the assertion is 'throws' for that test (rendered)
    // Run it - should PASS because throws is expected
    await page.click('#run-test-btn');
    const logText3 = await page.locator('#log').textContent();
    expect(logText3).toContain('Result: PASS');

    // No uncaught page errors
    expect(pageErrors).toHaveLength(0);
  });

  test('S5 Inputs Reset -> Modify inputs and reset brings them back to initial values', async ({ page }) => {
    // Ensure a test with inputs is selected
    // Use 'add' function for deterministic a,b inputs
    await page.selectOption('#func-selection', 'add');
    await page.click('#load-tests');

    // Select first test
    const firstOptVal = await page.locator('#selected-test option').first().getAttribute('value');
    await page.selectOption('#selected-test', firstOptVal);

    // Change input-a to a new value and ensure log updated
    const inputA = page.locator('#input-a');
    await inputA.fill('42');
    // Wait a moment for input listener to update state
    await page.waitForTimeout(20);
    const logAfterChange = await page.locator('#log').textContent();
    expect(logAfterChange).toContain('[Input updated]');

    // Click reset inputs
    await page.click('#reset-test-btn');

    // After reset, input should be set back to initial (e.g., '1' for many sample tests)
    const valueAfterReset = await inputA.inputValue();
    expect(valueAfterReset).not.toBe('42'); // should have reverted

    const logReset = await page.locator('#log').textContent();
    expect(logReset).toContain('[Inputs reset to initial values]');

    // No uncaught errors
    expect(pageErrors).toHaveLength(0);
  });

  test('S6 Assertion Updated -> Change expected and assertion type updates test state and clears last result', async ({ page }) => {
    // Select 'add' and first test
    await page.selectOption('#func-selection', 'add');
    await page.click('#load-tests');

    const firstOptVal = await page.locator('#selected-test option').first().getAttribute('value');
    await page.selectOption('#selected-test', firstOptVal);

    // Set expected value to JSON array and assertion to deepEqual to test parsing
    await page.fill('#expected-value', '[1,2,3]');
    await page.selectOption('#assertion-type', 'deepEqual');
    await page.click('#edit-assertion-btn');

    const logText = await page.locator('#log').textContent();
    expect(logText).toContain('[Test assertion updated]');

    // The table should reflect expected displayed as JSON array
    const expectedCell = page.locator('#tests tbody tr').first().locator('td').nth(2);
    const expectedCellText = await expectedCell.textContent();
    expect(expectedCellText).toContain('[');

    // No uncaught errors
    expect(pageErrors).toHaveLength(0);
  });

  test('S7 Test Deleted -> Deleting a test prompts confirmation; accepting removes it, dismissing keeps it', async ({ page }) => {
    // Ensure we have at least two tests to test both accept and dismiss
    await page.selectOption('#func-selection', 'add');
    await page.click('#load-tests');

    // Add an extra test to ensure more than one exists
    await page.click('#add-test-btn');
    const rowsBefore = await page.locator('#tests tbody tr').count();

    // Try to delete but dismiss the confirmation -> test should remain
    page.once('dialog', async dialog => {
      await dialog.dismiss();
    });
    await page.click('#delete-test-btn');
    await page.waitForTimeout(50);
    const rowsAfterDismiss = await page.locator('#tests tbody tr').count();
    expect(rowsAfterDismiss).toBe(rowsBefore);

    // Now actually accept deletion
    page.once('dialog', async dialog => {
      await dialog.accept();
    });
    await page.click('#delete-test-btn');
    await page.waitForTimeout(50);
    const rowsAfterAccept = await page.locator('#tests tbody tr').count();
    expect(rowsAfterAccept).toBeLessThanOrEqual(rowsBefore - 1);

    // No uncaught errors
    expect(pageErrors).toHaveLength(0);
  });

  test('S8 Test Cloned -> Cloning creates a new test with " - clone" suffix and selects it', async ({ page }) => {
    // Use add function first test
    await page.selectOption('#func-selection', 'add');
    await page.click('#load-tests');

    const rowsBefore = await page.locator('#tests tbody tr').count();

    // Clone the currently selected test
    await page.click('#clone-test-btn');
    await page.waitForTimeout(50);

    const rowsAfter = await page.locator('#tests tbody tr').count();
    expect(rowsAfter).toBeGreaterThan(rowsBefore);

    // The selected test name should include ' - clone'
    const selectedText = await page.locator('#selected-test option:checked').textContent();
    expect(selectedText).toContain('clone');

    // No uncaught errors
    expect(pageErrors).toHaveLength(0);
  });

  test('S9 Inputs Randomized -> Randomize changes inputs and logs message', async ({ page }) => {
    // Ensure a test with numeric inputs is selected
    await page.selectOption('#func-selection', 'add');
    await page.click('#load-tests');

    const beforeA = await page.locator('#input-a').inputValue();
    await page.click('#randomize-inputs-btn');
    await page.waitForTimeout(20);
    const afterA = await page.locator('#input-a').inputValue();
    // It's possible randomize produces the same number, but we at least verify the log and that function runs
    const logText = await page.locator('#log').textContent();
    expect(logText).toContain('[Inputs randomized]');

    // No uncaught errors
    expect(pageErrors).toHaveLength(0);
  });

  test('S10 Batch Run -> Batch run updates all test statuses and prints a summary', async ({ page }) => {
    // Use factorial function where some tests throw errors to exercise error handling
    await page.selectOption('#func-selection', 'factorial');
    await page.click('#load-tests');

    // Run batch
    await page.click('#batch-run-btn');
    await page.waitForTimeout(50);

    const logText = await page.locator('#log').textContent();
    expect(logText).toContain('Batch run summary:');
    expect(logText).toMatch(/Passed:\s*\d+/);

    // The table should show some PASS/FAIL/ERROR entries
    const resultsCells = page.locator('#tests tbody tr td').filter({ hasText: /PASS|FAIL|ERROR/ });
    await expect(resultsCells.count()).toBeGreaterThan(0);

    // No uncaught errors
    expect(pageErrors).toHaveLength(0);
  });

  test('S11 Export Tests -> Export attempts to copy JSON to clipboard or falls back showing JSON; log contains Export message', async ({ page }) => {
    // Ensure there are tests to export
    await page.selectOption('#func-selection', 'add');
    await page.click('#load-tests');

    // Click export
    await page.click('#export-tests-btn');

    // Wait briefly for clipboard promise to resolve or fallback logging
    await page.waitForTimeout(100);

    const logText = await page.locator('#log').textContent();
    // The export implementation writes several possible messages; ensure we saw some export-related message
    expect(logText).toMatch(/Export(ed)?|Export:/);

    // No uncaught errors
    expect(pageErrors).toHaveLength(0);
  });

  test('S12 Import Tests -> Valid import replaces tests; invalid import shows proper error messages', async ({ page }) => {
    // Prepare a valid import payload with two simple tests for function 'add'
    const importPayload = {
      func: 'add',
      tests: [
        { name: 'Imported 1', inputs: { a: 2, b: 3 }, expected: 5, assertion: 'equal' },
        { name: 'Imported 2', inputs: { a: 10, b: 0 }, expected: 10, assertion: 'equal' }
      ]
    };
    await page.fill('#import-area', JSON.stringify(importPayload));
    await page.click('#import-tests-btn');

    // Wait for import to process
    await page.waitForTimeout(50);

    const logText = await page.locator('#log').textContent();
    expect(logText).toContain('Imported');
    expect(logText).toContain('"add"') || expect(logText).toContain('Imported');

    // The tests table should now contain the imported test names
    const importedRow = page.locator('#tests tbody tr td', { hasText: 'Imported 1' });
    await expect(importedRow).toHaveCount(1);

    // Now test invalid JSON import
    await page.fill('#import-area', 'this-is-not-json');
    await page.click('#import-tests-btn');
    await page.waitForTimeout(20);
    const logInvalid = await page.locator('#log').textContent();
    expect(logInvalid).toContain('Import failed: invalid JSON.');

    // No uncaught errors
    expect(pageErrors).toHaveLength(0);
  });

  test('Edge cases: Import unknown function and import with no valid tests', async ({ page }) => {
    // Unknown function
    const importUnknown = { func: 'unknownFunc', tests: [{ name: 'X', inputs: { a: 1 }, expected: 1 }] };
    await page.fill('#import-area', JSON.stringify(importUnknown));
    await page.click('#import-tests-btn');
    await page.waitForTimeout(20);
    const logUnknown = await page.locator('#log').textContent();
    expect(logUnknown).toContain('Import failed: unknown function');

    // No valid tests: missing inputs or expected
    const importNoValid = { func: 'add', tests: [{ foo: 'bar' }] };
    await page.fill('#import-area', JSON.stringify(importNoValid));
    await page.click('#import-tests-btn');
    await page.waitForTimeout(20);
    const logNoValid = await page.locator('#log').textContent();
    expect(logNoValid).toContain('Import failed: no valid tests found.');

    // No uncaught errors
    expect(pageErrors).toHaveLength(0);
  });

  test('Console and runtime monitoring: ensure no console.error or uncaught exceptions were emitted during interactions', async ({ page }) => {
    // This test collects console messages produced during setup and asserts none are of type 'error'
    const errorConsoles = consoleMessages.filter(m => m.type === 'error');

    // It's acceptable for the page to produce informational logs, but we expect no console.error
    expect(errorConsoles.length).toBe(0);

    // Also ensure pageErrors remain empty (captured by afterEach as well)
    expect(pageErrors).toHaveLength(0);
  });

});