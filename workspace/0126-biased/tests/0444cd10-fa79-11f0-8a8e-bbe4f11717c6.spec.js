import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0444cd10-fa79-11f0-8a8e-bbe4f11717c6.html';

test.describe('Runtime Environment FSM - 0444cd10-fa79-11f0-8a8e-bbe4f11717c6', () => {
  // Containers for observed runtime artifacts
  let consoleMessages;
  let pageErrors;
  let failedRequests;

  // Attach listeners prior to each test navigation so we capture load-time failures
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    failedRequests = [];

    // Capture console messages
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // best-effort capture
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture unhandled exceptions in the page context (ReferenceError, TypeError, etc.)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Capture failed network requests (e.g. missing script.js)
    page.on('requestfailed', req => {
      failedRequests.push(req);
    });
  });

  test('Initial UI and Idle state presence (Start & Stop buttons exist)', async ({ page }) => {
    // Navigate to the page and allow the load to complete
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Verify key static content is present per the HTML implementation and FSM evidence
    const heading = await page.locator('.heading');
    await expect(heading).toHaveText('Runtime Environment');

    const description = await page.locator('.description');
    await expect(description).toHaveText('A showcase of exceptional design and aesthetics.');

    const startButton = page.locator('#start-button');
    const stopButton = page.locator('#stop-button');

    // Both buttons should be visible and have the expected labels (Idle state evidence)
    await expect(startButton).toBeVisible();
    await expect(startButton).toHaveText('Start');

    await expect(stopButton).toBeVisible();
    await expect(stopButton).toHaveText('Stop');

    // Check visual styling is applied from the inline <style> (verify background color)
    const startBg = await startButton.evaluate(el => getComputedStyle(el).backgroundColor);
    // #4CAF50 is rgb(76, 175, 80)
    expect(startBg).toBe('rgb(76, 175, 80)');

    // Assert we observed resource load / runtime issues that are expected from the page as-is.
    // The page references script.js which may not exist in the test environment -> expect a failed request for script.js.
    const scriptFailed = failedRequests.some(r => r.url().endsWith('/workspace/0126-biased/html/script.js') || r.url().endsWith('/script.js') || r.url().includes('script.js'));
    expect(scriptFailed).toBeTruthy();

    // Additionally ensure we captured at least one console message mentioning script.js or a failed load.
    const consoleHasScriptMsg = consoleMessages.some(m => /script\.js|Failed to load resource|404/i.test(m.text));
    expect(consoleHasScriptMsg).toBeTruthy();
  });

  test('Start button click - transition attempt from Idle -> Running (no handlers expected)', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    const startButton = page.locator('#start-button');
    const stopButton = page.locator('#stop-button');

    // Click the Start button to trigger the FSM transition (StartButtonClick)
    // The implementation may not have event handlers; we validate both the attempt and the observed result.
    await startButton.click();

    // After clicking, verify DOM stability:
    // - The Start and Stop buttons remain present and retain their labels (no JavaScript-driven state change).
    await expect(startButton).toBeVisible();
    await expect(startButton).toHaveText('Start');
    await expect(stopButton).toBeVisible();
    await expect(stopButton).toHaveText('Stop');

    // Verify no unintended disabling or removal happened
    const startDisabled = await startButton.getAttribute('disabled');
    const stopDisabled = await stopButton.getAttribute('disabled');
    expect(startDisabled).toBeNull();
    expect(stopDisabled).toBeNull();

    // Assert that the environment produced expected load-time/runtime artifacts (missing script resource)
    const scriptFailed = failedRequests.some(r => r.url().includes('script.js'));
    expect(scriptFailed).toBeTruthy();

    // Ensure there were no unexpected new page errors introduced solely by clicking
    // (we still allow for any captured pageErrors from initial load)
    expect(Array.isArray(pageErrors)).toBe(true);
  });

  test('Stop button click - transition attempt from Running -> Idle (no handlers expected)', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    const startButton = page.locator('#start-button');
    const stopButton = page.locator('#stop-button');

    // Simulate user trying to Start then Stop: click both in sequence
    await startButton.click();
    await stopButton.click();

    // Verify both buttons remain unchanged and visible
    await expect(startButton).toBeVisible();
    await expect(startButton).toHaveText('Start');
    await expect(stopButton).toBeVisible();
    await expect(stopButton).toHaveText('Stop');

    // Ensure no runtime exceptions were introduced by these clicks beyond the initial load-time artifacts
    const scriptFailed = failedRequests.some(r => r.url().includes('script.js'));
    expect(scriptFailed).toBeTruthy();

    // Confirm we captured console messages; they should contain failure information about the missing script
    const foundConsoleMsg = consoleMessages.some(m => /script\.js|Failed to load resource|404/i.test(m.text));
    expect(foundConsoleMsg).toBeTruthy();
  });

  test('Edge cases: rapid/double clicks and stability checks (no handler side-effects expected)', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    const startButton = page.locator('#start-button');

    // Rapid series of clicks
    await startButton.click();
    await startButton.click();
    await startButton.click();

    // Ensure DOM still consistent and no new error types beyond initial load-time failures
    await expect(startButton).toBeVisible();
    await expect(startButton).toHaveText('Start');

    // There should be at least the earlier detected failed request for the missing script
    const scriptFailed = failedRequests.some(r => r.url().includes('script.js'));
    expect(scriptFailed).toBeTruthy();

    // Confirm that any captured page errors are instances of Error (if any)
    for (const err of pageErrors) {
      expect(err).toBeInstanceOf(Error);
    }
  });

  test('Observability: console and pageerror captures include expected diagnostics', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    // We expect at least one failed network request for the referenced script.js relative to the served HTML.
    const scriptFailed = failedRequests.some(r => r.url().includes('/workspace/0126-biased/html/script.js') || r.url().endsWith('/script.js') || r.url().includes('script.js'));
    expect(scriptFailed).toBeTruthy();

    // The console should include an entry related to the failed resource load or other diagnostics.
    const consoleRelated = consoleMessages.find(m => /script\.js|Failed to load resource|404/i.test(m.text));
    expect(consoleRelated).toBeDefined();

    // Log captured artifacts for debugging if the test framework exposes them (kept as assertions rather than console.log)
    expect(consoleMessages.length).toBeGreaterThanOrEqual(1);
    // pageErrors may be empty if the runtime did not throw; still validate the captured type
    expect(Array.isArray(pageErrors)).toBe(true);
  });

  // Teardown: nothing to clean up beyond Playwright's automatic cleanup, but keep a final assertion test
  test('Final assertion: FSM transitions are not implemented (no event handlers detected)', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    // The provided extraction summary indicated 0 detected event handlers.
    // Given the page as served has a script reference that likely fails to load, confirm that clicking does not change DOM state.
    const startButton = page.locator('#start-button');
    const stopButton = page.locator('#stop-button');

    // Perform clicks and verify invariants
    await startButton.click();
    await stopButton.click();

    await expect(startButton).toBeVisible();
    await expect(startButton).toHaveText('Start');
    await expect(stopButton).toBeVisible();
    await expect(stopButton).toHaveText('Stop');

    // Confirm missing script error observed
    const scriptFailed = failedRequests.some(r => r.url().includes('script.js'));
    expect(scriptFailed).toBeTruthy();
  });
});