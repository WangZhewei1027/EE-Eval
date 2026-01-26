import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8f7762-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object Model for the app
class RestApiPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.fetchButton = page.locator('#fetchButton');
    this.apiDataDiv = page.locator('#apiData');
    this.apiContent = page.locator('#apiContent');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Click the fetch button once
  async clickFetch() {
    await this.fetchButton.click();
  }

  // Click the fetch button multiple times
  async clickFetchTimes(n) {
    for (let i = 0; i < n; i++) {
      await this.fetchButton.click();
    }
  }

  // Wait until apiContent text matches expected
  async waitForApiContentText(expected, timeout = 5000) {
    await this.page.waitForFunction(
      (selector, expectedText) => {
        const el = document.querySelector(selector);
        return el && el.textContent === expectedText;
      },
      '#apiContent',
      expected,
      { timeout }
    );
  }

  // Returns whether apiDataDiv has the fadeIn class
  async hasFadeInClass() {
    return await this.apiDataDiv.evaluate((el) => el.classList.contains('fadeIn'));
  }

  // Returns the computed opacity of the apiDataDiv (string)
  async apiDataOpacity() {
    return await this.apiDataDiv.evaluate((el) => getComputedStyle(el).opacity);
  }

  // Read apiContent text
  async getApiContentText() {
    return await this.apiContent.textContent();
  }
}

test.describe('REST API Visual Experience - FSM Validation', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset captured logs and errors before each test
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // No-op teardown; listeners attached to page will be cleaned up by Playwright
    // We intentionally do not modify page JS or global environment per instructions
  });

  test('Initial state (S0_Idle): page renders and initial DOM is correct', async ({ page }) => {
    // This test validates the initial/idle state (S0_Idle) as described in the FSM.
    // Verifies: renderPage() implicit behavior: button exists and initial paragraph text.

    const app = new RestApiPage(page);

    // Ensure the main components are present
    await expect(app.fetchButton).toBeVisible();
    await expect(app.fetchButton).toHaveText('Fetch Data');

    await expect(app.apiContent).toBeVisible();
    await expect(app.apiContent).toHaveText('API data will appear here...');

    // The apiData container should be present but not have fadeIn class and be transparent (opacity 0)
    const hasClass = await app.hasFadeInClass();
    expect(hasClass).toBe(false);

    const opacity = await app.apiDataOpacity();
    // Default opacity defined in CSS for .api-data is 0
    expect(opacity === '0' || opacity === '0.0').toBe(true);

    // Assert that no page errors happened during initial render
    expect(pageErrors.length).toBe(0);

    // Assert that console has no error-level messages
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_Fetching on FetchData_Click: immediate feedback is shown', async ({ page }) => {
    // This test validates the transition to Fetching Data (S1_Fetching).
    // Verifies: clicking the Fetch Data button updates apiContent to "Fetching data from the API..."

    const app = new RestApiPage(page);

    // Click the fetch button and immediately assert the fetching message appears
    await app.clickFetch();

    // The FSM entry action for S1 sets apiContent.textContent = 'Fetching data from the API...'
    await app.page.waitForFunction(
      () => document.getElementById('apiContent').textContent === 'Fetching data from the API...',
      { timeout: 1000 }
    );

    const content = await app.getApiContentText();
    expect(content).toBe('Fetching data from the API...');

    // While fetching, fadeIn class should NOT yet be applied
    expect(await app.hasFadeInClass()).toBe(false);

    // No uncaught page errors during this interaction
    expect(pageErrors.length).toBe(0);

    // Check console for error-level messages
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S1_Fetching -> S2_DataRetrieved: data displayed and fadeIn class applied after delay', async ({ page }) => {
    // This test validates the asynchronous transition from Fetching to Data Retrieved.
    // Verifies: after ~2s the content is replaced with the retrieved data and fadeIn class is added.

    const app = new RestApiPage(page);

    // Trigger the fetch
    await app.clickFetch();

    // Wait for the final data text; the code uses setTimeout(..., 2000)
    const expectedFinalText = 'Data retrieved: {"message": "Hello, World!", "status": "success"}';
    await app.waitForApiContentText(expectedFinalText, 5000);

    // Verify the final content
    const finalContent = await app.getApiContentText();
    expect(finalContent).toBe(expectedFinalText);

    // Verify the fadeIn class was added to apiDataDiv
    expect(await app.hasFadeInClass()).toBe(true);

    // The opacity should now be 1 due to .fadeIn
    const opacity = await app.apiDataOpacity();
    // Because computed styles could produce '1' or '1.0', account for both
    expect(opacity === '1' || opacity === '1.0').toBe(true);

    // No uncaught page errors should have been thrown during the asynchronous flow
    expect(pageErrors.length).toBe(0);

    // No console.error messages should appear
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: multiple rapid clicks should still result in Data Retrieved state and no unhandled errors', async ({ page }) => {
    // This test exercises clicking the Fetch Data button multiple times rapidly.
    // The implementation does not debounce, so multiple timeouts may be scheduled.
    // We verify the final state is still Data Retrieved and ensure no uncaught errors occur.

    const app = new RestApiPage(page);

    // Click 3 times rapidly
    await app.clickFetchTimes(3);

    // The last click will schedule a timeout of ~2s; wait a bit longer to be robust
    const expectedFinalText = 'Data retrieved: {"message": "Hello, World!", "status": "success"}';
    await app.waitForApiContentText(expectedFinalText, 6000);

    const finalContent = await app.getApiContentText();
    expect(finalContent).toBe(expectedFinalText);

    // Ensure fadeIn class present
    expect(await app.hasFadeInClass()).toBe(true);

    // No uncaught runtime errors as a result of multiple clicks
    expect(pageErrors.length).toBe(0);

    // No console.error messages
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Idempotence after Data Retrieved: clicking again keeps final data and does not throw errors', async ({ page }) => {
    // After the app reaches Data Retrieved state, clicking the button again should
    // re-trigger behavior but the final visible state should still be the retrieved data.
    // This test ensures no unexpected errors occur when interacting after final state.

    const app = new RestApiPage(page);

    // Reach final state first
    await app.clickFetch();
    const expectedFinalText = 'Data retrieved: {"message": "Hello, World!", "status": "success"}';
    await app.waitForApiContentText(expectedFinalText, 5000);

    // Click again after final state
    await app.clickFetch();

    // Wait again for the final state to settle (in case additional timeout resets content briefly)
    await app.waitForApiContentText(expectedFinalText, 5000);

    // Validate final text and fadeIn class still present
    expect(await app.getApiContentText()).toBe(expectedFinalText);
    expect(await app.hasFadeInClass()).toBe(true);

    // Ensure no uncaught page errors
    expect(pageErrors.length).toBe(0);

    // Ensure console contains no error-level messages
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Observability: capture console output and page errors across lifecycle', async ({ page }) => {
    // This test explicitly inspects captured console messages and page errors and asserts no fatal JS errors.
    // It also demonstrates observation of console messages (if any) produced by the app.

    const app = new RestApiPage(page);

    // Trigger interactions to potentially generate console output
    await app.clickFetch();
    await app.waitForApiContentText('Data retrieved: {"message": "Hello, World!", "status": "success"}', 5000);

    // Inspect collected page errors (should be zero)
    expect(pageErrors.length).toBe(0);

    // Make sure none of the pageErrors are ReferenceError, SyntaxError, or TypeError
    const problematicErrors = pageErrors.filter((err) => {
      const msg = String(err && err.message ? err.message : err);
      return /ReferenceError|SyntaxError|TypeError/.test(msg);
    });
    expect(problematicErrors.length).toBe(0);

    // Inspect console messages for anything of severity 'error'
    const consoleErrorMessages = consoleMessages.filter((m) => m.type === 'error');
    // We expect zero error-level console messages; if any appear, the test should fail
    expect(consoleErrorMessages.length).toBe(0);

    // Optionally ensure there is at least some console activity (not required)
    // But we won't assert there must be logs; only assert absence of errors.
  });
});