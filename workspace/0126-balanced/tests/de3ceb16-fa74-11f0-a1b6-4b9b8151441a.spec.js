import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3ceb16-fa74-11f0-a1b6-4b9b8151441a.html';

/**
 * Page Object for the Indexing demo page.
 * Encapsulates common selectors and interactions.
 */
class IndexingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayButton = page.locator("button[onclick='demoArrayIndexing()']");
    this.stringButton = page.locator("button[onclick='demoStringIndexing()']");
    this.objectButton = page.locator("button[onclick='demoObjectIndexing()']");
    this.findBlueButton = page.locator("button[onclick='demoFindingIndex()']");
    this.findLastGreenButton = page.locator("button[onclick='demoLastIndex()']");

    this.arrayOutput = page.locator('#arrayOutput');
    this.stringOutput = page.locator('#stringOutput');
    this.objectOutput = page.locator('#objectOutput');
    this.findIndexOutput = page.locator('#findIndexOutput');

    this.header = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickArray() {
    await this.arrayButton.click();
  }

  async clickString() {
    await this.stringButton.click();
  }

  async clickObject() {
    await this.objectButton.click();
  }

  async clickFindBlue() {
    await this.findBlueButton.click();
  }

  async clickFindLastGreen() {
    await this.findLastGreenButton.click();
  }
}

test.describe('JavaScript Indexing Demonstration - FSM states and transitions', () => {
  // Shared variables for capturing console messages and page errors
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture unhandled page errors
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Make sure to collect any final console messages or errors
    // (no special teardown required for this simple page)
    // Log captured items for debugging when running tests locally
    // (Playwright will already surface failures/expectations)
  });

  test('S0_Idle: Page renders initial content correctly', async ({ page }) => {
    // Validate initial render (entry action: renderPage())
    const idx = new IndexingPage(page);

    // The header and main sections should be present
    await expect(idx.header).toHaveText('JavaScript Indexing Concepts');

    // Basic structural checks for each section and buttons
    await expect(idx.arrayButton).toHaveCount(1);
    await expect(idx.stringButton).toHaveCount(1);
    await expect(idx.objectButton).toHaveCount(1);
    await expect(idx.findBlueButton).toHaveCount(1);
    await expect(idx.findLastGreenButton).toHaveCount(1);

    // Ensure outputs are empty initially
    await expect(idx.arrayOutput).toHaveText('');
    await expect(idx.stringOutput).toHaveText('');
    await expect(idx.objectOutput).toHaveText('');
    await expect(idx.findIndexOutput).toHaveText('');

    // Assert there are no unexpected page errors at initial render
    expect(pageErrors.length).toBe(0);
    // Assert no console error-level messages were emitted during load
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  test('S1_Array_Indexing_Demonstrated: Demonstrate Array Indexing button updates arrayOutput', async ({ page }) => {
    // This validates transition: S0 -> S1 via DemonstrateArrayIndexing
    const idx1 = new IndexingPage(page);

    // Ensure the demo function exists on the page
    const hasFunction = await page.evaluate(() => typeof demoArrayIndexing === 'function');
    expect(hasFunction).toBe(true);

    // Click the button and verify the DOM update
    await idx.clickArray();

    // Wait for visible non-empty text to appear
    await expect(idx.arrayOutput).not.toBeEmpty();

    const text = await idx.arrayOutput.innerHTML();
    // Should include specific elements and length
    expect(text).toContain('fruits[0]: Apple');
    expect(text).toContain('fruits[2]: Cherry');
    expect(text).toContain('fruits.length: 4');
    expect(text).toContain('Last element (fruits[fruits.length - 1]): Date');

    // Check that clicking again updates the same output (idempotency)
    await idx.clickArray();
    const text2 = await idx.arrayOutput.innerHTML();
    expect(text2).toContain('fruits[0]: Apple');

    // No runtime exceptions should have been thrown during button action
    expect(pageErrors.length).toBe(0);
    const consoleErrorCount1 = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  test('S2_String_Indexing_Demonstrated: Demonstrate String Indexing button updates stringOutput', async ({ page }) => {
    // Validates transition: S0 -> S2 via DemonstrateStringIndexing
    const idx2 = new IndexingPage(page);

    const hasFunction1 = await page.evaluate(() => typeof demoStringIndexing === 'function');
    expect(hasFunction).toBe(true);

    await idx.clickString();

    await expect(idx.stringOutput).not.toBeEmpty();

    const text1 = await idx.stringOutput.innerHTML();
    expect(text).toContain("message[0]: H");
    expect(text).toContain("message[6]: W");
    expect(text).toContain("message.charAt(4): o");
    expect(text).toContain("String length: 11");

    // Ensure no page errors were emitted during the interaction
    expect(pageErrors.length).toBe(0);
    const consoleErrorCount2 = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  test('S3_Object_Indexing_Demonstrated: Demonstrate Object Indexing button updates objectOutput', async ({ page }) => {
    // Validates transition: S0 -> S3 via DemonstrateObjectIndexing
    const idx3 = new IndexingPage(page);

    const hasFunction2 = await page.evaluate(() => typeof demoObjectIndexing === 'function');
    expect(hasFunction).toBe(true);

    await idx.clickObject();

    await expect(idx.objectOutput).not.toBeEmpty();

    const text2 = await idx.objectOutput.innerHTML();
    expect(text).toContain('user.name: Alice');
    expect(text).toContain('user["age"]: 30');
    expect(text).toContain('Using variable for index (user[prop]): alice@example.com');

    // Ensure no page errors were emitted during the interaction
    expect(pageErrors.length).toBe(0);
    const consoleErrorCount3 = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  test('S4_Index_Found: Find Index of \'Blue\' updates findIndexOutput', async ({ page }) => {
    // Validates transition: S0 -> S4 via FindIndexOfBlue
    const idx4 = new IndexingPage(page);

    const hasFunction3 = await page.evaluate(() => typeof demoFindingIndex === 'function');
    expect(hasFunction).toBe(true);

    await idx.clickFindBlue();

    await expect(idx.findIndexOutput).not.toBeEmpty();

    const text3 = await idx.findIndexOutput.innerHTML();
    // Exact expected output per implementation
    expect(text).toContain("Index of 'Blue': 2 (Found)");

    // Check idempotency (click again)
    await idx.clickFindBlue();
    const text21 = await idx.findIndexOutput.innerHTML();
    expect(text2).toContain("Index of 'Blue': 2 (Found)");

    // Ensure no page errors were emitted during the interaction
    expect(pageErrors.length).toBe(0);
    const consoleErrorCount4 = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  test('S5_Last_Index_Found: Find Last Index of \'Green\' updates findIndexOutput', async ({ page }) => {
    // Validates transition: S0 -> S5 via FindLastIndexOfGreen
    const idx5 = new IndexingPage(page);

    const hasFunction4 = await page.evaluate(() => typeof demoLastIndex === 'function');
    expect(hasFunction).toBe(true);

    await idx.clickFindLastGreen();

    await expect(idx.findIndexOutput).not.toBeEmpty();

    const text4 = await idx.findIndexOutput.innerHTML();
    // Expect lastIndexOf 'Green' to be 3
    expect(text).toContain("Last index of 'Green': 3 (Found)");

    // If we click previous find (Blue) afterwards, ensure output changes accordingly
    await idx.clickFindBlue();
    await expect(idx.findIndexOutput).toHaveText(/Index of 'Blue': 2 \(Found\)/);

    // Ensure no page errors were emitted during the interactions
    expect(pageErrors.length).toBe(0);
    const consoleErrorCount5 = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  test('Edge cases and error scenarios: multiple sequential interactions and absence of runtime errors', async ({ page }) => {
    // This test performs a sequence of interactions, verifying stability and that no runtime exceptions (ReferenceError, SyntaxError, TypeError) are raised.
    const idx6 = new IndexingPage(page);

    // Perform sequence
    await idx.clickArray();
    await idx.clickString();
    await idx.clickObject();
    await idx.clickFindBlue();
    await idx.clickFindLastGreen();

    // Verify all outputs contain expected substrings after sequence
    await expect(idx.arrayOutput).toHaveText(/fruits\[0\]: Apple/);
    await expect(idx.stringOutput).toHaveText(/message\[0\]: H/);
    await expect(idx.objectOutput).toHaveText(/user.name: Alice/);
    // The last click was findLastGreen, so findIndexOutput should reflect that
    await expect(idx.findIndexOutput).toHaveText(/Last index of 'Green': 3 \(Found\)/);

    // Inspect captured page errors for specific JS error types.
    // We assert that there are no page errors (ReferenceError, SyntaxError, TypeError) as this implementation is expected to run cleanly.
    // If any such errors did occur naturally, they will be present in pageErrors and cause this assertion to fail, surfacing the issues.
    const jsErrorTypesOfInterest = ['ReferenceError', 'SyntaxError', 'TypeError'];
    const matchingErrors = pageErrors.filter(err => jsErrorTypesOfInterest.some(t => err.name && err.name.includes(t)));
    expect(matchingErrors.length).toBe(0);

    // Assert that there were no console.error messages emitted during the scenario
    const consoleErrorEntries = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorEntries.length).toBe(0);

    // For visibility in test logs, if any console warnings exist, ensure they are not errors (do not fail test)
    const consoleWarns = consoleMessages.filter(m => m.type === 'warning');
    // This expectation is informational; we don't fail if there are warnings, but we assert variable exists
    expect(Array.isArray(consoleWarns)).toBe(true);
  });

  test('Function presence: demo functions should be defined on window (no ReferenceError when invoked)', async ({ page }) => {
    // Verify via page.evaluate that each expected global function exists and is a function.
    const functions = await page.evaluate(() => {
      return {
        demoArrayIndexing: typeof demoArrayIndexing,
        demoStringIndexing: typeof demoStringIndexing,
        demoObjectIndexing: typeof demoObjectIndexing,
        demoFindingIndex: typeof demoFindingIndex,
        demoLastIndex: typeof demoLastIndex
      };
    });

    expect(functions.demoArrayIndexing).toBe('function');
    expect(functions.demoStringIndexing).toBe('function');
    expect(functions.demoObjectIndexing).toBe('function');
    expect(functions.demoFindingIndex).toBe('function');
    expect(functions.demoLastIndex).toBe('function');

    // Ensure that checking typeof didn't throw and no page errors were recorded
    expect(pageErrors.length).toBe(0);
  });
});