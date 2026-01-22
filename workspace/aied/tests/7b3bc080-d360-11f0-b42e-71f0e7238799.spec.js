import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3bc080-d360-11f0-b42e-71f0e7238799.html';

test.describe('Binary Search Visualization - FSM tests (App ID: 7b3bc080-d360-11f0-b42e-71f0e7238799)', () => {
  // Capture console messages and page errors for each test to assert runtime behavior
  test.beforeEach(async ({ page }) => {
    // Reset any previous handlers is handled by Playwright automatically per test.
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test('S0_Idle: Page loads with initial UI elements and content (Idle state)', async ({ page }) => {
    // Validate static content described by S0_Idle evidence
    const heading = page.locator('h1');
    await expect(heading).toHaveText('Binary Search Visualization');

    const paragraph = page.locator('p');
    await expect(paragraph).toContainText('Enter a sorted array of numbers and a target number');

    // Inputs and result div exist and are present
    const arrayInput = page.locator('#array');
    const targetInput = page.locator('#target');
    const resultDiv = page.locator('#result');
    const searchButton = page.locator('button[onclick="binarySearch()"]');

    await expect(arrayInput).toBeVisible();
    await expect(targetInput).toBeVisible();
    await expect(searchButton).toBeVisible();
    await expect(resultDiv).toBeVisible();

    // On initial load result should be empty
    await expect(resultDiv).toHaveText('');

    // Verify button has the expected onclick attribute as per FSM evidence
    const onclick = await searchButton.getAttribute('onclick');
    await expect(onclick).toBe('binarySearch()');
  });

  test.describe('Search interactions and transitions (S0 -> S1 -> S2)', () => {
    test('Transition: Found target in array yields correct result message', async ({ page }) => {
      // Capture console and page errors for this scenario
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', (err) => pageErrors.push(err));

      // Provide a sorted array and a target that exists
      await page.fill('#array', '1,2,3,4,5');
      await page.fill('#target', '3');

      // Click the Search button (this triggers binarySearch() per FSM event SearchClick)
      await page.click('button[onclick="binarySearch()"]');

      // The S2_ResultDisplayed evidence expects a found message
      const resultDiv = page.locator('#result');
      await expect(resultDiv).toHaveText('Target 3 found at index 2 in the array.');

      // Ensure no runtime page errors were thrown (ReferenceError/SyntaxError/TypeError)
      // We observe console and page errors and assert none of the critical error types occurred.
      const criticalErrors = pageErrors.filter(e =>
        e instanceof Error && (e.name === 'ReferenceError' || e.name === 'SyntaxError' || e.name === 'TypeError')
      );
      expect(criticalErrors.length).toBe(0);

      // Also ensure no console.error with those error names were emitted
      const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error' &&
        (m.text.includes('ReferenceError') || m.text.includes('SyntaxError') || m.text.includes('TypeError')));
      expect(consoleErrorMsgs.length).toBe(0);
    });

    test('Transition: Target not present yields "not found" message', async ({ page }) => {
      // Setup console and pageerror listeners
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', (err) => pageErrors.push(err));

      // Provide array and target that does NOT exist
      await page.fill('#array', '10,20,30');
      await page.fill('#target', '5');
      await page.click('button[onclick="binarySearch()"]');

      const resultDiv = page.locator('#result');
      await expect(resultDiv).toHaveText('Target 5 not found in the array.');

      // Assert there are no critical runtime errors
      const criticalErrors = pageErrors.filter(e =>
        e instanceof Error && (e.name === 'ReferenceError' || e.name === 'SyntaxError' || e.name === 'TypeError')
      );
      expect(criticalErrors.length).toBe(0);

      const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error' &&
        (m.text.includes('ReferenceError') || m.text.includes('SyntaxError') || m.text.includes('TypeError')));
      expect(consoleErrorMsgs.length).toBe(0);
    });
  });

  test.describe('Edge cases and additional behaviors', () => {
    test('Empty array input and/or empty target should gracefully result in "not found"', async ({ page }) => {
      // Listeners to capture any runtime issues
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', (err) => pageErrors.push(err));

      // Case A: completely empty inputs
      await page.fill('#array', '');
      await page.fill('#target', '');
      await page.click('button[onclick="binarySearch()"]');

      const resultDiv = page.locator('#result');
      // If target is empty, parseInt('') yields NaN so result should be "not found"
      await expect(resultDiv).toHaveText('Target NaN not found in the array.');

      // Case B: array empty string but numeric target
      await page.fill('#array', '');
      await page.fill('#target', '1');
      await page.click('button[onclick="binarySearch()"]');
      await expect(resultDiv).toHaveText('Target 1 not found in the array.');

      // Case C: array containing empty element becomes [NaN] -> still not found
      await page.fill('#array', ',');
      await page.fill('#target', '0');
      await page.click('button[onclick="binarySearch()"]');
      await expect(resultDiv).toHaveText('Target 0 not found in the array.');

      // Ensure no critical runtime errors occurred during these edge interactions
      const criticalErrors = pageErrors.filter(e =>
        e instanceof Error && (e.name === 'ReferenceError' || e.name === 'SyntaxError' || e.name === 'TypeError')
      );
      expect(criticalErrors.length).toBe(0);

      const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error' &&
        (m.text.includes('ReferenceError') || m.text.includes('SyntaxError') || m.text.includes('TypeError')));
      expect(consoleErrorMsgs.length).toBe(0);
    });

    test('Unsorted input is sorted internally; verify index matches sorted order', async ({ page }) => {
      // Verify behavior when user provides unsorted array per FSM expectation that array is sorted internally
      await page.fill('#array', '5,1,4,2,3'); // unsorted
      await page.fill('#target', '4');
      await page.click('button[onclick="binarySearch()"]');

      // The script sorts the array ascending -> [1,2,3,4,5]; 4 is at index 3
      const resultDiv = page.locator('#result');
      await expect(resultDiv).toHaveText('Target 4 found at index 3 in the array.');
    });

    test('Array with duplicates: ensure binary search finds one of the duplicate indices', async ({ page }) => {
      // Duplicates 2,2,2,2 -> length 4 -> mid initially floor((0+3)/2)=1 -> expect index 1
      await page.fill('#array', '2,2,2,2');
      await page.fill('#target', '2');
      await page.click('button[onclick="binarySearch()"]');

      const resultDiv = page.locator('#result');
      await expect(resultDiv).toHaveText('Target 2 found at index 1 in the array.');
    });
  });

  test('FSM-specific assertions: verify transitions and UI evidence presence', async ({ page }) => {
    // This test cross-checks FSM evidence and transitions:
    // - S0_Idle evidence: presence of header and paragraph (checked earlier, repeated for completeness)
    await expect(page.locator('h1')).toHaveText('Binary Search Visualization');
    await expect(page.locator('p')).toContainText('Enter a sorted array of numbers and a target number');

    // - S1_InputReceived evidence: we can only observe input values, not internal JS variables
    await page.fill('#array', '1,3,5');
    await page.fill('#target', '3');

    // Read back values to assert the UI reflects inputs (translating to S1 state)
    const arrayValue = await page.inputValue('#array');
    const targetValue = await page.inputValue('#target');
    expect(arrayValue).toBe('1,3,5');
    expect(targetValue).toBe('3');

    // - Trigger SearchClick event (transition S1 -> S2)
    await page.click('button[onclick="binarySearch()"]');

    // Final evidence: result div updated
    await expect(page.locator('#result')).toHaveText('Target 3 found at index 1 in the array.');
  });
});