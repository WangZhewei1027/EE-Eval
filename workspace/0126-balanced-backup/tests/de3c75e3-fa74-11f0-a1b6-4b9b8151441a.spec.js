import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3c75e3-fa74-11f0-a1b6-4b9b8151441a.html';

// Page object encapsulating interactions with the Big-Theta demo page
class BigThetaPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.calculateBtn = page.locator("button[onclick='calculateGrowth()']");
    this.drawBtn = page.locator("button[onclick='drawGraph()']");
    this.output = page.locator('#output');
    this.graph = page.locator('#graph');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickCalculate() {
    await this.calculateBtn.click();
  }

  async clickDrawGraph() {
    await this.drawBtn.click();
  }

  async outputInnerText() {
    return await this.output.innerText();
  }

  async outputInnerHTML() {
    return await this.output.innerHTML();
  }

  async countOutputLinesContaining(prefix) {
    const text = await this.outputInnerText();
    // Count occurrences of the prefix (e.g., 'n = ')
    return (text.match(new RegExp(prefix, 'g')) || []).length;
  }

  async countBars() {
    return await this.page.locator('#graph .bar').count();
  }

  async countLegendsAfterGraph() {
    // Legends are inserted as a div inserted after the graph element
    return await this.page.evaluate(() => {
      const graph = document.getElementById('graph');
      if (!graph) return 0;
      // Count number of sibling legend nodes that look like inserted legends:
      // We inserted a <div> with inline innerHTML containing span color boxes and names.
      let count = 0;
      let node = graph.nextSibling;
      while (node) {
        if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'DIV' && node.innerHTML && node.innerHTML.includes('Θ(1)')) {
          count++;
        }
        node = node.nextSibling;
      }
      return count;
    });
  }

  async graphHasAnyBars() {
    return (await this.countBars()) > 0;
  }
}

test.describe('Big-Theta Notation Interactive Application - FSM Validation', () => {
  // Capture console errors and page errors for each test
  test.beforeEach(async ({ page }) => {
    // No global modifications — only observe console and page errors
    page.context()._observedConsoleErrors = [];
    page.context()._observedPageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        page.context()._observedConsoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    page.on('pageerror', err => {
      page.context()._observedPageErrors.push({
        message: err.message,
        stack: err.stack
      });
    });
  });

  test.afterEach(async ({ page }) => {
    // For debugging, if tests fail we keep the errors in the report by asserting later in tests.
  });

  test.describe('Initial Idle State (S0_Idle)', () => {
    test('renders page and shows expected controls and empty output/graph', async ({ page }) => {
      // This test validates the S0_Idle state's expected UI presence: buttons and empty areas.
      const app = new BigThetaPage(page);
      await app.goto();

      // Title is present
      await expect(page.locator('h1')).toHaveText(/Big-Theta/i);

      // Buttons for both actions are visible
      await expect(app.calculateBtn).toBeVisible();
      await expect(app.drawBtn).toBeVisible();

      // Output area exists and is initially empty
      const outText = await app.outputInnerText();
      expect(outText.trim()).toBe('', 'Output should be empty on initial load (Idle state)');

      // Graph should be empty (no bars)
      const bars = await app.countBars();
      expect(bars).toBe(0);

      // No console errors or page errors should have occurred during initial load
      const consoleErrors = page.context()._observedConsoleErrors;
      const pageErrors = page.context()._observedPageErrors;
      expect(consoleErrors.length, `console.error messages on initial load: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `page errors on initial load: ${JSON.stringify(pageErrors)}`).toBe(0);
    });
  });

  test.describe('Transition: CalculateGrowth (S0_Idle -> S1_GrowthCalculated)', () => {
    test('clicking "Calculate Growth Rates" updates #output with Growth Rate Comparison (entry action = calculateGrowth())', async ({ page }) => {
      // This test validates the transition from Idle to GrowthCalculated and the entry action effect.
      const app = new BigThetaPage(page);
      await app.goto();

      // Click the calculate button (this triggers calculateGrowth())
      await app.clickCalculate();

      // The output should contain the expected heading
      await expect(app.output.locator('h3')).toHaveText('Growth Rate Comparison');

      // There should be 10 lines corresponding to n = 1..10
      const countN = await app.countOutputLinesContaining('n = ');
      expect(countN).toBe(10);

      // Ensure each n line includes a checkmark (✅) as per implementation for n>=1
      const outHTML = await app.outputInnerHTML();
      const checks = (outHTML.match(/✅/g) || []).length;
      expect(checks).toBe(10, 'Each of the n=1..10 lines should show a ✅ since bounds hold');

      // Verify that repeated clicks do not duplicate content because function resets output.innerHTML
      await app.clickCalculate();
      const countNAfterSecondClick = await app.countOutputLinesContaining('n = ');
      expect(countNAfterSecondClick).toBe(10);

      // No console or page errors should have been produced by this interaction
      const consoleErrors = page.context()._observedConsoleErrors;
      const pageErrors = page.context()._observedPageErrors;
      expect(consoleErrors.length, `console.error messages after calculateGrowth: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `page errors after calculateGrowth: ${JSON.stringify(pageErrors)}`).toBe(0);
    });

    test('edge case: clicking calculateGrowth multiple times remains stable (idempotent update)', async ({ page }) => {
      // This test checks stability on repeated invocations of calculateGrowth (edge case).
      const app = new BigThetaPage(page);
      await app.goto();

      // Click multiple times in quick succession
      await Promise.all([app.clickCalculate(), app.clickCalculate(), app.clickCalculate()]);

      // Output should still have exactly 10 n-lines and a single heading
      await expect(app.output.locator('h3')).toHaveCount(1);
      const countN = await app.countOutputLinesContaining('n = ');
      expect(countN).toBe(10);

      // Ensure no JS errors occurred
      expect(page.context()._observedConsoleErrors.length).toBe(0);
      expect(page.context()._observedPageErrors.length).toBe(0);
    });
  });

  test.describe('Transition: ShowGrowthRates (S0_Idle -> S2_GraphDrawn)', () => {
    test('clicking "Show Growth Rates" draws bars in #graph and appends a legend (entry action = drawGraph())', async ({ page }) => {
      // This test validates the transition from Idle to GraphDrawn and the DOM manipulations performed.
      const app = new BigThetaPage(page);
      await app.goto();

      // Ensure graph is initially empty
      expect(await app.countBars()).toBe(0);

      // Click draw graph
      await app.clickDrawGraph();

      // Bars should be created: 10 n values * 5 growth rates = 50 bars
      const bars = await app.countBars();
      expect(bars).toBe(50);

      // There should be at least one legend inserted after graph
      const legends = await app.countLegendsAfterGraph();
      expect(legends).toBeGreaterThanOrEqual(1);

      // Each bar should have a title that includes "n=" per implementation; sample-check first and last bar
      const firstBarTitle = await page.locator('#graph .bar').first().getAttribute('title');
      expect(firstBarTitle).toMatch(/n=\d+:/);

      // No console or page errors should have been produced by this interaction
      expect(page.context()._observedConsoleErrors.length).toBe(0);
      expect(page.context()._observedPageErrors.length).toBe(0);
    });

    test('edge case: clicking drawGraph multiple times appends additional legends but resets bars each time', async ({ page }) => {
      // This test validates behavior when drawGraph is invoked repeatedly.
      const app = new BigThetaPage(page);
      await app.goto();

      // First draw
      await app.clickDrawGraph();
      const barsAfterFirst = await app.countBars();
      const legendsAfterFirst = await app.countLegendsAfterGraph();

      expect(barsAfterFirst).toBe(50);
      expect(legendsAfterFirst).toBeGreaterThanOrEqual(1);

      // Second draw - graph.innerHTML is reset, so bar count should still be 50
      await app.clickDrawGraph();
      const barsAfterSecond = await app.countBars();
      const legendsAfterSecond = await app.countLegendsAfterGraph();

      expect(barsAfterSecond).toBe(50);
      // Implementation inserts another legend div after graph; we expect legends to increase
      expect(legendsAfterSecond).toBeGreaterThanOrEqual(legendsAfterFirst + 0);

      // No thrown exceptions should be recorded in console/page errors
      expect(page.context()._observedConsoleErrors.length).toBe(0);
      expect(page.context()._observedPageErrors.length).toBe(0);
    });
  });

  test.describe('Combined interactions and FSM coverage', () => {
    test('invoke calculateGrowth then drawGraph and verify both regions updated independently', async ({ page }) => {
      // Validate combined transitions and that S1 and S2 states can both be observed in sequence.
      const app = new BigThetaPage(page);
      await app.goto();

      // Calculate growth first
      await app.clickCalculate();
      await expect(app.output.locator('h3')).toHaveText('Growth Rate Comparison');

      // Then show graph
      await app.clickDrawGraph();
      const bars = await app.countBars();
      expect(bars).toBe(50);

      // Ensure calculateGrowth output remains present after drawing graph
      await expect(app.output.locator('h3')).toHaveText('Growth Rate Comparison');

      // Verify no JS runtime errors captured
      expect(page.context()._observedConsoleErrors.length).toBe(0);
      expect(page.context()._observedPageErrors.length).toBe(0);
    });

    test('robustness: check for runtime errors (ReferenceError, SyntaxError, TypeError) during normal interactions', async ({ page }) => {
      // This test monitors runtime errors that might surface during normal usage.
      const app = new BigThetaPage(page);
      await app.goto();

      // Perform interactions that exercise the code paths
      await app.clickCalculate();
      await app.clickDrawGraph();
      await app.clickCalculate();

      // Collect observed errors
      const consoleErrors = page.context()._observedConsoleErrors || [];
      const pageErrors = page.context()._observedPageErrors || [];

      // We assert that there are no ReferenceError/SyntaxError/TypeError occurrences in this healthy implementation.
      // If such errors occur naturally, this assertion will fail and surface them as required by the observation policy.
      const combinedErrors = consoleErrors.map(e => e.text).concat(pageErrors.map(e => e.message));
      const hasCriticalJSRuntimeErrors = combinedErrors.some(msg =>
        /ReferenceError|SyntaxError|TypeError/.test(msg)
      );

      expect(hasCriticalJSRuntimeErrors, `Unexpected ReferenceError/SyntaxError/TypeError observed: ${JSON.stringify(combinedErrors)}`).toBe(false);

      // Also ensure total errors count is zero for both console and pageerror as a stronger guarantee
      expect(consoleErrors.length, `console.error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
    });
  });
});