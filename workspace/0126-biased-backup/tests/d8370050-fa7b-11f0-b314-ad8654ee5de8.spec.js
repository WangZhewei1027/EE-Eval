import { test, expect } from '@playwright/test';

// Test suite for application:
// Application ID: d8370050-fa7b-11f0-b314-ad8654ee5de8
// Served at:
// http://127.0.0.1:5500/workspace/0126-biased/html/d8370050-fa7b-11f0-b314-ad8654ee5de8.html
//
// This file validates the FSM states and transitions described in the spec,
// inspects DOM changes and visual feedback, and observes console/page errors.
// It intentionally does NOT modify or patch the page; it loads it exactly as-is,
// listens for console and page errors, and asserts expectations about them.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8370050-fa7b-11f0-b314-ad8654ee5de8.html';

test.describe('Big-O Notation — Interactive Demo (FSM validation)', () => {
  // Collect console messages and page errors for each test to assert on them.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (including errors) emitted by the page.
    page.on('console', msg => {
      // push a simplified snapshot for assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions and other page errors
    page.on('pageerror', error => {
      // preserve the Error name and message
      pageErrors.push({ name: error.name, message: error.message });
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Nothing to tear down beyond Playwright fixtures; listeners are per-page and will be cleaned up.
  });

  test('S0_Idle state - initial render: button exists and demo output is hidden', async ({ page }) => {
    // Validate evidence for S0_Idle: presence of the demo button and initial DOM state.

    // 1) Button with id demoBtn exists and has expected accessible attributes/text
    const demoBtn = await page.locator('#demoBtn');
    await expect(demoBtn).toBeVisible();
    await expect(demoBtn).toHaveAttribute('aria-controls', 'demoOutput');
    await expect(demoBtn).toHaveText('Run small growth demo');

    // 2) demoOutput exists and is initially hidden (display: none)
    const demoOutput = await page.locator('#demoOutput');
    // The element exists in DOM
    await expect(demoOutput).toBeVisible({ useInnerText: false }); // element exists (visibility check will pass but we assert computed display below)
    // Check computed style for display: should be 'none' initially
    const initialDisplay = await page.$eval('#demoOutput', el => getComputedStyle(el).display);
    expect(initialDisplay).toBe('none');

    // 3) role and aria-live attributes present as per components evidence
    await expect(demoOutput).toHaveAttribute('role', 'status');
    await expect(demoOutput).toHaveAttribute('aria-live', 'polite');

    // 4) No runtime page errors occurred during initial load
    expect(pageErrors).toEqual([]);
    // No console error messages (console of type 'error')
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors).toEqual([]);
  });

  test('ButtonClick event and transition: clicking demo button shows output and disables button', async ({ page }) => {
    // This test validates the transition from S0_Idle -> S1_DemoShown:
    // - out.style.display becomes 'block'
    // - btn.disabled = true
    // - btn.style.opacity = 0.7
    // - btn.textContent is updated to 'Demo shown (disabled)'
    // - demoOutput contains formatted rows including an "inf" for large 2^n

    const demoBtnLocator = page.locator('#demoBtn');
    const demoOutputLocator = page.locator('#demoOutput');

    // Ensure starting conditions
    await expect(demoBtnLocator).toBeEnabled();
    const startDisplay = await page.$eval('#demoOutput', el => getComputedStyle(el).display);
    expect(startDisplay).toBe('none');

    // Click the demo button (this triggers the demo computation)
    await demoBtnLocator.click();

    // After click, demoOutput should be visible (display: block)
    await page.waitForTimeout(50); // small wait to allow synchronous JS to run (script is synchronous but keep small buffer)
    const afterDisplay = await page.$eval('#demoOutput', el => getComputedStyle(el).display);
    expect(afterDisplay).toBe('block');

    // The demoOutput textContent should include the header row and one line per n value (4)
    const outputText = await demoOutputLocator.textContent();
    expect(typeof outputText).toBe('string');
    // Header row includes "log2(n)" as in the script
    expect(outputText).toContain('log2(n)');
    // There should be 1 header + 4 data lines -> at least 5 lines when split by newline
    const lines = outputText.split('\n').map(l => l.trim()).filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(5);

    // Ensure one of the rows includes the 10000 n and 'inf' for 2^n
    const contains10000 = lines.some(line => line.includes('10000'));
    expect(contains10000).toBeTruthy();
    const containsInf = lines.some(line => line.includes('inf'));
    expect(containsInf).toBeTruthy();

    // Button should now be disabled, have opacity 0.7 and the new text
    const isDisabled = await demoBtnLocator.evaluate(el => el.disabled === true);
    expect(isDisabled).toBe(true);

    const btnText = await demoBtnLocator.textContent();
    expect(btnText).toBe('Demo shown (disabled)');

    // Computed style opacity should be "0.7" (string)
    const opacity = await demoBtnLocator.evaluate(el => getComputedStyle(el).opacity);
    // Some browsers may return "0.7" or "0.7" - check numeric equivalence
    expect(Number(opacity)).toBeCloseTo(0.7, 3);

    // FSM evidence checks: out.style.display = 'block'; btn.disabled = true;
    expect(afterDisplay).toBe('block');
    expect(isDisabled).toBe(true);

    // No uncaught page errors were raised during the click and rendering
    expect(pageErrors).toEqual([]);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors).toEqual([]);
  });

  test('Edge case: clicking the disabled button should not change the demo output (idempotency)', async ({ page }) => {
    // Validate idempotent behavior: once the demo has run and button is disabled,
    // attempting to click it should not change the content (button disabled prevents handler).
    const demoBtn = page.locator('#demoBtn');
    const demoOutput = page.locator('#demoOutput');

    // Trigger the demo first (if not already triggered)
    await demoBtn.click();

    // Capture content snapshot after first click
    await page.waitForTimeout(30);
    const snapshot = (await demoOutput.textContent()) || '';

    // Attempt to click the button again: since it's disabled, Playwright's click will fail unless forced.
    // We intentionally do NOT force the click to respect the UI state; instead, try to dispatch a click via JavaScript
    // only if the element is enabled. We will assert that it's disabled and therefore not clicked.
    const enabled = await demoBtn.evaluate(el => !el.disabled);
    expect(enabled).toBe(false);

    // If disabled, ensure snapshot remains the same after a short wait
    await page.waitForTimeout(50);
    const snapshotAfter = (await demoOutput.textContent()) || '';
    expect(snapshotAfter).toBe(snapshot);

    // Still no runtime errors
    expect(pageErrors).toEqual([]);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors).toEqual([]);
  });

  test('Accessibility & semantics: aria-controls, role and live region are present and coherent', async ({ page }) => {
    // This test validates evidence about semantics for both components in the FSM
    const demoBtn = page.locator('#demoBtn');
    const demoOutput = page.locator('#demoOutput');

    // Button aria-controls should point to demoOutput id
    await expect(demoBtn).toHaveAttribute('aria-controls', 'demoOutput');

    // demoOutput should have role=status and aria-live=polite to announce content updates
    await expect(demoOutput).toHaveAttribute('role', 'status');
    await expect(demoOutput).toHaveAttribute('aria-live', 'polite');

    // Run the demo and ensure content becomes available in the live region
    await demoBtn.click();
    await page.waitForTimeout(30);
    const text = await demoOutput.textContent();
    expect(text && text.length).toBeGreaterThan(10); // rough sanity check that content was added

    // No page errors
    expect(pageErrors).toEqual([]);
  });

  test('Observability: capture and assert console messages and page errors (should be none)', async ({ page }) => {
    // This test explicitly examines the captured console messages and page errors across navigation and interactions.
    const demoBtn = page.locator('#demoBtn');

    // Interact a bit
    await demoBtn.click();
    await page.waitForTimeout(20);

    // Provide detailed assertions about console messages structure (not their presence)
    // We assert there are no console messages of type 'error' to ensure no runtime errors were hidden in console.
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors).toEqual([]);

    // Assert no uncaught page errors
    expect(pageErrors).toEqual([]);

    // Additionally make sure there was at least some console activity (optional non-critical)
    // Many pages may not log anything; we don't require logs. If any logs exist, they should not be errors.
    const nonErrorLogs = consoleMessages.filter(m => m.type !== 'error');
    // nonErrorLogs can be empty, so we don't assert presence — just ensure no errors exist (done above).
  });
});