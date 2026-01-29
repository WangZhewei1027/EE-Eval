import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3c9cf1-fa74-11f0-a1b6-4b9b8151441a.html';

// Page object to encapsulate interactions with the app.
class NPCompletenessPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.solveSATBtn = page.locator("button[onclick='solveSAT()']");
    this.generateTSPBtn = page.locator("button[onclick='generateTSP()']");
    this.solveTSPBtn = page.locator('#solveTSPBtn');
    this.tspCitiesInput = page.locator('input#tspCities');
    this.satResult = page.locator('#satResult');
    this.tspResult = page.locator('#tspResult');
    this.satVisualization = page.locator('#satVisualization');
    this.tspVisualization = page.locator('#tspVisualization');
    this.header = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickSolveSAT() {
    await this.solveSATBtn.click();
  }

  async clickGenerateTSP() {
    await this.generateTSPBtn.click();
  }

  async clickSolveTSP() {
    await this.solveTSPBtn.click();
  }

  async setTspCities(value) {
    await this.tspCitiesInput.fill(String(value));
    // blur to ensure any change is registered
    await this.tspCitiesInput.press('Tab');
  }

  async getSolveTSPBtnDisplay() {
    return this.solveTSPBtn.evaluate((el) => getComputedStyle(el).display);
  }

  async getSatResultDisplay() {
    return this.satResult.evaluate((el) => getComputedStyle(el).display);
  }

  async getTspResultDisplay() {
    return this.tspResult.evaluate((el) => getComputedStyle(el).display);
  }
}

// Group tests by feature/topic per requirements
test.describe('NP-Completeness Interactive App (de3c9cf1-fa74-11f0-a1b6-4b9b8151441a)', () => {
  // Arrays to collect console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  // Setup and teardown for each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      // store the Error object for assertions
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // No special teardown required; but keep this block for clarity and possible future cleanup.
  });

  test('Initial load: should render the page and perform onload entry actions', async ({ page }) => {
    // This test validates the S0_Idle entry (renderPage()), and the fact that window.onload triggers
    // solveSAT() and generateTSP() per the implementation.
    const app = new NPCompletenessPage(page);
    await app.goto();

    // Validate the main header exists - evidence for S0_Idle
    await expect(app.header).toHaveText('Understanding NP-Completeness');

    // Because window.onload calls solveSAT() and generateTSP(), we expect:
    // - SAT result to be displayed
    // - TSP visualization created and solve button shown
    await expect(app.satResult).toBeVisible();
    const satText = await app.satResult.innerText();
    expect(satText).toContain('Possible solutions for (A ∨ B) ∧ (¬A ∨ C):');
    expect(satText).toContain('Complexity: This is an NP-Complete problem');

    // TSP generate was called onload with default value 4 -> solve button should be visible
    await expect(app.solveTSPBtn).toBeVisible();
    const solveBtnDisplay = await app.getSolveTSPBtnDisplay();
    expect(['inline-block', 'block']).toContain(solveBtnDisplay);

    // TSP visualization should contain nodes (cities). They are placed inside #tspVisualization
    const tspNodes = await page.locator('#tspVisualization .node').count();
    expect(tspNodes).toBeGreaterThanOrEqual(1);

    // Verify no uncaught page errors occurred during load
    expect(pageErrors.length).toBe(0);

    // Also ensure console didn't log any error-level messages
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test.describe('SAT interactions and state transition (S0 -> S1)', () => {
    test('Clicking "Find Solution" displays SAT solutions and visualization', async ({ page }) => {
      // This test validates the SolveSAT event and transition to S1_SAT_Solved.
      const app = new NPCompletenessPage(page);
      await app.goto();

      // Clear SAT result so we can observe the effect of clicking
      // Note: we must not alter page internals beyond interacting with UI, so we'll hide it by clicking (call function)
      // Clicking the button should (re)display satResult and render visualization
      // First, ensure satResult visible from onload
      await expect(app.satResult).toBeVisible();

      // Click the SolveSAT button to trigger the event handler explicitly
      await app.clickSolveSAT();

      // Verify satResult is visible and contains expected content
      await expect(app.satResult).toBeVisible();
      const satInner = await app.satResult.innerHTML();
      expect(satInner).toContain('Possible solutions for (A ∨ B) ∧ (¬A ∨ C):');
      expect(satInner).toContain('A = true');
      expect(satInner).toContain('Complexity: This is an NP-Complete problem');

      // Verify that the SAT visualization was injected into the DOM
      await expect(app.satVisualization).not.toBeEmpty();
      const satVisHtml = await app.satVisualization.innerHTML();
      expect(satVisHtml).toContain('node">A');
      expect(satVisHtml).toContain('node">B');

      // Ensure no runtime page errors as a result of clicking the button
      const pageErrorsNow = pageErrors.length;
      expect(pageErrorsNow).toBe(0);

      // No console error messages should have occurred
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
    });
  });

  test.describe('TSP interactions and transitions (S0 -> S2 -> S3) with edge cases', () => {
    test('Generate TSP problem shows visualization, distances table, and reveals solve button', async ({ page }) => {
      // This validates the GenerateTSP event and transition to S2_TSP_Problem_Generated.
      const app = new NPCompletenessPage(page);
      await app.goto();

      // Set number of cities to 5 and generate
      await app.setTspCities(5);
      await app.clickGenerateTSP();

      // After generation, tspResult should be hidden and solve button visible
      expect(await app.getTspResultDisplay()).toBe('none');
      await expect(app.solveTSPBtn).toBeVisible();
      expect(await app.getSolveTSPBtnDisplay()).toMatch(/inline-block|block/);

      // Visualization should contain city nodes equal to the number of cities (5)
      const nodesCount = await page.locator('#tspVisualization .node').count();
      expect(nodesCount).toBeGreaterThanOrEqual(5);

      // Distances table should be present with at least one <table> inside visualization
      const tablesCount = await page.locator('#tspVisualization table').count();
      expect(tablesCount).toBeGreaterThanOrEqual(1);

      // No page errors or console errors
      expect(pageErrors.length).toBe(0);
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
    });

    test('Solve TSP for small problem displays shortest route and distance (S2 -> S3)', async ({ page }) => {
      // This test validates SolveTSP transition from S2_TSP_Problem_Generated to S3_TSP_Solved.
      const app = new NPCompletenessPage(page);
      await app.goto();

      // Use 4 cities (default). Ensure generateTSP has been called by onload; but re-generate to ensure known state.
      await app.setTspCities(4);
      await app.clickGenerateTSP();

      // Now click the Solve button to compute shortest route
      await app.clickSolveTSP();

      // tspResult should be visible and contain expected text
      await expect(app.tspResult).toBeVisible();
      const tspText = await app.tspResult.innerText();
      expect(tspText).toContain('Shortest route found:');
      expect(tspText).toMatch(/Total distance: \d+/);
      expect(tspText).toContain('Complexity: This brute-force approach checks all');

      // No page errors or console errors
      expect(pageErrors.length).toBe(0);
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
    });

    test('Edge case: generating >7 cities and attempting to solve displays the "too many cities" message', async ({ page }) => {
      // This test validates the guard for large inputs in solveTSP (edge case).
      const app = new NPCompletenessPage(page);
      await app.goto();

      // Set the input to 8 (beyond the demo limit) and generate problem
      // We're intentionally setting a value greater than 7 to trigger the early exit in solveTSP
      await app.setTspCities(8);
      await app.clickGenerateTSP();

      // Solve button should be visible after generation (generateTSP unconditionally shows it)
      await expect(app.solveTSPBtn).toBeVisible();

      // Click Solve - implementation checks numCities > 7 and returns a friendly message
      await app.clickSolveTSP();

      // Expect tspResult visible and containing the "Too many cities" message
      await expect(app.tspResult).toBeVisible();
      const resultText = await app.tspResult.innerText();
      expect(resultText).toContain('Too many cities to solve in this demo');

      // Ensure that no heavy computation crashed the page and no uncaught errors occurred
      expect(pageErrors.length).toBe(0);
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
    });

    test('Edge case: small number of cities (1) should still handle and return a route', async ({ page }) => {
      // This validates behavior when the number of cities is smaller than 2 (input min is 2, but programmatically we can set 1).
      // The application logic should still produce an answer (route and distance 0) rather than crashing.
      const app = new NPCompletenessPage(page);
      await app.goto();

      // Set to 1 and generate
      await app.setTspCities(1);
      await app.clickGenerateTSP();

      // Solve the trivial case
      await app.clickSolveTSP();

      // Expect a result to be shown and a numeric total distance (likely 0)
      await expect(app.tspResult).toBeVisible();
      const text = await app.tspResult.innerText();
      expect(text).toContain('Shortest route found:');
      // For 1 city the route may be "A → A" and distance 0
      expect(text).toMatch(/Total distance: \d+/);

      // No uncaught errors
      expect(pageErrors.length).toBe(0);
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
    });
  });

  test('Observes console and page errors through the lifecycle', async ({ page }) => {
    // This test ensures we observe console messages and page errors and assert their expected absence.
    // It also demonstrates capturing console output while interacting with the app.
    const app = new NPCompletenessPage(page);

    await app.goto();

    // Interact with app to generate additional console activity (if any)
    await app.clickSolveSAT();
    await app.setTspCities(3);
    await app.clickGenerateTSP();
    await app.clickSolveTSP();

    // At this point we expect no uncaught page errors
    expect(pageErrors.length).toBe(0);

    // Inspect collected console messages; ensure none are 'error' level
    const errors = consoleMessages.filter(msg => msg.type === 'error');
    expect(errors.length).toBe(0);

    // It's okay for console to have informational logs or warnings, we assert there are no error-level messages
    // Provide an assertion that at least some console activity was recorded (info/debug), but not required
    // (We won't fail if it's empty; just log presence if available)
    // Final safeguard: ensure critical UI elements remain accessible
    await expect(app.header).toBeVisible();
    await expect(app.solveSATBtn).toBeVisible();
    await expect(app.generateTSPBtn).toBeVisible();
  });
});