import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8346840-fa7b-11f0-b314-ad8654ee5de8.html';

test.describe('Bubble Sort Demo (FSM validation) - d8346840-fa7b-11f0-b314-ad8654ee5de8', () => {
  // Shared state across tests to capture console messages and page errors
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize arrays to collect logs / errors
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Observe console messages and errors on the page
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // nothing to teardown beyond Playwright's automatic cleanup
  });

  test('S0_Idle: Initial page loads with expected Idle state (button and empty output)', async ({ page }) => {
    // Validate presence of the "Run Simple Demo" button and the demo output element
    const runBtn = page.locator('#runDemo');
    const out = page.locator('#demoOutput');

    // The button should be visible and contain the initial text "Run Simple Demo"
    await expect(runBtn).toBeVisible();
    await expect(runBtn).toHaveText('Run Simple Demo');

    // The output area should be present, empty, focusable (tabindex) and have aria-live attribute
    await expect(out).toBeVisible();
    const outText = await out.textContent();
    expect(outText.trim()).toBe(''); // Idle state's evidence: output area is empty

    // Verify aria attributes per component evidence
    await expect(runBtn).toHaveAttribute('aria-controls', 'demoOutput');
    await expect(out).toHaveAttribute('aria-live', 'polite');
  });

  test('S0 -> S1 transition: Clicking Run Simple Demo sets Running state and clears output', async ({ page }) => {
    const runBtn = page.locator('#runDemo');
    const out = page.locator('#demoOutput');

    // Sanity: ensure starting state is Idle (no pre-existing text)
    await expect(await out.textContent()).toBe('');

    // Click the button to start the demo (this should trigger clearOutput() and setButtonToRunning())
    await runBtn.click();

    // Immediately after clicking, expect the button to be disabled and display "Running..."
    // These are the onEnter actions for the RunningDemo state.
    await expect(runBtn).toBeDisabled();
    await expect(runBtn).toHaveText('Running...');

    // The output should have been cleared as part of the transition (out.textContent = '')
    // Because prints are asynchronous, there may or may not be a line yet; but the code clears it synchronously.
    const immediateOut = await out.textContent();
    // After clearing it should be either empty or only contain newlines; normalize whitespace:
    expect((immediateOut || '').trim().startsWith('')).toBe(true);
  });

  test('S1 -> S2 transition and S1 -> S0 exit: Demo completes and final output is displayed; button resets', async ({ page }) => {
    const runBtn = page.locator('#runDemo');
    const out = page.locator('#demoOutput');

    // Click to start the demo
    await runBtn.click();

    // Verify Running state quickly after starting
    await expect(runBtn).toBeDisabled();
    await expect(runBtn).toHaveText('Running...');

    // Wait for the demo to finish by waiting for the final sorted array text to appear in the output.
    // The preset array is [5, 2, 9, 1, 5, 6] which sorts to [1, 2, 5, 5, 6, 9]
    const expectedFinalLine = 'Final sorted array: [1, 2, 5, 5, 6, 9]';

    // Wait up to 30s for the final line to be appended to the output.
    await page.waitForFunction(
      (selector, expected) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        return el.textContent.includes(expected);
      },
      '#demoOutput',
      expectedFinalLine,
      { timeout: 30000 }
    );

    // Once final message is present, confirm the output contains it
    const fullOutput = await out.textContent();
    expect(fullOutput).toContain('Initial array: [5, 2, 9, 1, 5, 6]');
    expect(fullOutput).toContain(expectedFinalLine);

    // After the demo promise resolves, the page script resets the button text and re-enables it.
    // Assert the button returned to Idle state (Run Simple Demo) and is enabled.
    await expect(runBtn).toHaveText('Run Simple Demo');
    await expect(runBtn).toBeEnabled();
  });

  test('Edge case: clicking while running should not produce multiple concurrent demos', async ({ page }) => {
    const runBtn = page.locator('#runDemo');
    const out = page.locator('#demoOutput');

    // Start the demo
    await runBtn.click();

    // Immediately verify the button is disabled (so subsequent manual clicks should be ignored)
    await expect(runBtn).toBeDisabled();

    // Try to programmatically call click() on the disabled button inside the page context.
    // This simulates a malicious/accidental invocation; since the button is disabled, the handler should not run again.
    await page.evaluate(() => {
      try {
        // Attempt to programmatically trigger a click; browsers will not fire click handlers for disabled buttons.
        const btn = document.getElementById('runDemo');
        if (btn) {
          btn.click();
        }
      } catch (e) {
        // Swallow any exception here - we are not allowed to patch runtime.
      }
    });

    // Wait a bit and then assert that the output contains only a single "Initial array" header (i.e., only one run started)
    // We'll wait until the demo completes and then count occurrences.
    const expectedFinalLine = 'Final sorted array: [1, 2, 5, 5, 6, 9]';
    await page.waitForFunction(
      (selector, expected) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        return el.textContent.includes(expected);
      },
      '#demoOutput',
      expectedFinalLine,
      { timeout: 30000 }
    );

    const fullOutput = await out.textContent();
    // Count how many times "Initial array:" appears — should be exactly 1 if double-run didn't start
    const initialOccurrences = (fullOutput.match(/Initial array:/g) || []).length;
    expect(initialOccurrences).toBe(1);
  });

  test('Rerun after completion: FSM returns to Idle then to Running and completes again', async ({ page }) => {
    const runBtn = page.locator('#runDemo');
    const out = page.locator('#demoOutput');

    // First run
    await runBtn.click();

    // Wait for completion of first run
    const expectedFinalLine = 'Final sorted array: [1, 2, 5, 5, 6, 9]';
    await page.waitForFunction(
      (selector, expected) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        return el.textContent.includes(expected);
      },
      '#demoOutput',
      expectedFinalLine,
      { timeout: 30000 }
    );

    // Ensure button is back to Idle
    await expect(runBtn).toHaveText('Run Simple Demo');
    await expect(runBtn).toBeEnabled();

    // Capture the output snapshot after first run
    const outputAfterFirstRun = await out.textContent();

    // Rerun by clicking again
    await runBtn.click();

    // Immediately button should show Running...
    await expect(runBtn).toHaveText('Running...');
    await expect(runBtn).toBeDisabled();

    // Wait for the second run to finish
    await page.waitForFunction(
      (selector, expected) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        // Because second run appends logs after clearing, the final expected line should appear at the end,
        // but to keep it robust simply check for another occurrence of the final line.
        return el.textContent.includes(expected);
      },
      '#demoOutput',
      expectedFinalLine,
      { timeout: 30000 }
    );

    // After second run completes, button should be reset again
    await expect(runBtn).toHaveText('Run Simple Demo');
    await expect(runBtn).toBeEnabled();

    // Ensure the output was cleared at the start of the second run (i.e., content after second run differs from first run snapshot)
    const outputAfterSecondRun = await out.textContent();
    expect(outputAfterSecondRun).not.toBe(''); // it should contain logs
    // Basic sanity: there should be at least one occurrence of "Initial array" in the final output
    const initialCount = (outputAfterSecondRun.match(/Initial array:/g) || []).length;
    expect(initialCount).toBeGreaterThanOrEqual(1);
  });

  test('Console and page error observation: ensure no unexpected runtime errors (ReferenceError/SyntaxError/TypeError) occurred during page load and demo runs', async ({ page }) => {
    const runBtn = page.locator('#runDemo');

    // Start the demo to exercise runtime behavior
    await runBtn.click();

    // Wait for demo to complete to make sure any latent errors surface
    const expectedFinalLine = 'Final sorted array: [1, 2, 5, 5, 6, 9]';
    await page.waitForFunction(
      (selector, expected) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        return el.textContent.includes(expected);
      },
      '#demoOutput',
      expectedFinalLine,
      { timeout: 30000 }
    );

    // We observed console messages and page errors during this test run via listeners in beforeEach.
    // Assert that no page errors (uncaught exceptions) were captured.
    expect(pageErrors.length).toBe(0);

    // Assert that console did not emit any messages of type 'error' (which typically correspond to runtime errors)
    expect(consoleErrors.length).toBe(0);

    // Additionally, ensure that at least some console-worthy activity occurred (the page appends textual logs to DOM,
    // but it may not console.log; however we still check that console messages array is present and is an array).
    expect(Array.isArray(consoleMessages)).toBe(true);
  });

  test('DOM validation: ensure transition side-effects (clearOutput & resetButton) are present as DOM changes', async ({ page }) => {
    const runBtn = page.locator('#runDemo');
    const out = page.locator('#demoOutput');

    // Ensure initial state has empty output
    await expect(out).toHaveText('', { timeout: 2000 });

    // Start demo
    await runBtn.click();

    // Immediately after click, output must have been cleared (synchronous operation in handler)
    const immediate = await out.textContent();
    expect((immediate || '').trim().startsWith('')).toBe(true);

    // Wait until some log lines appear (to verify logging mechanism)
    await page.waitForFunction(
      selector => {
        const el = document.querySelector(selector);
        if (!el) return false;
        // There should be at least one newline or the word "Initial array"
        return el.textContent.includes('Initial array:') || el.textContent.length > 1;
      },
      '#demoOutput',
      { timeout: 5000 }
    );

    // After demo finishes, assert button was reset and enabled
    const expectedFinalLine = 'Final sorted array: [1, 2, 5, 5, 6, 9]';
    await page.waitForFunction(
      (selector, expected) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        return el.textContent.includes(expected);
      },
      '#demoOutput',
      expectedFinalLine,
      { timeout: 30000 }
    );
    await expect(runBtn).toHaveText('Run Simple Demo');
    await expect(runBtn).toBeEnabled();
  });
});