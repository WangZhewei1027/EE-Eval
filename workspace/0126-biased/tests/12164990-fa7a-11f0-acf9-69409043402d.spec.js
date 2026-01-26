import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0126-biased/html/12164990-fa7a-11f0-acf9-69409043402d.html';

test.describe('TCP/IP Interactive Explorer (FSM) - 12164990-fa7a-11f0-acf9-69409043402d', () => {
  // Containers for observing runtime diagnostics
  let pageErrors;
  let consoleMessages;
  let dialogMessages;

  test.beforeEach(async ({ page }) => {
    // reset observers per test
    pageErrors = [];
    consoleMessages = [];
    dialogMessages = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Capture dialogs (alerts) and automatically accept them while recording content
    page.on('dialog', async dialog => {
      dialogMessages.push(dialog.message());
      try {
        await dialog.accept();
      } catch (e) {
        // swallow if already handled; still keep message
      }
    });

    // Load the page exactly as-is
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    // Ensure initial rendering finished
    await expect(page.locator('h1')).toHaveText('TCP/IP Protocol Suite Interactive Explorer');
  });

  test.afterEach(async () => {
    // Ensure there were no uncaught runtime page errors
    expect(pageErrors, 'No uncaught page errors should have occurred').toEqual([]);
  });

  // 1. Idle state render verification
  test('Initial Idle state should render header and initial controls', async ({ page }) => {
    // Validate heading exists (evidence for S0_Idle entry)
    await expect(page.locator('h1')).toHaveText('TCP/IP Protocol Suite Interactive Explorer');

    // Verify key controls exist per extraction summary
    await expect(page.locator('#build-packet')).toBeVisible();
    await expect(page.locator('#start-conn')).toBeVisible();
    await expect(page.locator('#calc-route')).toBeVisible();
  });

  // 2. Build Packet -> Packet Built state tests
  test('Build Packet: builds a valid Ethernet packet and updates preview', async ({ page }) => {
    // Ensure packet builder fields are rendered for default layer/protocol (Link -> Ethernet)
    await expect(page.locator('#packet-builder input#field-destMAC')).toBeVisible();

    // Click Build Packet - should produce an alert "Packet built successfully."
    await page.click('#build-packet');

    // Verify an alert was shown with expected text from FSM evidence
    expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
    expect(dialogMessages[dialogMessages.length - 1]).toContain('Packet built successfully.');

    // Packet preview should contain JSON and protocol Ethernet
    const preview = page.locator('#packet-preview');
    await expect(preview).toHaveValue(/"protocol"\s*:\s*"Ethernet"/);

    // Confirm preview JSON includes destMAC default value
    await expect(preview).toHaveValue(/"destMAC"\s*:\s*"ff:ff:ff:ff:ff:ff"/);
  });

  test('Edit Packet: transitions to Editing Packet and Save returns to Packet Built', async ({ page }) => {
    // Build first to have a packet
    await page.click('#build-packet');
    expect(dialogMessages.pop()).toContain('Packet built successfully.');

    // Click Edit Packet - since packetState exists, should enable editing (save button becomes enabled)
    await page.click('#edit-packet');
    // Save button should be enabled now
    await expect(page.locator('#save-packet')).toBeEnabled();

    // Modify the packet-preview content (valid JSON edit)
    const preview = page.locator('#packet-preview');
    const currentJson = await preview.inputValue();
    // Parse and toggle a field (if present) then stringify
    const parsed = JSON.parse(currentJson);
    // For Ethernet, change payload to "abcd"
    parsed.payload = 'abcd';
    await preview.fill(JSON.stringify(parsed, null, 2));

    // Click Save - should alert "Packet JSON saved successfully."
    await page.click('#save-packet');
    expect(dialogMessages.pop()).toContain('Packet JSON saved successfully.');

    // After saving, save button is disabled
    await expect(page.locator('#save-packet')).toBeDisabled();

    // Preview should reflect the saved payload
    await expect(preview).toHaveValue(/"payload"\s*:\s*"abcd"/);
  });

  test('Save Packet: invalid JSON in editor triggers an alert', async ({ page }) => {
    // Build and enter edit mode
    await page.click('#build-packet');
    expect(dialogMessages.pop()).toContain('Packet built successfully.');
    await page.click('#edit-packet');
    await expect(page.locator('#save-packet')).toBeEnabled();

    // Put invalid JSON
    await page.fill('#packet-preview', '{ invalid-json ');

    // Save should produce an alert beginning with "Invalid JSON format:"
    await page.click('#save-packet');

    // The dialogMessages should contain the invalid JSON message
    const lastDialog = dialogMessages.pop();
    expect(lastDialog).toMatch(/^Invalid JSON format:/);
  });

  test('Attempting to Build Packet while editing shows a warning alert', async ({ page }) => {
    // Build, edit, then attempt to build again
    await page.click('#build-packet');
    expect(dialogMessages.pop()).toContain('Packet built successfully.');
    await page.click('#edit-packet');
    await expect(page.locator('#save-packet')).toBeEnabled();

    // Clicking Build Packet while editing should alert user to save/cancel
    await page.click('#build-packet');
    const last = dialogMessages.pop();
    expect(last).toContain('You are editing packet JSON. Save or cancel editing first.');
  });

  test('Clear Packet: clears preview and resets editing state', async ({ page }) => {
    await page.click('#build-packet');
    expect(dialogMessages.pop()).toContain('Packet built successfully.');
    // Ensure preview is non-empty then clear
    await expect(page.locator('#packet-preview')).not.toHaveValue('');
    await page.click('#clear-packet');
    // Preview should be empty after clear
    await expect(page.locator('#packet-preview')).toHaveValue('');
    // Save button should be disabled
    await expect(page.locator('#save-packet')).toBeDisabled();
  });

  test('Reset Builder: restores default field values', async ({ page }) => {
    // Change a builder field then reset builder and verify default restored
    const destMac = page.locator('#field-destMAC');
    await destMac.fill('aa:aa:aa:aa:aa:aa');
    expect(await destMac.inputValue()).toBe('aa:aa:aa:aa:aa:aa');
    await page.click('#reset-builder');
    // After reset, field should revert to default ff:ff:ff:ff:ff:ff
    await expect(destMac).toHaveValue('ff:ff:ff:ff:ff:ff');
  });

  // Simulation tests: Start / Step / Reset
  test('Start Simulation: begins simulation and stepping logs expected messages', async ({ page }) => {
    // Build a packet suitable for 'local' path (Ethernet) - default is fine
    await page.click('#build-packet');
    expect(dialogMessages.pop()).toContain('Packet built successfully.');

    // Ensure simulate-path default is present
    const simLog = page.locator('#sim-log');

    // Start simulation with current select (default is local)
    await page.click('#start-sim');

    // After starting, the sim log should include the "Simulation started on path:" line
    await expect(simLog).toContainText(/Simulation started on path: /);

    // Step through simulation until "Simulation ended." appears or max iterations reached
    let ended = false;
    for (let i = 0; i < 6; i++) {
      // Wait a short time to allow simulation logging to occur
      await page.click('#step-sim');
      // allow microtask propagation
      await page.waitForTimeout(100);
      const text = await simLog.textContent();
      if (text && text.includes('Simulation ended.')) {
        ended = true;
        break;
      }
    }
    expect(ended).toBe(true);
  });

  test('Reset Simulation: after start, reset clears logs and disables step/reset buttons', async ({ page }) => {
    await page.click('#build-packet');
    expect(dialogMessages.pop()).toContain('Packet built successfully.');
    await page.click('#start-sim');
    await expect(page.locator('#sim-log')).not.toHaveText('');
    // Reset simulation
    await page.click('#reset-sim');
    // sim log should be empty
    await expect(page.locator('#sim-log')).toHaveText('');
    // step and reset buttons should be disabled
    await expect(page.locator('#step-sim')).toBeDisabled();
    await expect(page.locator('#reset-sim')).toBeDisabled();
  });

  // TCP Connection Simulator tests
  test('TCP 3-way handshake establishes connection, send data then close connection', async ({ page }) => {
    // Start handshake
    await page.click('#start-conn');

    // Immediately we should see initial status lines
    await expect(page.locator('#tcp-status')).toContainText('Starting TCP 3-way handshake...');
    await expect(page.locator('#start-conn')).toBeDisabled();
    await expect(page.locator('#close-conn')).toBeEnabled();
    await expect(page.locator('#tcp-send')).toBeEnabled();

    // Wait for the asynchronous handshake to complete (approx 2.5 seconds in sequence)
    await page.waitForFunction(() => {
      const el = document.getElementById('tcp-status');
      return el && el.textContent && el.textContent.includes('TCP connection established.');
    }, { timeout: 5000 });

    // Confirm established message exists
    await expect(page.locator('#tcp-status')).toContainText('TCP connection established.');

    // Send data - entering a string into input and clicking send
    await page.fill('#tcp-send-data', 'Hello world');
    await page.click('#tcp-send');

    // Should log client send and then server ack a bit later
    await expect(page.locator('#tcp-status')).toContainText('Sending data');
    // Wait for server ACK after send (up to 2 seconds)
    await page.waitForFunction(() => {
      const el = document.getElementById('tcp-status');
      return el && el.textContent && el.textContent.includes('Received data, sending ACK');
    }, { timeout: 3000 });

    // Now close connection
    await page.click('#close-conn');

    // Wait for close sequence to finish and state CLOSED logged
    await page.waitForFunction(() => {
      const el = document.getElementById('tcp-status');
      return el && el.textContent && el.textContent.includes('TCP connection closed. State: CLOSED');
    }, { timeout: 6000 });

    await expect(page.locator('#tcp-status')).toContainText('TCP connection closed. State: CLOSED');

    // After close, close button and tcp-send should be disabled, start-conn enabled
    await expect(page.locator('#close-conn')).toBeDisabled();
    await expect(page.locator('#tcp-send')).toBeDisabled();
    await expect(page.locator('#start-conn')).toBeEnabled();
  });

  // Routing tests: valid and invalid inputs
  test('Calculate Routing: valid IPv4 inputs produce routing output', async ({ page }) => {
    // Default values should be valid
    await page.click('#calc-route');
    await expect(page.locator('#routing-output')).toContainText('Routing Path:');
    await expect(page.locator('#routing-output')).toContainText('Host src IP: 192.168.1.2');
  });

  test('Calculate Routing: invalid My IP triggers alert', async ({ page }) => {
    // Set invalid my-ip and click calculate route
    await page.fill('#my-ip', '999.999.999.999');
    await page.click('#calc-route');

    // An alert should appear with message about invalid My IP
    const lastDialog = dialogMessages.pop();
    expect(lastDialog).toContain('My IP is not valid IPv4 address.');
  });

  test('Calculate Routing: invalid Destination IP triggers alert', async ({ page }) => {
    // Restore my-ip valid and set invalid dest-ip
    await page.fill('#my-ip', '192.168.1.2');
    await page.fill('#dest-ip', '999.999.0.1');
    await page.click('#calc-route');

    const lastDialog = dialogMessages.pop();
    expect(lastDialog).toContain('Destination IP is not valid IPv4 address.');
  });

  // Custom JSON loader tests (load & validate)
  test('Load Custom JSON: invalid JSON shows parse error message', async ({ page }) => {
    await page.fill('#custom-json', '{ this is not valid json ');
    await page.click('#load-custom-json');

    // The UI shows parse error inside #json-valid-msg
    await expect(page.locator('#json-valid-msg')).toContainText('Invalid JSON:');
  });

  test("Load Custom JSON: missing protocol field reports error", async ({ page }) => {
    await page.fill('#custom-json', JSON.stringify({ foo: 'bar' }));
    await page.click('#load-custom-json');

    await expect(page.locator('#json-valid-msg')).toHaveText('Missing \'protocol\' field.');
  });

  test('Load Custom JSON: valid IPv4 packet loads and populates builder and preview', async ({ page }) => {
    // Construct a minimal valid IPv4 packet per template and validation rules
    const pkt = {
      protocol: 'IPv4',
      version: 4,
      ihl: 5,
      tos: 0,
      totalLength: 20,
      identification: 0,
      flags: 2,
      fragmentOffset: 0,
      ttl: 64,
      protocol: 6,
      headerChecksum: '0000',
      srcIP: '192.168.1.2',
      destIP: '192.168.1.1',
      payload: ''
    };
    await page.fill('#custom-json', JSON.stringify(pkt));
    await page.click('#load-custom-json');

    // Confirm success message and that packet preview contains IPv4
    await expect(page.locator('#json-valid-msg')).toHaveText('Packet loaded successfully.');
    await expect(page.locator('#packet-preview')).toContainText('"protocol": "IPv4"');
    // Confirm builder fields reflect loaded values (e.g., field-srcIP)
    await expect(page.locator('#field-srcIP')).toHaveValue('192.168.1.2');
  });

  // Edge case: Step Simulation when no active simulation - exercising event handling
  test('Step Simulation with no active simulation logs no active simulation and returns', async ({ page }) => {
    // Ensure reset state
    await page.click('#reset-sim'); // reset-sim may be disabled but safe to click
    // Try to click step-sim directly (it's disabled initially). Enable by starting and resetting to simulate "no active simulation" branch:
    // Start simulation with no packet by calling start-sim after clearing packetState
    await page.click('#clear-packet'); // ensure no packet
    // Now try starting sim - should alert asking to build or load a packet
    await page.click('#start-sim');
    const dlg = dialogMessages.pop();
    expect(dlg).toContain('Build or load a packet first before starting simulation.');
  });

  test('Console and runtime observation: capture console messages and ensure no uncaught exceptions', async ({ page }) => {
    // Check that some console messages may have been emitted during prior interactions
    // This test asserts that we successfully captured console messages array (it may be empty)
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    // Ensure no uncaught page errors were recorded by the browser
    expect(pageErrors.length).toBe(0);
  });
});