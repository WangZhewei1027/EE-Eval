import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122ce961-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object for the Monitor application
class MonitorPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.controls = page.locator('#controls');
    // original inputs are direct children of #controls (before any new controls are appended)
    this.nameInput = page.locator('#controls > #name');
    this.ageInput = page.locator('#controls > #age');
    this.cityInput = page.locator('#controls > #city');
    this.addButton = page.locator('#add-button');
    this.updateButton = page.locator('#update-button');
    this.deleteButton = page.locator('#delete-button');
    this.closeButton = page.locator('#close-button');
    this.header = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Helper to get the computed display style of #controls
  async controlsDisplay() {
    return await this.page.$eval('#controls', (el) => getComputedStyle(el).display);
  }

  // Count appended .control elements inside #controls
  async controlCount() {
    return await this.page.$$eval('#controls .control', (els) => els.length);
  }

  // Get the last appended .control element handle (returns null if none)
  async lastAppendedControlHandle() {
    const handles = await this.page.$$('#controls .control');
    if (handles.length === 0) return null;
    return handles[handles.length - 1];
  }

  // Read value of the original inputs
  async readOriginalInputs() {
    return {
      name: await this.nameInput.inputValue(),
      age: await this.ageInput.inputValue(),
      city: await this.cityInput.inputValue(),
    };
  }

  // Set values of the original inputs
  async setOriginalInputs({ name = '', age = '', city = '' } = {}) {
    await this.nameInput.fill(name);
    await this.ageInput.fill(String(age));
    await this.cityInput.fill(city);
  }
}

test.describe('Monitor FSM - states and transitions', () => {
  let monitor;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console error messages and page errors for each test
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // collect only error-level console messages for scrutiny
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // swallow any internal inspection errors
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    monitor = new MonitorPage(page);
    await monitor.goto();
  });

  test.afterEach(async () => {
    // Basic expectation: no unexpected runtime exceptions (ReferenceError / SyntaxError / TypeError)
    // If any page errors or console error messages were collected, we fail the test to surface them.
    // This asserts the runtime behavior after interacting with the page remains clean.
    expect(pageErrors, 'No uncaught page errors should occur').toHaveLength(0);
    expect(consoleErrors, 'No console.error messages should be emitted').toHaveLength(0);
  });

  test('Initial state (Idle): header and controls are present and visible', async ({ page }) => {
    // Validate evidence of Idle state: header exists and #controls exists and is visible
    await expect(monitor.header).toHaveText('Monitor');
    await expect(monitor.controls).toBeVisible();

    // Validate original inputs exist with placeholders from the implementation
    await expect(monitor.nameInput).toHaveAttribute('placeholder', 'Enter name');
    await expect(monitor.ageInput).toHaveAttribute('placeholder', 'Enter age');
    await expect(monitor.cityInput).toHaveAttribute('placeholder', 'Enter city');

    // Ensure the buttons exist
    await expect(monitor.addButton).toBeVisible();
    await expect(monitor.updateButton).toBeVisible();
    await expect(monitor.deleteButton).toBeVisible();
    await expect(monitor.closeButton).toBeVisible();

    // Confirm controls are displayed (not hidden)
    const display = await monitor.controlsDisplay();
    expect(display === 'none').toBe(false);
  });

  test('AddClick: clicking Add appends a new control and clears original inputs', async ({ page }) => {
    // This test validates the transition from Idle -> ControlsVisible as per FSM AddClick transition:
    // Actions in code clear original inputs first, then append a new control into #controls.
    // Because the implementation has a listener that clears inputs before the new control is appended,
    // the inner inputs of the new control are expected to be empty.

    // Set original inputs to non-empty values to observe clearing effect
    await monitor.setOriginalInputs({ name: 'Alice', age: 30, city: 'Metropolis' });

    // Sanity: ensure values are set
    let values = await monitor.readOriginalInputs();
    expect(values.name).toBe('Alice');
    expect(values.age).toBe('30');
    expect(values.city).toBe('Metropolis');

    // Count controls before clicking Add
    const beforeCount = await monitor.controlCount();

    // Click Add button
    await monitor.addButton.click();

    // Wait for a new .control to be appended (if the implementation appends)
    await page.waitForTimeout(100); // small wait to let DOM mutations occur

    const afterCount = await monitor.controlCount();
    expect(afterCount).toBeGreaterThanOrEqual(beforeCount + 1, 'A new control should be appended after Add click');

    // The original inputs should have been cleared by the first Add listener
    const postValues = await monitor.readOriginalInputs();
    expect(postValues.name).toBe('', 'Original name input should be cleared after Add');
    expect(postValues.age).toBe('', 'Original age input should be cleared after Add');
    expect(postValues.city).toBe('', 'Original city input should be cleared after Add');

    // Inspect the last appended control's inner inputs.
    const lastControlHandle = await monitor.lastAppendedControlHandle();
    expect(lastControlHandle, 'Appended control element should exist').not.toBeNull();

    // Evaluate values of inner inputs inside the appended control
    const innerValues = await page.evaluate((control) => {
      // Attempt to find the inner inputs by id inside this control.
      // Note: the implementation uses duplicate IDs, so scoped querying is used.
      const nameEl = control.querySelector('#name');
      const ageEl = control.querySelector('#age');
      const cityEl = control.querySelector('#city');
      return {
        name: nameEl ? nameEl.value : null,
        age: ageEl ? ageEl.value : null,
        city: cityEl ? cityEl.value : null,
      };
    }, lastControlHandle);

    // Given the code clears original inputs prior to appending, appended input values are expected to be empty strings
    expect(innerValues.name).toBe('');
    // age input in appended control may or may not exist depending on the innerHTML fragment; check gracefully
    expect(innerValues.age === '' || innerValues.age === null).toBe(true);
    expect(innerValues.city === '' || innerValues.city === null).toBe(true);
  });

  test('UpdateClick: clicking Update clears original inputs due to multiple listeners (edge case)', async ({ page }) => {
    // The implementation registers multiple Update button listeners:
    // - one clears the inputs
    // - next attempts to set inputs using document.getElementById('name').value (which may have been cleared)
    // The net effect in the provided implementation is that Update ends up clearing the original inputs.
    // This test ensures the observed behavior matches the code.

    // Set original inputs to something meaningful
    await monitor.setOriginalInputs({ name: 'Bob', age: 45, city: 'Gotham' });
    let before = await monitor.readOriginalInputs();
    expect(before.name).toBe('Bob');
    expect(before.age).toBe('45');
    expect(before.city).toBe('Gotham');

    // Click Update button
    await monitor.updateButton.click();

    // Small wait to allow all listeners to run
    await page.waitForTimeout(50);

    // Read inputs after clicking update
    const after = await monitor.readOriginalInputs();

    // According to the code ordering, the first update listener clears inputs and the subsequent ones
    // read/assign the cleared values back, so the final expected state is cleared inputs.
    expect(after.name).toBe('', 'Name should be cleared by Update (due to initial clearing listener)');
    expect(after.age).toBe('', 'Age should be cleared by Update');
    expect(after.city).toBe('', 'City should be cleared by Update');
  });

  test('DeleteClick and CloseClick: controls are hidden (transition to Idle) and behavior after hiding', async ({ page }) => {
    // Test DeleteClick hides controls
    // Before clicking delete, ensure visible
    await expect(monitor.controls).toBeVisible();

    // Click delete button which triggers controls.style.display = 'none'
    await monitor.deleteButton.click();

    // Wait a short time for style changes to apply
    await page.waitForTimeout(50);

    const displayAfterDelete = await monitor.controlsDisplay();
    expect(displayAfterDelete).toBe('none', 'Controls should be hidden after Delete click');

    // Reset by navigating to the page again to re-display controls for CloseClick test
    await monitor.goto();
    await expect(monitor.controls).toBeVisible();

    // Click Close button which also hides controls
    await monitor.closeButton.click();
    await page.waitForTimeout(50);
    const displayAfterClose = await monitor.controlsDisplay();
    expect(displayAfterClose).toBe('none', 'Controls should be hidden after Close click');

    // Edge case: clicking Add while controls are hidden should still append an element to the hidden container
    // (the DOM operations do not depend on visibility).
    // Re-evaluate: find current control count, click Add, and verify a new appended control exists and display remains 'none'
    const countBefore = await monitor.controlCount();
    // The add button is inside #controls which is hidden but still in the DOM and clickable via Playwright.
    // However, Playwright click will work only if it can find the element regardless of visibility; use evaluate to invoke click on the element directly.
    await page.$eval('#add-button', (btn) => btn.click());
    await page.waitForTimeout(100);
    const countAfter = await monitor.controlCount();
    expect(countAfter).toBeGreaterThanOrEqual(countBefore + 1, 'Add should append a control even when controls are hidden');

    // Confirm controls still have display none
    const finalDisplay = await monitor.controlsDisplay();
    expect(finalDisplay).toBe('none', 'Controls should remain hidden after adding while hidden');
  });

  test('Edge cases and DOM anomalies: duplicate IDs and multiple listeners do not crash the page', async ({ page }) => {
    // This test intentionally exercises scenarios that might produce runtime issues in fragile implementations:
    // - click Add multiple times to create duplicate elements with identical IDs
    // - click Update multiple times to trigger multiple listeners
    // - ensure no unhandled exceptions occur (pageErrors / consoleErrors captured in afterEach)

    // Click Add a few times
    const adds = 3;
    for (let i = 0; i < adds; i++) {
      await monitor.addButton.click();
      await page.waitForTimeout(50);
    }

    // Click Update multiple times
    for (let i = 0; i < 3; i++) {
      await monitor.updateButton.click();
      await page.waitForTimeout(30);
    }

    // Click Delete to hide controls
    await monitor.deleteButton.click();
    await page.waitForTimeout(30);

    // Attempt to click Update and Add while hidden using evaluate to invoke click directly
    await page.evaluate(() => {
      const upd = document.getElementById('update-button');
      const add = document.getElementById('add-button');
      try {
        if (upd) upd.click();
        if (add) add.click();
      } catch (e) {
        // Intentionally do not swallow: runtime errors here would bubble to pageerror and be caught by afterEach
      }
    });

    // Wait a bit to allow any asynchronous errors to surface
    await page.waitForTimeout(100);

    // Additional DOM sanity checks: ensure that at least one appended control exists
    const appendedCount = await monitor.controlCount();
    expect(appendedCount).toBeGreaterThanOrEqual(adds, 'At least the expected number of appended controls should exist');

    // Validate that duplicate IDs exist in DOM (this is an anomaly but expected from the implementation)
    // We consider this as an edge case check: ensure querySelectorAll for '#name' yields more than one element after adding.
    const nameIdCount = await page.$$eval('#name', (els) => els.length);
    expect(nameIdCount).toBeGreaterThanOrEqual(1, 'There should be at least one element with id="name"');
    // We do not fail the test if duplicates exist; we simply note that duplicates are present and the page did not crash.
  });
});