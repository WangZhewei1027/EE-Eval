import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d6d420-fa73-11f0-83e0-8d7be1d51901.html';

// Page object for the Jump Search demo
class JumpSearchPage {
  constructor(page) {
    this.page = page;
    this.array = page.locator('#array');
    this.cells = () => this.array.locator('.cell');
    this.status = page.locator('#status');
    this.comp = page.locator('#comp');
    this.resIndex = page.locator('#resIndex');
    this.resValue = page.locator('#resValue');
    this.len = page.locator('#len');
    this.targetInput = page.locator('#target');
    this.generateBtn = page.locator('#generate');
    this.startBtn = page.locator('#start');
    this.stepBtn = page.locator('#step');
    this.pauseBtn = page.locator('#pause');
    this.resetBtn = page.locator('#reset');
    this.pickRandomBtn = page.locator('#pickRandom');
    this.jumpSlider = page.locator('#jump');
    this.sizeSlider = page.locator('#size');
    this.speedSlider = page.locator('#speed');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait for initial render: array should have children
    await expect(this.array).toBeVisible();
    await this.page.waitForFunction(() => document.querySelectorAll('#array .cell').length > 0);
  }

  async getStatusText() {
    return (await this.status.textContent())?.trim();
  }

  async getComparisons() {
    const t = (await this.comp.textContent())?.trim();
    return Number(t || 0);
  }

  async getRes() {
    return {
      index: (await this.resIndex.textContent())?.trim(),
      value: (await this.resValue.textContent())?.trim()
    };
  }

  async getArrayLength() {
    const t1 = (await this.len.textContent())?.trim();
    return Number(t || 0);
  }

  async getCellsText() {
    const count = await this.cells().count();
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push((await this.cells().nth(i).textContent())?.trim() || '');
    }
    return out;
  }

  async clickCell(index) {
    await this.cells().nth(index).click();
  }

  async clickGenerate() {
    await this.generateBtn.click();
    // wait for new render
    await this.page.waitForFunction(() => document.querySelectorAll('#array .cell').length > 0);
  }

  async clickStart() {
    await this.startBtn.click();
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

  async clickPickRandom() {
    await this.pickRandomBtn.click();
  }

  async setTargetValue(val) {
    await this.targetInput.fill(String(val));
    // blur to ensure it's applied
    await this.targetInput.evaluate((el) => el.blur());
  }

  async getTargetValue() {
    return (await this.targetInput.inputValue()).trim();
  }

  async setSpeed(ms) {
    await this.speedSlider.fill(String(ms));
    await this.speedSlider.evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('input')); }, String(ms));
  }

  // helper to wait until status matches a predicate
  async waitForStatus(predicate, timeout = 5000) {
    await this.page.waitForFunction(
      (sel, pred) => pred(document.querySelector(sel)?.textContent || ''),
      '#status',
      predicate,
      { timeout }
    );
  }
}

test.describe('Jump Search Interactive Demo - FSM and UI tests', () => {
  // Collect console errors and page errors to assert none occurred
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) {
        // ignore parsing console message errors
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // At the end of each test assert there were no runtime console errors or uncaught page errors.
    // The app is expected to run without uncaught exceptions; assert that here.
    expect(consoleErrors, 'No console.error events should have been emitted').toEqual([]);
    expect(pageErrors, 'No uncaught page errors should have been thrown').toEqual([]);
  });

  test('Initial state: Idle (S0_Idle) and entry actions performed', async ({ page }) => {
    // Validate initial Idle state: reset() should have been called on entry so comparisons=0, status 'Idle', results '-'
    const app = new JumpSearchPage(page);
    await app.goto();

    // confirm status is Idle
    await expect(app.status).toHaveText('Idle');

    // comparisons should be zero
    expect(await app.getComparisons()).toBe(0);

    // result placeholders should be '-'
    const res = await app.getRes();
    expect(res.index).toBe('-');
    expect(res.value).toBe('-');

    // array should be rendered and len should match number of cells
    const arrLen = await app.getArrayLength();
    const cellsText = await app.getCellsText();
    expect(cellsText.length).toBe(arrLen);
  });

  test('Generate Array event and autopick behavior (GenerateArray)', async ({ page }) => {
    // Clicking 'Generate Array' should produce a new array, reset comparisons, and if autopick checked set target
    const app1 = new JumpSearchPage(page);
    await app.goto();

    // click generate
    await app.clickGenerate();

    // after generation comparisons reset
    expect(await app.getComparisons()).toBe(0);

    // array length should update and target input should contain a value (autopick default checked)
    const newLen = await app.getArrayLength();
    expect(newLen).toBeGreaterThanOrEqual(10); // slider min is 10

    const targetVal = await app.getTargetValue();
    expect(targetVal.length).toBeGreaterThan(0);
    // ensure target is one of the array values
    const cells = await app.getCellsText();
    expect(cells).toContain(targetVal);
  });

  test('Start event: transitions to Running (S1_Running) and Pause event transitions to Paused (S2_Paused)', async ({ page }) => {
    // Validate Start -> Running and Pause -> Paused transition and entry/exit actions
    const app2 = new JumpSearchPage(page);
    await app.goto();

    // start the algorithm
    await app.clickStart();

    // status should change to Running
    await expect(app.status).toHaveText('Running');

    // now pause immediately
    await app.clickPause();

    // status should change to Paused
    await expect(app.status).toHaveText('Paused');

    // resume by clicking Start again -> Running
    await app.clickStart();
    await expect(app.status).toHaveText('Running');

    // Pause again to leave it in a stable state for cleanup
    await app.clickPause();
    await expect(app.status).toHaveText('Paused');
  });

  test('Pause and resume maintain algorithm state: Start from Paused goes to Running (S2_Paused -> S1_Running)', async ({ page }) => {
    // Validate that starting while paused resumes Running
    const app3 = new JumpSearchPage(page);
    await app.goto();

    // Ensure we have a known target by clicking a cell (this sets the input)
    await app.clickCell(0);
    const picked = await app.getTargetValue();
    expect(picked).toBeTruthy();

    // Start and then pause quickly
    await app.clickStart();
    await expect(app.status).toHaveText('Running');
    await app.clickPause();
    await expect(app.status).toHaveText('Paused');

    // Now start again - should go Running
    await app.clickStart();
    await expect(app.status).toHaveText('Running');

    // Pause to stabilize
    await app.clickPause();
    await expect(app.status).toHaveText('Paused');
  });

  test('Found state (S4_Found): clicking a cell to set target then Start leads to Found', async ({ page }) => {
    // Ensure the demo can find a target that exists in the array and updates resIndex/resValue
    const app4 = new JumpSearchPage(page);
    await app.goto();

    // pick the 0th cell as target
    const cells1 = await app.getCellsText();
    expect(cells.length).toBeGreaterThan(0);
    const firstVal = cells[0];
    await app.clickCell(0);

    // confirm target input is set to the cell value
    expect(await app.getTargetValue()).toBe(firstVal);

    // Set speed faster to run quickly during test
    await app.setSpeed(50);

    // Start and wait until Found status appears (the demo will auto-run)
    await app.clickStart();

    // Wait for found state: status text starts with 'Found at index'
    await page.waitForFunction(() => (document.getElementById('status')?.textContent || '').includes('Found at index'), null, { timeout: 5000 });

    const statusText = await app.getStatusText();
    expect(statusText?.startsWith('Found at index')).toBeTruthy();

    // Verify result index/value elements are updated coherently
    const res1 = await app.getRes();
    expect(res.index).not.toBe('-');
    expect(res.value).toBe(firstVal);

    // the corresponding cell should have the 'found' styling class
    const foundIndex = Number(res.index);
    const foundCellClass = await app.cells().nth(foundIndex).getAttribute('class');
    expect(foundCellClass).toContain('found');
  });

  test('Not Found state (S3_NotFound): searching for a value not in array yields Target not found', async ({ page }) => {
    // Force a not-found scenario by selecting a target outside the array range, then Start
    const app5 = new JumpSearchPage(page);
    await app.goto();

    const cells2 = await app.getCellsText();
    expect(cells.length).toBeGreaterThan(0);

    // pick a value larger than the maximum cell value to ensure not found
    const lastVal = Number(cells[cells.length - 1]);
    const impossibleVal = lastVal + 10000;
    await app.setTargetValue(impossibleVal);

    // Start and wait for 'Target not found'
    await app.clickStart();
    await page.waitForFunction(() => (document.getElementById('status')?.textContent || '') === 'Target not found', null, { timeout: 5000 });

    // Validate status and result placeholders
    await expect(app.status).toHaveText('Target not found');
    const res2 = await app.getRes();
    expect(res.index).toBe('-');
    expect(res.value).toBe('-');
  });

  test('Step event: singleStep advances generator and eventually completes (Step transition behavior)', async ({ page }) => {
    // Use the Step button repeatedly to drive the generator manually and ensure it reaches a terminal state (Found or Not Found)
    const app6 = new JumpSearchPage(page);
    await app.goto();

    // For deterministic steps, pick the first cell as target so it will be found eventually
    const cells3 = await app.getCellsText();
    expect(cells.length).toBeGreaterThan(0);
    const firstVal1 = cells[0];
    await app.setTargetValue(firstVal);

    // click step repeatedly until either result is found or gen becomes null (status Done or Found)
    let terminal = false;
    const maxSteps = 500; // safety cap
    for (let i = 0; i < maxSteps; i++) {
      await app.clickStep();
      // short pause to let UI update
      await page.waitForTimeout(20);

      const status = await app.getStatusText();
      if (status === 'Done' || status?.startsWith('Found at index') || status === 'Target not found') {
        terminal = true;
        break;
      }
    }

    expect(terminal).toBeTruthy();

    // If found, resIndex should not be '-'; if done (no more generator), status 'Done' is acceptable
    const finalStatus = await app.getStatusText();
    if (finalStatus?.startsWith('Found at index')) {
      const res3 = await app.getRes();
      expect(res.index).not.toBe('-');
      expect(res.value).toBe(firstVal);
    } else {
      // status 'Done' or 'Target not found' should leave results as '-' (Done after no steps left)
      const res4 = await app.getRes();
      // Either done after not found, or finished
      expect(res.index === '-' || !isNaN(Number(res.index))).toBeTruthy();
    }
  });

  test('Reset event (S1_Running -> S0_Idle via Reset): reset clears highlights, comparisons and sets Idle', async ({ page }) => {
    // Start algorithm, let it do a couple of steps, then Reset and verify idle state and cleared visuals
    const app7 = new JumpSearchPage(page);
    await app.goto();

    // ensure target is set
    await app.clickCell(0);
    const target = await app.getTargetValue();
    expect(target).toBeTruthy();

    // run a few steps using Step
    await app.clickStep();
    await page.waitForTimeout(50);
    await app.clickStep();
    await page.waitForTimeout(50);

    // comparisons should be >= 0 (likely >0)
    const compsBefore = await app.getComparisons();
    expect(compsBefore).toBeGreaterThanOrEqual(0);

    // reset
    await app.clickReset();

    // status should be Idle
    await expect(app.status).toHaveText('Idle');

    // comparisons reset to 0
    expect(await app.getComparisons()).toBe(0);

    // results should be placeholders
    const res5 = await app.getRes();
    expect(res.index).toBe('-');
    expect(res.value).toBe('-');

    // no cell should have highlight classes: checked, jump, found, block
    const count1 = await app.cells().count1();
    for (let i = 0; i < count; i++) {
      const cls = (await app.cells().nth(i).getAttribute('class')) || '';
      expect(cls.includes('checked')).toBeFalsy();
      expect(cls.includes('jump')).toBeFalsy();
      expect(cls.includes('found')).toBeFalsy();
      expect(cls.includes('block')).toBeFalsy();
    }
  });

  test('Pick Random and Cell click events (PickRandom, CellClick) set the target input correctly', async ({ page }) => {
    // Validate both picking a random target and clicking a cell updates the target input to a valid array value
    const app8 = new JumpSearchPage(page);
    await app.goto();

    const cellsBefore = await app.getCellsText();
    expect(cellsBefore.length).toBeGreaterThan(0);

    // Click pick random
    await app.clickPickRandom();
    const pr = await app.getTargetValue();
    expect(pr.length).toBeGreaterThan(0);
    expect(cellsBefore).toContain(pr);

    // Click a specific cell and verify input updates
    await app.clickCell(2);
    const cell2Val = (await app.cells().nth(2).textContent())?.trim();
    expect(await app.getTargetValue()).toBe(cell2Val);
  });

  test('Edge case: changing jump size to 0 uses auto sqrt behavior label update (visual evidence)', async ({ page }) => {
    // Validate jump slider value 0 updates displayed jumpSizeLabel to show auto sqrt(n)
    const app9 = new JumpSearchPage(page);
    await app.goto();

    // set jump slider to 0 via DOM events
    await app.jumpSlider.evaluate((el) => { el.value = '0'; el.dispatchEvent(new Event('input')); });

    // the jump size label element is #jumpSizeLabel - assert it includes 'auto'
    const jumpSizeLabel = await page.locator('#jumpSizeLabel').textContent();
    expect((jumpSizeLabel || '').toLowerCase()).toContain('auto');
  });

  test('Keyboard shortcuts: space starts, p pauses, s steps, r resets (basic validation)', async ({ page }) => {
    // Validate keyboard shortcuts trigger their respective actions at least at a basic level
    const app10 = new JumpSearchPage(page);
    await app.goto();

    // focus to body
    await page.keyboard.press('Space');
    // pressing Space should attempt to start => status might become Running or 'Set a numeric target'
    // Wait briefly and then press 'p' to pause (should set status to Paused)
    await page.waitForTimeout(50);
    await page.keyboard.press('p');
    await page.waitForTimeout(50);

    // status should be either Paused or remain something else; validate that pressing 'p' results in 'Paused'
    const st = await app.getStatusText();
    expect(st === 'Paused' || st === 'Paused' /* explicit to show expected */).toBeTruthy();

    // press 's' to single step - this should not throw and should update status text to some check or Done
    await page.keyboard.press('s');
    await page.waitForTimeout(50);

    // press 'r' to reset
    await page.keyboard.press('r');
    await page.waitForTimeout(50);
    await expect(app.status).toHaveText('Idle');
  });
});