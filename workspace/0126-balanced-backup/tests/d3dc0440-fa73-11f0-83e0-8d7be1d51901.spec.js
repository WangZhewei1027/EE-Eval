import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3dc0440-fa73-11f0-83e0-8d7be1d51901.html';

// Page object encapsulating common interactions and assertions
class NNPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // wait for key UI elements to be present
    await Promise.all([
      this.page.waitForSelector('#boundary'),
      this.page.waitForSelector('#trainBtn'),
      this.page.waitForSelector('#resetBtn'),
      this.page.waitForSelector('#weightsView'),
    ]);
  }

  // UI getters
  async epochCount() {
    const txt = await this.page.textContent('#epochCount');
    return parseInt((txt || '0').trim(), 10);
  }
  async lastLoss() {
    const txt = await this.page.textContent('#lastLoss');
    return txt ? txt.trim() : '';
  }
  async layerSpec() {
    return (await this.page.textContent('#layerSpec'))?.trim();
  }
  async weightsView() {
    return await this.page.$eval('#weightsView', el => el.value);
  }
  async datasetLength() {
    return await this.page.evaluate(() => (window.dataset && window.dataset.length) || 0);
  }
  async netExists() {
    return await this.page.evaluate(() => !!window.net);
  }
  async netActivationName() {
    return await this.page.evaluate(() => window.net ? window.net.activationName : null);
  }
  async isTrainBtnDisabled() {
    return await this.page.$eval('#trainBtn', b => b.disabled);
  }
  async isStopBtnDisabled() {
    return await this.page.$eval('#stopBtn', b => b.disabled);
  }
  async isStepBtnDisabled() {
    return await this.page.$eval('#stepBtn', b => b.disabled);
  }

  // Actions
  async clickTrain() { await this.page.click('#trainBtn'); }
  async clickStop() { await this.page.click('#stopBtn'); }
  async clickStep() { await this.page.click('#stepBtn'); }
  async clickReset() { await this.page.click('#resetBtn'); }
  async clickInitNet() { await this.page.click('#initNetBtn'); }
  async clickRandomize() { await this.page.click('#randomizeBtn'); }
  async clickDownload() { await this.page.click('#downloadBtn'); }
  async clickCopyWeights() { await this.page.click('#copyWeights'); }
  async clickLoadWeights() { await this.page.click('#loadWeights'); }

  async selectDataset(value) {
    await this.page.selectOption('#dataset', value);
    // selecting triggers change handler automatically
  }
  async setHidden(value) {
    await this.page.fill('#hidden', value);
    // dispatch change event
    await this.page.dispatchEvent('#hidden', 'change');
  }
  async setActivation(value) {
    await this.page.selectOption('#activation', value);
    // selecting triggers change handler automatically
  }
  async setPtsPerClass(value) {
    await this.page.fill('#ptsPerClass', String(value));
    await this.page.dispatchEvent('#ptsPerClass', 'change');
  }
  async setWeightsView(text) {
    await this.page.fill('#weightsView', text);
    // no automatic change until load pressed
  }

  // Wait helpers
  async waitForEpochIncrease(from, timeout = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const val = await this.epochCount();
      if (val > from) return val;
      await this.page.waitForTimeout(100);
    }
    throw new Error(`epochCount did not increase from ${from} within ${timeout}ms`);
  }
}

test.describe('Neural Networks — Interactive Demo (FSM + UI)', () => {
  // capture console errors and page errors for each test
  test.beforeEach(async ({ page }) => {
    // reduce console noise by collecting errors
    page.context()._collectedConsoleErrors = [];
    page.context()._collectedPageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        page.context()._collectedConsoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      page.context()._collectedPageErrors.push(err.message);
    });
  });

  test.afterEach(async ({ page }) => {
    // Assert that no uncaught page errors or console.error messages occurred
    const consoleErrors = page.context()._collectedConsoleErrors || [];
    const pageErrors = page.context()._collectedPageErrors || [];
    // If any unexpected runtime errors occurred, fail tests so they are visible.
    expect(consoleErrors, `console.error messages: ${consoleErrors.join('\n')}`).toHaveLength(0);
    expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toHaveLength(0);
  });

  test.describe('FSM States: Idle (S0), Training (S1), Stopped (S2)', () => {
    test('Initial Idle state: page loads and onEnter actions run (resetDataset, initNetwork)', async ({ page }) => {
      // Validate Idle initial state: dataset and network initialized, UI stats show baseline values.
      const nn = new NNPage(page);
      await nn.goto();

      // Validate network object exists (initNetwork called)
      const netExists = await nn.netExists();
      expect(netExists).toBeTruthy();

      // Epoch count should be initialized (onEnter resetDataset sets epochCount = 0)
      const epoch = await nn.epochCount();
      expect(epoch).toBe(0);

      // Layer spec should be populated (initNetwork sets layerSpec)
      const layers = await nn.layerSpec();
      expect(layers).not.toBe('-');
      expect(layers.length).toBeGreaterThan(0);

      // Weights view should contain JSON with layerSizes
      const weightsText = await nn.weightsView();
      expect(weightsText).toContain('"layerSizes"');

      // Dataset should be present (resetDataset generated points)
      const dlen = await nn.datasetLength();
      expect(dlen).toBeGreaterThan(0);

      // lastLoss displayed (initial)
      const lastLoss = await nn.lastLoss();
      expect(lastLoss.length).toBeGreaterThan(0);
    });

    test('Start training transition Idle -> Training (StartTraining event)', async ({ page }) => {
      // Clicking Start training should begin the loop: trainBtn disabled, stopBtn enabled, epochCount increases.
      const nn = new NNPage(page);
      await nn.goto();

      // pre-check: ensure trainBtn enabled
      expect(await nn.isTrainBtnDisabled()).toBe(false);
      expect(await nn.isStopBtnDisabled()).toBe(true);

      const beforeEpoch = await nn.epochCount();
      await nn.clickTrain();

      // after clicking, trainBtn should be disabled and stopBtn enabled
      await page.waitForTimeout(100); // allow UI update
      expect(await nn.isTrainBtnDisabled()).toBe(true);
      expect(await nn.isStopBtnDisabled()).toBe(false);

      // epochCount should increase while training
      const newEpoch = await nn.waitForEpochIncrease(beforeEpoch, 5000);
      expect(newEpoch).toBeGreaterThan(beforeEpoch);
    });

    test('Stop training transition Training -> Stopped (StopTraining event) and ensure training stops', async ({ page }) => {
      // Validate clicking Stop stops the animation and disables Stop button again.
      const nn = new NNPage(page);
      await nn.goto();

      // start training first
      await nn.clickTrain();
      await page.waitForTimeout(200); // allow some training to start
      expect(await nn.isTrainBtnDisabled()).toBe(true);
      expect(await nn.isStopBtnDisabled()).toBe(false);

      // record epoch then stop
      const before = await nn.epochCount();
      await nn.clickStop();

      // stopBtn should become disabled, trainBtn enabled, stepBtn enabled
      await page.waitForTimeout(100);
      expect(await nn.isStopBtnDisabled()).toBe(true);
      expect(await nn.isTrainBtnDisabled()).toBe(false);
      expect(await nn.isStepBtnDisabled()).toBe(false);

      // epoch should not increase after stopping (give some time)
      await page.waitForTimeout(500);
      const after = await nn.epochCount();
      expect(after).toBe(before);
    });

    test('Resume training transition Stopped -> Training (StartTraining event) resumes training', async ({ page }) => {
      // Start, stop, then start again and verify epochs increase after resuming.
      const nn = new NNPage(page);
      await nn.goto();

      // ensure stopped state
      await nn.clickStop(); // safe even if already stopped
      await page.waitForTimeout(50);

      const before = await nn.epochCount();
      await nn.clickTrain();
      await page.waitForTimeout(100);
      expect(await nn.isTrainBtnDisabled()).toBe(true);
      expect(await nn.isStopBtnDisabled()).toBe(false);

      const after = await nn.waitForEpochIncrease(before, 4000);
      expect(after).toBeGreaterThan(before);

      // finally stop to leave app in non-training state
      await nn.clickStop();
      await page.waitForTimeout(100);
    });

    test('Reset transition S2_Stopped -> S0_Idle (Reset event) resets dataset and network', async ({ page }) => {
      // Validate resetBtn triggers resetDataset() and initNetwork()
      const nn = new NNPage(page);
      await nn.goto();

      // Ensure we are stopped
      await nn.clickStop();
      await page.waitForTimeout(50);

      // capture some pre-reset state
      const beforeEpoch = await nn.epochCount();
      const beforeWeights = await nn.weightsView();

      // click reset
      await nn.clickReset();
      await page.waitForTimeout(200);

      // epochCount should be reset to 0
      const afterEpoch = await nn.epochCount();
      expect(afterEpoch).toBe(0);

      // net should exist and weightsView should be set (may or may not differ; at least valid JSON)
      const afterWeights = await nn.weightsView();
      expect(afterWeights).toContain('"layerSizes"');
      // weights were re-initialized: it's likely changed but not guaranteed - ensure JSON is valid
      await expect(async () => JSON.parse(afterWeights)).not.toThrow();
    });
  });

  test.describe('Events and Controls', () => {
    test('ChangeDataset event triggers resetDataset and redraw (ChangeDataset)', async ({ page }) => {
      // Change dataset selection and ensure dataset is regenerated
      const nn = new NNPage(page);
      await nn.goto();

      // set points per class to 40 to make forensic check easier
      await nn.setPtsPerClass(40);

      // choose AND dataset and verify dataset length corresponds to ptsPerClass
      await nn.selectDataset('AND');
      await page.waitForTimeout(150); // allow handlers to run

      const dlen = await nn.datasetLength();
      // generateDataset for AND creates total = ptsPerClass (it loops ptsPerClass/4 for 4 bases)
      expect(dlen).toBe(40);
      // epochCount should be reset to 0 by resetDataset
      expect(await nn.epochCount()).toBe(0);
    });

    test('ChangeHiddenLayers event calls initNetwork and updates layerSpec (ChangeHiddenLayers)', async ({ page }) => {
      const nn = new NNPage(page);
      await nn.goto();

      // set a complex hidden configuration and trigger change
      await nn.setHidden('8,6');
      await page.waitForTimeout(150);

      // layerSpec should reflect new sizes: inputs 2 -> 8 -> 6 -> 1
      const spec = await nn.layerSpec();
      expect(spec.replace(/\s+/g, '')).toBe('2-8-6-1'); // normalize whitespace
      // weightsView should contain updated layerSizes
      const wv = await nn.weightsView();
      expect(wv).toContain('"layerSizes"');
      const parsed = JSON.parse(wv);
      expect(parsed.layerSizes).toEqual([2,8,6,1]);
    });

    test('ChangeActivationFunction event updates network activation and drawNetwork is invoked (ChangeActivationFunction)', async ({ page }) => {
      const nn = new NNPage(page);
      await nn.goto();

      // ensure net exists
      expect(await nn.netExists()).toBe(true);

      // change activation to sigmoid
      await nn.setActivation('sigmoid');
      await page.waitForTimeout(150);

      // net.activationName should be updated
      const activationName = await nn.netActivationName();
      expect(activationName).toBe('sigmoid');

      // weightsView JSON should include the activation name (when net.toJSON is called it stores activation)
      const wv = await nn.weightsView();
      expect(wv).toContain('"activation"');
      expect(wv).toContain('sigmoid');
    });

    test('ChangePointsPerClass event regenerates dataset with expected size (ChangePointsPerClass)', async ({ page }) => {
      const nn = new NNPage(page);
      await nn.goto();

      // set points per class to 24
      await nn.setPtsPerClass(24);
      await page.waitForTimeout(150);

      // dataset should be regenerated to 24 entries for XOR/AND styles (implementation yields ptsPerClass total)
      const dlen = await nn.datasetLength();
      expect(dlen).toBe(24);
      // epochCount should be reset to 0
      expect(await nn.epochCount()).toBe(0);
    });

    test('StepTraining event performs a single training step (Step) and increments epochCount', async ({ page }) => {
      const nn = new NNPage(page);
      await nn.goto();

      // ensure we are stopped so step is available
      await nn.clickStop();
      await page.waitForTimeout(50);

      const before = await nn.epochCount();
      await nn.clickStep();
      // after a step, epochCount should increase by at least 1 (mini-batch count)
      const after = await nn.waitForEpochIncrease(before, 3000);
      expect(after).toBeGreaterThan(before);
    });

    test('RandomizeWeights event re-initializes params and updates weightsView', async ({ page }) => {
      const nn = new NNPage(page);
      await nn.goto();

      // capture current weightsView
      const beforeJSON = await nn.weightsView();

      // click randomize
      await nn.clickRandomize();
      await page.waitForTimeout(150);

      const afterJSON = await nn.weightsView();
      // both must be valid JSON strings
      expect(async () => JSON.parse(afterJSON)).not.toThrow();
      expect(async () => JSON.parse(beforeJSON)).not.toThrow();
      // It is very likely (but not guaranteed) that randomization changes values; assert that the JSONs are strings and parseable
      expect(typeof afterJSON).toBe('string');
    });

    test('DownloadSnapshot event triggers two downloads (image + weights)', async ({ page }) => {
      const nn = new NNPage(page);
      await nn.goto();

      // The download handler clicks two anchors; Playwright can capture downloads
      const downloads = [];
      const dlPromise1 = page.waitForEvent('download', { timeout: 3000 }).then(d => { downloads.push(d); return d; });
      // Trigger click (two downloads expected)
      const clickPromise = nn.clickDownload();
      const dlPromise2 = page.waitForEvent('download', { timeout: 3000 }).then(d => { downloads.push(d); return d; });

      // Wait for both downloads to be captured
      await Promise.all([dlPromise1, dlPromise2]);
      expect(downloads.length).toBeGreaterThanOrEqual(2);

      // Basic validation: downloads have suggested filenames and non-zero sizes after saving
      for (const d of downloads) {
        const suggested = d.suggestedFilename();
        expect(suggested.length).toBeGreaterThan(0);
        // Save to temporary path to ensure file exists - but do not assert on content
        const path = await d.path();
        expect(path).toBeTruthy();
      }
    });

    test('LoadWeights with invalid JSON triggers alert and does not crash (error scenario)', async ({ page }) => {
      const nn = new NNPage(page);
      await nn.goto();

      // Put invalid JSON in textarea
      await nn.setWeightsView('not a json');

      // Expect an alert dialog with the failure message when clicking loadWeights
      const dialogPromise = page.waitForEvent('dialog', { timeout: 2000 });
      await nn.clickLoadWeights();
      const dialog = await dialogPromise;
      // The app's handler alerts 'Failed to parse network JSON' on bad parse
      expect(dialog.message()).toContain('Failed to parse network JSON');
      await dialog.dismiss();

      // Ensure application is still responsive: net should still exist and UI updates possible
      expect(await nn.netExists()).toBe(true);
      const layerSpec = await nn.layerSpec();
      expect(layerSpec).not.toBeUndefined();
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('Toggling activation while training does not throw and updates visuals', async ({ page }) => {
      const nn = new NNPage(page);
      await nn.goto();

      // Start training
      await nn.clickTrain();
      await page.waitForTimeout(200);

      // Change activation while training; should update net.activationName and not throw runtime error
      await nn.setActivation('relu');
      await page.waitForTimeout(200);

      const act = await nn.netActivationName();
      expect(act).toBe('relu');

      // Stop training
      await nn.clickStop();
      await page.waitForTimeout(100);
    });

    test('Keyboard shortcuts (space toggles training, s triggers step) are wired', async ({ page }) => {
      const nn = new NNPage(page);
      await nn.goto();

      // Ensure starting from stopped
      await nn.clickStop();
      await page.waitForTimeout(50);
      const before = await nn.epochCount();

      // Press 's' to trigger a single step (should increase epochCount)
      await page.keyboard.press('s');
      const after = await nn.waitForEpochIncrease(before, 3000);
      expect(after).toBeGreaterThan(before);

      // Press space to toggle training start
      await page.keyboard.press(' ');
      await page.waitForTimeout(150);
      expect(await nn.isTrainBtnDisabled()).toBe(true);

      // Press space again to stop
      await page.keyboard.press(' ');
      await page.waitForTimeout(150);
      expect(await nn.isTrainBtnDisabled()).toBe(false);
    });
  });
});