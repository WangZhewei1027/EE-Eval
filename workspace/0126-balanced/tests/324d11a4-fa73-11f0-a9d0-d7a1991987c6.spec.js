import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324d11a4-fa73-11f0-a9d0-d7a1991987c6.html';

test.describe('Directed Graph Demonstration (Application ID: 324d11a4-fa73-11f0-a9d0-d7a1991987c6)', () => {
  // Collect console messages and page errors per test
  test.beforeEach(async ({ page }) => {
    // Ensure a fresh collection for each test
    page.context()._collectedConsole = [];
    page.context()._collectedPageErrors = [];

    page.on('console', msg => {
      // store console messages (level + text)
      page.context()._collectedConsole.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // store page errors (Error objects)
      page.context()._collectedPageErrors.push(err);
    });

    // Navigate to the application page exactly as-is
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Helpful debugging: if there were unexpected page errors, attach them to the test output
    // (This doesn't modify the page or its globals — only accesses collected errors)
    const errs = page.context()._collectedPageErrors || [];
    if (errs.length > 0) {
      // This ensures test logs contain any page errors that occurred
      for (const e of errs) {
        // eslint-disable-next-line no-console
        console.warn('Page error captured in afterEach:', e.name, e.message);
      }
    }
  });

  test('Initial render - container, nodes, and edges are present and positioned', async ({ page }) => {
    // Validate the graph container exists
    const container = page.locator('#graph-container');
    await expect(container).toBeVisible();

    // Validate there are 4 nodes (A, B, C, D)
    const nodes = page.locator('.node');
    await expect(nodes).toHaveCount(4);

    // Validate node labels and their positions correspond to the provided data
    const expectedOrder = [
      { id: 'A', left: '50px', top: '50px' },
      { id: 'B', left: '200px', top: '50px' },
      { id: 'C', left: '120px', top: '150px' },
      { id: 'D', left: '300px', top: '200px' }
    ];

    for (let i = 0; i < expectedOrder.length; i++) {
      const n = nodes.nth(i);
      await expect(n).toBeVisible();

      // Check text content
      await expect(n).toHaveText(expectedOrder[i].id);

      // Check inline positioning styles
      const left = await n.evaluate(el => el.style.left);
      const top = await n.evaluate(el => el.style.top);
      expect(left).toBe(expectedOrder[i].left);
      expect(top).toBe(expectedOrder[i].top);
    }

    // Validate edges were created (there are 4 edges defined)
    const edges = page.locator('.edge');
    await expect(edges).toHaveCount(4);

    // Ensure edges have positive computed widths (i.e., were given a length)
    const widths = await edges.evaluateAll(els =>
      els.map(e => {
        const w = e.getBoundingClientRect().width;
        const inlineWidth = e.style.width;
        return { computedWidth: w, inlineWidth };
      })
    );

    for (const w of widths) {
      expect(w.computedWidth).toBeGreaterThan(0);
      // inline style width should be a px value (non-empty)
      expect(typeof w.inlineWidth).toBe('string');
      expect(w.inlineWidth.length).toBeGreaterThan(0);
    }
  });

  test('FSM initial state S0_Idle entry action "renderPage" is not defined — calling it causes ReferenceError (observed as page error)', async ({ page }) => {
    // This test intentionally calls a function declared in the FSM's "entry_actions" (renderPage)
    // which does not exist on the page. According to the instructions, we must let a ReferenceError
    // happen naturally and assert that it occurs.
    // We call it directly in page context (without try/catch inside the page) so the pageerror event is triggered.

    // Clear any prior errors
    page.context()._collectedPageErrors = [];

    let threw = false;
    try {
      // This will reject because renderPage is not defined on the page and will raise a ReferenceError.
      await page.evaluate(() => {
        // Intentionally call missing function to let the engine throw
        // This reflects checking the "entry action" mentioned in the FSM
        // We deliberately do not catch the error here to allow a natural pageerror event.
        // eslint-disable-next-line no-undef
        return renderPage();
      });
    } catch (e) {
      // The page.evaluate will reject; capture that the attempt threw
      threw = true;
    }

    // Ensure the evaluate call did indeed throw (the function doesn't exist)
    expect(threw).toBe(true);

    // Ensure a pageerror was captured by the listener, and it is a ReferenceError
    const errs1 = page.context()._collectedPageErrors || [];
    expect(errs.length).toBeGreaterThanOrEqual(1);
    // Look for a ReferenceError among captured errors
    const refErr = errs.find(e => e.name === 'ReferenceError');
    expect(refErr).toBeTruthy();
  });

  test('Calling createEdge with null arguments triggers a TypeError (edge-case error scenario)', async ({ page }) => {
    // The page defines a global function createEdge(fromNode, toNode)
    // Invoking it with invalid inputs (null) should naturally produce a TypeError
    // because code will attempt to call getBoundingClientRect on null.
    page.context()._collectedPageErrors = [];

    let rejected = false;
    try {
      // Call the global createEdge without try/catch inside page so the error surfaces naturally
      await page.evaluate(() => {
        // createEdge exists in the page script's global scope
        // Intentionally pass bad arguments to trigger a runtime error
        return createEdge(null, null);
      });
    } catch (e) {
      rejected = true;
    }

    expect(rejected).toBe(true);

    // Ensure the pageerror listener captured a TypeError
    const errs2 = page.context()._collectedPageErrors || [];
    expect(errs.length).toBeGreaterThanOrEqual(1);

    const typeErr = errs.find(e => e.name === 'TypeError' || e.message.includes('getBoundingClientRect'));
    expect(typeErr).toBeTruthy();
  });

  test('User interactions (clicks) on nodes do not change DOM structure or produce unexpected errors', async ({ page }) => {
    // This page had "No interactive elements or event handlers" in the FSM extraction notes.
    // Validate that clicking nodes does not alter the number of nodes or edges and does not produce new page errors.
    const nodes1 = page.locator('.node');
    const edges1 = page.locator('.edge');

    const initialNodeCount = await nodes.count();
    const initialEdgeCount = await edges.count();

    // Ensure clean error state before interactions
    page.context()._collectedPageErrors = [];
    page.context()._collectedConsole = [];

    // Click each node sequentially and ensure nothing changes
    for (let i = 0; i < initialNodeCount; i++) {
      await nodes.nth(i).click();
      // wait a short time in case anything asynchronous would run (it shouldn't)
      await page.waitForTimeout(100);
    }

    // Verify counts remain unchanged
    await expect(nodes).toHaveCount(initialNodeCount);
    await expect(edges).toHaveCount(initialEdgeCount);

    // Verify no new page errors were produced by clicking nodes
    const errs3 = page.context()._collectedPageErrors || [];
    expect(errs.length).toBe(0);

    // Also ensure console didn't emit unexpected error-level messages
    const consoles = page.context()._collectedConsole || [];
    const errorConsoleMessages = consoles.filter(c => c.type === 'error' || c.type === 'warning');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Attempting to call an undefined function "nonexistentFunc" results in a ReferenceError (explicit edge case)', async ({ page }) => {
    // Another explicit edge-case: call a non-existent global to ensure ReferenceError is produced and captured.
    page.context()._collectedPageErrors = [];

    let threw1 = false;
    try {
      await page.evaluate(() => {
        // eslint-disable-next-line no-undef
        return nonexistentFunc();
      });
    } catch (e) {
      threw = true;
    }

    expect(threw).toBe(true);

    const errs4 = page.context()._collectedPageErrors || [];
    expect(errs.length).toBeGreaterThanOrEqual(1);
    const refErr1 = errs.find(e => e.name === 'ReferenceError');
    expect(refErr).toBeTruthy();
  });
});