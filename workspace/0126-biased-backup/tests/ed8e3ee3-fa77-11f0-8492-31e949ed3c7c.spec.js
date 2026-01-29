import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8e3ee3-fa77-11f0-8492-31e949ed3c7c.html';

test.describe('Big-Omega Notation Interactive App - FSM Validation', () => {
  // Capture console messages and page errors for each test to assert on them.
  test.beforeEach(async ({ page }) => {
    // Ensure we start with a clean slate for console/pageerror listeners.
    await page.goto(APP_URL);
  });

  test.describe('Initial load and Idle state (S0_Idle)', () => {
    test('renders required components and initial visual state', async ({ page }) => {
      // This test validates S0_Idle entry: page renders, buttons and .line exist.
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', (err) => pageErrors.push(err));

      // Verify buttons exist with expected text
      const learnBtn = page.locator(".button[onclick='displayMessage()']");
      const resetBtn = page.locator(".button[onclick='resetAnimation()']");
      await expect(learnBtn).toBeVisible();
      await expect(resetBtn).toBeVisible();

      // Verify visual component exists
      const line = page.locator('.line');
      await expect(line).toHaveCount(1);

      // Wait for the CSS animation to complete (animation: 3s with 0.5s delay => ~3.5s)
      // This ensures we observe the end state of the initial drawLine animation.
      await page.waitForTimeout(3600);
      // After animation completes, computed opacity should be 1 (fully visible).
      const computedOpacity = await page.evaluate(() => {
        const el = document.querySelector('.line');
        return window.getComputedStyle(el).opacity;
      });
      expect(computedOpacity).toBe('1');

      // Assert that there were no uncaught page errors on load
      expect(pageErrors.length).toBe(0);

      // No restrictions on console messages, but record for visibility
      // (At least one console event may occur depending on environment; ensure no errors)
      const hasErrorConsole = consoleMessages.some(m => m.type === 'error');
      expect(hasErrorConsole).toBe(false);
    });
  });

  test.describe('Learn More interaction (LearnMore_Click -> S1_MessageDisplayed)', () => {
    test('clicking Learn More displays the expected alert dialog', async ({ page }) => {
      // This test validates the transition from S0_Idle to S1_MessageDisplayed:
      // clicking the Learn More button should open an alert with the explanatory message.
      const dialogs = [];
      page.on('dialog', (dialog) => {
        dialogs.push({ type: dialog.type(), message: dialog.message() });
        // Accept the dialog so the page can continue (mimics user acknowledgement)
        dialog.accept();
      });

      // Click the Learn More button and wait a short time for the dialog handler to run
      await page.click(".button[onclick='displayMessage()']");
      // Small timeout to ensure dialog handler fired
      await page.waitForTimeout(100);

      // Verify that a dialog was shown and the message matches the expected content
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      const expectedMessage = "Big-Omega Notation represents a lower bound.\nIt is used to describe the best-case performance of an algorithm.";
      // The alert message should appear exactly as in the implementation
      expect(dialogs[0].message).toBe(expectedMessage);
    });

    test('multiple Learn More clicks produce dialogs sequentially', async ({ page }) => {
      // Ensure multiple clicks create multiple dialogs (edge-case)
      const messages = [];
      page.on('dialog', (dialog) => {
        messages.push(dialog.message());
        dialog.accept();
      });

      // Click twice in succession. Dialogs are modal in-browser; Playwright will queue events to handler.
      await page.click(".button[onclick='displayMessage()']");
      await page.waitForTimeout(50);
      await page.click(".button[onclick='displayMessage()']");
      await page.waitForTimeout(50);

      expect(messages.length).toBe(2);
      expect(messages[0]).toContain('Big-Omega Notation represents a lower bound');
      expect(messages[1]).toContain('Big-Omega Notation represents a lower bound');
    });
  });

  test.describe('Reset animation interactions (Reset_Click transitions)', () => {
    test('single Reset click resets line immediately then schedules re-animation (S0_Idle -> S2_AnimationReset)', async ({ page }) => {
      // This test validates the transition S0_Idle -> S2_AnimationReset:
      // Immediate style changes (height=0, opacity=0) should be applied synchronously.
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));

      const line = page.locator('.line');

      // Ensure starting state has completed initial animation so result is deterministic
      await page.waitForTimeout(3600);

      // Click Reset and immediately inspect inline style to verify immediate reset
      await page.click(".button[onclick='resetAnimation()']");

      // Give microtime for the function to run (it executes synchronously before setTimeout)
      await page.waitForTimeout(20);

      // Check inline style attributes that resetAnimation sets synchronously
      const inlineStyle = await line.getAttribute('style');
      expect(inlineStyle).toBeTruthy();
      expect(inlineStyle).toContain('height: 0');
      expect(inlineStyle).toContain('opacity: 0');

      // After the scheduled micro timeout (10ms), the animation should set height to '100%' and opacity to '1'
      await page.waitForTimeout(40); // small cushion beyond 10ms
      const finalInlineStyle = await line.getAttribute('style');
      expect(finalInlineStyle).toBeTruthy();
      expect(finalInlineStyle).toContain('height: 100%');
      expect(finalInlineStyle).toContain('opacity: 1');

      // Ensure no uncaught exceptions during reset
      expect(pageErrors.length).toBe(0);
    });

    test('double Reset click triggers the reset transition again (S2_AnimationReset -> S0_Idle)', async ({ page }) => {
      // This test exercises the FSM transition S2_AnimationReset -> S0_Idle by clicking Reset twice:
      // - First click triggers immediate reset and scheduled re-animation
      // - Second click (while in S2) should also re-trigger resetAnimation, ending with animated state (100%/1)
      const line = page.locator('.line');

      // Wait for initial animation to finish to start from a known state
      await page.waitForTimeout(3600);

      // First reset
      await page.click(".button[onclick='resetAnimation()']");
      await page.waitForTimeout(20);
      let styleAfterFirst = await line.getAttribute('style');
      expect(styleAfterFirst).toContain('height: 0');
      expect(styleAfterFirst).toContain('opacity: 0');

      // Click Reset again quickly (while in S2 phase). This should re-apply resetAnimation.
      await page.click(".button[onclick='resetAnimation()']");
      await page.waitForTimeout(20);
      let styleAfterSecond = await line.getAttribute('style');
      // Still immediate reset values
      expect(styleAfterSecond).toContain('height: 0');
      expect(styleAfterSecond).toContain('opacity: 0');

      // Wait for the scheduled animation to complete (post 10ms timeout)
      await page.waitForTimeout(50);
      const finalStyle = await line.getAttribute('style');
      expect(finalStyle).toContain('height: 100%');
      expect(finalStyle).toContain('opacity: 1');
    });
  });

  test.describe('Error scenarios and edge cases', () => {
    test('page emits a ReferenceError when calling an undefined function (observes pageerror)', async ({ page }) => {
      // Deliberately cause a ReferenceError in the page context asynchronously so it surfaces as a pageerror event.
      // We run the call inside setTimeout to avoid the evaluate promise rejecting (we want the page itself to throw).
      const errorPromise = page.waitForEvent('pageerror');
      await page.evaluate(() => {
        setTimeout(() => {
          // Intentionally call an undefined function to produce ReferenceError
          // This mirrors a real runtime error in page code and should be captured by pageerror.
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          nonExistentFunction();
        }, 0);
      });
      const err = await errorPromise;
      expect(err).toBeTruthy();
      // The exact wording can vary across engines; check for indication of undefined identifier
      expect(err.message).toMatch(/nonExistentFunction|not defined|is not defined/);
    });

    test('page emits a SyntaxError when evaluating malformed code (observes pageerror)', async ({ page }) => {
      const errorPromise = page.waitForEvent('pageerror');
      await page.evaluate(() => {
        setTimeout(() => {
          try {
            // Malformed eval to cause SyntaxError in the page environment
            // The SyntaxError will be uncaught and should emit a pageerror.
            eval(')');
          } catch (e) {
            // If the page captures it locally, rethrow to ensure it bubbles as an uncaught error.
            throw e;
          }
        }, 0);
      });
      const err = await errorPromise;
      expect(err).toBeTruthy();
      expect(err.message).toMatch(/Unexpected token|Unexpected end of input|SyntaxError/i);
    });

    test('page emits a TypeError for invalid operations (observes pageerror)', async ({ page }) => {
      const errorPromise = page.waitForEvent('pageerror');
      await page.evaluate(() => {
        setTimeout(() => {
          // Attempt to call null as a function to generate a TypeError
          const n = null;
          // This will throw: TypeError: n is not a function OR Cannot read properties of null
          n();
        }, 0);
      });
      const err = await errorPromise;
      expect(err).toBeTruthy();
      // Accept multiple possible phrasings across browser engines
      expect(err.message).toMatch(/not a function|Cannot read properties of null|Cannot read property/);
    });
  });
});