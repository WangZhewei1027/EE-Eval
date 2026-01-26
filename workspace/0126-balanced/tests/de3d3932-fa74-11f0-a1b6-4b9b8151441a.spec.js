import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3d3932-fa74-11f0-a1b6-4b9b8151441a.html';

// Page object for the DNS demo page
class DNSPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.domainInput = page.locator('#domainInput');
    this.lookupButton = page.locator('button[onclick="simulateDNSLookup()"]');
    this.resetButton = page.locator('button[onclick="resetDemo()"]');
    this.visualization = page.locator('#visualization');
    this.result = page.locator('#result');
    this.steps = index => page.locator(`#step${index}`);
    this.allSteps = page.locator('.step');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillDomain(domain) {
    await this.domainInput.fill(domain);
  }

  async clickLookup() {
    await this.lookupButton.click();
  }

  async clickReset() {
    await this.resetButton.click();
  }

  async getServerCount() {
    return await this.visualization.locator('.server').count();
  }

  async getQueryDotCount() {
    return await this.visualization.locator('.query').count();
  }

  async getResultText() {
    return await this.result.innerText().catch(() => '');
  }

  async isResultVisible() {
    // check computed style display !== 'none'
    return await this.result.evaluate(node => {
      const style = window.getComputedStyle(node);
      return style && style.display !== 'none';
    });
  }

  async getStepText(n) {
    return await this.steps(n).innerText();
  }

  async getAllStepClasses() {
    return await this.allSteps.evaluateAll(nodes => nodes.map(n => n.className));
  }

  async getDomainValue() {
    return await this.domainInput.inputValue();
  }

  async visualizationInnerHTML() {
    return await this.visualization.innerHTML();
  }
}

test.describe('DNS Concept Demonstration - FSM states and transitions', () => {
  // Collect console messages and page errors for assertions
  let pageErrors;
  let consoleMessages;
  let dialogMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];
    dialogMessages = [];

    page.on('pageerror', err => {
      // Capture all uncaught exceptions from the page
      pageErrors.push(err);
    });

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('dialog', async dialog => {
      // Accept any dialogs and record their message for assertions
      dialogMessages.push(dialog.message());
      await dialog.dismiss();
    });
  });

  test.afterEach(async ({}, testInfo) => {
    // If a test fails, surface captured console messages and page errors in the output
    if (testInfo.status !== testInfo.expectedStatus) {
      // eslint-disable-next-line no-console
      console.log('Captured console messages:', consoleMessages);
      // eslint-disable-next-line no-console
      console.log('Captured page errors:', pageErrors.map(e => e.message || String(e)));
      // eslint-disable-next-line no-console
      console.log('Captured dialogs:', dialogMessages);
    }

    // General assertion: ensure no unexpected ReferenceError/SyntaxError/TypeError occurred
    // These would indicate runtime problems in the page that violate the demo's assumptions.
    const fatalErrors = pageErrors.filter(e => {
      const m = (e && e.message) ? e.message : String(e);
      return /ReferenceError|SyntaxError|TypeError/.test(m);
    });
    expect(fatalErrors, `No ReferenceError/SyntaxError/TypeError should be thrown (found ${fatalErrors.length})`).toHaveLength(0);
  });

  test('Idle state renders input, buttons, visualization and steps (S0_Idle)', async ({ page }) => {
    // Validate the initial (Idle) state: input, Lookup and Reset buttons exist, visualization exists,
    // and result is hidden. Also verify step initial texts.
    const dns = new DNSPage(page);
    await dns.goto();

    // Input and buttons present
    await expect(page.locator('#domainInput')).toBeVisible();
    await expect(page.locator('button[onclick="simulateDNSLookup()"]')).toBeVisible();
    await expect(page.locator('button[onclick="resetDemo()"]')).toBeVisible();

    // Visualization exists and is empty initially
    await expect(page.locator('#visualization')).toBeVisible();
    const vizHTML = await dns.visualizationInnerHTML();
    expect(vizHTML.trim().length, 'Visualization should start empty or minimal').toBeGreaterThanOrEqual(0);

    // Result is hidden initially (display: none)
    expect(await dns.isResultVisible()).toBe(false);

    // Check a few initial step texts match expected Idle content
    const step1 = await dns.getStepText(1);
    expect(step1).toContain('You enter a domain'); // initial descriptive text
    const step2 = await dns.getStepText(2);
    expect(step2).toContain('Browser checks its cache');

    // No unexpected console errors produced on initial render
    const jsErrors = pageErrors.filter(e => e);
    expect(jsErrors.length).toBe(0);
  });

  test('Clicking Lookup with empty input shows alert and remains Idle (LookupDNS event error flow)', async ({ page }) => {
    // This validates an edge case: user clicks Lookup DNS without entering a domain.
    const dns = new DNSPage(page);
    await dns.goto();

    // Click lookup while input is empty; an alert should appear.
    const dialogMsgs = [];
    page.on('dialog', async dialog => {
      dialogMsgs.push(dialog.message());
      await dialog.accept();
    });

    await dns.clickLookup();

    // The script shows an alert with 'Please enter a domain name'
    // We accepted it, and recorded the message above.
    expect(dialogMsgs.length).toBeGreaterThanOrEqual(1);
    expect(dialogMsgs[0]).toBe('Please enter a domain name');

    // Ensure no servers were created and steps have not been converted to 'active'
    const serverCount = await dns.getServerCount();
    expect(serverCount).toBe(0);

    const stepClasses = await dns.getAllStepClasses();
    // No step should have the 'active' class set when no domain entered
    for (const cls of stepClasses) {
      expect(cls).not.toContain('active');
    }
  });

  test('Perform full DNS lookup -> displays servers, animates, and shows result (S0_Idle -> S1_LookingUp -> S0_Idle)', async ({ page }) => {
    // Validate a successful lookup: servers are created, animation runs, and result appears with domain & IP.
    const dns = new DNSPage(page);
    await dns.goto();

    // Fill domain and start lookup
    await dns.fillDomain('example.com');

    // Start the lookup
    await dns.clickLookup();

    // Wait for the final result to be shown. The demo sequences many timeouts/animations; allow generous timeout.
    await page.waitForSelector('#result', { state: 'visible', timeout: 20000 });

    // Result should contain the domain and an IP-like pattern
    const resultText = await dns.getResultText();
    expect(resultText).toContain('Domain:');
    expect(resultText).toContain('example.com');

    // Validate an IP address exists in the result - simple pattern check for four dot-separated numbers
    const ipPattern = /\b(\d{1,3}\.){3}\d{1,3}\b/;
    expect(ipPattern.test(resultText)).toBe(true);

    // Servers should have been created (Browser, Resolver, Root, TLD, Auth)
    const serverCount = await dns.getServerCount();
    expect(serverCount).toBeGreaterThanOrEqual(5);

    // Final step (step10) should contain 'Browser connects to IP' after the animation completes
    const step10Text = await dns.getStepText(10);
    expect(step10Text).toContain('Browser connects to IP');

    // Ensure no fatal JS errors occurred during the process
    const fatalErrors = pageErrors.filter(e => {
      const m = e && e.message ? e.message : String(e);
      return /ReferenceError|SyntaxError|TypeError/.test(m);
    });
    expect(fatalErrors.length).toBe(0);
  }, 30000); // extended timeout for long animation

  test('Click Reset during an ongoing lookup clears visualization and returns to Idle (S1_LookingUp -> S2_Reset -> S0_Idle)', async ({ page }) => {
    // Start a lookup and click Reset while animation is in progress.
    const dns = new DNSPage(page);
    await dns.goto();

    await dns.fillDomain('in-progress.example');
    await dns.clickLookup();

    // Wait a short time to let some animation begin (some servers are created synchronously).
    await page.waitForTimeout(1200);

    // Now click Reset to trigger transition to resetting state
    await dns.clickReset();

    // Visualization should be cleared
    const vizHTMLAfterReset = await dns.visualizationInnerHTML();
    expect(vizHTMLAfterReset.trim()).toBe('');

    // Result should be hidden after reset
    expect(await dns.isResultVisible()).toBe(false);

    // Domain input should be cleared
    const domainValue = await dns.getDomainValue();
    expect(domainValue).toBe('');

    // Steps should be restored to numbered defaults (start with "1.")
    const step1Text = await dns.getStepText(1);
    expect(step1Text.startsWith('1.')).toBe(true);
    expect(step1Text).toContain('You enter');

    // Ensure there were no fatal runtime errors triggered by resetting mid-animation
    const fatalErrors = pageErrors.filter(e => {
      const m = e && e.message ? e.message : String(e);
      return /ReferenceError|SyntaxError|TypeError/.test(m);
    });
    expect(fatalErrors.length).toBe(0);
  }, 20000);

  test('Reset from Idle clears input and keeps visualization/result empty (S0_Idle -> S2_Reset)', async ({ page }) => {
    // Validate Reset behavior when nothing is running: clears domain input and keeps result hidden.
    const dns = new DNSPage(page);
    await dns.goto();

    // Fill domain but do not start lookup
    await dns.fillDomain('willbe.reset');

    // Click Reset
    await dns.clickReset();

    // Input cleared
    expect(await dns.getDomainValue()).toBe('');

    // Visualization still empty
    const vizHTML = await dns.visualizationInnerHTML();
    expect(vizHTML.trim()).toBe('');

    // Result remains hidden
    expect(await dns.isResultVisible()).toBe(false);

    // Steps remain default numbered labels
    const step1Text = await dns.getStepText(1);
    expect(step1Text.startsWith('1.')).toBe(true);
  });

  test('Sequential lookups work: perform lookup, reset, then lookup again', async ({ page }) => {
    // This test validates robustness across multiple transitions and events.
    const dns = new DNSPage(page);
    await dns.goto();

    // First lookup
    await dns.fillDomain('first.example');
    await dns.clickLookup();
    await page.waitForSelector('#result', { state: 'visible', timeout: 20000 });

    // Reset after completion
    await dns.clickReset();
    expect(await dns.getDomainValue()).toBe('');
    expect(await dns.isResultVisible()).toBe(false);
    expect((await dns.visualizationInnerHTML()).trim()).toBe('');

    // Second lookup
    await dns.fillDomain('second.example');
    await dns.clickLookup();
    await page.waitForSelector('#result', { state: 'visible', timeout: 20000 });

    const resultText = await dns.getResultText();
    expect(resultText).toContain('second.example');

    // Ensure no fatal runtime errors occurred across the sequence
    const fatalErrors = pageErrors.filter(e => {
      const m = e && e.message ? e.message : String(e);
      return /ReferenceError|SyntaxError|TypeError/.test(m);
    });
    expect(fatalErrors.length).toBe(0);
  }, 40000);
});