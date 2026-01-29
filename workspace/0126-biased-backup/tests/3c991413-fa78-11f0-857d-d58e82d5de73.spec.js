import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c991413-fa78-11f0-857d-d58e82d5de73.html';

// Page Object for the CPU Scheduling app
class SchedulerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.locators = {
      readyQueue: page.locator('#readyQueue'),
      processes: page.locator('#readyQueue .process'),
      btnStep: page.locator('#btnStep'),
      btnReset: page.locator('#btnReset'),
      timeline: page.locator('.timeline'),
      // individual selectors resolved relative to a process element
      burstBar: (proc) => proc.locator('.burst-bar'),
      label: (proc) => proc.locator('label'),
      tooltip: (proc) => proc.locator('.tooltip')
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Wait for initial rendering of processes
  async expectInitializedProcessCount(count = 5) {
    await expect(this.locators.processes).toHaveCount(count);
  }

  // Return visible labels text for all processes
  async getProcessLabels() {
    const count = await this.locators.processes.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push(await this.locators.processes.nth(i).locator('label').textContent());
    }
    return texts;
  }

  // Click the step button
  async clickStep() {
    await this.locators.btnStep.click();
  }

  // Click the reset button
  async clickReset() {
    await this.locators.btnReset.click();
  }

  // Get burst-bar width for a given process index (as returned by style.width, e.g., "100%")
  async getBurstWidth(index) {
    const bar = this.locators.processes.nth(index).locator('.burst-bar');
    return await bar.evaluate((el) => el.style.width);
  }

  // Get opacity style for a process at index
  async getOpacity(index) {
    return await this.locators.processes.nth(index).evaluate((el) => getComputedStyle(el).opacity);
  }

  // Get filter style for a process at index
  async getFilter(index) {
    return await this.locators.processes.nth(index).evaluate((el) => el.style.filter || getComputedStyle(el).filter);
  }

  // Wait until btnStep shows "Complete ✓" and is disabled
  async waitForCompletion(timeout = 3000) {
    await this.page.waitForFunction(() => {
      const btn = document.getElementById('btnStep');
      return btn && btn.disabled && btn.textContent.trim().startsWith('Complete');
    }, null, { timeout });
  }
}

// Group tests logically for the FSM states and transitions
test.describe('CPU Scheduling — FSM validation', () => {
  // Arrays to collect console messages and page errors for assertion
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console events and record them
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Listen to unhandled exceptions in the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test we will assert there were no uncaught page errors
    // and that there are no console.error messages (common sanity check).
    // This helps catch ReferenceError/SyntaxError/TypeError or other runtime issues.
    const runtimeErrors = pageErrors.filter(e => e && (e.name === 'ReferenceError' || e.name === 'TypeError' || e.name === 'SyntaxError' || e.message?.includes('ReferenceError') || e.message?.includes('TypeError') || e.message?.includes('SyntaxError')));
    // There should be no runtime errors of these kinds in a healthy run.
    expect(runtimeErrors.length, `Unexpected runtime errors: ${runtimeErrors.map(e => e && e.message).join('; ')}`).toBe(0);

    // Also assert there are no console.error messages emitted during the test.
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length, `console.error was called with: ${consoleErrs.map(m => m.text).join(' | ')}`).toBe(0);
  });

  test.describe('State S0_Initialized (Initial state) — initProcesses() effects', () => {
    test('Initial DOM state: processes are created and UI elements present', async ({ page }) => {
      // Purpose: Validate that initProcesses() ran on load (entry action of S0_Initialized)
      const sched = new SchedulerPage(page);
      await sched.goto();

      // There should be no initial runtime errors from page load
      // Validate processes were initialized (5 detected in FSM)
      await sched.expectInitializedProcessCount(5);

      // Validate first process label shows initial burst value (P1 (7))
      const labels = await sched.getProcessLabels();
      expect(labels[0].trim()).toBe('P1 (7)');
      expect(labels[1].trim()).toBe('P2 (4)');
      expect(labels[2].trim()).toBe('P3 (5)');
      expect(labels[3].trim()).toBe('P4 (3)');
      expect(labels[4].trim()).toBe('P5 (6)');

      // Each burst bar should be at full width on initialization
      for (let i = 0; i < 5; i++) {
        const width = await sched.getBurstWidth(i);
        expect(width).toBe('100%');
      }

      // Buttons should be present and Step enabled
      await expect(sched.locators.btnStep).toBeVisible();
      await expect(sched.locators.btnReset).toBeVisible();
      await expect(sched.locators.btnStep).toBeEnabled();
      await expect(sched.locators.btnStep).toHaveText('Step');

      // Timeline tick markers should be present (one per process)
      await expect(sched.locators.timeline.locator('.tick')).toHaveCount(5);
    });
  });

  test.describe('State S1_Running (Active) — stepScheduling() interactions', () => {
    test('Clicking Step advances a single process and updates visuals', async ({ page }) => {
      // Purpose: Validate first transition S0 -> S1 on Step:
      // "Process highlighted" and "Burst bar animates" observable
      const sched = new SchedulerPage(page);
      await sched.goto();

      // Ensure initial precondition
      await sched.expectInitializedProcessCount(5);
      await expect(sched.locators.btnStep).toBeEnabled();

      // Click the Step button to run P1
      await sched.clickStep();

      // Immediately after invoking, the P1 label should update to (0)
      await expect(sched.locators.processes.nth(0).locator('label')).toHaveText('P1 (0)');

      // The burst bar for P1 should have started shrinking (style width -> '0%')
      // Because updateVisual writes width synchronously in stepScheduling
      const widthP1 = await sched.getBurstWidth(0);
      expect(widthP1).toBe('0%');

      // Visual highlight (filter) should include drop-shadow (applied before updateVisual)
      const filterP1 = await sched.getFilter(0);
      expect(filterP1).toContain('drop-shadow');

      // Process should appear semi-transparent and styled as completed by updateVisual
      const opacityP1 = await sched.getOpacity(0);
      // Because updateVisual sets opacity to '0.48' for completed processes
      expect(Number(parseFloat(opacityP1))).toBeGreaterThan(0).toBeLessThanOrEqual(1);

      // Step button should still be enabled because not all processes are complete yet
      await expect(sched.locators.btnStep).toBeEnabled();
    });

    test('Repeated Step clicks complete all processes and transition to S2_Completed', async ({ page }) => {
      // Purpose: Validate repeated Step transitions S1->S1 and final S1->S2:
      // After all processes run, btnStep.disabled = true and text = 'Complete ✓'
      const sched = new SchedulerPage(page);
      await sched.goto();

      // Click Step 5 times to complete all 5 processes.
      // Each click reduces one process's remaining to 0.
      for (let i = 0; i < 5; i++) {
        await sched.clickStep();
        // Wait a short while to allow synchronous DOM updates + style changes
        // (stepScheduling updates most things synchronously; timeout updates index and final disabling after ~950ms)
        await page.waitForTimeout(120); // small delay to allow DOM to update predictably
      }

      // After the last step the code uses a setTimeout (~950ms) to disable the button.
      // Wait for completion condition to be true.
      await sched.waitForCompletion(3000);

      // Assert the final state: Step button disabled and shows "Complete ✓"
      await expect(sched.locators.btnStep).toBeDisabled();
      await expect(sched.locators.btnStep).toHaveText(/Complete/);

      // All processes should now report (0) remaining and have reduced opacity
      const count = await sched.locators.processes.count();
      for (let i = 0; i < count; i++) {
        await expect(sched.locators.processes.nth(i).locator('label')).toHaveText(new RegExp('\\(0\\)$'));
        const w = await sched.getBurstWidth(i);
        expect(w).toBe('0%');
        const opacity = parseFloat(await sched.getOpacity(i));
        expect(opacity).toBeGreaterThan(0).toBeLessThan(1); // semi-transparent
      }
    });

    test('Clicking Step when disabled does not change the DOM (edge case)', async ({ page }) => {
      // Purpose: Ensure no unexpected behavior if user clicks Step after completion.
      const sched = new SchedulerPage(page);
      await sched.goto();

      // Complete all processes
      for (let i = 0; i < 5; i++) {
        await sched.clickStep();
        await page.waitForTimeout(120);
      }
      await sched.waitForCompletion(3000);

      // Sanity snapshot of process labels after completion
      const labelsBefore = await sched.getProcessLabels();

      // Try clicking the disabled button (simulate user attempt)
      // Playwright will throw if clicking a disabled element via locator.click()
      // So use JavaScript to attempt to click and ensure it does not change state.
      await page.evaluate(() => {
        const btn = document.getElementById('btnStep');
        // Attempt to dispatch click event even if disabled (edge attempt)
        btn && btn.dispatchEvent && btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });

      // Allow small delay
      await page.waitForTimeout(250);

      // Expect that labels did not change (still all zeros)
      const labelsAfter = await sched.getProcessLabels();
      expect(labelsAfter).toEqual(labelsBefore);
    });
  });

  test.describe('Reset event and S0_Initialized re-entry', () => {
    test('Reset restores initial state from Completed and from Running', async ({ page }) => {
      // Purpose: Validate resetScheduling() (evidence for entry/exit) and transition S0->S0 on Reset
      const sched = new SchedulerPage(page);
      await sched.goto();

      // Complete all processes to reach Completed state first
      for (let i = 0; i < 5; i++) {
        await sched.clickStep();
        await page.waitForTimeout(120);
      }
      await sched.waitForCompletion(3000);

      // Now click Reset to re-initialize processes
      await sched.clickReset();

      // After reset, Step should be enabled and text reset to 'Step'
      await expect(sched.locators.btnStep).toBeEnabled();
      await expect(sched.locators.btnStep).toHaveText('Step');

      // Processes should be re-created and show original burst values again
      await sched.expectInitializedProcessCount(5);
      const labels = await sched.getProcessLabels();
      expect(labels[0].trim()).toBe('P1 (7)');
      expect(labels[1].trim()).toBe('P2 (4)');
      expect(labels[2].trim()).toBe('P3 (5)');
      expect(labels[3].trim()).toBe('P4 (3)');
      expect(labels[4].trim()).toBe('P5 (6)');

      // Also test Reset while running (midway) to ensure idempotency
      // Step once to change P1 -> 0, then reset
      await sched.clickStep();
      await page.waitForTimeout(120);
      // Ensure P1 is (0)
      await expect(sched.locators.processes.nth(0).locator('label')).toHaveText('P1 (0)');

      // Now Reset again
      await sched.clickReset();

      // Expect full reinitialization again
      await sched.expectInitializedProcessCount(5);
      const labelsAfterReset = await sched.getProcessLabels();
      expect(labelsAfterReset[0].trim()).toBe('P1 (7)');
    });

    test('Multiple rapid resets do not throw and keep UI stable (edge case)', async ({ page }) => {
      // Purpose: Flood Reset to ensure the implementation is stable and idempotent
      const sched = new SchedulerPage(page);
      await sched.goto();

      // Rapidly click Reset several times
      for (let i = 0; i < 6; i++) {
        await sched.clickReset();
      }

      // Small pause to allow DOM to settle
      await page.waitForTimeout(200);

      // Expect processes present and Step enabled
      await sched.expectInitializedProcessCount(5);
      await expect(sched.locators.btnStep).toBeEnabled();

      const labels = await sched.getProcessLabels();
      expect(labels[0].trim()).toBe('P1 (7)');
    });
  });

  test.describe('Accessibility & visual cues', () => {
    test('ARIA attributes and live regions are present and update appropriately', async ({ page }) => {
      // Purpose: Ensure components have the attributes described in FSM and HTML
      const sched = new SchedulerPage(page);
      await sched.goto();

      // readyQueue has aria-live and aria-atomic
      await expect(sched.locators.readyQueue).toHaveAttribute('aria-live', 'polite');
      await expect(sched.locators.readyQueue).toHaveAttribute('aria-atomic', 'true');

      // btnStep controls readyQueue via aria-controls
      await expect(sched.locators.btnStep).toHaveAttribute('aria-controls', 'readyQueue');

      // Tooltip updates with remaining burst on hover simulation (tooltip visibility managed by CSS)
      // We'll verify tooltip text content updates after a Step that completes a process.
      await sched.clickStep();
      await page.waitForTimeout(120);
      const tooltipText = await sched.locators.processes.nth(0).locator('.tooltip').textContent();
      expect(tooltipText.trim()).toBe('Remaining Burst: 0');
    });
  });
});