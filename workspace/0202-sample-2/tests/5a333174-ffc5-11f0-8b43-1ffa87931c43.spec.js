import { test, expect } from '@playwright/test';

// Test file: 5a333174-ffc5-11f0-8b43-1ffa87931c43.spec.js
// This suite validates the Floyd-Warshall demo app states, transitions, visual output,
// logs, edge cases (invalid input), INF handling, and monitors console / page errors.
// The app is served at:
// http://127.0.0.1:5500/workspace/0202-sample-2/html/5a333174-ffc5-11f0-8b43-1ffa87931c43.html

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a333174-ffc5-11f0-8b43-1ffa87931c43.html';

// Page Object Model for interacting with the Floyd-Warshall demo page
class FloydWarshallPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.matrixInput = page.locator('#matrixInput');
    this.runBtn = page.locator('#runBtn');
    this.resultDiv = page.locator('#result');
    this.stepsDiv = page.locator('#steps');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure the main components are present
    await expect(this.runBtn).toBeVisible();
    await expect(this.matrixInput).toBeVisible();
    await expect(this.resultDiv).toBeVisible();
    await expect(this.stepsDiv).toBeVisible();
  }

  async setMatrix(text) {
    await this.matrixInput.fill(text);
  }

  async clickRun() {
    await this.runBtn.click();
  }

  // Wait for a result table to appear in #result
  async waitForResultTable(timeout = 2000) {
    await expect(this.resultDiv.locator('table')).toBeVisible({ timeout });
  }

  // Get text content of steps area
  async getStepsText() {
    return await this.stepsDiv.innerText();
  }

  // Get numeric/text of cell (i, j) in result table (0-based indices)
  // Note: table rows have a leading <th> for row label, so we select td at index j
  async getResultCell(i, j) {
    const row = this.resultDiv.locator('table tbody tr').nth(i);
    const cell = row.locator('td').nth(j);
    return (await cell.innerText()).trim();
  }

  // Checks if stepsDiv is focused
  async isStepsFocused() {
    return await this.page.evaluate(() => document.activeElement === document.getElementById('steps'));
  }
}

test.describe('Floyd-Warshall Algorithm Demo - FSM and UI tests', () => {
  // Arrays to collect console and page errors for each test
  test.beforeEach(async ({ page }) => {
    // No-op: listeners are installed per-test below inside each test to capture messages scoped to that test.
  });

  // Validate initial Idle state (S0_Idle)
  test('Initial state: Idle renders expected controls (S0_Idle)', async ({ page }) => {
    // capture console and page errors during load
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const fw = new FloydWarshallPage(page);
    await fw.goto();

    // Verify evidence from FSM: Run Floyd-Warshall button present
    await expect(fw.runBtn).toHaveText('Run Floyd-Warshall');

    // Verify textarea exists and contains default matrix text
    const matrixValue = await fw.matrixInput.inputValue();
    expect(matrixValue.length).toBeGreaterThan(0); // default sample matrix present

    // Ensure no runtime page errors occurred on initial load
    expect(pageErrors).toEqual([]);

    // No unexpected console.error messages
    const consoleErrors = consoleMessages.filter(c => c.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('Running the algorithm and verifying transitions (S0 -> S1 -> S2)', () => {
    test('Click Run transitions from Idle to Processing to Result and displays final matrix & logs', async ({ page }) => {
      // Capture console and page errors to verify the runtime is clean
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', msg => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });
      page.on('pageerror', err => {
        pageErrors.push(err.message);
      });

      const fw = new FloydWarshallPage(page);
      await fw.goto();

      // S0 -> S1: click the Run button (event: RunAlgorithm_Click)
      // We do not intercept or alter any functions; let the page run as-is.
      await fw.clickRun();

      // Wait for processing -> result (S2). The app writes a table to #result and logs to #steps.
      await fw.waitForResultTable();

      // Validate some specific cells of the final distance matrix (computed expectation)
      // We computed expected final matrix for the provided default sample:
      // 0 3 5 6
      // 5 0 2 3
      // 3 6 0 1
      // 2 5 7 0
      await expect(await fw.getResultCell(0, 0)).toBe('0');
      await expect(await fw.getResultCell(0, 1)).toBe('3');
      await expect(await fw.getResultCell(0, 2)).toBe('5');
      await expect(await fw.getResultCell(0, 3)).toBe('6');

      await expect(await fw.getResultCell(1, 0)).toBe('5'); // updated via path through others
      await expect(await fw.getResultCell(1, 2)).toBe('2');
      await expect(await fw.getResultCell(2, 0)).toBe('3');
      await expect(await fw.getResultCell(3, 0)).toBe('2');

      // Verify that the step-by-step log contains the expected "Using vertex Vk" and update lines
      const stepsText = await fw.getStepsText();
      expect(stepsText).toContain('Using vertex V0 as intermediate:');
      expect(stepsText).toContain('Using vertex V1 as intermediate:');
      expect(stepsText).toContain('Using vertex V2 as intermediate:');
      expect(stepsText).toContain('Using vertex V3 as intermediate:');
      // There should be at least one 'Updated dist' message recorded
      expect(stepsText).toMatch(/Updated dist\[V\d+\]\[V\d+\]/);

      // Verify stepsDiv receives focus after run (as per code calling stepsDiv.focus())
      const focused = await fw.isStepsFocused();
      expect(focused).toBe(true);

      // Ensure there were no uncaught page errors during processing
      expect(pageErrors).toEqual([]);

      // No console error messages should have been emitted
      const consoleErrors = consoleMessages.filter(c => c.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error handling', () => {
    test('Invalid (non-rectangular) matrix input should trigger parse error alert and not render result', async ({ page }) => {
      const fw = new FloydWarshallPage(page);
      await fw.goto();

      // Prepare an invalid matrix (non-rectangular)
      const badMatrix = '0 1\n0 1 2';
      await fw.setMatrix(badMatrix);

      // Listen for dialog and assert its message, then accept it.
      const dialogs = [];
      page.on('dialog', async dialog => {
        dialogs.push({ message: dialog.message(), type: dialog.type() });
        await dialog.accept();
      });

      // Click Run - code will try parseMatrix and throw -> alert is shown
      await fw.clickRun();

      // There should be a dialog captured with error message
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      const lastDialog = dialogs[dialogs.length - 1];
      expect(lastDialog.message).toContain('Error parsing matrix');
      // The underlying error thrown by parseMatrix for non-rectangular is 'Matrix is not rectangular.'
      expect(lastDialog.message).toContain('Matrix is not rectangular.');

      // Ensure no result table was rendered after the error
      await expect(fw.resultDiv.locator('table')).not.toBeVisible();
    });

    test('Matrix containing INF (text) should be parsed and display ∞ in output for unreachable pairs', async ({ page }) => {
      const fw = new FloydWarshallPage(page);
      await fw.goto();

      // Use a simple 2x2 matrix with INF tokens
      const matrixWithINF = '0 INF\nINF 0';
      await fw.setMatrix(matrixWithINF);

      await fw.clickRun();
      await fw.waitForResultTable();

      // Off-diagonal cells should display the infinity glyph '∞' (class "infinity")
      const cell01 = await fw.getResultCell(0, 1);
      const cell10 = await fw.getResultCell(1, 0);
      expect(cell01).toBe('∞');
      expect(cell10).toBe('∞');

      // Steps should still include "Using vertex" lines even if no updates happen
      const stepsText = await fw.getStepsText();
      expect(stepsText).toContain('Using vertex V0 as intermediate:');
      expect(stepsText).toContain('Using vertex V1 as intermediate:');
    });
  });

  test.describe('Console and runtime error observation', () => {
    test('No uncaught exceptions or console.error messages occur during full user flow', async ({ page }) => {
      // Monitor console and page errors
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', msg => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });
      page.on('pageerror', err => {
        pageErrors.push(err.message);
      });

      const fw = new FloydWarshallPage(page);
      await fw.goto();

      // Run with default matrix (this triggers full algorithm)
      await fw.clickRun();
      await fw.waitForResultTable();

      // Assert no page errors were emitted
      expect(pageErrors).toEqual([]);

      // Assert there were no console.error messages (we allow console.log/info/debug)
      const consoleErrors = consoleMessages.filter(c => c.type === 'error');
      expect(consoleErrors.length).toBe(0);

      // For observability, assert that some console/info messages may be captured (not required)
      // but we simply ensure the absence of error-level messages.
    });
  });
});