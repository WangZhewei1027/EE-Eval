import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3dae65-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('Static Typing Demonstration (FSM) - de3dae65-fa74-11f0-a1b6-4b9b8151441a', () => {
  // Containers for observed console messages and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  // Setup: for each test, create fresh listeners and navigate to the page
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (info/warn/error) so tests can assert on them
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture unhandled page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Teardown: no special teardown required since Playwright handles cleanup per test

  test('S0_Idle initial render - default texts are present before simulated events', async ({ page }) => {
    // Validate initial static/placeholder texts as rendered by the HTML before timeouts fire
    // This asserts the initial "Idle" state content (S0_Idle)
    const typeAnnotation = page.locator('#type-annotation-result');
    const typeSafety = page.locator('#type-safety-result');
    const functionParams = page.locator('#function-params-result');
    const returnType = page.locator('#return-type-result');

    // The initial HTML places these placeholder texts; test they match expectations.
    await expect(typeAnnotation).toHaveText(/Checking type annotations\.\.\./, { timeout: 1000 });
    await expect(typeSafety).toHaveText(/Attempting incorrect type assignment\.\.\./, { timeout: 1000 });
    await expect(functionParams).toHaveText(/Testing function parameter types\.\.\./, { timeout: 1000 });
    await expect(returnType).toHaveText(/Verifying function return types\.\.\./, { timeout: 1000 });

    // Ensure no uncaught page errors occurred during initial load
    expect(pageErrors.length).toBe(0);
  });

  test('Transitions and state updates: S1 -> S2 -> S3 -> S4 (validate DOM updates and classes)', async ({ page }) => {
    // This test validates that the simulated events (the setTimeout callback in the page)
    // update the DOM to reflect each FSM state's evidence. The page's script runs a
    // setTimeout after 500ms which calls the functions that update the DOM.

    const typeAnnotation = page.locator('#type-annotation-result');
    const typeSafety = page.locator('#type-safety-result');
    const functionParams = page.locator('#function-params-result');
    const returnType = page.locator('#return-type-result');

    // Wait for the page's scheduled work to complete.
    // The page uses setTimeout(..., 500) to run all tests; give a margin.
    await page.waitForTimeout(1200);

    // S1 - Type Annotations Checked
    // Expect the type annotation paragraph to indicate success and display types.
    await expect(typeAnnotation).toContainText('Types declared successfully');
    await expect(typeAnnotation).toContainText('message: string');
    await expect(typeAnnotation).toContainText('count: number');
    await expect(typeAnnotation).toContainText('flag: boolean');

    // S2 - Type Safety Tested
    // The script sets className to 'error' and writes a message describing that the
    // expected TypeScript-style error does not occur in plain JavaScript.
    await expect(typeSafety).toHaveClass(/error/);
    await expect(typeSafety).toContainText('Expected type error did NOT occur in JavaScript');
    await expect(typeSafety).toContainText('In JavaScript, num is now: string');

    // S3 - Function Parameters Tested
    // The script sets className to 'error' and writes that addNumbers(5, "hello") produced a value.
    await expect(functionParams).toHaveClass(/error/);
    await expect(functionParams).toContainText('In JavaScript: No error for wrong parameter type!');
    // The result of 5 + 'hello' should be the string '5hello'
    await expect(functionParams).toContainText('addNumbers(5, "hello") = 5hello');

    // S4 - Return Types Tested
    // Note: The page's implementation uses string concatenation with '${age}' placeholders
    // (not template literals), so the output will literally contain ${age} and ${badAge}.
    await expect(returnType).toHaveClass(/error/);
    await expect(returnType).toContainText('In JavaScript: No error for wrong return type!');
    // Assert presence of the literal placeholders to show the implementation detail/bug
    await expect(returnType).toContainText(/\$\{age\}/);
    await expect(returnType).toContainText(/\$\{badAge\}/);

    // Ensure no uncaught page errors occurred while running the simulated checks
    // Collect any page errors captured by the pageerror handler.
    expect(pageErrors.length).toBe(0);

    // Inspect console messages for unexpected errors; assert none of type 'error'
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge cases & implementation artifacts: verify literal-template bug and value coercions', async ({ page }) => {
    // This test focuses on validating observable implementation quirks highlighted in the FSM:
    // - The return-type output contains literal ${...} placeholders (a bug in the demo).
    // - The function parameter misuse demonstrates JS coercion (5 + "hello" => "5hello").

    const functionParams = page.locator('#function-params-result');
    const returnType = page.locator('#return-type-result');

    // Wait for scheduled script to run
    await page.waitForTimeout(1200);

    // Validate that the function-params paragraph indeed shows the coerced value '5hello'
    await expect(functionParams).toContainText(/addNumbers\(5, "hello"\) = 5hello/);

    // Validate that the return-type paragraph contains the literal ${age}, ${badAge}
    // indicating the code used single-quoted strings with ${...} placeholders (not evaluated).
    const returnText = await returnType.textContent();
    expect(returnText).toBeTruthy();
    expect(returnText).toMatch(/\$\{age\}/);
    expect(returnText).toMatch(/\$\{badAge\}/);

    // There should be no runtime exceptions thrown for these edge cases (the demo intentionally shows JS allowing them)
    expect(pageErrors.length).toBe(0);
  });

  test('Console & page error observation - report any runtime issues', async ({ page }) => {
    // This test explicitly asserts on console messages and page errors captured during
    // page load and the scheduled test runs. It is important to observe and assert the
    // natural runtime behavior without modifying the page.

    // Wait a little longer to ensure all scheduled tasks and potential async errors complete
    await page.waitForTimeout(1500);

    // Assert that no uncaught exceptions were raised (pageerror). If there were,
    // fail the test but include the messages in the failure output (Playwright will surface).
    if (pageErrors.length > 0) {
      // Fail with useful debugging info
      const joined = pageErrors.map(e => String(e)).join('\n---\n');
      throw new Error('Unexpected page errors detected:\n' + joined);
    }

    // Check for console errors; if any are present, fail and show them.
    const errors = consoleMessages.filter(m => m.type === 'error');
    if (errors.length > 0) {
      const joined = errors.map(e => e.text).join('\n---\n');
      throw new Error('Console error messages detected:\n' + joined);
    }

    // As a final assertion: ensure we observed at least some console/page activity (optional)
    // (Not required, but helpful to ensure our listeners were active)
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});