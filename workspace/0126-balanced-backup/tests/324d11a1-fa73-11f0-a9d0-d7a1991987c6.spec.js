import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324d11a1-fa73-11f0-a9d0-d7a1991987c6.html';

test.describe('Priority Queue Demonstration - FSM (Application ID: 324d11a1-fa73-11f0-a9d0-d7a1991987c6)', () => {
  // Shared containers for observed console messages, page errors, and dialogs.
  let consoleMessages;
  let pageErrors;
  let dialogs;

  // Attach listeners before each test to capture runtime behavior without modifying the page.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Capture unhandled exceptions that bubble to the page.
      pageErrors.push(err);
    });

    // Capture and accept dialogs so they don't block test execution.
    page.on('dialog', async (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });

    // Load the page exactly as-is.
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Clean up listeners after each test (Playwright automatically closes pages between tests,
  // but we reset arrays to ensure isolation).
  test.afterEach(async () => {
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];
  });

  test('S0_EmptyQueue: initial state - queue is empty and UI reflects empty queue', async ({ page }) => {
    // Verify the queue object exists and is empty
    const isEmpty = await page.evaluate(() => {
      // Access global queue object defined by the page script
      return typeof window.queue !== 'undefined' ? window.queue.isEmpty() : null;
    });
    expect(isEmpty).toBe(true);

    // The UI list should have no items
    const itemCount = await page.$$eval('#queueList li', (els) => els.length);
    expect(itemCount).toBe(0);

    // The FSM entry action mentioned 'renderPage()' does not exist in the HTML.
    // Verify that renderPage is not defined on window (this validates the FSM's onEnter mention).
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(hasRenderPage).toBe(false);

    // Ensure no unexpected page errors occurred during load
    expect(pageErrors.length).toBe(0);

    // No severe console errors expected at initial load
    const severeConsole = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(severeConsole.length).toBeLessThanOrEqual(1); // allow <=1 in case of non-critical warnings
  });

  test('EnqueueItem: S0 -> S1 transition - adding first item updates queue and UI', async ({ page }) => {
    // Add a single valid item
    await page.fill('#item', 'Task-A');
    await page.fill('#priority', '2');

    // Click the Add to Queue button (selector uses onclick attribute)
    await page.click("button[onclick='enqueue()']");

    // Wait for UI update: one list item should appear
    await page.waitForFunction(() => document.querySelectorAll('#queueList li').length === 1);

    // Verify queue.isEmpty() is now false
    const isEmptyAfter = await page.evaluate(() => window.queue.isEmpty());
    expect(isEmptyAfter).toBe(false);

    // Verify the item in the queue is the one we added and priority retained
    const visibleText = await page.$eval('#queueList li', (li) => li.textContent.trim());
    expect(visibleText).toBe('Task-A (Priority: 2)');

    // Verify the internal queue data matches expectations
    const queueContents = await page.evaluate(() => window.queue.getQueue().map(e => `${e.item}::${e.priority}`));
    expect(queueContents).toEqual(['Task-A::2']);

    // No unexpected page errors
    expect(pageErrors.length).toBe(0);
  });

  test('EnqueueItem (multiple): S1 -> S1 transition - adding multiple items preserves priority ordering', async ({ page }) => {
    // Add multiple items with different priorities
    await page.fill('#item', 'Task-HighPriority');
    await page.fill('#priority', '1');
    await page.click("button[onclick='enqueue()']");

    await page.fill('#item', 'Task-LowPriority');
    await page.fill('#priority', '5');
    await page.click("button[onclick='enqueue()']");

    await page.fill('#item', 'Task-MidPriority');
    await page.fill('#priority', '3');
    await page.click("button[onclick='enqueue()']");

    // Wait for UI to show three items
    await page.waitForFunction(() => document.querySelectorAll('#queueList li').length === 3);

    // Extract visible list order
    const visibleOrder = await page.$$eval('#queueList li', (lis) => lis.map(li => li.textContent.trim()));
    // Expected order sorted by priority ascending: 1,3,5
    expect(visibleOrder).toEqual([
      'Task-HighPriority (Priority: 1)',
      'Task-MidPriority (Priority: 3)',
      'Task-LowPriority (Priority: 5)'
    ]);

    // Verify internal queue ordering matches
    const internalOrder = await page.evaluate(() => window.queue.getQueue().map(e => `${e.item}::${e.priority}`));
    expect(internalOrder).toEqual([
      'Task-HighPriority::1',
      'Task-MidPriority::3',
      'Task-LowPriority::5'
    ]);

    expect(pageErrors.length).toBe(0);
  });

  test('DequeueItem: S1 -> S1 and S1 -> S0 transitions - processing items in order and handling empty queue', async ({ page }) => {
    // Prepare queue with a couple of items
    await page.fill('#item', 'Job1');
    await page.fill('#priority', '4');
    await page.click("button[onclick='enqueue()']");

    await page.fill('#item', 'Job2');
    await page.fill('#priority', '2');
    await page.click("button[onclick='enqueue()']");

    // Ensure queue has 2 items
    await page.waitForFunction(() => document.querySelectorAll('#queueList li').length === 2);

    // Clear any previously captured dialogs before dequeuing
    dialogs = [];

    // First dequeue: should process Job2 (priority 2)
    await page.click("button[onclick='dequeue()']");

    // Dialog should have been shown for processed item and auto-accepted by our handler
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[0].message).toBe('Processed: Job2 (Priority: 2)');

    // After first dequeue, one item should remain (Job1)
    await page.waitForFunction(() => document.querySelectorAll('#queueList li').length === 1);
    let remaining = await page.$eval('#queueList li', li => li.textContent.trim());
    expect(remaining).toBe('Job1 (Priority: 4)');

    // Second dequeue: should process Job1 and leave queue empty
    dialogs = []; // reset to capture the next sequence
    await page.click("button[onclick='dequeue()']");

    // Check dialog for second processed item
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[0].message).toBe('Processed: Job1 (Priority: 4)');

    // Now queue should be empty and UI should have 0 items
    await page.waitForFunction(() => document.querySelectorAll('#queueList li').length === 0);
    const finalIsEmpty = await page.evaluate(() => window.queue.isEmpty());
    expect(finalIsEmpty).toBe(true);

    // Attempting to dequeue when empty should display an alert 'The queue is empty!'
    dialogs = [];
    await page.click("button[onclick='dequeue()']");

    // That alert should be captured
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[0].message).toBe('The queue is empty!');

    expect(pageErrors.length).toBe(0);
  });

  test('Edge case validation: invalid enqueue shows validation alert and does not modify queue', async ({ page }) => {
    // Ensure the queue is empty initially for isolation
    await page.evaluate(() => {
      // Reset the internal queue array if present (we are allowed to call existing functions, not to redefine)
      if (window.queue && typeof window.queue.elements !== 'undefined') {
        window.queue.elements = [];
      }
    });
    await page.waitForFunction(() => document.querySelectorAll('#queueList li').length === 0);

    // Click Add to Queue without entering item or priority -> should trigger validation alert
    await page.fill('#item', '');
    await page.fill('#priority', '');
    await page.click("button[onclick='enqueue()']");

    // The dialog should have been captured with validation message
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    const lastDialog = dialogs[dialogs.length - 1];
    expect(lastDialog.message).toBe('Please enter a valid item and priority.');

    // Ensure the queue is still empty after invalid attempt
    const isEmptyAfterInvalid = await page.evaluate(() => window.queue.isEmpty());
    expect(isEmptyAfterInvalid).toBe(true);

    // Ensure no runtime page errors occurred
    expect(pageErrors.length).toBe(0);
  });

  test('UI elements and handlers existence: ensure expected components are present and clickable', async ({ page }) => {
    // Verify inputs and buttons exist
    const itemExists = await page.$('#item');
    const priorityExists = await page.$('#priority');
    const enqueueBtn = await page.$("button[onclick='enqueue()']");
    const dequeueBtn = await page.$("button[onclick='dequeue()']");
    const container = await page.$('#queueContainer');

    expect(itemExists).not.toBeNull();
    expect(priorityExists).not.toBeNull();
    expect(enqueueBtn).not.toBeNull();
    expect(dequeueBtn).not.toBeNull();
    expect(container).not.toBeNull();

    // Ensure clicking enqueue and dequeue triggers handlers without throwing exceptions
    // For safety, use valid enqueue then dequeue to exercise handlers
    await page.fill('#item', 'Ping');
    await page.fill('#priority', '10');
    await page.click("button[onclick='enqueue()']");
    await page.waitForFunction(() => document.querySelectorAll('#queueList li').length === 1);

    // Clear captured dialogs and errors then dequeue
    dialogs = [];
    await page.click("button[onclick='dequeue()']");
    expect(dialogs.length).toBeGreaterThanOrEqual(1);

    // Confirm no unhandled page errors occurred
    expect(pageErrors.length).toBe(0);
  });
});