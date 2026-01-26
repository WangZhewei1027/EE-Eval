import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1217d032-fa7a-11f0-acf9-69409043402d.html';

// Helper page object for interacting with the demo
class DigitalSignaturePage {
  constructor(page) {
    this.page = page;
    // UI selectors
    this.generateKeysBtn = page.locator('#generateKeysBtn');
    this.exportKeysBtn = page.locator('#exportKeysBtn');
    this.signMessageBtn = page.locator('#signMessageBtn');
    this.verifySignatureBtn = page.locator('#verifySignatureBtn');
    this.clearAllBtn = page.locator('#clearAllBtn');
    this.showKeyInternalsBtn = page.locator('#showKeyInternalsBtn');
    this.showHashInternalsBtn = page.locator('#showHashInternalsBtn');

    this.keyDetails = page.locator('#keyDetails');
    this.publicKeyArea = page.locator('#publicKeyArea');
    this.privateKeyArea = page.locator('#privateKeyArea');

    this.messageInput = page.locator('#messageInput');
    this.inputIsHex = page.locator('#inputIsHex');
    this.signatureArea = page.locator('#signatureArea');
    this.signatureInput = page.locator('#signatureInput');

    this.encodeSigBase64 = page.locator('#encodeSigBase64');
    this.showSignatureDetails = page.locator('#showSignatureDetails');
    this.signatureDetails = page.locator('#signatureDetails');

    this.verifyMessageInput = page.locator('#verifyMessageInput');
    this.verifyInputIsHex = page.locator('#verifyInputIsHex');
    this.verifyKeyArea = page.locator('#verifyKeyArea');
    this.verifyKeySourceGenerate = page.locator('input[name="verifyKeySource"][value="generate"]');
    this.verifyKeySourcePubkey = page.locator('input[name="verifyKeySource"][value="pubkey"]');
    this.verifyResult = page.locator('#verifyResult');

    this.internalsDisplay = page.locator('#internalsDisplay');
    this.modulusLength = page.locator('#modulusLength');
    this.publicExponent = page.locator('#publicExponent');
    this.algoSelect = page.locator('#algoSelect');
    this.namedCurve = page.locator('#namedCurve');
    this.hashAlgo = page.locator('#hashAlgo');

    this.log = page.locator('#log');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for onload handler to run which resets state
    await this.page.waitForFunction(() => window && typeof window.resetKeyState === 'function');
  }

  // Wait until key details show something exported
  async waitForKeysGenerated(timeout = 15000) {
    await Promise.all([
      this.page.waitForFunction(() => {
        const el = document.getElementById('publicKeyArea');
        return el && el.value && el.value.trim().length > 0;
      }, {}, { timeout }),
      this.keyDetails.waitFor({ state: 'visible', timeout })
    ]);
  }

  async generateKeys() {
    await this.generateKeysBtn.click();
    // generation is async and may open a dialog on errors; caller should handle dialogs via page listeners
    await this.waitForKeysGenerated();
  }

  async signMessage() {
    await this.signMessageBtn.click();
    // wait until signatureArea has content
    await this.page.waitForFunction(() => {
      const el = document.getElementById('signatureArea');
      return el && el.value && el.value.trim().length > 0;
    }, {}, { timeout: 10000 });
  }

  async verifyWithGeneratedKey() {
    // select "Use Generated Key" radio
    await this.verifyKeySourceGenerate.check?.() || await this.page.evaluate(() => {
      document.querySelector('input[name="verifyKeySource"][value="generate"]').checked = true;
    });
    await this.verifySignatureBtn.click();
    // wait for result text to be populated
    await this.verifyResult.waitFor({ state: 'visible', timeout: 10000 });
  }

  async clickExportKeys() {
    await this.exportKeysBtn.click();
  }

  async clickShowKeyInternals() {
    await this.showKeyInternalsBtn.click();
  }

  async clickShowHashInternals() {
    await this.showHashInternalsBtn.click();
  }

  async clearAll() {
    await this.clearAllBtn.click();
  }

  async setPublicExponent(value) {
    await this.publicExponent.fill(value);
  }

  async setMessage(text) {
    await this.messageInput.fill(text);
  }

  async setVerifyMessage(text) {
    await this.verifyMessageInput.fill(text);
  }

  async setSignatureInput(text) {
    await this.signatureInput.fill(text);
  }

  async selectAlgo(value) {
    await this.algoSelect.selectOption(value);
    // wait for UI adjustments
    await this.page.waitForTimeout(100);
  }

  async setNamedCurve(curve) {
    await this.namedCurve.selectOption(curve);
  }

  async setHashAlgo(hash) {
    await this.hashAlgo.selectOption(hash);
  }

  async toggleShowSignatureDetails(checked) {
    const current = await this.showSignatureDetails.isChecked();
    if (current !== checked) await this.showSignatureDetails.click();
  }
}

test.describe('Digital Signatures Interactive Demo - FSM states & transitions', () => {
  let consoleMessages = [];
  let pageErrors = [];
  let dialogs = [];
  let page;

  test.beforeEach(async ({ browser }) => {
    // create a fresh context for each test to avoid shared state
    const context = await browser.newContext();
    page = await context.newPage();

    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    // capture console messages
    page.on('console', msg => {
      try {
        const text = msg.text();
        consoleMessages.push({ type: msg.type(), text });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // capture uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // automatically accept or dismiss dialogs and record them
    page.on('dialog', async dialog => {
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      // Accept alerts/prompts/confirm to allow scripts to proceed
      try {
        await dialog.accept();
      } catch (e) {
        try { await dialog.dismiss(); } catch (e2) { /* ignore */ }
      }
    });

    // navigate to app
    const dsp = new DigitalSignaturePage(page);
    await dsp.goto();
  });

  test.afterEach(async () => {
    // close page to clean up
    try {
      await page.close();
    } catch (e) { /* ignore */ }
  });

  test('S0_Idle: Initial state should be Idle and controls disabled', async () => {
    // Validate initial UI state right after load (onEnter resetKeyState)
    const dsp = new DigitalSignaturePage(page);

    // Key details hidden
    await expect(dsp.keyDetails).toHaveClass(/hidden/);
    // No key text
    await expect(dsp.publicKeyArea).toHaveValue('');
    await expect(dsp.privateKeyArea).toHaveValue('');

    // Buttons disabled as per Idle state
    await expect(dsp.exportKeysBtn).toBeDisabled();
    await expect(dsp.signMessageBtn).toBeDisabled();
    await expect(dsp.showKeyInternalsBtn).toBeDisabled();
    await expect(dsp.showHashInternalsBtn).toBeDisabled();

    // Log should contain 'State reset.' entry produced by resetKeyState() on load
    const logText = await dsp.log.textContent();
    expect(logText).toContain('State reset.');

    // There should be no page-level uncaught errors on initial load (record them if any)
    expect(pageErrors.length).toBe(0);
  });

  test('S0 -> S1: Generate Keys transition - keys generated and UI updated', async () => {
    const dsp = new DigitalSignaturePage(page);

    // Ensure known parameters for deterministic behavior: RSA, 1024 bits with 010001 exponent
    await dsp.selectAlgo('RSASSA-PKCS1-v1_5');
    await dsp.modulusLength.evaluate((el) => el.value = '1024'); // set smaller modulus for speed
    await dsp.modulusLength.dispatchEvent('input');
    await dsp.setPublicExponent('010001'); // common exponent

    // Trigger key generation and wait for keys to appear
    await dsp.generateKeys();

    // Now key details area should be visible and populated
    await expect(dsp.keyDetails).toBeVisible();
    const pubVal = await dsp.publicKeyArea.inputValue();
    const privVal = await dsp.privateKeyArea.inputValue();
    expect(pubVal.length).toBeGreaterThan(0);
    expect(privVal.length).toBeGreaterThan(0);

    // Buttons should be enabled
    await expect(dsp.exportKeysBtn).toBeEnabled();
    await expect(dsp.signMessageBtn).toBeEnabled();
    await expect(dsp.showKeyInternalsBtn).toBeEnabled();

    // Logs should reflect generation activity
    const logs = await dsp.log.textContent();
    expect(logs).toMatch(/Generating key pair/);
    expect(logs).toMatch(/Key pair generated/);

    // No uncaught page errors during generation
    expect(pageErrors.length).toBe(0);
  });

  test('Export Keys triggers alert with instructions (ExportKeys event)', async () => {
    const dsp = new DigitalSignaturePage(page);

    // Generate keys first
    await dsp.selectAlgo('RSASSA-PKCS1-v1_5');
    await dsp.modulusLength.evaluate((el) => el.value = '1024');
    await dsp.modulusLength.dispatchEvent('input');
    await dsp.setPublicExponent('010001');
    await dsp.generateKeys();

    // Click export and assert a dialog appears with expected message
    await dsp.clickExportKeys();

    // Wait a short time for dialog handler to record
    await page.waitForTimeout(200);
    const found = dialogs.find(d => /You can copy keys/.test(d.message));
    expect(found).toBeTruthy();
  });

  test('S1 -> S2: Sign Message transition - sign message and produce signature', async () => {
    const dsp = new DigitalSignaturePage(page);

    // Generate keys
    await dsp.selectAlgo('RSASSA-PKCS1-v1_5');
    await dsp.modulusLength.evaluate((el) => el.value = '1024');
    await dsp.modulusLength.dispatchEvent('input');
    await dsp.setPublicExponent('010001');
    await dsp.generateKeys();

    // Ensure there is a message to sign
    await dsp.setMessage('Playwright signing test message');

    // Sign
    await dsp.signMessage();

    // SignatureArea should now be populated
    const sigText = await dsp.signatureArea.inputValue();
    expect(sigText.length).toBeGreaterThan(0); // non-empty signature

    // Log should include signing event
    const logs = await dsp.log.textContent();
    expect(logs).toMatch(/Signing message/);
    expect(logs).toMatch(/Message signed/);

    // Show hash internals button should be enabled after signing
    await expect(dsp.showHashInternalsBtn).toBeEnabled();

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Show signature internals toggles and displays details (edge behavior)', async () => {
    const dsp = new DigitalSignaturePage(page);

    // Use ECDSA algorithm to trigger ECDSA-specific internals parsing
    await dsp.selectAlgo('ECDSA');
    await dsp.setNamedCurve('P-256');
    // Generate ECDSA keys
    await dsp.generateKeys();

    // Sign message
    await dsp.setMessage('ECDSA internals test');
    await dsp.signMessage();

    // Enable "Show signature internals"
    await dsp.toggleShowSignatureDetails(true);

    // Wait for signatureDetails to become visible with content
    await dsp.signatureDetails.waitFor({ state: 'visible', timeout: 5000 });
    const detailsText = await dsp.signatureDetails.textContent();
    // For ECDSA it should contain either "r (hex)" or DER parse failure text
    expect(detailsText.length).toBeGreaterThan(0);

    // Toggling off hides details
    await dsp.toggleShowSignatureDetails(false);
    await expect(dsp.signatureDetails).toHaveClass(/hidden/);
  });

  test('S2 -> S3: Verify signature with generated key should validate successfully', async () => {
    const dsp = new DigitalSignaturePage(page);

    // Use default RSA algorithm for signing and verifying with generated key
    await dsp.selectAlgo('RSASSA-PKCS1-v1_5');
    await dsp.modulusLength.evaluate((el) => el.value = '1024');
    await dsp.modulusLength.dispatchEvent('input');
    await dsp.setPublicExponent('010001');

    // Generate keys and sign a message
    await dsp.generateKeys();
    const message = 'Verification test message';
    await dsp.setMessage(message);
    await dsp.signMessage();

    // Prepare verification pane: use generated key option
    const signatureValue = await dsp.signatureArea.inputValue();
    // Put signature into verification input (default expects base64)
    await dsp.setSignatureInput(signatureValue);
    await dsp.setVerifyMessage(message);
    // Choose "Use Generated Key" radio
    await dsp.verifyKeySourceGenerate.check?.() || await page.evaluate(() => {
      document.querySelector('input[name="verifyKeySource"][value="generate"]').checked = true;
    });

    // Click verify
    await dsp.verifySignatureBtn.click();

    // Wait for verifyResult to contain valid/invalid text
    await page.waitForFunction(() => {
      const el = document.getElementById('verifyResult');
      return el && (el.textContent === 'Signature is VALID.' || el.textContent === 'Signature is INVALID.');
    }, {}, { timeout: 5000 });

    const resultText = await dsp.verifyResult.textContent();
    // Expect verification with the generated key to be VALID
    expect(resultText).toBe('Signature is VALID.');

    // Check logs for verification messages
    const logs = await dsp.log.textContent();
    expect(logs).toMatch(/Verifying signature/);
    expect(logs).toMatch(/Verification result: VALID/);

    // No uncaught errors
    expect(pageErrors.length).toBe(0);
  });

  test('Verify signature error scenarios: empty signature and missing key import', async () => {
    const dsp = new DigitalSignaturePage(page);

    // Try to verify with empty signature => should trigger alert about providing a signature
    await dsp.setVerifyMessage('anything');
    await dsp.setSignatureInput(''); // empty
    // Ensure verify uses pasted public key option so path tries to read verifyKeyArea
    await dsp.verifyKeySourcePubkey.check?.() || await page.evaluate(() => {
      document.querySelector('input[name="verifyKeySource"][value="pubkey"]').checked = true;
    });
    // Clear verifyKeyArea
    await dsp.verifyKeyArea.fill('');

    // Click verify; should produce a dialog alert "Please provide a signature to verify."
    await dsp.verifySignatureBtn.click();
    // short wait for dialog to be recorded
    await page.waitForTimeout(200);
    const sigDialog = dialogs.find(d => /Please provide a signature to verify/.test(d.message));
    expect(sigDialog).toBeTruthy();

    // Now provide a fake signature and no key text to trigger "Please provide a key in the key area."
    await dsp.setSignatureInput('AAAA'); // invalid base64 but still non-empty
    // Click verify -> should alert to provide key
    await dsp.verifySignatureBtn.click();
    await page.waitForTimeout(200);
    const keyDialog = dialogs.find(d => /Please provide a key in the key area/.test(d.message));
    expect(keyDialog).toBeTruthy();

    // No uncaught page errors should be recorded for these UI validation flows
    expect(pageErrors.length).toBe(0);
  });

  test('Internals buttons behavior: showKeyInternals and showHashInternals edge cases', async () => {
    const dsp = new DigitalSignaturePage(page);

    // Before signing: showHashInternals should show "No hash available"
    await dsp.clickShowHashInternals();
    await dsp.internalsDisplay.waitFor({ state: 'visible', timeout: 1000 });
    let content = await dsp.internalsDisplay.textContent();
    expect(content).toContain('No hash available');

    // Generate keys and then show key internals
    await dsp.selectAlgo('RSASSA-PKCS1-v1_5');
    await dsp.modulusLength.evaluate((el) => el.value = '1024');
    await dsp.modulusLength.dispatchEvent('input');
    await dsp.setPublicExponent('010001');
    await dsp.generateKeys();

    // Click show key internals
    await dsp.clickShowKeyInternals();
    await page.waitForFunction(() => {
      const el = document.getElementById('internalsDisplay');
      return el && el.textContent && el.textContent.includes('Public Key (JWK)');
    }, {}, { timeout: 5000 });
    content = await dsp.internalsDisplay.textContent();
    expect(content).toContain('Public Key (JWK)');

    // After signing, show hash internals produces a hex hash
    await dsp.setMessage('hash internals test');
    await dsp.signMessage();
    await dsp.clickShowHashInternals();
    await page.waitForFunction(() => {
      const el = document.getElementById('internalsDisplay');
      return el && el.textContent && el.textContent.includes('Hash (');
    }, {}, { timeout: 5000 });
    content = await dsp.internalsDisplay.textContent();
    expect(content).toMatch(/Hash \([A-Z0-9-]+\) of last signed message:/);

    // No uncaught page errors occurred during internals exploration
    expect(pageErrors.length).toBe(0);
  });

  test('S1 -> S0: ClearAll transition resets UI and logs appropriately', async () => {
    const dsp = new DigitalSignaturePage(page);

    // Generate keys to get into S1
    await dsp.selectAlgo('RSASSA-PKCS1-v1_5');
    await dsp.modulusLength.evaluate((el) => el.value = '1024');
    await dsp.modulusLength.dispatchEvent('input');
    await dsp.setPublicExponent('010001');
    await dsp.generateKeys();

    // Now click Reset All
    await dsp.clearAll();

    // After clearing, key details should be hidden and fields empty
    await expect(dsp.keyDetails).toHaveClass(/hidden/);
    await expect(dsp.publicKeyArea).toHaveValue('');
    await expect(dsp.privateKeyArea).toHaveValue('');

    // Buttons should be disabled again
    await expect(dsp.exportKeysBtn).toBeDisabled();
    await expect(dsp.signMessageBtn).toBeDisabled();
    await expect(dsp.showKeyInternalsBtn).toBeDisabled();
    await expect(dsp.showHashInternalsBtn).toBeDisabled();

    // Log should include 'All fields reset.' and also 'State reset.' from resetKeyState call
    const logs = await dsp.log.textContent();
    expect(logs).toMatch(/All fields reset/);
    expect(logs).toMatch(/State reset/);

    // No uncaught errors present
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: invalid public exponent hex during key generation triggers alert and logs error', async () => {
    const dsp = new DigitalSignaturePage(page);

    // Set invalid public exponent hex
    await dsp.selectAlgo('RSASSA-PKCS1-v1_5');
    await dsp.modulusLength.evaluate((el) => el.value = '1024');
    await dsp.modulusLength.dispatchEvent('input');
    await dsp.setPublicExponent('ZZZZ'); // invalid hex

    // Click generate - should produce an alert dialog and not generate keys
    await dsp.generateKeysBtn.click();
    // wait for dialog record
    await page.waitForTimeout(200);
    const alertDialog = dialogs.find(d => /Public exponent must be hex/.test(d.message) || /Key generation failed/.test(d.message));
    // The implementation either alerts 'Key generation failed: Public exponent must be hex' or uses alert in catch.
    expect(alertDialog).toBeTruthy();

    // Key details should remain hidden and publicKeyArea empty
    await expect(dsp.keyDetails).toHaveClass(/hidden/);
    await expect(dsp.publicKeyArea).toHaveValue('');

    // Log should document failure
    const logs = await dsp.log.textContent();
    expect(logs.toLowerCase()).toContain('key generation failed');

    // No uncaught page errors (we allowed alert to occur and accepted it)
    expect(pageErrors.length).toBe(0);
  });

  test('Observe console and pageerrors: record and assert no unexpected runtime errors', async () => {
    // This test simply asserts that no uncaught page errors were emitted across interactions
    // and that console has meaningful entries from prior interactions.
    // Note: This test runs in isolation; we navigate and perform a minimal action to collect logs.

    const dsp = new DigitalSignaturePage(page);

    // Trigger a simple action: change algorithm to trigger logs and state reset
    await dsp.selectAlgo('ECDSA');

    // Give some time for logs to emit
    await page.waitForTimeout(200);

    // Validate we captured some console logs related to algorithm change and state reset
    const foundAlgoLog = consoleMessages.some(m => /Algorithm changed to/.test(m.text));
    const foundResetLog = consoleMessages.some(m => /State reset/.test(m.text)) || (await dsp.log.textContent()).includes('State reset.');
    expect(foundAlgoLog || foundResetLog).toBeTruthy();

    // Assert that there were no uncaught page errors during this flow
    expect(pageErrors.length).toBe(0);
  });
});