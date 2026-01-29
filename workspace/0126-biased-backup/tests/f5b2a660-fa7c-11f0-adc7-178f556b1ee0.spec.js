import { test, expect } from '@playwright/test';

const PAGE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b2a660-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('Indexing Interactive Application (FSM validation)', () => {
  // Shared variables to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // If anything goes wrong collecting console messages, still allow tests to proceed.
        consoleMessages.push({ type: 'unknown', text: String(e) });
      }
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Navigate to the application page (must be served exactly as-is)
    await page.goto(PAGE_URL);
  });

  test.afterEach(async ({ page }) => {
    // Ensure page is closed/cleaned up by Playwright fixtures automatically.
    // We still assert that no unexpected page errors leaked during the test.
    // (Specific per-test assertions are done inside tests)
  });

  test.describe('State S0_Idle (Initial Render)', () => {
    test('Initial render shows Learn More button and no runtime errors', async ({ page }) => {
      // This test validates the Idle state (S0_Idle) evidence:
      // - The Learn More button with id #indexing-explanation is present
      // - The button text is "Learn More"
      // - No runtime page errors (ReferenceError, SyntaxError, TypeError) occurred on load

      const button = page.locator('#indexing-explanation');

      // Button exists
      await expect(button).toBeVisible();

      // Button initially shows "Learn More"
      await expect(button).toHaveText('Learn More');

      // There should be no uncaught page errors right after load
      expect(pageErrors.length).toBe(0);

      // There should be no console.error messages
      const consoleErrors = consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.text));
      expect(consoleErrors.length).toBe(0);

      // Specifically ensure no obvious runtime ReferenceError/SyntaxError/TypeError logged
      const errorKeywords = ['ReferenceError', 'SyntaxError', 'TypeError', 'renderPage'];
      const foundErrorKeyword = consoleMessages.some(m => errorKeywords.some(k => m.text.includes(k))) ||
                                pageErrors.some(msg => errorKeywords.some(k => msg.includes(k)));
      expect(foundErrorKeyword).toBe(false);
    });

    test('Idle state DOM contains expected descriptive content', async ({ page }) => {
      // Validate the static descriptive sections of the page are present (part of renderPage() expectation)
      // - The page title h1 "Indexing" exists
      // - Several paragraphs of descriptive text exist
      await expect(page.locator('h1')).toHaveText('Indexing');

      // There are multiple paragraphs describing indexing; assert that one of the key phrases exists
      await expect(page.locator('text=Indexing is the process of creating a data structure')).toBeVisible();

      // Ensure the page contains list items that explain algorithm steps (pre-click)
      await expect(page.locator('text=Indexing: Creating a data structure')).toBeVisible();
    });
  });

  test.describe('Event: LearnMoreClick -> Transition to S1_ExplanationVisible', () => {
    test('Clicking Learn More replaces button text with explanation (transition happens)', async ({ page }) => {
      // This test fires the LearnMoreClick event and verifies transition to Explanation Visible (S1)
      const button = page.locator('#indexing-explanation');

      // Confirm initial state
      await expect(button).toHaveText('Learn More');

      // Click the Learn More button (fires the event listener defined in the page script)
      await button.click();

      // After click, the button text should no longer be the original label
      await expect(button).not.toHaveText('Learn More');

      // The explanation string inserted by the handler contains this distinctive phrase:
      const expectedPhrase = 'The indexing algorithm used in databases is typically based on a combination of the following steps';
      // The inserted content may be normalized by the browser (block tags inside <button> are invalid HTML)
      // So assert the text appears somewhere on the page, which indicates the explanation is displayed
      await expect(page.locator(`text=${expectedPhrase}`)).toBeVisible();

      // Also assert that the button's innerHTML (if present) contains at least one of the expected list items
      const innerHTML = await button.evaluate((el) => el.innerHTML);
      // The innerHTML could be different depending on browser normalization, but we assert that either:
      // - The innerHTML contains a recognizable substring OR
      // - The page contains the expected phrase (already asserted above)
      // Here we assert the innerHTML contains either 'Indexing: Creating a data structure' or the paragraph start
      const containsExpectedSubstring = innerHTML.includes('Indexing: Creating a data structure') ||
                                        innerHTML.includes('The indexing algorithm used in databases');
      expect(containsExpectedSubstring).toBe(true);

      // No unhandled page errors should have occurred during the click and DOM update
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.text));
      expect(consoleErrors.length).toBe(0);
    });

    test('Clicking Learn More multiple times is idempotent and does not produce runtime errors', async ({ page }) => {
      // Edge case: clicking multiple times should not throw or break the page
      const button = page.locator('#indexing-explanation');
      await expect(button).toHaveText('Learn More');

      // Click once
      await button.click();
      await expect(page.locator('text=The indexing algorithm used in databases is typically based')).toBeVisible();

      // Click again (second click should attempt to set innerHTML again)
      await button.click();

      // After second click, the explanation content should still be present
      await expect(page.locator('text=Indexing: Creating a data structure')).toBeVisible();

      // Ensure id attribute remains (the element is the same element)
      const idAttr = await button.getAttribute('id');
      expect(idAttr).toBe('indexing-explanation');

      // Ensure no page errors were recorded after repeated clicks
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.text));
      expect(consoleErrors.length).toBe(0);
    });

    test('Dispatching a synthetic click event triggers the same transition', async ({ page }) => {
      // Validate that programmatic dispatch of a click event triggers the same behavior
      const button = page.locator('#indexing-explanation');

      // Programmatically dispatch a click event from within page context
      await page.evaluate(() => {
        const btn = document.getElementById('indexing-explanation');
        if (btn) {
          const evt = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
          btn.dispatchEvent(evt);
        }
      });

      // Expect explanation text to be visible somewhere in the document after dispatch
      await expect(page.locator('text=The indexing algorithm used in databases is typically based')).toBeVisible();

      // No unexpected runtime errors were thrown
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.text));
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('FSM onEnter/onExit verification and robustness checks', () => {
    test('Verify mentioned entry action renderPage() does not cause ReferenceError at load', async ({ page }) => {
      // The FSM metadata mentions renderPage() as an entry action for S0_Idle.
      // The HTML/JS does not define renderPage(), and we must not patch or inject anything.
      // Assert that no ReferenceError regarding renderPage occurred during load.
      const foundReferenceToRenderPage = consoleMessages.some(m => m.text.includes('ReferenceError') && m.text.includes('renderPage')) ||
                                         pageErrors.some(msg => msg.includes('ReferenceError') && msg.includes('renderPage'));

      // We expect the page to have loaded without throwing a ReferenceError for renderPage()
      expect(foundReferenceToRenderPage).toBe(false);
    });

    test('Ensure that invalid nested HTML inside <button> is handled gracefully (no TypeError/SyntaxError)', async ({ page }) => {
      // The script sets innerHTML of a button to include block elements (paragraphs, UL).
      // This is invalid HTML but should not cause runtime exceptions. Validate that.
      const button = page.locator('#indexing-explanation');
      await button.click();

      // Check for presence of expected textual content anywhere in the page
      await expect(page.locator('text=Indexing: Creating a data structure')).toBeVisible();

      // Ensure no TypeError or SyntaxError messages were recorded
      const errorKeywords = ['TypeError', 'SyntaxError'];
      const found = consoleMessages.some(m => errorKeywords.some(k => m.text.includes(k))) ||
                    pageErrors.some(msg => errorKeywords.some(k => msg.includes(k)));
      expect(found).toBe(false);
    });
  });

  test.describe('Comprehensive integration checks', () => {
    test('Full flow: initial state -> click -> explanation visible -> repeated interactions remain stable', async ({ page }) => {
      const button = page.locator('#indexing-explanation');

      // Initial conditions
      await expect(button).toBeVisible();
      await expect(button).toHaveText('Learn More');

      // Trigger transition
      await button.click();

      // Confirm explanation appears
      await expect(page.locator('text=The indexing algorithm used in databases is typically based')).toBeVisible();

      // Interact with other parts of the page to ensure page remains stable after transition
      // For example, ensure other paragraphs still exist and are visible
      await expect(page.locator('text=Example of indexing in action')).toBeVisible();

      // Ensure multiple clicks and synthetic dispatches don't create errors
      await button.click();
      await page.evaluate(() => {
        const btn = document.getElementById('indexing-explanation');
        if (btn) btn.dispatchEvent(new Event('click', { bubbles: true }));
      });

      // Final sanity assertions: no uncaught page errors and no console.error messages
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.text));
      expect(consoleErrors.length).toBe(0);
    });
  });
});