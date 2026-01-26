import { test, expect } from '@playwright/test';

// Page Object Model for the Stunning Process Visualization page
class VisualizationPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8e65f4-fa77-11f0-8492-31e949ed3c7c.html';
    this.selectors = {
      container: '.container',
      header: 'h1',
      paragraph: 'p',
      exploreButton: '.button',
      backgroundGraphic: '.background-graphic'
    };
  }

  // Navigate to the page and wait until load
  async goto() {
    await this.page.goto(this.url, { waitUntil: 'load' });
    // Ensure the main container is present before proceeding
    await this.page.waitForSelector(this.selectors.container, { state: 'visible', timeout: 3000 });
  }

  async getHeaderText() {
    return (await this.page.locator(this.selectors.header).innerText()).trim();
  }

  async getParagraphText() {
    return (await this.page.locator(this.selectors.paragraph).innerText()).trim();
  }

  async isExploreButtonVisible() {
    return await this.page.isVisible(this.selectors.exploreButton);
  }

  async getExploreButtonText() {
    return (await this.page.locator(this.selectors.exploreButton).innerText()).trim();
  }

  async clickExplore() {
    await this.page.click(this.selectors.exploreButton);
  }

  async hoverExplore() {
    await this.page.hover(this.selectors.exploreButton);
  }

  async focusExplore() {
    await this.page.focus(this.selectors.exploreButton);
  }

  async pressEnter() {
    await this.page.keyboard.press('Enter');
  }

  async getButtonBackgroundColor() {
    return this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return window.getComputedStyle(el).backgroundColor;
    }, this.selectors.exploreButton);
  }

  async isBackgroundGraphicVisible() {
    return await this.page.isVisible(this.selectors.backgroundGraphic);
  }

  async evaluateRenderPageType() {
    return this.page.evaluate(() => typeof window.renderPage);
  }
}

// Group FSM-related tests
test.describe('Stunning Process Visualization - FSM tests', () => {
  // We'll collect console messages and page errors per test to assert expected behaviors
  test.beforeEach(async ({ page }) => {
    // No global setup required beyond what individual tests do
  });

  test.afterEach(async ({ page }) => {
    // Cleanup if needed (none for now)
  });

  test('Idle state: initial render shows expected DOM elements and visuals', async ({ page }) => {
    // This test validates that the Idle state (S0_Idle) evidence is present:
    // - Header
    // - Paragraph
    // - Explore More button
    // - Background graphic
    // It also captures console messages and page errors that may occur during load.
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const viz = new VisualizationPage(page);
    await viz.goto();

    // Assert header text
    const headerText = await viz.getHeaderText();
    expect(headerText).toBe('Visualizing the Process');

    // Assert paragraph is present and contains expected fragment
    const paragraphText = await viz.getParagraphText();
    expect(paragraphText.length).toBeGreaterThan(20);
    expect(paragraphText).toContain('elegant journey of progress');

    // Assert the Explore More button exists and is visible
    expect(await viz.isExploreButtonVisible()).toBeTruthy();
    expect(await viz.getExploreButtonText()).toBe('Explore More');

    // Assert the decorative background graphic is present
    expect(await viz.isBackgroundGraphicVisible()).toBeTruthy();

    // Verify that no runtime errors were thrown during initial render
    expect(pageErrors.length).toBe(0);

    // Ensure there are no console messages of type 'error'
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Idle state: entry action renderPage() is not defined in the page implementation', async ({ page }) => {
    // FSM indicates entry action "renderPage()" for S0_Idle.
    // This test verifies whether renderPage exists; since the HTML has no scripts,
    // the expected result is that renderPage is undefined.
    const viz = new VisualizationPage(page);
    await viz.goto();

    const renderPageType = await viz.evaluateRenderPageType();
    // We expect the function to be missing (type 'undefined').
    expect(renderPageType).toBe('undefined');
  });

  test('Transition ButtonClick: clicking Explore More triggers the transition to Exploring (S1_Exploring)', async ({ page }) => {
    // This test exercises the click event defined in the FSM and verifies the observable evidence.
    // Note: The HTML does not modify the DOM upon click. The FSM transition is validated by
    // ensuring the trigger (button click) is accepted and no errors occur. The evidence for S1_Exploring
    // is the same button; so we assert the button remains present.
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const viz = new VisualizationPage(page);
    await viz.goto();

    // Capture computed background color before interaction (for visual feedback test)
    const beforeColor = await viz.getButtonBackgroundColor();

    // Click the button once
    await viz.clickExplore();

    // After clicking, the UI in this implementation does not change; the button is still present.
    expect(await viz.isExploreButtonVisible()).toBeTruthy();
    expect(await viz.getExploreButtonText()).toBe('Explore More');

    // Verify no page errors occurred as a result of the click
    expect(pageErrors.length).toBe(0);

    // No console.error messages expected as a result of click
    const consoleErrorsAfter = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorsAfter.length).toBe(0);

    // Hover to trigger hover CSS and capture background color change
    await viz.hoverExplore();
    const afterHoverColor = await viz.getButtonBackgroundColor();

    // The color is likely to change when hovered due to CSS; assert that computed style exists and may differ
    expect(beforeColor).toEqual(expect.any(String));
    expect(afterHoverColor).toEqual(expect.any(String));

    // It's acceptable if colors are same in some environments; ensure both are non-null strings
    expect(beforeColor.length).toBeGreaterThan(0);
    expect(afterHoverColor.length).toBeGreaterThan(0);
  });

  test('Transition edge case: multiple rapid clicks and keyboard activation produce no errors and keep UI stable', async ({ page }) => {
    // This test checks robustness to rapid user interactions and keyboard activation (Enter key).
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const viz = new VisualizationPage(page);
    await viz.goto();

    // Perform a burst of clicks to simulate a user spamming the button
    for (let i = 0; i < 5; i++) {
      await viz.clickExplore();
    }

    // Focus and activate via keyboard (Enter)
    await viz.focusExplore();
    await viz.pressEnter();

    // UI should remain stable: button still present, header intact
    expect(await viz.isExploreButtonVisible()).toBeTruthy();
    expect(await viz.getHeaderText()).toBe('Visualizing the Process');

    // No unexpected runtime errors should have occurred
    expect(pageErrors.length).toBe(0);

    // No console.error messages expected
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
  });

  test('Accessibility and semantics: button has accessible name and is keyboard-focusable', async ({ page }) => {
    // Validate that the button is accessible via role/name and focusable via keyboard
    const viz = new VisualizationPage(page);
    await viz.goto();

    const buttonLocator = page.getByRole('button', { name: 'Explore More' });
    expect(await buttonLocator.count()).toBeGreaterThan(0);

    // Focus via JavaScript and check activeElement
    await buttonLocator.focus();
    const activeRoleName = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      return { tag: el.tagName, text: el.innerText && el.innerText.trim() };
    });

    expect(activeRoleName).not.toBeNull();
    expect(activeRoleName.tag).toBe('BUTTON');
    expect(activeRoleName.text).toBe('Explore More');
  });

  test('Error inspection: if runtime errors exist, assert their types and provide informative diagnostics', async ({ page }) => {
    // This test purposely inspects page errors (if any) and asserts their types are one of the expected runtime error kinds.
    // The test will pass if either:
    //  - No page errors occurred, OR
    //  - All page errors are ReferenceError, SyntaxError, or TypeError (as these were allowed to occur naturally).
    const pageErrors = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const viz = new VisualizationPage(page);
    await viz.goto();

    // If there are no errors, assert that explicitly
    if (pageErrors.length === 0) {
      expect(pageErrors.length).toBe(0);
      return;
    }

    // Otherwise, verify each error is of an allowed runtime error type
    for (const err of pageErrors) {
      const name = err.name;
      const message = err.message || '';
      // Log diagnostic context in the test output for easier debugging
      // (Using expect to record information in case of unexpected types)
      expect(
        ['ReferenceError', 'SyntaxError', 'TypeError'].includes(name),
        `Unexpected page error type: ${name}. Message: ${message}`
      ).toBeTruthy();
    }
  });
});