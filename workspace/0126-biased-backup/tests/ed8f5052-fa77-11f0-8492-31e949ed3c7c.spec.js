import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8f5052-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object encapsulating elements and common interactions
class DnsPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(BASE);
  }

  async titleText() {
    return this.page.locator('.dns-title').innerText();
  }

  async descriptionText() {
    return this.page.locator('.description').innerText();
  }

  async footerText() {
    return this.page.locator('.footer').innerText();
  }

  button() {
    return this.page.locator('.button');
  }

  async buttonIsVisible() {
    return this.button().isVisible();
  }

  async buttonAttribute(attr) {
    return this.button().getAttribute(attr);
  }

  // Click the button and await the next alert dialog, returning its message
  async clickLearnMoreAndGetDialogMessage() {
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.button().click(),
    ]);
    const message = dialog.message();
    await dialog.accept();
    return message;
  }

  // Use keyboard to activate the button (space or enter)
  async focusButtonAndPress(key = 'Enter') {
    await this.button().focus();
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.page.keyboard.press(key),
    ]);
    const message = dialog.message();
    await dialog.accept();
    return message;
  }
}

test.describe('Beautiful DNS Concept Demo - FSM and UI tests', () => {
  // We'll collect console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Improve test stability: ensure JS exceptions are surfaced as page errors
    // Attach listeners early
    page.context().setDefaultNavigationTimeout(120000);
  });

  // Test the initial Idle state (S0_Idle)
  test('S0_Idle: initial render shows title, description and Learn More button with onclick attribute', async ({ page }) => {
    // Comments:
    // This test validates the Idle state's entry rendering:
    // - The title and description are present
    // - The Learn More button is visible and has the expected onclick handler per the FSM evidence
    // - We also observe console and page errors (should be none for a healthy page)
    const dns = new DnsPage(page);

    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await dns.goto();

    // Verify main UI elements
    await expect(page.locator('.dns-box')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.dns-title')).toHaveText(/Understanding DNS/);
    const desc = await dns.descriptionText();
    expect(desc.length).toBeGreaterThan(10); // description present

    // Verify button visibility and attributes (evidence of S0_Idle)
    await expect(dns.button()).toBeVisible();
    await expect(dns.button()).toHaveText('Learn More');

    const onclick = await dns.buttonAttribute('onclick');
    // The FSM evidence indicates onclick="showMessage()"
    expect(onclick).toBe('showMessage()');

    // Verify global functions presence/absence per FSM:
    // FSM entry action for S0_Idle listed "renderPage()" but the HTML does not define it.
    // We check existence without modifying global scope.
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(hasRenderPage).toBe(false);

    // The showMessage function should exist as it's wired to the button
    const hasShowMessage = await page.evaluate(() => typeof window.showMessage === 'function');
    expect(hasShowMessage).toBe(true);

    // Inspect collected console and page errors - none are expected in normal operation
    // Ensure no uncaught page errors occurred
    expect(pageErrors.length).toBe(0);

    // Ensure no console errors were emitted
    const errorConsole = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  // Test the transition: clicking Learn More -> alert shown (S0_Idle -> S1_MessageShown)
  test('LearnMore_Click event triggers alert with expected message (S1_MessageShown)', async ({ page }) => {
    // Comments:
    // This test validates the FSM transition from Idle to Message Shown.
    // We click the button and assert that an alert dialog appears with the exact text
    // as the FSM evidence and the implementation's alert message.
    const dns = new DnsPage(page);

    const pageErrors = [];
    const consoleMessages = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (m) => consoleMessages.push({ type: m.type(), text: m.text() }));

    await dns.goto();

    // Click and capture dialog message
    const message = await dns.clickLearnMoreAndGetDialogMessage();
    expect(message).toBe('The Domain Name System (DNS) is crucial for the functionality of the internet!');

    // After handling the alert, no page errors should have occurred
    expect(pageErrors.length).toBe(0);

    // Also ensure no console.error messages were emitted during the transition
    const errors = consoleMessages.filter((m) => m.type === 'error');
    expect(errors.length).toBe(0);
  });

  // Edge case: multiple rapid clicks lead to multiple dialogs - ensure each is shown and handled
  test('Edge case: multiple sequential clicks produce repeated alerts', async ({ page }) => {
    // Comments:
    // This test simulates fast user interactions: clicking the button multiple times.
    // For each click, the page will produce an alert dialog. We assert each dialog appears
    // and contains the expected message. This validates the event handler is stateless and repeatable.
    const dns = new DnsPage(page);
    await dns.goto();

    // We'll perform 3 sequential activations and handle each alert
    const messages = [];
    for (let i = 0; i < 3; i++) {
      const msg = await dns.clickLearnMoreAndGetDialogMessage();
      messages.push(msg);
    }

    for (const m of messages) {
      expect(m).toBe('The Domain Name System (DNS) is crucial for the functionality of the internet!');
    }
  });

  // Alternative activation: keyboard activation should trigger the same alert
  test('Alternate activation: pressing Enter when focused on button triggers alert', async ({ page }) => {
    // Comments:
    // Some users may activate buttons via keyboard. This test focuses the Learn More button
    // and sends an Enter keypress to ensure the onclick handler still produces the alert.
    const dns = new DnsPage(page);
    await dns.goto();

    const msg = await dns.focusButtonAndPress('Enter');
    expect(msg).toBe('The Domain Name System (DNS) is crucial for the functionality of the internet!');
  });

  // Error observation test - ensure no ReferenceError/SyntaxError/TypeError occurred during load and interaction
  test('Observe console and page errors - assert absence of ReferenceError/SyntaxError/TypeError', async ({ page }) => {
    // Comments:
    // The test collects console messages and page errors during page load and interaction.
    // If the implementation had missing functions or syntax errors, these would surface.
    // Here we assert that none of the captured errors contain ReferenceError, SyntaxError, or TypeError.
    const dns = new DnsPage(page);

    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await dns.goto();

    // Perform one interaction to surface potential runtime errors
    const dialogPromise = page.waitForEvent('dialog');
    await dns.button().click();
    const dialog = await dialogPromise;
    await dialog.accept();

    // Check pageErrors array for any ReferenceError/SyntaxError/TypeError mentions
    const problematic = pageErrors.filter((e) => {
      const t = String(e);
      return /ReferenceError|SyntaxError|TypeError/.test(t);
    });

    // We expect no such errors in this implementation.
    expect(problematic.length).toBe(0);

    // Also ensure console.error wasn't emitted with such critical errors
    const consoleProblems = consoleMessages.filter((m) =>
      m.type === 'error' && /ReferenceError|SyntaxError|TypeError/.test(m.text)
    );
    expect(consoleProblems.length).toBe(0);
  });

  // Test verifying the existence of the showMessage implementation and that it matches FSM evidence
  test('Implementation validation: showMessage exists and matches FSM alert evidence', async ({ page }) => {
    // Comments:
    // This test ensures the function showMessage exists on the window and when invoked via the UI
    // it produces exactly the message quoted in the FSM evidence.
    const dns = new DnsPage(page);
    await dns.goto();

    // Confirm showMessage is a function
    const isFunction = await page.evaluate(() => typeof window.showMessage === 'function');
    expect(isFunction).toBe(true);

    // Interact through DOM to trigger the exact alert output
    const msg = await dns.clickLearnMoreAndGetDialogMessage();
    expect(msg).toBe('The Domain Name System (DNS) is crucial for the functionality of the internet!');
  });
});