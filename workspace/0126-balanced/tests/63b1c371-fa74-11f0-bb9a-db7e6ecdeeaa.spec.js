import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b1c371-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page object to encapsulate interactions with the app
class KruskalPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.locators = {
      btnStep: page.locator('#btnStep'),
      btnAuto: page.locator('#btnAuto'),
      btnReset: page.locator('#btnReset'),
      stateText: page.locator('#stateText'),
      canvas: page.locator('#graphCanvas'),
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // ensure initial rendering complete
    await this.locators.canvas.waitFor({ state: 'visible' });
  }

  async clickStep() {
    await this.locators.btnStep.click();
  }

  async clickAuto() {
    await this.locators.btnAuto.click();
  }

  async clickReset() {
    await this.locators.btnReset.click();
  }

  async getStateText() {
    return (await this.locators.stateText.innerText()).trim();
  }

  async getBtnAutoText() {
    return (await this.locators.btnAuto.innerText()).trim();
  }

  async getCanvasDataURL() {
    // evaluate toDataURL on the canvas element
    return await this.page.evaluate((sel) => {
      const c = document.querySelector(sel);
      try {
        return c.toDataURL();
      } catch (e) {
        return null;
      }
    }, '#graphCanvas');
  }

  async waitForStateTextContains(substring, timeout = 5000) {
    await this.page.waitForFunction(
      (sel, substr) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.includes(substr);
      },
      '#stateText',
      substring,
      { timeout }
    );
  }

  async waitForExactStateText(text, timeout = 5000) {
    await this.page.waitForFunction(
      (sel, expected) => {
        const el1 = document.querySelector(sel);
        return el && el.textContent && el.textContent.trim() === expected;
      },
      '#stateText',
      text,
      { timeout }
    );
  }
}

test.describe('Kruskal Algorithm Visualization - FSM state & transitions', () => {
  let page;
  let app;
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ browser }) => {
    // create a new context and page for isolation
    const context = await browser.newContext();
    page = await context.newPage();

    // capture console errors and page errors
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    app = new KruskalPage(page);
    await app.goto();
  });

  test.afterEach(async () => {
    // final assertions about console and page errors recorded during test run:
    // The application is expected to run without uncaught page errors. We assert that none were captured.
    // If there are errors, we still close the page and let test failure show the errors.
    expect(pageErrors, 'No uncaught page errors should occur').toEqual([]);
    expect(consoleErrors, 'No console.errors should be logged').toEqual([]);
    await page.close();
  });

  test('Initial Ready state on load (S0_Ready)', async () => {
    // Validate initial text in the UI matches the FSM Ready state evidence.
    // According to implementation resetAlgorithm() runs on init and sets:
    // 'Ready. Press "Step" to start algorithm.'
    const text = await app.getStateText();
    expect(text).toBe('Ready. Press "Step" to start algorithm.');

    // Canvas should be drawn and have a valid data URL
    const dataURL = await app.getCanvasDataURL();
    expect(typeof dataURL).toBe('string');
    expect(dataURL.length).toBeGreaterThan(100); // some content expected

    // Buttons should be present
    expect(await page.locator('#btnStep').isVisible()).toBeTruthy();
    expect(await page.locator('#btnAuto').isVisible()).toBeTruthy();
    expect(await page.locator('#btnReset').isVisible()).toBeTruthy();
  });

  test('StepClick transitions to Stepping and progresses; full run to Complete (S0->S1 ... S2)', async () => {
    // Capture initial canvas snapshot for visual-diff like assertion
    const before = await app.getCanvasDataURL();

    // 1) First click should process the lowest-weight edge (B-G weight 1)
    await app.clickStep();

    // The implementation first updates to "Checking edge ..." then to "Included edge ..." or "Rejected edge ...".
    // We wait for a message that indicates a decision was made.
    await app.waitForStateTextContains('Included edge', 2000).catch(async () => {
      // if not included, it might be rejected (unlikely for first edge), assert either is present
      await app.waitForStateTextContains('Rejected edge', 2000);
    });

    const afterFirstStep = await app.getStateText();
    expect(
      afterFirstStep.includes('Included edge') || afterFirstStep.includes('Rejected edge')
    ).toBeTruthy();

    // Canvas should have changed after the step (visual confirmation)
    const afterCanvas = await app.getCanvasDataURL();
    expect(afterCanvas).not.toBe(before);

    // 2) Continue pressing Step until algorithm reports completion.
    // We don't assume exact number of steps externally; loop until complete with a safe upper bound.
    const maxIterations = 30;
    let completed = false;
    for (let i = 0; i < maxIterations; i++) {
      const st = await app.getStateText();
      if (st === 'Algorithm complete! MST formed.') {
        completed = true;
        break;
      }
      await app.clickStep();
      // after each click, the stateText will be updated; wait briefly for change
      await app.page.waitForTimeout(50);
    }
    // Verify we eventually reached completion
    expect(completed).toBeTruthy();

    // 3) Clicking Step after completion should show the "already complete" message (edge case)
    await app.clickStep();
    await app.waitForStateTextContains('Algorithm is already complete! Press Reset to run again.', 1000);
    const postCompleteText = await app.getStateText();
    expect(postCompleteText).toBe('Algorithm is already complete! Press Reset to run again.');

    // Reset the algorithm to restore initial state for subsequent tests
    await app.clickReset();
    await app.waitForStateTextContains('Ready. Press "Step" to start algorithm.');
  });

  test('Auto Play starts, advances automatically, Step during Auto advances immediately, Pause stops auto (S0->S3->S1 and pause)', async () => {
    // Ensure starting from a fresh state
    await app.clickReset();
    await app.waitForStateTextContains('Ready. Press "Step" to start algorithm.');

    // Start Auto Play (S0_Ready -> S3_AutoPlay)
    await app.clickAuto();

    // Immediately the UI should show Auto Play started and the Auto button shows 'Pause'
    await app.waitForStateTextContains('Auto Play started.', 1000);
    expect(await app.getBtnAutoText()).toBe('Pause');

    // Give auto one interval (slightly longer than 1200ms interval in code) so that at least one automatic step happens
    await app.page.waitForTimeout(1400);

    // After auto stepping, stateText should reflect a decision (Included or Rejected) at some point
    const stAfterAuto = await app.getStateText();
    const autoMadeProgress = stAfterAuto.includes('Included edge') || stAfterAuto.includes('Rejected edge') || stAfterAuto === 'Algorithm complete! MST formed.';
    expect(autoMadeProgress).toBeTruthy();

    // Record text to compare after manual Step during autoplay
    const beforeManualStepText = await app.getStateText();

    // Click Step while Auto is running (S3_AutoPlay -> S1_Stepping transition in FSM)
    await app.clickStep();
    // After clicking Step, we should see an immediate 'Included' or 'Rejected' message (or possibly completion)
    await app.page.waitForTimeout(200);
    const afterManualStepText = await app.getStateText();
    expect(afterManualStepText).not.toBe(beforeManualStepText);

    // Now click Auto again to pause (stop auto)
    await app.clickAuto();
    // When pausing, the app updates stateText to 'Auto Play stopped.' per implementation
    await app.waitForStateTextContains('Auto Play stopped.', 1000);
    expect(await app.getBtnAutoText()).toBe('Auto Play');
  });

  test('Reset during Auto Play returns to Ready (S3_AutoPlay -> S0_Ready)', async () => {
    // Start fresh
    await app.clickReset();
    await app.waitForStateTextContains('Ready. Press "Step" to start algorithm.');

    // Start auto
    await app.clickAuto();
    await app.waitForStateTextContains('Auto Play started.', 1000);
    expect(await app.getBtnAutoText()).toBe('Pause');

    // Click Reset while auto is running; resetAlgorithm() should clear timers and set Ready text (transition S3->S0)
    await app.clickReset();

    // Validate that we are back to Ready state text and Auto button reads 'Auto Play'
    await app.waitForStateTextContains('Ready. Press "Step" to start algorithm.', 1000);
    expect(await app.getBtnAutoText()).toBe('Auto Play');

    // Also ensure canvas was re-rendered (it should have a defined dataURL)
    const dataURL1 = await app.getCanvasDataURL();
    expect(typeof dataURL).toBe('string');
    expect(dataURL.length).toBeGreaterThan(100);
  });

  test('Clicking Auto when algorithm is already complete shows informational message (edge case)', async () => {
    // Run algorithm to completion using Step clicks
    await app.clickReset();
    await app.waitForStateTextContains('Ready. Press "Step" to start algorithm.');

    // run steps until complete (safe loop)
    for (let i = 0; i < 40; i++) {
      const st1 = await app.getStateText();
      if (st === 'Algorithm complete! MST formed.') break;
      await app.clickStep();
      await app.page.waitForTimeout(20);
    }

    // Confirm completed
    await app.waitForStateTextContains('Algorithm complete! MST formed.', 2000);

    // Now click Auto: the app should respond with "Algorithm already complete. Reset to run again."
    await app.clickAuto();
    await app.waitForStateTextContains('Algorithm already complete. Reset to run again.', 1000);
    const text1 = await app.getStateText();
    expect(text).toBe('Algorithm already complete. Reset to run again.');
  });
});