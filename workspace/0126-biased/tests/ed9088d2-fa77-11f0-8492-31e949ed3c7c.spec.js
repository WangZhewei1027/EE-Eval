import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed9088d2-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object for the Hash Functions Visualization page
class HashPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.generateSelector = '#generateHash';
    this.hashOutputSelector = '#hashOutput';
    this.headingSelector = 'h1';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getHeadingText() {
    return (await this.page.locator(this.headingSelector).textContent())?.trim();
  }

  async getHashText() {
    const el = this.page.locator(this.hashOutputSelector);
    return (await el.textContent())?.trim();
  }

  async clickGenerate() {
    await this.page.click(this.generateSelector);
  }

  async waitForHashChange(previousValue, timeout = 2000) {
    // Wait for the hash output text to change from previousValue
    await this.page.waitForFunction(
      ({ selector, prev }) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        return el.textContent.trim() !== prev;
      },
      { selector: this.hashOutputSelector, prev: previousValue },
      { timeout }
    );
    return this.getHashText();
  }

  async isHashOutputVisible() {
    const box = await this.page.locator(this.hashOutputSelector).boundingBox();
    return box !== null;
  }

  async getHashComputedStyle(property) {
    return this.page.$eval(this.hashOutputSelector, (el, prop) => {
      return window.getComputedStyle(el).getPropertyValue(prop);
    }, property);
  }
}

test.describe('Hash Functions Visualization - FSM tests', () => {
  let page;
  let hashPage;
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ browser }) => {
    // Create a fresh context per test to avoid cross-test contamination
    const context = await browser.newContext();
    page = await context.newPage();

    // Collect console messages and page errors for assertions later
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Collect thrown errors (uncaught exceptions)
      pageErrors.push(err);
    });

    hashPage = new HashPage(page);
    await hashPage.goto();
  });

  test.afterEach(async () => {
    // Close page/context to clean up
    await page.close();
  });

  test('S0_Idle: Initial render shows heading, initial hash, and Generate Hash button', async () => {
    // Validate initial UI elements per FSM S0_Idle evidence
    const heading = await hashPage.getHeadingText();
    expect(heading).toBe('Understanding Hash Functions');

    // The generate button should be present and visible
    const button = page.locator('#generateHash');
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Generate Hash');

    // The initial hash output should match the static content in the provided HTML
    const initialHash = await hashPage.getHashText();
    expect(initialHash).toBe('Hash: 12345abcde');

    // Ensure no uncaught page errors occurred during initial load
    expect(pageErrors.length).toBe(0);

    // Ensure there are no console error messages on load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // The FSM mentions an entry action renderPage(); confirm that the global function is not present (we must not inject it)
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    // Expect it to be 'undefined' because the implementation did not define renderPage
    expect(renderPageType).toBe('undefined');
  });

  test('Transition GenerateHashClick: clicking Generate Hash updates the hashOutput (S0 -> S1)', async () => {
    // Capture the previous hash value
    const previous = await hashPage.getHashText();
    expect(previous).toBe('Hash: 12345abcde');

    // Click the generate button and wait for the DOM to update
    await hashPage.clickGenerate();

    // Wait for the hash text to change
    const newHash = await hashPage.waitForHashChange(previous, 3000);
    expect(newHash).not.toBe(previous);

    // Validate format of generated hash: prefix and alphanumeric lowercase (Math.random().toString(36) produces lowercase)
    const match = /^Hash:\s[a-z0-9]{1,13}$/.test(newHash || '');
    expect(match).toBe(true);

    // No uncaught page errors on interaction
    expect(pageErrors.length).toBe(0);

    // No console errors emitted as a result of the click
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Repeated clicks produce updated hashes and DOM updates each time', async () => {
    // Perform multiple clicks and collect values
    const seen = new Set();
    const clicks = 5;

    // Start from the initial hash
    let previous = await hashPage.getHashText();
    seen.add(previous);

    for (let i = 0; i < clicks; i++) {
      await hashPage.clickGenerate();
      // wait for change relative to previous
      const updated = await hashPage.waitForHashChange(previous, 3000);
      expect(updated).toBeTruthy();
      // Each new value should be a string prefixed by 'Hash: '
      expect(updated.startsWith('Hash: ')).toBe(true);
      seen.add(updated);
      previous = updated;
    }

    // We expect at least some of the generated values to be unique (very likely)
    // Ensure the set has size > 1 (initial + some generated)
    expect(seen.size).toBeGreaterThan(1);

    // Confirm no uncaught exceptions happened during rapid sequence
    expect(pageErrors.length).toBe(0);

    // Confirm no console error logs recorded
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Rapid sequential clicks (edge case) do not cause runtime errors and DOM remains stable', async () => {
    // Rapidly click the button multiple times without awaiting each update
    const rapidClicks = 10;
    const clickPromises = [];

    for (let i = 0; i < rapidClicks; i++) {
      clickPromises.push(hashPage.clickGenerate());
    }
    // Wait for all click actions to be issued
    await Promise.all(clickPromises);

    // Wait a short time for final DOM update
    await page.waitForTimeout(500);

    // Ensure the hash output element still exists and shows a valid hash string
    const finalHash = await hashPage.getHashText();
    expect(finalHash).toBeTruthy();
    expect(/^Hash:\s[a-z0-9]{1,13}$/.test(finalHash)).toBe(true);

    // Ensure element is still present in the DOM and visible (bounding box exists)
    const isVisible = await hashPage.isHashOutputVisible();
    expect(isVisible).toBe(true);

    // Assert no page errors were thrown during rapid interactions
    expect(pageErrors.length).toBe(0);

    // Assert no console error messages were logged
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Visual and style checks for hashOutput element (ensures expected visual feedback exists)', async () => {
    // The CSS in the page animates the hash-output element; ensure it exists and has expected styling properties
    const elPresent = await page.$('#hashOutput');
    expect(elPresent).not.toBeNull();

    // Check computed font-size and opacity property presence (string values)
    const fontSize = await hashPage.getHashComputedStyle('font-size');
    expect(typeof fontSize).toBe('string');
    expect(fontSize.length).toBeGreaterThan(0);

    const opacity = await hashPage.getHashComputedStyle('opacity');
    // opacity might be '0' at initial due to animation delays; ensure it is a valid numeric string
    expect(Number.isFinite(Number(opacity))).toBe(true);

    // No runtime errors related to visuals
    expect(pageErrors.length).toBe(0);
  });

  test('Observation summary: collect and assert console/page error status (we observe and report any errors)', async () => {
    // This test intentionally collects console and page errors and asserts their counts.
    // According to "let errors happen naturally", we do not inject or modify the page.
    // Instead, we assert the observed status.

    // Provide human-readable diagnostics in assertion messages by checking there are no uncaught exceptions.
    expect(pageErrors.length, `Expected no uncaught page errors, observed: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);

    // Expect no console.error messages were emitted
    const consoleErrorEntries = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorEntries.length, `Expected no console.error messages, observed: ${consoleErrorEntries.map(c => c.text).join(' | ')}`).toBe(0);

    // Additionally confirm that no ReferenceError / SyntaxError / TypeError were observed in the page error list
    const errorNames = pageErrors.map(e => e.name);
    expect(errorNames.includes('ReferenceError')).toBe(false);
    expect(errorNames.includes('SyntaxError')).toBe(false);
    expect(errorNames.includes('TypeError')).toBe(false);
  });
});