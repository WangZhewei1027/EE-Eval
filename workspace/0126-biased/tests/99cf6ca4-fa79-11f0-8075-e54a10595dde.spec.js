import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cf6ca4-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the Two Pointers demo page
class TwoPointersPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arraySizeSelector = '#arraySize';
    this.targetSelector = '#target';
    this.generateButtonSelector = 'button[onclick="generateArray()"]';
    this.findPairsButtonSelector = 'button[onclick="findPairs()"]';
    this.outputSelector = '#output';
    this.headingSelector = 'h1';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure basic elements are present before continuing
    await Promise.all([
      this.page.waitForSelector(this.headingSelector),
      this.page.waitForSelector(this.arraySizeSelector),
      this.page.waitForSelector(this.targetSelector),
      this.page.waitForSelector(this.generateButtonSelector),
      this.page.waitForSelector(this.findPairsButtonSelector),
      this.page.waitForSelector(this.outputSelector),
    ]);
  }

  async getHeadingText() {
    return (await this.page.textContent(this.headingSelector)) || '';
  }

  async setArraySize(size) {
    await this.page.fill(this.arraySizeSelector, String(size));
  }

  async setTarget(value) {
    await this.page.fill(this.targetSelector, String(value));
  }

  async clickGenerateArray() {
    await Promise.all([
      this.page.click(this.generateButtonSelector),
      // output update is synchronous in page script, but waitForSelector ensures stability if any reflow occurs.
      this.page.waitForSelector(this.outputSelector),
    ]);
  }

  async clickFindPairs() {
    await Promise.all([
      this.page.click(this.findPairsButtonSelector),
      this.page.waitForSelector(this.outputSelector),
    ]);
  }

  async getOutputText() {
    const raw = (await this.page.textContent(this.outputSelector)) || '';
    // Normalize Windows/Mac newlines and trim
    return raw.replace(/\r\n/g, '\n').trim();
  }

  // Parse "Generated Array: a, b, c" into array of numbers. Returns null if not found.
  async parseGeneratedArray() {
    const text = await this.getOutputText();
    const match = text.match(/Generated Array:\s*([0-9,\s-]*)/);
    if (!match) return null;
    const arrStr = match[1].trim();
    if (!arrStr) return [];
    return arrStr.split(',').map(s => Number(s.trim()));
  }
}

test.describe('Two Pointers Interactive Demo (Application ID: 99cf6ca4-fa79-11f0-8075-e54a10595dde)', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors for each test
    pageErrors = [];
    consoleMessages = [];
    page.on('pageerror', (err) => {
      // Collect runtime exceptions (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      // Collect console messages for later assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test.afterEach(async () => {
    // After each test assert there were no unexpected runtime errors or console errors
    // This validates the app runs without throwing ReferenceError/SyntaxError/TypeError during normal usage.
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    if (pageErrors.length > 0 || errorConsoleMsgs.length > 0) {
      // If any errors found, fail with diagnostic information.
      const pageErrs = pageErrors.map(e => String(e)).join('\n---\n');
      const consoleErrs = errorConsoleMsgs.map(c => c.text).join('\n---\n');
      throw new Error(
        `Detected runtime/page errors or console.error messages.\nPage errors:\n${pageErrs}\n\nConsole errors:\n${consoleErrs}`
      );
    }
  });

  test('Initial (Idle) state renders heading and all controls', async ({ page }) => {
    // This test validates the initial Idle state (S0_Idle) and renderPage() entry evidence:
    // Expect to see the heading and controls on first load.
    const tp = new TwoPointersPage(page);
    await tp.goto();

    // Verify the header exists and matches expected text from FSM evidence
    const heading = await tp.getHeadingText();
    expect(heading).toBe('Two Pointers Interactive Demo');

    // Verify inputs and buttons exist and have default values per FSM components
    const arraySizeValue = await page.getAttribute(tp.arraySizeSelector, 'value');
    expect(arraySizeValue).toBe('5'); // default value in implementation

    const targetValue = await page.getAttribute(tp.targetSelector, 'value');
    expect(targetValue).toBe('10'); // default target value

    // Buttons should be visible
    await expect(page.locator(tp.generateButtonSelector)).toBeVisible();
    await expect(page.locator(tp.findPairsButtonSelector)).toBeVisible();

    // Output div should be present and initially empty
    const outputText = await tp.getOutputText();
    expect(outputText).toBe('');
  });

  test('Generate Array transitions to Array Generated state (S1_ArrayGenerated)', async ({ page }) => {
    // This test validates clicking Generate Array transitions the app into "Array Generated"
    // and updates the DOM with "Generated Array: ..." evidence.
    const tp = new TwoPointersPage(page);
    await tp.goto();

    // Set a known size and generate
    await tp.setArraySize(7);
    await tp.clickGenerateArray();

    const outputText = await tp.getOutputText();
    expect(outputText).toContain('Generated Array:');

    // Parse the generated array and confirm its length matches requested size
    const generated = await tp.parseGeneratedArray();
    expect(generated).not.toBeNull();
    expect(generated.length).toBe(7);
    // Each element should be an integer between 0 and 19 (based on implementation)
    for (const n of generated) {
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(19);
    }
  });

  test('Find Pairs without prior generation results in No Pairs Found (S3_NoPairsFound)', async ({ page }) => {
    // This test ensures that invoking Find Pairs without previously generating an array
    // results in "No Pairs Found." as per FSM S3_NoPairsFound path.
    const tp = new TwoPointersPage(page);
    await tp.goto();

    // Ensure output is empty initially
    let output = await tp.getOutputText();
    expect(output).toBe('');

    // Click Find Pairs (arr is empty by default)
    await tp.clickFindPairs();

    output = await tp.getOutputText();
    // The implementation logs a "Sorted Array: ..." line and then "No Pairs Found."
    expect(output).toContain('Sorted Array:');
    expect(output).toContain('No Pairs Found.');
  });

  test('Find Pairs can find pairs after generating arrays (S2_PairsFound) - retry until success', async ({ page }) => {
    // This test attempts to reach the Pairs Found state (S2_PairsFound).
    // Because the array is random, we attempt multiple generate/find cycles until we observe "Found Pairs:".
    const tp = new TwoPointersPage(page);
    await tp.goto();

    // Increase array size to improve chance of finding pairs; try several times to reduce flakiness.
    await tp.setArraySize(60);

    // Choose a target that is possible (0..38) - choose 20 as a reasonable mid-value.
    await tp.setTarget(20);

    const maxAttempts = 6;
    let found = false;
    let lastOutput = '';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Click generate and then find pairs
      await tp.clickGenerateArray();
      await tp.clickFindPairs();

      lastOutput = await tp.getOutputText();

      // Check if we hit the "Found Pairs:" branch
      if (lastOutput.includes('Found Pairs:')) {
        found = true;
        break;
      }

      // If not found, try again by continuing the loop (generate again)
    }

    // Assert that within the allowed attempts we observed the Found Pairs output.
    expect(found).toBe(true);

    // Additional assertions on the format of the Found Pairs text
    // Example found pairs substring: "Found Pairs: 2, 18 | 5, 15"
    const foundLineMatch = lastOutput.match(/Found Pairs:\s*(.*)/);
    expect(foundLineMatch).not.toBeNull();
    const pairsStr = foundLineMatch[1] || '';
    expect(pairsStr.length).toBeGreaterThan(0);

    // Each pair should be formatted as "a, b" separated by " | "
    const pairs = pairsStr.split('|').map(s => s.trim());
    for (const pair of pairs) {
      // It should be two numbers separated by a comma
      expect(pair).toMatch(/^-?\d+\s*,\s*-?\d+$/);
      const [aStr, bStr] = pair.split(',').map(s => s.trim());
      const a = Number(aStr);
      const b = Number(bStr);
      // The sum should equal the target we set (20)
      expect(a + b).toBe(20);
    }
  });

  test('Edge cases: small array size and invalid target produce safe behavior (no exceptions)', async ({ page }) => {
    // This test validates edge-case handling:
    // - array size smaller than 2 (even though input min is 2) when set programmatically
    // - empty/invalid target input (parseInt -> NaN) and behavior should be safe (No Pairs Found)
    const tp = new TwoPointersPage(page);
    await tp.goto();

    // Set array size to 1 (below UI min). The implementation should still produce an array,
    // and findPairs should not throw but simply produce "No Pairs Found."
    await tp.setArraySize(1);
    await tp.clickGenerateArray();

    let output = await tp.getOutputText();
    expect(output).toContain('Generated Array:');

    await tp.clickFindPairs();
    output = await tp.getOutputText();
    // For single-element arrays, no pairs exist -> No Pairs Found.
    expect(output).toContain('No Pairs Found.');

    // Now test invalid/empty target: clear the target input and run findPairs.
    await tp.setArraySize(3);
    await tp.clickGenerateArray();

    // Clear target input to simulate invalid numeric input (parseInt('') => NaN)
    await tp.setTarget('');
    await tp.clickFindPairs();

    output = await tp.getOutputText();
    // Implementation compares sums to target (NaN), so should never equal -> No Pairs Found.
    // Ensure the app still behaves and does not throw.
    expect(output).toContain('No Pairs Found.');
  });

  test('Observes console messages and runtime errors during interactions', async ({ page }) => {
    // This test exercises a range of interactions and explicitly verifies that no runtime
    // exceptions (pageerror) or console.error messages occurred during the scenario.
    const tp = new TwoPointersPage(page);
    await tp.goto();

    // Perform several interactions
    await tp.setArraySize(10);
    await tp.setTarget(15);
    await tp.clickGenerateArray();
    await tp.clickFindPairs();

    await tp.setArraySize(8);
    await tp.setTarget(12);
    await tp.clickGenerateArray();
    await tp.clickFindPairs();

    // Inspect collected console messages for unexpected error-level logs and page errors
    // The afterEach hook will fail the test if it finds any, but we also assert here explicitly.
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');

    expect(pageErrors.length).toBe(0);
    expect(errorConsoleMsgs.length).toBe(0);
  });
});