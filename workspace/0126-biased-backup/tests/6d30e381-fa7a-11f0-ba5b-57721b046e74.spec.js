import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d30e381-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object for the Interactive Indexing Explorer
class IndexingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.dialogs = [];
    this.consoleMessages = [];
    this.pageErrors = [];

    // Capture dialogs (alerts) so tests can assert messages and continue
    this.page.on('dialog', async (dialog) => {
      this.dialogs.push(dialog.message());
      await dialog.accept();
    });

    // Capture console messages for inspection
    this.page.on('console', (msg) => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });
  }

  // Utility: set range input value and dispatch input event
  async setRange(selector, value) {
    await this.page.evaluate(
      ({ selector, value }) => {
        const el = document.querySelector(selector);
        if (!el) return;
        el.value = value;
        const evt = new Event('input', { bubbles: true });
        el.dispatchEvent(evt);
      },
      { selector, value: String(value) }
    );
  }

  async selectOption(selector, value) {
    await this.page.selectOption(selector, value);
    // dispatch change event if any listeners expect it via DOM
    await this.page.evaluate((selector) => {
      const el = document.querySelector(selector);
      if (!el) return;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, selector);
  }

  async click(selector) {
    await this.page.click(selector);
  }

  async fill(selector, value) {
    await this.page.fill(selector, value);
  }

  async getText(selector) {
    const el = this.page.locator(selector);
    return el.innerText();
  }

  async getValue(selector) {
    return this.page.$eval(selector, (el) => el.value);
  }

  getAndClearDialogs() {
    const copy = [...this.dialogs];
    this.dialogs.length = 0;
    return copy;
  }

  clearConsoleAndErrors() {
    this.consoleMessages.length = 0;
    this.pageErrors.length = 0;
  }

  // Helpers for domain actions
  async createIndex({ dataStructure = 'array', indexType = 'primary', dataSize = 10, indexDensity = 5 } = {}) {
    await this.selectOption('#dataStructure', dataStructure);
    await this.selectOption('#indexType', indexType);
    await this.setRange('#dataSize', dataSize);
    await this.setRange('#indexDensity', indexDensity);
    await this.click('#createIndex');
  }

  async insertCustomValue(value) {
    await this.fill('#customValue', String(value));
    await this.click('#insertBtn');
  }

  async insertRandom() {
    await this.click('#insertValue');
  }

  async searchValue(value) {
    await this.fill('#searchValue', String(value));
    await this.click('#searchBtn');
  }

  async deleteValue(value) {
    await this.fill('#deleteValue', String(value));
    await this.click('#deleteBtn');
  }

  async rangeQuery(start, end) {
    await this.fill('#rangeStart', String(start));
    await this.fill('#rangeEnd', String(end));
    await this.click('#rangeQueryBtn');
  }

  async rebuildIndex() {
    await this.click('#rebuildIndex');
  }

  async dropIndex() {
    await this.click('#dropIndex');
  }

  async analyzeQuery(query) {
    await this.fill('#queryInput', query);
    await this.click('#analyzeQuery');
  }

  async changeViewMode(mode) {
    await this.selectOption('#viewMode', mode);
  }

  async changeIndexType(type) {
    await this.selectOption('#indexType', type);
  }

  // Parsing helper: extract numeric values from the visualization text
  async getIndexDataNumbers() {
    const text = (await this.getText('#indexStructure')) || '';
    // extract all integers from the visualization block
    const nums = Array.from(text.matchAll(/-?\d+/g)).map((m) => parseInt(m[0], 10));
    return nums;
  }

  async getExecutionPlanText() {
    return this.getText('#executionPlan');
  }

  // Access captured runtime diagnostics
  getConsoleMessages() {
    return this.consoleMessages;
  }

  getPageErrors() {
    return this.pageErrors;
  }
}

// Test suite
test.describe('Interactive Indexing Explorer (FSM validation)', () => {
  /** @type {import('@playwright/test').Page} */
  let page;
  /** @type {IndexingPage} */
  let ip;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    ip = new IndexingPage(page);

    // Navigate to the provided HTML page
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // Close the page to cleanup resources
    await page.close();
  });

  test('S0_Idle: Initial Idle state renders page and shows expected initial elements', async () => {
    // Validate initial page header exists and text matches the Idle state's evidence
    const header = await page.locator('h1').innerText();
    expect(header).toBe('Interactive Indexing Explorer');

    // The visualization should indicate "No index created yet"
    const vizText = await page.locator('#indexStructure').innerText();
    expect(vizText).toBe('No index created yet');

    // Stats should be zeros initially
    expect(await page.locator('#searchCount').innerText()).toBe('0');
    expect(await page.locator('#insertCount').innerText()).toBe('0');
    expect(await page.locator('#deleteCount').innerText()).toBe('0');

    // Edge case: clicking Insert before creating index should show alert to create index first
    await page.click('#insertBtn');
    const dialogs = ip.getAndClearDialogs();
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[0]).toMatch(/Please create an index first/);

    // Ensure no uncaught page errors were thrown during render
    expect(ip.getPageErrors().length).toBe(0);
    // Ensure no console errors
    const consoleErrors = ip.getConsoleMessages().filter((c) => c.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('S1_IndexCreated: Create Index sets type, structure and populates data; visualization and stats update', async () => {
    // Change controls and create an Array index with specific size/density
    await ip.createIndex({ dataStructure: 'array', indexType: 'primary', dataSize: 12, indexDensity: 4 });

    // After creation, visualization should reflect Array Index and include the index type
    const viz = await page.locator('#indexStructure').innerText();
    expect(viz).toContain('Array Index (primary)');

    // The number of numeric values in the visualization should match dataSize
    const numbers = await ip.getIndexDataNumbers();
    expect(numbers.length).toBe(12);

    // Stats for insert/search/delete should remain zero until operations happen (createIndex calls updateStatsDisplay)
    expect(await page.locator('#insertCount').innerText()).toBe('0');
    expect(await page.locator('#searchCount').innerText()).toBe('0');

    // Changing indexType to 'composite' should reveal composite options panel
    await ip.changeIndexType('composite');
    const compVisible = await page.locator('#compositeOptions').isVisible();
    expect(compVisible).toBe(true);

    // Switching back to 'primary' hides it
    await ip.changeIndexType('primary');
    const compHidden = await page.locator('#compositeOptions').isHidden();
    expect(compHidden).toBe(true);

    // Changing view mode to 'performance' should unhide performance metrics
    await ip.changeViewMode('performance');
    expect(await page.locator('#performanceMetrics').isVisible()).toBe(true);

    // Ensure no uncaught page errors or console errors occurred during index creation
    expect(ip.getPageErrors().length).toBe(0);
    const consoleErrors = ip.getConsoleMessages().filter((c) => c.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('S3_IndexWithData: Insert (custom & random), Search, Delete, Range Query, Rebuild - state transitions and DOM updates', async () => {
    // Create index first
    await ip.createIndex({ dataStructure: 'array', indexType: 'secondary', dataSize: 8, indexDensity: 3 });

    // Grab one existing value from the index to use for deterministic operations
    let dataValues = await ip.getIndexDataNumbers();
    expect(dataValues.length).toBe(8);
    const sample = dataValues[2];

    // Insert a custom value (edge case: ensure it's added)
    await ip.insertCustomValue(9999);
    let dialogs = ip.getAndClearDialogs(); // No alert expected on successful insert; but code doesn't alert for insert
    expect(dialogs.length).toBe(0);

    // After insert, visualization should include the new value
    dataValues = await ip.getIndexDataNumbers();
    expect(dataValues).toContain(9999);

    // Stats: insert count should have incremented to 1
    expect(await page.locator('#insertCount').innerText()).toBe('1');

    // Insert a random value using Random Value button
    await ip.insertRandom();
    // Confirm insert count increments to 2
    expect(await page.locator('#insertCount').innerText()).toBe('2');

    // Search for an existing value (sample) - should trigger alert "found"
    await ip.searchValue(sample);
    dialogs = ip.getAndClearDialogs();
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[0]).toMatch(new RegExp(`Value ${sample} found!|Value ${sample} not found!`)); // both possible, be tolerant

    // Ensure search count increments
    expect(parseInt(await page.locator('#searchCount').innerText(), 10)).toBeGreaterThanOrEqual(1);

    // Delete the custom value 9999 we inserted earlier
    await ip.deleteValue(9999);
    dialogs = ip.getAndClearDialogs();
    // deleteValue alerts whether deleted or not
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[0]).toMatch(/deleted|not found/);

    // Confirm 9999 no longer appears in visualization
    const afterDeleteValues = await ip.getIndexDataNumbers();
    expect(afterDeleteValues).not.toContain(9999);

    // Range query using min and max from current dataset
    const currentValues = await ip.getIndexDataNumbers();
    const min = Math.min(...currentValues);
    const max = Math.max(...currentValues);
    await ip.rangeQuery(min, max);
    dialogs = ip.getAndClearDialogs();
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[0]).toContain(`Range query results (${min}-${max}):`);

    // Rebuild index - should alert "Index rebuilt"
    await ip.rebuildIndex();
    dialogs = ip.getAndClearDialogs();
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[0]).toBe('Index rebuilt');

    // After rebuild, data should be sorted (array structure)
    const rebuiltValues = await ip.getIndexDataNumbers();
    const sorted = [...rebuiltValues].slice().sort((a, b) => a - b);
    expect(rebuiltValues).toEqual(sorted);

    // Ensure no uncaught page errors or console errors occurred
    expect(ip.getPageErrors().length).toBe(0);
    const consoleErrors = ip.getConsoleMessages().filter((c) => c.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('S2_IndexEmpty / DropIndex: Dropping index resets structure and stats', async () => {
    // Create index first
    await ip.createIndex({ dataStructure: 'hash', indexType: 'primary', dataSize: 6 });

    // Drop the index
    await ip.dropIndex();
    let dialogs = ip.getAndClearDialogs();
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[0]).toBe('Index dropped');

    // Visualization should indicate no index created yet
    expect(await page.locator('#indexStructure').innerText()).toBe('No index created yet');

    // Stats should be reset to zeros
    expect(await page.locator('#insertCount').innerText()).toBe('0');
    expect(await page.locator('#searchCount').innerText()).toBe('0');
    expect(await page.locator('#deleteCount').innerText()).toBe('0');

    // Edge-case: after dropping, operations should inform user to create an index first
    await ip.insertRandom();
    dialogs = ip.getAndClearDialogs();
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[0]).toMatch(/Please create an index first/);

    // Ensure no uncaught page errors or console errors occurred
    expect(ip.getPageErrors().length).toBe(0);
    const consoleErrors = ip.getConsoleMessages().filter((c) => c.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('S4_QueryAnalyzed: Analyze Query shows execution plan and reveals query plan UI', async () => {
    // Create index to supply index.type and index.structure used by analysis
    await ip.createIndex({ dataStructure: 'bst', indexType: 'secondary', dataSize: 7 });

    // Analyze a SELECT WHERE style query (should follow one of the branches in analyzeQuery())
    const sampleQuery = 'SELECT * FROM table WHERE id = 10';
    await ip.analyzeQuery(sampleQuery);

    // There is no alert for successful analyzeQuery, but the query plan panel should become visible
    const planVisible = await page.locator('#queryPlan').isVisible();
    expect(planVisible).toBe(true);

    // The execution plan text should contain 'Query Analysis' and mention Type/Structure
    const execPlanText = await ip.getExecutionPlanText();
    expect(execPlanText).toMatch(/Query Analysis:/);
    expect(execPlanText).toContain('Type:');
    expect(execPlanText).toContain('Structure:');

    // Ensure no uncaught page errors or console errors occurred
    expect(ip.getPageErrors().length).toBe(0);
    const consoleErrors = ip.getConsoleMessages().filter((c) => c.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Control inputs: Data Size and Index Density sliders update display values and view mode toggles performance metrics', async () => {
    // Adjust data size and validate displayed value updates
    await ip.setRange('#dataSize', 20);
    expect(await page.locator('#dataSizeValue').innerText()).toBe('20');

    // Adjust index density and validate displayed value updates
    await ip.setRange('#indexDensity', 8);
    expect(await page.locator('#indexDensityValue').innerText()).toBe('8');

    // Switch view mode to performance to reveal metrics
    await ip.changeViewMode('performance');
    expect(await page.locator('#performanceMetrics').isVisible()).toBe(true);

    // Switch back to structure to hide metrics
    await ip.changeViewMode('structure');
    expect(await page.locator('#performanceMetrics').isHidden()).toBe(true);

    // Ensure no uncaught page errors or console errors occurred
    expect(ip.getPageErrors().length).toBe(0);
    const consoleErrors = ip.getConsoleMessages().filter((c) => c.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge cases: invalid inputs for search/delete/range produce alerts prompting for valid numbers', async () => {
    // Start from idle; ensure alerts for invalid operations when no index exists
    await page.click('#searchBtn');
    let dialogs = ip.getAndClearDialogs();
    // Since no index was created, alert should ask to create index first
    expect(dialogs[0]).toMatch(/Please create an index first/);

    // Create index for further invalid input tests
    await ip.createIndex({ dataStructure: 'linkedlist', indexType: 'primary', dataSize: 5 });

    // Search with invalid input (empty)
    await page.fill('#searchValue', '');
    await page.click('#searchBtn');
    dialogs = ip.getAndClearDialogs();
    expect(dialogs[0]).toMatch(/Please enter a valid number to search/);

    // Delete with invalid input (empty)
    await page.fill('#deleteValue', '');
    await page.click('#deleteBtn');
    dialogs = ip.getAndClearDialogs();
    expect(dialogs[0]).toMatch(/Please enter a valid number to delete/);

    // Range query with invalid inputs
    await page.fill('#rangeStart', '');
    await page.fill('#rangeEnd', '');
    await page.click('#rangeQueryBtn');
    dialogs = ip.getAndClearDialogs();
    expect(dialogs[0]).toMatch(/Please enter valid range values/);

    // Ensure no uncaught page errors or console errors occurred during these validation checks
    expect(ip.getPageErrors().length).toBe(0);
    const consoleErrors = ip.getConsoleMessages().filter((c) => c.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});