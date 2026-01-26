import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324fd0c0-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object Model for the Dynamic Typing demo page
class DynamicTypingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = "button[onclick='demonstrateDynamicTyping()']";
    this.resultSelector = '#result';
    this.resultParagraphs = `${this.resultSelector} p`;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getButton() {
    return this.page.locator(this.buttonSelector);
  }

  async clickDemonstrate() {
    await this.page.click(this.buttonSelector);
  }

  async getResultParagraphCount() {
    return this.page.locator(this.resultParagraphs).count();
  }

  async getResultParagraphTexts() {
    const locator = this.page.locator(this.resultParagraphs);
    const count = await locator.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push(await locator.nth(i).innerText());
    }
    return texts;
  }

  async clearResultIfAny() {
    // The page function clears results on each click; this helper ensures an initial clean state
    const count = await this.getResultParagraphCount();
    if (count > 0) {
      // navigate away and back as a safe way to ensure reset if needed
      await this.page.reload();
      await this.page.waitForSelector(this.buttonSelector);
    }
  }
}

test.describe('Dynamic Typing Demonstration - FSM tests (Application ID: 324fd0c0-fa73-11f0-a9d0-d7a1991987c6)', () => {
  let page;
  let dynamicPage;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    // Create a new context/page for each test to isolate console/pageerror events
    const context = await browser.newContext();
    page = await context.newPage();
    dynamicPage = new DynamicTypingPage(page);

    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for later assertions
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await dynamicPage.goto();
    // Ensure page loaded and main elements exist
    await expect(page.locator('h1')).toHaveText(/Dynamic Typing in JavaScript/i);
    await page.waitForSelector(dynamicPage.buttonSelector);
    await page.waitForSelector(dynamicPage.resultSelector);
  });

  test.afterEach(async () => {
    // Close the page's context to cleanup listeners and resources
    await page.context().close();
  });

  test('S0_Idle: initial state - button present and result div is empty', async () => {
    // This test validates the initial (Idle) state S0_Idle:
    // - The "Demonstrate Dynamic Typing" button exists and is visible
    // - The result div is present and initially empty
    const button = await dynamicPage.getButton();
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Demonstrate Dynamic Typing');

    // Result div should contain no paragraphs before any interaction
    await expect(page.locator(dynamicPage.resultParagraphs)).toHaveCount(0);

    // Assert no console error messages or page errors occurred during initial load
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_Demonstrating: clicking button displays all dynamic typing results', async () => {
    // This test validates the transition triggered by the DemonstrateDynamicTyping event:
    // - Clicking the button invokes demonstrateDynamicTyping() (entry action)
    // - The result div is cleared and then updated with six paragraphs showing values and types
    await dynamicPage.clickDemonstrate();

    // Wait for the expected 6 paragraphs to appear
    await expect(page.locator(dynamicPage.resultParagraphs)).toHaveCount(6);

    const texts = await dynamicPage.getResultParagraphTexts();

    // Validate each line's content and type text
    // Use innerText based assertions for readability/robustness
    expect(texts[0]).toBe('After assigning a number: 5 (number)');
    expect(texts[1]).toBe('After assigning a string: Hello, world! (string)');
    expect(texts[2]).toBe('After assigning a boolean: true (boolean)');
    // Arrays are stringified via default toString -> "1,2,3" and typeof yields "object"
    expect(texts[3]).toBe('After assigning an array: 1,2,3 (object)');
    // Objects are JSON.stringified
    expect(texts[4]).toBe('After assigning an object: {"key":"value"} (object)');
    // null displays 'null' but typeof null is 'object'
    expect(texts[5]).toBe('After assigning null: null (object)');

    // Ensure no runtime pageerrors (uncaught exceptions) occurred during the demonstration
    const criticalPageErrors = pageErrors.filter(err => {
      const msg = String(err?.message || err);
      return /ReferenceError|SyntaxError|TypeError/.test(msg);
    });
    expect(criticalPageErrors.length).toBe(0);

    // Also assert no console.error messages were emitted during the demo run
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('OnEnter/Entry action observed: demonstrateDynamicTyping effectively run on click (clears previous results)', async () => {
    // This test validates the "entry action" behavior described in the FSM:
    // demonstrateDynamicTyping clears previous results and re-populates them.
    // Click once and assert 6 results, click again and ensure still 6 (not appended duplicates)
    await dynamicPage.clickDemonstrate();
    await expect(page.locator(dynamicPage.resultParagraphs)).toHaveCount(6);

    const firstRun = await dynamicPage.getResultParagraphTexts();

    // Click again to invoke the function a second time
    await dynamicPage.clickDemonstrate();
    await expect(page.locator(dynamicPage.resultParagraphs)).toHaveCount(6);

    const secondRun = await dynamicPage.getResultParagraphTexts();

    // The content after the second click should match the first run (function resets and re-runs)
    expect(secondRun).toEqual(firstRun);
  });

  test('Edge cases and robustness: multiple rapid clicks and verifying stable state', async () => {
    // This test simulates an edge case: user rapidly clicks the button multiple times.
    // The function is synchronous, but UI should remain stable and not accumulate duplicate results.
    // Rapidly click 3 times, then wait for results and ensure exactly 6 paragraphs.
    await Promise.all([
      dynamicPage.clickDemonstrate(),
      dynamicPage.clickDemonstrate(),
      dynamicPage.clickDemonstrate()
    ]);

    // After rapid clicks, ensure the final DOM is consistent: exactly 6 paragraphs
    await expect(page.locator(dynamicPage.resultParagraphs)).toHaveCount(6);

    const texts = await dynamicPage.getResultParagraphTexts();
    // Basic sanity checks on content presence
    expect(texts[0]).toContain('After assigning a number:');
    expect(texts[1]).toContain('After assigning a string:');
    expect(texts[2]).toContain('After assigning a boolean:');
    expect(texts[3]).toContain('After assigning an array:');
    expect(texts[4]).toContain('After assigning an object:');
    expect(texts[5]).toContain('After assigning null:');

    // Ensure no uncaught page errors or console errors occurred as a result of rapid clicking
    const runtimeErrors = pageErrors.filter(err => /ReferenceError|SyntaxError|TypeError/.test(String(err?.message || err)));
    expect(runtimeErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Negative check: ensure no ReferenceError/SyntaxError/TypeError occurred during entire test flow', async () => {
    // This test explicitly asserts that no critical JS runtime errors occurred during load and interactions.
    // Note: We collect pageErrors and console messages across the beforeEach and earlier interactions in this test context.
    // No interactions here other than verifying accumulated state; ensure arrays are empty of critical errors.

    // Trigger a demonstration to ensure we exercised the code paths
    await dynamicPage.clickDemonstrate();
    await expect(page.locator(dynamicPage.resultParagraphs)).toHaveCount(6);

    // Inspect pageErrors for JS runtime exceptions
    const criticalPageErrors = pageErrors.filter(err => {
      const msg = String(err?.message || err);
      return /ReferenceError|SyntaxError|TypeError/.test(msg);
    });
    // If any critical errors exist, fail the test with useful debugging info
    expect(criticalPageErrors.length, `Expected 0 critical runtime errors; found: ${criticalPageErrors.length}`).toBe(0);

    // Inspect console.error messages for signs of problems
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMessages.length, `Expected 0 console.error messages; found: ${consoleErrorMessages.length}`).toBe(0);
  });
});