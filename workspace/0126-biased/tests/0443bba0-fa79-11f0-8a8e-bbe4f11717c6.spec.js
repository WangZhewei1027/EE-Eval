import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0443bba0-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page Object for the Monitor application
class MonitorPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('.button');
    this.icon = page.locator('.icon');
    this.errorEvents = [];
    this.consoleMessages = [];
    this.dialogs = [];
  }

  // Navigate to the app and set up listeners for console, errors, dialogs
  async goto() {
    // Collect console messages
    this.page.on('console', (msg) => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect page errors (uncaught exceptions)
    this.page.on('pageerror', (err) => {
      this.errorEvents.push(err);
    });

    // Collect dialogs (alerts/confirm/prompts)
    this.page.on('dialog', async (dialog) => {
      // Record dialog message then accept so tests proceed
      this.dialogs.push({ type: dialog.type(), message: dialog.message() });
      try {
        await dialog.accept();
      } catch (e) {
        // If accepting fails, still record the failure by pushing to errorEvents
        this.errorEvents.push(e);
      }
    });

    await this.page.goto(APP_URL);
  }

  // Returns whether the icon has the 'show' class
  async isIconVisible() {
    return await this.icon.evaluate((el) => el.classList.contains('show'));
  }

  // Click the main button (which will also trigger an alert via inline onclick)
  async clickButton() {
    await this.button.click();
  }

  // Invoke showIcon directly on the page if present (safe-check)
  async callShowIcon() {
    return await this.page.evaluate(() => {
      if (typeof showIcon === 'function') {
        showIcon();
        return true;
      }
      return false;
    });
  }
}

test.describe('Monitor App - FSM Validation (0443bba0-fa79-11f0-8a8e-bbe4f11717c6)', () => {
  // Use per-test fixtures
  test.describe.configure({ mode: 'serial' });

  // Basic smoke tests for initial page load and components
  test.describe('Initial State and UI Structure (S0_Idle)', () => {
    test('Initial DOM structure is present and no immediate runtime errors', async ({ page }) => {
      const app = new MonitorPage(page);
      await app.goto();

      // Verify the title and key elements exist
      await expect(page.locator('.title')).toHaveText(/Monitor/);
      await expect(page.locator('.description')).toHaveCount(1);
      await expect(app.button).toHaveText('Click me!');
      await expect(app.icon).toHaveCount(1);

      // FSM S0_Idle evidence: button exists with onclick attribute
      const onclickAttr = await page.locator('.button').getAttribute('onclick');
      // The implementation includes inline onclick alert - ensure it exists as evidence
      expect(onclickAttr).toBe("alert('Button clicked!')");

      // Ensure showIcon function is defined on the page (entry action availability)
      const hasShowIcon = await page.evaluate(() => typeof showIcon === 'function');
      expect(hasShowIcon).toBe(true);

      // By design, the 'show' class is toggled to indicate visible state.
      // For S0_Idle we expect the icon NOT to have the 'show' class initially.
      expect(await app.isIconVisible()).toBe(false);

      // Confirm there were no uncaught exceptions or console.error messages during load
      const consoleErrors = app.consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(app.errorEvents.length).toBe(0);
    });
  });

  test.describe('Events and Transitions (ButtonClick -> S1_IconVisible and back)', () => {
    // Each test uses a fresh page to avoid state bleed
    test('Clicking the button toggles icon visibility: S0_Idle -> S1_IconVisible', async ({ page }) => {
      const app = new MonitorPage(page);
      await app.goto();

      // Precondition: icon not visible
      expect(await app.isIconVisible()).toBe(false);

      // Perform the user action: click the button
      // The inline onclick triggers an alert; our MonitorPage handles dialogs and accepts them.
      await app.clickButton();

      // After the click the show class should be toggled (icon visible)
      expect(await app.isIconVisible()).toBe(true);

      // Verify a dialog was shown by the inline onclick attribute
      expect(app.dialogs.length).toBeGreaterThanOrEqual(1);
      // The first dialog should have the expected alert message
      expect(app.dialogs[0].message).toBe("Button clicked!");

      // No uncaught page errors should have occurred during the interaction
      const consoleErrors = app.consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(app.errorEvents.length).toBe(0);
    });

    test('Clicking the button again toggles icon to hidden: S1_IconVisible -> S0_Idle', async ({ page }) => {
      const app = new MonitorPage(page);
      await app.goto();

      // Bring to S1_IconVisible first
      await app.clickButton();
      expect(await app.isIconVisible()).toBe(true);

      // Click again to toggle back to Idle
      await app.clickButton();
      expect(await app.isIconVisible()).toBe(false);

      // Ensure there were two dialogs (one per click) with expected messages
      // Some environments may coalesce or the dialog handling could have timing differences;
      // at minimum we expect at least two recorded dialogs after two clicks.
      expect(app.dialogs.length).toBeGreaterThanOrEqual(2);
      expect(app.dialogs[1].message).toBe("Button clicked!");

      // Validate no page errors occurred throughout toggling
      const consoleErrors = app.consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(app.errorEvents.length).toBe(0);
    });

    test('Direct invocation of showIcon toggles the icon (sanity check)', async ({ page }) => {
      const app = new MonitorPage(page);
      await app.goto();

      // Directly call showIcon from the page context (should exist)
      const invoked = await app.callShowIcon();
      expect(invoked).toBe(true);
      expect(await app.isIconVisible()).toBe(true);

      // Call again to hide
      const invokedAgain = await app.callShowIcon();
      expect(invokedAgain).toBe(true);
      expect(await app.isIconVisible()).toBe(false);

      // No errors produced by direct invocation
      const consoleErrors = app.consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(app.errorEvents.length).toBe(0);
    });
  });

  test.describe('Edge Cases & Error Observability', () => {
    test('Clicking a non-existent element should not throw unhandled errors (edge-case test)', async ({ page }) => {
      const app = new MonitorPage(page);
      await app.goto();

      // Attempt to click a selector that does not exist - should throw from Playwright but not produce page errors.
      // We capture the thrown error and assert it is a Playwright error (page-level code not broken).
      let playError = null;
      try {
        await page.click('.non-existent-selector', { timeout: 1000 });
      } catch (e) {
        playError = e;
      }
      expect(playError).not.toBeNull();
      // Ensure this did not produce uncaught page runtime errors (like ReferenceError/SyntaxError/TypeError)
      const consoleErrors = app.consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(app.errorEvents.length).toBe(0);
    });

    test('Validate that common runtime errors (ReferenceError/SyntaxError/TypeError) did not occur during test run', async ({ page }) => {
      const app = new MonitorPage(page);
      await app.goto();

      // We inspect captured pageerror events for known error names.
      const namedErrors = app.errorEvents.map((err) => {
        // err.name may or may not exist depending on type; fallback to string check
        return err && err.name ? err.name : String(err);
      });

      // Assert none of the known fatal JS errors occurred unexpectedly
      expect(namedErrors.some((n) => n.includes('ReferenceError'))).toBe(false);
      expect(namedErrors.some((n) => n.includes('SyntaxError'))).toBe(false);
      expect(namedErrors.some((n) => n.includes('TypeError'))).toBe(false);

      // Also assert console does not contain error-level logging
      const consoleErrors = app.consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('FSM Evidence and Assertions', () => {
    test('FSM evidence: existence of components and event handler wiring', async ({ page }) => {
      const app = new MonitorPage(page);
      await app.goto();

      // Evidence: button component with onclick and the event listener wiring to showIcon
      const onclickAttr = await page.locator('.button').getAttribute('onclick');
      expect(onclickAttr).toBe("alert('Button clicked!')");

      // Evidence: event listener wiring (we check that showIcon exists and is referenced by clicking)
      const before = await app.isIconVisible();
      await app.clickButton();
      const after = await app.isIconVisible();
      expect(before).not.toBe(after);

      // Evidence: visual component (.icon) contains an <i> with the expected class (font-awesome marker)
      const iconInnerHTML = await page.locator('.icon').innerHTML();
      expect(iconInnerHTML).toContain('fa-exclamation-triangle');

      // No page errors observed while checking FSM evidence
      const consoleErrors = app.consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(app.errorEvents.length).toBe(0);
    });
  });
});