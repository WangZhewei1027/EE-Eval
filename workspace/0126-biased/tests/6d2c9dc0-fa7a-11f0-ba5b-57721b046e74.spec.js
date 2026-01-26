import { test, expect } from '@playwright/test';

// Test file for application: 6d2c9dc0-fa7a-11f0-ba5b-57721b046e74
// URL: http://127.0.0.1:5500/workspace/0126-biased/html/6d2c9dc0-fa7a-11f0-ba5b-57721b046e74.html
// This test suite validates the FSM interactions for the Interactive Stack Visualization.
// It does NOT modify the application code and observes console/page errors (asserts none occurred).

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2c9dc0-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object Model for the Stack application
class StackPage {
  constructor(page) {
    this.page = page;
    this.pushInput = page.locator('#pushValue');
    this.pushButton = page.locator('button', { hasText: 'Push' });
    this.popButton = page.locator('button', { hasText: 'Pop' });
    this.peekButton = page.locator('button', { hasText: 'Peek' });
    this.clearButton = page.locator('button', { hasText: 'Clear Stack' });
    this.maxSizeInput = page.locator('#maxSize');
    this.updateMaxButton = page.locator('button', { hasText: 'Update' });
    this.autoResizeCheckbox = page.locator('#autoResize');
    this.generateRandomButton = page.locator('button', { hasText: 'Generate Random Stack' });
    this.randomCountInput = page.locator('#randomCount');
    this.speedInput = page.locator('#speed');
    this.checkEmptyButton = page.locator('button', { hasText: 'Is Empty?' });
    this.checkFullButton = page.locator('button', { hasText: 'Is Full?' });
    this.getSizeButton = page.locator('button', { hasText: 'Get Size' });
    this.searchButton = page.locator('button', { hasText: 'Search Value' });
    this.searchInput = page.locator('#searchValue');
    this.undoButton = page.locator('button', { hasText: 'Undo Last Operation' });
    this.replayButton = page.locator('button', { hasText: 'Replay All Operations' });
    this.stackContainer = page.locator('#stackVisualization');
    this.status = page.locator('#statusMessage');
    this.historyList = page.locator('#historyList');
    this.stackItems = () => page.locator('.stack-item');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Basic operations
  async push(value) {
    await this.pushInput.fill(value);
    await this.pushButton.click();
  }

  async pushEmpty() {
    await this.pushInput.fill('');
    await this.pushButton.click();
  }

  async pop() {
    await this.popButton.click();
  }

  async peek() {
    await this.peekButton.click();
  }

  async clear() {
    await this.clearButton.click();
  }

  async updateMaxSize(newSize, { acceptDialog = true } = {}) {
    await this.maxSizeInput.fill(String(newSize));
    // If confirm dialog may appear, caller should set up dialog handler.
    await this.updateMaxButton.click();
  }

  async generateRandom(count) {
    await this.randomCountInput.fill(String(count));
    await this.generateRandomButton.click();
  }

  async setAutoResize(enabled) {
    const checked = await this.autoResizeCheckbox.isChecked();
    if (checked !== enabled) {
      await this.autoResizeCheckbox.click();
    }
  }

  async checkEmpty() {
    await this.checkEmptyButton.click();
  }

  async checkFull() {
    await this.checkFullButton.click();
  }

  async getSize() {
    await this.getSizeButton.click();
  }

  async search(value) {
    await this.searchInput.fill(value);
    await this.searchButton.click();
  }

  async undo() {
    await this.undoButton.click();
  }

  async replay() {
    await this.replayButton.click();
  }

  async setSpeed(ms) {
    await this.speedInput.fill(String(ms));
    // Some browsers map range input differently; also use evaluate to set value reliably
    await this.page.evaluate((v) => {
      const el = document.getElementById('speed');
      if (el) el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(ms));
  }

  // Helpers to inspect UI state
  async getStatusText() {
    return (await this.status.textContent())?.trim();
  }

  async getStackMessages() {
    // Return array of visible stack item texts or the stack-message if empty
    const items = await this.stackContainer.locator('.stack-item').allTextContents();
    if (items.length === 0) {
      const msg = await this.stackContainer.locator('.stack-message').allTextContents();
      return msg;
    }
    return items;
  }

  async getStackItemClass(index = 0) {
    // index corresponds to displayed order (top is index 0)
    return this.stackContainer.locator('.stack-item').nth(index).getAttribute('class');
  }

  async getHistoryOptions() {
    return this.historyList.locator('option').allTextContents();
  }

  async getHistoryCount() {
    return this.historyList.locator('option').count();
  }

  async getMaxSizeInputValue() {
    return (await this.maxSizeInput.inputValue()).toString();
  }
}

// Capture console errors and page errors and assert none occurred in afterEach
test.describe('Interactive Stack Visualization - FSM tests', () => {
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      pageErrors.push(String(error));
    });
  });

  test.afterEach(async () => {
    // Assert no console errors or uncaught page errors occurred during each test
    expect(consoleErrors, `Console errors were logged: ${consoleErrors.join(' | ')}`).toHaveLength(0);
    expect(pageErrors, `Page errors occurred: ${pageErrors.join(' | ')}`).toHaveLength(0);
  });

  test('Initial Ready state shows empty stack and ready status', async ({ page }) => {
    // Validate initial UI state per S0_Ready entry actions and evidence
    const stackPage = new StackPage(page);
    await stackPage.goto();

    // The stack container should display the "Stack is empty" message
    const stackText = await stackPage.stackContainer.textContent();
    expect(stackText).toContain('Stack is empty');

    // Status box should show initial ready message
    const status = await stackPage.getStatusText();
    expect(status).toBe('Ready. Stack operations will be shown here.');

    // History list should be initially empty
    const historyCount = await stackPage.getHistoryCount();
    expect(historyCount).toBe(0);
  });

  test.describe('Push/Pop/Peek/Clear operations and their edge cases', () => {
    test('Push valid value updates stack, status, history and clears input', async ({ page }) => {
      const stackPage = new StackPage(page);
      await stackPage.goto();

      // Push a value and verify stack update
      await stackPage.push('A');
      await expect(stackPage.stackContainer.locator('.stack-item').first()).toHaveText('A');

      // Status should reflect pushed value
      const status = await stackPage.getStatusText();
      expect(status).toContain('Pushed "A" to stack.');

      // History should have at least one entry containing 'Pushed'
      const history = await stackPage.getHistoryOptions();
      expect(history.length).toBeGreaterThan(0);
      expect(history[history.length - 1]).toContain('Pushed "A"');

      // Input should be cleared after push
      const inputVal = await stackPage.pushInput.inputValue();
      expect(inputVal).toBe('');
    });

    test('Push empty value yields error and does not change stack', async ({ page }) => {
      const stackPage = new StackPage(page);
      await stackPage.goto();

      // Try to push empty value
      await stackPage.pushEmpty();
      const status = await stackPage.getStatusText();
      expect(status).toBe('Error: Please enter a value to push');

      // Stack should remain empty
      const stackItems = await stackPage.getStackMessages();
      expect(stackItems.join(' ')).toContain('Stack is empty');
    });

    test('Pop operation removes top item and reports underflow on empty', async ({ page }) => {
      const stackPage = new StackPage(page);
      await stackPage.goto();

      // Ensure popping empty stack reports underflow
      await stackPage.pop();
      let status = await stackPage.getStatusText();
      expect(status).toBe('Error: Stack underflow (stack is empty)');

      // Push two items then pop once
      await stackPage.push('one');
      await stackPage.push('two');
      await expect(stackPage.stackContainer.locator('.stack-item').first()).toHaveText('two');

      await stackPage.pop();
      status = await stackPage.getStatusText();
      expect(status).toContain('Popped "two" from stack.');

      // Top should now be 'one'
      await expect(stackPage.stackContainer.locator('.stack-item').first()).toHaveText('one');
    });

    test('Peek highlights top item briefly and reports top value', async ({ page }) => {
      const stackPage = new StackPage(page);
      await stackPage.goto();

      // Push two values
      await stackPage.push('B');
      await stackPage.push('C');

      // Peek should report the top value
      await stackPage.peek();
      let status = await stackPage.getStatusText();
      expect(status).toBe('Top of stack: "C"');

      // The top item should briefly have highlight class 'stack-top-highlight'
      const topClass = await stackPage.getStackItemClass(0);
      expect(topClass).toContain('stack-top-highlight');

      // Wait up to 1500ms for the highlight to be removed (script sets 1000ms)
      await page.waitForTimeout(1200);
      const topClassAfter = await stackPage.getStackItemClass(0);
      expect(topClassAfter).not.toContain('stack-top-highlight');
    });

    test('Clear stack empties visualization and updates status/history', async ({ page }) => {
      const stackPage = new StackPage(page);
      await stackPage.goto();

      // Create items then clear
      await stackPage.push('X1');
      await stackPage.push('X2');
      await expect(stackPage.stackContainer.locator('.stack-item').first()).toHaveText('X2');

      await stackPage.clear();
      const status = await stackPage.getStatusText();
      expect(status).toBe('Stack cleared');

      // Visualization should show empty message
      const stackMsg = await stackPage.stackContainer.textContent();
      expect(stackMsg).toContain('Stack is empty');

      // History should contain 'Stack cleared' as last entry
      const history = await stackPage.getHistoryOptions();
      expect(history[history.length - 1]).toContain('Stack cleared');
    });
  });

  test.describe('Max size configuration and generate random stack', () => {
    test('Update max size to a valid number updates status and input value', async ({ page }) => {
      const stackPage = new StackPage(page);
      await stackPage.goto();

      // Update max size to 5
      await stackPage.updateMaxSize(5);
      const status = await stackPage.getStatusText();
      expect(status).toBe('Stack max size updated to 5');

      const maxVal = await stackPage.getMaxSizeInputValue();
      expect(Number(maxVal)).toBe(5);
    });

    test('Reducing max size below current stack length triggers confirm - accept trims stack', async ({ page }) => {
      const stackPage = new StackPage(page);
      await stackPage.goto();

      // Push 3 items
      await stackPage.push('a1');
      await stackPage.push('a2');
      await stackPage.push('a3');

      // Now set max size to 1; a confirm will appear. Accept the dialog to trim stack.
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('confirm');
        await dialog.accept();
      });

      await stackPage.updateMaxSize(1);
      // After acceptance, stack should be trimmed to 1 item and status updated
      const status = await stackPage.getStatusText();
      expect(status).toBe('Stack max size updated to 1');

      const items = await stackPage.stackContainer.locator('.stack-item').count();
      expect(items).toBe(1);
    });

    test('Reducing max size below current stack length triggers confirm - dismiss leaves stack unchanged', async ({ page }) => {
      const stackPage = new StackPage(page);
      await stackPage.goto();

      // Push 2 items
      await stackPage.push('b1');
      await stackPage.push('b2');

      // Store current max size
      const prevMax = await stackPage.getMaxSizeInputValue();

      // Now set max size lower and dismiss the confirm
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('confirm');
        await dialog.dismiss();
      });

      await stackPage.updateMaxSize(1);

      // Since dismissed, the input value should revert to previous max
      const maxVal = await stackPage.getMaxSizeInputValue();
      expect(maxVal).toBe(prevMax);

      // And stack should remain unchanged (still has two items)
      const items = await stackPage.stackContainer.locator('.stack-item').count();
      expect(items).toBeGreaterThanOrEqual(2);
    });

    test('Generate random stack populates items and updates status, respects max size without auto-resize', async ({ page }) => {
      const stackPage = new StackPage(page);
      await stackPage.goto();

      // Ensure autoResize disabled
      await stackPage.setAutoResize(false);

      // Set max size to 4 and generate 4 items
      await stackPage.updateMaxSize(4);
      await stackPage.generateRandom(4);

      const status = await stackPage.getStatusText();
      expect(status).toBe('Generated random stack with 4 items');

      const itemsCount = await stackPage.stackContainer.locator('.stack-item').count();
      expect(itemsCount).toBe(4);
    });

    test('Generate random stack exceeding max size without auto-resize yields error', async ({ page }) => {
      const stackPage = new StackPage(page);
      await stackPage.goto();

      // Set max size small and ensure autoResize is off
      await stackPage.updateMaxSize(1);
      await stackPage.setAutoResize(false);

      // Try to generate 3 items when max is 1
      await stackPage.generateRandom(3);
      const status = await stackPage.getStatusText();
      expect(status).toBe('Error: Requested 3 items exceeds max size of 1');
    });
  });

  test.describe('Analysis utilities: empty/full/size/search', () => {
    test('Check empty, check full, and get size report correct statuses', async ({ page }) => {
      const stackPage = new StackPage(page);
      await stackPage.goto();

      // Ensure stack is clear
      await stackPage.clear();
      await stackPage.checkEmpty();
      let status = await stackPage.getStatusText();
      expect(status).toBe('Stack is empty');

      // Push one item and set max size to 1 to make it full
      await stackPage.push('only');
      await stackPage.updateMaxSize(1);
      await stackPage.checkFull();
      status = await stackPage.getStatusText();
      expect(status).toContain('Stack is full');

      // Get size should report 1 item (max: 1)
      await stackPage.getSize();
      status = await stackPage.getStatusText();
      expect(status).toContain('Stack size: 1 items (max: 1)');
    });

    test('Search value returns correct positions and handles missing input', async ({ page }) => {
      const stackPage = new StackPage(page);
      await stackPage.goto();

      // Clear then push two values: bottom 'S1', top 'S2'
      await stackPage.clear();
      await stackPage.push('S1');
      await stackPage.push('S2');

      // Search without input should error
      await stackPage.search('');
      let status = await stackPage.getStatusText();
      expect(status).toBe('Error: Please enter a value to search');

      // Search for S1 (position from top should be 2)
      await stackPage.search('S1');
      status = await stackPage.getStatusText();
      expect(status).toContain('"S1" found at position(s) from top: 2');

      // Search for absent value
      await stackPage.search('NOT_FOUND');
      status = await stackPage.getStatusText();
      expect(status).toBe('"NOT_FOUND" not found in stack');
    });
  });

  test.describe('Undo and Replay history behaviors', () => {
    test('Undo with no history reports no operations to undo; undo with stack removes top', async ({ page }) => {
      const stackPage = new StackPage(page);
      await stackPage.goto();

      // On fresh load, undo should say there's no operations to undo
      await stackPage.undo();
      let status = await stackPage.getStatusText();
      expect(status).toBe('No operations to undo');

      // Now push an item and undo should remove it
      await stackPage.push('U1');
      await expect(stackPage.stackContainer.locator('.stack-item').first()).toHaveText('U1');

      await stackPage.undo();
      status = await stackPage.getStatusText();
      // When stack had an item, undoOperation pops it and reports undid last operation
      expect(status).toBe('Undid last operation (removed top item)');

      // Stack should be empty after undo
      const containerText = await stackPage.stackContainer.textContent();
      expect(containerText).toContain('Stack is empty');
    });

    test('Replay history replays operations and ends with "Replay complete"', async ({ page }) => {
      const stackPage = new StackPage(page);
      await stackPage.goto();

      // Use small speed to speed up replay
      await stackPage.setSpeed(50);

      // Perform a sequence: push 1, push 2, pop
      await stackPage.push('1');
      await stackPage.push('2');
      await stackPage.pop(); // Should remove '2', leaving only '1' in stack

      // Capture last history count
      const beforeHistory = await stackPage.getHistoryCount();
      expect(beforeHistory).toBeGreaterThanOrEqual(3);

      // Call replay - it will clear operationHistory and setTimeout to replay
      await stackPage.replay();

      // Wait until status message updates to 'Replay complete' (replayHistory sets it at end)
      await page.waitForFunction(() => {
        const el = document.getElementById('statusMessage');
        return el && el.textContent && el.textContent.includes('Replay complete');
      }, {}, { timeout: 5000 });

      // After replay completes, status should be 'Replay complete'
      const status = await stackPage.getStatusText();
      expect(status).toBe('Replay complete');

      // After replay the operationHistory is rebuilt and historyList repopulated; ensure at least as many options as before
      const afterHistoryOptions = await stackPage.getHistoryOptions();
      expect(afterHistoryOptions.length).toBeGreaterThanOrEqual(beforeHistory);

      // The stack should reflect the net effect of the original operations: only "1" remains
      const topText = await stackPage.stackContainer.locator('.stack-item').first().textContent();
      // topText may include whitespace; trim and assert contains '1'
      expect(topText?.trim()).toBe('1');
    });
  });
});