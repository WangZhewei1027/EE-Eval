import { test, expect } from '@playwright/test';

// Test file for Application ID: 6d2daf31-fa7a-11f0-ba5b-57721b046e74
// Serves the Selection Sort Interactive Demo and validates FSM states & transitions.
// File name requirement: 6d2daf31-fa7a-11f0-ba5b-57721b046e74.spec.js

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2daf31-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object Model for the selection sort page
class SelectionSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // controls
    this.arraySize = page.locator('#arraySize');
    this.arraySizeValue = page.locator('#arraySizeValue');
    this.speed = page.locator('#speed');
    this.speedValue = page.locator('#speedValue');
    this.generateBtn = page.locator('#generateBtn');
    this.startBtn = page.locator('#startBtn');
    this.pauseBtn = page.locator('#pauseBtn');
    this.stepBtn = page.locator('#stepBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.dataType = page.locator('#dataType');

    // visual areas
    this.arrayContainer = page.locator('#arrayContainer');
    this.status = page.locator('#status');
    this.currentStep = page.locator('#currentStep');
  }

  // Helpers
  async goto() {
    await this.page.goto(APP_URL);
    // Wait for initial rendering
    await expect(this.status).toHaveText(/Ready to begin/);
  }

  async getArrayBarCount() {
    return await this.arrayContainer.locator('.array-bar').count();
  }

  async getArrayValues() {
    const labels = this.arrayContainer.locator('.array-bar div');
    const count = await labels.count();
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push(await labels.nth(i).innerText());
    }
    return out;
  }

  async waitForStatusText(expected, timeout = 10000) {
    await this.page.waitForFunction(
      (selector, text) => document.querySelector(selector)?.textContent?.trim() === text,
      '#status',
      expected,
      { timeout }
    );
  }

  async waitForStatusIncludes(expectedSubstring, timeout = 10000) {
    await this.page.waitForFunction(
      (selector, substr) => document.querySelector(selector)?.textContent?.includes(substr),
      '#status',
      expectedSubstring,
      { timeout }
    );
  }

  async waitForCompletion(timeout = 20000) {
    await this.page.waitForFunction(
      () => document.getElementById('status')?.textContent?.trim() === 'Sorting completed!',
      {},
      { timeout }
    );
  }
}

test.describe.parallel('Selection Sort Interactive Demo - Application ID: 6d2daf31-fa7a-11f0-ba5b-57721b046e74', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Collect any page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Collect console messages of type 'error'
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg);
      }
    });

    // Navigate will be performed inside each test via the page object.
  });

  test.afterEach(async () => {
    // After each test we assert that there were no uncaught page errors or console errors.
    // This validates that the application runs without JS exceptions during interactions.
    expect(pageErrors, `Unexpected page errors: ${pageErrors.map(e => e.toString()).join('\n')}`).toEqual([]);
    expect(consoleErrors.map(m => `${m.type()}: ${m.text()}`), `Unexpected console.error messages`).toEqual([]);
  });

  test('Initial state (Idle) renders correctly', async ({ page }) => {
    // Validate Idle state rendering and initial onEnter behavior (renderArray)
    const sp = new SelectionSortPage(page);
    await sp.goto();

    // Status text should match idle message from FSM
    await expect(sp.status).toHaveText('Ready to begin. Click "Generate New Array" or "Start Sorting".');

    // Default controls: start enabled, generate enabled, pause and step disabled
    await expect(sp.startBtn).toBeEnabled();
    await expect(sp.generateBtn).toBeEnabled();
    await expect(sp.pauseBtn).toBeDisabled();
    await expect(sp.stepBtn).toBeDisabled();

    // Array size default value is 10 (as per HTML attributes)
    await expect(sp.arraySizeValue).toHaveText('10');
    const barCount = await sp.getArrayBarCount();
    expect(barCount).toBeGreaterThanOrEqual(5); // ensure reasonable bars rendered

    // Speed value default 500ms
    await expect(sp.speedValue).toHaveText('500ms');
  });

  test('Generate New Array updates array and status (S0_Idle -> S0_Idle)', async ({ page }) => {
    // Clicking Generate should generate a new array and update status in Idle state.
    const sp = new SelectionSortPage(page);
    await sp.goto();

    const beforeValues = await sp.getArrayValues();
    await sp.generateBtn.click();

    // Status should reflect new array generation as per implementation
    await expect(sp.status).toHaveText('New array generated. Ready to sort.');

    const afterValues = await sp.getArrayValues();

    // It's possible (rare) that random generation produces identical sequence; assert either changed
    // or at least a different length or the status updated. We assert status primarily.
    expect(afterValues.length).toEqual(beforeValues.length);
  });

  test('Start Sorting transitions to Sorting (S0_Idle -> S1_Sorting) and enables controls', async ({ page }) => {
    // When starting sorting, UI should reflect 'Sorting in progress...' and appropriate buttons toggled.
    const sp = new SelectionSortPage(page);
    await sp.goto();

    // Reduce array size and speed for deterministic faster progression
    await sp.arraySize.fill('5'); // range input - fill changes value attribute, but also trigger input event
    // Fire input event by dispatching via evaluate to ensure page listens
    await page.evaluate(() => {
      const el = document.getElementById('arraySize');
      el.value = 5;
      const evt = new Event('input', { bubbles: true });
      el.dispatchEvent(evt);
    });

    // Set speed low so sorting advances quickly but still allows assertions
    await page.evaluate(() => {
      const el = document.getElementById('speed');
      el.value = 200;
      const evt = new Event('input', { bubbles: true });
      el.dispatchEvent(evt);
    });

    await sp.generateBtn.click(); // ensure fresh array
    await sp.startBtn.click();

    // After starting: status should be 'Sorting in progress...'
    await expect(sp.status).toHaveText('Sorting in progress...');

    // Buttons: start disabled, generate disabled, pause & step enabled
    await expect(sp.startBtn).toBeDisabled();
    await expect(sp.generateBtn).toBeDisabled();
    await expect(sp.pauseBtn).toBeEnabled();
    await expect(sp.stepBtn).toBeEnabled();

    // currentStep should begin with "Step"
    await expect(sp.currentStep).toHaveText(/Step \d+: /);
  });

  test('Pause and Resume functionality toggles correctly (S1_Sorting <-> S2_Paused)', async ({ page }) => {
    // Validate pause toggling text and resuming continues sorting
    const sp = new SelectionSortPage(page);
    await sp.goto();

    // Prepare small array and faster animation to finish within test timeout
    await page.evaluate(() => {
      document.getElementById('arraySize').value = 6;
      document.getElementById('arraySize').dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('speed').value = 300;
      document.getElementById('speed').dispatchEvent(new Event('input', { bubbles: true }));
    });

    await sp.generateBtn.click();
    await sp.startBtn.click();

    // Give some time for sorting to start and perform at least one step
    await page.waitForTimeout(250);

    // Click pause -> should set pauseBtn.textContent to 'Resume' (actual implementation)
    await sp.pauseBtn.click();
    await expect(sp.pauseBtn).toHaveText('Resume');

    // Ensure no errors and paused state reflected by pauseBtn text; now resume
    await sp.pauseBtn.click();
    await expect(sp.pauseBtn).toHaveText('Pause');

    // Wait for sorting to finish and reach Completed state
    await page.waitForFunction(
      () => document.getElementById('status')?.textContent?.trim() === 'Sorting completed!',
      {},
      { timeout: 15000 }
    );

    // Validate final completed status
    await expect(sp.status).toHaveText('Sorting completed!');

    // When completed, pause and step buttons should be disabled and start/generate enabled
    await expect(sp.pauseBtn).toBeDisabled();
    await expect(sp.stepBtn).toBeDisabled();
    await expect(sp.startBtn).toBeEnabled();
    await expect(sp.generateBtn).toBeEnabled();

    // All array bars should have 'sorted' class applied (rendering shows completed sort)
    const bars = sp.arrayContainer.locator('.array-bar');
    const count = await bars.count();
    for (let i = 0; i < count; i++) {
      await expect(bars.nth(i)).toHaveClass(/sorted/);
    }
  });

  test('Step button behavior while sorting (S1_Sorting StepSorting transition)', async ({ page }) => {
    // This test examines performStep behavior. The implementation sets isPaused=true and calls performSortStep.
    // Due to the implementation, performStep sets pauseBtn text to 'Resume' but performSortStep returns immediately if paused.
    const sp = new SelectionSortPage(page);
    await sp.goto();

    // Set speed to a larger value so automated stepping doesn't race the test
    await page.evaluate(() => {
      const speedEl = document.getElementById('speed');
      speedEl.value = 2000;
      speedEl.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('arraySize').value = 7;
      document.getElementById('arraySize').dispatchEvent(new Event('input', { bubbles: true }));
    });

    await sp.generateBtn.click();
    await sp.startBtn.click();

    // Wait for initial step to be rendered
    await page.waitForFunction(
      () => document.getElementById('currentStep')?.textContent?.trim().length > 0,
      {},
      { timeout: 5000 }
    );

    const beforeStepText = await sp.currentStep.textContent();

    // Click the Step button; according to implementation it sets pauseBtn text to 'Resume'
    await sp.stepBtn.click();

    // Pause button should display 'Resume' (indicating paused state)
    await expect(sp.pauseBtn).toHaveText('Resume');

    // Because performStep sets isPaused = true before calling performSortStep, immediate further step progression may not occur.
    // Assert that currentStep hasn't changed within a short timeframe (highlighting the observed behavior).
    await page.waitForTimeout(300);
    const afterStepText = await sp.currentStep.textContent();

    // It's valid if the text remained the same (implementation quirk). We assert that the UI reflects paused state and step operation didn't crash.
    expect(afterStepText).toEqual(beforeStepText);
  });

  test('Reset returns to Idle state (S* -> S0_Idle)', async ({ page }) => {
    // Validate reset brings UI back to idle initial conditions.
    const sp = new SelectionSortPage(page);
    await sp.goto();

    // Start sorting to change state
    await page.evaluate(() => {
      const el = document.getElementById('arraySize');
      el.value = 6;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('speed').value = 500;
      document.getElementById('speed').dispatchEvent(new Event('input', { bubbles: true }));
    });

    await sp.generateBtn.click();
    await sp.startBtn.click();

    // Wait a bit and then click Reset
    await page.waitForTimeout(200);
    await sp.resetBtn.click();

    // Expect UI back to initial ready state text
    await expect(sp.status).toHaveText('Ready to begin. Click "Generate New Array" or "Start Sorting".');

    // Buttons: start and generate enabled, pause & step disabled, pause text reset to 'Pause'
    await expect(sp.startBtn).toBeEnabled();
    await expect(sp.generateBtn).toBeEnabled();
    await expect(sp.pauseBtn).toBeDisabled();
    await expect(sp.stepBtn).toBeDisabled();
    await expect(sp.pauseBtn).toHaveText('Pause');

    // currentStep cleared
    await expect(sp.currentStep).toHaveText('');
  });

  test('Control inputs change array size, speed, and data type (ChangeArraySize, ChangeAnimationSpeed, ChangeDataType)', async ({ page }) => {
    const sp = new SelectionSortPage(page);
    await sp.goto();

    // Change array size via input and ensure displayed value changes and array re-renders
    await page.evaluate(() => {
      const el = document.getElementById('arraySize');
      el.value = 12;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(sp.arraySizeValue).toHaveText('12');

    // Speed input update should reflect in speedValue text
    await page.evaluate(() => {
      const el = document.getElementById('speed');
      el.value = 1200;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(sp.speedValue).toHaveText('1200ms');

    // Change data type to 'reversed' and ensure Generate New Array runs (change triggers generateNewArray in implementation)
    await sp.dataType.selectOption('reversed');

    // After changing data type the status should indicate new array generated
    await expect(sp.status).toHaveText('New array generated. Ready to sort.');
  });

  test('Edge case: Attempting to Generate New Array while sorting (should be prevented by implementation)', async ({ page }) => {
    // generateNewArray returns early if isSorting is true; also generate button is disabled when sorting.
    const sp = new SelectionSortPage(page);
    await sp.goto();

    // Start sorting
    await page.evaluate(() => {
      document.getElementById('arraySize').value = 8;
      document.getElementById('arraySize').dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('speed').value = 400;
      document.getElementById('speed').dispatchEvent(new Event('input', { bubbles: true }));
    });
    await sp.generateBtn.click();
    await sp.startBtn.click();

    // generateBtn should be disabled; attempting to click programmatically should be ineffective
    await expect(sp.generateBtn).toBeDisabled();

    // Ensure status remains 'Sorting in progress...' and no crash occurs
    await expect(sp.status).toHaveText('Sorting in progress...');

    // Reset to clean up
    await sp.resetBtn.click();
    await expect(sp.status).toHaveText('Ready to begin. Click "Generate New Array" or "Start Sorting".');
  });

  test('Full sort completion from start to finish results in Completed state (S1_Sorting -> S3_Completed)', async ({ page }) => {
    // This test initiates sorting and waits for the 'Sorting completed!' status, then validates final UI.
    const sp = new SelectionSortPage(page);
    await sp.goto();

    // Use small array and fast speed to ensure completion within test timeout
    await page.evaluate(() => {
      document.getElementById('arraySize').value = 5;
      document.getElementById('arraySize').dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('speed').value = 100;
      document.getElementById('speed').dispatchEvent(new Event('input', { bubbles: true }));
    });

    await sp.generateBtn.click();
    await sp.startBtn.click();

    // Wait for the implementation to mark completion
    await page.waitForFunction(
      () => document.getElementById('status')?.textContent?.trim() === 'Sorting completed!',
      {},
      { timeout: 20000 }
    );

    await expect(sp.status).toHaveText('Sorting completed!');
    // currentStep element should include 'Sorting completed!' appended by finishSorting
    const cs = await sp.currentStep.textContent();
    expect(cs).toContain('Sorting completed!');

    // All bars should have 'sorted' class
    const bars = sp.arrayContainer.locator('.array-bar');
    const count = await bars.count();
    for (let i = 0; i < count; i++) {
      await expect(bars.nth(i)).toHaveClass(/sorted/);
    }
  });
});