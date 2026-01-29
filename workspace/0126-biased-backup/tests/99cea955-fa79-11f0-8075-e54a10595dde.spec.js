import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cea955-fa79-11f0-8075-e54a10595dde.html';

// Page Object Model for the Interactive Quick Sort page
class QuickSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for key elements to be present
    await Promise.all([
      this.page.waitForSelector('#arrayInput'),
      this.page.waitForSelector('#sortButton'),
      this.page.waitForSelector('#resetButton'),
      this.page.waitForSelector('#stepButton'),
      this.page.waitForSelector('#arrayDisplay'),
      this.page.waitForSelector('#statusDisplay'),
    ]);
  }

  async getArrayInputValue() {
    return this.page.locator('#arrayInput').inputValue();
  }

  async setArrayInputValue(value) {
    await this.page.fill('#arrayInput', String(value));
  }

  async clickSort() {
    await this.page.click('#sortButton');
  }

  async clickStep() {
    await this.page.click('#stepButton');
  }

  async clickReset() {
    await this.page.click('#resetButton');
  }

  async getArrayDisplayText() {
    return this.page.locator('#arrayDisplay').innerText();
  }

  async getStatusText() {
    return this.page.locator('#statusDisplay').innerText();
  }

  async getLowIndexValue() {
    return this.page.locator('#lowIndex').inputValue();
  }

  async getHighIndexValue() {
    return this.page.locator('#highIndex').inputValue();
  }

  // Helper to read in-page JS variables (steps, currentStep, array)
  async evalInPage(fn) {
    return this.page.evaluate(fn);
  }
}

test.describe('Interactive Quick Sort - FSM tests (99cea955-fa79-11f0-8075-e54a10595dde)', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let page;

  test.beforeEach(async ({ browser }) => {
    // Reset storage of errors for each test
    pageErrors = [];
    consoleErrors = [];

    // Create a new context/page for isolation
    const context = await browser.newContext();
    page = await context.newPage();

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages, and separately track console "error" messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg);
      }
    });

    // Navigate to the application page
    await page.goto(APP_URL);
    // Ensure DOM loaded
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async () => {
    // Assert that no unexpected page errors (ReferenceError, SyntaxError, TypeError) occurred.
    // The implementation instructs to observe errors; here we assert none occurred.
    const relevantErrors = pageErrors.filter(e =>
      e instanceof Error &&
      (e.name === 'ReferenceError' || e.name === 'SyntaxError' || e.name === 'TypeError')
    );
    expect(relevantErrors.length, `No ReferenceError/SyntaxError/TypeError should have been thrown - errors: ${pageErrors.map(String).join('; ')}`).toBe(0);

    // Also assert there were no console "error" messages emitted by the page
    expect(consoleErrors.length, `No console.error messages should have been emitted`).toBe(0);

    // Close the page's context
    try {
      await page.context().close();
    } catch (e) {
      // ignore close errors
    }
  });

  test.describe('S0_Idle state - Initial page load', () => {
    test('Displays initial DOM elements and initial values (Idle state) - S0_Idle', async () => {
      // Validate the page object and initial visible state correspond to the implementation
      const qs = new QuickSortPage(page);

      // The input should contain the provided default value per HTML implementation
      const inputVal = await qs.getArrayInputValue();
      expect(inputVal).toBe('3,6,8,10,1,2,1');

      // The FSM's "entry_actions" suggested displayArray() on entry, but the implementation
      // does not call displayArray on load. Assert the actual behavior: arrayDisplay should be empty string.
      const arrayDisplay = await qs.getArrayDisplayText();
      expect(arrayDisplay).toBe(''); // Implementation does not call displayArray at load

      // statusDisplay should be empty at idle
      const status = await qs.getStatusText();
      expect(status).toBe('');
    });
  });

  test.describe('S0_Idle -> S1_Sorting transition (Sort button)', () => {
    test('Clicking Sort parses input, sorts array synchronously and displays sorted array', async () => {
      // This test validates the "SortButtonClick" event and the S0 -> S1 transition
      const qs = new QuickSortPage(page);

      // Precondition: arrayDisplay is empty
      expect(await qs.getArrayDisplayText()).toBe('');

      // Click Sort
      await qs.clickSort();

      // After clicking Sort, quickSort runs synchronously, so arrayDisplay should show the sorted array.
      // Expected sorted order for [3,6,8,10,1,2,1] -> [1,1,2,3,6,8,10]
      const displayAfterSort = await qs.getArrayDisplayText();
      expect(displayAfterSort).toBe('Array: 1, 1, 2, 3, 6, 8, 10');

      // status should still be empty (sorting completed synchronously but status is only set in Step logic)
      expect(await qs.getStatusText()).toBe('');

      // confirm internal variables: highIndex should be array.length - 1 and steps should be a non-empty array
      const highIndex = await qs.evalInPage(() => highIndex);
      const arrLength = await qs.evalInPage(() => array.length);
      expect(highIndex).toBe(arrLength - 1);

      const stepsLength = await qs.evalInPage(() => steps.length);
      expect(typeof stepsLength).toBe('number');
      // Implementation pushes steps during recursion, so steps length should be >= 0
      expect(stepsLength).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('S1_Sorting - Step button behavior and S1->S2 transition attempt', () => {
    test('Pressing Step sets low/high indices if steps exist; status not set to "Sort Complete!" due to a missing step increment', async () => {
      // This test explores the StepButtonClick behavior from S1_Sorting.
      const qs = new QuickSortPage(page);

      // Ensure we are in a sorted state by clicking Sort first
      await qs.clickSort();

      // Read steps length to determine behavior
      const stepsLength = await qs.evalInPage(() => steps.length);
      const currentStep = await qs.evalInPage(() => currentStep);

      if (stepsLength > 0) {
        // On first Step click, the implementation sets lowIndex/highIndex to steps[currentStep]
        await qs.clickStep();

        // After clicking Step, lowIndex/highIndex inputs should reflect steps[currentStep]
        const expectedPair = await qs.evalInPage(() => steps[currentStep]);
        // expectedPair should be an array [low, high]
        expect(Array.isArray(expectedPair)).toBe(true);

        const lowVal = parseInt(await qs.getLowIndexValue(), 10);
        const highVal = parseInt(await qs.getHighIndexValue(), 10);

        expect(lowVal).toBe(expectedPair[0]);
        expect(highVal).toBe(expectedPair[1]);

        // Because the implementation never increments currentStep, pressing Step repeatedly will not reach "Sort Complete!".
        // Press Step a few more times and assert status remains empty (i.e., no transition to S2_Sorted).
        for (let i = 0; i < 3; i++) {
          await qs.clickStep();
        }
        expect(await qs.getStatusText()).toBe('');
      } else {
        // If there are no steps (edge case), clicking Step sets status to "Sort Complete!"
        await qs.clickStep();
        expect(await qs.getStatusText()).toBe('Sort Complete!');
      }
    });

    test('Repeated Step presses do not progress to Sort Complete due to missing currentStep increment (Edge behavior)', async () => {
      // Demonstrates that the FSM transition S1->S2 via Step is not reachable in this implementation
      const qs = new QuickSortPage(page);

      // Ensure sort is performed
      await qs.clickSort();

      // Press Step many times
      for (let i = 0; i < 10; i++) {
        await qs.clickStep();
      }

      // Confirm that the status did not change to "Sort Complete!" in the typical case
      // (This will be true when steps.length > 0; if steps.length == 0, status would have been set already.)
      const stepsLength = await qs.evalInPage(() => steps.length);
      if (stepsLength > 0) {
        expect(await qs.getStatusText()).toBe('');
      } else {
        // If no steps were recorded, status should be complete
        expect(await qs.getStatusText()).toBe('Sort Complete!');
      }
    });
  });

  test.describe('S0_Idle -> S3_Reset and S3_Reset -> S0_Idle transitions (Reset behavior)', () => {
    test('Reset clears the internal array and display (Reset state), then Sort after Reset works (Reset->Idle->Sorting)', async () => {
      const qs = new QuickSortPage(page);

      // Start by changing the input to a recognizable distinct value
      await qs.setArrayInputValue('9,5,7');
      expect(await qs.getArrayInputValue()).toBe('9,5,7');

      // Click Reset: implementation should clear internal array and status and display
      await qs.clickReset();

      // After reset, arrayDisplay should show "Array: " because displayArray is called with empty array
      const arrayDisplayAfterReset = await qs.getArrayDisplayText();
      expect(arrayDisplayAfterReset).toBe('Array: ');

      // statusDisplay should be cleared
      expect(await qs.getStatusText()).toBe('');

      // Now click Sort again: Sort reads from input (which was not cleared by Reset) and sorts the array
      await qs.clickSort();
      // Sorted result for [9,5,7] => [5,7,9]
      expect(await qs.getArrayDisplayText()).toBe('Array: 5, 7, 9');
    });
  });

  test.describe('Edge cases and invalid input handling', () => {
    test('Non-numeric input yields NaN entries in the displayed array', async () => {
      const qs = new QuickSortPage(page);

      // Set input to non-numeric values
      await qs.setArrayInputValue('a,b,c');
      await qs.clickSort();

      // The implementation maps Number over each entry; Number('a') === NaN, so display should show NaN values
      const display = await qs.getArrayDisplayText();
      // Depending on join behavior, expect 'Array: NaN, NaN, NaN'
      expect(display).toBe('Array: NaN, NaN, NaN');

      // status should remain empty
      expect(await qs.getStatusText()).toBe('');
    });

    test('Empty input behavior (empty string) is handled via Number("") => 0', async () => {
      const qs = new QuickSortPage(page);

      await qs.setArrayInputValue('');
      await qs.clickSort();

      // input.split(",") => [""] => Number("") === 0, so array becomes [0]
      const display = await qs.getArrayDisplayText();
      expect(display).toBe('Array: 0');

      // status should remain empty
      expect(await qs.getStatusText()).toBe('');
    });
  });

  test.describe('Observability: console and page errors are monitored', () => {
    test('No uncaught ReferenceError/SyntaxError/TypeError or console.error messages should occur during typical interactions', async () => {
      const qs = new QuickSortPage(page);

      // Perform typical interactions: sort -> step -> reset -> sort
      await qs.clickSort();
      await qs.clickStep();
      await qs.clickReset();
      await qs.setArrayInputValue('4,2,3');
      await qs.clickSort();

      // After interactions, ensure no captured page errors of the targeted types
      const allPageErrors = await page.evaluate(() => {
        // return a summary if the page exposed any global error arrays (it doesn't), so this is a noop
        return null;
      });

      // The afterEach will assert that there were no ReferenceError/SyntaxError/TypeError and no console.error messages.
      // Here we add a sanity expectation that the pageErrors array (captured in test.beforeEach) is an array
      expect(Array.isArray(pageErrors)).toBe(true);
      expect(Array.isArray(consoleErrors)).toBe(true);
    });
  });
});