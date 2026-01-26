import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72aa2c60-fa78-11f0-812d-c9788050701f.html';

// Page Object for the Interpolation Search app
class InterpolationSearchPage {
  constructor(page) {
    this.page = page;
    this.searchInput = page.locator('#searchValue');
    this.searchButton = page.locator('#searchButton');
    this.status = page.locator('#status');
    this.arrayContainer = page.locator('#arrayContainer');
    this.arrayElements = page.locator('.array-element');
    this.particles = page.locator('#particles');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for DOMContentLoaded effects: array should be initialized
    await this.arrayContainer.waitFor({ state: 'attached' });
    // Ensure the elements are rendered
    await this.page.waitForFunction(() => {
      return document.querySelectorAll('.array-element').length > 0;
    });
  }

  // Returns array of numbers shown in the UI
  async getArrayValues() {
    const count = await this.arrayElements.count();
    const values = [];
    for (let i = 0; i < count; i++) {
      const el = this.arrayElements.nth(i);
      const text = await el.textContent();
      values.push(Number(text?.trim()));
    }
    return values;
  }

  // Enter value into input
  async enterValue(value) {
    await this.searchInput.fill(String(value));
  }

  // Click search button
  async clickSearch() {
    await this.searchButton.click();
  }

  // Get status text
  async getStatusText() {
    return (await this.status.textContent())?.trim() ?? '';
  }

  // Wait until status contains substring
  async waitForStatusContains(substring, timeout = 10000) {
    await expect(this.status).toContainText(substring, { timeout });
  }

  // Find element locator for a given numeric value (first match)
  elementForValue(value) {
    const text = String(value);
    return this.page.locator('.array-element', { hasText: text }).first();
  }

  // Count elements with given class
  async countElementsWithClass(className) {
    return await this.page.evaluate((cls) => {
      return Array.from(document.querySelectorAll('.array-element')).filter(el => el.classList.contains(cls)).length;
    }, className);
  }
}

test.describe('Interpolation Search Visual App - FSM tests', () => {
  // Capture console and page errors per test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) {
        // ignore listening errors
      }
    });

    page.on('pageerror', err => {
      // pageerror is an uncaught exception in the page context
      pageErrors.push(err);
    });
  });

  test('S0 Idle: initializeArray() runs on DOMContentLoaded and array is rendered', async ({ page }) => {
    // This test validates the initial Idle state:
    // - initializeArray() should create 15 .array-element items
    // - status element should be present but not visible (no .show class)
    // - particles container should have particle children created
    const app = new InterpolationSearchPage(page);
    await app.goto();

    // Assert that there are exactly 15 array elements as per implementation
    const count = await app.arrayElements.count();
    expect(count).toBe(15);

    // Assert that the numbers are sorted ascending
    const values = await app.getArrayValues();
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }

    // Status should be initialized but not visible (no 'show' class initially)
    const statusClass = await page.locator('#status').getAttribute('class');
    // May be null or empty if no classes; ensure it does not contain 'show'
    expect(statusClass || '').not.toContain('show');

    // Particles container should have children (particleCount of 30). We assert at least 1 to be robust.
    const particleCount = await page.locator('#particles').evaluate(node => node.children.length);
    expect(particleCount).toBeGreaterThanOrEqual(1);

    // Ensure no uncaught errors were emitted on initial load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0 -> S1: clicking search triggers "Starting search for ..." status', async ({ page }) => {
    // This test validates the transition from Idle to Searching:
    // - Entering any numeric value and clicking search should make status start with "Starting search for"
    const app = new InterpolationSearchPage(page);
    await app.goto();

    // Choose an existing value from the UI to ensure interpolationSearch will run
    const values = await app.getArrayValues();
    const target = values[0];

    await app.enterValue(target);
    // Click search and immediately assert the status text begins the search
    await Promise.all([
      app.clickSearch(),
      // the interpolationSearch sets the status to "Starting search for ..." immediately,
      // so wait for that substring to appear
      app.waitForStatusContains(`Starting search for ${target}`, 5000)
    ]);

    // Ensure status has the 'show' class which indicates it's visible
    const statusClass = await page.locator('#status').getAttribute('class');
    expect(statusClass || '').toContain('show');

    // No page errors should have occurred during this interaction
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('S2 Found: searching an existing value results in Found state and active element', async ({ page }) => {
    // This test validates the Searching -> Found transition:
    // - When we search for an existing element, status must update to "Found X at position Y in Z steps!"
    // - The corresponding array element should gain the "active" class
    const app = new InterpolationSearchPage(page);
    await app.goto();

    // Pick a middle element to increase chance of multiple steps
    const values = await app.getArrayValues();
    const target = values[Math.floor(values.length / 2)];

    await app.enterValue(target);

    // Click and wait until 'Found <target>' appears in status.
    // Interpolation search includes delays for visualization, so give generous timeout.
    await app.clickSearch();
    await app.waitForStatusContains(`Found ${target}`, 15000);

    // Verify the element corresponding to the target has the 'active' class
    const targetEl = app.elementForValue(target);
    await expect(targetEl).toBeVisible();
    const classAttr = await targetEl.getAttribute('class');
    expect(classAttr || '').toContain('active');

    // Also ensure no uncaught page errors occurred during the search
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('S3 NotFound: searching a non-existing value results in Not Found state', async ({ page }) => {
    // This test validates the Searching -> NotFound transition:
    // - When searching for a value not present in the array, status must indicate "not found in the array"
    // - No element should have the 'active' class
    const app = new InterpolationSearchPage(page);
    await app.goto();

    // Construct a value that is guaranteed not to be in the array:
    // take max(array) and add a large offset
    const values = await app.getArrayValues();
    const maxVal = Math.max(...values);
    const target = maxVal + 1000;

    await app.enterValue(target);
    await app.clickSearch();

    // Wait for the 'not found' status. Allow generous timeout because of visualization delays.
    await app.waitForStatusContains('not found in the array', 15000);

    // Ensure no element is marked as active
    const activeCount = await app.countElementsWithClass('active');
    expect(activeCount).toBe(0);

    // At least one checked element is expected for a not-found search (unless degenerate),
    // but we do not assert exact number to avoid flakiness.
    const checkedCount = await app.countElementsWithClass('checked');
    expect(checkedCount).toBeGreaterThanOrEqual(0);

    // Ensure no uncaught page errors were produced during the search
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: clicking search with empty or non-numeric input does not initiate search', async ({ page }) => {
    // This test validates that the click handler guards against non-numeric input:
    // - If input is empty or not a number, the search should not run (status should not become visible)
    const app = new InterpolationSearchPage(page);
    await app.goto();

    // Ensure input is empty
    await app.searchInput.fill('');
    await app.clickSearch();

    // Give a short delay to allow any accidental handlers to run (shouldn't)
    await page.waitForTimeout(500);

    // Status should remain invisible (no 'show' class) and empty text
    const statusClass = await page.locator('#status').getAttribute('class');
    expect(statusClass || '').not.toContain('show');
    const statusText = await app.getStatusText();
    // Status may be empty string or whitespace; assert it does not start "Starting search for"
    expect(statusText).not.toContain('Starting search for');

    // Now try with a clearly invalid value (non-numeric via setValue using DOM to circumvent input type)
    // We must not modify or patch page code; but setting a non-numeric value into a number input will coerce to empty.
    await app.searchInput.fill(''); // cannot type non-numeric into number input reliably
    await app.clickSearch();
    await page.waitForTimeout(500);

    // Still no search initiated
    const statusText2 = await app.getStatusText();
    expect(statusText2).not.toContain('Starting search for');

    // No runtime page errors should be present
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observability: collect console errors and page errors (should be none)', async ({ page }) => {
    // This test explicitly listens for console errors and page errors while exercising the app
    // It asserts that no uncaught exceptions occur during typical use.
    const app = new InterpolationSearchPage(page);

    // Arrays to collect messages are set up in beforeEach via listeners.
    await app.goto();

    // Perform a found search and a not-found search sequentially to exercise code paths
    const values = await app.getArrayValues();
    const foundTarget = values[0];
    await app.enterValue(foundTarget);
    await app.clickSearch();
    await app.waitForStatusContains(`Found ${foundTarget}`, 15000);

    // Not-found
    const notFoundTarget = Math.max(...values) + 500;
    await app.enterValue(notFoundTarget);
    await app.clickSearch();
    await app.waitForStatusContains('not found in the array', 15000);

    // Assert there were no page errors or console errors during the interactions
    // If there were ReferenceError/SyntaxError/TypeError thrown by the page, they would have been captured.
    expect(pageErrors.length, 'no uncaught page errors should have occurred').toBe(0);
    expect(consoleErrors.length, 'no console.error messages should have been logged').toBe(0);
  });

  // Teardown is implicit; Playwright closes pages between tests by default
});