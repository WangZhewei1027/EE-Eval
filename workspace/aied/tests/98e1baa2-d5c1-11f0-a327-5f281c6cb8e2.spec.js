import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e1baa2-d5c1-11f0-a327-5f281c6cb8e2.html';

// Page object encapsulating interactions and queries for the Selection Sort Visualizer
class SelectionSortPage {
  constructor(page) {
    this.page = page;
    this.playBtn = page.locator('#playBtn');
    this.pauseBtn = page.locator('#pauseBtn');
    this.stepBtn = page.locator('#stepBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.sizeRange = page.locator('#sizeRange');
    this.sizeLabel = page.locator('#sizeLabel');
    this.speedRange = page.locator('#speedRange');
    this.speedLabel = page.locator('#speedLabel');
    this.orderToggle = page.locator('#orderToggle');
    this.randomInputBtn = page.locator('#randomInputBtn');
    this.bars = page.locator('#bars > .bar');
    this.stepCount = page.locator('#stepCount');
    this.compCount = page.locator('#compCount');
    this.swapCount = page.locator('#swapCount');
    this.idxI = page.locator('#idxI');
    this.idxJ = page.locator('#idxJ');
    this.idxMin = page.locator('#idxMin');
    this.pseudocode = page.locator('#pseudocode');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait for initial bars to render
    await this.page.waitForSelector('#bars > .bar');
  }

  async clickPlay() {
    await this.playBtn.click();
  }

  async clickPause() {
    await this.pauseBtn.click();
  }

  async clickStep() {
    await this.stepBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async setSize(value) {
    // set value and fire input event
    await this.page.$eval('#sizeRange', (el, v) => {
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
  }

  async changeSize(value) {
    // set value and fire change event (this triggers generateArray)
    await this.page.$eval('#sizeRange', (el, v) => {
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, String(value));
    // wait for bars to re-render
    await this.page.waitForTimeout(50);
  }

  async setSpeed(value) {
    await this.page.$eval('#speedRange', (el, v) => {
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
  }

  async toggleOrder() {
    await this.orderToggle.click();
  }

  async triggerCustomInput(promptValue) {
    // prepare to handle the prompt dialog by accepting with promptValue
    this.page.once('dialog', async dialog => {
      await dialog.accept(promptValue);
    });
    await this.randomInputBtn.click();
    // wait a little for processing render
    await this.page.waitForTimeout(50);
  }

  async triggerCustomInputExpectAlert(promptValue) {
    // Accept prompt but expect an alert afterwards
    const alertPromise = this.page.waitForEvent('dialog');
    this.page.once('dialog', async dialog => {
      // first dialog is prompt
      await dialog.accept(promptValue);
    });
    // click triggers prompt; then code may show alert
    await this.randomInputBtn.click();
    const alertDialog = await alertPromise;
    // return alert dialog message then accept it
    const msg = alertDialog.message();
    await alertDialog.accept();
    // wait a little for UI
    await this.page.waitForTimeout(50);
    return msg;
  }

  async getBarsCount() {
    return await this.bars.count();
  }

  async getBarValues() {
    // returns array of visible numeric values (only present when <=40)
    return await this.page.$$eval('#bars > .bar .val', els => els.map(e => e.textContent.trim()));
  }

  async getStepCount() {
    return Number((await this.stepCount.textContent()).trim());
  }

  async getCompCount() {
    return Number((await this.compCount.textContent()).trim());
  }

  async getSwapCount() {
    return Number((await this.swapCount.textContent()).trim());
  }

  async isPlayDisabled() {
    return await this.playBtn.evaluate(el => el.disabled);
  }

  async getSizeLabel() {
    return (await this.sizeLabel.textContent()).trim();
  }

  async getSpeedLabel() {
    return (await this.speedLabel.textContent()).trim();
  }

  async getIdxValues() {
    const i = (await this.idxI.textContent()).trim();
    const j = (await this.idxJ.textContent()).trim();
    const min = (await this.idxMin.textContent()).trim();
    return { i, j, min };
  }

  async getActivePseudocodeLine() {
    // returns data-line attribute of active code-line or null
    return await this.page.$eval('#pseudocode', pseudo => {
      const el = pseudo.querySelector('.code-line.active');
      return el ? el.getAttribute('data-line') : null;
    });
  }
}

// Global test group
test.describe('Selection Sort Visualizer - FSM and UI integration tests', () => {
  // collect page errors and console errors for each test and assert zero at the end
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];
    page.on('pageerror', err => {
      // capture runtime errors
      pageErrors.push(err.message || String(err));
    });
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test.afterEach(async () => {
    // Assert no uncaught page errors happened during the test execution.
    // The application is expected to run without throwing uncaught exceptions.
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Initial Idle state: renders bars and stats according to default size', async ({ page }) => {
    // Validate initial render (S0_Idle entry actions: renderBars(), generateArray(...))
    const app = new SelectionSortPage(page);
    await app.goto();

    // sizeLabel should match default value attribute (30)
    expect(await app.getSizeLabel()).toBe('30');

    // bars should be rendered equal to sizeRange value
    const count = await app.getBarsCount();
    expect(count).toBe(30);

    // initial stats should be zero
    expect(await app.getStepCount()).toBe(0);
    expect(await app.getCompCount()).toBe(0);
    expect(await app.getSwapCount()).toBe(0);

    // Play button should be enabled in idle
    expect(await app.isPlayDisabled()).toBe(false);
  });

  test('Play starts animation (S0 -> S1), Play disabled and steps advance; Pause resumes S1 -> S2', async ({ page }) => {
    // Validate Play starts the animation and Play button gets disabled; Pause stops it and re-enables Play
    const app = new SelectionSortPage(page);
    await app.goto();

    // speed down to make animation faster
    await app.setSpeed(50);
    expect(await app.getSpeedLabel()).toBe('50 ms');

    // click Play - transition S0_Idle -> S1_Running
    await app.clickPlay();

    // Play button should be disabled immediately
    expect(await app.isPlayDisabled()).toBe(true);

    // Wait until at least one step is processed (stepCount increases)
    await page.waitForFunction(() => Number(document.getElementById('stepCount').textContent) > 0, null, { timeout: 2000 });

    // click Pause - transition S1_Running -> S2_Paused
    await app.clickPause();

    // after pausing, Play should be enabled
    expect(await app.isPlayDisabled()).toBe(false);

    // record step count and ensure it does not increase for a short duration
    const stepsAfterPause = await app.getStepCount();
    await page.waitForTimeout(200);
    const stepsLater = await app.getStepCount();
    expect(stepsLater).toBe(stepsAfterPause);
  });

  test('Pause -> Play (S2 -> S1) resumes animation', async ({ page }) => {
    // Validate that after pausing, clicking Play resumes animation (stepCounter increments)
    const app = new SelectionSortPage(page);
    await app.goto();

    // start, then pause
    await app.setSpeed(80);
    await app.clickPlay();
    await page.waitForTimeout(150); // let a few ticks possibly happen
    await app.clickPause();

    const before = await app.getStepCount();
    // resume
    await app.clickPlay();
    expect(await app.isPlayDisabled()).toBe(true);

    // wait for step count to increase
    await page.waitForFunction((b) => Number(document.getElementById('stepCount').textContent) > b, before, { timeout: 2000 });
    const after = await app.getStepCount();
    expect(after).toBeGreaterThan(before);
  });

  test('Step executes a single generator action (S3_Stepping) and updates UI indices and pseudocode highlight', async ({ page }) => {
    // Validate that Step advances one generator action and updates indices/pseudocode/stepCount
    const app = new SelectionSortPage(page);
    await app.goto();

    const before = await app.getStepCount();
    await app.clickStep();

    // step count should increase by at least 1
    await page.waitForFunction((b) => Number(document.getElementById('stepCount').textContent) > b, before, { timeout: 1000 });
    const after = await app.getStepCount();
    expect(after).toBeGreaterThan(before);

    // indices should reflect some values (i may be set or '-'); at least step action highlights a pseudocode line
    const activeLine = await app.getActivePseudocodeLine();
    expect(activeLine).not.toBeNull();
    // Ensure idx labels are present
    const idxs = await app.getIdxValues();
    expect(idxs.i).toBeTruthy();
    expect(idxs.j).toBeTruthy();
    expect(idxs.min).toBeTruthy();
  });

  test('Shuffle (Reset) regenerates array and resets state (S1 -> S4 or S0 -> S4)', async ({ page }) => {
    // Validate clicking Shuffle generates a new array and resets counters (resetState)
    const app = new SelectionSortPage(page);
    await app.goto();

    // start the animation briefly to exercise running -> shuffled transition
    await app.setSpeed(40);
    await app.clickPlay();
    await page.waitForTimeout(120);
    // Now click Shuffle
    await app.clickReset();

    // After reset, stepCount and other stats should be reset to zero
    expect(await app.getStepCount()).toBe(0);
    expect(await app.getCompCount()).toBe(0);
    expect(await app.getSwapCount()).toBe(0);

    // Play button should be enabled after reset
    expect(await app.isPlayDisabled()).toBe(false);

    // bars should match current sizeRange value
    const size = Number(await app.getSizeLabel());
    const barsCount = await app.getBarsCount();
    expect(barsCount).toBe(size);
  });

  test('Change Size updates label on input and regenerates array on change event', async ({ page }) => {
    // Validate ChangeSize event updates sizeLabel on input and generateArray on change
    const app = new SelectionSortPage(page);
    await app.goto();

    // set input to a smaller size via input event
    await app.setSize(10);
    expect(await app.getSizeLabel()).toBe('10');

    // now fire the change event which should regenerate the array
    await app.changeSize(10);
    const barsCount = await app.getBarsCount();
    expect(barsCount).toBe(10);

    // ensure stats reset
    expect(await app.getStepCount()).toBe(0);
  });

  test('Change Speed updates label and while running restarts the interval', async ({ page }) => {
    // Validate speed label reflects input and that changing speed while running continues the animation
    const app = new SelectionSortPage(page);
    await app.goto();

    // set speed to moderate and start
    await app.setSpeed(200);
    expect(await app.getSpeedLabel()).toBe('200 ms');

    await app.clickPlay();
    await page.waitForTimeout(150);
    const before = await app.getStepCount();

    // change speed while running to smaller value
    await app.setSpeed(60);
    expect(await app.getSpeedLabel()).toBe('60 ms');

    // wait for steps to increase after speed change
    await page.waitForFunction((b) => Number(document.getElementById('stepCount').textContent) > b, before, { timeout: 2000 });
    const after = await app.getStepCount();
    expect(after).toBeGreaterThan(before);

    // pause for cleanup
    await app.clickPause();
  });

  test('Toggle Order resets state and effects are visible (order toggle triggers resetState)', async ({ page }) => {
    // Validate toggling the order checkbox resets the state (calls resetState)
    const app = new SelectionSortPage(page);
    await app.goto();

    // Start and make some steps so stats are non-zero
    await app.setSpeed(60);
    await app.clickPlay();
    await page.waitForTimeout(150);
    await app.clickPause();
    const stepsBefore = await app.getStepCount();
    expect(stepsBefore).toBeGreaterThanOrEqual(1);

    // toggle order, which should reset state
    await app.toggleOrder();

    // stats should be reset to zero
    expect(await app.getStepCount()).toBe(0);
    expect(await app.getCompCount()).toBe(0);
    expect(await app.getSwapCount()).toBe(0);

    // Play should be enabled after reset
    expect(await app.isPlayDisabled()).toBe(false);
  });

  test('Custom Input: valid input sets array, updates size label and renders provided values (S0 -> S5)', async ({ page }) => {
    // Validate custom input flow: prompt is accepted and UI shows new array and updated size
    const app = new SelectionSortPage(page);
    await app.goto();

    // Provide a small custom list via prompt
    const input = '12,5,8';
    // Prepare dialog handler to accept prompt value
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('prompt');
      await dialog.accept(input);
    });

    await app.randomInputBtn.click();

    // Wait for bars to be re-rendered
    await page.waitForTimeout(60);

    // Size label should reflect new length
    expect(await app.getSizeLabel()).toBe('3');

    // Bar values should match provided numbers (visible since length <= 40)
    const values = await app.getBarValues();
    // values are strings; ensure they include our numbers in same order
    expect(values).toEqual(['12', '5', '8']);

    // stepCount should be reset
    expect(await app.getStepCount()).toBe(0);
  });

  test('Custom Input: invalid input shows alert and does not mutate array (edge case & error path)', async ({ page }) => {
    // Validate that invalid custom input triggers an alert and does not change the currently displayed array
    const app = new SelectionSortPage(page);
    await app.goto();

    // record current bars count
    const beforeCount = await app.getBarsCount();

    // Setup to accept prompt with invalid payload then capture subsequent alert dialog
    // First dialog is prompt, second may be alert('No valid numbers parsed.')
    // We need to setup a one-time handler for prompt and then wait for the alert event
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('prompt');
      await dialog.accept('a,b, ,'); // invalid values
    });

    // trigger prompt
    await app.randomInputBtn.click();

    // Wait for potential alert; the page code shows alert('No valid numbers parsed.') if parsing yields empty array
    let alertCaught = false;
    try {
      const dlg = await page.waitForEvent('dialog', { timeout: 500 });
      // this should be the alert
      expect(dlg.type()).toBe('alert');
      const msg = dlg.message();
      expect(msg).toContain('No valid numbers parsed');
      await dlg.accept();
      alertCaught = true;
    } catch (e) {
      // If no alert happens, test should still continue but flag that alert wasn't shown
      alertCaught = false;
    }

    // Ensure array not changed (bars count same)
    const afterCount = await app.getBarsCount();
    expect(afterCount).toBe(beforeCount);

    // At least one of the codepaths should have been taken; we assert that alert was shown to exercise the edge case.
    expect(alertCaught).toBe(true);
  });

  test('Keyboard shortcuts: Space toggles play/pause, ArrowRight steps, r resets', async ({ page }) => {
    // Validate keyboard interactions map to actions in the app
    const app = new SelectionSortPage(page);
    await app.goto();

    // Press Space to start (play)
    await page.keyboard.press('Space');
    // Play should be disabled
    await page.waitForTimeout(60);
    expect(await app.isPlayDisabled()).toBe(true);

    // Press Space to pause
    await page.keyboard.press('Space');
    await page.waitForTimeout(60);
    expect(await app.isPlayDisabled()).toBe(false);

    // Press ArrowRight to step once
    const before = await app.getStepCount();
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction((b) => Number(document.getElementById('stepCount').textContent) > b, before, { timeout: 1000 });
    const after = await app.getStepCount();
    expect(after).toBeGreaterThan(before);

    // Press 'r' to regenerate array - bars count should match sizeLabel
    await page.keyboard.press('r');
    await page.waitForTimeout(60);
    const size = Number(await app.getSizeLabel());
    const barsCount = await app.getBarsCount();
    expect(barsCount).toBe(size);
  });

});