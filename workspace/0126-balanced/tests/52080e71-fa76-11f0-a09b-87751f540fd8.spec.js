import { test, expect } from '@playwright/test';

// Test file for application 52080e71-fa76-11f0-a09b-87751f540fd8
// URL: http://127.0.0.1:5500/workspace/0126-balanced/html/52080e71-fa76-11f0-a09b-87751f540fd8.html
// The app's script intentionally references an undefined Stack constructor which will raise a ReferenceError.
// Per instructions we must load the page exactly as-is, observe console/page errors, and assert that these errors occur.
// We also validate DOM elements (Idle state) and assert that user interactions do not achieve stack transitions due to the runtime error.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/52080e71-fa76-11f0-a09b-87751f540fd8.html';

// Page object for the Stack page
class StackPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('input[type="text"]');
    this.buttons = page.locator('button');
    this.insertButton = page.locator('button').first();
    this.removeButton = page.locator('button').nth(1);
    this.messagesList = page.locator('ul#messages');
    this.messageItems = this.messagesList.locator('li');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async typeMessage(text) {
    await this.input.fill(text);
  }

  async clickInsert() {
    await this.insertButton.click();
  }

  async clickRemove() {
    await this.removeButton.click();
  }

  async getMessagesCount() {
    return await this.messageItems.count();
  }

  async getButtonTexts() {
    const count = await this.buttons.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push(await this.buttons.nth(i).textContent());
    }
    return texts;
  }

  async getInputPlaceholder() {
    return await this.input.getAttribute('placeholder');
  }
}

test.describe('Stack interactive application (FSM validation + runtime error observation)', () => {
  let pageErrors = [];
  let consoleMsgs = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    pageErrors = [];
    consoleMsgs = [];

    // Capture uncaught page errors (e.g., ReferenceError: Stack is not defined)
    page.on('pageerror', (err) => {
      // Save the Error object message for assertions
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Capture console messages for additional context
    page.on('console', (msg) => {
      consoleMsgs.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the application page (this will execute the in-page script and should trigger the error)
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // no teardown required beyond Playwright automatic cleanup
  });

  test('Initial Idle state: DOM elements are present and runtime ReferenceError occurs during page load', async ({ page }) => {
    const stack = new StackPage(page);

    // Validate presence of input with correct placeholder (evidence of Idle state)
    const placeholder = await stack.getInputPlaceholder();
    // The placeholder should be "Enter a message" as per FSM evidence and HTML
    expect(placeholder).toBe('Enter a message');

    // Validate there are two buttons and their visible text (Insert and Remove)
    const btnTexts = await stack.getButtonTexts();
    expect(btnTexts.length).toBeGreaterThanOrEqual(2); // there are 2 buttons in the HTML
    // The first two button texts should correspond to Insert and Remove
    expect(btnTexts[0].trim()).toBe('Insert');
    expect(btnTexts[1].trim()).toBe('Remove');

    // Validate the messages list exists and starts empty (Idle evidence)
    const messagesCount = await stack.getMessagesCount();
    expect(messagesCount).toBe(0);

    // Assert that a ReferenceError occurred on page load and mentions 'Stack' (the script calls new Stack())
    // We expect at least one page error and that it includes 'Stack' and likely 'is not defined'
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const joinedErrors = pageErrors.join(' | ');
    expect(joinedErrors).toMatch(/Stack/);
    expect(joinedErrors).toMatch(/not defined|undefined/i);
  });

  test('InsertMessage event: clicking Insert does NOT add a message due to script runtime error', async ({ page }) => {
    const stack1 = new StackPage(page);

    // Ensure initial state is empty
    expect(await stack.getMessagesCount()).toBe(0);

    // Try to type a message and click Insert
    await stack.typeMessage('Hello FSM');
    // Clicking the Insert button should not throw, but the click handler was not properly attached because of the earlier runtime error
    await stack.clickInsert();

    // After clicking Insert, because the script failed during initialization, no list items should be added
    expect(await stack.getMessagesCount()).toBe(0);

    // The initial ReferenceError should still be present
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const joinedErrors1 = pageErrors.join(' | ');
    expect(joinedErrors).toMatch(/Stack/);
  });

  test('RemoveMessage event: clicking Remove is a no-op and does not remove messages (empty list)', async ({ page }) => {
    const stack2 = new StackPage(page);

    // Confirm empty start
    expect(await stack.getMessagesCount()).toBe(0);

    // Click Remove; because event listeners likely were not attached, this should be a no-op
    await stack.clickRemove();

    // Still empty
    expect(await stack.getMessagesCount()).toBe(0);

    // The page error that prevented listeners from attaching should remain present
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    expect(pageErrors.join(' | ')).toMatch(/Stack/);
  });

  test('FSM transitions cannot complete: attempt Insert then Remove results in no state change due to missing Stack', async ({ page }) => {
    const stack3 = new StackPage(page);

    // Try Insert (would transition S0_Idle -> S1_MessageInserted if working)
    await stack.typeMessage('First');
    await stack.clickInsert();

    // Assert no messages added (transition did not occur)
    expect(await stack.getMessagesCount()).toBe(0);

    // Now try Remove (would transition S1_MessageInserted -> S2_MessageRemoved if working)
    await stack.clickRemove();
    // Still no messages and thus no further transitions
    expect(await stack.getMessagesCount()).toBe(0);

    // Check that page-level runtime variable 'stack' is not defined due to ReferenceError stopping script execution
    const stackType = await page.evaluate(() => typeof window.stack);
    expect(stackType).toBe('undefined');

    // Validate again that ReferenceError about Stack is captured
    expect(pageErrors.some(e => /Stack/.test(e))).toBeTruthy();
  });

  test('Edge cases: multiple Insert/Remove clicks and removing on empty list produce no changes and no additional unexpected exceptions', async ({ page }) => {
    const stack4 = new StackPage(page);

    // Rapid multiple clicks on Insert and Remove
    for (let i = 0; i < 3; i++) {
      await stack.typeMessage(`Msg ${i}`);
      await stack.clickInsert();
    }

    // No messages should be present
    expect(await stack.getMessagesCount()).toBe(0);

    // Try removing several times from empty list
    for (let i = 0; i < 3; i++) {
      await stack.clickRemove();
    }

    // Still empty and no crash in test runtime (any page errors were captured during load)
    expect(await stack.getMessagesCount()).toBe(0);

    // Assert that the original runtime error(s) exist and are ReferenceError-like
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    expect(pageErrors.join(' | ')).toMatch(/Stack/);
  });

  test('Sanity: there are no onEnter/onExit actions to validate (FSM had none), ensure that absence is noted', async ({ page }) => {
    // The FSM entry/exit actions list is empty for states. Here we assert there are no side-effect DOM elements
    // introduced specifically for onEnter/onExit (nothing extra beyond input/buttons/ul).
    const stack5 = new StackPage(page);
    // Check that the page contains only the expected top-level elements within the .stack container:
    // input, 2 buttons, a paragraph, and the messages <ul>.
    const containerChildren = await page.locator('.stack').locator(':scope > *').allTextContents();
    // Ensure presence of key labels/texts (simple sanity)
    expect(containerChildren.some(t => t.includes('Enter a message'))).toBeTruthy();
    expect(containerChildren.some(t => t.includes('Insert'))).toBeTruthy();
    expect(containerChildren.some(t => t.includes('Remove'))).toBeTruthy();
    expect(containerChildren.some(t => t.includes('Messages'))).toBeTruthy();

    // No additional dynamic indicators for state transitions should exist because the runtime error prevented script behavior.
    expect(await stack.getMessagesCount()).toBe(0);
  });
});