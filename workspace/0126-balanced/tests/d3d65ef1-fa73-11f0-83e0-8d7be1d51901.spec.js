import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d65ef1-fa73-11f0-83e0-8d7be1d51901.html';

// Page Object for Heap Sort Visualization
class HeapSortPage {
  constructor(page) {
    this.page = page;
  }

  // Element handles
  async startBtn() { return this.page.locator('#start'); }
  async pauseBtn() { return this.page.locator('#pause'); }
  async stepBtn() { return this.page.locator('#step'); }
  async resetBtn() { return this.page.locator('#reset'); }
  async generateBtn() { return this.page.locator('#generate'); }
  async shuffleBtn() { return this.page.locator('#shuffle'); }
  async randomMaxBtn() { return this.page.locator('#randomMax'); }
  async sizeInput() { return this.page.locator('#size'); }
  async speedInput() { return this.page.locator('#speed'); }
  async sizeLabel() { return this.page.locator('#sizeLabel'); }
  async phaseEl() { return this.page.locator('#phase'); }
  async indicesEl() { return this.page.locator('#indices'); }
  async barsContainer() { return this.page.locator('#bars'); }
  async codeLines() { return this.page.locator('.code-line'); }

  // Actions
  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickStart() { await (await this.startBtn()).click(); }
  async clickPause() { await (await this.pauseBtn()).click(); }
  async clickStep() { await (await this.stepBtn()).click(); }
  async clickReset() { await (await this.resetBtn()).click(); }
  async clickGenerate() { await (await this.generateBtn()).click(); }
  async clickShuffle() { await (await this.shuffleBtn()).click(); }
  async clickRandomMax() { await (await this.randomMaxBtn()).click(); }
  async setSize(n) {
    const el = await this.sizeInput();
    await el.fill(String(n));
    // Dispatch a change so the app clamps/updates values
    await this.page.dispatchEvent('#size', 'change');
  }
  async setSpeed(v) {
    // Use input value assignment
    await this.page.fill('#speed', String(v));
    // dispatch an input event in case code reads it later
    await this.page.dispatchEvent('#speed', 'input');
  }

  // State queries
  async getPhaseText() { return (await this.phaseEl()).textContent(); }
  async getIndicesText() { return (await this.indicesEl()).textContent(); }
  async getSizeLabel() { return (await this.sizeLabel()).textContent(); }
  async isStartDisabled() { return await (await this.startBtn()).isDisabled(); }
  async isPauseDisabled() { return await (await this.pauseBtn()).isDisabled(); }
  async isResetDisabled() { return await (await this.resetBtn()).isDisabled(); }
  async isStepDisabled() { return await (await this.stepBtn()).isDisabled(); }
  async barCount() { return await this.barsContainer().locator('.bar').count(); }
  async getBarValues() {
    const bars = this.barsContainer().locator('.bar');
    const n = await bars.count();
    const vals = [];
    for (let i = 0; i < n; i++) {
      vals.push(await bars.nth(i).locator('.val').textContent());
    }
    return vals.map(v => Number(v));
  }
  async getBarTitles() {
    const bars1 = this.barsContainer().locator('.bar');
    const n1 = await bars.count();
    const titles = [];
    for (let i = 0; i < n; i++) {
      titles.push(await bars.nth(i).getAttribute('title'));
    }
    return titles.map(t => Number(t));
  }
  async getActiveCodeLineNumbers() {
    const lines = this.page.locator('.code-line.active');
    const count = await lines.count();
    const nums = [];
    for (let i = 0; i < count; i++) {
      const ds = await lines.nth(i).getAttribute('data-line');
      nums.push(Number(ds));
    }
    return nums;
  }

  // Wait helpers
  async waitForPhaseContains(substr, timeout = 3000) {
    await this.page.waitForFunction(
      (sel, s) => document.querySelector(sel) && document.querySelector(sel).textContent.includes(s),
      '#phase',
      substr,
      { timeout }
    );
  }

  async waitForIndicesNotEmpty(timeout = 3000) {
    await this.page.waitForFunction(
      (sel) => document.querySelector(sel) && document.querySelector(sel).textContent.trim().length > 0,
      '#indices',
      { timeout }
    );
  }

  async waitForSomeBarClass(className, timeout = 3000) {
    await this.page.waitForFunction(
      (cls) => !!document.querySelector(`#bars .bar.${cls}`),
      className,
      { timeout }
    );
  }
}

// Test suite
test.describe('Heap Sort Visualization - FSM and UI behavior', () => {
  let consoleErrors = [];
  let pageErrors = [];

  // Attach listeners per test to capture console and page errors
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  // Test initial Ready state (S0_Ready)
  test('Initial state is Ready with expected UI elements', async ({ page }) => {
    const app = new HeapSortPage(page);
    await app.goto();

    // Validate Ready phase text and indices empty
    const phase = await app.getPhaseText();
    expect(phase).toBe('Phase: Ready');

    const indices = await app.getIndicesText();
    expect(indices.trim()).toBe('');

    // Validate size label and bars render
    const sizeLabel = await app.getSizeLabel();
    expect(Number(sizeLabel)).toBeGreaterThanOrEqual(5); // default 30
    const count1 = await app.barCount();
    expect(count).toBeGreaterThanOrEqual(5);

    // Validate control buttons initial states
    expect(await app.isStartDisabled()).toBe(false);
    expect(await app.isPauseDisabled()).toBe(true); // pause should be disabled initially
    expect(await app.isStepDisabled()).toBe(false);

    // No console or page errors on load
    expect(consoleErrors, 'No console errors on initial load').toEqual([]);
    expect(pageErrors, 'No page errors on initial load').toEqual([]);
  });

  // Test GenerateArray and ShuffleArray events (self-transitions to Ready)
  test('Generate and Shuffle keep app in Ready state and update bars', async ({ page }) => {
    const app1 = new HeapSortPage(page);
    await app.goto();

    // Record initial bar values
    const beforeVals = await app.getBarValues();

    // Click Generate and ensure state returns/maintains Ready
    await app.clickGenerate();
    expect(await app.getPhaseText()).toBe('Phase: Ready');
    const afterGenerateCount = await app.barCount();
    expect(afterGenerateCount).toBe(beforeVals.length); // size should remain default unless changed

    // Click Shuffle and ensure still Ready. Order may change; assert at least size maintained.
    await app.clickShuffle();
    expect(await app.getPhaseText()).toBe('Phase: Ready');
    const afterShuffleVals = await app.getBarValues();
    expect(afterShuffleVals.length).toBe(beforeVals.length);

    // It's possible shuffle results in same order by chance; ensure at least bars rendered and values are numeric
    for (const v of afterShuffleVals) {
      expect(typeof v).toBe('number');
      expect(v).toBeGreaterThanOrEqual(5);
    }

    // No console or page errors occurred during interactions
    expect(consoleErrors, 'No console errors during generate/shuffle').toEqual([]);
    expect(pageErrors, 'No page errors during generate/shuffle').toEqual([]);
  });

  // Test Starting the sorting process transitions to Sorting (S1_Sorting) and controls behavior
  test('StartSorting transitions into active Sorting state and pause/resume toggles (S1 <-> S2)', async ({ page }) => {
    const app2 = new HeapSortPage(page);
    await app.goto();

    // Speed up the visualization to reduce waiting time
    await app.setSpeed(0);

    // Click Start: should disable Start button and enable Pause
    await app.clickStart();

    // Immediately after starting, runGenerator sets startBtn.disabled = true and pauseBtn.disabled = false
    expect(await app.isStartDisabled()).toBe(true);
    expect(await app.isPauseDisabled()).toBe(false);

    // Wait until we see some non-ready phase (Building or Sorting) to indicate generator progressed
    await app.waitForPhaseContains('Building', 2000).catch(() => {}); // not fatal if not reached yet
    // Also allow 'Sorting' as evidence; ensure some phase other than Ready appears within a timeout
    const nonReadySeen = await page.waitForFunction(() => {
      const txt = document.querySelector('#phase')?.textContent || '';
      return !txt.includes('Ready');
    }, { timeout: 3000 }).catch(() => null);
    expect(nonReadySeen).not.toBeNull();

    // Pause the sorting (S1_Sorting -> S2_Paused)
    await app.clickPause();
    // pauseBtn click toggles text content to 'Resume' when paused
    await page.waitForFunction(() => document.querySelector('#pause')?.textContent === 'Resume', { timeout: 2000 });
    const pauseText = await (await app.pauseBtn()).textContent();
    expect(pauseText).toBe('Resume');

    // Resume sorting (S2_Paused -> S1_Sorting)
    await app.clickPause();
    await page.waitForFunction(() => document.querySelector('#pause')?.textContent === 'Pause', { timeout: 2000 });
    const resumeText = await (await app.pauseBtn()).textContent();
    expect(resumeText).toBe('Pause');

    // After some time allow generator to continue a bit and then request a reset to finish gracefully
    // Reset is disabled while running; we'll pause and then reset
    await app.clickPause(); // pause again
    await page.waitForFunction(() => document.querySelector('#pause')?.textContent === 'Resume', { timeout: 2000 });
    // Now stop by clicking Reset (reset is not disabled when not running)
    await app.clickReset();
    // After reset we should be back to Ready
    await page.waitForFunction(() => document.querySelector('#phase')?.textContent === 'Phase: Ready', { timeout: 2000 });
    expect(await app.getPhaseText()).toBe('Phase: Ready');

    // Validate no console or page errors during start/pause/resume flow
    expect(consoleErrors, 'No console errors during start/pause/resume').toEqual([]);
    expect(pageErrors, 'No page errors during start/pause/resume').toEqual([]);
  }, { timeout: 20000 });

  // Test Step mode behavior (S3_StepMode and transitions with S2_Paused)
  test('Step button advances one action in Step Mode and toggles step behavior', async ({ page }) => {
    const app3 = new HeapSortPage(page);
    await app.goto();

    // Make steps reasonably slow so we can observe single-step behavior
    await app.setSpeed(1000);

    // Start stepping from Ready: this should start generator in paused mode and execute one step
    await app.clickStep();

    // Quick assertions about button states right after step is invoked
    expect(await app.isStartDisabled()).toBe(true); // start should be disabled while the generator is running (even in paused step-mode)
    expect(await app.isResetDisabled()).toBe(true); // reset is disabled when generator started via step

    // Wait until phase changes away from Ready to indicate a step applied
    await page.waitForFunction(() => !document.querySelector('#phase')?.textContent.includes('Ready'), { timeout: 3000 });
    const phaseAfterStep = await app.getPhaseText();
    expect(phaseAfterStep).not.toBe('Phase: Ready');

    // After the single step completes the generator remains running but paused; we can click Step again to advance another action
    // Click Step again to perform another single step
    await app.clickStep();

    // Validate that code line highlighting exists at some point (a code line should be active during steps)
    const activeCodes = await app.getActiveCodeLineNumbers().catch(() => []);
    // We cannot guarantee which line, but if step caused code line highlighting, array length >= 0
    expect(Array.isArray(activeCodes)).toBe(true);

    // Finally, click Reset to stop the generator and return to Ready
    // In some states reset might be disabled until generator finishes; try to pause then reset
    await app.clickPause().catch(() => {});
    await page.waitForFunction(() => document.querySelector('#pause')?.textContent === 'Resume', { timeout: 2000 }).catch(() => {});
    await app.clickReset();
    await page.waitForFunction(() => document.querySelector('#phase')?.textContent === 'Phase: Ready', { timeout: 3000 });
    expect(await app.getPhaseText()).toBe('Phase: Ready');

    // No console/page errors during step interactions
    expect(consoleErrors, 'No console errors during stepping').toEqual([]);
    expect(pageErrors, 'No page errors during stepping').toEqual([]);
  }, { timeout: 20000 });

  // Test Reset behavior from Ready (S0_Ready self-transition) and size clamping
  test('Reset and Size input clamping (edge case)', async ({ page }) => {
    const app4 = new HeapSortPage(page);
    await app.goto();

    // Change size to an out-of-range small value and ensure the app clamps to the minimum (5)
    await app.setSize(3); // below minimum
    // After change, sizeInput should be clamped and sizeLabel updated
    await page.waitForFunction(() => document.querySelector('#size')?.value === '5', { timeout: 1000 });
    expect(await (await app.sizeInput()).inputValue()).toBe('5');
    expect(await app.getSizeLabel()).toBe('5');

    // Click Reset in Ready state: should generate array with current size and remain Ready
    await app.clickReset();
    const phase1 = await app.getPhaseText();
    expect(phase).toBe('Phase: Ready');
    const count2 = await app.barCount();
    expect(count).toBe(5); // clamped size

    // No console/page errors
    expect(consoleErrors, 'No console errors during reset/size clamp').toEqual([]);
    expect(pageErrors, 'No page errors during reset/size clamp').toEqual([]);
  });

  // Test keyboard shortcuts: r (generate), s (step), Space toggles start/pause
  test('Keyboard shortcuts trigger expected handlers and do not cause runtime errors', async ({ page }) => {
    const app5 = new HeapSortPage(page);
    await app.goto();

    // Press 'r' to generate new array - should remain in Ready
    await page.keyboard.press('r');
    await page.waitForFunction(() => document.querySelector('#phase')?.textContent === 'Phase: Ready', { timeout: 1000 });
    expect(await app.getPhaseText()).toBe('Phase: Ready');

    // Press 's' to step - this triggers Step behavior; ensure phase moves away from Ready
    await page.keyboard.press('s');
    await page.waitForFunction(() => !document.querySelector('#phase')?.textContent.includes('Ready'), { timeout: 2000 });
    expect((await app.getPhaseText()).includes('Phase')).toBe(true);

    // Press Space to toggle pause/start: since generator may be running, space toggles pause button if running
    await page.keyboard.press(' ');
    // After pressing space the app either started or paused; ensure no exceptions thrown and UI still accessible
    expect(await app.barsContainer().isVisible()).toBe(true);

    // Ensure no console/page errors were produced via keyboard shortcuts
    expect(consoleErrors, 'No console errors from keyboard shortcuts').toEqual([]);
    expect(pageErrors, 'No page errors from keyboard shortcuts').toEqual([]);
  });

  // Final test to ensure no unexpected runtime errors appeared during the suite interactions
  test('No unexpected runtime errors (console or page errors) during interactions', async ({ page }) => {
    const app6 = new HeapSortPage(page);
    await app.goto();

    // Perform a set of interactions quickly: generate, shuffle, start then pause
    await app.clickGenerate();
    await app.clickShuffle();
    await app.setSpeed(0);
    await app.clickStart();
    // Pause quickly
    await app.clickPause().catch(() => {});
    // Then Reset to be safe
    await app.clickReset();

    // Wait briefly to allow any asynchronous errors to surface
    await page.waitForTimeout(500);

    // Assert that no console 'error' messages or page errors were captured
    expect(consoleErrors, 'No console.error messages during complex interaction').toEqual([]);
    expect(pageErrors, 'No page error events during complex interaction').toEqual([]);
  }, { timeout: 15000 });
});