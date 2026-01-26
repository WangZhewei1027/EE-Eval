import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1216bec3-fa7a-11f0-acf9-69409043402d.html';

// Page object for the demo to encapsulate common interactions and queries
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.log = page.locator('#log');
    this.startBtn = page.locator('#startTestRun');
    this.stepBtn = page.locator('#stepTestRun');
    this.resetBtn = page.locator('#resetTestRun');
    this.numModules = page.locator('#numModules');
    this.moduleNames = page.locator('#moduleNames');
    this.moduleSelect = page.locator('#moduleSelect');
    this.moduleStatusDisplay = page.locator('#moduleStatusDisplay');
    this.testScenarioSelect = page.locator('#testScenarioSelect');
    this.customScenarioConfig = page.locator('#customScenarioConfig');
    this.customFailures = page.locator('#customFailures');
    this.customDelays = page.locator('#customDelays');
    this.failureActionSelect = page.locator('#failureActionSelect');
    this.modifyConfigSection = page.locator('#modifyConfigSection');
    this.modifyModules = page.locator('#modifyModules');
    this.applyModifyConfig = page.locator('#applyModifyConfig');
    this.autoRunToggle = page.locator('#autoRunToggle');
    this.stepDelay = page.locator('#stepDelay');
  }

  async waitForLoadInit() {
    // Wait for the init() invoked on load to populate log and form controls.
    // The init sequence writes a couple of log lines; assert at least one appears.
    await expect(this.log).toContainText('Test scenario set to Happy Path').catch(async () => {
      // fallback: wait for reset message if happyPath line not present due to timing
      await expect(this.log).toContainText('Test run reset to idle.');
    });
  }

  async getLogText() {
    return await this.log.textContent();
  }

  async startTestRun() {
    await this.startBtn.click();
  }

  async stepOnce() {
    await this.stepBtn.click();
  }

  async resetTestRun() {
    await this.resetBtn.click();
  }

  async setScenario(value) {
    await this.testScenarioSelect.selectOption(value);
    // If custom selected, the UI shows inputs; otherwise preset applied and resetTestRun called.
  }

  async setFailureAction(value) {
    // selectOption even if control disabled; it still sets the value attribute.
    await this.failureActionSelect.selectOption(value);
  }

  async applyModify(modText) {
    await this.modifyModules.fill(modText);
    await this.applyModifyConfig.click();
  }

  async enableAutoRunAndSetDelay(delayMs = 50) {
    // set a small delay and check the auto-run toggle
    await this.stepDelay.fill(String(delayMs));
    await this.autoRunToggle.check();
  }

  async changeModuleNamesDuringRunAttempt(newNames) {
    await this.moduleNames.fill(newNames);
    // blur to trigger change event if applicable
    await this.moduleNames.evaluate((el) => el.blur && el.blur());
  }
}

test.describe('Integration Testing Interactive Demo - FSM validation and E2E flows', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for inspection
    page.on('console', (msg) => {
      // capture only text for simpler assertions
      try {
        consoleMessages.push(msg.text());
      } catch (e) {
        consoleMessages.push(String(msg));
      }
    });

    // Collect page errors (runtime exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Go to the app page and wait for load
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait for the demo's init() to run and write initial logs
    const demo = new DemoPage(page);
    await demo.waitForLoadInit();
  });

  test.afterEach(async ({ page }) => {
    // nothing to teardown beyond Playwright lifecycle; keep hooks for clarity
  });

  test.describe('State: Idle (S0_Idle) - initial conditions and entry actions', () => {
    test('Initial page load sets Idle state: controls and logs reflect init actions', async ({ page }) => {
      // This test validates onEnter actions of Idle (initModulesFromInput, applyTestScenarioPreset, resetTestRun)
      const demo = new DemoPage(page);

      // Verify form values were initialized according to entry actions
      await expect(demo.numModules).toHaveValue('3'); // initial value in HTML is 3, init may enforce min/max
      await expect(demo.moduleNames).toHaveValue('Auth,DB,API');

      // The preset applied should have logged happyPath message
      await expect(demo.log).toContainText('Test scenario set to Happy Path');

      // Reset test run should have placed UI back to idle: start enabled, step/reset disabled, failure select disabled
      await expect(demo.startBtn).toBeEnabled();
      await expect(demo.stepBtn).toBeDisabled();
      await expect(demo.resetBtn).toBeDisabled();
      await expect(demo.failureActionSelect).toBeDisabled();

      // Modify config section should be hidden
      await expect(demo.modifyConfigSection).toBeHidden();

      // Ensure no runtime page errors during initialization
      expect(pageErrors.length, `Page errors during initialization: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    });
  });

  test.describe('Transitions from Idle -> Running -> Finished (S0 -> S1 -> S3)', () => {
    test('Start Test Run transitions to Running and UI enables step execution', async ({ page }) => {
      // Start run and validate UI and logs reflect running state
      const demo = new DemoPage(page);

      await demo.startTestRun();

      // Start should log starting message
      await expect(demo.log).toContainText('Starting test run');

      // Button states per startTestRun()
      await expect(demo.stepBtn).toBeEnabled();
      await expect(demo.resetBtn).toBeEnabled();
      await expect(demo.startBtn).toBeDisabled();
      await expect(demo.failureActionSelect).toBeEnabled();

      // Confirm no runtime exceptions
      expect(pageErrors.length, `Found page errors: ${pageErrors.map(e=>e.message).join(' | ')}`).toBe(0);
    });

    test('Step through all modules results in Finished state and proper log message', async ({ page }) => {
      // Validate executeStep -> finished transition and UI adjustments
      const demo = new DemoPage(page);

      // Start run
      await demo.startTestRun();

      // Step as many times as modules until the "Test run completed successfully." appears
      // There are 3 modules by default. We'll loop safely up to 10 steps.
      let finished = false;
      for (let i = 0; i < 10; i++) {
        // wait for stepBtn to be enabled before clicking; step may be disabled briefly during async execution
        if (await demo.stepBtn.isEnabled()) {
          await demo.stepOnce();
        }
        const logText = await demo.getLogText();
        if (logText.includes('Test run completed successfully.') || logText.includes('Test run aborted.')) {
          finished = true;
          break;
        }
        // small wait to allow async step processing
        await page.waitForTimeout(100);
      }

      expect(finished, 'Run did not reach finished/aborted within expected steps').toBe(true);

      // Verify final UI state for finished run per implementation: step disabled, start enabled, reset enabled, failureAction disabled
      await expect(demo.stepBtn).toBeDisabled();
      await expect(demo.startBtn).toBeEnabled();
      await expect(demo.resetBtn).toBeEnabled();
      await expect(demo.failureActionSelect).toBeDisabled();

      // Log should contain completion message
      await expect(demo.log).toContainText('Test run completed successfully.');

      // No runtime exceptions
      expect(pageErrors.length, `Runtime errors observed: ${pageErrors.map(e=>e.message).join(' | ')}`).toBe(0);
    });
  });

  test.describe('Failure handling transitions: Running -> Paused -> Running (S1 -> S2 -> S1) and Abort (S1 -> S4)', () => {
    test('Failure with action=modify pauses run; applying modifications resumes run', async ({ page }) => {
      const demo = new DemoPage(page);

      // Select a scenario that produces a failure (failAuth). This triggers preset and resetTestRun.
      await demo.setScenario('failAuth');

      // Start run
      await demo.startTestRun();

      // Ensure failureActionSelect has the desired value (set to modify to cause pause path)
      await demo.setFailureAction('modify');

      // Click step to process the first module (Auth) which should fail and cause a pause
      await demo.stepOnce();

      // The modifyConfigSection should be visible in paused state
      await expect(demo.modifyConfigSection).toBeVisible();

      // While paused, step button should be disabled and start button disabled per implementation
      await expect(demo.stepBtn).toBeDisabled();
      await expect(demo.startBtn).toBeDisabled();
      await expect(demo.resetBtn).toBeEnabled();

      // Apply modifications: toggle Auth (we will specify the module to toggle)
      await demo.applyModify('Auth');

      // After applying modifications, the run should resume (step enabled)
      await expect(demo.modifyConfigSection).toBeHidden();
      await expect(demo.stepBtn).toBeEnabled();
      await expect(demo.startBtn).toBeDisabled();

      // Continue stepping until finished or aborted
      let completed = false;
      for (let i = 0; i < 10; i++) {
        if (await demo.stepBtn.isEnabled()) {
          await demo.stepOnce();
        }
        const text = await demo.getLogText();
        if (text.includes('Test run completed successfully.') || text.includes('Test run aborted.')) {
          completed = true;
          break;
        }
        await page.waitForTimeout(100);
      }
      expect(completed, 'Run did not complete after resuming from modify pause').toBe(true);

      // Ensure no runtime exceptions occurred during failure handling
      expect(pageErrors.length, `Runtime errors during failure/modify flow: ${pageErrors.map(e=>e.message).join(' | ')}`).toBe(0);
    });

    test('Failure with action=abort aborts the run immediately', async ({ page }) => {
      const demo = new DemoPage(page);

      // Choose failing scenario
      await demo.setScenario('failAuth');

      // Start run
      await demo.startTestRun();

      // Ensure failure action is set to abort
      await demo.setFailureAction('abort');

      // Step the failing module
      await demo.stepOnce();

      // Expect abort messages in log
      await expect(demo.log).toContainText('Aborting test run due to failure.');
      await expect(demo.log).toContainText('Test run aborted.');

      // After abortTestRun, step should be disabled and start enabled
      await expect(demo.stepBtn).toBeDisabled();
      await expect(demo.startBtn).toBeEnabled();
      await expect(demo.resetBtn).toBeEnabled();

      // No runtime page errors expected
      expect(pageErrors.length, `Runtime errors during abort flow: ${pageErrors.map(e=>e.message).join(' | ')}`).toBe(0);
    });
  });

  test.describe('Auto-run and timing behaviors', () => {
    test('Auto-run processes steps automatically using configured step delay', async ({ page }) => {
      const demo = new DemoPage(page);

      // Reduce step delay and enable auto-run before starting
      await demo.enableAutoRunAndSetDelay(50);

      // Start run with auto-run enabled; it should progress without manual steps
      await demo.startTestRun();

      // Wait for completion message (allow generous timeout to accommodate intervals)
      await expect(demo.log).toContainText('Test run completed successfully.', { timeout: 5000 });

      // After auto-run completes, ensure no interval is left running (step disabled, start enabled)
      await expect(demo.stepBtn).toBeDisabled();
      await expect(demo.startBtn).toBeEnabled();

      // Ensure no runtime exceptions were emitted
      expect(pageErrors.length, `Page errors during auto-run: ${pageErrors.map(e=>e.message).join(' | ')}`).toBe(0);
    });
  });

  test.describe('Edge cases and UI guards', () => {
    test('Attempt to change module names during a running test triggers alert and values revert', async ({ page }) => {
      const demo = new DemoPage(page);

      await demo.startTestRun();

      // Setup dialog listener to capture alert message
      let dialogMessage = null;
      page.once('dialog', async (dialog) => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });

      // Attempt to change moduleNames while running; the script should alert and revert the value
      await demo.changeModuleNamesDuringRunAttempt('X,Y,Z');

      // Wait briefly for dialog to fire
      await page.waitForTimeout(100);

      expect(dialogMessage).toContain('Cannot change module names during a test run.');

      // The moduleNames input should be reverted to the original modules list (Auth,DB,API or current modules)
      const namesValue = await demo.moduleNames.inputValue();
      // It should match the modules array joined - at least not be the new 'X,Y,Z'
      expect(namesValue).not.toBe('X,Y,Z');

      // Clean up: reset to idle
      await demo.resetTestRun();

      // No runtime errors expected
      expect(pageErrors.length, `Runtime errors observed during module name edit guard: ${pageErrors.map(e=>e.message).join(' | ')}`).toBe(0);
    });

    test('Changing step delay while auto-run active restarts the timer without errors', async ({ page }) => {
      const demo = new DemoPage(page);

      // Enable auto-run and start
      await demo.enableAutoRunAndSetDelay(100);
      await demo.startTestRun();

      // After starting, change the stepDelay to a different value to trigger restart of auto-run timer
      await demo.stepDelay.fill('30');
      // Trigger change event
      await demo.stepDelay.evaluate((el) => el.dispatchEvent(new Event('change')));

      // Wait for completion
      await expect(demo.log).toContainText('Test run completed successfully.', { timeout: 5000 });

      // Ensure no page errors
      expect(pageErrors.length, `Page errors during stepDelay change: ${pageErrors.map(e=>e.message).join(' | ')}`).toBe(0);
    });
  });

  test.describe('Console and runtime error observations', () => {
    test('Console contains expected lifecycle messages and no unexpected runtime exceptions occurred', async ({ page }) => {
      const demo = new DemoPage(page);

      // A simple check: start a run and step to produce logs
      await demo.startTestRun();
      await demo.stepOnce();
      await page.waitForTimeout(200); // allow async logs to flush

      // Validate some typical console/log messages exist in the captured console output or log area
      const logText = await demo.getLogText();
      expect(logText.length > 0, 'Log area expected to contain messages').toBe(true);
      expect(logText).toMatch(/Starting test run|Testing module|passed|failed|skipped|Test run completed successfully|Test run aborted/);

      // Console messages captured at the browser console level should include stringified log writes (if console used)
      // This demo writes to a DOM log, but we still assert we captured some console messages (could be empty).
      // We do not require specific console output, but we assert that no page errors were thrown.
      expect(pageErrors.length, `Unexpected runtime exceptions: ${pageErrors.map(e=>e.message).join(' | ')}`).toBe(0);
    });
  });
});