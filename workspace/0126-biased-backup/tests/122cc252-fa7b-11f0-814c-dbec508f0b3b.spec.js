import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122cc252-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object for the context UI
class ContextPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.contextSelector = '#context';
    this.inputSelector = '#context input';
    this.textareaSelector = '#context textarea';
    this.buttonSelector = '#context button';
    this.outputSelector = '#context div';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getInputValue() {
    return this.page.locator(this.inputSelector).evaluate((el) => el.value);
  }

  async getTextareaValue() {
    return this.page.locator(this.textareaSelector).evaluate((el) => el.value);
  }

  async getButtonText() {
    return this.page.locator(this.buttonSelector).innerText();
  }

  async getOutputText() {
    // The output is a div with textContent = input + '\n' + textarea
    return this.page.locator(this.outputSelector).innerText();
  }

  async clickButton() {
    await this.page.click(this.buttonSelector);
  }

  async getContextChildrenTags() {
    return this.page.locator(this.contextSelector).evaluate((ctx) =>
      Array.from(ctx.children).map((c) => c.tagName.toLowerCase())
    );
  }

  async isRenderPageDefined() {
    return this.page.evaluate(() => typeof window.renderPage !== 'undefined');
  }
}

test.describe('Context Switching - FSM validations (Application ID: 122cc252-fa7b-11f0-814c-dbec508f0b3b)', () => {
  // Arrays to collect console messages and page errors for each test separately
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors that occur during load and interactions.
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // pageerror events capture unhandled exceptions in the page
      pageErrors.push({ message: err.message, name: err.name });
    });
  });

  test.afterEach(async ({ page }) => {
    // Ensure we close the page to clean up state between tests (Playwright handles this,
    // but being explicit is useful in multi-test suites).
    try {
      await page.close();
    } catch (e) {
      // ignore errors from closing the page
    }
  });

  test.describe('Initial State (S0_Initial)', () => {
    test('Initial render: input, textarea, button, and output are present with expected initial values', async ({ page }) => {
      // This test validates the Initial State entry actions: the DOM should contain
      // input, textarea, button, and output with initial text/values as described in FSM.
      const ctx = new ContextPage(page);

      // Navigate to the page and let all scripts run
      await ctx.goto();

      // Verify structure: presence of elements in correct order
      const childrenTags = await ctx.getContextChildrenTags();
      expect(childrenTags).toEqual(['input', 'textarea', 'button', 'div']);

      // Check initial values as per the HTML implementation / FSM components
      const inputValue = await ctx.getInputValue();
      expect(inputValue).toBe('Hello World!');

      const textareaValue = await ctx.getTextareaValue();
      expect(textareaValue).toBe('This is a test textarea.');

      const buttonText = await ctx.getButtonText();
      expect(buttonText).toBe('Click me!');

      // The output is updated by setInterval: wait a bit for the first update cycle.
      // The output should contain the input + newline + textarea values.
      await page.waitForTimeout(1200); // allow the setInterval (1s) to run at least once
      const outputText = await ctx.getOutputText();
      // innerText will represent the newline as a real newline
      expect(outputText).toContain('Hello World!');
      expect(outputText).toContain('This is a test textarea.');

      // Validate that no uncaught page errors occurred during initial render
      expect(pageErrors.length).toBe(0);

      // Also ensure there are no console messages of type 'error'
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('FSM "renderPage" function is not present in the global scope (edge case check)', async ({ page }) => {
      // The FSM mentions an entry_action "renderPage()". The implementation does not
      // define such a function. We assert it is undefined rather than trying to invoke it.
      const ctx = new ContextPage(page);
      await ctx.goto();

      const hasRenderPage = await ctx.isRenderPageDefined();
      expect(hasRenderPage).toBe(false);

      // Ensure no page errors were introduced by the presence check
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transition: ButtonClick (S0_Initial -> S1_Updated)', () => {
    test('Clicking the button transitions the UI to the Updated State and updates values', async ({ page }) => {
      // This test validates the ButtonClick event and the transition to S1_Updated:
      // - context is cleared and nodes are re-appended
      // - input.value becomes 'Hello again!'
      // - textarea.value becomes 'This is another test textarea.'
      // - button.textContent becomes 'Click me again!'
      const ctx = new ContextPage(page);
      await ctx.goto();

      // Wait briefly to ensure initial render completed
      await page.waitForTimeout(200);

      // Click the button to trigger the transition
      await ctx.clickButton();

      // After click, the DOM should still contain the four elements in the same order
      const childrenTagsAfter = await ctx.getContextChildrenTags();
      expect(childrenTagsAfter).toEqual(['input', 'textarea', 'button', 'div']);

      // Verify updated values per the FSM evidence
      const inputValueAfter = await ctx.getInputValue();
      expect(inputValueAfter).toBe('Hello again!');

      const textareaValueAfter = await ctx.getTextareaValue();
      expect(textareaValueAfter).toBe('This is another test textarea.');

      const buttonTextAfter = await ctx.getButtonText();
      expect(buttonTextAfter).toBe('Click me again!');

      // The output is updated by setInterval; wait to allow the updater to run and reflect new values
      await page.waitForTimeout(1200);
      const outputTextAfter = await ctx.getOutputText();
      expect(outputTextAfter).toContain('Hello again!');
      expect(outputTextAfter).toContain('This is another test textarea.');

      // Ensure no uncaught exceptions occurred during the transition
      expect(pageErrors.length).toBe(0);

      // Ensure no console.error messages
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Multiple rapid clicks do not cause errors and maintain Updated State values (edge case)', async ({ page }) => {
      // Validate that clicking the button multiple times (rapid succession) does not
      // cause runtime errors and leaves the application in the updated state.
      const ctx = new ContextPage(page);
      await ctx.goto();
      await page.waitForTimeout(200);

      // Click the button multiple times quickly
      await Promise.all([
        ctx.clickButton(),
        ctx.clickButton(),
        ctx.clickButton()
      ]).catch(() => {
        // If any click results in an error at the Playwright level, let assertion below catch inconsistencies.
      });

      // Allow a moment for any synchronous re-rendering to complete
      await page.waitForTimeout(200);

      // Confirm updated values remain as expected
      expect(await ctx.getInputValue()).toBe('Hello again!');
      expect(await ctx.getTextareaValue()).toBe('This is another test textarea.');
      expect(await ctx.getButtonText()).toBe('Click me again!');

      // Allow the output updater to run and check output
      await page.waitForTimeout(1200);
      const out = await ctx.getOutputText();
      expect(out).toContain('Hello again!');
      expect(out).toContain('This is another test textarea.');

      // Assert that no runtime page errors occurred even under rapid interactions
      expect(pageErrors.length).toBe(0);

      // And no console errors were produced
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Error observation and robustness checks', () => {
    test('No ReferenceError, SyntaxError, or TypeError occurred during normal usage', async ({ page }) => {
      // This test listens for runtime errors captured as pageerror and asserts that
      // none of the captured errors are ReferenceError, SyntaxError, or TypeError.
      const ctx = new ContextPage(page);
      await ctx.goto();

      // Interact a bit to exercise the code paths that might reveal errors
      await page.waitForTimeout(200);
      await ctx.clickButton();
      await page.waitForTimeout(1200);

      // Now inspect collected pageErrors and assert none are the targeted error types
      const errorNames = pageErrors.map((e) => e.name);
      expect(errorNames).not.toContain('ReferenceError');
      expect(errorNames).not.toContain('SyntaxError');
      expect(errorNames).not.toContain('TypeError');

      // Additionally assert there are no console.error messages that indicate these errors
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      // If any console error exists, make it visible in test failure messages by including its text
      expect(consoleErrors.length).toBe(0);
    });

    test('The application DOM always contains exactly one input, one textarea, one button, and one output div', async ({ page }) => {
      // Ensure that regardless of transitions, the DOM remains composed of exactly the expected elements.
      const ctx = new ContextPage(page);
      await ctx.goto();

      // Initial check
      let tags = await ctx.getContextChildrenTags();
      expect(tags).toEqual(['input', 'textarea', 'button', 'div']);

      // Trigger transition
      await ctx.clickButton();
      await page.waitForTimeout(200);

      // Check again
      tags = await ctx.getContextChildrenTags();
      expect(tags).toEqual(['input', 'textarea', 'button', 'div']);

      // Check after waiting for output update
      await page.waitForTimeout(1200);
      tags = await ctx.getContextChildrenTags();
      expect(tags).toEqual(['input', 'textarea', 'button', 'div']);

      // Ensure no page errors occurred during these checks
      expect(pageErrors.length).toBe(0);
    });
  });
});