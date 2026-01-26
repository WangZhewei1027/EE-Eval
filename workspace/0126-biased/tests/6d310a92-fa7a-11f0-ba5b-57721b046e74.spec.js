import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d310a92-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object model for the Query Optimization Explorer
class QueryOptimizerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // UI element handles
  async clickShowSchema() { await this.page.click('#show-schema-btn'); }
  async clickGenerateQuery() { await this.page.click('#generate-query-btn'); }
  async clickExplain() { await this.page.click('#explain-btn'); }
  async clickExecute() { await this.page.click('#execute-btn'); }
  async clickSavePlan() { await this.page.click('#save-plan-btn'); }
  async clickComparePlans() { await this.page.click('#compare-plans-btn'); }
  async clickAnalyze() { await this.page.click('#analyze-query-btn'); }
  async clickAddJoin() { await this.page.click('.add-join-btn'); }
  async clickAddFilter() { await this.page.click('.add-filter-btn'); }

  async setWorkMem(value) {
    // set input range value via evaluate to ensure the input fires the 'input' event
    await this.page.evaluate((v) => {
      const el = document.getElementById('work-mem');
      el.value = String(v);
      // dispatch input event
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }

  async getSchemaText() { return this.page.locator('#schema-display').textContent(); }
  async getGeneratedQueryText() { return this.page.locator('#generated-query').textContent(); }
  async getExecutionPlanText() { return this.page.locator('#execution-plan').textContent(); }
  async getResultHTML() { return this.page.locator('#result-data').innerHTML(); }
  async getEstimatedCostText() { return this.page.locator('#estimated-cost').textContent(); }
  async getExecutionTimeText() { return this.page.locator('#execution-time').textContent(); }
  async getRowsProcessedText() { return this.page.locator('#rows-processed').textContent(); }
  async getPlanComparisonText() { return this.page.locator('#plan-comparison').textContent(); }
  async getIndexRecommendationsText() { return this.page.locator('#index-recommendations').textContent(); }
  async getWorkMemValueText() { return this.page.locator('#work-mem-value').textContent(); }

  async getSavedPlansLength() {
    return this.page.evaluate(() => {
      // Access the in-page savedPlans variable
      // This reads internal state created by the page script
      return typeof savedPlans !== 'undefined' ? savedPlans.length : 0;
    });
  }

  // Utility to wait for results table to appear after executeQuery
  async waitForResults(timeout = 3000) {
    await this.page.waitForSelector('#result-data table', { timeout });
  }
}

test.describe('Query Optimization Explorer - FSM and UI integration tests', () => {
  let page;
  let qp;
  let consoleMessages;
  let pageErrors;
  let dialogMessages;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    qp = new QueryOptimizerPage(page);

    consoleMessages = [];
    pageErrors = [];
    dialogMessages = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Capture and automatically accept any dialogs, store their messages for assertions
    page.on('dialog', async dialog => {
      dialogMessages.push(dialog.message());
      try {
        await dialog.accept();
      } catch (e) {
        // ignore acceptance errors, we still collect messages
      }
    });

    await qp.goto();
  });

  test.afterEach(async () => {
    // Assert no unhandled page errors occurred during the test
    expect(pageErrors, 'No uncaught page errors should be present').toHaveLength(0);

    // Assert no console.error messages were emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'exception');
    expect(consoleErrors, 'No console error/exception messages expected').toHaveLength(0);

    await page.close();
  });

  test('S0_Idle: initial render shows title and basic components', async () => {
    // Validate the initial state (Idle): title is present and core elements exist
    const title = await page.locator('h1').textContent();
    expect(title).toBe('Query Optimization Explorer');

    // Schema display should be empty initially
    const schemaText = await qp.getSchemaText();
    expect(schemaText?.trim()).toBe('');

    // Generated query is empty initially
    const genQuery = await qp.getGeneratedQueryText();
    expect(genQuery?.trim()).toBe('');

    // Execution plan empty
    const execPlan = await qp.getExecutionPlanText();
    expect(execPlan?.trim()).toBe('');

    // No saved plans initially (in-page state)
    const savedLen = await qp.getSavedPlansLength();
    expect(savedLen).toBe(0);
  });

  test('Transition S0 -> S1: Show Schema displays selected table schema', async () => {
    // Click "Show Schema" and verify schema display updates
    await qp.clickShowSchema();

    const schema = await qp.getSchemaText();
    expect(schema).toContain('Table: customers'); // default selection
    expect(schema).toContain('Columns:');
    expect(schema).toContain('Indexes:');
  });

  test('Transition S0 -> S2: Generate Query produces SQL for selected tables', async () => {
    // Click Generate Query and validate generatedQuery text content
    await qp.clickGenerateQuery();

    const queryText = await qp.getGeneratedQueryText();
    expect(queryText).toContain('SELECT');
    expect(queryText).toContain('FROM customers');
    // When only customers is checked by default it will show FROM customers
    expect(queryText.trim().length).toBeGreaterThan(0);
  });

  test('Transition S2 -> S3: Explain Query shows execution plan and updates metrics', async () => {
    // Generate then explain
    await qp.clickGenerateQuery();
    await qp.clickExplain();

    const planText = await qp.getExecutionPlanText();
    expect(planText).toContain('QUERY PLAN');
    expect(planText).toContain('Cost settings');

    // Estimated cost should be set by explainQuery()
    const estCost = await qp.getEstimatedCostText();
    expect(estCost).toBe('1500.00');

    const rowsProcessed = await qp.getRowsProcessedText();
    expect(rowsProcessed).toBe('50000');
  });

  test('Transition S2 -> S4: Execute Query runs explain first then shows results', async () => {
    // Generate and execute - execution triggers a short timeout before results are shown
    await qp.clickGenerateQuery();
    await qp.clickExecute();

    // Wait for results table to appear
    await qp.waitForResults(2000);

    const resultHTML = await qp.getResultHTML();
    expect(resultHTML).toContain('<table>');
    expect(resultHTML).toContain('<th>');
    // Execution time should be updated (not '-')
    const execTime = await qp.getExecutionTimeText();
    expect(execTime).not.toBe('-');
    // Performance metrics updated
    const estCost = await qp.getEstimatedCostText();
    expect(estCost).toBe('1500.00');
  });

  test('Transition S4 -> S5: Save Plan stores a plan and triggers alert', async () => {
    // Generate, explain and execute to ensure there is an execution plan and results
    await qp.clickGenerateQuery();
    await qp.clickExecute();
    await qp.waitForResults(2000);

    // Click save plan - page will show an alert which is captured
    await qp.clickSavePlan();

    // The dialog should have been shown once for save
    expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
    // Last dialog message should contain "Plan saved"
    const lastMsg = dialogMessages[dialogMessages.length - 1];
    expect(lastMsg).toContain('Plan saved');

    // Validate in-page savedPlans length incremented
    const savedLen = await qp.getSavedPlansLength();
    expect(savedLen).toBe(1);
  });

  test('Transition S5 -> S6: Compare Plans requires >=2 plans; produce two plans then compare', async () => {
    // Create first saved plan
    await qp.clickGenerateQuery();
    await qp.clickExecute();
    await qp.waitForResults(2000);
    await qp.clickSavePlan();
    // New dialog captured
    expect(dialogMessages[dialogMessages.length - 1]).toContain('Plan saved');

    // Create a second plan with a different work_mem setting to vary settings
    await qp.setWorkMem(80);
    // Re-generate and execute to create a new execution plan snapshot
    await qp.clickGenerateQuery();
    await qp.clickExecute();
    await qp.waitForResults(2000);
    await qp.clickSavePlan();
    expect(dialogMessages[dialogMessages.length - 1]).toContain('Plan saved');

    // Verify savedPlans length is 2
    const savedLen = await qp.getSavedPlansLength();
    expect(savedLen).toBeGreaterThanOrEqual(2);

    // Click Compare Plans to populate #plan-comparison
    await qp.clickComparePlans();

    const comparison = await qp.getPlanComparisonText();
    // Should contain entries for Plan 1 and Plan 2 and BEST PLAN text
    expect(comparison).toContain('PLAN 1');
    expect(comparison).toContain('PLAN 2');
    expect(comparison).toContain('BEST PLAN');
  });

  test('Transition S2 -> S7: Analyze Query for Indexes returns recommendations for generated query', async () => {
    // Generate a multi-table query including orders so that analyzeForIndexes picks up customer_id index info
    // Check the Orders checkbox (uncheck others if needed)
    await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[name="query-table"]'));
      inputs.forEach(i => i.checked = false);
      const orders = document.querySelector('input[name="query-table"][value="orders"]');
      const customers = document.querySelector('input[name="query-table"][value="customers"]');
      if (orders) orders.checked = true;
      if (customers) customers.checked = true; // include customers so generated query includes customer_id join clause
    });

    await qp.clickGenerateQuery();

    await qp.clickAnalyze();

    const recs = await qp.getIndexRecommendationsText();
    // analyzeForIndexes should detect the orders(customer_id) existing index line
    expect(recs).toContain('Index on orders(customer_id) already exists');
  });

  test('UpdateWorkMemDisplay: slider input updates visible MB display', async () => {
    // Change work_mem slider and assert the display updates accordingly
    await qp.setWorkMem(75);
    const display = await qp.getWorkMemValueText();
    expect(display).toBe('75 MB');

    await qp.setWorkMem(10);
    const display2 = await qp.getWorkMemValueText();
    expect(display2).toBe('10 MB');
  });

  test('AddJoin and AddFilter UI buttons show alerts describing the addition', async () => {
    // Click add join and add filter; both trigger dialogs captured by page.on('dialog')
    const beforeCount = dialogMessages.length;
    await qp.clickAddJoin();
    await qp.clickAddFilter();

    // There should be at least two new dialog messages
    expect(dialogMessages.length).toBeGreaterThanOrEqual(beforeCount + 2);

    const joinMsg = dialogMessages[dialogMessages.length - 2];
    const filterMsg = dialogMessages[dialogMessages.length - 1];

    expect(joinMsg).toContain('Added join condition');
    expect(filterMsg).toContain('Added filter');
  });

  // Edge case tests and error scenarios
  test('Edge: Explain without generating a query shows helpful message', async () => {
    // On a fresh page, clicking Explain should instruct to generate a query first
    await qp.clickExplain();
    const planText = await qp.getExecutionPlanText();
    expect(planText).toBe('Please generate a query first');
  });

  test('Edge: Execute without generating a query shows helpful message', async () => {
    await qp.clickExecute();
    // executeQuery sets resultData.textContent when no query is present
    const resultText = await page.locator('#result-data').textContent();
    expect(resultText).toBe('Please generate a query first');
  });

  test('Edge: Save plan when no execution plan exists triggers alert and does not add plan', async () => {
    // Fresh page - clicking save plan will cause an alert "No execution plan to save"
    const beforeSaved = await qp.getSavedPlansLength();
    await qp.clickSavePlan();

    // Last dialog message should contain the "No execution plan" alert
    const lastMsg = dialogMessages[dialogMessages.length - 1];
    expect(lastMsg).toContain('No execution plan to save');

    // Ensure no new plan was added
    const afterSaved = await qp.getSavedPlansLength();
    expect(afterSaved).toBe(beforeSaved);
  });

  test('Edge: Compare plans with fewer than 2 saved plans shows guidance', async () => {
    // Ensure there are zero saved plans (fresh page) and click Compare Plans
    const savedLen = await qp.getSavedPlansLength();
    expect(savedLen).toBe(0);

    await qp.clickComparePlans();
    const comparison = await qp.getPlanComparisonText();
    expect(comparison).toBe('Need at least 2 saved plans to compare');
  });

  test('Edge: Analyze without query displays a prompt', async () => {
    // Fresh page - no query generated
    await qp.clickAnalyze();
    const recs = await qp.getIndexRecommendationsText();
    expect(recs).toBe('Please generate a query first');
  });
});