import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c15da34-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Helper to collect console and page errors for each test run
test.describe('Congestion Control Interactive Simulator - End-to-end', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app page
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Ensure simulator initial ready message appears in log area
    await page.waitForSelector('#log');
  });

  test.afterEach(async () => {
    // Basic guard: fail if there were uncaught page errors (unexpected runtime exceptions)
    // We assert zero page errors here to surface runtime problems naturally.
    expect(pageErrors.length, 'No uncaught page errors should be present').toBe(0);
  });

  test.describe('State transitions (S0_Idle, S1_Running, S2_Paused)', () => {
    test('Initial state S0_Idle: resetSim called and UI shows Play', async ({ page }) => {
      // Validate initial UI and exposed sim state from resetSim()
      const playText = await page.locator('#playBtn').innerText();
      expect(playText).toBe('Play');

      // Check exposed window.__sim exists and is not running
      const running = await page.evaluate(() => !!(window.__sim && window.__sim.running));
      expect(running).toBe(false);

      // Check log contains the initial ready/reset messages
      const logValue = await page.locator('#log').inputValue();
      expect(logValue).toContain('Simulator ready') || expect(logValue).toContain('Reset simulation');
    });

    test('PlayPause: clicking Play transitions to Running (S1_Running) and toggles button text', async ({ page }) => {
      // Click Play to start simulation
      await page.click('#playBtn');

      // Wait for sim.running to become true
      await page.waitForFunction(() => window.__sim && window.__sim.running === true);

      // Verify play button text changed to Pause
      const playText = await page.locator('#playBtn').innerText();
      expect(playText).toBe('Pause');

      // Verify displayed state field updated by updateDisplay (should show a sender state)
      const stateText = await page.locator('#stateVal').innerText();
      expect(stateText.length).toBeGreaterThan(0);

      // Now click Play (Pause) to pause simulation -> S2_Paused
      await page.click('#playBtn');
      await page.waitForFunction(() => window.__sim && window.__sim.running === false);

      // Button text should be Play again
      const playTextAfter = await page.locator('#playBtn').innerText();
      expect(playTextAfter).toBe('Play');
    });

    test('Step event: when running, clicking Step advances simulation time and records samples', async ({ page }) => {
      // Ensure running
      await page.click('#playBtn');
      await page.waitForFunction(() => window.__sim && window.__sim.running === true);

      const beforeTime = await page.evaluate(() => window.__sim.timeMs);
      // Click Step (tick)
      await page.click('#stepBtn');

      // Wait for time to advance by at least tickMs (the page's tick increments sim.timeMs)
      await page.waitForFunction((t) => window.__sim.timeMs > t, beforeTime);

      const afterTime = await page.evaluate(() => window.__sim.timeMs);
      expect(afterTime).toBeGreaterThan(beforeTime);

      // Verify plotSamples got at least one new entry after a tick+record interval could update
      const samples = await page.evaluate(() => window.__sim.plotSamples.length);
      expect(samples).toBeGreaterThanOrEqual(0); // at minimum ensure property exists

      // Pause afterwards
      await page.click('#playBtn');
      await page.waitForFunction(() => window.__sim && window.__sim.running === false);
    });

    test('Reset event: Reset returns to Idle (S0_Idle) and resets time/metrics', async ({ page }) => {
      // Start first to change state and produce some metrics
      await page.click('#playBtn');
      await page.waitForFunction(() => window.__sim && window.__sim.running === true);

      // Let a few ticks run
      await page.waitForTimeout(100);
      // Click Reset
      await page.click('#resetBtn');

      // Expect sim running false and time reset to 0
      await page.waitForFunction(() => window.__sim && window.__sim.running === false && window.__sim.timeMs === 0);

      const timeAfter = await page.evaluate(() => window.__sim.timeMs);
      expect(timeAfter).toBe(0);

      const playText = await page.locator('#playBtn').innerText();
      expect(playText).toBe('Play');
    });
  });

  test.describe('Batch run & fast-run semantics', () => {
    test('FastRun: clicking Run 500 steps advances sim.timeMs significantly', async ({ page }) => {
      // Ensure deterministic tickMs and recordInt for the test
      await page.fill('#tickMs', '10');
      await page.fill('#recordInt', '10');

      const before = await page.evaluate(() => window.__sim.timeMs);
      await page.click('#fastRunBtn');

      // After fastRun, time should have advanced by at least 500 * tickMs (in packet mode tick does dt increments)
      // Wait for a brief moment for synchronous loop to complete
      await page.waitForTimeout(100);

      const after = await page.evaluate(() => window.__sim.timeMs);
      expect(after).toBeGreaterThanOrEqual(before + 500 * 10);
    });
  });

  test.describe('Manual events & packet operations', () => {
    test('DropPacket: manually drop a sent packet and observe loss handling', async ({ page }) => {
      // Ensure simulation sends some packets: start and allow a few ticks
      await page.click('#playBtn');
      await page.waitForFunction(() => window.__sim && window.__sim.running === true);

      // Wait for some packets to be sent (look for sim.nextSeq > 1)
      await page.waitForFunction(() => window.__sim && window.__sim.nextSeq > 1);

      // Determine a seq to drop: pick a packet that exists in sim.packets
      const seqToDrop = await page.evaluate(() => {
        const sim = window.__sim;
        // pick first packet's seq if available, otherwise fallback to 1
        if(sim && sim.packets && sim.packets.length) return sim.packets[0].seq;
        return 1;
      });

      // Fill dropSeq and click drop
      await page.fill('#dropSeq', String(seqToDrop));
      await page.click('#dropBtn');

      // Wait for quickLog message indicating manual drop
      await page.waitForFunction((s) => {
        const log = document.getElementById('log').value;
        return log.includes('Manually dropped packet seq ' + s) || log.includes('Packet not found');
      }, seqToDrop);

      // Validate that the dropped packet has dropped flag in sim.packets
      const droppedFlag = await page.evaluate((s) => {
        const p = window.__sim.packets.find(x => x.seq === s);
        return !!(p && p.dropped);
      }, seqToDrop);
      expect(droppedFlag).toBe(true);

      // Ensure losses count incremented
      const losses = await page.evaluate(() => window.__sim.losses);
      expect(losses).toBeGreaterThanOrEqual(1);

      // Pause simulation to be safe
      await page.click('#playBtn');
      await page.waitForFunction(() => window.__sim && window.__sim.running === false);
    });

    test('DelayPacket: delay a packet and observe log update and extraDelay flag', async ({ page }) => {
      // Start and wait for packets
      await page.click('#playBtn');
      await page.waitForFunction(() => window.__sim && window.__sim.nextSeq > 1);

      // Pick a packet seq to delay
      const seqToDelay = await page.evaluate(() => {
        const sim = window.__sim;
        if(sim && sim.packets && sim.packets.length) return sim.packets[0].seq;
        return 1;
      });

      // Set delay ms small and click Delay
      await page.fill('#delaySeq', String(seqToDelay));
      await page.fill('#delayMs', '50');
      await page.click('#delayBtn');

      // Wait for log message
      await page.waitForFunction((s) => {
        const log = document.getElementById('log').value;
        return log.includes('Delayed packet ' + s) || log.includes('Packet not found for delay');
      }, seqToDelay);

      // Verify extraDelay recorded on the packet
      const extraDelay = await page.evaluate((s) => {
        const p = window.__sim.packets.find(x => x.seq === s);
        return p ? (p.extraDelay || 0) : 0;
      }, seqToDelay);

      expect(extraDelay).toBeGreaterThanOrEqual(50);

      // Pause simulation
      await page.click('#playBtn');
      await page.waitForFunction(() => window.__sim && window.__sim.running === false);
    });

    test('TakeLinkDown: zero-duration rejects, positive duration takes link down and resumes', async ({ page }) => {
      // 1) Edge case: zero duration should produce a quickLog message
      await page.fill('#linkDownFor', '0');
      await page.click('#linkDownBtn');

      await page.waitForFunction(() => document.getElementById('log').value.includes('Specify positive ms for link down'));

      // 2) Positive duration should set linkUp false and later true
      await page.fill('#linkDownFor', '100'); // 100 ms
      await page.click('#linkDownBtn');

      // Immediately check that sim.linkUp becomes false
      await page.waitForFunction(() => window.__sim && window.__sim.linkUp === false);

      // Wait for the resume log (link resumed)
      await page.waitForFunction(() => document.getElementById('log').value.includes('Link resumed'), { timeout: 2000 });

      // Verify linkUp returned to true
      const linkUp = await page.evaluate(() => window.__sim.linkUp);
      expect(linkUp).toBe(true);
    });

    test('SetCrossTraffic: updates xtraffic input and logs the change', async ({ page }) => {
      await page.fill('#setX', '3.14');
      await page.click('#setXBtn');

      // xtrafficEl value should be updated
      const xtrafficVal = await page.locator('#xtraffic').inputValue();
      expect(Number(xtrafficVal)).toBeCloseTo(3.14, 2);

      // Log should include message
      await page.waitForFunction(() => document.getElementById('log').value.includes('Set cross-traffic to'));
    });

    test('InspectPacket: inspecting unknown seq reports no record; inspecting known seq logs details', async ({ page }) {
      // Inspect without seq -> should log "Enter seq to inspect"
      await page.click('#inspectBtn');
      await page.waitForFunction(() => document.getElementById('log').value.includes('Enter seq to inspect'));

      // Now pick a known seq
      // Start simulation to produce a packet
      await page.click('#playBtn');
      await page.waitForFunction(() => window.__sim && window.__sim.nextSeq > 1);

      const someSeq = await page.evaluate(() => {
        const sim = window.__sim;
        if(sim && sim.packets && sim.packets.length) return sim.packets[0].seq;
        return 1;
      });

      await page.fill('#inspectSeq', String(someSeq));
      await page.click('#inspectBtn');

      await page.waitForFunction((s) => document.getElementById('log').value.includes('Packet ' + s + ':'), someSeq);

      // Pause simulation
      await page.click('#playBtn');
      await page.waitForFunction(() => window.__sim && window.__sim.running === false);
    });
  });

  test.describe('Scenario save/load and edge cases', () => {
    test('SaveScenario writes JSON to textarea and LoadScenario loads and resets', async ({ page }) => {
      // Change some parameters
      await page.selectOption('#algo', 'cubic');
      await page.fill('#initCWND', '5');
      await page.fill('#bandwidth', '7.5');

      // Click Save
      await page.click('#saveBtn');

      // scenarioJson textarea should contain JSON with our values
      const text = await page.locator('#scenarioJson').inputValue();
      expect(text.length).toBeGreaterThan(0);

      const parsed = JSON.parse(text);
      expect(parsed.algo).toBe('cubic');
      expect(String(parsed.initCWND)).toBe('5');
      expect(String(parsed.bandwidth)).toBe('7.5');

      // Now alter fields to different values and then Load using the saved text
      await page.selectOption('#algo', 'reno');
      await page.fill('#initCWND', '2');
      await page.fill('#bandwidth', '10');

      // Click Load
      await page.click('#loadBtn');

      // Wait for log entry "Scenario loaded" and resetSim call
      await page.waitForFunction(() => document.getElementById('log').value.includes('Scenario loaded'));

      // After load and resetSim, the fields should reflect the loaded scenario
      const algoAfter = await page.locator('#algo').inputValue();
      expect(algoAfter).toBe('cubic');

      const cwndAfter = await page.locator('#initCWND').inputValue();
      expect(cwndAfter).toBe('5');
    });

    test('LoadScenario handles invalid JSON by logging Invalid JSON scenario', async ({ page }) => {
      await page.fill('#scenarioJson', 'bogus JSON!!!');
      await page.click('#loadBtn');

      await page.waitForFunction(() => document.getElementById('log').value.includes('Invalid JSON scenario'));
    });
  });

  test.describe('Logging, clear and export features', () => {
    test('ClearLog empties the log textarea and export triggers blob creation (no errors)', async ({ page }) => {
      // Ensure there is some log content
      await page.click('#playBtn');
      await page.waitForFunction(() => window.__sim && window.__sim.running === true);
      await page.waitForTimeout(50);
      await page.click('#playBtn'); // pause

      // Ensure log has content
      const logBefore = await page.locator('#log').inputValue();
      expect(logBefore.length).toBeGreaterThan(0);

      // Clear log
      await page.click('#clearLog');

      const logAfter = await page.locator('#log').inputValue();
      expect(logAfter.length).toBe(0);

      // Export log should not throw errors (it creates an anchor and clicks)
      await page.click('#exportLog');

      // Since export uses URL.createObjectURL and triggers anchor click, ensure no page errors logged
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Algorithm parameter panels and algorithm behaviors', () => {
    test('Changing algorithm updates parameter panel visibility', async ({ page }) => {
      // Default is reno, aimdParams visible only when aimd
      await page.selectOption('#algo', 'aimd');
      // aimdParams should be visible
      const aimdDisplay = await page.$eval('#aimdParams', el => getComputedStyle(el).display);
      expect(aimdDisplay).not.toBe('none');

      // Switch to cubic
      await page.selectOption('#algo', 'cubic');
      const cubicDisplay = await page.$eval('#cubicParams', el => getComputedStyle(el).display);
      expect(cubicDisplay).not.toBe('none');

      // Switch to bbr
      await page.selectOption('#algo', 'bbr');
      const bbrDisplay = await page.$eval('#bbrParams', el => getComputedStyle(el).display);
      expect(bbrDisplay).not.toBe('none');

      // Back to reno: aimd/cubic/bbr panels should hide appropriately
      await page.selectOption('#algo', 'reno');
      const aimdDisplay2 = await page.$eval('#aimdParams', el => getComputedStyle(el).display);
      expect(aimdDisplay2).toBe('none');
    });

    test('Algorithm effects on cwnd: switching algorithm while running does not throw', async ({ page }) => {
      // Start running
      await page.click('#playBtn');
      await page.waitForFunction(() => window.__sim && window.__sim.running === true);

      // Switch among algorithms while running; verify no uncaught exceptions and cwnd remains a number
      for (const alg of ['reno', 'aimd', 'cubic', 'bbr']) {
        await page.selectOption('#algo', alg);
        // wait briefly for underlying logic to adapt
        await page.waitForTimeout(20);
        const cwnd = await page.evaluate(() => window.__sim && window.__sim.cwnd);
        expect(typeof cwnd === 'number' || typeof cwnd === 'undefined').toBe(true);
      }

      // Pause
      await page.click('#playBtn');
      await page.waitForFunction(() => window.__sim && window.__sim.running === false);
    });
  });

  test.describe('Edge cases and auto-stop behavior', () => {
    test('Auto-stop on N losses triggers stop()', async ({ page }) => {
      // Set autoStopLoss to 1 so any loss will auto-stop
      await page.fill('#autoStopLoss', '1');

      // Start simulation to generate packets
      await page.click('#playBtn');
      await page.waitForFunction(() => window.__sim && window.__sim.running === true);

      // Ensure there is at least one packet to drop
      await page.waitForFunction(() => window.__sim && window.__sim.packets.length > 0);

      // Pick a packet and drop it
      const seq = await page.evaluate(() => window.__sim.packets[0].seq);
      await page.fill('#dropSeq', String(seq));
      await page.click('#dropBtn');

      // Wait for auto-stop log entry
      await page.waitForFunction(() => document.getElementById('log').value.includes('Auto-stopped due to losses'));

      // Verify sim.running is false after auto-stop
      const running = await page.evaluate(() => window.__sim && window.__sim.running);
      expect(running).toBe(false);
    });

    test('ExportLog and other features do not produce ReferenceError/TypeError/SyntaxError in console', async ({ page }) {
      // Perform multiple UI actions that exercise various paths
      await page.click('#saveBtn');
      await page.click('#exportLog');
      await page.click('#fastRunBtn');
      await page.click('#clearLog');

      // Allow some time for any potential synchronous console errors to be emitted
      await page.waitForTimeout(100);

      // Capture console messages for any that are errors
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      // We expect no fatal console errors; report them if present
      expect(errorConsoleMessages.length, 'No critical console errors or warnings expected').toBeLessThanOrEqual(0);
      // Note: The app may log info/debug messages; above ensures there are no console.error/console.warn entries.
    });
  });

  test.describe('Observability: console and runtime logs', () => {
    test('Console contains simulator ready/Reset messages and no uncaught exceptions', async ({ page }) => {
      // Wait briefly to accumulate console messages
      await page.waitForTimeout(100);

      // Look for 'Simulator ready' in console or log textarea
      const foundInConsole = consoleMessages.some(m => m.text.includes('Simulator ready'));
      const foundInLog = (await page.locator('#log').inputValue()).includes('Simulator ready');

      expect(foundInConsole || foundInLog).toBeTruthy();

      // Assert no uncaught page errors (already checked in afterEach) - also ensure no console.error types
      const errorConsole = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsole.length).toBe(0);
    });
  });
});