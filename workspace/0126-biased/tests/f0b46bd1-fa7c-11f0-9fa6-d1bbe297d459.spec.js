import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b46bd1-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object for the Agile Demo page
class AgileDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator("button[onclick='showDemo()']");
    this.output = page.locator('#demo-output');
    this.heading = page.locator('h1');
  }

  // Navigate to the page
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Click the "Show Sprint Timeline Demo" button
  async clickShowDemo() {
    await this.button.click();
  }

  // Press Enter while focused on the button (keyboard interaction)
  async pressEnterOnButton() {
    await this.button.focus();
    await this.page.keyboard.press('Enter');
  }

  // Returns computed display style of the demo output
  async demoDisplayStyle() {
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? window.getComputedStyle(el).display : null;
    }, '#demo-output');
  }

  // Returns innerText or innerHTML for assertions
  async demoInnerHTML() {
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.innerHTML : null;
    }, '#demo-output');
  }

  // Check whether showDemo function exists in global scope
  async isShowDemoFunctionDefined() {
    return await this.page.evaluate(() => typeof window.showDemo === 'function');
  }

  // Check the button's visible text content
  async buttonText() {
    return await this.button.textContent();
  }
}

// Group tests related to the FSM and page behavior
test.describe('Comprehensive Guide to Agile Methodology - FSM tests', () => {
  // Arrays to collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors before any navigation to catch early errors
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (log, warning, error, etc.)
    page.on('console', (msg) => {
      // store type and text for later assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect unhandled page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test we will assert that there were no unexpected runtime errors.
    // This validates that the page code executed without uncaught exceptions.
    // NOTE: If the application intentionally throws errors, these assertions should be adjusted.
    expect(pageErrors.length, 'No uncaught page errors should have been emitted').toBe(0);

    // Ensure no console messages of type 'error' were emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'No console.error messages should have been emitted').toBe(0);
  });

  test('Idle state: page renders correctly and demo output is initially hidden', async ({ page }) => {
    // This test validates the S0_Idle state of the FSM:
    // - The page should be rendered (entry action renderPage() is described in the FSM).
    // - Key UI elements (heading and the demo button) should be present.
    // - The demo output (#demo-output) should be hidden initially (display: none).
    const p = new AgileDemoPage(page);
    await p.goto();

    // Verify main heading text exists as evidence of renderPage() (FSM entry action)
    await expect(p.heading).toHaveText('Comprehensive Guide to Agile Methodology');

    // Verify the button exists and has correct text
    await expect(p.button).toBeVisible();
    const btnText = await p.buttonText();
    expect(btnText && btnText.trim(), 'Button text matches expected').toBe('Show Sprint Timeline Demo');

    // The FSM and component definition indicate #demo-output is hidden by default
    const display = await p.demoDisplayStyle();
    expect(display, '#demo-output should be hidden on initial render').toBe('none');

    // Ensure the demo output element exists in the DOM (even if empty)
    const inner = await p.demoInnerHTML();
    // It may be empty string; assert it's not null so element exists
    expect(inner, '#demo-output element should be present in the DOM').not.toBeNull();
  });

  test('Transition ShowDemo: clicking button displays sprint timeline demo (S0 -> S1)', async ({ page }) => {
    // This test validates the ShowDemo event and transition to S1_DemoVisible:
    // - Clicking the button should invoke showDemo() (FSM onEnter for S1)
    // - #demo-output should become visible and contain expected content
    const p = new AgileDemoPage(page);
    await p.goto();

    // Ensure showDemo function exists before clicking (evidence of correct script exposure)
    const hasFunction = await p.isShowDemoFunctionDefined();
    expect(hasFunction, 'showDemo should be defined on window').toBe(true);

    // Click the button to trigger the transition
    await p.clickShowDemo();

    // After clicking, the demo output should be displayed (entry action in FSM)
    await expect(p.output).toBeVisible();

    // Confirm computed style changed to block (per implementation)
    const display = await p.demoDisplayStyle();
    expect(display, '#demo-output display should be block after clicking').toBe('block');

    // Check that content includes multiple expected lines describing the sprint timeline
    const html = await p.demoInnerHTML();
    expect(html.length, 'demo output should contain HTML content').toBeGreaterThan(0);
    expect(html, 'demo output should include 2-Week Sprint Timeline heading').toContain('2-Week Sprint Timeline');
    expect(html, 'demo output should include "Day 1" planning detail').toContain('Day 1: Sprint Planning');
    expect(html, 'demo output should include "Day 14" retrospective detail').toContain('Day 14: Sprint Retrospective');
  });

  test('Idempotent behavior: multiple clicks do not duplicate content unexpectedly', async ({ page }) => {
    // This test validates an edge case: clicking the ShowDemo button multiple times
    // Should not accumulate duplicate content (implementation uses innerHTML assignment).
    const p = new AgileDemoPage(page);
    await p.goto();

    // Click once and capture content
    await p.clickShowDemo();
    const firstHTML = await p.demoInnerHTML();

    // Click again and capture content again
    await p.clickShowDemo();
    const secondHTML = await p.demoInnerHTML();

    // Because showDemo sets innerHTML, the content should be identical (not appended)
    expect(secondHTML, 'Multiple clicks should produce the same content, not duplicate').toBe(firstHTML);
  });

  test('Keyboard accessibility: activate ShowDemo via Enter key', async ({ page }) => {
    // This test validates keyboard interaction for the ShowDemo event.
    // It focuses the button and simulates pressing Enter to trigger the transition.
    const p = new AgileDemoPage(page);
    await p.goto();

    // Initially hidden
    expect(await p.demoDisplayStyle()).toBe('none');

    // Press Enter while the button is focused
    await p.pressEnterOnButton();

    // The output should become visible as a result of the keyboard-triggered activation
    await expect(p.output).toBeVisible();
    expect(await p.demoDisplayStyle()).toBe('block');
  });

  test('DOM attribute evidence: inline onclick handler exists as expected by FSM', async ({ page }) => {
    // This test verifies the evidence the FSM extracted: the button contains an inline onclick attribute.
    // We assert that the attribute is present and equals "showDemo()"
    const p = new AgileDemoPage(page);
    await p.goto();

    const onclickAttr = await page.evaluate(() => {
      const btn = document.querySelector("button[onclick]");
      return btn ? btn.getAttribute('onclick') : null;
    });

    expect(onclickAttr, 'Button should have inline onclick attribute pointing to showDemo()').toBe('showDemo()');
  });

  test('FSM state coverage: verify "Demo Visible" state entry action effects when invoked directly', async ({ page }) => {
    // The FSM lists showDemo() as the entry action for the Demo Visible state.
    // This test ensures invoking showDemo() (via click) produces the described evidence:
    // - output.style.display = 'block'
    // - output.innerHTML contains expected paragraphs

    const p = new AgileDemoPage(page);
    await p.goto();

    // Call the function by clicking as the user does
    await p.clickShowDemo();

    // Verify style and content evidence
    const display = await p.demoDisplayStyle();
    expect(display).toBe('block');

    const html = await p.demoInnerHTML();
    // Check for several indicative snippets to ensure the innerHTML structure is present
    expect(html).toContain('Day 2-6: Development work');
    expect(html).toContain('Day 13: Sprint Review');
    expect(html).toContain('Then the cycle begins again with the next Sprint Planning');
  });

  test('Robustness: attempt to click a non-existent selector gracefully (edge-case)', async ({ page }) => {
    // This test intentionally queries a selector that should not exist and ensures the script handles absence gracefully.
    // We do not modify page script; we only assert that attempting to locate a missing element does not produce page errors.
    const p = new AgileDemoPage(page);
    await p.goto();

    // Attempt to locate a clearly non-existent element and assert locator count is 0
    const missing = page.locator('#non-existent-element-xyz');
    const count = await missing.count();
    expect(count, 'non-existent element should not be present').toBe(0);

    // Ensure no page errors were introduced by this check (collected in afterEach)
  });

  test('Console and page error observation: ensure no unexpected runtime errors on initial load and interactions', async ({ page }) => {
    // This test explicitly verifies that no uncaught page errors or console.error messages were emitted
    // during navigation and typical interactions (this complements the afterEach checks).
    const p = new AgileDemoPage(page);

    // Start fresh by navigating
    await p.goto();

    // Interact: click the demo button to exercise the script
    await p.clickShowDemo();

    // Wait a short moment to allow any asynchronous errors to surface
    await page.waitForTimeout(250);

    // Assert no page errors were collected
    // NOTE: We use the variables captured in the beforeEach listener; however Playwright will have pushed to them.
    // Because afterEach also checks these, this assertion is a direct validation here as well.
    // We do not access those arrays here since they are in outer scope and updated by listeners.
    // The afterEach will enforce zero errors; here we simply ensure interactions completed successfully by checking UI.
    await expect(p.output).toBeVisible();
  });
});