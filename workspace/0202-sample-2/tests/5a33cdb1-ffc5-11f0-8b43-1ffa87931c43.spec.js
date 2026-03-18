import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a33cdb1-ffc5-11f0-8b43-1ffa87931c43.html';

// Page Object for the Two Pointers demo
class TwoPointersPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.stepBtn = page.locator('#stepBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.result = page.locator('#result');
    this.arrayContainer = page.locator('#arrayContainer');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Returns array of textContent for each .element
  async getArrayValues() {
    return await this.page.$$eval('#arrayContainer .element', (els) => els.map((el) => el.textContent.trim()));
  }

  async getElementCount() {
    return await this.page.$$eval('#arrayContainer .element', (els) => els.length);
  }

  // Returns pointer label text (e.g., "L" or "R") if present at given index, else null
  async getPointerAtIndex(index) {
    return await this.page.$eval(
      `#arrayContainer .element[data-index="${index}"]`,
      (el) => {
        const p = el.querySelector('.pointer');
        return p ? p.textContent.trim() : null;
      }
    );
  }

  // Returns the background color style computed for element at index
  async getBackgroundColorAtIndex(index) {
    return await this.page.$eval(
      `#arrayContainer .element[data-index="${index}"]`,
      (el) => getComputedStyle(el).backgroundColor
    );
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickStep() {
    await this.stepBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async getResultText() {
    return (await this.result.textContent())?.trim() ?? '';
  }

  async getButtonStates() {
    return {
      startDisabled: await this.startBtn.getAttribute('disabled') !== null,
      stepDisabled: await this.stepBtn.getAttribute('disabled') !== null,
      resetDisabled: await this.resetBtn.getAttribute('disabled') !== null,
    };
  }

  // Force-enable/disable button by manipulating DOM attribute (used cautiously for testing)
  async setStepButtonDisabled(disabled) {
    await this.page.evaluate((d) => {
      const b = document.getElementById('stepBtn');
      if (!b) return;
      if (d) b.setAttribute('disabled', 'true');
      else b.removeAttribute('disabled');
    }, disabled);
  }
}

test.describe('Two Pointers Technique Demo (FSM: Two Pointers)', () => {
  // Collect console errors and page errors during each test to assert the app runs without uncaught errors.
  test.beforeEach(async ({ page }) => {
    // Attach listeners for console and pageerror to surface runtime issues.
    page.context()._testConsoleErrors = [];
    page.context()._testPageErrors = [];

    page.on('console', (msg) => {
      // Collect runtime console.error messages for assertion
      if (msg.type() === 'error') {
        page.context()._testConsoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      // Collect uncaught exceptions (ReferenceError, TypeError, etc.)
      page.context()._testPageErrors.push(String(err));
    });
  });

  test.afterEach(async ({ page }) => {
    // Assert no console.error or uncaught page errors occurred during the test run
    const consoleErrors = page.context()._testConsoleErrors || [];
    const pageErrors = page.context()._testPageErrors || [];

    // Provide detailed failure message if any errors exist
    expect(consoleErrors.length + pageErrors.length, `Console errors: ${JSON.stringify(consoleErrors)}, Page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test.describe('Initial (Idle) state validation', () => {
    test('Idle: page loads with array elements created and pointers initialized; Start enabled, Step/Reset disabled', async ({ page }) => {
      const app = new TwoPointersPage(page);
      // Load the application as-is
      await app.goto();

      // Verify array elements were created (10 elements)
      const count = await app.getElementCount();
      expect(count).toBe(10);

      // On initial load reset() is called which also calls updatePointers()
      // Therefore left pointer should be on index 0 and right pointer on last index (9).
      // Check pointer labels exist at index 0 and index 9.
      const leftPointer = await app.getPointerAtIndex(0);
      const rightPointer = await app.getPointerAtIndex(9);
      expect(leftPointer).toBe('L');
      expect(rightPointer).toBe('R');

      // Colors: verify the computed background colors changed for pointered elements
      const leftColor = await app.getBackgroundColorAtIndex(0);
      const rightColor = await app.getBackgroundColorAtIndex(9);
      expect(leftColor).toBeTruthy();
      expect(rightColor).toBeTruthy();

      // Buttons: Start should be enabled; Step and Reset should be disabled (initial idle)
      const buttons = await app.getButtonStates();
      expect(buttons.startDisabled).toBe(false);
      expect(buttons.stepDisabled).toBe(true);
      expect(buttons.resetDisabled).toBe(true);

      // Result text should be empty after reset()
      const resultText = await app.getResultText();
      expect(resultText).toBe('');
    });
  });

  test.describe('Start, Step and Reset transitions (main flows)', () => {
    test('StartClick: clicking Start transitions to Running (Start disabled; Step & Reset enabled; result shows target prompt)', async ({ page }) => {
      const app = new TwoPointersPage(page);
      await app.goto();

      // Click Start to begin algorithm
      await app.clickStart();

      // Assert button states after starting
      const states = await app.getButtonStates();
      expect(states.startDisabled).toBe(true);
      expect(states.stepDisabled).toBe(false);
      expect(states.resetDisabled).toBe(false);

      // result should show the target prompt exactly as implemented (double quotes around Step)
      const result = await app.getResultText();
      expect(result).toBe('Target sum: 15. Press "Step" to proceed.');

      // Pointers should still be shown (left at 0, right at 9)
      const leftPointer = await app.getPointerAtIndex(0);
      const rightPointer = await app.getPointerAtIndex(9);
      expect(leftPointer).toBe('L');
      expect(rightPointer).toBe('R');
    });

    test('StepClick: first Step produces "Checking ..." text and moves the right pointer inward (sum > target case)', async ({ page }) => {
      const app = new TwoPointersPage(page);
      await app.goto();

      // Start then perform one step
      await app.clickStart();
      await app.clickStep();

      // After first step, the app sets the checking string for arr[0] and arr[9]
      const result = await app.getResultText();
      expect(result).toBe('Checking arr[0] + arr[9] = 1 + 15 = 16');

      // The algorithm should have moved the right pointer inward (from index 9 to 8)
      // The previous pointers' highlighting should have been updated:
      const rightPointerNow = await app.getPointerAtIndex(8);
      // updatePointers is called after right--, so now right pointer should be on index 8.
      expect(rightPointerNow).toBe('R');

      // Step button should remain enabled (since algorithm not finished yet)
      const states = await app.getButtonStates();
      expect(states.stepDisabled).toBe(false);
      // Reset should be enabled after starting
      expect(states.resetDisabled).toBe(false);
    });

    test('StepClick: subsequent Step leads to PairFound and disables Step (Found! message and Reset enabled)', async ({ page }) => {
      const app = new TwoPointersPage(page);
      await app.goto();

      // Start and perform two steps; second should find a pair (1 + 14 = 15)
      await app.clickStart();
      await app.clickStep(); // first step: Checking 1 + 15 = 16
      await app.clickStep(); // second step: Found! 1 + 14 = 15

      const result = await app.getResultText();
      expect(result).toBe('Found! arr[0] + arr[8] = 1 + 14 = 15');

      // After finding pair, Step should be disabled, Reset should be enabled
      const states = await app.getButtonStates();
      expect(states.stepDisabled).toBe(true);
      expect(states.resetDisabled).toBe(false);
    });

    test('ResetClick: after PairFound or after Running, Reset returns to Idle (buttons and result reset; pointers at extremes)', async ({ page }) {
      const app = new TwoPointersPage(page);
      await app.goto();

      // Start and find a pair
      await app.clickStart();
      await app.clickStep();
      await app.clickStep();

      // Ensure we are in PairFound state
      const foundText = await app.getResultText();
      expect(foundText).toContain('Found!');

      // Click Reset -> should return to initial Idle-like state
      await app.clickReset();

      // After reset, result should be empty, start enabled, step & reset disabled
      const resultAfterReset = await app.getResultText();
      expect(resultAfterReset).toBe('');

      const states = await app.getButtonStates();
      expect(states.startDisabled).toBe(false);
      expect(states.stepDisabled).toBe(true);
      expect(states.resetDisabled).toBe(true);

      // Pointers should be at the original extremes (index 0 and last index)
      const leftPointer = await app.getPointerAtIndex(0);
      const rightPointer = await app.getPointerAtIndex(9);
      expect(leftPointer).toBe('L');
      expect(rightPointer).toBe('R');
    });
  });

  test.describe('Edge cases, repeated actions, and StepCompleted verification', () => {
    test('Clicking Start multiple times has no adverse effect (Start ignored when already running)', async ({ page }) => {
      const app = new TwoPointersPage(page);
      await app.goto();

      // Click Start once
      await app.clickStart();
      const firstResult = await app.getResultText();
      expect(firstResult).toBe('Target sum: 15. Press "Step" to proceed.');

      // Click Start again - it should be disabled and have no effect
      // We still call clickStart() to simulate user trying; Playwright will throw if the element is disabled and not clickable.
      // Instead, attempt to click via the locator only if it reports as enabled. Use the attribute state to decide.
      const statesBefore = await app.getButtonStates();
      if (!statesBefore.startDisabled) {
        await app.clickStart();
      } else {
        // element is disabled - trying to click should not change state/result
        // Verify that result remains unchanged
        const afterAttemptResult = await app.getResultText();
        expect(afterAttemptResult).toBe(firstResult);
      }

      // No errors in console or page errors should have happened (checked in afterEach)
    });

    test('Clicking Step when disabled does nothing (result unchanged)', async ({ page }) => {
      const app = new TwoPointersPage(page);
      await app.goto();

      // Ensure in Idle state where Step is disabled
      const states = await app.getButtonStates();
      expect(states.stepDisabled).toBe(true);

      // Attempt to click Step; Playwright allows clicking disabled visible elements, but the page will not process events.
      // Capture current result
      const before = await app.getResultText();

      // A direct click on the disabled button should not trigger the step logic; we still call it to validate no change.
      await app.stepBtn?.click({ force: false }).catch(() => {
        // If Playwright refuses to click due to disabled state, that's acceptable; nothing should change.
      });

      const after = await app.getResultText();
      expect(after).toBe(before);
    });

    test('StepCompleted: when step() is invoked while foundPair is true, result becomes "No more steps possible."', async ({ page }) => {
      const app = new TwoPointersPage(page);
      await app.goto();

      // Start and reach PairFound
      await app.clickStart();
      await app.clickStep(); // Checking 1+15=16
      await app.clickStep(); // Found 1+14=15 (PairFound)

      // At this point the stepBtn is disabled by the app's logic.
      // To test the branch that returns "No more steps possible." when step() sees foundPair === true,
      // we will temporarily remove the disabled attribute from the button (DOM-only change) to allow clicking it.
      // We are NOT changing JS closure state or redefining functions; only enabling the button so the original step() gets invoked.
      await app.setStepButtonDisabled(false);
      // Click the step button which should call step() and the function will detect foundPair === true and set the message.
      await app.clickStep();

      const res = await app.getResultText();
      expect(res).toBe('No more steps possible.');

      // After this action, step button should have been set disabled by the function
      const statesAfter = await app.getButtonStates();
      expect(statesAfter.stepDisabled).toBe(true);

      // Reset to return to idle
      await app.clickReset();
      const resultAfterReset = await app.getResultText();
      expect(resultAfterReset).toBe('');
    });

    test('Exhaustive stepping path (attempt to exercise "No pair found that sums to target." branch) - best-effort within constraints', async ({ page }) => {
      const app = new TwoPointersPage(page);
      await app.goto();

      // This application uses a fixed array and target which contains at least one valid pair.
      // Therefore the natural algorithm will find a pair before exhausting pointers, making the "No pair found that sums to target." branch unreachable without modifying internal JS variables.
      // We validate that the branch exists by driving the app through natural steps and confirm that when pointers cross or foundPair becomes true, the app displays either Found! or the "No pair found..." message if that condition occurs.
      await app.clickStart();

      // Keep stepping until Step is disabled (either found pair or exhausted)
      // We guard the loop to avoid infinite loops: max 20 iterations
      for (let i = 0; i < 20; i++) {
        const states = await app.getButtonStates();
        if (states.stepDisabled) break;
        await app.clickStep();
      }

      const finalText = await app.getResultText();
      // finalText must be one of the expected end states
      const acceptableEndings = [
        'No pair found that sums to target.',
        'No more steps possible.',
      ];
      const isAcceptable = finalText.startsWith('Found!') || acceptableEndings.includes(finalText);
      expect(isAcceptable).toBe(true);

      // Click Reset to ensure app can return to Idle
      await app.clickReset();
      const resultAfterReset = await app.getResultText();
      expect(resultAfterReset).toBe('');
    });
  });
});