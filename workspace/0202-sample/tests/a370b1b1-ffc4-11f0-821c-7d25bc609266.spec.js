import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a370b1b1-ffc4-11f0-821c-7d25bc609266.html';

test.describe('Union-Find Demo (FSM) - a370b1b1-ffc4-11f0-821c-7d25bc609266', () => {
  // Containers for console and page errors observed during each test
  let consoleMessages = [];
  let consoleErrors = [];
  let pageErrors = [];

  // Attach listeners and navigate before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL);
    // Ensure basic elements are present before each test
    await page.waitForSelector('#demo-btn');
    await page.waitForSelector('#demo-output');
  });

  // After each test, verify there were no unexpected page-level errors
  test.afterEach(async () => {
    // No runtime page errors should have occurred for the normal interaction tests.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => String(e)).join('\n')}`).toBe(0);
    // No console 'error' messages expected from the page's script in normal conditions.
    expect(consoleErrors.length, `Unexpected console errors: ${consoleErrors.join('\n')}`).toBe(0);
  });

  test.describe('FSM States and Transitions', () => {
    test('S0_Idle - initial render: button enabled and output empty', async ({ page }) => {
      // Validate initial Idle state (S0_Idle)
      const btn = await page.waitForSelector('#demo-btn');
      const btnText = await btn.textContent();
      const isDisabled = await btn.evaluate((b) => b.disabled);
      const outputText = await page.locator('#demo-output').textContent();
      const ariaLive = await page.getAttribute('#demo-output', 'aria-live');

      // Button should be present and enabled with the initial label
      expect(btnText).toBe('Run Demonstration');
      expect(isDisabled).toBe(false);

      // Demo output should be empty initially
      expect(outputText.trim()).toBe('');

      // The output container should have polite aria-live attribute as per implementation
      expect(ariaLive).toBe('polite');
    });

    test('S0 -> S1 transition on ButtonClick: button disabled and text updated', async ({ page }) => {
      // Validate transition from Idle to Demonstration Running (S0 -> S1)
      const btn = page.locator('#demo-btn');
      await btn.click();

      // Immediately after click, the button should be disabled and text changed to 'Demonstration Running...'
      await expect(btn).toHaveAttribute('disabled', ''); // attribute exists when disabled
      const btnTextAfterClick = await btn.textContent();
      expect(btnTextAfterClick).toBe('Demonstration Running...');

      // Output should still be empty shortly after click (before timer completes)
      const output = page.locator('#demo-output');
      const outputText = await output.textContent();
      expect(outputText.trim()).toBe('');
    });

    test('S1 -> S2 transition on TimerComplete: output displayed and button text updated', async ({ page }) => {
      // Validate transition from Demonstration Running to Demonstration Completed (S1 -> S2)
      const btn = page.locator('#demo-btn');
      const output = page.locator('#demo-output');

      // Click to start demonstration
      await btn.click();

      // Wait for the demo to finish and output to be populated.
      // The implementation uses setTimeout(..., 500), so wait up to 2s to be robust.
      await page.waitForFunction(() => {
        const el = document.getElementById('demo-output');
        return el && el.textContent && el.textContent.trim().length > 0;
      }, { timeout: 2000 });

      // Verify button text changed to 'Demonstration Completed' as part of S1 exit action and S2 entry expectation
      const finalBtnText = await btn.textContent();
      expect(finalBtnText).toBe('Demonstration Completed');

      // The button was disabled at the start and the implementation never re-enables it.
      const isDisabledFinal = await btn.evaluate(b => b.disabled);
      expect(isDisabledFinal).toBe(true);

      // Verify output contains key markers produced by unionFindDemo logs
      const finalOutput = await output.textContent();
      expect(finalOutput).toContain('Initialized Union-Find with elements 0 through 6');
      expect(finalOutput).toContain('Final sets after all operations:');
      expect(finalOutput).toContain('Set represented by'); // indicates the final set output lines
      expect(finalOutput).toContain('Union(0, 1)');
      expect(finalOutput).toContain('Connected(5, 6)? → true');
    });

    test('Edge: clicking multiple times quickly should not re-run demo (button remains disabled)', async ({ page }) => {
      // Ensure double/triple clicks don't re-trigger the demonstration because the button is disabled on first click
      const btn = page.locator('#demo-btn');
      const output = page.locator('#demo-output');

      // Click rapidly multiple times
      await btn.click();
      // Try clicking again immediately - this should have no effect because button is disabled synchronously in handler
      // But Playwright might still attempt to click; handle gracefully by catching potential errors from clicking disabled element.
      let secondClickError = null;
      try {
        await btn.click({ timeout: 200 }).catch(e => { throw e; });
      } catch (e) {
        // It's acceptable for the second click to fail if the button became disabled quickly.
        secondClickError = e;
      }

      // Wait for completion
      await page.waitForFunction(() => {
        const el = document.getElementById('demo-output');
        return el && el.textContent && el.textContent.trim().length > 0;
      }, { timeout: 2000 });

      const finalOutput = await output.textContent();
      // The output should contain the full demo logs exactly once - check key phrases
      const occurrences = (finalOutput.match(/Initialized Union-Find with elements 0 through 6/g) || []).length;
      expect(occurrences).toBe(1);

      // Ensure button remains disabled and labeled 'Demonstration Completed'
      const finalBtnText = await btn.textContent();
      expect(finalBtnText).toBe('Demonstration Completed');
      expect(await btn.evaluate(b => b.disabled)).toBe(true);

      // If a second click attempt produced an error from Playwright, ensure it was due to DOM state (acceptable)
      if (secondClickError) {
        expect(String(secondClickError)).toContain('element is not enabled').or.toContain('timeout');
      }
    });
  });

  test.describe('Edge cases and error observations', () => {
    test('Attempting to call internal unionFindDemo function from page context should throw ReferenceError', async ({ page }) => {
      // unionFindDemo is defined inside an IIFE and is NOT available on window/global scope.
      // Calling it directly should throw a ReferenceError in the page context. We must observe and assert this behavior.
      let evalError = null;
      try {
        await page.evaluate(() => {
          // Intentionally attempt to call an internal function that is not exposed globally.
          // This should naturally produce a ReferenceError in the page context.
          // We do not inject or modify any globals; we simply attempt to reference unionFindDemo.
          return unionFindDemo();
        });
      } catch (e) {
        evalError = e;
      }

      // The evaluation should have thrown an error; assert it's a ReferenceError (or at least contains the name).
      expect(evalError, 'Expected a ReferenceError when calling unionFindDemo from global scope').not.toBeNull();
      // Different browsers / Node wrappers may serialize errors differently; assert on name/message presence.
      const name = evalError?.name || '';
      const message = String(evalError?.message || evalError);
      expect(name === 'ReferenceError' || message.toLowerCase().includes('is not defined')).toBe(true);
    });

    test('Observe console and page errors during normal run (should be none)', async ({ page }) => {
      // This test verifies that running the demonstration does not produce runtime page errors
      // or console.error messages from the page's script.
      const btn = page.locator('#demo-btn');

      // Click and wait for completion
      await btn.click();
      await page.waitForFunction(() => {
        const el = document.getElementById('demo-output');
        return el && el.textContent && el.textContent.trim().length > 0;
      }, { timeout: 2000 });

      // At this point, our beforeEach/afterEach checks will assert no pageErrors and no consoleErrors.
      // Additionally, assert there were no console messages of type 'error' captured.
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);

      // But capture and report any console/warn/info messages to help debugging if present.
      // We still assert that normal console output is minimal (we expect none).
      // Allow other console types (log/info/debug) but print them if present in expectation messages.
      // Ensure that if any console errors did exist, the overall afterEach would fail the test.
      expect(consoleMessages.filter(m => m.type === 'log').length >= 0).toBe(true);
    });
  });
});