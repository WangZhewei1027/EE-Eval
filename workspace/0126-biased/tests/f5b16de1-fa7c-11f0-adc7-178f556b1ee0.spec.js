import { test, expect } from '@playwright/test';

const PAGE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b16de1-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('Prim\'s Algorithm interactive application - FSM validation', () => {
  // Containers for console messages and page errors collected during each test
  let consoleMessages = [];
  let consoleErrors = [];
  let pageErrors = [];

  // Setup listeners before each test so we capture logs/errors from navigation time
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture all console messages and categorize them
    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type(); // log, error, warning, etc.
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    // Capture uncaught page errors
    page.on('pageerror', err => {
      // err is an Error object; store its message and stack
      pageErrors.push({ message: err.message, stack: err.stack });
    });
  });

  test.afterEach(async () => {
    // Basic sanity: ensure we cleared collectors after each test
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];
  });

  test('S0_Idle: Page renders and entry evidence is present (h1)', async ({ page }) => {
    // Validate the initial/idle state: load the page and check the expected evidence
    // According to the FSM, entry action is renderPage() and the evidence is <h1>Prim\'s Algorithm</h1>
    await page.goto(PAGE_URL, { waitUntil: 'load' });

    // Check the primary header exists and contains exact expected text
    const h1 = await page.locator('h1').textContent();
    expect(h1).not.toBeNull();
    expect(h1.trim()).toBe("Prim's Algorithm");

    // Ensure other key sections are present (the page is largely static content)
    const headings = await page.$$eval('h2', nodes => nodes.map(n => n.textContent?.trim()));
    expect(headings).toContain('What is Prim\'s Algorithm?');
    expect(headings).toContain('Theory');
    expect(headings).toContain('Algorithms');
    expect(headings).toContain('Example');
    expect(headings).toContain('Code');
  });

  test('S0_Idle: No interactive elements or transitions exist on the page', async ({ page }) => {
    // The FSM extraction indicated no interactive elements and zero transitions.
    await page.goto(PAGE_URL, { waitUntil: 'load' });

    // Assert absence of buttons, inputs, selects, textareas, and anchors with href
    const interactiveCount = await page.$$eval('button, input, select, textarea, a[href]', nodes => nodes.length);
    expect(interactiveCount).toBe(0);

    // Assert no <script> tags are present in the DOM (the page's JS is inside a <pre>, not executed)
    const scriptTags = await page.$$eval('script', nodes => nodes.length);
    expect(scriptTags).toBe(0);

    // Since FSM had no transitions, also assert there are no elements that would commonly represent transitions
    // (no elements with data-transition attributes)
    const transitionNodes = await page.$$eval('[data-transition]', nodes => nodes.length);
    expect(transitionNodes).toBe(0);
  });

  test('FSM entry action check: renderPage() is not defined on window (JS code is not executed)', async ({ page }) => {
    // This test validates the FSM metadata: entry action renderPage() exists as a spec, but the page does not execute JS.
    await page.goto(PAGE_URL, { waitUntil: 'load' });

    // Access the page global to check whether a function named renderPage exists.
    // We do NOT inject/define it; we only observe whether it exists naturally.
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined'); // consistent with the note: JavaScript code is not executed

    // Also assert that there is no global function named prim on window
    const primType = await page.evaluate(() => typeof window.prim);
    expect(primType).toBe('undefined');
  });

  test('Code snippet presence: the JS example is rendered inside <pre> and not executed', async ({ page }) => {
    // Ensure the code snippet text is present inside the <pre> block and that it contains the expected function name and console.log call
    await page.goto(PAGE_URL, { waitUntil: 'load' });

    const preText = await page.locator('pre').textContent();
    expect(preText).not.toBeNull();
    const code = preText;

    // Check for key substrings that appear in the provided code example
    expect(code).toContain('function prim(graph, start)');
    expect(code).toContain("console.log('Minimum Spanning Tree');");
    expect(code).toContain("let graph = {");
    expect(code).toContain("let startVertex = 'A';");

    // Because the code is inside <pre> (not <script>), it should not have executed.
    // Confirm there are no console messages that indicate the example ran.
    // Wait briefly to ensure any synchronous console messages would have been captured
    await page.waitForTimeout(100);
    const foundExecutionLog = consoleMessages.some(m => m.text.includes('Minimum Spanning Tree'));
    expect(foundExecutionLog).toBe(false);
  });

  test('No runtime ReferenceError / SyntaxError / TypeError observed during page load', async ({ page }) => {
    // This test captures runtime exceptions that occur naturally during page load.
    await page.goto(PAGE_URL, { waitUntil: 'load' });

    // Allow a short time for any asynchronous errors to surface
    await page.waitForTimeout(100);

    // We collected console errors and page errors via listeners in beforeEach.
    // Assert that there were no uncaught page errors
    expect(pageErrors.length).toBe(0);

    // Assert that there were no console.error messages
    expect(consoleErrors.length).toBe(0);

    // Additionally, scan all console messages to ensure none carry names of the common runtime errors
    const combinedConsoleText = consoleMessages.map(m => m.text).join(' || ');
    expect(combinedConsoleText).not.toContain('ReferenceError');
    expect(combinedConsoleText).not.toContain('SyntaxError');
    expect(combinedConsoleText).not.toContain('TypeError');
  });

  test('Edge case: querying non-existent elements should return null/empty without throwing', async ({ page }) => {
    // Validate robustness of DOM querying on this static page
    await page.goto(PAGE_URL, { waitUntil: 'load' });

    // Query for an element that does not exist and ensure we get null and not an exception
    const nonExistent = await page.$('.this-element-does-not-exist');
    expect(nonExistent).toBeNull();

    // Query for many nodes and expect empty array
    const many = await page.$$eval('.another-non-existent-class', nodes => nodes.map(n => n.textContent));
    expect(Array.isArray(many)).toBe(true);
    expect(many.length).toBe(0);
  });

  test('Sanity: Page structure matches the FSM extraction summary (one state, static content)', async ({ page }) => {
    // This test ties back to the FSM meta: one state (Idle) with static evidence. Validate the visible DOM structure reflects that.
    await page.goto(PAGE_URL, { waitUntil: 'load' });

    // The page should contain exactly one top-level H1 and several H2 sections as captured earlier
    const h1Count = await page.$$eval('h1', nodes => nodes.length);
    expect(h1Count).toBe(1);

    // Ensure the body contains significant static text content (not empty)
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(50);

    // Because the FSM reported no detected components or event handlers, assert there are no elements with inline onclick attributes
    const onclickCount = await page.$$eval('[onclick]', nodes => nodes.length);
    expect(onclickCount).toBe(0);
  });
});