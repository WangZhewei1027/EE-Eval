import { test, expect } from '@playwright/test';

test.describe('Interactive Interpreter (6d324310-fa7a-11f0-ba5b-57721b046e74)', () => {
  // URL for the HTML implementation under test
  const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d324310-fa7a-11f0-ba5b-57721b046e74.html';

  // Shared state for collecting page errors and console messages
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err.message || String(err));
    });

    // Collect console messages (info/debug/warn/error)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Ensure there were no uncaught page errors during the test
    expect(pageErrors, `Uncaught page errors: ${pageErrors.join('\n')}`).toEqual([]);

    // Ensure there were no console.error messages emitted
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors, `Console errors: ${errors.map(e => e.text).join('\n')}`).toEqual([]);
  });

  test.describe('State: Idle (S0_Idle)', () => {
    test('Initial state should render welcome text and default interpreter state', async ({ page }) => {
      // Validate that the page shows the expected idle message on load
      const output = await page.locator('#output').innerText();
      expect(output.trim()).toBe('Interpreter ready. Enter code to begin.');

      // Validate interpreterState exists and has expected defaults
      const interp = await page.evaluate(() => {
        return {
          exists: typeof interpreterState !== 'undefined',
          executionPaused: interpreterState.executionPaused,
          executionSpeed: interpreterState.executionSpeed,
          stepIndex: interpreterState.stepIndex,
          maxSteps: interpreterState.maxSteps
        };
      });

      expect(interp.exists).toBe(true);
      expect(interp.executionPaused).toBe(false);
      expect(interp.executionSpeed).toBe(100);
      expect(interp.stepIndex).toBe(0);
      expect(interp.maxSteps).toBe(100);
    });
  });

  test.describe('Events and Transitions', () => {
    test('ExecuteCode: executing multi-line code transitions to Code Executed (S1_CodeExecuted)', async ({ page }) => {
      // Prepare code that assigns and computes a final result
      const code = 'a = 2\nb = a + 3';
      await page.locator('#codeInput').fill(code);
      await page.locator("button[onclick='executeCode()']").click();

      // Expect output to eventually include ">> 5"
      const out = await page.locator('#output').innerText();
      expect(out).toContain('>> 5');

      // Validate interpreterState variables are set
      const vars = await page.evaluate(() => ({ ...interpreterState.variables }));
      expect(vars.a).toBe(2);
      expect(vars.b).toBe(5);
    });

    test('ClearCode: clears code input and output back to empty (S0_Idle)', async ({ page }) => {
      await page.locator('#codeInput').fill('temporary = 1');
      await page.locator('#output').fill?.('This will be cleared'); // defensive: fill may not exist for div
      // Click Clear
      await page.locator("button[onclick='clearCode()']").click();

      // Input should be empty
      const codeVal = await page.locator('#codeInput').inputValue();
      expect(codeVal).toBe('');

      // Output should be empty string
      const out = await page.locator('#output').innerText();
      expect(out).toBe('');
    });

    test('StepThrough: stepping through code executes statements one by one', async ({ page }) => {
      // Prepare code
      const code = 'x = 1\ny = x + 4';
      await page.locator('#codeInput').fill(code);

      // First step
      await page.locator("button[onclick='stepThrough()']").click();
      let out = await page.locator('#output').innerText();
      expect(out).toContain('Step 1: Executing Assignment');
      expect(out).toContain('x');
      expect(out).toContain('→ 1');

      // Second step
      await page.locator("button[onclick='stepThrough()']").click();
      out = await page.locator('#output').innerText();
      expect(out).toContain('Step 2: Executing Assignment');
      expect(out).toContain('→ 5');

      // Third step should say execution complete
      await page.locator("button[onclick='stepThrough()']").click();
      out = await page.locator('#output').innerText();
      expect(out).toContain('Execution complete');

      // Verify stepIndex advanced to length
      const stepIdx = await page.evaluate(() => interpreterState.stepIndex);
      expect(stepIdx).toBeGreaterThanOrEqual(2);
    });

    test('ShowAST and ShowSymbols require AST/symbols and display them', async ({ page }) => {
      // Clear and set a simple code, then execute to build AST and symbol table
      await page.locator('#codeInput').fill('m = 3\nn = m * 2');
      await page.locator("button[onclick='executeCode()']").click();

      // Show AST
      await page.locator("button[onclick='showAST()']").click();
      let out = await page.locator('#output').innerText();
      expect(out).toContain('Abstract Syntax Tree:');
      expect(out).toContain('"type": "Program"');

      // Show Symbol Table
      await page.locator("button[onclick='showSymbolTable()']").click();
      out = await page.locator('#output').innerText();
      expect(out).toContain('Symbol Table:');
      expect(out).toContain('"m"');
      expect(out).toContain('"n"');
    });

    test('PauseExecution and ResumeExecution toggle executionPaused and produce expected output (S2_ExecutionPaused -> S3_ExecutionResumed)', async ({ page }) => {
      // Prepare code that will be executed on resume
      await page.locator('#codeInput').fill('p = 7\nq = p + 1');

      // Execute once to ensure AST/state exist
      await page.locator("button[onclick='executeCode()']").click();

      // Pause execution: should set executionPaused = true and append message
      await page.locator("button[onclick='pauseExecution()']").click();
      let out = await page.locator('#output').innerText();
      expect(out).toContain('Execution paused');
      let paused = await page.evaluate(() => interpreterState.executionPaused);
      expect(paused).toBe(true);

      // Now Resume: it appends "Resuming execution" and calls executeCode()
      // Ensure code input is non-empty so resume executes something
      await page.locator("button[onclick='resumeExecution()']").click();
      out = await page.locator('#output').innerText();
      expect(out).toContain('Resuming execution');
      paused = await page.evaluate(() => interpreterState.executionPaused);
      expect(paused).toBe(false);

      // After resume's executeCode(), result should be appended (final expr result)
      expect(out).toMatch(/>>\s*\d+/);
    });

    test('ResetInterpreter returns interpreter to initial state and updates output', async ({ page }) => {
      // Create some state
      await page.locator('#codeInput').fill('r = 9');
      await page.locator("button[onclick='executeCode()']").click();

      // Reset
      await page.locator("button[onclick='resetInterpreter()']").click();
      const out = await page.locator('#output').innerText();
      expect(out.trim()).toBe('Interpreter reset');

      // interpreterState should be reset
      const interp = await page.evaluate(() => interpreterState);
      expect(interp.variables).toEqual({});
      expect(interp.stepIndex).toBe(0);
      expect(interp.executionPaused).toBe(false);
    });

    test('InspectVariable, WatchVariable, UnwatchVariable update inspector and watched table', async ({ page }) => {
      // Set a variable
      await page.locator('#codeInput').fill('alpha = 42');
      await page.locator("button[onclick='executeCode()']").click();

      // Inspect
      await page.locator('#varName').fill('alpha');
      await page.locator("button[onclick='inspectVariable()']").click();
      let varVal = await page.locator('#variableValue').innerText();
      expect(varVal).toContain('alpha = 42');

      // Watch variable
      await page.locator("button[onclick='watchVariable()']").click();
      // Watched vars table should have a row for 'alpha'
      const rows = await page.locator('#watchedVars tbody tr').allTextContents();
      expect(rows.length).toBeGreaterThanOrEqual(1);
      const firstRow = rows[0].replace(/\s+/g, ' ');
      expect(firstRow).toContain('alpha');
      expect(firstRow).toContain('42');
      expect(firstRow).toContain('number');

      // Unwatch variable
      await page.locator("button[onclick='unwatchVariable()']").click();
      const rowsAfter = await page.locator('#watchedVars tbody tr').count();
      expect(rowsAfter).toBe(0);
    });

    test('ShowEnvironment, SaveEnvironment, LoadEnvironment persist and restore environment (S5_EnvironmentSaved -> S4_EnvironmentLoaded)', async ({ page }) => {
      // Ensure localStorage is clean
      await page.evaluate(() => localStorage.removeItem('interpreterEnvironment'));

      // Create some state and save it
      await page.locator('#codeInput').fill('sav = 77');
      await page.locator("button[onclick='executeCode()']").click();
      await page.locator("button[onclick='saveEnvironment()']").click();

      // Output should mention saved
      let out = await page.locator('#output').innerText();
      expect(out).toContain('Environment saved');

      // Confirm localStorage has the entry
      const stored = await page.evaluate(() => localStorage.getItem('interpreterEnvironment'));
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored);
      expect(parsed.variables.sav).toBe(77);

      // Reset interpreter to clear in-memory variables
      await page.locator("button[onclick='resetInterpreter()']").click();

      // Load environment
      await page.locator("button[onclick='loadEnvironment()']").click();
      out = await page.locator('#output').innerText();
      expect(out).toContain('Environment loaded');

      // Ensure variable restored
      const vars = await page.evaluate(() => ({ ...interpreterState.variables }));
      expect(vars.sav).toBe(77);

      // Show environment UI should display variables and functions JSON
      await page.locator("button[onclick='showEnvironment()']").click();
      const envHtml = await page.locator('#environmentInfo').innerText();
      expect(envHtml).toContain('Current Environment');
      expect(envHtml).toContain('"sav": 77');
    });

    test('UpdateSpeed slider changes executionSpeed and updates UI representation', async ({ page }) => {
      // Programmatically set the slider to a new value and dispatch change event
      await page.evaluate(() => {
        const slider = document.getElementById('execSpeed');
        slider.value = '250';
        slider.dispatchEvent(new Event('change', { bubbles: true }));
      });

      // Validate interpreterState.executionSpeed updated
      const speed = await page.evaluate(() => interpreterState.executionSpeed);
      expect(speed).toBe(250);

      // Validate displayed speedValue text updated
      const display = await page.locator('#speedValue').innerText();
      expect(display).toBe('250ms');
    });

    test('MaxSteps input change does not throw and updates DOM value (edge case, no handler)', async ({ page }) => {
      // Change the number input value
      await page.locator("input[type='number'][id='maxSteps']").fill('250');
      // The application does not listen to input event; ensure no errors and DOM reflects value
      const val = await page.locator('#maxSteps').inputValue();
      expect(val).toBe('250');
    });

    test('Edge case: executing empty code produces friendly message and no uncaught errors', async ({ page }) => {
      // Clear any code
      await page.locator('#codeInput').fill('');
      await page.locator("button[onclick='executeCode()']").click();

      const out = await page.locator('#output').innerText();
      expect(out).toBe('No code to execute');
    });

    test('Error scenario: referencing undefined variable produces an error message in output (S1_CodeExecuted with error evidence)', async ({ page }) => {
      // Write code that references an undefined identifier
      await page.locator('#codeInput').fill('z = a + 1'); // 'a' undefined
      await page.locator("button[onclick='executeCode()']").click();

      const out = await page.locator('#output').innerText();
      // Should append an Error message mentioning Undefined variable: a
      expect(out).toContain('Error: Undefined variable: a');
    });
  });
});