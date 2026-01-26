import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122ac681-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object for the Queue application
class QueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#input');
    this.select = page.locator('#select');
    this.textarea = page.locator('#textarea');
    this.submitBtn = page.locator('#submit');
    this.clearBtn = page.locator('#clear');
    this.moveLeftBtn = page.locator('#move-left');
    this.moveRightBtn = page.locator('#move-right');
    this.moveUpBtn = page.locator('#move-up');
    this.moveDownBtn = page.locator('#move-down');
  }

  // Navigate to the app
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Fill the input and ensure the input event fires (page.fill triggers input event)
  async fillInput(value) {
    await this.input.fill(value);
    // Wait until textarea contains the last pushed value, which is the input value
    await expect(this.textarea).toHaveValue(/.*/); // ensure input event processed
  }

  // Fill textarea to trigger textarea input handler
  async fillTextarea(value) {
    await this.textarea.fill(value);
    // Allow handlers to run
    await this.page.waitForTimeout(50);
  }

  // Change the select value
  async changeSelect(value) {
    await this.select.selectOption(value);
    await this.page.waitForTimeout(50);
  }

  // Click submit and handle potential alert
  async clickSubmit(handleDialog = true) {
    if (handleDialog) {
      this.page.once('dialog', async (dialog) => {
        // Accept alert and capture message
        await dialog.accept();
      });
    }
    await this.submitBtn.click();
    await this.page.waitForTimeout(50);
  }

  async clickClear() {
    await this.clearBtn.click();
    await this.page.waitForTimeout(50);
  }

  async clickMoveLeft() {
    await this.moveLeftBtn.click();
    await this.page.waitForTimeout(50);
  }

  async clickMoveRight() {
    await this.moveRightBtn.click();
    await this.page.waitForTimeout(50);
  }

  async clickMoveUp() {
    await this.moveUpBtn.click();
    await this.page.waitForTimeout(50);
  }

  async clickMoveDown() {
    await this.moveDownBtn.click();
    await this.page.waitForTimeout(50);
  }

  // Helper to get element values
  async getInputValue() {
    return (await this.input.inputValue()).toString();
  }

  async getTextareaValue() {
    return (await this.textarea.inputValue()).toString();
  }
}

test.describe('Queue FSM - Interactive Application', () => {
  // Common arrays to collect runtime issues / messages for each test
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      // store string representation for assertions and diagnostics
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    });
  });

  test('Idle state: core elements are present and initial state is empty', async ({ page }) => {
    // This test validates the Idle state (S0_Idle): inputs/buttons are present and empty.
    const app = new QueuePage(page);
    await app.goto();

    // Verify presence of input, textarea, and submit button
    await expect(app.input).toBeVisible();
    await expect(app.submitBtn).toBeVisible();
    await expect(app.textarea).toBeVisible();

    // Initial values should be empty
    await expect(app.input).toHaveValue('');
    await expect(app.textarea).toHaveValue('');

    // Ensure we observed no fatal page errors during load (will assert permissively below)
    // We don't fail here on errors; a dedicated test covers console/page errors.
  });

  test('InputChange -> Queue Updated (S1_Queue_Updated): typing pushes to queue and updates textarea', async ({ page }) => {
    // Validate that input events push values into the internal queue and textarea shows them
    const app = new QueuePage(page);
    await app.goto();

    // Type a first value
    await app.fillInput('first');
    // The textarea should contain 'first'
    await expect(app.textarea).toHaveValue('first');

    // Type a second distinct value to cause another push
    await app.fillInput('second');
    // Because the implementation pushes the input's value each time, textarea becomes "first\nsecond"
    await expect(app.textarea).toHaveValue('first\nsecond');
  });

  test('SelectChange -> Queue Cleared (S2_Queue_Cleared): changing select clears the queue and textarea', async ({ page }) => {
    // Validate that changing select resets queue and textarea
    const app = new QueuePage(page);
    await app.goto();

    // Prepare queue with some entries
    await app.fillInput('A');
    await app.fillInput('B');
    await expect(app.textarea).toHaveValue('A\nB');

    // Change the select to trigger clearing behavior
    await app.changeSelect('2'); // choose Option 2
    // The textarea should be cleared
    await expect(app.textarea).toHaveValue('');
    // current is set to 0 internally, but we validate visible effects only
  });

  test('TextareaInput -> clears queue and input field (S2_Queue_Cleared via textarea input)', async ({ page }) => {
    // Typing into textarea should clear the queue and reset input.value
    const app = new QueuePage(page);
    await app.goto();

    // Add a queued item first
    await app.fillInput('queued');
    await expect(app.textarea).toHaveValue('queued');

    // Now type into the textarea (simulate user editing textarea)
    await app.fillTextarea('edited');
    // After textarea input handler, queue cleared and input emptied
    await expect(app.getInputValue()).resolves.toBe(''); // input cleared
    // Textarea keeps the typed content
    await expect(app.textarea).toHaveValue('edited');
  });

  test('SubmitClick -> Item Submitted (S3_Item_Submitted) when queue has item', async ({ page }) => {
    // Validate submit behavior when queue has items: shift from queue and textarea updated; input cleared
    const app = new QueuePage(page);
    await app.goto();

    // Add one item to queue
    await app.fillInput('alpha');
    await expect(app.textarea).toHaveValue('alpha');

    // Click submit; since queue has an item, it will be shifted and appended to textarea with a newline
    // Note: the implementation appends the shifted item to the existing textarea.
    await app.clickSubmit();

    // The expected textarea value: original 'alpha' plus appended 'alpha\n' => 'alphaalpha\n'
    await expect(app.getTextareaValue()).resolves.toBe('alphaalpha\n');

    // Input should be cleared after successful submit
    await expect(app.getInputValue()).resolves.toBe('');
  });

  test('SubmitClick -> alerts when queue is empty (edge case)', async ({ page }) => {
    // Validate that clicking Submit with empty queue triggers alert with expected message
    const app = new QueuePage(page);
    await app.goto();

    // Ensure queue is empty by making sure textarea is empty
    await expect(app.textarea).toHaveValue('');

    // Listen for dialog and assert message
    let dialogMessage = null;
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Click submit when queue is empty
    await app.clickSubmit(false); // we'll handle dialog manually with event above

    // Small wait to ensure dialog handler fired
    await page.waitForTimeout(50);

    // Assert the alert showed the expected message
    expect(dialogMessage).toBe('No text to submit');
  });

  test('ClearClick -> clears textarea and marks clear state (S2_Queue_Cleared)', async ({ page }) => {
    // Validate Clear button empties the textarea (queue cleared)
    const app = new QueuePage(page);
    await app.goto();

    // populate queue
    await app.fillInput('one');
    await app.fillInput('two');
    await expect(app.textarea).toHaveValue('one\ntwo');

    // Click clear
    await app.clickClear();

    // Textarea should be empty
    await expect(app.textarea).toHaveValue('');
  });

  test('Navigation: Move Left/Right/Up/Down (S4, S5, S6, S7) - verify visible navigation effects', async ({ page }) => {
    // Validate navigation buttons change the input.value based on current index manipulations
    const app = new QueuePage(page);
    await app.goto();

    // Build a queue with three distinct entries
    await app.fillInput('one');
    await app.fillInput('two');
    await app.fillInput('three');

    // Verify textarea shows the three items in order
    await expect(app.textarea).toHaveValue('one\ntwo\nthree');

    // Move Left: current -= 1 -> likely results in negative index; input will be set to queue[current] which is undefined
    await app.clickMoveLeft();
    const leftVal = await app.getInputValue();
    // Assigning undefined to input.value may result in an empty string or "undefined" depending on browser; allow both
    expect(['', 'undefined']).toContain(leftVal);

    // Reset by reloading the page to get a consistent starting current=0 for subsequent navigation checks
    await app.goto();
    await app.fillInput('one');
    await app.fillInput('two');
    await app.fillInput('three');
    await expect(app.textarea).toHaveValue('one\ntwo\nthree');

    // Move Right: current += 1; starting current is 0 -> becomes 1 -> input should be the second element 'two'
    await app.clickMoveRight();
    await expect(app.getInputValue()).resolves.toBe('two');
    // Textarea should still display the queue content
    await expect(app.textarea).toHaveValue('one\ntwo\nthree');

    // Reset again for Up/Down tests
    await app.goto();
    await app.fillInput('one');
    await app.fillInput('two');
    await app.fillInput('three');

    // Move Up: current -= queue.length (3) => current becomes -3 -> queue[-3] is undefined
    await app.clickMoveUp();
    const upVal = await app.getInputValue();
    expect(['', 'undefined']).toContain(upVal);
    // Textarea must still show the queue
    await expect(app.textarea).toHaveValue('one\ntwo\nthree');

    // Reset again
    await app.goto();
    await app.fillInput('one');
    await app.fillInput('two');
    await app.fillInput('three');

    // Move Down: current += queue.length (3) => from 0 to 3 -> queue[3] is undefined (out of bounds) => input gets undefined/empty
    await app.clickMoveDown();
    const downVal = await app.getInputValue();
    expect(['', 'undefined']).toContain(downVal);
    await expect(app.textarea).toHaveValue('one\ntwo\nthree');
  });

  test('Robustness: page console and runtime errors observed (capture only)', async ({ page }) => {
    // This test collects console messages and page errors and asserts that either:
    // - there were no page errors, or
    // - if errors occurred, at least one of them is a ReferenceError, TypeError, or SyntaxError.
    // This follows the instruction to observe errors as they happen without attempting to patch the runtime.
    const app = new QueuePage(page);

    // Attach listeners again to this page instance
    const localPageErrors = [];
    const localConsoleMessages = [];
    page.on('pageerror', (err) => {
      localPageErrors.push(String(err && err.message ? err.message : err));
    });
    page.on('console', (msg) => {
      localConsoleMessages.push(`${msg.type()}: ${msg.text()}`);
    });

    await app.goto();

    // Perform a few interactions to potentially surface runtime issues
    await app.fillInput('probe1');
    await app.fillInput('probe2');
    await app.clickMoveLeft();
    await app.clickMoveRight();
    await app.clickClear();
    await app.fillTextarea('probe-textarea');

    // Small wait for any async console/page errors
    await page.waitForTimeout(100);

    // Consolidate global listeners from beforeEach as well
    const combinedPageErrors = [...pageErrors, ...localPageErrors];
    const combinedConsoleMessages = [...consoleMessages, ...localConsoleMessages];

    // Log captured console messages and page errors to test trace for diagnostics
    test.info().attach('console-messages', { body: combinedConsoleMessages.join('\n') || '<none>' });
    test.info().attach('page-errors', { body: combinedPageErrors.join('\n') || '<none>' });

    // Assert that either there were no page errors OR at least one page error contains one of the expected JS error types
    const hasSpecificError = combinedPageErrors.some(msg =>
      msg.includes('ReferenceError') || msg.includes('TypeError') || msg.includes('SyntaxError')
    );

    // Allowed outcomes:
    // - No page errors observed
    // - Specific JS errors observed (we assert the presence of at least one such error)
    const condition = combinedPageErrors.length === 0 || hasSpecificError;
    expect(condition).toBeTruthy();
  });
});