import { test, expect } from '@playwright/test';

// Test file for Application ID: d83838d1-fa7b-11f0-b314-ad8654ee5de8
// URL under test:
// http://127.0.0.1:5500/workspace/0126-biased/html/d83838d1-fa7b-11f0-b314-ad8654ee5de8.html

// Page Object for the demo page to keep tests organized and readable
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83838d1-fa7b-11f0-b314-ad8654ee5de8.html';
    this.button = page.locator('#showDemo');
    this.demoArea = page.locator('#demoArea');
  }

  async goto() {
    await this.page.goto(this.url);
    // wait for main container to be present to ensure page rendered
    await this.page.locator('.container[role="main"]').waitFor({ state: 'visible' });
  }

  async getButtonText() {
    return await this.button.textContent();
  }

  async clickToggle() {
    await this.button.click();
  }

  async pressEnterOnButton() {
    await this.button.focus();
    await this.page.keyboard.press('Enter');
  }

  async isDemoVisible() {
    // Check inline style first and computed style as fallback
    const inlineDisplay = await this.demoArea.evaluate((el) => el.style.display);
    if (inlineDisplay) {
      return inlineDisplay !== 'none';
    }
    // fallback to computed style
    const computed = await this.demoArea.evaluate((el) => window.getComputedStyle(el).display);
    return computed !== 'none';
  }
}

test.describe('SQL Guide - Demo toggle (FSM validation)', () => {
  // Collect console errors and page errors for each test
  test.beforeEach(async ({ page }) => {
    // ensure a clean listeners state per test by clearing any default listeners
    // We'll attach our own listeners below in each test's context via arrays
  });

  test.describe('State S0_Idle (Initial render)', () => {
    test('renders page and shows initial Idle state with button and hidden demoArea', async ({ page }) => {
      // Setup listeners to capture console and page errors
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', (msg) => consoleMessages.push(msg));
      page.on('pageerror', (err) => pageErrors.push(err));

      const demo = new DemoPage(page);
      await demo.goto();

      // Validate entry action "renderPage()" by asserting the page content is present:
      // - Title present
      await expect(page).toHaveTitle(/Comprehensive Guide to SQL/);

      // Button exists with expected attributes and text
      await expect(demo.button).toBeVisible();
      await expect(demo.button).toHaveAttribute('aria-controls', 'demoArea');
      await expect(demo.button).toHaveClass(/btn/);
      await expect(demo.button).toHaveText('Show sample query execution');

      // Demo area exists and is hidden initially (S0_Idle evidence)
      await expect(demo.demoArea).toBeVisible(); // element exists in DOM
      // But it should be hidden via inline style display:none
      const inlineStyle = await demo.demoArea.getAttribute('style');
      expect(inlineStyle).toMatch(/display\s*:\s*none/);

      // Confirm computed visibility is hidden
      const visible = await demo.isDemoVisible();
      expect(visible).toBe(false);

      // Assert no console errors or page errors occurred during initial render
      const consoleErrors = consoleMessages.filter((m) => m.type() === 'error');
      expect(consoleErrors.length, `Expected no console.error messages, saw: ${consoleErrors.map(m => m.text()).join(' | ')}`).toBe(0);
      expect(pageErrors.length, `Expected no page errors, saw: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
    });
  });

  test.describe('Transitions: ShowDemo and HideDemo (S0_Idle <-> S1_DemoVisible)', () => {
    test('clicking the toggle button shows the demo area and updates button text (S0 -> S1)', async ({ page }) => {
      // Capture console messages and page errors
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', (msg) => consoleMessages.push(msg));
      page.on('pageerror', (err) => pageErrors.push(err));

      const demo = new DemoPage(page);
      await demo.goto();

      // Precondition: demo hidden and button text "Show sample query execution"
      expect(await demo.getButtonText()).toBe('Show sample query execution');
      expect(await demo.isDemoVisible()).toBe(false);

      // Trigger the ShowDemo event by clicking the button
      await demo.clickToggle();

      // After transition: demo should be visible; button text updated
      // Note: the implementation sets demo.style.display = 'block' and new text
      await expect(demo.demoArea).toBeVisible();
      const visible = await demo.isDemoVisible();
      expect(visible, 'Expected demoArea to be visible after clicking ShowDemo').toBe(true);

      // Button text should update to 'Hide sample query execution'
      await expect(demo.button).toHaveText('Hide sample query execution');

      // Also assert accessible relationship remains intact
      await expect(demo.button).toHaveAttribute('aria-controls', 'demoArea');

      // Ensure no console or page errors were produced during the transition
      const consoleErrors = consoleMessages.filter((m) => m.type() === 'error');
      expect(consoleErrors.length, `Expected no console.error messages during ShowDemo, saw: ${consoleErrors.map(m => m.text()).join(' | ')}`).toBe(0);
      expect(pageErrors.length, `Expected no page errors during ShowDemo, saw: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
    });

    test('clicking the toggle button again hides the demo area and reverts button text (S1 -> S0)', async ({ page }) => {
      // Capture console and page errors
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', (msg) => consoleMessages.push(msg));
      page.on('pageerror', (err) => pageErrors.push(err));

      const demo = new DemoPage(page);
      await demo.goto();

      // Ensure initial hidden
      expect(await demo.isDemoVisible()).toBe(false);

      // Show first
      await demo.clickToggle();
      expect(await demo.isDemoVisible()).toBe(true);
      await expect(demo.button).toHaveText('Hide sample query execution');

      // Now click again to hide (HideDemo)
      await demo.clickToggle();

      // After hiding: check inline style or computed style, and button text
      const inlineStyleAfter = await demo.demoArea.getAttribute('style');
      // The implementation sets demo.style.display = 'none' and button text back
      expect(inlineStyleAfter).toMatch(/display\s*:\s*none/);
      const visibleAfter = await demo.isDemoVisible();
      expect(visibleAfter, 'Expected demoArea to be hidden after clicking HideDemo').toBe(false);

      await expect(demo.button).toHaveText('Show sample query execution');

      // Confirm no JS errors in console or page error events
      const consoleErrors = consoleMessages.filter((m) => m.type() === 'error');
      expect(consoleErrors.length, `Expected no console.error messages during HideDemo, saw: ${consoleErrors.map(m => m.text()).join(' | ')}`).toBe(0);
      expect(pageErrors.length, `Expected no page errors during HideDemo, saw: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
    });

    test('rapid double-clicking toggles state consistently and remains stable (edge case)', async ({ page }) => {
      // Capture console and page errors
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', (msg) => consoleMessages.push(msg));
      page.on('pageerror', (err) => pageErrors.push(err));

      const demo = new DemoPage(page);
      await demo.goto();

      // Rapidly click twice: should show then hide (back to initial)
      await demo.button.dblclick();

      // After double click, final expected state is hidden (starting hidden -> show -> hide)
      const visible = await demo.isDemoVisible();
      expect(visible, 'After double-clicking the toggle, demoArea should return to hidden').toBe(false);
      await expect(demo.button).toHaveText('Show sample query execution');

      // Now triple-click (odd number) to ensure final is visible
      await demo.button.click();
      await demo.button.click();
      await demo.button.click();

      // After three clicks starting from hidden: visible
      expect(await demo.isDemoVisible()).toBe(true);
      await expect(demo.button).toHaveText('Hide sample query execution');

      // No console or page errors should be emitted during rapid interactions
      const consoleErrors = consoleMessages.filter((m) => m.type() === 'error');
      expect(consoleErrors.length, `Expected no console.error messages during rapid interactions, saw: ${consoleErrors.map(m => m.text()).join(' | ')}`).toBe(0);
      expect(pageErrors.length, `Expected no page errors during rapid interactions, saw: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
    });

    test('keyboard activation (Enter) toggles the demo area (accessibility behavior)', async ({ page }) => {
      // Capture console and page errors
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', (msg) => consoleMessages.push(msg));
      page.on('pageerror', (err) => pageErrors.push(err));

      const demo = new DemoPage(page);
      await demo.goto();

      // Press Enter on the button to trigger click
      await demo.pressEnterOnButton();

      // After pressing Enter, demo should be visible
      expect(await demo.isDemoVisible()).toBe(true);
      await expect(demo.button).toHaveText('Hide sample query execution');

      // Press Enter again to hide
      await demo.pressEnterOnButton();
      expect(await demo.isDemoVisible()).toBe(false);
      await expect(demo.button).toHaveText('Show sample query execution');

      // Verify no errors occurred triggered by keyboard events
      const consoleErrors = consoleMessages.filter((m) => m.type() === 'error');
      expect(consoleErrors.length, `Expected no console.error messages during keyboard activation, saw: ${consoleErrors.map(m => m.text()).join(' | ')}`).toBe(0);
      expect(pageErrors.length, `Expected no page errors during keyboard activation, saw: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
    });

    test('clicking inside demoArea does not hide it (only the toggle button controls visibility)', async ({ page }) => {
      // Capture console and page errors
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', (msg) => consoleMessages.push(msg));
      page.on('pageerror', (err) => pageErrors.push(err));

      const demo = new DemoPage(page);
      await demo.goto();

      // Show demo area
      await demo.clickToggle();
      expect(await demo.isDemoVisible()).toBe(true);

      // Click on an inner element (table cell) inside demoArea
      const firstCell = page.locator('#demoArea table tbody tr td').first();
      await firstCell.click();

      // Demo should remain visible and button text unchanged (still 'Hide...')
      expect(await demo.isDemoVisible()).toBe(true);
      await expect(demo.button).toHaveText('Hide sample query execution');

      // Confirm no console errors or page errors occurred due to inner clicks
      const consoleErrors = consoleMessages.filter((m) => m.type() === 'error');
      expect(consoleErrors.length, `Expected no console.error messages when clicking inside demoArea, saw: ${consoleErrors.map(m => m.text()).join(' | ')}`).toBe(0);
      expect(pageErrors.length, `Expected no page errors when clicking inside demoArea, saw: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
    });
  });

  test.describe('FSM coverage summary and robustness checks', () => {
    test('component attributes and evidence presence (verifies extracted components)', async ({ page }) => {
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', (msg) => consoleMessages.push(msg));
      page.on('pageerror', (err) => pageErrors.push(err));

      const demo = new DemoPage(page);
      await demo.goto();

      // Verify the documented evidence from FSM: button and demoArea exist with expected selectors
      await expect(page.locator('#showDemo')).toHaveCount(1);
      await expect(page.locator('#demoArea')).toHaveCount(1);

      // Verify that demoArea contains expected sample data table and result table that were documented
      await expect(page.locator('#demoArea table[aria-label="Sample employees table"]')).toBeVisible();
      await expect(page.locator('#demoArea .result table')).toBeVisible();

      // Validate that demoArea's content is the expected illustrative example (by checking presence of specific text)
      await expect(page.locator('#demoArea .example pre')).toContainText('SELECT id, name, salary');

      // No console/page errors
      const consoleErrors = consoleMessages.filter((m) => m.type() === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('no unexpected JavaScript runtime errors observed during full interaction sequence', async ({ page }) => {
      // This test systematically exercises the UI while capturing all console and page errors.
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', (msg) => consoleMessages.push(msg));
      page.on('pageerror', (err) => pageErrors.push(err));

      const demo = new DemoPage(page);
      await demo.goto();

      // perform a series of interactions
      await demo.clickToggle(); // show
      await demo.button.click(); // hide
      await demo.button.dblclick(); // show -> hide
      await demo.pressEnterOnButton(); // show
      await page.locator('#demoArea table tbody tr').nth(2).click(); // interact inside demo
      await demo.clickToggle(); // hide

      // Gather any console.error or pageerror events
      const consoleErrors = consoleMessages.filter((m) => m.type() === 'error');

      // Assert that no runtime errors (console error messages or unhandled page errors) occurred
      // If errors exist, the assertion will fail and include diagnostic messages captured.
      expect(consoleErrors.length, `Console errors detected: ${consoleErrors.map(m => m.text()).join(' | ')}`).toBe(0);
      expect(pageErrors.length, `Page errors detected: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
    });
  });
});