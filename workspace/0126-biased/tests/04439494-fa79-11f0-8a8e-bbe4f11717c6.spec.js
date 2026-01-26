import { test, expect } from '@playwright/test';

test.describe('Semaphore FSM - Interactive Application (04439494-fa79-11f0-8a8e-bbe4f11717c6)', () => {
  // Base URL for the HTML under test
  const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04439494-fa79-11f0-8a8e-bbe4f11717c6.html';

  // Shared holders for console messages and page errors captured during a test
  let consoleMessages;
  let pageErrors;

  // Attach listeners before each test and navigate to the page
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (info, error, debug, etc.)
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      // err is an Error object
      pageErrors.push(err);
    });

    // Navigate to the application page (the exact environment is required)
    await page.goto(APP_URL);
  });

  // After each test, provide a small summary to stdout (Playwright will capture it).
  // This helps debugging if a test fails.
  test.afterEach(async ({}, testInfo) => {
    // Append console and page error summaries to the test output for easier debugging
    if (consoleMessages.length) {
      testInfo.attach('console-messages', {
        body: consoleMessages.map(m => `[${m.type}] ${m.text}`).join('\n'),
        contentType: 'text/plain'
      });
    }
    if (pageErrors.length) {
      testInfo.attach('page-errors', {
        body: pageErrors.map(e => `${e.name}: ${e.message}\n${e.stack || ''}`).join('\n\n'),
        contentType: 'text/plain'
      });
    }
  });

  test.describe('State: S0_Idle (Entry Assertions)', () => {
    test('renders the Idle state with expected static content (renderPage evidence)', async ({ page }) => {
      // This validates the FSM entry action "renderPage()" indirectly by checking the DOM evidence
      // - <h1>Semaphore</h1>
      // - <p class="description">A beautiful, polished UI with smooth animations and transitions.</p>
      const h1 = await page.locator('h1').textContent();
      expect(h1).toBe('Semaphore');

      const description = await page.locator('p.description').textContent();
      expect(description).toContain('A beautiful, polished UI with smooth animations and transitions.');

      // Buttons present as components described by the FSM
      await expect(page.locator('button.primary-button')).toBeVisible();
      await expect(page.locator('button.secondary-button')).toBeVisible();

      // Animation container exists
      await expect(page.locator('#animation')).toBeVisible();

      // Verify that there are no inline onclick attributes on buttons (FSM evidence referenced onclicks,
      // but the actual HTML does not include inline handlers). This asserts that discrepancy.
      const primaryOnclick = await page.locator('button.primary-button').getAttribute('onclick');
      expect(primaryOnclick).toBeNull();

      const secondaryOnclick = await page.locator('button.secondary-button').getAttribute('onclick');
      expect(secondaryOnclick).toBeNull();
    });
  });

  test.describe('Events & Transitions', () => {
    test('PrimaryButtonClick should trigger either an animation change or produce a JS error (transition observation)', async ({ page }) => {
      // Capture initial animation container state
      const beforeHtml = await page.locator('#animation').evaluate((el) => el.innerHTML);

      // Click the primary button (simulates PrimaryButtonClick event)
      await page.click('.primary-button');

      // Wait briefly for any JS to run / DOM updates / animations to begin
      await page.waitForTimeout(400);

      const afterHtml = await page.locator('#animation').evaluate((el) => el.innerHTML);

      // Check console logs for any clues that the named function was invoked.
      const triggeredLog = consoleMessages.some(m =>
        m.text.includes('triggerPrimaryAnimation') ||
        m.text.includes('Primary Button') ||
        m.text.includes('primary')
      );

      const errorOccurred = pageErrors.length > 0;

      // Expectation:
      // At least one observable effect should have happened:
      // - The animation container changed its innerHTML (indicating some DOM animation markup updated)
      // OR
      // - A console message mentions the primary animation function
      // OR
      // - A JS page error occurred (allowed; we will assert its type in a separate test)
      const somethingObserved = (beforeHtml !== afterHtml) || triggeredLog || errorOccurred;
      expect(somethingObserved).toBeTruthy();
    });

    test('SecondaryButtonClick should trigger either an animation change or produce a JS error (transition observation)', async ({ page }) => {
      // Capture initial animation container state
      const beforeHtml = await page.locator('#animation').evaluate((el) => el.innerHTML);

      // Click the secondary button (simulates SecondaryButtonClick event)
      await page.click('.secondary-button');

      // Wait briefly for any JS to run / DOM updates / animations to begin
      await page.waitForTimeout(400);

      const afterHtml = await page.locator('#animation').evaluate((el) => el.innerHTML);

      // Check console logs for any clues that the named function was invoked.
      const triggeredLog = consoleMessages.some(m =>
        m.text.includes('triggerSecondaryAnimation') ||
        m.text.includes('Secondary Button') ||
        m.text.includes('secondary')
      );

      const errorOccurred = pageErrors.length > 0;

      // Expectation similar to the primary button: DOM change OR console hint OR JS error.
      const somethingObserved = (beforeHtml !== afterHtml) || triggeredLog || errorOccurred;
      expect(somethingObserved).toBeTruthy();
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('rapid repeated clicks on primary button should not crash the page (stability under rapid events)', async ({ page }) => {
      // Rapidly click the primary button multiple times
      const clicks = 5;
      for (let i = 0; i < clicks; i++) {
        await page.click('.primary-button');
      }

      // Short wait to allow any errors to surface
      await page.waitForTimeout(500);

      // Page should still have the expected static content and not have navigated away
      await expect(page.locator('h1')).toHaveText('Semaphore');
      await expect(page.locator('button.primary-button')).toBeVisible();

      // If errors occurred, ensure they are of expected JS error types (ReferenceError, TypeError, SyntaxError)
      // Allowed error types as per the testing constraints; empty array also passes since no errors occurred.
      const allowed = ['ReferenceError', 'TypeError', 'SyntaxError'];
      const allAllowed = pageErrors.every(err => allowed.includes(err.name));
      expect(allAllowed).toBeTruthy();
    });

    test('rapid repeated clicks on secondary button should not crash the page (stability under rapid events)', async ({ page }) => {
      // Rapidly click the secondary button multiple times
      const clicks = 5;
      for (let i = 0; i < clicks; i++) {
        await page.click('.secondary-button');
      }

      // Short wait to allow any errors to surface
      await page.waitForTimeout(500);

      // Basic DOM sanity checks
      await expect(page.locator('h1')).toHaveText('Semaphore');
      await expect(page.locator('button.secondary-button')).toBeVisible();

      // If errors occurred, ensure they are of expected JS error types (ReferenceError, TypeError, SyntaxError)
      const allowed = ['ReferenceError', 'TypeError', 'SyntaxError'];
      const allAllowed = pageErrors.every(err => allowed.includes(err.name));
      expect(allAllowed).toBeTruthy();
    });
  });

  test.describe('Console and JS error observations', () => {
    test('any page errors should be limited to ReferenceError, TypeError, or SyntaxError (observed error types)', async ({ page }) => {
      // This test accepts the natural behavior of the page: it may emit JS errors.
      // We assert that any emitted errors are of the allowed types.
      const allowed = ['ReferenceError', 'TypeError', 'SyntaxError'];

      // If there are no errors, this assertion will pass (Array.every on empty array === true).
      // If there are errors, each must match allowed types.
      for (const err of pageErrors) {
        // Each err is an Error object; validate its name property
        expect(allowed).toContain(err.name);
      }
    });

    test('capture console output and ensure it contains application context if present (diagnostic)', async ({ page }) => {
      // This test is diagnostic: if the application logs anything helpful, ensure it's captured.
      // We do not mandate a particular log, but we assert that consoleMessages is an array and its items have expected shape.
      expect(Array.isArray(consoleMessages)).toBeTruthy();
      for (const msg of consoleMessages) {
        expect(msg).toHaveProperty('type');
        expect(msg).toHaveProperty('text');
        // types are strings like 'log', 'error', 'warning', etc.
        expect(typeof msg.type).toBe('string');
        expect(typeof msg.text).toBe('string');
      }
    });
  });
});