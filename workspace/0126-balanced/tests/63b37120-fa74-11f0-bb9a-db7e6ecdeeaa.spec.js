import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b37120-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page object encapsulating interactions with the DNS demo page
class DNSPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.form = page.locator('#dns-form');
    this.input = page.locator('#domain-input');
    this.button = page.locator('#dns-form button');
    this.result = page.locator('#result');
  }

  // Navigate to the demo page
  async goto() {
    await this.page.goto(BASE_URL);
  }

  // Fill the domain input (replaces any content)
  async fillDomain(domain) {
    await this.input.fill(domain);
  }

  // Submit the form (by clicking the Resolve button)
  async submit() {
    await Promise.all([
      // Click is the user action; the page's JS prevents default navigation.
      this.button.click(),
    ]);
  }

  // Convenience: fill and submit
  async resolveDomain(domain) {
    await this.fillDomain(domain);
    await this.submit();
  }

  // Get result innerText and innerHTML
  async getResultText() {
    return (await this.result.innerText()).trim();
  }

  async getResultHTML() {
    return (await this.result.innerHTML()).trim();
  }

  // Get count of list items under result (for IP lists)
  async getResultListItemCount() {
    return await this.result.locator('li').count();
  }
}

// Global test hooks to collect console errors and uncaught page errors
test.describe('DNS Concept Demo - FSM states and transitions', () => {
  // Arrays to collect runtime issues observed while interacting with the page
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages of type 'error' for later assertions
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) {
        // In case msg.type() throws (very rare), still record the raw text
        consoleErrors.push({ text: String(msg), location: {} });
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });

    // Navigate to the page before each test
    await page.goto(BASE_URL);
  });

  test.afterEach(async () => {
    // Ensure there were no runtime console errors or uncaught exceptions
    // These assertions verify that the page JavaScript executed without throwing uncaught errors
    expect(consoleErrors, `Console errors were emitted: ${JSON.stringify(consoleErrors, null, 2)}`).toHaveLength(0);
    expect(pageErrors, `Uncaught page errors: ${JSON.stringify(pageErrors, null, 2)}`).toHaveLength(0);
  });

  test('Initial state (Idle) renders the form, input and result container', async ({ page }) => {
    // This test validates the S0_Idle state: page rendered, form and input present with correct attributes
    const dns = new DNSPage(page);

    // Assert form exists
    await expect(dns.form).toBeVisible();

    // Input exists, has placeholder and required attribute
    await expect(dns.input).toBeVisible();
    await expect(dns.input).toHaveAttribute('placeholder', 'e.g. example.com');
    await expect(dns.input).toHaveAttribute('required', '');

    // Button exists and its text is "Resolve"
    await expect(dns.button).toBeVisible();
    await expect(dns.button).toHaveText('Resolve');

    // Result container exists and has aria-live="polite"
    await expect(dns.result).toBeVisible();
    await expect(dns.result).toHaveAttribute('aria-live', 'polite');

    // Ensure result is empty at initial render
    const text = await dns.getResultText();
    expect(text).toBe('');
  });

  test('Submitting empty input shows validation message (edge case)', async ({ page }) => {
    // This test exercises the guard for empty domain input
    const dns1 = new DNSPage(page);

    // Ensure input is empty (simulate user submitting without entering anything)
    await dns.fillDomain('');
    const beforeUrl = page.url();

    // Submit the form
    await dns.submit();

    // Page should not navigate away (submit handler calls e.preventDefault())
    expect(page.url()).toBe(beforeUrl);

    // The result should show the "Please enter a domain name." message
    const resultText = await dns.getResultText();
    expect(resultText).toContain('Please enter a domain name.');

    // Visual check: result HTML contains <em> tag for the message
    const resultHTML = await dns.getResultHTML();
    expect(resultHTML).toContain('<em>');
    expect(resultHTML).toContain('Please enter a domain name.');
  });

  test('Invalid domain format transitions to Invalid Domain Format state (S3_InvalidDomainFormat)', async ({ page }) => {
    // This test submits a syntactically invalid domain and verifies the specific error output
    const dns2 = new DNSPage(page);

    // Choose a clearly invalid domain string that fails the domainRegex and singleLabelRegex
    const invalidDomain = 'inva lid!!'; // spaces and exclamation marks -> invalid

    // Fill and submit
    await dns.resolveDomain(invalidDomain);

    // Result should indicate invalid domain format and include the sanitized input in the message
    const resultText1 = await dns.getResultText();
    expect(resultText).toMatch(/is not a valid domain name format/);

    // Verify the sanitized domain appears (quotes are included in the message per implementation)
    const resultHTML1 = await dns.getResultHTML();
    // sanitized content should not include raw characters like < or >
    expect(resultHTML).toContain(`is not a valid domain name format.`);
    // The invalid input string should be present in the message (sanitized)
    expect(resultHTML).toContain('inva lid!!');
  });

  test('Domain not in demo DNS table transitions to Domain Not Found state (S4_DomainNotFound)', async ({ page }) => {
    // This test provides a well-formed domain that is not present in the dnsTable
    const dns3 = new DNSPage(page);

    const unknownDomain = 'not-in-table-example.test';

    await dns.resolveDomain(unknownDomain);

    // Expect a "could not be resolved in this demo DNS table" message
    const resultText2 = await dns.getResultText();
    expect(resultText).toMatch(/could not be resolved in this demo DNS table/);

    // Inspect HTML to ensure domain is wrapped in <strong> inside the message per implementation
    const resultHTML2 = await dns.getResultHTML();
    expect(resultHTML).toContain('<strong>');
    expect(resultHTML).toContain(unknownDomain);
  });

  test('Valid domain resolves to IP address(es) (S2_ValidDomain) - single IP example.com', async ({ page }) => {
    // This test verifies that a known domain from dnsTable resolves and shows the IP list
    const dns4 = new DNSPage(page);

    await dns.resolveDomain('example.com');

    // Should display "Domain:" and "Resolved IP address"
    const resultText3 = await dns.getResultText();
    expect(resultText).toMatch(/Domain:/);
    expect(resultText).toMatch(/Resolved IP address/);

    // example.com has one IP in the demo table -> ensure exactly one list item displayed and correct IP
    const liCount = await dns.getResultListItemCount();
    expect(liCount).toBe(1);

    const resultHTML3 = await dns.getResultHTML();
    expect(resultHTML).toContain('93.184.216.34');
  });

  test('Valid domain with multiple IPs shows pluralized label and correct count (google.com)', async ({ page }) => {
    // This test checks pluralization and multiple IP rendering for Google
    const dns5 = new DNSPage(page);

    await dns.resolveDomain('google.com');

    // Google entry in demo dnsTable includes multiple IPs
    const resultText4 = await dns.getResultText();
    // Should mention "Resolved IP address" followed by "es" when more than one IP present
    expect(resultText).toMatch(/Resolved IP addresses/);

    const liCount1 = await dns.getResultListItemCount();
    expect(liCount).toBeGreaterThan(1);

    // Ensure each IP string appears in the list HTML
    const resultHTML4 = await dns.getResultHTML();
    expect(resultHTML).toContain('142.250.190.14');
    expect(resultHTML).toContain('142.250.190.78');
  });

  test('Single-label domain allowed (localhost) resolves to 127.0.0.1', async ({ page }) => {
    // The demo allows single-label domains via singleLabelRegex (e.g., "localhost")
    const dns6 = new DNSPage(page);

    await dns.resolveDomain('localhost');

    const resultText5 = await dns.getResultText();
    expect(resultText).toMatch(/Domain:/);
    expect(resultText).toMatch(/Resolved IP address/);

    const resultHTML5 = await dns.getResultHTML();
    expect(resultHTML).toContain('127.0.0.1');
  });

  test('Trimming and lowercasing: whitespace and uppercase domain is normalized before resolution', async ({ page }) => {
    // This test ensures input is trimmed and lowercased by the JS before lookup (example: "  EXAMPLE.COM  ")
    const dns7 = new DNSPage(page);

    await dns.resolveDomain('   EXAMPLE.COM   ');

    // The displayed domain should be sanitized and shown in lowercase per implementation (domain is lowercased)
    const resultText6 = await dns.getResultText();
    // Check that the domain is present and resolved
    expect(resultText.toLowerCase()).toContain('example.com');
    const resultHTML6 = await dns.getResultHTML();
    expect(resultHTML).toContain('93.184.216.34');
  });

  test('Submitting the form does not trigger navigation (verifies e.preventDefault() in submit handler)', async ({ page }) => {
    // This test specifically verifies the S0 -> S1 transition where the submit handler calls e.preventDefault()
    const dns8 = new DNSPage(page);

    const initialUrl = page.url();
    await dns.fillDomain('example.com');

    // Listen for frame navigations which would indicate a page navigation occurred
    let navigated = false;
    page.on('framenavigated', () => {
      navigated = true;
    });

    // Submit and short wait to observe potential navigation
    await dns.submit();
    // small delay to allow any navigation to occur if it would
    await page.waitForTimeout(200);

    // Confirm no navigation happened
    expect(navigated).toBe(false);
    expect(page.url()).toBe(initialUrl);

    // Confirm the expected resolution happened (to ensure the submit handler ran)
    const resultText7 = await dns.getResultText();
    expect(resultText).toContain('Resolved IP address');
  });
});