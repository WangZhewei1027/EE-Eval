import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f89de3-fa77-11f0-a6a1-c765f41a13c7.html';

// Page object encapsulating common interactions and queries for the simulation page
class SimulationPage {
  constructor(page) {
    this.page = page;
    this.runBtn = '#runBtn';
    this.resetBtn = '#resetBtn';
    this.ringLabel = '#ringLabel';
    this.matrix = '#matrix';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // ensure tiles are built
    await this.page.waitForSelector('#tile-T01', { state: 'visible', timeout: 5000 });
  }

  async getRunButtonAttrs() {
    return this.page.evaluate(() => {
      const el = document.getElementById('runBtn');
      return {
        ariaPressed: el ? el.getAttribute('aria-pressed') : null,
        disabled: el ? el.disabled : null
      };
    });
  }

  async getResetButtonAttrs() {
    return this.page.evaluate(() => {
      const el = document.getElementById('resetBtn');
      return {
        disabled: el ? el.disabled : null
      };
    });
  }

  async getRingLabelText() {
    return this.page.textContent(this.ringLabel);
  }

  // returns array of tile status objects { id, statusText, classes }
  async getAllTileStatuses() {
    return this.page.evaluate(() => {
      const tiles = Array.from(document.querySelectorAll('.test-tile'));
      return tiles.map(t => {
        const id = t.id.replace(/^tile-/, '');
        const statusEl = t.querySelector('.tile-status');
        return {
          id,
          statusText: statusEl ? statusEl.textContent.trim() : null,
          classList: Array.from(t.classList)
        };
      });
    });
  }

  async getTileStatus(id) {
    return this.page.evaluate((id) => {
      const t = document.getElementById('tile-' + id);
      if (!t) return null;
      const status = t.querySelector('.tile-status');
      return {
        id,
        statusText: status ? status.textContent.trim() : null,
        classList: Array.from(t.classList)
      };
    }, id);
  }

  async getPathClass(pathId) {
    return this.page.evaluate((pathId) => {
      const el = document.getElementById(pathId);
      return el ? Array.from(el.classList) : null;
    }, pathId);
  }

  async clickRun() {
    await this.page.click(this.runBtn);
  }

  async clickReset() {
    await this.page.click(this.resetBtn);
  }
}

test.describe('Integration Testing — Visual Simulation (FSM validation)', () => {
  // containers for console & page errors captured during test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // capture console messages for inspection
    page.on('console', msg => {
      try {
        const text = msg.text();
        consoleMessages.push({ type: msg.type(), text });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // capture uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({}, testInfo) => {
    // If a test failed, attach some diagnostics to the Playwright output
    if (testInfo.status !== testInfo.expectedStatus) {
      testInfo.attach('console-messages', {
        body: JSON.stringify(consoleMessages, null, 2),
        contentType: 'application/json'
      });
      testInfo.attach('page-errors', {
        body: JSON.stringify(pageErrors.map(e => ({ name: e.name, message: e.message })), null, 2),
        contentType: 'application/json'
      });
    }
  });

  test('Initial Idle state: UI controls and progress initialization', async ({ page }) => {
    // This test validates the S0_Idle state (initial)
    // - runBtn aria-pressed should be "false"
    // - resetBtn should be enabled (disabled = false)
    // - progress ring label should be "0%"
    const sim = new SimulationPage(page);
    await sim.goto();

    // Basic DOM expectations for Idle state
    const runAttrs = await sim.getRunButtonAttrs();
    const resetAttrs = await sim.getResetButtonAttrs();
    const ringText = await sim.getRingLabelText();

    // Validate FSM entry actions were applied: setProgress(0) and runBtn aria-pressed false
    expect(runAttrs.ariaPressed).toBe('false');
    expect(runAttrs.disabled).toBe(false);
    expect(resetAttrs.disabled).toBe(false);
    expect(ringText.trim()).toBe('0%');

    // Tiles should be present and in reset state (status "—")
    const tiles = await sim.getAllTileStatuses();
    expect(tiles.length).toBeGreaterThanOrEqual(7); // expect all 7 tests injected
    for (const t of tiles) {
      expect(t.statusText).toBe('—');
      // ensure no pass/fail classes present on initial idle
      expect(t.classList).not.toContain('tile-pass');
      expect(t.classList).not.toContain('tile-fail');
      expect(t.classList).not.toContain('tile-running');
    }

    // Ensure initial link paths are reset (no 'active' or 'fail' classes)
    const examplePath = await sim.getPathClass('p-ui-api');
    expect(examplePath).toBeTruthy();
    expect(examplePath).not.toContain('active');
    expect(examplePath).not.toContain('fail');

    // No uncaught page errors should be present on a healthy initial load
    expect(pageErrors.length).toBe(0);
  });

  test('RunSimulation transitions: start, progress, and final stabilization', async ({ page }) => {
    // This test triggers the RunSimulation event (click #runBtn)
    // Verifies:
    // - immediate entry actions: runBtn aria-pressed true, runBtn/resetBtn disabled true
    // - progress increments (initial 2%), first tile enters 'running' state
    // - after full timeline completes: ringLabel becomes "100%", resetBtn becomes enabled (per implementation), tiles are pass/fail, links reflect active/fail
    const sim = new SimulationPage(page);
    await sim.goto();

    // Click Run to start the simulation
    await sim.clickRun();

    // Immediately after clicking, verify entry actions for Running state
    // runBtn should have aria-pressed='true' and disabled
    // resetBtn should be disabled during run
    await expect(page.locator('#runBtn')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.locator('#runBtn').isDisabled()).toBe(true);
    expect(await page.locator('#resetBtn').isDisabled()).toBe(true);

    // The ring progress should have been set to a small non-zero value (entry setProgress(2))
    // Allow small time for the immediate setProgress call to reflect to the DOM
    await page.waitForTimeout(50);
    const labelAfterStart = await sim.getRingLabelText();
    // It should at least be "2%" (implementation sets to 2 at start)
    expect(Number(labelAfterStart.replace('%', '').trim())).toBeGreaterThanOrEqual(2);

    // Wait for the simulation to complete its timeline.
    // The runtime is curated (approx ~11-13s). Use a generous timeout to avoid flakes.
    await page.waitForFunction(() => {
      const el = document.getElementById('ringLabel');
      return el && el.textContent.trim() === '100%';
    }, null, { timeout: 20000 });

    // After completion, the implementation sets final stabilization:
    // - ringLabel == "100%"
    // - runBtn.disabled stays true (per code); resetBtn.disabled becomes false
    const finalRing = await sim.getRingLabelText();
    expect(finalRing.trim()).toBe('100%');

    const runAttrs = await sim.getRunButtonAttrs();
    const resetAttrs = await sim.getResetButtonAttrs();
    // Implementation sets runBtn.disabled = true at final stabilization
    expect(runAttrs.disabled).toBe(true);
    // And resetBtn becomes enabled at the end of run (allow user to reset)
    expect(resetAttrs.disabled).toBe(false);

    // Tiles should have completed with either pass or fail states (no '—' left)
    const finalTiles = await sim.getAllTileStatuses();
    for (const t of finalTiles) {
      expect(['✓', '✕']).toContain(t.statusText); // pass or fail
      // classList should include either tile-pass or tile-fail
      expect(t.classList.some(c => c === 'tile-pass' || c === 'tile-fail')).toBe(true);
    }

    // All link elements should be either active or fail (animated accordingly)
    const linkIds = ['p-ui-api','p-api-auth','p-api-svc','p-api-billing','p-auth-db','p-svc-db','p-billing-db'];
    for (const id of linkIds) {
      const classes = await sim.getPathClass(id);
      // Each path should have either 'active' or 'fail' applied by the end
      expect(classes).toBeTruthy();
      expect(classes.includes('active') || classes.includes('fail')).toBe(true);
    }

    // Ensure there were no uncaught page errors during the runtime of the simulation
    expect(pageErrors.length).toBe(0);

    // Also collect console messages and ensure there are informative logs (not strictly required),
    // but ensure nothing like uncaught exception strings exist in console lines.
    const badConsole = consoleMessages.find(m => /Uncaught|ReferenceError|TypeError|SyntaxError/i.test(m.text));
    expect(badConsole).toBeUndefined();
  });

  test('ResetSimulation behavior: clicking reset after run returns to Idle/Reset state', async ({ page }) => {
    // This test validates the transition S1_Running -> S2_Reset via ResetSimulation
    // - start the simulation, wait for completion, then click reset
    // - verify progress set to 0, tiles reset, links reset, runBtn re-enabled and aria-pressed false
    const sim = new SimulationPage(page);
    await sim.goto();

    // Start run and wait for completion (like previous test)
    await sim.clickRun();
    await page.waitForFunction(() => {
      const el = document.getElementById('ringLabel');
      return el && el.textContent.trim() === '100%';
    }, null, { timeout: 20000 });

    // At this point resetBtn should be enabled (per implementation). Click it to reset.
    const resetLocator = page.locator('#resetBtn');
    await expect(resetLocator).toBeEnabled();
    await sim.clickReset();

    // After resetSimulation, verify onExit/onEntry actions for Reset state:
    // - setProgress(0) => ringLabel "0%"
    // - tests.forEach => setTileState(..., 'reset') -> status text '—'
    // - links reset to remove active/fail classes
    await page.waitForTimeout(120); // allow UI to settle

    const ringAfterReset = await sim.getRingLabelText();
    expect(ringAfterReset.trim()).toBe('0%');

    const runAttrs = await sim.getRunButtonAttrs();
    const resetAttrs = await sim.getResetButtonAttrs();

    // Implementation sets runBtn.disabled = false in resetSimulation and aria-pressed='false'
    expect(runAttrs.disabled).toBe(false);
    expect(runAttrs.ariaPressed).toBe('false');
    expect(resetAttrs.disabled).toBe(false);

    // Tiles should be reset to '—'
    const tilesAfterReset = await sim.getAllTileStatuses();
    for (const t of tilesAfterReset) {
      expect(t.statusText).toBe('—');
      // should not include pass/fail/running classes
      expect(t.classList).not.toContain('tile-pass');
      expect(t.classList).not.toContain('tile-fail');
      expect(t.classList).not.toContain('tile-running');
    }

    // Paths should no longer have 'active' or 'fail' classes
    const linkIds = ['p-ui-api','p-api-auth','p-api-svc','p-api-billing','p-auth-db','p-svc-db','p-billing-db'];
    for (const id of linkIds) {
      const classes = await sim.getPathClass(id);
      expect(classes).toBeTruthy();
      expect(classes).not.toContain('active');
      expect(classes).not.toContain('fail');
    }

    // No uncaught errors during reset
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Reset button disabled during running (attempt to reset while running should be prevented)', async ({ page }) => {
    // This test asserts the guardrail: reset button is disabled when simulation is actively running,
    // so a ResetSimulation event cannot be triggered while in S1_Running.
    const sim = new SimulationPage(page);
    await sim.goto();

    // Start the simulation
    await sim.clickRun();

    // Immediately ensure reset button is disabled
    await expect(page.locator('#resetBtn')).toBeDisabled();

    // Try to click reset without forcing - Playwright click will fail if element is disabled.
    // We DO NOT force clicks (per instructions), instead we assert that it is disabled and therefore not interactive.
    const canClickReset = await page.locator('#resetBtn').isEnabled();
    expect(canClickReset).toBe(false);

    // Also ensure that clicking the run button again has no effect (it's disabled)
    const canClickRun = await page.locator('#runBtn').isEnabled();
    expect(canClickRun).toBe(false);

    // Let the simulation finish normally
    await page.waitForFunction(() => {
      const el = document.getElementById('ringLabel');
      return el && el.textContent.trim() === '100%';
    }, null, { timeout: 20000 });

    // After finish, resetBtn should be enabled
    await expect(page.locator('#resetBtn')).toBeEnabled();

    expect(pageErrors.length).toBe(0);
  });

  test('Robustness: no unexpected runtime errors (ReferenceError/TypeError/SyntaxError) during full scenario', async ({ page }) => {
    // This test simply runs the app through a full run + reset cycle and asserts no uncaught exceptions occurred.
    const sim = new SimulationPage(page);
    await sim.goto();

    await sim.clickRun();
    await page.waitForFunction(() => {
      const el = document.getElementById('ringLabel');
      return el && el.textContent.trim() === '100%';
    }, null, { timeout: 20000 });

    await sim.clickReset();
    // allow a moment for reset propagation
    await page.waitForTimeout(200);

    // Assert that no uncaught page errors were observed
    // We explicitly check for the common error types in captured pageErrors
    if (pageErrors.length > 0) {
      // Fail the test with details if any appeared
      const formatted = pageErrors.map(e => `${e.name}: ${e.message}`).join('\n');
      throw new Error('Unexpected page errors were captured:\n' + formatted);
    }

    // Also ensure console does not contain unhandled exception phrases
    const errorConsole = consoleMessages.find(m => /ReferenceError|TypeError|SyntaxError|Uncaught/i.test(m.text));
    expect(errorConsole).toBeUndefined();
  });
});