import { test, expect } from '@playwright/test';

// Test file: 72ac7653-fa78-11f0-812d-c9788050701f.spec.js
// Application URL:
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ac7653-fa78-11f0-812d-c9788050701f.html';

// Page object to encapsulate common interactions and queries
class CongestionApp {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Collect console messages and page errors for assertions
    this.page.on('console', (msg) => {
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait for main controls to be available
    await this.page.waitForSelector('#startBtn');
    await this.page.waitForSelector('#congestionBtn');
  }

  async startSimulation() {
    await this.page.click('#startBtn');
  }

  async stopSimulation() {
    await this.page.click('#startBtn');
  }

  async toggleCongestion() {
    await this.page.click('#congestionBtn');
  }

  async getStartBtnText() {
    return this.page.locator('#startBtn').innerText();
  }

  async getCongestionBtnText() {
    return this.page.locator('#congestionBtn').innerText();
  }

  async getParticleCount() {
    return this.page.evaluate(() => document.getElementById('particleLayer').children.length);
  }

  async getPacketCount() {
    return this.page.evaluate(() => document.querySelectorAll('.data-packet').length);
  }

  async getMeterWidth(id) {
    return this.page.evaluate((meterId) => {
      const el = document.getElementById(meterId);
      if (!el) return null;
      // computed width as percentage (style.width returns something like "70%")
      const width = window.getComputedStyle(el).width;
      // We prefer reading style.width which the script sets directly (e.g., '30%')
      const styleWidth = el.style.width;
      return { styleWidth, computedWidthPx: width };
    }, id);
  }

  async isCongestionIndicatorVisible() {
    // Check opacity style of congestionIndicator and its warning child
    return this.page.evaluate(() => {
      const indicator = document.getElementById('congestionIndicator');
      const warning = indicator ? indicator.querySelector('.congestion-warning') : null;
      return {
        indicatorOpacity: indicator ? window.getComputedStyle(indicator).opacity : null,
        warningOpacity: warning ? window.getComputedStyle(warning).opacity : null
      };
    });
  }

  // Convenience: wait for at least one packet to appear within timeout
  async waitForPacket(timeout = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const count = await this.getPacketCount();
      if (count > 0) return;
      await this.page.waitForTimeout(100);
    }
    throw new Error('Timed out waiting for a data-packet to appear');
  }

  // Retrieve collected console errors of type 'error'
  getConsoleErrors() {
    return this.consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
  }

  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('Congestion Control Visualization - FSM and UI tests', () => {
  // Each test gets a fresh page and App instance
  let app;

  test.beforeEach(async ({ page }) => {
    app = new CongestionApp(page);
    await app.goto();
  });

  test.afterEach(async () => {
    // Basic sanity: ensure no unexpected console errors or page errors were emitted during the test
    const consoleErrors = app.getConsoleErrors();
    const pageErrors = app.getPageErrors();

    // Attach the messages to assertion failures for easier debugging
    expect(consoleErrors, `Console errors: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
    expect(pageErrors, `Page errors: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
  });

  test.describe('Initial State (S0_Idle)', () => {
    test('Initial render shows Start Simulation and Induce Congestion buttons and idle meters', async () => {
      // Verify the two main control buttons exist and have expected initial labels
      await expect(app.page.locator('#startBtn')).toHaveText('Start Simulation');
      await expect(app.page.locator('#congestionBtn')).toHaveText('Induce Congestion');

      // Verify meters are present and initially zero-width (idle state)
      const slow = await app.getMeterWidth('slowStartMeter');
      const avoid = await app.getMeterWidth('avoidanceMeter');
      const resp = await app.getMeterWidth('responseMeter');

      // The inline style width should be empty string initially; the script sets to '0%' on stop.
      // We ensure they aren't showing positive style widths at initial render.
      expect(slow.styleWidth === '' || slow.styleWidth === '0%').toBeTruthy();
      expect(avoid.styleWidth === '' || avoid.styleWidth === '0%').toBeTruthy();
      expect(resp.styleWidth === '' || resp.styleWidth === '0%').toBeTruthy();

      // Congestion indicator should be hidden initially (opacity 0)
      const congestionVis = await app.isCongestionIndicatorVisible();
      expect(congestionVis.indicatorOpacity).toBeDefined();
      expect(parseFloat(congestionVis.indicatorOpacity)).toBeLessThanOrEqual(0.01);
      expect(parseFloat(congestionVis.warningOpacity)).toBeLessThanOrEqual(0.01);
    });
  });

  test.describe('Simulation Start/Stop (S0 <-> S1)', () => {
    test('Starting the simulation transitions to Simulating (S1) and creates packets and updates meters', async () => {
      // Start the simulation (StartSimulation event)
      await app.startSimulation();

      // startBtn should change to 'Stop Simulation'
      await expect(app.page.locator('#startBtn')).toHaveText('Stop Simulation');

      // Wait a short while for the script to spawn packets and update meters
      await app.waitForPacket(5000); // wait up to 5s for a packet

      // At least one packet should be present
      const packetCount = await app.getPacketCount();
      expect(packetCount).toBeGreaterThan(0);

      // Meters should show non-zero style widths (script updates them via style.width)
      const slow = await app.getMeterWidth('slowStartMeter');
      const avoid = await app.getMeterWidth('avoidanceMeter');
      const resp = await app.getMeterWidth('responseMeter');

      // The script uses numeric percentages, we verify styleWidth is set and is not '0%'
      expect(slow.styleWidth && slow.styleWidth !== '0%').toBeTruthy();
      expect(avoid.styleWidth && avoid.styleWidth !== '0%').toBeTruthy();
      expect(resp.styleWidth && resp.styleWidth !== '0%').toBeTruthy();

      // Stop the simulation (toggle)
      await app.stopSimulation();

      // startBtn should revert to 'Start Simulation'
      await expect(app.page.locator('#startBtn')).toHaveText('Start Simulation');

      // Meters should be reset to '0%' per implementation when stopping
      const slowAfterStop = await app.getMeterWidth('slowStartMeter');
      const avoidAfterStop = await app.getMeterWidth('avoidanceMeter');
      const respAfterStop = await app.getMeterWidth('responseMeter');

      expect(slowAfterStop.styleWidth).toBe('0%');
      expect(avoidAfterStop.styleWidth).toBe('0%');
      expect(respAfterStop.styleWidth).toBe('0%');

      // Ensure that no immediate new packets are being created after stopping; give a small grace time
      const packetCountAfterStop = await app.getPacketCount();
      await app.page.waitForTimeout(600);
      const packetCountAfterWait = await app.getPacketCount();
      // No guaranteed determinism on removal timing, but there should be no new packets created.
      // So count after wait should be <= countAfterStop + some margin; we'll assert not increasing significantly.
      expect(packetCountAfterWait).toBeLessThanOrEqual(packetCountAfterStop + 2);
    });

    test('Rapidly toggling start/stop does not throw runtime errors (edge case)', async () => {
      // Rapidly click start and stop multiple times to exercise edge cases
      for (let i = 0; i < 5; i++) {
        await app.page.click('#startBtn');
        // small delay between toggles
        await app.page.waitForTimeout(100);
      }

      // Ensure the button text is in a valid state (either Start or Stop)
      const startText = await app.getStartBtnText();
      expect(['Start Simulation', 'Stop Simulation']).toContain(startText);

      // Validate no page errors or console errors were emitted (checked in afterEach)
    });
  });

  test.describe('Congestion Toggle (S1 <-> S2 and S0 interaction)', () => {
    test('Inducing congestion while simulating transitions to CongestionActive (S2) and updates UI', async () => {
      // Ensure simulation is running first
      await app.startSimulation();
      await expect(app.page.locator('#startBtn')).toHaveText('Stop Simulation');

      // Record particle count before congestion
      const particlesBefore = await app.getParticleCount();

      // Induce congestion
      await app.toggleCongestion();

      // congestionBtn text should change to 'Clear Congestion'
      await expect(app.page.locator('#congestionBtn')).toHaveText('Clear Congestion');

      // Congestion indicator and warning should become visible (opacity approximately 1)
      const congestionVis = await app.isCongestionIndicatorVisible();
      expect(parseFloat(congestionVis.indicatorOpacity)).toBeGreaterThan(0.5);
      expect(parseFloat(congestionVis.warningOpacity)).toBeGreaterThan(0.5);

      // More particles should have been added (script adds 20 on congestion activation)
      // Give a small delay for particles to be appended
      await app.page.waitForTimeout(200);
      const particlesAfter = await app.getParticleCount();
      expect(particlesAfter).toBeGreaterThanOrEqual(particlesBefore + 10); // allow some variance

      // Response meter should reflect congestion (the script uses congestionActive to alter responseValue)
      const responseDuringCongestion = await app.getMeterWidth('responseMeter');
      expect(responseDuringCongestion.styleWidth).toBeDefined();

      // Clear congestion (S2 -> S1 via InduceCongestion)
      await app.toggleCongestion();

      // congestionBtn text should revert
      await expect(app.page.locator('#congestionBtn')).toHaveText('Induce Congestion');

      // Indicator should hide again
      const congestionClearedVis = await app.isCongestionIndicatorVisible();
      expect(parseFloat(congestionClearedVis.indicatorOpacity)).toBeLessThanOrEqual(0.01);
      expect(parseFloat(congestionClearedVis.warningOpacity)).toBeLessThanOrEqual(0.01);

      // Stop simulation to clean up
      await app.stopSimulation();
    });

    test('Toggling congestion while NOT simulating toggles UI indicator (edge case from S0)', async () => {
      // Ensure we're in idle
      await expect(app.page.locator('#startBtn')).toHaveText('Start Simulation');

      // Toggle congestion without simulation running
      await app.toggleCongestion();

      // Should change text and show indicator even if not simulating
      await expect(app.page.locator('#congestionBtn')).toHaveText('Clear Congestion');

      const vis = await app.isCongestionIndicatorVisible();
      expect(parseFloat(vis.indicatorOpacity)).toBeGreaterThan(0.5);

      // Toggle back
      await app.toggleCongestion();
      await expect(app.page.locator('#congestionBtn')).toHaveText('Induce Congestion');

      const vis2 = await app.isCongestionIndicatorVisible();
      expect(parseFloat(vis2.indicatorOpacity)).toBeLessThanOrEqual(0.01);
    });

    test('Rapidly toggling congestion does not cause page errors (edge case)', async () => {
      // Toggle congestion several times rapidly
      for (let i = 0; i < 6; i++) {
        await app.page.click('#congestionBtn');
        await app.page.waitForTimeout(80);
      }

      // Final text should be one of the two expected labels
      const congestionText = await app.getCongestionBtnText();
      expect(['Induce Congestion', 'Clear Congestion']).toContain(congestionText);

      // No page errors or console errors emitted (checked in afterEach)
    });
  });

  test.describe('FSM Transition Sequence Tests', () => {
    test('Complete FSM sequence: Idle -> Simulating -> CongestionActive -> Simulating -> Idle', async () => {
      // Start from Idle
      await expect(app.page.locator('#startBtn')).toHaveText('Start Simulation');

      // Idle -> Simulating
      await app.startSimulation();
      await expect(app.page.locator('#startBtn')).toHaveText('Stop Simulation');

      // Simulating -> CongestionActive
      await app.toggleCongestion();
      await expect(app.page.locator('#congestionBtn')).toHaveText('Clear Congestion');
      let vis = await app.isCongestionIndicatorVisible();
      expect(parseFloat(vis.indicatorOpacity)).toBeGreaterThan(0.5);

      // CongestionActive -> Simulating (clear congestion)
      await app.toggleCongestion();
      await expect(app.page.locator('#congestionBtn')).toHaveText('Induce Congestion');
      vis = await app.isCongestionIndicatorVisible();
      expect(parseFloat(vis.indicatorOpacity)).toBeLessThanOrEqual(0.01);

      // Simulating -> Idle (stop simulation)
      await app.stopSimulation();
      await expect(app.page.locator('#startBtn')).toHaveText('Start Simulation');

      // Final sanity: meters reset
      const slowFinal = await app.getMeterWidth('slowStartMeter');
      expect(slowFinal.styleWidth).toBe('0%');
    });
  });

  test.describe('Error and Console Observation (observational tests)', () => {
    test('No uncaught runtime errors or console errors during normal usage', async () => {
      // Perform some normal actions
      await app.startSimulation();
      await app.page.waitForTimeout(300);
      await app.toggleCongestion();
      await app.page.waitForTimeout(300);
      await app.toggleCongestion();
      await app.stopSimulation();

      // We rely on afterEach to assert that no console/page errors occurred.
      // Here, explicitly check the collected arrays for additional debugging visibility:
      const consoleErrors = app.getConsoleErrors();
      const pageErrors = app.getPageErrors();

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });
});