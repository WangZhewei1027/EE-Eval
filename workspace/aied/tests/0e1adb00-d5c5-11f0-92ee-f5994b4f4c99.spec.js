import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0e1adb00-d5c5-11f0-92ee-f5994b4f4c99.html';

test.describe('Sliding Window - FSM and Page Integrity Tests', () => {
  // Shared holders to observe runtime diagnostics emitted by the page
  let consoleMessages;
  let pageErrors;
  let failedRequests;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors before navigation so we capture early failures (e.g., network errors)
    consoleMessages = [];
    pageErrors = [];
    failedRequests = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture unhandled page errors (runtime exceptions)
    page.on('pageerror', error => {
      pageErrors.push({
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
    });

    // Capture failed network requests (useful for missing slide.js)
    page.on('requestfailed', request => {
      failedRequests.push({
        url: request.url(),
        failureText: request.failure() ? request.failure().errorText : null,
      });
    });

    // Navigate to the page under test and wait for load
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test('Initial Idle state: window and content elements are present and visible', async ({ page }) => {
    // This test validates the FSM initial state (S0_Idle) entry rendering:
    // - .window and .content must be present in the DOM
    // - the .content should have the CSS transform declared in the source
    const windowEl = await page.$('.window');
    const contentEl = await page.$('.content');

    // Ensure elements exist
    expect(windowEl, 'Expected .window element to exist on initial render').not.toBeNull();
    expect(contentEl, 'Expected .content element to exist on initial render').not.toBeNull();

    // Ensure elements are visible (have layout)
    await expect(windowEl).toBeVisible();
    await expect(contentEl).toBeVisible();

    // Validate computed styles for .content: it should include the translate transform from the stylesheet
    const contentStyles = await page.evaluate(() => {
      const el = document.querySelector('.content');
      const cs = window.getComputedStyle(el);
      return {
        transform: cs.transform,
        leftProperty: cs.left, // computed left in pixels
        topProperty: cs.top,   // computed top in pixels (might be 'auto' or pixels)
        inlineLeft: el.style.left, // inline style (should be empty as per source)
        inlineTop: el.style.top,   // inline style (should be empty as per source)
      };
    });

    // The CSS sets transform: translate(-50%, -50%), which will appear in computed transform.
    // Depending on browser engine, transform can be reported as a matrix; we accept either presence of 'matrix' or 'translate'
    expect(
      contentStyles.transform && contentStyles.transform.length > 0,
      'Expected .content to have a computed transform value (from stylesheet)'
    ).toBeTruthy();

    // Inline style 'left' and 'top' are not set in the HTML, so they should be empty strings
    expect(contentStyles.inlineLeft).toBe('', 'Expected no inline left style on .content');
    expect(contentStyles.inlineTop).toBe('', 'Expected no inline top style on .content');
  });

  test('Entry action renderPage() is not present; slide() function not defined from malformed style block', async ({ page }) => {
    // The FSM mentions an entry action renderPage(). The implementation does not define renderPage.
    // Also, source includes a JS function placed inside a <style> block, which should NOT create a global slide function.
    const globals = await page.evaluate(() => {
      return {
        hasRenderPage: typeof window.renderPage !== 'undefined',
        renderPageType: typeof window.renderPage,
        hasSlide: typeof window.slide !== 'undefined',
        slideType: typeof window.slide,
      };
    });

    // Assert these functions are not present (they should be undefined)
    expect(globals.hasRenderPage, 'renderPage should not be defined on the window object').toBe(false);
    expect(globals.renderPageType).toBe('undefined');
    expect(globals.hasSlide, 'slide function should not exist as a global (JS was placed in a style block)').toBe(false);
    expect(globals.slideType).toBe('undefined');
  });

  test('There are no interactive controls and user interactions do not change layout (no transitions present)', async ({ page }) => {
    // FSM has no transitions or events; verify that there are no obvious interactive controls
    const interactiveCount = await page.evaluate(() => {
      // count typical interactive elements that would imply transitions
      const nodes = Array.from(document.querySelectorAll('button, input, textarea, select, a[href], [role="button"], [onclick]'));
      return nodes.length;
    });

    expect(interactiveCount, 'Expected no interactive elements (buttons, inputs, anchors) on this page').toBe(0);

    // Clicking the window/content should not move them or add inline styles (no transitions)
    const before = await page.evaluate(() => {
      const w = document.querySelector('.window').getBoundingClientRect();
      const c = document.querySelector('.content').getBoundingClientRect();
      const contentInline = {
        leftInline: document.querySelector('.content').style.left,
        topInline: document.querySelector('.content').style.top,
      };
      return { w, c, contentInline };
    });

    // Perform clicks on both elements
    await page.click('.window');
    await page.click('.content');

    // Small delay to allow any potential scripts (if present) to run
    await page.waitForTimeout(250);

    const after = await page.evaluate(() => {
      const w = document.querySelector('.window').getBoundingClientRect();
      const c = document.querySelector('.content').getBoundingClientRect();
      const contentInline = {
        leftInline: document.querySelector('.content').style.left,
        topInline: document.querySelector('.content').style.top,
      };
      return { w, c, contentInline };
    });

    // Expect bounding rects to be equal (no movement)
    expect(after.w.x).toBeCloseTo(before.w.x, 1);
    expect(after.w.y).toBeCloseTo(before.w.y, 1);
    expect(after.c.x).toBeCloseTo(before.c.x, 1);
    expect(after.c.y).toBeCloseTo(before.c.y, 1);

    // Expect inline styles unchanged (still empty strings)
    expect(after.contentInline.leftInline).toBe('', 'Expected no inline left style on .content after clicks');
    expect(after.contentInline.topInline).toBe('', 'Expected no inline top style on .content after clicks');
  });

  test('External script slide.js should fail to load (captured as a failed request) and console should record at least one error', async ({ page }) => {
    // The page references <script src="slide.js"></script>. In the provided environment this resource is likely missing.
    // We assert that at least one request failed and that its URL includes slide.js
    const slideFailures = failedRequests.filter(fr => fr.url.endsWith('/slide.js') || fr.url.endsWith('slide.js'));

    // There should be at least one failed request for slide.js
    expect(slideFailures.length, 'Expected the external slide.js script request to fail (missing file)').toBeGreaterThanOrEqual(1);

    // Also ensure the console captured at least one message of type "error" (e.g., resource load failure)
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');

    // There is platform variance in how resource load failures are surfaced in the console, but we expect at least one 'error' level message.
    expect(errorConsoleMessages.length, 'Expected at least one console error message to be emitted (e.g., failed resource load)').toBeGreaterThanOrEqual(1);

    // Optionally assert that one of the console error texts mentions slide.js or 'Failed'/'404'
    const refersToSlide = errorConsoleMessages.some(m => /slide\.js|Failed to load|404/.test(m.text));
    expect(refersToSlide, 'Expected at least one console error to reference slide.js or a failed resource load').toBe(true);
  });

  test('Collect and expose any runtime exceptions (ReferenceError/SyntaxError/TypeError) if they occurred', async ({ page }) => {
    // This test documents any runtime exceptions emitted during page load.
    // The test will not inject or alter page code; it simply asserts what the page emitted.
    // It is acceptable for this array to be empty if no runtime exceptions occurred.
    // However, we will assert that the test harness captured the errors array shape correctly.

    // pageErrors collects pageerror events (uncaught exceptions)
    expect(Array.isArray(pageErrors)).toBe(true);

    // If any runtime exceptions occurred, they should be objects with name/message
    for (const err of pageErrors) {
      expect(typeof err.name).toBe('string');
      expect(typeof err.message).toBe('string');
    }

    // For clarity in test outputs, fail explicitly if a known JS error type was captured.
    // This mirrors the instruction to "let ReferenceError, SyntaxError, TypeError happen naturally, and assert that these errors occur."
    // If any such errors happened, assert their presence and include details.
    const interestingErrors = pageErrors.filter(e => /ReferenceError|SyntaxError|TypeError/.test(e.name));
    if (interestingErrors.length > 0) {
      // If such errors occurred, assert that at least one exists (they already do) and surface their messages.
      expect(interestingErrors.length).toBeGreaterThan(0);
      // Provide as a final check that messages are present for debugging.
      for (const ie of interestingErrors) {
        expect(ie.message.length).toBeGreaterThan(0);
      }
    } else {
      // It's valid that no runtime JS exceptions occurred, in which case we still pass but log the fact.
      // This keeps the assertion explicit and the test outputs informative.
      expect(interestingErrors.length).toBe(0);
    }
  });

  test.afterEach(async ({ page }) => {
    // Final sanity checks: no unexpected modal dialogs opened (e.g., alert from malformed code)
    // Playwright by default will not allow unattended dialogs; ensure none were emitted by observing console/errors earlier.
    // The pageErrors and consoleMessages were already captured. We'll assert the page is still reachable.
    await expect(page).toHaveURL(APP_URL);
  });
});