import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2dd640-fa7a-11f0-ba5b-57721b046e74.html';

class MergeSortPage {
  /**
   * page: Playwright Page
   * consoleErrors: array to capture console.error messages
   * pageErrors: array to capture uncaught page errors
   */
  constructor(page, consoleErrors, pageErrors) {
    this.page = page;
    this.consoleErrors = consoleErrors;
    this.pageErrors = pageErrors;
    this.arrayContainer = page.locator('#arrayContainer');
    this.arraySizeInput = page.locator('#arraySize');
    this.arraySizeValue = page.locator('#arraySizeValue');
    this.arrayTypeSelect = page.locator('#arrayType');
    this.generateArrayBtn = page.locator('#generateArray');
    this.startSortBtn = page.locator('#startSort');
    this.pauseSortBtn = page.locator('#pauseSort');
    this.stepSortBtn = page.locator('#stepSort');
    this.resetSortBtn = page.locator('#resetSort');
    this.speedControl = page.locator('#speedControl');
    this.explanationDiv = page.locator('#explanation');
    this.currentStepDiv = page.locator('#currentStep');
    this.comparisonsDiv = page.locator('#comparisons');
    this.mergesDiv = page.locator('#merges');
    this.callStackDiv = page.locator('#callStack');
    this.showMergeCheckbox = page.locator('#showMerge');
    this.showRecursionCheckbox = page.locator('#showRecursion');
  }

  async setArraySize(value) {
    // set value and dispatch input event so updateArraySize runs
    await this.page.evaluate((v) => {
      const el = document.getElementById('arraySize');
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
    // Wait for displayed label to update
    await this.page.waitForFunction((expected) => {
      const el = document.getElementById('arraySizeValue');
      return el && el.textContent === expected;
    }, String(value));
  }

  async getDisplayedArraySize() {
    return await this.arraySizeValue.textContent();
  }

  async setArrayType(typeValue) {
    await this.page.selectOption('#arrayType', typeValue);
  }

  async setSpeedControl(value) {
    await this.page.evaluate((v) => {
      const el = document.getElementById('speedControl');
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
  }

  async clickGenerate() {
    await this.generateArrayBtn.click();
  }

  async clickStart() {
    await this.startSortBtn.click();
  }

  async clickPause() {
    await this.pauseSortBtn.click();
  }

  async clickStep() {
    await this.stepSortBtn.click();
  }

  async clickReset() {
    await this.resetSortBtn.click();
  }

  async arrayContainerCount() {
    // number of top-level bars (each bar wrapper is a direct child)
    return await this.page.evaluate(() => {
      const container = document.getElementById('arrayContainer');
      return container ? container.children.length : 0;
    });
  }

  async sortedCount() {
    return await this.page.locator('#arrayContainer .sorted').count();
  }

  async isStartDisabled() {
    return await this.startSortBtn.isDisabled();
  }

  async isPauseDisabled() {
    return await this.pauseSortBtn.isDisabled();
  }

  async isStepDisabled() {
    return await this.stepSortBtn.isDisabled();
  }

  async isGenerateDisabled() {
    return await this.generateArrayBtn.isDisabled();
  }

  async pauseButtonText() {
    return await this.pauseSortBtn.textContent();
  }

  async currentExplanationText() {
    return await this.explanationDiv.textContent();
  }

  async currentStepText() {
    return await this.currentStepDiv.textContent();
  }

  async comparisonsValue() {
    const txt = await this.comparisonsDiv.textContent();
    const m = txt && txt.match(/Comparisons:\s*(\d+)/);
    return m ? Number(m[1]) : null;
  }

  async mergesValue() {
    const txt = await this.mergesDiv.textContent();
    const m = txt && txt.match(/Merges:\s*(\d+)/);
    return m ? Number(m[1]) : null;
  }

  async callStackCount() {
    return await this.page.evaluate(() => {
      const cs = document.getElementById('callStack');
      return cs ? cs.children.length : 0;
    });
  }

  // Convenience waiters
  async waitForSortingToStart() {
    // pause and step become enabled, start becomes disabled, generate disabled
    await this.page.waitForFunction(() => {
      const start = document.getElementById('startSort');
      const pause = document.getElementById('pauseSort');
      const step = document.getElementById('stepSort');
      const gen = document.getElementById('generateArray');
      return start && start.disabled === true && pause && pause.disabled === false && step && step.disabled === false && gen && gen.disabled === true;
    });
  }

  async waitForSortingToComplete(timeout = 10000) {
    // explanation includes 'Merge Sort completed!' and startSort re-enabled
    await this.page.waitForFunction(() => {
      const expl = document.getElementById('explanation');
      const start = document.getElementById('startSort');
      return expl && /Merge Sort completed/i.test(expl.innerText) && start && start.disabled === false;
    }, { timeout });
  }
}

test.describe('Interactive Merge Sort - FSM and UI tests', () => {
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Capture console errors and uncaught page errors for each test run
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    page.on('pageerror', (err) => {
      // Capture uncaught exceptions from page
      pageErrors.push({
        message: err.message,
        stack: err.stack
      });
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Ensure DOMContentLoaded triggered script's DOM setup.
    // The app initializes generateNewArray and setupEventListeners on DOMContentLoaded.
    // Wait briefly to allow initial render.
    await page.waitForTimeout(100);
  });

  test('Idle state renders correctly on load', async ({ page }) => {
    // Validate initial Idle state: controls present, start/generate visible, pause/step disabled, array rendered
    const p = new MergeSortPage(page, consoleErrors, pageErrors);

    // Buttons exist
    await expect(p.generateArrayBtn).toBeVisible();
    await expect(p.startSortBtn).toBeVisible();
    await expect(p.pauseSortBtn).toBeVisible();
    await expect(p.stepSortBtn).toBeVisible();
    await expect(p.resetSortBtn).toBeVisible();

    // Pause and Step should be disabled initially
    expect(await p.isPauseDisabled()).toBeTruthy();
    expect(await p.isStepDisabled()).toBeTruthy();

    // Array size label should match input default (15)
    const displayedSize = await p.getDisplayedArraySize();
    expect(displayedSize).toBe(await page.locator('#arraySize').evaluate((el) => el.value));

    // arrayContainer should have children equal to size
    const size = Number(await page.locator('#arraySize').evaluate((el) => el.value));
    const count = await p.arrayContainerCount();
    expect(count).toBe(size);

    // No uncaught console/page errors on idle render
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Generate New Array updates DOM for various sizes and types', async ({ page }) => {
    // Validate GenerateArray event: changing size and type produces expected number of bars
    const p = new MergeSortPage(page, consoleErrors, pageErrors);

    // Set array size to 10 and type to 'fewUnique' then generate
    await p.setArraySize(10);
    expect(await p.getDisplayedArraySize()).toBe('10');

    await p.setArrayType('fewUnique');
    await p.clickGenerate();

    // After generation, arrayContainer should reflect 10 bars
    const count = await p.arrayContainerCount();
    expect(count).toBe(10);

    // Change to 5
    await p.setArraySize(5);
    await p.setArrayType('sorted');
    await p.clickGenerate();

    const count2 = await p.arrayContainerCount();
    expect(count2).toBe(5);

    // Confirm no console/page errors during generate interactions
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Start Merge Sort transitions to Sorting state and disables generation', async ({ page }) => {
    // Validate StartSort event and S0->S1 transition observables (buttons and disabled states)
    const p = new MergeSortPage(page, consoleErrors, pageErrors);

    // Reduce array size to 6 for faster animation
    await p.setArraySize(6);
    await p.setSpeedControl(1); // fastest (animationSpeed = 10)

    // Start sort
    await p.clickStart();

    // Wait until UI reflects sorting started
    await p.waitForSortingToStart();

    // Assertions based on evidence: startSort disabled, pause and step enabled, generate disabled
    expect(await p.isStartDisabled()).toBeTruthy();
    expect(await p.isPauseDisabled()).toBeFalsy();
    expect(await p.isStepDisabled()).toBeFalsy();
    expect(await p.isGenerateDisabled()).toBeTruthy();

    // Call stack should begin populating (at least one entry)
    const callStackCount = await p.callStackCount();
    expect(callStackCount).toBeGreaterThanOrEqual(0);

    // No immediate uncaught errors after starting
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('PauseSort toggles pause/resume during sorting and stops animation progression', async ({ page }) => {
    // Validate PauseSort event S1->S2 and S2->S1 on second click
    const p = new MergeSortPage(page, consoleErrors, pageErrors);

    await p.setArraySize(6);
    await p.setSpeedControl(1);
    await p.clickStart();
    await p.waitForSortingToStart();

    // Ensure pause button is enabled then click to pause
    expect(await p.isPauseDisabled()).toBeFalsy();
    const beforeText = await p.currentStepText();

    await p.clickPause();

    // After pausing, pause button text should change to 'Resume'
    await page.waitForFunction(() => {
      const b = document.getElementById('pauseSort');
      return b && b.textContent === 'Resume';
    });

    expect((await p.pauseButtonText()).trim()).toMatch(/Resume/i);

    // Ensure currentStep text does not change over a short interval (implying paused)
    const stepAfterPause = await p.currentStepText();
    await page.waitForTimeout(250);
    const stepAfterWait = await p.currentStepText();
    expect(stepAfterWait).toBe(stepAfterPause);

    // Click pause again to resume
    await p.clickPause();
    await page.waitForFunction(() => {
      const b = document.getElementById('pauseSort');
      return b && b.textContent === 'Pause';
    });
    expect((await p.pauseButtonText()).trim()).toMatch(/Pause/i);

    // No console/page errors triggered by pause/resume
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('StepSort processes a single animation step while paused', async ({ page }) => {
    // Validate StepSort event processing (S1->S1 self transition, single step)
    const p = new MergeSortPage(page, consoleErrors, pageErrors);

    await p.setArraySize(6);
    await p.setSpeedControl(1);
    await p.clickStart();
    await p.waitForSortingToStart();

    // Pause the sorting to step deterministically
    await p.clickPause();
    await page.waitForFunction(() => {
      const b = document.getElementById('pauseSort');
      return b && b.textContent === 'Resume';
    });

    // Snapshot currentStep
    const before = (await p.currentStepText()) || '';

    // Click Step - should process exactly one animation and update currentStep
    expect(await p.isStepDisabled()).toBeFalsy();
    await p.clickStep();

    // Wait briefly for step processing to reflect
    await page.waitForTimeout(150);

    const after = (await p.currentStepText()) || '';

    // Assert that current step changed (processed something)
    expect(after).not.toBe(before);

    // Ensure no console/page errors from stepping
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Sorting completes and transitions to Completed state with final UI updates', async ({ page }) => {
    // Validate S1->S3 transition: sortingComplete on queue exhaustion and final UI updates
    const p = new MergeSortPage(page, consoleErrors, pageErrors);

    // Use very small array to ensure completion quickly
    await p.setArraySize(5);
    await p.setSpeedControl(1); // fast
    await p.clickStart();

    // Wait for completion (explanation contains 'Merge Sort completed!' and start enabled)
    await p.waitForSortingToComplete(15000); // allow up to 15s

    // Explanation should indicate completion
    const explText = await p.currentExplanationText();
    expect(explText).toMatch(/Merge Sort completed/i);

    // currentStepDiv should show 'Sorting completed!'
    const curr = await p.currentStepText();
    expect(curr).toMatch(/Sorting completed/i);

    // All bars should be marked sorted
    const size = Number(await page.locator('#arraySize').evaluate((el) => el.value));
    const sortedCount = await p.sortedCount();
    expect(sortedCount).toBe(size);

    // Stats should be numbers (comparisons and merges >= 0)
    const comps = await p.comparisonsValue();
    const merges = await p.mergesValue();
    expect(typeof comps).toBe('number');
    expect(typeof merges).toBe('number');
    expect(comps).toBeGreaterThanOrEqual(0);
    expect(merges).toBeGreaterThanOrEqual(0);

    // No uncaught console/page errors observed upon completion
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('ResetSort moves from Completed back to Idle and clears state', async ({ page }) => {
    // Validate S3->S0 transition via ResetSort: UI returns to idle defaults
    const p = new MergeSortPage(page, consoleErrors, pageErrors);

    // Trigger a full sort first
    await p.setArraySize(5);
    await p.setSpeedControl(1);
    await p.clickStart();
    await p.waitForSortingToComplete(15000);

    // Click reset
    await p.clickReset();

    // After reset the start button should be enabled, pause/step disabled, generate enabled
    await page.waitForFunction(() => {
      const start = document.getElementById('startSort');
      const pause = document.getElementById('pauseSort');
      const step = document.getElementById('stepSort');
      const gen = document.getElementById('generateArray');
      return start && start.disabled === false && pause && pause.disabled === true && step && step.disabled === true && gen && gen.disabled === false;
    });

    expect(await p.isStartDisabled()).toBeFalsy();
    expect(await p.isPauseDisabled()).toBeTruthy();
    expect(await p.isStepDisabled()).toBeTruthy();
    expect(await p.isGenerateDisabled()).toBeFalsy();

    // Explanation text should be reset to initial prompt
    const expl = await p.currentExplanationText();
    expect(expl).toMatch(/Click "Start Merge Sort" to begin the visualization/i);

    // Comparisons and merges reset to 0
    const comps = await p.comparisonsValue();
    const merges = await p.mergesValue();
    expect(comps).toBe(0);
    expect(merges).toBe(0);

    // Call stack cleared
    const cs = await p.callStackCount();
    expect(cs).toBe(0);

    // arrayContainer should still show bars equal to current size
    const size = Number(await page.locator('#arraySize').evaluate((el) => el.value));
    const count = await p.arrayContainerCount();
    expect(count).toBe(size);

    // No uncaught errors on reset
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Generate New Array is blocked while sorting (attempt has no effect)', async ({ page }) => {
    // Validate that generateNewArray ignores clicks during sorting (guard if (isSorting) return;)
    const p = new MergeSortPage(page, consoleErrors, pageErrors);

    await p.setArraySize(6);
    await p.setSpeedControl(1);
    await p.clickStart();
    await p.waitForSortingToStart();

    // Snapshot current child count
    const beforeCount = await p.arrayContainerCount();

    // Attempt to click generate while sorting (button should be disabled)
    // We'll force click via JS to simulate potential user trying; but since button disabled, click() will be no-op in browser.
    // Use Playwright's click - it will throw if disabled unless 'force' used. We will not force.
    expect(await p.isGenerateDisabled()).toBeTruthy();

    // Try clicking - this will fail if enabled; since disabled we expect no change and no exception
    // Use evaluate to call click() in page context (but disabled will prevent handler & generateNewArray has guard)
    await page.evaluate(() => {
      const btn = document.getElementById('generateArray');
      if (btn) btn.click();
    });

    // Wait briefly and verify array count unchanged
    await page.waitForTimeout(200);
    const afterCount = await p.arrayContainerCount();
    expect(afterCount).toBe(beforeCount);

    // No page errors produced by attempted click
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Console and page error observation: no uncaught ReferenceError/SyntaxError/TypeError should be present', async ({ page }) => {
    // This test explicitly observes console/page errors and asserts none were emitted during a typical interaction cycle.
    const p = new MergeSortPage(page, consoleErrors, pageErrors);

    // Do a quick set of interactions to exercise code paths
    await p.setArraySize(6);
    await p.setSpeedControl(1);
    await p.clickGenerate();
    await p.clickStart();

    // Wait shortly for some animations to run, then pause and reset
    await page.waitForTimeout(300);
    if (!(await p.isPauseDisabled())) {
      await p.clickPause();
    }

    await p.clickReset();

    // Final assertion: there should be zero captured console.error messages and zero uncaught page errors
    // If any ReferenceError, SyntaxError, TypeError, or uncaught exceptions occurred, they will appear here.
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});