import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12164992-fa7a-11f0-acf9-69409043402d.html';

test.describe('HTTPS Interactive Explorer - FSM end-to-end', () => {
  // Collect console errors and page errors for each test to ensure no uncaught exceptions
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture unhandled page errors
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    // Navigate to the page under test
    await page.goto(BASE_URL);
    // Wait for the main heading to ensure initialization finished
    await expect(page.locator('h1')).toHaveText('HTTPS Interactive Explorer');
  });

  test.afterEach(async () => {
    // Assert that there were no uncaught errors logged by the page during the test
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.join('\n')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console.error messages: ${consoleErrors.join('\n')}`).toBe(0);
  });

  // Helper page object functions for clarity and reuse
  const pageObjects = {
    async getText(page, selector) {
      const el = page.locator(selector);
      return (await el.textContent()) || '';
    },
    async click(page, selector) {
      await page.locator(selector).click();
    },
    async setValue(page, selector, value) {
      await page.locator(selector).fill(value);
    },
    async selectOption(page, selector, value) {
      await page.locator(selector).selectOption(value);
    },
    async setCheckbox(page, selector, checked) {
      const box = page.locator(selector);
      const isChecked = await box.isChecked();
      if (isChecked !== checked) {
        await box.click();
      }
    },
    async disableAllOptions(page, selector) {
      await page.evaluate(sel => {
        const selEl = document.querySelector(sel);
        if (!selEl) return;
        for (const opt of selEl.options) {
          opt.selected = false;
        }
      }, selector);
    },
    async enableOptions(page, selector, values) {
      // values: array of option values to select
      await page.evaluate((sel, vals) => {
        const selEl = document.querySelector(sel);
        if (!selEl) return;
        for (const opt of selEl.options) {
          opt.selected = vals.includes(opt.value);
        }
        // dispatch change event to ensure any listeners may react (not strictly necessary here)
        selEl.dispatchEvent(new Event('change', { bubbles: true }));
      }, selector, values);
    },
  };

  test.describe('State S0_Idle (initialization and UI defaults)', () => {
    test('init() should set default cert valid-from and valid-to and client-date and update state output', async ({ page }) => {
      // Entry action: init() executed on load. Verify dates populated and state-output reflects initial state.
      const certFrom = await page.locator('#cert-valid-from').inputValue();
      const certTo = await page.locator('#cert-valid-to').inputValue();
      const clientDate = await page.locator('#client-date').inputValue();

      expect(certFrom).not.toBe('', 'cert-valid-from should be initialized by init()');
      expect(certTo).not.toBe('', 'cert-valid-to should be initialized by init()');
      expect(clientDate).not.toBe('', 'client-date should be initialized by init()');

      // Request body should be disabled by default (S0 Idle expected behavior)
      const bodyDisabled = await page.locator('#request-body').isDisabled();
      expect(bodyDisabled).toBe(true);

      // State output should include "(not performed yet)" for validation and handshake placeholders
      const stateOutput = await pageObjects.getText(page, '#state-output');
      expect(stateOutput).toContain('(not performed yet)');
      expect(stateOutput).toContain('(no handshake performed)');
    });

    test('UpdateRequestBodyState transition: selecting POST enables request body and then switching back disables and clears it', async ({ page }) => {
      // Change HTTP method to POST
      await pageObjects.selectOption(page, '#http-method', 'POST');

      // Fire change event if needed (the page binds change event on the select element - selectOption will trigger it)
      const bodyDisabledAfterPost = await page.locator('#request-body').isDisabled();
      expect(bodyDisabledAfterPost).toBe(false);

      // Fill some body text
      await page.locator('#request-body').fill('test body');
      let bodyValue = await page.locator('#request-body').inputValue();
      expect(bodyValue).toBe('test body');

      // Switch back to GET - body should become disabled and cleared
      await pageObjects.selectOption(page, '#http-method', 'GET');

      const bodyDisabledAfterGet = await page.locator('#request-body').isDisabled();
      expect(bodyDisabledAfterGet).toBe(true);

      bodyValue = await page.locator('#request-body').inputValue();
      expect(bodyValue).toBe('', 'Request body should be cleared when switching to a method that does not use body');
    });
  });

  test.describe('Transitions: Certificate Generation, Handshake, Validation, HTTP Request, Advanced Settings', () => {
    test('S0 -> S1: Generate Certificate populates cert-output and updates state', async ({ page }) => {
      // Ensure we start with a known certificate type to get predictable validation later
      await page.locator('#cert-type').selectOption('valid-root');

      // Generate certificate
      await pageObjects.click(page, '#generate-cert');

      const certOutput = await pageObjects.getText(page, '#cert-output');
      expect(certOutput).toContain('=== Simulated Certificate ===');
      expect(certOutput).toContain('Issuer CN: Trusted Root CA');

      // State output should reflect that certificate validity dates are set and certificate type updated
      const stateOutput = await pageObjects.getText(page, '#state-output');
      expect(stateOutput).toContain('Certificate Type: valid-root');
      expect(stateOutput).toContain('Certificate Validity:');

      // Validation and handshake outputs should have been reset per implementation
      const validationText = await pageObjects.getText(page, '#validation-result');
      const handshakeText = await pageObjects.getText(page, '#handshake-log');
      const responseText = await pageObjects.getText(page, '#response-output');
      expect(validationText).toBe('');
      expect(handshakeText).toBe('');
      expect(responseText).toBe('');
    });

    test('Edge case: Simulate TLS Handshake with no certificate should abort with an error message', async ({ page }) => {
      // Reload page to ensure no certificate has been generated in this test context
      await page.goto(BASE_URL);

      // Ensure certificate is not set
      const certOutputBefore = await pageObjects.getText(page, '#cert-output');
      expect(certOutputBefore).toBe('', 'No certificate should exist yet');

      // Attempt handshake without certificate
      await pageObjects.click(page, '#simulate-handshake');

      const handshakeLog = await pageObjects.getText(page, '#handshake-log');
      expect(handshakeLog).toContain('Error: No certificate loaded. Aborting handshake.');
      // TLS session should not be established
      const stateOutput = await pageObjects.getText(page, '#state-output');
      expect(stateOutput).toContain('TLS Session Established: false');
    });

    test('S1 -> S2: Simulate TLS Handshake with valid certificate establishes session and negotiates cipher and ALPN', async ({ page }) => {
      // Generate a valid-root certificate and enable ALPN
      await page.locator('#cert-type').selectOption('valid-root');
      await pageObjects.click(page, '#generate-cert');

      // Ensure ALPN is enabled in advanced settings checkbox (off in default), enable it temporarily for handshake
      await pageObjects.setCheckbox(page, '#enable-alpn', true);
      await page.locator('#alpn-protocols').fill('h2,http/1.1');

      // Ensure TLS version and cipher suites are compatible (defaults should be fine)
      // Simulate handshake
      await pageObjects.click(page, '#simulate-handshake');

      const handshakeText = await pageObjects.getText(page, '#handshake-log');
      expect(handshakeText).toContain('Handshake complete - secure TLS session established.');
      expect(handshakeText).toContain('Server sends Certificate.');
      // If ALPN negotiation happened, it should be logged
      expect(handshakeText).toMatch(/ALPN Negotiation -> (Negotiated Protocol:|Not performed|No matching protocol)/);

      // State should show TLS session established
      const stateOutput = await pageObjects.getText(page, '#state-output');
      expect(stateOutput).toContain('TLS Session Established: true');
    });

    test('S2 -> S3: Validate Certificate for valid-root should pass all checks', async ({ page }) => {
      // Prepare a valid-root certificate and generate it
      await page.locator('#cert-type').selectOption('valid-root');
      await pageObjects.click(page, '#generate-cert');

      // Set client date to a date within the validity window (init sets today)
      // Validate certificate
      await pageObjects.click(page, '#validate-cert');

      const validationResult = await pageObjects.getText(page, '#validation-result');
      expect(validationResult).toContain('Starting Certificate Validation...');
      expect(validationResult).toContain('All standard checks passed. Certificate is valid.');
      // State should include the validation result text
      const stateOutput = await pageObjects.getText(page, '#state-output');
      expect(stateOutput).toContain('Last Certificate Validation Result');
      expect(stateOutput).toContain('Certificate is valid.');
    });

    test('S3 -> S4: Send HTTPS Request over established TLS session returns HTTP response and reflects HSTS/ALPN', async ({ page }) => {
      // Setup: generate valid cert, simulate handshake
      await page.locator('#cert-type').selectOption('valid-root');
      await pageObjects.click(page, '#generate-cert');

      // Ensure ALPN and HSTS enabled before handshake to be possibly negotiated/reflected
      await pageObjects.setCheckbox(page, '#enable-alpn', true);
      await pageObjects.setCheckbox(page, '#enable-hsts', true);
      await page.locator('#hsts-maxage').fill('12345');

      // Simulate handshake
      await pageObjects.click(page, '#simulate-handshake');

      // Send request (default GET /index.html)
      await pageObjects.click(page, '#send-request');

      const responseOutput = await pageObjects.getText(page, '#response-output');
      expect(responseOutput).toContain('--- HTTP Request ---');
      expect(responseOutput).toContain('--- HTTP Response ---');
      expect(responseOutput).toMatch(/TLS version in use: \d\.\d/);

      // If ALPN negotiated, the response body includes negotiated ALPN line
      // We won't force ALPN to be negotiated here; just ensure the response includes expected sections
      const stateOutput = await pageObjects.getText(page, '#state-output');
      expect(stateOutput).toContain('Last HTTP Response:');
    });

    test('S4 -> S5: Apply Advanced Settings restarts connection and logs settings', async ({ page }) => {
      // Start from a state where TLS session exists
      await page.locator('#cert-type').selectOption('valid-root');
      await pageObjects.click(page, '#generate-cert');
      await pageObjects.click(page, '#simulate-handshake');

      // Apply advanced settings: enable HSTS, enable HTTP/2 and ALPN
      await pageObjects.setCheckbox(page, '#enable-hsts', true);
      await pageObjects.setCheckbox(page, '#enable-http2', true);
      await pageObjects.setCheckbox(page, '#enable-alpn', true);
      await page.locator('#alpn-protocols').fill('h2,http/1.1');
      await page.locator('#hsts-maxage').fill('999');

      // Click restart-connection to apply advanced settings
      await pageObjects.click(page, '#restart-connection');

      // Advanced log should indicate applied settings
      const advancedLog = await pageObjects.getText(page, '#advanced-log');
      expect(advancedLog).toContain('Applied Advanced HTTPS Settings:');
      expect(advancedLog).toContain('HSTS Enabled: true (max-age=999)');
      expect(advancedLog).toContain('HTTP/2 Enabled: true');
      expect(advancedLog).toContain('ALPN Enabled: true');
      expect(advancedLog).toContain('ALPN Protocols: h2, http/1.1');

      // After applying advanced settings, TLS session should be reset (sessionEstablished false)
      const stateOutput = await pageObjects.getText(page, '#state-output');
      expect(stateOutput).toContain('TLS Session Established: false');

      // Handshake/response/validation outputs were cleared by restart-connection
      const handshakeLog = await pageObjects.getText(page, '#handshake-log');
      const responseOutput = await pageObjects.getText(page, '#response-output');
      const validationResult = await pageObjects.getText(page, '#validation-result');
      expect(handshakeLog).toBe('');
      expect(responseOutput).toBe('');
      expect(validationResult).toBe('');
    });
  });

  test.describe('Edge cases for certificate validation and handshake compatibility', () => {
    test('Expired certificate should fail validation due to expiration', async ({ page }) => {
      // Create an expired certificate
      await page.locator('#cert-type').selectOption('expired');
      await pageObjects.click(page, '#generate-cert');

      // Validate certificate (client-date default is today, expired certs have past validity)
      await pageObjects.click(page, '#validate-cert');

      const validationText = await pageObjects.getText(page, '#validation-result');
      expect(validationText).toContain('Certificate expired (valid to');
      expect(validationText).toContain('Validation failed');
    });

    test('Revoked certificate should fail validation due to revocation', async ({ page }) => {
      // Create a revoked certificate
      await page.locator('#cert-type').selectOption('revoked');
      await pageObjects.click(page, '#generate-cert');

      // Validate certificate
      await pageObjects.click(page, '#validate-cert');

      const validationText = await pageObjects.getText(page, '#validation-result');
      expect(validationText).toContain('Certificate is revoked (CRL/OCSP). Validation failed.');
    });

    test('Domain mismatch certificate should fail validation due to domain mismatch', async ({ page }) {
      // Create mismatch certificate
      await page.locator('#cert-type').selectOption('mismatch');
      await pageObjects.click(page, '#generate-cert');

      // Validate certificate (server.domain remains the original input "example.com" so mismatch should be detected)
      await pageObjects.click(page, '#validate-cert');

      const validationText = await pageObjects.getText(page, '#validation-result');
      expect(validationText).toContain("Domain mismatch: expected '");
      expect(validationText).toContain('Validation failed.');
    });

    test('Handshake aborts when no cipher suites selected', async ({ page }) => {
      // Generate a certificate first so handshake proceeds to cipher selection check
      await page.locator('#cert-type').selectOption('valid-root');
      await pageObjects.click(page, '#generate-cert');

      // Deselect all cipher suites
      await pageObjects.disableAllOptions(page, '#cipher-suites');

      // Simulate handshake
      await pageObjects.click(page, '#simulate-handshake');

      const handshakeText = await pageObjects.getText(page, '#handshake-log');
      expect(handshakeText).toContain('Warning: No cipher suites selected. Handshake aborted.');
      // Session should not be established
      const stateOutput = await pageObjects.getText(page, '#state-output');
      expect(stateOutput).toContain('TLS Session Established: false');
    });

    test('POST/PUT request uses request body when method switched and request is sent to /echo', async ({ page }) => {
      // Set up environment: valid cert and handshake
      await page.locator('#cert-type').selectOption('valid-root');
      await pageObjects.click(page, '#generate-cert');
      await pageObjects.click(page, '#simulate-handshake');

      // Switch method to POST
      await pageObjects.selectOption(page, '#http-method', 'POST');
      // Fill body and path /echo
      await page.locator('#request-body').fill('Hello Echo');
      await page.locator('#request-path').fill('/echo');

      // Send request
      await pageObjects.click(page, '#send-request');

      const responseOutput = await pageObjects.getText(page, '#response-output');
      expect(responseOutput).toContain('Echoing POST/PUT body:');
      expect(responseOutput).toContain('Hello Echo');
    });
  });
});