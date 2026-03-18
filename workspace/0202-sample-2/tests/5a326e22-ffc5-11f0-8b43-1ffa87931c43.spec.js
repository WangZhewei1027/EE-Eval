import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a326e22-ffc5-11f0-8b43-1ffa87931c43.html';

test.describe('JavaScript Set Demo - FSM States and Transitions', () => {
  // We'll capture console messages and page errors for each test to validate runtime behavior.
  let consoleMessages;
  let consoleHandler;
  let pageErrors;
  let pageErrorHandler;

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];

    // Handlers to collect console messages and page errors
    consoleHandler = (msg) => {
      // collect console text and type for inspection
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    };
    pageErrorHandler = (err) => {
      // collect Error objects thrown on the page
      pageErrors.push(err);
    };

    // Attach handlers
    page.on('console', consoleHandler);
    page.on('pageerror', pageErrorHandler);

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Ensure listeners are removed to avoid cross-test interference
    page.removeListener('console', consoleHandler);
    page.removeListener('pageerror', pageErrorHandler);

    // As part of teardown verify that no unexpected JS runtime errors occurred
    // Tests will also check this explicitly where relevant.
    expect(pageErrors, 'No page errors should have occurred during the test').toEqual([]);
  });

  test('Initial Idle State: button exists and output is initially empty', async ({ page }) => {
    // This test validates the FSM Idle state (S0_Idle) evidence:
    // - #btn-demo exists and has correct label
    // - #output exists and is empty
    // - No JS runtime errors have occurred on load

    // Verify button presence and label
    const btn = page.locator('#btn-demo');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Run Demo');

    // Verify output container presence and empty content
    const output = page.locator('#output');
    await expect(output).toBeVisible();
    await expect(output).toHaveText('', { timeout: 200 }); // initially empty

    // There should be no console errors or page errors just from loading the page
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleEntries.length, 'No console.error on page load').toBe(0);
    expect(pageErrors.length, 'No page errors on load').toBe(0);
  });

  test('Run Demo Transition: clicking Run Demo updates output demonstrating Set operations', async ({ page }) => {
    // This test triggers the RunDemo event (click on #btn-demo) to move S0_Idle -> S1_DemoRunning
    // It validates the entry action which writes the computed `output` to #output.textContent
    // and checks that the expected Set operations are reflected in the DOM text.

    // Click the Run Demo button
    const btn = page.locator('#btn-demo');
    await expect(btn).toBeVisible();
    await btn.click();

    // Wait for #output to have non-empty content
    const output = page.locator('#output');
    await expect(output).not.toHaveText('', { timeout: 2000 });

    // Retrieve the output text and assert it contains expected pieces
    const text = await output.textContent();
    expect(text, 'Output should be a non-empty string after running demo').toBeTruthy();

    // Expected content checks (these correspond to the demo steps in the implementation)
    expect(text).toContain('Initial set:');
    expect(text).toContain('After adding "mango"');
    expect(text).toContain('After adding duplicate "banana"');
    expect(text).toContain('"apple" is in set? Yes');
    expect(text).toContain('"pear" is in set? No');
    expect(text).toContain('After deleting "orange"');
    expect(text).toContain('Set size:');
    expect(text).toContain('Iterate using for-of:');
    expect(text).toContain('Cleared set size: 0');

    // Confirm no runtime page errors occurred as a result of the click
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleEntries.length, 'No console.error after clicking Run Demo').toBe(0);
    expect(pageErrors.length, 'No page errors after clicking Run Demo').toBe(0);
  });

  test('Idempotent behavior: clicking Run Demo multiple times replaces output (not appending)', async ({ page }) => {
    // This test checks repeated transitions: S0_Idle -> S1_DemoRunning multiple times
    // and verifies that the entry action sets the output to the computed text (replaces previous content).

    const btn = page.locator('#btn-demo');
    const output = page.locator('#output');

    // First click
    await btn.click();
    await expect(output).not.toHaveText('', { timeout: 2000 });
    const firstOutput = (await output.textContent()) || '';

    // Second click
    await btn.click();
    await expect(output).not.toHaveText('', { timeout: 2000 });
    const secondOutput = (await output.textContent()) || '';

    // The demo computes fresh output each click; the content should be equivalent (not appended)
    expect(secondOutput, 'Second output should be the same as the first, indicating replacement').toBe(firstOutput);

    // Ensure that the output does not contain duplicated occurrences of the header 'Initial set:' (should be present once)
    const occurrences = (secondOutput.match(/Initial set:/g) || []).length;
    expect(occurrences, 'The output should not contain duplicate "Initial set:" sections').toBe(1);

    // Confirm no page errors occurred
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleEntries.length, 'No console.error on repeated clicks').toBe(0);
    expect(pageErrors.length, 'No page errors on repeated clicks').toBe(0);
  });

  test('Rapid clicks edge case: multiple rapid clicks do not cause errors and output remains valid', async ({ page }) => {
    // This test simulates rapid user interactions: clicking the Run Demo button multiple times quickly.
    // It asserts that no runtime errors are produced and the final output is consistent.

    const btn = page.locator('#btn-demo');
    const output = page.locator('#output');

    // Rapidly click the button 5 times
    for (let i = 0; i < 5; i++) {
      // schedule clicks with tiny delay - simulate fast user
      await btn.click();
    }

    // Wait for output and grab content
    await expect(output).not.toHaveText('', { timeout: 2000 });
    const finalOutput = (await output.textContent()) || '';

    // Basic sanity checks on final output content
    expect(finalOutput).toContain('Initial set:');
    expect(finalOutput).toContain('After adding "mango"');
    expect(finalOutput).toContain('Cleared set size: 0');

    // Ensure no page errors or console.error entries occurred from rapid interactions
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleEntries.length, 'No console.error from rapid clicks').toBe(0);
    expect(pageErrors.length, 'No page errors from rapid clicks').toBe(0);
  });

  test('FSM transition evidence verification: ensure handler code patterns exist via runtime evaluation', async ({ page }) => {
    // This test validates the FSM evidence by ensuring:
    // - The click handler is installed (clicking triggers change)
    // - The entry action behavior (writing output to #output) is observable
    //
    // Note: We do not modify the page or patch functions; we only trigger and observe.

    // Before clicking, snapshot the empty output
    const output = page.locator('#output');
    await expect(output).toHaveText('', { timeout: 200 });

    // Click to trigger transition
    await page.click('#btn-demo');

    // After clicking, the output must have been set by the handler (entry action)
    await expect(output).not.toHaveText('', { timeout: 2000 });
    const text = await output.textContent();
    expect(text).toContain('Initial set:');

    // Additionally assert that handler evidence likely exists in the inline script by checking that
    // the page's content contains the addEventListener pattern (static check of DOM html).
    const pageHtml = await page.content();
    expect(pageHtml.includes("document.getElementById('btn-demo').addEventListener('click'"), 'Source should contain evidence of click handler registration').toBe(true);

    // Confirm no JS runtime errors happened during this transition
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleEntries.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Negative assertion: no uncaught ReferenceError/SyntaxError/TypeError on load or interaction', async ({ page }) => {
    // This test explicitly asserts that none of the common JS runtime error types occurred.
    // We collect pageErrors and ensure none match these error types.

    // Interact once to ensure any deferred errors would surface
    await page.click('#btn-demo');

    // Wait a short moment to let asynchronous errors surface if any
    await page.waitForTimeout(200);

    // Verify that no page errors occurred
    expect(pageErrors.length, 'Expect zero page errors (ReferenceError, SyntaxError, TypeError, etc.)').toBe(0);

    // Also ensure console.error was not used
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleEntries.length, 'Expect zero console.error messages').toBe(0);
  });
});