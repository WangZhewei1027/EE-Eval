import { test, expect } from '@playwright/test';

// Test suite for Application ID: d8377580-fa7b-11f0-b314-ad8654ee5de8
// File: d8377580-fa7b-11f0-b314-ad8654ee5de8.spec.js
//
// Notes:
// - Tests are written using ES module syntax (import).
// - The page is loaded exactly as-is; console and page errors are observed.
// - We do not modify the page or patch any runtime behavior.
// - Tests validate FSM states and transitions described in the provided FSM.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8377580-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object Model for the demo page
class PvsNPPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.toggleBtn = page.locator('#toggleDemo');
    this.demoArea = page.locator('#demoArea');
    this.countText = page.locator('#countText');
    this.svgNode = page.locator('svg.node');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure main content loaded
    await expect(this.page.locator('main.container')).toBeVisible();
  }

  async getButtonText() {
    return (await this.toggleBtn.textContent())?.trim();
  }

  async isButtonAriaExpanded() {
    return await this.toggleBtn.getAttribute('aria-expanded');
  }

  async isDemoAriaHidden() {
    return await this.demoArea.getAttribute('aria-hidden');
  }

  async demoDisplayStyle() {
    // read the computed style display via evaluate to ensure we get final computed value
    return await this.demoArea.evaluate((el) => window.getComputedStyle(el).display);
  }

  async clickToggle() {
    await this.toggleBtn.click();
  }

  async pressToggleWithKeyboard(key = 'Enter') {
    await this.toggleBtn.focus();
    await this.page.keyboard.press(key);
  }

  async clickInsideDemo() {
    // Click on the demo area's inner graphbox if visible; fallback to demoArea
    const inner = this.demoArea.locator('.graphbox');
    if (await inner.count() > 0) {
      await inner.first().click();
    } else {
      await this.demoArea.click();
    }
  }

  async getCountTextContent() {
    return (await this.countText.textContent())?.trim();
  }

  async svgAriaLabel() {
    return await this.svgNode.getAttribute('aria-label');
  }
}

test.describe('P vs NP — Minimal demonstration: FSM states and transitions', () => {
  // containers for console and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for inspection
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Collect uncaught exceptions / page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test we assert there were no unexpected runtime errors.
    // The page is loaded as-is; if runtime errors occur naturally they will be captured.
    // We assert there were zero uncaught page errors.
    expect(pageErrors.length).toBe(0);
    // Assert there were no console.error messages emitted
    const errorConsole = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('Initial state (S0_Idle): button and demo area are in idle configuration', async ({ page }) => {
    // This test validates the initial FSM Idle state:
    // - Button text is "Show demonstration"
    // - Button aria-expanded is "false"
    // - Demo area has aria-hidden="true" and is not displayed (display:none)
    const app = new PvsNPPage(page);
    await app.goto();

    // Validate button markup and attributes
    await expect(app.toggleBtn).toBeVisible();
    const btnText = await app.getButtonText();
    expect(btnText).toBe('Show demonstration');

    const ariaExpanded = await app.isButtonAriaExpanded();
    expect(ariaExpanded).toBe('false');

    // Validate demo area is hidden
    const ariaHidden = await app.isDemoAriaHidden();
    expect(ariaHidden).toBe('true');

    const displayStyle = await app.demoDisplayStyle();
    // Computed style for hidden demo should be 'none'
    expect(displayStyle).toBe('none');

    // Sanity: the SVG inside demo has aria-label as expected (non-interactive check)
    const svgLabel = await app.svgAriaLabel();
    expect(svgLabel).toBe('small graph');

    // Ensure no unexpected console messages so far (these will be checked again in afterEach)
  });

  test('Transition S0_Idle -> S1_DemoVisible via ToggleDemo click', async ({ page }) => {
    // This test validates the click event transition:
    // - Clicking the toggle button should show the demo (display:block)
    // - Button text should become "Hide demonstration"
    // - aria-expanded set to "true"
    // - demo aria-hidden set to "false"
    // - count text updates to include "5! = 120"
    const app = new PvsNPPage(page);
    await app.goto();

    // Click to show
    await app.clickToggle();

    // After click: demo visible
    const btnTextAfter = await app.getButtonText();
    expect(btnTextAfter).toBe('Hide demonstration');

    const ariaExpandedAfter = await app.isButtonAriaExpanded();
    expect(ariaExpandedAfter).toBe('true');

    const ariaHiddenAfter = await app.isDemoAriaHidden();
    expect(ariaHiddenAfter).toBe('false');

    const displayAfter = await app.demoDisplayStyle();
    expect(displayAfter).toBe('block');

    // Ensure the permutations text updated as per the inline script
    const countText = await app.getCountTextContent();
    expect(countText).toContain('5! = 120');

    // The demonstration explanatory text should be visible
    await expect(app.demoArea).toBeVisible();
  });

  test('Transition S1_DemoVisible -> S0_Idle via ToggleDemo click (hide again)', async ({ page }) => {
    // Validate toggling back to idle: click twice and verify original state restored
    const app = new PvsNPPage(page);
    await app.goto();

    // Show
    await app.clickToggle();
    await expect(app.demoArea).toBeVisible();

    // Hide
    await app.clickToggle();

    // Check returned to initial Idle state
    const btnText = await app.getButtonText();
    expect(btnText).toBe('Show demonstration');

    const ariaExpanded = await app.isButtonAriaExpanded();
    expect(ariaExpanded).toBe('false');

    const ariaHidden = await app.isDemoAriaHidden();
    expect(ariaHidden).toBe('true');

    const displayStyle = await app.demoDisplayStyle();
    expect(displayStyle).toBe('none');
  });

  test('Edge case: rapid multiple clicks toggle reliably (debounce/ordering check)', async ({ page }) => {
    // This test rapidly clicks the toggle button multiple times to ensure
    // the UI reaches a deterministic state (odd number of clicks -> visible,
    // even number -> hidden). It also validates no exceptions are thrown during rapid toggles.
    const app = new PvsNPPage(page);
    await app.goto();

    // click 5 times (odd -> visible)
    for (let i = 0; i < 5; i++) {
      await app.clickToggle();
    }

    // 5 clicks => visible
    expect(await app.demoDisplayStyle()).toBe('block');
    expect(await app.getButtonText()).toBe('Hide demonstration');

    // click 1 more time (total 6 -> hidden)
    await app.clickToggle();
    expect(await app.demoDisplayStyle()).toBe('none');
    expect(await app.getButtonText()).toBe('Show demonstration');
  });

  test('Keyboard activation: Enter and Space toggle the demonstration', async ({ page }) => {
    // Validate that keyboard interactions (Enter and Space) on the button trigger the same event handler.
    const app = new PvsNPPage(page);
    await app.goto();

    // Use Enter to open
    await app.pressToggleWithKeyboard('Enter');
    expect(await app.demoDisplayStyle()).toBe('block');
    expect(await app.getButtonText()).toBe('Hide demonstration');

    // Use Space to close
    await app.pressToggleWithKeyboard('Space');
    // Space may scroll the page; ensure we still check the result after a brief wait
    await page.waitForTimeout(50);
    expect(await app.demoDisplayStyle()).toBe('none');
    expect(await app.getButtonText()).toBe('Show demonstration');
  });

  test('Clicking inside the demo area does not toggle visibility (no unexpected handlers)', async ({ page }) => {
    // Once visible, clicking inside the demo content should NOT toggle the demo visibility
    const app = new PvsNPPage(page);
    await app.goto();

    // Show demo
    await app.clickToggle();
    expect(await app.demoDisplayStyle()).toBe('block');

    // Click inside demo content
    await app.clickInsideDemo();

    // The demo should remain visible
    expect(await app.demoDisplayStyle()).toBe('block');
    expect(await app.getButtonText()).toBe('Hide demonstration');
  });

  test('State invariants and accessibility attributes persist after repeated interactions', async ({ page }) => {
    // Repeated show/hide cycles maintain expected ARIA attributes and text
    const app = new PvsNPPage(page);
    await app.goto();

    for (let cycle = 0; cycle < 3; cycle++) {
      // show
      await app.clickToggle();
      expect(await app.isButtonAriaExpanded()).toBe('true');
      expect(await app.isDemoAriaHidden()).toBe('false');
      expect(await app.getButtonText()).toBe('Hide demonstration');
      expect((await app.getCountTextContent()) || '').toContain('5! = 120');

      // hide
      await app.clickToggle();
      expect(await app.isButtonAriaExpanded()).toBe('false');
      expect(await app.isDemoAriaHidden()).toBe('true');
      expect(await app.getButtonText()).toBe('Show demonstration');
    }
  });

  test('Page structure contains documented evidence snippets (basic source checks)', async ({ page }) => {
    // While we must not modify or "repair" the page, we can inspect the page source to verify
    // presence of expected strings that served as evidence in the FSM extraction.
    // This ensures the event handler code and elements exist in the loaded document.
    await page.goto(APP_URL);

    const html = await page.content();

    // Evidence: button addEventListener should appear in inline script
    expect(html).toContain("btn.addEventListener('click'");

    // Evidence: initial button markup and demo div attributes should be present
    expect(html).toContain('<button class="btn" id="toggleDemo" aria-expanded="false">Show demonstration</button>');
    expect(html).toContain('<div class="demo" id="demoArea" aria-hidden="true">');
  });
});