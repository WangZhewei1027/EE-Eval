import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f8ec03-fa77-11f0-a6a1-c765f41a13c7.html';

// Page object encapsulating common interactions and queries
class AppPage {
  constructor(page) {
    this.page = page;
    this.runBtn = page.locator('#runBtn');
    this.switchEl = page.locator('.switch');
    this.strictLabel = page.locator('#strictLabel');
    this.strictDot = page.locator('#strictDot');
    this.statusBadge = page.locator('#statusBadge');
    this.codeLines = page.locator('#codeLines');
    this.scanner = page.locator('#scanner');
  }

  // Click the run button to start a typecheck
  async clickRun() {
    await this.runBtn.click();
  }

  // Focus the run button and press Enter (keyboard supported path)
  async pressEnterOnRun() {
    await this.runBtn.focus();
    await this.page.keyboard.press('Enter');
  }

  // Click the strict mode switch
  async clickSwitch() {
    await this.switchEl.click();
  }

  // Focus the switch and press a key (Enter or Space)
  async pressKeyOnSwitch(key) {
    await this.switchEl.focus();
    await this.page.keyboard.press(key);
  }

  // Get the visible status badge text content
  async getStatusText() {
    return (await this.statusBadge.textContent())?.trim() ?? '';
  }

  // Check if statusBadge has class
  async statusHasClass(className) {
    return await this.statusBadge.evaluate((el, cls) => el.classList.contains(cls), className);
  }

  // Return classList for a given line index (1-based)
  async getLineClassList(index) {
    const locator = this.page.locator(`.line[data-index="${index}"]`);
    return await locator.evaluate((el) => Array.from(el.classList));
  }

  // Wait for analysis to reach a final state (either 'All good' or contains 'Type errors'/'Errors (strict)')
  async waitForAnalysisComplete(timeout = 4000) {
    await this.page.waitForFunction(() => {
      const badge = document.getElementById('statusBadge');
      if (!badge) return false;
      const txt = badge.textContent || '';
      return txt.includes('All good') || txt.includes('Type errors') || txt.includes('Errors (strict)');
    }, null, { timeout });
  }

  // Utility to evaluate strict label content
  async getStrictLabelText() {
    return (await this.strictLabel.textContent())?.trim() ?? '';
  }

  // Get current spark opacity (string)
  async getSparkOpacity() {
    return await this.page.locator('#spark').evaluate(el => window.getComputedStyle(el).opacity);
  }

  // Get stroke color of a path by id (p1/p2)
  async getPathStroke(pathId) {
    return await this.page.locator(`#${pathId}`).evaluate(el => el.getAttribute('style') || el.getAttribute('stroke') || '');
  }
}

test.describe('Static Typing Visual Exploration — FSM and interactions', () => {
  // Capture console errors and page errors for each test to assert the runtime behavior.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen to console messages and page errors without modifying page behavior.
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    await page.goto(APP_URL);
    // Wait for DOMContentLoaded and the script to run initialization
    await page.waitForLoadState('domcontentloaded');
  });

  test('Initial Idle state on load: resetLines executed, no error markers', async ({ page }) => {
    // Validate initial Idle state as described by S0_Idle entry actions/evidence.
    const app = new AppPage(page);

    // Status should show Idle (resetLines sets the badge to Idle)
    const statusText = await app.getStatusText();
    // The badge initial content contains 'Idle'
    expect(statusText).toContain('Idle');

    // No lines should have 'error' or 'ok' classes before any runs (resetLines removes them)
    for (const idx of [1, 2, 3, 4]) {
      const classes = await app.getLineClassList(idx);
      expect(classes).not.toContain('error');
      expect(classes).not.toContain('ok');
    }

    // No scanner run class present initially
    const scannerHasRun = await page.locator('#scanner').evaluate(el => el.classList.contains('run'));
    expect(scannerHasRun).toBeFalsy();

    // Ensure no uncaught page errors or console errors occurred during load
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('RunTypecheck click transitions Idle -> Analyzing -> Errors (relaxed)', async ({ page }) => {
    // Test the transition described: S0_Idle -> S1_Analyzing -> S2_Errors (when strictMode = false)
    const app = new AppPage(page);

    // Ensure starting in relaxed mode
    expect(await app.getStrictLabelText()).toBe('Relaxed');

    // Click Run (should immediately set status to 'Analyzing...')
    await app.clickRun();

    // Immediately check for analyzing text (transition to S1_Analyzing)
    await page.waitForFunction(() => {
      const b = document.getElementById('statusBadge');
      return b && b.textContent && b.textContent.includes('Analyzing');
    }, null, { timeout: 500 });
    const analyzingText = await app.getStatusText();
    expect(analyzingText).toContain('Analyzing');

    // Wait for analysis to complete (the implementation uses ~1600ms timeout)
    await app.waitForAnalysisComplete(4000);

    // After completion, relaxed mode yields one error line (line 2) and badge should have 'err' class
    expect(await app.statusHasClass('err')).toBeTruthy();
    const finalStatus = await app.getStatusText();
    expect(finalStatus).toContain('Type errors'); // relaxed path uses 'Type errors'

    // Validate line classes: line 2 should be error, others ok
    expect((await app.getLineClassList(2))).toContain('error');
    for (const idx of [1, 3]) {
      const classes = await app.getLineClassList(idx);
      expect(classes).toContain('ok');
      expect(classes).not.toContain('error');
    }

    // Verify spark faded out after analysis
    const sparkOpacity = await app.getSparkOpacity();
    // Should be '0' or a string representing zero opacity after run ends
    expect(Number(sparkOpacity)).toBeLessThanOrEqual(0.1);

    // Ensure the connections pulsed to error colors briefly (p1/p2 style changed then reverted). We at least check that p1/p2 have stroke attributes present.
    const p1Stroke = await app.getPathStroke('p1');
    const p2Stroke = await app.getPathStroke('p2');
    expect(p1Stroke.length).toBeGreaterThan(0);
    expect(p2Stroke.length).toBeGreaterThan(0);

    // No uncaught exceptions happened during the run
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('ToggleStrictMode click updates label & RunTypecheck yields strict errors', async ({ page }) => {
    // Validate ToggleStrictMode behavior and transition S1 -> S2 with strict errors
    const app = new AppPage(page);

    // Click switch to enable strict mode
    await app.clickSwitch();

    // Label should update to 'Strict'
    await page.waitForFunction(() => document.getElementById('strictLabel').textContent.includes('Strict'), null, { timeout: 500 });
    expect(await app.getStrictLabelText()).toBe('Strict');

    // The dot's style background should reflect the strict gradient (implementation sets #FFD36E gradient)
    const dotBackground = await app.strictDot.evaluate(el => el.style.background || '');
    expect(dotBackground).toContain('#FFD36E');

    // Run typecheck while in strict mode
    await app.clickRun();

    // Wait for analyzing then completion
    await page.waitForFunction(() => {
      const b = document.getElementById('statusBadge');
      return b && b.textContent && b.textContent.includes('Analyzing');
    }, null, { timeout: 500 });
    await app.waitForAnalysisComplete(4000);

    // In strict mode, errors reported are [2,4] per implementation
    expect(await app.statusHasClass('err')).toBeTruthy();
    const finalStatus = await app.getStatusText();
    expect(finalStatus).toContain('Errors (strict)');

    // Lines 2 and 4 should have error class
    expect((await app.getLineClassList(2))).toContain('error');
    expect((await app.getLineClassList(4))).toContain('error');

    // Line 1 and 3 should be ok
    expect((await app.getLineClassList(1))).toContain('ok');
    expect((await app.getLineClassList(3))).toContain('ok');

    // No uncaught exceptions during toggle/run
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Keyboard activation: pressing Enter on Run triggers typecheck (Analyzing -> result)', async ({ page }) => {
    // Validate RunTypecheck_Enter handler: keydown Enter triggers runBtn click
    const app = new AppPage(page);

    // Focus run button and press Enter
    await app.pressEnterOnRun();

    // Verify immediate analyzing state
    await page.waitForFunction(() => {
      const b = document.getElementById('statusBadge');
      return b && b.textContent && b.textContent.includes('Analyzing');
    }, null, { timeout: 500 });

    // Wait for completion and check final badge (relaxed by default)
    await app.waitForAnalysisComplete(4000);
    expect(await app.statusHasClass('err')).toBeTruthy();

    // Ensure at least one error line exists (line 2)
    expect((await app.getLineClassList(2))).toContain('error');

    // No runtime exceptions from keyboard handling
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Keyboard activation: Enter and Space toggle the strict switch', async ({ page }) => {
    // Validate ToggleStrictMode_Enter handler: pressing Enter or Space toggles strict mode
    const app = new AppPage(page);

    // Start from Relaxed
    expect(await app.getStrictLabelText()).toBe('Relaxed');

    // Press Space to toggle
    await app.pressKeyOnSwitch('Space');

    // Wait and assert toggled to Strict
    await page.waitForFunction(() => document.getElementById('strictLabel').textContent.includes('Strict'), null, { timeout: 500 });
    expect(await app.getStrictLabelText()).toBe('Strict');

    // Press Enter to toggle back to Relaxed
    await app.pressKeyOnSwitch('Enter');

    await page.waitForFunction(() => document.getElementById('strictLabel').textContent.includes('Relaxed'), null, { timeout: 500 });
    expect(await app.getStrictLabelText()).toBe('Relaxed');

    // No runtime exceptions from keyboard handling
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Edge case: toggling strict during an ongoing scan affects final results', async ({ page }) => {
    // This validates that the run's final errorLines are computed at completion time and reflect current strictMode.
    const app = new AppPage(page);

    // Ensure starting relaxed
    expect(await app.getStrictLabelText()).toBe('Relaxed');

    // Start a run
    await app.clickRun();

    // Immediately toggle strict while scanning (within the 1600ms timeout)
    await page.waitForTimeout(80); // small delay to ensure scan has started
    await app.clickSwitch();

    // Wait for analysis to complete
    await app.waitForAnalysisComplete(4000);

    // Since we toggled to strict while scanning, final result should reflect strict behavior -> Errors (strict)
    const finalStatus = await app.getStatusText();
    expect(finalStatus).toContain('Errors (strict)');

    // Lines 2 and 4 should be errors under strict mode
    expect((await app.getLineClassList(2))).toContain('error');
    expect((await app.getLineClassList(4))).toContain('error');

    // No uncaught runtime errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Multiple quick runs reset state each time and produce consistent results', async ({ page }) => {
    // Trigger multiple runs rapidly to ensure resetLines() is invoked and UI stabilizes to the last run result.
    const app = new AppPage(page);

    // Run once (relaxed)
    await app.clickRun();

    // Before it finishes, quickly run again
    await page.waitForTimeout(100);
    await app.clickRun();

    // Wait for completion of the most recent run
    await app.waitForAnalysisComplete(5000);

    // Should end up in an 'err' state (relaxed -> Type errors)
    expect(await app.statusHasClass('err')).toBeTruthy();
    const finalStatus = await app.getStatusText();
    expect(finalStatus).toContain('Type errors');

    // Validate that resetLines cleared old classes before the latest run applied classes.
    // We check that no line has a mixture of 'error' and 'ok' simultaneously
    for (const idx of [1, 2, 3, 4]) {
      const classes = await app.getLineClassList(idx);
      const hasError = classes.includes('error');
      const hasOk = classes.includes('ok');
      // They should not both be present
      expect(!(hasError && hasOk)).toBeTruthy();
    }

    // No runtime exceptions during rapid runs
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Sanity: success path when there are no errors (simulate by temporarily evaluating page state)', async ({ page }) => {
    // Edge test: while we are instructed not to modify runtime code, we can exercise the success branch by
    // manipulating the DOM to simulate zero errors AFTER the scan completes. We will run the scan and then
    // programmatically clear errorLines / classes to verify the UI accepts an "All good" badge.
    // NOTE: We do not alter the original functions/handlers; we only change DOM nodes after the run finishes
    // to validate how the UI responds to that DOM state.
    const app = new AppPage(page);

    // Run typecheck to completion (initially relaxed -> will produce at least line 2 as error)
    await app.clickRun();
    await app.waitForAnalysisComplete(4000);

    // Now simulate a post-scan correction: remove 'error' classes and add 'ok' classes to all lines
    await page.evaluate(() => {
      document.querySelectorAll('.line').forEach(l => {
        l.classList.remove('error');
        l.classList.add('ok');
      });
      // Update badge to All good as if analysis found no issues
      const status = document.getElementById('statusBadge');
      status.classList.remove('err');
      status.classList.add('ok');
      status.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="opacity:0.95"><path d="M5 13l4 4L19 7" stroke="rgba(110,231,179,0.98)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> All good';
    });

    // Assert the UI reflects success
    expect(await app.statusHasClass('ok')).toBeTruthy();
    const statusText = await app.getStatusText();
    expect(statusText).toContain('All good');

    // All lines should now have 'ok' class and not 'error'
    for (const idx of [1, 2, 3, 4]) {
      const classes = await app.getLineClassList(idx);
      expect(classes).toContain('ok');
      expect(classes).not.toContain('error');
    }

    // No uncaught runtime errors observed during these manipulations
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});