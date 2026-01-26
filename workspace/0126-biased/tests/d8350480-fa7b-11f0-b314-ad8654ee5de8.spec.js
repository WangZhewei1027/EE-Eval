import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8350480-fa7b-11f0-b314-ad8654ee5de8.html';

/**
 * Page Object representing the Bucket Sort demo page.
 * Encapsulates common locators and actions to keep tests readable.
 */
class BucketSortDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demoBtn');
    this.output = page.locator('#demoOutput');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Ensure main elements exist before interacting
    await expect(this.button).toBeVisible();
    await expect(this.output).toBeVisible();
  }

  async clickRun() {
    await this.button.click();
  }

  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }

  async waitForFinalOutput(timeout = 2000) {
    // Wait until the output contains the final Sorted output line
    await this.page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      return el && el.textContent && el.textContent.includes('Sorted output');
    }, null, { timeout });
    return this.getOutputText();
  }
}

test.describe('Bucket Sort — FSM and interactive demo tests', () => {
  // Arrays to collect console messages and page errors per test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console events to observe any runtime errors logged to console
    page.on('console', msg => {
      // Record console error messages (type 'error')
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture unhandled exceptions from the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the application page
    const demo = new BucketSortDemoPage(page);
    await demo.goto();
  });

  test.afterEach(async () => {
    // No explicit teardown needed; Playwright will close page/context.
    // We keep this hook to emphasize teardown exists and could be extended.
  });

  test('Initial Idle state: page loads with Idle state content and accessible controls', async ({ page }) => {
    // Validate initial idle state (S0_Idle)
    // - Button exists and matches expected label and aria-controls
    // - demoOutput contains the pre-fill instructional message
    const demo = new BucketSortDemoPage(page);

    await expect(demo.button).toHaveText('Run demonstration (example floats)');
    await expect(demo.button).toHaveAttribute('aria-controls', 'demoOutput');

    // Verify demoOutput has expected accessibility attributes
    const outputEl = page.locator('#demoOutput');
    await expect(outputEl).toHaveAttribute('role', 'region');
    await expect(outputEl).toHaveAttribute('aria-live', 'polite');
    await expect(outputEl).toHaveAttribute('aria-label', 'Demo output');

    // Confirm the pre-filled instructional text is present (Idle state's entry renderPage behaviour)
    const initialText = await demo.getOutputText();
    await expect(initialText).toContain('Press "Run demonstration (example floats)" to view a step-by-step textual trace of bucket sort operating on a small example.');

    // Assert that no console errors or page errors occurred during initial load
    expect(consoleErrors, 'No console.error messages during initial load').toEqual([]);
    expect(pageErrors, 'No uncaught page errors during initial load').toEqual([]);
  });

  test('Run demonstration transitions: Idle -> DemoRunning -> DemoOutput', async ({ page }) => {
    // This test validates the FSM transitions:
    // - Clicking the Run button triggers DemoRunning (immediate text 'Running demonstration...\n')
    // - After a short delay, the DemoOutput content (bucketSortDemo result) is set
    const demo = new BucketSortDemoPage(page);

    // Click to start demo: should transition to S1_DemoRunning
    await demo.clickRun();

    // Immediately after the click, output should show the "Running demonstration..." message
    // The script sets exactly "Running demonstration...\n" as textContent
    const runningText = await demo.getOutputText();
    // Use toContain to be resilient to surrounding whitespace but expect the key phrase and newline
    expect(runningText).toContain('Running demonstration...');
    // The implementation appends a newline; check at least the phrase exists
    // Now wait for the final output (S2_DemoOutput) produced asynchronously (setTimeout 250ms)
    const finalText = await demo.waitForFinalOutput(3000); // 3s timeout to be safe

    // Final output should include several expected sections from bucketSortDemo
    expect(finalText).toContain('Input array: [0.78, 0.17, 0.39, 0.26, 0.72, 0.94, 0.21, 0.12, 0.23, 0.68]');
    expect(finalText).toContain('Buckets after distribution:');
    expect(finalText).toContain('Step 2: Sort each bucket');
    expect(finalText).toContain('Sorted output: [0.12, 0.17, 0.21, 0.23, 0.26, 0.39, 0.68, 0.72, 0.78, 0.94]');

    // Verify a few explicit distribution and bucket lines as described in the textual example
    expect(finalText).toContain('  - place 0.94 into bucket 9');
    expect(finalText).toContain('Bucket 9: [0.94]');
    // For bucket 1 we expect original order and the sorted "after" order
    expect(finalText).toContain('Bucket 1: [0.17, 0.12]');
    expect(finalText).toContain('bucket 1 before: [0.17, 0.12]  after: [0.12, 0.17]');

    // Confirm that no console or page errors were emitted during the run
    expect(consoleErrors, 'No console.error messages while running demo').toEqual([]);
    expect(pageErrors, 'No uncaught page errors while running demo').toEqual([]);
  });

  test('Repeated clicks while demo runs: ensure behavior is stable and no errors thrown', async ({ page }) => {
    // Edge case: user clicks the Run button multiple times in quick succession.
    // The implementation will set "Running demonstration..." each click and schedule setTimeout updates.
    // We validate that the page reaches the final demo output and that no runtime errors occur.
    const demo = new BucketSortDemoPage(page);

    // Rapid consecutive clicks
    await demo.clickRun();
    // Click again very quickly to simulate repeated user action
    await demo.clickRun();

    // Immediately after repeated clicks, the output should be at least the running message
    const immediate = await demo.getOutputText();
    expect(immediate).toContain('Running demonstration...');

    // Wait for final output (the last scheduled timeout should have applied)
    const final = await demo.waitForFinalOutput(3000);
    expect(final).toContain('Sorted output: [0.12, 0.17, 0.21, 0.23, 0.26, 0.39, 0.68, 0.72, 0.78, 0.94]');

    // No console errors or page errors should be present
    expect(consoleErrors, 'No console.error messages after repeated clicks').toEqual([]);
    expect(pageErrors, 'No uncaught page errors after repeated clicks').toEqual([]);
  });

  test('Validate textual formatting and stability of internal sorts (insertion sort results)', async ({ page }) => {
    // This test inspects the before/after lines for buckets to confirm stable insertion sort behavior.
    const demo = new BucketSortDemoPage(page);

    await demo.clickRun();
    const final = await demo.waitForFinalOutput(3000);

    // Ensure buckets that contained multiple elements are shown and sorted correctly
    // Bucket 1 distribution: originally [0.17, 0.12] -> after sorting [0.12, 0.17]
    expect(final).toContain('Bucket 1: [0.17, 0.12]');
    expect(final).toContain('bucket 1 before: [0.17, 0.12]  after: [0.12, 0.17]');

    // Bucket 2 distribution: originally [0.26, 0.21, 0.23] -> after sorting [0.21, 0.23, 0.26]
    expect(final).toContain('Bucket 2: [0.26, 0.21, 0.23]');
    expect(final).toContain('bucket 2 before: [0.26, 0.21, 0.23]  after: [0.21, 0.23, 0.26]');

    // Bucket 7 distribution: [0.78, 0.72] -> after: [0.72, 0.78]
    expect(final).toContain('Bucket 7: [0.78, 0.72]');
    expect(final).toContain('bucket 7 before: [0.78, 0.72]  after: [0.72, 0.78]');

    // No runtime errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Accessibility and ARIA: ensure interactive control targets the output region', async ({ page }) => {
    // Check the relationship of button -> output via aria-controls and that the output is announced politely
    const demo = new BucketSortDemoPage(page);

    // Verify attributes explicitly
    await expect(demo.button).toHaveAttribute('aria-controls', 'demoOutput');
    await expect(demo.output).toHaveAttribute('aria-live', 'polite');
    await expect(demo.output).toHaveAttribute('role', 'region');

    // Fire the demo and ensure content changes are applied to the aria-live region
    await demo.clickRun();
    // Short wait for immediate running message
    await page.waitForFunction(() => document.getElementById('demoOutput').textContent.includes('Running demonstration...'), null, { timeout: 1000 });

    // Then wait for final output to ensure the aria-live region received the update
    const final = await demo.waitForFinalOutput(3000);
    expect(final).toContain('Sorted output:');

    // No runtime errors detected
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});