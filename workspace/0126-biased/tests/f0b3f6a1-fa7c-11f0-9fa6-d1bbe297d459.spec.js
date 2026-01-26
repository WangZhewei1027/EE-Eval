import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b3f6a1-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page object encapsulating interactions and queries for the TCP/IP demo page.
class TCPIPPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator("button[onclick='showDemo()']");
    this.demo = page.locator('#demoOutput');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getButtonText() {
    return this.button.innerText();
  }

  async getButtonOnclickAttribute() {
    return this.button.getAttribute('onclick');
  }

  async isDemoVisible() {
    // Uses computed style to determine visibility (matches the FSM expected observable)
    return this.page.$eval('#demoOutput', (el) => {
      return getComputedStyle(el).display !== 'none';
    });
  }

  async getDemoDisplayStyle() {
    return this.page.$eval('#demoOutput', (el) => getComputedStyle(el).display);
  }

  async getDemoInnerHTML() {
    return this.page.$eval('#demoOutput', (el) => el.innerHTML);
  }

  async getDemoTextContent() {
    return this.page.$eval('#demoOutput', (el) => el.textContent || '');
  }

  async clickShowDemo() {
    await this.button.click();
  }

  // Directly invoke showDemo from page context; used for edge-case testing
  async invokeShowDemoInPageContext() {
    return this.page.evaluate(() => {
      try {
        // Call the global function if it exists; let errors propagate back as thrown exceptions
        if (typeof showDemo !== 'function') {
          return { ok: false, error: 'showDemo not defined' };
        }
        showDemo();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    });
  }

  // Query whether global functions exist on window (useful to validate FSM onEnter actions)
  async typeofGlobal(name) {
    return this.page.evaluate((n) => typeof window[n], name);
  }
}

test.describe('FSM: Comprehensive Guide to TCP/IP - Demo interactions', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture all console events
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    const tcpPage = new TCPIPPage(page);
    await tcpPage.goto();
  });

  test.afterEach(async () => {
    // No teardown required beyond Playwright's automatic cleanup; kept for clarity.
  });

  test('Initial state S0_Idle: button present and demo output hidden; FSM entry action renderPage() not defined', async ({ page }) => {
    const tcpPage = new TCPIPPage(page);

    // Validate the button exists and has correct text (evidence of S0_Idle)
    await expect(tcpPage.button).toBeVisible();
    const btnText = await tcpPage.getButtonText();
    // Button text should exactly match the FSM/component definition
    expect(btnText.trim()).toBe('Show Simple TCP Connection Demo');

    // Verify the button has the onclick attribute that wires to showDemo()
    const onclickAttr = await tcpPage.getButtonOnclickAttribute();
    expect(onclickAttr).toBe('showDemo()');

    // #demoOutput should initially be hidden (display: none)
    const demoStyle = await tcpPage.getDemoDisplayStyle();
    expect(demoStyle).toBe('none');

    // FSM S0 entry action mentions renderPage(); verify renderPage is not a defined global function on the page.
    // The test asserts the implementation does not declare renderPage (we do NOT patch it).
    const renderPageType = await tcpPage.typeofGlobal('renderPage');
    expect(renderPageType).toBe('undefined');

    // The showDemo implementation should exist (declared in the page's script)
    const showDemoType = await tcpPage.typeofGlobal('showDemo');
    expect(showDemoType).toBe('function');

    // Assert there were no uncaught page errors during load
    expect(pageErrors.length).toBe(0);

    // Assert no console-level "error" messages were emitted on load
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition ShowDemo: clicking button reveals demo output and populates content (S1_DemoVisible)', async ({ page }) => {
    const tcpPage = new TCPIPPage(page);

    // Click the button to trigger the transition
    await tcpPage.clickShowDemo();

    // After clicking, demo output should be visible (expected observable)
    const visible = await tcpPage.isDemoVisible();
    expect(visible).toBe(true);

    // The display style should reflect visible state
    const demoStyle = await tcpPage.getDemoDisplayStyle();
    expect(demoStyle).toBe('block');

    // Demo innerHTML should contain the TCP Connection Simulation header and the handshake steps
    const demoHTML = await tcpPage.getDemoInnerHTML();
    expect(demoHTML).toContain('TCP Connection Simulation');
    expect(demoHTML).toContain('Client sends SYN');
    expect(demoHTML).toContain('SYN-ACK');
    expect(demoHTML).toContain('ACK');
    expect(demoHTML).toContain('Connection established!');

    // And the textContent should include the word "SYN" (case-sensitive as shown in source)
    const demoText = await tcpPage.getDemoTextContent();
    expect(demoText).toMatch(/SYN/);

    // Ensure no uncaught errors were produced during the click/DOM update
    const pageErrorsSnapshot = pageErrors.slice();
    expect(pageErrorsSnapshot.length).toBe(0);

    // Ensure no console errors were emitted during the operation
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Idempotency & repeated invocation: multiple clicks and direct invocations do not throw and content is consistent', async ({ page }) => {
    const tcpPage = new TCPIPPage(page);

    // Rapidly click the button multiple times
    await Promise.all([
      tcpPage.clickShowDemo(),
      tcpPage.clickShowDemo(),
      tcpPage.clickShowDemo()
    ]).catch(() => {
      // We do not expect exceptions from Playwright's click; if some thrown, let test assertions catch errors below
    });

    // After repeated clicks, demo should be visible and content should not be duplicated unexpectedly.
    const visible = await tcpPage.isDemoVisible();
    expect(visible).toBe(true);

    const demoHTML = await tcpPage.getDemoInnerHTML();

    // The header "TCP Connection Simulation" should appear exactly once because innerHTML is assigned (not appended)
    const occurrences = (demoHTML.match(/TCP Connection Simulation/g) || []).length;
    expect(occurrences).toBe(1);

    // Now invoke the showDemo function directly from page context and assert it reports success
    const invocationResult = await tcpPage.invokeShowDemoInPageContext();
    expect(invocationResult.ok).toBe(true);

    // Confirm content is still valid and consistent after direct invocation
    const demoTextAfter = await tcpPage.getDemoTextContent();
    expect(demoTextAfter).toContain('4. Connection established! Data transfer begins...');

    // Confirm no uncaught errors logged to pageErrors during repeated operations
    expect(pageErrors.length).toBe(0);

    // Confirm no console 'error' messages exist
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: simulate keyboard activation and ensure showDemo still works; observe console and page errors', async ({ page }) => {
    const tcpPage = new TCPIPPage(page);

    // Focus the button and press Enter to activate it (keyboard accessibility)
    await tcpPage.button.focus();
    await page.keyboard.press('Enter');

    // Demo should be visible afterwards
    expect(await tcpPage.isDemoVisible()).toBe(true);

    // Verify content contains expected handshake sequence
    const demoText = await tcpPage.getDemoTextContent();
    expect(demoText).toMatch(/three-way handshake|SYN/gi);

    // No page errors should have occurred
    expect(pageErrors.length).toBe(0);

    // And no console errors were emitted during keyboard activation
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Contract validation: ensure the demo element exists and the onclick wiring is present in DOM (evidence check)', async ({ page }) => {
    const tcpPage = new TCPIPPage(page);

    // Confirm the demo element is present in the DOM
    const demoHandle = await page.$('#demoOutput');
    expect(demoHandle).not.toBeNull();

    // Confirm the button's onclick attribute matches the FSM's evidence selector wiring
    const onclickAttr = await tcpPage.getButtonOnclickAttribute();
    expect(onclickAttr).toBe('showDemo()');

    // Check for existence of expected structural content (header title present)
    const titleExists = await page.$eval('h1', (h) => (h && h.textContent || '').includes('TCP/IP'));
    expect(titleExists).toBe(true);

    // No page errors observed
    expect(pageErrors.length).toBe(0);

    // Capture any console messages for debugging purposes (but assert no console.error)
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});