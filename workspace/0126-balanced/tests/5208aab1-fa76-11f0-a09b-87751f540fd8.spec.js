import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/5208aab1-fa76-11f0-a09b-87751f540fd8.html';

test.describe('5208aab1-fa76-11f0-a09b-87751f540fd8 - Directed Graph Interactive App', () => {
  // Arrays to collect runtime errors and console messages emitted by the page
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // store the Error object for assertions in tests
      pageErrors.push(err);
    });

    // Collect console messages for additional assertions/debugging
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test.afterEach(async () => {
    // no teardown actions required beyond Playwright default, but keep hook for symmetry
  });

  test('Idle state: canvas element is present with expected attributes', async ({ page }) => {
    // This test validates the FSM Idle state evidence:
    // - canvas with id "graph" exists
    // - canvas has width and height attributes set to 400
    // - canvas has a 2D rendering context available
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Verify the canvas element exists and has correct attributes
    const canvasHandle = await page.$('#graph');
    expect(canvasHandle).not.toBeNull();

    const id = await page.getAttribute('#graph', 'id');
    expect(id).toBe('graph');

    const width = await page.getAttribute('#graph', 'width');
    const height = await page.getAttribute('#graph', 'height');
    expect(width).toBe('400');
    expect(height).toBe('400');

    // Verify computed sizes (fallback to attributes if computed style differs)
    const boundingBox = await canvasHandle.boundingBox();
    expect(boundingBox).not.toBeNull();
    // boundingBox may have values; ensure width/height greater than 0
    expect(boundingBox.width).toBeGreaterThan(0);
    expect(boundingBox.height).toBeGreaterThan(0);

    // Ensure a 2D context can be obtained from the canvas within the page environment
    const has2DContext = await page.evaluate(() => {
      const c = document.getElementById('graph');
      try {
        return !!c && !!c.getContext && !!c.getContext('2d');
      } catch (e) {
        return false;
      }
    });
    expect(has2DContext).toBe(true);
  });

  test('Script runtime: missing Graph constructor produces a ReferenceError (observed page error)', async ({ page }) => {
    // This test validates that runtime errors (ReferenceError for missing Graph) occur naturally
    // and that we observe them via Playwright's pageerror event.
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait a short moment to allow script execution and any errors to be delivered
    await page.waitForTimeout(200);

    // We expect at least one page error due to "new Graph()" where Graph is not defined.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Ensure one of the errors indicates the missing Graph symbol.
    const messages = pageErrors.map(e => e.message || String(e));
    const hasGraphReference = messages.some(m => /Graph/.test(m) || /graph/.test(m));
    expect(hasGraphReference).toBe(true);

    // Also assert that a ReferenceError (or an error mentioning "not defined") is present
    const hasNotDefined = messages.some(m => /not defined/i.test(m) || /ReferenceError/i.test(m));
    expect(hasNotDefined).toBe(true);

    // Also check console messages captured for corroboration (optional)
    const consoleTexts = consoleMessages.map(c => c.text);
    const consoleHasError = consoleTexts.some(t => /Graph/.test(t) || /ReferenceError/i.test(t) || /not defined/i.test(t));
    // It's acceptable if console doesn't repeat the error, but at least either pageerror or console should contain Graph mention
    expect(hasGraphReference || consoleHasError).toBe(true);
  });

  test('Entry actions: "renderPage" function is not present on window (verify onEnter action absence)', async ({ page }) => {
    // FSM specified an entry action renderPage(). The implementation does not define it.
    // This test ensures the function is not defined on the global scope and therefore not invoked.
    await page.goto(APP_URL, { waitUntil: 'load' });

    const renderPageType = await page.evaluate(() => {
      // Do not call renderPage; only check its existence and type
      return typeof window.renderPage;
    });

    expect(renderPageType).toBe('undefined');

    // Additional expectation: since renderPage is not present, there should be no side-effects from it.
    // Confirm that no global "graph" variable was attached (the script's const graph would be local anyhow,
    // and due to the runtime error its creation failed).
    const globalGraphType = await page.evaluate(() => typeof window.graph);
    expect(globalGraphType).toBe('undefined');
  });

  test('Canvas drawing did not occur due to script error: pixel data remains transparent (blank)', async ({ page }) => {
    // Because Graph is not defined, none of the graph.addNode/addEdge/draw calls should have executed.
    // The canvas should remain in its initial blank state (transparent pixels).
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Allow any drawing attempts (if any) to run; short wait
    await page.waitForTimeout(100);

    // Sample a central pixel (200, 200). Expect alpha=0 (transparent) in the absence of drawing.
    const pixel = await page.evaluate(() => {
      const c = document.getElementById('graph');
      const ctx = c.getContext('2d');
      // read center pixel
      const imageData = ctx.getImageData(200, 200, 1, 1).data;
      return { r: imageData[0], g: imageData[1], b: imageData[2], a: imageData[3] };
    });

    // Alpha should be 0 for transparent pixel; some environments may have lit canvas but most will be transparent.
    expect(pixel).toHaveProperty('a');
    expect(typeof pixel.a).toBe('number');
    // Allow either completely transparent or some drawing — but primarily assert that the alpha is 0.
    expect(pixel.a).toBe(0);
  });

  test('No interactive event handlers attached to the canvas element', async ({ page }) => {
    // FSM notes that no event handlers were detected. This test checks common on* properties are null.
    await page.goto(APP_URL, { waitUntil: 'load' });

    const handlers = await page.evaluate(() => {
      const c = document.getElementById('graph');
      if (!c) return null;
      return {
        onclick: !!c.onclick,
        onmousedown: !!c.onmousedown,
        onmouseup: !!c.onmouseup,
        onmousemove: !!c.onmousemove,
        onmouseover: !!c.onmouseover,
        onmouseout: !!c.onmouseout
      };
    });

    expect(handlers).not.toBeNull();
    // All should be falsey (no direct onX handlers assigned)
    expect(handlers.onclick).toBeFalsy();
    expect(handlers.onmousedown).toBeFalsy();
    expect(handlers.onmouseup).toBeFalsy();
    expect(handlers.onmousemove).toBeFalsy();
    expect(handlers.onmouseover).toBeFalsy();
    expect(handlers.onmouseout).toBeFalsy();
  });

  test('Edge case: ensure page still loaded and responded despite runtime error', async ({ page }) => {
    // The page intentionally has runtime errors. Ensure the document is still accessible and basic queries work.
    const response = await page.goto(APP_URL, { waitUntil: 'load' });
    // Response may be null when served from file protocol but under http should be a Response
    if (response) {
      expect(response.status()).toBeGreaterThanOrEqual(200);
      expect(response.status()).toBeLessThan(400);
    }

    // Basic DOM query should work
    const title = await page.title();
    expect(title).toContain('Graph');
  });

  test('Error observation robustness: capture and assert at least one meaningful error message', async ({ page }) => {
    // This test aggregates errors and ensures they include meaningful diagnostic text.
    await page.goto(APP_URL, { waitUntil: 'load' });
    await page.waitForTimeout(200);

    // Ensure at least one page error captured
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Map error messages to text and ensure presence of typical JS error keywords
    const errorTexts = pageErrors.map(e => String(e.message || e));
    const containsKeyword = errorTexts.some(t => /ReferenceError|TypeError|SyntaxError|not defined|is not defined/i.test(t));
    expect(containsKeyword).toBe(true);
  });
});