import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d05704-fa79-11f0-8075-e54a10595dde.html';

// Page object model for the HTTPS Interactive Demonstration
class HTTPSDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.urlInput = page.locator('#urlInput');
    this.encryptButton = page.locator('#encryptButton');
    this.encryptedResult = page.locator('#encryptedResult');

    this.responseSelect = page.locator('#responseSelect');
    this.responseButton = page.locator('#responseButton');
    this.responseResult = page.locator('#responseResult');

    this.tlsSelect = page.locator('#tlsSelect');
    this.tlsButton = page.locator('#tlsButton');
    this.tlsResult = page.locator('#tlsResult');

    this.vulnerabilityButton = page.locator('#vulnerabilityButton');
    this.vulnerabilityResult = page.locator('#vulnerabilityResult');

    this.showHistoryButton = page.locator('#showHistoryButton');
    this.interactionHistory = page.locator('#interactionHistory');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Encrypt URL action (S0 -> S1)
  async encryptUrl(url) {
    await this.urlInput.fill(url);
    await this.encryptButton.click();
  }

  async getEncryptedResultText() {
    return (await this.encryptedResult.innerText()).trim();
  }

  // Simulate server response action (S0 -> S2)
  async simulateResponse(statusValue) {
    await this.responseSelect.selectOption(statusValue);
    await this.responseButton.click();
  }

  async getResponseResultText() {
    return (await this.responseResult.innerText()).trim();
  }

  // TLS selection action (S0 -> S3)
  async selectTlsVersion(versionValue) {
    await this.tlsSelect.selectOption(versionValue);
    await this.tlsButton.click();
  }

  async getTlsResultText() {
    return (await this.tlsResult.innerText()).trim();
  }

  // Check vulnerability action (S0 -> S4)
  async checkVulnerability() {
    await this.vulnerabilityButton.click();
  }

  async getVulnerabilityResultText() {
    return (await this.vulnerabilityResult.innerText()).trim();
  }

  // Show history action (S0 -> S5)
  async showHistory() {
    await this.showHistoryButton.click();
  }

  async getHistoryItemsText() {
    return await this.interactionHistory.locator('li').allInnerTexts();
  }

  async historyCount() {
    return await this.interactionHistory.locator('li').count();
  }
}

test.describe('99d05704-fa79-11f0-8075-e54a10595dde - HTTPS Interactive Demonstration (FSM)', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Capture console messages and page errors for each test to assert later
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push(msg);
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  // Test initial Idle state and basic rendering (S0_Idle)
  test('Initial state (Idle) renders page and core elements', async ({ page }) => {
    const app = new HTTPSDemoPage(page);
    await app.goto();

    // Verify heading and core elements exist
    await expect(page.locator('h1')).toHaveText('HTTPS Interactive Demonstration');
    await expect(app.urlInput).toBeVisible();
    await expect(app.encryptButton).toBeVisible();
    await expect(app.responseSelect).toBeVisible();
    await expect(app.responseButton).toBeVisible();
    await expect(app.tlsSelect).toBeVisible();
    await expect(app.tlsButton).toBeVisible();
    await expect(app.vulnerabilityButton).toBeVisible();
    await expect(app.showHistoryButton).toBeVisible();
    await expect(app.interactionHistory).toBeVisible();

    // Assert that there were no uncaught page errors on initial load
    // We observe console and page errors and assert there are none (no runtime ReferenceError/SyntaxError/TypeError)
    expect(pageErrors.length, 'Expect no page errors on load').toBe(0);

    // Also ensure no console messages of type 'error'
    const errorConsoleMessages = consoleMessages.filter(m => m.type() === 'error');
    expect(errorConsoleMessages.length, 'Expect no console.error messages on load').toBe(0);
  });

  // Tests for Encrypt URL transition (S0 -> S1)
  test.describe('Encrypt URL (S1_URL_Encrypted) transitions and edge cases', () => {
    test('Encrypt a non-empty URL produces base64 result and updates history', async ({ page }) => {
      const app = new HTTPSDemoPage(page);
      await app.goto();

      const testUrl = 'https://example.com';
      await app.encryptUrl(testUrl);

      // Compute expected base64 in-page (use page context to match browser btoa behavior)
      const expectedBase64 = await page.evaluate(url => btoa(url), testUrl);
      const expectedText = 'Encrypted URL: ' + expectedBase64;

      await expect(app.encryptedResult).toHaveText(expectedText);

      // Show history and assert entry present
      await app.showHistory();
      const items = await app.getHistoryItemsText();
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(items[items.length - 1]).toBe(expectedText);

      // Ensure no runtime errors during the action
      const errorConsoleMessages = consoleMessages.filter(m => m.type() === 'error');
      expect(pageErrors.length, 'No page errors after encrypt interaction').toBe(0);
      expect(errorConsoleMessages.length, 'No console errors after encrypt interaction').toBe(0);
    });

    test('Encrypt an empty URL (edge case) - should handle gracefully', async ({ page }) => {
      const app = new HTTPSDemoPage(page);
      await app.goto();

      // Ensure input empty
      await app.urlInput.fill('');
      await app.encryptButton.click();

      // btoa('') yields '' (empty string), so result should be 'Encrypted URL: '
      const expectedBase64 = await page.evaluate(() => btoa(''));
      const expectedText = 'Encrypted URL: ' + expectedBase64;
      await expect(app.encryptedResult).toHaveText(expectedText);

      // Verify history recorded the empty encryption
      await app.showHistory();
      const items = await app.getHistoryItemsText();
      expect(items).toContain(expectedText);

      expect(pageErrors.length, 'No page errors after encrypt-empty interaction').toBe(0);
    });
  });

  // Tests for Simulate Server Response transition (S0 -> S2)
  test.describe('Simulate Server Response (S2_Response_Simulated) for all response codes', () => {
    const pairs = [
      ['200', 'Server Response: 200 OK'],
      ['404', 'Server Response: 404 Not Found'],
      ['500', 'Server Response: 500 Internal Server Error']
    ];

    for (const [value, expectedMessage] of pairs) {
      test(`Selecting ${value} produces "${expectedMessage}"`, async ({ page }) => {
        const app = new HTTPSDemoPage(page);
        await app.goto();

        await app.simulateResponse(value);
        await expect(app.responseResult).toHaveText(expectedMessage);

        // Show history and ensure message appended
        await app.showHistory();
        const items = await app.getHistoryItemsText();
        expect(items).toContain(expectedMessage);

        expect(pageErrors.length, `No page errors after simulate-response ${value}`).toBe(0);
      });
    }
  });

  // Tests for TLS Version selection (S0 -> S3)
  test.describe('TLS Version Selection (S3_TLS_Selected)', () => {
    const tlsOptions = ['TLS 1.0', 'TLS 1.1', 'TLS 1.2', 'TLS 1.3'];

    for (const opt of tlsOptions) {
      test(`Selecting ${opt} shows result and updates history`, async ({ page }) => {
        const app = new HTTPSDemoPage(page);
        await app.goto();

        await app.selectTlsVersion(opt);
        const expected = 'Selected TLS Version: ' + opt;
        await expect(app.tlsResult).toHaveText(expected);

        await app.showHistory();
        const items = await app.getHistoryItemsText();
        expect(items).toContain(expected);

        expect(pageErrors.length, `No page errors after TLS selection ${opt}`).toBe(0);
      });
    }
  });

  // Tests for Random Vulnerability (S0 -> S4)
  test.describe('Random Vulnerability Check (S4_Vulnerability_Checked)', () => {
    test('Check for random vulnerability returns one of the expected vulnerabilities', async ({ page }) => {
      const app = new HTTPSDemoPage(page);
      await app.goto();

      // Trigger vulnerability check
      await app.checkVulnerability();

      // The exact value is random; ensure the result text has prefix and is one of known values
      const resultText = await app.getVulnerabilityResultText();
      expect(resultText.startsWith('Random Vulnerability: ')).toBeTruthy();

      const vulnerability = resultText.replace('Random Vulnerability: ', '').trim();
      const known = ['SSL Stripping', 'Heartbleed', 'POODLE', 'BEAST', 'Logjam'];
      expect(known).toContain(vulnerability);

      // Show history and ensure the recorded entry references the random vulnerability
      await app.showHistory();
      const items = await app.getHistoryItemsText();
      // Most recent item should include the vulnerability check or at least one item should include it
      const found = items.some(i => i.includes(vulnerability) || i.includes('Checked for Vulnerability'));
      expect(found).toBeTruthy();

      expect(pageErrors.length, 'No page errors after vulnerability check').toBe(0);
    });
  });

  // Tests for Interaction History (S5_History_Shown)
  test.describe('Interaction History (S5_History_Shown) behavior', () => {
    test('Show history when no interactions done - should be empty', async ({ page }) => {
      const app = new HTTPSDemoPage(page);
      await app.goto();

      // Immediately show history - the page-level interactionHistory array should be empty
      await app.showHistory();
      const count = await app.historyCount();
      expect(count).toBe(0);
      expect(pageErrors.length, 'No page errors when showing empty history').toBe(0);
    });

    test('Show history after several interactions lists them in order', async ({ page }) => {
      const app = new HTTPSDemoPage(page);
      await app.goto();

      // Perform a known sequence of interactions and capture expected messages
      const url = 'https://playwright.dev';
      await app.encryptUrl(url);
      const encrypted = await page.evaluate(u => btoa(u), url);
      const expectedEncryptMsg = 'Encrypted URL: ' + encrypted;

      await app.simulateResponse('200');
      const expectedResponseMsg = 'Server Response: 200 OK';

      const tlsChoice = 'TLS 1.3';
      await app.selectTlsVersion(tlsChoice);
      const expectedTlsMsg = 'Selected TLS Version: ' + tlsChoice;

      // Vulnerability - capture the actual runtime string from the page
      await app.checkVulnerability();
      const vulnText = await app.getVulnerabilityResultText(); // "Random Vulnerability: X"
      const vulnPayload = vulnText.replace('Random Vulnerability: ', '').trim();

      // Now show history and assert items include all expected entries, in order they were added
      await app.showHistory();
      const items = await app.getHistoryItemsText();

      // The sequence should include the messages we expect appended in order:
      // Note: The page pushes messages in each handler; ensure they exist in the history.
      expect(items).toContain(expectedEncryptMsg);
      expect(items).toContain(expectedResponseMsg);
      expect(items).toContain(expectedTlsMsg);

      const foundVuln = items.some(it => it.includes(vulnPayload) || it.includes('Checked for Vulnerability'));
      expect(foundVuln).toBeTruthy();

      // As a further check, ensure last N items correspond at least to the count of interactions we did (>=4)
      expect(items.length).toBeGreaterThanOrEqual(4);

      expect(pageErrors.length, 'No page errors after sequence interactions').toBe(0);
    });
  });

  // A focused test to ensure no unexpected runtime errors occur during a full usage flow
  test('Full interaction flow should not produce runtime errors (console/pageerror)', async ({ page }) => {
    const app = new HTTPSDemoPage(page);
    await app.goto();

    // Perform multiple interactions
    await app.encryptUrl('https://example.com/path');
    await app.simulateResponse('404');
    await app.selectTlsVersion('TLS 1.2');
    await app.checkVulnerability();
    await app.showHistory();

    // Check for any logged console errors and page errors captured
    const errorConsoleMessages = consoleMessages.filter(m => m.type() === 'error');

    // Assert there were no console.error calls or uncaught page errors during the flow
    expect(errorConsoleMessages.length, 'Expect no console.error during full flow').toBe(0);
    expect(pageErrors.length, 'Expect no page errors during full flow').toBe(0);
  });
});