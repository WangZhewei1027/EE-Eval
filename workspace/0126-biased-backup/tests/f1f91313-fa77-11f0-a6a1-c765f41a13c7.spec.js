import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f91313-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleErrors = [];
    this.pageErrors = [];
  }

  // Navigate to the app and wire up observers for console/page errors
  async goto() {
    // Capture console messages and page errors for assertions
    this.page.on('console', (msg) => {
      // Only store error-level messages
      try {
        if (msg.type() === 'error') {
          this.consoleErrors.push({
            text: msg.text(),
            location: msg.location(),
          });
        }
      } catch (e) {
        // ignore
      }
    });
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });

    await this.page.goto(APP_URL);
    // Wait for main elements to be available
    await this.page.waitForSelector('#toggle', { state: 'visible' });
    await this.page.waitForSelector('#toggleLabel', { state: 'visible' });
    // allow a short settle time for initial drawing and async resizes
    await this.page.waitForTimeout(200);
  }

  async getToggleHandle() {
    return this.page.$('#toggle');
  }

  async getToggleLabelText() {
    const el = await this.page.$('#toggleLabel');
    return (await el.innerText()).trim();
  }

  async getToggleAriaPressed() {
    const el = await this.page.$('#toggle');
    return await el.getAttribute('aria-pressed');
  }

  async hasTogglePausedClass() {
    return await this.page.$eval('#toggle', (el) => el.classList.contains('paused'));
  }

  async clickToggle() {
    await this.page.click('#toggle');
    // allow DOM updates (aria, label, classes) and animation loop to process
    await this.page.waitForTimeout(120);
  }

  async pressSpace() {
    // use keyboard to simulate real user pressing Space (keydown handler attached to window)
    await this.page.keyboard.press('Space');
    // handler calls preventDefault & toggle.click() asynchronously — give time
    await this.page.waitForTimeout(120);
  }

  async getMetricPText() {
    const el = await this.page.$('#metric-p');
    return (await el.innerText()).trim();
  }

  async getMetricMarginText() {
    const el = await this.page.$('#metric-margin');
    return (await el.innerText()).trim();
  }

  async decisionLineExists() {
    // check for a path with class "decision" inside #dec-line
    return await this.page.$eval('#dec-line', (g) => {
      return !!g.querySelector('path.decision');
    });
  }

  async callDrawAll(forceHeat = true) {
    // call exposed window.LRdemo.drawAll(true) if available
    return await this.page.evaluate((f) => {
      if (window.LRdemo && typeof window.LRdemo.drawAll === 'function') {
        window.LRdemo.drawAll(f);
        return true;
      }
      return false;
    }, forceHeat);
  }

  async resizeViewport(width, height) {
    await this.page.setViewportSize({ width, height });
    // The page listens to window resize; allow time for handler and draw
    await this.page.waitForTimeout(220);
  }

  // Helpers to assert no console/page errors occurred
  async expectNoConsoleErrors() {
    expect(this.consoleErrors.length, `Unexpected console.error messages: ${JSON.stringify(this.consoleErrors)}`).toBe(0);
  }

  async expectNoPageErrors() {
    expect(this.pageErrors.length, `Unexpected page errors: ${this.pageErrors.map(e => e.message).join('\n')}`).toBe(0);
  }
}

// Group tests for the Logistic Regression demo
test.describe('Logistic Regression — Elegant Visualization (FSM validation)', () => {
  // Use a fresh page for each test
  test.beforeEach(async ({ page }) => {
    // nothing global to set up here; each test will instantiate DemoPage and goto
  });

  test.afterEach(async ({ page }) => {
    // ensure page is closed/clean between tests (Playwright handles this), small safety wait
    await page.waitForTimeout(20);
  });

  test('Initial state: Running — toggle shows "Pause", aria-pressed and classes reflect running', async ({ page }) => {
    // Validate initial "Running" state as described in FSM (S0_Running)
    const demo = new DemoPage(page);
    await demo.goto();

    // Check label shows "Pause"
    const label = await demo.getToggleLabelText();
    // The UI initially displays "Pause" for running state
    expect(label).toBe('Pause');

    // aria-pressed attribute initially should be "false" per HTML and code (String(!running))
    const aria = await demo.getToggleAriaPressed();
    expect(aria).toBe('false');

    // Toggle button should not have the 'paused' class when running
    const hasPaused = await demo.hasTogglePausedClass();
    expect(hasPaused).toBe(false);

    // Basic visual metric presence
    const metricP = await demo.getMetricPText();
    expect(metricP.startsWith('Average p:')).toBe(true);

    // No console or page errors should have occurred during load/initialization
    await demo.expectNoConsoleErrors();
    await demo.expectNoPageErrors();
  });

  test('Clicking toggle -> Paused state: label becomes "Play", aria-pressed and paused class update', async ({ page }) => {
    // Validate transition S0_Running -> S1_Paused via ToggleAnimation (click)
    const demo = new DemoPage(page);
    await demo.goto();

    // Click to toggle (should pause)
    await demo.clickToggle();

    // After click, label should be "Play"
    const label = await demo.getToggleLabelText();
    expect(label).toBe('Play');

    // aria-pressed should now be "true" (code sets to String(!running) after flipping)
    const aria = await demo.getToggleAriaPressed();
    expect(aria).toBe('true');

    // 'paused' class should be present
    const hasPaused = await demo.hasTogglePausedClass();
    expect(hasPaused).toBe(true);

    // Decision line and metrics should still be present and updated
    const metricP = await demo.getMetricPText();
    expect(metricP.startsWith('Average p:')).toBe(true);

    const decExists = await demo.decisionLineExists();
    expect(decExists).toBe(true);

    // No console or page errors should have occurred as a result of clicking
    await demo.expectNoConsoleErrors();
    await demo.expectNoPageErrors();
  });

  test('Clicking toggle twice -> Running again: label returns to "Pause" and aria/class updated', async ({ page }) => {
    // Validate transition S1_Paused -> S0_Running via ToggleAnimation (click)
    const demo = new DemoPage(page);
    await demo.goto();

    // Click twice: pause then resume
    await demo.clickToggle(); // pause
    await demo.clickToggle(); // resume

    // After second click, label should be "Pause"
    const label = await demo.getToggleLabelText();
    expect(label).toBe('Pause');

    // aria-pressed should be "false" when running
    const aria = await demo.getToggleAriaPressed();
    expect(aria).toBe('false');

    // 'paused' class should be absent
    const hasPaused = await demo.hasTogglePausedClass();
    expect(hasPaused).toBe(false);

    // Ensure draw/update functions didn't raise errors
    await demo.expectNoConsoleErrors();
    await demo.expectNoPageErrors();
  });

  test('Keyboard Space toggles animation (both directions) via ToggleAnimationKeyboard', async ({ page }) => {
    // Validate keyboard-triggered transitions for both directions
    const demo = new DemoPage(page);
    await demo.goto();

    // Press Space to toggle once -> should pause (label -> Play)
    await demo.pressSpace();
    expect(await demo.getToggleLabelText()).toBe('Play');
    expect(await demo.getToggleAriaPressed()).toBe('true');
    expect(await demo.hasTogglePausedClass()).toBe(true);

    // Press Space again to resume -> label -> Pause
    await demo.pressSpace();
    expect(await demo.getToggleLabelText()).toBe('Pause');
    expect(await demo.getToggleAriaPressed()).toBe('false');
    expect(await demo.hasTogglePausedClass()).toBe(false);

    // Keyboard handler should have called toggle.click() via code path with no exceptions
    await demo.expectNoConsoleErrors();
    await demo.expectNoPageErrors();
  });

  test('Rapid/torture toggling does not cause runtime errors (edge case)', async ({ page }) => {
    // Rapidly click the toggle many times to try to surface race conditions or errors
    const demo = new DemoPage(page);
    await demo.goto();

    // Rapidly perform clicks
    for (let i = 0; i < 12; i++) {
      // Schedule clicks with tiny gaps to exercise DOM update concurrency
      await demo.page.click('#toggle');
      // very short pause to emulate fast user
      await demo.page.waitForTimeout(30);
    }

    // Give animation loop some time
    await demo.page.waitForTimeout(200);

    // Validate final state is consistent (12 toggles -> even -> original running state 'Pause')
    const finalLabel = await demo.getToggleLabelText();
    expect(finalLabel).toBe('Pause');

    // No errors expected
    await demo.expectNoConsoleErrors();
    await demo.expectNoPageErrors();
  });

  test('Window resize triggers resize/draw handlers without errors and updates overlay viewBox', async ({ page }) => {
    // Validate responsiveness handler that calls resize() and drawAll(forceHeat=true)
    const demo = new DemoPage(page);
    await demo.goto();

    // Resize viewport to a different size to trigger window.resize handler
    await demo.resizeViewport(1200, 800);

    // After resize, call drawAll explicitly via exposed API to exercise drawAll path
    const called = await demo.callDrawAll(true);
    // drawAll should be callable
    expect(called).toBe(true);

    // ViewBox of overlay should have been updated to non-zero dimensions
    const viewBox = await page.$eval('#overlay', (el) => el.getAttribute('viewBox'));
    expect(viewBox).toBeTruthy();
    // It should be in the format "0 0 W H" where W and H are numbers greater than 0
    const parts = viewBox.split(/\s+/).map(Number);
    expect(parts.length).toBe(4);
    expect(parts[2]).toBeGreaterThanOrEqual(300);
    expect(parts[3]).toBeGreaterThanOrEqual(220);

    // Decision line should exist after draws
    expect(await demo.decisionLineExists()).toBe(true);

    // No console or page errors should have been emitted by resize/draw handlers
    await demo.expectNoConsoleErrors();
    await demo.expectNoPageErrors();
  });

  test('Exposed API window.LRdemo exists and genData/drawAll can be called safely', async ({ page }) => {
    // Validate exposed debug API is present and callable without throwing
    const demo = new DemoPage(page);
    await demo.goto();

    // Ensure window.LRdemo object exists
    const hasLRdemo = await page.evaluate(() => !!window.LRdemo && typeof window.LRdemo === 'object');
    expect(hasLRdemo).toBe(true);

    // Call genData and drawAll several times to ensure no exceptions are bubbled as page errors
    await page.evaluate(() => {
      if (window.LRdemo && typeof window.LRdemo.genData === 'function') {
        window.LRdemo.genData();
      }
    });
    // Allow a short settle and invoke drawAll
    await page.waitForTimeout(80);
    await demo.callDrawAll(true);
    await page.waitForTimeout(80);

    // Metric texts should update
    const pText = await demo.getMetricPText();
    expect(pText.startsWith('Average p:')).toBe(true);
    const mText = await demo.getMetricMarginText();
    expect(mText.startsWith('Avg margin:')).toBe(true);

    // Ensure no page console/pageerrors occurred
    await demo.expectNoConsoleErrors();
    await demo.expectNoPageErrors();
  });

  test('Sanity check: ensure decision boundary and margin metrics are reasonable numbers', async ({ page }) => {
    // After initialization and draw, check Avg margin is a parseable float and > 0
    const demo = new DemoPage(page);
    await demo.goto();

    // Ensure drawAll has been executed at least once
    await demo.callDrawAll(true);
    await page.waitForTimeout(120);

    const marginText = await demo.getMetricMarginText(); // "Avg margin: 0.XX"
    expect(marginText.startsWith('Avg margin:')).toBe(true);
    // Extract numeric part
    const match = marginText.match(/Avg margin:\s*([0-9.-]+)/);
    expect(match, 'Avg margin parseable').toBeTruthy();
    const val = parseFloat(match[1]);
    // margin should be a finite number (likely > 0)
    expect(Number.isFinite(val)).toBe(true);
    expect(val).toBeGreaterThanOrEqual(0);

    // Decision line exists
    expect(await demo.decisionLineExists()).toBe(true);

    // No runtime errors
    await demo.expectNoConsoleErrors();
    await demo.expectNoPageErrors();
  });

});