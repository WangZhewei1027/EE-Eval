import { test, expect } from '@playwright/test';

// Test file: de3d6041-fa74-11f0-a1b6-4b9b8151441a.spec.js
// Application URL (served externally as specified)
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3d6041-fa74-11f0-a1b6-4b9b8151441a.html';

// Simple Page Object Model for the Load Balancing Simulation page
class LoadBalancerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.addRequest = page.locator('#addRequest');
    this.addMultiple = page.locator('#addMultiple');
    this.reset = page.locator('#reset');
    this.algorithm = page.locator('#algorithm');
    this.serverContainer = page.locator('#serverContainer');
    this.totalRequests = page.locator('#totalRequests');
    this.requestsPerServer = page.locator('#requestsPerServer');
    this.serverSelector = (index) => this.page.locator(`#server${index}`);
    this.serverRequestsContainer = (index) =>
      this.page.locator(`#server${index} .requests-container`);
  }

  // Click helper functions
  async clickAddRequest() {
    await this.addRequest.click();
  }

  async clickAddMultiple() {
    await this.addMultiple.click();
  }

  async clickReset() {
    await this.reset.click();
  }

  async changeAlgorithm(value) {
    await this.algorithm.selectOption(value);
    // sometimes change handlers run synchronously; small wait to ensure handlers executed
    await this.page.waitForTimeout(50);
  }

  // Utility to get server request counts by reading DOM
  async getRequestsPerServerText() {
    return (await this.requestsPerServer.textContent()).trim();
  }

  async getTotalRequestsText() {
    return (await this.totalRequests.textContent()).trim();
  }

  // Count .server elements
  async getServerCount() {
    return await this.serverContainer.locator('.server').count();
  }

  // Count requests inside a specific server
  async countRequestsInServer(index) {
    return await this.serverRequestsContainer(index).locator('.request').count();
  }

  // Get texts of request elements in a server
  async getRequestTextsInServer(index) {
    const elements = this.serverRequestsContainer(index).locator('.request');
    const count = await elements.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await elements.nth(i).textContent()).trim());
    }
    return texts;
  }
}

test.describe('Load Balancing Simulation - FSM coverage', () => {
  // Collect console errors and page errors during each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of type 'error'
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture page error events (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // Basic assertion to ensure no unexpected script errors surfaced during the test.
    // This validates that no uncaught ReferenceError/SyntaxError/TypeError occurred.
    expect(pageErrors.length, `Expected no uncaught page errors, saw: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Expected no console error messages, saw: ${consoleErrors.map(e => e.text).join('; ')}`).toBe(0);
  });

  test('Initial state (S0_Idle): servers initialized and stats are zero', async ({ page }) => {
    // Validate initial Idle state after DOMContentLoaded and initServers() run.
    const lb = new LoadBalancerPage(page);

    // There should be 3 servers created by initServers()
    await expect(lb.serverContainer.locator('.server')).toHaveCount(3);

    // Total requests should be "0"
    await expect(lb.totalRequests).toHaveText('0');

    // Requests per server should list zeros for each of the three servers (implementation sets to "0, 0, 0")
    const rps = await lb.getRequestsPerServerText();
    expect(rps).toBe('0, 0, 0');

    // Verify each server's requests container is empty
    for (let i = 0; i < 3; i++) {
      await expect(lb.serverRequestsContainer(i).locator('.request')).toHaveCount(0);
    }
  });

  test('Add Request (AddRequest) transitions to Request Added (S1_RequestAdded) and updates DOM', async ({ page }) => {
    // This test validates adding a single request updates counters and appends request to correct server (round robin)
    const lb1 = new LoadBalancerPage(page);

    // Click the "Add Request" button once
    await lb.clickAddRequest();

    // Total requests should be 1
    await expect(lb.totalRequests).toHaveText('1');

    // Since default algorithm is roundRobin, the first request should go to server0
    await expect(lb.serverRequestsContainer(0).locator('.request')).toHaveCount(1);

    // Other servers should remain empty
    await expect(lb.serverRequestsContainer(1).locator('.request')).toHaveCount(0);
    await expect(lb.serverRequestsContainer(2).locator('.request')).toHaveCount(0);

    // Requests-per-server should reflect "1, 0, 0"
    const rps1 = await lb.getRequestsPerServerText();
    expect(rps).toBe('1, 0, 0');

    // Verify the request content matches the incremented counter label (Req 1)
    const texts1 = await lb.getRequestTextsInServer(0);
    expect(texts).toContain('Req 1');
  });

  test('Add Multiple Requests (AddMultiple) transitions to MultipleRequestsAdded (S2) and distributes requests', async ({ page }) => {
    // Validate that clicking "Add 10 Requests" triggers 10 scheduled addRequest calls and final counts match expected round robin distribution
    const lb2 = new LoadBalancerPage(page);

    // Ensure a clean start
    await lb.clickReset();

    // Click "Add 10 Requests"
    await lb.clickAddMultiple();

    // Wait sufficient time for all scheduled setTimeout callbacks (last one at 9*200 = 1800 ms)
    await page.waitForTimeout(2500);

    // Total requests should be 10
    await expect(lb.totalRequests).toHaveText('10');

    // Distribution for round robin across 3 servers with 10 requests is [4,3,3]
    const rps2 = await lb.getRequestsPerServerText();
    expect(rps).toBe('4, 3, 3');

    // Verify counts per server DOM-wise
    await expect(lb.serverRequestsContainer(0).locator('.request')).toHaveCount(4);
    await expect(lb.serverRequestsContainer(1).locator('.request')).toHaveCount(3);
    await expect(lb.serverRequestsContainer(2).locator('.request')).toHaveCount(3);
  });

  test('Reset Simulation (ResetSimulation) transitions to Simulation Reset (S3) and clears state', async ({ page }) => {
    // Validate reset behavior: counters reset and servers re-initialized
    const lb3 = new LoadBalancerPage(page);

    // Add a couple requests first to change state
    await lb.clickAddRequest();
    await lb.clickAddRequest();
    await expect(lb.totalRequests).toHaveText('2');

    // Now reset
    await lb.clickReset();

    // After reset total should be "0"
    await expect(lb.totalRequests).toHaveText('0');

    // servers should remain 3 but their request counts should be zero
    await expect(lb.serverContainer.locator('.server')).toHaveCount(3);
    const rps3 = await lb.getRequestsPerServerText();
    expect(rps).toBe('0, 0, 0');

    // Ensure no .request elements exist in any server
    for (let i = 0; i < 3; i++) {
      await expect(lb.serverRequestsContainer(i).locator('.request')).toHaveCount(0);
    }
  });

  test('Change Algorithm (ChangeAlgorithm) resets round robin index and affects next allocation (S0_Idle self-transition)', async ({ page }) => {
    // This test exercises the algorithm change event and infers lastServerIndex reset behavior by observing round robin assignments.
    const lb4 = new LoadBalancerPage(page);

    // Ensure initial state
    await lb.clickReset();

    // 1) Add one request under default round robin -> should go to server0 (Req 1)
    await lb.clickAddRequest();
    await expect(lb.totalRequests).toHaveText('1');
    await expect(lb.serverRequestsContainer(0).locator('.request')).toHaveCount(1);

    // 2) Change algorithm to 'random' (this should set lastServerIndex = -1 in the change handler)
    await lb.changeAlgorithm('random');

    // 3) Change algorithm back to 'roundRobin' (the change handler should have reset lastServerIndex to -1 earlier,
    //    so the next round robin allocation should start at server0 again)
    await lb.changeAlgorithm('roundRobin');

    // Add another request; if lastServerIndex was reset, this will go to server0 (making server0 have 2 requests)
    await lb.clickAddRequest();

    // Now total should be 2
    await expect(lb.totalRequests).toHaveText('2');

    // server0 should now have 2 requests in this scenario
    await expect(lb.serverRequestsContainer(0).locator('.request')).toHaveCount(2);

    // Other servers unchanged (0)
    await expect(lb.serverRequestsContainer(1).locator('.request')).toHaveCount(0);
    await expect(lb.serverRequestsContainer(2).locator('.request')).toHaveCount(0);

    // Confirm that the second request label is "Req 2"
    const texts2 = await lb.getRequestTextsInServer(0);
    expect(texts).toContain('Req 2');
  });

  test('Edge case: Reset does not cancel pending scheduled requests from Add 10 Requests', async ({ page }) => {
    // This test demonstrates and asserts the known edge behavior: scheduled setTimeout addRequest calls are not cleared on reset.
    // Steps:
    //  - Click Add 10 Requests (schedules 10 timeouts)
    //  - Immediately click Reset
    //  - Wait for all scheduled timeouts to fire
    // Expected: After waiting, requests scheduled earlier will still be applied resulting in >0 final requests (likely 10).
    const lb5 = new LoadBalancerPage(page);

    // Start scheduling the 10 requests
    await lb.clickAddMultiple();

    // Immediately reset simulation (this will set requestCounter = 0 and initServers())
    await lb.clickReset();

    // Wait enough time for the scheduled timeouts to execute
    await page.waitForTimeout(2500);

    // The scheduled callbacks will have executed even after reset.
    // Assert that there were requests added by the scheduled callbacks (i.e., totalRequests > 0).
    // It's acceptable that the exact number may vary in timing races, but it should be >= 1 and <= 10.
    const totalStr = await lb.getTotalRequestsText();
    const totalNum = Number(totalStr);
    expect(Number.isFinite(totalNum)).toBeTruthy();
    expect(totalNum).toBeGreaterThanOrEqual(1);
    expect(totalNum).toBeLessThanOrEqual(10);

    // Also assert that requests-per-server text reflects non-zero counts
    const rps4 = await lb.getRequestsPerServerText();
    // rps should not be the reset state "0, 0, 0"
    expect(rps).not.toBe('0, 0, 0');
  });

  test('Robustness: rapid interactions and sanity checks (no uncaught errors during heavy interaction)', async ({ page }) => {
    // This test performs a burst of interactions to surface potential race conditions or runtime errors.
    const lb6 = new LoadBalancerPage(page);

    // Perform a sequence: add 1, change algorithm, add multiple, switch algorithms rapidly, reset, add single
    await lb.clickAddRequest();
    await lb.changeAlgorithm('leastConnections');
    await lb.clickAddMultiple();
    await lb.changeAlgorithm('random');
    await lb.changeAlgorithm('ipHash');
    await lb.clickAddRequest();
    await lb.clickReset();
    await lb.clickAddRequest();

    // Wait for scheduled timeouts to finish
    await page.waitForTimeout(2500);

    // Sanity checks: totalRequests should be a finite number and requestsPerServer string should be present
    const total = await lb.getTotalRequestsText();
    expect(Number.isFinite(Number(total))).toBeTruthy();

    const rps5 = await lb.getRequestsPerServerText();
    expect(typeof rps).toBe('string');
    expect(rps.length).toBeGreaterThanOrEqual(1);
  });
});