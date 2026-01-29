import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3dc5260-fa73-11f0-83e0-8d7be1d51901.html';

// Page Object for the demo page to encapsulate interactions
class CryptoDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Alice
    this.aliceGen = page.locator('#aliceGen');
    this.aliceExport = page.locator('#aliceExport');
    this.alicePub = page.locator('#alicePub');
    this.alicePriv = page.locator('#alicePriv');
    this.aliceStatus = page.locator('#aliceStatus');
    // Bob
    this.bobGen = page.locator('#bobGen');
    this.bobExport = page.locator('#bobExport');
    this.bobPub = page.locator('#bobPub');
    this.bobPriv = page.locator('#bobPriv');
    this.bobStatus = page.locator('#bobStatus');
    // Messaging
    this.message = page.locator('#message');
    this.encryptBtn = page.locator('#encryptBtn');
    this.signBtn = page.locator('#signBtn');
    this.encryptSignBtn = page.locator('#encryptSignBtn');
    this.ciphertext = page.locator('#ciphertext');
    this.signature = page.locator('#signature');
    this.decryptBtn = page.locator('#decryptBtn');
    this.verifyBtn = page.locator('#verifyBtn');
    this.decryptVerifyBtn = page.locator('#decryptVerifyBtn');
    this.decrypted = page.locator('#decrypted');
    this.msgStatus = page.locator('#msgStatus');
  }

  // Helpers to click and wait for expected status text
  async generateAlice() {
    await this.aliceGen.click();
    // key generation can take some time; wait for the status update and pub/priv textareas to be populated
    await expect(this.aliceStatus).toHaveText('Alice signing key pair generated.', { timeout: 20000 });
    await expect(this.alicePub).not.toHaveValue('', { timeout: 20000 });
    await expect(this.alicePriv).not.toHaveValue('', { timeout: 20000 });
  }

  async generateBob() {
    await this.bobGen.click();
    await expect(this.bobStatus).toHaveText('Bob encryption key pair generated.', { timeout: 20000 });
    await expect(this.bobPub).not.toHaveValue('', { timeout: 20000 });
    await expect(this.bobPriv).not.toHaveValue('', { timeout: 20000 });
  }

  async exportAlice() {
    await this.aliceExport.click();
  }

  async exportBob() {
    await this.bobExport.click();
  }

  async encrypt() {
    await this.encryptBtn.click();
  }

  async sign() {
    await this.signBtn.click();
  }

  async encryptAndSign() {
    await this.encryptSignBtn.click();
  }

  async decrypt() {
    await this.decryptBtn.click();
  }

  async verify() {
    await this.verifyBtn.click();
  }

  async decryptAndVerify() {
    await this.decryptVerifyBtn.click();
  }

  // Utility to retrieve the current visible status text (trimmed)
  async getAliceStatus() {
    return (await this.aliceStatus.textContent())?.trim() ?? '';
  }
  async getBobStatus() {
    return (await this.bobStatus.textContent())?.trim() ?? '';
  }
  async getMsgStatus() {
    return (await this.msgStatus.textContent())?.trim() ?? '';
  }
}

test.describe('Asymmetric Cryptography Demo (Web Crypto) - FSM and UI tests', () => {
  // Collect console error messages and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen for console messages and collect errors
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) {
        // ignore instrumentation errors
      }
    });

    // Collect unhandled page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Ensure the page rendered with expected title
    await expect(page).toHaveTitle(/Asymmetric Cryptography Demo/i);
  });

  test.afterEach(async () => {
    // After each test assert there were no unexpected uncaught errors logged to the page console
    expect(pageErrors.length, 'No uncaught page errors should have occurred').toBe(0);
    expect(consoleErrors.length, 'No console errors should have been logged').toBe(0);
  });

  test('S0 -> S1: Generate Alice keys (AliceGen) and export', async ({ page }) => {
    // This test validates the transition: Idle -> AliceKeysGenerated (AliceGen)
    const demo = new CryptoDemoPage(page);

    // Ensure initial idle status for Alice is empty
    expect(await demo.getAliceStatus()).toBe('');

    // Trigger generation of Alice keys
    await demo.generateAlice();

    // Verify evidence: status text and exported key contents were populated
    await expect(demo.aliceStatus).toHaveText("Alice signing key pair generated.");
    await expect(demo.alicePub).not.toHaveValue('');
    await expect(demo.alicePriv).not.toHaveValue('');

    // Now test exporting explicitly (should succeed and update status)
    await demo.exportAlice();
    await expect(demo.aliceStatus).toHaveText("Alice public key exported.");
    // alicePub should still have a value
    await expect(demo.alicePub).not.toHaveValue('');
  });

  test('S0 -> S2: Generate Bob keys (BobGen) and export', async ({ page }) => {
    // Validates Idle -> BobKeysGenerated (BobGen) and export action
    const demo1 = new CryptoDemoPage(page);

    // Trigger generation of Bob keys
    await demo.generateBob();

    // Validate status and key export fields
    await expect(demo.bobStatus).toHaveText("Bob encryption key pair generated.");
    await expect(demo.bobPub).not.toHaveValue('');
    await expect(demo.bobPriv).not.toHaveValue('');

    // Export Bob's public key explicitly
    await demo.exportBob();
    await expect(demo.bobStatus).toHaveText("Bob public key exported.");
    await expect(demo.bobPub).not.toHaveValue('');
  });

  test('Encrypt (EncryptMessage) without Bob public key shows error', async ({ page }) => {
    // Edge case: encrypting without Bob public key should show user-facing error
    const demo2 = new CryptoDemoPage(page);

    // Clear any bobPub content if present
    await demo.bobPub.fill('');
    // Click encrypt - should result in an error shown in msgStatus
    await demo.encrypt();

    // Expect an error (UI indicates request to paste Bob's public key)
    await expect(demo.msgStatus).toHaveText(/Paste Bob's public key into the "Bob's Public Key" box first\./);
    await expect(demo.msgStatus).toHaveClass(/error/);
  });

  test('Sign (SignMessage) without Alice key pair shows error', async ({ page }) => {
    // Edge case: signing with no Alice key pair in memory should show an error
    const demo3 = new CryptoDemoPage(page);

    // Ensure Alice state cleared
    await demo.alicePub.fill('');
    await demo.alicePriv.fill('');
    // simulate that no key pair in memory by not generating; click Sign
    await demo.sign();

    // Expect an error message instructing to generate Alice keys first
    await expect(demo.msgStatus).toHaveText(/Alice has no signing key pair in memory. Generate Alice keys first\./);
    await expect(demo.msgStatus).toHaveClass(/error/);
  });

  test('Encrypt & Sign -> Decrypt & Verify happy path (EncryptAndSign, DecryptAndVerify)', async ({ page }) => {
    // Full happy-path: generate keys, encrypt+sign, then decrypt+verify
    const demo4 = new CryptoDemoPage(page);

    // Generate Alice and Bob keys (transitions S0 -> S1 and S0 -> S2)
    await demo.generateAlice();
    await demo.generateBob();

    // Ensure message is present
    const originalMessage = await demo.message.inputValue();
    expect(originalMessage.length).toBeGreaterThan(0);

    // Encrypt & Sign (should populate ciphertext and signature)
    await demo.encryptAndSign();

    await expect(demo.ciphertext).not.toHaveValue('');
    await expect(demo.signature).not.toHaveValue('');
    await expect(demo.msgStatus).toHaveText("Message encrypted (for Bob) and signed (by Alice).");

    // Decrypt & Verify
    await demo.decryptAndVerify();

    // After decrypt & verify we expect decrypted message to match original and status to show verified
    await expect(demo.decrypted).toHaveValue(originalMessage);
    await expect(demo.msgStatus).toHaveText("Decrypted and signature VERIFIED.");
  }, { timeout: 60000 });

  test('Encrypt only then Decrypt (EncryptMessage -> DecryptMessage)', async ({ page }) => {
    // Validate encryption alone and decryption using Bob's private key
    const demo5 = new CryptoDemoPage(page);

    // Setup: generate Bob keys and ensure bobPub and bobPriv are present
    await demo.generateBob();

    // Ensure there is a message and that alicePub/signature are not required for this path
    const originalMessage1 = await demo.message.inputValue();

    // Use bobPub filled by generateBob -> click encrypt
    await demo.encrypt();

    await expect(demo.ciphertext).not.toHaveValue('');
    await expect(demo.msgStatus).toHaveText("Message encrypted with Bob's public key.");

    // Decrypt using bobPriv (populated by generateBob)
    await demo.decrypt();

    // Decrypted textarea should contain the original plaintext
    await expect(demo.decrypted).toHaveValue(originalMessage);
    await expect(demo.msgStatus).toHaveText("Bob decrypted the message.");
  }, { timeout: 60000 });

  test('Sign only then Verify (SignMessage -> VerifySignature) happy and failure cases', async ({ page }) => {
    // Validate signing and verification success, then simulate tampering for failure path
    const demo6 = new CryptoDemoPage(page);

    // Generate Alice so we have signing keys and public key data
    await demo.generateAlice();

    // Ensure message present
    const originalMessage2 = await demo.message.inputValue();

    // Sign the message
    await demo.sign();

    await expect(demo.signature).not.toHaveValue('');
    await expect(demo.msgStatus).toHaveText("Message signed with Alice's private key.");

    // Verify should succeed because alicePub TA was populated by generateAlice
    await demo.verify();
    await expect(demo.msgStatus).toHaveText("Signature VERIFIED — it was signed by Alice.");

    // Tamper the message to trigger signature NOT valid branch (S7)
    await demo.message.fill(originalMessage + ' tampered');
    // Clear decrypted area to force verify to use messageTA
    await demo.decrypted.fill('');
    await demo.verify();
    await expect(demo.msgStatus).toHaveText("Signature NOT valid.");
  });

  test('Verify without signature or Alice public key shows informative errors', async ({ page }) => {
    // Validate error flows for missing prerequisites during verification
    const demo7 = new CryptoDemoPage(page);

    // Ensure signature and alicePub are empty
    await demo.signature.fill('');
    await demo.alicePub.fill('');

    // Attempt verify -> should complain about missing Alice public key first
    await demo.verify();
    await expect(demo.msgStatus).toHaveText(/Paste Alice's public key into "Alice's Public Key" box\./);
    await expect(demo.msgStatus).toHaveClass(/error/);

    // Now fill alicePub with something invalid (not a real key) and attempt verify -> should complain about missing signature
    await demo.alicePub.fill('invalid-base64');
    await demo.signature.fill('');
    await demo.verify();
    await expect(demo.msgStatus).toHaveText(/No signature present\. Sign the message first or paste a signature\./);
    await expect(demo.msgStatus).toHaveClass(/error/);
  });

  test('Decrypt with missing or invalid Bob private key shows errors', async ({ page }) => {
    // Validate decryption failure paths and user-visible error messages
    const demo8 = new CryptoDemoPage(page);

    // Ensure ciphertext exists by generating Bob and encrypting
    await demo.generateBob();
    await demo.encrypt();

    // Clear bobPriv to simulate missing private key
    await demo.bobPriv.fill('');
    await demo.decrypt();
    await expect(demo.msgStatus).toHaveText(/Paste Bob's private key into the "Bob's Private Key" box \(for demo only\)\./);
    await expect(demo.msgStatus).toHaveClass(/error/);

    // Now put an invalid private key value and attempt decrypt -> should trigger an exception and show error
    await demo.bobPriv.fill('not-a-valid-key');
    await demo.decrypt();
    // An exception from SubtleCrypto.importKey or decrypt will be surfaced; the UI's showError prefixes with "Error: "
    const status = await demo.getMsgStatus();
    expect(status.startsWith('Error:'), 'Decrypt with invalid key should surface an Error message').toBe(true);
    await expect(demo.msgStatus).toHaveClass(/error/);
  }, { timeout: 30000 });

  test('S1 Alice public key export when key pair exists and class updates', async ({ page }) => {
    // Ensure Alice export transition S1 -> S1 (AliceExport) sets proper status text
    const demo9 = new CryptoDemoPage(page);

    await demo.generateAlice();
    // Export again explicitly
    await demo.exportAlice();
    await expect(demo.aliceStatus).toHaveText('Alice public key exported.');
    // aliceStatus should not have the .error class
    const classAttr = await demo.aliceStatus.getAttribute('class') || '';
    expect(classAttr.includes('error')).toBe(false);
  });

  test('S2 Bob public key export when key pair exists and class updates', async ({ page }) => {
    // Ensure Bob export transition S2 -> S2 (BobExport) sets proper status text
    const demo10 = new CryptoDemoPage(page);

    await demo.generateBob();
    // Export again explicitly
    await demo.exportBob();
    await expect(demo.bobStatus).toHaveText('Bob public key exported.');
    // bobStatus should not have the .error class
    const classAttr1 = await demo.bobStatus.getAttribute('class') || '';
    expect(classAttr.includes('error')).toBe(false);
  });
});