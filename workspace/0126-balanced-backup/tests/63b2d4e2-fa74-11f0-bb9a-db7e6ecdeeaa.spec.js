import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b2d4e2-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object representing the application UI and common interactions
class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // DOM element handles
  customerSelect() { return this.page.locator('#customer-select'); }
  showOrdersButton() { return this.page.locator('button[onclick="performQuery()"]'); }
  resultDiv() { return this.page.locator('#result'); }
  customersTableRows() { return this.page.locator('#customers-table-body tr'); }
  productsTableRows() { return this.page.locator('#products-table-body tr'); }
  ordersTableRows() { return this.page.locator('#orders-table-body tr'); }
  resultTableRows() { return this.page.locator('#result table tbody tr'); }

  // Actions
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Click the Show Orders button (triggers performQuery)
  async clickShowOrders() {
    await this.showOrdersButton().click();
  }

  // Programmatically set the customer-select's value (mimics user selection)
  // If the option exists, use selectOption; otherwise set value via evaluate (edge-case test)
  async selectCustomerValue(value) {
    const selectLocator = this.customerSelect();
    // Try using selectOption for normal cases (when option exists)
    const options = await selectLocator.locator('option').all();
    const values = await Promise.all(options.map(o => o.getAttribute('value')));
    if (values.includes(String(value))) {
      await selectLocator.selectOption(String(value));
    } else {
      // Set value directly on the element to simulate an edge-case filter value
      await this.page.evaluate((v) => {
        const sel = document.getElementById('customer-select');
        sel.value = String(v);
      }, value);
    }
  }

  // Read table cells for a particular result row index (0-based)
  async getResultRowValues(rowIndex) {
    const row = this.resultTableRows().nth(rowIndex);
    const cells = row.locator('td');
    const count = await cells.count();
    const values = [];
    for (let i = 0; i < count; i++) {
      values.push((await cells.nth(i).innerText()).trim());
    }
    return values;
  }

  // Returns the raw innerText of the result div
  async getResultDivText() {
    return (await this.resultDiv().innerText()).trim();
  }
}

// Group tests for the Relational Database Demo and its FSM behavior
test.describe('Relational Database Demo (FSM) - 63b2d4e2-fa74-11f0-bb9a-db7e6ecdeeaa', () => {
  // Containers to capture console messages and page errors
  let consoleMessages = [];
  let pageErrors = [];

  // Setup before each test: attach listeners and navigate to the app
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection; we'll assert absence of error-level logs
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  // Test the initial load: S0_Idle entry actions should have run and display orders (S1_OrdersDisplayed)
  test('Initial load populates tables and displays all orders (Idle -> Orders Displayed)', async ({ page }) => {
    const app = new AppPage(page);

    // Navigate to the page and wait for the result table to be populated by onload -> performQuery()
    await app.goto();

    // The application performs populate* functions on window.onload and calls performQuery(), so the #result should include a table
    await page.waitForSelector('#result table');

    // Verify that the customers, products, and orders tables were populated (entry actions)
    await expect(app.customersTableRows()).toHaveCount(3); // 3 customers
    await expect(app.productsTableRows()).toHaveCount(3); // 3 products
    await expect(app.ordersTableRows()).toHaveCount(5); // 5 orders

    // The result of performQuery on load should display all orders (5 rows)
    await expect(app.resultTableRows()).toHaveCount(5);

    // Validate the first row contains expected joined data for OrderID 1001 (Alice & Laptop)
    const firstRowValues = await app.getResultRowValues(0);
    // Expected columns: OrderID, Customer Name, Product, Unit Price ($), Quantity, Total ($)
    expect(firstRowValues[0]).toBe('1001'); // OrderID
    expect(firstRowValues[1]).toBe('Alice Johnson'); // Customer Name
    expect(firstRowValues[2]).toBe('Laptop'); // Product
    expect(firstRowValues[3]).toBe('899.00'); // Unit price with two decimals
    expect(firstRowValues[4]).toBe('1'); // Quantity
    expect(firstRowValues[5]).toBe('899.00'); // Total = 899 * 1

    // Assert no uncaught page errors or console.error messages occurred during load
    // (We observe and assert their absence; if any errors occurred naturally, this assertion will fail)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length, `Expected no page errors, but found: ${pageErrors.map(e => String(e)).join(', ')}`).toBe(0);
    expect(consoleErrors.length, `Expected no console.error messages, but found: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
  });

  // Test the explicit Show Orders event/transition triggered by clicking the button
  test('Clicking "Show Orders" triggers performQuery and updates results (ShowOrders transition)', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();

    // Ensure initial state shows all orders
    await page.waitForSelector('#result table');
    await expect(app.resultTableRows()).toHaveCount(5);

    // Now select a specific customer (CustomerID = 1 -> Alice Johnson) and click "Show Orders"
    await app.selectCustomerValue('1');
    await app.clickShowOrders();

    // After clicking, expect the result table to update and only include orders for CustomerID 1 (there are 2 orders)
    await expect(app.resultTableRows()).toHaveCount(2);

    // Validate that each row shows "Alice Johnson" as the customer name
    const rowCount = await app.resultTableRows().count();
    for (let i = 0; i < rowCount; i++) {
      const cols = await app.getResultRowValues(i);
      expect(cols[1]).toBe('Alice Johnson');
      // Unit Price and Total formatting also validated
      // Quantity should be integer-like string
      expect(Number(cols[4])).toBeGreaterThanOrEqual(1);
      // Total is numeric string with two decimals
      expect(/^\d+\.\d{2}$/.test(cols[5])).toBe(true);
    }

    // Ensure clicking the button did not produce any console errors or page errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length, `Expected no page errors after click, found: ${pageErrors.map(e => String(e)).join(', ')}`).toBe(0);
    expect(consoleErrors.length, `Expected no console.error messages after click, found: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
  });

  // Edge case: selecting a non-existent customer ID should result in "No orders found."
  test('Filtering to a non-existent customer displays "No orders found." (edge case)', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();

    // Set the select to an arbitrary non-existent value (e.g., 999) by assigning value directly in the DOM
    await app.selectCustomerValue('999');

    // Trigger the query via the button
    await app.clickShowOrders();

    // The result div should contain the expected message
    await expect(app.resultDiv()).toContainText('No orders found.');

    // Verify that there's no result table present now (since there are no rows)
    const tablePresent = await page.$('#result table');
    expect(tablePresent).toBeNull();

    // No console errors or page errors should have been thrown from handling this edge case
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length, `Expected no page errors for edge-case filter, found: ${pageErrors.map(e => String(e)).join(', ')}`).toBe(0);
    expect(consoleErrors.length, `Expected no console.error messages for edge-case filter, found: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
  });

  // Validate numeric formatting, totals, and consistent computation across displayed rows
  test('Result numeric formatting: Unit Price and Total use two decimals and Total = UnitPrice * Quantity', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();

    await page.waitForSelector('#result table');
    const rows = await app.resultTableRows().count();
    expect(rows).toBeGreaterThan(0);

    for (let i = 0; i < rows; i++) {
      const cols = await app.getResultRowValues(i);
      // Unit Price and Total should be formatted with two decimals
      expect(/^\d+\.\d{2}$/.test(cols[3])).toBe(true, `UnitPrice formatting incorrect for row ${i}: ${cols[3]}`);
      expect(/^\d+\.\d{2}$/.test(cols[5])).toBe(true, `Total formatting incorrect for row ${i}: ${cols[5]}`);

      // Check Total arithmetic (allowing minor floating rounding)
      const unit = parseFloat(cols[3]);
      const qty = parseInt(cols[4], 10);
      const total = parseFloat(cols[5]);
      const expected = Number((unit * qty).toFixed(2));
      expect(Math.abs(total - expected) < 1e-6).toBe(true);
    }

    // Check for absence of runtime errors during formatting checks
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length, `Expected no page errors during formatting checks, found: ${pageErrors.map(e => String(e)).join(', ')}`).toBe(0);
    expect(consoleErrors.length, `Expected no console.error during formatting checks, found: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
  });

  // Cleanup: if any test left console or page errors collected, fail explicitly with diagnostics
  test.afterEach(async () => {
    if (pageErrors.length > 0) {
      // This will cause the test to fail with a descriptive message if any uncaught errors occurred
      throw new Error(`Detected uncaught page errors: ${pageErrors.map(e => String(e)).join('\n')}`);
    }
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    if (consoleErrors.length > 0) {
      throw new Error(`Detected console.error messages: ${consoleErrors.map(m => m.text).join(' | ')}`);
    }
  });
});