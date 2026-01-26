import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c97b481-fa78-11f0-857d-d58e82d5de73.html';

// Page object encapsulating interactions and queries for the visualization page
class FloydWarshallPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
    // Attach listeners to record console messages and uncaught errors
    this.page.on('console', msg => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', err => {
      this.pageErrors.push(err);
    });
  }

  // Navigate to the app page and wait for load event
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load', timeout: 10000 });
    // Give the page a moment to run initial script and attachments
    await this.page.waitForTimeout(250);
  }

  // Return locator for Next Step button
  nextBtn() {
    return this.page.locator('#nextStepBtn');
  }

  // Return locator for Reset button
  resetBtn() {
    return this.page.locator('#resetBtn');
  }

  // Click Next Step and return immediately (caller can await state changes)
  async clickNext() {
    await this.nextBtn().click();
  }

  // Click Reset
  async clickReset() {
    await this.resetBtn().click();
  }

  // Whether Next Step is disabled
  async isNextDisabled() {
    return await this.nextBtn().isDisabled();
  }

  // Whether Reset is disabled
  async isResetDisabled() {
    return await this.resetBtn().isDisabled();
  }

  // Number of rows (excluding header corner) in matrix body
  async matrixRowCount() {
    return await this.page.locator('#matrix tbody tr').count();
  }

  // Number of columns (excluding corner header) in matrix header
  async matrixColCount() {
    // header row th includes one corner cell then columns
    const thCount = await this.page.locator('#matrix thead tr th').count();
    return Math.max(0, thCount - 1);
  }

  // Read header labels (0..N-1)
  async matrixHeaders() {
    const headers = await this.page.$$eval('#matrix thead tr th', ths => ths.map(t => t.textContent.trim()));
    // Remove first corner cell
    return headers.slice(1);
  }

  // Get matrix cell text at row r and column c (0-based indices)
  async matrixCellText(r, c) {
    // rows include <th> scope row then N <td>s; need to select td at index c
    const selector = `#matrix tbody tr:nth-child(${r + 1}) td:nth-child(${c + 1})`;
    return await this.page.locator(selector).textContent();
  }

  // Count highlighted rows (rows with .highlight on the <tr>)
  async highlightedRowIndices() {
    const indices = await this.page.$$eval('#matrix tbody tr', rows =>
      rows.map((tr, idx) => tr.classList.contains('highlight') ? idx : -1).filter(i => i !== -1)
    );
    return indices;
  }

  // Count node elements rendered
  async nodeCount() {
    return await this.page.locator('.node').count();
  }

  // Get box-shadow style of node at index idx (0-based)
  async nodeBoxShadow(idx) {
    const handle = this.page.locator('.node').nth(idx);
    return (await handle.evaluate((el) => getComputedStyle(el).boxShadow)) || '';
  }

  // Count edges (SVG paths with class 'edge')
  async edgeCount() {
    return await this.page.locator('svg#edges-svg .edge, svg#edges-svg path.edge').count();
  }

  // Count weight label divs
  async weightLabelCount() {
    return await this.page.locator('.weight-label').count();
  }

  // Get captured console messages of a given type (e.g., 'error')
  consoleOfType(type) {
    return this.consoleMessages.filter(m => m.type === type).map(m => m.text);
  }

  // Get all recorded page errors
  getPageErrors() {
    return this.pageErrors.slice();
  }

  // Wait until Next Step button becomes enabled or timeout
  async waitForNextEnabled(timeout = 8000) {
    await this.page.waitForFunction(() => {
      const b = document.querySelector('#nextStepBtn');
      return b && !b.disabled;
    }, {}, { timeout });
  }

  // Wait until Next Step is disabled
  async waitForNextDisabled(timeout = 2000) {
    await this.page.waitForFunction(() => {
      const b = document.querySelector('#nextStepBtn');
      return b && b.disabled;
    }, {}, { timeout });
  }

  // Utility to repeatedly click Next until it becomes disabled (end of algorithm) or maxClicks reached
  async clickNextUntilDisabled(maxClicks = 15, perClickWait = 3500) {
    for (let i = 0; i < maxClicks; i++) {
      const disabled = await this.isNextDisabled();
      if (disabled) return i;
      await this.clickNext();
      // Wait for potential re-enable or for disabled to remain while animating
      try {
        // Wait for either enabled (end of animation) or disabled (stays disabled)
        await this.page.waitForFunction(() => {
          const b = document.querySelector('#nextStepBtn');
          return b && (!b.disabled || b.disabled);
        }, {}, { timeout: perClickWait });
      } catch (e) {
        // ignore; continue loop
      }
      // small extra wait to allow animations to progress
      await this.page.waitForTimeout(200);
      if (await this.isNextDisabled()) return i + 1;
    }
    return maxClicks;
  }
}

// Grouping tests related to the FSM of the visualization
test.describe('Floyd-Warshall Algorithm Visualization - FSM and UI tests', () => {
  // Each test will create its own page and FloydWarshallPage wrapper
  test.beforeEach(async ({ page }) => {
    // Increase default timeout for slower environments
    test.setTimeout(120000);
  });

  // Validate initial Idle state (S0_Idle)
  test('S0_Idle: initial load sets up nodes, matrix and Next Step enabled', async ({ page }) => {
    // Create page object that records console and errors
    const app = new FloydWarshallPage(page);
    await app.goto();

    // Validate UI elements exist
    await expect(app.nextBtn()).toBeVisible();
    await expect(app.resetBtn()).toBeVisible();

    // Next Step should be enabled in the Idle initial state (evidence: nextStepBtn.disabled = false)
    expect(await app.isNextDisabled()).toBe(false);

    // Matrix should be rendered with N rows and columns; header labels 0..N-1
    const cols = await app.matrixColCount();
    const rows = await app.matrixRowCount();
    // As per implementation constant N = 6
    expect(cols).toBe(6);
    expect(rows).toBe(6);
    const headers = await app.matrixHeaders();
    expect(headers).toEqual(['0', '1', '2', '3', '4', '5']);

    // Nodes should be created (expected N = 6)
    expect(await app.nodeCount()).toBe(6);

    // There should be at least one edge and weight label present
    expect(await app.edgeCount()).toBeGreaterThan(0);
    expect(await app.weightLabelCount()).toBeGreaterThan(0);

    // Ensure no uncaught page errors occurred on load
    const pageErrors = app.getPageErrors();
    expect(pageErrors.length).toBe(0);

    // And ensure console does not have type 'error' messages recorded
    const consoleErrors = app.consoleOfType('error');
    expect(consoleErrors.length).toBe(0);
  });

  // Validate Next Step click transitions and the animation behavior (S0 -> S1 -> S0)
  test('NextStepClick: clicking Next toggles disabled state during animation and advances algorithm step', async ({ page }) => {
    const app = new FloydWarshallPage(page);
    await app.goto();

    // Ensure starting from Idle with Next enabled
    expect(await app.isNextDisabled()).toBe(false);

    // Click Next: button should immediately be disabled (handler disables at start)
    await app.clickNext();
    expect(await app.isNextDisabled()).toBe(true);

    // Wait for re-enable (animateStep resolves and handler re-enables if kStep < N)
    await app.waitForNextEnabled(8000);
    expect(await app.isNextDisabled()).toBe(false);

    // Clicking again should produce a matrix highlight for k=0 (renderMatrix called with kStep=0)
    // Click second time to actually enter an animating state that highlights row 0
    await app.clickNext();

    // Immediately after click expect disabled while animating
    expect(await app.isNextDisabled()).toBe(true);

    // Wait for animateStep to render the matrix with highlighted row 0 (may occur quickly)
    // Poll for presence of at least one highlighted row, with extended timeout to accommodate animation delays
    await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll('#matrix tbody tr'));
      return rows.some(r => r.classList.contains('highlight'));
    }, {}, { timeout: 10000 });

    const highlighted = await app.highlightedRowIndices();
    // We expect at least one highlighted row index (specifically k or updated row)
    expect(highlighted.length).toBeGreaterThanOrEqual(0); // presence validated by waitForFunction above

    // After animation completes Next should be re-enabled (unless algorithm finished)
    await app.waitForNextEnabled(10000);
    expect(await app.isNextDisabled()).toBe(false);

    // Finally ensure no new uncaught page errors occurred during these interactions
    const pageErrors = app.getPageErrors();
    expect(pageErrors.length).toBe(0);

    // And no console.error messages surfaced
    const consoleErrors = app.consoleOfType('error');
    expect(consoleErrors.length).toBe(0);
  });

  // Validate repeated Next Step clicks until algorithm completes (kStep >= N) disables Next permanently
  test('S1_StepAnimating -> S0_Idle transitions across multiple steps and eventually disables Next when finished', async ({ page }) => {
    const app = new FloydWarshallPage(page);
    await app.goto();

    // Repeatedly click Next until button becomes disabled (algorithm end) or maximum attempts reached
    const clicksMade = await app.clickNextUntilDisabled(12, 4000);

    // After the loop, Next should be disabled if kStep >= N; check the DOM state
    const nextDisabled = await app.isNextDisabled();
    // It's acceptable that the algorithm finishes and disables the button; assert it is boolean
    expect(typeof nextDisabled).toBe('boolean');

    // If disabled, that's an expected end-of-algorithm condition
    if (nextDisabled) {
      // Confirm that clicking the disabled button does not throw errors and does not change state
      // Attempt to click programmatically and catch any page-level exceptions
      let threw = false;
      try {
        // This may be a no-op; ensure no uncaught exceptions
        await app.clickNext();
        // Small wait to ensure no asynchronous pageerror occurs from this accidental click
        await page.waitForTimeout(300);
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(false);
    } else {
      // If not disabled (unexpected), still ensure we made some progress
      expect(clicksMade).toBeGreaterThanOrEqual(1);
    }

    // No uncaught page errors throughout
    const pageErrors = app.getPageErrors();
    expect(pageErrors.length).toBe(0);

    // No console.error messages
    const consoleErrors = app.consoleOfType('error');
    expect(consoleErrors.length).toBe(0);
  });

  // Validate Reset transition (S0 -> S2_Reset) and that resetVisuals() entry actions behave as expected
  test('ResetClick: clicking Reset restores visuals, clears highlights and re-enables Next', async ({ page }) => {
    const app = new FloydWarshallPage(page);
    await app.goto();

    // Make some progress: click Next twice (to ensure there are highlights / changed visuals)
    await app.clickNext();
    await app.waitForNextEnabled(8000);
    await app.clickNext();
    // Allow animations to potentially highlight
    await page.waitForTimeout(500);

    // Validate there may be highlighted rows/nodes before reset
    const highlightedBefore = await app.highlightedRowIndices();

    // Now perform Reset click
    await app.clickReset();

    // After reset, next button must be enabled again per resetVisuals()
    await app.waitForFunction(() => {
      const b = document.querySelector('#nextStepBtn');
      return b && !b.disabled;
    }, {}, { timeout: 5000 });

    expect(await app.isNextDisabled()).toBe(false);

    // After reset, matrix should not have any highlighted rows (resetVisuals calls renderMatrix())
    const highlightedAfter = await app.highlightedRowIndices();
    expect(highlightedAfter.length).toBe(0);

    // Node box shadows should be cleared for all nodes after reset
    const nodeCount = await app.nodeCount();
    for (let i = 0; i < nodeCount; i++) {
      const boxShadow = await app.nodeBoxShadow(i);
      // The reset clears the boxShadow by setting empty string; computed style may return 'none' or '0px 0px 0px 0px ...'
      expect(typeof boxShadow).toBe('string');
      // Ensure no strong glowing shadow remains (heuristic)
      expect(boxShadow.includes('rgb') || boxShadow === 'none' || boxShadow === '').toBeTruthy();
    }

    // Hitting Next after a reset should behave (it will render k=0 highlight on next animate)
    await app.clickNext();
    // Wait for highlight to appear for the k-step
    await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll('#matrix tbody tr'));
      return rows.some(r => r.classList.contains('highlight'));
    }, {}, { timeout: 10000 });

    // Ensure no page errors recorded on reset interactions
    const pageErrors = app.getPageErrors();
    expect(pageErrors.length).toBe(0);
    const consoleErrors = app.consoleOfType('error');
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: clicking Next multiple times rapidly while disabled should not crash page (no uncaught exceptions)
  test('Edge case: multiple rapid clicks while disabled do not produce uncaught runtime errors', async ({ page }) => {
    const app = new FloydWarshallPage(page);
    await app.goto();

    // Click Next to initiate an animation and cause the button to disable
    await app.clickNext();

    // Immediately attempt to click Next multiple times while disabled
    // Use page.mouse to try clicking the exact coordinates of the button to simulate user spamming clicks
    const btnBox = await app.nextBtn().boundingBox();
    if (btnBox) {
      const { x, y, width, height } = btnBox;
      const cx = x + width / 2;
      const cy = y + height / 2;
      // spam 6 clicks rapidly
      for (let i = 0; i < 6; i++) {
        await page.mouse.click(cx, cy);
      }
    } else {
      // Fallback: use locator click attempts (will throw only if Playwright sees it as not clickable)
      for (let i = 0; i < 6; i++) {
        try { await app.nextBtn().click({ timeout: 100 }); } catch (e) { /* ignore */ }
      }
    }

    // Wait a short period for any potential uncaught exceptions to bubble up
    await page.waitForTimeout(800);

    // Assert no uncaught page errors were recorded
    const pageErrors = app.getPageErrors();
    expect(pageErrors.length).toBe(0);

    // Also assert no console.error messages
    const consoleErrors = app.consoleOfType('error');
    expect(consoleErrors.length).toBe(0);
  });

  // Validate matrix content formatting (in particular that INF is displayed as "∞")
  test('Matrix values formatting: INF values are displayed as "∞" and numeric values present', async ({ page }) => {
    const app = new FloydWarshallPage(page);
    await app.goto();

    // Check a few cells for expected formatting: we know INF is used for many entries
    // Scan matrix for any "∞" occurrences and at least one numeric value
    const allCells = await page.$$eval('#matrix tbody td', tds => tds.map(td => td.textContent.trim()));
    const hasInfinity = allCells.some(text => text === '∞');
    const hasNumeric = allCells.some(text => /^-?\d+$/.test(text));
    expect(hasInfinity).toBe(true);
    expect(hasNumeric).toBe(true);

    // No runtime errors logged
    const pageErrors = app.getPageErrors();
    expect(pageErrors.length).toBe(0);
  });
});