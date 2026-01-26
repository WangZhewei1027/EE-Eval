import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83356d0-fa7b-11f0-b314-ad8654ee5de8.html';

test.describe('Sets — FSM-driven demonstration page (d83356d0-fa7b-11f0-b314-ad8654ee5de8)', () => {

  // Validate initial page load and the Idle state (S0_Idle).
  test('Initial state (S0_Idle): button is present and result container is hidden', async ({ page }) => {
    // Collect console messages and page errors to assert none occur on load.
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    // Load the page exactly as-is (do not modify or patch anything).
    await page.goto(APP_URL);

    // The FSM's Idle state expects the demonstration button to be rendered.
    const btn = page.locator('#demoButton');
    await expect(btn).toBeVisible({ timeout: 2000 });
    await expect(btn).toHaveText('Show demonstration (pre-defined sets)');
    await expect(btn).toHaveAttribute('aria-controls', 'demoResult');

    // The FSM's Idle state expects the result container to be present but hidden.
    const out = page.locator('#demoResult');
    await expect(out).toBeAttached();
    // The HTML initially sets inline style "display:none;"
    const styleAttr = (await out.getAttribute('style')) || '';
    expect(styleAttr.replace(/\s/g, '')).toContain('display:none;'); // allow slight formatting differences

    // Ensure no runtime errors or console.error messages happened during load.
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(errorConsoleMessages.length).toBe(0);
  });

  // Test the transition triggered by the ShowDemonstration event and verify S1 entry actions and evidence.
  test('Transition ShowDemonstration: clicking the button displays results and disables the button (S1_DemonstrationShown)', async ({ page }) => {
    // Capture console errors and page errors during interaction.
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err));

    await page.goto(APP_URL);

    const btn = page.locator('#demoButton');
    const out = page.locator('#demoResult');

    // Pre-click checks: result hidden and button enabled.
    await expect(btn).toBeEnabled();
    const beforeStyle = (await out.getAttribute('style')) || '';
    expect(beforeStyle.replace(/\s/g, '')).toContain('display:none;');

    // Click the demonstration button to trigger the transition S0 -> S1.
    await btn.click();

    // After the click the FSM expects displayResults() to run: out.textContent set, out visible, button disabled, text changed.
    await expect(out).toBeVisible({ timeout: 2000 });

    // Validate key textual outputs produced by the demonstration.
    // We check for several lines that must be present according to the implementation.
    const outText = await out.textContent();
    expect(outText).toBeTruthy();

    // Check Set lines and operations (these substrings reflect the implementation's formatting).
    expect(outText).toContain('Set A = { 1, 3, 4 }');
    expect(outText).toContain('Set B = { 2, 3, 5 }');

    // The union implementation concatenates arrays and preserves first occurrences:
    // union(A,B) => [1,3,4,2,5]
    expect(outText).toContain('A ∪ B = { 1, 3, 4, 2, 5 }');

    // Intersection should contain 3 only
    expect(outText).toContain('A ∩ B = { 3 }');

    // Differences
    expect(outText).toContain('A \\ B = { 1, 4 }');
    expect(outText).toContain('B \\ A = { 2, 5 }');

    // Symmetric difference should be union of differences
    expect(outText).toContain('A Δ B = { 1, 4, 2, 5 }');

    // Cartesian product should include the first pair (1,2) and several others.
    expect(outText).toContain('A × B = {');
    expect(outText).toContain('(1,2)');
    expect(outText).toContain('(4,5)');

    // Power set (P(A)) should include the empty set {} and the full set {1,3,4}
    expect(outText).toContain('P(A) = {');
    expect(outText).toContain('{}');
    expect(outText).toContain('{1,3,4}');

    // The FSM evidence expects out.style.display = "block";
    const afterStyle = (await out.getAttribute('style')) || '';
    // Accept both "display:block;" and "display: block;"
    expect(/display\s*:\s*block/.test(afterStyle)).toBeTruthy();

    // Button should now be disabled with updated text "Demonstration shown"
    await expect(btn).toBeDisabled();
    await expect(btn).toHaveText('Demonstration shown');

    // Clicking again should have no effect (the handler was registered with { once: true } and the button is disabled).
    const contentBeforeSecondClick = outText;
    // Attempt to click again; because the button is disabled this will be a no-op. We still attempt it to emulate user behavior.
    await btn.click();
    const contentAfterSecondClick = await out.textContent();
    expect(contentAfterSecondClick).toBe(contentBeforeSecondClick);

    // Ensure no runtime page errors or console.error messages occurred during interaction.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case tests: ensure repeated navigation and clicking do not produce unexpected exceptions.
  test('Edge cases: reload the page, then click the demonstration button; no runtime errors should occur', async ({ page }) => {
    const pageErrors = [];
    const consoleErrorTexts = [];
    page.on('pageerror', e => pageErrors.push(e));
    page.on('console', msg => { if (msg.type() === 'error') consoleErrorTexts.push(msg.text()); });

    // First load and click.
    await page.goto(APP_URL);
    await page.locator('#demoButton').click();
    await expect(page.locator('#demoResult')).toBeVisible();

    // Reload the page to simulate a fresh session.
    await page.reload();

    // After reload, elements should again be present in Idle state.
    await expect(page.locator('#demoButton')).toBeVisible();
    await expect(page.locator('#demoResult')).toHaveAttribute('style', /display\s*:\s*none|display:none/);

    // Click again after reload; same behavior should occur.
    await page.locator('#demoButton').click();
    await expect(page.locator('#demoResult')).toBeVisible();
    await expect(page.locator('#demoButton')).toBeDisabled();

    // Confirm no page errors or console.error messages were produced across the sequence.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrorTexts.length).toBe(0);
  });

  // Observability test: ensure the page emits no unexpected exceptions (ReferenceError, TypeError, SyntaxError) while exercising all transitions.
  test('Observability: no ReferenceError/TypeError/SyntaxError on full interaction', async ({ page }) => {
    const caughtPageErrors = [];
    page.on('pageerror', err => {
      // Collect full error objects for inspection if any occur.
      caughtPageErrors.push(err);
    });

    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(APP_URL);

    // Perform the single allowed interaction.
    await page.locator('#demoButton').click();

    // Wait briefly to allow any asynchronous errors to surface.
    await page.waitForTimeout(200);

    // Assert no exceptions of the classic JS error types occurred.
    // If any did occur they will be present in caughtPageErrors; assert the array is empty.
    expect(caughtPageErrors.length).toBe(0, `Unexpected page errors: ${caughtPageErrors.map(e => e.message).join('; ')}`);
    expect(consoleErrors.length).toBe(0);
  });

});