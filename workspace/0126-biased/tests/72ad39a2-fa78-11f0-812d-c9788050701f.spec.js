import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ad39a2-fa78-11f0-812d-c9788050701f.html';

/**
 * Page object for the Dynamic Typing demo page.
 * Encapsulates selectors and common actions to keep tests readable.
 */
class DynamicTypingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.restartBtn = page.locator('#restartBtn');
    this.dynamicLines = page.locator('.dynamic-line');
    this.typeVisuals = page.locator('.type-visual');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getButtonText() {
    return (await this.restartBtn.textContent())?.trim();
  }

  async isButtonDisabled() {
    return await this.restartBtn.evaluate((btn) => btn.disabled);
  }

  async clickRestart() {
    await this.restartBtn.click();
  }

  async getDynamicLineInlineStyles() {
    return this.dynamicLines.evaluateAll((els) =>
      els.map((el) => ({
        text: el.textContent?.trim(),
        opacity: el.style.opacity,
        transform: el.style.transform,
        animation: el.style.animation,
      }))
    );
  }

  async getTypeVisualInlineStyles() {
    return this.typeVisuals.evaluateAll((els) =>
      els.map((el) => ({
        text: el.textContent?.trim(),
        opacity: el.style.opacity,
        transform: el.style.transform,
        animation: el.style.animation,
      }))
    );
  }

  async countDynamicLines() {
    return await this.dynamicLines.count();
  }

  async countTypeVisuals() {
    return await this.typeVisuals.count();
  }
}

test.describe('Dynamic Typing Visualization - FSM validations', () => {
  // Collect console messages and page errors for assertions related to runtime errors
  /** @type {Array<{type:string,text:string,timestamp:number}>} */
  let consoleMessages;
  /** @type {Array<Error>} */
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console events and store them
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now(),
      });
    });

    // Listen to uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.describe('State S0_Idle (Initial)', () => {
    test('S0_Idle: page loads and shows the Replay Animation button (initial state)', async ({ page }) => {
      // Arrange
      const demo = new DynamicTypingPage(page);

      // Act
      await demo.goto();

      // Assert: The button exists and shows the expected initial text
      await expect(demo.restartBtn).toBeVisible();
      const text = await demo.getButtonText();
      expect(text).toBe('Replay Animation');

      // Assert: Button should be enabled in Idle state
      const disabled = await demo.isButtonDisabled();
      expect(disabled).toBe(false);

      // Assert: Basic visual components are present
      await expect(page.locator('.code-block')).toBeVisible();
      expect(await demo.countDynamicLines()).toBeGreaterThan(0);
      expect(await demo.countTypeVisuals()).toBeGreaterThan(0);

      // Assert: There should be no uncaught page errors on load.
      // The application is not expected to throw ReferenceError/SyntaxError/TypeError on load.
      expect(pageErrors.length).toBe(0);

      // Also ensure no console.error calls were emitted during load.
      const consoleErrorCount = consoleMessages.filter((m) => m.type === 'error').length;
      expect(consoleErrorCount).toBe(0);
    });
  });

  test.describe('Transitions and Animations (S0 -> S1 -> S2 -> S0)', () => {
    test('S0 -> S1: Clicking Replay Animation enters Animating state (button shows "Animating..." and disables)', async ({ page }) => {
      // This test validates the immediate effects of the click: entry into S1.
      const demo = new DynamicTypingPage(page);
      await demo.goto();

      // Ensure initial state
      expect(await demo.getButtonText()).toBe('Replay Animation');
      expect(await demo.isButtonDisabled()).toBe(false);

      // Click to start animation
      await demo.clickRestart();

      // Immediately after click, button text should switch to "Animating..." and be disabled.
      // Using a short timeout to allow DOM updates to flush.
      await page.waitForTimeout(50);
      const btnText = await demo.getButtonText();
      expect(btnText).toBe('Animating...');
      expect(await demo.isButtonDisabled()).toBe(true);

      // The click handler resets animations by setting inline styles on .dynamic-line and .type-visual.
      // Verify that inline styles were applied (opacity = '0' and transform includes translateY)
      const lineStyles = await demo.getDynamicLineInlineStyles();
      expect(lineStyles.length).toBeGreaterThan(0);
      // At least one dynamic line should have inline opacity '0' and transform including 'translateY(20px)'
      const foundResetLine = lineStyles.some((s) => s.opacity === '0' && s.transform.includes('translateY(20px)'));
      expect(foundResetLine).toBe(true);

      // Verify that type visuals also got their inline styles reset
      const visualStyles = await demo.getTypeVisualInlineStyles();
      expect(visualStyles.length).toBeGreaterThan(0);
      const foundResetVisual = visualStyles.some((s) => s.opacity === '0' && s.transform.includes('scale(0)'));
      expect(foundResetVisual).toBe(true);

      // Verify no unexpected runtime errors occurred immediately after clicking
      const recentPageErrors = pageErrors.filter((e) => e.message && Date.now() - (e?.timeStamp || Date.now()) < 2000);
      // There should be no uncaught exceptions triggered by clicking
      expect(recentPageErrors.length).toBe(0);

      // And no console.error calls
      const recentConsoleErrors = consoleMessages.filter((m) => m.type === 'error' && Date.now() - m.timestamp < 2000);
      expect(recentConsoleErrors.length).toBe(0);
    });

    test('S1 -> S2: After animation delay the button shows "Animation Complete" (final animation state)', async ({ page }) => {
      // This test validates the transition into the Animation Complete state (S2) after the animation replay.
      const demo = new DynamicTypingPage(page);
      await demo.goto();

      // Start animation
      await demo.clickRestart();

      // The code sets a setTimeout(() => { ... }, 300) before setting 'Animation Complete'.
      // Wait a bit longer to be robust against scheduling variability.
      await page.waitForTimeout(600);

      // After that timeout, text should be 'Animation Complete'
      const midText = await demo.getButtonText();
      expect(midText).toBe('Animation Complete');

      // During S2, the button remains disabled until it transitions back to S0
      expect(await demo.isButtonDisabled()).toBe(true);

      // Visual verification: the type-visual elements exist and contain expected short labels
      const visuals = page.locator('.type-visual');
      await expect(visuals.first()).toBeVisible();
      const labels = await visuals.allTextContents();
      // We expect the visuals to include 'str', 'num', 'bool', '?'
      const expectedLabels = ['str', 'num', 'bool', '?'];
      expectedLabels.forEach((lbl) => {
        expect(labels.some((t) => t.includes(lbl))).toBe(true);
      });

      // Check that no uncaught page errors occurred during the animation completion
      expect(pageErrors.length).toBe(0);
      const consoleErrorCount = consoleMessages.filter((m) => m.type === 'error').length;
      expect(consoleErrorCount).toBe(0);
    });

    test('S2 -> S0: After completion the button returns to "Replay Animation" and is re-enabled', async ({ page }) => {
      // This test validates the final transition back to Idle (S0).
      const demo = new DynamicTypingPage(page);
      await demo.goto();

      // Start animation
      await demo.clickRestart();

      // Wait until the 'Animation Complete' text appears (safe upper bound)
      await page.waitForTimeout(600);
      expect(await demo.getButtonText()).toBe('Animation Complete');

      // The reset to 'Replay Animation' happens after another 1000ms inside the handler.
      // Wait sufficiently long to allow the full cycle to finish.
      await page.waitForTimeout(1200);

      // Now button should be back to Idle state label and enabled
      const finalText = await demo.getButtonText();
      expect(finalText).toBe('Replay Animation');

      const finalDisabled = await demo.isButtonDisabled();
      expect(finalDisabled).toBe(false);

      // Ensure dynamic lines and type visuals are present and did not vanish
      expect(await demo.countDynamicLines()).toBeGreaterThan(0);
      expect(await demo.countTypeVisuals()).toBeGreaterThan(0);

      // Confirm there are no uncaught page errors throughout the whole lifecycle
      expect(pageErrors.length).toBe(0);
      const consoleErrorCount = consoleMessages.filter((m) => m.type === 'error').length;
      expect(consoleErrorCount).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Click while disabled should not change the state (ignored interaction)', async ({ page }) => {
      // Validate that attempting to click while the component is in the Animating state does not produce unexpected state changes.
      const demo = new DynamicTypingPage(page);
      await demo.goto();

      // Trigger the animation and quickly attempt a second click
      await demo.clickRestart();

      // Immediately after first click the button should be disabled
      await page.waitForTimeout(10);
      expect(await demo.isButtonDisabled()).toBe(true);
      expect(await demo.getButtonText()).toBe('Animating...');

      // Attempt to click again while disabled. Playwright will attempt the click; the page's logic should ignore it.
      // We do not intercept or patch the page; we allow the click to be dispatched naturally.
      // If the browser prevents events for disabled button elements, Playwright click may still succeed or be a no-op.
      try {
        await demo.clickRestart();
      } catch (err) {
        // Some browsers may throw when attempting to click a disabled element; treat this as acceptable (no state change).
      }

      // Allow a very short time to ensure no additional changes happen immediately as a result of the second click attempt.
      await page.waitForTimeout(50);

      // The button text should remain in the Animating state until the handler's timeout completes.
      expect(await demo.getButtonText()).toBe('Animating...');
      expect(await demo.isButtonDisabled()).toBe(true);

      // Wait for the full cycle to complete to ensure no lingering side effects
      await page.waitForTimeout(2000);
      // After full cycle, it should end back in Idle.
      expect(await demo.getButtonText()).toBe('Replay Animation');
      expect(await demo.isButtonDisabled()).toBe(false);

      // No uncaught exceptions or console errors should have occurred during this edge-case interaction.
      expect(pageErrors.length).toBe(0);
      const consoleErrorCount = consoleMessages.filter((m) => m.type === 'error').length;
      expect(consoleErrorCount).toBe(0);
    });

    test('Rapid multiple clicks before disabling should result in a single animation cycle (debounce behavior)', async ({ page }) => {
      // This test simulates a user rapidly clicking the button multiple times in quick succession.
      // The implementation sets disabled immediately on click, so subsequent clicks should not spawn multiple overlapping cycles.
      const demo = new DynamicTypingPage(page);
      await demo.goto();

      // Rapidly issue multiple click attempts (they will effectively be the same as a single click due to immediate disable)
      const clickPromises = [];
      for (let i = 0; i < 5; i++) {
        // Using Promise.resolve to interleave clicks rapidly
        clickPromises.push((async () => {
          try {
            await demo.clickRestart();
          } catch (e) {
            // If clicking a disabled element throws, ignore
          }
        })());
      }
      await Promise.all(clickPromises);

      // Wait for the animation to complete
      await page.waitForTimeout(2000);

      // Final state should be Idle, not some corrupted intermediate
      expect(await demo.getButtonText()).toBe('Replay Animation');
      expect(await demo.isButtonDisabled()).toBe(false);

      // No uncaught exceptions or console errors
      expect(pageErrors.length).toBe(0);
      const consoleErrorCount = consoleMessages.filter((m) => m.type === 'error').length;
      expect(consoleErrorCount).toBe(0);
    });
  });

  test.afterEach(async ({ page }) => {
    // Attach collected debug information to the test output if anything unexpected happened.
    if (pageErrors.length > 0) {
      // Print errors to test output (Playwright will surface console output)
      // Note: We do not modify runtime or try to fix errors; we only observe and fail/assert based on them above.
      // eslint-disable-next-line no-console
      console.error('Captured page errors:', pageErrors);
    }
    const errors = consoleMessages.filter((m) => m.type === 'error');
    if (errors.length > 0) {
      // eslint-disable-next-line no-console
      console.error('Captured console.error messages:', errors);
    }
  });
});