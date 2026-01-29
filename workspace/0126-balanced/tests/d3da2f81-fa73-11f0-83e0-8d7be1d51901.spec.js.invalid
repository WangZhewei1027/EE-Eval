import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3da2f81-fa73-11f0-83e0-8d7be1d51901.html';

test.describe('Interactive Congestion Control Demo - FSM and UI', () => {
  // Arrays to capture console and page errors for each test
  let consoleLogs;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleLogs = [];
    consoleErrors = [];
    pageErrors = [];

    // capture console messages
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleLogs.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    // capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      // err is Error object
      pageErrors.push(String(err));
    });

    // navigate to the application HTML
    await page.goto(APP_URL, { waitUntil: 'load' });

    // sanity: ensure main UI elements are present
    await expect(page.locator('#start')).toBeVisible();
    await expect(page.locator('#pause')).toBeVisible();
    await expect(page.locator('#reset')).toBeVisible();
    await expect(page.locator('#forceLoss')).toBeVisible();
    await expect(page.locator('#band')).toBeVisible();
    await expect(page.locator('#buf')).toBeVisible();
    await expect(page.locator('#rtt')).toBeVisible();
    await expect(page.locator('#loss')).toBeVisible();
    await expect(page.locator('#speed')).toBeVisible();
    await expect(page.locator('#fastRecovery')).toBeVisible();
    // wait a short while for initial resetSimulation run to finish
    await page.waitForTimeout(120);
  });

  test.afterEach(async () => {
    // no-op; Playwright will close page automatically
  });

  test.describe('FSM States and Transitions', () => {
    test('S0_Idle initial state - resetSimulation() executed and UI shows initial values', async ({ page }) => {
      // Validate initial statics shown after resetSimulation() on load
      // cwnd should be 1.00, ssthresh 16, in flight 0, rtt 200 ms (matching HTML defaults)
      const cwnd = await page.locator('#cwndVal').innerText();
      const ssthresh = await page.locator('#sstVal').innerText();
      const inflight = await page.locator('#flightVal').innerText();
      const rttTxt = await page.locator('#rttVal').innerText();

      expect(cwnd).toMatch(/1\.0{1,2}/); // "1.0" or "1.00"
      expect(ssthresh).toBe('16');
      expect(inflight).toBe('0');
      expect(rttTxt).toContain('200 ms');

      // Ensure no uncaught page errors on initial load
      expect(pageErrors, 'expected no uncaught page errors on load').toHaveLength(0);
      expect(consoleErrors, 'expected no console.error messages on load').toHaveLength(0);
    });

    test('Transition Idle -> Running (S0_Idle -> S1_Running) on Start click', async ({ page }) => {
      // Click Start and verify cwnd grows (simulation running)
      const cwndLocator = page.locator('#cwndVal');

      // read initial cwnd
      const cwndBeforeText = await cwndLocator.innerText();
      const cwndBefore = parseFloat(cwndBeforeText);

      await page.click('#start');

      // wait to let simulation step a few ticks
      await page.waitForTimeout(700);

      const cwndAfterText = await cwndLocator.innerText();
      const cwndAfter = parseFloat(cwndAfterText);

      // Expect cwnd to have increased above initial (slow start)
      expect(cwndAfter).toBeGreaterThanOrEqual(cwndBefore + 0.1);

      // also check that UI shows increasing in-flight possibly >0
      const flight = parseInt(await page.locator('#flightVal').innerText(), 10);
      expect(flight).toBeGreaterThanOrEqual(0);

      // Pause the simulation at the end of test to keep environment stable
      await page.click('#pause');

      // No page errors occurred during running
      expect(pageErrors, 'no uncaught errors during start/run').toHaveLength(0);
      expect(consoleErrors, 'no console.error during start/run').toHaveLength(0);
    });

    test('Transition Running -> Paused (S1_Running -> S2_Paused) on Pause click', async ({ page }) => {
      // Start then Pause and check cwnd stops changing (approx)
      await page.click('#start');
      await