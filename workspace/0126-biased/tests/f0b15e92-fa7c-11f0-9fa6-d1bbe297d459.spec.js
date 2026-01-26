import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b15e92-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('FSM: Comprehensive Guide to Multisets (Application f0b15e92...)', () => {
  // Arrays to collect runtime observations for each test
  let consoleMessages;
  let pageErrors;

  // Set up page listeners and navigate to the app before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture all console events (log, warn, error, info, etc.)
    page.on('console', (msg) => {
      // store objects with type and text for easier assertions later
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL);
  });

  // Clean up after each test (close page is handled by Playwright fixtures automatically,
  // but we provide this hook for symmetry and potential future needs)
  test.afterEach(async ({ page }) => {
    // No special teardown required; ensure page is still reachable for diagnostics if needed
    // Intentionally do not modify page or inject anything.
    await page.evaluate(() => void 0).catch(() => {});
  });

  test('S0_Idle - initial state: demo button exists and demo output is empty', async ({ page }) => {
    // This test validates the initial FSM state S0_Idle:
    // - The demo button (#demoButton) is present, visible, and has correct label
    // - The demo output area (#demoOutput) exists and is initially empty
    // - No uncaught page errors have occurred during initial load
    const demoButton = page.locator('#demoButton');
    await expect(demoButton).toBeVisible({ timeout: 2000 });
    await expect(demoButton).toHaveText('Show Multiset Operation Example');

    const demoOutput = page.locator('#demoOutput');
    await expect(demoOutput).toBeVisible({ timeout: 2000 });

    // Check that the output is empty at initial render (trim whitespace)
    const outputText = (await demoOutput.textContent()) || '';
    expect(outputText.trim()).toBe('', 'Expected demoOutput to be empty in the Idle state');

    // Ensure no uncaught page errors at initial load time
    expect(pageErrors.length).toBe(0);
    // Ensure no console.error messages were emitted on load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('ShowDemo event/transition: clicking button displays the multiset operation example (S1_DemoDisplayed)', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_DemoDisplayed when the #demoButton is clicked.
    // It asserts that the demo output contains the formatted multisets and operation results.

    const demoButton = page.locator('#demoButton');
    const demoOutput = page.locator('#demoOutput');

    // Ensure button is ready then click it to trigger the demo
    await expect(demoButton).toBeEnabled({ timeout: 2000 });
    await demoButton.click();

    // Wait for demoOutput to be populated
    await page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      return el && el.innerText.trim().length > 0;
    }, null, { timeout: 2000 });

    // Extract the output text for assertions
    const outputText = (await demoOutput.textContent()) || '';

    // Verify the output contains key labeled sections (evidence of displayDemoOutput action)
    expect(outputText).toContain('Multiset A');
    expect(outputText).toContain('Multiset B');
    expect(outputText).toContain('Union (A ∪ B):');
    expect(outputText).toContain('Intersection (A ∩ B):');
    expect(outputText).toContain('Sum (A + B):');

    // Verify expected formatted multiplicities appear (formatMultiset uses → and no surrounding braces/quotes)
    // We assert presence of representative entries for the computed results:
    // - Multiset A should produce something including a→2 (A has a:2)
    // - Multiset B introduces d→1 in union/sum, so d→1 should appear as well
    expect(outputText).toMatch(/a→\s*2|a→2/); // allow optional whitespace
    expect(outputText).toMatch(/d→\s*1|d→1/);

    // Check union expected values (max): a:2,b:2,c:3,d:1 should show at least a→2 and d→1
    expect(outputText).toContain('Union (A ∪ B):');
    // Check intersection expected values (min): a:1,b:1 should appear
    expect(outputText).toMatch(/a→\s*1|a→1/);
    expect(outputText).toMatch(/b→\s*1|b→1/);

    // Ensure no uncaught page errors occurred during the click and rendering
    expect(pageErrors.length).toBe(0, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0, `Unexpected console.error messages: ${consoleErrors.map(e => e.text).join('; ')}`);
  });

  test('Click idempotence and overwrite behavior: clicking the demo button twice does not duplicate entries', async ({ page }) => {
    // This test checks for edge-case behavior: clicking the button multiple times should
    // overwrite the demoOutput (since the implementation assigns innerHTML) rather than appending duplicates.

    const demoButton = page.locator('#demoButton');
    const demoOutput = page.locator('#demoOutput');

    await demoButton.click();
    await page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      return el && el.innerText.trim().length > 0;
    }, null, { timeout: 2000 });

    const firstHtml = (await demoOutput.innerHTML()) || '';

    // Click again and wait briefly for potential changes
    await demoButton.click();
    // small wait to let handler run
    await page.waitForTimeout(200);

    const secondHtml = (await demoOutput.innerHTML()) || '';

    // The implementation sets output.innerHTML = `...` so repeated clicks should produce identical HTML (overwrite)
    expect(secondHtml).toBe(firstHtml);

    // Confirm no errors were introduced by repeated clicks
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Component existence and attributes per FSM evidence', async ({ page }) => {
    // This test verifies the components extracted in the FSM are present and accessible:
    // - button #demoButton
    // - div #demoOutput
    // Also validates the button is interactive (not disabled) and has expected accessible name.

    const button = page.locator('#demoButton');
    const output = page.locator('#demoOutput');

    await expect(button).toHaveCount(1);
    await expect(output).toHaveCount(1);

    // Accessibility expectations - visible and enabled
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();

    // Ensure the button's accessible name matches the visible text
    expect(await button.innerText()).toBe('Show Multiset Operation Example');

    // demoOutput should exist and be initially empty (checked again to ensure consistent state across tests)
    const initialOutput = (await output.textContent()) || '';
    expect(initialOutput.trim().length).toBeLessThanOrEqual(0);

    // No runtime errors emitted simply by querying attributes
    expect(pageErrors.length).toBe(0);
  });

  test('Runtime observation: captured console messages and page errors conform to expectations', async ({ page }) => {
    // This test is focused on observing runtime diagnostics:
    // - We capture console messages and page errors that occurred during page load
    // - If there are errors, they should be Error objects
    // - We assert there are no console.error entries for this healthy app, but if present, we validate structure

    // Click the button once to exercise the interactive code paths
    await page.locator('#demoButton').click();
    await page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      return el && el.innerText.trim().length > 0;
    }, null, { timeout: 2000 });

    // Validate that any captured pageErrors are instances of Error
    // If there are none, the check below will pass (Array.prototype.every returns true for empty arrays)
    expect(pageErrors.every(e => e instanceof Error)).toBeTruthy();

    // Validate console message structure
    expect(consoleMessages.every(m => typeof m.type === 'string' && typeof m.text === 'string')).toBeTruthy();

    // In a correctly functioning page, no console.error messages are expected.
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });
});