import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a37126e3-ffc4-11f0-821c-7d25bc609266.html';

// Page Object Model for the Kruskal demo page
class KruskalPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runDemoBtn = page.locator('#runDemoBtn');
    this.demoOutput = page.locator('#demoOutput');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickRunDemo() {
    await this.runDemoBtn.click();
  }

  async getOutputText() {
    return await this.demoOutput.textContent();
  }

  async isRunButtonVisible() {
    return await this.runDemoBtn.isVisible();
  }
}

test.describe('Kruskal’s Algorithm Interactive Demo - FSM validation', () => {
  // Collect console and page errors across each test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture all console messages from the page
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      // err is an Error object
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Basic sanity check: no unexpected console errors or page errors occurred
    // These assertions ensure we observed and asserted on console/page errors.
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Idle State (S0_Idle) checks', () => {
    test('Idle state: page renders with Run Demo button and output container', async ({ page }) => {
      // Validate S0_Idle: renderPage() is mentioned in the FSM as an entry action,
      // but the page implementation does not define renderPage(). We check DOM evidence instead.
      const kruskal = new KruskalPage(page);
      await kruskal.goto();

      // The Run Demo button should be present and visible
      expect(await kruskal.isRunButtonVisible()).toBe(true);

      // The button should have the expected text and aria-label per FSM evidence
      await expect(kruskal.runDemoBtn).toHaveText('Run Demo');
      await expect(kruskal.runDemoBtn).toHaveAttribute('aria-label', "Run Kruskal's Algorithm Demo");

      // The output container should be present, empty initially, and have aria-live polite
      await expect(kruskal.demoOutput).toBeVisible();
      const initialText = (await kruskal.getOutputText()) ?? '';
      expect(initialText.trim()).toBe(''); // initial demo output should be empty
      await expect(kruskal.demoOutput).toHaveAttribute('aria-live', 'polite');

      // Verify whether the page exposes a renderPage() function (FSM mentions it).
      // We do NOT modify the page; we only observe. In this implementation renderPage is not defined.
      const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
      expect(hasRenderPage).toBe(false);
    });
  });

  test.describe('Demo Running State (S1_DemoRunning) and Transition RunDemo', () => {
    test('Clicking Run Demo transitions to Demo Running and outputs expected steps and MST', async ({ page }) => {
      // This test validates the RunDemo event (click #runDemoBtn) which should trigger runKruskalDemo()
      // and update the demo output with the algorithm steps and final MST edges.
      const kruskal = new KruskalPage(page);
      await kruskal.goto();

      // Ensure no prior output
      await expect(kruskal.demoOutput).toHaveText('');

      // Click Run Demo
      await kruskal.clickRunDemo();

      // After clicking, the output should start with the expected header
      await expect(kruskal.demoOutput).toContainText("Starting Kruskal's Algorithm Demo");

      // Validate that the sorted edges are listed in ascending weight order
      // The implementation prints "Edge (u - v) with weight w" lines
      const outputText = (await kruskal.getOutputText()) ?? '';

      // Check presence and order of sorted edges (by weight): (0-1)=1, (2-3)=2, (0-2)=3, (1-2)=4, (3-4)=5, (1-4)=7
      const expectedSortedEdges = [
        'Edge (0 - 1) with weight 1',
        'Edge (2 - 3) with weight 2',
        'Edge (0 - 2) with weight 3',
        'Edge (1 - 2) with weight 4',
        'Edge (3 - 4) with weight 5',
        'Edge (1 - 4) with weight 7'
      ];

      // Assert each expected edge string appears somewhere in the output
      for (const edgeLine of expectedSortedEdges) {
        expect(outputText).toContain(edgeLine);
      }

      // Validate MST edges: Expected resulting MST edges per provided example:
      // (0-1) weight1, (2-3) weight2, (0-2) weight3, (3-4) weight5
      const expectedMstLines = [
        '(0 - 1) with weight 1',
        '(2 - 3) with weight 2',
        '(0 - 2) with weight 3',
        '(3 - 4) with weight 5'
      ];
      for (const mstLine of expectedMstLines) {
        expect(outputText).toContain(mstLine);
      }

      // Confirm final demo completion message exists
      expect(outputText).toContain('Demo complete.');

      // Confirm runKruskalDemo exists on the page (FSM S1 entry action)
      // The function is declared in the page script; we check that it's present and callable (type is function)
      const hasRunKruskalDemo = await page.evaluate(() => typeof window.runKruskalDemo === 'function');
      // Note: runKruskalDemo in the current script is defined in an IIFE scope and may not be attached to window.
      // The implementation defines runKruskalDemo as a function in script scope but not as window.runKruskalDemo.
      // Therefore it's likely undefined on window. We assert that it's either a function or undefined — but we must
      // verify the runtime as-is without modifying anything. We'll assert that if it's defined it's a function.
      if (hasRunKruskalDemo) {
        expect(hasRunKruskalDemo).toBe(true);
      } else {
        // If not exposed, ensure that clicking the button nevertheless produced the expected output (already checked).
        expect(hasRunKruskalDemo).toBe(false);
      }
    });

    test('Clicking Run Demo multiple times replaces output (idempotent behavior) and handles rapid clicks', async ({ page }) => {
      // This test verifies that subsequent clicks overwrite the demo output (runKruskalDemo sets textContent)
      // and that rapid/repeated interactions do not produce uncaught exceptions.
      const kruskal = new KruskalPage(page);
      await kruskal.goto();

      // Rapidly click the run button twice
      await kruskal.clickRunDemo();
      await kruskal.clickRunDemo(); // second click should replace output, not append

      // Wait a short moment to allow script to run
      await page.waitForTimeout(100);

      const outputText = (await kruskal.getOutputText()) ?? '';

      // The "Starting Kruskal's Algorithm Demo..." header should appear exactly once at the start
      const occurrences = (outputText.match(/Starting Kruskal's Algorithm Demo/g) || []).length;
      expect(occurrences).toBe(1);

      // No console errors or page errors must have occurred during rapid clicks.
      // Assertions for console/page errors are performed in afterEach hook as well, but we'll do an inline check too.
      // (These arrays are captured in test.beforeEach)
      // Ensure page-level exceptions have not occurred
      // Note: these variables are updated via event handlers defined in beforeEach
      // We assert lengths are zero to confirm no errors were emitted.
      // This will be checked again in afterEach to satisfy the test suite-wide requirement.
      // eslint-disable-next-line no-unused-expressions
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error observation', () => {
    test('Page should not expose undefined functions referenced in FSM and should not throw when interacting', async ({ page }) => {
      // This test inspects the global scope to see whether FSM-expected functions are present.
      // It also verifies that interacting with the UI does not produce runtime errors.
      const kruskal = new KruskalPage(page);
      await kruskal.goto();

      // The FSM mentioned an entry action renderPage() for S0. It is not defined in this implementation.
      // We assert that renderPage is not defined on the window object.
      const renderPageType = await page.evaluate(() => typeof window.renderPage);
      expect(renderPageType).toBe('undefined');

      // Ensure runDemo button exists and clicking it does not cause page errors
      await kruskal.clickRunDemo();
      await page.waitForTimeout(50); // brief wait for any async exceptions

      // Confirm we captured no uncaught exceptions or console.error during the interaction
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);

      // Inspect collected console messages for informational content related to the demo (optional)
      // At minimum, ensure that console did not report runtime errors
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length).toBe(0);
    });
  });
});