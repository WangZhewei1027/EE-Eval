import { test, expect } from '@playwright/test';

// URL to the application under test (served as specified)
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8c4310-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object for the Dynamic Array Showcase
class DynamicArrayPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.addButton = page.locator('#addElementBtn');
    this.dynamicArray = page.locator('#dynamicArray');
    this.elements = () => this.dynamicArray.locator('.element');
  }

  // Navigate to the app
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Click the Add Element button once
  async addElement() {
    await this.addButton.click();
  }

  // Click the Add Element button n times
  async addElements(n) {
    for (let i = 0; i < n; i++) {
      await this.addButton.click();
    }
  }

  // Get number of elements rendered inside dynamic array
  async elementCount() {
    return await this.elements().count();
  }

  // Get text contents of all elements as array of strings
  async getElementTexts() {
    const count = await this.elementCount();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push(await this.elements().nth(i).textContent());
    }
    return texts;
  }

  // Check whether add button is visible & enabled
  async isAddButtonVisible() {
    return await this.addButton.isVisible();
  }
}

test.describe('Dynamic Array Showcase - FSM validation and UI behavior', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // initialize collectors
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.describe('Initial state (S0_Idle) checks', () => {
    test('Initial DOM: Add button exists and dynamic array is empty', async ({ page }) => {
      // This test validates the Idle state (S0_Idle) from the FSM:
      // - The Add Element button should be present
      // - The dynamic array container should exist and be empty initially
      const app = new DynamicArrayPage(page);
      await app.goto();

      // Assert the Add Element button is visible
      expect(await app.isAddButtonVisible()).toBe(true);

      // Assert dynamic array container exists and initially has zero .element children
      const initialCount = await app.elementCount();
      expect(initialCount).toBe(0);

      // Make sure there were no runtime errors captured during initial load
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transitions and user-driven behavior (S0 -> S1)', () => {
    test('Clicking Add Element appends a new element with correct class and text', async ({ page }) => {
      // This test validates the transition AddElementClick and S1_ElementAdded:
      // - After one click: count increments to 1, a new .element is appended, and its textContent is "1".
      const app = new DynamicArrayPage(page);
      await app.goto();

      // Precondition: no elements
      expect(await app.elementCount()).toBe(0);

      // Trigger transition: click the add button
      await app.addElement();

      // After transition: exactly one element added
      expect(await app.elementCount()).toBe(1);

      // New element should have class 'element' and text content '1'
      const texts = await app.getElementTexts();
      expect(texts).toEqual(['1']);

      // Sanity: ensure the rendered element has the expected class attribute
      const first = app.elements().nth(0);
      await expect(first).toHaveClass(/(^|\s)element(\s|$)/);

      // Check no console errors or page errors occurred during this interaction
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Multiple clicks append elements with increasing numeric labels and preserve order', async ({ page }) => {
      // This test validates repeated transitions from S0 -> S1 and the expected observable:
      // - Clicking 5 times produces elements labeled 1..5 in order
      const app = new DynamicArrayPage(page);
      await app.goto();

      await app.addElements(5);

      // Expect 5 elements
      expect(await app.elementCount()).toBe(5);

      // Expect texts to be ['1','2','3','4','5']
      const texts = await app.getElementTexts();
      expect(texts).toEqual(['1', '2', '3', '4', '5']);

      // No console or page errors during multi-click scenario
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases, limits, and error scenarios', () => {
    test('Clicking more than the maximum allowed (10) does not create extra elements', async ({ page }) => {
      // This test validates the FSM guard (if present in the implementation):
      // - The page script uses if (count < 10) { ... } so after 10 clicks, further clicks should not increase elements.
      const app = new DynamicArrayPage(page);
      await app.goto();

      // Click 12 times (2 beyond the allowed 10)
      await app.addElements(12);

      // Only 10 elements should exist
      expect(await app.elementCount()).toBe(10);

      // The last element should have text '10'
      const texts = await app.getElementTexts();
      expect(texts[texts.length - 1]).toBe('10');

      // Verify all elements are labelled sequentially 1..10
      const expected = Array.from({ length: 10 }, (_, i) => String(i + 1));
      expect(texts).toEqual(expected);

      // Confirm no runtime exceptions occurred (pageerror) while trying to exceed limit
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Rapid clicking does not throw and maintains element count cap', async ({ page }) => {
      // This test validates stability under rapid user interactions:
      // - Simulate rapid clicks and ensure the app remains stable and respects the maximum.
      const app = new DynamicArrayPage(page);
      await app.goto();

      // Rapidly click 20 times using Promise.all to simulate quick interactions
      // Note: This still uses the same click API but in quick succession
      for (let i = 0; i < 20; i++) {
        // fire and forget pattern but await small delay to avoid overwhelming single-threaded environment
        await app.addButton.click();
      }

      // Cap should still be 10
      expect(await app.elementCount()).toBe(10);

      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Console and runtime error observation', () => {
    test('No ReferenceError, SyntaxError, or TypeError are emitted during normal usage', async ({ page }) => {
      // This test attaches to console and pageerror (done in beforeEach) and asserts
      // that no ReferenceError, SyntaxError, or TypeError occurred during normal flows.
      const app = new DynamicArrayPage(page);
      await app.goto();

      // Perform some interactions to exercise code paths
      await app.addElements(3);
      await app.addElements(2);

      // Inspect collected console messages and page errors
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      // Fail if any console error messages look like JS exceptions
      const foundExceptionInConsole = errorConsoleMessages.some(m =>
        /ReferenceError|TypeError|SyntaxError|Uncaught/i.test(m.text)
      );

      // Inspect pageErrors for Error instances and messages
      const foundPageErrors = pageErrors.some(err =>
        /ReferenceError|TypeError|SyntaxError|Uncaught/i.test(String(err && err.message))
      );

      // Assert that none of the targeted runtime errors occurred
      expect(foundExceptionInConsole).toBe(false);
      expect(foundPageErrors).toBe(false);

      // Also assert there are no console error messages at all
      expect(errorConsoleMessages.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Capture and report any unexpected page errors (test will fail if any are present)', async ({ page }) => {
      // This test is intentionally defensive: it will fail if any uncaught page errors were emitted.
      // It ensures our observability is working and surfaces errors if the page has runtime issues.
      const app = new DynamicArrayPage(page);
      await app.goto();

      // Interact a bit to ensure any latent errors surface
      await app.addElements(1);

      // If there are page errors, include them in the failure message for easier debugging
      if (pageErrors.length > 0) {
        const joined = pageErrors.map(e => String(e && e.stack ? e.stack : e)).join('\n\n---\n\n');
        throw new Error(`Unexpected page errors detected:\n\n${joined}`);
      }

      // If any console error messages exist, fail and show them
      const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
      if (consoleErrorMessages.length > 0) {
        throw new Error(`Unexpected console error messages:\n\n${consoleErrorMessages.join('\n')}`);
      }

      // Otherwise, pass - no errors observed
      expect(pageErrors.length).toBe(0);
      expect(consoleErrorMessages.length).toBe(0);
    });
  });
});