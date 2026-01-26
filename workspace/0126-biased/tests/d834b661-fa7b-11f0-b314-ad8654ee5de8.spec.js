import { test, expect } from '@playwright/test';

test.setTimeout(60000); // Allow enough time for long-running demo timeouts

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d834b661-fa7b-11f0-b314-ad8654ee5de8.html';

test.describe('Heap Sort demo — FSM and interactive validation (d834b661-fa7b-11f0-b314-ad8654ee5de8)', () => {
  // Shared collectors for console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Arrays to collect console and page errors; attach to page for assertion inside tests
    page.context()._consoleMessages = [];
    page.context()._pageErrors = [];

    page.on('console', (msg) => {
      // store type and text for assertions
      page.context()._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      page.context()._pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Navigate to the application page exactly as-is
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Basic sanity: capture any outstanding console/page errors in the test's logs (for debugging)
    // Tests below will assert on their expectations; we do no modifications here.
  });

  test('Initial Idle state (S0_Idle) - controls rendered and initial log text present', async ({ page }) => {
    // This validates S0_Idle: page renders .demo-controls, run button, and initial log content
    // Confirm demo-controls is visible and has aria-hidden="false"
    const demoControls = page.locator('.demo-controls');
    await expect(demoControls).toBeVisible();
    await expect(demoControls).toHaveAttribute('aria-hidden', 'false');

    // Confirm the Run Simple Demo button exists, visible, and has correct text
    const runBtn = page.locator('#runDemo');
    await expect(runBtn).toBeVisible();
    await expect(runBtn).toHaveText('Run Simple Demo');

    // Confirm the log element exists and contains the initial instruction text
    const log = page.locator('#log');
    await expect(log).toBeVisible();
    const initialText = await log.innerText();
    expect(initialText).toContain('Click "Run Simple Demo" to see a step log for A = [4, 10, 3, 5, 1].');

    // Assert that no page errors (ReferenceError/SyntaxError/TypeError) were observed immediately on load
    const pageErrors = page.context()._pageErrors;
    expect(Array.isArray(pageErrors)).toBeTruthy();
    expect(pageErrors.length).toBe(0);

    // Assert no console.error messages were emitted on load
    const consoleErrors = page.context()._consoleMessages.filter(m => m.type === 'error' || /ReferenceError|SyntaxError|TypeError/.test(m.text));
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition RunDemo (event) -> Demo Running (S1_DemoRunning): clicking #runDemo clears log and appends starting message', async ({ page }) => {
    // This test verifies the FSM transition from S0_Idle to S1_DemoRunning when the Run Demo button is clicked.
    const runBtn = page.locator('#runDemo');
    const log = page.locator('#log');

    // Precondition: confirm initial instruction present
    await expect(log).toContainText('Click "Run Simple Demo" to see a step log for A = [4, 10, 3, 5, 1].');

    // Click the Run Demo button to trigger the transition
    await runBtn.click();

    // Immediately after click, script calls clearLog() then append('Demo starting...')
    // Check that the initial instructional text is no longer present
    const afterClickText = await log.innerText();
    expect(afterClickText).not.toContain('Click "Run Simple Demo" to see a step log');

    // Confirm that the immediate "Demo starting: A = [4, 10, 3, 5, 1]" message is present
    await page.waitForFunction(
      () => {
        const el = document.getElementById('log');
        return el && el.innerText.includes('Demo starting: A = [4, 10, 3, 5, 1]');
      },
      null,
      { timeout: 2000 }
    );

    // Ensure that at this point there are no uncaught page errors (ReferenceError/SyntaxError/TypeError)
    const pageErrors = page.context()._pageErrors;
    expect(pageErrors.length).toBe(0);

    // Ensure console did not record errors indicating runtime exceptions
    const consoleErrors = page.context()._consoleMessages.filter(m => m.type === 'error' || /ReferenceError|SyntaxError|TypeError/.test(m.text));
    expect(consoleErrors.length).toBe(0);
  });

  test('DemoRunning (S1_DemoRunning) — asynchronous step messages appear as scheduled', async ({ page }) => {
    // This test validates that the demo schedules and appends the expected sequence of messages over time.
    // It confirms the presence of later messages which indicate the demo progressed through build-heap and extraction steps.
    const runBtn = page.locator('#runDemo');
    const log = page.locator('#log');

    // Start the demo
    await runBtn.click();

    // Wait for a mid-demo message indicating heapify step that occurs ~1500ms after click
    await page.waitForFunction(
      () => {
        const el = document.getElementById('log');
        return el && el.innerText.includes('Heapify index 0: children (1->10, 2->3). 10 is largest — swap index 0 and 1.');
      },
      null,
      { timeout: 5000 }
    );

    // Wait for the message that indicates the max-heap was built (~2600ms)
    await page.waitForFunction(
      () => {
        const el = document.getElementById('log');
        return el && el.innerText.includes('Array after heapify: [10, 5, 3, 4, 1] — max-heap built.');
      },
      null,
      { timeout: 7000 }
    );

    // Wait for an extraction phase message (~3600-4200ms)
    await page.waitForFunction(
      () => {
        const el = document.getElementById('log');
        return el && el.innerText.includes('Swap A[0]=10 with A[4]=1 → [1, 5, 3, 4, 10] (sorted suffix [10])');
      },
      null,
      { timeout: 9000 }
    );

    // Confirm final message indicating demo finished appears (~9000ms)
    await page.waitForFunction(
      () => {
        const el = document.getElementById('log');
        return el && el.innerText.includes('Demo finished. The log above records the main actions: build-heap and repeated extract+heapify.');
      },
      null,
      { timeout: 12000 }
    );

    // Final sanity assert: no page errors and no console errors indicating runtime exceptions during the demo
    const pageErrors = page.context()._pageErrors;
    expect(pageErrors.length).toBe(0);

    const consoleErrors = page.context()._consoleMessages.filter(m => m.type === 'error' || /ReferenceError|SyntaxError|TypeError/.test(m.text));
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: clicking Run Demo multiple times — log is cleared on each run start (S1 exit/enter behavior)', async ({ page }) => {
    // This test checks that invoking the Run Demo repeatedly triggers clearLog() (the S1 exit action for previous run
    // followed by entering S1 again), and that the immediate post-click state contains a fresh "Demo starting" entry.
    const runBtn = page.locator('#runDemo');
    const log = page.locator('#log');

    // Click once to start first run
    await runBtn.click();

    // Wait briefly for the immediate starting message to appear
    await page.waitForFunction(
      () => document.getElementById('log') && document.getElementById('log').innerText.includes('Demo starting: A = [4, 10, 3, 5, 1]'),
      null,
      { timeout: 1500 }
    );

    // Now click again rapidly to simulate re-triggering while timeouts from the first run might still be pending
    await runBtn.click();

    // Immediately after the second click, clearLog() is called then append('Demo starting...')
    // Check that the first child of the log corresponds to the freshly appended starting message
    await page.waitForFunction(
      () => {
        const el = document.getElementById('log');
        if (!el) return false;
        // The most immediate DOM change after click should be that the log's last appended entry contains "Demo starting"
        return el.lastElementChild && el.lastElementChild.textContent && el.lastElementChild.textContent.includes('Demo starting: A = [4, 10, 3, 5, 1]');
      },
      null,
      { timeout: 1000 }
    );

    // Also ensure at least one "Demo starting" occurrence exists in the log text
    const currentText = await log.innerText();
    const starts = (currentText.match(/Demo starting: A = \[4, 10, 3, 5, 1\]/g) || []).length;
    expect(starts).toBeGreaterThanOrEqual(1);

    // There should be no uncaught runtime errors resulting from multiple invocations
    const pageErrors = page.context()._pageErrors;
    expect(pageErrors.length).toBe(0);

    const consoleErrors = page.context()._consoleMessages.filter(m => m.type === 'error' || /ReferenceError|SyntaxError|TypeError/.test(m.text));
    expect(consoleErrors.length).toBe(0);
  });

  test('Accessibility and DOM invariants: log has role region and aria-live polite; demo-controls evidence matches FSM', async ({ page }) => {
    // Verify the structural evidence described in the FSM: .demo-controls markup and #log role/aria-live attributes
    const demoControls = page.locator('.demo-controls');
    await expect(demoControls).toBeVisible();

    const log = page.locator('#log');
    await expect(log).toBeVisible();
    await expect(log).toHaveAttribute('role', 'region');
    await expect(log).toHaveAttribute('aria-live', 'polite');

    // Confirm the DOM contains the demo-controls markup snippet by checking its HTML contains the button id
    const demoControlsHTML = await demoControls.innerHTML();
    expect(demoControlsHTML).toContain('id="runDemo"');

    // No runtime console/page errors
    const pageErrors = page.context()._pageErrors;
    expect(pageErrors.length).toBe(0);
    const consoleErrors = page.context()._consoleMessages.filter(m => m.type === 'error' || /ReferenceError|SyntaxError|TypeError/.test(m.text));
    expect(consoleErrors.length).toBe(0);
  });
});