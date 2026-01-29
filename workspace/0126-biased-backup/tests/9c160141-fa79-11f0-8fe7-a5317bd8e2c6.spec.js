import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c160141-fa79-11f0-8fe7-a5317bd8e2c6.html';

class SimulatorPage {
  /**
   * Lightweight Page Object for the Socket Programming Interactive Simulator
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Ensure initial init() log appears
    await this.waitForLogContains('Initialized with hosts 10.0.0.1 and 10.0.0.2', 3000);
  }

  async waitForLogContains(substring, timeout = 5000) {
    const locator = this.page.locator('#log');
    await this.page.waitForFunction(
      (el, text) => el && el.textContent && el.textContent.indexOf(text) !== -1,
      locator,
      substring,
      { timeout }
    );
  }

  async getLogText() {
    return this.page.locator('#log').innerText();
  }

  async setNewHostIp(ip) {
    await this.page.fill('#newHostIp', ip);
  }

  async clickCreateHost() {
    await this.page.click('#btnCreateHost');
  }

  async selectHost(ip) {
    // select option by value (options' value is IP)
    await this.page.selectOption('#selectHost', ip);
    // trigger change handlers if any
    await this.page.waitForTimeout(50);
  }

  async setSocketType(type) {
    await this.page.selectOption('#socketType', type);
  }

  async setLocalPort(port) {
    await this.page.fill('#localPort', String(port));
  }

  async clickCreateSocket() {
    await this.page.click('#btnCreateSocket');
  }

  async findSocketOptionValueContaining(textFragment) {
    // returns the option.value for selectSocket whose text contains textFragment
    return this.page.evaluate((frag) => {
      const sel = document.getElementById('selectSocket');
      for (const opt of sel.options) {
        if (opt.text.indexOf(frag) !== -1) return opt.value;
      }
      return null;
    }, textFragment);
  }

  async selectSocketByValue(val) {
    if (!val) return;
    await this.page.selectOption('#selectSocket', val);
    await this.page.waitForTimeout(50);
  }

  async clickListen() {
    await this.page.click('#btnListen');
  }

  async clickConnect() {
    await this.page.click('#btnConnect');
  }

  async clickClose() {
    await this.page.click('#btnClose');
  }

  async clickAbort() {
    await this.page.click('#btnAbort');
  }

  async setRemoteAddr(addr) {
    await this.page.fill('#remoteAddr', addr);
  }

  async setPayloadText(text) {
    await this.page.fill('#payloadText', text);
  }

  async setSendBytes(n) {
    await this.page.fill('#sendBytes', String(n));
  }

  async clickSend() {
    await this.page.click('#btnSend');
  }

  async setNetworkSettings({ latency, jitter, loss, reorder, bandwidth }) {
    if (latency !== undefined) await this.page.fill('#latency', String(latency));
    if (jitter !== undefined) await this.page.fill('#jitter', String(jitter));
    if (loss !== undefined) await this.page.fill('#loss', String(loss));
    if (reorder !== undefined) await this.page.fill('#reorder', String(reorder));
    if (bandwidth !== undefined) await this.page.fill('#bandwidth', String(bandwidth));
    await this.page.click('#btnApplyNet');
  }

  async clickInject({ from, to, flags = 'SYN', seq = '0', ack = '0', payload = '' }) {
    await this.page.fill('#injectFrom', from);
    await this.page.fill('#injectTo', to);
    await this.page.fill('#injectFlags', flags);
    await this.page.fill('#injectSeq', String(seq));
    await this.page.fill('#injectAck', String(ack));
    await this.page.fill('#injectPayload', payload);
    await this.page.click('#btnInject');
  }

  async clickRunScript() {
    await this.page.click('#btnRunScript');
  }

  async clickAutoAccept() {
    await this.page.click('#btnAutoAccept');
  }

  async clickShowQueue() {
    await this.page.click('#btnShowQueue');
  }

  async refreshInspector() {
    await this.page.click('#btnRefreshInspector');
  }

  async getInspectorText() {
    return this.page.locator('#inspector').innerText();
  }

  async clickClearLog() {
    await this.page.click('#btnClearLog');
  }
}

test.describe.serial('Socket Programming Interactive Simulator - FSM validation', () => {
  let page;
  let sim;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors
    page.on('console', (msg) => {
      // Store console messages for later assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    sim = new SimulatorPage(page);
    await sim.goto();
  });

  test.afterEach(async () => {
    // Assert that no unexpected runtime errors (ReferenceError/TypeError/SyntaxError) occurred.
    // We allow the app to emit normal logs, but any pageerror should fail the test.
    const interesting = pageErrors.filter(e =>
      /ReferenceError|TypeError|SyntaxError/.test(String(e))
    );
    expect(interesting.length, `Runtime errors captured: ${pageErrors.map(String).join(' | ')}`).toBe(0);

    // Also assert console does not contain unhandled exception messages
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length, `Console errors: ${errorConsole.map(c => c.text).join(' | ')}`).toBe(0);

    await page.close();
  });

  test('Initial state S0_Idle: page initialized and header present', async () => {
    // Validate the initial UI content (evidence for S0_Idle)
    const heading = await page.locator('h2').innerText();
    expect(heading).toContain('Socket Programming Interactive Simulator');

    // The init() call should have added an initialization log
    const log = await sim.getLogText();
    expect(log).toContain('Initialized with hosts 10.0.0.1 and 10.0.0.2');
  });

  test('CREATE_HOST -> S1_HostCreated: create a new host and observe log', async () => {
    // Create a new host IP 10.0.0.3 and assert the NET log entry appears
    await sim.setNewHostIp('10.0.0.3');
    await sim.clickCreateHost();
    await sim.waitForLogContains('Created host 10.0.0.3', 3000);

    const log = await sim.getLogText();
    expect(log).toContain('Created host 10.0.0.3');
    // Ensure host appears in selectHost
    await sim.selectHost('10.0.0.3');
  });

  test('CREATE_SOCKET -> S2_SocketCreated: create a TCP socket and verify log and UI', async () => {
    // Select existing host 10.0.0.1 (initialized)
    await sim.selectHost('10.0.0.1');
    // Set TCP type and a fixed port 5001
    await sim.setSocketType('TCP');
    await sim.setLocalPort(5001);
    await sim.clickCreateSocket();
    // Evidence: addLog('TCP','Created TCP socket ' + s.id + ' on ' + host.ip + ':' + s.localPort);
    await sim.waitForLogContains('Created TCP socket', 3000);
    const log = await sim.getLogText();
    expect(log).toMatch(/Created TCP socket .* on 10\.0\.0\.1:5001/);

    // Ensure selectSocket has an option referencing the created socket and host:port
    const optVal = await sim.findSocketOptionValueContaining('10.0.0.1:5001');
    expect(optVal).not.toBeNull();
    await sim.selectSocketByValue(optVal);
  });

  test('LISTEN -> S4_Listen: server socket set to LISTEN produces expected TCP log', async () => {
    // Create server socket on host 10.0.0.2 port 80
    await sim.selectHost('10.0.0.2');
    await sim.setSocketType('TCP');
    await sim.setLocalPort(80);
    await sim.clickCreateSocket();
    await sim.waitForLogContains('Created TCP socket', 3000);

    // Select the server socket and click Listen
    const serverOption = await sim.findSocketOptionValueContaining('10.0.0.2:80');
    expect(serverOption).not.toBeNull();
    await sim.selectSocketByValue(serverOption);

    // Click Listen - should log "is now LISTEN"
    await sim.clickListen();
    await sim.waitForLogContains('is now LISTEN on 10.0.0.2:80', 3000);
    const log = await sim.getLogText();
    expect(log).toContain('is now LISTEN on 10.0.0.2:80');

    // Also ensure pending/backlog UI updates (non-empty pending)
    await page.click('#btnShowQueue'); // just to exercise queue path
  });

  test('CONNECT -> S3_Connected: active open (client SYN, server SYN+ACK, client ACK) completes', async () => {
    // Speed up network delivery to make handshake deterministic for test
    await sim.setNetworkSettings({ latency: 10, jitter: 0, loss: 0, reorder: 0, bandwidth: 0 });

    // Ensure client socket exists on 10.0.0.1:5001 - create if absent
    await sim.selectHost('10.0.0.1');
    // Try to find an existing socket on 5001
    let clientOpt = await sim.findSocketOptionValueContaining('10.0.0.1:5001');
    if (!clientOpt) {
      await sim.setSocketType('TCP');
      await sim.setLocalPort(5001);
      await sim.clickCreateSocket();
      await sim.waitForLogContains('Created TCP socket', 3000);
      clientOpt = await sim.findSocketOptionValueContaining('10.0.0.1:5001');
      expect(clientOpt).not.toBeNull();
    }
    await sim.selectSocketByValue(clientOpt);

    // Ensure remote address points to server 10.0.0.2:80 (default in UI)
    await sim.setRemoteAddr('10.0.0.2:80');

    // Click Connect (active open) and expect SYN sent log
    await sim.clickConnect();
    await sim.waitForLogContains('SYN sent for active open', 3000);
    const logAfterSyn = await sim.getLogText();
    expect(logAfterSyn).toContain('SYN sent for active open');

    // Wait for connection established log (the simulation delivers SYN/SYN+ACK/ACK asynchronously)
    await sim.waitForLogContains('Connection established (active open) on 10.0.0.1:5001', 7000);
    const finalLog = await sim.getLogText();
    expect(finalLog).toContain('Connection established (active open) on 10.0.0.1:5001');

    // Refresh inspector and assert the socket reports ESTABLISHED state
    await sim.refreshInspector();
    const inspector = await sim.getInspectorText();
    expect(inspector).toContain('State: ESTABLISHED');
  });

  test('INJECT_PACKET -> S6_PacketInjected: injecting a custom TCP packet logs injection', async () => {
    // Inject a custom TCP packet from server to client and expect the NET injection log
    await sim.clickInject({
      from: '10.0.0.2:80',
      to: '10.0.0.1:5001',
      flags: 'SYN',
      seq: 1234,
      ack: 0,
      payload: ''
    });

    // Evidence: addLog('NET','Injected custom TCP packet flags=' + flags + ' from ' + addrStr(from) + ' to ' + addrStr(to));
    await sim.waitForLogContains('Injected custom TCP packet flags=SYN from 10.0.0.2:80 to 10.0.0.1:5001', 3000);
    const log = await sim.getLogText();
    expect(log).toContain('Injected custom TCP packet flags=SYN from 10.0.0.2:80 to 10.0.0.1:5001');
  });

  test('CLOSE (UDP) -> S5_SocketClosed: closing a UDP socket removes it and logs UDP closure', async () => {
    // Create a UDP socket on 10.0.0.1 and then close it to observe UDP close behavior
    await sim.selectHost('10.0.0.1');
    await sim.setSocketType('UDP');
    await sim.setLocalPort(6000);
    await sim.clickCreateSocket();
    await sim.waitForLogContains('Created UDP socket', 3000);
    const udpOpt = await sim.findSocketOptionValueContaining('10.0.0.1:6000');
    expect(udpOpt).not.toBeNull();
    await sim.selectSocketByValue(udpOpt);

    // For UDP, clicking Close triggers UDP removal
    await sim.clickClose();
    await sim.waitForLogContains('UDP socket closed and removed', 3000);
    const log = await sim.getLogText();
    expect(log).toContain('UDP socket closed and removed');
  });

  test('RUN_SCRIPT -> S7_ScriptRunning: starting the script logs the start message and runs', async () => {
    // Click Run Script and assert the "Starting script with N commands; stepMode=" log is present
    await sim.clickRunScript();
    await sim.waitForLogContains('Starting script with', 3000);
    const log = await sim.getLogText();
    expect(log).toMatch(/Starting script with \d+ commands; stepMode=false/);

    // Wait for script to finish to exercise script engine (it logs 'Script finished')
    await sim.waitForLogContains('Script finished', 10000);
    const after = await sim.getLogText();
    expect(after).toContain('Script finished');
  });

  test('Edge case: creating duplicate host shows alert (error scenario)', async () => {
    // Attempt to create a host with an IP that already exists -> page shows an alert
    await sim.setNewHostIp('10.0.0.1');

    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      sim.clickCreateHost()
    ]);
    // The UI alerts "Host already exists"
    expect(dialog.message()).toMatch(/Host already exists/);
    await dialog.accept();
  });

  test('Edge case: clicking Connect without selecting a socket triggers alert', async () => {
    // Deselect any socket selection by selecting a host that has no sockets or by clearing selectSocket
    // We will clear selectSocket by manipulating the field to no selection
    await sim.selectHost('10.0.0.1');
    // Attempt to clear selection
    await page.evaluate(() => { const sel = document.getElementById('selectSocket'); sel.value = ''; });

    const dialogPromise = page.waitForEvent('dialog');
    await page.click('#btnConnect');
    const dialog = await dialogPromise;
    expect(dialog.message()).toMatch(/Select socket/);
    await dialog.accept();
  });

  test('Edge case: injecting with invalid addresses triggers alert', async () => {
    await sim.page.fill('#injectFrom', 'invalid');
    await sim.page.fill('#injectTo', 'alsoinvalid');

    const dialogPromise = page.waitForEvent('dialog');
    await page.click('#btnInject');
    const dialog = await dialogPromise;
    expect(dialog.message()).toMatch(/Invalid addresses/);
    await dialog.accept();
  });

  test('Utilities/controls exercised: Apply network settings, Pause/Step/Flush/Drop behaviours', async () => {
    // Apply some network settings and check log entry
    await sim.setNetworkSettings({ latency: 100, jitter: 20, loss: 1, reorder: 0, bandwidth: 0 });
    await sim.waitForLogContains('Network settings applied: latency=100 jitter=20 loss=1% reorder=0% bandwidth=0', 3000);
    const log = await sim.getLogText();
    expect(log).toContain('Network settings applied: latency=100');

    // Pause delivery and assert log
    await page.click('#btnPause');
    await sim.waitForLogContains('Delivery paused=', 2000);
    // Step one packet (no guaranteed packet ready) - should log "No packet ready to deliver right now." or deliver something
    await page.click('#btnStep');
    // The message could be either "No packet ready" or other; assert that some NET log exists after calling
    await sim.waitForLogContains('NET', 2000);

    // Flush and Drop to exercise code paths (no assertions beyond log entries)
    await page.click('#btnFlush');
    await sim.waitForLogContains('Flushed all in-flight packets', 2000);
    await page.click('#btnDropAll');
    await sim.waitForLogContains('Dropped all in-flight packets', 2000);
  });

  test('Inspector & pending: refresh inspector and accept/reject pending connections flows', async () => {
    // Toggle Auto-Accept to force pending behavior and run a short guided demo scenario
    // Clicking AutoAccept toggles the setting and logs it
    await sim.clickAutoAccept();
    await sim.waitForLogContains('Auto-Accept toggled to', 2000);

    // Start guided demo by clicking demo button to exercise backlog/pending UI
    await page.click('#btnDemo');
    // The demo logs "Demo started" and "Demo: created client"
    await sim.waitForLogContains('Demo started', 3000);
    await sim.waitForLogContains('Demo: created client', 3000);

    // Wait briefly and then refresh inspector and pending
    await page.click('#btnRefreshInspector');
    // Accept pending connection if any (btnAcceptPending)
    await page.click('#btnAcceptPending');
    // Either "Accepted existing child socket" or "Accepted pending connection" or "No pending connections"
    await sim.waitForLogContains('Accepted', 3000).catch(() => {}); // optional

    // Try to reject pending (may log "No pending to reject")
    await page.click('#btnRejectPending');
    await sim.waitForLogContains('No pending', 2000).catch(() => {});
  });
});