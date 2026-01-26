import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b29712-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object for the Kruskal application
class KruskalPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonLocator = page.locator('.button');
    this.outputLocator = page.locator('#visualization-output');
    this.headingLocator = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getMainHeadingText() {
    return (await this.headingLocator.textContent())?.trim();
  }

  async buttonIsVisible() {
    return await this.buttonLocator.isVisible();
  }

  async clickShowVisualization() {
    await this.buttonLocator.click();
  }

  async getVisualizationInnerHTML() {
    return await this.outputLocator.innerHTML();
  }

  async getVisualizationHeaderText() {
    return (await this.outputLocator.locator('h3').textContent())?.trim();
  }

  async getVisualizationListItems() {
    return this.outputLocator.locator('ol > li');
  }

  async getButtonOnClickAttribute() {
    return await this.buttonLocator.getAttribute('onclick');
  }

  async typeofShowVisualization() {
    return await this.page.evaluate(() => typeof window.showVisualization);
  }
}

// Collect console and page errors for assertions
test.describe('Kruskal\'s Algorithm - FSM and UI tests', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];

    // Listen to console events
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Listen to page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err && err.message ? String(err.message) : String(err));
    });

    // Navigate to the app
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // detach listeners (cleanup) - Playwright will remove page on test teardown normally
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('Initial state S0_Idle: page renders main heading and button (evidence: <h1>Kruskal\'s Algorithm</h1>)', async ({ page }) => {
    // This test validates the initial idle state (S0_Idle) evidence:
    // - The main heading exists and matches the expected text
    // - The "Show Visualization" button is present and visible
    const kruskal = new KruskalPage(page);

    // Verify main heading text exists and is correct
    const headingText = await kruskal.getMainHeadingText();
    expect(headingText).toBe("Kruskal's Algorithm");

    // Verify the button exists and is visible
    const visible = await kruskal.buttonIsVisible();
    expect(visible).toBeTruthy();

    // Verify the button has the expected onclick evidence attribute
    const onclickAttr = await kruskal.getButtonOnClickAttribute();
    // The FSM evidence shows onclick="showVisualization()"
    expect(onclickAttr).toBeTruthy();
    expect(onclickAttr).toContain('showVisualization');

    // Assert that no page errors (uncaught exceptions) occurred during initial load
    expect(pageErrors.length, 'Expected no page errors on initial load').toBe(0);

    // Assert that console did not have any error-level messages during initial load
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length, 'Expected no console.error messages on initial load').toBe(0);
  });

  test('Transition ShowVisualization: clicking button transitions to S1_Visualization_Shown and renders steps', async ({ page }) => {
    // This test validates the transition from S0_Idle -> S1_Visualization_Shown:
    // - Clicking the .button triggers showVisualization()
    // - Visualization output contains header "Visualization Steps" and an ordered list of steps
    // - Expected number of steps (7) is present
    const kruskal = new KruskalPage(page);

    // Ensure function exists on window
    const fnType = await kruskal.typeofShowVisualization();
    expect(fnType).toBe('function');

    // Click the button to show visualization
    await kruskal.clickShowVisualization();

    // Wait for the visualization header to appear
    await expect(kruskal.outputLocator.locator('h3')).toHaveText('Visualization Steps');

    // Verify innerHTML contains the evidence pattern from FSM
    const innerHTML = await kruskal.getVisualizationInnerHTML();
    expect(innerHTML).toContain('<h3>Visualization Steps</h3>');
    expect(innerHTML).toContain('<ol>');

    // Verify that the ordered list exists and has 7 list items (the steps array length)
    const items = kruskal.getVisualizationListItems();
    const count = await items.count();
    expect(count).toBe(7);

    // Verify contents of first and last steps to ensure correct ordering/content
    const firstText = (await items.nth(0).textContent())?.trim();
    const lastText = (await items.nth(count - 1).textContent())?.trim();

    expect(firstText).toContain('Initial graph with edges');
    expect(lastText).toContain('MST complete with total weight 19');

    // Assert no uncaught page errors occurred during the transition
    expect(pageErrors.length, 'Expected no page errors after clicking Show Visualization').toBe(0);

    // Assert no console.error messages during interaction
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length, 'Expected no console.error messages after interaction').toBe(0);
  });

  test('Idempotency and edge case: multiple clicks do not duplicate or append steps (should overwrite)', async ({ page }) => {
    // Validate repeated interactions and rapid clicks:
    // - Clicking multiple times should not cause cumulative duplication of list items
    const kruskal = new KruskalPage(page);

    // Click once and record count
    await kruskal.clickShowVisualization();
    const items = kruskal.getVisualizationListItems();
    await expect(items).toHaveCount(7);

    // Click multiple times quickly
    for (let i = 0; i < 5; i++) {
      await kruskal.clickShowVisualization();
    }

    // After repeated clicks, it should still be the same 7 items (overwritten, not appended)
    const finalCount = await items.count();
    expect(finalCount).toBe(7);

    // Sanity check: ensure the first step still matches expected content
    const firstText = (await items.nth(0).textContent())?.trim();
    expect(firstText).toContain('Initial graph with edges');

    // Ensure no uncaught page errors even after rapid clicks
    expect(pageErrors.length).toBe(0);
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('FSM evidence verification: confirm onclick attribute and output.innerHTML pattern presence', async ({ page }) => {
    // This test cross-checks the FSM evidence snippets:
    // - The button has onclick="showVisualization()"
    // - The output.innerHTML assignment creates an <ol> inside the visualization output
    const kruskal = new KruskalPage(page);

    const onclickAttr = await kruskal.getButtonOnClickAttribute();
    expect(onclickAttr).toBeTruthy();
    expect(onclickAttr).toMatch(/showVisualization\s*\(\s*\)/);

    // Click to produce output
    await kruskal.clickShowVisualization();

    // The FSM evidence shows: output.innerHTML = '<h3>Visualization Steps</h3><ol>' + steps.map...
    // We validate that the resulting HTML includes the header and ordered-list tags
    const html = await kruskal.getVisualizationInnerHTML();
    expect(html).toMatch(/<h3>\s*Visualization Steps\s*<\/h3>/);
    expect(html).toMatch(/<ol>.*<\/ol>/s);
  });

  test('Error scenario: clicking a non-existent selector should result in an error (Playwright rejection)', async ({ page }) => {
    // Edge case to validate error behavior in the test environment:
    // - Attempting to click a missing selector should throw (reject) from Playwright
    // We assert that the promise is rejected (Playwright will time out and throw)
    // Note: Do not modify page content or globals; simply attempt the action and assert the error.
    let threw = false;
    try {
      // Use a small timeout so this test doesn't wait long
      await page.click('.this-selector-does-not-exist', { timeout: 1000 });
    } catch (err) {
      threw = true;
      // The thrown error should be an Error with a helpful message
      expect(err).toBeInstanceOf(Error);
      // Its message should indicate waiting for the selector or timing out
      const msg = String(err.message);
      expect(msg.length).toBeGreaterThan(0);
      expect(
        msg.toLowerCase()
      ).toMatch(/(waiting for selector|timeout|no node found|locator)/i);
    }
    expect(threw, 'Expected page.click on missing selector to throw').toBe(true);
  });

  test('Sanity check: no unexpected ReferenceError/SyntaxError/TypeError occurred during load or interaction', async ({ page }) => {
    // The developer instructions emphasize observing console errors and page errors.
    // This test asserts that there are no uncaught exceptions (pageErrors) that are typical runtime errors.
    // If such errors occur naturally in the environment, this test will fail and surface them.
    const kruskal = new KruskalPage(page);

    // Interact to trigger potential runtime faults
    await kruskal.clickShowVisualization();

    // Inspect collected pageErrors for typical runtime error patterns
    const runtimeErrorPatterns = [/ReferenceError/i, /SyntaxError/i, /TypeError/i];

    for (const errMsg of pageErrors) {
      // If any page error matches one of the runtime error patterns, fail with details
      for (const pat of runtimeErrorPatterns) {
        if (pat.test(errMsg)) {
          throw new Error(`Unexpected runtime error detected on page: ${errMsg}`);
        }
      }
    }

    // Also ensure console.error did not capture typical runtime errors
    const consoleErrs = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    for (const cmsg of consoleErrs) {
      for (const pat of runtimeErrorPatterns) {
        if (pat.test(cmsg)) {
          throw new Error(`Unexpected console runtime error detected: ${cmsg}`);
        }
      }
    }

    // Finally assert that there were no page errors at all (fail the test if any exist)
    expect(pageErrors.length, 'No uncaught page errors expected').toBe(0);
    expect(consoleErrs.length, 'No console.error messages expected').toBe(0);
  });
});