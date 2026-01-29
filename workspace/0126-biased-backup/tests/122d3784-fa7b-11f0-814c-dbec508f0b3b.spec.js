import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122d3784-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object for the HTTPS Demo app
class HttpsDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.server = page.locator('#server');
    this.port = page.locator('#port');
    this.protocol = page.locator('#protocol');
    this.submit = page.locator('#submit');
    this.error = page.locator('#error');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillForm({ server, port, protocol }) {
    if (server !== undefined) {
      await this.server.fill(server);
    }
    if (port !== undefined) {
      await this.port.fill(port);
    }
    if (protocol !== undefined) {
      await this.protocol.fill(protocol);
    }
  }

  async clickSubmit() {
    await this.submit.click();
  }

  async getErrorText() {
    return this.error.textContent();
  }
}

test.describe('HTTPS Demo - FSM states and transitions (Application ID: 122d3784-fa7b-11f0-814c-dbec508f0b3b)', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // capture console messages and page errors for assertions
    pageErrors = [];
    consoleMessages = [];

    page.on('console', (msg) => {
      // store console text for inspection
      try {
        consoleMessages.push(msg.text());
      } catch (e) {
        consoleMessages.push(String(msg));
      }
    });

    page.on('pageerror', (err) => {
      // capture runtime errors (ReferenceError, SyntaxError, TypeError, etc.)
      pageErrors.push(err.message);
    });
  });

  test.afterEach(async () => {
    // after each test ensure that no unexpected runtime errors leaked
    // (We allow tests to assert pageErrors explicitly where relevant.)
  });

  test('Idle state - page renders with default inputs and Submit button', async ({ page }) => {
    // Validate initial Idle state (S0_Idle): form rendered, default values present
    const app = new HttpsDemoPage(page);
    await app.goto();

    // Verify inputs and button exist and have expected default values
    await expect(app.server).toHaveValue('example.com');
    await expect(app.port).toHaveValue('443');
    await expect(app.protocol).toHaveValue('https');
    await expect(app.submit).toBeVisible();
    await expect(app.error).toBeVisible();

    // No runtime errors should have occurred just by rendering the page
    expect(pageErrors).toEqual([]);
  });

  test('Submit with empty fields -> validation error (Please fill in all fields) [S0_Idle -> S1_Error]', async ({ page }) => {
    // This test validates the transition from Idle to Error when required fields are empty.
    const app = new HttpsDemoPage(page);
    await app.goto();

    // Clear all fields to simulate empty submission
    await app.fillForm({ server: '', port: '', protocol: '' });

    // Click submit and assert validation error is shown
    await app.clickSubmit();

    await expect(app.error).toHaveText('Please fill in all fields');

    // Ensure no unexpected runtime exceptions occurred
    expect(pageErrors).toEqual([]);

    // No 'Success!' console messages should be present
    expect(consoleMessages.some(m => m.includes('Success!'))).toBe(false);
  });

  test('Submit with server unreachable -> shows "Failed to connect to server" (network failure) [S0_Idle -> S1_Error]', async ({ page }) => {
    // This test validates the transition to Error state when network/catch occurs.
    const app = new HttpsDemoPage(page);

    // Intercept the outgoing fetch to simulate network failure (abort)
    // The page will call fetch(...) to a dynamic URL ending with '/example'
    await page.route('**/*/example', async (route) => {
      // Simulate a network failure so that .catch(...) path executes
      await route.abort();
    });

    await app.goto();

    // Ensure fields have valid values so validation doesn't trigger
    await app.fillForm({ server: 'example.com', port: '443', protocol: 'https' });

    // Click submit to trigger the fetch which we will abort
    await app.clickSubmit();

    // After abort, the page's .catch handler should set the error text
    await expect(app.error).toHaveText('Failed to connect to server');

    // The console should have an 'Error:' log because the catch logs it
    const hasErrorLog = consoleMessages.some(msg => msg.startsWith('Error:') || msg.includes('Failed to fetch') || msg.includes('ERR_ABORTED'));
    expect(hasErrorLog).toBe(true);

    // No unexpected runtime exceptions (like ReferenceError) should be present
    expect(pageErrors).toEqual([]);

    // Clean up route interceptors for isolation (unroute all)
    await page.unroute('**/*/example');
  });

  test('Submit with successful fetch -> console logs "Success!" and error cleared [S0_Idle -> S2_Success]', async ({ page }) => {
    // This test simulates a successful network response and asserts Success state observables.
    const app = new HttpsDemoPage(page);

    // Intercept fetch to respond with a successful (ok) response
    await page.route('**/*/example', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true })
      });
    });

    await app.goto();

    // Ensure valid inputs so validation passes
    await app.fillForm({ server: 'example.com', port: '443', protocol: 'https' });

    // Click submit to trigger fetch which we fulfill with status 200
    await app.clickSubmit();

    // The code sets errorElement.textContent = '' on success; assert that
    await expect(app.error).toHaveText('');

    // Assert that the console contains the success message
    const foundSuccessLog = consoleMessages.some(msg => msg.includes('Success!'));
    expect(foundSuccessLog).toBe(true);

    // Ensure no runtime page errors occurred
    expect(pageErrors).toEqual([]);

    // Clean up the route
    await page.unroute('**/*/example');
  });

  test('From Error state, submitting valid inputs transitions back to Idle or Success [S1_Error -> S0_Idle (then S2_Success)]', async ({ page }) => {
    // This test first enters the Error state by submitting empty fields,
    // then fills valid data and simulates a successful fetch to demonstrate returning to Idle/Succes flow.
    const app = new HttpsDemoPage(page);

    // We'll intercept the subsequent fetch to return a success response
    await page.route('**/*/example', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'OK'
      });
    });

    await app.goto();

    // 1) Trigger Error state via validation
    await app.fillForm({ server: '', port: '', protocol: '' });
    await app.clickSubmit();
    await expect(app.error).toHaveText('Please fill in all fields');

    // 2) Now fill valid data and click submit again to go back to Idle and then Success
    await app.fillForm({ server: 'example.com', port: '443', protocol: 'https' });
    await app.clickSubmit();

    // After successful fetch, error text should be cleared
    await expect(app.error).toHaveText('');

    // Console should contain 'Success!' from the success path
    const successLogged = consoleMessages.some(m => m.includes('Success!'));
    expect(successLogged).toBe(true);

    // Ensure no runtime page errors occurred
    expect(pageErrors).toEqual([]);

    // Clean up route
    await page.unroute('**/*/example');
  });

  test('Edge case: Partial empty fields (server missing) -> validation error', async ({ page }) => {
    // Validate that leaving any required field empty triggers the validation message
    const app = new HttpsDemoPage(page);
    await app.goto();

    // Leave server empty but keep others valid
    await app.fillForm({ server: '', port: '443', protocol: 'https' });
    await app.clickSubmit();

    await expect(app.error).toHaveText('Please fill in all fields');
    expect(pageErrors).toEqual([]);
  });

  test('Observe console and page errors over multiple interactions (robustness check)', async ({ page }) => {
    // This test performs several interactions and then asserts that no unexpected runtime errors occurred.
    const app = new HttpsDemoPage(page);

    // Intercept network so we can deterministically produce success and failure responses
    await page.route('**/*/example', async (route, request) => {
      const url = request.url();
      if (url.includes('success.example')) {
        await route.fulfill({ status: 200, contentType: 'text/plain', body: 'OK' });
      } else {
        await route.abort();
      }
    });

    await app.goto();

    // 1) Trigger abort (simulate failure)
    await app.fillForm({ server: 'will-fail.example', port: '443', protocol: 'https' });
    await app.clickSubmit();
    await expect(app.error).toHaveText('Failed to connect to server');

    // 2) Trigger success by using the special host that our route recognizes
    await app.fillForm({ server: 'success.example', port: '443', protocol: 'https' });
    await app.clickSubmit();
    await expect(app.error).toHaveText('');

    // Ensure console contains both failure and success related messages
    const hasSuccess = consoleMessages.some(m => m.includes('Success!'));
    const hasErrorLog = consoleMessages.some(m => m.startsWith('Error:') || m.includes('Failed to fetch') || m.includes('ERR_ABORTED'));
    expect(hasSuccess).toBe(true);
    expect(hasErrorLog).toBe(true);

    // No runtime page errors
    expect(pageErrors).toEqual([]);

    // Clean up route
    await page.unroute('**/*/example');
  });
});