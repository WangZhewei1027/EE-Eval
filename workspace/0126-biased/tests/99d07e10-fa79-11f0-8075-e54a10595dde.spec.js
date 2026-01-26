import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d07e10-fa79-11f0-8075-e54a10595dde.html';

// Page Object encapsulating interactions with the DNS exploration app
class DnsPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      domain: '#domain',
      recordType: '#record-type',
      lookupBtn: '#lookup-btn',
      timeoutInput: '#timeout',
      setTimeoutBtn: '#set-timeout-btn',
      ipv4Input: '#ipv4',
      resolveIpBtn: '#resolve-ip-btn',
      clearBtn: '#clear-btn',
      output: '#output',
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getOutputText() {
    return this.page.locator(this.selectors.output).textContent();
  }

  async fillDomain(value) {
    await this.page.fill(this.selectors.domain, value);
  }

  async selectRecordType(value) {
    await this.page.selectOption(this.selectors.recordType, value);
  }

  async clickLookup() {
    await this.page.click(this.selectors.lookupBtn);
  }

  async fillTimeout(value) {
    // Use fill to set the value attribute
    await this.page.fill(this.selectors.timeoutInput, String(value));
  }

  async clickSetTimeout() {
    await this.page.click(this.selectors.setTimeoutBtn);
  }

  async fillIPv4(value) {
    await this.page.fill(this.selectors.ipv4Input, value);
  }

  async clickResolveIp() {
    await this.page.click(this.selectors.resolveIpBtn);
  }

  async clickClear() {
    await this.page.click(this.selectors.clearBtn);
  }

  // Wait until output contains the provided substring (with a reasonable timeout)
  async waitForOutputContains(substring, opts = { timeout: 3000 }) {
    await this.page.waitForFunction(
      (sel, text) => document.querySelector(sel).textContent.includes(text),
      this.selectors.output,
      substring,
      opts
    );
  }

  // Wait until output no longer contains any text (used after Clear History)
  async waitForOutputEmpty(opts = { timeout: 2000 }) {
    await this.page.waitForFunction(
      (sel) => document.querySelector(sel).textContent === '',
      this.selectors.output,
      opts
    );
  }
}

test.describe('Interactive DNS Exploration - FSM behavior and UI tests', () => {
  let dnsPage;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Setup collectors for console messages and page errors to observe runtime behavior
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    dnsPage = new DnsPage(page);
    await dnsPage.goto();
  });

  test.afterEach(async () => {
    // Basic assertion: no unexpected runtime errors surfaced on the page
    // If there are page errors, fail the test with details so they are visible in the test output.
    expect(pageErrors, 'No page errors should have occurred').toHaveLength(0);
    // Also assert that the page emitted no console.error messages
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors, 'No console.error messages should have occurred').toHaveLength(0);
  });

  test('Initial Idle state renders expected UI elements (S0_Idle)', async () => {
    // Validate that the page rendered the expected controls for the Idle state
    // - domain input with placeholder
    // - record type select
    // - all buttons present
    const domain = dnsPage.page.locator(dnsPage.selectors.domain);
    await expect(domain).toBeVisible();
    await expect(domain).toHaveAttribute('placeholder', 'example.com');

    const recordType = dnsPage.page.locator(dnsPage.selectors.recordType);
    await expect(recordType).toBeVisible();
    // default option should exist
    await expect(recordType.locator('option[value="A"]')).toBeVisible();

    await expect(dnsPage.page.locator(dnsPage.selectors.lookupBtn)).toBeVisible();
    await expect(dnsPage.page.locator(dnsPage.selectors.setTimeoutBtn)).toBeVisible();
    await expect(dnsPage.page.locator(dnsPage.selectors.resolveIpBtn)).toBeVisible();
    await expect(dnsPage.page.locator(dnsPage.selectors.clearBtn)).toBeVisible();

    // Output area should initially be empty (evidence of entry action renderPage)
    const outputText = await dnsPage.getOutputText();
    expect(outputText.trim(), 'Output area should be empty on initial render').toBe('');
  });

  test('Setting timeout updates timeoutValue and emits message (S2_SettingTimeout)', async () => {
    // This validates the SetTimeout event/transition.
    // Fill a new timeout value and click the Set Timeout button.
    // Then assert that the output contains the expected "Timeout set to X ms." message.
    await dnsPage.fillTimeout('500'); // set to smaller value to speed subsequent waits
    await dnsPage.clickSetTimeout();

    await dnsPage.waitForOutputContains('Timeout set to 500 ms.');
    const output = await dnsPage.getOutputText();
    expect(output).toContain('Timeout set to 500 ms.');
  });

  test('Lookup flow produces looking-up message and a simulated response (S1_LookingUp)', async () => {
    // Validate Lookup event transitions the app into the Looking Up state and then outputs a response.
    // 1) Ensure timeout is small to keep test fast
    await dnsPage.fillTimeout('500');
    await dnsPage.clickSetTimeout();
    await dnsPage.waitForOutputContains('Timeout set to 500 ms.');

    // 2) Fill domain and pick a record type
    await dnsPage.fillDomain('example.com');
    await dnsPage.selectRecordType('MX');

    // 3) Click Look Up and verify immediate "Looking up ..." message
    await dnsPage.clickLookup();
    await dnsPage.waitForOutputContains('Looking up MX record for example.com...');

    // 4) After the configured delay the simulated DNS response should appear
    await dnsPage.waitForOutputContains('Response for example.com: MX record found!', { timeout: 3000 });
    const out = await dnsPage.getOutputText();
    expect(out).toContain('Looking up MX record for example.com...');
    expect(out).toContain('Response for example.com: MX record found!');
  });

  test('Resolve from IP flow produces resolving message and response (S3_ResolvingFromIP)', async () => {
    // Validate ResolveFromIP event transitions the app into the Resolving From IP state and
    // outputs both the "Resolving domain from IP ..." and the simulated response.

    // Ensure timeout small
    await dnsPage.fillTimeout('500');
    await dnsPage.clickSetTimeout();
    await dnsPage.waitForOutputContains('Timeout set to 500 ms.');

    // Fill IPv4 and trigger resolve
    await dnsPage.fillIPv4('192.0.2.1');
    await dnsPage.clickResolveIp();

    // Check immediate resolving message
    await dnsPage.waitForOutputContains('Resolving domain from IP 192.0.2.1...');
    // Then check delayed simulated response
    await dnsPage.waitForOutputContains('Response: Domain for 192.0.2.1 found!', { timeout: 3000 });

    const out = await dnsPage.getOutputText();
    expect(out).toContain('Resolving domain from IP 192.0.2.1...');
    expect(out).toContain('Response: Domain for 192.0.2.1 found!');
  });

  test('Clear History clears the output area (S4_ClearingHistory)', async () => {
    // Produce some output, then click Clear History and validate output area is empty.

    // Produce output via a lookup
    await dnsPage.fillTimeout('500');
    await dnsPage.clickSetTimeout();
    await dnsPage.waitForOutputContains('Timeout set to 500 ms.');

    await dnsPage.fillDomain('to-clear.example');
    await dnsPage.selectRecordType('A');
    await dnsPage.clickLookup();
    await dnsPage.waitForOutputContains('Looking up A record for to-clear.example...');
    await dnsPage.waitForOutputContains('Response for to-clear.example: A record found!', { timeout: 3000 });

    // Now clear history
    await dnsPage.clickClear();
    await dnsPage.waitForOutputEmpty();

    const out = await dnsPage.getOutputText();
    expect(out.trim()).toBe('');
  });

  test('Edge case: empty domain on lookup still produces looking-up and response lines', async () => {
    // If domain input is empty, the app will still attempt a lookup. We assert that behavior (no crash).
    await dnsPage.fillTimeout('500');
    await dnsPage.clickSetTimeout();
    await dnsPage.waitForOutputContains('Timeout set to 500 ms.');

    // Clear domain explicitly
    await dnsPage.fillDomain('');
    await dnsPage.selectRecordType('TXT');

    await dnsPage.clickLookup();
    // Should log a looking-up message even when domain is empty
    await dnsPage.waitForOutputContains('Looking up TXT record for ...');
    // And also eventually produce a response line for the empty domain
    await dnsPage.waitForOutputContains('Response for : TXT record found!', { timeout: 3000 });

    const out = await dnsPage.getOutputText();
    expect(out).toContain('Looking up TXT record for ');
    expect(out).toContain('Response for : TXT record found!');
  });

  test('Edge case: setting timeout to non-numeric manifests as NaN in output', async () => {
    // The application uses parseInt on the timeout input; non-numeric input should result in NaN and this should be observable in output.
    await dnsPage.fillTimeout('abc'); // non-numeric
    await dnsPage.clickSetTimeout();

    // Expect the output to reflect the parsed value (NaN)
    await dnsPage.waitForOutputContains('Timeout set to NaN ms.');
    const out = await dnsPage.getOutputText();
    expect(out).toContain('Timeout set to NaN ms.');

    // When NaN is used for delays, setTimeout will treat it effectively as 0; ensure subsequent lookup still completes quickly.
    await dnsPage.fillDomain('example.invalid');
    await dnsPage.selectRecordType('A');
    await dnsPage.clickLookup();

    // Because the timeout became NaN (-> 0 delay), the response should appear promptly
    await dnsPage.waitForOutputContains('Response for example.invalid: A record found!', { timeout: 2000 });
    expect(await dnsPage.getOutputText()).toContain('Response for example.invalid: A record found!');
  });
});