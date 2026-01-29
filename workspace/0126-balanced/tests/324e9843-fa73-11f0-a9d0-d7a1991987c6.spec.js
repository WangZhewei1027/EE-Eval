import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324e9843-fa73-11f0-a9d0-d7a1991987c6.html';

/**
 * Page Object for the Thread Simulation page.
 * Encapsulates common operations and selectors.
 */
class ThreadSimPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startButton = page.locator('#startThreadButton');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickStart() {
    await this.startButton.click();
  }

  async getOutputInnerHTML() {
    return await this.page.evaluate(() => document.getElementById('output').innerHTML);
  }

  async getOutputInnerText() {
    return await this.page.evaluate(() => document.getElementById('output').innerText);
  }

  /**
   * Waits until the given substring is present in the output text.
   * @param {string} substring
   * @param {number} timeout
   */
  async waitForOutputContains(substring, timeout = 5000) {
    await this.page.waitForFunction(
      (s) => document.getElementById('output') && document.getElementById('output').innerText.includes(s),
      substring,
      { timeout }
    );
  }

  /**
   * Waits until all provided substrings are present in the output text.
   * @param {string[]} substrings
   * @param {number} timeout
   */
  async waitForAllOutputs(substrings, timeout = 7000) {
    await this.page.waitForFunction(
      (subs) => {
        const txt = document.getElementById('output') ? document.getElementById('output').innerText : '';
        return subs.every(s => txt.includes(s));
      },
      substrings,
      { timeout }
    );
  }
}

test.describe('Thread Simulation FSM tests - 324e9843-fa73-11f0-a9d0-d7a1991987c6', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture uncaught exceptions (pageerror) and console error messages.
    page.on('pageerror', (err) => {
      // Record the error object for assertions later
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
        });
      }
    });
  });

  test.afterEach(async () => {
    // No teardown of the page event listeners necessary as Playwright closes pages between tests.
    // We keep this hook for symmetry and future extension.
  });

  // Test initial state: S0_Idle
  test('Initial state displays Start button and empty output (S0_Idle)', async ({ page }) => {
    const app = new ThreadSimPage(page);
    // Load the application page as-is
    await app.goto();

    // Validate the Start button exists and is visible/enabled
    await expect(app.startButton).toBeVisible();
    await expect(app.startButton).toBeEnabled();

    // Validate the output area exists and is empty (entry action renderPage -> output empty)
    const outText = await app.getOutputInnerText();
    expect(outText.trim()).toBe('', 'Expected output to be empty on initial render');

    // There should be no runtime errors at page load
    expect(pageErrors.length, `Unexpected page errors on initial load: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console errors on initial load: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  // Test transition: StartThreadSimulation -> S1_ThreadSimulating
  test('Clicking Start transitions to Thread Simulating and shows starting message (S1_ThreadSimulating)', async ({ page }) => {
    const app1 = new ThreadSimPage(page);
    await app.goto();

    // Click the start button to trigger simulateThread() (event handler defined in page)
    await app.clickStart();

    // The entry action for S1 is simulateThread(), which synchronously writes the starting message.
    // Verify that the "Starting multiple tasks..." message appears immediately.
    await app.waitForOutputContains('Starting multiple tasks...', 1000);

    const innerHTML = await app.getOutputInnerHTML();
    // The implementation uses <strong>Starting multiple tasks...</strong><br>
    expect(innerHTML).toContain('<strong>Starting multiple tasks...</strong><br>');

    // No immediate runtime console errors after initiating simulation
    expect(pageErrors.length, `Page errors after starting simulation: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Console errors after starting simulation: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  // Test all task completions: S2-S5
  test('All tasks (1-4) eventually complete and their completion messages appear (S2_Task1_Completed..S5_Task4_Completed)', async ({ page }) => {
    const app2 = new ThreadSimPage(page);
    await app.goto();

    // Start the simulation
    await app.clickStart();

    // Wait for all "Task X completed!" messages to appear.
    // Worst-case estimate:
    // - each task starts after up to ~2000ms random delay
    // - then internal delays: task1 1000ms, task2 1500ms, task3 1200ms, task4 800ms
    // So max ~3500ms for task2. Use generous timeout.
    await app.waitForAllOutputs(
      ['Task 1 completed!', 'Task 2 completed!', 'Task 3 completed!', 'Task 4 completed!'],
      8000
    );

    const outText1 = await app.getOutputInnerText();

    // Assert each completed message is present somewhere in the output.
    expect(outText).toContain('Task 1 completed!');
    expect(outText).toContain('Task 2 completed!');
    expect(outText).toContain('Task 3 completed!');
    expect(outText).toContain('Task 4 completed!');

    // Also assert that there were "is running..." messages indicating tasks started
    // (At least one such message should be present)
    expect(outText).toMatch(/is running\.\.\./);

    // Ensure no uncaught exceptions or console errors occurred during the run.
    expect(pageErrors.length, `Unexpected page errors during simulation: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console errors during simulation: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  // Test that intermediate "is running..." messages appear (concurrent simulation evidence)
  test('During simulation tasks emit "is running..." messages (evidence of asynchronous starts)', async ({ page }) => {
    const app3 = new ThreadSimPage(page);
    await app.goto();

    await app.clickStart();

    // Wait for at least one "is running..." message to appear indicative of tasks being invoked
    await app.waitForOutputContains('is running...', 5000);

    const outText2 = await app.getOutputInnerText();
    // There should be at least one "Task X is running..." occurrence
    const runningOccurrences = (outText.match(/is running\.\.\./g) || []).length;
    expect(runningOccurrences).toBeGreaterThanOrEqual(1);

    // Confirm no runtime errors
    expect(pageErrors.length, `Page errors while observing running messages: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Console errors while observing running messages: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  // Edge case: clicking the start button multiple times quickly should reset output (output.innerHTML = "")
  test('Rapid repeated clicks reset output and only the latest run\'s "Starting multiple tasks..." remains', async ({ page }) => {
    const app4 = new ThreadSimPage(page);
    await app.goto();

    // First click
    await app.clickStart();

    // Wait a short moment then click again quickly to simulate rapid user input.
    await page.waitForTimeout(50);
    await app.clickStart();

    // After the second click, the output should have been cleared and the starting message re-inserted.
    // The HTML string used for the starting message is exact; check that it appears exactly once.
    await app.waitForOutputContains('Starting multiple tasks...', 1000);

    const innerHTML1 = await app.getOutputInnerHTML();
    const startHtml = '<strong>Starting multiple tasks...</strong><br>';
    const occurrences = (innerHTML.match(new RegExp(startHtml.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g')) || []).length;

    // Because the second click overwrites the content, we expect exactly 1 occurrence of the starting message.
    expect(occurrences).toBe(1);

    // Let the simulation complete for safety and check for completion messages eventually (non-strict here)
    await app.waitForAllOutputs(
      ['Task 1 completed!', 'Task 2 completed!', 'Task 3 completed!', 'Task 4 completed!'],
      8000
    );

    // Verify again there are no page errors or console errors after repeated clicks
    expect(pageErrors.length, `Page errors after rapid clicks: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Console errors after rapid clicks: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  // Error scenario test: Observe and assert whether any console or page errors were emitted during interactions.
  // If errors occurred, this test will surface them; the expectation here is that the page runs without throwing.
  test('No uncaught exceptions or console errors occur during typical usage (error observation)', async ({ page }) => {
    const app5 = new ThreadSimPage(page);
    await app.goto();

    // Start simulation and wait for completion of all tasks
    await app.clickStart();
    await app.waitForAllOutputs(
      ['Task 1 completed!', 'Task 2 completed!', 'Task 3 completed!', 'Task 4 completed!'],
      8000
    );

    // Final assertions about runtime errors collected throughout the test lifecycle
    // We expect zero page errors and zero console errors for this implementation
    expect(pageErrors.length, `Page errors detected: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Console errors detected: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });
});