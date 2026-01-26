import { test, expect } from '@playwright/test';

// Test file for application: ed8e17d2-fa77-11f0-8492-31e949ed3c7c
// Served at: http://127.0.0.1:5500/workspace/0126-biased/html/ed8e17d2-fa77-11f0-8492-31e949ed3c7c.html
// This suite validates the FSM states and transitions for the Greedy Algorithms Visual Demo.
// Notes: Tests observe console messages and page errors without patching or modifying the app logic.

// Page Object for the demo
class DemoPage {
  constructor(page) {
    this.page = page;
    this.button = page.locator('.button');
    this.visual = page.locator('#algorithmVisual');
  }

  // Navigate to the demo URL
  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/0126-biased/html/ed8e17d2-fa77-11f0-8492-31e949ed3c7c.html', { waitUntil: 'load' });
  }

  // Click the start button
  async clickStart() {
    await this.button.click();
  }

  // Get inline style attribute of visual element
  async getInlineStyle() {
    return await this.visual.getAttribute('style');
  }

  // Get computed background-image CSS value for the visual element
  async getComputedBackgroundImage() {
    return await this.page.evaluate(selector => {
      const el = document.querySelector(selector);
      if (!el) return null;
      return window.getComputedStyle(el).backgroundImage;
    }, '#algorithmVisual');
  }

  // Check if a global function exists on window
  async hasGlobalStartDemo() {
    return await this.page.evaluate(() => typeof window.startDemo === 'function');
  }

  // Remove the visual element from DOM (used for edge case testing)
  async removeVisualFromDOM() {
    await this.page.evaluate(() => {
      const el = document.getElementById('algorithmVisual');
      if (el) el.remove();
    });
  }
}

// Suite-level setup
test.describe('Greedy Algorithms Visual Demo - FSM validation', () => {
  let consoleEvents;
  let pageErrors;
  let demo;

  test.beforeEach(async ({ page }) => {
    consoleEvents = [];
    pageErrors = [];

    // Observe console messages
    page.on('console', msg => {
      try {
        consoleEvents.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // Defensive: some console messages may throw on type() in older engines
        consoleEvents.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Observe uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    demo = new DemoPage(page);
    await demo.goto();
  });

  test.afterEach(async () => {
    // Basic invariant: tests should not produce unexpected console errors (pageErrors array is inspected per-test)
    // We don't fail globally here; individual tests make assertions about pageErrors as needed.
  });

  test.describe('Idle state (S0_Idle) tests', () => {
    test('renders initial page with Start Animation button and visual element', async () => {
      // Validate presence of button and visual DOM nodes - evidence of Idle state entry action renderPage()
      await expect(demo.button).toHaveCount(1);
      await expect(demo.button).toHaveText('Start Animation');
      await expect(demo.visual).toHaveCount(1);

      // The startDemo function should be defined on window (entry action is available)
      const hasStartDemo = await demo.hasGlobalStartDemo();
      expect(hasStartDemo).toBe(true);

      // The visual initial background-image should match the implementation's initial URL
      const bg = await demo.getComputedBackgroundImage();
      expect(bg).toBeTruthy();
      expect(bg).toContain('photo-1496824317831-0f536c01d5a3');

      // No uncaught page errors at initial render
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Animating state (S1_Animating) and transitions', () => {
    test('clicking Start Animation triggers the animation restart and schedules background update (S0 -> S1)', async ({ page }) => {
      // This test validates the transition from Idle to Animating: clicking the button invokes startDemo()
      // and eventually (after timeout) the visual backgroundImage changes per the FSM exit action.
      // Ensure initial state background is the original image
      const initialBg = await demo.getComputedBackgroundImage();
      expect(initialBg).toContain('photo-1496824317831-0f536c01d5a3');

      // Click the Start Animation button to invoke startDemo()
      await demo.clickStart();

      // Immediately after the click, the inline style for animation is set to '' by the function (end state).
      // We assert that the inline style exists (may be empty or not contain animation).
      const inlineStyle = await demo.getInlineStyle();
      // Inline style may be null or empty string depending on browser; just assert it's a string or null (no crash)
      expect(typeof inlineStyle === 'string' || inlineStyle === null).toBe(true);

      // Wait for the scheduled timeout that changes the background image (1500ms in implementation).
      // Use waitForFunction to poll until background-image contains the expected target fragment.
      const targetFragment = 'photo-1521645469030-8303bc6ff0d2';
      await page.waitForFunction((selector, fragment) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        const bg = window.getComputedStyle(el).backgroundImage || '';
        return bg.indexOf(fragment) !== -1;
      }, '#algorithmVisual', targetFragment, { timeout: 3000 });

      // Verify the background image has changed to the new URL fragment
      const changedBg = await demo.getComputedBackgroundImage();
      expect(changedBg).toContain(targetFragment);

      // No uncaught page errors should have occurred during normal operation
      expect(pageErrors.length).toBe(0);
    });

    test('multiple rapid clicks should still end with the visual background updated and no crashes', async ({ page }) => {
      // Click multiple times rapidly to schedule multiple timeouts; final background should still be updated.
      await demo.clickStart();
      await demo.clickStart();
      await demo.clickStart();

      // Wait for the last scheduled timeout to apply - allow a small cushion beyond 1500ms
      const targetFragment = 'photo-1521645469030-8303bc6ff0d2';
      await page.waitForFunction((selector, fragment) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        return (window.getComputedStyle(el).backgroundImage || '').indexOf(fragment) !== -1;
      }, '#algorithmVisual', targetFragment, { timeout: 4000 });

      const finalBg = await demo.getComputedBackgroundImage();
      expect(finalBg).toContain(targetFragment);

      // Ensure no uncaught errors were produced by multiple invokes
      expect(pageErrors.length).toBe(0);
    });

    test('startDemo sets inline animation to none then clears it (verify final inline state)', async () => {
      // The function sets visual.style.animation = 'none' then ''.
      // After the click completes, inline style.animation should be '' (empty string) or not defined.
      await demo.clickStart();

      // Small wait to allow synchronous function to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      // Evaluate the inline style.animation specifically
      const inlineAnimation = await demo.page.evaluate(() => {
        const el = document.getElementById('algorithmVisual');
        if (!el) return null;
        return el.style.animation;
      });

      // After the function finishes, animation inline style is set to empty string (''), or possibly an empty value.
      // Assert that it is either '' or null (if attribute removed). This verifies the function executed exit steps.
      expect(inlineAnimation === '' || inlineAnimation === null).toBe(true);

      // No page errors expected in successful run
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('calling startDemo when visual element is missing should produce a page error (TypeError)', async ({ page }) => {
      // Remove the visual element from the DOM to create a scenario where startDemo will try to access .style on null.
      await demo.removeVisualFromDOM();

      // Prepare to capture a single page error event
      let caughtError = null;
      const errorPromise = new Promise(resolve => {
        const handler = (err) => {
          caughtError = err;
          // remove listener to avoid leaking between tests
          page.removeListener('pageerror', handler);
          resolve(err);
        };
        page.on('pageerror', handler);
      });

      // Click the Start Animation button which will call startDemo() and should throw inside page context
      await demo.clickStart();

      // Wait up to 2 seconds for the pageerror event to fire
      await Promise.race([errorPromise, new Promise(resolve => setTimeout(resolve, 2000))]);

      // Assert that an error was captured
      expect(caughtError).not.toBeNull();
      // The error should be an Error object with a message referencing inability to read 'style' on null (browser messages vary)
      expect(typeof caughtError.message).toBe('string');
      // Ensure it mentions 'style' or 'null' which indicates the expected null dereference
      const msgLower = caughtError.message.toLowerCase();
      expect(msgLower.includes('style') || msgLower.includes('null') || msgLower.includes('cannot')).toBe(true);
    });

    test('no unexpected console.error messages during normal interactions', async ({ page }) => {
      // Reset consoleEvents capture and run a standard interaction
      consoleEvents = [];
      await demo.clickStart();

      // Wait for background update timeout to complete
      const targetFragment = 'photo-1521645469030-8303bc6ff0d2';
      await page.waitForFunction((selector, fragment) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        return (window.getComputedStyle(el).backgroundImage || '').indexOf(fragment) !== -1;
      }, '#algorithmVisual', targetFragment, { timeout: 3500 });

      // Gather console.error entries
      const errors = consoleEvents.filter(c => c.type === 'error' || c.type === 'warning');
      // There should be no console error/warning messages in normal operation
      expect(errors.length).toBe(0);
      // No uncaught page errors either
      expect(pageErrors.length).toBe(0);
    });
  });
});