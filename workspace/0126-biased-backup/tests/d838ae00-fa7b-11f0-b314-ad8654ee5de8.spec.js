import { test, expect } from '@playwright/test';

// Test file: d838ae00-fa7b-11f0-b314-ad8654ee5de8.spec.js
// This suite validates the FSM-driven behavior of the demo toggle on the provided HTML page.
// It checks initial state (S0_Idle), transition to Demo Visible (S1_DemoVisible) and back,
// verifies DOM attributes, visual visibility, text changes, and observes console/page errors.
// The tests intentionally load the page as-is and only observe runtime behavior without patching code.

// Page object for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/d838ae00-fa7b-11f0-b314-ad8654ee5de8.html';
    this.button = page.locator('#demoButton');
    this.demo = page.locator('#demo');
  }

  async load() {
    await this.page.goto(this.url);
    // Wait for the main content to ensure the static content has rendered.
    await this.page.locator('.container').waitFor({ state: 'visible' });
  }

  async clickButton() {
    await this.button.click();
  }

  async pressButtonEnter() {
    await this.button.focus();
    await this.page.keyboard.press('Enter');
  }

  async getButtonText() {
    return await this.button.textContent();
  }

  async getButtonAriaExpanded() {
    return await this.button.getAttribute('aria-expanded');
  }

  async getDemoAriaHidden() {
    return await this.demo.getAttribute('aria-hidden');
  }

  async demoHasHideClass() {
    const classAttr = await this.demo.getAttribute('class');
    return typeof classAttr === 'string' && classAttr.split(/\s+/).includes('hide');
  }

  async isDemoVisible() {
    // Playwright's isVisible accounts for display:none, visibility:hidden, opacity, etc.
    return await this.demo.isVisible();
  }

  async getDemoStyle() {
    return await this.demo.getAttribute('style');
  }

  async clickDemoArea() {
    await this.demo.click();
  }
}

test.describe('FSM: Query Optimization Demo Toggle (d838ae00-fa7b-11f0-b314-ad8654ee5de8)', () => {
  // Collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Observe console events
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Observe uncaught page errors
    page.on('pageerror', (err) => {
      // Capture the error object message for assertions
      pageErrors.push(String(err && err.message ? err.message : err));
    });
  });

  test.afterEach(async ({ page }) => {
    // A small extra check: if there were page errors, print them to Node console for debugging context.
    if (pageErrors.length > 0) {
      // Note: This will not modify page behavior; it simply logs to test runner output.
      // Tests below assert on these arrays as needed.
      // eslint-disable-next-line no-console
      console.error('Captured page errors:', pageErrors);
    }
    if (consoleMessages.length > 0) {
      // eslint-disable-next-line no-console
      console.log('Captured console messages:', consoleMessages);
    }
    // Ensure any remaining network or activity finishes before teardown
    await page.waitForTimeout(10);
  });

  test.describe('Initial state (S0_Idle) and rendering', () => {
    test('Initial render shows button and demo is hidden (S0_Idle entry_actions: renderPage())', async ({ page }) => {
      // This test validates the entry state: button text, aria attributes, and demo hidden state.
      const dp = new DemoPage(page);
      await dp.load();

      // Validate the button exists and has expected text and aria attribute
      await expect(dp.button).toBeVisible();
      const btnText = await dp.getButtonText();
      expect(btnText && btnText.trim()).toBe('Show demonstration: 3-table join enumeration');

      const ariaExpanded = await dp.getButtonAriaExpanded();
      expect(ariaExpanded).toBe('false');

      // Validate demo div is present but hidden and has aria-hidden true
      await expect(dp.demo).toHaveCount(1);
      const demoHidden = await dp.demoHasHideClass();
      expect(demoHidden).toBe(true);

      const demoAriaHidden = await dp.getDemoAriaHidden();
      expect(demoAriaHidden).toBe('true');

      // Also check inline style exists as in the provided HTML
      const style = await dp.getDemoStyle();
      expect(style).toContain('margin-top:12px');

      // No runtime page errors should have occurred during initial load for a correct implementation
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Transition events (ClickDemoButton) and states', () => {
    test('Clicking the button reveals the demo (S0_Idle -> S1_DemoVisible) and updates ARIA/text', async ({ page }) => {
      // This test validates the forward transition and onEnter effects: toggling hide, aria, and button text.
      const dp = new DemoPage(page);
      await dp.load();

      // Click to reveal
      await dp.clickButton();

      // The demo should now be visible (no hide class, aria-hidden false)
      const demoVisible = await dp.isDemoVisible();
      expect(demoVisible).toBe(true);

      const demoHasHide = await dp.demoHasHideClass();
      expect(demoHasHide).toBe(false);

      const demoAriaHidden = await dp.getDemoAriaHidden();
      expect(demoAriaHidden).toBe('false');

      // Button should show 'Hide demonstration' and aria-expanded true
      const btnText = await dp.getButtonText();
      expect(btnText && btnText.trim()).toBe('Hide demonstration');

      const ariaExpanded = await dp.getButtonAriaExpanded();
      expect(ariaExpanded).toBe('true');

      // The demo content should contain the example's heading and at least one demo-step element
      await expect(page.locator('#demo .example h3')).toHaveText('Example SQL');
      await expect(page.locator('#demo .demo-step')).toHaveCountGreaterThan(0);

      // Ensure no page errors occurred as a result of the click handler executing
      expect(pageErrors).toEqual([]);
    });

    test('Clicking again hides the demo (S1_DemoVisible -> S0_Idle) and restores ARIA/text', async ({ page }) => {
      // Validates reverse transition and exit actions resulting from second click.
      const dp = new DemoPage(page);
      await dp.load();

      // Reveal then hide
      await dp.clickButton();
      await dp.clickButton();

      // The demo should be hidden again
      const demoVisible = await dp.isDemoVisible();
      expect(demoVisible).toBe(false);

      const demoHasHide = await dp.demoHasHideClass();
      expect(demoHasHide).toBe(true);

      const demoAriaHidden = await dp.getDemoAriaHidden();
      expect(demoAriaHidden).toBe('true');

      // Button should revert to original text and aria-expanded false
      const btnText = await dp.getButtonText();
      expect(btnText && btnText.trim()).toBe('Show demonstration: 3-table join enumeration');

      const ariaExpanded = await dp.getButtonAriaExpanded();
      expect(ariaExpanded).toBe('false');

      // Ensure no page errors occurred during toggling
      expect(pageErrors).toEqual([]);
    });

    test('Rapid repeated clicks toggle the demo predictably (odd -> visible, even -> hidden)', async ({ page }) => {
      // Edge-case testing: multiple quick toggles to ensure internal state doesn't get corrupted.
      const dp = new DemoPage(page);
      await dp.load();

      // Perform 5 rapid clicks
      for (let i = 0; i < 5; i++) {
        // Intentionally do not await any JS in page; rely on click promises.
        await dp.clickButton();
      }

      // After 5 clicks (odd), demo should be visible
      expect(await dp.isDemoVisible()).toBe(true);
      expect(await dp.getButtonAriaExpanded()).toBe('true');
      expect((await dp.getButtonText()).trim()).toBe('Hide demonstration');

      // Now click once more to make it 6 (even)
      await dp.clickButton();
      expect(await dp.isDemoVisible()).toBe(false);
      expect(await dp.getButtonAriaExpanded()).toBe('false');
      expect((await dp.getButtonText()).trim()).toBe('Show demonstration: 3-table join enumeration');

      // No page errors should have been produced by rapid clicks
      expect(pageErrors).toEqual([]);
    });

    test('Activating the button via keyboard (Enter) toggles the demo as well', async ({ page }) => {
      // Ensure keyboard activation also triggers the click handler (standard for <button>)
      const dp = new DemoPage(page);
      await dp.load();

      // Press Enter to toggle (should reveal)
      await dp.pressButtonEnter();
      expect(await dp.isDemoVisible()).toBe(true);
      expect((await dp.getButtonText()).trim()).toBe('Hide demonstration');

      // Press Enter again to hide
      await dp.pressButtonEnter();
      expect(await dp.isDemoVisible()).toBe(false);
      expect((await dp.getButtonText()).trim()).toBe('Show demonstration: 3-table join enumeration');

      expect(pageErrors).toEqual([]);
    });

    test('Clicking inside the demo content does not toggle the demo (event listener is attached to button only)', async ({ page }) => {
      // Validate that only the button toggles the demo (defensive test against accidental global handlers)
      const dp = new DemoPage(page);
      await dp.load();

      // Reveal first
      await dp.clickButton();
      expect(await dp.isDemoVisible()).toBe(true);

      // Click inside demo area (e.g., the .example area); nothing should change
      await dp.clickDemoArea();
      // Give the page a tiny moment to react if any handler was attached
      await page.waitForTimeout(20);

      expect(await dp.isDemoVisible()).toBe(true);
      expect((await dp.getButtonText()).trim()).toBe('Hide demonstration');

      // No errors from clicking inside content
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Observability: console messages and runtime errors', () => {
    test('No console.error or uncaught page errors are emitted during normal use', async ({ page }) => {
      // Load page and exercise typical interactions while recording console and page errors.
      const dp = new DemoPage(page);
      await dp.load();

      // Perform typical interactions: reveal, hide, reveal
      await dp.clickButton();
      await dp.clickButton();
      await dp.clickButton();

      // Small pause to ensure any asynchronous errors propagate to pageerror
      await page.waitForTimeout(30);

      // Check captured console messages for any error severity
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      if (consoleErrors.length > 0) {
        // If there are console errors, dump them to help debugging (non-mutating)
        // eslint-disable-next-line no-console
        console.error('Console errors captured:', consoleErrors);
      }

      // Assert no uncaught page errors were recorded
      expect(pageErrors).toEqual([]);

      // Assert there are no console messages of type 'error'
      expect(consoleErrors).toEqual([]);
    });

    test('Observe any runtime exceptions (ReferenceError, SyntaxError, TypeError) if they occur naturally', async ({ page }) => {
      // This test does not inject faults. It simply asserts the current runtime had no uncaught exceptions.
      const dp = new DemoPage(page);
      await dp.load();

      // Exercise the component
      await dp.clickButton();
      await dp.clickButton();

      // Wait a short moment for any exceptions to surface
      await page.waitForTimeout(20);

      // Filter pageErrors for common JS error indicators
      const runtimeExceptions = pageErrors.filter(msg =>
        msg.includes('ReferenceError') || msg.includes('TypeError') || msg.includes('SyntaxError')
      );

      // We assert that there are no such runtime exceptions in the natural run.
      // If they do occur, they will be present in pageErrors and this assertion will fail, surfacing the issue.
      expect(runtimeExceptions).toEqual([]);
    });
  });
});