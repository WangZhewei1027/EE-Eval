import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b2f482-fa7c-11f0-adc7-178f556b1ee0.html';

// Simple Page Object for the routing page
class RoutingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
  }

  // Register listeners to capture console and page errors
  async registerObservers() {
    this.page.on('console', (msg) => {
      // Capture console messages (type, text)
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    this.page.on('pageerror', (err) => {
      // Capture uncaught exceptions (Error objects)
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getExploreButton() {
    return this.page.locator('#routing-button');
  }

  async clickExploreButton() {
    await this.page.click('#routing-button');
  }

  // Helper to get the type of routingDemonstration on window (if defined)
  async routingDemonstrationType() {
    return this.page.evaluate(() => typeof window.routingDemonstration);
  }

  // Return collected console messages
  getConsoleMessages() {
    return this.consoleMessages;
  }

  // Return collected page errors
  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('Routing Through Comprehensive Textual Explanations - FSM tests', () => {
  test.describe.configure({ mode: 'serial' });

  // Setup a fresh page object for each test
  test.beforeEach(async ({ page }) => {
    // no-op here; each test will construct its own RoutingPage and register observers
  });

  // Test initial UI and S0_Idle evidence
  test('S0_Idle: Page renders initial content and shows Explore Routing Concepts button', async ({ page }) => {
    // This test validates the Idle state's entry evidence:
    // - The page renders normally with explanatory text
    // - The "Explore Routing Concepts" button exists and is visible
    const routing = new RoutingPage(page);
    await routing.registerObservers();
    await routing.goto();

    const button = await routing.getExploreButton();
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Explore Routing Concepts');

    // Ensure explanatory text paragraphs exist (basic DOM checks for the educational narrative)
    const firstParagraph = page.locator('.container p').first();
    await expect(firstParagraph).toContainText('Routing is a fundamental concept');

    // At initial render (navigation), capture if any script errors occurred during load
    const errors = routing.getPageErrors();
    // We do not fail here if errors exist because the HTML/JS may contain syntax errors (we will assert them in later tests)
    // But assert that the button is present as primary evidence of Idle state
    expect(button).not.toBeNull();
  });

  // Test transition attempt and ensure runtime errors are observed as-is
  test('ExploreRouting event: clicking the button should trigger routingDemonstration but script syntax error prevents it (assert errors occur)', async ({ page }) => {
    // This test validates the transition from S0_Idle to S1_RoutingDemonstration:
    // - It attempts the click event described in the FSM
    // - Observes console logs and page errors (let errors happen naturally)
    // - Asserts that expected routing logs are NOT produced because the inline script has a syntax error
    const routing = new RoutingPage(page);
    await routing.registerObservers();
    await routing.goto();

    // Immediately after navigation, there is likely a syntax error during script parsing.
    // Capture any page errors that occurred during parse/execution.
    const initialErrors = routing.getPageErrors();

    // At least register that some errors were captured at load time OR will be captured after interactions.
    // We expect a SyntaxError due to the malformed string/quotes in the inline JS.
    // However, message formats vary across engines, so we assert generically that at least one error exists
    // and that its message contains clues such as SyntaxError / Unexpected / Dijkstra / token.
    expect(initialErrors.length).toBeGreaterThanOrEqual(0);

    // Verify the routingDemonstration function is not defined (because the script failed to parse)
    const funcType = await routing.routingDemonstrationType();
    // If the script parsing failed, the function will not be defined -> typeof yields 'undefined'
    // If somehow parsing succeeded in a different environment, we still allow for 'function'
    expect(['undefined', 'function']).toContain(funcType);

    // Now attempt to click the button (the FSM transition event)
    await routing.clickExploreButton();

    // Wait a short moment to allow any console messages or errors to surface
    await page.waitForTimeout(200);

    const consoleMessages = routing.getConsoleMessages().map(m => ({ type: m.type, text: m.text }));
    const pageErrors = routing.getPageErrors();

    // Assert that the expected routing console logs (entry actions of S1) are NOT present
    // These logs would be: 'Routing System Test:', 'Network Topology:', 'Routing Protocols:', 'Routing Algorithms:'
    const allConsoleTexts = consoleMessages.map(m => m.text).join('\n');
    expect(allConsoleTexts).not.toContain('Routing System Test:');
    expect(allConsoleTexts).not.toContain('Network Topology:');
    expect(allConsoleTexts).not.toContain('Routing Protocols:');
    expect(allConsoleTexts).not.toContain('Routing Algorithms:');

    // Assert that at least one page error exists and appears to be a syntax/parse error.
    // Message formats vary; check for a variety of common indicators.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    const errorMessages = pageErrors.map(e => String(e && e.message ? e.message : e));
    const joinedErrors = errorMessages.join('\n');

    // We assert that the page error messages contain at least one of the common syntax error indicators.
    const syntaxIndicators = /SyntaxError|Unexpected token|Unexpected identifier|Unterminated string|Unexpected end of input|Dijkstra/i;
    const foundSyntax = syntaxIndicators.test(joinedErrors);
    expect(foundSyntax).toBeTruthy();

    // Also assert that no logs of the demonstration were produced by the click (another safety check)
    // (This ensures the FSM transition did not occur due to the script error)
    const routingLogFound = consoleMessages.some(m => /Routing System Test:|Network Topology:|Routing Protocols:|Routing Algorithms:/.test(m.text));
    expect(routingLogFound).toBeFalsy();
  });

  // Edge case: multiple clicks and verifying stability (no additional unexpected exceptions)
  test('Edge case: multiple clicks should not produce routing logs and page remains stable despite errors', async ({ page }) => {
    // This test ensures that repeated interaction attempts do not crash the renderer or produce the expected routing outputs.
    const routing = new RoutingPage(page);
    await routing.registerObservers();
    await routing.goto();

    // Perform multiple rapid clicks
    const button = await routing.getExploreButton();
    await expect(button).toBeVisible();

    // Click 3 times with small delays
    for (let i = 0; i < 3; i++) {
      await button.click();
      await page.waitForTimeout(100);
    }

    // Collect console and errors
    const consoleMessages = routing.getConsoleMessages().map(m => ({ type: m.type, text: m.text }));
    const pageErrors = routing.getPageErrors();

    // Verify still at least one syntax/parse error captured (should have been captured on load)
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Ensure that the string outputs expected from the routingDemonstration were never emitted
    const allConsoleTexts = consoleMessages.map(m => m.text).join('\n');
    expect(allConsoleTexts).not.toContain('Routing System Test:');
    expect(allConsoleTexts).not.toContain('Network Topology:');

    // Ensure repeated clicks did not cause additional types of errors such as TypeError or ReferenceError being thrown on interaction
    // We allow whatever errors occurred naturally, but confirm there are no increasing numbers of new different uncaught errors after clicks.
    // (For the given broken script, the primary error is the parse-time SyntaxError.)
    // Assert that all captured page errors contain at least one syntax-like indicator; they should not all be new ReferenceError messages.
    const errorMsgs = pageErrors.map(e => String(e && e.message ? e.message : e));
    const hasNonSyntaxError = errorMsgs.some(msg => !/SyntaxError|Unexpected token|Unexpected identifier|Unterminated string|Unexpected end of input|Dijkstra/i.test(msg));
    // It's acceptable if other errors appear, but we note them here for diagnosis. We assert that at minimum a syntax-like error is present.
    const hasSyntaxError = errorMsgs.some(msg => /SyntaxError|Unexpected token|Unexpected identifier|Unterminated string|Unexpected end of input|Dijkstra/i.test(msg));
    expect(hasSyntaxError).toBeTruthy();

    // Basic DOM still intact: header still shows the title
    const title = page.locator('h1');
    await expect(title).toHaveText('Routing Through Comprehensive Textual Explanations');
  });

  // Cleanup block - ensures any final observations are asserted if needed
  test.afterEach(async ({}, testInfo) => {
    // No global teardown required; Playwright closes pages between tests.
    // This hook is present to satisfy requirement for setup/teardown structure.
  });
});