import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f7b382-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object for the SQL Visual Demonstration app
class SqlVizPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // controls
    this.execute = page.locator('#execute');
    this.reset = page.locator('#reset');
    // results area
    this.resultsTitle = page.locator('#results-title');
    this.resultsSub = page.locator('#results-sub');
    this.grid = page.locator('#grid');
    this.chipLayer = page.locator('#chip-layer');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the main wrapper to animate in and the DOM to be ready
    await this.page.waitForSelector('.wrap', { state: 'visible' });
  }

  async clickExecute() {
    await this.execute.click();
  }

  async clickReset() {
    await this.reset.click();
  }

  async isExecuteDisabled() {
    return await this.execute.isDisabled();
  }

  async getResultsTitleText() {
    return (await this.resultsTitle.textContent())?.trim();
  }

  async getResultsSubText() {
    return (await this.resultsSub.textContent())?.trim();
  }

  async getCellText(row, colIndex) {
    // colIndex is 1..3; rows 1..5
    const id = `#r${row}c${colIndex}`;
    const el = this.page.locator(id);
    await expect(el).toBeVisible();
    const text = (await el.textContent())?.trim();
    return text;
  }

  async waitForResultsCompleted(timeout = 8000) {
    await this.page.waitForFunction(() => {
      const t = document.getElementById('results-title');
      return t && t.textContent && t.textContent.includes('Completed');
    }, { timeout });
  }

  async waitForExecuteEnabled(timeout = 8000) {
    await this.page.waitForFunction(() => {
      const btn = document.getElementById('execute');
      return btn && !btn.disabled;
    }, { timeout });
  }
}

test.describe('SQL Visual Demonstration - FSM and interactive behavior', () => {
  // collect console and page errors for each test
  test.beforeEach(async ({ page }) => {
    // attach listeners to collect console errors and page errors so tests can assert on them
    page.__consoleErrors = [];
    page.__pageErrors = [];

    page.on('console', msg => {
      // collect severe console messages (error / warning)
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        page.__consoleErrors.push({ type, text: msg.text() });
      }
    });

    page.on('pageerror', err => {
      page.__pageErrors.push({ message: err.message, stack: err.stack });
    });

    // Navigate to app page
    const pov = new SqlVizPage(page);
    await pov.goto();
  });

  test.afterEach(async ({ page }) => {
    // After each test assert that no uncaught page errors occurred
    // Comment: We assert there are no unexpected runtime errors (ReferenceError/SyntaxError/TypeError).
    // If such errors naturally occur in the page load, this assertion will fail and surface them.
    expect(page.__pageErrors, 'no uncaught page errors should have occurred').toEqual([]);
    expect(page.__consoleErrors, 'no console errors/warnings should have been emitted').toEqual([]);
  });

  test('Initial Idle state: Render and controls are visible and enabled', async ({ page }) => {
    // This test validates FSM state S0_Idle entry actions: renderPage() (the page has rendered)
    // and evidence: Execute and Reset buttons are present.
    const app = new SqlVizPage(page);

    // Buttons present and enabled
    await expect(app.execute).toBeVisible();
    await expect(app.reset).toBeVisible();
    expect(await app.isExecuteDisabled()).toBe(false);

    // Results header is in idle state content
    const title = await app.getResultsTitleText();
    expect(title).toBe('Results (5 rows)');

    const sub = await app.getResultsSubText();
    // exact text in HTML: 'execution • scanned: 248 rows • returned: 5'
    expect(sub).toContain('scanned: 248 rows');

    // Grid should show placeholder em-dash in all cells initially
    for (let r = 1; r <= 5; r++) {
      for (let c = 1; c <= 3; c++) {
        const text = await app.getCellText(r, c);
        expect(text).toBe('—');
      }
    }
  });

  test('Execute Query transition: executing -> results displayed', async ({ page }) => {
    // This test covers transitions:
    // S0_Idle -> S1_Executing: clicking Execute should disable the button
    // S1_Executing -> S2_ResultsDisplayed: final text change to 'Results • Completed' and cell values filled
    const app = new SqlVizPage(page);

    // Click execute and assert immediate executing state (button disabled)
    await app.clickExecute();
    // Right after clicking, the code sets executeBtn.disabled = true;
    expect(await app.isExecuteDisabled()).toBe(true);

    // While running, the page animates chips and fills cells.
    // Wait for the results completed title (action from transition).
    await app.waitForResultsCompleted(10000);

    // After completion, the execute button should be re-enabled
    await app.waitForExecuteEnabled(5000);
    expect(await app.isExecuteDisabled()).toBe(false);

    // Validate resultsTitle and resultsSub updated per FSM evidence
    const title = await app.getResultsTitleText();
    expect(title).toBe('Results • Completed');

    const sub = await app.getResultsSubText();
    expect(sub).toContain('execution time: 12 ms');
    expect(sub).toContain('scanned: 248 rows');
    expect(sub).toContain('returned: 5');

    // Validate that the grid cells are populated with the demo data (names, departments, and formatted salaries)
    // Expected static data from implementation:
    const expected = [
      ['Alexandra Greene', 'Research', '$198,000'],
      ['Marcus Rey', 'Engineering', '$174,500'],
      ['Priya Kaur', 'Finance', '$165,000'],
      ['Daniel Cho', 'Design', '$152,500'],
      ['Lina Moreno', 'Product', '$149,000']
    ];

    // The code animates and fills each row; poll each cell until it contains expected text
    for (let r = 1; r <= 5; r++) {
      // name
      await page.waitForFunction(
        (r, expectedName) => {
          const el = document.getElementById(`r${r}c1`);
          return el && el.textContent && el.textContent.trim() === expectedName;
        },
        r, expected[r - 1][0],
        { timeout: 6000 }
      );
      // department
      await page.waitForFunction(
        (r, expectedDept) => {
          const el = document.getElementById(`r${r}c2`);
          return el && el.textContent && el.textContent.trim() === expectedDept;
        },
        r, expected[r - 1][1],
        { timeout: 6000 }
      );
      // salary
      await page.waitForFunction(
        (r, expectedSal) => {
          const el = document.getElementById(`r${r}c3`);
          return el && el.textContent && el.textContent.trim() === expectedSal;
        },
        r, expected[r - 1][2],
        { timeout: 6000 }
      );
      // assert final texts
      expect(await app.getCellText(r, 1)).toBe(expected[r - 1][0]);
      expect(await app.getCellText(r, 2)).toBe(expected[r - 1][1]);
      expect(await app.getCellText(r, 3)).toBe(expected[r - 1][2]);
    }
  });

  test('Clicking Execute again while running is ignored and does not crash', async ({ page }) => {
    // Validate that the running guard (if(running) return;) prevents duplicate runs
    const app = new SqlVizPage(page);

    // Start execution
    await app.clickExecute();

    // Immediately attempt to click execute multiple times
    // These should be ignored because running becomes true and the button is disabled
    // But to simulate race, attempt to force another click via script while disabled (we won't patch page, just try clicking)
    await Promise.all([
      app.page.mouse.click(0, 0).catch(() => {}), // no-op click outside
      (async () => {
        try {
          await app.execute.click({ timeout: 200 });
        } catch (e) {
          // If Playwright cannot click because button becomes disabled quickly, that's acceptable
        }
      })()
    ]);

    // Immediately assert button is disabled during run
    expect(await app.isExecuteDisabled()).toBe(true);

    // Wait for completion and ensure no page errors occurred
    await app.waitForResultsCompleted(10000);
    await app.waitForExecuteEnabled(5000);

    // Final assertion - app recovered to idle (execute re-enabled)
    expect(await app.isExecuteDisabled()).toBe(false);
  });

  test('Reset visualization clears grid when idle; reset while running is ignored', async ({ page }) => {
    // This test exercises transitions:
    // S0_Idle -> S3_GridReset via clicking Reset (resetGrid action)
    // and ensures S3_GridReset -> S0_Idle results in execute enabled
    const app = new SqlVizPage(page);

    // First, ensure grid is at initial placeholders; then run a full execute to populate grid
    // Run execute and wait for completion
    await app.clickExecute();
    await app.waitForResultsCompleted(10000);
    await app.waitForExecuteEnabled(5000);

    // Confirm grid has populated values (simple check for one known cell)
    const r1Name = await app.getCellText(1, 1);
    expect(r1Name).toBe('Alexandra Greene');

    // Now click Reset (idle) - should clear grid and set results title/sub back to initial
    await app.clickReset();

    // After reset, the grid cells should return to '—' and execute be enabled
    for (let r = 1; r <= 5; r++) {
      for (let c = 1; c <= 3; c++) {
        await page.waitForFunction(
          (r, c) => {
            const el = document.getElementById(`r${r}c${c}`);
            return el && el.textContent && el.textContent.trim() === '—';
          },
          r, c,
          { timeout: 3000 }
        );
        expect(await app.getCellText(r, c)).toBe('—');
      }
    }

    const titleAfterReset = await app.getResultsTitleText();
    expect(titleAfterReset).toBe('Results (5 rows)');

    // Now test reset while running is ignored:
    // Start another execution and quickly click reset; reset should not clear mid-run due to running guard
    await app.clickExecute();

    // Immediately attempt reset
    await app.clickReset();

    // Because reset handler checks `if(running) return;`, grid should still be populated at end of run.
    await app.waitForResultsCompleted(10000);
    await app.waitForExecuteEnabled(5000);

    // Validate that row 1 contains the name again (i.e., reset did not clear while running)
    const r1NamePost = await app.getCellText(1, 1);
    expect(r1NamePost).toBe('Alexandra Greene');
  });

  test('Edge case: multiple consecutive resets and rapid interactions do not cause uncaught errors', async ({ page }) => {
    // This test stresses reset behavior and rapid clicks to detect potential race conditions.
    const app = new SqlVizPage(page);

    // Perform multiple resets in a row while idle - should be idempotent
    await app.clickReset();
    await app.clickReset();
    await app.clickReset();

    // The grid remains placeholders and execute remains enabled
    for (let r = 1; r <= 5; r++) {
      for (let c = 1; c <= 3; c++) {
        expect(await app.getCellText(r, c)).toBe('—');
      }
    }
    expect(await app.isExecuteDisabled()).toBe(false);

    // Start an execution and spam reset / execute clicks (simulate a power user)
    await app.clickExecute();

    // Rapid interactions during run: try clicking reset and execute several times
    for (let i = 0; i < 5; i++) {
      try { await app.execute.click({ timeout: 200 }); } catch (e) {}
      try { await app.reset.click({ timeout: 200 }); } catch (e) {}
    }

    // Wait for natural completion and ensure application recovers to idle
    await app.waitForResultsCompleted(10000);
    await app.waitForExecuteEnabled(5000);

    expect(await app.isExecuteDisabled()).toBe(false);
    // Verify a representative cell is populated, indicating normal completion
    expect(await app.getCellText(3, 1)).toBe('Priya Kaur');
  });

  test('Instrumentation: observe console and page error channels (should be empty)', async ({ page }) => {
    // This test validates we are observing the console and pageerror channels properly.
    // It will purposely not cause errors; we assert there were none.
    // The afterEach hook will also assert no errors - here we do an explicit extra check.

    // Simple sanity access to captured arrays
    // These properties are set during beforeEach hook
    expect(Array.isArray(page.__consoleErrors)).toBe(true);
    expect(Array.isArray(page.__pageErrors)).toBe(true);

    expect(page.__consoleErrors.length).toBe(0);
    expect(page.__pageErrors.length).toBe(0);
  });
});