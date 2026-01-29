import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/5208f8d1-fa76-11f0-a09b-87751f540fd8.html';

// Test suite for the Tim Sort interactive application (FSM state: S0_Idle)
// The page contains only static content inside <pre><code> blocks (no <script>), so we validate:
// - The Idle state rendering (entry evidence) is present in the DOM
// - There are no interactive elements or transitions defined on the page
// - The entry action mentioned in the FSM ("renderPage()") is not present/executed on the page
// - No runtime console logs produced by executing JS (since the code is not in <script> tags)
// - No runtime page errors occur
test.describe('Tim Sort - Idle State (S0_Idle) - Static Page Validation', () => {
  let consoleMessages = [];
  let pageErrors = [];
  let consoleHandler;
  let pageErrorHandler;

  test.beforeEach(async ({ page }) => {
    // Reset captured state
    consoleMessages = [];
    pageErrors = [];

    // Capture console events and page errors for assertions
    consoleHandler = (msg) => {
      try {
        // Some console messages are objects; normalize to string
        consoleMessages.push(msg.text ? msg.text() : String(msg));
      } catch (e) {
        consoleMessages.push(String(msg));
      }
    };
    pageErrorHandler = (err) => {
      // err is an Error object; store its message for assertions
      pageErrors.push(err && err.message ? err.message : String(err));
    };

    page.on('console', consoleHandler);
    page.on('pageerror', pageErrorHandler);

    // Navigate to the provided URL (load the page exactly as-is)
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Clean up listeners to avoid cross-test interference
    if (consoleHandler) page.off('console', consoleHandler);
    if (pageErrorHandler) page.off('pageerror', pageErrorHandler);
    consoleHandler = null;
    pageErrorHandler = null;

    // No explicit teardown required beyond Playwright's fixtures
    await page.close();
  });

  test('renders static content for Idle state and matches FSM evidence', async ({ page }) => {
    // Validate the main heading is present and matches FSM evidence
    const h1 = page.locator('h1');
    await expect(h1).toHaveText('Tim Sort');

    // Validate the descriptive paragraph exists and mentions Tim Sort properties
    const paragraph = page.locator('p');
    await expect(paragraph).toContainText('Tim Sort is a stable sorting algorithm');

    // The FSM evidence included code snippets in the page. Ensure the <pre> block contains the functions.
    const pre = page.locator('pre');
    const preText = await pre.textContent();
    expect(preText).toBeTruthy();
    // Check for key function names and the sample array literal in the visible code block
    expect(preText).toContain('function insertionSort');
    expect(preText).toContain('function merge');
    expect(preText).toContain('function mergeSort');
    expect(preText).toContain('function timSort');
    expect(preText).toContain('[38, 27, 43, 3, 9, 82, 10, 12]');

    // Confirm the document title is as expected
    await expect(page).toHaveTitle('Tim Sort');
  });

  test('entry action "renderPage()" from FSM is not defined or executed on the page', async ({ page }) => {
    // The FSM listed an entry action renderPage(). Verify that no global function named renderPage exists.
    const renderPageType = await page.evaluate(() => {
      // Return type string for window.renderPage (undefined if not present)
      return typeof window.renderPage;
    });
    expect(renderPageType).toBe('undefined');

    // Because renderPage is not defined, there should be no evidence that it was called (no console logs referencing it).
    const foundRenderCall = consoleMessages.some((m) =>
      m.includes('renderPage') || m.includes('render page') || m.includes('renderPage()')
    );
    expect(foundRenderCall).toBe(false);
  });

  test('no interactive elements or transitions exist on the page (as extracted from FSM)', async ({ page }) => {
    // The FSM extraction notes indicated no interactive elements. Assert the DOM contains no common interactive tags.
    const buttonCount = await page.locator('button').count();
    const inputCount = await page.locator('input').count();
    const textareaCount = await page.locator('textarea').count();
    const selectCount = await page.locator('select').count();
    const linkCount = await page.locator('a').count();

    expect(buttonCount).toBe(0);
    expect(inputCount).toBe(0);
    expect(textareaCount).toBe(0);
    expect(selectCount).toBe(0);

    // Anchors (<a>) may exist in some pages; FSM extraction said no links. Assert there are zero anchors.
    expect(linkCount).toBe(0);

    // Also ensure there are no inline event handlers like onclick attributes anywhere in the DOM
    const onclickAttrCount = await page.locator('[onclick]').count();
    expect(onclickAttrCount).toBe(0);
  });

  test('script code is presented as static text (not executed) and does not produce console logs or errors', async ({ page }) => {
    // The code in the HTML is inside <pre><code> and should not execute. Therefore:
    // - There should be no console messages indicating "Original array:" or "Sorted array:"
    // - There should be no runtime page errors (since no script runs)
    const hasOriginalArrayLog = consoleMessages.some((m) => m.includes('Original array'));
    const hasSortedArrayLog = consoleMessages.some((m) => m.includes('Sorted array'));

    expect(hasOriginalArrayLog).toBe(false);
    expect(hasSortedArrayLog).toBe(false);

    // Ensure no page errors occurred during load
    expect(pageErrors.length).toBe(0);

    // Additionally, validate that the code appears verbatim in the DOM (so it wasn't moved into a <script>)
    const codeContent = await page.locator('pre').textContent();
    expect(codeContent).toContain('console.log("Original array:"');
    expect(codeContent).toContain('console.log("Sorted array:"');
    expect(codeContent).toContain('function insertionSort(arr)');
  });

  test('edge case checks: verify absence of extracted transitions and handlers as per FSM extraction summary', async ({ page }) => {
    // FSM extraction summary reported zero detected components and event handlers.
    // Verify there are no elements with common binding attributes or dataset markers that would imply handlers.
    const dataHandlerAttrsCount = await page.locator('[data-handler], [data-action], [data-event]').count();
    expect(dataHandlerAttrsCount).toBe(0);

    // Verify no script tags are present that might contain executable JavaScript (the page only uses <pre><code>)
    const scriptCount = await page.locator('script').count();
    expect(scriptCount).toBe(0);

    // Ensure there are no inline <script> event handler attributes on elements (e.g., onmouseover, onload etc.)
    const inlineEventAttributes = ['onload', 'onmouseover', 'onmouseout', 'onchange', 'onsubmit', 'onfocus', 'onblur'];
    for (const attr of inlineEventAttributes) {
      const count = await page.locator(`[${attr}]`).count();
      expect(count).toBe(0);
    }
  });
});