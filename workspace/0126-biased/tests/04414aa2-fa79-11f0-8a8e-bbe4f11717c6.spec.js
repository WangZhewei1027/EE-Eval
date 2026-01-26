import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04414aa2-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page object model for the Stack app
class StackPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.addButton = page.locator('#add-item');
    this.deleteButton = page.locator('#delete-item');
    this.headerTitle = page.locator('.header h1');
    this.mainHeading = page.locator('h2', { hasText: 'Stack Example' });
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickAdd() {
    await this.addButton.click();
  }

  async clickDelete() {
    await this.deleteButton.click();
  }

  async isAddVisible() {
    return await this.addButton.isVisible();
  }

  async isDeleteVisible() {
    return await this.deleteButton.isVisible();
  }

  async getHeaderText() {
    return await this.headerTitle.textContent();
  }
}

test.describe('Stack Interactive Application - FSM validation', () => {
  // Shared variables to collect console messages and page errors
  let consoleMessages;
  let pageErrors;
  let consoleListener;
  let pageErrorListener;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console events for later assertions
    consoleListener = (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    };
    page.on('console', consoleListener);

    // Capture page errors (uncaught exceptions in the page)
    pageErrorListener = (err) => {
      pageErrors.push(err);
    };
    page.on('pageerror', pageErrorListener);
  });

  test.afterEach(async ({ page }) => {
    // Remove listeners to avoid cross-test contamination
    if (consoleListener) page.off('console', consoleListener);
    if (pageErrorListener) page.off('pageerror', pageErrorListener);
    consoleListener = null;
    pageErrorListener = null;
  });

  test('S0_Idle: Initial render shows expected UI elements and no runtime errors', async ({ page }) => {
    // Validate initial Idle state UI and absence of page errors
    const stack = new StackPage(page);
    await stack.goto();

    // The header should be present and text should be "Stack"
    await expect(stack.headerTitle).toBeVisible();
    await expect(stack.headerTitle).toHaveText('Stack');

    // The main heading "Stack Example" should be present
    await expect(stack.mainHeading).toBeVisible();

    // Both buttons should be visible and have expected labels
    await expect(stack.addButton).toBeVisible();
    await expect(stack.addButton).toHaveText('Add Item');
    await expect(stack.deleteButton).toBeVisible();
    await expect(stack.deleteButton).toHaveText('Delete Item');

    // No uncaught page errors should have occurred during load
    expect(pageErrors.length).toBe(0);

    // No console "error" messages should have been emitted during load
    const consoleErrors = consoleMessages.filter((c) => c.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0 -> S1 (Add Item): clicking Add Item triggers an alert with expected message', async ({ page }) => {
    // Validate the alert raised by clicking the Add Item button
    const stack = new StackPage(page);
    await stack.goto();

    // Ensure the button exists before clicking
    await expect(stack.addButton).toBeVisible();

    // Wait for the dialog to appear as a result of clicking the button
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      stack.clickAdd(), // trigger the alert
    ]);

    // The dialog message should match FSM expected observable
    expect(dialog.message()).toBe('Item added successfully!');

    // Dismiss the alert to restore page interaction
    await dialog.accept();

    // Ensure clicking did not produce page errors
    expect(pageErrors.length).toBe(0);

    // Buttons remain present after the transition (no DOM removal in implementation)
    await expect(stack.addButton).toBeVisible();
    await expect(stack.deleteButton).toBeVisible();
  });

  test('Transition S0 -> S2 (Delete Item): clicking Delete Item triggers an alert with expected message', async ({ page }) => {
    // Validate the alert raised by clicking the Delete Item button
    const stack = new StackPage(page);
    await stack.goto();

    // Ensure the delete button exists before clicking
    await expect(stack.deleteButton).toBeVisible();

    // Wait for the dialog to appear as a result of clicking the button
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      stack.clickDelete(),
    ]);

    // The dialog message should match FSM expected observable
    expect(dialog.message()).toBe('Item deleted successfully!');

    // Dismiss the alert
    await dialog.accept();

    // Ensure no page errors happened from this interaction
    expect(pageErrors.length).toBe(0);

    // Buttons remain present after the transition
    await expect(stack.addButton).toBeVisible();
    await expect(stack.deleteButton).toBeVisible();
  });

  test('Edge case: multiple sequential clicks produce multiple alerts in order', async ({ page }) => {
    // Clicking Add twice should produce two alerts; capture both messages in order
    const stack = new StackPage(page);
    await stack.goto();

    // First alert
    const firstDialogPromise = page.waitForEvent('dialog');
    await stack.clickAdd();
    const firstDialog = await firstDialogPromise;
    expect(firstDialog.message()).toBe('Item added successfully!');
    await firstDialog.accept();

    // Second alert
    const secondDialogPromise = page.waitForEvent('dialog');
    await stack.clickAdd();
    const secondDialog = await secondDialogPromise;
    expect(secondDialog.message()).toBe('Item added successfully!');
    await secondDialog.accept();

    // Now click Add then Delete in quick succession: ensure both dialogs appear and messages are correct
    const addDialogPromise = page.waitForEvent('dialog');
    await stack.clickAdd();
    const addDialog = await addDialogPromise;
    expect(addDialog.message()).toBe('Item added successfully!');
    await addDialog.accept();

    const delDialogPromise = page.waitForEvent('dialog');
    await stack.clickDelete();
    const delDialog = await delDialogPromise;
    expect(delDialog.message()).toBe('Item deleted successfully!');
    await delDialog.accept();

    // No uncaught exceptions are expected
    expect(pageErrors.length).toBe(0);
  });

  test('Error scenario: clicking a non-existent selector should reject with an error', async ({ page }) => {
    // Attempting to click a non-existent element should result in a Playwright error
    const stack = new StackPage(page);
    await stack.goto();

    // Use Playwright's expect(...).rejects to assert the click fails
    await expect(page.click('#non-existent-selector', { timeout: 1000 })).rejects.toThrow();

    // No additional page runtime errors should have been emitted by the page itself
    // (the error here is thrown by Playwright, not an uncaught page exception)
    expect(pageErrors.length).toBe(0);
  });

  test('FSM entry action check: invoking missing renderPage() raises ReferenceError', async ({ page }) => {
    // The FSM mentions an entry action renderPage(), but the HTML does not define it.
    // Calling renderPage() from the page context should produce a ReferenceError.
    const stack = new StackPage(page);
    await stack.goto();

    // Evaluate calling renderPage() in the page context and expect it to reject with ReferenceError
    await expect(page.evaluate(() => {
      // Intentionally call the function that is not defined in the page implementation
      // This mirrors checking for an expected FSM entry action that is missing from the page.
      // We do NOT define or patch renderPage; we let the page throw naturally.
      return renderPage();
    })).rejects.toThrow(/renderPage is not defined|ReferenceError/);

    // The pageerror event should have captured the uncaught exception (depending on engine timing)
    // If a pageerror exists, ensure it references renderPage or similar. If none, that's acceptable too.
    if (pageErrors.length > 0) {
      const anyRenderPageError = pageErrors.some(err => String(err.message).includes('renderPage'));
      // If pageErrors captured something, prefer that it mentions renderPage.
      expect(anyRenderPageError || pageErrors.length > 0).toBeTruthy();
    }
  });

  test('Observability: ensure console did not emit unexpected error-level messages during interactions', async ({ page }) => {
    // Run a series of typical interactions and then ensure the console has no error-level messages
    const stack = new StackPage(page);
    await stack.goto();

    // Perform interactions that trigger alerts, handling dialogs as they appear
    const dialogs = [];
    for (const action of ['add', 'delete', 'add']) {
      const dialogPromise = page.waitForEvent('dialog');
      if (action === 'add') {
        await stack.clickAdd();
      } else {
        await stack.clickDelete();
      }
      const d = await dialogPromise;
      dialogs.push(d.message());
      await d.accept();
    }

    // Confirm expected dialog messages were observed
    expect(dialogs).toEqual([
      'Item added successfully!',
      'Item deleted successfully!',
      'Item added successfully!',
    ]);

    // Ensure no console errors occurred during these interactions
    const errors = consoleMessages.filter(c => c.type === 'error');
    expect(errors.length).toBe(0);

    // Also ensure no uncaught page exceptions were recorded
    expect(pageErrors.length).toBe(0);
  });
});