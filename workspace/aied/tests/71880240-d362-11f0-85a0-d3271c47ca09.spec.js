import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/71880240-d362-11f0-85a0-d3271c47ca09.html';

/**
 * Page Object for the Graph application.
 * Encapsulates common locators and simple interactions.
 */
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.h1 = page.locator('h1');
    this.graph = page.locator('.graph');
    this.node = page.locator('.graph .node');
    this.edge = page.locator('.graph .edge');
    this.arrow = page.locator('.graph .arrow');
    // generic collections for safety checks
    this.buttons = page.locator('button');
    this.inputs = page.locator('input, textarea, select');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }
}

test.describe('Graph Interactive Application - FSM validation (S0_Idle)', () => {
  // Capture console messages and page errors for assertions across tests
  let consoleMessages = [];
  let pageErrors = [];
  let graphPage;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      // store type and text for diagnostics
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect unhandled exceptions from the page context
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    graphPage = new GraphPage(page);
    // Load the page under test
    await graphPage.goto();
    // short pause to allow scripts to run and produce console messages/errors
    await page.waitForTimeout(200);
  });

  test.afterEach(async ({ page }) => {
    // Allow any late console messages to be collected (small grace period)
    await page.waitForTimeout(50);
  });

  test('renders the Idle state static content as described in FSM', async () => {
    // This test validates that the static DOM elements asserted in the FSM exist.
    // - h1 header "Graph"
    // - container .graph with children .node, .edge, .arrow

    // Validate header
    await expect(graphPage.h1).toHaveCount(1);
    await expect(graphPage.h1).toHaveText('Graph');

    // Validate main graph container exists
    await expect(graphPage.graph).toHaveCount(1);

    // Validate components inside the graph container
    await expect(graphPage.node).toHaveCount(1);
    await expect(graphPage.edge).toHaveCount(1);
    await expect(graphPage.arrow).toHaveCount(1);
  });

  test('verifies documented component selectors are present and queryable', async () => {
    // This test ensures that every selector from the FSM's components section can be located.
    const selectors = ['.graph', '.node', '.edge', '.arrow'];
    const results = await Promise.all(
      selectors.map((sel) => graphPage.page.$(sel))
    );

    // All selectors should resolve to an element (non-null)
    for (let i = 0; i < selectors.length; i++) {
      expect(results[i], `Expected selector ${selectors[i]} to exist in DOM`).not.toBeNull();
    }

    // Ensure there are no unexpected interactive form controls, because FSM expected no interactions
    await expect(graphPage.buttons).toHaveCount(0);
    await expect(graphPage.inputs).toHaveCount(0);
  });

  test('observes console and page errors (entry action renderPage() may cause errors)', async () => {
    // The FSM entry_actions lists renderPage(). The HTML references scripts.js which may be missing
    // or may not define renderPage(). We must NOT patch or change the environment.
    // This test asserts that JavaScript/runtime errors or loading errors occur naturally and are observable.

    // Wait briefly to ensure any late errors are captured
    await graphPage.page.waitForTimeout(150);

    // Combine collected diagnostics into strings for pattern matching
    const consoleTexts = consoleMessages.map((m) => `${m.type}: ${m.text}`);
    const pageErrorTexts = pageErrors.map((e) => (e && e.message) ? e.message : String(e));
    const combined = consoleTexts.concat(pageErrorTexts).join('\n');

    // Log the collected diagnostics to test output for easier debugging (Playwright will show this on failure)
    // Note: We do not mutate the page or environment.
    // eslint-disable-next-line no-console
    console.log('Collected console messages:', consoleTexts);
    // eslint-disable-next-line no-console
    console.log('Collected page errors:', pageErrorTexts);

    // ASSERTION 1: There should be at least one console error or page error recorded.
    // This aligns with the instruction to "let ReferenceError, SyntaxError, TypeError happen naturally" and assert them.
    expect(consoleMessages.length + pageErrors.length).toBeGreaterThan(0);

    // ASSERTION 2: At least one of the messages should mention likely keywords indicating the nature of the issue.
    // Acceptable keywords (flexible): ReferenceError, TypeError, SyntaxError, renderPage, Failed to load, 404
    const keywordRegex = /ReferenceError|TypeError|SyntaxError|renderPage|Failed to load|404|failed to load/i;
    const matched = combined.match(keywordRegex);
    expect(matched, `Expected at least one diagnostic to mention an error keyword. Collected: ${combined}`).not.toBeNull();
  });

  test('ensures clicking static elements does not produce state transitions (no transitions in FSM)', async () => {
    // The FSM declares no events or transitions. Clicking elements should not change the documented static state.
    // We capture the HTML snapshot, attempt interactions, and ensure the DOM remains effectively the same.

    const page = graphPage.page;
    const beforeSnapshot = await page.content();

    // Try to click the node, edge, and arrow if interactable.
    // Wrap each click in try/catch to allow natural errors to surface without failing the test unexpectedly.
    // We will assert afterwards that the DOM hasn't changed.
    try {
      await graphPage.node.click({ timeout: 200 }).catch(() => {});
    } catch (e) {
      // allow natural exceptions (e.g., element not visible/clickable)
    }

    try {
      await graphPage.edge.click({ timeout: 200 }).catch(() => {});
    } catch (e) {
      // allow natural exceptions
    }

    try {
      await graphPage.arrow.click({ timeout: 200 }).catch(() => {});
    } catch (e) {
      // allow natural exceptions
    }

    // slight delay for any event-driven changes to apply
    await page.waitForTimeout(150);
    const afterSnapshot = await page.content();

    // Assert the DOM did not change as a result of clicking (no transitions expected)
    expect(afterSnapshot).toBe(beforeSnapshot);
  });

  test('reports detailed diagnostics for edge cases and missing script resources', async () => {
    // This test focuses on providing detail if scripts failed to load (common edge case).
    // We inspect console messages for failed resource loads and surface them via assertions.

    // Gather textual console messages
    const texts = consoleMessages.map((m) => m.text).join('\n');

    // We expect some indication of a resource loading problem (e.g., scripts.js 404 or failed to load)
    const resourceProblemRegex = /Failed to load resource|404|ERR_FAILED|net::ERR_|failed to load|scripts\.js/i;
    const hasResourceProblem = resourceProblemRegex.test(texts);

    // Ensure at least one diagnostic either was a JS runtime error (captured earlier) OR a resource load problem
    const hadAnyError = (consoleMessages.length + pageErrors.length) > 0;
    expect(hadAnyError).toBe(true);

    // Make a softer assertion that tries to detect missing script resource; if it doesn't exist, we still pass
    // because the earlier test enforced that some error occurred. But we provide diagnostic expectation here.
    if (!hasResourceProblem) {
      // Log that we did not detect an explicit resource load message, but still require that some error exists
      // (This branch is informational only; the test overall will pass due to prior checks)
      // eslint-disable-next-line no-console
      console.log('No explicit resource load failure detected in console messages. Console messages:', texts);
    } else {
      // If a resource problem was detected, assert true to document the expectation.
      expect(hasResourceProblem).toBe(true);
    }
  });
});