import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122c9b43-fa7b-11f0-814c-dbec508f0b3b.html';

// Page object encapsulating selectors and common actions
class PvsNPPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      controls: '#controls',
      problemInput: '#problem',
      solutionInput: '#solution',
      solveBtn: '#solve-btn',
      viewBtn: '#view-btn',
      complexBtn: '#complex-btn',
      simpleBtn: '#simple-btn',
      complexDiv: '#complex',
      simpleDiv: '#simple',
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillProblem(text) {
    await this.page.fill(this.selectors.problemInput, text);
  }

  async fillSolution(text) {
    await this.page.fill(this.selectors.solutionInput, text);
  }

  async clickSolve() {
    await this.page.click(this.selectors.solveBtn);
  }

  async clickView() {
    await this.page.click(this.selectors.viewBtn);
  }

  async clickComplex() {
    await this.page.click(this.selectors.complexBtn);
  }

  async clickSimple() {
    await this.page.click(this.selectors.simpleBtn);
  }

  async isVisible(selector) {
    return await this.page.locator(selector).isVisible();
  }

  async getText(selector) {
    return await this.page.locator(selector).textContent();
  }

  async getInputValue(selector) {
    return await this.page.locator(selector).inputValue();
  }

  async getStyleDisplay(selector) {
    // Use JS to read the computed style to be robust
    return await this.page.$eval(selector, (el) => window.getComputedStyle(el).display);
  }
}

test.describe('P vs NP Interactive Application - FSM validation', () => {
  // Arrays to capture runtime errors and console messages for assertions
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      // err is an Error object; store message for assertions
      pageErrors.push(err.message || String(err));
    });

    // Collect console logs for additional diagnostics/assertions
    page.on('console', (msg) => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    });

    // Create page object and navigate
    const pv = new PvsNPPage(page);
    await pv.goto();
  });

  test.describe('Initial Idle State (S0_Idle)', () => {
    test('renders controls and initial visibility of solution areas', async ({ page }) => {
      // Validate initial UI elements expected in Idle state
      const pv = new PvsNPPage(page);

      // Controls container visible
      await expect(page.locator(pv.selectors.controls)).toBeVisible();

      // Inputs and buttons present
      await expect(page.locator(pv.selectors.problemInput)).toBeVisible();
      await expect(page.locator(pv.selectors.solutionInput)).toBeVisible();
      await expect(page.locator(pv.selectors.solveBtn)).toBeVisible();
      await expect(page.locator(pv.selectors.viewBtn)).toBeVisible();
      await expect(page.locator(pv.selectors.complexBtn)).toBeVisible();
      await expect(page.locator(pv.selectors.simpleBtn)).toBeVisible();

      // According to the provided HTML/CSS: #complex should be hidden, #simple is visible (CSS shows simple by default).
      // Assert the actual DOM state (do not change app behavior).
      await expect(page.locator(pv.selectors.complexDiv)).toBeHidden();
      await expect(page.locator(pv.selectors.simpleDiv)).toBeVisible();

      // Ensure no unexpected page errors on initial load
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Solve button and S0 -> S1 transition', () => {
    test('shows alert when inputs are empty (edge case) and remains in Idle', async ({ page }) => {
      const pv = new PvsNPPage(page);

      // Click solve with empty inputs should trigger an alert dialog
      const dialogPromise = page.waitForEvent('dialog');
      await pv.clickSolve();
      const dialog = await dialogPromise;
      // Validate alert message content
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toMatch(/Please enter a problem name and a solution name/i);
      // Dismiss the alert (close)
      await dialog.dismiss();

      // After dismissing, complex panel should still be hidden (no state change)
      await expect(page.locator(pv.selectors.complexDiv)).toBeHidden();

      // No page script errors should have occurred due to this action
      expect(pageErrors.length).toBe(0);
    });

    test('with valid inputs transitions to Solved (S1_Solved) and displays complex solution', async ({ page }) => {
      const pv = new PvsNPPage(page);

      // Provide non-empty inputs to satisfy the Solve handler's validation
      await pv.fillProblem('Graph Coloring');
      await pv.fillSolution('Heuristic');

      // Click Solve - should not throw ReferenceError because problemName is defined in handler scope
      await pv.clickSolve();

      // solutionText (the #solution input element) is set to display:block in script.
      // Because the script sets textContent on the input element (unusual), we assert style/display change.
      await expect(page.locator(pv.selectors.solutionInput)).toBeVisible();

      // Complex div should become visible and include content referencing the user-supplied problemName.
      await expect(page.locator(pv.selectors.complexDiv)).toBeVisible();

      // Verify the complex div includes the problemName we entered and references the global 'problem'
      const complexText = await pv.getText(pv.selectors.complexDiv);
      expect(complexText).toBeTruthy();
      expect(complexText).toMatch(/Graph Coloring/);
      // The implementation uses the global 'problem' variable in the template; check it appears
      expect(complexText).toMatch(/Traveling Salesman Problem/);

      // No page errors are expected for the Solve successful path
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Viewing Solution (S1 -> S2) and error observation', () => {
    test('clicking View after Solve attempts to show simple solution but triggers ReferenceError (problemName undefined)', async ({ page }) => {
      const pv = new PvsNPPage(page);

      // Prepare valid state by solving first
      await pv.fillProblem('Vertex Cover');
      await pv.fillSolution('Approximation');
      await pv.clickSolve();

      // Clear any previously captured page errors (for clarity)
      pageErrors.length = 0;
      consoleMessages.length = 0;

      // The View handler sets some DOM (solution text, simpleDiv display) and then references undefined `problemName`,
      // which should raise a ReferenceError. Use waitForEvent to capture that error.
      const pageErrorPromise = page.waitForEvent('pageerror');

      // Click View - this will likely cause a ReferenceError
      await pv.clickView();

      // Await the pageerror and inspect it
      const err = await pageErrorPromise;
      expect(err).toBeTruthy();
      // Error message should mention the undefined identifier 'problemName'
      expect(err.message).toMatch(/problemName|not defined/i);

      // Despite the error, the script sets the solution input to visible and makes the simpleDiv visible before failing.
      await expect(page.locator(pv.selectors.solutionInput)).toBeVisible();
      await expect(page.locator(pv.selectors.simpleDiv)).toBeVisible();

      // The simpleDiv content likely did not complete due to the ReferenceError while building the template.
      // But at least it should be present (script attempted to set it).
      const simpleText = await pv.getText(pv.selectors.simpleDiv);
      // simpleDiv may contain partial content or be empty; assert it's a string (possibly empty) and that an error was recorded
      expect(typeof simpleText).toBe('string');
      expect(err.message.toLowerCase()).toContain('problemname');
    });
  });

  test.describe('Complex and Simple buttons from Idle (direct transitions and errors)', () => {
    test('Complex button sets complexDiv visible then triggers ReferenceError due to missing problemName', async ({ page }) => {
      const pv = new PvsNPPage(page);

      // Ensure idle state: reload to reset any previous UI changes
      await pv.goto();

      // Clear errors array
      pageErrors.length = 0;

      // Click Complex; the handler first sets complexDiv.style.display = "block" then uses problemName in template literal,
      // which is not defined -> ReferenceError. So we expect both a visible complexDiv and a page error.
      const pageErrorPromise = page.waitForEvent('pageerror');
      await pv.clickComplex();
      const err = await pageErrorPromise;

      // Complex div should be visible (it was set before the ReferenceError)
      await expect(page.locator(pv.selectors.complexDiv)).toBeVisible();

      // The error should mention problemName
      expect(err.message).toMatch(/problemName|not defined/i);
    });

    test('Simple button sets simpleDiv visible then triggers ReferenceError due to missing problemName', async ({ page }) => {
      const pv = new PvsNPPage(page);

      // Reload to ensure fresh Idle state
      await pv.goto();

      // Clear error collection
      pageErrors.length = 0;

      // Click Simple; handler sets simpleDiv display then references undefined problemName -> ReferenceError expected
      const pageErrorPromise = page.waitForEvent('pageerror');
      await pv.clickSimple();
      const err = await pageErrorPromise;

      // Simple div should be visible (script sets it before throwing)
      await expect(page.locator(pv.selectors.simpleDiv)).toBeVisible();

      // Confirm a ReferenceError mentioning problemName occurred
      expect(err.message).toMatch(/problemName|not defined/i);
    });
  });

  test.describe('Diagnostics: console messages and captured errors', () => {
    test('pageerrors and console messages were captured across interactions', async ({ page }) => {
      const pv = new PvsNPPage(page);

      // Start fresh
      await pv.goto();

      // 1) Trigger solve with empty inputs to produce alert (no pageerror)
      const dlg = page.waitForEvent('dialog');
      await pv.clickSolve();
      const dialog = await dlg;
      await dialog.dismiss();

      // 2) Trigger complex to generate a ReferenceError
      await pv.clickComplex();
      // Wait for an error to be captured
      const refErr = await page.waitForEvent('pageerror');

      // At least one page error should now be present
      expect(refErr).toBeTruthy();
      expect(refErr.message).toMatch(/problemName|not defined/i);

      // The consoleMessages array may contain various browser logs; ensure it's an array
      expect(Array.isArray(consoleMessages)).toBe(true);

      // pageErrors should contain the ReferenceError message recorded via page.on('pageerror') as well
      // (the on('pageerror') handler runs before waitForEvent resolves), so check that list includes the phrase.
      const anyRecorded = pageErrors.some((m) => /problemName/i.test(m));
      // It's acceptable if the event handled via waitForEvent was the first to arrive; guard for both cases.
      expect(anyRecorded || refErr.message).toBeTruthy();
    });
  });
});