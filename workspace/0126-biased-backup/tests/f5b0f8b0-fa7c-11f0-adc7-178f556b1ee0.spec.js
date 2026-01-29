import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b0f8b0-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object Model for the Binary Search demo page
class BinarySearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.heading = page.locator('h1');
    this.explanation = page.locator('#binary-search-explanation');
    this.demoButton = page.locator('#binary-search-demo-button');
    this.algorithmDiv = page.locator('#binary-search-algorithm');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickRunDemo() {
    await this.demoButton.click();
  }

  async getExplanationText() {
    return this.explanation.innerText();
  }

  // Evaluate the binarySearch function in the page context
  async binarySearchEvaluate(arr, target) {
    return await this.page.evaluate(
      ({ arr, target }) => {
        // Call the existing binarySearch function defined in the page
        // Do not redefine or patch anything - call as-is.
        return binarySearch(arr, target);
      },
      { arr, target }
    );
  }
}

test.describe('Binary Search Interactive Application (FSM validation)', () => {
  // Arrays to collect console messages and page errors per test
  let consoleEvents;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleEvents = [];
    pageErrors = [];

    // Capture console messages and page errors to validate expected logs and ensure no unexpected runtime errors
    page.on('console', (msg) => {
      // store type and text for assertions
      consoleEvents.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // store error messages for assertions
      pageErrors.push(err.message);
    });
  });

  test('Idle state renders correctly on initial load', async ({ page }) => {
    // What this test validates:
    // - The page loads to the Idle state (S0_Idle)
    // - The Run Binary Search Demo button is present
    // - The explanation paragraph is empty on load (entry action renderPage() in FSM may be descriptive; we assert DOM state)
    // - No runtime page errors occur during initial load
    const bsPage = new BinarySearchPage(page);
    await bsPage.goto();

    // Basic structure assertions
    await expect(bsPage.heading).toHaveText('Binary Search');
    await expect(bsPage.demoButton).toBeVisible();
    await expect(bsPage.demoButton).toHaveText('Run Binary Search Demo');
    // The explanation paragraph should be empty initially (Idle state evidence)
    const explanationText = await bsPage.getExplanationText();
    expect(explanationText.trim()).toBe('');

    // Ensure algorithm div exists (though not populated in this implementation)
    await expect(bsPage.algorithmDiv).toBeVisible();

    // No page errors should have been emitted during load
    expect(pageErrors).toEqual([]);
    // There may be console messages (e.g., browsers may log), but ensure there are no console.error type messages
    const consoleErrors = consoleEvents.filter((c) => c.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('RunDemo transition displays explanation and logs the result', async ({ page }) => {
    // What this test validates:
    // - Clicking the Run Binary Search Demo button triggers the RunDemo event
    // - The explanation paragraph is populated with the binary search explanation (S1_ExplanationDisplayed)
    // - The demo performs a binary search and logs the target-found message to the console
    // - No uncaught page errors occur during the demo
    const bsPage = new BinarySearchPage(page);
    await bsPage.goto();

    // Click the demo button which should:
    // - run binarySearch(arr, target)
    // - log "Target 23 found at index 5"
    // - call binarySearchExplanation() which sets innerHTML of the explanation paragraph
    await bsPage.clickRunDemo();

    // Wait for the explanation paragraph to contain expected textual content
    await expect(bsPage.explanation).toContainText('Binary Search is an efficient algorithm');

    const explanationText = (await bsPage.getExplanationText()).trim();
    expect(explanationText.length).toBeGreaterThan(50); // should contain a substantial explanation

    // Check console messages for the target found log
    // It's possible other console messages exist; ensure at least one contains the expected message
    const foundMessages = consoleEvents
      .map((c) => c.text)
      .filter((t) => t.includes('Target 23 found at index'));

    // Expect exactly one such message from a single click
    expect(foundMessages.length).toBeGreaterThanOrEqual(1);
    // Validate expected exact message appears
    expect(foundMessages.some((m) => m.includes('Target 23 found at index 5'))).toBe(true);

    // Ensure no runtime page errors happened
    expect(pageErrors).toEqual([]);
  });

  test('Clicking multiple times: explanation replaced and console logs increase accordingly', async ({ page }) => {
    // What this test validates:
    // - FSM transition is repeatable: clicking the RunDemo button multiple times keeps transitioning to ExplanationDisplayed
    // - The explanation content remains present and is overwritten (not duplicated) each time
    // - Console logs are emitted on each click showing the search result
    const bsPage = new BinarySearchPage(page);
    await bsPage.goto();

    // Click twice and capture console messages
    await bsPage.clickRunDemo();
    await bsPage.clickRunDemo();

    // After two clicks, the explanation should still contain expected phrase
    await expect(bsPage.explanation).toContainText('Binary Search is an efficient algorithm');

    // The explanation after second click should still be substantive
    const explanationTextAfter = (await bsPage.getExplanationText()).trim();
    expect(explanationTextAfter.length).toBeGreaterThan(50);

    // Count the number of target-found logs in consoleEvents
    const numFoundLogs = consoleEvents
      .map((c) => c.text)
      .filter((t) => t.includes('Target 23 found at index 5')).length;

    // Expect at least two logs for two clicks (some environments may coalesce logs differently, so check >= 2)
    expect(numFoundLogs).toBeGreaterThanOrEqual(2);

    // No runtime page errors should have occurred
    expect(pageErrors).toEqual([]);
  });

  test('binarySearch function correctness and edge cases via direct evaluation', async ({ page }) => {
    // What this test validates:
    // - The binarySearch implementation behaves correctly for:
    //   * An element that exists (should return valid index)
    //   * An element that does not exist (should return -1)
    //   * Single-element arrays
    // - Calling binarySearch via evaluate does not modify the explanation element implicitly
    const bsPage = new BinarySearchPage(page);
    await bsPage.goto();

    // Confirm explanation is empty initially
    expect((await bsPage.getExplanationText()).trim()).toBe('');

    // Positive case: target 23 in provided array
    const arr = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91];
    const idx = await bsPage.binarySearchEvaluate(arr, 23);
    expect(idx).toBe(5);

    // Negative case: target not present
    const idxNotFound = await bsPage.binarySearchEvaluate(arr, 100);
    expect(idxNotFound).toBe(-1);

    // Edge: single-element array where target is present
    const singlePresent = await bsPage.binarySearchEvaluate([42], 42);
    expect(singlePresent).toBe(0);

    // Edge: single-element array where target is not present
    const singleAbsent = await bsPage.binarySearchEvaluate([42], 7);
    expect(singleAbsent).toBe(-1);

    // Ensure calling binarySearch directly did not populate explanation (since binarySearch shouldn't touch DOM)
    expect((await bsPage.getExplanationText()).trim()).toBe('');

    // No runtime errors from direct evaluation or page execution
    expect(pageErrors).toEqual([]);
  });

  test('Sanity check: verify no unexpected ReferenceError/SyntaxError/TypeError on load or interactions', async ({ page }) => {
    // What this test validates:
    // - Observes any runtime errors emitted by the page (ReferenceError, SyntaxError, TypeError, etc.)
    // - Asserts that there are no such errors in normal operation of this page
    const bsPage = new BinarySearchPage(page);
    await bsPage.goto();

    // Perform normal interaction
    await bsPage.clickRunDemo();

    // Confirm explanation present
    await expect(bsPage.explanation).toContainText('Binary Search is an efficient algorithm');

    // Collect any page errors captured during this flow
    // If there were any ReferenceError/SyntaxError/TypeError they would be present in pageErrors
    // We assert none are present.
    expect(pageErrors.length).toBe(0);
  });
});