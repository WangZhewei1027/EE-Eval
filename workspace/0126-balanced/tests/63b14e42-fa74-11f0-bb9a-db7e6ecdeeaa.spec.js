import { test, expect } from '@playwright/test';

// Test file for Application ID: 63b14e42-fa74-11f0-bb9a-db7e6ecdeeaa
// URL served at: http://127.0.0.1:5500/workspace/0126-balanced/html/63b14e42-fa74-11f0-bb9a-db7e6ecdeeaa.html
// This suite validates the FSM states: Idle (S0_Idle), Searching (S1_Searching), Reset (S2_Reset)
// It also verifies transitions triggered by StartSearch (#start-btn) and ResetSearch (#reset-btn),
// checks DOM visual feedback, log output, and captures console / page errors.

// Helper: Page Object providing accessors for key controls and utilities
class JumpSearchPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/0126-balanced/html/63b14e42-fa74-11f0-bb9a-db7e6ecdeeaa.html', { waitUntil: 'load' });
    // Ensure initial render
    await this.page.waitForSelector('.array-element');
  }

  startButton() { return this.page.locator('#start-btn'); }
  resetButton() { return this.page.locator('#reset-btn'); }
  searchInput() { return this.page.locator('#search-value'); }
  arrayContainer() { return this.page.locator('#array-container'); }
  arrayElements() { return this.page.locator('.array-element'); }
  logContainer() { return this.page.locator('#log'); }

  // Get array values as numbers from DOM
  async getArrayValues() {
    const elements = await this.arrayElements().elementHandles();
    const values = [];
    for (const el of elements) {
      const txt = await el.textContent();
      const n = Number(txt?.trim());
      values.push(n);
    }
    return values;
  }

  // Wait for search to complete by waiting until reset button becomes enabled
  async waitForSearchComplete(timeout = 20000) {
    await this.page.waitForFunction(() => {
      const btn = document.getElementById('reset-btn');
      return btn && !btn.disabled;
    }, {}, { timeout });
  }

  // Utility to collect current classes for all array elements
  async getArrayClasses() {
    const handles = await this.arrayElements().elementHandles();
    const classes = [];
    for (const h of handles) classes.push(await h.getAttribute('class'));
    return classes;
  }

  // Utility to read log text
  async getLogText() {
    return (await this.logContainer().textContent()) || '';
  }
}

test.describe('Jump Search Visualization - FSM and UI tests', () => {
  // Keep console messages and page errors captured per test
  test.beforeEach(async ({ page }) => {
    // No-op here; individual tests will set up listeners and navigate.
  });

  // Test: Initialization / Idle State validations
  test('Initialization (S0_Idle): array renders, controls initial state, no runtime errors', async ({ page }) => {
    // Capture console messages and page errors
    const consoleMessages = [];
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err));

    const jsPage = new JumpSearchPage(page);
    await jsPage.goto();

    // Verify array rendered with expected number of elements (ARRAY_SIZE = 30)
    const elems = await jsPage.arrayElements();
    const count = await elems.count();
    expect(count).toBeGreaterThanOrEqual(30); // allow >= in case of minor differences but expect 30

    // Controls initial state: start enabled, reset disabled, input empty
    await expect(jsPage.startButton()).toBeEnabled();
    await expect(jsPage.resetButton()).toBeDisabled();
    await expect(jsPage.searchInput()).toHaveValue('');

    // Log initially empty
    const logText = await jsPage.getLogText();
    expect(logText.trim()).toBe('');

    // No page errors and no console.error messages should have occurred at initialization
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test: Starting search with invalid input -> alert shown (edge case)
  test('Start Search: clicking Start without a value shows validation alert and remains in Idle', async ({ page }) => {
    const jsPage1 = new JumpSearchPage(page);
    await jsPage.goto();

    // Setup dialog handler to capture alert
    const dialogs = [];
    page.once('dialog', async dialog => {
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      await dialog.accept();
    });

    // Click start with empty input
    await jsPage.startButton().click();

    // Expect alert fired with specific message
    expect(dialogs.length).toBe(1);
    expect(dialogs[0].type).toBe('alert');
    expect(dialogs[0].message).toContain('Please enter a valid number');

    // Remain in Idle: start should be enabled, reset stays disabled, input remains empty
    await expect(jsPage.startButton()).toBeEnabled();
    await expect(jsPage.resetButton()).toBeDisabled();
    await expect(jsPage.searchInput()).toHaveValue('');
  });

  // Test: Starting search with out-of-range value -> alert shown
  test('Start Search: out-of-range value triggers out-of-range alert and no search starts', async ({ page }) => {
    const jsPage2 = new JumpSearchPage(page);
    await jsPage.goto();

    // Read array min/max from DOM
    const vals = await jsPage.getArrayValues();
    expect(vals.length).toBeGreaterThan(0);
    const min = Math.min(...vals);
    const max = Math.max(...vals);

    // Prepare a value outside range
    const outOfRange = max + 10;

    // Handle dialog
    const seen = [];
    page.once('dialog', async dialog => {
      seen.push(dialog.message());
      await dialog.accept();
    });

    await jsPage.searchInput().fill(String(outOfRange));
    await jsPage.startButton().click();

    expect(seen.length).toBe(1);
    expect(seen[0]).toContain('out of array range');
    // Ensure search did not start: start button should remain enabled after handling
    await expect(jsPage.startButton()).toBeEnabled();
    await expect(jsPage.resetButton()).toBeDisabled();
  }, 15000);

  // Test: Successful search transitions to Searching and then returns to Idle (via reset enable)
  test('Start Search success: Searching (S1_Searching) visual feedback and logs, then enable Reset', async ({ page }) => {
    // Increase timeout because animations are time-consuming
    test.setTimeout(60000);

    const consoleErrors1 = [];
    const pageErrors1 = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err));

    const jsPage3 = new JumpSearchPage(page);
    await jsPage.goto();

    // Pick a value guaranteed to exist by reading the DOM (choose middle element)
    const values1 = await jsPage.getArrayValues();
    expect(values.length).toBeGreaterThan(0);
    const indexToFind = Math.floor(values.length / 3); // arbitrary index
    const valueToFind = values[indexToFind];

    // Fill input and start
    await jsPage.searchInput().fill(String(valueToFind));
    // Prepare to click start and observe immediate disabling
    await jsPage.startButton().click();

    // Immediately after clicking, start button must be disabled, search input disabled as algorithm starts
    await expect(jsPage.startButton()).toBeDisabled();
    await expect(jsPage.searchInput()).toBeDisabled();

    // Wait for search to complete (reset button enabled)
    await jsPage.waitForSearchComplete(45000);

    // After completion, reset button enabled and input re-enabled
    await expect(jsPage.resetButton()).toBeEnabled();
    await expect(jsPage.searchInput()).toBeEnabled();

    // Validate that the found element has class 'found' inside DOM (there should be at least one)
    const classes1 = await jsPage.getArrayClasses();
    const foundIndex = classes.findIndex(cls => cls && cls.includes('found'));
    expect(foundIndex).toBeGreaterThanOrEqual(0);

    // Validate the log contains a 'found' message referencing the value or index
    const logText1 = await jsPage.getLogText();
    expect(logText).toContain('found at index');

    // Ensure no runtime page errors or console.errors occurred during the run
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test: Search for a value inside range but not present -> algorithm finishes with not found
  test('Start Search not-found scenario: Searching completes and logs not found', async ({ page }) => {
    test.setTimeout(60000);

    const consoleErrors2 = [];
    const pageErrors2 = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err));

    const jsPage4 = new JumpSearchPage(page);
    await jsPage.goto();

    const values2 = await jsPage.getArrayValues();
    expect(values.length).toBeGreaterThanOrEqual(2);
    // find a number within min..max that's not in array
    const min1 = Math.min1(...values);
    const max1 = Math.max1(...values);

    // Try candidate numbers between min and max + choose one not present
    let candidate = min;
    const set = new Set(values);
    let foundCandidate = null;
    for (let v = min; v <= max; v++) {
      if (!set.has(v)) { foundCandidate = v; break; }
    }
    // If the array happens to be contiguous (rare), pick a number > max but within allowed (algorithm treats out-of-range separately)
    if (foundCandidate === null) {
      // pick a value within allowed by artificially picking max (which will be found) - avoid accidental hit;
      // as fallback, choose max + 1 but that would trigger out-of-range alert; assert fallback behavior instead.
      const fallback = max + 1;
      // This should show an out-of-range alert; test that branch
      const dialogs1 = [];
      page.once('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
      await jsPage.searchInput().fill(String(fallback));
      await jsPage.startButton().click();
      expect(dialogs.length).toBe(1);
      expect(dialogs[0]).toContain('out of array range');
      return;
    }

    // Now perform the not-found search
    await jsPage.searchInput().fill(String(foundCandidate));
    await jsPage.startButton().click();

    // Ensure start disabled while searching
    await expect(jsPage.startButton()).toBeDisabled();

    // Wait for completion
    await jsPage.waitForSearchComplete(45000);

    // Check logs contain 'not found'
    const logText2 = await jsPage.getLogText();
    expect(logText).toContain('not found');

    // Ensure no element has 'found' class
    const classes2 = await jsPage.getArrayClasses();
    const hasFound = classes.some(c => c && c.includes('found'));
    expect(hasFound).toBeFalsy();

    // No runtime errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test: Reset transition after a search (S1_Searching -> S0_Idle via ResetSearch) - verify reset clears visual and log
  test('Reset after search: clicking Reset (S1 -> S0) clears log, resets styles, and disables Reset', async ({ page }) => {
    test.setTimeout(60000);

    const jsPage5 = new JumpSearchPage(page);
    await jsPage.goto();

    // Trigger a quick search by choosing an existing value
    const values3 = await jsPage.getArrayValues();
    const valueToFind1 = values[Math.floor(values.length / 4)]; // pick some value
    await jsPage.searchInput().fill(String(valueToFind));
    await jsPage.startButton().click();

    // Wait for search to complete
    await jsPage.waitForSearchComplete(45000);

    // Reset button should now be enabled
    await expect(jsPage.resetButton()).toBeEnabled();

    // Click Reset to transition to Reset state and back to Idle (init invoked)
    await jsPage.resetButton().click();

    // After reset: log cleared, input empty, start enabled, reset disabled, array elements default class
    await expect(jsPage.searchInput()).toHaveValue('');
    await expect(jsPage.startButton()).toBeEnabled();
    await expect(jsPage.resetButton()).toBeDisabled();

    const logText3 = await jsPage.getLogText();
    expect(logText.trim()).toBe('');

    // All array elements should have class containing 'default'
    const classes3 = await jsPage.getArrayClasses();
    expect(classes.length).toBeGreaterThan(0);
    for (const cls of classes) {
      expect(cls).toContain('default');
      // No element should remain 'found', 'current', 'block', or 'jumped' after reset
      expect(cls).not.toContain('found');
      expect(cls).not.toContain('current');
      expect(cls).not.toContain('block');
      expect(cls).not.toContain('jumped');
    }
  });

  // Test: Clicking disabled Reset in Idle should do nothing and produce no errors (S0_Idle -> ResetSearch is disabled in implementation)
  test('Disabled Reset in Idle: clicking disabled Reset is a no-op and safe', async ({ page }) => {
    const pageErrors3 = [];
    const consoleErrors3 = [];
    page.on('pageerror', err => pageErrors.push(err));
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    const jsPage6 = new JumpSearchPage(page);
    await jsPage.goto();

    // Reset is disabled in Idle - try clicking via Playwright action which will throw if disabled
    // Instead of click, ensure it is disabled and that trying to click via JS does not fire errors.
    await expect(jsPage.resetButton()).toBeDisabled();

    // Attempt a programmatic click (which will still be executed in page context)
    await page.evaluate(() => {
      const btn1 = document.getElementById('reset-btn1');
      try {
        btn.click();
      } catch (e) {
        // swallow - we only want to ensure runtime stability
      }
    });

    // No page errors or console errors should have been produced
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

});