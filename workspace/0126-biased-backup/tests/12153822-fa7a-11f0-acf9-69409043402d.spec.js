import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12153822-fa7a-11f0-acf9-69409043402d.html';

// Page Object representing main interactions and elements
class SpaceComplexityPage {
  constructor(page) {
    this.page = page;
    // workspace selectors
    this.dsName = page.locator('#ds-name');
    this.dsType = page.locator('#ds-type');
    this.dsSize = page.locator('#ds-size');
    this.dsDesc = page.locator('#ds-desc');
    this.addDsBtn = page.locator('#add-ds');
    this.structureList = page.locator('#structure-list');

    this.algoCode = page.locator('#algo-code');
    this.parseAlgoBtn = page.locator('#parse-algo');
    this.clearAlgoBtn = page.locator('#clear-algo');
    this.parseLog = page.locator('#parse-log');

    this.inputsArea = page.locator('#inputs-area');
    this.runAlgoBtn = page.locator('#run-algo');

    this.stepRunBtn = page.locator('#step-run');
    this.autoRunBtn = page.locator('#auto-run');
    this.resetRunBtn = page.locator('#reset-run');

    this.simLog = page.locator('#sim-log');
    this.memoryUsage = page.locator('#memory-usage');
    this.callStack = page.locator('#call-stack');

    this.showComplexityBtn = page.locator('#show-complexity');
    this.complexityOutput = page.locator('#complexity-output');
  }

  // Add a structure via the UI
  async addStructure({ name, type = 'array', sizeParam = '', desc = '' }) {
    await this.dsName.fill(name);
    await this.dsType.selectOption(type);
    await this.dsSize.fill(sizeParam);
    await this.dsDesc.fill(desc);
    await this.addDsBtn.click();
  }

  // Parse provided algorithm code
  async parseAlgorithm(code) {
    await this.algoCode.fill(code);
    await this.parseAlgoBtn.click();
  }

  // Provide input parameter values by populating corresponding generated inputs
  async setInputParam(paramName, value) {
    const input = this.page.locator(`#input-${paramName}`);
    await input.fill(String(value));
  }

  // Click run algorithm button
  async runAlgorithm() {
    await this.runAlgoBtn.click();
  }

  // Click a single step
  async stepOnce() {
    await this.stepRunBtn.click();
  }

  // Click reset-run
  async resetRun() {
    await this.resetRunBtn.click();
  }

  // Click analyze complexity
  async analyzeComplexity() {
    await this.showComplexityBtn.click();
  }

  // Read parse log text
  async parseLogText() {
    return (await this.parseLog.innerText()).trim();
  }

  // Read sim log text
  async simLogText() {
    return (await this.simLog.innerText()).trim();
  }

  async memoryUsageText() {
    return (await this.memoryUsage.innerText()).trim();
  }

  async complexityText() {
    return (await this.complexityOutput.innerText()).trim();
  }
}

// Global setup for capturing console / page errors for each test
test.describe('Space Complexity Interactive Explorer (Application ID: 12153822-fa7a-11f0-acf9-69409043402d)', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let page;

  test.beforeEach(async ({ browser }) => {
    pageErrors = [];
    consoleErrors = [];
    page = await browser.newPage();

    // Capture page errors and console errors for assertions
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // Close page after each test for clean slate
    await page.close();
  });

  // Initial Idle state checks
  test('S0_Idle: Initial render shows expected buttons and disabled states', async () => {
    const app = new SpaceComplexityPage(page);

    // Verify presence of UI elements and their initial disabled/enabled state
    await expect(app.addDsBtn).toBeVisible();
    await expect(app.parseAlgoBtn).toBeVisible();
    await expect(app.clearAlgoBtn).toBeVisible();
    await expect(app.runAlgoBtn).toBeVisible();
    await expect(app.stepRunBtn).toBeVisible();
    await expect(app.autoRunBtn).toBeVisible();
    await expect(app.resetRunBtn).toBeVisible();
    await expect(app.showComplexityBtn).toBeVisible();

    await expect(app.runAlgoBtn).toBeDisabled();
    await expect(app.stepRunBtn).toBeDisabled();
    await expect(app.autoRunBtn).toBeDisabled();
    await expect(app.resetRunBtn).toBeDisabled();
    await expect(app.showComplexityBtn).toBeDisabled();

    // Structure list should indicate none initially
    await expect(app.structureList).toHaveText('(none)');

    // No unhandled console or page errors should have occurred on initial load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Add structure workflow and edge cases
  test('S0 -> S1 AddStructure: adding structures, name required, uniqueness enforced', async () => {
    const app = new SpaceComplexityPage(page);

    // Capture dialog messages (alerts) and auto-dismiss them while preserving message text
    const dialogs = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    // Attempt to add with empty name -> should alert "Structure name is required."
    await app.addDsBtn.click();
    expect(dialogs.pop()).toBe('Structure name is required.');

    // Add a valid structure named "arr" with size param "n"
    await app.addStructure({ name: 'arr', type: 'array', sizeParam: 'n', desc: 'dynamic array' });

    // After adding, structure-list should contain a button with the name
    await expect(app.structureList).toContainText('arr');

    // Add duplicate name -> alert "Structure name must be unique."
    await app.addStructure({ name: 'arr', type: 'array', sizeParam: 'n', desc: '' });
    expect(dialogs.pop()).toBe('Structure name must be unique.');

    // There should be no JS page errors or console error messages after these operations
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Parse algorithm and verify transition to AlgorithmParsed (S2)
  test('S1 -> S2 ParseAlgorithm: parsing valid algorithm enables inputs and run button', async () => {
    const app = new SpaceComplexityPage(page);

    // Ensure structure exists required by the algorithm
    await app.addStructure({ name: 'arr', type: 'array', sizeParam: 'n', desc: 'dynamic array' });

    // Valid pseudo-code that uses the defined structure 'arr'
    const code = `function foo(n)
let a = arr of size n
for i = 1 to n
  // nothing complex, but loop exists
end
return a
end`;

    await app.parseAlgorithm(code);

    // parseLog should report success
    await expect(app.parseLog).toHaveText(/Algorithm parsed successfully\./);

    // Inputs area should show an input for 'n'
    await expect(app.inputsArea).toContainText('n:');

    // After parsing, Run button must be enabled per implementation
    await expect(app.runAlgoBtn).toBeEnabled();

    // Step, auto, reset, show complexity remain disabled until run
    await expect(app.stepRunBtn).toBeDisabled();
    await expect(app.autoRunBtn).toBeDisabled();
    await expect(app.resetRunBtn).toBeDisabled();
    await expect(app.showComplexityBtn).toBeDisabled();

    // Confirm no JS page errors occurred during parse
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Run algorithm and check simulation initialization (S2 -> S3)
  test('S2 -> S3 RunAlgorithm: providing inputs and starting simulation prepares simulation state', async () => {
    const app = new SpaceComplexityPage(page);

    // Add structure required by code
    await app.addStructure({ name: 'arr', type: 'array', sizeParam: 'n', desc: 'dynamic array' });

    const code = `function foo(n)
let a = arr of size n
return a
end`;

    await app.parseAlgorithm(code);

    // Provide invalid input first and assert alert is shown
    const dialogs = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    // Click run with empty input -> should show validation alert
    await app.runAlgoBtn.click();
    expect(dialogs.pop()).toBe('Please enter valid non-negative integer input values for all parameters');

    // Provide valid input and run
    await app.setInputParam('n', 3);
    await app.runAlgorithm();

    // After run, simulation should be started and step/auto/reset should be enabled
    await expect(app.stepRunBtn).toBeEnabled();
    await expect(app.autoRunBtn).toBeEnabled();
    await expect(app.resetRunBtn).toBeEnabled();

    // showComplexity should remain disabled until resetSimulation is called (per implementation)
    await expect(app.showComplexityBtn).toBeDisabled();

    // Sim log should indicate that simulation started for 'foo'
    await expect(app.simLog).toContainText('Started simulation for function: foo');

    // Memory usage area should show current memory allocated lines
    await expect(app.memoryUsage).toContainText('Current memory allocated:');

    // No JS errors in the console or page error event
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Step through simulation (S3 -> S4)
  test('S3 -> S4 StepRun: stepping executes statements and updates memory and call-stack views', async () => {
    const app = new SpaceComplexityPage(page);

    // Add structure and parse simple algorithm that allocates 'a' sized by n
    await app.addStructure({ name: 'arr', type: 'array', sizeParam: 'n', desc: 'dynamic array' });

    const code = `function foo(n)
let a = arr of size n
return a
end`;

    await app.parseAlgorithm(code);
    await app.setInputParam('n', 4);
    await app.runAlgorithm();

    // Step once, expect a 'let' allocation to appear in sim log
    await app.stepOnce();

    const simText = await app.simLogText();
    expect(simText).toMatch(/let a = arr .*allocates memory/);

    // Memory usage should reflect allocation; max should be shown too
    const memText = await app.memoryUsageText();
    expect(memText).toMatch(/Current memory allocated:/);

    // Call stack should be visible and reference the function
    const cs = await app.callStack.innerText();
    expect(cs).toContain('Function: foo');

    // showComplexity still disabled at this stage per implementation
    await expect(app.showComplexityBtn).toBeDisabled();

    // Pressing spacebar should also trigger a step (keyboard shortcut) if enabled
    // (Space triggers if stepRunBtn is not disabled)
    await page.keyboard.press('Space');
    // After pressing space, there should be additional log entries
    const simTextAfter = await app.simLogText();
    expect(simTextAfter.length).toBeGreaterThan(simText.length);

    // Confirm no JS page errors occurred
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Reset and analyze complexity (S4 -> S5)
  test('S4 -> S5 ShowComplexity: reset-run enables analysis then analysis produces summary output', async () => {
    const app = new SpaceComplexityPage(page);

    // Setup: create structure, parse, provide input, run
    await app.addStructure({ name: 'arr', type: 'array', sizeParam: 'n', desc: 'dynamic array' });

    const code = `function foo(n)
let a = arr of size n
return a
end`;

    await app.parseAlgorithm(code);
    await app.setInputParam('n', 2);
    await app.runAlgorithm();

    // reset-run button should exist and be enabled; clicking it calls resetSimulation which (per implementation)
    // enables showComplexityBtn
    await expect(app.resetRunBtn).toBeEnabled();
    await app.resetRun();

    // After reset, implementation sets showComplexityBtn.disabled = false
    await expect(app.showComplexityBtn).toBeEnabled();

    // Click analyze complexity - should provide textual summary including maximum memory allocated
    await app.analyzeComplexity();

    const complexText = await app.complexityText();
    expect(complexText).toMatch(/Maximum memory allocated during execution:/);
    expect(complexText).toContain('Input parameters:');

    // No JS errors during this flow
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Parsing error scenarios and handling (edge cases)
  test('Edge cases: parsing malformed algorithm and missing end reports parse errors', async () => {
    const app = new SpaceComplexityPage(page);

    // Provide malformed code (missing end)
    const badCode = `function bad(n)
let a = arr of size n
return a`;
    await app.parseAlgorithm(badCode);

    // Parse log should signal a missing 'end' error
    await expect(app.parseLog).toContainText("Function block missing 'end'");

    // Now provide code with unknown structure name -> should produce parse error about structure not defined
    const codeWithUnknownStruct = `function bad(n)
let a = unknownStruct of size n
end`;
    await app.parseAlgorithm(codeWithUnknownStruct);

    await expect(app.parseLog).toContainText('Structure "unknownStruct" not defined');

    // No JS page errors or console errors should be emitted by parser even on malformed inputs
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Additional edge case: control statements not fully supported in nested contexts produce helpful parse messages
  test('Edge cases: unsupported constructs produce relevant parse log messages and do not crash the page', async () => {
    const app = new SpaceComplexityPage(page);

    // Add structure required
    await app.addStructure({ name: 'obj', type: 'object', sizeParam: '', desc: 'object' });

    // Provide code with an invalid let syntax to trigger parser error
    const invalidLet = `function test()
let = obj
end`;
    await app.parseAlgorithm(invalidLet);
    await expect(app.parseLog).toContainText('Error parsing let');

    // Provide completely unknown statement
    const unknownStmt = `function test()
foobar something
end`;
    await app.parseAlgorithm(unknownStmt);
    await expect(app.parseLog).toContainText('Unknown statement or syntax');

    // Ensure the page did not emit JS runtime exceptions for these user errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});