import { test, expect } from '@playwright/test';

// Test file for Application ID: 72abda12-fa78-11f0-812d-c9788050701f
// Validates FSM states and transitions for the "SQL Visual Elegance" demo.
// URL served at: http://127.0.0.1:5500/workspace/0126-biased/html/72abda12-fa78-11f0-812d-c9788050701f.html

// Page Object for interacting with the demo page
class QueryPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/72abda12-fa78-11f0-812d-c9788050701f.html';
    this.button = page.locator('#queryBtn');
    this.demo = page.locator('#queryDemo');
    this.tableBody = page.locator('#resultTable tbody');
    this.rows = page.locator('#resultTable tbody tr');
  }

  async goto() {
    await this.page.goto(this.url);
    // Wait for DOMContentLoaded and initial animations (script sets a timeout for .visible)
    await this.page.waitForLoadState('domcontentloaded');
  }

  async clickExecute() {
    await this.button.click();
  }

  async getButtonText() {
    return await this.button.textContent();
  }

  async hasFloatingClass() {
    return await this.button.evaluate((el) => el.classList.contains('floating'));
  }

  async rowCount() {
    return await this.rows.count();
  }

  async getRowText(rowIndex) {
    const row = this.rows.nth(rowIndex);
    return await row.allTextContents();
  }
}

// Collect console and page errors for each test
test.describe('SQL Visual Elegance - FSM and UI tests (72abda12-fa78-11f0-812d-c9788050701f)', () => {
  let consoleEvents;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleEvents = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      // store type and text for assertions
      consoleEvents.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test, assert that there were no uncaught page errors
    // and no console errors (including ReferenceError, SyntaxError, TypeError).
    // This validates that the page runs without runtime exceptions during interactions.
    const errorConsoleMessages = consoleEvents.filter(e => e.type === 'error' || /error/i.test(e.type));
    const relevantTextErrors = consoleEvents.filter(e =>
      /ReferenceError|SyntaxError|TypeError/.test(e.text)
    );

    // Assert no pageerror events captured
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);

    // Assert no console-level errors
    expect(errorConsoleMessages.length, `Console errors: ${JSON.stringify(errorConsoleMessages)}`).toBe(0);

    // Assert none of the console messages included common JS error names
    expect(relevantTextErrors.length, `Console contained Reference/Syntax/Type errors: ${JSON.stringify(relevantTextErrors)}`).toBe(0);
  });

  test.describe('Initial load and Idle state (S0_Idle)', () => {
    test('renders page and shows Idle state with Execute Query button (S0_Idle)', async ({ page }) => {
      const qp = new QueryPage(page);
      await qp.goto();

      // Validate initial DOM: button exists with text "Execute Query" and has class 'floating'
      await expect(qp.button).toBeVisible();
      await expect(qp.button).toHaveText('Execute Query');

      const hasFloating = await qp.hasFloatingClass();
      expect(hasFloating).toBe(true);

      // The demo content should become visible after the small startup timeout (300ms in script)
      await expect(qp.demo).toHaveClass(/visible/, { timeout: 1000 });
    });
  });

  test.describe('Execute query transitions and visual changes', () => {
    test('clicking Execute Query transitions to Executing state (S1_QueryExecuting)', async ({ page }) => {
      const qp = new QueryPage(page);
      await qp.goto();

      // Click the Execute Query button and immediately validate S1 transition
      await qp.clickExecute();

      // Immediately after click: text should be 'Executing...' and 'floating' class removed
      await expect(qp.button).toHaveText('Executing...', { timeout: 200 });
      const floatingAfterClick = await qp.hasFloatingClass();
      expect(floatingAfterClick).toBe(false);
    });

    test('query finishes (S2_QueryExecuted) and table is populated, then resets to Idle (S0_Idle)', async ({ page }) => {
      const qp = new QueryPage(page);
      await qp.goto();

      // Click to start execution
      const clickTime = Date.now();
      await qp.clickExecute();

      // Wait for Query Executed state: script uses setTimeout 800ms to set 'Query Executed'
      await expect(qp.button).toHaveText('Query Executed', { timeout: 1500 });

      // Validate table population: expected 5 rows inserted
      // Wait for rows to be added (some animation time applied). Give margin.
      await expect(qp.rows).toHaveCount(5, { timeout: 1500 });

      // Validate specific content in first row to ensure correct insertion order and values
      const firstRowTexts = await qp.getRowText(0);
      // Based on the sampleData in the page, first row's customer_id is 1023 and first name Eleanor
      const firstRowConcatenated = firstRowTexts.join(' ');
      expect(firstRowConcatenated).toContain('1023');
      expect(firstRowConcatenated).toContain('Eleanor');

      // Validate rows' final visual state (opacity should become '1' after their transition)
      // Wait briefly for row animation transitions to complete
      await page.waitForTimeout(600);
      for (let i = 0; i < 5; i++) {
        const opacity = await qp.rows.nth(i).evaluate((r) => {
          return window.getComputedStyle(r).opacity;
        });
        expect(opacity === '1' || opacity === 1 || parseFloat(opacity) > 0.9).toBe(true);
      }

      // After additional 2000ms (set in script) the button should reset back to 'Execute Query' and 'floating' re-added
      // We allow a generous timeout from the click moment
      await expect(qp.button).toHaveText('Execute Query', { timeout: 4000 });
      const floatingAfterReset = await qp.hasFloatingClass();
      expect(floatingAfterReset).toBe(true);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('rapid multiple clicks do not throw and final state is consistent', async ({ page }) => {
      const qp = new QueryPage(page);
      await qp.goto();

      // Rapidly click the button multiple times to try and provoke race conditions
      await qp.button.click();
      // small immediate second click (while 'Executing...' likely set)
      await qp.button.click();
      await qp.button.click();

      // The page's handler clears tbody and sets 'Executing...' each click and schedules timeouts.
      // Ensure we still reach the 'Query Executed' state once within expected timeframe
      await expect(qp.button).toHaveText('Query Executed', { timeout: 2000 });

      // Validate table has 5 rows (final result of the last execution should be present)
      await expect(qp.rows).toHaveCount(5, { timeout: 2000 });

      // Finally, ensure the button returns to Idle text and floating class after reset delay
      await expect(qp.button).toHaveText('Execute Query', { timeout: 5000 });
      const floating = await qp.hasFloatingClass();
      expect(floating).toBe(true);
    });

    test('clicking while in S2_QueryExecuted restarts the cycle correctly', async ({ page }) => {
      const qp = new QueryPage(page);
      await qp.goto();

      // First click to get to Query Executed
      await qp.clickExecute();
      await expect(qp.button).toHaveText('Query Executed', { timeout: 1500 });

      // Click again while 'Query Executed' (S2) is active; this should start the execution cycle again
      await qp.clickExecute();

      // Immediately after clicking from S2, button should show 'Executing...' again
      await expect(qp.button).toHaveText('Executing...', { timeout: 300 });
      const floatingAfterClick = await qp.hasFloatingClass();
      expect(floatingAfterClick).toBe(false);

      // Wait for the subsequent execution to finish and then reset
      await expect(qp.button).toHaveText('Query Executed', { timeout: 1500 });
      await expect(qp.rows).toHaveCount(5, { timeout: 1500 });
      await expect(qp.button).toHaveText('Execute Query', { timeout: 4000 });
      const floatingFinal = await qp.hasFloatingClass();
      expect(floatingFinal).toBe(true);
    });

    test('no ReferenceError/SyntaxError/TypeError appear in console during interactions (observability)', async ({ page }) => {
      const qp = new QueryPage(page);
      await qp.goto();

      // Perform a normal interaction
      await qp.clickExecute();

      // Wait for the execution to complete
      await expect(qp.button).toHaveText('Query Executed', { timeout: 1500 });
      await expect(qp.rows).toHaveCount(5, { timeout: 1500 });

      // At this point, the afterEach hook will assert that there are no runtime errors.
      // To be explicit here, also assert the captured console events do not contain JS errors.
      const errors = consoleEvents.filter(e => /ReferenceError|SyntaxError|TypeError|error/i.test(e.text) || e.type === 'error');
      expect(errors.length).toBe(0);
    });
  });
});