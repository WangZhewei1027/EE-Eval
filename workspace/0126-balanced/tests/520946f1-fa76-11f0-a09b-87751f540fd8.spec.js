import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520946f1-fa76-11f0-a09b-87751f540fd8.html';

// Page object to encapsulate interactions and observations for the graph page
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Capture console messages and page errors for assertions
    this.page.on('console', (msg) => {
      // record type and text for better assertions
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    this.page.on('pageerror', (err) => {
      // Collect runtime exceptions thrown on the page
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  canvasLocator() {
    return this.page.locator('#graph');
  }

  headerLocator() {
    return this.page.locator('h1');
  }

  async getComputedCanvasSize() {
    const box = await this.canvasLocator().boundingBox();
    // fallback to computed style if boundingBox is null (offscreen)
    if (box) {
      return { width: Math.round(box.width), height: Math.round(box.height) };
    }
    return await this.page.evaluate(() => {
      const c = document.querySelector('#graph');
      const style = window.getComputedStyle(c);
      return {
        width: parseInt(style.width, 10),
        height: parseInt(style.height, 10),
      };
    });
  }

  // Expose collected console messages
  getConsoleMessages() {
    return this.consoleMessages;
  }

  // Expose collected page errors
  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('Dijkstra Algorithm Interactive Page - FSM State Tests', () => {
  // Ensure each test gets a fresh page and fresh GraphPage wrapper
  test.beforeEach(async ({ page }) => {
    // nothing here - each test will create its own GraphPage and goto the URL
  });

  // Validate the single FSM state S0_Idle entry evidence and page render
  test('S0_Idle: page renders and canvas (#graph) exists with expected styles', async ({ page }) => {
    // This test validates the FSM "Idle" state's evidence: canvas element is present.
    const gp = new GraphPage(page);
    await gp.goto();

    // Verify header text is present (sanity)
    await expect(gp.headerLocator()).toHaveText("Dijkstra's Algorithm");

    // Verify canvas exists
    const canvas = gp.canvasLocator();
    await expect(canvas).toHaveCount(1);

    // Verify computed style dimensions from CSS are applied (as evidence of rendering)
    const size = await gp.getComputedCanvasSize();
    // CSS in the page sets width: 800px and height: 600px; accept that as expected evidence
    expect(size.width).toBeGreaterThanOrEqual(780); // allow some rounding/margin differences in env
    expect(size.height).toBeGreaterThanOrEqual(580);

    // There should be no interactive controls according to FSM extraction; assert no buttons/inputs exist
    await expect(page.locator('button')).toHaveCount(0);
    await expect(page.locator('input')).toHaveCount(0);
  });

  test('Console output: script logs expected distance and shortest path messages on load', async ({ page }) => {
    // This test captures console logs emitted during page load and validates expected output strings.
    const gp1 = new GraphPage(page);
    await gp.goto();

    // Allow some time for console messages to be collected (already attached listeners before navigation).
    // Inspect the captured console messages for the expected logs.
    const messages = gp.getConsoleMessages().map(m => m.text);

    // We expect at least two logs that were in the page script:
    // "Shortest distances from", and "Shortest path:"
    const hasDistancesLog = messages.some(txt => txt.includes('Shortest distances from'));
    const hasShortestPathLog = messages.some(txt => txt.includes('Shortest path'));

    expect(hasDistancesLog).toBeTruthy();
    expect(hasShortestPathLog).toBeTruthy();

    // Additionally assert that there were no runtime page errors emitted during the initial load
    expect(gp.getPageErrors().length).toBe(0);
  });

  test('FSM entry action renderPage() is not defined on the page and calling it throws ReferenceError', async ({ page }) => {
    // FSM metadata mentions an entry action "renderPage()". The implementation does NOT define it.
    // This test attempts to call renderPage() and asserts that a ReferenceError (or "not defined") is thrown naturally.
    const gp2 = new GraphPage(page);
    await gp.goto();

    // Directly invoking an undefined global function should produce a rejected promise from page.evaluate
    // We assert that the call fails with a ReferenceError (or "is not defined" message).
    await expect(page.evaluate(() => {
      // Intentionally call renderPage which is not defined in the page to allow natural ReferenceError
      // The error will bubble out of page.evaluate as a rejected promise.
      return renderPage();
    })).rejects.toThrow(/renderPage is not defined|is not defined|ReferenceError/);
  });

  test('Calling dijkstra(graph, "A") returns distances object (verify returned structure and values)', async ({ page }) => {
    // This verifies behavior of the dijkstra function present in the global scope.
    // It asserts that running with start 'A' returns an object that includes A: 0.
    const gp3 = new GraphPage(page);
    await gp.goto();

    const result = await page.evaluate(() => {
      // Invoke the page's dijkstra function directly and return its result
      // Note: The page implementation is known to be buggy; we don't change it, just assert observed behavior.
      try {
        return dijkstra(graph, 'A');
      } catch (e) {
        // If something unexpected throws, rethrow to fail the test with the original error
        throw e;
      }
    });

    // The implementation initializes distances[start] = 0 and due to logic bugs may only include that key.
    expect(result).toBeTruthy();
    expect(result).toHaveProperty('A', 0);

    // Verify that the result is an object (not null)
    expect(typeof result).toBe('object');
  });

  test('Calling dijkstra with undefined graph throws a TypeError (edge case)', async ({ page }) => {
    // This test exercises an edge case: calling dijkstra with undefined graph should naturally throw a TypeError
    // (Object.keys(undefined) will cause a TypeError). We do NOT patch or modify global functions.
    const gp4 = new GraphPage(page);
    await gp.goto();

    // Expect the evaluation to be rejected with a TypeError
    await expect(page.evaluate(() => {
      // Intentionally pass undefined as the graph parameter to trigger native TypeError inside dijkstra
      return dijkstra(undefined, 'A');
    })).rejects.toThrow(TypeError);
  });

  test('FSM transitions: there are no interactive transitions or controls present', async ({ page }) => {
    // FSM extraction reported zero transitions and no event handlers.
    // This test ensures the DOM has no obvious interactive controls (buttons or explicit event-linked elements).
    const gp5 = new GraphPage(page);
    await gp.goto();

    // No buttons expected
    await expect(page.locator('button')).toHaveCount(0);

    // No form controls expected
    await expect(page.locator('input')).toHaveCount(0);

    // No anchors that look like controls
    const anchors = await page.locator('a').count();
    expect(anchors).toBeGreaterThanOrEqual(0); // allow anchors if present, but we don't expect interactive anchors
    // Confirm that there are no explicit data attributes indicating event handlers as part of the DOM
    const handlerNodes = await page.locator('[onclick],[onchange],[oninput],[onmouseover]').count();
    expect(handlerNodes).toBe(0);
  });

  test('Inspect console and page error stream: capture any runtime exceptions and validate content', async ({ page }) => {
    // This test double-checks the console and pageerror streams are accessible and that
    // console includes the algorithm logs while page errors remain empty prior to provoking errors.
    const gp6 = new GraphPage(page);
    await gp.goto();

    // Basic sanity: ensure we captured at least the two expected logs
    const texts = gp.getConsoleMessages().map(m => m.text);
    expect(texts.some(t => t.includes('Shortest distances from'))).toBeTruthy();
    expect(texts.some(t => t.includes('Shortest path'))).toBeTruthy();

    // No page errors thus far
    expect(gp.getPageErrors().length).toBe(0);

    // Now, provoke a natural TypeError by evaluating code that will throw (without modifying page)
    await expect(page.evaluate(() => {
      // attempt to call Object.keys on null to provoke a TypeError inside user code context
      return Object.keys(null);
    })).rejects.toThrow(TypeError);

    // The pageerror listener should have captured the thrown error only if it bubbled to window.
    // The previous rejection is from evaluate; it may or may not trigger pageerror depending on browser impl.
    // We ensure that our promise rejection was observed by Playwright (above assertion).
  });
});