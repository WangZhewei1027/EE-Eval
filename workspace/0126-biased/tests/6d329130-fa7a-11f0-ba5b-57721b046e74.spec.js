import { test, expect } from '@playwright/test';

// Test suite for Runtime Environment Simulator
// File: 6d329130-fa7a-11f0-ba5b-57721b046e74.spec.js
// URL: http://127.0.0.1:5500/workspace/0126-biased/html/6d329130-fa7a-11f0-ba5b-57721b046e74.html

// Page object encapsulating common interactions with the simulator UI
class SimulatorPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runBtn = page.locator('button[onclick="runCode()"]');
    this.stepBtn = page.locator('button[onclick="executeStep()"]');
    this.pauseBtn = page.locator('button[onclick="pauseExecution()"]');
    this.stopBtn = page.locator('button[onclick="stopExecution()"]');
    this.setBreakpointBtn = page.locator('button[onclick="setBreakpoint()"]');
    this.clearBreakpointsBtn = page.locator('button[onclick="clearBreakpoints()"]');
    this.inspectBtn = page.locator('button[onclick="inspectVariable()"]');
    this.speedControl = page.locator('input[type="range"][id="speedControl"]');
    this.breakpointLine = page.locator('input[type="number"][id="breakpointLine"]');
    this.inspectVar = page.locator('input[type="text"][id="inspectVar"]');
    this.executionStatus = page.locator('#executionStatus');
    this.codeArea = page.locator('#codeArea');
    this.codePreview = page.locator('#codePreview');
    this.callStack = page.locator('#callStack');
    this.variables = page.locator('#variables');
    this.inspectionResult = page.locator('#inspectionResult');
  }

  async goto(url) {
    await this.page.goto(url);
  }

  async getExecutionStatusText() {
    return (await this.executionStatus.textContent())?.trim();
  }

  async clickRun() {
    await this.runBtn.click();
  }

  async clickStep() {
    await this.stepBtn.click();
  }

  async clickPause() {
    await this.pauseBtn.click();
  }

  async clickStop() {
    await this.stopBtn.click();
  }

  async setSpeed(value) {
    // Set range value and dispatch change event so changeSpeed() runs
    await this.page.evaluate((v) => {
      const el = document.getElementById('speedControl');
      el.value = String(v);
      el.dispatchEvent(new Event('change', { bubbles: true }));
      // call changeSpeed if attached as onchange attribute (the page defines onchange="changeSpeed()")
      if (typeof changeSpeed === 'function') changeSpeed();
    }, value);
  }

  async setBreakpointLineValue(value) {
    await this.breakpointLine.fill(String(value));
  }

  async clickSetBreakpoint() {
    await this.setBreakpointBtn.click();
  }

  async clickClearBreakpoints() {
    await this.clearBreakpointsBtn.click();
  }

  async clickInspect() {
    await this.inspectBtn.click();
  }

  async fillInspectVar(name) {
    await this.inspectVar.fill(name);
  }

  async getVariablesText() {
    return (await this.variables.textContent()) ?? '';
  }

  async getCallStackText() {
    return (await this.callStack.textContent()) ?? '';
  }

  async getInspectionResultText() {
    return (await this.inspectionResult.textContent()) ?? '';
  }

  async codePreviewChildCount() {
    return await this.page.evaluate(() => document.getElementById('codePreview').children.length);
  }

  async codePreviewLineClass(index) {
    return await this.page.evaluate((i) => {
      const el = document.getElementById('codePreview').children[i];
      return el ? el.className : null;
    }, index);
  }

  async runtimeState() {
    return await this.page.evaluate(() => window.runtimeState);
  }
}

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d329130-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('Runtime Environment Simulator - FSM and UI tests', () => {
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console error messages and page errors for assertions
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      // Capture uncaught exceptions from the page
      pageErrors.push(err.message);
    });

    // Navigate to app
    const sim = new SimulatorPage(page);
    await sim.goto(APP_URL);

    // Ensure initial load completed - wait for the primary element to appear
    await expect(sim.executionStatus).toBeVisible();
    // Allow onload init() and autoStep() to run once
    await page.waitForTimeout(50);
  });

  // After each test assert no unexpected runtime/page errors occurred.
  // If errors are present, tests will fail and include the captured messages.
  async function assertNoRuntimeErrors() {
    expect(pageErrors, `Unexpected page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
    expect(consoleErrors, `Unexpected console errors: ${consoleErrors.join(' | ')}`).toHaveLength(0);
  }

  test.describe('States (S0_Stopped, S1_Running, S2_Paused)', () => {
    test('Initial state should be Stopped (S0_Stopped) and visuals reflect it', async ({ page }) => {
      const sim = new SimulatorPage(page);

      // Validate initial execution status is "Stopped" as per FSM S0_Stopped entry evidence
      await expect(sim.executionStatus).toHaveText('Stopped');

      // Call stack and variables should be empty displays on init
      const callStackText = await sim.getCallStackText();
      const variablesText = await sim.getVariablesText();
      expect(callStackText.trim()).toBe('');
      expect(variablesText.trim()).toBe('');

      // codePreview should be populated from init() calling updateVisualization
      const previewCount = await sim.codePreviewChildCount();
      expect(previewCount).toBeGreaterThan(0);

      await assertNoRuntimeErrors();
    });

    test('Running state entry (S1_Running) after clicking Run and visual update', async ({ page }) => {
      const sim = new SimulatorPage(page);

      // Click Run to transition to Running
      await sim.clickRun();

      // The runCode() function sets isRunning = true and calls updateVisualization
      await expect(sim.executionStatus).toHaveText('Running');

      // runtimeState.isRunning should be true
      const state = await sim.runtimeState();
      expect(state.isRunning).toBe(true);

      // When running, codePreview should highlight the current line (index === currentLine)
      const currentIndex = state.currentLine;
      const cls = await sim.codePreviewLineClass(currentIndex);
      // className may include 'current-line' when running
      expect(cls).toBeTruthy();
      expect(cls.split(' ').some(c => c === 'current-line' || c === 'breakpoint' || c === '')).toBeTruthy();

      await assertNoRuntimeErrors();
    });

    test('Pause/Resume toggles between S1_Running and S2_Paused', async ({ page }) => {
      const sim = new SimulatorPage(page);

      // Start running
      await sim.clickRun();
      await expect(sim.executionStatus).toHaveText('Running');

      // Pause
      await sim.clickPause();
      await expect(sim.executionStatus).toHaveText('Paused');

      let state = await sim.runtimeState();
      expect(state.isPaused).toBe(true);

      // Resume
      await sim.clickPause();
      await expect(sim.executionStatus).toHaveText('Running');

      state = await sim.runtimeState();
      expect(state.isPaused).toBe(false);

      await assertNoRuntimeErrors();
    });

    test('Stop transitions to S0_Stopped from Running', async ({ page }) => {
      const sim = new SimulatorPage(page);

      // Start running
      await sim.clickRun();
      await expect(sim.executionStatus).toHaveText('Running');

      // Stop execution
      await sim.clickStop();
      await expect(sim.executionStatus).toHaveText('Stopped');

      const state = await sim.runtimeState();
      expect(state.isRunning).toBe(false);
      expect(state.isPaused).toBe(false);

      await assertNoRuntimeErrors();
    });
  });

  test.describe('Transitions and actions', () => {
    test('ExecuteStep increments currentLine and processes assignments', async ({ page }) => {
      const sim = new SimulatorPage(page);

      // Run to populate executionStack
      await sim.clickRun();
      await expect(sim.executionStatus).toHaveText('Running');

      // Execute step enough times to reach 'const num = 5;' assignment
      // Based on original code with blank lines, the assignment is at index 11 (0-based)
      // To be robust across line counting, we will step repeatedly until variables display shows 'const num'
      let found = false;
      const maxSteps = 20;
      for (let i = 0; i < maxSteps; i++) {
        // Click Step
        await sim.clickStep();
        // Small delay to allow UI update
        await page.waitForTimeout(20);
        const vars = await sim.getVariablesText();
        if (vars.includes('const num')) {
          found = true;
          break;
        }
      }

      expect(found, 'Expected to find variable "const num" after stepping through code').toBe(true);

      // Validate the variable value is 5 as per the sample code processing
      const variablesText = await sim.getVariablesText();
      expect(variablesText).toContain('const num = 5');

      // runtimeState.currentLine should have incremented at least 1
      const state = await sim.runtimeState();
      expect(state.currentLine).toBeGreaterThan(0);

      await assertNoRuntimeErrors();
    });

    test('Set Breakpoint and Clear All Breakpoints update runtimeState and visualization', async ({ page }) => {
      const sim = new SimulatorPage(page);

      // Ensure codePreview exists
      const previewCount = await sim.codePreviewChildCount();
      expect(previewCount).toBeGreaterThan(0);

      // Use a simple index 0 for breakpoint to avoid ambiguity
      await sim.setBreakpointLineValue(0);
      await sim.clickSetBreakpoint();

      // runtimeState should include the breakpoint 0
      let state = await sim.runtimeState();
      expect(Array.isArray(state.breakpoints)).toBe(true);
      expect(state.breakpoints).toContain(0);

      // The first line in codePreview should have class 'breakpoint'
      const cls = await sim.codePreviewLineClass(0);
      expect(cls).toBeTruthy();
      expect(cls.split(' ').some(c => c === 'breakpoint')).toBe(true);

      // Clear breakpoints and verify
      await sim.clickClearBreakpoints();
      state = await sim.runtimeState();
      expect(state.breakpoints).toHaveLength(0);

      // The preview line should no longer have 'breakpoint' class
      const clsAfterClear = await sim.codePreviewLineClass(0);
      expect(clsAfterClear).not.toContain('breakpoint');

      await assertNoRuntimeErrors();
    });

    test('Inspect variable shows correct value after execution step', async ({ page }) => {
      const sim = new SimulatorPage(page);

      // Run and step until variable exists (as before)
      await sim.clickRun();
      let found = false;
      for (let i = 0; i < 20; i++) {
        await sim.clickStep();
        await page.waitForTimeout(20);
        const vars = await sim.getVariablesText();
        if (vars.includes('const num')) {
          found = true;
          break;
        }
      }
      expect(found).toBe(true);

      // Inspect the variable named exactly as stored 'const num'
      await sim.fillInspectVar('const num');
      await sim.clickInspect();

      // The inspection result should show the variable value
      const inspectionText = await sim.getInspectionResultText();
      expect(inspectionText).toContain('const num = 5');

      await assertNoRuntimeErrors();
    });

    test('ChangeSpeed updates runtimeState.executionSpeed', async ({ page }) => {
      const sim = new SimulatorPage(page);

      // Change the speed to 7 and assert the runtime state reflects it
      await sim.setSpeed(7);

      const state = await sim.runtimeState();
      expect(state.executionSpeed).toBe(7);

      await assertNoRuntimeErrors();
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Invalid breakpoint input is ignored (no crash, no breakpoint added)', async ({ page }) => {
      const sim = new SimulatorPage(page);

      // Ensure no breakpoints to start
      await sim.clickClearBreakpoints();
      let state = await sim.runtimeState();
      expect(state.breakpoints).toHaveLength(0);

      // Input invalid non-number
      await sim.setBreakpointLineValue('abc');
      await sim.clickSetBreakpoint();

      // Breakpoints should still be empty
      state = await sim.runtimeState();
      expect(state.breakpoints).toHaveLength(0);

      await assertNoRuntimeErrors();
    });

    test('Click Step when executionStack is empty should not throw and leaves isRunning false', async ({ page }) => {
      const sim = new SimulatorPage(page);

      // Ensure initial state where executionStack is empty (before Run)
      const stateBefore = await sim.runtimeState();
      // executionStack may be empty if sample code is initialized into codeArea but not executionStack
      // Confirm executionStack is an array
      expect(Array.isArray(stateBefore.executionStack)).toBe(true);

      // Click Step directly
      await sim.clickStep();
      // Small delay to allow internal logic to run
      await page.waitForTimeout(20);

      // runtimeState.isRunning should be false (executeStep sets isRunning=false if currentLine >= executionStack.length)
      const stateAfter = await sim.runtimeState();
      expect(stateAfter.isRunning).toBe(false);

      await assertNoRuntimeErrors();
    });

    test('Observe and assert no unexpected runtime/page errors occurred during interactions', async ({ page }) => {
      // This test simply validates that throughout normal interactions there are no uncaught errors.
      const sim = new SimulatorPage(page);

      // Perform a variety of interactions quickly
      await sim.clickRun();
      await sim.setSpeed(5);
      await sim.clickPause();
      await sim.clickPause();
      await sim.clickStep();
      await sim.fillInspectVar('const num');
      await sim.clickInspect();
      await sim.setBreakpointLineValue(0);
      await sim.clickSetBreakpoint();
      await sim.clickClearBreakpoints();
      await sim.clickStop();

      // Allow any pending asynchronous page activity to run
      await page.waitForTimeout(200);

      // Assert globals and UI reflect a coherent state
      const state = await sim.runtimeState();
      expect(state).toHaveProperty('executionStack');
      expect(state).toHaveProperty('variables');
      expect(['Running', 'Paused', 'Stopped']).toContain(await sim.getExecutionStatusText());

      // Finally assert there were no runtime errors collected
      await assertNoRuntimeErrors();
    });
  });
});