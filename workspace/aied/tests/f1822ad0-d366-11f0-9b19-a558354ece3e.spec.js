import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f1822ad0-d366-11f0-9b19-a558354ece3e.html';

// Page Object Model for the LCS page
class LCSPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.sequence1 = page.locator('#sequence1');
    this.sequence2 = page.locator('#sequence2');
    this.calculateButton = page.locator('button[onclick="calculateLCS()"]');
    this.resultSection = page.locator('#resultSection');
    this.lcsResult = page.locator('#lcsResult');
    this.lengthResult = page.locator('#lengthResult');
    this.matrixTableContainer = page.locator('#matrixTable');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async setSequence1(value) {
    await this.sequence1.fill(value);
  }

  async setSequence2(value) {
    await this.sequence2.fill(value);
  }

  async getSequence1() {
    return this.sequence1.inputValue();
  }

  async getSequence2() {
    return this.sequence2.inputValue();
  }

  async clickCalculate() {
    await this.calculateButton.click();
  }

  async isResultVisible() {
    // Ensure DOM presence and computed style for visibility
    const display = await this.page.evaluate(() => {
      const el = document.getElementById('resultSection');
      if (!el) return null;
      return window.getComputedStyle(el).display;
    });
    return display !== null && display !== 'none';
  }

  async getLcsText() {
    return this.lcsResult.textContent();
  }

  async getLengthText() {
    return this.lengthResult.textContent();
  }

  async getMatrixTableElement() {
    return this.matrixTableContainer.locator('table');
  }

  async getHeaderCellCount() {
    // count <th> in first row of the table
    const ths = this.matrixTableContainer.locator('table tr').first().locator('th');
    return ths.count();
  }

  async getRowCount() {
    return this.matrixTableContainer.locator('table tr').count();
  }

  async getHighlightCount() {
    return this.matrixTableContainer.locator('table td.lcs-highlight').count();
  }
}

test.describe('LCS App - FSM and UI tests (f1822ad0-d366-11f0-9b19-a558354ece3e)', () => {
  let consoleErrors;
  let pageErrors;

  // Global setup: capture console errors and page errors for each test
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      try {
        // capture only errors (console.error)
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location()
          });
        }
      } catch (e) {
        // If something odd happens while reading console, capture generic info
        consoleErrors.push({ text: `Failed to read console message: ${String(e)}` });
      }
    });

    page.on('pageerror', error => {
      // pageerror gives Error objects for uncaught exceptions
      pageErrors.push({
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    });
  });

  // After each test, assert that there are no unexpected console/page errors.
  // This ensures we observe runtime errors if they happen and fail tests accordingly.
  test.afterEach(async () => {
    // Provide helpful debug information on failure
    if (consoleErrors.length > 0 || pageErrors.length > 0) {
      // Throw a combined error so Playwright reports the problem clearly
      const details = [
        consoleErrors.length ? `Console errors (${consoleErrors.length}):\n${consoleErrors.map(e => JSON.stringify(e)).join('\n')}` : '',
        pageErrors.length ? `Page errors (${pageErrors.length}):\n${pageErrors.map(e => `${e.name}: ${e.message}`).join('\n')}` : ''
      ].filter(Boolean).join('\n\n');

      // Fail the test if any JS errors or console errors were captured
      throw new Error(`JavaScript runtime issues detected during the test:\n\n${details}`);
    }
  });

  // Test 1: Verify initial load triggers calculateLCS (S0_Idle entry action) and shows results (S1_ResultsVisible)
  test('Initial load should run calculateLCS and display results (Idle -> Results Visible)', async ({ page }) => {
    // This test validates FSM initial state's entry action (window.onload = calculateLCS)
    // and the transition to the results visible state.
    const lcsPage = new LCSPage(page);

    // Navigate to the application
    await lcsPage.goto();

    // Wait for the result section to be displayed as the page's onload triggers calculation
    await expect(lcsPage.resultSection).toBeVisible();

    // Verify the result section style indicates visible (evidence: document.getElementById('resultSection').style.display = 'block';)
    const visible = await lcsPage.isResultVisible();
    expect(visible, 'resultSection should be displayed (visible)').toBe(true);

    // Verify default LCS calculation result for the provided default sequences
    // Default sequences from HTML: sequence1 = "ABCDGH", sequence2 = "AEDFHR"
    // Expected LCS: "ADH" with length 3
    const lcsText = await lcsPage.getLcsText();
    const lengthText = await lcsPage.getLengthText();
    expect(lcsText).toBe('LCS: ADH');
    expect(lengthText).toBe('Length: 3');

    // Verify matrix has correct dimensions:
    // seq1 length = 6 -> rows = m+1 = 7
    // seq2 length = 6 -> header th count = 2 + n = 8
    const headerCount = await lcsPage.getHeaderCellCount();
    const rowCount = await lcsPage.getRowCount();
    expect(headerCount).toBe(8);
    expect(rowCount).toBe(7);

    // Verify highlight count equals the LCS length (3 matches for A, D, H)
    const highlightCount = await lcsPage.getHighlightCount();
    expect(highlightCount).toBe(3);
  });

  // Test 2: Changing inputs and clicking Calculate LCS should update results and matrix accordingly
  test('Changing sequences and clicking Calculate updates LCS and matrix correctly (CalculateLCS event)', async ({ page }) => {
    // This test validates the CalculateLCS event and the transition S0 -> S1 when initiated by user click.
    const lcsPage = new LCSPage(page);
    await lcsPage.goto();

    // Set simple identical sequences so outcome is deterministic
    await lcsPage.setSequence1('ABC');
    await lcsPage.setSequence2('ABC');

    // Click the calculate button
    await lcsPage.clickCalculate();

    // After clicking, result section must be visible and updated
    await expect(lcsPage.resultSection).toBeVisible();
    const lcsText = await lcsPage.getLcsText();
    const lengthText = await lcsPage.getLengthText();
    expect(lcsText).toBe('LCS: ABC');
    expect(lengthText).toBe('Length: 3');

    // Validate matrix dimensions for these sequences:
    // seq1 length = 3 -> rows = 4
    // header th count = 2 + n = 5
    const headerCount = await lcsPage.getHeaderCellCount();
    const rowCount = await lcsPage.getRowCount();
    expect(headerCount).toBe(5);
    expect(rowCount).toBe(4);

    // There should be 3 highlighted cells corresponding to the three matching characters
    const highlightCount = await lcsPage.getHighlightCount();
    expect(highlightCount).toBe(3);

    // Clicking multiple times should not duplicate tables: the container should still contain exactly one table
    await lcsPage.clickCalculate();
    const tableCount = await lcsPage.matrixTableContainer.locator('table').count();
    expect(tableCount).toBe(1);
  });

  // Test 3: Edge case - missing input should trigger an alert and not crash the app
  test('Clicking Calculate with an empty sequence should show an alert and not fail (edge case)', async ({ page }) => {
    // This test validates the application's handling of invalid user input (empty sequences).
    // It also ensures no uncaught JS exceptions occur when this path is taken.
    const lcsPage = new LCSPage(page);
    await lcsPage.goto();

    // Start with a known result by setting both sequences to "ABC"
    await lcsPage.setSequence1('ABC');
    await lcsPage.setSequence2('ABC');
    await lcsPage.clickCalculate();
    await expect(lcsPage.lcsResult).toHaveText('LCS: ABC');

    // Now clear sequence2 to trigger alert
    await lcsPage.setSequence2('');

    // Handle the alert dialog that should appear
    let dialogMessage = null;
    page.on('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Click calculate which should trigger alert('Please enter both sequences')
    await lcsPage.clickCalculate();

    // Ensure the alert dialog was seen and had the correct message
    expect(dialogMessage).toBe('Please enter both sequences');

    // Ensure the existing results remain (no crash and no clearing)
    const lcsTextAfter = await lcsPage.getLcsText();
    expect(lcsTextAfter).toBe('LCS: ABC');

    // Also ensure result section is still visible after the alert (app didn't hide it unexpectedly)
    const visible = await lcsPage.isResultVisible();
    expect(visible).toBe(true);
  });

  // Test 4: Verify displayResults behavior: successive calculations replace the matrix (no duplicates)
  test('Repeated calculations should replace the matrix instead of appending multiple tables', async ({ page }) => {
    // This test checks that displayResults clears the matrixTable container before appending a new table.
    const lcsPage = new LCSPage(page);
    await lcsPage.goto();

    // Compute once with default values (onload already did this), then change to new sequences and compute
    await lcsPage.setSequence1('AAAA');
    await lcsPage.setSequence2('AAAA');
    await lcsPage.clickCalculate();

    // After calculation there should be exactly one table
    let tableCount = await lcsPage.matrixTableContainer.locator('table').count();
    expect(tableCount).toBe(1);

    // Compute again with different values and assert there is still only one table element
    await lcsPage.setSequence1('XYZ');
    await lcsPage.setSequence2('XYZ');
    await lcsPage.clickCalculate();

    tableCount = await lcsPage.matrixTableContainer.locator('table').count();
    expect(tableCount).toBe(1);

    // And the LCS text should reflect the latest calculation
    expect(await lcsPage.getLcsText()).toBe('LCS: XYZ');
  });

  // Test 5: Assertions about absence of runtime ReferenceError/SyntaxError/TypeError
  test('No uncaught ReferenceError, SyntaxError, or TypeError should occur during normal interactions', async ({ page }) => {
    // This test specifically observes uncaught runtime errors (pageerror) and console errors,
    // and ensures none of the common JS error types are present.
    const lcsPage = new LCSPage(page);
    await lcsPage.goto();

    // Perform a few interactions to exercise code paths
    await lcsPage.setSequence1('HELLO');
    await lcsPage.setSequence2('HELLO');
    await lcsPage.clickCalculate();

    await lcsPage.setSequence1('WORLD');
    await lcsPage.setSequence2('WORD');
    await lcsPage.clickCalculate();

    // After interactions, ensure no captured page errors or console errors refer to ReferenceError/SyntaxError/TypeError
    // The afterEach hook will fail the test if any page/console errors were captured.
    // For explicitness also assert that none of the captured page errors are of these types.
    for (const err of pageErrors) {
      expect(['ReferenceError', 'SyntaxError', 'TypeError']).not.toContain(err.name);
    }

    // Similarly ensure console error messages do not contain these indicative strings
    for (const c of consoleErrors) {
      const text = String(c.text).toLowerCase();
      expect(text).not.toContain('referenceerror'.toLowerCase());
      expect(text).not.toContain('syntaxerror'.toLowerCase());
      expect(text).not.toContain('typeerror'.toLowerCase());
    }
  });
});