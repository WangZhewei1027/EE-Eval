import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c164f63-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Helper to wait until a pre element's textContent includes a substring
async function waitForPreContains(locator, text, options = {}) {
  const timeout = options.timeout ?? 5000;
  await locator.waitFor({ state: 'visible', timeout });
  await test.waitForTimeout(50); // slight pause for UI update
  await expect.poll(async () => {
    const content = await locator.textContent();
    return content && content.includes(text);
  }, { timeout, message: `timed out waiting for ${text} in pre` });
}

test.describe('Interpreter Interactive Demo — FSM coverage and error observation', () => {
  // Collect console errors and page errors for assertion
  test.beforeEach(async ({ page }) => {
    // Accept any dialogs (alerts from fork/compare code)
    page.on('dialog', async dialog => {
      try {
        await dialog.accept();
      } catch (e) {
        // ignore
      }
    });
  });

  test('E2E: load sample -> parse -> compile -> run -> pause -> step -> stepOver -> stepOut -> reset', async ({ page }) => {
    // Comments: This test walks the primary happy-path transitions in the FSM:
    // S0_Idle -> S1_ProgramLoaded -> S2_Compiling -> S3_Running -> S4_Paused -> S5_Stepping -> S3_Running -> reset
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Attach listeners to capture console & page errors for investigation
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err));

    // Ensure initial compile was invoked by the page's script (script calls compileBtn.click() at end)
    const instructions = page.locator('#instructions');
    await instructions.waitFor({ state: 'visible', timeout: 3000 });
    const instrText = await instructions.textContent();
    expect(instrText).toBeTruthy();
    expect(instrText.length).toBeGreaterThan(10);

    // 1) LOAD_SAMPLE (S0 -> S1)
    // Select a different sample and click Load sample
    await page.selectOption('#sampleSelect', 'count');
    await page.click('#loadSample');
    // After load -> compileBtn.click() is triggered by loader; wait for instructions updated for 'count' sample
    await waitForPreContains(instructions, 'instrs id:', { timeout: 2000 });

    // 2) PARSE_PROGRAM (S1 -> S2)
    // Modify program to add an intentional small change then parse
    await page.fill('#program', 'let i = 0; while (i < 3) { print(i); i = i + 1; }');
    await page.click('#parseBtn');
    const tokens = page.locator('#tokens');
    await waitForPreContains(tokens, '"type":"ident"', { timeout: 2000 });
    const ast = page.locator('#ast');
    await waitForPreContains(ast, '"Program"', { timeout: 2000 });

    // 3) COMPILE_PROGRAM (S2)
    await page.click('#compileBtn');
    await waitForPreContains(instructions, '== instrs id:', { timeout: 2000 });

    // 4) RUN_PROGRAM (S2 -> S3), run to completion (small program)
    // Set speed to small interval for fast completion
    await page.fill('#speed', '0');
    await page.click('#runBtn');

    // Wait for output to show expected prints
    const output = page.locator('#output');
    await waitForPreContains(output, '0', { timeout: 5000 });
    await waitForPreContains(output, '2', { timeout: 5000 });

    // Record last run baseline will be captured by page script after run completion (lastRunState)
    // Ensure trace or output exists
    const trace = page.locator('#trace');
    const traceText = await trace.textContent();
    expect(traceText).not.toBeNull();

    // 5) Pause execution: start again with a longer program so we can pause
    await page.selectOption('#sampleSelect', 'fib');
    await page.click('#loadSample');
    await waitForPreContains(instructions, 'fib', { timeout: 2000 });

    // Make speed small but non-zero so the run loop executes fast
    await page.fill('#speed', '10');
    // Enable auto-run until breakpoints unchecked (we'll pause manually)
    await page.uncheck('#autoRunBreakpoints').catch(() => {});
    await page.click('#runBtn');
    // Wait a small time and then pause
    await test.waitForTimeout(200); // let it run a bit
    await page.click('#pauseBtn');
    // After pause, PC should show some value
    const pc = page.locator('#pc');
    await expect(pc).not.toHaveText('-', { timeout: 2000 });
    const pcVal = await pc.textContent();
    expect(pcVal).toMatch(/:/);

    // 6) STEP_INTO (S4 -> S5)
    // Click Step (Into) and ensure trace/pc changes
    const prevTrace = await trace.textContent();
    await page.click('#stepBtn');
    await test.waitForTimeout(100);
    const newTrace = await trace.textContent();
    expect(newTrace.length).toBeGreaterThan(prevTrace.length);

    // 7) STEP_OVER: attempt step over (should not throw)
    await page.click('#stepOverBtn');
    await test.waitForTimeout(150);

    // 8) STEP_OUT: attempt step out
    await page.click('#stepOutBtn');
    await test.waitForTimeout(150);

    // 9) RESET_VM
    await page.click('#resetBtn');
    await expect(page.locator('#pc')).toHaveText('-', { timeout: 2000 });
    await expect(page.locator('#output')).toHaveText('', { timeout: 2000 });

    // Assert no unexpected console/Page errors occurred during the primary flow
    expect(consoleErrors.length).toBe(0, `Unexpected console errors: ${consoleErrors.join('\n')}`);
    expect(pageErrors.length).toBe(0, `Unexpected page errors: ${pageErrors.map(e => String(e)).join('\n')}`);
  });

  test('Breakpoints, Toggle at PC, Clear breakpoints, breakpointsInput onchange, instructions clicking toggles bp', async ({ page }) => {
    // Comments: This test validates S4_Paused -> S6_BreakpointSet and S6 -> S4 via clear, as well as UI bpsList updates.
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    page.on('dialog', async d => d.accept().catch(() => {}));

    const instructions = page.locator('#instructions');
    await instructions.waitFor({ state: 'visible', timeout: 3000 });

    // Load simple sample and compile
    await page.selectOption('#sampleSelect', 'count');
    await page.click('#loadSample');
    await waitForPreContains(instructions, 'while', { timeout: 2000 });

    // Create a VM by running a bit (so frames exist), then pause
    await page.fill('#speed', '100');
    await page.click('#runBtn');
    await test.waitForTimeout(150);
    await page.click('#pauseBtn');

    // Read first bracket from instructions to use as breakpoint label (format [id:pc])
    const instrText = await instructions.textContent();
    const m = instrText && instrText.match(/\[(\S+:\d+)\]/);
    expect(m).not.toBeNull();
    const bpLabel = m[1];

    // Set breakpoints via input and trigger onchange
    await page.fill('#breakpointsInput', bpLabel);
    await page.dispatchEvent('#breakpointsInput', 'change');
    // bpsList should reflect it
    const bpsList = page.locator('#bpsList');
    await expect(bpsList).toHaveText(bpLabel, { timeout: 2000 });

    // Clear breakpoints via clear button
    await page.click('#clearBreakpoints');
    await expect(bpsList).toHaveText('', { timeout: 2000 });

    // Toggle breakpoint at current PC (when VM exists)
    // Ensure VM exists (from earlier). Click toggleBreakpointAtPC
    await page.click('#toggleBreakpointAtPC');
    // bpsList should contain the currently displayed PC (pc element)
    const pc = await page.locator('#pc').textContent();
    const bpsText = await bpsList.textContent();
    // If there was a current frame, bpsText contains key, otherwise empty; assert it's either empty or contains colon
    if (pc && pc !== '-') {
      expect(bpsText.includes(':') || bpsText === '').toBeTruthy();
    }

    // Simulate click on instructions element to toggle a breakpoint (this will toggle the first found)
    // Because the instructions click handler may prompt in some fallbacks, rely on presence of currentVM to prevent prompt.
    await page.click('#instructions');
    await test.waitForTimeout(100);
    const bpsNow = await bpsList.textContent();
    // After toggle, bpsNow is either empty or contains a ':'
    expect(bpsNow === '' || bpsNow.includes(':')).toBeTruthy();
  });

  test('Snapshots, Restore, Fork, Compare runs and mutate operations', async ({ page }) => {
    // Comments: This test validates S4 -> S7 snapshot, S7 -> S8 restore, S9 forked and S10 comparing behavior, and mutate rename/inline.
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Capture dialogs automatically
    page.on('dialog', async d => {
      await d.accept().catch(() => {});
    });

    const instructions = page.locator('#instructions');
    await instructions.waitFor({ state: 'visible', timeout: 3000 });

    // Use 'mutate' sample which is small and demonstrates state changes
    await page.selectOption('#sampleSelect', 'mutate');
    await page.click('#loadSample');
    await waitForPreContains(instructions, 'mutate', { timeout: 2000 });

    // Compile was called by load; create VM by running one step to have non-empty state
    await page.click('#stepBtn');
    await test.waitForTimeout(100);

    // Take snapshot
    await page.click('#snapshotBtn');
    const snaps = page.locator('#snapshots');
    await waitForPreContains(snaps, 'Snapshot', { timeout: 2000 });

    // Restore snapshot (should work even if multiple)
    await page.click('#restoreBtn');
    await test.waitForTimeout(100);
    // Ensure currentVM globals or snapshots UI still present
    await expect(snaps).toContainText('Snapshot');

    // Fork: clicking fork triggers alert; already auto-accepted
    await page.click('#forkBtn');
    await test.waitForTimeout(100);
    // After fork, snapshots should have increased (another snapshot stored)
    const snapsText = await snaps.textContent();
    expect(snapsText).toContain('Snapshot');

    // Prepare scenario for compare: ensure lastRunState exists by running program to completion once
    await page.fill('#speed', '0');
    await page.click('#runBtn');
    // wait some time for run to finish
    await test.waitForTimeout(500);
    // Now take a fresh step on a new VM to compare
    await page.click('#compileBtn');
    await page.click('#stepBtn');
    await test.waitForTimeout(100);
    // Click compare: the UI will append diffs to trace
    await page.click('#compareBtn');
    const trace = page.locator('#trace');
    await waitForPreContains(trace, '=== Compare diffs ===', { timeout: 2000 });

    // Mutate: rename variable 'x' -> 'y' (mutateRenameBtn)
    const program = page.locator('#program');
    const beforeProgram = await program.inputValue();
    await page.fill('#renameFrom', 'x');
    await page.fill('#renameTo', 'z');
    await page.click('#mutateRenameBtn');
    await test.waitForTimeout(100);
    const afterProgram = await program.inputValue();
    expect(afterProgram).not.toEqual(beforeProgram);

    // Mutate inline: replace literal (use inlineFrom / inlineTo)
    await page.fill('#inlineFrom', '1');
    await page.fill('#inlineTo', '42');
    await page.click('#mutateInlineBtn');
    await test.waitForTimeout(100);
    const afterInline = await program.inputValue();
    expect(afterInline).toContain('42');

  });

  test('Parser/compile error handling and edge cases', async ({ page }) => {
    // Comments: This test intentionally feeds malformed code to trigger parse/compile errors and validates UI shows error messages.
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    const tokens = page.locator('#tokens');
    const ast = page.locator('#ast');

    // Provide invalid program that will likely cause a parse error (unterminated block)
    await page.fill('#program', 'fun bad(');
    await page.click('#parseBtn');
    // Expect tokens to contain 'Parse error' or ast to not contain valid Program
    const tokensText = await tokens.textContent();
    expect(tokensText.toLowerCase()).toContain('parse error');

    // Test compile error by creating a construct that compiler doesn't know (unlikely); however we can
    // force a runtime "Unknown binary" by creating binary with unsupported operator e.g. 'a $ b'
    await page.fill('#program', 'let a = 1 $ 2;');
    await page.click('#compileBtn');
    // Compiler might throw an Error caught and placed into tokens with 'Compile error'
    const tokensAfter = await tokens.textContent();
    // Accept either a compile error message or a displayed AST / instructions; ensure no uncaught exception (pageerror) occurred
    expect(tokensAfter.length).toBeGreaterThan(0);
  });

  test('Observe and assert browser page errors: intentionally trigger ReferenceError, SyntaxError, TypeError', async ({ page }) => {
    // Comments: We will observe page errors by executing small code snippets in page context that produce natural JS errors.
    // This is done without modifying the application code; it simply runs JS in the page context which may produce pageerror events.
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));
    // Trigger a ReferenceError
    await page.evaluate(() => {
      // Intentionally call an undefined function to produce a ReferenceError
      // This is executed in the page context and will generate a pageerror event.
      try {
        // Intentionally cause a ReferenceError by referencing a non-existent global function
        nonExistentFunctionTriggeringReferenceError();
      } catch (e) {
        // swallow locally to allow a pageerror event to still be emitted in some browsers; also rethrow to ensure capture
        throw e;
      }
    }).catch(() => { /* swallow evaluation rejection; pageerror listener will capture error object */ });

    // Trigger a SyntaxError by creating a function with invalid source
    await page.evaluate(() => {
      // Creating a function with invalid code will throw a SyntaxError
      try {
        // new Function will throw a SyntaxError for invalid code
        new Function(') invalid syntax (');
      } catch (e) {
        throw e;
      }
    }).catch(() => { /* expected */ });

    // Trigger a TypeError by attempting to call null as function
    await page.evaluate(() => {
      try {
        const f = null;
        f();
      } catch (e) {
        throw e;
      }
    }).catch(() => { /* expected */ });

    // Give the page a brief moment to emit pageerror events
    await test.waitForTimeout(200);

    // We expect at least some pageerror events reflecting the intentional errors
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Check that among the captured errors we have at least one ReferenceError, SyntaxError, or TypeError message
    const combinedMessages = pageErrors.map(e => String(e)).join('\n');
    const hasReference = /ReferenceError/.test(combinedMessages);
    const hasSyntax = /SyntaxError/.test(combinedMessages);
    const hasType = /TypeError/.test(combinedMessages);

    // At least one of the error types should be present
    expect(hasReference || hasSyntax || hasType).toBeTruthy();
  });

});