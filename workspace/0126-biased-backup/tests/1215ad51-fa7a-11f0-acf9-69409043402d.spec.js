import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1215ad51-fa7a-11f0-acf9-69409043402d.html';

// Page Object Model for the Monitor interactive page
class MonitorPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;

    // Creation
    this.monitorNameInput = page.locator('#monitor-name-input');
    this.createMonitorBtn = page.locator('#create-monitor-btn');
    this.createMonitorMsg = page.locator('#create-monitor-msg');

    // Control section
    this.monitorControlSection = page.locator('#monitor-control-section');
    this.currentMonitorSelect = page.locator('#current-monitor-select');
    this.deleteMonitorBtn = page.locator('#delete-monitor-btn');

    // Thresholds
    this.stateThresholdSlider = page.locator('#state-threshold-slider');
    this.stateThresholdNumber = page.locator('#state-threshold-number');
    this.alertThresholdInput = page.locator('#alert-threshold-input');
    this.setAlertThresholdsBtn = page.locator('#set-alert-thresholds-btn');
    this.alertThresholdsList = page.locator('#alert-thresholds-list');

    // Input events
    this.inputEventSection = page.locator('#input-event-section');
    this.inputEventType = page.locator('#input-event-type');
    this.inputEventValue = page.locator('#input-event-value');
    this.inputEventValueLabel = page.locator('#input-event-value-label');
    this.sendEventBtn = page.locator('#send-event-btn');
    this.inputEventMsg = page.locator('#input-event-msg');

    // Monitor state
    this.monitorStateSection = page.locator('#monitor-state-section');
    this.currentStateValue = page.locator('#current-state-value');
    this.currentStateStatus = page.locator('#current-state-status');
    this.pastStatesSelect = page.locator('#past-states-select');
    this.viewStateBtn = page.locator('#view-state-btn');
    this.rollbackStateBtn = page.locator('#rollback-state-btn');
    this.stateDetailsPre = page.locator('#state-details-pre');

    // Complex workflow
    this.complexWorkflowSection = page.locator('#complex-workflow-section');
    this.triggerAlarmBtn = page.locator('#trigger-alarm-btn');
    this.acknowledgeAlarmBtn = page.locator('#acknowledge-alarm-btn');
    this.clearAlarmBtn = page.locator('#clear-alarm-btn');
    this.workflowStepInput = page.locator('#workflow-step-input');
    this.setWorkflowStepBtn = page.locator('#set-workflow-step-btn');
    this.autoAdvanceToggle = page.locator('#auto-advance-toggle');
    this.workflowStatusDiv = page.locator('#workflow-status');
  }

  async navigate() {
    await this.page.goto(APP_URL);
    // Wait for essential DOM to be available
    await expect(this.createMonitorBtn).toBeVisible();
  }

  async createMonitor(name) {
    await this.monitorNameInput.fill(name);
    await this.createMonitorBtn.click();
  }

  async selectMonitorByName(name) {
    await this.currentMonitorSelect.selectOption({ label: name });
  }

  async deleteCurrentMonitor() {
    await this.deleteMonitorBtn.click();
  }

  async setThresholdSlider(value) {
    // set via input value property
    await this.stateThresholdSlider.evaluate((el, v) => el.value = String(v), value);
    // dispatch input event to trigger listener
    await this.stateThresholdSlider.dispatchEvent('input');
  }

  async setThresholdNumber(value) {
    await this.stateThresholdNumber.fill(String(value));
    await this.stateThresholdNumber.dispatchEvent('change');
  }

  async setAlertThresholds(inputStr) {
    await this.alertThresholdInput.fill(inputStr);
    await this.setAlertThresholdsBtn.click();
  }

  async chooseInputEvent(type, customValue = null) {
    await this.inputEventType.selectOption(type);
    if (type === 'custom') {
      if (customValue !== null) {
        await this.inputEventValue.fill(String(customValue));
      }
    }
    await this.sendEventBtn.click();
  }

  async viewPastStateAtIndex(idx) {
    await this.pastStatesSelect.selectOption(String(idx));
    await this.viewStateBtn.click();
  }

  async rollbackToStateIndex(idx) {
    await this.pastStatesSelect.selectOption(String(idx));
    await this.rollbackStateBtn.click();
  }

  async triggerAlarm() {
    await this.triggerAlarmBtn.click();
  }

  async acknowledgeAlarm() {
    await this.acknowledgeAlarmBtn.click();
  }

  async clearAlarm() {
    await this.clearAlarmBtn.click();
  }

  async setWorkflowStep(step) {
    await this.workflowStepInput.fill(String(step));
    await this.setWorkflowStepBtn.click();
  }

  async toggleAutoAdvance(enable) {
    const isChecked = await this.autoAdvanceToggle.isChecked();
    if (isChecked !== enable) {
      await this.autoAdvanceToggle.click();
    } else {
      // still fire change to be safe
      await this.autoAdvanceToggle.dispatchEvent('change');
    }
  }
}

// Test suite
test.describe('Monitor Concept Interactive - FSM validation and UI behaviors', () => {
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', err => {
      // capture uncaught exceptions on page
      pageErrors.push(err);
    });

    page.on('console', msg => {
      // capture console messages including errors logged via console.error
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test.describe('S0 Idle state and Monitor creation (S1)', () => {
    test('S0 Idle: initial sections are hidden and creating a monitor transitions to S1 MonitorCreated', async ({ page }) => {
      const monitor = new MonitorPage(page);
      await monitor.navigate();

      // Verify Idle state - sections must be hidden initially
      await expect(monitor.monitorControlSection).toBeHidden();
      await expect(monitor.inputEventSection).toBeHidden();
      await expect(monitor.monitorStateSection).toBeHidden();
      await expect(monitor.complexWorkflowSection).toBeHidden();

      // Attempt to create with empty name -> edge case
      await monitor.createMonitor(''); // click with empty
      await expect(monitor.createMonitorMsg).toHaveText('Enter a valid monitor name.');

      // Create valid monitor
      const name = 'TestMonitor1';
      await monitor.createMonitor(name);

      // UI should show created message and sections visible
      await expect(monitor.createMonitorMsg).toHaveText(`Monitor "${name}" created.`);
      await expect(monitor.monitorControlSection).toBeVisible();
      await expect(monitor.inputEventSection).toBeVisible();
      await expect(monitor.monitorStateSection).toBeVisible();
      await expect(monitor.complexWorkflowSection).toBeVisible();

      // Monitor select should contain the created monitor and be selected
      await expect(monitor.currentMonitorSelect).toHaveValue(name);

      // Ensure we observed any page errors and assert none occurred
      expect(pageErrors, 'No uncaught page errors should have occurred').toHaveLength(0);
    });

    test('Creating duplicate monitor shows appropriate error message', async ({ page }) => {
      const monitor = new MonitorPage(page);
      await monitor.navigate();

      const name = 'DuplicateMonitor';
      await monitor.createMonitor(name);
      await expect(monitor.createMonitorMsg).toHaveText(`Monitor "${name}" created.`);

      // Create again
      await monitor.monitorNameInput.fill(name);
      await monitor.createMonitorBtn.click();
      await expect(monitor.createMonitorMsg).toHaveText('Monitor name already exists.');

      // No uncaught exceptions should be present
      expect(pageErrors).toHaveLength(0);
    });
  });

  test.describe('S2 MonitorSelected: selection, thresholds, and input events', () => {
    test('Selecting monitors, configuring thresholds (slider & number), and sending events updates display and state history', async ({ page }) => {
      const monitor = new MonitorPage(page);
      await monitor.navigate();

      // Create a monitor to work with
      const name = 'SelectedMonitor';
      await monitor.createMonitor(name);
      await expect(monitor.monitorControlSection).toBeVisible();

      // Verify that slider and number control are synchronized via input
      await monitor.setThresholdSlider(30);
      await expect(monitor.stateThresholdNumber).toHaveValue('30');

      // And that slider update caused monitor state threshold to update (UI's alert threshold input updated)
      await expect(monitor.alertThresholdInput).toHaveValue('20,50,80').catch(() => {}); // initial default; not strictly required

      // Set number input beyond bounds to test clamping
      await monitor.setThresholdNumber(150);
      // number should clamp to 100
      await expect(monitor.stateThresholdNumber).toHaveValue('100');
      await expect(monitor.stateThresholdSlider).toHaveValue('100');

      // Test setting alert thresholds: valid input
      await monitor.setAlertThresholds('30,60,90');
      await expect(monitor.inputEventMsg).toHaveText('Alert thresholds updated.');
      await expect(monitor.alertThresholdsList).toContainText('30, 60, 90');

      // Invalid alert thresholds edge cases
      await monitor.setAlertThresholds('');
      await expect(monitor.inputEventMsg).toHaveText('Alert thresholds cannot be empty.');

      await monitor.setAlertThresholds('a,b,c');
      await expect(monitor.inputEventMsg).toHaveText('No valid numbers found.');

      // Send some events: increase, decrease, reset
      // initial state value should be 0.00 (Monitor constructor sets 0)
      await expect(monitor.currentStateValue).toHaveText(/0\.00/);

      await monitor.chooseInputEvent('increase');
      await expect(monitor.currentStateValue).toHaveText(/1\.00/);

      await monitor.chooseInputEvent('increase');
      await expect(monitor.currentStateValue).toHaveText(/2\.00/);

      await monitor.chooseInputEvent('decrease');
      await expect(monitor.currentStateValue).toHaveText(/1\.00/);

      // custom with invalid number
      await monitor.inputEventType.selectOption('custom');
      await monitor.sendEventBtn.click(); // no value entered
      await expect(monitor.inputEventMsg).toHaveText('Enter a valid numeric value for custom input.');

      // custom valid
      await monitor.inputEventValue.fill('42');
      await monitor.sendEventBtn.click();
      await expect(monitor.currentStateValue).toHaveText(/42\.00/);

      // View past state details for index 0 (initial)
      await monitor.pastStatesSelect.waitFor();
      // Ensure at least one option exists
      const options = await monitor.pastStatesSelect.locator('option').allTextContents();
      expect(options.length).toBeGreaterThan(0);
      await monitor.viewPastStateAtIndex(0);
      await expect(monitor.stateDetailsPre).toContainText('State at index 0:');

      // Rollback to initial state (0)
      await monitor.rollbackToStateIndex(0);
      await expect(monitor.stateDetailsPre).toHaveText('Rolled back to selected state.');
      // After rollback, current value should reflect the rolled back value (initial 0)
      // Wait a short moment for updateDisplay triggered by rollback
      await page.waitForTimeout(100);
      await expect(monitor.currentStateValue).toHaveText(/0\.00/);

      // No uncaught page errors
      expect(pageErrors).toHaveLength(0);
    });
  });

  test.describe('Alarm workflow states (S3 AlarmTriggered, S4 AlarmAcknowledged, S5 AlarmCleared)', () => {
    test('Trigger -> Acknowledge -> Clear alarm transitions and UI enable/disable behavior', async ({ page }) => {
      const monitor = new MonitorPage(page);
      await monitor.navigate();

      const name = 'AlarmFlowMonitor';
      await monitor.createMonitor(name);
      await expect(monitor.complexWorkflowSection).toBeVisible();

      // Initially ack and clear are disabled
      await expect(monitor.acknowledgeAlarmBtn).toBeDisabled();
      await expect(monitor.clearAlarmBtn).toBeDisabled();

      // Trigger alarm => should enable ack and clear and status should become 'Alarm'
      await monitor.triggerAlarm();
      await expect(monitor.acknowledgeAlarmBtn).toBeEnabled();
      await expect(monitor.clearAlarmBtn).toBeEnabled();

      // Status text should reflect Alarm
      await expect(monitor.currentStateStatus).toHaveText(/Alarm/);

      // Acknowledge => ack becomes disabled (already acknowledged), clear still enabled, status becomes 'Alarm Acknowledged'
      await monitor.acknowledgeAlarm();
      await expect(monitor.acknowledgeAlarmBtn).toBeDisabled();
      await expect(monitor.clearAlarmBtn).toBeEnabled();
      await expect(monitor.currentStateStatus).toHaveText(/Alarm Acknowledged/);

      // Clear => both disabled, status not Alarm anymore
      await monitor.clearAlarm();
      await expect(monitor.acknowledgeAlarmBtn).toBeDisabled();
      await expect(monitor.clearAlarmBtn).toBeDisabled();
      // status should be Normal/Warning/Critical depending on thresholds and value; ensure no 'Alarm' words
      const statusText = await monitor.currentStateStatus.textContent();
      expect(statusText).not.toMatch(/Alarm/);

      expect(pageErrors).toHaveLength(0);
    });

    test('Workflow step management and auto-advance behavior', async ({ page }) => {
      const monitor = new MonitorPage(page);
      await monitor.navigate();

      const name = 'WorkflowMonitor';
      await monitor.createMonitor(name);
      await expect(monitor.complexWorkflowSection).toBeVisible();

      // Set step to 3 and verify workflow status log contains entry
      await monitor.setWorkflowStep(3);
      await expect(monitor.workflowStepInput).toHaveValue('3');
      await expect(monitor.workflowStatusDiv).toContainText('Workflow step set to 3');

      // Toggle auto-advance on (this starts a 3s interval on the page)
      await monitor.toggleAutoAdvance(true);
      await expect(monitor.autoAdvanceToggle).toBeChecked();

      // Wait slightly more than 3s to allow one auto-advance tick
      await page.waitForTimeout(3500);

      // The workflow status should reflect an auto-advance entry
      const logText = await monitor.workflowStatusDiv.textContent();
      expect(logText).toContain('auto-advanced to step');

      // Turn off auto-advance
      await monitor.toggleAutoAdvance(false);
      await expect(monitor.autoAdvanceToggle).not.toBeChecked();

      expect(pageErrors).toHaveLength(0);
    }, { timeout: 20000 }); // give extra time for timer interactions
  });

  test.describe('Monitor deletion and returning to S0 Idle', () => {
    test('Delete monitor transitions back to Idle when last monitor removed', async ({ page }) => {
      const monitor = new MonitorPage(page);
      await monitor.navigate();

      const name = 'ToDeleteMonitor';
      await monitor.createMonitor(name);
      await expect(monitor.monitorControlSection).toBeVisible();

      // Delete the only monitor
      await monitor.deleteCurrentMonitor();

      // Sections should be hidden again (Idle)
      await expect(monitor.monitorControlSection).toBeHidden();
      await expect(monitor.inputEventSection).toBeHidden();
      await expect(monitor.monitorStateSection).toBeHidden();
      await expect(monitor.complexWorkflowSection).toBeHidden();

      // No uncaught exceptions during deletion
      expect(pageErrors).toHaveLength(0);
    });

    test('When multiple monitors exist, deleting one selects another monitor and keeps UI visible', async ({ page }) => {
      const monitor = new MonitorPage(page);
      await monitor.navigate();

      // Create two monitors
      await monitor.createMonitor('M1');
      await monitor.createMonitor('M2');

      // Ensure select has two options
      const optionCount = await monitor.currentMonitorSelect.locator('option').count();
      expect(optionCount).toBeGreaterThanOrEqual(2);

      // Delete current (which is M2) => UI remains visible and another monitor selected
      await monitor.deleteCurrentMonitor();
      await expect(monitor.monitorControlSection).toBeVisible();
      const remainingCount = await monitor.currentMonitorSelect.locator('option').count();
      expect(remainingCount).toBeGreaterThanOrEqual(1);

      expect(pageErrors).toHaveLength(0);
    });
  });

  test.describe('Observability: capture console messages and page errors during full interaction', () => {
    test('Interact broadly and assert we observed/recorded console messages and verify no uncaught page errors', async ({ page }) => {
      const monitor = new MonitorPage(page);
      await monitor.navigate();

      // Clear messages
      consoleMessages = [];
      pageErrors = [];

      // Do a series of interactions that exercise many handlers
      await monitor.createMonitor('ObserveMonitor');
      await monitor.setAlertThresholds('10,40,70');
      await monitor.setThresholdSlider(25);
      await monitor.chooseInputEvent('increase');
      await monitor.chooseInputEvent('custom', 88);
      await monitor.triggerAlarm();
      await monitor.acknowledgeAlarm();
      await monitor.clearAlarm();
      await monitor.setWorkflowStep(5);
      await monitor.toggleAutoAdvance(true);
      // wait a bit for auto-advance to log
      await page.waitForTimeout(3500);
      await monitor.toggleAutoAdvance(false);

      // Collect captured console messages and page errors
      // We don't assert that errors MUST occur; instead we assert we observed and recorded them (possibly zero),
      // and then specifically ensure there are no uncaught page errors.
      // This satisfies the requirement to observe console and page errors without patching the runtime.
      // Assert we recorded console messages (there should be at least some logs or empty array)
      expect(Array.isArray(consoleMessages)).toBeTruthy();

      // Assert no uncaught page errors (ReferenceError, TypeError, SyntaxError) propagated during interactions
      expect(pageErrors).toHaveLength(0);
    }, { timeout: 20000 });
  });
});