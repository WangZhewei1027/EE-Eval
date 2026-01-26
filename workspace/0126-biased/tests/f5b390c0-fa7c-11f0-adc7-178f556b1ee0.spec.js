import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b390c0-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object for the Compiler app
class CompilerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Collect console messages and page errors for assertions
    this.page.on('console', msg => {
      // store type and text for richer assertions
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    this.page.on('pageerror', err => {
      // store error message strings
      this.pageErrors.push(err ? err.message || String(err) : String(err));
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for main container to ensure page is rendered (Idle state's entry action: renderPage())
    await this.page.waitForSelector('.container', { state: 'visible' });
  }

  async getCompileButton() {
    return await this.page.$('#compiler-button');
  }

  async clickCompile() {
    const btn = await this.getCompileButton();
    if (!btn) throw new Error('Compile button not found');
    await btn.click();
  }

  // Wait and return a console message matching predicate
  async waitForConsoleMessage(predicate, options = { timeout: 2000 }) {
    const { page } = this;
    const event = await page.waitForEvent('console', {
      predicate: msg => {
        try {
          return predicate(msg);
        } catch {
          return false;
        }
      },
      ...options,
    });
    return { type: event.type(), text: event.text() };
  }
}

test.describe('Compiler Interactive App FSM Tests (f5b390c0-fa7c-11f0-adc7-178f556b1ee0)', () => {
  // Shared page object for each test
  test.beforeEach(async ({ page }) => {
    // nothing here; individual tests create CompilerPage to attach listeners
  });

  test.afterEach(async ({ page }) => {
    // ensure page closed/reset between tests by Playwright automatically
  });

  test('Idle state: Page renders and shows the Compile Code button (S0_Idle)', async ({ page }) => {
    // This test validates the Idle state entry expectations:
    // - renderPage() equivalent: the page container and elements are present
    // - The Compile Code button exists and has expected text
    const app = new CompilerPage(page);
    await app.goto();

    // Verify container and header exist
    await expect(page.locator('.container')).toBeVisible();
    await expect(page.locator('.header h1')).toHaveText('Compiler');

    // Verify the Compile Code button exists and shows correct text
    const button = await app.getCompileButton();
    expect(button, 'Compile button should be present in Idle state').toBeTruthy();
    await expect(page.locator('#compiler-button')).toHaveText('Compile Code');

    // At idle, before interaction, there should be no console logs from clicking yet
    // We allow browser internals to produce logs, but assert that our captured consoleMessages array is currently empty
    expect(app.consoleMessages.length, 'No console logs should have been captured before interactions').toBe(0);

    // Also assert there are no recorded page errors initially
    expect(app.pageErrors.length, 'No page errors should exist immediately after page load').toBe(0);
  });

  test('Transition S0_Idle -> S1_Compiling: clicking Compile Code triggers compilation and logs source code', async ({ page }) => {
    // This test validates the CompileCode event:
    // - Clicking the button should run the inline compileCode() logic
    // - The FSM expected observable is console.log(x) so we expect a console message containing the source string
    const app = new CompilerPage(page);
    await app.goto();

    // Prepare to wait for the console message that matches the source code string
    const expectedSourceSnippet = 'int x = 5; // This is a comment';

    // Click the compile button and wait for the console event that logs the source code
    const waitPromise = app.waitForConsoleMessage(msg => {
      // match messages that include the source string
      return msg.text().includes(expectedSourceSnippet);
    }, { timeout: 2000 });

    await app.clickCompile();

    const consoleEvent = await waitPromise;
    // Verify the console log type and contents
    expect(consoleEvent.type).toBe('log');
    expect(consoleEvent.text).toContain(expectedSourceSnippet);

    // Ensure no page-level runtime errors were recorded during compilation
    expect(app.pageErrors.length, 'No runtime page errors should occur when clicking compile').toBe(0);
  });

  test('Compiling state: multiple clicks produce multiple console logs and maintain stability', async ({ page }) => {
    // Edge case: user rapidly clicks the button multiple times.
    // Verify that each click produces a console.log and that no page errors accumulate.
    const app = new CompilerPage(page);
    await app.goto();

    const expectedSourceSnippet = 'int x = 5; // This is a comment';

    // Click twice and collect two console messages
    const firstLogPromise = app.waitForConsoleMessage(msg => msg.text().includes(expectedSourceSnippet), { timeout: 2000 });
    await app.clickCompile();
    const first = await firstLogPromise;
    expect(first.type).toBe('log');
    expect(first.text).toContain(expectedSourceSnippet);

    const secondLogPromise = app.waitForConsoleMessage(msg => msg.text().includes(expectedSourceSnippet), { timeout: 2000 });
    await app.clickCompile();
    const second = await secondLogPromise;
    expect(second.type).toBe('log');
    expect(second.text).toContain(expectedSourceSnippet);

    // Confirm we observed at least two logs containing the expected snippet in the captured consoleMessages
    const logsWithSnippet = app.consoleMessages.filter(m => m.text.includes(expectedSourceSnippet));
    expect(logsWithSnippet.length).toBeGreaterThanOrEqual(2);

    // No page errors should have occurred after multiple rapid interactions
    expect(app.pageErrors.length, 'No page errors should occur after multiple clicks').toBe(0);
  });

  test('Accessibility and interactivity: compile button is focusable and clickable (FSM UI check)', async ({ page }) => {
    // Validate additional UI aspects related to the Idle and Compiling states:
    // - The button is visible, enabled, focusable and responds to keyboard activation as well as mouse clicks.
    const app = new CompilerPage(page);
    await app.goto();

    const buttonLocator = page.locator('#compiler-button');
    await expect(buttonLocator).toBeVisible();
    await expect(buttonLocator).toBeEnabled();

    // Focus and activate via keyboard (Enter)
    await buttonLocator.focus();
    // Ensure focus is indeed on the element
    expect(await page.evaluate(() => document.activeElement && document.activeElement.id)).toBe('compiler-button');

    // Wait for console message caused by keyboard activation
    const logAfterKeyPromise = app.waitForConsoleMessage(msg => msg.text().includes('int x = 5; // This is a comment'), { timeout: 2000 });

    // Press Enter to activate the button
    await page.keyboard.press('Enter');

    const keyEventLog = await logAfterKeyPromise;
    expect(keyEventLog.type).toBe('log');
    expect(keyEventLog.text).toContain('int x = 5; // This is a comment');

    // No page errors from keyboard activation
    expect(app.pageErrors.length, 'No page errors should occur after keyboard activation').toBe(0);
  });

  test('Sanity: confirm there are no reference/syntax/type errors produced by the app during normal interactions', async ({ page }) => {
    // This test collects page errors during a normal click and asserts none are present.
    // It adheres to the requirement to observe console logs and page errors and to let runtime errors occur naturally if they do.
    const app = new CompilerPage(page);
    await app.goto();

    // Click once and wait for console log that indicates compile executed
    const logPromise = app.waitForConsoleMessage(msg => msg.text().includes('int x = 5; // This is a comment'), { timeout: 2000 });
    await app.clickCompile();
    await logPromise;

    // Now assert that no page errors (ReferenceError, TypeError, SyntaxError) occurred
    // If any such errors happen naturally in the page code they will have been captured by app.pageErrors
    expect(app.pageErrors.length, 'No ReferenceError, SyntaxError, or TypeError should be present after normal compile invocation').toBe(0);
  });

  test('Robustness: clicking compile does not alter DOM structure of the main container (onExit/onEnter side-effects)', async ({ page }) => {
    // Validate that entry/exit actions do not unexpectedly remove core UI elements.
    // The FSM mentions entry actions (renderPage and compileCode). We verify the container remains intact across the transition.
    const app = new CompilerPage(page);
    await app.goto();

    // Snapshot of important DOM things before interaction
    const containerExistsBefore = await page.locator('.container').isVisible();
    const buttonExistsBefore = await page.locator('#compiler-button').isVisible();
    expect(containerExistsBefore).toBe(true);
    expect(buttonExistsBefore).toBe(true);

    // Perform the transition
    const logPromise = app.waitForConsoleMessage(msg => msg.text().includes('int x = 5; // This is a comment'), { timeout: 2000 });
    await app.clickCompile();
    await logPromise;

    // Re-check DOM elements after transition
    const containerExistsAfter = await page.locator('.container').isVisible();
    const buttonExistsAfter = await page.locator('#compiler-button').isVisible();
    expect(containerExistsAfter).toBe(true);
    expect(buttonExistsAfter).toBe(true);

    // No page errors as part of these entry/exit actions
    expect(app.pageErrors.length).toBe(0);
  });
});