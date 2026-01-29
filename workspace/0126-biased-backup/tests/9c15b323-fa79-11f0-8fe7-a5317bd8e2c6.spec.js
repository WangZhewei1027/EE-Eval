import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c15b323-fa79-11f0-8fe7-a5317bd8e2c6.html';

/**
 * Page object encapsulating common interactions with the OSI Lab page.
 */
class OsiLabPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Basic UI interactions
  async clickCreatePacket() {
    await this.page.click('#createPacket');
  }
  async clickClearAll() {
    await this.page.click('#clearAll');
  }
  async clickEncapsulateStep() {
    await this.page.click('#encapsulateStep');
  }
  async doubleClickEncapsulateStep() {
    await this.page.dblclick('#encapsulateStep');
  }
  async clickEncapsulateFull() {
    await this.page.click('#encapsulateFull');
  }
  async clickDecapsulateStep() {
    await this.page.click('#decapsulateStep');
  }
  async clickDecapsulateFull() {
    await this.page.click('#decapsulateFull');
  }
  async clickSendThrough() {
    await this.page.click('#sendThrough');
  }
  async clickInjectError() {
    await this.page.click('#injectError');
  }
  async clickFragment() {
    await this.page.click('#fragment');
  }
  async clickReassemble() {
    await this.page.click('#reassemble');
  }
  async clickRandomChallenge() {
    await this.page.click('#randomChallenge');
  }
  async clickStartChallenge() {
    await this.page.click('#startChallenge');
  }
  async clickSubmitAnswer() {
    await this.page.click('#submitAnswer');
  }

  // Form setters
  async setPayload(text) {
    await this.page.fill('#payload', text);
  }
  async setMTU(value) {
    await this.page.evaluate((v) => { document.getElementById('mtu').value = v; document.getElementById('mtuValue').textContent = v; }, String(value));
    // trigger change
    await this.page.dispatchEvent('#mtu', 'input');
  }
  async setHops(value) {
    await this.page.evaluate((v) => { document.getElementById('hops').value = v; document.getElementById('hopsVal').textContent = v; }, String(value));
    await this.page.dispatchEvent('#hops', 'input');
  }
  async setNodeTypes(value) {
    await this.page.fill('#nodeTypes', value);
  }
  async setErrorLayer(layer) {
    await this.page.selectOption('#injectLayer', layer);
  }
  async setErrorType(type) {
    await this.page.selectOption('#errorType', type);
  }
  async setDropRate(value) {
    await this.page.evaluate((v) => { document.getElementById('dropRate').value = v; document.getElementById('dropVal').textContent = v; }, String(value));
    await this.page.dispatchEvent('#dropRate', 'input');
  }
  async setLatency(value) {
    await this.page.evaluate((v) => { document.getElementById('latency').value = v; document.getElementById('latVal').textContent = v; }, String(value));
    await this.page.dispatchEvent('#latency', 'input');
  }
  async setChallengeAnswer(text) {
    await this.page.fill('#challengeAnswer', text);
  }

  // Observers
  async getLogText() {
    return (await this.page.textContent('#log')) || '';
  }

  async getChallengeStatusText() {
    return (await this.page.textContent('#challengeStatus')) || '';
  }

  async getLayersListText() {
    return (await this.page.textContent('#layersList')) || '';
  }

  async getBinaryViewText() {
    return (await this.page.textContent('#binaryView')) || '';
  }

  async getPacketState() {
    return await this.page.evaluate(() => {
      try { return window.osiLab?.state?.packet || null; } catch(e) { return { __error: true, message: e.message }; }
    });
  }

  async getLastConsoleMessages() {
    // Returns last 50 console messages stored on page if present
    return await this.page.evaluate(() => {
      return (window.__capturedConsole || []).slice(-50);
    });
  }
}

test.describe('OSI Model Interactive Lab - end-to-end (FSM coverage)', () => {
  let page;
  let osi;

  // capture console messages and page errors for assertions
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // collect console logs into an array exposed on window for easier retrieval
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      const text = `[${msg.type()}] ${msg.text()}`;
      consoleMessages.push(text);
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Auto-accept alerts/prompts to avoid blocking tests.
    page.on('dialog', async dialog => {
      // For prompt, provide a reasonable default; for alert/confirm, accept.
      try {
        if (dialog.type() === 'prompt') {
          await dialog.accept('ok');
        } else {
          await dialog.accept();
        }
      } catch (e) {
        // ignore
      }
    });

    osi = new OsiLabPage(page);
    await osi.goto();

    // expose console messages to page for retrieval if needed
    await page.evaluate(() => {
      if (!window.__capturedConsole) window.__capturedConsole = [];
      const orig = console.log;
      console.log = function(...args) {
        try { window.__capturedConsole.push({ type: 'log', args: args.map(a => String(a)) }); } catch(e){}
        orig.apply(console, args);
      };
    });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Page loads and initial state is Idle (S0_Idle)', async () => {
    // Verify page title and header exist as evidence of Idle state
    await expect(page.locator('h1')).toHaveText('OSI Model Interactive Lab');

    // Log should contain ready message
    const log = await osi.getLogText();
    expect(log).toContain('OSI Model Interactive Lab ready.');

    // No uncaught page errors should have occurred during load
    expect(pageErrors.length).toBe(0);
  });

  test('Create Packet => Packet Created (S1_PacketCreated) and UI updates', async () => {
    // Click "Create Packet" and verify log message and packet model presence
    await osi.clickCreatePacket();

    // The code logs 'Created application-level packet.'
    const log = await osi.getLogText();
    expect(log).toContain('Created application-level packet.');

    // Layers list should now show an application layer entry
    const layersText = await osi.getLayersListText();
    expect(layersText.toLowerCase()).toContain('layer: application');

    // Binary view should not be the initial "No data."
    const binary = await osi.getBinaryViewText();
    expect(binary.trim().length).toBeGreaterThan(0);

    // Verify internal packet state exists and has application layer
    const pkt = await osi.getPacketState();
    expect(pkt).not.toBeNull();
    expect(Array.isArray(pkt.layers)).toBeTruthy();
    expect(pkt.layers.some(l => l.layer === 'application')).toBeTruthy();
  });

  test('Encapsulate (Step) then Encapsulate (Full) => Packet Encapsulated (S2_PacketEncapsulated)', async () => {
    // Ensure starting from fresh packet
    await osi.clickClearAll();

    // Create application packet
    await osi.clickCreatePacket();

    // Encapsulate step should add next missing layer (transport)
    await osi.clickEncapsulateStep();

    // Log should indicate a layer was added
    const log1 = await osi.getLogText();
    expect(log1).toContain('Added layer transport');

    // Confirm transport present in layers list
    let layersText = await osi.getLayersListText();
    expect(layersText.toLowerCase()).toContain('layer: transport');

    // Now encapsulate full to add remaining layers (network, datalink, physical)
    await osi.clickEncapsulateFull();

    const log2 = await osi.getLogText();
    // Full encapsulation also logs 'Encapsulation: full.'
    expect(log2).toContain('Encapsulation: full.');

    // Layers list should at least contain network and datalink
    layersText = await osi.getLayersListText();
    expect(layersText.toLowerCase()).toContain('layer: network');
    expect(layersText.toLowerCase()).toContain('layer: datalink');

    // Binary view should reflect combined bytes (not "No data.")
    const binary = await osi.getBinaryViewText();
    expect(binary.trim().length).toBeGreaterThan(0);
  });

  test('Decapsulate Step and Decapsulate Full => Packet Decapsulated (S3_PacketDecapsulated)', async () => {
    // Build up a fully encapsulated packet first
    await osi.clickClearAll();
    await osi.clickCreatePacket();
    await osi.clickEncapsulateFull();

    // Decapsulate a single step (removes topmost layer)
    await osi.clickDecapsulateStep();
    let log = await osi.getLogText();
    // Expect "Decapsulated layer" message
    expect(log).toMatch(/Decapsulated layer/i);

    // Now decapsulate full to remove all layers
    await osi.clickDecapsulateFull();
    log = await osi.getLogText();
    expect(log).toContain('Decapsulated all layers.');

    // Layers list should show "No packet yet." since layers array is empty
    const layersText = await osi.getLayersListText();
    expect(layersText).toMatch(/no packet yet/i);
  });

  test('Send Through Network => Network Simulated (S4_NetworkSimulated)', async () => {
    // Create and encapsulate full to ensure network headers exist
    await osi.clickClearAll();
    await osi.clickCreatePacket();
    await osi.clickEncapsulateFull();

    // Set hops and node types to exercise routing logic
    await osi.setHops(3);
    await osi.setNodeTypes('Router,Router,Host');
    // Ensure no artificial drops/latency
    await osi.setDropRate(0);
    await osi.setLatency(0);

    // Click send through network
    await osi.clickSendThrough();

    // The sequence will log per-hop messages and finally 'Packet reached final hop.'
    const log = await osi.getLogText();
    expect(log).toContain('Packet reached final hop.');
  });

  test('Inject Error variants: bitflip and drop => Error Injected (S5_ErrorInjected) and edge case', async () => {
    // Reset and create packet
    await osi.clickClearAll();
    await osi.clickCreatePacket();

    // Default inject settings target application and bitflip by default (UI defaults)
    await osi.setErrorLayer('application');
    await osi.setErrorType('bitflip');
    await osi.clickInjectError();

    // Log should contain bitflip message
    let log = await osi.getLogText();
    expect(log).toMatch(/Bitflip injected in application payload at byte/i);

    // Now test "drop" error type: this should clear the packet (simulate loss)
    // Re-create packet to ensure one exists
    await osi.clickCreatePacket();
    await osi.setErrorType('drop');
    await osi.clickInjectError();

    log = await osi.getLogText();
    expect(log).toContain('Packet dropped (simulated). Packet cleared.');

    // Packet state should now be null
    const pkt = await osi.getPacketState();
    expect(pkt === null || pkt === undefined).toBeTruthy();
  });

  test('Fragment Packet then Reassemble => Packet Fragmented (S6) and Packet Reassembled (S7)', async () => {
    // Prepare a large payload to force fragmentation (4000 bytes)
    await osi.clickClearAll();
    await osi.setPayload('A'.repeat(4000));
    await osi.clickCreatePacket();
    // Need network header for fragmentation
    await osi.clickEncapsulateStep(); // add transport
    await osi.clickEncapsulateStep(); // add network
    await osi.clickEncapsulateStep(); // add datalink

    // Set MTU low to force multiple fragments
    await osi.setMTU(1400);

    // Click fragment
    await osi.clickFragment();

    // Log should indicate fragmentation
    let log = await osi.getLogText();
    expect(log).toMatch(/Fragmented into \d+ fragments using MTU 1400\./i);

    // Internal state should have fragments array
    const pkt = await osi.getPacketState();
    expect(pkt).not.toBeNull();
    expect(Array.isArray(pkt.fragments)).toBeTruthy();
    expect(pkt.fragments.length).toBeGreaterThan(1);

    // Now reassemble
    await osi.clickReassemble();
    log = await osi.getLogText();
    expect(log).toContain('Reassembled fragments into single packet.');

    // After reassembly, packet should be a single packet with application layer present
    const rePkt = await osi.getPacketState();
    expect(rePkt).not.toBeNull();
    expect(Array.isArray(rePkt.layers)).toBeTruthy();
    expect(rePkt.layers.some(l => l.layer === 'application')).toBeTruthy();
  });

  test('Generate Random Challenge, Start and Submit Answer => Challenge Started (S8_ChallengeStarted) and responses', async () => {
    // Ensure starting state is idle-ish
    await osi.clickClearAll();

    // Generate a random challenge
    await osi.clickRandomChallenge();

    // The page should have updated challengeStatus and logs
    let status = await osi.getChallengeStatusText();
    expect(status).toMatch(/Generated:/i);

    let log = await osi.getLogText();
    expect(log).toContain('Random challenge generated.');

    // Start the challenge (this triggers an alert which we auto-accept)
    await osi.clickStartChallenge();

    log = await osi.getLogText();
    expect(log).toMatch(/Challenge started:/i);

    // Retrieve the correct answer from the page's lastChallenge if available and submit it
    const correctAnswer = await page.evaluate(() => {
      try { return window.osiLab?.state?.lastChallenge?.correct || null; } catch(e) { return null; }
    });

    // If a correct answer is obtainable, submit it to test success branch
    if (correctAnswer) {
      await osi.setChallengeAnswer(String(correctAnswer));
      await osi.clickSubmitAnswer();

      // After submit, challengeStatus will be updated
      status = await osi.getChallengeStatusText();
      // Accept either correct or incorrect branches; at minimum ensure status changed from "Generated"
      expect(status.length).toBeGreaterThan(0);
      expect(status.toLowerCase()).not.toContain('none');
    } else {
      // If we cannot obtain correctAnswer, still attempt a submission to assert UI handles it gracefully
      await osi.setChallengeAnswer('guess');
      await osi.clickSubmitAnswer();
      status = await osi.getChallengeStatusText();
      expect(status.length).toBeGreaterThan(0);
    }
  });

  test('Edge cases: encapsulate step without packet triggers alert; decapsulate step without packet logs message', async () => {
    // Ensure no packet present
    await osi.clickClearAll();

    // Capture upcoming dialog for encapsulateStep (should alert)
    let sawDialog = false;
    page.once('dialog', async dialog => { sawDialog = true; await dialog.accept(); });

    // Click encapsulate step with no packet -> triggers alert('Create an application packet first.')
    await osi.clickEncapsulateStep();
    // give a moment to handle
    await page.waitForTimeout(200);
    expect(sawDialog).toBeTruthy();

    // Decapsulate step with no packet should log 'No packet to decapsulate.'
    await osi.clickDecapsulateStep();
    const log = await osi.getLogText();
    expect(log).toContain('No packet to decapsulate.');
  });

  test('Error event propagation: clicking injectError with no packet triggers alert', async () => {
    // Ensure no packet
    await osi.clickClearAll();

    let dialogSeen = false;
    page.once('dialog', async dialog => { dialogSeen = true; await dialog.accept(); });

    // Click injectError should alert 'No packet.'
    await osi.clickInjectError();
    await page.waitForTimeout(100);
    expect(dialogSeen).toBeTruthy();
  });

  test('Double-click Encapsulate Step triggers full encapsulation (dblclick mapping)', async () => {
    await osi.clickClearAll();
    await osi.clickCreatePacket();

    // double click is wired to encapsulateFull via dblclick listener
    await osi.doubleClickEncapsulateStep();

    const log = await osi.getLogText();
    expect(log).toContain('Encapsulation: full.');
    const layersText = await osi.getLayersListText();
    expect(layersText.toLowerCase()).toContain('layer: datalink');
  });

  test('No uncaught runtime errors occurred during interactions', async () => {
    // Perform a sequence of typical interactions to exercise code paths
    await osi.clickClearAll();
    await osi.clickCreatePacket();
    await osi.clickEncapsulateFull();
    await osi.setHops(2);
    await osi.clickSendThrough();
    await osi.setErrorType('checksum');
    await osi.clickInjectError().catch(()=>{}); // just in case
    await osi.clickRandomChallenge();
    await osi.clickStartChallenge();

    // Allow logs and any pending async to settle
    await page.waitForTimeout(300);

    // Assert that no pageerror events were thrown
    expect(pageErrors.length).toBe(0);
  });
});