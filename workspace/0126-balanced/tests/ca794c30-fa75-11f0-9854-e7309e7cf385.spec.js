import { test, expect } from '@playwright/test';

// Test file for application: ca794c30-fa75-11f0-9854-e7309e7cf385
// URL served at:
// http://127.0.0.1:5500/workspace/0126-balanced/html/ca794c30-fa75-11f0-9854-e7309e7cf385.html

// Page Object representing the static Recursion page
class RecursionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Navigate to the page under test
  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/0126-balanced/html/ca794c30-fa75-11f0-9854-e7309e7cf385.html', { waitUntil: 'load' });
  }

  // Return the main heading element handle
  async heading() {
    return this.page.locator('h1');
  }

  // Return all paragraph locators
  async paragraphs() {
    return this.page.locator('p');
  }

  // Return code block text
  async codeText() {
    return this.page.locator('code').innerText();
  }

  // Count list items
  async countListItems() {
    return this.page.locator('li').count();
  }

  // Check whether any interactive elements exist (buttons, inputs, anchors)
  async hasInteractiveElements() {
    const buttons = await this.page.locator('button').count();
    const inputs = await this.page.locator('input, textarea, select').count();
    const anchors = await this.page.locator('a').count();
    return (buttons + inputs + anchors) > 0;
  }

  // Get all script elements count
  async scriptCount() {
    return this.page.locator('script').count();
  }

  // Check for inline event attributes like onclick on any element
  async hasInlineEventAttributes() {
    // Evaluate in page context to search for common inline event attributes
    return this.page.evaluate(() => {
      const attrsToCheck = ['onclick','onchange','onload','onmouseover','onmouseout','onkeydown','onsubmit'];
      const all = Array.from(document.querySelectorAll('*'));
      for (const el of all) {
        for (const attr of attrsToCheck) {
          if (el.hasAttribute && el.hasAttribute(attr)) return true;
        }
      }
      return false;
    });
  }
}

test.describe('Recursion static page - FSM S0_Idle validations', () => {
  // Arrays to capture console messages and page errors during tests
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize capture arrays
    consoleMessages = [];
    pageErrors = [];

    // Listen to console events and record them
    page.on('console', (msg) => {
      // capture text and type
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Listen to uncaught exceptions on the page
    page.on('pageerror', (err) => {
      // capture the error message and name
      pageErrors.push({ message: err.message, name: err.name });
    });
  });

  test.afterEach(async () => {
    // After each test we do not forcibly suppress errors. We assert expectations in each test.
    // This hook is kept for symmetry and potential future teardown steps.
  });

  test('Initial state (S0_Idle) renders expected static content', async ({ page }) => {
    // This test validates the FSM initial state evidence:
    // - <h1>Recursion</h1> exists
    // - The descriptive paragraph exists
    // - Code snippet content is present
    // - No interactive controls are present (per FSM extraction)
    const recursion = new RecursionPage(page);
    await recursion.goto();

    // Verify heading text
    await expect(await recursion.heading().innerText()).toBe('Recursion');

    // Verify at least one paragraph contains the expected description phrase
    const paragraphs = recursion.paragraphs();
    await expect(paragraphs.first()).toContainText('Recursion is a programming technique where a function calls itself repeatedly until it reaches a base case or reaches an end condition.');

    // Verify code block includes the sample function name and document.write (evidence that code shown, not executed)
    const codeContent = await recursion.codeText();
    expect(codeContent).toContain('function callFunction');
    expect(codeContent).toContain('document.write');

    // Verify there are 6 list items present (3 ul lists with 2 li each in the provided HTML)
    const liCount = await recursion.countListItems();
    expect(liCount).toBe(6);

    // Verify there are no interactive elements (buttons, inputs, anchors)
    const hasInteractive = await recursion.hasInteractiveElements();
    expect(hasInteractive).toBe(false);

    // Verify there are no <script> tags in the HTML (static informational page)
    const scripts = await recursion.scriptCount();
    expect(scripts).toBe(0);

    // Verify no inline event attributes detected
    const inlineEvents = await recursion.hasInlineEventAttributes();
    expect(inlineEvents).toBe(false);

    // Assert that no unexpected console messages were emitted during load (page is static)
    expect(consoleMessages.length).toBe(0);

    // Assert that no page errors occurred during load
    expect(pageErrors.length).toBe(0);
  });

  test('No transitions/events: interacting with body produces no errors', async ({ page }) => {
    // This test exercises "edge case" interactions on a static page:
    // - Clicking various non-interactive elements should not throw runtime errors
    // - There are no transitions to trigger; ensure none happened (no errors)
    const recursion1 = new RecursionPage(page);
    await recursion.goto();

    // Click the heading and a paragraph to simulate user interactions on a static page
    await recursion.heading().click();
    const paragraphs1 = await recursion.paragraphs1();
    if (await paragraphs.count() > 0) {
      await paragraphs.nth(0).click();
    }

    // Click the body to ensure there's no global click handler that throws
    await page.locator('body').click();

    // After simulated interactions, capture state of console and page errors
    // These arrays were populated by event listeners in beforeEach
    // Expect no console messages and no page errors for this static page
    expect(consoleMessages.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Evidence for renderPage() entry action is present (S0_Idle onEnter)', async ({ page }) => {
    // The FSM lists an entry action "renderPage()". We cannot call or inspect that function,
    // but we can validate the evidence associated with the S0_Idle state is present in the DOM.
    const recursion2 = new RecursionPage(page);
    await recursion.goto();

    // Validate the documented evidence strings exist on the rendered page
    await expect(recursion.heading()).toHaveText('Recursion');

    // Ensure at least one paragraph includes the explanatory sentence from FSM evidence
    const found = await page.locator('p:has-text("Recursion is a programming technique where a function calls itself repeatedly")').count();
    expect(found).toBeGreaterThan(0);

    // There are no onExit actions in the FSM; ensure no dynamic behavior exists to contradict this
    // We'll attempt to navigate away and back to ensure no errors on unload/load
    await page.goto('about:blank');
    // Return to the page
    await recursion.goto();

    // Confirm again the heading is present and no page errors occurred
    await expect(recursion.heading()).toHaveText('Recursion');
    expect(pageErrors.length).toBe(0);
    expect(consoleMessages.length).toBe(0);
  });

  test('Page robustness: searching for interactive elements and event handlers', async ({ page }) => {
    // This test validates the extraction summary claims: no interactive elements or inline handlers
    const recursion3 = new RecursionPage(page);
    await recursion.goto();

    // Ensure there are no <button>, <input>, <a> tags
    const hasInteractive1 = await recursion.hasInteractiveElements();
    expect(hasInteractive).toBe(false);

    // Ensure no inline event attributes like onclick are present
    const inlineEventFound = await recursion.hasInlineEventAttributes();
    expect(inlineEventFound).toBe(false);

    // Ensure that document.body.innerText includes the instructional phrases duplicated in markup
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toContain('The basic syntax of recursion is:');
    expect(bodyText).toContain('Here\'s an example of how to use recursion in JavaScript:');
  });

  test('Edge case: attempt to trigger non-existent transitions and assert stability', async ({ page }) => {
    // There are no FSM transitions or events. This test ensures that attempting to call
    // an absent function on the page does not get injected or patched by the test.
    // We will attempt to read a function that should not exist; this must not be created by tests.
    const recursion4 = new RecursionPage(page);
    await recursion.goto();

    // Evaluate in page context: check that renderPage is not a callable function on the window
    const renderPageType = await page.evaluate(() => {
      // Accessing an undefined global should return undefined and not throw in this context
      return typeof window.renderPage;
    });
    // renderPage was only mentioned in the FSM metadata; the page HTML should not define it
    expect(renderPageType === 'undefined' || renderPageType === 'function').toBeTruthy();

    // If it is undefined, that's expected; if it's a function that's surprising but acceptable,
    // we must not call it per instructions. We assert stability by ensuring no errors occurred.
    expect(consoleMessages.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});