import { test, expect } from '@playwright/test';

test.setTimeout(120000); // Allow up to 2 minutes for long-running demo to complete

// Page Object for the Quick Sort Demo page
class QuickSortDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0202-sample/html/a370d8c2-ffc4-11f0-821c-7d25bc609266.html';
    this.startBtn = page.locator('#startDemoBtn');
    this.demoContainer = page.locator('#demoContainer');
    this.arrayDisplay = page.locator('#arrayDisplay');
    this.demoMessage = page.locator('#demoMessage');
  }

  // Navigate to the page
  async goto() {
    await this.page.goto(this.url);
    // Wait for the start button to be present as part of initial render
    await this.startBtn.waitFor({ state: 'visible', timeout: 5000 });
  }

  // Click the start button
  async clickStart() {
    await this.startBtn.click();
  }

  // Return whether demo container is visible (display !== 'none')
  async isDemoContainerVisible() {
    return await this.demoContainer.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style && style.display !== 'none' && el.offsetParent !== null;
    });
  }

  // Get the demo message text
  async getDemoMessageText() {
    return (await this.demoMessage.textContent())?.trim() ?? '';
  }

  // Get array elements as an array of objects: { text, classes, indexStyles }
  async getArrayElementsInfo() {
    return await this.arrayDisplay.evaluate((container) => {
      const children = Array.from(container.children);
      return children.map((el) => {
        return {
          text: el.textContent.trim(),
          classes: Array.from(el.classList),
          // capture inline style snippets that tests may care about (e.g., border set on compared element)
          style: el.getAttribute('style') || ''
        };
      });
    });
  }

  // Wait for demo completion message (final state)
  async waitForCompletion(timeout = 90000) {
    // Poll the demo message until it matches the final expected text
    await this.page.waitForFunction(
      () => {
        const el = document.getElementById('demoMessage');
        return el && el.textContent && el.textContent.trim() === 'Demo complete. The array is fully sorted.';
      },
      {},
      { timeout }
    );
  }
}

test.describe('Quick Sort Demonstration FSM - a370d8c2-ffc4-11f0-821c-7d25bc609266', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    pageErrors = [];
    consoleErrors = [];

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      // store the error message for assertions later
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Collect console messages of error severity
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error' || /ReferenceError|TypeError|SyntaxError/.test(text)) {
        consoleErrors.push(`${type}: ${text}`);
      }
    });
  });

  test.afterEach(async () => {
    // After each test, assert that no unexpected runtime errors were emitted.
    // This validates that the page code ran without uncaught ReferenceError/TypeError/SyntaxError and no console.error messages.
    // If there are known expected errors in the application, tests would assert for them explicitly; here we assert none.
    expect(pageErrors, `No uncaught page errors should have occurred. Collected: ${JSON.stringify(pageErrors)}`).toEqual([]);
    expect(consoleErrors, `No console errors (including ReferenceError/TypeError/SyntaxError) should have been logged. Collected: ${JSON.stringify(consoleErrors)}`).toEqual([]);
  });

  test('S0_Idle: Initial state has a Start button and demo container is hidden', async ({ page }) => {
    // This test validates the Idle (initial) state of the FSM (S0_Idle).
    // It checks that the start button exists (evidence in FSM) and that the demo container is not visible.
    const demo = new QuickSortDemoPage(page);
    await demo.goto();

    // Validate Start button presence and label (evidence)
    await expect(demo.startBtn).toBeVisible();
    await expect(demo.startBtn).toHaveText('Start Quick Sort Demonstration');

    // Validate demo container is hidden (style="display:none;" per component evidence)
    const visible = await demo.isDemoContainerVisible();
    expect(visible).toBe(false);
  });

  test('Transition S0_Idle -> S1_Demo_Started: Clicking Start shows demo container and renders first snapshot', async ({ page }) => {
    // This test validates the StartDemo event and the transition to the Demo Started state (S1_Demo_Started).
    // It asserts that runDemo() causes the demo container to be displayed and the first snapshot rendered immediately.
    const demo = new QuickSortDemoPage(page);
    await demo.goto();

    // Click start and immediately verify demo container becomes visible
    await demo.clickStart();

    // demoContainer.style.display is set to 'block' synchronously in runDemo before interval starts
    const visible = await demo.isDemoContainerVisible();
    expect(visible).toBe(true);

    // The very first step (renderStep(0)) should have been rendered synchronously.
    const message = await demo.getDemoMessageText();
    expect(message.length).toBeGreaterThan(0);
    // The initial snapshot message per implementation includes "Choosing pivot"
    expect(message).toMatch(/Choosing pivot \(/i);

    // The array display should now have the same number of elements as the initial array (7)
    const elements = await demo.getArrayElementsInfo();
    expect(elements.length).toBe(7);

    // The pivot for the initial snapshot is the last element (value 5). It should have class 'pivot'.
    // Find the element whose text is '5' and ensure it has the pivot class
    const pivotEls = elements.filter((e) => e.text === '5');
    expect(pivotEls.length).toBeGreaterThan(0);
    expect(pivotEls.some((e) => e.classes.includes('pivot'))).toBe(true);
  });

  test('Clicking Start multiple times restarts the demo without uncaught errors', async ({ page }) => {
    // This test checks the behavior when the user clicks "Start Quick Sort Demonstration" multiple times.
    // The implementation clears an existing interval and restarts; we validate no errors and that the demo resets to initial snapshot.
    const demo = new QuickSortDemoPage(page);
    await demo.goto();

    // Click the start button the first time
    await demo.clickStart();

    // Wait briefly to allow first render and possibly the interval to schedule
    await page.waitForTimeout(300); // small wait; do not interfere with page code

    // Click again to trigger the code path that clears any existing interval and restarts
    await demo.clickStart();

    // Immediately after the restart, the demo should again be visible and show the initial pivot message
    const visible = await demo.isDemoContainerVisible();
    expect(visible).toBe(true);

    const message = await demo.getDemoMessageText();
    expect(message).toMatch(/Choosing pivot \(/i);

    // Ensure the array is rendered again with expected count
    const elements = await demo.getArrayElementsInfo();
    expect(elements.length).toBe(7);
  });

  test('S1_Demo_Started -> S2_Demo_Complete: Demo runs to completion and shows final message and sorted array', async ({ page }) => {
    // This test validates the transition from Demo Started (S1) to Demo Complete (S2).
    // It waits for the demo to run through all steps and asserts the final completion message and that the array is sorted.
    // Because the demo advances every 2000ms for each snapshot, this test is allowed extra timeout at top-level.
    const demo = new QuickSortDemoPage(page);
    await demo.goto();

    // Start the demo
    await demo.clickStart();

    // Wait for the demo to set up states and begin iteration. The first render is immediate; the rest advance via interval.
    // Wait for the final completion message. This may take several intervals; set a generous timeout.
    await demo.waitForCompletion(90000); // wait up to 90s for full demo completion

    // Verify demoMessage indicates completion (evidence for S2_Demo_Complete)
    const finalMessage = await demo.getDemoMessageText();
    expect(finalMessage).toBe('Demo complete. The array is fully sorted.');

    // Verify the displayed array is sorted as documented in the walkthrough: [2, 3, 5, 6, 7, 8, 9]
    const elements = await demo.getArrayElementsInfo();
    const values = elements.map((e) => Number(e.text));
    expect(values).toEqual([2, 3, 5, 6, 7, 8, 9]);

    // Validate that the pivot class is present on the final pivot position(s) if any (the final state places pivot positions during snapshots,
    // but once completed, elements should be plain; ensure no inline border remains from comparisons)
    const anyBordered = elements.some((e) => e.style.includes('border'));
    expect(anyBordered).toBe(false);
  });

  test('Edge case: Rapid repeated clicks and UI stability under fast interaction', async ({ page }) => {
    // This test simulates rapid user interaction: clicking the start button multiple times quickly.
    // It asserts stability (no errors) and that UI ends up in a running demo state (container visible).
    const demo = new QuickSortDemoPage(page);
    await demo.goto();

    // Rapidly click the start button several times
    for (let i = 0; i < 5; i++) {
      await demo.clickStart();
      // very small delay to simulate fast but not instantaneous clicks
      await page.waitForTimeout(50);
    }

    // After the rapid clicks, demo container should be visible and a message should be present
    const visible = await demo.isDemoContainerVisible();
    expect(visible).toBe(true);

    const message = await demo.getDemoMessageText();
    expect(message.length).toBeGreaterThan(0);

    // Allow a short time for any potential errors to surface (they will be captured by pageerror/console listeners)
    await page.waitForTimeout(500);
  });

  test('Observability: Capture console logs and runtime errors during the demo run', async ({ page }) => {
    // This test is dedicated to observing console output and any page errors while the demo runs.
    // It starts the demo and then waits for at least a few interval ticks to ensure typical runtime paths execute.
    const demo = new QuickSortDemoPage(page);
    await demo.goto();

    // Start the demo
    await demo.clickStart();

    // Wait for a couple of interval steps (2 steps -> ~4000ms); slightly longer to be safe
    await page.waitForTimeout(4500);

    // Verify that we did not capture any page errors or console.error messages so far.
    // These will also be asserted in afterEach, but we explicitly assert here for clarity and troubleshooting.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});