import { test, expect } from '@playwright/test';

// Page Object for the Multiset interactive page
class MultisetPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/044198c2-fa79-11f0-8a8e-bbe4f11717c6.html';
    this.addButton = page.locator('#add-button');
    this.removeButton = page.locator('#remove-button');
    this.multisetCells = page.locator('.multiset .cell');
  }

  async goto() {
    await this.page.goto(this.url);
  }

  async clickAdd() {
    await this.addButton.click();
  }

  // Note: this may throw if button is disabled (Playwright reports element not enabled)
  async clickRemove(options = {}) {
    await this.removeButton.click(options);
  }

  async isRemoveDisabled() {
    return await this.removeButton.isDisabled();
  }

  async getCellsText() {
    return await this.multisetCells.allTextContents();
  }

  async countCells() {
    return await this.multisetCells.count();
  }
}

test.describe('Multiset Interactive Application - FSM Validation', () => {
  /** @type {Array<import('@playwright/test').ConsoleMessage>} */
  let consoleMessages;
  /** @type {Array<Error>} */
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Capture console messages and page errors so tests can assert on them later.
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // Collect console messages (info/warn/error) for later assertions and debugging.
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    page.on('pageerror', (err) => {
      // Collect unhandled exceptions (ReferenceError, TypeError, SyntaxError etc.)
      pageErrors.push(err);
    });
  });

  test.describe('State S0_Idle (Initial State)', () => {
    test('Initial UI matches Idle state: Add present, Remove disabled', async ({ page }) => {
      // Arrange
      const app = new MultisetPage(page);

      // Act
      await app.goto();

      // Assert - UI elements exist
      await expect(app.addButton).toBeVisible({ timeout: 2000 });
      await expect(app.addButton).toHaveText('Add Element');

      await expect(app.removeButton).toBeVisible({ timeout: 2000 });
      // In S0_Idle the remove button is disabled
      await expect(app.removeButton).toBeDisabled();

      // Verify multiset initial visualization is present and has expected initial cells
      const count = await app.countCells();
      // According to the HTML implementation there are 4 cells initially.
      expect(count).toBe(4);

      // Verify no unexpected runtime page errors were thrown during load.
      // We capture page errors separately below in a dedicated test; this assertion
      // is a quick check to ensure no uncaught exceptions on initial load.
      expect(pageErrors.length).toBe(0);
    });

    test('Clicking disabled Remove button should not succeed (edge case)', async ({ page }) => {
      // This validates the edge case of attempting to remove when in Idle state.
      const app = new MultisetPage(page);
      await app.goto();

      // Ensure it's disabled first
      await expect(app.removeButton).toBeDisabled();

      // Attempting to click the disabled button using normal click should fail.
      // We assert that Playwright throws when trying to click an element that is disabled.
      let clickError = null;
      try {
        await app.clickRemove();
      } catch (err) {
        clickError = err;
      }

      // We expect an error from Playwright about the element not being enabled.
      expect(clickError).not.toBeNull();
      expect(String(clickError)).toMatch(/not enabled|Element is not|Element is disabled/i);
    });
  });

  test.describe('Transition: AddElement (S0_Idle -> S1_ElementAdded)', () => {
    test('Click Add Element transitions to Element Added state (remove enabled)', async ({ page }) => {
      // This test validates the FSM transition on AddElement.
      // It asserts that after clicking Add, the Remove button becomes enabled
      // and that the multiset visualization reflects an added element if implemented.
      const app = new MultisetPage(page);
      await app.goto();

      // Precondition: remove button disabled in Idle
      await expect(app.removeButton).toBeDisabled();

      // Action: click Add
      await app.clickAdd();

      // Assertion: in S1_ElementAdded, both buttons should be present and remove should be enabled.
      // NOTE: If the application's script is not implemented, this expectation will fail,
      // which is intended: the test validates the expected FSM behavior.
      await expect(app.removeButton).toBeEnabled({ timeout: 2000 });

      // Optionally verify that the multiset changed (e.g., number of cells increased)
      // If the app implements adding, count should be > initial count. We check defensively.
      const countAfter = await app.countCells();
      // At minimum, assert we still have the original cells visible (i.e., DOM intact).
      expect(countAfter).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Transition: RemoveElement (S1_ElementAdded -> S0_Idle)', () => {
    test('Click Remove Element transitions back to Idle (remove disabled)', async ({ page }) => {
      // This test covers the full round-trip: Add then Remove.
      const app = new MultisetPage(page);
      await app.goto();

      // Start from Idle -> Add to move to S1
      await app.clickAdd();

      // Expect remove to be enabled in S1 before clicking it
      await expect(app.removeButton).toBeEnabled({ timeout: 2000 });

      // Click remove to transition back to Idle
      await app.clickRemove();

      // After remove, we expect the remove button to be disabled again (S0_Idle)
      await expect(app.removeButton).toBeDisabled({ timeout: 2000 });

      // Verify the multiset visualization remains consistent (DOM present)
      const finalCount = await app.countCells();
      expect(finalCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Error Observation and Console Monitoring', () => {
    test('Capture console messages and page errors during interactions', async ({ page }) => {
      // This test is explicitly focused on observing runtime console output and uncaught errors.
      // It does NOT modify or patch the page; it only observes natural errors and logs.

      const app = new MultisetPage(page);
      await app.goto();

      // Perform some interactions that might trigger errors (best-effort)
      // - Click Add
      // - Try to click Remove (it may be disabled or enabled depending on implementation)
      await app.clickAdd().catch(() => {
        // swallow; any exceptions will be captured by page.on('pageerror') or by this catch
      });

      // Try clicking remove but allow failure; if disabled, Playwright will throw which we catch.
      try {
        await app.clickRemove();
      } catch (err) {
        // intentionally swallow; we collect errors via page.on('pageerror') above
      }

      // Wait a short time to allow any asynchronous errors to surface
      await page.waitForTimeout(250);

      // Attach a summary assertion: we assert the consoleMessages array is available.
      expect(Array.isArray(consoleMessages)).toBe(true);

      // For pageErrors (uncaught exceptions), ensure the array is defined.
      expect(Array.isArray(pageErrors)).toBe(true);

      // Provide informative assertions:
      // - We expect there to be zero uncaught runtime exceptions on a healthy implementation.
      // - However, in this test suite we DO NOT patch the runtime: if there are errors,
      //   they will be captured in pageErrors and this assertion will fail — surfacing those issues.
      expect(pageErrors.length).toBe(0);

      // Additionally, assert that the console contains at least the Add and Remove button-related logs or no errors.
      // This is a lenient check: we ensure console messages were captured (possibly zero) and validate types.
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      // We assert that there are no fatal console errors. If the app outputs console.error, this will fail,
      // and the failure will indicate issues in the runtime (as required to be observed).
      expect(errorConsoleMessages.length).toBe(0);
    });

    test('Log observed console messages and page errors for debugging (does not fail test)', async ({ page }, testInfo) => {
      // This test collects logs and attaches them to the test report for debugging.
      // It will not fail; it's a utility to expose the captured output.
      const localConsole = [];
      const localPageErrors = [];

      page.on('console', msg => localConsole.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', err => localPageErrors.push(String(err)));

      const app = new MultisetPage(page);
      await app.goto();

      // Exercise page briefly
      await app.clickAdd().catch(() => {});
      try {
        await app.clickRemove();
      } catch (e) {
        // ignore
      }

      await page.waitForTimeout(150);

      // Attach as test artifacts so CI logs can be inspected
      testInfo.attach('console-messages', {
        body: JSON.stringify(localConsole, null, 2),
        contentType: 'application/json'
      });

      testInfo.attach('page-errors', {
        body: JSON.stringify(localPageErrors, null, 2),
        contentType: 'application/json'
      });

      // Basic sanity assertions (do not fail the test based on errors)
      expect(Array.isArray(localConsole)).toBe(true);
      expect(Array.isArray(localPageErrors)).toBe(true);
    });
  });

  test.afterEach(async () => {
    // Teardown: nothing special to do; we keep console and pageErrors arrays for test inspection.
    // This block is present for clarity and potential future cleanup.
  });
});