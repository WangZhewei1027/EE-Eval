import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25caecf0-fa7c-11f0-ba20-415c525382ea.html';

test.describe('Understanding Recursion - Factorial demo (FSM validation)', () => {
  let page;
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    // create a new page for each test and attach listeners to capture console and page errors
    page = await browser.newPage();
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') consoleErrors.push(text);
    });

    page.on('pageerror', (err) => {
      // capture runtime exceptions exposed by the page
      pageErrors.push(String(err && err.stack ? err.stack : err));
    });

    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('S0_Idle: page initially shows the Compute factorial(5) button and empty output', async () => {
    // Validate Idle state: button exists and output area is present and empty
    const button = await page.locator('#runFactorialDemo');
    await expect(button).toHaveCount(1);
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Compute factorial(5)');

    const output = await page.locator('#demoOutput');
    await expect(output).toHaveCount(1);
    // output should be empty initially (trim to avoid whitespace differences)
    const initialText = (await output.textContent()) || '';
    expect(initialText.trim()).toBe('', 'Expected output to be empty in Idle state');

    // Assert no page runtime errors occurred during load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0 -> S1 and S1 entry actions: clicking button clears output and shows header', async () => {
    // Ensure we start from initial state
    const output = page.locator('#demoOutput');
    await expect(output).toHaveText('', { useInnerText: true });

    // Click the button to trigger ComputeFactorial event
    await page.click('#runFactorialDemo');

    // After clicking, entry actions for S1 should have cleared the output and added the header
    // Check header text exists
    await expect(output).toContainText('Computing factorial(5):');

    // The very first substantive lines should include "factorial(5) called"
    const text = (await output.textContent()) || '';
    expect(text).toContain('factorial(5) called');

    // Ensure there were still no page errors or console errors while performing the click
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Full FSM flow: S1 -> S2 -> S3 -> S4 verifies base case, returns, and final result', async () => {
    const outputLocator = page.locator('#demoOutput');

    // Click to start computation
    await page.click('#runFactorialDemo');

    // Wait for the final result text to appear in the output (final result line)
    await expect(outputLocator).toContainText('Final result: factorial(5) = 120');

    // Get the entire output content for detailed assertions
    const fullText = (await outputLocator.textContent()) || '';

    // Validate presence of evidence for each FSM state:
    // S1 evidence: 'factorial(5) called' should exist
    expect(fullText).toContain('factorial(5) called');

    // S2 evidence: Base case text for factorial(0)
    expect(fullText).toContain('Base case reached: factorial(0) = 1');

    // S3 evidence: a few return-from-recursive-call lines should exist (check for one and for increasing values)
    expect(fullText).toContain('Return from factorial(0): partial result = 1');
    expect(fullText).toContain('Return from factorial(1): partial result = 2');
    expect(fullText).toContain('Return from factorial(4): partial result = 120');

    // S4 evidence: final result line (already awaited, but assert explicit equality)
    expect(fullText).toMatch(/Final result: factorial\(5\) = 120$/);

    // Validate ordering of messages to ensure recursion trace unwound in sequence:
    const idxHeader = fullText.indexOf('Computing factorial(5):');
    const idxCalled5 = fullText.indexOf('factorial(5) called');
    const idxBaseCase = fullText.indexOf('Base case reached: factorial(0) = 1');
    const idxReturn4 = fullText.indexOf('Return from factorial(4): partial result = 120');
    const idxFinal = fullText.lastIndexOf('Final result: factorial(5) = 120');

    // Header should appear before first call and before base case and final
    expect(idxHeader).toBeGreaterThanOrEqual(0);
    expect(idxCalled5).toBeGreaterThan(idxHeader);
    expect(idxBaseCase).toBeGreaterThan(idxCalled5);
    expect(idxReturn4).toBeGreaterThan(idxBaseCase);
    expect(idxFinal).toBeGreaterThan(idxReturn4);

    // Confirm no runtime errors were emitted during the full flow
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case / error scenario checks: clicking multiple times resets output and remains stable', async () => {
    const outputLocator = page.locator('#demoOutput');

    // First click -> run once
    await page.click('#runFactorialDemo');
    await expect(outputLocator).toContainText('Final result: factorial(5) = 120');

    const firstRun = (await outputLocator.textContent()) || '';
    expect(firstRun.trim().length).toBeGreaterThan(0);

    // Click again to ensure output resets and recomputes (S1 entry action should clear output)
    await page.click('#runFactorialDemo');

    // After second click ensure header present and final result eventually appears again
    await expect(outputLocator).toContainText('Computing factorial(5):');
    await expect(outputLocator).toContainText('Final result: factorial(5) = 120');

    const secondRun = (await outputLocator.textContent()) || '';
    expect(secondRun.trim().length).toBeGreaterThan(0);

    // The outputs between runs should not be identical when comparing start-of-run timestamps (they both compute same content,
    // but we expect the output to have been reset before the second run -> ensure the first run content is not simply duplicated)
    // Check that the second run contains the header at the top (index 0 or near)
    expect(secondRun.indexOf('Computing factorial(5):')).toBeLessThan(10);

    // No page errors on repeated interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Console and page error monitoring: capture and assert no unexpected runtime exceptions', async () => {
    // This test explicitly validates that the page did not produce runtime errors (ReferenceError, TypeError, SyntaxError).
    // The page's script is executed on load. We collected pageErrors and consoleError messages in beforeEach.
    // Assert there were no runtime exceptions captured.
    expect(pageErrors.length).toBe(0, `Expected no page errors, but found: ${JSON.stringify(pageErrors, null, 2)}`);
    expect(consoleErrors.length).toBe(0, `Expected no console errors, but found: ${JSON.stringify(consoleErrors, null, 2)}`);

    // Also inspect general console messages to ensure expected behavior: at least some logs will be absent because script writes to DOM,
    // but confirm that we captured console events array type.
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});