import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8f2943-fa77-11f0-8492-31e949ed3c7c.html';

class OSIPage {
  /**
   * Page object for OSI Model Visualization application.
   * Encapsulates common selectors and actions.
   */
  constructor(page) {
    this.page = page;
    this.container = page.locator('.container');
    this.heading = page.locator('h1');
    this.layers = page.locator('.layer');
    this.resetButton = page.locator('button');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getLayerCount() {
    return await this.layers.count();
  }

  async getLayerTextAt(index) {
    const label = this.layers.nth(index).locator('.label');
    return await label.innerText();
  }

  async clickLayerByIndex(index) {
    await this.layers.nth(index).click();
  }

  async clickReset() {
    await this.resetButton.click();
  }

  async getOnclickAttrForLayer(index) {
    return await this.page.locator('.layer').nth(index).getAttribute('onclick');
  }

  async getOnclickAttrForReset() {
    return await this.resetButton.getAttribute('onclick');
  }

  async clickContainer() {
    await this.container.click();
  }
}

test.describe('OSI Model Visualization - FSM states and transitions', () => {
  let osiPage;
  let consoleMessages = [];
  let pageErrors = [];
  let dialogMessages = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];
    dialogMessages = [];

    // Capture console messages and page errors for assertions later
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Global dialog listener to capture any dialogs that may be produced and auto-accept them.
    page.on('dialog', async (dialog) => {
      try {
        dialogMessages.push(dialog.message());
        await dialog.accept();
      } catch (e) {
        // allow natural behavior; store error if occurs
        pageErrors.push(e);
      }
    });

    osiPage = new OSIPage(page);
    await osiPage.goto();
  });

  test.afterEach(async ({ page }) => {
    // After each test ensure no unexpected JS errors surfaced.
    // Tests are required to observe console logs and page errors and assert accordingly.
    // Here we assert that no page errors (unhandled exceptions) occurred during the test run.
    expect(pageErrors.length, `Expected no page errors, but got: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);

    // Also ensure there are no console error messages.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Console error messages found: ${consoleErrors.map(e => e.text).join('; ')}`).toBe(0);

    // Note: dialogMessages are validated inside individual tests where appropriate.
  });

  test('Idle state (S0_Idle) renders page and base elements correctly', async ({ page }) => {
    // This test validates the initial renderPage() effect: container and heading exist.
    await expect(osiPage.container).toBeVisible();
    await expect(osiPage.heading).toHaveText('OSI Model');

    // There should be 7 layers and a Reset button per FSM components
    const count = await osiPage.getLayerCount();
    expect(count).toBe(7);

    await expect(osiPage.resetButton).toBeVisible();
    await expect(osiPage.resetButton).toHaveText('Reset');

    // Verify each layer label text matches expected order from HTML
    const expectedLabels = ['Application', 'Presentation', 'Session', 'Transport', 'Network', 'Data Link', 'Physical'];
    for (let i = 0; i < expectedLabels.length; i++) {
      const label = await osiPage.getLayerTextAt(i);
      expect(label.trim()).toBe(expectedLabels[i]);
    }

    // Verify that onclick attributes exist on layers and reset button (evidence from FSM)
    for (let i = 0; i < 7; i++) {
      const onclick = await osiPage.getOnclickAttrForLayer(i);
      // The implementation uses showAlert for layers; we assert the attribute contains that function name.
      expect(onclick, `Expected onclick attribute to exist for layer ${i}`).toBeTruthy();
      expect(onclick.includes('showAlert')).toBeTruthy();
    }
    const resetOnclick = await osiPage.getOnclickAttrForReset();
    expect(resetOnclick).toBeTruthy();
    expect(resetOnclick.includes('resetLayers')).toBeTruthy();
  });

  test('LayerClick event (S1_LayerClicked) produces correct alert for each layer', async ({ page }) => {
    // This test iterates through each layer and asserts the dialog message matches FSM expected alerts.
    const expectedAlerts = [
      "Layer 7: Application Layer",
      "Layer 6: Presentation Layer",
      "Layer 5: Session Layer",
      "Layer 4: Transport Layer",
      "Layer 3: Network Layer",
      "Layer 2: Data Link Layer",
      "Layer 1: Physical Layer"
    ];

    for (let i = 0; i < expectedAlerts.length; i++) {
      // Use waitForEvent to capture the dialog triggered by the click
      const dialogPromise = page.waitForEvent('dialog');
      await osiPage.clickLayerByIndex(i);
      const dialog = await dialogPromise;
      // Assert the alert message content
      expect(dialog.message()).toBe(expectedAlerts[i]);
      await dialog.accept();

      // Also verify that the DOM still contains the layer label (click should not remove layers)
      const labelText = await osiPage.getLayerTextAt(i);
      expect(labelText.trim()).toBeTruthy();
    }

    // Also ensure the global dialog listener captured the same number of dialogs
    // (the global listener auto-accepted them and stored messages too)
    expect(dialogMessages.length).toBeGreaterThanOrEqual(7);
    // Check at least one expected alert is present in recorded dialogs
    expect(dialogMessages).toEqual(expect.arrayContaining([expectedAlerts[0]]));
  });

  test('ResetClick event (S2_Reset) triggers resetLayers alert', async ({ page }) => {
    // This test verifies clicking the Reset button triggers the expected alert.
    const expectedResetAlert = 'Layers reset to default view.';

    const dialogPromise = page.waitForEvent('dialog');
    await osiPage.clickReset();
    const dialog = await dialogPromise;
    expect(dialog.message()).toBe(expectedResetAlert);
    await dialog.accept();

    // Confirm global listener also saw the reset alert
    expect(dialogMessages.includes(expectedResetAlert)).toBeTruthy();
  });

  test('Edge case: rapid consecutive clicks on a layer produce sequential alerts (double-click)', async ({ page }) => {
    // This test validates behavior when a layer is clicked rapidly twice.
    // The page uses alert() so two dialogs are expected in sequence.

    const targetIndex = 0; // Application layer
    const expectedMessage = "Layer 7: Application Layer";

    // Click twice rapidly. We'll await two dialog events sequentially.
    const dialogPromise1 = page.waitForEvent('dialog');
    await osiPage.clickLayerByIndex(targetIndex);
    const dialog1 = await dialogPromise1;
    expect(dialog1.message()).toBe(expectedMessage);
    await dialog1.accept();

    // Second click
    const dialogPromise2 = page.waitForEvent('dialog');
    await osiPage.clickLayerByIndex(targetIndex);
    const dialog2 = await dialogPromise2;
    expect(dialog2.message()).toBe(expectedMessage);
    await dialog2.accept();

    // Ensure both dialogs were recorded by global listener as well
    const occurrences = dialogMessages.filter(msg => msg === expectedMessage).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  test('Edge case: clicking non-interactive area should not produce an alert', async ({ page }) => {
    // Click the container (which has no alert handler) and assert no dialog appears.
    // We use a small timeout for waitForEvent to detect absence of dialog.
    const dialogPromise = page.waitForEvent('dialog', { timeout: 500 }).then(() => true).catch(() => false);
    await osiPage.clickContainer();
    const dialogAppeared = await dialogPromise;
    expect(dialogAppeared).toBe(false);
  });

  test('Verify onclick attribute strings match expected evidence in FSM', async ({ page }) => {
    // This test inspects the raw onclick attribute strings to match evidence in FSM.
    const expectedOnclicks = [
      "showAlert('Layer 7: Application Layer')",
      "showAlert('Layer 6: Presentation Layer')",
      "showAlert('Layer 5: Session Layer')",
      "showAlert('Layer 4: Transport Layer')",
      "showAlert('Layer 3: Network Layer')",
      "showAlert('Layer 2: Data Link Layer')",
      "showAlert('Layer 1: Physical Layer')"
    ];

    for (let i = 0; i < expectedOnclicks.length; i++) {
      const onclick = await osiPage.getOnclickAttrForLayer(i);
      // The HTML may include the function call exactly as in FSM evidence.
      expect(onclick.includes(expectedOnclicks[i])).toBeTruthy();
    }

    const resetOnclick = await osiPage.getOnclickAttrForReset();
    expect(resetOnclick.includes("resetLayers()")).toBeTruthy();
  });

  test('Error observation: ensure no runtime ReferenceError/SyntaxError/TypeError occurred during load and interactions', async ({ page }) => {
    // This test explicitly asserts that no common JS runtime errors (ReferenceError, SyntaxError, TypeError)
    // were thrown during the test execution. The pageerror listener collects exceptions.
    // We already assert in afterEach that pageErrors is empty, but make an explicit assertion here as well.
    // Additionally check console messages for error-level output that may indicate runtime problems.
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // As a sanity check, perform a typical interaction and confirm no new errors are produced.
    const dialogPromise = page.waitForEvent('dialog');
    await osiPage.clickLayerByIndex(1); // click Presentation layer
    const dialog = await dialogPromise;
    expect(dialog.message()).toBe("Layer 6: Presentation Layer");
    await dialog.accept();

    // Re-evaluate error collectors after interaction
    expect(pageErrors.length).toBe(0);
    const postConsoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(postConsoleErrors.length).toBe(0);
  });
});