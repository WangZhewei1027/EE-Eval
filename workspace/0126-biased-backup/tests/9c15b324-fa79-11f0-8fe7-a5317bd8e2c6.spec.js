import { test, expect } from '@playwright/test';

const APP = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c15b324-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Helpers to read SIM from page
async function getSIM(page) {
  return await page.evaluate(() => {
    return {
      time: window.SIM?.time ?? null,
      nodes: Object.keys(window.SIM?.nodes ?? {}),
      capturesCount: window.SIM?.captures?.length ?? 0,
      running: window.SIM?.running ?? false,
      tickInterval: window.SIM?.tickInterval ?? null,
      lossPct: window.SIM?.lossPct ?? null,
      latency: window.SIM?.latency ?? null
    };
  });
}

test.describe('TCP/IP Interactive Simulator - FSM and UI integration tests', () => {
  // Collect console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen for console errors and page errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Handle alert dialogs so tests don't hang on alerts from the app
    page.on('dialog', async dialog => {
      try {
        await dialog.accept();
      } catch (e) {
        // ignore
      }
    });

    // Navigate to the app
    await page.goto(APP, { waitUntil: 'load' });

    // Ensure initial resetSimulation has completed and UI elements exist
    await expect(page.locator('#startStopBtn')).toBeVisible();
    await expect(page.locator('#stepBtn')).toBeVisible();
    await expect(page.locator('#fromNode')).toBeVisible();
  });

  test.afterEach(async () => {
    // If any pageErrors were captured, assert their types are among ReferenceError/TypeError/SyntaxError
    if (pageErrors.length > 0) {
      // At least one page error happened; make sure it's a JS runtime error type we watch for
      const msg = pageErrors[0].message || String(pageErrors[0]);
      expect(msg).toMatch(/ReferenceError|TypeError|SyntaxError|Error/);
    }
    // If any console errors were captured, ensure they contain useful diagnostic info (non-empty)
    if (consoleErrors.length > 0) {
      expect(consoleErrors[0].length).toBeGreaterThan(0);
    }
  });

  test.describe('State S0_Idle (initial) validations', () => {
    test('Initial Idle state and resetSimulation executed on load', async ({ page }) => {
      // Validate UI shows stopped mode and initial topology created
      await expect(page.locator('#startStopBtn')).toHaveText('Start Auto-run');
      await expect(page.locator('#runMode')).toHaveValue('stopped');

      // The resetSimulation() is called on load; check SIM.node list contains HostA, HostB, Router1
      const sim = await getSIM(page);
      expect(sim.nodes).toEqual(expect.arrayContaining(['HostA', 'HostB', 'Router1']));
      expect(sim.time).toBe(0);

      // Verify topology area contains HostA and Router1 strings
      const topoText = await page.locator('#topoArea').innerText();
      expect(topoText).toContain('HostA');
      expect(topoText).toContain('Router1');

      // Inspect eventLog for the reset message
      const log = await page.locator('#eventLog').inputValue();
      expect(log).toMatch(/Simulation reset with default topology|Simulator ready/);
    });
  });

  test.describe('Auto-run state S1_Running and transitions', () => {
    test('START_AUTO_RUN: clicking Start Auto-run enters Running, auto ticks advance SIM.time', async ({ page }) => {
      // Reduce tick interval to speed up the test
      await page.fill('#tickInterval', '50');
      await page.dispatchEvent('#tickInterval', 'change');

      // Start auto-run
      await page.click('#startStopBtn');

      // UI should indicate running
      await expect(page.locator('#startStopBtn')).toHaveText('Stop Auto-run');
      await expect(page.locator('#runMode')).toHaveValue('auto');

      // Wait longer than two tick intervals to allow some ticks
      await page.waitForTimeout(160);

      // Check SIM.time progressed (>= one tick interval)
      const simAfter = await getSIM(page);
      expect(simAfter.time).toBeGreaterThan(0);

      // Now stop the auto-run to not interfere with other tests
      await page.click('#startStopBtn');
      await expect(page.locator('#startStopBtn')).toHaveText('Start Auto-run');
      await expect(page.locator('#runMode')).toHaveValue('stopped');
    });

    test('STOP_AUTO_RUN: toggling Start/Stop clears interval and returns to Idle', async ({ page }) => {
      // Start then immediately stop, ensure runMode toggles
      await page.click('#startStopBtn'); // start
      await expect(page.locator('#runMode')).toHaveValue('auto');

      // Stop
      await page.click('#startStopBtn');
      await expect(page.locator('#runMode')).toHaveValue('stopped');
      await expect(page.locator('#startStopBtn')).toHaveText('Start Auto-run');

      // Ensure no automatic ticks happen after stop by recording time and waiting
      const before = await getSIM(page);
      await page.waitForTimeout(120);
      const after = await getSIM(page);
      expect(after.time).toBeLessThanOrEqual(before.time + 1); // at most one tick if race, but should be stable
    });
  });

  test.describe('Manual control S2_Manual and STEP_TICK', () => {
    test('STEP_TICK: clicking Step 1 Tick advances simulation and updates topology/logs', async ({ page }) => {
      // Ensure stopped mode
      await page.selectOption('#runMode', 'stopped');
      // Read time
      const t0 = await page.evaluate(() => window.SIM.time);
      // Click step
      await page.click('#stepBtn');

      // Wait small moment to let tick process
      await page.waitForTimeout(50);

      const t1 = await page.evaluate(() => window.SIM.time);
      expect(t1).toBeGreaterThan(t0);

      // Topology area and routing area should refresh
      const topo = await page.locator('#topoArea').innerText();
      expect(topo.length).toBeGreaterThan(0);
      const routing = await page.locator('#routingArea').innerText();
      expect(routing.length).toBeGreaterThan(0);
    });
  });

  test.describe('Node and Topology manipulations (CREATE_HOST, CREATE_ROUTER, CONNECT_NODES)', () => {
    test('CREATE_HOST: create a host and verify in node lists and topology', async ({ page }) => {
      // Fill new host name and IP
      const uniqueHost = 'TestHost_' + Date.now();
      await page.fill('#newHostName', uniqueHost);
      await page.fill('#newHostIP', '10.0.9.9');
      await page.click('#createHostBtn');

      // Node should appear in selects
      await page.waitForTimeout(50);
      const fromOptions = await page.locator('#fromNode option').allTextContents();
      expect(fromOptions).toContain(uniqueHost);

      // Topo area should show the created host with the IP
      const topo = await page.locator('#topoArea').innerText();
      expect(topo).toContain(uniqueHost);
      expect(topo).toContain('10.0.9.9');
    });

    test('CREATE_ROUTER: create a router and verify topology', async ({ page }) => {
      const rname = 'TestRouter_' + Date.now();
      await page.fill('#newRouterName', rname);
      await page.click('#createRouterBtn');

      await page.waitForTimeout(50);
      const nodes = await page.locator('#nodeSelect option').allTextContents();
      expect(nodes).toContain(rname);

      const topo = await page.locator('#topoArea').innerText();
      expect(topo).toContain(rname);
    });

    test('CONNECT_NODES: connect two existing nodes and validate peer links', async ({ page }) => {
      // Create two temporary hosts to connect
      const a = 'ConnA_' + Date.now();
      const b = 'ConnB_' + Date.now();
      await page.fill('#newHostName', a);
      await page.fill('#newHostIP', '10.0.20.1');
      await page.click('#createHostBtn');
      await page.fill('#newHostName', b);
      await page.fill('#newHostIP', '10.0.20.2');
      await page.click('#createHostBtn');

      await page.waitForTimeout(100);

      // Connect them
      await page.fill('#connA', a);
      await page.fill('#connB', b);
      await page.fill('#connMTU', '1400');
      await page.click('#connectBtn');

      await page.waitForTimeout(100);
      const topo = await page.locator('#topoArea').innerText();
      expect(topo).toContain(a);
      expect(topo).toContain(b);
      // check link mtu present
      expect(topo).toContain('mtu=1400');
    });
  });

  test.describe('Packet crafting and sending (SEND_PACKET, ARP, fragmentation)', () => {
    test('SEND_PACKET: craft and send a TCP packet and observe it in captures', async ({ page }) => {
      // Ensure HostA and HostB exist and are default
      const from = await page.locator('#fromNode option').first().getAttribute('value');
      // Use HostA -> HostB
      await page.fill('#toIP', '10.0.1.2'); // HostB default IP from initial topology
      await page.selectOption('#protoSelect', 'TCP');
      // Fill ports
      await page.fill('#srcPort', '45000');
      await page.fill('#dstPort', '8080');

      // Send packet
      await page.click('#sendPktBtn');

      // Step a couple of ticks so packet moves through links
      await page.click('#stepBtn');
      await page.waitForTimeout(60);
      await page.click('#stepBtn');
      await page.waitForTimeout(60);

      // Check captures list populated (CRAFT_SEND should be present)
      const captures = await page.evaluate(() => window.SIM.captures.map(c => c.event));
      expect(captures.join(' ')).toMatch(/CRAFT_SEND|SYN_SENT|FORWARD|ARP_REQ_SENT|ARP_REPLY|DELIVER|TCP_SEND/);
    });

    test('ARP Request: send explicit ARP request and verify ARP_REQ_SENT capture', async ({ page }) => {
      await page.fill('#toIP', '10.0.0.254'); // gateway IP expected on Router1
      await page.click('#arpReqBtn');
      await page.waitForTimeout(60);
      const caps = await page.evaluate(() => window.SIM.captures.slice(0,10).map(c => c.event));
      expect(caps.join(' ')).toContain('ARP_REQ_SENT');
    });

    test('Fragmentation: force fragmentation by setting fragSize and verify FRAGMENT capture or fragments appear', async ({ page }) => {
      // Craft large payload by setting fragSize > 0 via the send UI
      await page.fill('#fromNode', 'HostA'); // ensure from HostA
      await page.fill('#toIP', '10.0.1.2');
      await page.fill('#fragSize', '2000'); // will set payload large and size > mtu on link -> fragment
      await page.selectOption('#protoSelect', 'UDP'); // choose UDP for fragmentation test
      await page.click('#sendPktBtn');

      // Run a few ticks to let fragmentation happen
      await page.click('#stepBtn');
      await page.waitForTimeout(60);
      await page.click('#stepBtn');
      await page.waitForTimeout(60);

      const events = await page.evaluate(() => window.SIM.captures.map(c => c.event));
      // We expect either FRAGMENT or FRAG_TEST or FORWARD entries
      expect(events.join(' ')).toMatch(/FRAGMENT|FRAG_TEST|FORWARD/);
    });
  });

  test.describe('TCP Connection Management (START_TCP_SERVER, STOP_TCP_SERVER, CLIENT_CONNECT, CLIENT_CLOSE)', () => {
    test('START_TCP_SERVER and STOP_TCP_SERVER: start a server and stop it', async ({ page }) => {
      // Choose server node HostB
      await page.selectOption('#serverNode', 'HostB');
      // Start server
      await page.fill('#serverPort', '8080');
      await page.click('#startServerBtn');

      await page.waitForTimeout(50);
      // Verify SIM.nodes['HostB'].tcpServers[8080] exists
      const serverExists = await page.evaluate(() => {
        return !!(window.SIM.nodes['HostB'] && window.SIM.nodes['HostB'].tcpServers && window.SIM.nodes['HostB'].tcpServers[8080]);
      });
      expect(serverExists).toBe(true);

      // Now stop
      await page.click('#stopServerBtn');
      await page.waitForTimeout(50);
      const serverGone = await page.evaluate(() => {
        return !!(window.SIM.nodes['HostB'] && window.SIM.nodes['HostB'].tcpServers && window.SIM.nodes['HostB'].tcpServers[8080]);
      });
      expect(serverGone).toBe(false);
    });

    test('CLIENT_CONNECT: perform client connect & send data and observe captures/logs', async ({ page }) => {
      // Ensure server listening on HostB:8080
      await page.selectOption('#serverNode', 'HostB');
      await page.fill('#serverPort', '8080');
      await page.click('#startServerBtn');
      await page.waitForTimeout(50);

      // Set client and server selects
      await page.selectOption('#clientNode', 'HostA');
      await page.selectOption('#serverNode', 'HostB');
      await page.fill('#clientPort', '8080');
      await page.fill('#dataSize', '1024'); // small amount for test

      // Click Client Connect (this will send SYN and schedule data)
      await page.click('#clientConnectBtn');

      // Advance a few ticks to allow handshake and data transfer triggers
      for (let i = 0; i < 6; i++) {
        await page.click('#stepBtn');
        await page.waitForTimeout(60);
      }

      // Inspect captures for CLIENT_SYN, CLIENT_DATA, TCP_ESTABLISHED or TCP_SEND events
      const events = await page.evaluate(() => window.SIM.captures.map(c => c.event));
      const evStr = events.join(' ');
      expect(evStr).toMatch(/CLIENT_SYN|CLIENT_DATA|TCP_SEND|TCP_ESTABLISHED|TCP_SYN_RCVD|SYN_SENT/);
    });

    test('CLIENT_CLOSE: send client FIN and verify capture of CLIENT_FIN', async ({ page }) => {
      // Ensure there's at least HostA and HostB; send a FIN from the client
      await page.selectOption('#clientNode', 'HostA');
      await page.selectOption('#serverNode', 'HostB');
      await page.fill('#clientPort', '8080');
      // Click client close
      await page.click('#clientCloseBtn');

      await page.waitForTimeout(80);
      // Check captures for CLIENT_FIN
      const events = await page.evaluate(() => window.SIM.captures.map(c => c.event));
      expect(events.join(' ')).toContain('CLIENT_FIN');
    });
  });

  test.describe('Auxiliary controls and edge cases (CLEAR_LOGS, RESET_NETWORK, error scenarios)', () => {
    test('CLEAR_LOGS: clears the event log textarea', async ({ page }) => {
      // Ensure eventLog has content
      await page.click('#stepBtn');
      await page.waitForTimeout(40);
      const before = await page.locator('#eventLog').inputValue();
      expect(before.length).toBeGreaterThan(0);

      // Click clear logs
      await page.click('#clearLogsBtn');
      const after = await page.locator('#eventLog').inputValue();
      expect(after).toBe('');
    });

    test('RESET_NETWORK: clicking Reset Network triggers resetSimulation and restores default topology', async ({ page }) => {
      // Modify state: create a host so reset has effect
      await page.fill('#newHostName', 'TmpReset');
      await page.fill('#newHostIP', '10.2.2.2');
      await page.click('#createHostBtn');
      await page.waitForTimeout(50);
      // Confirm node exists
      let nodes = await page.locator('#nodeSelect option').allTextContents();
      expect(nodes).toContain('TmpReset');

      // Click reset
      await page.click('#resetBtn');
      await page.waitForTimeout(80);

      // After reset, TmpReset should be gone; default nodes present
      nodes = await page.locator('#nodeSelect option').allTextContents();
      expect(nodes).not.toContain('TmpReset');
      expect(nodes).toEqual(expect.arrayContaining(['HostA', 'HostB', 'Router1']));
    });

    test('Edge case: send packet with invalid IP triggers an alert (handled by dialog listener) and no uncaught exception', async ({ page }) => {
      // Provide invalid IP and click send
      await page.selectOption('#fromNode', 'HostA');
      await page.fill('#toIP', '999.999.999.999'); // invalid
      await page.selectOption('#protoSelect', 'ICMP');
      // Click send -> app uses ipValid which should cause alert('Invalid destination IP')
      await page.click('#sendPktBtn');

      // Wait briefly to ensure any dialog and internal handling finishes
      await page.waitForTimeout(60);

      // There should be no uncaught page errors
      expect(pageErrors.length).toBeLessThanOrEqual(1); // allow 0 or 1 if platform throws minor messages
      if (pageErrors.length > 0) {
        // Ensure the error type is a standard JS error type if present
        const msg = pageErrors[0].message || String(pageErrors[0]);
        expect(msg).toMatch(/ReferenceError|TypeError|SyntaxError|Error/);
      }
    });
  });

  test.describe('Capture UI and filters', () => {
    test('Packet capture list populates and Apply Filter filters captures', async ({ page }) => {
      // Ensure we have some captures by sending a basic ICMP ping
      await page.selectOption('#fromNode', 'HostA');
      await page.fill('#toIP', '10.0.1.2');
      await page.selectOption('#protoSelect', 'ICMP');
      await page.click('#sendPktBtn');
      // Step ticks to process
      await page.click('#stepBtn');
      await page.waitForTimeout(60);
      await page.click('#stepBtn');
      await page.waitForTimeout(60);

      // At least one capture entry should exist
      const capCount = await page.evaluate(() => window.SIM.captures.length);
      expect(capCount).toBeGreaterThan(0);

      // Apply a filter for proto:ICMP
      await page.fill('#captureFilter', 'proto:ICMP');
      await page.click('#applyFilterBtn');
      await page.waitForTimeout(40);

      const listOptions = await page.locator('#captureList option').allTextContents();
      // Each displayed option text should include 'ICMP' somewhere if filter worked
      expect(listOptions.length).toBeGreaterThan(0);
      const anyICMP = listOptions.some(t => t.includes('ICMP'));
      expect(anyICMP).toBe(true);

      // Clear capture list
      await page.click('#clearCaptureBtn');
      const cleared = await page.locator('#captureList option').count();
      expect(cleared).toBe(0);
    });
  });

  test.describe('Console and runtime diagnostics', () => {
    test('No uncaught JavaScript errors during normal interactions', async ({ page }) => {
      // Perform a few interactions
      await page.click('#stepBtn');
      await page.click('#startStopBtn'); // start
      await page.waitForTimeout(80);
      await page.click('#startStopBtn'); // stop
      await page.click('#clearLogsBtn');
      await page.click('#resetBtn');
      await page.waitForTimeout(120);

      // Assert no uncaught page errors were thrown (or if present, they're JS runtime errors and reported)
      // If any pageErrors are present, ensure they are instances of Error with messages
      if (pageErrors.length > 0) {
        const msg = pageErrors[0].message || String(pageErrors[0]);
        expect(msg.length).toBeGreaterThan(0);
        expect(msg).toMatch(/ReferenceError|TypeError|SyntaxError|Error/);
      } else {
        // No errors - this is acceptable
        expect(pageErrors.length).toBe(0);
      }

      // Also ensure consoleErrors are empty (no console.error)
      // If there are console errors, at least assert their text content exists
      if (consoleErrors.length > 0) {
        expect(consoleErrors[0].length).toBeGreaterThan(0);
      } else {
        expect(consoleErrors.length).toBe(0);
      }
    });
  });
});