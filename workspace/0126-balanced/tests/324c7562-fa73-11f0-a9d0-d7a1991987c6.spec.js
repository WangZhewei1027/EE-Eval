import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324c7562-fa73-11f0-a9d0-d7a1991987c6.html';

/**
 * Page Object for the Stack application.
 * Encapsulates common interactions and queries used by the tests.
 */
class StackPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.dialogMessages = [];
    this.consoleMessages = [];
    this.pageErrors = [];

    // Capture dialogs so tests can assert them and proceed.
    this.page.on('dialog', async dialog => {
      this.dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    // Capture console messages for observation/assertion.
    this.page.on('console', msg => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions exposed as pageerror).
    this.page.on('pageerror', err => {
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Input field selector
  inputSelector() {
    return '#inputElement';
  }

  // Buttons
  pushButtonSelector() {
    return 'button[onclick="push()"]';
  }
  popButtonSelector() {
    return 'button[onclick="pop()"]';
  }
  viewButtonSelector() {
    return 'button[onclick="viewStack()"]';
  }

  // Stack list selector
  stackListSelector() {
    return '#stack';
  }

  // Set input value
  async setInputValue(value) {
    await this.page.fill(this.inputSelector(), value);
  }

  // Get input value
  async getInputValue() {
    return (await this.page.$eval(this.inputSelector(), el => el.value));
  }

  // Click push and wait a short tick to allow UI update; alerts are automatically accepted and recorded.
  async clickPush() {
    await this.page.click(this.pushButtonSelector());
    // allow DOM updates after the click
    await this.page.waitForTimeout(50);
  }

  // Click pop
  async clickPop() {
    await this.page.click(this.popButtonSelector());
    await this.page.waitForTimeout(50);
  }

  // Click view stack
  async clickViewStack() {
    await this.page.click(this.viewButtonSelector());
    await this.page.waitForTimeout(50);
  }

  // Get stack items (array of text content)
  async getStackItems() {
    return this.page.$$eval(`${this.stackListSelector()} li`, nodes => nodes.map(n => n.textContent));
  }

  // Clear recorded dialog messages
  clearDialogMessages() {
    this.dialogMessages = [];
  }

  // Convenience: assert no page errors occurred
  async assertNoPageErrors() {
    // Wait a tiny bit for any asynchronous errors to bubble
    await this.page.waitForTimeout(20);
    expect(this.pageErrors.map(e => String(e)), 'No uncaught page errors should occur').toEqual([]);
  }

  // Convenience: assert no console.error messages
  async assertNoConsoleErrors() {
    // Filter console messages of type 'error'
    const errors = this.consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errors.map(e => e.text), 'No console error/warning messages should be emitted').toEqual([]);
  }
}

test.describe('Stack Implementation (FSM verification)', () => {
  // Each test will create its own page instance from the fixture
  test.beforeEach(async ({ page }) => {
    // Nothing here; individual tests will instantiate StackPage and navigate.
  });

  test('Initial Idle state: page renders with input and buttons and empty stack', async ({ page }) => {
    // This test validates the S0_Idle state entry rendering.
    const app = new StackPage(page);
    await app.goto();

    // Verify input exists and placeholder matches FSM component
    const placeholder = await page.getAttribute(app.inputSelector(), 'placeholder');
    expect(placeholder).toBe('Enter a value to push');

    // Verify buttons exist
    await expect(page.locator(app.pushButtonSelector())).toHaveCount(1);
    await expect(page.locator(app.popButtonSelector())).toHaveCount(1);
    await expect(page.locator(app.viewButtonSelector())).toHaveCount(1);

    // Stack should initially be empty (S0_Idle)
    const items = await app.getStackItems();
    expect(items.length).toBe(0);

    // Verify no runtime page errors or console errors on initial load
    await app.assertNoPageErrors();
    await app.assertNoConsoleErrors();
  });

  test('Push transition: from Idle to StackUpdated updates stack display and clears input', async ({ page }) => {
    // This test validates the PushEvent transition to S1_StackUpdated and entry action updateStackDisplay().
    const app1 = new StackPage(page);
    await app.goto();

    // Push a value "First"
    await app.setInputValue('First');
    await app.clickPush();

    // After pushing, input should be cleared
    const inputAfter = await app.getInputValue();
    expect(inputAfter).toBe('', 'Input should be cleared after successful push');

    // Stack display should contain the pushed element
    const items1 = await app.getStackItems();
    expect(items).toEqual(['First']);

    // Push another value to ensure stack maintains LIFO ordering visually
    await app.setInputValue('Second');
    await app.clickPush();
    const itemsAfterSecond = await app.getStackItems();
    expect(itemsAfterSecond).toEqual(['First', 'Second']);

    // No uncaught page errors or console errors
    await app.assertNoPageErrors();
    await app.assertNoConsoleErrors();
  });

  test('Pop transition: popping returns top item, triggers alert and updates display', async ({ page }) => {
    // This test validates the PopEvent transition in S1_StackUpdated and expected observables:
    // - Stack contents updated
    // - Alert with popped value
    const app2 = new StackPage(page);
    await app.goto();

    // Prepare stack with two values
    await app.setInputValue('One');
    await app.clickPush();
    await app.setInputValue('Two');
    await app.clickPush();

    // Confirm pre-pop state
    let preItems = await app.getStackItems();
    expect(preItems).toEqual(['One', 'Two']);

    // Clear any previous dialog messages recorded
    app.clearDialogMessages();

    // Pop once - should alert "Popped: Two"
    await app.clickPop();

    // Assert the dialog was shown with expected message
    expect(app.dialogMessages.length).toBeGreaterThanOrEqual(1);
    const lastDialog = app.dialogMessages[app.dialogMessages.length - 1];
    expect(lastDialog).toBe('Popped: Two');

    // Stack display should now have only the first item
    const postItems = await app.getStackItems();
    expect(postItems).toEqual(['One']);

    // Pop again - should alert "Popped: One" and leave stack empty
    app.clearDialogMessages();
    await app.clickPop();
    expect(app.dialogMessages.pop()).toBe('Popped: One');
    const finalItems = await app.getStackItems();
    expect(finalItems).toEqual([]);

    // No uncaught page errors or console errors
    await app.assertNoPageErrors();
    await app.assertNoConsoleErrors();
  });

  test('Pop on empty stack: edge case shows Underflow alert and stack remains empty', async ({ page }) => {
    // This test validates the edge case behavior when popping from an empty stack.
    const app3 = new StackPage(page);
    await app.goto();

    // Ensure stack is empty
    const items2 = await app.getStackItems();
    expect(items.length).toBe(0);

    // Clear any previous dialogs
    app.clearDialogMessages();

    // Click Pop on empty stack - should alert "Stack is empty, cannot pop."
    await app.clickPop();

    expect(app.dialogMessages.length).toBeGreaterThanOrEqual(1);
    expect(app.dialogMessages[0]).toBe('Stack is empty, cannot pop.');

    // Stack should still be empty
    const itemsAfter = await app.getStackItems();
    expect(itemsAfter.length).toBe(0);

    // No uncaught page errors or console errors
    await app.assertNoPageErrors();
    await app.assertNoConsoleErrors();
  });

  test('Push empty input shows validation alert (edge case)', async ({ page }) => {
    // This test validates that attempting to push with empty input triggers an alert and does not modify stack.
    const app4 = new StackPage(page);
    await app.goto();

    // Ensure input is empty
    await app.setInputValue('');
    const beforeItems = await app.getStackItems();
    expect(beforeItems.length).toBe(0);

    // Clear dialog messages
    app.clearDialogMessages();

    // Click Push with empty input -> should alert "Please enter a value to push."
    await app.clickPush();

    expect(app.dialogMessages.length).toBeGreaterThanOrEqual(1);
    expect(app.dialogMessages[0]).toBe('Please enter a value to push.');

    // Stack remains unchanged
    const afterItems = await app.getStackItems();
    expect(afterItems.length).toBe(0);

    // No uncaught page errors or console errors
    await app.assertNoPageErrors();
    await app.assertNoConsoleErrors();
  });

  test('ViewStack event: shows alert with current stack contents and UI remains coherent', async ({ page }) => {
    // This test validates the ViewStackEvent which should trigger an alert showing current stack.
    const app5 = new StackPage(page);
    await app.goto();

    // Populate stack with some items
    await app.setInputValue('Alpha');
    await app.clickPush();
    await app.setInputValue('Beta');
    await app.clickPush();

    // Confirm items
    const beforeItems1 = await app.getStackItems();
    expect(beforeItems).toEqual(['Alpha', 'Beta']);

    // Clear any prior dialogs
    app.clearDialogMessages();

    // Click View Stack - should alert "Current Stack: Alpha,Beta"
    await app.clickViewStack();

    expect(app.dialogMessages.length).toBeGreaterThanOrEqual(1);
    expect(app.dialogMessages.pop()).toBe('Current Stack: Alpha,Beta');

    // UI stack display should remain unchanged after viewing
    const afterItems1 = await app.getStackItems();
    expect(afterItems).toEqual(['Alpha', 'Beta']);

    // No uncaught page errors or console errors
    await app.assertNoPageErrors();
    await app.assertNoConsoleErrors();
  });

  test('Combined flows: multiple pushes and pops across transitions maintain correct LIFO behavior', async ({ page }) => {
    // This end-to-end test drives through multiple transitions and validates stack invariants.
    const app6 = new StackPage(page);
    await app.goto();

    // Push 1,2,3
    await app.setInputValue('1');
    await app.clickPush();
    await app.setInputValue('2');
    await app.clickPush();
    await app.setInputValue('3');
    await app.clickPush();

    expect(await app.getStackItems()).toEqual(['1', '2', '3']);

    // Pop -> should get 3
    app.clearDialogMessages();
    await app.clickPop();
    expect(app.dialogMessages.pop()).toBe('Popped: 3');
    expect(await app.getStackItems()).toEqual(['1', '2']);

    // View stack -> "Current Stack: 1,2"
    app.clearDialogMessages();
    await app.clickViewStack();
    expect(app.dialogMessages.pop()).toBe('Current Stack: 1,2');

    // Pop twice to empty
    app.clearDialogMessages();
    await app.clickPop();
    expect(app.dialogMessages.pop()).toBe('Popped: 2');
    await app.clickPop();
    expect(app.dialogMessages.pop()).toBe('Popped: 1');

    // Pop once more should show underflow message
    app.clearDialogMessages();
    await app.clickPop();
    expect(app.dialogMessages.pop()).toBe('Stack is empty, cannot pop.');

    // Final stack empty
    expect(await app.getStackItems()).toEqual([]);

    // No uncaught page errors or console errors
    await app.assertNoPageErrors();
    await app.assertNoConsoleErrors();
  });
});