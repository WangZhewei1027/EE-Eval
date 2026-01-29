import { test, expect } from '@playwright/test';

const URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3c4ed1-fa74-11f0-a1b6-4b9b8151441a.html';

// Page object for the Merge Sort demo page
class MergeSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.inputSelector = '#inputArray';
    this.buttonSelector = "button[onclick='runMergeSort()']";
    this.outputSelector = '#output';
  }

  async goto() {
    await this.page.goto(URL);
  }

  async getInputValue() {
    return this.page.locator(this.inputSelector).inputValue();
  }

  async setInputValue(value) {
    await this.page.locator(this.inputSelector).fill(value);
  }

  async getButtonText() {
    return this.page.locator(this.buttonSelector).innerText();
  }

  async isOutputEmpty() {
    const text = await this.page.locator(this.outputSelector).textContent();
    return !text || text.trim() === '';
  }

  async getOutputText() {
    const t = await this.page.locator(this.outputSelector).textContent();
    return t ?? '';
  }

  // Click the Sort button and wait for a pageerror to be emitted (useful when functions are missing)
  async clickSortAndWaitForPageError() {
    // Wait for the pageerror that should arise because runMergeSort is undefined or due to SyntaxError
    const waitForError = this.page.waitForEvent('pageerror', { timeout: 5000 });
    await this.page.click(this.buttonSelector);
    return waitForError;
  }

  // Alternative: attempt to click and capture console as well
  async clickSortAndCollectConsoleAndErrors() {
    const errors = [];
    const consoles = [];
    const onError = (e) => errors.push(e);
    const onConsole = (c) => consoles.push(c);

    this.page.on('pageerror', onError);
    this.page.on('console', onConsole);

    await this.page.click(this.buttonSelector);

    // wait a short time for any errors to surface
    await this.page.waitForTimeout(200);

    this.page.off('pageerror', onError);
    this.page.off('console', onConsole);

    return { errors, consoles };
  }
}

test.describe('Merge Sort interactive demo - FSM and runtime validation', () => {
  test.describe('FSM States (S0_Idle and S1_Sorting)', () => {
    test('S0_Idle: initial UI is rendered with input, Sort button, and empty output', async ({ page }) => {
      // Validate the Idle state: page renders controls correctly.
      const ms = new MergeSortPage(page);
      await ms.goto();

      // Input should exist and have the default value from the static HTML
      const inputValue = await ms.getInputValue();
      expect(inputValue).toBe('38,27,43,3,9,82,10');

      // Button should be present and contain the visible text 'Sort'
      const buttonText = await ms.getButtonText();
      expect(buttonText).toMatch(/Sort/i);

      // Output area should be present and initially empty
      const isEmpty = await ms.isOutputEmpty();
      expect(isEmpty).toBeTruthy();

      // FSM expected onEnter for S0 was renderPage() — check that no global renderPage function exists
      // We intentionally check existence; as per instructions we should observe and assert actual runtime state.
      const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
      expect(hasRenderPage).toBe(false);
    });

    test('S1_Sorting: clicking Sort triggers attempt to run runMergeSort (expected ReferenceError due to broken script)', async ({ page }) => {
      // Validate transition from Idle -> Sorting when Sort button is clicked.
      // Because the page script is malformed, clicking should result in a runtime error (ReferenceError or similar).
      const ms1 = new MergeSortPage(page);

      // Attach a pageerror listener before navigation to ensure we capture load-time syntax errors if any
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));

      await ms.goto();

      // Ensure initial output is empty before the click
      expect(await ms.isOutputEmpty()).toBeTruthy();

      // Click the Sort button and wait for a pageerror caused by the missing function (runMergeSort undefined)
      const [error] = await Promise.all([
        page.waitForEvent('pageerror', { timeout: 5000 }).catch(e => null),
        page.click(ms.buttonSelector)
      ]);

      // If we got a pageerror from the click, assert it's a ReferenceError mentioning runMergeSort
      if (error) {
        // The message is environment-dependent; check for known substrings.
        const msg = String(error?.message ?? error);
        expect(msg).toEqual(expect.any(String));
        // Expect mention of the missing function name or a ReferenceError
        expect(
          /runMergeSort|ReferenceError|is not defined/i.test(msg)
        ).toBeTruthy();
      } else {
        // If clicking didn't produce a pageerror event (unexpected), still check that output did not show sorted results
        const outText = await ms.getOutputText();
        expect(outText).not.toContain('Sorted array');
        expect(outText).not.toContain('Step-by-step process');
      }

      // Regardless, after the attempted sorting the output should remain empty or unchanged because the script is broken
      const finalOutput = await ms.getOutputText();
      expect(finalOutput).not.toContain('Sorted array');
      expect(finalOutput).not.toContain('Step-by-step process');
    });
  });

  test.describe('Events and Transitions (SortButtonClick and observables)', () => {
    test('SortButtonClick event exists and clicking produces a runtime error instead of expected sorting output', async ({ page }) => {
      // Validate that the Sort button element with onclick exists and that clicking it leads to a runtime error.
      const ms2 = new MergeSortPage(page);

      // Listen for both console messages and pageerrors to capture anything that happens
      const pageErrors1 = [];
      const consoleMessages = [];
      page.on('pageerror', (err) => pageErrors.push(err));
      page.on('console', (msg) => consoleMessages.push(`${msg.type()}: ${msg.text()}`));

      await ms.goto();

      // Ensure the button exists
      const button = page.locator(ms.buttonSelector);
      await expect(button).toBeVisible();

      // Click the button and capture the first pageerror (if any)
      const errorPromise = page.waitForEvent('pageerror', { timeout: 3000 }).catch(() => null);
      await button.click();

      const err = await errorPromise;

      // At least one of these conditions should hold: a pageerror happened, or no sorted output is produced.
      if (err) {
        // Confirm it's a parse/Reference/Syntax error related to the sorting code
        const msg1 = String(err.message ?? err);
        expect(/runMergeSort|SyntaxError|ReferenceError|Unexpected end/i.test(msg)).toBeTruthy();
      } else {
        // No error event: ensure the observable (sorted output) was not produced due to broken implementation
        const out = await ms.getOutputText();
        expect(out).not.toContain('Sorted array');
      }

      // Also assert that console captured any logs/warnings (we don't assert specific messages because environment varies)
      expect(Array.isArray(consoleMessages)).toBe(true);
    });

    test('Transition expected_observables: sorted array and steps are NOT present when the script is malformed', async ({ page }) => {
      // Confirm that the page does not produce the expected sorted output and steps because the JS is incomplete.
      const ms3 = new MergeSortPage(page);
      await ms.goto();

      // Click and swallow the error
      await Promise.all([
        page.waitForEvent('pageerror', { timeout: 3000 }).catch(() => null),
        page.click(ms.buttonSelector).catch(() => {})
      ]);

      // Verify the output area does not contain the expected sorted array or a step-by-step section
      const output = await ms.getOutputText();
      expect(output).not.toContain('Sorted array');
      expect(output).not.toContain('Step-by-step process');
      expect(output.trim()).toBe('');
    });
  });

  test.describe('Error Handling, Edge Cases, and Observability', () => {
    test('Page load emits a SyntaxError due to truncated script (assert that a parse-time pageerror occurs)', async ({ page }) => {
      // We attach the listener before navigation to ensure we capture parse-time errors.
      const captured = [];
      page.on('pageerror', (err) => captured.push(err));

      // Navigate after listener is attached
      await page.goto(URL);

      // Wait briefly to allow parse-time errors to surface
      await page.waitForTimeout(200);

      // There should be at least one pageerror and at least one should be a SyntaxError (or message indicating unexpected end)
      expect(captured.length).toBeGreaterThanOrEqual(1);

      const messages = captured.map(e => String(e.message ?? e));
      // At least one message should indicate a syntax/parsing problem
      const hasSyntaxish = messages.some(m => /SyntaxError|Unexpected end|Unexpected token|Unexpected end of input/i.test(m));
      expect(hasSyntaxish).toBe(true);
    });

    test('Edge case: changing input to non-numeric values still does not execute sorting due to missing runtime function', async ({ page }) => {
      const ms4 = new MergeSortPage(page);
      await ms.goto();

      // Change input to an edge-case value
      await ms.setInputValue('a,b,c');

      // Confirm input changed
      expect(await ms.getInputValue()).toBe('a,b,c');

      // Clicking should still produce a ReferenceError because the function is not defined (or no output change)
      const error = await Promise.all([
        page.waitForEvent('pageerror', { timeout: 3000 }).catch(() => null),
        page.click(ms.buttonSelector).catch(() => {})
      ]).then(([err]) => err);

      if (error) {
        const msg2 = String(error.message ?? error);
        expect(/runMergeSort|ReferenceError|is not defined/i.test(msg)).toBeTruthy();
      } else {
        // If no error surfaced, ensure output was not produced
        const out1 = await ms.getOutputText();
        expect(out).not.toContain('Sorted array');
      }
    });

    test('Edge case: empty input value before clicking Sort still results in runtime error, and no output is produced', async ({ page }) => {
      const ms5 = new MergeSortPage(page);
      await ms.goto();

      // Set empty input
      await ms.setInputValue('');
      expect(await ms.getInputValue()).toBe('');

      // Click and expect pageerror or no output
      const err1 = await Promise.all([
        page.waitForEvent('pageerror', { timeout: 3000 }).catch(() => null),
        page.click(ms.buttonSelector).catch(() => {})
      ]).then(([e]) => e);

      if (err) {
        const msg3 = String(err.message ?? err);
        expect(/runMergeSort|ReferenceError|is not defined/i.test(msg)).toBeTruthy();
      } else {
        // No error: verify no sorted output rendered
        const out2 = await ms.getOutputText();
        expect(out).not.toContain('Sorted array');
      }
    });
  });
});