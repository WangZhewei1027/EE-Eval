import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/121670a2-fa7a-11f0-acf9-69409043402d.html';

// Page object encapsulating interactions and common queries
class CongestionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // element selectors used throughout tests
    this.sel = {
      inputDelay: '#inputDelay',
      inputCapacity: '#inputCapacity',
      inputLossProb: '#inputLossProb',
      inputMSS: '#inputMSS',
      inputInitCwnd: '#inputInitCwnd',
      inputSsthresh: '#inputSsthresh',
      selectAlgorithm: '#selectAlgorithm',
      btnApplyConfig: '#btnApplyConfig',
      btnReset: '#btnReset',
      btnSendPacket: '#btnSendPacket',
      btnSendBurst: '#btnSendBurst',
      inputAckPacket: '#inputAckPacket',
      btnRecvAck: '#btnRecvAck',
      inputLossPacket: '#inputLossPacket',
      btnReportLoss: '#btnReportLoss',
      btnAutoRun: '#btnAutoRun',
      stateCwnd: '#stateCwnd',
      stateSsthresh: '#stateSsthresh',
      stateFlight: '#stateFlight',
      statePhase: '#statePhase',
      stateRtt: '#stateRtt',
      statePacketsSent: '#statePacketsSent',
      statePacketsAcked: '#statePacketsAcked',
      statePacketsLost: '#statePacketsLost',
      stateDupAcks: '#stateDupAcks',
      logOutput: '#logOutput'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure initial load's reset has completed (log contains "Simulation reset.")
    await expect(this.page.locator(this.sel.logOutput)).toContainText('Simulation reset.');
  }

  async applyConfig() {
    await this.page.click(this.sel.btnApplyConfig);
  }

  async reset() {
    await this.page.click(this.sel.btnReset);
  }

  async sendPacket() {
    await this.page.click(this.sel.btnSendPacket);
    // return latest packet number from statePacketsSent
    const sent = await this.getStateValue('statePacketsSent');
    return Number(sent);
  }

  async sendBurst() {
    await this.page.click(this.sel.btnSendBurst);
  }

  async recvAck(packetNum) {
    await this.page.fill(this.sel.inputAckPacket, String(packetNum));
    await this.page.click(this.sel.btnRecvAck);
  }

  async reportLoss(packetNum) {
    await this.page.fill(this.sel.inputLossPacket, String(packetNum));
    await this.page.click(this.sel.btnReportLoss);
  }

  async autoRunClick() {
    await this.page.click(this.sel.btnAutoRun);
  }

  async setInput(selector, value) {
    await this.page.fill(selector, String(value));
  }

  async setSelect(selector, value) {
    await this.page.selectOption(selector, value);
  }

  async getText(selector) {
    return (await this.page.locator(selector).innerText()).trim();
  }

  async getState() {
    // returns a mapping of displayed state values
    const keys = [
      'stateCwnd', 'stateSsthresh', 'stateFlight', 'statePhase',
      'stateRtt', 'statePacketsSent', 'statePacketsAcked', 'statePacketsLost', 'stateDupAcks'
    ];
    const result = {};
    for (const k of keys) {
      result[k] = await this.getText(this.sel[k]);
    }
    return result;
  }

  async getStateValue(key) {
    // key should be one of the sel keys mapped to state fields
    return (await this.page.locator(this.sel[key]).innerText()).trim();
  }

  async getLogContent() {
    return await this.page.locator(this.sel.logOutput).innerText();
  }
}

// Group tests logically
test.describe('Congestion Control Interactive Demo - FSM and UI tests', () => {
  let page;
  let app;
  let consoleMessages;
  let pageErrors;

  // Create fresh page for each test, collect console logs and page errors
  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (unhandled exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    app = new CongestionPage(page);
    await app.goto();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.describe('Configuration and Reset', () => {
    test('Apply Configuration resets simulation and enters Slow Start', async () => {
      // Ensure a non-default initial cwnd is applied and displayed after Apply Configuration
      await app.setInput(app.sel.inputInitCwnd, '5');
      await app.setInput(app.sel.inputSsthresh, '10');
      await app.applyConfig();

      const state = await app.getState();
      // Verify displayed CWND reflects the initial cwnd and phase is Slow Start
      expect(parseFloat(state.stateCwnd)).toBeCloseTo(5, 5);
      expect(state.statePhase).toBe('Slow Start');

      // Verify a reset log entry was written
      const log = await app.getLogContent();
      expect(log).toContain('Simulation reset.');

      // Verify there were no uncaught page errors during apply
      expect(pageErrors).toEqual([]);
      // No console errors
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Reset button clears counters and logs Simulation reset', async () => {
      // Send a packet so counters change
      await app.sendPacket();
      let sentBefore = await app.getStateValue('statePacketsSent');
      expect(Number(sentBefore)).toBeGreaterThan(0);

      // Reset
      await app.reset();

      // After reset, packetsSent should be 0 and log contains reset message
      const sentAfter = Number(await app.getStateValue('statePacketsSent'));
      expect(sentAfter).toBe(0);

      const log = await app.getLogContent();
      expect(log).toContain('Simulation reset.');

      // Ensure no page errors recorded
      expect(pageErrors).toEqual([]);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Packet send, ACK, Duplicate ACKs and Loss - FSM transitions', () => {
    test('S0 -> S1 via ApplyConfig: Apply configuration results in Slow Start', async () => {
      // Change initial cwnd to 1 and apply config (resetState is called internally)
      await app.setInput(app.sel.inputInitCwnd, '1');
      await app.applyConfig();

      const phase = await app.getStateValue('statePhase');
      expect(phase).toBe('Slow Start');

      // confirm no page errors
      expect(pageErrors).toEqual([]);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('S1 (Slow Start) -> S2 (Congestion Avoidance) on ReceiveAck when cwnd reaches ssthresh', async () => {
      // Configure initial cwnd and ssthresh so a single ACK moves phase to Congestion Avoidance
      await app.setInput(app.sel.inputInitCwnd, '64'); // cwnd initial
      await app.setInput(app.sel.inputSsthresh, '64'); // ssthresh
      await app.applyConfig();

      // Send a packet so we have a valid packet number to ack
      const pnum = await app.sendPacket();
      expect(pnum).toBeGreaterThan(0);

      // Click Receive ACK for that packet to trigger CWND increase and CA entry
      await app.recvAck(pnum);

      // Verify the phase changed to Congestion Avoidance
      const phase = await app.getStateValue('statePhase');
      expect(phase).toBe('Congestion Avoidance');

      // The log should contain message about entering congestion avoidance
      const log = await app.getLogContent();
      expect(log).toContain('Entered Congestion Avoidance phase');

      // No uncaught page errors
      expect(pageErrors).toEqual([]);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('S1 (Slow Start) -> S3 (Fast Recovery) via triple duplicate ACKs', async () => {
      // Start with default configuration and ensure Slow Start
      await app.setInput(app.sel.inputInitCwnd, '1');
      await app.setInput(app.sel.inputSsthresh, '64');
      await app.applyConfig();

      // Send a single packet and ACK it once (to make it eligible for duplicate ACKs)
      const pnum = await app.sendPacket();
      await app.recvAck(pnum); // first ACK - marks as acked

      // Now send duplicate ACKs for the same packet to reach 3 duplicates
      // We perform three additional Receive ACK clicks to increment duplicate ACK count to 3
      await app.recvAck(pnum); // duplicate #1
      await app.recvAck(pnum); // duplicate #2
      await app.recvAck(pnum); // duplicate #3 -> should enter Fast Recovery

      // Verify the phase is Fast Recovery
      const phase = await app.getStateValue('statePhase');
      expect(phase).toBe('Fast Recovery');

      // Verify ssthresh and cwnd adjustments were logged
      const log = await app.getLogContent();
      expect(log).toContain('Triple duplicate ACKs detected');
      expect(log).toContain('fast retransmit and fast recovery');

      // ensure no unexpected page errors
      expect(pageErrors).toEqual([]);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('S2 (Congestion Avoidance) -> S1 (Slow Start) on ReportLoss', async () => {
      // Configure so we can be in Congestion Avoidance quickly
      await app.setInput(app.sel.inputInitCwnd, '65');
      await app.setInput(app.sel.inputSsthresh, '64');
      await app.applyConfig();

      // Send a packet and ACK to transition to Congestion Avoidance
      const pnum1 = await app.sendPacket();
      await app.recvAck(pnum1);

      const phaseAfterAck = await app.getStateValue('statePhase');
      expect(phaseAfterAck).toBe('Congestion Avoidance');

      // Send another packet to generate a packetNum to report loss on
      const pnum2 = await app.sendPacket();

      // Report loss for that packet manually
      await app.reportLoss(pnum2);

      // After loss, the code resets to Slow Start for Reno-style algorithms
      const phaseAfterLoss = await app.getStateValue('statePhase');
      expect(phaseAfterLoss).toBe('Slow Start');

      // Check log contains a message about entering slow start and ssthresh update
      const log = await app.getLogContent();
      expect(log).toMatch(/Entered Slow Start|Entered Slow Start phase with ssthresh/);

      // verify no uncaught page errors
      expect(pageErrors).toEqual([]);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('S2 (Congestion Avoidance) receives ACK increases cwnd (additive increase)', async () => {
      // Set initial cwnd > ssthresh so we are effectively in Congestion Avoidance after an ACK
      await app.setInput(app.sel.inputInitCwnd, '10');
      await app.setInput(app.sel.inputSsthresh, '5'); // ensure cwnd >= ssthresh results in CA
      await app.applyConfig();

      // Send a packet and ACK to ensure CA
      const pnum = await app.sendPacket();
      // get cwnd before ack
      const cwndBeforeText = await app.getStateValue('stateCwnd');
      const cwndBefore = parseFloat(cwndBeforeText);

      await app.recvAck(pnum);

      const cwndAfter = parseFloat(await app.getStateValue('stateCwnd'));
      // cwnd should strictly increase after an ACK in Congestion Avoidance
      expect(cwndAfter).toBeGreaterThan(cwndBefore);

      // ensure no uncaught page errors
      expect(pageErrors).toEqual([]);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Burst send, Auto-run and edge cases', () => {
    test('Send burst sends floor(cwnd) packets and updates flights and sent counters', async () => {
      // Set cwnd to 3 then send a burst
      await app.setInput(app.sel.inputInitCwnd, '3');
      await app.setInput(app.sel.inputSsthresh, '64');
      await app.applyConfig();

      // Send burst
      await app.sendBurst();

      // Check that at least 3 packets were sent and flight is updated accordingly
      const sent = Number(await app.getStateValue('statePacketsSent'));
      const flight = Number(await app.getStateValue('stateFlight'));
      expect(sent).toBeGreaterThanOrEqual(3);
      expect(flight).toBeGreaterThanOrEqual(3);

      // Log should mention the burst size including cwnd value
      const log = await app.getLogContent();
      expect(log).toMatch(/Sending burst of \d+ packets/);

      // ensure no page errors
      expect(pageErrors).toEqual([]);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Auto-run button disables on start (event triggers) - verifying event handling', async () => {
      // Click AutoRun and verify it becomes disabled immediately
      await app.autoRunClick();

      const autoRunBtn = page.locator(app.sel.btnAutoRun);
      // The button is disabled while auto-run is executing
      await expect(autoRunBtn).toBeDisabled();

      // For test runtime reasons do not wait for full completion of 100 packets;
      // verify at least that the click started the process and no immediate page errors occurred.
      expect(pageErrors).toEqual([]);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Invalid ACK and Loss inputs produce "Invalid Packet Number" log entries (edge cases)', async () => {
      // Attempt to Receive ACK with no packets sent (invalid)
      await page.fill(app.sel.inputAckPacket, '1');
      await page.click(app.sel.btnRecvAck);

      let log = await app.getLogContent();
      expect(log).toContain('Invalid Packet Number for ACK');

      // Attempt to Report Loss with no packets sent (invalid)
      await page.fill(app.sel.inputLossPacket, '1');
      await page.click(app.sel.btnReportLoss);

      log = await app.getLogContent();
      expect(log).toContain('Invalid Packet Number for Loss');

      // ensure no JS exceptions
      expect(pageErrors).toEqual([]);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Observability: console logs and page errors', () => {
    test('No uncaught exceptions or console.error messages produced during normal interactions', async () => {
      // Do a few interactions to exercise the code
      await app.setInput(app.sel.inputInitCwnd, '2');
      await app.applyConfig();
      const p = await app.sendPacket();
      await app.recvAck(p);
      await app.sendBurst();
      // After a variety of interactions, assert there were no page errors or console.error messages
      expect(pageErrors).toEqual([]);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });
});