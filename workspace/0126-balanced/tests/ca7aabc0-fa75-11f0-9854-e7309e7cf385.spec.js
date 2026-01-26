import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/ca7aabc0-fa75-11f0-9854-e7309e7cf385.html';

test.describe('Application: CPU Scheduling (Application ID: ca7aabc0-fa75-11f0-9854-e7309e7cf385)', () => {
  // Shared arrays to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Attach listeners before each test and navigate to the page
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (logs, warnings, errors, etc.)
    page.on('console', (msg) => {
      // store both type and text for diagnostic assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // store the error message string for assertions
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Load the page exactly as-is
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // remove all listeners to avoid cross-test pollution
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test.describe('State: S0_Idle (entry rendering and static content)', () => {
    test('renders the main heading and description paragraph (evidence for S0_Idle)', async ({ page }) => {
      // Validate the main heading exists and contains expected text
      const h1 = await page.locator('h1').first();
      await expect(h1).toHaveCount(1);
      await expect(h1).toHaveText('CPU Scheduling');

      // Validate that the descriptive paragraph from the FSM evidence exists
      const paragraphs = page.locator('p');
      // find paragraph that contains the expected description fragment
      const paraText = await paragraphs.first().innerText();
      await expect(paraText).toContain('CPU scheduling is the process of managing how processors (CPU) are used to perform tasks and processes');

      // Check for the presence of the example section header
      const h2 = await page.locator('h2').first();
      await expect(h2).toHaveText('Example');
    });

    test('renders the list of scheduling algorithms and includes expected items', async ({ page }) => {
      // Ensure the unordered list exists and has at least the expected number of items
      const listItems = page.locator('ul > li');
      const count = await listItems.count();
      // The provided HTML contains multiple list items; assert at least 5 as in the FSM description
      expect(count).toBeGreaterThanOrEqual(5);

      // Validate some expected list item texts to ensure content correctness
      const expectedSnippets = [
        'Max-Max scheduling',
        'Dynamic scheduling',
        'Resource allocation scheduling',
        'Quota-based scheduling',
        'Concurrent scheduling'
      ];

      for (const snippet of expectedSnippets) {
        const matches = await page.locator(`ul > li:has-text("${snippet}")`).count();
        expect(matches).toBeGreaterThanOrEqual(1);
      }
    });

    test('contains the example code snippet text and special characters unchanged', async ({ page }) => {
      // The HTML includes raw code-like text (not executed). Ensure the textual content appears.
      const pageContent = await page.content();

      // Check presence of a recognizable piece of the inline code block
      expect(pageContent).toContain('var cpu1 = new Array(10).fill(false);');
      expect(pageContent).toContain('for (var i = 0; i < 10; i++) {');

      // Check the unusual character sequence from the text ("凌ation.")
      expect(pageContent).toContain('凌ation.');
    });
  });

  test.describe('FSM behaviors, entry/exit actions, and error scenarios', () => {
    test('S0_Idle entry action "renderPage()" is referenced by FSM but not defined on the page; calling it should throw ReferenceError', async ({ page }) => {
      // First assert that renderPage is not defined in the page context
      const renderPageType = await page.evaluate(() => {
        // This check does not call renderPage, it only inspects its type
        return typeof window.renderPage;
      });
      expect(renderPageType).toBe('undefined');

      // Now attempt to call renderPage() as an edge-case to let any ReferenceError occur naturally.
      // We expect page.evaluate to reject (throw) because renderPage is not defined.
      await expect(page.evaluate(() => {
        // This will cause a ReferenceError in the page execution context if renderPage is not defined
        // We purposely do not guard or define it to let the runtime error happen naturally.
        // eslint-disable-next-line no-undef
        return renderPage();
      })).rejects.toThrow(/renderPage is not defined|ReferenceError/);

      // The pageerror event may have been fired as a result of the uncaught exception in the page context.
      // Assert that at least one page error mentioning renderPage or ReferenceError is present.
      const hasRenderPageError = pageErrors.some(msg => /renderPage|ReferenceError/.test(msg));
      expect(hasRenderPageError).toBeTruthy();
    });

    test('no interactive elements or transitions exist (buttons, inputs, clickable anchors) as per FSM extraction', async ({ page }) => {
      // Query for common interactive elements
      const interactiveSelectors = 'button, input, select, textarea, [role="button"], a[href], form';
      const interactiveCount = await page.locator(interactiveSelectors).count();

      // The extraction summary stated "No buttons, inputs, or links were detected."
      // Assert that there are zero interactive elements (or at least none meaningful).
      expect(interactiveCount).toBe(0);
    });

    test('attempting to interact with non-existent interactive controls should fail gracefully', async ({ page }) => {
      // Try to locate a button that should not exist and assert count is zero.
      const missingButton = page.locator('button#nonexistent-control');
      await expect(missingButton).toHaveCount(0);

      // If we attempt to click it via the Playwright Locator API, it will time out.
      // Instead of letting the test hang or fail due to timeout, we explicitly check for absence before click.
      let clickError = null;
      try {
        // We deliberately attempt a click using evaluate which will throw when element is null.
        await page.evaluate(() => {
          const el = document.querySelector('button#nonexistent-control');
          if (!el) {
            // Simulate what a page script might do when trying to call methods on null
            // This will cause a TypeError inside the page context which we catch in the test flow.
            // eslint-disable-next-line no-undef
            el.click();
          }
        });
      } catch (err) {
        clickError = err;
      }

      // Ensure that an error was thrown by the attempted interaction in-page
      expect(clickError).not.toBeNull();
      // The error could be a Playwright evaluation rejection; check message includes likely TypeError or similar
      expect(String(clickError.message || clickError)).toMatch(/(cannot read|is not a function|TypeError|null)/i);
    });
  });

  test.describe('Observability: console messages and page errors during load', () => {
    test('no unexpected console errors were emitted during initial page load (aside from deliberate test-induced errors)', async ({ page }) => {
      // There may be debug/info logs; ensure there are no console messages of type 'error' unrelated to our tests yet.
      const loadErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      // It's acceptable for there to be zero; assert that there are none at initial load (before test-induced evaluate calls).
      expect(loadErrors.length).toBe(0);
    });

    test('pageErrors array is accessible and can be used for diagnostics', async ({ page }) => {
      // pageErrors was collected in beforeEach; assert it's an array
      expect(Array.isArray(pageErrors)).toBeTruthy();
      // At this point (fresh load) there should be zero uncaught exceptions
      expect(pageErrors.length).toBe(0);
    });
  });
});