import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cd97e0-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the Interactive Array page
class ArrayPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Inputs
    this.addInput = page.locator('#addElementInput');
    this.removeInput = page.locator('#removeElementInput');
    this.lengthInput = page.locator('#lengthInput');
    this.rangeStart = page.locator('#rangeStartInput');
    this.rangeEnd = page.locator('#rangeEndInput');
    // Buttons (using the onclick attribute selectors as in the implementation)
    this.addButton = page.locator("button[onclick='addElement()']");
    this.removeButton = page.locator("button[onclick='removeElement()']");
    this.clearButton = page.locator("button[onclick='clearArray()']");
    this.sortButton = page.locator("button[onclick='sortArray()']");
    this.reverseButton = page.locator("button[onclick='reverseArray()']");
    this.setLengthButton = page.locator("button[onclick='setArrayLength()']");
    this.addRangeButton = page.locator("button[onclick='addRange()']");
    // Display
    this.display = page.locator('#arrayDisplay');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Basic operations, mirroring the UI actions
  async addElement(value) {
    await this.addInput.fill(String(value));
    await this.addButton.click();
  }

  async removeElement(value) {
    await this.removeInput.fill(String(value));
    await this.removeButton.click();
  }

  async clearArray() {
    await this.clearButton.click();
  }

  async sortArray() {
    await this.sortButton.click();
  }

  async reverseArray() {
    await this.reverseButton.click();
  }

  async setArrayLength(length) {
    await this.lengthInput.fill(String(length));
    await this.setLengthButton.click();
  }

  async addRange(start, end) {
    await this.rangeStart.fill(String(start));
    await this.rangeEnd.fill(String(end));
    await this.addRangeButton.click();
  }

  async getDisplayText() {
    return (await this.display.innerText()).trim();
  }

  // Helpers to assert button onclick attributes (evidence from FSM)
  async getOnclickAttributeFor(selector) {
    const el = this.page.locator(selector);
    return await el.getAttribute('onclick');
  }
}

test.describe('Interactive Array Demonstration (Application ID: 99cd97e0-fa79-11f0-8075-e54a10595dde)', () => {
  // Collect console messages and page errors for each test so we can assert there are none
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test ensure there were no uncaught page errors or console errors.
    // The page implementation is expected to be stable; if errors happen they should be observed by tests,
    // but the default expectation is that no runtime errors occur.
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning').length;
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join('\n')}`).toBe(0);
    expect(consoleErrorCount, `Unexpected console errors/warnings: ${consoleMessages.filter(m => m.type === 'error' || m.type === 'warning').map(m => m.text).join('\n')}`).toBe(0);
  });

  test('Initial state (Idle): Display shows empty array and updateDisplay() entry action reflected', async ({ page }) => {
    // This test validates the FSM S0_Idle entry action updateDisplay() and initial DOM state.
    const app = new ArrayPage(page);
    await app.goto();

    // Verify the array display shows an empty array initially
    const displayText = await app.getDisplayText();
    expect(displayText).toBe('Array: []');

    // Verify UI components exist and match the evidence (onclick attributes)
    expect(await app.getOnclickAttributeFor("button[onclick='addElement()']")).toBe('addElement()');
    expect(await app.getOnclickAttributeFor("button[onclick='removeElement()']")).toBe('removeElement()');
    expect(await app.getOnclickAttributeFor("button[onclick='clearArray()']")).toBe('clearArray()');
    expect(await app.getOnclickAttributeFor("button[onclick='sortArray()']")).toBe('sortArray()');
    expect(await app.getOnclickAttributeFor("button[onclick='reverseArray()']")).toBe('reverseArray()');
    expect(await app.getOnclickAttributeFor("button[onclick='setArrayLength()']")).toBe('setArrayLength()');
    expect(await app.getOnclickAttributeFor("button[onclick='addRange()']")).toBe('addRange()');
  });

  test('AddElement transition: adding single and multiple elements updates display and clears input', async ({ page }) => {
    // Validates AddElement event/transition and updateDisplay observable.
    const app = new ArrayPage(page);
    await app.goto();

    // Add "apple"
    await app.addElement('apple');
    expect(await app.getDisplayText()).toBe('Array: [apple]');

    // The add input should be cleared by the implementation after adding
    expect(await app.addInput.inputValue()).toBe('');

    // Add two more elements
    await app.addElement('banana');
    await app.addElement('10'); // string '10'
    expect(await app.getDisplayText()).toBe('Array: [apple, banana, 10]');
  });

  test('RemoveElement transition: removing existing and non-existing elements behaves correctly', async ({ page }) => {
    // Validates RemoveElement event/transition and updateDisplay observable.
    const app = new ArrayPage(page);
    await app.goto();

    // Setup: add elements
    await app.addElement('one');
    await app.addElement('two');
    await app.addElement('three');
    expect(await app.getDisplayText()).toBe('Array: [one, two, three]');

    // Remove middle element "two"
    await app.removeElement('two');
    expect(await app.getDisplayText()).toBe('Array: [one, three]');

    // The remove input should be cleared by the implementation after a successful removal
    expect(await app.removeInput.inputValue()).toBe('');

    // Attempt to remove a non-existent element - array should remain unchanged
    await app.removeElement('does-not-exist');
    expect(await app.getDisplayText()).toBe('Array: [one, three]');
  });

  test('ClearArray transition: clears array display', async ({ page }) => {
    // Validates ClearArray event/transition and updateDisplay observable.
    const app = new ArrayPage(page);
    await app.goto();

    // Setup: add elements
    await app.addElement('x');
    await app.addElement('y');
    expect(await app.getDisplayText()).toBe('Array: [x, y]');

    // Clear
    await app.clearArray();
    expect(await app.getDisplayText()).toBe('Array: []');
  });

  test('SortArray & ReverseArray transitions: sorting and reversing update display correctly', async ({ page }) => {
    // Validates SortArray and ReverseArray transitions and their expected observables.
    const app = new ArrayPage(page);
    await app.goto();

    // Ensure deterministic sorting with simple strings
    await app.clearArray();
    await app.addElement('b');
    await app.addElement('a');
    await app.addElement('c');
    expect(await app.getDisplayText()).toBe('Array: [b, a, c]');

    // Sort -> should be alphabetic since elements are strings
    await app.sortArray();
    expect(await app.getDisplayText()).toBe('Array: [a, b, c]');

    // Reverse -> should reverse the order
    await app.reverseArray();
    expect(await app.getDisplayText()).toBe('Array: [c, b, a]');
  });

  test('SetLength transition: truncates or extends (with undefined) correctly and ignores negative lengths', async ({ page }) => {
    // Validates SetLength event/transition and edge cases around length setting.
    const app = new ArrayPage(page);
    await app.goto();

    // Start fresh
    await app.clearArray();

    // Add three elements
    await app.addElement('first');
    await app.addElement('second');
    await app.addElement('third');
    expect(await app.getDisplayText()).toBe('Array: [first, second, third]');

    // Truncate to length 1 -> only 'first' should remain
    await app.setArrayLength(1);
    expect(await app.getDisplayText()).toBe('Array: [first]');

    // Extend length to 3 -> new entries will be empty slots, but display uses array.join(', ')
    // In the implementation, setting length larger creates holes; join will render extra commas.
    await app.setArrayLength(3);
    // The expected display after extending: 'first, ,' -> join of ['first', <1 empty slot>, <1 empty slot>] results in 'first, , '
    // However join on sparse arrays leaves empty strings for empty slots, producing 'first, , '
    const displayAfterExtend = await app.getDisplayText();
    // Validate that it begins with Array: [first and contains commas indicating extended slots.
    expect(displayAfterExtend.startsWith('Array: [first')).toBe(true);
    expect(displayAfterExtend.includes(',')).toBe(true);

    // Attempt to set negative length -> should be ignored by implementation (length must be >= 0)
    await app.setArrayLength(-5);
    // Display should remain unchanged from previous valid state
    expect(await app.getDisplayText()).toBe(displayAfterExtend);
  });

  test('AddRange transition: adds numeric range inclusive and ignores invalid ranges', async ({ page }) => {
    // Validates AddRange event/transition with both valid and invalid inputs.
    const app = new ArrayPage(page);
    await app.goto();

    // Clear and add range 5..7
    await app.clearArray();
    await app.addRange(5, 7);
    expect(await app.getDisplayText()).toBe('Array: [5, 6, 7]');

    // Add another range smaller than existing -> append
    await app.addRange(1, 2);
    expect(await app.getDisplayText()).toBe('Array: [5, 6, 7, 1, 2]');

    // Edge case: start >= end -> should do nothing per implementation condition (start < end)
    const before = await app.getDisplayText();
    await app.addRange(10, 5); // invalid
    expect(await app.getDisplayText()).toBe(before);

    // Edge case: non-numeric inputs -> fill with blank values in inputs triggers parseInt -> NaN -> ignored
    const before2 = await app.getDisplayText();
    await app.rangeStart.fill('abc');
    await app.rangeEnd.fill('def');
    await app.addRangeButton.click();
    expect(await app.getDisplayText()).toBe(before2);
  });

  test('Integration: sequence of operations maintains consistent state (Add, AddRange, Sort, Reverse, Remove, Clear)', async ({ page }) => {
    // Validates that a realistic sequence of actions results in the expected final display.
    const app = new ArrayPage(page);
    await app.goto();

    // Start clear
    await app.clearArray();

    // Add string elements
    await app.addElement('z');
    await app.addElement('m');
    // Add numeric range
    await app.addRange(1, 3); // adds numbers 1,2,3
    // Current expected: [z, m, 1, 2, 3]
    expect(await app.getDisplayText()).toBe('Array: [z, m, 1, 2, 3]');

    // Sort -> will perform lexicographic sort mixing strings and numbers -> ensure stable and deterministic expectation:
    await app.sortArray();
    // Determine expected sort result: lexicographic as strings: '1', '2', '3', 'm', 'z'
    expect(await app.getDisplayText()).toBe('Array: [1, 2, 3, m, z]');

    // Reverse
    await app.reverseArray();
    expect(await app.getDisplayText()).toBe('Array: [z, m, 3, 2, 1]');

    // Remove an element that exists (m)
    await app.removeElement('m');
    expect(await app.getDisplayText()).toBe('Array: [z, 3, 2, 1]');

    // Clear at end
    await app.clearArray();
    expect(await app.getDisplayText()).toBe('Array: []');
  });

  test('UI Evidence assertions: buttons and inputs exist and have expected attributes (evidence checks)', async ({ page }) => {
    // This test explicitly checks the extracted evidence from the FSM: inputs, placeholders, and onclick attributes.
    const app = new ArrayPage(page);
    await app.goto();

    // Check placeholder texts (evidence of detected components)
    await expect(app.addInput).toHaveAttribute('placeholder', 'Value to add');
    await expect(app.removeInput).toHaveAttribute('placeholder', 'Value to remove');
    await expect(app.lengthInput).toHaveAttribute('placeholder', 'New Length');
    await expect(app.rangeStart).toHaveAttribute('placeholder', 'Start');
    await expect(app.rangeEnd).toHaveAttribute('placeholder', 'End');

    // Onclick evidence (already asserted in initial test, but double-check here)
    expect(await app.getOnclickAttributeFor("button[onclick='addElement()']")).toBe('addElement()');
    expect(await app.getOnclickAttributeFor("button[onclick='removeElement()']")).toBe('removeElement()');
    expect(await app.getOnclickAttributeFor("button[onclick='clearArray()']")).toBe('clearArray()');
    expect(await app.getOnclickAttributeFor("button[onclick='sortArray()']")).toBe('sortArray()');
    expect(await app.getOnclickAttributeFor("button[onclick='reverseArray()']")).toBe('reverseArray()');
    expect(await app.getOnclickAttributeFor("button[onclick='setArrayLength()']")).toBe('setArrayLength()');
    expect(await app.getOnclickAttributeFor("button[onclick='addRange()']")).toBe('addRange()');

    // Final sanity: display exists and is visible
    await expect(app.display).toBeVisible();
  });
});