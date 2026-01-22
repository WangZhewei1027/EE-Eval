import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/718babc0-d362-11f0-85a0-d3271c47ca09.html';

test.describe('Knapsack Problem FSM - interactive application (Application ID: 718babc0-d362-11f0-85a0-d3271c47ca09)', () => {
  // Shared arrays to collect page diagnostics for assertions
  let consoleMessages;
  let pageErrors;
  let requestFailures;

  // Attach listeners and navigate to the page before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    requestFailures = [];

    // Collect console messages (info, warn, error, etc.)
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // ignore any unexpected console handling errors
      }
    });

    // Collect uncaught exceptions (pageerror)
    page.on('pageerror', (err) => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Collect failed requests (e.g., 404s for PHP resources)
    page.on('requestfailed', (req) => {
      const failure = req.failure();
      requestFailures.push({
        url: req.url(),
        method: req.method(),
        errorText: failure && failure.errorText ? failure.errorText : null,
      });
    });

    // Navigate to the app (load as-is, let errors happen naturally)
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.describe('S0_Idle (Initial) state validations', () => {
    test('renders the main headings and descriptive paragraph (Idle state evidence)', async ({ page }) => {
      // Validate presence of the <h2> with the expected text
      const h2 = await page.locator('h2');
      await expect(h2).toHaveText('Knapsack Problem');

      // Validate presence of paragraph and that it contains a known substring from FSM evidence
      const p = await page.locator('p');
      await expect(p).toContainText('A knapsack has four items');

      // Validate form components: numeric input and submit button
      const input = await page.locator("input[type='number']#weight");
      await expect(input).toHaveAttribute('name', 'weight');

      const submitBtn = await page.locator("button[type='submit']");
      await expect(submitBtn).toHaveText('Insert');
    });

    test('observes console and network errors on page load related to the PHP script tag', async ({ page }) => {
      // We expect at least one error/failed request due to the <script src="insert_knapsack.php"></script>
      // This is an assertion that the environment exhibits the runtime/network behavior as-is.
      const combinedSignals = [
        ...consoleMessages.map(m => String(m.text)),
        ...pageErrors,
        ...requestFailures.map(r => `${r.method} ${r.url} ${String(r.errorText)}`)
      ];

      // At least one entry should mention insert_knapsack.php or contain a script loading or syntax error
      const hasInsertPhpSignal = combinedSignals.some(s =>
        s.includes('insert_knapsack.php') ||
        s.includes('Failed to load') ||
        s.includes('404') ||
        s.includes('Unexpected token') ||
        s.includes('SyntaxError') ||
        s.includes('ReferenceError')
      );

      expect(hasInsertPhpSignal).toBeTruthy();
    });

    test('verifies that the FSM entry action "renderPage()" is not invoked implicitly (no evidence in console)', async ({ page }) => {
      // The FSM mentions renderPage() as an entry action. The implementation does not define or call it.
      // Verify that no console messages contain "renderPage" or an explicit ReferenceError for it.
      const hasRenderPageMention = consoleMessages.some(m => String(m.text).includes('renderPage')) ||
        pageErrors.some(e => String(e).includes('renderPage')) ||
        consoleMessages.some(m => String(m.text).includes('ReferenceError'));

      // Expectation: there should be no explicit evidence that renderPage() ran.
      expect(hasRenderPageMention).toBeFalsy();
    });
  });

  test.describe('Transitions and events (InsertWeight event -> S1_WeightInserted)', () => {
    test('submitting the form with a valid weight triggers a POST request to insert_knapsack.php (transition)', async ({ page }) => {
      // Fill in a valid weight to simulate normal user interaction
      const input = page.locator("input[type='number']#weight");
      await input.fill('10');

      // Wait for a request to the php action to be issued when submitting the form
      const requestPromise = page.waitForRequest(req => req.url().includes('insert_knapsack.php'), { timeout: 5000 });

      // Submit the form by clicking the Insert button
      await Promise.all([
        page.locator("button[type='submit']").click(),
        // Do not await navigation specifically—form posts may result in a failed load or 404, which is acceptable
      ]);

      // Await the request that should be triggered by the form submit
      const req = await requestPromise;
      expect(req).toBeTruthy();
      // The form method is POST according to the HTML
      expect(req.method()).toBe('POST');

      // If available, assert the POST data contains the submitted weight value
      const postData = req.postData();
      if (postData !== null) {
        // postData may be urlencoded form data like "weight=10" depending on the server/environment
        expect(String(postData)).toContain('weight');
      }
    });

    test('submitting the form with an empty weight still triggers a POST request (edge case)', async ({ page }) => {
      // Ensure the input is empty
      const input = page.locator("input[type='number']#weight");
      await input.fill('');

      const requestPromise = page.waitForRequest(req => req.url().includes('insert_knapsack.php'), { timeout: 5000 });

      // Click Insert to submit the (empty) form
      await page.locator("button[type='submit']").click();

      const req = await requestPromise;
      expect(req).toBeTruthy();
      expect(req.method()).toBe('POST');

      // The POST body might be empty or include an empty weight. We only assert that a request was made.
      const postData = req.postData();
      // Accept both null and string, but assert type is either null or string to ensure shape
      expect([null, 'string'].includes(typeof postData) || postData === null).toBeTruthy();
    });

    test('submitting negative or unexpected weight values is still sent to the server (error scenario)', async ({ page }) => {
      // Input a negative value (edge case)
      const input = page.locator("input[type='number']#weight");
      await input.fill('-5');

      const requestPromise = page.waitForRequest(req => req.url().includes('insert_knapsack.php'), { timeout: 5000 });

      await page.locator("button[type='submit']").click();

      const req = await requestPromise;
      expect(req).toBeTruthy();
      expect(req.method()).toBe('POST');

      const postData = req.postData();
      if (postData !== null) {
        // Negative value should be present in the submitted form data if encoded
        expect(String(postData)).toContain('-5');
      }
    });

    test('after submission there is observable evidence (navigation or error) consistent with the FSM final state S1_WeightInserted', async ({ page }) => {
      // This test validates that performing the InsertWeight event leads to an observable result:
      // either navigation to insert_knapsack.php or a network/script error that stems from attempting to reach that resource.

      // Fill the input so submission is normal
      await page.locator("input[type='number']#weight").fill('7');

      // Prepare to capture navigation or a request to the target.
      const requestPromise = page.waitForRequest(req => req.url().includes('insert_knapsack.php'), { timeout: 5000 });

      // Click submit
      await page.locator("button[type='submit']").click();

      // Await the request; if navigation occurs, page.url() may change. We accept either outcome as evidence of the transition.
      const req = await requestPromise;
      expect(req).toBeTruthy();

      // Now assert one of two observable outcomes is true:
      // 1) The page URL contains insert_knapsack.php (navigation occurred), OR
      // 2) There is a console/network error referencing the PHP resource (expected in this environment)
      const navigatedToPhp = page.url().includes('insert_knapsack.php');
      const hasPhpErrorSignal = [
        ...consoleMessages.map(m => String(m.text)),
        ...pageErrors,
        ...requestFailures.map(r => `${r.method} ${r.url} ${String(r.errorText)}`)
      ].some(s =>
        s.includes('insert_knapsack.php') ||
        s.includes('Unexpected token') ||
        s.includes('SyntaxError') ||
        s.includes('Failed to load') ||
        s.includes('404')
      );

      expect(navigatedToPhp || hasPhpErrorSignal).toBeTruthy();
    });
  });

  test.describe('Diagnostics and environment checks', () => {
    test('collect and assert there is at least one network failure related to the PHP script tag', async ({ page }) => {
      // It's possible the PHP resource isn't present; ensure that at least one request failure or console error points to that.
      const phpRelatedFailure = requestFailures.some(r => r.url.includes('insert_knapsack.php')) ||
        consoleMessages.some(m => String(m.text).includes('insert_knapsack.php')) ||
        pageErrors.some(e => String(e).includes('insert_knapsack.php'));

      expect(phpRelatedFailure).toBeTruthy();
    });

    test('page diagnostics: ensure we captured console messages and page errors arrays exist (sanity)', async () => {
      // Basic sanity assertions on our collected diagnostics arrays
      expect(Array.isArray(consoleMessages)).toBeTruthy();
      expect(Array.isArray(pageErrors)).toBeTruthy();
      expect(Array.isArray(requestFailures)).toBeTruthy();
    });
  });

  test.afterEach(async ({ page }) => {
    // Optional: ensure no unhandled promise rejections in Playwright test runner
    // We deliberately do NOT attempt to modify the page or its runtime; we just close.
    await page.close();
  });
});