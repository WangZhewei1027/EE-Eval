import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324c0030-fa73-11f0-a9d0-d7a1991987c6.html';

test.describe('FSM: JavaScript Array Demonstration (Application ID: 324c0030-fa73-11f0-a9d0-d7a1991987c6)', () => {
  // Containers to capture runtime diagnostics from the page
  let consoleMessages = [];
  let pageErrors = [];

  // Attach listeners for console messages and page errors before each test and navigate to the page
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for later assertions and debugging
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the application as-is (do not modify anything on the page)
    await page.goto(APP_URL);
  });

  // Tear down hook: useful to log diagnostics if a test fails (Playwright already shows them,
  // but having structured assertions below is helpful)
  test.afterEach(async ({}, testInfo) => {
    // If a test fails, attach consoleMessages and pageErrors to test output for debugging
    if (testInfo.status !== testInfo.expectedStatus) {
      testInfo.attach('consoleMessages', {
        body: JSON.stringify(consoleMessages, null, 2),
        contentType: 'application/json',
      });
      testInfo.attach('pageErrors', {
        body: JSON.stringify(pageErrors.map(e => e && e.message ? e.message : String(e)), null, 2),
        contentType: 'application/json',
      });
    }
  });

  test('S0_Idle: Initial render shows Run Array Demo button and empty output', async ({ page }) => {
    // Validate initial (Idle) state as per FSM evidence:
    // - Button with id "run-array-demo" exists and is visible
    // - <pre id="output"> exists and is empty
    const runBtn = await page.waitForSelector('#run-array-demo', { state: 'visible' });
    expect(runBtn).toBeTruthy();
    const buttonText = await runBtn.innerText();
    expect(buttonText.trim()).toBe('Run Array Demo');

    const output = await page.waitForSelector('#output');
    const outputText = await output.innerText();
    // Initial output should be empty
    expect(outputText).toBe('');

    // There should be no uncaught page errors immediately after load
    expect(pageErrors.length).toBe(0);

    // Console messages may be present or empty; assert it's an array
    expect(Array.isArray(consoleMessages)).toBe(true);
  });

  test('Transition: RunArrayDemo_Click moves from Idle to ArrayDemoRunning and displays expected output', async ({ page }) => {
    // This test exercises the FSM transition:
    // - Click the Run Array Demo button (RunArrayDemo_Click)
    // - Expect initializeArray() and displayOutput() to have run (observable: output text populated)
    const runBtn1 = await page.waitForSelector('#run-array-demo', { state: 'visible' });

    // Click the button to trigger the array demo
    await runBtn.click();

    // Wait for output to be populated
    const outputEl = await page.waitForSelector('#output');
    await expect(outputEl).toHaveText(/Original array:/, { timeout: 2000 });

    // Build the exact expected output string based on the implementation
    const expectedOutput =
`Original array: ["Apple","Banana","Cherry"]

After adding Mango: ["Apple","Banana","Cherry","Mango"]
After removing last element: ["Apple","Banana","Cherry"]
First fruit: Apple
All fruits:
1: Apple
2: Banana
3: Cherry
Total number of fruits: 3`;

    const actualOutput = await outputEl.innerText();

    // Verify the output matches the expected text exactly (verifies initializeArray and displayOutput)
    expect(actualOutput).toBe(expectedOutput);

    // Validate that the output contains evidence strings mentioned in the FSM
    expect(actualOutput).toContain('fruits.length'); // Note: not literally in output, but we ensure the number appears
    expect(actualOutput).toContain('Total number of fruits: 3');
    expect(actualOutput).toContain('After adding Mango:');
    expect(actualOutput).toContain('After removing last element:');

    // Ensure no uncaught page errors occurred during the click-handling and output generation
    expect(pageErrors.length).toBe(0);

    // Basic sanity check: console messages were captured (if any). We don't assert specific console messages,
    // because the implementation does not log to console explicitly, but we assert capturing worked.
    expect(Array.isArray(consoleMessages)).toBe(true);
  });

  test('Edge case: Clicking the Run Array Demo button multiple times yields consistent output and no cumulative side-effects', async ({ page }) => {
    // This test ensures idempotency of clicking the demo button multiple times (no unintended accumulation)
    const runBtn2 = await page.waitForSelector('#run-array-demo', { state: 'visible' });
    const outputEl1 = await page.waitForSelector('#output');

    // Click multiple times in quick succession
    await Promise.all([runBtn.click(), runBtn.click(), runBtn.click()]);

    // Wait a short time for DOM updates
    await page.waitForTimeout(200);

    const resultAfterRapidClicks = await outputEl.innerText();

    const expectedOutput1 =
`Original array: ["Apple","Banana","Cherry"]

After adding Mango: ["Apple","Banana","Cherry","Mango"]
After removing last element: ["Apple","Banana","Cherry"]
First fruit: Apple
All fruits:
1: Apple
2: Banana
3: Cherry
Total number of fruits: 3`;

    // Output should remain exactly the same as running it once
    expect(resultAfterRapidClicks).toBe(expectedOutput);

    // Clicking again after a pause should still produce the same result
    await page.waitForTimeout(100);
    await runBtn.click();
    const resultAfterAnotherClick = await outputEl.innerText();
    expect(resultAfterAnotherClick).toBe(expectedOutput);

    // No uncaught runtime errors during repeated interactions
    expect(pageErrors.length).toBe(0);
  });

  test('Behavioral assertion: Event handler exists and triggers DOM update (cannot introspect listener directly)', async ({ page }) => {
    // The FSM evidence mentions: document.getElementById('run-array-demo').addEventListener('click', ...)
    // We cannot introspect event listeners reliably in a cross-browser way without altering page code,
    // so we assert the observable behavior: clicking changes the DOM.
    const runBtn3 = await page.waitForSelector('#run-array-demo', { state: 'visible' });
    const outputEl2 = await page.waitForSelector('#output');

    // Ensure output is empty before click
    expect(await outputEl.innerText()).toBe('');

    // Click triggers change
    await runBtn.click();
    await expect(outputEl).toHaveText(/Original array:/, { timeout: 2000 });

    // Confirm that the output contains the enumerated entries (verifying the loop ran)
    const outputText1 = await outputEl.innerText();
    expect(outputText).toMatch(/All fruits:\n1: Apple\n2: Banana\n3: Cherry/);

    // Still no uncaught errors
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Ensure output element remains present and accessible even when interacting with unrelated elements', async ({ page }) => {
    // This is an artificial interaction: ensure that the output stays stable and accessible
    // We will focus on verifying DOM stability rather than modifying page code.
    const runBtn4 = await page.waitForSelector('#run-array-demo', { state: 'visible' });
    const outputEl3 = await page.waitForSelector('#output');

    // Click to populate output
    await runBtn.click();
    await expect(outputEl).toHaveText(/Original array:/, { timeout: 2000 });

    // Query some attributes/styles to ensure element is still present and not removed
    const nodeName = await page.evaluate(() => document.getElementById('output').nodeName);
    expect(nodeName).toBe('PRE');

    // Check that innerText length corresponds to expected non-empty content
    const len = (await outputEl.innerText()).length;
    expect(len).toBeGreaterThan(10);

    // Confirm there were no runtime errors (ReferenceError/TypeError/SyntaxError) during these interactions
    expect(pageErrors.length).toBe(0);
  });

  test('Diagnostics: capture console and page errors (assert there are no uncaught errors)', async ({ page }) => {
    // This test explicitly demonstrates observation of console and page errors.
    // Per the constraints, we load the page as-is and observe what naturally occurs.
    // We assert that no uncaught errors occurred, which is the expected condition for this implementation.
    // If uncaught errors do appear naturally, this test will fail, surfacing them.

    // Ensure page has loaded
    await page.waitForSelector('#run-array-demo', { state: 'visible' });

    // No interactions, just check diagnostics are empty
    expect(Array.isArray(consoleMessages)).toBe(true);
    expect(pageErrors.length).toBe(0);

    // If there were any console messages, they are captured; assert the captured structure is well-formed
    for (const msg of consoleMessages) {
      expect(msg).toHaveProperty('type');
      expect(msg).toHaveProperty('text');
    }
  });
});