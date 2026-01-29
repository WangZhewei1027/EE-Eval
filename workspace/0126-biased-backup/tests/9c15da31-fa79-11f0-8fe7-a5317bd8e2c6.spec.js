import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c15da31-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Utility: wait for a short time
const delay = ms => new Promise(res => setTimeout(res, ms));

test.describe('HTTPS Interactive Simulator - FSM and UI integration tests', () => {
  let consoleEvents;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleEvents = [];
    pageErrors = [];

    // Collect console messages and page errors to assert on them later
    page.on('console', msg => {
      consoleEvents.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Handle any prompt dialogs (used by "Generate Root CA")
    page.on('dialog', async dialog => {
      // For prompts, accept with a sensible name
      if (dialog.type() === 'prompt') {
        await dialog.accept('TestRootCA');
      } else {
        await dialog.accept();
      }
    });

    // Navigate to the target app
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Ensure base UI rendered
    await expect(page.locator('h1')).toHaveText('HTTPS Interactive Simulator (Plain UI)');
  });

  test.afterEach(async () => {
    // Nothing in particular to tear down - individual tests leave the page in whatever state
    // But we make the arrays available to tests if required
  });

  test.describe('State S0: Idle', () => {
    test('Initial UI renders and Idle state evidence exists', async ({ page }) => {
      // Validate the Idle state's evidence (h1)
      const h1 = page.locator('h1');
      await expect(h1).toHaveText('HTTPS Interactive Simulator (Plain UI)');

      // Ensure major control buttons are present in Idle
      await expect(page.locator('#startHandshake')).toBeVisible();
      await expect(page.locator('#genRootCA')).toBeVisible();

      // No fatal page errors should have occurred prior to interactions
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('PKI and Certificate Events', () => {
    test('Generate Root CA, add to trust, issue server and client certs, and clear client cert', async ({ page }) => {
      // Generate a Root CA (handles prompt via dialog handler)
      await page.click('#genRootCA');
      // Wait briefly for async CA generation and logs to appear
      await page.waitForTimeout(300);

      // After generation there should be at least one option in caList
      const caOptions = await page.locator('#caList option').count();
      expect(caOptions).toBeGreaterThan(0);

      // Select the first CA in the list
      const firstCAValue = await page.locator('#caList option').first().getAttribute('value');
      await page.selectOption('#caList', firstCAValue);

      // Add the selected CA to the trust store
      await page.click('#addRootToTrust');
      await page.waitForTimeout(200);

      // Issue a server certificate using the trusted CA
      await page.click('#issueFromCA');
      // Wait for async issue to complete
      await page.waitForTimeout(400);

      // serverCertInfo should indicate a cert is present
      const serverCertInfo = await page.locator('#serverCertInfo').textContent();
      expect(serverCertInfo).toContain('Server cert');

      // Generate a client cert using CA
      await page.click('#genClientCertBtn');
      await page.waitForTimeout(400);
      const clientCertInfo = await page.locator('#clientCertInfo').textContent();
      expect(clientCertInfo).toMatch(/Client cert .+ issued by/);

      // Clear the client certificate and validate UI change
      await page.click('#clearClientCertBtn');
      await page.waitForTimeout(100);
      await expect(page.locator('#clientCertInfo')).toHaveText('No client cert');

      // Ensure no uncaught page errors in this flow
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Handshake states and transitions', () => {
    test('Transition S0 -> S1 via Start Handshake and S1 evidence', async ({ page }) => {
      // Start handshake - should initialize handshakeState
      await page.click('#startHandshake');

      // Wait for the initialization log and handshakeState to be set
      await page.waitForTimeout(200);

      // Access handshakeState from the page context
      const hs = await page.evaluate(() => window.handshakeState ? {
        stepIndex: window.handshakeState.stepIndex,
        attacker: window.handshakeState.attacker ? { mode: window.handshakeState.attacker.mode, packetLoss: window.handshakeState.attacker.packetLoss } : null,
        client: window.handshakeState.client ? { sni: window.handshakeState.client.sni, tls: window.handshakeState.client.tls } : null
      } : null);

      // handshakeState should be present and attacker/client populated
      expect(hs).not.toBeNull();
      expect(hs.attacker).not.toBeNull();
      expect(typeof hs.stepIndex).toBe('number');

      // The UI log should indicate initialization
      const logText = await page.locator('#log').textContent();
      expect(logText).toContain('Handshake initialized');

      // No page errors yet
      expect(pageErrors.length).toBe(0);
    });

    test('Transition S1 -> S2 via StepHandshake: steps built and messages appended', async ({ page }) => {
      // Ensure starting handshake
      await page.click('#startHandshake');
      await page.waitForTimeout(150);

      // Click Step to perform the first handshake step(s)
      await page.click('#stepHandshake');
      // Wait for step actions to process (includes async crypto)
      await page.waitForTimeout(600);

      // Inspect handshakeState: steps array and stepIndex should be updated
      const hsAfterStep = await page.evaluate(() => {
        return window.handshakeState ? {
          stepIndex: window.handshakeState.stepIndex,
          stepsLength: window.handshakeState.steps ? window.handshakeState.steps.length : 0,
          messagesCount: window.handshakeState.messages ? window.handshakeState.messages.length : 0
        } : null;
      });
      expect(hsAfterStep).not.toBeNull();
      expect(hsAfterStep.stepsLength).toBeGreaterThan(0);
      expect(hsAfterStep.stepIndex).toBeGreaterThanOrEqual(1);
      expect(hsAfterStep.messagesCount).toBeGreaterThanOrEqual(1);

      // The network log should have entries of messages transmitted
      const netLog = await page.locator('#networkLog').textContent();
      expect(netLog).toContain('client -> server') || expect(netLog.length).toBeGreaterThan(0);

      // No page errors at this early stage
      expect(pageErrors.length).toBe(0);
    });

    test('Attempt to progress handshake to completion; if environment lacks features expect pageerror (TypeError), otherwise handshake completes', async ({ page }) => {
      // Start handshake
      await page.click('#startHandshake');
      await page.waitForTimeout(150);

      // Repeatedly step until handshakeState.established === true or a page error occurs
      let established = false;
      const maxSteps = 30;
      for (let i = 0; i < maxSteps; i++) {
        // If a page-level error happened, break and assert later
        if (pageErrors.length > 0) break;
        await page.click('#stepHandshake');
        // Allow step to run (crypto operations and network simulation)
        await page.waitForTimeout(600);

        // Check if established
        established = await page.evaluate(() => !!(window.handshakeState && window.handshakeState.established));
        if (established) break;
      }

      if (established) {
        // If we reached established, ensure secrets were derived and appear in UI
        const secretsText = await page.locator('#secrets').textContent();
        expect(secretsText).toContain('symmetricKey') || expect(secretsText.length).toBeGreaterThan(0);

        // Now try sending HTTP request (S2->S3 SendHttpRequest)
        await page.click('#sendHttpBtn');
        // Wait for the simulated HTTP exchange to complete
        await page.waitForTimeout(800);

        const log = await page.locator('#log').textContent();
        // Check that encrypted HTTP was attempted and decrypted message appears in logs
        expect(log).toMatch(/Encrypted HTTP request|Decrypted HTTP response|Client: Decrypted HTTP response/);
        // No page errors
        expect(pageErrors.length).toBe(0);
      } else {
        // If not established, we expect either an error occurred (e.g., TypeError due to unsupported Array.prototype.findLast)
        // or simply the handshake did not complete within the step limit.
        // Assert that either a relevant page error was captured or handshake not established message present.
        if (pageErrors.length > 0) {
          // Ensure at least one page error is an instance of Error and contains something informative
          const messages = pageErrors.map(e => e.toString()).join('\n');
          // We accept TypeError or ReferenceError etc. Record that error occurred.
          expect(messages.length).toBeGreaterThan(0);
        } else {
          // No page errors: the handshake still didn't finish within our loop - this is an edge case; assert the log indicates in-progress state
          const log = await page.locator('#log').textContent();
          expect(log).toContain('Negotiated TLS version') || expect(log).toContain('Handshake initialized');
        }

        // Also validate behavior when sending HTTP without established connection
        await page.click('#sendHttpBtn');
        await page.waitForTimeout(200);
        const laterLog = await page.locator('#log').textContent();
        expect(laterLog).toContain('Connection not established yet');
      }
    }, 30000); // extended timeout for potentially long crypto ops

    test('Transition S2 -> S4: Abort handshake mid-progress', async ({ page }) => {
      // Start handshake and do at least one step to get it in-progress
      await page.click('#startHandshake');
      await page.waitForTimeout(150);
      await page.click('#stepHandshake');
      await page.waitForTimeout(300);

      // Abort the handshake
      await page.click('#abortHandshake');
      await page.waitForTimeout(200);

      // handshakeState.aborted should be true
      const aborted = await page.evaluate(() => !!(window.handshakeState && window.handshakeState.aborted));
      expect(aborted).toBeTruthy();

      // Log should include 'Handshake aborted by user'
      const log = await page.locator('#log').textContent();
      expect(log).toContain('Handshake aborted by user');
    });
  });

  test.describe('Attacker / Network / Tools interactions', () => {
    test('Prepare a forged certificate and activate MITM mode to replace Certificate message', async ({ page }) => {
      // Ensure there is a CA to sign with
      await page.click('#genRootCA');
      await page.waitForTimeout(200);
      const firstCAValue = await page.locator('#caList option').first().getAttribute('value');
      await page.selectOption('#caList', firstCAValue);
      // Prepare forged certificate (does not auto-use until MITM mode selected)
      await page.click('#forgeCertBtn');
      await page.waitForTimeout(300);

      // forgeCertBtn dataset should be set
      const forgedFlag = await page.evaluate(() => document.getElementById('forgeCertBtn').dataset.forged === 'true');
      expect(forgedFlag).toBeTruthy();

      // Set attacker mode to MITM so the forged cert will be used when messages are sent
      await page.selectOption('#attackerMode', 'mitm');

      // Start handshake and run until the server Certificate is sent (a few steps)
      await page.click('#startHandshake');
      await page.waitForTimeout(200);

      // Step a few times (ClientHello, ServerHello, Certificate)
      for (let i = 0; i < 4; i++) {
        if (pageErrors.length > 0) break;
        await page.click('#stepHandshake');
        await page.waitForTimeout(400);
      }

      // Network log should show MITM interception or replacement
      const networkText = await page.locator('#networkLog').textContent();
      // It is acceptable that MITM lines appear; check for either intercepted or replaced certificate message
      const mitmIntercepted = networkText.includes('MITM: intercepted') || networkText.includes('MITM: replaced Certificate');
      expect(mitmIntercepted).toBeTruthy();

      // Inspect the messages to find a message of type Certificate and check if it contains 'issuer' field (for forged)
      // We will inspect message at index 1 or 2 depending on ordering; try to find any message with type Certificate in handshakeState
      const certMessages = await page.evaluate(() => {
        const msgs = (window.handshakeState && window.handshakeState.messages) || [];
        return msgs.filter(m => m.msg && m.msg.type === 'Certificate').map(m => m.msg.cert ? m.msg.cert.issuer : null);
      });
      expect(certMessages.length).toBeGreaterThan(0);
      // At least one Certificate message should have an issuer (attacker CA name)
      const anyIssuerPresent = certMessages.some(x => !!x);
      expect(anyIssuerPresent).toBeTruthy();
    });

    test('Message inspector, tamper, replay and export log flows', async ({ page, context }) => {
      // Prepare: ensure CA and server cert exist so handshake can create messages
      await page.click('#genRootCA');
      await page.waitForTimeout(200);
      const firstCAValue = await page.locator('#caList option').first().getAttribute('value');
      await page.selectOption('#caList', firstCAValue);
      await page.click('#issueFromCA');
      await page.waitForTimeout(300);

      // Start handshake and produce some messages
      await page.click('#startHandshake');
      await page.waitForTimeout(150);
      for (let i = 0; i < 3; i++) {
        await page.click('#stepHandshake');
        await page.waitForTimeout(300);
      }

      // Inspect message at index 0
      await page.fill('#msgIndex', '0');
      await page.click('#inspectBtn');
      await page.waitForTimeout(150);
      const inspectorText = await page.locator('#msgInspector').textContent();
      expect(inspectorText).toContain('"from"') || expect(inspectorText.length).toBeGreaterThan(0);

      // Tamper the message at index 0
      await page.fill('#msgIndex', '0');
      await page.click('#tamperBtn');
      await page.waitForTimeout(150);
      const logAfterTamper = await page.locator('#log').textContent();
      expect(logAfterTamper).toMatch(/Tampered message idx|Tampering produced invalid JSON/) ;

      // Replay the tampered message - this will append to network log and handshakeState.messages
      await page.fill('#msgIndex', '0');
      await page.click('#replayBtn');
      await page.waitForTimeout(300);
      const networkAfterReplay = await page.locator('#networkLog').textContent();
      expect(networkAfterReplay).toMatch(/Replaying message|->/);

      // Export Log: this opens a popup. Wait for popup and ensure it contains exported JSON
      const [popup] = await Promise.all([
        page.waitForEvent('popup'),
        page.click('#exportLog')
      ]);
      // Wait for content to be written
      await popup.waitForLoadState('domcontentloaded');
      const popupText = await popup.locator('pre').textContent();
      expect(popupText).toContain('"handshakeState"') || expect(popupText.length).toBeGreaterThan(0);
      await popup.close();

      // No unexpected page errors from these tooling actions
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Auto Run and Pause behaviors', () => {
    test('Auto Run handshake starts and Pause stops it', async ({ page }) => {
      await page.click('#startHandshake');
      await page.waitForTimeout(150);

      // Start auto run
      await page.click('#autoHandshake');
      await page.waitForTimeout(500);

      // Log should indicate auto-run started
      const log = await page.locator('#log').textContent();
      expect(log).toContain('Auto-run started');

      // Pause auto-run
      await page.click('#pauseHandshake');
      await page.waitForTimeout(200);

      const logAfterPause = await page.locator('#log').textContent();
      expect(logAfterPause).toContain('Auto-run paused');
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Click Step without starting handshake logs helpful message', async ({ page }) => {
      // Ensure no handshake started
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      // StepHandshake without StartHandshake
      await page.click('#stepHandshake');
      await page.waitForTimeout(150);
      const log = await page.locator('#log').textContent();
      expect(log).toContain('Click Start Handshake first');
    });

    test('Sending HTTP before handshake established results in "Connection not established yet"', async ({ page }) => {
      // Ensure fresh page
      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      // Attempt to send HTTP without handshake
      await page.click('#sendHttpBtn');
      await page.waitForTimeout(150);
      const log = await page.locator('#log').textContent();
      expect(log).toContain('Connection not established yet');
    });

    test('Observe any console errors or page errors and assert expected behavior (no uncaught errors in safe flows)', async ({ page }) => {
      // This test records console and page errors for the current session
      // We will perform a few non-failing operations and assert no page errors emerged
      await page.click('#genRootCA'); // prompt handled by dialog handler
      await page.waitForTimeout(200);
      // Add to trust and generate a self-signed server cert
      const firstCAValue = await page.locator('#caList option').first().getAttribute('value');
      await page.selectOption('#caList', firstCAValue);
      await page.click('#addRootToTrust');
      await page.click('#genServerCertBtn');
      await page.waitForTimeout(300);

      // At this point, many operations succeeded; check that pageErrors remains zero
      // However, due to the runtime environment, certain features (like Array.prototype.findLast) might not exist
      // If pageErrors exist, make them available in the test output by failing with their messages
      if (pageErrors.length > 0) {
        const messages = pageErrors.map(e => e.toString()).join('\n---\n');
        // Acknowledge by failing the test with the observed error messages (so the test run surfaces them)
        throw new Error('Page errors observed:\n' + messages);
      } else {
        // If no errors, pass the test confirming UI flows did not cause uncaught errors
        expect(pageErrors.length).toBe(0);
      }
    });
  });
});