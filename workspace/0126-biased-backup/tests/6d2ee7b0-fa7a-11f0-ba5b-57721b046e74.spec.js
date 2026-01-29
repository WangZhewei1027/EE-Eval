import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2ee7b0-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('Kruskal\'s Algorithm Interactive - Page Load and Error Observation', () => {
  // Collect console and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Attach handlers early so we capture errors emitted during page load
    page.context()._consoleMessages = [];
    page.on('console', msg => {
      // store console messages for later assertions
      page.context()._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.context()._pageErrors = [];
    page.on('pageerror', err => {
      page.context()._pageErrors.push(String(err));
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test('Page should emit a SyntaxError during script parsing (detect broken renderEdge)', async ({ page }) => {
    // This test validates that the provided HTML/JS contains a syntax error
    // We expect at least one console error or pageerror indicating a SyntaxError.
    const consoleMessages = page.context()._consoleMessages || [];
    const pageErrors = page.context()._pageErrors || [];

    // Combine messages for easier assertions
    const allMessages = consoleMessages.map(m => m.text).concat(pageErrors);

    // Expect at least one error-like message
    expect(allMessages.length).toBeGreaterThan(0);

    // Look for indications of a SyntaxError or the broken token "edge line" introduced in the source
    const foundSyntax = allMessages.some(text =>
      /SyntaxError/i.test(text) || /Unexpected token/i.test(text) || /edge line/i.test(text) || /edge\s+line/i.test(text)
    );

    expect(foundSyntax).toBeTruthy();
  });

  test('No global algorithm functions should be defined due to script failure', async ({ page }) => {
    // Because the script has a syntax error, global functions like addRandomNode should NOT be defined.
    // This checks that the runtime did not create expected functions.
    const globals = await page.evaluate(() => {
      return {
        addRandomNode: typeof window.addRandomNode,
        startEdgeCreation: typeof window.startEdgeCreation,
        clearGraph: typeof window.clearGraph,
        generateRandomGraph: typeof window.generateRandomGraph,
        startKruskal: typeof window.startKruskal,
        performNextStep: typeof window.performNextStep,
        resetAlgorithm: typeof window.resetAlgorithm
      };
    });

    // All these should be 'undefined' because the script didn't evaluate successfully
    for (const key of Object.keys(globals)) {
      expect(globals[key]).toBe('undefined');
    }
  });
});

test.describe('Kruskal FSM Controls - Interactions when script failed (observe no-op behavior)', () => {
  test.beforeEach(async ({ page }) => {
    page.context()._consoleMessages = [];
    page.on('console', msg => page.context()._consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.context()._pageErrors = [];
    page.on('pageerror', err => page.context()._pageErrors.push(String(err)));
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test('Add Node button should not add a node when script parsing failed', async ({ page }) => {
    // Verify initial state according to HTML (Idle): status text is "Ready"
    const status = await page.locator('#status').textContent();
    expect(status).toBeTruthy();
    expect(status.trim()).toBe('Ready');

    // Click Add Node (FSM transition S0_Idle -> S1_AddingNode expected in a working app)
    await page.click('#add-node');

    // Because the script failed to parse, no .node elements should be created
    const nodeCount = await page.locator('.node').count();
    expect(nodeCount).toBe(0);

    // And status should remain unchanged (no onEnter actions executed)
    const statusAfter = await page.locator('#status').textContent();
    expect(statusAfter.trim()).toBe('Ready');
  });

  test('Add Edge button should not enter edge creation mode; no .active class toggled', async ({ page }) => {
    // Click Add Edge (would normally set .active and change status)
    await page.click('#add-edge');

    // The button should NOT have 'active' class because event listeners were not attached
    const hasActive = await page.locator('#add-edge').evaluate(el => el.classList.contains('active'));
    expect(hasActive).toBe(false);

    // Status should remain 'Ready'
    const status = await page.locator('#status').textContent();
    expect(status.trim()).toBe('Ready');
  });

  test('Generate Random Graph should not populate nodes or edges when script failed', async ({ page }) => {
    // Ensure inputs exist and have expected attributes (edge case: UI exists even if script broken)
    const nodeCountValue = await page.locator('#node-count').inputValue();
    expect(nodeCountValue).toBe('5'); // default value from markup

    // Click Generate Random Graph
    await page.click('#random-graph');

    // Because the script failed, graph container remains empty
    const nodes = await page.locator('#graph-container .node').count();
    const edges = await page.locator('#graph-container .edge').count();
    expect(nodes).toBe(0);
    expect(edges).toBe(0);

    // Edge list table body remains empty
    const edgeListRows = await page.locator('#edge-list tbody tr').count();
    expect(edgeListRows).toBe(0);

    // Status should remain 'Ready' (script did not run generateRandomGraph to change it)
    const status = await page.locator('#status').textContent();
    expect(status.trim()).toBe('Ready');
  });

  test('Start Kruskal and Next Step should not run algorithm; edge list remains empty', async ({ page }) => {
    // Click Start Kruskal
    await page.click('#start-kruskal');

    // Because the script failed, sorted edges and disjoint set UI will not be populated
    const edgeListRows = await page.locator('#edge-list tbody tr').count();
    expect(edgeListRows).toBe(0);

    // Click Next Step (should not throw, but also should not change anything)
    await page.click('#next-step');

    // Still no rows in edge list
    const edgeListRowsAfter = await page.locator('#edge-list tbody tr').count();
    expect(edgeListRowsAfter).toBe(0);

    // Status should remain the static initial string
    const status = await page.locator('#status').textContent();
    expect(status.trim()).toBe('Ready');
  });

  test('Reset Algorithm and Clear Graph are no-ops when script failed', async ({ page }) => {
    // Click Reset Algorithm
    await page.click('#reset-algo');

    // No disjoint set UI updates expected
    const setStatusRows = await page.locator('#set-status tbody tr').count();
    expect(setStatusRows).toBe(0);

    // Click Clear Graph
    await page.click('#clear');

    // Graph container remains empty (it was empty to begin with)
    const nodes = await page.locator('#graph-container .node').count();
    expect(nodes).toBe(0);

    // Status remains the same (script did not run clearGraph to change it)
    const status = await page.locator('#status').textContent();
    expect(status.trim()).toBe('Ready');
  });

  test('Inputs enforce attributes in DOM even if JS broken (edge-case verification)', async ({ page }) {
    // Verify min/max attributes for node count input exist
    const min = await page.locator('#node-count').getAttribute('min');
    const max = await page.locator('#node-count').getAttribute('max');
    const value = await page.locator('#node-count').getAttribute('value');
    expect(min).toBe('3');
    expect(max).toBe('15');
    expect(value).toBe('5');

    // Try setting an out-of-range value via DOM and confirm browser enforces when reading .valueAsNumber
    await page.fill('#node-count', '2'); // below min
    const valAsNumber = await page.locator('#node-count').evaluate(el => el.valueAsNumber);
    // The browser still sets the value attribute to 2, but script would normally validate; here we ensure DOM reflects input
    expect(typeof valAsNumber).toBe('number');
  });
});

test.describe('Observability: Console & Page Errors remain after interactions', () => {
  test('Console and page errors should be present and persistent after user interactions', async ({ page }) => {
    const collected = [];
    page.on('console', msg => collected.push({ type: msg.type(), text: msg.text() }));
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(String(e)));

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Perform a sequence of actions that would normally exercise the app
    await page.click('#add-node');
    await page.click('#add-edge');
    await page.click('#random-graph');
    await page.click('#start-kruskal');
    await page.click('#next-step');
    await page.click('#reset-algo');
    await page.click('#clear');

    // Wait briefly to allow any late errors to surface
    await page.waitForTimeout(200);

    const allMsgs = collected.map(m => m.text).concat(pageErrors);

    // We expect at least one SyntaxError or similar parsing/runtime error to be present
    const hasError = allMsgs.some(t => /SyntaxError|Unexpected token|Unexpected identifier|edge line/i.test(t));
    expect(hasError).toBeTruthy();
  });
});