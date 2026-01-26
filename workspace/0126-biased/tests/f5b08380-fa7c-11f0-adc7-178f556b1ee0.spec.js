import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b08380-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('Application f5b08380-fa7c-11f0-adc7-178f556b1ee0 - Graph (Undirected) Explanation', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Load the page before each test and attach listeners to observe runtime errors and console logs.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (info, warn, error, debug, etc.)
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Collect uncaught exceptions reported by the page
    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });

    // Navigate to the static HTML page under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Basic static content checks corresponding to the Idle state evidence
  test('Idle state: page renders static content and headings', async ({ page }) => {
    // Verify the document title is set correctly
    await expect(page).toHaveTitle(/Graph \(Undirected\) Explanation/);

    // Verify the main heading is present and matches FSM evidence
    const h1 = await page.locator('h1').innerText();
    expect(h1).toContain('Graph (Undirected) Explanation');

    // Verify that some expected descriptive paragraphs are present
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toContain('The graph (undirected) is a mathematical concept');
    expect(bodyText).toContain('A graph is a non-linear data structure consisting of vertices');
    expect(bodyText).toContain('Some common graph algorithms include:');
  });

  // Verify that the entry action referenced by the FSM (renderPage) is not defined in the page.
  // FSM declared an entry action: renderPage(). The implementation contains no scripts, so this global should be undefined.
  test('FSM entry action "renderPage" - verify implementation mismatch', async ({ page }) => {
    // Evaluate the presence and type of renderPage on the window
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    // Expect it to be 'undefined' since the HTML has no scripts defining it
    expect(renderPageType).toBe('undefined');
  });

  // Ensure there are no interactive controls (buttons, inputs, forms) as the FSM expected a static page.
  test('No interactive elements exist (buttons, inputs, forms, anchors)', async ({ page }) => {
    // Buttons
    const buttonCount = await page.locator('button').count();
    expect(buttonCount).toBe(0);

    // Inputs (including textarea and select)
    const inputCount = await page.locator('input, textarea, select').count();
    expect(inputCount).toBe(0);

    // Anchor tags (there are none in the provided HTML)
    const anchorCount = await page.locator('a').count();
    expect(anchorCount).toBe(0);

    // No inline event handlers like onclick, onsubmit on any element
    const elementsWithOnclick = await page.evaluate(() => {
      const matches = [];
      for (const el of Array.from(document.querySelectorAll('*'))) {
        if (el.hasAttribute && el.hasAttribute('onclick')) {
          matches.push(el.tagName);
        }
      }
      return matches;
    });
    expect(elementsWithOnclick.length).toBe(0);
  });

  // Validate code blocks (pre tags) contain the expected adjacency representations from the HTML.
  test('Preformatted text blocks contain adjacency matrix/list examples', async ({ page }) => {
    const preCount = await page.locator('pre').count();
    expect(preCount).toBeGreaterThanOrEqual(3); // The page shows multiple pre blocks

    // Ensure at least one pre block contains "Adjacency" representation snippet or numbers
    const preTexts = await page.locator('pre').allInnerTexts();
    const joined = preTexts.join('\n');
    expect(joined).toMatch(/0 \| 1 \| 2/);
    expect(joined).toMatch(/0: \[1, 2\]/);
  });

  // FSM described no transitions or events. Verify there are no scripts and no obvious event handlers.
  test('FSM transitions/events absence: no scripts and no detected event handlers', async ({ page }) => {
    // Check that there are no <script> tags in the document (the HTML contains none)
    const scriptCount = await page.locator('script').count();
    expect(scriptCount).toBe(0);

    // Inspect elements for inline event handler attributes (onmouseover, onclick, etc.)
    const inlineEventAttributes = await page.evaluate(() => {
      const eventAttrs = ['onclick', 'ondblclick', 'onmousedown', 'onmouseup', 'onmouseover', 'onmouseout', 'onchange', 'onsubmit', 'oninput'];
      const found = [];
      for (const el of Array.from(document.querySelectorAll('*'))) {
        for (const attr of eventAttrs) {
          if (el.hasAttribute && el.hasAttribute(attr)) {
            found.push({ tag: el.tagName, attr, value: el.getAttribute(attr) });
          }
        }
      }
      return found;
    });
    expect(inlineEventAttributes.length).toBe(0);
  });

  // Observe console logs and page errors that occurred during page load.
  // The HTML is static and has no scripts, so we expect neither runtime JS errors nor console.error messages.
  test('Console and runtime errors: assert no uncaught JS errors or console.error messages', async () => {
    // No uncaught page errors should have been captured
    expect(pageErrors.length).toBe(0);

    // Filter console messages for error/severe types
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    const consoleWarnings = consoleMessages.filter(m => m.type === 'warning');

    // Assert no console errors were emitted during load
    expect(consoleErrors.length).toBe(0);

    // Warnings are allowed but we document them if present; assert none expected for this static page
    expect(consoleWarnings.length).toBe(0);
  });

  // Edge case: attempt to "activate" non-existent interactions and ensure doing so does not throw from test side.
  test('Edge case: programmatic invocation of absent functions should be undefined, not cause page errors', async ({ page }) => {
    // Attempt to call functions that the FSM might expect, but which are not present.
    // We do NOT inject or define these functions; only observe that they are undefined.
    const checkNames = ['renderPage', 'initialize', 'onEnter', 'onExit'];
    const types = await page.evaluate((names) => {
      return names.map(n => ({ name: n, type: typeof window[n] }));
    }, checkNames);

    for (const t of types) {
      // Each of these should be 'undefined' in the provided implementation
      expect(t.type).toBe('undefined');
    }

    // Also ensure that no new page errors were produced by querying these values
    // (pageErrors captured in beforeEach; this test runs in its own isolated context and pageErrors was reset)
  });

  // Summary test: verify that the page matches the FSM extraction summary (static, no interactive elements).
  test('FSM extraction summary validation: static content, no detected event handlers/components', async ({ page }) => {
    // Confirm at least the first evidence items from FSM are present in the DOM text
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toContain('Graph (Undirected) Explanation');
    expect(bodyText).toContain('The graph (undirected) is a mathematical concept');

    // Confirm detected components/event handlers counts would be zero by inspecting DOM (no interactive elements or scripts)
    const interactiveElementsCount = await page.locator('button, input, select, textarea, a, [role="button"]').count();
    expect(interactiveElementsCount).toBe(0);

    const scriptTags = await page.locator('script').count();
    expect(scriptTags).toBe(0);
  });

  // Teardown comment: Playwright test runner will close the page/context automatically.
});