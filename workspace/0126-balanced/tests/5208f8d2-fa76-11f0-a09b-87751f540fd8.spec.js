import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/5208f8d2-fa76-11f0-a09b-87751f540fd8.html';

// Page Object for the Linear Search page
class LinearSearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.numElementsSelector = '#numElements';
    this.searchButtonSelector = 'button[onclick="searchLinear()"]';
    this.resultSelector = '#result';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getNumElementsValue() {
    return await this.page.$eval(this.numElementsSelector, el => el.value);
  }

  async setNumElementsValue(val) {
    await this.page.fill(this.numElementsSelector, String(val));
  }

  async clickSearch() {
    await this.page.click(this.searchButtonSelector);
  }

  async getResultText() {
    return await this.page.$eval(this.resultSelector, el => el.innerHTML);
  }

  // Create the missing input elements that the page's script expects: #numElement1 .. #numElementN
  // This method manipulates the DOM to add those inputs (without changing any script functions).
  // Note: Used only to validate FSM transitions for scenarios where the original page lacks these inputs.
  async createNumElementInputs(count, values = []) {
    await this.page.evaluate(({ count, values }) => {
      const container = document.createElement('div');
      container.id = 'test-num-elements-wrapper';
      for (let i = 0; i < count; i++) {
        const input = document.createElement('input');
        input.type = 'number';
        input.id = `numElement${i + 1}`;
        // Use provided value for that element, or default to ''
        input.value = values[i] !== undefined ? String(values[i]) : '';
        container.appendChild(input);
      }
      document.body.appendChild(container);
    }, { count, values });
  }

  // Remove any test-inserted inputs to reset page between tests
  async removeTestNumElementInputs() {
    await this.page.evaluate(() => {
      const wrapper = document.getElementById('test-num-elements-wrapper');
      if (wrapper) wrapper.remove();
    });
  }
}

test.describe('Linear Search FSM tests - 5208f8d2-fa76-11f0-a09b-87751f540fd8', () => {
  test.beforeEach(async ({ page }) => {
    // Silence console logging in Playwright output unless explicitly asserted
    page.on('console', msg => {
      // no-op; tests may attach their own handlers as needed
    });
  });

  test.describe('S0_Idle (Initial state) validations', () => {
    test('Initial render shows expected input, button and empty result (S0_Idle)', async ({ page }) => {
      // This test validates the Idle state: the page renders the input for number of elements,
      // the Search button is present, and the result container is initially empty.
      const app = new LinearSearchPage(page);
      await app.goto();

      // Basic DOM elements exist
      const numExists = await page.$('#numElements');
      expect(numExists).not.toBeNull();

      const searchButton = await page.$('button[onclick="searchLinear()"]');
      expect(searchButton).not.toBeNull();

      // Default value must be "5" as per the HTML
      const numVal = await app.getNumElementsValue();
      expect(numVal).toBe('5');

      // Result should be empty initially
      const resultText = await app.getResultText();
      expect(resultText).toBe('');

      // Verify that renderPage (mentioned in FSM entry_actions) is NOT present on window.
      // The FSM suggested renderPage() as an entry action; the page does not define it.
      const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
      expect(hasRenderPage).toBe(false);
    });
  });

  test.describe('S1_Searching (active) - event handling and error observation', () => {
    test('Clicking Search on the unmodified page triggers a runtime error due to missing inputs (expect TypeError/pageerror)', async ({ page }) => {
      // This test intentionally loads the page exactly as provided (without creating the expected
      // numElementN inputs). It clicks the Search button and asserts that a pageerror (runtime error)
      // is emitted because the script attempts to access .value of null elements.
      const app = new LinearSearchPage(page);
      await app.goto();

      // Prepare to observe a pageerror event that should naturally occur when the script runs.
      const [pageError] = await Promise.all([
        // Wait for a pageerror event caused by the TypeError in the existing script.
        page.waitForEvent('pageerror', { timeout: 3000 }),
        // Initiate the search which will execute the existing searchLinear() and cause an error
        app.clickSearch()
      ]);

      // We expect an Error object for the pageerror; assert general characteristics.
      expect(pageError).toBeDefined();
      // The browser-specific error message may vary, but it should indicate an inability to read 'value'
      // or reference to null. Check for keywords to ensure it's the expected runtime issue.
      const msg = String(pageError.message || pageError);
      const lowered = msg.toLowerCase();
      // Ensure message indicates a null/undefined property access related to numElement
      expect(lowered).toMatch(/(numelement|cannot read|cannot access|reading|null|undefined)/);
    });

    test('Clicking Search also logs a console error (observable via console event)', async ({ page }) => {
      // Additional assertion: a console.error or pageerror is emitted and is capturable via console events.
      const app = new LinearSearchPage(page);
      await app.goto();

      const consoleMessages = [];
      page.on('console', msg => {
        // Capture console messages for assertion
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });

      // Also capture pageerror to ensure it happens
      const [pageError] = await Promise.all([
        page.waitForEvent('pageerror', { timeout: 3000 }),
        app.clickSearch()
      ]);

      expect(pageError).toBeDefined();
      // Give a short pause to allow any console messages to arrive
      await page.waitForTimeout(200);

      // There should be at least one console message (error) related to the runtime error or call stack.
      const hasConsoleErrorLike = consoleMessages.some(m => /error|uncaught|numelement|cannot read|null|undefined/i.test(m.text));
      expect(hasConsoleErrorLike).toBe(true);
    });
  });

  test.describe('Final states (S2_ResultFound, S3_ResultNotFound) - exercising transitions when expected DOM exists', () => {
    test('Transition to S2_ResultFound when an element matches its index (create inputs to satisfy script expectations)', async ({ page }) => {
      // The original page lacks the inputs named numElement1..N. To validate the FSM path that leads
      // to "Result Found", we create those inputs (without changing any scripts or functions),
      // set their values so that num === i + 1 happens, and click Search to observe the result DOM change.
      const app = new LinearSearchPage(page);
      await app.goto();

      // Set a smaller number of elements to keep test deterministic
      await app.setNumElementsValue(3);

      // Create the missing inputs and set values so the first item matches i+1 -> should find immediately
      await app.createNumElementInputs(3, [1, 99, 99]);

      // Ensure no pageerror occurs; wait for any to surface but treat as failure if one occurs
      let pageError = null;
      const errorListener = e => { pageError = e; };
      page.on('pageerror', errorListener);

      await app.clickSearch();

      // Allow a little time for the script to complete and update DOM
      await page.waitForTimeout(200);

      // Remove listener
      page.off('pageerror', errorListener);

      // There should be no page error in this scenario because the required inputs were provided
      expect(pageError).toBeNull();

      const resultText = await app.getResultText();
      // Expect the message format: Found {num} at position {i + 1}
      expect(resultText).toBe('Found 1 at position 1');

      // Cleanup added DOM
      await app.removeTestNumElementInputs();
    });

    test('Transition to S3_ResultNotFound when no elements match (create inputs that do not match)', async ({ page }) => {
      // Create numElement inputs whose values do not satisfy the guard num === i + 1,
      // provoking the "Not found" final state.
      const app = new LinearSearchPage(page);
      await app.goto();

      await app.setNumElementsValue(4);

      // Create 4 inputs with values that do NOT equal their 1-based indices
      await app.createNumElementInputs(4, [10, 10, 10, 10]);

      let pageError = null;
      const errorListener = e => { pageError = e; };
      page.on('pageerror', errorListener);

      await app.clickSearch();
      await page.waitForTimeout(200);

      page.off('pageerror', errorListener);

      // No runtime error expected because inputs exist
      expect(pageError).toBeNull();

      const resultText = await app.getResultText();
      expect(resultText).toBe('Not found');

      // Cleanup
      await app.removeTestNumElementInputs();
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('Edge case: setting numElements to 1 and providing a matching input triggers Found', async ({ page }) => {
      // Validate minimal count behavior: with 1 element, if that element equals 1, Found should be reported.
      const app = new LinearSearchPage(page);
      await app.goto();

      await app.setNumElementsValue(1);
      await app.createNumElementInputs(1, [1]);

      const [maybeErr] = await Promise.all([
        // If a runtime error occurs, it will be captured here; otherwise null
        page.waitForEvent('pageerror', { timeout: 500 }).catch(() => null),
        app.clickSearch()
      ]);

      // There should be no error when correct inputs exist
      expect(maybeErr).toBeNull();

      const resultText = await app.getResultText();
      expect(resultText).toBe('Found 1 at position 1');

      await app.removeTestNumElementInputs();
    });

    test('Edge case: extremely large numElements value leads to loop behavior (but still raises error on missing inputs)', async ({ page }) => {
      // Test a scenario with a large number in numElements on the unmodified page: the original script
      // will attempt to access many non-existent inputs and should throw quickly on the first access.
      const app = new LinearSearchPage(page);
      await app.goto();

      // Set a large number
      await app.setNumElementsValue(1000);

      // Expect a pageerror when clicking since inputs are missing; capture it
      const [pageError] = await Promise.all([
        page.waitForEvent('pageerror', { timeout: 3000 }),
        app.clickSearch()
      ]);

      expect(pageError).toBeDefined();
      const msg = String(pageError.message || pageError).toLowerCase();
      expect(msg).toMatch(/(numelement|cannot read|null|undefined)/);
    });
  });
});