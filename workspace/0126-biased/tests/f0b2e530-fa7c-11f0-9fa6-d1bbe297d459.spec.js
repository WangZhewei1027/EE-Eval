import { test, expect } from '@playwright/test';

// Page object representing the PageRank demo page
class PageRankPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demo-button');
    this.output = page.locator('#demo-output');
  }

  async goto(url) {
    await this.page.goto(url);
  }

  async getButtonText() {
    return (await this.button.textContent())?.trim();
  }

  async isOutputVisible() {
    // Use computed style to determine real visibility
    return await this.page.evaluate(() => {
      const el = document.getElementById('demo-output');
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return style && style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
    });
  }

  async clickToggle() {
    await this.button.click();
  }

  async getOutputText() {
    return (await this.output.textContent())?.trim();
  }
}

// URL to test
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b2e530-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('FSM: PageRank demo toggle (f0b2e530-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let consoleMessages = [];
  /** @type {PageRankPage} */
  let prPage;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for each test so we can assert on them later
    pageErrors = [];
    consoleErrors = [];
    consoleMessages = [];

    page.on('console', msg => {
      const entry = { type: msg.type(), text: msg.text() };
      consoleMessages.push(entry);
      if (msg.type() === 'error') consoleErrors.push(entry);
    });

    page.on('pageerror', error => {
      // pageerror captures unhandled exceptions in the page context
      pageErrors.push(error);
    });

    prPage = new PageRankPage(page);
    await prPage.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Ensure page is closed after each test to isolate console/pageerror collections
    try {
      await page.close();
    } catch (e) {
      // ignore errors closing page
    }
  });

  // Validate initial Idle state (S0_Idle)
  test('Initial state (S0_Idle): button and demo-output exist and are in expected initial state', async ({ page }) => {
    // This test validates the entry actions for the Idle state (renderPage()) by checking DOM presence
    prPage = new PageRankPage(page);

    // The demo button should exist and have the expected initial label
    await expect(prPage.button).toBeVisible();
    const initialText = await prPage.getButtonText();
    expect(initialText).toBe('Show Simple Demo Calculation');

    // The demo output element should exist and be hidden initially (display: none)
    await expect(prPage.output).toBeVisible(); // element exists in DOM; locator's toBeVisible checks visibility; but CSS display none -> not visible, so use isOutputVisible
    const visible = await prPage.isOutputVisible();
    expect(visible).toBe(false);

    // The demo output should contain the demo header text
    const outputText = await prPage.getOutputText();
    expect(outputText).toContain('PageRank Demo Calculation');

    // Assert no runtime errors were thrown during page load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Transition S0_Idle -> S1_DemoVisible
  test('Transition S0_Idle -> S1_DemoVisible: clicking the button shows demo output and updates button text', async ({ page }) => {
    prPage = new PageRankPage(page);

    // Click the toggle button once
    await prPage.clickToggle();

    // After click, the demo output should be visible (entry action showDemoOutput)
    const visibleAfterFirstClick = await prPage.isOutputVisible();
    expect(visibleAfterFirstClick).toBe(true);

    // Button text should update to 'Hide Demo Calculation'
    const textAfterFirstClick = await prPage.getButtonText();
    expect(textAfterFirstClick).toBe('Hide Demo Calculation');

    // No unhandled runtime errors should appear during this interaction
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Transition S1_DemoVisible -> S2_DemoHidden
  test('Transition S1_DemoVisible -> S2_DemoHidden: clicking the button again hides demo output and restores button text', async ({ page }) => {
    prPage = new PageRankPage(page);

    // Ensure we are in S1 by clicking once first
    await prPage.clickToggle();
    expect(await prPage.isOutputVisible()).toBe(true);
    expect(await prPage.getButtonText()).toBe('Hide Demo Calculation');

    // Click again to hide
    await prPage.clickToggle();

    // After second click, the demo output should be hidden (entry action hideDemoOutput)
    expect(await prPage.isOutputVisible()).toBe(false);

    // Button text should be restored to 'Show Simple Demo Calculation'
    expect(await prPage.getButtonText()).toBe('Show Simple Demo Calculation');

    // No runtime errors occurred during these transitions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Transition S2_DemoHidden -> S1_DemoVisible (toggle back)
  test('Transition S2_DemoHidden -> S1_DemoVisible: toggling again displays the demo and updates button text', async ({ page }) => {
    prPage = new PageRankPage(page);

    // Put into hidden state (S2) by clicking twice: show then hide
    await prPage.clickToggle(); // show
    await prPage.clickToggle(); // hide
    expect(await prPage.isOutputVisible()).toBe(false);
    expect(await prPage.getButtonText()).toBe('Show Simple Demo Calculation');

    // Click to show again
    await prPage.clickToggle();

    // Verify visible and button text updated
    expect(await prPage.isOutputVisible()).toBe(true);
    expect(await prPage.getButtonText()).toBe('Hide Demo Calculation');

    // Confirm content still present
    const outputText = await prPage.getOutputText();
    expect(outputText).toContain('Initial PageRank values');

    // No runtime errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: rapid repeated clicks and double-click scenarios
  test('Edge case: rapid toggles do not produce errors and end state is consistent', async ({ page }) => {
    prPage = new PageRankPage(page);

    // Rapidly click the button multiple times to simulate fast user interactions
    for (let i = 0; i < 6; i++) {
      // Use evaluate to trigger clicks with minimal delay to simulate a fast user
      await page.evaluate(() => document.getElementById('demo-button').click());
    }

    // After even number of clicks (6), the state should be same as initial (hidden)
    const isVisible = await prPage.isOutputVisible();
    const btnText = await prPage.getButtonText();

    // 6 is even -> same as initial: hidden
    expect(isVisible).toBe(false);
    expect(btnText).toBe('Show Simple Demo Calculation');

    // Ensure no unhandled exceptions were thrown during rapid interaction
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Also assert that console messages were captured (if any) and are not error-level
    const errorMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorMsgs.length).toBe(0);
  });

  // Validate that UI textual changes are exactly as the FSM expects on transitions
  test('FSM observables: ensure displayed/hidden states and exact button labels match FSM evidence', async ({ page }) => {
    prPage = new PageRankPage(page);

    // Initial observable
    expect(await prPage.getButtonText()).toBe('Show Simple Demo Calculation');
    expect(await prPage.isOutputVisible()).toBe(false);

    // S0 -> S1
    await prPage.clickToggle();
    expect(await prPage.isOutputVisible()).toBe(true);
    expect(await prPage.getButtonText()).toBe('Hide Demo Calculation');

    // S1 -> S2
    await prPage.clickToggle();
    expect(await prPage.isOutputVisible()).toBe(false);
    expect(await prPage.getButtonText()).toBe('Show Simple Demo Calculation');

    // S2 -> S1 again
    await prPage.clickToggle();
    expect(await prPage.isOutputVisible()).toBe(true);
    expect(await prPage.getButtonText()).toBe('Hide Demo Calculation');

    // No runtime errors throughout
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Validate that the demo output block contains expected demonstration content
  test('Demo output contains numeric example and iteration details (content verification)', async ({ page }) => {
    prPage = new PageRankPage(page);

    // Show the demo
    await prPage.clickToggle();

    // Validate that numeric example and "Iteration" wording exists in the demo content
    const text = await prPage.getOutputText();
    expect(text).toMatch(/Iteration 1/i);
    expect(text).toMatch(/After 10 iterations/i);
    expect(text).toMatch(/PR\(A\)/i);

    // No page errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Global check: ensure there were no console errors or uncaught page errors overall after interactions
  test('No runtime console errors or uncaught exceptions observed during full scenario', async ({ page }) => {
    prPage = new PageRankPage(page);

    // Perform a variety of interactions
    await prPage.clickToggle(); // show
    await prPage.clickToggle(); // hide
    await prPage.clickToggle(); // show

    // Give a short moment for any asynchronous errors to surface
    await page.waitForTimeout(100);

    // Assert there were no page errors (unhandled exceptions)
    expect(pageErrors.length).toBe(0);

    // Assert that no console messages of type 'error' were emitted
    expect(consoleErrors.length).toBe(0);
  });
});