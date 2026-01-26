import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3da0870-fa73-11f0-83e0-8d7be1d51901.html';

// Page Object for the demo to encapsulate interactions and common assertions
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.btnGenCA = page.locator('#btnGenCA');
    this.btnGenServer = page.locator('#btnGenServer');
    this.btnVerify = page.locator('#btnVerify');
    this.btnHandshake = page.locator('#btnHandshake');
    this.btnSend = page.locator('#btnSend');
    this.btnTamper = page.locator('#btnTamper');
    this.btnMITM = page.locator('#btnMITM');

    this.serverNameInput = page.locator('#serverName');
    this.plainMsgInput = page.locator('#plainMsg');

    this.logEl = page.locator('#log');
    this.caPubEl = page.locator('#caPub');
    this.serverCertEl = page.locator('#serverCert');

    // arrays to collect console messages and page errors (populated externally)
    this.consoleMessages = [];
    this.pageErrors = [];
  }

  // Click helpers
  async clickGenerateCA() {
    await this.btnGenCA.click();
    // Wait for CA public JWK to be shown in the dedicated pre element
    await expect(this.caPubEl).toContainText('"kty"');
    await expect(this.logEl).toContainText('CA generated and added to client');
  }

  async clickCreateServer() {
    await this.btnGenServer.click();
    // Wait for serverCert JSON to be populated
    await expect(this.serverCertEl).toContainText('"cert"');
    await expect(this.logEl).toContainText('Server certificate created for');
  }

  async clickVerify() {
    await this.btnVerify.click();
    // verification may succeed or fail depending on prior actions; caller should check for specific messages
  }

  async clickHandshake() {
    await this.btnHandshake.click();
    // Wait for handshake success message (or failure)
  }

  async clickSend() {
    await this.btnSend.click();
    // Wait to see ciphertext log or a "Perform handshake first." message
  }

  async clickTamper() {
    await this.btnTamper.click();
    // Wait for tamper log
    await expect(this.logEl).toContainText('Certificate was tampered with');
  }

  async clickMITM() {
    await this.btnMITM.click();
    // Wait for attacker messages to appear
  }

  async getLogText() {
    return await this.logEl.textContent();
  }

  async getCaPubText() {
    return await this.caPubEl.textContent();
  }

  async getServerCertText() {
    return await this.serverCertEl.textContent();
  }
}

test.describe('HTTPS Concept Demo (Web Crypto Simulation) - FSM end-to-end tests', () => {
  // We'll capture console messages and page errors for each test run
  test.beforeEach(async ({ page }) => {
    // Capture console messages and page errors so tests can assert on them
    page.on('console', (msg) => {
      // store minimal console info for assertions
      // msg.type() can be 'log', 'error', 'warning', etc.
      // msg.text() contains the message text
      // We do not modify the page; simply observe
      // Collect these for later assertions in tests
      // Note: Some browsers may not emit console events for the custom log() used in the demo (which writes to DOM),
      // but we still observe whatever console messages are produced.
      // eslint-disable-next-line no-console
      // console.log(`[PAGE CONSOLE ${msg.type()}] ${msg.text()}`);
    });

    page.on('pageerror', (err) => {
      // eslint-disable-next-line no-console
      // console.error('[PAGE ERROR]', err);
    });

    // Navigate to the app fresh for each test
    await page.goto(APP_URL);
    // Ensure the page initialized message is present
    await expect(page.locator('#log')).toContainText('Demo initialized. Steps:');
  });

  test('Initial state: Idle with initialization message and placeholders', async ({ page }) => {
    // Validate initial UI: CA public and server cert placeholders should be empty/placeholder
    const demo = new DemoPage(page);

    const caText = await demo.getCaPubText();
    expect(caText.trim()).toBe('—'); // initial CA public JWK placeholder

    const serverText = await demo.getServerCertText();
    expect(serverText.trim()).toBe('—'); // initial server cert placeholder

    const log = await demo.getLogText();
    // Entry action for initial state should have been logged
    expect(log).toContain('Demo initialized. Steps: 1) Generate CA');
  });

  test('Happy path: Generate CA -> Create Server -> Verify -> Handshake -> Send Message', async ({ page }) => {
    // This test covers the main forward transitions S0 -> S1 -> S2 -> S3 -> S4 -> S5
    const demo = new DemoPage(page);

    // 1) Generate CA
    await demo.clickGenerateCA();
    const caPub = await demo.getCaPubText();
    expect(caPub).toContain('"kty"'); // JWK content exists

    // 2) Create Server & Certificate
    await demo.clickCreateServer();
    let serverCert = await demo.getServerCertText();
    expect(serverCert).toContain('"cert"');
    expect(serverCert).toContain('"publicKeyJwk"');

    // 3) Verify Certificate (should succeed)
    await demo.clickVerify();
    // Wait for the verification success log to appear
    await expect(page.locator('#log')).toContainText('Certificate verification:');
    const logAfterVerify = await demo.getLogText();
    expect(logAfterVerify).toMatch(/Certificate verification:.*OK/);

    // 4) Perform Handshake (derive session key)
    await demo.clickHandshake();
    // Wait for handshake success log
    await expect(page.locator('#log')).toContainText('Handshake successful');
    const logAfterHandshake = await demo.getLogText();
    expect(logAfterHandshake).toContain('Handshake successful — both sides derived the same AES-GCM session key');

    // 5) Send Encrypted Message: should log ciphertext and server successfully decrypts
    // Ensure message input has a known value
    await demo.plainMsgInput.fill("Test message from playwright");
    await demo.clickSend();
    // Check that client->