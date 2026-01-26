import { test, expect } from '@playwright/test';

class FloydWarshallPage {
  /**
   * Page object for the Floyd-Warshall visualizer page.
   * Provides convenient accessors and actions for tests.
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.status = page.locator('#status');
    this.matrixRows = page.locator('#matrix tbody tr');
    this.matrixCells = page.locator('#matrix tbody td');
  }

  async goto(url) {
    await this.page.goto(url);
    // Ensure page scripts run and initial rendering done
    await this.page.waitForLoadState('domcontentloaded');
    // Wait for initial renderMatrix call to populate the matrix
    await expect(this.matrixRows).toHaveCountGreaterThan(0);
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async getStartText() {
    return (await this.startBtn.textContent()).trim();
  }

  async getStatusText() {
    return (await this.status.textContent()).trim();
  }

  async getStatusColor() {
    // returns computed color as rgb(...) string
    return await this.page.evaluate(el => getComputedStyle(el).color, await this.status.elementHandle());
  }

  async countMatrixRows() {
    return await this.matrixRows.count();
  }

  async countMatrixCellsWithClass(cls) {
    return await this.page.locator(`#matrix td.${cls}`).count();
  }

  async anyMatrixCellHasClass(cls) {
    return (await this.countMatrixCellsWithClass(cls)) > 0;
  }

  async clickStartMultiple(times = 2, intervalMs = 50) {
    for (let i = 0; i < times; i++) {
      await this.startBtn.click();
      // small pause between clicks
      await this.page.waitForTimeout(intervalMs);
    }
  }
}

test.describe('Floyd-Warshall Algorithm Visualizer (Application ID: 72aa5373-fa78-11f0-812d-c9788050701f)', () => {
  const url = 'http://127.0.0.1:5500/workspace/0126-biased/html/72aa5373-fa78-11f0-812d-c9788050701f.html';
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset error collectors for each test
    pageErrors = [];
    consoleErrors = [];

    // Listen for runtime page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // capture stack-like info for assertions / debugging
      pageErrors.push(String(err));
    });

    // Capture console messages; keep error-level messages separately
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(`${msg.type()}: ${msg.text()}`);
        }
      } catch (e) {
        // ignore any issues reading console messages
      }
    });

    // Navigate to the page under test
    await page.goto(url);
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async () => {
    // After each test, assert there were no unexpected runtime errors logged.
    // Tests that intentionally exercise errors can assert specifics in-test.
    expect(pageErrors, `No uncaught page errors expected, but got: ${pageErrors.join('\n')}`).toEqual([]);
    expect(consoleErrors, `No console.error messages expected, but got: ${consoleErrors.join('\n')}`).toEqual([]);
  });

  test('Initial state (S0_Idle) on load: UI renders matrix and status is Ready to begin', async ({ page }) => {
    // Validate initial state / entry actions: renderMatrix() and updateStatus()
    const fw = new FloydWarshallPage(page);

    // Wait until matrix rows are rendered (renderMatrix invoked on load)
    await expect(fw.matrixRows).toHaveCountGreaterThan(0);

    // Status text should reflect Idle evidence
    const statusText = await fw.getStatusText();
    // The FSM evidence expects "Ready to begin"
    expect(statusText).toBe('Ready to begin');

    // start button initial label (entry UI)
    const startText = await fw.getStartText();
    expect(startText).toBe('Start Animation');

    // Matrix should have at least one header row + data rows (n+1 rows).
    const rows = await fw.countMatrixRows();
    expect(rows).toBeGreaterThanOrEqual(2); // header + at least one data row

    // Verify that infinity values are represented in the matrix (visual check)
    const infinityCells = await page.locator('#matrix td.infinity').count();
    expect(infinityCells).toBeGreaterThanOrEqual(1);

    // Verify status color matches Idle color (#4ecdc4) -> computed rgb
    const statusColor = await fw.getStatusColor();
    // #4ecdc4 ~= rgb(78, 205, 196)
    expect(statusColor).toBe('rgb(78, 205, 196)');
  });

  test('StartAnimation event transitions to Running (S1_Running): start button and status update, matrix highlighting begins', async ({ page }) => {
    const fw = new FloydWarshallPage(page);

    // Click Start Animation to trigger floydWarshallStep()
    await fw.clickStart();

    // Immediately the implementation sets isRunning = true and start button text to "Running..."
    await expect(fw.startBtn).toHaveText('Running...', { timeout: 5000 });

    // Status should change to indicate comparisons are being performed
    // We allow some time for the first updateStatus() call inside floydWarshallStep
    await expect(fw.status).toContainText('Comparing path', { timeout: 5000 });

    // At least one cell should receive the "highlight" class as highlightMatrixCell is called
    await expect(page.locator('#matrix td.highlight')).toHaveCountGreaterThan(0, { timeout: 5000 });

    // Rapid repeated clicks on the start button while running should not change the fact that it's running.
    // This tests the guard: if (!isRunning && this.textContent !== 'Complete') { floydWarshallStep(); }
    await fw.clickStartMultiple(3, 30);
    // Still should be running
    const currentStartText = await fw.getStartText();
    expect(currentStartText).toBe('Running...');
  });

  test.describe('Long-running algorithm behavior and completion (S1_Running -> S2_Complete)', () => {
    // The algorithm uses real timeouts for visualization. This test waits for completion.
    // Increase timeout to allow the algorithm to run to completion on CI.
    test.setTimeout(180000); // 3 minutes for this test

    test('Algorithm completes and enters Complete state; Reset transitions back to Idle', async ({ page }) => {
      const fw = new FloydWarshallPage(page);

      // Start the algorithm
      await fw.clickStart();

      // Wait for start button to change to "Complete" (this happens when algorithm finishes)
      // This is intentionally long because visualization uses delays.
      await expect(fw.startBtn).toHaveText('Complete', { timeout: 170000 });

      // After completion, the status should be updated per FSM evidence
      await expect(fw.status).toHaveText('Algorithm complete! Final shortest paths calculated.');

      // Ensure the Complete state evidence is present
      const startTextAfter = await fw.getStartText();
      expect(startTextAfter).toBe('Complete');

      // Now test Reset transition from S2_Complete -> S0_Idle
      await fw.clickReset();

      // After reset, UI should show initial Idle state values again
      await expect(fw.startBtn).toHaveText('Start Animation');
      await expect(fw.status).toHaveText('Ready to begin');

      // Reset should clear highlight/path classes
      const highlightAfterReset = await fw.countMatrixCellsWithClass('highlight');
      const pathAfterReset = await fw.countMatrixCellsWithClass('path');
      expect(highlightAfterReset).toBe(0);
      expect(pathAfterReset).toBe(0);
    });
  });

  test('Edge cases and error scenarios: rapid interactions and invalid sequences', async ({ page }) => {
    const fw = new FloydWarshallPage(page);

    // 1) Rapidly clicking Reset when in Idle - should remain stable
    await fw.clickReset();
    await expect(fw.startBtn).toHaveText('Start Animation');
    await expect(fw.status).toHaveText('Ready to begin');

    // 2) Rapidly click Start multiple times; algorithm guard should prevent multiple concurrent starts.
    await fw.clickStartMultiple(5, 10);
    // Should be running
    await expect(fw.startBtn).toHaveText('Running...', { timeout: 5000 });

    // Immediately try clicking Reset while algorithm is running.
    // Note: the implementation does not cancel the running algorithm; reset() will set UI back to Start Animation,
    // but the background algorithm may later set it to 'Complete'. This tests whether reset did at least toggle UI immediately.
    await fw.clickReset();

    // Because of race conditions between background algorithm and reset, the UI may change again.
    // We assert that reset immediately set the UI to Idle state.
    await expect(fw.startBtn).toHaveText('Start Animation');
    await expect(fw.status).toHaveText('Ready to begin');
  });
});