import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cbb042-fa7c-11f0-ba20-415c525382ea.html';

// Page Object for the demo page to keep tests organized and readable
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demo = page.locator('#demo');
    this.button = page.locator('#demoBtn');
  }

  // navigate to the page
  async goto() {
    await this.page.goto(APP_URL);
  }

  // click the Run Simple Thread Demo button
  async clickRun() {
    await this.button.click();
  }

  // get the demo div text content
  async getDemoText() {
    return (await this.demo.textContent()) || '';
  }

  // wait until the demo text contains "Demonstration complete."
  async waitForCompletion(timeout = 15000) {
    await expect(this.demo).toContainText('Demonstration complete.', { timeout });
  }

  // count occurrences of a substring in the demo text
  async countOccurrences(substring) {
    const text = await this.getDemoText();
    if (!substring) return 0;
    let count = 0;
    let idx = 0;
    while (true) {
      idx = text.indexOf(substring, idx);
      if (idx === -1) break;
      count++;
      idx = idx + substring.length;
    }
    return count;
  }
}

test.describe('Understanding Threads demo - FSM and UI behaviors', () => {
  // Increase default timeout for tests that wait for asynchronous demo to finish
  test.setTimeout(30000);

  test('Initial Idle state: button is present and demo area is empty with proper aria attribute', async ({ page }) => {
    // Set up listeners to capture console messages and page errors.
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push(msg));
    page.on('pageerror', err => pageErrors.push(err));

    const demoPage = new DemoPage(page);
    await demoPage.goto();

    // Validate the button exists and is visible (verifies S0_Idle evidence)
    await expect(demoPage.button).toBeVisible();
    await expect(demoPage.button).toHaveText('Run Simple Thread Demo');

    // Validate the demo area exists, is empty initially, and has aria-live attribute.
    await expect(demoPage.demo).toBeVisible();
    const initialText = await demoPage.getDemoText();
    expect(initialText).toBe('', 'Expected demo area to be empty on initial render (Idle state).');

    // Confirm aria-live attribute is set to polite per component definition
    const ariaLive = await page.getAttribute('#demo', 'aria-live');
    expect(ariaLive).toBe('polite');

    // Observe console and page errors (none expected in a clean run)
    // We capture messages but do not prevent errors from occurring naturally.
    const errorConsoleCount = consoleMessages.filter(m => m.type() === 'error').length;
    expect(pageErrors.length).toBe(0);
    expect(errorConsoleCount).toBe(0);
  });

  test('Transition S0_Idle -> S1_DemoRunning: clicking button sets starting message immediately', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push(msg));
    page.on('pageerror', err => pageErrors.push(err));

    const demoPage = new DemoPage(page);
    await demoPage.goto();

    // Click the button to trigger the transition
    await demoPage.clickRun();

    // Immediately after clicking, the entry action should set the "Starting demonstration..." text.
    // We assert the presence of that string quickly.
    await expect(demoPage.demo).toContainText('Starting demonstration...', { timeout: 2000 });

    // No page errors expected at this point
    const errorConsoleCount = consoleMessages.filter(m => m.type() === 'error').length;
    expect(pageErrors.length).toBe(0);
    expect(errorConsoleCount).toBe(0);
  });

  test('Full run: demo prints all thread steps and appends "Demonstration complete." on exit', async ({ page }) => {
    // This test validates:
    // - Entry action sets starting text
    // - Each fakeThread prints its steps the expected number of times
    // - Exit action appends "Demonstration complete."
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push(msg));
    page.on('pageerror', err => pageErrors.push(err));

    const demoPage = new DemoPage(page);
    await demoPage.goto();

    // Start the demo
    await demoPage.clickRun();

    // Wait for completion; longest thread takes ~2100ms so allow generous timeout
    await demoPage.waitForCompletion(15000);

    // After completion, verify the final message is present
    const finalText = await demoPage.getDemoText();
    expect(finalText).toContain('Demonstration complete.');

    // Verify expected step counts for one full run:
    // Thread A should have 4 steps, Thread B 6 steps, Thread C 3 steps.
    const countA = (finalText.match(/Thread A – Step/g) || []).length;
    const countB = (finalText.match(/Thread B – Step/g) || []).length;
    const countC = (finalText.match(/Thread C – Step/g) || []).length;

    expect(countA).toBe(4);
    expect(countB).toBe(6);
    expect(countC).toBe(3);

    // No page errors expected
    const errorConsoleCount = consoleMessages.filter(m => m.type() === 'error').length;
    expect(pageErrors.length).toBe(0);
    expect(errorConsoleCount).toBe(0);
  });

  test('Edge case: clicking button twice quickly leads to multiple completions and interleaving', async ({ page }) => {
    // This test validates behavior when event is triggered while already in S1_DemoRunning.
    // We let the app run naturally and assert the observable outputs are consistent with multiple runs.
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push(msg));
    page.on('pageerror', err => pageErrors.push(err));

    const demoPage = new DemoPage(page);
    await demoPage.goto();

    // Click once, then click again shortly after to simulate double activation while demo is running.
    await demoPage.clickRun();
    // small delay before second click to simulate user clicking again during run
    await page.waitForTimeout(200);
    await demoPage.clickRun();

    // Wait for both runs to finish; allow generous timeout in case of interleaving
    await demoPage.waitForCompletion(20000);

    const finalText = await demoPage.getDemoText();

    // We expect at least two occurrences of "Demonstration complete." (one per click/run)
    const completeCount = (finalText.match(/Demonstration complete\./g) || []).length;
    expect(completeCount).toBeGreaterThanOrEqual(2);

    // We expect aggregated counts of thread steps to be at least the counts for one run,
    // and plausibly equal to counts * 2 if both runs fully contributed output without being overwritten.
    const countA = (finalText.match(/Thread A – Step/g) || []).length;
    const countB = (finalText.match(/Thread B – Step/g) || []).length;
    const countC = (finalText.match(/Thread C – Step/g) || []).length;

    // Each click should trigger 4, 6, 3 steps respectively. We assert at least one full run's worth.
    expect(countA).toBeGreaterThanOrEqual(4);
    expect(countB).toBeGreaterThanOrEqual(6);
    expect(countC).toBeGreaterThanOrEqual(3);

    // It's acceptable if counts equal double (8,12,6) depending on race between resets and appends.
    // We assert no unexpected runtime errors were thrown during this stress case.
    const errorConsoleCount = consoleMessages.filter(m => m.type() === 'error').length;
    expect(pageErrors.length).toBe(0);
    expect(errorConsoleCount).toBe(0);
  });

  test('Robustness: Observe console and page errors during navigation and interaction', async ({ page }) => {
    // This test focuses solely on capturing console and page errors across lifecycle.
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push(msg));
    page.on('pageerror', err => pageErrors.push(err));

    const demoPage = new DemoPage(page);
    await demoPage.goto();

    // Perform interactions: click, wait a bit, click again, wait
    await demoPage.clickRun();
    await page.waitForTimeout(100);
    await demoPage.clickRun();

    // Wait for expected completion and give a moment for any late errors to surface
    await demoPage.waitForCompletion(20000);
    await page.waitForTimeout(200);

    // Collect any console messages of type 'error'
    const errorConsoleMessages = consoleMessages.filter(m => m.type && m.type() === 'error');

    // Assert that no uncaught page errors (exceptions) occurred during use.
    // If any runtime errors do occur in the application naturally, this assertion will fail and surface them.
    expect(pageErrors.length, `Expected no page errors, but found: ${pageErrors.map(String).join('\n')}`).toBe(0);

    // Assert console did not emit error-level messages
    expect(errorConsoleMessages.length, `Expected no console error messages, but found: ${errorConsoleMessages.map(m => m.text()).join('\n')}`).toBe(0);
  });
});