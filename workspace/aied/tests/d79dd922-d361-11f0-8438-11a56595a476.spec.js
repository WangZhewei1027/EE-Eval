import { test, expect } from '@playwright/test';

// Test file for Application ID: d79dd922-d361-11f0-8438-11a56595a476
// URL under test:
// http://127.0.0.1:5500/workspace/batch-1207/html/d79dd922-d361-11f0-8438-11a56595a476.html

// Page Object capturing commonly used selectors and interactions
class SlidingWindowPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#arrayInput');
    this.windowInput = page.locator('#windowSize');
    this.startBtn = page.locator('#startBtn');
    this.container = page.locator('#arrayContainer');
    this.result = page.locator('#result');
    this.arrayElements = page.locator('#arrayContainer .array-element');
  }

  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/batch-1207/html/d79dd922-d361-11f0-8438-11a56595a476.html');
    // Wait for the basic controls to be available
    await expect(this.arrayInput).toBeVisible();
    await expect(this.windowInput).toBeVisible();
    await expect(this.startBtn).toBeVisible();
  }

  async setArray(value) {
    await this.arrayInput.fill('');
    await this.arrayInput.type(value);
  }

  async setWindowSize(value) {
    await this.windowInput.fill('');
    await this.windowInput.type(String(value));
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async isInputDisabled() {
    return (await this.arrayInput.isDisabled()) && (await this.windowInput.isDisabled()) && (await this.startBtn.isDisabled());
  }

  async isInputEnabled() {
    return !(await this.arrayInput.isDisabled()) && !(await this.windowInput.isDisabled()) && !(await this.startBtn.isDisabled());
  }

  async getResultText() {
    return (await this.result.textContent()) || '';
  }

  async getArrayElementsCount() {
    return await this.arrayElements.count();
  }

  async getArrayElementText(index) {
    return (await this.arrayElements.nth(index).textContent()) || '';
  }

  async getArrayElementHasClass(index, className) {
    return await this.arrayElements.nth(index).evaluate((el, c) => el.classList.contains(c), className);
  }
}

// Group tests related to FSM states/transitions and edge cases
test.describe('Sliding Window Visualization - FSM Tests', () => {
  // Collect console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;
  let dialogMessages;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogMessages = [];

    // Collect console messages
    page.on('console', msg => {
      const type = msg.type(); // log, error, warning, etc.
      consoleMessages.push({ type, text: msg.text() });
    });

    // Collect uncaught exceptions / page errors
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Collect dialogs (alerts) and accept them, recording message
    page.on('dialog', async dialog => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });
  });

  test.afterEach(async () => {
    // nothing to teardown globally; each test navigates fresh
  });

  test('S0_Idle state on initial load: inputs enabled, visualization cleared', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) entry actions:
    // - clearVisualization() should result in empty container and empty result
    // - inputs should be enabled for the user
    const p = new SlidingWindowPage(page);
    await p.goto();

    // Assert container is empty and result is empty (evidence for clearVisualization)
    await expect(p.container).toBeEmpty();
    await expect(p.result).toHaveText(''); // result.textContent === ''

    // Inputs should be enabled in Idle state
    expect(await p.isInputEnabled()).toBe(true);

    // Ensure no runtime page errors on initial load
    expect(pageErrors.length).toBe(0);

    // Console should not contain any severe errors (we still capture it)
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleEntries.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_Visualizing on StartVisualization: inputs disabled and first window shown', async ({ page }) => {
    // This test validates the StartVisualization event and entry into Visualizing state:
    // - clicking startBtn triggers runVisualization(array, k)
    // - inputs become disabled
    // - visualization is drawn for the first window and result shows first max
    const p = new SlidingWindowPage(page);
    await p.goto();

    // Ensure initial known values (per FSM/components)
    await expect(p.arrayInput).toHaveValue('2,1,3,4,6,3,8,9,10,12,56');
    await expect(p.windowInput).toHaveValue('4');

    // Click start and then immediately assert that inputs are disabled and container got populated
    await p.clickStart();

    // After clicking, runVisualization disables inputs immediately
    await expect.poll(async () => await p.isInputDisabled(), { timeout: 3000 }).toBe(true);

    // The container should be populated with array elements for the first window
    // There should be as many elements as array length (11)
    await expect.poll(async () => await p.getArrayElementsCount(), { timeout: 3000 }).toBeGreaterThan(0);

    const count = await p.getArrayElementsCount();
    expect(count).toBeGreaterThanOrEqual(11); // array has 11 elements, ensure rendered

    // First shown step should be window [0 .. 3] with Max = 4
    // result.textContent = `Window [0 .. 3]: Max = 4` initially
    await expect(p.result).toHaveText(/Window \[0 \.\. 3\]: Max = 4/);

    // Visual cues: elements in indices 0..3 should have 'in-window' class
    for (let i = 0; i <= 3; i++) {
      const hasInWindow = await p.getArrayElementHasClass(i, 'in-window');
      expect(hasInWindow).toBe(true);
    }

    // One of those (index of max within window) should have 'current-max'; for [2,1,3,4] max at index 3
    expect(await p.getArrayElementHasClass(3, 'current-max')).toBe(true);

    // Ensure no script-level page errors were thrown on starting visualization
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S1_Visualizing -> S2_Finished: visualization completes and inputs re-enabled', async ({ page }) => {
    // This test validates that after all windows are processed:
    // - the result contains the finished suffix
    // - inputs become enabled again (exit_actions)
    // - final max value corresponds to last window
    const p = new SlidingWindowPage(page);
    await p.goto();

    // Start visualization with default values
    await p.clickStart();

    // Wait for the final "Finished sliding all windows." note to appear.
    // This is a real-time visualization that uses setInterval(1300). We allow generous timeout.
    await page.waitForFunction(
      () => {
        const el = document.getElementById('result');
        return el && el.textContent && el.textContent.includes('Finished sliding all windows.');
      },
      { timeout: 20000 }
    );

    // Now final text should contain both the final max and the finished message.
    const finalText = await p.getResultText();
    expect(finalText).toContain('Finished sliding all windows.');

    // For the provided array and k=4, the last window is indices 7..10 and max should be 56
    expect(finalText).toContain('Max = 56');

    // After finishing, inputs should have been re-enabled (exit action disableInputs(false))
    await expect.poll(async () => await p.isInputEnabled(), { timeout: 2000 }).toBe(true);

    // No uncaught page errors should have happened during the whole process
    expect(pageErrors.length).toBe(0);
  }, 25000); // increase test timeout for long-running visualization

  test('Edge case: empty array input triggers alert and no visualization starts', async ({ page }) => {
    // This test validates error scenario handling on input validation:
    // - empty array input triggers alert 'Please enter a valid array of integers.'
    // - no visualization should be started (inputs remain enabled)
    const p = new SlidingWindowPage(page);
    await p.goto();

    // Replace array with empty string and click start
    await p.setArray('');
    await p.clickStart();

    // dialogMessages should capture the alert; it was accepted in beforeEach handler
    await expect.poll(() => dialogMessages.length > 0, { timeout: 2000 }).toBe(true);
    expect(dialogMessages[0]).toContain('Please enter a valid array of integers.');

    // Inputs should remain enabled and no visualization started (container empty)
    expect(await p.isInputEnabled()).toBe(true);
    await expect(p.container).toBeEmpty();

    // No script errors
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: non-integer array element triggers alert and no visualization', async ({ page }) => {
    // This test validates validation: non-numeric entries produce alert about integers only
    const p = new SlidingWindowPage(page);
    await p.goto();

    await p.setArray('1, 2, foo, 4');
    await p.setWindowSize('2');
    await p.clickStart();

    await expect.poll(() => dialogMessages.length > 0, { timeout: 2000 }).toBe(true);
    // The second dialog message should correspond to this test
    const msg = dialogMessages[dialogMessages.length - 1];
    expect(msg).toContain('Array must contain only integers');

    // Ensure no visualization started
    expect(await p.isInputEnabled()).toBe(true);
    await expect(p.container).toBeEmpty();

    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: window size out of bounds triggers alert and prevents visualization', async ({ page }) => {
    // Validate that window size > array length is rejected with appropriate alert
    const p = new SlidingWindowPage(page);
    await p.goto();

    // Array has 11 elements by default, set window size to 20
    await p.setWindowSize('20');
    await p.clickStart();

    await expect.poll(() => dialogMessages.length > 0, { timeout: 2000 }).toBe(true);
    const lastMsg = dialogMessages[dialogMessages.length - 1];
    expect(lastMsg).toContain('Window size k must be an integer between 1 and array length');

    // No visualization started
    expect(await p.isInputEnabled()).toBe(true);
    await expect(p.container).toBeEmpty();

    expect(pageErrors.length).toBe(0);
  });

  test('Visual feedback classes and aria-labels applied for current max elements', async ({ page }) => {
    // This test checks DOM-level evidence supporting states and accessibility:
    // - elements in window should have class 'in-window'
    // - current max element should have class 'current-max' and an aria-label describing it
    const p = new SlidingWindowPage(page);
    await p.goto();

    // Start visualization
    await p.clickStart();

    // Initial step should be [0..3], max index 3 (value 4)
    await expect(p.result).toHaveText(/Window \[0 \.\. 3\]: Max = 4/);

    // Check that index 3 has 'current-max' and aria-label set
    const hasCurrentMax = await p.getArrayElementHasClass(3, 'current-max');
    expect(hasCurrentMax).toBe(true);

    const ariaLabel = await p.arrayElements.nth(3).getAttribute('aria-label');
    expect(ariaLabel).toContain('maximum in current window');

    // No unexpected runtime errors
    expect(pageErrors.length).toBe(0);
  });

  test('Observe console logs and page errors during interactions (recording only)', async ({ page }) => {
    // This test ensures that we are observing console and page errors while interacting.
    // It does not assert that errors must exist; it records them and asserts none are critical.
    const p = new SlidingWindowPage(page);
    await p.goto();

    // Force an invalid input to generate an alert (captured in dialogMessages)
    await p.setArray('a,b,c');
    await p.clickStart();

    await expect.poll(() => dialogMessages.length > 0, { timeout: 2000 }).toBe(true);

    // After interactions, verify the collected console messages and errors are accessible
    // We assert no pageErrors, and that console messages, if any, are recorded (non-empty array allowed).
    expect(Array.isArray(consoleMessages)).toBe(true);
    expect(Array.isArray(pageErrors)).toBe(true);

    // No uncaught errors are expected
    expect(pageErrors.length).toBe(0);
  });
});