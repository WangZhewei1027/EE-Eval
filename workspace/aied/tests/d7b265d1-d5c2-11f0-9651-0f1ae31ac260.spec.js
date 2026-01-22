import { test, expect } from '@playwright/test';

// URL serving the HTML under test
const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b265d1-d5c2-11f0-9651-0f1ae31ac260.html';

/**
 * Page Object representing the Deque demo page.
 * Encapsulates common interactions and queries.
 */
class DequePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.dequeContainer = page.locator('#deque');
    this.pushFrontInput = page.locator('#pushFrontInput');
    this.pushFrontBtn = page.locator('#pushFrontBtn');
    this.pushBackInput = page.locator('#pushBackInput');
    this.pushBackBtn = page.locator('#pushBackBtn');
    this.popFrontBtn = page.locator('#popFrontBtn');
    this.popBackBtn = page.locator('#popBackBtn');
    this.peekFrontBtn = page.locator('#peekFrontBtn');
    this.peekBackBtn = page.locator('#peekBackBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.status = page.locator('#status');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for initial render to complete: the deque container should be visible
    await expect(this.dequeContainer).toBeVisible();
  }

  async pushFront(value) {
    await this.pushFrontInput.fill(value);
    await this.pushFrontBtn.click();
  }

  async pushBack(value) {
    await this.pushBackInput.fill(value);
    await this.pushBackBtn.click();
  }

  async popFront() {
    await this.popFrontBtn.click();
  }

  async popBack() {
    await this.popBackBtn.click();
  }

  async peekFront() {
    await this.peekFrontBtn.click();
  }

  async peekBack() {
    await this.peekBackBtn.click();
  }

  async clear() {
    await this.clearBtn.click();
  }

  async pressEnterInPushFront() {
    await this.pushFrontInput.press('Enter');
  }

  async pressEnterInPushBack() {
    await this.pushBackInput.press('Enter');
  }

  // Returns array of text contents for .deque-element
  async dequeElementsText() {
    const elems = this.dequeContainer.locator('.deque-element');
    const count = await elems.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push(await elems.nth(i).textContent());
    }
    return texts;
  }

  async hasEmptyPlaceholderText() {
    const text = await this.dequeContainer.textContent();
    return text && text.trim() === '(empty)';
  }

  async arePopAndPeekDisabled() {
    const popFrontDisabled = await this.popFrontBtn.isDisabled();
    const popBackDisabled = await this.popBackBtn.isDisabled();
    const peekFrontDisabled = await this.peekFrontBtn.isDisabled();
    const peekBackDisabled = await this.peekBackBtn.isDisabled();
    return popFrontDisabled && popBackDisabled && peekFrontDisabled && peekBackDisabled;
  }

  async statusText() {
    return (await this.status.textContent()) || '';
  }
}

test.describe('Deque Demonstration - FSM states and transitions', () => {
  // Collect console errors and page errors to observe runtime issues.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console 'error' messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Collect unhandled exceptions from the page
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });
  });

  test('S0_Empty initial state - Empty Deque is rendered and controls disabled', async ({ page }) => {
    // Validate initial state (S0_Empty: renderDeque entry action)
    const d = new DequePage(page);
    await d.goto();

    // The deque should display the "(empty)" placeholder after initial render
    expect(await d.hasEmptyPlaceholderText()).toBe(true);

    // There should be no deque-element children initially
    expect((await d.dequeElementsText()).length).toBe(0);

    // Pop and peek buttons should be disabled in the empty state
    expect(await d.arePopAndPeekDisabled()).toBe(true);

    // Status should be initially empty (or whitespace) - ensure nothing confusing
    const status = await d.statusText();
    expect(status.trim()).toBe('');

    // Assert there were no runtime errors during load
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Transition: PushFront from Empty -> NonEmpty (S0 -> S1)', async ({ page }) => {
    // This test validates pushing a value to the front transitions to Non-Empty state
    const d = new DequePage(page);
    await d.goto();

    // Try pushing an empty value (edge case) - should be rejected with status message
    await d.pushFront(''); // clicking without content
    await expect(d.status).toHaveText('Please enter a value to push to the front.');

    // Now push a valid value to front
    await d.pushFront('A');
    // Status should indicate push to front
    await expect(d.status).toHaveText('Pushed "A" to front.');

    // Deque should now contain a single element 'A'
    const elems = await d.dequeElementsText();
    expect(elems).toEqual(['A']);

    // Pop and peek buttons should be enabled now (Non-Empty)
    expect(await d.arePopAndPeekDisabled()).toBe(false);

    // Input should be cleared after push
    expect(await d.pushFrontInput.inputValue()).toBe('');

    // Assert there were no runtime errors during this interaction
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Transition: PushBack from Empty -> NonEmpty (S0 -> S1) and via Enter key', async ({ page }) => {
    // Validate push to back adds elements and Enter key triggers push
    const d = new DequePage(page);
    await d.goto();

    // Edge: clicking Add with empty back input shows message
    await d.pushBack(''); // click with empty content
    await expect(d.status).toHaveText('Please enter a value to push to the back.');

    // Use Enter key to add an element to back
    await d.pushBackInput.fill('X');
    await d.pressEnterInPushBack();
    await expect(d.status).toHaveText('Pushed "X" to back.');

    // Confirm element present and content matches
    expect(await d.dequeElementsText()).toEqual(['X']);

    // Add another to the back
    await d.pushBack('Y');
    expect(await d.dequeElementsText()).toEqual(['X', 'Y']);

    // No runtime errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('PeekFront and PeekBack on Non-Empty (S1_NonEmpty remains S1_NonEmpty)', async ({ page }) => {
    // Validate peek operations do not change deque contents but update status
    const d = new DequePage(page);
    await d.goto();

    // Prepare deque with known contents
    await d.pushBack('first');
    await d.pushBack('second');

    // Peek front -> should report "first" and not remove items
    await d.peekFront();
    await expect(d.status).toHaveText('Peek front: "first"');
    expect(await d.dequeElementsText()).toEqual(['first', 'second']);

    // Peek back -> should report "second" and not remove items
    await d.peekBack();
    await expect(d.status).toHaveText('Peek back: "second"');
    expect(await d.dequeElementsText()).toEqual(['first', 'second']);

    // Controls stay enabled as deque is non-empty
    expect(await d.arePopAndPeekDisabled()).toBe(false);

    // No runtime errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('PopFront and PopBack transitions and emptying behavior (S1_NonEmpty -> S1_NonEmpty or S0_Empty)', async ({ page }) => {
    // Validate popping from front/back removes elements and updates status; test edge-case pop when empty
    const d = new DequePage(page);
    await d.goto();

    // Start with two elements
    await d.pushBack('one');
    await d.pushBack('two');
    expect(await d.dequeElementsText()).toEqual(['one', 'two']);

    // Pop front: should remove 'one'
    await d.popFront();
    await expect(d.status).toHaveText('Popped "one" from front.');
    expect(await d.dequeElementsText()).toEqual(['two']);
    expect(await d.arePopAndPeekDisabled()).toBe(false);

    // Pop back: should remove 'two' and become empty
    await d.popBack();
    await expect(d.status).toHaveText('Popped "two" from back.');
    expect(await d.hasEmptyPlaceholderText()).toBe(true);
    expect(await d.arePopAndPeekDisabled()).toBe(true);

    // Attempt to pop when empty -> status shows error and nothing breaks
    await d.popFront();
    await expect(d.status).toHaveText('Deque is empty. Cannot pop from front.');
    // Also try popBack on empty
    await d.popBack();
    await expect(d.status).toHaveText('Deque is empty. Cannot pop from back.');

    // No runtime errors during pops
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Clear transition from Non-Empty to Empty (S1_NonEmpty -> S0_Empty)', async ({ page }) => {
    // Validate clear empties the deque and updates status
    const d = new DequePage(page);
    await d.goto();

    // Add elements
    await d.pushFront('alpha');
    await d.pushBack('beta');
    expect(await d.dequeElementsText()).toEqual(['alpha', 'beta']);

    // Clear deque
    await d.clear();
    // Status should indicate cleared and deque shows empty placeholder
    await expect(d.status).toHaveText('Deque cleared.');
    expect(await d.hasEmptyPlaceholderText()).toBe(true);

    // Pop and peek buttons should be disabled
    expect(await d.arePopAndPeekDisabled()).toBe(true);

    // No runtime errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Edge cases: long inputs, maxlength enforcement and focus behavior', async ({ page }) => {
    // Verify input maxlength attribute prevents over-length values from being typed
    const d = new DequePage(page);
    await d.goto();

    // maxlength is 10 - type a longer string and ensure it is truncated by the input element
    const long = '0123456789ABCDEF'; // longer than 10
    await d.pushFrontInput.fill(long);
    const valueInInput = await d.pushFrontInput.inputValue();
    expect(valueInInput.length).toBeLessThanOrEqual(10);

    // After pushing, input should be cleared and focus returned to that input
    await d.pushFrontInput.fill('Z');
    await d.pushFrontBtn.click();
    await expect(d.status).toHaveText('Pushed "Z" to front.');
    expect(await d.pushFrontInput.inputValue()).toBe('');
    // Check focus: the active element should be the pushFrontInput
    const activeId = await page.evaluate(() => document.activeElement && document.activeElement.id);
    expect(activeId).toBe('pushFrontInput');

    // No runtime errors from typing long strings or focusing
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test.afterEach(async ({ page }) => {
    // Final check in teardown to ensure no uncaught runtime errors were produced at any point in the test.
    // This records any console errors or page errors that may have been emitted.
    // We assert empty arrays to ensure the app runs cleanly in the browser environment.
    // Note: Tests above also assert these conditions at their own completion points.
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});