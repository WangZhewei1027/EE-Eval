import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a18862-fa7b-11f0-8b-01-9f078a0ff214.html';

// Page Object encapsulating interactions with the PageRank demo page
class PageRankPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoButton = page.locator('#demoButton');
    this.example = page.locator('#example');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async isDemoButtonVisible() {
    return await this.demoButton.isVisible();
  }

  async demoButtonText() {
    return await this.demoButton.innerText();
  }

  // Returns the computed display property for the #example element
  async getExampleComputedDisplay() {
    return await this.page.$eval('#example', el => window.getComputedStyle(el).display);
  }

  // Returns the inline style.display value (may be "" if not set inline)
  async getExampleInlineDisplay() {
    return await this.page.$eval('#example', el => el.style.display);
  }

  async isExampleVisible() {
    return await this.example.isVisible();
  }

  async clickDemoButton() {
    await this.demoButton.click();
  }

  async focusDemoButton() {
    await this.demoButton.focus();
  }

  async pressKeyOnDemoButton(key) {
    await this.demoButton.press(key);
  }

  async exampleTextContent() {
    return await this.page.$eval('#example', el => el.textContent || '');
  }
}

test.describe('Understanding PageRank interactive application (d5a18862...)', () => {
  // Track runtime errors and console error messages per test
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location(),
        });
      }
    });

    // Collect page errors (uncaught exceptions in the page)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the app page exactly as provided
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Assert that no uncaught page errors occurred during the test.
    // If there were uncaught errors, include them in the assertion message to aid debugging.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.toString()).join('; ')}`).toBe(0);

    // Assert that no console.error() messages were emitted by the page.
    expect(consoleErrors.length, `Unexpected console.error messages: ${consoleErrors.map(e => e.text).join('; ')}`).toBe(0);
  });

  test('Initial state S0_Idle: button exists and example is hidden', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) per the FSM:
    // - The demo button should be present and visible
    // - The #example div should be hidden (display: none)
    const app = new PageRankPage(page);

    // Ensure the page loaded and button is visible
    expect(await app.isDemoButtonVisible()).toBeTruthy();

    // Check button text matches expected label from FSM
    expect(await app.demoButtonText()).toContain('Show Example Calculation');

    // The FSM evidence expects an inline style "display: none;" initially.
    // Verify both computed and inline style reflect a hidden state.
    const computed = await app.getExampleComputedDisplay();
    const inline = await app.getExampleInlineDisplay();

    // Computed display should be 'none' so that the element is not visible.
    expect(computed).toBe('none');

    // Inline style on the element in this implementation is "display: none;"
    // But even if inline were empty, computed must still be 'none'. We assert inline equals 'none' as per provided HTML.
    expect(inline).toBe('none');

    // The element should not be visible from Playwright's perspective
    expect(await app.isExampleVisible()).toBeFalsy();
  });

  test('Transition S0 -> S1: clicking the button shows the example (style.display = "block")', async ({ page }) => {
    // This test validates the ShowExample event and the transition from Idle to Example Visible.
    // It verifies that clicking the button results in the #example element becoming visible
    // and that the inline style.display is set to "block" as implemented.
    const app = new PageRankPage(page);

    // Precondition: initially hidden
    expect(await app.getExampleComputedDisplay()).toBe('none');

    // Trigger the event: click the demo button
    await app.clickDemoButton();

    // After click, the element should be visible (computed style not 'none')
    const computedAfter = await app.getExampleComputedDisplay();
    expect(computedAfter).not.toBe('none');

    // The implementation sets inline style.display to "block" when showing; assert that.
    const inlineAfter = await app.getExampleInlineDisplay();
    expect(inlineAfter).toBe('block');

    // And Playwright should consider the element visible
    expect(await app.isExampleVisible()).toBeTruthy();

    // Also validate that the example content includes expected explanatory text (sanity check)
    const content = await app.exampleTextContent();
    expect(content).toMatch(/PR\(C\)|PageRank|PR\(/);
  });

  test('Transition S1 -> S0: clicking the button again hides the example (style.display = "none")', async ({ page }) => {
    // This test validates toggling back from Example Visible to Idle on a second click.
    const app = new PageRankPage(page);

    // Show first
    await app.clickDemoButton();
    expect(await app.getExampleComputedDisplay()).not.toBe('none');
    expect(await app.getExampleInlineDisplay()).toBe('block');

    // Click again to hide
    await app.clickDemoButton();

    // After the second click, the element should be hidden again
    const computedAfterSecond = await app.getExampleComputedDisplay();
    expect(computedAfterSecond).toBe('none');

    const inlineAfterSecond = await app.getExampleInlineDisplay();
    // Implementation sets inline to 'none' when hiding
    expect(inlineAfterSecond).toBe('none');

    expect(await app.isExampleVisible()).toBeFalsy();
  });

  test('Edge case: rapid double-click toggles twice and returns to Idle', async ({ page }) => {
    // This edge-case test simulates a user quickly clicking the button twice.
    // The expected behavior per the FSM is two toggles: S0 -> S1 -> S0, ending in Idle (hidden).
    const app = new PageRankPage(page);

    // Ensure starting hidden
    expect(await app.getExampleComputedDisplay()).toBe('none');

    // Rapidly click twice (no artificial waits)
    await Promise.all([
      app.clickDemoButton(),
      app.clickDemoButton()
    ]).catch(() => {
      // Some browsers might serialize these; we don't patch behavior. Allow natural behavior.
    });

    // The final state should be hidden again (two toggles)
    const finalComputed = await app.getExampleComputedDisplay();
    expect(finalComputed).toBe('none');
    expect(await app.isExampleVisible()).toBeFalsy();
  });

  test('Interaction via keyboard: Enter/Space activates the button and toggles the example', async ({ page }) => {
    // This test checks keyboard accessibility paths:
    // Focusing the button and pressing Enter or Space should toggle visibility.
    const app = new PageRankPage(page);

    // Focus the button and press Enter => should show
    await app.focusDemoButton();
    await app.pressKeyOnDemoButton('Enter');

    expect(await app.isExampleVisible()).toBeTruthy();
    expect(await app.getExampleInlineDisplay()).toBe('block');

    // Press Space to toggle back => should hide
    await app.pressKeyOnDemoButton('Space');

    expect(await app.isExampleVisible()).toBeFalsy();
    expect(await app.getExampleInlineDisplay()).toBe('none');
  });

  test('Verify absence of missing-entry-action ReferenceError (renderPage) and no unexpected runtime errors', async ({ page }) => {
    // FSM mentions an entry action renderPage() for S0_Idle, but the HTML does not define such a function.
    // This test ensures that the application does not attempt to call renderPage() on load (which would cause a ReferenceError),
    // and generally ensures no uncaught runtime errors occur.
    const app = new PageRankPage(page);

    // Confirm page loaded elements
    expect(await app.isDemoButtonVisible()).toBeTruthy();

    // We did not observe page errors in afterEach; but explicitly ensure none of the captured page errors
    // are ReferenceError mentioning 'renderPage' (defensive check).
    const renderPageErrors = pageErrors.filter(err => /renderPage/.test(String(err)));
    expect(renderPageErrors.length, `Unexpected ReferenceErrors mentioning renderPage: ${renderPageErrors.map(e => e.toString()).join('; ')}`).toBe(0);

    // Also ensure no console.error mentioned renderPage
    const consoleRenderPageErrors = consoleErrors.filter(e => /renderPage/.test(e.text));
    expect(consoleRenderPageErrors.length, `console.error mentions renderPage: ${consoleRenderPageErrors.map(e => e.text).join('; ')}`).toBe(0);
  });

  test('Content verification: example contains the PageRank calculation snippet when visible', async ({ page }) => {
    // Validate that the example includes the expected calculation snippet after showing.
    const app = new PageRankPage(page);

    // Show the example
    await app.clickDemoButton();

    // Ensure visible
    expect(await app.isExampleVisible()).toBeTruthy();

    // Check for a few tokens from the provided example calculation to ensure content integrity
    const text = await app.exampleTextContent();
    expect(text).toContain('PR(C)');
    expect(text).toContain('0.85');
    expect(text).toMatch(/1\.425|1.275|0\.15/);
  });
});