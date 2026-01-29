import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b25fb3-fa74-11f0-bb9a-db7e6ecdeeaa.html';

test.describe('NP-Completeness Demo (FSM) - 63b25fb3-fa74-11f0-bb9a-db7e6ecdeeaa', () => {
  // Capture console errors and page errors for each test so we can assert on them.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect runtime page errors (uncaught exceptions).
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Collect console messages of type "error".
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Load the page exactly as-is (do not modify the environment).
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.describe('Initial Idle State (S0_Idle)', () => {
    test('Initial DOM and accessibility attributes are correct, Run DP is disabled', async ({ page }) => {
      // Verify the example input set is rendered correctly.
      const inputText = await page.locator('#inputSet').textContent();
      expect(inputText).toContain('Set: [3, 34, 4, 12, 5, 2]');
      expect(inputText).toContain('Target Sum: 9');

      // The output element should be initially empty.
      await expect(page.locator('#output')).toHaveText('', { timeout: 1000 });

      // The Brute Force button should be enabled initially.
      const bruteDisabled = await page.locator('#runBruteForce').isDisabled();
      expect(bruteDisabled).toBe(false);

      // The DP button should be disabled initially (S0 Idle evidence).
      const dpDisabled = await page.locator('#runDP').isDisabled();
      expect(dpDisabled).toBe(true);

      // Verify aria attributes on output element (component evidence).
      const ariaLive = await page.locator('#output').getAttribute('aria-live');
      const ariaAtomic = await page.locator('#output').getAttribute('aria-atomic');
      expect(ariaLive).toBe('polite');
      expect(ariaAtomic).toBe('true');

      // Ensure there were no runtime page errors or console errors during initial load.
      expect(pageErrors.length, `expected no page errors but saw: ${pageErrors.map(String).join('; ')}`).toBe(0);
      expect(consoleErrors.length, `expected no console.errors but saw: ${consoleErrors.join('; ')}`).toBe(0);
    });

    test('Clicking the disabled DP button should not succeed (edge case)', async ({ page }) => {
      // Attempting to click a disabled button should throw; assert that the click does not succeed.
      let clickThrew = false;
      try {
        await page.click('#runDP', { timeout: 500 });
      } catch (e) {
        clickThrew = true;
        // We don't assert on the specific error message because Playwright error messages can vary across versions.
        expect(e).toBeTruthy();
      }
      expect(clickThrew).toBe(true);

      // Ensure still no runtime errors were produced by attempting the click.
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Brute Force Flow (S1 -> S2 -> S3)', () => {
    test('Run Brute Force: transitions to running, completes, enables DP button', async ({ page }) => {
      // Click the Brute Force button to trigger S0 -> S1.
      await page.click('#runBruteForce');

      // Immediately after clicking, the output should show the running message (S1_BruteForceRunning).
      await expect(page.locator('#output')).toContainText('Running brute force subset sum', { timeout: 500 });
      // During running, both buttons should be disabled per implementation.
      expect(await page.locator('#runBruteForce').isDisabled()).toBe(true);
      expect(await page.locator('#runDP').isDisabled()).toBe(true);

      // Wait for the brute force computation to complete and update the output (S2_BruteForceComplete).
      // The implementation updates output with "Brute Force Result:" after a short timeout and computing the result.
      await expect(page.locator('#output')).toContainText('Brute Force Result:', { timeout: 5000 });

      // After completion, output should contain details: total recursive calls and time taken.
      const outputText = await page.locator('#output').textContent();
      expect(outputText).toContain('Total recursive calls:');
      expect(outputText).toContain('Time taken:');

      // According to the implementation, btnDP is enabled after brute force completes (S3_DPWaiting).
      expect(await page.locator('#runDP').isDisabled()).toBe(false);

      // Brute force button remains disabled in the given implementation (it wasn't explicitly re-enabled).
      expect(await page.locator('#runBruteForce').isDisabled()).toBe(true);

      // Confirm no runtime exceptions or console errors occurred during the run.
      expect(pageErrors.length, `page errors during brute force run: ${pageErrors.map(String).join('; ')}`).toBe(0);
      expect(consoleErrors.length, `console errors during brute force run: ${consoleErrors.join('; ')}`).toBe(0);
    });

    test('Clicking Brute Force again after completion should not re-enable (edge behavior)', async ({ page }) => {
      // Run brute force to completion first.
      await page.click('#runBruteForce');
      await expect(page.locator('#output')).toContainText('Brute Force Result:', { timeout: 5000 });

      // Now ensure the brute force button remains disabled and cannot be clicked.
      expect(await page.locator('#runBruteForce').isDisabled()).toBe(true);

      let clickThrew1 = false;
      try {
        await page.click('#runBruteForce', { timeout: 500 });
      } catch (e) {
        clickThrew = true;
        expect(e).toBeTruthy();
      }
      expect(clickThrew).toBe(true);

      // Still no page errors due to attempted interaction.
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Dynamic Programming Flow (S3 -> S4 -> S5)', () => {
    test('Run DP after brute force: transitions to running and completes with result', async ({ page }) => {
      // First run brute force so DP button becomes enabled (S2 -> S3).
      await page.click('#runBruteForce');
      await expect(page.locator('#output')).toContainText('Brute Force Result:', { timeout: 5000 });
      expect(await page.locator('#runDP').isDisabled()).toBe(false);

      // Click the DP button to start DP run (S3 -> S4).
      await page.click('#runDP');

      // Immediately the output should indicate DP is running.
      await expect(page.locator('#output')).toContainText('Running dynamic programming subset sum', { timeout: 500 });

      // While DP is running, the DP button should be disabled (per implementation).
      expect(await page.locator('#runDP').isDisabled()).toBe(true);

      // Wait for DP completion which writes "Dynamic Programming Result:".
      await expect(page.locator('#output')).toContainText('Dynamic Programming Result:', { timeout: 5000 });

      // Output should include time taken and the explanatory paragraph.
      const dpOutput = await page.locator('#output').textContent();
      expect(dpOutput).toContain('Time taken:');
      expect(dpOutput).toContain('The DP algorithm runs in pseudopolynomial time');

      // Ensure no runtime page errors or console errors occurred during DP run.
      expect(pageErrors.length, `page errors during DP run: ${pageErrors.map(String).join('; ')}`).toBe(0);
      expect(consoleErrors.length, `console errors during DP run: ${consoleErrors.join('; ')}`).toBe(0);
    });

    test('Attempt to run DP without running brute force first (edge case): should be disabled', async ({ page }) => {
      // On fresh load DP is disabled; attempt clicking it should throw and not produce runtime errors.
      expect(await page.locator('#runDP').isDisabled()).toBe(true);
      let clickThrew2 = false;
      try {
        await page.click('#runDP', { timeout: 500 });
      } catch (e) {
        clickThrew = true;
        expect(e).toBeTruthy();
      }
      expect(clickThrew).toBe(true);

      // Confirm no uncaught exceptions were logged on the page.
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Integration and FSM properties', () => {
    test('Full scenario: Idle -> BruteForceRunning -> BruteForceComplete -> DPWaiting -> DPRunning -> DPComplete', async ({ page }) => {
      // Validate the complete flow and that expected onEnter/onExit observable effects occur.
      // Start at Idle
      expect(await page.locator('#runDP').isDisabled()).toBe(true);
      expect(await page.locator('#runBruteForce').isDisabled()).toBe(false);

      // Trigger RunBruteForce event
      await page.click('#runBruteForce');
      // OnEnter S1_BruteForceRunning: output should contain running message and warnings
      await expect(page.locator('#output')).toContainText('Running brute force subset sum', { timeout: 500 });

      // Wait for brute force completion (BruteForceComplete)
      await expect(page.locator('#output')).toContainText('Brute Force Result:', { timeout: 5000 });

      // After S2_BruteForceComplete, DP should be enabled (S3_DPWaiting)
      expect(await page.locator('#runDP').isDisabled()).toBe(false);

      // Trigger RunDP event (S3 -> S4)
      await page.click('#runDP');
      await expect(page.locator('#output')).toContainText('Running dynamic programming subset sum', { timeout: 500 });

      // Wait for DP completion (S5_DPComplete)
      await expect(page.locator('#output')).toContainText('Dynamic Programming Result:', { timeout: 5000 });

      // Final assertions: both results were printed and include expected markers (✅ or ❌ may vary).
      const final = await page.locator('#output').textContent();
      expect(final).toMatch(/Dynamic Programming Result:/);

      // Ensure no unexpected runtime errors were emitted during the end-to-end flow.
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });
});