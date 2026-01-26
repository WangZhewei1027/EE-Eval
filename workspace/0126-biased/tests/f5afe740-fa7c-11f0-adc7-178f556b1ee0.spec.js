import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5afe740-fa7c-11f0-adc7-178f556b1ee0.html';

/**
 * Page object wrapper for the Set Explanation app.
 * Encapsulates common interactions and collects console/page errors for assertions.
 */
class SetApp {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Collect console messages for inspection
    this.page.on('console', (msg) => {
      // Normalize console text for easier assertions
      try {
        this.consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
        });
      } catch (e) {
        // If reading console message fails for any reason, still push a fallback
        this.consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Collect unhandled page errors (uncaught exceptions)
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });
  }

  // Navigate to the app page and wait for main container to appear
  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the container to ensure the "renderPage()" visible content is present
    await this.page.waitForSelector('.container');
  }

  // Get the example button element handle
  async getExampleButton() {
    return this.page.locator('#example-button');
  }

  // Click the example button
  async clickExampleButton() {
    await this.page.click('#example-button');
  }

  // Convenience: wait for the next pageerror and return it
  async waitForPageError(options) {
    return this.page.waitForEvent('pageerror', options);
  }

  // Return any captured console texts
  getConsoleTexts() {
    return this.consoleMessages.map((m) => m.text);
  }

  // Return any captured page error messages
  getPageErrorMessages() {
    return this.pageErrors.map((e) => e.message);
  }
}

test.describe('Set Explanation - FSM & UI end-to-end tests', () => {
  // Validate the Idle state S0_Idle and initial rendering
  test('Idle state: page renders and "View Example" button is present and enabled', async ({ page }) => {
    // Setup page object and navigate
    const app = new SetApp(page);
    await app.goto();

    // Verify static content is rendered as part of renderPage() entry action
    // (We cannot assert a function call; we assert the DOM that should be present.)
    await expect(page.locator('h2', { hasText: 'What is a Set?' })).toBeVisible();
    await expect(page.locator('p', { hasText: 'Set is a collection of unique elements' })).toBeVisible();

    // The FSM evidence expects a button with id #example-button in Idle state
    const btn = await app.getExampleButton();
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('View Example');
    await expect(btn).toBeEnabled();

    // Ensure no page errors occurred on initial load (Idle state's entry should be safe)
    expect(app.pageErrors.length).toBe(0);

    // Ensure no console output with the Example text exists prior to clicking
    const consoleTexts = app.getConsoleTexts();
    const anyExamplePre = consoleTexts.some((t) => t.includes('Example:'));
    expect(anyExamplePre).toBe(false);
  });

  // Validate the transition triggered by clicking the example button
  test('Transition: clicking "View Example" should invoke exampleButtonClicked and surface runtime error (ReferenceError)', async ({ page }) => {
    const app = new SetApp(page);
    await app.goto();

    // The FSM transition expects exampleButtonClicked to run on click.
    // The implementation contains an intentional runtime issue: const example = {a, b, c, d, e};
    // This should produce a ReferenceError when the click handler executes.
    // We wait for the pageerror event which represents uncaught exceptions thrown in page script.
    const waitError = app.waitForPageError({ timeout: 2000 });
    await app.clickExampleButton();

    // Await the pageerror and assert it is a ReferenceError related to undefined identifiers
    const error = await waitError;
    // The exact message may vary across engines, check for ReferenceError and undefined variable mention
    expect(error).toBeTruthy();
    // Most engines set the name to 'ReferenceError'
    if (error.name) {
      expect(error.name).toContain('ReferenceError');
    }
    // The message typically mentions 'a is not defined' or 'is not defined' — be flexible
    expect(error.message).toMatch(/is not defined|not defined/i);

    // After the error, ensure the console did NOT contain the expected successful log "Example: {a, b, c, d, e}"
    // (Because the error occurs before console.log could run.)
    // Give a short moment for console messages to be delivered
    await page.waitForTimeout(100);
    const consoleTexts = app.getConsoleTexts();
    const foundExampleLog = consoleTexts.some((t) => t.startsWith('Example:'));
    expect(foundExampleLog).toBe(false);

    // The button should remain present and enabled after the error (UI resilience)
    const btn = await app.getExampleButton();
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
  });

  // Edge case: multiple clicks should produce multiple errors (each click triggers the handler)
  test('Edge case: repeated clicks produce repeated runtime errors and do not crash the renderer', async ({ page }) => {
    const app = new SetApp(page);
    await app.goto();

    // Wait for two pageerror events triggered by two clicks
    const pError1 = app.waitForPageError({ timeout: 2000 });
    await app.clickExampleButton();
    const pError2 = app.waitForPageError({ timeout: 2000 });
    await app.clickExampleButton();

    const err1 = await pError1;
    const err2 = await pError2;

    // Both should be errors related to the same underlying problem
    expect(err1).toBeTruthy();
    expect(err2).toBeTruthy();
    expect(err1.message).toMatch(/is not defined|not defined/i);
    expect(err2.message).toMatch(/is not defined|not defined/i);

    // Confirm that two errors were captured through the page object as well
    // (The earlier listeners also capture these)
    // Allow small delay for listeners to populate arrays
    await page.waitForTimeout(50);
    expect(app.pageErrors.length).toBeGreaterThanOrEqual(2);

    // Ensure the app content is still present and the button is still clickable
    await expect(page.locator('.container')).toBeVisible();
    await expect(page.locator('#example-button')).toBeEnabled();
  });

  // Negative assertion: assert that the FSM-expected console output is absent due to the runtime bug
  test('FSM expected console output "Example: {a, b, c, d, e}" is NOT produced due to runtime error', async ({ page }) => {
    const app = new SetApp(page);
    await app.goto();

    // Click once and wait for the error to ensure handler attempted execution
    const waitErr = app.waitForPageError({ timeout: 2000 });
    await app.clickExampleButton();
    await waitErr;

    // Wait a bit for console messages to flush
    await page.waitForTimeout(100);

    // Check captured console messages for the exact expected FSM observable
    const consoleTexts = app.getConsoleTexts();
    const expectedConsole = consoleTexts.find((t) => t.includes('Example:') && t.includes('{a, b, c, d, e}'));
    // We assert that the expected log string does not exist (negative check per instructions)
    expect(expectedConsole).toBeUndefined();
  });

  // Validate robustness: clicking the button does not remove the DOM evidence of the state transition
  test('After attempting transition, DOM still contains textual examples and descriptions', async ({ page }) => {
    const app = new SetApp(page);
    await app.goto();

    // Click to attempt the transition (which throws), swallow the resulting pageerror by awaiting it
    const waitErr = app.waitForPageError({ timeout: 2000 });
    await app.clickExampleButton();
    await waitErr;

    // The page should still contain the textual examples that served as evidence for states in the FSM
    await expect(page.locator('ul >> text={set = {a, b, c, d, e}}')).toBeVisible({ timeout: 500 }).catch(async () => {
      // fallback: check textual occurrence anywhere on the page
      const bodyText = await page.textContent('body');
      expect(bodyText).toContain('{set = {a, b, c, d, e}}');
    });

    // Ensure other explanatory headings remain visible as evidence of the Idle state's rendering
    await expect(page.locator('h2', { hasText: 'Types of Sets' })).toBeVisible();
    await expect(page.locator('h2', { hasText: 'Algorithms for Sets' })).toBeVisible();
  });
});