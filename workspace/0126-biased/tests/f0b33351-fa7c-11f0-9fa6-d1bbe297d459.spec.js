import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b33351-fa7c-11f0-9fa6-d1bbe297d459.html';

/**
 * Page Object representing the Time Complexity demo page.
 * Encapsulates selectors and common interactions to keep tests readable.
 */
class TimeComplexityPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demoButton');
    this.output = page.locator('#demoOutput');
    this.outputTableRows = () => this.output.locator('table tr');
  }

  // Navigate to the app and wait for load
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Click the demo button and wait for any DOM updates
  async clickDemoButton() {
    await this.button.click();
    // Wait for the output to become visible (it changes display to 'block')
    await this.page.waitForFunction(
      () => {
        const el = document.getElementById('demoOutput');
        return el && window.getComputedStyle(el).display !== 'none';
      },
      undefined,
      { timeout: 2000 }
    );
  }

  // Returns whether the output container is visible (display !== 'none')
  async isOutputVisible() {
    return await this.page.evaluate(() => {
      const el = document.getElementById('demoOutput');
      return !!el && window.getComputedStyle(el).display !== 'none';
    });
  }

  // Get the raw HTML inside the output container
  async getOutputHTML() {
    return await this.output.innerHTML();
  }

  // Count number of <tr> rows in the table inside the output (includes header)
  async getTableRowCount() {
    return await this.outputTableRows().count();
  }

  // Count number of <table> elements inside the output
  async getTableCount() {
    return await this.output.locator('table').count();
  }

  // Find a table row by the first cell text (value of n), return the full text content
  async getRowTextForN(nValue) {
    const rows = this.outputTableRows();
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const firstCell = row.locator('td').first();
      if (await firstCell.count() === 0) continue; // skip header
      const txt = (await firstCell.textContent())?.trim();
      if (txt === String(nValue)) {
        return (await row.textContent())?.trim() ?? '';
      }
    }
    return null;
  }
}

test.describe('Time Complexity FSM - f0b33351-fa7c-11f0-9fa6-d1bbe297d459', () => {
  // Capture console messages and page errors per test, to validate runtime issues (if any).
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (type and text)
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // In case msg.text() throws for some message types, capture fallback
        consoleMessages.push({ type: msg.type(), text: String(msg) });
      }
    });

    // Collect any unhandled page errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });
  });

  test.afterEach(async ({ page }) => {
    // Attach debug info to the test output if there were page errors or console messages.
    if (pageErrors.length > 0) {
      console.error('Captured page errors:', pageErrors);
    }
    if (consoleMessages.length > 0) {
      console.info('Captured console messages:', consoleMessages);
    }
    // No teardown needed beyond this; Playwright closes page automatically.
  });

  test('Initial state S0_Idle: renderPage should present the button and hide demo output', async ({ page }) => {
    // This test validates the S0_Idle state described in the FSM:
    // - renderPage() is expected on entry (we infer via initial DOM)
    // - #demoButton exists and is visible
    // - #demoOutput exists and is hidden (display: none)
    const app = new TimeComplexityPage(page);
    await app.goto();

    // Assert button is present and visible
    await expect(app.button).toBeVisible();
    await expect(app.button).toHaveText('Show Time Complexity Comparison');

    // Assert output container is present but not visible
    const outputExists = await page.locator('#demoOutput').count();
    expect(outputExists).toBe(1);
    const isVisible = await app.isOutputVisible();
    expect(isVisible).toBe(false); // display should be 'none' initially

    // There should be no table content initially
    const tableCount = await app.getTableCount();
    expect(tableCount).toBe(0);

    // Assert that no page errors occurred during initial render
    expect(pageErrors).toEqual([]);
  });

  test('Transition ShowTimeComplexity: clicking button transitions S0_Idle -> S1_ComparisonVisible and displays table', async ({ page }) => {
    // Validates the transition triggered by clicking #demoButton:
    // - displayComparison() should set #demoOutput.style.display = 'block'
    // - output should contain a table with expected number of rows and text
    const app = new TimeComplexityPage(page);
    await app.goto();

    // Click the demo button to trigger the transition
    await app.clickDemoButton();

    // After click, the output must be visible (S1_ComparisonVisible)
    expect(await app.isOutputVisible()).toBe(true);

    // The output should include the heading and explanatory text
    const html = await app.getOutputHTML();
    expect(html).toContain('Time Complexity Growth Rates');
    expect(html).toContain('Number of operations for input size n:');

    // The table should be present and contain the header row + one row per size.
    // The implementation uses sizes = [1,2,4,8,16,32,64,128] (8 sizes) + 1 header = 9 <tr>
    const expectedRows = 1 + 8; // header + sizes
    const actualRowCount = await app.getTableRowCount();
    expect(actualRowCount).toBe(expectedRows);

    // Validate one specific row's computed values to ensure displayComparison computed and inserted values:
    // For n=8: log2(8) = 3, O(n) = 8, O(n log n) = 8 * 3 = 24, O(n^2) = 64, O(2^n) = 256
    const rowTextFor8 = await app.getRowTextForN(8);
    expect(rowTextFor8).not.toBeNull();
    expect(rowTextFor8).toContain('8'); // first cell
    // Check for values (some may have spacing/newlines; check for essential numeric pieces)
    expect(rowTextFor8).toMatch(/3/);     // log2(n) value appears somewhere
    expect(rowTextFor8).toMatch(/8/);     // O(n)
    expect(rowTextFor8).toMatch(/24/);    // O(n log n)
    expect(rowTextFor8).toMatch(/64/);    // O(n^2)
    expect(rowTextFor8).toMatch(/256/);   // O(2^n)

    // Assert no page errors happened during the interaction
    expect(pageErrors).toEqual([]);
  });

  test('Repeated interactions: multiple clicks are idempotent and do not create duplicate tables', async ({ page }) => {
    // This test validates robustness of transition when the user clicks multiple times rapidly.
    // It also ensures no runtime errors occur during repeated transitions.
    const app = new TimeComplexityPage(page);
    await app.goto();

    // Click multiple times quickly
    await Promise.all([
      app.button.click(),
      app.button.click(),
      app.button.click()
    ]);

    // Wait for output to be visible
    await page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      return el && window.getComputedStyle(el).display !== 'none';
    });

    // There should still be only one table element inside #demoOutput (script replaces innerHTML)
    const tableCount = await app.getTableCount();
    expect(tableCount).toBe(1);

    // And rows should be the expected count (no duplication)
    const rowCount = await app.getTableRowCount();
    expect(rowCount).toBe(1 + 8);

    // No unhandled page errors should have been captured
    expect(pageErrors).toEqual([]);
  });

  test('Edge case: attempting to interact with a non-existent element throws an error from Playwright', async ({ page }) => {
    // This test intentionally tries to click a non-existent selector to assert Playwright surfaces an error.
    // This validates error scenarios and that our test harness captures them (we do not modify application code).
    const app = new TimeComplexityPage(page);
    await app.goto();

    let thrown = false;
    try {
      // This will cause Playwright to throw as the element does not exist
      await page.click('#nonExistentButton', { timeout: 1000 });
    } catch (err) {
      thrown = true;
      // Ensure the thrown error is meaningful (timeout or locator not found)
      expect(String(err.message)).toMatch(/(Timeout|No node found|Element|selector)/i);
    }
    expect(thrown).toBe(true);

    // Ensure the app itself did not record any runtime page errors due to our test attempt
    expect(pageErrors).toEqual([]);
  });

  test('Content sanity: values across multiple rows match expected computations for several n values', async ({ page }) => {
    // Validate computed table values for multiple n values to ensure displayComparison() performed math correctly.
    const app = new TimeComplexityPage(page);
    await app.goto();
    await app.clickDemoButton();

    // Map of n -> expected computed values (log2 rounded via Math.round in implementation)
    const expectedMap = {
      1: { log2: Math.round(Math.log2(1)), n: 1, nlogn: Math.round(1 * Math.log2(1)), nsq: 1, pow2: Math.pow(2, 1) },
      2: { log2: Math.round(Math.log2(2)), n: 2, nlogn: Math.round(2 * Math.log2(2)), nsq: 4, pow2: Math.pow(2, 2) },
      4: { log2: Math.round(Math.log2(4)), n: 4, nlogn: Math.round(4 * Math.log2(4)), nsq: 16, pow2: Math.pow(2, 4) },
      16: { log2: Math.round(Math.log2(16)), n: 16, nlogn: Math.round(16 * Math.log2(16)), nsq: 256, pow2: Math.pow(2, 16) }
    };

    for (const nStr of Object.keys(expectedMap)) {
      const n = Number(nStr);
      const expected = expectedMap[n];
      const rowText = await app.getRowTextForN(n);
      expect(rowText).not.toBeNull();
      // Check presence of expected numbers in the row text (string matching is sufficient)
      expect(rowText).toContain(String(expected.log2));
      expect(rowText).toContain(String(expected.n));
      expect(rowText).toContain(String(expected.nlogn));
      expect(rowText).toContain(String(expected.nsq));
      expect(rowText).toContain(String(expected.pow2));
    }

    // No unhandled page errors should have been captured
    expect(pageErrors).toEqual([]);
  });
});