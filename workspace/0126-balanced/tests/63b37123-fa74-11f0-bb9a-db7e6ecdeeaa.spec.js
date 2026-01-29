import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b37123-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for the Load Balancer demo
class LoadBalancerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.sendBtn = page.locator('#sendRequestBtn');
    this.servers = page.locator('#servers .server');
    this.requestsLog = page.locator('#requestsLog');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for servers to be rendered
    await this.page.waitForSelector('#servers .server');
    await expect(this.sendBtn).toBeVisible();
  }

  async clickSendRequest(times = 1, intervalMs = 0) {
    for (let i = 0; i < times; i++) {
      await this.sendBtn.click();
      if (intervalMs > 0) await this.page.waitForTimeout(intervalMs);
    }
  }

  // Returns text content of the load element for server at index (0-based)
  async getServerLoadText(index) {
    const server = this.servers.nth(index);
    const loadEl = server.locator('.load');
    return loadEl.textContent();
  }

  async getServerTitleText(index) {
    const server1 = this.servers.nth(index);
    return server.locator('h2').textContent();
  }

  async getRequestsLogText() {
    return this.requestsLog.textContent();
  }

  // Count occurrences of a substring in the requests log
  async countLogOccurrences(substring) {
    const text = await this.getRequestsLogText();
    if (!text) return 0;
    return (text.match(new RegExp(substring.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  }

  // Wait for an assigned message for a particular server index to appear
  async waitForAssignedToServer(serverIndex, timeout = 3000) {
    const serverNumber = serverIndex + 1;
    const expectedText = `assigned to Server ${serverNumber}`;
    await this.page.waitForFunction(
      (selector, expected) => {
        const el = document.querySelector(selector);
        return el && el.textContent && el.textContent.includes(expected);
      },
      ['#requestsLog', expectedText],
      { timeout }
    );
  }

  // Wait for completed message for a particular server index and request id number (or any)
  async waitForCompletedOnServer(serverIndex, timeout = 5000) {
    const serverNumber1 = serverIndex + 1;
    const expectedText1 = `completed on Server ${serverNumber}`;
    await this.page.waitForFunction(
      (selector, expected) => {
        const el1 = document.querySelector(selector);
        return el && el.textContent && el.textContent.includes(expected);
      },
      ['#requestsLog', expectedText],
      { timeout }
    );
  }
}

test.describe('Load Balancing Demo - FSM Validation and UI tests', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Capture console messages and page errors for later assertions
    pageErrors = [];
    consoleMessages = [];
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // nothing special to teardown
  });

  test('Initial render - Idle state (S0_Idle): button and servers are present and initialized', async ({ page }) => {
    // This test validates the Idle state S0_Idle:
    // - The page has the Send Request button
    // - 3 servers are rendered with Active Requests: 0
    // - Request Log header exists
    // - No uncaught page errors on initial render
    const lb = new LoadBalancerPage(page);
    await lb.goto();

    // Verify send request button exists and is enabled
    await expect(lb.sendBtn).toBeVisible();
    await expect(lb.sendBtn).toBeEnabled();

    // Verify servers count (SERVER_COUNT = 3)
    await expect(lb.servers).toHaveCount(3);

    // Each server should show Active Requests: 0 initially
    for (let i = 0; i < 3; i++) {
      const title = await lb.getServerTitleText(i);
      expect(title).toBe(`Server ${i + 1}`);
      const loadText = await lb.getServerLoadText(i);
      expect(loadText.trim()).toBe('Active Requests: 0');
    }

    // Verify request log contains header 'Request Log:'
    const logText = await lb.getRequestsLogText();
    expect(logText).toContain('Request Log:');

    // Assert no page errors occurred during initial rendering
    expect(pageErrors.length).toBe(0);
  });

  test('Send Request -> Request Sent (S0 -> S1) and assignment occurs (S1 -> S2): single request lifecycle', async ({ page }) => {
    // This test validates transitions:
    // - Clicking Send Request triggers assignment to Server 1 (Round Robin start)
    // - Server load increments immediately (Request In Progress)
    // - Eventually the request completes and server load decrements (Request Completed)
    const lb1 = new LoadBalancerPage(page);
    await lb.goto();

    // Click send once to transition from Idle to RequestSent and then to RequestInProgress
    await lb.clickSendRequest(1);

    // Immediately after click, we should see an "assigned to Server 1" log entry.
    await lb.waitForAssignedToServer(0, 2000);

    // Server 1 load should be incremented to Active Requests: 1
    const server1LoadAfterAssign = await lb.getServerLoadText(0);
    expect(server1LoadAfterAssign.trim()).toBe('Active Requests: 1');

    // Now wait for the completion message for Server 1 (processing time up to ~3s). Allow a buffer.
    await lb.waitForCompletedOnServer(0, 6000);

    // After completion, server 1 load should return to 0
    // We wait a short while to allow UI to update, then check.
    await page.waitForTimeout(100);
    const server1LoadAfterComplete = await lb.getServerLoadText(0);
    expect(server1LoadAfterComplete.trim()).toBe('Active Requests: 0');

    // The log should contain both assigned and completed messages for request #1
    const log = await lb.getRequestsLogText();
    expect(log).toMatch(/assigned to Server 1/);
    expect(log).toMatch(/completed on Server 1/);

    // Verify no uncaught exceptions happened during lifecycle
    expect(pageErrors.length).toBe(0);
  });

  test('Round Robin assignment across servers (S1 -> S2 for consecutive requests)', async ({ page }) => {
    // This test validates the Round Robin assignment:
    // - Send three requests in quick succession
    // - They should be assigned to Server 1, Server 2, Server 3 respectively
    const lb2 = new LoadBalancerPage(page);
    await lb.goto();

    // Send 3 requests quickly
    await lb.clickSendRequest(3, 50);

    // Wait for assignment messages for each server
    await lb.waitForAssignedToServer(0, 2000);
    await lb.waitForAssignedToServer(1, 2000);
    await lb.waitForAssignedToServer(2, 2000);

    // After immediate assignment, each server's load should be 1
    // We check quickly (before many of them complete)
    for (let i = 0; i < 3; i++) {
      const loadText1 = await lb.getServerLoadText(i);
      // Because completion times are asynchronous and random, allow either 1 or 0 if completion happened fast,
      // but at this immediate check, we expect at least that assignments were made. Prefer exact check for 1.
      // We'll accept 'Active Requests: 1' as the expected common case.
      expect(['Active Requests: 1', 'Active Requests: 0']).toContain(loadText.trim());
    }

    // Validate the log contains assignment entries in general
    const log1 = await lb.getRequestsLogText();
    expect(log).toContain('assigned to Server 1');
    expect(log).toContain('assigned to Server 2');
    expect(log).toContain('assigned to Server 3');

    // Also validate that there have been no uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Concurrent requests maintain accurate loads and log entries; high throughput edge case', async ({ page }) => {
    // Edge case: Rapidly clicking many times to ensure system remains stable and no uncaught exceptions occur.
    // - Send 8 requests quickly
    // - Verify 8 assignment log entries appear
    // - Ensure no uncaught exceptions
    const lb3 = new LoadBalancerPage(page);
    await lb.goto();

    const REQUESTS = 8;
    await lb.clickSendRequest(REQUESTS, 10);

    // Wait until the log contains REQUESTS "assigned to Server" entries (they should appear immediately)
    await page.waitForFunction(
      (selector, occurrences) => {
        const el2 = document.querySelector(selector);
        if (!el || !el.textContent) return false;
        return (el.textContent.match(/assigned to Server/g) || []).length >= occurrences;
      },
      ['#requestsLog', REQUESTS],
      { timeout: 4000 }
    );

    const assignedCount = await lb.countLogOccurrences('assigned to Server');
    expect(assignedCount).toBeGreaterThanOrEqual(REQUESTS);

    // Wait for all completion messages to appear (some may finish faster; allow generous time)
    await page.waitForFunction(
      (selector, occurrences) => {
        const el3 = document.querySelector(selector);
        if (!el || !el.textContent) return false;
        return (el.textContent.match(/completed on Server/g) || []).length >= occurrences;
      },
      ['#requestsLog', REQUESTS],
      { timeout: 10000 }
    );

    const completedCount = await lb.countLogOccurrences('completed on Server');
    expect(completedCount).toBeGreaterThanOrEqual(REQUESTS);

    // Ensure that server loads have settled back to 0 (eventual consistency)
    for (let i = 0; i < 3; i++) {
      // Allow a tiny wait for UI settle
      await page.waitForTimeout(50);
      const loadText2 = await lb.getServerLoadText(i);
      expect(loadText.trim()).toBe('Active Requests: 0');
    }

    // No uncaught JS errors should have been observed
    expect(pageErrors.length).toBe(0);

    // Also assert that console did not show error-level logs (collect console messages and ensure no 'error' type)
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Verify logs include timestamps and are appended in chronological order', async ({ page }) => {
    // Validate that each log entry is prefixed with a time string in brackets "[HH:MM:SS ...]"
    // and that assigned messages appear before their corresponding completed messages in the log.
    const lb4 = new LoadBalancerPage(page);
    await lb.goto();

    // Send 2 requests
    await lb.clickSendRequest(2, 20);

    // Wait for two assigned messages
    await page.waitForFunction(
      (selector) => {
        const el4 = document.querySelector(selector);
        return el && el.textContent && (el.textContent.match(/assigned to Server/g) || []).length >= 2;
      },
      ['#requestsLog'],
      { timeout: 3000 }
    );

    // Wait for two completed messages
    await page.waitForFunction(
      (selector) => {
        const el5 = document.querySelector(selector);
        return el && el.textContent && (el.textContent.match(/completed on Server/g) || []).length >= 2;
      },
      ['#requestsLog'],
      { timeout: 7000 }
    );

    const logText1 = await lb.getRequestsLogText();
    // Each log line begins with a timestamp enclosed in brackets like "[HH:MM:SS ..."
    // We check for at least one occurrence of '[' followed by ':' to indicate a time-like stamp.
    expect(/\[\d{1,2}:\d{2}:\d{2}/.test(logText)).toBeTruthy();

    // Ensure for at least one server the assigned message appears before the completed message
    // (i.e., indexOf assigned < indexOf completed)
    const assignedIndex = logText.indexOf('assigned to Server');
    const completedIndex = logText.indexOf('completed on Server');
    expect(assignedIndex).toBeGreaterThanOrEqual(0);
    expect(completedIndex).toBeGreaterThanOrEqual(0);
    expect(assignedIndex).toBeLessThan(completedIndex);
  });

  test('Verify expected FSM entry action effects and unimplemented names are not required', async ({ page }) => {
    // FSM indicated an entry_action renderPage() for Idle state, but implementation does not expose such function.
    // We verify the intended observable effect of that entry action: elements are rendered.
    // This test ensures we do NOT attempt to call/render missing functions but that the UI still starts in Idle state.
    const lb5 = new LoadBalancerPage(page);
    await lb.goto();

    // Observable effect: the send button and servers exist (renderPage implied)
    await expect(lb.sendBtn).toBeVisible();
    await expect(lb.servers).toHaveCount(3);

    // Confirm there are no ReferenceError / TypeError page errors thrown because a missing renderPage function is not invoked
    // (i.e., the app isn't trying to call a non-existent function)
    expect(pageErrors.length).toBe(0);
  });

});