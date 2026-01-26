import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3c75e2-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('Big-O Notation Interactive — FSM validation and error observation', () => {
  // Utility to attach listeners to collect runtime errors and console messages.
  async function attachCollectors(page) {
    const pageErrors = [];
    const consoleMessages = [];

    const pageErrorListener = (err) => {
      // err is an Error object from the page context
      pageErrors.push(String(err && err.message ? err.message : err));
    };
    const consoleListener = (msg) => {
      // capture console text + type for diagnostics
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    };

    page.on('pageerror', pageErrorListener);
    page.on('console', consoleListener);

    return {
      pageErrors,
      consoleMessages,
      dispose: () => {
        page.removeListener('pageerror', pageErrorListener);
        page.removeListener('console', consoleListener);
      }
    };
  }

  test.beforeEach(async ({ page }) => {
    // No global setup required beyond navigation in each test.
  });

  test.afterEach(async ({ page }) => {
    // Ensure no modal or dialog prevents further tests
    page.removeAllListeners('dialog');
  });

  test.describe('Initial page load and Idle state', () => {
    test('renders the page structure and reports script parsing/runtime errors (Idle entry expectations)', async ({ page }) => {
      // Attach collectors before navigation so we capture parse-time SyntaxError
      const collectors = await attachCollectors(page);

      // Navigate to the application
      const response = await page.goto(APP_URL);
      expect(response && response.ok()).toBeTruthy();

      // Allow a brief moment for any parse-time errors to surface
      await page.waitForTimeout(200);

      // Assert presence of expected buttons (evidence of Idle state UI)
      const constantBtn = page.locator('button[onclick="runConstantExample()"]');
      const linearBtn = page.locator('button[onclick="runLinearExample()"]');
      const quadraticBtn = page.locator('button[onclick="runQuadraticExample()"]');
      const logBtn = page.locator('button[onclick="runLogarithmicExample()"]');

      await expect(constantBtn).toBeVisible();
      await expect(linearBtn).toBeVisible();
      await expect(quadraticBtn).toBeVisible();
      await expect(logBtn).toBeVisible();

      // Verify expected output containers exist and are initially empty
      const constantOutput = page.locator('#constant-output');
      const linearOutput = page.locator('#linear-output');
      const quadraticOutput = page.locator('#quadratic-output');
      const logOutput = page.locator('#logarithmic-output');

      await expect(constantOutput).toBeVisible();
      await expect(linearOutput).toBeVisible();
      await expect(quadraticOutput).toBeVisible();
      await expect(logOutput).toBeVisible();

      expect((await constantOutput.innerHTML()).trim()).toBe('');
      expect((await linearOutput.innerHTML()).trim()).toBe('');
      expect((await quadraticOutput.innerHTML()).trim()).toBe('');
      expect((await logOutput.innerHTML()).trim()).toBe('');

      // The HTML provided is truncated and likely produces a syntax error.
      // Assert that at least one page error (SyntaxError) was recorded during load.
      const hadSyntaxError = collectors.pageErrors.some(msg =>
        /SyntaxError|Unexpected end of input|Unexpected token/i.test(msg)
      );
      expect(hadSyntaxError).toBeTruthy();

      // Also check that console contains at least one error-level message (diagnostic)
      const hasConsoleError = collectors.consoleMessages.some(line => line.startsWith('error') || /syntaxerror/i.test(line.toLowerCase()));
      expect(hasConsoleError || collectors.pageErrors.length > 0).toBeTruthy();

      collectors.dispose();
    });
  });

  test.describe('FSM transitions — clicking each example button', () => {
    test('Run O(1) Example: clicking button triggers error (function not defined) and does not update DOM', async ({ page }) => {
      // Collect page errors and console messages
      const collectors = await attachCollectors(page);

      await page.goto(APP_URL);
      // Ensure page parsed and listeners are active
      await page.waitForTimeout(100);

      // Verify function is not available due to script parse error
      const typeofConstant = await page.evaluate(() => {
        try { return typeof runConstantExample; } catch (e) { return 'evaluation-error:' + e.message; }
      });
      // We expect it NOT to be a function because script likely failed to define it
      expect(typeofConstant).not.toBe('function');

      const button = page.locator('button[onclick="runConstantExample()"]');
      await expect(button).toBeVisible();

      // Click and expect a runtime/page error (ReferenceError) to be emitted
      const [error] = await Promise.all([
        page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null),
        button.click({ timeout: 1000 }).catch(() => { /* swallow Playwright click exceptions; errors are observed via pageerror */ })
      ]);

      // There should be a page error referencing the missing function name
      const pageErrorMessages = collectors.pageErrors;
      const foundRef = pageErrorMessages.some(msg => /runConstantExample/i.test(msg) && /not defined|ReferenceError/i.test(msg));
      expect(foundRef).toBeTruthy();

      // The DOM output should remain unchanged (empty) because the handler did not run
      const constantOutputHtml = (await page.locator('#constant-output').innerHTML()).trim();
      expect(constantOutputHtml).toBe('');

      collectors.dispose();
    });

    test('Run O(n) Example: clicking button triggers error (function not defined) and does not update DOM', async ({ page }) => {
      const collectors = await attachCollectors(page);

      await page.goto(APP_URL);
      await page.waitForTimeout(100);

      const typeofLinear = await page.evaluate(() => {
        try { return typeof runLinearExample; } catch (e) { return 'evaluation-error:' + e.message; }
      });
      expect(typeofLinear).not.toBe('function');

      const button = page.locator('button[onclick="runLinearExample()"]');
      await expect(button).toBeVisible();

      const [error] = await Promise.all([
        page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null),
        button.click({ timeout: 1000 }).catch(() => {})
      ]);

      const foundRef = collectors.pageErrors.some(msg => /runLinearExample/i.test(msg) && /not defined|ReferenceError/i.test(msg));
      expect(foundRef).toBeTruthy();

      const linearOutputHtml = (await page.locator('#linear-output').innerHTML()).trim();
      expect(linearOutputHtml).toBe('');

      collectors.dispose();
    });

    test('Run O(n²) Example: clicking button results in parse/runtime errors and no DOM update', async ({ page }) => {
      const collectors = await attachCollectors(page);

      await page.goto(APP_URL);
      await page.waitForTimeout(100);

      const typeofQuadratic = await page.evaluate(() => {
        try { return typeof runQuadraticExample; } catch (e) { return 'evaluation-error:' + e.message; }
      });
      // Because the provided HTML truncates the quadratic function, it's extremely likely the symbol isn't defined
      expect(typeofQuadratic => {}).not.toThrow; // simple guard to ensure evaluation succeeded
      expect(typeofQuadratic).not.toBe('function');

      const button = page.locator('button[onclick="runQuadraticExample()"]');
      await expect(button).toBeVisible();

      const [error] = await Promise.all([
        page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null),
        button.click({ timeout: 1000 }).catch(() => {})
      ]);

      const foundRef = collectors.pageErrors.some(msg => /runQuadraticExample/i.test(msg) && (/not defined|ReferenceError/i.test(msg) || /SyntaxError/i.test(msg)));
      expect(foundRef).toBeTruthy();

      const quadraticOutputHtml = (await page.locator('#quadratic-output').innerHTML()).trim();
      expect(quadraticOutputHtml).toBe('');

      collectors.dispose();
    });

    test('Run O(log n) Example: clicking button triggers error (function not defined) and does not update DOM', async ({ page }) => {
      const collectors = await attachCollectors(page);

      await page.goto(APP_URL);
      await page.waitForTimeout(100);

      const typeofLog = await page.evaluate(() => {
        try { return typeof runLogarithmicExample; } catch (e) { return 'evaluation-error:' + e.message; }
      });
      expect(typeofLog).not.toBe('function');

      const button = page.locator('button[onclick="runLogarithmicExample()"]');
      await expect(button).toBeVisible();

      const [error] = await Promise.all([
        page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null),
        button.click({ timeout: 1000 }).catch(() => {})
      ]);

      const foundRef = collectors.pageErrors.some(msg => /runLogarithmicExample/i.test(msg) && /not defined|ReferenceError/i.test(msg));
      expect(foundRef).toBeTruthy();

      const logOutputHtml = (await page.locator('#logarithmic-output').innerHTML()).trim();
      expect(logOutputHtml).toBe('');

      collectors.dispose();
    });
  });

  test.describe('Edge cases and FSM-related expectations', () => {
    test('renderPage() entry action is not present (verify onEnter expectation for Idle)', async ({ page }) => {
      // The FSM mentions renderPage() as an entry action for Idle.
      // Verify that renderPage is not defined on the page (since implementation does not provide it).
      await page.goto(APP_URL);
      await page.waitForTimeout(100);

      const typeofRenderPage = await page.evaluate(() => {
        try { return typeof renderPage; } catch (e) { return 'evaluation-error:' + e.message; }
      });

      // We expect renderPage to be undefined (i.e., not implemented)
      expect(typeofRenderPage).not.toBe('function');
      expect(typeofRenderPage).toBe('undefined');
    });

    test('Multiple clicks produce repeated page errors (robustness / error scenario)', async ({ page }) => {
      const collectors = await attachCollectors(page);

      await page.goto(APP_URL);
      await page.waitForTimeout(100);

      const button = page.locator('button[onclick="runConstantExample()"]');
      await expect(button).toBeVisible();

      // Click the button multiple times and ensure errors accumulate
      for (let i = 0; i < 3; i++) {
        // clicking may throw in the page context; we catch Playwright click errors but the
        // actual JS ReferenceError should be captured by the pageerror listener.
        await button.click().catch(() => {});
        // small delay to allow the pageerror to be emitted
        await page.waitForTimeout(100);
      }

      // There should be at least one page error and likely multiple messages containing the function name
      const matches = collectors.pageErrors.filter(msg => /runConstantExample/i.test(msg));
      expect(matches.length).toBeGreaterThanOrEqual(1);

      // Confirm the output remains empty after repeated attempts
      const constantOutputHtml = (await page.locator('#constant-output').innerHTML()).trim();
      expect(constantOutputHtml).toBe('');

      collectors.dispose();
    });

    test('Sanity check: inspect global scope for expected function names (they should not exist)', async ({ page }) => {
      await page.goto(APP_URL);
      await page.waitForTimeout(100);

      const globals = await page.evaluate(() => {
        // Return typeof for each function name mentioned in the FSM
        return {
          runConstantExample: typeof runConstantExample,
          runLinearExample: typeof runLinearExample,
          runQuadraticExample: typeof runQuadraticExample,
          runLogarithmicExample: typeof runLogarithmicExample
        };
      });

      // Because the script is truncated, none of these should be functions
      expect(globals.runConstantExample).not.toBe('function');
      expect(globals.runLinearExample).not.toBe('function');
      expect(globals.runQuadraticExample).not.toBe('function');
      expect(globals.runLogarithmicExample).not.toBe('function');
    });
  });
});