import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3db19e0-fa73-11f0-83e0-8d7be1d51901.html';

/**
 * Page object encapsulating interactions with the Type System Playground page.
 */
class PlaygroundPage {
  constructor(page) {
    this.page = page;
    this.coercionSelect = page.locator('#coercionSelect');
    this.runCoercionBtn = page.locator('#runCoercion');
    this.explainCoercionBtn = page.locator('#explainCoercion');
    this.coercionOutput = page.locator('#coercionOutput');

    this.toyCode = page.locator('#toyCode');
    this.runToyBtn = page.locator('#runToy');
    this.clearToyBtn = page.locator('#clearToy');
    this.toyOutput = page.locator('#toyOutput');

    this.runStructuralBtn = page.locator('#runStructural');
    this.runNominalBtn = page.locator('#runNominal');
    this.structOutput = page.locator('#structOutput');

    this.inferCode = page.locator('#inferCode');
    this.runInferBtn = page.locator('#runInfer');
    this.resetInferBtn = page.locator('#resetInfer');
    this.inferOutput = page.locator('#inferOutput');

    this.jsCode = page.locator('#jsCode');
    this.runJsBtn = page.locator('#runJs');
    this.clearJsBtn = page.locator('#clearJs');
    this.jsOutput = page.locator('#jsOutput');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Coercion
  async selectCoercion(value) {
    // selects an option by value
    await this.coercionSelect.selectOption({ value });
  }
  async runCoercion() {
    await this.runCoercionBtn.click();
  }
  async explainCoercion() {
    await this.explainCoercionBtn.click();
  }
  async getCoercionOutputText() {
    return (await this.coercionOutput.textContent()) || '';
  }

  // Toy checker
  async runToy() {
    await this.runToyBtn.click();
  }
  async clearToy() {
    await this.clearToyBtn.click();
  }
  async getToyOutputText() {
    return (await this.toyOutput.textContent()) || '';
  }
  async getToyOutputBorderLeft() {
    return (await this.toyOutput.evaluate(el => el.style.borderLeft)) || '';
  }

  // Structural / Nominal
  async runStructural() {
    await this.runStructuralBtn.click();
  }
  async runNominal() {
    await this.runNominalBtn.click();
  }
  async getStructOutputText() {
    return (await this.structOutput.textContent()) || '';
  }
  async getStructOutputBorderLeft() {
    return (await this.structOutput.evaluate(el => el.style.borderLeft)) || '';
  }

  // Inference
  async runInfer() {
    await this.runInferBtn.click();
  }
  async resetInfer() {
    await this.resetInferBtn.click();
  }
  async getInferOutputText() {
    return (await this.inferOutput.textContent()) || '';
  }

  // JS Playground
  async runJs() {
    await this.runJsBtn.click();
  }
  async clearJs() {
    await this.clearJsBtn.click();
  }
  async getJsOutputText() {
    return (await this.jsOutput.textContent()) || '';
  }
}

/**
 * Grouped tests validating FSM states and transitions described in the specification.
 * Tests:
 *  - verify Idle rendering and initial placeholders
 *  - Coercion run + explain transitions
 *  - Toy checker run (detects type error) and clear
 *  - Structural acceptance and Nominal rejection (visual feedback)
 *  - Inference engine run + reset
 *  - JS playground run (runtime TypeError captured) and clear
 *
 * The tests also capture console messages and page errors during each test to ensure
 * that runtime exceptions (if any) are observed and that the app surfaces errors
 * in the DOM outputs as designed.
 */

test.describe('Type System Playground - FSM states/transitions', () => {
  let playground;
  let consoleMessages;
  let pageErrors;
  let consoleListener;
  let pageErrorListener;

  test.beforeEach(async ({ page }) => {
    // Prepare arrays to capture console and page errors
    consoleMessages = [];
    pageErrors = [];

    // Attach listeners to observe console logs and page errors
    consoleListener = msg => {
      // capture text and type for diagnostics
      consoleMessages.push({ text: msg.text(), type: msg.type() });
    };
    pageErrorListener = err => {
      pageErrors.push(err); // usually Error objects
    };

    page.on('console', consoleListener);
    page.on('pageerror', pageErrorListener);

    // Navigate to the application page
    playground = new PlaygroundPage(page);
    await playground.goto();
  });

  test.afterEach(async ({ page }) => {
    // Remove listeners to avoid cross-test contamination
    page.off('console', consoleListener);
    page.off('pageerror', pageErrorListener);
  });

  test('Idle: initial page render and placeholders', async () => {
    // Ensure the page rendered the main heading and initial output placeholders
    await expect(playground.page.locator('h1')).toHaveText('Type System Playground');

    // Each output should have the initial placeholder text set by initialization code
    await expect(playground.coercionOutput).toHaveText('// result appears here');
    await expect(playground.toyOutput).toHaveText('// checker output');
    await expect(playground.structOutput).toHaveText('// results');
    await expect(playground.inferOutput).toHaveText('// inferred types');
    await expect(playground.jsOutput).toHaveText('// JS output');

    // No uncaught page errors should have occurred simply on load
    expect(pageErrors.length).toBe(0);
  });

  test('Coercion: run default expression and explain; run an edge coercion producing NaN', async () => {
    // Default select is "'5' + 2" which should produce '52' and type string
    await playground.runCoercion();
    let out = await playground.getCoercionOutputText();
    expect(out).toContain("->");
    expect(out).toContain("'5' + 2");
    expect(out).toContain('52');
    expect(out).toContain('(type)');

    // Explain the coercion: should produce a textual explanation rather than the evaluation result
    await playground.explainCoercion();
    out = await playground.getCoercionOutputText();
    expect(out).toContain("'+' with a string coerces the other operand to string");

    // Edge case: select 'undefined + 1' which yields NaN (typeof NaN === 'number')
    await playground.selectCoercion("undefined + 1");
    await playground.runCoercion();
    out = await playground.getCoercionOutputText();
    expect(out).toContain('undefined + 1');
    // We expect NaN string somewhere in the output and a printed type.
    expect(out.toLowerCase()).toContain('nan');
    expect(out).toContain('(type)');

    // There should be no unhandled page errors as coercion exceptions are caught by the page code
    expect(pageErrors.length).toBe(0);
  });

  test('Toy static checker: run detects type error (transition into Toy_Checker_Running) and reset', async () => {
    // Run the toy checker; the default toy code includes a deliberate mismatch:
    // let c: string = 10  -> should produce "Type error on line..."
    await playground.runToy();

    // Wait for the output to reflect the checker result
    await playground.toyOutput.waitFor({ state: 'visible' });

    const toyText = await playground.getToyOutputText();
    // The checker prefixes errors with "ERROR:" in its output lines
    expect(toyText).toContain('ERROR:');
    expect(toyText).toMatch(/Type error on line\s*\d+/);

    // It should also list Variables summary
    expect(toyText).toContain('Variables:');

    // Visual feedback: when ok === false, appendOut set a borderLeft style (4px solid ...)
    const border = await playground.getToyOutputBorderLeft();
    expect(border).toContain('4px solid');

    // Now clear/reset the toy checker (transition back to Idle)
    await playground.clearToy();
    const cleared = await playground.getToyOutputText();
    expect(cleared).toBe('// checker output');

    // After reset there should still be no uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Structural vs Nominal: structural accepts shape, nominal rejects branded mismatch (visual feedback)', async () => {
    // Run structural demo: should accept both point2D and pointLike
    await playground.runStructural();
    await playground.structOutput.waitFor({ state: 'visible' });
    let structText = await playground.getStructOutputText();
    expect(structText).toContain('dist(point2D)');
    expect(structText).toContain('accepted because shape has x and y');
    // Successful run uses appendOut with ok === true (green border)
    let border1 = await playground.getStructOutputBorderLeft();
    expect(border).toContain('4px solid');

    // Now run nominal demo: it should produce failure message for the unbranded object
    await playground.runNominal();
    await playground.structOutput.waitFor({ state: 'visible' });
    structText = await playground.getStructOutputText();
    expect(structText).toContain('a failed') || expect(structText).toContain('requirePoint(a)');
    expect(structText).toContain('b failed');
    expect(structText.toLowerCase()).toContain('nominal rejects');

    // Nominal run sets ok === false -> borderLeft should be set (red)
    border = await playground.getStructOutputBorderLeft();
    expect(border).toContain('4px solid');

    // No uncaught page errors should have been emitted by these interactions
    expect(pageErrors.length).toBe(0);
  });

  test('Type inference engine: run inferencer and then reset to default', async () => {
    // Run inference engine: should produce logs and final types
    await playground.runInfer();
    await playground.inferOutput.waitFor({ state: 'visible' });
    const inferText = await playground.getInferOutputText();
    expect(inferText).toContain('Final types:');
    // The default infer examples reassign x to a string later -> union expected
    expect(inferText).toMatch(/x\s*:\s*(number|string)/i);

    // Reset the inference engine back to Idle/default
    await playground.resetInfer();
    const resetText = await playground.getInferOutputText();
    expect(resetText).toBe('// inferred types');

    // No uncaught page errors during inference interactions
    expect(pageErrors.length).toBe(0);
  });

  test('JS Playground: running user JS yields captured runtime TypeError and clearing output', async () => {
    // Default jsCode includes a safeAdd that will throw when called with a string second time,
    // which the page code captures and prints as "ERROR: TypeError..."
    await playground.runJs();

    // After clicking run, the page first writes '// running...' then schedules execution via setTimeout.
    // Wait until jsOutput no longer contains '// running...' and then check for ERROR reported.
    await playground.page.waitForFunction(() => {
      const out1 = document.getElementById('jsOutput');
      return out && !out.textContent.includes('// running...');
    });

    const jsText = await playground.getJsOutputText();
    // The safeRunUserJS returns the error as a string; the page prefixes with 'ERROR:' when present.
    expect(jsText).toMatch(/ERROR:\s*TypeError/i);

    // Clearing JS output should reset placeholder
    await playground.clearJs();
    const cleared1 = await playground.getJsOutputText();
    expect(cleared).toBe('// JS output');

    // Ensure that the runtime error from user code was handled by the page (no uncaught page errors)
    expect(pageErrors.length).toBe(0);

    // Also confirm that no unexpected console messages were emitted by the page (safeRunUserJS temporarily overrides console.log)
    // We allow that consoleMessages may be empty; verify that none are 'error' type
    const errorConsole = consoleMessages.find(m => m.type === 'error');
    expect(errorConsole).toBeUndefined();
  });

  test('Additional coercion edge-case: "{} + []" may produce parsing-dependent output but should not crash the page', async () => {
    // Some expressions like "{} + []" are context/parse dependent; running them should not crash the page.
    await playground.selectCoercion("{} + []");
    await playground.runCoercion();
    const out2 = await playground.getCoercionOutputText();
    // Accept either explanation text or an evaluation result; ensure no exception bubbles to the page
    expect(out.length).toBeGreaterThan(0);
    expect(pageErrors.length).toBe(0);
  });

});