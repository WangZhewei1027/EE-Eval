import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3c00b0-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('Dijkstra Visualization App (de3c00b0-fa74-11f0-a1b6-4b9b8151441a)', () => {
  // Arrays to capture page errors and console messages for assertions
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture runtime errors (ReferenceError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      // err is an Error object from the page context
      pageErrors.push(err.message || String(err));
    });

    // Capture console messages (useful to assert script parse/runtime logs)
    page.on('console', (msg) => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    });

    // Navigate to the page and wait for load event
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait a moment to allow any synchronous script parse errors / console output to surface
    await page.waitForTimeout(200);
  });

  test.afterEach(async () => {
    // Clean up arrays (not strictly necessary, present for clarity)
    pageErrors = [];
    consoleMessages = [];
  });

  test('Page should load and report script errors (SyntaxError expected from broken addEdge implementation)', async ({ page }) => {
    // This test asserts that the page emitted at least one pageerror due to the deliberate syntax error
    // introduced in the HTML (the "if (const existingEdge = ...)" line).
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // At least one of the errors should indicate a SyntaxError or unexpected token / reference to 'existingEdge'
    const concatenated = pageErrors.join(' | ');
    const hasSyntax = /SyntaxError|Unexpected token|existingEdge|unexpected token/i.test(concatenated);
    expect(hasSyntax).toBeTruthy();

    // Also ensure the browser console captured something (helpful for debugging)
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });

  test.describe('UI structure and components', () => {
    test('should have the expected control buttons and panels present in the DOM', async ({ page }) => {
      // Verify presence and text of each control button
      const addNodeText = await page.locator('#add-node').innerText();
      expect(addNodeText).toContain('Add Node');

      const addEdgeText = await page.locator('#add-edge').innerText();
      expect(addEdgeText).toContain('Add Edge');

      const setStartText = await page.locator('#set-start').innerText();
      expect(setStartText).toContain('Set Start Node');

      const setEndText = await page.locator('#set-end').innerText();
      expect(setEndText).toContain('Set End Node');

      const runText = await page.locator('#run-algorithm').innerText();
      expect(runText).toContain("Run Dijkstra");

      const resetText = await page.locator('#reset').innerText();
      expect(resetText).toContain('Reset');

      // Verify graph container and info panel exist
      await expect(page.locator('#graph-container')).toBeVisible();
      await expect(page.locator('#info-panel')).toBeVisible();

      // Initially, graph container should be empty (no nodes) because script didn't run
      const nodesCount = await page.locator('#graph-container .node').count();
      expect(nodesCount).toBe(0);
    });
  });

  test.describe('FSM events and transitions (attempts and expected failures)', () => {
    test('Clicking Add Node / Graph click should NOT create nodes because script failed to initialize', async ({ page }) => {
      // Click Add Node button
      await page.click('#add-node');

      // Click the center of the graph container to simulate adding a node
      const graphBox = await page.locator('#graph-container').boundingBox();
      // If boundingBox is null for any reason, fail gracefully
      expect(graphBox).not.toBeNull();

      if (graphBox) {
        const cx = graphBox.x + graphBox.width / 2;
        const cy = graphBox.y + graphBox.height / 2;
        await page.mouse.click(cx, cy);
      }

      // Wait briefly for any handlers (if they were attached) to run
      await page.waitForTimeout(100);

      // Because the script has a syntax error, event listeners likely didn't attach.
      // Assert that no node elements were created.
      const nodesCountAfter = await page.locator('#graph-container .node').count();
      expect(nodesCountAfter).toBe(0);

      // Also assert that the global 'mode' variable was not defined (script didn't initialize)
      const modeType = await page.evaluate(() => typeof window.mode);
      expect(modeType).toBe('undefined');
    });

    test('Clicking Add Edge button and attempting to add an edge should not modify the graph', async ({ page }) => {
      // Click Add Edge button
      await page.click('#add-edge');

      // Simulate clicks on graph (would normally select nodes) - here nothing should happen
      const graphBox1 = await page.locator('#graph-container').boundingBox();
      expect(graphBox).not.toBeNull();

      if (graphBox) {
        await page.mouse.click(graphBox.x + 50, graphBox.y + 50);
        await page.mouse.click(graphBox.x + 100, graphBox.y + 100);
      }

      await page.waitForTimeout(100);

      // There should be no edges drawn (edge elements have class 'edge')
      const edgesCount = await page.locator('#graph-container .edge').count();
      expect(edgesCount).toBe(0);
    });

    test('Clicking Set Start / Set End buttons should not set node classes (no nodes exist)', async ({ page }) => {
      // Click set start and set end
      await page.click('#set-start');
      await page.click('#set-end');

      // No nodes exist so nothing to set; ensure no .start or .end elements present
      const startCount = await page.locator('#graph-container .node.start').count();
      const endCount = await page.locator('#graph-container .node.end').count();
      expect(startCount).toBe(0);
      expect(endCount).toBe(0);
    });

    test('Clicking Run Algorithm should not run Dijkstra (handler not attached); page error(s) should already be present', async ({ page }) => {
      // Click run algorithm
      await page.click('#run-algorithm');

      // Wait to allow any (non-existent) handler to execute
      await page.waitForTimeout(100);

      // Assert that steps div is empty
      const stepsHtml = await page.locator('#steps').innerHTML();
      expect(stepsHtml.trim()).toBe('');

      // Confirm page errors exist (from earlier script parse)
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    });

    test('Clicking Reset should not cause errors but will not change state due to broken script', async ({ page }) => {
      // Click reset
      await page.click('#reset');

      // Wait a short moment
      await page.waitForTimeout(50);

      // Assert graph remains empty
      const nodesCount1 = await page.locator('#graph-container .node').count();
      expect(nodesCount).toBe(0);

      // Distance table should be empty as script didn't initialize it
      const distanceRows = await page.locator('#distance-table tbody tr').count();
      expect(distanceRows).toBe(0);
    });
  });

  test.describe('Direct function invocation attempts (should raise ReferenceError due to broken script)', () => {
    // The page script contains a syntax error which prevents defining its functions.
    // These tests attempt to call those functions directly and expect ReferenceError-like failures.

    const functionNames = [
      'addNode',
      'addEdge',
      'runDijkstra',
      'resetGraph',
      'handleGraphClick',
      'updateDistanceTable',
      'drawEdge'
    ];

    for (const fnName of functionNames) {
      test(`calling ${fnName} from page context should throw (not defined)`, async ({ page }) => {
        let caught = null;
        try {
          // Intentionally call the function in the page context; if it's undefined, this will cause an exception.
          await page.evaluate((name) => {
            // Use the global name directly to provoke a ReferenceError if undefined
            // eslint-disable-next-line no-eval
            return eval(`${name}()`); // try to execute the function
          }, fnName);
        } catch (err) {
          caught = err;
        }

        // We expect an error to have been thrown from the page evaluation or from Playwright
        expect(caught).not.toBeNull();

        // Error message should indicate the function is not defined or a ReferenceError occurred
        const message = String(caught.message || caught);
        const matches = /is not defined|ReferenceError|is not a function|not defined/i.test(message);
        expect(matches).toBeTruthy();
      });
    }
  });

  test.describe('Edge cases and robustness checks', () => {
    test('Performing a graph click on empty space does not create nodes when handlers are not present', async ({ page }) => {
      // Directly click some random points inside the graph container
      const loc = await page.locator('#graph-container').boundingBox();
      expect(loc).not.toBeNull();
      if (loc) {
        await page.mouse.click(loc.x + 10, loc.y + 10);
        await page.mouse.click(loc.x + 200, loc.y + 50);
      }

      // Wait then assert no nodes
      await page.waitForTimeout(100);
      const nodes = await page.locator('#graph-container .node').count();
      expect(nodes).toBe(0);
    });

    test('Ensure initial FSM idle evidence (mode = add-node) is not present due to script parse failure', async ({ page }) => {
      // The FSM S0_Idle suggests mode = 'add-node' should be set on entry via renderPage()/init.
      // Because the script failed, window.mode should be undefined.
      const modeType1 = await page.evaluate(() => typeof window.mode);
      expect(modeType).toBe('undefined');
    });

    test('Console and page errors include helpful diagnostics for the broken addEdge function', async ({ page }) => {
      // Aggregate messages and assert that at least one points to the problematic 'existingEdge' or 'const existingEdge' text
      const joined = pageErrors.concat(consoleMessages).join(' | ');
      const diagnosticMatch = /existingEdge|addEdge|Unexpected token|SyntaxError|const existingEdge/i.test(joined);
      // This is a best-effort assertion: the environment error message should include one of these hints.
      expect(diagnosticMatch).toBeTruthy();
    });
  });
});