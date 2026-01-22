import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e0a930-d5c1-11f0-a327-5f281c6cb8e2.html';

// Helper: wait until log contains a substring (polling). Default timeout generous to allow animations.
async function waitForLogContains(page, substring, timeout = 4000) {
  await page.waitForFunction(
    (s) => document.getElementById('log') && document.getElementById('log').textContent.includes(s),
    substring,
    { timeout }
  );
}

test.describe('Queue Interactive Demo - FSM Validation', () => {
  let page;
  let consoleMessages;
  let pageErrors;
  let dialogMessages;

  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();

    // collectors for console, errors and dialogs
    consoleMessages = [];
    pageErrors = [];
    dialogMessages = [];

    page.on('console', msg => {
      // collect console messages for later assertions
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    page.on('pageerror', err => {
      // capture uncaught exceptions from page runtime
      pageErrors.push(String(err));
    });

    page.on('dialog', async dialog => {
      dialogMessages.push({ type: dialog.type(), message: dialog.message() });
      try {
        await dialog.accept();
      } catch {
        try { await dialog.dismiss(); } catch {}
      }
    });

    // navigate to the application
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    try { await page.close(); } catch {}
  });

  test.describe('Initial rendering and S0_Idle entry', () => {
    test('renders the expected number of slots and initial status, and logs initialization', async () => {
      // Expect 7 slots created by renderSlots() call on init (default capacity)
      const slots = page.locator('#queueRow .slot');
      await expect(slots).toHaveCount(7);

      // Status should show Size: 0 and Capacity: 7
      const status = page.locator('#status');
      await expect(status).toContainText('Size: 0');
      await expect(status).toContainText('Capacity: 7');

      // Log should contain 'Queue initialized'
      await waitForLogContains(page, 'Queue initialized');

      // No uncaught page errors on load (we assert that runtime did not throw)
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Enqueue transitions (S2_Enqueue_Success and S1_Enqueue_Full)', () => {
    test('enqueue a value updates DOM, pointers, status and logs success', async () => {
      // Enter a value and click Enqueue
      await page.fill('#valueInput', 'X1');
      await page.click('#enqueueBtn');

      // Wait for log entry that confirms enqueue success
      await waitForLogContains(page, 'Enqueued "X1"');

      // Status should reflect size 1
      await expect(page.locator('#status')).toContainText('Size: 1');

      // There should be at least one filled slot with the value X1
      const filled = page.locator('#queueRow .slot.filled');
      await expect(filled.first()).toContainText('X1');

      // Pointers should exist (Front and Rear markers are added to slots)
      const frontPointer = page.locator('.pointer.front');
      const rearPointer = page.locator('.pointer.rear');
      await expect(frontPointer).toHaveCount(1);
      await expect(rearPointer).toHaveCount(1);

      // Ensure no uncaught page errors occurred during enqueue
      expect(pageErrors.length).toBe(0);
    });

    test('enqueue when full triggers alert and error log (S1_Enqueue_Full)', async () => {
      // Set capacity to 2
      await page.fill('#capacityInput', '2');
      await page.click('#setCapBtn');
      await waitForLogContains(page, 'Capacity set to 2');

      // Fill two items
      await page.fill('#valueInput', 'A');
      await page.click('#enqueueBtn');
      await waitForLogContains(page, 'Enqueued "A"');

      await page.fill('#valueInput', 'B');
      await page.click('#enqueueBtn');
      await waitForLogContains(page, 'Enqueued "B"');

      // Now try to enqueue a third item -> should produce alert and log error
      await page.fill('#valueInput', 'C');
      await page.click('#enqueueBtn');

      // Wait for the dialog to be captured
      await page.waitForTimeout(300); // short pause to let the alert be processed
      const foundAlert = dialogMessages.find(d => d.message.includes('Queue is full'));
      expect(foundAlert).toBeTruthy();

      // Log should contain the enqueue failed message
      await waitForLogContains(page, 'Enqueue failed: queue is full');

      // Ensure status still reflects capacity 2 and size 2
      await expect(page.locator('#status')).toContainText('Size: 2');
      await expect(page.locator('#status')).toContainText('Capacity: 2');

      // No uncaught runtime errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Dequeue transitions (S4_Dequeue_Success and S3_Dequeue_Empty)', () => {
    test('dequeue removes front item and logs success', async () => {
      // Ensure queue has at least one known element. Clear then enqueue 'D1'
      await page.fill('#valueInput', 'D1');
      await page.click('#enqueueBtn');
      await waitForLogContains(page, 'Enqueued "D1"');

      // Dequeue and wait for log
      await page.click('#dequeueBtn');
      await waitForLogContains(page, 'Dequeued');

      // Status should reflect size decreased (back to 0 if it was single)
      const statusText = await page.locator('#status').textContent();
      expect(statusText).toMatch(/Size: \d+/);

      // No uncaught errors during dequeue
      expect(pageErrors.length).toBe(0);
    });

    test('dequeue on empty queue triggers alert and error log (S3_Dequeue_Empty)', async () => {
      // Ensure queue is cleared
      await page.click('#clearBtn');
      await waitForLogContains(page, 'Cleared queue');
      // Click dequeue when empty
      await page.click('#dequeueBtn');

      // Wait briefly for dialog capture (alert)
      await page.waitForTimeout(200);
      const found = dialogMessages.find(d => d.message.includes('Queue is empty'));
      expect(found).toBeTruthy();

      // Log should contain the dequeue failed message
      await waitForLogContains(page, 'Dequeue failed: queue is empty');

      // No uncaught runtime errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Peek transitions (S6_Peek_Success and S5_Peek_Empty)', () => {
    test('peek on non-empty queue shows alert and logs peek (S6_Peek_Success)', async () => {
      // Ensure queue has a value to peek
      await page.fill('#valueInput', 'PeekVal');
      await page.click('#enqueueBtn');
      await waitForLogContains(page, 'Enqueued "PeekVal"');

      // Clear previous dialog messages
      dialogMessages = [];

      // Click peek - should alert with Peek -> PeekVal and log peek text
      await page.click('#peekBtn');

      // Wait for dialog
      await page.waitForTimeout(200);
      const peekDialog = dialogMessages.find(d => d.message.startsWith('Peek ->'));
      expect(peekDialog).toBeTruthy();
      expect(peekDialog.message).toContain('Peek -> PeekVal');

      // Log must contain Peek: "PeekVal"
      await waitForLogContains(page, 'Peek: "PeekVal"');

      // No runtime page errors
      expect(pageErrors.length).toBe(0);
    });

    test('peek on empty queue triggers alert and logs peek empty (S5_Peek_Empty)', async () => {
      // Clear queue
      await page.click('#clearBtn');
      await waitForLogContains(page, 'Cleared queue');

      // Clear previous dialog messages
      dialogMessages = [];

      // Click peek on empty
      await page.click('#peekBtn');
      await page.waitForTimeout(200);
      const found = dialogMessages.find(d => d.message.includes('Queue is empty'));
      expect(found).toBeTruthy();

      // Log should contain "Peek: queue is empty"
      await waitForLogContains(page, 'Peek: queue is empty');

      // No uncaught runtime errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Clear, SetCapacity (S7_Clear_Success, S8_SetCapacity_Success)', () => {
    test('clear empties the queue and logs cleared (S7_Clear_Success)', async () => {
      // enqueue two items first
      await page.fill('#valueInput', 'C1');
      await page.click('#enqueueBtn');
      await waitForLogContains(page, 'Enqueued "C1"');

      await page.fill('#valueInput', 'C2');
      await page.click('#enqueueBtn');
      await waitForLogContains(page, 'Enqueued "C2"');

      // Click clear
      await page.click('#clearBtn');
      await waitForLogContains(page, 'Cleared queue');

      // No filled slots should remain
      await expect(page.locator('#queueRow .slot.filled')).toHaveCount(0);

      // Status shows Size: 0
      await expect(page.locator('#status')).toContainText('Size: 0');

      // No uncaught errors
      expect(pageErrors.length).toBe(0);
    });

    test('set capacity updates DOM, slots and logs capacity change (S8_SetCapacity_Success)', async () => {
      // Set capacity to 4
      await page.fill('#capacityInput', '4');
      await page.click('#setCapBtn');

      // Wait for capacity log entry
      await waitForLogContains(page, 'Capacity set to 4');

      // Expect 4 slots rendered
      await expect(page.locator('#queueRow .slot')).toHaveCount(4);

      // Status reflect Capacity: 4
      await expect(page.locator('#status')).toContainText('Capacity: 4');

      // No runtime errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('FillRandom and RandomOps (S9_FillRandom_Success, S10_RandomOps_Success)', () => {
    test('fill random fills some items and logs filled random (S9_FillRandom_Success)', async () => {
      // Clear dialog messages to avoid confusion with alerts from earlier tests
      dialogMessages = [];

      // Click fill random
      await page.click('#fillBtn');

      // wait for the fill random log substring
      await waitForLogContains(page, 'Filled random (');

      // Status size should be > 0
      const statusText = await page.locator('#status').textContent();
      const sizeMatch = statusText.match(/Size:\s*(\d+)/);
      expect(sizeMatch).toBeTruthy();
      const sizeNum = Number(sizeMatch[1]);
      expect(sizeNum).toBeGreaterThan(0);

      // Ensure at least one filled slot exists
      const filledCount = await page.locator('#queueRow .slot.filled').count();
      expect(filledCount).toBeGreaterThan(0);

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('random ops completes and logs finished (S10_RandomOps_Success)', async () => {
      // Clear previous dialogs
      dialogMessages = [];

      // Click Random Ops
      await page.click('#randOpBtn');

      // This runs an async sequence; wait for its log
      await waitForLogContains(page, 'Random ops sequence finished', 10000);

      // Confirm final log existed
      await waitForLogContains(page, 'Random ops sequence finished');

      // No uncaught runtime errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Animation duration and UI response (ChangeDuration event)', () => {
    test('changing duration slider updates durLabel and animDur (ChangeDuration)', async () => {
      // Programmatically change slider value via DOM to ensure input event fires properly
      await page.evaluate(() => {
        const s = document.getElementById('durSlider');
        s.value = '800';
        s.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // durLabel should update to 800
      await expect(page.locator('#durLabel')).toHaveText('800');

      // No uncaught errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('entering empty value when enqueueing triggers alert (validation edge)', async () => {
      // Ensure input empty and click Enqueue
      await page.fill('#valueInput', '');
      // Clear previous dialogs
      dialogMessages = [];
      await page.click('#enqueueBtn');

      // Should alert "Enter a value to enqueue."
      await page.waitForTimeout(200);
      const found = dialogMessages.find(d => d.message.includes('Enter a value to enqueue.'));
      expect(found).toBeTruthy();

      // No uncaught runtime errors
      expect(pageErrors.length).toBe(0);
    });

    test('window resize does not cause runtime errors (pointer recalculation)', async () => {
      // Trigger resize event
      await page.setViewportSize({ width: 800, height: 600 });
      await page.evaluate(() => window.dispatchEvent(new Event('resize')));

      // Allow any async pointer updates to settle
      await page.waitForTimeout(200);

      // There shouldn't be runtime errors following resize
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Console and runtime observations', () => {
    test('collect console messages and ensure no unexpected runtime exceptions', async () => {
      // At this point we collected console messages throughout the tests.
      // Basic sanity: consoleMessages is an array (could be empty)
      expect(Array.isArray(consoleMessages)).toBe(true);

      // Most important: there should be no uncaught page errors reported by 'pageerror'
      expect(pageErrors.length).toBe(0);
    });
  });
});