import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3bd9a3-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('Ternary Search Demonstration (Application ID: de3bd9a3-fa74-11f0-a1b6-4b9b8151441a)', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page (load exactly as-is)
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // No additional teardown required; Playwright handles context cleanup.
    // This hook exists to make it explicit that each test is isolated.
  });

  // -------------------------
  // State: S0_Idle (Initial)
  // -------------------------
  test('Idle state: initial render shows inputs, default values, and placeholder result', async ({ page }) => {
    // Validate initial input values and placeholder result - corresponds to S0 entry action (renderPage())
    const arrayInput = page.locator('#arrayInput');
    const targetInput = page.locator('#targetInput');
    const resultDiv = page.locator('#result');
    const stepsDiv = page.locator('#steps');

    // Check inputs have default values from HTML
    await expect(arrayInput).toHaveValue('1, 3, 5, 7, 9, 11, 13, 15, 17, 19');
    await expect(targetInput).toHaveValue('11');

    // Initial result placeholder text
    await expect(resultDiv).toHaveText(/Results will appear here.../);

    // Steps area should be empty initially
    await expect(stepsDiv.locator('.step')).toHaveCount(0);

    // Observe that no runtime page errors occurred on initial load
    expect(pageErrors.length).toBe(0);
    // Also expect no console errors were emitted during load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // -------------------------
  // Transition: S0_Idle -> S1_Searching (RunTernarySearch event)
  // -------------------------
  test('Run Ternary Search: clicking the button triggers search and displays results and steps (found case)', async ({ page }) => {
    // This test validates:
    // - Clicking the Run Ternary Search button triggers runTernarySearch()
    // - The search runs (searching state) and then results are displayed (result displayed state)
    // - Steps are rendered in the steps container
    const runButton = page.locator("button[onclick='runTernarySearch()']");
    const resultDiv1 = page.locator('#result');
    const stepsDiv1 = page.locator('#steps');

    // Ensure pre-click state does not show "Found at index"
    await expect(resultDiv).not.toContainText('Found at index');

    // Click the button to start search (this moves S0 -> S1 and then should lead to S2)
    await runButton.click();

    // After clicking, the result area should be populated with array, target, result, and time taken.
    await expect(resultDiv).toContainText('Array:');
    await expect(resultDiv).toContainText('Target:');
    // The default target 11 exists in the default array; expect "Found at index"
    await expect(resultDiv).toContainText(/Found at index/);

    // Verify that steps were generated and appended as .step elements
    const stepElements = stepsDiv.locator('.step');
    await expect(stepElements).toHaveCountGreaterThan(0);
    // First step should indicate a dividing of the search range (evidence of ternary search execution)
    await expect(stepElements.first()).toContainText(/Dividing search range/);

    // No runtime exceptions should have occurred during this normal run
    expect(pageErrors.length).toBe(0);
    const consoleErrors1 = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // -------------------------
  // Edge case: Target not present in array
  // -------------------------
  test('Searching for a non-existent target displays Not found and includes final "Target not found" step', async ({ page }) => {
    // This test validates the algorithm path where the target is not in the array.
    const targetInput1 = page.locator('#targetInput1');
    const runButton1 = page.locator("button[onclick='runTernarySearch()']");
    const resultDiv2 = page.locator('#result');
    const stepsDiv2 = page.locator('#steps');

    // Set target to a value not in the default array (e.g., 4)
    await targetInput.fill('4');

    // Click to run search
    await runButton.click();

    // Expect result to indicate "Not found"
    await expect(resultDiv).toContainText('Not found');

    // Steps should include the final message 'Target not found in the array.'
    const stepElements1 = stepsDiv.locator('.step');
    await expect(stepElements).toHaveCountGreaterThan(0);
    // Look for the final step text among steps
    const stepsText = await stepsDiv.innerText();
    expect(stepsText).toMatch(/Target not found in the array\./);

    // Ensure no runtime page errors occurred during this path
    expect(pageErrors.length).toBe(0);
    const consoleErrors2 = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // -------------------------
  // Event: InputValidationFailed (invalid inputs)
  // -------------------------
  test('Input validation failed: invalid array input shows validation message and does not produce steps', async ({ page }) => {
    // This test validates the InputValidationFailed event path:
    // - When array or target input contains invalid numbers, the app should display a validation message
    // - Steps area should remain empty (no search executed)
    const arrayInput1 = page.locator('#arrayInput1');
    const targetInput2 = page.locator('#targetInput2');
    const runButton2 = page.locator("button[onclick='runTernarySearch()']");
    const resultDiv3 = page.locator('#result');
    const stepsDiv3 = page.locator('#steps');

    // Introduce an invalid token in the array input
    await arrayInput.fill('1, 2, three, 4');
    // Make sure the target is also something valid or invalid; we'll keep it valid to isolate array invalidation
    await targetInput.fill('3');

    // Click to attempt search
    await runButton.click();

    // Expect validation message for invalid numbers
    await expect(resultDiv).toHaveText('Please enter valid numbers for both array and target.');

    // Steps should remain empty because the search should not have been executed
    await expect(stepsDiv.locator('.step')).toHaveCount(0);

    // Ensure no runtime page errors occurred just from validation path
    expect(pageErrors.length).toBe(0);
    const consoleErrors3 = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // -------------------------
  // Additional verification: re-run after invalid input to ensure transition behavior
  // -------------------------
  test('After validation failure, correcting input and re-running proceeds to display results and steps', async ({ page }) => {
    // This test validates a sequence of transitions:
    // S0 (idle) -> invalid input -> validation failure -> user corrects input -> run -> S1/S2 and results shown
    const arrayInput2 = page.locator('#arrayInput2');
    const targetInput3 = page.locator('#targetInput3');
    const runButton3 = page.locator("button[onclick='runTernarySearch()']");
    const resultDiv4 = page.locator('#result');
    const stepsDiv4 = page.locator('#steps');

    // Start with invalid input
    await arrayInput.fill('bad, data, here');
    await targetInput.fill('abc'); // invalid target as well

    // Attempt to run - should show validation message
    await runButton.click();
    await expect(resultDiv).toHaveText('Please enter valid numbers for both array and target.');
    await expect(stepsDiv.locator('.step')).toHaveCount(0);

    // Now correct inputs back to valid defaults
    await arrayInput.fill('1, 3, 5, 7, 9, 11');
    await targetInput.fill('11');

    // Re-run the search
    await runButton.click();

    // Expect result area to show found index for 11
    await expect(resultDiv).toContainText(/Found at index/);
    // Steps should now be present and include dividing messages
    await expect(stepsDiv.locator('.step')).toHaveCountGreaterThan(0);
    await expect(stepsDiv.locator('.step').first()).toContainText(/Dividing search range/);

    // Confirm no runtime exceptions occurred throughout the sequence
    expect(pageErrors.length).toBe(0);
    const consoleErrors4 = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // -------------------------
  // Observability test: ensure no hidden runtime errors or unexpected console errors
  // -------------------------
  test('Observability: page emits no console.error or uncaught exceptions during a typical run', async ({ page }) => {
    // This test simply runs a normal search and asserts that the page produced no console errors or uncaught exceptions.
    const runButton4 = page.locator("button[onclick='runTernarySearch()']");
    const resultDiv5 = page.locator('#result');
    const stepsDiv5 = page.locator('#steps');

    // Run the search using defaults
    await runButton.click();

    // Wait for result and steps to appear
    await expect(resultDiv).toContainText('Target:');
    await expect(stepsDiv.locator('.step')).toHaveCountGreaterThan(0);

    // Assert no page errors captured
    expect(pageErrors.length).toBe(0);

    // Assert no console.error messages were emitted
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMsgs.length).toBe(0);
  });
});