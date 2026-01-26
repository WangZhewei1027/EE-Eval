import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520acd92-fa76-11f0-a09b-87751f540fd8.html';

// Page Object for the Routing Example app
class RoutingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.routeButton = '#route';
    this.routeContent = '#route-content';
    this._consoleMessages = [];
    this._pageErrors = [];
  }

  // Navigate to the app and attach listeners for console & page errors
  async goto() {
    // attach listeners before navigation to capture any errors during load
    this.page.on('console', (msg) => {
      // capture all console messages with their type and text
      this._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', (err) => {
      // capture uncaught exceptions
      this._pageErrors.push(err);
    });
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Click the route button
  async clickRoute() {
    await this.page.click(this.routeButton);
  }

  // Click the route button n times rapidly
  async clickRouteTimes(n) {
    for (let i = 0; i < n; i++) {
      // don't await between clicks to simulate rapid user clicks
      this.page.click(this.routeButton);
    }
    // give the page a tick to process events
    await this.page.waitForTimeout(50);
  }

  // Get the innerHTML of the route content div
  async getRouteContentInnerHTML() {
    return this.page.$eval(this.routeContent, (el) => el.innerHTML);
  }

  // Get only the textContent of the first h2 inside route content (if present)
  async getH2Text() {
    const h2 = await this.page.$(`${this.routeContent} h2`);
    if (!h2) return null;
    return h2.textContent();
  }

  // Return captured console messages
  getConsoleMessages() {
    return this._consoleMessages;
  }

  // Return captured page errors
  getPageErrors() {
    return this._pageErrors;
  }

  // Utility: compute expected route string that the page's script will construct,
  // using the browser's pathname at test time.
  // Must be executed in the browser context to match runtime behavior precisely.
  async computeExpectedRoute() {
    return this.page.evaluate(() => {
      const url = window.location.pathname;
      const route = `/pages/${url.replace(/\/$/, '')}`;
      return route;
    });
  }

  // Replace the browser pathname using history API (simulate a trailing slash or different path)
  // Note: This does not reload the page. This mimics user changing the path via pushState/replaceState.
  async replacePathname(newPathname) {
    await this.page.evaluate((p) => {
      history.replaceState({}, '', p);
    }, newPathname);
  }
}

test.describe('Routing Example - FSM states and transitions', () => {
  // Each test gets its own isolated page fixture provided by Playwright
  test('Initial state (S0_Idle): button exists and route content is empty', async ({ page }) => {
    // This test validates the initial Idle state: the button should be rendered,
    // and the route content div should be empty (entry action renderPage() from FSM is not present in DOM).
    const app = new RoutingPage(page);
    await app.goto();

    // Verify button exists and is visible
    const btn = await page.$('#route');
    expect(btn).not.toBeNull();
    await expect(page.locator('#route')).toBeVisible();
    // Button should have the expected text from the HTML
    await expect(page.locator('#route')).toHaveText('Click Me!');

    // route-content div should be present and initially empty (no h2 or paragraph)
    const contentInner = await page.$eval('#route-content', (el) => el.innerHTML.trim());
    expect(contentInner).toBe('');

    // Ensure no uncaught page errors happened during load
    const pageErrors = app.getPageErrors();
    expect(pageErrors.length).toBe(0);

    // Ensure there are no console.error messages emitted during load
    const errors = app.getConsoleMessages().filter((m) => m.type === 'error');
    expect(errors.length).toBe(0);
  });

  test('Transition (ButtonClick): clicking the button updates route content (S0_Idle -> S1_Routed)', async ({ page }) => {
    // This test validates the click event transition and entry action on the routed state:
    // clicking the button should populate the route-content div with an h2 showing the computed route,
    // and a paragraph describing the content for that route.
    const app = new RoutingPage(page);
    await app.goto();

    // Compute expected route using the page's runtime (this matches how the app does it)
    const expectedRoute = await app.computeExpectedRoute();

    // Click the route button once
    await app.clickRoute();

    // Wait for the route content to be populated
    await expect(page.locator('#route-content h2')).toBeVisible();

    // Validate the h2 text matches the expected route
    const h2Text = await app.getH2Text();
    expect(h2Text).toBe(expectedRoute);

    // Validate the paragraph mentions the same route (content uses interpolation with route)
    const paragraph = await page.$eval('#route-content p', (el) => el.textContent.trim());
    expect(paragraph).toContain(expectedRoute);

    // Ensure that after the transition there are still no uncaught page errors
    expect(app.getPageErrors().length).toBe(0);

    // Ensure there are no console.error messages during the click transition
    const errors = app.getConsoleMessages().filter((m) => m.type === 'error');
    expect(errors.length).toBe(0);
  });

  test('Edge case: pathname ending with trailing slash is normalized (slashes are trimmed)', async ({ page }) => {
    // This test manipulates the browser pathname using history.replaceState to add a trailing slash,
    // then clicks the route button. The app's replace(/\/$/, '') should remove the trailing slash.
    const app = new RoutingPage(page);
    await app.goto();

    // Replace pathname to add a trailing slash at the end (simulate /...html/)
    // Compute a new pathname based on the existing one
    const currentPathname = await page.evaluate(() => window.location.pathname);
    const pathnameWithSlash = currentPathname.endsWith('/') ? currentPathname : `${currentPathname}/`;
    await app.replacePathname(pathnameWithSlash);

    // Compute expected route after trimming trailing slash (done by the app)
    const expectedRoute = await app.computeExpectedRoute();

    // Click and assert
    await app.clickRoute();
    await expect(page.locator('#route-content h2')).toBeVisible();
    const h2Text = await app.getH2Text();
    expect(h2Text).toBe(expectedRoute);

    // Confirm the paragraph references the same expected route
    const paragraph = await page.$eval('#route-content p', (el) => el.textContent.trim());
    expect(paragraph).toContain(expectedRoute);

    // No uncaught errors
    expect(app.getPageErrors().length).toBe(0);
  });

  test('Robustness: multiple rapid clicks should not produce inconsistent content or errors', async ({ page }) => {
    // This test simulates rapid multiple clicks on the route button to ensure the application
    // can handle quick repeated events and ends up in the expected routed state with consistent content.
    const app = new RoutingPage(page);
    await app.goto();

    // Trigger rapid clicks (5 times)
    await app.clickRouteTimes(5);

    // Wait for eventual DOM update
    await expect(page.locator('#route-content h2')).toBeVisible();

    // Compute expected route and verify final content matches it
    const expectedRoute = await app.computeExpectedRoute();
    const h2Text = await app.getH2Text();
    expect(h2Text).toBe(expectedRoute);

    const paragraph = await page.$eval('#route-content p', (el) => el.textContent.trim());
    expect(paragraph).toContain(expectedRoute);

    // Verify no uncaught page errors occurred during rapid clicking
    expect(app.getPageErrors().length).toBe(0);

    // Verify no console.error messages were emitted
    const consoleErrors = app.getConsoleMessages().filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Observation: record console messages and ensure no unexpected runtime exceptions', async ({ page }) => {
    // This test focuses on capturing console messages and page errors across a normal click flow.
    // It demonstrates observation of runtime diagnostics, as required by the test instructions.
    const app = new RoutingPage(page);
    await app.goto();

    // Perform a normal click
    await app.clickRoute();
    await expect(page.locator('#route-content h2')).toBeVisible();

    // Capture current console messages and page errors
    const consoleMessages = app.getConsoleMessages();
    const pageErrors = app.getPageErrors();

    // There may be informational console logs but assert there are no uncaught exceptions.
    // If any uncaught exceptions exist, fail the test with their details.
    expect(pageErrors.length, `Expected no uncaught page errors, but found: ${pageErrors.map(String).join(', ')}`).toBe(0);

    // Also explicitly assert there are no console messages of type 'error'
    const errorConsoleMsgs = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleMsgs.length, `Expected no console.error messages, but found: ${errorConsoleMsgs.map((m) => m.text).join(' | ')}`).toBe(0);

    // Sanity check: at least one console message may exist (optional), but we don't require it.
  });

  test('Negative scenario: clicking a non-existent selector should be reported as an error by Playwright', async ({ page }) => {
    // This test intentionally tries to click a selector that does not exist to validate
    // that such an error is surfaced by the test runtime (Playwright) and not suppressed by the page.
    // We assert that Playwright throws an error when attempting to click a missing element.
    const app = new RoutingPage(page);
    await app.goto();

    let thrown = false;
    try {
      // Attempt to click a non-existent element - Playwright should throw
      await page.click('#non-existent-button', { timeout: 500 });
    } catch (err) {
      thrown = true;
      // Assert the error message indicates the element was not found or not visible
      expect(String(err.message)).toContain('waiting for selector "#non-existent-button"');
    }
    expect(thrown).toBe(true);
  });
});