import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b08381-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object Model for the Bubble Sort page
class BubbleSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.swapButton = page.locator('#swap-button');
    this.sortedList = page.locator('#sorted-list');
    this.exampleList = page.locator('#bubble-sort-example ul');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickSwapButton() {
    await this.swapButton.click();
  }

  async getSortedListItemsText() {
    return this.sortedList.locator('li').allTextContents();
  }

  async getExampleListItemsText() {
    return this.exampleList.locator('li').allTextContents();
  }

  async sortedListCount() {
    return this.sortedList.locator('li').count();
  }
}

// Group all tests related to the Bubble Sort interactive app
test.describe('Bubble Sort Interactive Application (f5b08381-fa7c-11f0-adc7-178f556b1ee0)', () => {
  // Arrays to capture console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  // Test initial UI state and that components exist.
  test('Initial State: components render correctly and sorted list is populated on load', async ({ page }) => {
    const app = new BubbleSortPage(page);
    // Navigate to the app
    await app.goto();

    // Verify core components exist
    await expect(app.swapButton).toBeVisible({ timeout: 2000 });
    await expect(app.sortedList).toBeVisible({ timeout: 2000 });

    // The implementation populates #sorted-list on load.
    // Verify it contains 5 list items representing the sorted array [1,2,3,5,8]
    const items = await app.getSortedListItemsText();
    // Each item should follow the pattern "index. value"
    expect(items.length).toBe(5);
    // Validate expected numeric values in order
    expect(items[0].trim()).toBe('1. 1');
    expect(items[1].trim()).toBe('2. 2');
    expect(items[2].trim()).toBe('3. 3');
    expect(items[3].trim()).toBe('4. 5');
    expect(items[4].trim()).toBe('5. 8');

    // Also check that the example list (the original unsorted list) remains present and unchanged
    const example = await app.getExampleListItemsText();
    expect(example).toEqual(['5', '2', '8', '3', '1']);

    // Observe console and page errors - assert that no unexpected runtime errors occurred during load.
    // We capture errors to satisfy the requirement of observing console/page errors.
    expect(consoleErrors.length, `console.error messages: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
    expect(pageErrors.length, `page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
  });

  // Test the FSM transition triggered by the Swap Elements button click.
  test('Transition: clicking Swap Elements results in a stable sorted state (idempotent behavior)', async ({ page }) => {
    const app = new BubbleSortPage(page);
    await app.goto();

    // Capture initial snapshot of sorted-list
    const beforeClick = await app.getSortedListItemsText();

    // Click the swap button once - the implementation does not attach an explicit click handler,
    // but the FSM expects a click to trigger sorting. We validate the observed behavior (no change).
    await app.clickSwapButton();

    // After clicking, the DOM should remain in a consistent sorted state (no duplication, still sorted)
    const afterClick = await app.getSortedListItemsText();
    expect(afterClick).toEqual(beforeClick);

    // Validate that the sorted content is still in ascending order and properly formatted
    for (let i = 0; i < afterClick.length; i++) {
      const expectedPrefix = `${i + 1}.`;
      expect(afterClick[i].startsWith(expectedPrefix)).toBeTruthy();
      // Ensure the numeric portion exists
      const parts = afterClick[i].split('.');
      expect(parts.length).toBeGreaterThanOrEqual(2);
      const numText = parts.slice(1).join('.').trim();
      // Ensure numeric value is present and is a number
      expect(Number.isFinite(Number(numText))).toBeTruthy();
    }

    // Ensure no console or page errors were introduced by the click interaction
    expect(consoleErrors.length, `console errors: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
    expect(pageErrors.length, `page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
  });

  // Edge case: rapid multiple clicks should not alter the sorted-list length or content
  test('Edge Case: multiple rapid clicks do not duplicate list items or cause errors', async ({ page }) => {
    const app = new BubbleSortPage(page);
    await app.goto();

    const initialItems = await app.getSortedListItemsText();
    const initialCount = await app.sortedListCount();

    // Rapidly click the swap button 10 times
    for (let i = 0; i < 10; i++) {
      await app.clickSwapButton();
    }

    // After multiple clicks, the sorted list should remain the same length and contents unchanged
    const finalItems = await app.getSortedListItemsText();
    const finalCount = await app.sortedListCount();

    expect(finalCount).toBe(initialCount);
    expect(finalItems).toEqual(initialItems);

    // No console or page errors must have occurred during rapid interactions
    expect(consoleErrors.length, `console errors during rapid clicks: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
    expect(pageErrors.length, `page errors during rapid clicks: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
  });

  // Explicit test to validate FSM states as observed in the DOM.
  // S0_Idle is the FSM initial state; however, the page implementation pre-populates the sorted output on load,
  // so the observed state after load corresponds to S1_Sorted. We assert that behavior explicitly.
  test('FSM States: verify observed state corresponds to S1_Sorted after page load', async ({ page }) => {
    const app = new BubbleSortPage(page);
    await app.goto();

    // According to the FSM, S1_Sorted should present a populated #sorted-list.
    const items = await app.getSortedListItemsText();
    expect(items.length).toBeGreaterThan(0);

    // Validate that content matches the "evidence" pattern from the FSM: entries like "index. value"
    items.forEach((text, index) => {
      const expectedPrefix = `${index + 1}.`;
      expect(text.startsWith(expectedPrefix)).toBeTruthy();
    });

    // Since the FSM lists S0_Idle as initial, include an assertion about the mismatch between FSM and implementation:
    // We assert that, in the running implementation, the page is already in the S1_Sorted observable state on load.
    // This documents an implementation/definition discrepancy.
    expect(items[0].includes('1. 1')).toBeTruthy();

    // No JS runtime errors observed at this point
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test that attempts to observe onEnter/onExit actions do not modify runtime (there are none defined).
  test('onEnter/onExit actions: none defined in FSM; verify page defines no additional lifecycle hooks that throw', async ({ page }) => {
    const app = new BubbleSortPage(page);
    await app.goto();

    // There are no explicit onEnter/onExit actions in the FSM. We confirm that the page does not throw during load or interactions.
    // Perform a benign interaction: focus and blur the swap button to simulate lifecycle-like events.
    await app.swapButton.focus();
    await app.swapButton.blur();

    // Confirm nothing in console/page error logs
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Negative test / error observation: purposely validate that no ReferenceError/SyntaxError/TypeError occurred.
  // If any of those errors occur naturally, they will be captured and this test will fail (observing the error).
  test('Error Observation: assert no ReferenceError, SyntaxError, or TypeError occurred during page lifecycle', async ({ page }) => {
    const app = new BubbleSortPage(page);
    await app.goto();

    // Combine messages for inspection; ensure none indicate ReferenceError, SyntaxError, or TypeError
    const allConsoleMessages = consoleErrors.map(e => e.text).join(' | ');
    const allPageErrorMessages = pageErrors.map(e => e.message).join(' | ');

    // Assert none of the captured messages contain the runtime error keywords.
    expect(allConsoleMessages.includes('ReferenceError')).toBeFalsy();
    expect(allConsoleMessages.includes('SyntaxError')).toBeFalsy();
    expect(allConsoleMessages.includes('TypeError')).toBeFalsy();

    expect(allPageErrorMessages.includes('ReferenceError')).toBeFalsy();
    expect(allPageErrorMessages.includes('SyntaxError')).toBeFalsy();
    expect(allPageErrorMessages.includes('TypeError')).toBeFalsy();

    // Also assert that no errors were captured at all (preferred state)
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});