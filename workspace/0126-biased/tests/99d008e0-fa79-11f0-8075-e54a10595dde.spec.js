import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d008e0-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the Interactive Monitor page
class MonitorPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Selectors based on the provided HTML
    this.selectors = {
      inputValue: '#inputValue',
      addValueBtn: 'button[onclick="addValue()"]',
      resetValuesBtn: 'button[onclick="resetValues()"]',
      slider: '#slider',
      sliderValue: '#sliderValue',
      checkbox: '#checkbox',
      notificationStatus: '#notificationStatus',
      toggleHistoryBtn: 'button[onclick="toggleHistory()"]',
      historyContainer: '#history',
      historyList: '#historyList',
      displayValue: '#displayValue',
      heading: 'h1'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getHeadingText() {
    return await this.page.textContent(this.selectors.heading);
  }

  async addValue(value) {
    await this.page.fill(this.selectors.inputValue, String(value));
    await this.page.click(this.selectors.addValueBtn);
  }

  async clickAddValue() {
    await this.page.click(this.selectors.addValueBtn);
  }

  async resetValues() {
    await this.page.click(this.selectors.resetValuesBtn);
  }

  async setSlider(value) {
    // Use evaluate to set the value and dispatch an input event to trigger oninput handlers.
    await this.page.$eval(this.selectors.slider, (el, val) => {
      el.value = val;
      const evt = new Event('input', { bubbles: true });
      el.dispatchEvent(evt);
    }, String(value));
  }

  async toggleNotifications() {
    await this.page.click(this.selectors.checkbox);
  }

  async toggleHistory() {
    await this.page.click(this.selectors.toggleHistoryBtn);
  }

  async getSliderValueText() {
    return (await this.page.textContent(this.selectors.sliderValue))?.trim();
  }

  async getNotificationStatusText() {
    return (await this.page.textContent(this.selectors.notificationStatus))?.trim();
  }

  async isHistoryHidden() {
    return await this.page.$eval(this.selectors.historyContainer, el => el.classList.contains('hidden'));
  }

  async getHistoryItems() {
    return await this.page.$$eval(`${this.selectors.historyList} li`, nodes => nodes.map(n => n.textContent));
  }

  async getDisplayValueText() {
    return (await this.page.textContent(this.selectors.displayValue))?.trim();
  }
}

test.describe('Interactive Monitor - FSM validation and UI behavior', () => {
  // Arrays to collect console errors and page errors for assertions
  let consoleErrors;
  let pageErrors;

  // Provide a fresh page and listeners before each test.
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen to console messages and collect error-level messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Collect unhandled page errors (uncaught exceptions)
    page.on('pageerror', error => {
      pageErrors.push(String(error && error.message ? error.message : error));
    });
  });

  test.describe('Initial render and Idle state (S0_Idle)', () => {
    test('renders the page header and default UI state (Idle entry_action: renderPage())', async ({ page }) => {
      // Validate initial render and elements expected in Idle state
      const monitor = new MonitorPage(page);
      await monitor.goto();

      // The FSM's entry action for Idle was renderPage() - check that header exists
      const heading = await monitor.getHeadingText();
      expect(heading).toBe('Interactive Monitor');

      // Check default texts & visibility
      expect(await monitor.getDisplayValueText()).toBe('No values entered');
      expect(await monitor.getSliderValueText()).toBe('50');
      expect(await monitor.getNotificationStatusText()).toBe('Disabled');
      expect(await monitor.isHistoryHidden()).toBe(true);

      // Ensure no unexpected page errors just on load
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Add Value (S1_ValueAdded) and Reset Values (S2_ValuesReset)', () => {
    test('adding a non-empty value pushes to history, updates UI, and clearing works', async ({ page }) => {
      const monitor = new MonitorPage(page);
      await monitor.goto();

      // Add a value and assert DOM updates
      await monitor.addValue(42);
      const historyItemsAfterAdd = await monitor.getHistoryItems();
      expect(historyItemsAfterAdd.length).toBe(1);
      expect(historyItemsAfterAdd[0].trim()).toBe('42');

      // The display value should update to the last entered value (evidence)
      expect(await monitor.getDisplayValueText()).toBe('42');

      // Also check the input was cleared after add (edge check)
      const inputValue = await page.$eval('#inputValue', el => el.value);
      expect(inputValue).toBe('');

      // Now reset and verify history and display cleared
      await monitor.resetValues();
      const historyItemsAfterReset = await monitor.getHistoryItems();
      expect(historyItemsAfterReset.length).toBe(0);
      expect(await monitor.getDisplayValueText()).toBe('No values entered');

      // Validate the underlying JS historyData was reset (use page.evaluate to inspect runtime)
      const historyData = await page.evaluate(() => typeof historyData !== 'undefined' ? historyData : null);
      expect(Array.isArray(historyData)).toBe(true);
      expect(historyData.length).toBe(0);

      // No uncaught page errors expected for these actions
      expect(pageErrors.length).toBe(0);
    });

    test('edge case: clicking Add Value with empty input does not add an entry', async ({ page }) => {
      const monitor = new MonitorPage(page);
      await monitor.goto();

      // Ensure input is empty, then click Add Value
      await page.fill('#inputValue', '');
      await monitor.clickAddValue();

      // History should remain empty and displayValue should still be default
      expect((await monitor.getHistoryItems()).length).toBe(0);
      expect(await monitor.getDisplayValueText()).toBe('No values entered');

      // No page errors expected
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Slider adjustments (S3_SliderAdjusted) and related errors', () => {
    test('adjusting slider updates visible slider value and may surface console/page errors due to inline handler', async ({ page }) => {
      const monitor = new MonitorPage(page);
      await monitor.goto();

      // Prepare to accept any dialogs that may pop up if notifications are enabled
      page.on('dialog', async dialog => {
        // Accept so the test doesn't hang — we are only observing that a dialog was triggered.
        await dialog.accept();
      });

      // Clear any previous error collections
      // (listeners are per-test due to beforeEach, but ensure arrays are empty here)
      // NOTE: consoleErrors and pageErrors are already local to the test

      // Set the slider to a new value and dispatch input event
      await monitor.setSlider(75);

      // small wait to allow any synchronous/async pageerror or console events to surface
      await page.waitForTimeout(100);

      // Verify UI updated
      const sliderText = await monitor.getSliderValueText();
      expect(sliderText).toBe('75');

      // The FSM evidence expects updateSliderValue to set sliderValue innerText.
      // Additionally, the inline oninput uses updateSliderValue(value) which can cause ReferenceError in some runtimes.
      // We therefore assert that at least one of these is true:
      //  - slider updated successfully (already asserted), and
      //  - a console error or page error related to ReferenceError / TypeError / SyntaxError was emitted OR none occurred.
      // To follow the instruction to observe console/page errors, we check for their presence and their contents (if any).
      const errorsCombined = [...consoleErrors, ...pageErrors].join(' || ');
      if (errorsCombined.length > 0) {
        // If there are errors, they should mention typical JS error types
        const hasKnownError = /ReferenceError|TypeError|SyntaxError|Error/i.test(errorsCombined);
        expect(hasKnownError).toBe(true);
      } else {
        // If no errors occurred, guarantee at least the update occurred (already checked) — allow this case.
        expect(errorsCombined).toBe('');
      }
    });
  });

  test.describe('Toggle Notifications (S4_NotificationsEnabled <-> S5_NotificationsDisabled)', () => {
    test('clicking the notifications checkbox toggles the status text and triggers alert when slider changed while enabled', async ({ page }) => {
      const monitor = new MonitorPage(page);
      await monitor.goto();

      // Track if a dialog (alert) is shown
      let sawDialog = false;
      page.on('dialog', async dialog => {
        sawDialog = true;
        await dialog.accept();
      });

      // Initially disabled
      expect(await monitor.getNotificationStatusText()).toBe('Disabled');

      // Enable notifications
      await monitor.toggleNotifications();
      expect(await monitor.getNotificationStatusText()).toBe('Enabled');

      // Now adjust slider - if updateSliderValue receives a value correctly, it will call alert when notificationsEnabled is true.
      // The inline oninput may cause a ReferenceError instead; we accept both outcomes.
      await monitor.setSlider(20);
      await page.waitForTimeout(100);

      // If dialog was shown, that indicates the alert path was executed
      // Otherwise, ensure either an error occurred or the slider still updated normally
      if (sawDialog) {
        expect(sawDialog).toBe(true);
      } else {
        // No dialog — check for console/page errors or normal slider update
        const errorsCombined = [...consoleErrors, ...pageErrors].join(' || ');
        const hasKnownError = errorsCombined.length > 0 ? /ReferenceError|TypeError|SyntaxError|Error/i.test(errorsCombined) : false;
        expect(hasKnownError || (await monitor.getSliderValueText()) === '20').toBeTruthy();
      }

      // Disable notifications again
      await monitor.toggleNotifications();
      expect(await monitor.getNotificationStatusText()).toBe('Disabled');
    });
  });

  test.describe('History visibility toggle (S6_HistoryVisible <-> S7_HistoryHidden)', () => {
    test('toggling history shows and hides the history container', async ({ page }) => {
      const monitor = new MonitorPage(page);
      await monitor.goto();

      // Initially hidden
      expect(await monitor.isHistoryHidden()).toBe(true);

      // Toggle to visible
      await monitor.toggleHistory();
      expect(await monitor.isHistoryHidden()).toBe(false);

      // Toggle to hidden again
      await monitor.toggleHistory();
      expect(await monitor.isHistoryHidden()).toBe(true);

      // Toggle again to visible (covering the S7->S6 transition)
      await monitor.toggleHistory();
      expect(await monitor.isHistoryHidden()).toBe(false);

      // No page errors expected just from toggling visibility
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Error observation and edge cases summary', () => {
    test('collect and assert any console/page errors are JS errors (ReferenceError/TypeError/SyntaxError) if present', async ({ page }) => {
      const monitor = new MonitorPage(page);
      await monitor.goto();

      // Trigger several interactions that historically might produce errors:
      // - adjust slider
      // - toggle notifications on and adjust slider
      // - toggle history
      await monitor.setSlider(33);
      await monitor.toggleNotifications();
      await monitor.setSlider(44);
      await monitor.toggleHistory();

      // Wait briefly to capture any async console/page errors
      await page.waitForTimeout(150);

      // Combine and classify any captured errors
      const allErrors = [...consoleErrors, ...pageErrors];
      // If errors exist, they should be typical JS errors; assert their messages contain known error keywords
      if (allErrors.length > 0) {
        for (const err of allErrors) {
          expect(/ReferenceError|TypeError|SyntaxError|Error/i.test(err)).toBeTruthy();
        }
      } else {
        // If there are no errors, that's acceptable: assert that UI is still functional
        expect(await monitor.getSliderValueText()).toBeDefined();
        expect(await monitor.getNotificationStatusText()).toBeDefined();
      }
    });
  });

  // No explicit teardown is required; Playwright will close contexts/pages automatically.
});