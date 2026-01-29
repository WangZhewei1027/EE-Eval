import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a09e01-fa7b-11f0-8b01-9f078a0ff214.html';

test.describe('Understanding Tries - FSM-driven interactive demo (Application ID: d5a09e01-fa7b-11f0-8b01-9f078a0ff214)', () => {
  // Per-test collectors for console and page errors
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  // Attach listeners before each test to capture runtime diagnostics
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Collect console events (log, info, warning, error, etc.)
    page.on('console', (msg) => {
      const entry = { type: msg.type(), text: msg.text() };
      consoleMessages.push(entry);
      if (msg.type() === 'error') {
        consoleErrors.push(entry);
      }
    });

    // Collect uncaught errors (pageerror)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page under test
    await page.goto(APP_URL);
  });

  // Cleanup listeners after each test (best-effort - Playwright will create fresh page per test worker by default)
  test.afterEach(async ({ page }) => {
    // Remove handlers to avoid cross-test leakage if the runner reuses page (defensive)
    // Note: Playwright Page does not expose a direct "off" for specific listener function references here,
    // but tests rely on fresh page per test in standard Playwright config. This block is kept for clarity.
    // No operations necessary here in typical setups.
  });

  test('Initial state S0_Idle: demo button is present and demoOutput is hidden', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) as extracted in the FSM:
    // - renderPage() entry action is expected in the FSM metadata but NOT implemented in the HTML.
    // - The page should render a button with id #demoButton and a hidden pre#demoOutput.

    // Assert the demo button exists and is visible (clickable)
    const demoButton = page.locator('#demoButton');
    await expect(demoButton).toBeVisible();
    await expect(demoButton).toHaveText('Show Demonstration');

    // Assert the demoOutput element exists and is initially hidden (display:none)
    const demoOutput = page.locator('#demoOutput');
    await expect(demoOutput).toBeVisible(); // Note: pre exists in DOM; toBeVisible checks layout visibility.
    // However the element has style display:none initially. Use evaluate to get computed style/display attribute.
    const initialDisplay = await page.evaluate(() => {
      const el = document.getElementById('demoOutput');
      return {
        inlineDisplay: el.getAttribute('style'),
        styleDisplay: el.style.display,
        computedDisplay: window.getComputedStyle(el).display
      };
    });

    // The inline style contains 'display:none' per the HTML. Confirm that.
    expect(initialDisplay.inlineDisplay).toContain('display:none');
    expect(initialDisplay.styleDisplay).toBe('none'); // direct style access
    expect(initialDisplay.computedDisplay).toBe('none'); // computed style should also be none

    // Confirm there were no console.error messages or uncaught page errors during initial render
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);

    // The FSM lists an entry_action renderPage() for S0_Idle in the extraction summary.
    // Verify that window.renderPage is NOT defined on the page (we must not define/patch anything).
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(hasRenderPage).toBe(false);
  });

  test('Transition S0_Idle -> S1_DemonstrationVisible on ShowDemonstration click: demoOutput becomes visible and populated', async ({ page }) => {
    // This test validates the transition triggered by clicking #demoButton:
    // - The #demoOutput should become visible (style.display = 'block')
    // - The #demoOutput.textContent should contain the demonstration text.

    const demoButton = page.locator('#demoButton');
    const demoOutput = page.locator('#demoOutput');

    // Click the demo button to trigger ShowDemonstration event
    await demoButton.click();

    // After click, the inline style should have been updated to show the output.
    // Use evaluate to retrieve both style and computed style for reliability.
    const afterClick = await page.evaluate(() => {
      const el = document.getElementById('demoOutput');
      return {
        inlineDisplay: el.getAttribute('style'),
        styleDisplay: el.style.display,
        computedDisplay: window.getComputedStyle(el).display,
        textContent: el.textContent
      };
    });

    // The FSM expected observable is "#demoOutput.style.display = 'block'".
    // Confirm inline or style display now indicates visible (commonly 'block' per implementation).
    expect(afterClick.styleDisplay === 'block' || afterClick.computedDisplay !== 'none').toBeTruthy();

    // Assert the content was set to the demo text and contains key expected phrases
    expect(afterClick.textContent).toContain('Trie Demonstration');
    expect(afterClick.textContent).toContain('Inserting words: "dog", "deer", "deal"');
    expect(afterClick.textContent).toContain('Searching for "deer": Found.');
    expect(afterClick.textContent).toContain('Searching for "dog": Found.');

    // Also verify the #demoOutput is the expected tag type (<pre>)
    const tagName = await page.evaluate(() => document.getElementById('demoOutput').tagName.toLowerCase());
    expect(tagName).toBe('pre');

    // Ensure no console.error entries or uncaught errors were generated by the click handler
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleEntries.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Idempotency and robustness: multiple rapid clicks do not throw and keep output consistent', async ({ page }) => {
    // This test exercises edge-case behavior by clicking the demonstration button multiple times rapidly
    // to ensure the page remains stable and the demo output remains consistent without introducing errors.

    const demoButton = page.locator('#demoButton');

    // Perform multiple rapid clicks
    await Promise.all([
      demoButton.click(),
      demoButton.click(),
      demoButton.click()
    ]);

    // After rapid clicks, check that the demoOutput is visible and contains expected content
    const content = await page.locator('#demoOutput').textContent();
    expect(content).toBeTruthy();
    expect(content).toContain('Trie Demonstration');
    expect(content).toContain('deer');
    expect(content).toContain('dog');
    expect(content).toContain('deal');

    // Assert that no page-level uncaught exceptions occurred during the rapid interactions
    expect(pageErrors.length).toBe(0);

    // Assert that no console.error messages were emitted
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleEntries.length).toBe(0);
  });

  test('Edge-case: clicking when demoOutput is already visible should not change structure unexpectedly', async ({ page }) => {
    // This test verifies that clicking the button after the demo is already visible does not remove the element
    // or collapse its display back to hidden or corrupt its text content.

    const demoButton = page.locator('#demoButton');

    // First click to show the demo
    await demoButton.click();

    // Capture the content and computed display
    const snapshot1 = await page.evaluate(() => {
      const el = document.getElementById('demoOutput');
      return {
        displayBefore: el.style.display,
        textBefore: el.textContent,
        lengthBefore: el.textContent.length
      };
    });

    // Click again
    await demoButton.click();

    // Capture again and compare
    const snapshot2 = await page.evaluate(() => {
      const el = document.getElementById('demoOutput');
      return {
        displayAfter: el.style.display,
        textAfter: el.textContent,
        lengthAfter: el.textContent.length
      };
    });

    // The display should remain showing (not revert to 'none')
    expect(snapshot2.displayAfter === 'block' || snapshot2.displayAfter !== 'none').toBeTruthy();

    // Text length should be stable or equal (click does not append garbage)
    expect(snapshot2.lengthAfter).toBeGreaterThanOrEqual(0);
    expect(snapshot2.textAfter).toContain('Trie Demonstration');

    // If the implementation simply overwrites textContent with the same content, lengths may match
    expect(snapshot2.lengthAfter).toBeGreaterThanOrEqual(snapshot1.lengthBefore);

    // Verify again there are no unexpected errors
    expect(pageErrors.length).toBe(0);
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleEntries.length).toBe(0);
  });

  test('Sanity check: ensure no unexpected ReferenceError/SyntaxError/TypeError occurred during lifecycle', async ({ page }) => {
    // The instructions emphasize observing console logs and page errors and letting runtime errors occur naturally.
    // This test asserts that none of those runtime errors occurred on page load or during interactions above.
    // If the application had attempted to call a missing function (e.g., renderPage()) at load, pageErrors would contain it.
    // We assert that pageErrors is empty here, meaning no uncaught runtime exceptions happened.

    // For additional assurance, perform one click to exercise the interactive code path
    await page.click('#demoButton');

    // Wait a small moment to allow any asynchronous errors to surface
    await page.waitForTimeout(100);

    // Assert that no uncaught page errors were recorded
    expect(pageErrors.length).toBe(0);

    // Assert that no console.error messages were recorded
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleEntries.length).toBe(0);

    // If there were console.warn/info messages, it's acceptable — we only fail on explicit error-level messages or uncaught exceptions.
  });

});