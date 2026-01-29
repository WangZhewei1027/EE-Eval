import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cd36e0-fa7c-11f0-ba20-415c525382ea.html';

test.describe('25cd36e0-fa7c-11f0-ba20-415c525382ea - Unit Testing Demo FSM', () => {
  // Shared variables for capturing console and page errors per test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset collectors before each test
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for later assertions and debugging
    page.on('console', (msg) => {
      try {
        // Normalize message text and type
        consoleMessages.push({
          type: msg.type(),
          text: msg.text()
        });
      } catch (e) {
        consoleMessages.push({
          type: 'unknown',
          text: String(msg)
        });
      }
    });

    // Capture uncaught page errors (e.g., ReferenceError, TypeError, SyntaxError)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // nothing special to teardown beyond Playwright default,
    // but ensure our collectors are cleared between tests
    consoleMessages = [];
    pageErrors = [];
  });

  test('S0_Idle: initial render shows Run Simple Unit Tests button and empty demoOutput', async ({ page }) => {
    // Validate the Idle state's entry evidence: button exists and demoOutput exists and is empty
    // This test corresponds to FSM state S0_Idle and its entry_actions (renderPage())
    const runButton = await page.locator('#runDemo');
    await expect(runButton).toHaveCount(1);
    await expect(runButton).toBeVisible();
    await expect(runButton).toHaveText('Run Simple Unit Tests');

    const demoOutput = await page.locator('#demoOutput');
    await expect(demoOutput).toHaveCount(1);
    await expect(demoOutput).toBeVisible();
    // Initially the demoOutput should be empty ('' or only whitespace)
    await expect((await demoOutput.textContent())?.trim() ?? '').toBe('');

    // Verify the aria-live attribute as part of evidence of component
    await expect(demoOutput).toHaveAttribute('aria-live', 'polite');

    // Assert that no unexpected page errors were emitted during initial render
    // (we capture errors passively; we don't inject or cause any)
    expect(pageErrors.length).toBe(0);
  });

  test('RunDemoClick transition: clicking the button enters Testing state and shows running text then results', async ({ page }) => {
    // This test validates the event RunDemoClick, transition from S0_Idle -> S1_Testing,
    // and the entry action runTests() that is invoked (via setTimeout in the page).
    const runButton = page.locator('#runDemo');
    const demoOutput = page.locator('#demoOutput');

    // Click the button to trigger the demo
    await runButton.click();

    // Immediately after click the page should show 'Running tests...' (synchronous set)
    await expect(demoOutput).toHaveText('Running tests...\n', { timeout: 200 });

    // After the internal 300ms setTimeout, the demoOutput is replaced with the test runner output.
    // Allow a bit more time than 300ms to account for scheduling.
    await expect(demoOutput).toHaveText(/^\(PASS\) add\(2,3\) = 5/m, { timeout: 1000 });

    // Retrieve the final output and assert it contains all expected test result lines
    const finalText = await demoOutput.textContent() ?? '';
    // Check a few canonical expected lines from runTests()
    expect(finalText).toContain('(PASS) add(2,3) = 5');
    expect(finalText).toContain('(PASS) multiply(4,0) = 0');
    expect(finalText).toContain('(PASS) subtract(10,7) = 3');
    expect(finalText).toContain('(PASS) add(-1,1) = 0');

    // Confirm that no page errors (uncaught exceptions) occurred during this transition
    expect(pageErrors.length).toBe(0);

    // Also verify no console messages show ReferenceError/SyntaxError/TypeError strings
    const errorLikeConsole = consoleMessages.filter(m =>
      /ReferenceError|SyntaxError|TypeError|Uncaught|Error/i.test(m.text)
    );
    expect(errorLikeConsole.length).toBe(0);
  });

  test('Edge case: clicking the Run Demo button multiple times quickly produces deterministic final output', async ({ page }) => {
    // This test explores an edge case: multiple rapid clicks.
    // The page code doesn't prevent multiple clicks; each click sets Running tests... and schedules a setTimeout.
    // We assert that the final visible output resolves to the expected test results string (deterministic).
    const runButton = page.locator('#runDemo');
    const demoOutput = page.locator('#demoOutput');

    // Rapidly click the button multiple times
    await runButton.click();
    await runButton.click();
    await runButton.click();

    // After the rapid clicks the DOM should show the immediate running text (the last click sets it again)
    await expect(demoOutput).toHaveText('Running tests...\n', { timeout: 200 });

    // Wait for the scheduled runTests to complete (give generous timeout)
    await expect(demoOutput).toHaveText(/^\(PASS\) add\(2,3\) = 5/m, { timeout: 1500 });

    const finalText = (await demoOutput.textContent()) ?? '';
    // The demo's runTests() returns the same results each time; final content should contain all pass lines
    expect(finalText.split('\n').filter(Boolean).length).toBeGreaterThanOrEqual(4);
    expect(finalText).toContain('(PASS) add(2,3) = 5');
    expect(finalText).toContain('(PASS) multiply(4,0) = 0');

    // No uncaught errors should have happened as a result of multiple clicks
    expect(pageErrors.length).toBe(0);
  });

  test('Behavioral check: runTests function output shape and content without clicking (direct invocation via UI is required) - ensure UI-only activation', async ({ page }) => {
    // The FSM describes runTests() as being called on button click.
    // Verify that before any click, the demoOutput does not contain results (i.e., runTests not invoked on load).
    const demoOutput = page.locator('#demoOutput');
    await expect((await demoOutput.textContent())?.trim() ?? '').toBe('');

    // No results present before click
    expect((await demoOutput.textContent())?.includes('(PASS)') || false).toBe(false);

    // Also ensure the Run Demo button is the only trigger as per FSM evidence: only #runDemo was wired.
    // We search for other elements that might cause automatic test runs (none expected).
    const scriptTags = await page.locator('script').all();
    // at least one inline script exists; we assert it does not auto-run runTests on load by checking the UI remains empty
    expect((await demoOutput.textContent())?.trim() ?? '').toBe('');
  });

  test('Observability: capture and assert console and page error behavior (passive observation)', async ({ page }) => {
    // This test explicitly documents observability: we passively collect console and page errors.
    // We do not inject code or alter runtime; we assert actual captured data (which for this page should show no uncaught errors).
    const runButton = page.locator('#runDemo');
    const demoOutput = page.locator('#demoOutput');

    // Click to produce console activity (if any) and potential errors
    await runButton.click();

    // Wait for final output to settle
    await expect(demoOutput).toHaveText(/^\(PASS\) add\(2,3\) = 5/m, { timeout: 1000 });

    // At this point check captured console messages for any error-like output
    const hasReferenceError = consoleMessages.some(m => /ReferenceError/.test(m.text));
    const hasSyntaxError = consoleMessages.some(m => /SyntaxError/.test(m.text));
    const hasTypeError = consoleMessages.some(m => /TypeError/.test(m.text));

    // The page implementation is valid JS; expect none of these errors to be present.
    expect(hasReferenceError).toBe(false);
    expect(hasSyntaxError).toBe(false);
    expect(hasTypeError).toBe(false);

    // Also check the pageerror list for any uncaught exceptions; expect none.
    expect(pageErrors.length).toBe(0);
  });

  test('Accessibility and visual checks: ensure demoOutput styling and is present in DOM flow', async ({ page }) => {
    // Validate that demoOutput has the expected styling hooks/attributes that are part of evidence
    const demoOutput = page.locator('#demoOutput');

    // aria-live already tested above, but repeat here for clarity
    await expect(demoOutput).toHaveAttribute('aria-live', 'polite');

    // The demoOutput should have non-zero bounding box (visible area)
    const box = await demoOutput.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThan(0);
      expect(box.height).toBeGreaterThanOrEqual(0); // may be min-height: 3rem in CSS resulting in >0
    }

    // Ensure clicking still works visually
    await page.locator('#runDemo').click();
    await expect(demoOutput).toHaveText('Running tests...\n', { timeout: 200 });
  });
});