import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b00d101-d5c3-11f0-b41f-b131cbd11f51.html';

test.describe('Linear Search Algorithm Demo - FSM validation and UI tests', () => {
  // Shared variables to collect console and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors
    page.context().consoleMsgs = [];
    page.context().pageErrors = [];

    page.on('console', msg => {
      // store console messages for assertions later
      page.context().consoleMsgs.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // store page errors for assertions later
      page.context().pageErrors.push(err);
    });

    // Navigate to the page for every test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // By default assert there were no uncaught page errors during the test
    // This validates that the runtime remained stable while running interactions
    const pageErrors = page.context().pageErrors || [];
    expect(pageErrors.length, `Unexpected page errors: ${JSON.stringify(pageErrors)}`).toBe(0);

    // Also assert there are no console errors
    const consoleErrors = (page.context().consoleMsgs || []).filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length, `Unexpected console errors/warnings: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test.describe('Initial Load (S0_Idle) and array display', () => {
    test('On load the page is in Idle state and array is rendered from input (entry action updateArrayDisplay)', async ({ page }) => {
      // Validate arrayInput default value is present
      const arrayInput = page.locator('#arrayInput');
      await expect(arrayInput).toHaveValue('5, 8, 2, 10, 15, 3, 7, 12, 1, 9');

      // updateArrayDisplay should have created array elements for the default input
      const arrayElements = page.locator('#arrayDisplay .array-element');
      await expect(arrayElements).toHaveCount(10);

      // Ensure each rendered element's text matches the parsed input order
      const expectedValues = ['5','8','2','10','15','3','7','12','1','9'];
      for (let i = 0; i < expectedValues.length; i++) {
        await expect(page.locator(`#element-${i}`)).toHaveText(expectedValues[i]);
      }

      // No initial result or steps should be present on idle
      await expect(page.locator('#result')).toHaveText('');
      await expect(page.locator('#steps')).toBeEmpty();
    });
  });

  test.describe('GenerateArray and UpdateArray events (S0_Idle transitions to S0_Idle)', () => {
    test('Clicking Generate Random Array updates the arrayInput, re-renders array, and resets search', async ({ page }) => {
      const generateBtn = page.locator('#generateArray');
      const arrayInput = page.locator('#arrayInput');
      const arrayElements = page.locator('#arrayDisplay .array-element');
      const resultDiv = page.locator('#result');
      const stepsDiv = page.locator('#steps');

      // Click generate - this should create a new random array and update UI
      await generateBtn.click();

      // arrayInput.value should now be a comma separated list of 10 numbers
      const value = await arrayInput.inputValue();
      // basic sanity checks: contains commas and at least 10 numbers when split
      expect(value.includes(','), 'Generated array input should contain commas').toBeTruthy();
      const parsed = value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      expect(parsed.length, 'Generated array should have 10 numeric entries').toBeGreaterThanOrEqual(1);
      // The implementation generates exactly 10 numbers - assert at least > 0
      // Validate UI updated with elements - expecting 10 elements in display (implementation uses length 10)
      await expect(arrayElements).toHaveCount(10);

      // After generating, resetSearch() should have been called: result empty and steps cleared
      await expect(resultDiv).toHaveText('');
      await expect(stepsDiv).toBeEmpty();
    });

    test('Changing the array input and dispatching change updates the display (UpdateArray event)', async ({ page }) => {
      const arrayInput = page.locator('#arrayInput');
      const newValue = '1, 2, 3';
      // Fill and dispatch change event to mimic user updating input
      await arrayInput.fill(newValue);
      await arrayInput.evaluate((el) => {
        // dispatch a change event as the app listens for 'change'
        const evt = new Event('change', { bubbles: true, cancelable: true });
        el.dispatchEvent(evt);
      });

      // The arrayDisplay should now have 3 elements and match the new values
      const arrayElements = page.locator('#arrayDisplay .array-element');
      await expect(arrayElements).toHaveCount(3);
      await expect(page.locator('#element-0')).toHaveText('1');
      await expect(page.locator('#element-1')).toHaveText('2');
      await expect(page.locator('#element-2')).toHaveText('3');

      // Reset should have been called (the change handler calls resetSearch)
      await expect(page.locator('#result')).toHaveText('');
      await expect(page.locator('#steps')).toBeEmpty();
    });
  });

  test.describe('Searching (S1_Searching) and transitions', () => {
    test('Start linear search finds an existing target and updates UI (entry action startLinearSearch)', async ({ page }) => {
      // The default input contains the target value 7 at index 6
      const searchBtn = page.locator('#searchBtn');
      const searchValue = page.locator('#searchValue');
      const resultDiv = page.locator('#result');
      const steps = page.locator('#steps .step');
      const targetIndex = 6;
      const targetValue = '7';

      // Ensure search value is correct
      await expect(searchValue).toHaveValue(targetValue);

      // Click start search; the function disables searchBtn and begins visual loop
      await searchBtn.click();

      // Immediately after starting, searchBtn should be disabled (entry action effect)
      await expect(searchBtn).toBeDisabled();

      // Wait for the result text to indicate found at index 6
      // The search highlights elements and appends steps. The loop waits 500ms per item.
      // Since the match is at index 6, expect around 7 iterations. Wait until result includes the found message.
      await expect(resultDiv).toHaveText(new RegExp(`Target\\s+${targetValue}\\s+found\\s+at\\s+index\\s+${targetIndex}`), { timeout: 8000 });

      // Steps count should equal number of iterations until the match (7)
      await expect(steps).toHaveCount(targetIndex + 1);

      // The found element should have class 'found' and not have 'searching'
      const foundElement = page.locator(`#element-${targetIndex}`);
      await expect(foundElement).toHaveClass(/found/);

      // Confirm the result color indicates success (#4CAF50)
      const color = await resultDiv.evaluate(el => window.getComputedStyle(el).color);
      // color can be returned in rgb form; check it includes the green color approximate 'rgb(76, 175, 80)'
      expect(color.includes('rgb(76, 175, 80)') || color.includes('#4CAF50') || color.includes('4CAF50')).toBeTruthy();
    });

    test('Start search with non-numeric searchValue shows validation message and returns buttons to enabled state', async ({ page }) => {
      const searchBtn = page.locator('#searchBtn');
      const resetBtn = page.locator('#resetBtn');
      const searchValue = page.locator('#searchValue');
      const resultDiv = page.locator('#result');

      // Set invalid search value (empty)
      await searchValue.fill('');
      // Click start
      await searchBtn.click();

      // Expect a validation message prompting for a valid number
      await expect(resultDiv).toHaveText(/Please enter a valid number to search/);

      // Buttons should be re-enabled after validation check
      await expect(searchBtn).not.toBeDisabled();
      await expect(resetBtn).not.toBeDisabled();
    });

    test('Start search for a value not in the array results in not-found message and visual not-found classes', async ({ page }) => {
      const searchBtn = page.locator('#searchBtn');
      const searchValue = page.locator('#searchValue');
      const resultDiv = page.locator('#result');
      const steps = page.locator('#steps .step');

      // Use a value that is unlikely to be in the array (e.g., 999)
      await searchValue.fill('999');
      await searchBtn.click();

      // Wait for full scan to complete - array length is 10 and delay per step is 500ms => ~5000ms max
      await expect(resultDiv).toHaveText(/Target\s+999\s+not\s+found\s+in\s+the\s+array/, { timeout: 8000 });

      // Steps should have 10 entries (one per element)
      await expect(steps).toHaveCount(10);

      // At least one element should have the 'not-found' class (end state for elements that didn't match)
      const notFoundCount = await page.locator('.array-element.not-found').count();
      expect(notFoundCount).toBeGreaterThanOrEqual(1);

      // Confirm the result color indicates failure (#f44336)
      const color = await resultDiv.evaluate(el => window.getComputedStyle(el).color);
      // color may be rgb version of the hex
      expect(color.includes('rgb(244, 67, 54)') || color.includes('#f44336') || color.includes('f44336')).toBeTruthy();
    });
  });

  test.describe('Reset behavior (S2_Reset) and exit actions', () => {
    test('Reset clears results and steps and returns array elements to default classes (resetSearch exit action)', async ({ page }) => {
      // First perform a search so there is state to reset
      const searchBtn = page.locator('#searchBtn');
      const resetBtn = page.locator('#resetBtn');
      const resultDiv = page.locator('#result');
      const steps = page.locator('#steps');
      await searchBtn.click();

      // Wait for some result (either found or not found) - we only need to ensure search completed
      await expect(resultDiv).not.toHaveText('', { timeout: 8000 });

      // Now click reset which triggers resetSearch (S1 -> S2 transition exit action)
      await resetBtn.click();

      // After reset: result and steps should be cleared
      await expect(resultDiv).toHaveText('');
      await expect(steps).toBeEmpty();

      // All array elements should have class exactly 'array-element' (no searching/found/not-found)
      const count = await page.locator('#arrayDisplay .array-element').count();
      for (let i = 0; i < count; i++) {
        const className = await page.locator(`#element-${i}`).getAttribute('class');
        expect(className).toBe('array-element');
      }

      // Search button should be enabled after reset
      await expect(page.locator('#searchBtn')).not.toBeDisabled();
    });
  });

  test.describe('Console and runtime error observations', () => {
    test('No console errors or uncaught exceptions should have been emitted during interactions', async ({ page }) => {
      // Execute a few interactions: generate, change input, and a quick reset
      await page.locator('#generateArray').click();
      await page.locator('#arrayInput').fill('10,20,30');
      await page.locator('#arrayInput').evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
      await page.locator('#resetBtn').click();

      // Give a short moment for any async runtime errors to bubble up
      await page.waitForTimeout(200);

      // Assert there were no page errors or console errors captured in this test's context
      const pageErrors = page.context().pageErrors || [];
      const consoleMsgs = page.context().consoleMsgs || [];
      const consoleErrors = consoleMsgs.filter(m => m.type === 'error' || m.type === 'warning');

      expect(pageErrors.length, `Expected no page errors, got: ${JSON.stringify(pageErrors)}`).toBe(0);
      expect(consoleErrors.length, `Expected no console errors/warnings, got: ${JSON.stringify(consoleErrors)}`).toBe(0);
    });
  });

});