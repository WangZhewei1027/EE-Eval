import { test, expect } from '@playwright/test';

// Page Object for the Exponential Search demo page
class ExponentialSearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b0f8b3-fa7c-11f0-adc7-178f556b1ee0.html';
    this.textButton = "button[onclick='exponentialSearchText()']";
    this.graphButton = "button[onclick='exponentialSearchGraph()']";
    this.h1 = 'h1';
  }

  async goto() {
    await this.page.goto(this.url, { waitUntil: 'load' });
  }

  async clickTextButton() {
    await this.page.click(this.textButton);
  }

  async clickGraphButton() {
    await this.page.click(this.graphButton);
  }

  async getTextButtonText() {
    return this.page.textContent(this.textButton);
  }

  async getGraphButtonText() {
    return this.page.textContent(this.graphButton);
  }

  // Evaluate a function in page context to check existence or return values
  async evaluate(fn) {
    return this.page.evaluate(fn);
  }
}

test.describe('Exponential Search - FSM states and transitions', () => {
  // Shared variables for capturing console messages and page errors
  let consoleMessages;
  let pageErrors;

  // Setup before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      // Push text for assertions
      try {
        consoleMessages.push(msg.text());
      } catch (e) {
        consoleMessages.push(String(msg));
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.describe('S0_Idle (Initial) state validations', () => {
    test('Idle: page loads and initial UI elements (two interface buttons) are present', async ({ page }) => {
      // Arrange
      const app = new ExponentialSearchPage(page);

      // Act
      await app.goto();

      // Assert: Page header exists
      await expect(page.locator(app.h1)).toHaveText('Exponential Search');

      // Assert: Text button is visible and has expected label
      const textBtnText = await app.getTextButtonText();
      expect(textBtnText).toBe('Exponential Search Text-Based Interface');

      // Assert: Graph button is visible and has expected label
      const graphBtnText = await app.getGraphButtonText();
      expect(graphBtnText).toBe('Exponential Search Graph-Based Interface');

      // Assert: No uncaught page errors during initial load
      expect(pageErrors.length).toBe(0);

      // Verify the FSM-specified entry action renderPage() is NOT defined on the page.
      // The FSM expects renderPage() on entry, but the implementation doesn't provide it.
      const hasRenderPage = await app.evaluate(() => typeof window.renderPage !== 'undefined');
      expect(hasRenderPage).toBe(false);
    });
  });

  test.describe('S1_TextInterface state and transition (ExponentialSearchText event)', () => {
    test('Transition: clicking Text-Based Interface invokes exponentialSearchText() and returns expected result', async ({ page }) => {
      // This test validates:
      // - Clicking the Text button triggers the exponentialSearchText function
      // - The function returns the correct index for the hard-coded array/target (expected 5)
      // - No console output is produced by exponentialSearchText (it returns a value)
      const app = new ExponentialSearchPage(page);
      await app.goto();

      // Ensure function exists on the page
      const hasFunction = await app.evaluate(() => typeof window.exponentialSearchText === 'function');
      expect(hasFunction).toBe(true);

      // Click the UI button which calls exponentialSearchText()
      await app.clickTextButton();

      // Small pause to allow any (unexpected) async logs or errors to surface
      await page.waitForTimeout(100);

      // Assert: exponentialSearchText invoked directly returns 5 (the expected index)
      const result = await app.evaluate(() => {
        // Call the function directly and return its result for verification
        try {
          return { type: 'ok', value: exponentialSearchText() };
        } catch (err) {
          return { type: 'error', message: String(err) };
        }
      });

      // The implementation uses an array and a hashTable and should find target 5 at index 5.
      expect(result.type).toBe('ok');
      expect(result.value).toBe(5);

      // Clicking the button triggers the same function; since it returns a value (but doesn't log),
      // we expect no console messages produced by the click.
      // If any console output was produced by other parts of the page, it would appear here.
      expect(consoleMessages.length).toBe(0);

      // No uncaught page errors should have occurred during this interaction
      expect(pageErrors.length).toBe(0);

      // Re-clicking the button should behave identically (idempotent for this demo)
      await app.clickTextButton();
      await page.waitForTimeout(50);
      const secondResult = await app.evaluate(() => exponentialSearchText());
      expect(secondResult).toBe(5);
    });

    test('Edge case: exponentialSearchText exists and uses the global hashTable (array of length 100)', async ({ page }) => {
      // Validate that the global hashTable is present and has expected characteristics
      const app = new ExponentialSearchPage(page);
      await app.goto();

      const hashTableInfo = await app.evaluate(() => {
        return {
          defined: typeof window.hashTable !== 'undefined',
          isArray: Array.isArray(window.hashTable),
          length: window.hashTable ? window.hashTable.length : null,
          sampleAt5: window.hashTable ? window.hashTable[5] : null
        };
      });

      expect(hashTableInfo.defined).toBe(true);
      expect(hashTableInfo.isArray).toBe(true);
      expect(hashTableInfo.length).toBe(100);
      expect(hashTableInfo.sampleAt5).toBe(5);
    });
  });

  test.describe('S2_GraphInterface state and transition (ExponentialSearchGraph event)', () => {
    test('Transition: clicking Graph-Based Interface invokes exponentialSearchGraph() and logs expected messages', async ({ page }) => {
      // This test validates:
      // - Clicking the Graph button triggers exponentialSearchGraph()
      // - The graph implementation logs "Element found at index 5" and then "Element not found"
      //   (the demo has a logic flow that logs both messages)
      const app = new ExponentialSearchPage(page);
      await app.goto();

      // Ensure function exists on the page
      const hasFunction = await app.evaluate(() => typeof window.exponentialSearchGraph === 'function');
      expect(hasFunction).toBe(true);

      // Click the Graph UI button which calls exponentialSearchGraph()
      await app.clickGraphButton();

      // Wait briefly for console messages to arrive
      await page.waitForTimeout(200);

      // There should be console messages from the graph function.
      // We expect at least the two logs: found at index 5 and element not found (per implementation).
      const foundLog = consoleMessages.find((m) => /Element found at index\s*5/.test(m));
      const notFoundLog = consoleMessages.find((m) => /Element not found/.test(m));

      expect(foundLog).toBeTruthy();
      expect(notFoundLog).toBeTruthy();

      // No uncaught page errors should have occurred during this interaction
      expect(pageErrors.length).toBe(0);

      // Clicking again appends more logs; validate repeated interaction appends messages
      const initialCount = consoleMessages.length;
      await app.clickGraphButton();
      await page.waitForTimeout(200);
      expect(consoleMessages.length).toBeGreaterThan(initialCount);
      // Confirm at least one more 'Element found at index 5' was logged after the second click
      const occurrences = consoleMessages.filter((m) => /Element found at index\s*5/.test(m)).length;
      expect(occurrences).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe('General robustness and edge scenarios', () => {
    test('Functions remain present after interactions and the DOM is stable', async ({ page }) => {
      const app = new ExponentialSearchPage(page);
      await app.goto();

      // Interact with both buttons
      await app.clickTextButton();
      await app.clickGraphButton();
      await page.waitForTimeout(150);

      // Functions should still be present
      const exist = await app.evaluate(() => ({
        textFn: typeof exponentialSearchText === 'function',
        graphFn: typeof exponentialSearchGraph === 'function'
      }));
      expect(exist.textFn).toBe(true);
      expect(exist.graphFn).toBe(true);

      // Buttons still exist in the DOM and keep their labels
      expect(await app.getTextButtonText()).toBe('Exponential Search Text-Based Interface');
      expect(await app.getGraphButtonText()).toBe('Exponential Search Graph-Based Interface');

      // No unexpected page errors occurred
      expect(pageErrors.length).toBe(0);
    });

    test('Verify that the demo does not expose the FSM-specific renderPage function (onEnter action verification)', async ({ page }) => {
      // The FSM metadata listed renderPage() as an entry action for S0_Idle.
      // The implementation does not define renderPage. Confirm this is true (i.e., verify onEnter is not implemented).
      const app = new ExponentialSearchPage(page);
      await app.goto();

      const renderPageType = await app.evaluate(() => typeof window.renderPage);
      // We assert that renderPage is undefined so the FSM expectation is not implemented in the page.
      expect(renderPageType).toBe('undefined');
    });
  });

  // Teardown isn't strictly necessary because Playwright's page fixture cleans up between tests,
  // but we keep this hook for clarity if additional cleanup were required in future.
  test.afterEach(async ({ page }) => {
    // Provide helpful diagnostics in the test output if there were page errors.
    if (pageErrors.length > 0) {
      // This will show in Playwright's test output logs
      for (const err of pageErrors) {
        console.error('Captured pageerror:', err);
      }
    }

    // Also log console messages if useful for debugging failing tests
    if (consoleMessages.length > 0) {
      for (const msg of consoleMessages) {
        console.log('Captured console:', msg);
      }
    }
  });
});