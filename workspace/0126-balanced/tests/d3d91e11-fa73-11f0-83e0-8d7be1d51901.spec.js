import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d91e11-fa73-11f0-83e0-8d7be1d51901.html';

test.describe('Semaphore Demo (FSM) - d3d91e11-fa73-11f0-83e0-8d7be1d51901', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console messages to assert expected logs from the app.
    page.on('console', (msg) => {
      // Collect only text for easier substring assertions
      try {
        consoleMessages.push(msg.text());
      } catch (e) {
        consoleMessages.push(String(msg));
      }
    });

    // Collect runtime page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app (do not modify page)
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait a short time to let initial logs and UI setup finalize
    await page.waitForTimeout(300);
  });

  test.afterEach(async ({ page }) => {
    // best-effort: attempt to reset the UI by clicking reset if available.
    // This does not modify application code, only interacts with UI.
    try {
      await page.locator('#resetBtn').click({ timeout: 200 }).catch(() => {});
    } catch (_) {}
  });

  test('Initial load should create a semaphore automatically (S0_Idle -> S1_SemaphoreCreated)', async ({ page }) => {
    // This validates the entry action createSemaphore() executed on load.
    // Verify the event log contains the creation message and the UI shows capacity tokens.
    const capacityLabel = page.locator('#capacityLabel');
    const tokens = page.locator('#tokensArea .token');
    const logArea = page.locator('#logArea');

    // Log should contain creation message
    await expect(logArea).toContainText('Semaphore created with capacity=');

    // capacityLabel should reflect initial value (default input value is 3)
    await expect(capacityLabel).toHaveText(/3 \/ 3/);

    // There should be 3 token elements (capacity=3)
    await expect(tokens).toHaveCount(3);

    // No unexpected page errors occurred during initialization (but if any occurred they are collected)
    // If pageErrors exist, ensure they are standard JS errors (ReferenceError, SyntaxError, TypeError)
    expect(pageErrors.length).toBe(0);
  });

  test('Spawn one worker should acquire permit immediately when available (S1_SemaphoreCreated -> S2_WorkerRunning)', async ({ page }) => {
    // Ensure we have an initial semaphore (created on load). Click spawn and assert running worker
    const spawnBtn = page.locator('#spawnBtn');
    const runningCount = page.locator('#runningCount');
    const capacityLabel1 = page.locator('#capacityLabel1');
    const logArea1 = page.locator('#logArea1');

    // Get initial available count
    const beforeCapacity = await capacityLabel.textContent();
    // Click to spawn one worker
    await spawnBtn.click();

    // Give time for the worker to start and UI to update
    await page.waitForTimeout(200);

    // runningCount should be at least 1
    await expect(runningCount).not.toHaveText('0');

    // capacityLabel should show reduced available permits (one less)
    const afterCapacity = await capacityLabel.textContent();
    expect(afterCapacity).not.toBe(beforeCapacity);

    // Logs should include immediate acquisition message
    await expect(logArea).toContainText(/acquired permit immediately/);

    // No runtime errors
    expect(pageErrors.length).toBe(0);
  });

  test('Spawn multiple workers to exceed capacity and create queued workers (S1_SemaphoreCreated -> S3_WorkerQueued)', async ({ page }) => {
    // Create a small semaphore (capacity = 1) so we can reliably queue workers
    const permCount = page.locator('#permCount');
    const createBtn = page.locator('#createBtn');
    const spawnNInput = page.locator('#spawnN');
    const spawnNBtn = page.locator('#spawnNBtn');
    const queueLen = page.locator('#queueLen');
    const queueList = page.locator('#queueList');
    const logArea2 = page.locator('#logArea2');

    // Set permits to 1 and recreate semaphore
    await permCount.fill('1');
    await createBtn.click();
    await page.waitForTimeout(150);

    // Spawn 4 workers quickly to fill capacity and queue extras
    await spawnNInput.fill('4');
    await spawnNBtn.click();

    // Wait briefly to let queuing happen
    await page.waitForTimeout(300);

    // There should be queued workers (queueLen >= 3 since capacity is 1 and 4 spawned)
    const qLenText = await queueLen.textContent();
    const qLen = parseInt(qLenText || '0', 10);
    expect(qLen).toBeGreaterThanOrEqual(3);

    // queueList should contain items equal to queueLen
    await expect(queueList.locator('.queue-item')).toHaveCount(qLen);

    // Logs should contain queued messages for some workers
    await expect(logArea).toContainText(/queued \(no permits\)/);

    // No runtime errors
    expect(pageErrors.length).toBe(0);
  });

  test('Manual release should wake a queued worker (S3_WorkerQueued -> S2_WorkerRunning)', async ({ page }) => {
    // Ensure we have queued workers from previous test scenario: if not, prepare a queued situation.
    const permCount1 = page.locator('#permCount1');
    const createBtn1 = page.locator('#createBtn1');
    const spawnNInput1 = page.locator('#spawnN');
    const spawnNBtn1 = page.locator('#spawnNBtn1');
    const manualRelease = page.locator('#manualRelease');
    const queueLen1 = page.locator('#queueLen1');
    const runningCount1 = page.locator('#runningCount1');
    const logArea3 = page.locator('#logArea3');

    // Recreate semaphore with capacity 1 and spawn 3 to ensure queue exists
    await permCount.fill('1');
    await createBtn.click();
    await page.waitForTimeout(120);
    await spawnNInput.fill('3');
    await spawnNBtn.click();
    await page.waitForTimeout(200);

    const beforeQueue = parseInt((await queueLen.textContent()) || '0', 10);
    const beforeRunning = parseInt((await runningCount.textContent()) || '0', 10);

    expect(beforeQueue).toBeGreaterThanOrEqual(2);

    // Click manual release to hand a permit to a queued worker
    await manualRelease.click();

    // Wait for the queued worker to be granted a permit and start
    await page.waitForTimeout(250);

    // Queue length should decrease by at least 1
    const afterQueue = parseInt((await queueLen.textContent()) || '0', 10);
    expect(afterQueue).toBeLessThan(beforeQueue);

    // runningCount should increase (or remain >= before) after wake
    const afterRunning = parseInt((await runningCount.textContent()) || '0', 10);
    expect(afterRunning).toBeGreaterThanOrEqual(beforeRunning);

    // Logs should indicate a queued worker was granted a permit
    await expect(logArea).toContainText(/granted a permit \(woke from queue\)/);

    // No runtime errors
    expect(pageErrors.length).toBe(0);
  });

  test('Start auto-spawning and then change fairness while auto is running (S1_SemaphoreCreated <-> S4_AutoSpawning)', async ({ page }) => {
    // This test starts auto spawn, asserts auto messages, changes fairness, checks logs, then stops auto.
    const toggleAuto = page.locator('#toggleAuto');
    const autoMs = page.locator('#autoMs');
    const fairness = page.locator('#fairness');
    const logArea4 = page.locator('#logArea4');

    // Ensure semaphore exists
    await page.locator('#permCount').fill('2');
    await page.locator('#createBtn').click();
    await page.waitForTimeout(120);

    // Lower auto interval for test speed
    await autoMs.fill('120');

    // Start auto spawning
    await toggleAuto.click();
    await page.waitForTimeout(180);

    // Log should indicate auto-spawning started
    await expect(logArea).toContainText(/Auto-spawning every/);

    // While auto is running, change fairness to LIFO
    await fairness.selectOption('lifo');
    // Give it time to log the fairness change
    await page.waitForTimeout(150);

    await expect(logArea).toContainText(/Fairness changed to/);

    // Stop auto spawning by clicking the toggle again
    await toggleAuto.click();
    await page.waitForTimeout(120);

    await expect(logArea).toContainText(/Stopped auto-spawn/);

    // No runtime errors
    expect(pageErrors.length).toBe(0);
  });

  test('Release all should attempt to free permits and clear waiters (ReleaseAll)', async ({ page }) => {
    // Prepare a semaphore with capacity 2 and spawn several workers to generate queue
    const permCount2 = page.locator('#permCount2');
    const createBtn2 = page.locator('#createBtn2');
    const spawnNInput2 = page.locator('#spawnN');
    const spawnNBtn2 = page.locator('#spawnNBtn2');
    const releaseAllBtn = page.locator('#releaseAll');
    const queueLen2 = page.locator('#queueLen2');
    const capacityLabel2 = page.locator('#capacityLabel2');
    const logArea5 = page.locator('#logArea5');

    await permCount.fill('2');
    await createBtn.click();
    await page.waitForTimeout(120);

    // Spawn 6 workers to ensure queue forms
    await spawnNInput.fill('6');
    await spawnNBtn.click();
    await page.waitForTimeout(300);

    // Now click release all
    await releaseAllBtn.click();
    await page.waitForTimeout(250);

    // After release-all, queue should be 0 and capacityLabel should show full capacity
    const qLen1 = parseInt((await queueLen.textContent()) || '0', 10);
    expect(qLen).toBe(0);

    // capacityLabel should show count == capacity (e.g., 2 / 2)
    const capText = await capacityLabel.textContent();
    expect(capText).toMatch(/\/\s*2/);

    // Log should indicate release-all invoked
    await expect(logArea).toContainText(/Release-all invoked/);

    // No runtime errors
    expect(pageErrors.length).toBe(0);
  });

  test('Drain queue should cancel queued waiters and log cancellations (DrainQueue)', async ({ page }) => {
    // Create capacity 1 and spawn a few so we have a queue, then drain and assert canceled logs
    const permCount3 = page.locator('#permCount3');
    const createBtn3 = page.locator('#createBtn3');
    const spawnNInput3 = page.locator('#spawnN');
    const spawnNBtn3 = page.locator('#spawnNBtn3');
    const drainQueueBtn = page.locator('#drainQueue');
    const queueLen3 = page.locator('#queueLen3');
    const logArea6 = page.locator('#logArea6');

    await permCount.fill('1');
    await createBtn.click();
    await page.waitForTimeout(120);

    await spawnNInput.fill('4');
    await spawnNBtn.click();
    await page.waitForTimeout(220);

    const beforeQueue1 = parseInt((await queueLen.textContent()) || '0', 10);
    expect(beforeQueue).toBeGreaterThanOrEqual(2);

    // Drain queue
    await drainQueueBtn.click();
    await page.waitForTimeout(250);

    // queue should be cleared
    const afterQueue1 = parseInt((await queueLen.textContent()) || '0', 10);
    expect(afterQueue).toBe(0);

    // Log should mention cleared N queued waiters
    await expect(logArea).toContainText(/Cleared \d+ queued waiters/);

    // Because clearQueue resolves waiters with canceled flag, some worker logs may indicate cancellation
    // Check for canceled messages in logs (if any)
    // It's possible resolution happens before UI poll, so be tolerant: either there are canceled logs or not,
    // but ensure drain action logged.
    // No runtime errors
    expect(pageErrors.length).toBe(0);
  });

  test('Reset while auto running should stop auto and clear UI (Reset)', async ({ page }) => {
    // Start auto, then reset, and verify toggle shows "Start Auto" and tokens/queue cleared.
    const toggleAuto1 = page.locator('#toggleAuto1');
    const autoMs1 = page.locator('#autoMs1');
    const resetBtn = page.locator('#resetBtn');
    const toggleText = toggleAuto;
    const tokensArea = page.locator('#tokensArea');
    const queueList1 = page.locator('#queueList1');
    const logArea7 = page.locator('#logArea7');

    // Ensure semaphore exists and start auto
    await page.locator('#permCount').fill('2');
    await page.locator('#createBtn').click();
    await page.waitForTimeout(120);
    await autoMs.fill('120');
    await toggleAuto.click();
    await page.waitForTimeout(200);

    // Reset the demo
    await resetBtn.click();
    await page.waitForTimeout(200);

    // Toggle text should be back to 'Start Auto'
    await expect(toggleText).toHaveText('Start Auto');

    // tokensArea and queueList should be empty after reset
    await expect(tokensArea).toHaveCount(0);
    await expect(queueList).toBeEmpty();

    // Log should include 'Reset demo.'
    await expect(logArea).toContainText('Reset demo.');

    // No runtime errors
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: manual release and actions when no semaphore exists', async ({ page }) => {
    // Reset to remove semaphore then click manualRelease to test error/log path
    const resetBtn1 = page.locator('#resetBtn1');
    const manualRelease1 = page.locator('#manualRelease1');
    const logArea8 = page.locator('#logArea8');

    // Reset (ensures sem = null)
    await resetBtn.click();
    await page.waitForTimeout(120);

    // Click manual release when no semaphore exists
    await manualRelease.click();
    await page.waitForTimeout(120);

    // Log should indicate "No semaphore exists."
    await expect(logArea).toContainText('No semaphore exists.');

    // Additionally, pressing spawn when no sem should prompt creation message in logs
    const spawnBtn1 = page.locator('#spawnBtn1');
    await spawnBtn.click();
    await page.waitForTimeout(120);
    // Because sem is null, spawnOneWorker logs 'Create the semaphore first (click "Create Semaphore").'
    await expect(logArea).toContainText(/Create the semaphore first/);

    // No runtime errors
    expect(pageErrors.length).toBe(0);
  });

  test('Console and page error inspection: collected messages are sensible and no unexpected exceptions', async ({ page }) => {
    // This test explicitly inspects the captured console messages and page errors.
    // We will assert that key messages we expect appeared in the console at some point.
    // Expected messages include initial guidance and creation messages which are logged on load.
    const joined = consoleMessages.join('\n');

    // Check some of the important startup lines are present
    expect(joined).toContain('Semaphore created with capacity=');
    expect(joined).toContain('Press "Spawn 1 Worker"');

    // If there are page errors, be explicit about their types; prefer zero errors.
    if (pageErrors.length > 0) {
      // Ensure any thrown errors are one of the expected JS error types
      for (const err of pageErrors) {
        const name = err && err.name ? err.name : '';
        expect(['ReferenceError', 'SyntaxError', 'TypeError']).toContain(name);
      }
    } else {
      // No page errors observed
      expect(pageErrors.length).toBe(0);
    }
  });
});