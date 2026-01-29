import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3e4aa1-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object for the Digital Signature Demo app
class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      message: '#message',
      generateBtn: "button[onclick='generateKeys()']",
      signBtn: "button[onclick='signMessage()']",
      verifyBtn: "button[onclick='verifySignature()']",
      tamperBtn: "button[onclick='tamperMessage()']",
      outputParagraphs: '#output p',
      outputContainer: '#output'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getMessageValue() {
    return this.page.locator(this.selectors.message).inputValue();
  }

  async clickGenerate() {
    await this.page.click(this.selectors.generateBtn);
  }

  async clickSign() {
    await this.page.click(this.selectors.signBtn);
  }

  async clickVerify() {
    await this.page.click(this.selectors.verifyBtn);
  }

  async clickTamper() {
    await this.page.click(this.selectors.tamperBtn);
  }

  async getOutputsText() {
    const elements = this.page.locator(this.selectors.outputParagraphs);
    const count = await elements.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await elements.nth(i).innerText()).trim());
    }
    return texts;
  }

  // Wait until any output paragraph contains the given substring
  async waitForOutputContains(substring, options = { timeout: 5000 }) {
    await this.page.waitForFunction(
      (selector, sub) => {
        const container = document.querySelector(selector);
        if (!container) return false;
        return Array.from(container.querySelectorAll('p')).some(p => p.textContent.includes(sub));
      },
      this.selectors.outputContainer,
      substring,
      options
    );
  }

  // Wait until output contains a paragraph that matches regex
  async waitForOutputMatching(regex, options = { timeout: 7000 }) {
    await this.page.waitForFunction(
      (selector, source) => {
        const re = new RegExp(source);
        const container = document.querySelector(selector);
        if (!container) return false;
        return Array.from(container.querySelectorAll('p')).some(p => re.test(p.textContent));
      },
      this.selectors.outputContainer,
      regex.source,
      options
    );
  }
}

test.describe('Digital Signature Demo - FSM state and transition tests', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for each test
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // capture all console messages for inspection
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // capture uncaught exceptions (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Basic sanity: ensure no fatal page errors occurred during tests
    // This asserts there were no uncaught runtime errors such as ReferenceError/SyntaxError/TypeError.
    // If the application emits such errors naturally, this assertion will fail and surface them.
    expect(pageErrors.map(e => e.message)).toEqual([]);
  });

  test('Initial render (S0_Idle) shows UI components and default message', async ({ page }) => {
    // Validate initial state: textarea populated, buttons present, output empty.
    const app = new AppPage(page);
    await app.goto();

    // The textarea should contain the default message as per the HTML implementation.
    const messageValue = await app.getMessageValue();
    expect(messageValue).toBe('This is a secret message!');

    // Buttons should be visible
    await expect(page.locator(app.selectors.generateBtn)).toBeVisible();
    await expect(page.locator(app.selectors.signBtn)).toBeVisible();
    await expect(page.locator(app.selectors.verifyBtn)).toBeVisible();
    await expect(page.locator(app.selectors.tamperBtn)).toBeVisible();

    // Output should start empty
    const outputs = await app.getOutputsText();
    expect(outputs.length).toBe(0);
  });

  test('Generate Keys transition (S0_Idle -> S1_KeysGenerated) produces expected outputs and JWK', async ({ page }) => {
    // This validates key generation produces human-readable messages and a JWK public key export.
    const app = new AppPage(page);
    await app.goto();

    await app.clickGenerate();

    // Wait for expected messages
    await app.waitForOutputContains('Key pair generated successfully!');
    await app.waitForOutputContains('Public key can be shared, private key must be kept secret.');
    await app.waitForOutputContains('Public Key (JWK format):');

    const outputs = await app.getOutputsText();
    // Ensure at least the success text and the JWK JSON are present
    const joined = outputs.join('\n');
    expect(joined).toContain('Key pair generated successfully!');
    expect(joined).toContain('Public Key (JWK format):');

    // The JWK export should look like JSON with typical RSA fields (kty, e, n) - assert presence of "kty"
    expect(joined).toMatch(/"kty"\s*:/);
  });

  test('Signing without generating keys first shows an error (edge case)', async ({ page }) => {
    // Validate user sees helpful error if they try to sign before generating keys (edge case).
    const app = new AppPage(page);
    await app.goto();

    await app.clickSign();

    await app.waitForOutputContains('Please generate a key pair first.');
    const outputs = await app.getOutputsText();
    expect(outputs.some(t => t.includes('Please generate a key pair first.'))).toBeTruthy();
  });

  test('Sign message after generating keys (S1_KeysGenerated -> S2_MessageSigned) shows signature hex', async ({ page }) => {
    // Validate signing produces a signature and hex string is output.
    const app = new AppPage(page);
    await app.goto();

    await app.clickGenerate();

    // Wait for keys generated
    await app.waitForOutputContains('Key pair generated successfully!');

    await app.clickSign();

    // Wait for signature success message
    await app.waitForOutputContains('Signature created successfully!');
    await app.waitForOutputContains('Signature (hex):');

    // Ensure a hex string appears after the label
    const outputs = await app.getOutputsText();
    const hexLine = outputs.find(line => line.startsWith('Signature (hex):'));
    expect(hexLine).toBeTruthy();

    // Extract hex part and validate it's hex characters and has length > 0
    const hexPart = hexLine.replace('Signature (hex):', '').trim();
    expect(hexPart.length).toBeGreaterThan(0);
    expect(/^[0-9a-f]+$/i.test(hexPart)).toBeTruthy();
  });

  test('Verify signature succeeds after sign (S2_MessageSigned -> S3_SignatureVerified)', async ({ page }) => {
    // Full flow: generate -> sign -> verify -> expect valid signature outputs.
    const app = new AppPage(page);
    await app.goto();

    await app.clickGenerate();
    await app.waitForOutputContains('Key pair generated successfully!');

    await app.clickSign();
    await app.waitForOutputContains('Signature created successfully!');

    await app.clickVerify();

    // Validate successful verification messages
    await app.waitForOutputContains('Signature is VALID!');
    await app.waitForOutputContains("This message was signed with the private key and hasn't been altered.");

    const outputs = await app.getOutputsText();
    expect(outputs.some(t => t.includes('Signature is VALID!'))).toBeTruthy();
  });

  test('Tamper message after signing (S2_MessageSigned -> S5_MessageTampered) then verify yields INVALID (S4_SignatureInvalid)', async ({ page }) => {
    // Generate keys, sign, tamper, then verify -> expect invalid signature messages.
    const app = new AppPage(page);
    await app.goto();

    await app.clickGenerate();
    await app.waitForOutputContains('Key pair generated successfully!');

    await app.clickSign();
    await app.waitForOutputContains('Signature created successfully!');

    // Tamper the message
    await app.clickTamper();

    // Tamper should output tampered message prompt
    await app.waitForOutputContains('Message tampered with! Try verifying now.');

    const afterTamperOutputs = await app.getOutputsText();
    expect(afterTamperOutputs.some(t => t.includes('Message tampered with! Try verifying now.'))).toBeTruthy();

    // Now verify - should be invalid
    await app.clickVerify();

    await app.waitForOutputContains('Signature is INVALID!');
    await app.waitForOutputContains("This message may have been altered or wasn't signed with the expected private key.");

    const outputs = await app.getOutputsText();
    expect(outputs.some(t => t.includes('Signature is INVALID!'))).toBeTruthy();
  });

  test('Verify without signing shows an error (edge case): should ask to generate keys and sign', async ({ page }) => {
    // After generating keys but before signing, verify should prompt to generate keys and sign.
    const app = new AppPage(page);
    await app.goto();

    // Generate keys only
    await app.clickGenerate();
    await app.waitForOutputContains('Key pair generated successfully!');

    // Attempt to verify without a signature
    await app.clickVerify();

    await app.waitForOutputContains('Please generate keys and sign a message first.');
    const outputs = await app.getOutputsText();
    expect(outputs.some(t => t.includes('Please generate keys and sign a message first.'))).toBeTruthy();
  });

  test('Tamper without signing shows an error (edge case)', async ({ page }) => {
    // If originalMessage is not set (i.e., not signed), tamperMessage should instruct to sign first.
    const app = new AppPage(page);
    await app.goto();

    // Without signing, clicking tamper should produce an error telling user to sign first.
    await app.clickTamper();

    await app.waitForOutputContains('Please sign a message first.');
    const outputs = await app.getOutputsText();
    expect(outputs.some(t => t.includes('Please sign a message first.'))).toBeTruthy();
  });

  test('Generating keys twice produces two different exported public keys (state mutation and replacement)', async ({ page }) => {
    // Generate keys twice and ensure that two separate public key exports are produced (demonstrates state change).
    const app = new AppPage(page);
    await app.goto();

    // First generation
    await app.clickGenerate();
    await app.waitForOutputContains('Public Key (JWK format):');

    // Capture current outputs after first generate
    const outputs1 = await app.getOutputsText();
    const jwkIndex1 = outputs1.findIndex(t => t.includes('Public Key (JWK format):'));
    // The JSON should be the next line(s). We'll capture the full joined outputs for later comparison.
    const joined1 = outputs1.join('\n');

    // Second generation
    await app.clickGenerate();
    await app.waitForOutputContains('Public Key (JWK format):');

    const outputs2 = await app.getOutputsText();
    const joined2 = outputs2.join('\n');

    // Ensure that the page now contains at least two 'Public Key (JWK format):' occurrences
    const countPublicKeyLabels = (joined2.match(/Public Key \(JWK format\):/g) || []).length;
    expect(countPublicKeyLabels).toBeGreaterThanOrEqual(2);

    // Attempt to extract the two most recent JWK JSON blobs by simple heuristic:
    // Ensure the joined content changed after second generation (they should not be identical).
    expect(joined1).not.toEqual(joined2);
  });

  test('Console and runtime error inspection: capture console messages and ensure no uncaught errors', async ({ page }) => {
    // This test explicitly collects console messages and page errors and asserts there are no uncaught runtime errors.
    // It also surfaces any unusual console warnings for manual inspection via test output if needed.
    const app = new AppPage(page);
    await app.goto();

    // Interact with the app to exercise code paths
    await app.clickGenerate();
    await app.waitForOutputContains('Key pair generated successfully!');
    await app.clickSign();
    await app.waitForOutputContains('Signature created successfully!');
    await app.clickVerify();
    await app.waitForOutputContains('Signature is VALID!');

    // At this point, assert that pageErrors is empty (collected in beforeEach/afterEach)
    // The afterEach assertion will also validate this, but we include an explicit check here for clarity.
    expect(pageErrors.length).toBe(0);

    // Optionally validate that console didn't have severe messages (like 'error' type); we only assert no page errors.
    const severeConsole = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    // We won't fail on console warnings, but we include an expectation that there are zero 'error' type messages.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});