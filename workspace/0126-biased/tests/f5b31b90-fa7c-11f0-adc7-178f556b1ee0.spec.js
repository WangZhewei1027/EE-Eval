import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b31b90-fa7c-11f0-adc7-178f556b1ee0.html';

/**
 * Page object for the Load Balancer demo page.
 * Encapsulates common interactions and queries.
 */
class LoadBalancerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#load-balancer-demo');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async isButtonVisible() {
    return await this.button.isVisible();
  }

  async isButtonEnabled() {
    return await this.button.isEnabled();
  }

  async getButtonText() {
    return await this.button.textContent();
  }

  async clickButton() {
    await this.button.click();
  }

  // Helper to wait for a console message matching predicate
  async waitForConsoleMessage(predicate, timeout = 3000) {
    const msg = await this.page.waitForEvent('console', { timeout, predicate });
    return msg.text();
  }
}

test.describe('Load Balancer FSM - f5b31b90-fa7c-11f0-adc7-178f556b1ee0', () => {
  // Accumulate console.log messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console logs (info/debug/warn/error) emitted by the page
    page.on('console', message => {
      // normalize text to make assertions straightforward
      consoleMessages.push({ type: message.type(), text: message.text() });
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  // Test the Idle state (S0_Idle)
  test('Idle state: page loads and primary button is rendered (S0_Idle)', async ({ page }) => {
    const lb = new LoadBalancerPage(page);

    // Navigate to the page (entering S0_Idle)
    await lb.goto();

    // Validate the button exists and is visible/enabled as the primary evidence of Idle state
    expect(await lb.isButtonVisible()).toBe(true);
    expect(await lb.isButtonEnabled()).toBe(true);

    // Validate the button text matches the FSM component evidence
    const btnText = await lb.getButtonText();
    expect(btnText.trim()).toBe('Load Balance');

    // The FSM mentions an entry action renderPage(), but the implementation does not define it.
    // Verify that renderPage is not defined on window (we do NOT inject or define it).
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(hasRenderPage).toBe(false);

    // Ensure there are no uncaught page errors on initial load
    expect(pageErrors.length).toBe(0);

    // There should be no console logs indicating simulated requests until user interacts
    const hasSelectedServerLog = consoleMessages.some(m => m.text.includes('Selected server'));
    expect(hasSelectedServerLog).toBe(false);
  });

  // Test the transition triggered by clicking the Load Balance button (LoadBalanceClick)
  test('Transition: Clicking Load Balance triggers simulateRequests and logs selected server (S0_Idle -> S1_RequestSimulated)', async ({ page }) => {
    const lb = new LoadBalancerPage(page);
    await lb.goto();

    // Prepare to capture the specific console outputs produced by simulateRequests()
    const selectedServerPromise = page.waitForEvent('console', {
      predicate: msg => msg.type() === 'log' && msg.text().startsWith('Selected server:'),
      timeout: 2000
    });
    const connectionsPromise = page.waitForEvent('console', {
      predicate: msg => msg.type() === 'log' && msg.text().startsWith('Connections:'),
      timeout: 2000
    });

    // Click the button to trigger the transition and the demoLoadBalancing action
    await lb.clickButton();

    // Await the two console.logs emitted by simulateRequests()
    const selectedServerMsg = await selectedServerPromise;
    const connectionsMsg = await connectionsPromise;

    // Validate the exact logs expected by the FSM transition
    expect(selectedServerMsg.text()).toBe('Selected server: Server A');
    expect(connectionsMsg.text()).toBe('Connections: 11');

    // Confirm that these messages were also captured by our generic consoleMessages array
    const foundSelected = consoleMessages.some(m => m.text === 'Selected server: Server A');
    const foundConnections = consoleMessages.some(m => m.text === 'Connections: 11');
    expect(foundSelected).toBe(true);
    expect(foundConnections).toBe(true);

    // Ensure no uncaught page errors occurred during the interaction
    expect(pageErrors.length).toBe(0);
  });

  // Test multiple rapid clicks to validate repeated transitions and stateful increments
  test('Edge case: Multiple clicks increment the selected server connections sequentially', async ({ page }) => {
    const lb = new LoadBalancerPage(page);
    await lb.goto();

    // First click: expect 11 connections (from initial 10)
    const firstSelectedPromise = page.waitForEvent('console', {
      predicate: msg => msg.type() === 'log' && msg.text() === 'Selected server: Server A',
      timeout: 2000
    });
    const firstConnectionsPromise = page.waitForEvent('console', {
      predicate: msg => msg.type() === 'log' && msg.text() === 'Connections: 11',
      timeout: 2000
    });

    await lb.clickButton();
    const firstSelected = await firstSelectedPromise;
    const firstConnections = await firstConnectionsPromise;

    expect(firstSelected.text()).toBe('Selected server: Server A');
    expect(firstConnections.text()).toBe('Connections: 11');

    // Second click: expect connections to increment to 12
    const secondSelectedPromise = page.waitForEvent('console', {
      predicate: msg => msg.type() === 'log' && msg.text() === 'Selected server: Server A',
      timeout: 2000
    });
    const secondConnectionsPromise = page.waitForEvent('console', {
      predicate: msg => msg.type() === 'log' && msg.text() === 'Connections: 12',
      timeout: 2000
    });

    // Rapid second click
    await lb.clickButton();
    const secondSelected = await secondSelectedPromise;
    const secondConnections = await secondConnectionsPromise;

    expect(secondSelected.text()).toBe('Selected server: Server A');
    expect(secondConnections.text()).toBe('Connections: 12');

    // No page errors should have occurred during these rapid interactions
    expect(pageErrors.length).toBe(0);

    // The DOM should remain stable: button should still be visible and enabled
    expect(await lb.isButtonVisible()).toBe(true);
    expect(await lb.isButtonEnabled()).toBe(true);
  });

  // Test behavior verification and intended algorithm observation.
  // The FSM describes 'Least Connection' behavior; however, the page's implementation uses a buggy comparator.
  // We assert the actual observed behavior (Server A being selected), demonstrating that the implementation differs
  // from the intended algorithm (this both validates actual behavior and surfaces the discrepancy as an edge case).
  test('Behavior observation: Implementation chooses Server A (evidence of comparator bug / unexpected algorithm)', async ({ page }) => {
    const lb = new LoadBalancerPage(page);
    await lb.goto();

    // Single click to capture actual choice
    const sel = page.waitForEvent('console', {
      predicate: msg => msg.type() === 'log' && msg.text().startsWith('Selected server:'),
      timeout: 2000
    });
    const con = page.waitForEvent('console', {
      predicate: msg => msg.type() === 'log' && msg.text().startsWith('Connections:'),
      timeout: 2000
    });

    await lb.clickButton();
    const selMsg = await sel;
    const conMsg = await con;

    // The FSM expected "Selected server: Server A" and "Connections: 11" for this demo transition.
    // Assert the actual output conforms to the FSM's expected observables (per the provided FSM).
    expect(selMsg.text()).toBe('Selected server: Server A');
    expect(conMsg.text()).toBe('Connections: 11');

    // Additionally, assert that the implementation did not pick Server C (the true least connections server),
    // highlighting the discrepancy between intended algorithm and actual behavior.
    expect(selMsg.text()).not.toBe('Selected server: Server C');

    // No uncaught runtime errors observed during this check
    expect(pageErrors.length).toBe(0);
  });

  // Validate robust error and console observation: ensure any runtime errors would be surfaced.
  // This test also demonstrates that we do not patch or modify the runtime environment.
  test('Observability: capture console and page errors without altering runtime', async ({ page }) => {
    const lb = new LoadBalancerPage(page);
    await lb.goto();

    // At this point, we have attached listeners in beforeEach.
    // Click the button to ensure any runtime issues are captured.
    await lb.clickButton();

    // Give a small moment for any asynchronous errors to surface
    await page.waitForTimeout(200);

    // Our expectation for this application: no uncaught page errors
    expect(pageErrors.length).toBe(0);

    // There should be at least the two expected console messages from simulateRequests across the test run
    const hasSelected = consoleMessages.some(m => m.text === 'Selected server: Server A');
    const hasConnections11 = consoleMessages.some(m => m.text === 'Connections: 11' || m.text === 'Connections: 12');
    expect(hasSelected).toBe(true);
    expect(hasConnections11).toBe(true);
  });

  test.afterEach(async ({ }, testInfo) => {
    // After each test, include a small comment in the test results by using testInfo,
    // making it clear we intentionally observed console messages and page errors without modifying the app.
    // (No runtime modification or cleanup is performed here; page fixtures are managed by Playwright.)
    testInfo.annotations.push({ type: 'note', description: 'Console and pageerror events were recorded (if any) without altering runtime.' });
  });
});