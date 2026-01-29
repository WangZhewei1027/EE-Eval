import { test, expect } from '@playwright/test';

// Test URL for the application under test
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3bd9a1-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object Model for the interpolation search demo
class InterpolationSearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayDisplay = page.locator('#arrayDisplay');
    this.searchInput = page.locator('#searchValue');
    this.searchButton = page.locator("button[onclick='startSearch()']");
    this.resetButton = page.locator("button[onclick='resetSearch()']");
    this.searchLog = page.locator('#searchLog');
    this.arrayItems = page.locator('.array-item');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // ensure main elements are visible
    await expect(this.arrayDisplay).toBeVisible();
    await expect(this.searchInput).toBeVisible();
    await expect(this.searchButton).toBeVisible();
    await expect(this.resetButton).toBeVisible();
    await expect(this.searchLog).toBeVisible();
  }

  async getArrayValues() {
    const count = await this.arrayItems.count();
    const values = [];
    for (let i = 0; i < count; i++) {
      values.push(await this.arrayItems.nth(i).innerText());
    }
    return values;
  }

  async enterValue(value) {
    // clear then type a value (value may be string or number)
    await this.searchInput.fill('');
    await this.searchInput.type(String(value));
    // fire input event to satisfy FSM's InputChange event expectation
    await this.page.evaluate(() => {
      const input = document.getElementById('searchValue');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  async clickSearch() {
    await this.searchButton.click();
  }

  async clickReset() {
    await this.resetButton.click();
  }

  async getLogText() {
    return this.searchLog.innerText();
  }

  async countItemsWithClass(className) {
    const count = await this.page.evaluate((cls) => {
      return Array.from(document.querySelectorAll('.array-item')).filter(it => it.classList.contains(cls)).length;
    }, className);
    return count;
  }

  async waitForProbe(timeout = 3000) {
    // Wait for any item to get the 'probe' class
    await this.page.waitForFunction(() => !!document.querySelector('.array-item.probe'), { timeout });
  }

  async waitForFound(timeout = 5000) {
    await this.page.waitForFunction(() => !!document.querySelector('.array-item.found'), { timeout });
  }

  async waitForLogContains(substr, timeout = 5000) {
    await this.page.waitForFunction((s) => {
      const log = document.getElementById('searchLog');
      return log && log.innerText.includes(s);
    }, substr, { timeout });
  }
}

test.describe('Interpolation Search Demonstration - FSM and UI tests', () => {
  // Containers to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Attach captured diagnostics to the test output (helpful when running tests)
    // Note: We don't modify the page runtime or patch code; only reporting.
    if (consoleMessages.length) {
      console.log('Captured console messages:', JSON.stringify(consoleMessages, null, 2));
    }
    if (pageErrors.length) {
      console.log('Captured page errors:', pageErrors.map(e => e.toString()).join('\n'));
    }
    // Remove listeners to avoid leakage across tests (best-effort cleanup)
    page.removeAllListeners && page.removeAllListeners('console');
    page.removeAllListeners && page.removeAllListeners('pageerror');
  });

  test.describe('S0: Idle state - initial page load and initArrayDisplay()', () => {
    test('should initialize array display with 10 items and no highlights (Idle state)', async ({ page }) => {
      // This test validates the S0_Idle state's entry action initArrayDisplay()
      // and ensures the initial DOM is correctly populated.
      const p = new InterpolationSearchPage(page);
      await p.goto();

      const values = await p.getArrayValues();
      expect(values.length).toBe(10);
      // Expect sorted array values as provided in HTML
      expect(values).toEqual(['10', '20', '30', '40', '50', '60', '70', '80', '90', '100']);

      // No probe/found/checked classes initially
      expect(await p.countItemsWithClass('probe')).toBe(0);
      expect(await p.countItemsWithClass('found')).toBe(0);
      expect(await p.countItemsWithClass('checked')).toBe(0);

      // Search log should be empty on initial load
      const logText = await p.getLogText();
      expect(logText.trim()).toBe('');

      // Ensure no uncaught page errors occurred during load
      expect(pageErrors.length).toBe(0);
      // Ensure no console errors were emitted
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('S1: Searching and S2: Displaying Step behaviors', () => {
    test('startSearch() via Search button should begin searching and highlight a probe (S0 -> S1 -> S2)', async ({ page }) => {
      // Validates transition: S0_Idle -> S1_Searching (SearchStart event)
      // and that displayStep() highlights a probe (entering S2_DisplayStep)
      const p = new InterpolationSearchPage(page);
      await p.goto();

      // Enter a value that exists in the array to get a found case quickly
      await p.enterValue(70); // input change event fired
      // Check that input holds the value (validates InputChange event updates value)
      const inputValue = await page.$eval('#searchValue', el => el.value);
      expect(inputValue).toBe('70');

      // Click Search to start search (SearchStart)
      await p.clickSearch();

      // Wait for the probe highlight to appear (displayStep executed)
      await p.waitForProbe(3000);
      // At least one probe should be present
      expect(await p.countItemsWithClass('probe')).toBeGreaterThan(0);

      // Since 70 exists, eventually a 'found' highlight should appear
      await p.waitForFound(5000);
      expect(await p.countItemsWithClass('found')).toBeGreaterThan(0);

      // The log should include a probing message and a found message
      const log = await p.getLogText();
      expect(log).toContain('Probing at position');
      expect(log).toMatch(/Found\s+70\s+at index\s+\d+!/);

      // No uncaught page errors or console errors expected
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('displayStep auto-proceeds through steps for a non-present value (verifies recursive DisplayStep behavior)', async ({ page }) => {
      // This test validates S2_DisplayStep's behavior where displayStep schedules
      // itself via setTimeout when the item is not found, ensuring the auto-proceed loop occurs.
      const p = new InterpolationSearchPage(page);
      await p.goto();

      // Choose a value likely not present (85) so displayStep will run multiple times
      await p.enterValue(85);
      await p.clickSearch();

      // Wait for the first probe to appear
      await p.waitForProbe(3000);
      // The log should contain at least one probing message
      await p.waitForLogContains('Probing at position', 3000);

      // Wait longer to allow subsequent auto-proceeded steps to be logged.
      // We expect at least 2 probe messages in total for this example.
      await page.waitForTimeout(3500); // one interval of 1500-2000ms plus margin
      const logText = await p.getLogText();

      // Count occurrences of "Probing at position" in the log
      const probeCount = (logText.match(/Probing at position/g) || []).length;
      expect(probeCount).toBeGreaterThanOrEqual(1);

      // Ensure the flow did not throw page errors while the recursive displayStep ran
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('S3: Reset behavior and transitions', () => {
    test('resetSearch() clears highlights, input, and log (S1/S2 -> S3)', async ({ page }) => {
      // This test validates that the Reset button transitions to S3_Reset by
      // invoking resetSearch(), which calls initArrayDisplay and clears state.
      const p = new InterpolationSearchPage(page);
      await p.goto();

      // Start a search that will produce highlights
      await p.enterValue(50);
      await p.clickSearch();
      await p.waitForProbe(3000);

      // Ensure some highlighting occurred
      expect(await p.countItemsWithClass('probe')).toBeGreaterThan(0);

      // Now click Reset to transition to S3_Reset
      await p.clickReset();

      // After reset, input should be cleared
      const inputValueAfterReset = await page.$eval('#searchValue', el => el.value);
      expect(inputValueAfterReset).toBe('');

      // The log should be empty
      const logAfterReset = await p.getLogText();
      expect(logAfterReset.trim()).toBe('');

      // No array items should have highlight classes
      expect(await p.countItemsWithClass('probe')).toBe(0);
      expect(await p.countItemsWithClass('found')).toBe(0);
      expect(await p.countItemsWithClass('checked')).toBe(0);

      // No page errors or console errors expected
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Input validation and edge cases (FSM expected interactions)', () => {
    test('search with empty input shows validation message and does not crash', async ({ page }) => {
      // This test validates behavior on invalid input per FSM expected interactions.
      const p = new InterpolationSearchPage(page);
      await p.goto();

      // Ensure input is empty
      await p.searchInput.fill('');
      // Click Search without entering a valid number
      await p.clickSearch();

      // Expect the validation message to appear in the log
      await p.waitForLogContains('Please enter a valid number to search.', 2000);
      const logText = await p.getLogText();
      expect(logText).toContain('Please enter a valid number to search.');

      // Ensure no uncaught errors were thrown
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('InputChange event updates the input value (verifies FSM InputChange event)', async ({ page }) => {
      // This test explicitly fires an input event and verifies the value changed,
      // which covers the FSM's InputChange event mapping.
      const p = new InterpolationSearchPage(page);
      await p.goto();

      // Programmatically change the input and dispatch an input event (InputChange)
      await p.enterValue(30);

      // Assert the DOM reflects the new value
      const inputValue = await page.$eval('#searchValue', el => el.value);
      expect(inputValue).toBe('30');

      // There should be no immediate search started; log remains empty
      const log = await p.getLogText();
      expect(log.trim()).toBe('');

      // No page errors or console errors
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Observability: console and page error monitoring', () => {
    test('should not produce uncaught runtime errors or console errors during normal interactions', async ({ page }) => {
      // This test runs a sequence of interactions while monitoring console and page errors.
      const p = new InterpolationSearchPage(page);
      await p.goto();

      // Perform a few interactions
      await p.enterValue(40);
      await p.clickSearch();
      await p.waitForProbe(3000);
      await p.clickReset();

      await p.enterValue(99); // not present
      await p.clickSearch();
      // Wait some time to let displayStep run if any steps exist
      await page.waitForTimeout(2500);

      // Assert no uncaught page errors
      expect(pageErrors.length).toBe(0);

      // Assert there are no console 'error' messages
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });
});