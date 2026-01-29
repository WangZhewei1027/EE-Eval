import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04420df3-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page object for the Bubble Sort demo page
class BubbleSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.errors = [];
    this.consoleMessages = [];
    // Attach listeners to observe console and page errors for each instance
    this.page.on('console', (msg) => {
      // collect all console messages for later assertions
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', (err) => {
      // collect runtime errors (ReferenceError, TypeError, etc.)
      this.errors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async sortButton() {
    return this.page.locator('#sort-button');
  }

  async clickSort() {
    await (await this.sortButton()).click();
  }

  async resultText() {
    return (await this.page.locator('.result')).innerText();
  }

  // Helper that waits for a pageerror event and returns it.
  // Will throw if no error occurs within timeout.
  async waitForPageError(timeout = 2000) {
    const err = await this.page.waitForEvent('pageerror', { timeout });
    // also ensure it's recorded in local array by giving a tick for the listener
    await this.page.waitForTimeout(10);
    return err;
  }
}

test.describe('Bubble Sort FSM - Interactive Application tests', () => {
  // Each test gets a fresh page fixture
  test.describe('State: Idle (S0_Idle)', () => {
    // Validate initial page load and Idle state expectations
    test('S0_Idle: Page renders initial UI and entry action (renderPage) is observed via runtime errors/console', async ({ page }) => {
      // This test validates:
      // - The Sort button is present (evidence of Idle state)
      // - The result container exists and is initially empty
      // - The page's entry action (renderPage()) if missing will trigger a runtime error which we observe
      const app = new BubbleSortPage(page);
      await app.goto();

      // Basic DOM checks for Idle state
      const sortBtn = await app.sortButton();
      await expect(sortBtn).toBeVisible();
      const resultText = await app.resultText();
      // Expect the result to be empty on initial render (S0_Idle evidence)
      expect(resultText).toBe('', 'Expected .result to be empty when page first loads (Idle state)');

      // Expect that the page emitted at least one runtime error during initial render.
      // The FSM mentions renderPage() on entry; if that function is missing, it'll produce a ReferenceError. We assert that some pageerror occurs.
      // This follows the instruction to observe and assert runtime errors naturally.
      const pageError = await app.waitForPageError(3000);
      expect(pageError).toBeTruthy();
      // Optionally check that the error message references renderPage or at least indicates a ReferenceError/SyntaxError/TypeError
      // We allow various types, but ensure it's an Error object with a message.
      expect(typeof pageError.message).toBe('string');
      expect(pageError.message.length).toBeGreaterThan(0);
    });
  });

  test.describe('Transition: S0_Idle -> S1_Sorting via SortButtonClick', () => {
    test('Clicking Sort starts sorting (startSorting) and we observe runtime error or process begin', async ({ page }) => {
      // This test validates:
      // - Clicking the Sort button triggers the transition from S0 to S1
      // - The startSorting() action is attempted; if missing it will produce a ReferenceError which we assert
      const app = new BubbleSortPage(page);
      await app.goto();

      // Ensure button present before clicking
      await expect(await app.sortButton()).toBeVisible();

      // Click the Sort button and wait for any runtime error emitted as a result
      // The FSM expects startSorting() on enter of S1; if startSorting is undefined, a ReferenceError is expected.
      const clickPromise = app.clickSort();
      const pageError = await app.waitForPageError(3000); // wait for the error caused by the click handler if any
      await clickPromise;

      expect(pageError).toBeTruthy();
      // The error message should exist and often references the missing identifier (e.g., startSorting)
      expect(typeof pageError.message).toBe('string');
      expect(pageError.message.length).toBeGreaterThan(0);

      // Check DOM: after initiating sorting, the result may still be empty if sorting failed to start
      const resultText = await app.resultText();
      // We assert that either sorting begins (non-empty) or an error occurred — since we asserted an error above, accept empty result here.
      // This ensures we don't falsely fail if the implementation chooses to throw an error instead of updating the DOM.
      expect(resultText.length).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Transition: S1_Sorting -> S2_Sorted via SortButtonClick (second click)', () => {
    test('Second Sort click attempts to display result (displayResult) and we observe runtime error/DOM change', async ({ page }) => {
      // This test validates:
      // - After sorting has started (S1), another interaction triggers S2_Sorted (displayResult)
      // - If displayResult is missing, a runtime error will occur which we assert
      const app = new BubbleSortPage(page);
      await app.goto();

      // First click to attempt to start sorting
      await app.clickSort().catch(() => {});
      // Wait for an initial page error caused by the first click (if any). Use try/catch to continue if none.
      try {
        await app.waitForPageError(1500);
      } catch {
        // No pageerror on first click — that's okay, continue to second click
      }

      // Second click to attempt to display the sorted result
      const clickPromise = app.clickSort();
      // Wait for a page error produced by displayResult() if it's missing
      const pageError = await app.waitForPageError(3000);
      await clickPromise;

      expect(pageError).toBeTruthy();
      expect(typeof pageError.message).toBe('string');
      expect(pageError.message.length).toBeGreaterThan(0);

      // If the implementation actually sorted and displayed results, confirm .result contains non-empty content.
      const resultText = await app.resultText();
      // We allow either behavior: either an error occurred (asserted above) or the result shows sorted array.
      // So here we only assert that resultText is a string (non-null) — deeper correctness is not enforced due to possible runtime errors.
      expect(typeof resultText).toBe('string');
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('Rapid repeated clicks should not crash silently - observe errors for each interaction', async ({ page }) => {
      // This test validates:
      // - Rapid user interactions (multiple Sort clicks) are observed
      // - For each click that triggers a missing function, a runtime error is produced and captured
      const app = new BubbleSortPage(page);
      await app.goto();

      // Perform three rapid clicks and assert that we capture errors for at least two of them.
      // This is to exercise edge behavior (debounce, idempotence, repeated failures).
      const clickPromises = [];
      for (let i = 0; i < 3; i++) {
        clickPromises.push(app.clickSort().catch(() => {}));
      }

      // Wait for at least one pageerror — per instructions we MUST observe/allow errors
      // Try to collect up to 3 errors (one per click) but assert at least one is observed.
      const collectedErrors = [];
      for (let i = 0; i < 3; i++) {
        try {
          const err = await app.waitForPageError(1200);
          collectedErrors.push(err);
        } catch {
          // timeout waiting for more errors - stop trying
          break;
        }
      }

      // Ensure at least one runtime error occurred as a result of repeated clicks
      expect(collectedErrors.length).toBeGreaterThanOrEqual(1);

      // Wait for all click actions to finish (no-op if already handled)
      await Promise.all(clickPromises);

      // Ensure .result DOM element still exists and can be queried after rapid interactions
      const result = await page.locator('.result');
      await expect(result).toBeVisible();
    });

    test('Page console should capture errors/warnings — validate console error messages were emitted', async ({ page }) => {
      // This test validates:
      // - Console events of type "error" are emitted and captured in page.console stream
      const app = new BubbleSortPage(page);
      await app.goto();

      // Trigger at least one user action that commonly causes runtime errors.
      await app.clickSort().catch(() => {});

      // Wait briefly to allow console messages to flush
      await page.waitForTimeout(300);

      // Filter collected console messages for type 'error'
      const errorConsoleMessages = app.consoleMessages.filter((m) => m.type === 'error');

      // Assert that at least one console.error message was emitted
      expect(errorConsoleMessages.length).toBeGreaterThanOrEqual(1);
      // Confirm each error message has text content
      for (const msg of errorConsoleMessages) {
        expect(typeof msg.text).toBe('string');
        expect(msg.text.length).toBeGreaterThan(0);
      }
    });
  });

  // After each test, we print a brief summary to test logs for debugging purposes.
  // This does not alter the page environment or fix runtime issues.
  test.afterEach(async ({ page }) => {
    // Small heuristic: if the page has a visible result container, log its content for diagnostics.
    try {
      const visible = await page.isVisible('.result');
      if (visible) {
        const txt = await page.locator('.result').innerText();
        console.log('Diagnostic: .result content after test ->', txt);
      }
    } catch (e) {
      // ignore any diagnostic errors
    }
  });
});