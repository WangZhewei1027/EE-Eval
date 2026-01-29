import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3d1225-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('TCP/IP Demonstration (de3d1225-fa74-11f0-a1b6-4b9b8151441a) - FSM tests', () => {
  // containers for console messages and page errors observed during a test
  let consoleMessages;
  let pageErrors;

  // Common setup for each test: open the page and attach listeners to capture console and errors
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console events (info, warn, error, etc.)
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture unhandled page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the provided HTML page exactly as-is
    await page.goto(APP_URL);
    // Ensure the page finished loading and the log container exists
    await expect(page.locator('#log')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    // Optionally capture a screenshot on failure — Playwright does this automatically in many setups.
    // Cleanup is handled by Playwright fixture for page.
  });

  // Helper: read the visible text contents of the log (normalized)
  const getLogText = async (page) => {
    const raw = await page.locator('#log').innerText();
    // Normalize whitespace for reliable assertions
    return raw.replace(/\s+/g, ' ').trim();
  };

  test('Initial Idle state renders controls and log area', async ({ page }) => {
    // Validate initial UI elements exist as evidence of Idle state rendering
    // This validates FSM S0_Idle entry (renderPage())
    await expect(page.locator("button[onclick='startHandshake()']")).toBeVisible();
    await expect(page.locator("button[onclick='sendMessage()']")).toBeVisible();
    await expect(page.locator("button[onclick='closeConnection()']")).toBeVisible();
    await expect(page.locator('#messageInput')).toBeVisible();
    await expect(page.locator('#messageInput')).toHaveAttribute('placeholder', 'Enter message to send');
    await expect(page.locator('#log')).toBeVisible();

    // No uncaught page errors should have occurred on load
    expect(pageErrors.length, `Expected no page errors on initial load, but found: ${pageErrors.map(e => e.message).join(', ')}`).toBe(0);

    // No console.error messages recorded
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length, 'Expected no console errors or warnings on initial load').toBe(0);
  });

  test('Start Handshake: Idle -> Handshake In Progress -> Connection Established', async ({ page }) => {
    // This test validates the Start Handshake event and the expected sequence of logs and final connectionEstablished flag.
    // Click Start Handshake
    await page.click("button[onclick='startHandshake()']");

    // Immediately we expect a Sending SYN log from client (synchronous log before timeouts)
    await expect(page.locator('#log')).toContainText('Sending SYN packet');

    // The handshake uses several timeouts. Wait until final "TCP connection established!" appears.
    await page.waitForFunction(() => {
      const el = document.getElementById('log');
      return el && el.innerText.includes('TCP connection established!');
    }, { timeout: 5000 });

    // Verify intermediate messages were produced (evidence of three-way handshake)
    const logText = await getLogText(page);
    expect(logText).toContain('Sending SYN packet');
    expect(logText).toContain('Received SYN packet');
    expect(logText).toContain('Sending SYN-ACK packet');
    expect(logText).toContain('Received SYN-ACK packet');
    expect(logText).toContain('Sending ACK packet');
    expect(logText).toContain('Received ACK packet');
    expect(logText).toContain('TCP connection established!');

    // FSM expected entry_action "Starting handshake..." is mentioned in the FSM spec,
    // but the implementation does not log that exact string. Verify and assert its absence explicitly.
    expect(logText).not.toContain('Starting handshake...', 'FSM declared an entry action "Starting handshake..." but the page did not log it.');

    // Verify the global variable connectionEstablished was set to true
    const isEstablished = await page.evaluate(() => typeof connectionEstablished !== 'undefined' && connectionEstablished);
    expect(isEstablished).toBe(true);

    // No uncaught page errors occurred during handshake
    expect(pageErrors.length, `Page errors detected during handshake: ${pageErrors.map(e => e.message).join(', ')}`).toBe(0);
  });

  test('Send Message event respects connection state and transmits data when connected', async ({ page }) => {
    // This test covers two scenarios:
    // - sending a message when not connected produces a clear application-level message
    // - after establishing connection, sending a message produces the expected logs and clears the input

    // 1) Attempt to send without connection
    await page.click("button[onclick='sendMessage()']");
    // Expect an application-level log about inability to send
    await expect(page.locator('#log')).toContainText('Cannot send data - no connection established!');

    // Reset page (reload) to ensure fresh state for full flow
    await page.reload();
    // Reattach listeners after reload (test.beforeEach attaches them already for initial load; after reload we still have them)
    // Perform handshake to establish connection first
    await page.click("button[onclick='startHandshake()']");
    await page.waitForFunction(() => {
      const el1 = document.getElementById('log');
      return el && el.innerText.includes('TCP connection established!');
    }, { timeout: 5000 });

    // Ensure connectionEstablished is true
    expect(await page.evaluate(() => connectionEstablished)).toBe(true);

    // Enter a message and send it
    const testMessage = 'Hello TCP';
    await page.fill('#messageInput', testMessage);
    await page.click("button[onclick='sendMessage()']");

    // Immediately we should see a Sending data log
    await expect(page.locator('#log')).toContainText(`Sending data: "${testMessage}"`);

    // Wait for server to receive data and for ACK roundtrip
    await page.waitForFunction((msg) => {
      const el2 = document.getElementById('log');
      const text = el ? el.innerText : '';
      return text.includes(`Received data: "${msg}"`) && text.includes('Sending ACK for data') && text.includes('Received ACK for data');
    }, testMessage, { timeout: 4000 });

    const logText1 = await getLogText(page);
    expect(logText).toContain(`Received data: "${testMessage}"`);
    expect(logText).toContain('Sending ACK for data');
    expect(logText).toContain('Received ACK for data');

    // The input should be cleared after sending
    const inputValue = await page.locator('#messageInput').inputValue();
    expect(inputValue).toBe('', 'Expected message input to be cleared after sending');

    // No uncaught page errors during send
    expect(pageErrors.length, `Page errors detected during sendMessage: ${pageErrors.map(e => e.message).join(', ')}`).toBe(0);
  });

  test('Close Connection: Connection Established -> Connection Terminating -> Idle', async ({ page }) => {
    // This test validates the graceful close handshake and that connectionEstablished toggles to false at the end.

    // Establish connection first
    await page.click("button[onclick='startHandshake()']");
    await page.waitForFunction(() => {
      const el3 = document.getElementById('log');
      return el && el.innerText.includes('TCP connection established!');
    }, { timeout: 5000 });

    expect(await page.evaluate(() => connectionEstablished)).toBe(true);

    // Trigger close
    await page.click("button[onclick='closeConnection()']");

    // The implementation logs 'Sending FIN packet' as the first step
    await expect(page.locator('#log')).toContainText('Sending FIN packet');

    // Wait for the entire close sequence to complete and for the 'TCP connection closed gracefully' message
    await page.waitForFunction(() => {
      const el4 = document.getElementById('log');
      return el && el.innerText.includes('TCP connection closed gracefully');
    }, { timeout: 5000 });

    const finalLog = await getLogText(page);

    // Verify presence of expected messages indicative of four-way handshake
    expect(finalLog).toContain('Sending FIN packet');
    expect(finalLog).toContain('Received FIN packet');
    expect(finalLog).toContain('Sending ACK for FIN');
    // Server's FIN and client's final ACK
    expect(finalLog).toContain('Sending FIN packet');
    expect(finalLog).toContain('Received final ACK');
    expect(finalLog).toContain('TCP connection closed gracefully');

    // FSM S3 entry_action 'Closing connection...' was declared in the FSM but not implemented in the page.
    // Assert that the literal string 'Closing connection...' does not appear (documented divergence).
    expect(finalLog).not.toContain('Closing connection...', 'FSM declared an entry action "Closing connection..." but the page did not log it.');

    // After closing, connectionEstablished should be false
    expect(await page.evaluate(() => !!(typeof connectionEstablished !== 'undefined' && connectionEstablished))).toBe(false);

    // Confirm no uncaught JS errors occurred during close
    expect(pageErrors.length, `Page errors detected during closeConnection: ${pageErrors.map(e => e.message).join(', ')}`).toBe(0);
  });

  test('Edge cases: starting handshake when already established and re-closing an idle connection', async ({ page }) => {
    // Establish connection
    await page.click("button[onclick='startHandshake()']");
    await page.waitForFunction(() => {
      const el5 = document.getElementById('log');
      return el && el.innerText.includes('TCP connection established!');
    }, { timeout: 5000 });

    // Attempt to start handshake again while established; implementation should log "Connection already established!"
    await page.click("button[onclick='startHandshake()']");
    await page.waitForFunction(() => {
      const el6 = document.getElementById('log');
      return el && el.innerText.includes('Connection already established!');
    }, { timeout: 2000 });

    expect(await getLogText(page)).toContain('Connection already established!');

    // Close connection to return to Idle
    await page.click("button[onclick='closeConnection()']");
    await page.waitForFunction(() => {
      const el7 = document.getElementById('log');
      return el && el.innerText.includes('TCP connection closed gracefully');
    }, { timeout: 5000 });

    // Now attempt to close again when idle — should log 'No active connection to close!'
    await page.click("button[onclick='closeConnection()']");
    await page.waitForFunction(() => {
      const el8 = document.getElementById('log');
      return el && el.innerText.includes('No active connection to close!');
    }, { timeout: 2000 });

    expect(await getLogText(page)).toContain('No active connection to close!');

    // No uncaught JavaScript errors should have happened during these edge cases
    expect(pageErrors.length, `Expected no page errors in edge-case interactions but found: ${pageErrors.map(e => e.message).join(', ')}`).toBe(0);
  });

  test('Observe console and page errors (assert none occurred during normal operation)', async ({ page }) => {
    // This test explicitly documents the console and page error observation.
    // Perform a quick handshake and close to generate runtime activity
    await page.click("button[onclick='startHandshake()']");
    await page.waitForFunction(() => {
      const el9 = document.getElementById('log');
      return el && el.innerText.includes('TCP connection established!');
    }, { timeout: 5000 });

    await page.click("button[onclick='closeConnection()']");
    await page.waitForFunction(() => {
      const el10 = document.getElementById('log');
      return el && el.innerText.includes('TCP connection closed gracefully');
    }, { timeout: 5000 });

    // Assert there are no page errors captured (ReferenceError, TypeError, SyntaxError, etc.)
    expect(pageErrors.length, `Expected no uncaught page errors, but found: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);

    // Assert there are no console.error messages
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length, `Expected no console.error messages, but found: ${consoleErrs.map(m => m.text).join(' | ')}`).toBe(0);

    // For visibility in diagnostic output, assert that some console messages may exist but are not errors (the app logs messages to DOM, not console)
    // We still capture console messages in case the page prints anything to console; just ensure none are of error type.
  });
});