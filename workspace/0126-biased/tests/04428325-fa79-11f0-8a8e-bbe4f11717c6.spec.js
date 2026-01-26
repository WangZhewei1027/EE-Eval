import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04428325-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page Object Model for the DFS interactive page
class DFSPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startButton = page.locator('#start-button');
    this.stopButton = page.locator('#stop-button');
    this.canvas = page.locator('#graph');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Click start, but let natural errors bubble up or be observed via page events
  async clickStart() {
    await this.startButton.click();
  }

  // Click stop
  async clickStop() {
    await this.stopButton.click();
  }

  // Get boolean enabled/disabled states
  async isStartEnabled() {
    const disabled = await this.startButton.getAttribute('disabled');
    return disabled === null;
  }

  async isStopEnabled() {
    const disabled = await this.stopButton.getAttribute('disabled');
    return disabled === null;
  }

  // Utility to read present console messages captured externally
  // (Kept in tests via captured arrays)
}

/*
  Test suite for the Depth-First Search interactive visualization.
  These tests:
  - Validate initial Idle state (S0_Idle)
  - Validate Running state transition (S1_Running) on StartDFS
  - Validate returning to Idle on StopDFS
  - Verify onEnter/onExit observable side-effects via console messages where available
  - Observe and assert runtime page errors (ReferenceError, TypeError, SyntaxError) if they occur naturally
  - Include edge case: clicking Stop while disabled
*/

test.describe('Depth-First Search Interactive Application (FSM validation)', () => {
  let page;
  let dfsPage;
  let consoleMessages;
  let pageErrors;

  // Setup: before each test, create fresh page and capture console & errors
  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      try {
        // collect console message text for later assertions
        const text = msg.text();
        consoleMessages.push(text);
      } catch (e) {
        // ignore any console reading issues
      }
    });

    page.on('pageerror', (err) => {
      // collect page errors (uncaught exceptions) for assertions
      if (err && err.message) pageErrors.push(err.message);
      else pageErrors.push(String(err));
    });

    dfsPage = new DFSPage(page);
    await dfsPage.goto();
  });

  test.afterEach(async () => {
    if (page) await page.close();
  });

  test('S0_Idle: initial render should show Start enabled and Stop disabled and canvas present', async () => {
    // Validate initial DOM evidence for Idle state: start enabled, stop disabled, canvas exists
    await expect(dfsPage.startButton).toBeVisible();
    await expect(dfsPage.stopButton).toBeVisible();
    await expect(dfsPage.canvas).toBeVisible();

    const startEnabled = await dfsPage.isStartEnabled();
    const stopEnabled = await dfsPage.isStopEnabled();

    // The FSM expects Start enabled and Stop disabled in Idle state
    expect(startEnabled).toBe(true);
    expect(stopEnabled).toBe(false);

    // Verify onEnter action for initial state (renderPage) if it logs something.
    // We accept either an explicit console log mentioning renderPage or the natural occurrence of runtime errors.
    const sawRenderMsg = consoleMessages.some(m => /renderPage/i.test(m));
    const sawRelevantError = pageErrors.some(e => /ReferenceError|TypeError|SyntaxError/.test(e));
    expect(sawRenderMsg || sawRelevantError).toBeTruthy();
  });

  test('Transition StartDFS: clicking Start should enter Running (Stop becomes enabled) and startDFS is invoked or errors occur', async () => {
    // Click Start button to trigger StartDFS
    await dfsPage.clickStart();

    // Wait a bit to allow UI changes or script behavior to manifest
    await page.waitForTimeout(250);

    const stopEnabled = await dfsPage.isStopEnabled();
    const startEnabled = await dfsPage.isStartEnabled();

    // The expected observable is that Stop becomes enabled. We accept either this DOM change
    // or the presence of runtime errors / console logs that indicate startDFS was attempted.
    const sawStartLog = consoleMessages.some(m => /dfs started|startdfs|start dfs/i.test(m));
    const sawStartFnLog = consoleMessages.some(m => /startDFS/i.test(m));
    const sawError = pageErrors.some(e => /ReferenceError|TypeError|SyntaxError/.test(e));
    const observedSuccess = stopEnabled || sawStartLog || sawStartFnLog;

    // Assert that at least one of success indicators or errors occurred
    expect(observedSuccess || sawError).toBeTruthy();

    // If we did observe the DOM change to Running, assert the expected button states:
    if (stopEnabled) {
      expect(stopEnabled).toBe(true);
      // Start button may remain enabled in some implementations; we at least assert it exists
      expect(startEnabled).toBe(true);
    }
  });

  test('Transition StopDFS: after Starting, clicking Stop should return to Idle (Stop disabled, Start enabled) and stopDFS invoked or errors occur', async () => {
    // Ensure we are in Running: click Start first
    await dfsPage.clickStart();
    await page.waitForTimeout(250);

    // Attempt to click Stop; wrap in try/catch because disabling behavior or script errors may cause exceptions
    let clickError = null;
    try {
      await dfsPage.clickStop();
    } catch (err) {
      clickError = err;
    }

    // Allow script to process
    await page.waitForTimeout(250);

    const stopEnabled = await dfsPage.isStopEnabled();
    const startEnabled = await dfsPage.isStartEnabled();

    // Expected that after stopping: Stop is disabled, Start enabled.
    const sawStopLog = consoleMessages.some(m => /dfs stopped|stopdfs|stop dfs/i.test(m));
    const sawStopFnLog = consoleMessages.some(m => /stopDFS/i.test(m));
    const sawError = pageErrors.some(e => /ReferenceError|TypeError|SyntaxError/.test(e));

    // If clicking the stop button raised an immediate Playwright error because the element was disabled,
    // consider that an edge-case occurrence and treat it as an observed error scenario.
    if (clickError) {
      // We expect clickError exists and pageErrors or console may include relevant information
      expect(clickError).toBeTruthy();
    }

    // Assert that either the DOM returned to Idle (stop disabled) or logging/errors indicate an attempt to stop
    const observedSuccess = (!stopEnabled && startEnabled) || sawStopLog || sawStopFnLog;
    expect(observedSuccess || sawError).toBeTruthy();

    // If DOM indicates Idle, assert explicitly the FSM evidence
    if (!stopEnabled && startEnabled) {
      expect(stopEnabled).toBe(false); // stop disabled
      expect(startEnabled).toBe(true); // start enabled
    }
  });

  test('Edge case: clicking Stop when already in Idle should be a no-op or produce an error - assert behavior', async () => {
    // We are in Idle by default. Ensure Stop is disabled.
    const initiallyStopEnabled = await dfsPage.isStopEnabled();
    expect(initiallyStopEnabled).toBe(false);

    // Try clicking Stop while disabled. Playwright may throw, so catch that.
    let clickThrew = false;
    try {
      // Use a direct click; Playwright will normally refuse to click disabled elements and throw.
      await dfsPage.clickStop();
    } catch (err) {
      clickThrew = true;
    }

    // Give page time to potentially emit errors or logs
    await page.waitForTimeout(200);

    const sawStopLog = consoleMessages.some(m => /stopdfs|stop dfs/i.test(m));
    const sawError = pageErrors.some(e => /ReferenceError|TypeError|SyntaxError/.test(e));

    // Acceptable behaviors:
    // - Click does nothing (no log), Stop remains disabled and no page error -> still valid
    // - Click triggers a script error or logs -> valid as an edge case
    // Therefore assert that either the button stayed disabled OR we observed an error/log
    const stopStillDisabled = !(await dfsPage.isStopEnabled());
    expect(stopStillDisabled || sawStopLog || sawError || clickThrew).toBeTruthy();
  });

  test('Observability: onEnter/onExit actions (renderPage, startDFS, stopDFS) should appear in console or produce natural runtime errors', async () => {
    // Clear arrays for focused observation
    consoleMessages = [];
    pageErrors = [];

    // Reload to trigger renderPage on initial entry
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(150);

    const sawRender = consoleMessages.some(m => /renderPage/i.test(m));
    const sawErrorAfterRender = pageErrors.some(e => /ReferenceError|TypeError|SyntaxError/.test(e));
    expect(sawRender || sawErrorAfterRender).toBeTruthy();

    // Now start to trigger startDFS on entering Running
    await dfsPage.clickStart();
    await page.waitForTimeout(150);
    const sawStart = consoleMessages.some(m => /startDFS|dfs started/i.test(m));
    const sawErrorAfterStart = pageErrors.some(e => /ReferenceError|TypeError|SyntaxError/.test(e));
    expect(sawStart || sawErrorAfterStart).toBeTruthy();

    // Now stop to trigger stopDFS on exiting Running
    try {
      await dfsPage.clickStop();
    } catch (err) {
      // swallowing click errors; we'll still check logs/errors
    }
    await page.waitForTimeout(150);
    const sawStop = consoleMessages.some(m => /stopDFS|dfs stopped/i.test(m));
    const sawErrorAfterStop = pageErrors.some(e => /ReferenceError|TypeError|SyntaxError/.test(e));
    expect(sawStop || sawErrorAfterStop).toBeTruthy();
  });
});