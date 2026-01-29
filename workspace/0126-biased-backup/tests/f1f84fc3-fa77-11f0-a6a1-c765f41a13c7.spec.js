import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f84fc3-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object for the main controls and common queries
class LoadBalancerPage {
  constructor(page) {
    this.page = page;
  }

  toggleButton() { return this.page.locator('#toggle'); }
  toggleLabel() { return this.page.locator('#toggle-label'); }
  redistributeButton() { return this.page.locator('#redistribute'); }
  statReq() { return this.page.locator('#stat-req'); }
  statBalance() { return this.page.locator('#stat-balance'); }
  servers() { return this.page.locator('.server'); }
  connections() { return this.page.locator('svg.connect path'); }
  dots() { return this.page.locator('.dot'); }
  body() { return this.page.locator('body'); }
  lb() { return this.page.locator('#lb'); }

  async clickToggle() {
    await this.toggleButton().click();
  }
  async clickRedistribute() {
    await this.redistributeButton().click();
  }
}

test.describe('Load Balancing Visual — FSM validation', () => {
  // Collect runtime issues observed from the page for assertions
  let pageErrors;
  let consoleErrors;
  let otherConsoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];
    otherConsoleMessages = [];

    // Capture uncaught exceptions from the page
    page.on('pageerror', (err) => {
      // err is an Error object with name/message/stack
      pageErrors.push({ name: err.name, message: err.message, stack: err.stack });
    });

    // Capture console messages, including console.error
    page.on('console', (msg) => {
      const type = msg.type(); // 'log', 'error', etc.
      const text = msg.text();
      if (type === 'error') {
        consoleErrors.push({ type, text });
      } else {
        otherConsoleMessages.push({ type, text });
      }
    });

    // Navigate to the application page for each test
    await page.goto(APP_URL);
    // Wait for minimal setup: servers injected into DOM
    await page.waitForSelector('.server', { timeout: 3000 });
  });

  test.afterEach(async ({}, testInfo) => {
    // Attach observed runtime info to the test results for easier debugging
    testInfo.attach('pageErrors', { body: JSON.stringify(pageErrors, null, 2), contentType: 'application/json' });
    testInfo.attach('consoleErrors', { body: JSON.stringify(consoleErrors, null, 2), contentType: 'application/json' });
    testInfo.attach('consoleMessages', { body: JSON.stringify(otherConsoleMessages.slice(0,50), null, 2), contentType: 'application/json' });
  });

  test('S0_Idle: initial layout places servers and creates connections (entry action placeServers)', async ({ page }) => {
    // Validate initial Idle state: placeServers() should have injected server nodes & connection paths
    const p = new LoadBalancerPage(page);

    // There should be serverCount server elements (5)
    await expect(p.servers()).toHaveCount(5);

    // There should be connection paths corresponding to each server (>= 5)
    await expect(p.connections()).toHaveCount(5);

    // stat-req should be a positive integer display
    const statReqText = (await p.statReq().textContent()).trim();
    expect(Number(statReqText)).toBeGreaterThan(0);

    // Servers should have CPU nodes with IDs cpu-0 .. cpu-4
    for (let i = 0; i < 5; i++) {
      const cpu = await page.$(`#cpu-${i}`);
      expect(cpu).not.toBeNull();
      const cpuText = (await cpu.textContent()).trim();
      // CPU text should be percent like "12%"
      expect(cpuText).toMatch(/^\d+%$/);
    }
  });

  test('ToggleAnimation event: toggles paused state (S1_Paused entry & S2_Animating exit)', async ({ page }) => {
    const p = new LoadBalancerPage(page);

    // Ensure we start in the "not paused" visual mode (no .paused on body)
    const bodyHasPausedBefore = await p.body().evaluate((b) => b.classList.contains('paused'));
    // It's acceptable if initial script already toggled - we just record initial state
    // Click toggle to change state
    await p.clickToggle();

    // After clicking, the code should set paused = !paused. When paused=true, body gets 'paused'
    await expect(p.body()).toHaveClass(/paused/);

    // Toggle label should change to 'Paused' and button should flip classes from primary to ghost
    await expect(p.toggleLabel()).toHaveText('Paused');
    await expect(p.toggleButton()).toHaveClass(/btn-ghost/);
    await expect(p.toggleButton()).not.toHaveClass(/btn-primary/);

    // Click again to resume (exit S1_Paused and enter S2_Animating)
    await p.clickToggle();

    // Body should no longer have 'paused' class
    const hasPausedAfter = await p.body().evaluate((b) => b.classList.contains('paused'));
    expect(hasPausedAfter).toBe(false);

    // Toggle label should read 'Animate' and primary class should be present
    await expect(p.toggleLabel()).toHaveText('Animate');
    await expect(p.toggleButton()).toHaveClass(/btn-primary/);
  });

  test('RedistributeLoads event: redistributes loads and updates visuals (S2_Animating -> S0_Idle transition expectation)', async ({ page }) => {
    const p = new LoadBalancerPage(page);

    // Ensure we are in animating state; if not, toggle to resume
    const bodyHasPaused = await p.body().evaluate((b) => b.classList.contains('paused'));
    if (bodyHasPaused) {
      await p.clickToggle(); // resume
      await expect(p.body()).not.toHaveClass(/paused/);
    }

    // Read balance before redistribute (likely 'Uneven')
    const beforeBalance = (await p.statBalance().textContent()).trim();

    // Click redistribute and wait briefly for UI update (redistribute() updates CPU visuals and dots)
    await p.clickRedistribute();

    // After redistribution the script attempts to smooth loads towards the average and mark Balanced
    // Wait up to 1s for the statBalance to reflect Balanced (non-deterministic but expected)
    await p.statBalance().waitFor({ state: 'visible', timeout: 1500 });

    const afterBalance = (await p.statBalance().textContent()).trim();
    // The desirable outcome is 'Balanced'. Assert it becomes Balanced after redistribute.
    expect(afterBalance).toBe('Balanced');

    // Verify that CPU visuals text updated and still present for all servers
    for (let i = 0; i < 5; i++) {
      const cpu = await page.$(`#cpu-${i}`);
      expect(cpu).not.toBeNull();
      const cpuText = (await cpu.textContent()).trim();
      expect(cpuText).toMatch(/^\d+%$/);
    }

    // Ensure the central lb element exists and that a pulse animation can be triggered (no runtime error)
    await expect(p.lb()).toBeVisible();
  });

  test('RedistributeLoads while paused: action still runs but pause state persists (edge case)', async ({ page }) => {
    const p = new LoadBalancerPage(page);

    // Ensure paused
    const isPaused = await p.body().evaluate((b) => b.classList.contains('paused'));
    if (!isPaused) {
      await p.clickToggle();
      await expect(p.body()).toHaveClass(/paused/);
    }

    // Click redistribute while paused
    await p.clickRedistribute();

    // After redistribute body should still be paused (redistribute doesn't toggle paused)
    await expect(p.body()).toHaveClass(/paused/);

    // And the statBalance should update (likely to Balanced)
    await p.statBalance().waitFor({ state: 'visible', timeout: 1500 });
    const balanceText = (await p.statBalance().textContent()).trim();
    expect(balanceText).toBe('Balanced');
  });

  test('Resize handling: placeServers is called on resize and server positions change (debounced)', async ({ page }) => {
    const p = new LoadBalancerPage(page);

    // Capture initial positions of servers
    const initialPositions = await p.servers().evaluateAll((nodes) =>
      nodes.map(n => {
        const r = n.getBoundingClientRect();
        return { left: Math.round(r.left), top: Math.round(r.top) };
      })
    );

    // Trigger a resize event by changing viewport size
    // Use a smaller viewport to ensure repositioning occurs
    await page.setViewportSize({ width: 800, height: 600 });
    // Wait for the debounce timer used in the app (220ms) plus a margin
    await page.waitForTimeout(400);

    // Capture new positions
    const newPositions = await p.servers().evaluateAll((nodes) =>
      nodes.map(n => {
        const r = n.getBoundingClientRect();
        return { left: Math.round(r.left), top: Math.round(r.top) };
      })
    );

    // At least one server position should have changed after resize (otherwise resize had no effect)
    const anyChanged = initialPositions.some((pos, idx) =>
      pos.left !== newPositions[idx].left || pos.top !== newPositions[idx].top
    );
    expect(anyChanged).toBe(true);
  });

  test('Rapid interactions: multiple toggles and redistributes do not produce runtime errors', async ({ page }) => {
    const p = new LoadBalancerPage(page);

    // Rapidly click toggle and redistribute several times
    for (let i = 0; i < 3; i++) {
      await p.clickToggle();
      await p.clickRedistribute();
    }

    // Wait briefly for any asynchronous work to run
    await page.waitForTimeout(600);

    // Analyze collected runtime observations
    // We expect no uncaught page errors and no console.error messages of type ReferenceError, SyntaxError, or TypeError.
    const criticalPageErrors = pageErrors.filter(e =>
      e.name === 'ReferenceError' || e.name === 'TypeError' || e.name === 'SyntaxError'
    );
    const criticalConsoleErrors = consoleErrors.filter(e =>
      /ReferenceError|TypeError|SyntaxError/i.test(e.text)
    );

    // Assert that no critical runtime errors were observed during the rapid interactions
    expect(criticalPageErrors.length).toBe(0);
    expect(criticalConsoleErrors.length).toBe(0);
  });

  test('Runtime error observation: capture and assert observed page/console errors (if any)', async ({ page }) => {
    // This test validates that we observe and report runtime errors from the application.
    // Per testing policy we do not inject/patch the page; we only observe what naturally occurs.
    // Assert that the arrays exist and are proper arrays.
    expect(Array.isArray(pageErrors)).toBe(true);
    expect(Array.isArray(consoleErrors)).toBe(true);

    // If any page errors exist, they will be attached to the test results in afterEach for inspection.
    // For the formal assertion, we assert that there are zero unexpected global errors of the most common types.
    const unexpected = pageErrors.filter(e =>
      ['ReferenceError', 'TypeError', 'SyntaxError'].includes(e.name)
    );
    // It's acceptable for the application to have no errors; we assert that there are no critical runtime exceptions.
    expect(unexpected.length).toBe(0);
  });
});