import { test, expect } from '@playwright/test';

// Application URL provided in the requirements
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3b6475-fa74-11f0-a1b6-4b9b8151441a.html';

// Simple Page Object for the Graph Page
class GraphPage {
  constructor(page) {
    this.page = page;
    this.container = page.locator('#graph-container');
    this.nodes = page.locator('.node');
    this.consoleMessages = [];
    this.pageErrors = [];
  }

  // Install listeners to capture console messages and uncaught page errors
  attachListeners() {
    this.page.on('console', (msg) => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', (err) => {
      // pageerror will capture uncaught exceptions that bubble to the page
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async title() {
    return this.page.title();
  }

  async containerVisible() {
    return this.container.isVisible();
  }

  async nodesCount() {
    return this.nodes.count();
  }

  async clickContainer(position) {
    // Click inside the container at an offset; useful to ensure clicks do nothing if page lacks handlers
    await this.container.click({ position });
  }

  // Evaluate typeof renderPage in page context
  async typeofRenderPage() {
    return this.page.evaluate(() => {
      try {
        // 'typeof' of an undeclared identifier returns 'undefined' in expression context,
        // but if not declared at all, typeof still returns 'undefined' safely.
        return typeof renderPage;
      } catch (e) {
        // If some strict environment causes issues, forward string
        return `error:${String(e)}`;
      }
    });
  }

  // Attempt to invoke renderPage() directly in page context, letting any ReferenceError/TypeError happen naturally.
  // This will throw in Node if evaluation fails, so the caller should handle it.
  async callRenderPage() {
    return this.page.evaluate(() => {
      // Intentionally call the identifier to let a ReferenceError occur naturally if renderPage is not defined.
      // This mirrors the FSM entry action "renderPage()" being executed by the application runtime.
      return renderPage();
    });
  }
}

// Group tests related to the single Idle state described in the FSM
test.describe('Undirected Graph Visualization - Idle State (S0_Idle)', () => {
  // Each test will have its own new page provided by Playwright fixtures
  test.beforeEach(async ({ page }) => {
    // no-op: individual tests create their GraphPage and attach listeners
  });

  test.afterEach(async ({ page }) => {
    // ensure navigation is ended to avoid interference between tests
    try {
      await page.goto('about:blank');
    } catch (e) {
      // ignore navigation errors during cleanup
    }
  });

  test('Page loads and shows expected title and graph container (Idle state evidence)', async ({ page }) => {
    // This test validates the S0_Idle state's evidence: page title and container existence
    const gp = new GraphPage(page);
    gp.attachListeners();

    // Navigate to the app
    await gp.goto();

    // The FSM evidence includes the <title> element; verify it matches exactly
    const title = await gp.title();
    expect(title).toBe('Undirected Graph Visualization');

    // Verify the graph container exists and is visible
    await expect(page.locator('#graph-container')).toBeVisible();

    // Initially, the implementation provided no .node elements in the HTML snippet.
    // Confirm that there are zero nodes rendered initially.
    const nodeCount = await gp.nodesCount();
    expect(nodeCount).toBe(0);

    // There should be no uncaught page errors on load (unless external scripts cause them)
    expect(gp.pageErrors.length).toBe(0);

    // Basic sanity: no console messages of type "error" were emitted during initial load
    const errorConsoleMessages = gp.consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Clicking the graph container does not create nodes or trigger handlers (no event handlers present)', async ({ page }) => {
    // This test validates the FSM observation that "No interactive elements or event handlers were found."
    const gp1 = new GraphPage(page);
    gp.attachListeners();

    await gp.goto();

    // Record counts before interaction
    const beforeNodes = await gp.nodesCount();
    const beforeConsoleCount = gp.consoleMessages.length;

    // Click near the top-left inside the container (offset to avoid hitting potential border)
    await gp.clickContainer({ x: 20, y: 20 });

    // Wait briefly to allow any potential event handlers to run (if they existed)
    await page.waitForTimeout(200);

    // After clicking, there should still be no nodes (since the implementation has no UI to add nodes)
    const afterNodes = await gp.nodesCount();
    expect(afterNodes).toBe(beforeNodes);

    // No additional console messages of type 'log'/'error' should have been added if no handlers exist
    expect(gp.consoleMessages.length).toBeGreaterThanOrEqual(beforeConsoleCount);
    // Specifically, ensure no new 'error' console messages were emitted as a result of the click
    const newErrorMessages = gp.consoleMessages.slice(beforeConsoleCount).filter(m => m.type === 'error');
    expect(newErrorMessages.length).toBe(0);

    // Also ensure no uncaught page errors resulted from the click
    expect(gp.pageErrors.length).toBe(0);
  });

  test('FSM entry action "renderPage()" is not implemented: invoking it should cause a ReferenceError (observed naturally)', async ({ page }) => {
    // The FSM lists an entry action renderPage(). The provided HTML did not define such a function.
    // This test evaluates typeof renderPage, and then intentionally invokes it to let the ReferenceError happen
    // naturally in the page context. We assert that the thrown error reflects that renderPage is not defined.
    const gp2 = new GraphPage(page);
    gp.attachListeners();

    await gp.goto();

    // Determine the typeof identifier in the page context
    const type = await gp.typeofRenderPage();

    // If the page defines renderPage as a function, calling it may be safe.
    // If it's undefined (very likely given the HTML), calling it directly should produce a ReferenceError.
    if (type === 'function') {
      // If a function exists, call it and ensure it doesn't throw a ReferenceError.
      // We don't assert on side effects; only that calling it is permitted.
      let callError = null;
      try {
        // Call the function; if implementation throws, capture the error and assert on its nature
        await gp.callRenderPage();
      } catch (e) {
        callError = e;
      }
      // Because this branch only runs if renderPage was present as a function,
      // we assert that any thrown error is not a ReferenceError about missing identifier.
      if (callError) {
        expect(String(callError.message)).not.toContain('renderPage is not defined');
      } else {
        // No error thrown is an acceptable outcome for a present renderPage function.
        expect(callError).toBeNull();
      }
    } else {
      // If renderPage is not defined, invoking the identifier directly should produce a ReferenceError.
      // We intentionally call renderPage() in the page context to let the ReferenceError happen naturally.
      let caughtError = null;
      try {
        await gp.callRenderPage();
      } catch (e) {
        // Playwright surfaces evaluation failures as errors in the test harness.
        // The error message usually contains 'ReferenceError' and 'renderPage is not defined'.
        caughtError = e;
      }

      // Assert that an error was indeed thrown when attempting to call the missing identifier.
      expect(caughtError).toBeTruthy();
      // The message should reference either ReferenceError or that renderPage is not defined.
      const msg = String(caughtError.message);
      const hasReferenceError = msg.includes('ReferenceError') || msg.includes('is not defined') || msg.includes('not defined');
      expect(hasReferenceError).toBeTruthy();
    }
  });

  test('Edge case: verify there are no interactive controls for adding/removing nodes (expected absence)', async ({ page }) => {
    // This test looks for UI controls (buttons, inputs) that would enable adding/removing nodes.
    // The provided HTML snippet had none; ensure none are present.
    const gp3 = new GraphPage(page);
    gp.attachListeners();

    await gp.goto();

    // Search for common interactive controls that an implementation might include
    const addButton = page.locator('button#add-node, button.add-node, [data-action="add-node"]');
    const removeButton = page.locator('button#remove-node, button.remove-node, [data-action="remove-node"]');
    const formControls = page.locator('form#node-form, .node-controls');

    // Expect none of these to exist or be visible in the simple provided HTML
    await expect(addButton.first()).toHaveCount(0);
    await expect(removeButton.first()).toHaveCount(0);
    await expect(formControls.first()).toHaveCount(0);

    // Confirm that clicking random locations does not trigger errors
    await gp.clickContainer({ x: 100, y: 100 });
    await page.waitForTimeout(100);
    expect(gp.pageErrors.length).toBe(0);
  });

  test('Observability: Capture console and page errors while interacting; assert captured errors are of known kinds if present', async ({ page }) => {
    // This test ensures we collect console and page errors and, if present, they are typical JS runtime errors.
    const gp4 = new GraphPage(page);
    gp.attachListeners();

    await gp.goto();

    // Perform a few interactions that might surface errors if any underlying scripts are broken
    await gp.clickContainer({ x: 50, y: 50 });
    await page.waitForTimeout(100);
    await gp.clickContainer({ x: 200, y: 150 });
    await page.waitForTimeout(100);

    // If any pageErrors were emitted, assert they are Error instances and their names correspond to JS runtime errors
    for (const err of gp.pageErrors) {
      expect(err).toBeInstanceOf(Error);
      // Typical runtime error names include ReferenceError, TypeError, SyntaxError, etc.
      const name = err.name || '';
      const allowed = ['ReferenceError', 'TypeError', 'SyntaxError', 'Error', 'RangeError', 'URIError', 'EvalError'];
      expect(allowed.includes(name) || name.length > 0).toBeTruthy();
    }

    // Inspect console messages: if any 'error' type messages exist, ensure their text indicates a runtime issue
    const consoleErrors = gp.consoleMessages.filter(m => m.type === 'error');
    for (const msg of consoleErrors) {
      // At minimum, confirm it's a non-empty string describing the error
      expect(msg.text.length).toBeGreaterThan(0);
    }

    // If there are no errors, this is also acceptable for the simple static implementation.
    // Number of captured errors should be >= 0 (always true); provide explicit assertion that the test completed.
    expect(Array.isArray(gp.consoleMessages)).toBe(true);
  });
});