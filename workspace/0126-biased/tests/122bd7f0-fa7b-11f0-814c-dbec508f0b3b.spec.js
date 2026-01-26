import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122bd7f0-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object for the Interpolation Search app
class InterpolationSearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.searchButton = page.locator('#search-button');
    this.interpolationButton = page.locator('#interpolation-button');
    this.searchInput = page.locator('#search-input');
    this.searchType = page.locator('#search-type');
    this.resultDiv = page.locator('#result');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillInput(value) {
    await this.searchInput.fill(value);
  }

  async clickSearchButton() {
    await this.searchButton.click();
  }

  async clickInterpolationButton() {
    await this.interpolationButton.click();
  }

  async selectSearchType(value) {
    await this.searchType.selectOption(value);
  }

  async getResultText() {
    return await this.resultDiv.innerText();
  }
}

test.describe('Interpolation Search App - FSM Tests (Application ID: 122bd7f0-fa7b-11f0-814c-dbec508f0b3b)', () => {
  // Capture console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Collect uncaught errors from the page
    page.on('pageerror', error => {
      pageErrors.push(error);
    });
  });

  test.afterEach(async ({ page }) => {
    // Optionally clear listeners by navigating away to avoid noise between tests
    await page.goto('about:blank');
  });

  test.describe('S0_Idle (Initial State) validations', () => {
    test('Idle state: initial DOM renders expected components', async ({ page }) => {
      // Validate the initial page renders and shows expected components
      const app = new InterpolationSearchPage(page);
      await app.goto();

      // Validate existence of primary elements
      await expect(app.searchButton).toBeVisible();
      await expect(app.searchInput).toBeVisible();
      await expect(app.searchType).toBeVisible();
      await expect(app.interpolationButton).toBeVisible();
      await expect(app.resultDiv).toBeVisible();

      // Validate placeholder and select default
      await expect(app.searchInput).toHaveAttribute('placeholder', 'Enter search term');
      await expect(app.searchType).toHaveValue('linear');

      // No page errors should occur on initial render (sanity check)
      expect(pageErrors.length).toBe(0);
    });

    test('Selecting a search type updates the select value (expected interaction)', async ({ page }) => {
      // This test validates the "User selects search type" interaction from the FSM
      const app = new InterpolationSearchPage(page);
      await app.goto();

      // Change select to interpolation and assert the value updates
      await app.selectSearchType('interpolation');
      await expect(app.searchType).toHaveValue('interpolation');

      // Changing select does not produce errors by itself
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transitions and active states (S1_LinearSearch, S2_InterpolationSearch)', () => {
    test('Transition S0 -> S1 (Search button click) - Found case should set result before the page error', async ({ page }) => {
      // This validates clicking the linear search button (SearchLinearClick event)
      // and ensures the searchLinear entry action runs (it will produce a runtime ReferenceError
      // due to a bug in the page code). We assert the ReferenceError occurs and that the DOM
      // was updated prior to the error in the "found" scenario.
      const app = new InterpolationSearchPage(page);
      await app.goto();

      // Use an input that will match the first mid (50) so the function writes "Found 50 at index 50"
      await app.fillInput('50');

      // Wait for the uncaught page error that the implementation will generate
      const [error] = await Promise.all([
        page.waitForEvent('pageerror'),
        app.clickSearchButton()
      ]);

      // The implementation incorrectly references "mid" outside its scope causing a ReferenceError.
      // Assert that an uncaught reference error occurred and mentions 'mid' or 'not defined'
      expect(error).toBeTruthy();
      const msg = error.message || String(error);
      expect(msg.toLowerCase()).toContain('mid');

      // Even though an error occurred after the inner logic, the earlier assignment to resultDiv
      // (inside the loop when it found the value) should have taken effect.
      const resultText = await app.getResultText();
      expect(resultText).toContain('Found 50 at index 50');
    });

    test('Transition S0 -> S1 (Search button click) - Not found case results in an error and no result text', async ({ page }) => {
      // Validate the behavior when the target is not found. The implementation attempts to set
      // "Not found at index ${mid}" AFTER the loop, but due to a scoping bug it throws before
      // assigning. We expect a page error and that the result remains empty.
      const app = new InterpolationSearchPage(page);
      await app.goto();

      // Provide an input that will not match any mid value encountered
      await app.fillInput('999');

      const [error] = await Promise.all([
        page.waitForEvent('pageerror'),
        app.clickSearchButton()
      ]);

      expect(error).toBeTruthy();
      const msg = error.message || String(error);
      expect(msg.toLowerCase()).toContain('mid');

      // Because the code throws before assigning the "Not found" message, result should be empty
      const resultText = await app.getResultText();
      expect(resultText).toBe(''); // initial state was empty
    });

    test('Transition S0 -> S2 (Interpolation button click) - empty input edge case produces error and no result', async ({ page }) => {
      // Validates clicking the interpolation search button (InterpolationSearchClick event).
      // The implementation will run and eventually throw a ReferenceError similar to linear search.
      const app = new InterpolationSearchPage(page);
      await app.goto();

      // Empty input is a valid edge case
      await app.fillInput('');

      const [error] = await Promise.all([
        page.waitForEvent('pageerror'),
        app.clickInterpolationButton()
      ]);

      expect(error).toBeTruthy();
      const msg = error.message || String(error);
      // It should indicate a problem with 'mid' (scoped variable referenced after loop)
      expect(msg.toLowerCase()).toContain('mid');

      // The interpolation implementation is unlikely to have updated the result div before the error.
      const resultText = await app.getResultText();
      expect(resultText).toBe('');
    });

    test('Transition S0 -> S2 (Interpolation button click) - long input edge case still results in a page error', async ({ page }) => {
      // Test with a very long input string to exercise edge-case behavior inside interpolation logic.
      const app = new InterpolationSearchPage(page);
      await app.goto();

      // Long input
      const longInput = 'a'.repeat(1000);
      await app.fillInput(longInput);

      const [error] = await Promise.all([
        page.waitForEvent('pageerror'),
        app.clickInterpolationButton()
      ]);

      expect(error).toBeTruthy();
      const msg = error.message || String(error);
      expect(msg.toLowerCase()).toContain('mid');

      const resultText = await app.getResultText();
      expect(resultText).toBe('');
    });

    test('Rapid consecutive clicks on Search produce at least one uncaught page error (robustness)', async ({ page }) => {
      // This validates how the application handles rapid user interactions (multiple clicks).
      const app = new InterpolationSearchPage(page);
      await app.goto();

      await app.fillInput('123');

      // Rapidly trigger the click multiple times; we listen for the first pageerror(s).
      const errorPromises = [];
      // We attempt to collect up to 3 pageerror events (if they occur)
      for (let i = 0; i < 3; i++) {
        errorPromises.push(page.waitForEvent('pageerror').catch(() => null));
        // click without awaiting to simulate rapid clicks
        app.clickSearchButton().catch(() => null);
      }

      // Wait for at least one of the pageerror promises to resolve
      const results = await Promise.all(errorPromises);
      const capturedErrors = results.filter(Boolean);

      // There should be at least one uncaught error due to the implementation bug
      expect(capturedErrors.length).toBeGreaterThanOrEqual(1);
      // And each captured error should mention "mid"
      for (const err of capturedErrors) {
        const msg = err.message || String(err);
        expect(msg.toLowerCase()).toContain('mid');
      }
    });
  });

  test.describe('Error observation and evidence of entry/exit actions', () => {
    test('Clicking search buttons triggers the corresponding search functions (observed via uncaught errors)', async ({ page }) => {
      // This test asserts that clicking each button triggers the expected JS function to run.
      // Because the implementation's functions have a bug that leads to a ReferenceError,
      // observing that error is evidence the function executed.
      const app = new InterpolationSearchPage(page);
      await app.goto();

      // Linear search click
      const linearErrorPromise = page.waitForEvent('pageerror');
      await app.fillInput('50');
      await app.clickSearchButton();
      const linearError = await linearErrorPromise;
      expect(linearError).toBeTruthy();
      expect((linearError.message || '').toLowerCase()).toContain('mid');

      // Interpolation search click
      const interpErrorPromise = page.waitForEvent('pageerror');
      await app.fillInput('test');
      await app.clickInterpolationButton();
      const interpError = await interpErrorPromise;
      expect(interpError).toBeTruthy();
      expect((interpError.message || '').toLowerCase()).toContain('mid');
    });

    test('Console messages captured during interactions (if any) are recorded for debugging', async ({ page }) => {
      // This test demonstrates we are observing console output; there is no requirement that the app logs,
      // only that we are capturing any messages for traceability.
      const app = new InterpolationSearchPage(page);
      await app.goto();

      // Trigger actions that produce errors
      const p1 = page.waitForEvent('pageerror').catch(() => null);
      await app.fillInput('1');
      await app.clickSearchButton();
      await p1;

      // Ensure we collected console messages (may be zero) and page errors (should be >=1)
      expect(Array.isArray(consoleMessages)).toBe(true);
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    });
  });
});