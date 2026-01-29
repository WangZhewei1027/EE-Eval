import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122b89d2-fa7b-11f0-814c-dbec508f0b3b.html';

test.describe('Heap Sort Interactive App (FSM validation) - 122b89d2-fa7b-11f0-814c-dbec508f0b3b', () => {
  // Arrays to collect runtime console and page errors for each test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  // Attach listeners before each test to capture console and page errors
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', err => {
      // capture stack or message
      pageErrors.push(String(err));
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  // Basic smoke test - verifies initial Idle state renders expected components
  test('Initial Idle state renders controls and output (S0_Idle)', async ({ page }) => {
    // Validate presence of primary components described in FSM
    const sortButton = await page.locator('#sort-button');
    const dataInput = await page.locator('#data-input');
    const output = await page.locator('#output');

    await expect(sortButton).toBeVisible();
    await expect(sortButton).toHaveText('Heap Sort');

    await expect(dataInput).toBeVisible();
    await expect(dataInput).toHaveAttribute('placeholder', 'Enter numbers separated by spaces');

    await expect(output).toBeVisible();
    // Output should be empty on load
    await expect(output).toHaveText('');

    // Confirm there were no page-level uncaught exceptions during initial render
    expect(pageErrors.length).toBe(0);
    // And no console errors were emitted on load
    expect(consoleErrors.length).toBe(0);
  });

  // Test typing into input triggers the input handler (DataInputChange) and behavior of updateData
  test('Typing into data input triggers updateData (DataInputChange) and updates input value', async ({ page }) => {
    const dataInput = await page.locator('#data-input');

    // Type into input: this will fire the 'input' event and call updateData()
    // The implementation sets dataInput.value = data.map(...), where data is initially []
    // Expectation (from reading source): input will be replaced/cleared (becomes empty string)
    await dataInput.type('4 1 3');

    // Wait a tick to allow handler to run
    await page.waitForTimeout(50);

    // Because updateData uses the global 'data' array (initially []), it will set value to '' (array -> '')
    const currentValue = await dataInput.inputValue();
    // Based on the implementation, when data is [], data.map(...) => [], converting to string becomes ''
    expect(currentValue).toBe('');

    // Ensure no uncaught page errors or console errors happened while typing
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test the main Heap Sort button click (HeapSortStart): ensure sortHeap runs and output is updated as per implementation
  test('Clicking Heap Sort triggers sortHeap and updates output (HeapSortStart, transition S0_Idle -> S1_Sorting)', async ({ page }) => {
    const sortButton = await page.locator('#sort-button');
    const dataInput = await page.locator('#data-input');
    const output = await page.locator('#output');

    // Because typing triggers updateData (which will clear the input), set the input value directly
    // Use evaluate to assign value without firing the input event (we are allowed to interact with DOM)
    await page.evaluate(() => {
      const el = document.getElementById('data-input');
      if (el) el.value = '3 1 2';
    });

    // Click the sort button to invoke sortHeap()
    await sortButton.click();

    // According to the implementation, sortHeap:
    // - parses input into numbers,
    // - clears output and appends each original data[i] + ' ' to output,
    // - then calls heapify and heapSort but does not update the output afterwards.
    // Therefore, output will contain the original list as strings separated by spaces and a trailing space.
    await expect(output).toHaveText('3 1 2 ');

    // Validate that the global data array was populated in the page (read-only observation)
    const dataArray = await page.evaluate(() => {
      // Access the page's global 'data' variable; do not modify it.
      return typeof data !== 'undefined' ? data : null;
    });
    expect(Array.isArray(dataArray)).toBe(true);
    expect(dataArray).toEqual([3, 1, 2]);

    // Ensure no uncaught exceptions on clicking sort
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test that calling the input handler after sort (while in Sorting state) will set the input to the stringified data (DataInputChange in S1_Sorting)
  test('After sorting, triggering input event runs updateData and replaces input with data string (S1_Sorting DataInputChange)', async ({ page }) => {
    const sortButton = await page.locator('#sort-button');
    const dataInput = await page.locator('#data-input');

    // Set input value and click main sort to populate the global data array
    await page.evaluate(() => {
      const el = document.getElementById('data-input');
      if (el) el.value = '5 4';
    });
    await sortButton.click();

    // Confirm data was set as expected
    const dataBefore = await page.evaluate(() => data ? data.slice() : null);
    expect(dataBefore).toEqual([5, 4]);

    // Now dispatch an 'input' event programmatically on the data-input element to invoke updateData()
    await page.$eval('#data-input', el => {
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Wait briefly for handler to run
    await page.waitForTimeout(50);

    // updateData sets dataInput.value = data.map(x => x.toString());
    // When an array is assigned to input.value, it becomes its toString() -> "5,4"
    const inputValueAfter = await dataInput.inputValue();
    expect(inputValueAfter).toBe('5,4');

    // No page errors expected
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: Empty input handling: ensure behavior does not throw and output shows parsed value(s)
  test('Edge case: empty input -> heap sort handles gracefully (no crash, output shows parsed result)', async ({ page }) => {
    const sortButton = await page.locator('#sort-button');
    const dataInput = await page.locator('#data-input');
    const output = await page.locator('#output');

    // Ensure input is empty
    await page.evaluate(() => {
      const el = document.getElementById('data-input');
      if (el) el.value = '';
    });

    // Click sort; implementation will call split(' ') -> [''] -> Number('') => 0
    await sortButton.click();

    // Expect output to contain '0 ' (single zero and trailing space)
    await expect(output).toHaveText('0 ');

    // Confirm the page did not raise errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Verify that the additional "pass" buttons exist (components detection) and that clicking them does nothing (no handlers attached)
  test('Additional pass buttons exist and are inert (no handlers) - components presence', async ({ page }) => {
    const btn2 = await page.locator('#sort-button-2');
    const btn3 = await page.locator('#sort-button-3');
    const btn4 = await page.locator('#sort-button-4');
    const btn5 = await page.locator('#sort-button-5');
    const output = await page.locator('#output');

    await expect(btn2).toBeVisible();
    await expect(btn3).toBeVisible();
    await expect(btn4).toBeVisible();
    await expect(btn5).toBeVisible();

    // Capture output before clicks
    const before = await output.textContent();

    // Click each extra button - since no listeners are registered in the implementation, nothing should change
    await btn2.click();
    await btn3.click();
    await btn4.click();
    await btn5.click();

    // Output should remain unchanged and no errors should be thrown
    const after = await output.textContent();
    expect(after).toBe(before);

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Observability test: confirm no uncaught errors throughout the test suite interactions
  test('Observability: ensure no uncaught console or page errors were recorded during interactions', async ({ page }) => {
    // This test intentionally performs a set of common interactions to surface runtime issues.
    // 1) Set input, click sort, dispatch input event, click inert buttons.
    await page.evaluate(() => {
      const el = document.getElementById('data-input');
      if (el) el.value = '7 8 9';
    });

    await page.click('#sort-button');

    // Dispatch input event to run updateData
    await page.$eval('#data-input', el => el.dispatchEvent(new Event('input', { bubbles: true })));

    // Click extra buttons
    await page.click('#sort-button-2');
    await page.click('#sort-button-3');

    // Small delay to allow any asynchronous pageerror or console entries to appear
    await page.waitForTimeout(100);

    // Assert that no page errors or console errors were captured
    expect(pageErrors.length).toBe(0, `Expected no page errors, but found: ${pageErrors.join('\n')}`);
    expect(consoleErrors.length).toBe(0, `Expected no console errors, but found: ${consoleErrors.join('\n')}`);

    // Additionally assert that some console messages may exist but none of type 'error'
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
  });
});