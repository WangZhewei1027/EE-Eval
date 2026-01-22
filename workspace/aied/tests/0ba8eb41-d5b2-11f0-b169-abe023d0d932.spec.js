import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba8eb41-d5b2-11f0-b169-abe023d0d932.html';

// Page Object for the Adjacency List application
class AdjacencyPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.nameInput = page.locator('#name');
    this.addButton = page.locator('#add-button');
    this.removeButton = page.locator('#remove-button');
    this.table = page.locator('#adjacency-list');
    this.tableRows = page.locator('#adjacency-list tr');
    // collectors for diagnostics
    this.consoleMessages = [];
    this.pageErrors = [];
    this.dialogs = [];
    // Install listeners
    this.page.on('console', (msg) => {
      // collect all console messages for later assertions
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', (err) => {
      // collect uncaught exceptions from the page
      this.pageErrors.push(err);
    });
    this.page.on('dialog', async (dialog) => {
      // collect dialogs and automatically accept them to keep flow moving
      this.dialogs.push({ message: dialog.message(), type: dialog.type() });
      await dialog.accept();
    });
  }

  async goto() {
    // Load the page and wait for initial DOM
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // clear prior diagnostics state in case same page object reused
    this.consoleMessages.length = 0;
    this.pageErrors.length = 0;
    this.dialogs.length = 0;
  }

  async addNode(name) {
    await this.nameInput.fill(name);
    await this.addButton.click();
  }

  async removeNode(name) {
    await this.nameInput.fill(name);
    await this.removeButton.click();
  }

  async getRowCount() {
    return await this.tableRows.count();
  }

  async getLastRowText() {
    const count = await this.getRowCount();
    if (count === 0) return '';
    const lastRow = this.tableRows.nth(count - 1);
    return (await lastRow.innerText()).trim();
  }

  // helper to clear input
  async clearInput() {
    await this.nameInput.fill('');
  }
}

test.describe('Adjacency List App - FSM tests (0ba8eb41-d5b2-11f0-b169-abe023d0d932)', () => {
  let adjacencyPage;

  test.beforeEach(async ({ page }) => {
    adjacencyPage = new AdjacencyPage(page);
    await adjacencyPage.goto();
  });

  test.afterEach(async ({ page }) => {
    // Nothing to teardown beyond page lifecycle; diagnostics are captured on adjacencyPage
    // but ensure page is still reachable
    // (No explicit close here; Playwright will handle the page context)
  });

  test('Idle state renders correctly - initial elements present (FSM: S0_Idle entry renderPage)', async () => {
    // This test validates the initial Idle state: presence of input, buttons, and table header
    // Verify input exists and has correct placeholder
    await expect(adjacencyPage.nameInput).toBeVisible();
    await expect(adjacencyPage.nameInput).toHaveAttribute('placeholder', 'Enter the first node name');

    // Verify Add and Remove buttons exist
    await expect(adjacencyPage.addButton).toBeVisible();
    await expect(adjacencyPage.removeButton).toBeVisible();

    // Verify adjacency list table has header row with expected columns
    const headerRow = adjacencyPage.tableRows.first();
    await expect(headerRow).toBeVisible();
    const headerText = (await headerRow.innerText()).replace(/\s+/g, ' ').trim();
    expect(headerText).toContain('Node');
    expect(headerText).toContain('Next Node');

    // No uncaught page errors should have occurred during initial render
    expect(adjacencyPage.pageErrors.length).toBe(0);
    // No console errors expected (collection available for debugging)
    const consoleErrs = adjacencyPage.consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });

  test('AddNode transition - adds a node and updates adjacency list (FSM: S0_Idle -> S1_NodeAdded)', async () => {
    // This test validates adding a node updates the DOM as expected.
    const initialRows = await adjacencyPage.getRowCount();
    expect(initialRows).toBeGreaterThanOrEqual(1); // at least header

    // Add a valid node
    await adjacencyPage.addNode('NodeA');

    // After adding, table should have one additional row
    const afterRows = await adjacencyPage.getRowCount();
    expect(afterRows).toBe(initialRows + 1);

    // The last row should contain the node name and 'Next Node' text
    const lastRowText = await adjacencyPage.getLastRowText();
    expect(lastRowText).toContain('NodeA');
    expect(lastRowText).toContain('Next Node');

    // Ensure no uncaught page errors during normal add flow
    expect(adjacencyPage.pageErrors.length).toBe(0);

    // Confirm that there are no console.error messages
    const consoleErrs = adjacencyPage.consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });

  test('AddNode edge case - clicking Add with empty input shows alert', async () => {
    // This test validates the empty-input validation path for Add button.
    await adjacencyPage.clearInput();
    // Use explicit waitForEvent to capture dialog raised by alert
    const [dialog] = await Promise.all([
      adjacencyPage.page.waitForEvent('dialog'),
      adjacencyPage.addButton.click()
    ]);
    expect(dialog.message()).toBe('Please enter a node name.');
    // The automatic dialog listener in the page object will also have recorded it
    expect(adjacencyPage.dialogs.some(d => d.message === 'Please enter a node name.')).toBeTruthy();
  });

  test('RemoveNode after adding a node shows "No node to remove." alert (FSM: S0_Idle -> S2_NodeRemoved expected path)', async () => {
    // This test follows the path: add then remove the same node.
    // Because the implementation sets adjacencyList[name] = null when adding,
    // the removal code path should trigger the "No node to remove." alert.
    await adjacencyPage.addNode('ToRemove');

    // Verify the row was added
    const rowsAfterAdd = await adjacencyPage.getRowCount();
    expect(rowsAfterAdd).toBeGreaterThanOrEqual(2);

    // Now attempt remove - capture dialog
    const [dialog] = await Promise.all([
      adjacencyPage.page.waitForEvent('dialog'),
      adjacencyPage.removeNode('ToRemove')
    ]);
    // The implementation's logic leads to outer else and should alert 'No node to remove.'
    expect(dialog.message()).toBe('No node to remove.');

    // Ensure the table content hasn't been altered unexpectedly (still contains the original added row)
    const lastRowText = await adjacencyPage.getLastRowText();
    expect(lastRowText).toContain('ToRemove');
    expect(lastRowText).toContain('Next Node');

    // No uncaught page errors should be present for this flow
    expect(adjacencyPage.pageErrors.length).toBe(0);
  });

  test('RemoveNode for non-existent node triggers a runtime error (uncaught TypeError) and is observable via pageerror', async () => {
    // This test validates the buggy path where adjacencyList[name] is undefined
    // which leads to accessing next on undefined and causes a TypeError.
    // Ensure the name we will use has not been added in this fresh page instance.
    const ghostName = 'GhostNode_XYZ';

    // Prepare a promise to capture pageerror
    const pageErrorPromise = adjacencyPage.page.waitForEvent('pageerror').then(err => err).catch(e => e);

    // Perform the remove action which is expected to raise an uncaught exception in page context.
    await adjacencyPage.removeNode(ghostName);

    // Wait for the pageerror
    const pageError = await pageErrorPromise;

    // There should be an error and its message should indicate it's related to 'next' or reading property of undefined
    expect(pageError).toBeDefined();
    const msg = pageError.message || String(pageError);
    // Accept multiple possible browser messages but ensure it pertains to the buggy access of `next`.
    expect(
      msg.includes('next') ||
      msg.toLowerCase().includes('cannot read') ||
      msg.toLowerCase().includes('cannot read properties') ||
      msg.toLowerCase().includes('typeerror')
    ).toBeTruthy();

    // Also confirm we captured the error through the page object's listener
    expect(adjacencyPage.pageErrors.length).toBeGreaterThanOrEqual(1);
    const recordedMsg = adjacencyPage.pageErrors[0].message || String(adjacencyPage.pageErrors[0]);
    expect(recordedMsg.toLowerCase()).toContain('next');
  });

  test('RemoveNode edge case - clicking Remove with empty input shows alert', async () => {
    // This test validates the empty-input validation path for Remove button.
    await adjacencyPage.clearInput();
    const [dialog] = await Promise.all([
      adjacencyPage.page.waitForEvent('dialog'),
      adjacencyPage.removeButton.click()
    ]);
    expect(dialog.message()).toBe('Please enter a node name.');
    expect(adjacencyPage.dialogs.some(d => d.message === 'Please enter a node name.')).toBeTruthy();
  });

  test('Adding duplicate node names results in multiple table rows (observational test of app behavior)', async () => {
    // This test checks that adding the same node name twice appends another row (no deduplication)
    const name = 'DupNode';
    const initialRows = await adjacencyPage.getRowCount();

    await adjacencyPage.addNode(name);
    const rowsAfterFirst = await adjacencyPage.getRowCount();
    expect(rowsAfterFirst).toBe(initialRows + 1);

    await adjacencyPage.addNode(name);
    const rowsAfterSecond = await adjacencyPage.getRowCount();
    expect(rowsAfterSecond).toBe(rowsAfterFirst + 1);

    // Ensure last row contains the duplicated name
    const lastRowText = await adjacencyPage.getLastRowText();
    expect(lastRowText).toContain(name);
  });
});