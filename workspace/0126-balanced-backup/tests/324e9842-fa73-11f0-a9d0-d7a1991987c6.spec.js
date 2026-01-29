import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324e9842-fa73-11f0-a9d0-d7a1991987c6.html';

test.describe('Process Concept Demonstration - FSM (Application ID: 324e9842-fa73-11f0-a9d0-d7a1991987c6)', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure each test starts with a fresh navigation to the page.
    await page.goto(APP_URL);
  });

  test('S0_Idle: Initial render shows Start Process button and empty output', async ({ page }) => {
    // Validate initial (Idle) state UI elements are present and correct.
    const startBtn = page.locator('#startProcessBtn');
    const output = page.locator('#output');

    await expect(startBtn).toBeVisible();
    await expect(startBtn).toHaveText('Start Process');
    await expect(startBtn).toBeEnabled();

    // Output should exist and be empty on initial render
    await expect(output).toBeVisible();
    const initialOutput = (await output.textContent()) || '';
    expect(initialOutput.trim()).toBe('', 'Output should be empty in Idle state');
  });

  test('S0 -> S1 (StartProcessClick): Clicking Start shows "Process Started... Please wait."', async ({ page }) => {
    // Observe console and page errors during normal flow
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Click the Start Process button to trigger transition to Processing
    await page.click('#startProcessBtn');

    // Immediately the entry action for S1_Processing should set this text
    const output = page.locator('#output');
    await expect(output).toHaveText('Process Started... Please wait.', { timeout: 1000 });

    // No runtime errors should have occurred in normal processing start
    expect(pageErrors.length).toBe(0);

    // Console may contain messages, but ensure there are none of type 'error'
    const consoleErrorMessages = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrorMessages.length).toBe(0);
  });

  test('S1 -> S2 (ProcessFinished): After async processing completes, final result is shown', async ({ page }) => {
    // Observe runtime errors and console for this asynchronous flow
    const pageErrors = [];
    const consoleMessages = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));

    // Start the process which internally waits ~3 seconds before resolving
    await page.click('#startProcessBtn');

    // Wait for the final result to appear in the #output element
    await page.waitForFunction(
      () => {
        const el = document.getElementById('output');
        return !!el && el.innerText === 'Process Finished: Data Retrieved Successfully!';
      },
      null,
      { timeout: 7000 } // Allow time for the 3s simulated delay + buffer
    );

    const outputText = await page.locator('#output').textContent();
    expect(outputText.trim()).toBe('Process Finished: Data Retrieved Successfully!');

    // Ensure no uncaught page errors occurred during the normal async flow
    expect(pageErrors.length).toBe(0);

    // Ensure no console errors were emitted
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('S1 -> S3 (ProcessError): Edge case - missing output element causes runtime error (simulated error path)', async ({ page }) => {
    // This test intentionally removes the #output element before starting the process
    // to validate that an error transition (S3_Error) occurs when startProcess cannot
    // find the outputDiv. We do not modify application code; we only interact with the DOM
    // as a user or environment might (edge case).
    await page.evaluate(() => {
      const el = document.getElementById('output');
      if (el) el.remove();
    });

    // Ensure the output element is indeed removed
    const maybeOutput = await page.$('#output');
    expect(maybeOutput).toBeNull();

    // Wait for a pageerror event which should be triggered by attempting to access .innerHTML on null
    const [pageError] = await Promise.all([
      page.waitForEvent('pageerror', { timeout: 2000 }),
      // Trigger the startProcess click which should cause a TypeError when outputDiv is null
      page.click('#startProcessBtn').catch(() => {
        // page.click might itself be fine; any real error will be surfaced via pageerror event
      }),
    ]);

    // Validate that a page error occurred and that it relates to accessing properties on null
    expect(pageError).toBeTruthy();
    const msg = String(pageError.message || pageError);
    // Accept a few possible TypeError messages across browsers/runtimes
    const expectedPatterns = [
      /Cannot set properties of null/i,
      /Cannot read properties of null/i,
      /Cannot read property 'innerHTML'/i,
      /TypeError/i,
    ];
    const matches = expectedPatterns.some((re) => re.test(msg));
    expect(matches).toBeTruthy();

    // The missing output means there's no final output element to assert; ensure still absent
    const outputAfter = await page.$('#output');
    expect(outputAfter).toBeNull();
  });

  test('Edge case: multiple quick Start clicks - processing remains consistent and completes with final result', async ({ page }) => {
    // Observe console and page errors for multi-click scenario
    const pageErrors = [];
    const consoleMessages = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));

    // Rapidly click the Start Process button multiple times
    await Promise.all([
      page.click('#startProcessBtn'),
      page.click('#startProcessBtn'),
      page.click('#startProcessBtn'),
    ]);

    // Immediately after clicks it should show the processing message
    await expect(page.locator('#output')).toHaveText('Process Started... Please wait.');

    // Eventually it should settle to the final successful result
    await page.waitForFunction(
      () => {
        const el = document.getElementById('output');
        return !!el && el.innerText === 'Process Finished: Data Retrieved Successfully!';
      },
      null,
      { timeout: 8000 }
    );

    const finalText = await page.locator('#output').textContent();
    expect(finalText.trim()).toBe('Process Finished: Data Retrieved Successfully!');

    // Ensure no uncaught runtime errors happened during multiple starts
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});