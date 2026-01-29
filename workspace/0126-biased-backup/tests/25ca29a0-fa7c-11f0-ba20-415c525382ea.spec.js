import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25ca29a0-fa7c-11f0-ba20-415c525382ea.html';

// Expected demo output when searching for 70 in [10, 23, 45, 70, 11, 15]
// This string mirrors the exact text concatenations found in the page script.
const expectedDemoOutput =
  'Array: [10, 23, 45, 70, 11, 15]\n' +
  'Target to find: 70\n\n' +
  'Step-by-step Linear Search process:\n\n' +
  'Checking index 0: value = 10\n' +
  'Checking index 1: value = 23\n' +
  'Checking index 2: value = 45\n' +
  'Checking index 3: value = 70\n' +
  '\n' +
  'Target found at index 3!\n';

test.describe('Understanding Linear Search demo (FSM: Idle -> DemoRunning)', () => {
  // Collect console messages and page errors for assertions in tests.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Attach listeners before navigation so we capture any load/runtime errors.
    page.on('console', (msg) => {
      // Capture type and text for detailed assertions.
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Capture uncaught exceptions from the page.
      pageErrors.push(err);
    });

    // Load the page exactly as-is (do not modify or patch).
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // No DOM patching or global modifications; just ensure arrays are reset for next test.
    consoleMessages = [];
    pageErrors = [];
  });

  test('Initial Idle state: page rendered with expected components', async ({ page }) => {
    // This test validates the S0_Idle FSM state:
    // - The Run Linear Search Demo button exists and is visible.
    // - The demoArea pre element exists, is empty, and has the expected ARIA attributes.

    const runBtn = page.locator('#runDemoBtn');
    await expect(runBtn).toBeVisible();
    await expect(runBtn).toHaveText('Run Linear Search Demo');

    const demoArea = page.locator('#demoArea');
    await expect(demoArea).toBeVisible();

    // The initial demoArea should be empty (Idle state's renderPage entry action).
    const initialText = await demoArea.textContent();
    expect(initialText).toBe('', 'demoArea should be empty when page initially loads (Idle state)');

    // Verify ARIA attributes exist as described in components.
    await expect(demoArea).toHaveAttribute('aria-live', 'polite');
    await expect(demoArea).toHaveAttribute('aria-atomic', 'true');

    // Assert no unexpected page errors occurred during initial rendering.
    expect(pageErrors.length).toBe(0);
    // Assert there are no console.error messages during load.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition: RunDemo click leads to DemoRunning state and displays step-by-step output', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_DemoRunning triggered by clicking #runDemoBtn.
    // It also checks the entry actions: clearing demoArea, initializing array, setting target,
    // and that the step-by-step output is shown and stops when the target is found.

    const runBtn = page.locator('#runDemoBtn');
    const demoArea = page.locator('#demoArea');

    // Double-check starting conditions.
    await expect(demoArea).toHaveText('');

    // Click the button to trigger the demo.
    await runBtn.click();

    // Read the content after the click.
    const content = await demoArea.textContent();

    // Verify the demo output exactly matches the expected demo run.
    expect(content).toBe(expectedDemoOutput);

    // Ensure that the output shows checking indices up to the found index (3),
    // and does not contain checks for indices after the found index (4 or 5).
    expect(content).toContain('Checking index 3: value = 70');
    expect(content).toContain('Target found at index 3!');
    expect(content).not.toContain('Checking index 4');
    expect(content).not.toContain('Checking index 5');

    // Confirm there were no runtime exceptions during the demo run.
    expect(pageErrors.length).toBe(0, `Expected no uncaught page errors, but found: ${pageErrors.map(e => e.message).join('; ')}`);

    // Confirm no console.error messages were emitted during the interaction.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0, `Console errors found: ${consoleErrors.map(e => e.text).join('; ')}`);
  });

  test('Clicking demo clears previous content first (clearDemoOutput on entry)', async ({ page }) => {
    // This test simulates an existing/demo stale output scenario and verifies that
    // the demo's entry action clears previous output before generating new output.

    const runBtn = page.locator('#runDemoBtn');
    const demoArea = page.locator('#demoArea');

    // Manually set stale content inside demoArea to simulate existing content.
    await page.evaluate(() => {
      const demo = document.getElementById('demoArea');
      if (demo) demo.textContent = 'STALE CONTENT - should be cleared';
    });

    // Ensure stale content is present prior to click.
    const preClickText = await demoArea.textContent();
    expect(preClickText).toContain('STALE CONTENT');

    // Click to trigger demo; the handler should clear the content first.
    await runBtn.click();

    const postClickText = await demoArea.textContent();

    // The stale content must not be present after click, and the content should exactly match the expected run.
    expect(postClickText).not.toContain('STALE CONTENT');
    expect(postClickText).toBe(expectedDemoOutput);
  });

  test('Multiple rapid clicks do not produce duplicated appended output (demo clears output each run)', async ({ page }) => {
    // This test validates behavior when the user clicks the Run Demo button repeatedly in quick succession.
    // The implementation clears demoArea at the start of the handler, so the final content should be a single run's output.

    const runBtn = page.locator('#runDemoBtn');
    const demoArea = page.locator('#demoArea');

    // Perform two rapid clicks without awaiting intermediate UI changes.
    // Because handler runs synchronously, second click will re-run handler and final content should equal single run output.
    await runBtn.click();
    await runBtn.click();

    // Wait a tick to ensure handler(s) have run; use a small wait to allow DOM text updates.
    await page.waitForTimeout(50);

    const finalContent = await demoArea.textContent();

    // The content should exactly match a single run (not an appended double run).
    expect(finalContent).toBe(expectedDemoOutput);

    // Also assert no errors occurred during the rapid sequence.
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Observes console logs and page errors across interactions (no unexpected exceptions)', async ({ page }) => {
    // This test explicitly collects console messages and page errors during a sequence of interactions,
    // then asserts that the page did not emit errors (ensuring stable runtime behavior).

    const runBtn = page.locator('#runDemoBtn');

    // Clear any previously captured messages from beforeEach.
    // (They are already collected in consoleMessages/pageErrors arrays.)

    // Trigger a demo run.
    await runBtn.click();

    // Trigger a second run to exercise repeated behavior.
    await runBtn.click();

    // Allow events to flush.
    await page.waitForTimeout(20);

    // Assert there were no uncaught page errors (ReferenceError, TypeError, SyntaxError, etc.)
    expect(pageErrors.length).toBe(0, `Expected 0 page errors but found ${pageErrors.length}. Errors: ${pageErrors.map(e => e.message).join('; ')}`);

    // Assert console did not emit any messages of type 'error'.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0, `Console errors were emitted: ${consoleErrors.map(e => e.text).join('; ')}`);

    // For transparency, also assert we observed some console or at least non-error messages (optional),
    // but do not fail if none exist. This keeps focus on absence of errors.
    const nonErrorMessages = consoleMessages.filter(m => m.type !== 'error');
    // If desired, we could inspect them: e.g., console.log calls from the page; but the page does not log by default.
    // We simply ensure the test captured console messages without errors.
    expect(Array.isArray(nonErrorMessages)).toBe(true);
  });
});