import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c967c00-fa78-11f0-857d-d58e82d5de73.html';

// Page Object Model for the Heap visualization page
class HeapPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  btn() {
    return this.page.locator('#btnHeapify');
  }

  nodeAt(index) {
    return this.page.locator(`.node.pos-${index}`);
  }

  // Returns an array of node text contents in order 0..6
  async getNodeValues() {
    const values = [];
    for (let i = 0; i < 7; i++) {
      values.push((await this.nodeAt(i).innerText()).trim());
    }
    return values;
  }

  async isRootMinroot() {
    return await this.nodeAt(0).evaluate((el) => el.classList.contains('minroot'));
  }

  async clickButton() {
    await this.btn().click();
  }

  async waitForButtonText(text, options = {}) {
    await this.page.waitForFunction(
      (selector, expected) => {
        const el = document.querySelector(selector);
        return el && el.textContent.trim() === expected;
      },
      ['#btnHeapify', text],
      options
    );
  }

  async getButtonAriaPressed() {
    return await this.btn().getAttribute('aria-pressed');
  }

  async isButtonDisabled() {
    return await this.btn().evaluate((b) => b.disabled === true);
  }

  async getButtonText() {
    return (await this.btn().innerText()).trim();
  }
}

// Expected arrays from the HTML/JS implementation
const UNORDERED_VALUES = ['20', '18', '15', '30', '25', '12', '8'];
const HEAP_VALUES = ['8', '12', '15', '20', '18', '25', '30'];

test.describe('Heap (Min) Visualization - FSM validation', () => {
  // We'll capture console messages and page errors to assert no unexpected runtime errors occur.
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // store the console message along with its type for assertions later
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // store uncaught exception from the page
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Assert that there were no uncaught page errors (pageerror events).
    // This asserts the runtime did not produce unexpected exceptions.
    expect(pageErrors.length, 'No uncaught page errors should have occurred').toBe(0);

    // Assert there are no console messages of type 'error' or containing common JS error keywords.
    const errorConsoleMessages = consoleMessages.filter(
      (m) =>
        m.type === 'error' ||
        /ReferenceError|SyntaxError|TypeError|Uncaught/i.test(m.text)
    );
    expect(
      errorConsoleMessages.length,
      `No console.error or JS runtime error messages expected but found: ${JSON.stringify(
        errorConsoleMessages,
        null,
        2
      )}`
    ).toBe(0);
  });

  test('Initial State (S0_Initial): resetValues() runs on load and sets unordered values', async ({ page }) => {
    // Comment: Validate that on page load resetValues() was invoked (effects visible in DOM)
    const heap = new HeapPage(page);
    await heap.goto();

    // Verify the button initial text and aria-pressed attribute
    await expect(heap.btn()).toBeVisible();
    expect(await heap.getButtonText()).toBe('Run Heapify animation');
    expect(await heap.getButtonAriaPressed()).toBe('false');
    expect(await heap.isButtonDisabled()).toBe(false);

    // Verify node values match the unorderedValues array (resetValues populates these)
    const nodeValues = await heap.getNodeValues();
    expect(nodeValues).toEqual(UNORDERED_VALUES);

    // The script's resetValues() removes the 'minroot' class from root; assert it's not present.
    expect(await heap.isRootMinroot()).toBe(false);

    // Also assert there were no immediate runtime errors or console.error entries (after navigation)
    // (Detailed checks run in afterEach)
  });

  test('Transition S0 -> S1 (HeapifyClick): clicking Run Heapify animation starts animation', async ({ page }) => {
    // This test validates click triggers animateHeapify(), which:
    // - sets aria-pressed="true"
    // - disables the button
    // - updates button text to "Heapifying..."
    // Then it runs the animation and eventually sets final heap values and "Reset to Unordered"
    const heap = new HeapPage(page);
    await heap.goto();

    // Click the button to start heapify animation
    await heap.clickButton();

    // Immediately after click, animateHeapify sets aria-pressed true, disables button and updates text
    // Assert these immediate side effects
    expect(await heap.getButtonAriaPressed()).toBe('true');
    expect(await heap.isButtonDisabled()).toBe(true);
    expect(await heap.getButtonText()).toBe('Heapifying...');

    // Edge case: clicking while animation is ongoing should not reset the heap (button is disabled).
    // We attempt a click and ensure it doesn't throw and that button state remains in heapifying.
    // Note: the button is disabled; Playwright click will still attempt to click but element.disabled prevents changes.
    await heap.clickButton(); // should be a no-op with respect to the application's state
    expect(await heap.getButtonText()).toBe('Heapifying...');
    expect(await heap.getButtonAriaPressed()).toBe('true');

    // Wait for the animation to complete: the script sets button text to "Reset to Unordered" at the end.
    // The animation runs several awaited timeouts; give ample timeout.
    await heap.waitForButtonText('Reset to Unordered', { timeout: 20000 });

    // After animation finalization, the nodes should show the heap values and root should have minroot class
    const nodeValuesAfter = await heap.getNodeValues();
    expect(nodeValuesAfter).toEqual(HEAP_VALUES);
    expect(await heap.isRootMinroot()).toBe(true);

    // The button should be enabled again and show "Reset to Unordered". aria-pressed remains 'true' per implementation.
    expect(await heap.getButtonText()).toBe('Reset to Unordered');
    expect(await heap.isButtonDisabled()).toBe(false);
    expect(await heap.getButtonAriaPressed()).toBe('true');
  }, 30000); // extended timeout for animation

  test('Transition S1 -> S0 (HeapifyClick on pressed): clicking Reset to Unordered triggers resetValues()', async ({ page }) => {
    // This test ensures that clicking the button when aria-pressed === 'true' runs resetValues()
    // and returns the UI to the initial (unordered) state.
    const heap = new HeapPage(page);
    await heap.goto();

    // Start the animation and wait until it finishes to get into S1.
    await heap.clickButton();
    await heap.waitForButtonText('Reset to Unordered', { timeout: 20000 });

    // Precondition: in heapified state
    expect(await heap.getButtonAriaPressed()).toBe('true');
    expect(await heap.getButtonText()).toBe('Reset to Unordered');
    expect(await heap.isRootMinroot()).toBe(true);

    // Click again to reset (the click handler checks aria-pressed and calls resetValues())
    await heap.clickButton();

    // After resetValues, button text should read "Run Heapify animation" and aria-pressed revert to 'false'
    await heap.waitForButtonText('Run Heapify animation', { timeout: 2000 });
    expect(await heap.getButtonAriaPressed()).toBe('false');
    expect(await heap.isButtonDisabled()).toBe(false);
    expect(await heap.getButtonText()).toBe('Run Heapify animation');

    // Node values should be back to unordered values
    const nodeValuesReset = await heap.getNodeValues();
    expect(nodeValuesReset).toEqual(UNORDERED_VALUES);

    // Root should not have the minroot class after reset
    expect(await heap.isRootMinroot()).toBe(false);
  }, 30000);

  test('Edge cases: rapid repeated clicks and behavior stability', async ({ page }) => {
    // Validate stability when user attempts rapid interactions:
    // 1) Rapidly click the button in initial state multiple times.
    // 2) Rapidly click while animation is ongoing.
    const heap = new HeapPage(page);
    await heap.goto();

    // Rapid clicks in initial state: the first click should start animation; subsequent clicks should not break things.
    await Promise.all([heap.btn().click(), heap.btn().click(), heap.btn().click()]);
    // Immediately we expect aria-pressed true and disabled true
    expect(await heap.getButtonAriaPressed()).toBe('true');
    expect(await heap.isButtonDisabled()).toBe(true);
    expect(await heap.getButtonText()).toBe('Heapifying...');

    // Attempt several clicks while animation is ongoing
    // These are "no-op" because the button is disabled; ensure they don't cause errors and state remains consistent.
    for (let i = 0; i < 5; i++) {
      await heap.btn().click().catch(() => {}); // swallow any Playwright click rejections
      expect(await heap.getButtonText()).toBe('Heapifying...');
      expect(await heap.getButtonAriaPressed()).toBe('true');
    }

    // Wait for animation to finish and verify end-state
    await heap.waitForButtonText('Reset to Unordered', { timeout: 20000 });
    expect(await heap.getButtonText()).toBe('Reset to Unordered');
    expect(await heap.isRootMinroot()).toBe(true);

    // Finally click to reset and verify we return to S0
    await heap.clickButton();
    await heap.waitForButtonText('Run Heapify animation', { timeout: 2000 });
    expect(await heap.getNodeValues()).toEqual(UNORDERED_VALUES);
  }, 30000);
});