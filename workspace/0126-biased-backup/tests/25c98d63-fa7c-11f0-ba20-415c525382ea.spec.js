import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25c98d63-fa7c-11f0-ba20-415c525382ea.html';

// Helper: expected formatted adjacency list string exactly as the page's formatAdjacencyList would produce
function expectedAdjacencyString() {
  return [
    "A → [B, C]",
    "B → [D]",
    "C → [D, E]",
    "D → [F]",
    "E → [(no outgoing edges)]",
    "F → [(no outgoing edges)]",
    "" // final newline from the function's concatenation
  ].join("\n").trimEnd() + "\n";
}

test.describe('25c98d63-fa7c-11f0-ba20-415c525382ea - Directed Graph Demo (FSM Validation)', () => {
  // Capture console messages and page errors for each test to validate runtime behavior and error conditions.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors emitted by the page.
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Load the page exactly as-is; do not modify environment.
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // No global teardown required beyond Playwright fixtures; keep hook for potential extension.
  });

  test('Idle state (S0_Idle): initial render shows button and empty demo output', async ({ page }) => {
    // Validate that the initial page renders the button expected in S0_Idle
    const showGraphButton = await page.locator('#show-graph');
    await expect(showGraphButton).toBeVisible();
    await expect(showGraphButton).toHaveText('Show Example Adjacency List');

    // Validate the demo output div exists, has the correct attributes, and is initially empty
    const outputDiv = await page.locator('#demo-output');
    await expect(outputDiv).toBeVisible();
    await expect(outputDiv).toHaveClass(/demo-output/);
    await expect(outputDiv.getAttribute('aria-live')).resolves.toBe('polite');

    // The FSM entry action for S0_Idle lists renderPage(), but the implementation does not define or call it.
    // We therefore assert that the demo output is empty at initial state (Idle) as evidence of correct initial state.
    const initialText = await outputDiv.textContent();
    // Accept either empty string or whitespace-only content as empty initial state
    expect(initialText).toBeTruthy();
    expect(initialText.trim()).toBe('');

    // Check there were no uncaught page errors during initial render
    expect(pageErrors.length).toBe(0);

    // Ensure no console 'error' messages were emitted during initial load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition ShowGraphClick => Display Graph (S1_DisplayGraph): clicking the button displays adjacency list', async ({ page }) => {
    const showGraphButton = page.locator('#show-graph');
    const outputDiv = page.locator('#demo-output');

    // Click the button to trigger the transition described in the FSM
    await showGraphButton.click();

    // Wait for the demo output to be populated with text content (simple wait for non-empty)
    await expect(outputDiv).toHaveText(/A → \[B, C\]/, { timeout: 2000 });

    // Validate the full content exactly matches the expected formatted adjacency list
    const actual = await outputDiv.textContent();
    const expected = expectedAdjacencyString();
    // Trim both sides for safety, but expect exact structure including arrows and brackets and lines
    expect(actual.trim() + '\n').toBe(expected);

    // Verify that the output container still has the expected aria-live attribute and class after update
    await expect(outputDiv.getAttribute('aria-live')).resolves.toBe('polite');
    await expect(outputDiv).toHaveClass(/demo-output/);

    // Validate that no page errors (ReferenceError, SyntaxError, TypeError, etc.) occurred as a result of the click
    expect(pageErrors.length).toBe(0);

    // Ensure no console 'error' messages were emitted due to the click/action
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: multiple rapid clicks do not corrupt output (idempotency)', async ({ page }) => {
    const showGraphButton = page.locator('#show-graph');
    const outputDiv = page.locator('#demo-output');

    // Rapidly click the button multiple times
    await Promise.all([
      showGraphButton.click(),
      showGraphButton.click(),
      showGraphButton.click()
    ]);

    // Output should be stable and equal to expected adjacency string
    await expect(outputDiv).toHaveText(/A → \[B, C\]/);
    const actual = await outputDiv.textContent();
    const expected = expectedAdjacencyString();
    expect(actual.trim() + '\n').toBe(expected);

    // Confirm no runtime errors were introduced by rapid interactions
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Keyboard activation: pressing Enter on button should trigger display (accessibility)', async ({ page }) => {
    const showGraphButton = page.locator('#show-graph');
    const outputDiv = page.locator('#demo-output');

    // Reload page to reset to initial state for this test
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Focus the button and press Enter to activate it via keyboard
    await showGraphButton.focus();
    await page.keyboard.press('Enter');

    // Validate the output shows adjacency list
    await expect(outputDiv).toHaveText(/A → \[B, C\]/, { timeout: 2000 });
    const actual = await outputDiv.textContent();
    const expected = expectedAdjacencyString();
    expect(actual.trim() + '\n').toBe(expected);

    // Assert no page errors and no console error messages
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('FSM entry/exit action observation: renderPage() is not present/called and causes no ReferenceError', async ({ page }) => {
    // The FSM's meta listed an entry action renderPage() for S0_Idle.
    // The implementation does not define renderPage(). We must not patch the environment.
    // Confirm that no ReferenceError mentioning renderPage occurred during page load or interactions.
    const referencesToRenderPage = pageErrors.filter(err => /renderPage/i.test(err.message));
    expect(referencesToRenderPage.length).toBe(0);

    // Also ensure no generic ReferenceError, SyntaxError, or TypeError exceptions were raised
    const errorTypes = pageErrors.map(e => e.name);
    for (const t of ['ReferenceError', 'SyntaxError', 'TypeError']) {
      expect(errorTypes.includes(t)).toBe(false);
    }

    // Also confirm console did not contain error-level logs indicative of runtime exceptions.
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });

  test('Observability: capture and report any console warnings/info produced by the demo (non-failing)', async ({ page }) => {
    // This test documents any non-error console messages so maintainers can review them.
    // We will click the button to potentially produce logs, then assert there were no errors.
    const showGraphButton = page.locator('#show-graph');
    await showGraphButton.click();

    // Give a short moment for potential console messages to be emitted
    await page.waitForTimeout(200);

    // Collect informational and warning messages (do not fail on their presence)
    const infoMsgs = consoleMessages.filter(m => m.type === 'info' || m.type === 'log');
    const warnMsgs = consoleMessages.filter(m => m.type === 'warning');

    // These are not asserted to be empty; they are captured for observability.
    // However, ensure again that there were no console errors or uncaught page errors.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);

    // Optionally make trivial expectations to ensure the arrays are accessible (not undefined)
    expect(Array.isArray(infoMsgs)).toBe(true);
    expect(Array.isArray(warnMsgs)).toBe(true);
  });
});