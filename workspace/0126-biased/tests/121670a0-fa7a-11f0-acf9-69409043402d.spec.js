import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/121670a0-fa7a-11f0-acf9-69409043402d.html';

// Page Object Model for the DNS Simulator page
class DNSPage {
  constructor(page) {
    this.page = page;
  }

  // DOM element locators
  async h1() { return this.page.locator('h1'); }
  async domainInput() { return this.page.locator('#domainInput'); }
  async queryType() { return this.page.locator('#queryType'); }
  async startResolveBtn() { return this.page.locator('#startResolve'); }
  async resetSimBtn() { return this.page.locator('#resetSim'); }
  async resolutionLog() { return this.page.locator('#resolutionLog'); }
  async stepNextBtn() { return this.page.locator('#stepNext'); }
  async stepBackBtn() { return this.page.locator('#stepBack'); }
  async stepRunPauseBtn() { return this.page.locator('#stepRunPause'); }
  async stepDelayInput() { return this.page.locator('#stepDelay'); }
  async maxStepsInput() { return this.page.locator('#maxSteps'); }
  async autoStepCheckbox() { return this.page.locator('#autoStep'); }
  async clearCacheBtn() { return this.page.locator('#clearCache'); }
  async showCacheBtn() { return this.page.locator('#showCache'); }

  async zoneNameInput() { return this.page.locator('#zoneName'); }
  async soaInput() { return this.page.locator('#soaInput'); }
  async zoneRecordsInput() { return this.page.locator('#zoneRecords'); }
  async loadZoneBtn() { return this.page.locator('#loadZone'); }
  async clearZoneBtn() { return this.page.locator('#clearZone'); }
  async showZoneBtn() { return this.page.locator('#showZone'); }
  async showZoneTreeBtn() { return this.page.locator('#showZoneTree'); }
  async zoneTreeOutput() { return this.page.locator('#zoneTreeOutput'); }

  async conceptSelect() { return this.page.locator('#conceptSelect'); }
  async conceptInfo() { return this.page.locator('#conceptInfo'); }

  // Helper actions
  async navigate() {
    await this.page.goto(APP_URL);
    // wait for the key element to be available
    await this.h1().waitFor({ state: 'visible' });
  }

  async setDomain(value) {
    const input = await this.domainInput();
    await input.fill(value);
  }

  async setQueryType(value) {
    const sel = await this.queryType();
    await sel.selectOption({ value });
  }

  async setAutoStep(enabled) {
    const cb = await this.autoStepCheckbox();
    const isChecked = await cb.isChecked();
    if (isChecked !== enabled) await cb.click();
  }

  async setStepDelay(ms) {
    await this.stepDelayInput().then(el => el.fill(String(ms)));
  }

  async setMaxSteps(n) {
    await this.maxStepsInput().then(el => el.fill(String(n)));
  }

  async clickStartResolve() {
    await this.startResolveBtn().then(b => b.click());
  }

  async clickResetSim() {
    await this.resetSimBtn().then(b => b.click());
  }

  async clickStepNext() {
    await this.stepNextBtn().then(b => b.click());
  }

  async clickStepBack() {
    await this.stepBackBtn().then(b => b.click());
  }

  async clickClearCache() {
    await this.clearCacheBtn().then(b => b.click());
  }

  async clickShowCache() {
    await this.showCacheBtn().then(b => b.click());
  }

  async clickLoadZone() {
    await this.loadZoneBtn().then(b => b.click());
  }

  async clickClearZone() {
    await this.clearZoneBtn().then(b => b.click());
  }

  async clickShowZone() {
    await this.showZoneBtn().then(b => b.click());
  }

  async clickShowZoneTree() {
    await this.showZoneTreeBtn().then(b => b.click());
  }

  async clickConceptOption(value) {
    await this.conceptSelect().then(s => s.selectOption({ value }));
  }

  // Utility: wait until resolutionLog contains substring
  async waitForLogContains(substring, timeout = 2000) {
    await this.page.waitForFunction(
      (sel, text) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        return el.textContent.includes(text);
      },
      ['#resolutionLog', substring],
      { timeout }
    );
  }

  async getResolutionLogText() {
    return (await this.resolutionLog().textContent()) || '';
  }

  async getZoneTreeText() {
    return (await this.zoneTreeOutput().textContent()) || '';
  }

  async getConceptInfoText() {
    return (await this.conceptInfo().textContent()) || '';
  }
}

test.describe('Interactive DNS Explorer - FSM and UI tests', () => {
  let page;
  let dns;
  let consoleMessages = [];
  let pageErrors = [];
  let dialogMessages = [];

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    dns = new DNSPage(page);

    consoleMessages = [];
    pageErrors = [];
    dialogMessages = [];

    // Capture console messages for later assertions
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Auto-accept or auto-handle dialogs, but record their messages
    page.on('dialog', async dialog => {
      dialogMessages.push({ type: dialog.type(), message: dialog.message() });
      // For confirm dialogs return true/accept to proceed
      try {
        await dialog.accept();
      } catch (e) {
        // ignore if already handled
      }
    });

    await dns.navigate();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Idle state renders initial page elements (S0_Idle entry_actions)', async () => {
    // Validate initial header and main sections indicative of Idle state
    await expect(dns.h1()).toBeVisible();
    await expect(dns.h1()).toHaveText('Interactive DNS Explorer');

    // Ensure resolution log exists and is empty on load
    const logText = await dns.getResolutionLogText();
    expect(logText).toBe('', 'Resolution log should be empty in Idle state');

    // No page errors should have happened during initialization
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Resolution flow and transitions (S0 -> S1 -> S3 / S2)', () => {
    test('StartResolution triggers Resolving state and produces resolution steps (S0_Idle -> S1_Resolving)', async () => {
      // Prepare controlled environment: disable auto-step to step manually
      await dns.setAutoStep(false);
      await dns.setStepDelay(50);
      await dns.setMaxSteps(50);

      // Provide a known domain that exists in the built-in example zone
      await dns.setDomain('www.example.com');
      await dns.setQueryType('A');

      // Start resolution; first log entry should indicate start
      await dns.clickStartResolve();

      // Wait for the "Starting resolution" message to appear in the log
      await dns.waitForLogContains('Starting resolution for www.example.com');

      const log = await dns.getResolutionLogText();
      expect(log).toContain('Starting resolution for www.example.com');
      // After first step there should be at least one subsequent step (iterative resolver)
      expect(log.length).toBeGreaterThan(30);

      // StepNext should proceed to next simulation step (we control stepping)
      await dns.clickStepNext();
      // After clicking step next, log should update with additional lines OR remain valid
      const logAfterNext = await dns.getResolutionLogText();
      expect(logAfterNext.length).toBeGreaterThanOrEqual(log.length);

      // StepBack should return to previous point in the log rendering
      await dns.clickStepBack();
      const logAfterBack = await dns.getResolutionLogText();
      // When stepping back the rendered log could be shorter or equal
      expect(logAfterBack.length).toBeLessThanOrEqual(logAfterNext.length);

      // Reset the simulator to test exit action (logReset)
      await dns.clickResetSim();
      // After reset, log should be cleared
      const cleared = await dns.getResolutionLogText();
      expect(cleared).toBe('', 'logReset should clear resolution log');

      // Ensure resetting did not generate uncaught exceptions
      expect(pageErrors.length).toBe(0);
    });

    test('A successful resolution completes with success message (S3_ResolutionSucceeded)', async () => {
      // Use autoStep true so resolution runs to completion automatically
      await dns.setAutoStep(true);
      await dns.setStepDelay(50);
      await dns.setMaxSteps(100);

      await dns.setDomain('www.example.com');
      await dns.setQueryType('A');

      // Start resolution - it should reach a success state for example.com
      await dns.clickStartResolve();

      // Wait for either success or failure summary message
      await dns.page.waitForFunction(() => {
        const el = document.getElementById('resolutionLog');
        if (!el) return false;
        return /Resolution (succeeded|failed)/i.test(el.textContent || '');
      }, { timeout: 5000 });

      const fullLog = await dns.getResolutionLogText();
      // We expect a success summary for this known domain
      expect(fullLog).toMatch(/Resolution succeeded with \d+ record\(s\)\./);
    });

    test('A failing resolution results in Resolution failed (S2_ResolutionFailed)', async () => {
      // Use a domain that should not resolve within predefined zones
      await dns.setAutoStep(true);
      await dns.setStepDelay(50);
      await dns.setMaxSteps(60);

      await dns.setDomain('nonexistent-domain-xyz123.test'); // likely nonexistent in zones
      await dns.setQueryType('A');

      await dns.clickStartResolve();

      // Wait for resolution to finish with failure or success
      await dns.page.waitForFunction(() => {
        const el = document.getElementById('resolutionLog');
        if (!el) return false;
        return /Resolution (succeeded|failed)/i.test(el.textContent || '');
      }, { timeout: 5000 });

      const fullLog = await dns.getResolutionLogText();
      // Expect either a failed summary or NXDOMAIN messages; primarily ensure failures are reported
      const isFailed = /Resolution failed\./.test(fullLog) || /NXDOMAIN/i.test(fullLog);
      expect(isFailed).toBeTruthy();
    });

    test('Stepping controls behave correctly when iterating during resolution (StepNext/StepBack)', async () => {
      // Start a resolution but keep auto-step disabled to manipulate steps manually
      await dns.setAutoStep(false);
      await dns.setStepDelay(50);
      await dns.setMaxSteps(50);

      await dns.setDomain('www.example.com');
      await dns.setQueryType('A');

      // Start resolution -> one initial step is appended
      await dns.clickStartResolve();
      await dns.waitForLogContains('Starting resolution for www.example.com');

      // Repeatedly click Step Next until resolution finishes or some steps executed
      // We'll attempt up to 10 manual next steps to progress simulation
      for (let i = 0; i < 10; i++) {
        await dns.clickStepNext();
        // small delay to allow DOM updates
        await dns.page.waitForTimeout(40);
      }

      // Then step back a few times to ensure Step Back works
      for (let i = 0; i < 3; i++) {
        await dns.clickStepBack();
        await dns.page.waitForTimeout(20);
      }

      // Ensure no uncaught exceptions happened during manual stepping
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Cache, Zone Editor, and UI controls', () => {
    test('Clear Cache and Show Cache dialogs behave and are reported via dialog handler', async () => {
      // Ensure cache is empty by clicking Show Cache - should trigger alert "Resolver cache is empty."
      await dns.clickShowCache();

      // Wait briefly to allow dialog handler to record messages
      await page.waitForTimeout(50);

      // We recorded dialogs, the first one should indicate empty cache
      const found = dialogMessages.some(d => /Resolver cache is empty/i.test(d.message));
      expect(found).toBeTruthy();

      // Click Clear Cache: this triggers a confirm then an alert ("Resolver cache cleared.") if confirmed
      await dns.clickClearCache();

      // confirm() is auto-accepted by our handler; then an alert follows — ensure we recorded both messages
      await page.waitForTimeout(50);

      const hasClearAlert = dialogMessages.some(d => /Resolver cache cleared/i.test(d.message));
      expect(hasClearAlert).toBeTruthy();
    });

    test('Zone editor showZone, loadZone, clearZone and showZoneTree interactions', async () => {
      // The page initializes the zone editor with example.com; test showZone triggers alert with Zone: example.com.
      await dns.clickShowZone();
      await page.waitForTimeout(50);

      const showZoneDialog = dialogMessages.find(d => d.message.includes('Zone:'));
      expect(showZoneDialog).toBeTruthy();
      expect(showZoneDialog.message).toContain('example.com');

      // Clear zone editor inputs via Clear Zone and ensure inputs are cleared
      await dns.clickClearZone();
      await page.waitForTimeout(20);
      const zoneNameVal = await dns.zoneNameInput().then(i => i.inputValue());
      const soaVal = await dns.soaInput().then(i => i.inputValue());
      const recsVal = await dns.zoneRecordsInput().then(i => i.inputValue());
      expect(zoneNameVal).toBe('', 'Clear Zone should empty zone name');
      expect(soaVal).toBe('', 'Clear Zone should empty SOA');
      expect(recsVal).toBe('', 'Clear Zone should empty zone records');

      // Re-initialize by filling minimal zone inputs to test loadZone validation path
      await dns.zoneNameInput().then(i => i.fill('testzone.example'));
      // Intentionally leave soa empty to trigger an alert requiring SOA (the code shows an alert)
      await dns.clickLoadZone();
      await page.waitForTimeout(50);
      // We should have recorded an alert about SOA record text required
      const soaAlert = dialogMessages.some(d => /SOA record text is required/i.test(d.message));
      expect(soaAlert).toBeTruthy();

      // Now provide a valid SOA and minimal records, then load successfully
      await dns.soaInput().then(i => i.fill(`@ IN SOA ns1.testzone.example. hostmaster.testzone.example. (
  2024060601 ; serial
  7200 ; refresh
  3600 ; retry
  1209600 ; expire
  3600 ; minimum
)`));
      await dns.zoneRecordsInput().then(i => i.fill(`@ 3600 IN NS ns1.testzone.example.\nns1 3600 IN A 192.0.2.99`));

      await dns.clickLoadZone();
      // The code prompts alerts for success; wait for it
      await page.waitForTimeout(100);

      const loadedDialog = dialogMessages.find(d => /Zone .* loaded into simulator/i.test(d.message));
      // The alert message contains "Zone ... loaded into simulator" as per code
      expect(loadedDialog).toBeTruthy();

      // Show the zone tree and assert it contains the root and the new zone
      await dns.clickShowZoneTree();
      await page.waitForTimeout(50);
      const treeText = await dns.getZoneTreeText();
      expect(treeText).toContain('.', 'Zone tree should include root zone.');
      expect(treeText).toMatch(/testzone\.example/i);
    });

    test('Concept select change updates concept info display', async () => {
      // Choose DNS Cache concept and validate conceptInfo text changes accordingly
      await dns.clickConceptOption('dns_cache');
      await page.waitForTimeout(50);
      const info = await dns.getConceptInfoText();
      expect(info).toContain('DNS Cache', 'Selecting dns_cache should display cache information');

      // Choose a different concept and ensure content updates
      await dns.clickConceptOption('cname_chains');
      await page.waitForTimeout(50);
      const info2 = await dns.getConceptInfoText();
      expect(info2).toContain('CNAME', 'Selecting cname_chains should display CNAME info');
    });
  });

  test.describe('Edge cases and error observation', () => {
    test('Attempting startResolution with empty domain triggers an alert and does not throw', async () => {
      // Ensure domain input is empty
      await dns.setDomain('');
      // Click start -> should cause an alert "Please enter a domain to resolve."
      await dns.clickStartResolve();
      await page.waitForTimeout(50);

      const missingDomainAlert = dialogMessages.some(d => /Please enter a domain to resolve/i.test(d.message));
      expect(missingDomainAlert).toBeTruthy();

      // No uncaught page errors should be present
      expect(pageErrors.length).toBe(0);
    });

    test('Monitor console and page errors during typical usage: there should be no uncaught exceptions', async () => {
      // Perform a sequence of operations to exercise code paths
      await dns.setAutoStep(false);
      await dns.setStepDelay(50);
      await dns.setMaxSteps(40);

      // Valid resolution
      await dns.setDomain('alias.example.com');
      await dns.setQueryType('A');
      await dns.clickStartResolve();
      await dns.waitForLogContains('Starting resolution for alias.example.com');
      // Advance a few steps
      for (let i = 0; i < 5; i++) {
        await dns.clickStepNext();
        await page.waitForTimeout(30);
      }

      // Trigger show cache while cache may be non-empty: this will create alert(s)
      await dns.clickShowCache();
      await page.waitForTimeout(50);

      // After exercising UI, assert there were no uncaught runtime errors
      expect(pageErrors.length).toBe(0);

      // Collect any console.error messages - we don't expect any severe errors
      const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'exception' || m.type === 'warning');
      // It's acceptable to have warnings, but assert there are no fatal exceptions in console
      const hasFatal = consoleErrors.some(m => /ReferenceError|TypeError|SyntaxError/i.test(m.text));
      expect(hasFatal).toBeFalsy();
    });
  });
});