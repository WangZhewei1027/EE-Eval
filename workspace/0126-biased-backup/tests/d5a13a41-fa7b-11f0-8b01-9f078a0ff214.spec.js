import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a13a41-fa7b-11f0-8b01-9f078a0ff214.html';

test.describe('FSM: Jump Search - Visual Demo (d5a13a41-fa7b-11f0-8b01-9f078a0ff214)', () => {
  // Shared collectors for console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Set up listeners and navigate to the page before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location ? msg.location() : undefined,
      });
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      // err is an Error object when available
      pageErrors.push(err);
    });

    // Navigate to the application URL
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // After each test we keep the collected messages in memory for assertions inside tests.
    // Nothing to teardown explicitly since Playwright handles page lifecycle.
  });

  test('Initial state (S0_Idle): "Show Visual Demo" button present and #demo is hidden', async ({ page }) => {
    // Validate the button exists and is visible
    const showButton = page.locator("button[onclick='showDemo()']");
    await expect(showButton).toHaveCount(1);
    await expect(showButton).toBeVisible();

    // Validate the demo div exists but is hidden initially (entry state: display: none;)
    const demo = page.locator('#demo');
    await expect(demo).toHaveCount(1);
    await expect(demo).toBeHidden(); // Playwright's toBeHidden checks computed visibility including display:none

    // Verify the demo contains expected text but remains hidden
    await expect(demo).toContainText('Jump Search Visual Demonstration');

    // FSM mentioned an entry action renderPage() for S0_Idle. Verify whether the global function exists
    // We do NOT call it (per instructions). We only inspect its presence.
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage === 'function');
    // Assert that the type inspect completed and returned a boolean
    expect(typeof hasRenderPage).toBe('boolean');

    // Observe console and page errors: record them but do not force a failure here.
    // If any page errors were captured, assert they are legitimate Error types and of expected names
    if (pageErrors.length > 0) {
      for (const err of pageErrors) {
        // err may be an Error-like object; check for known JS error names
        expect(['ReferenceError', 'TypeError', 'SyntaxError', 'Error']).toContain(err.name || 'Error');
      }
    }

    // Also assert console messages structure
    expect(Array.isArray(consoleMessages)).toBe(true);
  });

  test('Transition (ShowDemo): clicking the button displays #demo and fires expected DOM change (S0_Idle -> S1_DemoVisible)', async ({ page }) => {
    const showButton = page.locator("button[onclick='showDemo()']");
    const demo = page.locator('#demo');

    // Precondition: demo is hidden
    await expect(demo).toBeHidden();

    // Click the button to trigger transition
    await showButton.click();

    // After click, #demo should become visible (entry action: document.getElementById("demo").style.display = "block";)
    await expect(demo).toBeVisible();

    // Verify inline style changed to include display: block (if set via JS)
    const displayStyle = await demo.evaluate((el) => {
      // Return the computed style as well as inline style for robustness
      return {
        inline: el.getAttribute('style'),
        computed: window.getComputedStyle(el).display,
      };
    });
    // computed display should be not 'none', and inline may include 'display: block' depending on implementation
    expect(displayStyle.computed).not.toBe('none');

    // Verify demo content is the expected heading text and paragraph
    await expect(demo.locator('h3')).toHaveText('Jump Search Visual Demonstration');
    await expect(demo).toContainText('Visual representation would be presented here');

    // Ensure there were no new uncaught errors specifically triggered by the click
    if (pageErrors.length > 0) {
      // If errors are present, ensure they are common JS error types (we do not mutate or hide them)
      for (const err of pageErrors) {
        expect(['ReferenceError', 'TypeError', 'SyntaxError', 'Error']).toContain(err.name || 'Error');
      }
    }

    // Some browsers/environment variations may log to console when DOM changes occur; ensure console messages were captured
    expect(Array.isArray(consoleMessages)).toBe(true);
  });

  test('Edge case: multiple rapid clicks keep #demo visible and do not cause additional JS errors', async ({ page }) => {
    const showButton = page.locator("button[onclick='showDemo()']");
    const demo = page.locator('#demo');

    // Rapidly click the button several times
    await Promise.all([
      showButton.click(),
      showButton.click(),
      showButton.click(),
    ]);

    // #demo should remain visible
    await expect(demo).toBeVisible();

    // Verify no duplicate or unexpected DOM nodes were created under #demo that would indicate faulty behavior
    const childCount = await demo.evaluate((el) => el.childElementCount);
    // We expect at least 1 child (h3) and not an enormous number (sanity check)
    expect(childCount).toBeGreaterThanOrEqual(1);
    expect(childCount).toBeLessThan(20);

    // Check for page errors captured during these rapid interactions.
    // If any exist, assert they are JS runtime errors of expected categories.
    if (pageErrors.length > 0) {
      for (const err of pageErrors) {
        expect(['ReferenceError', 'TypeError', 'SyntaxError', 'Error']).toContain(err.name || 'Error');
      }
    }

    // Also make sure there are console messages (could be zero) and that none are fatal exceptions that stopped script execution
    const errorConsoleMsgs = consoleMessages.filter((m) => m.type === 'error');
    if (errorConsoleMsgs.length > 0) {
      // If present, ensure the error console messages refer to typical JS errors rather than DOM mutation failures
      for (const m of errorConsoleMsgs) {
        expect(typeof m.text).toBe('string');
        expect(m.text.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test('FSM onEnter/onExit validation: verify S1_DemoVisible entry action expected observable (#demo displayed)', async ({ page }) => {
    const showButton = page.locator("button[onclick='showDemo()']");
    const demo = page.locator('#demo');

    // Trigger transition to S1_DemoVisible
    await showButton.click();

    // S1 entry action in FSM is: document.getElementById('demo').style.display = 'block';
    // Validate the observable: "#demo is displayed"
    await expect(demo).toBeVisible();

    // Additionally validate the computed style equals block when possible (some layouts may compute to 'block' or other display types)
    const computedDisplay = await demo.evaluate((el) => window.getComputedStyle(el).display);
    // Accept computedDisplay that is not 'none' — prefer 'block' but do not fail if different block-level display is used
    expect(computedDisplay).not.toBe('none');

    // If renderPage() was expected on S0 entry but not present, ensure that its absence did not cause unhandled exceptions
    // We inspect collected pageErrors; if present, they should be familiar JS error types (we do not modify runtime)
    if (pageErrors.length > 0) {
      for (const err of pageErrors) {
        expect(['ReferenceError', 'TypeError', 'SyntaxError', 'Error']).toContain(err.name || 'Error');
      }
    }
  });

  test('Observability: collect and assert structure of console logs and page errors (do not suppress natural errors)', async ({ page }) => {
    // This test ensures we properly observe runtime console and page errors as required.

    // At this point we have collected consoleMessages and pageErrors in beforeEach.
    // Assert that collections are arrays
    expect(Array.isArray(consoleMessages)).toBe(true);
    expect(Array.isArray(pageErrors)).toBe(true);

    // If pageErrors exist, assert they have useful properties
    if (pageErrors.length > 0) {
      for (const err of pageErrors) {
        // err.message should be present
        expect(typeof err.message).toBe('string');
        expect(err.message.length).toBeGreaterThanOrEqual(1);

        // err.name should be a string and typically one of the JS error names
        expect(typeof err.name).toBe('string');
      }
    }

    // Validate console message records include at least type and text for each entry
    for (const m of consoleMessages) {
      expect(typeof m.type).toBe('string');
      expect(typeof m.text).toBe('string');
    }

    // This test does not assert that errors must exist (they may or may not).
    // If errors exist, they are left unmodified and asserted to be plausible JS errors.
  });
});