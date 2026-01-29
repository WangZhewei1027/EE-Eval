import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122bd7f3-fa7b-11f0-814c-dbec508f0b3b.html';

test.describe('DFS Interactive Application (FSM) - Application ID: 122bd7f3-fa7b-11f0-814c-dbec508f0b3b', () => {
  // Collect runtime diagnostics for each test run
  test.beforeEach(async ({ page }) => {
    // Attach listeners to capture page errors and console error messages
    page.context()._collectedPageErrors = [];
    page.context()._collectedConsoleErrors = [];

    page.on('pageerror', (err) => {
      // store the raw Error object message for later assertions
      page.context()._collectedPageErrors.push(String(err && err.message ? err.message : err));
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        // collect console error text
        page.context()._collectedConsoleErrors.push(msg.text());
      }
    });

    // Navigate to the application under test
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // We purposely do not attempt to patch or fix runtime errors in the loaded page.
  });

  test.afterEach(async ({ page }) => {
    // detach listeners to avoid interference between tests
    page.removeAllListeners('pageerror');
    page.removeAllListeners('console');
  });

  test('Initial Idle state: graph container exists and has expected dimensions set before errors occur', async ({ page }) => {
    // This validates the S0_Idle evidence: the #graph element should be present in the DOM.
    const graph = page.locator('#graph');
    await expect(graph).toBeVisible();

    // The script sets style.width/height before attempting to build the graph.
    // Confirm those inline styles were applied (string values like "800px" / "600px").
    const width = await graph.evaluate((el) => el.style.width);
    const height = await graph.evaluate((el) => el.style.height);
    expect(width).toBe('800px');
    expect(height).toBe('600px');

    // Because the implementation throws during graph creation (see other tests),
    // the innerHTML may remain empty. Validate that we at least have the element present.
    const innerHTML = await graph.evaluate((el) => el.innerHTML);
    // innerHTML might be empty string if creation failed early, assert that it's a string.
    expect(typeof innerHTML).toBe('string');
  });

  test('Runtime script error occurs during graph creation (expected TypeError from edge.children.push)', async ({ page }) => {
    // The implementation erroneously calls edge.children.push(...) without defining children on Edge,
    // which should produce a runtime TypeError. We assert that at least one pageerror was captured.
    const pageErrors = page.context()._collectedPageErrors;
    const consoleErrors = page.context()._collectedConsoleErrors;

    // Wait a short moment to allow any late console/pageerrors to arrive
    await page.waitForTimeout(250);

    // At least one pageerror should be present due to the broken implementation
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // The error message can vary across engines; we assert it contains indicative substrings.
    const combinedMessages = pageErrors.join(' | ').toLowerCase() + ' | ' + consoleErrors.join(' | ').toLowerCase();
    // Confirm the error mentions "children" or "push" or "cannot read" which are likely present in the TypeError
    expect(
      /children|push|cannot read|undefined|cannot set property/i.test(combinedMessages)
    ).toBeTruthy();
  });

  test('No .node DOM elements created due to script failure -> NodeClick event cannot be fired', async ({ page }) => {
    // The FSM expects .node elements to be clickable (NodeClick). Because the script fails,
    // no .node elements should exist. Validate that count is zero.
    const nodeCount = await page.locator('.node').count();
    expect(nodeCount).toBe(0);

    // Since there are no nodes, lifecycle transition to VisitingNode (S1_VisitingNode) cannot occur.
    // We attempt to click a .node and assert that Playwright will reject the action.
    // We intentionally set a short timeout to fail fast for this expected failure scenario.
    await expect(page.click('.node', { timeout: 1000 })).rejects.toThrowError();
  });

  test('DFS function is not globally exposed (scoped inside createGraph) -> cannot be invoked from outside', async ({ page }) => {
    // The script declares dfs as an inner function of createGraph, so it should not be global.
    const dfsType = await page.evaluate(() => {
      try {
        // Accessing a top-level name; if undefined, will return 'undefined'
        return typeof dfs;
      } catch (e) {
        // If accessing causes an error (should not), return the error string
        return 'error:' + String(e && e.message ? e.message : e);
      }
    });

    // Expect dfs is undefined in the global scope - meaning external triggers cannot call it directly.
    expect(dfsType).toBe('undefined');
  });

  test('No .current or .visited state is reflected in DOM classes after attempted interactions', async ({ page }) => {
    // The FSM S1 and S2 expect node.current and edge.visited toggles.
    // In this implementation, these are object properties and also the DOM is never updated with classes.
    // Because of the script error, there should be no elements with .current or .visited classes.
    const currentCount = await page.locator('.current').count();
    const visitedCount = await page.locator('.visited').count();

    expect(currentCount).toBe(0);
    expect(visitedCount).toBe(0);

    // Attempting to click the graph area should not cause those classes to appear (no side-effect).
    await page.click('#graph');
    // Wait shortly to allow any synchronous side-effects (if any) - none are expected
    await page.waitForTimeout(100);

    const currentCountAfter = await page.locator('.current').count();
    const visitedCountAfter = await page.locator('.visited').count();
    expect(currentCountAfter).toBe(0);
    expect(visitedCountAfter).toBe(0);
  });

  test('Edge-case diagnostics: Node and Edge constructors are defined, but graph formation failed', async ({ page }) => {
    // Node and Edge are declared globally in the page script prior to createGraph execution.
    // We can check their existence (they should be functions).
    const constructors = await page.evaluate(() => {
      return {
        Node: typeof Node,
        Edge: typeof Edge,
      };
    });

    expect(constructors.Node).toBe('function');
    expect(constructors.Edge).toBe('function');

    // Although constructors exist, the object graph building failed during createGraph.
    // Re-assert that there are no ".edge" DOM elements produced by the failed creation.
    const edgeCount = await page.locator('.edge').count();
    expect(edgeCount).toBe(0);
  });

  test('Additional sanity: capture and assert that console/page errors are reported to the developer (observability)', async ({ page }) => {
    // Ensure we captured at least one console error or page error to simulate real-world observability
    const pageErrors = page.context()._collectedPageErrors;
    const consoleErrors = page.context()._collectedConsoleErrors;

    // Wait briefly for any residual console messages
    await page.waitForTimeout(100);

    // At least one of these should have been populated due to the known bug in the HTML implementation
    expect(pageErrors.length + consoleErrors.length).toBeGreaterThanOrEqual(1);

    // Provide additional assertions that the messages are meaningful (contain keywords)
    const combined = (pageErrors.concat(consoleErrors)).join(' ').toLowerCase();
    expect(/children|push|cannot read|undefined|error/i.test(combined)).toBeTruthy();
  });
});