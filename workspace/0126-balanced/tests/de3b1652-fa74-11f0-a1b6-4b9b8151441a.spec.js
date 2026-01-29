import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3b1652-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('Multiset Interactive Application - FSM validation and runtime errors', () => {
  // Collect console and page error messages for each test instance
  test.beforeEach(async ({ page }) => {
    // Nothing needed here globally; individual tests will navigage and attach listeners.
  });

  // Test: Page loads and core UI components are present. Expect initialization errors from broken script.
  test('Initial load: page contains expected components and initialization errors are reported', async ({ page }) => {
    const pageErrors = [];
    const consoleMessages = [];

    // Listen for runtime errors and console messages
    page.on('pageerror', (err) => {
      pageErrors.push(String(err.message || err));
    });
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the page
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Basic DOM assertions: input, three buttons, output area exist and have expected text/labels
    const input = page.locator('#elementInput');
    const addButton = page.locator("button[onclick='addElement()']");
    const removeButton = page.locator("button[onclick='removeElement()']");
    const checkButton = page.locator("button[onclick='checkCount()']");
    const output = page.locator('#output');

    await expect(input).toBeVisible();
    await expect(addButton).toBeVisible();
    await expect(addButton).toHaveText(/Add Element/i);
    await expect(removeButton).toBeVisible();
    await expect(removeButton).toHaveText(/Remove Element/i);
    await expect(checkButton).toBeVisible();
    await expect(checkButton).toHaveText(/Check Count/i);

    // The output area in the provided HTML initially contains descriptive placeholder text.
    await expect(output).toContainText('Multiset will appear here');

    // Allow a short time for page errors (script errors) to be emitted
    await page.waitForTimeout(200); // give the page a moment for synchronous errors

    // We expect at least one page error because the page's script tries to use Multiset which is not defined (the implementation is inside a <pre> block).
    expect(pageErrors.length).toBeGreaterThan(0);

    // Assert that one of the captured error messages indicates that Multiset is not defined
    const combinedErrors = pageErrors.join('\n');
    expect(combinedErrors).toMatch(/Multiset.*not defined/i);

    // Also assert that updateOutput (called on load) produced an error (function likely missing/incomplete)
    expect(combinedErrors).toMatch(/updateOutput.*not defined|updateOutput.*is not a function/i);

    // Record console messages snapshot for debugging/visibility (not asserting specific content beyond capturing)
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });

  // Group tests for each FSM event (AddElement, RemoveElement, CheckCount)
  test.describe('FSM Events: AddElement / RemoveElement / CheckCount - validate transitions (as attempted) and error handling', () => {
    // Test AddElement: clicking the "Add Element" button should attempt to call addElement() and produce a runtime ReferenceError.
    test('AddElement: clicking Add Element triggers missing function error and does not update output', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'load' });

      // Ensure UI present
      const input1 = page.locator('#elementInput');
      const addButton1 = page.locator("button[onclick='addElement()']");
      const output1 = page.locator('#output1');

      await expect(input).toBeVisible();
      await expect(addButton).toBeVisible();

      // Enter an element value as the FSM expects an "element" input
      await input.fill('pear');

      // Wait for the pageerror that should occur when clicking the button because addElement() is not defined
      const [error] = await Promise.all([
        page.waitForEvent('pageerror', { timeout: 2000 }),
        addButton.click()
      ]);

      // Validate that the error message indicates the missing addElement function (ReferenceError)
      expect(String(error.message || error)).toMatch(/addElement.*not defined/i);

      // Confirm that the output area remains unchanged from the initial placeholder (the broken script didn't update it)
      await expect(output).toContainText('Multiset will appear here');
    });

    // Test RemoveElement: clicking the "Remove Element" button should attempt to call removeElement() and produce a runtime ReferenceError.
    test('RemoveElement: clicking Remove Element triggers missing function error and output remains unchanged', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'load' });

      const input2 = page.locator('#elementInput');
      const removeButton1 = page.locator("button[onclick='removeElement()']");
      const output2 = page.locator('#output2');

      await expect(removeButton).toBeVisible();
      await input.fill('banana');

      // Capture the page error triggered by the missing removeElement() handler
      const [error] = await Promise.all([
        page.waitForEvent('pageerror', { timeout: 2000 }),
        removeButton.click()
      ]);

      expect(String(error.message || error)).toMatch(/removeElement.*not defined/i);

      // Output should still show the original placeholder content
      await expect(output).toContainText('Multiset will appear here');
    });

    // Test CheckCount: clicking the "Check Count" button should attempt to call checkCount() and produce a runtime ReferenceError.
    test('CheckCount: clicking Check Count triggers missing function error and does not reveal counts', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'load' });

      const input3 = page.locator('#elementInput');
      const checkButton1 = page.locator("button[onclick='checkCount()']");
      const output3 = page.locator('#output3');

      await expect(checkButton).toBeVisible();
      await input.fill('apple');

      // Capture the page error expected from invoking the undefined checkCount() function
      const [error] = await Promise.all([
        page.waitForEvent('pageerror', { timeout: 2000 }),
        checkButton.click()
      ]);

      expect(String(error.message || error)).toMatch(/checkCount.*not defined/i);

      // Because the count operation did not succeed, the output should remain at its initial placeholder state
      await expect(output).toContainText('Multiset will appear here');
    });
  });

  // Edge cases and additional assertions
  test.describe('Edge cases and additional runtime checks', () => {
    // Clicking buttons with empty input should still fail due to missing handlers; ensure errors occur for these edge interactions as well.
    test('Edge case: clicking Add/Remove/Check with empty input triggers missing function errors', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'load' });

      const addButton2 = page.locator("button[onclick='addElement()']");
      const removeButton2 = page.locator("button[onclick='removeElement()']");
      const checkButton2 = page.locator("button[onclick='checkCount()']");
      const output4 = page.locator('#output4');

      // Click Add with empty input
      const addErrorPromise = page.waitForEvent('pageerror', { timeout: 2000 });
      await addButton.click();
      const addError = await addErrorPromise;
      expect(String(addError.message || addError)).toMatch(/addElement.*not defined/i);
      await expect(output).toContainText('Multiset will appear here');

      // Click Remove with empty input
      const removeErrorPromise = page.waitForEvent('pageerror', { timeout: 2000 });
      await removeButton.click();
      const removeError = await removeErrorPromise;
      expect(String(removeError.message || removeError)).toMatch(/removeElement.*not defined/i);
      await expect(output).toContainText('Multiset will appear here');

      // Click Check with empty input
      const checkErrorPromise = page.waitForEvent('pageerror', { timeout: 2000 });
      await checkButton.click();
      const checkError = await checkErrorPromise;
      expect(String(checkError.message || checkError)).toMatch(/checkCount.*not defined/i);
      await expect(output).toContainText('Multiset will appear here');
    });

    // Validate that updateOutput was attempted at page initialization and produced an error (onEnter action in FSM).
    test('Initialization attempted updateOutput() - expect updateOutput related error on page load', async ({ page }) => {
      const pageErrors1 = [];

      page.on('pageerror', (err) => {
        pageErrors.push(String(err.message || err));
      });

      await page.goto(APP_URL, { waitUntil: 'load' });

      // Wait briefly to ensure synchronous errors are captured
      await page.waitForTimeout(200);

      // At least one of the errors recorded should mention updateOutput being missing or not a function, because the page calls updateOutput() during initialization.
      const foundUpdateOutputError = pageErrors.some((m) => /updateOutput.*not defined|updateOutput.*is not a function/i.test(m));
      expect(foundUpdateOutputError).toBeTruthy();
    });

    // Verify that the page did not silently execute multiset manipulations (since the Multiset class is not defined/executed).
    test('Sanity: Multiset class not available in window scope (implementation is not executed)', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'load' });

      // Using evaluate to inspect the runtime: typeof Multiset should be 'undefined' (no global constructor)
      const typeofMultiset = await page.evaluate(() => {
        // typeof does not throw if symbol absent; it returns 'undefined'
        try {
          return typeof Multiset;
        } catch (e) {
          // If something goes wrong, return a string describing the thrown error for assertion
          return `threw:${String(e && e.message ? e.message : e)}`;
        }
      });

      // Expect 'undefined' because the Multiset implementation resides in a <pre> code block (non-executed) in the HTML.
      expect(typeofMultiset).toBe('undefined');
    });
  });
});