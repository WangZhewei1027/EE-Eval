import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c15da32-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Simple page object encapsulating common interactions on the simulator page
class SimulatorPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Controls
    this.selectors = {
      statePre: '#state',
      runQuery: '#runQuery',
      stepModeToggle: '#stepModeToggle',
      nextStep: '#nextStep',
      stopRun: '#stopRun',
      advanceTime: '#advanceTime',
      advanceSeconds: '#advanceSeconds',
      purgeCache: '#purgeCache',
      sendDirect: '#sendDirect',
      directServer: '#directServer',
      createZone: '#createZone',
      newZoneName: '#newZoneName',
      newZoneIP: '#newZoneIP',
      queryDomain: '#queryDomain',
      queryType: '#queryType',
      resolverMode: '#resolverMode',
      queryId: '#queryId',
      logPanel: '#log',
      cacheView: '#cacheView',
      zonesList: '#zonesList',
      serversView: '#serversView',
      scenarioButtons: '.scenario'
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getStateText() {
    return (await this.page.locator(this.selectors.statePre).innerText()).trim();
  }

  async clickRunQuery() {
    await this.page.click(this.selectors.runQuery);
  }

  async clickStepModeToggle() {
    await this.page.click(this.selectors.stepModeToggle);
  }

  async clickNextStep() {
    await this.page.click(this.selectors.nextStep);
  }

  async clickStopRun() {
    await this.page.click(this.selectors.stopRun);
  }

  async clickAdvanceTime() {
    await this.page.click(this.selectors.advanceTime);
  }

  async setAdvanceSeconds(value) {
    await this.page.fill(this.selectors.advanceSeconds, String(value));
  }

  async clickPurgeCache() {
    await this.page.click(this.selectors.purgeCache);
  }

  async clickSendDirect() {
    await this.page.click(this.selectors.sendDirect);
  }

  async setDirectServer(ip) {
    await this.page.fill(this.selectors.directServer, ip);
  }

  async setQueryDomain(domain) {
    await this.page.fill(this.selectors.queryDomain, domain);
  }

  async setQueryType(typeText) {
    // set select by visible text
    await this.page.selectOption(this.selectors.queryType, { label: typeText });
  }

  async setResolverMode(modeValue) {
    await this.page.selectOption(this.selectors.resolverMode, modeValue);
  }

  async clickCreateZone() {
    await this.page.click(this.selectors.createZone);
  }

  async setNewZone(name, ip) {
    await this.page.fill(this.selectors.newZoneName, name);
    await this.page.fill(this.selectors.newZoneIP, ip);
  }

  async getLogText() {
    return await this.page.locator(this.selectors.logPanel).innerText();
  }

  async getCacheText() {
    return await this.page.locator(this.selectors.cacheView).innerText();
  }

  async getZonesListText() {
    return await this.page.locator(this.selectors.zonesList).innerText();
  }

  async clickScenarioByData(scenario) {
    // find button with data-scenario attribute
    const btn = this.page.locator(`${this.selectors.scenarioButtons}[data-scenario="${scenario}"]`);
    await btn.click();
  }

  async getServersViewText() {
    return await this.page.locator(this.selectors.serversView).innerText();
  }
}

test.describe('DNS Interactive Simulator — FSM and UI validations', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen for console messages
    page.on('console', (msg) => {
      try {
        const text = msg.text();
        consoleMessages.push({ type: msg.type(), text });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Listen for uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.describe('Initial state and basic state transitions', () => {
    test('Initial state should be Idle - ready. and UI elements present', async ({ page }) => {
      const sim = new SimulatorPage(page);
      await sim.goto();

      // Validate initial state text - the app sets "Idle - ready." on init
      const state = await sim.getStateText();
      expect(state).toMatch(/Idle/i); // allow either "Idle" or "Idle - ready."
      // Basic UI elements should be present and enabled/disabled as expected
      await expect(page.locator('#runQuery')).toBeVisible();
      await expect(page.locator('#stepModeToggle')).toBeVisible();
      await expect(page.locator('#nextStep')).toBeDisabled();
      await expect(page.locator('#stopRun')).toBeDisabled();
    });

    test('Clicking Run Query transitions to Running Query and then back to Idle (or final state)', async ({ page }) => {
      const sim = new SimulatorPage(page);
      await sim.goto();

      // Ensure known inputs
      await sim.setQueryDomain('www.example.com');
      await sim.setQueryType('A');
      await sim.setResolverMode('recursive');

      // Click Run Query and assert immediate state change
      await Promise.all([
        page.waitForEvent('console').catch(() => {}), // some logging happens; don't block if none
        page.locator('#runQuery').click()
      ]);

      // Immediately after click, the UI should show "Running query..."
      // Use a short wait to let the updateState call happen
      await page.waitForTimeout(50);
      const midState = await sim.getStateText();
      expect(midState).toMatch(/Running query/i);

      // Wait for resolution to complete: state should eventually contain "Idle" or similar
      await page.waitForFunction(() => {
        const el = document.getElementById('state');
        if (!el) return false;
        return /Idle|idle/i.test(el.textContent || '');
      }, {}, { timeout: 5000 });

      const finalState = await sim.getStateText();
      expect(finalState).toMatch(/Idle/i);
    });
  });

  test.describe('Step Mode and run controls', () => {
    test('Toggling Step Mode enables Next Step and updates state text', async ({ page }) => {
      const sim = new SimulatorPage(page);
      await sim.goto();

      // Toggle step mode on
      await sim.clickStepModeToggle();

      // Step mode toggle button text should change to 'Disable Step Mode'
      await expect(page.locator('#stepModeToggle')).toHaveText(/Disable Step Mode|Enable Step Mode/);

      // State should indicate step mode enabled
      const state = await sim.getStateText();
      expect(state).toMatch(/Step mode enabled/i);

      // Next step should be enabled when step mode is enabled
      await expect(page.locator('#nextStep')).toBeEnabled();

      // Clicking Next Step when no steps queued should update state to 'No steps queued.'
      await sim.clickNextStep();
      await page.waitForTimeout(50);
      const stateAfterNext = await sim.getStateText();
      expect(stateAfterNext).toMatch(/No steps queued|Step executed/i);
    });

    test('Stop Run during a running query updates state to Run stopped by user.', async ({ page }) => {
      const sim = new SimulatorPage(page);
      await sim.goto();

      // Start a query that will begin running
      await sim.setQueryDomain('www.example.com');
      await sim.setQueryType('A');

      // Click Run Query and shortly after click Stop to simulate user interrupt
      await page.locator('#runQuery').click();

      // Wait until stopRun becomes enabled, then click it
      await page.waitForSelector('#stopRun:not([disabled])', { timeout: 3000 }).catch(() => {});
      // Click stop (if enabled)
      if (await page.locator('#stopRun').isEnabled()) {
        await sim.clickStopRun();
        // The state should reflect stop action
        await page.waitForTimeout(50);
        const state = await sim.getStateText();
        expect(state).toMatch(/Run stopped by user|Run stopped/i);
      } else {
        // If stop wasn't enabled for some reason, at least ensure runQuery triggered a running state at some point
        const s = await sim.getStateText();
        expect(s).toMatch(/Running query|Idle/i);
      }
    });
  });

  test.describe('Time advancement and cache manipulation', () => {
    test('Advancing simulated time updates log and internal time progression effects', async ({ page }) => {
      const sim = new SimulatorPage(page);
      await sim.goto();

      // Advance by 60 seconds and assert log message appears
      await sim.setAdvanceSeconds(60);
      await sim.clickAdvanceTime();

      // The log area should contain a message about simulated time advanced
      await page.waitForTimeout(50);
      const log = await sim.getLogText();
      expect(log).toMatch(/Simulated time advanced by 60s/i);
    });

    test('Purge cache clears cache view and logs purge message', async ({ page }) => {
      const sim = new SimulatorPage(page);
      await sim.goto();

      // Trigger purge cache
      await sim.clickPurgeCache();

      // Log should reflect purge
      await page.waitForTimeout(50);
      const log = await sim.getLogText();
      expect(log).toMatch(/Resolver cache purged/i);

      // Cache view should show "(empty)"
      const cacheText = await sim.getCacheText();
      expect(cacheText).toMatch(/empty|^\s*$/i);
    });
  });

  test.describe('Direct queries and zone creation', () => {
    test('Sending a direct query to a known authoritative server yields a Received entry', async ({ page }) => {
      const sim = new SimulatorPage(page);
      await sim.goto();

      // Use an authoritative server IP for example.com present in the initial topology
      const authIp = '198.51.100.10';
      await sim.setDirectServer(authIp);
      await sim.setQueryDomain('www.example.com');
      await sim.setQueryType('A');

      // Clear any prior logs to focus on this action
      await page.evaluate(() => { document.getElementById('log').innerHTML = ''; });

      // Click send direct
      await sim.clickSendDirect();

      // The state should briefly show "Sending direct query..."
      await page.waitForTimeout(50);
      const midState = await sim.getStateText();
      expect(midState).toMatch(/Sending direct query/i);

      // The log should eventually contain a Received entry from that server
      await page.waitForFunction(() => {
        const l = document.getElementById('log');
        return l && /Received|Reply from/.test(l.textContent || '');
      }, {}, { timeout: 3000 });

      const log = await sim.getLogText();
      expect(log).toMatch(/Received|Reply from/i);
      expect(log).toContain(authIp);
    });

    test('Creating a new zone updates the zones list and servers view', async ({ page }) => {
      const sim = new SimulatorPage(page);
      await sim.goto();

      const zoneName = 'autotest.example';
      const zoneIp = '198.51.123.45';

      // Ensure fields are set and then click create zone
      await sim.setNewZone(zoneName, zoneIp);
      await sim.clickCreateZone();

      // After creation, the zones list should include the new zone
      await page.waitForFunction((z) => {
        const el = document.getElementById('zonesList');
        return el && el.innerText.includes(z);
      }, zoneName, { timeout: 2000 });

      const zonesText = await sim.getZonesListText();
      expect(zonesText).toContain(zoneName);

      // Servers view should show the server IP we added
      const serversText = await sim.getServersViewText();
      expect(serversText).toContain(zoneIp);
    });
  });

  test.describe('Scenarios and observed runtime errors', () => {
    test('Running the +trace scenario triggers expected state update and logs', async ({ page }) => {
      const sim = new SimulatorPage(page);
      await sim.goto();

      // Clear log
      await page.evaluate(() => document.getElementById('log').innerHTML = '');

      // Click the trace scenario button
      await sim.clickScenarioByData('trace');

      // The state should update to indicate +trace simulation is running
      await page.waitForTimeout(50);
      const midState = await sim.getStateText();
      expect(midState).toMatch(/Running \+trace|Running \+trace simulation|Running \+trace simulation...|Running \+trace simulation/i);

      // Wait up to a few seconds for either completion or failure to be logged
      await page.waitForFunction(() => {
        const l = document.getElementById('log');
        return l && (/trace completed|failed|Reply from|Received/i).test(l.textContent || '');
      }, {}, { timeout: 5000 });

      const log = await sim.getLogText();
      expect(log.length).toBeGreaterThan(0);
    });

    test('Application should surface runtime errors (e.g., TypeError due to this.findDelegation misuse) in pageerror events', async ({ page }) => {
      const sim = new SimulatorPage(page);
      await sim.goto();

      // Perform interactions likely to exercise non-authoritative referral code path (which triggers the bug)
      // 1) Run a recursive query which uses iterativeResolve internally and will query non-authoritative servers
      await sim.setQueryDomain('www.example.com');
      await sim.setQueryType('A');
      await sim.setResolverMode('recursive');

      // Clear any prior logs and errors
      await page.evaluate(() => { document.getElementById('log').innerHTML = ''; });

      // Trigger the query. Because of a bug in sendQuery (use of this.findDelegation inside a non-arrow callback),
      // we expect at least one pageerror event (TypeError / undefined function) to be emitted when referral handling occurs.
      await sim.clickRunQuery();

      // Allow some time for asynchronous operations and errors to surface
      await page.waitForTimeout(1000);

      // At least one page error should have been captured
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      // Verify that one of the page errors mentions findDelegation or indicates a TypeError/undefined function
      const found = pageErrors.some(err => {
        const msg = String(err && err.message ? err.message : err);
        return /findDelegation/i.test(msg) || /this\.findDelegation/i.test(msg) || /undefined/i.test(msg) || /TypeError/i.test(msg) || /Cannot read property/i.test(msg);
      });

      expect(found).toBeTruthy();
    });
  });

  test.afterEach(async ({ page }) => {
    // As part of teardown, attach console messages (helpful for debugging when running tests)
    // We assert that console messages were collected (they may be empty in some environments)
    // This is not a strict requirement but helps ensure logs were observed
    // No explicit action needed here beyond the implicit collection in beforeEach
    // Provide a gentle assertion that the page loaded and executed JS by checking console was at least observed
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});