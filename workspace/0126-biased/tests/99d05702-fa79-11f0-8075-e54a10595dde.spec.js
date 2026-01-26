import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d05702-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the TCP/IP Simulation application
class TcpSimPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.ip = page.locator('#ipAddress');
    this.port = page.locator('#port');
    this.connectBtn = page.locator('#connectBtn');
    this.dataInput = page.locator('#dataToSend');
    this.sendDataBtn = page.locator('#sendDataBtn');
    this.disconnectBtn = page.locator('#disconnectBtn');
    this.verboseCheckbox = page.locator('#verboseLogging');
    this.resetBtn = page.locator('#resetBtn');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setIp(ip) {
    await this.ip.fill(ip);
  }

  async setPort(port) {
    await this.port.fill(String(port));
  }

  async clickConnect() {
    await this.connectBtn.click();
  }

  async clickSendData() {
    await this.sendDataBtn.click();
  }

  async setDataToSend(data) {
    await this.dataInput.fill(data);
  }

  async clickDisconnect() {
    await this.disconnectBtn.click();
  }

  async toggleVerbose(enable = true) {
    const checked = await this.verboseCheckbox.isChecked();
    if (enable !== checked) {
      await this.verboseCheckbox.click();
    }
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }
}

test.describe('TCP/IP Simulation - FSM validation and UI behavior', () => {
  let page;
  let tcp;
  let consoleErrors;
  let pageErrors;
  let dialogs;

  // Setup: open a fresh page and attach listeners to capture console errors, page errors, and dialogs.
  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleErrors = [];
    pageErrors = [];
    dialogs = [];

    // Capture console messages; keep error-level messages for assertions
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', error => {
      // push the Error object (message/stack)
      pageErrors.push(error);
    });

    // Auto-accept/record dialogs (alerts used by the app)
    page.on('dialog', async dialog => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });

    tcp = new TcpSimPage(page);
    await tcp.goto();
  });

  test.afterEach(async () => {
    // Close page
    await page.close();
  });

  test('Initial state: Disconnected (sending data should alert the user)', async () => {
    // This verifies the initial FSM state S0_Disconnected via observable behavior:
    // Attempting to send data when disconnected should trigger an alert "You must be connected to send data."
    await tcp.clickSendData();

    // One dialog should have been shown
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    const lastDialog = dialogs[dialogs.length - 1];
    expect(lastDialog.message).toContain('You must be connected to send data.');

    // No unexpected console errors or page errors should have been produced
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('Edge case: Connect with missing IP should alert and remain disconnected', async () => {
    // Ensure ip field is empty and port has default value. Clicking Connect should alert.
    await tcp.setIp(''); // clear ip
    await tcp.setPort('80');
    await tcp.clickConnect();

    // Alert should indicate invalid input
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    const lastDialog = dialogs[dialogs.length - 1];
    expect(lastDialog.message).toContain('Please enter a valid IP address and port.');

    // Output should not contain "Connected to"
    const out = await tcp.getOutputText();
    expect(out).not.toContain('Connected to');

    // No console or page errors expected from this validation flow
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('Successful Connect transitions to Connected state and updates output', async () => {
    // Provide valid IP and Port, then click Connect
    await tcp.setIp('192.168.1.100');
    await tcp.setPort('8080');
    await tcp.clickConnect();

    // Output should contain the Connected message exactly as produced by the app
    const out = await tcp.getOutputText();
    expect(out).toContain('Connected to 192.168.1.100:8080');

    // No alert should have been shown in this successful path (dialogs array may contain earlier dialogs, but none for this action)
    // Ensure the last dialog (if any) is not an error from connect
    if (dialogs.length) {
      const anyConnectAlert = dialogs.some(d => d.message.includes('Connected to'));
      // The implementation does not alert on success, so we expect none
      expect(anyConnectAlert).toBeFalsy();
    }

    // No console/page errors expected
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('SendData when connected logs sent data; multiple sends accumulate', async () => {
    // Connect first
    await tcp.setIp('10.0.0.5');
    await tcp.setPort('1234');
    await tcp.clickConnect();

    // Send first piece of data
    await tcp.setDataToSend('Hello');
    await tcp.clickSendData();

    // Send second piece of data
    await tcp.setDataToSend('World');
    await tcp.clickSendData();

    const out = await tcp.getOutputText();
    expect(out).toContain('Connected to 10.0.0.5:1234');
    expect(out).toContain('Sent data: Hello');
    expect(out).toContain('Sent data: World');

    // The log should contain the Sent data lines in order
    const firstIndex = out.indexOf('Sent data: Hello');
    const secondIndex = out.indexOf('Sent data: World');
    expect(firstIndex).toBeGreaterThan(-1);
    expect(secondIndex).toBeGreaterThan(firstIndex);

    // No console/page errors expected
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('SendData edge case: sending empty string when connected still logs Sent data:', async () => {
    // Connect
    await tcp.setIp('127.0.0.1');
    await tcp.setPort('80');
    await tcp.clickConnect();

    // Send empty string
    await tcp.setDataToSend('');
    await tcp.clickSendData();

    const out = await tcp.getOutputText();
    // It should contain "Sent data: " (with nothing after colon)
    expect(out).toContain('Sent data: ');

    // No console/page errors expected
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('Disconnect from Connected state transitions back to Disconnected and logs Disconnected.', async () => {
    // Connect
    await tcp.setIp('8.8.8.8');
    await tcp.setPort('53');
    await tcp.clickConnect();

    // Disconnect
    await tcp.clickDisconnect();

    const out = await tcp.getOutputText();
    expect(out).toContain('Disconnected.');

    // After disconnecting, attempting to send data should trigger the "not connected" alert again
    dialogs.length = 0; // reset captured dialogs for clarity
    await tcp.setDataToSend('Should fail');
    await tcp.clickSendData();
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[dialogs.length - 1].message).toContain('You must be connected to send data.');

    // No console/page errors expected
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('Edge case: Disconnect when already disconnected shows alert', async () => {
    // Ensure initial state is disconnected; clicking disconnect should alert "You are not connected."
    await tcp.clickDisconnect();

    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    const lastDialog = dialogs[dialogs.length - 1];
    expect(lastDialog.message).toContain('You are not connected.');

    // No changes to output expected
    const out = await tcp.getOutputText();
    expect(out).not.toContain('Disconnected.');

    // No console/page errors expected
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('Reset action sets output to "Simulation reset." and keeps state disconnected', async () => {
    // Connect first to change state and logs
    await tcp.setIp('1.2.3.4');
    await tcp.setPort('9999');
    await tcp.clickConnect();

    // Ensure something is in the log first
    let out = await tcp.getOutputText();
    expect(out).toContain('Connected to 1.2.3.4:9999');

    // Click Reset
    await tcp.clickReset();

    out = await tcp.getOutputText();
    // The app sets logOutput = "Simulation reset.\n" on reset
    expect(out).toContain('Simulation reset.');

    // After reset (disconnected), attempt send data should alert
    dialogs.length = 0;
    await tcp.setDataToSend('After reset');
    await tcp.clickSendData();
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[dialogs.length - 1].message).toContain('You must be connected to send data.');

    // No console/page errors expected
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('Verbose logging appends verbose messages to the output when enabled', async () => {
    // Enable verbose logging before actions
    await tcp.toggleVerbose(true);

    // Connect should produce Connected message and then cause updateOutput to append verbose line
    await tcp.setIp('10.10.10.10');
    await tcp.setPort('2020');
    await tcp.clickConnect();

    let out = await tcp.getOutputText();

    // The verbose line appended by updateOutput looks like: [Verbose Mode On] - Current State: connected
    expect(out).toContain('Connected to 10.10.10.10:2020');
    expect(out).toMatch(/\[Verbose Mode On\].*Current State: connected/);

    // Now disconnect; updateOutput with verbose should append a verbose line showing disconnected
    await tcp.clickDisconnect();
    out = await tcp.getOutputText();
    expect(out).toContain('Disconnected.');
    expect(out).toMatch(/\[Verbose Mode On\].*Current State: disconnected/);

    // No console/page errors expected
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('Observe console and page errors: ensure no uncaught exceptions during typical flows', async () => {
    // Run a sequence of operations that cover many code paths
    await tcp.setIp('5.5.5.5');
    await tcp.setPort('55');
    await tcp.clickConnect();

    await tcp.setDataToSend('alpha');
    await tcp.clickSendData();

    await tcp.clickDisconnect();

    await tcp.clickReset();

    // After the interactions, assert that there were no console "error" messages and no page errors
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);

    // Also check there were some log entries in the output (sanity check)
    const out = await tcp.getOutputText();
    expect(out.length).toBeGreaterThan(0);
  });
});