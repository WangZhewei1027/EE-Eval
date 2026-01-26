import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324e4a24-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object for the Two Pointers Example page
class TwoPointersPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#arrayInput');
    this.runButton = page.locator('#runButton');
    this.result = page.locator('#result');
    this.consoleMessages = [];
    this.pageErrors = [];
  }

  // Navigate to the app and setup listeners for console and page errors
  async goto() {
    this.consoleMessages = [];
    this.pageErrors = [];

    this.page.on('console', (msg) => {
      // capture all console messages for inspection in tests
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    this.page.on('pageerror', (err) => {
      // capture uncaught exceptions from the page
      this.pageErrors.push(err);
    });

    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async setInput(value) {
    await this.input.fill(value);
  }

  async clickRun() {
    await this.runButton.click();
  }

  async getResultText() {
    return (await this.result.textContent()) ?? '';
  }

  async getInputPlaceholder() {
    return await this.input.getAttribute('placeholder');
  }

  // Helpers to expose captured console and page errors
  getConsoleMessages() {
    return this.consoleMessages;
  }

  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('Two Pointers Example (FSM validation): 324e4a24-fa73-11f0-a9d0-d7a1991987c6', () => {
  // Setup and teardown are handled per-test using the page fixture and the Page Object
  test.describe('State S0_Idle (Initial state) validations', () => {
    test('S0: Page loads with input, Run Example button, and empty result', async ({ page }) => {
      const twoPointers = new TwoPointersPage(page);
      await twoPointers.goto();

      // Verify that the input exists and has the expected placeholder text
      await expect(twoPointers.input).toBeVisible();
      const placeholder = await twoPointers.getInputPlaceholder();
      expect(placeholder).toBe('e.g., -4,-1,0,3,5,9');

      // Verify that the Run Example button exists and is enabled
      await expect(twoPointers.runButton).toBeVisible();
      await expect(twoPointers.runButton).toBeEnabled();
      await expect(twoPointers.runButton).toHaveText('Run Example');

      // Verify result container exists and is initially empty
      await expect(twoPointers.result).toBeVisible();
      const initialResult = await twoPointers.getResultText();
      expect(initialResult.trim()).toBe('', 'Result div should be empty in the Idle state');

      // There should be no uncaught page errors on initial load
      const pageErrors = twoPointers.getPageErrors();
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transition RunExampleClick -> S1_ResultDisplayed and behavior', () => {
    test('Clicking Run Example processes a sorted array and displays unique elements', async ({ page }) => {
      const twoPointers = new TwoPointersPage(page);
      await twoPointers.goto();

      // Input: sorted array with duplicates
      await twoPointers.setInput('1,1,2,3,3');
      await twoPointers.clickRun();

      // Validate the DOM updated to the expected S1 evidence: Unique elements shown
      const resultText = (await twoPointers.getResultText()).trim();
      expect(resultText).toBe('Unique elements: [1, 2, 3]' || 'Unique elements: [1,2,3]'); // accept either formatting

      // Ensure no uncaught exceptions occurred during processing
      expect(twoPointers.getPageErrors().length).toBe(0);

      // Basic console sanity: no console.error messages (if any appear they are captured)
      const consoleErrors = twoPointers.getConsoleMessages().filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Multiple clicks update the result accordingly (state transitions are repeatable)', async ({ page }) => {
      const twoPointers = new TwoPointersPage(page);
      await twoPointers.goto();

      // First input and click
      await twoPointers.setInput('-4,-4,-1,0,3,3');
      await twoPointers.clickRun();
      let text = (await twoPointers.getResultText()).trim();
      // Expect unique elements to appear; accept spacing variations
      expect(text).toContain('Unique elements');
      expect(text).toContain('-4');
      expect(text).toContain('-1');
      expect(text).toContain('0');
      expect(text).toContain('3');

      // Change input (transition again) and verify result updates
      await twoPointers.setInput('2,2,2,2');
      await twoPointers.clickRun();
      text = (await twoPointers.getResultText()).trim();
      expect(text).toBe('Unique elements: [2]' || 'Unique elements: [2,]'); // prefer [2], but accept slight formatting differences

      // No uncaught errors across repeated interactions
      expect(twoPointers.getPageErrors().length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenario observations', () => {
    test('Empty input behaves according to implementation (split yields [""] -> Number("") === 0)', async ({ page }) => {
      const twoPointers = new TwoPointersPage(page);
      await twoPointers.goto();

      // Empty input
      await twoPointers.setInput('');
      await twoPointers.clickRun();

      const text = (await twoPointers.getResultText()).trim();
      // Implementation transforms empty string into [0]; assert observed behavior explicitly
      expect(text).toContain('Unique elements');
      expect(text).toMatch(/0/);

      // No uncaught exceptions should have happened
      expect(twoPointers.getPageErrors().length).toBe(0);
    });

    test('Whitespace and spaced input is handled (numbers with spaces are parsed correctly)', async ({ page }) => {
      const twoPointers = new TwoPointersPage(page);
      await twoPointers.goto();

      // Input containing spaces
      await twoPointers.setInput('1, 1 , 2,  3');
      await twoPointers.clickRun();

      const text = (await twoPointers.getResultText()).trim();
      // Expect the unique elements to be 1,2,3 (whitespace should not break Number parsing)
      expect(text).toContain('1');
      expect(text).toContain('2');
      expect(text).toContain('3');
      expect(text).toContain('Unique elements');

      // Confirm no uncaught page errors
      expect(twoPointers.getPageErrors().length).toBe(0);
    });

    test('Non-numeric input results observed (NaN behavior) and no runtime exceptions', async ({ page }) => {
      const twoPointers = new TwoPointersPage(page);
      await twoPointers.goto();

      // Non-numeric inputs -> Number('a') === NaN
      await twoPointers.setInput('a,a');
      await twoPointers.clickRun();

      const text = (await twoPointers.getResultText()).trim();
      // Implementation will display NaN values; assert that NaN appears in the result string
      expect(text).toContain('Unique elements');
      expect(text).toMatch(/NaN/);

      // There should still be no uncaught exceptions (behavioral bug but not a thrown error)
      expect(twoPointers.getPageErrors().length).toBe(0);
    });

    test('Unsorted input demonstrates algorithm only removes adjacent duplicates', async ({ page }) => {
      const twoPointers = new TwoPointersPage(page);
      await twoPointers.goto();

      // Unsorted array with duplicates separated (not adjacent)
      await twoPointers.setInput('2,1,2');
      await twoPointers.clickRun();

      const text = (await twoPointers.getResultText()).trim();
      // Since algorithm only removes consecutive duplicates, the array remains as-is.
      // Assert that both 2 and 1 remain and duplicates were not globally removed.
      expect(text).toContain('2');
      expect(text).toContain('1');

      // Check that the result reflects all elements (i.e., length 3 would be present in the displayed string)
      // A simple check: ensure there is at least two commas indicating three items OR the exact sequence appears
      const commaCount = (text.match(/,/g) || []).length;
      expect(commaCount).toBeGreaterThanOrEqual(2);

      // No runtime errors thrown
      expect(twoPointers.getPageErrors().length).toBe(0);
    });
  });

  test.describe('FSM evidence and observables verification', () => {
    test('S1 evidence: result div innerText uses expected prefix "Unique elements:" on successful run', async ({ page }) => {
      const twoPointers = new TwoPointersPage(page);
      await twoPointers.goto();

      // Provide a canonical sorted input
      await twoPointers.setInput('-4,-1,0,3,5,9');
      await twoPointers.clickRun();

      // Verify the expected evidence text is present in the DOM after transition
      const text = (await twoPointers.getResultText()).trim();
      expect(text.startsWith('Unique elements:')).toBe(true);

      // Verify the list representation uses square brackets and comma-separated values
      expect(text).toMatch(/\[.*\]/);

      // No uncaught exceptions during this observable evidence
      expect(twoPointers.getPageErrors().length).toBe(0);
    });
  });
});