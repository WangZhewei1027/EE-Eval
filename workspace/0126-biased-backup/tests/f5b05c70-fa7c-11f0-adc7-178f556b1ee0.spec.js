import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b05c70-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('Priority Queue Interactive Application (FSM: f5b05c70-fa7c-11f0-adc7-178f556b1ee0)', () => {
  // Shared variables for each test
  let consoleMessages;
  let pageErrors;

  // Helper: wait until predicate on consoleMessages is true or timeout
  async function waitForConsolePredicate(predicate, timeout = 2000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (predicate(consoleMessages)) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    // final check to allow test to assert with collected messages
  }

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture all console messages and page errors without modifying page runtime
    page.on('console', (msg) => {
      try {
        consoleMessages.push(msg.text());
      } catch (e) {
        // push a fallback representation if msg.text() fails
        consoleMessages.push(String(msg));
      }
    });

    page.on('pageerror', (err) => {
      // record runtime errors (ReferenceError, TypeError, SyntaxError, etc.)
      pageErrors.push(err.message || String(err));
    });

    // Navigate to the application page; load scripts as-is
    await page.goto(APP_URL);
    // Give the page a moment to run any synchronous top-level code which logs to console
    await waitForConsolePredicate(() => true, 50);
  });

  test.afterEach(async ({ page }) => {
    // close page after each test - Playwright does this automatically in many setups,
    // but keeping explicit is safe
    await page.close();
  });

  test('S0 Idle: Button is present and initial page load executes the example (pre-run logs)', async ({ page }) => {
    // This test validates the Idle state evidence: presence of the button and initial console logs
    // Verify the Run Priority Queue Example button exists with correct text
    const button = await page.$('#priorityQueueButton');
    expect(button).not.toBeNull();
    const buttonText = await page.textContent('#priorityQueueButton');
    expect(buttonText).toBe('Run Priority Queue Example');

    // The page's top-level script (as present in the HTML) runs immediately on load.
    // Validate that the expected sequence of logs from the example is present at least once.
    // We expect the initial run to log: "Job 1", "Job 2", "Job 3", "null" (in that order).
    // Wait shortly for logs to be collected, then assert presence and order.
    await waitForConsolePredicate((msgs) => msgs.length >= 4, 1000);

    // Filter relevant messages (exact matching)
    const jobsOrdered = consoleMessages.filter((m) => m.includes('Job 1') || m.includes('Job 2') || m.includes('Job 3') || m === 'null' || m.includes('null'));
    // At least one full sequence should be present from initial load
    expect(jobsOrdered.length).toBeGreaterThanOrEqual(4);

    // Assert the first occurrence sequence in the filtered list contains Job 1 -> Job 2 -> Job 3 -> null in that order
    // Find indices
    const idxJob1 = consoleMessages.findIndex((m) => m.includes('Job 1'));
    const idxJob2 = consoleMessages.findIndex((m) => m.includes('Job 2'));
    const idxJob3 = consoleMessages.findIndex((m) => m.includes('Job 3'));
    const idxNull = consoleMessages.findIndex((m) => m === 'null' || m.includes('null'));
    expect(idxJob1).toBeGreaterThanOrEqual(0);
    expect(idxJob2).toBeGreaterThan(idxJob1);
    expect(idxJob3).toBeGreaterThan(idxJob2);
    expect(idxNull).toBeGreaterThan(idxJob3);

    // There should be no page runtime errors on initial load
    expect(pageErrors.length).toBe(0);
  });

  test('Transitions: Clicking the button runs the full priority queue sequence (S0 -> S1 -> S2 -> S3 -> S4 -> S5)', async ({ page }) => {
    // This test validates the FSM transitions triggered by the RunPriorityQueueExample event (click).
    // Because the page runs the example on load as well, we clear captured console messages to isolate the click run.
    consoleMessages = [];
    pageErrors = [];

    // Click the button to trigger the example's click handler
    await page.click('#priorityQueueButton');

    // Wait for the expected 4 logs produced by the click handler: Job 1, Job 2, Job 3, null
    await waitForConsolePredicate((msgs) => {
      const hasJob1 = msgs.some((m) => m.includes('Job 1'));
      const hasJob2 = msgs.some((m) => m.includes('Job 2'));
      const hasJob3 = msgs.some((m) => m.includes('Job 3'));
      const hasNull = msgs.some((m) => m === 'null' || m.includes('null'));
      return hasJob1 && hasJob2 && hasJob3 && hasNull;
    }, 1000);

    // Assert order: find first indices after the click
    const idxJob1 = consoleMessages.findIndex((m) => m.includes('Job 1'));
    const idxJob2 = consoleMessages.findIndex((m) => m.includes('Job 2'));
    const idxJob3 = consoleMessages.findIndex((m) => m.includes('Job 3'));
    const idxNull = consoleMessages.findIndex((m) => m === 'null' || m.includes('null'));

    expect(idxJob1).toBeGreaterThanOrEqual(0);
    expect(idxJob2).toBeGreaterThan(idxJob1);
    expect(idxJob3).toBeGreaterThan(idxJob2);
    expect(idxNull).toBeGreaterThan(idxJob3);

    // This validates the observable outputs for each FSM state in sequence:
    // - After insertions (S1) -> search logs Job 1 (S2)
    // - After delete -> search logs Job 2 (S3)
    // - After delete -> search logs Job 3 (S4)
    // - After delete -> search logs null (S5)

    // Ensure there were no unexpected runtime errors while executing the click handler
    expect(pageErrors.length).toBe(0);

    // Visual/DOM check: button remains visible and clickable after execution
    const buttonVisible = await page.isVisible('#priorityQueueButton');
    expect(buttonVisible).toBe(true);
    const isEnabled = await page.isEnabled('#priorityQueueButton');
    expect(isEnabled).toBe(true);
  });

  test('Edge case: Multiple clicks produce repeated sequences and do not throw errors', async ({ page }) => {
    // This test validates repeated runs (edge case) and ensures the app behaves deterministically across multiple invocations.

    // Clear previously captured messages
    consoleMessages = [];
    pageErrors = [];

    // Click the button twice in quick succession
    await page.click('#priorityQueueButton');
    await page.click('#priorityQueueButton');

    // Wait for at least two sequences worth of logs (each sequence: 4 relevant entries)
    await waitForConsolePredicate((msgs) => {
      const countJob1 = msgs.filter((m) => m.includes('Job 1')).length;
      return countJob1 >= 2;
    }, 1500);

    // Confirm that at least two occurrences of each expected log exist
    const countJob1 = consoleMessages.filter((m) => m.includes('Job 1')).length;
    const countJob2 = consoleMessages.filter((m) => m.includes('Job 2')).length;
    const countJob3 = consoleMessages.filter((m) => m.includes('Job 3')).length;
    const countNull = consoleMessages.filter((m) => m === 'null' || m.includes('null')).length;

    expect(countJob1).toBeGreaterThanOrEqual(2);
    expect(countJob2).toBeGreaterThanOrEqual(2);
    expect(countJob3).toBeGreaterThanOrEqual(2);
    expect(countNull).toBeGreaterThanOrEqual(2);

    // No runtime errors should be thrown during repeated execution
    expect(pageErrors.length).toBe(0);
  });

  test('Negative scenario / edge assertion: Verify searchElement returns null when queue emptied (S5 evidence)', async ({ page }) => {
    // This test specifically verifies the S5_NoElements evidence: that searchElement() logs null after deletions.

    // The page logs null both on initial load and on button click. To be explicit, click once and check for null.
    consoleMessages = [];
    pageErrors = [];

    await page.click('#priorityQueueButton');

    // Wait for null log
    await waitForConsolePredicate((msgs) => msgs.some((m) => m === 'null' || m.includes('null')), 1000);

    const nullLogs = consoleMessages.filter((m) => m === 'null' || m.includes('null'));
    expect(nullLogs.length).toBeGreaterThanOrEqual(1);

    // Additionally ensure that the null log appears after the Job 3 log (order assertion)
    const idxJob3 = consoleMessages.findIndex((m) => m.includes('Job 3'));
    const idxNull = consoleMessages.findIndex((m) => m === 'null' || m.includes('null'));
    expect(idxJob3).toBeGreaterThanOrEqual(0);
    expect(idxNull).toBeGreaterThan(idxJob3);

    // Confirm no page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Instrumentation check: collect and report any runtime errors if present', async ({ page }) => {
    // This test intentionally checks the global captured pageErrors array.
    // According to the requirement, we must observe console logs and page errors and allow any runtime errors to surface.
    // Assert that if any runtime errors occurred, they are captured and reported in the test failure message.
    // If none occurred, that is also an acceptable and asserted outcome.

    // At this point in the test lifecycle (page loaded in beforeEach), pageErrors was collected.
    // We assert that there are zero runtime errors. If errors exist, surface them for debugging by failing with their messages.
    if (pageErrors.length > 0) {
      // Fail the test explicitly, including captured errors
      const aggregated = pageErrors.join(' | ');
      throw new Error(`Runtime errors detected on page load/run: ${aggregated}`);
    } else {
      // No runtime errors observed
      expect(pageErrors.length).toBe(0);
    }
  });
});