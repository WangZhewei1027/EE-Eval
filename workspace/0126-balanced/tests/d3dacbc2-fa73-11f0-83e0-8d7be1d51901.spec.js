import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3dacbc2-fa73-11f0-83e0-8d7be1d51901.html';

test.describe('Tiny Compiler — FSM end-to-end tests (d3dacbc2-fa73-11f0-83e0-8d7be1d51901)', () => {
  // We'll capture console messages and page errors for each test so we can assert on them.
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console events
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    // Capture uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(String(err));
    });

    // Navigate to the app page
    await page.goto(APP_URL);
    // Wait for the UI to be present
    await expect(page.locator('#source')).toBeVisible();
    await expect(page.locator('#btnLex')).toBeVisible();
  });

  test.afterEach(async () => {
    // Basic hygiene: no unexpected console errors or uncaught page errors in normal tests.
    // Individual tests for error scenarios will assert expected messages; here we make a gentle check.
    expect(pageErrors.length).toBeLessThanOrEqual(0);
    expect(consoleErrors.length).toBeLessThanOrEqual(0);
  });

  test('Initial state (S0_Idle): page renders and sample loaded into source, outputs are cleared', async ({ page }) => {
    // Validate Idle state: source textarea exists and is initialized to the first sample program.
    const source = page.locator('#source');
    const tokens = page.locator('#tokens');
    const ast = page.locator('#ast');
    const optAst = page.locator('#optAst');
    const jsEl = page.locator('#js');
    const output = page.locator('#output');
    const messages = page.locator('#messages');

    // The app initializes source with the first sample; assert it's non-empty
    const sourceValue = await source.inputValue();
    expect(sourceValue.length).toBeGreaterThan(0);

    // All result panes should be empty on initial load (clearAll in init)
    await expect(tokens).toHaveText('');
    await expect(ast).toHaveText('');
    await expect(optAst).toHaveText('');
    await expect(jsEl).toHaveText('');
    await expect(output).toHaveText('');
    await expect(messages).toHaveText('');
  });

  test('Lex event (S0_Idle -> S1_Lexed): clicking Lex shows tokens and logs success', async ({ page }) => {
    // Click the Lex button and assert tokens appear and messages show success
    const btnLex = page.locator('#btnLex');
    const tokens1 = page.locator('#tokens1');
    const messages1 = page.locator('#messages1');

    await btnLex.click();

    // tokens area should become non-empty and contain token info lines
    await expect(tokens).not.toHaveText('');
    const tokensText = await tokens.textContent();
    expect(tokensText).toContain('EOF'); // EOF token present in lexer output

    // messages element should include lex success message
    const msgs = await messages.textContent();
    expect(msgs).toContain('[Info]'); // general info prefix
    expect(msgs).toMatch(/Lexing succeeded|Lexing OK/i);
  });

  test('Parse event (S1_Lexed -> S2_Parsed): clicking Parse produces AST and log', async ({ page }) => {
    const btnParse = page.locator('#btnParse');
    const ast1 = page.locator('#ast1');
    const tokens2 = page.locator('#tokens2');
    const messages2 = page.locator('#messages2');

    // Parse button runs lex internally; click it
    await btnParse.click();

    // tokens should be populated as Parse invokes lex first
    await expect(tokens).not.toHaveText('');

    // AST should be populated (JSON)
    await expect(ast).not.toHaveText('');
    const astText = await ast.textContent();
    expect(astText).toContain('"type": "Program"');

    // messages should indicate parsing succeeded
    const msgs1 = await messages.textContent();
    expect(msgs).toContain('Parsing succeeded');
  });

  test('Optimize event (S2_Parsed -> S3_Optimized): clicking Optimize shows optimized AST with folded literals', async ({ page }) => {
    const btnOptimize = page.locator('#btnOptimize');
    const optAst1 = page.locator('#optAst1');
    const ast2 = page.locator('#ast2');
    const messages3 = page.locator('#messages3');

    // Click Optimize (it runs lex+parse internally)
    await btnOptimize.click();

    // parsed AST area should be filled
    await expect(ast).not.toHaveText('');

    // optimized AST should be present and include folded Literals when applicable
    await expect(optAst).not.toHaveText('');
    const optText = await optAst.textContent();
    // The optimizer does constant folding/proagation; ensure we see "Literal" nodes serialized in optimized AST
    expect(optText).toContain('"type": "Literal"');
    // Ensure there's an optimization success info
    const msgs2 = await messages.textContent();
    expect(msgs).toContain('Optimization applied');
  });

  test('Generate JS event (S3_Optimized -> S4_JS_Generated): clicking Generate JS fills generated code', async ({ page }) => {
    const btnGen = page.locator('#btnGen');
    const jsEl1 = page.locator('#js');
    const optAst2 = page.locator('#optAst2');
    const messages4 = page.locator('#messages4');

    await btnGen.click();

    // optimized AST should be shown
    await expect(optAst).not.toHaveText('');

    // js output should be non-empty and include __print calls
    await expect(jsEl).not.toHaveText('');
    const jsText = await jsEl.textContent();
    expect(jsText).toContain('__print(');
    expect(jsText).toContain('let '); // variable declarations present

    // messages should indicate code generation
    const msgs3 = await messages.textContent();
    expect(msgs).toContain('Code generation completed');
  });

  test('Execute event (S4_JS_Generated -> S5_Executed): clicking Execute runs program and captures output', async ({ page }) => {
    const btnRun = page.locator('#btnRun');
    const output1 = page.locator('#output1');
    const messages5 = page.locator('#messages5');

    // Click Run which will lex/parse/opt/gen/run
    await btnRun.click();

    // The sample program (first sample) should print two lines: "115" and "121"
    await expect(output).not.toHaveText('');
    const outText = await output.textContent();
    // Assert expected outputs based on initial sample program
    expect(outText.trim()).toBe('115\n121');

    // messages should indicate successful execution
    const msgs4 = await messages.textContent();
    expect(msgs).toContain('Program executed successfully');
  });

  test('Run All event (S0_Idle -> S6_All_Ran): clicking Run All populates tokens, ast, optAst, js, output and logs OKs', async ({ page }) => {
    const btnAll = page.locator('#btnAll');
    const tokens3 = page.locator('#tokens3');
    const ast3 = page.locator('#ast3');
    const optAst3 = page.locator('#optAst3');
    const jsEl2 = page.locator('#js');
    const output2 = page.locator('#output2');
    const messages6 = page.locator('#messages6');

    // Ensure starting from idle (clear any previous state)
    await page.reload();
    await expect(page.locator('#source')).toBeVisible();

    await btnAll.click();

    // All major outputs should be filled
    await expect(tokens).not.toHaveText('');
    await expect(ast).not.toHaveText('');
    await expect(optAst).not.toHaveText('');
    await expect(jsEl).not.toHaveText('');
    await expect(output).not.toHaveText('');

    // Validate content types
    expect((await tokens.textContent()).length).toBeGreaterThan(10);
    expect((await ast.textContent()).includes('"type": "Program"')).toBeTruthy();
    expect((await jsEl.textContent()).includes('__print')).toBeTruthy();

    // Messages should include the OK messages for each stage
    const msgs5 = await messages.textContent();
    expect(msgs).toContain('Lexing OK') || expect(msgs).toContain('Lexing OK.');
    expect(msgs).toContain('Parsing OK');
    expect(msgs).toContain('Optimization OK');
    expect(msgs).toContain('Code generation OK');
    expect(msgs).toMatch(/Execution OK|Program executed successfully/);
  });

  test('Reset sample (S0_Idle -> S7_Reset): clicking Reset sample sets source to first sample and clears outputs', async ({ page }) => {
    const source1 = page.locator('#source1');
    const btnReset = page.locator('#btnReset');
    const tokens4 = page.locator('#tokens4');
    const ast4 = page.locator('#ast4');
    const optAst4 = page.locator('#optAst4');
    const jsEl3 = page.locator('#js');
    const output3 = page.locator('#output3');
    const messages7 = page.locator('#messages7');

    // Modify source to something else
    await source.fill('print(999);');
    const changed = await source.inputValue();
    expect(changed).toBe('print(999);');

    // Click reset sample
    await btnReset.click();

    // Source should be set back to first sample program (non-empty and not 'print(999);')
    const after = await source.inputValue();
    expect(after).not.toBe('print(999);');
    expect(after.length).toBeGreaterThan(0);

    // All displays should be cleared
    await expect(tokens).toHaveText('');
    await expect(ast).toHaveText('');
    await expect(optAst).toHaveText('');
    await expect(jsEl).toHaveText('');
    await expect(output).toHaveText('');
    await expect(messages).toHaveText('');
  });

  test('Sample chip click sets source and clears outputs (UI interaction)', async ({ page }) => {
    // Ensure the sample chips are rendered and clicking one loads its code into source
    const samplesDiv = page.locator('#samples');
    await expect(samplesDiv).toBeVisible();

    // Find the chip for "Errors: parse"
    const errorChip = page.locator('.chip', { hasText: 'Errors: parse' });
    await expect(errorChip).toBeVisible();

    // Click the chip: it sets the source textarea value to the sample code and clears outputs
    await errorChip.click();

    const source2 = page.locator('#source2');
    const value = await source.inputValue();
    expect(value).toContain('let x = 2 + ;'); // sample program's code snippet should be present

    // outputs are cleared
    await expect(page.locator('#tokens')).toHaveText('');
    await expect(page.locator('#ast')).toHaveText('');
    await expect(page.locator('#optAst')).toHaveText('');
    await expect(page.locator('#js')).toHaveText('');
    await expect(page.locator('#output')).toHaveText('');
  });

  test('Error scenario: Parse error sample produces parse error message and AST remains empty', async ({ page }) => {
    // Click the "Errors: parse" chip to load broken sample
    const errorChip1 = page.locator('.chip', { hasText: 'Errors: parse' });
    await errorChip.click();

    // Click Parse to trigger parsing error
    await page.locator('#btnParse').click();

    const messages8 = page.locator('#messages8');
    const ast5 = page.locator('#ast5');

    // AST should be cleared on error
    await expect(ast).toHaveText('');

    // messages should contain '[Error]' and mention ParseError
    const msgs6 = await messages.textContent();
    expect(msgs).toContain('[Error]');
    expect(msgs).toMatch(/ParseError|Unexpected token|Expected/);

    // No uncaught page errors should have occurred (errors are handled and reported into messages)
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Additional edge-case: running the app with a manual tiny program that triggers runtime error
  test('Runtime error scenario: executing code with thrown error is reported in messages', async ({ page }) => {
    const source3 = page.locator('#source3');
    const btnRun1 = page.locator('#btnRun1');
    const messages9 = page.locator('#messages9');
    const output4 = page.locator('#output4');

    // Provide a source that will raise a runtime ReferenceError in generated JS (use undeclared identifier in expression)
    await source.fill('print(notDeclared);\n');

    // Run should catch runtime error and log it via logError -> messagesEl
    await btnRun.click();

    // Output should be empty (runtime error prevented successful output)
    await expect(output).toHaveText('');

    const msgs7 = await messages.textContent();
    // Should include [Error] and something mentioning ReferenceError or runtime error
    expect(msgs).toContain('[Error]');
    expect(msgs).toMatch(/ReferenceError|RuntimeError|error/i);

    // Ensure no uncaught page errors (runtime exceptions are caught by runGenerated and reported)
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observe console and page errors: capture and assert there are no uncaught runtime console errors on normal run', async ({ page }) => {
    // Perform a normal run (first sample) and then assert captured console/page errors arrays are empty
    await page.locator('#btnRun').click();

    // Wait a little to ensure execution completed
    await page.waitForTimeout(100);

    // The app logs to its messages box, not console; we nonetheless assert there were no console errors or page errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});