import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324ee660-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object encapsulating selectors and helper methods for the Relational Database Example page
class RelationalDbPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.customersBodySelector = '#customersTable tbody';
    this.ordersBodySelector = '#ordersTable tbody';
    this.customersRows = this.page.locator('#customersTable tbody tr');
    this.ordersRows = this.page.locator('#ordersTable tbody tr');
    this.customerHeaders = this.page.locator('#customersTable thead th');
    this.ordersHeaders = this.page.locator('#ordersTable thead th');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async customerRowCount() {
    return await this.customersRows.count();
  }

  async orderRowCount() {
    return await this.ordersRows.count();
  }

  // Return the text content of a specific cell by row index (0-based) and column index (0-based)
  async getCustomerCellText(rowIndex, colIndex) {
    const cell = this.page.locator(`#customersTable tbody tr:nth-child(${rowIndex + 1}) td:nth-child(${colIndex + 1})`);
    return cell.textContent();
  }

  async getOrderCellText(rowIndex, colIndex) {
    const cell = this.page.locator(`#ordersTable tbody tr:nth-child(${rowIndex + 1}) td:nth-child(${colIndex + 1})`);
    return cell.textContent();
  }

  // Get header text for customers table (array)
  async getCustomerHeadersText() {
    const count = await this.customerHeaders.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await this.customerHeaders.nth(i).textContent()).trim());
    }
    return texts;
  }

  // Get header text for orders table (array)
  async getOrderHeadersText() {
    const count = await this.ordersHeaders.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await this.ordersHeaders.nth(i).textContent()).trim());
    }
    return texts;
  }

  // Invoke the in-page population functions (these are defined by the page)
  async invokePopulateFunctions() {
    // Call existing functions on the page context without redefining them
    await this.page.evaluate(() => {
      // These functions are defined by the page script; call them again to test idempotency/duplication behavior
      if (typeof populateCustomersTable === 'function') populateCustomersTable();
      if (typeof populateOrdersTable === 'function') populateOrdersTable();
    });
  }
}

// Group related tests
test.describe('Relational Database Example - FSM: S0_Idle entry actions and DOM validation', () => {
  // Arrays to collect console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (log, error, warn, info)
    page.on('console', msg => {
      // Capture type and text for assertions later
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect unhandled page errors (uncaught exceptions)
    page.on('pageerror', err => {
      // err can be an Error object
      pageErrors.push(err);
    });
  });

  test('Initial load executes entry actions: customers and orders tables are populated (S0_Idle)', async ({ page }) => {
    // This test validates that the page's onload entry actions populate the tables as described in S0_Idle
    const db = new RelationalDbPage(page);
    await db.goto();

    // Expect customers table to have 3 rows (from the sample data)
    await expect(db.customersRows).toHaveCount(3);
    // Expect orders table to have 5 rows (from the sample data)
    await expect(db.ordersRows).toHaveCount(5);

    // Verify content of first customer row (ID = 1, Name = Alice Smith, Email = alice@example.com)
    const firstCustomerId = (await db.getCustomerCellText(0, 0)).trim();
    const firstCustomerName = (await db.getCustomerCellText(0, 1)).trim();
    const firstCustomerEmail = (await db.getCustomerCellText(0, 2)).trim();
    expect(firstCustomerId).toBe('1');
    expect(firstCustomerName).toBe('Alice Smith');
    expect(firstCustomerEmail).toBe('alice@example.com');

    // Verify content of last order row (fifth order)
    const lastOrderIndex = 4; // 0-based index for 5th row
    const lastOrderId = (await db.getOrderCellText(lastOrderIndex, 0)).trim();
    const lastOrderCustomerId = (await db.getOrderCellText(lastOrderIndex, 1)).trim();
    const lastOrderProduct = (await db.getOrderCellText(lastOrderIndex, 2)).trim();
    const lastOrderQuantity = (await db.getOrderCellText(lastOrderIndex, 3)).trim();

    expect(lastOrderId).toBe('105');
    expect(lastOrderCustomerId).toBe('2');
    expect(lastOrderProduct).toBe('USB Cable');
    expect(lastOrderQuantity).toBe('5');

    // Ensure no uncaught errors were emitted during load
    expect(pageErrors.length, 'No uncaught exceptions should occur during initial load').toBe(0);

    // Optionally check console for error-level messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'No console.error messages expected on initial load').toBe(0);
  });

  test('Table headers are present and correct for both Customers and Orders', async ({ page }) => {
    // This test validates the table structure and header labels (visual/DOM feedback)
    const db = new RelationalDbPage(page);
    await db.goto();

    const expectedCustomerHeaders = ['ID', 'Name', 'Email'];
    const expectedOrderHeaders = ['Order ID', 'Customer ID', 'Product', 'Quantity'];

    const customerHeaders = await db.getCustomerHeadersText();
    const orderHeaders = await db.getOrderHeadersText();

    expect(customerHeaders).toEqual(expectedCustomerHeaders);
    expect(orderHeaders).toEqual(expectedOrderHeaders);

    // No page errors expected from header rendering
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: invoking populate functions again appends duplicate rows (idempotency/clearing behavior)', async ({ page }) => {
    // This test deliberately calls the existing populate functions again to validate behavior
    // It checks whether functions clear the table before populating (they do not in this implementation)
    const db = new RelationalDbPage(page);
    await db.goto();

    // Verify initial counts
    await expect(db.customersRows).toHaveCount(3);
    await expect(db.ordersRows).toHaveCount(5);

    // Call the page's populate functions again (the page defines these functions)
    await db.invokePopulateFunctions();

    // Because populate functions insert rows without clearing, expect counts to double
    // If the implementation changed to clear, this assertion would reflect that regression
    await expect(db.customersRows).toHaveCount(6);
    await expect(db.ordersRows).toHaveCount(10);

    // Check that the first and fourth (duplicate) customer rows contain expected identical data
    const originalFirstCustomerName = (await db.getCustomerCellText(0, 1)).trim();
    const duplicatedFirstCustomerName = (await db.getCustomerCellText(3, 1)).trim();
    expect(originalFirstCustomerName).toBe('Alice Smith');
    expect(duplicatedFirstCustomerName).toBe('Alice Smith');

    // Ensure no uncaught exceptions during manual invocation
    expect(pageErrors.length).toBe(0);
  });

  test('There are no interactive controls or transitions defined on the page (no buttons/inputs)', async ({ page }) => {
    // This test validates FSM notes that there are no interactive elements.
    const db = new RelationalDbPage(page);
    await db.goto();

    // Query for elements that would indicate interactivity
    const interactiveCount = await page.evaluate(() => {
      const selectors = ['button', 'input', 'select', 'textarea', 'a[role="button"]'];
      return selectors.reduce((sum, sel) => sum + document.querySelectorAll(sel).length, 0);
    });

    // FSM indicated no interactive elements; assert zero interactive controls
    expect(interactiveCount).toBe(0);

    // Also assert there are no clickable anchors that look like controls
    const clickableAnchors = await page.locator('a').count();
    // Anchor count may be zero; if present they are not expected to act as transitions
    // At minimum, ensure there are no anchors with onclick handlers that are visible
    const anchorsWithOnclick = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).filter(a => a.getAttribute('onclick')).length;
    });
    expect(anchorsWithOnclick).toBe(0);

    // No page errors expected
    expect(pageErrors.length).toBe(0);
  });

  test('Console and page error observation: capture logs and ensure no runtime errors (ReferenceError, SyntaxError, TypeError)', async ({ page }) => {
    // This test demonstrates observation of console messages and pageerrors.
    // It validates that the page loads cleanly without common runtime errors.
    const db = new RelationalDbPage(page);
    await db.goto();

    // At this point consoleMessages and pageErrors have been collected by listeners in beforeEach
    // Assert there are no uncaught exceptions
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

    // Ensure there are no console messages of type 'error'
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length, 'No console.error messages expected').toBe(0);

    // Specifically ensure there were no ReferenceError, SyntaxError, or TypeError messages
    const problematicErrors = consoleMessages.filter(m => /ReferenceError|SyntaxError|TypeError/.test(m.text));
    expect(problematicErrors.length, 'No ReferenceError, SyntaxError, or TypeError console messages expected').toBe(0);
  });

  test('Robustness: reloading the page re-populates tables without throwing', async ({ page }) => {
    // Reloading should re-run window.onload and re-populate tables. This tests reload behavior.
    const db = new RelationalDbPage(page);
    await db.goto();

    // Initial counts
    await expect(db.customersRows).toHaveCount(3);
    await expect(db.ordersRows).toHaveCount(5);

    // Reload the page; the page's onload should run again on reload but the DOM will be reinitialized
    await page.reload({ waitUntil: 'load' });

    // After reload, counts should be back to single-populated counts (3 and 5)
    await expect(db.customersRows).toHaveCount(3);
    await expect(db.ordersRows).toHaveCount(5);

    // No uncaught errors expected during reload
    expect(pageErrors.length).toBe(0);
  });

  test.afterEach(async ({ }, testInfo) => {
    // Provide helpful diagnostics if a test failed by printing recent console messages and page errors
    if (testInfo.status !== testInfo.expectedStatus) {
      // When a test fails, include console and page errors in failure output to aid debugging
      // Note: This does not alter page state or behavior; it simply logs information for the test run
      // Playwright will display this information in the test output
      if (consoleMessages.length) {
        console.log('Captured console messages (first 20):', consoleMessages.slice(0, 20));
      }
      if (pageErrors.length) {
        console.log('Captured page errors (first 20):', pageErrors.slice(0, 20).map(e => String(e)));
      }
    }
  });
});