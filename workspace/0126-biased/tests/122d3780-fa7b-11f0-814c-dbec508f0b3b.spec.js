import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122d3780-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object Model for the Query Optimization page
class QueryPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = "button[onclick='start()']";
    this.resetBtn = "button[onclick='reset()']";
    this.saveBtn = "button[onclick='save()']";
    this.clearBtn = "button[onclick='clear()']";
    this.queryInput = 'input#query';
    this.conditionInput = 'input#condition';
    this.filterInput = 'input#filter';
    this.sortSelect = 'select#sort';
    this.results = '#results';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setInputs({ query = '', condition = '', filter = '', sort = 'asc' } = {}) {
    await this.page.fill(this.queryInput, query);
    await this.page.fill(this.conditionInput, condition);
    await this.page.fill(this.filterInput, filter);
    await this.page.selectOption(this.sortSelect, sort);
  }

  async clickStart() {
    await this.page.click(this.startBtn);
  }

  async clickReset() {
    await this.page.click(this.resetBtn);
  }

  async clickSave() {
    await this.page.click(this.saveBtn);
  }

  async clickClear() {
    await this.page.click(this.clearBtn);
  }

  async getResultsText() {
    return (await this.page.locator(this.results).innerText()).trim();
  }

  async getResultsColor() {
    // computed style is more reliable than inline style reading
    return await this.page.locator(this.results).evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
  }

  async getInputValues() {
    const query = await this.page.inputValue(this.queryInput);
    const condition = await this.page.inputValue(this.conditionInput);
    const filter = await this.page.inputValue(this.filterInput);
    const sort = await this.page.$eval(this.sortSelect, (s) => s.value);
    return { query, condition, filter, sort };
  }
}

test.describe('Query Optimization FSM - 122d3780-fa7b-11f0-814c-dbec508f0b3b', () => {
  // Collect console messages and page errors for each test so we can assert on them.
  let pageErrors;
  let consoleErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // capture uncaught exceptions from the page
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      const type = msg.type(); // e.g., 'log', 'error', 'warning'
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });
  });

  test('Initial render: buttons, inputs and empty results are present (S0_Idle)', async ({ page }) => {
    // This test validates the Idle state entry: renderPage() equivalent => UI elements available.
    const qp = new QueryPage(page);
    await qp.goto();

    // Verify presence of controls
    await expect(page.locator(qp.startBtn)).toBeVisible();
    await expect(page.locator(qp.resetBtn)).toBeVisible();
    await expect(page.locator(qp.saveBtn)).toBeVisible();
    await expect(page.locator(qp.clearBtn)).toBeVisible();

    // Verify inputs exist and are empty by default
    const inputs = await qp.getInputValues();
    expect(inputs.query).toBe('');
    expect(inputs.condition).toBe('');
    expect(inputs.filter).toBe('');
    // sort has a default (app sets value on load), assert it is present (asc or desc)
    expect(['asc', 'desc']).toContain(inputs.sort);

    // Results should be empty at initial render
    const resultsText = await qp.getResultsText();
    expect(resultsText).toBe('');

    // Ensure no unexpected page errors or console.error messages were emitted during load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Start without resetting uses initial (empty) variables and updates results after 1s (S0 -> S1_Optimizing)', async ({ page }) => {
    // This test validates the transition from Idle to Optimizing by clicking Start
    // when the page variables were initialized at load (empty). According to implementation,
    // start() uses the captured variables at script load time.
    const qp = new QueryPage(page);
    await qp.goto();

    // Click Start and wait for the asynchronous update (1 second delay in implementation)
    await qp.clickStart();

    // Wait for expected result string that reflects empty initial variables
    await page.waitForFunction(() => {
      const el = document.getElementById('results');
      return el && el.innerText.includes('Optimized Query:') && el.style.color === 'green';
    }, { timeout: 2000 });

    const resultsText = await qp.getResultsText();
    // The expected string when variables are empty:
    expect(resultsText).toBe('Optimized Query:  with  and  applied. Sorting: ');

    const color = await qp.getResultsColor();
    // CSS color for 'green' may resolve to rgb form
    expect(color).toBeTruthy();
    expect(color).toMatch(/rgb\(|rgba\(|green/);

    // No uncaught page errors expected
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Reset reads current inputs, updates variables and results immediately (S0 Idle -> S0 Idle via ResetFields)', async ({ page }) => {
    // This test validates that reset() updates the internal variables from the DOM
    // and updates the results immediately.
    const qp = new QueryPage(page);
    await qp.goto();

    // Change input fields to custom values
    await qp.setInputs({
      query: 'SELECT * FROM users',
      condition: 'age > 21',
      filter: 'active = 1',
      sort: 'desc'
    });

    // Click Reset which reads the DOM values into the script variables and writes results
    await qp.clickReset();

    // Results should reflect the newly read values and color black
    const expected = 'Optimized Query: SELECT * FROM users with age > 21 and active = 1 applied. Sorting: desc';
    const resultsText = await qp.getResultsText();
    expect(resultsText).toBe(expected);

    const color = await qp.getResultsColor();
    // black could be rgb(0, 0, 0) or 'black'
    expect(color).toMatch(/rgb\(|rgba\(|black/);

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Start after Reset uses updated variables (S0 -> S1_Optimizing) and updates results in green', async ({ page }) => {
    // Ensure the sequence reset() then start() produces the optimized message using updated variables.
    const qp = new QueryPage(page);
    await qp.goto();

    // Provide inputs and call reset to capture them into the page-scoped variables
    await qp.setInputs({
      query: 'SELECT id',
      condition: 'status = "ok"',
      filter: 'region = "us"',
      sort: 'asc'
    });
    await qp.clickReset();

    // Now click Start which should use the variables set by reset()
    await qp.clickStart();

    // Wait for the asynchronous update
    await page.waitForFunction(() => {
      const el = document.getElementById('results');
      return el && el.innerText.includes('Optimized Query:') && el.style.color === 'green';
    }, { timeout: 2000 });

    const resultsText = await qp.getResultsText();
    const expected = 'Optimized Query: SELECT id with status = "ok" and region = "us" applied. Sorting: asc';
    expect(resultsText).toBe(expected);

    const color = await qp.getResultsColor();
    expect(color).toMatch(/rgb\(|rgba\(|green/);

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Save persists current variables into results as "Saved Query" (S0 -> S2_Saved)', async ({ page }) => {
    // This test validates save() behavior in the current app state. save() uses the page variables,
    // which need to be updated via reset() if inputs have changed.
    const qp = new QueryPage(page);
    await qp.goto();

    // Set inputs and reset to ensure variables are captured
    await qp.setInputs({
      query: 'SELECT name',
      condition: 'country="CA"',
      filter: 'subscribed=1',
      sort: 'desc'
    });
    await qp.clickReset();

    // Click Save - save() synchronously writes the "Saved Query: ..." string
    await qp.clickSave();

    const resultsText = await qp.getResultsText();
    const expected = 'Saved Query: SELECT name with country="CA" and subscribed=1 applied. Sorting: desc';
    expect(resultsText).toBe(expected);

    const color = await qp.getResultsColor();
    expect(color).toMatch(/rgb\(|rgba\(|green/);

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Clear empties inputs and variables and updates results accordingly (S0 -> S3_Cleared)', async ({ page }) => {
    // This test validates that clear() both clears the DOM inputs and sets internal variables to empty,
    // and updates the results text to show empty values.
    const qp = new QueryPage(page);
    await qp.goto();

    // Pre-fill inputs and reset to load those values into variables
    await qp.setInputs({
      query: 'TO_BE_CLEARED',
      condition: 'COND',
      filter: 'FLT',
      sort: 'asc'
    });
    await qp.clickReset();

    // Now click Clear
    await qp.clickClear();

    // Inputs should be empty in the DOM
    const inputs = await qp.getInputValues();
    expect(inputs.query).toBe('');
    expect(inputs.condition).toBe('');
    expect(inputs.filter).toBe('');
    // Note: the select may have its value set to empty string by clear() in the implementation
    expect(inputs.sort).toBe('');

    // Results should reflect cleared variables
    const resultsText = await qp.getResultsText();
    expect(resultsText).toBe('Optimized Query:  with  and  applied. Sorting: ');

    const color = await qp.getResultsColor();
    expect(color).toMatch(/rgb\(|rgba\(|black/);

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: Changing inputs but not calling reset() -> save/start use stale variables', async ({ page }) => {
    // This test validates an important edge case: the implementation captures variables at load
    // and only updates them when reset() or clear() are called. We ensure that save/start do not
    // pick up input changes unless reset() was invoked.
    const qp = new QueryPage(page);
    await qp.goto();

    // Ensure variables start empty by directly saving without changes
    await qp.clickSave();
    const savedInitially = await qp.getResultsText();
    expect(savedInitially).toBe('Saved Query:  with  and  applied. Sorting: ');

    // Now change DOM inputs but do NOT call reset()
    await qp.setInputs({
      query: 'WILL_NOT_BE_SAVED',
      condition: 'WILL_NOT_BE_SAVED_COND',
      filter: 'WILL_NOT_BE_SAVED_FILTER',
      sort: 'desc'
    });

    // Directly click Save without resetting -> implementation will use stale variables
    await qp.clickSave();
    const savedAfterInputChange = await qp.getResultsText();

    // The saved text should still reflect the previous variables (which were empty or previous state),
    // and NOT the newly typed values, demonstrating the edge-case behavior.
    // We assert that the newly typed query string does NOT appear in the saved results.
    expect(savedAfterInputChange).not.toContain('WILL_NOT_BE_SAVED');
    expect(savedAfterInputChange).not.toContain('WILL_NOT_BE_SAVED_COND');
    expect(savedAfterInputChange).not.toContain('WILL_NOT_BE_SAVED_FILTER');

    // For completeness, show that reset() will pick up those values
    await qp.clickReset();
    const afterReset = await qp.getResultsText();
    expect(afterReset).toContain('WILL_NOT_BE_SAVED');

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Multiple interactions sequence - ensure stable behavior and no uncaught exceptions', async ({ page }) => {
    // This test performs a sequence of interactions to validate stability:
    // Reset -> Start -> Save -> Clear -> Start (after clear)
    const qp = new QueryPage(page);
    await qp.goto();

    // Prepare values and capture them
    await qp.setInputs({
      query: 'SEQ_QUERY',
      condition: 'SEQ_COND',
      filter: 'SEQ_FILTER',
      sort: 'asc'
    });
    await qp.clickReset();

    // Start optimization (async)
    await qp.clickStart();
    await page.waitForFunction(() => {
      const el = document.getElementById('results');
      return el && el.innerText.includes('Optimized Query') && el.style.color === 'green';
    }, { timeout: 2000 });

    // Save the optimized result
    await qp.clickSave();
    let r = await qp.getResultsText();
    expect(r).toContain('Saved Query: SEQ_QUERY');

    // Clear everything
    await qp.clickClear();
    const inputsAfterClear = await qp.getInputValues();
    expect(inputsAfterClear.query).toBe('');
    expect(inputsAfterClear.condition).toBe('');
    expect(inputsAfterClear.filter).toBe('');
    expect(inputsAfterClear.sort).toBe('');

    // Start after clear - should use cleared variables (empty) and set color green
    await qp.clickStart();
    await page.waitForFunction(() => {
      const el = document.getElementById('results');
      return el && el.innerText.includes('Optimized Query:') && el.style.color === 'green';
    }, { timeout: 2000 });

    const finalResults = await qp.getResultsText();
    expect(finalResults).toBe('Optimized Query:  with  and  applied. Sorting: ');

    // Ensure no uncaught page errors occurred throughout the complex sequence
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});