import { test, expect } from '@playwright/test';

test.setTimeout(30000);

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d835c7d1-fa7b-11f0-b314-ad8654ee5de8.html';

// Page object for the demonstration panel to keep tests organized.
class FloydWarshallDemo {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator('button#run');
    this.caption = page.locator('#matrix-play');
    this.preMatrix0 = page.locator('#matrix0');
    this.preMatrix4 = page.locator('#matrix4');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickRun() {
    await this.runButton.click();
  }

  async isRunButtonDisabled() {
    return await this.runButton.isDisabled();
  }

  async getRunButtonText() {
    return (await this.runButton.textContent())?.trim();
  }

  async getCaptionText() {
    if (await this.caption.count() === 0) return null;
    return (await this.caption.textContent())?.trim();
  }

  async getMatrix0Text() {
    return (await this.preMatrix0.textContent()) || '';
  }

  async getMatrix4Text() {
    return (await this.preMatrix4.textContent()) || '';
  }
}

test.describe('Floyd–Warshall demonstration - FSM validation and DOM checks', () => {
  // Collect console and page errors for assertions
  /** @type {Array<Error>} */
  let pageErrors;
  /** @type {Array<{type:string,text:string}>} */
  let consoleMessages;
  /** @type {import('@playwright/test').Page} */
  let page;

  test.beforeEach(async ({ browser }) => {
    pageErrors = [];
    consoleMessages = [];

    page = await browser.newPage();

    // Observe runtime page errors (unhandled exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Collect console messages and categorize them
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the app under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Close the page after each test to isolate console/pageerror events
    await page.close();
  });

  test('S0_Idle: initial page renders with Run button and initial matrix (idle state)', async () => {
    // This test validates the Idle state (S0_Idle) per the FSM:
    // - The "Run simple demonstration" button exists and is enabled.
    // - The initial matrix (matrix0) is present and contains expected textual matrix header/values.
    const demo = new FloydWarshallDemo(page);

    // Ensure run button exists and shows the expected label
    await expect(demo.runButton).toBeVisible();
    const btnText = await demo.getRunButtonText();
    expect(btnText).toBe('Run simple demonstration');

    // Button should initially be enabled (idle state)
    expect(await demo.isRunButtonDisabled()).toBe(false);

    // Initial matrix (#matrix0) should contain the header and known values from the HTML
    const matrix0Text = await demo.getMatrix0Text();
    // Check for header labels and a few numeric values to assert proper rendering
    expect(matrix0Text).toContain('|  A');
    expect(matrix0Text).toContain('0'); // diagonal zero
    expect(matrix0Text).toContain('3'); // A->B = 3 is present
    expect(matrix0Text).toContain('-4'); // A->D = -4 is present

    // No unexpected page runtime errors have occurred on load
    expect(pageErrors.length, 'No page errors on initial load').toBe(0);

    // No console-level "error" messages should have been emitted during load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'No console errors on initial load').toBe(0);
  });

  test('S0 -> S1: clicking Run transitions to Running Demonstration (button disabled, caption appears)', async () => {
    // Validates the transition from Idle (S0) -> Running (S1) on click event:
    // - Clicking the button disables it immediately (running flag prevents re-entry).
    // - A dynamic caption element (#matrix-play) appears as steps start being shown.
    const demo = new FloydWarshallDemo(page);

    // Click the run button to start the demonstration.
    await demo.clickRun();

    // Immediately after click the button should be disabled to reflect running state
    expect(await demo.isRunButtonDisabled()).toBe(true);

    // Clicking the run button again while running should be ignored (no exception thrown).
    // We attempt another click and ensure no additional runtime errors occur.
    await demo.runButton.click().catch(() => {
      // If a click is ignored, Playwright may still throw if element is disabled; swallow that here.
    });

    // Wait briefly for the script to create the first caption and highlight the first matrix.
    await page.waitForTimeout(250); // small wait for DOM updates

    // A caption describing the current step should be present
    const captionText = await demo.getCaptionText();
    expect(captionText, 'Caption should be present while running').not.toBeNull();
    expect(captionText).toContain('1/');

    // Verify that the caption text mentions the first step title or explanation text
    expect(captionText).toMatch(/Initial|no intermediate|This is the adjacency matrix|1\//i);

    // Check that no page errors or console errors happened as a result of the click
    expect(pageErrors.length, 'No page errors after starting demo').toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'No console errors after starting demo').toBe(0);
  });

  test('S1 -> S2: demonstration completes and button text becomes "Demonstration complete" (final state)', async () => {
    // Validates the transition Running (S1) -> Completed (S2):
    // - After the sequence of timeouts the button text becomes "Demonstration complete".
    // - The final matrix (#matrix4) is visible and matches expected final values.
    // Because the application uses real setTimeout with interval ~1400ms and 5 steps,
    // we wait for the full duration plus a buffer to let the demo conclude naturally.
    const demo = new FloydWarshallDemo(page);

    // Start the demonstration
    await demo.clickRun();

    // The demo iterates 5 steps with interval 1400ms each and a final 300ms action.
    // Total time needed: 5 * 1400 + 300 = 7300ms. Use a buffer to be robust.
    await page.waitForTimeout(8500);

    // After the demo completes, the button text should be updated to "Demonstration complete"
    const finalBtnText = await demo.getRunButtonText();
    expect(finalBtnText).toBe('Demonstration complete');

    // The final matrix (#matrix4) should contain values from the final step (e.g., -2 in A->A)
    const matrix4Text = await demo.getMatrix4Text();
    expect(matrix4Text).toContain('-2'); // dist[A][A] = -2 in the final matrix
    expect(matrix4Text).toContain('1');  // some improved distances like 1 expected
    expect(matrix4Text).toContain('-6'); // A->D = -6 is present in final matrix

    // Final caption should reference the final step
    const captionText = await demo.getCaptionText();
    expect(captionText).toBeTruthy();
    expect(captionText?.toLowerCase()).toContain('final');

    // Assert that no runtime page errors happened during the full run
    expect(pageErrors.length, 'No page errors during full demonstration run').toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'No console errors during full demonstration run').toBe(0);
  });

  test('Edge case: clicking Run multiple times quickly should not create multiple concurrent runs or errors', async () => {
    // This test attempts to reproduce an edge case: rapid repeated clicks.
    // The application guards against re-entry (if running) so there should be no duplicated behavior or runtime errors.
    const demo = new FloydWarshallDemo(page);

    // Rapidly attempt to click the button several times
    // First click starts it
    await demo.clickRun();

    // Immediately attempt 3 more clicks (these should be effectively ignored by the page script)
    for (let i = 0; i < 3; i++) {
      // If the button is disabled Playwright click will throw, so guard with isDisabled check
      if (!(await demo.isRunButtonDisabled())) {
        await demo.runButton.click().catch(() => {});
      } else {
        // If disabled, simply attempt to dispatch a click event via JS (non-invasive),
        // but per the assignment we must not redefine or patch global environment.
        // So only use Playwright click guarded by disabled state above — do not inject scripts.
      }
    }

    // Wait a short while for DOM updates
    await page.waitForTimeout(300);

    // Ensure there is exactly one caption id in use (#matrix-play is single element)
    const captionCount = await page.locator('#matrix-play').count();
    expect(captionCount).toBeLessThanOrEqual(1);

    // Wait for demo to finish to ensure no late errors occur
    await page.waitForTimeout(8200);

    // Ensure no page errors occurred during the rapid-click edge case
    expect(pageErrors.length, 'No page errors after repeated rapid clicks').toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'No console errors after repeated rapid clicks').toBe(0);
  });

  test('Observability: capture and assert console and page error streams (no unexpected errors)', async () => {
    // This test simply verifies that throughout normal interactions no uncaught runtime errors or console.error calls happened.
    const demo = new FloydWarshallDemo(page);

    // Start and finish the demo so we capture as much runtime activity as possible
    await demo.clickRun();
    await page.waitForTimeout(8500);

    // Assert collected page errors list is empty
    expect(pageErrors.length, 'Expected zero page errors during full demo lifecycle').toBe(0);

    // Assert there were no console.error messages emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'Expected zero console.error messages during full demo lifecycle').toBe(0);

    // For diagnostic purposes in case of failures, include a friendly assertion message showing console messages count
    expect(consoleMessages.length >= 0).toBeTruthy();
  });
});