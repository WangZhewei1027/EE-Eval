import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d836d940-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object for the demo area
class SlidingWindowDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoBtn = page.locator('#demoBtn');
    this.status = page.locator('#demoStatus');
    this.note = page.locator('#demoNote');
    this.arrayVisual = page.locator('#arrayVisual');
    this.cells = page.locator('#arrayVisual .cell');
  }

  async clickRun() {
    await this.demoBtn.click();
  }

  async getStatusText() {
    return (await this.status.textContent()) ?? '';
  }

  async getNoteText() {
    return (await this.note.textContent()) ?? '';
  }

  async getCellsText() {
    return this.cells.evaluateAll(nodes => nodes.map(n => n.textContent));
  }

  async getCellCount() {
    return this.cells.count();
  }

  // Returns array of booleans whether a cell at each index has the highlight class
  async getHighlights() {
    return this.cells.evaluateAll(nodes => nodes.map(n => n.classList.contains('highlight')));
  }

  // Wait until status text matches the done message with expected maxSum
  async waitForDone(maxSum = 6, timeout = 10000) {
    const expected = 'Done. Max sum = ' + maxSum;
    await this.page.waitForFunction(
      (selector, expectedText) => {
        const el = document.querySelector(selector);
        return el && el.textContent && el.textContent.indexOf(expectedText) !== -1;
      },
      ['#demoStatus', expected],
      { timeout }
    );
  }

  // Wait until status contains substring (used during running)
  async waitForStatusContains(substr, timeout = 5000) {
    await this.page.waitForFunction(
      (selector, substring) => {
        const el = document.querySelector(selector);
        return el && el.textContent && el.textContent.indexOf(substring) !== -1;
      },
      ['#demoStatus', substr],
      { timeout }
    );
  }
}

test.describe('Sliding Window demo — FSM states & transitions', () => {
  // Containers to capture console errors and page errors
  let consoleErrors;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors for each test
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    page.on('pageerror', error => {
      // Uncaught exceptions end up here
      pageErrors.push(String(error && error.message ? error.message : error));
    });

    // Navigate to the page under test (load as-is; do not modify)
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
  });

  test.afterEach(async () => {
    // Basic sanity: there should be no uncaught page errors or console.error messages
    // We assert zero length so that any runtime ReferenceError/TypeError/etc. will fail the test.
    // This ensures we observed and surfaced runtime errors rather than masking them.
    expect(pageErrors, 'No uncaught page errors should be emitted').toHaveLength(0);
    expect(consoleErrors, 'No console.error messages should be emitted').toHaveLength(0);
  });

  test('Initial Idle state: controls and static rendering are present', async ({ page }) => {
    // This test validates the S0_Idle state entry_actions and visible components:
    // - renderPage() (in this implementation, renderCells() is invoked on load)
    // - The demo button is present with correct text and aria-label
    // - The array visualization is rendered with the expected cell values
    // - demoStatus and demoNote are initially empty

    const demo = new SlidingWindowDemoPage(page);

    // Button exists and has expected accessible name and text content
    await expect(demo.demoBtn).toBeVisible();
    await expect(demo.demoBtn).toHaveAttribute('aria-label', 'Run a short sliding window demo');
    const btnText = await demo.demoBtn.textContent();
    expect(btnText && btnText.trim()).toBe('Run demo: slide k=3');

    // The static array cells should be rendered on page load (renderCells called)
    const count = await demo.getCellCount();
    expect(count).toBe(6); // arr = [2, -1, 3, 4, -2, 1]

    const cellTexts = await demo.getCellsText();
    expect(cellTexts).toEqual(['2', '-1', '3', '4', '-2', '1']);

    // demoStatus and demoNote start empty
    const initialStatus = await demo.getStatusText();
    const initialNote = await demo.getNoteText();
    expect((initialStatus || '').trim()).toBe('');
    expect((initialNote || '').trim()).toBe('');
  });

  test('Transition: RunDemo moves to Demo Running state and then completes', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_DemoRunning on clicking RunDemo,
    // verifies entry actions (renderCells, status.textContent = "Running…", note cleared),
    // and exit actions when the demo completes (status set to done & note updated).
    const demo = new SlidingWindowDemoPage(page);

    // Sanity: make sure initial state is idle
    expect((await demo.getStatusText()).trim()).toBe('');

    // Click to start demo (RunDemo event)
    await demo.clickRun();

    // Immediately the page script sets status to 'Running…' per entry actions
    await demo.waitForStatusContains('Running…', 2000);
    const runningStatus = await demo.getStatusText();
    expect(runningStatus).toContain('Running…');

    // Note should have been cleared at the start of run
    const noteDuringRun = await demo.getNoteText();
    expect((noteDuringRun || '').trim()).toBe('');

    // During running, the status updates to show "Window [.. ..] sum = .." snapshots.
    // Wait for at least one snapshot status update to appear (status contains 'Window [')
    await demo.waitForStatusContains('Window [', 5000);

    // Wait for the demo to complete and verify final status and note (S1 -> S0 transition)
    await demo.waitForDone(6, 10000); // expected final max sum is 6

    const finalStatus = await demo.getStatusText();
    expect(finalStatus).toContain('Done. Max sum = 6');

    const finalNote = await demo.getNoteText();
    expect(finalNote).toContain('Final answer for this demonstration: maximum sum of any subarray of size 3 is 6.');

    // Verify that the final highlight corresponds to the last window [3 .. 5]
    // The implementation highlights the window at each step and doesn't remove final highlight on completion.
    const highlights = await demo.getHighlights();
    // Expected highlight booleans for indices [0..5] -> indices 3,4,5 should be true
    expect(highlights).toEqual([false, false, false, true, true, true]);
  });

  test('Clicking the demo button while running is ignored; after completion it can be re-run', async ({ page }) => {
    // This test checks the guard "if (timer !== null) return;" that prevents concurrent runs.
    // It also verifies that after the demo completes, clicking the button again starts a new run (timer reset).

    const demo = new SlidingWindowDemoPage(page);

    // Start the demo
    await demo.clickRun();

    // Immediately try clicking again while running; should be ignored and not cause errors
    await demo.clickRun();
    await demo.clickRun();

    // Status should still be running shortly after repeated clicks
    await demo.waitForStatusContains('Running…', 2000);
    expect((await demo.getStatusText()).includes('Running…')).toBeTruthy();

    // Wait for completion
    await demo.waitForDone(6, 10000);
    expect((await demo.getNoteText())).toContain('Final answer for this demonstration: maximum sum');

    // After completion, clicking again should start another run (status becomes Running… again)
    await demo.clickRun();
    await demo.waitForStatusContains('Running…', 2000);
    expect((await demo.getStatusText()).includes('Running…')).toBeTruthy();

    // Let second run finish (should complete with same final max)
    await demo.waitForDone(6, 10000);
    const finalNoteSecondRun = await demo.getNoteText();
    expect(finalNoteSecondRun).toContain('Final answer for this demonstration: maximum sum of any subarray of size 3 is 6.');
  });

  test('Edge case checks: DOM stability and no unexpected exceptions during interaction', async ({ page }) => {
    // This test performs a burst of interactions and inspects the console/page error arrays
    // to ensure the application remains robust under repeated rapid actions.
    const demo = new SlidingWindowDemoPage(page);

    // Rapid sequence: click, wait a short while, click (ignored), wait, click after completion
    await demo.clickRun();
    // after a small delay attempt another click (should be ignored while running)
    await page.waitForTimeout(150);
    await demo.clickRun();

    // wait for a snapshot update
    await demo.waitForStatusContains('Window [', 5000);

    // Wait for completion
    await demo.waitForDone(6, 10000);

    // Quick re-run right after completion
    await demo.clickRun();
    await demo.waitForStatusContains('Running…', 2000);
    await demo.waitForDone(6, 10000);

    // Asserting again that no page errors or console errors were captured
    // (Also covered in afterEach, but reassert here for clarity)
    // Note: not modifying page or global environment per instructions.
    // The arrays are checked in afterEach; here we just assert they are arrays
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    expect(Array.isArray(pageErrors)).toBeTruthy();
  });
});