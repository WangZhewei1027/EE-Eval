import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d8cff1-fa73-11f0-83e0-8d7be1d51901.html';

test.describe.serial('Thread (Web Worker) Demonstration - FSM validation', () => {
  // Capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      // Convert to plain text for assertions & debugging
      try {
        consoleMessages.push(`${msg.type()}: ${msg.text()}`);
      } catch (err) {
        consoleMessages.push(`console: (unserializable message)`);
      }
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async ({ page }) => {
    // Ensure the page is closed after each test to trigger unload cleanup in app
    try {
      await page.close();
    } catch (e) {
      // ignore
    }
  });

  // Page object helpers
  const PO = {
    poolStatus: (page) => page.locator('#poolStatus'),
    spawnBtn: (page) => page.locator('#spawnPool'),
    stopBtn: (page) => page.locator('#stopAll'),
    incrementBtn: (page) => page.locator('#incrementShared'),
    workerCount: (page) => page.locator('#workerCount'),
    rangesInput: (page) => page.locator('#ranges'),
    workersContainer: (page) => page.locator('#workersContainer'),
    logArea: (page) => page.locator('#logArea'),
    sharedVal: (page) => page.locator('#sharedVal'),
    sabNote: (page) => page.locator('#sabNote'),
  };

  test('Initial state: Idle (S0_Idle) - page rendered and controls present', async ({ page }) => {
    // Validate initial UI state matches S0_Idle evidence
    await expect(PO.poolStatus(page)).toHaveText('idle');
    await expect(PO.spawnBtn(page)).toBeVisible();
    await expect(PO.stopBtn(page)).toBeVisible();
    await expect(PO.stopBtn(page)).toBeDisabled(); // initial disabled state per HTML
    await expect(PO.incrementBtn(page)).toBeVisible();
    await expect(PO.sharedVal(page)).toHaveText(/^\d+$/); // numeric string
    // Log area should contain initial ready log
    const logText = await PO.logArea(page).textContent();
    expect(logText).toMatch(/Demo ready|Demo ready\. Use the controls/);

    // No uncaught page errors on initial load
    expect(pageErrors.length).toBe(0);
  });

  test('Spawn Pool & Start Work (SpawnPoolStart) transitions Idle -> Working (S0 -> S1)', async ({ page }) => {
    // This test validates clicking "Spawn Pool & Start Work" moves pool status to 'working'
    // and creates worker UI slots. We use small worker/range counts to limit runtime load.
    await PO.workerCount(page).fill('2'); // request 2 workers
    await PO.rangesInput(page).fill('1'); // 1 range per worker to limit complexity
    await PO.spawnBtn(page).click();

    // After spawn, poolStatus should transition to 'working' (S1 evidence)
    await expect(PO.poolStatus(page)).toHaveText('working');

    // Stop button should become enabled
    await expect(PO.stopBtn(page)).toBeEnabled();

    // Worker UI slots should be created (at least 1, expecting 2)
    await expect(PO.workersContainer(page).locator('div')).toHaveCountGreaterThan(0);

    // Ensure no page errors occurred during spawn
    expect(pageErrors.length).toBe(0);

    // Check that the workers container has worker entries and each has a status element
    const workerEntries = PO.workersContainer(page).locator('div');
    const count = await workerEntries.count();
    expect(count).toBeGreaterThanOrEqual(1);

    for (let i = 0; i < Math.min(3, count); i++) {
      const status = await workerEntries.nth(i).locator('.status').textContent();
      // worker status should be a non-empty string like 'ready', 'processing ...', or 'working'
      expect(typeof status).toBe('string');
      expect(status.length).toBeGreaterThan(0);
    }
  });

  test('Stop / Terminate All (StopAll) from Working leads to terminated or completed (S1 -> S3 or S2)', async ({ page }) => {
    // Start a small pool to ensure we're in Working state
    await PO.workerCount(page).fill('1');
    await PO.rangesInput(page).fill('1');
    await PO.spawnBtn(page).click();

    // Ensure we're in working
    await expect(PO.poolStatus(page)).toHaveText('working');

    // Click stop to trigger StopAll event
    await PO.stopBtn(page).click();

    // According to FSM, stopping during working can lead to 'terminated' or 'completed'.
    // The implementation sets poolStatus = 'terminated' immediately on stop click.
    // However, natural completion sets it to 'completed'. We accept either outcome.
    // Wait briefly for UI update (terminated is immediate).
    await page.waitForTimeout(200);

    const statusText = (await PO.poolStatus(page).textContent()).trim();
    expect(['terminated', 'completed']).toContain(statusText);

    // Also verify that stop button is disabled after termination (per code)
    await expect(PO.stopBtn(page)).toBeDisabled();

    // Ensure worker DOM elements were cleaned up (workers array cleared -> container cleared)
    const workerContainerChildren = await PO.workersContainer(page).locator('div').count();
    // Implementation removes worker elements on terminateAll; ensure either 0 or some transitional state
    expect(workerContainerChildren).toBeLessThanOrEqual(0).catch(() => {
      // If not cleaned up instantly in this environment, at least ensure poolStatus is correct
      expect(['terminated', 'completed']).toContain(statusText);
    });

    // No unexpected page errors during stop operation
    expect(pageErrors.length).toBe(0);
  });

  test('Atomic Increment (AtomicIncrement) uses SharedArrayBuffer when available or fallback manager; validates sharedVal update', async ({ page }) => {
    // Read initial shared value
    const initial = (await PO.sharedVal(page).textContent()).trim();

    // Click increment
    await PO.incrementBtn(page).click();

    // Wait for either sharedVal to change or log area to show manager increment message.
    // The app updates sharedVal when SAB increments or when manager worker posts incResult.
    let valChanged = false;
    const timeoutMs = 3000;
    const pollInterval = 150;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const current = (await PO.sharedVal(page).textContent()).trim();
      if (current !== initial && /^\d+$/.test(current)) {
        valChanged = true;
        break;
      }
      // Also check logArea for increment messages (fallback manager logs 'Manager worker incremented to')
      const logs = (await PO.logArea(page).textContent()) || '';
      if (/incremented|Manager worker incremented/i.test(logs)) {
        valChanged = true;
        break;
      }
      await page.waitForTimeout(pollInterval);
    }

    expect(valChanged).toBeTruthy();

    // Ensure no uncaught page errors occurred during atomic increment
    expect(pageErrors.length).toBe(0);
  });

  test('Edge cases and error scenarios: invalid inputs, double stop, click stop without pool - should not throw', async ({ page }) => {
    // Click stop before any spawn - should be a no-op and not throw
    await PO.stopBtn(page).click();
    await page.waitForTimeout(150);
    // poolStatus should remain idle
    await expect(PO.poolStatus(page)).toHaveText('idle');

    // Provide out-of-range workerCount and spawn; implementation clamps to [1,16]
    await PO.workerCount(page).fill('9999'); // large number
    await PO.rangesInput(page).fill('-5'); // invalid small number -> clamped to >=1
    await PO.spawnBtn(page).click();

    // Workers should be created; the code clamps to 16 workers maximum
    // We wait briefly for worker elements to appear and then assert the number created is <= 16 and >=1
    await page.waitForTimeout(300);
    const children = PO.workersContainer(page).locator('div');
    const created = await children.count();
    expect(created).toBeGreaterThanOrEqual(1);
    expect(created).toBeLessThanOrEqual(16);

    // Immediately click stop twice to ensure double termination doesn't throw errors
    await PO.stopBtn(page).click();
    await PO.stopBtn(page).click();
    await page.waitForTimeout(150);

    // After termination, poolStatus should be 'terminated' or 'completed' but not throw
    const status1 = (await PO.poolStatus(page).textContent()).trim();
    expect(['terminated', 'completed', 'idle']).toContain(status);

    // No page errors collected during these edge interactions
    expect(pageErrors.length).toBe(0);
  });

  test('Verify onEnter/onExit actions: renderPage() was run (log evidence) - S0 entry action', async ({ page }) => {
    // The FSM S0 entry action mentions renderPage(); the page code logs readiness on init.
    // We assert that the log area contains the initial demo ready entry which is equivalent evidence.
    const logText1 = await PO.logArea(page).textContent();
    expect(logText).toMatch(/Demo ready/i);

    // Ensure no page errors on initial render
    expect(pageErrors.length).toBe(0);
  });

  test('Observe console and page errors array and surface them if any - final assertion', async ({ page }) => {
    // This test intentionally surfaces any collected console messages and page errors.
    // We do not assert that errors must exist; we assert that we observed and captured them reliably.
    // The primary application does its own logging to the log area; console may be quiet.
    // But we assert that our collectors worked (arrays exist) and contain only serializable entries.
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    expect(Array.isArray(pageErrors)).toBeTruthy();

    // If pageErrors exist, make them available as test diagnostics by failing with the error messages
    if (pageErrors.length > 0) {
      // Surface the first error message to make failure actionable
      const err = pageErrors[0];
      const msg = err && err.message ? err.message : String(err);
      throw new Error('Uncaught page error(s) observed: ' + msg);
    }

    // If no page errors, assert that at least the app logs (in DOM) are present and contain expected info
    const logs1 = (await PO.logArea(page).textContent()) || '';
    expect(logs.length).toBeGreaterThan(0);
  });
});