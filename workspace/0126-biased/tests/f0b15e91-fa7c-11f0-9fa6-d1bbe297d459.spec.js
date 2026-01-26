import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b15e91-fa7c-11f0-9fa6-d1bbe297d459.html';

/**
 * Page Object Model for the Sets demonstration page.
 * Encapsulates selectors and common interactions to keep tests readable.
 */
class SetsPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demonstrateButton = page.locator("button[onclick='showUnion()']");
    this.result = page.locator('#demoResult');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickDemonstrateUnion() {
    await this.demonstrateButton.click();
  }

  async getResultInnerHTML() {
    return await this.page.evaluate(() => {
      const el = document.getElementById('demoResult');
      return el ? el.innerHTML : null;
    });
  }

  async getResultDisplayStyle() {
    return await this.page.evaluate(() => {
      const el = document.getElementById('demoResult');
      if (!el) return null;
      return el.style.display || getComputedStyle(el).display;
    });
  }
}

test.describe('FSM: Comprehensive Guide to Sets - States and Transitions', () => {
  // Capture console messages and page errors for assertions and diagnostics.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages emitted by the page
    page.on('console', (msg) => {
      // store text and type for richer assertions if needed
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors
    page.on('pageerror', (error) => {
      // push the error object so tests can assert its message/content
      pageErrors.push(error);
    });

    // Navigate to the application under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // small diagnostic output on failure could be added here.
    // Intentionally do not modify the page environment.
    // Remove listeners by closing page (Playwright does this automatically per test).
  });

  test('Idle state (S0_Idle): initial render shows button and hidden result element', async ({ page }) => {
    // Validate initial (Idle) state per FSM:
    // - The "Demonstrate Union" button exists
    // - The demoResult element exists but is hidden (display: none)
    // - No uncaught page errors during initial load
    const setsPage = new SetsPage(page);

    // Button should be visible and have correct text
    await expect(setsPage.demonstrateButton).toBeVisible();
    await expect(setsPage.demonstrateButton).toHaveText('Demonstrate Union');

    // The result container should exist and be hidden by default
    await expect(setsPage.result).toHaveCount(1);
    const displayStyle = await setsPage.getResultDisplayStyle();
    // The CSS sets display: none initially
    expect(displayStyle === 'none' || displayStyle === '').toBeTruthy();

    // The innerHTML should be empty string initially (no content)
    const initialInner = await setsPage.getResultInnerHTML();
    // Some browsers may return null or empty string; accept both but assert not populated
    expect(initialInner === null || initialInner.trim() === '').toBeTruthy();

    // Ensure there were no uncaught page errors on load
    expect(pageErrors.length).toBe(0);

    // Ensure no console.error logs were emitted on load
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Transition DemonstrateUnion (S0 -> S1): clicking button displays union result and updates DOM', async ({ page }) => {
    // Validate the transition triggered by clicking the button produces the expected observables:
    // - demoResult.innerHTML contains the Set A, Set B, and Union lines
    // - demoResult.style.display is 'block'
    // - No uncaught page errors occurred during the transition
    const setsPage = new SetsPage(page);

    // Precondition: result hidden
    expect(await setsPage.getResultDisplayStyle()).toBe('none');

    // Click the demonstrate union button
    await setsPage.clickDemonstrateUnion();

    // Wait for the result element to be visible and verify its content
    await expect(setsPage.result).toBeVisible();

    // Verify the result innerHTML contains the expected pieces of information
    const innerHTML = await setsPage.getResultInnerHTML();
    expect(innerHTML).toBeTruthy();
    expect(innerHTML).toContain('Set A: {1, 2, 3}');
    expect(innerHTML).toContain('Set B: {3, 4, 5}');
    // The union should be {1, 2, 3, 4, 5} exactly as the implementation joins the Set
    expect(innerHTML).toContain('Union A ∪ B: {1, 2, 3, 4, 5}');

    // Verify the display style has been set to 'block'
    const displayAfter = await setsPage.getResultDisplayStyle();
    expect(displayAfter === 'block' || displayAfter === 'inline-block' || displayAfter === 'inline').toBeTruthy();

    // Ensure there were no uncaught page errors triggered by the click
    expect(pageErrors.length).toBe(0);

    // Ensure no console.error logs occurred during the interaction
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
  });

  test('Edge case: multiple clicks do not duplicate union contents (idempotency check)', async ({ page }) => {
    // Validate that clicking the button multiple times produces stable output (no duplication appending)
    const setsPage = new SetsPage(page);

    // Click once and capture the result
    await setsPage.clickDemonstrateUnion();
    await expect(setsPage.result).toBeVisible();
    const firstInner = (await setsPage.getResultInnerHTML()) || '';

    // Click again
    await setsPage.clickDemonstrateUnion();
    // Wait briefly to allow DOM update if any
    await page.waitForTimeout(100);
    const secondInner = (await setsPage.getResultInnerHTML()) || '';

    // The content should remain the same (implementation replaces innerHTML, not appends)
    expect(secondInner.trim()).toBe(firstInner.trim());

    // Confirm the union text remains correct and not duplicated
    expect(secondInner).toContain('Union A ∪ B: {1, 2, 3, 4, 5}');

    // No uncaught errors from multiple interactions
    expect(pageErrors.length).toBe(0);
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
  });

  test('Error scenario: invoking missing entry action renderPage should produce a ReferenceError when called asynchronously', async ({ page }) => {
    // The FSM's entry action for Idle mentions renderPage(), but the implementation does not define it.
    // This test deliberately triggers an asynchronous call to renderPage() so that the page itself
    // will raise an uncaught ReferenceError which can be observed via the pageerror event.
    //
    // Note: We execute the call asynchronously (via setTimeout) so the error is thrown in page context
    // and not swallowed by evaluate(), which allows Playwright to capture it as a pageerror.

    // Prepare to wait for a pageerror event
    const waitForErrorPromise = page.waitForEvent('pageerror', { timeout: 3000 });

    // Schedule an asynchronous call to a non-existent function to simulate the missing entry action
    await page.evaluate(() => {
      // This will throw in the page's event loop, triggering a pageerror if renderPage is not defined.
      setTimeout(() => {
        // Intentionally call a function that does not exist on the page.
        // This should create a ReferenceError: renderPage is not defined
        // Allow this to be uncaught to appear in pageerror.
        // eslint-disable-next-line no-undef
        renderPage();
      }, 0);
    });

    // Await the pageerror event emitted by the page due to the missing function
    const pageError = await waitForErrorPromise;

    // Assert that the captured error mentions the missing function name (renderPage)
    // Different browsers may format error messages slightly differently, so assert that the message includes 'renderPage'
    expect(pageError).toBeTruthy();
    expect(String(pageError.message)).toMatch(/renderPage/);

    // Also ensure our pageErrors collector picked up the error via the 'pageerror' listener
    // (the listener stores reference to Error objects)
    // Allow for at least one recorded error
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const found = pageErrors.some(e => String(e.message).includes('renderPage'));
    expect(found).toBeTruthy();
  });

  test('Diagnostic: observe console and page error streams during normal usage (no unexpected errors)', async ({ page }) => {
    // This test demonstrates capturing console and page errors while performing the main user flow.
    // It is a summary check ensuring that normal usage does not emit uncaught errors.

    const setsPage = new SetsPage(page);

    // Perform the main flow (click to show union)
    await setsPage.clickDemonstrateUnion();
    await expect(setsPage.result).toBeVisible();

    // Ensure we have observed console messages but no console.error
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // Ensure there were no uncaught page errors during this scenario
    expect(pageErrors.length).toBe(0);
  });
});