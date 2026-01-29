import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8392330-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object for the demo area
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runBtn = page.locator('#runDemo');
    this.demoArea = page.locator('#demo');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // ensure main container is visible
    await expect(this.page.locator('.container')).toBeVisible();
  }

  async getButtonText() {
    return (await this.runBtn.textContent())?.trim() ?? '';
  }

  async isButtonDisabled() {
    return await this.runBtn.isDisabled();
  }

  async clickRun() {
    await this.runBtn.click();
  }

  async demoText() {
    return (await this.demoArea.textContent()) ?? '';
  }

  async waitForSimulationStart(timeout = 5000) {
    await this.page.waitForFunction(() => {
      const el = document.getElementById('demo');
      return el && el.textContent && el.textContent.includes('Simulated DNS resolution trace:');
    }, null, { timeout });
  }

  async waitForSimulationComplete(timeout = 20000) {
    await this.page.waitForFunction(() => {
      const el = document.getElementById('demo');
      return el && el.textContent && el.textContent.includes('Simulation complete.');
    }, null, { timeout });
  }
}

test.describe('DNS Demo FSM Tests (d8392330-fa7b-11f0-b314-ad8654ee5de8)', () => {
  // Collect console messages and page errors for observation in each test.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (log, error, warn, etc.)
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });
  });

  test('Initial Idle state: button is present and demo area contains prompt', async ({ page }) => {
    // Validate S0_Idle: renderPage() entry action (observed as initial DOM)
    const demo = new DemoPage(page);
    await demo.goto();

    // Button should be present with expected attributes and text
    await expect(demo.runBtn).toBeVisible();
    await expect(demo.runBtn).toHaveAttribute('id', 'runDemo');
    await expect(demo.runBtn).toHaveClass(/btn/);
    await expect(demo.runBtn).toHaveText('Run DNS resolution demo');

    // Demo area should have the initial prompt and accessible attributes (role/aria-live)
    const demoArea = page.locator('#demo');
    await expect(demoArea).toBeVisible();
    await expect(demoArea).toHaveAttribute('role', 'status');
    await expect(demoArea).toHaveAttribute('aria-live', 'polite');
    await expect(demoArea).toContainText('Click "Run DNS resolution demo" to see the simulated trace here.');

    // Observe that no console errors or page errors have been emitted so far
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_DemoRunning -> S2_DemoComplete on clicking Run Demo', async ({ page }) => {
    // This test validates the RunDemoClick event and the demo run -> completion transition.
    const demo = new DemoPage(page);
    await demo.goto();

    // Click the button to start the simulation (the page's runDemo() should execute)
    // We also observe console messages and page errors while the demo runs.
    await demo.clickRun();

    // Immediately after click, the demo area should be updated with the header "Simulated DNS resolution trace:"
    // Wait for the simulation to start (onEnter action runDemo() sets initial text)
    await demo.waitForSimulationStart(5000);
    const textAfterStart = await demo.demoText();
    expect(textAfterStart).toContain('Simulated DNS resolution trace:');

    // While running, several lines are appended asynchronously. Wait until the final completion line appears.
    await demo.waitForSimulationComplete(20000);
    const finalText = await demo.demoText();
    // Validate presence of multiple expected lines from the simulation trace (evidence)
    expect(finalText).toContain('[Client] -> Recursive Resolver: Query A www.example.com');
    expect(finalText).toContain('[Recursive] Cache check: MISS for www.example.com');
    expect(finalText).toContain('[ns1.example.com] -> Recursive: Authoritative Answer: A www.example.com = 198.51.100.20');
    expect(finalText).toContain('Simulation complete.');

    // After completion, per FSM evidence the button text should change and it should be disabled
    await expect(demo.runBtn).toHaveText('Showed demo');
    expect(await demo.isButtonDisabled()).toBe(true);

    // Validate that button click handler used {once:true} by attempting a second click.
    // Since the button is disabled, clicking should have no effect; confirm text does not grow further.
    const beforeLength = (await demo.demoText()).length;
    // Try to click; Playwright click on disabled element will throw, so guard it.
    // Instead, attempt a second click by forcing (but disabled should prevent actual action).
    try {
      await page.click('#runDemo', { timeout: 1000 }).catch(() => {});
    } catch {
      // ignore; we only care that no new simulation text was appended
    }
    // Wait briefly to allow any unexpected additional append to happen
    await page.waitForTimeout(800);
    const afterLength = (await demo.demoText()).length;
    expect(afterLength).toBe(beforeLength);

    // Observe console and page errors during run: assert none (no unexpected ReferenceError/TypeError/SyntaxError)
    // We record and assert zero page errors and zero console 'error' messages.
    expect(pageErrors.length).toBe(0, `Unexpected page errors: ${JSON.stringify(pageErrors)}`);
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0, `Unexpected console errors: ${JSON.stringify(consoleErrs)}`);
  });

  test('Edge case: rapid double-click attempt before button disabled - event {once:true} ensures single run', async ({ page }) => {
    // This test attempts to click the Run button twice in short succession and verifies only a single simulation runs.
    const demo = new DemoPage(page);
    await demo.goto();

    // Attach a MutationObserver inside the page to count number of times "Simulated DNS resolution trace:" is set.
    // We will not inject or modify any functions; instead we observe demo area's content changes.
    const demoArea = page.locator('#demo');

    // Kick off two rapid clicks. The button's addEventListener used {once:true} so only the first should start the simulation.
    // Use Promise.all to attempt near-simultaneous clicks.
    await Promise.allSettled([
      page.click('#runDemo').catch(() => {}),
      page.click('#runDemo').catch(() => {})
    ]);

    // Wait for the simulation to start and complete
    await demo.waitForSimulationStart(5000);
    await demo.waitForSimulationComplete(20000);

    // Validate that the header "Simulated DNS resolution trace:" appears exactly once at the top (not multiple repeated headers)
    const content = await demoArea.textContent();
    // Count occurrences of the header; it should be 1
    const occurrences = (content.match(/Simulated DNS resolution trace:/g) || []).length;
    expect(occurrences).toBe(1);

    // And the final "Simulation complete." should be present once
    const completionOccurrences = (content.match(/Simulation complete\./g) || []).length;
    expect(completionOccurrences).toBe(1);

    // Confirm button is now disabled and shows "Showed demo"
    expect(await demo.isButtonDisabled()).toBe(true);
    expect(await demo.getButtonText()).toBe('Showed demo');

    // Confirm no runtime page errors were emitted during this stress case
    expect(pageErrors.length).toBe(0);
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });

  test('Accessibility & DOM checks for FSM evidence and components', async ({ page }) => {
    // Validate components and attributes per the FSM and the HTML implementation evidence
    const demo = new DemoPage(page);
    await demo.goto();

    // Button should have role of button implied and class 'btn'
    await expect(page.locator('#runDemo')).toHaveClass(/btn/);
    await expect(page.locator('#runDemo')).toBeVisible();

    // Demo area should be a monospace styled block with class demo-area
    await expect(page.locator('#demo')).toHaveClass(/demo-area/);
    await expect(page.locator('#demo')).toHaveAttribute('role', 'status');
    await expect(page.locator('#demo')).toHaveAttribute('aria-live', 'polite');

    // Ensure initial demo area text includes prompt (FSM S0 evidence)
    const initialText = await demo.demoText();
    expect(initialText).toContain('Click "Run DNS resolution demo" to see the simulated trace here.');

    // No page errors in idle accessibility checks
    expect(pageErrors.length).toBe(0);
  });

  test('Negative assertions: no hidden global functions leaked into window', async ({ page }) => {
    // We must not inject globals or patch runtime. Validate that expected demo functions are scoped inside the page.
    await page.goto(APP_URL);

    // The implementation used an IIFE; runDemo and append are not expected to be globals.
    // Assert that attempting to read window.runDemo yields undefined (i.e., not leaked).
    // NOTE: We do not create ReferenceErrors ourselves; we simply check the existence.
    const hasRunDemo = await page.evaluate(() => typeof window.runDemo !== 'function');
    expect(hasRunDemo).toBe(true);

    // Similarly ensure no global 'append' function exists on window
    const hasAppend = await page.evaluate(() => typeof window.append !== 'function');
    expect(hasAppend).toBe(true);

    // Confirm no page errors emitted when querying globals
    expect(pageErrors.length).toBe(0);
  });
});