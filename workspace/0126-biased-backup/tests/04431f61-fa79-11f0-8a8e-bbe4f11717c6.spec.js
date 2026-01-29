import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04431f61-fa79-11f0-8a8e-bbe4f11717c6.html';

test.describe('Backtracking FSM - Interactive Application (04431f61-fa79-11f0-8a8e-bbe4f11717c6)', () => {

  // Navigate to the application before each test
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
  });

  // Clean up listeners or other state if necessary after each test
  test.afterEach(async ({ page }) => {
    // small pause to allow any pending console/page errors to surface
    await page.waitForTimeout(50);
  });

  test('Idle state: Start is visible, Reset is hidden, and event handler functions exist', async ({ page }) => {
    // Validate initial DOM state (S0_Idle evidence)
    const startVisible = await page.isVisible('#start-button');
    const resetVisible = await page.isVisible('#reset-button');

    // Start should be visible, Reset should be hidden (display: none)
    expect(startVisible).toBe(true);
    expect(resetVisible).toBe(false);

    // Validate that the expected global functions exist (handlers attached in script)
    const types = await page.evaluate(() => {
      return {
        startType: typeof start,
        resetType: typeof reset,
        findPathType: typeof findPath,
        printMazeType: typeof printMaze
      };
    });

    // The FSM expects start(), reset(), printMaze(), and findPath() to be present
    expect(types.startType).toBe('function');
    expect(types.resetType).toBe('function');
    expect(types.printMazeType).toBe('function');
    expect(types.findPathType).toBe('function');
  });

  test('Start button click triggers printMaze which tries to write to missing #maze element -> page error', async ({ page }) => {
    // Prepare to capture page-level errors
    const pageErrorPromise = page.waitForEvent('pageerror');

    // Capture any dialogs (alerts) that might appear as a result of start()
    const dialogs = [];
    page.on('dialog', (d) => {
      dialogs.push({ type: d.type(), message: d.message() });
      // do not dismiss automatically here; just record
      d.dismiss().catch(() => {});
    });

    // Click the Start button which should invoke start() -> printMaze() -> attempt to set .innerHTML of a missing element
    await Promise.all([
      page.click('#start-button'),
      // Wait for the pageerror to be emitted as a consequence of the broken printMaze implementation
      pageErrorPromise
    ]).catch(() => {
      // If the Promise.all rejects, we still want to proceed to checks below by waiting for potential pageerror
    });

    // If a page error was emitted, retrieve it (may have been emitted already)
    let lastPageError = null;
    try {
      lastPageError = await page.waitForEvent('pageerror', { timeout: 200 }).catch(() => null);
    } catch (e) {
      lastPageError = null;
    }

    // It's possible the earlier waitForEvent already consumed the event; attempt to get any error from the browser context logs
    // For robust assertion, we will also check the page's console for messages related to 'innerHTML' or TypeError
    const consoleMessages = [];
    page.on('console', (msg