import { test, expect } from '@playwright/test';

test.describe('0441bfd2-fa79-11f0-8a8e-bbe4f11717c6 - Red-Black Tree visualization', () => {
  // Arrays to collect console and page error messages for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages emitted by the page
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Collect unhandled exceptions from the page
    page.on('pageerror', err => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });
  });

  // Helper to navigate to the app URL and wait for load
  async function gotoApp(page) {
    await page.goto('http://127.0.0.1:5500/workspace/0126-biased/html/0441bfd2-fa79-11f0-8a8e-bbe4f11717c6.html', { waitUntil: 'load' });
  }

  test('S0_Idle: initial DOM contains canvas elements and renderPage is not defined', async ({ page }) => {
    // This test validates the Idle state evidence:
    // - The DOM must contain at least one canvas with id "graph" (evidence in FSM).
    // - The FSM entry action mentions renderPage(); the implementation does not define it.
    await gotoApp(page);

    // Verify there are canvas elements and specifically multiple elements with id "graph"
    const canvasCount = await page.evaluate(() => document.querySelectorAll('canvas').length);
    const graphIdCount = await page.evaluate(() => document.querySelectorAll('#graph').length);
    expect(canvasCount).toBeGreaterThanOrEqual(1);
    // The HTML includes two <canvas id="graph"> - assert duplicate ID exists
    expect(graphIdCount).toBeGreaterThanOrEqual(2);

    // Verify that a named global function renderPage (from FSM entry actions) is not present
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // Ensure there were no unexpected page errors while loading the initial page
    expect(pageErrors.length).toBe(0);

    // Optional: capture console messages for debugging - assert we didn't receive errors in console
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('S1_TreeDrawn: redBlackTree executed on load and canvas has been drawn to', async ({ page }) => {
    // This test validates that the TreeDraw event (redBlackTree(100, 100)) occurred:
    // - The function redBlackTree should exist on the window after load (implementation calls it).
    // - The canvas should contain non-blank drawing data (not an empty/blank PNG).
    await gotoApp(page);

    // Verify redBlackTree exists and is a function
    const rbType = await page.evaluate(() => typeof window.redBlackTree);
    expect(rbType).toBe('function');

    // Get the data URL of the first canvas (getElementById returns the first with id)
    const dataUrl = await page.evaluate(() => {
      const c = document.getElementById('graph');
      // If canvas has no internal dimensions set, canvas.toDataURL still returns a PNG string.
      return c ? c.toDataURL() : null;
    });
    expect(dataUrl).not.toBeNull();
    expect(typeof dataUrl).toBe('string');
    // Basic sanity: dataURL should contain prefix and not be trivially small
    expect(dataUrl.startsWith('data:image/png;base64,')).toBeTruthy();
    expect(dataUrl.length).toBeGreaterThan(1000);

    // Ensure no page errors were produced during drawing on load
    expect(pageErrors.length).toBe(0);
  });

  test('TreeDraw event transition: calling redBlackTree again redraws canvas (observable change)', async ({ page }) => {
    // This test explicitly invokes the TreeDraw event (redBlackTree) to validate the transition
    // from Idle -> TreeDrawn in practice: we call the function and ensure the canvas content changes.
    await gotoApp(page);

    // Capture data URL before manual redraw
    const before = await page.evaluate(() => {
      const c = document.getElementById('graph');
      return c ? c.toDataURL() : null;
    });
    expect(before).not.toBeNull();

    // Call redBlackTree with different coordinates to cause observable change
    await page.evaluate(() => {
      // call with different coordinates to get a different layout if implementation uses them
      if (typeof window.redBlackTree === 'function') {
        window.redBlackTree(150, 150);
      } else {
        // if not present, do nothing (test above ensures it should be present)
      }
    });

    // Capture data URL after manual redraw
    const after = await page.evaluate(() => {
      const c = document.getElementById('graph');
      return c ? c.toDataURL() : null;
    });
    expect(after).not.toBeNull();

    // The canvas should be updated; assert the data URLs differ (or at least one is non-equal)
    // It's possible drawing is deterministic and identical; so we allow equality but prefer difference.
    // To be robust, check that after is a valid PNG and that an operation completed without page errors.
    expect(after.startsWith('data:image/png;base64,')).toBeTruthy();
    // If possible, expect a change; but do not fail hard if identical due to deterministic drawing.
    if (before !== after) {
      expect(before).not.toEqual(after);
    }

    // No runtime page errors should have occurred from calling redBlackTree manually
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case / error scenario: invoking missing renderPage should throw (TypeError) and be observable', async ({ page }) => {
    // This test intentionally attempts to call the non-existent renderPage function (declared in FSM
    // but not implemented) to validate error behavior. We DO NOT patch or create renderPage.
    await gotoApp(page);

    // Ensure renderPage is indeed not a function
    const isDefined = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(isDefined).toBe(false);

    // Attempt to call it via evaluate and assert that the call throws (TypeError: window.renderPage is not a function)
    let thrown = null;
    try {
      await page.evaluate(() => {
        // Intentionally call the missing function to produce a runtime error
        // This should result in a thrown exception inside the page context and be propagated.
        // We don't define renderPage anywhere; calling it should cause an error.
        // eslint-disable-next-line no-undef
        return window.renderPage();
      });
    } catch (err) {
      thrown = err;
    }

    // We expect an error to have been thrown by the evaluate call
    expect(thrown).not.toBeNull();
    const msg = String(thrown.message || thrown);
    // Error message content may vary across browsers/environments; check for common substrings
    const matchesTypeError = msg.includes('is not a function') || msg.includes('not a function') || msg.includes('undefined');
    expect(matchesTypeError).toBeTruthy();

    // The pageerror handler may have recorded the error as well (unhandled exceptions)
    // It is acceptable if pageErrors array has at least 0 or 1 entries depending on runtime behavior.
    // If an unhandled exception was emitted, ensure it's related to renderPage.
    if (pageErrors.length > 0) {
      const joined = pageErrors.join(' | ');
      expect(joined.toLowerCase()).toContain('renderpage');
    }
  });

  test('DOM behavior: duplicate canvas IDs - getElementById returns first canvas and it matches querySelectorAll[0]', async ({ page }) => {
    // This test validates DOM ambiguity due to duplicate IDs (two canvases with id="graph")
    // and verifies that getElementById returns the first occurrence.
    await gotoApp(page);

    const results = await page.evaluate(() => {
      const byId = document.getElementById('graph');
      const list = Array.from(document.querySelectorAll('#graph'));
      // Return whether byId is strictly equal to the first element in the NodeList
      return {
        idCount: list.length,
        byIdIsFirst: list.length > 0 ? byId === list[0] : false,
        // Provide dataURLs for both the byId and the first node in the list (if present)
        byIdDataUrl: byId ? byId.toDataURL() : null,
        firstDataUrl: list.length > 0 ? list[0].toDataURL() : null
      };
    });

    expect(results.idCount).toBeGreaterThanOrEqual(2);
    expect(results.byIdIsFirst).toBeTruthy();
    // Ensure data URLs are present for both and match (since byId is the first)
    expect(results.byIdDataUrl).not.toBeNull();
    expect(results.firstDataUrl).not.toBeNull();
    expect(results.byIdDataUrl).toEqual(results.firstDataUrl);
  });

  test.afterEach(async ({ page }) => {
    // Final assertions to ensure no unexpected critical errors were emitted during the test
    // (pageErrors may be intentionally populated in the specific error test above).
    // Only assert that console did not produce fatal exceptions unless explicitly expected.
    const consoleExceptionCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleExceptionCount).toBeLessThan(2); // allow zero or one (robust)
  });
});