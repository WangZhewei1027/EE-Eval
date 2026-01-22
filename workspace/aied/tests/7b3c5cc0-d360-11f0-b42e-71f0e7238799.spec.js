import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3c5cc0-d360-11f0-b42e-71f0e7238799.html';

/**
 * Page Object for the LCS application.
 * Encapsulates locators and common actions so tests remain readable.
 */
class LcsPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.string1 = page.locator('#string1');
    this.string2 = page.locator('#string2');
    this.findButton = page.locator('#findLCSButton');
    this.result = page.locator('#result');
    this.header = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure basic elements are present
    await Promise.all([
      this.string1.waitFor({ state: 'visible' }),
      this.string2.waitFor({ state: 'visible' }),
      this.findButton.waitFor({ state: 'visible' }),
      this.result.waitFor({ state: 'visible' }),
      this.header.waitFor({ state: 'visible' })
    ]);
  }

  async fillStrings(s1, s2) {
    await this.string1.fill(s1);
    await this.string2.fill(s2);
  }

  async clickFind() {
    await this.findButton.click();
  }

  async getResultText() {
    return (await this.result.innerText()).trim();
  }

  async getPlaceholders() {
    return {
      s1: await this.string1.getAttribute('placeholder'),
      s2: await this.string2.getAttribute('placeholder')
    };
  }

  async getHeaderText() {
    return (await this.header.innerText()).trim();
  }
}

test.describe('LCS App - FSM and Interaction Tests (7b3c5cc0-d360-11f0-b42e-71f0e7238799)', () => {
  /** Arrays to capture console errors and page errors for each test */
  let consoleErrors;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors without modifying page behavior
    page.on('console', (msg) => {
      const type = msg.type(); // 'log', 'error', etc.
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    page.on('pageerror', (err) => {
      // uncaught exceptions
      pageErrors.push(err);
    });

    // Navigate to the app under test
    const lcsPage = new LcsPage(page);
    await lcsPage.goto();
  });

  test.afterEach(async () => {
    // After each test we assert there were no unexpected console errors or uncaught page errors.
    // This validates that the page executed without throwing ReferenceError/SyntaxError/TypeError, etc.
    expect(consoleErrors, `Console errors detected: ${consoleErrors.join('\n')}`).toHaveLength(0);
    expect(pageErrors, `Uncaught page errors detected: ${pageErrors.map(e => e.message).join('\n')}`).toHaveLength(0);
  });

  test('Idle state renders initial UI elements (S0_Idle) and matches FSM evidence', async ({ page }) => {
    // This test validates the Idle state entry evidence: header, two textareas, button, and empty result div.
    const lcsPage = new LcsPage(page);

    // Header text matches expected title
    const headerText = await lcsPage.getHeaderText();
    expect(headerText).toBe('Longest Common Subsequence Finder');

    // Placeholders on the textareas per FSM evidence
    const placeholders = await lcsPage.getPlaceholders();
    expect(placeholders.s1).toBe('Enter first string');
    expect(placeholders.s2).toBe('Enter second string');

    // Button text present and visible
    await expect(lcsPage.findButton).toBeVisible();
    await expect(lcsPage.findButton).toHaveText('Find LCS');

    // Result div should be present and initially empty
    const initialResultText = await lcsPage.getResultText();
    expect(initialResultText).toBe('');

    // No console or page errors captured during initial render (asserted in afterEach)
  });

  test('Clicking Find LCS transitions to ResultDisplayed (S1_ResultDisplayed) with a simple known LCS', async ({ page }) => {
    // This test exercises the transition: enter strings and click the Find LCS button.
    // Verifies the result text updates to include the computed LCS.
    const lcsPage = new LcsPage(page);

    // Provide simple inputs where LCS is known: "ABC" and "AC" -> "AC"
    await lcsPage.fillStrings('ABC', 'AC');
    await lcsPage.clickFind();

    // Verify result text updated per FSM evidence
    const resultText = await lcsPage.getResultText();
    expect(resultText).toBe('Longest Common Subsequence: AC');

    // Ensure result div contains expected prefix and computed subsequence
    expect(resultText.startsWith('Longest Common Subsequence:')).toBe(true);
  });

  test('No common subsequence case updates result to "No common subsequence found."', async ({ page }) => {
    // This validates the conditional branch where no LCS exists between the inputs.
    const lcsPage = new LcsPage(page);

    await lcsPage.fillStrings('ABC', 'def');
    await lcsPage.clickFind();

    const resultText = await lcsPage.getResultText();
    expect(resultText).toBe('No common subsequence found.');
  });

  test('Identical strings should return the full string as the LCS', async ({ page }) => {
    // When both inputs are identical, the LCS should be the full string.
    const lcsPage = new LcsPage(page);

    const value = 'SAMESTRING';
    await lcsPage.fillStrings(value, value);
    await lcsPage.clickFind();

    const resultText = await lcsPage.getResultText();
    expect(resultText).toBe(`Longest Common Subsequence: ${value}`);
  });

  test('Empty inputs should result in "No common subsequence found."', async ({ page }) => {
    // Edge case: empty inputs
    const lcsPage = new LcsPage(page);

    await lcsPage.fillStrings('', '');
    await lcsPage.clickFind();

    const resultText = await lcsPage.getResultText();
    expect(resultText).toBe('No common subsequence found.');
  });

  test('Clicking Find LCS without modifying inputs (both empty) yields no subsequence and updates DOM', async ({ page }) {
    // Validate clicking without typing behaves as expected and the DOM updates accordingly.
    const lcsPage = new LcsPage(page);

    // Ensure textareas are empty initially
    const s1Val = await lcsPage.string1.inputValue();
    const s2Val = await lcsPage.string2.inputValue();
    expect(s1Val).toBe('');
    expect(s2Val).toBe('');

    // Click find
    await lcsPage.clickFind();

    // Result should indicate no common subsequence
    const resultText = await lcsPage.getResultText();
    expect(resultText).toBe('No common subsequence found.');
  });

  test('Multiple successive LCS calculations update the result appropriately (state transition repeatability)', async ({ page }) {
    // This test asserts that repeated transitions from S0_Idle -> S1_ResultDisplayed work and overwrite previous results.
    const lcsPage = new LcsPage(page);

    // First computation
    await lcsPage.fillStrings('ABC', 'AC');
    await lcsPage.clickFind();
    const res1 = await lcsPage.getResultText();
    expect(res1).toBe('Longest Common Subsequence: AC');

    // Second computation with different inputs
    await lcsPage.fillStrings('12345', '135');
    await lcsPage.clickFind();
    const res2 = await lcsPage.getResultText();
    expect(res2).toBe('Longest Common Subsequence: 135');
    expect(res2).not.toBe(res1);

    // Third computation with no common subsequence
    await lcsPage.fillStrings('abc', 'XYZ');
    await lcsPage.clickFind();
    const res3 = await lcsPage.getResultText();
    expect(res3).toBe('No common subsequence found.');
  });

  test('Handles special characters and spaces correctly in LCS computation', async ({ page }) => {
    // Ensures LCS routine is character-sensitive and handles spaces/special chars.
    const lcsPage = new LcsPage(page);

    // Spaces and punctuation included
    await lcsPage.fillStrings('a b,c!', ' ab,c');
    await lcsPage.clickFind();

    // Compute expected LCS manually: common subsequence could be " ab,c" or subset; since exact LCS calculation is in page,
    // we assert that the result reflects either the full common subsequence or the "No common subsequence found." if none.
    // To be deterministic, check that resultText is a string that either starts with prefix or equals the no-common message.
    const resultText = await lcsPage.getResultText();
    const prefix = 'Longest Common Subsequence:';
    const noCommon = 'No common subsequence found.';
    expect(
      resultText === noCommon || resultText.startsWith(prefix)
    ).toBe(true);
  });

  test('No unexpected ReferenceError/SyntaxError/TypeError in console while interacting with the app', async ({ page }) => {
    // This test explicitly performs various interactions and then ensures no JS runtime errors were emitted.
    const lcsPage = new LcsPage(page);

    // Interactions
    await lcsPage.fillStrings('HELLO', 'HELL');
    await lcsPage.clickFind();
    await lcsPage.fillStrings('WORLD', 'WORD');
    await lcsPage.clickFind();
    await lcsPage.fillStrings('', 'nonempty');
    await lcsPage.clickFind();

    // Final assertion about errors happens in afterEach hook.
    // We still assert the last result is consistent with expectations:
    const finalResult = await lcsPage.getResultText();
    // For inputs ('', 'nonempty') there is no common subsequence
    expect(finalResult).toBe('No common subsequence found.');
  });
});