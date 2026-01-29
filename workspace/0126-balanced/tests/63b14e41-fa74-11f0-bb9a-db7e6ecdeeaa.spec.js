import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b14e41-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for interacting with the Binary Search Demo
class BinarySearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayContainer = page.locator('#arrayContainer');
    this.searchInput = page.locator('#searchValue');
    this.startBtn = page.locator('#startBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.statusDiv = page.locator('#status');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async enterValue(value) {
    await this.searchInput.fill(String(value));
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async getStatusText() {
    return (await this.statusDiv.textContent()) ?? '';
  }

  async isStartDisabled() {
    return await this.startBtn.isDisabled();
  }

  async isResetDisabled() {
    return await this.resetBtn.isDisabled();
  }

  async arrayElementCount() {
    return await this.arrayContainer.locator('.element').count();
  }

  // returns class attribute string for nth element (0-based)
  async elementClassAt(index) {
    const el = this.arrayContainer.locator('.element').nth(index);
    // If element exists get class, else return null
    if (await el.count() === 0) return null;
    return await el.getAttribute('class');
  }

  // Wait until the status contains a substring or timeout
  async waitForStatusContains(substring, options = {}) {
    const timeout = options.timeout ?? 7000;
    await this.page.waitForFunction(
      (sel, substr) => {
        const el1 = document.querySelector(sel);
        return el && el.textContent && el.textContent.includes(substr);
      },
      '#status',
      substring,
      { timeout }
    );
  }

  // Wait for an exact status text
  async waitForStatusEquals(text, options = {}) {
    const timeout1 = options.timeout1 ?? 7000;
    await this.page.waitForFunction(
      (sel, expected) => {
        const el2 = document.querySelector(sel);
        return el && el.textContent && el.textContent.trim() === expected;
      },
      '#status',
      text,
      { timeout }
    );
  }
}

// Group tests related to the Binary Search FSM and UI
test.describe('Binary Search Demo - FSM validation and UI behavior', () => {
  let consoleErrors;
  let pageErrors;

  // Use a new page for each test via built-in fixture
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err.message || String(err));
    });
  });

  test.afterEach(async () => {
    // After each test ensure no unexpected console or page errors occurred.
    // These assertions ensure we observe runtime issues if they occur.
    expect(consoleErrors, 'No console.error messages should have been logged').toEqual([]);
    expect(pageErrors, 'No uncaught page errors should have happened').toEqual([]);
  });

  test('Initial Idle state (S0_Idle): initial render, controls state, and layout', async ({ page }) => {
    // Validate initial render (S0_Idle entry action renderArray({}))
    const bs = new BinarySearchPage(page);
    await bs.goto();

    // Array should be rendered with 20 elements (as per implementation)
    const count = await bs.arrayElementCount();
    expect(count).toBe(20);

    // Status should be empty initially
    const status = await bs.getStatusText();
    expect(status.trim()).toBe('');

    // Start button enabled, Reset button disabled (as per HTML default)
    expect(await bs.isStartDisabled()).toBe(false);
    expect(await bs.isResetDisabled()).toBe(true);

    // First element should display the smallest array value ("3")
    // and should have only the base 'element' class (no highlight)
    const firstClass = await bs.elementClassAt(0);
    expect(firstClass).toContain('element');
    expect(firstClass).not.toContain('low'); // not highlighted in initial render
  });

  test('StartSearch event transitions to Searching (S1_Searching) and immediate Found (S3_Found) when target is mid', async ({ page }) => {
    // This test uses target 49 which is the immediate mid (index 9).
    // Validate transition: StartSearch -> Searching -> Found without setTimeout loops.
    const bs1 = new BinarySearchPage(page);
    await bs.goto();

    // Enter the target value present at initial mid index (49)
    await bs.enterValue(49);

    // Click Start Search; should set status to 'Starting binary search...' then immediately discover found
    await bs.clickStart();

    // After clicking, starting message should appear
    await bs.waitForStatusContains('Starting binary search...', { timeout: 2000 });

    // Final found message should appear quickly (no setTimeout delay in the found branch)
    await bs.waitForStatusContains('Found value 49 at index 9!', { timeout: 3000 });

    // Confirm the element at index 9 has class 'found'
    const classAt9 = await bs.elementClassAt(9);
    expect(classAt9).toContain('found');

    // After found, Start should be re-enabled and Reset should be enabled
    expect(await bs.isStartDisabled()).toBe(false);
    expect(await bs.isResetDisabled()).toBe(false);
  });

  test('Searching continues through steps (S1_Searching -> S1_Searching) and eventually Found (S3_Found) for target requiring multiple steps', async ({ page }) => {
    // Use a value that requires multiple binary search steps before found (e.g., 95 at index 18)
    // Validate that the Searching state performs ContinueSearch transitions and finally Found.
    const bs2 = new BinarySearchPage(page);
    await bs.goto();

    await bs.enterValue(95);
    await bs.clickStart();

    // Immediately shows Starting...
    await bs.waitForStatusContains('Starting binary search...', { timeout: 2000 });

    // After first binarySearchStep call, status should include "Low index:" - indicates the algorithm progressed
    await bs.waitForStatusContains('Low index:', { timeout: 2000 });

    // During the search at some point the UI should show a 'mid' highlighted element.
    // Wait for an element with class 'mid' to appear
    await page.waitForFunction(() => {
      return !!document.querySelector('.array-container .mid');
    }, null, { timeout: 3000 });

    // Eventually the search should find the value and display the found message.
    await bs.waitForStatusContains('Found value 95 at index 18!', { timeout: 7000 });

    // Confirm found element class at index 18
    const classAt18 = await bs.elementClassAt(18);
    expect(classAt18).toContain('found');

    // Ensure start/reset buttons are in expected state after finishing
    expect(await bs.isStartDisabled()).toBe(false);
    expect(await bs.isResetDisabled()).toBe(false);
  });

  test('NotFound transition (S1_Searching -> S2_NotFound) when target is absent', async ({ page }) => {
    // Search for a value not present in the array (e.g., 1000) and verify Not Found final state
    const bs3 = new BinarySearchPage(page);
    await bs.goto();

    await bs.enterValue(1000);
    await bs.clickStart();

    // Should show starting message
    await bs.waitForStatusContains('Starting binary search...', { timeout: 2000 });

    // Eventually should display not found message
    await bs.waitForStatusContains('Value 1000 not found in the array.', { timeout: 10000 });

    // After NotFound, the array should have been re-rendered (no 'found' elements)
    // Ensure no element has the 'found' class
    const foundElements = await page.$$eval('.array-container .found', els => els.length);
    expect(foundElements).toBe(0);

    // Buttons should be restored to enabled start and enabled reset
    expect(await bs.isStartDisabled()).toBe(false);
    expect(await bs.isResetDisabled()).toBe(false);
  }, { timeout: 15000 });

  test('ResetSearch event from Idle state keeps Idle (S0_Idle -> S0_Idle) and during Searching clears timer/onExit actions', async ({ page }) => {
    // This test validates:
    // - Reset clicked in Idle does not break UI (remains in Idle)
    // - Reset clicked during Searching clears the ongoing timer and returns to Idle
    const bs4 = new BinarySearchPage(page);
    await bs.goto();

    // Click Reset in Idle: should simply keep UI idle (status empty, reset disabled as default)
    await bs.clickReset();
    expect(await bs.getStatusText()).toBe('');
    expect(await bs.isResetDisabled()).toBe(true);
    expect(await bs.isStartDisabled()).toBe(false);

    // Now start a search that will take multiple async steps (target 95)
    await bs.enterValue(95);
    await bs.clickStart();

    // Wait until the first step of the search has started
    await bs.waitForStatusContains('Low index:', { timeout: 3000 });
    // Reset should now be enabled; click it to cancel the ongoing search (clearTimeout(timer))
    expect(await bs.isResetDisabled()).toBe(false);
    await bs.clickReset();

    // After reset, status should be cleared and input/state returned to idle
    // The implementation sets statusDiv.textContent = '' in reset().
    await page.waitForFunction(() => {
      const s = document.getElementById('status');
      return s && s.textContent === '';
    }, null, { timeout: 2000 });

    expect(await bs.getStatusText()).toBe('');
    expect(await bs.isStartDisabled()).toBe(false);
    expect(await bs.isResetDisabled()).toBe(true);

    // Wait a bit longer to ensure previously scheduled timers (if any) do not resume UI updates
    // If reset properly cleared timers, no further status changes should happen.
    await page.waitForTimeout(2500);
    expect((await bs.getStatusText()).trim()).toBe('');
  }, { timeout: 15000 });

  test('Edge case: invalid input shows alert and does not start search', async ({ page }) => {
    // Validate behavior when clicking Start with invalid or empty input:
    // - alert('Please enter a valid number.')
    // - search should not start and buttons remain in Idle configuration
    const bs5 = new BinarySearchPage(page);
    await bs.goto();

    // Ensure input is empty
    await bs.searchInput.fill('');

    // Listen for dialog and assert message
    let dialogMessage = null;
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    // Click Start with empty input; should trigger alert
    await bs.clickStart();

    // Give a short moment for dialog to fire
    await page.waitForTimeout(500);

    expect(dialogMessage).toBe('Please enter a valid number.');

    // After dismissing alert, verify that the search did not start
    expect(await bs.isStartDisabled()).toBe(false);
    expect(await bs.isResetDisabled()).toBe(true);

    // Status should remain empty
    expect((await bs.getStatusText()).trim()).toBe('');
  });

});