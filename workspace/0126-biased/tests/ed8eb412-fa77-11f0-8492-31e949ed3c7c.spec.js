import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8eb412-fa77-11f0-8492-31e949ed3c7c.html';

test.describe('Semaphore Visualization - FSM Comprehensive Tests', () => {
  // Arrays to collect runtime diagnostics for each test
  let pageErrors = [];
  let consoleMessages = [];

  // Attach listeners and navigate to the page before each test
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Collect console messages for inspection
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Load the application exactly as-is
    await page.goto(APP_URL);
  });

  test.describe('States (FSM) - Idle, Red, Green', () => {
    test('Idle state renders the main page and primary elements (S0_Idle)', async ({ page }) => {
      // This test validates the initial "Idle" evidence:
      // - The page heading exists and matches FSM evidence
      // - The three semaphore lights exist
      // - No unexpected runtime errors occurred during page load

      // Validate heading text
      const h1 = page.locator('h1');
      await expect(h1).toHaveText('Pulsating Semaphore Visualization');

      // Validate there are exactly 3 light elements
      const lights = page.locator('.light');
      await expect(lights).toHaveCount(3);

      // Validate controls exist: two buttons with expected text
      const redButton = page.locator('.button[onclick="changeLight(\'red\')"]');
      const greenButton = page.locator('.button[onclick="changeLight(\'green\')"]');
      await expect(redButton).toHaveCount(1);
      await expect(greenButton).toHaveCount(1);
      await expect(redButton).toHaveText('Red');
      await expect(greenButton).toHaveText('Green');

      // Validate that the onclick attributes match FSM evidence exactly
      const redOnclick = await redButton.getAttribute('onclick');
      const greenOnclick = await greenButton.getAttribute('onclick');
      expect(redOnclick).toBe("changeLight('red')");
      expect(greenOnclick).toBe("changeLight('green')");

      // Validate that no uncaught page errors (ReferenceError, SyntaxError, TypeError) occurred on load
      // If such errors do occur naturally, they will be captured in pageErrors and this assertion will fail.
      expect(pageErrors.length).toBe(0);

      // Also assert there are no console messages of type 'error'
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Red state (S1_Red) - clicking Red triggers changeLight(\'red\') and brightens the red light', async ({ page }) => {
      // This test validates the transition from Idle -> Red via ChangeToRed event:
      // - Clicking the Red button should set the first light inline opacity to '1'
      // - Other lights should be dimmed to '0.2'
      // - No runtime errors should be emitted by this action

      const redBtnSelector = `.button[onclick="changeLight('red')"]`;
      const redBtn = page.locator(redBtnSelector);
      await redBtn.click();

      // After click, check inline style.opacity values set by changeLight
      const redOpacity = await page.locator('.light').nth(0).evaluate(el => el.style.opacity);
      const yellowOpacity = await page.locator('.light').nth(1).evaluate(el => el.style.opacity);
      const greenOpacity = await page.locator('.light').nth(2).evaluate(el => el.style.opacity);

      expect(redOpacity).toBe('1');      // Red light is bright
      expect(yellowOpacity).toBe('0.2'); // Yellow should be dimmed
      expect(greenOpacity).toBe('0.2');  // Green should be dimmed

      // Ensure no uncaught exceptions were raised by the click action
      expect(pageErrors.length).toBe(0);

      // Confirm that onclick evidence exists in DOM for the button (as FSM evidence)
      const onclickAttr = await redBtn.getAttribute('onclick');
      expect(onclickAttr).toContain("changeLight('red')");
    });

    test('Green state (S2_Green) - clicking Green triggers changeLight(\'green\') and brightens the green light', async ({ page }) => {
      // This test validates the transition from Idle -> Green via ChangeToGreen event:
      // - Clicking the Green button should set the third light inline opacity to '1'
      // - Other lights should be dimmed to '0.2'
      // - No runtime errors should be emitted by this action

      const greenBtnSelector = `.button[onclick="changeLight('green')"]`;
      const greenBtn = page.locator(greenBtnSelector);
      await greenBtn.click();

      // After click, check inline style.opacity values set by changeLight
      const redOpacity = await page.locator('.light').nth(0).evaluate(el => el.style.opacity);
      const yellowOpacity = await page.locator('.light').nth(1).evaluate(el => el.style.opacity);
      const greenOpacity = await page.locator('.light').nth(2).evaluate(el => el.style.opacity);

      expect(redOpacity).toBe('0.2');    // Red should be dimmed
      expect(yellowOpacity).toBe('0.2'); // Yellow should be dimmed
      expect(greenOpacity).toBe('1');    // Green light is bright

      // Ensure no uncaught exceptions were raised by the click action
      expect(pageErrors.length).toBe(0);

      // Confirm that onclick evidence exists in DOM for the button (as FSM evidence)
      const onclickAttr = await greenBtn.getAttribute('onclick');
      expect(onclickAttr).toContain("changeLight('green')");
    });
  });

  test.describe('Transitions and Interactions', () => {
    test('Transition evidence: Buttons trigger expected inline style changes and keep DOM evidence intact', async ({ page }) => {
      // Click Red, then Green, and assert observed behaviors after each transition
      const redBtn = page.locator(`.button[onclick="changeLight('red')"]`);
      const greenBtn = page.locator(`.button[onclick="changeLight('green')"]`);

      // Trigger Red
      await redBtn.click();
      const redAfterRedClick = await page.locator('.light').nth(0).evaluate(el => el.style.opacity);
      const greenAfterRedClick = await page.locator('.light').nth(2).evaluate(el => el.style.opacity);
      expect(redAfterRedClick).toBe('1');
      expect(greenAfterRedClick).toBe('0.2');

      // Trigger Green
      await greenBtn.click();
      const redAfterGreenClick = await page.locator('.light').nth(0).evaluate(el => el.style.opacity);
      const greenAfterGreenClick = await page.locator('.light').nth(2).evaluate(el => el.style.opacity);
      expect(redAfterGreenClick).toBe('0.2');
      expect(greenAfterGreenClick).toBe('1');

      // The DOM evidence (onclick attributes) should remain unchanged after interactions
      const redOnclick = await redBtn.getAttribute('onclick');
      const greenOnclick = await greenBtn.getAttribute('onclick');
      expect(redOnclick).toBe("changeLight('red')");
      expect(greenOnclick).toBe("changeLight('green')");

      // No uncaught runtime errors should have occurred
      expect(pageErrors.length).toBe(0);
    });

    test('Rapid toggling of controls results in the last requested state taking effect', async ({ page }) => {
      // Simulate rapid user interaction: Red then Green quickly
      const redBtn = page.locator(`.button[onclick="changeLight('red')"]`);
      const greenBtn = page.locator(`.button[onclick="changeLight('green')"]`);

      // Click red then green in quick succession
      await Promise.all([
        redBtn.click(),
        greenBtn.click()
      ]);

      // Small wait to allow JS to run and inline styles to be applied
      await page.waitForTimeout(50);

      // Expect green to be the final bright state
      const redOpacity = await page.locator('.light').nth(0).evaluate(el => el.style.opacity);
      const greenOpacity = await page.locator('.light').nth(2).evaluate(el => el.style.opacity);

      // The final state is not strictly deterministic in a real race, but our implementation is sync,
      // so the last click (green) should set green to '1' and others to '0.2'
      expect(greenOpacity).toBe('1');
      expect(redOpacity).toBe('0.2');

      // Ensure there were no runtime exceptions
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge Cases and Error Observations', () => {
    test('Calling changeLight with an unexpected color does not throw and does not raise page errors', async ({ page }) => {
      // This test attempts to invoke the exposed changeLight function with an unexpected parameter
      // We do not modify page functions; we simply call the existing function from the page context.
      // The application should handle unknown colors gracefully (no exceptions in the provided implementation).

      const result = await page.evaluate(() => {
        try {
          // call with a color that the implementation does not explicitly handle
          // Should not throw; if it throws, it will be captured by pageerror and reported to the test run
          changeLight('blue');
          return 'ok';
        } catch (err) {
          return `error:${err.message || err.toString()}`;
        }
      });

      expect(result).toBe('ok');

      // Also ensure no page errors were emitted as a result
      expect(pageErrors.length).toBe(0);
    });

    test('No unexpected ReferenceError, SyntaxError, or TypeError occurred during the session', async ({ page }) => {
      // This test is specifically about observing runtime errors reported by the page.
      // It collects any pageerror events and asserts that they do not contain critical JS engine errors.
      const messages = pageErrors.map(e => e.message || e.toString()).join('\n');

      // If there are page errors, make a helpful assertion failure message
      expect(messages).not.toContain('ReferenceError');
      expect(messages).not.toContain('SyntaxError');
      expect(messages).not.toContain('TypeError');

      // Also assert that the page did not emit any pageerror events at all (preferred)
      expect(pageErrors.length).toBe(0);
    });

    test('Collect and report console messages (no console.error expected)', async ({ page }) => {
      // This test ensures that during normal operation there are no console.error messages.
      // It also demonstrates capturing and inspecting console output emitted by the application.

      // Interact a bit to potentially generate console messages (the app does not log by default)
      await page.locator(`.button[onclick="changeLight('red')"]`).click();
      await page.locator(`.button[onclick="changeLight('green')"]`).click();

      // Filter console messages for errors
      const errors = consoleMessages.filter(m => m.type === 'error');

      // If any errors were printed to console, fail and provide the messages
      expect(errors.length).toBe(0);

      // For visibility in test output in case of failures, attach captured console messages to expectation message
      // (We still assert no errors; but other console messages are acceptable)
      const nonErrorMsgs = consoleMessages.filter(m => m.type !== 'error').map(m => `${m.type}:${m.text}`).join(' | ');
      // The test won't fail here; this is additional context if needed.
      expect(Array.isArray(consoleMessages)).toBeTruthy();
      // Ensure no page runtime errors as well
      expect(pageErrors.length).toBe(0);
    });
  });
});