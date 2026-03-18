import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a3717503-ffc4-11f0-821c-7d25bc609266.html';

// Page Object Model for the Sliding Window demo
class SlidingWindowPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.slideBtn = page.locator('#slideBtn');
    this.demoOutput = page.locator('#demoOutput');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickSlide() {
    await this.slideBtn.click();
  }

  async getOutputText() {
    // Use textContent() to observe exact content including whitespace, but tests will assert contains.
    return (await this.demoOutput.textContent()) ?? '';
  }

  async waitForOutputContains(substring, options = { timeout: 2000 }) {
    await expect(this.demoOutput).toHaveText(new RegExp(substring), options);
  }
}

test.describe('Sliding Window Interactive Demo - FSM validation', () => {
  // collectors for console messages and page errors
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // nothing to teardown beyond collecting artifacts above
  });

  test('Initial State (S0_Initial) renders correctly with expected DOM and ARIA attributes', async ({ page }) => {
    // This test validates the initial render and attributes mentioned in FSM components.
    const demo = new SlidingWindowPage(page);
    await demo.goto();

    // The demo output should contain the initial window text as per FSM evidence.
    const text = await demo.getOutputText();
    expect(text).toContain('Initial window: [2, 1, 5] (sum: 8)');

    // Button exists and has the expected aria-label
    await expect(demo.slideBtn).toBeVisible();
    await expect(demo.slideBtn).toHaveAttribute('aria-label', 'Slide the window to next position');

    // demo output has aria attributes as described in FSM components
    await expect(demo.demoOutput).toHaveAttribute('aria-live', 'polite');
    await expect(demo.demoOutput).toHaveAttribute('aria-atomic', 'true');

    // Assert that there are no uncaught page errors and no console errors on initial load
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(pageErrors.length, 'No page errors should be thrown on initial load').toBe(0);
    expect(consoleErrorCount, 'No console.error messages on initial load').toBe(0);
  });

  test('Transition S0_Initial -> S1_Sliding: single click updates to window indices 1 to 3 (sum: 7)', async ({ page }) => {
    // Validate the first slide transition from initial state
    const demo = new SlidingWindowPage(page);
    await demo.goto();

    // Click once to slide the window
    await demo.clickSlide();

    // The FSM expects: "Window indices 1 to 3: [1, 5, 1] (sum: 7)"
    await expect(demo.demoOutput).toHaveText(/Window indices 1 to 3: \[1, 5, 1\] \(sum: 7\)/);

    // Ensure no runtime page errors or console.error messages occurred during this interaction
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(pageErrors.length, 'No page errors after first slide').toBe(0);
    expect(consoleErrorCount, 'No console.error after first slide').toBe(0);
  });

  test('Transition S1_Sliding -> S1_Sliding: subsequent slides update indices and sums (9 and 6)', async ({ page }) => {
    // Validate repeated sliding while in S1_Sliding yields the expected windows
    const demo = new SlidingWindowPage(page);
    await demo.goto();

    // Click to move to first sliding state
    await demo.clickSlide(); // 1 -> indices 1..3
    await expect(demo.demoOutput).toHaveText(/Window indices 1 to 3: \[1, 5, 1\] \(sum: 7\)/);

    // Second slide -> indices 2..4 sum 9
    await demo.clickSlide();
    await expect(demo.demoOutput).toHaveText(/Window indices 2 to 4: \[5, 1, 3\] \(sum: 9\)/);

    // Third slide -> indices 3..5 sum 6
    await demo.clickSlide();
    await expect(demo.demoOutput).toHaveText(/Window indices 3 to 5: \[1, 3, 2\] \(sum: 6\)/);

    // Confirm no uncaught errors occurred while performing the sliding actions
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(pageErrors.length, 'No page errors during sliding transitions').toBe(0);
    expect(consoleErrorCount, 'No console.error during sliding transitions').toBe(0);
  });

  test('Transition S1_Sliding -> S2_EndReached -> S0_Initial: reaching end shows message and resets after timeout', async ({ page }) => {
    // This test validates the end-of-array behavior and automatic reset after timeout
    const demo = new SlidingWindowPage(page);
    await demo.goto();

    // Move to the third sliding window (start = 3 after three clicks)
    await demo.clickSlide(); // start = 1
    await demo.clickSlide(); // start = 2
    await demo.clickSlide(); // start = 3 -> shows indices 3..5
    await expect(demo.demoOutput).toHaveText(/Window indices 3 to 5: \[1, 3, 2\] \(sum: 6\)/);

    // Next click should trigger the 'Reached the end of the array - resetting to start again.' message
    await demo.clickSlide();
    await expect(demo.demoOutput).toHaveText(/Reached the end of the array - resetting to start again\./);

    // Immediately after reaching end, the page sets start = 0 and schedules a reset after 1500ms.
    // Wait for longer than 1500ms to verify the reset back to the initial window.
    await page.waitForTimeout(1700);
    // After timeout, demoOutput should display the initial window again
    await expect(demo.demoOutput).toHaveText(/Initial window: \[2, 1, 5\] \(sum: 8\)/);

    // Verify again that no runtime exceptions were thrown during this sequence
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(pageErrors.length, 'No page errors during end/reset transition').toBe(0);
    expect(consoleErrorCount, 'No console.error during end/reset transition').toBe(0);
  });

  test('Edge case: clicking during reset - final state should be the initial window after timeout', async ({ page }) => {
    // This edge-case test asserts behavior when user interacts while the demo is in the reset timeout.
    const demo = new SlidingWindowPage(page);
    await demo.goto();

    // Progress to the state that will trigger the reset on the next click
    await demo.clickSlide(); // start = 1
    await demo.clickSlide(); // start = 2
    await demo.clickSlide(); // start = 3 (window 3..5)
    await expect(demo.demoOutput).toHaveText(/Window indices 3 to 5: \[1, 3, 2\] \(sum: 6\)/);

    // Click to trigger the "Reached the end..." message and scheduled reset
    await demo.clickSlide();
    await expect(demo.demoOutput).toHaveText(/Reached the end of the array - resetting to start again\./);

    // Immediately click again while the reset timeout is pending.
    // According to the implementation, start was set to 0 when "Reached the end..." was handled,
    // so this click should advance to window 1..3; however the pending timeout will still fire and
    // set the output back to the initial window after 1500ms. We assert that the final state after
    // the timeout is the initial window as specified by FSM transition S2 -> S0.
    await demo.clickSlide(); // user interaction during timeout

    // Wait slightly less than the timeout to observe intermediate state (optional)
    await page.waitForTimeout(200);
    // At this point, intermediate state should likely reflect a window (depends on timing). We don't assert it strictly.
    // Now wait for the reset to complete (ensure it's longer than the scheduled 1500ms)
    await page.waitForTimeout(1600);

    // Final expected state after the scheduled reset is the initial window text
    await expect(demo.demoOutput).toHaveText(/Initial window: \[2, 1, 5\] \(sum: 8\)/);

    // Confirm that even with rapid user interaction, there were no uncaught exceptions
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(pageErrors.length, 'No page errors during clicking-during-reset edge case').toBe(0);
    expect(consoleErrorCount, 'No console.error during clicking-during-reset edge case').toBe(0);
  });

  test('Accessibility and resilience: repeated fast clicks do not throw and demo output always valid string', async ({ page }) => {
    // Stress-test clicking rapidly to see if any runtime errors occur and output always remains parseable
    const demo = new SlidingWindowPage(page);
    await demo.goto();

    // Rapidly click the slide button 8 times
    for (let i = 0; i < 8; i++) {
      await demo.clickSlide();
      // brief pause to allow DOM update handlers to run
      await page.waitForTimeout(50);
    }

    // The demo cycles and resets; eventually the output should be a human-readable sentence that matches one of the expected patterns.
    const finalText = await demo.getOutputText();

    // Validate that finalText contains one of the expected patterns from the FSM:
    const possiblePatterns = [
      /Initial window: \[2, 1, 5\] \(sum: 8\)/,
      /Window indices 1 to 3: \[1, 5, 1\] \(sum: 7\)/,
      /Window indices 2 to 4: \[5, 1, 3\] \(sum: 9\)/,
      /Window indices 3 to 5: \[1, 3, 2\] \(sum: 6\)/,
      /Reached the end of the array - resetting to start again\./
    ];
    const matchesOne = possiblePatterns.some((rx) => rx.test(finalText));
    expect(matchesOne, `Final output should match one of expected FSM messages but was: "${finalText}"`).toBeTruthy();

    // Ensure no page errors, and no console.error were emitted during rapid interactions
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(pageErrors.length, 'No page errors during rapid clicks').toBe(0);
    expect(consoleErrorCount, 'No console.error during rapid clicks').toBe(0);
  });

  test('Observability: capture console messages and page errors for diagnostic purposes', async ({ page }) => {
    // This test demonstrates that we observe console and page errors without modifying the page.
    const demo = new SlidingWindowPage(page);
    await demo.goto();

    // Perform a couple of interactions
    await demo.clickSlide();
    await demo.clickSlide();

    // We do not expect any console errors or page errors for this well-formed demo.
    // Assert explicitly that no page errors were collected and no console.error messages exist.
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;

    // Provide clear assertions about the absence of exceptions (observability check)
    expect(pageErrors.length, 'No uncaught exceptions observed on the page').toBe(0);
    expect(consoleErrorCount, 'No console.error messages observed during interactions').toBe(0);

    // As extra diagnostics, ensure that console messages (if any) are non-error (e.g., debug/info)
    // This is a soft check: we assert that any messages present are not of type "error".
    for (const msg of consoleMessages) {
      expect(msg.type).not.toBe('error');
    }
  });
});