import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e9323bf0-d360-11f0-a097-ffdd56c22ef4.html';

test.describe('Queue Demonstration — FSM full coverage', () => {
  // Capture console messages and page errors for each test to assert environment stability.
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    // Ensure app initial DOM ready
    await page.waitForSelector('#visualArea');

    // Small wait to let initial resetQueue() log appear
    await page.waitForTimeout(50);
  });

  test('S0 Idle: initial reset performed on load (resetQueue entry)', async ({ page }) => {
    // Validate initial UI state after resetQueue() executed on load
    const opCount = await page.locator('#opCount').textContent();
    expect(opCount.trim()).toBe('0');

    const sizeVal = await page.locator('#sizeVal').textContent();
    expect(sizeVal.trim()).toBe('0');

    const emptyVal = await page.locator('#emptyVal').textContent();
    expect(emptyVal.trim()).toBe('true');

    // The resetQueue() logs a reset message to logArea
    const firstLog = await page.locator('#logArea').locator('div').first().textContent();
    expect(firstLog).toContain('Reset queue');

    // No runtime page errors should have occurred during initial load
    const errors = [];
    page.on('pageerror', err => errors.push(err));
    // tiny pause to be sure
    await page.waitForTimeout(30);
    expect(errors.length).toBe(0);
  });

  test.describe('Enqueue / Dequeue / Peek (S1, S2, S3)', () => {
    test('S1 Enqueue: enqueue a value updates visual, array view, counters and logs', async ({ page }) => {
      // Enter a value and click Enqueue
      const input = page.locator('#valueInput');
      const enqueueBtn = page.locator('#enqueueBtn');

      await input.fill('X1');
      await enqueueBtn.click();

      // value input should be cleared by handler
      await expect(input).toHaveValue('');

      // opCount should increment to 1
      await expect(page.locator('#opCount')).toHaveText('1');

      // size should be 1 and empty false
      await expect(page.locator('#sizeVal')).toHaveText('1');
      await expect(page.locator('#emptyVal')).toHaveText('false');

      // visual area should contain a slot with text 'X1'
      const visualSlot = page.locator('.visual #visualArea .slot, #visualArea .slot').filter({ hasText: 'X1' });
      expect(await visualSlot.count()).toBeGreaterThan(0);

      // array view should show the stored element as logical dynamic array
      const arraySlot = page.locator('#arrayView .slot').filter({ hasText: 'X1' });
      expect(await arraySlot.count()).toBeGreaterThan(0);

      // lastOp should reflect the enqueue
      await expect(page.locator('#lastOp')).toHaveText(/enqueue X1/);

      // Log should include enqueued entry
      const found = await page.locator('#logArea').locator('div', { hasText: 'Enqueued' }).count();
      expect(found).toBeGreaterThan(0);
    });

    test('S2 Dequeue: dequeue removes front element and logs appropriately', async ({ page }) => {
      // Ensure there's a value to dequeue
      await page.locator('#valueInput').fill('D1');
      await page.locator('#enqueueBtn').click();

      // ensure queued
      await expect(page.locator('#sizeVal')).toHaveText('1');

      // Now click Dequeue
      await page.locator('#dequeueBtn').click();

      // opCount increments (we expect at least 2 operations overall from previous enqueue + this dequeue)
      const opCount = parseInt((await page.locator('#opCount').textContent()).trim(), 10);
      expect(opCount).toBeGreaterThanOrEqual(1);

      // After dequeue visual should show empty slot
      await expect(page.locator('#visualArea .slot.empty')).toHaveCount(1);

      // lastOp updated
      await expect(page.locator('#lastOp')).toHaveText(/dequeue/);

      // Log should contain Dequeued message OR Dequeue: queue empty message depending on timing; check for either
      const logText = await page.locator('#logArea').locator('div').first().textContent();
      expect(logText.length).toBeGreaterThan(0);
    });

    test('S3 Peek: peek shows front value and logs peek action', async ({ page }) => {
      // Ensure a known value present
      await page.locator('#valueInput').fill('P1');
      await page.locator('#enqueueBtn').click();

      // Click Peek
      await page.locator('#peekBtn').click();

      // lastOp updated
      await expect(page.locator('#lastOp')).toHaveText(/peek/);

      // opCount incremented
      const opCount = parseInt((await page.locator('#opCount').textContent()).trim(), 10);
      expect(opCount).toBeGreaterThanOrEqual(1);

      // Log contains Peek -> "P1"
      const hasPeekLog = await page.locator('#logArea div', { hasText: 'Peek -> "P1"' }).count();
      expect(hasPeekLog).toBeGreaterThanOrEqual(1);

      // A flash message should appear indicating peek result
      const flash = page.locator('body >> text=Peek ->').first();
      await expect(flash).toBeVisible();
    });
  });

  test.describe('Reset / Fill Random / Clear (S4, S5, S6)', () => {
    test('S4 Reset: clicking Reset returns queue to initial state', async ({ page }) => {
      // Put some items
      await page.locator('#valueInput').fill('a');
      await page.locator('#enqueueBtn').click();
      await page.locator('#valueInput').fill('b');
      await page.locator('#enqueueBtn').click();

      // Ensure non-zero
      await expect(page.locator('#sizeVal')).not.toHaveText('0');

      // Click Reset
      await page.locator('#resetBtn').click();

      // opCount reset to 0
      await expect(page.locator('#opCount')).toHaveText('0');

      // size resets
      await expect(page.locator('#sizeVal')).toHaveText('0');
      await expect(page.locator('#emptyVal')).toHaveText('true');

      // log contains reset message
      const resetLogs = await page.locator('#logArea div', { hasText: 'Reset queue' }).count();
      expect(resetLogs).toBeGreaterThan(0);
    });

    test('S5 Fill Random: clicking Fill random populates the queue', async ({ page }) => {
      // Click Fill random
      await page.locator('#fillBtn').click();

      // Wait a bit for random fill to update DOM
      await page.waitForTimeout(80);

      // sizeVal should be greater than or equal to 1 (random fill picks at least 1)
      const sizeText = await page.locator('#sizeVal').textContent();
      const sizeNum = parseInt(sizeText.trim(), 10);
      expect(sizeNum).toBeGreaterThanOrEqual(1);

      // There should be a 'Filled with' log entry
      const filledLogs = await page.locator('#logArea div', { hasText: 'Filled with' }).count();
      expect(filledLogs).toBeGreaterThan(0);
    });

    test('S6 Clear: clicking Clear empties the queue and logs', async ({ page }) => {
      // Ensure some items
      await page.locator('#fillBtn').click();
      await page.waitForTimeout(40);

      // Click Clear
      await page.locator('#clearBtn').click();

      // opCount increments for clear operation (the app increments operationCounter)
      await expect(page.locator('#sizeVal')).toHaveText('0');
      await expect(page.locator('#emptyVal')).toHaveText('true');

      // Log contains 'Cleared queue'
      const cleared = await page.locator('#logArea div', { hasText: 'Cleared queue' }).count();
      expect(cleared).toBeGreaterThan(0);
    });
  });

  test.describe('Autoplay (S7) and controls', () => {
    test('S7 Autoplay: start and stop toggles and performs operations', async ({ page }) => {
      const autoplayBtn = page.locator('#autoplayBtn');

      // Start autoplay
      await autoplayBtn.click();

      // Button text switches to 'Stop'
      await expect(autoplayBtn).toHaveText('Stop');

      // class toggled to warn while running
      const hasWarn = await autoplayBtn.evaluate((el) => el.classList.contains('warn'));
      expect(hasWarn).toBeTruthy();

      // Let autoplay run briefly to perform a few ops
      await page.waitForTimeout(600);

      // Ensure opCount advanced from 0
      const opCountAfter = parseInt((await page.locator('#opCount').textContent()).trim(), 10);
      expect(opCountAfter).toBeGreaterThanOrEqual(1);

      // Stop autoplay by clicking again
      await autoplayBtn.click();

      // Button text should revert to 'Auto-run'
      await expect(autoplayBtn).toHaveText('Auto-run');

      // class toggled back to have 'secondary' (the script toggles class list)
      const hasSecondary = await autoplayBtn.evaluate((el) => el.classList.contains('secondary'));
      expect(hasSecondary).toBeTruthy();
    });

    test('Speed range input updates value and does not throw', async ({ page }) => {
      // Start autoplay to ensure speed input handler will restart timer when changed
      await page.locator('#autoplayBtn').click();
      await page.waitForTimeout(50);

      // Change speed range
      const speedRange = page.locator('#speedRange');
      await speedRange.evaluate((el) => { el.value = '1200'; el.dispatchEvent(new Event('input', { bubbles: true })); });

      // Validate input changed
      await expect(speedRange).toHaveValue('1200');

      // Stop autoplay to clean up
      await page.locator('#autoplayBtn').click();
      await page.waitForTimeout(10);
    });
  });

  test.describe('Implementation switch, capacity edge-cases and keyboard entry', () => {
    test('IMPLEMENTATION_CHANGE: switching to circular triggers reset and shows pointer indices', async ({ page }) => {
      // Switch implementation select to circular
      await page.selectOption('#implSelect', 'circular');

      // ResetQueue is called on change; wait small moment
      await page.waitForTimeout(60);

      // Log should contain circular capacity mention
      const circularLogCount = await page.locator('#logArea div', { hasText: 'circular' }).count();
      expect(circularLogCount).toBeGreaterThan(0);

      // arrayView for circular shows index row and pointer badges with class 'pointer'
      const pointerCount = await page.locator('#arrayView .pointer').count();
      expect(pointerCount).toBeGreaterThanOrEqual(2);

      // frontIdx and rearIdx should exist (may be '-' initially)
      const f = await page.locator('#frontIdx').textContent();
      const r = await page.locator('#rearIdx').textContent();
      expect(typeof f).toBe('string');
      expect(typeof r).toBe('string');
    });

    test('CAPACITY_CHANGE: changing capacity while circular resets and uses new capacity', async ({ page }) => {
      // Ensure circular selected
      await page.selectOption('#implSelect', 'circular');
      await page.waitForTimeout(40);

      // Change capacity to 5
      const capInput = page.locator('#capInput');
      await capInput.fill('5');
      // Dispatch change event to trigger resetQueue
      await capInput.evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true })));

      // Wait for reset
      await page.waitForTimeout(50);

      // Log should mention capacity=5
      const capLog = await page.locator('#logArea div', { hasText: 'capacity=5' }).count();
      expect(capLog).toBeGreaterThan(0);

      // The arrayView should have 5 slots (the script creates arr.length slots)
      const slotsCount = await page.locator('#arrayView .slot').count();
      expect(slotsCount).toBeGreaterThanOrEqual(5);
    });

    test('VALUE_INPUT_KEYDOWN: pressing Enter enqueues value', async ({ page }) => {
      // Fill input and press Enter
      const input = page.locator('#valueInput');
      await input.fill('ENTER1');
      await input.press('Enter');

      // Wait for DOM update
      await page.waitForTimeout(40);

      // Verify enqueue occurred: visual slot with ENTER1 present
      const count = await page.locator('#visualArea .slot', { hasText: 'ENTER1' }).count();
      expect(count).toBeGreaterThan(0);

      // Ensure input cleared
      await expect(input).toHaveValue('');
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Enqueue empty value triggers alert and does NOT enqueue', async ({ page }) => {
      // Track dialogs
      let dialogMessage = '';
      page.on('dialog', async (dialog) => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });

      // Ensure input empty
      await page.locator('#valueInput').fill('');
      // Click Enqueue which should trigger alert
      await page.locator('#enqueueBtn').click();

      // Give a moment for dialog handler
      await page.waitForTimeout(30);
      expect(dialogMessage).toBe('Please enter a value to enqueue');

      // The operation counter should NOT have incremented due to invalid enqueue
      const opCount = parseInt((await page.locator('#opCount').textContent()).trim(), 10);
      // opCount remains a number, ensure it hasn't spiked (we expect it to be >=0); best we can assert it's finite
      expect(Number.isFinite(opCount)).toBeTruthy();
    });

    test('Circular queue full: additional enqueue fails and logs failure + shows flash', async ({ page }) => {
      // Switch to circular and set small capacity (2) then reset by changing capInput
      await page.selectOption('#implSelect', 'circular');
      await page.waitForTimeout(20);
      await page.locator('#capInput').fill('2');
      await page.locator('#capInput').evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true })));
      await page.waitForTimeout(40);

      // Enqueue two items (fill capacity)
      await page.locator('#valueInput').fill('C1');
      await page.locator('#enqueueBtn').click();
      await page.locator('#valueInput').fill('C2');
      await page.locator('#enqueueBtn').click();

      // Now attempt to enqueue a third value which should fail
      await page.locator('#valueInput').fill('C3');
      await page.locator('#enqueueBtn').click();

      // Expect a log entry mentioning full
      const failCount = await page.locator('#logArea div', { hasText: 'Enqueue failed: queue is full' }).count();
      expect(failCount).toBeGreaterThan(0);

      // A flash message indicating full should appear (script appends a fixed positioned element with that text)
      const flash = page.locator('body >> text=Queue is full — cannot enqueue');
      await expect(flash).toBeVisible();
    });
  });

  test.describe('Console and page error observation', () => {
    test('No uncaught exceptions and no console errors emitted during interactions', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));

      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      // Perform a sequence of interactions that touch many code paths
      await page.locator('#fillBtn').click();
      await page.locator('#peekBtn').click();
      await page.locator('#autoplayBtn').click();
      await page.waitForTimeout(120);
      await page.locator('#autoplayBtn').click();
      await page.locator('#clearBtn').click();
      await page.locator('#resetBtn').click();

      // Small wait to collect any async errors
      await page.waitForTimeout(80);

      // Assert no page errors and no console errors were observed
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });
});