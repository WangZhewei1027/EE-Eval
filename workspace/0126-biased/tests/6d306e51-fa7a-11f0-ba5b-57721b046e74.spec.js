import { test, expect } from '@playwright/test';

// Test suite for Interactive Monitor System
// Filename requirement: 6d306e51-fa7a-11f0-ba5b-57721b046e74.spec.js
// Page under test:
// http://127.0.0.1:5500/workspace/0126-biased/html/6d306e51-fa7a-11f0-ba5b-57721b046e74.html

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d306e51-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object for the monitor application to keep tests organized
class MonitorPage {
  constructor(page) {
    this.page = page;
    this.selectors = {
      powerBtn: '#powerBtn',
      menuBtn: '#menuBtn',
      infoBtn: '#infoBtn',
      brightnessSlider: '#brightnessSlider',
      contrastSlider: '#contrastSlider',
      volumeSlider: '#volumeSlider',
      resolutionSelect: '#resolutionSelect',
      inputSelect: '#inputSelect',
      colorProfileSelect: '#colorProfileSelect',
      aspectRatioSelect: '#aspectRatioSelect',
      refreshRateSelect: '#refreshRateSelect',
      presetsSelect: '#presetsSelect',
      savePresetBtn: '#savePresetBtn',
      resetBtn: '#resetBtn',
      statusDisplay: '#statusDisplay',
      menuPanel: '#menuPanel',
      mainContent: '#mainContent',
      monitorDisplay: '#monitorDisplay'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for init() (body onload) to run and for basic elements to be present
    await Promise.all([
      this.page.waitForSelector(this.selectors.powerBtn),
      this.page.waitForSelector(this.selectors.monitorDisplay)
    ]);
  }

  // Helpers
  async getMonitorState() {
    return this.page.evaluate(() => window.monitorState ? JSON.parse(JSON.stringify(monitorState)) : null);
  }

  async click(selector) {
    await this.page.click(selector);
  }

  async setRange(selector, value) {
    // Programmatically set the value and dispatch 'input' event to trigger handlers
    await this.page.locator(selector).evaluate((el, v) => {
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
  }

  async selectValue(selector, value) {
    await this.page.selectOption(selector, value);
    // Dispatch a change event in case selectOption doesn't trigger bound listeners in some envs
    await this.page.locator(selector).evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
  }

  async getText(selector) {
    return this.page.locator(selector).innerText();
  }

  async getAttribute(selector, attr) {
    return this.page.locator(selector).getAttribute(attr);
  }
}

test.describe('Interactive Monitor System - FSM Validation', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset captured errors before each test
    pageErrors = [];
    consoleErrors = [];

    // Capture page errors and console errors for observation
    page.on('pageerror', (err) => {
      // collect the message to assert on later
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test.describe('Power and Basic States', () => {
    test('Initial state is Powered Off (S0_PoweredOff) and UI reflects OFF', async ({ page }) => {
      const app = new MonitorPage(page);
      await app.goto();

      // Validate global monitorState exists and power is false
      const state = await app.getMonitorState();
      expect(state).not.toBeNull();
      expect(state.power).toBe(false);

      // The monitor display should indicate OFF
      const displayText = await app.getText(app.selectors.monitorDisplay);
      expect(displayText).toContain('OFF');

      // Power button should read "Turn ON"
      expect(await app.getText(app.selectors.powerBtn)).toBe('Turn ON');

      // Controls should be disabled when powered off
      expect(await page.locator(app.selectors.brightnessSlider).isDisabled()).toBe(true);
      expect(await page.locator(app.selectors.menuBtn).isDisabled()).toBe(true);
    });

    test('Toggling power transitions to Powered On (S1_PoweredOn) and updateUI runs', async ({ page }) => {
      const app = new MonitorPage(page);
      await app.goto();

      // Click power to turn on
      await app.click(app.selectors.powerBtn);

      // Validate monitorState.power becomes true
      const stateOn = await app.getMonitorState();
      expect(stateOn.power).toBe(true);

      // Power button text updates to "Turn OFF" — evidence updateUI() executed
      expect(await app.getText(app.selectors.powerBtn)).toBe('Turn OFF');

      // Controls should be enabled now
      expect(await page.locator(app.selectors.brightnessSlider).isDisabled()).toBe(false);
      expect(await page.locator(app.selectors.menuBtn).isDisabled()).toBe(false);

      // Monitor display should not show OFF
      const displayText = await app.getText(app.selectors.monitorDisplay);
      expect(displayText).not.toContain('OFF');
      // Display should include default resolution / refresh rate
      expect(displayText).toContain('1920x1080');
      expect(displayText).toContain('60Hz');
    });

    test('Toggling power off returns to Powered Off (S0_PoweredOff)', async ({ page }) => {
      const app = new MonitorPage(page);
      await app.goto();

      // Turn on first
      await app.click(app.selectors.powerBtn);
      let state = await app.getMonitorState();
      expect(state.power).toBe(true);

      // Turn off
      await app.click(app.selectors.powerBtn);
      state = await app.getMonitorState();
      expect(state.power).toBe(false);

      // UI should reflect OFF
      const displayText = await app.getText(app.selectors.monitorDisplay);
      expect(displayText).toContain('OFF');
      expect(await app.getText(app.selectors.powerBtn)).toBe('Turn ON');
      expect(await page.locator(app.selectors.brightnessSlider).isDisabled()).toBe(true);
    });
  });

  test.describe('Menu Open/Close (S2_MenuOpen / S3_MenuClosed)', () => {
    test('Opening and closing the menu when powered on toggles isMenuOpen state and UI panels', async ({ page }) => {
      const app = new MonitorPage(page);
      await app.goto();

      // Ensure powered on to open menu
      await app.click(app.selectors.powerBtn);
      let state = await app.getMonitorState();
      expect(state.power).toBe(true);

      // Click menu to open (S1 -> S2)
      await app.click(app.selectors.menuBtn);
      state = await app.getMonitorState();
      expect(state.isMenuOpen).toBe(true);

      // Menu panel should be visible and main content hidden
      expect(await page.locator(app.selectors.menuPanel).evaluate(el => getComputedStyle(el).display)).toBe('block');
      expect(await page.locator(app.selectors.mainContent).evaluate(el => getComputedStyle(el).display)).toBe('none');

      // Click menu to close (S2 -> S3)
      await app.click(app.selectors.menuBtn);
      state = await app.getMonitorState();
      expect(state.isMenuOpen).toBe(false);
      expect(await page.locator(app.selectors.menuPanel).evaluate(el => getComputedStyle(el).display)).toBe('none');
      expect(await page.locator(app.selectors.mainContent).evaluate(el => getComputedStyle(el).display)).toBe('block');

      // Re-open again (S3 -> S2) to test full toggle cycle
      await app.click(app.selectors.menuBtn);
      state = await app.getMonitorState();
      expect(state.isMenuOpen).toBe(true);
    });

    test('Attempting to open menu while powered off does nothing (edge case)', async ({ page }) => {
      const app = new MonitorPage(page);
      await app.goto();

      // Ensure powered off
      const initial = await app.getMonitorState();
      expect(initial.power).toBe(false);

      // Try toggling menu; toggleMenu short-circuits when !monitorState.power
      await app.click(app.selectors.menuBtn);
      const state = await app.getMonitorState();
      expect(state.isMenuOpen).toBe(false);

      // UI still shows menuPanel hidden
      expect(await page.locator(app.selectors.menuPanel).evaluate(el => getComputedStyle(el).display)).toBe('none');
    });
  });

  test.describe('Adjustments: Brightness, Contrast, Volume, Selects', () => {
    test('Adjust brightness updates monitorState and status display (AdjustBrightness)', async ({ page }) => {
      const app = new MonitorPage(page);
      await app.goto();

      // Turn on to enable controls
      await app.click(app.selectors.powerBtn);

      // Set brightness to 80
      await app.setRange(app.selectors.brightnessSlider, 80);
      const stateAfter = await app.getMonitorState();
      expect(Number(stateAfter.brightness)).toBe(80);

      // Status display should briefly show message about brightness - check it contains the text
      const status = await app.getText(app.selectors.statusDisplay);
      expect(status).toContain('Brightness set to 80');
    });

    test('Adjust contrast updates monitorState and status display (AdjustContrast)', async ({ page }) => {
      const app = new MonitorPage(page);
      await app.goto();
      await app.click(app.selectors.powerBtn);

      // Set contrast to 65
      await app.setRange(app.selectors.contrastSlider, 65);
      const state = await app.getMonitorState();
      expect(Number(state.contrast)).toBe(65);

      const status = await app.getText(app.selectors.statusDisplay);
      expect(status).toContain('Contrast set to 65');
    });

    test('Adjust volume updates monitorState and status display (AdjustVolume)', async ({ page }) => {
      const app = new MonitorPage(page);
      await app.goto();
      await app.click(app.selectors.powerBtn);

      // Set volume to 45
      await app.setRange(app.selectors.volumeSlider, 45);
      const state = await app.getMonitorState();
      expect(Number(state.volume)).toBe(45);

      const status = await app.getText(app.selectors.statusDisplay);
      expect(status).toContain('Volume set to 45');
    });

    test('Changing resolution and input source update monitorState and display', async ({ page }) => {
      const app = new MonitorPage(page);
      await app.goto();
      await app.click(app.selectors.powerBtn);

      // Open menu to access selects (menu may be open or closed; updateUI still binds selects)
      await app.click(app.selectors.menuBtn);

      // Change resolution to 3840x2160
      await app.selectValue(app.selectors.resolutionSelect, '3840x2160');
      let state = await app.getMonitorState();
      expect(state.resolution).toBe('3840x2160');
      let displayText = await app.getText(app.selectors.monitorDisplay);
      expect(displayText).toContain('3840x2160');

      // Change input source to DisplayPort
      await app.selectValue(app.selectors.inputSelect, 'DisplayPort');
      state = await app.getMonitorState();
      expect(state.inputSource).toBe('DisplayPort');
      displayText = await app.getText(app.selectors.monitorDisplay);
      expect(displayText).toContain('DisplayPort Input');
    });

    test('Change color profile, aspect ratio, refresh rate update monitorState (ChangeColorProfile, ChangeAspectRatio, ChangeRefreshRate)', async ({ page }) => {
      const app = new MonitorPage(page);
      await app.goto();
      await app.click(app.selectors.powerBtn);
      await app.click(app.selectors.menuBtn);

      await app.selectValue(app.selectors.colorProfileSelect, 'AdobeRGB');
      await app.selectValue(app.selectors.aspectRatioSelect, '21:9');
      await app.selectValue(app.selectors.refreshRateSelect, '144');

      const state = await app.getMonitorState();
      expect(state.colorProfile).toBe('AdobeRGB');
      expect(state.aspectRatio).toBe('21:9');
      expect(String(state.refreshRate)).toBe('144');

      // Display should reflect new refresh rate
      const displayText = await app.getText(app.selectors.monitorDisplay);
      expect(displayText).toContain('144Hz');
    });
  });

  test.describe('Presets, Save, Reset, and System Info', () => {
    test('Applying a preset updates relevant settings (ApplyPreset)', async ({ page }) => {
      const app = new MonitorPage(page);
      await app.goto();
      await app.click(app.selectors.powerBtn);
      await app.click(app.selectors.menuBtn);

      // Apply "gaming" preset
      await app.selectValue(app.selectors.presetsSelect, 'gaming');

      const state = await app.getMonitorState();
      // From FSM: gaming preset brightness:70 contrast:80 refreshRate:144
      expect(Number(state.brightness)).toBe(70);
      expect(Number(state.contrast)).toBe(80);
      expect(Number(state.refreshRate)).toBe(144);

      const status = await app.getText(app.selectors.statusDisplay);
      expect(status).toContain('Applied gaming preset');
    });

    test('Selecting "custom" preset does not apply changes (edge case)', async ({ page }) => {
      const app = new MonitorPage(page);
      await app.goto();
      await app.click(app.selectors.powerBtn);
      await app.click(app.selectors.menuBtn);

      // Record current brightness
      const before = await app.getMonitorState();
      const beforeBrightness = Number(before.brightness);

      // Choose 'custom' option which should cause early return
      await app.selectValue(app.selectors.presetsSelect, 'custom');

      const after = await app.getMonitorState();
      expect(Number(after.brightness)).toBe(beforeBrightness);
    });

    test('Saving a custom preset via prompt appends to presets and updates monitorState.presets (SavePreset)', async ({ page }) => {
      const app = new MonitorPage(page);
      await app.goto();
      await app.click(app.selectors.powerBtn);
      await app.click(app.selectors.menuBtn);

      // Listen for the prompt and accept with name 'myCustomPreset'
      const presetName = 'myCustomPreset';
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('prompt');
        await dialog.accept(presetName);
      });

      // Ensure some state to save
      await app.setRange(app.selectors.brightnessSlider, 77);
      await app.setRange(app.selectors.contrastSlider, 66);
      await app.selectValue(app.selectors.refreshRateSelect, '120');

      // Click save preset
      await app.click(app.selectors.savePresetBtn);

      // Validate the preset was added to monitorState.presets
      const state = await app.getMonitorState();
      expect(state.presets).toHaveProperty(presetName);
      expect(Number(state.presets[presetName].brightness)).toBe(77);
      expect(Number(state.presets[presetName].contrast)).toBe(66);
      expect(Number(state.presets[presetName].refreshRate)).toBe(120);

      // Validate the DOM select got a new option
      const optionExists = await page.locator(`${app.selectors.presetsSelect} option[value="${presetName}"]`).count();
      expect(optionExists).toBeGreaterThan(0);

      // Status display updated
      const status = await app.getText(app.selectors.statusDisplay);
      expect(status).toContain(`Saved "${presetName}" preset`);
    });

    test('Reset settings prompts confirm and restores defaults (ResetSettings)', async ({ page }) => {
      const app = new MonitorPage(page);
      await app.goto();
      await app.click(app.selectors.powerBtn);
      await app.click(app.selectors.menuBtn);

      // change values away from defaults
      await app.setRange(app.selectors.brightnessSlider, 90);
      await app.setRange(app.selectors.contrastSlider, 90);
      await app.selectValue(app.selectors.resolutionSelect, '2560x1440');
      await app.selectValue(app.selectors.inputSelect, 'DisplayPort');

      // Intercept confirm dialog and accept it
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('confirm');
        await dialog.accept();
      });

      // Click reset and expect defaults restored
      await app.click(app.selectors.resetBtn);

      const state = await app.getMonitorState();
      expect(Number(state.brightness)).toBe(50);
      expect(Number(state.contrast)).toBe(50);
      expect(state.resolution).toBe('1920x1080');
      expect(state.inputSource).toBe('HDMI');

      const status = await app.getText(app.selectors.statusDisplay);
      expect(status).toContain('Settings reset to defaults');
    });

    test('Show System Info triggers an alert with the expected info (ShowSystemInfo)', async ({ page }) => {
      const app = new MonitorPage(page);
      await app.goto();
      await app.click(app.selectors.powerBtn);

      // Capture alert text
      let alertMessage = null;
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('alert');
        alertMessage = dialog.message();
        await dialog.accept();
      });

      await app.click(app.selectors.infoBtn);

      // After clicking, verify alert was shown and contains expected pieces
      expect(alertMessage).toBeTruthy();
      expect(alertMessage).toContain('Monitor Status:');
      expect(alertMessage).toContain('Power: ON');
      expect(alertMessage).toContain('Brightness:');
      expect(alertMessage).toContain('Contrast:');
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('Ensure updateUI runs on power toggle (onEnter action check) - verified by UI changes', async ({ page }) => {
      const app = new MonitorPage(page);
      await app.goto();

      // Capture UI before
      const beforeBtn = await app.getText(app.selectors.powerBtn);

      // Toggle power
      await app.click(app.selectors.powerBtn);

      // If updateUI executed, power button text will change to Turn OFF
      const afterBtn = await app.getText(app.selectors.powerBtn);
      expect(beforeBtn).toBe('Turn ON');
      expect(afterBtn).toBe('Turn OFF');
    });

    test('No unexpected exceptions are thrown during normal interactions (observe pageerror and console.error)', async ({ page }) => {
      const app = new MonitorPage(page);
      await app.goto();

      // Perform a series of interactions that exercise handlers
      await app.click(app.selectors.powerBtn);
      await app.setRange(app.selectors.brightnessSlider, 55);
      await app.setRange(app.selectors.contrastSlider, 60);
      await app.selectValue(app.selectors.resolutionSelect, '1280x720');
      await app.selectValue(app.selectors.inputSelect, 'DVI');
      await app.selectValue(app.selectors.colorProfileSelect, 'DCI-P3');
      await app.selectValue(app.selectors.refreshRateSelect, '75');
      await app.setRange(app.selectors.volumeSlider, 20);
      await app.click(app.selectors.menuBtn);
      await app.click(app.selectors.menuBtn);

      // Validate that while the app ran through these interactions, no page errors were emitted
      // Collect arrays were attached in beforeEach; assert none were captured
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  // Final test: summarize captured console and page errors (ensures we observed and assert on them).
  test('Captured page errors and console errors should be empty (no uncaught ReferenceError/SyntaxError/TypeError)', async ({ page }) => {
    const app = new MonitorPage(page);
    await app.goto();

    // Perform a light interaction to potentially surface runtime issues
    await app.click(app.selectors.powerBtn);
    await app.setRange(app.selectors.brightnessSlider, 42);

    // At this point, the arrays pageErrors and consoleErrors are accessible and were populated through page.on handlers
    // Assert that no uncaught exceptions occurred during page initialization and interactions
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});