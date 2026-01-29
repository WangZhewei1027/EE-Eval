import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/ca792521-fa75-11f0-9854-e7309e7cf385.html';

test.describe('Application ca792521-fa75-11f0-9854-e7309e7cf385 - PageRank (FSM: S0_Idle)', () => {
  // Arrays to capture runtime console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Before each test navigate to the page and attach listeners to observe console and page errors.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch {
        // defensive: ignore unusual console message shapes
      }
    });

    // Capture unhandled errors from the page
    page.on('pageerror', (err) => {
      // push the Error object so tests can assert its type/message
      pageErrors.push(err);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL);
  });

  // Test that the static content renders and matches the FSM evidence for the Idle state
  test('renders static content matching FSM evidence (Title, H1, paragraphs, list items)', async ({ page }) => {
    // Verify document title
    await expect(page).toHaveTitle('PageRank');

    // Verify H1 is present and has correct text
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText('PageRank');

    // There are several paragraphs describing PageRank; ensure at least 3 paragraphs exist
    const paragraphs = page.locator('body > p');
    await expect(paragraphs).toHaveCountGreaterThan(0); // ensure paragraphs exist
    const paragraphsCount = await paragraphs.count();
    expect(paragraphsCount).toBeGreaterThanOrEqual(3);

    // Verify the unordered list exists and contains the expected number of bullet points (6 per implementation)
    const listItems = page.locator('ul > li');
    await expect(listItems).toHaveCount(6);
    const lis = await listItems.allTextContents();
    // Basic sanity: each list item should be non-empty and appear in the document
    for (const liText of lis) {
      expect(liText.trim().length).toBeGreaterThan(0);
    }

    // The FSM evidence lists basic HTML fragments - assert those are present in the outerHTML
    const bodyHTML = await page.locator('html').innerHTML();
    expect(bodyHTML).toContain('<h1>PageRank</h1>');
    expect(bodyHTML).toContain('<title>PageRank</title>');

    // No errors should have occurred just by loading the static page
    expect(pageErrors.length).toBe(0);
  });

  // Test that there are no interactive elements or transitions detected on the page
  test('contains no interactive elements (buttons, inputs, links) and no script tags', async ({ page }) => {
    // Buttons
    const buttons = await page.locator('button').count();
    expect(buttons).toBe(0);

    // Inputs
    const inputs = await page.locator('input, textarea, select').count();
    expect(inputs).toBe(0);

    // Anchor links (interactivity via anchors)
    const anchors = await page.locator('a').count();
    // The provided HTML has no anchor elements
    expect(anchors).toBe(0);

    // Script tags - ensure no scripts are present (implementation shows none)
    const scripts = await page.locator('script').count();
    expect(scripts).toBe(0);

    // As FSM reported no transitions/events, assert there are no obvious interactive controls
    // (If any of these counts are non-zero, that would indicate unexpected interactivity)
  });

  // Validate the FSM entry action: renderPage() is listed as an entry action.
  // The page as provided does not define renderPage. We attempt to invoke it to observe natural errors.
  test('invoking entry action renderPage() (not defined) results in ReferenceError and emits a page error', async ({ page }) => {
    // Ensure no page errors prior to invocation
    expect(pageErrors.length).toBe(0);

    // Attempt to invoke renderPage() in the page context.
    // We call it without defining it so a ReferenceError should naturally occur.
    let caughtError = null;
    try {
      // This will run in page context and should fail because renderPage is not defined.
      await page.evaluate(() => {
        // Intentionally call the function that FSM lists as an entry action.
        // We do NOT define it anywhere; this should produce a ReferenceError in the page.
        // This mirrors the requirement: let ReferenceError happen naturally.
        // eslint-disable-next-line no-undef
        renderPage();
      });
    } catch (err) {
      // Capture the error thrown by page.evaluate
      caughtError = err;
    }

    // Ensure an error was thrown when attempting to invoke renderPage()
    expect(caughtError).not.toBeNull();
    // The error message should indicate ReferenceError or 'renderPage' not defined
    const msg = String(caughtError.message || caughtError);
    expect(msg.toLowerCase()).toContain('renderpage');
    // Many environments include "is not defined" for undefined functions
    expect(msg.toLowerCase()).toMatch(/(is not defined|referenceerror)/);

    // Give the page a moment to emit a pageerror event for the unhandled error
    await page.waitForTimeout(50);

    // Assert that the pageerror event was emitted at least once and that it relates to renderPage
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const pageErrorMessages = pageErrors.map(err => String(err.message || err));
    const anyMatch = pageErrorMessages.some(m => m.toLowerCase().includes('renderpage') || m.toLowerCase().includes('is not defined') || m.toLowerCase().includes('referenceerror'));
    expect(anyMatch).toBe(true);

    // Also assert the console did not emit unexpected logs beyond what we captured (optional sanity)
    // At least ensure consoleMessages is an array (no unexpected crash)
    expect(Array.isArray(consoleMessages)).toBe(true);
  });

  // Edge case: Attempt to call a non-existent transition (there are no transitions) and assert no handlers exist
  test('attempting to trigger non-existent transitions/events should not change the DOM or produce handlers', async ({ page }) => {
    // Snapshot of DOM content before attempting any synthetic triggers
    const beforeHTML = await page.locator('body').innerHTML();

    // Because there are no transitions or event handlers defined in the HTML/JS,
    // attempting to dispatch custom events should not be handled.
    // We'll dispatch a generic custom event named 'nonexistent-transition' and ensure nothing changes.
    await page.evaluate(() => {
      const ev = new CustomEvent('nonexistent-transition', { detail: { test: true } });
      window.dispatchEvent(ev);
    });

    // Wait briefly to let any potential handlers run if they existed
    await page.waitForTimeout(50);

    // DOM should remain identical (no handlers were present to mutate it)
    const afterHTML = await page.locator('body').innerHTML();
    expect(afterHTML).toBe(beforeHTML);

    // There should still be no page errors as a result of dispatching a harmless custom event
    // (excepting the previously tested renderPage invocation which is a separate test)
    // Since tests are isolated, this test's pageErrors should be empty here.
    expect(pageErrors.length).toBe(0);
  });

  // Teardown: ensure listeners do not persist across tests (Playwright provides fresh pages per test by default).
  test.afterEach(async ({ page }) => {
    try {
      // Remove listeners if present - defensive cleanup
      page.removeAllListeners && page.removeAllListeners('console');
      page.removeAllListeners && page.removeAllListeners('pageerror');
    } catch {
      // ignore removal errors
    }
  });
});