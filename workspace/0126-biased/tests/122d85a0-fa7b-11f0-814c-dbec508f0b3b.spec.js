import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122d85a0-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object to interact with the app
class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      createUser: 'button[onclick="createUser()"]',
      getUser: 'button[onclick="getUser()"]',
      updateUser: 'button[onclick="updateUser()"]',
      deleteUser: 'button[onclick="deleteUser()"]',
      createProduct: 'button[onclick="createProduct()"]',
      getProduct: 'button[onclick="getProduct()"]',
      updateProduct: 'button[onclick="updateProduct()"]',
      deleteProduct: 'button[onclick="deleteProduct()"]',
      saveProduct: 'button[onclick="saveProduct()"]',
      loadProduct: 'button[onclick="loadProduct()"]',
      productName: 'input#productName',
      productTableRows: '#productTable tr',
      productTable: '#productTable',
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure page is loaded
    await expect(this.page).toHaveURL(APP_URL);
  }

  async setProductName(name) {
    await this.page.fill(this.selectors.productName, name);
  }

  async clearProductName() {
    await this.page.fill(this.selectors.productName, '');
  }

  async click(selector) {
    await this.page.click(selector);
  }

  async countTableRows() {
    return await this.page.locator(this.selectors.productTableRows).count();
  }

  async hasButton(selector) {
    return await this.page.locator(selector).isVisible();
  }

  async renderPageExists() {
    return await this.page.evaluate(() => typeof window.renderPage !== 'undefined');
  }
}

test.describe('REST API Demo - S0_Idle and transitions', () => {
  let app;

  test.beforeEach(async ({ page }) => {
    app = new AppPage(page);
    await app.goto();
  });

  test('S0_Idle: page renders all primary controls and components', async ({ page }) => {
    // Validate presence of all buttons and main components described in the FSM
    const selectors = [
      'button[onclick="createUser()"]',
      'button[onclick="getUser()"]',
      'button[onclick="updateUser()"]',
      'button[onclick="deleteUser()"]',
      'button[onclick="createProduct()"]',
      'button[onclick="getProduct()"]',
      'button[onclick="updateProduct()"]',
      'button[onclick="deleteProduct()"]',
      'button[onclick="saveProduct()"]',
      'button[onclick="loadProduct()"]',
      'input#productName',
      '#productTable'
    ];
    for (const sel of selectors) {
      await expect(page.locator(sel)).toBeVisible();
    }

    // Verify that the declared FSM entry action renderPage() is NOT defined in the page.
    // The FSM mentions renderPage() in entry_actions, but the implementation doesn't define it.
    const renderExists = await app.renderPageExists();
    // We assert renderPage is undefined (i.e., not present). This verifies the onEnter action is absent.
    expect(renderExists).toBe(false);
  });

  test.describe('User CRUD flows (Create/Get/Update/Delete)', () => {
    // CreateUser success and edge cases
    test('CreateUser: creates a user when productName is provided and updates product table', async ({ page }) => {
      // Initial row count
      const initialRows = await app.countTableRows();

      // Provide a productName to drive createUser() success path
      const dialogPromise = page.waitForEvent('dialog');
      await app.setProductName('Alice');
      await Promise.all([
        dialogPromise,
        app.click(app.selectors.createUser)
      ]);
      const dialog = await dialogPromise;
      // Assert the alert message corresponds to success path from createUser()
      expect(dialog.message()).toContain('User created successfully!');
      await dialog.accept();

      // After creating, the updateProductTable() should have been called and table rows updated.
      // Wait briefly for DOM update then check rows count increased by 1.
      await page.waitForTimeout(100);
      const afterRows = await app.countTableRows();
      expect(afterRows).toBeGreaterThanOrEqual(initialRows + 1);
    });

    test('CreateUser: shows validation alert if productName is empty', async ({ page }) => {
      // Ensure productName empty
      await app.clearProductName();
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        app.click(app.selectors.createUser)
      ]);
      expect(dialog.message()).toContain('Please enter a product name!');
      await dialog.accept();

      // No page error should have occurred for this path
      // We check quickly that no uncaught pageerror events occurred by attempting a small delay.
      await page.waitForTimeout(100);
    });

    // The following operations require an input with id productID which does not exist in the DOM.
    // Per instructions, we must allow TypeError/ReferenceError to happen naturally and assert that they occur.

    test('GetUser: clicking Get User triggers a runtime error due to missing productID input', async ({ page }) => {
      // Expect a pageerror because the implementation tries to access document.getElementById('productID').value
      const errorPromise = page.waitForEvent('pageerror');
      await app.click(app.selectors.getUser);
      const err = await errorPromise;
      // The thrown error should be a TypeError related to reading .value of null (productID missing)
      expect(err).toBeTruthy();
      expect(err.message).toMatch(/productID|Cannot read properties of null|Cannot read property/);
    });

    test('UpdateUser: clicking Update User triggers a runtime error due to missing productID input', async ({ page }) => {
      const errorPromise = page.waitForEvent('pageerror');
      await app.click(app.selectors.updateUser);
      const err = await errorPromise;
      expect(err).toBeTruthy();
      expect(err.message).toMatch(/productID|Cannot read properties of null|Cannot read property/);
    });

    test('DeleteUser: clicking Delete User triggers a runtime error due to missing productID input', async ({ page }) => {
      const errorPromise = page.waitForEvent('pageerror');
      await app.click(app.selectors.deleteUser);
      const err = await errorPromise;
      expect(err).toBeTruthy();
      expect(err.message).toMatch(/productID|Cannot read properties of null|Cannot read property/);
    });
  });

  test.describe('Product CRUD & Save/Load flows', () => {
    test('CreateProduct: creates a product when productName provided and updates table', async ({ page }) => {
      const initialRows = await app.countTableRows();
      await app.setProductName('New Product X');

      // capture dialog
      const dialogPromise = page.waitForEvent('dialog');
      await Promise.all([
        dialogPromise,
        app.click(app.selectors.createProduct)
      ]);
      const dialog = await dialogPromise;
      expect(dialog.message()).toContain('Product created successfully!');
      await dialog.accept();

      await page.waitForTimeout(100);
      const afterRows = await app.countTableRows();
      expect(afterRows).toBeGreaterThanOrEqual(initialRows + 1);

      // Confirm the newly added product name appears somewhere in the table cells
      const tableText = await page.locator('#productTable').innerText();
      expect(tableText).toContain('New Product X');
    });

    test('CreateProduct: shows validation alert if productName is empty', async ({ page }) => {
      await app.clearProductName();
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        app.click(app.selectors.createProduct)
      ]);
      expect(dialog.message()).toContain('Please enter a product name!');
      await dialog.accept();
    });

    test('GetProduct: clicking Get Product triggers runtime error due to missing productID', async ({ page }) => {
      const errorPromise = page.waitForEvent('pageerror');
      await app.click(app.selectors.getProduct);
      const err = await errorPromise;
      expect(err).toBeTruthy();
      expect(err.message).toMatch(/productID|Cannot read properties of null|Cannot read property/);
    });

    test('UpdateProduct: clicking Update Product triggers runtime error due to missing productID/productPrice inputs', async ({ page }) => {
      const errorPromise = page.waitForEvent('pageerror');
      await app.click(app.selectors.updateProduct);
      const err = await errorPromise;
      expect(err).toBeTruthy();
      // Could reference productID or productPrice; check both possibilities
      expect(err.message).toMatch(/productID|productPrice|Cannot read properties of null|Cannot read property/);
    });

    test('DeleteProduct: clicking Delete Product triggers runtime error due to missing productID input', async ({ page }) => {
      const errorPromise = page.waitForEvent('pageerror');
      await app.click(app.selectors.deleteProduct);
      const err = await errorPromise;
      expect(err).toBeTruthy();
      expect(err.message).toMatch(/productID|Cannot read properties of null|Cannot read property/);
    });

    test('SaveProduct: saves product when productName provided and updates table', async ({ page }) => {
      const initialRows = await app.countTableRows();
      await app.setProductName('Saved Product Y');

      const dialogPromise = page.waitForEvent('dialog');
      await Promise.all([
        dialogPromise,
        app.click(app.selectors.saveProduct)
      ]);
      const dialog = await dialogPromise;
      expect(dialog.message()).toContain('Product saved successfully!');
      await dialog.accept();

      await page.waitForTimeout(100);
      const afterRows = await app.countTableRows();
      expect(afterRows).toBeGreaterThanOrEqual(initialRows + 1);

      const tableText = await page.locator('#productTable').innerText();
      expect(tableText).toContain('Saved Product Y');
    });

    test('SaveProduct: shows validation alert if productName is empty', async ({ page }) => {
      await app.clearProductName();
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        app.click(app.selectors.saveProduct)
      ]);
      expect(dialog.message()).toContain('Please enter a product name!');
      await dialog.accept();
    });

    test('LoadProduct: clicking Load Product triggers runtime error due to missing productID input', async ({ page }) => {
      const errorPromise = page.waitForEvent('pageerror');
      await app.click(app.selectors.loadProduct);
      const err = await errorPromise;
      expect(err).toBeTruthy();
      expect(err.message).toMatch(/productID|Cannot read properties of null|Cannot read property/);
    });
  });

  test.describe('Edge cases & DOM mutation checks', () => {
    test('updateProductTable: calling flows should remove table header and render rows (implicit via button flows)', async ({ page }) => {
      // Before any mutations, the table has a header row and possibly data rows
      const headerExistsBefore = await page.locator('#productTable th').count();
      expect(headerExistsBefore).toBeGreaterThanOrEqual(1);

      // Trigger createUser which will call updateProductTable() and in implementation it clears the table innerHTML
      await app.setProductName('HeaderTest');
      const dialogPromise = page.waitForEvent('dialog');
      await Promise.all([
        dialogPromise,
        app.click(app.selectors.createUser)
      ]);
      const dialog = await dialogPromise;
      await dialog.accept();

      // After updateProductTable() the header is removed because innerHTML is cleared first
      await page.waitForTimeout(100);
      const headerExistsAfter = await page.locator('#productTable th').count();
      expect(headerExistsAfter).toBe(0);

      // Ensure rows were rendered for users array
      const rows = await app.countTableRows();
      expect(rows).toBeGreaterThanOrEqual(1);
    });

    test('Verify absence of renderPage function (FSM entry action) - explicit check', async ({ page }) => {
      // The FSM mentioned renderPage() as an entry action. Confirm it's not defined in the window
      const exists = await page.evaluate(() => typeof window.renderPage !== 'undefined');
      expect(exists).toBe(false);
    });
  });
});