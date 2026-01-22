import { test, expect } from '@playwright/test';

//
// Test file: 6aff7170-d5c3-11f0-b41f-b131cbd11f51.spec.js
//
// These tests validate the Queue Data Structure Visualization app:
//
// - They load the page exactly as-is (no modifications).
// - They observe console messages and page errors.
// - They exercise all user interactions described in the FSM:
//     Enqueue, Dequeue, Clear Queue, Generate Random, Enter key triggering Enqueue.
// - They validate state transitions between "Empty" and "Non-Empty" states,
//   check DOM updates, operation log entries, and edge-case alerts.
// - Dialogs, console errors, and uncaught page errors are captured and asserted.
//
// Note: Tests use modern async/await, ES module syntax, and a simple page object.
//

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6aff7170-d5c3-11f0-b41f-b131cbd11f51.html';

class QueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Locators
    this.size = page.locator('#sizeValue');
    this.front = page.locator('#frontValue');
    this.rear = page.locator('#rearValue');
    this.input = page.locator('#elementInput');
    this.enqueueButton = page.locator("button[onclick='enqueue()']");
    this.dequeueButton = page.locator("button[onclick='dequeue()']");
    this.clearButton = page.locator("button[onclick='clearQueue()']");
    this.randomButton = page.locator("button[onclick='generateRandom()']");
    this.queueItems = page.locator('#queueDisplay >> .queue-item');
    this.emptyMessage = page.locator('#emptyMessage');
    this.operationLogFirst = page.locator('#operationLog >> .log-entry').first();
    this.operationLogAll = page.locator('#operationLog >> .log-entry');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getSizeNumber() {
    const text = await this.size.textContent();
    return Number(text.trim());
  }

  async getFrontText() {
    return (await this.front.textContent()).trim();
  }

  async getRearText() {
    return (await this.rear.textContent()).trim();
  }

  async getQueueItemsCount() {
    return await this.queueItems.count();
  }

  async getLatestLogText() {
    if ((await this.operationLogAll.count()) === 0) return '';
    return (await this.operationLogFirst.textContent()).trim();
  }

  async setInput(value) {
    await this.input.fill(value);
  }

  async clickEnqueue() {
    await this.enqueueButton.click();
  }

  async clickDequeue() {
    await this.dequeueButton.click();
  }

  async clickClear() {
    await this.clearButton.click();
  }

  async clickRandom() {
    await this.randomButton.click();
  }

  async pressEnterInInput() {
    await this.input.press('Enter');
  }
}

test.describe('Queue Data Structure Visualization - FSM and UI tests', () => {
  let consoleErrors = [];
  let pageErrors = [];
  let dialogs = [];

  test.beforeEach(async ({ page }) => {
    // Capture console.error messages
    consoleErrors = [];
    pageErrors = [];
    dialogs = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      // Capture uncaught exceptions (ReferenceError, TypeError, etc.)
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Capture and auto-accept dialogs (alerts) while recording their messages
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      try {
        await dialog.accept();
      } catch (e) {
        // ignore acceptance errors, we only record
      }
    });
  });

  test('Initial load: app initializes and enters Non-Empty state (or Empty if random yields none) and logs Initialize', async ({ page }) => {
    // Validate the page loads and the initial state elements are consistent with FSM
    const q = new QueuePage(page);
    await q.goto();

    // On load the app's window.onload should push 3 random items and call updateDisplay and addToLog.
    // Wait for the operation log to show at least one entry (Initialize).
    await expect(q.operationLogAll.first()).toBeVisible();

    const size = await q.getSizeNumber();
    const frontText = await q.getFrontText();
    const rearText = await q.getRearText();
    const emptyVisible = await q.emptyMessage.isVisible();

    // If size > 0, we are in S1_NonEmpty: empty message hidden, front/rear are not '-'
    if (size > 0) {
      expect(emptyVisible).toBe(false);
      expect(frontText).not.toBe('-');
      expect(rearText).not.toBe('-');
    } else {
      // S0_Empty: empty message visible, front/rear are '-'
      expect(emptyVisible).toBe(true);
      expect(frontText).toBe('-');
      expect(rearText).toBe('-');
    }

    // The latest log entry should contain 'Initialize' (as per implementation)
    const latestLog = await q.getLatestLogText();
    expect(latestLog.toLowerCase()).toContain('initialize');
  });

  test('Enqueue operation: adds element to rear and updates size, front & rear, and log', async ({ page }) => {
    // This test validates both transitions from S0->S1 and S1->S1 for Enqueue
    const q = new QueuePage(page);
    await q.goto();

    // Record current size and front value
    const beforeSize = await q.getSizeNumber();
    const beforeFront = await q.getFrontText();

    // Enqueue a known value via input and button click
    const testValue = 'A1';
    await q.setInput(testValue);
    await q.clickEnqueue();

    // After enqueue: size increases by 1
    await expect(q.size).toHaveText(String(beforeSize + 1));

    // Front should remain the same if non-empty before; if it was empty, front becomes testValue
    const afterFront = await q.getFrontText();
    const afterRear = await q.getRearText();
    if (beforeSize === 0) {
      expect(afterFront).toBe(testValue);
      expect(afterRear).toBe(testValue);
      // empty message should be hidden
      expect(await q.emptyMessage.isVisible()).toBe(false);
    } else {
      expect(afterFront).toBe(beforeFront);
      expect(afterRear).toBe(testValue);
    }

    // Queue items count in DOM should match size
    const itemsCount = await q.getQueueItemsCount();
    expect(itemsCount).toBe(await q.getSizeNumber());

    // Latest operation log should indicate Enqueue and include the testValue
    const latestLog = await q.getLatestLogText();
    expect(latestLog).toMatch(new RegExp(`Enqueue[:]?\\s*${testValue}`, 'i'));
  });

  test('Enter key triggers enqueue (EnterKey event)', async ({ page }) => {
    // Validate pressing Enter in the input triggers enqueue()
    const q = new QueuePage(page);
    await q.goto();

    const beforeSize = await q.getSizeNumber();
    const inputValue = 'ENT';
    await q.setInput(inputValue);

    // Press Enter
    await q.pressEnterInInput();

    // Size should increase by 1 and rear should be the input value
    await expect(q.size).toHaveText(String(beforeSize + 1));
    const rear = await q.getRearText();
    expect(rear).toBe(inputValue);

    // Operation log should record the enqueue via Enter key
    const latest = await q.getLatestLogText();
    expect(latest.toLowerCase()).toContain('enqueue');
    expect(latest).toContain(inputValue);
  });

  test('Dequeue operation: removes front, updates size and front, moves to Empty when last removed', async ({ page }) => {
    // Validate Dequeue transitions (S1->S1 and S1->S0 when queue becomes empty)
    const q = new QueuePage(page);
    await q.goto();

    // Ensure there's at least one item to dequeue; if empty, enqueue one quickly
    if ((await q.getSizeNumber()) === 0) {
      await q.setInput('X');
      await q.clickEnqueue();
    }

    // Record initial size and front
    let currentSize = await q.getSizeNumber();
    let currentFront = await q.getFrontText();

    // Dequeue once
    await q.clickDequeue();

    // After dequeue, size should decrement by 1
    await expect(q.size).toHaveText(String(currentSize - 1));

    // Operation log's latest should be Dequeue
    let latest = await q.getLatestLogText();
    expect(latest.toLowerCase()).toContain('dequeue');

    // If the queue still has items, front should change to the new front element
    const newSize = await q.getSizeNumber();
    if (newSize > 0) {
      const newFront = await q.getFrontText();
      expect(newFront).not.toBe('-');
      // If previous size was >1, front should have changed (unless duplicates)
      if (currentSize > 1) {
        // It's possible values duplicate; ensure size logic is correct and not '-' front
        expect(newFront).not.toBe('');
      }
    } else {
      // Queue became empty: front/rear reset to '-' and emptyMessage visible
      expect(await q.front.textContent()).toContain('-');
      expect(await q.rear.textContent()).toContain('-');
      expect(await q.emptyMessage.isVisible()).toBe(true);
    }
  });

  test('Clear Queue: clears all elements and transitions to Empty state and logs Clear', async ({ page }) => {
    // Validate ClearQueue transition from S1_NonEmpty -> S0_Empty
    const q = new QueuePage(page);
    await q.goto();

    // Ensure queue is non-empty (enqueue if empty)
    if ((await q.getSizeNumber()) === 0) {
      await q.setInput('C');
      await q.clickEnqueue();
    }

    // Now clear
    await q.clickClear();

    // After clearing, size should be 0, front/rear '-'
    await expect(q.size).toHaveText('0');
    await expect(q.front).toHaveText('-');
    await expect(q.rear).toHaveText('-');
    expect(await q.emptyMessage.isVisible()).toBe(true);

    // Latest log should indicate 'Clear'
    const latest = await q.getLatestLogText();
    expect(latest.toLowerCase()).toContain('clear');
  });

  test('GenerateRandom: adds a random numeric value as string and updates rear and size', async ({ page }) => {
    // Validate GenerateRandom transition (S1_NonEmpty -> S1_NonEmpty)
    const q = new QueuePage(page);
    await q.goto();

    const beforeSize = await q.getSizeNumber();
    await q.clickRandom();

    // Size increases by 1
    await expect(q.size).toHaveText(String(beforeSize + 1));

    // Rear should be a numeric string (1..100) per implementation.
    const rearText = await q.getRearText();
    expect(rearText).toMatch(/^\d+$/);

    // Latest log should contain Enqueue (random value)
    const latest = await q.getLatestLogText();
    expect(latest.toLowerCase()).toContain('enqueue');
    // It should include the numeric value present in rear
    expect(latest).toContain(rearText);
  });

  test('Edge cases: alerts for enqueue with empty input, dequeue when empty, clear when empty, enqueue when full', async ({ page }) => {
    // Validate error scenarios produce alerts with expected messages (we capture dialog messages)
    const q = new QueuePage(page);
    await q.goto();

    // 1) Enqueue with empty input -> alert 'Please enter a value to enqueue'
    // Ensure input is empty
    await q.setInput('');
    await q.clickEnqueue();

    // Wait a tick for dialog to be captured
    await page.waitForTimeout(100);
    expect(dialogs.length).toBeGreaterThan(0);
    const lastDialog = dialogs[dialogs.length - 1];
    expect(lastDialog.toLowerCase()).toContain('please enter a value');

    // Reset captured dialogs for subsequent checks
    dialogs = [];

    // 2) Dequeue when empty -> ensure queue cleared then attempt dequeue to trigger alert
    // First clear the queue (if not empty)
    if ((await q.getSizeNumber()) > 0) {
      await q.clickClear();
    }
    // Now attempt to dequeue
    await q.clickDequeue();
    await page.waitForTimeout(100);
    expect(dialogs.length).toBeGreaterThan(0);
    expect(dialogs[dialogs.length - 1].toLowerCase()).toContain('queue is empty');

    dialogs = [];

    // 3) Clear when empty -> alert 'Queue is already empty!'
    await q.clickClear();
    await page.waitForTimeout(100);
    expect(dialogs.length).toBeGreaterThan(0);
    expect(dialogs[dialogs.length - 1].toLowerCase()).toContain('already empty');

    dialogs = [];

    // 4) Enqueue when full -> fill until MAX_SIZE then attempt one more
    // MAX_SIZE according to implementation is 10. We'll enqueue numeric values until size reaches 10.
    // First ensure queue is empty, then enqueue 10 items.
    if ((await q.getSizeNumber()) !== 0) {
      await q.clickClear();
    }
    for (let i = 0; i < 10; i++) {
      await q.setInput(`v${i}`);
      await q.clickEnqueue();
    }
    // Confirm size is 10
    await expect(q.size).toHaveText('10');

    // Try enqueue one more to trigger full-alert
    await q.setInput('overflow');
    await q.clickEnqueue();
    await page.waitForTimeout(100);
    expect(dialogs.length).toBeGreaterThan(0);
    const last = dialogs[dialogs.length - 1].toLowerCase();
    expect(last).toContain('queue is full');
  });

  test('Console and page error observation: ensure no unexpected console.error or uncaught page exceptions occurred during interactions', async ({ page }) => {
    // This test performs a set of common interactions while capturing console / page errors.
    // It then asserts that there were no console.error messages or uncaught page errors.
    const q = new QueuePage(page);

    // Reset collectors
    consoleErrors = [];
    pageErrors = [];
    dialogs = [];

    await q.goto();

    // Perform typical interactions
    await q.setInput('Z1');
    await q.clickEnqueue();

    await q.clickRandom();
    await q.clickDequeue();

    // Trigger an alert path too
    await q.setInput('');
    await q.clickEnqueue(); // should produce an alert

    // Small wait to allow any console errors to appear
    await page.waitForTimeout(200);

    // Assert that there were no uncaught page errors (ReferenceError, TypeError, SyntaxError, etc.)
    // The test expects a clean runtime: zero captured page errors.
    expect(pageErrors.length).toBe(0);

    // Assert there are no console.error messages collected
    expect(consoleErrors.length).toBe(0);

    // If any dialogs were shown, they should be from legitimate alert flows (we recorded them)
    // Ensure at least one dialog occurred from the empty-enqueue check above
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
  });

  test.afterEach(async ({ page }) => {
    // As an additional guard, collect any final page errors after test completes
    // (this is mostly for completeness; primary assertions are inside tests)
    // Fail test if any uncaught errors were observed during the test lifecycle.
    if (pageErrors.length > 0) {
      // Provide a helpful message for debugging
      throw new Error('Uncaught page errors detected: ' + JSON.stringify(pageErrors, null, 2));
    }
    if (consoleErrors.length > 0) {
      throw new Error('Console.error messages detected: ' + JSON.stringify(consoleErrors, null, 2));
    }
  });
});