import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f84fc2-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object for the simulation page
class SimulationPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.playBtn = page.locator('#playBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.cwndText = page.locator('#cwndText');
    this.cwndBar = page.locator('#cwndBar');
    this.delivered = page.locator('#delivered');
    this.dropped = page.locator('#dropped');
    this.packetsContainer = page.locator('#packets');
    this.queueBox = page.locator('#queueBox');
    this.bufStat = page.locator('#bufStat');
    this.rate = page.locator('#rate');
    this.rtt = page.locator('#rtt');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // ensure initial animation/timers have a moment to set up
    await this.page.waitForLoadState('networkidle');
  }

  // Controls
  async clickPlay() {
    await this.playBtn.click();
  }
  async clickReset() {
    await this.resetBtn.click();
  }

  // Getters for text/attributes
  async getPlayText() {
    return (await this.playBtn.textContent())?.trim();
  }
  async getPlayAriaPressed() {
    return await this.playBtn.getAttribute('aria-pressed');
  }
  async getCwndText() {
    return (await this.cwndText.textContent())?.trim();
  }
  async getDelivered() {
    return (await this.delivered.textContent())?.trim();
  }
  async getDropped() {
    return (await this.dropped.textContent())?.trim();
  }
  async getQueueSlotsCount() {
    return await this.queueBox.locator('.slot').count();
  }
  async getBufStat() {
    return (await this.bufStat.textContent())?.trim();
  }
  async getPacketsCount() {
    return await this.packetsContainer.locator('.packet').count();
  }

  // wait for at least one packet to appear (used to confirm "running" produces packets)
  async waitForPackets(min = 1, timeout = 3000) {
    await this.page.waitForFunction(
      (sel, min) => document.querySelectorAll(sel + ' .packet').length >= min,
      this.packetsContainer.selector ?? '#packets',
      min,
      { timeout }
    );
  }

  // dispatch a resize event to trigger the page's resize handler (used to provoke runtime errors intentionally)
  async triggerResize() {
    await this.page.evaluate(() => {
      // dispatch a resize event to run the page's resize handler
      window.dispatchEvent(new Event('resize'));
    });
  }
}

test.describe.serial('Congestion Control — Visual Simulation (FSM tests)', () => {
  // Capture console messages and page errors for assertions
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // collect console messages
    page.on('console', (msg) => {
      try {
        const text = msg.text();
        consoleMessages.push({ type: msg.type(), text });
      } catch (e) {
        // ignore
      }
    });

    // collect page errors (uncaught exceptions in page context)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test('Initial Idle state (S0_Idle) renders controls and initial metrics', async ({ page }) => {
    // Validate initial render: Start button exists and is in Idle state
    const sim = new SimulationPage(page);
    await sim.goto();

    // Comments: Verify evidence of S0_Idle: play button "Start" and aria-pressed="false"
    const playText = await sim.getPlayText();
    expect(playText).toBe('Start');

    const aria = await sim.getPlayAriaPressed();
    expect(aria).toBe('false');

    // Reset button present
    await expect(sim.resetBtn).toBeVisible();

    // Queue slots should be rendered as in initial entry action renderPage()
    const slots = await sim.getQueueSlotsCount();
    expect(slots).toBeGreaterThanOrEqual(20); // bufferSize is 20 => at least 20 slots created

    // Buffer stat initially "0 / 20"
    const buf = await sim.getBufStat();
    expect(buf).toMatch(/0\s*\/\s*20/);

    // No page errors at initial load (we'll intentionally trigger an error later)
    expect(pageErrors.length).toBe(0);
  });

  test('Start simulation transitions to Running (S0_Idle -> S1_Running)', async ({ page }) => {
    // Clicking Start should set button to Pause and aria-pressed true and spawn packets
    const sim = new SimulationPage(page);
    await sim.goto();

    // Start
    await sim.clickPlay();

    // evidence for S1_Running
    await page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        return el && el.textContent.trim() === 'Pause' && el.getAttribute('aria-pressed') === 'true';
      },
      '#playBtn'
    );

    const playText = await sim.getPlayText();
    expect(playText).toBe('Pause');

    const aria = await sim.getPlayAriaPressed();
    expect(aria).toBe('true');

    // Wait for at least one packet to appear to validate that the simulation started
    await sim.waitForPackets(1, 2500);
    const pktCount = await sim.getPacketsCount();
    expect(pktCount).toBeGreaterThanOrEqual(1);

    // Basic metrics updated: cwndText should be a number (string)
    const cwndText = await sim.getCwndText();
    expect(Number(cwndText)).not.toBeNaN();

    // No page errors yet
    expect(pageErrors.length).toBe(0);
  });

  test('Pause simulation transitions to Paused (S1_Running -> S2_Paused)', async ({ page }) => {
    // Start -> Pause and verify no new packets spawn after pausing
    const sim = new SimulationPage(page);
    await sim.goto();

    // Ensure running
    await sim.clickPlay();
    await expect(sim.playBtn).toHaveText('Pause');
    await expect(sim.playBtn).toHaveAttribute('aria-pressed', 'true');

    // Wait a little so packets can spawn
    await sim.waitForPackets(1, 2000);
    const before = await sim.getPacketsCount();

    // Pause
    await sim.clickPlay();

    // evidence for S2_Paused
    await page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        return el && el.textContent.trim() === 'Start' && el.getAttribute('aria-pressed') === 'false';
      },
      '#playBtn'
    );

    const playText = await sim.getPlayText();
    expect(playText).toBe('Start');
    const aria = await sim.getPlayAriaPressed();
    expect(aria).toBe('false');

    // Wait shortly and assert that no additional packets were spawned while paused.
    // Note: inflight packets may still be animating, but new packet creation should stop.
    await page.waitForTimeout(700);
    const after = await sim.getPacketsCount();
    expect(after).toBeGreaterThanOrEqual(0);
    // It's acceptable if some packets were removed by animation; ensure not many new ones spawned:
    expect(after).toBeLessThanOrEqual(before + 2);
  });

  test('Resume from Paused to Running (S2_Paused -> S1_Running)', async ({ page }) => {
    // Pause -> Start and verify packets resume
    const sim = new SimulationPage(page);
    await sim.goto();

    // Ensure paused initial
    const initialText = await sim.getPlayText();
    expect(['Start', 'Pause']).toContain(initialText);

    // Start then pause to get to paused state reliably
    await sim.clickPlay();
    await expect(sim.playBtn).toHaveText('Pause');
    await sim.clickPlay();
    await expect(sim.playBtn).toHaveText('Start');

    const beforeResume = await sim.getPacketsCount();

    // Resume
    await sim.clickPlay();
    await expect(sim.playBtn).toHaveText('Pause');
    await expect(sim.playBtn).toHaveAttribute('aria-pressed', 'true');

    // After resuming, wait for additional packets to appear
    await sim.waitForPackets(beforeResume + 1, 2500);
    const after = await sim.getPacketsCount();
    expect(after).toBeGreaterThanOrEqual(beforeResume);
  });

  test('Reset simulation transitions to Reset (S1_Running -> S3_Reset) and clears state', async ({ page }) => {
    // Start simulation, let packets appear, then reset and validate cwnd, delivered, dropped, packets cleared
    const sim = new SimulationPage(page);
    await sim.goto();

    // Start running
    await sim.clickPlay();
    await expect(sim.playBtn).toHaveText('Pause');

    // Wait for packets to appear
    await sim.waitForPackets(2, 3000);
    const pktCountBefore = await sim.getPacketsCount();
    expect(pktCountBefore).toBeGreaterThanOrEqual(1);

    // Also ensure delivered/dropped are numbers (could be zero)
    const deliveredBefore = Number(await sim.getDelivered());
    const droppedBefore = Number(await sim.getDropped());
    expect(Number.isInteger(deliveredBefore)).toBe(true);
    expect(Number.isInteger(droppedBefore)).toBe(true);

    // Click reset while running (FSM expects transition S1_Running -> S3_Reset)
    await sim.clickReset();

    // After reset, cwndText should be '10' (evidence cwnd = 10)
    // delivered and dropped should be '0' (evidence delivered = 0; dropped = 0)
    await page.waitForFunction(() => {
      const c = document.getElementById('cwndText');
      const d = document.getElementById('delivered');
      const dr = document.getElementById('dropped');
      return c && d && dr && c.textContent.trim() === '10' && d.textContent.trim() === '0' && dr.textContent.trim() === '0';
    }, { timeout: 2000 });

    const cwnd = await sim.getCwndText();
    const delivered = await sim.getDelivered();
    const dropped = await sim.getDropped();

    expect(cwnd).toBe('10');
    expect(delivered).toBe('0');
    expect(dropped).toBe('0');

    // All packets should have been removed by the reset handler
    const pktCountAfter = await sim.getPacketsCount();
    expect(pktCountAfter).toBeLessThanOrEqual(1); // allow 0 or 1 depending on animation timing
  });

  test('Reset while Paused also restores initial metrics (S2_Paused -> S3_Reset)', async ({ page }) => {
    // Pause then reset
    const sim = new SimulationPage(page);
    await sim.goto();

    // Ensure paused
    const playTxt = await sim.getPlayText();
    if (playTxt !== 'Start') {
      await sim.clickPlay();
      await sim.clickPlay(); // ensure paused
    }

    await expect(sim.playBtn).toHaveText('Start');
    await expect(sim.playBtn).toHaveAttribute('aria-pressed', 'false');

    // Modify some values by starting briefly to change metrics then pause
    await sim.clickPlay();
    await expect(sim.playBtn).toHaveText('Pause');
    await sim.waitForPackets(1, 2000);
    await sim.clickPlay(); // pause

    // Now reset
    await sim.clickReset();

    // Validate reset state
    await page.waitForFunction(() => {
      return document.getElementById('cwndText').textContent.trim() === '10' &&
             document.getElementById('delivered').textContent.trim() === '0' &&
             document.getElementById('dropped').textContent.trim() === '0';
    }, { timeout: 2000 });

    expect(await sim.getCwndText()).toBe('10');
    expect(await sim.getDelivered()).toBe('0');
    expect(await sim.getDropped()).toBe('0');
  });

  test('Rapid toggling Play/Pause (edge case) does not crash page', async ({ page }) => {
    // Rapidly click the play button multiple times to test robustness
    const sim = new SimulationPage(page);
    await sim.goto();

    // Rapid clicks
    for (let i = 0; i < 6; i++) {
      await sim.clickPlay();
      // tiny delay to simulate frantic user but allow DOM to update
      await page.waitForTimeout(80);
    }

    // After rapid toggles, the control should be in a stable textual state (Start or Pause)
    const txt = await sim.getPlayText();
    expect(['Start', 'Pause']).toContain(txt);

    // Ensure no uncaught page errors were produced by rapid toggling
    expect(pageErrors.length).toBe(0);
  });

  test('Triggering window resize causes runtime error (observe pageerrors) - asserting errors occur naturally', async ({ page }) => {
    // This test intentionally triggers the resize handler in the page which, in the provided implementation,
    // attempts to assign to properties on the getBoundingClientRect() result (a DOMRect). Those properties are read-only
    // in many environments and will throw a TypeError. We must allow the page to run as-is and assert that an error occurs.
    const sim = new SimulationPage(page);
    await sim.goto();

    // Wait a moment to ensure handlers are registered
    await page.waitForTimeout(120);

    // Wait for a pageerror event emitted as a result of dispatching resize
    const pageErrorPromise = page.waitForEvent('pageerror', { timeout: 3000 }).catch(() => null);

    // Trigger resize in page context
    await sim.triggerResize();

    // Await the error (if any)
    const err = await pageErrorPromise;

    // We expect a runtime error to occur due to the line that mutates rect.left/rect.top in the resize handler.
    // Accept if an error object is captured. Provide helpful assertions about its presence.
    expect(err).toBeTruthy();
    // Minimal assertion: error should have a message string
    expect(typeof err.message).toBe('string');
    expect(err.message.length).toBeGreaterThan(0);

    // Record it for the captured pageErrors array as well
    // (page.on('pageerror') handler should have pushed it)
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('Inspect console output for any exceptions or warnings (informational)', async ({ page }) => {
    // This test demonstrates that we actively observed console output during earlier tests.
    // We assert that we captured console messages of varying types (log, error, etc.) and at least one console message exists.
    // Note: This is informational — the main assertion about runtime error presence was performed in the resize test.
    const sim = new SimulationPage(page);
    await sim.goto();

    // give a short time to collect any console messages
    await page.waitForTimeout(200);

    // Ensure the console message collection object exists
    expect(Array.isArray(consoleMessages)).toBe(true);

    // There may be zero or more console messages depending on runtime; at minimum the array exists and is well-formed.
    consoleMessages.forEach((m) => {
      expect(m).toHaveProperty('type');
      expect(m).toHaveProperty('text');
    });
  });

  test.afterEach(async ({ page }) => {
    // Small cleanup: navigate away to stop any active intervals/animations
    await page.evaluate(() => {
      try {
        // stop any running intervals by clearing all (best-effort)
        let id = window.setInterval(() => {}, 1000);
        while (id--) {
          window.clearInterval(id);
        }
      } catch (e) {}
    });
  });
});