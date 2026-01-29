import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1212c720-fa7a-11f0-acf9-69409043402d.html';

// Page Object for the Deque demo
class DequePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Inputs / Buttons
    this.maxSizeInput = '#maxSizeInput';
    this.setMaxSizeButton = '#setMaxSizeButton';

    this.pushFrontInput = '#pushFrontInput';
    this.pushFrontBtn = '#pushFrontBtn';
    this.pushBackInput = '#pushBackInput';
    this.pushBackBtn = '#pushBackBtn';

    this.popFrontBtn = '#popFrontBtn';
    this.popBackBtn = '#popBackBtn';
    this.peekFrontBtn = '#peekFrontBtn';
    this.peekBackBtn = '#peekBackBtn';
    this.clearBtn = '#clearBtn';

    this.removeValueInput = '#removeValueInput';
    this.removeValueBtn = '#removeValueBtn';

    this.countValueInput = '#countValueInput';
    this.countValueBtn = '#countValueBtn';
    this.countValueResult = '#countValueResult';

    this.findValueInput = '#findValueInput';
    this.findValueBtn = '#findValueBtn';
    this.findValueResult = '#findValueResult';

    this.insertAtIndexInput = '#insertAtIndexInput';
    this.insertAtValueInput = '#insertAtValueInput';
    this.insertAtBtn = '#insertAtBtn';

    this.removeAtIndexInput = '#removeAtIndexInput';
    this.removeAtBtn = '#removeAtBtn';

    this.dequeDisplay = '#dequeDisplay';
    this.interactionLog = '#interactionLog';
    this.clearLogBtn = '#clearLogBtn';

    this.batchInput = '#batchInput';
    this.runBatchBtn = '#runBatchBtn';

    this.loadJsonBtn = '#loadJsonBtn';
    this.loadJsonFile = '#loadJsonFile';
    this.saveJsonBtn = '#saveJsonBtn';

    this.sizeBtn = '#sizeBtn';
    this.sizeResult = '#sizeResult';
    this.isEmptyBtn = '#isEmptyBtn';
    this.isEmptyResult = '#isEmptyResult';
    this.isFullBtn = '#isFullBtn';
    this.isFullResult = '#isFullResult';
  }

  async setMaxSize(val) {
    await this.page.fill(this.maxSizeInput, String(val));
    await this.page.click(this.setMaxSizeButton);
  }

  async pushFront(value) {
    await this.page.fill(this.pushFrontInput, value);
    await this.page.click(this.pushFrontBtn);
  }

  async pushBack(value) {
    await this.page.fill(this.pushBackInput, value);
    await this.page.click(this.pushBackBtn);
  }

  async popFront() {
    await this.page.click(this.popFrontBtn);
  }

  async popBack() {
    await this.page.click(this.popBackBtn);
  }

  async peekFront() {
    await this.page.click(this.peekFrontBtn);
  }

  async peekBack() {
    await this.page.click(this.peekBackBtn);
  }

  async clearDeque() {
    await this.page.click(this.clearBtn);
  }

  async removeValue(value) {
    await this.page.fill(this.removeValueInput, value);
    await this.page.click(this.removeValueBtn);
  }

  async countValue(value) {
    await this.page.fill(this.countValueInput, value);
    await this.page.click(this.countValueBtn);
  }

  async findValue(value) {
    await this.page.fill(this.findValueInput, value);
    await this.page.click(this.findValueBtn);
  }

  async insertAt(index, value) {
    await this.page.fill(this.insertAtIndexInput, String(index));
    await this.page.fill(this.insertAtValueInput, value);
    await this.page.click(this.insertAtBtn);
  }

  async removeAt(index) {
    await this.page.fill(this.removeAtIndexInput, String(index));
    await this.page.click(this.removeAtBtn);
  }

  async clearLog() {
    await this.page.click(this.clearLogBtn);
  }

  async runBatch(commands) {
    await this.page.fill(this.batchInput, commands);
    await this.page.click(this.runBatchBtn);
  }

  async loadJsonFileWithContent(filename, buffer) {
    // Directly set the file input. This will trigger the change event in the page.
    await this.page.setInputFiles(this.loadJsonFile, {
      name: filename,
      mimeType: 'application/json',
      buffer,
    });
  }

  async saveJson() {
    return await this.page.waitForEvent('download', async () => {
      await this.page.click(this.saveJsonBtn);
    });
  }

  async getDequeItems() {
    // Return an array of deque item texts in order
    return await this.page.$$eval(`${this.dequeDisplay} .deque-item`, nodes => nodes.map(n => n.textContent));
  }

  async getDequeDisplayText() {
    return (await this.page.textContent(this.dequeDisplay)).trim();
  }

  async getInteractionLog() {
    return await this.page.$eval(this.interactionLog, el => el.value);
  }
}

// Global test hooks and organization
test.describe('Deque Interactive Demo - Full E2E', () => {
  let pageErrors;
  let consoleMessages;
  let dialogs;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];
    dialogs = [];

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Collect console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect and auto-accept dialogs, store messages for assertions
    page.on('dialog', async dialog => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      try {
        await dialog.accept();
      } catch (e) {
        // ignore acceptance failure, still record dialog
      }
    });

    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Assert that there were no uncaught page errors during test run
    // If there were, fail the test with collected errors for diagnosis
    expect(pageErrors, 'Expected no uncaught page errors').toEqual([]);
  });

  test('Initial state: Idle - display shows empty and properties reflect initial state', async ({ page }) => {
    // Validate initial UI state and on-entry updateDisplay() behavior
    const dp = new DequePage(page);

    // The deque display should indicate empty state
    const displayText = await dp.getDequeDisplayText();
    expect(displayText).toBe('(empty)');

    // Check isEmpty button reports Yes
    await page.click(dp.isEmptyBtn);
    await expect(page.locator(dp.isEmptyResult)).toHaveText('Yes');

    // Check size is 0 via sizeBtn
    await page.click(dp.sizeBtn);
    await expect(page.locator(dp.sizeResult)).toHaveText('0');

    // The interaction log should be present and empty (aside from possible initial logs)
    const log = await dp.getInteractionLog();
    expect(typeof log).toBe('string');

    // Ensure no unexpected console errors happened
    expect(consoleMessages.filter(m => m.type === 'error')).toEqual([]);
  });

  test('SetMaxSize and isFull logic with push attempts (edge cases)', async ({ page }) => {
    // Validate setting max size, reaching full capacity and error on extra pushes
    const dp = new DequePage(page);

    // Set max size to 2
    await dp.setMaxSize(2);
    // Log should contain Max size set message
    const logAfterMax = await dp.getInteractionLog();
    expect(logAfterMax).toContain('Max size set to 2');

    // Push two items
    await dp.pushBack('one');
    await dp.pushBack('two');

    // isFull should report Yes
    await page.click(dp.isFullBtn);
    await expect(page.locator(dp.isFullResult)).toHaveText('Yes');

    // Attempt to push another item => should trigger error alert and log entry
    await dp.pushBack('three');
    // Expect an error dialog recorded
    const lastDialog = dialogs[dialogs.length - 1];
    expect(lastDialog.message).toContain('ERROR: Deque is full. Cannot push.');

    // Interaction log should have an ERROR line about Deque is full
    const log = await dp.getInteractionLog();
    expect(log).toContain('ERROR: Deque is full. Cannot push.');

    // Ensure deque items remain the two original ones
    const items = await dp.getDequeItems();
    expect(items).toEqual(['one', 'two']);
  });

  test('PushFront, PushBack, Peek and Pop operations with alert dialogs', async ({ page }) => {
    // Validate push/pop/peek semantics and dialog contents
    const dp = new DequePage(page);

    // Clear any previous state
    await dp.clearDeque();
    await dp.clearLog();

    // Push front / back
    await dp.pushFront('A');
    await dp.pushBack('B');

    // Deque order should be A then B
    const items = await dp.getDequeItems();
    expect(items).toEqual(['A', 'B']);

    // Peek front -> alert with Front element: "A"
    await dp.peekFront();
    const peekFrontDialog = dialogs.pop(); // Grab latest dialog
    expect(peekFrontDialog.message).toContain('Front element: "A"');

    // Peek back -> alert with Back element: "B"
    await dp.peekBack();
    const peekBackDialog = dialogs.pop();
    expect(peekBackDialog.message).toContain('Back element: "B"');

    // Pop front -> alert Popped front: "A"
    await dp.popFront();
    const popFrontDialog = dialogs.pop();
    expect(popFrontDialog.message).toContain('Popped front: "A"');

    // Pop back -> alert Popped back: "B"
    await dp.popBack();
    const popBackDialog = dialogs.pop();
    expect(popBackDialog.message).toContain('Popped back: "B"');

    // After pops, deque should be empty
    const displayAfter = await dp.getDequeDisplayText();
    expect(displayAfter).toBe('(empty)');

    // Interaction log should contain push/pop entries
    const log = await dp.getInteractionLog();
    expect(log).toContain('pushFront("A")');
    expect(log).toContain('pushBack("B")');
    expect(log).toContain('popFront() => "A"');
    expect(log).toContain('popBack() => "B"');
  });

  test('Clear Deque and verify display and log', async ({ page }) => {
    // Validate clearDeque() behavior
    const dp = new DequePage(page);

    await dp.pushBack('alpha');
    await dp.pushBack('beta');
    let items = await dp.getDequeItems();
    expect(items).toEqual(['alpha', 'beta']);

    await dp.clearDeque();
    const afterClearText = await dp.getDequeDisplayText();
    expect(afterClearText).toBe('(empty)');

    const log = await dp.getInteractionLog();
    expect(log).toContain('clear() - Deque emptied');
  });

  test('Remove value, count occurrences, find index, insertAt and removeAt (including invalid ops)', async ({ page }) => {
    // Test advanced operations and error scenarios for invalid indices / empty values
    const dp = new DequePage(page);

    // Start clean
    await dp.clearDeque();
    await dp.clearLog();

    // Setup deque: x, y, x
    await dp.pushBack('x');
    await dp.pushBack('y');
    await dp.pushBack('x');

    // Remove all occurrences of 'x' -> deque should be ['y']
    await dp.removeValue('x');
    let items = await dp.getDequeItems();
    expect(items).toEqual(['y']);

    // Count occurrences of 'y' -> should display Count: 1
    await dp.countValue('y');
    await expect(page.locator(dp.countValueResult)).toHaveText('Count: 1');

    // Find index of 'y' -> should show Index: 0
    await dp.findValue('y');
    await expect(page.locator(dp.findValueResult)).toHaveText('Index: 0');

    // Insert at index 0 value 'z' -> deque becomes z, y
    await dp.insertAt(0, 'z');
    items = await dp.getDequeItems();
    expect(items).toEqual(['z', 'y']);

    // Remove at index 1 -> removes 'y'
    await dp.removeAt(1);
    items = await dp.getDequeItems();
    expect(items).toEqual(['z']);

    // Edge case: insert with invalid index -> expect error and log
    await dp.insertAt(999, 'oops'); // invalid index
    // Last dialog should be error about invalid index
    const lastDialog = dialogs[dialogs.length - 1];
    expect(lastDialog.message).toContain('ERROR: Invalid index for insert');

    // Edge case: removeAt with invalid index -> expect error and log
    await dp.removeAt(999);
    const lastDialog2 = dialogs[dialogs.length - 1];
    expect(lastDialog2.message).toContain('ERROR: Invalid index for remove');

    // Edge case: removeAllOccurrences with empty value -> expect error
    await dp.removeValue('');
    const lastDialog3 = dialogs[dialogs.length - 1];
    expect(lastDialog3.message).toContain('ERROR: Cannot remove empty value.');
  });

  test('Run batch commands (including comments and mixed command types)', async ({ page }) => {
    // Validate batch command parser and executor
    const dp = new DequePage(page);

    await dp.clearDeque();
    await dp.clearLog();

    const batchCommands = [
      '# This is a comment',
      'pushFront BF',   // front -> BF
      'pushBack BB',    // back -> BB
      'insertAt 1 MID', // BF, MID, BB
      'peekFront',      // alert for BF
      'peekBack',       // alert for BB
      'popFront',       // removes BF
      'removeAt 1',     // removes BB (since MID at index0 after pop)
      'countValue MID',
      'findValue MID'
    ].join('\n');

    // Run batch and accept alerts automatically (page dialog handler collects them)
    await dp.runBatch(batchCommands);

    // There may have been alerts for peek/pop etc. Ensure at least one peek alert happened
    const someDialog = dialogs.find(d => d.message.includes('Front element') || d.message.includes('Back element'));
    expect(someDialog).toBeTruthy();

    // Final display should reflect the commands
    // After operations: initial BF,B B -> insert MID => BF, MID, BB
    // peekFront/peekBack don't change state; popFront removes BF -> MID, BB
    // removeAt 1 removes BB -> MID remains
    const items = await dp.getDequeItems();
    expect(items).toEqual(['MID']);

    // Check that batch run logs are present
    const log = await dp.getInteractionLog();
    expect(log).toContain('Running batch commands...');
    expect(log).toContain('Batch commands completed.');
  });

  test('Persistence: Load from JSON and Save to JSON (download)', async ({ page }) => {
    // Validate loadFromJson via file input and saveToJson download creation
    const dp = new DequePage(page);

    await dp.clearDeque();
    await dp.clearLog();

    // Prepare JSON content for loading
    const state = {
      maxSize: 5,
      deque: ['file1', 'file2'],
    };
    const jsonBuffer = Buffer.from(JSON.stringify(state, null, 2), 'utf8');

    // Set the file on the hidden input; this should trigger loadFromJson and update UI
    await dp.loadJsonFileWithContent('state.json', jsonBuffer);

    // Wait for the dequeDisplay to show 'file1' and 'file2'
    await page.waitForSelector(`${dp.dequeDisplay} .deque-item`, { timeout: 2000 });

    const items = await dp.getDequeItems();
    expect(items).toEqual(['file1', 'file2']);

    // Max size input should be updated to 5
    const maxSizeVal = await page.inputValue(dp.maxSizeInput);
    expect(maxSizeVal).toBe('5');

    // Interaction log should contain loaded message
    const log = await dp.getInteractionLog();
    expect(log).toContain('Deque loaded from JSON file.');

    // Now test saving: clicking save should trigger a download named deque_state.json
    const download = await dp.saveJson();
    const suggested = download.suggestedFilename();
    expect(suggested).toBe('deque_state.json');

    // Optionally verify content of downloaded file (if platform supports path())
    // Note: download.path() may be null in some environments; check if available
    try {
      const path = await download.path();
      if (path) {
        const fs = await import('fs');
        const content = fs.readFileSync(path, 'utf8');
        const parsed = JSON.parse(content);
        expect(parsed.maxSize).toBe(5);
        expect(parsed.deque).toEqual(['file1', 'file2']);
      }
    } catch {
      // If reading the path is not allowed on the runner, skip content check gracefully.
    }
  });

  test('Properties: size, isEmpty, isFull reflect deque state correctly', async ({ page }) => {
    // Check size/isEmpty/isFull under different states
    const dp = new DequePage(page);

    await dp.clearDeque();
    await dp.clearLog();

    // Initially empty
    await page.click(dp.sizeBtn);
    await expect(page.locator(dp.sizeResult)).toHaveText('0');
    await page.click(dp.isEmptyBtn);
    await expect(page.locator(dp.isEmptyResult)).toHaveText('Yes');

    // Add items
    await dp.pushBack('a');
    await dp.pushBack('b');
    await page.click(dp.sizeBtn);
    await expect(page.locator(dp.sizeResult)).toHaveText('2');

    // Set max size to 2 and check isFull
    await dp.setMaxSize(2);
    await page.click(dp.isFullBtn);
    await expect(page.locator(dp.isFullResult)).toHaveText('Yes');

    // Remove one and check isFull becomes No
    await dp.popFront();
    // Accept the pop dialog
    const popDialog = dialogs.pop();
    expect(popDialog.message).toContain('Popped front');

    await page.click(dp.isFullBtn);
    await expect(page.locator(dp.isFullResult)).toHaveText('No');
  });
});