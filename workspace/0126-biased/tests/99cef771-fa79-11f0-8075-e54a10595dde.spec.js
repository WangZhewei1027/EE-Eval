import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cef771-fa79-11f0-8075-e54a10595dde.html';

// Page Object Model for the Jump Search page
class JumpSearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.lengthInput = page.locator('#length');
    this.targetInput = page.locator('#target');
    this.generateButton = page.locator('#generate');
    this.searchButton = page.locator('#search');
    this.arrayOutput = page.locator('#arrayOutput');
    this.output = page.locator('#output');
    this.header = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getHeaderText() {
    return this.header.innerText();
  }

  async setLength(value) {
    // Use fill to directly set the input's value (even if not strictly numeric)
    await this.lengthInput.fill(String(value));
    // Ensure the DOM reflects the change by blurring
    await this.lengthInput.evaluate((el) => el.blur());
  }

  async setTarget(value) {
    await this.targetInput.fill(String(value));
    await this.targetInput.evaluate((el) => el.blur());
  }

  async clickGenerate() {
    await this.generateButton.click();
  }

  async clickSearch() {
    await this.searchButton.click();
  }

  async getArrayOutputText() {
    return this.arrayOutput.innerText();
  }

  async getOutputText() {
    return this.output.innerText();
  }
}

test.describe('Jump Search Demonstration - FSM tests (99cef771-fa79-11f0-8075-e54a10595dde)', () => {
  let pageErrors = [];
  let consoleErrors = [];

  // Setup a fresh page and page object for each test
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Collect runtime page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Collect console messages with severity 'error'
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : undefined,
        });
      }
    });
  });

  // Smoke test: initial Idle state S0_Idle
  test('S0_Idle - initial render shows header and empty outputs', async ({ page }) => {
    // This test validates the initial state (S0_Idle) entry action renderPage()
    const app = new JumpSearchPage(page);
    await app.goto();

    // Verify the main heading is present as evidence of S0_Idle
    await expect(await app.getHeaderText()).toContain('Jump Search Demonstration');

    // On initial load, both display areas should be empty
    await expect(await app.getArrayOutputText()).toBe('');
    await expect(await app.getOutputText()).toBe('');

    // Assert no page runtime errors or console errors occurred during initial render
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test the Generate Array transition: S0_Idle -> S1_ArrayGenerated
  test('Generate Array transitions to S1_ArrayGenerated and displays generated array', async ({ page }) => {
    // Validates the GenerateArray event and S1 entry evidence
    const app = new JumpSearchPage(page);
    await app.goto();

    const length = 15;
    await app.setLength(length);
    await app.clickGenerate();

    // Expect arrayOutput to contain the JSON representation of [0,1,...,length-1]
    const expectedArray = JSON.stringify(Array.from({ length }, (_, i) => i));
    await expect(await app.getArrayOutputText()).toBe(expectedArray);

    // Output should be cleared after generating a new array (per implementation)
    await expect(await app.getOutputText()).toBe('');

    // Verify no runtime errors were logged
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test Jump Search event success: S1_ArrayGenerated -> S2_SearchPerformed (found)
  test('Jump Search finds an existing element and transitions to S2_SearchPerformed (found)', async ({ page }) => {
    // Validates performing the JumpSearch event with a target that exists
    const app = new JumpSearchPage(page);
    await app.goto();

    // Generate an array of length 10
    await app.setLength(10);
    await app.clickGenerate();

    // Search for a known element (7)
    await app.setTarget(7);
    await app.clickSearch();

    // Expect the output to indicate the element was found at index 7
    await expect(await app.getOutputText()).toBe('Element found at index: 7');

    // The generated array should remain displayed
    const expectedArray = JSON.stringify(Array.from({ length: 10 }, (_, i) => i));
    await expect(await app.getArrayOutputText()).toBe(expectedArray);

    // Ensure no runtime errors occurred
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test Jump Search event not found: S1_ArrayGenerated -> S2_SearchPerformed (not found)
  test('Jump Search reports not found when target is absent', async ({ page }) => {
    // Validates performing the JumpSearch event with a target that does not exist
    const app = new JumpSearchPage(page);
    await app.goto();

    // Generate an array of length 5
    await app.setLength(5);
    await app.clickGenerate();

    // Search for a target outside the array range
    await app.setTarget(10);
    await app.clickSearch();

    // Expect "Element not found."
    await expect(await app.getOutputText()).toBe('Element not found.');

    // No runtime errors allowed
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: perform search before generating array (array is empty) -> should gracefully report not found
  test('Edge case: Search before Generate should report not found (handles empty array)', async ({ page }) => {
    // Validates behavior when JumpSearch is invoked without generating the array first
    const app = new JumpSearchPage(page);
    await app.goto();

    // Ensure we have not generated an array; arrayOutput should be empty
    await expect(await app.getArrayOutputText()).toBe('');

    // Search for target 0 (default)
    await app.setTarget(0);
    await app.clickSearch();

    // Expect not found because array is empty
    await expect(await app.getOutputText()).toBe('Element not found.');

    // Verify no runtime exceptions or console errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: Invalid length input (non-numeric) should produce an empty array and not crash
  test('Edge case: Invalid length input (non-numeric) results in empty array and no crash', async ({ page }) => {
    // Set length to an invalid non-numeric value and generate
    const app = new JumpSearchPage(page);
    await app.goto();

    // Fill the length input with a non-numeric string
    await app.setLength('abc');
    await app.clickGenerate();

    // Expect the generated array to be "[]" (parseInt('abc') -> NaN -> Array.from({length: NaN}) -> [])
    await expect(await app.getArrayOutputText()).toBe('[]');

    // Output should be cleared
    await expect(await app.getOutputText()).toBe('');

    // Searching afterwards should still be safe and report not found
    await app.setTarget(0);
    await app.clickSearch();
    await expect(await app.getOutputText()).toBe('Element not found.');

    // No runtime errors should be present
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: Minimal length (1) and searching both present and absent targets
  test('Edge case: length=1 behavior (target 0 found, other targets not found)', async ({ page }) => {
    const app = new JumpSearchPage(page);
    await app.goto();

    // length = 1
    await app.setLength(1);
    await app.clickGenerate();

    // Target 0 should be found at index 0
    await app.setTarget(0);
    await app.clickSearch();
    await expect(await app.getOutputText()).toBe('Element found at index: 0');

    // Target 1 should not be found
    await app.setTarget(1);
    await app.clickSearch();
    await expect(await app.getOutputText()).toBe('Element not found.');

    // No runtime errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Final test: confirm that throughout interactions there were no uncaught page errors or console errors
  test('No unexpected runtime errors or console errors across interactions', async ({ page }) => {
    const app = new JumpSearchPage(page);
    await app.goto();

    // Perform a sequence of interactions to exercise code paths
    await app.setLength(20);
    await app.clickGenerate();

    await app.setTarget(19);
    await app.clickSearch();
    await expect(await app.getOutputText()).toBe('Element found at index: 19');

    await app.setTarget(1000);
    await app.clickSearch();
    await expect(await app.getOutputText()).toBe('Element not found.');

    // Mutate length to an edge value and regenerate
    await app.setLength(2);
    await app.clickGenerate();
    await expect(await app.getArrayOutputText()).toBe(JSON.stringify([0, 1]));

    // Assert that no page errors or console errors were captured
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});