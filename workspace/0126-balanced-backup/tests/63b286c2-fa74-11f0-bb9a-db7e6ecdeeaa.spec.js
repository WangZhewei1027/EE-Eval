import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b286c2-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for the Process Demo
class ProcessPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.steps = [
      page.locator('#step1'),
      page.locator('#step2'),
      page.locator('#step3'),
      page.locator('#step4'),
      page.locator('#step5'),
    ];
  }

  // Returns index (0-based) of the currently active step, or -1 if none
  async getActiveStepIndex() {
    return await this.page.evaluate(() => {
      const steps = Array.from(document.querySelectorAll('.step'));
      const idx = steps.findIndex(s => s.classList.contains('active'));
      return idx;
    });
  }

  // Wait until the given step index is active (0-based). Timeout in ms.
  async waitForActiveStep(index, timeout = 3000) {
    await this.page.waitForFunction(
      (idx) => {
        const steps = Array.from(document.querySelectorAll('.step'));
        return steps[idx] && steps[idx].classList.contains('active');
      },
      index,
      { timeout }
    );
  }

  // Return whether start button is disabled
  async isStartDisabled() {
    return await this.startBtn.isDisabled();
  }

  // Get text content of a step element
  async stepText(index) {
    return await this.steps[index].innerText();
  }
}

test.describe('Demonstration of Process Concept - FSM end-to-end', () => {
  // Keep captured console messages and page errors per test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];

    // Listen to console events
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Listen to uncaught errors on the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the application
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Basic sanity: no unexpected page errors should have occurred during tests
    // We assert this explicitly at the end of each test where appropriate as well.
    // This afterEach ensures we have captured any errors and they are available for debugging if needed.
  });

  test('Initial state (S0_Idle): Start button present and no step highlighted', async ({ page }) => {
    // This test validates the Idle state: start button exists and initial DOM state has no active steps.
    const app = new ProcessPage(page);

    // Ensure the start button is visible and enabled
    await expect(app.startBtn).toBeVisible();
    await expect(app.startBtn).toBeEnabled();

    // No step should be active on initial render
    const activeIndex = await app.getActiveStepIndex();
    expect(activeIndex).toBe(-1);

    // Verify step text content matches FSM components
    await expect(app.steps[0]).toHaveText('Step 1: Gather Requirements');
    await expect(app.steps[1]).toHaveText('Step 2: Design Solution');
    await expect(app.steps[2]).toHaveText('Step 3: Develop Code');
    await expect(app.steps[3]).toHaveText('Step 4: Test Implementation');
    await expect(app.steps[4]).toHaveText('Step 5: Deploy to Production');

    // Ensure no uncaught page errors or console errors observed on load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_Step1 on StartProcess click and button disabled', async ({ page }) => {
    // This test verifies starting the process triggers the transition to Step 1:
    // - resetSteps() is called (no previous active)
    // - startBtn.disabled becomes true
    // - Step 1 becomes highlighted (active)
    const app = new ProcessPage(page);

    // Listen for any dialog that might appear (there should be none immediately)
    let dialogCaught = false;
    page.on('dialog', async dialog => {
      dialogCaught = true;
      await dialog.accept();
    });

    // Click Start
    await app.startBtn.click();

    // Immediately after click: start button should be disabled
    expect(await app.isStartDisabled()).toBe(true);

    // Step 1 should be active immediately (highlightNextStep() is called synchronously)
    await app.waitForActiveStep(0, 1000);
    expect(await app.getActiveStepIndex()).toBe(0);

    // Ensure no immediate alert/dialog fired
    expect(dialogCaught).toBe(false);

    // Ensure no console/page errors happened
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Complete timed transitions through S2-S5 and final alert, then return to Idle-like state', async ({ page }) => {
    // This test runs the full process and validates each timed transition (Timer event),
    // the final alert on completion, and the exit actions: clearInterval, startBtn.disabled = false.
    const app = new ProcessPage(page);

    // Start the process
    await app.startBtn.click();

    // Step 1 was set immediately; verify it
    await app.waitForActiveStep(0, 1000);
    expect(await app.getActiveStepIndex()).toBe(0);

    // For subsequent steps, wait for the interval to advance (interval = 1500ms).
    // Allow a slight buffer for timers: use 1600ms per tick.
    // Step 2
    await page.waitForTimeout(1600);
    await app.waitForActiveStep(1, 1000);
    expect(await app.getActiveStepIndex()).toBe(1);

    // Step 3
    await page.waitForTimeout(1600);
    await app.waitForActiveStep(2, 1000);
    expect(await app.getActiveStepIndex()).toBe(2);

    // Step 4
    await page.waitForTimeout(1600);
    await app.waitForActiveStep(3, 1000);
    expect(await app.getActiveStepIndex()).toBe(3);

    // Step 5
    await page.waitForTimeout(1600);
    await app.waitForActiveStep(4, 1000);
    expect(await app.getActiveStepIndex()).toBe(4);

    // Wait for the final timer tick that should clear the interval and show an alert.
    // The alert will appear about 1500ms after Step 5 active, so wait for the dialog event.
    const dialog = await page.waitForEvent('dialog', { timeout: 10000 });
    expect(dialog.message()).toBe('Process Complete!');
    // Accept the alert to let the page continue
    await dialog.accept();

    // After accepting the alert, the start button should be re-enabled (exit action)
    await expect(app.startBtn).toBeEnabled();
    expect(await app.isStartDisabled()).toBe(false);

    // Note: Implementation does not remove the 'active' class from step5 on completion,
    // so step5 is expected to remain active. Verify that behavior explicitly.
    expect(await app.getActiveStepIndex()).toBe(4);

    // Ensure that, after completion, no further step transitions occur (clearInterval worked).
    // Wait longer than one interval (1500ms) and assert the active step index stays the same.
    await page.waitForTimeout(2000);
    expect(await app.getActiveStepIndex()).toBe(4);

    // Ensure no console/page errors occurred during the full flow
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  }, { timeout: 20000 }); // extended timeout for full run

  test('Edge case: clicking Start while process running should not be allowed (button disabled)', async ({ page }) => {
    // This test verifies the UI prevents re-start while a process is running by disabling the Start button.
    const app = new ProcessPage(page);

    // Start the process
    await app.startBtn.click();
    await app.waitForActiveStep(0, 1000);

    // The start button should be disabled while running
    expect(await app.isStartDisabled()).toBe(true);

    // Attempting to click a disabled button using page.click should reject/throw.
    // We assert that Playwright will not allow clicking a disabled element (rejects).
    // Wrap the click in a function and assert it rejects.
    const tryClick = async () => {
      // This call is expected to throw because the button is disabled / not enabled for interaction.
      await page.click('#startBtn', { timeout: 1000 });
    };
    await expect(tryClick()).rejects.toThrow();

    // Clean up: wait for completion and accept dialog to avoid affecting other tests
    const dialog = await page.waitForEvent('dialog', { timeout: 10000 });
    await dialog.accept();

    // Assert no page errors occurred
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  }, { timeout: 20000 });

  test('Restarting after completion starts process again (resetSteps invoked on new Start)', async ({ page }) => {
    // This test verifies that after the process completes and the Start button is re-enabled,
    // clicking Start again resets state and begins from Step 1 again.
    const app = new ProcessPage(page);

    // Start first run
    await app.startBtn.click();

    // Progress to completion and accept dialog
    // Wait for final dialog
    const finalDialog1 = await page.waitForEvent('dialog', { timeout: 12000 });
    expect(finalDialog1.message()).toBe('Process Complete!');
    await finalDialog1.accept();

    // After completion, start button should be enabled
    await expect(app.startBtn).toBeEnabled();

    // Click Start again to verify restart
    await app.startBtn.click();

    // Immediately after clicking, Step 1 should be active again
    await app.waitForActiveStep(0, 1000);
    expect(await app.getActiveStepIndex()).toBe(0);

    // Accept the second run's final dialog to leave page clean
    const finalDialog2 = await page.waitForEvent('dialog', { timeout: 12000 });
    expect(finalDialog2.message()).toBe('Process Complete!');
    await finalDialog2.accept();

    // Ensure start button is back enabled at end of second run
    await expect(app.startBtn).toBeEnabled();

    // Confirm no page errors or console errors occurred throughout
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  }, { timeout: 30000 });
});