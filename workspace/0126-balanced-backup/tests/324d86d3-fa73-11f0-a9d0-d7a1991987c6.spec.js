import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324d86d3-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object encapsulating common interactions and selectors
class JumpSearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#arrayInput');
    this.targetInput = page.locator('#targetInput');
    this.searchButton = page.locator("button[onclick='performJumpSearch()']");
    this.resultOutput = page.locator('#resultOutput');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async setArray(value) {
    await this.arrayInput.fill(value);
  }

  async setTarget(value) {
    await this.targetInput.fill(value);
  }

  async clickSearch() {
    // Use click to trigger the inline onclick handler exactly as a user would
    await this.searchButton.click();
  }

  async getResultText() {
    return await this.resultOutput.innerText();
  }

  async getButtonOnclickAttribute() {
    // Evaluate the onclick attribute directly to ensure it matches the evidence
    return await this.page.$eval("button[onclick='performJumpSearch()']", el => el.getAttribute('onclick'));
  }
}

test.describe('Jump Search Algorithm App - FSM states and transitions', () => {
  let pageErrors;
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console and page errors so tests can assert on them
    pageErrors = [];
    consoleErrors = [];

    page.on('pageerror', (err) => {
      // capture uncaught exceptions thrown in page context
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    page.on('console', (msg) => {
      // capture console.error and any console messages
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  // Helper to assert there were no runtime console/page errors of major types.
  async function assertNoRuntimeErrors() {
    // We check for general absence of console error and pageerror messages.
    expect(consoleErrors, `Console errors were raised: ${consoleErrors.join(' | ')}`).toEqual([]);
    expect(pageErrors, `Page errors were raised: ${pageErrors.join(' | ')}`).toEqual([]);
    // Additionally ensure none are obvious JS engine error types
    const combined = [...consoleErrors, ...pageErrors].join(' ');
    expect(combined.includes('ReferenceError')).toBe(false);
    expect(combined.includes('TypeError')).toBe(false);
    expect(combined.includes('SyntaxError')).toBe(false);
  }

  test('S0 Idle: initial render contains inputs, button with onclick, and empty result output', async ({ page }) => {
    // Validate initial state (Idle) - renderPage() is the declared entry action in FSM.
    // We cannot call or patch renderPage(); instead we validate that the page is rendered with expected DOM.
    const app = new JumpSearchPage(page);
    await app.goto();

    // Inputs and button should be visible
    await expect(app.arrayInput).toBeVisible();
    await expect(app.targetInput).toBeVisible();
    await expect(app.searchButton).toBeVisible();

    // The button should have the inline onclick handler as declared in the implementation/evidence
    const onclickAttr = await app.getButtonOnclickAttribute();
    expect(onclickAttr).toContain('performJumpSearch');

    // Result output should initially be empty
    const resultText = await app.getResultText();
    expect(resultText.trim()).toBe('');

    // Observe console/page errors and assert none occurred on load
    await assertNoRuntimeErrors();
  });

  test('Transition S0 -> S1 and S1 -> S2: valid input leads to result displayed (found case)', async ({ page }) => {
    // This test validates that inputs are read (S1) and a successful search shows the result (S2)
    const app = new JumpSearchPage(page);
    await app.goto();

    // Provide a valid sorted array and a target that exists
    await app.setArray('1, 2, 3, 4, 5');
    await app.setTarget('3');

    // Click search to trigger performJumpSearch() per FSM event SearchButtonClick
    await app.clickSearch();

    // The code should display that the element was found at the correct index (0-based)
    await expect(app.resultOutput).toHaveText('Element 3 found at index 2.');

    // Assert there were no unexpected runtime errors during processing
    await assertNoRuntimeErrors();
  });

  test('Transition S1 -> S2: valid input leads to result displayed (not found case)', async ({ page }) => {
    // Validate branch where the element is not present in the array
    const app = new JumpSearchPage(page);
    await app.goto();

    await app.setArray('1,2,3,4,5');
    await app.setTarget('10');
    await app.clickSearch();

    await expect(app.resultOutput).toHaveText('Element 10 not found in the array.');

    await assertNoRuntimeErrors();
  });

  test('Transition S1 -> S3: invalid inputs display error message (empty inputs)', async ({ page }) => {
    // Validate error handling when inputs are invalid (S3)
    const app = new JumpSearchPage(page);
    await app.goto();

    // Case: both inputs empty
    await app.setArray('');
    await app.setTarget('');
    await app.clickSearch();
    await expect(app.resultOutput).toHaveText('Please enter a valid sorted array and a target number.');

    // Case: array empty but target provided
    await app.setArray('');
    await app.setTarget('3');
    await app.clickSearch();
    await expect(app.resultOutput).toHaveText('Please enter a valid sorted array and a target number.');

    // Case: array non-numeric entries and non-numeric target
    await app.setArray('a,b,c');
    await app.setTarget('x');
    await app.clickSearch();
    await expect(app.resultOutput).toHaveText('Please enter a valid sorted array and a target number.');

    await assertNoRuntimeErrors();
  });

  test('Edge case: inputs with extra commas and whitespace still parse and find the correct index', async ({ page }) => {
    // This validates robustness of parsing logic used in performJumpSearch()
    const app = new JumpSearchPage(page);
    await app.goto();

    // Input containing stray commas and spaces should be filtered; resulting array should be [1,2,3]
    await app.setArray('1, , 2, , ,3');
    await app.setTarget('2');
    await app.clickSearch();

    // Expect the algorithm to find target 2 at index 1
    await expect(app.resultOutput).toHaveText('Element 2 found at index 1.');

    await assertNoRuntimeErrors();
  });

  test('Visual & DOM checks after operations: result area updates and inputs remain editable', async ({ page }) => {
    // Validate that after operations, UI remains interactive and DOM updates persist as expected.
    const app = new JumpSearchPage(page);
    await app.goto();

    await app.setArray('10,20,30');
    await app.setTarget('20');
    await app.clickSearch();
    await expect(app.resultOutput).toHaveText('Element 20 found at index 1.');

    // Ensure inputs are still enabled and we can change them for another search
    await expect(app.arrayInput).toBeEnabled();
    await expect(app.targetInput).toBeEnabled();

    // Perform another search with different target
    await app.setTarget('99');
    await app.clickSearch();
    await expect(app.resultOutput).toHaveText('Element 99 not found in the array.');

    await assertNoRuntimeErrors();
  });

  test('FSM evidence checks: ensure the key strings from FSM evidence are present in the page source', async ({ page }) => {
    // This test inspects the page source to ensure evidence strings from the FSM exist in the implementation,
    // such as the function name performJumpSearch and resultOutput ID usage.
    await page.goto(APP_URL, { waitUntil: 'load' });

    const content = await page.content();
    // Evidence: presence of performJumpSearch invocation and resultOutput div
    expect(content).toContain('performJumpSearch()');
    expect(content).toContain('id="resultOutput"');

    // No runtime errors occurred during this check
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});