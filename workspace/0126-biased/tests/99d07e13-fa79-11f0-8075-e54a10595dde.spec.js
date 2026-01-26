import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d07e13-fa79-11f0-8075-e54a10595dde.html';

// Page object for the Load Balancer Simulator page
class LoadBalancerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.serverCount = page.locator('#serverCount');
    this.requestCount = page.locator('#requestCount');
    this.algorithm = page.locator('#algorithm');
    this.distributeButton = page.locator('#distributeButton');
    this.logArea = page.locator('#log');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for essential controls to be present
    await Promise.all([
      this.serverCount.waitFor({ state: 'visible' }),
      this.requestCount.waitFor({ state: 'visible' }),
      this.algorithm.waitFor({ state: 'visible' }),
      this.distributeButton.waitFor({ state: 'visible' }),
      this.logArea.waitFor({ state: 'visible' }),
    ]);
  }

  async setServerCount(count) {
    await this.serverCount.fill(String(count));
    // blur to ensure value changes are registered
    await this.serverCount.press('Tab');
  }

  async setRequestCount(count) {
    await this.requestCount.fill(String(count));
    await this.requestCount.press('Tab');
  }

  async selectAlgorithm(value) {
    await this.algorithm.selectOption(value);
  }

  async clickDistribute() {
    await this.distributeButton.click();
  }

  async getLog() {
    return await this.logArea.inputValue();
  }

  async getLogLines() {
    const v = await this.getLog();
    if (!v) return [];
    return v.split('\n').filter(line => line.trim().length > 0);
  }
}

test.describe('Load Balancer Simulator (Application ID: 99d07e13-fa79-11f0-8075-e54a10595dde)', () => {
  // Arrays to collect runtime console and page errors per test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // initialize collectors
    consoleErrors = [];
    pageErrors = [];

    // collect console errors (console.error or messages with type 'error')
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) {
        // swallow any unexpected inspection errors
      }
    });

    // collect uncaught exceptions on page
    page.on('pageerror', error => {
      pageErrors.push(error);
    });
  });

  test.afterEach(async () => {
    // Basic teardown assertions: no unexpected runtime errors occurred during the test.
    // If there are errors, they will be surfaced as test failures below (we assert no errors).
    // These assertions also serve to observe console and page errors as required.
    expect(consoleErrors, 'No console.error messages should be emitted during the test').toEqual([]);
    expect(pageErrors, 'No uncaught page errors should occur during the test').toEqual([]);
  });

  test('Initial state (S0_Idle) renders all controls and default values', async ({ page }) => {
    // This test validates the Idle state: initial UI render, presence of controls,
    // and default values per the FSM and HTML implementation.
    const app = new LoadBalancerPage(page);
    await app.goto();

    // Verify controls are visible and have expected default values
    await expect(app.serverCount).toHaveValue('2');
    await expect(app.requestCount).toHaveValue('10');
    await expect(app.algorithm).toHaveValue('roundRobin');

    // Distribute button present and enabled
    await expect(app.distributeButton).toBeVisible();
    await expect(app.distributeButton).toBeEnabled();

    // Log area is present and initially empty
    const log = await app.getLog();
    expect(log.trim()).toBe('');

    // The FSM S0 entry_action renderPage() is not explicitly available; ensure page title matches expected text
    await expect(page).toHaveTitle(/Load Balancer Simulator/i);
  });

  test('Transition S0_Idle -> S1_Requests_Distributed with Round Robin algorithm', async ({ page }) => {
    // This test validates clicking the distribute button triggers request distribution
    // and that the Round Robin algorithm assigns requests evenly across servers.
    const app = new LoadBalancerPage(page);
    await app.goto();

    // Setup: 3 servers, 6 requests, roundRobin
    await app.setServerCount(3);
    await app.setRequestCount(6);
    await app.selectAlgorithm('roundRobin');

    // Click the distribute button to transition the state
    await app.clickDistribute();

    // Gather log lines and validate assignments
    const lines = await app.getLogLines();

    // Expect: first 6 lines are assignment lines, followed by server summary lines (3 servers)
    // Verify count and content structure
    const assignmentLines = lines.slice(0, 6);
    const summaryLines = lines.slice(6);

    // Each assignment line should match "Request X assigned to Server Y"
    for (let i = 0; i < assignmentLines.length; i++) {
      const expectedServer = (i % 3) + 1; // round robin among 3 servers
      expect(assignmentLines[i]).toBe(`Request ${i + 1} assigned to Server ${expectedServer}`);
    }

    // Summary lines should include each server and its load, check that each server handled 2 requests
    expect(summaryLines.length).toBe(3);
    summaryLines.forEach((line, idx) => {
      const serverId = idx + 1;
      // Example: "Server 1 handled requests: 1, 4 with load: 2"
      expect(line).toMatch(new RegExp(`^Server ${serverId} handled requests: .* with load: 2$`));
    });
  });

  test('Transition S0_Idle -> S1_Requests_Distributed with Least Connections algorithm (edge behavior)', async ({ page }) => {
    // This test exercises the leastConnections algorithm to assert how the current implementation behaves.
    // Note: The implementation uses a reduce that will favor server index 0 when loads are equal.
    const app = new LoadBalancerPage(page);
    await app.goto();

    // Setup: 2 servers, 5 requests, leastConnections
    await app.setServerCount(2);
    await app.setRequestCount(5);
    await app.selectAlgorithm('leastConnections');

    await app.clickDistribute();

    const lines = await app.getLogLines();

    // The implementation's reduce logic will select server 1 (id=1) for all requests when ties exist.
    // We expect each assignment line to indicate Server 1.
    const assignmentLines = lines.filter(l => /^Request \d+ assigned to Server \d+$/i.test(l));
    expect(assignmentLines.length).toBe(5);

    assignmentLines.forEach(line => {
      expect(line).toBeTruthy();
      // All should be assigned to Server 1 given the current implementation
      expect(line).toMatch(/^Request \d+ assigned to Server 1$/);
    });

    // Summary should indicate Server 1 has load 5 and server 2 has load 0
    const summaryLines = lines.filter(l => /^Server \d+ handled requests:/i.test(l));
    expect(summaryLines.some(l => l.includes('Server 1') && l.includes('load: 5'))).toBe(true);
    expect(summaryLines.some(l => l.includes('Server 2') && l.includes('load: 0'))).toBe(true);
  });

  test('Transition S0_Idle -> S1_Requests_Distributed with Random algorithm (counts and totals)', async ({ page }) => {
    // This test validates that the random algorithm assigns the correct number of requests total
    // and that the server summaries aggregate to the same total request count.
    const app = new LoadBalancerPage(page);
    await app.goto();

    await app.setServerCount(4);
    await app.setRequestCount(20);
    await app.selectAlgorithm('random');

    await app.clickDistribute();

    const lines = await app.getLogLines();

    const assignmentLines = lines.filter(l => /^Request \d+ assigned to Server \d+$/i.test(l));
    const summaryLines = lines.filter(l => /^Server \d+ handled requests:/i.test(l));

    // There should be exactly 20 assignment lines
    expect(assignmentLines.length).toBe(20);

    // Summary lines should be present for 4 servers
    expect(summaryLines.length).toBe(4);

    // Aggregate the loads reported in the summaries and ensure they sum to 20
    const loadSum = summaryLines.reduce((sum, line) => {
      const m = line.match(/load:\s*(\d+)$/);
      return sum + (m ? parseInt(m[1], 10) : 0);
    }, 0);
    expect(loadSum).toBe(20);
  });

  test('Edge case: single server (serverCount=1) distributes all requests to Server 1', async ({ page }) => {
    // Validates behavior when only one server is available.
    const app = new LoadBalancerPage(page);
    await app.goto();

    await app.setServerCount(1);
    await app.setRequestCount(3);
    // Test with roundRobin (should be the same for any algorithm with single server)
    await app.selectAlgorithm('roundRobin');

    await app.clickDistribute();

    const lines = await app.getLogLines();
    const assignmentLines = lines.filter(l => /^Request \d+ assigned to Server \d+$/i.test(l));
    expect(assignmentLines.length).toBe(3);
    assignmentLines.forEach(line => expect(line).toBe(/assigned to Server 1$/));
    // Summary should show Server 1 load 3
    const summaryLines = lines.filter(l => /^Server 1 handled requests:/i.test(l));
    expect(summaryLines.length).toBe(1);
    expect(summaryLines[0]).toMatch(/load:\s*3$/);
  });

  test('Clicking distribute twice resets log area before new distribution', async ({ page }) => {
    // Verifies that the implementation clears the log before each distribution (logArea.value = '').
    const app = new LoadBalancerPage(page);
    await app.goto();

    await app.setServerCount(2);
    await app.setRequestCount(2);
    await app.selectAlgorithm('roundRobin');

    // First distribution
    await app.clickDistribute();
    const firstRunLines = await app.getLogLines();
    expect(firstRunLines.length).toBeGreaterThanOrEqual(3); // 2 assignments + 2 summaries (but empties might be filtered)

    // Capture the log after first run
    const firstRunLog = await app.getLog();

    // Second distribution (should replace log)
    await app.clickDistribute();
    const secondRunLog = await app.getLog();

    // The logs should not be appended; secondRunLog should not contain duplicated content from firstRunLog appended to it.
    // Since the implementation resets logArea.value = '' before distributing, the second run should reflect fresh distribution.
    expect(secondRunLog).not.toContain(firstRunLog + firstRunLog); // trivial sanity check for append behavior

    // Also the first line of the new log should be "Request 1 assigned..." (fresh)
    const secondRunLines = secondRunLog.split('\n').filter(l => l.trim().length > 0);
    expect(secondRunLines[0]).toMatch(/^Request 1 assigned to Server \d+$/);
  });

  test('Edge case: minimal requestCount (1) assigns exactly one request and summaries reflect it', async ({ page }) => {
    // Validates behavior when there is only one request to distribute.
    const app = new LoadBalancerPage(page);
    await app.goto();

    await app.setServerCount(3);
    await app.setRequestCount(1);
    await app.selectAlgorithm('roundRobin');

    await app.clickDistribute();

    const lines = await app.getLogLines();
    const assignmentLines = lines.filter(l => /^Request \d+ assigned to Server \d+$/i.test(l));
    expect(assignmentLines.length).toBe(1);
    // Summary lines should indicate one server with load 1 and others 0
    const summaryLines = lines.filter(l => /^Server \d+ handled requests:/i.test(l));
    const loadSum = summaryLines.reduce((sum, line) => {
      const m = line.match(/load:\s*(\d+)$/);
      return sum + (m ? parseInt(m[1], 10) : 0);
    }, 0);
    expect(loadSum).toBe(1);
  });

  test('Event handler presence and behavior: clicking #distributeButton triggers JS listener', async ({ page }) => {
    // This test ensures that the click event on distributeButton is wired: clicking updates the log area.
    const app = new LoadBalancerPage(page);
    await app.goto();

    // Use a simple configuration and click the button
    await app.setServerCount(2);
    await app.setRequestCount(2);
    await app.selectAlgorithm('roundRobin');

    // Before clicking, ensure log is empty
    expect((await app.getLog()).trim()).toBe('');

    // Click the button and confirm the log now contains assignments
    await app.clickDistribute();
    const logAfterClick = await app.getLog();
    expect(logAfterClick).toContain('Request 1 assigned to Server');
    expect(logAfterClick).toContain('Server 1 handled requests:');
  });
});