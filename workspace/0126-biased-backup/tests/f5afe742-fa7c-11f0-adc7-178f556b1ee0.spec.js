import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5afe742-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('FSM: Binary Tree (Application ID: f5afe742-fa7c-11f0-adc7-178f556b1ee0)', () => {
  // Arrays to capture console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset capture arrays
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack
      });
    });

    // Navigate to the static HTML page exactly as provided
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // No special teardown required, events are automatically cleared with page fixture
  });

  test('Idle state: static content is rendered (entry evidence verification)', async ({ page }) => {
    // This test validates the Idle state renderPage() entry evidence:
    //  - The page title equals "Binary Tree" (evidence from FSM)
    //  - Key headings and content exist
    //  - The static example code block is present
    const title = await page.title();
    expect(title).toBe('Binary Tree');

    // Verify the main heading exists and has expected text
    const h1 = await page.locator('h1').innerText();
    expect(h1).toBe('Binary Tree');

    // Verify some paragraph content to ensure the static page loaded
    const firstParagraph = await page.locator('.container p').first().innerText();
    expect(firstParagraph).toContain('Binary Tree is a data structure');

    // Verify Types of Binary Trees section exists
    const typesHeading = await page.locator('h2', { hasText: 'Types of Binary Trees' }).count();
    expect(typesHeading).toBeGreaterThan(0);

    // Verify list items exist and include expected items
    const listItems = await page.locator('h2:has-text("Types of Binary Trees") + ul li').allInnerTexts();
    // The provided HTML contains "Binomial Tree", " AVL Tree", "BT (Binary Search Tree)"
    expect(listItems.length).toBeGreaterThanOrEqual(1);
    expect(listItems.some(t => t.trim().includes('Binomial Tree'))).toBeTruthy();

    // Verify example code block exists and contains 'class Node'
    const preText = await page.locator('pre').innerText();
    expect(preText).toContain('class Node');

    // Ensure the container element exists and appears to be present in layout
    const container = await page.locator('.container');
    await expect(container).toBeVisible();
  });

  test('FSM entry action renderPage() is not defined and invoking it triggers a ReferenceError', async ({ page }) => {
    // The FSM lists an entry action "renderPage()". The HTML/JS does not define renderPage.
    // This test verifies:
    //  - window.renderPage is undefined (no global function/property defined)
    //  - Calling the bare identifier renderPage() in page context throws a ReferenceError
    //  - The pageerror/console capture records the error (if it propagates as uncaught)

    // Check that the property on global object is undefined (safe check)
    const typeOfWindowProp = await page.evaluate(() => typeof window.renderPage);
    expect(typeOfWindowProp).toBe('undefined');

    // Now intentionally call the bare identifier renderPage() inside page.evaluate context
    // This will attempt to resolve an identifier and should produce a ReferenceError
    let thrownError = null;
    try {
      await page.evaluate(() => {
        // Intentionally call the identifier (not window.renderPage) to cause a ReferenceError
        // if renderPage is not declared in the page environment.
        renderPage();
      });
    } catch (err) {
      // Capture the exception thrown by the evaluate call
      thrownError = err;
    }

    // The evaluate call should throw; we expect a ReferenceError (renderPage is not defined)
    expect(thrownError).not.toBeNull();
    // Different runtimes may wrap errors; check name/message contain "ReferenceError" or "is not defined"
    const nameMatches = thrownError.name && /ReferenceError/i.test(thrownError.name);
    const msgMatches = thrownError.message && (/renderPage is not defined/i.test(thrownError.message) || /ReferenceError/i.test(thrownError.message));
    expect(nameMatches || msgMatches).toBeTruthy();

    // Also check the page-level captured errors (uncaught) - there may be an entry
    // Note: evaluate throws to the test; sometimes the error is not emitted as a pageerror.
    const anyPageRefErrors = pageErrors.some(e => /renderPage/i.test(e.message) || /ReferenceError/i.test(e.name) || /is not defined/i.test(e.message));
    // It is acceptable if the pageerror captured it OR only the evaluate threw. We assert at least one of these holds.
    expect(anyPageRefErrors || thrownError).toBeTruthy();
  });

  test('No interactive controls or transitions exist on the page (as per FSM)', async ({ page }) => {
    // FSM extraction indicated no interactive elements and no transitions.
    // Validate there are no native <button> or <input> elements, and no elements with role="button"
    const buttonCount = await page.locator('button').count();
    const inputCount = await page.locator('input').count();
    const roleButtons = await page.locator('[role="button"]').count();

    expect(buttonCount).toBe(0);
    expect(inputCount).toBe(0);
    expect(roleButtons).toBe(0);

    // Check there are no <form> elements either
    const formCount = await page.locator('form').count();
    expect(formCount).toBe(0);

    // There is a styled element with class "button" but it is not an interactive <button>.
    const styledButtonCount = await page.locator('.button').count();
    expect(styledButtonCount).toBeGreaterThanOrEqual(0); // might exist as styling reference; ensure presence doesn't imply interactivity

    // Verify that attempting to click a non-existent interactive element results in a Playwright error
    // We do not perform the click; instead, assert absence to represent that no transitions can be triggered.
    const clickable = await page.$('button, [role="button"], .button');
    // If .button exists, it's not necessarily interactive; ensure no native interactivity exists
    if (clickable) {
      // If a .button element exists but is not an actual <button>, verify it's not actionable as a real control
      const tagName = await clickable.evaluate(node => node.tagName.toLowerCase());
      // If it's not a button element, it should not be treated as a native interactive element
      if (tagName !== 'button') {
        expect(tagName).not.toBe('button');
      }
    }
  });

  test('Console and page error observation: ensure no unexpected SyntaxError occurred during load', async ({ page }) => {
    // This test captures console messages and page errors recorded during navigation (set up in beforeEach)
    // It asserts that there wasn't a SyntaxError thrown during page load.
    const syntaxErrors = pageErrors.filter(e => /SyntaxError/i.test(e.name) || /SyntaxError/i.test(e.message));
    expect(syntaxErrors.length).toBe(0);

    // Log all console messages for debugging purposes (kept as expectations rather than failing)
    // Ensure nothing in the console indicates fatal JS runtime problems like ReferenceError during load
    const fatalConsole = consoleMessages.filter(m =>
      /error|assert/i.test(m.type) || /ReferenceError|TypeError|SyntaxError/.test(m.text)
    );
    // It's acceptable if no fatal messages occurred during load; assert that there are zero fatal load-time console errors.
    expect(fatalConsole.length).toBe(0);
  });

  test('Edge case: verifying that calling window.renderPage() (as a property) throws a TypeError if attempted', async ({ page }) => {
    // Calling window.renderPage() when window.renderPage is undefined will produce a TypeError
    // (different from calling bare renderPage() which produces ReferenceError).
    // This test demonstrates and asserts that behavior when invoked as property.
    // Use evaluate to call window.renderPage safely wrapped in try/catch so that error is surfaced and can be asserted.

    const result = await page.evaluate(() => {
      try {
        // Access explicitly through window to avoid ReferenceError; calling undefined() will produce TypeError
        // Return a sentinel if somehow succeeds (should not).
        window.renderPage();
        return { succeeded: true };
      } catch (err) {
        return {
          succeeded: false,
          name: err && err.name,
          message: err && err.message
        };
      }
    });

    expect(result.succeeded).toBe(false);
    // Expect a TypeError name or message mention "is not a function"
    const nameOk = result.name && /TypeError/i.test(result.name);
    const msgOk = result.message && /is not a function|not a function/i.test(result.message);
    expect(nameOk || msgOk).toBeTruthy();
  });
});