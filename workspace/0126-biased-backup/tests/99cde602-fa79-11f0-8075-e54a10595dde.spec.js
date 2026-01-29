import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cde602-fa79-11f0-8075-e54a10595dde.html';

/**
 * Page Object for the Circular Linked List demo page.
 * Encapsulates interactions and common assertions against the DOM.
 */
class CircularListPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.nodeInput = page.locator('#nodeInput');
    this.traverseCount = page.locator('#traverseCount');
    this.addButton = page.locator('button[onclick="addNode()"]');
    this.deleteButton = page.locator('button[onclick="deleteNode()"]');
    this.viewButton = page.locator('button[onclick="viewList()"]');
    this.traverseButton = page.locator('button[onclick="traverseList()"]');
    this.listOutput = page.locator('#listOutput');
    this.heading = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getHeadingText() {
    return await this.heading.innerText();
  }

  async addNodeExpectDialog(value) {
    // Fill input then click, expect an alert with specific message.
    await this.nodeInput.fill(value);
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.addButton.click(),
    ]);
    const message = dialog.message();
    await dialog.accept();
    return message;
  }

  async addNodeNoDialog(value) {
    // Fill input and click, but expect no dialog (use short timeout).
    await this.nodeInput.fill(value);
    // Click and wait briefly for potential dialogs; if a dialog appears it's an error for this helper.
    let dialogAppeared = false;
    const onDialog = async (dialog) => {
      dialogAppeared = true;
      await dialog.dismiss().catch(() => {});
    };
    this.page.once('dialog', onDialog);
    await this.addButton.click();
    // Give a small grace period for a dialog to appear if any (should not).
    await this.page.waitForTimeout(200);
    // remove listener just in case
    this.page.removeListener('dialog', onDialog);
    return dialogAppeared;
  }

  async deleteNodeExpectDialog() {
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.deleteButton.click(),
    ]);
    const message = dialog.message();
    await dialog.accept();
    return message;
  }

  async viewListAndGetOutput() {
    await Promise.all([this.viewButton.click()]);
    return await this.listOutput.innerText();
  }

  async traverseListAndGetOutput(steps) {
    if (typeof steps === 'number') {
      await this.traverseCount.fill(String(steps));
    } else {
      await this.traverseCount.fill(steps || '');
    }
    await Promise.all([this.traverseButton.click()]);
    return await this.listOutput.innerText();
  }
}

test.describe('Circular Linked List Demonstration - FSM and DOM tests', () => {
  // Collect console errors and page errors for assertions
  test.beforeEach(async ({ page }) => {
    // Intentionally capture console error messages and page errors for later assertions.
    page.context()._collectedConsoleErrors = [];
    page.context()._collectedPageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        page.context()._collectedConsoleErrors.push({
          text: msg.text(),
          location: msg.location(),
        });
      }
    });

    page.on('pageerror', (err) => {
      page.context()._collectedPageErrors.push(err);
    });

    // Navigate to the application URL
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // If any console errors or page errors were collected, fail the test with details.
    const consoleErrors = page.context()._collectedConsoleErrors || [];
    const pageErrors = page.context()._collectedPageErrors || [];

    // Provide informative failure messages if any runtime errors occurred.
    if (consoleErrors.length > 0 || pageErrors.length > 0) {
      // Format messages for debugging
      const messages = [];
      if (consoleErrors.length > 0) {
        messages.push('Console errors:\n' + consoleErrors.map((e) => `- ${e.text}`).join('\n'));
      }
      if (pageErrors.length > 0) {
        messages.push('Page errors:\n' + pageErrors.map((e) => `- ${e.stack || e.message || String(e)}`).join('\n'));
      }
      // Use expect.fail to surface the errors clearly.
      expect.fail(messages.join('\n\n'));
    }
  });

  test('S0 Idle: Page renders initial UI and FSM entry actions presence is checked', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) initial render.
    const app = new CircularListPage(page);

    // Verify main heading exists and matches FSM evidence.
    await expect(app.heading).toBeVisible();
    const headingText = await app.getHeadingText();
    expect(headingText.trim()).toBe('Circular Linked List Demonstration');

    // Verify controls exist: input(s) and buttons present.
    await expect(app.nodeInput).toBeVisible();
    await expect(app.traverseCount).toBeVisible();
    await expect(app.addButton).toBeVisible();
    await expect(app.deleteButton).toBeVisible();
    await expect(app.viewButton).toBeVisible();
    await expect(app.traverseButton).toBeVisible();

    // The FSM mentions an entry action renderPage() for S0_Idle.
    // The implementation does not define renderPage; assert it is not present (so the app did not throw due to calling an absent function).
    // We check window.renderPage is undefined rather than invoking it.
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(hasRenderPage).toBe(false);

    // Initially listOutput should be empty.
    await expect(app.listOutput).toBeVisible();
    const initialOutput = await app.listOutput.innerText();
    expect(initialOutput.trim()).toBe('');

    // No runtime console/page errors should have occurred during initial load (asserted in afterEach).
  });

  test.describe('Transitions and Events', () => {
    test('AddNode (S0 -> S1): Adding a node shows alert and clears input; ViewList shows the node', async ({ page }) => {
      // This test validates the AddNode event and the Node Added state (S1_NodeAdded).
      const app = new CircularListPage(page);

      // Add a node with value 'A' and expect an alert with exact text.
      const alertMessage = await app.addNodeExpectDialog('A');
      expect(alertMessage).toBe('Node added: A');

      // After accepting the alert the input should be cleared.
      expect(await app.nodeInput.inputValue()).toBe('');

      // Viewing the list should show the newly added node.
      const listText = await app.viewListAndGetOutput();
      // viewList prepends "List: " to the viewList() output; for a single node 'A' we expect "List: A"
      expect(listText).toBe('List: A');
    });

    test('AddNode with empty input does nothing (no alert)', async ({ page }) => {
      // Edge case: clicking Add Node with empty input should not produce an alert.
      const app = new CircularListPage(page);

      // Ensure input is empty
      await app.nodeInput.fill('');
      // Use helper which expects no dialog and returns boolean if a dialog appeared
      const dialogAppeared = await app.addNodeNoDialog('');
      expect(dialogAppeared).toBe(false);

      // listOutput should remain empty
      const output = await app.listOutput.innerText();
      expect(output.trim()).toBe('');
    });

    test('DeleteNode (S0 -> S2): Deleting on empty list still triggers alert per implementation', async ({ page }) => {
      // The implementation always shows "Node deleted." even when the list is empty.
      const app = new CircularListPage(page);

      // From a fresh page (no nodes), clicking delete should still show the deletion alert.
      const alertMessage = await app.deleteNodeExpectDialog();
      expect(alertMessage).toBe('Node deleted.');

      // After deletion on an empty list, viewList should indicate the list is empty.
      const listAfterDelete = await app.viewListAndGetOutput();
      expect(listAfterDelete).toBe('List: List is empty');
    });

    test('DeleteNode removes head node and updates list accordingly', async ({ page }) => {
      // This test adds two nodes, deletes one, and asserts the resulting list content.
      const app = new CircularListPage(page);

      // Add 'X' then 'Y'
      let msg = await app.addNodeExpectDialog('X');
      expect(msg).toBe('Node added: X');
      msg = await app.addNodeExpectDialog('Y');
      expect(msg).toBe('Node added: Y');

      // At this point viewList should show "List: X -> Y"
      let listText = await app.viewListAndGetOutput();
      expect(listText).toBe('List: X -> Y');

      // Delete the head node. Implementation removes head and alerts.
      const delMsg = await app.deleteNodeExpectDialog();
      expect(delMsg).toBe('Node deleted.');

      // Now viewList should show only the remaining node 'Y' (since the deletion of head from two nodes leaves a single node).
      listText = await app.viewListAndGetOutput();
      expect(listText).toBe('List: Y');
    });

    test('ViewList (S0 -> S3): Viewing empty and populated lists updates #listOutput text', async ({ page }) => {
      // Validate S3_ListViewed behavior for empty and non-empty lists.
      const app = new CircularListPage(page);

      // For empty list
      let output = await app.viewListAndGetOutput();
      expect(output).toBe('List: List is empty');

      // Add some nodes and validate view again
      let msg = await app.addNodeExpectDialog('Node1');
      expect(msg).toBe('Node added: Node1');
      msg = await app.addNodeExpectDialog('Node2');
      expect(msg).toBe('Node added: Node2');

      output = await app.viewListAndGetOutput();
      expect(output).toBe('List: Node1 -> Node2');
    });

    test('TraverseList (S0 -> S4): Traversing the circular list produces repeated sequence as expected', async ({ page }) => {
      // Validate S4_ListTraversed - traversal output should repeat in circular fashion.
      const app = new CircularListPage(page);

      // Add nodes 1,2,3
      expect(await app.addNodeExpectDialog('1')).toBe('Node added: 1');
      expect(await app.addNodeExpectDialog('2')).toBe('Node added: 2');
      expect(await app.addNodeExpectDialog('3')).toBe('Node added: 3');

      // Traverse 5 steps: expected sequence "1 2 3 1 2"
      const traversed = await app.traverseListAndGetOutput(5);
      expect(traversed).toBe('Traversed: 1 2 3 1 2');

      // Traverse 0 steps (empty or omitted), per implementation parseInt -> 0 -> traverse returns "", so "Traversed: "
      const traversedZero = await app.traverseListAndGetOutput(0);
      expect(traversedZero).toBe('Traversed: ');
    });
  });

  test.describe('FSM entry/exit action verification and error observation', () => {
    test('Verify FSM-mentioned functions not implemented do not throw on page and capture any runtime errors', async ({ page }) => {
      // The FSM mentions an entry action renderPage(). The implementation does not define it.
      // Verify that renderPage is not present as a global function and no runtime errors have occurred.
      const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
      expect(hasRenderPage).toBe(false);

      // Also assert that calling a non-existent function would be a ReferenceError if invoked, but we must not invoke it.
      // Instead, ensure no page errors were recorded during load/interactions (this is checked in afterEach).
      // This test exists to explicitly document expectation around missing FSM entry actions.
      const app = new CircularListPage(page);
      await expect(app.heading).toBeVisible();
    });
  });
});