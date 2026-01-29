import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d3158b1-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object for the HTTPS Interactive Explorer
class ExplorerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // selectors
    this.urlInput = page.locator('#urlInput');
    this.connectBtn = page.locator('#connectBtn');
    this.connectionStatus = page.locator('#connectionStatus');
    this.connectionDetails = page.locator('#connectionDetails');
    this.protocol = page.locator('#protocol');
    this.encryption = page.locator('#encryption');
    this.keyExchange = page.locator('#keyExchange');
    this.dataIntegrity = page.locator('#dataIntegrity');

    this.startHandshakeBtn = page.locator('#startHandshakeBtn');
    this.resetHandshakeBtn = page.locator('#resetHandshakeBtn');
    this.handshakeSteps = page.locator('#handshakeSteps');
    this.handshakeStepStatus = (index) => page.locator(`#handshakeSteps li:nth-child(${index}) .status`);

    this.attackType = page.locator('#attackType');
    this.simulateAttackBtn = page.locator('#simulateAttackBtn');
    this.attackResult = page.locator('#attackResult');
    this.attackMessage = page.locator('#attackMessage');

    this.viewCertBtn = page.locator('#viewCertBtn');
    this.generateCertBtn = page.locator('#generateCertBtn');
    this.certificateDetails = page.locator('#certificateDetails');
    this.certIssuer = page.locator('#certIssuer');
    this.certValidFrom = page.locator('#certValidFrom');
    this.certValidTo = page.locator('#certValidTo');
    this.certPublicKey = page.locator('#certPublicKey');
    this.certSignature = page.locator('#certSignature');

    this.messageInput = page.locator('#messageInput');
    this.encryptBtn = page.locator('#encryptBtn');
    this.decryptBtn = page.locator('#decryptBtn');
    this.encryptionType = page.locator('#encryptionType');
    this.encryptionResults = page.locator('#encryptionResults');
    this.originalMessage = page.locator('#originalMessage');
    this.encryptedMessage = page.locator('#encryptedMessage');
    this.decryptedMessage = page.locator('#decryptedMessage');

    this.httpsTab = page.locator('.tab[data-tab="https"]');
    this.httpTab = page.locator('.tab[data-tab="http"]');
    this.httpsContent = page.locator('#httpsTab');
    this.httpContent = page.locator('#httpTab');

    this.secureRequestBtn = page.locator('#secureRequestBtn');
    this.secureRequestResult = page.locator('#secureRequestResult');
    this.insecureRequestBtn = page.locator('#insecureRequestBtn');
    this.insecureRequestResult = page.locator('#insecureRequestResult');
    this.interceptedData = page.locator('#interceptedData');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async connect(url) {
    await this.urlInput.fill(url);
    await this.connectBtn.click();
  }

  async startHandshake() {
    await this.startHandshakeBtn.click();
  }

  async resetHandshake() {
    await this.resetHandshakeBtn.click();
  }

  async simulateAttack(type) {
    await this.attackType.selectOption(type);
    await this.simulateAttackBtn.click();
  }

  async viewCertificate() {
    await this.viewCertBtn.click();
  }

  async generateCertificate() {
    await this.generateCertBtn.click();
  }

  async encrypt(message, type = 'aes') {
    await this.messageInput.fill(message);
    await this.encryptionType.selectOption(type);
    await this.encryptBtn.click();
  }

  async decrypt() {
    await this.decryptBtn.click();
  }

  async clickTab(tab) {
    if (tab === 'http') {
      await this.httpTab.click();
    } else {
      await this.httpsTab.click();
    }
  }

  async makeSecureRequest() {
    await this.secureRequestBtn.click();
  }

  async makeInsecureRequest() {
    await this.insecureRequestBtn.click();
  }
}

test.describe('HTTPS Interactive Explorer - End-to-end (FSM validation)', () => {
  // Collect console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of type 'error'
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught exceptions
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.describe('Console and runtime error observation', () => {
    test('should load the page without uncaught exceptions or console.error messages', async ({ page }) => {
      // This test validates that the page loads and there are no runtime exceptions logged.
      const explorer = new ExplorerPage(page);
      await explorer.goto();

      // Basic sanity check: header is present
      await expect(page.locator('h1', { hasText: 'HTTPS Interactive Explorer' })).toBeVisible();

      // Wait a tick to allow any immediate page scripts to run
      await page.waitForTimeout(100);

      // Assert there were no console.error messages and no page errors
      expect(consoleErrors.length, `console.error messages: ${JSON.stringify(consoleErrors, null, 2)}`).toBe(0);
      expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors, null, 2)}`).toBe(0);
    });
  });

  test.describe('Connection Simulator', () => {
    test('Connect to an HTTPS URL should set Connected securely via HTTPS and show details', async ({ page }) => {
      // Validate transition S0_Idle -> S1_Connected
      const explorer = new ExplorerPage(page);
      await explorer.goto();

      // Connect with default https URL
      await explorer.connect('https://example.com');

      await expect(explorer.connectionStatus).toHaveText('Connected securely via HTTPS');
      // style color green is set in script
      const color = await explorer.connectionStatus.evaluate((el) => getComputedStyle(el).color);
      expect(color).toBeTruthy(); // we won't assert exact rgb, just that it's present

      // Connection details should be visible and populated
      await expect(explorer.connectionDetails).toBeVisible();
      await expect(explorer.protocol).toHaveText('TLS 1.3');
      await expect(explorer.encryption).toHaveText('AES-256-GCM');
      await expect(explorer.keyExchange).toHaveText('ECDHE');
      await expect(explorer.dataIntegrity).toHaveText('SHA-256');

      // No console or page errors from this interaction
      await page.waitForTimeout(50);
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Connect to an HTTP URL should set Insecure connection (HTTP) and hide details', async ({ page }) => {
      // Validate transition S0_Idle -> S2_Insecure
      const explorer = new ExplorerPage(page);
      await explorer.goto();

      await explorer.connect('http://insecure.local');

      await expect(explorer.connectionStatus).toHaveText('Insecure connection (HTTP)');

      // connectionDetails should be hidden
      await expect(explorer.connectionDetails).toHaveClass(/hidden/);

      // startHandshakeBtn should be disabled for insecure
      await expect(explorer.startHandshakeBtn).toBeDisabled();

      // No console or page errors from this interaction
      await page.waitForTimeout(50);
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Edge case: connect with empty URL treats as insecure and does not throw', async ({ page }) => {
      // Edge case: empty URL should go to insecure path (else branch)
      const explorer = new ExplorerPage(page);
      await explorer.goto();

      await explorer.connect('');

      await expect(explorer.connectionStatus).toHaveText('Insecure connection (HTTP)');
      await expect(explorer.startHandshakeBtn).toBeDisabled();

      // No exceptions should have been thrown
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Handshake Simulator', () => {
    test('Starting handshake shows steps and completes all steps (with timeouts)', async ({ page }) => {
      // Validate transitions S1_Connected -> S3_HandshakeInProgress -> S4_HandshakeCompleted
      const explorer = new ExplorerPage(page);
      await explorer.goto();

      // Ensure connected first so the handshake button remains enabled (connect https)
      await explorer.connect('https://example.com');

      // startHandshakeBtn should be enabled now
      await expect(explorer.startHandshakeBtn).toBeEnabled();

      // Click to start handshake
      await explorer.startHandshake();

      // handshakeSteps should become visible (S3_HandshakeInProgress evidence)
      await expect(explorer.handshakeSteps).toBeVisible();

      // The first step should be immediately completed per script
      await expect(explorer.handshakeStepStatus(1)).toHaveText('(Completed)');

      // Wait for the final step to complete. The script sequences with 800ms delays.
      // Allow generous timeout to avoid flakiness
      await page.waitForFunction(() => {
        const s = document.querySelector('#step5 .status');
        return s && s.textContent === '(Completed)';
      }, null, { timeout: 7000 });

      await expect(explorer.handshakeStepStatus(5)).toHaveText('(Completed)');

      // Reset handshake should bring all statuses back to (Pending) and re-enable start
      await explorer.resetHandshake();

      // All status spans should be (Pending)
      for (let i = 1; i <= 5; i++) {
        await expect(explorer.handshakeStepStatus(i)).toHaveText('(Pending)');
      }
      await expect(explorer.startHandshakeBtn).toBeEnabled();
      await expect(explorer.resetHandshakeBtn).toBeDisabled();

      // No runtime errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('ResetHandshake while handshake idle still keeps statuses as Pending (idempotent)', async ({ page }) => {
      // Validate S3_HandshakeInProgress reset transition behavior even if no steps were started
      const explorer = new ExplorerPage(page);
      await explorer.goto();

      // The reset button is initially disabled by markup; enable via startHandshake sequence is needed normally.
      // We will click reset only after enabling it by starting and then resetting.
      await explorer.connect('https://example.com');
      await explorer.startHandshake();
      // Wait a tick then reset
      await page.waitForTimeout(100);
      await explorer.resetHandshake();

      // After reset statuses must be (Pending)
      for (let i = 1; i <= 5; i++) {
        await expect(explorer.handshakeStepStatus(i)).toHaveText('(Pending)');
      }

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Simulate different attacks show correct messages', async ({ page }) => {
      // Validate attack simulation messages for each type
      const explorer = new ExplorerPage(page);
      await explorer.goto();

      await explorer.connect('https://example.com');
      await explorer.startHandshake();

      // MITM
      await explorer.simulateAttack('mitm');
      await expect(explorer.attackResult).toBeVisible();
      await expect(explorer.attackMessage).toContainText('MITM attack detected');

      // Expired
      await explorer.simulateAttack('expired');
      await expect(explorer.attackResult).toBeVisible();
      await expect(explorer.attackMessage).toContainText('Certificate expired');

      // Self-signed
      await explorer.simulateAttack('selfsigned');
      await expect(explorer.attackResult).toBeVisible();
      await expect(explorer.attackMessage).toContainText('Self-signed certificate detected');

      // None
      await explorer.simulateAttack('none');
      await expect(explorer.attackResult).toBeVisible();
      await expect(explorer.attackMessage).toContainText('No attack detected');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Certificate Inspector', () => {
    test('View certificate reveals certificate details with known sample fields', async ({ page }) => {
      // Validate S1_Connected -> S5_CertificateVisible
      const explorer = new ExplorerPage(page);
      await explorer.goto();

      await explorer.connect('https://example.com');

      await explorer.viewCertificate();

      await expect(explorer.certificateDetails).toBeVisible();
      await expect(explorer.certIssuer).toHaveText(/Let's Encrypt Authority X3/);
      await expect(explorer.certValidFrom).toHaveText('2023-01-01');
      await expect(explorer.certValidTo).toHaveText('2023-04-01');
      await expect(explorer.certPublicKey).toHaveText('RSA 2048 bits');
      await expect(explorer.certSignature).toHaveText('SHA-256 with RSA');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Generate certificate shows certificate details with generated dates and different issuer', async ({ page }) => {
      // Validate generating new certificate keeps certificate visible and updates fields
      const explorer = new ExplorerPage(page);
      await explorer.goto();

      await explorer.connect('https://example.com');

      // Generate new certificate
      await explorer.generateCertificate();

      await expect(explorer.certificateDetails).toBeVisible();
      await expect(explorer.certIssuer).toHaveText('Custom CA');

      // Generated dates should be ISO-like YYYY-MM-DD and not equal to '-'
      const from = await explorer.certValidFrom.textContent();
      const to = await explorer.certValidTo.textContent();

      expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      expect(await explorer.certPublicKey.textContent()).toBe('ECDSA 256 bits');
      expect(await explorer.certSignature.textContent()).toBe('SHA-384 with ECDSA');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Encryption Playground', () => {
    test('Encrypt with AES and decrypt returns original message (S6_EncryptionResultsVisible flows)', async ({ page }) => {
      // Validate S1_Connected -> S6_EncryptionResultsVisible and decrypt behavior
      const explorer = new ExplorerPage(page);
      await explorer.goto();

      await explorer.connect('https://example.com');

      const message = 'Hello, secure world!';
      await explorer.encrypt(message, 'aes');

      // Encryption results visible
      await expect(explorer.encryptionResults).toBeVisible();
      await expect(explorer.originalMessage).toHaveText(message);

      const encrypted = await explorer.encryptedMessage.textContent();
      expect(encrypted).toMatch(/^AES:/);

      // decrypt button should be enabled
      await expect(explorer.decryptBtn).toBeEnabled();

      await explorer.decrypt();

      // Decrypted message should match original
      await expect(explorer.decryptedMessage).toHaveText(message);

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Encrypt with RSA and decrypt returns original message', async ({ page }) => {
      const explorer = new ExplorerPage(page);
      await explorer.goto();

      await explorer.connect('https://example.com');

      const message = 'RSA test message';
      await explorer.encrypt(message, 'rsa');

      await expect(explorer.encryptionResults).toBeVisible();
      await expect(explorer.originalMessage).toHaveText(message);

      const encrypted = await explorer.encryptedMessage.textContent();
      expect(encrypted).toMatch(/^RSA:/);

      await explorer.decrypt();

      await expect(explorer.decryptedMessage).toHaveText(message);

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Decrypt is disabled until after encryption - edge case', async ({ page }) => {
      const explorer = new ExplorerPage(page);
      await explorer.goto();

      // Initially decrypt button is disabled
      await expect(explorer.decryptBtn).toBeDisabled();

      // Clicking a disabled button would throw in Playwright; ensure it's still disabled
      expect(await explorer.decryptBtn.isEnabled()).toBe(false);

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Tabs and Request Simulations', () => {
    test('Switch to HTTP tab and make insecure request shows intercepted data', async ({ page }) => {
      // Validate S2_Insecure -> S8_InsecureRequestMade after switching tab and clicking insecure request
      const explorer = new ExplorerPage(page);
      await explorer.goto();

      // Switch to HTTP tab
      await explorer.clickTab('http');

      // HTTP content should be visible and HTTPS content hidden
      await expect(explorer.httpContent).toBeVisible();
      await expect(explorer.httpsContent).toHaveClass(/hidden/);

      // Make insecure request
      await explorer.makeInsecureRequest();

      await expect(explorer.insecureRequestResult).toBeVisible();
      await expect(explorer.interceptedData).toContainText('Intercepted: username=user123');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Make secure request in HTTPS tab shows secure request result', async ({ page }) => {
      // Validate S1_Connected -> S7_SecureRequestMade
      const explorer = new ExplorerPage(page);
      await explorer.goto();

      // Ensure on HTTPS tab
      await explorer.clickTab('https');

      // Make secure request
      await explorer.makeSecureRequest();

      await expect(explorer.secureRequestResult).toBeVisible();
      await expect(explorer.secureRequestResult).toContainText('Request completed securely');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Tab switching preserves active-tab class semantics and content visibility', async ({ page }) => {
      const explorer = new ExplorerPage(page);
      await explorer.goto();

      // Initially HTTPS tab should be active
      await expect(explorer.httpsTab).toHaveClass(/active-tab/);

      // Click HTTP tab
      await explorer.clickTab('http');
      await expect(explorer.httpTab).toHaveClass(/active-tab/);
      await expect(explorer.httpsTab).not.toHaveClass(/active-tab/);
      await expect(explorer.httpContent).toBeVisible();
      await expect(explorer.httpsContent).toHaveClass(/hidden/);

      // Click back to HTTPS tab
      await explorer.clickTab('https');
      await expect(explorer.httpsTab).toHaveClass(/active-tab/);
      await expect(explorer.httpTab).not.toHaveClass(/active-tab/);
      await expect(explorer.httpsContent).toBeVisible();
      await expect(explorer.httpContent).toHaveClass(/hidden/);

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Negative and edge scenarios for robustness', () => {
    test('Attempting to start handshake when startHandshakeBtn is disabled does not throw', async ({ page }) => {
      const explorer = new ExplorerPage(page);
      await explorer.goto();

      // Connect insecure to ensure startHandshakeBtn disabled
      await explorer.connect('http://insecure.local');

      await expect(explorer.startHandshakeBtn).toBeDisabled();

      // Attempt to click via JS invocation to ensure no runtime errors if script receives unexpected click:
      // We will not force a Playwright click (it would throw) — instead we ensure the button is disabled and that attempting to click via DOM click causes no uncaught exceptions.
      await page.evaluate(() => {
        // This simulates an attempt to invoke the click handler even if the button is disabled.
        const btn = document.getElementById('startHandshakeBtn');
        try {
          btn.click();
        } catch (e) {
          // swallow here - test will inspect pageErrors/consoleErrors
        }
      });

      // No page errors should have been emitted
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Trying to decrypt malformed encrypted text handled gracefully', async ({ page }) => {
      const explorer = new ExplorerPage(page);
      await explorer.goto();

      // Force-insert a malformed encrypted value into the DOM and click decrypt (enable the button first)
      await page.evaluate(() => {
        document.getElementById('encryptedMessage').textContent = 'BOGUS:!!!@@@';
        document.getElementById('decryptBtn').disabled = false;
      });

      // Click decrypt - the page script will attempt to process; if it throws, pageerror will capture it
      await explorer.decrypt();

      // After operation, decryptedMessage may contain something or may throw; ensure no uncaught exceptions
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);

      // The decryptedMessage might be empty or throw; ensure the element exists
      await expect(explorer.decryptedMessage).toBeVisible();
    });
  });
});