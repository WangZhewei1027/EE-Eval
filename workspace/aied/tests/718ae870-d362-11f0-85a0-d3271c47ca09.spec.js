import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/718ae870-d362-11f0-85a0-d3271c47ca09.html';

test.describe('Floyd-Warshall Interactive Application (FSM validation)', () => {
  // Each test will attach listeners before navigating so load-time errors are captured.
  test('S0_Idle: page loads, Start button is present, and load-time error occurs due to script in head', async ({ page }) => {
    // Collect page errors and console messages that occur during load
    const pageErrors = [];
    const consoleMessages = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the application page (this will execute the inline script in head)
    await page.goto(APP_URL);

    // Validate that the Start button is present and visible (evidence for Idle state)
    const startButton = page.locator('button[onclick="dfs(0, 0)"]');
    await expect(startButton).toBeVisible();
    await expect(startButton).toHaveText('Start');

    // The <p id="result"> exists in the DOM (script in head attempted to access it too early)
    const result = page.locator('#result');
    await expect(result).toBeVisible();

    // Because the head script runs before the body, we expect a runtime error when it tried to set innerHTML on a null element.
    // Different browsers show slightly different messages, so assert that at least one pageerror occurred and that it mentions innerHTML/null.
    expect(pageErrors.length).toBeGreaterThan(0);
    const messages = pageErrors.map(e => String(e.message || e));
    const matched = messages.some(m => /innerHTML|Cannot set properties of null|Cannot set property 'innerHTML'|null/.test(m));
    expect(matched).toBeTruthy();

    // Also assert we captured console messages (if any). We don't fail the test if console is empty; just record.
    // This assertion records presence of console messages array (could be empty) but ensures our listener worked.
    expect(Array.isArray(consoleMessages)).toBeTruthy();

    // Verify that the result element is empty string after load (the inline assignment failed)
    await expect(result).toHaveText('');
  });

  test('S1_Processing: clicking Start triggers dfs(0, 0) but does not update result (dfs returns undefined) and does not fix initial load error', async ({ page }) => {
    // Collect page errors during and after navigation
    const pageErrors = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);

    const startButton = page.locator('button[onclick="dfs(0, 0)"]');
    const result = page.locator('#result');

    // Confirm initial conditions
    await expect(startButton).toBeVisible();
    await expect(result).toHaveText('');

    // Record error count before clicking
    const errorsBefore = pageErrors.length;

    // Click the Start button to trigger dfs(0, 0) from the button click (evidence of transition S0 -> S1)
    // We intentionally do not modify the page environment; we let the application run as-is.
    await startButton.click();

    // Wait a short time to allow any synchronous errors from the click to surface
    await page.waitForTimeout(100);

    // After clicking, the script's dfs(0,0) is executed. The implementation of dfs returns undefined for the 0,0 case,
    // and the click handler does not update the #result element. Therefore result should remain empty.
    await expect(result).toHaveText('');

    // Ensure that no unexpected new fatal page errors were introduced by the click (click should not increase errors in normal case)
    // But we still assert that the original load error persisted (i.e., we still have at least one error in the list)
    expect(pageErrors.length).toBeGreaterThanOrEqual(errorsBefore);
    expect(pageErrors.length).toBeGreaterThan(0);

    // Verify that the onclick attribute evidence exists exactly as in FSM
    const onclickAttr = await startButton.getAttribute('onclick');
    expect(onclickAttr).toBe('dfs(0, 0)');
  });

  test('Transition behavior and edge cases: multiple rapid clicks and verifying stability', async ({ page }) => {
    // Capture page errors to detect any additional runtime exceptions
    const pageErrors = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);

    const startButton = page.locator('button[onclick="dfs(0, 0)"]');
    const result = page.locator('#result');

    // Ensure initial state is Idle
    await expect(startButton).toBeVisible();
    await expect(result).toHaveText('');

    // Record initial error count
    const initialErrors = pageErrors.length;

    // Click the button multiple times rapidly to exercise dfs pathing and ensure app doesn't crash
    // The application code is intentionally buggy; we must not attempt to patch or monkey-patch.
    await Promise.all([
      startButton.click(),
      startButton.click(),
      startButton.click()
    ]);

    // Allow any synchronous handlers to run
    await page.waitForTimeout(200);

    // The result should still be unchanged (dfs returns undefined and no assignment happens in click handler)
    await expect(result).toHaveText('');

    // The number of page errors should not explode; at minimum initial load error(s) are present.
    expect(pageErrors.length).toBeGreaterThanOrEqual(initialErrors);
    expect(pageErrors.length).toBeGreaterThan(0);

    // Assert that repeated interactions do not make the Start button disappear
    await expect(startButton).toBeVisible();
  });

  test('Verify FSM evidence: HTML evidence and expected components are present', async ({ page }) => {
    await page.goto(APP_URL);

    // Evidence: button with onclick attribute and a visual element #result exist
    const button = page.locator('button[onclick="dfs(0, 0)"]');
    const result = page.locator('#result');

    await expect(button).toBeVisible();
    await expect(button).toHaveText('Start');

    await expect(result).toBeVisible();

    // Check that page contains the expected heading "Result" (helps validate UI structure)
    const heading = page.locator('h1');
    await expect(heading).toHaveText('Result');
  });

  test('Error observation detail: capture and inspect pageerror messages for expected patterns', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);

    // We expect at least one pageerror. Inspect the first error's message for debugging/educational purposes.
    expect(pageErrors.length).toBeGreaterThan(0);

    const msg = String(pageErrors[0].message || pageErrors[0]);
    // The error should indicate a problem accessing .innerHTML on null or similar. Match permissively.
    expect(msg).toMatch(/innerHTML|Cannot set properties of null|Cannot set property 'innerHTML'|null/i);

    // Also ensure there are no unexpected SyntaxErrors on load (the script is syntactically valid but logically flawed).
    const hasSyntaxError = pageErrors.some(e => /SyntaxError/i.test(String(e.message || e)));
    expect(hasSyntaxError).toBeFalsy();
  });
});