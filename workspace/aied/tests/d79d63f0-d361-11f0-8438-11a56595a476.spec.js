import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79d63f0-d361-11f0-8438-11a56595a476.html';

// Page Object for the Floyd-Warshall demo page
class FloydWarshallPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#graphInput');
    this.runBtn = page.locator('#runBtn');
    this.errorDiv = page.locator('#errorMsg');
    this.initialMatrixDiv = page.locator('#initialMatrix');
    this.finalMatrixDiv = page.locator('#finalMatrix');
    this.stepsDiv = page.locator('#steps');
    this.outputSection = page.locator('#outputSection');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickRun() {
    await this.runBtn.click();
  }

  async setInput(text) {
    await this.input.fill(text);
  }

  async initialMatrixHasTable() {
    return await this.initialMatrixDiv.locator('table').count() > 0;
  }

  async finalMatrixHasTable() {
    return await this.finalMatrixDiv.locator('table').count() > 0;
  }

  async getInitialMatrixText() {
    return await this.initialMatrixDiv.textContent();
  }

  async getFinalMatrixText() {
    return await this.finalMatrixDiv.textContent();
  }

  async getStepsText() {
    return await this.stepsDiv.textContent();
  }

  async getErrorText() {
    return await this.errorDiv.textContent();
  }

  async isErrorVisible() {
    return await this.errorDiv.evaluate(el => getComputedStyle(el).display !== 'none');
  }

  async isOutputSectionVisible() {
    return await this.outputSection.evaluate(el => getComputedStyle(el).display !== 'none');
  }
}

test.describe('Floyd-Warshall Algorithm Visualization (d79d63f0-d361-11f0-8438-11a56595a476)', () => {
  // Arrays to collect console events and page errors for assertions
  let consoleEvents;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleEvents = [];
    pageErrors = [];

    // Capture console messages and page errors without modifying the page
    page.on('console', msg => {
      consoleEvents.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the app and wait for load (window.onload triggers runAlgorithm)
    const app = new FloydWarshallPage(page);
    await app.goto();
  });

  // Test the initial idle state S0 and automatic run on page load.
  test('S0 Idle -> S3 ResultsDisplayed: page load triggers initial run and displays matrices and steps', async ({ page }) => {
    const app = new FloydWarshallPage(page);

    // On load, the script calls runAlgorithm (window.onload). Wait for outputs to be rendered.
    await expect(app.initialMatrixDiv.locator('table')).toBeVisible({ timeout: 2000 });
    await expect(app.finalMatrixDiv.locator('table')).toBeVisible({ timeout: 2000 });

    // Steps area should have been populated with algorithm steps
    const stepsText = await app.getStepsText();
    expect(typeof stepsText).toBe('string');
    // Check for at least one "Considering intermediate vertex" step indicating the algorithm ran
    expect(stepsText).toContain('Considering intermediate vertex V0');

    // Verify final matrix contains expected computed shortest distances for the provided example.
    // Expected final distances for the default input:
    // Row0: 0,3,5,6
    // Row1: 5,0,2,3
    // Row2: 3,6,0,1
    // Row3: 2,5,7,0
    const finalText = await app.getFinalMatrixText();
    expect(finalText).toContain('0');
    expect(finalText).toContain('3');
    expect(finalText).toContain('5');
    expect(finalText).toContain('6');
    // Verify some specific rows/values appear in the rendered table text
    expect(finalText.replace(/\s+/g, ' ')).toContain('V0 0 3 5 6');
    expect(finalText.replace(/\s+/g, ' ')).toContain('V1 5 0 2 3');

    // Ensure no uncaught page errors occurred during initial load/run
    expect(pageErrors.length).toBe(0);
    // Ensure no console.error messages were emitted
    const consoleErrors = consoleEvents.filter(e => e.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('S1 AlgorithmRunning transitions and output clearing', () => {
    // Validate that clicking the Run button starts the algorithm (S1 active),
    // and that runAlgorithm clears previous outputs (exit action: clearOutputs()) before execution.
    test('Clicking Run (RunAlgorithm event) re-runs algorithm and clears previous outputs', async ({ page }) => {
      const app = new FloydWarshallPage(page);

      // Ensure initial results are present from load
      await expect(app.finalMatrixDiv.locator('table')).toBeVisible();

      // Modify the input slightly to observe a re-run producing possibly different outputs.
      // Set a matrix with a changed weight between V0->V3 (was 7); set to INF to change result.
      const modifiedInput = `0 3 INF INF
8 0 2 INF
5 INF 0 1
2 INF INF 0`;
      await app.setInput(modifiedInput);

      // Click run - this should clear previous outputs first (clearOutputs inside runAlgorithm)
      // and then attempt to parse and display new matrices.
      await app.clickRun();

      // After clicking, the initialMatrix and finalMatrix should be re-rendered (or in case of error, cleared).
      // Wait to see initial matrix table appear.
      await expect(app.initialMatrixDiv.locator('table')).toBeVisible();

      const finalTextAfterClick = await app.getFinalMatrixText();
      // The final matrix must contain '∞' (rendered as '∞') for INF values in this modified input
      // The code uses '∞' symbol for Infinity in the table.
      expect(finalTextAfterClick.includes('∞') || finalTextAfterClick.includes('INF')).toBeTruthy();

      // Ensure no uncaught page errors and no console.error were emitted
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleEvents.filter(e => e.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('S1 -> S2 (Error state): running with non-square / malformed input shows error and hides outputs', async ({ page }) => {
      const app = new FloydWarshallPage(page);

      // Provide a malformed (non-square) input that should trigger parseMatrix error
      const badInput = `0 1 2
1 0
2 1 0`; // second row has only 2 columns -> should throw
      await app.setInput(badInput);

      // Click run to trigger the error path
      await app.clickRun();

      // The error message div should be visible and contain a descriptive message
      await expect(app.errorDiv).toBeVisible();
      const errText = await app.getErrorText();
      expect(errText).toMatch(/must be square|length/i);

      // The output section should be hidden when an error occurs according to the implementation
      const outputVisible = await app.isOutputSectionVisible();
      expect(outputVisible).toBe(false);

      // Verify that previous outputs were cleared (initialMatrix and finalMatrix should be empty)
      const initialTableCount = await app.initialMatrixDiv.locator('table').count();
      const finalTableCount = await app.finalMatrixDiv.locator('table').count();
      expect(initialTableCount).toBe(0);
      expect(finalTableCount).toBe(0);

      // No uncaught JS runtime errors should have been thrown (the code catches parse exceptions)
      expect(pageErrors.length).toBe(0);

      // Ensure the console did not emit error-level messages (errors are shown in UI, not console)
      const consoleErrs = consoleEvents.filter(e => e.type === 'error');
      expect(consoleErrs.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios (S2 Error state validations)', () => {
    test('Parsing invalid token triggers error message', async ({ page }) => {
      const app = new FloydWarshallPage(page);

      // Provide an input containing an invalid token 'XYZ' which should produce an "Invalid number" error
      const invalidTokenInput = `0 1 2
1 0 XYZ
2 1 0`;
      await app.setInput(invalidTokenInput);
      await app.clickRun();

      await expect(app.errorDiv).toBeVisible();
      const errText = await app.getErrorText();
      expect(errText).toMatch(/Invalid number/i);

      // Output hidden on error
      expect(await app.isOutputSectionVisible()).toBe(false);

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Negative weight triggers explicit negative-weight error and shows error UI', async ({ page }) => {
      const app = new FloydWarshallPage(page);

      // Include a negative weight which the demo explicitly disallows
      const negativeInput = `0 -3 4
-3 0 2
4 2 0`;
      await app.setInput(negativeInput);
      await app.clickRun();

      await expect(app.errorDiv).toBeVisible();
      const errText = await app.getErrorText();
      expect(errText).toMatch(/Negative weights not allowed/i);

      // Ensure outputs are hidden
      expect(await app.isOutputSectionVisible()).toBe(false);

      // No uncaught runtime exceptions surfaced to pageerror
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Rendering details and UI feedback (S3 ResultsDisplayed validations)', () => {
    test('Initial matrix rendering uses ∞ for Infinity and includes headers', async ({ page }) => {
      const app = new FloydWarshallPage(page);

      // Use a matrix with explicit INF tokens and check rendering
      const inputWithINF = `0 INF 4
INF 0 INF
4 INF 0`;
      await app.setInput(inputWithINF);
      await app.clickRun();

      // Initial matrix should render a table with header cells "V0, V1, V2"
      const initialText = await app.getInitialMatrixText();
      expect(initialText).toContain('V0');
      expect(initialText).toContain('V1');
      expect(initialText).toContain('V2');

      // INF cells should be rendered as the '∞' symbol in the table according to matrixToHTML
      // Accept either '∞' symbol or 'INF' string depending on environment rendering; check for symbol first.
      const containsInfinitySymbol = initialText.includes('∞') || initialText.includes('INF');
      expect(containsInfinitySymbol).toBeTruthy();

      // Steps should still contain algorithm messages
      const steps = await app.getStepsText();
      expect(steps.length).toBeGreaterThan(0);

      // No runtime page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.afterEach(async ({ page }) => {
    // Final sanity: ensure no unexpected uncaught errors were captured during the test run.
    // If pageErrors exist, fail the test here (explicit assertion).
    if (pageErrors.length > 0) {
      // Throw to make the test fail with the captured errors
      const errMessages = pageErrors.map(e => e.stack || e.message).join('\n---\n');
      throw new Error(`Uncaught page errors were detected:\n${errMessages}`);
    }

    // Also assert that console.error was not emitted during tests; if it was, fail explicitly.
    const consoleErrs = consoleEvents.filter(e => e.type === 'error');
    if (consoleErrs.length > 0) {
      const msgs = consoleErrs.map(c => c.text).join('\n---\n');
      throw new Error(`console.error messages were emitted during the test:\n${msgs}`);
    }
  });
});