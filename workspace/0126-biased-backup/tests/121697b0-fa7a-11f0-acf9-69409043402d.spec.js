import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/121697b0-fa7a-11f0-acf9-69409043402d.html';

// Page object encapsulating UI interactions and helpful helpers
class SocketAppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Main controls
    this.ipAddress = page.locator('#ipAddress');
    this.portNumber = page.locator('#portNumber');
    this.protocolSelect = page.locator('#protocolSelect');
    this.socketTypeSelect = page.locator('#socketTypeSelect');
    this.createSocketBtn = page.locator('#createSocketBtn');
    this.closeSocketBtn = page.locator('#closeSocketBtn');
    this.socketStateDiv = page.locator('#socketState');

    // Server related
    this.listenBtn = page.locator('#listenBtn');
    this.stopListenBtn = page.locator('#stopListenBtn');
    this.backlogSlider = page.locator('#backlogSlider');
    this.backlogValue = page.locator('#backlogValue');

    // Connection controls
    this.connectBtn = page.locator('#connectBtn');
    this.disconnectBtn = page.locator('#disconnectBtn');

    // Message exchange
    this.messageInput = page.locator('#messageInput');
    this.sendMsgBtn = page.locator('#sendMsgBtn');
    this.receivedMessages = page.locator('#receivedMessages');
    this.logs = page.locator('#logs');

    // Network controls
    this.latencySlider = page.locator('#latencySlider');
    this.packetLossSlider = page.locator('#packetLossSlider');

    // Extra controls injected dynamically
    this.acceptConBtn = page.locator('button', { hasText: 'Accept Next Connection' });
    this.connectionsSelect = page.locator('select').nth(-1); // extra select appended after logs
    this.sendToConnInput = page.locator('input[placeholder="Message to selected connection"]');
    this.sendToConnBtn = page.locator('button', { hasText: 'Send to Selected Connection' });
    this.disconnectConnBtn = page.locator('button', { hasText: 'Disconnect Selected Connection' });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // stabilize initial UI
    await this.page.waitForTimeout(50);
  }

  // Create socket via UI with given type and protocol (ip/port default from inputs unless provided)
  async createSocket({ type = 'server', protocol = 'TCP', ip = null, port = null } = {}) {
    if (ip !== null) await this.ipAddress.fill(String(ip));
    if (port !== null) await this.portNumber.fill(String(port));
    await this.protocolSelect.selectOption(protocol);
    await this.socketTypeSelect.selectOption(type);
    await this.createSocketBtn.click();
  }

  async closeSocket() {
    await this.closeSocketBtn.click();
  }

  async startListening() {
    await this.listenBtn.click();
  }

  async stopListening() {
    await this.stopListenBtn.click();
  }

  async acceptNextConnection() {
    await this.acceptConBtn.click();
  }

  // Send message from server to selected accepted connection
  async sendToSelectedConnection(msg) {
    await this.sendToConnInput.fill(msg);
    await this.sendToConnBtn.click();
  }

  async disconnectSelectedConnection() {
    await this.disconnectConnBtn.click();
  }

  // Create a "virtual" client SimSocket object inside the page and queue it into server listening queue.
  // This uses the page's SimSocket class and server instance already in page scope.
  // Returns boolean whether queue succeeded.
  async createVirtualClientAndQueue({ ip = '127.0.0.1', port = 8080, protocol = 'TCP' } = {}) {
    return await this.page.evaluate(
      ({ ip, port, protocol }) => {
        try {
          // Create a client socket object (not via createSocket UI)
          const client = new SimSocket('client', protocol, ip, port);
          // Client's onReceive handler for debugging (appendReceived is available)
          client.onReceive = (msg, fromSock) => {
            appendReceived(`From ${fromSock.type}:${fromSock.ip}:${fromSock.port} -> ${msg}`);
            appendLog(`Virtual client received: "${msg}"`);
          };
          // Attempt to queue into globally registered simulated server (if any)
          const server = window._simulatedServerSocket;
          if (!server) {
            appendLog('No simulated server socket present to queue virtual client.');
            return false;
          }
          const queued = server.queueConnection(client);
          return queued;
        } catch (e) {
          // Expose error to logs
          appendLog('Error during createVirtualClientAndQueue: ' + (e && e.message));
          return false;
        }
      },
      { ip, port, protocol }
    );
  }

  // Helper to read logs textarea full content
  async getLogsText() {
    return await this.logs.inputValue();
  }

  async getReceivedText() {
    return await this.receivedMessages.inputValue();
  }

  async getSocketStateText() {
    return await this.socketStateDiv.textContent();
  }

  async getAcceptedConnectionsCount() {
    return await this.page.evaluate(() => {
      try {
        if (!window.currentSocket || window.currentSocket.type !== 'server') return 0;
        return window.currentSocket.acceptedConnections.length;
      } catch (e) {
        return 0;
      }
    });
  }

  async getServerState() {
    return await this.page.evaluate(() => {
      if (!window.currentSocket) return null;
      return window.currentSocket.state;
    });
  }

  // Directly call client.connect logic in page for a "virtual" client object (not via UI).
  // This returns the eventual state of the client after the internal timeouts settle (promise resolves when client either connected or disconnected).
  async createVirtualClientAndConnect({ ip = '127.0.0.1', port = 8080, protocol = 'TCP', timeout = 4000 } = {}) {
    return await this.page.evaluate(
      ({ ip, port, protocol, timeout }) =>
        new Promise((resolve) => {
          try {
            const client = new SimSocket('client', protocol, ip, port);
            client.onReceive = (msg, fromSock) => {
              appendReceived(`From ${fromSock.type}:${fromSock.ip}:${fromSock.port} -> ${msg}`);
              appendLog(`Virtual client received: "${msg}"`);
            };
            // Start client connection attempt similarly to UI connect flow but direct
            if (!client.connect()) {
              appendLog('Virtual client.connect() reported failure immediately.');
              resolve(client.state);
              return;
            }
            appendLog('Virtual client initiating connection...');
            const simulatedServerSocket = window._simulatedServerSocket;
            function finalizeClientConnect(success) {
              if (success) {
                client.state = 'connected';
                appendLog('Virtual client connected successfully.');
              } else {
                client.state = 'disconnected';
                appendLog('Virtual client connection failed or refused.');
              }
              resolve(client.state);
            }
            if (
              simulatedServerSocket &&
              simulatedServerSocket.state === 'listening' &&
              simulatedServerSocket.ip === client.ip &&
              simulatedServerSocket.port === client.port
            ) {
              const accepted = simulatedServerSocket.queueConnection(client);
              if (!accepted) {
                setTimeout(() => finalizeClientConnect(false), 500);
                return;
              }
              setTimeout(() => {
                simulatedServerSocket.accept();
                finalizeClientConnect(true);
              }, 200);
            } else {
              setTimeout(() => finalizeClientConnect(false), 500);
            }
          } catch (e) {
            appendLog('Error in createVirtualClientAndConnect: ' + (e && e.message));
            resolve('error');
          }
        }),
      { ip, port, protocol, timeout }
    );
  }
}

test.describe('Socket Programming Interactive Demo - Full FSM validation', () => {
  // capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // capture console messages (log, error, warn, etc.)
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // navigate to app
    const app = new SocketAppPage(page);
    await app.goto();
  });

  test.afterEach(async ({ page }) => {
    // Expose console messages and page errors if needed for debugging assertions
    // Assert there were no unexpected page errors (uncaught exceptions). Tests below will assert expected behavior via logs.
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Initial state and UI availability', () => {
    test('Initial page loads with "Socket not created" and controls in correct disabled/enabled states', async ({ page }) => {
      const app = new SocketAppPage(page);

      // Verify initial socket state text
      const stateText = await app.getSocketStateText();
      expect(stateText.trim()).toBe('Socket not created');

      // Create button enabled, close disabled, listen disabled
      await expect(app.createSocketBtn).toBeEnabled();
      await expect(app.closeSocketBtn).toBeDisabled();
      await expect(app.listenBtn).toBeDisabled();
      await expect(app.connectBtn).toBeDisabled();

      // Logs and received messages are empty initially
      expect((await app.getLogsText()).trim()).toBe('');
      expect((await app.getReceivedText()).trim()).toBe('');
    });
  });

  test.describe('Server lifecycle and server-client interactions', () => {
    test('Create server -> Start listening -> Accept queued connection -> send to client -> disconnect client -> stop listening -> close server', async ({
      page
    }) => {
      const app = new SocketAppPage(page);

      // 1) Create server socket via UI (S0_NotCreated -> S1_Created)
      await app.createSocket({ type: 'server', protocol: 'TCP' });

      // Wait for simulated server registration log (this happens via setTimeout)
      await page.waitForFunction(() => {
        return document.querySelector('#logs').value.includes('Simulated server socket registered globally for client connections.')
          || document.querySelector('#logs').value.includes('Socket created');
      }, null, { timeout: 2000 });

      // Verify created state and logs
      const logsAfterCreate = await app.getLogsText();
      expect(logsAfterCreate).toContain('Socket created');
      expect(logsAfterCreate).toContain('Created new SERVER socket'.toLowerCase(), { substring: false }); // some text may vary; ensure created message exists
      // Check server state text contains created
      const stateText = await app.getSocketStateText();
      expect(stateText).toContain('State: created');

      // Confirm server controls enabled appropriately
      await expect(app.listenBtn).toBeEnabled();
      await expect(app.backlogSlider).toBeEnabled();

      // 2) Start listening (S1_Created -> S2_Listening)
      await app.startListening();

      // Wait for logs indicating listening
      await page.waitForFunction(() => document.querySelector('#logs').value.includes('Server started listening'), null, { timeout: 2000 });

      const logsAfterListen = await app.getLogsText();
      expect(logsAfterListen).toContain('Now listening with backlog');
      expect(logsAfterListen).toContain('Server started listening');

      // server state should reflect listening
      const serverState = await app.getServerState();
      expect(serverState).toBe('listening');

      // 3) Create a virtual client object in page and queue it to the server listening queue.
      const queued = await app.createVirtualClientAndQueue({ ip: await app.ipAddress.inputValue(), port: Number(await app.portNumber.inputValue()) });
      expect(queued).toBe(true);

      // When queued, logs should indicate queued new connection
      await page.waitForFunction(() => document.querySelector('#logs').value.includes('Queued new connection') || document.querySelector('#logs').value.includes('Queued new connection from'), null, { timeout: 2000 });
      const logsAfterQueue = await app.getLogsText();
      expect(logsAfterQueue).toContain('Queued new connection');

      // 4) Accept next connection using the UI "Accept Next Connection" button
      // Ensure extra controls are available
      await expect(app.acceptConBtn).toBeEnabled();
      await app.acceptNextConnection();

      // Accept action appends logs and may update acceptedConnections; wait for accepted log
      await page.waitForFunction(() => document.querySelector('#logs').value.includes('Accepted new connection') || document.querySelector('#logs').value.includes('Accepted connection from'), null, { timeout: 2000 });

      // Verify that server has one accepted connection and its state is 'connected'
      const acceptedCount = await app.getAcceptedConnectionsCount();
      expect(acceptedCount).toBeGreaterThanOrEqual(1);

      // Check accepted connection entry was added to the select and is displayed
      await expect(app.connectionsSelect).toHaveCount(1); // at least one select element exists
      // Wait for options to populate
      await page.waitForFunction(() => {
        const sel = document.querySelectorAll('select');
        if (!sel || sel.length === 0) return false;
        const last = sel[sel.length - 1];
        return last.options && last.options.length > 0;
      }, null, { timeout: 2000 });

      // 5) Send a message from server to selected client
      // Select first accepted connection
      await page.evaluate(() => {
        const sel = document.querySelectorAll('select');
        const last = sel[sel.length - 1];
        if (last) last.selectedIndex = 0;
        // trigger change event so UI refreshes
        const evt = new Event('change');
        last.dispatchEvent(evt);
      });

      const testMsg = 'HelloClient';
      await app.sendToSelectedConnection(testMsg);

      // Wait for network scheduling logs and for the client receive to appear in receivedMessages
      await page.waitForFunction(
        (msg) => {
          const logs = document.querySelector('#logs').value;
          const received = document.querySelector('#receivedMessages').value;
          return logs.includes('Message scheduled') || logs.includes('Server sending to client') || received.includes(msg) || logs.includes('Server connection received message');
        },
        testMsg,
        { timeout: 4000 }
      );

      const receivedAfterSend = await app.getReceivedText();
      // Because of simulated network conditions and echo handlers, we expect received area to contain either the server echo or a client receive log
      expect(receivedAfterSend.length).toBeGreaterThan(0);

      // 6) Disconnect selected connection (simulate S3_Connected -> S4_Disconnected)
      await app.disconnectSelectedConnection();

      // After disconnect, logs should show disconnection and acceptedConnections may shrink
      await page.waitForFunction(() => document.querySelector('#logs').value.includes('disconnected') || document.querySelector('#logs').value.includes('Client connection'), null, { timeout: 2000 });
      const logsAfterDisconnect = await app.getLogsText();
      expect(logsAfterDisconnect.toLowerCase()).toContain('disconnected');

      // 7) Stop listening (S2_Listening -> S1_Created)
      await app.stopListening();

      await page.waitForFunction(() => document.querySelector('#logs').value.includes('Server stopped listening') || document.querySelector('#logs').value.includes('Stopped listening.'), null, { timeout: 2000 });
      const logsAfterStop = await app.getLogsText();
      expect(logsAfterStop).toContain('Server stopped listening');

      const serverStateAfterStop = await app.getServerState();
      expect(serverStateAfterStop).toBe('created');

      // 8) Close server socket (S1_Created -> S5_Closed)
      await app.closeSocket();

      // After close, the UI currentSocket is cleared and log shows 'Socket closed and cleared.'
      await page.waitForFunction(() => document.querySelector('#logs').value.includes('Socket closed and cleared.') || document.querySelector('#logs').value.includes('Socket closed.'), null, { timeout: 2000 });
      const logsAfterClose = await app.getLogsText();
      expect(logsAfterClose).toContain('Socket closed');
      // The UI shows "Socket not created" when currentSocket cleared
      const finalStateText = await app.getSocketStateText();
      expect(finalStateText.trim()).toBe('Socket not created');
    });
  });

  test.describe('Client scenarios and edge cases', () => {
    test('Client connection attempt without server should fail and produce "Connection failed or refused."', async ({ page }) => {
      const app = new SocketAppPage(page);

      // Ensure no server globally registered
      await page.evaluate(() => {
        try {
          window._simulatedServerSocket = null;
        } catch (e) {}
      });

      // Create a client socket via UI (S0_NotCreated -> S1_Created)
      await app.createSocket({ type: 'client', protocol: 'TCP' });

      // Wait briefly for logs
      await page.waitForTimeout(200);

      // Click connect (ConnectToServer event)
      await app.connectBtn.click();

      // The UI connect flow schedules a failure if no simulated server is present; wait for outcome
      await page.waitForFunction(() => {
        const logs = document.querySelector('#logs').value;
        return logs.includes('Connection failed or refused.') || logs.includes('Client connected successfully.') || logs.includes('Connection failed');
      }, null, { timeout: 4000 });

      const logsAfterConnectAttempt = await app.getLogsText();
      // We expect failure path since no server was present
      expect(logsAfterConnectAttempt.toLowerCase()).toContain('connection failed');

      // Verify client socket state is disconnected (S4_Disconnected)
      const socketStateText = await app.getSocketStateText();
      expect(socketStateText.toLowerCase()).toContain('disconnected');

      // Close client socket
      await app.closeSocket();
      await page.waitForFunction(() => document.querySelector('#logs').value.includes('Socket closed and cleared.') || document.querySelector('#logs').value.includes('Socket closed.'), null, { timeout: 2000 });
      const logsAfterClose = await app.getLogsText();
      expect(logsAfterClose).toContain('Socket closed');
    });

    test('Edge case: calling listen() on client socket logs "Listen called on non-server socket."', async ({ page }) => {
      const app = new SocketAppPage(page);

      // Create a client socket via UI
      await app.createSocket({ type: 'client', protocol: 'TCP' });

      // Directly invoke client.listen via page.evaluate to exercise edge case (must not patch any functions)
      const result = await page.evaluate(() => {
        try {
          if (!window.currentSocket) return 'no-socket';
          const res = window.currentSocket.listen(3); // should log 'Listen called on non-server socket.' and return false
          return { returned: res, state: window.currentSocket.state };
        } catch (e) {
          return { error: e && e.message };
        }
      });

      // The listen call should return false and not change state to 'listening'
      expect(result.returned).toBe(false);
      expect(result.state).not.toBe('listening');

      // Confirm the logs contain the non-server listen message
      await page.waitForFunction(() => document.querySelector('#logs').value.includes('Listen called on non-server socket.') || document.querySelector('#logs').value.includes('Listen called on non-server'), null, { timeout: 2000 });
      const logsNow = await app.getLogsText();
      expect(logsNow).toContain('Listen called on non-server socket.');

      // Cleanup: close socket
      await app.closeSocket();
      await page.waitForFunction(() => document.querySelector('#logs').value.includes('Socket closed and cleared.') || document.querySelector('#logs').value.includes('Socket closed.'), null, { timeout: 2000 });
    });
  });

  test.describe('Logging and runtime error observation', () => {
    test('No uncaught page errors occur during normal interactions and expected logs are produced', async ({ page }) => {
      const app = new SocketAppPage(page);

      // Create server, start listening, queue virtual client, accept it to exercise core flows
      await app.createSocket({ type: 'server', protocol: 'TCP' });
      await page.waitForTimeout(50);
      await app.startListening();
      await page.waitForTimeout(50);
      const queued = await app.createVirtualClientAndQueue({ ip: await app.ipAddress.inputValue(), port: Number(await app.portNumber.inputValue()) });
      expect(queued).toBe(true);
      await app.acceptNextConnection();
      await page.waitForTimeout(200);

      // Gather logs
      const logs = await app.getLogsText();
      expect(logs.length).toBeGreaterThan(0);

      // Collect any console messages that are errors
      const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
      // There should be no unhandled console errors; warnings may appear but we assert there are no severe errors recorded by Playwright 'pageerror' handler
      expect(pageErrors.length).toBe(0);
      // If there are console errors, fail the test (none are expected in healthy run)
      expect(errorConsoleMessages.length).toBe(0);
    });
  });
});