import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04420df2-fa79-11f0-8a8e-bbe4f11717c6.html';

test.describe('Application 04420df2-fa79-11f0-8a8e-bbe4f11717c6 - Graph (Undirected) UI', () => {
  // Arrays to capture runtime diagnostics for each test
  let consoleMessages = [];
  let pageErrors = [];
  let consoleHandler;
  let pageErrorHandler;

  // Register listeners before each test and navigate to the page
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    consoleHandler = (msg) => {
      // Capture console messages as Playwright ConsoleMessage objects
      consoleMessages.push(msg);
    };
    pageErrorHandler = (err) => {
      // Capture unhandled page errors (exceptions) thrown in page context
      pageErrors.push(err);
    };

    page.on('console', consoleHandler);
    page.on('pageerror', pageErrorHandler);

    // Load the page exactly as-is and wait for load event
    await page.goto(APP_URL, { waitUntil: 'load' });
    // give some time for scripts to run and for any async errors to surface
    await page.waitForTimeout(250);
  });

  // Clean up listeners after each test to avoid duplicate captures across tests
  test.afterEach(async ({ page }) => {
    if (consoleHandler) page.off('console', consoleHandler);
    if (pageErrorHandler) page.off('pageerror', pageErrorHandler);
  });

  test.describe('S0_Idle state verification (entry actions: renderPage())', () => {
    test('Idle state: DOM structure for graph is present with expected node/edge counts', async ({ page }) => {
      // Validate the high-level evidence for S0_Idle: .graph-container and .graph exist
      const graphContainer = page.locator('.graph-container');
      const graph = page.locator('.graph');

      await expect(graphContainer).toBeVisible();
      await expect(graph).toBeVisible();

      // Validate number of nodes and edges (as per provided HTML: 1 node, 3 edges)
      const nodeCount = await page.locator('.node').count();
      const edgeCount = await page.locator('.edge').count();

      expect(nodeCount).toBe(1);
      expect(edgeCount).toBe(3);

      // Validate inline styles applied to node and edges match expected color values from HTML
      // Node background-color: #f2f2f2 => rgb(242, 242, 242)
      const nodeBg = await page.$eval('.node', (el) => {
        return window.getComputedStyle(el).backgroundColor;
      });
      expect(nodeBg.replace(/\s+/g, '')).toContain('rgb(242,242,242)');

      // Edge background-color: #ccc => rgb(204, 204, 204)
      const firstEdgeBg = await page.$eval('.edge', (el) => {
        return window.getComputedStyle(el).backgroundColor;
      });
      expect(firstEdgeBg.replace(/\s+/g, '')).toContain('rgb(204,204,204)');
    });

    test('Idle state: No interactive controls (buttons/inputs/links) are present', async ({ page }) => {
      // The FSM/extraction indicated no interactive elements; assert there are none
      const buttonCount = await page.locator('button').count();
      const inputCount = await page.locator('input').count();
      const linkCount = await page.locator('a').count();
      const selectCount = await page.locator('select').count();
      const textareaCount = await page.locator('textarea').count();

      expect(buttonCount).toBe(0);
      expect(inputCount).toBe(0);
      expect(linkCount).toBe(0);
      expect(selectCount).toBe(0);
      expect(textareaCount).toBe(0);
    });

    test('Entry action renderPage(): observe console logs or page errors (do not patch runtime)', async ({ page }) => {
      // This test validates the entry action mentioned in the FSM:
      // We do NOT attempt to call or define renderPage; instead we observe runtime behavior.
      // Acceptable observations:
      // - The page logs something referencing "renderPage" (script invoked it or logged)
      // - The page throws an error (ReferenceError/TypeError/SyntaxError) related to missing function/script
      // We assert that one of these observable outcomes happened.

      // Allow additional time for any scripts to execute further
      await page.waitForTimeout(250);

      // Count console error messages
      const consoleErrorCount = consoleMessages.filter((m) => m.type() === 'error').length;
      // Check if any console message text references 'renderPage'
      const renderPageLogged = consoleMessages.some((m) => {
        try {
          return m.text().toLowerCase().includes('renderpage');
        } catch {
          return false;
        }
      });
      // Check if any page error refers to renderPage or is an obvious runtime error
      const pageErrorRelated = pageErrors.some((err) => {
        const msg = String(err && err.message ? err.message : err).toLowerCase();
        return msg.includes('renderpage') || msg.includes('referenceerror') || msg.includes('syntaxerror') || msg.includes('typeerror') || msg.includes('error');
      });

      // For traceability in test failure logs, attach diagnostics
      test.info().attachments.push({
        name: 'console-messages',
        contentType: 'text/plain',
        body: consoleMessages.map((m) => `[${m.type()}] ${m.text()}`).join('\n') || '(no console messages)'
      });
      test.info().attachments.push({
        name: 'page-errors',
        contentType: 'text/plain',
        body: pageErrors.map((e) => String(e && e.message ? e.message : e)).join('\n') || '(no page errors)'
      });

      // Assert that we observed either a renderPage log or an error. Per instructions,
      // allow runtime errors to occur naturally and assert that these diagnostics are present.
      const totalObservations = (renderPageLogged ? 1 : 0) + consoleErrorCount + (pageErrorRelated ? 1 : 0);
      expect(totalObservations).toBeGreaterThan(0);
    });

    test('Clicking the node: ensure DOM stable and observe any additional errors', async ({ page }) => {
      // This test attempts an interaction (click on node). FSM reports no handlers,
      // so clicking should not change DOM structure. We also monitor runtime errors produced by the click.
      const nodeLocator = page.locator('.node');
      await expect(nodeLocator).toHaveCount(1);

      // Capture counts before click
      const beforeNodeCount = await page.locator('.node').count();
      const beforeEdgeCount = await page.locator('.edge').count();
      const beforeConsoleErrors = consoleMessages.filter((m) => m.type() === 'error').length;
      const beforePageErrors = pageErrors.length;

      // Perform the click
      await nodeLocator.click();

      // Wait a short time for potential side effects
      await page.waitForTimeout(200);

      // Capture counts after click
      const afterNodeCount = await page.locator('.node').count();
      const afterEdgeCount = await page.locator('.edge').count();
      const afterConsoleErrors = consoleMessages.filter((m) => m.type() === 'error').length;
      const afterPageErrors = pageErrors.length;

      // The DOM should remain stable (no handlers were defined in extracted FSM)
      expect(afterNodeCount).toBe(beforeNodeCount);
      expect(afterEdgeCount).toBe(beforeEdgeCount);

      // It's valid for the page to produce errors on user interaction if underlying scripts are faulty.
      // We'll assert that at minimum the runtime did not silently crash the page (graph container still visible).
      await expect(page.locator('.graph-container')).toBeVisible();

      // If new errors appeared after click, record them in test artifacts for debugging.
      const newConsoleErrors = afterConsoleErrors - beforeConsoleErrors;
      const newPageErrors = afterPageErrors - beforePageErrors;

      test.info().attachments.push({
        name: 'click-diagnostics',
        contentType: 'text/plain',
        body: `newConsoleErrors=${newConsoleErrors}, newPageErrors=${newPageErrors}`
      });

      // No strict assertion on new errors (they may or may not occur). However ensure the page still retains expected DOM.
      expect(afterNodeCount).toBe(1);
      expect(afterEdgeCount).toBe(3);
    });
  });

  test.describe('Edge cases and robustness checks', () => {
    test('Page does not expose interactive components via ARIA roles unexpectedly', async ({ page }) => {
      // Ensure there are no elements with role that would imply interactive controls
      const interactiveRoles = ['button', 'link', 'textbox', 'checkbox', 'radio', 'switch', 'menuitem'];
      for (const role of interactiveRoles) {
        const count = await page.locator(`[role="${role}"]`).count();
        expect(count).toBe(0);
      }
    });

    test('No unexpected global variables injected into window scope by the page (basic smoke)', async ({ page }) => {
      // We will not modify the page or globals; simply sample a few common globals to ensure no blatant pollution.
      // This test is defensive and only asserts that the page did not replace essential host globals.
      const globalsOk = await page.evaluate(() => {
        return {
          hasWindow: typeof window !== 'undefined',
          hasDocument: typeof document !== 'undefined',
          typeofFetch: typeof fetch,
          typeofConsole: typeof console
        };
      });

      expect(globalsOk.hasWindow).toBe(true);
      expect(globalsOk.hasDocument).toBe(true);
      expect(['function', 'object']).toContain(globalsOk.typeofConsole);
      // fetch may be undefined in some environments, but shouldn't be overridden as 'string' etc
      expect(['function', 'object', 'undefined']).toContain(globalsOk.typeofFetch);
    });
  });
});