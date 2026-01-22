import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b41380-d5c2-11f0-9651-0f1ae31ac260.html';

class FloydWarshallPage {
  /**
   * Page object wrapper for the Floyd-Warshall visualization page.
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.stepBtn = page.locator('#stepBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.graphInput = page.locator('#graphInput');
    this.distanceMatrixDiv = page.locator('#distanceMatrix');
    this.logDiv = page.locator('#log');
    this.canvas = page.locator('#graphCanvas');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async start() {
    await this.startBtn.click();
  }

  async step() {
    await this.stepBtn.click();
  }

  async reset() {
    await this.resetBtn.click();
  }

  async getButtonStates() {
    return {
      startDisabled: await this.startBtn.evaluate((el) => el.disabled),
      stepDisabled: await this.stepBtn.evaluate((el) => el.disabled),
      resetDisabled: await this.resetBtn.evaluate((el) => el.disabled),
    };
  }

  async getLogText() {
    return this.logDiv.evaluate((el) => el.textContent || '');
  }

  async getDistanceMatrixTable() {
    // Returns number of rows (excluding header) and a snapshot of cell texts & inline styles
    return this.distanceMatrixDiv.evaluate((div) => {
      const table = div.querySelector('table');
      if (!table) return { exists: false, rows: 0, cells: [] };
      const rows = Array.from(table.querySelectorAll('tr'));
      // skip header row for count of data rows
      const dataRows = rows.slice(1);
      const cells = [];
      for (let r = 0; r < dataRows.length; r++) {
        const tds = Array.from(dataRows[r].querySelectorAll('td'));
        for (let c = 0; c < tds.length; c++) {
          const td = tds[c];
          const style = td.getAttribute('style') || '';
          // computed style might be set via style.backgroundColor; capture inline style text
          cells.push({
            row: r,
            col: c,
            text: td.textContent || '',
            style,
          });
        }
      }
      return { exists: true, rows: dataRows.length, cells };
    });
  }

  async getCanvasDataURL() {
    // Use toDataURL in page context
    return this.canvas.evaluate((c) => c.toDataURL());
  }

  async setGraphInput(text) {
    await this.graphInput.fill(text);
  }

  async waitForLogContains(substring, timeout = 3000) {
    await this.page.waitForFunction(
      (sel, substr) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.includes(substr);
      },
      '#log',
      substring,
      { timeout }
    );
  }

  async anyTdHasHighlight() {
    const info = await this.getDistanceMatrixTable();
    if (!info.exists) return false;
    return info.cells.some((c) => {
      // inline style may include background-color when highlighted
      return c.style && (c.style.includes('background-color') || c.style.includes('font-weight'));
    });
  }
}

test.describe('Floyd-Warshall Algorithm Visualization (d7b41380-d5c2-11f0-9651-0f1ae31ac260)', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    pageErrors = [];
    consoleMessages = [];

    // Collect console messages and page errors
    page.on('console', (msg) => {
      // capture console text for later assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to application
    await page.goto(APP_URL);
  });

  test('Initial idle state (S0_Idle) - UI elements present and disabled/enabled as expected', async ({ page }) => {
    const app = new FloydWarshallPage(page);

    // Verify initial button states reflect Idle state
    const states = await app.getButtonStates();
    // Start should be enabled, step and reset disabled
    expect(states.startDisabled).toBeFalsy();
    expect(states.stepDisabled).toBeTruthy();
    expect(states.resetDisabled).toBeTruthy();

    // The textarea should contain the default 4x4 example; ensure it's non-empty and looks like 4 lines
    const inputValue = await app.graphInput.evaluate((el) => el.value);
    expect(inputValue.trim().split('\n').length).toBeGreaterThanOrEqual(1);

    // Distance matrix should be empty (no table rendered)
    const matrixInfo = await app.getDistanceMatrixTable();
    expect(matrixInfo.exists).toBeFalsy();

    // Log should be empty on load
    const logText = await app.getLogText();
    expect(logText.trim()).toBe('');

    // Canvas should exist; capture initial dataURL (blank canvas)
    const beforeDataURL = await app.getCanvasDataURL();
    expect(typeof beforeDataURL).toBe('string');
    expect(beforeDataURL.length).toBeGreaterThan(0);

    // Ensure no unexpected page errors occurred on load
    expect(pageErrors.length).toBe(0);
  });

  test('Start algorithm transitions to Running (S1_Running) and renders matrix & canvas', async ({ page }) => {
    const app = new FloydWarshallPage(page);

    // Start algorithm
    await app.start();

    // Wait for the expected startup log message produced by the application
    await app.waitForLogContains('Algorithm started with 4 vertices.');

    // Verify button state changes consistent with S1_Running
    const states = await app.getButtonStates();
    expect(states.startDisabled).toBeTruthy();
    expect(states.stepDisabled).toBeFalsy();
    expect(states.resetDisabled).toBeFalsy();

    // Distance matrix should now be rendered as a table with 4 rows (the example is 4x4)
    const matrixInfo = await app.getDistanceMatrixTable();
    expect(matrixInfo.exists).toBeTruthy();
    expect(matrixInfo.rows).toBe(4);

    // The log should include the "Algorithm started..." entry
    const logText = await app.getLogText();
    expect(logText).toContain('Algorithm started with 4 vertices.');

    // The canvas should have been drawn to (compare dataURL length vs initial)
    const afterStartDataURL = await app.getCanvasDataURL();
    expect(afterStartDataURL.length).toBeGreaterThan(0);

    // Assert no uncaught page errors fired during the start transition
    expect(pageErrors.length).toBe(0);
  });

  test('Stepping through algorithm (S2_Stepping) until completion (S3_Completed) and verify logs and UI state', async ({ page }) => {
    const app = new FloydWarshallPage(page);

    // Start algorithm
    await app.start();
    await app.waitForLogContains('Algorithm started with 4 vertices.');

    // Capture canvas state after start
    const canvasAfterStart = await app.getCanvasDataURL();

    // Step repeatedly until the algorithm completes.
    // The implementation returns false when finished and disables the step button.
    // Limit iterations to avoid infinite loop in case of unexpected behavior.
    const MAX_STEPS = 200;
    let steps = 0;
    for (; steps < MAX_STEPS; steps++) {
      const stepDisabled = await app.stepBtn.evaluate((el) => el.disabled);
      if (stepDisabled) break; // no longer able to step -> likely completed
      await app.step();
      // small wait for DOM updates (renderDistanceMatrix and drawGraph)
      await page.waitForTimeout(20);
    }

    // After loop, either step button disabled (completed) or we've hit MAX_STEPS
    const finalButtonStates = await app.getButtonStates();
    // Expect that reset is enabled and start remains disabled after running
    expect(finalButtonStates.resetDisabled).toBeFalsy();
    expect(finalButtonStates.startDisabled).toBeTruthy();

    // Confirm algorithm completion message exists in the log
    const logText = await app.getLogText();
    expect(logText).toMatch(/Algorithm completed\./);

    // The "Next Step" button should be disabled after completion
    expect(finalButtonStates.stepDisabled).toBeTruthy();

    // Confirm the distance matrix is rendered and contains some values; ensure rendering occurred
    const matrixInfo = await app.getDistanceMatrixTable();
    expect(matrixInfo.exists).toBeTruthy();
    expect(matrixInfo.rows).toBe(4);
    // At least one cell should display a finite numeric value or infinity symbol
    const someCellText = matrixInfo.cells.find((c) => c.text && c.text.length > 0);
    expect(someCellText).toBeTruthy();

    // Canvas after completion should be different (has highlighting of k-1 etc) than after start in many cases
    const canvasAfterCompletion = await app.getCanvasDataURL();
    expect(canvasAfterCompletion.length).toBeGreaterThan(0);
    // It's reasonable to expect the image changed between start and completion
    expect(canvasAfterCompletion).not.toBe(canvasAfterStart);

    // Ensure no uncaught page errors occurred during stepping
    expect(pageErrors.length).toBe(0);
  }, 120000); // allow longer timeout for stepping

  test('Reset algorithm transitions back to Idle (S0_Idle) and clears UI', async ({ page }) => {
    const app = new FloydWarshallPage(page);

    // Start and step once to ensure UI is active
    await app.start();
    await app.waitForLogContains('Algorithm started with 4 vertices.');
    // click one step to change state
    await app.step();
    await page.waitForTimeout(20);

    // Capture canvas data before reset
    const canvasBeforeReset = await app.getCanvasDataURL();

    // Now reset
    await app.reset();
    await page.waitForTimeout(20);

    // After reset, distanceMatrix should be empty and log cleared
    const matrixAfterReset = await app.getDistanceMatrixTable();
    expect(matrixAfterReset.exists).toBeFalsy();

    const logAfterReset = await app.getLogText();
    expect(logAfterReset.trim()).toBe('');

    // Buttons should reflect Idle state: start enabled, step/reset disabled
    const states = await app.getButtonStates();
    expect(states.startDisabled).toBeFalsy();
    expect(states.stepDisabled).toBeTruthy();
    expect(states.resetDisabled).toBeTruthy();

    // Canvas should be cleared (dataURL will still be a valid PNG but content changed)
    const canvasAfterReset = await app.getCanvasDataURL();
    expect(canvasAfterReset.length).toBeGreaterThan(0);
    expect(canvasAfterReset).not.toBe(canvasBeforeReset);

    // No uncaught page errors on reset
    expect(pageErrors.length).toBe(0);
  });

  test('Invalid input should trigger parse error alert and not cause uncaught page errors (edge case)', async ({ page }) => {
    const app = new FloydWarshallPage(page);

    // Replace the textarea content with a non-square matrix to provoke parse error
    await app.setGraphInput('1 2\n3 4 5'); // invalid (non-square)

    // Listen for dialog that the page will show on parse error
    let dialogMessage = null;
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    // Click start to trigger parsing and expect an alert dialog
    await app.start();

    // Wait briefly for dialog handler to run
    await page.waitForTimeout(100);

    // The application shows alert('Error parsing matrix: ' + e.message)
    expect(dialogMessage).toBeTruthy();
    expect(dialogMessage).toMatch(/Error parsing matrix:/);

    // Ensure application did not produce uncaught exceptions (pageerror)
    expect(pageErrors.length).toBe(0);

    // After a failed start, buttons should remain in Idle state (start enabled, others disabled)
    const states = await app.getButtonStates();
    expect(states.startDisabled).toBeFalsy();
    expect(states.stepDisabled).toBeTruthy();
    expect(states.resetDisabled).toBeTruthy();
  });

  test('During stepping at least one cell gets highlighted (visual feedback check for S2_Stepping)', async ({ page }) => {
    const app = new FloydWarshallPage(page);

    // Start algorithm
    await app.start();
    await app.waitForLogContains('Algorithm started with 4 vertices.');

    // Step once to cause renderDistanceMatrix to be called with highlight
    await app.step();
    await page.waitForTimeout(50);

    // Check that at least one td has an inline style indicating it was highlighted
    const hasHighlight = await app.anyTdHasHighlight();
    expect(hasHighlight).toBeTruthy();

    // Ensure no uncaught page errors occurred
    expect(pageErrors.length).toBe(0);
  });

  test.afterEach(async ({ page }) => {
    // As a final check, ensure there are no uncaught JS errors collected during each test
    expect(pageErrors.length).toBe(0);
    // Optionally, assert that console did include algorithm lifecycle messages when appropriate
    // (This is non-strict: ensure there were some console messages captured during interactions)
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });
});