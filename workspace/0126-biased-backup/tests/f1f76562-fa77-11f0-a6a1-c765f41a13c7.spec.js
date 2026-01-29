import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f76562-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object for the demo app to encapsulate interactions & queries
class CPUVisPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Controls
  async clickPlay() {
    await this.page.click('#playBtn');
  }
  async clickReset() {
    await this.page.click('#resetBtn');
  }
  async pressSpace() {
    // Dispatch on the page's window
    await this.page.keyboard.press('Space');
  }

  // Query helpers
  async getPlayLabel() {
    return (await this.page.locator('#playLabel').textContent()).trim();
  }

  async waitForPlayLabel(expected, options = {}) {
    await this.page.waitForFunction(
      (sel, val) => {
        const el = document.querySelector(sel);
        return el && el.textContent.trim() === val;
      },
      '#playLabel',
      expected,
      options
    );
    return this.getPlayLabel();
  }

  async isGearSpinning() {
    return this.page.locator('#gear').evaluate((el) => el.classList.contains('spin'));
  }

  async waitForGearSpinState(expected, timeout = 3000) {
    await this.page.waitForFunction(
      (sel, exp) => {
        const el = document.querySelector(sel);
        return !!el && el.classList.contains('spin') === exp;
      },
      '#gear',
      expected,
      { timeout }
    );
    return this.isGearSpinning();
  }

  async getGanttTimebarTransform() {
    return this.page.locator('#ganttTimebar').evaluate((el) => {
      const t = el.style.transform || getComputedStyle(el).transform || '';
      return t;
    });
  }

  async waitForTimebarMove(nonZero = true, timeout = 5000) {
    // Wait until the timebar transform shows progress (translateX > 0) or back to 0
    await this.page.waitForFunction(
      (sel, nz) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const t = el.style.transform || getComputedStyle(el).transform || '';
        // Expect format: translateX(123px) or matrix(...) fallback
        if (nz) {
          return /translateX\(\s*\d+px\s*\)/.test(t) && !/translateX\(\s*0px\s*\)/.test(t);
        } else {
          return /translateX\(\s*0px\s*\)/.test(t) || t === '' || t === 'none';
        }
      },
      '#ganttTimebar',
      nonZero,
      { timeout }
    );
  }

  async getDoneCount() {
    return this.page.locator('#doneArea').locator('.proc, [id^="token-"][id$="-active"]').count();
  }

  async getQueueTokenOpacity(pid) {
    return this.page.locator(`#token-${pid}`).evaluate((el) => window.getComputedStyle(el).opacity);
  }

  async getSpecCountText() {
    return (await this.page.locator('#specCount').textContent()).trim();
  }

  async getTotalTimeText() {
    return (await this.page.locator('#totalTime').textContent()).trim();
  }
}

// Capture and assert console/page errors across tests
test.describe('CPU Scheduling Visual Demo — FSM & UI', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];
    consoleMessages = [];

    // Collect console messages and page errors
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // Navigate to the app
    const app = new CPUVisPage(page);
    await app.goto();

    // Wait for initial render to stabilize: controls visible and play label present
    await page.waitForSelector('#playBtn', { state: 'visible', timeout: 3000 });
    await page.waitForSelector('#resetBtn', { state: 'visible', timeout: 3000 });
    await page.waitForSelector('#playLabel', { state: 'visible', timeout: 3000 });
  });

  test.afterEach(async () => {
    // Assert no uncaught page errors occurred during the test
    // The app is expected to run without ReferenceError/SyntaxError/TypeError.
    expect(pageErrors, `Unexpected window errors: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
    expect(consoleErrors, `Unexpected console.error messages: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
    // Optionally collect any console messages for debugging if needed
  });

  test.describe('Initial state (S0_Idle) validations', () => {
    test('renders controls and initial labels (Idle)', async ({ page }) => {
      const app = new CPUVisPage(page);

      // Validate Play label is 'Play' (Idle state)
      const playLabel = await app.getPlayLabel();
      expect(playLabel).toBe('Play');

      // Reset button visible and labelled Reset
      const resetText = await page.locator('#resetBtn').textContent();
      expect(resetText).toContain('Reset');

      // Spec count and total time populated
      const specCount = await app.getSpecCountText();
      expect(Number(specCount)).toBeGreaterThanOrEqual(1); // processes exist (6 expected)
      const totalTime = await app.getTotalTimeText();
      expect(totalTime).toMatch(/unit/); // e.g., '17 units'

      // Gear should not be spinning in idle state
      const spinning = await app.isGearSpinning();
      expect(spinning).toBe(false);
    });
  });

  test.describe('Play/Pause interactions (PlayPause event & SpaceToggle)', () => {
    test('clicking Play toggles to Playing (S1_Playing)', async ({ page }) => {
      const app = new CPUVisPage(page);

      // Click Play
      await app.clickPlay();

      // Expect label to change to 'Pause'
      await app.waitForPlayLabel('Pause', { timeout: 3000 });
      expect(await app.getPlayLabel()).toBe('Pause');

      // Gear should have spin class (visual cue for playing)
      expect(await app.isGearSpinning()).toBe(true);

      // Timebar should start moving (non-zero transform) within a short time
      await app.waitForTimebarMove(true, 5000);
      const tb = await app.getGanttTimebarTransform();
      expect(tb).toMatch(/translateX\(/);
    });

    test('clicking Play again pauses back to Paused (S2_Paused)', async ({ page }) => {
      const app = new CPUVisPage(page);

      // Ensure playing
      await app.clickPlay();
      await app.waitForPlayLabel('Pause', { timeout: 3000 });

      // Click to pause
      await app.clickPlay();

      // Label should return to 'Play' signifying Paused
      await app.waitForPlayLabel('Play', { timeout: 3000 });
      expect(await app.getPlayLabel()).toBe('Play');

      // Gear should not be spinning
      await app.waitForGearSpinState(false, 3000);
      expect(await app.isGearSpinning()).toBe(false);
    });

    test('spacebar toggles play/pause (SpaceToggle event)', async ({ page }) => {
      const app = new CPUVisPage(page);

      // Start with space -> start playing
      await app.pressSpace();
      await app.waitForPlayLabel('Pause', { timeout: 3000 });
      expect(await app.getPlayLabel()).toBe('Pause');
      expect(await app.isGearSpinning()).toBe(true);

      // Space again -> pause
      await app.pressSpace();
      await app.waitForPlayLabel('Play', { timeout: 3000 });
      expect(await app.getPlayLabel()).toBe('Play');
      expect(await app.isGearSpinning()).toBe(false);
    });
  });

  test.describe('Reset transitions and observables', () => {
    test('Reset from Playing returns to Idle (S1_Playing -> S0_Idle)', async ({ page }) => {
      const app = new CPUVisPage(page);

      // Play then wait a brief moment so simulation advances slightly
      await app.clickPlay();
      await app.waitForPlayLabel('Pause', { timeout: 3000 });
      await app.waitForTimebarMove(true, 5000);

      // Now click Reset
      await app.clickReset();

      // Should return to Idle: Play label text, gear not spinning
      await app.waitForPlayLabel('Play', { timeout: 3000 });
      expect(await app.getPlayLabel()).toBe('Play');
      expect(await app.isGearSpinning()).toBe(false);

      // Gantt timebar should reset to 0 (translateX(0px) or none)
      await app.waitForTimebarMove(false, 3000);
      const tb = await app.getGanttTimebarTransform();
      // either explicitly translateX(0px) or empty / none
      expect(tb === '' || tb.includes('translateX(0px)') || tb === 'none').toBe(true);

      // CPU and done areas should be cleared
      const doneCount = await app.getDoneCount();
      expect(doneCount).toBe(0);

      // Tokens in queue should be visible (opacity 1)
      const op = await app.getQueueTokenOpacity('P1');
      expect(op).toBe('1');
    });

    test('Reset from Paused returns to Idle (S2_Paused -> S0_Idle)', async ({ page }) => {
      const app = new CPUVisPage(page);

      // Start, then pause
      await app.clickPlay();
      await app.waitForPlayLabel('Pause', { timeout: 3000 });
      // pause
      await app.clickPlay();
      await app.waitForPlayLabel('Play', { timeout: 3000 });

      // Now Reset
      await app.clickReset();
      await app.waitForPlayLabel('Play', { timeout: 3000 });
      expect(await app.getPlayLabel()).toBe('Play');
      expect(await app.isGearSpinning()).toBe(false);

      // Ensure timebar reset
      await app.waitForTimebarMove(false, 3000);
      const tb = await app.getGanttTimebarTransform();
      expect(tb === '' || tb.includes('translateX(0px)') || tb === 'none').toBe(true);

      const doneCount = await app.getDoneCount();
      expect(doneCount).toBe(0);
    });
  });

  test.describe('Edge cases, accessibility & error observation', () => {
    test('non-space keys do not toggle Play/Pause', async ({ page }) => {
      const app = new CPUVisPage(page);

      // Ensure initial is Play
      expect(await app.getPlayLabel()).toBe('Play');

      // Press 'KeyA' which should not toggle according to the implementation
      await page.keyboard.press('KeyA');
      // short wait to ensure no change
      await page.waitForTimeout(300);
      expect(await app.getPlayLabel()).toBe('Play');

      // Press Enter should also not toggle
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      expect(await app.getPlayLabel()).toBe('Play');
    });

    test('rapid toggling does not throw runtime errors and toggles state', async ({ page }) => {
      const app = new CPUVisPage(page);

      // Rapidly click play/pause multiple times
      for (let i = 0; i < 4; i++) {
        await app.clickPlay();
        await page.waitForTimeout(120);
      }

      // Ensure label is either Play or Pause (consistency), and no page errors occurred (checked in afterEach)
      const label = await app.getPlayLabel();
      expect(['Play', 'Pause']).toContain(label);
    });

    test('observes console and page errors (none expected)', async ({ page }) => {
      // This test is primarily to ensure that console/page errors are captured during the scenario
      // We do a small interaction and then rely on afterEach to assert no errors occurred.
      const app = new CPUVisPage(page);

      // Trigger some interactions
      await app.clickPlay();
      await app.waitForPlayLabel('Pause', { timeout: 3000 });
      await app.clickPlay();
      await app.waitForPlayLabel('Play', { timeout: 3000 });
      // No explicit assertion here: afterEach asserts no page or console.errors
    });
  });
});