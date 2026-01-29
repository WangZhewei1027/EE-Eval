import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ab3dd3-fa78-11f0-812d-c9788050701f.html';

// Page Object Model for the Space Complexity Visualization page
class SpaceComplexityPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      animateBtn: '#animate-btn',
      constantBlock: '#constant-space .memory-block',
      linearBlock: '#linear-space .memory-block',
      quadraticBlock: '#quadratic-space .memory-block',
      complexityCards: '.complexity-card',
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async getButtonHandle() {
    return await this.page.$(this.selectors.animateBtn);
  }

  async getButtonText() {
    return await this.page.$eval(this.selectors.animateBtn, (b) => b.textContent);
  }

  async isButtonDisabled() {
    return await this.page.$eval(this.selectors.animateBtn, (b) => !!b.disabled);
  }

  async clickAnimate() {
    // Use page.click so events behave naturally (disabled state will prevent additional clicks)
    await this.page.click(this.selectors.animateBtn);
  }

  async getInlineHeight(selector) {
    // Return the inline style.height (e.g., '30%') as set in the element.style
    return await this.page.$eval(selector, (el) => el.style.height);
  }

  async getAllBlockHeights() {
    const { page } = this;
    const constant = await this.getInlineHeight(this.selectors.constantBlock);
    const linear = await this.getInlineHeight(this.selectors.linearBlock);
    const quadratic = await this.getInlineHeight(this.selectors.quadraticBlock);
    return { constant, linear, quadratic };
  }

  async wait(ms) {
    return await this.page.waitForTimeout(ms);
  }

  async waitForCardAnimations() {
    // Cards animate in with delays; ensure final opacity and transform applied
    // We wait a conservative amount for all three cards to animate in.
    await this.page.waitForTimeout(1000);
  }
}

test.describe('Space Complexity Visualization — FSM and UI behavior', () => {
  // Collect console and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (all levels)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.describe('Initial Idle State (S0_Idle)', () => {
    test('renders page and shows initial memory block heights and Animate button', async ({ page }) => {
      // Validate onEnter for Idle (renderPage() should have rendered elements)
      const app = new SpaceComplexityPage(page);
      await app.goto();

      // Ensure the complexity cards have finished their entrance animations before assertions
      await app.waitForCardAnimations();

      // The "Visualize Growth" button should exist, be enabled, and have expected text
      const btn = await app.getButtonHandle();
      expect(btn).not.toBeNull();
      const btnText = await app.getButtonText();
      expect(btnText).toBe('Visualize Growth');
      const disabled = await app.isButtonDisabled();
      expect(disabled).toBe(false);

      // Initial inline heights should match the HTML: 30%, 60%, 90%
      const heights = await app.getAllBlockHeights();
      expect(heights.constant).toBe('30%');
      expect(heights.linear).toBe('60%');
      expect(heights.quadratic).toBe('90%');

      // No uncaught page errors should have occurred during load
      // (We capture page errors and assert none are present.)
      expect(pageErrors.length).toBe(0);
      // Also assert no console errors of type 'error'
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Animating State (S1_Animating) and transition to Animated (S2_Animated)', () => {
    test('clicking animate triggers disabled button state and growth animation, then restores button', async ({ page }) => {
      const app = new SpaceComplexityPage(page);
      await app.goto();

      // Allow entrance animations for cards
      await app.waitForCardAnimations();

      // Sanity: initial state as before
      expect(await app.getButtonText()).toBe('Visualize Growth');

      // Click the animate button to trigger AnimateMemoryGrowth (transition S0 -> S1)
      await app.clickAnimate();

      // Immediately after click, evidence says btn.disabled = true; btn.textContent = 'Animating...'
      // Also animateMemoryGrowth resets block heights to '5%'
      // Check the immediate S1 state
      const immediateBtnText = await app.getButtonText();
      expect(immediateBtnText).toBe('Animating...');
      const immediateDisabled = await app.isButtonDisabled();
      expect(immediateDisabled).toBe(true);

      const immediateHeights = await app.getAllBlockHeights();
      // The implementation sets heights to '5%' synchronously before timeouts:
      expect(immediateHeights.constant).toBe('5%');
      expect(immediateHeights.linear).toBe('5%');
      expect(immediateHeights.quadratic).toBe('5%');

      // Wait a bit longer than the 100ms timeout used in animateMemoryGrowth to reach S2_Animated
      await app.wait(200);

      // Now the blocks should have grown to their target heights: 30%, 60%, 90%
      const afterHeights = await app.getAllBlockHeights();
      expect(afterHeights.constant).toBe('30%');
      expect(afterHeights.linear).toBe('60%');
      expect(afterHeights.quadratic).toBe('90%');

      // The final button re-enable occurs after an additional 1000ms inside animateMemoryGrowth
      await app.wait(1100);

      // After animation completes, button should be enabled and have original text (transition S2 -> S0 / AnimationReset)
      const finalBtnText = await app.getButtonText();
      expect(finalBtnText).toBe('Visualize Growth');
      const finalDisabled = await app.isButtonDisabled();
      expect(finalDisabled).toBe(false);

      // Ensure there were no uncaught errors emitted during this sequence
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Edge Cases and Error Scenarios', () => {
    test('rapid clicking should not cause additional state corruption or exceptions', async ({ page }) => {
      const app = new SpaceComplexityPage(page);
      await app.goto();

      // Allow entrance animations
      await app.waitForCardAnimations();

      // Simulate rapid user interactions: click multiple times in quick succession
      // The button becomes disabled instantly; subsequent clicks should be ignored naturally.
      // We perform clicks spaced very closely to attempt to cause race conditions.
      await page.click('#animate-btn'); // first click - should start animation
      // Attempt to click many times in quick succession; disabled state should block actual behavior
      for (let i = 0; i < 5; i++) {
        // Use evaluate to attempt to click programmatically to mimic aggressive user action.
        // Note: Clicking a disabled button does not fire events; this simply exercises the UI.
        await page.evaluate(() => {
          const btn = document.getElementById('animate-btn');
          try {
            btn.click();
          } catch (e) {
            // swallow any errors here — we will assert on pageerror events below
          }
        });
      }

      // Immediately ensure the button is disabled and text changed
      expect(await app.isButtonDisabled()).toBe(true);
      expect(await app.getButtonText()).toBe('Animating...');

      // Wait until the animation growth completes (100ms + 1000ms inside)
      await app.wait(1300);

      // After completion, ensure UI has returned to stable Idle state
      expect(await app.getButtonText()).toBe('Visualize Growth');
      expect(await app.isButtonDisabled()).toBe(false);

      // Ensure memory blocks are at expected target heights again
      const heights = await app.getAllBlockHeights();
      expect(heights.constant).toBe('30%');
      expect(heights.linear).toBe('60%');
      expect(heights.quadratic).toBe('90%');

      // Assert that no unhandled exceptions occurred during rapid interaction attempts
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('observes console and page errors during normal operation (expect none)', async ({ page }) => {
      // This test explicitly collects and asserts console/page errors are absent in normal flow.
      const app = new SpaceComplexityPage(page);
      await app.goto();
      await app.waitForCardAnimations();

      // Interact once to ensure no runtime failures occur
      await app.clickAnimate();
      await app.wait(1300);

      // Assert no page errors captured
      expect(pageErrors.length).toBe(0);

      // Assert no console error messages were emitted
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);

      // Additionally, capture any warnings (non-critical) and log their presence for visibility in test output
      const consoleWarnings = consoleMessages.filter((m) => m.type === 'warning');
      // We don't fail the test on warnings, but we assert that consoleMessages is an array (sanity)
      expect(Array.isArray(consoleMessages)).toBe(true);

      // If there are any console messages, ensure they are strings and non-empty
      for (const msg of consoleMessages) {
        expect(typeof msg.text).toBe('string');
      }
    });
  });
});