import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79b4110-d361-11f0-8438-11a56595a476.html';

// Page object encapsulating common interactions and queries
class LinkedListPage {
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputValue');
    this.indexInput = page.locator('#indexInput');
    this.listDisplay = page.locator('#listDisplay');
    this.visualNodes = page.locator('#visualList .node');
    this.log = page.locator('#log');

    this.pushBtn = page.locator('#pushBtn');
    this.popBtn = page.locator('#popBtn');
    this.shiftBtn = page.locator('#shiftBtn');
    this.unshiftBtn = page.locator('#unshiftBtn');
    this.getBtn = page.locator('#getBtn');
    this.setBtn = page.locator('#setBtn');
    this.insertBtn = page.locator('#insertBtn');
    this.removeBtn = page.locator('#removeBtn');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setValue(val) {
    await this.input.fill(String(val));
  }

  async setIndex(idx) {
    // Use fill to ensure numeric input is set as text; component converts to Number
    await this.indexInput.fill(String(idx));
  }

  async clickPush() {
    await this.pushBtn.click();
  }

  async clickPop() {
    await this.popBtn.click();
  }

  async clickShift() {
    await this.shiftBtn.click();
  }

  async clickUnshift() {
    await this.unshiftBtn.click();
  }

  async clickGet() {
    await this.getBtn.click();
  }

  async clickSet() {
    await this.setBtn.click();
  }

  async clickInsert() {
    await this.insertBtn.click();
  }

  async clickRemove() {
    await this.removeBtn.click();
  }

  async getListText() {
    return (await this.listDisplay.textContent()) || '';
  }

  async getNodeTexts() {
    const count = await this.visualNodes.count();
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push(await this.visualNodes.nth(i).textContent());
    }
    return arr;
  }

  async getLogContent() {
    return (await this.log.textContent()) || '';
  }

  // Helper to wait until the visible listDisplay contains expected substring
  async waitForListContains(substr, timeout = 2000) {
    await this.page.waitForFunction(
      (sel, s) => document.querySelector(sel) && document.querySelector(sel).textContent.includes(s),
      '#listDisplay',
      substr,
      { timeout }
    );
  }
}

test.describe('Linked List Demo - FSM behaviors and UI interactions', () => {
  // Arrays to collect diagnostics
  let consoleMessages;
  let pageErrors;
  let dialogs;
  let llPage;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    // Collect console messages for inspection
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught errors from page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Auto-accept or dismiss dialogs but record message for assertions
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      try {
        // Accept all alerts so execution continues
        await dialog.accept();
      } catch (e) {
        // If accept fails, attempt dismiss; keep test flow
        try { await dialog.dismiss(); } catch (_) {}
      }
    });

    llPage = new LinkedListPage(page);
    await llPage.goto();
  });

  test.afterEach(async () => {
    // Ensure no unexpected runtime page errors (ReferenceError, SyntaxError, TypeError, etc.)
    // If there are page errors, include them in assertion failure message for debugging.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => String(e)).join('\n')}`).toBe(0);
  });

  test('Initial state: application initialized and shows empty list', async () => {
    // This test validates entry actions for S0_Initialized and S1_List_Empty:
    // - updateDisplay has run and listDisplay shows "List is empty."
    // - initial log message exists mentioning initialization
    const listText = await llPage.getListText();
    expect(listText).toContain('List is empty.');

    const logText = await llPage.getLogContent();
    expect(logText).toContain('Singly Linked List initialized. Use controls above to manipulate it.');

    const nodeCount = await llPage.visualNodes.count();
    expect(nodeCount).toBe(0);
  });

  test('Push: adding nodes to end updates display, visual nodes and log', async () => {
    // Validate pushing two items transitions list from empty to non-empty and maintains order
    await llPage.setValue('A');
    await llPage.clickPush();

    // After push, input should be cleared
    expect(await llPage.input.inputValue()).toEqual('');

    await llPage.waitForListContains('A → null');
    let listText = await llPage.getListText();
    expect(listText).toContain('A → null');

    let nodes = await llPage.getNodeTexts();
    expect(nodes).toEqual(['A']);

    // Push another element
    await llPage.setValue('B');
    await llPage.clickPush();

    await llPage.waitForListContains('A → B → null');
    listText = await llPage.getListText();
    expect(listText).toContain('A → B → null');

    nodes = await llPage.getNodeTexts();
    expect(nodes).toEqual(['A', 'B']);

    const logText = await llPage.getLogContent();
    expect(logText).toMatch(/Pushed value "A" to the end\./);
    expect(logText).toMatch(/Pushed value "B" to the end\./);
  });

  test('Pop: removing from end updates display and logs; popping empty triggers alert', async () => {
    // Edge case: pop on empty should trigger an alert
    await llPage.clickPop();
    // We recorded dialogs globally; expect an alert message for empty pop
    expect(dialogs.some(d => d.includes('List is empty') && d.includes('Nothing to pop'))).toBeTruthy();

    dialogs = []; // clear for next part

    // Prepare list with two items and pop twice
    await llPage.setValue('A');
    await llPage.clickPush();
    await llPage.setValue('B');
    await llPage.clickPush();

    // Pop once: removes B
    await llPage.clickPop();
    await llPage.waitForListContains('A → null');
    let listText = await llPage.getListText();
    expect(listText).toContain('A → null');

    let logText = await llPage.getLogContent();
    expect(logText).toMatch(/Popped value "B" from the end\./);

    // Pop again: removes A and list becomes empty
    await llPage.clickPop();
    await llPage.waitForListContains('List is empty.');
    listText = await llPage.getListText();
    expect(listText).toContain('List is empty.');

    logText = await llPage.getLogContent();
    expect(logText).toMatch(/Popped value "A" from the end\./);
  });

  test('Unshift and Shift: add/remove from front function correctly', async () => {
    // Unshift on empty
    await llPage.setValue('X');
    await llPage.clickUnshift();

    await llPage.waitForListContains('X → null');
    let listText = await llPage.getListText();
    expect(listText).toContain('X → null');

    // Unshift another so order is Y -> X
    await llPage.setValue('Y');
    await llPage.clickUnshift();
    await llPage.waitForListContains('Y → X → null');
    let nodes = await llPage.getNodeTexts();
    expect(nodes).toEqual(['Y', 'X']);

    // Shift removes front (Y)
    await llPage.clickShift();
    await llPage.waitForListContains('X → null');
    listText = await llPage.getListText();
    expect(listText).toContain('X → null');

    const logText = await llPage.getLogContent();
    expect(logText).toMatch(/Unshifted value "X" to the front\./);
    expect(logText).toMatch(/Unshifted value "Y" to the front\./);
    expect(logText).toMatch(/Shifted value "Y" from the front\./);
  });

  test('Get: retrieving node value shows alert and logs message; invalid index alerts', async () => {
    // Prepare list [A, B]
    await llPage.setValue('A');
    await llPage.clickPush();
    await llPage.setValue('B');
    await llPage.clickPush();

    // Valid get at index 1 -> should produce alert with value B and log entry
    dialogs = [];
    await llPage.setIndex(1);
    await llPage.clickGet();

    // Wait briefly for dialog processing
    await llPage.page.waitForTimeout(50);

    expect(dialogs.some(d => d.includes('Value at index 1 is:') && d.includes('"B"'))).toBeTruthy();
    const logText = await llPage.getLogContent();
    expect(logText).toMatch(/Got value "B" at index 1\./);

    dialogs = [];

    // Invalid get: index out of bounds (e.g., 5)
    await llPage.setIndex(5);
    await llPage.clickGet();

    // Expect appropriate out-of-bounds alert message
    await llPage.page.waitForTimeout(50);
    expect(dialogs.some(d => d.includes('Index out of bounds'))).toBeTruthy();
  });

  test('Set: updating a value at index modifies display and logs; invalid index or empty value triggers alerts', async () => {
    // Prepare list [A, B]
    await llPage.setValue('A');
    await llPage.clickPush();
    await llPage.setValue('B');
    await llPage.clickPush();

    // Set index 1 to 'C'
    await llPage.setIndex(1);
    await llPage.setValue('C');
    await llPage.clickSet();

    await llPage.waitForListContains('A → C → null');
    let listText = await llPage.getListText();
    expect(listText).toContain('A → C → null');

    let logText = await llPage.getLogContent();
    expect(logText).toMatch(/Set index 1 value to "C"\./);

    // Set with empty value should trigger validation alert
    dialogs = [];
    await llPage.setIndex(0);
    await llPage.setValue('   '); // whitespace should be considered empty
    await llPage.clickSet();

    await llPage.page.waitForTimeout(50);
    expect(dialogs.some(d => d.includes('Please enter a non-empty value'))).toBeTruthy();

    dialogs = [];

    // Set with invalid index (e.g., 10) triggers out-of-bounds alert
    await llPage.setIndex(10);
    await llPage.setValue('Z');
    await llPage.clickSet();
    await llPage.page.waitForTimeout(50);
    expect(dialogs.some(d => d.includes('Index out of bounds'))).toBeTruthy();
  });

  test('Insert: insert at middle, at start, and at end; invalid index or empty value triggers alerts', async () => {
    // Start with [A, C]
    await llPage.setValue('A');
    await llPage.clickPush();
    await llPage.setValue('C');
    await llPage.clickPush();

    // Insert 'M' at index 1 -> [A, M, C]
    await llPage.setIndex(1);
    await llPage.setValue('M');
    await llPage.clickInsert();

    await llPage.waitForListContains('A → M → C → null');
    let nodes = await llPage.getNodeTexts();
    expect(nodes).toEqual(['A', 'M', 'C']);

    let logText = await llPage.getLogContent();
    expect(logText).toMatch(/Inserted value "M" at index 1\./);

    // Insert at index 0 should behave like unshift
    await llPage.setIndex(0);
    await llPage.setValue('S');
    await llPage.clickInsert();

    await llPage.waitForListContains('S → A → M → C → null');
    nodes = await llPage.getNodeTexts();
    expect(nodes).toEqual(['S', 'A', 'M', 'C']);

    // Insert at index equal to length (append to end)
    // Find current length by node count
    const length = await llPage.visualNodes.count();
    await llPage.setIndex(length);
    await llPage.setValue('E');
    await llPage.clickInsert();

    await llPage.waitForListContains('E → null'); // will contain end marker somewhere
    const finalNodes = await llPage.getNodeTexts();
    expect(finalNodes[finalNodes.length - 1]).toEqual('E');

    // Invalid insert: out-of-bounds ( > length ) should trigger alert
    dialogs = [];
    await llPage.setIndex(999);
    await llPage.setValue('Z');
    await llPage.clickInsert();
    await llPage.page.waitForTimeout(50);
    expect(dialogs.some(d => d.includes('Index out of bounds'))).toBeTruthy();

    // Invalid insert: empty value triggers alert
    dialogs = [];
    await llPage.setIndex(0);
    await llPage.setValue('   ');
    await llPage.clickInsert();
    await llPage.page.waitForTimeout(50);
    expect(dialogs.some(d => d.includes('Please enter a non-empty value'))).toBeTruthy();
  });

  test('Remove: remove at specific index updates display and logs; invalid index triggers alert', async () => {
    // Prepare list S, A, M, C, E from previous; create a clean list here
    await llPage.setValue('A');
    await llPage.clickPush();
    await llPage.setValue('B');
    await llPage.clickPush();
    await llPage.setValue('C');
    await llPage.clickPush(); // [A, B, C]

    // Remove index 1 -> removes 'B', resulting [A, C]
    await llPage.setIndex(1);
    await llPage.clickRemove();

    await llPage.waitForListContains('A → C → null');
    let nodes = await llPage.getNodeTexts();
    expect(nodes).toEqual(['A', 'C']);

    let logText = await llPage.getLogContent();
    expect(logText).toMatch(/Removed value "B" at index 1\./);

    // Remove at index 0 -> removes 'A'
    await llPage.setIndex(0);
    await llPage.clickRemove();
    await llPage.waitForListContains('C → null');
    nodes = await llPage.getNodeTexts();
    expect(nodes).toEqual(['C']);

    // Remove with invalid index triggers alert
    dialogs = [];
    await llPage.setIndex(42);
    await llPage.clickRemove();
    await llPage.page.waitForTimeout(50);
    expect(dialogs.some(d => d.includes('Index out of bounds'))).toBeTruthy();
  });

  test('Validation edge cases: push empty input and shift/pop on empty trigger alerts', async () => {
    // Push with empty value should alert
    await llPage.setValue('   '); // whitespace only
    await llPage.clickPush();

    await llPage.page.waitForTimeout(50);
    expect(dialogs.some(d => d.includes('Please enter a non-empty value'))).toBeTruthy();

    dialogs = [];

    // Shift on empty should alert
    await llPage.clickShift();
    await llPage.page.waitForTimeout(50);
    expect(dialogs.some(d => d.includes('List is empty') && d.includes('Nothing to shift'))).toBeTruthy();

    dialogs = [];

    // Pop on empty should alert
    await llPage.clickPop();
    await llPage.page.waitForTimeout(50);
    expect(dialogs.some(d => d.includes('List is empty') && d.includes('Nothing to pop'))).toBeTruthy();
  });

  test('Console diagnostics: ensure no severe console errors and capture informative logs', async () => {
    // This test validates that the application logs expected messages and that there are no console error messages.
    // Add an element to generate some logs
    await llPage.setValue('D');
    await llPage.clickPush();

    // Allow some time for console logs to be emitted and captured
    await llPage.page.waitForTimeout(100);

    // Inspect console messages: ensure there are no console messages of type 'error'
    const errorMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorMsgs.length).toBe(0);

    // Ensure that the initialization log (from entry action) and push log are present in the DOM log
    const logText = await llPage.getLogContent();
    expect(logText).toContain('Singly Linked List initialized. Use controls above to manipulate it.');
    expect(logText).toMatch(/Pushed value "D" to the end\./);
  });
});