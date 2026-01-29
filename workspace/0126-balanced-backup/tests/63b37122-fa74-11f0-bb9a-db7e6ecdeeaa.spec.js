import { test, expect } from '@playwright/test';

const APP_URL =
  'http://127.0.0.1:5500/workspace/0126-balanced/html/63b37122-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for the congestion control demo page
class CongestionControlPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.pauseBtn = page.locator('#pauseBtn');
    this.resetBtn = page.locator('#resetBtn');

    this.sendRateEl = page.locator('#sendRate');
    this.queueSizeEl = page.locator('#queueSize');
    this.packetsSentEl = page.locator('#packetsSent');
    this.packetsReceivedEl = page.locator('#packetsReceived');
    this.packetsDroppedEl = page.locator('#packetsDropped');
    this.currentStateEl = page.locator('#currentState');

    // Explanatory text container - used to assert presence of state labels
    this.explanation = page.locator('#explanation');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickPause() {
    await this.pauseBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async getButtonStates() {
    return {
      startDisabled: await this.startBtn.isDisabled(),
      pauseDisabled: await this.pauseBtn.isDisabled(),
      resetDisabled: await this.resetBtn.isDisabled()
    };
  }

  async getStats() {
    const sendRateText = await this.sendRateEl.textContent();
    const queueSizeText = await this.queueSizeEl.textContent();
    const packetsSentText = await this.packetsSentEl.textContent();
    const packetsReceivedText = await this.packetsReceivedEl.textContent();
    const packetsDroppedText = await this.packetsDroppedEl.textContent();
    const currentStateText = await this.currentStateEl.textContent();

    return {
      sendRate: sendRateText?.trim(),
      queueSize: queueSizeText?.trim(),
      packetsSent: packetsSentText?.trim(),
      packetsReceived: packetsReceivedText?.trim(),
      packetsDropped: packetsDroppedText?.trim(),
      currentState: currentStateText?.trim()
    };
  }

  async explanationText() {
    return (await this.explanation.textContent()) || '';
  }
}

test.describe('Congestion Control Demonstration - UI and FSM interactions', () => {
  // Collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (info, warn, error, etc.)
    page.on('console', (msg) => {
      // store all console messages for diagnostics and assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Basic sanity: tests will assert conditions themselves, but we keep this hook to enable cleanup if needed
  });

  test('Initial state and controls are rendered correctly', async ({ page }) => {
    // Purpose: Validate initial UI state corresponds to the expected "Slow Start" initial state
    const cc = new CongestionControlPage(page);
    await cc.goto();

    // Validate the key controls are present and have expected disabled state
    const buttons = await cc.getButtonStates();
    // Start should be enabled at page load; Pause and Reset should be disabled per HTML initial attributes
    expect(buttons.startDisabled).toBeFalsy();
    expect(buttons.pauseDisabled).toBeTruthy();
    expect(buttons.resetDisabled).toBeTruthy();

    // Validate initial stats and current state text
    const stats = await cc.getStats();
    // sendRate is displayed with two decimals via toFixed(2)
    expect(stats.sendRate).toBe('1.00');
    expect(stats.queueSize).toBe('0');
    expect(stats.packetsSent).toBe('0');
    expect(stats.packetsReceived).toBe('0');
    expect(stats.packetsDropped).toBe('0');
    expect(stats.currentState).toBe('Slow Start');

    // Verify that the explanatory text contains labels for all FSM states (ensures the concept is visible)
    const explanationText = await cc.explanationText();
    expect(explanationText).toContain('Slow Start');
    expect(explanationText).toContain('Congestion Avoidance');
    expect(explanationText).toContain('Fast Recovery');

    // Assert no page errors or console severe messages produced during initial load
    // We allow informational console logs, but no page errors (uncaught exceptions)
    expect(pageErrors.length).toBe(0);
    // Check for any console error messages
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('StartSimulation event: clicking Start begins simulation and updates stats and controls', async ({ page }) => {
    // Purpose: Test Start button triggers simulation start (isRunning true) and UI updates
    const cc = new CongestionControlPage(page);
    await cc.goto();

    // Click Start
    await cc.clickStart();

    // After starting, Start button should be disabled, Pause and Reset enabled
    const buttonsAfterStart = await cc.getButtonStates();
    expect(buttonsAfterStart.startDisabled).toBeTruthy();
    expect(buttonsAfterStart.pauseDisabled).toBeFalsy();
    expect(buttonsAfterStart.resetDisabled).toBeFalsy();

    // Give the simulation a moment to produce at least one packet (sender generates slowly; wait ~1500ms)
    await page.waitForTimeout(1500);

    const statsAfterRun = await cc.getStats();
    // After running, some packetsSent or packetsReceived should have increased from 0.
    // We accept either metric increasing; in this simulation packetsSent increments when packets move to router.
    const sent = parseInt(statsAfterRun.packetsSent, 10);
    const received = parseInt(statsAfterRun.packetsReceived, 10);

    expect(
      sent > 0 || received > 0,
      `Expected some progress (packetsSent or packetsReceived > 0) but got sent=${sent}, received=${received}`
    ).toBeTruthy();

    // sendRate should remain a number string with two decimals
    expect(statsAfterRun.sendRate).toMatch(/^\d+\.\d{2}$/);

    // Assert still no uncaught errors or console.error messages from running the simulation
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('PauseSimulation event: clicking Pause stops simulation updates', async ({ page }) => {
    // Purpose: Clicking Pause should stop the running simulation and freeze stats
    const cc = new CongestionControlPage(page);
    await cc.goto();

    // Start, wait, then Pause
    await cc.clickStart();
    await page.waitForTimeout(1200); // allow some activity
    // Record stats at pause time
    const statsBeforePause = await cc.getStats();
    const sentBefore = parseInt(statsBeforePause.packetsSent, 10);
    const recvBefore = parseInt(statsBeforePause.packetsReceived, 10);

    // Click Pause
    await cc.clickPause();

    // Buttons should be updated: Start enabled, Pause disabled, Reset enabled
    const buttonsAfterPause = await cc.getButtonStates();
    expect(buttonsAfterPause.startDisabled).toBeFalsy();
    expect(buttonsAfterPause.pauseDisabled).toBeTruthy();
    expect(buttonsAfterPause.resetDisabled).toBeFalsy();

    // Wait some time to ensure no further simulation progression happens
    await page.waitForTimeout(800);

    const statsAfterPause = await cc.getStats();
    const sentAfter = parseInt(statsAfterPause.packetsSent, 10);
    const recvAfter = parseInt(statsAfterPause.packetsReceived, 10);

    // Ensure counts did not advance while paused
    expect(sentAfter).toBe(sentBefore);
    expect(recvAfter).toBe(recvBefore);

    // Assert no uncaught errors or console.error messages
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('ResetSimulation event: clicking Reset clears buffers and returns to initial state', async ({ page }) => {
    // Purpose: Validate Reset returns UI and stats to initial baseline regardless of prior activity
    const cc = new CongestionControlPage(page);
    await cc.goto();

    // Start and run briefly to change state
    await cc.clickStart();
    await page.waitForTimeout(1200);
    // Pause to stabilize counts
    await cc.clickPause();

    // Ensure reset button is enabled now
    const buttonsBeforeReset = await cc.getButtonStates();
    expect(buttonsBeforeReset.resetDisabled).toBeFalsy();

    // Click Reset
    await cc.clickReset();

    // After reset, confirm that counters and states are back to defaults
    const statsAfterReset = await cc.getStats();
    expect(statsAfterReset.sendRate).toBe('1.00');
    expect(statsAfterReset.queueSize).toBe('0');
    expect(statsAfterReset.packetsSent).toBe('0');
    expect(statsAfterReset.packetsReceived).toBe('0');
    expect(statsAfterReset.packetsDropped).toBe('0');
    expect(statsAfterReset.currentState).toBe('Slow Start');

    // Buttons after reset: Start enabled, Pause disabled, Reset disabled
    const buttonsAfterReset = await cc.getButtonStates();
    expect(buttonsAfterReset.startDisabled).toBeFalsy();
    expect(buttonsAfterReset.pauseDisabled).toBeTruthy();
    expect(buttonsAfterReset.resetDisabled).toBeTruthy();

    // Assert no uncaught exceptions or console.errors during reset
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge cases: repeated clicks and disabled control behavior', async ({ page }) => {
    // Purpose: Ensure interacting with buttons in unexpected ways does not throw and UI honors disabled states
    const cc = new CongestionControlPage(page);
    await cc.goto();

    // Clicking Pause when disabled should not change anything and should not cause errors
    expect(await cc.pauseBtn.isDisabled()).toBeTruthy();
    await cc.pauseBtn.click({ force: true }).catch(() => {
      // Some browsers throw when clicking disabled elements via force; we only ensure no page errors occurred
    });

    // Still paused and not started
    let stats = await cc.getStats();
    expect(stats.currentState).toBe('Slow Start');

    // Start simulation
    await cc.clickStart();
    await page.waitForTimeout(500);

    // Clicking Start again while it's disabled should have no effect; try to click but ignore errors
    await cc.startBtn.click({ force: true }).catch(() => {});

    // Ensure simulation still running by checking that Pause is enabled and Start is disabled
    const buttonsWhileRunning = await cc.getButtonStates();
    expect(buttonsWhileRunning.startDisabled).toBeTruthy();
    expect(buttonsWhileRunning.pauseDisabled).toBeFalsy();

    // Pause simulation then click Pause again (no-op)
    await cc.clickPause();
    await page.waitForTimeout(200);
    await cc.clickPause().catch(() => {});

    // Reset while paused should clear simulation; call reset twice to ensure idempotence
    await cc.clickReset();
    await cc.clickReset().catch(() => {});

    // Final stats should be reset
    stats = await cc.getStats();
    expect(stats.packetsSent).toBe('0');
    expect(stats.packetsReceived).toBe('0');

    // Validate that no uncaught exceptions or console.error messages were emitted during these edge interactions
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('FSM state label presence and sanity checks (Slow Start, Congestion Avoidance, Fast Recovery)', async ({ page }) => {
    // Purpose: Although the underlying JS implements transitions internally, ensure the UI and explanatory text exposes the three conceptual FSM states.
    // We validate that the labels are present, and that the UI's currentState element uses one of the expected labels.
    const cc = new CongestionControlPage(page);
    await cc.goto();

    const explanationText = await cc.explanationText();
    // Confirm the three major FSM state labels exist somewhere descriptive in the page
    expect(explanationText).toContain('Slow Start');
    expect(explanationText).toContain('Congestion Avoidance');
    expect(explanationText).toContain('Fast Recovery');

    // The currentState element should contain one of these states (initially Slow Start)
    const stats = await cc.getStats();
    const validStates = ['Slow Start', 'Congestion Avoidance', 'Fast Recovery'];
    expect(validStates).toContain(stats.currentState);

    // Assert there were no page errors during these sanity checks
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});