import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99ced062-fa79-11f0-8075-e54a10595dde.html';

// Page Object Model for the Radix Sort demo
class RadixSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#arrayInput');
    this.sortButton = page.locator('#sortButton');
    this.resetButton = page.locator('#resetButton');
    this.delaySlider = page.locator('#delaySlider');
    this.delayValue = page.locator('#delayValue');
    this.arrayDisplay = page.locator('#arrayDisplay');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getArrayInputValue() {
    return this.arrayInput.inputValue();
  }

  async clickSort() {
    await this.sortButton.click();
  }

  async clickReset() {
    await this.resetButton.click();
  }

  async setDelay(value) {
    // value should be a number or string
    await this.delaySlider.fill(String(value));
    // Fire input event by dispatching via evaluate since fill might not trigger range input change properly
    await this.page.evaluate((v) => {
      const slider = document.getElementById('delaySlider');
      slider.value = v;
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
  }

  async getDelayValueText() {
    return this.delayValue.innerText();
  }

  async getArrayDisplayText() {
    return this.arrayDisplay.innerText();
  }
}

// Helper: wait for arrayDisplay to become a specific string (with timeout)
async function waitForArrayDisplay(page, expectedText, timeout = 5000) {
  await page.waitForFunction(
    (selector, expected) => {
      const el = document.querySelector(selector);
      return el && el.innerText === expected;
    },
    '#arrayDisplay',
    expectedText,
    { timeout }
  );
}

test.describe('Radix Sort Interactive Demo - FSM and UI tests', () => {
  // Collect console messages and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Observe console messages
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
    });

    // Capture uncaught exceptions
    page.on('pageerror', (err) => {
      // Store the full error message for assertions
      pageErrors.push(err && err.message ? err.message : String(err));
    });
  });

  test.describe('State S0_Idle (Initial)', () => {
    test('Initial render: input, buttons, slider and display exist and have expected defaults', async ({ page }) => {
      // Validate initial Idle state UI and "entry action" effects (rendered elements)
      // This validates FSM state S0_Idle entry_actions: renderPage() (observed as initial rendering)
      const ui = new RadixSortPage(page);
      await ui.goto();

      // Ensure elements exist
      await expect(ui.arrayInput).toBeVisible();
      await expect(ui.sortButton).toBeVisible();
      await expect(ui.resetButton).toBeVisible();
      await expect(ui.delaySlider).toBeVisible();
      await expect(ui.delayValue).toBeVisible();
      await expect(ui.arrayDisplay).toBeVisible();

      // Check default input value matches FSM evidence
      const inputValue = await ui.getArrayInputValue();
      expect(inputValue).toBe('170,45,75,90,802,24,2,66');

      // Delay default value shown
      const delayText = await ui.getDelayValueText();
      expect(delayText).toBe('300');

      // arrayDisplay should be empty initially
      const displayText = await ui.getArrayDisplayText();
      expect(displayText).toBe('');

      // Assert no uncaught exceptions were raised during initial load
      expect(pageErrors, `No page errors should be thrown on initial load. Console: ${JSON.stringify(consoleMessages)}`).toHaveLength(0);
    });
  });

  test.describe('Event: DelaySliderInput (S0_Idle -> S0_Idle)', () => {
    test('Adjusting delay slider updates displayed delay value', async ({ page }) => {
      // This validates transition for DelaySliderInput: delay value should be reflected in #delayValue
      const ui = new RadixSortPage(page);
      await ui.goto();

      // Change delay to a smaller, deterministic value to speed up sorting in later tests
      await ui.setDelay(150);

      // Confirm UI updated
      const delayText = await ui.getDelayValueText();
      expect(delayText).toBe('150');

      // Ensure no uncaught errors occurred as a result of input event
      expect(pageErrors, 'No page errors after changing delay slider').toHaveLength(0);

      // Also check console does not contain ReferenceError/SyntaxError/TypeError entries
      const badConsole = consoleMessages.filter(m =>
        /ReferenceError|SyntaxError|TypeError|Uncaught/.test(m.text)
      );
      expect(badConsole.length, `Console should not contain JS engine errors: ${JSON.stringify(badConsole)}`).toBe(0);
    });
  });

  test.describe('Transition: SortButtonClick (S0_Idle -> S1_Sorting)', () => {
    test('Clicking Sort displays the initial parsed array and eventually shows the sorted array', async ({ page }) => {
      // This test validates the S0 -> S1 transition actions:
      // - parsing input into array
      // - reading delay from slider
      // - updating arrayDisplay with initial array
      // - invoking radixSort which ultimately updates arrayDisplay to sorted array

      const ui = new RadixSortPage(page);
      await ui.goto();

      // Set a small delay to make the sort finish quickly for the test
      await ui.setDelay(50);
      expect(await ui.getDelayValueText()).toBe('50');

      // Confirm initial display empty
      expect(await ui.getArrayDisplayText()).toBe('');

      // Click sort
      await ui.clickSort();

      // After clicking sort, the immediate action should update the display to the parsed array
      const expectedInitial = 'Array: 170, 45, 75, 90, 802, 24, 2, 66';
      // Wait briefly for the immediate update (synchronous before async sort steps)
      await page.waitForFunction(
        (expected) => document.getElementById('arrayDisplay').innerText === expected,
        expectedInitial,
        { timeout: 1000 }
      );
      const displayAfterClick = await ui.getArrayDisplayText();
      expect(displayAfterClick).toBe(expectedInitial);

      // Now wait for the asynchronous sorting to finish and display the sorted array
      const expectedSorted = 'Array: 2, 24, 45, 66, 75, 90, 170, 802';
      // Give generous timeout because sorting uses await + setTimeout per element; using small delay speeds it up
      await waitForArrayDisplay(page, expectedSorted, 8000);
      const finalDisplay = await ui.getArrayDisplayText();
      expect(finalDisplay).toBe(expectedSorted);

      // Assert that during the sorting no uncaught page errors occurred
      expect(pageErrors, `No page errors should occur during sorting. Collected: ${JSON.stringify(pageErrors)}`).toHaveLength(0);

      // Confirm console did not log fatal JS engine errors
      const fatalConsole = consoleMessages.filter(m =>
        /ReferenceError|SyntaxError|TypeError|Uncaught/.test(m.text)
      );
      expect(fatalConsole.length, `Console should not contain fatal JS errors during sorting: ${JSON.stringify(fatalConsole)}`).toBe(0);
    }, /* test timeout ms */ 15000);
  });

  test.describe('Transition: ResetButtonClick (S0_Idle -> S2_Reset)', () => {
    test('Clicking Reset clears the array, input field and display', async ({ page }) => {
      // This tests the reset transition actions and resulting UI
      const ui = new RadixSortPage(page);
      await ui.goto();

      // Precondition: change the input and click sort to populate display
      await ui.arrayInput.fill('1,2,3');
      await ui.setDelay(50);
      await ui.clickSort();

      // Wait for immediate display update
      await page.waitForFunction(
        () => document.getElementById('arrayDisplay').innerText.startsWith('Array:'),
        null,
        { timeout: 2000 }
      );

      // Click reset
      await ui.clickReset();

      // After reset: arrayInput should be empty string and arrayDisplay empty
      const inputAfterReset = await ui.getArrayInputValue();
      const displayAfterReset = await ui.getArrayDisplayText();

      expect(inputAfterReset).toBe('');
      expect(displayAfterReset).toBe('');

      // No page errors expected as a result of reset
      expect(pageErrors).toHaveLength(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Malformed input (non-numeric values) – application should handle without uncaught exceptions and show parsed values', async ({ page }) => {
      // This test feeds invalid input such as letters to observe behavior and ensure no runtime exceptions bubble up
      const ui = new RadixSortPage(page);
      await ui.goto();

      // Provide malformed input
      await ui.arrayInput.fill('a,b,c');
      await ui.setDelay(20);
      await ui.clickSort();

      // The UI will display the parsed array immediately; for non-numeric values Number('a') -> NaN
      // Expect initial display to include 'NaN'
      await page.waitForFunction(
        () => document.getElementById('arrayDisplay').innerText.includes('NaN'),
        null,
        { timeout: 2000 }
      );
      const displayText = await ui.getArrayDisplayText();
      expect(displayText).toContain('NaN');

      // Even with malformed data, no uncaught exceptions (ReferenceError/SyntaxError/TypeError) should be thrown
      // We assert that pageErrors array remains empty.
      expect(pageErrors, `Malformed input should not cause uncaught page errors. Collected: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
    });

    test('Empty input - ensure algorithm does not crash and display behavior is reasonable', async ({ page }) => {
      // Clicking sort with empty input should be handled gracefully
      const ui = new RadixSortPage(page);
      await ui.goto();

      // Make input empty
      await ui.arrayInput.fill('');
      await ui.setDelay(20);

      // Click sort - array becomes [0] because Number('') === 0 (or split yields [''] -> Number('')=0)
      await ui.clickSort();

      // Expect the displayed array to reflect the parsed numbers (likely "Array: 0")
      await page.waitForFunction(
        () => document.getElementById('arrayDisplay').innerText.startsWith('Array:'),
        null,
        { timeout: 2000 }
      );

      const disp = await ui.getArrayDisplayText();
      expect(disp.startsWith('Array:')).toBe(true);

      // Ensure no uncaught errors happened
      expect(pageErrors).toHaveLength(0);
    });
  });

  // After all tests in this file, add an additional test that explicitly asserts there were no uncaught JS engine errors overall.
  test('No uncaught ReferenceError/SyntaxError/TypeError occurred during the test session', async ({ page }) => {
    // This test simply loads the page and ensures that across a simple load there are no page errors.
    // It is separated so CI can report this requirement clearly.
    const ui = new RadixSortPage(page);
    await ui.goto();

    // Wait briefly to allow any immediate runtime errors to surface
    await page.waitForTimeout(200);

    // Assert pageErrors is empty
    expect(pageErrors, `Expected no uncaught errors, but found: ${JSON.stringify(pageErrors)}`).toHaveLength(0);

    // Also assert that console messages do not contain engine-level errors
    const engineErrors = consoleMessages.filter(m =>
      /ReferenceError|SyntaxError|TypeError|Uncaught/.test(m.text)
    );
    expect(engineErrors.length, `Console should not report engine errors: ${JSON.stringify(engineErrors)}`).toBe(0);
  });
});