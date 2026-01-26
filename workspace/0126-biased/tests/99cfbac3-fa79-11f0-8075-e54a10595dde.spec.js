import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cfbac3-fa79-11f0-8075-e54a10595dde.html';

// Page Object Model for the Thread Interaction Demo
class ThreadPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      textInput: '#textInput',
      optionsSelect: '#optionsSelect',
      selectOptionButton: '#selectOptionButton',
      countButton: '#countButton',
      charCount: '#charCount',
      numberSlider: '#numberSlider',
      sliderValue: '#sliderValue',
      threadInput: '#threadInput',
      createThreadButton: '#createThreadButton',
      threadOutput: '#threadOutput'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillTextInput(text) {
    await this.page.fill(this.selectors.textInput, text);
  }

  async getTextInputValue() {
    return await this.page.inputValue(this.selectors.textInput);
  }

  async getCharCountText() {
    return (await this.page.locator(this.selectors.charCount).innerText()).trim();
  }

  async selectOption(value) {
    await this.page.selectOption(this.selectors.optionsSelect, value);
  }

  // Click submit and wait for dialog (if any)
  async clickSubmitExpectDialog() {
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog').catch(() => null),
      this.page.click(this.selectors.selectOptionButton)
    ]);
    return dialog;
  }

  async clickSubmitNoDialog() {
    await this.page.click(this.selectors.selectOptionButton);
  }

  async clickCountButtonExpectDialog() {
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog').catch(() => null),
      this.page.click(this.selectors.countButton)
    ]);
    return dialog;
  }

  async setSlider(value) {
    // Playwright slider can be set via fill input value attribute or evaluate
    await this.page.evalOnSelector(this.selectors.numberSlider, (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(value));
  }

  async getSliderValueText() {
    return (await this.page.locator(this.selectors.sliderValue).innerText()).trim();
  }

  async fillThreadInput(text) {
    await this.page.fill(this.selectors.threadInput, text);
  }

  async clickCreateThread() {
    await this.page.click(this.selectors.createThreadButton);
  }

  async getThreadOutputTexts() {
    return await this.page.locator(`${this.selectors.threadOutput} p`).allInnerTexts();
  }

  async getThreadInputValue() {
    return await this.page.inputValue(this.selectors.threadInput);
  }
}

test.describe('Thread Interaction Demo - FSM comprehensive tests', () => {
  // Containers to capture console errors and page errors across tests
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages and page errors
    page.on('console', (msg) => {
      // store only error-level console events for inspection
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', (err) => {
      // pageerror contains an Error object (uncaught exceptions)
      pageErrors.push(err);
    });
  });

  test('S0 Idle: initial UI elements are present and initial state values are correct', async ({ page }) => {
    // Validate initial presence of elements and initial values
    const threadPage = new ThreadPage(page);
    await threadPage.goto();

    // Basic checks: elements exist
    await expect(page.locator(threadPage.selectors.textInput)).toBeVisible();
    await expect(page.locator(threadPage.selectors.optionsSelect)).toBeVisible();
    await expect(page.locator(threadPage.selectors.selectOptionButton)).toBeVisible();
    await expect(page.locator(threadPage.selectors.countButton)).toBeVisible();
    await expect(page.locator(threadPage.selectors.numberSlider)).toBeVisible();
    await expect(page.locator(threadPage.selectors.threadInput)).toBeVisible();
    await expect(page.locator(threadPage.selectors.createThreadButton)).toBeVisible();
    await expect(page.locator(threadPage.selectors.threadOutput)).toBeVisible();

    // Initial values
    expect(await threadPage.getCharCountText()).toBe('0'); // charCount should start at 0
    expect(await threadPage.getSliderValueText()).toBe('50'); // slider default 50
    expect(await threadPage.getTextInputValue()).toBe(''); // text input empty
    expect(await threadPage.getThreadInputValue()).toBe(''); // thread input empty

    // Ensure no unexpected console errors or page errors occurred just from loading
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test.describe('SelectOption transitions (S1_ShowInput, S2_CountChars, S3_ClearInput)', () => {
    test('S1_ShowInput: selecting "show" triggers alert with input text (onEnter action)', async ({ page }) => {
      const threadPage = new ThreadPage(page);
      await threadPage.goto();

      // Prepare input text and ensure charCount updates on input events
      await threadPage.fillTextInput('HelloPlaywright');
      expect(await threadPage.getCharCountText()).toBe(String('HelloPlaywright'.length));

      // Select 'show' option and click Submit; expect dialog
      await threadPage.selectOption('show');
      const dialog = await threadPage.clickSubmitExpectDialog();
      expect(dialog).not.toBeNull();
      expect(dialog.message()).toBe('You entered: HelloPlaywright');
      await dialog.accept();

      // After alert, ensure input value still preserved (no clearing in 'show')
      expect(await threadPage.getTextInputValue()).toBe('HelloPlaywright');

      // No runtime errors should have occurred
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('S2_CountChars: selecting "count" triggers alert with character count', async ({ page }) => {
      const threadPage = new ThreadPage(page);
      await threadPage.goto();

      await threadPage.fillTextInput('abcde');
      expect(await threadPage.getCharCountText()).toBe('5');

      await threadPage.selectOption('count');
      const dialog = await threadPage.clickSubmitExpectDialog();
      expect(dialog).not.toBeNull();
      expect(dialog.message()).toBe('Character count: 5');
      await dialog.accept();

      // ensure the text input remains unchanged
      expect(await threadPage.getTextInputValue()).toBe('abcde');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('S3_ClearInput: selecting "clear" clears the text input and resets charCount', async ({ page }) => {
      const threadPage = new ThreadPage(page);
      await threadPage.goto();

      // Type text then clear via option
      await threadPage.fillTextInput('to be cleared');
      expect(await threadPage.getCharCountText()).toBe(String('to be cleared'.length));

      await threadPage.selectOption('clear');

      // Submit should not produce a dialog; ensure no unhandled dialog appears
      await threadPage.clickSubmitNoDialog();

      // After clearing, input should be empty and charCount reset to '0'
      expect(await threadPage.getTextInputValue()).toBe('');
      expect(await threadPage.getCharCountText()).toBe('0');

      // Ensure no console or page errors were emitted
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Selecting "none" does nothing (edge case)', async ({ page }) => {
      const threadPage = new ThreadPage(page);
      await threadPage.goto();

      await threadPage.fillTextInput('stays');
      expect(await threadPage.getCharCountText()).toBe('5');

      // Ensure option 'none' results in no dialog and no change to input
      await threadPage.selectOption('none');
      await threadPage.clickSubmitNoDialog();

      expect(await threadPage.getTextInputValue()).toBe('stays');
      expect(await threadPage.getCharCountText()).toBe('5');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('CountCharacters event and Character Count Alert (S4)', () => {
    test('S4_CharacterCountAlert: clicking Count Characters shows alert with current input length', async ({ page }) => {
      const threadPage = new ThreadPage(page);
      await threadPage.goto();

      // Type some text
      await threadPage.fillTextInput('xyz');
      expect(await threadPage.getCharCountText()).toBe('3');

      // Click the Count Characters button => expect dialog
      const dialog = await threadPage.clickCountButtonExpectDialog();
      expect(dialog).not.toBeNull();
      expect(dialog.message()).toBe('Character count in input: 3');
      await dialog.accept();

      // After alert, ensure input still present
      expect(await threadPage.getTextInputValue()).toBe('xyz');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Count button edge case: with empty input, alert shows 0', async ({ page }) => {
      const threadPage = new ThreadPage(page);
      await threadPage.goto();

      // Ensure empty input
      expect(await threadPage.getTextInputValue()).toBe('');
      expect(await threadPage.getCharCountText()).toBe('0');

      const dialog = await threadPage.clickCountButtonExpectDialog();
      expect(dialog).not.toBeNull();
      expect(dialog.message()).toBe('Character count in input: 0');
      await dialog.accept();

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Number Slider interactions and S0 reactive updates', () => {
    test('Slider updates sliderValue display on input events (edges min/max)', async ({ page }) => {
      const threadPage = new ThreadPage(page);
      await threadPage.goto();

      // Set to min (1)
      await threadPage.setSlider(1);
      expect(await threadPage.getSliderValueText()).toBe('1');

      // Set to max (100)
      await threadPage.setSlider(100);
      expect(await threadPage.getSliderValueText()).toBe('100');

      // Set to a middle value
      await threadPage.setSlider(42);
      expect(await threadPage.getSliderValueText()).toBe('42');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Thread creation transitions (S5_ThreadCreated) and edge cases', () => {
    test('S5_ThreadCreated: creating a thread appends new paragraph and clears the input', async ({ page }) => {
      const threadPage = new ThreadPage(page);
      await threadPage.goto();

      // Add a thread
      await threadPage.fillThreadInput('First thread message');
      await threadPage.clickCreateThread();

      // Expect one paragraph with the message
      let outputs = await threadPage.getThreadOutputTexts();
      expect(outputs).toContain('First thread message');

      // Thread input cleared after creation
      expect(await threadPage.getThreadInputValue()).toBe('');

      // Add another thread to ensure multiple appends work
      await threadPage.fillThreadInput('Second message');
      await threadPage.clickCreateThread();
      outputs = await threadPage.getThreadOutputTexts();
      expect(outputs).toEqual(expect.arrayContaining(['First thread message', 'Second message']));

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Edge case: clicking Create Thread with empty input should not append anything', async ({ page }) => {
      const threadPage = new ThreadPage(page);
      await threadPage.goto();

      // Ensure output is empty initially
      expect(await threadPage.getThreadOutputTexts()).toEqual([]);

      // Click create with empty input
      await threadPage.fillThreadInput(''); // ensure empty
      await threadPage.clickCreateThread();

      // Still empty
      expect(await threadPage.getThreadOutputTexts()).toEqual([]);
      expect(await threadPage.getThreadInputValue()).toBe('');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test('Monitor console and page errors during a sequence of interactions (observability test)', async ({ page }) => {
    // This test performs a mix of operations and ensures there are no uncaught exceptions
    const threadPage = new ThreadPage(page);
    await threadPage.goto();

    // Start with typing
    await threadPage.fillTextInput('observe');
    expect(await threadPage.getCharCountText()).toBe('7');

    // Use slider
    await threadPage.setSlider(77);
    expect(await threadPage.getSliderValueText()).toBe('77');

    // Create a thread
    await threadPage.fillThreadInput('observe thread');
    await threadPage.clickCreateThread();
    expect(await threadPage.getThreadOutputTexts()).toContain('observe thread');

    // Trigger count and show dialogs sequentially and accept them
    const dialog1 = await threadPage.clickCountButtonExpectDialog();
    expect(dialog1).not.toBeNull();
    await dialog1.accept();

    await threadPage.selectOption('show');
    const dialog2 = await threadPage.clickSubmitExpectDialog();
    expect(dialog2).not.toBeNull();
    await dialog2.accept();

    // Final checks for absence of console error / page errors
    // We allow that errors may occur naturally in the environment; assert none were captured during these actions.
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});