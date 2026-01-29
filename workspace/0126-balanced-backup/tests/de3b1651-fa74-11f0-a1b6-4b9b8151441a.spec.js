import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3b1651-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object encapsulating interactions and observing console/page errors
class SetDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Capture console messages (logs/warnings/errors)
    this.page.on('console', msg => {
      // Normalize to a string for easier assertions
      try {
        const text = msg.text();
        this.consoleMessages.push({ type: msg.type(), text });
      } catch (e) {
        this.consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture uncaught exceptions / page errors
    this.page.on('pageerror', err => {
      // err is an Error object; store its message
      this.pageErrors.push(String(err && err.message ? err.message : err));
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Button helpers
  async clickAdd() {
    await this.page.click('button.add');
    // allow some time for any errors/console logs to appear
    await this.page.waitForTimeout(150);
  }

  async clickDelete() {
    await this.page.click('button.delete');
    await this.page.waitForTimeout(150);
  }

  async clickDisplay() {
    await this.page.click('button.display');
    await this.page.waitForTimeout(150);
  }

  // Utility: check if any captured page error matches regex
  anyPageErrorMatches(re) {
    return this.pageErrors.some(msg => re.test(msg));
  }

  // Utility: check if any console message matches regex
  anyConsoleMessageMatches(re) {
    return this.consoleMessages.some(({ text }) => re.test(text));
  }

  // Get text content of a selector (if present)
  async getText(selector) {
    try {
      const el = await this.page.$(selector);
      if (!el) return null;
      return (await el.textContent()) ?? '';
    } catch {
      return null;
    }
  }
}

test.describe('JavaScript Set Demonstration - FSM tests (de3b1651-fa74-11f0-a1b6-4b9b8151441a)', () => {
  // Ensure each test gets a fresh page and fresh observers
  test.beforeEach(async ({ page }) => {
    // no-op: individual tests will construct SetDemoPage when needed
  });

  // Test the Idle state (S0_Idle) on initial load
  test('Idle state: page loads with expected title and initial errors/logs are observed', async ({ page }) => {
    // This test validates:
    // - The page title is "JavaScript Set Demonstration" (evidence for S0_Idle)
    // - The key buttons exist in the DOM
    // - Because the provided HTML/JS may reference functions on load (e.g., renderPage()),
    //   we observe console/page errors and assert they occur naturally (per instructions).
    const demo = new SetDemoPage(page);
    await demo.goto();

    // Verify title matches the FSM evidence for S0_Idle
    await expect(page).toHaveTitle('JavaScript Set Demonstration');

    // Verify buttons referenced in the FSM are present
    const addBtn = await page.$('button.add');
    const deleteBtn = await page.$('button.delete');
    const displayBtn = await page.$('button.display');

    expect(addBtn, 'Add button should be present').not.toBeNull();
    expect(deleteBtn, 'Delete button should be present').not.toBeNull();
    expect(displayBtn, 'Display button should be present').not.toBeNull();

    // Collect any console messages that refer to renderPage or updateSetDisplay or uncaught errors
    // We expect at least one error related to missing entry actions (renderPage/updateSetDisplay) OR a Reference/Type/Syntax error.
    // Allow a short delay to capture any immediate runtime errors triggered on load
    await page.waitForTimeout(150);

    // Assertions on observed errors: per instructions we must let ReferenceError/SyntaxError/TypeError happen naturally and assert they occur.
    const pageErrorDetected = demo.anyPageErrorMatches(/renderPage|updateSetDisplay|ReferenceError|TypeError|SyntaxError/i);
    const consoleErrorDetected = demo.anyConsoleMessageMatches(/renderPage|updateSetDisplay|ReferenceError|TypeError|SyntaxError/i);

    // At least one of pageErrors or console messages should indicate a problem with entry actions or runtime errors
    expect(pageErrorDetected || consoleErrorDetected).toBeTruthy();
  });

  // Test adding to the set transitions (S0_Idle -> S1_SetUpdated)
  test('AddToSet event: clicking Add button attempts to call addItemToSet and triggers corresponding behavior/errors', async ({ page }) => {
    // This test validates:
    // - Clicking the Add button triggers the expected function call (addItemToSet)
    // - If the implementation is missing, a ReferenceError will be raised; we assert such errors happen naturally
    // - If the function logs something to console or updates the DOM, we capture that as well
    const demo = new SetDemoPage(page);
    await demo.goto();

    // Clear any initial messages/errors captured during load
    demo.consoleMessages = [];
    demo.pageErrors = [];

    // Click the Add button
    await demo.clickAdd();

    // Check for evidence of addItemToSet being invoked or failing
    const pageErrorForAdd = demo.anyPageErrorMatches(/addItemToSet|ReferenceError|TypeError|SyntaxError/i);
    const consoleForAdd = demo.anyConsoleMessageMatches(/addItemToSet|added|Set|set/i);

    // We expect either:
    // - an error referencing addItemToSet (e.g., ReferenceError: addItemToSet is not defined)
    // OR
    // - a console message indicating an item was added (if implementation exists)
    expect(pageErrorForAdd || consoleForAdd).toBeTruthy();

    // Additionally, verify that the Add button remains present and clickable (no full page navigation)
    const addBtnStill = await page.$('button.add');
    expect(addBtnStill).not.toBeNull();
  });

  // Test deleting from the set transition (S1_SetUpdated -> S1_SetUpdated)
  test('DeleteFromSet event: clicking Delete button attempts to call removeItemFromSet and triggers corresponding behavior/errors', async ({ page }) => {
    // This test validates:
    // - Clicking the Delete button triggers removeItemFromSet
    // - If missing, a ReferenceError or similar is thrown and we assert it occurred
    // - Edge case: deleting when nothing has been added should either be handled or produce an error; we accept either
    const demo = new SetDemoPage(page);
    await demo.goto();

    // Ensure we have a consistent starting point (don't rely on prior tests)
    demo.consoleMessages = [];
    demo.pageErrors = [];

    // Click the Delete button without adding first to exercise edge case
    await demo.clickDelete();

    // Look for errors or console indications of removal
    const pageErrorForRemove = demo.anyPageErrorMatches(/removeItemFromSet|ReferenceError|TypeError|SyntaxError/i);
    const consoleForRemove = demo.anyConsoleMessageMatches(/removeItemFromSet|removed|delete|remove|Set|set/i);

    // Assert that either an error occurred (missing implementation) or some console feedback exists
    expect(pageErrorForRemove || consoleForRemove).toBeTruthy();

    // As a robustness check: clicking Delete again should still not crash the page (no navigation)
    await demo.clickDelete();

    // After repeated clicks, ensure the page still contains the delete button
    const deleteBtn = await page.$('button.delete');
    expect(deleteBtn).not.toBeNull();
  });

  // Test display current set transition (S1_SetUpdated -> S1_SetUpdated)
  test('DisplaySet event: clicking Display button attempts to call displaySet and shows current set or errors', async ({ page }) => {
    // This test validates:
    // - Clicking Display triggers displaySet() action per FSM
    // - We capture whether displaySet is invoked (console) or a ReferenceError occurs
    // - If the app updates a display area (e.g., a <pre> or other element), we attempt to read it
    const demo = new SetDemoPage(page);
    await demo.goto();

    demo.consoleMessages = [];
    demo.pageErrors = [];

    // Click the Display button
    await demo.clickDisplay();

    // Check for displaySet invocation or errors
    const pageErrorForDisplay = demo.anyPageErrorMatches(/displaySet|ReferenceError|TypeError|SyntaxError/i);
    const consoleForDisplay = demo.anyConsoleMessageMatches(/displaySet|Display|set items|Set contents|Set:/i);

    // Additionally attempt to read a preformatted block or common output selectors
    const preText = await demo.getText('pre');
    const outputById = await demo.getText('#output');
    const outputByClass = await demo.getText('.output');

    const outputPresent = (preText && preText.trim().length > 0) || (outputById && outputById.trim().length > 0) || (outputByClass && outputByClass.trim().length > 0);

    // We expect either an error about missing displaySet or some indication that the set was displayed
    expect(pageErrorForDisplay || consoleForDisplay || outputPresent).toBeTruthy();
  });

  // Combined flow: add, display, delete, display - verify sequence triggers expected function calls/errors
  test('Full interaction sequence: Add -> Display -> Delete -> Display (sequence of transitions)', async ({ page }) => {
    // This test validates:
    // - The FSM transitions when user performs a typical sequence of actions
    // - We assert that each action produces either a console trace or a runtime error (allowed by instructions)
    const demo = new SetDemoPage(page);
    await demo.goto();

    demo.consoleMessages = [];
    demo.pageErrors = [];

    // 1) Add
    await demo.clickAdd();
    const addObserved = demo.anyConsoleMessageMatches(/addItemToSet|added|Set/) || demo.anyPageErrorMatches(/addItemToSet|ReferenceError|TypeError|SyntaxError/);

    // 2) Display
    await demo.clickDisplay();
    const displayObserved = demo.anyConsoleMessageMatches(/displaySet|Display|Set/) || demo.anyPageErrorMatches(/displaySet|ReferenceError|TypeError|SyntaxError/);

    // 3) Delete
    await demo.clickDelete();
    const deleteObserved = demo.anyConsoleMessageMatches(/removeItemFromSet|removed|delete|remove|Set/) || demo.anyPageErrorMatches(/removeItemFromSet|ReferenceError|TypeError|SyntaxError/);

    // 4) Display again
    await demo.clickDisplay();
    const finalDisplayObserved = demo.anyConsoleMessageMatches(/displaySet|Display|Set/) || demo.anyPageErrorMatches(/displaySet|ReferenceError|TypeError|SyntaxError/);

    // Ensure that each step produced either some console feedback or an error (per the "let errors happen" instruction)
    expect(addObserved).toBeTruthy();
    expect(displayObserved).toBeTruthy();
    expect(deleteObserved).toBeTruthy();
    expect(finalDisplayObserved).toBeTruthy();
  });

  // Clean up after each test (close page)
  test.afterEach(async ({ page }) => {
    // Ensure no uncaught test-level hang: close page if open
    try {
      await page.close();
    } catch {
      // ignore
    }
  });
});