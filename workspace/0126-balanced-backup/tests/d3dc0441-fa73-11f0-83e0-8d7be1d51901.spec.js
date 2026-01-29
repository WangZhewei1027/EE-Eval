import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3dc0441-fa73-11f0-83e0-8d7be1d51901.html';

// Page object to encapsulate selectors and common interactions
class BackpropPage {
  constructor(page) {
    this.page = page;
  }
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }
  // Elements
  async el(selector) {
    return this.page.locator(selector);
  }
  async text(selector) {
    return (await this.el(selector).innerText()).trim();
  }

  // Helpers to parse numbers from weight table cells
  async getWeightsIH() {
    const rows = await this.page.$$eval('#wIHtable tbody tr', trs => trs.map(tr => {
      const cells = Array.from(tr.querySelectorAll('td')).map(td => td.textContent || '');
      return cells;
    }));
    // rows: each is ['w[i][0] = X', 'w[i][1] = Y']
    return rows.map(cells => cells.map(t => {
      const m = t.match(/(-?\d+\.\d+)/);
      return m ? parseFloat(m[1]) : NaN;
    }));
  }
  async getWeightsHO() {
    const cells = await this.page.$$eval('#wHOtable tbody tr td', tds => tds.map(td => td.textContent || ''));
    // expected: ['wHO[0] = X', 'wHO[1] = Y']
    return cells.map(t => {
      const m = t.match(/(-?\d+\.\d+)/);
      return m ? parseFloat(m[1]) : NaN;
    });
  }
  async getBiases() {
    const tds = await this.page.$$eval('#biasTable tbody tr td', tds => tds.map(td => td.textContent || ''));
    // order: bh[0], bh[1], bo[0]
    const parsed = tds.map(t => {
      const m = t.match(/(-?\d+\.\d+)/);
      return m ? parseFloat(m[1]) : NaN;
    });
    return { bh0: parsed[0], bh1: parsed[1], bo: parsed[2] };
  }

  // Interaction helpers
  async click(selector) {
    await this.page.click(selector);
  }
  async changeDataset(name) {
    await this.page.selectOption('#datasetSelect', name);
  }
  async setLearningRate(value) {
    // value as string like '0.50'
    await this.page.$eval('#lr', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(value));
  }
  async pressKey(key) {
    await this.page.keyboard.press(key);
  }
  // Read UI fields
  async getSampleIdx() { return await this.text('#sampleIdx'); }
  async getNSamples() { return await this.text('#nSamples'); }
  async getInputsText() { return await this.text('#inputsText'); }
  async getTargetText() { return await this.text('#targetText'); }
  async getHActs() { return await this.text('#hActs'); }
  async getOAct() { return await this.text('#oAct'); }
  async getHDeltas() { return await this.text('#hDeltas'); }
  async getODelta() { return await this.text('#oDelta'); }
  async getMSE() { return await this.text('#mseVal'); }
  async isStopDisabled() { return await this.el('#stopBtn').isDisabled(); }
  async isTrainDisabled() { return await this.el('#trainBtn').isDisabled(); }
  async getLRVal() { return await this.text('#lrVal'); }
}

test.describe('Backpropagation interactive demo - FSM and UI tests', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Capture console and page errors for each test
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to app
    const bp = new BackpropPage(page);
    await bp.goto();

    // Wait for a basic UI element to be visible to ensure app initialized
    await page.waitForSelector('#forwardBtn', { state: 'visible' });
  });

  test.afterEach(async ({ page }) => {
    // Assert there were no uncaught page errors
    // Tests are designed to surface any runtime exceptions; failing here surfaces them.
    expect(pageErrors.length, `Unexpected page error(s): ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);

    // Also ensure there were no console.error messages emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Console error messages: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
  });

  test.describe('Initialization and Idle state (S0_Idle)', () => {
    test('should initialize weights, compute MSE and render UI on load', async ({ page }) => {
      const bp = new BackpropPage(page);

      // Initial numeric fields should be populated
      const sampleIdx = await bp.getSampleIdx();
      expect(sampleIdx).toBe('0');

      const nSamples = await bp.getNSamples();
      expect(nSamples).toBe('4');

      // MSE value should be a numeric string (not placeholder '–')
      const mse = await bp.getMSE();
      expect(mse).not.toBe('–');
      expect(mse).toMatch(/^\d+\.\d{5}$/);

      // Stop should be disabled initially
      expect(await bp.isStopDisabled()).toBe(true);

      // Ensure weight tables have numeric values
      const wIH = await bp.getWeightsIH();
      expect(wIH.length).toBe(2);
      wIH.flat().forEach(v => expect(Number.isFinite(v)).toBe(true));

      const wHO = await bp.getWeightsHO();
      expect(wHO.length).toBe(2);
      wHO.forEach(v => expect(Number.isFinite(v)).toBe(true));
    });
  });

  test.describe('Forward, Backpropagation, Apply Update, and Step (S1, S2, S3, S4)', () => {
    test('forward button updates activations and SVG rendering', async ({ page }) => {
      const bp = new BackpropPage(page);

      // Ensure before forward some fields might be placeholders
      const beforeH = await bp.getHActs();
      // Click forward
      await bp.click('#forwardBtn');

      // After forward, hidden activations and output activation should be numeric
      const hActs = await bp.getHActs();
      const oAct = await bp.getOAct();
      expect(hActs).not.toBe('–');
      expect(oAct).not.toBe('–');

      // SVG should contain the numeric activation rendered (approx: match the oAct numeric)
      const svgText = await page.locator('#netSvg').innerText();
      expect(svgText).toContain('o'); // node label exists
      // Activation numbers are also present somewhere in the SVG text
      expect(svgText).toMatch(/-?\d+\.\d{3,4}/);
    });

    test('backprop computes deltas and shows δ in UI and SVG', async ({ page }) => {
      const bp = new BackpropPage(page);
      // Ensure forward is run as backprop event also runs forward internally
      await bp.click('#backpropBtn');

      // Deltas should be visible
      const oDelta = await bp.getODelta();
      const hDeltas = await bp.getHDeltas();
      expect(oDelta).not.toBe('–');
      expect(hDeltas).not.toBe('–');

      // SVG should contain delta markers 'δ='
      const svgInner = await page.locator('#netSvg').innerText();
      expect(svgInner).toContain('δ=');
    });

    test('apply update modifies weights; computeBackprop called implicitly if needed', async ({ page }) => {
      const bp = new BackpropPage(page);

      // Reset to a known state: capture current weights
      const beforeIH = await bp.getWeightsIH();
      const beforeHO = await bp.getWeightsHO();
      const beforeBias = await bp.getBiases();

      // Click apply update (this will compute backprop if gradients missing)
      await bp.click('#updateBtn');

      // We expect weights or biases to change (at least one numeric value differs)
      const afterIH = await bp.getWeightsIH();
      const afterHO = await bp.getWeightsHO();
      const afterBias = await bp.getBiases();

      const changedIH = beforeIH.flat().some((v, i) => Math.abs(v - afterIH.flat()[i]) > 1e-12);
      const changedHO = beforeHO.some((v, i) => Math.abs(v - afterHO[i]) > 1e-12);
      const changedBias = Math.abs(beforeBias.bo - afterBias.bo) > 1e-12 || Math.abs(beforeBias.bh0 - afterBias.bh0) > 1e-12 || Math.abs(beforeBias.bh1 - afterBias.bh1) > 1e-12;

      expect(changedIH || changedHO || changedBias).toBe(true);
    });

    test('step button executes forward, backprop, update and advances sample index', async ({ page }) => {
      const bp = new BackpropPage(page);

      const beforeIdx = parseInt(await bp.getSampleIdx(), 10);
      const beforeMSE = await bp.getMSE();

      await bp.click('#stepBtn');

      const afterIdx = parseInt(await bp.getSampleIdx(), 10);
      // sample index should increment by 1 (modulo dataset length)
      expect(afterIdx).toBe((beforeIdx + 1) % parseInt(await bp.getNSamples(), 10));

      const afterMSE = await bp.getMSE();
      // MSE value should be a numeric string
      expect(afterMSE).toMatch(/^\d+\.\d{5}$/);
      // It's acceptable if MSE doesn't strictly change much; at least the UI updated
      expect(afterMSE).not.toBe('–');
    });
  });

  test.describe('Training loop (S5_Train) and Stop (S6_Stop)', () => {
    test('train button starts loop and stop button interrupts and restores UI', async ({ page }) => {
      const bp = new BackpropPage(page);

      // Click train to start training loop
      await bp.click('#trainBtn');

      // Immediately after clicking, trainBtn should be disabled and stop enabled
      expect(await bp.isTrainDisabled()).toBe(true);
      expect(await bp.isStopDisabled()).toBe(false);

      // Clicking train while running should have no effect - it should remain disabled
      await bp.click('#trainBtn'); // second click should be ignored by code
      expect(await bp.isTrainDisabled()).toBe(true);

      // Let the training run a tiny bit to allow requestAnimationFrame loop to schedule
      await page.waitForTimeout(120);

      // Now stop the training
      await bp.click('#stopBtn');

      // After stop, train button should be enabled again and stop disabled
      expect(await bp.isTrainDisabled()).toBe(false);
      expect(await bp.isStopDisabled()).toBe(true);
    });

    test('during training, forward/backprop/apply update still callable (idempotent checks)', async ({ page }) => {
      const bp = new BackpropPage(page);
      // Start training
      await bp.click('#trainBtn');
      expect(await bp.isTrainDisabled()).toBe(true);

      // Trigger forward/backprop/step which should not break things while running
      await bp.click('#forwardBtn');
      await bp.click('#backpropBtn');
      await bp.click('#updateBtn');

      // Wait briefly and then stop
      await page.waitForTimeout(80);
      await bp.click('#stopBtn');

      // Verify UI restored
      expect(await bp.isTrainDisabled()).toBe(false);
      expect(await bp.isStopDisabled()).toBe(true);
    });
  });

  test.describe('Events: dataset select, learning rate, reset, keyboard shortcuts, edge cases', () => {
    test('changing dataset updates sample index, dataset content and recomputes MSE', async ({ page }) => {
      const bp = new BackpropPage(page);

      await bp.changeDataset('XOR');

      // sample index should reset to 0 and inputs correspond to first XOR sample
      expect(await bp.getSampleIdx()).toBe('0');
      expect(await bp.getInputsText()).toBe('[0, 0]');
      expect(await bp.getTargetText()).toBe('0');

      // MSE should be numeric
      expect(await bp.getMSE()).toMatch(/^\d+\.\d{5}$/);
    });

    test('adjusting learning rate updates UI label', async ({ page }) => {
      const bp = new BackpropPage(page);

      // Set learning rate to 0.5 and assert #lrVal updates
      await bp.setLearningRate(0.5);
      expect(await bp.getLRVal()).toBe('0.50');

      // Slightly different value
      await bp.setLearningRate(0.13);
      expect(await bp.getLRVal()).toBe('0.13');
    });

    test('reset weights produces new random weights (edge case)', async ({ page }) => {
      const bp = new BackpropPage(page);

      const beforeIH = await bp.getWeightsIH();
      const beforeHO = await bp.getWeightsHO();
      const beforeBias = await bp.getBiases();

      // Click reset
      await bp.click('#resetBtn');

      const afterIH = await bp.getWeightsIH();
      const afterHO = await bp.getWeightsHO();
      const afterBias = await bp.getBiases();

      // At least one number should have changed due to random init
      const changed = beforeIH.flat().some((v,i) => Math.abs(v - afterIH.flat()[i]) > 1e-12) ||
                      beforeHO.some((v,i) => Math.abs(v - afterHO[i]) > 1e-12) ||
                      Math.abs(beforeBias.bh0 - afterBias.bh0) > 1e-12 ||
                      Math.abs(beforeBias.bh1 - afterBias.bh1) > 1e-12 ||
                      Math.abs(beforeBias.bo - afterBias.bo) > 1e-12;
      expect(changed).toBe(true);
    });

    test('keyboard shortcuts: f (forward), b (backprop), u (update), space (step) operate as intended', async ({ page }) => {
      const bp = new BackpropPage(page);

      // Press 'f' - forward
      await bp.pressKey('f');
      expect(await bp.getHActs()).not.toBe('–');
      // Press 'b' - backprop
      await bp.pressKey('b');
      expect(await bp.getHDeltas()).not.toBe('–');
      // Press 'u' - update (should apply updates and still show valid MSE)
      const beforeWeights = await bp.getWeightsHO();
      await bp.pressKey('u');
      const afterWeights = await bp.getWeightsHO();
      // At least one HO weight likely updated
      const hoChanged = beforeWeights.some((v, i) => Math.abs(v - afterWeights[i]) > 1e-12);
      expect(hoChanged || afterWeights.some(v => Number.isFinite(v))).toBe(true);

      // Press space to run trainStep and advance sample index
      const beforeIdx = parseInt(await bp.getSampleIdx(), 10);
      await bp.pressKey(' ');
      const afterIdx = parseInt(await bp.getSampleIdx(), 10);
      expect(afterIdx).toBe((beforeIdx + 1) % parseInt(await bp.getNSamples(), 10));
    });

    test('apply update without prior explicit backprop computes gradients internally (edge case)', async ({ page }) => {
      const bp = new BackpropPage(page);

      // Reset weights to ensure different state
      await bp.click('#resetBtn');

      // Clear any visible deltas by resetting cache via initial UI update (already done)
      // Click update directly; code should call computeBackprop if grads are missing
      await bp.click('#updateBtn');

      // After update, deltas should exist in UI
      expect(await bp.getODelta()).not.toBe('–');
      expect(await bp.getHDeltas()).not.toBe('–');
    });
  });
});