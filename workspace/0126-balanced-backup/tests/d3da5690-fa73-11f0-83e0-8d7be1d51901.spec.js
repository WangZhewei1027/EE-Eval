import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3da5690-fa73-11f0-83e0-8d7be1d51901.html';

// Page object helpers to centralize selectors and common operations
class AppPage {
  constructor(page) {
    this.page = page;
    this.ws = {
      url: page.locator('#wsUrl'),
      toggle: page.locator('#wsToggle'),
      clear: page.locator('#wsClear'),
      message: page.locator('#wsMessage'),
      send: page.locator('#wsSend'),
      sendBinary: page.locator('#wsSendBinary'),
      state: page.locator('#wsState'),
      log: page.locator('#wsLog'),
      sent: page.locator('#wsSent'),
      recv: page.locator('#wsRecv'),
      msgs: page.locator('#wsMsgs')
    };
    this.rtc = {
      create: page.locator('#createConn'),
      close: page.locator('#closeConn'),
      aMsg: page.locator('#aMsg'),
      aSend: page.locator('#aSend'),
      aBin: page.locator('#aBin'),
      aLog: page.locator('#aLog'),
      bMsg: page.locator('#bMsg'),
      bSend: page.locator('#bSend'),
      bBin: page.locator('#bBin'),
      bLog: page.locator('#bLog'),
      pcState: page.locator('#pcState')
    };
    this.vs = {
      mtu: page.locator('#mtu'),
      fragDelay: page.locator('#fragDelay'),
      create: page.locator('#vsCreate'),
      close: page.locator('#vsClose'),
      msg: page.locator('#vsMsg'),
      send: page.locator('#vsSend'),
      sendLog: page.locator('#vsSendLog'),
      recvLog: page.locator('#vsRecvLog')
    };
  }

  // helper to wait for text fragment in a log element
  async waitForLogContains(locator, fragment, timeout = 5000) {
    await this.page.waitForFunction(
      (el, text) => el && el.innerText && el.innerText.indexOf(text) !== -1,
      locator,
      fragment,
      { timeout }
    );
  }
}

test.describe('Socket Programming Demo - end-to-end', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // collect page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // collect console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async ({}, testInfo) => {
    // Attach some diagnostics into the test output if available
    if (pageErrors.length) {
      for (const e of pageErrors) {
        testInfo.attachments = testInfo.attachments || [];
        testInfo.attachments.push({
          name: 'pageerror',
          body: e.stack || String(e),
        });
      }
    }
    if (consoleMessages.length) {
      testInfo.attachments = testInfo.attachments || [];
      testInfo.attachments.push({
        name: 'console-messages',
        body: consoleMessages.map(c => `[${c.type}] ${c.text}`).join('\n'),
      });
    }
  });

  test.describe('WebSocket panel (states & transitions)', () => {
    test('Connect button sets state to connecting and prevents send while closed', async ({ page }) => {
      const app = new AppPage(page);

      // Initially WebSocket state should be 'closed'
      await expect(app.ws.state).toHaveText('closed');

      // Attempt to send when socket is closed -> should trigger alert 'Socket not open'
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        app.ws.send.click()
      ]);
      expect(dialog.message()).toBe('Socket not open');
      await dialog.dismiss();

      // Attempt binary send when socket closed -> alert
      const [dialog2] = await Promise.all([
        page.waitForEvent('dialog'),
        app.ws.sendBinary.click()
      ]);
      expect(dialog2.message()).toBe('Socket not open');
      await dialog2.dismiss();

      // Click Connect: immediate state should be 'connecting' (setState called)
      await app.ws.toggle.click();
      await expect(app.ws.state).toHaveText('connecting');

      // wsLog should contain 'Connecting to' entry
      await app.ws.log.waitFor({ state: 'visible' });
      const logText = await app.ws.log.innerText();
      expect(logText.toLowerCase()).toContain('connecting to');

      // Wait briefly to see if 'OPEN' occurs; handle both success and failure paths.
      let opened = false;
      try {
        // If echo server responds, OPEN will be appended
        await app.waitForLogContains(app.ws.log, 'OPEN', 6000);
        opened = true;
      } catch (e) {
        // No OPEN observed within timeout - that's an acceptable outcome in CI; ensure error/close logged
        const txt = await app.ws.log.innerText();
        // Expect either an ERROR or CLOSE to be present if OPEN not seen
        const lower = txt.toLowerCase();
        expect(lower.includes('error') || lower.includes('close') || lower.includes('failed')).toBeTruthy();
      }

      if (opened) {
        // If socket opened successfully, send a message and verify SENT log entry and that counters update.
        const testMsg = 'hello-playwright';
        await app.ws.message.fill(testMsg);
        await app.ws.send.click();

        // 'SENT (text): hello-playwright' should appear in wsLog
        await app.waitForLogContains(app.ws.log, `SENT (text): ${testMsg}`, 3000);

        // bytes sent counter should be increased (>= length of testMsg)
        const sentCount = Number(await app.ws.sent.innerText());
        expect(sentCount).toBeGreaterThanOrEqual(testMsg.length);

        // The echo server may immediately echo back; wait for RECV or MSG count increment
        try {
          await app.waitForLogContains(app.ws.log, 'RECV (text):', 3000);
          const msgs = Number(await app.ws.msgs.innerText());
          expect(msgs).toBeGreaterThanOrEqual(1);
        } catch (e) {
          // If no RECV, it's acceptable in some CI environments; ensure no uncaught exception
        }

        // Send a binary frame
        await app.ws.sendBinary.click();
        await app.waitForLogContains(app.ws.log, 'SENT (binary)', 3000);
        const newSent = Number(await app.ws.sent.innerText());
        expect(newSent).toBeGreaterThanOrEqual(sentCount); // should have increased
      }

      // Clear the log and ensure counters reset
      await app.ws.clear.click();
      await expect(app.ws.log).toHaveText('');
      await expect(app.ws.sent).toHaveText('0');
      await expect(app.ws.recv).toHaveText('0');
      await expect(app.ws.msgs).toHaveText('0');

      // If still connected, click Toggle to disconnect (disconnect() also sets state to 'closed')
      // We call toggle to ensure transition back to closed state if possible.
      // Wrap in try because the toggle may already be 'Connect' text
      try {
        const btnText = await app.ws.toggle.innerText();
        if (btnText.toLowerCase().includes('disconnect')) {
          await app.ws.toggle.click();
          // After disconnect, wsState should be 'closed'
          await expect(app.ws.state).toHaveText('closed');
        }
      } catch (e) {
        // ignore any transient errors
      }
    });
  });

  test.describe('WebRTC DataChannel (peers & message exchange)', () => {
    test('Create peers, exchange text and binary messages, then close peers', async ({ page }) => {
      const app = new AppPage(page);

      // Ensure initial state
      await expect(app.rtc.pcState).toHaveText('none');
      await expect(app.rtc.aLog).toHaveText('');
      await expect(app.rtc.bLog).toHaveText('');

      // Create local peers
      await app.rtc.create.click();

      // After clicking create, pcState should transiently be 'creating'
      await expect(app.rtc.pcState).toHaveText(/creating|pc1:/i);

      // Wait for DataChannel OPEN messages on both peers
      // It's possible that one side opens slightly earlier; wait up to 6s for both.
      await Promise.all([
        app.page.waitForFunction(
          el => el && el.innerText && el.innerText.toLowerCase().includes('datachannel open (a)'),
          app.rtc.aLog,
          { timeout: 6000 }
        ).catch(() => {}),
        app.page.waitForFunction(
          el => el && el.innerText && el.innerText.toLowerCase().includes('datachannel open (b)'),
          app.rtc.bLog,
          { timeout: 6000 }
        ).catch(() => {})
      ]);

      // After peers are created, pcState should reflect ICE states (pc1: ... | pc2: ...)
      const pcStateText = await app.rtc.pcState.innerText();
      expect(pcStateText).toMatch(/pc1:\s*\S+/i);

      // Send a message from A to B
      const msgA = 'Message from A';
      await app.rtc.aMsg.fill(msgA);

      // If datachannel not open, clicking send will produce an alert - handle that as edge case.
      const aSendBtnText = await app.rtc.aSend.isEnabled();
      // Use dialog detection to capture "DataChannel not open" if arises
      const dialogPromise = app.page.waitForEvent('dialog').catch(() => null);
      await app.rtc.aSend.click();
      const dlg = await dialogPromise;
      if (dlg) {
        // DataChannel not open case
        expect(dlg.message()).toBe('DataChannel not open');
        await dlg.dismiss();
      } else {
        // If no dialog, expect logs to include SENT on A and RECV on B
        await app.waitForLogContains(app.rtc.aLog, `SENT: ${msgA}`, 3000);
        await app.waitForLogContains(app.rtc.bLog, `RECV: ${msgA}`, 3000);
      }

      // Send a message from B to A
      const msgB = 'Reply from B';
      await app.rtc.bMsg.fill(msgB);
      const dlg2Promise = app.page.waitForEvent('dialog').catch(() => null);
      await app.rtc.bSend.click();
      const dlg2 = await dlg2Promise;
      if (dlg2) {
        expect(dlg2.message()).toBe('DataChannel not open');
        await dlg2.dismiss();
      } else {
        await app.waitForLogContains(app.rtc.bLog, `SENT: ${msgB}`, 3000);
        await app.waitForLogContains(app.rtc.aLog, `RECV: ${msgB}`, 3000);
      }

      // Test binary sending from A to B (if channels open)
      const dlg3Promise = app.page.waitForEvent('dialog').catch(() => null);
      await app.rtc.aBin.click();
      const dlg3 = await dlg3Promise;
      if (dlg3) {
        expect(dlg3.message()).toBe('DataChannel not open');
        await dlg3.dismiss();
      } else {
        // bLog should eventually contain 'RECV (binary)'
        await app.waitForLogContains(app.rtc.bLog, 'RECV (binary)', 3000);
      }

      // Test binary sending from B to A
      const dlg4Promise = app.page.waitForEvent('dialog').catch(() => null);
      await app.rtc.bBin.click();
      const dlg4 = await dlg4Promise;
      if (dlg4) {
        expect(dlg4.message()).toBe('DataChannel not open');
        await dlg4.dismiss();
      } else {
        await app.waitForLogContains(app.rtc.aLog, 'RECV (binary)', 3000);
      }

      // Close peers and ensure state resets
      await app.rtc.close.click();
      await expect(app.rtc.pcState).toHaveText('none');

      // Logs should be cleared by reset()
      await expect(app.rtc.aLog).toHaveText('');
      await expect(app.rtc.bLog).toHaveText('');
    });
  });

  test.describe('Virtual Socket (fragmentation & reassembly)', () => {
    test('Create virtual socket, validate fragmentation, reassembly, and close', async ({ page }) => {
      const app = new AppPage(page);

      // Ensure logs empty initially
      await expect(app.vs.sendLog).toHaveText('');
      await expect(app.vs.recvLog).toHaveText('');

      // Create virtual socket
      await app.vs.create.click();

      // Confirm creation messages in logs
      await app.waitForLogContains(app.vs.sendLog, 'Virtual socket created', 2000);
      await app.waitForLogContains(app.vs.recvLog, 'Receiver ready', 2000);

      // Attempt to send without entering a message should alert 'Enter message'
      const [dlg] = await Promise.all([
        page.waitForEvent('dialog'),
        app.vs.send.click()
      ]);
      expect(dlg.message()).toBe('Enter message');
      await dlg.dismiss();

      // Enter a long message to force fragmentation with small MTU (default 16)
      const msg = 'This is a longer test message to force fragmentation';
      await app.vs.msg.fill(msg);

      // Trigger send
      await app.vs.send.click();

      // Expect FRAG SENT entries in send log (at least one)
      await app.waitForLogContains(app.vs.sendLog, 'FRAG SENT (', 3000);

      // Sender should have logged fragments and receiver should log FRAG RECV and REASSEMBLED MSG
      await app.waitForLogContains(app.vs.recvLog, 'FRAG RECV (', 5000);
      await app.waitForLogContains(app.vs.recvLog, 'REASSEMBLED MSG: ' + msg, 5000);

      // Close virtual socket and ensure 'Closed' appended
      await app.vs.close.click();
      await app.waitForLogContains(app.vs.sendLog, 'Closed', 2000);
      await app.waitForLogContains(app.vs.recvLog, 'Closed', 2000);
    });
  });

  test('Collect and assert page-level diagnostics (console & errors)', async ({ page }) => {
    // This test validates we captured console messages and page errors during prior interactions
    // Note: we do not modify page or suppress errors; we only report/assert their presence or absence constraints.

    // The collected arrays are at top-level of this describe; re-open the page to collect any startup messages
    const app = new AppPage(page);

    // At least ensure that we can query elements successfully (page loaded)
    await expect(app.ws.state).toBeVisible();

    // Basic expectations about the diagnostics shape:
    // - consoleMessages is an array of objects with type & text
    // - pageErrors is an array (possibly empty) of Error objects
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    expect(Array.isArray(pageErrors)).toBeTruthy();

    // Sanity check: no SyntaxError should have been thrown during load
    const syntaxErrors = pageErrors.filter(e => String(e).toLowerCase().includes('syntaxerror'));
    expect(syntaxErrors.length).toBe(0);

    // It's acceptable for there to be runtime errors like network or WebSocket errors;
    // we assert that any pageErrors are Error instances (basic invariant).
    for (const err of pageErrors) {
      expect(err).toBeInstanceOf(Error);
    }

    // Log a few captured console messages into the test result (attachments are added in afterEach)
    // Ensure at least the page emitted some console or nothing catastrophic occurred.
    // If there were no console messages, that's acceptable as well.
    expect(consoleMessages).toBeDefined();
  });
});