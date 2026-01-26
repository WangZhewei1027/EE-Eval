import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b1c372-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for the Prim's Algorithm page
class PrimPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startSel = '#startBtn';
    this.stepSel = '#stepBtn';
    this.resetSel = '#resetBtn';
    this.infoSelector = 'body > div:nth-of-type(1)'; // infoText is inserted before graph-container as first div after h1 in body
    // fallback: select any div that contains "Prim's Algorithm" initial text
  }

  async start() {
    await this.page.click(this.startSel);
  }

  async step() {
    await this.page.click(this.stepSel);
  }

  async reset() {
    await this.page.click(this.resetSel);
  }

  async getInfoText() {
    // The page inserts infoText before graph-container. To be robust, locate the div whose text contains "Prim"
    const handles = await this.page.$$('div');
    for (const h of handles) {
      const txt = (await h.textContent()) || '';
      if (txt.includes("Prim") || txt.includes("Click Start to run")) {
        return txt.trim();
      }
    }
    // fallback to a known place
    const direct = await this.page.locator(this.infoSelector).first();
    return (await direct.textContent())?.trim() ?? '';
  }

  async getButtonStates() {
    const startDisabled = await this.page.getAttribute(this.startSel, 'disabled');
    const stepDisabled = await this.page.getAttribute(this.stepSel, 'disabled');
    const resetDisabled = await this.page.getAttribute(this.resetSel, 'disabled');
    // getAttribute returns null if not present. Interpret as boolean.
    return {
      startDisabled: startDisabled !== null,
      stepDisabled: stepDisabled !== null,
      resetDisabled: resetDisabled !== null
    };
  }
}

test.describe("Prim's Algorithm Visualization - FSM and UI tests", () => {
  let page;
  let prim;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for assertions later
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Collect uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL, { waitUntil: 'load' });
    prim = new PrimPage(page);
  });

  test.afterEach(async () => {
    // close page after each test
    await page.close();
  });

  test('Initial Idle state: buttons and infoText reflect Idle (S0_Idle)', async () => {
    // Validate initial UI state matches FSM S0_Idle evidences
    const info = await prim.getInfoText();
    // FSM evidence expects: "Click Start to run Prim's Algorithm"
    expect(info).toContain("Click Start to run Prim's Algorithm");

    const states = await prim.getButtonStates();
    expect(states.startDisabled).toBe(false); // start enabled
    expect(states.stepDisabled).toBe(true);   // step disabled
    expect(states.resetDisabled).toBe(true);  // reset disabled

    // Ensure no uncaught page errors occurred on initial load
    expect(pageErrors.length).toBe(0);
    // No console errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('StartClicked transitions Idle -> Running (S0 -> S1) and performs onEnter(start)', async () => {
    // Click Start and assert controls updated and initial algorithm step executed
    await prim.start();

    // After start(), startBtn.disabled = true, stepBtn.disabled = false, resetBtn.disabled = false
    const states = await prim.getButtonStates();
    expect(states.startDisabled).toBe(true);
    expect(states.stepDisabled).toBe(false);
    expect(states.resetDisabled).toBe(false);

    // The start() function immediately runs one step (step()), so infoText should reflect first yield action
    const info = await prim.getInfoText();
    // The generator's first yield action is "Add start node and initial edges"
    expect(info).toContain('Add start node and initial edges');

    // Ensure no uncaught page errors occurred during start
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Stepping through algorithm (S1 -> S2 and repeated S2 -> S2) until Completed (S3)', async () => {
    // Start first
    await prim.start();

    // We'll step repeatedly until the page shows the final complete message
    const completedMessage = "Prim's Algorithm completed! Minimum Spanning Tree found.";
    let stepCount = 0;
    const maxSteps = 200; // safety to avoid infinite loop

    while (stepCount < maxSteps) {
      const infoBefore = await prim.getInfoText();

      // If already indicating completed (rare here), break
      if (infoBefore === completedMessage) break;

      // Click Step
      await prim.step();
      stepCount++;

      // After each step, ensure info text changed to something meaningful
      const infoAfter = await prim.getInfoText();
      expect(infoAfter).toBeTruthy();

      // If completed message observed, break loop
      if (infoAfter === completedMessage) break;
    }

    // Ensure we did at least one step
    expect(stepCount).toBeGreaterThan(0);

    // After completion, FSM evidence expects:
    // stepBtn.disabled = true; startBtn.disabled = true; resetBtn.disabled = false;
    const states = await prim.getButtonStates();
    expect(states.stepDisabled).toBe(true);
    expect(states.startDisabled).toBe(true);
    expect(states.resetDisabled).toBe(false);

    // Info text should be the completed message
    const finalInfo = await prim.getInfoText();
    expect(finalInfo).toBe(completedMessage);

    // Ensure no unhandled exceptions occurred during stepping
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('ResetClicked from Running returns to Idle (S1 -> S0)', async () => {
    // Start the algorithm, then reset
    await prim.start();

    // Sanity: ensure running state
    let states = await prim.getButtonStates();
    expect(states.startDisabled).toBe(true);
    expect(states.stepDisabled).toBe(false);

    // Click Reset
    await prim.reset();

    // After reset, expect Idle state: start enabled, step & reset disabled, info text initial
    states = await prim.getButtonStates();
    expect(states.startDisabled).toBe(false);
    expect(states.stepDisabled).toBe(true);
    expect(states.resetDisabled).toBe(true);

    const info = await prim.getInfoText();
    expect(info).toContain("Click Start to run Prim's Algorithm");

    // No page errors from reset
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('ResetClicked from Stepping returns to Idle (S2 -> S0)', async () => {
    // Start, perform a couple of steps, then reset
    await prim.start();
    await prim.step(); // one more step
    await prim.step(); // two steps

    // Ensure we are in some stepping state (step button likely still enabled unless finished)
    let states = await prim.getButtonStates();
    // Regardless of exact, Reset should be enabled after start
    expect(states.resetDisabled).toBe(false);

    // Click Reset
    await prim.reset();

    // Validate Idle state restored
    states = await prim.getButtonStates();
    expect(states.startDisabled).toBe(false);
    expect(states.stepDisabled).toBe(true);
    expect(states.resetDisabled).toBe(true);

    const info = await prim.getInfoText();
    expect(info).toContain("Click Start to run Prim's Algorithm");

    // No page errors from these interactions
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge cases: clicking Step when disabled and clicking Start when disabled should not throw errors', async () => {
    // On Idle, step button is disabled. Attempt to click it.
    // Playwright's click will attempt the click; the page logic should ignore it.
    const infoBefore = await prim.getInfoText();

    // Try clicking disabled Step - should not change state or throw
    await prim.step();
    const infoAfter = await prim.getInfoText();
    // info should remain the same (no change)
    expect(infoAfter).toBe(infoBefore);

    // Now start, then clicking Start again (disabled) should not break anything
    await prim.start();
    const infoRunning = await prim.getInfoText();
    expect(infoRunning).toBeTruthy();

    // Attempt to click disabled Start
    await prim.start(); // clicking disabled start should be no-op
    const infoAfterSecondStart = await prim.getInfoText();
    // Info should still be a valid string and not an error message
    expect(infoAfterSecondStart).toBeTruthy();

    // Ensure no page errors were thrown during these no-op clicks
    // We explicitly assert there were no ReferenceError, SyntaxError, or TypeError page errors.
    const hasCriticalError = pageErrors.some(err => {
      const msg = String(err.message || err);
      return msg.includes('ReferenceError') || msg.includes('SyntaxError') || msg.includes('TypeError');
    });
    expect(hasCriticalError).toBe(false);

    const consoleCritical = consoleMessages.some(m => {
      return /ReferenceError|SyntaxError|TypeError/.test(m.text);
    });
    expect(consoleCritical).toBe(false);
  });

  test('Observe console logs and page errors throughout interactions', async () => {
    // Perform a sequence of interactions and then assert collected console/page errors
    await prim.start();
    // perform a few steps
    for (let i = 0; i < 3; i++) {
      await prim.step();
    }
    // reset
    await prim.reset();

    // At the end, we will validate there are no severe errors reported
    // pageErrors contains Error objects representing uncaught exceptions
    // We assert that no page errors exist
    expect(pageErrors.length).toBe(0);

    // Also ensure console did not emit errors of major JS error types
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    // Prefer zero console errors; if present, fail to surface them
    expect(consoleErrors.length).toBe(0);

    // Additionally assert that no console messages indicate critical JS error names
    const criticalConsole = consoleMessages.find(m => /ReferenceError|SyntaxError|TypeError/.test(m.text));
    expect(criticalConsole).toBeUndefined();
  });
});