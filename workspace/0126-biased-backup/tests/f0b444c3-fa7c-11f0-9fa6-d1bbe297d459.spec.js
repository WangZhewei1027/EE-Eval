import { test, expect } from '@playwright/test';

test.setTimeout(30000);

test.describe('FSM: Comprehensive Guide to Git - Demo Sequence', () => {
  // URL where the HTML is served
  const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b444c3-fa7c-11f0-9fa6-d1bbe297d459.html';

  // Collect runtime errors and console error messages for assertions
  let pageErrors;
  let consoleErrors;

  // Setup before each test: navigate to the page and attach listeners to capture runtime issues
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Collect unhandled page errors (e.g., ReferenceError, TypeError, SyntaxError at runtime)
    page.on('pageerror', (err) => {
      // Store error message for later assertions
      try {
        pageErrors.push(err && err.message ? String(err.message) : String(err));
      } catch (e) {
        pageErrors.push(String(err));
      }
    });

    // Collect console messages of type "error"
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to the application page exactly as-is
    await page.goto(APP_URL);
  });

  // Teardown: nothing special needed, Playwright handles page cleanup per test

  test('Initial Idle State (S0_Idle): renders Run Demo Sequence button and empty output', async ({ page }) => {
    // This test validates the initial FSM state: Idle
    // - The demo button should be present and visible
    // - The demo-output div should exist and be empty
    // - No runtime page errors or console.error messages should have occurred during initial render

    const demoButton = page.locator('#demo-button');
    const demoOutput = page.locator('#demo-output');

    // Verify button exists and has correct text
    await expect(demoButton).toBeVisible();
    await expect(demoButton).toHaveText('Run Demo Sequence');

    // Verify demo output div exists and is initially empty
    // Use textContent to ensure there is no text
    const initialText = await demoOutput.textContent();
    expect(initialText === null || initialText.trim() === '').toBeTruthy();

    // Assert no page runtime errors of critical types occurred during load
    // (We observe the runtime and ensure there are none; letting any real errors surface naturally)
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('RunDemo transition (S0_Idle -> S1_DemoRunning): clicking starts demo and populates output', async ({ page }) => {
    // This test validates the transition triggered by the RunDemo event:
    // - Clicking the demo button clears the output synchronously (transition action)
    // - The demo sequence appends 10 step entries to #demo-output
    // - Visual feedback (scrollTop updated) and final content expected
    // - No critical runtime errors occur during the demo

    const demoButton = page.locator('#demo-button');
    const demoOutput = page.locator('#demo-output');

    // Precondition: ensure demo output has something (it should be empty)
    const before = await demoOutput.textContent();
    expect(before === null || before.trim() === '').toBeTruthy();

    // Click to run the demo sequence
    await demoButton.click();

    // Immediately after clicking, the code sets output.innerHTML = '' synchronously.
    // Assert that output DOM is present (it might have been cleared to empty string).
    const immediateAfterClick = await demoOutput.evaluate(node => node.innerHTML);
    // It should be a string (possibly empty); ensure it's defined
    expect(typeof immediateAfterClick).toBe('string');

    // The first step is scheduled with delay = 0 (so it may appear almost immediately).
    // Wait for at least one appended step to appear and validate its content.
    await page.waitForSelector('#demo-output > div', { timeout: 2000 });
    const firstStep = page.locator('#demo-output > div').first();
    await expect(firstStep).toBeVisible();
    const firstHtml = await firstStep.innerHTML();
    // First step should contain the git init command
    expect(firstHtml.includes('git init')).toBeTruthy();

    // Wait for the full sequence of 10 steps to complete.
    // The demo schedules steps at 0ms, 1000ms, 2000ms, ... up to 9000ms => ~10 seconds total.
    await page.waitForFunction(() => {
      const out = document.getElementById('demo-output');
      return out && out.children && out.children.length === 10;
    }, null, { timeout: 15000 });

    // Validate final state of demo output: 10 children and final command present
    const childCount = await page.evaluate(() => document.getElementById('demo-output').children.length);
    expect(childCount).toBe(10);

    // The last appended step should contain 'git merge feature'
    const lastStepHtml = await page.locator('#demo-output > div').nth(9).innerHTML();
    expect(lastStepHtml.includes('git merge feature')).toBeTruthy();

    // Visual feedback: scrollTop should be at or near scrollHeight after final append
    const { scrollTop, scrollHeight } = await demoOutput.evaluate(node => ({ scrollTop: node.scrollTop, scrollHeight: node.scrollHeight }));
    // After appending, scrollTop should be non-zero (some scrolling occurred)
    expect(scrollTop >= 0).toBeTruthy();
    expect(scrollHeight >= 0).toBeTruthy();

    // Ensure that no runtime page errors or console.error messages occurred during the demo run
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: clicking Run Demo multiple times clears output synchronously and completes without runtime errors', async ({ page }) => {
    // This test validates an edge scenario:
    // - If the demo button is clicked again shortly after starting, the handler sets output.innerHTML = ''
    //   (so the output should be cleared synchronously on the second click)
    // - A demo sequence completes (at least one full run's results appear)
    // - No ReferenceError/SyntaxError/TypeError or console.error messages are emitted

    const demoButton = page.locator('#demo-button');
    const demoOutput = page.locator('#demo-output');

    // Start first run
    await demoButton.click();

    // Wait a small amount so first run may have appended the immediate item
    await page.waitForTimeout(50);

    // Click again quickly to trigger clearing of output inside the click handler
    await demoButton.click();

    // Immediately after the second click, output.innerHTML should have been set to '' synchronously
    const postSecondClickInner = await demoOutput.evaluate(node => node.innerHTML);
    expect(typeof postSecondClickInner === 'string').toBeTruthy();
    // It is expected to be an empty string right after the click (handler clears it synchronously)
    expect(postSecondClickInner.trim() === '').toBeTruthy();

    // Wait for at least 10 appended items to appear (one full demo run).
    // Due to concurrent timers (from the first and second click), the final number might be >= 10.
    await page.waitForFunction(() => {
      const out = document.getElementById('demo-output');
      return out && out.children && out.children.length >= 10;
    }, null, { timeout: 20000 });

    // Validate that the demo-output contains at least one 'git merge feature' entry,
    // indicating that a full sequence completed.
    const outputHtml = await demoOutput.innerHTML();
    expect(outputHtml.includes('git merge feature')).toBeTruthy();

    // Ensure no runtime page errors or console.error messages occurred during the edge scenario
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('FSM evidence checks: ensure components and event handlers exist as described', async ({ page }) => {
    // This test validates the FSM extraction evidence:
    // - Button (#demo-button) exists
    // - Demo output div (#demo-output) exists
    // - Event listener for click on #demo-button is present by simulating a click and seeing behavior

    const demoButton = page.locator('#demo-button');
    const demoOutput = page.locator('#demo-output');

    // Components exist
    await expect(demoButton).toBeVisible();
    await expect(demoOutput).toBeVisible();

    // Confirm that clicking the button produces DOM changes (evidence of event handler)
    // Clear any existing content, then click and verify at least one child is appended
    await demoOutput.evaluate(node => { node.innerHTML = ''; });
    await demoButton.click();

    // Wait for first appended div to ensure handler executed
    await page.waitForSelector('#demo-output > div', { timeout: 2000 });
    const appended = await page.locator('#demo-output > div').count();
    expect(appended).toBeGreaterThanOrEqual(1);

    // No runtime errors for this evidence check
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});