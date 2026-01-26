import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3dc5262-fa73-11f0-83e0-8d7be1d51901.html';

// Page Object for the demo to keep tests readable and organized
class DemoPage {
  constructor(page) {
    this.page = page;
    // Buttons / elements
    this.generateBtn = page.locator('#generateBtn');
    this.exportPubBtn = page.locator('#exportPubBtn');
    this.exportPrivBtn = page.locator('#exportPrivBtn');
    this.publicPem = page.locator('#publicPem');
    this.privatePem = page.locator('#privatePem');
    this.copyPub = page.locator('#copyPub');
    this.importPub = page.locator('#importPub');

    this.messageArea = page.locator('#message');
    this.tamperBtn = page.locator('#tamperBtn');
    this.clearTamper = page.locator('#clearTamper');

    this.signBtn = page.locator('#signBtn');
    this.signAgain = page.locator('#signAgain');
    this.signatureArea = page.locator('#signature');
    this.copySig = page.locator('#copySig');

    this.verifyPublicPem = page.locator('#verifyPublicPem');
    this.verifySignature = page.locator('#verifySignature');
    this.verifyBtn = page.locator('#verifyBtn');
    this.verifyTampered = page.locator('#verifyTampered');
    this.resultPre = page.locator('#result');
  }

  // Utility waits
  async waitForReadyText() {
    await this.page.waitForFunction(() => {
      const el = document.getElementById('result');
      return el && el.textContent && el.textContent.includes('Ready. Generate a key pair to begin.');
    });
  }

  async waitForKeyPairGenerated() {
    await this.page.waitForFunction(() => {
      const el = document.getElementById('result');
      return el && el.textContent && el.textContent.includes('Key pair generated. Ready to sign.');
    });
  }

  async waitForSigned() {
    await this.page.waitForFunction(() => {
      const el = document.getElementById('result');
      return el && el.textContent && el.textContent.includes('Message signed. You can now verify the signature.');
    });
  }

  async waitForValidSignature() {
    await this.page.waitForFunction(() => {
      const el = document.getElementById('result');
      return el && el.innerHTML && el.innerHTML.includes('Valid signature');
    });
  }

  async waitForInvalidSignature() {
    await this.page.waitForFunction(() => {
      const el = document.getElementById('result');
      return el && el.innerHTML && el.innerHTML.includes('Invalid signature');
    });
  }
}

test.describe('Digital Signatures — Interactive Demo (d3dc5262...)', () => {
  // Collect console messages and page errors per test
  let pageErrors;
  let consoleErrors;
  let dialogs;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];
    dialogs = [];

    // Capture uncaught exceptions from the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages (especially console.error)
    page.on('console', (msg) => {
      // Record only error-level console events for focused assertions
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture dialogs so tests can assert alerts without blocking
    page.on('dialog', async (dialog) => {
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      try {
        // Dismiss to avoid blocking the test; we only assert the message.
        await dialog.dismiss();
      } catch {
        // ignore
      }
    });

    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Nothing to teardown beyond Playwright default - arrays will be checked in tests
  });

  test.describe('Initialization and static UI checks', () => {
    test('initial state: result text and disabled controls', async ({ page }) => {
      // Validate the initial "Idle" state S0_Idle
      const demo = new DemoPage(page);

      // Confirm initial ready message
      await demo.waitForReadyText();
      await expect(demo.resultPre).toHaveText('Ready. Generate a key pair to begin.');

      // Buttons that should be disabled before key generation
      await expect(demo.exportPubBtn).toBeDisabled();
      await expect(demo.exportPrivBtn).toBeDisabled();
      await expect(demo.copyPub).toBeDisabled();
      await expect(demo.signBtn).toBeDisabled();
      await expect(demo.signAgain).toBeDisabled();
      await expect(demo.copySig).toBeDisabled();

      // Ensure there were no fatal runtime errors of the common JS error types
      const hasFatalPageError = pageErrors.some(e => {
        return e.name === 'ReferenceError' || e.name === 'SyntaxError' || e.name === 'TypeError';
      });
      expect(hasFatalPageError).toBe(false);

      // No console.error messages at initial render
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Key generation flow', () => {
    test('Generate key pair transitions to Key Pair Generated (S1)', async ({ page }) => {
      const demo = new DemoPage(page);

      // Click Generate Key Pair and wait for generation to finish
      await demo.generateBtn.click();

      // generateBtn displays 'Generating…' and then returns - wait for the result text
      await demo.waitForKeyPairGenerated();
      await expect(demo.resultPre).toHaveText('Key pair generated. Ready to sign.');

      // Public and private PEM areas should be populated
      await expect(demo.publicPem).not.toHaveValue('');
      await expect(demo.publicPem).toContainText('-----BEGIN PUBLIC KEY-----');
      await expect(demo.privatePem).not.toHaveValue('');
      await expect(demo.privatePem).toContainText('-----BEGIN PRIVATE KEY-----');

      // Export and copy buttons become enabled
      await expect(demo.exportPubBtn).toBeEnabled();
      await expect(demo.exportPrivBtn).toBeEnabled();
      await expect(demo.copyPub).toBeEnabled();
      await expect(demo.signBtn).toBeEnabled();

      // ensure no uncaught Reference/Syntax/Type errors occurred during generation
      const fatal = pageErrors.some(e => ['ReferenceError','SyntaxError','TypeError'].includes(e.name));
      expect(fatal).toBe(false);
    });

    test('Double-click public PEM copies it into verification area and updates result', async ({ page }) => {
      const demo = new DemoPage(page);

      // Generate first
      await demo.generateBtn.click();
      await demo.waitForKeyPairGenerated();

      // Double click publicPem to trigger copying into verify area
      await demo.publicPem.dblclick();

      // verifyPublicPem should equal publicPem and result updated
      const publicVal = await demo.publicPem.inputValue();
      await expect(demo.verifyPublicPem).toHaveValue(publicVal);
      await expect(demo.resultPre).toHaveText('Public key copied into verification area (double-clicked).');
    });
  });

  test.describe('Signing flow', () => {
    test('Sign message after key generation -> Message Signed (S2)', async ({ page }) => {
      const demo = new DemoPage(page);

      // Generate key pair
      await demo.generateBtn.click();
      await demo.waitForKeyPairGenerated();

      // Click sign
      await demo.signBtn.click();
      await demo.waitForSigned();

      // signature area should be filled with base64 string
      const sigVal = await demo.signatureArea.inputValue();
      expect(sigVal.length).toBeGreaterThan(10); // base64 signature present

      // verifySignature input should be updated to same value
      await expect(demo.verifySignature).toHaveValue(sigVal);

      // signAgain and copySig become enabled
      await expect(demo.signAgain).toBeEnabled();
      await expect(demo.copySig).toBeEnabled();

      // Ensure no console.error or fatal page errors happened during sign
      expect(consoleErrors.length).toBe(0);
      const fatal = pageErrors.some(e => ['ReferenceError','SyntaxError','TypeError'].includes(e.name));
      expect(fatal).toBe(false);
    });

    test('Clicking Sign when no private key present triggers alert (edge case)', async ({ page }) => {
      const demo = new DemoPage(page);

      // At initial load signBtn is disabled; we directly invoke signMessage from page context
      // This does not patch or modify functions; it calls an existing page function.
      // Capture dialogs already done in beforeEach.
      await page.evaluate(() => {
        // attempt to call signMessage directly to exercise its "no private key" alert path
        // If signMessage is not defined for some reason, this will throw and be caught by pageerror.
        try {
          if (typeof signMessage === 'function') {
            signMessage();
          }
        } catch (e) {
          // Intentionally leave to pageerror handling
          throw e;
        }
      });

      // An alert dialog should have been triggered by signMessage() if private key absent
      // We allowed dialog.dismiss() in handler, so check captured dialogs
      const alertDialog = dialogs.find(d => d.type === 'alert' || d.type === 'beforeunload' || d.type === 'confirm');
      // We expect an alert informing "No private key available" (the page uses alert with this message)
      const found = dialogs.some(d => /No private key available/.test(d.message));
      expect(found).toBe(true);
    });
  });

  test.describe('Verification and tamper flows', () => {
    test('Verify valid signature -> Signature Verified (S3)', async ({ page }) => {
      const demo = new DemoPage(page);

      // Generate, sign, then verify
      await demo.generateBtn.click();
      await demo.waitForKeyPairGenerated();

      await demo.signBtn.click();
      await demo.waitForSigned();

      // Verify (uses generated public key and signature by default)
      await demo.verifyBtn.click();

      // Wait for result to show valid signature
      await demo.waitForValidSignature();
      const inner = await demo.resultPre.innerHTML();
      expect(inner).toContain('Valid signature');
      expect(inner).toContain('The signature matches the message');

      // ensure no fatal page errors
      const fatal = pageErrors.some(e => ['ReferenceError','SyntaxError','TypeError'].includes(e.name));
      expect(fatal).toBe(false);
    });

    test('Tamper message and verify tampered -> Signature Invalid (S4)', async ({ page }) => {
      const demo = new DemoPage(page);

      // Generate and sign first
      await demo.generateBtn.click();
      await demo.waitForKeyPairGenerated();
      await demo.signBtn.click();
      await demo.waitForSigned();

      // Use the dedicated Verify Tampered button which tampers and verifies
      await demo.verifyTampered.click();

      // Should result in Invalid signature
      await demo.waitForInvalidSignature();
      const inner = await demo.resultPre.innerHTML();
      expect(inner).toContain('Invalid signature');

      // Reset the message back using clearTamper button and validate it matches original string
      await demo.clearTamper.click();
      await expect(demo.messageArea).toHaveValue('The quick brown fox jumps over the lazy dog');
    });

    test('Clicking Verify with no signature shows an alert and user-visible text (edge case)', async ({ page }) => {
      const demo = new DemoPage(page);

      // Ensure fresh state: no keys, no signature
      // Click Verify - should alert about missing signature and set resultPre.textContent = 'No signature.'
      await demo.verifyBtn.click();

      // Confirm an alert was shown about "No signature available"
      const foundMsg = dialogs.some(d => /No signature available/.test(d.message));
      expect(foundMsg).toBe(true);

      // Confirm result text indicates no signature
      await expect(demo.resultPre).toHaveText('No signature.');
    });

    test('Verify tampered flow when no signature alerts appropriately', async ({ page }) => {
      const demo = new DemoPage(page);

      // In initial state, verifyTampered should try to tamper and then see no signature and alert
      await demo.verifyTampered.click();

      // Confirm alert about "No signature available"
      const foundMsg = dialogs.some(d => /No signature available/.test(d.message));
      expect(foundMsg).toBe(true);

      // Confirm resultPre indicates 'No signature.'
      await expect(demo.resultPre).toHaveText('No signature.');
    });
  });

  test.describe('Import public key and verification using pasted PEM', () => {
    test('Importing a pasted PEM public key works for verification', async ({ page }) => {
      const demo = new DemoPage(page);

      // Generate and sign to have a signature to verify
      await demo.generateBtn.click();
      await demo.waitForKeyPairGenerated();
      await demo.signBtn.click();
      await demo.waitForSigned();

      // Copy the generated public PEM, clear verifyPublicPem, then paste via import flow:
      const pubPem = await demo.publicPem.inputValue();

      // Clear verifyPublicPem and paste (simulate user paste)
      await demo.verifyPublicPem.fill('');
      await demo.verifySignature.fill(''); // clear to make sure lastSignature will be used
      // Paste PEM into verification area
      await demo.verifyPublicPem.fill(pubPem);

      // Now verify using the pasted PEM
      await demo.verifyBtn.click();

      // Expect valid signature
      await demo.waitForValidSignature();
      await expect(demo.resultPre).toContainText('Valid signature');
    });
  });

  test.describe('Console and runtime error monitoring', () => {
    test('No uncaught ReferenceError/SyntaxError/TypeError occurred during full interaction', async ({ page }) => {
      const demo = new DemoPage(page);

      // Run through the main happy path quickly
      await demo.generateBtn.click();
      await demo.waitForKeyPairGenerated();
      await demo.signBtn.click();
      await demo.waitForSigned();
      await demo.verifyBtn.click();
      await demo.waitForValidSignature();

      // Also do a tamper verify
      await demo.verifyTampered.click();
      await demo.waitForInvalidSignature();

      // After exercising flows, ensure there are no uncaught page errors of the main JS error types
      const fatalErrors = pageErrors.filter(e => ['ReferenceError','SyntaxError','TypeError'].includes(e.name));
      if (fatalErrors.length > 0) {
        // Fail the test with details of the first fatal error for easier debugging
        const first = fatalErrors[0];
        throw new Error(`Found fatal page error: ${first.name}: ${first.message}\nStack: ${first.stack}`);
      }
      expect(fatalErrors.length).toBe(0);

      // Also ensure no console.error entries
      if (consoleErrors.length > 0) {
        // Provide context if there are console errors
        const messages = consoleErrors.map(e => e.text).slice(0, 5).join(' | ');
        throw new Error(`Unexpected console.error messages: ${messages}`);
      }
      expect(consoleErrors.length).toBe(0);
    });
  });
});