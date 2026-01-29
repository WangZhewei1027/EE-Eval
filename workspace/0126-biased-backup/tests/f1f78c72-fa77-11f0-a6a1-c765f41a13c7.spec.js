import { test, expect } from '@playwright/test';

// Test file for Application ID: f1f78c72-fa77-11f0-a6a1-c765f41a13c7
// URL: http://127.0.0.1:5500/workspace/0126-biased/html/f1f78c72-fa77-11f0-a6a1-c765f41a13c7.html
// This suite validates the FSM states, events, transitions, visual changes, DOM updates, and observes console/page errors.
// It intentionally does NOT modify page code, and only observes runtime behavior as-is.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f78c72-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object Model for the Monitor page
class MonitorPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.sel = {
      monitor: '#monitor',
      powerBtn: '#power',
      snapshotBtn: '#snapshot',
      flash: '#flash',
      logs: '#logs',
      lamp: '.lamp',
      gaugeValue: '#gaugeValue',
      cpuFill: '#cpuFill',
      memFill: '#memFill',
      throughput: '#throughput',
      latency: '#latency',
      health: '#health',
      signalState: '#signalState'
    };
  }

  // navigate to the app and wait for load
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // ensure initial animations have a chance to start but tests shouldn't depend on them
    await this.page.waitForTimeout(50);
  }

  async isPoweredOn() {
    return await this.page.$eval(this.sel.monitor, el => !el.classList.contains('off'));
  }

  async powerAriaPressed() {
    return await this.page.$eval(this.sel.powerBtn, el => el.getAttribute('aria-pressed'));
  }

  async togglePower() {
    await this.page.click(this.sel.powerBtn);
  }

  async focusAndPressPowerKey(key = 'Enter') {
    await this.page.focus(this.sel.powerBtn);
    await this.page.keyboard.press(key);
  }

  async takeSnapshot() {
    await this.page.click(this.sel.snapshotBtn);
  }

  async pressSnapshotKey(key = 'Enter') {
    await this.page.focus(this.sel.snapshotBtn);
    await this.page.keyboard.press(key);
  }

  async getLogsCount() {
    return await this.page.$eval(this.sel.logs, el => el.children.length);
  }

  async getLatestLogText() {
    return await this.page.$eval(this.sel.logs, el => el.children[0]?.textContent ?? '');
  }

  async hasFlashIgnite() {
    return await this.page.$eval(this.sel.flash, el => el.classList.contains('ignite'));
  }

  async getLampOpacity() {
    return await this.page.$eval(this.sel.lamp, el => {
      const s = window.getComputedStyle(el);
      return parseFloat(s.opacity);
    });
  }

  async getGaugeValueText() {
    return await this.page.$eval(this.sel.gaugeValue, el => el.textContent.trim());
  }

  async getFillTransforms() {
    return await this.page.$$eval([this.sel.cpuFill, this.sel.memFill].join(','), nodes =>
      nodes.map(n => n.style.transform || window.getComputedStyle(n).transform || '')
    );
  }

  async ensureOn() {
    const on = await this.isPoweredOn();
    const aria = await this.powerAriaPressed();
    if (!on || aria === 'true') {
      // toggle to get back to on
      await this.togglePower();
      // small wait to allow DOM updates
      await this.page.waitForTimeout(50);
    }
  }

  async ensureOff() {
    const on = await this.isPoweredOn();
    const aria = await this.powerAriaPressed();
    if (on || aria === 'false') {
      await this.togglePower();
      await this.page.waitForTimeout(50);
    }
  }
}

test.describe('Monitor — Visual Concept (FSM & interactions)', () => {
  // Collect console and page errors for every test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // record console messages and page errors without altering page behavior
    page.on('console', msg => {
      // store for assertions; do not swallow
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // navigate
    const monitor = new MonitorPage(page);
    await monitor.goto();
  });

  test.afterEach(async ({ page }) => {
    // helpful debug output if a test fails - but do not modify page
    // We purposely do not fail here; assertions occur inside tests.
  });

  test('Initial state should be Powered On (S0_PoweredOn) with expected DOM evidence', async ({ page }) => {
    // This test validates the FSM initial active state evidence:
    // - monitor does NOT have 'off' class
    // - power button aria-pressed === 'false'
    // - lamp is visible (opacity not the reduced off value)
    const monitor = new MonitorPage(page);

    // verify powered on state per FSM evidence
    const isOn = await monitor.isPoweredOn();
    expect(isOn).toBe(true);

    const ariaPressed = await monitor.powerAriaPressed();
    expect(ariaPressed).toBe('false');

    // lamp opacity should be noticeably > 0 (and not the low .08 used when off)
    const opacity = await monitor.getLampOpacity();
    expect(opacity).toBeGreaterThan(0.1);

    // gauge and logs should render text-like values (basic sanity)
    const gaugeText = await monitor.getGaugeValueText();
    expect(gaugeText).toMatch(/\d+%/);

    const logsCount = await monitor.getLogsCount();
    expect(logsCount).toBeGreaterThanOrEqual(1);

    // No uncaught page errors or console.error by default
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('PowerToggle event toggles to Powered Off (S1_PoweredOff) and back to Powered On (S0_PoweredOn)', async ({ page }) => {
    // Validate transition evidence when clicking power button:
    // - when toggled off: monitor gets 'off' class and aria-pressed = 'true'
    // - when toggled on: monitor loses 'off' class and aria-pressed = 'false'
    const monitor = new MonitorPage(page);

    // Ensure starting on
    await monitor.ensureOn();

    // Click to turn off
    await monitor.togglePower();
    await page.waitForTimeout(60); // allow DOM updates

    let isOn = await monitor.isPoweredOn();
    let aria = await monitor.powerAriaPressed();
    expect(isOn).toBe(false);
    expect(aria).toBe('true');

    // Lamp should show the "off" visual effect (opacity reduced). Check it decreased.
    const opacityWhenOff = await monitor.getLampOpacity();
    // The CSS sets .monitor.off .lamp { opacity:.08 }, so expect something small
    expect(opacityWhenOff).toBeLessThan(0.2);

    // Click again to turn on
    await monitor.togglePower();
    await page.waitForTimeout(60);

    isOn = await monitor.isPoweredOn();
    aria = await monitor.powerAriaPressed();
    expect(isOn).toBe(true);
    expect(aria).toBe('false');
  });

  test('Power button keyboard activation triggers the same toggle behavior (Enter key) and space key handling', async ({ page }) => {
    // Validate that keyboard activation (Enter and Space) invokes the same click handlers
    const monitor = new MonitorPage(page);

    // Ensure on
    await monitor.ensureOn();

    // Press Enter to toggle off
    await monitor.focusAndPressPowerKey('Enter');
    await page.waitForTimeout(60);
    let isOn = await monitor.isPoweredOn();
    expect(isOn).toBe(false);

    // Press Space to toggle on (handler listens for ' ')
    // Playwright's keyboard.press(' ') should send a space
    await monitor.focusAndPressPowerKey('Space');
    await page.waitForTimeout(60);
    isOn = await monitor.isPoweredOn();
    expect(isOn).toBe(true);
  });

  test('Snapshot event creates a flash and prepends a log entry with expected format', async ({ page }) => {
    // Validate snapshot event behavior:
    // - flash element receives 'ignite' class
    // - a log line is prepended with "snapshot saved · success" and a timestamp pattern
    const monitor = new MonitorPage(page);

    const initialCount = await monitor.getLogsCount();

    await monitor.takeSnapshot();

    // small wait for DOM updates (class add & log prepend)
    await page.waitForTimeout(80);

    // flash should have 'ignite' class after click
    const hasIgnite = await monitor.hasFlashIgnite();
    expect(hasIgnite).toBe(true);

    // logs should have increased by at least 1 and the first entry should match the snapshot format
    const afterCount = await monitor.getLogsCount();
    expect(afterCount).toBeGreaterThanOrEqual(initialCount + 1);

    const latest = await monitor.getLatestLogText();
    // Expect pattern: "• hh:mm:ss — snapshot saved · success"
    expect(latest).toMatch(/• \d{2}:\d{2}:\d{2} — snapshot saved · success/);
  });

  test('Snapshot trimming: when many snapshots are taken logs are trimmed to keep only latest 6 entries', async ({ page }) => {
    // The app code keeps logs at most 6 entries. This test ensures trimming occurs.
    const monitor = new MonitorPage(page);

    // Ensure we start from a known-ish baseline: take snapshots to be sure
    // Click snapshot 8 times rapidly
    for (let i = 0; i < 8; i++) {
      await monitor.takeSnapshot();
      // small inter-click gap to allow JS to prepend
      await page.waitForTimeout(40);
    }

    // allow any trimming to settle
    await page.waitForTimeout(80);

    const count = await monitor.getLogsCount();
    // According to implementation while(logs.children.length>6) logs.removeChild(...)
    expect(count).toBeLessThanOrEqual(6);
    expect(count).toBeGreaterThanOrEqual(1);

    // Ensure the latest item is a snapshot saved entry
    const latest = await monitor.getLatestLogText();
    expect(latest).toMatch(/snapshot saved · success/);
  });

  test('Rapid power toggles do not produce page errors and leave DOM in a consistent state', async ({ page }) => {
    // Rapidly toggle the power button multiple times to exercise edge-case transitions.
    const monitor = new MonitorPage(page);

    await monitor.ensureOn();

    // Rapid toggles: 12 toggles in quick succession
    for (let i = 0; i < 12; i++) {
      await monitor.togglePower();
      // minimal wait to allow event handler to run but still simulate rapid input
      await page.waitForTimeout(15);
    }

    // After an even number of toggles we expect state to be as started (on)
    const isOn = await monitor.isPoweredOn();
    const aria = await monitor.powerAriaPressed();
    expect(isOn).toBe(true);
    expect(aria).toBe('false');

    // Verify no unexpected runtime errors occurred during rapid toggles
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Live simulation updates: gauge and fills produce reasonable formatted values', async ({ page }) => {
    // The page runs a setInterval that updates gaugeValue, cpuFill, memFill, throughput, latency, health, signalState.
    // This test waits a bit and asserts the values are in expected formats and transforms are present.
    const monitor = new MonitorPage(page);

    // Wait long enough to allow at least one interval (~2400ms in implementation)
    await page.waitForTimeout(2600);

    // gaugeValue should look like "NN%"
    const gaugeText = await monitor.getGaugeValueText();
    expect(gaugeText).toMatch(/^\d+%$/);

    // CPU and MEM fill transforms should be strings containing 'translateX'
    const transforms = await monitor.getFillTransforms();
    expect(transforms.length).toBe(2);
    transforms.forEach(t => {
      expect(t).toMatch(/translateX\(-?\d+%?\)/);
    });

    // Throughput/latency/health should have updated textual content
    const throughput = await page.$eval('#throughput', el => el.textContent.trim());
    const latency = await page.$eval('#latency', el => el.textContent.trim());
    const health = await page.$eval('#health', el => el.textContent.trim());

    expect(throughput).toMatch(/k\/s$/);
    expect(latency).toMatch(/ms$/);
    expect(health).toMatch(/%$/);

    // signal state should be one of High/Low/Normal
    const signalState = await page.$eval('#signalState', el => el.textContent.trim());
    expect(['High', 'Low', 'Normal']).toContain(signalState);
  });

  test('Keyboard snapshot activation (Enter and Space) triggers snapshot behavior', async ({ page }) => {
    // Verify snapshot button responds to Enter and Space keydown handlers (they call click internally)
    const monitor = new MonitorPage(page);

    // Focus snapshot and press Enter
    await page.focus('#snapshot');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(60);

    let latest = await monitor.getLatestLogText();
    expect(latest).toMatch(/snapshot saved · success/);

    // Focus snapshot and press Space
    await page.focus('#snapshot');
    await page.keyboard.press('Space');
    await page.waitForTimeout(60);

    latest = await monitor.getLatestLogText();
    expect(latest).toMatch(/snapshot saved · success/);
  });

  test('No unexpected runtime errors (ReferenceError, SyntaxError, TypeError) are thrown on page load and during interactions', async ({ page }) => {
    // This test ensures we observed/collected page errors and console errors; asserts none occurred.
    // Note: we captured console and page errors in beforeEach handlers.
    // Wait a bit to allow any late asynchronous errors from intervals to surface
    await page.waitForTimeout(600);

    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    // If there are any page errors, surface them in the assertion message for debugging
    if (pageErrors.length > 0) {
      // Attach details to the failing expectation
      const details = pageErrors.map(e => e.toString()).join('\n---\n');
      expect(pageErrors.length, `Unexpected page errors:\n${details}`).toBe(0);
    }

    expect(consoleErrors.length).toBe(0);
  });
});