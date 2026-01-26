import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/5209e331-fa76-11f0-a09b-87751f540fd8.html';

test.describe('5209e331-fa76-11f0-a09b-87751f540fd8 - Big-Omega Notation (FSM validation)', () => {
  // Collect console messages and page errors for observation
  let consoleMessages = [];
  let pageErrors = [];

  // Attach listeners and navigate to the page before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Observe console messages emitted by the page
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Observe unhandled exceptions in the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the application exactly as-is
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // no special teardown required; Playwright closes pages/contexts automatically
  });

  // Test 1: Validate Idle state - static content and structure
  test('Idle state: page renders static content and expected headings (entry state validation)', async ({ page }) => {
    // This test validates the Idle state rendering and static DOM expected by the FSM evidence.
    // Verify the main heading exists and matches the FSM evidence
    await expect(page.locator('h1')).toHaveText('Big-Omega Notation');

    // Verify that the page contains the binarySearch code snippet inside the <pre><code> block
    const preText = await page.locator('pre').innerText();
    expect(preText).toContain('function binarySearch');

    // Verify some example complexity annotations are present
    const textContent = await page.locator('body').innerText();
    expect(textContent).toContain('O(log n)');
    expect(textContent).toContain('O(n^2)');
    expect(textContent).toContain('O(n log n)');
    expect(textContent).toContain('O(1)');

    // Verify there are headings for "Examples", "Code", "Time Complexity", "Space Complexity"
    await expect(page.locator('h2', { hasText: 'Examples' })).toBeVisible();
    await expect(page.locator('h2', { hasText: 'Code' })).toBeVisible();
    await expect(page.locator('h2', { hasText: 'Time Complexity' })).toBeVisible();
    await expect(page.locator('h2', { hasText: 'Space Complexity' })).toBeVisible();

    // The FSM extraction notes "No interactive elements" — assert no interactive controls are present
    const interactiveCount = await page.locator('button, input, select, textarea, a[href]').count();
    expect(interactiveCount).toBe(0);

    // Assert that there are no <script> tags in the document (the HTML provided contains no external scripts)
    const scriptCount = await page.locator('script').count();
    expect(scriptCount).toBe(0);

    // Ensure no page-level errors were emitted on initial load
    expect(pageErrors.length).toBe(0);

    // Capture that consoleMessages may exist but there should be no critical errors
    // We allow console messages but ensure none are of type 'error' by this point
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMessages.length).toBe(0);
  });

  // Test 2: Verify FSM entry action renderPage() behavior (onEnter)
  test('FSM entry action: renderPage() is not defined; calling it triggers a ReferenceError', async ({ page }) => {
    // The FSM specifies an entry action renderPage(). The HTML/JS does not define renderPage.
    // Verify that the function is not present on the window
    const renderPageType = await page.evaluate(() => typeof renderPage);
    expect(renderPageType).toBe('undefined');

    // Attempt to call renderPage() in the page context and assert the natural ReferenceError occurs.
    // We intentionally do NOT patch or define renderPage; we let the runtime throw naturally.
    let evaluationError = null;
    try {
      // This will cause page.evaluate to reject with an error because renderPage is not defined.
      await page.evaluate(() => {
        // calling the missing function directly to provoke a ReferenceError naturally
        renderPage();
      });
    } catch (e) {
      evaluationError = e;
    }

    // Ensure that an error was thrown by the page evaluation
    expect(evaluationError).not.toBeNull();

    // The Playwright error message should include the function name and ReferenceError or 'not defined'
    const msg = evaluationError.message || String(evaluationError);
    expect(msg).toContain('renderPage');
    // Match either explicit "ReferenceError" or "is not defined" depending on the environment
    expect(msg).toMatch(/ReferenceError|is not defined/i);

    // A natural page-level error may have been emitted as a pageerror event; check if one exists.
    // It's acceptable if pageErrors is empty in some environments; we assert that either a thrown evaluation error exists (above)
    // or at least one pageerror event was captured. We do not force both to be present to avoid flaky behavior.
    // If pageErrors were emitted, ensure they reference renderPage as well.
    if (pageErrors.length > 0) {
      const pageErrorMessages = pageErrors.map(e => String(e));
      const found = pageErrorMessages.some(m => /renderPage/i.test(m) || /not defined/i.test(m));
      expect(found).toBe(true);
    }
  });

  // Test 3: Verify no FSM transitions or event handlers exist on the page
  test('FSM transitions and events: none detected (no data-transition attributes or inline event handlers)', async ({ page }) => {
    // The FSM lists no transitions or events. Validate the DOM reflects lack of interactive event hooks.
    const dataTransitionCount = await page.locator('[data-transition]').count();
    expect(dataTransitionCount).toBe(0);

    // Check for common inline DOM event handler attributes (onclick, onchange, oninput, onsubmit, onmouseover)
    const inlineEventCount = await page.locator('[onclick], [onchange], [oninput], [onsubmit], [onmouseover]').count();
    expect(inlineEventCount).toBe(0);

    // Also verify that there are no elements with role="button" which might indicate hidden interactivity
    const roleButtonCount = await page.locator('[role="button"]').count();
    expect(roleButtonCount).toBe(0);
  });

  // Test 4: Edge case / error scenario - calling another nonexistent function
  test('Edge case: invoking other nonexistent globals also throws ReferenceError naturally', async ({ page }) => {
    // Intentionally call a different undefined function to ensure ReferenceError behavior is consistent
    let err = null;
    try {
      await page.evaluate(() => {
        // This function is not defined in the page; allowed to throw naturally
        nonExistentFunction();
      });
    } catch (e) {
      err = e;
    }

    // Ensure the call produced an error
    expect(err).not.toBeNull();

    // The error message should mention the function name or indicate it is not defined
    const text = err.message || String(err);
    expect(text).toContain('nonExistentFunction');
    expect(text).toMatch(/ReferenceError|is not defined/i);
  });
});