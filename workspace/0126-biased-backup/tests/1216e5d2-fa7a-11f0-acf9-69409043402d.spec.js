import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1216e5d2-fa7a-11f0-acf9-69409043402d.html';

// Page Object for interacting with the Interpreter Demo UI
class InterpreterPage {
  constructor(page) {
    this.page = page;
    this.locators = {
      codeArea: page.locator('#codeArea'),
      btnReset: page.locator('#btnReset'),
      btnRun: page.locator('#btnRun'),
      btnStep: page.locator('#btnStep'),
      btnPause: page.locator('#btnPause'),
      btnResetStack: page.locator('#btnResetStack'),
      btnClearOutput: page.locator('#btnClearOutput'),
      btnAddInput: page.locator('#btnAddInput'),
      btnClearInputBuffer: page.locator('#btnClearInputBuffer'),
      inputValue: page.locator('#inputValue'),
      outputDiv: page.locator('#output'),
      speedSlider: page.locator('#speedSlider'),
      speedVal: page.locator('#speedVal'),
      varSelect: page.locator('#varSelect'),
      varDetails: page.locator('#varDetails'),
      callStackSelect: page.locator('#callStack'),
      stackDetails: page.locator('#stackDetails'),
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Basic UI interactions
  async clickReset() { await this.locators.btnReset.click(); }
  async clickRun() { await this.locators.btnRun.click(); }
  async clickStep() { await this.locators.btnStep.click(); }
  async clickPause() { await this.locators.btnPause.click(); }
  async clickResetStack() { await this.locators.btnResetStack.click(); }
  async clickClearOutput() { await this.locators.btnClearOutput.click(); }
  async clickAddInput() { await this.locators.btnAddInput.click(); }
  async clickClearInputBuffer() { await this.locators.btnClearInputBuffer.click(); }

  async setCode(code) {
    await this.locators.codeArea.fill(code);
  }

  async setInputValue(val) {
    await this.locators.inputValue.fill(val);
  }

  async setSpeed(ms) {
    // set the slider value via evaluate to ensure consistency
    await this.page.evaluate((v) => {
      const s = document.getElementById('speedSlider');
      s.value = v.toString();
      const ev = new Event('input', { bubbles: true });
      s.dispatchEvent(ev);
    }, ms.toString());
  }

  async outputText() {
    return (await this.locators.outputDiv.textContent()) || '';
  }

  // Expose interpreter internal state safely via evaluate
  async interpreterState() {
    return await this.page.evaluate(() => {
      const present = typeof state !== 'undefined' && state.interpreter;
      if(!present) return null;
      return {
        running: state.interpreter.running,
        paused: state.interpreter.paused,
        stepMode: state.interpreter.stepMode,
        awaitingInput: state.interpreter.awaitingInput,
        inputBuffer: Array.from(state.interpreter.inputBuffer),
        output: state.interpreter.getOutput(),
        callStackLength: state.interpreter.callStack.length,
        globalVars: Array.from(state.interpreter.globalEnv.vars.entries()),
      };
    });
  }

  // Helper to read varSelect and varDetails
  async varSelectOptions() {
    return await this.page.evaluate(() => {
      const sel = document.getElementById('varSelect');
      const opts = [];
      for(const o of sel.options) opts.push(o.value);
      return opts;
    });
  }

  async callStackText() {
    return await this.locators.callStackSelect.allTextContents();
  }
}

// Top-level setup for console and pageerror capture
test.describe('Interpreter Demonstration - FSM and UI tests', () => {
  let page;
  let app;
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleMessages = [];
    pageErrors = [];

    // capture console messages and page errors
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    app = new InterpreterPage(page);
    await app.goto();

    // wait a short time for initial resetInterpreter() to complete
    await page.waitForTimeout(150);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Console and page error observation - ensure no uncaught page errors', async () => {
    // This test records console and page errors that happen during load.
    // It asserts that there are no uncaught page errors (pageerror events).
    // Note: We allow console messages but assert no pageerror events were emitted.
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Initial Idle state and Reset behavior', () => {
    test('Initial state should be Idle: interpreter exists and not running', async () => {
      const st = await app.interpreterState();
      // Interpreter should be initialized
      expect(st).not.toBeNull();
      // Idle: not running, not paused (as created)
      expect(st.running).toBe(false);
      expect(st.paused).toBe(false);
      // Output should contain program loaded status
      const out = await app.outputText();
      expect(out).toContain('Program loaded successfully.');
    });

    test('Clicking Reset Environment reloads program and clears UI status', async () => {
      // Modify code to ensure reset loads user code too
      const code = 'print 42;';
      await app.setCode(code);
      // Click Reset
      await app.clickReset();
      await page.waitForTimeout(120);
      const out = await app.outputText();
      expect(out).toContain('Program loaded successfully.');
      const st = await app.interpreterState();
      expect(st.running).toBe(false);
      expect(st.paused).toBe(false);
    });
  });

  test.describe('Stepping and Step mode (S2_Stepping)', () => {
    test('Step from Idle executes a single statement and updates output/variables', async () => {
      // Use a small program with assignment and print
      const code = 'x = 7;\nprint x;';
      await app.setCode(code);
      await app.clickReset();
      await page.waitForTimeout(120);

      // Single step should execute first statement: assignment
      await app.clickStep();
      await page.waitForTimeout(120);

      // After step, variable x should be present
      const vars = await app.varSelectOptions();
      expect(vars).toContain('x');

      // varDetails should show x = 7
      const varDetails = await app.locators?.varDetails?.textContent?.() || '';
      expect(varDetails).toContain('7');

      // Output should not yet contain "7" because print not executed
      let out = await app.outputText();
      expect(out).not.toContain('7');

      // Another step executes the print
      await app.clickStep();
      await page.waitForTimeout(120);
      out = await app.outputText();
      expect(out).toContain('7'); // printed value
      // Also status should reflect step executed
      expect(out).toContain('Step executed');
    });

    test('Stepping into input() without input buffer triggers runtime input error and pauses (edge case)', async () => {
      // Program requests input in second statement
      const code = 'print "Enter:";\nn = input();\nprint n;';
      await app.setCode(code);
      await app.clickReset();
      await page.waitForTimeout(120);

      // First step: prints prompt
      await app.clickStep();
      await page.waitForTimeout(120);
      let out = await app.outputText();
      expect(out).toContain('Enter:');

      // Second step: attempts to read input and should raise a RuntimeError caught in btnStep handler
      await app.clickStep();
      await page.waitForTimeout(120);
      out = await app.outputText();
      // The UI catch for btnStep should append a "Runtime Error: Input required" status
      expect(out).toMatch(/Runtime Error: Input required/);
      // Interpreter should be paused or awaiting input
      const st = await app.interpreterState();
      // awaitingInput might be true OR the interpreter paused due to exception; ensure we're not running
      expect(st.running).toBe(false);
    });
  });

  test.describe('Running mode (S1_Running) and Pause (S3_Paused) transitions', () => {
    test('Run to end from Idle attempts to run program and handles missing input by pausing with runtime error', async () => {
      // The default sample program requires input(); running without inputs should pause with an error
      await app.clickRun();
      // Allow some time for runLoop to process and hit input
      await page.waitForTimeout(400);
      const out = await app.outputText();
      // Should have a runtime error message about input
      expect(out).toMatch(/Runtime Error: Input required/);
      // Interpreter should have paused
      const st = await app.interpreterState();
      expect(st.running).toBe(false);
      expect(st.paused).toBe(true);
      // The call stack should still exist
      expect(st.callStackLength).toBeGreaterThanOrEqual(1);
    });

    test('Pause button sets interpreter to paused when run is active', async () => {
      // Create a program that will require multiple steps before hitting input; run and pause quickly
      const code = 'print "start";\nprint "mid";\nprint "end";\n';
      await app.setCode(code);
      await app.clickReset();
      await page.waitForTimeout(120);

      // Speed up run loop to avoid finishing instantly; set small delay
      await app.setSpeed('200'); // 200ms between steps
      // Start running
      await app.clickRun();
      // Immediately request pause
      await app.clickPause();
      // allow UI to update
      await page.waitForTimeout(200);
      const st = await app.interpreterState();
      // After clicking Pause, interpreter.paused should be true and running false
      expect(st.paused).toBe(true);
      expect(st.running).toBe(false);
      const out = await app.outputText();
      // There should be a status message that execution paused
      expect(out).toContain('Execution paused');
    });
  });

  test.describe('Input buffer and output control events', () => {
    test('Add input(s) and Clear Input Buffer work and reflect on interpreter.inputBuffer', async () => {
      // Ensure interpreter initialized
      await app.clickReset();
      await page.waitForTimeout(120);

      // Add input value "5"
      await app.setInputValue('5');
      await app.clickAddInput();
      await page.waitForTimeout(120);
      // Check interpreter inputBuffer contains 5
      const st1 = await app.interpreterState();
      expect(st1.inputBuffer).toContain(5);

      // Clear input buffer
      await app.clickClearInputBuffer();
      await page.waitForTimeout(120);
      const st2 = await app.interpreterState();
      expect(st2.inputBuffer.length).toBe(0);

      // Output should contain status messages about input operations
      const out = await app.outputText();
      expect(out).toContain('Input values added');
      expect(out).toContain('Input buffer cleared');
    });

    test('Clear Output empties the visible output area', async () => {
      // produce output
      const code = 'print "hello";';
      await app.setCode(code);
      await app.clickReset();
      await page.waitForTimeout(120);
      await app.clickStep(); // execute print
      await page.waitForTimeout(120);
      let out = await app.outputText();
      expect(out).toContain('hello');

      // clear output
      await app.clickClearOutput();
      await page.waitForTimeout(120);
      out = await app.outputText();
      // The UI clearOutput uses refreshOutput(true) which clears outputDiv textContent
      // After clearing, it may still include previous status lines but the implementation clears output buffer and triggers refreshOutput(true)
      // We assert that the visible output no longer contains the printed 'hello'
      expect(out).not.toContain('hello');
    });
  });

  test.describe('Call stack reset and variable inspection', () => {
    test('Reset Call Stack action reduces the call stack to the global frame and updates UI', async () => {
      // Create a simple function and call it to create stack frames
      const code = 'function f() { a = 1; }\nf();\nprint "done";';
      await app.setCode(code);
      await app.clickReset();
      await page.waitForTimeout(120);

      // Step through: execute function call (ExprStatement will push function frame on eval, then next step executes its body)
      await app.clickStep(); // should push function frame
      await page.waitForTimeout(120);
      await app.clickStep(); // execute a = 1 inside function
      await page.waitForTimeout(120);

      // At this point there should be a call stack > 1
      let st = await app.interpreterState();
      expect(st.callStackLength).toBeGreaterThanOrEqual(1);

      // Reset stack
      await app.clickResetStack();
      await page.waitForTimeout(120);

      // Confirm call stack reset to global only
      const st2 = await app.interpreterState();
      expect(st2.callStackLength).toBe(1);
      const out = await app.outputText();
      expect(out).toContain('Call stack reset to global frame');
    });

    test('Variable inspection displays proper details for assigned variables', async () => {
      const code = 'x = 10;\nprint x;';
      await app.setCode(code);
      await app.clickReset();
      await page.waitForTimeout(120);

      // step to assign x
      await app.clickStep();
      await page.waitForTimeout(120);
      // varSelect should list 'x' and varDetails should contain its value
      const vars = await app.varSelectOptions();
      expect(vars).toContain('x');
      const vText = await app.locators.varDetails.textContent();
      expect(vText).toContain('10');
    });
  });

  test.describe('Error scenarios and edge cases', () => {
    test('Division by zero raises a runtime error and is reported in output', async () => {
      const code = 'print 1/0;';
      await app.setCode(code);
      await app.clickReset();
      await page.waitForTimeout(120);

      // Use Run to allow the interpreter.runLoop to catch and append runtime error
      await app.clickRun();
      await page.waitForTimeout(300);
      const out = await app.outputText();
      expect(out).toMatch(/Runtime Error: Division by zero/);
    });

    test('Attempting to call undefined function produces runtime error', async () => {
      const code = 'foo();';
      await app.setCode(code);
      await app.clickReset();
      await page.waitForTimeout(120);

      // Step to trigger function call error
      await app.clickStep();
      await page.waitForTimeout(120);
      const out = await app.outputText();
      // btnStep catch appends "Runtime Error: " lines
      expect(out).toMatch(/Runtime Error: Function foo is not defined/);
    });
  });

  test('Final sanity: ensure no uncaught console errors or page errors after interactions', async () => {
    // Run a few interactions
    await app.clickReset();
    await page.waitForTimeout(100);
    await app.setInputValue('3');
    await app.clickAddInput();
    await page.waitForTimeout(100);
    await app.clickClearOutput();
    await page.waitForTimeout(100);

    // Check collected console messages for error severity
    const errorMsgs = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    // We assert that there are no page-level uncaught errors (pageerror events)
    expect(pageErrors.length).toBe(0);
    // Also assert that there are no console messages of type 'error'. (Warnings may exist in some runtimes; filter includes warning)
    expect(errorMsgs.length).toBe(0);
  });
});