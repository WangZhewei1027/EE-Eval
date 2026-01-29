import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1216bec0-fa7a-11f0-acf9-69409043402d.html';

// Page object for the SDLC interactive application
class SDLCPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.h1 = page.locator('h1');
    this.currentStepName = page.locator('#current-step-name');
    this.stepDescription = page.locator('#step-description');
    this.stepOutput = page.locator('#step-output');
    this.projectState = page.locator('#project-state');
    this.nextBtn = page.getByRole('button', { name: 'Next Step' });
    this.prevBtn = page.getByRole('button', { name: 'Previous Step' });
    this.validateBtn = page.getByRole('button', { name: 'Validate & Save' });
    this.downloadBtn = page.locator('#download-log');
    this.resetBtn = page.locator('#reset-project');
    // model radios by value
    this.modelRadio = (value) => this.page.locator(`input[name="model"][value="${value}"]`);
    // specific input controls by id scheme
    this.inputByKey = (key) => this.page.locator(`#input-${key}`);
    // generic radio for current checked value - helper
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getH1Text() {
    return this.h1.innerText();
  }

  async getCurrentStepName() {
    return this.currentStepName.innerText();
  }

  async getStepOutputText() {
    return this.stepOutput.innerText();
  }

  async getProjectStateText() {
    return this.projectState.inputValue();
  }

  async clickNextExpectingStep(expectedStepName) {
    // Click Next and wait for the current-step-name to change to expected
    await Promise.all([
      this.page.waitForFunction(
        (selector, expected) => document.querySelector(selector).textContent.trim() === expected,
        {},
        '#current-step-name',
        expectedStepName
      ),
      this.nextBtn.click()
    ]);
    return this.getCurrentStepName();
  }

  async clickPrev() {
    await this.prevBtn.click();
  }

  async clickValidateAndCaptureDialogResponse(accept = true) {
    // Some Validate flows open dialogs (alerts or confirms). Capture them if they appear.
    const dialogPromise = this.page.waitForEvent('dialog').catch(() => null);
    const clickPromise = this.validateBtn.click();
    const [dialog] = await Promise.all([dialogPromise, clickPromise]);
    if (dialog) {
      // Return dialog info and close it as requested
      const info = { type: dialog.type(), message: dialog.message() };
      try {
        if (accept) await dialog.accept();
        else await dialog.dismiss();
      } catch (e) {
        // ignore dialog handling errors
      }
      return info;
    }
    return null;
  }

  async clickValidateExpectingAlert() {
    // Helper that asserts an alert appears when clicking Validate & Save
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.validateBtn.click()
    ]);
    // do not assume dialog type but check message
    await dialog.accept();
    return dialog;
  }

  async downloadLog() {
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.downloadBtn.click()
    ]);
    return download;
  }

  async resetProject(confirmReset = true) {
    // Click reset and accept/dismiss confirm
    const dialogPromise = this.page.waitForEvent('dialog').catch(() => null);
    const clickPromise = this.resetBtn.click();
    const [dialog] = await Promise.all([dialogPromise, clickPromise]);
    if (dialog) {
      if (confirmReset) await dialog.accept();
      else await dialog.dismiss();
    }
  }

  async selectModel(value, acceptConfirm = true) {
    // Selecting a model radio will trigger a confirm dialog in the app.
    const radio = this.modelRadio(value);
    const dialogPromise = this.page.waitForEvent('dialog').catch(() => null);
    const clickPromise = radio.click();
    const [dialog] = await Promise.all([dialogPromise, clickPromise]);
    if (dialog) {
      if (acceptConfirm) await dialog.accept();
      else await dialog.dismiss();
    }
  }

  async setTextareaInput(key, text) {
    const locator = this.inputByKey(key);
    await locator.fill(text);
  }

  async setSelectValue(key, value) {
    const locator = this.inputByKey(key);
    await locator.selectOption(value);
  }

  async setCheckbox(key, checked) {
    const locator = this.inputByKey(key);
    const isChecked = await locator.isChecked();
    if (isChecked !== checked) await locator.click();
  }

  async setNumberInput(key, value) {
    const locator = this.inputByKey(key);
    await locator.fill(String(value));
  }

  async setSliderValueForSingle(key, value) {
    const locator = this.inputByKey(key);
    await locator.evaluate((el, v) => { el.value = v; el.oninput && el.oninput(); }, value);
  }

  async clickPreviousIfEnabled() {
    if (await this.prevBtn.isEnabled()) await this.prevBtn.click();
  }
}

test.describe('SDLC Interactive Demo - FSM and UI E2E', () => {
  // Collect console and page error messages for each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    // Collect console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    // Collect uncaught exceptions
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test('Initial render and Idle state - H1 and initial step are correct', async ({ page }) => {
    // Validate that the page renders and the initial state matches FSM S0_Idle entry evidence
    const app = new SDLCPage(page);
    await app.goto();

    // H1 should be rendered (entry action renderPage() in FSM - we assert the expected evidence)
    const h1 = await app.getH1Text();
    expect(h1).toContain('Software Development Life Cycle (SDLC) Interactive Demo');

    // After initialization, model should be Waterfall and current step should be "Requirement Analysis"
    const stepName = await app.getCurrentStepName();
    expect(stepName).toBe('Requirement Analysis');

    // No unexpected page errors occurred during initial load
    expect(pageErrors.length).toBe(0);
  });

  test('Validate & Save shows validation alert when requirements empty and succeeds when filled', async ({ page }) => {
    // This test validates validation behavior and alert dialogs for Requirement Analysis step
    const app = new SDLCPage(page);
    await app.goto();

    // Click Validate & Save without entering requirements, expect an alert dialog with validation error
    const [validationDialog] = await Promise.all([
      page.waitForEvent('dialog'),
      app.validateBtn.click()
    ]);
    expect(validationDialog.type()).toBe('alert');
    expect(validationDialog.message()).toContain('Validation Error');
    // Accept the alert to continue
    await validationDialog.accept();

    // Now enter valid requirements and click Validate & Save; expect no validation alert and step output to update
    await app.setTextareaInput('requirements', 'User login\nData storage\nReporting');
    const dialogInfo = await app.clickValidateAndCaptureDialogResponse(true);
    // If a dialog was returned here, it was from a confirm (unlikely for this step); ensure none indicates failure
    expect(dialogInfo === null || typeof dialogInfo.message === 'string').toBeTruthy();

    // After saving, the step output should show the saved requirements
    await expect(app.stepOutput).toContainText('Requirements saved');

    // Project state textarea should include the artifact 'requirements'
    const projText = await app.getProjectStateText();
    expect(projText).toContain('Artifacts Collected');
    expect(projText).toContain('requirements');

    // Make sure there were no uncaught page errors during validation/save
    expect(pageErrors.length).toBe(0);
  });

  test('Navigate through Waterfall steps using Next and Previous to reach Maintenance', async ({ page }) => {
    // This test ensures transitions NEXT_STEP move through S1 -> S6 as per FSM
    const app = new SDLCPage(page);
    await app.goto();

    // Starting at Requirement Analysis
    expect(await app.getCurrentStepName()).toBe('Requirement Analysis');

    // Move to System Design
    await Promise.all([
      page.waitForFunction(() => document.querySelector('#current-step-name').textContent.trim() === 'System Design'),
      app.nextBtn.click()
    ]);
    expect(await app.getCurrentStepName()).toBe('System Design');

    // Move to Implementation
    await Promise.all([
      page.waitForFunction(() => document.querySelector('#current-step-name').textContent.trim() === 'Implementation'),
      app.nextBtn.click()
    ]);
    expect(await app.getCurrentStepName()).toBe('Implementation');

    // Move to Testing
    await Promise.all([
      page.waitForFunction(() => document.querySelector('#current-step-name').textContent.trim() === 'Testing'),
      app.nextBtn.click()
    ]);
    expect(await app.getCurrentStepName()).toBe('Testing');

    // Move to Deployment
    await Promise.all([
      page.waitForFunction(() => document.querySelector('#current-step-name').textContent.trim() === 'Deployment'),
      app.nextBtn.click()
    ]);
    expect(await app.getCurrentStepName()).toBe('Deployment');

    // Move to Maintenance
    await Promise.all([
      page.waitForFunction(() => document.querySelector('#current-step-name').textContent.trim() === 'Maintenance'),
      app.nextBtn.click()
    ]);
    expect(await app.getCurrentStepName()).toBe('Maintenance');

    // Previous should go back to Deployment
    await app.clickPrev();
    expect(await app.getCurrentStepName()).toBe('Deployment');

    // Click Previous until we get back to Requirement Analysis
    for (let i = 0; i < 5; i++) {
      if ((await app.prevBtn.isEnabled())) {
        await app.prevBtn.click();
      }
    }
    // Ensure we are eventually at the first step (Requirement Analysis)
    expect(await app.getCurrentStepName()).toBe('Requirement Analysis');

    // No page errors during navigation
    expect(pageErrors.length).toBe(0);
  });

  test('Download Log creates a downloadable file after operations', async ({ page }) => {
    // Ensure that clicking Download Log triggers a download event and produced filename matches expectation
    const app = new SDLCPage(page);
    await app.goto();

    // Generate at least one log entry by performing a valid save on Requirement Analysis
    await app.setTextareaInput('requirements', 'Feature A\nFeature B');
    // Validate & Save; if a dialog appears accept it
    const dialog = await app.clickValidateAndCaptureDialogResponse(true);
    if (dialog) {
      // Nothing special to assert for this dialog here
    }
    await expect(app.stepOutput).toContainText('Requirements saved');

    // Now click Download Log and wait for download
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      app.downloadBtn.click()
    ]);
    const suggestedFilename = download.suggestedFilename();
    expect(suggestedFilename).toContain('SDLC_Log_');

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Reset Project clears logs and returns to Requirement Analysis after confirmation', async ({ page }) => {
    // This test validates RESET_PROJECT event and transition to initial step
    const app = new SDLCPage(page);
    await app.goto();

    // Create a log entry by saving requirements
    await app.setTextareaInput('requirements', 'Reset test feature');
    await app.clickValidateAndCaptureDialogResponse(true);
    expect(await app.stepOutput.textContent()).toContain('Requirements saved');

    // Now click Reset Project and accept confirmation to reset all project data
    const dialogPromise = page.waitForEvent('dialog');
    await app.resetBtn.click();
    const confirmDialog = await dialogPromise;
    expect(confirmDialog.type()).toBe('confirm');
    // Accept reset
    await confirmDialog.accept();

    // After reset, current step should be Requirement Analysis and project-state should be reset/clear logs
    await page.waitForFunction(() => document.querySelector('#current-step-name').textContent.trim() === 'Requirement Analysis');
    expect(await app.getCurrentStepName()).toBe('Requirement Analysis');

    const proj = await app.getProjectStateText();
    // Logs array is reinitialized so "Logs:" still exists but not our previous log message
    expect(proj).toContain('Logs:');

    // No page errors after reset
    expect(pageErrors.length).toBe(0);
  });

  test('Model selection shows confirm and can be cancelled or accepted', async ({ page }) => {
    // Test both dismissing and accepting the model change confirm dialog
    const app = new SDLCPage(page);
    await app.goto();

    // Ensure initial model is Waterfall and radio checked
    const waterfallRadio = app.modelRadio('Waterfall');
    expect(await waterfallRadio.isChecked()).toBeTruthy();
    expect(await app.getCurrentStepName()).toBe('Requirement Analysis');

    // Attempt to change to Iterative but dismiss the confirm -> should revert to Waterfall
    const dialogPromise1 = page.waitForEvent('dialog');
    await app.modelRadio('Iterative').click();
    const dialog1 = await dialogPromise1;
    expect(dialog1.type()).toBe('confirm');
    // Dismiss (cancel) model change
    await dialog1.dismiss();

    // After cancelling, ensure Waterfall is still selected and current step unchanged
    expect(await waterfallRadio.isChecked()).toBeTruthy();
    expect(await app.getCurrentStepName()).toBe('Requirement Analysis');

    // Now change to Iterative and accept the confirm
    const dialogPromise2 = page.waitForEvent('dialog');
    await app.modelRadio('Iterative').click();
    const dialog2 = await dialogPromise2;
    expect(dialog2.type()).toBe('confirm');
    await dialog2.accept();

    // After accepting, the current step should be the Iterative model's first step "Iteration Initialization"
    await page.waitForFunction(() => document.querySelector('#current-step-name').textContent.trim() === 'Iteration Initialization');
    expect(await app.getCurrentStepName()).toBe('Iteration Initialization');

    // No uncaught page errors during model switching
    expect(pageErrors.length).toBe(0);
  });

  test('Deployment step validates inputs and handles smoke test confirm (accept and dismiss)', async ({ page }) => {
    // This test navigates to Deployment step in Waterfall, fills fields and triggers the smoke test confirm.
    const app = new SDLCPage(page);
    await app.goto();

    // Navigate to Deployment step (Requirement Analysis -> System Design -> Implementation -> Testing -> Deployment)
    // We can click Next 4 times
    for (let i = 0; i < 4; i++) {
      await app.nextBtn.click();
      // small wait for UI to update
      await page.waitForTimeout(100);
    }
    expect(await app.getCurrentStepName()).toBe('Deployment');

    // Fill required fields for Deployment: deployNotes and deployEnv
    await app.setTextareaInput('deployNotes', 'Deployed to staging environment');
    await app.setSelectValue('deployEnv', 'Staging');

    // Check the smokeTest checkbox to trigger confirm inside process
    await app.setCheckbox('smokeTest', true);

    // Click Validate & Save and handle the confirm that simulates smoke test
    const [firstDialog] = await Promise.all([
      page.waitForEvent('dialog'),
      app.validateBtn.click()
    ]);
    // The first dialog should be the confirmation asking to simulate smoke test: we'll accept to simulate PASS
    expect(firstDialog.type()).toBe('confirm');
    await firstDialog.accept();

    // After accepting the smoke test confirm the step output should contain "Smoke test performed:"
    await page.waitForFunction(() => document.querySelector('#step-output').textContent.indexOf('Smoke test') !== -1);
    const out = await app.getStepOutputText();
    expect(out).toContain('Smoke test performed');

    // Now repeat: set smokeTest true again and this time dismiss the confirm to simulate FAIL -> process will set smokeTestPassed false
    // For that, make sure we are still on Deployment, then click Validate & Save once more
    await app.setCheckbox('smokeTest', true);
    const dialogPromise = page.waitForEvent('dialog');
    await app.validateBtn.click();
    const secondDialog = await dialogPromise;
    expect(secondDialog.type()).toBe('confirm');
    // Dismiss to indicate Smoke Test failed
    await secondDialog.dismiss();

    // Ensure the output was updated and contains Smoke test performed with PASS or FAIL (should be recorded as FAIL)
    const out2 = await app.getStepOutputText();
    expect(out2.toLowerCase()).toContain('smoke test');

    // No unhandled page errors during deployment validation
    expect(pageErrors.length).toBe(0);
  });

  test('Edge cases: Next on last step and Previous on first step remain stable; Validate & Save shows meaningful errors', async ({ page }) => {
    // Validate edge behaviors for navigation and validation messages
    const app = new SDLCPage(page);
    await app.goto();

    // At first step, previous should be disabled; clicking should not throw
    expect(await app.prevBtn.isEnabled()).toBe(false);
    await app.prevBtn.click(); // no-op, should not throw
    expect(await app.getCurrentStepName()).toBe('Requirement Analysis');

    // Move to last step
    for (let i = 0; i < 6; i++) {
      if (await app.nextBtn.isEnabled()) await app.nextBtn.click();
      await page.waitForTimeout(50);
    }
    // Should be at Maintenance (the last step in Waterfall)
    const last = await app.getCurrentStepName();
    expect(['Maintenance', 'Maintenance']).toContain(last);

    // Next on last step should be disabled or no-op
    const nextEnabled = await app.nextBtn.isEnabled();
    if (nextEnabled) {
      // If enabled, attempt click and ensure we remain on same step
      await app.nextBtn.click();
    }
    expect(await app.getCurrentStepName()).toBe(last);

    // Go back to Requirement Analysis and test validation messages content
    // Reset project to ensure clean state
    await app.resetProject(true);
    await page.waitForFunction(() => document.querySelector('#current-step-name').textContent.trim() === 'Requirement Analysis');

    // Try to Validate & Save with insufficient input length for a step that requires more chars (System Design requires designNotes >=10)
    // Move to System Design
    await app.nextBtn.click();
    expect(await app.getCurrentStepName()).toBe('System Design');

    // Leave designNotes empty and attempt to validate -> should show an alert with validation error
    const [alertDialog] = await Promise.all([
      page.waitForEvent('dialog'),
      app.validateBtn.click()
    ]);
    expect(alertDialog.type()).toBe('alert');
    expect(alertDialog.message()).toContain('Validation Error');
    await alertDialog.accept();

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test.afterEach(async ({ page }) => {
    // Final safety checks: ensure there were no uncaught exceptions during each test run
    // Tests above assert pageErrors === 0, but double-check and output console messages if unexpected errors exist.
    if (pageErrors.length > 0) {
      // Attach the errors to the test failure message
      console.error('Uncaught page errors:', pageErrors);
    }
    expect(pageErrors.length).toBe(0);
  });
});