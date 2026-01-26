import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c167672-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Type System Playground - FSM comprehensive tests', () => {
  // Collect console errors and page errors for each test run
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Observe console messages and page errors (do not suppress)
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');
    // Wait a bit to allow initial scenario and logs to populate
    await page.waitForTimeout(100);
  });

  test.afterEach(async () => {
    // Ensure no unexpected page-level errors occurred during tests
    expect(pageErrors.length).toBeLessThanOrEqual(0);
    // Console errors are recorded; assert none happened (the app is expected to run without uncaught exceptions)
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('Types: add, alias, view, edit, delete', () => {
    test('Add Type should create a new environment entry and log the addition', async ({ page }) => {
      // Clear name/expr inputs then add a new type
      await page.fill('#newTypeName', 'MyPair');
      await page.fill('#newTypeExpr', '{a:Int, b:String}');
      await page.click('#addTypeBtn');

      // Expect log area contains the added type message
      const log = await page.locator('#logArea').innerText();
      expect(log).toContain('Added type MyPair = {a:Int, b:String}');
      // typesList should include the new type
      const typesText = await page.locator('#typesList').allTextContents();
      const found = typesText.some(t => t.startsWith('MyPair ='));
      expect(found).toBeTruthy();
    });

    test('Add Alias creates a named alias and is marked as alias in view', async ({ page }) => {
      await page.fill('#newTypeName', 'Meter');
      await page.fill('#newTypeExpr', 'Float');
      await page.click('#aliasTypeBtn');

      // Log check
      const log = await page.locator('#logArea').innerText();
      expect(log).toContain('Added alias Meter = Float');

      // View via clicking and capturing alert dialog message
      // Select the option 'Meter' in typesList
      await page.selectOption('#typesList', 'Meter');

      const dlgPromise = page.waitForEvent('dialog');
      await page.click('#viewTypeBtn');
      const dlg = await dlgPromise;
      // The alert should show alias suffix "(alias)"
      expect(dlg.message()).toContain('Meter = Float');
      expect(dlg.message()).toContain('(alias)');
      await dlg.accept();
    });

    test('Edit Type via prompt updates type and logs the edit', async ({ page }) => {
      // Ensure a type exists to edit: create 'ToEdit'
      await page.fill('#newTypeName', 'ToEdit');
      await page.fill('#newTypeExpr', 'Int');
      await page.click('#addTypeBtn');

      // Select the type
      await page.selectOption('#typesList', 'ToEdit');

      // When edit triggers a prompt, respond with new expression
      const promptPromise = page.waitForEvent('dialog');
      // Trigger edit, then handle prompt
      const clickPromise = page.click('#editTypeBtn');
      const prompt = await promptPromise;
      // The prompt contains current type; provide a new type expression
      expect(prompt.type()).toBe('prompt');
      await prompt.accept('{x:Int, y:String}');
      await clickPromise;

      // Log should contain Edited message
      const log = await page.locator('#logArea').innerText();
      expect(log).toContain('Edited type ToEdit => {x:Int, y:String}');

      // Verify typesList shows updated string
      const types = await page.locator('#typesList').allTextContents();
      expect(types.some(t => t.includes('ToEdit = {x:Int, y:String}'))).toBeTruthy();
    });

    test('Delete Type uses confirm then removes type and logs deletion', async ({ page }) => {
      // Add a type to delete
      await page.fill('#newTypeName', 'TmpDel');
      await page.fill('#newTypeExpr', 'Bool');
      await page.click('#addTypeBtn');

      // Select it
      await page.selectOption('#typesList', 'TmpDel');

      // Confirm dialog must be accepted to proceed with deletion
      const confirmPromise = page.waitForEvent('dialog');
      const clickPromise = page.click('#deleteTypeBtn');
      const confirm = await confirmPromise;
      expect(confirm.type()).toBe('confirm');
      // Accept deletion
      await confirm.accept();
      await clickPromise;

      // Log must contain deletion
      const log = await page.locator('#logArea').innerText();
      expect(log).toContain('Deleted type TmpDel');

      // The typesList should no longer contain this type
      const types = await page.locator('#typesList').allTextContents();
      expect(types.some(t => t.startsWith('TmpDel ='))).toBeFalsy();
    });
  });

  test.describe('Variables: add, view, delete', () => {
    test('Add Variable stores a var with selected type and logs it', async ({ page }) => {
      // Ensure primitive option exists: select Int in varTypeSelect
      await page.fill('#newVarName', 'v1');
      await page.selectOption('#varTypeSelect', 'Int');
      await page.click('#addVarBtn');

      const log = await page.locator('#logArea').innerText();
      expect(log).toContain('Added variable v1 : Int');

      const vars = await page.locator('#varsList').allTextContents();
      expect(vars.some(v => v.startsWith('v1 :'))).toBeTruthy();
    });

    test('View Variable triggers alert showing its type', async ({ page }) => {
      // Add variable to ensure presence
      await page.fill('#newVarName', 'v2');
      await page.selectOption('#varTypeSelect', 'String');
      await page.click('#addVarBtn');

      // Select and view
      await page.selectOption('#varsList', 'v2');
      const dlgPromise = page.waitForEvent('dialog');
      await page.click('#viewVarBtn');
      const dlg = await dlgPromise;
      expect(dlg.message()).toContain('v2 : String');
      await dlg.accept();
    });

    test('Delete Variable removes it and logs deletion', async ({ page }) => {
      // Add variable
      await page.fill('#newVarName', 'vDel');
      await page.selectOption('#varTypeSelect', 'Bool');
      await page.click('#addVarBtn');

      // Select and delete
      await page.selectOption('#varsList', 'vDel');
      await page.click('#deleteVarBtn');

      const log = await page.locator('#logArea').innerText();
      expect(log).toContain('Deleted variable vDel');

      const vars = await page.locator('#varsList').allTextContents();
      expect(vars.some(v => v.startsWith('vDel :'))).toBeFalsy();
    });
  });

  test.describe('Operations: unify, subtype, instantiate, apply, simplify, infer_simple', () => {
    test('Unify succeeds for identical primitives and produces success log', async ({ page }) => {
      // Ensure op controls are present (default is 'unify')
      await page.selectOption('#operationSelect', 'unify');
      // opTypeA and opTypeB are select elements created; ensure their options are populated
      await page.waitForTimeout(50);

      // Select 'Int' and 'Int'
      await page.selectOption('#opTypeA', 'Int');
      await page.selectOption('#opTypeB', 'Int');

      await page.click('#runOpBtn');

      const log = await page.locator('#logArea').innerText();
      expect(log).toContain('Unifying Int  and  Int');
      expect(log).toContain('Unification success');
      // currentSubst should be empty
      const substVal = await page.locator('#currentSubst').inputValue();
      expect(substVal.trim()).toBe('');
    });

    test('Unify fails for incompatible primitives and logs error', async ({ page }) => {
      await page.selectOption('#operationSelect', 'unify');
      await page.waitForTimeout(50);
      await page.selectOption('#opTypeA', 'Int');
      await page.selectOption('#opTypeB', 'String');
      await page.click('#runOpBtn');

      const log = await page.locator('#logArea').innerText();
      expect(log).toContain('Unifying Int  and  String');
      // An error message should be appended
      expect(log).toMatch(/Error: Cannot unify primitives|Error: Cannot unify types/);
    });

    test('Instantiate generic type substitutes args and logs instantiation', async ({ page }) => {
      // Add a generic-like type Pair
      await page.fill('#newTypeName', 'PairG');
      await page.fill('#newTypeExpr', '{fst:a, snd:b}');
      await page.click('#addTypeBtn');

      // Switch operation to instantiate and set args
      await page.selectOption('#operationSelect', 'instantiate');
      await page.waitForTimeout(50);
      await page.selectOption('#opTypeA', 'PairG');
      await page.fill('#instantiateArgs', 'Int,String');
      await page.click('#runOpBtn');

      const log = await page.locator('#logArea').innerText();
      expect(log).toContain('Instantiated PairG<Int,String>');
      expect(log).toContain('=> {fst:Int, snd:String}');
    });

    test('Apply substitution uses last substitution after a unification producing a binding', async ({ page }) => {
      // Create a type that is a wrapper around a type variable: Wrapper := a
      await page.fill('#newTypeName', 'WrapperVar');
      await page.fill('#newTypeExpr', 'a');
      await page.click('#addTypeBtn');

      // Prepare unify: WrapperVar and Int (this should bind 'a' -> Int)
      await page.selectOption('#operationSelect', 'unify');
      await page.waitForTimeout(50);
      await page.selectOption('#opTypeA', 'WrapperVar');
      await page.selectOption('#opTypeB', 'Int');
      await page.click('#runOpBtn');

      // currentSubst should now contain mapping for 'a'
      const substVal = await page.locator('#currentSubst').inputValue();
      expect(substVal).toMatch(/a .*Int/);

      // Now test 'apply' operation: choose WrapperVar to apply lastSubst (should become Int)
      await page.selectOption('#operationSelect', 'apply');
      await page.waitForTimeout(50);
      await page.selectOption('#opTypeA', 'WrapperVar');
      await page.click('#runOpBtn');
      const log = await page.locator('#logArea').innerText();
      // Should show applied substitution -> Int
      expect(log).toMatch(/Applied substitution to .*WrapperVar.*=> Int/);
    });

    test('Simplify resolves named aliases structurally and logs simplification', async ({ page }) => {
      // Add an alias 'AliasNum' => Int
      await page.fill('#newTypeName', 'AliasNum');
      await page.fill('#newTypeExpr', 'Int');
      await page.click('#aliasTypeBtn');

      await page.selectOption('#operationSelect', 'simplify');
      await page.waitForTimeout(50);
      await page.fill('#simplifyExpr', 'AliasNum');
      await page.click('#runOpBtn');

      const log = await page.locator('#logArea').innerText();
      expect(log).toContain('Simplified AliasNum => Int');
    });

    test('infer_simple performs simple call inference and logs result', async ({ page }) => {
      // Add a function variable f : (Int) -> Bool and an argument var arg : Int
      await page.fill('#newVarName', 'f1');
      // create a type for this function in env so varTypeSelect can choose it
      await page.fill('#newTypeName', 'FuncType1');
      await page.fill('#newTypeExpr', '(Int) -> Bool');
      await page.click('#addTypeBtn');

      // Add variable f1 of type FuncType1
      await page.selectOption('#varTypeSelect', 'FuncType1');
      await page.fill('#newVarName', 'f1');
      await page.click('#addVarBtn');

      // Add arg variable
      await page.fill('#newVarName', 'arg1');
      await page.selectOption('#varTypeSelect', 'Int');
      await page.click('#addVarBtn');

      // Switch to infer_simple operation
      await page.selectOption('#operationSelect', 'infer_simple');
      await page.waitForTimeout(50);

      // The op controls include a select #inferVar and an input #inferCall
      // Select f1 then set call arg to arg1
      await page.selectOption('#inferVar', 'f1');
      await page.fill('#inferCall', 'arg1');

      // Run inference
      await page.click('#runOpBtn');

      const log = await page.locator('#logArea').innerText();
      expect(log).toContain('Call f1(arg1)');
      expect(log).toContain('Result type: Bool');
    });
  });

  test.describe('Scenarios, Save/Load JSON, Reset, Clear Log', () => {
    test('Load Scenario populates environment and logs scenario load', async ({ page }) => {
      // Select "functions" scenario and load
      await page.selectOption('#scenarioSelect', 'functions');
      await page.click('#loadScenarioBtn');

      const log = await page.locator('#logArea').innerText();
      expect(log).toContain('Loaded functions scenario');

      // Ensure types such as 'Adder' exist in list
      const types = await page.locator('#typesList').allTextContents();
      expect(types.some(t => t.startsWith('Adder ='))).toBeTruthy();
    });

    test('Export environment to JSON and import it back; invalid JSON produces alert', async ({ page }) => {
      // Export current environment
      await page.click('#saveEnvBtn');
      const envJson = await page.locator('#envJson').inputValue();
      expect(envJson.length).toBeGreaterThan(0);
      // Now attempt to load invalid JSON and capture alert
      await page.fill('#envJson', 'this is not json');

      const dlgPromise = page.waitForEvent('dialog');
      await page.click('#loadEnvBtn');
      const dlg = await dlgPromise;
      // Should be an alert for bad JSON
      expect(dlg.message()).toContain('Bad JSON');
      await dlg.accept();

      // Now prepare a valid minimal environment JSON and import it
      const simpleObj = { types: { X: 'Int' }, vars: { y: 'Int' } };
      await page.fill('#envJson', JSON.stringify(simpleObj, null, 2));
      await page.click('#loadEnvBtn');

      // Log should indicate import
      const log = await page.locator('#logArea').innerText();
      expect(log).toContain('Imported environment from JSON');

      // The type X should now appear
      const types = await page.locator('#typesList').allTextContents();
      expect(types.some(t => t.startsWith('X ='))).toBeTruthy();
      // The var y should now appear
      const vars = await page.locator('#varsList').allTextContents();
      expect(vars.some(v => v.startsWith('y :'))).toBeTruthy();
    });

    test('Reset environment confirms then clears types/vars and logs reset', async ({ page }) => {
      // Add a type and var to ensure something to clear
      await page.fill('#newTypeName', 'TmpReset');
      await page.fill('#newTypeExpr', 'Int');
      await page.click('#addTypeBtn');

      await page.fill('#newVarName', 'tmpvar');
      await page.selectOption('#varTypeSelect', 'Int');
      await page.click('#addVarBtn');

      // Reset environment: confirm must be accepted
      const confirmPromise = page.waitForEvent('dialog');
      const clickPromise = page.click('#resetEnvBtn');
      const confirm = await confirmPromise;
      expect(confirm.type()).toBe('confirm');
      await confirm.accept();
      await clickPromise;

      const log = await page.locator('#logArea').innerText();
      // resetEnv logs "Environment reset."
      expect(log).toContain('Environment reset.');

      // Types list should be empty
      const types = await page.locator('#typesList').allTextContents();
      // There may be primitives added by scenarios; after reset they should be empty
      expect(types.length).toBe(0);
      const vars = await page.locator('#varsList').allTextContents();
      expect(vars.length).toBe(0);
    });

    test('Clear Log empties the log area', async ({ page }) => {
      // Ensure some log exists, then clear
      await page.fill('#newTypeName', 'TmpLog');
      await page.fill('#newTypeExpr', 'Int');
      await page.click('#addTypeBtn');

      // Clear log
      await page.click('#clearLogBtn');
      const log = await page.locator('#logArea').innerText();
      expect(log.trim()).toBe('');
    });
  });

  test.describe('Trace navigation and edge cases', () => {
    test('Trace slider and step buttons navigate recorded trace for unification', async ({ page }) => {
      // Add wrapper var type and unify to produce trace steps
      await page.fill('#newTypeName', 'WrapA');
      await page.fill('#newTypeExpr', '{fst:a}');
      await page.click('#addTypeBtn');

      // Set operation unify between WrapA and WrapA (identical) to produce at least some trace steps
      await page.selectOption('#operationSelect', 'unify');
      await page.waitForTimeout(50);
      await page.selectOption('#opTypeA', 'WrapA');
      await page.selectOption('#opTypeB', 'WrapA');
      await page.click('#runOpBtn');

      // The traceSlider max should be >= 0; read its attributes
      const slider = page.locator('#traceSlider');
      const max = parseInt(await slider.getAttribute('max'), 10);
      expect(max).toBeGreaterThanOrEqual(0);

      // Click step next a few times (safe bounds)
      await page.click('#stepNextBtn');
      await page.click('#stepNextBtn');
      await page.click('#stepPrevBtn');

      // The log should contain some Trace[...] lines appended by showTraceAt
      const log = await page.locator('#logArea').innerText();
      expect(log).toMatch(/Trace\[\d+\]:/);
    });

    test('Edge case: parse error when adding malformed type triggers alert', async ({ page }) => {
      await page.fill('#newTypeName', 'BadType');
      await page.fill('#newTypeExpr', 'Bad@@Expr');

      const dlgPromise = page.waitForEvent('dialog');
      await page.click('#addTypeBtn');
      const dlg = await dlgPromise;
      expect(dlg.message()).toContain('Parse error');
      await dlg.accept();

      // Ensure BadType was not added
      const types = await page.locator('#typesList').allTextContents();
      expect(types.some(t => t.startsWith('BadType'))).toBeFalsy();
    });

    test('Edge case: occurs check triggers unification error and is logged', async ({ page }) => {
      // Create a recursive type where a occurs: create type Rec = {f:Rec}
      // Instead, create type A = {x:a} and try to unify a with {x:a} to force occurs check
      await page.fill('#newTypeName', 'Arec');
      await page.fill('#newTypeExpr', '{x:a}');
      await page.click('#addTypeBtn');

      // Create name 'avar' as alias to var 'a'
      await page.fill('#newTypeName', 'avar');
      await page.fill('#newTypeExpr', 'a');
      await page.click('#addTypeBtn');

      // Attempt unify avar and Arec: this should try to bind a := {x:a} and trigger occurs check
      await page.selectOption('#operationSelect', 'unify');
      await page.waitForTimeout(50);
      await page.selectOption('#opTypeA', 'avar');
      await page.selectOption('#opTypeB', 'Arec');
      await page.click('#runOpBtn');

      const log = await page.locator('#logArea').innerText();
      expect(log).toMatch(/Occurs check failed|Occurs check/);
    });
  });
});