import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d834b660-fa7b-11f0-b314-ad8654ee5de8.html';

test.describe('Quick Sort — FSM and Demo Integration Tests (d834b660-fa7b-11f0-b314-ad8654ee5de8)', () => {
  // Will collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture all console messages emitted by the page
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (error) => {
      pageErrors.push(error);
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Close page to ensure a clean slate (Playwright test runner will also handle this)
    await page.close();
  });

  test.describe('State S0_Idle (Initial render)', () => {
    test('renders the Run Quick Sort Trace button and placeholder log (Idle state)', async ({ page }) => {
      // Validate that the Run Quick Sort Trace button exists and is visible
      const runButton = page.locator('#runDemo');
      await expect(runButton).toBeVisible();
      await expect(runButton).toHaveText('Run Quick Sort Trace');

      // Validate the log area exists with the expected initial placeholder text
      const log = page.locator('#log');
      await expect(log).toBeVisible();

      // The demo placeholder text is present initially
      await expect(log).toContainText('Press the button to run the trace. (Runs only a single demonstration.)');

      // Assert that no console errors or page errors occurred during initial render
      const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transition RunDemoClick -> S1_DemoRunning', () => {
    test('clicking the Run Quick Sort Trace button runs the demo and appends a sequence of log entries', async ({ page }) => {
      const runButton = page.locator('#runDemo');
      const log = page.locator('#log');

      // Ensure initial state: placeholder present
      await expect(log).toContainText('Press the button to run the trace. (Runs only a single demonstration.)');

      // Click to trigger runDemo() (transition from S0_Idle to S1_DemoRunning)
      await runButton.click();

      // After clicking, runDemo clears the log and writes its own lines.
      // Wait for a distinctive line that runDemo appends to appear in the log area.
      // This checks that runDemo() executed and DOM updated accordingly.
      await page.waitForSelector('#log >> text=Quick Sort Trace (Lomuto partition, pivot = last element of range)', { timeout: 2000 });

      // Verify some expected lines and content produced by the demo:
      // - Header line announcing the trace
      // - Initial array line
      // - Quicksort calls and partition messages
      // - Final sorted array line with expected sorted sequence
      const logText = await log.innerText();

      // Header check
      expect(logText).toContain('Quick Sort Trace (Lomuto partition, pivot = last element of range)');

      // Initial array is printed
      expect(logText).toContain('Initial array:');

      // The formatted initial array should appear (formatArray uses bracketed items)
      expect(logText).toContain('[9, 3, 7, 1, 8, 2, 5, 4, 6]');

      // There should be partition calls recorded; check for at least one partition range mention
      expect(logText).toMatch(/Partition range \[\d+\.\.\d+\]/);

      // Final sorted array check - this is part of the runDemo output
      expect(logText).toContain('Final sorted array: [1, 2, 3, 4, 5, 6, 7, 8, 9]');

      // Ensure the initial placeholder text is no longer present (runDemo cleared innerHTML)
      expect(logText).not.toContain('Press the button to run the trace. (Runs only a single demonstration.)');

      // Check there were no console errors or page errors during the demo execution
      const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('the demo runs only once due to the { once: true } click listener — second click does nothing', async ({ page }) => {
      const runButton = page.locator('#runDemo');
      const log = page.locator('#log');

      // Click first time to run demo
      await runButton.click();

      // Wait for final sorted array line to appear ensuring the demo completed its log run
      await page.waitForSelector('#log >> text=Final sorted array: [1, 2, 3, 4, 5, 6, 7, 8, 9]', { timeout: 2000 });

      // Count number of child divs in log after first run
      const entriesAfterFirstRun = await page.$$eval('#log > div', nodes => nodes.map(n => n.textContent));

      // Try clicking the button a second time. Because the original event listener was registered with { once: true },
      // runDemo should not execute again and the log content should remain the same (no new lines added).
      await runButton.click();

      // Allow a small delay to ensure if a second run would have happened it had time to append
      await page.waitForTimeout(250);

      const entriesAfterSecondClick = await page.$$eval('#log > div', nodes => nodes.map(n => n.textContent));

      // The counts should be equal — no new entries appended from a second click
      expect(entriesAfterSecondClick.length).toBe(entriesAfterFirstRun.length);

      // And the full text content should be unchanged
      expect(entriesAfterSecondClick.join('\n')).toBe(entriesAfterFirstRun.join('\n'));

      // Confirm no page errors or console errors were emitted when attempting to click a second time
      const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and robustness checks', () => {
    test('log formatting includes markers for subranges and single-element base cases are logged', async ({ page }) => {
      const runButton = page.locator('#runDemo');
      const log = page.locator('#log');

      // Run the demo
      await runButton.click();

      // Wait for at least one "Single element at index" entry to appear
      // The demo logs single-element base cases in quicksortTrace
      await page.waitForSelector('#log >> text=Single element at index', { timeout: 2000 });

      const logText = await log.innerText();

      // Ensure that a "Single element at index" entry exists (base case logging)
      expect(logText).toMatch(/Single element at index \d+: \d+/);

      // Ensure that there are "Quicksort call on [x..y]" lines showing recursive ranges
      expect(logText).toMatch(/Quicksort call on \[\d+\.\.\d+\] -> \[/);

      // Confirm that partition placement lines exist
      expect(logText).toMatch(/Place pivot -> \[/);

      // Ensure no console or page errors
      const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('page retains accessibility attribute aria-live on log region and it is present', async ({ page }) => {
      // Confirm the #log region has aria-live attribute as expected from the implementation
      const log = page.locator('#log');
      await expect(log).toHaveAttribute('aria-live', 'polite');

      // No runtime errors occurred
      const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });
});