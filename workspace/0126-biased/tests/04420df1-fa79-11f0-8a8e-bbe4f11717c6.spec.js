import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04420df1-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page object representing the graph application
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.items = page.locator('.graph-item');
    this.buttons = page.locator('.button');
  }

  // Click the graph item by zero-based index
  async clickItem(index) {
    await this.items.nth(index).click();
  }

  // Return whether the item at index has the 'selected' class
  async isItemSelected(index) {
    return await this.items.nth(index).evaluate((el) => el.classList.contains('selected'));
  }

  // Add the 'selected' class to an item (manipulates DOM to set up edge case)
  async addSelectedToItem(index) {
    await this.items.nth(index).evaluate((el) => el.classList.add('selected'));
  }

  // Remove the 'selected' class from an item (manipulates DOM for setup/cleanup)
  async removeSelectedFromItem(index) {
    await this.items.nth(index).evaluate((el) => el.classList.remove('selected'));
  }

  // Click a button by zero-based index (there are two buttons; only the first has an event listener in the page)
  async clickButton(index) {
    await this.buttons.nth(index).click();
  }

  // Count how many items have the selected class
  async countSelectedItems() {
    return await this.page.$$eval('.graph-item.selected', els => els.length);
  }

  // Get text content of graph item at index
  async getItemText(index) {
    return await this.items.nth(index).innerText();
  }
}

test.describe('Graph (Directed) FSM - 04420df1-fa79-11f0-8a8e-bbe4f11717c6', () => {
  let consoleMessages;
  let pageErrors;

  // Setup before each test: navigate, and capture console messages & page errors
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for later assertions
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // If something unexpected happens while reading the message, capture that too
        consoleMessages.push({ type: 'internal-error', text: String(e) });
      }
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the application exactly as-is
    await page.goto(APP_URL);
  });

  // Teardown / diagnostic check after each test to assert no unexpected runtime exceptions occurred
  test.afterEach(async () => {
    // Many tests explicitly assert pageErrors when expecting errors; here we only emit diagnostics.
    // Individual tests will assert pageErrors length as needed.
  });

  test('Initial state: first graph item is selected and others are not (validates S1_ItemSelected initial evidence)', async ({ page }) => {
    // This test validates the initial DOM corresponds to an item-selected state as per the HTML provided.
    const graph = new GraphPage(page);

    // There should be at least one selected item (based on provided HTML the first item is selected)
    const firstSelected = await graph.isItemSelected(0);
    expect(firstSelected).toBe(true);

    // Ensure other items are not selected by default
    const secondSelected = await graph.isItemSelected(1);
    expect(secondSelected).toBe(false);

    // Ensure exactly one selected item exists initially (defensive check)
    const selectedCount = await graph.countSelectedItems();
    expect(selectedCount).toBeGreaterThanOrEqual(1);
    // Based on the provided HTML we expect exactly 1 initially
    expect(selectedCount).toBe(1);

    // There should be no uncaught page errors immediately after load
    expect(pageErrors.length).toBe(0);
  });

  test('Graph item click: clicking an unselected item does NOT select it (reveals implementation bug)', async ({ page }) => {
    // This test asserts the observed (buggy) behavior:
    // The page's implementation only reacts to clicks on items that already have the 'selected' class.
    // Therefore clicking an unselected item will not move the selection as an expected FSM transition would.
    const graph = new GraphPage(page);

    // Sanity check initial state
    expect(await graph.isItemSelected(0)).toBe(true);
    expect(await graph.isItemSelected(1)).toBe(false);

    // Click an unselected item (index 1). According to the FSM we'd expect to transition to selected,
    // but the implementation doesn't add 'selected' when clicking an unselected item.
    await graph.clickItem(1);

    // After the click, assert that the clicked item is still NOT selected
    const clickedIsSelected = await graph.isItemSelected(1);
    expect(clickedIsSelected).toBe(false);

    // The original selection should remain on the first item
    expect(await graph.isItemSelected(0)).toBe(true);

    // No console errors should have occurred due to this click
    expect(pageErrors.length).toBe(0);

    // Also ensure no console message 'Button clicked!' was emitted by this action (we didn't click a button)
    const buttonLogs = consoleMessages.filter(m => m.text.includes('Button clicked!'));
    expect(buttonLogs.length).toBe(0);
  });

  test('Graph item click: clicking an already selected item removes selection from others and re-applies to the clicked item', async ({ page }) => {
    // This test validates the on-click behavior when clicking an item that is already selected.
    // We set up a scenario where multiple items appear selected, then click the first (selected) item and expect
    // the implementation to remove 'selected' from others then add it back to the clicked one.
    const graph = new GraphPage(page);

    // Ensure item 0 is selected initially
    expect(await graph.isItemSelected(0)).toBe(true);

    // Artificially add 'selected' to item 2 to simulate an inconsistent DOM state that the code aims to clean up
    await graph.addSelectedToItem(2);
    expect(await graph.isItemSelected(2)).toBe(true);

    // Now click the already selected item (index 0). Implementation loops all items and removes 'selected' then adds it back to the clicked one.
    await graph.clickItem(0);

    // After the click, item 2 should no longer be selected
    expect(await graph.isItemSelected(2)).toBe(false);

    // Item 0 should remain selected
    expect(await graph.isItemSelected(0)).toBe(true);

    // Exactly one selected item should exist after the cleanup
    const selectedCount = await graph.countSelectedItems();
    expect(selectedCount).toBe(1);

    // No uncaught page errors should have occurred
    expect(pageErrors.length).toBe(0);
  });

  test('Button click: first button logs "Button clicked!" while second button does not (validates ButtonClick handling)', async ({ page }) => {
    // The HTML attaches the click listener to the first element matching '.button' only.
    // This test ensures the page logs the expected message when the first button is clicked and nothing when the second is clicked.
    const graph = new GraphPage(page);

    // Clear any previous console messages collected during navigation
    consoleMessages = [];

    // Click the first button (index 0) which has the listener in the provided implementation
    await graph.clickButton(0);

    // Wait a tick to ensure console handler runs
    await page.waitForTimeout(50);

    // Find console logs that match the expected message
    const buttonMessages = consoleMessages.filter(m => m.text.includes('Button clicked!'));
    expect(buttonMessages.length).toBeGreaterThanOrEqual(1);

    // Now click the second button (index 1) which has no event listener attached by the provided JS
    consoleMessages = []; // reset collected messages
    await graph.clickButton(1);
    await page.waitForTimeout(50);

    // There should be no 'Button clicked!' messages from clicking the second button
    const secondButtonMessages = consoleMessages.filter(m => m.text.includes('Button clicked!'));
    expect(secondButtonMessages.length).toBe(0);

    // No page errors should have occurred in the process
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: rapid clicks across various items do not produce unexpected errors and follow the implemented (possibly incorrect) logic', async ({ page }) => {
    // This test simulates rapid user interaction across multiple items to ensure stability.
    // It verifies that even under rapid interactions, no uncaught exceptions occur and the DOM ends in a consistent state per implementation.
    const graph = new GraphPage(page);

    // Rapid clicks sequence: click item1 (unselected), item1 again, then click item0 (selected), then item2 (unselected)
    await graph.clickItem(1);
    await graph.clickItem(1);
    await graph.clickItem(0);
    await graph.clickItem(2);

    // Wait briefly for event loop processing
    await page.waitForTimeout(100);

    // According to the implementation, clicking unselected items does nothing, clicking selected item does a cleanup that preserves that selected item.
    // Therefore, ensure the first item (index 0) remains selected if it was clicked while selected
    expect(await graph.isItemSelected(0)).toBe(true);

    // Unselected items clicked should remain unselected
    expect(await graph.isItemSelected(1)).toBe(false);
    expect(await graph.isItemSelected(2)).toBe(false);

    // Ensure no uncaught exceptions happened during rapid interaction
    expect(pageErrors.length).toBe(0);
  });

  test('FSM transition coverage sanity: verify that clicking various items does not inadvertently create multiple selected items', async ({ page }) => {
    // This test broadly ensures that the UI never leaves the DOM with more than one selected item after any single click,
    // which would violate the intended exclusive selection semantics even if some clicks don't toggle correctly.
    const graph = new GraphPage(page);

    // Ensure initial count is 1
    expect(await graph.countSelectedItems()).toBe(1);

    // Click every item once (sequentially) to exercise all event handlers
    const itemCount = await page.$$eval('.graph-item', els => els.length);
    for (let i = 0; i < itemCount; i++) {
      await graph.clickItem(i);
    }

    // After clicking every item once, check selected items count is at least 1 and not more than 1 (implementation attempts exclusivity)
    const selectedCount = await graph.countSelectedItems();
    expect(selectedCount).toBeLessThanOrEqual(1);

    // No uncaught errors
    expect(pageErrors.length).toBe(0);
  });

  test('Diagnostic: capture console and page errors on load (assert none unexpected)', async ({ page }) => {
    // This diagnostic test asserts the environment did not throw during initialization.
    // If there were runtime errors like ReferenceError/SyntaxError/TypeError they would be captured in pageErrors.
    expect(Array.isArray(consoleMessages)).toBe(true);

    // If pageErrors exist, fail the test and print them (keeps behavior explicit)
    if (pageErrors.length > 0) {
      // Fail with a helpful message including stack traces
      const aggregated = pageErrors.map(e => String(e && e.stack ? e.stack : e)).join('\n\n---\n\n');
      throw new Error('Unexpected page errors detected during load:\n' + aggregated);
    }

    // Also verify that initial console logs do not contain unhandled exceptions or 'undefined is not a function' style messages
    const problematicConsole = consoleMessages.find(m =>
      /error|uncaught|exception|undefined is not|is not a function|ReferenceError|TypeError|SyntaxError/i.test(m.text)
    );
    expect(problematicConsole).toBeUndefined();
  });
});