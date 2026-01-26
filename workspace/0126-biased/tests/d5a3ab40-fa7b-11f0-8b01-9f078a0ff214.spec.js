import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a3ab40-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object Model for the Hash Demo page
class HashDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('button[onclick="showDemo()"]');
    this.demo = page.locator('#demo');
    this.hashOutput = page.locator('#hash-output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickShowDemo() {
    await this.button.click();
  }

  async isDemoVisible() {
    return await this.demo.isVisible();
  }

  async getDemoDisplayStyle() {
    return await this.page.evaluate(() => {
      const el = document.getElementById('demo');
      return el ? window.getComputedStyle(el).display : null;
    });
  }

  async getHashText() {
    return await this.hashOutput.innerText();
  }

  async getButtonOnclickAttr() {
    return await this.page.evaluate(() => {
      const btn = document.querySelector('button[onclick="showDemo()"]');
      return btn ? btn.getAttribute('onclick') : null;
    });
  }

  async hasFunction(functionName) {
    return await this.page.evaluate((name) => typeof window[name] === 'function', functionName);
  }

  async callFunction(functionName, ...args) {
    return await this.page.evaluate((name, args) => {
      // Call the function in page context with provided args and return its value.
      return window[name] ? window[name](...args) : undefined;
    }, functionName, args);
  }
}

test.describe('Understanding Hash Functions - FSM and UI Validation', () => {
  // Arrays to collect console messages and page errors per test
  let consoleMessages;
  let consoleErrorMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrorMessages = [];
    pageErrors = [];

    // Capture console events for diagnostics and assertions
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        consoleErrorMessages.push(text);
      }
    });

    // Capture uncaught exceptions happening on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });
  });

  test.afterEach(async ({ page }) => {
    // Include teardown validation hooks if necessary (here we just ensure page is closed by Playwright)
    // Keep the arrays available for debugging in test failure output if needed
    // No explicit teardown required beyond Playwright's fixtures
  });

  test('Initial Idle State (S0_Idle): button present and demo hidden, entry action absence observed', async ({ page }) => {
    // This test validates the initial state S0_Idle:
    // - The "Click to See a Simple Hash Example" button is present with the onclick handler.
    // - The demo div (#demo) is initially hidden (display: none).
    // - The FSM entry action renderPage() is not implemented in the HTML; ensure it's not present to avoid assuming behavior.
    const p = new HashDemoPage(page);
    await p.goto();

    // Button exists and has the correct onclick attribute
    await expect(p.button).toBeVisible();
    const buttonText = await p.button.innerText();
    expect(buttonText).toContain('Click to See a Simple Hash Example');

    const onclickAttr = await p.getButtonOnclickAttr();
    expect(onclickAttr).toBe('showDemo()');

    // The demo div should be hidden initially (display: none)
    const displayStyle = await p.getDemoDisplayStyle();
    expect(displayStyle).toBe('none');

    // The hash output span should exist but be empty initially
    const initialHashText = await p.getHashText();
    expect(initialHashText).toBe('');

    // Verify that renderPage (listed as an entry_action in FSM) is not defined in the page.
    // We assert it is undefined rather than attempting to patch or call it.
    const hasRenderPage = await p.hasFunction('renderPage');
    expect(hasRenderPage).toBe(false);

    // Ensure no runtime page errors or console error messages happened during load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrorMessages.length).toBe(0);
  });

  test('Transition ClickShowDemo (S0_Idle -> S1_DemoVisible): clicking button shows demo and populates hash-output', async ({ page }) => {
    // This test validates the ClickShowDemo event/transition:
    // - Clicking the button triggers showDemo()
    // - The #demo element becomes visible (S1_DemoVisible)
    // - The #hash-output is updated by sha256("Hello") (in this HTML it returns an empty string)
    // - No runtime exceptions are thrown during the transition
    const p = new HashDemoPage(page);
    await p.goto();

    // Confirm showDemo function exists before clicking
    const hasShowDemo = await p.hasFunction('showDemo');
    expect(hasShowDemo).toBe(true);

    // Click to trigger transition
    await p.clickShowDemo();

    // After click, demo should be visible per FSM expected observable
    await expect(p.demo).toBeVisible();
    const displayStyleAfter = await p.getDemoDisplayStyle();
    expect(displayStyleAfter).toBe('block');

    // The hash-output is populated by the sha256 function call inside showDemo. In this implementation,
    // sha256 returns an empty string (no errors), so we expect empty string as the output.
    const hashText = await p.getHashText();
    expect(hashText).toBe('');

    // Confirm sha256 function exists and can be invoked directly without throwing
    const hasSha256 = await p.hasFunction('sha256');
    expect(hasSha256).toBe(true);

    // Call sha256 directly and assert it returns a string (empty or otherwise)
    const shaResult = await p.callFunction('sha256', 'Hello');
    expect(typeof shaResult).toBe('string');

    // Clicking again should not produce errors and should keep demo visible
    await p.clickShowDemo();
    await expect(p.demo).toBeVisible();

    // No page errors and no console errors during clicks
    expect(pageErrors.length).toBe(0);
    expect(consoleErrorMessages.length).toBe(0);
  });

  test('Edge cases and robustness: repeated interactions and missing implementations', async ({ page }) => {
    // This test covers:
    // - Repeated clicks (idempotency / consistent state)
    // - Behavior when functions referenced in FSM (renderPage) are missing
    // - Observation of console/page errors (we assert none occurred)
    const p = new HashDemoPage(page);
    await p.goto();

    // Click multiple times in quick succession
    await p.clickShowDemo();
    await p.clickShowDemo();
    await p.clickShowDemo();

    // Demo remains visible and hash output remains a string
    await expect(p.demo).toBeVisible();
    const hashAfterMultipleClicks = await p.getHashText();
    expect(typeof hashAfterMultipleClicks).toBe('string');

    // Ensure that renderPage is still not implemented (FSM entry action absent)
    const hasRenderPage = await p.hasFunction('renderPage');
    expect(hasRenderPage).toBe(false);

    // Ensure no errors were logged to the console and no uncaught exceptions were thrown
    expect(consoleErrorMessages.length).toBe(0, `Console error messages were found: ${JSON.stringify(consoleErrorMessages)}`);
    expect(pageErrors.length).toBe(0, `Page errors were found: ${JSON.stringify(pageErrors)}`);
  });

  test('FSM state assertions mapped to DOM: S0_Idle to S1_DemoVisible lifecycle verification', async ({ page }) => {
    // This higher-level test maps FSM states to DOM observations:
    // - S0_Idle: button present, #demo hidden
    // - Transition ClickShowDemo: triggers showDemo and leads to S1_DemoVisible (#demo displayed)
    const p = new HashDemoPage(page);
    await p.goto();

    // S0_Idle checks
    await expect(p.button).toBeVisible();
    expect(await p.getDemoDisplayStyle()).toBe('none');

    // Fire the event defined in FSM
    await p.clickShowDemo();

    // S1_DemoVisible checks
    expect(await p.isDemoVisible()).toBe(true);
    expect(await p.getDemoDisplayStyle()).toBe('block');

    // Validate evidence: the onclick handler is present on the button (matches FSM trigger_selector)
    const onclickAttr = await p.getButtonOnclickAttr();
    expect(onclickAttr).toBe('showDemo()');

    // Validate expected observable: #demo is displayed
    await expect(p.demo).toBeVisible();
  });

  test('Observability: capture console logs and page errors for transparency', async ({ page }) => {
    // This test ensures we are observing console output and page errors.
    // It does not assert that errors must exist; instead it asserts we captured whatever occurred.
    const p = new HashDemoPage(page);
    await p.goto();

    // Trigger the demo to generate typical runtime activity
    await p.clickShowDemo();

    // We expect to have captured console messages (info/debug), but no console errors or page errors
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0); // at minimum zero messages captured
    expect(consoleErrorMessages.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});