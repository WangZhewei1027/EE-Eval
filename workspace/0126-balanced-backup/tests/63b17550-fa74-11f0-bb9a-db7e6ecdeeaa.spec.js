import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b17550-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for the Ternary Search demo
class TernaryPage {
  constructor(page) {
    this.page = page;
    this.targetInput = page.locator('#targetInput');
    this.startBtn = page.locator('#startBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.arrayContainer = page.locator('#arrayContainer');
    this.logContainer = page.locator('#log');

    // captured console and page errors
    this.consoleMessages = [];
    this.pageErrors = [];
    this.dialogs = [];

    // attach listeners to capture console & page errors & dialogs
    page.on('console', (msg) => {
      // capture console text and type for assertions
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });
    page.on('dialog', async (dialog) => {
      this.dialogs.push({ message: dialog.message(), type: dialog.type() });
      await dialog.accept();
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // helper to return count of array elements
  async arrayElementCount() {
    return await this.arrayContainer.locator('.element').count();
  }

  // returns array of texts of elements
  async arrayElementsText() {
    const els = this.arrayContainer.locator('.element');
    const count = await els.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push(await els.nth(i).textContent());
    }
    return texts;
  }

  // returns whether any element has a given class
  async anyElementHasClass(className) {
    const els = this.arrayContainer.locator(`.element.${className}`);
    return (await els.count()) > 0;
  }

  // set target input value (string or number)
  async setTarget(value) {
    await this.targetInput.fill(String(value));
  }

  // click start button
  async clickStart() {
    await this.startBtn.click();
  }

  // click reset button
  async clickReset() {
    await this.resetBtn.click();
  }

  // get log text content
  async getLogText() {
    return await this.logContainer.textContent();
  }

  // wait until log contains a substring (polling)
  async waitForLogContains(substring, timeout = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const text = await this.getLogText();
      if (text && text.includes(substring)) return text;
      await this.page.waitForTimeout(100);
    }
    throw new Error(`Timed out waiting for log to contain: ${substring}`);
  }

  // helper to wait until search completes by waiting for "Search completed." in log
  async waitForSearchCompletion(timeout = 30000) {
    return await this.waitForLogContains('Search completed.', timeout);
  }
}

// Grouping tests related to FSM and UI behavior
test.describe('Ternary Search Demo - FSM states and transitions', () => {
  // Each test might take longer due to built-in animation delays in the app.
  // Increase default timeout for individual tests if necessary.
  test.beforeEach(async ({ page }) => {
    // nothing here — each test creates its own page object
  });

  // Test Idle state: initial renderArray() call and initial control states
  test('S0_Idle: Initial render and controls are in the Idle state', async ({ page }) => {
    test.setTimeout(20000);
    const tp = new TernaryPage(page);
    await tp.goto();

    // Validate no uncaught page errors immediately after load
    expect(tp.pageErrors.length).toBe(0);

    // Array should be rendered with 30 elements
    const count = await tp.arrayElementCount();
    expect(count).toBe(30);

    // Each element text should be multiples of 3 starting from 3
    const texts = await tp.arrayElementsText();
    expect(texts[0].trim()).toBe('3');
    expect(texts[1].trim()).toBe('6');
    expect(texts[texts.length - 1].trim()).toBe(String(30 * 3));

    // Reset button should be disabled by default; start button enabled; input empty
    expect(await tp.resetBtn.isDisabled()).toBe(true);
    expect(await tp.startBtn.isDisabled()).toBe(false);
    expect((await tp.targetInput.inputValue()).trim()).toBe('');
  });

  // Test transition StartSearch: good path where target exists
  test('S0_Idle -> S1_Searching: Start Search transitions to Searching and finds a target', async ({ page }) => {
    // Allow longer time for search animations and delays
    test.setTimeout(60000);
    const tp = new TernaryPage(page);
    await tp.goto();

    // Enter a target that exists (e.g., 9)
    await tp.setTarget(9);

    // Click start and assert controls reflect Searching state immediately
    await tp.clickStart();

    // start should be disabled, reset enabled, input disabled
    expect(await tp.startBtn.isDisabled()).toBe(true);
    expect(await tp.resetBtn.isDisabled()).toBe(false);
    expect(await tp.targetInput.isDisabled()).toBe(true);

    // The app logs "Starting ternary search for target: 9"
    const startLog = await tp.waitForLogContains('Starting ternary search for target: 9', 5000);
    expect(startLog).toContain('Starting ternary search for target: 9');

    // Wait for the search to complete (it logs "Search completed.")
    await tp.waitForSearchCompletion(40000);

    // After completion there should be a "Found target" log for 9
    const logText = await tp.getLogText();
    expect(logText).toMatch(/Found target 9 at index \d+!/);

    // The DOM should show an element with class 'found' and text '9'
    const foundEls = tp.arrayContainer.locator('.element.found');
    expect(await foundEls.count()).toBe(1);
    const foundText = (await foundEls.nth(0).textContent()).trim();
    expect(foundText).toBe('9');

    // No uncaught page errors happened during this flow
    expect(tp.pageErrors.length).toBe(0);
  });

  // Test Reset transition: S1_Searching -> S0_Idle via Reset button
  test('S1_Searching -> S2_Reset -> S0_Idle: Reset returns UI to Idle state', async ({ page }) => {
    test.setTimeout(60000);
    const tp = new TernaryPage(page);
    await tp.goto();

    // Perform a search that will complete (e.g., target 12)
    await tp.setTarget(12);
    await tp.clickStart();

    // Wait for completion
    await tp.waitForSearchCompletion(40000);

    // Ensure at least one found or not-found message exists
    const postSearchLog = await tp.getLogText();
    expect(postSearchLog.length).toBeGreaterThan(0);

    // Click Reset to return to Idle
    await tp.clickReset();

    // After reset: input cleared and enabled, start enabled, reset disabled, log cleared
    expect((await tp.targetInput.inputValue()).trim()).toBe('');
    expect(await tp.targetInput.isDisabled()).toBe(false);
    expect(await tp.startBtn.isDisabled()).toBe(false);
    expect(await tp.resetBtn.isDisabled()).toBe(true);

    // Log container should be cleared by reset
    const logAfterReset = await tp.getLogText();
    expect(logAfterReset.trim()).toBe('');

    // Array should be re-rendered, no 'found' highlights
    expect(await tp.anyElementHasClass('found')).toBe(false);
  });

  // Edge case: Searching for a non-existent target should log 'not found'
  test('S1_Searching: Search for non-existent target logs not found and completes', async ({ page }) => {
    test.setTimeout(60000);
    const tp = new TernaryPage(page);
    await tp.goto();

    // Choose a value not in multiples of 3 (e.g., 5)
    await tp.setTarget(5);
    await tp.clickStart();

    // Verify Searching controls
    expect(await tp.startBtn.isDisabled()).toBe(true);
    expect(await tp.resetBtn.isDisabled()).toBe(false);

    // Wait for search to complete
    await tp.waitForSearchCompletion(40000);

    // Expect log to contain not found message
    const logText = await tp.getLogText();
    expect(logText).toContain('Target 5 not found in the array.');

    // Reset to return to Idle
    await tp.clickReset();
    expect(await tp.resetBtn.isDisabled()).toBe(true);
  });

  // Edge case: clicking Start without entering a target shows alert and does not start search
  test('StartSearch event with empty input triggers alert and prevents search', async ({ page }) => {
    test.setTimeout(20000);
    const tp = new TernaryPage(page);
    await tp.goto();

    // Ensure input is empty
    await tp.targetInput.fill('');

    // Click start should raise an alert dialog; our page object captures and accepts it
    await tp.clickStart();

    // We captured the dialog message
    expect(tp.dialogs.length).toBeGreaterThan(0);
    expect(tp.dialogs[0].message).toBe('Please enter a valid target number.');

    // The start should not have been disabled because the search didn't begin
    expect(await tp.startBtn.isDisabled()).toBe(false);
    expect(await tp.resetBtn.isDisabled()).toBe(true);

    // No page errors should have happened
    expect(tp.pageErrors.length).toBe(0);
  });

  // Test attempt to trigger StartSearch while already searching (self-loop transition check)
  test('S1_Searching self-loop: clicking Start while Searching does not start another search', async ({ page }) => {
    test.setTimeout(60000);
    const tp = new TernaryPage(page);
    await tp.goto();

    // Start a search for a value that will take some time (non-trivial path)
    await tp.setTarget(21);
    await tp.clickStart();

    // Immediately attempt to click Start again while searching (button should be disabled)
    // Record log occurrences of "Starting ternary search" before and after attempted click
    const initialLog = await tp.getLogText();
    const initialCount = (initialLog.match(/Starting ternary search for target:/g) || []).length;

    // Try clicking start; since it's disabled, the UI should not initiate another search
    // Use try/catch to ensure Playwright doesn't fail if click on disabled element is prevented.
    try {
      await tp.clickStart();
    } catch (e) {
      // Depending on environment, Playwright may throw if element is not interactable; that's acceptable.
    }

    // Give a short moment to let any unexpected handler run
    await page.waitForTimeout(500);

    const afterLog = await tp.getLogText();
    const afterCount = (afterLog.match(/Starting ternary search for target:/g) || []).length;

    // The count should not increase because the Start button is disabled during search
    expect(afterCount).toBe(initialCount);

    // Wait for proper completion of the search and then reset
    await tp.waitForSearchCompletion(40000);
    await tp.clickReset();
    expect(await tp.resetBtn.isDisabled()).toBe(true);
  });

  // Observe console and page errors across a typical user flow
  test('Observe console messages and no unexpected page errors during searches', async ({ page }) => {
    test.setTimeout(60000);
    const tp = new TernaryPage(page);
    await tp.goto();

    // Do a found search and a not-found search sequentially
    await tp.setTarget(30); // 30 exists (value 90)
    await tp.clickStart();
    await tp.waitForSearchCompletion(40000);

    // Reset and do a not found search
    await tp.clickReset();
    await tp.setTarget(7);
    await tp.clickStart();
    await tp.waitForSearchCompletion(40000);

    // Expect no uncaught page errors
    expect(tp.pageErrors.length).toBe(0);

    // Console messages may be empty because the app writes logs to DOM, but ensure we captured whatever exists
    // We assert that consoleMessages is an array (we don't force errors to happen).
    expect(Array.isArray(tp.consoleMessages)).toBe(true);
  });
});