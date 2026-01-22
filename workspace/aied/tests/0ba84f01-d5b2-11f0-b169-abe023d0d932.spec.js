import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba84f01-d5b2-11f0-b169-abe023d0d932.html';

test.describe('Set App - FSM validation (Application ID: 0ba84f01-d5b2-11f0-b169-abe023d0d932)', () => {
  // Arrays to capture runtime problems and console error messages observed during page execution
  let pageErrors;
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    // Reset collectors before each test
    pageErrors = [];
    consoleErrors = [];

    // Capture unhandled page errors (runtime exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console.error messages from the page
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : null,
        });
      }
    });

    // Navigate to the exact provided HTML page
    await page.goto(APP_URL);
    // Ensure page loaded
    await expect(page).toHaveURL(APP_URL);
  });

  test.afterEach(async () => {
    // Basic sanity: ensure no unexpected runtime errors happened during the test
    // If any occurred, include them in the assertion failure message for easier debugging.
    expect(pageErrors.length, `Expected no runtime page errors, but found ${pageErrors.length}: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `Expected no console.error messages, but found ${consoleErrors.length}: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
  });

  test('Initial render (S0_Idle): input, Add and Clear buttons present and result is empty', async ({ page }) => {
    // Validate that the initial state (Idle) renders the core components.
    const input = page.locator('#set');
    const addButton = page.locator('#add');
    const clearButton = page.locator('#clear');
    const resultDiv = page.locator('#result');

    await expect(input).toBeVisible();
    await expect(addButton).toBeVisible();
    await expect(addButton).toHaveText('Add');
    await expect(clearButton).toBeVisible();
    await expect(clearButton).toHaveText('Clear');

    // The FSM's Idle state's entry action is renderPage() — here we expect result to be empty on load.
    await expect(resultDiv).toBeVisible();
    await expect(resultDiv).toHaveText('');

    // Also validate the input placeholder matches the described component evidence
    await expect(input).toHaveAttribute('placeholder', 'Enter a set of numbers');
  });

  test('AddClick from Idle transitions to SetUpdated and displays numbers (S0 -> S1)', async ({ page }) => {
    // This test verifies the Add button behavior and the S0_Idle -> S1_SetUpdated transition.
    const input = page.locator('#set');
    const addButton = page.locator('#add');
    const resultDiv = page.locator('#result');

    // Enter a comma-separated list and click Add
    await input.fill('1,2,3');
    await addButton.click();

    // The implementation constructs a Set and displays it as "Set: 1, 2, 3"
    await expect(resultDiv).toHaveText('Set: 1, 2, 3');
  });

  test('AddClick handles duplicates and whitespace producing unique ordered values', async ({ page }) => {
    // Validates that duplicates are removed (Set semantics) and whitespace is tolerated.
    const input = page.locator('#set');
    const addButton = page.locator('#add');
    const resultDiv = page.locator('#result');

    await input.fill('1, 2,2, 3');
    await addButton.click();

    // Expect duplicates removed and order preserved: Set: 1, 2, 3
    await expect(resultDiv).toHaveText('Set: 1, 2, 3');
  });

  test('AddClick with non-numeric tokens results in NaN entries and displays them', async ({ page }) => {
    // Edge case: non-numeric strings => Number(...) yields NaN. The app will show "NaN" in result.
    const input = page.locator('#set');
    const addButton = page.locator('#add');
    const resultDiv = page.locator('#result');

    await input.fill('a,b,2');
    await addButton.click();

    // The numbers array becomes [NaN, NaN, 2] => Set will become [NaN, 2] and displayed as "NaN, 2"
    await expect(resultDiv).toHaveText('Set: NaN, 2');
  });

  test('AddClick with empty input results in 0 (Number("") === 0) and displays Set: 0', async ({ page }) => {
    // Edge case: empty string input should be interpreted as 0 by Number('')
    const input = page.locator('#set');
    const addButton = page.locator('#add');
    const resultDiv = page.locator('#result');

    await input.fill('');
    await addButton.click();

    // Number('') -> 0, so the set shows "Set: 0"
    await expect(resultDiv).toHaveText('Set: 0');
  });

  test('ClearClick from SetUpdated clears the displayed set (S1 -> S2)', async ({ page }) => {
    // Transition: after adding values (S1), clicking Clear should move to S2 with result empty.
    const input = page.locator('#set');
    const addButton = page.locator('#add');
    const clearButton = page.locator('#clear');
    const resultDiv = page.locator('#result');

    await input.fill('4,5');
    await addButton.click();
    await expect(resultDiv).toHaveText('Set: 4, 5');

    // Click Clear and confirm result cleared
    await clearButton.click();
    await expect(resultDiv).toHaveText('');
  });

  test('ClearClick from Idle leaves result empty (S0 -> S2) and does not raise errors', async ({ page }) => {
    // Behavior: clicking Clear when nothing is displayed should keep the result empty and not throw.
    const clearButton = page.locator('#clear');
    const resultDiv = page.locator('#result');

    // Ensure starting state is empty
    await expect(resultDiv).toHaveText('');

    // Click Clear in Idle
    await clearButton.click();

    // Result should remain empty
    await expect(resultDiv).toHaveText('');
  });

  test('Multiple sequential interactions simulate realistic user flow and check state consistency', async ({ page }) => {
    // This test simulates multiple transitions to ensure the FSM behaves consistently.
    const input = page.locator('#set');
    const addButton = page.locator('#add');
    const clearButton = page.locator('#clear');
    const resultDiv = page.locator('#result');

    // 1) Add initial values
    await input.fill('10,20,30');
    await addButton.click();
    await expect(resultDiv).toHaveText('Set: 10, 20, 30');

    // 2) Add a new set of values (overwrites result per implementation)
    await input.fill('5,5,6');
    await addButton.click();
    await expect(resultDiv).toHaveText('Set: 5, 6');

    // 3) Clear the set
    await clearButton.click();
    await expect(resultDiv).toHaveText('');

    // 4) Add after clearing to ensure app still functions after S2 -> S1 via Add
    await input.fill('7');
    await addButton.click();
    await expect(resultDiv).toHaveText('Set: 7');
  });

  // Explicitly test that there were no console.error or page errors during a sample interaction.
  test('Runtime observation: no console.error or page errors during basic interactions', async ({ page }) => {
    // This test focuses purely on observing runtime diagnostics and ensuring no errors occurred.
    const input = page.locator('#set');
    const addButton = page.locator('#add');
    const clearButton = page.locator('#clear');

    await input.fill('1,2,3');
    await addButton.click();
    await clearButton.click();

    // The afterEach hook will assert that pageErrors and consoleErrors are empty.
    // To make the assertion explicit here as well, assert lengths are zero:
    expect(pageErrors.length, `Runtime page errors found: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `Console.error messages found: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
  });

});