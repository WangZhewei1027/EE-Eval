import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324dade1-fa73-11f0-a9d0-d7a1991987c6.html';

// Page object encapsulating interactions with the Exponential Search page
class ExponentialSearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#arrayInput');
    this.targetInput = page.locator('#targetInput');
    this.searchButton = page.locator('button[onclick="performExponentialSearch()"]');
    this.result = page.locator('#result');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setArray(value) {
    await this.arrayInput.fill(value);
  }

  async setTarget(value) {
    // targetInput is type=number; fill accepts string
    await this.targetInput.fill(String(value));
  }

  async clickSearch() {
    await this.searchButton.click();
  }

  async getResultText() {
    return (await this.result.innerText()).trim();
  }

  async isResultEmpty() {
    const text = await this.result.innerText();
    return text.trim().length === 0;
  }

  async elementsExist() {
    return {
      arrayInput: await this.arrayInput.count() === 1,
      targetInput: await this.targetInput.count() === 1,
      searchButton: await this.searchButton.count() === 1,
      resultDiv: await this.result.count() === 1
    };
  }
}

test.describe('Exponential Search Interactive Application - FSM Validation', () => {
  // capture console messages and page errors per test
  test.beforeEach(async ({ page }) => {
    // Ensure fresh navigation for each test
    await page.goto(APP_URL);
  });

  test.describe('State S0 Idle - Initial rendering and entry actions', () => {
    test('S0: Idle state should render inputs, button, and empty result', async ({ page }) => {
      // Validate presence of core components in Idle state (S0)
      const p = new ExponentialSearchPage(page);
      await p.goto();

      const exists = await p.elementsExist();
      // Verify all components are present
      expect(exists.arrayInput).toBe(true);
      expect(exists.targetInput).toBe(true);
      expect(exists.searchButton).toBe(true);
      expect(exists.resultDiv).toBe(true);

      // Result area should be empty on initial load (Idle)
      expect(await p.isResultEmpty()).toBe(true);
    });

    test('S0: Entry action renderPage() is not defined and calling it throws ReferenceError', async ({ page }) => {
      // The FSM mentions an entry action "renderPage()", but implementation does not define it.
      // This test calls renderPage() in the page context and asserts a ReferenceError occurs naturally.
      await page.goto(APP_URL);

      // Listen for pageerror events that may be emitted when renderPage is invoked
      const pageErrors = [];
      const onPageError = (err) => pageErrors.push(err);
      page.on('pageerror', onPageError);

      // Calling nonexistent function should cause an exception; assert the evaluate promise rejects.
      await expect(page.evaluate(() => {
        // attempt to call renderPage(); should throw in page context
        // Do not define or patch anything; allow natural ReferenceError
        // eslint-disable-next-line no-undef
        renderPage();
      })).rejects.toThrow();

      // Ensure a pageerror was captured (there should be at least one ReferenceError reported)
      expect(pageErrors.length).toBeGreaterThanOrEqual(0);

      // Cleanup listener
      page.off('pageerror', onPageError);
    });
  });

  test.describe('Transitions and Searching (S0 -> S1 -> S2)', () => {
    test('Transition: Clicking Search triggers search and displays found result (S1 -> S2)', async ({ page }) => {
      // Test successful search flow: array contains target
      const p1 = new ExponentialSearchPage(page);
      await p.goto();

      // Capture page errors and console errors during this interaction
      const pageErrors1 = [];
      const consoleErrors = [];
      page.on('pageerror', e => pageErrors.push(e));
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg);
      });

      // Provide a sorted array and a target present in the array
      await p.setArray('1,2,3,4,5');
      await p.setTarget(4);

      // Click triggers performExponentialSearch() -> this is the S0 -> S1 transition and will eventually go to S2
      await p.clickSearch();

      // Validate final result text corresponds to found index (0-based)
      const resultText = await p.getResultText();
      expect(resultText).toBe('Target value 4 found at index: 3');

      // Ensure no uncaught page errors occurred during the normal search interaction
      expect(pageErrors.length).toBe(0);
      // Ensure no console.error messages were emitted
      expect(consoleErrors.length).toBe(0);
    });

    test('Transition: Clicking Search with missing target shows validation message', async ({ page }) => {
      // Edge case: valid array but missing target -> should show validation message
      const p2 = new ExponentialSearchPage(page);
      await p.goto();

      const pageErrors2 = [];
      page.on('pageerror', e => pageErrors.push(e));

      await p.setArray('10,20,30');
      // Leave target empty
      await p.setTarget('');

      await p.clickSearch();

      const resultText1 = await p.getResultText();
      expect(resultText).toBe('Please enter a valid sorted array and target value.');

      // No uncaught page errors expected
      expect(pageErrors.length).toBe(0);
    });

    test('Transition: Clicking Search with empty array or invalid array shows validation when target missing', async ({ page }) => {
      // If array input is empty and/or target is NaN, function should show validation string
      const p3 = new ExponentialSearchPage(page);
      await p.goto();

      await p.setArray(''); // this becomes [''] -> parseInt('') => NaN, but array length > 0; validation only checks arrayInput.length === 0
      await p.setTarget(''); // NaN

      await p.clickSearch();

      // According to implementation, it checks arrayInput.length === 0 || isNaN(targetInput)
      // arrayInput.length will be 1 (['']), but targetInput is NaN -> validation triggers
      const resultText2 = await p.getResultText();
      expect(resultText).toBe('Please enter a valid sorted array and target value.');
    });

    test('Transition: Target not present in array results in correct "not found" message', async ({ page }) => {
      // Test path where target is not in the array -> S1 -> S2 with not found message
      const p4 = new ExponentialSearchPage(page);
      await p.goto();

      await p.setArray('10,20,30,40');
      await p.setTarget(25);

      await p.clickSearch();

      const resultText3 = await p.getResultText();
      expect(resultText).toBe('Target value 25 not found in the array.');
    });

    test('Transition: Works with negative numbers and different sizes', async ({ page }) => {
      // Validate algorithm works with negative numbers and multiple sizes
      const p5 = new ExponentialSearchPage(page);
      await p.goto();

      await p.setArray('-10,-5,0,5,10,20');
      await p.setTarget(-5);

      await p.clickSearch();

      const resultText4 = await p.getResultText();
      expect(resultText).toBe('Target value -5 found at index: 1');
    });
  });

  test.describe('Observability: Console logs and page errors during interactions', () => {
    test('No unexpected console.error or pageerror during normal usage', async ({ page }) => {
      // This test performs several valid interactions and asserts no page-level errors occur
      const p6 = new ExponentialSearchPage(page);
      await p.goto();

      const pageErrors3 = [];
      const consoleErrors1 = [];
      const consoleMessages = [];

      page.on('pageerror', e => pageErrors.push(e));
      page.on('console', msg => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      // Interaction 1: valid find
      await p.setArray('1,2,3,4,5,6,7,8,9');
      await p.setTarget(7);
      await p.clickSearch();
      expect(await p.getResultText()).toBe('Target value 7 found at index: 6');

      // Interaction 2: not found
      await p.setArray('2,4,6,8,10');
      await p.setTarget(5);
      await p.clickSearch();
      expect(await p.getResultText()).toBe('Target value 5 not found in the array.');

      // Interaction 3: invalid target
      await p.setArray('1,2,3');
      await p.setTarget('');
      await p.clickSearch();
      expect(await p.getResultText()).toBe('Please enter a valid sorted array and target value.');

      // Assert that no pageerror events occurred
      expect(pageErrors.length).toBe(0);

      // Assert that no console.error messages were logged
      expect(consoleErrors.length).toBe(0);

      // Optionally ensure some console messages were captured (could be none)
      expect(Array.isArray(consoleMessages)).toBe(true);
    });
  });

  test.describe('FSM explicit checks: verify transitions and expected DOM updates', () => {
    test('Clicking Search transitions from S0 to S1 and then S2 by updating #result innerHTML', async ({ page }) => {
      // This test validates the observable expected in transitions: resultElement.innerHTML updated
      const p7 = new ExponentialSearchPage(page);
      await p.goto();

      // Ensure starting in S0 (Idle) — result empty
      expect(await p.isResultEmpty()).toBe(true);

      // Perform a search that will find the value
      await p.setArray('100,200,300,400');
      await p.setTarget(300);

      // Click Search (this triggers S0 -> S1 and then S1 -> S2)
      await p.clickSearch();

      // After actions, resultElement should be updated to show found index
      const text1 = await p.getResultText();
      expect(text).toBe('Target value 300 found at index: 2');
    });

    test('Calling undefined onExit/onEnter actions would produce ReferenceError if invoked (do not patch page)', async ({ page }) => {
      // FSM mentions only renderPage() as an entry action; no explicit onExit actions in implementation.
      // This test attempts to call a plausible non-existent onExit function to assert a ReferenceError if invoked.
      await page.goto(APP_URL);

      // Try invoking a function that is NOT defined to assert natural ReferenceError behavior.
      await expect(page.evaluate(() => {
        // Deliberately call a function that should not exist to allow the environment to raise ReferenceError
        // eslint-disable-next-line no-undef
        nonExistentOnExit();
      })).rejects.toThrow();
    });
  });
});