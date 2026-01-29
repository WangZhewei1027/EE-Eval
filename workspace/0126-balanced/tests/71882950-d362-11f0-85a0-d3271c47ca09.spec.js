import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/71882950-d362-11f0-85a0-d3271c47ca09.html';

test.describe('71882950-d362-11f0-85a0-d3271c47ca09 - Weighted Graph app (FSM: Idle)', () => {
  // Collect console and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture all console messages emitted by the page
    page.on('console', msg => {
      try {
        // combine location and text for easier debugging
        const location = msg.location();
        const text = msg.text();
        consoleMessages.push({ type: msg.type(), text, location });
      } catch (e) {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      }
    });

    // Capture uncaught exceptions
    page.on('pageerror', error => {
      pageErrors.push(error && error.message ? String(error.message) : String(error));
    });

    // Navigate to the application under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // cleanup arrays (not strictly necessary but keeps state isolated)
    consoleMessages = [];
    pageErrors = [];
  });

  test('Idle state: page renders static evidence (header and graph container)', async ({ page }) => {
    // This verifies the FSM Idle state's evidence: <h1>Weighted Graph</h1> and <div id="graph"></div>
    const header = page.locator('h1');
    await expect(header).toHaveText('Weighted Graph');

    const graph = page.locator('#graph');
    await expect(graph).toBeVisible();
    // Graph container should be empty in DOM (no children appended successfully by the broken script)
    await expect(graph.locator(':scope > *')).toHaveCount(0);
  });

  test('Script parsing/execution errors are observable in the page console or pageerror events', async ({ page }) => {
    // The provided inline script contains invalid JS (e.g., node.style.border-radius)
    // We expect at least one console or page error mentioning "SyntaxError" or "Unexpected"
    // Wait a short time to allow any async console messages to appear
    await page.waitForTimeout(200);

    // Combine messages for easier assertions
    const consoleTexts = consoleMessages.map(m => m.text).join(' | ');
    const pageErrorText = pageErrors.join(' | ');

    // Assert that we observed some error output
    const sawSyntaxLikeError =
      consoleTexts.includes('SyntaxError') ||
      consoleTexts.includes('Unexpected') ||
      pageErrorText.includes('SyntaxError') ||
      pageErrorText.includes('Unexpected');

    expect(sawSyntaxLikeError).toBeTruthy();

    // Helpful debug expectations to ensure at least one console or page error was captured
    expect(consoleMessages.length + pageErrors.length).toBeGreaterThan(0);
  });

  test('No graph nodes/edges/newNode elements are created when script fails', async ({ page }) => {
    // Because the script contains syntax errors, functions/DOM mutation blocks should not have executed.
    // Ensure that classes that would be added by the script do not exist.
    await expect(page.locator('.node')).toHaveCount(0);
    await expect(page.locator('.edge')).toHaveCount(0);
    await expect(page.locator('.newNode')).toHaveCount(0);

    // Also ensure that there are no inline elements appended to body besides expected elements.
    // We expect only the <h1>, <div id="graph"> and the <script> tag from the HTML to be present (the exact DOM may vary),
    // but at minimum assert that we don't find unexpected node colors/sizes created by script:
    const bodyChildrenCount = await page.evaluate(() => document.body.children.length);
    // Expect at least 2 children (h1 and #graph). If the script had worked it would have appended many more.
    expect(bodyChildrenCount).toBeLessThan(10);
  });

  test('Entry action "renderPage" and other script-defined identifiers are not available when parsing fails', async ({ page }) => {
    // The FSM entry action mentions renderPage(); because the inline script is invalid, renderPage should not be defined.
    // We inspect the global scope for these identifiers without modifying page environment.
    const types = await page.evaluate(() => {
      return {
        renderPage: typeof window.renderPage,
        addNode: typeof window.addNode,
        addEdge: typeof window.addEdge,
        updateWeightedGraph: typeof window.updateWeightedGraph,
        nodes: typeof window.nodes,
      };
    });

    // All of the above should be 'undefined' because the script failed to parse/execute.
    expect(types.renderPage).toBe('undefined');
    expect(types.addNode).toBe('undefined');
    expect(types.addEdge).toBe('undefined');
    expect(types.updateWeightedGraph).toBe('undefined');
    // 'nodes' variable would not be present as a global if script didn't execute
    expect(types.nodes === 'undefined' || types.nodes === 'object').toBeTruthy();
  });

  test('Missing DOM element #currentNode yields null if attempted to read by external code', async ({ page }) => {
    // The broken script attempted to reference an element with id "currentNode".
    // Confirm the element is absent rather than present with text content.
    const currentNodeExists = await page.locator('#currentNode').count();
    expect(currentNodeExists).toBe(0);

    // Accessing it via evaluate returns null; this asserts that the page does not accidentally create the element.
    const currentNodeType = await page.evaluate(() => {
      return document.getElementById('currentNode') === null ? 'null' : 'element';
    });
    expect(currentNodeType).toBe('null');
  });

  test('Edge case validation: attempting to use expected functions/types would be unsafe; verify safe guards', async ({ page }) => {
    // We must not inject or call missing functions. Instead, verify that calling typeof on potential functions is safe and returns expected strings.
    const globals = await page.evaluate(() => {
      return {
        typeofWindow: typeof window,
        typeofDocument: typeof document,
        typeofConsole: typeof console,
      };
    });

    expect(globals.typeofWindow).toBe('object');
    expect(globals.typeofDocument).toBe('object');
    expect(globals.typeofConsole).toBe('object');
  });

  test('Comprehensive sanity: ensure main static UI remains usable despite script errors', async ({ page }) => {
    // Even though the script is broken, the header and graph container should be visible and accessible.
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('#graph')).toBeVisible();

    // The graph container should have no injected content from the broken script.
    const graphChildCount = await page.evaluate(() => document.getElementById('graph').children.length);
    expect(graphChildCount).toBe(0);
  });
});