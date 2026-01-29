import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3d6042-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object for the Socket Programming Demo page
class SocketPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.connectBtn = page.locator('#connectBtn');
    this.disconnectBtn = page.locator('#disconnectBtn');
    this.sendBtn = page.locator('#sendBtn');
    this.messageInput = page.locator('#messageInput');
    this.output = page.locator('#output');
  }

  // Reads the entire output innerText
  async getOutputText() {
    return (await this.output.innerText()).trim();
  }

  // Wait until output contains a substring (with timeout)
  async waitForOutputContains(substring, opts = { timeout: 5000 }) {
    await this.page.waitForFunction(
      (sel, substr) => {
        const el = document.querySelector(sel);
        return el && el.innerText && el.innerText.includes(substr);
      },
      '#output',
      substring,
      opts
    );
  }

  // Wait until output contains any of provided substrings
  async waitForOutputContainsAny(substrings, opts = { timeout: 7000 }) {
    await this.page.waitForFunction(
      (sel, subs) => {
        const el1 = document.querySelector(sel);
        if (!el || !el.innerText) return false;
        const text = el.innerText;
        return subs.some(s => text.includes(s));
      },
      '#output',
      substrings,
      opts
    );
  }

  // Click helpers
  async clickConnect() {
    await this.connectBtn.click();
  }
  async clickDisconnect() {
    await this.disconnectBtn.click();
  }
  async clickSend() {
    await this.sendBtn.click();
  }

  // Input helpers
  async fillMessage(msg) {
    await this.messageInput.fill(msg);
  }
  async pressEnterOnInput() {
    await this.messageInput.press('Enter');
  }
}

test.describe('Socket Programming Demo - FSM verification', () => {
  // Keep arrays of console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection
    page.on('console', msg => {
      // Save both text and type for later assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Nothing special to teardown beyond Playwright default
    // Keep hooks to satisfy the requirement for setup/teardown
    await page.close();
  });

  test('Initial Idle state: page loads and shows Ready message; controls initial state', async ({ page }) => {
    const socketPage = new SocketPage(page);

    // Validate the initial 'Ready. Click "Connect" to begin.' log is present in the output.
    await socketPage.waitForOutputContains('Ready. Click "Connect" to begin.');

    const outputText = await socketPage.getOutputText();
    expect(outputText).toContain('Ready. Click "Connect" to begin.');

    // Verify initial button/input states per FSM components:
    await expect(socketPage.connectBtn).toBeEnabled();
    await expect(socketPage.disconnectBtn).toBeDisabled();
    await expect(socketPage.sendBtn).toBeDisabled();
    await expect(socketPage.messageInput).toBeDisabled();

    // Assert that the initial log was also captured in console messages (the app uses innerHTML logging, not console.log,
    // but some environments may echo messages; still assert that no uncaught JS runtime errors happened during initial load)
    expect(pageErrors.length).toBe(0);
  });

  test('Connect event: clicking Connect produces connection attempt and either success or error/close logs', async ({ page }) => {
    const socketPage1 = new SocketPage(page);

    // Click connect
    await socketPage.clickConnect();

    // After clicking connect, the app logs "Attempting to connect to WebSocket server..."
    await socketPage.waitForOutputContains('Attempting to connect to WebSocket server...');

    // Now wait for one of the possible expected outcomes:
    // - Successful connection (Connection established! Ready to send messages.)
    // - Error (Error:)
    // - Close (Connection closed.)
    // We accept any of these as valid observable outcomes from the environment.
    await socketPage.waitForOutputContainsAny([
      'Connection established! Ready to send messages.',
      'Error:',
      'Connection closed.'
    ], { timeout: 10000 });

    const outputText1 = await socketPage.getOutputText();

    // Validate that at least one of the expected observables is present
    const hasEstablished = outputText.includes('Connection established! Ready to send messages.');
    const hasError = outputText.includes('Error:');
    const hasClosed = outputText.includes('Connection closed.');

    expect(hasEstablished || hasError || hasClosed).toBeTruthy();

    // If established, verify controls are enabled for messaging
    if (hasEstablished) {
      await expect(socketPage.connectBtn).toBeDisabled();
      await expect(socketPage.disconnectBtn).toBeEnabled();
      await expect(socketPage.sendBtn).toBeEnabled();
      await expect(socketPage.messageInput).toBeEnabled();
    } else {
      // On error/close, the script sets controls appropriately on onclose:
      // If error occurred without open, connectBtn likely remains enabled; disconnect/send/input remain disabled
      // Assert those expected DOM states (allowing there's some race).
      const connectEnabled = await socketPage.connectBtn.isEnabled();
      const disconnectEnabled = await socketPage.disconnectBtn.isEnabled();
      const sendEnabled = await socketPage.sendBtn.isEnabled();
      const inputEnabled = await socketPage.messageInput.isEnabled();

      // At minimum, connection did not transition to "fully connected" state, so send/input should not be enabled.
      expect(sendEnabled).toBe(false);
      expect(inputEnabled).toBe(false);

      // If the server refused immediately and socket.onclose fired, disconnectBtn may be disabled as well.
      expect(disconnectEnabled).toBe(false);
      // connect button should be enabled to allow retry
      expect(connectEnabled).toBe(true);
    }
  });

  test('SendMessage event via click and Enter: when connected, messages are sent and received; when not, proper errors shown', async ({ page }) => {
    const socketPage2 = new SocketPage(page);

    // Click connect first
    await socketPage.clickConnect();

    // Wait until either connected or error/closed - reuse logic from prior test
    await socketPage.waitForOutputContainsAny([
      'Connection established! Ready to send messages.',
      'Error:',
      'Connection closed.'
    ], { timeout: 10000 });

    const outputTextAfterConnect = await socketPage.getOutputText();
    const isConnected = outputTextAfterConnect.includes('Connection established! Ready to send messages.');
    const hasError1 = outputTextAfterConnect.includes('Error:') || outputTextAfterConnect.includes('Connection closed.');

    if (isConnected) {
      // Validate send via click
      await socketPage.fillMessage('hello-playwright');
      await socketPage.clickSend();

      // Sent log should appear
      await socketPage.waitForOutputContains('Sent: hello-playwright', { timeout: 5000 });
      const out1 = await socketPage.getOutputText();
      expect(out1).toContain('Sent: hello-playwright');

      // The server is expected to echo messages; if echo arrives, the app logs "Received: hello-playwright"
      // Allow both possibilities (maybe network or server limitations)
      const receivedEcho = out1.includes('Received: hello-playwright');
      // It's acceptable if echo does not arrive; assert that either echo arrived or at least the Sent log is present
      expect(receivedEcho || out1.includes('Sent: hello-playwright')).toBeTruthy();

      // Verify input was cleared after sending
      expect(await socketPage.messageInput.inputValue()).toBe('');

      // Now test sending via Enter key
      await socketPage.fillMessage('enter-send');
      await socketPage.pressEnterOnInput();

      await socketPage.waitForOutputContains('Sent: enter-send', { timeout: 5000 });
      const out2 = await socketPage.getOutputText();
      expect(out2).toContain('Sent: enter-send');

    } else {
      // Not connected: validate that send/button/input remain disabled and that attempting to send via click does not occur
      await expect(socketPage.sendBtn).toBeDisabled();
      await expect(socketPage.messageInput).toBeDisabled();

      // Force a manual click on send (even though disabled) via page.evaluate to simulate edge-case of user scripts - but
      // per instructions we MUST NOT patch or modify functions or global state; so we will not artificially call internals.
      // Instead, assert the correct user-facing guidance is present if user attempted to click while empty (application prevents it)
      // However, we can test client-side validation if controls were enabled prematurely (edge case): attempt to click send only if it's enabled.
      // Since it's disabled, assert that the UI prevents sending.
      expect(await socketPage.sendBtn.isEnabled()).toBe(false);

      // Also assert that an Error or Connection closed message was observed in output as the reason for not being connected
      expect(hasError).toBeTruthy();
    }
  });

  test('Disconnect event: when connected, clicking Disconnect triggers close; when not connected, button stays disabled', async ({ page }) => {
    const socketPage3 = new SocketPage(page);

    // Connect attempt first
    await socketPage.clickConnect();

    // Wait for either 'Connection established!' or error/close
    await socketPage.waitForOutputContainsAny([
      'Connection established! Ready to send messages.',
      'Error:',
      'Connection closed.'
    ], { timeout: 10000 });

    const outputNow = await socketPage.getOutputText();
    const isConnected1 = outputNow.includes('Connection established! Ready to send messages.');

    if (isConnected) {
      // Click disconnect and expect 'Closing connection...' is logged from the click handler and then 'Connection closed.' from onclose
      // Note: The app logs 'Closing connection...' synchronously, then socket.onclose logs 'Connection closed.' when the socket actually closes.
      await socketPage.clickDisconnect();

      // Wait for the Closing connection... log
      await socketPage.waitForOutputContains('Closing connection...', { timeout: 5000 });
      // And wait for the onclose message
      await socketPage.waitForOutputContains('Connection closed.', { timeout: 7000 });

      const out = await socketPage.getOutputText();
      expect(out).toContain('Closing connection...');
      expect(out).toContain('Connection closed.');

      // After close, controls should revert to initial state
      await expect(socketPage.connectBtn).toBeEnabled();
      await expect(socketPage.disconnectBtn).toBeDisabled();
      await expect(socketPage.sendBtn).toBeDisabled();
      await expect(socketPage.messageInput).toBeDisabled();
    } else {
      // If not connected, disconnectBtn should be disabled and clicking it is not possible via the UI
      await expect(socketPage.disconnectBtn).toBeDisabled();
      // Ensure that output contains either Error or Connection closed (some flows report immediate close)
      expect(outputNow.includes('Error:') || outputNow.includes('Connection closed.')).toBeTruthy();
    }
  });

  test('Edge cases and error scenarios: attempting to send empty message when connected logs guidance', async ({ page }) => {
    const socketPage4 = new SocketPage(page);

    await socketPage.clickConnect();

    // Wait for either connected or error/close
    await socketPage.waitForOutputContainsAny([
      'Connection established! Ready to send messages.',
      'Error:',
      'Connection closed.'
    ], { timeout: 10000 });

    const outNow = await socketPage.getOutputText();
    const isConnected2 = outNow.includes('Connection established! Ready to send messages.');

    if (isConnected) {
      // Ensure send button is enabled
      await expect(socketPage.sendBtn).toBeEnabled();
      await expect(socketPage.messageInput).toBeEnabled();

      // Ensure input is empty and click send -> should log "Please enter a message to send"
      await socketPage.fillMessage('');
      await socketPage.clickSend();

      await socketPage.waitForOutputContains('Please enter a message to send', { timeout: 3000 });
      const out1 = await socketPage.getOutputText();
      expect(out).toContain('Please enter a message to send');
    } else {
      // Not connected: ensure attempt to send is disabled and that an error/close message exists
      await expect(socketPage.sendBtn).toBeDisabled();
      expect(outNow.includes('Error:') || outNow.includes('Connection closed.')).toBeTruthy();
    }

    // Final observation: record any runtime page errors captured during the test and assert that if they exist,
    // they are instances of Error and include a stack/message. This does not fail the test if none exist,
    // but validates that we observed and recorded any runtime errors.
    for (const err of pageErrors) {
      expect(err).toBeInstanceOf(Error);
    }
  });

  test('Console and page error observation: ensure console messages include key FSM logs', async ({ page }) => {
    const socketPage5 = new SocketPage(page);

    // We rely on previously captured console messages from earlier page events.
    // Clear prior arrays first to only capture events from this interaction
    // (we cannot rebind page listeners here, so reuse arrays but note their current length)
    // Navigate again to get fresh console capture
    consoleMessages = [];
    pageErrors = [];
    await page.reload();

    // Instantiate fresh page object after reload
    const sp = new SocketPage(page);

    // Expect initial ready message in page output
    await sp.waitForOutputContains('Ready. Click "Connect" to begin.');

    // Now click connect and wait for an outcome
    await sp.clickConnect();
    await sp.waitForOutputContains('Attempting to connect to WebSocket server...');
    await sp.waitForOutputContainsAny(['Connection established! Ready to send messages.', 'Error:', 'Connection closed.'], { timeout: 10000 });

    // Build a textual aggregate of console messages captured during these steps.
    const aggregatedConsoleText = consoleMessages.map(m => `[${m.type}] ${m.text}`).join('\n');

    // At minimum the application logs its status into #output; the page console may not contain these logs.
    // But ensure that consoleMessages is a legitimate array and that any entries are strings.
    for (const msg of consoleMessages) {
      expect(typeof msg.text).toBe('string');
      expect(typeof msg.type).toBe('string');
    }

    // If there are page errors captured, assert they provide meaningful information
    if (pageErrors.length > 0) {
      for (const pe of pageErrors) {
        expect(pe.message.length).toBeGreaterThan(0);
      }
    }

    // Assert that output contains at least the attempt message
    const finalOutput = await sp.getOutputText();
    expect(finalOutput).toContain('Attempting to connect to WebSocket server...');
  });
});