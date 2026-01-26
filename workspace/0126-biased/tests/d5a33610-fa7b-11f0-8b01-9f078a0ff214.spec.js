import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a33610-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object for the demo page
class RuntimeEnvDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator("button[onclick='showDemo()']");
    this.demo = page.locator('#demo');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickShowDemo() {
    await this.button.click();
  }

  async isDemoVisible() {
    // Use computed style to check visibility as the app toggles display style
    return await this.page.evaluate(() => {
      const demo = document.getElementById('demo');
      if (!demo) return false;
      const style = window.getComputedStyle(demo);
      return style && style.display !== 'none';
    });
  }

  async demoText() {
    return await this.demo.innerText();
  }

  async buttonText() {
    return await this.button.innerText();
  }

  async buttonOnclickAttribute() {
    return await this.button.getAttribute('onclick');
  }

  async showDemoFunctionType() {
    return await this.page.evaluate(() => typeof window.showDemo);
  }

  async demoComputedDisplay() {
    return await this.page.evaluate(() => {
      const demo = document.getElementById('demo');
      if (!demo) return null;
      return window.getComputedStyle(demo).display;
    });
  }
}

test.describe('Understanding Runtime Environment - Demo Interaction (FSM validations)', () => {
  // Capture console entries and page errors for each test so we can assert on them
  test.beforeEach(async ({ page }) => {
    // No-op here; listeners will be added per-test to keep isolation
  });

  // Test initial Idle state: S0_Idle
  test('S0_Idle: page loads with demo hidden and button present', async ({ page }) => {
    // Arrays to capture console messages and uncaught page errors
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const demoPage = new RuntimeEnvDemoPage(page);
    // Navigate to the application as-is
    await demoPage.goto();

    // Validate button presence and text matches FSM/component description
    await expect(demoPage.button).toBeVisible();
    const btnText = await demoPage.buttonText();
    expect(btnText).toContain('Show a Simple Code Execution Demo');

    // The #demo element should exist in the DOM but be hidden (display:none)
    await expect(demoPage.demo).toBeAttached();
    const display = await demoPage.demoComputedDisplay();
    expect(display).toBe('none');

    // Ensure onclick attribute references showDemo() as described in FSM
    const onclickAttr = await demoPage.buttonOnclickAttribute();
    expect(onclickAttr).toBe('showDemo()');

    // The global showDemo function should be defined (entry action lever)
    const showDemoType = await demoPage.showDemoFunctionType();
    expect(showDemoType).toBe('function');

    // Assert that no runtime console errors or page errors occurred during load
    const severeConsoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(severeConsoleErrors.length).toBe(0);
    // Check for ReferenceError/SyntaxError/TypeError in page errors array
    const criticalPageErrors = pageErrors.filter(e =>
      e.message.includes('ReferenceError') || e.message.includes('SyntaxError') || e.message.includes('TypeError')
    );
    expect(criticalPageErrors.length).toBe(0);
  });

  // Test transition S0_Idle -> S1_DemoVisible via ShowDemo event
  test('S0_Idle -> S1_DemoVisible: clicking button shows demo (entry action showDemo())', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const demoPage = new RuntimeEnvDemoPage(page);
    await demoPage.goto();

    // Precondition: demo hidden
    expect(await demoPage.isDemoVisible()).toBe(false);

    // Click the button to trigger ShowDemo event and transition to S1_DemoVisible
    await demoPage.clickShowDemo();

    // After click, demo should be visible
    await expect.poll(async () => await demoPage.isDemoVisible()).toBe(true);

    // Validate the demo section contains expected content (visual feedback)
    const text = await demoPage.demoText();
    expect(text).toContain('Demo Code Execution');
    expect(text).toContain('Hello, World!') .or?.toBeTruthy; // best-effort check for demonstration content

    // Verify the computed display is 'block'
    const displayAfter = await demoPage.demoComputedDisplay();
    expect(displayAfter === 'block' || displayAfter === 'inline-block' || displayAfter === 'flex').toBeTruthy();

    // Ensure the showDemo function served as the entry action (existence is enough to show it's used by onclick)
    const showDemoType = await demoPage.showDemoFunctionType();
    expect(showDemoType).toBe('function');

    // Assert no unexpected console/page errors
    const severeConsoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(severeConsoleErrors.length).toBe(0);
    const criticalPageErrors = pageErrors.filter(e =>
      e.message.includes('ReferenceError') || e.message.includes('SyntaxError') || e.message.includes('TypeError')
    );
    expect(criticalPageErrors.length).toBe(0);
  });

  // Test transition S1_DemoVisible -> S0_Idle by clicking the same button (toggle behavior)
  test('S1_DemoVisible -> S0_Idle: clicking button again hides demo (toggle behavior)', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const demoPage = new RuntimeEnvDemoPage(page);
    await demoPage.goto();

    // Ensure we start by showing the demo
    await demoPage.clickShowDemo();
    await expect.poll(async () => await demoPage.isDemoVisible()).toBe(true);

    // Click again to toggle back to hidden
    await demoPage.clickShowDemo();

    // After second click, demo should be hidden
    await expect.poll(async () => await demoPage.isDemoVisible()).toBe(false);

    // Validate computed display returns to 'none'
    const displayAfter = await demoPage.demoComputedDisplay();
    expect(displayAfter).toBe('none');

    // Assert no unexpected console/page errors during toggling
    const severeConsoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(severeConsoleErrors.length).toBe(0);
    const criticalPageErrors = pageErrors.filter(e =>
      e.message.includes('ReferenceError') || e.message.includes('SyntaxError') || e.message.includes('TypeError')
    );
    expect(criticalPageErrors.length).toBe(0);
  });

  // Edge case: rapid consecutive clicks should toggle deterministically (idempotence/parity)
  test('Edge case: rapid consecutive clicks toggle demo according to parity', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const demoPage = new RuntimeEnvDemoPage(page);
    await demoPage.goto();

    // Rapidly click 5 times; odd clicks -> visible, even -> hidden; 5 is odd so final should be visible
    for (let i = 0; i < 5; i++) {
      // Use dispatchEvent via click for each iteration to simulate user clicking repeatedly
      await demoPage.clickShowDemo();
    }

    expect(await demoPage.isDemoVisible()).toBe(true);

    // Now click one more time to make it even (6 clicks) and expect hidden
    await demoPage.clickShowDemo();
    expect(await demoPage.isDemoVisible()).toBe(false);

    // Ensure demo text and markup remain intact after rapid toggling
    const demoAttached = await demoPage.demo.isAttached();
    expect(demoAttached).toBe(true);
    const demoInner = await demoPage.demoText();
    expect(demoInner.length).toBeGreaterThan(0);

    // Confirm no crash-level errors occurred
    const severeConsoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(severeConsoleErrors.length).toBe(0);
    const criticalPageErrors = pageErrors.filter(e =>
      e.message.includes('ReferenceError') || e.message.includes('SyntaxError') || e.message.includes('TypeError')
    );
    expect(criticalPageErrors.length).toBe(0);
  });

  // Negative test / error scenario observation:
  // We intentionally do NOT modify the page. We just observe if any ReferenceError/SyntaxError/TypeError occur.
  // The test asserts that the page did not throw such errors during a normal usage flow.
  test('Runtime errors: observe console and page errors during interactions', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const demoPage = new RuntimeEnvDemoPage(page);
    await demoPage.goto();

    // Perform typical interactions
    await demoPage.clickShowDemo();
    await demoPage.clickShowDemo();

    // Wait a tick to ensure any async errors propagate
    await page.waitForTimeout(100);

    // Gather any console errors explicitly reporting JS error types
    const jsErrorConsoleEntries = consoleMessages.filter(m =>
      m.type === 'error' && (m.text.includes('ReferenceError') || m.text.includes('TypeError') || m.text.includes('SyntaxError'))
    );

    // Also inspect uncaught page errors for these error types
    const pageRuntimeErrors = pageErrors.filter(e =>
      e.message.includes('ReferenceError') || e.message.includes('TypeError') || e.message.includes('SyntaxError')
    );

    // Assert that no uncaught runtime errors occurred (the app implementation is expected to be free of such errors)
    expect(jsErrorConsoleEntries.length).toBe(0);
    expect(pageRuntimeErrors.length).toBe(0);

    // Additionally, assert that there were not any console.error messages at all
    const anyConsoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(anyConsoleErrors.length).toBe(0);
  });
});