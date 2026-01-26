import { test, expect } from '@playwright/test';

test.setTimeout(60000); // allow enough time for simulated runs to complete

// Test file for: f1f89de2-fa77-11f0-a6a1-c765f41a13c7
// URL: http://127.0.0.1:5500/workspace/0126-biased/html/f1f89de2-fa77-11f0-a6a1-c765f41a13c7.html

// Helper page object to interact with the application UI
class AppPage {
  constructor(page) {
    this.page = page;
  }
  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/0126-biased/html/f1f89de2-fa77-11f0-a6a1-c765f41a13c7.html', { waitUntil: 'domcontentloaded' });
    // ensure primary controls are present
    await this.page.waitForSelector('#runBtn');
    await this.page.waitForSelector('#themeBtn');
  }
  get runBtn() { return this.page.locator('#runBtn'); }
  get themeBtn() { return this.page.locator('#themeBtn'); }
  get logArea() { return this.page.locator('#logArea'); }
  get testsList() { return this.page.locator('#testsList'); }
  get passPercent() { return this.page.locator('#passPercent'); }
  get passedCount() { return this.page.locator('#passedCount'); }
  get failedCount() { return this.page.locator('#failedCount'); }
  async getLatestLogMessages() {
    // returns array of message strings (most recent first)
    const msgs = await this.page.$$eval('#logArea .log .msg', nodes => nodes.map(n => n.textContent || '').slice(0, 50));
    return msgs;
  }
  async countLogOccurrences(substring) {
    const msgs = await this.getLatestLogMessages();
    return msgs.filter(m => m.includes(substring)).length;
  }
  async waitForRunningState(timeout = 5000) {
    await expect(this.runBtn).toHaveText(/Running\.\.\./, { timeout });
    await expect(this.runBtn).toBeDisabled({ timeout });
  }
  async waitForCompletedState(timeout = 40000) {
    // Completed when Run Tests re-enabled
    await expect(this.runBtn).toHaveText('Run Tests', { timeout });
    await expect(this.runBtn).toBeEnabled({ timeout });
  }
}

test.describe('Unit Testing Visual Demonstration — FSM validation and interactions', () => {
  // Capture console events and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Attach basic listeners so tests can assert on console messages/errors
    page.context()._consoleMessages = [];
    page.context()._pageErrors = [];

    page.on('console', msg => {
      // store console messages in context for assertions
      page.context()._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', error => {
      page.context()._pageErrors.push(error);
    });
  });

  test.afterEach(async ({ page }) => {
    // After each test ensure there were no uncaught page errors
    const errors = page.context()._pageErrors || [];
    expect(errors.length).toBe(0);
  });

  test.describe('FSM States: Idle, Running, Completed', () => {

    test('S0_Idle: initial UI shows Idle state (log, Run Tests button enabled)', async ({ page }) => {
      // This test validates the Idle entry actions and evidence:
      // - resetUI() replaces the console with Idle message
      // - Run button text is "Run Tests" and enabled
      const app = new AppPage(page);
      await app.goto();

      // Immediately check for Idle evidence before the auto-run timeout (800ms) fires
      const idleMsg = await app.logArea.locator('.log .msg').first().textContent();
      expect(idleMsg).toContain('Idle. Awaiting run.');

      // Run button should be present and enabled
      await expect(app.runBtn).toHaveText('Run Tests');
      await expect(app.runBtn).toBeEnabled();
    });

    test('Transition S0_Idle -> S1_Running via RunTestsClick: clicking Run starts run and logs start', async ({ page }) => {
      // Validate that clicking the Run Tests button triggers the Running state evidence:
      // - runBtn text changes to "Running..."
      // - runBtn becomes disabled
      // - a "Starting test suite simulation" log entry is produced
      const app = new AppPage(page);
      await app.goto();

      // Click quickly to avoid the auto-run timeout causing interference
      await app.runBtn.click();

      // Validate Running state UI/evidence
      await app.waitForRunningState();

      // Confirm we logged the starting message exactly once so far
      const startOccurrences = await app.countLogOccurrences('Starting test suite simulation');
      expect(startOccurrences).toBeGreaterThanOrEqual(1); // at least once
    });

    test('S1_Running -> S2_Completed: run completes and final summary appended and Run button restored', async ({ page }) => {
      // Validate that the run completes naturally and the Completed state evidence is present:
      // - log 'Test suite finished — X passed, Y failed'
      // - runBtn text returns to 'Run Tests' and is enabled
      const app = new AppPage(page);
      await app.goto();

      // Start run (could be auto-starting soon; ensure we trigger reliably)
      await app.runBtn.click();
      await app.waitForRunningState();

      // Wait for completion (run disables button during run)
      await app.waitForCompletedState(40000); // allow enough time for the simulated suite

      // Check final summary log exists
      const msgs = await app.getLatestLogMessages();
      const finishedLog = msgs.find(m => m.includes('Test suite finished'));
      expect(finishedLog).toBeTruthy();

      // Validate that passPercent shows a percentage string (e.g. "42%")
      const percentText = (await app.passPercent.textContent()).trim();
      expect(percentText).toMatch(/^\d+%$/);

      // Validate passed+failed counts sum is >0 (some tests ran)
      const passed = parseInt((await app.passedCount.textContent()).trim() || '0', 10);
      const failed = parseInt((await app.failedCount.textContent()).trim() || '0', 10);
      expect(passed + failed).toBeGreaterThan(0);
    });
  });

  test.describe('Events: RunTestsKeyUp and ToggleTheme (click and keyup)', () => {

    test('RunTestsKeyUp: pressing Enter on Run button triggers a run (keyup -> click)', async ({ page }) => {
      // This test ensures keyboard activation of the Run button works (keyup handler triggers click)
      const app = new AppPage(page);
      await app.goto();

      // Focus the run button then press Enter (keyup handler listens for Enter)
      await app.runBtn.focus();
      // Use keyboard to generate keydown and keyup; the app listens to keyup
      await page.keyboard.down('Enter');
      await page.keyboard.up('Enter');

      // Should enter Running state
      await app.waitForRunningState();

      // Then wait to completion and assert final log
      await app.waitForCompletedState(40000);
      const messages = await app.getLatestLogMessages();
      expect(messages.some(m => m.includes('Test suite finished'))).toBeTruthy();
    });

    test('ToggleThemeClick and ToggleThemeKeyUp: clicking and pressing Enter toggles theme class on body', async ({ page }) => {
      // Validate theme toggling via both click and keyboard keyup on the theme button
      const app = new AppPage(page);
      await app.goto();

      // Initially theme-light class should NOT be present
      expect(await page.locator('body').getAttribute('class')).not.toContain('theme-light');

      // Click theme button -> adds theme-light
      await app.themeBtn.click();
      await expect(page.locator('body')).toHaveClass(/theme-light/);

      // Press Enter while focused on themeBtn to toggle back
      await app.themeBtn.focus();
      await page.keyboard.down('Enter');
      await page.keyboard.up('Enter');

      // class removed
      const bodyClass = await page.locator('body').getAttribute('class') || '';
      expect(bodyClass).not.toContain('theme-light');
    });
  });

  test.describe('Edge cases and robustness', () => {

    test('Clicking Run Tests while already running is ignored (no duplicate start logs)', async ({ page }) => {
      // Validate that clicking the Run button multiple times while a run is already in progress
      // does not start multiple runs (the handler checks 'if (running) return;')
      const app = new AppPage(page);
      await app.goto();

      await app.runBtn.click();
      await app.waitForRunningState();

      // Immediately click again several times
      await app.runBtn.click();
      await app.runBtn.click();
      await app.runBtn.click();

      // Count 'Starting test suite simulation' occurrences -- should be 1
      // Allow some time for any stray logs
      await page.waitForTimeout(250);
      const occ = await app.countLogOccurrences('Starting test suite simulation');
      expect(occ).toBe(1);
      // Wait for completion to keep environment clean
      await app.waitForCompletedState(40000);
    });

    test('Auto-run: when left idle the demo auto-starts after initial timeout and completes', async ({ page }) => {
      // The implementation includes a setTimeout that auto clicks runBtn after ~800ms.
      // This test validates that the auto-run happens and completes.
      const app = new AppPage(page);
      await app.goto();

      // Do not interact; wait for the auto-run to trigger and complete.
      // Wait sufficiently long for the entire run (aggregate).
      await app.waitForCompletedState(40000);

      // Confirm that the starting and finished messages exist
      const startCount = await app.countLogOccurrences('Starting test suite simulation');
      expect(startCount).toBeGreaterThanOrEqual(1);
      const finishCount = await app.countLogOccurrences('Test suite finished');
      expect(finishCount).toBeGreaterThanOrEqual(1);
    });

    test('Console and page error monitoring: expect no uncaught page errors or console.error', async ({ page }) => {
      // This test captures console messages and page errors to ensure the page executes without runtime exceptions.
      const app = new AppPage(page);
      await app.goto();

      // Allow some time for any startup logs/errors (including auto-run)
      await page.waitForTimeout(1200);

      // Inspect collected messages
      const consoleMsgs = page.context()._consoleMessages || [];
      const pageErrors = page.context()._pageErrors || [];

      // There should be no uncaught page errors
      expect(pageErrors.length).toBe(0);

      // There should be no console.error messages; we allow informational logs but assert absence of error-level logs
      const errorConsoleMsgs = consoleMsgs.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length).toBe(0);
    });
  });
});