import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a2c0e0-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object Model for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demoButton');
  }

  // Navigate to the demo page and wait until load
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Click the demo button (await should be used by caller to handle dialogs)
  async clickDemo() {
    await this.button.click();
  }

  // Get visible text of the demo button
  async getButtonText() {
    return await this.button.innerText();
  }

  // Check if button is visible
  async isButtonVisible() {
    return await this.button.isVisible();
  }

  // Return script tag contents concatenated (for verifying event handler evidence)
  async getAllScriptText() {
    return await this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('script')).map(s => s.textContent).join('\n');
    });
  }

  // Check if a global function is defined on window
  async typeofGlobal(name) {
    return await this.page.evaluate((n) => typeof window[n], name);
  }
}

test.describe('Load Balancing Demonstration (FSM validation)', () => {
  // Arrays to capture runtime issues and console messages per test
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture uncaught exceptions / page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages for later inspection
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
  });

  test.afterEach(async ({ }, testInfo) => {
    // On test failure, include console and page error info to aid debugging
    if (testInfo.status !== testInfo.expectedStatus) {
      // Don't throw here; Playwright will already mark the test failed.
      // But attaching info to the test output is helpful when running many tests.
      // We use testInfo.log() if available; otherwise rely on thrown assertions above.
      // (This is intentionally non-invasive.)
    }
  });

  test('Idle state: initial render should show the demo button (S0_Idle)', async ({ page }) => {
    // This test validates the initial "Idle" state: presence of the button and that page loads cleanly.
    const demo = new DemoPage(page);
    await demo.goto();

    // Verify the demo button is visible and has the expected label (evidence for S0_Idle)
    expect(await demo.isButtonVisible()).toBe(true);
    expect(await demo.getButtonText()).toBe('Show Load Balancing Demonstration');

    // Verify that the page loaded without runtime page errors (we observe and assert naturally)
    expect(pageErrors.length).toBe(0);

    // Verify that console did not emit any messages with type 'error' during initial load
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);

    // Verify that the script evidence for the button exists in the document (script node contains addEventListener)
    const scripts = await demo.getAllScriptText();
    expect(scripts.length).toBeGreaterThan(0);
    expect(scripts).toContain('addEventListener');
    expect(scripts).toContain('demoButton');
  });

  test('Demonstration state: clicking the button triggers alert (S1_Demonstration entry action)', async ({ page }) => {
    // This test validates the transition from Idle -> Demonstration by clicking the button,
    // and checks that the entry action of S1 (alert) is displayed with the expected text.
    const demo = new DemoPage(page);
    await demo.goto();

    // Collect dialog messages as they appear
    const dialogMessages = [];
    page.on('dialog', async (dialog) => {
      dialogMessages.push(dialog.message());
      // Accept the dialog so the page remains usable for further interactions
      await dialog.accept();
    });

    // Click the button and wait a short moment for the dialog to fire and be handled
    await demo.clickDemo();

    // We should have captured exactly one alert message for the transition
    expect(dialogMessages.length).toBe(1);
    expect(dialogMessages[0]).toBe('This is a basic demonstration of load balancing.');

    // Ensure still no page errors after the interaction
    expect(pageErrors.length).toBe(0);

    // Ensure the script evidence includes the exact alert message text
    const scripts = await demo.getAllScriptText();
    expect(scripts).toContain('This is a basic demonstration of load balancing.');
  });

  test('Multiple clicks produce multiple alerts (transition repeatability and robustness)', async ({ page }) => {
    // This test verifies that repeated triggering of the event/transition results in the alert each time,
    // ensuring the event listener is persistent and that the system behaves consistently.
    const demo = new DemoPage(page);
    await demo.goto();

    const dialogMessages = [];
    page.on('dialog', async (dialog) => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    // Click multiple times sequentially, awaiting handling of each dialog implicitly via the dialog handler
    await demo.clickDemo();
    await demo.clickDemo();
    await demo.clickDemo();

    // We expect three dialogs with the expected message
    expect(dialogMessages.length).toBe(3);
    dialogMessages.forEach(msg => expect(msg).toBe('This is a basic demonstration of load balancing.'));

    // Assert no page errors during these interactions
    expect(pageErrors.length).toBe(0);
  });

  test('Rapid consecutive clicks: edge case (dialogs should appear per click)', async ({ page }) => {
    // Edge case: user clicks rapidly. We validate that each click still triggers an alert
    // and that the page does not throw errors when multiple dialogs are presented in short order.
    const demo = new DemoPage(page);
    await demo.goto();

    const dialogMessages = [];
    page.on('dialog', async (dialog) => {
      dialogMessages.push(dialog.message());
      // Slight delay to simulate a user reading the dialog before accepting
      await new Promise(res => setTimeout(res, 10));
      await dialog.accept();
    });

    // Rapid clicks (no awaiting between clicks)
    const clickPromises = [];
    for (let i = 0; i < 2; i++) {
      clickPromises.push(demo.clickDemo());
    }
    await Promise.all(clickPromises);

    // Wait a brief moment to ensure dialogs are handled
    await page.waitForTimeout(200);

    // At least two dialogs should have been shown (browsers may queue them)
    expect(dialogMessages.length).toBeGreaterThanOrEqual(2);
    dialogMessages.forEach(msg => expect(msg).toBe('This is a basic demonstration of load balancing.'));

    // Ensure no runtime page errors resulted
    expect(pageErrors.length).toBe(0);
  });

  test('FSM onEnter verification: S0 entry action "renderPage()" not present on implementation', async ({ page }) => {
    // FSM specified an entry action renderPage() for S0_Idle.
    // The implementation does not call renderPage(), so verify that no global function named renderPage exists.
    const demo = new DemoPage(page);
    await demo.goto();

    const typeofRenderPage = await demo.typeofGlobal('renderPage');
    // If the implementation had invoked or defined renderPage, typeof would be 'function'. We expect it to be 'undefined'.
    expect(typeofRenderPage).toBe('undefined');

    // Document evidence (button HTML) should still exist showing S0 state presentation
    expect(await demo.isButtonVisible()).toBe(true);

    // No page errors from missing renderPage call (there shouldn't be a ReferenceError because it is not invoked)
    expect(pageErrors.length).toBe(0);
  });

  test('Implementation evidence: verify event handler code exists in script (evidence of transition wiring)', async ({ page }) => {
    // This test inspects the page's script content to confirm the expected event handler code is present,
    // matching the FSM's evidence: document.getElementById("demoButton").addEventListener("click", function () { alert("This is a basic demonstration of load balancing."); });
    const demo = new DemoPage(page);
    await demo.goto();

    const scriptText = await demo.getAllScriptText();

    // Confirm presence of key fragments that indicate the handler is implemented
    expect(scriptText).toContain('document.getElementById("demoButton")');
    expect(scriptText).toContain('addEventListener');
    expect(scriptText).toContain('This is a basic demonstration of load balancing.');

    // Again, ensure no page errors were thrown during evaluation
    expect(pageErrors.length).toBe(0);
  });

  test('Console and page error observation: no unexpected runtime errors during full user flow', async ({ page }) => {
    // Complete flow: load, click, and ensure no runtime exceptions are thrown and console has no error-level messages.
    const demo = new DemoPage(page);
    await demo.goto();

    const dialogMessages = [];
    page.on('dialog', async (dialog) => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    // Perform the user action
    await demo.clickDemo();

    // Inspect captured console messages and page errors
    const errorConsole = consoleMessages.filter(m => m.type === 'error');

    // Expect that no page errors occurred
    expect(pageErrors.length).toBe(0);

    // Expect no console errors (the page may log informational console messages but not errors)
    expect(errorConsole.length).toBe(0);

    // And the alert should have fired as part of the transition
    expect(dialogMessages.length).toBe(1);
    expect(dialogMessages[0]).toBe('This is a basic demonstration of load balancing.');
  });
});