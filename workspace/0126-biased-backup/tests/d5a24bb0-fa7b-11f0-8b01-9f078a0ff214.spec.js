import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a24bb0-fa7b-11f0-8b01-9f078a0ff214.html';

/**
 * Page Object Model for the "Understanding Relational Databases" demo page.
 * Encapsulates common interactions and queries used by the tests below.
 */
class RelationalDatabasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = '.button[onclick="showDemo()"]';
    this.demoSelector = '#demo';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Returns the button element handle
  async getShowDemoButton() {
    return await this.page.$(this.buttonSelector);
  }

  // Returns the demo container element handle
  async getDemoDiv() {
    return await this.page.$(this.demoSelector);
  }

  // Clicks the Show SQL Example button
  async clickShowDemo() {
    await this.page.click(this.buttonSelector);
  }

  // Focuses the Show SQL Example button
  async focusShowDemo() {
    const btn = await this.getShowDemoButton();
    await btn.focus();
  }

  // Returns computed display style of demo (e.g., "none" or "block")
  async demoDisplayStyle() {
    const demo = await this.getDemoDiv();
    return await this.page.evaluate((el) => {
      // Read inline style first because the implementation toggles inline style
      return el.style.display || window.getComputedStyle(el).display;
    }, demo);
  }

  // Returns the inner text content of the demo container
  async demoText() {
    const demo = await this.getDemoDiv();
    return await this.page.evaluate((el) => el.innerText, demo);
  }

  // Returns the onclick attribute of the button
  async buttonOnclickAttr() {
    const btn = await this.getShowDemoButton();
    return await this.page.evaluate((el) => el.getAttribute('onclick'), btn);
  }
}

test.describe('Understanding Relational Databases - FSM tests (d5a24bb0...)', () => {
  // Capture console messages and page errors for each test so we can assert on them.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      // store type and text for later assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught exceptions / page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test, assert that no uncaught exceptions (pageerrors) occurred.
    // This validates the runtime was stable during the test.
    expect(pageErrors.length, 'No uncaught exceptions should be thrown by the page').toBe(0);

    // Also assert there were no console error-level messages.
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(
      consoleErrors.length,
      `No console.error messages should be emitted. Found: ${consoleErrors.map((m) => m.text).join(' | ')}`
    ).toBe(0);
  });

  test.describe('Initial state (S0_Idle)', () => {
    test('Initial render: button present and demo hidden', async ({ page }) => {
      // Validate initial Idle state: the button is present and #demo has display:none
      const model = new RelationalDatabasePage(page);
      await model.goto();

      // The button should exist and be visible
      const btn = await model.getShowDemoButton();
      expect(btn, 'Show SQL Example button should exist').not.toBeNull();
      const btnVisible = await btn.isVisible();
      expect(btnVisible, 'Show SQL Example button should be visible').toBe(true);

      // The onclick attribute should match the FSM evidence
      const onclickAttr = await model.buttonOnclickAttr();
      expect(onclickAttr, 'Button should have onclick="showDemo()" attribute').toBe('showDemo()');

      // The demo div should exist and be hidden (inline style display:none according to HTML)
      const demo = await model.getDemoDiv();
      expect(demo, '#demo element should exist in the DOM').not.toBeNull();

      const display = await model.demoDisplayStyle();
      expect(display, '#demo should be hidden initially (display:none)').toBe('none');
    });
  });

  test.describe('Transitions and events (ShowDemo)', () => {
    test('Clicking the button toggles demo visible (S0_Idle -> S1_DemoVisible)', async ({ page }) => {
      // This test validates the transition from Idle to Demo Visible
      const model = new RelationalDatabasePage(page);
      await model.goto();

      // Precondition: demo should be hidden
      expect(await model.demoDisplayStyle()).toBe('none');

      // Trigger event: click the button
      await model.clickShowDemo();

      // Postcondition: demo should now be displayed (display should be 'block' due to JS toggling)
      const displayAfter = await model.demoDisplayStyle();
      expect(displayAfter, '#demo should be displayed after clicking the button').toBe('block');

      // Verify demo content includes the SQL example text
      const demoText = await model.demoText();
      expect(demoText).toContain('SELECT * FROM Products;', 'Demo should contain the SQL example text');
    });

    test('Clicking again toggles demo hidden (S1_DemoVisible -> S0_Idle)', async ({ page }) => {
      // Validate toggling back to Idle
      const model = new RelationalDatabasePage(page);
      await model.goto();

      // make visible first
      await model.clickShowDemo();
      expect(await model.demoDisplayStyle()).toBe('block');

      // click again to hide
      await model.clickShowDemo();
      expect(await model.demoDisplayStyle(), '#demo should be hidden after clicking the button again').toBe('none');
    });

    test('Rapid clicking: multiple toggles produce expected final state', async ({ page }) => {
      // Edge case: user clicks quickly multiple times
      const model = new RelationalDatabasePage(page);
      await model.goto();

      // Click 5 times; odd -> visible
      for (let i = 0; i < 5; i++) {
        await model.clickShowDemo();
      }
      expect(await model.demoDisplayStyle(), 'After 5 clicks demo should be visible (odd number of toggles)').toBe('block');

      // Click 1 more time (total 6); even -> hidden
      await model.clickShowDemo();
      expect(await model.demoDisplayStyle(), 'After 6 clicks demo should be hidden (even number of toggles)').toBe('none');
    });

    test('Keyboard activation: pressing Enter on focused button toggles demo', async ({ page }) => {
      // Validate accessibility interaction (keyboard)
      const model = new RelationalDatabasePage(page);
      await model.goto();

      // Ensure initial hidden
      expect(await model.demoDisplayStyle()).toBe('none');

      // Focus and press Enter
      await model.focusShowDemo();
      await page.keyboard.press('Enter');

      expect(await model.demoDisplayStyle(), 'Demo should be visible after pressing Enter on the focused button').toBe('block');

      // Press Space should toggle again (Space activates buttons)
      await page.keyboard.press('Space');
      // Wait a tick for potential event processing
      await page.waitForTimeout(50);
      expect(await model.demoDisplayStyle(), 'Demo should be hidden after pressing Space on the focused button').toBe('none');
    });

    test('Clicking inside the demo content does not toggle visibility (only button toggles)', async ({ page }) => {
      // Validate that interactions with the demo content itself don't toggle it (only the button does)
      const model = new RelationalDatabasePage(page);
      await model.goto();

      // Show the demo
      await model.clickShowDemo();
      expect(await model.demoDisplayStyle()).toBe('block');

      // Click the demo content
      const demo = await model.getDemoDiv();
      await demo.click();

      // Should remain visible
      expect(await model.demoDisplayStyle(), 'Clicking inside demo should not hide it').toBe('block');

      // Hide by clicking the button
      await model.clickShowDemo();
      expect(await model.demoDisplayStyle(), 'Clicking the button still hides the demo').toBe('none');
    });
  });

  test.describe('FSM onEnter/onExit evidence and DOM verification', () => {
    test('Verify that showDemo function toggles inline style as per FSM evidence', async ({ page }) => {
      // The FSM evidence shows the implementation manipulates demo.style.display explicitly.
      // We verify that the inline style attribute changes between "none" and "block".
      const model = new RelationalDatabasePage(page);
      await model.goto();

      const demoHandle = await model.getDemoDiv();
      // Initially there should be an inline style including 'display:none' as in the HTML
      const initialInlineStyle = await page.evaluate((el) => el.getAttribute('style'), demoHandle);
      expect(initialInlineStyle, 'Initial inline style should include display:none').toContain('display:none');

      // Click to show - expect inline style to update to display:block (the JS toggles inline style)
      await model.clickShowDemo();
      const afterShowInlineStyle = await page.evaluate((el) => el.getAttribute('style'), demoHandle);
      expect(afterShowInlineStyle, 'Inline style should be updated to display:block after showDemo runs').toContain('display: block');

      // Click to hide - expect inline style to include display:none again
      await model.clickShowDemo();
      const afterHideInlineStyle = await page.evaluate((el) => el.getAttribute('style'), demoHandle);
      expect(afterHideInlineStyle, 'Inline style should be reverted to display:none after showDemo runs again').toContain('display:none');
    });

    test('Edge case: ensure multiple ways of triggering the event use the same handler (onclick attribute exists)', async ({ page }) => {
      // Verify the button has the onclick attribute pointing to showDemo as described in FSM evidence
      const model = new RelationalDatabasePage(page);
      await model.goto();

      const onclickAttr = await model.buttonOnclickAttr();
      expect(onclickAttr, 'Button should have onclick attribute set to showDemo()').toBe('showDemo()');

      // Also assert the function showDemo exists on the page (do NOT redefine or patch it)
      const showDemoExists = await page.evaluate(() => typeof window.showDemo === 'function');
      expect(showDemoExists, 'The showDemo function should be defined on the window').toBe(true);

      // Use the onclick attribute (clicking) to ensure the same behavior
      await model.clickShowDemo();
      expect(await model.demoDisplayStyle()).toBe('block');
    });
  });

  test.describe('Error monitoring and robustness checks', () => {
    test('No runtime errors or console.error messages during normal usage', async ({ page }) => {
      // This test explicitly performs some interactions and then asserts no errors happened.
      const model = new RelationalDatabasePage(page);
      await model.goto();

      // Perform interactions
      await model.clickShowDemo();
      await model.clickShowDemo();
      await model.clickShowDemo();
      await page.keyboard.press('Enter');

      // Allow a short time for any errors to surface
      await page.waitForTimeout(100);

      // The afterEach hook will assert pageErrors.length === 0 and no console.error entries.
      // But we also assert here explicitly for clarity.
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length, `Expected no console.error messages during interactions`).toBe(0);
      expect(pageErrors.length, `Expected no uncaught page exceptions during interactions`).toBe(0);
    });
  });
});