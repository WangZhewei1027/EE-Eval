import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a2e7f2-fa7b-11f0-8b01-9f078a0ff214.html';

test.describe('Integration Testing Demo FSM (d5a2e7f2-fa7b-11f0-8b01-9f078a0ff214)', () => {
  // Collections for console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors to validate later
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // Best-effort capture; continue if something unusual happens
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    page.on('pageerror', (err) => {
      // Collect PageError objects (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    // Navigate to the exact application URL (load page as-is)
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Nothing to teardown beyond Playwright's automatic cleanup.
    // Keep hooks to satisfy structure and future extension.
  });

  test('S0_Idle: initial render shows button and demo is hidden; calling missing renderPage() raises ReferenceError', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) expectations:
    // - Button with onclick=showDemo() is present and has correct label
    // - #demo element is not visible by default (CSS .demo { display: none })
    // - The FSM entry action listed "renderPage()" does not exist in the runtime;
    //   calling renderPage() should raise a ReferenceError (we let the error happen naturally).
    const button = page.locator("button[onclick='showDemo()']");
    await expect(button).toHaveCount(1);

    // Verify button text
    await expect(button).toHaveText('Show Integration Testing Demo Example');

    // The demo element should be hidden per stylesheet (computed style should be 'none').
    const initialDisplay = await page.evaluate(() => {
      const el = document.getElementById('demo');
      return window.getComputedStyle(el).display;
    });
    expect(initialDisplay).toBe('none');

    // Ensure there is no global renderPage function defined on the page
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'function');
    expect(hasRenderPage).toBe(true);

    // Now attempt to call renderPage() in page context and assert that it throws naturally.
    // We expect a ReferenceError indicating renderPage is not defined.
    let caughtError = null;
    try {
      // This will throw in the page context since renderPage is not defined.
      await page.evaluate(() => {
        // Intentionally call a non-existent function to let the ReferenceError occur naturally
        renderPage();
      });
    } catch (err) {
      caughtError = err;
    }

    // The evaluate call should have thrown an error in the test context.
    expect(caughtError).not.toBeNull();
    // The message should indicate renderPage is not defined (browser-specific message included)
    expect(String(caughtError.message)).toMatch(/renderPage is not defined|renderPage is not defined/);

    // Also ensure a pageerror event was emitted and captured
    const hasRelevantPageError = pageErrors.some(pe => String(pe.message).includes('renderPage') || String(pe).includes('renderPage'));
    expect(hasRelevantPageError).toBe(true);

    // No unexpected console.error messages should have been logged prior to interactions (besides the captured pageerror above)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    // There might be the same ReferenceError reflected as console.error by some browsers; allow up to 1
    expect(consoleErrors.length).toBeLessThanOrEqual(1);
  });

  test('Transition S0 -> S1 -> S2 via button clicks: verify actual toggle behavior and identify mismatch with FSM expectation', async ({ page }) => {
    // This test validates the transitions triggered by clicking the button (ShowDemo event).
    // According to the FSM:
    // - From S0_Idle, clicking should move to S1_DemoVisible (demo displayed).
    // - From S1_DemoVisible, clicking should move to S2_DemoHidden (demo hidden).
    // - From S2_DemoHidden, clicking should move back to S1_DemoVisible (demo displayed).
    //
    // The implementation has a subtle behavior: showDemo uses element.style.display
    // to toggle, but the CSS display is set via stylesheet (.demo { display: none }),
    // so the first invocation of showDemo() sets element.style.display to 'none' (no visible change).
    // Therefore the first click does NOT show the demo; the second click shows it.
    // We'll assert the actual behavior and explicitly note the mismatch.

    const button = page.locator("button[onclick='showDemo()']");
    const demo = page.locator('#demo');

    // Initial computed display should be 'none'
    const initialComputed = await page.evaluate(() => getComputedStyle(document.getElementById('demo')).display);
    expect(initialComputed).toBe('none');

    // Click 1: per FSM expected visible, but implementation leaves it hidden due to the described bug.
    await button.click();
    // Wait a tick for DOM updates
    await page.waitForTimeout(50);
    const displayAfter1 = await page.evaluate(() => getComputedStyle(document.getElementById('demo')).display);
    // Assert actual application behavior: still 'none'
    expect(displayAfter1).toBe('none');

    // Click 2: should toggle to 'block'
    await button.click();
    await page.waitForTimeout(50);
    const displayAfter2 = await page.evaluate(() => getComputedStyle(document.getElementById('demo')).display);
    expect(displayAfter2).toBe('block');

    // Click 3: should toggle back to 'none'
    await button.click();
    await page.waitForTimeout(50);
    const displayAfter3 = await page.evaluate(() => getComputedStyle(document.getElementById('demo')).display);
    expect(displayAfter3).toBe('none');

    // Map behaviour to FSM transitions and assert mismatches where present
    // S0 -> S1 expected displayed but actual after 1st click is hidden
    expect(displayAfter1).not.toBe('block'); // mismatch demonstration

    // S1 -> S2: when visible, clicking hides again — we validated click 3 hides it after it was visible at click 2
    expect(displayAfter2).toBe('block');
    expect(displayAfter3).toBe('none');
  });

  test('Direct invocation of showDemo() in page context: repeatable toggle sequence and no ReferenceError', async ({ page }) => {
    // This test validates the implementation of showDemo() itself by invoking it directly via page.evaluate.
    // It also asserts that calling showDemo() does not produce page errors (it's a defined function).
    // Sequence: first call -> sets style.display to 'none' (no change), second -> 'block', third -> 'none'

    // Clear any prior captured errors/messages
    consoleMessages.length = 0;
    pageErrors.length = 0;

    // Confirm showDemo exists
    const showDemoType = await page.evaluate(() => typeof window.showDemo);
    expect(showDemoType).toBe('function');

    // Helper to get computed display
    const getDisplay = async () => {
      return await page.evaluate(() => getComputedStyle(document.getElementById('demo')).display);
    };

    const d0 = await getDisplay();
    expect(d0).toBe('none');

    // Call 1
    await page.evaluate(() => showDemo());
    await page.waitForTimeout(30);
    const d1 = await getDisplay();
    // First call leaves it 'none' due to the implementation checking inline style (bug)
    expect(d1).toBe('none');

    // Call 2
    await page.evaluate(() => showDemo());
    await page.waitForTimeout(30);
    const d2 = await getDisplay();
    expect(d2).toBe('block');

    // Call 3
    await page.evaluate(() => showDemo());
    await page.waitForTimeout(30);
    const d3 = await getDisplay();
    expect(d3).toBe('none');

    // No page errors should have been emitted during these valid function calls
    expect(pageErrors.length).toBe(0);
    // And no console.error entries
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  test('Edge case: rapid clicks and multiple toggles produce deterministic state sequence', async ({ page }) => {
    // This test validates resilience to rapid user interactions (edge case).
    // We simulate 4 rapid clicks and assert the final visibility state matches expected implementation logic.

    const button = page.locator("button[onclick='showDemo()']");

    // Ensure starting state is hidden
    const start = await page.evaluate(() => getComputedStyle(document.getElementById('demo')).display);
    expect(start).toBe('none');

    // Rapidly click 4 times
    await Promise.all([
      button.click(),
      button.click(),
      button.click(),
      button.click()
    ]);

    // Allow DOM updates to settle
    await page.waitForTimeout(100);

    // Determine final display state after 4 toggles.
    // Implementation toggle sequence (starting with CSS-only hidden) for consecutive calls is:
    // clicks: 1 -> sets inline 'none' (still hidden)
    //         2 -> 'block'
    //         3 -> 'none'
    //         4 -> 'block'
    const finalDisplay = await page.evaluate(() => getComputedStyle(document.getElementById('demo')).display);
    expect(finalDisplay).toBe('block');

    // No unexpected page errors during rapid clicking.
    expect(pageErrors.length).toBe(0);
  });

  test('Sanity check: DOM structure contains expected components as described in FSM components list', async ({ page }) => {
    // This test ensures the DOM contains the components enumerated in the FSM extraction_summary:
    // - Button selector: button[onclick="showDemo()"]
    // - Demo container: #demo with class "demo"

    const button = page.locator("button[onclick='showDemo()']");
    await expect(button).toHaveCount(1);
    await expect(button).toHaveText('Show Integration Testing Demo Example');

    const demo = page.locator('#demo');
    await expect(demo).toHaveCount(1);

    // Verify the class attribute on demo element
    const demoClass = await page.evaluate(() => document.getElementById('demo').className);
    expect(demoClass.split(/\s+/)).toContain('demo');
  });
});