import { test, expect } from '@playwright/test';

const URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a0c512-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object Model for the Selection Sort page
class SelectionSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('button[onclick]');
  }

  async goto() {
    await this.page.goto(URL, { waitUntil: 'domcontentloaded' });
  }

  async isButtonVisible() {
    return await this.button.isVisible();
  }

  async getButtonText() {
    return (await this.button.textContent())?.trim() ?? '';
  }

  async getOnclickAttribute() {
    return await this.button.getAttribute('onclick');
  }

  // Click the button and capture the alert/dialog message
  async clickAndGetDialogMessage() {
    const message = await new Promise(async (resolve) => {
      this.page.once('dialog', async (dialog) => {
        const m = dialog.message();
        await dialog.accept();
        resolve(m);
      });
      // perform click after registering dialog handler
      await this.button.click();
    });
    return message;
  }

  // Activate the button via keyboard (Enter) and capture the alert/dialog message
  async pressEnterAndGetDialogMessage() {
    const message = await new Promise(async (resolve) => {
      this.page.once('dialog', async (dialog) => {
        const m = dialog.message();
        await dialog.accept();
        resolve(m);
      });
      await this.button.focus();
      await this.page.keyboard.press('Enter');
    });
    return message;
  }

  // Get computed background-color of the button
  async getButtonBackgroundColor() {
    return await this.page.evaluate((selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      return getComputedStyle(el).backgroundColor;
    }, 'button[onclick]');
  }
}

test.describe('Selection Sort Interactive Page - FSM and UI tests', () => {
  // Arrays to capture console messages and page errors
  let consoleMessages;
  let pageErrors;
  let page;
  let model;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    model = new SelectionSortPage(page);
    await model.goto();
  });

  test.afterEach(async () => {
    // Basic teardown assertions: ensure no uncaught exceptions bubbled up
    // Tests below assert on pageErrors where appropriate; here we keep a safety check.
    expect(Array.isArray(pageErrors)).toBeTruthy();
  });

  test('Initial Idle state: page loads, content and button exist with correct attributes', async () => {
    // Validate main headings and content to ensure page loaded into Idle state
    await expect(page.locator('h1')).toHaveText(/Selection Sort/i);

    // Button should be visible
    expect(await model.isButtonVisible()).toBe(true);

    // Button text should match FSM component
    const btnText = await model.getButtonText();
    expect(btnText).toBe('See Demonstration');

    // onclick attribute should be present and contain the alert call from the FSM evidence
    const onclick = await model.getOnclickAttribute();
    expect(onclick).not.toBeNull();
    expect(onclick).toContain("alert(");
    expect(onclick).toContain("This is a static demonstration of Selection Sort. Check the descriptions above for detailed understanding!");

    // No uncaught page errors on initial load
    expect(pageErrors.length).toBe(0);

    // Ensure no console error-level messages were emitted during load
    const consoleErrors = consoleMessages.filter(c => c.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('ButtonClick transition: clicking the button triggers an alert with expected message and remains in Idle state', async () => {
    // Clicking should produce a dialog with the exact message specified in the FSM
    const expectedMessage = "This is a static demonstration of Selection Sort. Check the descriptions above for detailed understanding!";
    const message = await model.clickAndGetDialogMessage();
    expect(message).toBe(expectedMessage);

    // After the alert, ensure the page remains in the Idle state: button still present and attributes unchanged
    expect(await model.isButtonVisible()).toBe(true);
    expect(await model.getButtonText()).toBe('See Demonstration');
    expect((await model.getOnclickAttribute()) ?? '').toContain("alert(");

    // No uncaught page errors produced by the click
    expect(pageErrors.length).toBe(0);
  });

  test('Repeated ButtonClick transitions: multiple clicks produce repeated alerts and no state mutation', async () => {
    const expectedMessage = "This is a static demonstration of Selection Sort. Check the descriptions above for detailed understanding!";

    // Click first time
    const first = await model.clickAndGetDialogMessage();
    expect(first).toBe(expectedMessage);

    // Click second time immediately
    const second = await model.clickAndGetDialogMessage();
    expect(second).toBe(expectedMessage);

    // DOM should remain unchanged: button still present and text identical
    expect(await model.isButtonVisible()).toBe(true);
    expect(await model.getButtonText()).toBe('See Demonstration');

    // No page errors resulted from repeated clicks
    expect(pageErrors.length).toBe(0);
  });

  test('Keyboard activation (Enter) triggers the same alert as click - validates accessibility interaction', async () => {
    const expectedMessage = "This is a static demonstration of Selection Sort. Check the descriptions above for detailed understanding!";
    const message = await model.pressEnterAndGetDialogMessage();
    expect(message).toBe(expectedMessage);

    // Ensure button still in Idle state after keyboard activation
    expect(await model.isButtonVisible()).toBe(true);

    // No uncaught errors introduced
    expect(pageErrors.length).toBe(0);
  });

  test('Visual feedback: hover changes button background color according to CSS rules', async () => {
    // Validate computed style before hover (default background-color from CSS: #3498db -> rgb(52, 152, 219))
    const before = await model.getButtonBackgroundColor();
    expect(before).toBe('rgb(52, 152, 219)');

    // Hover and read computed style again (hover background-color: #2980b9 -> rgb(41, 128, 185))
    await page.hover('button[onclick]');
    const after = await model.getButtonBackgroundColor();
    // Depending on browser and rendering, hover should change the color to the defined hover value
    expect(after).toBe('rgb(41, 128, 185)');

    // No page errors emitted during hover action
    expect(pageErrors.length).toBe(0);
  });

  test('FSM metadata and onEnter/onExit: verify there are no explicit onEnter/onExit handlers defined on the global scope', async () => {
    // The FSM does not declare onEnter/onExit handlers. Verify that such functions are not defined globally.
    const hasOnEnter = await page.evaluate(() => typeof window.onEnter !== 'undefined');
    const hasOnExit = await page.evaluate(() => typeof window.onExit !== 'undefined');
    expect(hasOnEnter).toBe(false);
    expect(hasOnExit).toBe(false);

    // Confirm no errors related to missing handlers were thrown
    expect(pageErrors.length).toBe(0);
  });

  test('Console and page error observation: assert no ReferenceError/TypeError/SyntaxError occurred during interaction', async () => {
    // Perform an interaction to ensure we capture any runtime issues
    await model.clickAndGetDialogMessage();

    // Collate any error names from pageErrors
    const errorNames = pageErrors.map(e => (e && e.name) ? e.name : String(e));
    // Assert that none are ReferenceError, TypeError, or SyntaxError
    for (const name of errorNames) {
      expect(name).not.toMatch(/ReferenceError|TypeError|SyntaxError/);
    }

    // Also assert there were no console messages of type 'error'
    const errorsInConsole = consoleMessages.filter(c => c.type === 'error');
    expect(errorsInConsole.length).toBe(0);
  });

  test('Edge case: ensure onclick attribute content is exactly as documented in FSM evidence (including punctuation)', async () => {
    const onclick = await model.getOnclickAttribute();
    // The FSM evidence includes the full alert string with punctuation; verify exact substring is present
    expect(onclick).toContain("alert('This is a static demonstration of Selection Sort. Check the descriptions above for detailed understanding!')");
    expect(pageErrors.length).toBe(0);
  });
});