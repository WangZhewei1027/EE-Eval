import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b0aa93-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object for the Counting Sort demo page
class CountingSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
    // Handlers bound so we can remove them if needed
    this._consoleHandler = (msg) => {
      // Collect text for assertions; include type and location for debugging
      try {
        this.consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
          location: msg.location ? msg.location() : null,
        });
      } catch (err) {
        // In case msg.location() throws in some environments, still capture text
        this.consoleMessages.push({ type: msg.type(), text: msg.text(), location: null });
      }
    };
    this._pageErrorHandler = (err) => {
      // pageerror receives Error objects
      this.pageErrors.push({
        message: err.message,
        name: err.name,
        stack: err.stack,
      });
    };
  }

  async goto() {
    // Attach handlers before navigation to capture logs emitted during page load / top-level scripts
    this.page.on('console', this._consoleHandler);
    this.page.on('pageerror', this._pageErrorHandler);
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickDemonstrate() {
    await this.page.click('#demonstration-button');
  }

  async getDemonstrateButton() {
    return this.page.locator('#demonstration-button');
  }

  detachHandlers() {
    this.page.removeListener('console', this._consoleHandler);
    this.page.removeListener('pageerror', this._pageErrorHandler);
  }
}

test.describe('Counting Sort FSM - f5b0aa93-fa7c-11f0-adc7-178f556b1ee0', () => {
  let csPage;

  // Setup before each test: create page object and navigate, capturing console and errors
  test.beforeEach(async ({ page }) => {
    csPage = new CountingSortPage(page);
    await csPage.goto();
  });

  // Teardown: detach listeners to avoid leaking across tests
  test.afterEach(async () => {
    if (csPage) {
      csPage.detachHandlers();
    }
  });

  test('Initial Idle state: page renders and top-level script logs a Sorted array', async () => {
    // This test validates the initial "Idle" state rendering (S0_Idle)
    // and the entry action that runs the top-level countingSort and logs the sortedArray.

    const button = await csPage.getDemonstrateButton();

    // The button should exist and be visible
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Demonstrate Counting Sort');

    // There should be at least one console log emitted during page load (the script logs sorted array on load)
    // Wait a short moment to ensure console handlers received the messages
    await new Promise((res) => setTimeout(res, 100));

    // Find console logs that include "Sorted array:"
    const sortedLogs = csPage.consoleMessages.filter(msg => msg.text && msg.text.includes('Sorted array:'));

    // Assert initial script logged the sorted array once at least
    expect(sortedLogs.length).toBeGreaterThanOrEqual(1);

    // Validate the logged content: because implementation is buggy (counts index issue), the array
    // logged on load will likely include "undefined" or "NaN". We assert that "Sorted array:" is present
    // and that the printed value shows signs of an incorrect computation (defensive assertion).
    const initialLogText = sortedLogs[0].text;
    expect(initialLogText).toContain('Sorted array:');

    // Assert that the logged array is not the perfect expected output (demonstrates the bug/behavior)
    const expectedExactWithSpaces = '[3, 4, 5, 6, 7, 8, 9]';
    const expectedExactNoSpaces = '[3,4,5,6,7,8,9]';
    const containsExactExpected = initialLogText.includes(expectedExactWithSpaces) || initialLogText.includes(expectedExactNoSpaces);
    // We expect the implementation to be incorrect for this input (counts sized incorrectly).
    expect(containsExactExpected).toBeFalsy();

    // Also assert that the console output contains undefined or NaN which is expected given the faulty implementation
    const containsUndefined = initialLogText.includes('undefined');
    const containsNaN = initialLogText.includes('NaN');
    expect(containsUndefined || containsNaN).toBeTruthy();

    // Finally, ensure there are no uncaught page errors (no ReferenceError/SyntaxError thrown)
    // If runtime errors happen naturally, they would be captured in csPage.pageErrors.
    expect(csPage.pageErrors.length).toBe(0);
  });

  test('Event: clicking Demonstrate Counting Sort transitions to Sorted and logs sorted array', async () => {
    // This test triggers the FSM event "DemonstrateCountingSort" by clicking the button.
    // It verifies that clicking the button causes a console log "Sorted array:" (S1_Sorted entry action)
    const initialCount = csPage.consoleMessages.filter(m => m.text && m.text.includes('Sorted array:')).length;

    // Click the button to trigger the demonstration
    await csPage.clickDemonstrate();

    // Wait a little to capture the console.log from the click handler
    await new Promise((res) => setTimeout(res, 100));

    const sortedLogsAfterClick = csPage.consoleMessages.filter(m => m.text && m.text.includes('Sorted array:'));
    // Expect at least one more "Sorted array:" log after clicking (transition to S1_Sorted)
    expect(sortedLogsAfterClick.length).toBeGreaterThan(initialCount);

    const lastLog = sortedLogsAfterClick[sortedLogsAfterClick.length - 1].text;
    expect(lastLog).toContain('Sorted array:');

    // As above, check that the implementation still shows incorrect results (undefined/NaN)
    const containsUndefinedOrNaN = lastLog.includes('undefined') || lastLog.includes('NaN');
    expect(containsUndefinedOrNaN).toBeTruthy();

    // Ensure the page did not produce uncaught exceptions during the interaction
    expect(csPage.pageErrors.length).toBe(0);
  });

  test('Multiple clicks: repeated transitions produce repeated logs without uncaught exceptions', async () => {
    // Validate repeated user interaction handling: click multiple times and ensure logs accumulate
    const clicks = 3;
    const initialTotalLogs = csPage.consoleMessages.filter(m => m.text && m.text.includes('Sorted array:')).length;

    for (let i = 0; i < clicks; i++) {
      await csPage.clickDemonstrate();
      // Short pause to allow console.log to run and be captured
      await new Promise((res) => setTimeout(res, 80));
    }

    const finalSortedLogs = csPage.consoleMessages.filter(m => m.text && m.text.includes('Sorted array:'));
    expect(finalSortedLogs.length).toBeGreaterThanOrEqual(initialTotalLogs + clicks);

    // Each new log should contain the "Sorted array:" prefix
    for (let i = initialTotalLogs; i < finalSortedLogs.length; i++) {
      expect(finalSortedLogs[i].text).toContain('Sorted array:');
    }

    // No uncaught errors should have been thrown while clicking repeatedly
    expect(csPage.pageErrors.length).toBe(0);
  });

  test('Edge case & implementation inspection: calling countingSort on page returns values that indicate incorrect algorithm output', async ({ page }) => {
    // Directly evaluate the countingSort function in page context to inspect the returned array
    // This validates the onEnter action in S1_Sorted (console.log(sortedArray)) indirectly as well.
    const result = await page.evaluate(() => {
      // Return an object summarizing the result so we don't rely on console text parsing
      try {
        const input = [3, 4, 5, 6, 7, 8, 9];
        const out = countingSort(input);
        // Provide both the raw array and a diagnostic about presence of NaN/undefined
        return {
          out,
          len: out.length,
          hasUndefined: out.some(v => v === undefined),
          hasNaN: out.some(v => Number.isNaN(v)),
          serialized: String(out),
        };
      } catch (err) {
        return { error: true, message: err.message, name: err.name, stack: err.stack };
      }
    });

    // Ensure the evaluation did not throw a ReferenceError or another exception preventing execution
    if (result && result.error) {
      // If the page threw an error when invoking countingSort, surface that as a test failure with details
      throw new Error(`countingSort threw during evaluation: ${result.name} ${result.message}\n${result.stack}`);
    }

    // The function returns an array (sanity)
    expect(Array.isArray(result.out)).toBeTruthy();

    // Because the implementation wrongly sized count array, we expect undefined or NaN values in the output
    expect(result.hasUndefined || result.hasNaN).toBeTruthy();

    // The returned array should not match the ideal expected sorted representation exactly
    const serialized = result.serialized;
    const expectedExactWithSpaces = '3,4,5,6,7,8,9'; // serialized string may drop brackets here
    // Ensure at least one of the expected numbers is missing or the serialized contains NaN/undefined
    const containsNaNorUndefined = serialized.includes('NaN') || serialized.includes('undefined');
    expect(containsNaNorUndefined).toBeTruthy();

    // No uncaught page errors should have been recorded during this evaluation
    expect(csPage.pageErrors.length).toBe(0);
  });

  test('DOM and pedagogical content sanity-check (FSM Idle state evidence)', async () => {
    // Verify that the pedagogical text and algorithm explanation are present on the page
    const textExplanation = await csPage.page.locator('.text-explanation').innerText();
    const algorithmExplanation = await csPage.page.locator('.algorithm-explanation').innerText();
    const pedagogicalContent = await csPage.page.locator('.pedagogical-content').innerText();

    expect(textExplanation.length).toBeGreaterThan(10); // has some content
    expect(algorithmExplanation).toContain('Counting Sort algorithm works as follows');
    expect(pedagogicalContent).toContain('Example');

    // Ensure the button is present in the DOM (FSM component evidence)
    const demoButton = csPage.page.locator('#demonstration-button');
    await expect(demoButton).toBeVisible();
  });
});