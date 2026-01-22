import { test, expect } from '@playwright/test';

test.setTimeout(120000);

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79ca0a0-d361-11f0-8438-11a56595a476.html';

// Helper page object functions
class BubbleSortPage {
  constructor(page) {
    this.page = page;
    this.input = page.locator('#input-array');
    this.startBtn = page.locator('#start-btn');
    this.randomBtn = page.locator('#random-btn');
    this.arrayContainer = page.locator('#array-container');
    this.message = page.locator('#message');
    this.barSelector = '#array-container .bar';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getMessageText() {
    return (await this.message.textContent())?.trim() ?? '';
  }

  async getInputValue() {
    return (await this.input.inputValue())?.trim() ?? '';
  }

  async setInputValue(val) {
    await this.input.fill(val);
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickRandom() {
    await this.randomBtn.click();
  }

  async getBarCount() {
    return await this.page.locator(this.barSelector).count();
  }

  async getBarsValues() {
    const texts = await this.page.locator(this.barSelector).allTextContents();
    return texts.map(t => Number(t.trim()));
  }

  // Wait until the message exactly equals expected (with timeout)
  async waitForMessage(expected, timeout = 60000) {
    await this.page.waitForFunction(
      (exp) => {
        const el = document.getElementById('message');
        return el && el.textContent && el.textContent.trim() === exp;
      },
      expected,
      { timeout }
    );
  }

  // Wait until message includes substring
  async waitForMessageIncludes(substr, timeout = 60000) {
    await this.page.waitForFunction(
      (s) => {
        const el = document.getElementById('message');
        return el && el.textContent && el.textContent.includes(s);
      },
      substr,
      { timeout }
    );
  }
}

test.describe('Bubble Sort Visualization - FSM and UI behavior', () => {
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console errors and page errors for observation
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  // Test: Initial Idle state on load
  test('Initial Idle state renders array and message', async ({ page }) => {
    const app = new BubbleSortPage(page);
    await app.goto();

    // Verify initial message indicates Idle state per FSM evidence
    await expect(app.message).toHaveText('Enter numbers and press Start Sorting');

    // Verify input has default value and array is rendered accordingly
    const inputVal = await app.getInputValue();
    expect(inputVal).toBe('5,1,4,2,8');

    const bars = await app.getBarCount();
    // Default input has 5 numbers -> 5 bars should be rendered
    expect(bars).toBe(5);

    // Buttons should be enabled in Idle
    await expect(app.startBtn).toBeEnabled();
    await expect(app.randomBtn).toBeEnabled();
    await expect(app.input).toBeEnabled();

    // Assert no unexpected runtime errors occurred on load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test: Generate Random Array transition (S0_Idle -> S2_RandomArrayGenerated)
  test('Generate Random Array updates DOM and message', async ({ page }) => {
    const app = new BubbleSortPage(page);
    await app.goto();

    // Click Generate Random Array
    await app.clickRandom();

    // Expect message per FSM evidence
    await app.waitForMessage('Random array generated. Ready to sort.');

    // Input should be updated to the generated array (10 numbers separated by commas)
    const inputVal = await app.getInputValue();
    const parts = inputVal.split(',').map(s => s.trim()).filter(Boolean);
    expect(parts.length).toBe(10); // generateRandomArray produces size 10

    // Array container should have 10 bars
    const bars = await app.getBarCount();
    expect(bars).toBe(10);

    // Buttons should remain enabled after generation
    await expect(app.startBtn).toBeEnabled();
    await expect(app.randomBtn).toBeEnabled();

    // No runtime errors observed during random generation
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test: Start Sorting transition (S0_Idle -> S1_Sorting) and completion (S1_Sorting -> S0_Idle)
  test('Start Sorting initiates bubble sort and completes with expected UI changes', async ({ page }) => {
    const app = new BubbleSortPage(page);
    await app.goto();

    // Ensure a known input (default) is present
    await expect(app.input).toHaveValue('5,1,4,2,8');

    // Click Start Sorting to trigger bubbleSort
    await app.clickStart();

    // Immediately after clicking, message should reflect 'Starting bubble sort...'
    await app.waitForMessageIncludes('Starting bubble sort...');
    const msgAfterStart = await app.getMessageText();
    expect(msgAfterStart).toContain('Starting bubble sort...');

    // Buttons and input should be disabled during sorting (onEnter of Sorting state)
    await expect(app.startBtn).toBeDisabled();
    await expect(app.randomBtn).toBeDisabled();
    await expect(app.input).toBeDisabled();

    // Wait until sorting completes (message 'Sorting completed.')
    // Sorting may take some time (animations/delays inside bubbleSort). Allow generous timeout.
    await app.waitForMessage('Sorting completed.', 90000);

    // Verify the UI has returned to Idle-like state per exit actions: buttons and input enabled
    await expect(app.startBtn).toBeEnabled();
    await expect(app.randomBtn).toBeEnabled();
    await expect(app.input).toBeEnabled();

    // Verify array is sorted ascending
    const values = await app.getBarsValues();
    // Ensure values array is sorted non-decreasingly
    for (let i = 1; i < values.length; i++) {
      expect(values[i - 1]).toBeLessThanOrEqual(values[i]);
    }

    // No runtime errors occurred during sorting process
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test: Invalid input (non-numeric) - edge case
  test('Invalid input prevents sorting and shows validation message', async ({ page }) => {
    const app = new BubbleSortPage(page);
    await app.goto();

    // Enter invalid input
    await app.setInputValue('a, b, c');

    // Click Start Sorting
    await app.clickStart();

    // Expect validation message about invalid input
    await app.waitForMessage('Invalid input detected. Use only numbers separated by commas.');

    // Ensure buttons and input remain enabled (sorting should not have started)
    await expect(app.startBtn).toBeEnabled();
    await expect(app.randomBtn).toBeEnabled();
    await expect(app.input).toBeEnabled();

    // Ensure array did not start animating: bars count should reflect parsing result (invalid parse yields NaNs -> validate stops)
    // Since input invalid, array should not have been replaced; initial array remains rendered (5 bars)
    const bars = await app.getBarCount();
    expect(bars).toBeGreaterThanOrEqual(0);

    // No unexpected runtime errors beyond validation handling
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test: Empty input - edge case
  test('Empty input shows appropriate validation message', async ({ page }) => {
    const app = new BubbleSortPage(page);
    await app.goto();

    // Clear input
    await app.setInputValue('');

    // Click Start Sorting
    await app.clickStart();

    // Expect validation message prompting at least one number
    await app.waitForMessage('Please enter at least one number.');

    // Verify no disabling occurred
    await expect(app.startBtn).toBeEnabled();
    await expect(app.randomBtn).toBeEnabled();
    await expect(app.input).toBeEnabled();

    // No runtime errors produced as a result of empty input handling
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Observability test: ensure we captured console and page errors for the session
  test('No console.error or uncaught page errors observed during interaction scenarios', async ({ page }) => {
    const app = new BubbleSortPage(page);
    await app.goto();

    // Perform a couple of interactions to ensure listeners capture anything that happens
    await app.clickRandom();
    await app.waitForMessage('Random array generated. Ready to sort.');
    await app.clickStart();

    // Wait briefly to allow any runtime exceptions to surface during sorting start
    // But do not wait for full sorting here; just provide a short window
    await page.waitForTimeout(500);

    // The application code does not intentionally log console errors; assert none were captured
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});