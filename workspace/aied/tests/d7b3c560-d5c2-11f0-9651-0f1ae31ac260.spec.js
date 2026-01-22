import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b3c560-d5c2-11f0-9651-0f1ae31ac260.html';

/**
 * Page Object for the Linear Search Demo page.
 * Encapsulates interactions and common assertions used across tests.
 */
class LinearSearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#arrayInput');
    this.targetInput = page.locator('#targetInput');
    this.form = page.locator('#searchForm');
    this.submitButton = page.locator('button[type="submit"]');
    this.resultDiv = page.locator('#result');
    this.stepsDiv = page.locator('#steps');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillArray(text) {
    await this.arrayInput.fill(text);
  }

  async fillTarget(text) {
    await this.targetInput.fill(text);
  }

  async submitForm() {
    await this.submitButton.click();
  }

  async submitSearch(arrayText, targetText) {
    if (arrayText !== undefined) await this.fillArray(arrayText);
    if (targetText !== undefined) await this.fillTarget(targetText);
    await this.submitForm();
  }

  async getResultText() {
    return await this.resultDiv.textContent();
  }

  async getStepsText() {
    return await this.stepsDiv.textContent();
  }

  async computedStepsStyle() {
    return await this.page.evaluate(() => {
      const el = document.getElementById('steps');
      const s = window.getComputedStyle(el);
      return {
        backgroundColor: s.backgroundColor,
        fontFamily: s.fontFamily,
        color: s.color,
      };
    });
  }
}

test.describe('Linear Search Demo - FSM validation and UI tests', () => {
  // Capture console messages and page errors for each test and assert none are fatal.
  test.beforeEach(async ({ page }) => {
    // Attach listeners so tests can inspect console and errors if needed.
    page._consoleMessages = [];
    page._pageErrors = [];

    page.on('console', msg => {
      // record all console messages
      page._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // record runtime page errors (ReferenceError, TypeError, etc.)
      page._pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // After each test, assert there were no uncaught page errors and no console errors.
    const pageErrors = page._pageErrors || [];
    const consoleMsgs = page._consoleMessages || [];
    const consoleErrorMsgs = consoleMsgs.filter(m => m.type === 'error');

    // If there are any page errors, fail the test with details to aid debugging.
    expect(pageErrors.length, `Expected no uncaught page errors, but found: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

    // Also ensure there are no console.error messages emitted.
    expect(consoleErrorMsgs.length, `Expected no console.error messages, but found: ${consoleErrorMsgs.map(m => m.text).join('; ')}`).toBe(0);
  });

  test('S0_Idle: Initial render - form and components are present with correct attributes', async ({ page }) => {
    // This test validates the Idle initial state: the form and inputs are rendered, have placeholders and required attribute.
    const app = new LinearSearchPage(page);
    await app.goto();

    // Check presence of inputs and button
    await expect(app.arrayInput).toBeVisible();
    await expect(app.targetInput).toBeVisible();
    await expect(app.submitButton).toBeVisible();

    // Verify placeholders and required attributes match FSM evidence
    await expect(app.arrayInput).toHaveAttribute('placeholder', 'e.g. 5,3,8,6,7,2');
    await expect(app.arrayInput).toHaveAttribute('required', '');

    await expect(app.targetInput).toHaveAttribute('placeholder', 'e.g. 6');
    await expect(app.targetInput).toHaveAttribute('required', '');

    // Result and steps should be present but initially empty
    await expect(app.resultDiv).toBeVisible();
    await expect(app.resultDiv).toHaveText('');
    await expect(app.stepsDiv).toBeVisible();
    await expect(app.stepsDiv).toHaveText('');
  });

  test('S0_Idle -> S1_Searching -> S2_ResultFound: Numeric target found (index and steps are correct)', async ({ page }) => {
    // This test walks through the submit event and validates a successful find transition.
    const app = new LinearSearchPage(page);
    await app.goto();

    // Provide array and target that should be found
    await app.submitSearch('5,3,8,6,7,2', '6');

    // Expect result to indicate found at index 3 (0-based)
    await expect(app.resultDiv).toHaveText('Target "6" found at index 3.');

    // Expect steps to contain checking lines and the found line
    const stepsText = await app.getStepsText();
    expect(stepsText).toContain('Checking index 0: value = 5');
    expect(stepsText).toContain('Checking index 1: value = 3');
    expect(stepsText).toContain('Checking index 2: value = 8');
    expect(stepsText).toContain('Checking index 3: value = 6');
    expect(stepsText).toContain('=> Found target (6) at index 3');
  });

  test('S0_Idle -> S1_Searching -> S3_ResultNotFound: Target not present yields not found outcome and full steps', async ({ page }) => {
    // This test verifies the guard that leads to the "not found" final state.
    const app = new LinearSearchPage(page);
    await app.goto();

    await app.submitSearch('1,2,3,4', '10');

    await expect(app.resultDiv).toHaveText('Target "10" not found in the array.');

    const stepsText = await app.getStepsText();
    // Should check each index and finally report not found
    expect(stepsText).toContain('Checking index 0: value = 1');
    expect(stepsText).toContain('Checking index 3: value = 4');
    expect(stepsText).toContain('=> Target (10) not found in array.');
  });

  test('Validation edge cases: empty array or empty target triggers alert dialogs', async ({ page }) => {
    // This test covers input validation which prevents transition to Searching state and shows alerts.
    const app = new LinearSearchPage(page);
    await app.goto();

    // Case 1: Missing array input
    let dialogPromise = page.waitForEvent('dialog');
    await app.fillArray(''); // ensure empty
    await app.fillTarget('5');
    await app.submitForm();
    const dialog1 = await dialogPromise;
    expect(dialog1.message()).toBe('Please enter array elements.');
    await dialog1.dismiss();

    // Case 2: Missing target input
    dialogPromise = page.waitForEvent('dialog');
    await app.fillArray('1,2,3');
    await app.fillTarget('');
    await app.submitForm();
    const dialog2 = await dialogPromise;
    expect(dialog2.message()).toBe('Please enter a target element.');
    await dialog2.dismiss();

    // Ensure that in both validation cases, result and steps remain empty (no transition happened)
    await expect(app.resultDiv).toHaveText('');
    await expect(app.stepsDiv).toHaveText('');
  });

  test('Type handling: searching for string values vs numeric values', async ({ page }) => {
    // This test ensures that string elements are handled and matched correctly.
    const app = new LinearSearchPage(page);
    await app.goto();

    // Strings in array
    await app.submitSearch('a,b,c,5', 'b');
    await expect(app.resultDiv).toHaveText('Target "b" found at index 1');
    // the source uses a period after the sentence; normalize expectation in case whitespace/format differs
    // Use includes to be robust
    const resText1 = (await app.getResultText()) || '';
    expect(resText1).toContain('Target "b" found at index 1');

    // Numeric vs string nuance: '05' will be parsed as number (5) due to regex; verify that it matches numeric search
    await app.fillArray('05,100'); // '05' matches the numeric regex and will be converted to 5
    await app.fillTarget('5'); // searching for numeric 5
    await app.submitForm();
    const resText2 = (await app.getResultText()) || '';
    expect(resText2).toContain('Target "5" found at index 0');
  });

  test('UI styling: #steps container has expected computed styles (monospace & dark background)', async ({ page }) => {
    // This test checks visual feedback evidence from the FSM (the steps area styling from the implementation).
    const app = new LinearSearchPage(page);
    await app.goto();

    const styles = await app.computedStepsStyle();
    // Background in the stylesheet is #272822 -> rgb(39, 40, 34)
    expect(styles.backgroundColor.replace(/\s+/g, '')).toBe('rgb(39,40,34)');
    // The font-family includes monospace (it may be quoted or contain fallback fonts)
    expect(styles.fontFamily.toLowerCase()).toContain('monospace');
    // Color should be a light color used on dark background (#f8f8f2)
    expect(styles.color).toBeTruthy();
  });
});