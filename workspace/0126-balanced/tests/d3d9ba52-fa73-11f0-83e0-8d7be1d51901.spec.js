import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d9ba52-fa73-11f0-83e0-8d7be1d51901.html';

/**
 * Page Object for the Query Optimization Explorer demo.
 * Encapsulates common interactions so tests stay readable.
 */
class QueryExplorerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // selectors
    this.runBtn = page.locator('#runBtn');
    this.explainBtn = page.locator('#explainBtn');
    this.output = page.locator('#output');
    this.explainDiv = page.locator('#explain');
    this.customersCount = page.locator('#customersCount');
    this.customersCountOut = page.locator('#customersCountOut');
    this.ordersCount = page.locator('#ordersCount');
    this.ordersCountOut = page.locator('#ordersCountOut');
    this.selectivity = page.locator('#selectivity');
    this.selectivityOut = page.locator('#selectivityOut');
    this.indexOnOrders = page.locator('#indexOnOrders');
    this.predicatePushdown = page.locator('#predicatePushdown');
    this.algorithm = page.locator('#algorithm');
    this.estBar = page.locator('#estBar');
    this.actBar = page.locator('#actBar');
    this.metrics = page.locator('#metrics');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait for primary interactive elements to be available
    await Promise.all([
      this.runBtn.waitFor({ state: 'visible' }),
      this.explainBtn.waitFor({ state: 'visible' }),
      this.output.waitFor({ state: 'visible' }),
    ]);
  }

  // Set a range input by assigning value and dispatching input event
  async setRange(selector, value) {
    await this.page.$eval(selector, (el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }

  async setCustomersCount(value) {
    await this.setRange('#customersCount', value);
  }
  async setOrdersCount(value) {
    await this.setRange('#ordersCount', value);
  }
  async setSelectivity(value) {
    await this.setRange('#selectivity', value);
  }

  async setAlgorithm(value) {
    await this.algorithm.selectOption(value);
  }

  async setIndexOnOrders(checked) {
    const isChecked = await this.indexOnOrders.isChecked();
    if (isChecked !== checked) {
      await this.indexOnOrders.click();
    }
  }

  async setPredicatePushdown(checked) {
    const isChecked1 = await this.predicatePushdown.isChecked1();
    if (isChecked !== checked) {
      await this.predicatePushdown.click();
    }
  }

  async clickRun() {
    await this.runBtn.click();
  }

  async clickExplain() {
    await this.explainBtn.click();
  }

  async getOutputText() {
    return (await this.output.textContent()) || '';
  }

  async getExplainText() {
    return (await this.explainDiv.textContent()) || '';
  }

  async isRunDisabled() {
    return await this.runBtn.isDisabled();
  }

  async isExplainDisabled() {
    return await this.explainBtn.isDisabled();
  }

  // Wait for the execution to finish by waiting for the output to contain "Execution finished."
  async waitForExecutionFinish(timeout = 5000) {
    await this.page.waitForFunction(() => {
      const out = document.getElementById('output');
      return out && out.textContent && out.textContent.indexOf('Execution finished.') !== -1;
    }, null, { timeout });
  }
}

test.describe('Query Optimization Explorer — end-to-end FSM validation', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      const txt = `[console:${msg.type()}] ${msg.text()}`;
      consoleMessages.push(txt);
    });

    // Capture unhandled exceptions from the page
    page.on('pageerror', error => {
      pageErrors.push(String(error && error.message ? error.message : error));
    });
  });

  test('Initialization & Idle state (S0_Idle): page renders with controls and initial explain', async ({ page }) => {
    const app = new QueryExplorerPage(page);
    // Navigate to the page and wait for UI
    await app.goto();

    // The Idle state's evidence: buttons present
    await expect(app.runBtn).toBeVisible();
    await expect(app.explainBtn).toBeVisible();

    // Output should contain ready message as in the HTML initial content
    const initialOutput = await app.getOutputText();
    expect(initialOutput).toContain('Ready — configure the query and click "Run Query".');

    // The page's script calls explainBtn.click() at the end of initialization; ensure explain text was generated
    const explainText = await app.getExplainText();
    expect(explainText).toMatch(/Query: SELECT \* FROM Customers JOIN Orders/);
    expect(explainText).toMatch(/Cost estimate \(relative units\):/);

    // Check that the visible outputs reflect the default input values (renderPage/sync)
    await expect(app.customersCountOut).toHaveText('5000');
    await expect(app.ordersCountOut).toHaveText('20000');
    await expect(app.selectivityOut).toHaveText('20%');

    // Assert that the page logged a "loaded" message to the console (script tip)
    const foundLoadLog = consoleMessages.some(m => m.includes('Query Optimization Explorer loaded'));
    expect(foundLoadLog).toBeTruthy();

    // No unexpected page errors during initialization
    expect(pageErrors).toHaveLength(0);
  });

  test.describe('Running queries and QueryRunning state (S1_QueryRunning)', () => {
    test('Run Query disables buttons (onEnter) and re-enables (onExit) and updates output & metrics', async ({ page }) => {
      const app1 = new QueryExplorerPage(page);
      await app.goto();

      // Configure small dataset for quick execution
      await app.setCustomersCount(100); // small
      await app.setOrdersCount(500);
      await app.setSelectivity(50);
      await app.setAlgorithm('nested'); // nested loop join

      // Run the query and validate onEnter behavior
      const runPromise = (async () => {
        await app.clickRun();
      })();

      // Immediately after clicking run, run button should be disabled and output should indicate executing
      await expect(app.runBtn).toBeDisabled();
      await expect(app.explainBtn).toBeDisabled();

      // Output should show the "Executing query..." message while running
      await page.waitForFunction(() => {
        const out1 = document.getElementById('output');
        return out && out.textContent && out.textContent.includes('Executing query... (measuring performance)');
      });

      // Wait for completion (onExit actions)
      await app.waitForExecutionFinish(7000);

      // After completion, runBtn and explainBtn should be enabled again
      await expect(app.runBtn).toBeEnabled();
      await expect(app.explainBtn).toBeEnabled();

      // Output should contain the Execution finished summary and metrics should be present
      const outputText = await app.getOutputText();
      expect(outputText).toContain('Execution finished.');
      expect(outputText).toMatch(/Rows scanned \(orders\):/);
      expect(await app.metrics.textContent()).toMatch(/Estimated work:/);

      // Bars should be updated visually (height and text)
      const estText = await app.estBar.textContent();
      const actText = await app.actBar.textContent();
      expect(estText && estText.trim().length).toBeGreaterThan(0);
      expect(actText && actText.includes('ms')).toBeTruthy();

      // No page errors occurred during execution
      expect(pageErrors).toHaveLength(0);
    });

    test('Changing inputs during a running query does not prematurely re-enable buttons (S1 -> S0 behavior verified)', async ({ page }) => {
      const app2 = new QueryExplorerPage(page);
      await app.goto();

      // Configure a moderate dataset to ensure a short but observable run window
      await app.setCustomersCount(500); // moderate
      await app.setOrdersCount(2000);
      await app.setSelectivity(20);
      await app.setAlgorithm('hash');

      // Start running the query
      await app.clickRun();

      // Immediately ensure buttons are disabled (onEnter)
      await expect(app.runBtn).toBeDisabled();
      await expect(app.explainBtn).toBeDisabled();

      // While query is running, simulate an InputChange event by changing customersCount
      // The FSM lists a transition from QueryRunning -> Idle on InputChange, but the real implementation
      // does not re-enable buttons mid-flight. We assert that behavior (that inputs don't re-enable during run).
      await app.setCustomersCount(400);

      // Still should be disabled until execution completes
      expect(await app.isRunDisabled()).toBeTruthy();
      expect(await app.isExplainDisabled()).toBeTruthy();

      // Wait for completion and then verify buttons are enabled (onExit)
      await app.waitForExecutionFinish(7000);
      await expect(app.runBtn).toBeEnabled();
      await expect(app.explainBtn).toBeEnabled();

      // Confirm that after finishing the output was updated (updateOutput)
      const afterText = await app.getOutputText();
      expect(afterText).toContain('Execution finished.');

      // No page errors from mid-run input activity
      expect(pageErrors).toHaveLength(0);
    });
  });

  test.describe('Explain view and ExplainShowing state (S2_ExplainShowing)', () => {
    test('Clicking Show Explain produces a textual plan reflecting selected options', async ({ page }) => {
      const app3 = new QueryExplorerPage(page);
      await app.goto();

      // Configure to use hash join and toggle pushdown and index to validate different branches
      await app.setAlgorithm('hash');
      await app.setPredicatePushdown(true);
      await app.setIndexOnOrders(false); // index irrelevant for hash but toggle to verify state reflected

      // Click explain and verify the explainDiv is updated with the chosen plan
      await app.clickExplain();

      // The generated explain text should mention Hash Join and predicate pushdown enabled
      const explainText1 = await app.getExplainText();
      expect(explainText).toMatch(/Hash Join/);
      expect(explainText).toMatch(/Predicate pushdown: ENABLED/);
      expect(explainText).toMatch(/Estimated work:/);

      // No change to run button state should be observed by clicking explain alone
      await expect(app.runBtn).toBeEnabled();

      // No page errors occurred
      expect(pageErrors).toHaveLength(0);
    });

    test('Explain reflects index disabled when Indexed algorithm selected', async ({ page }) => {
      const app4 = new QueryExplorerPage(page);
      await app.goto();

      // Select indexed algorithm but disable the index to trigger the explanatory note
      await app.setAlgorithm('indexed');
      await app.setIndexOnOrders(false);

      await app.clickExplain();

      const explainText2 = await app.getExplainText();
      expect(explainText).toMatch(/Indexed Nested Loop requested, but index is DISABLED/);
      expect(explainText).toMatch(/Estimated work:/);
      expect(pageErrors).toHaveLength(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Run with minimal values and very low selectivity produces valid output and metrics', async ({ page }) => {
      const app5 = new QueryExplorerPage(page);
      await app.goto();

      // Minimal values from inputs: customers minimum 100, orders minimum 500, selectivity 1
      await app.setCustomersCount(100);
      await app.setOrdersCount(500);
      await app.setSelectivity(1);
      await app.setAlgorithm('indexed');
      await app.setIndexOnOrders(true);
      await app.setPredicatePushdown(true);

      // Run query
      await app.clickRun();

      // Verify we enter running state
      await expect(app.runBtn).toBeDisabled();
      await expect(app.explainBtn).toBeDisabled();

      // Wait for completion
      await app.waitForExecutionFinish(7000);

      // After completion, validate output contains rows scanned and execution time
      const out2 = await app.getOutputText();
      expect(out).toMatch(/Rows matched \(join result\)|Rows matched/); // flexible check for presence of Rows matched line
      expect(out).toMatch(/Execution time \(measured\):/);

      // Metrics area updated
      const metricsText = await app.metrics.textContent();
      expect(metricsText).toMatch(/Estimated work:/);

      // Ensure no runtime JS errors were thrown
      expect(pageErrors).toHaveLength(0);
    });

    test('Console and page error monitoring: ensure expected console tip exists and no uncaught exceptions', async ({ page }) => {
      const app6 = new QueryExplorerPage(page);
      await app.goto();

      // The page script logs a tip—ensure it exists in the captured console messages
      const hasTip = consoleMessages.some(m => m.includes('Query Optimization Explorer loaded'));
      expect(hasTip).toBeTruthy();

      // Assert there were no page-level errors during our interactions
      expect(pageErrors).toHaveLength(0);
    });
  });

  test.afterEach(async ({ page }) => {
    // Final safety checks: log any console messages if a test fails locally for debugging
    // (We still assert no page errors occurred in tests above.)
    if (pageErrors.length > 0) {
      // Re-throw to make the failure visible in Playwright if any stray errors exist
      // but we preserve tests that already expected no page errors.
      // Note: We do not modify page runtime—just fail the test if errors were captured unexpectedly.
      throw new Error(`Unexpected page errors encountered: ${JSON.stringify(pageErrors, null, 2)}`);
    }
    // do not close the page here; Playwright handles lifecycle.
  });
});