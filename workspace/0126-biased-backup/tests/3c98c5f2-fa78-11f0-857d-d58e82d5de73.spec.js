import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c98c5f2-fa78-11f0-857d-d58e82d5de73.html';

// Simple page object to encapsulate common operations and selectors
class SpaceVizPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.fillBtn = page.locator('#fillBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.spaceGrid = page.locator('#spaceGrid');
    this.infoBar = page.locator('#infoBar');
    this.cells = page.locator('#spaceGrid .space-cell');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickFill() {
    await this.fillBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async countCells() {
    return await this.cells.count();
  }

  async countUsedCells() {
    return await this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('#spaceGrid .space-cell.used')).length;
    });
  }

  async firstCellStyle() {
    return await this.page.evaluate(() => {
      const c = document.querySelector('#spaceGrid .space-cell');
      return c ? c.getAttribute('style') : '';
    });
  }

  async getInfoBarText() {
    return await this.infoBar.innerText();
  }

  async getInfoBarInnerHTML() {
    return await this.infoBar.innerHTML();
  }

  async isFillDisabled() {
    return await this.fillBtn.evaluate((b) => b.disabled);
  }

  async isResetDisabled() {
    return await this.resetBtn.evaluate((b) => b.disabled);
  }

  async getFillAriaPressed() {
    return await this.fillBtn.getAttribute('aria-pressed');
  }
}

// Group tests to logically reflect FSM: S0_Idle, S1_Animating, S2_Reset
test.describe('FSM: Space Complexity — A Visual Art (3c98c5f2-fa78-11f0-857d-d58e82d5de73)', () => {
  // Capture console errors and page errors for each test run
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location(),
        });
      }
    });

    // Collect unhandled exceptions from the page
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });
  });

  // Test initial/idle state (S0_Idle)
  test('S0_Idle: initial load has reset state and grid created', async ({ page }) => {
    // Arrange
    const app = new SpaceVizPage(page);
    await app.goto();

    // Assert: DOM built correctly - expect 72 cells
    const cellCount = await app.countCells();
    test.info().annotations.push({ type: 'cells', description: String(cellCount) });
    expect(cellCount).toBe(72);

    // Assert: No cell is marked used on initial reset
    const usedCount = await app.countUsedCells();
    expect(usedCount).toBe(0);

    // Assert: Buttons initial attributes per FSM evidence
    expect(await app.isResetDisabled()).toBe(true); // reset disabled initially (resetGrid sets disabled true)
    expect(await app.getFillAriaPressed()).toBe('false');

    // Assert: Info bar initial text contains the instruction
    const infoText = await app.getInfoBarText();
    expect(infoText).toContain('Click Show Example Space Usage');

    // Assert: No console or runtime errors occurred during load
    expect(consoleErrors.length, `console.error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  // Test transition S0_Idle -> S1_Animating via Show Example Space Usage (click #fillBtn)
  test('S0 -> S1: clicking Show Example Space Usage starts animation and updates UI', async ({ page }) => {
    const app = new SpaceVizPage(page);
    await app.goto();

    // Click the fill button to start animation
    await app.clickFill();

    // Immediately after clicking, per implementation, fillBtn should be disabled
    expect(await app.isFillDisabled()).toBe(true);

    // While animating, infoBar should indicate visualizing state quickly
    await expect(app.infoBar).toContainText('Visualizing', { timeout: 2000 });

    // Wait for final animation step that updates infoBar with breakdown
    // The implementation schedules this at (inputSize + auxSize) * 40 + 600 ms (~2640ms)
    // Allow a little extra time for robustness
    await page.waitForFunction(() => {
      const el = document.getElementById('infoBar');
      return el && el.innerHTML.includes('Memory Use Breakdown');
    }, null, { timeout: 7000 });

    // After final update: resetBtn should be enabled and fillBtn aria-pressed true
    expect(await app.isResetDisabled()).toBe(false);
    expect(await app.getFillAriaPressed()).toBe('true');

    // Verify expected number of used cells: inputSize (36) + auxSize (15) = 51
    const usedCount = await app.countUsedCells();
    expect(usedCount).toBe(51);

    // Confirm that both blue (input) and pink (aux) styling were applied to some cells
    const { blueCount, pinkCount } = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll('#spaceGrid .space-cell'));
      let blue = 0;
      let pink = 0;
      // Blue cells are the first 36, style background set to include '#5a84ff'
      for (let i = 0; i < cells.length; i++) {
        const s = cells[i].getAttribute('style') || '';
        if (s.includes('#5a84ff')) blue++;
        if (s.includes('#ff6e91')) pink++;
      }
      return { blueCount: blue, pinkCount: pink };
    });

    // Expect at least some blue and pink cells present (should be 36 and 15 respectively)
    expect(blueCount).toBeGreaterThanOrEqual(1);
    expect(pinkCount).toBeGreaterThanOrEqual(1);

    // No console or runtime errors during the animation
    expect(consoleErrors.length, `console.error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors)}`).toBe(0);

    // Also ensure that after the configured re-enable delay (3000ms), the fill button becomes enabled again
    // Wait up to 5s for re-enable to be safe
    await page.waitForFunction(() => !document.getElementById('fillBtn').disabled, null, { timeout: 5000 });
    expect(await app.isFillDisabled()).toBe(false);
  });

  // Test transition S1_Animating -> S2_Reset via Reset (click #resetBtn)
  test('S1 -> S2: after animation, clicking Reset restores idle appearance and disables reset', async ({ page }) => {
    const app = new SpaceVizPage(page);
    await app.goto();

    // Start animation and wait for final infoBar update
    await app.clickFill();
    await page.waitForFunction(() => {
      const el = document.getElementById('infoBar');
      return el && el.innerHTML.includes('Memory Use Breakdown');
    }, null, { timeout: 7000 });

    // Ensure reset button is enabled then click it
    expect(await app.isResetDisabled()).toBe(false);
    await app.clickReset();

    // After reset, no cells should be used
    // Wait a short moment to allow resetGrid to clear classes
    await page.waitForFunction(() => {
      return document.querySelectorAll('#spaceGrid .space-cell.used').length === 0;
    }, null, { timeout: 2000 });

    const usedAfterReset = await app.countUsedCells();
    expect(usedAfterReset).toBe(0);

    // Info bar should be restored to initial instructional text
    const infoText = await app.getInfoBarText();
    expect(infoText).toContain('Click Show Example Space Usage');

    // Reset button should be disabled again
    expect(await app.isResetDisabled()).toBe(true);

    // Fill button aria-pressed should be false after reset
    expect(await app.getFillAriaPressed()).toBe('false');

    // Ensure no console or page errors happened
    expect(consoleErrors.length, `console.error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  // Test transition S2_Reset -> S0_Idle via Show Example Space Usage (click again after reset)
  test('S2 -> S0 -> S1: clicking Fill after a Reset restarts the animation correctly', async ({ page }) => {
    const app = new SpaceVizPage(page);
    await app.goto();

    // 1) Trigger animation and wait for completion
    await app.clickFill();
    await page.waitForFunction(() => {
      return document.getElementById('infoBar') && document.getElementById('infoBar').innerHTML.includes('Memory Use Breakdown');
    }, null, { timeout: 7000 });

    // 2) Click Reset to enter S2_Reset
    await app.clickReset();
    await page.waitForFunction(() => {
      return document.querySelectorAll('#spaceGrid .space-cell.used').length === 0;
    }, null, { timeout: 2000 });

    // 3) Click Fill again to go back into Animating (S1)
    await app.clickFill();

    // Expect animation to restart: fillBtn disabled initially
    expect(await app.isFillDisabled()).toBe(true);

    // Wait for final breakdown again
    await page.waitForFunction(() => {
      return document.getElementById('infoBar') && document.getElementById('infoBar').innerHTML.includes('Memory Use Breakdown');
    }, null, { timeout: 7000 });

    // Confirm used count again
    const usedCount = await app.countUsedCells();
    expect(usedCount).toBe(51);

    // No console or runtime errors
    expect(consoleErrors.length, `console.error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  // Edge cases and error scenarios
  test('Edge case: clicking Reset while animation is in progress should not throw and should maintain expected behavior', async ({ page }) => {
    const app = new SpaceVizPage(page);
    await app.goto();

    // Start animation
    await app.clickFill();

    // Immediately attempt to click reset while it is still disabled (user action should be ignored)
    // Because resetBtn is disabled during animation until final update, this click will be ignored.
    // We still simulate the user attempting to click it to ensure no exceptions occur.
    const resetDisabledBefore = await app.isResetDisabled();
    expect(resetDisabledBefore).toBe(true);

    // Try to force a click event (Playwright click will attempt but disabled button won't trigger handler)
    // If button is disabled, Playwright will still perform a click but it has no effect; we capture console/page errors.
    await app.resetBtn.click().catch(() => {
      // Some browsers may block clicking a disabled button via automation; swallow the error in test but still assert no page/runtime errors
    });

    // Ensure animation eventually completes and updates info bar
    await page.waitForFunction(() => {
      return document.getElementById('infoBar') && document.getElementById('infoBar').innerHTML.includes('Memory Use Breakdown');
    }, null, { timeout: 7000 });

    // Ensure no console or runtime errors came from the attempted early reset
    expect(consoleErrors.length, `console.error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  // Final sanity: ensure page does not produce runtime console errors across interactions
  test('No runtime console errors across a sequence of interactions', async ({ page }) => {
    const app = new SpaceVizPage(page);
    await app.goto();

    // Sequence: fill -> wait -> reset -> fill -> wait -> reset
    await app.clickFill();
    await page.waitForFunction(() => document.getElementById('infoBar') && document.getElementById('infoBar').innerHTML.includes('Memory Use Breakdown'), null, { timeout: 7000 });
    await app.clickReset();
    await page.waitForFunction(() => document.querySelectorAll('#spaceGrid .space-cell.used').length === 0, null, { timeout: 2000 });
    await app.clickFill();
    await page.waitForFunction(() => document.getElementById('infoBar') && document.getElementById('infoBar').innerHTML.includes('Memory Use Breakdown'), null, { timeout: 7000 });
    await app.clickReset();
    await page.waitForFunction(() => document.querySelectorAll('#spaceGrid .space-cell.used').length === 0, null, { timeout: 2000 });

    // After this interaction sequence assert no console errors or uncaught page errors occurred
    expect(consoleErrors.length, `console.error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });
});