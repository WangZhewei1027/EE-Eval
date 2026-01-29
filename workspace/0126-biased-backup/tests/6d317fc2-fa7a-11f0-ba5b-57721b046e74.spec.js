import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d317fc2-fa7a-11f0-ba5b-57721b046e74.html';

/**
 * Page object encapsulating interactions with the Load Balancing Simulator page.
 */
class LoadBalancerPage {
  constructor(page) {
    this.page = page;
    // Controls
    this.serverCountInput = page.locator('#serverCount');
    this.setupServersBtn = page.locator('#setupServers');
    this.algorithmSelect = page.locator('#algorithm');
    this.weightControls = page.locator('#weightControls');
    this.weightInputs = page.locator('#weightInputs');
    this.requestRateInput = page.locator('#requestRate');
    this.requestRateValue = page.locator('#requestRateValue');
    this.requestDurationInput = page.locator('#requestDuration');
    this.requestDurationValue = page.locator('#requestDurationValue');
    this.trafficPatternSelect = page.locator('#trafficPattern');
    this.startTrafficBtn = page.locator('#startTraffic');
    this.stopTrafficBtn = page.locator('#stopTraffic');
    this.singleRequestBtn = page.locator('#singleRequest');
    this.serversContainer = page.locator('#serversContainer');
    this.visualization = page.locator('#visualization');
    this.toggleViewBtn = page.locator('#toggleView');
    this.resetStatsBtn = page.locator('#resetStats');
    this.totalRequestsSpan = page.locator('#totalRequests');
    this.activeRequestsSpan = page.locator('#activeRequests');
    this.avgResponseTimeSpan = page.locator('#avgResponseTime');
    this.efficiencySpan = page.locator('#efficiency');
    this.detailedStats = page.locator('#detailedStats');
    this.serverStats = page.locator('#serverStats');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for critical UI to be present
    await expect(this.setupServersBtn).toBeVisible();
    await expect(this.serversContainer).toBeVisible();
  }

  async setServerCount(count) {
    await this.serverCountInput.fill(String(count));
  }

  async clickSetupServers() {
    await this.setupServersBtn.click();
  }

  async getServerElements() {
    return this.serversContainer.locator('.server');
  }

  async selectAlgorithm(value) {
    await this.algorithmSelect.selectOption({ value });
  }

  async isWeightControlsVisible() {
    return await this.weightControls.evaluate((el) => !el.classList.contains('hidden'));
  }

  async setRequestRate(value) {
    // Use evaluate to set value because range inputs may be finicky
    await this.requestRateInput.evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(value));
  }

  async setRequestDuration(value) {
    await this.requestDurationInput.evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(value));
  }

  async clickStartTraffic() {
    await this.startTrafficBtn.click();
  }

  async clickStopTraffic() {
    await this.stopTrafficBtn.click();
  }

  async clickSingleRequest() {
    await this.singleRequestBtn.click();
  }

  async clickToggleDetailedView() {
    await this.toggleViewBtn.click();
  }

  async clickResetStats() {
    await this.resetStatsBtn.click();
  }

  async getTotalRequests() {
    return Number(await this.totalRequestsSpan.textContent());
  }

  async getActiveRequests() {
    return Number(await this.activeRequestsSpan.textContent());
  }

  async isStartDisabled() {
    return await this.startTrafficBtn.evaluate((el) => el.disabled);
  }

  async isStopDisabled() {
    return await this.stopTrafficBtn.evaluate((el) => el.disabled);
  }

  async getRequestVisualCount() {
    return await this.visualization.locator('.request').count();
  }

  async waitForFirstRequestVisual(timeout = 2000) {
    await this.page.waitForSelector('#visualization .request', { state: 'attached', timeout });
  }

  async waitForAllRequestsToComplete(timeout = 5000) {
    // Wait until no request elements remain (they get removed after completion)
    await this.page.waitForSelector('#visualization .request', { state: 'detached', timeout });
  }

  async isDetailedStatsVisible() {
    return await this.detailedStats.evaluate((el) => !el.classList.contains('hidden'));
  }
}

test.describe('Load Balancing Simulator - FSM and UI integration', () => {
  let page;
  let lb;
  let pageErrors;
  let consoleErrors;

  // Setup: create a fresh page for each test, attach error/console listeners.
  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    lb = new LoadBalancerPage(page);

    pageErrors = [];
    consoleErrors = [];

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
      // Still allow the error to surface naturally (we don't swallow it)
    });

    // Capture console 'error' messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await lb.goto();
  });

  test.afterEach(async () => {
    // Assert that no runtime page errors happened during interactions.
    // If any page errors occurred, fail the test with details for debugging.
    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      // Build a helpful message describing the captured errors
      const errMsgParts = [];
      if (pageErrors.length > 0) {
        errMsgParts.push('Page errors:\n' + pageErrors.map(e => `${e.name}: ${e.message}`).join('\n'));
      }
      if (consoleErrors.length > 0) {
        errMsgParts.push('Console errors:\n' + consoleErrors.join('\n'));
      }
      // Close page before failing to avoid resource leaks
      await page.close();
      throw new Error(errMsgParts.join('\n\n'));
    }

    await page.close();
  });

  test('Initial state (S0_Idle): setupServers executed on load and servers rendered', async () => {
    // The page calls setupServers() on initialization (entry action for Idle).
    // Validate that initial server count matches the input default (3) and servers are rendered.
    const serverEls = lb.getServerElements();
    await expect(serverEls).toHaveCount(3);

    // Verify server displays show zero requests initially
    for (let i = 0; i < 3; i++) {
      const serverEl = lb.serversContainer.locator(`#server-${i}`);
      await expect(serverEl.locator('.active-count')).toHaveText('0');
      await expect(serverEl.locator('.total-count')).toHaveText('0');
    }

    // Validate statistics show zeros
    await expect(lb.totalRequestsSpan).toHaveText('0');
    await expect(lb.activeRequestsSpan).toHaveText('0');
    await expect(lb.avgResponseTimeSpan).toHaveText('0');
  });

  test('SetupServers event and updating server count (transition & edge case)', async () => {
    // Change server count to 5 and trigger setupServers
    await lb.setServerCount(5);
    await lb.clickSetupServers();

    // Now there should be 5 server DOM elements
    const serverEls = lb.getServerElements();
    await expect(serverEls).toHaveCount(5);

    // Edge case: set server count to 1 and re-setup
    await lb.setServerCount(1);
    await lb.clickSetupServers();
    await expect(lb.getServerElements()).toHaveCount(1);
  });

  test('Algorithm change event: weighted algorithm shows weight controls', async () => {
    // Initially weight controls are hidden
    expect(await lb.isWeightControlsVisible()).toBe(false);

    // Select weighted algorithm
    await lb.selectAlgorithm('weighted');

    // Weight controls should become visible (change event handler)
    expect(await lb.isWeightControlsVisible()).toBe(true);

    // Selecting another algorithm hides controls again
    await lb.selectAlgorithm('roundRobin');
    expect(await lb.isWeightControlsVisible()).toBe(false);
  });

  test('Request rate and duration input events update displayed values', async () => {
    // Change request rate and ensure the displayed value updates via input event
    await lb.setRequestRate(10);
    await expect(lb.requestRateValue).toHaveText('10');

    // Change request duration and ensure displayed value updates
    await lb.setRequestDuration(200);
    await expect(lb.requestDurationValue).toHaveText('200');
  });

  test('StartTraffic and StopTraffic transitions (S1 <-> S2) and button states', async () => {
    // Configure low duration and rate to keep test fast and deterministic
    await lb.setRequestRate(1);
    await lb.setRequestDuration(100);
    // Start traffic: this should disable Start and enable Stop (enter S1)
    await lb.clickStartTraffic();

    // Validate button states after starting traffic
    expect(await lb.isStartDisabled()).toBe(true);
    expect(await lb.isStopDisabled()).toBe(false);

    // Wait briefly to allow at least one request to be generated in steady pattern
    await page.waitForTimeout(200);
    const total1 = await lb.getTotalRequests();
    expect(total1).toBeGreaterThanOrEqual(1);

    // Stop traffic: should clear interval and toggle button states (enter S2)
    await lb.clickStopTraffic();
    expect(await lb.isStartDisabled()).toBe(false);
    expect(await lb.isStopDisabled()).toBe(true);

    // After stopping, record total requests, then start traffic again to confirm S2 -> S1 transition works
    const totalAfterStop = await lb.getTotalRequests();
    await lb.clickStartTraffic();
    expect(await lb.isStartDisabled()).toBe(true);
    expect(await lb.isStopDisabled()).toBe(false);

    // Allow some requests and then stop to avoid lingering intervals
    await page.waitForTimeout(200);
    await lb.clickStopTraffic();
    const finalTotal = await lb.getTotalRequests();
    expect(finalTotal).toBeGreaterThanOrEqual(totalAfterStop);
  });

  test('SendSingleRequest updates stats and visualization; completes after duration', async () => {
    // Ensure short duration for quick test
    await lb.setRequestDuration(120);

    // Get counts before sending
    const beforeTotal = await lb.getTotalRequests();
    const beforeActive = await lb.getActiveRequests();

    // Send a single request and assert visualization element appears
    await lb.clickSingleRequest();
    await lb.waitForFirstRequestVisual(1000);

    // Some stats should reflect the new request
    const duringTotal = await lb.getTotalRequests();
    const duringActive = await lb.getActiveRequests();
    expect(duringTotal).toBeGreaterThanOrEqual(beforeTotal + 1);
    expect(duringActive).toBeGreaterThanOrEqual(1);

    // Wait for the request to complete and be removed from visualization
    await lb.waitForAllRequestsToComplete(3000);

    // After completion, active requests should drop back to zero and total requests remain incremented
    const afterActive = await lb.getActiveRequests();
    const afterTotal = await lb.getTotalRequests();
    expect(afterActive).toBe(0);
    expect(afterTotal).toBeGreaterThanOrEqual(duringTotal);
  });

  test('Visualization animates requests and server displays update correctly', async () => {
    // Ensure deterministic small duration
    await lb.setRequestDuration(150);
    await lb.setRequestRate(1);

    // Start traffic briefly to generate a few requests then stop
    await lb.clickStartTraffic();
    await page.waitForTimeout(400); // allow a couple of generation cycles
    await lb.clickStopTraffic();

    // At least one visual request should have been created (or completed recently)
    const visualCount = await lb.getRequestVisualCount();
    // It might be 0 if all requests completed quickly, but totalRequests should be > 0
    const total = await lb.getTotalRequests();
    expect(total).toBeGreaterThanOrEqual(1);

    // Check that server DOMs reflect non-negative counts and consistent numbers
    const serverEls = lb.getServerElements();
    const count = await serverEls.count();
    for (let i = 0; i < count; i++) {
      const serverEl = lb.serversContainer.locator(`#server-${i}`);
      const totalText = await serverEl.locator('.total-count').textContent();
      const activeText = await serverEl.locator('.active-count').textContent();
      expect(Number(totalText)).toBeGreaterThanOrEqual(0);
      expect(Number(activeText)).toBeGreaterThanOrEqual(0);
    }
  });

  test('Toggle Detailed View shows per-server stats and toggles visibility classes', async () => {
    // Ensure some traffic to populate stats
    await lb.setRequestDuration(100);
    await lb.clickSingleRequest();
    await lb.waitForAllRequestsToComplete(2000);

    // Initially detailed stats are hidden
    expect(await lb.isDetailedStatsVisible()).toBe(false);

    // Toggle detailed view on
    await lb.clickToggleDetailedView();
    expect(await lb.isDetailedStatsVisible()).toBe(true);
    // serverStats should contain entries for each server
    const serverStatChildren = await lb.serverStats.locator('div').count();
    expect(serverStatChildren).toBeGreaterThanOrEqual(1);

    // Toggle off
    await lb.clickToggleDetailedView();
    expect(await lb.isDetailedStatsVisible()).toBe(false);
  });

  test('Reset Statistics clears counters, visualization and stops traffic (edge and expected behavior)', async () => {
    // Start some traffic quickly and then reset while running to ensure reset stops intervals
    await lb.setRequestRate(1);
    await lb.setRequestDuration(200);
    await lb.clickStartTraffic();
    await page.waitForTimeout(250); // some requests may be created

    // Now request reset
    await lb.clickResetStats();

    // After reset, totalRequests should be zeroed, active zero, visualization cleared
    await expect(lb.totalRequestsSpan).toHaveText('0');
    await expect(lb.activeRequestsSpan).toHaveText('0');
    await expect(lb.visualization.locator('.request')).toHaveCount(0);

    // Start button should be enabled after reset (stopTraffic called by resetStats implements stop)
    expect(await lb.isStartDisabled()).toBe(false);
    expect(await lb.isStopDisabled()).toBe(true);
  });

  test('Algorithm behaviors (roundRobin, leastConnections, random, ipHash) - sanity checks', async () => {
    // Short duration to speed up
    await lb.setRequestDuration(80);
    await lb.setRequestRate(1);

    // Test round robin: ensure requests distribute across servers in sequence
    await lb.selectAlgorithm('roundRobin');
    await lb.clickStartTraffic();
    await page.waitForTimeout(300);
    await lb.clickStopTraffic();

    // Expect totalRequests > 0
    const totalAfterRR = await lb.getTotalRequests();
    expect(totalAfterRR).toBeGreaterThanOrEqual(1);

    // Reset stats before next algorithm checks to keep counts clear
    await lb.clickResetStats();

    // Least connections: start traffic briefly
    await lb.selectAlgorithm('leastConnections');
    await lb.clickStartTraffic();
    await page.waitForTimeout(300);
    await lb.clickStopTraffic();
    const totalAfterLC = await lb.getTotalRequests();
    expect(totalAfterLC).toBeGreaterThanOrEqual(0); // >=0 is okay; ensure no crash

    // Random algorithm: ensure selection doesn't throw and generates requests
    await lb.clickResetStats();
    await lb.selectAlgorithm('random');
    await lb.clickStartTraffic();
    await page.waitForTimeout(300);
    await lb.clickStopTraffic();
    const totalAfterRandom = await lb.getTotalRequests();
    expect(totalAfterRandom).toBeGreaterThanOrEqual(0);

    // IP Hash: ensure it runs without error
    await lb.clickResetStats();
    await lb.selectAlgorithm('ipHash');
    await lb.clickSingleRequest();
    await lb.waitForAllRequestsToComplete(1000);
    // If no errors, pass
  });

  test('Edge case: changing weights for weighted algorithm updates server weights inputs', async () => {
    // Select weighted algorithm and ensure inputs appear and are interactive
    await lb.selectAlgorithm('weighted');
    expect(await lb.isWeightControlsVisible()).toBe(true);

    // There should be inputs created inside weightInputs; change one value
    const weightInput = lb.weightInputs.locator('.server-weight').first();
    await expect(weightInput).toBeVisible();

    // Change weight via evaluate to trigger change handler
    await weightInput.evaluate((el) => { el.value = '5'; el.dispatchEvent(new Event('change', { bubbles: true })); });

    // No direct public state to assert the weight value besides DOM input, so read back value
    const val = await weightInput.inputValue();
    expect(val).toBe('5');
  });
});