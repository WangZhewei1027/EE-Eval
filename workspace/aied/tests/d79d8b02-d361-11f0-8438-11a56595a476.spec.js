import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79d8b02-d361-11f0-8438-11a56595a476.html';

test.describe('Fibonacci Sequence Demo - FSM tests (d79d8b02-d361-11f0-8438-11a56595a476)', () => {
  // We'll collect console "error" messages and uncaught page errors during each test run.
  // Each test will assert expected UI behavior and also assert that no unexpected JS errors were emitted.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of severity "error"
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught exceptions / page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Basic teardown is handled by Playwright fixtures.
    // But we keep arrays cleared for clarity.
    consoleErrors = consoleErrors || [];
    pageErrors = pageErrors || [];
  });

  test('Initial Idle state renders input, button, and default value', async ({ page }) => {
    // Validate presence of components as evidence that the initial "renderPage()" entry action (document rendering) has occurred.
    const countInput = page.locator('#countInput');
    const generateBtn = page.locator('#generateBtn');
    const resultDiv = page.locator('#result');

    await expect(countInput).toBeVisible();
    await expect(generateBtn).toBeVisible();
    await expect(resultDiv).toBeVisible();

    // Verify input attributes and default value (evidence from FSM)
    await expect(countInput).toHaveAttribute('type', 'number');
    await expect(countInput).toHaveAttribute('min', '1');
    await expect(countInput).toHaveAttribute('max', '100');
    await expect(countInput).toHaveValue('10'); // default value is 10

    // Ensure result area initially empty
    await expect(resultDiv).toHaveText('');

    // Verify there were no console errors or uncaught exceptions during initial render
    expect(consoleErrors.length, 'No console.error messages during initial render').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors during initial render').toBe(0);
  });

  test('Error state: empty input shows "Please enter a positive number (at least 1)."', async ({ page }) => {
    // Clear the input to simulate an empty submission
    const input = page.locator('#countInput');
    const btn = page.locator('#generateBtn');
    const result = page.locator('#result');

    await input.fill(''); // empty value
    await btn.click();

    await expect(result).toHaveText('Please enter a positive number (at least 1).');

    // Assert no unexpected console/page errors
    expect(consoleErrors.length, 'No console.error messages after empty input error').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors after empty input error').toBe(0);
  });

  test('Error state: zero or negative input shows positive number message', async ({ page }) => {
    const input = page.locator('#countInput');
    const btn = page.locator('#generateBtn');
    const result = page.locator('#result');

    // Test zero
    await input.fill('0');
    await btn.click();
    await expect(result).toHaveText('Please enter a positive number (at least 1).');

    // Test negative
    await input.fill('-5');
    await btn.click();
    await expect(result).toHaveText('Please enter a positive number (at least 1).');

    // Assert no unexpected console/page errors
    expect(consoleErrors.length, 'No console.error messages after zero/negative input error').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors after zero/negative input error').toBe(0);
  });

  test('Error state: input greater than 100 shows "Please enter a number less than or equal to 100..."', async ({ page }) => {
    const input = page.locator('#countInput');
    const btn = page.locator('#generateBtn');
    const result = page.locator('#result');

    await input.fill('101');
    await btn.click();

    await expect(result).toHaveText('Please enter a number less than or equal to 100 to avoid long output.');

    // Assert no unexpected console/page errors
    expect(consoleErrors.length, 'No console.error messages after >100 input error').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors after >100 input error').toBe(0);
  });

  test('Result state: n=1 returns a single term and singular "term" label', async ({ page }) => {
    const input = page.locator('#countInput');
    const btn = page.locator('#generateBtn');
    const result = page.locator('#result');

    await input.fill('1');
    await btn.click();

    // Expect grammar "term" (not "terms") and the single Fibonacci number 0
    await expect(result).toHaveText('First 1 term of the Fibonacci sequence:\n0');

    // No runtime errors expected
    expect(consoleErrors.length, 'No console.error messages after n=1 result').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors after n=1 result').toBe(0);
  });

  test('Result state: n=2 returns two terms "0, 1" and plural "terms"', async ({ page }) => {
    const input = page.locator('#countInput');
    const btn = page.locator('#generateBtn');
    const result = page.locator('#result');

    await input.fill('2');
    await btn.click();

    await expect(result).toHaveText('First 2 terms of the Fibonacci sequence:\n0, 1');

    // No runtime errors expected
    expect(consoleErrors.length, 'No console.error messages after n=2 result').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors after n=2 result').toBe(0);
  });

  test('Result state: n=10 returns expected first 10 Fibonacci numbers', async ({ page }) => {
    // Default value is 10, but set explicitly to be explicit in test
    const input = page.locator('#countInput');
    const btn = page.locator('#generateBtn');
    const result = page.locator('#result');

    await input.fill('10');
    await btn.click();

    // The first 10 Fibonacci numbers: 0, 1, 1, 2, 3, 5, 8, 13, 21, 34
    await expect(result).toContainText('First 10 terms of the Fibonacci sequence:');
    await expect(result).toContainText('0, 1, 1, 2, 3, 5, 8, 13, 21, 34');

    // Ensure newline present between heading and numbers (pre-wrap used)
    const text = await result.textContent();
    expect(text.includes('\n'), 'Result text contains a newline between heading and numbers').toBe(true);

    // No runtime errors expected
    expect(consoleErrors.length, 'No console.error messages after n=10 result').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors after n=10 result').toBe(0);
  });

  test('Formatting: n=17 includes formatted number with comma (e.g., "1,597")', async ({ page }) => {
    // 17th Fibonacci number is 1597 which should be formatted as "1,597" by toLocaleString
    const input = page.locator('#countInput');
    const btn = page.locator('#generateBtn');
    const result = page.locator('#result');

    await input.fill('17');
    await btn.click();

    const text = await result.textContent();
    expect(text).toContain('1,597', 'Large Fibonacci numbers are formatted with commas using toLocaleString()');

    // Also verify correct heading
    expect(text).toContain('First 17 terms of the Fibonacci sequence:');

    // No runtime errors expected
    expect(consoleErrors.length, 'No console.error messages after n=17 result').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors after n=17 result').toBe(0);
  });

  test('Decimal input: "5.7" is parsed with parseInt and treated as 5', async ({ page }) => {
    // parseInt should coerce "5.7" to 5, therefore we expect first 5 terms
    const input = page.locator('#countInput');
    const btn = page.locator('#generateBtn');
    const result = page.locator('#result');

    await input.fill('5.7');
    await btn.click();

    await expect(result).toContainText('First 5 terms of the Fibonacci sequence:');
    await expect(result).toContainText('0, 1, 1, 2, 3');

    // No runtime errors expected
    expect(consoleErrors.length, 'No console.error messages after decimal input handling').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors after decimal input handling').toBe(0);
  });

  test('Collective check: no uncaught console errors or page errors occurred during full interaction suite', async ({ page }) => {
    // This test navigates and performs a small sequence to ensure that console/page errors
    // continue to not appear across interactions (an extra guard).
    const input = page.locator('#countInput');
    const btn = page.locator('#generateBtn');
    const result = page.locator('#result');

    await input.fill('8');
    await btn.click();
    await expect(result).toContainText('First 8 terms of the Fibonacci sequence:');

    await input.fill('');
    await btn.click();
    await expect(result).toHaveText('Please enter a positive number (at least 1).');

    // At the end assert there were no console "error" messages and no page errors.
    expect(consoleErrors.length, 'No console.error messages during collective interactions').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors during collective interactions').toBe(0);
  });
});