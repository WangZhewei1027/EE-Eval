import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b3cf92-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object for the demo page to encapsulate interactions and queries
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator("button[onclick='showDemo()']");
    this.demo = page.locator('#demo');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Click the "Show Atomicity Demo" button
  async clickShowButton() {
    await this.button.click();
  }

  // Returns true if element is visible according to Playwright
  async isDemoVisible() {
    return await this.demo.isVisible();
  }

  // Returns the inline style.display property (may be empty string if not set inline)
  async demoInlineDisplayStyle() {
    return await this.page.evaluate(() => {
      const el = document.getElementById('demo');
      return el ? el.style.display : null;
    });
  }

  // Returns computed style for the demo element
  async demoComputedDisplay() {
    return await this.page.evaluate(() => {
      const el = document.getElementById('demo');
      if (!el) return null;
      return window.getComputedStyle(el).display;
    });
  }

  // Returns text content inside the demo div
  async demoText() {
    return await this.demo.innerText();
  }

  // Check whether showDemo function exists globally
  async hasShowDemoFunction() {
    return await this.page.evaluate(() => typeof window.showDemo === 'function');
  }

  // Check whether renderPage function exists globally (FSM entry action mentions renderPage)
  async hasRenderPageFunction() {
    return await this.page.evaluate(() => typeof window.renderPage === 'function');
  }

  // Returns the onclick attribute of the button
  async buttonOnclickAttribute() {
    return await this.button.getAttribute('onclick');
  }
}

test.describe('ACID Properties Demo (Atomicity) - FSM State & Transition Tests', () => {
  let demoPage;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for assertions
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // store type and text for later assertions/logging
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // store the error object
      pageErrors.push(err);
    });

    demoPage = new DemoPage(page);
    await demoPage.goto();
  });

  test.afterEach(async () => {
    // After each test ensure there were no uncaught page errors.
    // We intentionally assert there are no runtime page errors (ReferenceError, TypeError, SyntaxError)
    // because the HTML/JS should be valid. This validates that the environment executed as-is without unexpected exceptions.
    expect(pageErrors.length, `Expected no uncaught page errors but found: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);

    // Also ensure there are no console.error messages emitted during the test
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Expected no console.error messages but found: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);

    // Additionally assert there are no messages indicating ReferenceError/TypeError/SyntaxError in any console output
    const fatalPatterns = ['ReferenceError', 'TypeError', 'SyntaxError'];
    const foundFatal = consoleMessages.filter(m => fatalPatterns.some(p => m.text.includes(p)));
    expect(foundFatal.length, `Found fatal error patterns in console messages: ${foundFatal.map(m => m.text).join(' | ')}`).toBe(0);
  });

  test('S0_Idle - Initial render: button present, demo hidden, on-page functions inspected', async () => {
    // Validate initial state S0_Idle per FSM:
    // - The "Show Atomicity Demo" button should be present
    // - The demo element should be present in the DOM but hidden (display: none)
    // - FSM entry_action renderPage is mentioned in FSM metadata; verify whether such function exists (do not inject)
    // - The button should have the onclick attribute wired to showDemo()

    // Button exists and is visible
    await expect(demoPage.button).toBeVisible();

    // Button text matches expected label
    await expect(demoPage.button).toHaveText('Show Atomicity Demo');

    // The demo div exists in DOM
    const demoExists = await demoPage.page.locator('#demo').count();
    expect(demoExists).toBeGreaterThan(0);

    // Demo should be hidden initially (computed style)
    const computed = await demoPage.demoComputedDisplay();
    expect(computed).toBe('none');

    // Inline style may be empty initially, but computed style should be 'none'
    const inline = await demoPage.demoInlineDisplayStyle();
    // Accept either empty string or 'none' inline; assert not 'block' initially
    expect(inline === 'block').toBe(false);

    // The showDemo function should be defined globally (it's used as onclick in the markup)
    const hasShowDemo = await demoPage.hasShowDemoFunction();
    expect(hasShowDemo).toBe(true);

    // The FSM mentioned renderPage() as an entry action for S0_Idle.
    // Verify whether such a function exists; we must not create it. We simply assert its absence/presence as-is.
    const hasRenderPage = await demoPage.hasRenderPageFunction();
    // The provided HTML does not define renderPage(), so expecting false here.
    expect(hasRenderPage).toBe(false);

    // Verify the button onclick attribute matches the evidence in the FSM
    const onclickAttr = await demoPage.buttonOnclickAttribute();
    expect(onclickAttr).toBe('showDemo()');
  });

  test('S0 -> S1 transition: clicking button shows the demo (Demo Visible)', async () => {
    // Precondition: demo hidden
    const beforeComputed = await demoPage.demoComputedDisplay();
    expect(beforeComputed).toBe('none');

    // Trigger event ShowDemo
    await demoPage.clickShowButton();

    // After click, demo should be visible
    await expect(demoPage.demo).toBeVisible();

    // The inline style should have been set to 'block' by the click handler
    const inline = await demoPage.demoInlineDisplayStyle();
    expect(inline).toBe('block');

    // Computed style should also reflect visibility
    const computed = await demoPage.demoComputedDisplay();
    expect(computed).toBe('block');

    // Content sanity: demo text contains the Scenario description
    const text = await demoPage.demoText();
    expect(text).toContain('Scenario: Transfer $100 from Account A ($1000) to Account B ($500)');
  });

  test('S1 -> S2 transition: clicking button hides the demo (Demo Hidden)', async () => {
    // Ensure demo is visible first
    const isVisibleBefore = await demoPage.isDemoVisible();
    if (!isVisibleBefore) {
      await demoPage.clickShowButton();
      await expect(demoPage.demo).toBeVisible();
    }

    // Now click to hide (transition S1 -> S2)
    await demoPage.clickShowButton();

    // Demo should be hidden after click
    await expect(demoPage.demo).not.toBeVisible();

    // The inline style display should be 'none'
    const inline = await demoPage.demoInlineDisplayStyle();
    expect(inline).toBe('none');

    // Computed style should be 'none'
    const computed = await demoPage.demoComputedDisplay();
    expect(computed).toBe('none');
  });

  test('S2 -> S1 transition: clicking button shows the demo again (toggle back)', async () => {
    // Ensure demo is hidden to start this test
    const visibleStart = await demoPage.isDemoVisible();
    if (visibleStart) {
      // hide it
      await demoPage.clickShowButton();
      await expect(demoPage.demo).not.toBeVisible();
    }

    // Click to show (S2 -> S1)
    await demoPage.clickShowButton();

    // Demo should be visible
    await expect(demoPage.demo).toBeVisible();
    const computed = await demoPage.demoComputedDisplay();
    expect(computed).toBe('block');
    const inline = await demoPage.demoInlineDisplayStyle();
    expect(inline).toBe('block');
  });

  test('Edge case: rapid multiple clicks toggle correctly and do not produce runtime errors', async ({ page }) => {
    // Start from known hidden state
    const currentlyVisible = await demoPage.isDemoVisible();
    if (currentlyVisible) {
      await demoPage.clickShowButton();
      await expect(demoPage.demo).not.toBeVisible();
    }

    // Perform a rapid series of clicks
    const clicks = 7; // odd number -> final expected visible
    for (let i = 0; i < clicks; i++) {
      // rapidly click without waiting for long delays to simulate fast user interactions
      await demoPage.button.click();
    }

    // Expected final state: since clicks is odd, demo should be visible
    const finalVisible = await demoPage.isDemoVisible();
    expect(finalVisible).toBe(true);

    // Ensure computed style reflects visible state
    const computed = await demoPage.demoComputedDisplay();
    expect(computed).toBe('block');

    // Confirm there were no errors collected during these rapid interactions
    // (the afterEach will also assert, but we make an inline check here for clarity)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Direct invocation: calling window.showDemo toggles the demo and leaves no errors', async () => {
    // Capture initial state
    const beforeVisible = await demoPage.isDemoVisible();

    // Call the function directly via page.evaluate (do not patch or create functions)
    await demoPage.page.evaluate(() => {
      // direct invocation - will use the existing showDemo function defined inline in the page
      // This is equivalent to the onclick handler but tests direct invocation path
      if (typeof window.showDemo === 'function') {
        window.showDemo();
      } else {
        // No-op if not present; we don't inject it
      }
    });

    // After invocation, state should toggle
    const afterVisible = await demoPage.isDemoVisible();
    expect(afterVisible).toBe(!beforeVisible);

    // Call again to restore original state
    await demoPage.page.evaluate(() => {
      if (typeof window.showDemo === 'function') {
        window.showDemo();
      }
    });

    const restored = await demoPage.isDemoVisible();
    expect(restored).toBe(beforeVisible);

    // Confirm no runtime page errors were captured (will also be asserted in afterEach)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Sanity: verify DOM evidence elements from FSM are present and match expectations', async () => {
    // Evidence: The FSM expected a button with onclick="showDemo()" and a div#demo with class "demo"
    const buttonOnclick = await demoPage.button.getAttribute('onclick');
    expect(buttonOnclick).toBe('showDemo()');

    const demoClass = await demoPage.demo.getAttribute('class');
    expect(demoClass).toContain('demo');

    // The demo should contain text "Demo" as part of its content (evidence)
    const inner = await demoPage.demo.innerText();
    expect(inner.length).toBeGreaterThan(0);
    expect(inner).toContain('Scenario:');
  });
});