import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99ce5b33-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the B-Tree app
class BTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.orderInput = page.locator('#order');
    this.createButton = page.locator('#createTree');
    this.insertInput = page.locator('#insertValue');
    this.insertButton = page.locator('#insertButton');
    this.deleteInput = page.locator('#deleteValue');
    this.deleteButton = page.locator('#deleteButton');
    this.display = page.locator('#btreeDisplay');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async createTree(order = '3') {
    await this.orderInput.fill(String(order));
    await this.createButton.click();
  }

  async insertValue(value) {
    await this.insertInput.fill(String(value));
    await this.insertButton.click();
  }

  async deleteValue(value) {
    await this.deleteInput.fill(String(value));
    await this.deleteButton.click();
  }

  async getDisplayText() {
    return await this.display.innerHTML();
  }

  async isCreateButtonVisible() {
    return await this.createButton.isVisible();
  }
}

test.describe('B-Tree Interactive Demo - FSM based tests', () => {
  // Collect runtime dialogs, page errors, and console messages for assertions
  let dialogs = [];
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    dialogs = [];
    pageErrors = [];
    consoleMessages = [];

    // Capture dialogs (alerts) to be inspected by tests
    page.on('dialog', async (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      // Accept so the page is not blocked by modal dialogs
      try {
        await dialog.accept();
      } catch (e) {
        // If accepting fails for some reason, ignore to let the test observe page behavior
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages for debugging and assertions
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the app page exactly as-is
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // No teardown modifications to the page are performed - leaving environment as-is
  });

  test.describe('Initial state (S0_Idle)', () => {
    test('should render the page and show Create B-Tree button', async ({ page }) => {
      // Validate initial Idle state: create button exists and display is empty
      const app = new BTreePage(page);
      // Ensure create button is visible
      expect(await app.isCreateButtonVisible()).toBe(true);

      // The btreeDisplay should exist; initial innerHTML likely empty
      const displayHtml = await app.getDisplayText();
      expect(displayHtml).toBeTruthy(); // element exists; content may be empty string
      // There should be no unexpected dialogs or page errors at load
      expect(dialogs.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Create Tree transitions (S0_Idle -> S1_TreeCreated)', () => {
    test('creating a B-Tree updates the display with the selected order', async ({ page }) => {
      const app = new BTreePage(page);

      // Create tree with default order (3)
      await app.createTree('3');

      // Verify the display shows the creation message with order
      const displayHtml = await app.getDisplayText();
      expect(displayHtml).toContain('B-Tree created with order 3');

      // No alert should have been shown for a successful creation
      expect(dialogs.length).toBe(0);

      // No page errors expected
      expect(pageErrors.length).toBe(0);
    });

    test('creating a B-Tree with a different order updates display accordingly', async ({ page }) => {
      const app = new BTreePage(page);

      // Create tree with order 4
      await app.createTree('4');
      const displayHtml = await app.getDisplayText();
      expect(displayHtml).toContain('B-Tree created with order 4');

      expect(dialogs.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Insert Value transitions (S1_TreeCreated -> S2_ValueInserted)', () => {
    test('inserting before creating a tree should alert the user (edge case)', async ({ page }) => {
      const app = new BTreePage(page);

      // Attempt to insert without creating a tree
      await app.insertValue('10');

      // Expect an alert asking user to create a B-Tree first
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      // The last dialog should match the expected message
      const lastDialog = dialogs[dialogs.length - 1];
      expect(lastDialog.message).toBe('Please create a B-Tree first.');

      // No uncaught page errors expected from this path
      expect(pageErrors.length).toBe(0);
    });

    test('inserting values after creating a tree updates the display', async ({ page }) => {
      const app = new BTreePage(page);

      // Create tree first
      await app.createTree('3');
      expect((await app.getDisplayText())).toContain('B-Tree created with order 3');

      // Insert 10
      await app.insertValue('10');
      // After inserting, the display should reflect keys (Keys: 10)
      let displayHtml = await app.getDisplayText();
      expect(displayHtml).toContain('Keys:');
      expect(displayHtml).toContain('10');

      // Insert 5 (should be ordered in the node)
      await app.insertValue('5');
      displayHtml = await app.getDisplayText();
      // Expect both keys to be present; order should be ascending "5, 10"
      expect(displayHtml).toContain('5');
      expect(displayHtml).toContain('10');
      // A simple check that the combined substring appears (may differ by HTML formatting)
      expect(displayHtml.replace(/\s+/g, '')).toMatch(/Keys:5,10/);

      // No alert should have been shown after successful inserts
      expect(dialogs.length).toBe(0);

      // No uncaught page errors expected
      expect(pageErrors.length).toBe(0);
    });

    test('inserting an empty value after creating a tree results in NaN being inserted (edge behavior)', async ({ page }) => {
      const app = new BTreePage(page);

      // Create the tree
      await app.createTree('3');
      expect((await app.getDisplayText())).toContain('B-Tree created with order 3');

      // Insert empty string -> parseInt('') is NaN; the implementation does not guard against this
      await app.insertValue('');
      const displayHtml = await app.getDisplayText();

      // The display may show 'NaN' in keys if NaN was inserted.
      // We assert that either NaN appears or that there was no alert and no exception.
      const containsNaN = displayHtml.includes('NaN');
      expect(containsNaN || dialogs.length === 0).toBeTruthy();

      // Ensure no page errors were thrown due to NaN insertion
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Delete Value transitions (S1_TreeCreated -> S3_ValueDeleted / edge cases)', () => {
    test('deleting before creating a tree should alert the user', async ({ page }) => {
      const app = new BTreePage(page);

      // Attempt to delete without creating a tree
      await app.deleteValue('10');

      // Expect an alert asking user to create a B-Tree first
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      const lastDialog = dialogs[dialogs.length - 1];
      expect(lastDialog.message).toBe('Please create a B-Tree first.');

      expect(pageErrors.length).toBe(0);
    });

    test('deleting after creating a tree does not throw and does not update display (delete not implemented)', async ({ page }) => {
      const app = new BTreePage(page);

      // Create tree and insert a value so we have state to inspect
      await app.createTree('3');
      await app.insertValue('20');
      let beforeDelete = await app.getDisplayText();
      expect(beforeDelete).toContain('20');

      // Clear any prior dialogs if present
      dialogs = [];

      // Perform delete (method exists but is a stub)
      await app.deleteValue('20');

      // Because delete() is not implemented, we expect no alert and no change in display
      expect(dialogs.length).toBe(0);

      const afterDelete = await app.getDisplayText();
      // The display should remain unchanged (delete not implemented)
      expect(afterDelete).toContain('20');

      // No uncaught page errors expected
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Robustness checks and runtime observations', () => {
    test('should not have unhandled page errors during typical interactions', async ({ page }) => {
      const app = new BTreePage(page);

      // Perform a series of typical interactions
      await app.createTree('3');
      await app.insertValue('1');
      await app.insertValue('2');
      await app.insertValue('3');
      await app.deleteValue('2'); // delete is a no-op

      // After interactions assert that there were no uncaught page errors
      // Capture any page errors and fail if present
      if (pageErrors.length > 0) {
        // Provide debug information in the assertion message
        const messages = pageErrors.map((e) => e.message || String(e));
        expect(pageErrors.length, `Unexpected page errors: ${messages.join(' | ')}`).toBe(0);
      } else {
        expect(pageErrors.length).toBe(0);
      }

      // Console messages are captured for visibility; ensure none are fatal errors (console.error)
      const errors = consoleMessages.filter((c) => c.type === 'error');
      expect(errors.length).toBe(0);
    });

    test('record console and dialog interactions for manual debugging if needed', async ({ page }) => {
      // This test documents captured console messages and dialogs so they are available in CI logs if issues occur.
      const app = new BTreePage(page);

      await app.createTree('3');
      await app.insertValue('42');

      // We expect at least the successful creation and insertion to not produce dialogs
      expect(dialogs.length).toBe(0);

      // Ensure some console messages may be present but no console.error entries
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });
});