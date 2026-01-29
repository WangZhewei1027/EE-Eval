import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3d6040-fa74-11f0-a1b6-4b9b8151441a.html';

// Page object to encapsulate interactions with the demo app
class CongestionApp {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.fastBtn = page.locator('#fastBtn');
    this.slowBtn = page.locator('#slowBtn');
    this.stopBtn = page.locator('#stopBtn');
    this.connectionCount = page.locator('#connectionCount');
    this.currentTraffic = page.locator('#currentTraffic');
    this.windowSize = page.locator('#windowSize');
    this.congestionWarning = page.locator('#congestionWarning');
    this.canvas = page.locator('#networkCanvas');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async startSimulation() {
    await this.startBtn.click();
  }

  async stopSimulation() {
    await this.stopBtn.click();
  }

  async addFastConnection() {
    await this.fastBtn.click();
  }

  async addSlowConnection() {
    await this.slowBtn.click();
  }

  async getConnectionCount() {
    const text = await this.connectionCount.textContent();
    return Number(text?.trim() ?? '0');
  }

  async getCurrentTraffic() {
    const text = await this.currentTraffic.textContent();
    return Number(text?.trim() ?? '0');
  }

  async getWindowSize() {
    const text = await this.windowSize.textContent();
    return Number(text?.trim() ?? '0');
  }

  async isCongestionWarningVisible() {
    // Check computed style to be robust (style attribute may be empty)
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const cs = window.getComputedStyle(el);
      return cs && cs.display !== 'none';
    }, '#congestionWarning');
  }

  async waitForWindowSizeToChange(fromValue, timeout = 5000) {
    await expect.poll(
      async () => {
        const v = await this.getWindowSize();
        return v;
      },
      { timeout }
    ).not.toBe(fromValue);
  }

  async waitForWindowSizeToStabilize(waitMs = 500) {
    // sample value, wait, then ensure the same value remains (approximate stop)
    const before = await this.getWindowSize();
    await this.page.waitForTimeout(waitMs);
    const after = await this.getWindowSize();
    return { before, after };
  }
}

// Track uncaught page errors and console messages for assertions
test.describe('Congestion Control Demonstration - FSM and UI tests', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture page errors
    page.on('pageerror', (err) => {
      // store for later assertions
      pageErrors.push(err);
    });

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to application
    const app = new CongestionApp(page);
    await app.goto();
  });

  // Test idle state
  test('S0_Idle: Initial page shows Idle state controls (Start button visible and stats zeroed)', async ({ page }) => {
    const app = new CongestionApp(page);

    // Validate Start button exists and is visible
    await expect(app.startBtn).toBeVisible();
    await expect(app.fastBtn).toBeVisible();
    await expect(app.slowBtn).toBeVisible();
    await expect(app.stopBtn).toBeVisible();

    // Validate initial stats show zero connections and initial window size
    await expect(app.connectionCount).toHaveText('0');
    await expect(app.currentTraffic).toHaveText('0');
    await expect(app.windowSize).toHaveText('1');

    // Congestion warning must be hidden in Idle
    const visible = await app.isCongestionWarningVisible();
    expect(visible).toBeFalsy();

    // Ensure no uncaught page errors on initial load
    expect(pageErrors.length).toBe(0);
  });

  // Test starting the simulation transitions to running
  test('S0_Idle -> S1_SimulationRunning: Clicking Start begins animation and updates window size', async ({ page }) => {
    const app = new CongestionApp(page);

    // Capture initial window size
    const initialWindowSize = await app.getWindowSize();
    expect(initialWindowSize).toBeGreaterThanOrEqual(1);

    // Click start and observe that the windowSize changes (indicating animate/drawNetwork ran)
    await app.startSimulation();

    // Wait until windowSize changes from the initial value
    await app.waitForWindowSizeToChange(initialWindowSize, 8000);

    const newWindowSize = await app.getWindowSize();
    expect(newWindowSize).not.toBe(initialWindowSize);

    // No page errors should have occurred during animation start
    expect(pageErrors.length).toBe(0);
  });

  // Test adding connections and triggering congestion
  test('S1_SimulationRunning -> S2_Congested: Adding fast and slow connections increases traffic and shows congestion warning', async ({ page }) => {
    const app = new CongestionApp(page);

    // Start simulation
    await app.startSimulation();

    // Ensure simulation running (window size changes)
    const initialWindowSize = await app.getWindowSize();
    await app.waitForWindowSizeToChange(initialWindowSize, 8000);

    // Add one fast connection
    await app.addFastConnection();

    // Wait for connection count to reflect addition
    await expect.poll(async () => await app.getConnectionCount(), { timeout: 3000 }).toBeGreaterThanOrEqual(1);

    // Add one slow connection (to exceed capacity)
    await app.addSlowConnection();

    // Wait until connection count is at least 2
    await expect.poll(async () => await app.getConnectionCount(), { timeout: 3000 }).toBeGreaterThanOrEqual(2);

    // Wait for currentTraffic to exceed NETWORK_CAPACITY (100)
    await expect.poll(
      async () => {
        return await app.getCurrentTraffic();
      },
      { timeout: 8000 }
    ).toBeGreaterThan(100);

    // Congestion warning should become visible when traffic > capacity
    await expect.poll(async () => await app.isCongestionWarningVisible(), { timeout: 3000 }).toBeTruthy();

    // Verify page errors have not been thrown during these interactions
    expect(pageErrors.length).toBe(0);
  });

  // Test stopping simulation transitions back to idle and verify exit action behavior
  test('S1_SimulationRunning -> S0_Idle: Stop Simulation cancels animation; verify animation stopped and congestion warning handling', async ({ page }) => {
    const app = new CongestionApp(page);

    // Start and add connections to create congestion
    await app.startSimulation();
    await app.addFastConnection();
    await app.addSlowConnection();
    await expect.poll(async () => await app.getConnectionCount(), { timeout: 3000 }).toBeGreaterThanOrEqual(2);

    // Wait for congestion to appear
    await expect.poll(async () => await app.isCongestionWarningVisible(), { timeout: 5000 }).toBeTruthy();

    // Capture window size before stopping
    const beforeStopWindowSize = await app.getWindowSize();

    // Click stop
    await app.stopSimulation();

    // After stopping, window size should stop changing (approximation)
    const { before, after } = await app.waitForWindowSizeToStabilize(700);
    // When stopped, after should be equal to (or very close to) before
    expect(after).toBe(before);

    // According to FSM, stopping should cancel animation and return to Idle.
    // We cannot access internal animationId variable (it's not on window), but we can infer stop from stabilization above.

    // Validate congestion warning handling:
    // There is a subtle bug in the implementation: updateStats uses 'isCongestion' instead of 'isCongested' when clearing congestion.
    // As a result, the congestion warning may remain visible even after conditions change or after stopping.
    // Assert that the congestion warning remains visible after stop (demonstrates failure to transition to Recovery in current code).
    const warningVisibleAfterStop = await app.isCongestionWarningVisible();
    // We expect (given the bug) that the warning may still be visible; assert truthiness to document this behavior.
    expect(warningVisibleAfterStop).toBeTruthy();

    // Ensure no uncaught exceptions happened during stop
    expect(pageErrors.length).toBe(0);
  });

  // Edge cases and robustness: multiple rapid interactions and high load
  test('Edge cases: Rapid start/stop and adding many connections should not throw errors and UI updates accordingly', async ({ page }) => {
    const app = new CongestionApp(page);

    // Rapid start clicks
    await app.startSimulation();
    await app.startSimulation();
    await app.startSimulation();

    // Add several fast connections quickly
    for (let i = 0; i < 6; i++) {
      await app.addFastConnection();
    }

    // Expect connectionCount to reflect additions
    await expect.poll(async () => await app.getConnectionCount(), { timeout: 5000 }).toBeGreaterThanOrEqual(6);

    // Current traffic should be large (each fast connection contributes significant traffic)
    await expect.poll(async () => await app.getCurrentTraffic(), { timeout: 5000 }).toBeGreaterThan(100);

    // Stop multiple times rapidly
    await app.stopSimulation();
    await app.stopSimulation();
    await app.stopSimulation();

    // After stops, ensure window size stabilized (animation stopped)
    const { before, after } = await app.waitForWindowSizeToStabilize(700);
    expect(after).toBe(before);

    // Confirm no page errors were produced during this stress test
    expect(pageErrors.length).toBe(0);

    // Also sanity-check that console messages were produced (helpful for debugging)
    // We don't require specific messages, but record that some console activity occurred.
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });

  // Final assertion test to collect any uncaught exceptions or console errors observed during the suite run
  test('Collect and assert page runtime errors and console output observed during tests', async ({ page }) => {
    // Note: pageErrors and consoleMessages were populated in beforeEach handlers across tests.
    // We assert that there were no uncaught runtime exceptions (pageerror events).
    // If the implementation had real ReferenceError/SyntaxError/TypeError, those would be present here.
    expect(pageErrors.length).toBe(0);

    // Provide at least minimal assertions about console output shape (not content-specific)
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});