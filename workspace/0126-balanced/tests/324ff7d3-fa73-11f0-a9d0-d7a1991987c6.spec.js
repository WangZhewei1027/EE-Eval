import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324ff7d3-fa73-11f0-a9d0-d7a1991987c6.html';

// Page object to encapsulate interactions and queries against the demo app
class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator('#run');
    this.modelSummary = page.locator('#modelSummary');
    this.chart = page.locator('#chart');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickRun(options) {
    await this.runButton.click(options);
  }

  async getModelSummaryText() {
    return (await this.modelSummary.innerText()).trim();
  }

  async hasCanvas() {
    return await this.chart.locator('canvas').count() > 0;
  }

  async getCanvasElement() {
    const count = await this.chart.locator('canvas').count();
    if (count === 0) return null;
    return this.chart.locator('canvas').first();
  }

  // Parse predictions array from the model summary text.
  // Returns an array of trimmed entries, or null if not found.
  async parsePredictionsFromSummary() {
    const text = await this.getModelSummaryText();
    // Find the bracketed list after "Predictions:"
    const match = text.match(/Predictions:\s*\[([\s\S]*)\]/);
    if (!match || !match[1]) return null;
    const content = match[1].trim();
    if (content === '') return [];
    return content.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }
}

test.describe('Random Forest Demonstration - FSM tests', () => {
  // Basic smoke test validating the Idle state renders expected elements
  test('Idle state: Run button visible, empty model summary, no chart drawn', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();

    // The Run button must be visible (Idle state evidence)
    await expect(app.runButton).toBeVisible();

    // The model summary should be empty initially (no simulation run yet)
    const summaryText = await app.getModelSummaryText();
    // Allow whitespace-only content but treat that as empty
    expect(summaryText.replace(/\s+/g, '')).toBe('');

    // The chart container should not have a canvas before running
    const hasCanvasBefore = await app.hasCanvas();
    expect(hasCanvasBefore).toBeFalsy();
  });

  test('RunSimulation event transitions to SimulationRunning: model summary and chart are produced', async ({ page }) => {
    const app = new AppPage(page);

    // Capture console messages and page errors for later assertions
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await app.goto();

    // Click the Run button to trigger the FSM transition
    await app.clickRun();

    // Wait for modelSummary to be populated
    await expect(app.modelSummary).toHaveText(/Number of Trees:/, { timeout: 5000 });

    // Validate model summary mentions the expected number of trees (onEnter action used nTrees=10)
    const summaryText = await app.getModelSummaryText();
    expect(summaryText).toContain('Number of Trees: 10');

    // Parse predictions and ensure the number of predictions matches the data length (200 points)
    const predictions = await app.parsePredictionsFromSummary();
    expect(predictions).not.toBeNull();
    // There should be 200 predictions (2 pushed per iteration for i in 0..99 => 200)
    expect(predictions.length).toBe(200);

    // Validate a canvas was drawn in the chart container with expected size attributes
    const canvas = await app.getCanvasElement();
    expect(canvas).not.toBeNull();
    const width = await canvas.getAttribute('width');
    const height = await canvas.getAttribute('height');
    expect(Number(width)).toBe(400);
    expect(Number(height)).toBe(400);

    // Ensure no uncaught page errors occurred during the run
    expect(pageErrors.length).toBe(0);

    // Optionally assert that console did not produce error-level logs (info or debug are allowed)
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleEntries.length).toBe(0);
  });

  test('Repeated runs: chart is replaced and model summary updates on each Run click', async ({ page }) => {
    const app = new AppPage(page);

    // Track page errors to ensure none occur during repeated interactions
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    await app.goto();

    // First run
    await app.clickRun();
    await expect(app.modelSummary).toHaveText(/Number of Trees:/, { timeout: 5000 });
    const firstSummary = await app.getModelSummaryText();
    const firstCanvasCount = await app.chart.locator('canvas').count();
    expect(firstCanvasCount).toBe(1);

    // Second run - should replace the old chart and update the summary
    await app.clickRun();
    // Wait for the model summary element to change content (avoid false positive by waiting)
    await expect(app.modelSummary).not.toHaveText(firstSummary, { timeout: 5000 });

    const secondSummary = await app.getModelSummaryText();
    expect(secondSummary).toContain('Number of Trees: 10');
    const secondCanvasCount = await app.chart.locator('canvas').count();
    // The implementation clears #chart before drawing, so we expect exactly one canvas after the run
    expect(secondCanvasCount).toBe(1);

    // Validate predictions count still matches expected data length after second run
    const predictions = await app.parsePredictionsFromSummary();
    expect(predictions.length).toBe(200);

    // No uncaught page errors should have occurred
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: rapid double-click should still result in one chart and valid model summary', async ({ page }) => {
    const app = new AppPage(page);

    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    await app.goto();

    // Simulate rapid double-clicks
    await Promise.all([
      app.runButton.click(),
      app.runButton.click()
    ]);

    // Ensure model summary appears and contains expected information
    await expect(app.modelSummary).toHaveText(/Number of Trees:/, { timeout: 5000 });
    const summaryText = await app.getModelSummaryText();
    expect(summaryText).toContain('Number of Trees: 10');

    // Chart should contain exactly one canvas (the drawChart function clears previous content)
    const canvasCount = await app.chart.locator('canvas').count();
    expect(canvasCount).toBe(1);

    // Predictions should still be complete
    const predictions = await app.parsePredictionsFromSummary();
    expect(predictions.length).toBe(200);

    // No runtime page errors observed
    expect(pageErrors.length).toBe(0);
  });

  test('Observability: capture console and page errors while loading and interacting', async ({ page }) => {
    const app = new AppPage(page);

    // Collect console messages and page errors
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    await app.goto();

    // There should be no page errors right after load
    expect(pageErrors.length).toBe(0);

    // Interact with the page to trigger main flow
    await app.clickRun();
    await expect(app.modelSummary).toHaveText(/Number of Trees:/, { timeout: 5000 });

    // After a normal run, assert there were no uncaught runtime exceptions
    expect(pageErrors.length).toBe(0);

    // If any console messages exist, they should not be of type 'error' (the page does not intentionally log errors)
    const errorConsoles = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoles.length).toBe(0);
  });
});