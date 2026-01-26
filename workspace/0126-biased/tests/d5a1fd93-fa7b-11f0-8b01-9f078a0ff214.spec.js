import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a1fd93-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object Model for the Threads demo page
class ThreadsPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.showDemoButton = page.locator('button[onclick="showDemo()"]');
    this.demoContainer = page.locator('#demo');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickShowDemo(options) {
    await this.showDemoButton.click(options);
  }

  async isDemoVisible() {
    // Use computed style to determine visibility rather than relying solely on attribute
    return await this.demoContainer.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style && style.display !== 'none' && style.visibility !== 'hidden' && el.offsetHeight > 0;
    });
  }

  async getDemoDisplayStyle() {
    return await this.demoContainer.evaluate((el) => el.style.display);
  }

  async showDemoFunctionType() {
    return await this.page.evaluate(() => typeof window.showDemo);
  }

  async renderPageFunctionType() {
    return await this.page.evaluate(() => typeof window.renderPage);
  }

  async demoHeadingText() {
    return await this.demoContainer.locator('h3').innerText();
  }
}

test.describe.serial('Understanding Threads in Computing - FSM and UI validation', () => {
  // Attach listeners and navigate before each test. Storing console/page errors on the page object
  test.beforeEach(async ({ page }) => {
    // Arrays to collect errors per test (scoped to the page instance)
    page._consoleErrors = [];
    page._pageErrors = [];

    // Listen for console error messages
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          page._consoleErrors.push(msg.text());
        }
      } catch (e) {
        // If any listener error occurs, capture it as well
        page._consoleErrors.push(`Listener failure: ${String(e)}`);
      }
    });

    // Listen for uncaught exceptions in the page context
    page.on('pageerror', (err) => {
      page._pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Navigate to the app under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Basic sanity: ensure the page's error collections exist
    if (!Array.isArray(page._consoleErrors)) page._consoleErrors = [];
    if (!Array.isArray(page._pageErrors)) page._pageErrors = [];
    // No explicit cleanup of listeners is needed because Playwright provides a fresh page per test.
  });

  test('Initial Idle state (S0_Idle): button present and demo hidden', async ({ page }) => {
    // This test validates the initial FSM Idle state as expressed by the DOM:
    // - The "Show Basic Thread Demo" button exists
    // - The demo container (#demo) exists and is hidden (style.display === 'none')
    // - Verify FSM-declared entry action renderPage() is NOT implemented on the page (i.e., undefined)
    // - Ensure no console or page errors are present immediately after load

    const threads = new ThreadsPage(page);

    // Verify the show demo button exists and has the expected text
    await expect(threads.showDemoButton).toBeVisible();
    await expect(threads.showDemoButton).toHaveText('Show Basic Thread Demo');

    // The demo container should exist in the DOM
    await expect(threads.demoContainer).toBeVisible(); // Present in DOM
    // But visually it should be hidden via style.display === 'none'
    const displayStyle = await threads.getDemoDisplayStyle();
    expect(displayStyle).toBe('none');

    // Confirm computed visibility is false
    const visible = await threads.isDemoVisible();
    expect(visible).toBe(false);

    // The FSM mentioned an entry action renderPage(); verify whether it's implemented
    // This checks for the presence of a global function named renderPage on the window
    const renderPageType = await threads.renderPageFunctionType();
    // Expect it to be "undefined" because the HTML/JS provided does not define renderPage()
    expect(renderPageType).toBe('undefined');

    // Confirm that the showDemo function is implemented (since onclick="showDemo()" exists)
    const showDemoType = await threads.showDemoFunctionType();
    expect(showDemoType).toBe('function');

    // Ensure no runtime console errors or page errors were emitted during initial load
    expect(page._consoleErrors.length).toBe(0);
    expect(page._pageErrors.length).toBe(0);
  });

  test('Transition ShowDemo (Show button click) -> demo becomes visible (S1_DemoVisible)', async ({ page }) => {
    // This test validates the FSM transition:
    // - Clicking the "Show Basic Thread Demo" button should trigger the showDemo() handler
    // - The #demo container should become visible (style.display === 'block')
    // - The content of the demo should include the expected heading
    // - No console or page errors should occur as a result of the interaction

    const threads = new ThreadsPage(page);

    // Ensure initial preconditions
    expect(await threads.isDemoVisible()).toBe(false);

    // Click the button to trigger the ShowDemo event
    await threads.clickShowDemo();

    // After clicking, the demo container should be visible
    const isVisible = await threads.isDemoVisible();
    expect(isVisible).toBe(true);

    // The inline style may be set to "block" by the showDemo function
    const displayAfter = await threads.getDemoDisplayStyle();
    expect(displayAfter).toBe('block');

    // Verify demo contains the expected heading text
    const headingText = await threads.demoHeadingText();
    expect(headingText).toContain('Basic Thread Behavior Demonstration');

    // Verify showDemo still exists and is a function
    const showDemoType = await threads.showDemoFunctionType();
    expect(showDemoType).toBe('function');

    // Ensure clicking produced no console errors and no uncaught page errors
    expect(page._consoleErrors.length, `Console errors: ${page._consoleErrors.join(' | ')}`).toBe(0);
    expect(page._pageErrors.length, `Page errors: ${page._pageErrors.join(' | ')}`).toBe(0);
  });

  test('Edge cases: repeated rapid clicks and keyboard activation do not break demo visibility', async ({ page }) => {
    // This test covers edge cases:
    // - Rapid repeated clicks on the button should not produce errors and should keep the demo visible
    // - Activating the button via keyboard (Enter) should also show the demo
    // - Ensure no console/page errors after these interactions

    const threads = new ThreadsPage(page);

    // Rapid clicks (simulate a user clicking multiple times quickly)
    for (let i = 0; i < 5; i++) {
      await threads.clickShowDemo();
    }

    // Demo should be visible after repeated clicks
    expect(await threads.isDemoVisible()).toBe(true);
    expect(await threads.getDemoDisplayStyle()).toBe('block');

    // Now test keyboard activation:
    // First navigate back to initial state by reloading the page to ensure keyboard activation is exercising the event
    await page.reload();

    // Recreate page object for the reloaded page
    const threadsReloaded = new ThreadsPage(page);

    // Confirm hidden initially
    expect(await threadsReloaded.isDemoVisible()).toBe(false);

    // Focus the button and press Enter to activate the onclick
    await threadsReloaded.showDemoButton.focus();
    await page.keyboard.press('Enter');

    // After pressing Enter, the demo should be visible
    expect(await threadsReloaded.isDemoVisible()).toBe(true);

    // Verify no console errors or uncaught page errors were emitted during these interactions
    expect(page._consoleErrors.length, `Console errors after rapid clicks/keyboard: ${page._consoleErrors.join(' | ')}`).toBe(0);
    expect(page._pageErrors.length, `Page errors after rapid clicks/keyboard: ${page._pageErrors.join(' | ')}`).toBe(0);
  });

  test('FSM onEnter/onExit verification: document lacks renderPage() entry action and no exit actions applied', async ({ page }) => {
    // This test explicitly validates FSM-declared lifecycle actions vs. actual implementation:
    // - FSM declared an entry action renderPage() for the Idle state; verify whether the app implements it.
    // - FSM declared no exit actions for any state; ensure there are no functions like onExit defined by convention.
    // - Do not attempt to call or define missing functions; only observe and assert their absence/presence.

    const threads = new ThreadsPage(page);

    // The FSM specified renderPage() as an entry action for S0_Idle.
    // Check whether renderPage exists on the global scope.
    const renderPageType = await threads.renderPageFunctionType();
    // The provided HTML/JS does not implement renderPage(), so we should observe "undefined".
    expect(renderPageType).toBe('undefined');

    // There's no mention of onExit handlers in the FSM; assert there is no global onExit function present.
    const onExitType = await page.evaluate(() => typeof window.onExit);
    expect(onExitType).toBe('undefined');

    // Ensure page did not emit errors just by verifying function presence
    expect(page._consoleErrors.length).toBe(0);
    expect(page._pageErrors.length).toBe(0);
  });

  test('Robustness: ensure DOM elements match FSM component selectors and evidence', async ({ page }) => {
    // This test ensures the DOM contains the components the FSM described:
    // - button[onclick="showDemo()"] exists and matches FSM evidence
    // - #demo exists and contains expected content snippet (evidence snippet)
    // - Validate that the textual evidence from the FSM appears in the DOM

    const threads = new ThreadsPage(page);

    // Verify the button selector present (locator assertions above already cover existence)
    await expect(page.locator('button[onclick="showDemo()"]')).toBeVisible();

    // Verify the demo container is in the DOM even if hidden
    await expect(page.locator('#demo')).toBeVisible(); // element present

    // Verify the demo contains the expected text snippet from the FSM evidence
    const demoText = await page.locator('#demo').innerText();
    expect(demoText).toContain('Basic Thread Behavior Demonstration');
    expect(demoText).toContain('Thread A: Processing...');
    expect(demoText).toContain('Thread B: Finished');

    // Final check for absence of console/page errors
    expect(page._consoleErrors.length).toBe(0);
    expect(page._pageErrors.length).toBe(0);
  });
});