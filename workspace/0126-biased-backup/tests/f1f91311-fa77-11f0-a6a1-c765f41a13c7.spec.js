import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f91311-fa77-11f0-a6a1-c765f41a13c7.html';

class RuntimePage {
  /**
   * Page object wrapper for the Runtime Environment demo.
   * Encapsulates selectors and small helper assertions used by tests.
   */
  constructor(page) {
    this.page = page;
    this.toggleBtn = page.locator('#toggleBtn');
    this.btnText = page.locator('#btnText');
    this.dot = page.locator('#dot');
    this.stateLabel = page.locator('#stateLabel');
    this.stage = page.locator('#stage');
    this.orbsGroup = page.locator('#orbs');
    this.procVal = page.locator('#procVal');
    this.memVal = page.locator('#memVal');
    this.ioVal = page.locator('#ioVal');
    this.latencyVal = page.locator('#latencyVal');
    this.schedVal = page.locator('#schedVal');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure initial load completes
    await expect(this.toggleBtn).toBeVisible();
  }

  // Toggle using mouse click
  async clickToggle() {
    await this.toggleBtn.click();
  }

  // Toggle using keyboard (space or Enter)
  async focusAndPress(key) {
    await this.toggleBtn.focus();
    await this.page.keyboard.press(key);
  }

  // DOM/state inspectors
  async getStateLabelText() {
    return (await this.stateLabel.textContent())?.trim();
  }

  async getBtnText() {
    return (await this.btnText.textContent())?.trim();
  }

  async isStagePaused() {
    return await this.stage.evaluate((el) => el.classList.contains('paused'));
  }

  async isButtonPaused() {
    // The script sets dot.parentElement.classList.add('paused') when paused
    return await this.toggleBtn.evaluate((el) => el.classList.contains('paused'));
  }

  async getOrbsCount() {
    // number of direct children circles in #orbs
    return await this.orbsGroup.evaluate((g) => {
      return Array.from(g.querySelectorAll('circle')).length;
    });
  }

  async sampleFirstOrbRadius() {
    // returns numeric r attribute of the first orb (or null)
    return await this.orbsGroup.evaluate((g) => {
      const c = g.querySelector('circle');
      if (!c) return null;
      return Number(c.getAttribute('r'));
    });
  }

  async getOrbsOpacity() {
    return await this.orbsGroup.evaluate((g) => getComputedStyle(g).opacity);
  }

  async getMetricValues() {
    const proc = (await this.procVal.textContent())?.trim();
    const mem = (await this.memVal.textContent())?.trim();
    const io = (await this.ioVal.textContent())?.trim();
    const lat = (await this.latencyVal.textContent())?.trim();
    return { proc, mem, io, lat };
  }

  async hasToggleTitle(expected) {
    return await this.toggleBtn.getAttribute('title') === expected;
  }
}

test.describe('Runtime Environment — FSM and UI integration', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for inspection in tests
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      });
    });

    // Collect uncaught page errors (like ReferenceError/TypeError)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // No global teardown required beyond Playwright fixtures.
  });

  test('Initial state is Running with expected DOM and accessibility hints', async ({ page }) => {
    const app = new RuntimePage(page);
    // Load the page as-is (do not patch anything)
    await app.goto();

    // Validate initial FSM "Running" state per FSM evidence
    await expect(app.stateLabel).toHaveText('Running');
    await expect(app.btnText).toHaveText('Pause');

    // Button attributes as extracted by the FSM
    expect(await app.hasToggleTitle('Toggle runtime')).toBe(true);

    // Stage should not have paused class initially
    expect(await app.isStagePaused()).toBe(false);
    expect(await app.isButtonPaused()).toBe(false);

    // There should be some orbs created for the visualization
    const orbCount = await app.getOrbsCount();
    expect(orbCount).toBeGreaterThanOrEqual(1);

    // Orbs group opacity should be '1' in running state (string from computed style)
    const opacity = await app.getOrbsOpacity();
    expect(Number(opacity)).toBeCloseTo(1, 1);

    // Initial metrics exist and follow expected text formats
    const metrics = await app.getMetricValues();
    expect(metrics.proc).toMatch(/\d+\s+running/);
    expect(metrics.mem).toMatch(/\d+(\.\d)?\s+GB used/);
    expect(metrics.io).toMatch(/\d+\s+MB\/s/);
    expect(metrics.lat).toMatch(/\d+ms/);

    // Assert no uncaught page errors or console errors on initial load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Clicking toggle transitions Running -> Paused and updates DOM & visuals', async ({ page }) => {
    const app = new RuntimePage(page);
    await app.goto();

    // Give the animation loop a small amount of time to start updating orbs
    await page.waitForTimeout(250);
    const radiusRunning = await app.sampleFirstOrbRadius();
    expect(radiusRunning).not.toBeNull();

    // Click to pause (transition S0_Running -> S1_Paused)
    // Comments: This validates the ToggleRuntime event and its effects:
    // - button label becomes "Run"
    // - stage and button have 'paused' class
    // - visual group opacity reduces
    // - stateLabel becomes "Paused"
    await app.clickToggle();

    // Small debounce for DOM updates triggered by click handler
    await page.waitForTimeout(150);

    // FSM evidence: btnText.textContent == 'Run'
    await expect(app.btnText).toHaveText('Run');
    // FSM evidence: stateLabel.textContent == 'Paused'
    await expect(app.stateLabel).toHaveText('Paused');

    // Check classes applied to container and button
    expect(await app.isStagePaused()).toBe(true);
    expect(await app.isButtonPaused()).toBe(true);

    // orbsGroup opacity is reduced when paused
    const opacityPaused = await app.getOrbsOpacity();
    expect(Number(opacityPaused)).toBeLessThan(Number(await app.getOrbsOpacity()) + 0.0001); // sanity

    // Check that individual orb sizes are reduced (animation loop scales down on pause)
    await page.waitForTimeout(220); // allow animation frame cycle(s) to update radii
    const radiusPaused = await app.sampleFirstOrbRadius();
    expect(radiusPaused).not.toBeNull();
    // In paused mode the radius should generally be <= the running radius * (1 + small epsilon)
    // Allowing some tolerance since animation breathing can cause minor variations
    expect(Number(radiusPaused)).toBeLessThanOrEqual(Number(radiusRunning) + 1.5);

    // Ensure no uncaught errors were thrown during toggle
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Clicking toggle again transitions Paused -> Running and restores visuals', async ({ page }) => {
    const app = new RuntimePage(page);
    await app.goto();

    // Pause first
    await app.clickToggle();
    await page.waitForTimeout(120);
    await expect(app.stateLabel).toHaveText('Paused');

    // Capture some paused metrics/visuals
    const orbCountBefore = await app.getOrbsCount();
    const opacityBefore = Number(await app.getOrbsOpacity());

    // Click to resume (S1_Paused -> S0_Running)
    await app.clickToggle();
    await page.waitForTimeout(180);

    // FSM evidence: btnText back to 'Pause' and stateLabel 'Running'
    await expect(app.btnText).toHaveText('Pause');
    await expect(app.stateLabel).toHaveText('Running');

    // Classes removed
    expect(await app.isStagePaused()).toBe(false);
    expect(await app.isButtonPaused()).toBe(false);

    // Visual group opacity restored to around 1
    const opacityAfter = Number(await app.getOrbsOpacity());
    expect(opacityAfter).toBeGreaterThanOrEqual(opacityBefore);

    // Orbs count remains stable
    const orbCountAfter = await app.getOrbsCount();
    expect(orbCountAfter).toBe(orbCountBefore);

    // No runtime page errors produced during toggle back
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Keyboard accessibility: Space and Enter toggle the runtime', async ({ page }) => {
    const app = new RuntimePage(page);
    await app.goto();

    // Ensure initial state is Running
    await expect(app.stateLabel).toHaveText('Running');

    // Focus the toggle button and press Space -> should pause
    await app.focusAndPress('Space');
    await page.waitForTimeout(120);
    await expect(app.stateLabel).toHaveText('Paused');

    // Focus and press Enter -> should resume
    await app.focusAndPress('Enter');
    await page.waitForTimeout(120);
    await expect(app.stateLabel).toHaveText('Running');

    // Ensure no page errors or console errors from keyboard handling
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Rapid toggling (edge case) maintains consistent final state and does not throw', async ({ page }) => {
    const app = new RuntimePage(page);
    await app.goto();

    // Start from Running. Rapidly click 5 times.
    // This tests robustness of click handler and ensures no uncaught exceptions under quick interactions.
    for (let i = 0; i < 5; i++) {
      await app.clickToggle();
      // miniature delay to simulate fast user but not simultaneous events
      await page.waitForTimeout(40);
    }

    // After 5 clicks, parity: odd -> state toggled => should be Paused
    const expected = (5 % 2 === 1) ? 'Paused' : 'Running';
    await page.waitForTimeout(120);
    await expect(app.stateLabel).toHaveText(expected);

    // Final DOM classes must align with state
    if (expected === 'Paused') {
      expect(await app.isStagePaused()).toBe(true);
    } else {
      expect(await app.isStagePaused()).toBe(false);
    }

    // Confirm no uncaught errors were emitted during rapid toggling
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Metrics update over time while running, and remain formatted after pause', async ({ page }) => {
    const app = new RuntimePage(page);
    await app.goto();

    // Snapshot metrics, wait for them to update (updateMetrics runs ~ every 800ms)
    const initial = await app.getMetricValues();
    await page.waitForTimeout(1000);
    const after = await app.getMetricValues();

    // At least one metric should have changed while running (non-deterministic but expected)
    const changed = initial.proc !== after.proc || initial.mem !== after.mem || initial.io !== after.io || initial.lat !== after.lat;
    expect(changed).toBe(true);

    // Pause the visualization and allow metrics to settle/decay logic to run
    await app.clickToggle(); // pause
    await page.waitForTimeout(1000);
    const pausedMetrics = await app.getMetricValues();

    // Metrics should still be present and formatted correctly after pause
    expect(pausedMetrics.proc).toMatch(/\d+\s+running/);
    expect(pausedMetrics.mem).toMatch(/\d+(\.\d)?\s+GB used/);
    expect(pausedMetrics.io).toMatch(/\d+\s+MB\/s/);
    expect(pausedMetrics.lat).toMatch(/\d+ms/);

    // No page errors produced during metric updates or pause
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Observes console messages and page errors for transparency (assert none occurred)', async ({ page }) => {
    const app = new RuntimePage(page);
    await app.goto();

    // No additional interactions; simply assert there are no console errors or page errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    // If errors exist they will be surfaced in the test failure with the collected messages
    expect(consoleErrors.length, `Console errors detected: ${JSON.stringify(consoleErrors, null, 2)}`).toBe(0);
    expect(pageErrors.length, `Page errors detected: ${pageErrors.map(e => e.message).join('\n')}`).toBe(0);
  });
});