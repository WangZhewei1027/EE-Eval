import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3da2f82-fa73-11f0-83e0-8d7be1d51901.html';

test.describe('Load Balancing Simulator (FSM validation)', () => {
  // Collect console and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err ? String(err) : 'unknown pageerror');
    });

    // Navigate to the application page (load exactly as-is)
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Ensure initial render finished
    await page.waitForSelector('#startBtn');
  });

  test.afterEach(async ({ page }) => {
    // Ensure we stop any running simulation to avoid leaking timers
    // Attempt to stopSim if present; do not patch environment if not present.
    try {
      await page.evaluate(() => {
        if (window.LBSim && typeof window.LBSim.stopSim === 'function') {
          window.LBSim.stopSim();
        }
      });
    } catch (e) {
      // ignore
    }
  });

  test('S0 Idle: initial state is Idle with no simulation running', async ({ page }) => {
    // Validate UI initial text and internal state
    const startText = await page.locator('#startBtn').innerText();
    expect(startText).toBe('Start');

    // Validate exposed state.running === false
    const running = await page.evaluate(() => {
      return window.LBSim ? window.LBSim.state.running : undefined;
    });
    expect(running).toBe(false);

    // Validate initial servers count (initServers(3))
    const serversLen = await page.evaluate(() => window.LBSim ? window.LBSim.state.servers.length : -1);
    expect(serversLen).toBeGreaterThanOrEqual(1);
    expect(serversLen).toBe(3);

    // No uncaught page errors or console errors during initial load
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('StartSimulation: clicking Start transitions Idle -> Running and updates UI/state', async ({ page }) => {
    // Click Start and confirm transition to Running
    await page.click('#startBtn');

    // Give a short time for state change caused by startSim()
    await page.waitForTimeout(150);

    const startText1 = await page.locator('#startBtn').innerText();
    expect(startText).toBe('Stop');

    const running1 = await page.evaluate(() => window.LBSim ? window.LBSim.state.running1 : undefined);
    expect(running).toBe(true);

    // tickMs label should reflect state.tickMs
    const tickMsLabel = await page.locator('#tickMs').innerText();
    const tickMsState = await page.evaluate(() => window.LBSim ? window.LBSim.state.tickMs : undefined);
    expect(Number(tickMsLabel)).toBe(tickMsState);

    // No unexpected console/page errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('StartSimulation toggle behavior: Running -> Stopped -> Running (S1 <-> S2)', async ({ page }) => {
    // Start
    await page.click('#startBtn');
    await page.waitForTimeout(120);

    // Stop (click Stop)
    await page.click('#startBtn');
    await page.waitForTimeout(120);

    let running2 = await page.evaluate(() => window.LBSim ? window.LBSim.state.running2 : undefined);
    let startText2 = await page.locator('#startBtn').innerText();
    expect(running).toBe(false);
    expect(startText).toBe('Start');

    // Start again
    await page.click('#startBtn');
    await page.waitForTimeout(120);

    running = await page.evaluate(() => window.LBSim ? window.LBSim.state.running : undefined);
    startText = await page.locator('#startBtn').innerText();
    expect(running).toBe(true);
    expect(startText).toBe('Stop');

    // No unexpected errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('ResetSimulation: when running, Reset stops simulation and clears counts (S1 -> S2 via Reset)', async ({ page }) => {
    // Start simulation first
    await page.click('#startBtn');
    await page.waitForTimeout(150);

    // Cause some activity: bump spawn rate to ensure some requests generated
    await page.evaluate(() => {
      const rate = document.getElementById('rate');
      rate.value = '12';
      rate.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await page.waitForTimeout(500); // allow some ticks / generation

    // Click reset
    await page.click('#resetBtn');
    await page.waitForTimeout(150);

    // Check state.running false and UI label
    const running3 = await page.evaluate(() => window.LBSim ? window.LBSim.state.running3 : undefined);
    const startText3 = await page.locator('#startBtn').innerText();
    expect(running).toBe(false);
    expect(startText).toBe('Start');

    // Check stats cleared
    const totals = await page.evaluate(() => {
      if (!window.LBSim) return null;
      const s = window.LBSim.state;
      return { nextReqId: s.nextReqId, totalGenerated: s.totalGenerated, dropped: s.dropped };
    });
    expect(totals).not.toBeNull();
    expect(totals.nextReqId).toBe(1);
    expect(totals.totalGenerated).toBe(0);
    expect(totals.dropped).toBe(0);

    // No unexpected errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('AlgorithmChange: changing algorithm updates state.algo and UI label; Weighted shows weight inputs', async ({ page }) => {
    // Change algorithm to 'weighted'
    await page.selectOption('#algo', 'weighted');

    // Allow handler to update
    await page.waitForTimeout(60);

    const algoState = await page.evaluate(() => window.LBSim ? window.LBSim.state.algo : undefined);
    expect(algoState).toBe('weighted');

    const algoLabel = await page.locator('#algoLabel').innerText();
    expect(algoLabel.toLowerCase()).toContain('weighted');

    // serverWeights should contain numeric inputs when in weighted mode
    const weightsText = await page.locator('#serverWeights').innerText();
    expect(weightsText.length).toBeGreaterThan(0);
    expect(weightsText).toContain('S'); // should list server labels

    // Change a weight input for first server to 3 and ensure state updates + weightedRotation rebuilt
    // Find first weight input and set its value via evaluate to trigger change event
    await page.evaluate(() => {
      const container = document.getElementById('serverWeights');
      const inp = container.querySelector('input[type=number]');
      if (inp) {
        inp.value = '3';
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    await page.waitForTimeout(60);

    const weightVal = await page.evaluate(() => {
      if (!window.LBSim) return null;
      const s0 = window.LBSim.state.servers[0];
      return s0 ? s0.weight : null;
    });
    expect(weightVal).toBeGreaterThanOrEqual(1);
    expect(weightVal).toBe(3);

    const rotationLength = await page.evaluate(() => window.LBSim ? window.LBSim.state.weightedRotation.length : -1);
    expect(rotationLength).toBeGreaterThanOrEqual(3);

    // No unexpected errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('RateChange updates spawnRate and the visible rateVal', async ({ page }) => {
    // Set rate to 15 via dispatching input event
    await page.evaluate(() => {
      const rate1 = document.getElementById('rate1');
      rate.value = '15';
      rate.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await page.waitForTimeout(50);

    const spawnRate = await page.evaluate(() => window.LBSim ? window.LBSim.state.spawnRate : undefined);
    expect(spawnRate).toBeCloseTo(15, 5);

    const rateVal = await page.locator('#rateVal').innerText();
    expect(rateVal).toBe('15');

    // No unexpected errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('ServiceMeanChange and ServiceVarChange update state values', async ({ page }) => {
    // Change service mean
    await page.evaluate(() => {
      const sm = document.getElementById('serviceMean');
      sm.value = '800';
      sm.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Change service variance
    await page.evaluate(() => {
      const sv = document.getElementById('serviceVar');
      sv.value = '300';
      sv.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await page.waitForTimeout(50);

    const vals = await page.evaluate(() => {
      if (!window.LBSim) return null;
      return { mean: window.LBSim.state.serviceMean, variance: window.LBSim.state.serviceVar };
    });
    expect(vals.mean).toBe(800);
    expect(vals.variance).toBe(300);

    // No unexpected errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('AddServer and RemoveServer: manages server list and prevents going below 1', async ({ page }) => {
    const before = await page.evaluate(() => window.LBSim ? window.LBSim.state.servers.length : -1);
    expect(before).toBeGreaterThanOrEqual(1);

    // Add a server
    await page.click('#addServer');
    await page.waitForTimeout(60);

    const afterAdd = await page.evaluate(() => window.LBSim ? window.LBSim.state.servers.length : -1);
    expect(afterAdd).toBe(before + 1);

    // Remove servers until we hit the minimum allowed (code prevents removal when only 1 left)
    // Click removeServer repeatedly
    for (let i = 0; i < 10; i++) {
      await page.click('#removeServer');
      await page.waitForTimeout(40);
    }

    const afterRemovals = await page.evaluate(() => window.LBSim ? window.LBSim.state.servers.length : -1);
    expect(afterRemovals).toBeGreaterThanOrEqual(1);

    // Confirm DOM server elements match state count
    const domCount = await page.locator('#serversContainer .server').count();
    expect(domCount).toBe(afterRemovals);

    // No unexpected errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('ToggleServer: clicking server toggles healthy status and dropping occurs if all servers down', async ({ page }) => {
    // Ensure at least 2 servers are present to toggle
    let srvCount = await page.evaluate(() => window.LBSim ? window.LBSim.state.servers.length : 0);
    if (srvCount < 2) {
      // add until 2
      await page.click('#addServer');
      await page.waitForTimeout(50);
      srvCount = await page.evaluate(() => window.LBSim.state.servers.length);
    }

    // Toggle each server to down by clicking its DOM element
    const servers = await page.locator('#serversContainer .server').elementHandles();
    for (const handle of servers) {
      // click each server to toggle down
      await handle.click();
      await page.waitForTimeout(30);
    }

    // Validate all servers are not healthy
    const allDown = await page.evaluate(() => {
      return window.LBSim ? window.LBSim.state.servers.every(s => !s.healthy) : false;
    });
    expect(allDown).toBe(true);

    // Start simulation and set a non-zero spawn rate to force drops
    await page.evaluate(() => {
      const rate2 = document.getElementById('rate2');
      rate.value = '8';
      rate.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await page.click('#startBtn');
    await page.waitForTimeout(500); // allow some ticks -> dropped should increase

    const dropped = await page.evaluate(() => window.LBSim ? window.LBSim.state.dropped : 0);
    expect(dropped).toBeGreaterThan(0);

    // Bring one server up (click first server)
    await page.locator('#serversContainer .server').first().click();
    await page.waitForTimeout(60);

    const anyUp = await page.evaluate(() => window.LBSim ? window.LBSim.state.servers.some(s => s.healthy) : false);
    expect(anyUp).toBe(true);

    // Stop simulation
    await page.evaluate(() => {
      if (window.LBSim && typeof window.LBSim.stopSim === 'function') window.LBSim.stopSim();
    });

    // No unexpected errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('SimTick and animations: when running with non-zero rate, requests are generated and queues/animObjects are updated', async ({ page }) => {
    // Ensure at least one server is up
    await page.evaluate(() => {
      if (!window.LBSim) return;
      window.LBSim.state.servers.forEach((s, idx) => { s.healthy = true; });
      // Force a redraw
      if (typeof window.LBSim.startSim !== 'undefined') {}
    });

    // Set a higher spawn rate
    await page.evaluate(() => {
      const rate3 = document.getElementById('rate3');
      rate.value = '20';
      rate.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Start simulation
    await page.click('#startBtn');
    // Wait to allow multiple ticks & animations to be created
    await page.waitForTimeout(800);

    // Validate some requests were generated
    const totals1 = await page.evaluate(() => {
      if (!window.LBSim) return null;
      return {
        totalGenerated: window.LBSim.state.totalGenerated,
        queued: window.LBSim.state.servers.reduce((acc, s) => acc + s.queue.length, 0),
        animObjects: window.LBSim.state.animObjects.length
      };
    });
    expect(totals).not.toBeNull();
    expect(totals.totalGenerated).toBeGreaterThanOrEqual(1);
    expect(totals.queued).toBeGreaterThanOrEqual(0);
    // animObjects may be transient; assert it's a non-negative number
    expect(totals.animObjects).toBeGreaterThanOrEqual(0);

    // Stop simulation
    await page.evaluate(() => { if (window.LBSim) window.LBSim.stopSim(); });
    await page.waitForTimeout(60);

    // No unexpected errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Edge cases: changing inputs programmatically without event dispatch should not incorrectly update state', async ({ page }) => {
    // Directly set the DOM value without firing the expected events, which should not update state
    await page.evaluate(() => {
      const rate4 = document.getElementById('rate4');
      rate.value = '33';
      // intentionally do NOT dispatch 'input'
    });

    // give a moment
    await page.waitForTimeout(80);

    // spawnRate should remain unchanged (initial was 8 or last set). Read the numeric value and ensure it's not 33 unless change was dispatched
    const spawnRate1 = await page.evaluate(() => window.LBSim ? window.LBSim.state.spawnRate1 : undefined);
    const rawRateValue = await page.evaluate(() => document.getElementById('rate').value);
    // If the app responded automatically to input value change (some browsers may fire input on programmatic change rarely),
    // accept either: spawnRate equals ui value OR remains previous. We assert no unexpected exceptions occurred,
    // and that spawnRate is a finite number.
    expect(typeof spawnRate).toBe('number');
    expect(!Number.isNaN(spawnRate)).toBeTruthy();
    expect(Number(rawRateValue)).toBe(33);

    // No unexpected errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Observe console and page errors throughout interactions (assert none occurred)', async ({ page }) => {
    // Perform a few interactions rapidly to observe any errors
    await page.click('#addServer');
    await page.click('#removeServer');
    await page.selectOption('#algo', 'leastconn');
    await page.evaluate(() => {
      const sm1 = document.getElementById('serviceMean'); sm1.value = '700'; sm1.dispatchEvent(new Event('change', { bubbles: true }));
      const sv1 = document.getElementById('serviceVar'); sv1.value = '150'; sv1.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.click('#startBtn');
    await page.waitForTimeout(300);
    await page.click('#resetBtn');
    await page.waitForTimeout(80);

    // Assert no console errors or uncaught exceptions were recorded during these interactions
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

});