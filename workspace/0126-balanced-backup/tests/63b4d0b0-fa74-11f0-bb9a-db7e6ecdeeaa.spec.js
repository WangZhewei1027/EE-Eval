import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b4d0b0-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for the Digital Signatures Demo
class DigitalSignaturesPage {
  constructor(page) {
    this.page = page;
  }

  // Elements
  generateKeyBtn() { return this.page.locator('#generateKeyBtn'); }
  signBtn() { return this.page.locator('#signBtn'); }
  verifyBtn() { return this.page.locator('#verifyBtn'); }
  messageTextarea() { return this.page.locator('#message'); }
  keyStatus() { return this.page.locator('#keyStatus'); }
  publicKeyPre() { return this.page.locator('#publicKey'); }
  privateKeyPre() { return this.page.locator('#privateKey'); }
  signaturePre() { return this.page.locator('#signature'); }
  verificationResult() { return this.page.locator('#verificationResult'); }
  keysSection() { return this.page.locator('#keysSection'); }
  signSection() { return this.page.locator('#signSection'); }
  verifySection() { return this.page.locator('#verifySection'); }

  // Actions
  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickGenerate() {
    await this.generateKeyBtn().click();
  }

  async clickSign() {
    await this.signBtn().click();
  }

  async clickVerify() {
    await this.verifyBtn().click();
  }

  async setMessage(text) {
    await this.messageTextarea().fill(text);
  }

  // Utilities to read inline style.color (returns the literal style value if set inline)
  async verificationResultInlineColor() {
    return await this.page.evaluate(() => {
      const el = document.getElementById('verificationResult');
      return el ? el.style.color : null;
    });
  }

  async keyStatusText() {
    return (await this.keyStatus().innerText()).trim();
  }

  async publicKeyText() {
    return (await this.publicKeyPre().innerText()).trim();
  }

  async privateKeyText() {
    return (await this.privateKeyPre().innerText()).trim();
  }

  async signatureText() {
    return (await this.signaturePre().innerText()).trim();
  }

  async verificationResultText() {
    return (await this.verificationResult().innerText()).trim();
  }
}

// Group tests for clarity
test.describe('Digital Signatures Demonstration - FSM states and transitions', () => {
  // Collect console errors and page errors for each test to assert on them
  test.beforeEach(async ({ page }) => {
    // No-op here; listeners are attached in each test to collect messages specific to that test.
  });

  // Initial Idle state - S0_Idle
  test('Initial Idle state renders correctly (S0_Idle)', async ({ page }) => {
    // Collect console and page errors
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const app = new DigitalSignaturesPage(page);
    await app.goto();

    // Validate presence of Generate Key Pair button per FSM evidence
    await expect(app.generateKeyBtn()).toBeVisible();
    await expect(app.generateKeyBtn()).toHaveText('Generate Key Pair');

    // Keys and Sign sections should be hidden initially
    await expect(app.keysSection()).toBeHidden();
    await expect(app.signSection()).toBeHidden();
    await expect(app.verifySection()).toBeHidden();

    // keyStatus initially empty
    expect(await app.keyStatusText()).toBe('');

    // No runtime console errors or page errors should have occurred so far
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  // Transition: Generate Key Pair -> Keys Generated (S0 -> S1)
  test('Generate Key Pair transitions to Keys Generated (S1_KeysGenerated)', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const app = new DigitalSignaturesPage(page);
    await app.goto();

    // Click Generate Key Pair and wait for success status and UI changes
    await app.clickGenerate();

    // Wait for keyStatus to indicate generation succeeded
    await expect(app.keyStatus()).toHaveText(/Key pair generated successfully\./, { timeout: 30000 });

    // Keys section and Sign section should now be visible
    await expect(app.keysSection()).toBeVisible();
    await expect(app.signSection()).toBeVisible();

    // Public and private key contents should be present and in PEM-like format
    const pubKey = await app.publicKeyText();
    const privKey = await app.privateKeyText();
    expect(pubKey).toContain('-----BEGIN PUBLIC KEY-----');
    expect(pubKey).toContain('-----END PUBLIC KEY-----');
    expect(privKey).toContain('-----BEGIN PRIVATE KEY-----');
    expect(privKey).toContain('-----END PRIVATE KEY-----');

    // Verify section should be hidden until message is signed
    await expect(app.verifySection()).toBeHidden();

    // No console or page errors occurred during key generation
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  // Transition: Sign Message -> Message Signed (S1 -> S2)
  test('Sign Message transitions to Message Signed (S2_Signed)', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const app = new DigitalSignaturesPage(page);
    await app.goto();

    // Generate keys first
    await app.clickGenerate();
    await expect(app.keyStatus()).toHaveText(/Key pair generated successfully\./, { timeout: 30000 });

    // Ensure a known message is present
    await expect(app.messageTextarea()).toHaveValue(/Hello World!/);

    // Click sign and wait for signature to appear and verify section to display
    await app.clickSign();

    // Signature should be filled (base64 string)
    await expect(app.signaturePre()).toHaveText(/^[A-Za-z0-9+/=]+$/, { timeout: 30000 });

    // Verify section becomes visible
    await expect(app.verifySection()).toBeVisible();

    // verificationResult cleared
    expect(await app.verificationResultText()).toBe('');

    // No console or page errors during signing
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  // Transition: VerifySignature -> Verified (S2 -> S3) - valid case
  test('Verify Signature when unmodified message yields VALID result (S3_Verified)', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const app = new DigitalSignaturesPage(page);
    await app.goto();

    // Generate keys and sign message
    await app.clickGenerate();
    await expect(app.keyStatus()).toHaveText(/Key pair generated successfully\./, { timeout: 30000 });
    await app.clickSign();
    await expect(app.signaturePre()).toHaveText(/^[A-Za-z0-9+/=]+$/, { timeout: 30000 });

    // Click verify and expect a valid verification result
    await app.clickVerify();

    // verificationResult text and inline color should match S3 evidence
    await expect(app.verificationResult()).toHaveText(/✅ Signature is VALID\. Message is authentic and unaltered\./, { timeout: 10000 });
    const color = await app.verificationResultInlineColor();
    expect(color).toBe('green');

    // No runtime errors expected
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  // Transition: VerifySignature -> VerificationFailed (S2 -> S4) - tampering case
  test('Verify Signature fails if message is tampered (S4_VerificationFailed)', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const app = new DigitalSignaturesPage(page);
    await app.goto();

    // Generate keys and sign original message
    await app.clickGenerate();
    await expect(app.keyStatus()).toHaveText(/Key pair generated successfully\./, { timeout: 30000 });
    await app.clickSign();
    await expect(app.signaturePre()).toHaveText(/^[A-Za-z0-9+/=]+$/, { timeout: 30000 });

    // Tamper the message (modify the textarea) to make verification fail
    await app.setMessage('Hello Tampered!');

    // Click verify and expect an INVALID result
    await app.clickVerify();

    await expect(app.verificationResult()).toHaveText(/❌ Signature is INVALID\. Message or signature has been tampered with\./, { timeout: 10000 });
    const color = await app.verificationResultInlineColor();
    expect(color).toBe('red');

    // No console or page errors expected from the normal failure path
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  // Edge case: Attempt to sign before generating keys -> alert
  test('Attempt to sign before generating keys triggers alert and no signing occurs (edge case)', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const app = new DigitalSignaturesPage(page);
    await app.goto();

    // Listen for the dialog triggered by signBtn.onclick when keyPair is null
    const dialogPromise = page.waitForEvent('dialog');
    await app.clickSign();
    const dialog = await dialogPromise;
    expect(dialog.message()).toBe('Please generate the key pair first.');
    await dialog.accept();

    // Signature should remain empty and verify section hidden
    expect(await app.signatureText()).toBe('');
    await expect(app.verifySection()).toBeHidden();

    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  // Edge case: Attempt to verify before generating keys triggers alert
  test('Attempt to verify before generating keys triggers alert (edge case)', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const app = new DigitalSignaturesPage(page);
    await app.goto();

    const dialogPromise = page.waitForEvent('dialog');
    await app.clickVerify();
    const dialog = await dialogPromise;
    expect(dialog.message()).toBe('Please generate the key pair first.');
    await dialog.accept();

    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  // Edge case: Attempt to verify after generating keys but before signing triggers alert
  test('Attempt to verify after generating keys but before signing triggers specific alert (edge case)', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const app = new DigitalSignaturesPage(page);
    await app.goto();

    await app.clickGenerate();
    await expect(app.keyStatus()).toHaveText(/Key pair generated successfully\./, { timeout: 30000 });

    const dialogPromise = page.waitForEvent('dialog');
    await app.clickVerify();
    const dialog = await dialogPromise;
    expect(dialog.message()).toBe('Please sign the message first.');
    await dialog.accept();

    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  // Edge case: Attempt to sign with empty message after generating keys triggers alert
  test('Signing with empty message after generating keys triggers alert (edge case)', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const app = new DigitalSignaturesPage(page);
    await app.goto();

    // Generate keys
    await app.clickGenerate();
    await expect(app.keyStatus()).toHaveText(/Key pair generated successfully\./, { timeout: 30000 });

    // Clear the message textarea and attempt to sign
    await app.setMessage('');
    const dialogPromise = page.waitForEvent('dialog');
    await app.clickSign();
    const dialog = await dialogPromise;
    expect(dialog.message()).toBe('Please enter a message to sign.');
    await dialog.accept();

    // Signature should remain empty and verify section hidden
    expect(await app.signatureText()).toBe('');
    await expect(app.verifySection()).toBeHidden();

    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  // Additional check: Ensure that after regenerating keys previous signature and verification are cleared
  test('Regenerating keys clears previous signature and verification results', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const app = new DigitalSignaturesPage(page);
    await app.goto();

    // Generate keys and sign
    await app.clickGenerate();
    await expect(app.keyStatus()).toHaveText(/Key pair generated successfully\./, { timeout: 30000 });
    await app.clickSign();
    await expect(app.signaturePre()).toHaveText(/^[A-Za-z0-9+/=]+$/, { timeout: 30000 });

    // Verify (should be valid)
    await app.clickVerify();
    await expect(app.verificationResult()).toHaveText(/✅ Signature is VALID\. Message is authentic and unaltered\./, { timeout: 10000 });

    // Now regenerate keys - this should clear signature and verificationResult per implementation
    await app.clickGenerate();
    await expect(app.keyStatus()).toHaveText(/Key pair generated successfully\./, { timeout: 30000 });

    // Signature and verificationResult should be cleared, verifySection hidden
    expect(await app.signatureText()).toBe('');
    expect(await app.verificationResultText()).toBe('');
    await expect(app.verifySection()).toBeHidden();

    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });
});