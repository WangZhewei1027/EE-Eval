import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba827f0-d5b2-11f0-b169-abe023d0d932.html';

// Page object for the Deque application
class DequePage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {Object} collectors
   */
  constructor(page, collectors = {}) {
    this.page = page;
    this.consoleMessages = collectors.consoleMessages || [];
    this.pageErrors = collectors.pageErrors || [];
    this.dialogs = collectors.dialogs || [];
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Small sanity wait to let inline scripts run
    await this.page.waitForTimeout(50);
  }

  async getInputElement() {
    return this.page.locator('#input-field');
  }

  async getAddButton() {
    return this.page.locator('#add-btn');
  }

  async getOutput() {
    return this.page.locator('#output-field');
  }

  async fillInput(text) {
    // Use fill which sets the value and triggers 'input' event once
    await this.page.fill('#input-field', text);
    // wait for potential DOM updates from event handlers
    await this.page.waitForTimeout(50);
  }

  async typeInput(text, options = {}) {
    // Type character by character, triggering input events per char
    await this.page.type('#input-field', text, options);
    await this.page.waitForTimeout(50);
  }

  async clickAdd() {
    await Promise.all([
      this.page.waitForTimeout(1), // ensure event handler interleaving
      this.page.click('#add-btn'),
    ]);
    await this.page.waitForTimeout(50);
  }

  async getOutputText() {
    return this.page.locator('#output-field').innerText();
  }

  async getDequeFromWindow() {
    // deque is declared in the global scope in the page script
    return this.page.evaluate(() => window.deque);
  }

  async getInputValue() {
    return this.page.locator('#input-field').inputValue();
  }

  getConsoleMessages() {
    return this.consoleMessages.slice();
  }

  getPageErrors() {
    return this.pageErrors.slice();
  }

  getDialogs() {
    return this.dialogs.slice();
  }
}

test.describe('Deque Implementation - FSM tests', () => {
  let dequePage;
  let consoleMessages;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ page }) => {
    // collectors for console and page errors and dialogs
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    page.on('console', (msg) => {
      // collect only messages for inspection; include type and text
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // collect uncaught exceptions
      pageErrors.push(err);
    });

    // Collect dialog messages and automatically accept them to avoid blocking
    page.on('dialog', async (dialog) => {
      try {
        dialogs.push(dialog.message());
        await dialog.accept();
      } catch (e) {
        // ignore
      }
    });

    dequePage = new DequePage(page, {
      consoleMessages,
      pageErrors,
      dialogs,
    });

    await dequePage.goto();
  });

  test.afterEach(async () => {
    // no teardown actions required; listeners are tied to the page which is reset by the test runner
  });

  test('S0_Idle: initial state - UI present, deque empty, output blank', async () => {
    // Validate initial FSM state: Idle (S0_Idle)
    // - No elements in deque
    // - Output field is empty
    // - Input and Add button are present
    const input = await dequePage.getInputElement();
    const button = await dequePage.getAddButton();
    const output = await dequePage.getOutput();

    await expect(input).toBeVisible();
    await expect(button).toBeVisible();
    await expect(output).toBeVisible();

    const deque = await dequePage.getDequeFromWindow();
    expect(Array.isArray(deque)).toBe(true);
    expect(deque.length).toBe(0);

    const outputText = await dequePage.getOutputText();
    expect(outputText.trim()).toBe('');

    // Ensure no uncaught page errors during initial load
    expect(dequePage.getPageErrors().length).toBe(0);

    // No console errors expected initially
    const consoleErrs = dequePage.getConsoleMessages().filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });

  test('Transition AddElement via Add button moves from S0_Idle -> S1_Added and updates DOM', async () => {
    // This test validates the Add button click transition:
    // - When user enters text and clicks Add, deque is updated, output DOM reflects joined deque,
    //   and input is cleared afterwards.

    // Prepare: ensure input empty
    await dequePage.fillInput(''); // ensure cleared

    // Enter element 'A' and click add
    await dequePage.fillInput('A');
    await dequePage.clickAdd();

    // FSM should have transitioned to S1_Added: deque contains 'A' and output reflects it
    const deque = await dequePage.getDequeFromWindow();
    expect(Array.isArray(deque)).toBe(true);
    expect(deque.length).toBeGreaterThanOrEqual(1);
    expect(deque[deque.length - 1]).toBe('A'); // last pushed element should be 'A'

    const outputText = await dequePage.getOutputText();
    // output expected to contain the joined deque; assert it ends with 'A'
    expect(outputText.split(',').map(s => s.trim()).pop()).toBe('A');

    // Input should be cleared after click
    const inputVal = await dequePage.getInputValue();
    expect(inputVal).toBe('');

    // Check that the output element's scrollTop is set (property exists and is a number)
    const scrollTop = await dequePage.page.evaluate(() => {
      const el = document.getElementById('output-field');
      return el ? el.scrollTop : -1;
    });
    expect(typeof scrollTop).toBe('number');
  });

  test('Transition AddElement via input event: typing/filling pushes items into deque and clears input', async () => {
    // The FSM lists input 'input' event as an AddElement trigger.
    // The implementation pushes the input value into deque on 'input' when non-empty and then clears the field.

    // Use fill to add a full string at once
    await dequePage.fillInput('Hello');
    // 'input' handler should have pushed 'Hello' and then cleared the field
    const dequeAfterFill = await dequePage.getDequeFromWindow();
    expect(dequeAfterFill.length).toBeGreaterThanOrEqual(1);
    expect(dequeAfterFill[dequeAfterFill.length - 1]).toBe('Hello');

    // Ensure input cleared
    let inputVal = await dequePage.getInputValue();
    expect(inputVal).toBe('');

    // Now test typing multiple characters: each keypress triggers input handler, which clears the field each time,
    // so typing 'XY' will push 'X' then 'Y' as separate entries.
    // Record current length and then type 'XY'
    const beforeTypingLen = (await dequePage.getDequeFromWindow()).length;
    await dequePage.typeInput('XY', { delay: 50 });

    const dequeAfterTyping = await dequePage.getDequeFromWindow();
    expect(dequeAfterTyping.length).toBeGreaterThanOrEqual(beforeTypingLen + 2);
    // last two entries should be 'X' and 'Y'
    const lastTwo = dequeAfterTyping.slice(-2);
    expect(lastTwo[0]).toBe('X');
    expect(lastTwo[1]).toBe('Y');

    // Field should be cleared after typing as well
    inputVal = await dequePage.getInputValue();
    expect(inputVal).toBe('');
  });

  test('Edge case: clicking Add with empty input shows alert and does not modify deque', async () => {
    // Ensure input empty
    await dequePage.fillInput('');
    // Record deque length before
    const before = (await dequePage.getDequeFromWindow()).length;

    // Click add with empty input - implementation should alert a message and not push
    await dequePage.clickAdd();

    // The page.on('dialog') listener in beforeEach auto-accepted and recorded messages
    const recordedDialogs = dequePage.getDialogs();
    // The most recent dialog should be the expected message if an alert was shown
    const foundAlert = recordedDialogs.some(msg => msg.includes('Please enter some elements to add to the deque'));
    expect(foundAlert).toBe(true);

    // Deque should remain unchanged in length
    const after = (await dequePage.getDequeFromWindow()).length;
    expect(after).toBe(before);
  });

  test('Multiple adds and order verification: mix of input-event adds and button adds', async () => {
    // Start by clearing any input and reading current deque
    await dequePage.fillInput('');
    const initialDeque = await dequePage.getDequeFromWindow();
    const initialLen = initialDeque.length;

    // 1) Add via button with value '1'
    await dequePage.fillInput('1');
    await dequePage.clickAdd();

    // 2) Add via input event with '2' (fill triggers input event once)
    await dequePage.fillInput('2');

    // 3) Type '3' then '4' using typeInput to generate multiple input events (each char added separately)
    await dequePage.typeInput('34', { delay: 20 });

    // After these actions, verify the deque contains the newly added items in order they were pushed
    const finalDeque = await dequePage.getDequeFromWindow();
    const newItems = finalDeque.slice(initialLen); // items added during this test

    // Expect sequence: '1', '2', '3', '4' in the added portion
    // Note: because of per-character behavior, '3' and '4' should be separate entries
    expect(newItems.length).toBeGreaterThanOrEqual(4);
    // Check last four entries match expected sequence (they should be at least these, even if previous tests added others)
    const lastFour = finalDeque.slice(-4);
    expect(lastFour[0]).toBe('1');
    expect(lastFour[1]).toBe('2');
    expect(lastFour[2]).toBe('3');
    expect(lastFour[3]).toBe('4');
  });

  test('Observe console logs and page errors during interactions (expect no uncaught exceptions)', async () => {
    // Perform some interactions to surface any potential console errors or page errors
    await dequePage.fillInput('Z');
    await dequePage.clickAdd();
    await dequePage.fillInput('');
    await dequePage.clickAdd(); // triggers alert but should not throw

    // Give a short time for any errors to surface
    await dequePage.page.waitForTimeout(100);

    // Inspect collected page errors
    const pageErrs = dequePage.getPageErrors();
    // The implementation is expected to run without uncaught ReferenceError/SyntaxError/TypeError.
    // Assert that none were captured.
    expect(pageErrs.length).toBe(0);

    // Inspect console for error messages
    const consoleErrs = dequePage.getConsoleMessages().filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });
});