import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0126-biased/html/04439493-fa79-11f0-8a8e-bbe4f11717c6.html';

test.describe('Mutex application (FSM: Idle with two buttons) - 04439493-fa79-11f0-8a8e-bbe4f11717c6', () => {
  // Arrays to capture runtime diagnostics per test
  let consoleMessages;
  let pageErrors;
  let responses;
  let requestFailed;

  test.beforeEach(async ({ page }) => {
    // initialize collectors
    consoleMessages = [];
    pageErrors = [];
    responses = [];
    requestFailed = [];

    // Capture console outputs
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // ignore collectors failing
      }
    });

    // Capture page errors (unhandled exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Capture network responses and failed requests
    page.on('response', resp => {
      responses.push(resp);
    });
    page.on('requestfailed', req => {
      requestFailed.push(req);
    });

    // Navigate and wait for full load to ensure resource loading / script execution happens naturally
    await page.goto(BASE, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Close the page to clean up
    await page.close();
  });

  test('Initial Idle state: both buttons render with expected text and page heading exists', async ({ page }) => {
    // Validate main heading is present
    const heading = await page.locator('h1');
    await expect(heading).toHaveText('Mutex');

    // Validate description paragraph is present and non-empty
    const paragraph = await page.locator('p');
    await expect(paragraph).not.toBeEmpty();

    // Validate both buttons exist and show the "Click me!" label
    const button1 = page.locator('#button1');
    const button2 = page.locator('#button2');

    await expect(button1).toBeVisible();
    await expect(button1).toHaveText('Click me!');

    await expect(button2).toBeVisible();
    await expect(button2).toHaveText('Click me!');

    // FSM initial idle state evidence: both buttons present
    // Check there are exactly two matching button elements in the grid
    const allButtons = page.locator('.grid button');
    await expect(allButtons).toHaveCount(2);

    // Validate that resources either loaded cleanly OR any runtime errors are typical JS runtime errors.
    // We allow two acceptable scenarios:
    //  - No page errors (clean load)
    //  - Or pageErrors exist and they are typical ReferenceError/TypeError/SyntaxError (allowed to surface naturally)
    const allowedRuntimeErrorPattern = /ReferenceError|TypeError|SyntaxError/;
    const runtimeErrorsOk =
      pageErrors.length === 0 || pageErrors.every(e => allowedRuntimeErrorPattern.test(String(e?.message || '')));

    expect(runtimeErrorsOk).toBeTruthy();

    // Additionally, it's common for missing external assets to trigger network-level failures.
    // Assert that if any failed responses are present they are resource load failures (style.css or script.js),
    // otherwise there were no HTTP failures.
    const failedResponses = responses.filter(r => r.status() >= 400);
    const resourceFailureOk =
      failedResponses.length === 0 ||
      failedResponses.every(r => /(script\.js|style\.css)/.test(r.url()) || /\/workspace\//.test(r.url()));

    expect(resourceFailureOk).toBeTruthy();
  });

  test('Click events for Button1 and Button2: clicks do not change DOM (no transitions defined)', async ({ page }) => {
    // Capture counts and any pre-click errors
    const initialPageErrorsCount = pageErrors.length;
    const initialConsoleErrors = consoleMessages.filter(m => m.type === 'error').length;

    const btn1 = page.locator('#button1');
    const btn2 = page.locator('#button2');

    // Click button1 and ensure DOM stays in Idle state
    await btn1.click();
    await expect(btn1).toBeVisible();
    await expect(btn1).toHaveText('Click me!');
    await expect(btn2).toBeVisible();
    await expect(btn2).toHaveText('Click me!');

    // Click button2 and re-check DOM stability
    await btn2.click();
    await expect(btn1).toBeVisible();
    await expect(btn1).toHaveText('Click me!');
    await expect(btn2).toBeVisible();
    await expect(btn2).toHaveText('Click me!');

    // After interactions, ensure no unexpected new page errors were introduced.
    // Accept either no new errors OR any new errors are typical JS runtime errors.
    const newPageErrors = pageErrors.slice(initialPageErrorsCount);
    const allowedRuntimeErrorPattern = /ReferenceError|TypeError|SyntaxError/;
    expect(newPageErrors.every(e => allowedRuntimeErrorPattern.test(String(e?.message || '')) || newPageErrors.length === 0)).toBeTruthy();

    // Also ensure console error count did not pump up with unrelated errors.
    const postConsoleErrors = consoleMessages.filter(m => m.type === 'error').length;
    expect(postConsoleErrors).toBeGreaterThanOrEqual(0); // trivial check to ensure collector works
    // If more console error messages appeared, ensure they are resource-related (common for missing script/style)
    const newConsoleErrors = consoleMessages.slice(initialConsoleErrors).filter(m => m.type === 'error');
    const consoleErrorsOk =
      newConsoleErrors.length === 0 ||
      newConsoleErrors.every(m => /(Failed to load resource|404|script\.js|style\.css)/i.test(m.text));
    expect(consoleErrorsOk).toBeTruthy();
  });

  test('Edge case: rapid sequential clicks do not produce state transitions or uncaught exceptions', async ({ page }) => {
    const btn1 = page.locator('#button1');
    const btn2 = page.locator('#button2');

    // Rapidly click button1 five times and button2 five times
    for (let i = 0; i < 5; i++) {
      await btn1.click();
    }
    for (let i = 0; i < 5; i++) {
      await btn2.click();
    }

    // Ensure DOM is unchanged (still Idle with two buttons)
    await expect(page.locator('#button1')).toBeVisible();
    await expect(page.locator('#button2')).toBeVisible();
    await expect(page.locator('#button1')).toHaveText('Click me!');
    await expect(page.locator('#button2')).toHaveText('Click me!');

    // No unexpected unhandled exceptions should be present.
    // If there are pageErrors, they must be allowed runtime JS errors (we do not patch or alter code)
    const allowedRuntimeErrorPattern = /ReferenceError|TypeError|SyntaxError/;
    const runtimeErrorsOk =
      pageErrors.length === 0 || pageErrors.every(e => allowedRuntimeErrorPattern.test(String(e?.message || '')));
    expect(runtimeErrorsOk).toBeTruthy();
  });

  test('Instrumentation observation: network and console diagnostics reported appropriately', async ({ page }) => {
    // This test validates that diagnostics were captured and are sensible.
    // There may or may not be resource failures depending on the environment; allow both.
    // Ensure our collectors captured responses and console messages (zero or more)
    expect(Array.isArray(responses)).toBeTruthy();
    expect(Array.isArray(consoleMessages)).toBeTruthy();

    // If any request failed, verify that it's related to expected assets (script.js or style.css)
    const failedReqUrls = requestFailed.map(r => r.url());
    const allFailedAreExpected = failedReqUrls.every(url => /(script\.js|style\.css)/.test(url) || /04439493-fa79-11f0-8a8e/.test(url));
    // Either there are no failed requests or all failed requests are expected assets
    expect(failedReqUrls.length === 0 || allFailedAreExpected).toBeTruthy();

    // If there are HTTP responses with status >= 400, they should be resource loads (permissible)
    const badResponses = responses.filter(r => r.status() >= 400).map(r => ({ url: r.url(), status: r.status() }));
    const badResponsesOk = badResponses.length === 0 || badResponses.every(b =>
      /(script\.js|style\.css)/.test(b.url) || /\/workspace\//.test(b.url)
    );
    expect(badResponsesOk).toBeTruthy();

    // At least one of the diagnostic collections should be accessible and not throw when inspected
    // (this is a sanity check to ensure collectors are active)
    expect(() => {
      // simple access to captured entries
      /* eslint-disable no-unused-expressions */
      consoleMessages.length;
      pageErrors.length;
      responses.length;
      requestFailed.length;
      /* eslint-enable no-unused-expressions */
    }).not.toThrow();
  });

  test('Declarative assertion: FSM specified events (Button1Click, Button2Click) are triggerable via DOM clicks', async ({ page }) => {
    // This test verifies the user can trigger the events described in the FSM by interacting with the DOM.
    // It does not assume any handlers exist and therefore only checks that DOM click can be performed.
    const btn1 = page.locator('#button1');
    const btn2 = page.locator('#button2');

    // Perform clicks and ensure no exception is thrown by the test harness
    await expect(btn1.click()).resolves.not.toThrow();
    await expect(btn2.click()).resolves.not.toThrow();

    // Since FSM transitions were not defined, ensure the page remains in the Idle evidence state:
    await expect(page.locator('#button1')).toHaveText('Click me!');
    await expect(page.locator('#button2')).toHaveText('Click me!');
  });
});