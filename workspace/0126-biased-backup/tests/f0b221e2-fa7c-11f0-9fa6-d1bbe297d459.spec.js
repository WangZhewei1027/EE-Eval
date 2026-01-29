import { test, expect } from '@playwright/test';

test.setTimeout(30000); // allow up to 30s per test because the demo uses timeouts up to 5s

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b221e2-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('Bucket Sort Demo FSM - f0b221e2-fa7c-11f0-9fa6-d1bbe297d459', () => {
  // Collect console messages and page errors for each test to validate runtime health
  let consoleErrors;
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    consoleMessages = [];

    // Capture console.error messages
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the app page for each test (fresh state)
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // No teardown actions required beyond Playwright's automatic cleanup
    // But keep this hook to satisfy setup/teardown requirement
  });

  test('Initial Idle State (S0_Idle) renders with Run Bucket Sort Demo button and initial message', async ({ page }) => {
    // This test validates the Idle state as described in the FSM:
    // - The demo button with id #demoButton exists
    // - The demo output contains the initial prompt
    // - Check that onEnter actions referenced in the FSM (renderPage) are not present on the global scope
    // - Ensure there are no console errors or page errors on load

    // Verify button exists and has expected text
    const demoButton = await page.$('#demoButton');
    expect(demoButton, 'Expected #demoButton to exist on the page in Idle state').not.toBeNull();
    const buttonText = await demoButton?.innerText();
    expect(buttonText).toContain('Run Bucket Sort Demo');

    // Verify the initial visualization message
    const demoOutput = await page.$('#demoOutput');
    expect(demoOutput, 'Expected #demoOutput to exist').not.toBeNull();
    const initialText = await demoOutput?.innerText();
    expect(initialText).toContain('Click the button to see the demonstration');

    // FSM mentions renderPage() as an entry action for S0_Idle.
    // The implementation does not define renderPage; verify it is not present (we must not inject or patch).
    const renderPageDefined = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(renderPageDefined).toBe(false);

    // Also check startDemo is not globally defined (FSM mentions it for S1 but implementation binds directly)
    const startDemoDefined = await page.evaluate(() => typeof window.startDemo !== 'undefined');
    expect(startDemoDefined).toBe(false);

    // Assert no console errors or page errors occurred during initial load
    expect(consoleErrors, 'No console.error messages expected on initial load').toEqual([]);
    expect(pageErrors, 'No uncaught page errors expected on initial load').toEqual([]);
  });

  test('Clicking Run Demo transitions to Demo Running (S1_DemoRunning) and shows immediate running message', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_DemoRunning on clicking #demoButton
    // - After click, the running message should appear immediately (synchronous update)
    // - Verify that startDemo() isn't required for the running message to appear (it's not defined)
    // - Ensure no console/page errors from the click action

    // Click the demo button
    await page.click('#demoButton');

    // Immediately check that the running message is present
    await expect(page.locator('#demoOutput')).toContainText(
      'Running bucket sort on [0.42, 0.32, 0.75, 0.12, 0.98, 0.63] with 4 buckets',
      { timeout: 1000 }
    );

    // Verify that the FSM's startDemo() is not present (implementation uses inline handler)
    const startDemoDefined = await page.evaluate(() => typeof window.startDemo !== 'undefined');
    expect(startDemoDefined).toBe(false);

    // Assert no console or page errors resulted from the click
    expect(consoleErrors, 'No console.error messages expected after clicking the demo button').toEqual([]);
    expect(pageErrors, 'No uncaught page errors expected after clicking the demo button').toEqual([]);
  });

  test('Sequential FSM states S2 -> S3 -> S4 -> S5 -> S6 occur in order and produce expected DOM updates', async ({ page }) => {
    // This test validates the timed transitions and evidence content for:
    // S2_BucketCreation (Step 1),
    // S3_ScatterElements (Step 2),
    // S4_SortBuckets (Step 3),
    // S5_GatherElements (Step 4),
    // S6_Complete (Sorting complete!)
    //
    // It waits for each step's text to appear in order and asserts their presence.

    await page.click('#demoButton');

    // Step 1: appears after ~1000ms
    await page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      return el && /Step 1: Create 4 empty buckets/.test(el.innerText);
    }, null, { timeout: 3000 });
    const step1Text = await page.locator('#demoOutput').innerText();
    expect(step1Text).toContain('Step 1: Create 4 empty buckets');

    // Step 2: appears after ~2000ms
    await page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      return el && /Step 2: Scatter elements into buckets/.test(el.innerText);
    }, null, { timeout: 4000 });
    const step2Text = await page.locator('#demoOutput').innerText();
    expect(step2Text).toContain('Step 2: Scatter elements into buckets');
    expect(step2Text).toContain('Bucket 0 (0-0.25): [0.12]');
    expect(step2Text).toContain('Bucket 1 (0.25-0.5): [0.42, 0.32]');
    expect(step2Text).toContain('Bucket 3 (0.75-1.0): [0.75, 0.98]');

    // Step 3: appears after ~3000ms
    await page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      return el && /Step 3: Sort individual buckets/.test(el.innerText);
    }, null, { timeout: 5000 });
    const step3Text = await page.locator('#demoOutput').innerText();
    expect(step3Text).toContain('Step 3: Sort individual buckets');
    expect(step3Text).toContain('Bucket 1: [0.32, 0.42]');

    // Step 4: appears after ~4000ms
    await page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      return el && /Step 4: Gather sorted elements/.test(el.innerText);
    }, null, { timeout: 6000 });
    const step4Text = await page.locator('#demoOutput').innerText();
    expect(step4Text).toContain('Step 4: Gather sorted elements: [0.12, 0.32, 0.42, 0.63, 0.75, 0.98]');

    // Completion: appears after ~5000ms
    await page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      return el && /Sorting complete!/.test(el.innerText);
    }, null, { timeout: 8000 });
    const completeText = await page.locator('#demoOutput').innerText();
    expect(completeText).toContain('Sorting complete!');

    // Ensure no runtime page errors or console errors occurred during the full demo run
    expect(consoleErrors, 'No console.error messages expected during demo run').toEqual([]);
    expect(pageErrors, 'No uncaught page errors expected during demo run').toEqual([]);
  });

  test('Edge case: clicking the demo button multiple times resets/overwrites output and schedules new steps', async ({ page }) => {
    // This test validates behavior when the user clicks the demo button multiple times:
    // - The handler sets demoOutput.innerHTML to the running message immediately on each click
    // - Subsequent scheduled steps may interleave, but at least one full sequence should complete
    // - We check that clicking twice quickly results in the running message being present after each click
    // - Finally confirm that the demo reaches the final "Sorting complete!" message at least once

    // Click once
    await page.click('#demoButton');
    await expect(page.locator('#demoOutput')).toContainText('Running bucket sort on', { timeout: 1000 });

    // Click again quickly (before the steps complete)
    await page.click('#demoButton');
    // Immediately after the second click, the output should still show the running text (it resets to it)
    await expect(page.locator('#demoOutput')).toContainText('Running bucket sort on', { timeout: 1000 });

    // Wait for completion of at least one demo sequence (allow generous timeout due to possible interleaving)
    await page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      return el && /Sorting complete!/.test(el.innerText);
    }, null, { timeout: 10000 });

    const finalText = await page.locator('#demoOutput').innerText();
    expect(finalText).toContain('Sorting complete!');

    // As an additional check, verify that at least one 'Step 1' appears (could be multiple due to multiple clicks)
    const step1Occurrences = (finalText.match(/Step 1: Create 4 empty buckets/g) || []).length;
    expect(step1Occurrences).toBeGreaterThanOrEqual(1);

    // No unexpected runtime errors due to multiple clicks
    expect(consoleErrors, 'No console.error messages expected after multiple clicks').toEqual([]);
    expect(pageErrors, 'No uncaught page errors expected after multiple clicks').toEqual([]);
  });

  test('Observes console messages and page errors during lifecycle (no unexpected runtime exceptions)', async ({ page }) => {
    // This test explicitly asserts that the page produced no console.error or uncaught exceptions
    // during navigation and a full demo run. It demonstrates observation of console and page errors.

    // Start a demo run
    await page.click('#demoButton');

    // Wait for completion
    await page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      return el && /Sorting complete!/.test(el.innerText);
    }, null, { timeout: 10000 });

    // Now assert that no console.error messages or page errors were captured.
    // If implementation had thrown ReferenceError / SyntaxError / TypeError, they would be present here.
    // The assertion below ensures the environment did not produce such errors.
    expect(consoleErrors, 'Expected no console.error messages during page lifecycle').toEqual([]);
    expect(pageErrors, 'Expected no uncaught page errors during page lifecycle').toEqual([]);
  });
});