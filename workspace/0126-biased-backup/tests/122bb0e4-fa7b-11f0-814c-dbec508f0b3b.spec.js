import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122bb0e4-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object for the Jump Search page to encapsulate interactions
class JumpSearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      heading: '#jump-search-container h2',
      wordInput: '#word',
      // Buttons described in the FSM and HTML
      jumpButton: '#jump-button',
      maxButton: '#max-button',
      minButton: '#min-button',
      stepButton: '#step-button',
      resetButton: '#reset-button',
      addButton: '#add-button',
      // The form submit button (present in HTML) - we avoid clicking it to prevent navigation
      formSubmitButton: 'form button[type="submit"]'
    };
  }

  // Navigation helper
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Basic existence checks
  async isRendered() {
    const heading = await this.page.locator(this.selectors.heading).innerText();
    const wordExists = await this.page.locator(this.selectors.wordInput).count();
    const buttons = await Promise.all([
      this.page.locator(this.selectors.jumpButton).innerText(),
      this.page.locator(this.selectors.maxButton).innerText(),
      this.page.locator(this.selectors.minButton).innerText(),
      this.page.locator(this.selectors.stepButton).innerText(),
      this.page.locator(this.selectors.resetButton).innerText(),
      this.page.locator(this.selectors.addButton).innerText()
    ]);
    return { heading, wordExists, buttons };
  }

  async fillWord(value) {
    await this.page.fill(this.selectors.wordInput, value);
  }

  async clickJump() {
    await this.page.click(this.selectors.jumpButton);
  }

  async clickMax() {
    await this.page.click(this.selectors.maxButton);
  }

  async clickMin() {
    await this.page.click(this.selectors.minButton);
  }

  async clickStep() {
    await this.page.click(this.selectors.stepButton);
  }

  async clickReset() {
    await this.page.click(this.selectors.resetButton);
  }

  async clickAdd() {
    await this.page.click(this.selectors.addButton);
  }

  async getWordValue() {
    return await this.page.inputValue(this.selectors.wordInput);
  }
}

// Group related tests for the FSM
test.describe('Jump Search FSM - Interactive Application (122bb0e4-fa7b-11f0-814c-dbec508f0b3b)', () => {
  // Sanity: Ensure the page loads and initial Idle state is rendered
  test('S0_Idle - Page renders with expected heading and controls (Idle state)', async ({ page }) => {
    const app = new JumpSearchPage(page);
    // Navigate to the page
    await app.goto();

    // Validate the "Idle" state's evidence: the heading with text "Jump Search"
    const { heading, wordExists, buttons } = await app.isRendered();
    expect(heading).toBe('Jump Search');

    // The input should exist
    expect(wordExists).toBeGreaterThan(0);

    // Verify each expected button text is present and correct ordering matches HTML
    expect(buttons).toContain('Jump');
    expect(buttons).toContain('Max');
    expect(buttons).toContain('Min');
    expect(buttons).toContain('Step');
    expect(buttons).toContain('Reset');
    expect(buttons).toContain('Add');

    // No pageerrors should have occurred on initial load (no runtime click yet)
    const errors = [];
    page.on('pageerror', (err) => errors.push(err));
    // give a tiny moment for any initial errors, but expect none
    await page.waitForTimeout(100);
    expect(errors.length).toBe(0);
  });

  // Helper to attach listeners capturing console and page errors for each interaction test
  async function attachCaptures(page) {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      // capture all console messages with type and text
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      // capture the thrown error object and message
      pageErrors.push(err);
    });
    return { consoleMessages, pageErrors };
  }

  // S1_Searching - Clicking the Jump button should invoke jumpSearch()
  test('S1_Searching - Clicking Jump triggers jumpSearch and results in runtime errors due to missing inputs (expect ReferenceError)', async ({ page }) => {
    const app = new JumpSearchPage(page);
    await app.goto();

    // Prepare captures
    const { consoleMessages, pageErrors } = await attachCaptures(page);

    // Put a sample value in the word input to test how the function attempts to parse values
    await app.fillWord('hello-world-long');

    // Click the Jump button which should call jumpSearch()
    // The implementation references undefined globals (maxInput, minInput, stepInput) leading to ReferenceError
    await app.clickJump();

    // Allow event handlers to run - duplicate listeners exist so there may be multiple errors
    await page.waitForTimeout(200);

    // Assert that at least one page error occurred and mentions 'is not defined' (ReferenceError)
    expect(pageErrors.length).toBeGreaterThan(0);
    const messages = pageErrors.map(e => String(e.message || e));
    // At least one message should indicate an undefined variable
    expect(messages.some(m => /is not defined/.test(m) || /ReferenceError/.test(m))).toBeTruthy();

    // Also check that no successful "result" console log was produced indicating result formatting proceeded (the error occurs before console.log in this implementation)
    // If the implementation had produced a console message, it would be a 'log' type - we accept either none or presence, but emphasize the error happened
    expect(messages.length).toBeGreaterThanOrEqual(1);
  });

  // S2_Max_Searching - Clicking the Max button should invoke maxSearch()
  test('S2_Max_Searching - Clicking Max triggers maxSearch and throws due to undefined inputs (expect ReferenceError)', async ({ page }) => {
    const app = new JumpSearchPage(page);
    await app.goto();
    const { consoleMessages, pageErrors } = await attachCaptures(page);

    await app.fillWord('short');

    await app.clickMax();

    await page.waitForTimeout(200);

    expect(pageErrors.length).toBeGreaterThan(0);
    const msgs = pageErrors.map(e => String(e.message || e));
    expect(msgs.some(m => /is not defined/.test(m) || /ReferenceError/.test(m))).toBeTruthy();
  });

  // S3_Min_Searching - Clicking the Min button should invoke minSearch()
  test('S3_Min_Searching - Clicking Min triggers minSearch and throws ReferenceError due to missing globals', async ({ page }) => {
    const app = new JumpSearchPage(page);
    await app.goto();
    const { consoleMessages, pageErrors } = await attachCaptures(page);

    await app.fillWord('a');

    await app.clickMin();

    await page.waitForTimeout(200);

    expect(pageErrors.length).toBeGreaterThan(0);
    const msgs = pageErrors.map(e => String(e.message || e));
    expect(msgs.some(m => /is not defined/.test(m) || /ReferenceError/.test(m))).toBeTruthy();
  });

  // S4_Step_Searching - Clicking the Step button should invoke stepSearch()
  test('S4_Step_Searching - Clicking Step triggers stepSearch and results in runtime error (ReferenceError)', async ({ page }) => {
    const app = new JumpSearchPage(page);
    await app.goto();
    const { consoleMessages, pageErrors } = await attachCaptures(page);

    // Use an edge-case word (empty string) to exercise length-based checks if code ran
    await app.fillWord('');

    await app.clickStep();

    await page.waitForTimeout(200);

    expect(pageErrors.length).toBeGreaterThan(0);
    const msgs = pageErrors.map(e => String(e.message || e));
    expect(msgs.some(m => /is not defined/.test(m) || /ReferenceError/.test(m))).toBeTruthy();
  });

  // S5_Reset - Clicking Reset should attempt to clear fields, but because it references missing inputs it should throw before clearing
  test('S5_Reset - Clicking Reset attempts resetSearch but fails due to missing inputs; word input should remain unchanged', async ({ page }) => {
    const app = new JumpSearchPage(page);
    await app.goto();
    const { consoleMessages, pageErrors } = await attachCaptures(page);

    // Fill the word field with a sentinel value
    await app.fillWord('to-be-cleared');

    // Click Reset which in implementation sets jumpInput.value etc (undefined), so error expected
    await app.clickReset();

    await page.waitForTimeout(200);

    // Confirm we received a ReferenceError
    expect(pageErrors.length).toBeGreaterThan(0);
    const msgs = pageErrors.map(e => String(e.message || e));
    expect(msgs.some(m => /is not defined/.test(m) || /ReferenceError/.test(m))).toBeTruthy();

    // Because the error happens when accessing jumpInput (undefined), the implementation never reached wordInput.value = '', so the word should remain unchanged
    const valueAfter = await app.getWordValue();
    expect(valueAfter).toBe('to-be-cleared');
  });

  // S6_Adding - Clicking Add should attempt to add the word but will error before clearing inputs
  test('S6_Adding - Clicking Add triggers addSearch and results in ReferenceError; word should remain after error', async ({ page }) => {
    const app = new JumpSearchPage(page);
    await app.goto();
    const { consoleMessages, pageErrors } = await attachCaptures(page);

    await app.fillWord('new-word');

    await app.clickAdd();

    await page.waitForTimeout(200);

    // Expect at least one ReferenceError due to undefined jumpInput/maxInput etc.
    expect(pageErrors.length).toBeGreaterThan(0);
    const msgs = pageErrors.map(e => String(e.message || e));
    expect(msgs.some(m => /is not defined/.test(m) || /ReferenceError/.test(m))).toBeTruthy();

    // The addSearch function tries to clear fields only after parsing values; since parsing references undefined variables, clearing does not happen.
    const after = await app.getWordValue();
    expect(after).toBe('new-word');
  });

  // Additional edge-case tests and analysis of console logs and duplicate event listeners
  test('Edge cases & diagnostics - duplicate event listeners and console/page errors observed on multiple clicks', async ({ page }) => {
    const app = new JumpSearchPage(page);
    await app.goto();

    // Capture all console messages and page errors
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Click the Jump button twice to observe duplicate handlers (the HTML registers listeners twice)
    await app.fillWord('dup-test');
    await app.clickJump();
    await page.waitForTimeout(100);
    await app.clickJump();
    await page.waitForTimeout(200);

    // At least one error should be present; due to duplicate handlers there may be 2 errors
    expect(pageErrors.length).toBeGreaterThan(0);

    // Validate that console messages may or may not contain a result; we accept that errors are the primary observable
    // Ensure that some console or error text indicates the problem is a missing global (common symptom across event handlers)
    const errorTexts = pageErrors.map(e => String(e.message || e));
    expect(errorTexts.some(t => /is not defined/.test(t) || /ReferenceError/.test(t))).toBeTruthy();

    // Provide diagnostic expectations: duplicate listeners should yield >=1 errors (often 2)
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Also ensure that the page still contains the main heading and input after these errors (no navigation occurred)
    const heading = await page.locator('#jump-search-container h2').innerText();
    expect(heading).toBe('Jump Search');
    const wordVal = await app.getWordValue();
    expect(wordVal).toBe('dup-test');
  });

  // Verify that the form submit button exists but we intentionally do not trigger it (comment explains why)
  test('Sanity - Form submit button exists but is not triggered to avoid form navigation during tests', async ({ page }) => {
    const app = new JumpSearchPage(page);
    await app.goto();

    // The presence of the submit button is part of the UI structure, but clicking it would submit the form (page reload).
    // We only assert its existence here.
    const submitCount = await page.locator('form button[type="submit"]').count();
    expect(submitCount).toBeGreaterThan(0);

    // Do not click it; ensure that staying on the page after a short wait keeps the heading intact
    await page.waitForTimeout(100);
    const heading = await page.locator('#jump-search-container h2').innerText();
    expect(heading).toBe('Jump Search');
  });
});