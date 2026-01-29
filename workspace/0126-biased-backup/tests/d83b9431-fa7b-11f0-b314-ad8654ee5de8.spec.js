import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83b9431-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object for the demo area to encapsulate interactions and queries
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('button#demoBtn');
    this.area = page.locator('#demoArea');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // ensure the elements are present before proceeding
    await expect(this.button).toBeVisible();
    await expect(this.area).toBeVisible(); // area exists but may be hidden via CSS
  }

  async getButtonText() {
    return (await this.button.textContent()) ?? '';
  }

  async getAriaExpanded() {
    return (await this.button.getAttribute('aria-expanded')) ?? '';
  }

  async clickToggle() {
    await this.button.click();
  }

  async dblClickToggle() {
    // Playwright dblclick will emit two clicks quickly
    await this.page.dblclick('button#demoBtn');
  }

  async pressKey(key) {
    await this.button.focus();
    await this.page.keyboard.press(key);
  }

  async isDemoAreaDisplayed() {
    // Use computed style because initial display:none is set in CSS
    return await this.page.$eval('#demoArea', (el) => {
      return window.getComputedStyle(el).display;
    });
  }

  async getDemoTextContent() {
    return await this.page.$eval('#demoArea', (el) => el.textContent || '');
  }
}

test.describe('Symmetric Cryptography — XOR stream demo FSM', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      // err is an Error object thrown in page context
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test, ensure we didn't observe any severe console errors or page errors.
    // This also asserts that ReferenceError/SyntaxError/TypeError did not occur unexpectedly.
    const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
    if (errorConsoleMessages.length > 0 || pageErrors.length > 0) {
      // If there are errors, attach diagnostic info to the test failure by throwing an Error.
      const diagnostic = [
        'Console errors:',
        ...errorConsoleMessages.map((m) => `- [console.${m.type}] ${m.text}`),
        'Page errors:',
        ...pageErrors.map((e) => `- [${e.name}] ${e.message}`),
      ].join('\n');
      throw new Error(`Detected page-level errors or console.error messages:\n${diagnostic}`);
    }
  });

  test('Initial state S0_Idle: button exists and demo area is hidden (renderPage entry action)', async ({ page }) => {
    // Validate initial render (S0_Idle), per FSM entry action renderPage()
    const demo = new DemoPage(page);
    await demo.goto();

    // The button must show the initial label and aria attributes
    await expect(demo.button).toBeVisible();
    await expect(await demo.getButtonText()).toBe('Show XOR stream demonstration');
    await expect(await demo.getAriaExpanded()).toBe('false');

    // The demo area should be present but hidden (display:none via CSS)
    const display = await demo.isDemoAreaDisplayed();
    expect(display).toBe('none'); // CSS sets display:none initially
    const content = await demo.getDemoTextContent();
    expect(content).toBe(''); // area has no textContent when hidden

    // Ensure no runtime exceptions (ReferenceError, SyntaxError, TypeError) occurred during load
    expect(pageErrors.length).toBe(0);
    const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_DemoVisible: clicking button shows demo area and updates button text and aria-expanded', async ({ page }) => {
    // Clicking the button should reveal the demo area with computed text and update the button
    const demo = new DemoPage(page);
    await demo.goto();

    // Click to show demo (trigger "ShowDemo" event)
    await demo.clickToggle();

    // After showing: aria-expanded should be true and button label updated
    await expect(await demo.getAriaExpanded()).toBe('true');
    await expect(await demo.getButtonText()).toBe('Hide XOR stream demonstration');

    // The demo area should now have an inline style display:block (script sets area.style.display = "block")
    const display = await demo.isDemoAreaDisplayed();
    expect(display).toBe('block');

    // The demo area should contain the expected explanatory lines
    const text = await demo.getDemoTextContent();
    expect(text).toContain('Fixed demonstration of XOR-based stream encryption (didactic example).');
    expect(text).toContain('Plaintext: "HELLO WORLD"');
    expect(text).toContain('Complete ciphertext (hex):');

    // The ciphertext hex should be a sequence of hex byte pairs; verify a substring matches the pattern (e.g., "0f" or "6e")
    // Extract the ciphertext line and validate format
    const ctLineMatch = text.match(/Complete ciphertext \(hex\):\s*([0-9a-fA-F\s]+)/);
    expect(ctLineMatch).not.toBeNull();
    if (ctLineMatch) {
      const hexSequence = ctLineMatch[1].trim();
      // Each token should be two hex characters
      const tokens = hexSequence.split(/\s+/);
      expect(tokens.length).toBeGreaterThanOrEqual(1);
      for (const token of tokens) {
        expect(token).toMatch(/^[0-9a-fA-F]{2}$/);
      }
    }

    // Ensure no page errors or console.error were emitted by the interaction
    expect(pageErrors.length).toBe(0);
    const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Transition S1_DemoVisible -> S0_Idle: clicking again hides demo area and restores button text/aria', async ({ page }) => {
    // Validate toggling back to hidden state works as per FSM transition S1 -> S0
    const demo = new DemoPage(page);
    await demo.goto();

    // Show first
    await demo.clickToggle();
    await expect(await demo.getAriaExpanded()).toBe('true');
    await expect(await demo.getButtonText()).toBe('Hide XOR stream demonstration');
    expect(await demo.isDemoAreaDisplayed()).toBe('block');

    // Click again to hide (same ShowDemo event triggers hide when shown)
    await demo.clickToggle();

    // After hiding: aria-expanded false; button label restored
    await expect(await demo.getAriaExpanded()).toBe('false');
    await expect(await demo.getButtonText()).toBe('Show XOR stream demonstration');

    // The demo area should be hidden and cleared (script sets area.style.display = "none" and area.textContent = "")
    const displayAfter = await demo.isDemoAreaDisplayed();
    expect(displayAfter).toBe('none'); // should be hidden again

    const contentAfter = await demo.getDemoTextContent();
    expect(contentAfter).toBe(''); // cleared text content on hide

    // Confirm no page errors or console.error messages occurred
    expect(pageErrors.length).toBe(0);
    const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Edge case: rapid double-click (dblclick) leaves UI in a consistent state', async ({ page }) => {
    // Rapid double click could race toggling logic; ensure final state is deterministic (two toggles -> initial state)
    const demo = new DemoPage(page);
    await demo.goto();

    // Ensure initial state is hidden
    expect(await demo.isDemoAreaDisplayed()).toBe('none');
    expect(await demo.getAriaExpanded()).toBe('false');

    // Double-click the button (two clicks in quick succession)
    await demo.dblClickToggle();

    // Two clicks should result in toggling twice: end state should be same as start (hidden)
    // Some implementations could get into an intermediate state; assert final state is hidden and label restored
    // Allow for tiny delay for handlers to run
    await page.waitForTimeout(50);

    expect(await demo.isDemoAreaDisplayed()).toBe('none');
    await expect(await demo.getAriaExpanded()).toBe('false');
    await expect(await demo.getButtonText()).toBe('Show XOR stream demonstration');

    // No runtime exceptions should have been thrown
    expect(pageErrors.length).toBe(0);
    const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Accessibility / keyboard activation: Enter and Space toggle the demo', async ({ page }) => {
    // Ensure button can be activated with keyboard input (Enter and Space) as an accessibility check
    const demo = new DemoPage(page);
    await demo.goto();

    // Activate with Enter
    await demo.pressKey('Enter');
    await expect(await demo.getAriaExpanded()).toBe('true');
    expect(await demo.isDemoAreaDisplayed()).toBe('block');

    // Deactivate with Space
    await demo.pressKey(' ');
    await expect(await demo.getAriaExpanded()).toBe('false');
    expect(await demo.isDemoAreaDisplayed()).toBe('none');

    // No page errors observed during keyboard interactions
    expect(pageErrors.length).toBe(0);
    const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Sanity check: clicking shows content that round-trips plaintext via XOR in the visible table', async ({ page }) => {
    // Validate that the demo content demonstrates XOR being its own inverse by sampling one row's decrypted char
    const demo = new DemoPage(page);
    await demo.goto();

    // Show demo area
    await demo.clickToggle();
    await expect(await demo.getAriaExpanded()).toBe('true');

    const text = await demo.getDemoTextContent();

    // Find a sample row with the row format created in script:
    // "Index | Plain (hex) | Key (hex) | Cipher (hex) | Cipher (decimal) | Decrypted"
    // Example row lines contain " | 0x?? | 0x?? | 0x?? |  ??? | <char>"
    const lines = text.split('\n').map((l) => l.trim());
    // Find first line that looks like a data row (starts with an index number)
    const dataLine = lines.find((l) => /^\d+\s*\|/.test(l));
    expect(dataLine).toBeTruthy();

    if (dataLine) {
      // Extract hex plain, hex key, hex cipher, decrypted char
      // Splitting by '|' and trimming
      const parts = dataLine.split('|').map((p) => p.trim());
      // parts: [index, Plain (hex), Key (hex), Cipher (hex), Cipher (decimal), Decrypted]
      expect(parts.length).toBeGreaterThanOrEqual(6);

      const plainHex = parts[1]; // like 0x48
      const keyHex = parts[2]; // like 0x4b
      const cipherHex = parts[3]; // like 0x03
      const decryptedChar = parts[5]; // single character

      // Parse hex values
      const parseHex = (s) => parseInt(s.replace(/^0x/, ''), 16);
      const pVal = parseHex(plainHex);
      const kVal = parseHex(keyHex);
      const cVal = parseHex(cipherHex);

      // Check XOR relationships: c = p ^ k; decrypted = c ^ k -> equals p
      expect(cVal).toBe((pVal ^ kVal));
      const decryptedVal = cVal ^ kVal;
      expect(decryptedVal).toBe(pVal);

      // Verify decrypted character matches plaintext byte
      expect(String.fromCharCode(decryptedVal)).toBe(decryptedChar);
    }

    // Confirm no errors occurred during computation/rendering
    expect(pageErrors.length).toBe(0);
    const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });
});