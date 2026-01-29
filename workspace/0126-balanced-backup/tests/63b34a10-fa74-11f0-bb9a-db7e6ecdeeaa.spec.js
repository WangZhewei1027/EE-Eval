import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b34a10-fa74-11f0-bb9a-db7e6ecdeeaa.html';

/**
 * Page Object for the TCP/IP demo page.
 * Encapsulates common selectors and helpers used across tests.
 */
class TcpIpPage {
  constructor(page) {
    this.page = page;
    this.sendButton = page.locator('#sendButton');
    this.sourceSelect = page.locator('#sourceSelect');
    this.destSelect = page.locator('#destSelect');
    this.eventsLog = page.locator('#eventsLog');
    this.networkDiagram = page.locator('#networkDiagram');
    this.devicesContainer = page.locator('#devicesContainer');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait for initial ready log and UI to be present
    await expect(this.eventsLog).toContainText('TCP/IP Simulation Ready.');
    await expect(this.sendButton).toBeVisible();
    await expect(this.sourceSelect).toBeVisible();
    await expect(this.destSelect).toBeVisible();
  }

  // Return current logs text content
  async getLogsText() {
    return await this.page.evaluate(() => document.getElementById('eventsLog').innerText);
  }

  // Wait for a log entry that contains `text`
  async waitForLog(text, timeout = 10000) {
    await this.page.waitForFunction(
      (sel, t) => {
        const el = document.querySelector(sel);
        return el && el.innerText.includes(t);
      },
      this.eventsLog.selector(),
      text,
      { timeout }
    );
  }

  // Click send and handle prompt/alert externally by test
  async clickSend() {
    await this.sendButton.click();
  }

  // Convenience to check packet presence in SVG
  packetLocator() {
    return this.page.locator('#networkDiagram .packet');
  }

  // Utility to set selects by visible value or by index
  async selectSourceByValue(value) {
    // There are known option values equal to IPs; if cannot select using selectOption (value not present),
    // we fallback to direct assignment in page context (allowed).
    const options = await this.sourceSelect.locator('option').all();
    const values = await Promise.all(options.map(o => o.getAttribute('value')));
    if (values.includes(value)) {
      await this.sourceSelect.selectOption({ value });
    } else {
      await this.page.evaluate((v) => { document.getElementById('sourceSelect').value = v; }, value);
      // dispatch change event to mimic user change (some handlers may depend)
      await this.page.evaluate(() => {
        const sel = document.getElementById('sourceSelect');
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
  }

  async selectDestByValue(value) {
    const options = await this.destSelect.locator('option').all();
    const values = await Promise.all(options.map(o => o.getAttribute('value')));
    if (values.includes(value)) {
      await this.destSelect.selectOption({ value });
    } else {
      await this.page.evaluate((v) => { document.getElementById('destSelect').value = v; }, value);
      await this.page.evaluate(() => {
        const sel = document.getElementById('destSelect');
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
  }
}

test.describe('TCP/IP Concept Demonstration - FSM states & transitions', () => {
  // Collect console errors and page errors per test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test('Initial Idle state: UI ready and Ready log present (S0_Idle)', async ({ page }) => {
    const app = new TcpIpPage(page);
    await app.goto();

    // Validate initial "TCP/IP Simulation Ready." log (entry action evidence)
    const logs = await app.getLogsText();
    expect(logs).toContain('TCP/IP Simulation Ready.');

    // sendButton should be enabled in Idle (S0) prior to any send
    await expect(app.sendButton).toBeEnabled();

    // Ensure selects are populated with at least two options
    const sourceOptions = app.sourceSelect.locator('option');
    const destOptions = app.destSelect.locator('option');
    await expect(sourceOptions).toHaveCountGreaterThan(0);
    await expect(destOptions).toHaveCountGreaterThan(0);

    // No console or page errors should have occurred during init
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Selecting source and destination updates selects (SelectSource & SelectDestination events)', async ({ page }) => {
    const app = new TcpIpPage(page);
    await app.goto();

    // Change source to second option and destination to third option (if available)
    const srcOptions = await app.sourceSelect.locator('option').allTextContents();
    const destOptions = await app.destSelect.locator('option').allTextContents();

    // choose indices safely
    const srcIndex = srcOptions.length > 1 ? 1 : 0;
    const destIndex = destOptions.length > 2 ? 2 : (destOptions.length > 1 ? 1 : 0);

    // Get values to assert later
    const srcValue = await app.sourceSelect.locator('option').nth(srcIndex).getAttribute('value');
    const destValue = await app.destSelect.locator('option').nth(destIndex).getAttribute('value');

    await app.sourceSelect.selectOption({ index: srcIndex });
    await app.destSelect.selectOption({ index: destIndex });

    // Verify the selects reflect chosen values
    expect(await app.sourceSelect.inputValue()).toBe(srcValue);
    expect(await app.destSelect.inputValue()).toBe(destValue);

    // No console/page errors observed
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Clicking Send with same source and destination triggers alert and stays in Idle (edge case)', async ({ page }) => {
    const app = new TcpIpPage(page);
    await app.goto();

    // Make both selects the same value (pick the first option)
    const firstValue = await app.sourceSelect.locator('option').first().getAttribute('value');
    await app.selectSourceByValue(firstValue);
    await app.selectDestByValue(firstValue);

    // Listen for dialog and assert correct alert message appears
    const dialogs = [];
    page.on('dialog', async dialog => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept(); // close alert
    });

    await app.clickSend();

    // Wait a short moment to let the alert be dispatched
    await page.waitForTimeout(200);

    // We expect an alert to have been shown with the message about same IPs
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    const alertDialog = dialogs.find(d => d.type === 'alert');
    expect(alertDialog).toBeTruthy();
    expect(alertDialog.message).toBe('Source and destination IP cannot be the same.');

    // Ensure no sending logs were added - 'User requests sending message' should not be present
    const logs = await app.getLogsText();
    expect(logs).not.toContain('User requests sending message');

    // sendButton should remain enabled (we did not enter sending state)
    await expect(app.sendButton).toBeEnabled();

    // No console/page errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Successful send sequence transitions: S0 -> S1 -> S2 -> S3 and button disabled/enabled as expected', async ({ page }) => {
    const app = new TcpIpPage(page);
    await app.goto();

    // Choose two different devices (first and second)
    const srcValue = await app.sourceSelect.locator('option').first().getAttribute('value');
    const destValue = await app.destSelect.locator('option').nth(1).getAttribute('value');

    await app.selectSourceByValue(srcValue);
    await app.selectDestByValue(destValue);

    // Prepare to handle prompt for message content
    page.on('dialog', async dialog => {
      if (dialog.type() === 'prompt') {
        // Provide a custom message to be sent
        await dialog.accept('Hello Playwright!');
      } else {
        await dialog.accept();
      }
    });

    // Click send; this should immediately trigger S1 entry action (sendButton.disabled = true)
    await app.clickSend();

    // As soon as send is initiated, sendButton should be disabled per S1 entry action
    await expect(app.sendButton).toBeDisabled();

    // Wait for a log indicating the sending started (S1->S2 transition evidence)
    await app.waitForLog(`User requests sending message from ${srcValue} to ${destValue}`);
    await app.waitForLog(`Sending packet from ${srcValue} to ${destValue} over the network...`);

    // At this point a packet rect should be created in SVG (S2_PacketInTransit evidence)
    await expect(app.packetLocator()).toHaveCount(1);

    // Wait for animation to finish and final reception log (S3)
    await app.waitForLog('Packet arrived at destination device.', 10000);
    await app.waitForLog('Message received: "Hello Playwright!"', 10000);

    // After completion, sendButton should be re-enabled (S1 exit action / finalization)
    await expect(app.sendButton).toBeEnabled();

    // Ensure packet element was removed after arrival
    await expect(app.packetLocator()).toHaveCount(0);

    // Validate that TCP/IP layer logs are present in events (evidence of steps)
    const logsText = await app.getLogsText();
    expect(logsText).toContain('[Application Layer] Message to send: "Hello Playwright!"');
    expect(logsText).toContain('[TCP Layer] Encapsulating message into TCP segment...');
    expect(logsText).toContain('[IP Layer] Encapsulating TCP segment into IP packet...');
    expect(logsText).toContain('[Application Layer] Delivering message to application...');
    expect(logsText).toContain('Message received: "Hello Playwright!"');

    // No console/page errors happened during the flow
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  }, 20000); // increase timeout to allow animation to complete

  test('Sending with empty message triggers "Message cannot be empty." and does not send', async ({ page }) => {
    const app = new TcpIpPage(page);
    await app.goto();

    // Choose two different devices
    const srcValue = await app.sourceSelect.locator('option').first().getAttribute('value');
    const destValue = await app.destSelect.locator('option').nth(1).getAttribute('value');

    await app.selectSourceByValue(srcValue);
    await app.selectDestByValue(destValue);

    // Dialog handling: respond to prompt with empty string and capture the subsequent alert
    const dialogs = [];
    page.on('dialog', async dialog => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      if (dialog.type() === 'prompt') {
        // Accept with empty/whitespace message to trigger empty message branch
        await dialog.accept('   ');
      } else {
        await dialog.accept();
      }
    });

    await app.clickSend();

    // wait briefly for alert to occur
    await page.waitForTimeout(200);

    // There should be at least two dialogs: prompt and then alert
    const foundAlert = dialogs.find(d => d.type === 'alert' && d.message === 'Message cannot be empty.');
    expect(foundAlert).toBeTruthy();

    // Ensure sending did not start: no "User requests sending message" log
    const logs = await app.getLogsText();
    expect(logs).not.toContain('User requests sending message');

    // sendButton should remain enabled
    await expect(app.sendButton).toBeEnabled();

    // No console/page errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Invalid destination IP (manually set) logs error and re-enables send button', async ({ page }) => {
    const app = new TcpIpPage(page);
    await app.goto();

    // Pick a valid source but set destination to an invalid IP value (not in devicePositions)
    const srcValue = await app.sourceSelect.locator('option').first().getAttribute('value');
    await app.selectSourceByValue(srcValue);

    // Force destSelect to an invalid IP string (direct DOM mutation)
    const invalidIp = '1.2.3.4';
    await app.selectDestByValue(invalidIp);

    // Provide a normal prompt message so sendMessage proceeds to IP lookup
    page.on('dialog', async dialog => {
      if (dialog.type() === 'prompt') {
        await dialog.accept('Testing invalid dest');
      } else {
        await dialog.accept();
      }
    });

    // Click send to attempt sending
    await app.clickSend();

    // Expect 'User requests sending message' to appear (send started), then later an error for invalid IP
    await app.waitForLog(`User requests sending message from ${srcValue} to ${invalidIp}`);
    // The implementation logs an error and disables/enables flags
    await app.waitForLog('Error: Invalid source or destination IP address.');

    // After error, sendButton should be re-enabled
    await expect(app.sendButton).toBeEnabled();

    // Ensure 'Packet arrived' or 'Message received' did NOT occur
    const logs = await app.getLogsText();
    expect(logs).not.toContain('Packet arrived at destination device.');
    expect(logs).not.toContain('Message received:');

    // No console/page errors observed
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});

// Extend expect with a helper to assert locator count greater than a number
expect.extend = expect.extend || function () {}; // guard in some runtimes

// Add a small helper matcher for convenience in tests above
// Note: Using this inline to avoid modifying global test runner config files.
const originalToHaveCount = expect(locator => locator).toHaveCount;
if (!originalToHaveCount) {
  // nothing to do; Playwright's expect has toHaveCount already
}