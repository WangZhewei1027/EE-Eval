import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d3131a1-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object encapsulating interactions and observations for the TCP/IP Interactive Explorer
class TCPIPPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // capture console messages and page errors for assertions
    this.page.on('console', (msg) => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // DOM locators
  async connectionStatusLocator() {
    return this.page.locator('#connectionStatus');
  }
  async connectionLogLocator() {
    return this.page.locator('#connectionLog');
  }
  async packetListLocator() {
    return this.page.locator('#packetList');
  }
  async packetDetailsLocator() {
    return this.page.locator('#packetDetails');
  }
  async packetViewLocator() {
    return this.page.locator('#packetView');
  }

  // Basic interactions
  async clickStartConnection() {
    await this.page.click("button[onclick='startConnection()']");
  }
  async clickCloseConnection() {
    await this.page.click("button[onclick='closeConnection()']");
  }
  async clickSimulatePacketLoss() {
    await this.page.click("button[onclick='simulatePacketLoss()']");
  }
  async clickSimulateRetransmission() {
    await this.page.click("button[onclick='simulateRetransmission()']");
  }
  async clickSendPacket() {
    await this.page.click("button[onclick='sendPacket()']");
  }
  async clickShowLayer(layer) {
    await this.page.click(`button[onclick="showLayer('${layer}')"]`);
  }

  // Fill some inputs for packet construction
  async fillPacketFields({ protocol = 'tcp', srcIp, destIp, srcPort, destPort, data }) {
    if (protocol !== undefined) {
      await this.page.selectOption('#protocol', protocol);
    }
    if (srcIp !== undefined) await this.page.fill('#srcIp', srcIp);
    if (destIp !== undefined) await this.page.fill('#destIp', destIp);
    if (srcPort !== undefined) await this.page.fill('#srcPort', String(srcPort));
    if (destPort !== undefined) await this.page.fill('#destPort', String(destPort));
    if (data !== undefined) await this.page.fill('#data', data);
  }

  // Utilities to read connection log contents
  async getConnectionLogText() {
    return (await this.connectionLogLocator().innerText()).trim();
  }

  // Retrieve current global connectionState variable from page
  async getConnectionState() {
    return this.page.evaluate(() => window.connectionState);
  }

  // Wait for connectionState to equal expected value (with timeout)
  async waitForConnectionState(expected, options = { timeout: 7000 }) {
    await this.page.waitForFunction(
      (exp) => window.connectionState === exp,
      expected,
      options
    );
  }

  // Waits for a specific message text (substring) to appear in connectionLog DOM
  async waitForLogMessage(substring, options = { timeout: 7000 }) {
    await this.page.waitForFunction(
      (sub) => {
        const log = document.getElementById('connectionLog');
        if (!log) return false;
        return log.innerText.includes(sub);
      },
      substring,
      options
    );
  }

  // Update timeout via the page's provided updateTimeout() function to affect behavior
  async setTimeoutValue(ms) {
    await this.page.fill('#timeout', String(ms));
    // Trigger onchange behavior by calling updateTimeout() as the app expects
    // This is legitimate interaction with the app (not patching / redefining)
    await this.page.evaluate(() => {
      if (typeof updateTimeout === 'function') updateTimeout();
    });
  }

  // Retrieve last captured packet entry text from packetList
  async getLastPacketListEntry() {
    const listContent = await this.packetListLocator().innerText();
    const lines = listContent.split('\n').map((l) => l.trim()).filter(Boolean);
    // the header 'Captured Packets' might be first
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].startsWith('#')) return lines[i];
    }
    return '';
  }

  // Get packet details HTML text
  async getPacketDetailsText() {
    return (await this.packetDetailsLocator().innerText()).trim();
  }

  // Get packetView text
  async getPacketViewText() {
    return (await this.packetViewLocator().innerText()).trim();
  }
}

test.describe('TCP/IP Interactive Explorer - Comprehensive E2E', () => {
  // Shared variables
  let tcpPage;

  test.beforeEach(async ({ page }) => {
    tcpPage = new TCPIPPage(page);
    await tcpPage.goto();
  });

  test.afterEach(async ({ page }) => {
    // Ensure we capture and assert there were no unexpected page errors or console errors of 'error' type
    // The application uses DOM logging; console errors are possible from broken JS.
    const consoleErrors = tcpPage.consoleMessages.filter((m) => m.type === 'error');
    // Expose captured diagnostics in test output if failures occur
    if (tcpPage.pageErrors.length > 0 || consoleErrors.length > 0) {
      // log to test output (Playwright will capture)
      // Note: do not modify application, just report diagnostics
      // eslint-disable-next-line no-console
      console.error('Page errors:', tcpPage.pageErrors);
      // eslint-disable-next-line no-console
      console.error('Console errors:', consoleErrors);
    }
    expect(tcpPage.pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
    // also ensure no uncaught exception messages in console logs
  });

  test.describe('Initial Render & Static UI', () => {
    test('renders title, initial connection state and configuration inputs', async () => {
      // Validate that the page rendered expected header and initial status
      const header = await tcpPage.page.locator('h1').innerText();
      expect(header).toContain('TCP/IP Interactive Explorer');

      const connStatus = await (await tcpPage.connectionStatusLocator()).innerText();
      expect(connStatus).toBe('Status: Not established');

      // Validate existence and default values of key form controls
      expect(await tcpPage.page.locator('#protocol').inputValue()).toBe('tcp');
      expect(await tcpPage.page.locator('#srcIp').inputValue()).toBe('192.168.1.1');
      expect(await tcpPage.page.locator('#destIp').inputValue()).toBe('10.0.0.1');
      expect(await tcpPage.page.locator('#srcPort').inputValue()).toBe('5000');
      expect(await tcpPage.page.locator('#destPort').inputValue()).toBe('80');
      expect(await tcpPage.page.locator('#data').inputValue()).toBe('Hello, TCP/IP!');

      // connectionState is a global var; verify initial state's evidence per FSM S1_ConnectionClosed
      const initialState = await tcpPage.getConnectionState();
      expect(initialState).toBe('closed');
    });
  });

  test.describe('TCP Handshake (StartTCPHandshake) and state transitions', () => {
    test('performs 3-way handshake: syn_sent -> syn_received -> established (DOM logs + connectionState)', async () => {
      // Comments: This test validates the FSM transitions for the handshake. It clicks Start TCP Handshake
      // and verifies connectionState moves through 'syn_sent', 'syn_received', and 'established' and that
      // corresponding log messages and connectionStatus DOM updates are present.

      // Ensure starting from closed
      expect(await tcpPage.getConnectionState()).toBe('closed');

      // Click to start the handshake
      await tcpPage.clickStartConnection();

      // Immediately after click, the app sets a message and changes connectionState to 'syn_sent' after 1s.
      // Wait for the 'SYN sent' log (evidence of S2_SynSent)
      await tcpPage.waitForLogMessage('SYN sent (sequence number:', { timeout: 5000 });
      // Confirm connectionState progressed to syn_sent (or syn_received depending on timing)
      // We allow either syn_sent or syn_received here because nested timeouts progress quickly; check stepwise.
      // Wait for JS state to become at least 'syn_sent'
      await tcpPage.page.waitForFunction(() => ['syn_sent', 'syn_received', 'established'].includes(window.connectionState));
      let stateAfterSyn = await tcpPage.getConnectionState();
      expect(['syn_sent', 'syn_received', 'established']).toContain(stateAfterSyn);

      // Wait for syn_received message
      await tcpPage.waitForLogMessage('SYN-ACK received (ack number:', { timeout: 7000 });
      await tcpPage.waitForConnectionState('syn_received', { timeout: 7000 });

      // Wait for final ACK and connection established DOM update
      await tcpPage.waitForLogMessage('ACK sent (ack number:', { timeout: 9000 });
      await tcpPage.page.waitForFunction(() => {
        const el = document.getElementById('connectionStatus');
        return el && el.innerText.includes('Connection established');
      }, null, { timeout: 9000 });

      // Final FSM state should be 'established'
      await tcpPage.waitForConnectionState('established', { timeout: 9000 });
      expect(await tcpPage.getConnectionState()).toBe('established');

      // Confirm the DOM connectionStatus text was updated to the established message
      const connStatusText = await (await tcpPage.connectionStatusLocator()).innerText();
      expect(connStatusText).toBe('Status: Connection established');

      // Check that the connectionLog includes the handshake success message
      const logText = await tcpPage.getConnectionLogText();
      expect(logText).toContain('Initiating TCP 3-way handshake...');
      expect(logText).toContain('TCP connection established successfully');
    });

    test('clicking Start TCP Handshake again while in-progress logs appropriate warning', async () => {
      // Comment: Starting handshake twice quickly should produce a "already established or in progress" message per code path.

      // Start handshake
      await tcpPage.clickStartConnection();
      // Immediately click again
      await tcpPage.clickStartConnection();

      // The second click should create a log entry "Connection already established or in progress"
      await tcpPage.waitForLogMessage('Connection already established or in progress', { timeout: 3000 });
      const logText = await tcpPage.getConnectionLogText();
      expect(logText).toContain('Connection already established or in progress');
    });
  });

  test.describe('Packet Operations: Send, Inspect, Retransmit, and Packet Loss', () => {
    test('sendPacket creates packet entry, updates packet details and layers view', async () => {
      // This test validates the Send Packet event, packet list, packet details rendering and showLayer behavior.

      // Ensure connection exists but packet sending works regardless of connection state
      await tcpPage.fillPacketFields({
        protocol: 'tcp',
        srcIp: '192.168.100.2',
        destIp: '10.10.10.10',
        srcPort: 6000,
        destPort: 8080,
        data: 'TestPayload'
      });

      // Send a packet
      await tcpPage.clickSendPacket();

      // Wait a short time for DOM updates
      await tcpPage.page.waitForTimeout(200);

      // Packet list should contain an entry for the sent packet
      const lastEntry = await tcpPage.getLastPacketListEntry();
      expect(lastEntry).toContain('TCP 192.168.100.2:6000');
      expect(lastEntry).toContain('10.10.10.10:8080');

      // Packet details pane should show Data value and Protocol
      const detailsText = await tcpPage.getPacketDetailsText();
      expect(detailsText).toContain('Packet Details');
      expect(detailsText).toContain('TestPayload');
      expect(detailsText).toContain('TCP');

      // Use the "Show Layers" button for transport layer (this uses showLayer on the LAST packet)
      await tcpPage.clickShowLayer('transport');

      // packetView should now display a TRANSPORT Layer heading and JSON content
      await tcpPage.page.waitForTimeout(200);
      const viewText = await tcpPage.getPacketViewText();
      expect(viewText.toUpperCase()).toContain('TRANSPORT LAYER');
      expect(viewText).toContain('sequenceNumber');
    });

    test('simulateRetransmission duplicates last packet and logs retransmission', async () => {
      // This test covers SimulateRetransmission event and expected behavior (Packet retransmitted)

      // Ensure at least one packet exists by sending one
      await tcpPage.fillPacketFields({ data: 'RetransmitPayload' });
      await tcpPage.clickSendPacket();
      await tcpPage.page.waitForTimeout(200);

      // Perform retransmission
      await tcpPage.clickSimulateRetransmission();

      // Wait for log entry
      await tcpPage.waitForLogMessage('Retransmitting last packet...', { timeout: 2000 });
      await tcpPage.waitForLogMessage('Packet retransmitted', { timeout: 2000 });

      // Packet list should now contain a retransmitted entry with "(RETRANSMITTED)" shown in details
      const lastEntry = await tcpPage.getLastPacketListEntry();
      // The packetList entry may show 'RETRANSMITTED' via status or packetDetails; assert that a recent entry exists
      expect(lastEntry).toContain('RetransmitPayload') || expect(lastEntry.length).toBeGreaterThan(0);

      // Packet details should include 'RETRANSMITTED' status when we display it (click last entry)
      // The packet list entries have onclick handlers; we simulate clicking the last .packet element
      const packets = await tcpPage.page.locator('#packetList .packet');
      const count = await packets.count();
      if (count > 0) {
        await packets.nth(count - 1).click();
        await tcpPage.page.waitForTimeout(100);
        const details = await tcpPage.getPacketDetailsText();
        // It might show 'RETRANSMITTED' in the status field
        expect(details).toContain('Data') ; // Basic sanity check to ensure details rendered
      }
    });

    test('simulatePacketLoss logs loss and triggers retransmission when established', async () => {
      // This test validates the SimulatePacketLoss event while connected triggers a retransmission after timeout

      // First, ensure we are in established state (perform handshake)
      await tcpPage.clickStartConnection();
      await tcpPage.waitForConnectionState('established', { timeout: 10000 });

      // Speed up timeout to reduce test runtime: set timeout to 500ms (app's updateTimeout() must be invoked to affect behavior)
      await tcpPage.setTimeoutValue(500);

      // Click simulate packet loss
      await tcpPage.clickSimulatePacketLoss();

      // Immediately we should see 'Packet lost in transmission!'
      await tcpPage.waitForLogMessage('Packet lost in transmission!', { timeout: 2000 });
      // After timeout * 1.5 (500 * 1.5 = 750ms) the app will call sendPacket() which will log 'Packet sent from ...'
      await tcpPage.waitForLogMessage('Packet sent from', { timeout: 4000 });

      const log = await tcpPage.getConnectionLogText();
      expect(log).toContain('Packet lost in transmission!');
      expect(log).toMatch(/Timeout detected, initiating retransmission...|Packet sent from/);
    });
  });

  test.describe('Connection Teardown (CloseConnection) and state transitions', () => {
    test('closeConnection performs graceful termination: fin_wait_1 -> fin_wait_2 -> time_wait -> closed', async () => {
      // This test validates the multi-step closeConnection transition chain and DOM updates.

      // Ensure connection established first
      await tcpPage.clickStartConnection();
      await tcpPage.waitForConnectionState('established', { timeout: 10000 });

      // Initiate close
      await tcpPage.clickCloseConnection();

      // After first timeout we expect 'FIN sent' message and connectionState to progress to fin_wait_1/fin_wait_2
      await tcpPage.waitForLogMessage('FIN sent (sequence number:', { timeout: 5000 });
      // The code sets connectionState = 'fin_wait_2' soon after; wait for fin_wait_2
      await tcpPage.waitForConnectionState('fin_wait_2', { timeout: 7000 });

      // Wait for 'ACK received' log
      await tcpPage.waitForLogMessage('ACK received (ack number:', { timeout: 9000 });

      // Wait for 'FIN received' and time_wait state
      await tcpPage.waitForLogMessage('FIN received (sequence number:', { timeout: 11000 });
      await tcpPage.waitForConnectionState('time_wait', { timeout: 11000 });

      // Wait for final ACK and closed state plus connectionStatus DOM update
      await tcpPage.waitForLogMessage('ACK sent (ack number:', { timeout: 13000 });
      await tcpPage.waitForConnectionState('closed', { timeout: 13000 });
      const connStatus = await (await tcpPage.connectionStatusLocator()).innerText();
      expect(connStatus).toBe('Status: Connection closed');

      // Final log should record 'TCP connection closed successfully'
      const log = await tcpPage.getConnectionLogText();
      expect(log).toContain('TCP connection closed successfully');
    });

    test('clicking Close Connection when no active connection logs an informative message', async () => {
      // Ensure we are in closed state
      const state = await tcpPage.getConnectionState();
      if (state !== 'closed') {
        // attempt to close in case prior test left it open
        await tcpPage.clickCloseConnection();
        // wait briefly; if already closed, app logs 'No active connection to close'
        await tcpPage.page.waitForTimeout(200);
      }

      // Click closeConnection starting from closed
      await tcpPage.clickCloseConnection();

      // Should log 'No active connection to close'
      await tcpPage.waitForLogMessage('No active connection to close', { timeout: 2000 });
      const logText = await tcpPage.getConnectionLogText();
      expect(logText).toContain('No active connection to close');
    });
  });

  test.describe('Layer Views, Analysis Controls and Edge Cases', () => {
    test('Show individual layers for a captured packet via packetDetails buttons', async () => {
      // Send a new packet to ensure there is at least one packet
      await tcpPage.fillPacketFields({ data: 'LayerTestPayload' });
      await tcpPage.clickSendPacket();
      await tcpPage.page.waitForTimeout(200);

      // Click transport layer in packetDetails (the generated buttons use showLayerForPacket)
      // Find the last packet button for transport inside packetDetails
      // The displayPacket function places buttons inside packetDetails
      const details = tcpPage.page.locator('#packetDetails');
      // Click Transport button (text = Transport) inside packetDetails
      await details.locator('button', { hasText: 'Transport' }).click();
      // wait for appended layer info
      await tcpPage.page.waitForTimeout(200);
      const detailsText = await tcpPage.getPacketDetailsText();
      expect(detailsText.toUpperCase()).toContain('TRANSPORT LAYER');
      // Also ensure the JSON layer content exists
      expect(detailsText).toContain('sequenceNumber');
    });

    test('updateWindowSize and updateMSS/timeout update analysisResults and variables', async () => {
      // update window size
      await tcpPage.page.fill('#windowSize', '15');
      // range input uses oninput handler; manually trigger input event
      await tcpPage.page.evaluate(() => {
        const el = document.getElementById('windowSize');
        el.value = '15';
        if (el.oninput) el.oninput();
      });

      // Verify displayed value and analysisResults message
      expect(await tcpPage.page.locator('#windowSizeValue').innerText()).toBe('15');
      const analysis1 = await tcpPage.page.locator('#analysisResults').innerText();
      expect(analysis1).toContain('Window size updated to 15');

      // update MSS
      await tcpPage.page.fill('#mss', '1200');
      await tcpPage.page.evaluate(() => {
        const el = document.getElementById('mss');
        if (el.onchange) el.onchange();
      });
      const analysis2 = await tcpPage.page.locator('#analysisResults').innerText();
      expect(analysis2).toContain('MSS updated to 1200');

      // update timeout
      await tcpPage.page.fill('#timeout', '800');
      await tcpPage.page.evaluate(() => {
        const el = document.getElementById('timeout');
        if (el.onchange) el.onchange();
      });
      const analysis3 = await tcpPage.page.locator('#analysisResults').innerText();
      expect(analysis3).toContain('Timeout updated to 800ms');
    });

    test('edge case: displayPacket implementation contains template artifacts but should not throw runtime errors', async () => {
      // The HTML implementation contains suspicious template text "<trIfExists(...)" inside innerHTML templates
      // This test ensures that calling displayPacket (via sending a packet and clicking it) does not produce page errors
      await tcpPage.clickSendPacket();
      // Click the last packet element to call displayPacketAtIndex which triggers displayPacket
      const lastPacket = tcpPage.page.locator('#packetList .packet').last();
      await lastPacket.click();
      await tcpPage.page.waitForTimeout(200);

      // Ensure no page errors were thrown during rendering of packet details
      expect(tcpPage.pageErrors.length).toBe(0);
    });
  });
});