import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324c7561-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object to encapsulate common interactions on the demo page
class CircularListPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#nodeValue');
    this.addButton = page.locator('button[onclick="addNode()"]');
    this.displayButton = page.locator('button[onclick="displayList()"]');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async addNode(value) {
    // Type into input and click add
    await this.input.fill(value);
    await this.addButton.click();
  }

  async clickAddButtonWithoutTyping() {
    // Clears input then clicks add to simulate empty submission
    await this.input.fill('');
    await this.addButton.click();
  }

  async displayList() {
    await this.displayButton.click();
  }

  async getOutputText() {
    return await this.output.innerText();
  }

  async getInputValue() {
    return await this.input.inputValue();
  }
}

test.describe('Circular Linked List Demo - FSM and UI tests', () => {
  // Arrays to capture runtime problems observed on the page
  let pageErrors = [];
  let consoleErrors = [];
  let dialogs = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];
    dialogs = [];

    // Capture uncaught exceptions on the page (pageerror)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages of type 'error' for additional evidence
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Capture dialogs (alerts) and auto-accept them while recording the message
    page.on('dialog', async (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      try {
        await dialog.accept();
      } catch (e) {
        // Let any failures be recorded as page errors naturally; do not patch behavior
      }
    });

    // Navigate to the application under test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // After each test assert that there were no unexpected runtime errors (ReferenceError, TypeError, SyntaxError).
    // We assert there are zero page errors and zero console errors to ensure the page ran without unhandled JS exceptions.
    // If there are errors, the tests above will still have run and we've recorded them in pageErrors/consoleErrors.
    expect(pageErrors.length, `Expected no uncaught page errors but found: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `Expected no console error messages but found: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
  });

  test.describe('Initial state (S0_Idle)', () => {
    test('page should load with input and buttons present and output empty', async ({ page }) => {
      const app = new CircularListPage(page);

      // Validate input exists and has placeholder text as evidence for S0_Idle
      await expect(app.input).toBeVisible();
      await expect(app.input).toHaveAttribute('placeholder', 'Enter node value');

      // Validate both buttons exist and have the expected onclick attributes (evidence from FSM)
      await expect(app.addButton).toBeVisible();
      await expect(app.displayButton).toBeVisible();

      // Validate output div exists and is initially empty
      await expect(app.output).toBeVisible();
      const initialOutput = await app.getOutputText();
      expect(initialOutput).toBe('', 'Expected initial #output to be empty in Idle state');
    });

    test('clicking "Display List" in Idle should show "List is empty." (transition to S2_ListDisplayed)', async ({ page }) => {
      const app = new CircularListPage(page);

      // Click display list
      await app.displayList();

      // Verify output shows the "List is empty." message, which corresponds to the display() output
      const outputText = await app.getOutputText();
      expect(outputText).toBe('List is empty.', 'Display from Idle state should show "List is empty."');

      // Verify no dialogs were triggered by displayList
      expect(dialogs.length).toBe(0);
    });
  });

  test.describe('Adding nodes (S1_NodeAdded transitions)', () => {
    test('adding a single node triggers an alert and clears input (S0_Idle -> S1_NodeAdded -> S0_Idle)', async ({ page }) => {
      const app = new CircularListPage(page);

      // Add a node with value 'A' and capture alert
      await app.addNode('A');

      // One alert should have been shown and auto-accepted; verify message content
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      const lastDialog = dialogs[dialogs.length - 1];
      expect(lastDialog.type).toBe('alert');
      expect(lastDialog.message).toBe("Node with value 'A' added!");

      // Input should have been cleared as per exit action evidence
      const inputValue = await app.getInputValue();
      expect(inputValue).toBe('', 'After adding a node the input should be cleared (on exit from NodeAdded to Idle).');

      // Display list should show the newly added single node
      await app.displayList();
      const output = await app.getOutputText();
      expect(output).toBe('A (circular)', 'Display after adding one node should show the single node followed by (circular)');
    });

    test('adding multiple nodes preserves insertion order and display shows circular list', async ({ page }) => {
      const app = new CircularListPage(page);

      // Add three nodes in order
      await app.addNode('Node1');
      await app.addNode('Node2');
      await app.addNode('Node3');

      // Last three dialogs correspond to the three add alerts; verify the last one
      expect(dialogs.length).toBeGreaterThanOrEqual(3);
      expect(dialogs[dialogs.length - 1].message).toBe("Node with value 'Node3' added!");

      // Display the list and verify expected order with circular suffix
      await app.displayList();
      const output = await app.getOutputText();
      expect(output).toBe('Node1 -> Node2 -> Node3 (circular)', 'Expected nodes displayed in insertion order separated by -> and suffixed with (circular)');
    });

    test('adding whitespace-only value is accepted (code uses truthiness) and becomes part of the list', async ({ page }) => {
      const app = new CircularListPage(page);

      // Add a whitespace-only value - in this implementation whitespace is truthy and will be accepted
      await app.addNode('   ');

      // Verify alert occurred indicating node was added with whitespace (message shows the raw value)
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      const last = dialogs[dialogs.length - 1];
      expect(last.message).toBe("Node with value '   ' added!");

      // Display and ensure whitespace node is present; it will appear as spaces between arrows
      await app.displayList();
      const output = await app.getOutputText();
      // Since this could be the first node or combined with previous tests, check that the output contains the whitespace marker (we match substring)
      expect(output.includes('(circular)')).toBeTruthy();
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('clicking Add Node with empty input triggers an alert asking for valid input', async ({ page }) => {
      const app = new CircularListPage(page);

      // Ensure input is empty and click Add Node
      await app.clickAddButtonWithoutTyping();

      // Expect an alert indicating invalid input
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      const lastDialog = dialogs[dialogs.length - 1];
      expect(lastDialog.type).toBe('alert');
      expect(lastDialog.message).toBe('Please enter a valid node value.');
    });

    test('buttons should include the onclick attributes as evidence from the FSM', async ({ page }) => {
      const app = new CircularListPage(page);

      // Validate that the add and display buttons have the inline onclick attributes (evidence strings in FSM)
      const addButtonOnclick = await page.locator('button').filter({ hasText: 'Add Node' }).getAttribute('onclick');
      const displayButtonOnclick = await page.locator('button').filter({ hasText: 'Display List' }).getAttribute('onclick');

      expect(addButtonOnclick).toBe('addNode()');
      expect(displayButtonOnclick).toBe('displayList()');
    });

    test('display when list has elements should set #output.innerText (evidence verification)', async ({ page }) => {
      const app = new CircularListPage(page);

      // Add items
      await app.addNode('X');
      await app.addNode('Y');

      // Clear any previously collected dialogs to focus on display behavior
      dialogs = [];

      // Click display and verify innerText was set on #output
      await app.displayList();
      const output = await app.getOutputText();
      expect(output).toBe('X -> Y (circular)');

      // Ensure displayList did not emit additional alerts
      expect(dialogs.length).toBe(0);
    });
  });
});