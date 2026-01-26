import { test, expect } from '@playwright/test';

test.setTimeout(60000); // Allow enough time for the 15s demo to finish in some tests

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cbfe62-fa7c-11f0-ba20-415c525382ea.html';

test.describe('Semaphore Demo FSM (app: 25cbfe62-fa7c-11f0-ba20-415c525382ea)', () => {
  // Containers for observed console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset observers
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors so tests can assert on them
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Load the page exactly as-is (do NOT modify or patch the page)
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // No special teardown beyond Playwright's built-in cleanup
  });

  test('Initial Idle State: page renders Start button and log area (S0_Idle)', async ({ page }) => {
    // This test validates the initial/idle FSM state S0_Idle:
    // - The Start Semaphore Demo button is present and enabled.
    // - The log output element is present with expected ARIA attributes.
    // - The button has an onclick handler attached (evidence: btn.onclick = startDemo).
    const startBtn = page.locator('#startDemoBtn');
    const logOutput = page.locator('#logOutput');

    // Button is visible and enabled on initial render (Idle state)
    await expect(startBtn).toBeVisible();
    await expect(startBtn).toBeEnabled();

    // Log area exists and has aria attributes as per FSM/component evidence
    await expect(logOutput).toBeVisible();
    const ariaLive = await logOutput.getAttribute('aria-live');
    const ariaLabel = await logOutput.getAttribute('aria-label');
    expect(ariaLive).toBe('polite');
    expect(ariaLabel).toBe('Semaphore demo log');

    // The script is expected to assign an onclick handler: typeof onclick === 'function'
    const onclickType = await page.evaluate(() => {
      const btn = document.getElementById('startDemoBtn');
      return typeof btn.onclick;
    });
    expect(onclickType).toBe('function');

    // No page errors should have occurred simply loading the page
    expect(pageErrors.length).toBe(0);
  });

  test('StartDemo event transitions to Demo Running (S1_DemoRunning) and logs initialization', async ({ page }) => {
    // This test validates the StartDemo event and the transition S0_Idle -> S1_DemoRunning:
    // - Clicking the Start button triggers the startDemo function.
    // - The button is disabled at the start of the demo (onEnter action: startDemo sets btn.disabled = true).
    // - The log contains the initialization message as evidence (expected_observables).
    const startBtn = page.locator('#startDemoBtn');
    const logOutput = page.locator('#logOutput');

    // Click the button to start demo
    await startBtn.click();

    // The startDemo function sets btn.disabled = true synchronously at entry
    await expect(startBtn).toBeDisabled();

    // Wait for the initialization log message to appear
    await page.waitForFunction(() => {
      const log = document.getElementById('logOutput');
      return log && log.textContent.includes('Semaphore initialized with 3 slots.');
    }, null, { timeout: 5000 });

    // The log must include the initialization message
    const logText = await logOutput.textContent();
    expect(logText).toContain('Semaphore initialized with 3 slots.');

    // Within a short time window, at least three "acquired a slot" messages should appear
    // (three resources available initially)
    await page.waitForFunction(() => {
      const txt = document.getElementById('logOutput').textContent || '';
      const matches = txt.match(/acquired a slot/g) || [];
      return matches.length >= 3;
    }, null, { timeout: 7000 });

    // Also expect that some threads may report "is waiting (no slots available)" as later threads arrive
    // (this verifies semaphore queueing behaviour)
    await page.waitForFunction(() => {
      const txt = document.getElementById('logOutput').textContent || '';
      return txt.includes('is waiting (no slots available)');
    }, null, { timeout: 7000 });

    // Check that there were no page-level errors while starting the demo
    expect(pageErrors.length).toBe(0);
  });

  test('DemoFinished transition: demo completes and onExit action re-enables button', async ({ page }) => {
    // This test validates the S1_DemoRunning -> S0_Idle transition (DemoFinished):
    // - After the ~15s demo finishes, the log contains "Demo finished."
    // - The button is re-enabled (exit action: btn.disabled = false).
    const startBtn = page.locator('#startDemoBtn');
    const logOutput = page.locator('#logOutput');

    // Start the demo
    await startBtn.click();
    await expect(startBtn).toBeDisabled();

    // Wait for the final "Demo finished." message from the page's setTimeout
    // The page uses setTimeout(..., 15000) to re-enable the button and log 'Demo finished.'
    await page.waitForFunction(() => {
      const log = document.getElementById('logOutput');
      return log && log.textContent.includes('Demo finished.');
    }, null, { timeout: 30000 }); // generous timeout to account for the 15s timer and scheduling

    // Verify the final message is present
    const finalLog = await logOutput.textContent();
    expect(finalLog).toContain('Demo finished.');

    // The button should now be enabled (exit action executed)
    await expect(startBtn).toBeEnabled();

    // Confirm no page errors occurred during the entire demo run
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: attempting to start demo again while running should not create duplicate initialization', async ({ page }) => {
    // This test attempts to trigger a second demo run while the first is running:
    // - We click the Start button once to begin. After it becomes disabled, we attempt another click.
    // - The application is expected to prevent a second concurrent run (btn.disabled prevents handler).
    // - We assert that only one initialization message appears.
    const startBtn = page.locator('#startDemoBtn');
    const logOutput = page.locator('#logOutput');

    // Start the demo
    await startBtn.click();

    // Wait until button is disabled (startDemo sets this synchronously)
    await expect(startBtn).toBeDisabled();

    // Attempt to click again while disabled. Playwright may still send the click,
    // but the DOM-level disabled attribute should prevent handler execution.
    let attemptedClickError = null;
    try {
      await page.click('#startDemoBtn', { timeout: 1000 });
    } catch (err) {
      // Some browsers / versions may refuse to click disabled elements and Playwright will throw.
      // We capture this but do not fail the test because the important assertion is on the log.
      attemptedClickError = err;
    }

    // Give the page a short moment to react if a second click erroneously triggered a handler
    await page.waitForTimeout(1200);

    // Count how many times the initialization message appears in the log
    const initCount = await page.evaluate(() => {
      const txt = document.getElementById('logOutput').textContent || '';
      return (txt.match(/Semaphore initialized with 3 slots\./g) || []).length;
    });

    // We expect exactly one initialization message (no duplicate runs started)
    expect(initCount).toBe(1);

    // Ensure no fatal page errors occurred
    expect(pageErrors.length).toBe(0);

    // It's acceptable that Playwright may have thrown when attempting to click a disabled element;
    // ensure that such an attempt did not cause application-level errors
    if (attemptedClickError) {
      // the error is from Playwright attempting to click a disabled element — confirm it's not a page error
      expect(pageErrors.length).toBe(0);
    }
  });

  test('Observability: console and pageerrors are empty during demo run (no unexpected runtime exceptions)', async ({ page }) => {
    // This test observes console messages and page errors while running the demo:
    // - It starts the demo and waits a short while.
    // - Then asserts that no uncaught JS errors were reported (pageerror) and no console 'error' messages.
    const startBtn = page.locator('#startDemoBtn');

    // Start the demo
    await startBtn.click();

    // Wait a modest time for activity to take place
    await page.waitForTimeout(3000);

    // Filter collected console messages for errors (console.error)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');

    // The implementation is expected to run without throwing uncaught exceptions or logging errors.
    // Assert we did not observe page-level errors nor console.error messages.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});