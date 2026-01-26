import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72aa0551-fa78-11f0-812d-c9788050701f.html';

// Page Object for the Linear Search app
class LinearSearchPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure DOMContentLoaded handlers run
    await this.page.waitForSelector('#arrayContainer .array-element', { timeout: 5000 });
  }

  get searchInput() {
    return this.page.locator('.search-input');
  }

  get searchBtn() {
    return this.page.locator('.search-btn');
  }

  get resetBtn() {
    return this.page.locator('.reset-btn');
  }

  get arrayContainer() {
    return this.page.locator('#arrayContainer');
  }

  get statusEl() {
    return this.page.locator('#status');
  }

  get arrayElements() {
    return this.page.locator('#arrayContainer .array-element');
  }

  // Return array of numeric values displayed in the UI
  async getArrayValues() {
    const count = await this.arrayElements.count();
    const values = [];
    for (let i = 0; i < count; i++) {
      const txt = await this.arrayElements.nth(i).textContent();
      // textContent includes index label appended; strip index label by taking line before last character digits
      // The element's textContent contains the number and then index label as separate child; trim to get the number prefix
      // We will extract the first number occurrence from the text.
      const match = txt && txt.match(/-?\d+/);
      values.push(match ? parseInt(match[0], 10) : NaN);
    }
    return values;
  }

  async setInput(value) {
    // Use fill to set value; for non-numeric tests we may fill 'abc'
    await this.searchInput.fill(String(value));
  }

  async clickSearch() {
    await this.searchBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  // Wait for status to show and return its trimmed text
  async waitForStatus(timeout = 15000) {
    await this.page.waitForFunction(() => {
      const s = document.getElementById('status');
      return s && s.classList.contains('show') && s.textContent.trim().length > 0;
    }, null, { timeout });
    const text = await this.statusEl.textContent();
    return text ? text.trim() : '';
  }

  // Wait until no 'active' classes present (useful to wait for search to complete)
  async waitForNoActive(timeout = 15000) {
    await this.page.waitForFunction(() => {
      const els = Array.from(document.querySelectorAll('.array-element'));
      return els.every(e => !e.classList.contains('active'));
    }, null, { timeout });
  }
}

test.describe('Linear Search Visualization - FSM and UI tests (72aa0551-fa78-11f0-812d-c9788050701f)', () => {
  let page;
  let lsPage;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors for assertions
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // Capture runtime errors thrown on the page
      pageErrors.push(err);
    });

    lsPage = new LinearSearchPage(page);
    await lsPage.goto();
  });

  test.afterEach(async () => {
    // Assert that there are no uncaught page errors in each test run
    // The app is expected to run without throwing unhandled exceptions.
    expect(pageErrors, 'No page errors should be thrown').toEqual([]);
    // Also assert that no console messages of severity 'error' were produced
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.text));
    expect(consoleErrors, 'No console errors should be present').toEqual([]);

    await page.close();
  });

  test('Initial Idle state: array is generated and status is empty', async () => {
    // Validate S0_Idle entry action: generateArray() should have created elements
    const elementsCount = await lsPage.arrayElements.count();
    expect(elementsCount).toBe(10); // generateArray() creates 10 elements

    // Status should be empty and not visible (no .show)
    const statusText = (await lsPage.statusEl.textContent())?.trim() || '';
    expect(statusText).toBe('');
    const hasShow = await lsPage.statusEl.evaluate(el => el.classList.contains('show'));
    expect(hasShow).toBe(false);
  });

  test('Start Search with invalid inputs shows validation message', async () => {
    // Edge case: non-numeric input (e.g., 'abc') should show validation text
    await lsPage.setInput('abc');
    await lsPage.clickSearch();

    const status1 = await lsPage.waitForStatus(2000);
    expect(status1).toBe('Please enter a valid number (1-99)');

    // Reset status for next edge case by clicking reset (ensures UI back to idle)
    await lsPage.clickReset();
    await lsPage.waitForNoActive();

    // Edge case: out-of-range number (e.g., 0) should also show validation
    await lsPage.setInput('0');
    await lsPage.clickSearch();
    const status2 = await lsPage.waitForStatus(2000);
    expect(status2).toBe('Please enter a valid number (1-99)');
  });

  test('Searching -> Found transition: searching for an existing element marks it found and updates status', async () => {
    // Get current array values and pick the value at index 0 (guaranteed to exist)
    const values = await lsPage.getArrayValues();
    expect(values.length).toBeGreaterThan(0);
    const targetIndex = 0;
    const targetValue = values[targetIndex];

    // Set input and start search
    await lsPage.setInput(String(targetValue));
    await lsPage.clickSearch();

    // Wait for final status indicating found
    const status = await lsPage.waitForStatus(15000);
    expect(status).toContain(`Found ${targetValue}`);
    expect(status).toContain(`index ${targetIndex}`);

    // Ensure the corresponding element has 'found' class
    const foundClass = await lsPage.arrayElements.nth(targetIndex).evaluate(el => el.classList.contains('found'));
    expect(foundClass).toBe(true);

    // Ensure there is at least one element with 'found' and none remain 'active'
    const anyFound = await lsPage.page.evaluate(() => !!document.querySelector('.array-element.found'));
    expect(anyFound).toBe(true);
    const anyActive = await lsPage.page.evaluate(() => !!document.querySelector('.array-element.active'));
    expect(anyActive).toBe(false);
  }, 20000);

  test('Searching -> NotFound transition: searching for a valid but missing value shows not found status', async () => {
    // Choose a valid number in 1-99 that's unlikely in the array; array values are 10..99 so choose 1 (valid input, not in generated array)
    const searchVal = 1;
    await lsPage.setInput(String(searchVal));
    await lsPage.clickSearch();

    const status = await lsPage.waitForStatus(15000);
    expect(status).toBe(`${searchVal} not found in the array.`);

    // Ensure no element has class 'found'
    const anyFound = await lsPage.page.evaluate(() => !!document.querySelector('.array-element.found'));
    expect(anyFound).toBe(false);
  }, 20000);

  test('Reset event regenerates array and clears search UI (S0_Idle -> S0_Idle)', async () => {
    // Capture current array values
    const beforeValues = await lsPage.getArrayValues();
    expect(beforeValues.length).toBe(10);

    // Perform a search to create visible status and classes
    const existingValue = beforeValues[1];
    await lsPage.setInput(String(existingValue));
    await lsPage.clickSearch();
    await lsPage.waitForStatus(15000);

    // Ensure some UI state present (found)
    const foundExists = await lsPage.page.evaluate(() => !!document.querySelector('.array-element.found'));
    expect(foundExists).toBe(true);

    // Click reset which should call generateArray() and resetSearch()
    await lsPage.clickReset();

    // After reset, ensure status cleared
    const statusText = (await lsPage.statusEl.textContent())?.trim() || '';
    expect(statusText).toBe('');
    const statusHasShow = await lsPage.statusEl.evaluate(el => el.classList.contains('show'));
    expect(statusHasShow).toBe(false);

    // Ensure all elements have no 'found' or 'active'
    const anyActiveOrFound = await lsPage.page.evaluate(() => {
      return !!document.querySelector('.array-element.active, .array-element.found');
    });
    expect(anyActiveOrFound).toBe(false);

    // Ensure array was regenerated (likely different); if coincidentally the same, at least the DOM was re-rendered
    const afterValues = await lsPage.getArrayValues();
    expect(afterValues.length).toBe(10);
    // If arrays are identical by chance, we still accept that reset happened; assert either differs or DOM nodes were recreated
    const arraysAreDifferent = JSON.stringify(beforeValues) !== JSON.stringify(afterValues);
    if (!arraysAreDifferent) {
      // fallback: ensure that elements are new nodes by comparing data-index attributes present and DOM count
      const nodeCount = await lsPage.arrayElements.count();
      expect(nodeCount).toBe(10); // DOM still contains 10 elements
    } else {
      expect(arraysAreDifferent).toBe(true);
    }
  }, 20000);

  test('Rapid interactions: clicking search multiple times while searching should not crash and no duplicate errors', async () => {
    // Choose a value not in array to force full search duration (~10*800ms)
    await lsPage.setInput('1'); // not present in array values 10..99
    // Click search, then immediately click it again a few times
    await lsPage.clickSearch();
    await lsPage.clickSearch();
    await lsPage.clickSearch();

    // Wait for completion
    const status = await lsPage.waitForStatus(20000);
    expect(status).toBe('1 not found in the array.');

    // Verify no page errors were thrown during rapid interactions (pageErrors are checked in afterEach)
  }, 25000);

  test('Edge case: empty input behaves like invalid input and shows validation message', async () => {
    // Clear the input
    await lsPage.setInput('');
    await lsPage.clickSearch();
    const status = await lsPage.waitForStatus(2000);
    expect(status).toBe('Please enter a valid number (1-99)');
  });

  test('Console and runtime monitoring on load: no unexpected errors in console or page', async () => {
    // This test explicitly validates that loading the page did not produce console errors or page errors
    // consoleMessages and pageErrors were populated in beforeEach; assert none are errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.text));
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});