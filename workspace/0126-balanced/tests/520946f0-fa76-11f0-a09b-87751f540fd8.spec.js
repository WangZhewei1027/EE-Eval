import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520946f0-fa76-11f0-a09b-87751f540fd8.html';

// Page object for the BFS demo page
class BFSPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Navigate to the page (caller should attach console/error handlers before navigation if they want to capture page load logs)
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Returns the page heading element text
  async getHeadingText() {
    const el = await this.page.$('h1');
    if (!el) return null;
    return (await el.innerText()).trim();
  }

  // Returns the image element with id 'graph'
  async getGraphImage() {
    return this.page.$('#graph');
  }

  // Returns src and alt of the image (or null if no image)
  async getGraphImageAttrs() {
    const img = await this.getGraphImage();
    if (!img) return null;
    const src = await img.getAttribute('src');
    const alt = await img.getAttribute('alt');
    // Also get the resolved src as the browser sees it
    const resolvedSrc = await this.page.evaluate((el) => el.src, img);
    return { src, alt, resolvedSrc };
  }

  // Returns count of basic interactive elements on the page
  async countInteractiveElements() {
    // Look for interactive HTML elements that commonly indicate interactivity
    return await this.page.evaluate(() => {
      const selectors = ['button', 'input', 'textarea', 'select', 'a[role="button"]', '[role="button"]', '[onclick]'];
      const set = new Set();
      selectors.forEach((sel) => {
        document.querySelectorAll(sel).forEach(el => set.add(el));
      });
      return set.size;
    });
  }

  // Returns count of elements with inline event handlers like onclick/onchange
  async countInlineEventHandlers() {
    return await this.page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      return all.filter(el => {
        return Array.from(el.attributes).some(attr => /^on/i.test(attr.name));
      }).length;
    });
  }
}

test.describe('Breadth-First Search (BFS) Page - Basic rendering and behavior', () => {
  // Containers for captured console messages and page errors
  let consoleMessages;
  let pageErrors;

  // Attach listeners before navigation to capture console output produced during initial load
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console log messages from the page
    page.on('console', msg => {
      // Capture only page-originated logs; include type and text for diagnostics
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', error => {
      // Error is an Error object with message and name, preserve full object for assertions
      pageErrors.push(error);
    });
  });

  test('Initial state: page renders header and graph image (entry action renderPage)', async ({ page }) => {
    // This test validates the initial state described in the FSM:
    // - The heading "Breadth-First Search (BFS)" should be present (evidence of renderPage())
    // - The graph image with id "graph" should be present with expected attributes

    const bfs = new BFSPage(page);

    // Navigate to the page (console handlers are already attached in beforeEach)
    await bfs.goto();

    // Validate heading text
    const heading = await bfs.getHeadingText();
    expect(heading).toBe('Breadth-First Search (BFS)');

    // Validate graph image exists and attributes
    const imgAttrs = await bfs.getGraphImageAttrs();
    expect(imgAttrs).not.toBeNull();
    // The HTML specifies src and alt; verify both the attribute value and the resolved URL
    expect(imgAttrs.src).toBe('https://example.com/graph.png');
    expect(imgAttrs.alt).toBe('Graph');
    expect(typeof imgAttrs.resolvedSrc).toBe('string');
    // The resolvedSrc should end with the image filename (robust to absolute resolution)
    expect(imgAttrs.resolvedSrc).toMatch(/\/graph\.png$/);
  });

  test('BFS algorithm logs traversal order for two runs (A then D)', async ({ page }) => {
    // This test captures console.log output produced by the page during load.
    // It asserts that the BFS traversal logs appear and in the expected order:
    // First BFS from 'A' => A B C D E F
    // Second BFS from 'D' => D B A E C F

    const bfs1 = new BFSPage(page);
    await bfs.goto();

    // Wait briefly to ensure all synchronous console logs have been captured (the BFS runs synchronously on load)
    // No network/async expected for logs, but allow a short tick for event propagation.
    await page.waitForTimeout(50);

    // Filter only console messages of type 'log' (exclude warnings/errors)
    const logs = consoleMessages.filter(m => m.type === 'log').map(m => m.text.trim());

    // The page logs single uppercase letters (node labels). Extract those log entries that are exact single letters A-F.
    const nodeLogs = logs.filter(t => /^[A-F]$/.test(t));

    // There should be exactly 12 node logs (6 from first BFS and 6 from second BFS)
    expect(nodeLogs.length).toBe(12);

    // Validate the first BFS sequence
    const firstBFS = nodeLogs.slice(0, 6);
    expect(firstBFS).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);

    // Validate the second BFS sequence
    const secondBFS = nodeLogs.slice(6, 12);
    expect(secondBFS).toEqual(['D', 'B', 'A', 'E', 'C', 'F']);
  });

  test('No interactive elements or transitions found (FSM expects none)', async ({ page }) => {
    // This test checks for presence of common interactive elements or inline event handlers.
    // The FSM/extraction summary indicates no interactive elements or event handlers; assert that.

    const bfs2 = new BFSPage(page);
    await bfs.goto();

    // Count common interactive elements
    const interactiveCount = await bfs.countInteractiveElements();
    expect(interactiveCount).toBe(0);

    // Count inline event handlers (attributes that start with "on", e.g., onclick)
    const inlineHandlers = await bfs.countInlineEventHandlers();
    expect(inlineHandlers).toBe(0);
  });

  test('No uncaught page errors (ReferenceError/SyntaxError/TypeError) were thrown during load', async ({ page }) => {
    // This test observes whether any page errors were emitted during page load.
    // The script should run cleanly; assert that there are zero page errors and none of the typical error types are present.

    const bfs3 = new BFSPage(page);
    await bfs.goto();

    // Allow a tick for potential asynchronous errors (though the page runs synchronously)
    await page.waitForTimeout(50);

    // Assert that no page errors were captured
    expect(pageErrors.length).toBe(0);

    // Defensive: if there were errors, assert they are not ReferenceError / SyntaxError / TypeError
    // (This part will not run if there are zero errors; included to explicitly check error kinds when present)
    for (const err of pageErrors) {
      // err.name may contain the type like 'ReferenceError'
      expect(['ReferenceError', 'SyntaxError', 'TypeError']).not.toContain(err.name);
    }
  });

  test('Edge case: image may fail to load but DOM still contains expected markup', async ({ page }) => {
    // This test ensures that even if the remote image resource fails to load,
    // the DOM still contains the image element (the UI evidence required by FSM).
    // We do not control network here; instead we assert presence of DOM node regardless of load success.

    const bfs4 = new BFSPage(page);
    await bfs.goto();

    const img1 = await bfs.getGraphImage();
    expect(img).not.toBeNull();

    // Check naturalWidth/naturalHeight via evaluate - if image failed to load, those may be 0
    const dimensions = await page.evaluate(imgEl => {
      return { naturalWidth: imgEl.naturalWidth, naturalHeight: imgEl.naturalHeight, complete: imgEl.complete };
    }, img);

    // The DOM element should be complete (the browser attempted to load it), but natural sizes may be 0 if cross-origin or blocked.
    expect(typeof dimensions.complete).toBe('boolean');
    expect(typeof dimensions.naturalWidth).toBe('number');
    expect(typeof dimensions.naturalHeight).toBe('number');
    // We do not assert sizes > 0 because external resource availability can't be guaranteed in test environment.
  });

  test('Diagnostic: capture and expose console messages and page error details for debugging', async ({ page }) => {
    // This test collects the captured console messages and page errors and asserts basic structure.
    // It also serves as a diagnostics test to ensure console capturing works as expected.

    const bfs5 = new BFSPage(page);
    await bfs.goto();

    // Allow short delay
    await page.waitForTimeout(50);

    // Ensure we captured some console messages (at minimum the BFS traversal logs)
    const logTypes = consoleMessages.map(m => m.type);
    expect(logTypes.length).toBeGreaterThanOrEqual(1);

    // Ensure captured console message objects have text and type
    for (const msg of consoleMessages) {
      expect(typeof msg.type).toBe('string');
      expect(typeof msg.text).toBe('string');
    }

    // Page errors, if any, should be Error instances (or have message property)
    for (const err of pageErrors) {
      expect(err).toHaveProperty('message');
    }
  });
});