import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e1baa3-d5c1-11f0-a327-5f281c6cb8e2.html';

// Page object to encapsulate common interactions / queries
class InsertionSortPage {
  constructor(page) {
    this.page = page;
  }

  // Element handles
  async canvas() { return this.page.locator('#canvas'); }
  async bars() { return this.page.locator('#canvas .bar'); }
  async sizeRange() { return this.page.locator('#size'); }
  async sizeLabel() { return this.page.locator('#sizeLabel'); }
  async generateBtn() { return this.page.locator('#generate'); }
  async prepareBtn() { return this.page.locator('#prepare'); }
  async resetBtn() { return this.page.locator('#reset'); }
  async playBtn() { return this.page.locator('#play'); }
  async pauseBtn() { return this.page.locator('#pause'); }
  async stepFwdBtn() { return this.page.locator('#stepForward'); }
  async stepBackBtn() { return this.page.locator('#stepBack'); }
  async arrInput() { return this.page.locator('#arrinput'); }
  async loadBtn() { return this.page.locator('#load'); }
  async speedRange() { return this.page.locator('#speed'); }
  async orderSelect() { return this.page.locator('#order'); }
  async compEl() { return this.page.locator('#comp'); }
  async writesEl() { return this.page.locator('#writes'); }
  async stepsCountEl() { return this.page.locator('#stepsCount'); }
  async pseudocodeActive() { return this.page.locator('#pseudocode .line.active'); }
  async descEl() { return this.page.locator('#description'); }

  // Utilities / actions
  async waitForInitialRender() {
    // Wait until the canvas has at least one bar (initial rendering in init())
    await this.page.waitForSelector('#canvas .bar');
  }

  async getBarsCount() {
    return await this.bars().count();
  }

  async getArrInputValue() {
    return await this.arrInput().inputValue();
  }

  async clickGenerate() {
    await this.generateBtn().click();
  }

  async clickPrepare() {
    await this.prepareBtn().click();
  }

  async clickPlay() {
    await this.playBtn().click();
  }

  async clickPause() {
    await this.pauseBtn().click();
  }

  async clickStepForward() {
    await this.stepFwdBtn().click();
  }

  async clickStepBack() {
    await this.stepBackBtn().click();
  }

  async setSpeed(value) {
    // set value and dispatch input event so page reads updated speed
    await this.page.evaluate((v) => {
      const el = document.getElementById('speed');
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }

  async loadCustomArray(text) {
    await this.arrInput().fill(text);
    await this.loadBtn().click();
  }

  async getDescText() {
    return await this.descEl().innerText();
  }

  async getStepsCount() {
    const txt = await this.stepsCountEl().innerText();
    return Number(txt);
  }

  async getCompWrites() {
    const comp = Number(await this.compEl().innerText());
    const writes = Number(await this.writesEl().innerText());
    return { comp, writes };
  }

  async getActivePseudocodeLine() {
    const active = await this.pseudocodeActive();
    if (await active.count() === 0) return null;
    return await active.getAttribute('data-line');
  }
}

test.describe('Insertion Sort Visualizer - FSM and UI interactions', () => {
  let page;
  let errors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ browser }) => {
    // create a new context and page for isolation
    const context = await browser.newContext();
    page = await context.newPage();

    errors = [];
    consoleErrors = [];

    // capture runtime page errors
    page.on('pageerror', (err) => {
      errors.push(err);
    });

    // capture console messages and filter errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure initial render finished
    const isp = new InsertionSortPage(page);
    await isp.waitForInitialRender();
  });

  test.afterEach(async () => {
    // Assert no unexpected runtime errors or console errors occurred during the test
    // These assertions ensure we observed (or didn't) JS runtime issues naturally
    expect(errors, `Page errors: ${errors.map(e => String(e)).join('; ')}`).toHaveLength(0);
    expect(consoleErrors, `Console error messages: ${consoleErrors.join(' | ')}`).toHaveLength(0);

    // Close page's context
    await page.context().close();
  });

  test.describe('Initialization (S0_Idle)', () => {
    test('Initial page load renders array and UI elements', async () => {
      // Validate initial Idle state: renderArray called on init, bars present, inputs populated
      const isp = new InsertionSortPage(page);

      // Size label should reflect default value 18
      await expect(isp.sizeLabel()).toHaveText('18');

      // arrInput should be populated with comma-separated numbers
      const arrVal = await isp.getArrInputValue();
      expect(arrVal.length).toBeGreaterThan(0);

      // Canvas should contain bars (rendered array)
      const barsCount = await isp.getBarsCount();
      expect(barsCount).toBeGreaterThanOrEqual(5); // size range min is 5

      // Pause button initially disabled by init()
      await expect(isp.pauseBtn()).toBeDisabled();
    });
  });

  test.describe('Array generation and preparation (S1 -> S2)', () => {
    test('Generate Random produces a new array and resets stats (S1_ArrayGenerated)', async () => {
      const isp = new InsertionSortPage(page);

      // Click generate and verify arrInput and description update
      await isp.clickGenerate();

      // arrInput should contain the generated array
      const arrVal = await isp.getArrInputValue();
      expect(arrVal.split(',').length).toBeGreaterThanOrEqual(5);

      // Description should instruct to prepare steps
      const desc = await isp.getDescText();
      expect(desc).toMatch(/Random array generated\. Press "Prepare Steps" to compute frames\./);

      // Stats reset to 0
      const stats = await isp.getCompWrites();
      expect(stats.comp).toBe(0);
      expect(stats.writes).toBe(0);

      // Steps count remains 0 until prepare clicked
      const stepCount = await isp.getStepsCount();
      expect(stepCount).toBe(0);
    });

    test('Prepare Steps computes frames and updates counters (S2_StepsPrepared)', async () => {
      const isp = new InsertionSortPage(page);

      // For deterministic speed of test, ensure an array exists and call prepare
      await isp.clickGenerate(); // create a new array and populate arrInput

      // Click prepare and wait for stepsCount to become > 0
      await isp.clickPrepare();
      await page.waitForFunction(() => {
        const el = document.getElementById('stepsCount');
        return el && Number(el.textContent) > 0;
      });

      // Steps count should be > 0
      const stepsCount = await isp.getStepsCount();
      expect(stepsCount).toBeGreaterThan(0);

      // Description should include totals and instruction to press Play
      const desc = await isp.getDescText();
      expect(desc).toMatch(/Prepared \d+ steps\. Comparison total: \d+, writes total: \d+\. Press Play\./);

      // Pseudocode should highlight a line corresponding to step 0
      const activeLine = await isp.getActivePseudocodeLine();
      expect(activeLine).not.toBeNull();
    });
  });

  test.describe('Playback controls (S3_Playing, S4_Paused)', () => {
    test('Play starts the animation and Pause stops it (S3_Playing -> S4_Paused)', async () => {
      const isp = new InsertionSortPage(page);

      // Prepare steps first
      await isp.clickPrepare();
      await page.waitForFunction(() => Number(document.getElementById('stepsCount').textContent) > 0);

      // Speed up playback to ensure step progression within test timeframe
      await isp.setSpeed(50);

      // Click play -> expected: playBtn.disabled true, pauseBtn.disabled false
      await isp.clickPlay();
      await expect(isp.playBtn()).toBeDisabled();
      await expect(isp.pauseBtn()).toBeEnabled();

      // Wait for at least one step to advance beyond 0 (desc text like "Step 1/...")
      await page.waitForFunction(() => {
        const d = document.getElementById('description');
        return d && /\bStep\s+\d+\/\d+/.test(d.textContent) && !d.textContent.startsWith('Step 0/');
      }, { timeout: 3000 });

      // Now pause
      await isp.clickPause();
      await expect(isp.playBtn()).toBeEnabled();
      await expect(isp.pauseBtn()).toBeDisabled();

      // Ensure playing state ceased by waiting a short time and confirming description doesn't change
      const descBefore = await isp.getDescText();
      await page.waitForTimeout(200);
      const descAfter = await isp.getDescText();
      expect(descAfter).toBe(descBefore);
    });
  });

  test.describe('Stepping and reset (S5_StepForward, S6_StepBackward, Reset)', () => {
    test('Step forward/back transitions and reset behavior', async () => {
      const isp = new InsertionSortPage(page);

      // Prepare steps
      await isp.clickPrepare();
      await page.waitForFunction(() => Number(document.getElementById('stepsCount').textContent) > 0);

      // Ensure paused
      await isp.clickPause();

      // Record initial step index from description (should be 0)
      const desc0 = await isp.getDescText();
      expect(desc0).toMatch(/^Step 0\//);

      // Step forward
      await isp.clickStepForward();
      // Wait until description shows step 1 or remains same if only 1 step exists
      await page.waitForFunction(() => {
        const d = document.getElementById('description');
        return d && /Step\s+1\//.test(d.textContent);
      }, { timeout: 2000 });

      const desc1 = await isp.getDescText();
      expect(desc1).toMatch(/Step\s+1\//);

      // Step back
      await isp.clickStepBack();
      await page.waitForFunction(() => {
        const d = document.getElementById('description');
        return d && /Step\s+0\//.test(d.textContent);
      }, { timeout: 2000 });
      const descBack = await isp.getDescText();
      expect(descBack).toMatch(/^Step 0\//);

      // Attempt step back at 0 -> should not go negative and description remains Step 0
      await isp.clickStepBack();
      await page.waitForTimeout(150);
      const descStillZero = await isp.getDescText();
      expect(descStillZero).toMatch(/^Step 0\//);

      // Move forward a few steps, then click Reset -> expect to be at step 0 and paused
      // Move forward twice if possible
      await isp.clickStepForward();
      await page.waitForTimeout(100);
      await isp.clickStepForward();
      await page.waitForTimeout(150);

      // Now reset
      await isp.clickReset();
      // After reset, should be at step 0; description or canvas should reflect step 0 if steps exist
      const descAfterReset = await isp.getDescText();
      expect(descAfterReset).toMatch(/Step\s+0\//);
      // Pause should be in effect (pause sets pauseBtn.disabled = true)
      await expect(isp.pauseBtn()).toBeDisabled();
    });

    test('Step forward/back without prepared steps shows explanatory message (edge case)', async () => {
      const isp = new InsertionSortPage(page);

      // Ensure no prepared steps: create new random array but DO NOT prepare
      await isp.clickGenerate();

      // Click step forward -> should update description with 'No prepared steps'
      await isp.clickStepForward();
      const descAfter = await isp.getDescText();
      expect(descAfter).toMatch(/No prepared steps\. Press "Prepare Steps" first\./);

      // Click step back -> same message
      await isp.clickStepBack();
      const descAfterBack = await isp.getDescText();
      expect(descAfterBack).toMatch(/No prepared steps\. Press "Prepare Steps" first\./);
    });
  });

  test.describe('Custom array loading (S7_CustomArrayLoaded) and edge cases', () => {
    test('Load custom array and prepare steps (S7_CustomArrayLoaded -> S2_StepsPrepared)', async () => {
      const isp = new InsertionSortPage(page);

      // Load a known small array
      await isp.loadCustomArray('5,3,8,1,6');

      // After load, description should instruct to prepare steps
      const desc = await isp.getDescText();
      expect(desc).toMatch(/Custom array loaded\. Press "Prepare Steps" to compute frames\./);

      // Canvas should show 5 bars
      const barsCount = await isp.getBarsCount();
      expect(barsCount).toBe(5);

      // sizeRange should reflect the array length (clamped to 5..40)
      const sizeLabel = await isp.sizeLabel().innerText();
      expect(Number(sizeLabel)).toBe(5);

      // Now prepare steps and ensure steps were created
      await isp.clickPrepare();
      await page.waitForFunction(() => Number(document.getElementById('stepsCount').textContent) > 0);
      const stepsCount = await isp.getStepsCount();
      expect(stepsCount).toBeGreaterThan(0);
    });

    test('Load empty input shows helpful message (edge case)', async () => {
      const isp = new InsertionSortPage(page);

      // Clear input and click load
      await isp.arrInput().fill('');
      await isp.loadBtn().click();

      const desc = await isp.getDescText();
      expect(desc).toMatch(/Please type a comma-separated array in the input\./);
    });

    test('Load invalid input shows "No valid numbers found" (edge case)', async () => {
      const isp = new InsertionSortPage(page);

      await isp.arrInput().fill('a,b,c');
      await isp.loadBtn().click();

      const desc = await isp.getDescText();
      expect(desc).toMatch(/No valid numbers found in input\./);
    });
  });

  test.describe('Console and runtime observation', () => {
    test('No runtime exceptions or console errors during typical interactions', async () => {
      const isp = new InsertionSortPage(page);

      // Perform a suite of interactions to exercise the app
      await isp.clickGenerate();
      await isp.clickPrepare();
      await page.waitForFunction(() => Number(document.getElementById('stepsCount').textContent) > 0);
      await isp.setSpeed(50);
      await isp.clickPlay();
      // wait a short time to allow animation tick
      await page.waitForTimeout(300);
      await isp.clickPause();
      await isp.clickStepForward();
      await isp.clickStepBack();
      await isp.clickReset();

      // Also test keyboard shortcuts: space to toggle play/pause (simulate with press)
      await page.keyboard.press('Space');
      // Wait a bit and then press space again to toggle
      await page.waitForTimeout(150);
      await page.keyboard.press('Space');
      await page.waitForTimeout(150);

      // At end of interactions, verify there were no page errors or console.error messages.
      // The afterEach hook will assert no errors; here we add an extra assertion as well.
      expect(errors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });
  });
});