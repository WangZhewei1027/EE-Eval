import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2e7280-fa7a-11f0-ba5b-57721b046e74.html';

class TernarySearchPage {
  constructor(page) {
    this.page = page;
    // controls
    this.arrayDisplay = page.locator('#arrayDisplay');
    this.arraySizeInput = page.locator('#arraySize');
    this.sizeValue = page.locator('#sizeValue');
    this.targetInput = page.locator('#target');
    this.targetValue = page.locator('#targetValue');
    this.arrayType = page.locator('#arrayType');
    this.customArrayControls = page.locator('#customArrayControls');
    this.customArrayInput = page.locator('#customArray');
    this.generateArrayBtn = page.locator('#generateArray');
    this.startSearchBtn = page.locator('#startSearch');
    this.stepForwardBtn = page.locator('#stepForward');
    this.resetBtn = page.locator('#reset');
    this.speedInput = page.locator('#speed');
    this.autoRunBtn = page.locator('#autoRun');
    this.stopAutoRunBtn = page.locator('#stopAutoRun');
    // status and info
    this.currentRange = page.locator('#currentRange');
    this.mid1Value = page.locator('#mid1Value');
    this.mid2Value = page.locator('#mid2Value');
    this.comparisonCount = page.locator('#comparisonCount');
    this.statusDisplay = page.locator('#status');
    this.executionLog = page.locator('#executionLog');
  }

  async goto() {
    await this.page.goto(BASE_URL);
    await this.page.waitForLoadState('domcontentloaded');
    // ensure UI ready
    await expect(this.generateArrayBtn).toBeVisible();
  }

  async setTarget(value) {
    // set range input value and dispatch input event
    await this.page.evaluate((v) => {
      const el = document.getElementById('target');
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
    await expect(this.targetValue).toHaveText(String(value));
  }

  async setArrayType(type) {
    await this.arrayType.selectOption(type);
    // dispatch change event if needed (selectOption does it)
    if (type === 'custom') {
      await expect(this.customArrayControls).toBeVisible();
    } else {
      await expect(this.customArrayControls).toBeHidden();
    }
  }

  async setCustomArray(text) {
    await this.customArrayInput.fill(text);
  }

  async setArraySize(size) {
    await this.page.evaluate((v) => {
      const el = document.getElementById('arraySize');
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, size);
    await expect(this.sizeValue).toHaveText(String(size));
  }

  async clickGenerate() {
    await this.generateArrayBtn.click();
  }

  async clickStart() {
    await this.startSearchBtn.click();
  }

  async clickStep() {
    await this.stepForwardBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async clickAutoRun() {
    await this.autoRunBtn.click();
  }

  async clickStopAutoRun() {
    await this.stopAutoRunBtn.click();
  }

  async getArrayLength() {
    return await this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('.array-element')).length;
    });
  }

  async getElementClassList(index) {
    return await this.page.evaluate((i) => {
      const el = document.getElementById(`element-${i}`);
      return el ? Array.from(el.classList) : [];
    }, index);
  }

  async getStatusText() {
    return await this.statusDisplay.textContent();
  }

  async getCurrentRangeText() {
    return await this.currentRange.textContent();
  }

  async getMidValuesText() {
    const a = await this.mid1Value.textContent();
    const b = await this.mid2Value.textContent();
    return { mid1: a, mid2: b };
  }

  async getComparisonCountText() {
    return await this.comparisonCount.textContent();
  }

  async executionLogHas(text) {
    return await this.executionLog.locator('div', { hasText: text }).count() > 0;
  }

  async isAutoRunEnabledState() {
    // return tuple: autoRunBtn.disabled, stopAutoRunBtn.disabled, stepForwardBtn.disabled
    return await this.page.evaluate(() => {
      return {
        autoRunDisabled: document.getElementById('autoRun').disabled,
        stopDisabled: document.getElementById('stopAutoRun').disabled,
        stepDisabled: document.getElementById('stepForward').disabled
      };
    });
  }

  async isSearchingFlag() {
    return await this.page.evaluate(() => typeof isSearching !== 'undefined' ? isSearching : null);
  }
}

test.describe('Ternary Search Interactive Demo - FSM and UI validation', () => {
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught exceptions emitted to page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test('Initial Load - Idle state should render array and show Ready status', async ({ page }) => {
    // Validate Idle state entry actions and UI after load
    const app = new TernarySearchPage(page);
    await app.goto();

    // Execution log should be empty on initial load
    await expect(app.executionLog.locator('div')).toHaveCount(0);

    // Status should show Ready (evidence for Idle)
    await expect(app.statusDisplay).toHaveText('Ready');

    // Default array size is 20 and array elements should be rendered
    await expect(app.sizeValue).toHaveText('20');
    const length = await app.getArrayLength();
    expect(length).toBeGreaterThanOrEqual(5); // sanity
    expect(length).toBeLessThanOrEqual(50);

    // currentRange should reflect array bounds
    const rangeText = await app.getCurrentRangeText();
    expect(rangeText).toMatch(/^0 - \d+$/);

    // No console errors or page errors should have occurred during initial load
    expect(consoleErrors.length, `console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Generate New Array transition from Idle to Searching (visual update) and Reset behavior', async ({ page }) => {
    // This validates the GenerateArray event and its actions (generateArray(), renderArray(), resetSearch())
    const app = new TernarySearchPage(page);
    await app.goto();

    // Change array size to 10 and generate new array
    await app.setArraySize(10);
    await app.clickGenerate();

    // After generate, arrayDisplay should have 10 elements and currentRange should be 0 - 9
    await expect(app.getArrayLength()).resolves.toBe(10);
    await expect(app.currentRange).toHaveText('0 - 9');

    // Reset should set status back to Ready and comparisonCount to 0
    // First simulate some search state by starting search and stepping once
    await app.clickStart();
    // Stepping once to change comparison count
    await app.clickStep();
    const comparisonsAfterStep = await app.getComparisonCountText();
    expect(Number(comparisonsAfterStep)).toBeGreaterThanOrEqual(0);

    // Now click reset and validate onExit and reset actions
    await app.clickReset();
    await expect(app.statusDisplay).toHaveText('Ready');
    await expect(app.comparisonCount).toHaveText('0');
    await expect(app.mid1Value).toHaveText('-');
    await expect(app.mid2Value).toHaveText('-');

    // No console or page errors during these interactions
    expect(consoleErrors.length, `console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Start Search transition: entering Searching state triggers log and sets isSearching', async ({ page }) => {
    // Validate StartSearch event transitions and entry actions
    const app = new TernarySearchPage(page);
    await app.goto();

    // Use custom array to make search deterministic
    await app.setArrayType('custom');
    await app.setCustomArray('10,20,30,40,50,60,70,80,90,100');
    await app.clickGenerate();

    // Confirm custom array rendered and length is 10
    await expect(app.getArrayLength()).resolves.toBe(10);

    // Click Start Search - should set isSearching = true and log "Starting ternary search..."
    await app.clickStart();

    // Assert execution log contains the start message
    const hasStartMsg = await app.executionLogHas('Starting ternary search...');
    expect(hasStartMsg).toBeTruthy();

    // Check global isSearching flag was set to true by startSearch entry action
    const isSearching = await app.isSearchingFlag();
    expect(isSearching).toBe(true);

    // No console or page errors
    expect(consoleErrors.length, `console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Step Forward transitions: updates midpoints, highlights, comparison count and can find target', async ({ page }) => {
    // This validates StepForward both for intermediate searching and final TargetFound / TargetNotFound
    const app = new TernarySearchPage(page);
    await app.goto();

    // Use the provided default custom array and set target to a known present value (50)
    await app.setArrayType('custom');
    await app.setCustomArray('10,20,30,40,50,60,70,80,90,100');
    await app.clickGenerate();

    // Set target to 50 which exists at index 4
    await app.setTarget(50);

    // Start search
    await app.clickStart();
    // Now repeatedly step forward until target found or we hit iteration limit
    let found = false;
    for (let i = 0; i < 20; i++) {
      await app.clickStep();

      const status = await app.getStatusText();
      if (status && status.includes('Found at index')) {
        found = true;
        // verify that the element at reported index has 'target' class
        const match = status.match(/Found at index (\d+)/);
        if (match) {
          const idx = Number(match[1]);
          const classes = await app.getElementClassList(idx);
          expect(classes).toContain('target');
        }
        break;
      }

      if (status === 'Target not found') {
        break;
      }
    }

    // We expect to find the target in this deterministic setup
    expect(found).toBe(true);

    // After finding the target, isSearching should be false (onExit of Searching)
    const isSearchingAfter = await app.isSearchingFlag();
    expect(isSearchingAfter).toBe(false);

    // Comparison count must be numeric and >= 0
    const comparisons = Number(await app.getComparisonCountText());
    expect(Number.isFinite(comparisons)).toBe(true);
    expect(comparisons).toBeGreaterThanOrEqual(0);

    // No console or page errors should have occurred
    expect(consoleErrors.length, `console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Step Forward when not searching should start search (guard and fallback)', async ({ page }) => {
    // Validate the guard inside stepForward that calls startSearch() if not already searching
    const app = new TernarySearchPage(page);
    await app.goto();

    // Ensure we're in Idle state
    await expect(app.statusDisplay).toHaveText('Ready');

    // Click step forward when not searching - should call startSearch (isSearching becomes true)
    await app.clickStep();

    // After clicking step forward from idle, the script calls startSearch (but returns early),
    // so isSearching should be true. Confirm via global flag and via execution log containing start message.
    const isSearching = await app.isSearchingFlag();
    expect(isSearching).toBe(true);

    const hasStartMsg = await app.executionLogHas('Starting ternary search...');
    expect(hasStartMsg).toBe(true);

    // No console or page errors
    expect(consoleErrors.length, `console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('ResetSearch transition from Searching should stop search and restore Ready state', async ({ page }) => {
    // Validate ResetSearch event stops searching and restores initial UI
    const app = new TernarySearchPage(page);
    await app.goto();

    await app.setArrayType('sorted');
    await app.setArraySize(15);
    await app.clickGenerate();

    // Start search and do one step to set some state
    await app.clickStart();
    await app.clickStep();

    // Ensure some mid values displayed
    const midValuesBefore = await app.getMidValuesText();
    // mid values might be '-' or numbers based on step, ensure we have something plausible
    expect(midValuesBefore).toBeDefined();

    // Reset
    await app.clickReset();

    // After reset, status should be Ready and mid values should be reset to '-'
    await expect(app.statusDisplay).toHaveText('Ready');
    await expect(app.mid1Value).toHaveText('-');
    await expect(app.mid2Value).toHaveText('-');
    await expect(app.comparisonCount).toHaveText('0');

    // isSearching flag should be false after reset (exit action expectation)
    const isSearchingAfter = await app.isSearchingFlag();
    expect(isSearchingAfter).toBe(false);

    // No console or page errors
    expect(consoleErrors.length, `console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Auto Run and Stop Auto Run: toggling and stopping behavior', async ({ page }) => {
    // Validate AutoRun event starts automatic stepping and StopAutoRun stops it
    const app = new TernarySearchPage(page);
    await app.goto();

    // Use a custom array where target is NOT present to force auto-run to eventually stop due to not found,
    // but to make the toggle test simpler we will start auto-run and then manually stop it.
    await app.setArrayType('custom');
    await app.setCustomArray('1,2,3,4,5,6,7,8,9,10');
    await app.clickGenerate();

    // Set a target that is not in the array (e.g., 50)
    await app.setTarget(50);

    // Start auto run
    await app.clickAutoRun();

    // Immediately after starting auto-run, autoRunBtn should be disabled and stopAutoRunBtn enabled
    const stateAfterStart = await app.isAutoRunEnabledState();
    expect(stateAfterStart.autoRunDisabled).toBe(true);
    expect(stateAfterStart.stopDisabled).toBe(false);
    expect(stateAfterStart.stepDisabled).toBe(true);

    // Wait a short period to allow some auto steps to execute
    await page.waitForTimeout(600);

    // Now click Stop to ensure manual stop works
    await app.clickStopAutoRun();

    // After stopping, autoRunBtn should be enabled and stopAutoRunBtn disabled and stepForward enabled
    const stateAfterStop = await app.isAutoRunEnabledState();
    expect(stateAfterStop.autoRunDisabled).toBe(false);
    expect(stateAfterStop.stopDisabled).toBe(true);
    expect(stateAfterStop.stepDisabled).toBe(false);

    // No console or page errors recorded
    expect(consoleErrors.length, `console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Target Not Found scenario via repeated stepping ends in Target Not Found final state', async ({ page }) => {
    // Validate the S3_TargetNotFound final state is reached when target is absent
    const app = new TernarySearchPage(page);
    await app.goto();

    // Use custom array and set target to a value not present
    await app.setArrayType('custom');
    await app.setCustomArray('10,20,30,40,50');
    await app.clickGenerate();

    // Set target to 5 which does not exist
    await app.setTarget(5);

    // Start search
    await app.clickStart();

    // Step enough times to complete search
    let notFound = false;
    for (let i = 0; i < 30; i++) {
      await app.clickStep();
      const status = await app.getStatusText();
      if (status === 'Target not found') {
        notFound = true;
        break;
      }
      // small throttle to avoid tight loop
      await page.waitForTimeout(10);
    }

    expect(notFound).toBe(true);

    // After reaching final not-found state, isSearching should be false
    const isSearchingAfter = await app.isSearchingFlag();
    expect(isSearchingAfter).toBe(false);

    // Execution log should contain the final not-found message
    const hasNotFoundMsg = await app.executionLogHas('Search complete: Target not found');
    expect(hasNotFoundMsg).toBe(true);

    // No console or page errors
    expect(consoleErrors.length, `console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test.afterEach(async ({ page }) => {
    // Final sanity: no unexpected console or page errors after test run
    expect(consoleErrors.length, `console errors at test teardown: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors at test teardown: ${JSON.stringify(pageErrors)}`).toBe(0);
    // Close page explicitly if needed (Playwright normally handles this)
    try {
      await page.close();
    } catch (e) {
      // ignore closure errors
    }
  });
});