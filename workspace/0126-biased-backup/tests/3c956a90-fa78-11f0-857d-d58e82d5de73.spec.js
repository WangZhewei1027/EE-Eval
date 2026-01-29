import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c956a90-fa78-11f0-857d-d58e82d5de73.html';

test.describe('Linked List Visualization - FSM states and transitions', () => {
  // Arrays to collect console messages and page errors for observation and assertions
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages emitted by the page
    page.on('console', msg => {
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text()
        });
      } catch (e) {
        // Defensive: should not modify page environment
      }
    });

    // Collect uncaught page errors
    page.on('pageerror', err => {
      // store string message for easier assertions
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Navigate to the application page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // No teardown modifications to the page; listeners are bound to the page fixture and
    // will be cleaned up by Playwright automatically when the page is closed.
  });

  test('Initial Idle state (S0_Idle) - UI elements present and initial values', async ({ page }) => {
    // This test validates the Idle state: initial DOM rendering, button state and node values
    // Validate the Change Values button exists and has aria-pressed="false"
    const btn = await page.waitForSelector('#btn-change');
    expect(btn).not.toBeNull();
    const ariaPressed = await btn.getAttribute('aria-pressed');
    expect(ariaPressed).toBe('false');

    // Validate the three node value elements exist and have the initial texts 10, 23, 35
    const node0Text = await page.textContent('#node-0 .value');
    const node1Text = await page.textContent('#node-1 .value');
    const node2Text = await page.textContent('#node-2 .value');

    expect(node0Text && node0Text.trim()).toBe('10');
    expect(node1Text && node1Text.trim()).toBe('23');
    expect(node2Text && node2Text.trim()).toBe('35');

    // Validate accessibility attributes on node values
    const node0AriaLive = await page.getAttribute('#node-0 .value', 'aria-live');
    const node1AriaLive = await page.getAttribute('#node-1 .value', 'aria-live');
    const node2AriaLive = await page.getAttribute('#node-2 .value', 'aria-live');
    expect(node0AriaLive).toBe('polite');
    expect(node1AriaLive).toBe('polite');
    expect(node2AriaLive).toBe('polite');

    // Validate no uncaught page errors on initial load
    expect(pageErrors).toEqual([]);
  });

  test('ChangeValues event transitions to S1_ValuesChanged and updates node values', async ({ page }) => {
    // This test validates clicking the Change Values button cycles the values once
    // and toggles aria-pressed to "true", and that the visual inline style pulse is applied.

    // Click the button
    await page.click('#btn-change');

    // Immediately after click, the implementation sets inline styles on the node values.
    // Assert the inline style property for the first node's color is the CSS variable string.
    const inlineColor = await page.$eval('#node-0 .value', el => el.style.color);
    expect(inlineColor).toBe('var(--pointer-color)');

    // The button should have toggled aria-pressed from "false" to "true"
    const ariaPressedAfter = await page.getAttribute('#btn-change', 'aria-pressed');
    expect(ariaPressedAfter).toBe('true');

    // Wait for the update timeout (300ms in implementation). Give a little buffer.
    await page.waitForTimeout(450);

    // After the timeout, the node textContent should have been updated to the next set [7,14,21]
    const node0Text = await page.textContent('#node-0 .value');
    const node1Text = await page.textContent('#node-1 .value');
    const node2Text = await page.textContent('#node-2 .value');
    expect(node0Text && node0Text.trim()).toBe('7');
    expect(node1Text && node1Text.trim()).toBe('14');
    expect(node2Text && node2Text.trim()).toBe('21');

    // Confirm no unexpected page errors occurred during this interaction
    expect(pageErrors).toEqual([]);
  });

  test('Subsequent ChangeValues event toggles aria-pressed back and cycles values again', async ({ page }) => {
    // This validates the FSM transition back (S1 -> S0) in terms of accessibility toggle and value updates.
    // Perform two sequential clicks to observe two transitions and aria-pressed toggling.

    // First click
    await page.click('#btn-change');
    // Slight pause to ensure the first click's inline style is applied
    await page.waitForTimeout(50);

    // Second click (triggers next cycle)
    await page.click('#btn-change');

    // Immediately after second click, aria-pressed should have toggled back to "false"
    const ariaPressedAfterTwo = await page.getAttribute('#btn-change', 'aria-pressed');
    expect(ariaPressedAfterTwo).toBe('false');

    // Wait for the last update to complete (300ms + buffer)
    await page.waitForTimeout(450);

    // After two clicks, values should have cycled to the next set [19,42,58]
    const node0Text = await page.textContent('#node-0 .value');
    const node1Text = await page.textContent('#node-1 .value');
    const node2Text = await page.textContent('#node-2 .value');
    expect(node0Text && node0Text.trim()).toBe('19');
    expect(node1Text && node1Text.trim()).toBe('42');
    expect(node2Text && node2Text.trim()).toBe('58');

    // No uncaught script errors expected during normal operation
    expect(pageErrors).toEqual([]);
  });

  test('Rapid sequential clicks produce the expected final values (concurrent timeouts)', async ({ page }) => {
    // Edge case: user clicks the Change Values button multiple times quickly.
    // Expect the final visible values to reflect the last scheduled update.

    // Perform two rapid clicks without waiting for the animation timeout in between
    await Promise.all([
      page.click('#btn-change'),
      page.click('#btn-change')
    ]);

    // Wait longer than the animation timeout to allow both scheduled updates to run
    await page.waitForTimeout(600);

    // After two rapid clicks from the initial state (index 0),
    // the final index should be 2 and values should be [19,42,58]
    const node0Text = await page.textContent('#node-0 .value');
    const node1Text = await page.textContent('#node-1 .value');
    const node2Text = await page.textContent('#node-2 .value');
    expect(node0Text && node0Text.trim()).toBe('19');
    expect(node1Text && node1Text.trim()).toBe('42');
    expect(node2Text && node2Text.trim()).toBe('58');

    // Validate aria-pressed toggled appropriately: two toggles from false -> true -> false
    const ariaPressedFinal = await page.getAttribute('#btn-change', 'aria-pressed');
    expect(ariaPressedFinal).toBe('false');

    // Ensure no unexpected page errors occurred during rapid interactions
    expect(pageErrors).toEqual([]);
  });

  test('Attempt to call non-implemented entry action renderPage() results in ReferenceError', async ({ page }) => {
    // The FSM's entry action mentions renderPage(), but the implementation does not define it.
    // We intentionally invoke renderPage() inside the page context to validate that a ReferenceError
    // (renderPage is not defined) occurs naturally and is observable.

    let caughtError = null;
    try {
      // This will throw in the page context because renderPage is not defined.
      await page.evaluate(() => {
        // Do not define or patch anything. Call the function as-is to let the runtime produce an error.
        // eslint-disable-next-line no-undef
        return renderPage();
      });
    } catch (err) {
      // The thrown error object is a Playwright EvaluationError that includes the page-side error message.
      caughtError = err;
    }

    // Assert that an error was thrown and that the message contains the name 'renderPage' or 'is not defined'
    expect(caughtError).toBeTruthy();
    const message = String(caughtError.message || '');
    expect(message.toLowerCase()).toContain('renderpage');
    // It should indicate that the function is not defined; message varies by browser but typically includes 'not defined'
    expect(message.toLowerCase()).toMatch(/not defined|is not defined|referenceerror/);
  });

  test('DOM structure and footer content presence', async ({ page }) => {
    // Additional checks to ensure the overall document structure aligns with expectations.

    // Header text
    const headerText = await page.textContent('header h1');
    expect(headerText && headerText.trim()).toBe('Linked List');

    // Footer exists and contains the expected text snippet
    const footerText = await page.textContent('footer');
    expect(footerText && footerText.includes('Visual Learning')).toBeTruthy();

    // Null node present with ∅ symbol (aria-hidden true on value)
    const nullNodeValue = await page.textContent('.node.null-node .value');
    expect(nullNodeValue && nullNodeValue.trim()).toBe('∅');

    // No page errors from simple DOM inspection
    expect(pageErrors).toEqual([]);
  });

  test('Observe console messages emitted during interactions (if any) and ensure safe handling', async ({ page }) => {
    // This test intentionally interacts and then asserts that console messages (if any) are captured.
    // It does not assume console errors are present; it asserts we have a captured record (array exists).

    // Clear any previously captured console messages
    consoleMessages = [];

    // Trigger an interaction
    await page.click('#btn-change');
    await page.waitForTimeout(450);

    // We don't require any console messages to exist, but the harness must capture them safely.
    expect(Array.isArray(consoleMessages)).toBe(true);

    // If there are console error-level messages, surface them in the test output by failing the test.
    // We allow informational logs but not console.error messages.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});